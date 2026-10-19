package com.globits.richy.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.*;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class MultiTopicVocabularyAssignmentTest {
    private final LocalDateTime start = new LocalDateTime(2026, 10, 6, 20, 0);
    private final LocalDateTime end = start.plusDays(7);
    private Topic topic(long id) { Topic value = new Topic(); value.setId(id); value.setName("Topic " + id); return value; }
    private EnrolmentClassScheduleTaskDto task() {
        EnrolmentClassScheduleTaskDto task = new EnrolmentClassScheduleTaskDto();
        task.setId(10L); task.setSection("HOMEWORK"); task.setStatus("TODO"); task.setTitle("Three topics");
        task.setActivityType("DAILY_VOCAB"); task.setTopicId(20L); task.setTopicIds(Arrays.asList(20L, 21L, 22L));
        task.setRequiredAttempts(1); return task;
    }
    private Object[] row(long topicId, long resultId) {
        return new Object[] {30L, topicId, start.plusHours(1), resultId, 1, null, 10L, topicId};
    }
    private EnrolmentClassTaskProgressDto progress(EnrolmentClassScheduleTaskDto task) { return task.getStudentProgress().get(0); }
    @After public void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test public void threeDistinctTopicsProduceExactPercentagesAndOnlyThenDone() {
        EnrolmentClassScheduleTaskDto task = task();
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101)), start, end);
        assertEquals("PROGRESS_33", progress(task).getStatus()); assertEquals(Integer.valueOf(33), progress(task).getProgressPercent());
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), row(21, 102)), start, end);
        assertEquals("PROGRESS_67", progress(task).getStatus()); assertEquals(Integer.valueOf(67), progress(task).getProgressPercent());
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), row(21, 102), row(22, 103)), start, end);
        assertEquals("DONE", progress(task).getStatus()); assertEquals(Integer.valueOf(100), progress(task).getProgressPercent());
    }
    @Test public void repeatedOneTopicAndDuplicateRowsCannotCompleteOtherTopics() {
        EnrolmentClassScheduleTaskDto task = task();
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), row(20, 101), row(20, 102), row(20, 103)), start, end);
        assertEquals("PROGRESS_33", progress(task).getStatus());
        task.setRequiredAttempts(2);
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), row(20, 101)), start, end);
        assertEquals("PROGRESS_17", progress(task).getStatus());
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), row(20, 102), row(20, 103), row(21, 104)), start, end);
        assertEquals("PROGRESS_50", progress(task).getStatus());
    }
    @Test public void evidenceMustMatchSelectedTopicTaskTypeAndExclusiveTimeWindow() {
        EnrolmentClassScheduleTaskDto task = task();
        Object[] wrongTask = row(20, 101); wrongTask[6] = 11L;
        Object[] wrongType = row(20, 102); wrongType[4] = 3;
        Object[] wrongTopic = row(20, 103); wrongTopic[7] = 21L;
        Object[] legacy = row(20, 104); legacy[7] = null;
        Object[] early = row(20, 105); early[2] = start.minusMillis(1);
        Object[] late = row(20, 106); late[2] = end;
        HomeworkTopicCompletion.apply(task, Arrays.asList(wrongTask, wrongType, wrongTopic, legacy, early, late, row(99, 107)), start, end);
        assertTrue(task.getStudentProgress().isEmpty());
        Object[] joinedDuplicate = row(21, 108); joinedDuplicate[7] = 20L;
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 108), joinedDuplicate), start, end);
        assertEquals("PROGRESS_33", progress(task).getStatus());
    }
    @Test public void studentsAreCountedSeparatelyAndTeacherFeedbackWins() {
        EnrolmentClassScheduleTaskDto task = task();
        EnrolmentClassTaskProgressDto manual = new EnrolmentClassTaskProgressDto();
        manual.setStudentUserId(30L); manual.setStatus("NEEDS_REVIEW"); task.getStudentProgress().add(manual);
        Object[] other = row(21, 102); other[0] = 31L;
        HomeworkTopicCompletion.apply(task, Arrays.<Object[]>asList(row(20, 101), other), start, end);
        assertEquals("NEEDS_REVIEW", manual.getStatus()); assertFalse(manual.isAutomatic());
        assertEquals("PROGRESS_33", task.getStudentProgress().get(1).getStatus());
    }
    @Test public void legacySingleTopicAndListeningEvidenceStillWork() {
        EnrolmentClassScheduleTaskDto task = task(); task.setTopicIds(null);
        Object[] legacy = row(20, 101); legacy[7] = null;
        HomeworkTopicCompletion.apply(task, Collections.singletonList(legacy), start, end);
        assertEquals("DONE", progress(task).getStatus());
        task.setActivityType("DAILY_LISTENING"); task.setSourceQuestionId(200L);
        Object[] listening = row(20, 102); listening[4] = 3; listening[5] = 200L; listening[7] = null;
        HomeworkTopicCompletion.apply(task, Collections.singletonList(listening), start, end);
        assertEquals("DONE", progress(task).getStatus());
        listening[5] = 201L; HomeworkTopicCompletion.apply(task, Collections.singletonList(listening), start, end);
        assertTrue(task.getStudentProgress().isEmpty());
    }
    @Test public void safeMetadataAndCapabilityRoundTripThroughJson() throws Exception {
        EnrolmentClassScheduleTask entity = new EnrolmentClassScheduleTask(); entity.setTopics(Arrays.asList(topic(22), topic(20), topic(21)));
        entity.getTopic().setContent("PRIVATE ANSWER CONTENT");
        EnrolmentClassScheduleTaskDto dto = new EnrolmentClassScheduleTaskDto(entity);
        assertEquals(Arrays.asList(22L, 20L, 21L), dto.getTopicIds()); assertEquals(Long.valueOf(22L), dto.getTopicId());
        ObjectMapper mapper = new ObjectMapper(); String json = mapper.writeValueAsString(dto);
        assertFalse(json.contains("PRIVATE ANSWER CONTENT")); assertTrue(json.contains("topicName"));
        EnrolmentClassScheduleTaskDto input = mapper.readValue(json, EnrolmentClassScheduleTaskDto.class);
        assertEquals(dto.getTopicIds(), input.getTopicIds());
        EnrolmentClassDto classDto = mapper.readValue(mapper.writeValueAsString(new EnrolmentClassDto()), EnrolmentClassDto.class);
        assertTrue(classDto.isMultiTopicVocabEnabled());
        EnrolmentClassScheduleDayDto day = mapper.readValue(mapper.writeValueAsString(new EnrolmentClassScheduleDayDto()), EnrolmentClassScheduleDayDto.class);
        assertTrue(day.isMultiTopicVocabEnabled());
    }

    @SuppressWarnings("unchecked") private EnrolmentClassScheduleTask prepare(EnrolmentClassServiceImpl service,
            EnrolmentClassScheduleTaskDto value, EnrolmentClassScheduleDay day) {
        return ((List<EnrolmentClassScheduleTask>) ReflectionTestUtils.invokeMethod(service,
                "prepareScheduleTasks", 1L, day, Collections.singletonList(value))).get(0);
    }
    private EnrolmentClassServiceImpl preparationService() {
        EnrolmentClassServiceImpl service = new EnrolmentClassServiceImpl(); TopicRepository topics = mock(TopicRepository.class);
        for (long id = 20; id <= 22; id++) { when(topics.findOne(id)).thenReturn(topic(id)); }
        ReflectionTestUtils.setField(service, "topicRepository", topics); return service;
    }
    @Test public void saveResolvesEveryTopicAndPreservesSelectedOrderWithoutDuplicates() {
        EnrolmentClassScheduleTaskDto task = task(); task.setId(null); task.setTopicIds(Arrays.asList(22L, 20L, 22L, 21L));
        EnrolmentClassScheduleTask saved = prepare(preparationService(), task, null);
        assertEquals(Arrays.asList(22L, 20L, 21L), new EnrolmentClassScheduleTaskDto(saved).getTopicIds());
        assertEquals(Long.valueOf(22L), saved.getTopic().getId());
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void missingTopicRejectsEntireSelection() {
        EnrolmentClassScheduleTaskDto task = task(); task.setId(null); task.setTopicIds(Arrays.asList(20L, 999L, 21L));
        prepare(preparationService(), task, null);
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void nullTopicRejectsSelection() {
        EnrolmentClassScheduleTaskDto task = task(); task.setId(null); task.setTopicIds(Arrays.asList(20L, null));
        prepare(preparationService(), task, null);
    }
    @Test public void olderEditorsCannotSilentlyDropExistingGroupedSelection() {
        EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setScheduleDate("2026-10-05");
        EnrolmentClassScheduleTask old = new EnrolmentClassScheduleTask(); old.setId(10L); old.setActivityType("DAILY_VOCAB");
        old.setTopics(Arrays.asList(topic(20), topic(21), topic(22))); day.getTasks().add(old);
        EnrolmentClassScheduleTaskDto value = task(); value.setTopicIds(null);
        assertEquals(Arrays.asList(20L, 21L, 22L), new EnrolmentClassScheduleTaskDto(prepare(preparationService(), value, day)).getTopicIds());
    }
    @Test(expected = EnrolmentClassScheduleException.class) public void listeningDoesNotAccidentallyAcceptSeveralTopics() {
        EnrolmentClassScheduleTaskDto task = task(); task.setId(null); task.setActivityType("DAILY_LISTENING");
        prepare(preparationService(), task, null);
    }

    private EnrolmentClassServiceImpl assignments;
    private EnrolmentClassScheduleTask assigned;
    private TestResultRepository results;
    private User student;
    private EnrolmentClassRepository classes;
    private void studentFixture(int topicCount) {
        student = new User(); student.setId(30L); student.setUsername("student");
        student.setEnrollmentClassIds(new HashSet<Long>(Collections.singletonList(2L)));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student, "", Collections.emptyList()));
        assignments = new EnrolmentClassServiceImpl();
        UserRepository users = mock(UserRepository.class); when(users.findByUsername("student")).thenReturn(student);
        ReflectionTestUtils.setField(assignments, "userRepository", users);
        EnrolmentClass parent = new EnrolmentClass(); parent.setId(1L); parent.setSchoolId(2); parent.setName("Class");
        EnrolmentClass child = new EnrolmentClass(); child.setId(2L); child.setSchoolId(2); child.setParent(parent);
        classes = mock(EnrolmentClassRepository.class); when(classes.findOne(1L)).thenReturn(parent); when(classes.findOne(2L)).thenReturn(child);
        ReflectionTestUtils.setField(assignments, "enrolmentClassRepository", classes);
        EnrolmentClassWeeklySessionRepository weekly = mock(EnrolmentClassWeeklySessionRepository.class);
        ReflectionTestUtils.setField(assignments, "weeklySessionRepository", weekly);
        EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(parent);
        day.setScheduleDate(java.time.LocalDate.now().minusDays(2).toString());
        assigned = new EnrolmentClassScheduleTask(); assigned.setId(10L); assigned.setScheduleDay(day);
        assigned.setSection("HOMEWORK"); assigned.setStatus("TODO"); assigned.setTitle("Assignment"); assigned.setActivityType("DAILY_VOCAB");
        assigned.setDueDate(java.time.LocalDate.now().plusDays(2).toString()); assigned.setDeadlineAutomatic(false);
        List<Topic> topics = new ArrayList<Topic>(); for (long id = 20; id < 20 + topicCount; id++) { topics.add(topic(id)); }
        assigned.setTopics(topics); assigned.setRequiredAttempts(1); day.getTasks().add(assigned);
        EnrolmentClassScheduleDayRepository days = mock(EnrolmentClassScheduleDayRepository.class);
        when(days.findByEnrolmentClassIdAndScheduleDateBetweenOrderByScheduleDateAsc(eq(1L), anyString(), anyString())).thenReturn(Collections.singletonList(day));
        ReflectionTestUtils.setField(assignments, "scheduleDayRepository", days);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(10L)).thenReturn(assigned);
        ReflectionTestUtils.setField(assignments, "scheduleTaskRepository", tasks);
        results = mock(TestResultRepository.class); ReflectionTestUtils.setField(assignments, "testResultRepository", results);
    }
    private void completed(long topicId, long count) {
        when(results.countSuccessfulVocabularyTopicAttempts(eq(30L), eq(10L), eq(topicId), any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(count);
    }
    @Test public void studentGetsSeparateRowsAndCompletedTopicRemainsUntilParentDone() {
        studentFixture(3); completed(20, 1);
        List<StudentAssignedTaskDto> cards = assignments.getMyAssignedTasks(); assertEquals(3, cards.size());
        assertEquals(Arrays.asList(20L, 21L, 22L), cards.get(0).getTopicIds());
        assertEquals(Long.valueOf(20L), cards.get(0).getTopicId()); assertEquals(0, cards.get(0).getRemainingAttempts());
        assertEquals(Long.valueOf(21L), cards.get(1).getTopicId()); assertEquals(1, cards.get(1).getRemainingAttempts());
        for (StudentAssignedTaskDto card : cards) { assertEquals(33, card.getTaskProgressPercent()); assertEquals(1, card.getTaskCompletedTopics()); assertEquals(3, card.getTaskTotalTopics()); }
        completed(21, 1); assertEquals(67, assignments.getMyAssignedTasks().get(0).getTaskProgressPercent());
        completed(22, 1); assertTrue(assignments.getMyAssignedTasks().isEmpty());
    }
    @Test public void requiredAttemptsArePerTopicAndCappedAtThatTopic() {
        studentFixture(3); assigned.setRequiredAttempts(2); completed(20, 9); completed(21, 1);
        List<StudentAssignedTaskDto> cards = assignments.getMyAssignedTasks();
        assertEquals(2, cards.get(0).getCompletedAttempts()); assertEquals(0, cards.get(0).getRemainingAttempts());
        assertEquals(1, cards.get(0).getTaskCompletedTopics()); assertEquals(50, cards.get(0).getTaskProgressPercent());
    }
    @Test public void cardLimitCannotSplitAParentWithMoreThanTwentySelectedTopics() {
        studentFixture(25); assertEquals(25, assignments.getMyAssignedTasks().size());
    }
    @Test public void manualDoneHidesAllChildrenAndAssignmentSettingsContainAllTopicIds() {
        studentFixture(3); StudentAssignedTaskDto settings = assignments.getAssignedTask(10L);
        assertEquals(Arrays.asList(20L, 21L, 22L), settings.getTopicIds());
        EnrolmentClassTaskProgress feedback = new EnrolmentClassTaskProgress(); feedback.setStudentUserId(30L); feedback.setStatus("DONE");
        assigned.getStudentProgress().add(feedback); assertTrue(assignments.getMyAssignedTasks().isEmpty());
    }

    private TestResultServiceImpl resultService() {
        TestResultServiceImpl service = new TestResultServiceImpl();
        javax.persistence.EntityManager manager = mock(javax.persistence.EntityManager.class);
        when(manager.find(User.class, 30L, javax.persistence.LockModeType.PESSIMISTIC_WRITE)).thenReturn(student);
        ReflectionTestUtils.setField(service, "manager", manager);
        ReflectionTestUtils.setField(service, "enrolmentClassRepository", classes);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(10L)).thenReturn(assigned);
        ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
        TopicRepository topics = mock(TopicRepository.class);
        for (Topic topic : assigned.getTopics()) { when(topics.findOne(topic.getId())).thenReturn(topic); }
        ReflectionTestUtils.setField(service, "topicRepository", topics);
        UserRepository users = mock(UserRepository.class); when(users.findById(30L)).thenReturn(student); ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "testResultRepository", results);
        when(results.save(any(TestResult.class))).thenAnswer(call -> { TestResult value = (TestResult) call.getArguments()[0]; value.setId(500L); return value; });
        return service;
    }
    private TestResultDto submission() {
        TestResultDto dto = new TestResultDto(); dto.setTestType(1); dto.setAssignmentTaskId(10L); dto.setAssignmentTopicId(21L);
        dto.setTopicIds(Arrays.asList(20L, 21L, 22L)); dto.setTotalWord(10); dto.setNumberOfWords(10);
        dto.setCompletedVocabularyTopicIds(Arrays.asList(20L, 21L, 22L)); dto.setClientAttemptKey("0123456789abcdef0123456789abcdef"); return dto;
    }
    @Test public void resultRecordsOnlyExplicitSelectedTopicAsAssignmentEvidence() {
        studentFixture(3); TestResultDto saved = resultService().saveObject(submission());
        assertEquals(Long.valueOf(10L), saved.getAssignmentTaskId()); assertEquals(Long.valueOf(21L), saved.getAssignmentTopicId()); assertEquals("SUCCESS", saved.getResultStatus());
        assertEquals(Arrays.asList(20L, 21L, 22L), saved.getCompletedVocabularyTopicIds());
    }
    @Test public void assignmentThresholdNeverAutomaticallyMastersTheAssignedTopicOrDiscardsLearnedChildTopics() {
        studentFixture(3); TestResultDto dto = submission(); dto.setNumberOfWords(9);
        dto.setCompletedVocabularyTopicIds(Collections.singletonList(22L));
        TestResultDto saved = resultService().saveObject(dto);
        assertEquals("SUCCESS", saved.getResultStatus()); assertEquals(Long.valueOf(21L), saved.getAssignmentTopicId());
        assertEquals("Keep only the mastery evidence sent for genuinely completed child topics", Collections.singletonList(22L), saved.getCompletedVocabularyTopicIds());
        assertEquals("Keep original word topic tags while assignment evidence has its own ID", Arrays.asList(20L, 21L, 22L), saved.getTopicIds());
        assertFalse(saved.getCompletedVocabularyTopicIds().contains(saved.getAssignmentTopicId()));
    }
    @Test public void stalePrincipalMembershipCannotSubmitAfterTheStudentMovesClasses() {
        studentFixture(3); TestResultServiceImpl service = resultService();
        User current = new User(); current.setId(30L); current.setUsername("student"); current.setEnrollmentClassIds(Collections.singleton(99L));
        UserRepository users = (UserRepository) ReflectionTestUtils.getField(service, "userRepository"); when(users.findById(30L)).thenReturn(current);
        try { service.saveObject(submission()); fail("Current stored membership must reject the moved student"); }
        catch (AccessDeniedException expected) { }
        verify(results, never()).save(any(TestResult.class));
    }
    @Test public void currentStoredMembershipAllowsSubmissionEvenIfPrincipalClassListIsOld() {
        studentFixture(3); student.setEnrollmentClassIds(Collections.singleton(99L)); TestResultServiceImpl service = resultService();
        User current = new User(); current.setId(30L); current.setUsername("student"); current.setEnrollmentClassIds(Collections.singleton(2L));
        UserRepository users = (UserRepository) ReflectionTestUtils.getField(service, "userRepository"); when(users.findById(30L)).thenReturn(current);
        TestResultDto saved = service.saveObject(submission()); assertEquals("SUCCESS", saved.getResultStatus());
        javax.persistence.EntityManager db = (javax.persistence.EntityManager) ReflectionTestUtils.getField(service, "manager"); verify(db).refresh(current);
    }
    @Test public void failedResultStillSavedButDoesNotCompleteTopic() {
        studentFixture(3); TestResultDto dto = submission(); dto.setNumberOfWords(5);
        TestResultDto saved = resultService().saveObject(dto); assertEquals("FAILED", saved.getResultStatus()); assertEquals(Long.valueOf(10L), saved.getAssignmentTaskId());
        assertEquals(Long.valueOf(21L), saved.getAssignmentTopicId()); assertTrue(saved.getCompletedVocabularyTopicIds().isEmpty());
    }
    @Test(expected = IllegalArgumentException.class) public void groupedAttemptMustIdentifySelectedTopic() {
        studentFixture(3); TestResultDto dto = submission(); dto.setAssignmentTopicId(null); resultService().saveObject(dto);
    }
    @Test(expected = IllegalArgumentException.class) public void foreignTopicCannotBecomeAssignmentEvidence() {
        studentFixture(3); TestResultDto dto = submission(); dto.setAssignmentTopicId(999L); resultService().saveObject(dto);
    }
    @Test(expected = AccessDeniedException.class) public void foreignStudentCannotSubmitGroupedAssignment() {
        studentFixture(3); student.setEnrollmentClassIds(Collections.singleton(99L)); resultService().saveObject(submission());
    }
    @Test public void oldSingleTopicSubmissionFallsBackAndPendingRetryCannotChangeItsTopic() {
        studentFixture(1); TestResultDto dto = submission(); dto.setAssignmentTopicId(null); dto.setTopicIds(Collections.singletonList(20L));
        dto.setCompletedVocabularyTopicIds(Collections.singletonList(20L)); TestResultServiceImpl service = resultService();
        TestResultDto saved = service.saveObject(dto); assertEquals(Long.valueOf(20L), saved.getAssignmentTopicId());
        TestResult existing = new TestResult(); existing.setId(500L); existing.setCreateDate(start); existing.setTestType(1); existing.setAssignmentTaskId(10L); existing.setAssignmentTopicId(20L);
        when(results.findAttemptsForRetry(30L, dto.getClientAttemptKey(), 1)).thenReturn(Collections.singletonList(existing));
        dto.setAssignmentTopicId(999L); assertEquals(Long.valueOf(20L), service.saveObject(dto).getAssignmentTopicId());
    }
}
