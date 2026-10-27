package com.globits.richy.domain;

import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_transaction", uniqueConstraints = {
    @UniqueConstraint(name = "uq_fair_request", columnNames = {"event_id", "request_key"})
}, indexes = @Index(name = "ix_fair_history", columnList = "event_id,wallet_id,id"))
public class FairTransaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "event_id", nullable = false) public Long eventId;
    @Column(name = "wallet_id", nullable = false) public Long walletId;
    @Column(name = "card_code", nullable = false, length = 100) public String cardCode;
    @Column(name = "display_name", nullable = false, length = 200) public String displayName;
    @Column(name = "request_key", nullable = false, length = 36) public String requestKey;
    @Column(nullable = false, length = 100) public String actor;
    @Column(name = "station_name", nullable = false, length = 150) public String stationName;
    @Column(nullable = false, length = 10) public String operation;
    @Column(nullable = false) public int amount;
    @Column(length = 10) public String tier;
    @Column(nullable = false) public int delta;
    @Column(name = "balance_after", nullable = false) public int balanceAfter;
    @Column(name = "created_at", nullable = false) public long createdAt;
    @Column(name = "correction_of") public Long correctionOf;
    @Column(nullable = false) public boolean corrected;
    @Column(length = 300) public String reason;
}
