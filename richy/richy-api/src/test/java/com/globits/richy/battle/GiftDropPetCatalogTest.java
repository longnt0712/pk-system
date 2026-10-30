package com.globits.richy.battle;

import java.time.Instant;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class GiftDropPetCatalogTest {
    private static final long IN_SEASON = Instant.parse("2026-10-30T05:00:00Z").toEpochMilli();
    private static final long OUT_OF_SEASON = Instant.parse("2026-11-05T17:00:00Z").toEpochMilli();
    private static class Tickets extends Random {
        int ticket;
        @Override public int nextInt(int bound) { assertEquals(1000000,bound); return ticket; }
    }
    private int nextUser;
    private GiftDropGame.Gift gift(GiftDropGame game, Tickets random, int ticket, long now, boolean lightning, boolean hat, int stars) {
        String user = "catalog-" + (++nextUser); random.ticket = ticket;
        String id = game.snapshot(user).gifts.get(0).id;
        if (hat) { game.recordClaim(new GiftDropGame.Gift("hat",GiftDropGame.PERRY_HAT_LEVEL,1D),user,user,1D,now - 1L); }
        if (stars > 0) { game.recordClaim(new GiftDropGame.Gift("ball",1000 + stars,10D * stars),user,user,10D * stars,now - 1L); }
        return game.claim(user,id,lightning,now);
    }
    private int first(GiftDropGame game, Tickets random, int level, long now, boolean lightning, boolean hat, int stars) {
        int low = 0, high = 1000000;
        while (low < high) {
            int mid = low + (high - low) / 2;
            if (gift(game,random,mid,now,lightning,hat,stars).rewardLevel < level) { low = mid + 1; } else { high = mid; }
        }
        return low;
    }
    private int count(GiftDropGame game, Tickets random, int level, long now, boolean lightning, boolean hat, int stars) {
        return first(game,random,level + 1,now,lightning,hat,stars) - first(game,random,level,now,lightning,hat,stars);
    }

    @Test public void everySelectablePetFormHasAUniqueRandomRewardWithServerArtworkAndPoints() {
        Map<Integer,PetRewardCatalog.Reward> rewards = new HashMap<Integer,PetRewardCatalog.Reward>();
        for (PetRewardCatalog.Reward reward : PetRewardCatalog.rewards()) { assertNull(rewards.put(reward.level,reward)); }
        assertEquals(36,rewards.size());
        String[] files = {"sparkling-lightning/pet-level-20.png","goku-kid/egg-level-21.png","goku-kid/pet-level-22.png",
                "goku-kid/pet-level-23.png","goku-kid/pet-level-24.svg","goku-kid/pet-level-25.png","halloween-pumpkin/pet.png"};
        Tickets random = new Tickets(); GiftDropGame game = new GiftDropGame(10,random);
        for (int level = 0; level <= 28; level++) {
            int begin = first(game,random,level,IN_SEASON,false,false,0);
            assertTrue("Positive chance for reward " + level,count(game,random,level,IN_SEASON,false,false,0) > 0);
            GiftDropGame.Gift result = gift(game,random,begin,IN_SEASON,false,false,0);
            PetRewardCatalog.Reward reward = rewards.get(level);
            assertEquals(level,result.rewardLevel); assertEquals(reward.image,result.rewardImage); assertEquals(reward.label,result.rewardLabel);
            assertEquals(10D * (reward.referenceLevel + 1),result.points,0D);
            if (level >= 22) { assertTrue(result.rewardImage.endsWith(files[level - 22])); }
        }
        assertEquals("Son Goku Siêu Saiyan 4",rewards.get(27).label);
        assertEquals("Bí ngô Halloween",rewards.get(28).label);
        assertEquals(20,rewards.get(28).referenceLevel);
    }

    @Test public void halloweenDropsOnlyFromOctoberFirstThroughNovemberFifthInUtcPlusSevenEveryYear() {
        Tickets random = new Tickets(); GiftDropGame game = new GiftDropGame(10,random,GiftDropGame.SKILL_TYPES);
        String[] dates = {"2026-09-30T16:59:59.999Z","2026-09-30T17:00:00Z","2026-11-05T16:59:59.999Z",
                "2026-11-05T17:00:00Z","2027-09-30T16:59:59.999Z","2027-09-30T17:00:00Z"};
        boolean[] available = {false,true,true,false,false,true};
        for (int at = 0; at < dates.length; at++) {
            long now = Instant.parse(dates[at]).toEpochMilli();
            for (boolean lightning : new boolean[]{false,true}) for (boolean hat : new boolean[]{false,true}) for (int stars : new int[]{0,7}) {
                int tickets = count(game,random,28,now,lightning,hat,stars);
                assertEquals(dates[at] + " lightning " + lightning + " hat " + hat + " stars " + stars,available[at],tickets > 0);
                for (int ball = 1; ball <= 7; ball++) { assertEquals(8333,count(game,random,1000 + ball,now,lightning,hat,stars)); }
            }
        }
    }

    @Test public void anUnopenedFinalEggUsesClaimTimeAndRetainsItsTicketAcrossTheSeasonBoundary() {
        Tickets random = new Tickets(); GiftDropGame game = new GiftDropGame(10,random);
        int pumpkin = first(game,random,28,IN_SEASON,false,false,0); random.ticket = pumpkin;
        Map<String,Integer> credits = new LinkedHashMap<String,Integer>(); credits.put("alice",2);
        game.prepareFinalPools(credits);
        GiftDropGame.Snapshot before = game.snapshot("alice");
        String firstId = before.gifts.get(0).id, secondId = before.gifts.get(1).id;
        GiftDropGame.Gift collected = game.claim("alice",firstId,false,IN_SEASON);
        assertEquals(28,collected.rewardLevel); game.recordClaim(collected,"alice","Alice",collected.points,IN_SEASON);
        assertEquals(secondId,game.snapshot("alice").gifts.get(0).id);
        GiftDropGame.Gift afterExpiry = game.claim("alice",secondId,false,OUT_OF_SEASON);
        assertNotEquals(28,afterExpiry.rewardLevel); assertEquals(secondId,afterExpiry.id);
        assertEquals(before.capacity,game.snapshot("alice").capacity);
        assertEquals(28,game.snapshot().claims.get(0).rewardLevel);
        assertTrue(game.snapshot().claims.get(0).rewardImage.endsWith("halloween-pumpkin/pet.png"));
        assertNull(game.claim("alice",secondId,false,IN_SEASON));
    }

    @Test public void dragonBallBoostFollowsGokuSuperSaiyanFourAndLightningIncludesEveryHigherPet() {
        Tickets random = new Tickets(); GiftDropGame game = new GiftDropGame(10,random);
        for (long now : new long[]{IN_SEASON,OUT_OF_SEASON}) {
            int base = count(game,random,27,now,false,false,0);
            for (int stars = 1; stars <= 7; stars++) { assertEquals(base + stars * 10000,count(game,random,27,now,false,false,stars)); }
            for (int level : new int[]{9,20,22,23,24,25,26,27}) {
                int ordinary = count(game,random,level,now,false,false,0);
                assertEquals((int)Math.round(ordinary * 1.10D),count(game,random,level,now,true,false,0));
            }
        }
    }

    @Test public void seasonOpeningAlsoEnablesAnExistingFinalEggAndEveryEffectStillHonorsSeasonExpiry() {
        Tickets random = new Tickets(); GiftDropGame game = new GiftDropGame(10,random);
        long beforeOpening = Instant.parse("2026-09-30T16:59:59.999Z").toEpochMilli();
        long opening = beforeOpening + 1L;
        for (boolean lightning : new boolean[]{false,true}) for (boolean hat : new boolean[]{false,true}) for (int stars : new int[]{0,7}) {
            int pumpkin = first(game,random,28,opening,lightning,hat,stars);
            random.ticket = pumpkin;
            String owner = "transition-" + (++nextUser);
            Map<String,Integer> credits = new LinkedHashMap<String,Integer>(); credits.put(owner,2);
            game.prepareFinalPools(credits);
            String id = game.snapshot(owner).gifts.get(0).id;
            if (hat) { game.recordClaim(new GiftDropGame.Gift("hat",GiftDropGame.PERRY_HAT_LEVEL,1D),owner,owner,1D,opening - 1L); }
            if (stars > 0) { game.recordClaim(new GiftDropGame.Gift("ball",1000 + stars,10D * stars),owner,owner,10D * stars,opening - 1L); }
            assertEquals(28,game.claim(owner,id,lightning,opening).rewardLevel);
            int expiringPumpkin = first(game,random,28,OUT_OF_SEASON - 1L,lightning,hat,stars);
            random.ticket = expiringPumpkin; game.prepareFinalPools(credits);
            String expiryId = game.snapshot(owner).gifts.get(0).id;
            if (hat) { game.recordClaim(new GiftDropGame.Gift("hat",GiftDropGame.PERRY_HAT_LEVEL,1D),owner,owner,1D,OUT_OF_SEASON - 1L); }
            if (stars > 0) { game.recordClaim(new GiftDropGame.Gift("ball",1000 + stars,10D * stars),owner,owner,10D * stars,OUT_OF_SEASON - 1L); }
            assertNotEquals(28,game.claim(owner,expiryId,lightning,OUT_OF_SEASON).rewardLevel);
        }
    }
}
