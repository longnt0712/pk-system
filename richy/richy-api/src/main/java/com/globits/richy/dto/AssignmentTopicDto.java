package com.globits.richy.dto;

import java.io.Serializable;
import com.globits.richy.domain.Topic;

/** Topic metadata only; no vocabulary content, user data, or answer payloads. */
public class AssignmentTopicDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long topicId;
    private String topicName;
    private Long categoryId;
    private String categoryName;
    public AssignmentTopicDto() { }
    public AssignmentTopicDto(Topic topic) {
        topicId = topic.getId(); topicName = topic.getName();
        if (topic.getTopicCategory() != null) {
            categoryId = topic.getTopicCategory().getId(); categoryName = topic.getTopicCategory().getName();
        }
    }
    public Long getTopicId() { return topicId; }
    public void setTopicId(Long value) { topicId = value; }
    public String getTopicName() { return topicName; }
    public void setTopicName(String value) { topicName = value; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long value) { categoryId = value; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String value) { categoryName = value; }
}
