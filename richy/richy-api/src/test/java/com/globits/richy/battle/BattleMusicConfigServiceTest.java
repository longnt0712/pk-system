package com.globits.richy.battle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.BattleMusicTrack;
import com.globits.richy.domain.BattleConfig;
import com.globits.richy.dto.BattleMusicConfigDto;
import com.globits.richy.dto.BattleMusicTrackDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.repository.BattleMusicTrackRepository;
import com.globits.richy.repository.BattleConfigRepository;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleMusicConfigServiceImpl;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleMusicConfigServiceTest {
    private BattleMusicConfigServiceImpl service;
    private BattleMusicTrackRepository repository;
    private BattleConfigRepository configRepository;
    private BattleConfig storedConfig;
    private final List<BattleMusicTrack> stored = new ArrayList<BattleMusicTrack>();

    @Before @SuppressWarnings("unchecked") public void setup() {
        service = new BattleMusicConfigServiceImpl();
        repository = mock(BattleMusicTrackRepository.class);
        configRepository = mock(BattleConfigRepository.class);
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "configRepository", configRepository);
        when(configRepository.findOne(1)).thenAnswer(call -> storedConfig);
        when(configRepository.saveAndFlush(any(BattleConfig.class))).thenAnswer(call -> {
            storedConfig = (BattleConfig) call.getArguments()[0]; return storedConfig;
        });
        when(repository.findAll()).thenAnswer(call -> new ArrayList<BattleMusicTrack>(stored));
        doAnswer(call -> { stored.clear(); return null; }).when(repository).deleteAll();
        doAnswer(call -> {
            for (BattleMusicTrack track : (Iterable<BattleMusicTrack>) call.getArguments()[0]) { stored.add(track); }
            return new ArrayList<BattleMusicTrack>(stored);
        }).when(repository).save(anyList());
    }

    private BattleMusicTrackDto danger(BattleMusicConfigDto config) {
        for (BattleMusicTrackDto track : config.getTracks()) {
            if ("DEMON_DANGER".equals(track.getPurpose())) { return track; }
        }
        fail("Missing danger music config");
        return null;
    }

    @Test public void defaultsAndLegacyConfigIncludeTheEditableDangerSong() {
        assertEquals("MR-ZRkhZK0M", danger(service.getAdminConfig()).getVideoId());
        BattleMusicTrack legacy = new BattleMusicTrack();
        legacy.setName("Existing music"); legacy.setPurpose(null);
        legacy.setUrl("https://www.youtube.com/watch?v=MU0Yp0qmYEs"); legacy.setVideoId("MU0Yp0qmYEs");
        stored.add(legacy);
        BattleMusicConfigDto config = service.getAdminConfig();
        assertEquals("BATTLE", config.getTracks().get(0).getPurpose());
        assertEquals("MR-ZRkhZK0M", danger(config).getVideoId());
    }

    @Test public void editedDangerSongSurvivesSaveAndReload() {
        BattleMusicConfigDto config = service.getAdminConfig();
        danger(config).setUrl("https://youtu.be/RRpINBQCI48");
        danger(config).setName("Custom danger song");
        BattleMusicConfigDto saved = service.saveConfig(config);
        assertEquals("RRpINBQCI48", danger(saved).getVideoId());
        assertEquals("https://www.youtube.com/watch?v=RRpINBQCI48", danger(saved).getUrl());
        assertEquals("Custom danger song", danger(service.getActiveConfig()).getName());
        assertEquals(5, stored.size());
    }

    @Test public void disabledDangerSongStaysDisabledAfterSave() {
        BattleMusicConfigDto config = service.getAdminConfig();
        danger(config).setEnabled(false);
        service.saveConfig(config);
        assertFalse(danger(service.getAdminConfig()).getEnabled());
        for (BattleMusicTrackDto track : service.getActiveConfig().getTracks()) {
            assertNotEquals("DEMON_DANGER", track.getPurpose());
        }
    }

    @Test public void invalidConfigDoesNotDeleteExistingMusic() {
        BattleMusicConfigDto config = service.getAdminConfig();
        danger(config).setUrl("invalid video");
        try { service.saveConfig(config); fail("Invalid link must be rejected"); }
        catch (BattleOnlineException expected) { verify(repository, never()).deleteAll(); }
    }
    @Test public void lightningMusicHasItsOwnEditablePurposeAndCanBeDisabled() {
        BattleMusicConfigDto config=service.getAdminConfig(); BattleMusicTrackDto lightning=null;
        for(BattleMusicTrackDto track:config.getTracks()){if("LUM_LIGHTNING".equals(track.getPurpose())){lightning=track;}}
        assertNotNull(lightning);assertEquals("gOMUTUvVwEk",lightning.getVideoId());
        lightning.setUrl("https://youtu.be/RRpINBQCI48"); lightning.setEnabled(false); service.saveConfig(config);
        boolean saved=false;
        for(BattleMusicTrackDto track:service.getAdminConfig().getTracks()){if("LUM_LIGHTNING".equals(track.getPurpose())){saved=true;assertEquals("RRpINBQCI48",track.getVideoId());assertFalse(track.getEnabled());}}
        assertTrue(saved);
        for(BattleMusicTrackDto track:service.getActiveConfig().getTracks()){assertNotEquals("LUM_LIGHTNING",track.getPurpose());}
    }

    @Test public void onlyDangerMusicCannotReplaceTheRegularPlaylist() {
        BattleMusicConfigDto config = service.getAdminConfig();
        for (BattleMusicTrackDto track : config.getTracks()) {
            if ("BATTLE".equals(track.getPurpose())) { track.setEnabled(false); }
        }
        try { service.saveConfig(config); fail("Regular playlist needs an enabled track"); }
        catch (BattleOnlineException expected) { verify(repository, never()).deleteAll(); }
    }

    @Test public void skillFlagRoundTripsJsonAndOldRequestsDefaultToEnabled() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        BattleOnlineRoomSettingsDto off = mapper.readValue("{\"skillsEnabled\":false}", BattleOnlineRoomSettingsDto.class);
        assertFalse(off.isSkillsEnabled());
        assertFalse(mapper.readTree(mapper.writeValueAsString(off)).get("skillsEnabled").asBoolean());
        assertTrue(mapper.readValue("{}", BattleOnlineRoomSettingsDto.class).isSkillsEnabled());
    }

    @Test public void luckyAppearanceDefaultsToPumpkinForAdminAndGameplayWithoutWritingOnRead() {
        assertEquals("PUMPKIN", service.getAdminConfig().getLumLuckyAppearance());
        assertEquals("PUMPKIN", service.getActiveConfig().getLumLuckyAppearance());
        assertEquals("PUMPKIN", service.getLumLuckyAppearance());
        verify(configRepository, never()).saveAndFlush(any(BattleConfig.class));
    }

    @Test public void luckyAppearanceCanSwitchBothWaysAndSurvivesAServiceReload() {
        BattleMusicConfigDto config = service.getAdminConfig();
        config.setLumLuckyAppearance("LIGHTNING");
        assertEquals("LIGHTNING", service.saveConfig(config).getLumLuckyAppearance());
        BattleMusicConfigServiceImpl reloaded = new BattleMusicConfigServiceImpl();
        ReflectionTestUtils.setField(reloaded, "repository", repository);
        ReflectionTestUtils.setField(reloaded, "configRepository", configRepository);
        assertEquals("LIGHTNING", reloaded.getActiveConfig().getLumLuckyAppearance());
        config = reloaded.getAdminConfig(); config.setLumLuckyAppearance("PUMPKIN");
        assertEquals("PUMPKIN", reloaded.saveConfig(config).getLumLuckyAppearance());
        assertEquals("PUMPKIN", storedConfig.getLumLuckyAppearance());
        assertEquals(5, stored.size());
    }

    @Test public void oldMusicOnlyRequestsPreserveTheSavedAppearance() throws Exception {
        BattleMusicConfigDto config = service.getAdminConfig(); config.setLumLuckyAppearance("LIGHTNING");
        service.saveConfig(config);
        BattleMusicConfigDto legacy = new ObjectMapper().readValue("{}", BattleMusicConfigDto.class);
        assertNull(legacy.getLumLuckyAppearance()); legacy.setTracks(config.getTracks());
        assertEquals("LIGHTNING", service.saveConfig(legacy).getLumLuckyAppearance());
        verify(configRepository, times(1)).saveAndFlush(any(BattleConfig.class));
    }

    @Test public void invalidAppearanceOrTracksAreRejectedBeforeChangingAnyStoredConfig() {
        for (String appearance : new String[] {"", "pumpkin", "TREE"}) {
            BattleMusicConfigDto config = service.getAdminConfig(); config.setLumLuckyAppearance(appearance);
            try { service.saveConfig(config); fail("Invalid appearance must be rejected"); }
            catch (BattleOnlineException expected) { }
        }
        BattleMusicConfigDto invalidMusic = service.getAdminConfig(); invalidMusic.setLumLuckyAppearance("LIGHTNING");
        invalidMusic.getTracks().get(0).setUrl("invalid");
        try { service.saveConfig(invalidMusic); fail("Invalid music must be rejected"); }
        catch (BattleOnlineException expected) { }
        verify(repository, never()).deleteAll();
        verify(configRepository, never()).saveAndFlush(any(BattleConfig.class));
    }
}
