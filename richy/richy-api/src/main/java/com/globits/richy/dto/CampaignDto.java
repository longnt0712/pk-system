package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import com.globits.richy.domain.Campaign;
import com.globits.richy.domain.SpiritualFlowerItem;

/** Public campaign content only; never exposes user or audit data. */
public class CampaignDto {
    private Long id;
    private Long version;
    private String name;
    private String theme;
    private String description;
    private String startDate;
    private String endDate;
    private String flowerInstructions;
    private String desktopLeftImageUrl;
    private String desktopRightImageUrl;
    private String mobileImageUrl;
    private List<FlowerItemDto> flowerItems = new ArrayList<>();

    public CampaignDto() { }
    public CampaignDto(Campaign campaign, boolean includeItems) {
        id = campaign.getId(); version = campaign.getVersion(); name = campaign.getName();
        theme = campaign.getTheme(); description = campaign.getDescription();
        startDate = campaign.getStartDate(); endDate = campaign.getEndDate();
        flowerInstructions = campaign.getFlowerInstructions();
        desktopLeftImageUrl = campaign.getDesktopLeftImageUrl();
        desktopRightImageUrl = campaign.getDesktopRightImageUrl();
        mobileImageUrl = campaign.getMobileImageUrl();
        if (includeItems) {
            for (SpiritualFlowerItem item : campaign.getFlowerItems()) {
                FlowerItemDto dto = new FlowerItemDto();
                dto.setItemKey(itemKey(campaign, item, flowerItems.size()));
                dto.setName(item.getName()); dto.setInstructions(item.getInstructions());
                flowerItems.add(dto);
            }
        }
    }
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
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
    public String getDesktopLeftImageUrl() { return desktopLeftImageUrl; }
    public void setDesktopLeftImageUrl(String desktopLeftImageUrl) { this.desktopLeftImageUrl = desktopLeftImageUrl; }
    public String getDesktopRightImageUrl() { return desktopRightImageUrl; }
    public void setDesktopRightImageUrl(String desktopRightImageUrl) { this.desktopRightImageUrl = desktopRightImageUrl; }
    public String getMobileImageUrl() { return mobileImageUrl; }
    public void setMobileImageUrl(String mobileImageUrl) { this.mobileImageUrl = mobileImageUrl; }
    public List<FlowerItemDto> getFlowerItems() { return flowerItems; }
    public static String itemKey(Campaign campaign, SpiritualFlowerItem item, int index) {
        return item.getItemKey() != null ? item.getItemKey() : UUID.nameUUIDFromBytes(
                (campaign.getId() + ":" + index + ":" + item.getName()).getBytes(StandardCharsets.UTF_8)).toString();
    }
    public void setFlowerItems(List<FlowerItemDto> flowerItems) { this.flowerItems = flowerItems; }

    public static class FlowerItemDto {
        private String itemKey;
        private String name;
        private String instructions;
        public String getName() { return name; }
        public String getItemKey() { return itemKey; }
        public void setItemKey(String itemKey) { this.itemKey = itemKey; }
        public void setName(String name) { this.name = name; }
        public String getInstructions() { return instructions; }
        public void setInstructions(String instructions) { this.instructions = instructions; }
    }
}
