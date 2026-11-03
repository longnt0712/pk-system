package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name = "tbl_school", uniqueConstraints = @UniqueConstraint(name = "uk_school_domain", columnNames = "domain"))
public class School extends BaseObject {
    @Column(name = "name", nullable = false, length = 255) private String name;
    @Column(name = "domain", nullable = false, length = 253) private String domain;
    @Column(name = "active", nullable = false) private boolean active = true;
    @Column(name = "show_attendance", nullable = false) private boolean showAttendance = true;
    public String getName() { return name; }
    public void setName(String value) { name = value; }
    public String getDomain() { return domain; }
    public void setDomain(String value) { domain = value; }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
    public boolean isShowAttendance() { return showAttendance; }
    public void setShowAttendance(boolean value) { showAttendance = value; }
}
