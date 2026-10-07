package com.globits.richy.battle;

import com.globits.richy.dto.BattleOnlinePetSelectionDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.domain.Role;
import java.util.Collections;
import javax.persistence.EntityManager;
import javax.persistence.Query;
import com.globits.security.repository.UserRepository;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlinePetSelectionTest {
    private BattleOnlineServiceImpl service;
    private UserRepository users;
    private User student;

    @Before
    public void setup() {
        service = new BattleOnlineServiceImpl();
        users = mock(UserRepository.class);
        ReflectionTestUtils.setField(service, "userRepository", users);
        student = new User();
        student.setUsername("student");
        student.setSelectedLearningPet("CUTE_TOM_CAT");
        when(users.findByUsernameAndPerson("student")).thenReturn(student);
    }

    private BattleOnlinePetSelectionDto choose(String key, int level) {
        student.setTotalVocabularyWordsLearned(level * User.VOCABULARY_WORDS_PER_LEVEL);
        BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
        request.setPetKey(key);
        return service.selectPet("student", request);
    }

    @Test
    public void rejectsJerryBeforeLevelTwelveWithoutChangingSelection() {
        try {
            choose("CUTE_JERRY_MOUSE", 11);
            fail("Jerry must remain locked at level 11");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 12"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
    }

    @Test
    public void persistsJerryAtEveryEvolutionStageAndKeepsEarlierPetsUnlocked() {
        for (int level : new int[] {12, 13, 14, 20}) {
            BattleOnlinePetSelectionDto result = choose(" cute_jerry_mouse ", level);
            assertEquals("CUTE_JERRY_MOUSE", result.getSelectedPetKey());
            assertEquals("CUTE_JERRY_MOUSE", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertEquals(level >= 15 ? 6 : 5, result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_TOM_CAT"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void tomStaysSelectableAndJerryIsNotAdvertisedAtLevelEleven() {
        BattleOnlinePetSelectionDto result = choose("CUTE_TOM_CAT", 11);
        assertEquals("CUTE_TOM_CAT", result.getSelectedPetKey());
        assertEquals(4, result.getUnlockedPetKeys().size());
        assertFalse(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
        assertEquals("CUTE_TOM_CAT", choose("CUTE_TOM_CAT", 14).getSelectedPetKey());
    }

    @Test
    public void adminCanSelectAllPetsAtLevelZeroWithoutGainingExperience() {
        Role admin = new Role();
        admin.setName("ROLE_ADMIN");
        student.getRoles().add(admin);
        for (String key : new String[] {"MAM_HOC", "CAPYBARA_EGG", "CUTE_DOG", "CUTE_TOM_CAT", "CUTE_JERRY_MOUSE", "CUTE_TUFFY_MOUSE"}) {
            BattleOnlinePetSelectionDto result = choose(key, 0);
            assertEquals(key, student.getSelectedLearningPet());
            assertEquals(key, result.getSelectedPetKey());
            assertTrue(result.isAllPetsUnlocked());
            assertEquals(6, result.getUnlockedPetKeys().size());
            assertEquals(0, result.getVocabularyExperienceLevel());
            assertEquals(Long.valueOf(0L), student.getTotalVocabularyWordsLearned());
        }
        verify(users, times(6)).save(student);
    }

    @Test
    public void clientCannotClaimAdminPetAccessOrUseAnotherRoleToUnlockPets() {
        for (String name : new String[] {"ROLE_STUDENT", "ROLE_STAFF", "ROLE_EDUCATION_MANAGERMENT", "ROLE_ADMINISTRATOR"}) {
            student.getRoles().clear();
            Role role = new Role(); role.setName(name); student.getRoles().add(role);
            student.setTotalVocabularyWordsLearned(0L);
            BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
            request.setPetKey("CUTE_TUFFY_MOUSE");
            request.setAllPetsUnlocked(true);
            try {
                service.selectPet("student", request);
                fail("Only ROLE_ADMIN may bypass the level restriction");
            } catch (BattleOnlineException error) {
                assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            }
            assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        }
        verify(users, never()).save(any(User.class));
    }

    @Test
    public void rejoiningUsesTheDatabaseAdminRoleAndPreservesTheRealLevel() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L, "", "", "Admin", 0L, "CUTE_TUFFY_MOUSE"
        }));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("CUTE_TUFFY_MOUSE", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
        verify(roles).setParameter("userId", 7L);
        verify(roles).setParameter("roleName", "ROLE_ADMIN");
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
    }

    @Test
    public void rejectsTuffyBeforeLevelFifteenWithoutChangingSelection() {
        try {
            choose("CUTE_TUFFY_MOUSE", 14);
            fail("Tuffy must remain locked at level 14");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 15"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
    }

    @Test
    public void persistsTuffyAtEveryEvolutionStageAndKeepsEarlierPetsUnlocked() {
        for (int level : new int[] {15, 16, 17, 20}) {
            BattleOnlinePetSelectionDto result = choose(" cute_tuffy_mouse ", level);
            assertEquals("CUTE_TUFFY_MOUSE", result.getSelectedPetKey());
            assertEquals("CUTE_TUFFY_MOUSE", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertEquals(6, result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_TUFFY_MOUSE"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void rejoiningKeepsTuffyOnlyWhenTheRealLevelUnlocksIt() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int level : new int[] {14, 15, 16, 17}) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, "CUTE_TUFFY_MOUSE"
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(level >= 15 ? "CUTE_TUFFY_MOUSE" : "MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
    }
}
