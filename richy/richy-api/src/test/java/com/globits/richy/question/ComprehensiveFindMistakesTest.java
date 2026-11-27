package com.globits.richy.question;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.dto.QuestionDto;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.Assert.*;

public class ComprehensiveFindMistakesTest {
    @Test
    public void alignsOutOfOrderSelectionsAndKeepsBothCorrectAndIncorrectResponsesForReview() {
        Question pack = new Question();
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("[[Yesterday]], she [[go]] to school and [[buy]] [[two loafs of bread]]. She [[run into]] Ana.");
        QuestionAnswerTestResult first = row(pack, 1, "2|went", "5|ran into");
        QuestionAnswerTestResult second = row(pack, 2, "3|bought", "4|two   loaves of bread");
        QuestionAnswerTestResult third = row(pack, 3, "4|two loaves of bread", "1|Tomorrow");
        QuestionAnswerTestResult fourth = row(pack, 4, "5|ran into", "2|goes");

        ComprehensiveFindMistakes.alignResponses(Arrays.asList(fourth, second, first, third));

        QuestionAnswerTestResultDto firstResult = new QuestionAnswerTestResultDto(first);
        assertFalse(firstResult.getIsCorrectTestResultDetail());
        assertEquals("go → goes", firstResult.getFindMistakeSubmitted());
        assertEquals("go → went", firstResult.getFindMistakeExpected());
        assertFalse(new QuestionAnswerTestResultDto(second).getIsCorrectTestResultDetail());
        assertEquals("Yesterday → Tomorrow", new QuestionAnswerTestResultDto(second).getFindMistakeSubmitted());
        assertTrue(new QuestionAnswerTestResultDto(third).getIsCorrectTestResultDetail());
        assertTrue(new QuestionAnswerTestResultDto(fourth).getIsCorrectTestResultDetail());
    }

    @Test
    public void gradesRepeatedTextByPositionAndHidesTheAnswerKeyFromStudentQuestionDto() {
        Question pack = new Question();
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("They [[read]] today. She [[read]] every day.");
        QuestionAnswerTestResult result = row(pack, 1, "2|reads", "1|reads");
        ComprehensiveFindMistakes.alignResponses(Collections.singletonList(result));
        assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        assertNull(new QuestionDto(result.getQuestionAnswer().getQuestion()).getQuestionAnswers().get(0).getAnswer());

        result.setClientAnswer("2|reads");
        assertTrue(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        result.setClientAnswer("2|Reads");
        assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
    }

    private QuestionAnswerTestResult row(Question pack, int ordinal, String expected, String submitted) {
        Question question = new Question();
        question.setParent(pack);
        question.setOrdinalNumber(ordinal);

        Answer answer = new Answer();
        answer.setAnswer(expected);
        QuestionAnswer slot = new QuestionAnswer();
        slot.setId(Long.valueOf(ordinal));
        slot.setQuestion(question);
        slot.setAnswer(answer);
        slot.setOrdinalNumber(1);
        slot.setCorrect(true);
        question.setQuestionAnswers(Collections.singleton(slot));

        QuestionAnswerTestResult result = new QuestionAnswerTestResult();
        result.setQuestionAnswer(slot);
        result.setOrdinalNumber(ordinal);
        result.setClientAnswer(submitted);
        return result;
    }
}
