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
        assertFalse(json.contains("rewardImage")); assertFalse(json.contains("rewardLabel"));
        assertEquals(initial.gifts.get(0).id, game.snapshot("alice").gifts.get(0).id);
        assertNull(new GiftDropGame(10, new Random(1)).claim("alice", initial.gifts.get(0).id));
    }

    private static class TicketRandom extends Random {
        int ticket;
        @Override public int nextInt(int bound) {
            assertEquals("Each ticket represents one millionth of the full draw",1000000,bound);
            return ticket;
        }
    }

    private GiftDropGame.Gift giftAt(GiftDropGame game, TicketRandom random, int ticket) {
        random.ticket = ticket;
        String username = "ticket-" + ticket;
        return game.claim(username,game.snapshot(username).gifts.get(0).id);
    }

    /** Locate actual reward transitions using draws, without depending on internal weight fields. */
    private int firstTicketForLevel(GiftDropGame game, TicketRandom random, int level) {
        int low = 0, high = 1000000;
        while (low < high) {
            int middle = low + (high - low) / 2;
            if (giftAt(game,random,middle).rewardLevel < level) { low = middle + 1; }
            else { high = middle; }
        }
        return low;
    }

    private int ticketsForLevel(GiftDropGame game, TicketRandom random, int level) {
        return firstTicketForLevel(game,random,level + 1) - firstTicketForLevel(game,random,level);
    }

    private List<PetRewardCatalog.Reward> knownCatalog() {
        List<PetRewardCatalog.Reward> known = new ArrayList<PetRewardCatalog.Reward>();
        for (PetRewardCatalog.Reward reward : PetRewardCatalog.rewards()) {
            if (reward.level <= 20) { known.add(reward); }
        }
        return known;
    }

    @Test public void originalRewardsKeepTheirRarityAndEveryStageHasItsMatchingPointsAndArtwork() {
        TicketRandom random = new TicketRandom();
        GiftDropGame game = new GiftDropGame(10,random,Collections.<String>emptyList(),knownCatalog());
        int previousTickets = 1000000;
        for (PetRewardCatalog.Reward reward : knownCatalog()) {
            int first = firstTicketForLevel(game,random,reward.level);
            int tickets = ticketsForLevel(game,random,reward.level);
            assertTrue("Level " + reward.level,tickets > 0);
            if (reward.level < 15 || reward.level % 3 != 0) {
                assertTrue("Level " + reward.level,tickets < previousTickets);
            }
            previousTickets = tickets;
            GiftDropGame.Gift gift = giftAt(game,random,first);
            assertEquals(reward.level,gift.rewardLevel); assertEquals((reward.level + 1) * 10D,gift.points,0D);
            assertEquals(reward.image,gift.rewardImage); assertEquals(reward.label,gift.rewardLabel);
            assertEquals(reward.level,giftAt(game,random,first + tickets - 1).rewardLevel);
        }
        assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,giftAt(game,random,0).rewardLevel);
    }

    @Test public void eachFamilyReducesTheCorrespondingJerryFormByPointZeroOnePercentagePointsForAllSkills() {
        int[][] expectedTickets = {{6300,4700,3600},{6200,4600,3500},{6100,4500,3400},{6000,4400,3300}};
        List<PetRewardCatalog.Reward> catalog = knownCatalog();
        for (int level = 21; level <= 23; level++) {
            catalog.add(new PetRewardCatalog.Reward(level,"assets/images/learning-pets/future/stage-" + level + ".png","Future " + level));
        }
        for (int mask = 0; mask < (1 << GiftDropGame.SKILL_TYPES.size()); mask++) {
            List<String> skills = new ArrayList<String>();
            for (int index = 0; index < GiftDropGame.SKILL_TYPES.size(); index++) {
                if ((mask & (1 << index)) != 0) { skills.add(GiftDropGame.SKILL_TYPES.get(index)); }
            }
            TicketRandom random = new TicketRandom();
            GiftDropGame game = new GiftDropGame(10,random,skills,catalog);
            for (int level = 12; level <= 23; level++) {
                int tickets = ticketsForLevel(game,random,level);
                assertEquals("Level " + level + " with skills " + skills,expectedTickets[(level - 12) / 3][level % 3],tickets);
                int first = firstTicketForLevel(game,random,level);
                assertEquals(level,giftAt(game,random,first).rewardLevel);
                assertEquals(level,giftAt(game,random,first + tickets - 1).rewardLevel);
                if (first > 0) { assertEquals(level - 1,giftAt(game,random,first - 1).rewardLevel); }
            }
            assertEquals(23,giftAt(game,random,999999).rewardLevel);
        }
    }

    @Test public void rarityUsesManifestFamilyAndFormWhenStageLevelsAreNonconsecutiveAndInterleaved() {
        List<PetRewardCatalog.Reward> catalog = knownCatalog();
        catalog.add(new PetRewardCatalog.Reward(21,"alpha-pet.png","Alpha","alpha","hatched"));
        catalog.add(new PetRewardCatalog.Reward(22,"beta-egg.png","Beta","beta","egg-intact"));
        catalog.add(new PetRewardCatalog.Reward(30,"alpha-egg.png","Alpha","alpha","egg-intact"));
        catalog.add(new PetRewardCatalog.Reward(31,"beta-pet.png","Beta","beta","hatched"));
        catalog.add(new PetRewardCatalog.Reward(35,"alpha-cracked.png","Alpha","alpha","egg-cracked"));
        TicketRandom random = new TicketRandom();
        GiftDropGame game = new GiftDropGame(10,random,Collections.<String>emptyList(),catalog);
        for (int[] expected : new int[][] {{21,3300},{22,5900},{30,6000},{31,3200},{35,4400}}) {
            assertEquals("Level " + expected[0],expected[1],ticketsForLevel(game,random,expected[0]));
        }
    }

    @Test public void perryMatchesHatchedMamHocExactlyWithoutChangingNewFamilyRarityForEverySkillCombination() {
        for (boolean includeFuturePet : new boolean[] {false,true}) {
            List<PetRewardCatalog.Reward> catalog = knownCatalog();
            catalog.add(new PetRewardCatalog.Reward(21,"assets/images/learning-pets/perry/perry.png","Perry","perry","hatched",2));
            if (includeFuturePet) {
                catalog.add(new PetRewardCatalog.Reward(22,"future-egg.png","Future egg","future","egg-intact"));
                catalog.add(new PetRewardCatalog.Reward(23,"future-cracked.png","Future cracked","future","egg-cracked"));
                catalog.add(new PetRewardCatalog.Reward(24,"future-pet.png","Future","future","hatched"));
            }
            for (int mask = 0; mask < (1 << GiftDropGame.SKILL_TYPES.size()); mask++) {
                List<String> skills = new ArrayList<String>();
                for (int index = 0; index < GiftDropGame.SKILL_TYPES.size(); index++) {
                    if ((mask & (1 << index)) != 0) { skills.add(GiftDropGame.SKILL_TYPES.get(index)); }
                }
                TicketRandom random = new TicketRandom();
                GiftDropGame game = new GiftDropGame(10,random,skills,catalog);
                int mamHocTickets = ticketsForLevel(game,random,2), perryTickets = ticketsForLevel(game,random,21);
                assertTrue(mamHocTickets > 0);
                assertEquals("Perry and the grown Mầm Học must have identical probabilities with skills " + skills,mamHocTickets,perryTickets);
                int first = firstTicketForLevel(game,random,21);
                GiftDropGame.Gift perry = giftAt(game,random,first);
                assertEquals(21,perry.rewardLevel); assertEquals("Perry",perry.rewardLabel);
                assertEquals("assets/images/learning-pets/perry/perry.png",perry.rewardImage);
                assertEquals(30D,perry.points,0D);
                assertEquals(giftAt(game,random,firstTicketForLevel(game,random,2)).points,perry.points,0D);
                assertEquals(20,giftAt(game,random,first - 1).rewardLevel);
                assertEquals(21,giftAt(game,random,first + perryTickets - 1).rewardLevel);
                for (int[] expected : new int[][] {{12,6300},{13,4700},{14,3600},{15,6200},{16,4600},{17,3500},{18,6100},{19,4500},{20,3400}}) {
                    assertEquals("Existing rare reward " + expected[0],expected[1],ticketsForLevel(game,random,expected[0]));
                }
                if (includeFuturePet) {
                    assertEquals(22,giftAt(game,random,first + perryTickets).rewardLevel);
                    assertEquals(6000,ticketsForLevel(game,random,22));
                    assertEquals(4400,ticketsForLevel(game,random,23));
                    assertEquals(3300,ticketsForLevel(game,random,24));
                } else { assertEquals(21,giftAt(game,random,999999).rewardLevel); }
            }
        }
    }

    @Test public void injectedFutureRewardsHaveNoLevelCapAndClaimsKeepTheirMetadata() {
        for (final int level : new int[] {21,22,23,120,210}) {
            List<PetRewardCatalog.Reward> rewards = knownCatalog();
            for (int future = 21; future <= level; future++) {
                rewards.add(new PetRewardCatalog.Reward(future,"assets/images/learning-pets/future/pet-level-" + future + ".png","Pet " + future));
            }
            TicketRandom random = new TicketRandom(); random.ticket = 999999;
            GiftDropGame game = new GiftDropGame(10,random,Collections.<String>emptyList(),rewards);
            GiftDropGame.Snapshot before = game.snapshot("alice");
            GiftDropGame.Gift gift = game.claim("alice",before.gifts.get(0).id);
            assertEquals(level,gift.rewardLevel); assertEquals(10D * (level + 1D),gift.points,0D);
            assertEquals("assets/images/learning-pets/future/pet-level-" + level + ".png",gift.rewardImage);
            assertEquals("Pet " + level,gift.rewardLabel);
            game.recordClaim(gift,"alice","Alice",gift.points,123L);
            GiftDropGame.ClaimRecord claim = game.snapshot().claims.get(0);
            assertEquals(gift.rewardLevel,claim.rewardLevel); assertEquals(gift.rewardImage,claim.rewardImage);
            assertEquals(gift.rewardLabel,claim.rewardLabel); assertEquals(gift.points,claim.points,0D);
            assertNull(game.claim("alice",gift.id));
            if (level == 120) { assertEquals(2700,ticketsForLevel(game,random,level)); }
            if (level == 210) { assertEquals("Distant stages retain the minimum 0.01% draw chance",100,ticketsForLevel(game,random,level)); }
        }
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

    @Test public void perryHatHasExactlyTheRottenEggProbabilityForAllSkillChoicesAndFuturePets() {
        for (boolean includeFuturePet : new boolean[] {false,true}) {
            List<PetRewardCatalog.Reward> catalog = new ArrayList<PetRewardCatalog.Reward>(PetRewardCatalog.rewards());
            if (includeFuturePet) {
                catalog.add(new PetRewardCatalog.Reward(22,"future-egg.png","Future egg","future","egg-intact"));
                catalog.add(new PetRewardCatalog.Reward(23,"future-cracked.png","Future cracked","future","egg-cracked"));
                catalog.add(new PetRewardCatalog.Reward(24,"future-pet.png","Future","future","hatched"));
            }
            for (int mask = 0; mask < (1 << GiftDropGame.SKILL_TYPES.size()); mask++) {
                List<String> skills = new ArrayList<String>();
                for (int i = 0; i < GiftDropGame.SKILL_TYPES.size(); i++) {
                    if ((mask & (1 << i)) != 0) { skills.add(GiftDropGame.SKILL_TYPES.get(i)); }
                }
                TicketRandom random = new TicketRandom();
                GiftDropGame game = new GiftDropGame(10,random,skills,catalog);
                int firstPet = firstTicketForLevel(game,random,0);
                int low = 0, high = firstPet;
                while (low < high) {
                    int middle = low + (high - low) / 2;
                    if (giftAt(game,random,middle).skillType != null) { low = middle + 1; }
                    else { high = middle; }
                }
                int firstRotten = low;
                high = firstPet;
                while (low < high) {
                    int middle = low + (high - low) / 2;
                    if (giftAt(game,random,middle).rewardLevel == GiftDropGame.ROTTEN_EGG_LEVEL) { low = middle + 1; }
                    else { high = middle; }
                }
                int firstHat = low, rottenTickets = firstHat - firstRotten, hatTickets = firstPet - firstHat;
                assertTrue(rottenTickets > 0);
                assertEquals("Mũ Perry and rotten eggs with skills " + skills,rottenTickets,hatTickets);
                assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,giftAt(game,random,firstRotten).rewardLevel);
                assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,giftAt(game,random,firstHat - 1).rewardLevel);
                for (int ticket : new int[] {firstHat,firstPet - 1}) {
                    GiftDropGame.Gift hat = giftAt(game,random,ticket);
                    assertEquals(GiftDropGame.PERRY_HAT_LEVEL,hat.rewardLevel); assertEquals(1D,hat.points,0D);
                    assertNull(hat.skillType); assertEquals("Mũ Perry",hat.rewardLabel);
                    assertEquals("assets/images/learning-pets/perry/perry-hat.png",hat.rewardImage);
                }
                assertEquals(0,giftAt(game,random,firstPet).rewardLevel);
                int total = firstRotten + rottenTickets + hatTickets;
                for (PetRewardCatalog.Reward reward : catalog) { total += ticketsForLevel(game,random,reward.level); }
                assertEquals("The complete draw must still contain one million tickets",1000000,total);
                assertEquals(ticketsForLevel(game,random,2),ticketsForLevel(game,random,21));
                for (int[] expected : new int[][] {{12,6300},{13,4700},{14,3600},{15,6200},{16,4600},{17,3500},{18,6100},{19,4500},{20,3400}}) {
                    assertEquals(expected[1],ticketsForLevel(game,random,expected[0]));
                }
            }
        }
    }

    @Test public void perryHatAlwaysGivesOnePointRegardlessOfConfiguredBasePoints() {
        for (int base : new int[] {1,10,10000}) {
            TicketRandom random = new TicketRandom();
            GiftDropGame game = new GiftDropGame(base,random);
            int firstPet = firstTicketForLevel(game,random,0);
            GiftDropGame.Gift hat = giftAt(game,random,firstPet - 1);
            assertEquals(GiftDropGame.PERRY_HAT_LEVEL,hat.rewardLevel); assertEquals(1D,hat.points,0D);
            game.recordClaim(hat,"alice","Alice",hat.points,123L);
            GiftDropGame.ClaimRecord record = game.snapshot().claims.get(0);
            assertEquals(hat.rewardLevel,record.rewardLevel); assertEquals(1D,record.points,0D);
            assertEquals(hat.rewardImage,record.rewardImage); assertEquals(hat.rewardLabel,record.rewardLabel);
        }
    }
}
