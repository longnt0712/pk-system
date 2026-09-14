package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineAnswerDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long questionId;
    private String answerKey;
    private String answerText;
    private long questionSequence;

    /*
     * GUESS_WORD: frontend tự nộp phần học sinh đang gõ khi đồng hồ về 0.
     * Server chỉ cho phép cờ này trong khoảng grace rất ngắn sau hạn.
     */
    private boolean autoSubmitted;

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

    public String getAnswerText() {
        return answerText;
    }

    public void setAnswerText(String answerText) {
        this.answerText = answerText;
    }

    public long getQuestionSequence() {
        return questionSequence;
    }

    public void setQuestionSequence(long questionSequence) {
        this.questionSequence = questionSequence;
    }

    public boolean isAutoSubmitted() {
        return autoSubmitted;
    }

    public void setAutoSubmitted(boolean autoSubmitted) {
        this.autoSubmitted = autoSubmitted;
    }
}
