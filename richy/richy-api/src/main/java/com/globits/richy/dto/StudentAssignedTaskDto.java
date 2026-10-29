package com.globits.richy.dto;

import java.io.Serializable;

/** Safe, student-only projection used by the dashboard assignment cards. */
public class StudentAssignedTaskDto implements Serializable {
    private String assignmentSectionKey;
    private java.util.List<ComprehensiveAssignmentSectionDto> comprehensiveSections;
    private Integer sectionNumber;
    private Integer sectionCount;
    private Integer sectionQuestionCount;
    private Integer sectionFirstOrdinal;
    private Integer sectionLastOrdinal;
    private Integer comprehensiveTimeLimitMinutes;
    public String getAssignmentSectionKey() { return assignmentSectionKey; }
    public void setAssignmentSectionKey(String value) { assignmentSectionKey = value; }
    public java.util.List<ComprehensiveAssignmentSectionDto> getComprehensiveSections() { return comprehensiveSections; }
    public void setComprehensiveSections(java.util.List<ComprehensiveAssignmentSectionDto> value) { comprehensiveSections = value; }
    public Integer getSectionNumber() { return sectionNumber; }
    public void setSectionNumber(Integer value) { sectionNumber = value; }
    public Integer getSectionCount() { return sectionCount; }
    public void setSectionCount(Integer value) { sectionCount = value; }
    public Integer getSectionQuestionCount() { return sectionQuestionCount; }
    public void setSectionQuestionCount(Integer value) { sectionQuestionCount = value; }
    public Integer getSectionFirstOrdinal() { return sectionFirstOrdinal; }
    public void setSectionFirstOrdinal(Integer value) { sectionFirstOrdinal = value; }
    public Integer getSectionLastOrdinal() { return sectionLastOrdinal; }
    public void setSectionLastOrdinal(Integer value) { sectionLastOrdinal = value; }
    public Integer getComprehensiveTimeLimitMinutes() { return comprehensiveTimeLimitMinutes; }
    public void setComprehensiveTimeLimitMinutes(Integer value) { comprehensiveTimeLimitMinutes = value; }
    private static final long serialVersionUID = 1L;
    private Long taskId;
    private Long classId;
    private String className;
    private String title;
    private String notes;
    private String activityType;
    private Boolean shuffleQuestions;
    public Boolean getShuffleQuestions() { return shuffleQuestions; }
    public void setShuffleQuestions(Boolean value) { shuffleQuestions = value; }
    private Long topicId;
    private java.util.List<Long> topicIds;
    private java.util.List<AssignmentTopicDto> topics;
    private int taskCompletedTopics;
    private int taskTotalTopics;
    private int taskProgressPercent;
    public java.util.List<Long> getTopicIds() { return topicIds; }
    public void setTopicIds(java.util.List<Long> value) { topicIds = value; }
    public java.util.List<AssignmentTopicDto> getTopics() { return topics; }
    public void setTopics(java.util.List<AssignmentTopicDto> value) { topics = value; }
    public int getTaskCompletedTopics() { return taskCompletedTopics; }
    public void setTaskCompletedTopics(int value) { taskCompletedTopics = value; }
    public int getTaskTotalTopics() { return taskTotalTopics; }
    public void setTaskTotalTopics(int value) { taskTotalTopics = value; }
    public int getTaskProgressPercent() { return taskProgressPercent; }
    public void setTaskProgressPercent(int value) { taskProgressPercent = value; }
    private String topicName;
    private Long categoryId;
    private String categoryName;
    private Long sourceQuestionId;
    private String sourceQuestionTitle;
    private Long ieltsTestId;
    private String ieltsTestTitle;
    private Integer ieltsPart;
    private java.util.List<Integer> ieltsParts;
    private java.util.List<Integer> remainingIeltsParts;
    private String assignedDate;
    private String dueDate;
    private String dueTime;
    private int requiredAttempts;
    private int completedAttempts;
    private int remainingAttempts;
    private boolean overdue;
    private Boolean canStartNewAttempt;
    private String newAttemptUnavailableReason;
    public Boolean getCanStartNewAttempt() { return canStartNewAttempt; }
    public void setCanStartNewAttempt(Boolean value) { canStartNewAttempt = value; }
    public String getNewAttemptUnavailableReason() { return newAttemptUnavailableReason; }
    public void setNewAttemptUnavailableReason(String value) { newAttemptUnavailableReason = value; }

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long value) { taskId = value; }
    public Long getClassId() { return classId; }
    public void setClassId(Long value) { classId = value; }
    public String getClassName() { return className; }
    public void setClassName(String value) { className = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
    public String getActivityType() { return activityType; }
    public void setActivityType(String value) { activityType = value; }
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
    public java.util.List<Integer> getIeltsParts() { return ieltsParts; }
    public void setIeltsParts(java.util.List<Integer> value) { ieltsParts = value; }
    public java.util.List<Integer> getRemainingIeltsParts() { return remainingIeltsParts; }
    public void setRemainingIeltsParts(java.util.List<Integer> value) { remainingIeltsParts = value; }
    public String getAssignedDate() { return assignedDate; }
    public void setAssignedDate(String value) { assignedDate = value; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String value) { dueDate = value; }
    public String getDueTime() { return dueTime; }
    public void setDueTime(String value) { dueTime = value; }
    public int getRequiredAttempts() { return requiredAttempts; }
    public void setRequiredAttempts(int value) { requiredAttempts = value; }
    public int getCompletedAttempts() { return completedAttempts; }
    public void setCompletedAttempts(int value) { completedAttempts = value; }
    public int getRemainingAttempts() { return remainingAttempts; }
    public void setRemainingAttempts(int value) { remainingAttempts = value; }
    public boolean isOverdue() { return overdue; }
    public void setOverdue(boolean value) { overdue = value; }
}
