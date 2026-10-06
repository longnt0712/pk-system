package com.globits.richy.battle;

import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class GiftDropGameTest {
    @Test public void everyPlayerImmediatelyHasThreeEggsAndClaimsRefillOnlyTheirOwnPool() {
        GiftDropGame game = new GiftDropGame(10, new Random(3));
        GiftDropGame.Snapshot alice = game.snapshot("alice"), bob = game.snapshot("bob");
        assertEquals(3, alice.capacity); assertEquals(3, alice.gifts.size()); assertEquals(3, bob.gifts.size());
        String id = alice.gifts.get(0).id;
        assertNull(game.claim("bob", id));
        assertNotNull(game.claim("alice", id)); assertNull(game.claim("alice", id));
        assertEquals(3, game.snapshot("alice").gifts.size());
        for (int i = 0; i < 3; i++) { assertEquals(bob.gifts.get(i).id, game.snapshot("bob").gifts.get(i).id); }
        for (GiftDropGame.ClosedGift egg : game.snapshot("alice").gifts) { assertNotEquals(id, egg.id); }
        assertNull(game.snapshot().gifts);
    }

    @Test public void snapshotsHideUnopenedRewardsAndRefreshingCannotRerollThePool() throws Exception {
        GiftDropGame game = new GiftDropGame(10, new Random(1));
        GiftDropGame.Snapshot initial = game.snapshot("alice");
        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(initial);
        assertFalse(json.contains("rewardLevel")); assertFalse(json.contains("points")); assertFalse(json.contains("skillType"));
        assertEquals(initial.gifts.get(0).id, game.snapshot("alice").gifts.get(0).id);
        assertNull(new GiftDropGame(10, new Random(1)).claim("alice", initial.gifts.get(0).id));
    }

    @Test public void eachHigherLevelIsRarerAndAllRewardsHaveTheirMatchingPoints() {
        GiftDropGame game = new GiftDropGame(10, new Random(7));
        int[] counts = new int[15]; int rottenCount = 0;
        for (int pick = 0; pick < 100000; pick++) {
            GiftDropGame.Gift gift = game.claim("alice", game.snapshot("alice").gifts.get(0).id);
            if (gift.rewardLevel == GiftDropGame.ROTTEN_EGG_LEVEL) { rottenCount++; assertEquals(0.5D, gift.points, 0D); }
            else { counts[gift.rewardLevel]++; assertEquals((gift.rewardLevel + 1) * 10D, gift.points, 0D); }
        }
        for (int level = 1; level < counts.length; level++) { assertTrue("Level " + level, counts[level] > 0 && counts[level] < counts[level - 1]); }
        assertTrue(rottenCount > 0);
    }

    @Test public void skillEggsOnlyContainEnabledSupportedSkills() {
        GiftDropGame game = new GiftDropGame(10, new Random(11), Arrays.asList("INVERT", "STEAL_SCORE", "FIRE_UP"));
        Set<String> seen = new HashSet<String>();
        for (int pick = 0; pick < 1000; pick++) {
            GiftDropGame.Gift gift = game.claim("alice", game.snapshot("alice").gifts.get(0).id);
            if (gift.skillType != null) {
                seen.add(gift.skillType); assertEquals(GiftDropGame.SKILL_EGG_LEVEL, gift.rewardLevel); assertEquals(0D, gift.points, 0D);
            }
        }
        assertEquals(new HashSet<String>(Arrays.asList("INVERT", "STEAL_SCORE")), seen);
    }

    @Test public void rottenEggAlwaysGivesHalfAPointRegardlessOfConfiguredBasePoints() {
        for (int base : new int[] {1,10,10000}) {
            GiftDropGame game = new GiftDropGame(base, new Random() { public int nextInt(int bound) { return 0; } });
            GiftDropGame.Gift gift = game.claim("alice", game.snapshot("alice").gifts.get(0).id);
            assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL, gift.rewardLevel); assertEquals(0.5D, gift.points, 0D);
        }
    }
}
