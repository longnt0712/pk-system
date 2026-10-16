package com.globits.richy.battle;
import java.util.Random;
import org.junit.Test;
import static org.junit.Assert.*;
public class GiftLightningGameTest {
    private Random always() { return new Random() { @Override public int nextInt(int bound) { return 0; } }; }
    @Test public void aPickupBenefitsTheRoomForExactlyThirtySecondsAndDoesNotStack() {
        GiftLightningGame game = new GiftLightningGame(1000L, 301000L, always());
        assertFalse(game.isActive(1000L)); assertTrue(game.tryCollect(1100L, "alice", "Alice"));
        assertTrue(game.isActive(31099L)); assertFalse(game.isActive(31100L));
        assertFalse(game.tryCollect(1200L, "bob", "Bob"));
        assertEquals("Alice", game.snapshot(1200L).displayName); assertEquals(31100L, game.snapshot(1200L).endsAt);
    }
    @Test public void fiveMinutesOfferTwoThirtySecondPickupsAndExtensionsIncreaseTheBudget() {
        GiftLightningGame game = new GiftLightningGame(0L, 300000L, always());
        assertTrue(game.tryCollect(0L,"a","A")); assertFalse(game.tryCollect(30000L,"b","B"));
        assertTrue(game.tryCollect(150000L,"b","B")); assertFalse(game.tryCollect(250000L,"c","C"));
        game.extendTo(450000L); assertTrue(game.tryCollect(300000L,"c","C"));
        assertEquals(3,game.snapshot(300000L).collectedCount);
    }
    @Test public void shortGamesStillOfferOneFullWindowAndNoPickupCanStartTooLate() {
        GiftLightningGame shortGame = new GiftLightningGame(0L,60000L,always());
        assertTrue(shortGame.tryCollect(0L,"a","A")); assertFalse(shortGame.tryCollect(30001L,"a","A"));
        assertFalse(new GiftLightningGame(0L,29000L,always()).tryCollect(0L,"a","A"));
        assertFalse(new GiftLightningGame(0L,180000L,always()).tryCollect(150001L,"a","A"));
    }
    @Test public void onlyAnActualRandomPickupStartsTheEffectAndStoppingClearsIt() {
        GiftLightningGame game = new GiftLightningGame(0L,300000L,new Random(){@Override public int nextInt(int bound){return 1;}});
        assertFalse(game.tryCollect(0L,"a","A")); assertFalse(game.snapshot(1000L).active);
        GiftLightningGame winner = new GiftLightningGame(0L,300000L,always()); winner.tryCollect(0L,"a","A"); winner.stop();
        assertFalse(winner.snapshot(1L).active);
    }
}
