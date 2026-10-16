package com.globits.richy.battle;

import java.util.*;

/** Private egg pools. The owning room lock serializes claims. */
public class GiftDropGame {
    public static final int ROTTEN_EGG_LEVEL = -1;
    public static final double ROTTEN_EGG_POINTS = 0.5D;
    public static final int SKILL_EGG_LEVEL = -2;
    public static final int PERRY_HAT_LEVEL = -3;
    public static final double PERRY_HAT_POINTS = 1D;
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
    private final List<PetRewardCatalog.Reward> rewards;
    private final int[] rewardWeights;
    private final int[] skillWeights;
    private final int rottenWeight, perryHatWeight;
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
        Map<Integer, PetRewardCatalog.Reward> byLevel = new HashMap<Integer, PetRewardCatalog.Reward>();
        for (PetRewardCatalog.Reward reward : sorted) {
            if (byLevel.put(reward.level, reward) != null) { throw new IllegalArgumentException("Duplicate pet reward level"); }
        }
        List<PetRewardCatalog.Reward> commonRewards = new ArrayList<PetRewardCatalog.Reward>();
        List<PetRewardCatalog.Reward> newRewards = new ArrayList<PetRewardCatalog.Reward>();
        for (PetRewardCatalog.Reward reward : sorted) {
            PetRewardCatalog.Reward source = byLevel.get(reward.referenceLevel);
            if (source == null || source.referenceLevel != source.level) { throw new IllegalArgumentException("Invalid pet reward reference"); }
            (reward.referenceLevel < NEW_REWARD_MIN_LEVEL ? commonRewards : newRewards).add(reward);
        }
        int[] newWeights = new int[newRewards.size()];
        skillWeights = new int[skillTypes.size()];
        int rottenIndex = skillTypes.size(), perryHatIndex = rottenIndex + 1, commonOffset = perryHatIndex + 1;
        int[] originalWeights = new int[commonOffset + commonRewards.size()];
        Arrays.fill(originalWeights, 0, skillTypes.size(), SKILL_EGG_WEIGHT);
        originalWeights[rottenIndex] = ROTTEN_EGG_WEIGHT;
        originalWeights[perryHatIndex] = ROTTEN_EGG_WEIGHT;
        int originalTotal = 2 * ROTTEN_EGG_WEIGHT + skillTypes.size() * SKILL_EGG_WEIGHT;
        int[] fixedTickets = new int[originalWeights.length];
        int fixedTotal = 0, fixedOriginalWeight = 0;
        for (int i = 0; i < commonRewards.size(); i++) {
            PetRewardCatalog.Reward source = byLevel.get(commonRewards.get(i).referenceLevel);
            int level = source.level;
            int weight = rewardWeight(level);
            int index = commonOffset + i;
            originalWeights[index] = weight; originalTotal += weight;
            if (level >= NEW_REWARD_MIN_LEVEL - 3) {
                fixedTickets[index] = JERRY_FORM_TICKETS[source.stageIndex];
                fixedTotal += fixedTickets[index]; fixedOriginalWeight += weight;
            }
        }
        Map<String, Integer> newFamilies = new LinkedHashMap<String, Integer>();
        for (PetRewardCatalog.Reward reward : newRewards) {
            if (reward.referenceLevel == reward.level && !newFamilies.containsKey(reward.petId)) {
                newFamilies.put(reward.petId, newFamilies.size() + 1);
            }
        }
        int newTotal = 0;
        for (int i = 0; i < newWeights.length; i++) {
            PetRewardCatalog.Reward reward = byLevel.get(newRewards.get(i).referenceLevel);
            Integer familyOrder = newFamilies.get(reward.petId);
            newWeights[i] = Math.max(NEW_REWARD_STEP,
                    JERRY_FORM_TICKETS[reward.stageIndex] - NEW_REWARD_STEP * familyOrder);
            newTotal += newWeights[i];
        }
        int remainingTickets = DRAW_RESOLUTION - newTotal - fixedTotal;
        if (remainingTickets <= 0) { throw new IllegalArgumentException("Pet reward probabilities exceed 100%"); }
        int remainingWeight = originalTotal - fixedOriginalWeight;
        int cumulativeWeight = 0, assignedTickets = 0;
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
        }
        // Matching raw weights can differ by one ticket after cumulative rounding.
        // Copy the source's final ticket count exactly for both matching pairs,
        // then balance rounding in an independent common reward (or enabled skill).
        int roundingDelta = originalWeights[perryHatIndex] - originalWeights[rottenIndex];
        originalWeights[perryHatIndex] = originalWeights[rottenIndex];
        Map<Integer, Integer> commonIndexes = new HashMap<Integer, Integer>();
        Set<Integer> aliasedLevels = new HashSet<Integer>();
        for (int i = 0; i < commonRewards.size(); i++) {
            PetRewardCatalog.Reward reward = commonRewards.get(i);
            commonIndexes.put(reward.level, commonOffset + i);
            if (reward.referenceLevel != reward.level) { aliasedLevels.add(reward.referenceLevel); }
        }
        for (PetRewardCatalog.Reward reward : commonRewards) {
            if (reward.referenceLevel == reward.level) { continue; }
            int index = commonIndexes.get(reward.level), sourceIndex = commonIndexes.get(reward.referenceLevel);
            roundingDelta += originalWeights[index] - originalWeights[sourceIndex];
            originalWeights[index] = originalWeights[sourceIndex];
        }
        int roundingIndex = skillTypes.isEmpty() ? -1 : 0;
        for (PetRewardCatalog.Reward reward : commonRewards) {
            int index = commonIndexes.get(reward.level);
            if (reward.referenceLevel == reward.level && !aliasedLevels.contains(reward.level) && fixedTickets[index] == 0) {
                roundingIndex = index; break;
            }
        }
        if (roundingDelta != 0) {
            if (roundingIndex < 0) { throw new IllegalArgumentException("No independent reward to balance probability rounding"); }
            originalWeights[roundingIndex] += roundingDelta;
        }
        for (int i = 0; i < skillWeights.length; i++) { skillWeights[i] = originalWeights[i]; }
        rottenWeight = originalWeights[rottenIndex]; perryHatWeight = originalWeights[perryHatIndex];
        Map<Integer, Integer> ticketsByLevel = new HashMap<Integer, Integer>();
        for (PetRewardCatalog.Reward reward : commonRewards) { ticketsByLevel.put(reward.level, originalWeights[commonIndexes.get(reward.level)]); }
        for (int i = 0; i < newRewards.size(); i++) { ticketsByLevel.put(newRewards.get(i).level, newWeights[i]); }
        rewards = sorted; rewardWeights = new int[rewards.size()];
        for (int i = 0; i < rewards.size(); i++) { rewardWeights[i] = ticketsByLevel.get(rewards.get(i).level); }
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
        if (draw < perryHatWeight) {
            return new Gift(id, PERRY_HAT_LEVEL, PERRY_HAT_POINTS, null,
                    "assets/images/learning-pets/perry/perry-hat.png", "Mũ Perry");
        }
        draw -= perryHatWeight;
        return petGift(id, pickReward(rewards, rewardWeights, draw));
    }
    private static PetRewardCatalog.Reward pickReward(List<PetRewardCatalog.Reward> rewards, int[] rewardWeights, int draw) {
        int index = 0;
        while (index < rewardWeights.length - 1 && draw >= rewardWeights[index]) { draw -= rewardWeights[index++]; }
        return rewards.get(index);
    }
    private Gift petGift(String id, PetRewardCatalog.Reward reward) {
        return new Gift(id, reward.level, basePoints * (reward.referenceLevel + 1D), null, reward.image, reward.label);
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
