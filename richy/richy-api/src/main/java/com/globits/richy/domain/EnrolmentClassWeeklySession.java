package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_enrolment_class_weekly_session", uniqueConstraints = {
        @UniqueConstraint(name = "UK_class_weekly_session",
                columnNames = {"enrolment_class_id", "day_of_week", "start_time", "end_time"})
})
@XmlRootElement
public class EnrolmentClassWeeklySession extends BaseObject {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrolment_class_id", nullable = false)
    private EnrolmentClass enrolmentClass;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(name = "start_time", length = 5, nullable = false)
    private String startTime;

    @Column(name = "end_time", length = 5, nullable = false)
    private String endTime;

    @Column(name = "display_order")
    private Integer displayOrder;

    public EnrolmentClass getEnrolmentClass() { return enrolmentClass; }
    public void setEnrolmentClass(EnrolmentClass enrolmentClass) { this.enrolmentClass = enrolmentClass; }
    public Integer getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
