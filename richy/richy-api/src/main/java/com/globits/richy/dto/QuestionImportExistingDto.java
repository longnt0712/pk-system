package com.globits.richy.dto;

import java.io.Serializable;

public class QuestionImportExistingDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private String question;
    private String pronounce;
    private String motherTongue;

    public QuestionImportExistingDto() {
    }

    public QuestionImportExistingDto(
            Long id,
            String question,
            String pronounce,
            String motherTongue) {

        this.id = id;
        this.question = question;
        this.pronounce = pronounce;
        this.motherTongue = motherTongue;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
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
}