package com.globits.richy.battle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** Uses the same evolution manifests as the website, packaged into the API at build time. */
public final class PetRewardCatalog {
    public static final class Reward {
        public final int level;
        public final int referenceLevel;
        public final String image, label;
        public final String petId, form;
        public final int stageIndex;

        public Reward(int level, String image, String label) {
            this(level, image, label, "level-family-" + (level / 3),
                    level % 3 == 0 ? "egg-intact" : level % 3 == 1 ? "egg-cracked" : "hatched");
        }

        public Reward(int level, String image, String label, String petId, String form) {
            this(level, image, label, petId, form, level);
        }

        public Reward(int level, String image, String label, String petId, String form, int referenceLevel) {
            if (level < 0 || referenceLevel < 0 || image == null || label == null || petId == null || petId.trim().isEmpty()) {
                throw new IllegalArgumentException("Pet reward requires a level, image and label");
            }
            if ("egg-intact".equals(form)) { stageIndex = 0; }
            else if ("egg-cracked".equals(form)) { stageIndex = 1; }
            else if ("hatched".equals(form)) { stageIndex = 2; }
            else { throw new IllegalArgumentException("Unknown pet reward form"); }
            this.level = level; this.referenceLevel = referenceLevel; this.image = image; this.label = label;
            this.petId = petId; this.form = form;
        }
    }

    private static final class Holder {
        private static final List<Reward> REWARDS = loadPackagedRewards();
    }

    private PetRewardCatalog() { }

    public static List<Reward> rewards() { return Holder.REWARDS; }

    private static List<Reward> loadPackagedRewards() {
        try {
            Resource[] manifests = new PathMatchingResourcePatternResolver()
                    .getResources("classpath*:battle-pet-catalog/*/pet.json");
            return read(manifests);
        } catch (IOException error) {
            throw new IllegalStateException("Cannot load the Battle pet reward catalog", error);
        }
    }

    static List<Reward> read(Resource[] manifests) throws IOException {
        List<Reward> rewards = new ArrayList<Reward>();
        Set<Integer> levels = new HashSet<Integer>();
        ObjectMapper json = new ObjectMapper();
        for (Resource manifest : manifests) {
            JsonNode pet;
            try (InputStream stream = manifest.getInputStream()) { pet = json.readTree(stream); }
            if (pet == null || !pet.isObject()) { throw new IOException("Pet reward manifest must be an object"); }
            String id = pet.path("id").asText();
            String name = pet.path("name").asText();
            if (!id.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || name.trim().isEmpty()
                    || !pet.path("evolution").isArray() || pet.path("evolution").size() == 0) {
                throw new IOException("Invalid pet reward manifest: " + manifest.getDescription());
            }
            for (JsonNode stage : pet.path("evolution")) {
                JsonNode minimum = stage.path("minimumVocabularyExperienceLevel");
                JsonNode rewardLevel = stage.has("battleRewardLevel") ? stage.path("battleRewardLevel") : minimum;
                JsonNode reference = stage.has("battleRewardReferenceLevel") ? stage.path("battleRewardReferenceLevel") : rewardLevel;
                int level = rewardLevel.asInt(-1), referenceLevel = reference.asInt(-1);
                String form = stage.path("form").asText();
                String file = stage.path("file").asText();
                JsonNode atlas = pet.path("atlas");
                if (file.equals(atlas.path("file").asText()) || file.equals(atlas.path("optimizedFile").asText())) {
                    file = atlas.path("fallbackFile").asText();
                }
                String prefix;
                if ("egg-intact".equals(form)) { prefix = "Trứng "; }
                else if ("egg-cracked".equals(form)) { prefix = "Trứng vỡ "; }
                else if ("hatched".equals(form)) { prefix = ""; }
                else { throw new IOException("Unknown pet reward form: " + form); }
                if (!minimum.isIntegralNumber() || !minimum.canConvertToInt() || minimum.asInt(-1) < 0
                        || !rewardLevel.isIntegralNumber() || !rewardLevel.canConvertToInt() || level < 0 || !levels.add(level)
                        || !reference.isIntegralNumber() || !reference.canConvertToInt() || referenceLevel < 0
                        || !file.matches("[a-zA-Z0-9_-]+\\.(png|webp|svg|avif|jpg|jpeg)")) {
                    throw new IOException("Invalid or duplicate pet reward level/image: " + manifest.getDescription());
                }
                rewards.add(new Reward(level, "assets/images/learning-pets/" + id + "/" + file, prefix + name, id, form, referenceLevel));
            }
        }
        if (rewards.isEmpty()) { throw new IOException("No pet reward manifests were packaged"); }
        for (Reward reward : rewards) {
            if (reward.referenceLevel == reward.level) { continue; }
            Reward source = null;
            for (Reward candidate : rewards) { if (candidate.level == reward.referenceLevel) { source = candidate; break; } }
            if (source == null || source.referenceLevel != source.level) {
                throw new IOException("Pet reward reference must identify an existing original reward: " + reward.level);
            }
        }
        Collections.sort(rewards, new Comparator<Reward>() {
            @Override public int compare(Reward left, Reward right) { return Integer.compare(left.level, right.level); }
        });
        return Collections.unmodifiableList(rewards);
    }
}
