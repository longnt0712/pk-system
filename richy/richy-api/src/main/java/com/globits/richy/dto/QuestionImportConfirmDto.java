package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class QuestionImportConfirmDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long topicId;
    private boolean updateEmptyFields = true;

    private List<QuestionImportRowDto> rows =
            new ArrayList<QuestionImportRowDto>();

    public Long getTopicId() {
        return topicId;
    }

    public void setTopicId(Long topicId) {
        this.topicId = topicId;
    }

    public boolean isUpdateEmptyFields() {
        return updateEmptyFields;
    }

    public void setUpdateEmptyFields(boolean updateEmptyFields) {
        this.updateEmptyFields = updateEmptyFields;
    }

    public List<QuestionImportRowDto> getRows() {
        return rows;
    }

    public void setRows(List<QuestionImportRowDto> rows) {
        this.rows = rows;
    }
}