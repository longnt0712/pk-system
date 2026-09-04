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
     * ESCAPE_DUMB_DEMON: vị trí âm gần ĐỘI 1, vị trí dương gần ĐỘI 2.
     * Khoảng cách tối đa mỗi phía bằng ceil(20% tổng số câu của bài).
     */
    private int dumbBallPosition;
    private int dumbBallMaxDistance;

    /*
     * Server-side lazy preload của bài đã chọn.
     */
    private boolean loadingQuestions;
    private boolean allQuestionsLoaded;
    private boolean questionsReady;
    private boolean preloadError;

    private int loadedQuestionCount;
    private int totalLessonWords;

    /*
     * COUNTDOWN: chỉ REST snapshot riêng của account mới có pendingSkillType.
     * WebSocket generic luôn để null để không lộ state cá nhân.
     */
    private String pendingSkillType;

    /*
     * COUNTDOWN: tối đa 4 username được backend random làm mục tiêu
     * cho skill đang chờ. Đây cũng là state riêng của account.
     */
    private List<String> pendingSkillTargetUsernames =
            new ArrayList<String>();

    /*
     * XIN_TIEN: toàn bộ trường dưới đây là state riêng của viewer.
     * WebSocket generic không bao giờ chứa mật khẩu hay phương án đoán.
     */
    private boolean passwordSelectionRequired;
    private String currentPassword;

    private List<BattleOnlinePasswordOptionDto> passwordOptions =
            new ArrayList<BattleOnlinePasswordOptionDto>();

    private String pendingPasswordGuessTargetUsername;
    private String pendingPasswordGuessTargetDisplayName;

    private List<BattleOnlinePasswordOptionDto> passwordGuessOptions =
            new ArrayList<BattleOnlinePasswordOptionDto>();

    /*
     * COUNTDOWN/MONEY_BEG: private state của viewer sau khi trả lời sai.
     * Generic WebSocket luôn để trống để không công khai đáp án đúng.
     */
    private long wrongAnswerPenaltyUntil;
    private String wrongAnswerQuestion;
    private String wrongAnswerCorrectAnswer;
    private String wrongAnswerSelectedAnswer;

    /*
     * Nhật ký skill chung, mới nhất đứng trước.
     */
    private List<BattleOnlineEventDto> recentEvents =
            new ArrayList<BattleOnlineEventDto>();

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

    public int getDumbBallPosition() {
        return dumbBallPosition;
    }

    public void setDumbBallPosition(int dumbBallPosition) {
        this.dumbBallPosition = dumbBallPosition;
    }

    public int getDumbBallMaxDistance() {
        return dumbBallMaxDistance;
    }

    public void setDumbBallMaxDistance(int dumbBallMaxDistance) {
        this.dumbBallMaxDistance = dumbBallMaxDistance;
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

    public String getPendingSkillType() {
        return pendingSkillType;
    }

    public void setPendingSkillType(String pendingSkillType) {
        this.pendingSkillType = pendingSkillType;
    }

    public List<String> getPendingSkillTargetUsernames() {
        return pendingSkillTargetUsernames;
    }

    public void setPendingSkillTargetUsernames(
            List<String> pendingSkillTargetUsernames) {
        this.pendingSkillTargetUsernames = pendingSkillTargetUsernames;
    }

    public boolean isPasswordSelectionRequired() {
        return passwordSelectionRequired;
    }

    public void setPasswordSelectionRequired(boolean passwordSelectionRequired) {
        this.passwordSelectionRequired = passwordSelectionRequired;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public List<BattleOnlinePasswordOptionDto> getPasswordOptions() {
        return passwordOptions;
    }

    public void setPasswordOptions(
            List<BattleOnlinePasswordOptionDto> passwordOptions) {
        this.passwordOptions = passwordOptions;
    }

    public String getPendingPasswordGuessTargetUsername() {
        return pendingPasswordGuessTargetUsername;
    }

    public void setPendingPasswordGuessTargetUsername(
            String pendingPasswordGuessTargetUsername) {
        this.pendingPasswordGuessTargetUsername =
                pendingPasswordGuessTargetUsername;
    }

    public String getPendingPasswordGuessTargetDisplayName() {
        return pendingPasswordGuessTargetDisplayName;
    }

    public void setPendingPasswordGuessTargetDisplayName(
            String pendingPasswordGuessTargetDisplayName) {
        this.pendingPasswordGuessTargetDisplayName =
                pendingPasswordGuessTargetDisplayName;
    }

    public List<BattleOnlinePasswordOptionDto> getPasswordGuessOptions() {
        return passwordGuessOptions;
    }

    public void setPasswordGuessOptions(
            List<BattleOnlinePasswordOptionDto> passwordGuessOptions) {
        this.passwordGuessOptions = passwordGuessOptions;
    }

    public long getWrongAnswerPenaltyUntil() {
        return wrongAnswerPenaltyUntil;
    }

    public void setWrongAnswerPenaltyUntil(long wrongAnswerPenaltyUntil) {
        this.wrongAnswerPenaltyUntil = wrongAnswerPenaltyUntil;
    }

    public String getWrongAnswerQuestion() {
        return wrongAnswerQuestion;
    }

    public void setWrongAnswerQuestion(String wrongAnswerQuestion) {
        this.wrongAnswerQuestion = wrongAnswerQuestion;
    }

    public String getWrongAnswerCorrectAnswer() {
        return wrongAnswerCorrectAnswer;
    }

    public void setWrongAnswerCorrectAnswer(String wrongAnswerCorrectAnswer) {
        this.wrongAnswerCorrectAnswer = wrongAnswerCorrectAnswer;
    }

    public String getWrongAnswerSelectedAnswer() {
        return wrongAnswerSelectedAnswer;
    }

    public void setWrongAnswerSelectedAnswer(String wrongAnswerSelectedAnswer) {
        this.wrongAnswerSelectedAnswer = wrongAnswerSelectedAnswer;
    }

    public List<BattleOnlineEventDto> getRecentEvents() {
        return recentEvents;
    }

    public void setRecentEvents(List<BattleOnlineEventDto> recentEvents) {
        this.recentEvents = recentEvents;
    }
}
