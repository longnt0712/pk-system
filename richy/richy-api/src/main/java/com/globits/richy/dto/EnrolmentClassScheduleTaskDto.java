package com.globits.richy.dto;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import com.globits.richy.domain.EnrolmentClassScheduleTask;
import com.globits.richy.domain.EnrolmentClassTaskProgress;

public class EnrolmentClassScheduleTaskDto implements Serializable {
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
    public String getDueTime() { return dueTime; }
    public void setDueTime(String value) { dueTime = value; }
    public Boolean getDeadlineAutomatic() { return deadlineAutomatic; }
    public void setDeadlineAutomatic(Boolean value) { deadlineAutomatic = value; }
    public String getResolvedDueDate() { return resolvedDueDate; }
    public void setResolvedDueDate(String value) { resolvedDueDate = value; }
    public String getResolvedDueTime() { return resolvedDueTime; }
    public void setResolvedDueTime(String value) { resolvedDueTime = value; }
    private Boolean autoCompleteFromTopic;
    public Boolean getAutoCompleteFromTopic() { return autoCompleteFromTopic; }
    public void setAutoCompleteFromTopic(Boolean value) { autoCompleteFromTopic = value; }
    private String status;
    private Long topicId;
    private String topicName;
    private Long categoryId;
    private String categoryName;
    private List<EnrolmentClassTaskProgressDto> studentProgress = new ArrayList<EnrolmentClassTaskProgressDto>();
    public EnrolmentClassScheduleTaskDto() { }
    public EnrolmentClassScheduleTaskDto(EnrolmentClassScheduleTask task) {
        id = task.getId(); section = task.getSection(); title = task.getTitle(); notes = task.getNotes();
        dueDate = task.getDueDate(); status = task.getStatus();
        dueTime = task.getDueTime(); deadlineAutomatic = task.getDeadlineAutomatic();
        autoCompleteFromTopic = task.getAutoCompleteFromTopic();
        if (task.getTopic() != null) {
            topicId = task.getTopic().getId(); topicName = task.getTopic().getName();
            if (task.getTopic().getTopicCategory() != null) {
                categoryId = task.getTopic().getTopicCategory().getId();
                categoryName = task.getTopic().getTopicCategory().getName();
            }
        }
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
    public List<EnrolmentClassTaskProgressDto> getStudentProgress() { return studentProgress; }
    public void setStudentProgress(List<EnrolmentClassTaskProgressDto> value) { studentProgress = value; }
}
