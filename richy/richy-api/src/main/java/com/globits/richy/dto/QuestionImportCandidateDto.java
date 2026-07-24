package com.globits.richy.dto;

import java.io.Serializable;

public class QuestionImportCandidateDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private String word;
    private String pronounce;
    private String motherTongue;
    private Boolean alreadyInTopic;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getWord() {
        return word;
    }

    public void setWord(String word) {
        this.word = word;
    }

    public String getPronounce() {
        return pronounce;
    }

    public void setPronounce(String pronounce) {
        this.pronounce = pronounce;
    }

    public String getMotherTongue() {
        return motherTongue;
    }

    public void setMotherTongue(String motherTongue) {
        this.motherTongue = motherTongue;
    }

    public Boolean getAlreadyInTopic() {
        return alreadyInTopic;
    }

    public void setAlreadyInTopic(Boolean alreadyInTopic) {
        this.alreadyInTopic = alreadyInTopic;
    }
}