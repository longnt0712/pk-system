package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.richy.domain.EnrolmentClassScheduleDay;
import com.globits.richy.domain.Topic;

public class EnrolmentClassScheduleDayDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private Long enrolmentClassId;
    private String scheduleDate;
    private List<Long> classTopicIds = new ArrayList<Long>();
    private List<Long> homeworkTopicIds = new ArrayList<Long>();
    private List<TopicForListAllDto> classTopics = new ArrayList<TopicForListAllDto>();
    private List<TopicForListAllDto> homeworkTopics = new ArrayList<TopicForListAllDto>();

    public EnrolmentClassScheduleDayDto() { }
    public EnrolmentClassScheduleDayDto(EnrolmentClassScheduleDay domain) {
        id = domain.getId();
        enrolmentClassId = domain.getEnrolmentClass() == null ? null : domain.getEnrolmentClass().getId();
        scheduleDate = domain.getScheduleDate();
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
