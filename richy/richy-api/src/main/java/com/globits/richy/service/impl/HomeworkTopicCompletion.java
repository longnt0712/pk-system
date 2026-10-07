package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.joda.time.LocalDateTime;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;

/** Read-only projection: persisted test results are the completion evidence. */
public final class HomeworkTopicCompletion {
    private HomeworkTopicCompletion() { }
    public static boolean enabled(EnrolmentClassScheduleTaskDto task) {
        return ("CLASS".equals(task.getSection()) || "HOMEWORK".equals(task.getSection())) && task.getTopicId() != null
                && !Boolean.FALSE.equals(task.getAutoCompleteFromTopic())
                && ("DAILY_VOCAB".equals(task.getActivityType()) || "DAILY_LISTENING".equals(task.getActivityType()));
    }
    public static int testType(EnrolmentClassScheduleTaskDto task) {
        return "DAILY_LISTENING".equals(task.getActivityType()) ? 3 : 1;
    }
    public static boolean ieltsEnabled(EnrolmentClassScheduleTaskDto task) {
        return ("CLASS".equals(task.getSection()) || "HOMEWORK".equals(task.getSection()))
                && task.getIeltsTestId() != null && task.getIeltsParts() != null && !task.getIeltsParts().isEmpty()
                && ("IELTS_READING".equals(task.getActivityType()) || "IELTS_LISTENING".equals(task.getActivityType())
                || "IELTS_WRITING".equals(task.getActivityType()) || "COMPREHENSIVE".equals(task.getActivityType()));
    }
    public static int ieltsTestType(EnrolmentClassScheduleTaskDto task) {
        if ("COMPREHENSIVE".equals(task.getActivityType())) { return 6; }
        if ("IELTS_WRITING".equals(task.getActivityType())) { return 7; }
        return "IELTS_LISTENING".equals(task.getActivityType()) ? 2 : 4;
    }
    public static int requiredIeltsAttempts(EnrolmentClassScheduleTaskDto task) {
        return task.getRequiredAttempts() * task.getIeltsParts().size();
    }
    public static int completedIeltsAttempts(EnrolmentClassScheduleTaskDto task, Map<Integer, Integer> counts) {
        int completed = 0;
        for (Integer part : task.getIeltsParts()) {
            completed += Math.min(task.getRequiredAttempts(), counts.containsKey(part) ? counts.get(part) : 0);
        }
        return completed;
    }
    /** Open the least completed selected part, so repeated assignments advance through every part. */
    public static Integer nextIeltsPart(EnrolmentClassScheduleTaskDto task, Map<Integer, Integer> counts) {
        Integer next = null;
        int lowest = task.getRequiredAttempts();
        for (Integer part : task.getIeltsParts()) {
            int count = counts.containsKey(part) ? counts.get(part) : 0;
            if (count < lowest) { next = part; lowest = count; }
        }
        return next;
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
    public static LocalDateTime at(String date, String time) {
        if (date == null) { return null; }
        LocalDate parsed = LocalDate.parse(date);
        if (time == null || time.isEmpty()) { return midnight(parsed); }
        java.time.LocalTime clock = java.time.LocalTime.parse(time);
        return new LocalDateTime(parsed.getYear(), parsed.getMonthValue(), parsed.getDayOfMonth(),
                clock.getHour(), clock.getMinute());
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
    /** Active assignments use evidence up to their deadline; expired assignments are omitted. */
    public static LocalDateTime studentAssignmentCompletionEnd(LocalDateTime start,
            LocalDateTime deadline, LocalDateTime now) {
        if (start == null || now == null || now.isBefore(start)) { return null; }
        if (deadline == null || !deadline.isAfter(start) || !now.isBefore(deadline)) { return null; }
        return deadline;
    }
    public static void apply(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        if (!enabled(task)) { return; }
        removeAutomaticProgress(task);
        int required = task.getRequiredAttempts();
        Map<Long, Integer> counts = new LinkedHashMap<Long, Integer>();
        for (Object[] row : completions) {
            Long studentId = (Long) row[0], topicId = (Long) row[1];
            LocalDateTime completed = (LocalDateTime) row[2];
            Integer resultTestType = row.length > 4 ? (Integer) row[4] : Integer.valueOf(1);
            Long sourceQuestionId = row.length > 5 ? (Long) row[5] : null;
            Long assignmentTaskId = row.length > 6 ? (Long) row[6] : null;
            if (!task.getTopicId().equals(topicId) || resultTestType.intValue() != testType(task)
                    || task.getId() == null || !task.getId().equals(assignmentTaskId)
                    || (task.getSourceQuestionId() != null && !task.getSourceQuestionId().equals(sourceQuestionId))
                    || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            int count = counts.containsKey(studentId) ? counts.get(studentId) + 1 : 1;
            counts.put(studentId, count);
            EnrolmentClassTaskProgressDto existing = null;
            for (EnrolmentClassTaskProgressDto progress : task.getStudentProgress()) {
                if (studentId.equals(progress.getStudentUserId())) { existing = progress; break; }
            }
            // Explicit teacher feedback takes priority over automated evidence.
            if (existing != null && !existing.isAutomatic()
                    && ("NEEDS_REVIEW".equals(existing.getStatus()) || "DONE".equals(existing.getStatus())
                    || "UNRECORDED".equals(existing.getStatus())
                    || (existing.getStatus() != null && existing.getStatus().startsWith("PROGRESS_")))) { continue; }
            if (existing == null) {
                existing = new EnrolmentClassTaskProgressDto(); existing.setStudentUserId(studentId);
                task.getStudentProgress().add(existing);
            }
            if (!existing.isAutomatic()) { existing.setManualStatus(existing.getStatus()); }
            if (count >= required) {
                existing.setStatus("DONE");
            } else {
                int roundedPercent = (int) Math.ceil((count * 100.0 / required) / 10.0) * 10;
                existing.setStatus("PROGRESS_" + Math.max(10, Math.min(90, roundedPercent)));
            }
            existing.setAutomatic(true);
            existing.setTestResultId((Long) row[3]); existing.setCompletedAt(completed.toDate());
        }
    }

    public static void applyIelts(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        if (!ieltsEnabled(task)) { return; }
        removeAutomaticProgress(task);
        int required = requiredIeltsAttempts(task);
        Map<Long, Map<Integer, Integer>> counts = new LinkedHashMap<Long, Map<Integer, Integer>>();
        for (Object[] row : completions) {
            Long studentId = (Long) row[0], testId = (Long) row[1];
            Integer part = (Integer) row[2], resultTestType = (Integer) row[5];
            LocalDateTime completed = (LocalDateTime) row[3];
            if (!task.getIeltsTestId().equals(testId) || !task.getIeltsParts().contains(part)
                    || task.getId() == null || !task.getId().equals((Long) row[6])
                    || resultTestType.intValue() != ieltsTestType(task)
                    || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            Map<Integer, Integer> partCounts = counts.get(studentId);
            if (partCounts == null) { partCounts = new LinkedHashMap<Integer, Integer>(); counts.put(studentId, partCounts); }
            partCounts.put(part, partCounts.containsKey(part) ? partCounts.get(part) + 1 : 1);
            int count = completedIeltsAttempts(task, partCounts);
            EnrolmentClassTaskProgressDto existing = null;
            for (EnrolmentClassTaskProgressDto progress : task.getStudentProgress()) {
                if (studentId.equals(progress.getStudentUserId())) { existing = progress; break; }
            }
            if (existing != null && !existing.isAutomatic()
                    && ("NEEDS_REVIEW".equals(existing.getStatus()) || "DONE".equals(existing.getStatus())
                    || "UNRECORDED".equals(existing.getStatus())
                    || (existing.getStatus() != null && existing.getStatus().startsWith("PROGRESS_")))) { continue; }
            if (existing == null) {
                existing = new EnrolmentClassTaskProgressDto(); existing.setStudentUserId(studentId);
                task.getStudentProgress().add(existing);
            }
            if (!existing.isAutomatic()) { existing.setManualStatus(existing.getStatus()); }
            if (count >= required) { existing.setStatus("DONE"); }
            else {
                int roundedPercent = (int) Math.ceil((count * 100.0 / required) / 10.0) * 10;
                existing.setStatus("PROGRESS_" + Math.max(10, Math.min(90, roundedPercent)));
            }
            existing.setAutomatic(true);
            existing.setTestResultId((Long) row[4]); existing.setCompletedAt(completed.toDate());
        }
    }

    private static void removeAutomaticProgress(EnrolmentClassScheduleTaskDto task) {
        for (int index = task.getStudentProgress().size() - 1; index >= 0; index--) {
            if (task.getStudentProgress().get(index).isAutomatic()) {
                task.getStudentProgress().remove(index);
            }
        }
    }
}
