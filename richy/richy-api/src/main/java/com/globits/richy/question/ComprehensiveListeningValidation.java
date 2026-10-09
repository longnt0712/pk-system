package com.globits.richy.question;

import com.globits.richy.dto.QuestionDto;
import java.net.URI;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Validates Daily Listening packages without fetching their media URLs. */
public final class ComprehensiveListeningValidation {
    private static final Pattern GAP = Pattern.compile("\\}\\{SPACE\\}\\{", Pattern.CASE_INSENSITIVE);
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
                if (question.getSubQuestions() == null || question.getSubQuestions().isEmpty()) {
                    return "Hãy tạo ô trống cho Daily Listening trước khi xuất bản.";
                }
                String content = question.getSubQuestions().get(0).getQuestion();
                Matcher matcher = GAP.matcher(content == null ? "" : content);
                int count = 0;
                while (matcher.find()) { count++; }
                if (count != question.getSubQuestions().size()) {
                    return "Số ô trống Daily Listening phải khớp với số câu hỏi.";
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
