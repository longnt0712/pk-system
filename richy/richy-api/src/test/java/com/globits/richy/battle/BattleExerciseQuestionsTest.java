package com.globits.richy.battle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class BattleExerciseQuestionsTest {
    public static QuestionDto test(int type) {
        QuestionDto root = new QuestionDto(); root.setId(100L); root.setTitle("Đề tổng hợp"); root.setTestFormat("COMPREHENSIVE"); root.setStatus(7);
        QuestionTypeDto kind = new QuestionTypeDto(); kind.setId(11L); root.setQuestionType(kind);
        QuestionDto part = new QuestionDto(); part.setId(101L); part.setQuestion("<p>Original passage</p>");
        QuestionDto group = new QuestionDto(); group.setId(102L); group.setType(type); group.setQuestion("<p>Original instructions</p>");
        QuestionDto question = new QuestionDto(); question.setId(103L); question.setOrdinalNumber(1);
        question.setQuestion(type == 11 || type == 13 ? "<p>The answer is }{SPACE}{.</p>" : "<p>Original question</p>");
        List<QuestionAnswerDto> answers = new ArrayList<QuestionAnswerDto>();
        for (int i = 1; i <= 3; i++) {
            QuestionAnswerDto answer = new QuestionAnswerDto(); AnswerDto value = new AnswerDto(); value.setAnswer(i == 1 ? "secret answer" : "wrong " + i);
            answer.setAnswer(value); answer.setCorrect(i == 1); answer.setOrdinalNumberQuestionAnswer(i); answers.add(answer);
        }
        question.setQuestionAnswers(answers); group.setSubQuestions(Collections.singletonList(question));
        part.setSubQuestions(Collections.singletonList(group)); root.setSubQuestions(Collections.singletonList(part));
        return root;
    }
    private Map<String, List<String>> response(String... values) { return Collections.singletonMap("103", Arrays.asList(values)); }

    public static String optionKey(BattleOnlineExerciseDto.Item item, String text) {
        for (BattleOnlineExerciseDto.Option option : item.options) {
            if (text.equals(option.getText())) { return option.getKey(); }
        }
        throw new AssertionError("Missing answer: " + text);
    }

    public static QuestionDto testWithQuestions(int type, int count) {
        QuestionDto root = test(type);
        List<QuestionDto> questions = new ArrayList<QuestionDto>();
        for (int i = 0; i < count; i++) {
            QuestionDto question = test(type).getSubQuestions().get(0).getSubQuestions().get(0).getSubQuestions().get(0);
            question.setId(103L + i); question.setOrdinalNumber(i + 1);
            if (type != 11 && type != 13) { question.setQuestion("<p>Question " + (i + 1) + "</p>"); }
            questions.add(question);
        }
        root.getSubQuestions().get(0).getSubQuestions().get(0).setSubQuestions(questions);
        return root;
    }

    @Test public void preservesOriginalTypesAndBanksWithoutPublishingAnswerKeys() throws Exception {
        for (int type : new int[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17}) {
            BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(test(type)).get(0);
            assertEquals(type, turn.content.type); assertEquals("<p>Original passage</p>", turn.content.passageHtml);
            String json = new ObjectMapper().writeValueAsString(turn.content);
            assertFalse(json.contains("\"correct\"")); assertFalse(json.contains("correctTexts"));
            if ("TEXT".equals(turn.content.answerMode)) {
                assertFalse(json.contains("secret answer")); assertTrue(turn.grade(response("  SECRET   ANSWER  ")));
                assertFalse(turn.grade(response("wrong")));
            } else if (!"WRITING".equals(turn.content.answerMode)) {
                assertEquals(3, turn.content.items.get(0).options.size());
                String right = optionKey(turn.content.items.get(0), "secret answer");
                assertTrue(turn.grade(response(right))); assertFalse(turn.grade(response(optionKey(turn.content.items.get(0), "wrong 2"))));
                assertFalse(turn.grade(response(right, right)));
            }
        }
    }
    @Test public void multipleAnswerQuestionsRequireTheExactOriginalSetInAnyOrder() {
        QuestionDto root = test(5);
        QuestionDto group = root.getSubQuestions().get(0).getSubQuestions().get(0);
        group.getSubQuestions().get(0).getQuestionAnswers().get(2).setCorrect(true);
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(root).get(0);
        String first = optionKey(turn.content.items.get(0), "secret answer"), third = optionKey(turn.content.items.get(0), "wrong 3");
        assertTrue(turn.grade(response(third, first))); assertFalse(turn.grade(response(first)));
        assertFalse(turn.grade(response("1", "2", "3")));
    }
    @Test public void anUnansweredQuestionCannotBeGradedAsCorrect() {
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(test(11)).get(0);
        assertFalse(turn.grade(null)); assertFalse(turn.grade(Collections.<String, List<String>>emptyMap()));
        assertFalse(turn.grade(response("")));
    }

    @Test public void aPackageWithTwoHundredChildrenBecomesTwoHundredIndependentTurns() {
        QuestionDto root = testWithQuestions(1, 200);
        Collections.reverse(root.getSubQuestions().get(0).getSubQuestions().get(0).getSubQuestions());
        List<BattleExerciseQuestions.Turn> turns = BattleExerciseQuestions.fromTest(root);
        assertEquals(200, turns.size());
        for (int i = 0; i < turns.size(); i++) {
            BattleExerciseQuestions.Turn turn = turns.get(i);
            assertEquals(Long.valueOf(103 + i), turn.id); assertEquals(Long.valueOf(100), turn.sourceTestId);
            assertEquals(1, turn.content.items.size());
            BattleOnlineExerciseDto.Item item = turn.content.items.get(0);
            assertEquals(Integer.valueOf(i + 1), item.number); assertEquals("<p>Question " + (i + 1) + "</p>", item.promptHtml);
            assertTrue(turn.grade(Collections.singletonMap(item.id, Collections.singletonList(optionKey(item, "secret answer")))));
            assertFalse(turn.grade(Collections.singletonMap(String.valueOf(104 + i), Collections.singletonList("1"))));
        }
    }

    @Test public void everySupportedTypeUsesTheChildIdAndGradesOnlyTheCurrentChild() {
        for (int type = 1; type <= 17; type++) {
            List<BattleExerciseQuestions.Turn> turns = BattleExerciseQuestions.fromTest(testWithQuestions(type, 2));
            assertEquals(2, turns.size()); assertEquals(Long.valueOf(104), turns.get(1).id);
            assertEquals(1, turns.get(1).content.items.size()); assertEquals("104", turns.get(1).content.items.get(0).id);
            assertFalse(turns.get(1).grade(response("1")));
        }
    }

    @Test public void sharedPassagesKeepTheOriginalGapPositionOfEachChild() {
        for (int type : new int[] {4, 11, 13}) {
            QuestionDto root = testWithQuestions(type, 2);
            QuestionDto part = root.getSubQuestions().get(0), group = part.getSubQuestions().get(0);
            String shared = "<p>First }{SPACE}{, second }{SPACE}{.</p>";
            part.setQuestion(shared); group.getSubQuestions().get(0).setQuestion(shared);
            List<BattleExerciseQuestions.Turn> turns = BattleExerciseQuestions.fromTest(root);
            assertEquals(Integer.valueOf(0), turns.get(0).content.items.get(0).gapIndex);
            assertEquals(Integer.valueOf(1), turns.get(1).content.items.get(0).gapIndex);
            assertEquals(shared, type == 4 ? turns.get(1).content.passageHtml : turns.get(1).content.contentHtml);
        }
    }

    @Test public void shufflingSixChoicesRemapsTheCorrectAnswerWithoutMutatingTheSavedQuestion() {
        QuestionDto root = test(1), source = root.getSubQuestions().get(0).getSubQuestions().get(0).getSubQuestions().get(0);
        for (int i = 4; i <= 6; i++) {
            QuestionAnswerDto answer = new QuestionAnswerDto(); AnswerDto text = new AnswerDto(); text.setAnswer("wrong " + i);
            answer.setAnswer(text); answer.setOrdinalNumberQuestionAnswer(i); source.getQuestionAnswers().add(answer);
        }
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(root, new Random(0)).get(0);
        BattleOnlineExerciseDto.Item item = turn.content.items.get(0);
        assertEquals(6, item.options.size());
        String correctKey = optionKey(item, "secret answer"); assertNotEquals("1", correctKey);
        for (int i = 0; i < item.options.size(); i++) {
            assertEquals(String.valueOf(i + 1), item.options.get(i).getKey());
            assertEquals(correctKey.equals(item.options.get(i).getKey()), turn.grade(response(item.options.get(i).getKey())));
        }
        assertEquals("secret answer", source.getQuestionAnswers().get(0).getAnswer().getAnswer());
        assertEquals(Integer.valueOf(1), source.getQuestionAnswers().get(0).getOrdinalNumberQuestionAnswer());
    }
    @Test public void writingKeepsTheExistingWordCountCriterion() {
        for (int type : new int[] {16, 17}) {
            BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(test(type)).get(0);
            String exact = String.join(" ", Collections.nCopies(turn.content.minimumWords, "word"));
            assertFalse(turn.grade(response(exact))); assertTrue(turn.grade(response(exact + " word")));
        }
    }
    @Test(expected = BattleOnlineException.class) public void rejectsUnsupportedFormatsInsteadOfSilentlyDroppingThem() {
        BattleExerciseQuestions.fromTest(test(999));
    }
}
