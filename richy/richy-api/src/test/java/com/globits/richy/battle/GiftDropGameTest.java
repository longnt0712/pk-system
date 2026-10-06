package com.globits.richy.battle;

import java.util.Random;
import org.junit.Test;
import static org.junit.Assert.*;

public class GiftDropGameTest {
    @Test public void spawnsOnlyAtTheIntervalAndNeverExceedsPlayersPlusFive() {
        GiftDropGame game = new GiftDropGame(0, 3000, 10, new Random(3));
        game.advance(0, 2);
        assertEquals(7, game.snapshot().capacity);
        assertFalse(game.advance(2999, 2)); assertTrue(game.snapshot().gifts.isEmpty());
        for (int tick = 1; tick <= 50; tick++) {
            int before = game.snapshot().gifts.size();
            assertTrue(game.advance(tick * 3000L, 2));
            int added = game.snapshot().gifts.size() - before;
            assertTrue(added >= Math.min(1, 7 - before) && added <= 3);
            assertTrue(game.snapshot().gifts.size() <= 7);
        }
        assertEquals(7, game.snapshot().gifts.size());
        game.advance(150001, 0);
        assertEquals(5, game.snapshot().capacity); assertEquals(5, game.snapshot().gifts.size());
    }

    @Test public void lateTicksSpawnOneBatchAndConsumedGiftsCannotBeClaimedTwice() {
        GiftDropGame game = new GiftDropGame(0, 3000, 25, new Random(5));
        game.advance(300000, 10);
        GiftDropGame.Snapshot snapshot = game.snapshot();
        assertTrue(snapshot.gifts.size() <= 3); assertEquals(303000L, snapshot.nextSpawnAt);
        String id = snapshot.gifts.get(0).id;
        GiftDropGame.Gift reward = game.claim(id);
        assertEquals(reward.rewardLevel == GiftDropGame.ROTTEN_EGG_LEVEL ? 0.5D : 25D * (reward.rewardLevel + 1), reward.points, 0D);
        assertNull(game.claim(id)); assertNull(game.claim("fake"));
        assertTrue(game.snapshot().version > snapshot.version);
        assertEquals(snapshot.gifts.size() - 1, game.snapshot().gifts.size());
    }

    @Test public void publicSnapshotHidesTheContentsOfEveryUnopenedGift() throws Exception {
        GiftDropGame game = new GiftDropGame(0, 1, 10, new Random(1)); game.advance(1, 1);
        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(game.snapshot());
        assertTrue(json.contains("gameId")); assertTrue(json.contains("gifts"));
        assertFalse(json.contains("rewardLevel")); assertFalse(json.contains("points"));
        GiftDropGame newer = new GiftDropGame(0, 1, 10, new Random(1)); newer.advance(1, 1);
        assertNull(newer.claim(game.snapshot().gifts.get(0).id));
    }

    @Test public void eachHigherLevelIsRarerAndAllFifteenLevelsHaveTheirMatchingPoints() {
        GiftDropGame game = new GiftDropGame(0, 1, 10, new Random(7));
        int[] counts = new int[15]; int rottenCount = 0;
        for (int tick = 1; tick <= 100000; tick++) {
            game.advance(tick, 1);
            for (GiftDropGame.ClosedGift closed : game.snapshot().gifts) {
                GiftDropGame.Gift gift = game.claim(closed.id);
                if (gift.rewardLevel == GiftDropGame.ROTTEN_EGG_LEVEL) { rottenCount++; assertEquals(0.5D, gift.points, 0D); }
                else { counts[gift.rewardLevel]++; assertEquals((gift.rewardLevel + 1) * 10D, gift.points, 0D); }
            }
        }
        for (int level = 1; level < counts.length; level++) {
            assertTrue("Level " + level, counts[level] > 0 && counts[level] < counts[level - 1]);
        }
        assertTrue(rottenCount > 0);
    }

    @Test public void rottenEggAlwaysGivesHalfAPointRegardlessOfTheConfiguredBasePoints() {
        for (int base : new int[] {1,10,10000}) {
            GiftDropGame game = new GiftDropGame(0, 1, base, new Random() { public int nextInt(int bound) { return 0; } });
            game.advance(1,1); GiftDropGame.Gift gift = game.claim(game.snapshot().gifts.get(0).id);
            assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,gift.rewardLevel); assertEquals(0.5D,gift.points,0D);
        }
    }
}
