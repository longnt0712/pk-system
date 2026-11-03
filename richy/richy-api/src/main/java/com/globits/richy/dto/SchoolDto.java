package com.globits.richy.dto;

import com.globits.richy.domain.School;

public class SchoolDto {
    public Long id;
    public String name, domain;
    public boolean active = true, showAttendance = true;
    public SchoolDto() {}
    public SchoolDto(School school) {
        id = school.getId(); name = school.getName(); domain = school.getDomain();
        active = school.isActive(); showAttendance = school.isShowAttendance();
    }
}
