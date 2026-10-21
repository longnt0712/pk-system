package com.globits.richy.battle;

import java.util.*;

/** Private egg pools. The owning room lock serializes claims. */
public class GiftDropGame {
    public static final int ROTTEN_EGG_LEVEL = -1;
    public static final double ROTTEN_EGG_POINTS = 0.5D;
    public static final int SKILL_EGG_LEVEL = -2;
    public static final int PERRY_HAT_LEVEL = -3;
    public static final int LIGHTNING_LEVEL = -4;
    public static final double PERRY_HAT_POINTS = 1D;
    public static final long PERRY_HAT_PROTECTION_MILLIS = 15000L;
    public static final long DRAGON_BALL_BOOST_MILLIS = 20000L;
    private static final int DRAGON_BALL_TICKETS = 100000; // 10% per ball out of one million tickets.
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
        private final int drawTicket;
        Gift(String id, int rewardLevel, double points) { this(id, rewardLevel, points, null); }
        Gift(String id, int rewardLevel, double points, String skillType) {
            this(id, rewardLevel, points, skillType, null, null);
        }
        Gift(String id, int rewardLevel, double points, String skillType, String rewardImage, String rewardLabel) {
            this(id, rewardLevel, points, skillType, rewardImage, rewardLabel, -1);
        }
        private Gift(String id, int rewardLevel, double points, String skillType, String rewardImage, String rewardLabel, int drawTicket) {
            this.id = id; this.rewardLevel = rewardLevel; this.points = points; this.skillType = skillType;
            this.rewardImage = rewardImage; this.rewardLabel = rewardLabel;
            this.drawTicket = drawTicket;
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
        public final long perryHatProtectionEndsAt;
        public final int dragonBallBoostStars;
        public final long dragonBallBoostEndsAt;
        public final String dragonBallBoostPetLabel;
        public final int capacity;
        public final List<ClosedGift> gifts;
        public final List<ClaimRecord> claims;
        Snapshot(GiftDropGame game, String username) {
            PlayerPool pool = username == null ? null : game.poolFor(username);
            gameId = game.gameId; version = game.version; capacity = pool == null ? POOL_SIZE : pool.capacity;
            poolVersion = pool == null ? null : pool.version;
            perryHatProtectionEndsAt = username == null ? 0L : game.protectionEndsAt(username);
            DragonBallBoost boost = username == null ? null : game.dragonBallBoosts.get(username);
            dragonBallBoostStars = boost == null ? 0 : boost.stars;
            dragonBallBoostEndsAt = boost == null ? 0L : boost.endsAt;
            dragonBallBoostPetLabel = boost == null || game.highestPetIndex < 0 ? null : game.rewards.get(game.highestPetIndex).label;
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
    private final Map<String, Long> perryHatProtection = new HashMap<String, Long>();
    private static final class DragonBallBoost {
        final int stars;
        final long endsAt;
        DragonBallBoost(int stars, long endsAt) { this.stars = stars; this.endsAt = endsAt; }
    }
    private final Map<String, DragonBallBoost> dragonBallBoosts = new HashMap<String, DragonBallBoost>();
    private final List<ClaimRecord> claims = new ArrayList<ClaimRecord>();
    private final List<String> skillTypes = new ArrayList<String>();
    private final int basePoints;
    private final List<PetRewardCatalog.Reward> rewards;
    private final int[] rewardWeights;
    private final int[] skillWeights;
    private final int rottenWeight, perryHatWeight;
    private final int[] normalDrawWeights, lightningDrawWeights;
    private final int highestPetIndex;
    private final Map<String, int[]> effectDrawWeights = new HashMap<String, int[]>();
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
        List<PetRewardCatalog.Reward> dragonBalls = new ArrayList<PetRewardCatalog.Reward>();
        Set<Integer> dragonBallStars = new HashSet<Integer>();
        for (Iterator<PetRewardCatalog.Reward> it = sorted.iterator(); it.hasNext();) {
            PetRewardCatalog.Reward reward = it.next();
            if (reward.dragonBallStars == 0) { continue; }
            if (!dragonBallStars.add(reward.dragonBallStars)) { throw new IllegalArgumentException("Duplicate Dragon Ball stars"); }
            dragonBalls.add(reward); it.remove();
        }
        if (sorted.isEmpty()) { throw new IllegalArgumentException("At least one ordinary pet reward is required"); }
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
        int originalRottenWeight = originalWeights[rottenIndex], originalPerryHatWeight = originalWeights[perryHatIndex];
        Map<Integer, Integer> ticketsByLevel = new HashMap<Integer, Integer>();
        for (PetRewardCatalog.Reward reward : commonRewards) { ticketsByLevel.put(reward.level, originalWeights[commonIndexes.get(reward.level)]); }
        for (int i = 0; i < newRewards.size(); i++) { ticketsByLevel.put(newRewards.get(i).level, newWeights[i]); }
        sorted.addAll(dragonBalls);
        Collections.sort(sorted, new Comparator<PetRewardCatalog.Reward>() {
            @Override public int compare(PetRewardCatalog.Reward left, PetRewardCatalog.Reward right) {
                return Integer.compare(left.level, right.level);
            }
        });
        rewards = sorted; rewardWeights = new int[rewards.size()];
        double ordinaryShare = (DRAW_RESOLUTION - dragonBalls.size() * DRAGON_BALL_TICKETS) / (double) DRAW_RESOLUTION;
        int highest = -1;
        double highestPoints = -1D;
        for (int i = 0; i < rewards.size(); i++) {
            PetRewardCatalog.Reward reward = rewards.get(i);
            rewardWeights[i] = reward.dragonBallStars > 0 ? DRAGON_BALL_TICKETS
                    : (int) Math.round(ticketsByLevel.get(reward.level) * ordinaryShare);
            if (reward.dragonBallStars == 0 && pointsForReward(reward) > highestPoints) {
                highest = i; highestPoints = pointsForReward(reward);
            }
        }
        highestPetIndex = highest;
        normalDrawWeights = new int[skillWeights.length + 2 + rewardWeights.length];
        for (int i = 0; i < skillWeights.length; i++) { normalDrawWeights[i] = (int) Math.round(skillWeights[i] * ordinaryShare); }
        rottenWeight = (int) Math.round(originalRottenWeight * ordinaryShare);
        perryHatWeight = (int) Math.round(originalPerryHatWeight * ordinaryShare);
        normalDrawWeights[skillWeights.length] = rottenWeight;
        normalDrawWeights[skillWeights.length + 1] = perryHatWeight;
        System.arraycopy(rewardWeights, 0, normalDrawWeights, skillWeights.length + 2, rewardWeights.length);
        int total = 0;
        for (int weight : normalDrawWeights) { total += weight; }
        // Put at most a few rounding tickets into the first ordinary reward; ball chances stay exactly 10%.
        for (int i = 0; i < rewards.size(); i++) {
            if (rewards.get(i).dragonBallStars == 0) {
                normalDrawWeights[skillWeights.length + 2 + i] += DRAW_RESOLUTION - total; break;
            }
        }
        lightningDrawWeights = boostedWeights();
    }
    private boolean isDragonBallIndex(int index) {
        int rewardIndex = index - skillWeights.length - 2;
        return rewardIndex >= 0 && rewards.get(rewardIndex).dragonBallStars > 0;
    }
    /** Preserve each ball's fixed chance and share the remaining probability among other outcomes. */
    private int[] rebalance(int[] before, int[] after, boolean[] changed) {
        int availableBefore = 0, availableAfter = DRAW_RESOLUTION;
        for (int i = 0; i < before.length; i++) {
            if (changed[i] || isDragonBallIndex(i)) { availableAfter -= after[i]; }
            else { availableBefore += before[i]; }
        }
        if (availableAfter < 0 || availableBefore <= 0) { throw new IllegalArgumentException("Reward probabilities exceed 100%"); }
        long cumulative = 0L, assigned = 0L;
        for (int i = 0; i < before.length; i++) {
            if (changed[i] || isDragonBallIndex(i)) { continue; }
            cumulative += before[i];
            long tickets = cumulative * availableAfter / availableBefore;
            after[i] = (int) (tickets - assigned); assigned = tickets;
        }
        return after;
    }
    private int[] boostedWeights() {
        int[] boosted = normalDrawWeights.clone();
        boolean[] target = new boolean[boosted.length];
        for (int i = 0; i < rewards.size(); i++) {
            if (rewards.get(i).dragonBallStars > 0 || rewards.get(i).referenceLevel < 9 || rewards.get(i).referenceLevel > 20) { continue; }
            int index = skillWeights.length + 2 + i;
            target[index] = true;
            boosted[index] = (int) Math.round(normalDrawWeights[index] * 1.10D);
        }
        return rebalance(normalDrawWeights, boosted, target);
    }
    private int[] weightsForEffects(boolean lightning, boolean protectedFromRotten, int stars) {
        if (!protectedFromRotten && stars == 0) { return lightning ? lightningDrawWeights : normalDrawWeights; }
        String key = lightning + ":" + protectedFromRotten + ":" + stars;
        int[] cached = effectDrawWeights.get(key);
        if (cached != null) { return cached; }
        int[] weights = lightning ? lightningDrawWeights : normalDrawWeights;
        if (protectedFromRotten) {
            int[] protectedWeights = weights.clone();
            boolean[] changed = new boolean[weights.length];
            protectedWeights[skillWeights.length] = 0;
            changed[skillWeights.length] = true;
            weights = rebalance(weights, protectedWeights, changed);
        }
        if (stars > 0 && highestPetIndex >= 0) {
            int index = skillWeights.length + 2 + highestPetIndex;
            int[] boosted = weights.clone();
            boolean[] changed = new boolean[weights.length];
            int fixedBalls = 0;
            for (int i = 0; i < weights.length; i++) { if (isDragonBallIndex(i)) { fixedBalls += weights[i]; } }
            boosted[index] = Math.min(DRAW_RESOLUTION - fixedBalls, weights[index] + stars * 10000);
            changed[index] = true;
            weights = rebalance(weights, boosted, changed);
        }
        effectDrawWeights.put(key, weights);
        return weights;
    }
    private double pointsForReward(PetRewardCatalog.Reward reward) {
        return reward.dragonBallStars > 0 ? reward.dragonBallStars * 10D : basePoints * (reward.referenceLevel + 1D);
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
        return giftForTicket(id, random.nextInt(DRAW_RESOLUTION), false);
    }
    private Gift giftForTicket(String id, int ticket, boolean lightning) {
        return giftForTicket(id, ticket, lightning, false);
    }
    private Gift giftForTicket(String id, int ticket, boolean lightning, boolean protectedFromRotten) {
        return giftForTicket(id, ticket, lightning, protectedFromRotten, 0);
    }
    private Gift giftForTicket(String id, int ticket, boolean lightning, boolean protectedFromRotten, int stars) {
        int[] weights = weightsForEffects(lightning, protectedFromRotten, stars);
        int index = 0, remaining = ticket;
        // Reuse each egg's private ticket for the active effects; refreshing never rerolls it.
        while (index < weights.length - 1) {
            int weight = weights[index];
            if (remaining < weight) { break; }
            remaining -= weight; index++;
        }
        Gift gift;
        if (index < skillWeights.length) { gift = new Gift(id, SKILL_EGG_LEVEL, 0D, skillTypes.get(index)); }
        else if (index == skillWeights.length) { gift = new Gift(id, ROTTEN_EGG_LEVEL, ROTTEN_EGG_POINTS); }
        else if (index == skillWeights.length + 1) {
            gift = new Gift(id, PERRY_HAT_LEVEL, PERRY_HAT_POINTS, null, "assets/images/learning-pets/perry/perry-hat.png", "Mũ Perry");
        } else { gift = petGift(id, rewards.get(index - skillWeights.length - 2)); }
        return new Gift(gift.id, gift.rewardLevel, gift.points, gift.skillType, gift.rewardImage, gift.rewardLabel, ticket);
    }
    public static Gift lightningGift(String id) {
        return new Gift(id, LIGHTNING_LEVEL, 0D, null, "assets/images/battle-lightning.svg", "Sét may mắn — cả phòng +10% tỉ lệ Tom đến Pikachu trong 30 giây");
    }
    private Gift petGift(String id, PetRewardCatalog.Reward reward) {
        return new Gift(id, reward.level, pointsForReward(reward), null, reward.image, reward.label);
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
        return claim(username, id, false);
    }
    public Gift claim(String username, String id, boolean lightning) {
        return claim(username, id, lightning, System.currentTimeMillis());
    }
    public Gift claim(String username, String id, boolean lightning, long now) {
        PlayerPool pool = playerPools.get(username);
        Gift gift = pool == null ? null : pool.gifts.remove(id);
        if (gift != null) {
            if (!finalPools) { Gift replacement = drawGift(); pool.gifts.put(replacement.id, replacement); }
            pool.version++; version++;
        }
        boolean protectedFromRotten = protectionEndsAt(username) > now;
        DragonBallBoost boost = dragonBallBoosts.get(username);
        int stars = boost != null && boost.endsAt > now ? boost.stars : 0;
        return gift != null && (lightning || protectedFromRotten || stars > 0) && gift.drawTicket >= 0
                ? giftForTicket(gift.id, gift.drawTicket, lightning, protectedFromRotten, stars) : gift;
    }
    private long protectionEndsAt(String username) {
        Long endsAt = perryHatProtection.get(username);
        return endsAt == null ? 0L : endsAt;
    }
    public void recordClaim(Gift gift, String username, String displayName, double awardedPoints, long now) {
        if (gift.rewardLevel == PERRY_HAT_LEVEL) { perryHatProtection.put(username, now + PERRY_HAT_PROTECTION_MILLIS); }
        for (PetRewardCatalog.Reward reward : rewards) {
            if (reward.level == gift.rewardLevel && reward.dragonBallStars > 0) {
                dragonBallBoosts.put(username, new DragonBallBoost(reward.dragonBallStars, now + DRAGON_BALL_BOOST_MILLIS));
                break;
            }
        }
        claims.add(0, new ClaimRecord(gift, username, displayName, awardedPoints, now));
        if (claims.size() > 200) { claims.remove(claims.size() - 1); }
        version++;
    }
    public void creditChanged() { version++; }
    public Snapshot snapshot() { return new Snapshot(this, null); }
    public Snapshot snapshot(String username) { return new Snapshot(this, username); }
}
