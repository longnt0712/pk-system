package com.globits.richy.battle;

import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

public class DemonDefenseGameTest {
    private static final long START = 1000000L;
    private DemonDefenseGame game(int members) {
        Map<Integer, Integer> teams = new LinkedHashMap<Integer, Integer>();
        teams.put(1, members); teams.put(2, members); return new DemonDefenseGame(START, teams);
    }
    private DemonDefenseGame.Team team(DemonDefenseGame game, int number, long elapsed, boolean arena) {
        for (DemonDefenseGame.Team team : game.snapshot(START + elapsed, arena).teams) {
            if (team.number == number) { return team; }
        }
        throw new AssertionError("Missing team");
    }
    private DemonDefenseGame atLevel(int level, int members) throws Exception {
        DemonDefenseGame game = game(members);
        Field field = DemonDefenseGame.class.getDeclaredField("level"); field.setAccessible(true); field.setInt(game, level);
        return game;
    }
    private int enemyPoints(DemonDefenseGame.Team team) {
        int points = 0; for (DemonDefenseGame.Demon demon : team.demons) { points += demon.maxHealth; } return points;
    }
    private Map<String, Integer> values(String... entries) {
        Map<String, Integer> result = new LinkedHashMap<String, Integer>();
        for (int i = 0; i < entries.length; i += 2) { result.put(entries[i], Integer.valueOf(entries[i + 1])); }
        return result;
    }

    @Test public void bulletThresholdsAndFivePointBreakAreExact() {
        int[] streaks = {0,1,10,19,20,29,30,39,40,99}, bullets = {1,1,1,1,2,2,3,3,4,9};
        for (int i = 0; i < streaks.length; i++) { assertEquals(bullets[i], DemonDefenseGame.bulletsForStreak(streaks[i])); }
        assertEquals(30,DemonDefenseGame.breakStreak(35)); assertEquals(15,DemonDefenseGame.breakStreak(20));
        assertEquals(4,DemonDefenseGame.breakStreak(9)); assertEquals(0,DemonDefenseGame.breakStreak(5));
    }
    @Test public void levelTargetsIncreaseWithoutMultiplyingByTeamSize() {
        int[] targets = {20,40,60,90,120,160,200,250,300,360};
        for (int level = 1; level <= targets.length; level++) { assertEquals(targets[level - 1],DemonDefenseGame.pointsRequiredForLevel(level)); }
        assertEquals(420,DemonDefenseGame.pointsRequiredForLevel(11)); assertEquals(480,DemonDefenseGame.pointsRequiredForLevel(12));
        assertEquals(20,game(1).snapshot(START,false).levelTargetPoints); assertEquals(20,game(4).snapshot(START,false).levelTargetPoints);
    }
    @Test public void levelOneSpawnsOnePointEveryFourSecondsPerMember() {
        DemonDefenseGame small = game(1), large = game(3); small.advance(START + 6999L);
        assertEquals(1,enemyPoints(team(small,1,6999,true))); small.advance(START + 7000L);
        assertEquals(2,enemyPoints(team(small,1,7000,true))); small.advance(START + 15000L); large.advance(START + 15000L);
        assertEquals(4,enemyPoints(team(small,1,15000,true))); assertEquals(10,enemyPoints(team(large,1,15000,true)));
        for (DemonDefenseGame.Demon demon : team(large,1,15000,true).demons) { assertEquals(1,demon.health); }
    }
    @Test public void eachSpawnBatchSpendsItsLevelBudgetAndMixesHealthValues() throws Exception {
        for (int level : new int[] {2,3,5}) {
            DemonDefenseGame game = atLevel(level,1); game.advance(START + 15000L);
            DemonDefenseGame.Team team = team(game,1,15000,true); assertEquals(level * 4,enemyPoints(team));
            boolean one = false, two = false, three = false;
            for (DemonDefenseGame.Demon demon : team.demons) {
                assertEquals(demon.maxHealth,demon.health); assertEquals(demon.maxHealth,demon.points);
                assertTrue(demon.health >= 1 && demon.health <= 3);
                one |= demon.health == 1; two |= demon.health == 2; three |= demon.health == 3;
            }
            assertTrue(one); assertTrue(two); if (level >= 3) { assertTrue(three); }
        }
    }
    @Test public void twoPointDemonKeepsMovingAfterOneHitAndAwardsFullValueToFinisher() throws Exception {
        DemonDefenseGame game = atLevel(2,1);
        DemonDefenseGame.ShotResult first = game.shoot(1,"alice",1,START + 3000L);
        assertEquals(1,first.hits); assertEquals(0,first.kills); assertEquals(0,first.points);
        DemonDefenseGame.Demon before = team(game,1,3000,true).demons.get(0);
        assertEquals(1,before.health); assertEquals(2,before.maxHealth); assertTrue(before.tough);
        game.advance(START + 4000L); assertTrue(team(game,1,4000,true).demons.get(0).progress > before.progress);
        DemonDefenseGame.ShotResult second = game.shoot(1,"bob",1,START + 4000L);
        assertEquals(1,second.kills); assertEquals(2,second.points);
        assertEquals(1,team(game,1,4000,true).kills); assertEquals(2,team(game,1,4000,true).points);
    }
    @Test public void threePointDemonNeedsThreeHitsAndAwardsThreePointsOnlyOnce() throws Exception {
        DemonDefenseGame game = atLevel(3,1); assertEquals(3,game.shoot(1,"alice",30,START + 3000L).points);
        game.advance(START + 7000L); assertEquals(3,team(game,1,7000,true).demons.get(0).health);
        assertEquals(0,game.shoot(1,"alice",1,START + 7000L).points); assertEquals(0,game.shoot(1,"bob",1,START + 7000L).points);
        assertEquals(3,game.shoot(1,"carol",1,START + 7000L).points); assertEquals(0,game.shoot(1,"carol",1,START + 7000L).points);
        assertEquals(6,team(game,1,7000,true).points);
    }
    @Test public void oneTeamAdvancesGlobalLevelAndCheckpointsEveryPlayersLatestGun() {
        DemonDefenseGame game = game(4); assertEquals(3,game.shoot(2,"other",30,START + 24000L).points);
        game.updatePlayerStreak("other",0); game.updatePlayerStreak("bob",30); game.updatePlayerStreak("carol",0);
        assertEquals(19,game.shoot(1,"warmup",190,START + 24000L).points); assertEquals(1,game.snapshot(START + 24000L,false).level);
        assertEquals(2,game.shoot(1,"alice",20,START + 24000L).points);
        assertEquals(2,game.snapshot(START + 24000L,false).level); assertEquals(40,game.snapshot(START + 24000L,false).levelTargetPoints);
        assertEquals(21,team(game,1,24000,false).points); assertEquals(1,team(game,1,24000,false).levelPoints);
        assertEquals(3,team(game,2,24000,false).points); assertEquals(0,team(game,2,24000,false).levelPoints);
        assertEquals(2,game.minimumBulletsForPlayer("alice")); assertEquals(3,game.minimumBulletsForPlayer("bob"));
        assertEquals(1,game.minimumBulletsForPlayer("other")); assertEquals(1,game.minimumBulletsForPlayer("carol"));
        game.updatePlayerStreak("alice",0); assertEquals(2,game.bulletsForPlayer("alice",0));
        assertEquals(2,game.shoot(1,"alice",0,START + 24000L).bullets);
        assertEquals(4,game.bulletsForPlayer("alice",40)); assertEquals(2,game.bulletsForPlayer("alice",0));
        long elapsed = 24000L;
        while (game.snapshot(START + elapsed,false).level < 3 && elapsed < 150000L) {
            elapsed += 500L; game.shoot(1,"alice",40,START + elapsed); game.shoot(2,"bob",0,START + elapsed);
        }
        assertEquals(3,game.snapshot(START + elapsed,false).level); game.updatePlayerStreak("alice",0);
        assertEquals(4,game.minimumBulletsForPlayer("alice")); assertEquals(4,game.bulletsForPlayer("alice",0));
        assertEquals(3,game.minimumBulletsForPlayer("bob"));
    }
    @Test public void carryDoublesShotsButItsTemporaryBonusNeverBecomesTheCheckpointFloor() {
        DemonDefenseGame game = game(4); assertEquals(19,game.shoot(1,"warmup",190,START + 24000L).points);
        assertEquals(2,game.shoot(1,"alice",1,START + 24000L,true).bullets);
        assertEquals(2,game.snapshot(START + 24000L,false).level); assertEquals(1,game.minimumBulletsForPlayer("alice"));
        assertEquals(1,game.shoot(1,"alice",0,START + 24000L,false).bullets);
        assertEquals(2,game.shoot(1,"bob",0,START + 24000L,true).bullets);
    }
    @Test public void lateJoinAndTeamChangesKeepExistingEnemiesAndPoints() {
        DemonDefenseGame game = game(1);
        game.syncPlayers(values("alice","1","bob","2"),values("alice","20","bob","0"),START);
        assertEquals(1,game.shoot(1,"alice",20,START + 3000L).points); game.advance(START + 7000L);
        long id = team(game,1,7000,true).demons.get(0).id;
        game.syncPlayers(values("alice","1","newbie","1","bob","2"),values("alice","20","newbie","0","bob","0"),START + 8000L);
        assertEquals(2,team(game,1,8000,true).memberCount); assertEquals(1,team(game,1,8000,true).points);
        assertEquals(id,team(game,1,8000,true).demons.get(0).id); assertEquals(1,game.minimumBulletsForPlayer("newbie"));
        game.syncPlayers(values("alice","1","newbie","2","bob","2"),values("alice","20","newbie","0","bob","0"),START + 8000L);
        assertEquals(1,team(game,1,8000,true).memberCount); assertEquals(2,team(game,2,8000,true).memberCount);
        assertEquals(id,team(game,1,8000,true).demons.get(0).id); assertFalse(game.isFinished());
    }
    @Test public void emptyTeamsAreEliminatedWithoutGhostLanesOrRevival() {
        DemonDefenseGame game = game(1);
        game.syncPlayers(values("alice","1","bob","2"),values("alice","0","bob","0"),START);
        game.shoot(1,"alice",1,START + 3000L); game.shoot(2,"bob",1,START + 3000L);
        game.syncPlayers(values("alice","1"),values("alice","0"),START + 4000L);
        assertEquals(START + 4000L,team(game,2,4000,false).eliminatedAt); assertTrue(game.isFinished()); assertEquals(1,game.livingTeams());
        game.syncPlayers(values("alice","1","newbie","2"),values("alice","0","newbie","0"),START + 5000L);
        assertTrue(game.isEliminated(2)); assertEquals(1,game.livingTeams()); assertEquals(0,game.shoot(2,"newbie",100,START + 5000L).bullets);
    }
    @Test public void aLateRosterCanAddANewLaneWithoutResettingExistingLanes() {
        DemonDefenseGame game = game(1); game.shoot(1,"alice",1,START + 3000L);
        game.syncPlayers(values("alice","1","bob","2","carol","3"),values("alice","0","bob","0","carol","0"),START + 4000L);
        assertTrue(game.containsTeam(3)); assertEquals(3,game.livingTeams()); assertEquals(1,team(game,1,4000,false).points);
        assertTrue(team(game,3,4000,true).demons.isEmpty()); game.advance(START + 7000L); assertEquals(1,team(game,3,7000,true).demons.size());
    }
    @Test public void simultaneousStudentsKillDifferentNearestEnemies() {
        DemonDefenseGame game = game(3); game.advance(START + 24000L);
        int before = team(game,1,24000,true).demons.size(); assertTrue(before >= 4);
        assertEquals(1,game.shoot(1,"alice",19,START + 24000L).kills); assertEquals(3,game.shoot(1,"bob",30,START + 24000L).kills);
        assertEquals(before - 4,team(game,1,24000,true).demons.size()); assertEquals(0,team(game,2,24000,true).kills);
    }
    @Test public void tickingFrequencyDoesNotChangeSpawnsOrCollisionTimes() {
        DemonDefenseGame regular = game(2), delayed = game(2);
        for (long elapsed = 500; elapsed <= 25000; elapsed += 500) { regular.advance(START + elapsed); }
        delayed.advance(START + 25000); assertEquals(team(regular,1,25000,true).demons.size(),team(delayed,1,25000,true).demons.size());
        for (long elapsed = 25500; elapsed <= 45000; elapsed += 500) { regular.advance(START + elapsed); }
        delayed.advance(START + 45000);
        assertEquals(team(regular,1,45000,true).eliminatedAt,team(delayed,1,45000,true).eliminatedAt);
        assertEquals(team(regular,1,45000,true).demons.size(),team(delayed,1,45000,true).demons.size());
    }
    @Test public void simultaneousCollisionsTieAndDeadTeamsCannotShoot() {
        DemonDefenseGame game = game(1); game.advance(START + 30000L);
        assertTrue(game.isFinished()); assertEquals(0,game.livingTeams());
        assertEquals(START + 29000L,team(game,1,30000,true).eliminatedAt);
        assertEquals(1,team(game,1,30000,true).rank); assertEquals(1,team(game,2,30000,true).rank);
        assertEquals(0,game.shoot(1,"late",30,START + 30001L).kills);
    }
    @Test public void audioWarningHordeAndRestRetainTheirThirtySecondCycle() {
        DemonDefenseGame game = game(3); game.advance(START + 21000L);
        assertEquals("WARNING",game.snapshot(START + 21000L,false).phase); assertEquals(2,game.snapshot(START + 21000L,false).warningSeconds);
        game.advance(START + 24000L); assertEquals("HORDE",game.snapshot(START + 24000L,false).phase);
        for (int i = 0; i < 30; i++) { game.shoot(1,"alice",1,START + 24000L); game.shoot(2,"bob",1,START + 24000L); }
        assertEquals("REST",game.snapshot(START + 28000L,false).phase);
    }
    @Test public void aLateKillCreditsRescueAndPrivateAnimationDoesNotLeakToStudents() {
        DemonDefenseGame game = game(1); assertTrue(game.shoot(1,"hero",20,START + 26000L).rescued);
        assertEquals("hero",team(game,1,26000,true).rescueUsername); assertFalse(team(game,1,26000,true).shots.isEmpty());
        assertTrue(team(game,1,26000,false).shots.isEmpty()); assertTrue(team(game,1,26000,false).demons.isEmpty());
        assertEquals(team(game,1,26000,true).points,team(game,1,26000,false).points);
    }
    @Test public void studentDistanceMatchesNearestHostEnemyWithoutSendingArena() {
        DemonDefenseGame game = game(2); game.advance(START + 23500L);
        for (int number : new int[] {1,2}) {
            DemonDefenseGame.Team host = team(game,number,23500,true), student = team(game,number,23500,false);
            double nearest = 0D, speed = 0D;
            for (DemonDefenseGame.Demon demon : host.demons) {
                if (demon.progress > nearest || (demon.progress == nearest && demon.speed > speed)) { nearest = demon.progress; speed = demon.speed; }
            }
            assertEquals(nearest,student.nearestDemonProgress,0D); assertEquals(speed,student.nearestDemonSpeed,0D);
            assertEquals(host.danger,student.danger); assertTrue(student.danger); assertTrue(student.demons.isEmpty()); assertTrue(student.shots.isEmpty());
        }
    }
    @Test public void killingNearestMovesOnlyThatTeamsDistanceBackAndEmptyArenaStartsAtZero() {
        DemonDefenseGame game = game(1); assertEquals(0D,team(game,1,0,false).nearestDemonProgress,0D);
        game.advance(START + 24000L); double before = team(game,1,24000,false).nearestDemonProgress;
        assertEquals(1,game.shoot(1,"alice",1,START + 24000L).kills); assertTrue(team(game,1,24000,false).nearestDemonProgress < before);
        assertEquals(before,team(game,2,24000,false).nearestDemonProgress,0D); game.shoot(1,"bob",100,START + 24000L);
        assertEquals(0D,team(game,1,24000,false).nearestDemonProgress,0D); assertEquals(0D,team(game,1,24000,false).nearestDemonSpeed,0D);
    }
    @Test public void timeLimitRanksSurvivingTeamsByPointsPerMember() throws Exception {
        Map<Integer, Integer> members = new LinkedHashMap<Integer, Integer>(); members.put(1,1); members.put(2,2);
        DemonDefenseGame game = new DemonDefenseGame(START,members);
        Field field = DemonDefenseGame.class.getDeclaredField("level"); field.setAccessible(true); field.setInt(game,2);
        assertEquals(2,game.shoot(1,"alice",20,START + 3000L).points); assertEquals(2,game.shoot(2,"bob",20,START + 3000L).points);
        game.stop(START + 3000L); assertEquals(1,team(game,1,3000,true).rank); assertEquals(2,team(game,2,3000,true).rank);
    }
    @Test public void levelsChangeSpeedButElapsedTimeAloneDoesNotRaiseDifficulty() throws Exception {
        DemonDefenseGame first = game(1), third = atLevel(3,1); first.advance(START + 3000L); third.advance(START + 3000L);
        assertTrue(team(third,1,3000,true).demons.get(0).speed > team(first,1,3000,true).demons.get(0).speed);
        for (long elapsed = 3000L; elapsed <= 37000L; elapsed += 1000L) { first.shoot(1,"alice",100,START + elapsed); first.shoot(2,"bob",100,START + elapsed); }
        assertEquals(1,first.snapshot(START + 37000L,false).level); assertEquals(2,first.snapshot(START + 37000L,false).wave);
    }
}
