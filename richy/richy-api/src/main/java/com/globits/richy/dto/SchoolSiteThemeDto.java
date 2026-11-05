package com.globits.richy.dto;

import com.globits.richy.domain.School;

public class SchoolSiteThemeDto extends SiteThemeDto {
    public Long schoolId;
    public String name, domain;
    public boolean configured;
    public SchoolSiteThemeDto() { }
    public SchoolSiteThemeDto(School school, String theme) {
        super(theme);
        schoolId = school.getId(); name = school.getName(); domain = school.getDomain(); configured = true;
    }
}
