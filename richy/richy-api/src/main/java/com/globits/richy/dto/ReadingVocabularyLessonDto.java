package com.globits.richy.dto;

import com.globits.richy.domain.Topic;
import com.globits.security.domain.User;

public class ReadingVocabularyLessonDto {
    private final Long id;
    private final String name;
    private final TopicCategoryDto topicCategory;
    private final Long sourceUserId;
    private final String sourceUserName;

    public ReadingVocabularyLessonDto(Topic topic) {
        id = topic.getId();
        name = topic.getName();
        topicCategory = new TopicCategoryDto(topic.getTopicCategory());
        User owner = topic.getUser();
        sourceUserId = owner.getId();
        sourceUserName = owner.getPerson() != null && owner.getPerson().getDisplayName() != null
                ? owner.getPerson().getDisplayName() : owner.getUsername();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public TopicCategoryDto getTopicCategory() { return topicCategory; }
    public Long getSourceUserId() { return sourceUserId; }
    public String getSourceUserName() { return sourceUserName; }
}
