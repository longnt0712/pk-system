package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import java.util.*;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class ListeningTwoColumnResultGradingTest {
    private Question source;
    private Question question;
    private QuestionAnswer wrong;
    private QuestionAnswer correct;

    private QuestionAnswer option(long id, String text, boolean isCorrect) {
        Answer answer = new Answer(); answer.setId(id); answer.setAnswer(text);
        QuestionAnswer option = new QuestionAnswer(); option.setId(id); option.setQuestion(question);
        option.setAnswer(answer); option.setCorrect(isCorrect); return option;
    }
    private void fixture(int packageType) {
        source = new Question(); source.setId(700L); source.setTestFormat("LISTENING"); source.setStatus(7);
        Question part = new Question(); part.setId(71L); part.setParent(source); part.setOrdinalNumber(1);
        Question pack = new Question(); pack.setId(70L); pack.setType(packageType); pack.setParent(part);
        question = new Question(); question.setId(12L); question.setOrdinalNumber(12); question.setParent(pack);
        source.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(part)));
        part.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(pack)));
        pack.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(question)));
        wrong = option(1200L, "Ending A", false); correct = option(1201L, "Ending B", true);
        question.setQuestionAnswers(new LinkedHashSet<QuestionAnswer>(Arrays.asList(wrong, correct)));
    }
    private QuestionAnswerTestResult row(QuestionAnswer selected, String submitted) {
        QuestionAnswerTestResult row = new QuestionAnswerTestResult(); row.setQuestionAnswer(selected);
        row.setOrdinalNumber(12); row.setClientAnswer(submitted); return row;
    }
    @After public void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test public void wrongType15EndingCannotBecomeCorrectByMatchingItsOwnSelectedText() {
        fixture(15);
        // dropSentenceEnding selects the target question's option ID and submits that option's text.
        assertEquals("Ending A", wrong.getAnswer().getAnswer()); assertFalse(wrong.isCorrect());
        assertFalse(new QuestionAnswerTestResultDto(row(wrong, "Ending A")).getIsCorrectTestResultDetail());
    }
    @Test public void correctType15EndingIsAcceptedAndBlankIsNot() {
        fixture(15);
        assertTrue(new QuestionAnswerTestResultDto(row(correct, "Ending B")).getIsCorrectTestResultDetail());
        for (String blank : Arrays.asList(null, "", "   ")) {
            assertFalse(new QuestionAnswerTestResultDto(row(correct, blank)).getIsCorrectTestResultDetail());
        }
    }
    @Test public void type14ControlRetainsTheSameCanonicalOptionRule() {
        fixture(14);
        assertFalse(new QuestionAnswerTestResultDto(row(wrong, "Ending A")).getIsCorrectTestResultDetail());
        assertTrue(new QuestionAnswerTestResultDto(row(correct, "Ending B")).getIsCorrectTestResultDetail());
        assertFalse(new QuestionAnswerTestResultDto(row(correct, "")).getIsCorrectTestResultDetail());
    }
    private TestResultDto saveAssigned(int packageType, boolean chooseCorrect, String submitted) {
        fixture(packageType);
        User actor = new User(); actor.setId(30L); actor.setUsername("student"); actor.setEnrollmentClassIds(Collections.singleton(2L));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, "", Collections.emptyList()));
        UserRepository users = mock(UserRepository.class); when(users.findById(30L)).thenReturn(actor);
        QuestionRepository questions = mock(QuestionRepository.class); when(questions.findOne(700L)).thenReturn(source);
        QuestionAnswerRepository answers = mock(QuestionAnswerRepository.class);
        when(answers.getOne(1200L)).thenReturn(wrong); when(answers.findOne(1200L)).thenReturn(wrong);
        when(answers.getOne(1201L)).thenReturn(correct); when(answers.findOne(1201L)).thenReturn(correct);
        EnrolmentClassScheduleTask assigned = new EnrolmentClassScheduleTask(); assigned.setId(10L);
        assigned.setSection("HOMEWORK"); assigned.setActivityType("IELTS_LISTENING"); assigned.setIeltsTest(source);
        assigned.setIeltsParts(Collections.singletonList(1)); assigned.setRequiredAttempts(1);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(10L)).thenReturn(assigned);
        TestResultRepository results = mock(TestResultRepository.class);
        when(results.save(any(TestResult.class))).thenAnswer(call -> { TestResult result = (TestResult) call.getArguments()[0]; result.setId(900L); return result; });
        TestResultServiceImpl service = new TestResultServiceImpl();
        ReflectionTestUtils.setField(service, "userRepository", users); ReflectionTestUtils.setField(service, "questionRepository", questions);
        ReflectionTestUtils.setField(service, "questionAnswerRepository", answers); ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
        ReflectionTestUtils.setField(service, "testResultRepository", results);
        TestResultDto request = new TestResultDto(); request.setTestType(2); request.setSourceQuestionId(700L);
        request.setAssignmentTaskId(10L); request.setCompletedParts(Collections.singletonList(1)); request.setUser(new UserDto(actor, false));
        QuestionAnswerDto selected = new QuestionAnswerDto(); selected.setId(chooseCorrect ? 1201L : 1200L);
        selected.setCorrect(true); // A client correctness flag must not override the stored wrong option.
        QuestionAnswerTestResultDto answer = new QuestionAnswerTestResultDto(); answer.setQuestionAnswer(selected);
        answer.setOrdinalNumber(12); answer.setClientAnswer(submitted); request.setQuestionAnswerTestResult(Collections.singletonList(answer));
        return service.saveObject(request);
    }
    @Test public void wrongAssignedType15EndingSavesFailedWithZeroCreditAndOriginalTaskContext() {
        TestResultDto result = saveAssigned(15, false, "Ending A");
        assertEquals("FAILED", result.getResultStatus()); assertEquals(0, result.getCorrectAnswer());
        assertEquals(Long.valueOf(10L), result.getAssignmentTaskId()); assertEquals(Long.valueOf(700L), result.getSourceQuestionId());
        assertEquals(Collections.singletonList(1), result.getCompletedParts());
    }
    @Test public void correctAssignedType15EndingSavesSuccessAndBlankSavesFailed() {
        TestResultDto correctResult = saveAssigned(15, true, "Ending B");
        assertEquals("SUCCESS", correctResult.getResultStatus()); assertEquals(1, correctResult.getCorrectAnswer());
        TestResultDto blank = saveAssigned(15, true, ""); assertEquals("FAILED", blank.getResultStatus()); assertEquals(0, blank.getCorrectAnswer());
    }
}
