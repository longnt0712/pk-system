package com.globits.richy.domain;

import javax.persistence.*;
import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;

/** A private QR credential. Never serialize this entity to a public response. */
@Entity
@Table(name = "tbl_campaign_flower_access")
public class CampaignFlowerAccess extends BaseObject {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false, unique = true)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User student;
    @Column(name = "token", length = 43, nullable = false, unique = true)
    private String token;
    @Column(name = "token_hash", length = 64, nullable = false, unique = true)
    private String tokenHash;
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
}
