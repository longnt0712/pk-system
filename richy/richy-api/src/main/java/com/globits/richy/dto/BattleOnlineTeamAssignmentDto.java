package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineTeamAssignmentDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String targetUsername;
    private int teamNumber;

    public BattleOnlineTeamAssignmentDto() {
    }

    public String getTargetUsername() {
        return targetUsername;
    }

    public void setTargetUsername(String targetUsername) {
        this.targetUsername = targetUsername;
    }

    public int getTeamNumber() {
        return teamNumber;
    }

    public void setTeamNumber(int teamNumber) {
        this.teamNumber = teamNumber;
    }
}
