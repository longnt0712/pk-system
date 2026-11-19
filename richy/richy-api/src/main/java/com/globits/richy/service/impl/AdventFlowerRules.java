package com.globits.richy.service.impl;

import java.text.Normalizer;
import java.util.Locale;
import com.globits.richy.domain.Campaign;

final class AdventFlowerRules {
    static final String PRAYER_KEY = "advent-weekly-prayer";
    static final String MASS_BONUS_KEY = "advent-mass-bonus";
    static final int PRAYER_WORD_LIMIT = 25;
    static final int PRAYER_CHARACTER_LIMIT = 120;

    private AdventFlowerRules() { }

    static String nameKey(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('đ', 'd').replaceAll("\\s+", " ").trim();
    }

    static boolean matches(Campaign campaign) {
        return "2026-11-29".equals(campaign.getStartDate()) && "2027-01-03".equals(campaign.getEndDate()) &&
                nameKey(campaign.getName()).matches(".*\\bmua vong\\b.*\\bgiang sinh\\b.*");
    }

    static boolean isMass(String name) {
        String key = nameKey(name);
        return "tham du thanh le".equals(key) || "thanh le".equals(key);
    }

    static String lastPracticeDate(Campaign campaign) {
        return matches(campaign) ? "2027-01-02" : campaign.getEndDate();
    }

    static String prayerText(String value) {
        String text = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC)
                .replaceAll("[\\s\\p{Z}]+", " ").trim();
        if (text.length() > PRAYER_CHARACTER_LIMIT || (!text.isEmpty() && text.split(" ").length > PRAYER_WORD_LIMIT) ||
                text.chars().anyMatch(Character::isISOControl)) {
            throw new CampaignService.InvalidCampaignException("Lời nguyện tối đa 25 từ và 120 ký tự để vừa ba dòng trên phiếu.");
        }
        return text;
    }
}
