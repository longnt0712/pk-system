package com.globits.richy.dto;

/** Only the room host may advance the shared video timeline. */
public class BattleOnlineVideoDto {
    public long questionSequence;
    public double seconds;
    public String event;
    public long targetQuestionSequence;
    public String videoSourceId;
}
