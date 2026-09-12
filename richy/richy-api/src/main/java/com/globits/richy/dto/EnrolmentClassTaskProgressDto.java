package com.globits.richy.dto;
import java.io.Serializable;
import com.globits.richy.domain.EnrolmentClassTaskProgress;

public class EnrolmentClassTaskProgressDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long studentUserId;
    private String status;
    private String notes;
    private boolean automatic;
    private String manualStatus;
    public String getManualStatus() { return manualStatus; }
    public void setManualStatus(String value) { manualStatus = value; }
    private Long testResultId;
    private java.util.Date completedAt;
    public boolean isAutomatic() { return automatic; }
    public void setAutomatic(boolean value) { automatic = value; }
    public Long getTestResultId() { return testResultId; }
    public void setTestResultId(Long value) { testResultId = value; }
    public java.util.Date getCompletedAt() { return completedAt; }
    public void setCompletedAt(java.util.Date value) { completedAt = value; }
    public EnrolmentClassTaskProgressDto() { }
    public EnrolmentClassTaskProgressDto(EnrolmentClassTaskProgress value) {
        studentUserId = value.getStudentUserId(); status = value.getStatus(); notes = value.getNotes();
    }
    public Long getStudentUserId() { return studentUserId; }
    public void setStudentUserId(Long value) { studentUserId = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
}
