package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlineTimerControlDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean paused;

    public boolean isPaused() { return paused; }
    public void setPaused(boolean paused) { this.paused = paused; }
}
