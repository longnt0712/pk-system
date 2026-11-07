package com.globits.richy.dto;

import com.globits.richy.domain.Question;
import java.util.ArrayList;
import java.util.List;

/** Contracts for the current user's duplicate words and an explicitly reviewed merge. */
public final class VocabularyDuplicateDto {
    private VocabularyDuplicateDto() { }

    public static class Group {
        private String word;
        private List<Long> ids = new ArrayList<Long>();
        public String getWord() { return word; }
        public void setWord(String value) { word = value; }
        public List<Long> getIds() { return ids; }
        public void setIds(List<Long> value) { ids = value; }
        public int getCount() { return ids == null ? 0 : ids.size(); }
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
        private List<Source> sources = new ArrayList<Source>();
        private String meaning;
        public Long getPrimaryId() { return primaryId; }
        public void setPrimaryId(Long value) { primaryId = value; }
        public List<Source> getSources() { return sources; }
        public void setSources(List<Source> value) { sources = value; }
        public String getMeaning() { return meaning; }
        public void setMeaning(String value) { meaning = value; }
    }

    public static class Result {
        private QuestionDto card;
        private int mergedCount;
        public Result(QuestionDto value, int count) { card = value; mergedCount = count; }
        public QuestionDto getCard() { return card; }
        public int getMergedCount() { return mergedCount; }
    }
}
