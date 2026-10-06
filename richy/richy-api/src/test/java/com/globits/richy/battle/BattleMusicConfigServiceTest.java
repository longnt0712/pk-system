package com.globits.richy.battle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.BattleMusicTrack;
import com.globits.richy.dto.BattleMusicConfigDto;
import com.globits.richy.dto.BattleMusicTrackDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.repository.BattleMusicTrackRepository;
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
    private final List<BattleMusicTrack> stored = new ArrayList<BattleMusicTrack>();

    @Before @SuppressWarnings("unchecked") public void setup() {
        service = new BattleMusicConfigServiceImpl();
        repository = mock(BattleMusicTrackRepository.class);
        ReflectionTestUtils.setField(service, "repository", repository);
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
        assertEquals(4, stored.size());
    }

    @Test public void disabledDangerSongStaysDisabledAfterSave() {
        BattleMusicConfigDto config = service.getAdminConfig();
        danger(config).setEnabled(false);
        service.saveConfig(config);
        assertFalse(danger(service.getAdminConfig()).getEnabled());
        for (BattleMusicTrackDto track : service.getActiveConfig().getTracks()) {
            assertEquals("BATTLE", track.getPurpose());
        }
    }

    @Test public void invalidConfigDoesNotDeleteExistingMusic() {
        BattleMusicConfigDto config = service.getAdminConfig();
        danger(config).setUrl("invalid video");
        try { service.saveConfig(config); fail("Invalid link must be rejected"); }
        catch (BattleOnlineException expected) { verify(repository, never()).deleteAll(); }
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
}
