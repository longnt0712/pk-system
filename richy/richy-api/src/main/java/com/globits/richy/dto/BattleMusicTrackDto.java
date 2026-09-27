package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.BattleMusicTrack;

public class BattleMusicTrackDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String name;
    private String url;
    private String videoId;
    private Boolean enabled = Boolean.TRUE;
    private Integer displayOrder;

    public BattleMusicTrackDto() {}

    public BattleMusicTrackDto(BattleMusicTrack domain) {
        if (domain == null) { return; }
        this.id = domain.getId();
        this.name = domain.getName();
        this.url = domain.getUrl();
        this.videoId = domain.getVideoId();
        this.enabled = domain.getEnabled();
        this.displayOrder = domain.getDisplayOrder();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getVideoId() { return videoId; }
    public void setVideoId(String videoId) { this.videoId = videoId; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
