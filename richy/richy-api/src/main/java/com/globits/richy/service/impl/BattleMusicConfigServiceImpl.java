package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.richy.domain.BattleMusicTrack;
import com.globits.richy.dto.BattleMusicConfigDto;
import com.globits.richy.dto.BattleMusicTrackDto;
import com.globits.richy.repository.BattleMusicTrackRepository;
import com.globits.richy.service.BattleMusicConfigService;
import com.globits.richy.service.BattleOnlineException;

@Service
@Transactional
public class BattleMusicConfigServiceImpl implements BattleMusicConfigService {
    private static final int MAX_TRACKS = 100;
    private static final Pattern VIDEO_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern YOUTUBE_URL_PATTERN = Pattern.compile(
            "(?:youtube(?:-nocookie)?\\.com/(?:watch\\?(?:[^#]*&)?v=|embed/|shorts/|live/)|youtu\\.be/)([A-Za-z0-9_-]{11})",
            Pattern.CASE_INSENSITIVE);
    private static final String[][] DEFAULT_TRACKS = new String[][] {
            {"Battle music 1", "MU0Yp0qmYEs"},
            {"Battle music 2", "9vdmlmg1QiA"},
            {"Battle music 3", "RRpINBQCI48"}
    };

    @Autowired
    private BattleMusicTrackRepository repository;

    @Override
    @Transactional(readOnly = true)
    public BattleMusicConfigDto getActiveConfig() {
        BattleMusicConfigDto config = loadConfig();
        List<BattleMusicTrackDto> active = new ArrayList<BattleMusicTrackDto>();
        for (BattleMusicTrackDto track : config.getTracks()) {
            if (track != null && Boolean.TRUE.equals(track.getEnabled())) { active.add(track); }
        }
        config.setTracks(active);
        return config;
    }

    @Override
    @Transactional(readOnly = true)
    public BattleMusicConfigDto getAdminConfig() {
        return loadConfig();
    }

    @Override
    public BattleMusicConfigDto saveConfig(BattleMusicConfigDto dto) {
        if (dto == null || dto.getTracks() == null || dto.getTracks().isEmpty()) {
            throw new BattleOnlineException(HttpStatus.BAD_REQUEST, "Cần ít nhất một link nhạc battle.");
        }
        if (dto.getTracks().size() > MAX_TRACKS) {
            throw new BattleOnlineException(HttpStatus.BAD_REQUEST, "Tối đa " + MAX_TRACKS + " link nhạc battle.");
        }

        List<BattleMusicTrack> validated = new ArrayList<BattleMusicTrack>();
        Set<String> seenVideoIds = new HashSet<String>();
        boolean hasEnabledTrack = false;
        int order = 0;
        String username = currentUsername();
        LocalDateTime now = LocalDateTime.now();

        for (BattleMusicTrackDto item : dto.getTracks()) {
            if (item == null) { continue; }
            String inputUrl = trim(item.getUrl());
            String videoId = extractVideoId(inputUrl);
            if (videoId == null) {
                throw new BattleOnlineException(HttpStatus.BAD_REQUEST,
                        "Link nhạc số " + (order + 1) + " không phải link YouTube hợp lệ.");
            }
            if (!seenVideoIds.add(videoId)) {
                throw new BattleOnlineException(HttpStatus.BAD_REQUEST, "Danh sách có link YouTube bị trùng.");
            }

            BattleMusicTrack track = new BattleMusicTrack();
            String name = trim(item.getName());
            if (name.length() > 200) {
                throw new BattleOnlineException(HttpStatus.BAD_REQUEST, "Tên bài nhạc tối đa 200 ký tự.");
            }
            boolean enabled = item.getEnabled() == null || Boolean.TRUE.equals(item.getEnabled());
            track.setName(name.isEmpty() ? "Battle music " + (order + 1) : name);
            track.setUrl("https://www.youtube.com/watch?v=" + videoId);
            track.setVideoId(videoId);
            track.setEnabled(Boolean.valueOf(enabled));
            track.setDisplayOrder(Integer.valueOf(order));
            track.setCreatedBy(username);
            track.setCreateDate(now);
            validated.add(track);
            hasEnabledTrack = hasEnabledTrack || enabled;
            order += 1;
        }

        if (validated.isEmpty() || !hasEnabledTrack) {
            throw new BattleOnlineException(HttpStatus.BAD_REQUEST, "Cần bật ít nhất một bài nhạc battle.");
        }

        repository.deleteAll();
        repository.flush();
        repository.save(validated);
        return loadConfig();
    }

    private BattleMusicConfigDto loadConfig() {
        List<BattleMusicTrack> tracks = repository.findAll();
        Collections.sort(tracks, new Comparator<BattleMusicTrack>() {
            @Override
            public int compare(BattleMusicTrack first, BattleMusicTrack second) {
                int firstOrder = first == null || first.getDisplayOrder() == null
                        ? Integer.MAX_VALUE : first.getDisplayOrder().intValue();
                int secondOrder = second == null || second.getDisplayOrder() == null
                        ? Integer.MAX_VALUE : second.getDisplayOrder().intValue();
                if (firstOrder != secondOrder) { return firstOrder < secondOrder ? -1 : 1; }
                Long firstId = first == null ? null : first.getId();
                Long secondId = second == null ? null : second.getId();
                if (firstId == null) { return secondId == null ? 0 : 1; }
                return secondId == null ? -1 : firstId.compareTo(secondId);
            }
        });

        BattleMusicConfigDto result = new BattleMusicConfigDto();
        if (tracks.isEmpty()) {
            for (int index = 0; index < DEFAULT_TRACKS.length; index += 1) {
                BattleMusicTrackDto item = new BattleMusicTrackDto();
                item.setName(DEFAULT_TRACKS[index][0]);
                item.setVideoId(DEFAULT_TRACKS[index][1]);
                item.setUrl("https://www.youtube.com/watch?v=" + DEFAULT_TRACKS[index][1]);
                item.setEnabled(Boolean.TRUE);
                item.setDisplayOrder(Integer.valueOf(index));
                result.getTracks().add(item);
            }
            return result;
        }

        for (BattleMusicTrack track : tracks) { result.getTracks().add(new BattleMusicTrackDto(track)); }
        return result;
    }

    private String extractVideoId(String value) {
        if (value == null || value.isEmpty() || value.length() > 1000) { return null; }
        if (VIDEO_ID_PATTERN.matcher(value).matches()) { return value; }
        Matcher matcher = YOUTUBE_URL_PATTERN.matcher(value);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null || authentication.getName() == null
                ? "Unknown User" : authentication.getName();
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
}
