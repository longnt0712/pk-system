package com.globits.richy.battle;

import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;
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
    private Random roll(int value) {
        return new Random() {
            @Override public int nextInt(int bound) {
                assertEquals(100, bound);
                return value;
            }
        };
    }

    @Test public void blindBagDropAndPrizeBoundariesAreExact() {
        int[] prizeRolls = {0, 19, 20, 49, 50, 89, 90, 99};
        DemonDefenseGame.BagPrize[] prizes = DemonDefenseGame.BagPrize.values();
        for (int i = 0; i < prizeRolls.length; i++) {
            DemonDefenseGame game = game(1);
            game.syncPlayers(values("alice", "1", "bob", "2"), values("alice", "0", "bob", "0"), START);
            game.rollBag("alice", roll(20));
            assertEquals(0, game.bagForPlayer("alice").count);
            game.rollBag("alice", roll(19));
            DemonDefenseGame.BagState bag = game.bagForPlayer("alice");
            assertEquals(1, bag.count);
            assertNull(game.openBag("alice", bag.id, 4, START, roll(0)));
            assertNull(game.openBag("bob", bag.id, 1, START, roll(0)));
            int choice = 1 + i % 3;
            DemonDefenseGame.BagReward reward = game.openBag("alice", bag.id, choice, START, roll(prizeRolls[i]));
            assertEquals(choice, reward.choice);
            assertEquals(prizes[i / 2], reward.prize);
            assertEquals(0, reward.points);
            assertEquals(0, game.bagForPlayer("alice").count);
            assertNull(game.openBag("alice", bag.id, 2, START, roll(0)));
        }
        assertEquals(20, DemonDefenseGame.wrongAnswerStreak(35));
        assertEquals(0, DemonDefenseGame.wrongAnswerStreak(14));
    }

    /** Opens one bag for alice (lane 1) at the given elapsed time with the given prize roll. */
    private DemonDefenseGame.BagReward openAt(DemonDefenseGame game, long elapsed, int prizeRoll) {
        game.rollBag("alice", roll(0));
        return game.openBag("alice", game.bagForPlayer("alice").id, 1, START + elapsed, roll(prizeRoll));
    }
    private DemonDefenseGame dangerGame(int members) {
        DemonDefenseGame game = game(members);
        Map<String, Integer> roster = new LinkedHashMap<String, Integer>();
        for (int i = 0; i < members; i++) { roster.put(i == 0 ? "alice" : "a" + i, 1); roster.put("b" + i, 2); }
        game.syncPlayers(roster, values(), START);
        game.advance(START + 23000L); // the 3 s demon is at 77% of the path: past the danger line
        assertTrue(team(game, 1, 23000L, false).danger);
        return game;
    }

    @Test public void angelScepterOnlyAppearsInDangerForThirtyPercentAndStrikesFiftyHealth() {
        // Not in danger: the usual table, roll 0 is a permanent gun.
        DemonDefenseGame calm = game(1);
        calm.syncPlayers(values("alice", "1", "bob", "2"), values("alice", "0", "bob", "0"), START);
        assertEquals(DemonDefenseGame.BagPrize.PERMANENT_GUN, openAt(calm, 4000L, 0).prize);

        // In danger: rolls 0-29 are the Angel Scepter.
        for (int prizeRoll : new int[] {0, 29}) {
            DemonDefenseGame game = dangerGame(4);
            int healthBefore = 0;
            for (DemonDefenseGame.Demon demon : team(game, 1, 23000L, true).demons) { healthBefore += demon.health; }
            DemonDefenseGame.BagReward reward = openAt(game, 23000L, prizeRoll);
            assertEquals(DemonDefenseGame.BagPrize.ANGEL_SCEPTER, reward.prize);
            assertEquals(Math.min(50, healthBefore), reward.hits);
            assertEquals(reward.hits, reward.points); // every demon in the lane has full health, so all hits are kills
            DemonDefenseGame.Team lane = team(game, 1, 23000L, true);
            assertEquals(START + 23000L, lane.holyAt); assertEquals("alice", lane.holyUsername);
            assertFalse(lane.shots.isEmpty());
            for (DemonDefenseGame.Shot shot : lane.shots) { assertTrue(shot.holy); assertTrue(shot.lightning); }
            assertFalse(lane.danger); // the strike cleared the demon past the line
            assertEquals(0L, team(game, 2, 23000L, false).holyAt);
            assertEquals(0, game.bagForPlayer("alice").count);
        }
        // The other 70% keeps the usual proportions: 30 -> gun, 99 -> empty.
        assertEquals(DemonDefenseGame.BagPrize.PERMANENT_GUN, openAt(dangerGame(4), 23000L, 30).prize);
        assertEquals(DemonDefenseGame.BagPrize.EMPTY, openAt(dangerGame(4), 23000L, 99).prize);
    }

    @Test public void gunRewardsStackAndEachTemporaryGunExpiresAtTwentySeconds() {
        DemonDefenseGame game = game(1);
        game.syncPlayers(values("alice", "1", "bob", "2"), values("alice", "0", "bob", "0"), START);
        for (int i = 0; i < 3; i++) { game.rollBag("alice", roll(0)); }
        assertEquals(3, game.bagForPlayer("alice").count);

        String firstBag = game.bagForPlayer("alice").id;
        game.openBag("alice", firstBag, 1, START, roll(0));
        assertNotEquals(firstBag, game.bagForPlayer("alice").id);
        game.openBag("alice", game.bagForPlayer("alice").id, 2, START, roll(20));
        game.openBag("alice", game.bagForPlayer("alice").id, 3, START + 5000L, roll(49));

        assertEquals(5, game.shoot(1, "alice", 20, START + 6000L).bullets);
        assertEquals(4, game.bulletsForPlayer("alice", 0, START + 19999L, false));
        assertEquals(3, game.bulletsForPlayer("alice", 0, START + 20000L, false));
        assertEquals(2, game.bulletsForPlayer("alice", 0, START + 25000L, false));
        assertEquals(3, game.bulletsForPlayer("alice", 0, START + 25000L, true));
        assertEquals(1, game.bulletsForPlayer("bob", 0, START + 25000L, false));
        assertEquals(START + 25000L, game.gunBoostUntil("alice"));
    }

    @Test public void lightningHitsAtMostFiveHealthInThePlayersLaneAndOnlyTheHostGetsShots() {
        DemonDefenseGame game = game(4);
        Map<String, Integer> roster = values("alice", "1", "a2", "1", "a3", "1", "a4", "1",
                "bob", "2", "b2", "2", "b3", "2", "b4", "2");
        game.syncPlayers(roster, values(), START);
        game.rollBag("alice", roll(0));
        DemonDefenseGame.BagReward reward = game.openBag("alice", game.bagForPlayer("alice").id, 2,
                START + 15000L, roll(50));
        assertEquals(5, reward.hits);
        assertEquals(5, reward.points);
        assertEquals(5, team(game, 1, 15000L, true).kills);
        assertEquals(1 + 12000 / (8572 / 4), team(game, 2, 15000L, true).demons.size()); // untouched lane: 6 demons
        assertFalse(team(game, 1, 15000L, true).shots.isEmpty());
        for (DemonDefenseGame.Shot shot : team(game, 1, 15000L, true).shots) {
            assertTrue(shot.lightning);
            assertTrue(shot.hit);
        }
        assertTrue(team(game, 1, 15000L, false).shots.isEmpty());
    }

    @Test public void levelOneNeedsFiftyPointsAndEachLaterLevelTwentyMore() {
        int[] targets = {50, 70, 90, 110, 130};
        for (int level = 1; level <= targets.length; level++) { assertEquals(targets[level - 1],DemonDefenseGame.pointsRequiredForLevel(level)); }
        assertEquals(50 + 11 * 20,DemonDefenseGame.pointsRequiredForLevel(12));
        assertEquals(50,game(1).snapshot(START,false).levelTargetPoints); assertEquals(50,game(4).snapshot(START,false).levelTargetPoints);
        assertEquals(50,team(game(4),1,0L,false).levelTargetPoints);
    }
    @Test public void levelOneSpawnsOneDemonEveryEightPointSixSecondsPerMember() {
        DemonDefenseGame small = game(1), large = game(3); small.advance(START + 11571L);
        assertEquals(1,enemyPoints(team(small,1,11571,true))); small.advance(START + 11572L);
        assertEquals(2,enemyPoints(team(small,1,11572,true))); small.advance(START + 15000L); large.advance(START + 15000L);
        assertEquals(1 + 12000 / 8572,enemyPoints(team(small,1,15000,true)));
        assertEquals(1 + 12000 / (8572 / 3),enemyPoints(team(large,1,15000,true)));
        for (DemonDefenseGame.Demon demon : team(large,1,15000,true).demons) { assertEquals(1,demon.health); }
    }
    @Test public void normalPressureIsDoubledWithTheOpeningGraceUnchanged() {
        for (int members : new int[] {1,2,4,12,25,200}) {
            DemonDefenseGame game = game(members);
            game.advance(START + 2999L); assertTrue(team(game,1,2999,true).demons.isEmpty());
            game.advance(START + 3000L); assertEquals(1,enemyPoints(team(game,1,3000,true)));
            long interval = Math.max(387L,8572L / members);
            // 2/3 of the doubled rate = 4/3 of the original 11.43 s rate (intervals x 0.75).
            assertEquals(.75D, interval / (double) Math.max(515L,11430L / members), .003D);
            game.advance(START + 3000L + interval - 1L);
            assertEquals(1,enemyPoints(team(game,1,3000L + interval - 1L,true)));
            game.advance(START + 3000L + interval);
            assertEquals(2,enemyPoints(team(game,1,3000L + interval,true)));
        }
    }
    @Test public void hordePressureIsAlsoDoubledIncludingTheLargeTeamMinimum() {
        for (int members : new int[] {2,4,12,25,200}) {
            // Join two new lanes so their three-second opening grace ends exactly at HORDE.
            DemonDefenseGame game = new DemonDefenseGame(START - 20000L,new LinkedHashMap<Integer,Integer>());
            Map<String,Integer> roster = new LinkedHashMap<String,Integer>(), streaks = new LinkedHashMap<String,Integer>();
            for (int number = 1; number <= 2; number++) for (int i = 0; i < members; i++) {
                String username = number + ":" + i; roster.put(username,number); streaks.put(username,0);
            }
            game.syncPlayers(roster,streaks,START);
            game.advance(START + 3000L);
            assertEquals("HORDE",game.snapshot(START + 3000L,false).phase);
            assertEquals(1,enemyPoints(team(game,1,3000L,true)));
            long interval = Math.max(387L,Math.max(387L,8572L / members) / 2L);
            long previousInterval = Math.max(515L,Math.max(515L,11430L / members) / 2L);
            assertEquals(.75D, interval / (double) previousInterval, .003D);
            game.advance(START + 3000L + interval - 1L);
            assertEquals(1,enemyPoints(team(game,1,3000L + interval - 1L,true)));
            game.advance(START + 3000L + interval);
            assertEquals(2,enemyPoints(team(game,1,3000L + interval,true)));
        }
    }
    @Test public void lateRosterChangesUseTheDoubledRateWithoutChangingTheOtherTeamsClock() {
        DemonDefenseGame game = game(1);
        game.syncPlayers(values("alice","1","bob","2"),values("alice","0","bob","0"),START);
        game.advance(START + 4000L);
        long firstId = team(game,1,4000L,true).demons.get(0).id;
        // Lane 1 grows to 2 members: next demon 8572 / 2 = 4286 ms after the change.
        game.syncPlayers(values("alice","1","newbie","1","bob","2"),values("alice","0","newbie","0","bob","0"),START + 4000L);
        game.advance(START + 8285L); assertEquals(1,enemyPoints(team(game,1,8285L,true)));
        game.advance(START + 8286L); assertEquals(2,enemyPoints(team(game,1,8286L,true)));
        assertEquals(1,enemyPoints(team(game,2,8286L,true)));
        assertEquals(firstId,team(game,1,8286L,true).demons.get(0).id);
        // Newbie moves to lane 2: lane 1 back to 8572 ms, lane 2 now 4286 ms.
        game.syncPlayers(values("alice","1","newbie","2","bob","2"),values("alice","0","newbie","0","bob","0"),START + 8286L);
        game.advance(START + 16857L); assertEquals(2,enemyPoints(team(game,1,16857L,true)));
        game.advance(START + 16858L); assertEquals(3,enemyPoints(team(game,1,16858L,true)));
        assertEquals(3,enemyPoints(team(game,2,16858L,true))); // 3000, 12572, 16858
    }
    @Test public void eachBatchIsOneDemonAndHigherLevelsAddHealthInsteadOfMoreDemons() throws Exception {
        for (int level : new int[] {1,2,3,5}) {
            DemonDefenseGame game = atLevel(level,1); game.advance(START + 23000L);
            DemonDefenseGame.Team team = team(game,1,23000,true);
            assertEquals(4,team.demons.size()); // 3s, 11.572s, 20.144s and 23s regardless of level
            assertEquals(level - 1,game.snapshot(START + 23000L,false).demonHealthBonus);
            boolean[] kinds = new boolean[4];
            for (DemonDefenseGame.Demon demon : team.demons) {
                assertEquals(demon.maxHealth,demon.health); assertEquals(demon.maxHealth,demon.points);
                assertTrue(demon.kind >= 1 && demon.kind <= Math.min(3,level));
                assertEquals(demon.kind + level - 1,demon.health);
                assertEquals(demon.kind > 1,demon.tough);
                kinds[demon.kind] = true;
            }
            for (int kind = 1; kind <= Math.min(3,level); kind++) { assertTrue("level " + level + " kind " + kind, kinds[kind]); }
        }
    }
    @Test public void toughDemonKeepsMovingAfterHitsAndAwardsItsFullHealthToTheFinisher() throws Exception {
        DemonDefenseGame game = atLevel(2,1);
        DemonDefenseGame.ShotResult first = game.shoot(1,"alice",1,START + 3000L);
        assertEquals(1,first.hits); assertEquals(0,first.kills); assertEquals(0,first.points);
        DemonDefenseGame.Demon before = team(game,1,3000,true).demons.get(0);
        assertEquals(2,before.kind); assertEquals(2,before.health); assertEquals(3,before.maxHealth); assertTrue(before.tough);
        game.advance(START + 4000L); assertTrue(team(game,1,4000,true).demons.get(0).progress > before.progress);
        assertEquals(0,game.shoot(1,"bob",1,START + 4000L).points);
        DemonDefenseGame.ShotResult last = game.shoot(1,"carol",1,START + 4000L);
        assertEquals(1,last.kills); assertEquals(3,last.points);
        assertEquals(1,team(game,1,4000,true).kills); assertEquals(3,team(game,1,4000,true).points);
        assertEquals(0,game.shoot(1,"carol",1,START + 4000L).points);
    }
    @Test public void levelsAddHealthButNeverSpeed() throws Exception {
        DemonDefenseGame first = game(1), fifth = atLevel(5,1); first.advance(START + 3000L); fifth.advance(START + 3000L);
        DemonDefenseGame.Demon easy = team(first,1,3000,true).demons.get(0), hard = team(fifth,1,3000,true).demons.get(0);
        assertEquals(easy.speed,hard.speed,0D); assertEquals(1D / DemonDefenseGame.DEMON_TRAVEL_MS,hard.speed,0D);
        assertTrue(hard.maxHealth > easy.maxHealth);
    }
    private void setLane(DemonDefenseGame game, int lane, String name, int value) throws Exception {
        Field teams = DemonDefenseGame.class.getDeclaredField("teams"); teams.setAccessible(true);
        Object state = ((Map<?, ?>) teams.get(game)).get(lane);
        Field field = state.getClass().getDeclaredField(name); field.setAccessible(true); field.setInt(state, value);
    }
    /** Puts lane 1 one point short of 50, then kills the opening demon at +3s: level 2 + first boss. */
    private DemonDefenseGame bossSpawnedInLaneOne(DemonDefenseGame game) throws Exception {
        setLane(game, 1, "levelPoints", 49);
        assertEquals(1, team(game, 1, 0L, false).pointsUntilBoss);
        assertEquals(1, game.shoot(1, "starter", 1, START + 3000L).kills);
        assertEquals(2, game.snapshot(START + 3000L, false).level);
        return game;
    }

    @Test public void everyFiftyPointsLevelsUpAndOnlyTheScoringLaneMeetsABossWithTwoMoreHealthEachTime() throws Exception {
        DemonDefenseGame game = bossSpawnedInLaneOne(game(1));
        DemonDefenseGame.Team lane = team(game, 1, 3000L, true);
        DemonDefenseGame.Demon boss = lane.demons.stream().filter(demon -> demon.boss).findFirst().get();
        assertEquals(10, boss.health); assertEquals(10, boss.points);
        assertEquals(1, lane.bossCount); assertTrue(lane.bossActive);
        assertEquals(70, lane.pointsUntilBoss); assertEquals(12, lane.nextBossHealth); // level 2 needs 50 + 20
        assertTrue(team(game, 2, 3000L, true).demons.stream().noneMatch(demon -> demon.boss));
        assertEquals(0, team(game, 2, 3000L, false).bossCount);
        for (int hit = 0; hit < 10; hit++) { game.shoot(1, "alice", 1, START + 3000L); }
        assertFalse(team(game, 1, 3000L, true).bossActive);
        assertEquals(10, team(game, 1, 3000L, false).levelPoints); // the boss's 10 points count toward the next level

        // Level 2: next lane-1 demon at 3000 + 8572 is a kind-1 demon with 1 + 1 = 2 health.
        setLane(game, 1, "levelPoints", 69);
        game.advance(START + 11572L);
        assertEquals(1, game.shoot(1, "alice", 20, START + 11572L).kills);
        assertEquals(3, game.snapshot(START + 11572L, false).level);
        lane = team(game, 1, 11572L, true);
        assertEquals(12, lane.demons.stream().filter(demon -> demon.boss).findFirst().get().health);
        assertEquals(2, lane.bossCount); assertEquals(14, lane.nextBossHealth);
        assertEquals(1, lane.levelPoints); // 71 - 70 carries over
        assertEquals(90, lane.levelTargetPoints); // level 3 needs 70 + 20
    }

    @Test public void unequalTeamsScaleLevelTargetAndBossHealthBySize() throws Exception {
        Map<Integer, Integer> members = new LinkedHashMap<Integer, Integer>(); members.put(1, 1); members.put(2, 3);
        DemonDefenseGame game = new DemonDefenseGame(START, members); // average 2 members: scales 0.5 and 1.5
        DemonDefenseGame.Team small = team(game, 1, 0L, false), large = team(game, 2, 0L, false);
        assertEquals(25, small.levelTargetPoints); assertEquals(75, large.levelTargetPoints);
        assertEquals(50, game.snapshot(START, false).levelTargetPoints);
        assertEquals(5, small.nextBossHealth); assertEquals(15, large.nextBossHealth);
        // The small team levels up the whole room after 25 points and meets a proportionally smaller boss.
        setLane(game, 1, "levelPoints", 24);
        assertEquals(1, game.shoot(1, "solo", 1, START + 3000L).points);
        assertEquals(2, game.snapshot(START + 3000L, false).level);
        assertEquals(5, team(game, 1, 3000L, true).demons.stream().filter(demon -> demon.boss).findFirst().get().health);
        assertTrue(team(game, 2, 3000L, true).demons.stream().noneMatch(demon -> demon.boss));
        assertEquals(105, team(game, 2, 3000L, false).pointsUntilBoss); // level 2: 70 x 1.5
    }

    @Test public void firstBossAwardsTenPointsOnlyOnTheTenthHit() throws Exception {
        DemonDefenseGame game = bossSpawnedInLaneOne(game(1));
        long now = START + 3000L;
        for (int hit = 1; hit < 10; hit++) {
            DemonDefenseGame.ShotResult shot = game.shoot(1, "alice", 1, now);
            assertEquals(1, shot.hits);
            assertEquals(0, shot.kills);
            assertEquals(0, shot.points);
            assertEquals(10 - hit, team(game, 1, 3000L, true).demons.get(0).health);
        }
        DemonDefenseGame.ShotResult last = game.shoot(1, "alice", 1, now);
        assertEquals(1, last.hits);
        assertEquals(1, last.kills);
        assertEquals(10, last.points);
        assertEquals(0, game.shoot(1, "alice", 1, now).points);
        assertTrue(team(game, 1, 3000L, true).demons.isEmpty());
    }

    @SuppressWarnings("unchecked")
    private void clearLane(DemonDefenseGame game, int lane) throws Exception {
        Field teams = DemonDefenseGame.class.getDeclaredField("teams"); teams.setAccessible(true);
        Object state = ((Map<?, ?>) teams.get(game)).get(lane);
        Field demons = state.getClass().getDeclaredField("demons"); demons.setAccessible(true);
        ((java.util.List<Object>) demons.get(state)).clear();
    }
    // 24 members: a demon every 357 ms, so by +20s each lane holds 44 one-health demons and none has arrived yet.
    @Test public void oneTeamAdvancesGlobalLevelAndCheckpointsEveryPlayersLatestGun() throws Exception {
        long at = START + 20000L;
        DemonDefenseGame game = game(24); assertEquals(3,game.shoot(2,"other",30,at).points);
        game.updatePlayerStreak("other",0); game.updatePlayerStreak("bob",30); game.updatePlayerStreak("carol",0);
        setLane(game,1,"levelPoints",8); // 8 + 40 + 2 reaches exactly 50
        assertEquals(40,game.shoot(1,"warmup",400,at).points); assertEquals(1,game.snapshot(at,false).level);
        assertEquals(2,game.shoot(1,"alice",20,at).points);
        assertEquals(2,game.snapshot(at,false).level); assertEquals(70,game.snapshot(at,false).levelTargetPoints);
        assertEquals(42,team(game,1,20000,false).points); assertEquals(0,team(game,1,20000,false).levelPoints);
        assertEquals(3,team(game,2,20000,false).points); assertEquals(0,team(game,2,20000,false).levelPoints);
        assertEquals(2,game.minimumBulletsForPlayer("alice")); assertEquals(3,game.minimumBulletsForPlayer("bob"));
        assertEquals(1,game.minimumBulletsForPlayer("other")); assertEquals(1,game.minimumBulletsForPlayer("carol"));
        game.updatePlayerStreak("alice",0); assertEquals(2,game.bulletsForPlayer("alice",0));
        assertEquals(2,game.shoot(1,"alice",0,at).bullets);
        assertEquals(4,game.bulletsForPlayer("alice",40)); assertEquals(2,game.bulletsForPlayer("alice",0));
        // One point short of the next level; clear the lane (incl. the 10-health boss) so the next
        // level-2 demon (2-3 health, spawned 357 ms later) is killed by a 4-bullet shot.
        setLane(game,1,"levelPoints",69); clearLane(game,1);
        long later = at + 400L; game.advance(later);
        assertEquals(1,game.shoot(1,"alice",40,later).kills);
        assertEquals(3,game.snapshot(later,false).level); game.updatePlayerStreak("alice",0);
        assertEquals(4,game.minimumBulletsForPlayer("alice")); assertEquals(4,game.bulletsForPlayer("alice",0));
        assertEquals(3,game.minimumBulletsForPlayer("bob"));
    }
    @Test public void carryDoublesShotsButItsTemporaryBonusNeverBecomesTheCheckpointFloor() throws Exception {
        long at = START + 20000L;
        DemonDefenseGame game = game(24); setLane(game,1,"levelPoints",8);
        assertEquals(40,game.shoot(1,"warmup",400,at).points);
        assertEquals(2,game.shoot(1,"alice",1,at,true).bullets);
        assertEquals(2,game.snapshot(at,false).level); assertEquals(1,game.minimumBulletsForPlayer("alice"));
        assertEquals(1,game.shoot(1,"alice",0,at,false).bullets);
        assertEquals(2,game.shoot(1,"bob",0,at,true).bullets);
    }
    @Test public void lateJoinAndTeamChangesKeepExistingEnemiesAndPoints() {
        DemonDefenseGame game = game(1);
        game.syncPlayers(values("alice","1","bob","2"),values("alice","20","bob","0"),START);
        assertEquals(1,game.shoot(1,"alice",20,START + 3000L).points); game.advance(START + 14430L);
        long id = team(game,1,14430,true).demons.get(0).id;
        game.syncPlayers(values("alice","1","newbie","1","bob","2"),values("alice","20","newbie","0","bob","0"),START + 15000L);
        assertEquals(2,team(game,1,15000,true).memberCount); assertEquals(1,team(game,1,15000,true).points);
        assertEquals(id,team(game,1,15000,true).demons.get(0).id); assertEquals(1,game.minimumBulletsForPlayer("newbie"));
        game.syncPlayers(values("alice","1","newbie","2","bob","2"),values("alice","20","newbie","0","bob","0"),START + 15000L);
        assertEquals(1,team(game,1,15000,true).memberCount); assertEquals(2,team(game,2,15000,true).memberCount);
        assertEquals(id,team(game,1,15000,true).demons.get(0).id); assertFalse(game.isFinished());
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
        assertTrue(team(game,1,20000,false).shots.isEmpty()); assertTrue(team(game,1,20000,false).demons.isEmpty());
        assertEquals(team(game,1,26000,true).points,team(game,1,20000,false).points);
    }
    @Test public void aStudentLaneFeedCarriesOnlyThatLanesDemonsAndNoShots() {
        DemonDefenseGame game = game(2); game.advance(START + 9000L); game.shoot(1, "alice", 1, START + 9000L);
        DemonDefenseGame.Snapshot lane = game.snapshot(START + 9000L, false, 1);
        DemonDefenseGame.Team own = null, other = null;
        for (DemonDefenseGame.Team team : lane.teams) { if (team.number == 1) { own = team; } else { other = team; } }
        DemonDefenseGame.Team host = team(game, 1, 9000L, true);
        assertEquals(host.demons.size(), own.demons.size()); assertFalse(own.demons.isEmpty());
        for (int i = 0; i < own.demons.size(); i++) {
            assertEquals(host.demons.get(i).id, own.demons.get(i).id);
            assertEquals(host.demons.get(i).progress, own.demons.get(i).progress, 0D);
        }
        assertTrue(own.shots.isEmpty()); assertFalse(host.shots.isEmpty());
        assertTrue(other.demons.isEmpty()); assertTrue(other.shots.isEmpty());
        assertTrue(game.snapshot(START + 9000L, false, 0).teams.stream().allMatch(team -> team.demons.isEmpty()));
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
        // Level 2: first demon is kind 2 with +1 health = 3 points, killed by 3 bullets (streak 30).
        assertEquals(3,game.shoot(1,"alice",30,START + 3000L).points); assertEquals(3,game.shoot(2,"bob",30,START + 3000L).points);
        game.stop(START + 3000L); assertEquals(1,team(game,1,3000,true).rank); assertEquals(2,team(game,2,3000,true).rank);
    }
    @Test public void elapsedTimeAloneDoesNotRaiseDifficulty() throws Exception {
        DemonDefenseGame first = game(1);
        for (long elapsed = 3000L; elapsed <= 37000L; elapsed += 1000L) { first.shoot(1,"alice",100,START + elapsed); first.shoot(2,"bob",100,START + elapsed); }
        assertEquals(1,first.snapshot(START + 37000L,false).level); assertEquals(2,first.snapshot(START + 37000L,false).wave);
    }
}
