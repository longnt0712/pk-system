package com.globits.richy.battle;

import java.util.*;

/** Shared gift pool. Its owning room lock serializes advances and claims. */
public class GiftDropGame {
    public static final int ROTTEN_EGG_LEVEL = -1;
    public static final double ROTTEN_EGG_POINTS = 0.5D;
    private static final int ROTTEN_EGG_WEIGHT = 10000;
    public static class Gift {
        public final String id;
        public final int rewardLevel;
        public final double points;
        Gift(String id, int rewardLevel, double points) { this.id = id; this.rewardLevel = rewardLevel; this.points = points; }
    }
    public static class ClosedGift {
        public final String id;
        ClosedGift(String id) { this.id = id; }
    }
    public static class Snapshot {
        public final String gameId;
        public final long version, nextSpawnAt;
        public final int capacity;
        public final List<ClosedGift> gifts;
        Snapshot(GiftDropGame game) {
            gameId = game.gameId; version = game.version; nextSpawnAt = game.nextSpawnAt; capacity = game.capacity;
            gifts = new ArrayList<ClosedGift>();
            for (Gift gift : game.gifts.values()) { gifts.add(new ClosedGift(gift.id)); }
        }
    }
    private final String gameId = UUID.randomUUID().toString();
    private final Map<String, Gift> gifts = new LinkedHashMap<String, Gift>();
    private final int basePoints;
    private final int[] weights = new int[15];
    private final int totalWeight;
    private final Random random;
    private final long intervalMs;
    private long nextSpawnAt, version, nextId;
    private int capacity;

    public GiftDropGame(long now, long intervalMs, int basePoints, Random random) {
        if (intervalMs <= 0 || basePoints <= 0) { throw new IllegalArgumentException("Gift settings required"); }
        this.intervalMs = intervalMs; this.basePoints = basePoints; this.random = random;
        int total = 0;
        for (int level = 0; level < weights.length; level++) { weights[level] = (int) Math.round(10000D * Math.pow(0.75D, level)); total += weights[level]; }
        totalWeight = total;
        nextSpawnAt = now + intervalMs;
    }
    public boolean advance(long now, int players) {
        int limit = Math.max(0, players) + 5;
        boolean changed = limit != capacity; capacity = limit;
        Iterator<String> ids = gifts.keySet().iterator();
        while (gifts.size() > capacity) { ids.next(); ids.remove(); changed = true; }
        if (now >= nextSpawnAt) {
            nextSpawnAt = now + intervalMs;
            int count = Math.min(capacity - gifts.size(), 1 + random.nextInt(3));
            for (int i = 0; i < count; i++) {
                String id = gameId + ":" + (++nextId);
                int draw = random.nextInt(totalWeight + ROTTEN_EGG_WEIGHT);
                if (draw < ROTTEN_EGG_WEIGHT) {
                    gifts.put(id, new Gift(id, ROTTEN_EGG_LEVEL, ROTTEN_EGG_POINTS));
                } else {
                    draw -= ROTTEN_EGG_WEIGHT;
                    int level = 0;
                    while (level < weights.length - 1 && draw >= weights[level]) { draw -= weights[level++]; }
                    gifts.put(id, new Gift(id, level, basePoints * (level + 1)));
                }
            }
            changed = true;
        }
        if (changed) { version++; }
        return changed;
    }
    public Gift claim(String id) { Gift gift = gifts.remove(id); if (gift != null) { version++; } return gift; }
    public void creditChanged() { version++; }
    public Snapshot snapshot() { return new Snapshot(this); }
}
