package com.globits.richy.service.impl;

import com.globits.richy.domain.SpeakingRecording;
import com.globits.security.domain.User;
import java.time.Clock;
import java.util.Map;
import java.util.TimeZone;
import org.joda.time.DateTimeZone;
import org.joda.time.LocalDateTime;

/** Audio expires independently of practice completion, uploads, or playback. */
public final class SpeakingRecordingPolicy {
    public static final int RETENTION_DAYS = 3;
    public static final int RECORDING_LIMIT = 10;
    private SpeakingRecordingPolicy() {}

    public static LocalDateTime now(Clock clock) {
        return new LocalDateTime(clock.millis(), DateTimeZone.forTimeZone(TimeZone.getTimeZone(clock.getZone())));
    }

    public static LocalDateTime expiresAt(SpeakingRecording recording) {
        return recording.getCreateDate() == null ? null : recording.getCreateDate().plusDays(RETENTION_DAYS);
    }

    public static boolean expired(SpeakingRecording recording, LocalDateTime now) {
        LocalDateTime expiry = expiresAt(recording);
        return expiry != null && !expiry.isAfter(now);
    }

    public static void requireAvailable(SpeakingRecording recording, LocalDateTime now) {
        if (expired(recording, now)) { throw new Expired(); }
    }

    public static boolean isAdmin(User user) {
        return user != null && user.getRoles() != null && user.getRoles().stream()
            .anyMatch(role -> role != null && "ROLE_ADMIN".equals(role.getName()));
    }

    public static final class Expired extends IllegalArgumentException {
        public Expired() { super("Bản ghi âm đã hết hạn lưu 3 ngày và không thể tải lại hoặc nghe lại."); }
    }

    public static final class Limit extends IllegalArgumentException {
        private final Map<String, Object> quota;
        public Limit(Map<String, Object> quota) {
            super("Bạn đã gửi đủ 10 bản ghi âm trong 3 ngày gần nhất. Hãy chờ đến khi có lượt mới.");
            this.quota = quota;
        }
        public Map<String, Object> getQuota() { return quota; }
    }
}
