package com.globits.richy.attendance;

import com.globits.richy.dto.AttendanceConfigDto;
import org.joda.time.DateTimeZone;
import org.joda.time.LocalDateTime;

public final class AttendanceRules {
    public static final DateTimeZone TIME_ZONE = DateTimeZone.forID("Asia/Ho_Chi_Minh");

    private AttendanceRules() { }

    public static int minutes(String value) {
        if (value == null || !value.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) {
            throw new IllegalArgumentException("Giờ điểm danh phải có định dạng HH:mm (00:00 đến 23:59).");
        }
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(3));
    }

    public static void validate(AttendanceConfigDto config) {
        if (config == null) { throw new IllegalArgumentException("Thiếu cấu hình điểm danh."); }
        int massStart = minutes(config.getMassStartTime());
        int classStart = minutes(config.getClassStartTime());
        int switchTime = minutes(config.getQrSwitchTime());
        validateLateMinutes(config.getMassLateMinutes());
        validateLateMinutes(config.getClassLateMinutes());
        if (config.getMassAutoLate() == null || config.getClassAutoLate() == null) {
            throw new IllegalArgumentException("Vui lòng chọn bật hoặc tắt tự tính muộn cho cả Lễ và Giáo lý.");
        }
        if (massStart >= switchTime) {
            throw new IllegalArgumentException("Giờ chuyển QR phải sau giờ bắt đầu Lễ.");
        }
        if (massStart + config.getMassLateMinutes() >= 1440 || classStart + config.getClassLateMinutes() >= 1440) {
            throw new IllegalArgumentException("Mốc tính muộn phải nằm trong cùng ngày điểm danh.");
        }
        if (config.getMassAutoLate() && massStart + config.getMassLateMinutes() >= switchTime) {
            throw new IllegalArgumentException("Mốc tính muộn Lễ phải trước giờ khóa QR Lễ.");
        }
    }

    private static void validateLateMinutes(Integer value) {
        if (value == null || value < 0 || value > 1439) {
            throw new IllegalArgumentException("Số phút tính muộn phải là số nguyên từ 0 đến 1439.");
        }
    }

    public static boolean isMassOpen(AttendanceConfigDto config, LocalDateTime time) {
        return time.getHourOfDay() * 60 + time.getMinuteOfHour() < minutes(config.getQrSwitchTime());
    }

    public static int qrStatus(AttendanceConfigDto config, boolean mass, LocalDateTime time) {
        boolean autoLate = Boolean.TRUE.equals(mass ? config.getMassAutoLate() : config.getClassAutoLate());
        int threshold = minutes(mass ? config.getMassStartTime() : config.getClassStartTime())
                + (mass ? config.getMassLateMinutes() : config.getClassLateMinutes());
        return autoLate && time.getHourOfDay() * 60 + time.getMinuteOfHour() >= threshold ? 3 : 1;
    }
}
