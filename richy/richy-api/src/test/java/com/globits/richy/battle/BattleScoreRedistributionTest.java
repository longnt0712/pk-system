package com.globits.richy.battle;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;

public class BattleScoreRedistributionTest {
    private Map<Integer, Double> ranked(double... scores) {
        Map<Integer, Double> ranking = new LinkedHashMap<>();
        for (int index = 0; index < scores.length; index++) { ranking.put(index + 1, scores[index]); }
        return ranking;
    }

    @Test public void usesBothQuartilesAndSendsRemainderToTheLowestRank() {
        Map<Integer, Integer> changes = BattleScoreRedistribution.calculate(ranked(120, 100, 90, 80, 70, 60, 30, 20));
        assertEquals(4, changes.size());
        assertEquals(Integer.valueOf(-6), changes.get(1));
        assertEquals(Integer.valueOf(-5), changes.get(2));
        assertEquals(Integer.valueOf(5), changes.get(7));
        assertEquals(Integer.valueOf(6), changes.get(8));
        assertEquals(0, changes.values().stream().mapToInt(Integer::intValue).sum());
    }

    @Test public void handlesDuelSmallScoresAndTies() {
        assertTrue(BattleScoreRedistribution.calculate(ranked(50)).isEmpty());
        assertTrue(BattleScoreRedistribution.calculate(ranked(200, 200)).isEmpty());
        assertTrue(BattleScoreRedistribution.calculate(ranked(9, 1)).isEmpty());
        assertEquals(2, BattleScoreRedistribution.transferredPoints(BattleScoreRedistribution.calculate(ranked(31, 8))));
        Map<Integer, Integer> changes = BattleScoreRedistribution.calculate(ranked(100, 40, 40, 40, 40, 40, 40, 40));
        assertFalse(changes.containsKey(2));
        assertEquals(5, BattleScoreRedistribution.transferredPoints(changes));
    }

    @Test public void stochasticRoundingKeepsSeventyPercentEvenForOneFreezeSlot() {
        int total = 0;
        for (int ticket = 0; ticket < 10; ticket++) {
            final int fixed = ticket;
            total += BattleScoreRedistribution.skillCount(1, new Random() {
                @Override public int nextInt(int bound) { return fixed; }
            });
        }
        assertEquals(7, total);
        assertEquals(7, BattleScoreRedistribution.skillCount(10, new Random(1)));
    }

    @Test public void eggsAreWeightedRelativeToFreezeAndHaveAnOrdinaryFallback() {
        int[] ticket = {0};
        GiftDropGame game = new GiftDropGame(10, new Random() {
            @Override public int nextInt(int bound) { return ticket[0]; }
        }, Arrays.asList("FREEZE", BattleScoreRedistribution.SKILL_TYPE));
        long now = System.currentTimeMillis();
        int[] weights = ReflectionTestUtils.invokeMethod(game, "weightsForEffects", false, false, 0, now);
        assertEquals(weights[0] * 0.7D, weights[1], 2D);
        ticket[0] = weights[0];
        String eligible = game.snapshot("eligible").gifts.get(0).id;
        String tied = game.snapshot("tied").gifts.get(0).id;
        assertEquals(BattleScoreRedistribution.SKILL_TYPE, game.claim("eligible", eligible, false, now, true).skillType);
        GiftDropGame.Gift fallback = game.claim("tied", tied, false, now, false);
        assertNull(fallback.skillType);
        assertTrue(fallback.points > 0D);
    }

    @Test @SuppressWarnings("unchecked") public void demonDefenseTransfersRankingPointsWithoutChangingLaneProgress() {
        Map<Integer, Integer> members = new LinkedHashMap<>();
        members.put(1, 2); members.put(2, 1);
        DemonDefenseGame game = new DemonDefenseGame(1000L, members);
        Map<Integer, Object> teams = (Map<Integer, Object>) ReflectionTestUtils.getField(game, "teams");
        ReflectionTestUtils.setField(teams.get(1), "points", 120);
        ReflectionTestUtils.setField(teams.get(1), "levelPoints", 35);
        ReflectionTestUtils.setField(teams.get(2), "points", 10);
        assertEquals(6, game.redistributeTeamScores(2000L, false));
        assertEquals(120, game.snapshot(2000L, false).teams.get(0).points);
        assertEquals(6, game.redistributeTeamScores(2000L, true));
        DemonDefenseGame.Snapshot score = game.snapshot(2000L, false);
        assertEquals(114, score.teams.get(0).points);
        assertEquals(16, score.teams.get(1).points);
        assertEquals(35, score.teams.get(0).levelPoints);
    }
}
