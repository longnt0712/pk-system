package com.globits.richy.dto;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import com.globits.richy.domain.EnrolmentClassScheduleTask;
import com.globits.richy.domain.EnrolmentClassTaskProgress;

public class EnrolmentClassScheduleTaskDto implements Serializable {
    private Integer comprehensiveQuestionLimit;
    private Integer comprehensiveTimeLimitMinutes;
    private List<ComprehensiveAssignmentSectionDto> comprehensiveSections;
    private boolean comprehensiveConfiguration;
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean hasComprehensiveConfiguration() { return comprehensiveConfiguration; }
    public Integer getComprehensiveQuestionLimit() { return comprehensiveQuestionLimit; }
    public void setComprehensiveQuestionLimit(Integer value) { comprehensiveQuestionLimit = value; comprehensiveConfiguration = true; }
    public Integer getComprehensiveTimeLimitMinutes() { return comprehensiveTimeLimitMinutes; }
    public void setComprehensiveTimeLimitMinutes(Integer value) { comprehensiveTimeLimitMinutes = value; comprehensiveConfiguration = true; }
    public List<ComprehensiveAssignmentSectionDto> getComprehensiveSections() { return comprehensiveSections; }
    public void setComprehensiveSections(List<ComprehensiveAssignmentSectionDto> value) { comprehensiveSections = value; comprehensiveConfiguration = true; }
    private static final long serialVersionUID = 1L;
    private Long id;
    private String section;
    private String title;
    private String notes;
    private String dueDate;
    private String dueTime;
    private Boolean deadlineAutomatic;
    /* Read-only effective deadline; automatic deadlines are never frozen as manual dates. */
    private String resolvedDueDate;
    private String resolvedDueTime;
    /* Read-only effective start: the end of the class session assigning this task. */
    private String resolvedStartDate;
    private String resolvedStartTime;
    public String getDueTime() { return dueTime; }
    public void setDueTime(String value) { dueTime = value; }
    public Boolean getDeadlineAutomatic() { return deadlineAutomatic; }
    public void setDeadlineAutomatic(Boolean value) { deadlineAutomatic = value; }
    public String getResolvedDueDate() { return resolvedDueDate; }
    public void setResolvedDueDate(String value) { resolvedDueDate = value; }
    public String getResolvedDueTime() { return resolvedDueTime; }
    public void setResolvedDueTime(String value) { resolvedDueTime = value; }
    public String getResolvedStartDate() { return resolvedStartDate; }
    public void setResolvedStartDate(String value) { resolvedStartDate = value; }
    public String getResolvedStartTime() { return resolvedStartTime; }
    public void setResolvedStartTime(String value) { resolvedStartTime = value; }
    private Boolean autoCompleteFromTopic;
    public Boolean getAutoCompleteFromTopic() { return autoCompleteFromTopic; }
    public void setAutoCompleteFromTopic(Boolean value) { autoCompleteFromTopic = value; }
    private String activityType;
    private Boolean shuffleQuestions;
    public Boolean getShuffleQuestions() { return shuffleQuestions; }
    public void setShuffleQuestions(Boolean value) { shuffleQuestions = value; }
    public String getActivityType() { return activityType == null || activityType.trim().isEmpty() ? "DAILY_VOCAB" : activityType; }
    public void setActivityType(String value) { activityType = value; }
    private Integer requiredAttempts;
    public Integer getRequiredAttempts() { return requiredAttempts == null || requiredAttempts < 1 ? 1 : requiredAttempts; }
    public void setRequiredAttempts(Integer value) { requiredAttempts = value; }
    private String status;
    private Long topicId;
    private List<Long> topicIds;
    private List<AssignmentTopicDto> topics = new ArrayList<AssignmentTopicDto>();
    public List<Long> getTopicIds() {
        if (topicIds != null) { return topicIds; }
        return topicId == null ? new ArrayList<Long>() : new ArrayList<Long>(java.util.Collections.singletonList(topicId));
    }
    public void setTopicIds(List<Long> value) { topicIds = value; }
    /** Distinguishes old clients omitting the new field from an explicit empty selection. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean hasTopicIdsSelection() { return topicIds != null; }
    public List<AssignmentTopicDto> getTopics() { return topics; }
    public void setTopics(List<AssignmentTopicDto> value) { topics = value; }
    private String topicName;
    private Long categoryId;
    private String categoryName;
    private Long sourceQuestionId;
    private String sourceQuestionTitle;
    private Long ieltsTestId;
    private String ieltsTestTitle;
    private Integer ieltsPart;
    private List<Integer> ieltsParts;
    private List<EnrolmentClassTaskProgressDto> studentProgress = new ArrayList<EnrolmentClassTaskProgressDto>();
    public EnrolmentClassScheduleTaskDto() { }
    public EnrolmentClassScheduleTaskDto(EnrolmentClassScheduleTask task) {
        comprehensiveQuestionLimit = task.getComprehensiveQuestionLimit();
        comprehensiveTimeLimitMinutes = task.getComprehensiveTimeLimitMinutes();
        comprehensiveSections = com.globits.richy.service.impl.ComprehensiveAssignmentSections.read(task);
        id = task.getId(); section = task.getSection(); title = task.getTitle(); notes = task.getNotes();
        dueDate = task.getDueDate(); status = task.getStatus();
        dueTime = task.getDueTime(); deadlineAutomatic = task.getDeadlineAutomatic();
        autoCompleteFromTopic = task.getAutoCompleteFromTopic();
        activityType = task.getActivityType();
        shuffleQuestions = task.getShuffleQuestions();
        requiredAttempts = task.getRequiredAttempts();
        topicIds = new ArrayList<Long>();
        for (com.globits.richy.domain.Topic selected : task.getTopics()) {
            topicIds.add(selected.getId()); topics.add(new AssignmentTopicDto(selected));
        }
        if (task.getTopic() != null) {
            topicId = task.getTopic().getId(); topicName = task.getTopic().getName();
            if (task.getTopic().getTopicCategory() != null) {
                categoryId = task.getTopic().getTopicCategory().getId();
                categoryName = task.getTopic().getTopicCategory().getName();
            }
        }
        if (task.getSourceQuestion() != null) {
            sourceQuestionId = task.getSourceQuestion().getId();
            sourceQuestionTitle = task.getSourceQuestion().getQuestion();
        }
        if (task.getIeltsTest() != null) {
            ieltsTestId = task.getIeltsTest().getId();
            ieltsTestTitle = task.getIeltsTest().getTitle();
        }
        ieltsPart = task.getIeltsPart();
        ieltsParts = task.getIeltsParts();
        for (EnrolmentClassTaskProgress progress : task.getStudentProgress()) {
            studentProgress.add(new EnrolmentClassTaskProgressDto(progress));
        }
    }
    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public String getSection() { return section; }
    public void setSection(String value) { section = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String value) { dueDate = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public Long getTopicId() { return topicId; }
    public void setTopicId(Long value) { topicId = value; }
    public String getTopicName() { return topicName; }
    public void setTopicName(String value) { topicName = value; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long value) { categoryId = value; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String value) { categoryName = value; }
    public Long getSourceQuestionId() { return sourceQuestionId; }
    public void setSourceQuestionId(Long value) { sourceQuestionId = value; }
    public String getSourceQuestionTitle() { return sourceQuestionTitle; }
    public void setSourceQuestionTitle(String value) { sourceQuestionTitle = value; }
    public Long getIeltsTestId() { return ieltsTestId; }
    public void setIeltsTestId(Long value) { ieltsTestId = value; }
    public String getIeltsTestTitle() { return ieltsTestTitle; }
    public void setIeltsTestTitle(String value) { ieltsTestTitle = value; }
    public Integer getIeltsPart() { return ieltsPart; }
    public void setIeltsPart(Integer value) { ieltsPart = value; }
    public List<Integer> getIeltsParts() {
        if (ieltsParts != null) { return ieltsParts; }
        return ieltsPart == null ? null : java.util.Collections.singletonList(ieltsPart);
    }
    public void setIeltsParts(List<Integer> value) { ieltsParts = value; }
    public List<EnrolmentClassTaskProgressDto> getStudentProgress() { return studentProgress; }
    public void setStudentProgress(List<EnrolmentClassTaskProgressDto> value) { studentProgress = value; }
}
