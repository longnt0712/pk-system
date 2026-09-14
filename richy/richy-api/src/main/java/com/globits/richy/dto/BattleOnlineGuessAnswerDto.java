package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineGuessAnswerDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String username;
    private String displayName;
    private String answer;
    private boolean correct;
    private int correctOrder;
    private double scoreDelta;

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
    public int getCorrectOrder() { return correctOrder; }
    public void setCorrectOrder(int correctOrder) { this.correctOrder = correctOrder; }
    public double getScoreDelta() { return scoreDelta; }
    public void setScoreDelta(double scoreDelta) { this.scoreDelta = scoreDelta; }
}
