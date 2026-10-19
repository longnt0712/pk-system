package com.globits.richy.battle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.*;
import com.globits.richy.question.ComprehensiveListeningScore;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import org.junit.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleListeningServiceTest {
    private static final String TEXT = "We hear 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19.";

    private Object state(String type) throws Exception {
        Constructor<?> constructor = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + type).getDeclaredConstructor();
        constructor.setAccessible(true); return constructor.newInstance();
    }
    private void set(Object object, String key, Object value) { ReflectionTestUtils.setField(object, key, value); }
    private Object get(Object object, String key) { return ReflectionTestUtils.getField(object, key); }

    @SuppressWarnings("unchecked")
    private BattleOnlineServiceImpl setup(String mode, QuestionDto source) throws Exception {
        BattleOnlineServiceImpl service = new BattleOnlineServiceImpl();
        set(service, "messagingTemplate", mock(SimpMessagingTemplate.class));
        Object room = state("RoomState");
        set(room, "code", "LISTEN1"); set(room, "status", "LOBBY"); set(room, "hostUsername", "host");
        Object settings = get(room, "settings");
        set(settings, "mode", mode); set(settings, "skillsEnabled", false); set(settings, "questionCount", 1); set(settings, "teamCount", 2);
        Map<String, Object> players = (Map<String, Object>) get(room, "players");
        for (String username : new String[] {"host", "alice", "bob"}) {
            Object player = state("PlayerState"); set(player, "username", username); set(player, "displayName", username);
            set(player, "connected", true); set(player, "ready", true); set(player, "teamNumber", "bob".equals(username) ? 2 : 1);
            if ("host".equals(username)) { set(player, "host", true); set(player, "spectator", true); }
            players.put(username, player);
        }
        ReflectionTestUtils.invokeMethod(service, "setExerciseSourceLocked", room, Collections.singletonList(100L), BattleExerciseQuestions.fromTest(source));
        ((Map<String, Object>) get(service, "rooms")).put("LISTEN1", room);
        service.startMatch("LISTEN1", "host");
        for (String username : new String[] {"alice", "bob"}) { set(players.get(username), "passwordSelectionRequired", false); }
        return service;
    }

    private QuestionDto listening() {
        QuestionDto source = BattleExerciseQuestionsTest.test(18), group = source.getSubQuestions().get(0).getSubQuestions().get(0);
        group.setPronounce("https://media.example.com/audio.mp3"); group.setMotherTongue(TEXT);
        group.getSubQuestions().get(0).getQuestionAnswers().get(0).getAnswer().setAnswer(ComprehensiveListeningScore.RESPONSE);
        return source;
    }

    private BattleOnlineAnswerDto response(BattleOnlineRoomDto snapshot, int correct) {
        BattleOnlineQuestionDto question = snapshot.getCurrentQuestion();
        BattleOnlineAnswerDto dto = new BattleOnlineAnswerDto(); dto.setQuestionId(question.getId()); dto.setQuestionSequence(question.getSequence());
        dto.setAnswerKey("EXERCISE");
        List<String> tokens = ComprehensiveListeningScore.tokenize(TEXT);
        Map<String, List<String>> values = new LinkedHashMap<String, List<String>>();
        for (int i = 0; i < question.getExercise().items.size(); i++) {
            BattleOnlineExerciseDto.Item item = question.getExercise().items.get(i);
            values.put(item.id, Collections.singletonList(i < correct ? tokens.get(item.gapIndex).replace(".", "") : ""));
        }
        dto.setExerciseAnswers(values); return dto;
    }

    @Test public void everyBattleModePublishesOnlyEmptyGapsAndGradesTheServerSelectedWords() throws Exception {
        for (String mode : new String[] {"CLASSIC", "COUNTDOWN", "MONEY_BEG", "ESCAPE_DUMB_DEMON", "DEMON_DEFENSE", "GUESS_WORD", "LUM_NGAY"}) {
            BattleOnlineServiceImpl service = setup(mode, listening());
            try {
                BattleOnlineRoomDto snapshot = service.getRoom("LISTEN1", "alice");
                assertNotNull(mode, snapshot.getCurrentQuestion());
                assertEquals("LISTENING", snapshot.getCurrentQuestion().getExercise().answerMode);
                String publicJson = new ObjectMapper().writeValueAsString(snapshot.getCurrentQuestion());
                assertFalse(mode, publicJson.contains("hear")); assertFalse(mode, publicJson.contains(ComprehensiveListeningScore.RESPONSE));
                assertFalse(mode, service.answer("LISTEN1", "alice", response(snapshot, 17)).isCorrect());
                assertTrue(mode, service.answer("LISTEN1", "bob", response(service.getRoom("LISTEN1", "bob"), 18)).isCorrect());
            } finally { service.destroy(); }
        }
    }

    @Test public void classicListeningReviewUsesTheExistingSubmissionAndCorrectSummaryPaths() throws Exception {
        BattleOnlineServiceImpl service = setup("CLASSIC", listening());
        try {
            service.setClassicAutoAdvance("LISTEN1", "host", false);
            BattleOnlineRoomDto snapshot = service.getRoom("LISTEN1", "alice");
            service.answer("LISTEN1", "alice", response(snapshot, 20));
            Object room = ((Map<?, ?>) get(service, "rooms")).get("LISTEN1");
            set(room, "questionEndsAt", System.currentTimeMillis() - 1);
            ReflectionTestUtils.invokeMethod(service, "advanceClassicQuestion", "LISTEN1", 0);
            BattleOnlineRoomDto review = service.getRoom("LISTEN1", "host");
            assertTrue(review.isClassicAnswerRevealed()); assertTrue(review.getClassicCorrectAnswer().contains("hear"));
            assertTrue(review.getClassicStudentAnswers().stream().anyMatch(row -> row.isCorrect() && row.getAnswer().contains("hear")));
        } finally { service.destroy(); }
    }
}
