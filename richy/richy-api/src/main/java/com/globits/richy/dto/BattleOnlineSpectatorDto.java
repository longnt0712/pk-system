package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineSpectatorDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean spectator;

    public BattleOnlineSpectatorDto() {
    }

    public boolean isSpectator() {
        return spectator;
    }

    public void setSpectator(boolean spectator) {
        this.spectator = spectator;
    }
}
