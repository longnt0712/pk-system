package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.joda.time.LocalDateTime;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;
import com.globits.richy.dto.ComprehensiveAssignmentSectionDto;

/** Read-only projection: persisted test results are the completion evidence. */
public final class HomeworkTopicCompletion {
    private HomeworkTopicCompletion() { }
    public static boolean enabled(EnrolmentClassScheduleTaskDto task) {
        return ("CLASS".equals(task.getSection()) || "HOMEWORK".equals(task.getSection())) && !task.getTopicIds().isEmpty()
                && !Boolean.FALSE.equals(task.getAutoCompleteFromTopic())
                && ("DAILY_VOCAB".equals(task.getActivityType()) || "DAILY_LISTENING".equals(task.getActivityType()));
    }
    /** Topicless Daily Listening uses the source ID; legacy Topic/Track tasks retain their existing evidence rules. */
    public static boolean directListeningEnabled(EnrolmentClassScheduleTaskDto task) {
        return ("CLASS".equals(task.getSection()) || "HOMEWORK".equals(task.getSection()))
                && directListeningAssignment(task) && !Boolean.FALSE.equals(task.getAutoCompleteFromTopic());
    }
    public static boolean directListeningAssignment(EnrolmentClassScheduleTaskDto task) {
        return "DAILY_LISTENING".equals(task.getActivityType()) && task.getSourceQuestionId() != null
                && task.getTopicIds().isEmpty();
    }
    public static void applyDirectListening(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        if (!directListeningEnabled(task)) { return; }
        removeAutomaticProgress(task);
        int required = task.getRequiredAttempts();
        Map<Long, java.util.Set<Long>> seen = new LinkedHashMap<Long, java.util.Set<Long>>();
        for (Object[] row : completions) {
            Long studentId = (Long) row[0], sourceId = (Long) row[1], resultId = (Long) row[3];
            LocalDateTime completed = (LocalDateTime) row[2];
            if (studentId == null || resultId == null || completed == null || !Integer.valueOf(3).equals(row[4])
                    || task.getId() == null || !task.getId().equals(row[5]) || !task.getSourceQuestionId().equals(sourceId)
                    || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            java.util.Set<Long> results = seen.get(studentId);
            if (results == null) { results = new java.util.HashSet<Long>(); seen.put(studentId, results); }
            if (!results.add(resultId)) { continue; }
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
            int count = Math.min(required, results.size());
            int percent = (int) Math.round(count * 100.0 / required);
            existing.setProgressPercent(percent);
            if (count >= required) { existing.setStatus("DONE"); }
            else { existing.setStatus("PROGRESS_" + Math.max(1, Math.min(99, percent))); }
            existing.setAutomatic(true); existing.setTestResultId(resultId); existing.setCompletedAt(completed.toDate());
        }
    }
    public static int testType(EnrolmentClassScheduleTaskDto task) {
        return "DAILY_LISTENING".equals(task.getActivityType()) ? 3 : 1;
    }
    public static boolean ieltsEnabled(EnrolmentClassScheduleTaskDto task) {
        return ("CLASS".equals(task.getSection()) || "HOMEWORK".equals(task.getSection()))
                && task.getIeltsTestId() != null && (hasComprehensiveSections(task)
                    || (task.getIeltsParts() != null && !task.getIeltsParts().isEmpty()))
                && ("IELTS_READING".equals(task.getActivityType()) || "IELTS_LISTENING".equals(task.getActivityType())
                || "IELTS_WRITING".equals(task.getActivityType()) || "COMPREHENSIVE".equals(task.getActivityType()));
    }
    public static int ieltsTestType(EnrolmentClassScheduleTaskDto task) {
        if ("COMPREHENSIVE".equals(task.getActivityType())) { return 6; }
        if ("IELTS_WRITING".equals(task.getActivityType())) { return 7; }
        return "IELTS_LISTENING".equals(task.getActivityType()) ? 2 : 4;
    }
    public static int requiredIeltsAttempts(EnrolmentClassScheduleTaskDto task) {
        return task.getRequiredAttempts() * (hasComprehensiveSections(task)
                ? comprehensiveSectionKeys(task).size() : task.getIeltsParts().size());
    }
    public static boolean hasComprehensiveSections(EnrolmentClassScheduleTaskDto task) {
        return "COMPREHENSIVE".equals(task.getActivityType()) && task.getComprehensiveSections() != null
                && !task.getComprehensiveSections().isEmpty();
    }
    private static java.util.Set<String> comprehensiveSectionKeys(EnrolmentClassScheduleTaskDto task) {
        java.util.Set<String> keys = new java.util.LinkedHashSet<String>();
        for (ComprehensiveAssignmentSectionDto section : task.getComprehensiveSections()) {
            if (section != null && section.getKey() != null && !section.getKey().trim().isEmpty()) { keys.add(section.getKey()); }
        }
        return keys;
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
        List<Long> selectedTopics = task.getTopicIds();
        boolean multipleTopics = "DAILY_VOCAB".equals(task.getActivityType()) && selectedTopics.size() > 1;
        Map<Long, Map<Long, Integer>> counts = new LinkedHashMap<Long, Map<Long, Integer>>();
        Map<Long, java.util.Set<Long>> seenResults = new LinkedHashMap<Long, java.util.Set<Long>>();
        for (Object[] row : completions) {
            Long studentId = (Long) row[0], topicId = (Long) row[1], resultId = (Long) row[3];
            LocalDateTime completed = (LocalDateTime) row[2];
            Integer resultTestType = row.length > 4 ? (Integer) row[4] : Integer.valueOf(1);
            Long sourceQuestionId = row.length > 5 ? (Long) row[5] : null;
            Long assignmentTaskId = row.length > 6 ? (Long) row[6] : null;
            Long assignmentTopicId = row.length > 7 ? (Long) row[7] : null;
            // Legacy results can prove one legacy topic, never every topic of a new grouped task.
            if (!selectedTopics.contains(topicId) || resultTestType == null || resultTestType.intValue() != testType(task)
                    || task.getId() == null || !task.getId().equals(assignmentTaskId)
                    || (multipleTopics && !topicId.equals(assignmentTopicId))
                    || (assignmentTopicId != null && !topicId.equals(assignmentTopicId))
                    || (task.getSourceQuestionId() != null && !task.getSourceQuestionId().equals(sourceQuestionId))
                    || studentId == null || resultId == null || completed == null
                    || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            java.util.Set<Long> seen = seenResults.get(studentId);
            if (seen == null) { seen = new java.util.HashSet<Long>(); seenResults.put(studentId, seen); }
            if (!seen.add(resultId)) { continue; }
            Map<Long, Integer> topicCounts = counts.get(studentId);
            if (topicCounts == null) { topicCounts = new LinkedHashMap<Long, Integer>(); counts.put(studentId, topicCounts); }
            int previous = topicCounts.containsKey(topicId) ? topicCounts.get(topicId) : 0;
            topicCounts.put(topicId, Math.min(required, previous + 1));
            int count = 0;
            for (Integer topicCount : topicCounts.values()) { count += topicCount; }
            int total = required * selectedTopics.size();
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
            int percent = (int) Math.round(count * 100.0 / total);
            existing.setProgressPercent(percent);
            if (count >= total) { existing.setStatus("DONE"); }
            else if (multipleTopics) { existing.setStatus("PROGRESS_" + Math.max(1, Math.min(99, percent))); }
            else {
                int roundedPercent = (int) Math.ceil((count * 100.0 / total) / 10.0) * 10;
                existing.setStatus("PROGRESS_" + Math.max(10, Math.min(90, roundedPercent)));
            }
            existing.setAutomatic(true);
            existing.setTestResultId(resultId); existing.setCompletedAt(completed.toDate());
        }
    }

    public static void applyIelts(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        if (!ieltsEnabled(task)) { return; }
        if (hasComprehensiveSections(task)) { applyComprehensiveSections(task, completions, start, end); return; }
        removeAutomaticProgress(task);
        int required = requiredIeltsAttempts(task);
        Map<Long, Map<Integer, Integer>> counts = new LinkedHashMap<Long, Map<Integer, Integer>>();
        for (Object[] row : completions) {
            // A sliced Comprehensive attempt proves its own section, never an old full-test Part 1.
            if (row.length > 8 && row[8] != null) { continue; }
            Long studentId = (Long) row[0], testId = (Long) row[1];
            Integer part = (Integer) row[2], resultTestType = (Integer) row[5];
            LocalDateTime completed = (LocalDateTime) row[3];
            if (!task.getIeltsTestId().equals(testId)
                    || task.getId() == null || !task.getId().equals((Long) row[6])
                    || resultTestType.intValue() != ieltsTestType(task)
                    || completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            List<Integer> completedParts = com.globits.richy.domain.TestResult.parseCompletedParts(
                    row.length > 7 ? (String) row[7] : null, part);
            completedParts.retainAll(task.getIeltsParts());
            if (completedParts.isEmpty()) { continue; }
            Map<Integer, Integer> partCounts = counts.get(studentId);
            if (partCounts == null) { partCounts = new LinkedHashMap<Integer, Integer>(); counts.put(studentId, partCounts); }
            for (Integer completedPart : completedParts) {
                partCounts.put(completedPart, partCounts.containsKey(completedPart) ? partCounts.get(completedPart) + 1 : 1);
            }
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

    private static void applyComprehensiveSections(EnrolmentClassScheduleTaskDto task, List<Object[]> completions,
            LocalDateTime start, LocalDateTime end) {
        removeAutomaticProgress(task);
        java.util.Set<String> sections = comprehensiveSectionKeys(task);
        if (sections.isEmpty() || task.getId() == null || start == null || end == null) { return; }
        int requiredPerSection = task.getRequiredAttempts(), total = sections.size() * requiredPerSection;
        Map<Long, Map<String, Integer>> counts = new LinkedHashMap<Long, Map<String, Integer>>();
        Map<Long, java.util.Set<Long>> seenResults = new LinkedHashMap<Long, java.util.Set<Long>>();
        for (Object[] row : completions) {
            // Repository supplies only SUCCESS evidence. Older full-test rows have no section key.
            if (row == null || row.length < 9 || !(row[0] instanceof Long) || !(row[4] instanceof Long)
                    || !(row[3] instanceof LocalDateTime) || !Integer.valueOf(6).equals(row[5])
                    || !task.getIeltsTestId().equals(row[1]) || !task.getId().equals(row[6])
                    || !(row[8] instanceof String) || !sections.contains((String) row[8])) { continue; }
            Long studentId = (Long) row[0], resultId = (Long) row[4];
            LocalDateTime completed = (LocalDateTime) row[3];
            if (completed.isBefore(start) || !completed.isBefore(end)) { continue; }
            java.util.Set<Long> seen = seenResults.get(studentId);
            if (seen == null) { seen = new java.util.HashSet<Long>(); seenResults.put(studentId, seen); }
            if (!seen.add(resultId)) { continue; }
            Map<String, Integer> sectionCounts = counts.get(studentId);
            if (sectionCounts == null) { sectionCounts = new LinkedHashMap<String, Integer>(); counts.put(studentId, sectionCounts); }
            String key = (String) row[8];
            int previous = sectionCounts.containsKey(key) ? sectionCounts.get(key) : 0;
            sectionCounts.put(key, Math.min(requiredPerSection, previous + 1));
            int count = 0;
            for (Integer value : sectionCounts.values()) { count += value; }
            EnrolmentClassTaskProgressDto existing = null;
            for (EnrolmentClassTaskProgressDto progress : task.getStudentProgress()) {
                if (studentId.equals(progress.getStudentUserId())) { existing = progress; break; }
            }
            // Teacher feedback keeps exactly the same precedence as existing Homework tasks.
            if (existing != null && !existing.isAutomatic()
                    && ("NEEDS_REVIEW".equals(existing.getStatus()) || "DONE".equals(existing.getStatus())
                    || "UNRECORDED".equals(existing.getStatus())
                    || (existing.getStatus() != null && existing.getStatus().startsWith("PROGRESS_")))) { continue; }
            if (existing == null) {
                existing = new EnrolmentClassTaskProgressDto(); existing.setStudentUserId(studentId);
                task.getStudentProgress().add(existing);
            }
            if (!existing.isAutomatic()) { existing.setManualStatus(existing.getStatus()); }
            int percent = (int) Math.round(count * 100.0 / total);
            existing.setProgressPercent(percent);
            existing.setStatus(count >= total ? "DONE" : "PROGRESS_" + Math.max(1, Math.min(99, percent)));
            existing.setAutomatic(true); existing.setTestResultId(resultId); existing.setCompletedAt(completed.toDate());
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
