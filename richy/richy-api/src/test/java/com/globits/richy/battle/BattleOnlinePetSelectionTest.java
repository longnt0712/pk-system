package com.globits.richy.battle;

import com.globits.richy.dto.BattleOnlinePetSelectionDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlinePlayerDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.domain.Role;
import java.util.Collections;
import java.util.Map;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
        setSeasonClock("2026-06-15T12:00:00Z");
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

    private void setSeasonClock(String instant) {
        ReflectionTestUtils.setField(service, "petSeasonClock", Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
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
        for (String key : new String[] {"MAM_HOC", "CAPYBARA_EGG", "CUTE_PERRY", "CUTE_DOG", "CUTE_TOM_CAT", "CUTE_JERRY_MOUSE", "CUTE_TUFFY_MOUSE", "CUTE_PIKACHU", "SPARKLING_LIGHTNING", "GOKU_KID", "GOKU_SSJ1", "GOKU_SSJ2", "GOKU_SSJ4", "HALLOWEEN_PUMPKIN"}) {
            BattleOnlinePetSelectionDto result = choose(key, 0);
            assertEquals(key, student.getSelectedLearningPet());
            assertEquals(key, result.getSelectedPetKey());
            assertTrue(result.isAllPetsUnlocked());
            assertEquals(21, result.getUnlockedPetKeys().size());
            assertEquals(0, result.getVocabularyExperienceLevel());
            assertEquals(Long.valueOf(0L), student.getTotalVocabularyWordsLearned());
        }
        verify(users, times(14)).save(student);
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
            assertEquals(level >= 25 ? 20 : (level >= 21 ? 17 : (level >= 20 ? 16 : 15)), result.getUnlockedPetKeys().size());
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
            assertEquals(level >= 25 ? 20 : (level >= 21 ? 17 : 16), result.getUnlockedPetKeys().size());
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
    public void rejectsGokuKidBeforeLevelTwentyOneEvenWithForgedClientUnlocks() {
        student.setTotalVocabularyWordsLearned(20L * User.VOCABULARY_WORDS_PER_LEVEL);
        BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
        request.setPetKey("GOKU_KID");
        request.setAllPetsUnlocked(true);
        request.setVocabularyExperienceLevel(100);
        try {
            service.selectPet("student", request);
            fail("Goku must stay locked until the student's real level reaches 21");
        } catch (BattleOnlineException error) {
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertTrue(error.getMessage().contains("level 21"));
        }
        assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        verify(users, never()).save(any(User.class));
        assertFalse(choose("CUTE_PIKACHU", 20).getUnlockedPetKeys().contains("GOKU_KID"));
    }

    @Test
    public void persistsGokuKidAtBothEvolutionLevelsAndLater() {
        for (int level : new int[] {21, 22, 23, 50}) {
            BattleOnlinePetSelectionDto result = choose(" goku_kid ", level);
            assertEquals("GOKU_KID", result.getSelectedPetKey());
            assertEquals("GOKU_KID", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertEquals(Long.valueOf(level * User.VOCABULARY_WORDS_PER_LEVEL), student.getTotalVocabularyWordsLearned());
            assertFalse(result.isAllPetsUnlocked());
            assertEquals(17 + Math.max(0, Math.min(3, level - 22)), result.getUnlockedPetKeys().size());
            assertTrue(result.getUnlockedPetKeys().contains("MAM_HOC"));
            assertTrue(result.getUnlockedPetKeys().contains("CUTE_PIKACHU"));
            assertTrue(result.getUnlockedPetKeys().contains("SPARKLING_LIGHTNING"));
            assertTrue(result.getUnlockedPetKeys().contains("GOKU_KID"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void rejoiningKeepsGokuKidOnlyWhenTheRealLevelOrAdminRoleUnlocksIt() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        for (int level : new int[] {0, 20, 21, 22, 23, 50}) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, "GOKU_KID"
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(level >= 21 ? "GOKU_KID" : "MAM_HOC", ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.FALSE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                7L, "", "", "Admin", 0L, "GOKU_KID"
        }));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("GOKU_KID", ReflectionTestUtils.getField(identity, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
    }

    @Test
    public void unknownGokuKeysStillNormalizeToTheDefaultPet() {
        for (String key : new String[] {"GOKU", "GOKU_KID_EXTRA", "KID_GOKU"}) {
            assertEquals("MAM_HOC", choose(key, 23).getSelectedPetKey());
            assertEquals("MAM_HOC", student.getSelectedLearningPet());
        }
        verify(users, times(3)).save(student);
    }

    @Test
    public void eachSuperSaiyanFormRequiresItsOwnRealUnlockLevel() {
        String[] keys = {"GOKU_SSJ1", "GOKU_SSJ2", "GOKU_SSJ4"};
        int[] unlocks = {23, 24, 25};
        for (int i = 0; i < keys.length; i++) {
            student.setTotalVocabularyWordsLearned((unlocks[i] - 1L) * User.VOCABULARY_WORDS_PER_LEVEL);
            BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
            request.setPetKey(keys[i]);
            request.setVocabularyExperienceLevel(100);
            request.setAllPetsUnlocked(true);
            try {
                service.selectPet("student", request);
                fail(keys[i] + " must stay locked before its required level");
            } catch (BattleOnlineException error) {
                assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
                assertTrue(error.getMessage().contains("level " + unlocks[i]));
            }
            assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        }
        verify(users, never()).save(any(User.class));
    }

    @Test
    public void gokuFormsUnlockCumulativelyAndRemainIndependentlySelectable() {
        String[] keys = {"GOKU_KID", "GOKU_SSJ1", "GOKU_SSJ2", "GOKU_SSJ4"};
        int[] unlocks = {21, 23, 24, 25};
        for (int level : new int[] {20, 21, 22, 23, 24, 25, 50}) {
            BattleOnlinePetSelectionDto catalog = choose("MAM_HOC", level);
            for (int i = 0; i < keys.length; i++) {
                assertEquals(keys[i] + " at level " + level,
                        level >= unlocks[i], catalog.getUnlockedPetKeys().contains(keys[i]));
            }
        }
        for (String key : keys) {
            BattleOnlinePetSelectionDto result = choose(" " + key.toLowerCase(java.util.Locale.ROOT) + " ", 50);
            assertEquals(key, student.getSelectedLearningPet());
            assertEquals(key, result.getSelectedPetKey());
            assertEquals(50, result.getVocabularyExperienceLevel());
            assertFalse(result.isAllPetsUnlocked());
        }
        assertEquals("GOKU_KID", choose("GOKU_KID", 50).getSelectedPetKey());
        assertEquals("GOKU_KID", student.getSelectedLearningPet());
        verify(users, times(12)).save(student);
    }

    @Test
    public void reconnectReloadsEachSavedGokuFormWithoutChangingItToTheHighestForm() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        String[] keys = {"GOKU_KID", "GOKU_SSJ1", "GOKU_SSJ2", "GOKU_SSJ4"};
        int[] unlocks = {21, 23, 24, 25};
        for (int i = 0; i < keys.length; i++) {
            choose(keys[i], 50);
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Student", student.getTotalVocabularyWordsLearned(), student.getSelectedLearningPet()
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(keys[i], ReflectionTestUtils.getField(identity, "selectedPetKey"));
            for (int level : new int[] {unlocks[i] - 1, unlocks[i]}) {
                when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                        7L, "", "", "Student", level * User.VOCABULARY_WORDS_PER_LEVEL, keys[i]
                }));
                identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
                assertEquals(level < unlocks[i] ? "MAM_HOC" : keys[i],
                        ReflectionTestUtils.getField(identity, "selectedPetKey"));
                assertEquals(level, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            }
        }
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        for (String key : keys) {
            when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {
                    7L, "", "", "Admin", 0L, key
            }));
            Object identity = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
            assertEquals(key, ReflectionTestUtils.getField(identity, "selectedPetKey"));
            assertEquals(0, ReflectionTestUtils.getField(identity, "vocabularyExperienceLevel"));
            assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(identity, "allPetsUnlocked"));
        }
        verify(users, times(4)).save(student);
    }

    @Test
    @SuppressWarnings("unchecked")
    public void selectingEachGokuFormUpdatesTheJoinedRoomAndItsBroadcast() throws Exception {
        Object room = privateState("RoomState"), player = privateState("PlayerState");
        ReflectionTestUtils.setField(room, "code", "GOKUS");
        ReflectionTestUtils.setField(room, "status", "LOBBY");
        ReflectionTestUtils.setField(room, "hostUsername", "student");
        ReflectionTestUtils.setField(player, "username", "student");
        ReflectionTestUtils.setField(player, "connected", true);
        ReflectionTestUtils.setField(player, "selectedPetKey", "GOKU_KID");
        ((Map<String, Object>) ReflectionTestUtils.getField(room, "players")).put("student", player);
        ((Map<String, Object>) ReflectionTestUtils.getField(service, "rooms")).put("GOKUS", room);
        org.springframework.messaging.simp.SimpMessagingTemplate messages =
                mock(org.springframework.messaging.simp.SimpMessagingTemplate.class);
        ReflectionTestUtils.setField(service, "messagingTemplate", messages);
        for (String key : new String[] {"GOKU_SSJ1", "GOKU_SSJ2", "GOKU_SSJ4"}) {
            assertEquals(key, choose(key, 50).getSelectedPetKey());
            assertEquals(key, ReflectionTestUtils.getField(player, "selectedPetKey"));
            BattleOnlineRoomDto snapshot = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "student");
            assertEquals(key, selectedInRoom(snapshot, "student"));
        }
        verify(messages, times(3)).convertAndSend(eq("/topic/battle-online/room/GOKUS"), any(BattleOnlineRoomDto.class));
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

    @Test
    public void halloweenSeasonUsesUtcPlusSevenAndRepeatsEveryYear() {
        String[] instants = {
                "2026-09-30T16:59:59.999Z", "2026-09-30T17:00:00Z", "2026-10-31T17:00:00Z",
                "2026-11-05T16:59:59.999Z", "2026-11-05T17:00:00Z", "2027-01-01T00:00:00Z",
                "2027-09-30T17:00:00Z", "2027-11-05T16:59:59.999Z", "2027-11-05T17:00:00Z"
        };
        boolean[] available = {false, true, true, true, false, false, true, true, false};
        for (int i = 0; i < instants.length; i++) {
            setSeasonClock(instants[i]);
            assertEquals(instants[i], available[i], ReflectionTestUtils.<Boolean>invokeMethod(service, "isHalloweenPetSeason"));
            BattleOnlinePetSelectionDto ordinary = choose("MAM_HOC", 0);
            assertEquals(instants[i], available[i], ordinary.getUnlockedPetKeys().contains("HALLOWEEN_PUMPKIN"));
            if (available[i]) {
                assertEquals("HALLOWEEN_PUMPKIN", choose("HALLOWEEN_PUMPKIN", 0).getSelectedPetKey());
            } else {
                try { choose("HALLOWEEN_PUMPKIN", 0); fail("Pumpkin must be locked at " + instants[i]); }
                catch (BattleOnlineException expected) { assertEquals(HttpStatus.BAD_REQUEST, expected.getStatus()); }
                assertEquals("MAM_HOC", student.getSelectedLearningPet());
            }
        }
    }

    @Test
    public void halloweenPumpkinBelongsToEveryoneWithoutARequiredLevel() {
        setSeasonClock("2026-10-28T00:00:00Z");
        for (int level : new int[] {0, 1, 20, 50}) {
            BattleOnlinePetSelectionDto result = choose(" halloween_pumpkin ", level);
            assertEquals("HALLOWEEN_PUMPKIN", result.getSelectedPetKey());
            assertEquals("HALLOWEEN_PUMPKIN", student.getSelectedLearningPet());
            assertEquals(level, result.getVocabularyExperienceLevel());
            assertFalse(result.isAllPetsUnlocked());
            assertTrue(result.getUnlockedPetKeys().contains("MAM_HOC"));
            assertTrue(result.getUnlockedPetKeys().contains("HALLOWEEN_PUMPKIN"));
            assertEquals(level >= 25 ? 21 : (level >= 21 ? 18 : (level >= 20 ? 17 : 2)), result.getUnlockedPetKeys().size());
        }
        verify(users, times(4)).save(student);
    }

    @Test
    public void clientCannotBypassTheSeasonWithAClaimedAdminFlagOrAnotherRole() {
        setSeasonClock("2026-11-05T17:00:00Z");
        BattleOnlinePetSelectionDto request = new BattleOnlinePetSelectionDto();
        request.setPetKey("HALLOWEEN_PUMPKIN");
        request.setAllPetsUnlocked(true);
        for (String roleName : new String[] {"ROLE_STUDENT", "ROLE_STAFF", "ROLE_ADMINISTRATOR"}) {
            student.getRoles().clear();
            Role role = new Role(); role.setName(roleName); student.getRoles().add(role);
            try { service.selectPet("student", request); fail("Only a real admin may bypass the season"); }
            catch (BattleOnlineException expected) {
                assertEquals(HttpStatus.BAD_REQUEST, expected.getStatus());
                assertTrue(expected.getMessage().contains("1/10"));
                assertTrue(expected.getMessage().contains("5/11"));
            }
            assertEquals("CUTE_TOM_CAT", student.getSelectedLearningPet());
        }
        verify(users, never()).save(any(User.class));
    }

    @Test
    public void adminsCanChooseThePumpkinAtLevelZeroAllYear() {
        Role admin = new Role(); admin.setName("ROLE_ADMIN"); student.getRoles().add(admin);
        for (String instant : new String[] {"2026-01-01T00:00:00Z", "2026-09-30T16:59:59Z", "2026-10-01T00:00:00Z", "2026-11-05T17:00:00Z", "2026-12-31T23:59:59Z"}) {
            setSeasonClock(instant);
            BattleOnlinePetSelectionDto result = choose("HALLOWEEN_PUMPKIN", 0);
            assertTrue(result.isAllPetsUnlocked());
            assertTrue(result.getUnlockedPetKeys().contains("HALLOWEEN_PUMPKIN"));
            assertEquals("HALLOWEEN_PUMPKIN", result.getSelectedPetKey());
            assertEquals(0, result.getVocabularyExperienceLevel());
            assertEquals(Long.valueOf(0L), student.getTotalVocabularyWordsLearned());
        }
    }

    @Test
    public void reconnectResolvesSavedPumpkinsForTheCurrentSeasonAndRealAdminRole() {
        EntityManager entity = mock(EntityManager.class);
        Query account = mock(Query.class), roles = mock(Query.class);
        ReflectionTestUtils.setField(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(account.getResultList()).thenReturn(Collections.singletonList(new Object[] {7L, "", "", "Student", 0L, "HALLOWEEN_PUMPKIN"}));
        when(roles.getResultList()).thenReturn(Collections.emptyList());
        setSeasonClock("2026-11-05T16:59:59Z");
        Object inSeason = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("HALLOWEEN_PUMPKIN", ReflectionTestUtils.getField(inSeason, "selectedPetKey"));
        setSeasonClock("2026-11-05T17:00:00Z");
        Object expired = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("MAM_HOC", ReflectionTestUtils.getField(expired, "selectedPetKey"));
        when(roles.getResultList()).thenReturn(Collections.singletonList(1L));
        Object admin = ReflectionTestUtils.invokeMethod(service, "findPlayerIdentity", "student");
        assertEquals("HALLOWEEN_PUMPKIN", ReflectionTestUtils.getField(admin, "selectedPetKey"));
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(admin, "allPetsUnlocked"));
        verify(users, never()).save(any(User.class));
    }

    private Object privateState(String name) throws Exception {
        Constructor<?> constructor = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }

    private String selectedInRoom(BattleOnlineRoomDto room, String username) {
        for (BattleOnlinePlayerDto player : room.getPlayers()) {
            if (username.equals(player.getUsername())) { return player.getSelectedPetKey(); }
        }
        throw new AssertionError("Missing room player " + username);
    }

    @Test
    @SuppressWarnings("unchecked")
    public void alreadyOpenRoomsStopShowingThePumpkinAfterExpiryWhileAdminsKeepIt() throws Exception {
        Object room = privateState("RoomState");
        ReflectionTestUtils.setField(room, "code", "HALLOW");
        ReflectionTestUtils.setField(room, "status", "LOBBY");
        ReflectionTestUtils.setField(room, "hostUsername", "admin");
        Object ordinary = privateState("PlayerState"), admin = privateState("PlayerState");
        for (Object player : new Object[] {ordinary, admin}) {
            ReflectionTestUtils.setField(player, "selectedPetKey", "HALLOWEEN_PUMPKIN");
            ReflectionTestUtils.setField(player, "connected", true);
        }
        ReflectionTestUtils.setField(ordinary, "username", "student");
        ReflectionTestUtils.setField(admin, "username", "admin");
        ReflectionTestUtils.setField(admin, "allPetsUnlocked", true);
        Map<String, Object> players = (Map<String, Object>) ReflectionTestUtils.getField(room, "players");
        players.put("student", ordinary); players.put("admin", admin);
        student.setSelectedLearningPet("HALLOWEEN_PUMPKIN");
        setSeasonClock("2026-11-05T16:59:59.999Z");
        BattleOnlineRoomDto before = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "student");
        assertEquals("HALLOWEEN_PUMPKIN", selectedInRoom(before, "student"));
        assertEquals("HALLOWEEN_PUMPKIN", selectedInRoom(before, "admin"));
        setSeasonClock("2026-11-05T17:00:00Z");
        BattleOnlineRoomDto after = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "student");
        assertEquals("MAM_HOC", selectedInRoom(after, "student"));
        assertEquals("HALLOWEEN_PUMPKIN", selectedInRoom(after, "admin"));
        assertEquals("HALLOWEEN_PUMPKIN", student.getSelectedLearningPet());
        assertEquals("HALLOWEEN_PUMPKIN", ReflectionTestUtils.getField(ordinary, "selectedPetKey"));
        verify(users, never()).save(any(User.class));
    }

}
