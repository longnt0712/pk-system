package com.globits.richy.battle;

import com.globits.richy.dto.BattleOnlineAnswerDto;
import com.globits.richy.dto.BattleOnlineAnswerResultDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.dto.BattleOnlineUseSkillDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineDemonDefenseTest {
    private BattleOnlineServiceImpl service;
    private Object room, alice, bob, carol;
    private SimpMessagingTemplate messages;

    private Object state(String type) throws Exception {
        Constructor<?> constructor = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + type).getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }
    private void set(Object value, String name, Object data) { ReflectionTestUtils.setField(value, name, data); }
    private Object get(Object value, String name) { return ReflectionTestUtils.getField(value, name); }
    private Object player(String username, int team) throws Exception {
        Object player = state("PlayerState");
        set(player, "username", username); set(player, "displayName", username);
        set(player, "connected", true); set(player, "ready", true); set(player, "teamNumber", team);
        return player;
    }

    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service = new BattleOnlineServiceImpl();
        messages = mock(SimpMessagingTemplate.class);
        ReflectionTestUtils.setField(service, "messagingTemplate", messages);
        room = state("RoomState");
        set(room, "code", "DEMON1"); set(room, "status", "PLAYING"); set(room, "hostUsername", "host");
        set(room, "matchEndsAt", System.currentTimeMillis() + 60000L);
        Object settings = get(room, "settings");
        set(settings, "mode", "DEMON_DEFENSE"); set(settings, "teamCount", 2);
        alice = player("alice", 1); bob = player("bob", 1); carol = player("carol", 2);
        Object host = player("host", 0); set(host, "spectator", true); set(host, "host", true);
        Map<String, Object> players = (Map<String, Object>) get(room, "players");
        players.put("host", host); players.put("alice", alice); players.put("bob", bob); players.put("carol", carol);
        Map<Integer, Integer> members = new LinkedHashMap<Integer, Integer>(); members.put(1, 2); members.put(2, 1);
        set(room, "demonDefense", new DemonDefenseGame(System.currentTimeMillis() - 10000L, members));
        ((Map<String, Object>) ReflectionTestUtils.getField(service, "rooms")).put("DEMON1", room);
    }
    @After public void cleanup() { service.destroy(); }

    @Test @SuppressWarnings("unchecked") public void savedModeMakesHostSpectatorAndStartCreatesOneLanePerTeam() throws Exception {
        set(room, "status", "LOBBY"); set(room, "demonDefense", null);
        Map<String, Object> players = (Map<String, Object>) get(room, "players");
        set(players.get("host"), "spectator", false);
        BattleOnlineRoomSettingsDto settings = new BattleOnlineRoomSettingsDto();
        settings.setMode("DEMON_DEFENSE"); settings.setTeamCount(0); settings.setDoubleActionUsername("alice");
        settings.setQuestionCount(4);
        BattleOnlineRoomDto saved = service.updateSettings("DEMON1", "host", settings);
        assertEquals("DEMON_DEFENSE", saved.getSettings().getMode());
        assertEquals(2, saved.getSettings().getTeamCount());
        assertTrue((Boolean) get(players.get("host"), "spectator"));
        assertNull(saved.getSettings().getDoubleActionUsername());
        Map<Long, Object> prepared = (Map<Long, Object>) get(room, "preparedQuestions");
        for (long id = 1; id <= 4; id++) {
            Object question = state("QuestionState");
            set(question, "id", id); set(question, "question", "word " + id); set(question, "correctText", "nghĩa " + id);
            set(question, "correctKey", "A");
            List<Object> options = (List<Object>) get(question, "options");
            for (char key = 'A'; key <= 'D'; key++) {
                Object option = state("OptionState"); set(option, "key", String.valueOf(key)); set(option, "text", "option " + key);
                options.add(option);
            }
            prepared.put(id, question);
        }
        set(room, "allQuestionsLoaded", true);
        BattleOnlineRoomDto started = service.startMatch("DEMON1", "host");
        assertEquals("PLAYING", started.getStatus()); assertNotNull(started.getDemonDefense());
        assertEquals(2, started.getDemonDefense().teams.size());
        assertNull(get(players.get("host"), "currentQuestion"));
        assertNotNull(get(alice, "currentQuestion")); assertNotNull(get(carol, "currentQuestion"));
        assertTrue(((Map<?, ?>) ReflectionTestUtils.getField(service, "demonTimers")).containsKey("DEMON1"));
    }

    @Test public void promotedHostStaysAnObserverWhenOldHostLeavesLobby() {
        set(room, "status", "LOBBY"); set(room, "demonDefense", null);
        service.leaveRoom("DEMON1", "host");
        assertEquals("alice", get(room, "hostUsername"));
        assertTrue((Boolean) get(alice, "host")); assertTrue((Boolean) get(alice, "spectator"));
        assertEquals(0, get(alice, "teamNumber"));
        assertFalse((Boolean) get(bob, "spectator")); assertFalse((Boolean) get(carol, "spectator"));
        set(room, "status", "FINISHED"); set(room, "allQuestionsLoaded", true);
        set(room, "demonDefense", new DemonDefenseGame(System.currentTimeMillis(), new LinkedHashMap<Integer, Integer>()));
        service.restartMatch("DEMON1", "alice");
        assertEquals("LOBBY", get(room, "status")); assertNull(get(room, "demonDefense"));
        assertTrue((Boolean) get(alice, "spectator"));
    }

    @Test @SuppressWarnings("unchecked") public void breakSubtractsFiveFromOneRivalAndClassicStillResetsToZero() {
        set(carol, "streak", 35); set(bob, "streak", 22);
        set(alice, "pendingSkillType", "BREAK_STREAK");
        ((List<String>) get(alice, "pendingSkillTargetUsernames")).add("carol");
        BattleOnlineUseSkillDto skill = new BattleOnlineUseSkillDto(); skill.setTargetUsername("carol");
        service.useSkill("DEMON1", "alice", skill);
        assertEquals(30, get(carol, "streak")); assertEquals(22, get(bob, "streak"));
        BattleOnlineRoomDto snapshot = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "alice");
        assertEquals(5D, snapshot.getRecentEvents().get(0).getAmount(), 0D);
        assertTrue(snapshot.getRecentEvents().get(0).getMessage().contains("trừ 5 streak"));
        assertNull(get(alice, "pendingSkillType"));
        set(get(room, "settings"), "mode", "COUNTDOWN");
        set(alice, "pendingSkillType", "BREAK_STREAK");
        ((List<String>) get(alice, "pendingSkillTargetUsernames")).add("carol");
        service.useSkill("DEMON1", "alice", skill);
        assertEquals(0, get(carol, "streak"));
    }

    @Test public void unfreezeConsumesOneChargeAndOnlyRescuesFrozenTeammate() {
        set(alice, "unfreezeCharges", 1); set(bob, "frozenUntil", System.currentTimeMillis() + 3000L);
        set(carol, "frozenUntil", System.currentTimeMillis() + 3000L);
        BattleOnlineUseSkillDto skill = new BattleOnlineUseSkillDto(); skill.setSkillType("UNFREEZE");
        skill.setTargetUsername("carol");
        try { service.useSkill("DEMON1", "alice", skill); fail("Cannot rescue a rival"); }
        catch (BattleOnlineException expected) { assertEquals(1, get(alice, "unfreezeCharges")); }
        skill.setTargetUsername("bob"); service.useSkill("DEMON1", "alice", skill);
        assertEquals(0L, get(bob, "frozenUntil")); assertEquals(0, get(alice, "unfreezeCharges"));
        assertTrue((Long) get(carol, "frozenUntil") > 0);
        try { service.useSkill("DEMON1", "alice", skill); fail("Cannot reuse a spent charge"); }
        catch (BattleOnlineException expected) { assertEquals(0, get(alice, "unfreezeCharges")); }
    }

    @Test @SuppressWarnings("unchecked") public void freezeLocksOnlySelectedRivalForThreeSeconds() {
        set(alice, "pendingSkillType", "FREEZE");
        ((List<String>) get(alice, "pendingSkillTargetUsernames")).add("carol");
        BattleOnlineUseSkillDto skill = new BattleOnlineUseSkillDto(); skill.setTargetUsername("carol");
        long before = System.currentTimeMillis();
        service.useSkill("DEMON1", "alice", skill);
        long until = (Long) get(carol, "frozenUntil");
        assertTrue(until >= before + 3000L); assertTrue(until <= System.currentTimeMillis() + 3000L);
        assertEquals(0L, get(bob, "frozenUntil")); assertEquals(0L, get(alice, "frozenUntil"));
    }

    @Test @SuppressWarnings("unchecked") public void correctAnswerAtThresholdFiresTwoAndDuplicateRequestCannotFireAgain() throws Exception {
        Object question = state("QuestionState");
        set(question, "id", 7L); set(question, "question", "hello"); set(question, "correctText", "xin chào"); set(question, "correctKey", "A");
        set(alice, "currentQuestion", question); set(alice, "currentQuestionSequence", 1L); set(alice, "streak", 19);
        BattleOnlineAnswerDto request = new BattleOnlineAnswerDto(); request.setQuestionId(7L); request.setQuestionSequence(1L); request.setAnswerKey("A");
        BattleOnlineAnswerResultDto result = service.answer("DEMON1", "alice", request);
        assertTrue(result.isCorrect()); assertEquals(20, result.getStreak());
        assertEquals(2D, result.getScore(), 0D);
        assertTrue(result.getMessage().contains("Bắn 2 viên"));
        try { service.answer("DEMON1", "alice", request); fail("Old question cannot shoot twice"); }
        catch (BattleOnlineException expected) { assertEquals(2D, (Double) get(alice, "score"), 0D); }
    }

    @Test public void wrongAnswerResetsStreakWithoutKillingAnyDemon() throws Exception {
        Object question = state("QuestionState");
        set(question, "id", 7L); set(question, "question", "hello"); set(question, "correctText", "xin chào"); set(question, "correctKey", "A");
        set(alice, "currentQuestion", question); set(alice, "currentQuestionSequence", 1L); set(alice, "streak", 35);
        BattleOnlineAnswerDto request = new BattleOnlineAnswerDto(); request.setQuestionId(7L); request.setQuestionSequence(1L); request.setAnswerKey("B");
        BattleOnlineAnswerResultDto result = service.answer("DEMON1", "alice", request);
        assertFalse(result.isCorrect()); assertEquals(0, result.getStreak()); assertEquals(0D, result.getScore(), 0D);
        assertTrue(result.getRoom().getDemonDefense().teams.get(0).shots.isEmpty());
        assertTrue(result.getRoom().getDemonDefense().teams.get(0).demons.isEmpty());
    }

    @Test public void correctAnswersFromTwoTeammatesShareDamageAndOnlyFinishingHitScores() throws Exception {
        long now = System.currentTimeMillis();
        Map<Integer, Integer> members = new LinkedHashMap<Integer, Integer>();
        members.put(1, 3); members.put(2, 3);
        DemonDefenseGame game = new DemonDefenseGame(now - 24000L, members);
        assertEquals(10, game.shoot(1, "warmup", 100, now).kills);
        set(room, "demonDefense", game);
        Object question = state("QuestionState");
        set(question, "id", 7L); set(question, "question", "hello");
        set(question, "correctText", "xin chào"); set(question, "correctKey", "A");
        set(alice, "currentQuestion", question); set(alice, "currentQuestionSequence", 1L);
        set(bob, "currentQuestion", question); set(bob, "currentQuestionSequence", 1L);
        BattleOnlineAnswerDto request = new BattleOnlineAnswerDto();
        request.setQuestionId(7L); request.setQuestionSequence(1L); request.setAnswerKey("A");
        BattleOnlineAnswerResultDto first = service.answer("DEMON1", "alice", request);
        assertTrue(first.isCorrect()); assertEquals(1, first.getStreak()); assertEquals(0D, first.getScore(), 0D);
        assertTrue(first.getMessage().contains("trúng 1 phát, diệt 0 quỷ"));
        BattleOnlineRoomDto host = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "host");
        assertEquals(1, host.getDemonDefense().teams.get(0).demons.get(0).health);
        BattleOnlineAnswerResultDto second = service.answer("DEMON1", "bob", request);
        assertTrue(second.isCorrect()); assertEquals(1D, second.getScore(), 0D);
        assertTrue(second.getMessage().contains("trúng 1 phát, diệt 1 quỷ"));
        assertEquals(11, second.getRoom().getDemonDefense().teams.get(0).kills);
        assertEquals(0D, (Double) get(alice, "score"), 0D);
    }

    @Test public void hostRestSnapshotHasArenaAndStudentSnapshotDoesNotExposeAnimationOrHostQuestion() {
        BattleOnlineRoomDto host = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "host");
        BattleOnlineRoomDto student = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "alice");
        // Populate the arena before inspecting the two payloads.
        ((DemonDefenseGame) get(room, "demonDefense")).advance(System.currentTimeMillis());
        host = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "host");
        student = ReflectionTestUtils.invokeMethod(service, "snapshotLocked", room, "alice");
        assertFalse(host.getDemonDefense().teams.get(0).demons.isEmpty());
        assertTrue(student.getDemonDefense().teams.get(0).demons.isEmpty());
        assertNull(host.getCurrentQuestion());
    }
    @Test @SuppressWarnings("unchecked") public void disabledSkillsClearThePlanInEveryModeAndRoundTripSettings() {
        Object settings = get(room, "settings");
        assertTrue(new BattleOnlineRoomSettingsDto().isSkillsEnabled());
        for (String mode : new String[] {"CLASSIC", "COUNTDOWN", "MONEY_BEG", "ESCAPE_DUMB_DEMON", "DEMON_DEFENSE", "GUESS_WORD", "LUM_NGAY"}) {
            set(settings, "mode", mode); set(settings, "skillsEnabled", false);
            Map<Integer, String> plan = (Map<Integer, String>) get(room, "countdownSkillPlan");
            plan.put(0, "FREEZE");
            ReflectionTestUtils.invokeMethod(service, "buildCountdownSkillPlanLocked", room);
            assertTrue(plan.isEmpty());
            BattleOnlineRoomSettingsDto dto = ReflectionTestUtils.invokeMethod(service, "copySettings", settings);
            assertFalse(dto.isSkillsEnabled());
        }
    }

    @Test @SuppressWarnings("unchecked") public void disabledSkillsStillAssignQuestionsWithoutRewardsOrPasswordReset() throws Exception {
        Object settings = get(room, "settings");
        Object question = state("QuestionState");
        set(question, "id", 7L); set(question, "question", "hello");
        set(question, "correctText", "xin chào"); set(question, "correctKey", "A");
        Map<Integer, String> plan = (Map<Integer, String>) get(room, "countdownSkillPlan");
        plan.put(0, "FREEZE");
        set(settings, "skillsEnabled", false);
        set(alice, "currentQuestionSequence", 0L);
        ReflectionTestUtils.invokeMethod(service, "setCurrentCountdownQuestionLocked", room, alice, question);
        assertNotNull(get(alice, "currentQuestion"));
        assertNull(get(alice, "currentSkillType"));

        set(settings, "mode", "MONEY_BEG");
        set(room, "passwordResetAvailableAt", System.currentTimeMillis() - 1000L);
        ReflectionTestUtils.invokeMethod(service, "setCurrentCountdownQuestionLocked", room, alice, question);
        assertNull(get(alice, "currentSkillType"));
        assertEquals(false, get(alice, "passwordResetSkillIssued"));

        set(settings, "skillsEnabled", true);
        ReflectionTestUtils.invokeMethod(service, "setCurrentCountdownQuestionLocked", room, alice, question);
        assertEquals("RESET_PASSWORD", get(alice, "currentSkillType"));
    }

    @Test public void disabledSkillsRejectDirectRequestsIncludingUnfreeze() {
        set(get(room, "settings"), "skillsEnabled", false);
        set(alice, "unfreezeCharges", 1);
        BattleOnlineUseSkillDto request = new BattleOnlineUseSkillDto();
        request.setSkillType("UNFREEZE"); request.setTargetUsername("bob");
        try {
            service.useSkill("DEMON1", "alice", request);
            fail("Disabled skill must be rejected");
        } catch (BattleOnlineException expected) {
            assertEquals(1, get(alice, "unfreezeCharges"));
        }
    }

    @Test public void comprehensiveSourceStartsAndGradesInEveryOnlineMode() throws Exception {
        for (int type : new int[] {1, 11, 5, 16}) {
        for (String mode : new String[] {"CLASSIC", "COUNTDOWN", "MONEY_BEG", "ESCAPE_DUMB_DEMON", "DEMON_DEFENSE", "GUESS_WORD", "LUM_NGAY"}) {
            cleanup(); setup(); set(room, "status", "LOBBY");
            set(room, "hostUserId", 1L);
            com.globits.richy.service.QuestionService questions = mock(com.globits.richy.service.QuestionService.class);
            com.globits.richy.dto.QuestionDto test = BattleExerciseQuestionsTest.test(type);
            if (type == 5) { test.getSubQuestions().get(0).getSubQuestions().get(0).getSubQuestions().get(0).getQuestionAnswers().get(2).setCorrect(true); }
            when(questions.getObjectById(100L)).thenReturn(test);
            ReflectionTestUtils.setField(service, "questionService", questions);
            BattleOnlineRoomSettingsDto settings = new BattleOnlineRoomSettingsDto();
            settings.setMode(mode); settings.setQuestionSource("COMPREHENSIVE"); settings.setSkillsEnabled(false);
            settings.setExerciseTestIds(java.util.Collections.singletonList(100L)); settings.setQuestionCount(1);
            settings.setTeamCount(2); settings.setSecondsPerQuestion(60);
            BattleOnlineRoomDto saved = service.updateSettings("DEMON1", "host", settings);
            assertTrue(mode, saved.isQuestionsReady());
            assertEquals("COMPREHENSIVE", saved.getSettings().getQuestionSource());
            service.startMatch("DEMON1", "host");
            BattleOnlineRoomDto playing = service.getRoom("DEMON1", "alice");
            if (playing.isPasswordSelectionRequired()) {
                com.globits.richy.dto.BattleOnlinePasswordOptionDto option = playing.getPasswordOptions().get(0);
                com.globits.richy.dto.BattleOnlinePasswordChoiceDto choice = new com.globits.richy.dto.BattleOnlinePasswordChoiceDto();
                choice.setOptionKey(option.getKey());
                playing = service.choosePassword("DEMON1", "alice", choice);
            }
            assertNotNull(mode, playing.getCurrentQuestion());
            assertNotNull(mode, playing.getCurrentQuestion().getExercise());
            assertEquals(0, playing.getCurrentQuestion().getAnswers().size());
            assertNull(playing.getCurrentQuestion().getMaskedWord());
            BattleOnlineAnswerDto request = new BattleOnlineAnswerDto();
            request.setQuestionId(playing.getCurrentQuestion().getId()); request.setQuestionSequence(playing.getCurrentQuestion().getSequence());
            List<String> answers = type == 11 ? java.util.Collections.singletonList("secret answer") :
                    type == 16 ? java.util.Collections.singletonList(String.join(" ", java.util.Collections.nCopies(151, "word"))) :
                    type == 5 ? java.util.Arrays.asList("3", "1") : java.util.Collections.singletonList("1");
            request.setExerciseAnswers(java.util.Collections.singletonMap("103", answers));
            assertTrue(mode, service.answer("DEMON1", "alice", request).isCorrect());
        }
        }
    }

    @Test public void creatingAnExerciseRoomNeedsNoVocabularyAndLoadsTheTestOnlyOnce() {
        ((Map<?, ?>) get(service, "rooms")).clear();
        javax.persistence.EntityManager entity = mock(javax.persistence.EntityManager.class);
        javax.persistence.Query account = mock(javax.persistence.Query.class), roles = mock(javax.persistence.Query.class);
        set(service, "entityManager", entity);
        when(entity.createQuery(startsWith("select u.id"))).thenReturn(account);
        when(entity.createQuery(startsWith("select r.id"))).thenReturn(roles);
        when(account.getResultList()).thenReturn(java.util.Collections.singletonList(new Object[] {1L, "", "", "Host", 0L, "MAM_HOC"}));
        when(roles.getResultList()).thenReturn(java.util.Collections.emptyList());
        com.globits.richy.service.QuestionService questions = mock(com.globits.richy.service.QuestionService.class);
        when(questions.getObjectById(100L)).thenReturn(BattleExerciseQuestionsTest.test(11)); set(service, "questionService", questions);
        com.globits.richy.dto.BattleOnlineCreateRoomDto request = new com.globits.richy.dto.BattleOnlineCreateRoomDto();
        request.setTopicIds(null); request.setQuestionSource("COMPREHENSIVE"); request.setExerciseTestIds(java.util.Collections.singletonList(100L));
        BattleOnlineRoomDto created = service.createRoom("host", request);
        assertTrue(created.isQuestionsReady()); assertEquals(1, created.getAvailableQuestionCount());
        assertEquals("Đề tổng hợp", created.getSettings().getTopicNames().get(0));
        assertTrue(created.getSettings().getTopicIds().isEmpty());
        verify(questions, times(1)).getObjectById(100L);
    }

    @Test public void someoneElsesUnpublishedExerciseCannotReplaceTheCurrentRoomSource() {
        set(room, "status", "LOBBY"); set(room, "hostUserId", 1L);
        com.globits.richy.service.QuestionService questions = mock(com.globits.richy.service.QuestionService.class);
        com.globits.richy.dto.QuestionDto test = BattleExerciseQuestionsTest.test(1); test.setStatus(6);
        when(questions.getObjectById(100L)).thenReturn(test); set(service, "questionService", questions);
        BattleOnlineRoomSettingsDto settings = new BattleOnlineRoomSettingsDto();
        settings.setQuestionSource("COMPREHENSIVE"); settings.setExerciseTestIds(java.util.Collections.singletonList(100L));
        try { service.updateSettings("DEMON1", "host", settings); fail("Draft must stay private"); }
        catch (BattleOnlineException expected) { assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, expected.getStatus()); }
        assertEquals("VOCABULARY", get(get(room, "settings"), "questionSource"));
    }

    @Test public void individualSkillChoicesRoundTripInEveryModeAndOldClientsAllowAll() {
        set(room, "status", "LOBBY");
        assertTrue(new BattleOnlineRoomSettingsDto().getDisabledSkillTypes().isEmpty());
        for (String mode : new String[] {"CLASSIC","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","GUESS_WORD","LUM_NGAY"}) {
            BattleOnlineRoomSettingsDto requested = new BattleOnlineRoomSettingsDto(); requested.setMode(mode);
            requested.setDisabledSkillTypes(java.util.Arrays.asList(" freeze ", "UNFREEZE", "FREEZE", "invalid", null));
            BattleOnlineRoomDto saved = service.updateSettings("DEMON1", "host", requested);
            assertTrue(saved.getSettings().isSkillsEnabled());
            assertEquals(java.util.Arrays.asList("FREEZE","UNFREEZE"), saved.getSettings().getDisabledSkillTypes());
            saved.getSettings().getDisabledSkillTypes().clear();
            assertEquals(2, ((List<?>) get(get(room,"settings"),"disabledSkillTypes")).size());
            requested.setDisabledSkillTypes(null);
            assertTrue(service.updateSettings("DEMON1", "host", requested).getSettings().getDisabledSkillTypes().isEmpty());
        }
    }

    @Test @SuppressWarnings("unchecked") public void plansNeverIncludeAnExcludedSkillAndAllCanBeExcluded() {
        Object settings = get(room,"settings"); set(room,"totalLessonWords",160);
        List<String> types = java.util.Arrays.asList("FREEZE","INVERT","BREAK_STREAK","UNFREEZE","STEAL_SCORE","FIRE_UP","MONEY_BEG","RESET_PASSWORD");
        Map<Integer,String> plan = (Map<Integer,String>) get(room,"countdownSkillPlan");
        for (String mode : new String[] {"COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","LUM_NGAY"}) {
            set(settings,"mode",mode);
            for (String type : types) {
                set(settings,"disabledSkillTypes",java.util.Collections.singletonList(type));
                ReflectionTestUtils.invokeMethod(service,"buildCountdownSkillPlanLocked",room);
                assertFalse(mode + ": " + type, plan.containsValue(type));
                assertFalse(mode, plan.isEmpty());
            }
            set(settings,"disabledSkillTypes",types);
            ReflectionTestUtils.invokeMethod(service,"buildCountdownSkillPlanLocked",room); assertTrue(mode,plan.isEmpty());
        }
    }

    @Test @SuppressWarnings("unchecked") public void excludedPasswordResetFallsBackToAnAllowedRegularSkill() throws Exception {
        Object settings = get(room,"settings"), question = state("QuestionState"); set(question,"id",7L);
        set(settings,"mode","MONEY_BEG"); set(settings,"disabledSkillTypes",java.util.Collections.singletonList("RESET_PASSWORD"));
        set(room,"passwordResetAvailableAt",System.currentTimeMillis()-1000L);
        ((Map<Integer,String>) get(room,"countdownSkillPlan")).put(0,"FREEZE");
        ReflectionTestUtils.invokeMethod(service,"setCurrentCountdownQuestionLocked",room,alice,question);
        assertEquals("FREEZE",get(alice,"currentSkillType")); assertEquals(false,get(alice,"passwordResetSkillIssued"));
        set(alice,"currentQuestionSequence",0L); set(settings,"disabledSkillTypes",java.util.Arrays.asList("RESET_PASSWORD","FREEZE"));
        ReflectionTestUtils.invokeMethod(service,"setCurrentCountdownQuestionLocked",room,alice,question);
        assertNull(get(alice,"currentSkillType")); assertNotNull(get(alice,"currentQuestion"));
        set(settings,"disabledSkillTypes",java.util.Collections.emptyList());
        ReflectionTestUtils.invokeMethod(service,"setCurrentCountdownQuestionLocked",room,alice,question);
        assertEquals("RESET_PASSWORD",get(alice,"currentSkillType"));
    }

    @Test public void excludedSkillsRejectDirectRequestsIncludingStoredRescueCharges() {
        Object settings = get(room,"settings"); set(alice,"unfreezeCharges",1);
        for (String type : new String[] {"FREEZE","INVERT","BREAK_STREAK","UNFREEZE","STEAL_SCORE","FIRE_UP","MONEY_BEG","RESET_PASSWORD"}) {
            set(settings,"disabledSkillTypes",java.util.Collections.singletonList(type)); set(alice,"pendingSkillType",type);
            BattleOnlineUseSkillDto request = new BattleOnlineUseSkillDto(); request.setSkillType(type); request.setTargetUsername("bob");
            try { service.useSkill("DEMON1","alice",request); fail(type + " must be rejected"); }
            catch (BattleOnlineException expected) { assertEquals(type,get(alice,"pendingSkillType")); assertEquals(1,get(alice,"unfreezeCharges")); }
        }
        set(settings,"mode","MONEY_BEG"); set(settings,"disabledSkillTypes",java.util.Collections.singletonList("MONEY_BEG"));
        try { service.guessPassword("DEMON1","alice",new com.globits.richy.dto.BattleOnlinePasswordGuessDto()); fail("Money skill must be rejected"); }
        catch (BattleOnlineException expected) { assertTrue(expected.getMessage().contains("Host đã tắt")); }
    }

    @Test @SuppressWarnings("unchecked") public void excludedResetRejectsSkillButInitialPasswordSelectionStillWorks() {
        set(get(room,"settings"),"mode","MONEY_BEG");
        set(get(room,"settings"),"disabledSkillTypes",java.util.Collections.singletonList("RESET_PASSWORD"));
        set(alice,"pendingSkillType","RESET_PASSWORD"); set(alice,"passwordSelectionRequired",true);
        ((Map<String,String>) get(alice,"passwordOptions")).put("A","new password");
        com.globits.richy.dto.BattleOnlinePasswordChoiceDto request = new com.globits.richy.dto.BattleOnlinePasswordChoiceDto(); request.setOptionKey("A");
        try { service.choosePassword("DEMON1","alice",request); fail("Reset skill must be rejected"); }
        catch (BattleOnlineException expected) { assertEquals(true,get(alice,"passwordSelectionRequired")); }
        set(alice,"pendingSkillType",null);
        service.choosePassword("DEMON1","alice",request);
        assertEquals("new password",get(alice,"currentPassword")); assertEquals(false,get(alice,"passwordSelectionRequired"));
    }

    @Test public void correctAnswerCannotActivateAnExcludedFireSkillFromAStaleQuestion() throws Exception {
        Object question = state("QuestionState"); set(question,"id",7L); set(question,"correctKey","A");
        set(alice,"currentQuestion",question); set(alice,"currentQuestionSequence",1L); set(alice,"currentSkillType","FIRE_UP");
        set(get(room,"settings"),"disabledSkillTypes",java.util.Collections.singletonList("FIRE_UP"));
        BattleOnlineAnswerDto request = new BattleOnlineAnswerDto(); request.setQuestionId(7L); request.setQuestionSequence(1L); request.setAnswerKey("A");
        assertTrue(service.answer("DEMON1","alice",request).isCorrect()); assertEquals(0L,get(alice,"burningUntil"));
    }

}
