package com.globits.richy.dto;

public class BattleOnlineClassicControlDto {
    private boolean autoAdvance = true;
    private long questionSequence, questionEndsAt;
    public boolean isAutoAdvance() { return autoAdvance; }
    public void setAutoAdvance(boolean value) { autoAdvance = value; }
    public long getQuestionSequence() { return questionSequence; }
    public void setQuestionSequence(long value) { questionSequence = value; }
    public long getQuestionEndsAt() { return questionEndsAt; }
    public void setQuestionEndsAt(long value) { questionEndsAt = value; }
}
