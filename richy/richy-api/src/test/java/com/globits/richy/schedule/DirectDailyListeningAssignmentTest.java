package com.globits.richy.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.*;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.security.domain.User;
import com.globits.security.domain.Role;
import com.globits.security.repository.UserRepository;
import java.util.*;
import javax.persistence.EntityManager;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class DirectDailyListeningAssignmentTest {
    private final LocalDateTime start = new LocalDateTime(2026, 10, 19, 20, 0), end = start.plusDays(2);
    private EnrolmentClassServiceImpl service;
    private EnrolmentClassScheduleTask task;
    private EnrolmentClassScheduleDay day;
    private User student;
    private UserRepository users;
    private EnrolmentClassRepository classes;
    private QuestionRepository questions;
    private QuestionTopicRepository links;
    private TestResultRepository results;
    private Question source;
    private Topic topic;
    @Before public void fixture() {
        student = new User(); student.setId(30L); student.setUsername("student"); student.setActive(true);
        student.setEnrollmentClassIds(Collections.singleton(2L));
        Role role = new Role(); role.setName("ROLE_STUDENT"); student.setRoles(Collections.singleton(role));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student, "", Collections.emptyList()));
        service = new EnrolmentClassServiceImpl(); users = mock(UserRepository.class);
        when(users.findByUsername("student")).thenReturn(student); when(users.findById(30L)).thenReturn(student);
        when(users.getUsersByEnrollmentClassIds(anyList())).thenReturn(Collections.singletonList(student));
        ReflectionTestUtils.setField(service, "userRepository", users);
        EnrolmentClass parent = new EnrolmentClass(); parent.setId(1L); parent.setName("Parent"); parent.setSchoolId(2);
        EnrolmentClass child = new EnrolmentClass(); child.setId(2L); child.setName("Child"); child.setSchoolId(2); child.setParent(parent);
        classes = mock(EnrolmentClassRepository.class); when(classes.findOne(1L)).thenReturn(parent); when(classes.findOne(2L)).thenReturn(child);
        when(classes.findByParentId(1L)).thenReturn(Collections.singletonList(child));
        ReflectionTestUtils.setField(service, "enrolmentClassRepository", classes);
        day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(parent); day.setScheduleDate(java.time.LocalDate.now().minusDays(2).toString());
        task = new EnrolmentClassScheduleTask(); task.setId(10L); task.setSection("HOMEWORK"); task.setStatus("TODO"); task.setTitle("Assigned daily");
        task.setScheduleDay(day); task.setActivityType("DAILY_LISTENING"); task.setRequiredAttempts(2); task.setDeadlineAutomatic(false);
        task.setDueDate(java.time.LocalDate.now().plusDays(2).toString()); day.getTasks().add(task);
        source = new Question(); source.setId(42L); source.setQuestion("Listening title"); source.setTitle("Listening title");
        source.setMotherTongue("Private transcript should not appear in task metadata"); source.setTestFormat("DAILY_LISTENING"); source.setStatus(7);
        QuestionType type = new QuestionType(); type.setId(11L); source.setQuestionType(type); task.setSourceQuestion(source);
        topic = new Topic(); topic.setId(20L); topic.setName("Topic");
        questions = mock(QuestionRepository.class); when(questions.findOne(42L)).thenReturn(source); ReflectionTestUtils.setField(service, "questionRepository", questions);
        TopicRepository topics = mock(TopicRepository.class); when(topics.findOne(20L)).thenReturn(topic); ReflectionTestUtils.setField(service, "topicRepository", topics);
        links = mock(QuestionTopicRepository.class); ReflectionTestUtils.setField(service, "questionTopicRepository", links);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(10L)).thenReturn(task); ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
        EnrolmentClassScheduleDayRepository days = mock(EnrolmentClassScheduleDayRepository.class);
        when(days.findByEnrolmentClassIdAndScheduleDateBetweenOrderByScheduleDateAsc(eq(1L), anyString(), anyString())).thenReturn(Collections.singletonList(day));
        ReflectionTestUtils.setField(service, "scheduleDayRepository", days);
        ReflectionTestUtils.setField(service, "weeklySessionRepository", mock(EnrolmentClassWeeklySessionRepository.class));
        results = mock(TestResultRepository.class); ReflectionTestUtils.setField(service, "testResultRepository", results);
    }
    @After public void clearSecurity() { SecurityContextHolder.clearContext(); }
    @SuppressWarnings("unchecked") private EnrolmentClassScheduleTask prepare(EnrolmentClassScheduleTaskDto dto, EnrolmentClassScheduleDay existing) {
        return ((List<EnrolmentClassScheduleTask>) ReflectionTestUtils.invokeMethod(service, "prepareScheduleTasks", 1L, existing, Collections.singletonList(dto))).get(0);
    }
    private EnrolmentClassScheduleTaskDto creation() { EnrolmentClassScheduleTaskDto dto = new EnrolmentClassScheduleTaskDto(task); dto.setId(null); return dto; }
    @Test public void publishedModernSourceCanBeAssignedWithoutTopic() {
        EnrolmentClassScheduleTask saved = prepare(creation(), null); assertSame(source, saved.getSourceQuestion());
        assertNull(saved.getTopic()); assertTrue(saved.getTopics().isEmpty()); assertEquals(Integer.valueOf(2), saved.getRequiredAttempts());
        verifyZeroInteractions(links);
    }
    @Test(expected=EnrolmentClassScheduleException.class) public void draftModernSourceCannotBecomeANewAssignment() {
        source.setStatus(6); prepare(creation(), null);
    }
    @Test(expected=EnrolmentClassScheduleException.class) public void legacyTrackStillRequiresTopic() {
        source.getQuestionType().setId(6L); source.setTestFormat(null); prepare(creation(), null);
    }
    @Test public void modernAndLegacyTopicTracksKeepTheirExistingRelationship() {
        task.setTopic(topic); when(links.countByQuestionIdAndTopicId(42L, 20L)).thenReturn(1L);
        assertSame(topic, prepare(creation(), null).getTopic());
        source.getQuestionType().setId(6L); source.setTestFormat(null); assertSame(topic, prepare(creation(), null).getTopic());
    }
    @Test(expected=EnrolmentClassScheduleException.class) public void optionalTopicCannotBeBorrowedFromUnrelatedContent() {
        task.setTopic(topic); prepare(creation(), null);
    }
    @Test public void editingExistingTaskDoesNotLoseSourceWhenItWasLaterUnpublished() {
        source.setStatus(6); assertSame(source, prepare(new EnrolmentClassScheduleTaskDto(task), day).getSourceQuestion());
    }
    @Test public void directAssignmentMetadataIsSafeAndStillAvailableAfterDeadline() throws Exception {
        task.setDueDate(java.time.LocalDate.now().minusDays(1).toString());
        StudentAssignedTaskDto dto = service.getAssignedTask(10L); assertEquals(Long.valueOf(42), dto.getSourceQuestionId());
        assertEquals("Listening title", dto.getSourceQuestionTitle()); assertNull(dto.getTopicId()); assertTrue(dto.getTopicIds().isEmpty());
        assertEquals(Boolean.FALSE, dto.getCanStartNewAttempt());
        assertFalse(new ObjectMapper().writeValueAsString(dto).contains("Private transcript"));
    }
    @Test public void capabilitySurvivesClassAndDayJsonRoundTripWithoutTrustingClientValue() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        EnrolmentClassDto clazz = mapper.readValue(mapper.writeValueAsString(new EnrolmentClassDto()), EnrolmentClassDto.class);
        EnrolmentClassScheduleDayDto day = mapper.readValue(mapper.writeValueAsString(new EnrolmentClassScheduleDayDto()), EnrolmentClassScheduleDayDto.class);
        assertTrue(clazz.isDirectListeningAssignmentsEnabled()); assertTrue(day.isDirectListeningAssignmentsEnabled());
        assertTrue(mapper.readValue("{\"directListeningAssignmentsEnabled\":false}", EnrolmentClassScheduleDayDto.class).isDirectListeningAssignmentsEnabled());
    }
    private Object[] row(long resultId) { return new Object[] {30L, 42L, start.plusHours(1), resultId, 3, 10L}; }
    private EnrolmentClassTaskProgressDto progress(EnrolmentClassScheduleTaskDto dto) { return dto.getStudentProgress().get(0); }
    @Test public void sourceEvidenceIsCappedDeduplicatedAndScopedToTaskTypeSourceStudentAndTime() {
        EnrolmentClassScheduleTaskDto dto = new EnrolmentClassScheduleTaskDto(task);
        Object[] wrongTask = row(101); wrongTask[5]=11L; Object[] wrongSource=row(102); wrongSource[1]=43L;
        Object[] wrongType=row(103); wrongType[4]=1; Object[] early=row(104); early[2]=start.minusMillis(1); Object[] late=row(105); late[2]=end;
        HomeworkTopicCompletion.applyDirectListening(dto, Arrays.asList(wrongTask,wrongSource,wrongType,early,late), start,end); assertTrue(dto.getStudentProgress().isEmpty());
        HomeworkTopicCompletion.applyDirectListening(dto, Arrays.<Object[]>asList(row(100),row(100)),start,end);
        assertEquals("PROGRESS_50",progress(dto).getStatus()); assertEquals(Integer.valueOf(50),progress(dto).getProgressPercent());
        Object[] other=row(103);other[0]=31L;HomeworkTopicCompletion.applyDirectListening(dto,Arrays.asList(row(100),row(101),row(102),other),start,end);
        assertEquals("DONE",progress(dto).getStatus());assertEquals(Integer.valueOf(100),progress(dto).getProgressPercent());
        assertEquals("PROGRESS_50",dto.getStudentProgress().get(1).getStatus());
    }
    @Test public void manualTeacherFeedbackKeepsPriorityAndDisabledAutoDoesNotProject() {
        for(String status:Arrays.asList("DONE","NEEDS_REVIEW","UNRECORDED","PROGRESS_30")) {
            EnrolmentClassScheduleTaskDto dto=new EnrolmentClassScheduleTaskDto(task);EnrolmentClassTaskProgressDto manual=new EnrolmentClassTaskProgressDto();
            manual.setStudentUserId(30L);manual.setStatus(status);dto.getStudentProgress().add(manual);
            HomeworkTopicCompletion.applyDirectListening(dto,Arrays.<Object[]>asList(row(100),row(101)),start,end);
            assertEquals(status,manual.getStatus());assertFalse(manual.isAutomatic());
        }
        EnrolmentClassScheduleTaskDto dto=new EnrolmentClassScheduleTaskDto(task);dto.setAutoCompleteFromTopic(false);
        HomeworkTopicCompletion.applyDirectListening(dto,Collections.singletonList(row(100)),start,end);assertTrue(dto.getStudentProgress().isEmpty());
    }
    private void directCount(long count) { when(results.countSuccessfulDirectListeningAttempts(eq(30L),eq(10L),eq(42L),any(LocalDateTime.class),any(LocalDateTime.class))).thenReturn(count); }
    @Test public void studentDirectCardsCountSameSourceOnlyAndDisappearOnlyAtRequiredAttempts() {
        directCount(1);StudentAssignedTaskDto dto=service.getMyAssignedTasks().get(0);
        assertEquals(1,dto.getCompletedAttempts());assertEquals(1,dto.getRemainingAttempts());assertEquals(Long.valueOf(42),dto.getSourceQuestionId());assertNull(dto.getTopicId());
        directCount(2);assertTrue(service.getMyAssignedTasks().isEmpty());
        verify(results,never()).countSuccessfulListeningItemAttempts(anyLong(),anyLong(),anyLong(),anyLong(),any(LocalDateTime.class),any(LocalDateTime.class));
    }
    @Test public void threeRequiredSourceAttemptsExposeExactTeacherPercentAndConsistentStudentCounts() {
        task.setRequiredAttempts(3); EnrolmentClassScheduleTaskDto teacher = new EnrolmentClassScheduleTaskDto(task);
        HomeworkTopicCompletion.applyDirectListening(teacher, Collections.singletonList(row(100)), start, end);
        assertEquals("PROGRESS_33", progress(teacher).getStatus()); assertEquals(Integer.valueOf(33), progress(teacher).getProgressPercent());
        directCount(1); StudentAssignedTaskDto first = service.getMyAssignedTasks().get(0);
        assertEquals(3, first.getRequiredAttempts()); assertEquals(1, first.getCompletedAttempts()); assertEquals(2, first.getRemainingAttempts());
        HomeworkTopicCompletion.applyDirectListening(teacher, Arrays.<Object[]>asList(row(100), row(101)), start, end);
        assertEquals("PROGRESS_67", progress(teacher).getStatus()); assertEquals(Integer.valueOf(67), progress(teacher).getProgressPercent());
        directCount(2); StudentAssignedTaskDto second = service.getMyAssignedTasks().get(0);
        assertEquals(3, second.getRequiredAttempts()); assertEquals(2, second.getCompletedAttempts()); assertEquals(1, second.getRemainingAttempts());
    }
    @Test public void studentEvidenceCountRemainsAvailableWhenTeacherAutoProjectionIsDisabled() {
        task.setAutoCompleteFromTopic(false);directCount(2);assertTrue(service.getMyAssignedTasks().isEmpty());
    }
    @Test public void teacherDayProjectionWorksWhenThereAreNoTopicsOrIeltsTestsAtAll() {
        LocalDateTime date=HomeworkTopicCompletion.midnight(java.time.LocalDate.parse(day.getScheduleDate())).plusHours(1);
        when(results.findDirectListeningCompletions(anyList(),anyList(),any(LocalDateTime.class),any(LocalDateTime.class)))
            .thenReturn(Arrays.asList(new Object[]{30L,42L,date,100L,3,10L},new Object[]{30L,42L,date.plusMinutes(1),101L,3,10L}));
        EnrolmentClassScheduleDayDto dto=ReflectionTestUtils.invokeMethod(service,"scheduleDayWithCompletion",day);
        assertEquals("DONE",dto.getTasks().get(0).getStudentProgress().get(0).getStatus());
        verify(results,never()).findVocabularyCompletions(anyList(),anyList(),any(LocalDateTime.class),any(LocalDateTime.class));
    }
    @Test public void legacyTopicAndTrackStillUseTheirOriginalCountQuery() {
        task.setTopic(topic);when(results.countSuccessfulListeningItemAttempts(eq(30L),eq(10L),eq(20L),eq(42L),any(LocalDateTime.class),any(LocalDateTime.class))).thenReturn(1L);
        assertEquals(1,service.getMyAssignedTasks().get(0).getCompletedAttempts());
        task.setSourceQuestion(null);when(results.countSuccessfulAssignmentAttempts(eq(30L),eq(10L),eq(20L),eq(3),any(LocalDateTime.class),any(LocalDateTime.class))).thenReturn(1L);
        assertEquals(1,service.getMyAssignedTasks().get(0).getCompletedAttempts());
        verify(results,never()).countSuccessfulDirectListeningAttempts(anyLong(),anyLong(),anyLong(),any(LocalDateTime.class),any(LocalDateTime.class));
    }
    private TestResultServiceImpl resultService() {
        TestResultServiceImpl saves=new TestResultServiceImpl();EntityManager manager=mock(EntityManager.class);
        when(manager.find(User.class,30L,javax.persistence.LockModeType.PESSIMISTIC_WRITE)).thenReturn(student);
        ReflectionTestUtils.setField(saves,"manager",manager);ReflectionTestUtils.setField(saves,"userRepository",users);
        ReflectionTestUtils.setField(saves,"enrolmentClassRepository",classes);ReflectionTestUtils.setField(saves,"questionRepository",questions);
        ReflectionTestUtils.setField(saves,"scheduleTaskRepository",ReflectionTestUtils.getField(service,"scheduleTaskRepository"));
        ReflectionTestUtils.setField(saves,"testResultRepository",results);
        when(results.save(any(TestResult.class))).thenAnswer(call->{TestResult value=(TestResult)call.getArguments()[0];value.setId(500L);return value;});return saves;
    }
    private TestResultDto submission() { TestResultDto dto=new TestResultDto();dto.setTestType(3);dto.setAssignmentTaskId(10L);dto.setSourceQuestionId(42L);dto.setTestTime("GAPS 90%");dto.setClientAttemptKey("0123456789abcdef0123456789abcdef");return dto; }
    @Test public void directResultPersistsSourceAndTaskWithoutInventingTopicAndKeepsNinetyPercentThreshold() {
        TestResultServiceImpl saves=resultService();TestResultDto saved=saves.saveObject(submission());
        assertEquals("SUCCESS",saved.getResultStatus());assertEquals(Long.valueOf(10),saved.getAssignmentTaskId());assertEquals(Long.valueOf(42),saved.getSourceQuestionId());assertTrue(saved.getTopicIds().isEmpty());
        TestResultDto failed=submission();failed.setTestTime("GAPS 89%");assertEquals("FAILED",saves.saveObject(failed).getResultStatus());
    }
    @Test(expected=IllegalArgumentException.class) public void unrelatedSourceCannotCreditDirectTask() {TestResultDto dto=submission();dto.setSourceQuestionId(43L);resultService().saveObject(dto);}
    @Test(expected=IllegalArgumentException.class) public void arbitraryNonDailySourceCannotCreditTopiclessTask() {source.setTestFormat("COMPREHENSIVE");resultService().saveObject(submission());}
    @Test(expected=AccessDeniedException.class) public void currentMembershipMustMatchEvenWhenPrincipalStillHasOldClass() {
        TestResultServiceImpl saves=resultService();User moved=new User();moved.setId(30L);moved.setEnrollmentClassIds(Collections.singleton(99L));when(users.findById(30L)).thenReturn(moved);saves.saveObject(submission());
    }
    @Test public void linkedLegacyTrackStillSavesAndKeepsEightyFivePercentThreshold() {
        source.getQuestionType().setId(6L);source.setTestFormat(null);task.setTopic(topic);TestResultDto dto=submission();dto.setTestTime("GAPS 85%");
        assertEquals("SUCCESS",resultService().saveObject(dto).getResultStatus());
    }
}
