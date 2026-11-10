package com.globits.richy.service.impl;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.ComprehensiveAssignmentSectionDto;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.question.IeltsNumberedAnswers;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.joda.time.LocalDateTime;

/** Teacher review only: retain failed scores without changing successful-attempt evidence. */
public final class HomeworkTestScore {
    private HomeworkTestScore() { }

    public static boolean enabled(EnrolmentClassScheduleTaskDto task) {
        return task.getId() != null && HomeworkTopicCompletion.ieltsEnabled(task)
                && !"IELTS_WRITING".equals(task.getActivityType());
    }

    public static void apply(EnrolmentClassScheduleTaskDto task, List<TestResult> results,
            LocalDateTime start, LocalDateTime end) {
        if (!enabled(task) || results == null) { return; }
        List<String> units = new ArrayList<String>();
        boolean sections = HomeworkTopicCompletion.hasComprehensiveSections(task);
        if (sections) {
            for (ComprehensiveAssignmentSectionDto section : task.getComprehensiveSections()) { units.add(section.getKey()); }
        } else {
            for (Integer part : task.getIeltsParts()) { units.add(part.toString()); }
        }
        Map<Long, Map<String, List<Double>>> scores = new LinkedHashMap<Long, Map<String, List<Double>>>();
        Map<Long, TestResult> evidence = new LinkedHashMap<Long, TestResult>();
        Set<Long> seen = new HashSet<Long>();
        for (TestResult result : results) {
            if (result == null || result.getId() == null || result.getUser() == null || result.getUser().getId() == null
                    || !task.getId().equals(result.getAssignmentTaskId()) || !task.getIeltsTestId().equals(result.getSourceQuestionId())
                    || !Integer.valueOf(HomeworkTopicCompletion.ieltsTestType(task)).equals(result.getTestType())
                    || !("SUCCESS".equals(result.getResultStatus()) || "FAILED".equals(result.getResultStatus()))
                    || result.getCreateDate() == null || result.getCreateDate().isBefore(start) || !result.getCreateDate().isBefore(end)
                    || (sections ? !units.contains(result.getAssignmentSectionKey()) : result.getAssignmentSectionKey() != null)
                    || !seen.add(result.getId())) { continue; }
            Map<String, int[]> counts = new LinkedHashMap<String, int[]>();
            for (QuestionAnswerTestResult response : IeltsNumberedAnswers.scoringRows(result)) {
                if (response == null) { continue; }
                String unit = sections ? result.getAssignmentSectionKey() : partOf(response, result);
                if (!units.contains(unit)) { continue; }
                QuestionAnswerTestResultDto scored = new QuestionAnswerTestResultDto(response);
                Question question = response.getQuestionAnswer() == null ? null : response.getQuestionAnswer().getQuestion();
                Integer type = question == null || question.getParent() == null ? null : question.getParent().getType();
                // Writing uses its own word requirements, not the objective-score denominator.
                if (Integer.valueOf(16).equals(type) || Integer.valueOf(17).equals(type)) { continue; }
                int[] count = counts.get(unit);
                if (count == null) { count = new int[2]; counts.put(unit, count); }
                if (scored.getListeningTotalGaps() != null) {
                    count[0] += scored.getListeningCorrectGaps(); count[1] += scored.getListeningTotalGaps();
                } else {
                    if (Boolean.TRUE.equals(scored.getIsCorrectTestResultDetail())) { count[0]++; }
                    count[1]++;
                }
            }
            Long student = result.getUser().getId();
            for (Map.Entry<String, int[]> entry : counts.entrySet()) {
                if (entry.getValue()[1] == 0) { continue; }
                Map<String, List<Double>> byUnit = scores.get(student);
                if (byUnit == null) { byUnit = new LinkedHashMap<String, List<Double>>(); scores.put(student, byUnit); }
                List<Double> attempts = byUnit.get(entry.getKey());
                if (attempts == null) { attempts = new ArrayList<Double>(); byUnit.put(entry.getKey(), attempts); }
                attempts.add(entry.getValue()[0] * 100D / entry.getValue()[1]);
                evidence.put(student, result);
            }
        }
        for (Map.Entry<Long, Map<String, List<Double>>> student : scores.entrySet()) {
            EnrolmentClassTaskProgressDto progress = null;
            for (EnrolmentClassTaskProgressDto candidate : task.getStudentProgress()) {
                if (student.getKey().equals(candidate.getStudentUserId())) { progress = candidate; break; }
            }
            if (progress != null && !progress.isAutomatic() && progress.getStatus() != null
                    && !"TODO".equals(progress.getStatus())) { continue; }
            if (progress == null) {
                progress = new EnrolmentClassTaskProgressDto(); progress.setStudentUserId(student.getKey());
                task.getStudentProgress().add(progress);
            }
            if (!progress.isAutomatic()) { progress.setManualStatus(progress.getStatus()); }
            double total = 0;
            int required = task.getRequiredAttempts();
            for (List<Double> attempts : student.getValue().values()) {
                Collections.sort(attempts, Collections.reverseOrder());
                for (int i = 0; i < Math.min(required, attempts.size()); i++) { total += attempts.get(i); }
            }
            // Unattempted parts/repeats contribute zero; retries retain the best results.
            double percent = total / (units.size() * required);
            progress.setResultPercent(percent);
            progress.setProgressPercent((int) Math.floor(percent));
            progress.setStatus(percent >= 85 ? "DONE" : percent <= 40 ? "TODO" : "PROGRESS_" + (int) Math.floor(percent));
            progress.setAutomatic(true);
            progress.setTestResultId(evidence.get(student.getKey()).getId());
            progress.setCompletedAt(evidence.get(student.getKey()).getCreateDate().toDate());
        }
    }

    private static String partOf(QuestionAnswerTestResult response, TestResult result) {
        if (response == null) { return null; }
        Question question = response.getQuestionAnswer() == null ? null : response.getQuestionAnswer().getQuestion();
        Set<Question> visited = new HashSet<Question>();
        while (question != null && visited.add(question)) {
            if (question.getParent() != null && result.getSourceQuestionId().equals(question.getParent().getId())
                    && question.getOrdinalNumber() != null && result.getCompletedParts().contains(question.getOrdinalNumber())) {
                return question.getOrdinalNumber().toString();
            }
            question = question.getParent();
        }
        return result.getCompletedParts().size() == 1 ? result.getCompletedParts().get(0).toString() : null;
    }
}
