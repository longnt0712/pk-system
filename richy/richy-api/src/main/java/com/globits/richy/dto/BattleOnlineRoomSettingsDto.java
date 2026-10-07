package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineRoomSettingsDto implements Serializable {
    private static final long serialVersionUID = 1L;

    /* Topic được HOST chọn khi tạo phòng hoặc thay đổi trong LOBBY. */
    private String questionSource;
    private List<Long> exerciseTestIds = new ArrayList<Long>();
    private boolean shuffleExerciseQuestions;

    private List<Long> topicIds = new ArrayList<Long>();
    private List<String> topicNames = new ArrayList<String>();

    /* Chỉ chấp nhận chính HOST hoặc bộ từ dùng chung ID 26. */
    private Long questionOwnerUserId;

    /*
     * CLASSIC | COUNTDOWN | MONEY_BEG | ESCAPE_DUMB_DEMON | DEMON_DEFENSE | GUESS_WORD | LUM_NGAY
     */
    private String mode = "CLASSIC";

    private boolean skillsEnabled = true;
    private int giftSpawnSeconds = 3;
    private int giftBasePoints = 10;
    public int getGiftSpawnSeconds() { return giftSpawnSeconds; }
    public void setGiftSpawnSeconds(int giftSpawnSeconds) { this.giftSpawnSeconds = giftSpawnSeconds; }
    public int getGiftBasePoints() { return giftBasePoints; }
    public void setGiftBasePoints(int giftBasePoints) { this.giftBasePoints = giftBasePoints; }
    /* Empty (including requests from older clients) allows every mode's skills. */
    private List<String> disabledSkillTypes = new ArrayList<String>();

    /*
     * CLASSIC:
     * mặc định frontend sẽ đặt bằng tổng số từ của bài khi preload biết total.
     */
    private int questionCount = 20;
    private int secondsPerQuestion = 10;

    /* Mọi mode: các mức CEFR được phép xuất hiện. */
    private List<String> guessLevels = new ArrayList<String>();

    /* GUESS_WORD: AUTO | HOST_CONTROL. */
    private String guessAdvanceMode = "AUTO";

    /*
     * COUNTDOWN:
     * tổng thời gian toàn trận.
     */
    private int countdownMinutes = 5;

    /*
     * COUNTDOWN/MONEY_BEG/ESCAPE_DUMB_DEMON: số giây khóa đáp án sau một câu sai.
     */
    private int wrongAnswerFreezeSeconds = 3;

    /*
     * 0 = chơi cá nhân; 2-10 = số đội do HOST thiết lập.
     */
    private int teamCount = 0;

    /*
     * Mọi mode có chia đội: HOST có thể chọn một NGƯỜI GÁNH ĐỘI.
     * Toàn bộ tác động điểm/mode của người này được nhân 2.
     */
    private String doubleActionUsername;

    public BattleOnlineRoomSettingsDto() {
    }

    public String getQuestionSource() { return questionSource; }
    public void setQuestionSource(String questionSource) { this.questionSource = questionSource; }
    public List<Long> getExerciseTestIds() { return exerciseTestIds; }
    public void setExerciseTestIds(List<Long> exerciseTestIds) { this.exerciseTestIds = exerciseTestIds; }
    public boolean isShuffleExerciseQuestions() { return shuffleExerciseQuestions; }
    public void setShuffleExerciseQuestions(boolean shuffleExerciseQuestions) { this.shuffleExerciseQuestions = shuffleExerciseQuestions; }

    public List<Long> getTopicIds() {
        return topicIds;
    }

    public void setTopicIds(List<Long> topicIds) {
        this.topicIds = topicIds;
    }

    public List<String> getTopicNames() {
        return topicNames;
    }

    public void setTopicNames(List<String> topicNames) {
        this.topicNames = topicNames;
    }

    public Long getQuestionOwnerUserId() {
        return questionOwnerUserId;
    }

    public void setQuestionOwnerUserId(Long questionOwnerUserId) {
        this.questionOwnerUserId = questionOwnerUserId;
    }

    public boolean isSkillsEnabled() { return skillsEnabled; }
    public void setSkillsEnabled(boolean skillsEnabled) { this.skillsEnabled = skillsEnabled; }
    public List<String> getDisabledSkillTypes() { return disabledSkillTypes; }
    public void setDisabledSkillTypes(List<String> disabledSkillTypes) { this.disabledSkillTypes = disabledSkillTypes; }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public void setQuestionCount(int questionCount) {
        this.questionCount = questionCount;
    }

    public int getSecondsPerQuestion() {
        return secondsPerQuestion;
    }

    public void setSecondsPerQuestion(int secondsPerQuestion) {
        this.secondsPerQuestion = secondsPerQuestion;
    }

    public List<String> getGuessLevels() {
        return guessLevels;
    }

    public void setGuessLevels(List<String> guessLevels) {
        this.guessLevels = guessLevels;
    }

    public String getGuessAdvanceMode() {
        return guessAdvanceMode;
    }

    public void setGuessAdvanceMode(String guessAdvanceMode) {
        this.guessAdvanceMode = guessAdvanceMode;
    }

    public int getCountdownMinutes() {
        return countdownMinutes;
    }

    public void setCountdownMinutes(int countdownMinutes) {
        this.countdownMinutes = countdownMinutes;
    }

    public int getWrongAnswerFreezeSeconds() {
        return wrongAnswerFreezeSeconds;
    }

    public void setWrongAnswerFreezeSeconds(int wrongAnswerFreezeSeconds) {
        this.wrongAnswerFreezeSeconds = wrongAnswerFreezeSeconds;
    }

    public int getTeamCount() {
        return teamCount;
    }

    public void setTeamCount(int teamCount) {
        this.teamCount = teamCount;
    }

    public String getDoubleActionUsername() {
        return doubleActionUsername;
    }

    public void setDoubleActionUsername(String doubleActionUsername) {
        this.doubleActionUsername = doubleActionUsername;
    }
}
