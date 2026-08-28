package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlinePasswordGuessResultDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean correct;
    private double amount;
    private String message;
    private BattleOnlineRoomDto room;

    public BattleOnlinePasswordGuessResultDto() {
    }

    public boolean isCorrect() {
        return correct;
    }

    public void setCorrect(boolean correct) {
        this.correct = correct;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
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
