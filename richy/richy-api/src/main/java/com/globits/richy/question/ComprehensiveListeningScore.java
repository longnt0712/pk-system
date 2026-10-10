package com.globits.richy.question;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.QuestionAnswer;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Runtime gaps are stored together as one response for each listening section. */
public final class ComprehensiveListeningScore {
    public static final String RESPONSE = "DAILY_LISTENING_RESPONSE";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern TOKENS = Pattern.compile("\\s+|\\S+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern WORD = Pattern.compile("^([^A-Za-z0-9À-ỹ]*)((?:\\d+(?:[.,:\\-]\\d+)*)|(?:[A-Za-zÀ-ỹ][A-Za-z0-9À-ỹ'’\\-]*))([^A-Za-z0-9À-ỹ]*)$");
    private static final Pattern DATES = Pattern.compile("^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$|^(?:january|february|march|april|may|june|july|august|september|october|november|december)$", Pattern.CASE_INSENSITIVE);
    private final Map<Integer, String> eligible = new HashMap<Integer, String>();
    private final Set<Integer> required = new HashSet<Integer>();
    private int total;
    private int correct;
    private boolean valid;

    private ComprehensiveListeningScore(String transcript) {
        String text = transcript == null ? "" : transcript.replaceAll("\\r\\n?", "\n");
        Matcher tokens = TOKENS.matcher(text);
        int index = 0, ordinary = 0;
        while (tokens.find()) {
            Matcher word = WORD.matcher(tokens.group());
            if (word.matches()) {
                String answer = word.group(2);
                boolean singleUpper = answer.matches("[A-Z]");
                boolean startsLower = answer.substring(0, 1).equals(answer.substring(0, 1).toLowerCase(Locale.ROOT));
                if ((singleUpper || startsLower) && (singleUpper || answer.length() >= 2 || answer.matches("\\d"))) {
                    eligible.put(index, answer);
                    if (singleUpper || answer.matches("\\d+(?:[.,:\\-]\\d+)*") || DATES.matcher(answer).matches()) { required.add(index); }
                    else { ordinary++; }
                }
            }
            index++;
        }
        total = required.size() + (int) Math.ceil(ordinary * 0.35D);
    }

    public static boolean isResponse(QuestionAnswer answer) {
        return answer != null && answer.getQuestion() != null && answer.getQuestion().getParent() != null
                && answer.getQuestion().getParent().getType() == 18 && answer.getAnswer() != null
                && RESPONSE.equals(answer.getAnswer().getAnswer());
    }

    public static boolean hasCandidates(String transcript) { return new ComprehensiveListeningScore(transcript).total > 0; }

    public static ComprehensiveListeningScore evaluate(String transcript, String submitted) {
        ComprehensiveListeningScore score = new ComprehensiveListeningScore(transcript);
        if (score.total == 0 || submitted == null || submitted.length() > 2000000) { return score; }
        try {
            JsonNode response = JSON.readTree(submitted);
            if (response == null || !response.path("version").isIntegralNumber() || response.path("version").intValue() != 1
                    || !fingerprint(transcript).equals(response.path("source").asText())) { return score; }
            JsonNode gaps = response.path("gaps");
            if (!gaps.isArray() || gaps.size() != score.total) { return score; }
            Set<Integer> seen = new HashSet<Integer>();
            int correct = 0;
            for (JsonNode gap : gaps) {
                if (!gap.path("index").isIntegralNumber() || !gap.path("value").isTextual()) { return score; }
                int index = gap.path("index").intValue();
                if (!score.eligible.containsKey(index) || !seen.add(index)) { return score; }
                String value = normalize(gap.path("value").asText());
                if (!value.isEmpty() && value.equals(normalize(score.eligible.get(index)))) { correct++; }
            }
            if (!seen.containsAll(score.required)) { return score; }
            score.valid = true;
            score.correct = correct;
        } catch (Exception invalid) { /* Malformed snapshots never count as completed. */ }
        return score;
    }

    public static String fingerprint(String transcript) {
        String text = transcript == null ? "" : transcript;
        int hash = (int) 2166136261L;
        for (int i = 0; i < text.length(); i++) { hash = (hash ^ text.charAt(i)) * 16777619; }
        return Long.toString(Integer.toUnsignedLong(hash));
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD)
                .replaceAll("[\\u0300-\\u036f]", "")
                .replaceAll("[`~!@#$%^&£*()_|+\\-=?;:'\"“”‘’,.<>\\{\\}\\[\\]\\\\/]", "")
                .replaceAll("(?U)\\s+", " ").trim();
    }

    public int getTotal() { return total; }
    public int getCorrect() { return correct; }
    public boolean isPassed() { return valid && total > 0 && correct * 100L >= total * 90L; }
}
