package com.globits.richy.dto;

/** Fields needed to render a date in the monthly calendar. */
public class EnrolmentClassCalendarDayDto {
    public final Long id;
    public final String scheduleDate;
    public final String sessionStartTime;
    public final String sessionEndTime;
    public final boolean dayOff;
    public final String movedFromDate;
    public final String movedToDate;
    public final int classTopicCount;
    public final int homeworkTopicCount;
    public final int taskCount;

    public EnrolmentClassCalendarDayDto(Long id, String scheduleDate, String sessionStartTime,
            String sessionEndTime, Boolean dayOff, String movedFromDate, String movedToDate,
            Long classTopicCount, Long homeworkTopicCount, Long taskCount) {
        this.id = id;
        this.scheduleDate = scheduleDate;
        this.sessionStartTime = sessionStartTime;
        this.sessionEndTime = sessionEndTime;
        this.dayOff = Boolean.TRUE.equals(dayOff);
        this.movedFromDate = movedFromDate;
        this.movedToDate = movedToDate;
        this.classTopicCount = classTopicCount.intValue();
        this.homeworkTopicCount = homeworkTopicCount.intValue();
        this.taskCount = taskCount.intValue();
    }
}
