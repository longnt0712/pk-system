package com.globits.richy.question;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.service.impl.TestResultServiceImpl;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class ComprehensiveListeningScoreTest {
    private static final String TEXT = "We hear 1 2 3 4 5 6 7 8 9.";

    private String response(int correct) {
        StringBuilder json = new StringBuilder("{\"version\":1,\"source\":\"202033702\",\"gaps\":[");
        for (int i = 0; i < 10; i++) {
            if (i > 0) { json.append(','); }
            json.append("{\"index\":").append(2 + i * 2).append(",\"value\":\"");
            if (i < correct) { json.append(i == 0 ? " HEAR " : Integer.toString(i)); }
            json.append("\"}");
        }
        return json.append("]}").toString();
    }

    private QuestionAnswerTestResult result(int correct) {
        Question pack = new Question(); pack.setType(18); pack.setMotherTongue(TEXT);
        Question question = new Question(); question.setId(20L); question.setParent(pack);
        Answer marker = new Answer(); marker.setAnswer(ComprehensiveListeningScore.RESPONSE);
        QuestionAnswer answer = new QuestionAnswer(); answer.setId(200L); answer.setAnswer(marker); answer.setQuestion(question); answer.setCorrect(true);
        question.setQuestionAnswers(Collections.singleton(answer)); pack.setSubQuestions(Collections.singleton(question));
        QuestionAnswerTestResult result = new QuestionAnswerTestResult(); result.setQuestionAnswer(answer); result.setClientAnswer(response(correct));
        return result;
    }

    @Test public void backendMatchesBrowserSnapshotAndAcceptsExactlyNinetyPercent() {
        assertEquals("202033702", ComprehensiveListeningScore.fingerprint(TEXT));
        QuestionAnswerTestResultDto passed = new QuestionAnswerTestResultDto(result(9));
        assertEquals(Integer.valueOf(10), passed.getListeningTotalGaps());
        assertEquals(Integer.valueOf(9), passed.getListeningCorrectGaps());
        assertTrue(passed.getIsCorrectTestResultDetail());
        assertFalse(new QuestionAnswerTestResultDto(result(8)).getIsCorrectTestResultDetail());
    }

    @Test public void missingDuplicateOrForgedGapsCannotReduceTheDenominator() {
        for (String payload : new String[]{"", "GAPS 100%", "{}", response(10).replace("202033702", "wrong"),
                response(10).replace("\"index\":20", "\"index\":18"), response(10).replace("\"index\":20", "\"index\":0"),
                response(10).replace(",{\"index\":20,\"value\":\"9\"}", "")}) {
            assertFalse(payload, ComprehensiveListeningScore.evaluate(TEXT, payload).isPassed());
        }
    }

    @Test public void listeningSectionsMustEachPassEvenWhenOtherQuestionsAreAllCorrect() {
        TestResultServiceImpl service = new TestResultServiceImpl();
        QuestionAnswerTestResult listening = result(8);
        Set<QuestionAnswerTestResult> rows = new LinkedHashSet<QuestionAnswerTestResult>(); rows.add(listening);
        for (int i = 0; i < 20; i++) {
            Question pack = new Question(); pack.setType(1); Question question = new Question(); question.setParent(pack);
            QuestionAnswer answer = new QuestionAnswer(); answer.setQuestion(question); answer.setCorrect(true);
            QuestionAnswerTestResult row = new QuestionAnswerTestResult(); row.setQuestionAnswer(answer); row.setClientAnswer("chosen"); rows.add(row);
        }
        assertFalse((Boolean) ReflectionTestUtils.invokeMethod(service, "passedIeltsObjectiveThreshold", rows));
        listening.setClientAnswer(response(9));
        assertTrue((Boolean) ReflectionTestUtils.invokeMethod(service, "passedIeltsObjectiveThreshold", rows));
        assertTrue((Boolean) ReflectionTestUtils.invokeMethod(service, "passedIeltsObjectiveThreshold", Collections.singleton(listening)));
    }

    @Test public void omittingAListeningSectionDoesNotCompleteTheComprehensiveTest() {
        TestResultServiceImpl service = new TestResultServiceImpl(); QuestionRepository repository = mock(QuestionRepository.class);
        ReflectionTestUtils.setField(service, "questionRepository", repository);
        QuestionAnswerTestResult first = result(9), second = result(9); second.getQuestionAnswer().setId(201L);
        Question source = new Question(); source.setTestFormat("COMPREHENSIVE");
        Question part = new Question(); part.setSubQuestions(new LinkedHashSet<Question>(Arrays.asList(
                first.getQuestionAnswer().getQuestion().getParent(), second.getQuestionAnswer().getQuestion().getParent())));
        source.setSubQuestions(Collections.singleton(part)); when(repository.findOne(42L)).thenReturn(source);
        assertFalse((Boolean) ReflectionTestUtils.invokeMethod(service, "passedComprehensiveListening", 42L, Collections.singleton(first)));
        assertTrue((Boolean) ReflectionTestUtils.invokeMethod(service, "passedComprehensiveListening", 42L,
                new LinkedHashSet<QuestionAnswerTestResult>(Arrays.asList(first, second))));
        second.setClientAnswer(response(8));
        assertFalse((Boolean) ReflectionTestUtils.invokeMethod(service, "passedComprehensiveListening", 42L,
                new LinkedHashSet<QuestionAnswerTestResult>(Arrays.asList(first, second))));
    }
}
