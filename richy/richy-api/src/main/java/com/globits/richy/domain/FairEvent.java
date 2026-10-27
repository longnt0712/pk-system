package com.globits.richy.domain;

import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_event")
public class FairEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(nullable = false, length = 150) public String name;
    @Column(nullable = false) public boolean active = true;
    @Column(name = "created_at", nullable = false) public long createdAt;
    @Column(name = "easy_amount", nullable = false) public int easyAmount = 8;
    @Column(name = "medium_amount", nullable = false) public int mediumAmount = 12;
    @Column(name = "hard_amount", nullable = false) public int hardAmount = 20;
}
