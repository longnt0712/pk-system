package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlinePlayerDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String username;
    private String displayName;

    private boolean host;
    private boolean spectator;
    private boolean ready;
    private boolean connected;
    private boolean answeredCurrentQuestion;

    private double score;
    private int streak;
    private int correctCount;
    private int wrongCount;
    private int rank;
    private int teamNumber;

    /*
     * COUNTDOWN progress:
     * số từ khác nhau người chơi đã gặp ít nhất 1 lần.
     */
    private int uniqueWordsSeen;
    private int totalLessonWords;

    /*
     * COUNTDOWN skill FREEZE.
     * Epoch milliseconds; client tự tính số giây còn lại theo serverTime.
     */
    private long frozenUntil;

    /*
     * ESCAPE_DUMB_DEMON skill INVERT.
     * Epoch milliseconds; client đảo màn hình trả lời đến thời điểm này.
     */
    private long invertedUntil;

    /*
     * COUNTDOWN skill FIRE_UP.
     * Trong thời gian này, điểm vừa nhận của mỗi câu đúng được nhân 1.2.
     */
    private long burningUntil;

    public BattleOnlinePlayerDto() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public boolean isHost() {
        return host;
    }

    public void setHost(boolean host) {
        this.host = host;
    }

    public boolean isSpectator() {
        return spectator;
    }

    public void setSpectator(boolean spectator) {
        this.spectator = spectator;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public boolean isAnsweredCurrentQuestion() {
        return answeredCurrentQuestion;
    }

    public void setAnsweredCurrentQuestion(boolean answeredCurrentQuestion) {
        this.answeredCurrentQuestion = answeredCurrentQuestion;
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

    public int getCorrectCount() {
        return correctCount;
    }

    public void setCorrectCount(int correctCount) {
        this.correctCount = correctCount;
    }

    public int getWrongCount() {
        return wrongCount;
    }

    public void setWrongCount(int wrongCount) {
        this.wrongCount = wrongCount;
    }

    public int getRank() {
        return rank;
    }

    public void setRank(int rank) {
        this.rank = rank;
    }

    public int getTeamNumber() {
        return teamNumber;
    }

    public void setTeamNumber(int teamNumber) {
        this.teamNumber = teamNumber;
    }

    public int getUniqueWordsSeen() {
        return uniqueWordsSeen;
    }

    public void setUniqueWordsSeen(int uniqueWordsSeen) {
        this.uniqueWordsSeen = uniqueWordsSeen;
    }

    public int getTotalLessonWords() {
        return totalLessonWords;
    }

    public void setTotalLessonWords(int totalLessonWords) {
        this.totalLessonWords = totalLessonWords;
    }

    public long getFrozenUntil() {
        return frozenUntil;
    }

    public void setFrozenUntil(long frozenUntil) {
        this.frozenUntil = frozenUntil;
    }

    public long getInvertedUntil() {
        return invertedUntil;
    }

    public void setInvertedUntil(long invertedUntil) {
        this.invertedUntil = invertedUntil;
    }

    public long getBurningUntil() {
        return burningUntil;
    }

    public void setBurningUntil(long burningUntil) {
        this.burningUntil = burningUntil;
    }
}
