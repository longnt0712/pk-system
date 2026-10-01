package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Embeddable;
import org.hibernate.annotations.Nationalized;

/** A daily practice on the campaign's spiritual flower sheet. */
@Embeddable
public class SpiritualFlowerItem {
    @Column(name = "item_key", length = 36)
    private String itemKey;
    @Column(name = "practice_name", length = 200, nullable = false)
    @Nationalized
    private String name;
    @Column(name = "practice_instructions", length = 2000)
    @Nationalized
    private String instructions;

    public String getName() { return name; }
    public String getItemKey() { return itemKey; }
    public void setItemKey(String itemKey) { this.itemKey = itemKey; }
    public void setName(String name) { this.name = name; }
    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
}
