package com.globits.richy.dto;

import java.io.Serializable;

/** Administrative room metadata only; never contains questions or player answers. */
public class BattleOnlineAdminRoomDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String code, status, mode, hostUsername, hostDisplayName, topicName;
    private long createdAt, startedAt, updatedAt, matchEndsAt;
    private int playerCount, connectedPlayerCount, spectatorCount;
    private boolean giftOpening, adminTerminated;

    public String getCode() { return code; }
    public void setCode(String value) { code = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getMode() { return mode; }
    public void setMode(String value) { mode = value; }
    public String getHostUsername() { return hostUsername; }
    public void setHostUsername(String value) { hostUsername = value; }
    public String getHostDisplayName() { return hostDisplayName; }
    public void setHostDisplayName(String value) { hostDisplayName = value; }
    public String getTopicName() { return topicName; }
    public void setTopicName(String value) { topicName = value; }
    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long value) { createdAt = value; }
    public long getStartedAt() { return startedAt; }
    public void setStartedAt(long value) { startedAt = value; }
    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long value) { updatedAt = value; }
    public long getMatchEndsAt() { return matchEndsAt; }
    public void setMatchEndsAt(long value) { matchEndsAt = value; }
    public int getPlayerCount() { return playerCount; }
    public void setPlayerCount(int value) { playerCount = value; }
    public int getConnectedPlayerCount() { return connectedPlayerCount; }
    public void setConnectedPlayerCount(int value) { connectedPlayerCount = value; }
    public int getSpectatorCount() { return spectatorCount; }
    public void setSpectatorCount(int value) { spectatorCount = value; }
    public boolean isGiftOpening() { return giftOpening; }
    public void setGiftOpening(boolean value) { giftOpening = value; }
    public boolean isAdminTerminated() { return adminTerminated; }
    public void setAdminTerminated(boolean value) { adminTerminated = value; }
}
