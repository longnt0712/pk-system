package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineAnswerDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long questionId;
    private String answerKey;
    private long questionSequence;

    public BattleOnlineAnswerDto() {
    }

    public Long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Long questionId) {
        this.questionId = questionId;
    }

    public String getAnswerKey() {
        return answerKey;
    }

    public void setAnswerKey(String answerKey) {
        this.answerKey = answerKey;
    }

    public long getQuestionSequence() {
        return questionSequence;
    }

    public void setQuestionSequence(long questionSequence) {
        this.questionSequence = questionSequence;
    }
}
