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
        List<String> candidates = new ArrayList<>();
        String text = pack.getMotherTongue();
        Matcher matcher = CANDIDATE.matcher(text == null ? "" : text);
        while (matcher.find()) { candidates.add(matcher.group(1)); }
        return candidates;
    }

    private static Response parse(String value, int candidateCount) {
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
        Response response = parse(value, candidates.size());
        return response == null ? "" : candidates.get(response.candidate - 1) + " → " + response.text;
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

    private static final class Response {
        private final int candidate;
        private final String text;

        private Response(int candidate, String text) {
            this.candidate = candidate;
            this.text = text;
        }

        private String encoded() { return candidate + "|" + text; }
    }
}
