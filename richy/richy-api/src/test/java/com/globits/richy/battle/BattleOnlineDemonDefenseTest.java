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
}
