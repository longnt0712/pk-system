package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_learning_draft", uniqueConstraints = {
        @UniqueConstraint(name = "UK_learning_draft_user_key", columnNames = {"user_id", "draft_key"})
})
public class LearningDraft extends BaseObject {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "draft_key", nullable = false, length = 300)
    private String draftKey;

    @Column(name = "draft_type", nullable = false, length = 40)
    private String draftType;

    @Column(name = "title", length = 500)
    private String title;

    @Lob
    @Column(name = "payload", nullable = false, columnDefinition = "nvarchar(max)")
    private String payload;

    @Column(name = "saved_at", nullable = false)
    private Long savedAt;

    public User getUser() { return user; }
    public void setUser(User value) { user = value; }
    public String getDraftKey() { return draftKey; }
    public void setDraftKey(String value) { draftKey = value; }
    public String getDraftType() { return draftType; }
    public void setDraftType(String value) { draftType = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getPayload() { return payload; }
    public void setPayload(String value) { payload = value; }
    public Long getSavedAt() { return savedAt; }
    public void setSavedAt(Long value) { savedAt = value; }
}
