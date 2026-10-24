package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlinePasswordGuessDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String optionKey;
    private long passwordGuessEndsAt;

    public BattleOnlinePasswordGuessDto() {
    }

    public long getPasswordGuessEndsAt() { return passwordGuessEndsAt; }

    public void setPasswordGuessEndsAt(long passwordGuessEndsAt) { this.passwordGuessEndsAt = passwordGuessEndsAt; }

    public String getOptionKey() {
        return optionKey;
    }

    public void setOptionKey(String optionKey) {
        this.optionKey = optionKey;
    }
}
