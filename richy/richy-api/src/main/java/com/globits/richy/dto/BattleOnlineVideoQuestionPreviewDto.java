package com.globits.richy.dto;

import java.io.Serializable;

/** Host-only cue list; contains no answers or full exercise content. */
public class BattleOnlineVideoQuestionPreviewDto implements Serializable {
    private static final long serialVersionUID = 1L;
    public long sequence;
    public int seconds;
    public String preview;
}
