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
    public void rejectsPerryBeforeLevelFourWithoutChangingSelection() {
        try {
            choose("CUTE_PERRY", 3);
            fail("Perry must remain locked at level 3");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 4"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
        assertFalse(choose("MAM_HOC", 3).getUnlockedPetKeys().contains("CUTE_PERRY"));
    }

    @Test
    public void persistsPerryFromLevelFourAndKeepsEarlierPetsUnlocked() {
        for (int level : new int[] {4, 5, 6, 20}) {
            BattleOnlinePetSelectionDto result = choose(" cute_perry ", level);
            assertEquals("CUTE_PERRY", result.getSelectedPetKey());
            assertEquals("CUTE_PERRY", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertFalse(result.isAllPetsUnlocked());
            assertTrue(result.getUnlockedPetKeys().contains("MAM_HOC"));
            assertTrue(result.getUnlockedPetKeys().contains("CAPYBARA_EGG"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_PERRY"));
            assertEquals((level >= 20 ? 9 : (level >= 18 ? 8 : (level >= 6 ? 4 : 3))) + Math.max(0, Math.min(7,level - 5)), result.getUnlockedPetKeys().size());
        }
        verify(users, times(4)).save(student);
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
            assertEquals(level >= 20 ? 16 : (level >= 18 ? 15 : (level >= 15 ? 14 : 13)), result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_TOM_CAT"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void tomStaysSelectableAndJerryIsNotAdvertisedAtLevelEleven() {
        BattleOnlinePetSelectionDto result = choose("CUTE_TOM_CAT", 11);
        assertEquals("CUTE_TOM_CAT", result.getSelectedPetKey());
        assertEquals(11, result.getUnlockedPetKeys().size());
        assertFalse(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
        assertEquals("CUTE_TOM_CAT", choose("CUTE_TOM_CAT", 14).getSelectedPetKey());
    }

    @Test
    public void adminCanSelectAllPetsAtLevelZeroWithoutGainingExperience() {
        Role admin = new Role();
        admin.setName("ROLE_ADMIN");
        student.getRoles().add(admin);
        for (String key : new String[] {"MAM_HOC", "CAPYBARA_EGG", "CUTE_PERRY", "CUTE_DOG", "CUTE_TOM_CAT", "CUTE_JERRY_MOUSE", "CUTE_TUFFY_MOUSE", "CUTE_PIKACHU", "SPARKLING_LIGHTNING"}) {
            BattleOnlinePetSelectionDto result = choose(key, 0);
            assertEquals(key, student.getSelectedLearningPet());
            assertEquals(key, result.getSelectedPetKey());
            assertTrue(result.isAllPetsUnlocked());
            assertEquals(16, result.getUnlockedPetKeys().size());
            assertEquals(0, result.getVocabularyExperienceLevel());
            assertEquals(Long.valueOf(0L), student.getTotalVocabularyWordsLearned());
        }
        verify(users, times(9)).save(student);
    }

    @Test
    public void clientCannotClaimAdminPetAccessOrUseAnotherRoleToUnlockPets() {
        for (String name : new String[] {"ROLE_STUDENT", "ROLE_STAFF", "ROLE_EDUCATION_MANAGERMENT", "ROLE_ADMINISTRATOR"}) {
            student.getRoles().clear();
            Role role = new Role(); role.setName(name); student.getRoles().add(role);
            student.setTotalVocabularyWordsLearned(0L);
            BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
            request.setPetKey("CUTE_PIKACHU");
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
            assertEquals(level >= 20 ? 16 : (level >= 18 ? 15 : 14), result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_JERRY_MOUSE"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_TUFFY_MOUSE"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void rejectsPikachuBeforeLevelEighteenWithoutChangingSelection() {
        try {
            choose("CUTE_PIKACHU", 17);
            fail("Pikachu must remain locked at level 17");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 18"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
        assertFalse(choose("CUTE_TUFFY_MOUSE", 17).getUnlockedPetKeys().contains("CUTE_PIKACHU"));
    }

    @Test
    public void persistsPikachuAtEveryEvolutionStageAndKeepsEarlierPetsUnlocked() {
        for (int level : new int[] {18, 19, 20, 25}) {
            BattleOnlinePetSelectionDto result = choose(" cute_pikachu ", level);
            assertEquals("CUTE_PIKACHU", result.getSelectedPetKey());
            assertEquals("CUTE_PIKACHU", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertFalse(result.isAllPetsUnlocked());
            assertEquals(level >= 20 ? 16 : 15, result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_TUFFY_MOUSE"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_PIKACHU"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void rejectsSparklingLightningBeforeLevelTwentyWithoutChangingSelection() {
        BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
        request.setPetKey("SPARKLING_LIGHTNING");
        request.setAllPetsUnlocked(true);
        student.setTotalVocabularyWordsLearned(19L * User.VOCABULARY_WORDS_PER_LEVEL);
        try {
            service.selectPet("student", request);
            fail("Sparkling lightning must remain locked at level 19, even if the client claims admin access");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 20"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
        assertFalse(choose("CUTE_PIKACHU", 19).getUnlockedPetKeys().contains("SPARKLING_LIGHTNING"));
    }

    @Test
    public void persistsSparklingLightningAtLevelTwentyAndLaterWithoutReplacingOtherPets() {
        for (int level : new int[] {20, 21, 50}) {
            BattleOnlinePetSelectionDto result = choose(" sparkling_lightning ", level);
            assertEquals("SPARKLING_LIGHTNING", result.getSelectedPetKey());
            assertEquals("SPARKLING_LIGHTNING", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertFalse(result.isAllPetsUnlocked());
            assertEquals(16, result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_PIKACHU"));
            assertTrue(result.getUnlockedPetKeys().contains("DRAGON_BALL_7"));
            assertTrue(result.getUnlockedPetKeys().contains("SPARKLING_LIGHTNING"));
        }
        verify(users, times(3)).save(student);
    }

    @Test
    public void unknownLightningKeysStillNormalizeToTheDefaultPet() {
        for (String key : new String[] {"SPARKLING_LIGHTNING_EXTRA", "LIGHTNING", "UNKNOWN_PET"}) {
            assertEquals("MAM_HOC", choose(key, 20).getSelectedPetKey());
            assertEquals("MAM_HOC", student.getSelectedLearningPet());
        }
        verify(users, times(3)).save(student);
    }

    @Test
    public void rejoiningKeepsSparklingLightningOnlyWhenTheRealLevelOrAdminRoleUnlocksIt() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int level : new int[] {0, 19, 20, 21, 50}) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, "SPARKLING_LIGHTNING"
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(level >= 20 ? "SPARKLING_LIGHTNING" : "MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L, "", "", "Admin", 0L, "SPARKLING_LIGHTNING"
        }));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("SPARKLING_LIGHTNING", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
    }

    @Test
    public void rejoiningKeepsPerryOnlyWhenLevelOrAdminRoleUnlocksIt() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int level : new int[] {0, 3, 4, 5, 20}) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, "CUTE_PERRY"
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(level >= 4 ? "CUTE_PERRY" : "MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L, "", "", "Admin", 0L, "CUTE_PERRY"
        }));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("CUTE_PERRY", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
    }

    @Test
    public void rejoiningKeepsPikachuOnlyWhenLevelOrAdminRoleUnlocksIt() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int level : new int[] {17, 18, 19, 20}) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, "CUTE_PIKACHU"
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(level >= 18 ? "CUTE_PIKACHU" : "MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L, "", "", "Admin", 0L, "CUTE_PIKACHU"
        }));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("CUTE_PIKACHU", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
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
    @Test public void dragonBallsUnlockCumulativelyAndPersistOnlyAtTheRequiredLevel() {
        for (int stars = 1; stars <= 7; stars++) {
            String key = "DRAGON_BALL_" + stars;
            student.setSelectedLearningPet("MAM_HOC");
            try { choose(key,stars + 4); fail("Ball selected below its unlock level"); }
            catch (BattleOnlineException error) { assertTrue(error.getMessage().contains("level " + (stars + 5))); }
            assertEquals("MAM_HOC",student.getSelectedLearningPet());
            BattleOnlinePetSelectionDto selected = choose(" dragon_ball_" + stars + " ",stars + 5);
            assertEquals(key,selected.getSelectedPetKey());
            assertEquals(key,student.getSelectedLearningPet());
            for (int other = 1; other <= 7; other++) {
                assertEquals(other <= stars,selected.getUnlockedPetKeys().contains("DRAGON_BALL_" + other));
            }
            assertEquals(stars + 5,selected.getVocabularyExperienceLevel());
        }
        Role admin = new Role(); admin.setName("ROLE_ADMIN");student.getRoles().add(admin);
        for (int stars = 1; stars <= 7; stars++) {
            assertEquals("DRAGON_BALL_" + stars,choose("DRAGON_BALL_" + stars,0).getSelectedPetKey());
            assertEquals(Long.valueOf(0),student.getTotalVocabularyWordsLearned());
        }
    }

    @Test public void reconnectKeepsUnlockedDragonBallsAndRejectsStaleLockedChoices() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service,"entityManager",entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int stars = 1; stars <= 7; stars++) for (int delta : new int[] {-1,0,10}) {
            int level = stars + 5 + delta;
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L,"","","Student",level * User.VOCABULARY_WORDS_PER_LEVEL,"DRAGON_BALL_" + stars
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service,"findPlayerIdentity","student");
            assertEquals(delta < 0 ? "MAM_HOC" : "DRAGON_BALL_" + stars,ReflectionTestUtils.getField(identity,"selectedPetKey"));
        }
    }

}
