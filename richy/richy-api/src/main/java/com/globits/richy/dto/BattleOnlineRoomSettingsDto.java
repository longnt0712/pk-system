package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineRoomSettingsDto implements Serializable {
    private static final long serialVersionUID = 1L;

    /*
     * Topic được khóa ngay từ lúc CREATE ROOM.
     */
    private List<Long> topicIds = new ArrayList<Long>();
    private List<String> topicNames = new ArrayList<String>();

    /*
     * CLASSIC | COUNTDOWN | MONEY_BEG | WHO_IS_DUMBER
     */
    private String mode = "CLASSIC";

    /*
     * CLASSIC:
     * mặc định frontend sẽ đặt bằng tổng số từ của bài khi preload biết total.
     */
    private int questionCount = 20;
    private int secondsPerQuestion = 10;

    /*
     * COUNTDOWN:
     * tổng thời gian toàn trận.
     */
    private int countdownMinutes = 5;

    /*
     * COUNTDOWN/MONEY_BEG/WHO_IS_DUMBER: số giây khóa đáp án sau một câu sai.
     */
    private int wrongAnswerFreezeSeconds = 3;

    /*
     * 0 = chơi cá nhân; 2-10 = số đội do HOST thiết lập.
     */
    private int teamCount = 0;

    public BattleOnlineRoomSettingsDto() {
    }

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

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public void setQuestionCount(int questionCount) {
        this.questionCount = questionCount;
    }

    public int getSecondsPerQuestion() {
        return secondsPerQuestion;
    }

    public void setSecondsPerQuestion(int secondsPerQuestion) {
        this.secondsPerQuestion = secondsPerQuestion;
    }

    public int getCountdownMinutes() {
        return countdownMinutes;
    }

    public void setCountdownMinutes(int countdownMinutes) {
        this.countdownMinutes = countdownMinutes;
    }

    public int getWrongAnswerFreezeSeconds() {
        return wrongAnswerFreezeSeconds;
    }

    public void setWrongAnswerFreezeSeconds(int wrongAnswerFreezeSeconds) {
        this.wrongAnswerFreezeSeconds = wrongAnswerFreezeSeconds;
    }

    public int getTeamCount() {
        return teamCount;
    }

    public void setTeamCount(int teamCount) {
        this.teamCount = teamCount;
    }
}
