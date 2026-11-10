package com.globits.richy.question;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.QuestionAnswerTestResultDto;

public final class IeltsNumberedAnswers {
    private IeltsNumberedAnswers() { }

    public static boolean supports(Integer testType) {
        return Integer.valueOf(2).equals(testType) || Integer.valueOf(4).equals(testType);
    }

    public static boolean passes(int correct, int total) {
        return total > 0 && 100L * correct >= 85L * total;
    }

    /** A Reading or Listening slot can earn at most one mark, including after draft recovery. */
    public static List<QuestionAnswerTestResult> scoringRows(TestResult result) {
        Set<QuestionAnswerTestResult> submitted = result.getQuestionAnswerTestResult();
        if (submitted == null || submitted.isEmpty()) { return Collections.emptyList(); }
        if (!supports(result.getTestType())) { return new ArrayList<>(submitted); }

        Map<Integer, List<QuestionAnswerTestResult>> byNumber = new LinkedHashMap<>();
        List<QuestionAnswerTestResult> rows = new ArrayList<>();
        for (QuestionAnswerTestResult response : submitted) {
            if (response == null || response.getOrdinalNumber() == null) { rows.add(response); }
            else { byNumber.computeIfAbsent(response.getOrdinalNumber(), number -> new ArrayList<>()).add(response); }
        }
        if (byNumber.size() + rows.size() == submitted.size()) { return new ArrayList<>(submitted); }

        // Drafts previously copied later shared choices into the first slot. Keep
        // unambiguous slots first, then recover a different choice for any duplicate.
        Map<Object, Set<String>> usedChoices = new HashMap<>();
        for (List<QuestionAnswerTestResult> candidates : byNumber.values()) {
            if (candidates.size() == 1) {
                QuestionAnswerTestResult row = candidates.get(0);
                if (hasAnswer(row)) { reserveChoice(row, usedChoices); }
                rows.add(row);
            }
        }
        for (List<QuestionAnswerTestResult> candidates : byNumber.values()) {
            if (candidates.size() > 1) { rows.add(recoverSlot(candidates, usedChoices)); }
        }
        return rows;
    }

    private static QuestionAnswerTestResult recoverSlot(List<QuestionAnswerTestResult> candidates,
            Map<Object, Set<String>> usedChoices) {
        // Stable fallback for conflicting old snapshots, independent of correctness.
        candidates.sort(Comparator.comparing(QuestionAnswerTestResult::getId,
                Comparator.nullsLast(Comparator.reverseOrder())));
        QuestionAnswerTestResult blank = null;
        for (QuestionAnswerTestResult candidate : candidates) {
            if (hasAnswer(candidate)) {
                if (reserveChoice(candidate, usedChoices)) { return candidate; }
            } else if (blank == null) { blank = candidate; }
        }
        if (blank != null) { return blank; }
        QuestionAnswerTestResult repeated = candidates.get(0);
        blank = new QuestionAnswerTestResult();
        blank.setOrdinalNumber(repeated.getOrdinalNumber());
        blank.setQuestionAnswer(repeated.getQuestionAnswer());
        blank.setTestResult(repeated.getTestResult());
        blank.setCreateDate(repeated.getCreateDate());
        blank.setCreatedBy(repeated.getCreatedBy());
        blank.setClientAnswer("");
        return blank;
    }

    private static boolean hasAnswer(QuestionAnswerTestResult row) {
        return row.getClientAnswer() != null && !row.getClientAnswer().trim().isEmpty();
    }

    private static boolean reserveChoice(QuestionAnswerTestResult row, Map<Object, Set<String>> usedChoices) {
        QuestionAnswer answer = row.getQuestionAnswer();
        Question question = answer == null ? null : answer.getQuestion();
        Question group = question == null ? null : question.getParent();
        if (group == null || !(Integer.valueOf(5).equals(group.getType()) || Integer.valueOf(7).equals(group.getType()))) {
            return true;
        }
        Object groupKey = group.getId() == null ? group : group.getId();
        String choice = answer.getAnswer() == null ? null : answer.getAnswer().getAnswer();
        if (choice == null || choice.trim().isEmpty()) { choice = row.getClientAnswer(); }
        return usedChoices.computeIfAbsent(groupKey, key -> new HashSet<>()).add(choice.trim().toLowerCase(Locale.ROOT));
    }

    public static String correctedStatus(TestResult result, int correct, int total) {
        String stored = result.getResultStatus();
        if (!supports(result.getTestType()) || result.getQuestionAnswerTestResult() == null
                || result.getQuestionAnswerTestResult().size() == total
                || !("SUCCESS".equals(stored) || "FAILED".equals(stored))) { return stored; }
        return passes(correct, total) ? "SUCCESS" : "FAILED";
    }

    public static int completionAdjustment(TestResult result) {
        List<QuestionAnswerTestResult> rows = scoringRows(result);
        int correct = 0;
        for (QuestionAnswerTestResult row : rows) {
            if (Boolean.TRUE.equals(new QuestionAnswerTestResultDto(row).getIsCorrectTestResultDetail())) { correct++; }
        }
        boolean wasComplete = "SUCCESS".equals(result.getResultStatus());
        boolean isComplete = "SUCCESS".equals(correctedStatus(result, correct, rows.size()));
        return (isComplete ? 1 : 0) - (wasComplete ? 1 : 0);
    }
}
