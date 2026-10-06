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
                assertTrue(turn.grade(response("1"))); assertFalse(turn.grade(response("2")));
                assertFalse(turn.grade(response("1", "1")));
            }
        }
    }
    @Test public void multipleAnswerGroupsRequireTheExactOriginalSetInAnyOrder() {
        QuestionDto root = test(5);
        QuestionDto group = root.getSubQuestions().get(0).getSubQuestions().get(0);
        group.getSubQuestions().get(0).getQuestionAnswers().get(2).setCorrect(true);
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(root).get(0);
        assertTrue(turn.grade(response("3", "1"))); assertFalse(turn.grade(response("1")));
        assertFalse(turn.grade(response("1", "2", "3")));
    }
    @Test public void anIncompleteGroupCannotBeGradedAsCorrect() {
        BattleExerciseQuestions.Turn turn = BattleExerciseQuestions.fromTest(test(11)).get(0);
        assertFalse(turn.grade(null)); assertFalse(turn.grade(Collections.<String, List<String>>emptyMap()));
        assertFalse(turn.grade(response("")));
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
