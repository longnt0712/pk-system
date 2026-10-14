package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class ComprehensiveAssignmentShuffleTest {
    private EnrolmentClassServiceImpl service;
    private Question test;
    private EnrolmentClassScheduleTaskDto assignment;
    @Before public void setup() {
        service = new EnrolmentClassServiceImpl();
        QuestionRepository questions = mock(QuestionRepository.class);
        ReflectionTestUtils.setField(service, "questionRepository", questions);
        test = new Question(); test.setId(42L); test.setType(0); test.setStatus(7); test.setTestFormat("COMPREHENSIVE");
        QuestionType type = new QuestionType(); type.setId(11L); test.setQuestionType(type);
        when(questions.findOne(42L)).thenReturn(test);
        assignment = new EnrolmentClassScheduleTaskDto(); assignment.setSection("HOMEWORK");
        assignment.setTitle("Practice"); assignment.setStatus("TODO"); assignment.setActivityType("COMPREHENSIVE");
        assignment.setIeltsTestId(42L); assignment.setIeltsParts(Collections.singletonList(1));
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); }
    @SuppressWarnings("unchecked") private EnrolmentClassScheduleTask prepare(EnrolmentClassScheduleDay day) {
        List<EnrolmentClassScheduleTask> tasks = (List<EnrolmentClassScheduleTask>) ReflectionTestUtils.invokeMethod(
                service, "prepareScheduleTasks", 1L, day, Collections.singletonList(assignment));
        return tasks.get(0);
    }
    @Test public void newAssignmentsDefaultToShuffleAndExplicitOptOutRoundTrips() {
        assertEquals(Boolean.TRUE, prepare(null).getShuffleQuestions());
        assignment.setShuffleQuestions(false);
        EnrolmentClassScheduleTask saved = prepare(null);
        assertEquals(Boolean.FALSE, saved.getShuffleQuestions());
        assertEquals(Boolean.FALSE, new EnrolmentClassScheduleTaskDto(saved).getShuffleQuestions());
        assignment.setShuffleQuestions(true);
        assertEquals(Boolean.TRUE, new EnrolmentClassScheduleTaskDto(prepare(null)).getShuffleQuestions());
    }
    @Test public void olderClientsPreserveSavedSettingsAndLegacyAssignments() {
        EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setScheduleDate("2026-10-14");
        EnrolmentClassScheduleTask old = new EnrolmentClassScheduleTask(); old.setId(10L); old.setActivityType("COMPREHENSIVE");
        old.setShuffleQuestions(true); day.getTasks().add(old); assignment.setId(10L);
        assertEquals(Boolean.TRUE, prepare(day).getShuffleQuestions());
        old.setShuffleQuestions(false); assertEquals(Boolean.FALSE, prepare(day).getShuffleQuestions());
        old.setShuffleQuestions(null); assertNull(prepare(day).getShuffleQuestions());
    }
    private void studentAssignmentAccess(boolean belongs) {
        User student = new User(); student.setId(7L); student.setUsername("student");
        student.setEnrollmentClassIds(new HashSet<Long>(Collections.singletonList(belongs ? 2L : 99L)));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student, "", Collections.emptyList()));
        UserRepository users = mock(UserRepository.class); when(users.findByUsername("student")).thenReturn(student);
        ReflectionTestUtils.setField(service, "userRepository", users);
        EnrolmentClass parent = new EnrolmentClass(); parent.setId(1L); parent.setSchoolId(2);
        EnrolmentClass child = new EnrolmentClass(); child.setId(2L); child.setParent(parent); child.setSchoolId(2);
        EnrolmentClassRepository classes = mock(EnrolmentClassRepository.class);
        when(classes.findOne(2L)).thenReturn(child); when(classes.findOne(1L)).thenReturn(parent);
        ReflectionTestUtils.setField(service, "enrolmentClassRepository", classes);
        EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(parent);
        EnrolmentClassScheduleTask task = new EnrolmentClassScheduleTask(); task.setId(10L); task.setScheduleDay(day);
        task.setActivityType("COMPREHENSIVE"); task.setIeltsTest(test); task.setShuffleQuestions(false);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class);
        when(tasks.findOne(10L)).thenReturn(task); ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
    }
    @Test public void studentReadsServerSettingsForAncestorAssignmentWithoutDependingOnDeadline() {
        studentAssignmentAccess(true);
        StudentAssignedTaskDto settings = service.getAssignedTask(10L);
        assertEquals(Long.valueOf(42L), settings.getIeltsTestId());
        assertEquals(Boolean.FALSE, settings.getShuffleQuestions());
    }
    @Test(expected = AccessDeniedException.class) public void foreignClassCannotReadAssignmentSettings() {
        studentAssignmentAccess(false); service.getAssignedTask(10L);
    }
    @Test public void resultSavingGradesOriginalAnswerIdsAndKeepsShuffleSnapshot() {
        User student = new User(); student.setId(7L); student.setUsername("student");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student, "", Collections.emptyList()));
        TestResultServiceImpl resultsService = new TestResultServiceImpl();
        UserRepository users = mock(UserRepository.class); when(users.findById(7L)).thenReturn(student);
        ReflectionTestUtils.setField(resultsService, "userRepository", users);
        QuestionRepository questions = mock(QuestionRepository.class); when(questions.findOne(42L)).thenReturn(test);
        ReflectionTestUtils.setField(resultsService, "questionRepository", questions);
        QuestionAnswerRepository answers = mock(QuestionAnswerRepository.class);
        ReflectionTestUtils.setField(resultsService, "questionAnswerRepository", answers);
        TestResultRepository results = mock(TestResultRepository.class);
        ReflectionTestUtils.setField(resultsService, "testResultRepository", results);
        when(results.save(any(TestResult.class))).thenAnswer(call -> { TestResult value = (TestResult) call.getArguments()[0]; value.setId(1L); return value; });
        TestResultDto submission = new TestResultDto(); submission.setTestType(6); submission.setSourceQuestionId(42L);
        String snapshot = "{\"comprehensiveShuffle\":{\"enabled\":true,\"seed\":42,\"questionOrder\":[12,11]}}";
        submission.setIeltsLearningState(snapshot);
        List<QuestionAnswerTestResultDto> selected = new ArrayList<QuestionAnswerTestResultDto>();
        for (int number : new int[] {12, 11}) {
            Question pack = new Question(); pack.setType(1);
            Question question = new Question(); question.setId((long) number); question.setParent(pack); question.setOrdinalNumber(number);
            QuestionAnswer answer = new QuestionAnswer(); answer.setId(number * 100L); answer.setQuestion(question); answer.setCorrect(true);
            Answer text = new Answer(); text.setAnswer("Correct " + number); answer.setAnswer(text);
            when(answers.findOne(answer.getId())).thenReturn(answer); when(answers.getOne(answer.getId())).thenReturn(answer);
            QuestionAnswerTestResultDto row = new QuestionAnswerTestResultDto(); row.setQuestionAnswer(new QuestionAnswerDto(answer));
            row.setOrdinalNumber(number); row.setClientAnswer(text.getAnswer()); selected.add(row);
        }
        submission.setQuestionAnswerTestResult(selected);
        resultsService.saveObject(submission);
        org.mockito.ArgumentCaptor<TestResult> savedResult = org.mockito.ArgumentCaptor.forClass(TestResult.class);
        verify(results).save(savedResult.capture());
        TestResultDto result = new TestResultDto(savedResult.getValue(), true);
        assertEquals("SUCCESS", result.getResultStatus()); assertEquals(snapshot, result.getIeltsLearningState());
        assertEquals(2, result.getCorrectAnswer());
        for (QuestionAnswerTestResultDto row : result.getQuestionAnswerTestResult()) {
            assertTrue(row.getIsCorrectTestResultDetail());
            assertEquals(Long.valueOf(row.getOrdinalNumber() * 100L), row.getQuestionAnswer().getId());
        }
    }
}
