package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.richy.repository.EnrolmentClassWeeklySessionRepository;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import com.globits.richy.service.impl.HomeworkTopicCompletion;
import com.globits.richy.service.EnrolmentClassScheduleException;
import java.util.*;
import org.joda.time.LocalDateTime;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class IeltsTaskPartsTest {
    private final LocalDateTime start = new LocalDateTime(2026, 10, 6, 20, 0);
    private final LocalDateTime end = start.plusDays(7);

    private EnrolmentClassScheduleTaskDto assignment(Integer... parts) {
        EnrolmentClassScheduleTaskDto task = new EnrolmentClassScheduleTaskDto();
        task.setId(10L); task.setIeltsTestId(20L); task.setSection("HOMEWORK");
        task.setTitle("Reading practice"); task.setStatus("TODO"); task.setActivityType("IELTS_READING");
        task.setRequiredAttempts(1); task.setIeltsParts(Arrays.asList(parts));
        return task;
    }
    private Object[] submission(int part) {
        return new Object[] {30L, 20L, part, start.plusHours(1), 100L + part, 4, 10L};
    }
    private String progress(EnrolmentClassScheduleTaskDto task) {
        return task.getStudentProgress().get(0).getStatus();
    }
    @Test public void repeatingOnePartCannotCompleteOtherSelectedParts() {
        EnrolmentClassScheduleTaskDto task = assignment(1, 3);
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(submission(1), submission(1), submission(2)), start, end);
        assertEquals("PROGRESS_50", progress(task));
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(submission(1), submission(3)), start, end);
        assertEquals("DONE", progress(task));
    }
    @Test public void everySelectedPartMustMeetTheRequiredRepeatCount() {
        EnrolmentClassScheduleTaskDto task = assignment(1, 2, 3); task.setRequiredAttempts(2);
        HomeworkTopicCompletion.applyIelts(task,
            Arrays.asList(submission(1), submission(1), submission(1), submission(2), submission(3)), start, end);
        assertEquals("PROGRESS_70", progress(task));
        Map<Integer, Integer> counts = new LinkedHashMap<Integer, Integer>();
        counts.put(1, 3); counts.put(2, 1); counts.put(3, 1);
        assertEquals(6, HomeworkTopicCompletion.requiredIeltsAttempts(task));
        assertEquals(4, HomeworkTopicCompletion.completedIeltsAttempts(task, counts));
        assertEquals(Integer.valueOf(2), HomeworkTopicCompletion.nextIeltsPart(task, counts));
        counts.put(2, 2); assertEquals(Integer.valueOf(3), HomeworkTopicCompletion.nextIeltsPart(task, counts));
        counts.put(3, 2); assertNull(HomeworkTopicCompletion.nextIeltsPart(task, counts));
    }
    @Test public void evidenceMustMatchTheAssignmentTestTypeAndTimeWindow() {
        EnrolmentClassScheduleTaskDto task = assignment(3);
        Object[] wrongTask = submission(3); wrongTask[6] = 11L;
        Object[] wrongTest = submission(3); wrongTest[1] = 21L;
        Object[] wrongType = submission(3); wrongType[5] = 2;
        Object[] early = submission(3); early[3] = start.minusMinutes(1);
        Object[] late = submission(3); late[3] = end;
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(wrongTask, wrongTest, wrongType, early, late), start, end);
        assertTrue(task.getStudentProgress().isEmpty());
    }
    @Test public void expiredStudentAssignmentsAreExcludedBeforeTheResultLimit() {
        LocalDateTime deadline = start.plusDays(1);
        LocalDateTime now = deadline.plusHours(2);
        assertNull(HomeworkTopicCompletion.studentAssignmentCompletionEnd(start, deadline, now));
        assertEquals(deadline, HomeworkTopicCompletion.studentAssignmentCompletionEnd(start, deadline, start.plusHours(2)));
    }
    @Test public void studentAssignmentsWithoutADeadlineAreNotListed() {
        LocalDateTime now = start.plusDays(2);
        assertNull(HomeworkTopicCompletion.studentAssignmentCompletionEnd(start, null, now));
        assertNull(HomeworkTopicCompletion.studentAssignmentCompletionEnd(start, start, now));
    }
    @Test public void extraScheduleDateDetectionUsesTheWeeklyClassDays() {
        EnrolmentClassServiceImpl service = new EnrolmentClassServiceImpl();
        EnrolmentClassWeeklySessionRepository repository = mock(EnrolmentClassWeeklySessionRepository.class);
        EnrolmentClassWeeklySession saturday = new EnrolmentClassWeeklySession(); saturday.setDayOfWeek(6);
        when(repository.findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(1L))
            .thenReturn(Collections.singletonList(saturday));
        ReflectionTestUtils.setField(service, "weeklySessionRepository", repository);
        assertTrue((Boolean) ReflectionTestUtils.invokeMethod(service, "isWeeklyScheduleDate", 1L, "2026-10-03"));
        assertFalse((Boolean) ReflectionTestUtils.invokeMethod(service, "isWeeklyScheduleDate", 1L, "2026-10-04"));
    }
    @Test public void teacherFeedbackStillTakesPriority() {
        EnrolmentClassScheduleTaskDto task = assignment(1, 3);
        EnrolmentClassTaskProgressDto feedback = new EnrolmentClassTaskProgressDto();
        feedback.setStudentUserId(30L); feedback.setStatus("NEEDS_REVIEW"); task.getStudentProgress().add(feedback);
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(submission(1), submission(3)), start, end);
        assertEquals("NEEDS_REVIEW", progress(task)); assertFalse(feedback.isAutomatic());
    }
    @Test public void legacySinglePartTasksKeepTheirOriginalRequirement() {
        EnrolmentClassScheduleTask legacy = new EnrolmentClassScheduleTask(); legacy.setIeltsPart(2);
        assertEquals(Arrays.asList(2), legacy.getIeltsParts());
        EnrolmentClassScheduleTaskDto task = assignment(); task.setIeltsParts(null); task.setIeltsPart(2);
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(submission(2)), start, end);
        assertEquals("DONE", progress(task));
        legacy.setIeltsParts(Arrays.asList(1, 3));
        assertEquals(Arrays.asList(1, 3), new EnrolmentClassScheduleTaskDto(legacy).getIeltsParts());
    }
    private Question test(String format, int... writingTasks) {
        Question test = new Question(); test.setId(20L); test.setStatus(7); test.setTestFormat(format);
        QuestionType type = new QuestionType(); type.setId(11L); test.setQuestionType(type);
        if (writingTasks.length > 0) {
            Question part = new Question(); List<Question> packages = new ArrayList<Question>();
            for (int task : writingTasks) { Question pack = new Question(); pack.setType(task == 1 ? 16 : 17); packages.add(pack); }
            part.setSubQuestions(new LinkedHashSet<Question>(packages)); test.setSubQuestions(Collections.singleton(part));
        }
        return test;
    }
    private EnrolmentClassScheduleTask prepare(EnrolmentClassScheduleTaskDto task, Question test) {
        EnrolmentClassServiceImpl service = new EnrolmentClassServiceImpl();
        QuestionRepository repository = mock(QuestionRepository.class); when(repository.findOne(20L)).thenReturn(test);
        ReflectionTestUtils.setField(service, "questionRepository", repository);
        task.setId(null);
        List<EnrolmentClassScheduleTask> prepared = ReflectionTestUtils.invokeMethod(service,
            "prepareScheduleTasks", 1L, null, Collections.singletonList(task));
        return prepared.get(0);
    }
    @Test public void newAssignmentsDefaultToAllPartsAndSaveAnExplicitSubset() {
        EnrolmentClassScheduleTaskDto task = assignment(); task.setIeltsParts(null);
        assertEquals(Arrays.asList(1, 2, 3), prepare(task, test(null)).getIeltsParts());
        task.setIeltsParts(Arrays.asList(3, 1));
        EnrolmentClassScheduleTask saved = prepare(task, test(null));
        assertEquals(Arrays.asList(1, 3), saved.getIeltsParts()); assertEquals(Integer.valueOf(1), saved.getIeltsPart());
        task.setActivityType("IELTS_LISTENING"); task.setIeltsParts(null);
        Question listening = test(null); listening.setPronounce("track.mp3");
        assertEquals(Arrays.asList(1, 2, 3, 4), prepare(task, listening).getIeltsParts());
    }
    @Test public void writingDefaultsOnlyToTasksPresentInTheTest() {
        EnrolmentClassScheduleTaskDto task = assignment(); task.setActivityType("IELTS_WRITING"); task.setIeltsParts(null);
        assertEquals(Arrays.asList(1), prepare(task, test("WRITING", 1)).getIeltsParts());
        assertEquals(Arrays.asList(2), prepare(task, test("WRITING", 2)).getIeltsParts());
        assertEquals(Arrays.asList(1, 2), prepare(task, test("WRITING", 1, 2)).getIeltsParts());
    }
    @Test public void assignmentCatalogPopulatesWritingTasksOnScalarProjections() {
        EnrolmentClassServiceImpl service = new EnrolmentClassServiceImpl();
        QuestionRepository repository = mock(QuestionRepository.class);
        QuestionTopicRepository topics = mock(QuestionTopicRepository.class);
        ReflectionTestUtils.setField(service, "questionRepository", repository);
        ReflectionTestUtils.setField(service, "questionTopicRepository", topics);
        // The catalog query uses this scalar constructor, which does not load the task tree.
        List<QuestionForTestsDto> catalog = Arrays.asList(
            new QuestionForTestsDto(20L, "Task 1 only", null, 7, "WRITING"),
            new QuestionForTestsDto(21L, "Task 2 only", null, 7, "WRITING"),
            new QuestionForTestsDto(22L, "Both tasks", null, 7, "WRITING"),
            new QuestionForTestsDto(23L, "Reading", null, 7, null));
        when(repository.findPublishedIeltsTests()).thenReturn(catalog);
        when(repository.findPublishedWritingTaskTypes()).thenReturn(Arrays.asList(
            new Object[] {20L, 16}, new Object[] {21L, 17},
            new Object[] {22L, 16}, new Object[] {22L, 17}, new Object[] {99L, 16}));
        when(topics.findPublishedTestTopicIds()).thenReturn(Collections.singletonList(new Object[] {20L, 50L}));
        List<QuestionForTestsDto> result = service.getAssignableIeltsTests();
        assertTrue(result.get(0).isHasWritingTask1()); assertFalse(result.get(0).isHasWritingTask2());
        assertFalse(result.get(1).isHasWritingTask1()); assertTrue(result.get(1).isHasWritingTask2());
        assertTrue(result.get(2).isHasWritingTask1()); assertTrue(result.get(2).isHasWritingTask2());
        assertFalse(result.get(3).isHasWritingTask1()); assertFalse(result.get(3).isHasWritingTask2());
        assertEquals(Long.valueOf(50L), result.get(0).getTopics().get(0).getId());
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void emptySelectionIsRejected() {
        prepare(assignment(), test(null));
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void outOfRangePartIsRejected() {
        prepare(assignment(4), test(null));
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void unavailableWritingTaskIsRejected() {
        EnrolmentClassScheduleTaskDto task = assignment(1); task.setActivityType("IELTS_WRITING");
        prepare(task, test("WRITING", 2));
    }
}
