package com.globits.richy.dto;

import java.io.Serializable;

public class EnrolmentClassMoveStudentDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long userId;
    private Long targetTeamId;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getTargetTeamId() {
        return targetTeamId;
    }

    public void setTargetTeamId(Long targetTeamId) {
        this.targetTeamId = targetTeamId;
    }
}
