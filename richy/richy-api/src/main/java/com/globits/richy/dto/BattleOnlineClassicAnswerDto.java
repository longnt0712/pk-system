package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineClassicAnswerDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String username, displayName, answer;
    private boolean answered, correct;
    public String getUsername() { return username; }
    public void setUsername(String value) { username = value; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String value) { displayName = value; }
    public String getAnswer() { return answer; }
    public void setAnswer(String value) { answer = value; }
    public boolean isAnswered() { return answered; }
    public void setAnswered(boolean value) { answered = value; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean value) { correct = value; }
}
