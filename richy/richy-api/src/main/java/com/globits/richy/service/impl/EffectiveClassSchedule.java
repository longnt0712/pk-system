package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Date-level plans plus weekly recurrence, with moved source dates explicitly excluded. */
final class EffectiveClassSchedule {
    static final class Slot {
        final String date, startTime, endTime;
        Slot(String date, String start, String end) { this.date = date; startTime = start; endTime = end; }
        String deadline() { return endTime == null ? null : date + "T" + endTime; }
    }
    private final List<Object[]> weekly;
    private final Map<String, Object[]> days = new TreeMap<String, Object[]>();
    EffectiveClassSchedule(List<Object[]> weekly, List<Object[]> timeline) {
        this.weekly = weekly;
        for (Object[] row : timeline) { days.put((String) row[0], row); }
    }
    boolean cancelled(String date) { return days.containsKey(date) && days.get(date)[3] != null; }
    int weeklyCount(String date) {
        int count = 0, weekday = LocalDate.parse(date).getDayOfWeek().getValue();
        for (Object[] row : weekly) { if (((Number) row[0]).intValue() == weekday) { count++; } }
        return count;
    }
    Slot on(String date) {
        if (cancelled(date)) { return null; }
        String start = null, end = null;
        int weekday = LocalDate.parse(date).getDayOfWeek().getValue();
        for (Object[] row : weekly) {
            if (((Number) row[0]).intValue() != weekday) { continue; }
            String s = (String) row[1], e = (String) row[2];
            if (s != null && (start == null || s.compareTo(start) < 0)) { start = s; }
            if (e != null && (end == null || e.compareTo(end) > 0)) { end = e; }
        }
        Object[] saved = days.get(date);
        if (saved != null) {
            if (saved[1] != null) { start = (String) saved[1]; }
            if (saved[2] != null) { end = (String) saved[2]; }
        }
        return start == null && end == null && saved == null ? null : new Slot(date, start, end);
    }
    Slot next(String date) { return adjacent(date, 1); }
    Slot previous(String date) { return adjacent(date, -1); }
    private Slot adjacent(String date, int direction) {
        String best = null;
        for (String candidate : days.keySet()) {
            int comparison = candidate.compareTo(date);
            if (cancelled(candidate) || (direction > 0 ? comparison <= 0 : comparison >= 0)) { continue; }
            if (best == null || (direction > 0 ? candidate.compareTo(best) < 0 : candidate.compareTo(best) > 0)) { best = candidate; }
        }
        // Each skipped occurrence needs a persisted marker; this bound handles arbitrarily many moves.
        if (!weekly.isEmpty()) {
            LocalDate cursor = LocalDate.parse(date);
            for (int i = 0; i < 7L * (days.size() + 1L); i++) {
                cursor = cursor.plusDays(direction);
                String candidate = cursor.toString();
                if (best != null && (direction > 0 ? candidate.compareTo(best) >= 0 : candidate.compareTo(best) <= 0)) { break; }
                if (!cancelled(candidate) && weeklyCount(candidate) > 0) { best = candidate; break; }
            }
        }
        return best == null ? null : on(best);
    }
}
