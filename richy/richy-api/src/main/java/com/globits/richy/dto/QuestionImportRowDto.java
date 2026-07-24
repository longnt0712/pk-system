package com.globits.richy.dto;

import java.io.Serializable;

public class QuestionImportRowDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Integer rowNumber;
    private String word;
    private String pronounce;

    /*
     * Preview trả về frontend dùng firstLanguage.
     */
    private String firstLanguage;

    /*
     * Frontend confirm hiện đang gửi motherTongue.
     */
    private String motherTongue;

    private QuestionImportStatus status;
    private String message;

    private Boolean selected;
    private Boolean importable;

    private Long existingQuestionId;

    public Integer getRowNumber() {
        return rowNumber;
    }

    public void setRowNumber(Integer rowNumber) {
        this.rowNumber = rowNumber;
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

    public String getFirstLanguage() {
        return firstLanguage;
    }

    public void setFirstLanguage(String firstLanguage) {
        this.firstLanguage = firstLanguage;
    }

    public String getMotherTongue() {
        return motherTongue;
    }

    public void setMotherTongue(String motherTongue) {
        this.motherTongue = motherTongue;
    }

    public QuestionImportStatus getStatus() {
        return status;
    }

    public void setStatus(QuestionImportStatus status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getSelected() {
        return selected;
    }

    public void setSelected(Boolean selected) {
        this.selected = selected;
    }

    public Boolean getImportable() {
        return importable;
    }

    public void setImportable(Boolean importable) {
        this.importable = importable;
    }

    public Long getExistingQuestionId() {
        return existingQuestionId;
    }

    public void setExistingQuestionId(Long existingQuestionId) {
        this.existingQuestionId = existingQuestionId;
    }
}