package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineQuestionDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String question;
    private String pronounce;
    private String meaning;
    private String maskedWord;
    private String level;

    /*
     * sequence giúp server chặn request trả lời cũ/double-submit.
     */
    private long sequence;

    private int index;
    private int total;

    /*
     * COUNTDOWN / MONEY_BEG:
     * FREEZE | BREAK_STREAK | STEAL_SCORE | FIRE_UP |
     * MONEY_BEG | RESET_PASSWORD | null.
     * Chỉ công khai loại skill, không công khai đáp án đúng.
     */
    private String skillType;
    private int scoreMultiplier = 1;

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

    public String getMeaning() {
        return meaning;
    }

    public void setMeaning(String meaning) {
        this.meaning = meaning;
    }

    public String getMaskedWord() {
        return maskedWord;
    }

    public void setMaskedWord(String maskedWord) {
        this.maskedWord = maskedWord;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
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

    public String getSkillType() {
        return skillType;
    }

    public void setSkillType(String skillType) {
        this.skillType = skillType;
    }

    public int getScoreMultiplier() {
        return scoreMultiplier;
    }

    public void setScoreMultiplier(int scoreMultiplier) {
        this.scoreMultiplier = scoreMultiplier < 1 ? 1 : scoreMultiplier;
    }

    public List<BattleOnlineAnswerOptionDto> getAnswers() {
        return answers;
    }

    public void setAnswers(List<BattleOnlineAnswerOptionDto> answers) {
        this.answers = answers;
    }
}
