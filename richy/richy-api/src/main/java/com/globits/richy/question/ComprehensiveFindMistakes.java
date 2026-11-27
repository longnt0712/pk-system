package com.globits.richy.question;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ComprehensiveFindMistakes {
    public static final int TYPE = 19;
    private static final Pattern CANDIDATE = Pattern.compile("\\[\\[([^\\[\\]\\r\\n]+)\\]\\]");
    private static final Pattern RESPONSE = Pattern.compile("([1-9][0-9]{0,8})\\|(.*)", Pattern.DOTALL);
    private static final Pattern WHITESPACE = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private ComprehensiveFindMistakes() {}

    public static boolean isMistakeSlot(Question question) {
        return question != null && question.getParent() != null && question.getParent().getType() == TYPE;
    }

    private static List<String> candidates(Question pack) {
        return candidates(pack.getMotherTongue());
    }

    public static List<String> candidates(String text) {
        List<String> candidates = new ArrayList<>();
        Matcher matcher = CANDIDATE.matcher(text == null ? "" : text);
        while (matcher.find()) { candidates.add(matcher.group(1)); }
        return candidates;
    }

    public static Response parse(String value, int candidateCount) {
        Matcher match = RESPONSE.matcher(value == null ? "" : value);
        if (!match.matches()) { return null; }
        int candidate = Integer.parseInt(match.group(1));
        String correction = WHITESPACE.matcher(match.group(2)).replaceAll(" ").trim();
        if (candidate > candidateCount || correction.isEmpty() || correction.length() > 200) { return null; }
        return new Response(candidate, correction);
    }

    private static Response expected(QuestionAnswer answer, int candidateCount) {
        return answer == null || !answer.isCorrect() || answer.getAnswer() == null
                ? null : parse(answer.getAnswer().getAnswer(), candidateCount);
    }

    public static boolean isCorrect(QuestionAnswer answer, String value) {
        int candidateCount = candidates(answer.getQuestion().getParent()).size();
        Response expected = expected(answer, candidateCount);
        Response submitted = parse(value, candidateCount);
        return expected != null && submitted != null && expected.candidate == submitted.candidate
                && expected.text.equals(submitted.text);
    }

    public static String describe(QuestionAnswer answer, String value) {
        List<String> candidates = candidates(answer.getQuestion().getParent());
        return describe(candidates, parse(value, candidates.size()));
    }

    public static String describe(List<String> candidates, Response response) {
        return response == null ? "" : candidates.get(response.candidate - 1) + " → " + response.text;
    }

    public static Map<Long, StudyReview> review(List<QuestionAnswer> answers, Map<Long, String> submissions) {
        List<QuestionAnswerTestResult> rows = new ArrayList<>();
        for (QuestionAnswer answer : answers) {
            QuestionAnswerTestResult row = new QuestionAnswerTestResult();
            row.setQuestionAnswer(answer);
            row.setClientAnswer(submissions.get(answer.getId()));
            rows.add(row);
        }
        alignResponses(rows);

        Map<Long, StudyReview> result = new LinkedHashMap<>();
        for (QuestionAnswerTestResult row : rows) {
            QuestionAnswer answer = row.getQuestionAnswer();
            String value = row.getClientAnswer();
            result.put(answer.getId(), new StudyReview(describe(answer, value),
                    describe(answer, answer.getAnswer().getAnswer()), isCorrect(answer, value)));
        }
        return result;
    }

    /** Associate the student's choices with the authored slots, independent of click order. */
    public static void alignResponses(Collection<QuestionAnswerTestResult> rows) {
        Map<Question, List<QuestionAnswerTestResult>> groups = new LinkedHashMap<>();
        if (rows == null) { return; }
        for (QuestionAnswerTestResult row : rows) {
            QuestionAnswer answer = row.getQuestionAnswer();
            if (answer != null && isMistakeSlot(answer.getQuestion())) {
                groups.computeIfAbsent(answer.getQuestion().getParent(), pack -> new ArrayList<>()).add(row);
            }
        }

        for (Map.Entry<Question, List<QuestionAnswerTestResult>> group : groups.entrySet()) {
            List<QuestionAnswerTestResult> slots = group.getValue();
            slots.sort(Comparator.comparingInt(row -> row.getQuestionAnswer().getQuestion().getOrdinalNumber()));
            int candidateCount = candidates(group.getKey()).size();
            Map<Integer, Response> selected = new LinkedHashMap<>();
            for (QuestionAnswerTestResult slot : slots) {
                Response response = parse(slot.getClientAnswer(), candidateCount);
                if (response != null) { selected.putIfAbsent(response.candidate, response); }
            }

            List<QuestionAnswerTestResult> unanswered = new ArrayList<>();
            for (QuestionAnswerTestResult slot : slots) {
                Response expected = expected(slot.getQuestionAnswer(), candidateCount);
                Response response = expected == null ? null : selected.remove(expected.candidate);
                slot.setClientAnswer(response == null ? "" : response.encoded());
                if (response == null) { unanswered.add(slot); }
            }
            int index = 0;
            for (Response response : selected.values()) {
                if (index >= unanswered.size()) { break; }
                unanswered.get(index++).setClientAnswer(response.encoded());
            }
        }
    }

    public static final class Response {
        private final int candidate;
        private final String text;

        private Response(int candidate, String text) {
            this.candidate = candidate;
            this.text = text;
        }

        private String encoded() { return candidate + "|" + text; }
        public int getCandidate() { return candidate; }
        public String getText() { return text; }
    }

    public static final class StudyReview {
        private final String submitted;
        private final String expected;
        private final boolean correct;

        private StudyReview(String submitted, String expected, boolean correct) {
            this.submitted = submitted;
            this.expected = expected;
            this.correct = correct;
        }

        public String getSubmitted() { return submitted; }
        public String getExpected() { return expected; }
        public boolean isCorrect() { return correct; }
    }
}
