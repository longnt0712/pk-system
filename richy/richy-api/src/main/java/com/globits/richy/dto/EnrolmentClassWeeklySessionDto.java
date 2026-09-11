package com.globits.richy.dto;

import java.io.Serializable;
import com.globits.richy.domain.EnrolmentClassWeeklySession;

public class EnrolmentClassWeeklySessionDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private Integer dayOfWeek;
    private String startTime;
    private String endTime;
    private Integer displayOrder;

    public EnrolmentClassWeeklySessionDto() { }
    public EnrolmentClassWeeklySessionDto(EnrolmentClassWeeklySession domain) {
        id = domain.getId();
        dayOfWeek = domain.getDayOfWeek();
        startTime = domain.getStartTime();
        endTime = domain.getEndTime();
        displayOrder = domain.getDisplayOrder();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
