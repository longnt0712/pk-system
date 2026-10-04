package com.globits.richy.battle;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

public class DemonDefenseGameTest {
    private static final long START = 1000000L;
    private DemonDefenseGame game(int members) {
        Map<Integer, Integer> teams = new LinkedHashMap<Integer, Integer>();
        teams.put(1, members); teams.put(2, members);
        return new DemonDefenseGame(START, teams);
    }
    private DemonDefenseGame.Team team(DemonDefenseGame game, int number, long elapsed, boolean arena) {
        for (DemonDefenseGame.Team team : game.snapshot(START + elapsed, arena).teams) {
            if (team.number == number) { return team; }
        }
        throw new AssertionError("Missing team");
    }

    @Test public void bulletThresholdsAndFivePointBreakAreExact() {
        int[] streaks = {0, 1, 10, 19, 20, 29, 30, 39, 40, 99};
        int[] bullets = {1, 1, 1, 1, 2, 2, 3, 3, 4, 9};
        for (int i = 0; i < streaks.length; i++) { assertEquals(bullets[i], DemonDefenseGame.bulletsForStreak(streaks[i])); }
        assertEquals(30, DemonDefenseGame.breakStreak(35));
        assertEquals(15, DemonDefenseGame.breakStreak(20));
        assertEquals(4, DemonDefenseGame.breakStreak(9));
        assertEquals(0, DemonDefenseGame.breakStreak(5));
        assertEquals(0, DemonDefenseGame.breakStreak(3));
        assertEquals(0, DemonDefenseGame.breakStreak(0));
    }

    private DemonDefenseGame toughAtFront() {
        DemonDefenseGame game = game(3);
        // The eleventh spawn is tough. Clear its ten predecessors with real bullets.
        assertEquals(10, game.shoot(1, "alice", 100, START + 24000).kills);
        DemonDefenseGame.Team team = team(game, 1, 24000, true);
        assertEquals(1, team.demons.size());
        assertTrue(team.demons.get(0).tough);
        assertFalse(team.demons.get(0).fast);
        assertEquals(2, team.demons.get(0).health);
        return game;
    }

    @Test public void toughDemonKeepsMovingAfterFirstHitAndTeammateCanFinishIt() {
        DemonDefenseGame game = toughAtFront();
        DemonDefenseGame.Demon before = team(game, 1, 24000, true).demons.get(0);
        DemonDefenseGame.ShotResult first = game.shoot(1, "alice", 1, START + 24000);
        assertEquals(1, first.hits); assertEquals(0, first.kills); assertFalse(first.rescued);
        game.advance(START + 25000);
        DemonDefenseGame.Demon wounded = team(game, 1, 25000, true).demons.get(0);
        assertEquals(before.id, wounded.id); assertEquals(1, wounded.health);
        assertTrue(wounded.progress > before.progress);
        assertEquals(10, team(game, 1, 25000, true).kills);
        DemonDefenseGame.ShotResult second = game.shoot(1, "bob", 1, START + 25000);
        assertEquals(1, second.hits); assertEquals(1, second.kills);
        assertEquals(11, team(game, 1, 25000, true).kills);
        for (DemonDefenseGame.Demon demon : team(game, 1, 25000, true).demons) { assertNotEquals(before.id, demon.id); }
    }

    @Test public void twoBulletBurstKillsOneToughDemonAndCountsBothHits() {
        DemonDefenseGame game = toughAtFront();
        DemonDefenseGame.ShotResult burst = game.shoot(1, "alice", 20, START + 24000);
        assertEquals(2, burst.bullets); assertEquals(2, burst.hits); assertEquals(1, burst.kills);
        assertTrue(team(game, 1, 24000, true).demons.isEmpty());
        assertEquals(11, team(game, 1, 24000, true).kills);
    }

    @Test public void concurrentStudentsKillDifferentNearestDemons() {
        DemonDefenseGame game = game(3);
        game.advance(START + 24000L);
        DemonDefenseGame.Team before = team(game, 1, 24000, true);
        long nearestId = 0;
        double nearestProgress = -1;
        for (DemonDefenseGame.Demon demon : before.demons) {
            if (demon.progress > nearestProgress) { nearestId = demon.id; nearestProgress = demon.progress; }
        }
        assertTrue(before.demons.size() >= 4);
        assertEquals(1, game.shoot(1, "alice", 19, START + 24000).kills);
        for (DemonDefenseGame.Demon demon : team(game, 1, 24000, true).demons) { assertNotEquals(nearestId, demon.id); }
        assertEquals(3, game.shoot(1, "bob", 30, START + 24000).kills);
        assertEquals(before.demons.size() - 4, team(game, 1, 24000, true).demons.size());
        assertEquals(4, team(game, 1, 24000, true).kills);
        assertEquals(0, team(game, 2, 24000, true).kills);
    }

    @Test public void tickingFrequencyDoesNotChangeSpawnsOrCollisions() {
        DemonDefenseGame regular = game(2), delayed = game(2);
        for (long at = 500; at <= 25000; at += 500) { regular.advance(START + at); }
        delayed.advance(START + 25000);
        assertEquals(team(regular, 1, 25000, true).demons.size(), team(delayed, 1, 25000, true).demons.size());
        for (long at = 25500; at <= 45000; at += 500) { regular.advance(START + at); }
        delayed.advance(START + 45000);
        assertEquals(team(regular, 1, 45000, true).eliminatedAt, team(delayed, 1, 45000, true).eliminatedAt);
        assertEquals(team(regular, 1, 45000, true).demons.size(), team(delayed, 1, 45000, true).demons.size());
    }

    @Test public void simultaneousCollisionsTieAndDeadTeamsCannotShoot() {
        DemonDefenseGame game = game(1);
        game.advance(START + 30000);
        assertTrue(game.isFinished());
        assertEquals(0, game.livingTeams());
        assertEquals(START + 29000, team(game, 1, 30000, true).eliminatedAt);
        assertEquals(6, team(game, 1, 30000, true).demons.size());
        assertEquals(1, team(game, 1, 30000, true).rank);
        assertEquals(1, team(game, 2, 30000, true).rank);
        assertEquals(0, game.shoot(1, "late", 30, START + 30001).kills);
    }

    @Test public void wavesWarnBeforeHordeAndFastDemonsStillDieInOneBullet() {
        DemonDefenseGame game = game(3);
        game.advance(START + 21000);
        assertEquals("WARNING", game.snapshot(START + 21000, false).phase);
        assertEquals(2, game.snapshot(START + 21000, false).warningSeconds);
        game.advance(START + 24000);
        assertEquals("HORDE", game.snapshot(START + 24000, false).phase);
        boolean fast = false;
        for (DemonDefenseGame.Demon demon : team(game, 1, 24000, true).demons) { fast |= demon.fast; }
        assertTrue(fast);
        for (int i = 0; i < 20; i++) { game.shoot(1, "alice", 1, START + 24000); }
        assertTrue(team(game, 1, 24000, true).demons.isEmpty());
        assertEquals("REST", game.snapshot(START + 28000, false).phase);
    }

    @Test public void lateKillCreditsRescueAndStudentPayloadOmitsAnimation() {
        DemonDefenseGame game = game(1);
        assertTrue(game.shoot(1, "hero", 20, START + 26000).rescued);
        assertEquals("hero", team(game, 1, 26000, true).rescueUsername);
        assertFalse(team(game, 1, 26000, true).shots.isEmpty());
        assertTrue(team(game, 1, 26000, false).shots.isEmpty());
        assertTrue(team(game, 1, 26000, false).demons.isEmpty());
        assertEquals(team(game, 1, 26000, true).kills, team(game, 1, 26000, false).kills);
    }

    @Test public void timeLimitRanksLivingTeamsByKillsPerInitialMember() {
        Map<Integer, Integer> members = new LinkedHashMap<Integer, Integer>();
        members.put(1, 1); members.put(2, 2);
        DemonDefenseGame game = new DemonDefenseGame(START, members);
        game.shoot(1, "alice", 20, START + 10000);
        game.shoot(2, "bob", 20, START + 10000);
        game.stop(START + 10000);
        assertEquals(2, team(game, 1, 10000, true).kills);
        assertEquals(2, team(game, 2, 10000, true).kills);
        assertEquals(1, team(game, 1, 10000, true).rank);
        assertEquals(2, team(game, 2, 10000, true).rank);
        assertEquals(10000L, team(game, 1, 10000, true).survivedMs);
    }

    @Test public void biggerTeamsGetMoreDemonsAndLaterWavesMoveFaster() {
        DemonDefenseGame small = game(1), large = game(3);
        small.advance(START + 15000); large.advance(START + 15000);
        assertTrue(team(large, 1, 15000, true).demons.size() > team(small, 1, 15000, true).demons.size());
        double firstSpeed = team(small, 1, 15000, true).demons.get(0).speed;
        for (long at = 15000; at <= 30000; at += 3000) {
            small.shoot(1, "a", 100, START + at); small.shoot(2, "b", 100, START + at);
        }
        small.advance(START + 37000);
        assertTrue(team(small, 1, 37000, true).demons.get(0).speed > firstSpeed);
    }
}
