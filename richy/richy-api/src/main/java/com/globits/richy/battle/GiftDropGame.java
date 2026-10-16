package com.globits.richy.battle;

import java.util.*;

/** Private egg pools. The owning room lock serializes claims. */
public class GiftDropGame {
    public static final int ROTTEN_EGG_LEVEL = -1;
    public static final double ROTTEN_EGG_POINTS = 0.5D;
    public static final int SKILL_EGG_LEVEL = -2;
    public static final List<String> SKILL_TYPES = Collections.unmodifiableList(Arrays.asList("FREEZE", "STEAL_SCORE", "INVERT"));
    private static final int SKILL_EGG_WEIGHT = 2500;
    public static final int POOL_SIZE = 3;
    private static final int ROTTEN_EGG_WEIGHT = 10000;
    // Each new pet is 0.01 percentage points rarer in each matching form column.
    // Jerry's intact/cracked/hatched reference rates are 0.63% / 0.47% / 0.36%.
    private static final int NEW_REWARD_MIN_LEVEL = 15;
    private static final int DRAW_RESOLUTION = 1000000;
    private static final int NEW_REWARD_STEP = 100;
    private static final int[] JERRY_FORM_TICKETS = {6300, 4700, 3600};
    public static class Gift {
        public final String id;
        public final int rewardLevel;
        public final double points;
        public final String skillType;
        public final String rewardImage, rewardLabel;
        Gift(String id, int rewardLevel, double points) { this(id, rewardLevel, points, null); }
        Gift(String id, int rewardLevel, double points, String skillType) {
            this(id, rewardLevel, points, skillType, null, null);
        }
        Gift(String id, int rewardLevel, double points, String skillType, String rewardImage, String rewardLabel) {
            this.id = id; this.rewardLevel = rewardLevel; this.points = points; this.skillType = skillType;
            this.rewardImage = rewardImage; this.rewardLabel = rewardLabel;
        }
    }
    public static class ClaimRecord {
        public final String id, username, displayName, skillType;
        public final String rewardImage, rewardLabel;
        public final int rewardLevel;
        public final double points;
        public final long claimedAt;
        ClaimRecord(Gift gift, String username, String displayName, double points, long claimedAt) {
            this.id = gift.id; this.username = username; this.displayName = displayName;
            this.skillType = gift.skillType; this.rewardLevel = gift.rewardLevel;
            this.rewardImage = gift.rewardImage; this.rewardLabel = gift.rewardLabel;
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
            PlayerPool pool = username == null ? null : game.poolFor(username);
            gameId = game.gameId; version = game.version; capacity = pool == null ? POOL_SIZE : pool.capacity;
            poolVersion = pool == null ? null : pool.version;
            gifts = username == null ? null : new ArrayList<ClosedGift>();
            if (username != null) {
                for (Gift gift : pool.gifts.values()) { gifts.add(new ClosedGift(gift.id)); }
            }
            claims = new ArrayList<ClaimRecord>(game.claims);
        }
    }
    private final String gameId = UUID.randomUUID().toString();
    private static class PlayerPool {
        final Map<String, Gift> gifts = new LinkedHashMap<String, Gift>();
        int capacity = POOL_SIZE;
        long version;
    }
    private final Map<String, PlayerPool> playerPools = new HashMap<String, PlayerPool>();
    private final List<ClaimRecord> claims = new ArrayList<ClaimRecord>();
    private final List<String> skillTypes = new ArrayList<String>();
    private final int basePoints;
    private final List<PetRewardCatalog.Reward> commonRewards = new ArrayList<PetRewardCatalog.Reward>();
    private final List<PetRewardCatalog.Reward> newRewards = new ArrayList<PetRewardCatalog.Reward>();
    private final int[] weights, newWeights;
    private final int[] skillWeights;
    private final int rottenWeight;
    private final int totalWeight;
    private final Random random;
    private long version, nextId;
    private boolean finalPools;

    public GiftDropGame(int basePoints, Random random) {
        this(basePoints, random, Collections.<String>emptyList());
    }
    public GiftDropGame(int basePoints, Random random, List<String> enabledSkills) {
        this(basePoints, random, enabledSkills, PetRewardCatalog.rewards());
    }
    GiftDropGame(int basePoints, Random random, List<String> enabledSkills, List<PetRewardCatalog.Reward> catalog) {
        if (basePoints <= 0) { throw new IllegalArgumentException("Gift settings required"); }
        this.basePoints = basePoints; this.random = random;
        for (String type : SKILL_TYPES) { if (enabledSkills != null && enabledSkills.contains(type)) { skillTypes.add(type); } }
        List<PetRewardCatalog.Reward> sorted = new ArrayList<PetRewardCatalog.Reward>(catalog);
        Collections.sort(sorted, new Comparator<PetRewardCatalog.Reward>() {
            @Override public int compare(PetRewardCatalog.Reward left, PetRewardCatalog.Reward right) {
                return Integer.compare(left.level, right.level);
            }
        });
        Set<Integer> levels = new HashSet<Integer>();
        for (PetRewardCatalog.Reward reward : sorted) {
            if (!levels.add(reward.level)) { throw new IllegalArgumentException("Duplicate pet reward level"); }
            (reward.level < NEW_REWARD_MIN_LEVEL ? commonRewards : newRewards).add(reward);
        }
        weights = new int[commonRewards.size()]; newWeights = new int[newRewards.size()];
        skillWeights = new int[skillTypes.size()];
        int[] originalWeights = new int[skillTypes.size() + 1 + commonRewards.size()];
        Arrays.fill(originalWeights, 0, skillTypes.size(), SKILL_EGG_WEIGHT);
        originalWeights[skillTypes.size()] = ROTTEN_EGG_WEIGHT;
        int originalTotal = ROTTEN_EGG_WEIGHT + skillTypes.size() * SKILL_EGG_WEIGHT;
        int[] fixedTickets = new int[originalWeights.length];
        int fixedTotal = 0, fixedOriginalWeight = 0;
        for (int i = 0; i < commonRewards.size(); i++) {
            int level = commonRewards.get(i).level;
            int weight = rewardWeight(level);
            int index = skillTypes.size() + 1 + i;
            originalWeights[index] = weight; originalTotal += weight;
            if (level >= NEW_REWARD_MIN_LEVEL - 3) {
                fixedTickets[index] = JERRY_FORM_TICKETS[commonRewards.get(i).stageIndex];
                fixedTotal += fixedTickets[index]; fixedOriginalWeight += weight;
            }
        }
        Map<String, Integer> newFamilies = new LinkedHashMap<String, Integer>();
        int newTotal = 0;
        for (int i = 0; i < newWeights.length; i++) {
            PetRewardCatalog.Reward reward = newRewards.get(i);
            Integer familyOrder = newFamilies.get(reward.petId);
            if (familyOrder == null) { familyOrder = newFamilies.size() + 1; newFamilies.put(reward.petId, familyOrder); }
            newWeights[i] = Math.max(NEW_REWARD_STEP,
                    JERRY_FORM_TICKETS[reward.stageIndex] - NEW_REWARD_STEP * familyOrder);
            newTotal += newWeights[i];
        }
        int remainingTickets = DRAW_RESOLUTION - newTotal - fixedTotal;
        if (remainingTickets <= 0) { throw new IllegalArgumentException("Pet reward probabilities exceed 100%"); }
        int remainingWeight = originalTotal - fixedOriginalWeight;
        int cumulativeWeight = 0, assignedTickets = 0, commonTotal = 0;
        // Preserve all three Jerry reference probabilities. Other original rewards share
        // the remaining probability in their existing weight ratios.
        for (int i = 0; i < originalWeights.length; i++) {
            int tickets;
            if (fixedTickets[i] > 0) { tickets = fixedTickets[i]; }
            else {
                cumulativeWeight += originalWeights[i];
                int cumulativeTickets = (int) ((long) cumulativeWeight * remainingTickets / remainingWeight);
                tickets = cumulativeTickets - assignedTickets; assignedTickets = cumulativeTickets;
            }
            originalWeights[i] = tickets;
            if (i > skillTypes.size()) { commonTotal += tickets; }
        }
        for (int i = 0; i < skillWeights.length; i++) { skillWeights[i] = originalWeights[i]; }
        rottenWeight = originalWeights[skillTypes.size()];
        System.arraycopy(originalWeights, skillTypes.size() + 1, weights, 0, weights.length);
        totalWeight = commonTotal;
    }
    private static int rewardWeight(int index) { return Math.max(1, (int) Math.round(10000D * Math.pow(0.75D, index))); }
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
        int draw = random.nextInt(DRAW_RESOLUTION);
        for (int i = 0; i < skillWeights.length; i++) {
            if (draw < skillWeights[i]) { return new Gift(id, SKILL_EGG_LEVEL, 0D, skillTypes.get(i)); }
            draw -= skillWeights[i];
        }
        if (draw < rottenWeight) { return new Gift(id, ROTTEN_EGG_LEVEL, ROTTEN_EGG_POINTS); }
        draw -= rottenWeight;
        if (draw < totalWeight) { return petGift(id, pickReward(commonRewards, weights, draw)); }
        return petGift(id, pickReward(newRewards, newWeights, draw - totalWeight));
    }
    private static PetRewardCatalog.Reward pickReward(List<PetRewardCatalog.Reward> rewards, int[] rewardWeights, int draw) {
        int index = 0;
        while (index < rewardWeights.length - 1 && draw >= rewardWeights[index]) { draw -= rewardWeights[index++]; }
        return rewards.get(index);
    }
    private Gift petGift(String id, PetRewardCatalog.Reward reward) {
        return new Gift(id, reward.level, basePoints * (reward.level + 1D), null, reward.image, reward.label);
    }
    public void prepareFinalPools(Map<String, Integer> credits) {
        playerPools.clear(); finalPools = true;
        if (credits != null) {
            for (Map.Entry<String, Integer> entry : credits.entrySet()) {
                PlayerPool pool = new PlayerPool();
                pool.capacity = Math.max(0, entry.getValue() == null ? 0 : entry.getValue()) + POOL_SIZE;
                for (int i = 0; i < pool.capacity; i++) { Gift gift = drawGift(); pool.gifts.put(gift.id, gift); }
                pool.version = 1L; playerPools.put(entry.getKey(), pool);
            }
        }
        version++;
    }
    public Gift claim(String username, String id) {
        PlayerPool pool = playerPools.get(username);
        Gift gift = pool == null ? null : pool.gifts.remove(id);
        if (gift != null) {
            if (!finalPools) { Gift replacement = drawGift(); pool.gifts.put(replacement.id, replacement); }
            pool.version++; version++;
        }
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
