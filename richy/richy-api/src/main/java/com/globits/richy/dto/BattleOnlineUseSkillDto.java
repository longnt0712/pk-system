package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineUseSkillDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String targetUsername;
    /* Optional: UNFREEZE spends a stored rescue charge in DEMON_DEFENSE. */
    private String skillType;

    public String getSkillType() { return skillType; }
    public void setSkillType(String skillType) { this.skillType = skillType; }

    public BattleOnlineUseSkillDto() {
    }

    public String getTargetUsername() {
        return targetUsername;
    }

    public void setTargetUsername(String targetUsername) {
        this.targetUsername = targetUsername;
    }
}
