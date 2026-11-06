package com.globits.richy.dto;

import com.globits.richy.question.VocabularyPolicy;

public class VocabularyUsageDto {
    private final String role;
    private final long wordCount, wordLimit, topicCount, topicLimit;
    public VocabularyUsageDto(String role, long wordCount, long wordLimit, long topicCount, long topicLimit) {
        this.role = role; this.wordCount = wordCount; this.wordLimit = wordLimit;
        this.topicCount = topicCount; this.topicLimit = topicLimit;
    }
    public String getRole() { return role; }
    public long getWordCount() { return wordCount; }
    public long getWordLimit() { return wordLimit; }
    public long getTopicCount() { return topicCount; }
    public long getTopicLimit() { return topicLimit; }
    public boolean isWordLimitReached() { return wordLimit >= 0 && wordCount >= wordLimit; }
    public boolean isTopicLimitReached() { return topicLimit >= 0 && topicCount >= topicLimit; }
    public String getWordLimitMessage() { return isWordLimitReached() ? VocabularyPolicy.wordLimitMessage(wordCount, wordLimit) : ""; }
    public String getTopicLimitMessage() { return isTopicLimitReached() ? VocabularyPolicy.lessonLimitMessage(topicCount, topicLimit) : ""; }
}
