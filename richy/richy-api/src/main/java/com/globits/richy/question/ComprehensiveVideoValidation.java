package com.globits.richy.question;

import com.globits.richy.dto.QuestionDto;
import java.net.URI;
import java.util.Locale;

/** Validates stored video metadata without fetching user supplied URLs. */
public final class ComprehensiveVideoValidation {
    private ComprehensiveVideoValidation() { }

    public static String validate(QuestionDto question) {
        Integer answerSeconds = question.getVideoAnswerSeconds();
        if (answerSeconds != null && (answerSeconds < 1 || answerSeconds > 3600)) {
            return "Thời gian trả lời câu hỏi video phải từ 1 đến 3600 giây.";
        }
        Integer seconds = question.getVideoTimeSeconds();
        if (seconds != null && (seconds < 0 || seconds > 359999)) {
            return "Mốc video phải từ 00:00 đến 99:59:59.";
        }
        String link = question.getVideoUrl();
        if (link != null && !link.trim().isEmpty() && !isSupportedUrl(link.trim())) {
            return "Link video cần là YouTube, TikTok đầy đủ hoặc file MP4/WebM/OGG (http/https).";
        }
        if (question.getSubQuestions() != null) {
            for (QuestionDto child : question.getSubQuestions()) {
                if (child == null) { return "Dữ liệu câu hỏi không hợp lệ."; }
                String error = validate(child);
                if (error != null) { return error; }
            }
        }
        if ("COMPREHENSIVE".equals(question.getTestFormat()) && question.getStatus() == 7
                && question.getSubQuestions() != null) {
            for (QuestionDto passage : question.getSubQuestions()) {
                if (passage.getVideoUrl() == null || passage.getVideoUrl().trim().isEmpty() || passage.getSubQuestions() == null) { continue; }
                for (QuestionDto pack : passage.getSubQuestions()) {
                    if (pack.getType() == 1) {
                        if (pack.getSubQuestions() != null) {
                            for (QuestionDto cue : pack.getSubQuestions()) {
                                if (cue.getVideoTimeSeconds() == null) { return "Mỗi câu hỏi video cần có mốc phút:giây trước khi xuất bản."; }
                            }
                        }
                    } else if (pack.getVideoTimeSeconds() == null) {
                        return "Mỗi nhóm câu hỏi video cần có mốc phút:giây trước khi xuất bản.";
                    }
                }
            }
        }
        return null;
    }

    public static boolean isSupportedUrl(String link) {
        if (link.length() > 2048) { return false; }
        try {
            URI uri = new URI(link);
            String scheme = uri.getScheme(), host = uri.getHost();
            if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                    || host == null || uri.getUserInfo() != null) { return false; }
            host = host.toLowerCase(Locale.ROOT);
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (host.matches("(?:www\\.|m\\.|music\\.)?youtube\\.com") || host.matches("(?:www\\.)?youtube-nocookie\\.com")) {
                if (path.matches("/(?:embed|shorts|live)/[A-Za-z0-9_-]{11}/?")) { return true; }
                String query = uri.getRawQuery();
                return "/watch".equals(path) && query != null && query.matches("(?:.*&)?v=[A-Za-z0-9_-]{11}(?:&.*)?");
            }
            if ("youtu.be".equals(host) || "www.youtu.be".equals(host)) {
                return path.matches("/[A-Za-z0-9_-]{11}/?");
            }
            if ("tiktok.com".equals(host) || "www.tiktok.com".equals(host) || "m.tiktok.com".equals(host)) {
                return path.matches("/(?:@[^/]+/video|player/v1|embed/v2)/[0-9]{10,25}/?");
            }
            return path.toLowerCase(Locale.ROOT).matches(".*\\.(mp4|webm|ogg|ogv)");
        } catch (Exception invalid) { return false; }
    }
}
