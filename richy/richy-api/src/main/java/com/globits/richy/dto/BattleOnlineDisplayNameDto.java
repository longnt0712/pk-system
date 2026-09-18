package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineDisplayNameDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String displayName;

    public BattleOnlineDisplayNameDto() {
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
