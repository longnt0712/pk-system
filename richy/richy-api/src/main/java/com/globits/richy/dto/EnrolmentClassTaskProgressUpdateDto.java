package com.globits.richy.dto;

/** Update one student/task cell without overwriting a whole lesson plan. */
public class EnrolmentClassTaskProgressUpdateDto extends EnrolmentClassTaskProgressDto {
    private static final long serialVersionUID = 1L;
    private Long dayVersion;
    public Long getDayVersion() { return dayVersion; }
    public void setDayVersion(Long value) { dayVersion = value; }
}
