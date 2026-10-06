package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineCreateRoomDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String questionSource;
    private List<Long> exerciseTestIds = new ArrayList<Long>();

    private List<Long> topicIds = new ArrayList<Long>();
    private List<String> topicNames = new ArrayList<String>();

    /**
     * Chủ sở hữu bộ từ được chọn khi tạo phòng.
     * Chỉ chấp nhận chính tài khoản HOST hoặc tài khoản dùng chung ID 26.
     */
    private Long questionOwnerUserId;

    public BattleOnlineCreateRoomDto() {
    }

    public String getQuestionSource() { return questionSource; }
    public void setQuestionSource(String questionSource) { this.questionSource = questionSource; }
    public List<Long> getExerciseTestIds() { return exerciseTestIds; }
    public void setExerciseTestIds(List<Long> exerciseTestIds) { this.exerciseTestIds = exerciseTestIds; }

    public List<Long> getTopicIds() {
        return topicIds;
    }

    public void setTopicIds(List<Long> topicIds) {
        this.topicIds = topicIds;
    }

    public List<String> getTopicNames() {
        return topicNames;
    }

    public void setTopicNames(List<String> topicNames) {
        this.topicNames = topicNames;
    }

    public Long getQuestionOwnerUserId() {
        return questionOwnerUserId;
    }

    public void setQuestionOwnerUserId(Long questionOwnerUserId) {
        this.questionOwnerUserId = questionOwnerUserId;
    }
}
