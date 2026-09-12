package com.globits.richy.domain;

import java.io.Serializable;
import javax.persistence.Column;
import javax.persistence.Embeddable;

@Embeddable
public class EnrolmentClassTaskProgress implements Serializable {
    private static final long serialVersionUID = 1L;
    @Column(name = "student_user_id", nullable = false)
    private Long studentUserId;
    @Column(name = "status", length = 20, nullable = false)
    private String status;
    @Column(name = "notes", length = 1000)
    private String notes;
    public Long getStudentUserId() { return studentUserId; }
    public void setStudentUserId(Long value) { studentUserId = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
}
