package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class QuestionImportPreviewDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long topicId;
    private String topicName;

    private int totalRows;
    private int newCount;
    private int addTopicCount;
    private int alreadyInTopicCount;
    private int duplicateInFileCount;
    private int invalidCount;
    private int conflictCount;

    private String message;

    private List<QuestionImportRowDto> rows =
            new ArrayList<QuestionImportRowDto>();

    public Long getTopicId() {
        return topicId;
    }

    public void setTopicId(Long topicId) {
        this.topicId = topicId;
    }

    public String getTopicName() {
        return topicName;
    }

    public void setTopicName(String topicName) {
        this.topicName = topicName;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getNewCount() {
        return newCount;
    }

    public void setNewCount(int newCount) {
        this.newCount = newCount;
    }

    public int getAddTopicCount() {
        return addTopicCount;
    }

    public void setAddTopicCount(int addTopicCount) {
        this.addTopicCount = addTopicCount;
    }

    public int getAlreadyInTopicCount() {
        return alreadyInTopicCount;
    }

    public void setAlreadyInTopicCount(int alreadyInTopicCount) {
        this.alreadyInTopicCount = alreadyInTopicCount;
    }

    public int getDuplicateInFileCount() {
        return duplicateInFileCount;
    }

    public void setDuplicateInFileCount(int duplicateInFileCount) {
        this.duplicateInFileCount = duplicateInFileCount;
    }

    public int getInvalidCount() {
        return invalidCount;
    }

    public void setInvalidCount(int invalidCount) {
        this.invalidCount = invalidCount;
    }

    public int getConflictCount() {
        return conflictCount;
    }

    public void setConflictCount(int conflictCount) {
        this.conflictCount = conflictCount;
    }

    public List<QuestionImportRowDto> getRows() {
        return rows;
    }

    public void setRows(List<QuestionImportRowDto> rows) {
        this.rows = rows;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}