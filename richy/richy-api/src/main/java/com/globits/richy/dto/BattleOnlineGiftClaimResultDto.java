package com.globits.richy.dto;

public class BattleOnlineGiftClaimResultDto {
    private int rewardLevel;
    private double points;
    private String skillType;
    private String rewardImage;
    private String rewardLabel;
    public String getRewardImage() { return rewardImage; }
    public void setRewardImage(String rewardImage) { this.rewardImage = rewardImage; }
    public String getRewardLabel() { return rewardLabel; }
    public void setRewardLabel(String rewardLabel) { this.rewardLabel = rewardLabel; }
    public String getSkillType() { return skillType; }
    public void setSkillType(String skillType) { this.skillType = skillType; }
    private BattleOnlineRoomDto room;
    public int getRewardLevel() { return rewardLevel; }
    public void setRewardLevel(int rewardLevel) { this.rewardLevel = rewardLevel; }
    public double getPoints() { return points; }
    public void setPoints(double points) { this.points = points; }
    public BattleOnlineRoomDto getRoom() { return room; }
    public void setRoom(BattleOnlineRoomDto room) { this.room = room; }
}
