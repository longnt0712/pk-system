package com.globits.richy.domain;

import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_item", indexes = @Index(name = "ix_fair_item_event", columnList = "event_id,id"))
public class FairItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(name = "event_id", nullable = false)
    public Long eventId;
    @Column(nullable = false, length = 150, columnDefinition = "nvarchar(150)")
    public String name;
    @Column(name = "unit_price", nullable = false)
    public long unitPrice;
    @Column(nullable = false)
    public int quantity;
    @Column(name = "category_id", nullable = false)
    public Long categoryId;
    @Column(name = "difficulty_id", nullable = false)
    public Long difficultyId;
    @Column(name = "photo", columnDefinition = "varbinary(max)")
    public byte[] photo;
    @Version
    @Column(nullable = false)
    public Long revision;
}
