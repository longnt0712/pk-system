package com.globits.richy.domain;

import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_wallet", uniqueConstraints = {
    @UniqueConstraint(name = "uq_fair_card", columnNames = {"event_id", "card_code"})
})
public class FairWallet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "event_id", nullable = false) public Long eventId;
    @Column(name = "student_id") public Long studentId;
    @Column(name = "card_code", nullable = false, length = 100) public String cardCode;
    @Column(name = "display_name", nullable = false, length = 200) public String displayName;
    @Column(name = "guest_number") public Integer guestNumber;
    @Column(nullable = false) public int balance;
}
