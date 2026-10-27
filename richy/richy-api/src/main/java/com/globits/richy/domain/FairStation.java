package com.globits.richy.domain;

import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_station", uniqueConstraints = @UniqueConstraint(
    name = "uq_fair_operator", columnNames = {"event_id", "operator_name"}))
public class FairStation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "event_id", nullable = false) public Long eventId;
    @Column(name = "operator_name", nullable = false, length = 100) public String operatorName;
    @Column(nullable = false, length = 150) public String name;
    @Column(nullable = false, length = 10) public String operation;
    // Bind to the tier, never a copied price, so event configuration remains authoritative.
    @Column(nullable = false, length = 10) public String tier;
}
