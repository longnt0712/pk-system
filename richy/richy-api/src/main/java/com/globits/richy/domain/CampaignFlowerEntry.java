package com.globits.richy.domain;

import javax.persistence.*;
import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_campaign_flower_entry", uniqueConstraints = @UniqueConstraint(
        name = "uq_flower_student_day_item", columnNames = {"campaign_id", "student_id", "entry_date", "item_key"}))
public class CampaignFlowerEntry extends BaseObject {
    @Column(name = "campaign_id", nullable = false) private Long campaignId;
    @Column(name = "student_id", nullable = false) private Long studentId;
    @Column(name = "entry_date", length = 10, nullable = false) private String date;
    @Column(name = "item_key", length = 36, nullable = false) private String itemKey;
    @Column(name = "completed", nullable = false) private boolean completed;
    @Column(name = "paint_color", length = 7) private String paintColor;
    public String getPaintColor() { return paintColor; }
    public void setPaintColor(String paintColor) { this.paintColor = paintColor; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long campaignId) { this.campaignId = campaignId; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public String getItemKey() { return itemKey; }
    public void setItemKey(String itemKey) { this.itemKey = itemKey; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
}
