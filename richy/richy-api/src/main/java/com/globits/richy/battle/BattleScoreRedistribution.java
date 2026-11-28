package com.globits.richy.battle;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

public final class BattleScoreRedistribution {
    public static final String SKILL_TYPE = "REDISTRIBUTE_SCORE";
    private static final int FREEZE_RATE_TENTHS = 7;
    public static final double FREEZE_RATE_RATIO = FREEZE_RATE_TENTHS / 10D;

    private BattleScoreRedistribution() {}

    public static int skillCount(int freezeCount, Random random) {
        int tenths = freezeCount * FREEZE_RATE_TENTHS;
        int remainder = tenths % 10;
        return tenths / 10 + (remainder > 0 && random.nextInt(10) < remainder ? 1 : 0);
    }

    /** Scores are in leaderboard order. Deltas are whole points and sum to zero. */
    public static <T> Map<T, Integer> calculate(Map<T, Double> rankedScores) {
        Map<T, Integer> changes = new LinkedHashMap<>();
        List<Map.Entry<T, Double>> ranking = new ArrayList<>(rankedScores.entrySet());
        int size = ranking.size();
        if (size < 2) { return changes; }
        int groupSize = Math.max(1, size / 4);
        double highestRecipientScore = Double.NEGATIVE_INFINITY;
        for (int i = size - groupSize; i < size; i++) {
            highestRecipientScore = Math.max(highestRecipientScore, ranking.get(i).getValue());
        }
        int pool = 0;
        for (int i = 0; i < groupSize; i++) {
            Map.Entry<T, Double> donor = ranking.get(i);
            if (donor.getValue() <= highestRecipientScore) { continue; }
            int points = (int) Math.round(Math.max(0D, donor.getValue()) * 0.05D);
            if (points > 0) {
                changes.put(donor.getKey(), -points);
                pool += points;
            }
        }
        if (pool == 0) { return changes; }
        for (int i = 0; i < groupSize; i++) {
            int points = pool / groupSize + (i < pool % groupSize ? 1 : 0);
            if (points > 0) { changes.put(ranking.get(size - 1 - i).getKey(), points); }
        }
        return changes;
    }

    public static int transferredPoints(Map<?, Integer> changes) {
        return changes.values().stream().filter(delta -> delta > 0).mapToInt(Integer::intValue).sum();
    }
}
