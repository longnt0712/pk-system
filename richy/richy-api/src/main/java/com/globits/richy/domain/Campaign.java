package com.globits.richy.domain;

import java.util.ArrayList;
import java.util.List;
import javax.persistence.*;
import com.globits.core.domain.BaseObject;
import org.hibernate.annotations.Nationalized;

@Entity
@Table(name = "tbl_campaign")
public class Campaign extends BaseObject {
    @Version
    private Long version;
    @Column(name = "name", length = 200, nullable = false)
    @Nationalized
    private String name;
    @Column(name = "theme", length = 300)
    @Nationalized
    private String theme;
    @Lob
    @Column(name = "description")
    @Nationalized
    private String description;
    // ISO calendar dates avoid time zone shifts when displaying or printing sheets.
    @Column(name = "start_date", length = 10, nullable = false)
    private String startDate;
    @Column(name = "end_date", length = 10, nullable = false)
    private String endDate;
    @Lob
    @Column(name = "flower_instructions")
    @Nationalized
    private String flowerInstructions;
    @ElementCollection
    @CollectionTable(name = "tbl_campaign_flower_item", joinColumns = @JoinColumn(name = "campaign_id"))
    @OrderColumn(name = "item_order")
    private List<SpiritualFlowerItem> flowerItems = new ArrayList<>();

    public Long getVersion() { return version; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public String getFlowerInstructions() { return flowerInstructions; }
    public void setFlowerInstructions(String flowerInstructions) { this.flowerInstructions = flowerInstructions; }
    public List<SpiritualFlowerItem> getFlowerItems() { return flowerItems; }
}
