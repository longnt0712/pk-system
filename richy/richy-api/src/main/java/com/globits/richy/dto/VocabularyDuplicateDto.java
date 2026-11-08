package com.globits.richy.dto;

import com.globits.richy.domain.Question;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;

/** Contracts for the current user's duplicate words and an explicitly reviewed merge. */
public final class VocabularyDuplicateDto {
    private VocabularyDuplicateDto() { }

    public static class Group {
        private String word;
        private List<Long> ids = new ArrayList<Long>();
        private boolean reviewed;
        private Date reviewedAt;
        public String getWord() { return word; }
        public void setWord(String value) { word = value; }
        public List<Long> getIds() { return ids; }
        public void setIds(List<Long> value) { ids = value; }
        public int getCount() { return ids == null ? 0 : ids.size(); }
        public boolean isReviewed() { return reviewed; }
        public void setReviewed(boolean value) { reviewed = value; }
        public Date getReviewedAt() { return reviewedAt; }
        public void setReviewedAt(Date value) { reviewedAt = value; }
    }

    public static class Card extends QuestionDto {
        private String fingerprint;
        public Card() { }
        public Card(Question question, String value) { super(question); fingerprint = value; }
        public String getFingerprint() { return fingerprint; }
        public void setFingerprint(String value) { fingerprint = value; }
    }

    public static class Source {
        private Long id;
        private String fingerprint;
        public Long getId() { return id; }
        public void setId(Long value) { id = value; }
        public String getFingerprint() { return fingerprint; }
        public void setFingerprint(String value) { fingerprint = value; }
    }

    public static class Merge {
        private Long primaryId;
        private List<Long> groupIds;
        private List<Source> sources = new ArrayList<Source>();
        private String meaning;
        public Long getPrimaryId() { return primaryId; }
        public void setPrimaryId(Long value) { primaryId = value; }
        public List<Long> getGroupIds() { return groupIds; }
        public void setGroupIds(List<Long> value) { groupIds = value; }
        public List<Source> getSources() { return sources; }
        public void setSources(List<Source> value) { sources = value; }
        public String getMeaning() { return meaning; }
        public void setMeaning(String value) { meaning = value; }
    }

    public static class Result {
        private QuestionDto card;
        private int mergedCount;
        private Group group;
        public Result(QuestionDto value, int count, Group reviewedGroup) { card = value; mergedCount = count; group = reviewedGroup; }
        public QuestionDto getCard() { return card; }
        public int getMergedCount() { return mergedCount; }
        public Group getGroup() { return group; }
    }

    public static class Review {
        private List<Source> sources = new ArrayList<Source>();
        private boolean reviewed;
        public List<Source> getSources() { return sources; }
        public void setSources(List<Source> value) { sources = value; }
        public boolean isReviewed() { return reviewed; }
        public void setReviewed(boolean value) { reviewed = value; }
    }
}
