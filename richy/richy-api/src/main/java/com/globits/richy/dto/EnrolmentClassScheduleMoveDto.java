package com.globits.richy.dto;
import java.io.Serializable;
public class EnrolmentClassScheduleMoveDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String fromDate, toDate, startTime, endTime, reason;
    private Long dayId, dayVersion;
    private boolean shiftManualDeadlines;
    public String getFromDate() { return fromDate; }
    public void setFromDate(String value) { fromDate = value; }
    public String getToDate() { return toDate; }
    public void setToDate(String value) { toDate = value; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String value) { startTime = value; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String value) { endTime = value; }
    public String getReason() { return reason; }
    public void setReason(String value) { reason = value; }
    public Long getDayId() { return dayId; }
    public void setDayId(Long value) { dayId = value; }
    public Long getDayVersion() { return dayVersion; }
    public void setDayVersion(Long value) { dayVersion = value; }
    public boolean isShiftManualDeadlines() { return shiftManualDeadlines; }
    public void setShiftManualDeadlines(boolean value) { shiftManualDeadlines = value; }
}
