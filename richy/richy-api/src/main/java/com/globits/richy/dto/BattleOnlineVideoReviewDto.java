package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/** Latest completed synchronized-video turn; only the host receives this snapshot. */
public class BattleOnlineVideoReviewDto implements Serializable {
    private static final long serialVersionUID = 1L;
    public long questionSequence, videoQuestionRound;
    public String videoSourceId, questionPreview, correctAnswer;
    public List<BattleOnlineClassicAnswerDto> studentAnswers = new ArrayList<BattleOnlineClassicAnswerDto>();
}
