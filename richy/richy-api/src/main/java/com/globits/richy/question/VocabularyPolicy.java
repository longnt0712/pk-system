package com.globits.richy.question;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.util.HtmlUtils;
import com.globits.security.domain.User;

/** Shared rules for manual flashcards, lesson creation and Excel imports. */
public final class VocabularyPolicy {
    public static final int WORD_LENGTH = 200;
    public static final int PRONOUNCE_LENGTH = 200;
    public static final int MEANING_LENGTH = 500;
    public static final int DESCRIPTION_LENGTH = 2000;
    private VocabularyPolicy() { }

    public static boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities() != null
            && authentication.getAuthorities().stream().anyMatch(authority -> role.equals(authority.getAuthority()));
    }
    public static User authenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof User)) {
            return null;
        }
        User user = (User) authentication.getPrincipal();
        return user.getId() == null ? null : user;
    }
    public static String role(Authentication authentication) {
        if (hasRole(authentication, "ROLE_ADMIN")) { return "ADMIN"; }
        if (hasRole(authentication, "ROLE_USER")) { return "USER"; }
        if (hasRole(authentication, "ROLE_VIEWER")) { return "VIEWER"; }
        throw new AccessDeniedException("Bạn không có quyền quản lý từ vựng.");
    }
    public static long wordLimit(Authentication authentication) {
        String role = role(authentication);
        return "ADMIN".equals(role) ? -1L : "USER".equals(role) ? 10000L : 5000L;
    }
    public static long lessonLimit(Authentication authentication) {
        String role = role(authentication);
        return "ADMIN".equals(role) ? -1L : "USER".equals(role) ? 100L : 50L;
    }
    public static String wordLimitMessage(long count, long limit) {
        return "Bạn đã có " + count + "/" + limit + " thẻ từ vựng và đã đạt hạn mức của tài khoản. "
            + "Bạn vẫn có thể sửa và học các thẻ đã có. Liên hệ quản trị viên để được hỗ trợ giải phóng hoặc nâng hạn mức trước khi thêm từ mới.";
    }
    public static String lessonLimitMessage(long count, long limit) {
        return "Bạn đã có " + count + "/" + limit + " bài từ vựng và đã đạt hạn mức của tài khoản. "
            + "Bạn vẫn có thể sửa và học các bài đã có. Liên hệ quản trị viên để được hỗ trợ giải phóng hoặc nâng hạn mức trước khi tạo bài mới.";
    }
    public static String validateText(String word, String pronounce, String meaning, String description, boolean checkDescription) {
        if (word == null || word.trim().isEmpty()) { return "Vui lòng nhập từ cần lưu."; }
        if (word.trim().length() > WORD_LENGTH) { return "Word vượt quá 200 ký tự."; }
        if (pronounce != null && pronounce.length() > PRONOUNCE_LENGTH) { return "Phiên âm vượt quá 200 ký tự."; }
        if (meaning != null && meaning.length() > MEANING_LENGTH) { return "Nghĩa tiếng Việt vượt quá 500 ký tự."; }
        if (checkDescription && descriptionLength(description) > DESCRIPTION_LENGTH) { return "Description vượt quá 2.000 ký tự nội dung."; }
        return null;
    }
    public static int descriptionLength(String html) {
        return html == null ? 0 : HtmlUtils.htmlUnescape(html.replaceAll("(?s)<[^>]*>", "")).length();
    }
}
