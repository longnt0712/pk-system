package com.globits.richy.domain;

import java.util.LinkedHashSet;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_enrolment_class_schedule_day", uniqueConstraints = {
        @UniqueConstraint(name = "UK_class_schedule_day", columnNames = {"enrolment_class_id", "schedule_date"})
})
@XmlRootElement
public class EnrolmentClassScheduleDay extends BaseObject {
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
