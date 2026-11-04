package com.globits.richy.dto;

public final class TeachingPdfSession {
    public final Long ownerId;
    public final Long dayId;
    public final Long previousDayId;

    public TeachingPdfSession(Long ownerId, Long dayId, Long previousDayId) {
        this.ownerId = ownerId;
        this.dayId = dayId;
        this.previousDayId = previousDayId;
    }
}
