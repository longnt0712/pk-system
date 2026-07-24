package com.globits.richy.dto;

import java.io.Serializable;

public class QuestionImportResultDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private boolean success;
    private int createdCount;
    private int topicAddedCount;
    private int skippedCount;
    private int errorCount;
    private String message;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public int getCreatedCount() {
        return createdCount;
    }

    public void setCreatedCount(int createdCount) {
        this.createdCount = createdCount;
    }

    public int getTopicAddedCount() {
        return topicAddedCount;
    }

    public void setTopicAddedCount(int topicAddedCount) {
        this.topicAddedCount = topicAddedCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }

    public void setSkippedCount(int skippedCount) {
        this.skippedCount = skippedCount;
    }

    public int getErrorCount() {
        return errorCount;
    }

    public void setErrorCount(int errorCount) {
        this.errorCount = errorCount;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}