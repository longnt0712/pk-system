package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleMusicConfigDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private List<BattleMusicTrackDto> tracks = new ArrayList<BattleMusicTrackDto>();
    // Null on old requests means preserve the stored appearance.
    private String lumLuckyAppearance;

    public List<BattleMusicTrackDto> getTracks() { return tracks; }
    public void setTracks(List<BattleMusicTrackDto> tracks) { this.tracks = tracks; }
    public String getLumLuckyAppearance() { return lumLuckyAppearance; }
    public void setLumLuckyAppearance(String value) { lumLuckyAppearance = value; }
}
