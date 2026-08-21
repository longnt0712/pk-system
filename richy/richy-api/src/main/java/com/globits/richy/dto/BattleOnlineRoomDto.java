package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlineRoomDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String code;
    private String status;
    private String hostUsername;

    private List<BattleOnlinePlayerDto> players =
            new ArrayList<BattleOnlinePlayerDto>();

    private BattleOnlineRoomSettingsDto settings =
            new BattleOnlineRoomSettingsDto();

    /*
     * CLASSIC: câu chung của cả phòng.
     * COUNTDOWN: getRoom() sẽ trả câu riêng cho account hiện tại.
     * Broadcast COUNTDOWN không gửi currentQuestion.
     */
    private BattleOnlineQuestionDto currentQuestion;

    private int currentQuestionIndex;
    private int totalQuestions;

    /*
     * CLASSIC.
     */
    private long questionEndsAt;

    /*
     * COUNTDOWN.
     */
    private long matchEndsAt;

    private long serverTime;

    /*
     * Server-side lazy preload của bài đã chọn.
     */
    private boolean loadingQuestions;
    private boolean allQuestionsLoaded;
    private boolean questionsReady;
    private boolean preloadError;

    private int loadedQuestionCount;
    private int totalLessonWords;

    public BattleOnlineRoomDto() {
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getHostUsername() {
        return hostUsername;
    }

    public void setHostUsername(String hostUsername) {
        this.hostUsername = hostUsername;
    }

    public List<BattleOnlinePlayerDto> getPlayers() {
        return players;
    }

    public void setPlayers(List<BattleOnlinePlayerDto> players) {
        this.players = players;
    }

    public BattleOnlineRoomSettingsDto getSettings() {
        return settings;
    }

    public void setSettings(BattleOnlineRoomSettingsDto settings) {
        this.settings = settings;
    }

    public BattleOnlineQuestionDto getCurrentQuestion() {
        return currentQuestion;
    }

    public void setCurrentQuestion(BattleOnlineQuestionDto currentQuestion) {
        this.currentQuestion = currentQuestion;
    }

    public int getCurrentQuestionIndex() {
        return currentQuestionIndex;
    }

    public void setCurrentQuestionIndex(int currentQuestionIndex) {
        this.currentQuestionIndex = currentQuestionIndex;
    }

    public int getTotalQuestions() {
        return totalQuestions;
    }

    public void setTotalQuestions(int totalQuestions) {
        this.totalQuestions = totalQuestions;
    }

    public long getQuestionEndsAt() {
        return questionEndsAt;
    }

    public void setQuestionEndsAt(long questionEndsAt) {
        this.questionEndsAt = questionEndsAt;
    }

    public long getMatchEndsAt() {
        return matchEndsAt;
    }

    public void setMatchEndsAt(long matchEndsAt) {
        this.matchEndsAt = matchEndsAt;
    }

    public long getServerTime() {
        return serverTime;
    }

    public void setServerTime(long serverTime) {
        this.serverTime = serverTime;
    }

    public boolean isLoadingQuestions() {
        return loadingQuestions;
    }

    public void setLoadingQuestions(boolean loadingQuestions) {
        this.loadingQuestions = loadingQuestions;
    }

    public boolean isAllQuestionsLoaded() {
        return allQuestionsLoaded;
    }

    public void setAllQuestionsLoaded(boolean allQuestionsLoaded) {
        this.allQuestionsLoaded = allQuestionsLoaded;
    }

    public boolean isQuestionsReady() {
        return questionsReady;
    }

    public void setQuestionsReady(boolean questionsReady) {
        this.questionsReady = questionsReady;
    }

    public boolean isPreloadError() {
        return preloadError;
    }

    public void setPreloadError(boolean preloadError) {
        this.preloadError = preloadError;
    }

    public int getLoadedQuestionCount() {
        return loadedQuestionCount;
    }

    public void setLoadedQuestionCount(int loadedQuestionCount) {
        this.loadedQuestionCount = loadedQuestionCount;
    }

    public int getTotalLessonWords() {
        return totalLessonWords;
    }

    public void setTotalLessonWords(int totalLessonWords) {
        this.totalLessonWords = totalLessonWords;
    }
}
