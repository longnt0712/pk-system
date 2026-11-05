package com.globits.richy.dto;

public class FairItemRow {
    public final Long id, categoryId, difficultyId, revision;
    public final String name;
    public final long unitPrice;
    public final int quantity;
    public final boolean hasPhoto;

    public FairItemRow(Long id, String name, long unitPrice, int quantity, Long categoryId,
            Long difficultyId, boolean hasPhoto, Long revision) {
        this.id = id;
        this.name = name;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
        this.categoryId = categoryId;
        this.difficultyId = difficultyId;
        this.hasPhoto = hasPhoto;
        this.revision = revision;
    }
}
