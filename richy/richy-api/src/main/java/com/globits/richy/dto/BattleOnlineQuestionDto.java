package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineQuestionDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String question;
    private String pronounce;

    /*
     * sequence giúp server chặn request trả lời cũ/double-submit.
     */
    private long sequence;

    private int index;
    private int total;

    /*
     * Không có thông tin đáp án đúng trong DTO public.
     */
    private List<BattleOnlineAnswerOptionDto> answers =
            new ArrayList<BattleOnlineAnswerOptionDto>();

    public BattleOnlineQuestionDto() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getPronounce() {
        return pronounce;
    }

    public void setPronounce(String pronounce) {
        this.pronounce = pronounce;
    }

    public long getSequence() {
        return sequence;
    }

    public void setSequence(long sequence) {
        this.sequence = sequence;
    }

    public int getIndex() {
        return index;
    }

    public void setIndex(int index) {
        this.index = index;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public List<BattleOnlineAnswerOptionDto> getAnswers() {
        return answers;
    }

    public void setAnswers(List<BattleOnlineAnswerOptionDto> answers) {
        this.answers = answers;
    }
}
