package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineUseSkillDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String targetUsername;

    public BattleOnlineUseSkillDto() {
    }

    public String getTargetUsername() {
        return targetUsername;
    }

    public void setTargetUsername(String targetUsername) {
        this.targetUsername = targetUsername;
    }
}
