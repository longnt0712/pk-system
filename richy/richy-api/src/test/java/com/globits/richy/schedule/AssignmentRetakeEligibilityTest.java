package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class AssignmentRetakeEligibilityTest {
    private EnrolmentClassServiceImpl service;
    private EnrolmentClassScheduleTask task;
    private EnrolmentClassScheduleDay day;
    private EnrolmentClassScheduleDayRepository days;
    @Before public void setup() {
        service = new EnrolmentClassServiceImpl();
        EnrolmentClass clazz = new EnrolmentClass(); clazz.setId(1L); clazz.setName("Class"); clazz.setSchoolId(2);
        day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(clazz); day.setScheduleDate("2026-10-19");
        task = new EnrolmentClassScheduleTask(); task.setId(10L); task.setScheduleDay(day); task.setSection("HOMEWORK"); task.setActivityType("IELTS_WRITING"); task.setTitle("Writing"); task.setStatus("TODO");
        Question writing = new Question(); writing.setId(42L); writing.setTestFormat("WRITING"); task.setIeltsTest(writing); task.setIeltsParts(Arrays.asList(1, 2)); task.setIeltsPart(1); task.setDeadlineAutomatic(true);
        day.getTasks().add(task);
        EnrolmentClassWeeklySessionRepository weekly = mock(EnrolmentClassWeeklySessionRepository.class);
        EnrolmentClassWeeklySession monday = new EnrolmentClassWeeklySession(); monday.setDayOfWeek(1); monday.setStartTime("18:00"); monday.setEndTime("20:00");
        EnrolmentClassWeeklySession wednesday = new EnrolmentClassWeeklySession(); wednesday.setDayOfWeek(3); wednesday.setStartTime("18:00"); wednesday.setEndTime("20:00");
        when(weekly.findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(1L)).thenReturn(Arrays.asList(monday, wednesday));
        ReflectionTestUtils.setField(service, "weeklySessionRepository", weekly);
        days = mock(EnrolmentClassScheduleDayRepository.class); when(days.findScheduleTimeline(1L)).thenReturn(Collections.emptyList()); ReflectionTestUtils.setField(service, "scheduleDayRepository", days);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(10L)).thenReturn(task); ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
        EnrolmentClassRepository classes = mock(EnrolmentClassRepository.class); when(classes.findOne(1L)).thenReturn(clazz); ReflectionTestUtils.setField(service, "enrolmentClassRepository", classes);
        User user = new User(); user.setId(30L); user.setUsername("student"); user.setEnrollmentClassIds(Collections.singleton(1L));
        UserRepository users = mock(UserRepository.class); when(users.findByUsername("student")).thenReturn(user); ReflectionTestUtils.setField(service, "userRepository", users);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "", Collections.emptyList()));
    }
    @After public void clearSecurity() { SecurityContextHolder.clearContext(); }
    private StudentAssignedTaskDto at(String time) {
        StudentAssignedTaskDto dto = new StudentAssignedTaskDto();
        ReflectionTestUtils.invokeMethod(service, "populateAssignedTaskAvailability", dto, task, LocalDateTime.parse(time)); return dto;
    }
    @Test public void automaticDeadlineIsTheNextExistingClassSessionAndStartIsInclusive() {
        StudentAssignedTaskDto before = at("2026-10-19T19:59:59.999"); assertEquals(Boolean.FALSE, before.getCanStartNewAttempt()); assertNotNull(before.getNewAttemptUnavailableReason());
        StudentAssignedTaskDto start = at("2026-10-19T20:00:00.000"); assertEquals(Boolean.TRUE, start.getCanStartNewAttempt());
        StudentAssignedTaskDto within = at("2026-10-20T12:00"); assertEquals(Boolean.TRUE, within.getCanStartNewAttempt()); assertNull(within.getNewAttemptUnavailableReason());
        assertEquals("2026-10-21", within.getDueDate()); assertEquals("20:00", within.getDueTime());
    }
    @Test public void exactDisplayedDeadlineKeepsExistingInclusiveInstantThenEffectiveEndCloses() {
        assertEquals(Boolean.TRUE, at("2026-10-21T20:00:00.000").getCanStartNewAttempt());
        assertEquals(Boolean.FALSE, at("2026-10-21T20:00:00.001").getCanStartNewAttempt());
        assertEquals(Boolean.FALSE, at("2026-10-22T10:00").getCanStartNewAttempt());
    }
    @Test public void manualDeadlineIsNeverResetWhenStartingAnotherAttempt() {
        task.setDeadlineAutomatic(false); task.setDueDate("2026-10-20"); task.setDueTime("19:00");
        StudentAssignedTaskDto within = at("2026-10-20T18:59"); assertEquals(Boolean.TRUE, within.getCanStartNewAttempt());
        assertEquals("2026-10-20", within.getDueDate()); assertEquals("19:00", within.getDueTime());
        StudentAssignedTaskDto expired = at("2026-10-20T19:00:00.001"); assertEquals(Boolean.FALSE, expired.getCanStartNewAttempt());
        assertEquals("2026-10-20", expired.getDueDate()); assertEquals("19:00", expired.getDueTime());
    }
    @Test public void dateOnlyLegacyDeadlineKeepsTheWholeDay() {
        task.setDeadlineAutomatic(false); task.setDueDate("2026-10-20"); task.setDueTime(null);
        assertEquals(Boolean.TRUE, at("2026-10-20T23:59:59.999").getCanStartNewAttempt());
        assertEquals(Boolean.FALSE, at("2026-10-21T00:00:00.000").getCanStartNewAttempt());
    }
    @Test public void doneDoesNotAddANewRetakeRestrictionWithinTheExistingWindow() {
        task.setStatus("DONE"); EnrolmentClassTaskProgress manual = new EnrolmentClassTaskProgress(); manual.setStudentUserId(30L); manual.setStatus("DONE"); task.getStudentProgress().add(manual);
        assertEquals(Boolean.TRUE, at("2026-10-20T12:00").getCanStartNewAttempt());
    }
    @Test public void missingValidDeadlineDoesNotInventANewWindow() {
        task.setDeadlineAutomatic(false); task.setDueDate(null); task.setDueTime(null);
        StudentAssignedTaskDto dto = at("2026-10-20T12:00"); assertEquals(Boolean.FALSE, dto.getCanStartNewAttempt()); assertNotNull(dto.getNewAttemptUnavailableReason());
    }
    @Test public void movedNextSessionUsesTheSameEffectiveScheduleAsAssignmentCards() {
        when(days.findScheduleTimeline(1L)).thenReturn(Arrays.asList(
                new Object[] {"2026-10-21", null, null, "2026-10-22", false},
                new Object[] {"2026-10-22", "19:00", "21:00", null, false}));
        StudentAssignedTaskDto dto = at("2026-10-21T22:00"); assertEquals(Boolean.TRUE, dto.getCanStartNewAttempt());
        assertEquals("2026-10-22", dto.getDueDate()); assertEquals("21:00", dto.getDueTime());
    }
    @Test public void expiredEndpointStillReturnsReceiptContextAndSelectedParts() {
        day.setScheduleDate(java.time.LocalDate.now().minusDays(10).toString());
        task.setDeadlineAutomatic(false); task.setDueDate(java.time.LocalDate.now().minusDays(1).toString()); task.setDueTime("18:00");
        StudentAssignedTaskDto dto = service.getAssignedTask(10L);
        assertEquals(Boolean.FALSE, dto.getCanStartNewAttempt()); assertNotNull(dto.getNewAttemptUnavailableReason());
        assertEquals(Long.valueOf(10L), dto.getTaskId()); assertEquals(Long.valueOf(42L), dto.getIeltsTestId());
        assertEquals(Arrays.asList(1, 2), dto.getIeltsParts()); assertEquals(Integer.valueOf(1), dto.getIeltsPart());
        assertEquals(task.getDueDate(), dto.getDueDate()); assertEquals("18:00", dto.getDueTime());
    }
}
