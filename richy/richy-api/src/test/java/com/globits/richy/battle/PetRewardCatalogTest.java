package com.globits.richy.battle;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import static org.junit.Assert.*;

public class PetRewardCatalogTest {
    private Resource json(String value) { return new ByteArrayResource(value.getBytes(StandardCharsets.UTF_8)); }
    private String stage(String level, String form, String file) {
        return "{\"minimumVocabularyExperienceLevel\":" + level + ",\"form\":\"" + form + "\",\"file\":\"" + file + "\"}";
    }
    private Resource pet(String id, String name, String... stages) {
        return json("{\"id\":\"" + id + "\",\"name\":\"" + name + "\",\"evolution\":[" + String.join(",",stages) + "]}");
    }
    private void rejected(Resource... manifests) {
        try { PetRewardCatalog.read(manifests); fail("Invalid pet manifest accepted"); }
        catch (IOException expected) { }
    }

    @Test public void packagedWebsiteManifestsSupplyEveryStageIncludingDogTuffyAndPikachu() {
        List<PetRewardCatalog.Reward> rewards = PetRewardCatalog.rewards();
        assertEquals(21,rewards.size());
        for (int level = 0; level < rewards.size(); level++) {
            assertEquals(level,rewards.get(level).level);
            assertTrue(rewards.get(level).image.startsWith("assets/images/learning-pets/"));
            assertFalse(rewards.get(level).label.contains("undefined"));
        }
        assertEquals("assets/images/learning-pets/mam-hoc/pet-hatched-fallback.png",rewards.get(2).image);
        assertEquals("Mầm Học",rewards.get(2).label);
        assertEquals("assets/images/learning-pets/cute-dog/egg-level-6.png",rewards.get(6).image);
        assertEquals("Cute Dog",rewards.get(8).label);
        assertEquals("Trứng Chuột Tuffy",rewards.get(15).label);
        assertEquals("assets/images/learning-pets/pikachu/egg-level-19.png",rewards.get(19).image);
        assertEquals("Pikachu",rewards.get(20).label);
        try { rewards.clear(); fail("Shared catalog must be immutable"); } catch (UnsupportedOperationException expected) { }
    }

    @Test public void futureResourceManifestsAreReadAndSortedWithoutAnyCatalogEdit() throws Exception {
        List<PetRewardCatalog.Reward> rewards = PetRewardCatalog.read(new Resource[] {
            pet("future-pet","Pet mới",stage("23","hatched","pet-level-23.png"),
                    stage("21","egg-intact","egg-level-21.webp"),stage("22","egg-cracked","egg-level-22.svg")),
            pet("later-pet","Pet sau",stage("120","hatched","pet-level-120.avif"))
        });
        assertEquals(4,rewards.size());
        assertEquals(21,rewards.get(0).level); assertEquals("Trứng Pet mới",rewards.get(0).label);
        assertEquals("assets/images/learning-pets/future-pet/egg-level-21.webp",rewards.get(0).image);
        assertEquals(22,rewards.get(1).level); assertEquals("Trứng vỡ Pet mới",rewards.get(1).label);
        assertEquals(23,rewards.get(2).level); assertEquals("Pet mới",rewards.get(2).label);
        assertEquals(120,rewards.get(3).level); assertEquals("Pet sau",rewards.get(3).label);
    }

    @Test public void spriteAtlasesUseTheirSingleImageFallbackForBothAtlasFormats() throws Exception {
        for (String file : Arrays.asList("spritesheet.png","spritesheet.webp")) {
            Resource manifest = json("{\"id\":\"atlas-pet\",\"name\":\"Atlas\",\"atlas\":{\"file\":\"spritesheet.png\","
                    + "\"optimizedFile\":\"spritesheet.webp\",\"fallbackFile\":\"pet.png\"},\"evolution\":["
                    + stage("2","hatched",file) + "]}");
            assertEquals("assets/images/learning-pets/atlas-pet/pet.png",PetRewardCatalog.read(new Resource[] {manifest}).get(0).image);
        }
    }

    @Test public void duplicateLevelsAcrossOrWithinPetsAreRejected() {
        Resource first = pet("first","First",stage("21","egg-intact","egg.png"));
        rejected(first,pet("second","Second",stage("21","hatched","pet.png")));
        rejected(pet("first","First",stage("21","egg-intact","egg.png"),stage("21","egg-cracked","cracked.png")));
    }

    @Test public void invalidPathsAndMalformedStagesCannotEnterTheRewardCatalog() {
        for (String id : Arrays.asList("../escape","a/b","bad id","https://example.com","UPPER")) {
            rejected(pet(id,"Pet",stage("21","hatched","pet.png")));
        }
        for (String file : Arrays.asList("../pet.png","nested/pet.png","https://example.com/pet.png","pet.png?x=1","pet.txt","")) {
            rejected(pet("future-pet","Pet",stage("21","hatched",file)));
        }
        for (String level : Arrays.asList("-1","1.5","\"21\"","null","4294967296")) {
            rejected(pet("future-pet","Pet",stage(level,"hatched","pet.png")));
        }
        rejected(pet("future-pet"," ",stage("21","hatched","pet.png")));
        rejected(pet("future-pet","Pet",stage("21","unknown","pet.png")));
        rejected(pet("future-pet","Pet"));
        rejected(json("{\"id\":\"future-pet\",\"name\":\"Pet\",\"evolution\":{}}"));
        rejected(json("null"));
        rejected();
    }
}
