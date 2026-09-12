package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.richy.domain.EnrolmentClassScheduleDay;
import com.globits.richy.domain.Topic;
import com.globits.richy.domain.EnrolmentClassScheduleTask;

public class EnrolmentClassScheduleDayDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private Long enrolmentClassId;
    private String scheduleDate;
    private String sessionStartTime;
    private String sessionEndTime;
    private String movedFromDate;
    private String movedToDate;
    private String moveReason;
    private String defaultHomeworkDeadline;
    public String getSessionStartTime() { return sessionStartTime; }
    public void setSessionStartTime(String value) { sessionStartTime = value; }
    public String getSessionEndTime() { return sessionEndTime; }
    public void setSessionEndTime(String value) { sessionEndTime = value; }
    public String getMovedFromDate() { return movedFromDate; }
    public void setMovedFromDate(String value) { movedFromDate = value; }
    public String getMovedToDate() { return movedToDate; }
    public void setMovedToDate(String value) { movedToDate = value; }
    public String getMoveReason() { return moveReason; }
    public void setMoveReason(String value) { moveReason = value; }
    public String getDefaultHomeworkDeadline() { return defaultHomeworkDeadline; }
    public void setDefaultHomeworkDeadline(String value) { defaultHomeworkDeadline = value; }
    private Long version;
    private String classNotes;
    private String homeworkNotes;
    /* Null means omitted by an older client; [] explicitly clears tasks. */
    private List<EnrolmentClassScheduleTaskDto> tasks;
    private List<Long> classTopicIds = new ArrayList<Long>();
    private List<Long> homeworkTopicIds = new ArrayList<Long>();
    private List<TopicForListAllDto> classTopics = new ArrayList<TopicForListAllDto>();
    private List<TopicForListAllDto> homeworkTopics = new ArrayList<TopicForListAllDto>();

    public EnrolmentClassScheduleDayDto() { }
    public EnrolmentClassScheduleDayDto(EnrolmentClassScheduleDay domain) {
        id = domain.getId();
        enrolmentClassId = domain.getEnrolmentClass() == null ? null : domain.getEnrolmentClass().getId();
        scheduleDate = domain.getScheduleDate();
        sessionStartTime = domain.getSessionStartTime(); sessionEndTime = domain.getSessionEndTime();
        movedFromDate = domain.getMovedFromDate(); movedToDate = domain.getMovedToDate(); moveReason = domain.getMoveReason();
        version = domain.getScheduleVersion();
        classNotes = domain.getClassNotes();
        homeworkNotes = domain.getHomeworkNotes();
        tasks = new ArrayList<EnrolmentClassScheduleTaskDto>();
        for (EnrolmentClassScheduleTask task : domain.getTasks()) {
            tasks.add(new EnrolmentClassScheduleTaskDto(task));
        }
        if (domain.getClassTopics() != null) {
            for (Topic topic : domain.getClassTopics()) {
                classTopicIds.add(topic.getId());
                classTopics.add(new TopicForListAllDto(topic));
            }
        }
        if (domain.getHomeworkTopics() != null) {
            for (Topic topic : domain.getHomeworkTopics()) {
                homeworkTopicIds.add(topic.getId());
                homeworkTopics.add(new TopicForListAllDto(topic));
            }
        }
    }

    public Long getId() { return id; }
    public Long getVersion() { return version; }
    public void setVersion(Long value) { version = value; }
    public String getClassNotes() { return classNotes; }
    public void setClassNotes(String value) { classNotes = value; }
    public String getHomeworkNotes() { return homeworkNotes; }
    public void setHomeworkNotes(String value) { homeworkNotes = value; }
    public List<EnrolmentClassScheduleTaskDto> getTasks() { return tasks; }
    public void setTasks(List<EnrolmentClassScheduleTaskDto> value) { tasks = value; }
    public void setId(Long id) { this.id = id; }
    public Long getEnrolmentClassId() { return enrolmentClassId; }
    public void setEnrolmentClassId(Long enrolmentClassId) { this.enrolmentClassId = enrolmentClassId; }
    public String getScheduleDate() { return scheduleDate; }
    public void setScheduleDate(String scheduleDate) { this.scheduleDate = scheduleDate; }
    public List<Long> getClassTopicIds() { return classTopicIds; }
    public void setClassTopicIds(List<Long> classTopicIds) { this.classTopicIds = classTopicIds; }
    public List<Long> getHomeworkTopicIds() { return homeworkTopicIds; }
    public void setHomeworkTopicIds(List<Long> homeworkTopicIds) { this.homeworkTopicIds = homeworkTopicIds; }
    public List<TopicForListAllDto> getClassTopics() { return classTopics; }
    public void setClassTopics(List<TopicForListAllDto> classTopics) { this.classTopics = classTopics; }
    public List<TopicForListAllDto> getHomeworkTopics() { return homeworkTopics; }
    public void setHomeworkTopics(List<TopicForListAllDto> homeworkTopics) { this.homeworkTopics = homeworkTopics; }
}
