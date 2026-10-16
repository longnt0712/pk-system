package com.globits.richy.battle;

import java.util.Random;
import java.util.UUID;

/** A room-wide bonus can start only when a player opens an eligible egg. */
public final class GiftLightningGame {
    public static final long DURATION_MS = 30000L;
    private static final long PERIOD_MS = 150000L;
    private final String id = UUID.randomUUID().toString();
    private final long stageStartsAt;
    private final Random random;
    private long stageEndsAt, startsAt, endsAt;
    private int collectedCount;
    private String username, displayName;

    public GiftLightningGame(long stageStartsAt, long stageEndsAt, Random random) {
        this.stageStartsAt = stageStartsAt; this.stageEndsAt = stageEndsAt; this.random = random;
    }
    public void extendTo(long deadline) { stageEndsAt = Math.max(stageEndsAt, deadline); }
    public boolean isActive(long now) { return now >= startsAt && endsAt > now && now < stageEndsAt; }
    public boolean tryCollect(long now, String username, String displayName) {
        long duration = Math.max(0L, stageEndsAt - stageStartsAt);
        long budget = duration < DURATION_MS ? 0L : Math.max(1L, Math.round(duration / (double) PERIOD_MS));
        if (now < stageStartsAt || isActive(now) || now + DURATION_MS > stageEndsAt || collectedCount >= budget ||
                now < stageStartsAt + collectedCount * PERIOD_MS || random.nextInt(5) != 0) { return false; }
        this.username = username; this.displayName = displayName;
        startsAt = now; endsAt = now + DURATION_MS; collectedCount++;
        return true;
    }
    public void stop() { endsAt = 0L; }
    public Snapshot snapshot(long now) { return new Snapshot(this, now); }
    public static final class Snapshot {
        public final String id, username, displayName;
        public final boolean active;
        public final long startsAt, endsAt;
        public final int collectedCount;
        public final double relativeBoost = 0.10D;
        private Snapshot(GiftLightningGame game, long now) {
            id = game.id; username = game.username; displayName = game.displayName;
            active = game.isActive(now); startsAt = game.startsAt; endsAt = game.endsAt; collectedCount = game.collectedCount;
        }
    }
}
