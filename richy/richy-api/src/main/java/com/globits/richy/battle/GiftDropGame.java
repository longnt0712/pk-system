package com.globits.richy.battle;

import java.util.*;

/** Private pools of three eggs. The owning room lock serializes claims. */
public class GiftDropGame {
    public static final int ROTTEN_EGG_LEVEL = -1;
    public static final double ROTTEN_EGG_POINTS = 0.5D;
    public static final int SKILL_EGG_LEVEL = -2;
    public static final List<String> SKILL_TYPES = Collections.unmodifiableList(Arrays.asList("FREEZE", "STEAL_SCORE", "INVERT"));
    private static final int SKILL_EGG_WEIGHT = 2500;
    public static final int POOL_SIZE = 3;
    private static final int ROTTEN_EGG_WEIGHT = 10000;
    public static class Gift {
        public final String id;
        public final int rewardLevel;
        public final double points;
        public final String skillType;
        Gift(String id, int rewardLevel, double points) { this(id, rewardLevel, points, null); }
        Gift(String id, int rewardLevel, double points, String skillType) {
            this.id = id; this.rewardLevel = rewardLevel; this.points = points; this.skillType = skillType;
        }
    }
    public static class ClaimRecord {
        public final String id, username, displayName, skillType;
        public final int rewardLevel;
        public final double points;
        public final long claimedAt;
        ClaimRecord(Gift gift, String username, String displayName, double points, long claimedAt) {
            this.id = gift.id; this.username = username; this.displayName = displayName;
            this.skillType = gift.skillType; this.rewardLevel = gift.rewardLevel;
            this.points = points; this.claimedAt = claimedAt;
        }
    }
    public static class ClosedGift {
        public final String id;
        ClosedGift(String id) { this.id = id; }
    }
    public static class Snapshot {
        public final String gameId;
        public final long version;
        public final Long poolVersion;
        public final int capacity;
        public final List<ClosedGift> gifts;
        public final List<ClaimRecord> claims;
        Snapshot(GiftDropGame game, String username) {
            gameId = game.gameId; version = game.version; capacity = POOL_SIZE;
            poolVersion = username == null ? null : game.poolFor(username).version;
            gifts = username == null ? null : new ArrayList<ClosedGift>();
            if (username != null) {
                for (Gift gift : game.poolFor(username).gifts.values()) { gifts.add(new ClosedGift(gift.id)); }
            }
            claims = new ArrayList<ClaimRecord>(game.claims);
        }
    }
    private final String gameId = UUID.randomUUID().toString();
    private static class PlayerPool {
        final Map<String, Gift> gifts = new LinkedHashMap<String, Gift>();
        long version;
    }
    private final Map<String, PlayerPool> playerPools = new HashMap<String, PlayerPool>();
    private final List<ClaimRecord> claims = new ArrayList<ClaimRecord>();
    private final List<String> skillTypes = new ArrayList<String>();
    private final int basePoints;
    private final int[] weights = new int[15];
    private final int totalWeight;
    private final Random random;
    private long version, nextId;

    public GiftDropGame(int basePoints, Random random) {
        this(basePoints, random, Collections.<String>emptyList());
    }
    public GiftDropGame(int basePoints, Random random, List<String> enabledSkills) {
        if (basePoints <= 0) { throw new IllegalArgumentException("Gift settings required"); }
        this.basePoints = basePoints; this.random = random;
        for (String type : SKILL_TYPES) { if (enabledSkills != null && enabledSkills.contains(type)) { skillTypes.add(type); } }
        int total = 0;
        for (int level = 0; level < weights.length; level++) { weights[level] = (int) Math.round(10000D * Math.pow(0.75D, level)); total += weights[level]; }
        totalWeight = total;
    }
    private PlayerPool poolFor(String username) {
        PlayerPool pool = playerPools.get(username);
        if (pool == null) {
            pool = new PlayerPool();
            for (int i = 0; i < POOL_SIZE; i++) { Gift gift = drawGift(); pool.gifts.put(gift.id, gift); }
            playerPools.put(username, pool);
        }
        return pool;
    }
    private Gift drawGift() {
        String id = gameId + ":" + (++nextId);
        int skillWeight = skillTypes.size() * SKILL_EGG_WEIGHT;
        int draw = random.nextInt(totalWeight + ROTTEN_EGG_WEIGHT + skillWeight);
        if (draw < skillWeight) { return new Gift(id, SKILL_EGG_LEVEL, 0D, skillTypes.get(draw / SKILL_EGG_WEIGHT)); }
        draw -= skillWeight;
        if (draw < ROTTEN_EGG_WEIGHT) { return new Gift(id, ROTTEN_EGG_LEVEL, ROTTEN_EGG_POINTS); }
        draw -= ROTTEN_EGG_WEIGHT;
        int level = 0;
        while (level < weights.length - 1 && draw >= weights[level]) { draw -= weights[level++]; }
        return new Gift(id, level, basePoints * (level + 1));
    }
    public Gift claim(String username, String id) {
        PlayerPool pool = playerPools.get(username);
        Gift gift = pool == null ? null : pool.gifts.remove(id);
        if (gift != null) { Gift replacement = drawGift(); pool.gifts.put(replacement.id, replacement); pool.version++; version++; }
        return gift;
    }
    public void recordClaim(Gift gift, String username, String displayName, double awardedPoints, long now) {
        claims.add(0, new ClaimRecord(gift, username, displayName, awardedPoints, now));
        if (claims.size() > 200) { claims.remove(claims.size() - 1); }
        version++;
    }
    public void creditChanged() { version++; }
    public Snapshot snapshot() { return new Snapshot(this, null); }
    public Snapshot snapshot(String username) { return new Snapshot(this, username); }
}
