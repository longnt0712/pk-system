package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import org.joda.time.LocalDateTime;
import org.hibernate.annotations.Type;

/** One shared schedule for QR attendance. Manual attendance does not use this schedule. */
@Entity
@Table(name = "tbl_attendance_config")
public class AttendanceConfig {
    @Id
    private Integer id = 1;
    @Column(name = "mass_start_time", length = 5, nullable = false)
    private String massStartTime;
    @Column(name = "mass_late_minutes", nullable = false)
    private Integer massLateMinutes;
    @Column(name = "mass_auto_late", nullable = false)
    private Boolean massAutoLate;
    @Column(name = "class_start_time", length = 5, nullable = false)
    private String classStartTime;
    @Column(name = "class_late_minutes", nullable = false)
    private Integer classLateMinutes;
    @Column(name = "class_auto_late", nullable = false)
    private Boolean classAutoLate;
    @Column(name = "qr_switch_time", length = 5, nullable = false)
    private String qrSwitchTime;
    @Column(name = "modified_by", length = 255)
    private String modifiedBy;
    @Column(name = "modify_date")
    @Type(type = "org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
    private LocalDateTime modifyDate;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getMassStartTime() { return massStartTime; }
    public void setMassStartTime(String value) { massStartTime = value; }
    public Integer getMassLateMinutes() { return massLateMinutes; }
    public void setMassLateMinutes(Integer value) { massLateMinutes = value; }
    public Boolean getMassAutoLate() { return massAutoLate; }
    public void setMassAutoLate(Boolean value) { massAutoLate = value; }
    public String getClassStartTime() { return classStartTime; }
    public void setClassStartTime(String value) { classStartTime = value; }
    public Integer getClassLateMinutes() { return classLateMinutes; }
    public void setClassLateMinutes(Integer value) { classLateMinutes = value; }
    public Boolean getClassAutoLate() { return classAutoLate; }
    public void setClassAutoLate(Boolean value) { classAutoLate = value; }
    public String getQrSwitchTime() { return qrSwitchTime; }
    public void setQrSwitchTime(String value) { qrSwitchTime = value; }
    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String value) { modifiedBy = value; }
    public LocalDateTime getModifyDate() { return modifyDate; }
    public void setModifyDate(LocalDateTime value) { modifyDate = value; }
}
