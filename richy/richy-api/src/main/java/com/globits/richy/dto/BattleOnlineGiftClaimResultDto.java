package com.globits.richy.dto;

public class BattleOnlineGiftClaimResultDto {
    private int rewardLevel;
    private double points;
    private BattleOnlineRoomDto room;
    public int getRewardLevel() { return rewardLevel; }
    public void setRewardLevel(int rewardLevel) { this.rewardLevel = rewardLevel; }
    public double getPoints() { return points; }
    public void setPoints(double points) { this.points = points; }
    public BattleOnlineRoomDto getRoom() { return room; }
    public void setRoom(BattleOnlineRoomDto room) { this.room = room; }
}
