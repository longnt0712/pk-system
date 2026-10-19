package com.globits.richy.battle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.*;
import com.globits.richy.question.ComprehensiveListeningScore;
import com.globits.richy.service.BattleOnlineException;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class BattleListeningExerciseTest {
    private static final String AUDIO = "https://media.example.com/listening lesson.mp3";
    private static final String TRANSCRIPT = "We hear 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19.";

    private QuestionDto test(String transcript) {
        QuestionDto root = BattleExerciseQuestionsTest.test(18);
        QuestionDto group = root.getSubQuestions().get(0).getSubQuestions().get(0);
        group.setPronounce(AUDIO); group.setMotherTongue(transcript);
        QuestionDto child = group.getSubQuestions().get(0);
        child.setQuestion("<p>Hidden response storage</p>");
        child.getQuestionAnswers().get(0).getAnswer().setAnswer(ComprehensiveListeningScore.RESPONSE);
        return root;
    }

    private BattleExerciseQuestions.Turn turn(String transcript) {
        return BattleExerciseQuestions.fromTest(test(transcript), new Random(9)).get(0);
    }

    private Map<String, List<String>> response(BattleExerciseQuestions.Turn turn, String transcript, int correct) {
        List<String> tokens = ComprehensiveListeningScore.tokenize(transcript);
        Map<String, List<String>> result = new LinkedHashMap<String, List<String>>();
        for (int i = 0; i < turn.content.items.size(); i++) {
            BattleOnlineExerciseDto.Item gap = turn.content.items.get(i);
            String answer = tokens.get(gap.gapIndex).replaceAll("[.,]$", "");
            result.put(gap.id, Collections.singletonList(i < correct ? answer : ""));
        }
        return result;
    }

    @Test public void matchingHeadingListeningUsesTheSavedBankAndServerOptionKeys() {
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(BattleExerciseQuestionsTest.test(8)).get(0);
        assertEquals("MATCH", turn.content.answerMode);
        BattleOnlineExerciseDto.Item item = turn.content.items.get(0);
        String key = BattleExerciseQuestionsTest.optionKey(item, "secret answer");
        assertEquals(3, item.options.size());
        assertTrue(turn.grade(Collections.singletonMap(item.id, Collections.singletonList(key))));
        assertFalse(turn.grade(Collections.singletonMap(item.id, Collections.singletonList("secret answer"))));
    }

    @Test public void listeningRemainsOneTurnPerSavedChildWithServerSelectedEmptyGaps() throws Exception {
        List<BattleExerciseQuestions.Turn> turns = BattleExerciseQuestions.fromTest(test(TRANSCRIPT), new Random(9));
        assertEquals(1, turns.size());
        BattleExerciseQuestions.Turn turn = turns.get(0);
        assertEquals(Long.valueOf(103), turn.id);
        assertEquals("LISTENING", turn.content.answerMode); assertEquals(18, turn.content.type);
        assertEquals(AUDIO, turn.content.audioUrl); assertEquals(20, turn.content.items.size());
        assertNull(turn.content.contentHtml);
        String json = new ObjectMapper().writeValueAsString(turn.content);
        assertFalse(json.contains(TRANSCRIPT)); assertFalse(json.contains("Hidden response storage"));
        assertFalse(json.contains(ComprehensiveListeningScore.RESPONSE)); assertFalse(json.contains("motherTongue"));
        assertFalse(json.contains("correctTexts")); assertFalse(json.contains("\"answer\""));
        assertFalse(json.contains("hear"));
        JsonNode publicDto = new ObjectMapper().readTree(json);
        assertEquals(20, publicDto.get("items").size());
        Set<String> ids = new HashSet<String>();
        for (BattleOnlineExerciseDto.ListeningToken token : turn.content.listeningTokens) {
            if (token.gapId != null) {
                assertNull(token.text); assertTrue(ids.add(token.gapId));
                assertTrue(token.gapId.startsWith("103:"));
            }
        }
        assertEquals(20, ids.size());
        assertEquals(".", turn.content.listeningTokens.get(turn.content.listeningTokens.size() - 1).after);
        assertTrue(turn.correctSummary().contains("hear"));
    }

    @Test public void eightyFivePercentFailsAndExactlyNinetyPercentPasses() {
        BattleExerciseQuestions.Turn turn = turn(TRANSCRIPT);
        assertFalse(turn.grade(response(turn, TRANSCRIPT, 17)));
        assertTrue(turn.grade(response(turn, TRANSCRIPT, 18)));
        assertTrue(turn.grade(response(turn, TRANSCRIPT, 20)));
    }

    @Test public void legacyListeningKeepsItsSharedEditorBlanksAndTextGrading() throws Exception {
        QuestionDto root = BattleExerciseQuestionsTest.testWithQuestions(18, 2);
        QuestionDto group = root.getSubQuestions().get(0).getSubQuestions().get(0);
        group.setPronounce(AUDIO);
        group.getSubQuestions().get(0).setQuestion("<p>First }{SPACE}{ and second }{SPACE}{.</p>");
        List<BattleExerciseQuestions.Turn> turns = BattleExerciseQuestions.fromTest(root);
        assertEquals(2, turns.size());
        BattleExerciseQuestions.Turn second = turns.get(1);
        assertEquals("TEXT", second.content.answerMode); assertEquals(AUDIO, second.content.audioUrl);
        assertEquals("<p>First }{SPACE}{ and second }{SPACE}{.</p>", second.content.contentHtml);
        assertEquals(Integer.valueOf(1), second.content.items.get(0).gapIndex);
        assertTrue(second.content.listeningTokens.isEmpty());
        assertTrue(second.grade(Collections.singletonMap("104", Collections.singletonList(" SECRET answer "))));
        assertFalse(second.grade(Collections.singletonMap("103", Collections.singletonList("secret answer"))));
        assertFalse(new ObjectMapper().writeValueAsString(second.content).contains("secret answer"));
    }

    @Test public void listeningUsesTheSameAccentPunctuationAndCaseNormalizationAsTestMode() {
        String transcript = "We café";
        BattleExerciseQuestions.Turn turn = turn(transcript);
        assertEquals(1, turn.content.items.size());
        String id = turn.content.items.get(0).id;
        assertTrue(turn.grade(Collections.singletonMap(id, Collections.singletonList("  CAFE!  "))));
        assertFalse(turn.grade(Collections.singletonMap(id, Collections.singletonList(""))));
        assertFalse(turn.grade(Collections.singletonMap(id, Collections.singletonList(null))));
    }

    @Test public void legacyTextModesAcceptSlashSeparatedAlternativesAsInReadingAndListening() {
        for (int type : new int[] {2, 3, 11, 18}) {
            QuestionDto root = BattleExerciseQuestionsTest.test(type);
            QuestionDto group = root.getSubQuestions().get(0).getSubQuestions().get(0);
            if (type == 18) { group.setPronounce(AUDIO); }
            group.getSubQuestions().get(0).getQuestionAnswers().get(0).getAnswer().setAnswer("<b>learn</b> / study");
            BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(root).get(0);
            assertTrue(turn.grade(Collections.singletonMap("103", Collections.singletonList(" LEARN "))));
            assertTrue(turn.grade(Collections.singletonMap("103", Collections.singletonList("Study"))));
            assertFalse(turn.grade(Collections.singletonMap("103", Collections.singletonList("learn / study"))));
        }
    }

    @Test public void missingExtraForgedOrMultipleValuesCannotReduceTheDenominator() {
        BattleExerciseQuestions.Turn turn = turn(TRANSCRIPT);
        Map<String, List<String>> valid = response(turn, TRANSCRIPT, 20);
        String id = turn.content.items.get(0).id;
        Map<String, List<String>> missing = new LinkedHashMap<String, List<String>>(valid); missing.remove(id);
        assertFalse(turn.grade(missing));
        Map<String, List<String>> forged = new LinkedHashMap<String, List<String>>(valid);
        forged.put("104:2", forged.remove(id)); assertFalse(turn.grade(forged));
        Map<String, List<String>> extra = new LinkedHashMap<String, List<String>>(valid);
        extra.put("forged", Collections.singletonList("correct")); assertFalse(turn.grade(extra));
        valid.put(id, Arrays.asList("hear", "hear")); assertFalse(turn.grade(valid));
        valid.put(id, null); assertFalse(turn.grade(valid));
    }

    @Test public void gapsIncludeAllRequiredWordsAndThirtyFivePercentOfOrdinaryWords() {
        String transcript = "We apple banana cherry dates evening fresh green house inside jump 1 monday A.";
        Map<Integer, String> gaps = ComprehensiveListeningScore.selectGaps(transcript, new Random(9));
        assertEquals(7, gaps.size());
        assertTrue(gaps.containsValue("1")); assertTrue(gaps.containsValue("monday")); assertTrue(gaps.containsValue("A"));
        assertEquals(gaps, ComprehensiveListeningScore.selectGaps(transcript, new Random(9)));
        assertNotEquals(gaps, ComprehensiveListeningScore.selectGaps(transcript, new Random(10)));
    }

    @Test public void audioUrlsRejectJavascriptCredentialsAndUnsupportedProviders() {
        for (String url : new String[] {"javascript:alert(1)", "https://name:pass@example.com/clip.mp3", "https://tiktok.com/video/1", "", "file:///clip.mp3"}) {
            QuestionDto root = test(TRANSCRIPT);
            root.getSubQuestions().get(0).getSubQuestions().get(0).setPronounce(url);
            try { BattleExerciseQuestions.fromTest(root); fail(url); }
            catch (BattleOnlineException expected) { assertTrue(expected.getMessage().contains("audio")); }
        }
        QuestionDto youtube = test(TRANSCRIPT);
        youtube.getSubQuestions().get(0).getSubQuestions().get(0).setPronounce("https://youtu.be/dQw4w9WgXcQ?t=24");
        assertEquals("https://youtu.be/dQw4w9WgXcQ?t=24", BattleExerciseQuestions.fromTest(youtube).get(0).content.audioUrl);
    }
}
