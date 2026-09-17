package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.LearningDraft;

public class LearningDraftDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private String draftKey;
    private String draftType;
    private String title;
    private String payload;
    private Long savedAt;

    public LearningDraftDto() { }

    public LearningDraftDto(LearningDraft draft) {
        if (draft == null) { return; }
        id = draft.getId();
        draftKey = draft.getDraftKey();
        draftType = draft.getDraftType();
        title = draft.getTitle();
        payload = draft.getPayload();
        savedAt = draft.getSavedAt();
    }

    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
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
