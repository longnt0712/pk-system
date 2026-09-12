package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.joda.time.LocalDateTime;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;

/** Read-only projection: persisted test results are the completion evidence. */
public final class HomeworkTopicCompletion {
    private HomeworkTopicCompletion() { }
    public static boolean enabled(EnrolmentClassScheduleTaskDto task) {
        return "HOMEWORK".equals(task.getSection()) && task.getTopicId() != null
                && !Boolean.FALSE.equals(task.getAutoCompleteFromTopic());
    }
    public static LocalDate windowEnd(String assigned, String due, Set<Integer> weekdays, String nextSaved) {
        LocalDate start = LocalDate.parse(assigned);
        if (due != null && !due.isEmpty()) { return LocalDate.parse(due).plusDays(1); }
        LocalDate end = nextSaved == null ? null : LocalDate.parse(nextSaved);
        for (int i = 1; i <= 7; i++) {
            LocalDate date = start.plusDays(i);
            if (weekdays.contains(date.getDayOfWeek().getValue())) {
                if (end == null || date.isBefore(end)) { end = date; }
                break;
            }
        }
        return end == null ? start.plusDays(7) : end;
    }
    public static LocalDateTime midnight(LocalDate date) {
        return new LocalDateTime(date.getYear(), date.getMonthValue(), date.getDayOfMonth(), 0, 0);
    }
    public static boolean automaticDeadline(EnrolmentClassScheduleTaskDto task) {
        return "HOMEWORK".equals(task.getSection()) && (Boolean.TRUE.equals(task.getDeadlineAutomatic())
                || (task.getDeadlineAutomatic() == null && (task.getDueDate() == null || task.getDueDate().isEmpty())));
    }
    public static LocalDateTime deadlineEnd(String date, String time) {
        if (date == null) { return null; }
        LocalDate parsed = LocalDate.parse(date);
        // Date-only legacy deadlines keep their original whole-day semantics.
        if (time == null || time.isEmpty()) { return midnight(parsed.plusDays(1)); }
        java.time.LocalTime clock = java.time.LocalTime.parse(time);
        return new LocalDateTime(parsed.getYear(), parsed.getMonthValue(), parsed.getDayOfMonth(),
                clock.getHour(), clock.getMinute()).plusMillis(1);
    }
    public static void apply(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        if (!enabled(task)) { return; }
        for (Object[] row : completions) {
            Long studentId = (Long) row[0], topicId = (Long) row[1];
            LocalDateTime completed = (LocalDateTime) row[2];
            if (!task.getTopicId().equals(topicId) || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            EnrolmentClassTaskProgressDto existing = null;
            for (EnrolmentClassTaskProgressDto progress : task.getStudentProgress()) {
                if (studentId.equals(progress.getStudentUserId())) { existing = progress; break; }
            }
            // Explicit teacher feedback takes priority over automated evidence.
            if (existing != null && ("NEEDS_REVIEW".equals(existing.getStatus()) || "DONE".equals(existing.getStatus())
                    || "UNRECORDED".equals(existing.getStatus())
                    || (existing.getStatus() != null && existing.getStatus().startsWith("PROGRESS_")))) { continue; }
            if (existing == null) {
                existing = new EnrolmentClassTaskProgressDto(); existing.setStudentUserId(studentId);
                task.getStudentProgress().add(existing);
            }
            existing.setManualStatus(existing.getStatus());
            existing.setStatus("DONE"); existing.setAutomatic(true);
            existing.setTestResultId((Long) row[3]); existing.setCompletedAt(completed.toDate());
        }
    }
}
