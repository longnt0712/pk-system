package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

/** A server-authored, stable selection of questions within one assigned task. */
public class ComprehensiveAssignmentSectionDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String key;
    private int number;
    private List<Long> questionIds = new ArrayList<Long>();
    private int firstOrdinal;
    private int lastOrdinal;
    /** NULL keeps the legacy 60-minute limit; zero explicitly means untimed. */
    private Integer durationMinutes;
    public String getKey() { return key; }
    public void setKey(String value) { key = value; }
    public int getNumber() { return number; }
    public void setNumber(int value) { number = value; }
    public List<Long> getQuestionIds() { return questionIds; }
    public void setQuestionIds(List<Long> value) { questionIds = value == null ? new ArrayList<Long>() : new ArrayList<Long>(value); }
    @JsonProperty(access=JsonProperty.Access.READ_ONLY)
    public int getQuestionCount() { return questionIds == null ? 0 : questionIds.size(); }
    public int getFirstOrdinal() { return firstOrdinal; }
    public void setFirstOrdinal(int value) { firstOrdinal = value; }
    public int getLastOrdinal() { return lastOrdinal; }
    public void setLastOrdinal(int value) { lastOrdinal = value; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer value) { durationMinutes = value; }
}
