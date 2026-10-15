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
        public final String image, label;

        public Reward(int level, String image, String label) {
            if (level < 0 || image == null || label == null) {
                throw new IllegalArgumentException("Pet reward requires a level, image and label");
            }
            this.level = level; this.image = image; this.label = label;
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
                int level = minimum.asInt(-1);
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
                if (!minimum.isIntegralNumber() || !minimum.canConvertToInt() || level < 0 || !levels.add(level)
                        || !file.matches("[a-zA-Z0-9_-]+\\.(png|webp|svg|avif|jpg|jpeg)")) {
                    throw new IOException("Invalid or duplicate pet reward level/image: " + manifest.getDescription());
                }
                rewards.add(new Reward(level, "assets/images/learning-pets/" + id + "/" + file, prefix + name));
            }
        }
        if (rewards.isEmpty()) { throw new IOException("No pet reward manifests were packaged"); }
        Collections.sort(rewards, new Comparator<Reward>() {
            @Override public int compare(Reward left, Reward right) { return Integer.compare(left.level, right.level); }
        });
        return Collections.unmodifiableList(rewards);
    }
}
