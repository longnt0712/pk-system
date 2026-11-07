package com.globits.richy.battle;
import java.util.Random;
import org.junit.Test;
import static org.junit.Assert.*;
public class GiftLightningGameTest {
    private Random always() { return new Random() { @Override public int nextInt(int bound) { return 0; } }; }
    @Test public void aPickupBenefitsTheRoomForExactlyThirtySecondsAndDoesNotStack() {
        GiftLightningGame game = new GiftLightningGame(1000L, 301000L, always());
        assertFalse(game.isActive(1000L)); assertTrue(game.tryCollect(11000L, "alice", "Alice"));
        assertTrue(game.isActive(40999L)); assertFalse(game.isActive(41000L));
        assertFalse(game.tryCollect(12000L, "bob", "Bob"));
        assertEquals("Alice", game.snapshot(12000L).displayName); assertEquals(41000L, game.snapshot(12000L).endsAt);
    }
    @Test public void fiveMinutesOfferTwoThirtySecondPickupsAndExtensionsIncreaseTheBudget() {
        GiftLightningGame game = new GiftLightningGame(0L, 300000L, always());
        assertFalse(game.tryCollect(0L,"a","A")); assertTrue(game.tryCollect(10000L,"a","A")); assertFalse(game.tryCollect(40000L,"b","B"));
        assertFalse(game.tryCollect(150000L,"b","B")); assertTrue(game.tryCollect(160000L,"b","B")); assertFalse(game.tryCollect(250000L,"c","C"));
        game.extendTo(450000L); assertFalse(game.tryCollect(300000L,"c","C")); assertTrue(game.tryCollect(310000L,"c","C"));
        assertEquals(3,game.snapshot(310000L).collectedCount);
    }
    @Test public void shortGamesStillOfferOneFullWindowAndNoPickupCanStartTooLate() {
        GiftLightningGame shortGame = new GiftLightningGame(0L,60000L,always());
        assertTrue(shortGame.tryCollect(10000L,"a","A")); assertFalse(shortGame.tryCollect(30001L,"a","A"));
        assertFalse(new GiftLightningGame(0L,29000L,always()).tryCollect(0L,"a","A"));
        assertFalse(new GiftLightningGame(0L,180000L,always()).tryCollect(150001L,"a","A"));
    }
    @Test public void onlyAnActualRandomPickupStartsTheEffectAndStoppingClearsIt() {
        GiftLightningGame game = new GiftLightningGame(0L,300000L,new Random(){@Override public int nextInt(int bound){return 1;}});
        assertFalse(game.tryCollect(20000L,"a","A")); assertFalse(game.snapshot(20000L).active);
        GiftLightningGame winner = new GiftLightningGame(0L,300000L,always()); winner.tryCollect(10000L,"a","A"); winner.stop();
        assertFalse(winner.snapshot(10001L).active);
    }

    @Test public void firstEligibilityIsRandomAndEarlyCrowdsOrRefreshesCannotAdvanceIt() {
        Random late = new Random() { @Override public int nextInt(int bound) { return bound == 5 ? 0 : bound - 1; } };
        GiftLightningGame early = new GiftLightningGame(1000L,301000L,always()), delayed = new GiftLightningGame(1000L,301000L,late);
        for (int player=0;player<100;player++) {
            assertFalse(early.tryCollect(1000L+player,"early-"+player,"Early"));
            assertFalse(delayed.tryCollect(1000L+player,"late-"+player,"Late"));
            assertFalse(delayed.snapshot(1000L+player).active);
        }
        assertTrue(early.tryCollect(11000L,"a","A"));
        assertFalse(delayed.tryCollect(11000L,"b","B"));
        delayed.extendTo(451000L); // Extending a match must not reroll an already scheduled window.
        assertFalse(delayed.tryCollect(120999L,"b","B"));
        assertTrue(delayed.tryCollect(121000L,"b","B"));
    }

    @Test public void aShortStageNeedsRoomForTheDelayAndAFullyTimedEffectAndCanBeExtended() {
        GiftLightningGame game = new GiftLightningGame(0L,30000L,always());
        assertFalse(game.tryCollect(0L,"a","A")); assertFalse(game.tryCollect(1L,"a","A"));
        game.extendTo(60000L); assertFalse(game.tryCollect(9999L,"a","A"));
        assertTrue(game.tryCollect(10000L,"a","A")); assertEquals(40000L,game.snapshot(10000L).endsAt);
        GiftLightningGame brief = new GiftLightningGame(0L,31000L,always());
        assertFalse(brief.tryCollect(999L,"a","A")); assertTrue(brief.tryCollect(1000L,"a","A"));
    }
}
