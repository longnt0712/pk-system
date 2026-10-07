package com.globits.richy.battle;

import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.util.HtmlUtils;

/** One child question per game turn, including its passage and original answer bank. */
public final class BattleExerciseQuestions {
    private BattleExerciseQuestions() {}

    public static class Turn {
        public Long id;
        public Long sourceTestId;
        public String sourceTestTitle;
        public String prompt;
        public BattleOnlineExerciseDto content;
        private final Map<String, Set<String>> correct = new LinkedHashMap<String, Set<String>>();
        private final Map<String, List<String>> correctTexts = new LinkedHashMap<String, List<String>>();

        public String correctSummary() {
            if (content.minimumWords > 0) { return "Bài viết trên " + content.minimumWords + " từ"; }
            List<String> rows = new ArrayList<String>();
            for (BattleOnlineExerciseDto.Item item : content.items) {
                rows.add((item.number == null ? "" : item.number + ": ") + String.join(" / ", correctTexts.get(item.id)));
            }
            return String.join("; ", rows);
        }

        public boolean grade(Map<String, List<String>> submitted) {
            if (submitted == null || submitted.size() != content.items.size()) { return false; }
            for (BattleOnlineExerciseDto.Item item : content.items) {
                List<String> values = submitted.get(item.id);
                if (values == null || values.isEmpty() || values.size() > 100) { return false; }
                if ("WRITING".equals(content.answerMode)) {
                    if (values.size() != 1 || plain(values.get(0)).split("\\s+").length <= content.minimumWords) { return false; }
                } else if ("TEXT".equals(content.answerMode)) {
                    if (values.size() != 1 || !correct.get(item.id).contains(normalize(values.get(0)))) { return false; }
                } else {
                    Set<String> selected = new LinkedHashSet<String>(values);
                    if (selected.size() != values.size() || !selected.equals(correct.get(item.id))) { return false; }
                }
            }
            return true;
        }
    }

    public static List<Turn> fromTest(QuestionDto test) {
        return fromTest(test, new Random());
    }

    static List<Turn> fromTest(QuestionDto test, Random random) {
        List<Turn> turns = new ArrayList<Turn>();
        if (test == null || !"COMPREHENSIVE".equals(test.getTestFormat()) ||
                test.getQuestionType() == null || !Long.valueOf(11).equals(test.getQuestionType().getId())) {
            throw invalid("Hãy chọn đúng đề bài tập tổng hợp.");
        }
        for (QuestionDto part : children(test)) {
            for (QuestionDto group : children(part)) {
                List<QuestionDto> questions = children(group);
                if ((group.getType() == 16 || group.getType() == 17) && questions.isEmpty()) {
                    questions = Collections.singletonList(group);
                }
                if (questions.isEmpty()) { throw invalid("Có nhóm chưa có câu hỏi hoặc đáp án."); }
                for (int q = 0; q < questions.size(); q++) {
                    Turn turn = build(group, questions.get(q), part.getQuestion(), q, questions.get(0).getQuestion(), random);
                    turn.sourceTestId = test.getId(); turn.sourceTestTitle = test.getTitle(); turns.add(turn);
                }
            }
        }
        if (turns.isEmpty()) { throw invalid("Đề tổng hợp chưa có câu hỏi."); }
        return turns;
    }

    private static Turn build(QuestionDto group, QuestionDto source, String passage, int questionIndex, String sharedContent, Random random) {
        Turn turn = new Turn();
        turn.id = source.getId();
        if (turn.id == null) { throw invalid("Có câu hỏi chưa được lưu."); }
        int type = group.getType();
        String mode;
        switch (type) {
            case 2: case 3: case 8: case 11: mode = "TEXT"; break;
            case 5: case 7: mode = "MULTIPLE"; break;
            case 4: case 10: case 13: case 14: case 15: mode = "MATCH"; break;
            case 16: case 17: mode = "WRITING"; break;
            case 1: case 6: case 9: case 12: mode = "SINGLE"; break;
            default: throw invalid("Dạng câu hỏi " + type + " chưa được hỗ trợ trong Battle.");
        }
        BattleOnlineExerciseDto content = new BattleOnlineExerciseDto();
        turn.content = content;
        content.type = type; content.answerMode = mode; content.title = group.getTitle();
        content.passageHtml = passage; content.instructionsHtml = group.getQuestion();
        content.minimumWords = type == 16 ? 150 : type == 17 ? 250 : 0;
        if (type == 11 || type == 13) { content.contentHtml = sharedContent; }
        BattleOnlineExerciseDto.Item item = new BattleOnlineExerciseDto.Item();
        item.id = String.valueOf(source.getId()); item.number = source.getOrdinalNumber(); item.promptHtml = source.getQuestion();
        if (type == 4 || type == 11 || type == 13) { item.gapIndex = questionIndex; }
        Set<String> expected = new LinkedHashSet<String>();
        List<String> texts = new ArrayList<String>();
        List<QuestionAnswerDto> answers = new ArrayList<QuestionAnswerDto>(source.getQuestionAnswers() == null
                ? Collections.<QuestionAnswerDto>emptyList() : source.getQuestionAnswers());
        Collections.sort(answers, Comparator.comparingInt(a -> a.getOrdinalNumberQuestionAnswer() == null
                ? Integer.MAX_VALUE : a.getOrdinalNumberQuestionAnswer()));
        if ("SINGLE".equals(mode) || "MULTIPLE".equals(mode)) { Collections.shuffle(answers, random); }
        for (int a = 0; a < answers.size(); a++) {
            QuestionAnswerDto answer = answers.get(a);
            String text = answer.getAnswer() == null ? "" : plain(answer.getAnswer().getAnswer());
            String key = String.valueOf(a + 1);
            if (!"TEXT".equals(mode) && text.isEmpty() && answer.getAnswer() != null &&
                    answer.getAnswer().getAnswer() != null && !answer.getAnswer().getAnswer().trim().isEmpty()) {
                text = "Đáp án " + key;
            }
            if (!"TEXT".equals(mode) && !"WRITING".equals(mode)) {
                item.options.add(new BattleOnlineExerciseDto.Option(key, text, answer.getAnswer() == null ? "" : answer.getAnswer().getAnswer()));
            }
            if (answer.isCorrect() && !text.isEmpty()) {
                expected.add("TEXT".equals(mode) ? normalize(text) : key); texts.add(text);
            }
        }
        if (!"WRITING".equals(mode) && expected.isEmpty()) { throw invalid("Câu " + item.number + " chưa có đáp án đúng."); }
        if (!"TEXT".equals(mode) && !"MULTIPLE".equals(mode) && !"WRITING".equals(mode) && expected.size() != 1) {
            throw invalid("Câu " + item.number + " cần đúng một đáp án.");
        }
        content.items.add(item); turn.correct.put(item.id, expected); turn.correctTexts.put(item.id, texts);
        turn.prompt = plain(source.getQuestion());
        if (turn.prompt.isEmpty() || type == 11 || type == 13) {
            turn.prompt = "Câu hỏi " + (item.number == null ? "" : item.number);
        }
        return turn;
    }

    private static List<QuestionDto> children(QuestionDto node) {
        List<QuestionDto> result = new ArrayList<QuestionDto>(node.getSubQuestions() == null ? Collections.<QuestionDto>emptyList() : node.getSubQuestions());
        Collections.sort(result, Comparator.comparingInt(q -> q.getOrdinalNumber() == null ? Integer.MAX_VALUE : q.getOrdinalNumber()));
        return result;
    }
    public static String plain(String value) {
        return HtmlUtils.htmlUnescape(value == null ? "" : value.replaceAll("<[^>]*>", " ")).replace('\u00a0', ' ').trim().replaceAll("\\s+", " ");
    }
    private static String normalize(String value) { return plain(value).toLowerCase(Locale.ROOT).replace('\u2019', '\''); }
    private static BattleOnlineException invalid(String message) { return new BattleOnlineException(HttpStatus.BAD_REQUEST, message); }
}
