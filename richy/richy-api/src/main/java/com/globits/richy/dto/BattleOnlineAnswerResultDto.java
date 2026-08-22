package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineAnswerResultDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean accepted;
    private boolean correct;

    private double score;
    private int streak;

    private String message;

    /*
     * COUNTDOWN trả luôn room state riêng của account
     * để client nhận câu ngẫu nhiên kế tiếp ngay lập tức.
     */
    private BattleOnlineRoomDto room;

    public BattleOnlineAnswerResultDto() {
    }

    public boolean isAccepted() {
        return accepted;
    }

    public void setAccepted(boolean accepted) {
        this.accepted = accepted;
    }

    public boolean isCorrect() {
        return correct;
    }

    public void setCorrect(boolean correct) {
        this.correct = correct;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public int getStreak() {
        return streak;
    }

    public void setStreak(int streak) {
        this.streak = streak;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public BattleOnlineRoomDto getRoom() {
        return room;
    }

    public void setRoom(BattleOnlineRoomDto room) {
        this.room = room;
    }
}
