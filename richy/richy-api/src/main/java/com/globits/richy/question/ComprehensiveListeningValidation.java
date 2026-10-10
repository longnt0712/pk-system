package com.globits.richy.question;

import com.globits.richy.dto.QuestionDto;
import java.net.URI;
import java.util.Locale;
import com.globits.richy.dto.QuestionAnswerDto;

/** Validates Daily Listening packages without fetching their media URLs. */
public final class ComprehensiveListeningValidation {
    private ComprehensiveListeningValidation() { }

    public static String validate(QuestionDto root) {
        return validate(root, "COMPREHENSIVE".equals(root.getTestFormat()) && root.getStatus() == 7);
    }

    private static String validate(QuestionDto question, boolean published) {
        if (question.getType() == 18) {
            String link = question.getPronounce();
            if (link != null && !link.trim().isEmpty() && !isSupportedUrl(link.trim())) {
                return "Daily Listening cần link audio hoặc YouTube hợp lệ (http/https).";
            }
            if (published) {
                if (link == null || link.trim().isEmpty() || question.getMotherTongue() == null || question.getMotherTongue().trim().isEmpty()) {
                    return "Daily Listening cần có audio và transcript trước khi xuất bản.";
                }
                if (!ComprehensiveListeningScore.hasCandidates(question.getMotherTongue())) {
                    return "Transcript Daily Listening chưa có từ phù hợp để tạo ô trống.";
                }
                if (question.getSubQuestions() == null || question.getSubQuestions().size() != 1
                        || question.getSubQuestions().get(0).getQuestionAnswers() == null
                        || question.getSubQuestions().get(0).getQuestionAnswers().size() != 1) {
                    return "Phần Daily Listening cần một mục lưu bài làm.";
                }
                QuestionAnswerDto response = question.getSubQuestions().get(0).getQuestionAnswers().get(0);
                if (response == null || response.getAnswer() == null || !ComprehensiveListeningScore.RESPONSE.equals(response.getAnswer().getAnswer())) {
                    return "Cấu hình phần Daily Listening chưa hợp lệ.";
                }
            }
        }
        if (question.getSubQuestions() != null) {
            for (QuestionDto child : question.getSubQuestions()) {
                if (child == null) { return "Dữ liệu câu hỏi không hợp lệ."; }
                String error = validate(child, published);
                if (error != null) { return error; }
            }
        }
        return null;
    }

    public static boolean isSupportedUrl(String link) {
        if (link.length() > 2048) { return false; }
        try {
            URI uri = new URI(link);
            String host = uri.getHost(), scheme = uri.getScheme();
            if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) || host == null || uri.getUserInfo() != null) { return false; }
            host = host.toLowerCase(Locale.ROOT);
            if (host.matches("(?:.*\\.)?(?:youtube\\.com|youtube-nocookie\\.com|youtu\\.be)")) {
                return ComprehensiveVideoValidation.isSupportedUrl(link);
            }
            return !host.matches("(?:.*\\.)?tiktok\\.com");
        } catch (Exception invalid) { return false; }
    }
}
