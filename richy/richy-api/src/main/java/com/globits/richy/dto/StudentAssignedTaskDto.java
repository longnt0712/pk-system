package com.globits.richy.dto;

import java.io.Serializable;

/** Safe, student-only projection used by the dashboard assignment cards. */
public class StudentAssignedTaskDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long taskId;
    private Long classId;
    private String className;
    private String title;
    private String notes;
    private String activityType;
    private Long topicId;
    private String topicName;
    private Long categoryId;
    private String categoryName;
    private String assignedDate;
    private String dueDate;
    private String dueTime;
    private int requiredAttempts;
    private int completedAttempts;
    private int remainingAttempts;
    private boolean overdue;

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
