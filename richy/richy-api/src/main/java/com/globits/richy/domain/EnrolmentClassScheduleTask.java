package com.globits.richy.domain;

import java.util.ArrayList;
import java.util.List;
import javax.persistence.*;
import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_enrolment_class_schedule_task")
public class EnrolmentClassScheduleTask extends BaseObject {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_day_id", nullable = false)
    private EnrolmentClassScheduleDay scheduleDay;
    @Column(name = "section", length = 10, nullable = false)
    private String section;
    @Column(name = "title", length = 200, nullable = false)
    private String title;
    @Lob @Column(name = "notes", columnDefinition = "nvarchar(max)")
    private String notes;
    @Column(name = "due_date", length = 10)
    private String dueDate;
    @Column(name = "status", length = 20, nullable = false)
    private String status;
    @Column(name = "display_order", nullable = false)
    private int displayOrder;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "topic_id")
    private Topic topic;
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "tbl_enrolment_class_task_progress", joinColumns = @JoinColumn(name = "task_id"))
    private List<EnrolmentClassTaskProgress> studentProgress = new ArrayList<EnrolmentClassTaskProgress>();
    public EnrolmentClassScheduleDay getScheduleDay() { return scheduleDay; }
    public void setScheduleDay(EnrolmentClassScheduleDay value) { scheduleDay = value; }
    public String getSection() { return section; }
    public void setSection(String value) { section = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String value) { dueDate = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int value) { displayOrder = value; }
    public Topic getTopic() { return topic; }
    public void setTopic(Topic value) { topic = value; }
    public List<EnrolmentClassTaskProgress> getStudentProgress() { return studentProgress; }
    public void setStudentProgress(List<EnrolmentClassTaskProgress> value) { studentProgress = value; }
}
