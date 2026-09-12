package com.globits.richy.domain;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import javax.persistence.CascadeType;
import javax.persistence.OneToMany;
import javax.persistence.OrderBy;
import javax.persistence.Lob;
import javax.persistence.Version;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_enrolment_class_schedule_day", uniqueConstraints = {
        @UniqueConstraint(name = "UK_class_schedule_day", columnNames = {"enrolment_class_id", "schedule_date"})
})
@XmlRootElement
public class EnrolmentClassScheduleDay extends BaseObject {
    @Version @Column(name = "schedule_version", nullable = false)
    private long scheduleVersion;
    @Column(name = "session_start_time", length = 5)
    private String sessionStartTime;
    @Column(name = "session_end_time", length = 5)
    private String sessionEndTime;
    @Column(name = "moved_from_date", length = 10)
    private String movedFromDate;
    /* Empty source-date marker. The live plan keeps its original id and children. */
    @Column(name = "moved_to_date", length = 10)
    private String movedToDate;
    @Column(name = "moved_day_id")
    private Long movedDayId;
    @Column(name = "move_reason", length = 1000, columnDefinition = "nvarchar(1000)")
    private String moveReason;
    public String getSessionStartTime() { return sessionStartTime; }
    public void setSessionStartTime(String value) { sessionStartTime = value; }
    public String getSessionEndTime() { return sessionEndTime; }
    public void setSessionEndTime(String value) { sessionEndTime = value; }
    public String getMovedFromDate() { return movedFromDate; }
    public void setMovedFromDate(String value) { movedFromDate = value; }
    public String getMovedToDate() { return movedToDate; }
    public void setMovedToDate(String value) { movedToDate = value; }
    public Long getMovedDayId() { return movedDayId; }
    public void setMovedDayId(Long value) { movedDayId = value; }
    public String getMoveReason() { return moveReason; }
    public void setMoveReason(String value) { moveReason = value; }
    @Lob @Column(name = "class_notes", columnDefinition = "nvarchar(max)")
    private String classNotes;
    @Lob @Column(name = "homework_notes", columnDefinition = "nvarchar(max)")
    private String homeworkNotes;
    @OneToMany(mappedBy = "scheduleDay", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<EnrolmentClassScheduleTask> tasks = new ArrayList<EnrolmentClassScheduleTask>();
    public long getScheduleVersion() { return scheduleVersion; }
    public String getClassNotes() { return classNotes; }
    public void setClassNotes(String value) { classNotes = value; }
    public String getHomeworkNotes() { return homeworkNotes; }
    public void setHomeworkNotes(String value) { homeworkNotes = value; }
    public List<EnrolmentClassScheduleTask> getTasks() { return tasks; }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrolment_class_id", nullable = false)
    private EnrolmentClass enrolmentClass;

    @Column(name = "schedule_date", length = 10, nullable = false)
    private String scheduleDate;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "tbl_enrolment_class_day_class_topic",
            joinColumns = @JoinColumn(name = "schedule_day_id"),
            inverseJoinColumns = @JoinColumn(name = "topic_id"))
    private Set<Topic> classTopics = new LinkedHashSet<Topic>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "tbl_enrolment_class_day_homework_topic",
            joinColumns = @JoinColumn(name = "schedule_day_id"),
            inverseJoinColumns = @JoinColumn(name = "topic_id"))
    private Set<Topic> homeworkTopics = new LinkedHashSet<Topic>();

    public EnrolmentClass getEnrolmentClass() { return enrolmentClass; }
    public void setEnrolmentClass(EnrolmentClass enrolmentClass) { this.enrolmentClass = enrolmentClass; }
    public String getScheduleDate() { return scheduleDate; }
    public void setScheduleDate(String scheduleDate) { this.scheduleDate = scheduleDate; }
    public Set<Topic> getClassTopics() { return classTopics; }
    public void setClassTopics(Set<Topic> classTopics) { this.classTopics = classTopics; }
    public Set<Topic> getHomeworkTopics() { return homeworkTopics; }
    public void setHomeworkTopics(Set<Topic> homeworkTopics) { this.homeworkTopics = homeworkTopics; }
}
