package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineReadyDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean ready;

    public BattleOnlineReadyDto() {
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }
}
