package com.globits.richy.service.impl;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import javax.annotation.PreDestroy;
import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.globits.richy.dto.BattleOnlineAnswerDto;
import com.globits.richy.dto.BattleOnlineAnswerOptionDto;
import com.globits.richy.dto.BattleOnlineAnswerResultDto;
import com.globits.richy.dto.BattleOnlineCreateRoomDto;
import com.globits.richy.dto.BattleOnlineEventDto;
import com.globits.richy.dto.BattleOnlinePasswordChoiceDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessResultDto;
import com.globits.richy.dto.BattleOnlinePasswordOptionDto;
import com.globits.richy.dto.BattleOnlinePlayerDto;
import com.globits.richy.dto.BattleOnlineQuestionDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.dto.BattleOnlineTeamAssignmentDto;
import com.globits.richy.dto.BattleOnlineUseSkillDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.dto.QuestionForGamesDto;
import com.globits.richy.dto.QuestionTopicDto;
import com.globits.richy.dto.QuestionTypeDto;
import com.globits.richy.dto.TopicDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.BattleOnlineService;
import com.globits.richy.service.QuestionService;

@Service
public class BattleOnlineServiceImpl implements BattleOnlineService {

    private static final String LOBBY = "LOBBY";
    private static final String PLAYING = "PLAYING";
    private static final String FINISHED = "FINISHED";

    private static final String MODE_CLASSIC = "CLASSIC";
    private static final String MODE_COUNTDOWN = "COUNTDOWN";
    private static final String MODE_MONEY_BEG = "MONEY_BEG";
    private static final String MODE_ESCAPE_DUMB_DEMON = "ESCAPE_DUMB_DEMON";

    private static final String SKILL_FREEZE = "FREEZE";
    private static final String SKILL_BREAK_STREAK = "BREAK_STREAK";
    private static final String SKILL_STEAL_SCORE = "STEAL_SCORE";
    private static final String SKILL_FIRE_UP = "FIRE_UP";
    private static final String SKILL_MONEY_BEG = "MONEY_BEG";
    private static final String SKILL_RESET_PASSWORD = "RESET_PASSWORD";

    private static final long FREEZE_DURATION_MS = 3000L;
    private static final long FIRE_UP_DURATION_MS = 15000L;
    private static final double FIRE_UP_SCORE_MULTIPLIER = 1.2D;
    private static final double MONEY_BEG_STEAL_RATE = 0.40D;
    private static final double COUNTDOWN_SKILL_RATE_FACTOR = 0.75D;
    private static final int SKILL_TARGET_CANDIDATE_COUNT = 4;
    private static final int SKILL_TARGET_RANDOM_SLOT_COUNT = 2;
    private static final double SKILL_TOP_RANK_WEIGHT = 1.4D;
    private static final int MAX_RECENT_EVENTS = 12;

    private static final String[] PASSWORD_OPTION_KEYS =
            new String[] {"A", "B", "C"};

    /*
     * Mỗi lượt chọn có đủ một mã dễ, một mã trung bình và một mã khó.
     * Các biến thể đều được điều chế từ cụm dễ nhớ, dài tối đa 20 code point.
     */
    private static final String[] PASSWORD_PHRASES = new String[] {
        "mấy con gà", "chăm học đi", "đừng cướp tôi", "chán đê",
        "tâm bất biến", "tích đức", "chó", "mèo", "lợn", "gà",
        "me handsome", "I love football", "đi ngủ đi", "đừng hack tôi",
        "xin nhẹ thôi", "còn cái nịt", "ví tôi rỗng", "tha cho tôi",
        "học bài chưa", "ăn cơm chưa", "bình tĩnh", "không có tiền",
        "cho xin lại", "đừng tham", "làm người tốt", "tôi vô tội",
        "cướp ít thôi", "điểm của tôi", "keep calm", "no money",
        "good luck", "try again", "để tôi yên", "đừng nhìn nữa",
        "học đi bạn", "xin đừng cướp", "ví đang buồn", "nhẹ tay thôi"
    };

    private static final String[] PASSWORD_ICONS = new String[] {
        "🔥", "💰", "🐸", "🌙", "⭐", "🍀", "🎲", "🚀", "👑", "💎"
    };

    private static final String PASSWORD_PUNCTUATION = "!@#$%&?+-_";
    private static final String PASSWORD_WORD_SEPARATORS = "-_.";

    private static final String PASSWORD_VIETNAMESE_LETTERS =
            "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩị" +
            "óòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ";

    /*
     * COUNTDOWN ôn lại câu sai theo spaced repetition ngắn:
     * sau 5-7 câu khác mới đưa câu sai quay lại.
     */
    private static final int COUNTDOWN_REVIEW_MIN_GAP = 5;
    private static final int COUNTDOWN_REVIEW_MAX_GAP = 7;

    private static final int MAX_PLAYERS = 20;

    /* Tài khoản bộ từ dùng chung "EM YÊU INH LÍCH" giống DAILY VOCAB. */
    private static final Long SHARED_VOCAB_USER_ID = 26L;

    /*
     * Lazy preload server-side.
     * 1000 từ = khoảng 20 batch x 50.
     */
    private static final int PRELOAD_BATCH_SIZE = 50;
    private static final long PRELOAD_BATCH_DELAY_MS = 150L;
    private static final int PRELOAD_MAX_RETRY = 3;

    private static final int MIN_CLASSIC_QUESTIONS = 1;
    private static final int MAX_CLASSIC_QUESTIONS = 5000;

    private static final int MIN_SECONDS_PER_QUESTION = 3;
    private static final int MAX_SECONDS_PER_QUESTION = 120;

    private static final int MIN_COUNTDOWN_MINUTES = 1;
    private static final int MAX_COUNTDOWN_MINUTES = 180;

    private static final int DEFAULT_WRONG_ANSWER_FREEZE_SECONDS = 3;
    private static final int MIN_WRONG_ANSWER_FREEZE_SECONDS = 1;
    private static final int MAX_WRONG_ANSWER_FREEZE_SECONDS = 60;

    private static final int MAX_TEAM_COUNT = 10;

    private static final char[] ROOM_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private final Map<String, RoomState> rooms =
            new ConcurrentHashMap<String, RoomState>();

    private final Map<String, ScheduledFuture<?>> classicTimers =
            new ConcurrentHashMap<String, ScheduledFuture<?>>();

    private final Map<String, ScheduledFuture<?>> matchTimers =
            new ConcurrentHashMap<String, ScheduledFuture<?>>();

    private final Map<String, ScheduledFuture<?>> preloadTimers =
            new ConcurrentHashMap<String, ScheduledFuture<?>>();

    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);

    private final Random random = new SecureRandom();

    @Autowired
    private QuestionService questionService;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;


    /* =========================================================
       ROOM
       ========================================================= */

    @Override
    public BattleOnlineRoomDto createRoom(
            String username,
            BattleOnlineCreateRoomDto createDto) {

        username = requireUsername(username);

        if (
            createDto == null ||
            createDto.getTopicIds() == null ||
            createDto.getTopicIds().isEmpty()
        ) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Hãy chọn bài từ vựng trước khi tạo phòng."
            );
        }

        List<Long> topicIds =
                cleanTopicIds(createDto.getTopicIds());

        if (topicIds.isEmpty()) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Bài từ vựng không hợp lệ."
            );
        }

        PlayerIdentity identity =
                findPlayerIdentity(username);

        Long questionOwnerUserId =
                resolveQuestionOwnerUserId(
                        identity.userId,
                        createDto.getQuestionOwnerUserId()
                );

        detachFromOldRooms(username);

        RoomState room = new RoomState();

        room.code = newRoomCode();
        room.status = LOBBY;
        room.hostUsername = username;
        room.ownerUserId = questionOwnerUserId;

        room.settings.topicIds = topicIds;
        room.settings.topicNames =
                cleanTopicNames(createDto.getTopicNames());

        room.settings.mode = MODE_CLASSIC;
        room.settings.questionCount = 20;
        room.settings.secondsPerQuestion = 10;
        room.settings.countdownMinutes = 5;
        room.settings.wrongAnswerFreezeSeconds =
                DEFAULT_WRONG_ANSWER_FREEZE_SECONDS;
        room.settings.teamCount = 0;
        room.settings.doubleActionUsername = null;

        PlayerState host = new PlayerState();
        host.username = username;
        host.displayName = identity.displayName;
        host.host = true;
        host.ready = true;
        host.connected = true;

        room.players.put(username, host);
        rooms.put(room.code, room);

        /*
         * Tạo room trước, sau đó server tự load bài theo batch 50
         * trong lúc người chơi đang JOIN/READY.
         */
        schedulePreload(room.code, 0L);

        BattleOnlineRoomDto dto =
                snapshot(room, username);

        broadcastGeneric(room);

        return dto;
    }


    /**
     * HOST chỉ được tạo phòng bằng bộ từ của chính mình hoặc bộ từ dùng
     * chung của tài khoản EM YÊU INH LÍCH (ID 26). Nếu frontend cũ chưa gửi
     * questionOwnerUserId thì giữ nguyên hành vi cũ: dùng từ của HOST.
     */
    private Long resolveQuestionOwnerUserId(
            Long hostUserId,
            Long requestedOwnerUserId) {

        Long ownerUserId = requestedOwnerUserId != null
                ? requestedOwnerUserId
                : hostUserId;

        if (ownerUserId == null) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Không xác định được chủ sở hữu bộ từ."
            );
        }

        if (
            !ownerUserId.equals(hostUserId) &&
            !SHARED_VOCAB_USER_ID.equals(ownerUserId)
        ) {
            throw new BattleOnlineException(
                    HttpStatus.FORBIDDEN,
                    "Bạn chỉ có thể chọn từ của mình hoặc bộ từ EM YÊU INH LÍCH."
            );
        }

        return ownerUserId;
    }


    @Override
    public BattleOnlineRoomDto joinRoom(
            String roomCode,
            String username) {

        username = requireUsername(username);

        PlayerIdentity identity =
                findPlayerIdentity(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            if (room.kickedUsernames.contains(username)) {
                throw new BattleOnlineException(
                        HttpStatus.FORBIDDEN,
                        "HOST đã kích bạn khỏi phòng này."
                );
            }

            PlayerState existing =
                    room.players.get(username);

            if (existing != null) {
                existing.connected = true;
                existing.displayName = identity.displayName;

                if (
                    !existing.spectator &&
                    room.settings.teamCount >= 2 &&
                    (
                        existing.teamNumber < 1 ||
                        existing.teamNumber > room.settings.teamCount
                    )
                ) {
                    existing.teamNumber = nextBalancedTeamLocked(room);
                }

                if (
                    PLAYING.equals(room.status) &&
                    !existing.spectator
                ) {
                    existing.ready = true;
                }

                /*
                 * COUNTDOWN reconnect:
                 * nếu chưa có câu cá nhân thì cấp lại.
                 */
                if (
                    PLAYING.equals(room.status) &&
                    isCountdownLikeMode(room.settings.mode) &&
                    !existing.spectator &&
                    existing.currentQuestion == null
                ) {
                    if (
                        MODE_MONEY_BEG.equals(room.settings.mode) &&
                        isBlank(existing.currentPassword) &&
                        existing.passwordOptions.isEmpty()
                    ) {
                        preparePasswordSelectionLocked(existing);
                    }

                    assignNextCountdownQuestionLocked(
                            room,
                            existing
                    );
                }

                if (LOBBY.equals(room.status)) {
                    normalizeEscapeDoubleActionPlayerLocked(room);
                }

                dto = snapshotLocked(room, username);
            } else {
                if (room.players.size() >= MAX_PLAYERS) {
                    throw new BattleOnlineException(
                            HttpStatus.CONFLICT,
                            "Phòng đã đủ " + MAX_PLAYERS + " người."
                    );
                }

                detachFromOldRooms(username);

                PlayerState player = new PlayerState();
                player.username = username;
                player.displayName = identity.displayName;
                player.connected = true;
                player.ready = PLAYING.equals(room.status);

                room.players.put(username, player);

                if (room.settings.teamCount >= 2) {
                    player.teamNumber = nextBalancedTeamLocked(room);
                }

                /*
                 * Late join:
                 * - Không reset room, đồng hồ hay điểm của người đang chơi.
                 * - Người mới bắt đầu với score/streak/progress bằng 0.
                 * - COUNTDOWN nhận ngay một câu cá nhân trong phần thời gian
                 *   còn lại; CLASSIC tham gia ngay câu chung đang hiển thị.
                 */
                if (
                    PLAYING.equals(room.status) &&
                    isCountdownLikeMode(room.settings.mode)
                ) {
                    if (MODE_MONEY_BEG.equals(room.settings.mode)) {
                        preparePasswordSelectionLocked(player);
                    }

                    assignNextCountdownQuestionLocked(
                            room,
                            player
                    );
                }

                if (LOBBY.equals(room.status)) {
                    normalizeEscapeDoubleActionPlayerLocked(room);
                }

                dto = snapshotLocked(room, username);
            }
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto leaveRoom(
            String roomCode,
            String username) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);

        BattleOnlineRoomDto dto = null;
        boolean removeRoom = false;

        synchronized (room) {
            PlayerState player =
                    room.players.get(username);

            if (player == null) {
                return snapshotLocked(room, username);
            }

            if (PLAYING.equals(room.status)) {
                /*
                 * Giữ score/progress để reconnect.
                 */
                player.connected = false;
            } else {
                room.players.remove(username);

                if (username.equals(room.hostUsername)) {
                    promoteHostLocked(room);
                }
            }

            if (room.players.isEmpty()) {
                removeRoom = true;
            } else {
                if (LOBBY.equals(room.status)) {
                    normalizeEscapeDoubleActionPlayerLocked(room);
                }

                dto = snapshotLocked(room, username);
            }
        }

        if (removeRoom) {
            destroyRoom(room.code);
            return null;
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto getRoom(
            String roomCode,
            String username) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);

        synchronized (room) {
            PlayerState player =
                    requirePlayer(room, username);

            /*
             * Tự phục hồi câu riêng của COUNTDOWN khi một lần cấp
             * câu trước đó không tìm được ứng viên. Frontend đang
             * polling getRoom nên người chơi sẽ không bị đứng mãi
             * ở màn hình "Đang lấy câu của bạn...".
             */
            if (
                PLAYING.equals(room.status) &&
                isCountdownLikeMode(room.settings.mode) &&
                !player.spectator &&
                player.currentQuestion == null &&
                player.pendingSkillType == null
            ) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }

            /*
             * Không còn nút bỏ qua skill trên giao diện. Nếu tất cả
             * đối thủ đã rời phòng thì tự nhả skill để người chơi không
             * bị kẹt ở modal không có mục tiêu.
             */
            releasePendingSkillWhenNoTargetLocked(
                    room,
                    player
            );

            return snapshotLocked(
                    room,
                    username
            );
        }
    }


    /* =========================================================
       LOBBY
       ========================================================= */

    @Override
    public BattleOnlineRoomDto setReady(
            String roomCode,
            String username,
            boolean ready) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireLobby(room);

            PlayerState player =
                    requirePlayer(room, username);

            if (player.spectator) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Khán giả không cần READY. Hãy tắt chế độ khán giả trước."
                );
            }

            if (player.host) {
                player.ready = true;
            } else {
                player.ready = ready;
            }

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto setSpectator(
            String roomCode,
            String username,
            boolean spectator) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireLobby(room);
            requireHost(room, username);

            PlayerState host = requirePlayer(room, username);

            host.spectator = spectator;
            host.ready = !spectator;

            resetPlayerMatchState(host);

            host.teamNumber = spectator || room.settings.teamCount < 2
                    ? 0
                    : nextBalancedTeamLocked(room);

            normalizeEscapeDoubleActionPlayerLocked(room);

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto assignPlayerTeam(
            String roomCode,
            String username,
            BattleOnlineTeamAssignmentDto teamDto) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireLobby(room);
            requireHost(room, username);

            if (room.settings.teamCount < 2) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hãy bật chế độ chia đội và lưu thiết lập trước."
                );
            }

            String targetUsername = requireUsername(
                    teamDto != null
                            ? teamDto.getTargetUsername()
                            : null
            );

            int teamNumber = teamDto != null
                    ? teamDto.getTeamNumber()
                    : 0;

            if (
                teamNumber < 1 ||
                teamNumber > room.settings.teamCount
            ) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Đội được chọn không hợp lệ."
                );
            }

            PlayerState target = requirePlayer(room, targetUsername);

            if (target.spectator) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Khán giả không tham gia đội."
                );
            }

            target.teamNumber = teamNumber;
            normalizeEscapeDoubleActionPlayerLocked(room);
            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto kickPlayer(
            String roomCode,
            String username,
            String targetUsername) {

        username = requireUsername(username);
        targetUsername = requireUsername(targetUsername);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireHost(room, username);

            if (
                !LOBBY.equals(room.status) &&
                !PLAYING.equals(room.status)
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Chỉ có thể kích người chơi trong lobby hoặc khi trận đang diễn ra."
                );
            }

            if (username.equals(targetUsername)) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "HOST không thể tự kích chính mình."
                );
            }

            PlayerState target = room.players.get(targetUsername);

            if (target == null) {
                throw new BattleOnlineException(
                        HttpStatus.NOT_FOUND,
                        "Người chơi không còn ở trong phòng."
                );
            }

            room.players.remove(targetUsername);
            room.kickedUsernames.add(targetUsername);

            /*
             * Xóa mục tiêu vừa bị kích khỏi mọi danh sách skill đang chờ.
             * Nếu không còn đối thủ, lần GET tiếp theo sẽ tự nhả skill.
             */
            for (PlayerState player : room.players.values()) {
                player.pendingSkillTargetUsernames.remove(targetUsername);
                releasePendingSkillWhenNoTargetLocked(room, player);
            }

            if (LOBBY.equals(room.status)) {
                normalizeEscapeDoubleActionPlayerLocked(room);
            }

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto updateSettings(
            String roomCode,
            String username,
            BattleOnlineRoomSettingsDto settings) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireLobby(room);
            requireHost(room, username);

            if (settings == null) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Thiếu cài đặt phòng."
                );
            }

            /*
             * Topic đã khóa từ lúc CREATE.
             * Trong lobby chỉ đổi mode và các tham số của mode.
             */
            room.settings.mode =
                    normalizeMode(settings.getMode());

            room.settings.questionCount =
                    clamp(
                        settings.getQuestionCount(),
                        MIN_CLASSIC_QUESTIONS,
                        MAX_CLASSIC_QUESTIONS
                    );

            room.settings.secondsPerQuestion =
                    clamp(
                        settings.getSecondsPerQuestion(),
                        MIN_SECONDS_PER_QUESTION,
                        MAX_SECONDS_PER_QUESTION
                    );

            room.settings.countdownMinutes =
                    clamp(
                        settings.getCountdownMinutes(),
                        MIN_COUNTDOWN_MINUTES,
                        MAX_COUNTDOWN_MINUTES
                    );

            room.settings.wrongAnswerFreezeSeconds =
                    normalizeWrongAnswerFreezeSeconds(
                        settings.getWrongAnswerFreezeSeconds()
                    );

            room.settings.teamCount =
                    MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)
                            ? 2
                            : normalizeTeamCount(
                                settings.getTeamCount()
                            );

            normalizeTeamAssignmentsLocked(room);

            room.settings.doubleActionUsername =
                    clean(settings.getDoubleActionUsername());

            normalizeEscapeDoubleActionPlayerLocked(room);

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    /* =========================================================
       START / RESTART
       ========================================================= */

    @Override
    public BattleOnlineRoomDto startMatch(
            String roomCode,
            String username) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireLobby(room);
            requireHost(room, username);

            normalizeTeamAssignmentsLocked(room);
            normalizeEscapeDoubleActionPlayerLocked(room);
            validatePlayersReadyLocked(room);

            if (room.preparedQuestions.size() < 4) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        room.loadingQuestions
                                ? "Server đang nạp bài. Chờ READY tối thiểu 4 từ rồi START."
                                : "Bài này không đủ 4 câu có 4 đáp án hợp lệ."
                );
            }

            resetScoresLocked(room);
            room.recentEvents.clear();

            if (isCountdownLikeMode(room.settings.mode)) {
                startCountdownLocked(room);
            } else {
                startClassicLocked(room);
            }

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto restartMatch(
            String roomCode,
            String username) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requireHost(room, username);

            if (!FINISHED.equals(room.status)) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Chỉ có thể tạo trận mới sau khi trận hiện tại kết thúc."
                );
            }

            cancelClassicTimer(room.code);
            cancelMatchTimer(room.code);

            room.status = LOBBY;

            room.classicQuestions.clear();
            room.classicQuestionIndex = -1;
            room.kickedUsernames.clear();

            room.questionEndsAt = 0L;
            room.matchEndsAt = 0L;
            room.dumbBallPosition = 0;
            room.dumbBallMaxDistance =
                    calculateDumbBallMaxDistance(room);
            room.settings.doubleActionUsername = null;

            for (PlayerState player : room.players.values()) {
                resetPlayerMatchState(player);
                player.ready = player.host && !player.spectator;
            }

            /*
             * Nếu preload chưa xong vì trận trước kết thúc sớm,
             * tiếp tục nạp trong lobby.
             */
            if (!room.allQuestionsLoaded && !room.loadingQuestions) {
                schedulePreload(room.code, 50L);
            }

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    private void startClassicLocked(RoomState room) {
        int requested =
                clamp(
                    room.settings.questionCount,
                    MIN_CLASSIC_QUESTIONS,
                    MAX_CLASSIC_QUESTIONS
                );

        if (
            requested > room.preparedQuestions.size() &&
            !room.allQuestionsLoaded
        ) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "CLASSIC cần " +
                    requested +
                    " câu nhưng server mới READY " +
                    room.preparedQuestions.size() +
                    "/" +
                    displayTotal(room) +
                    ". Chờ preload thêm một chút."
            );
        }

        int target =
                Math.min(
                    requested,
                    room.preparedQuestions.size()
                );

        List<QuestionState> prepared =
                new ArrayList<QuestionState>(
                    room.preparedQuestions.values()
                );

        Collections.shuffle(
                prepared,
                random
        );

        room.classicQuestions.clear();

        for (QuestionState question : prepared) {
            if (
                room.classicQuestions.size() >=
                target
            ) {
                break;
            }

            room.classicQuestions.add(
                    copyQuestionState(question)
            );
        }

        if (room.classicQuestions.isEmpty()) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Không tạo được câu hỏi CLASSIC từ bài đã chọn."
            );
        }

        room.status = PLAYING;
        room.classicQuestionIndex = 0;
        room.matchEndsAt = 0L;

        startClassicQuestionLocked(room);
    }


    private void startCountdownLocked(RoomState room) {
        room.status = PLAYING;

        room.classicQuestions.clear();
        room.classicQuestionIndex = -1;
        room.questionEndsAt = 0L;

        long matchStartsAt = System.currentTimeMillis();
        long matchDurationMs =
                (
                    room.settings.countdownMinutes *
                    60L *
                    1000L
                );

        room.matchEndsAt = matchStartsAt + matchDurationMs;
        room.passwordResetAvailableAt =
                matchStartsAt + (matchDurationMs / 2L);

        buildCountdownSkillPlanLocked(room);

        for (PlayerState player : room.players.values()) {
            if (player.spectator) {
                resetPlayerMatchState(player);
                continue;
            }

            player.pendingWordIds.clear();
            player.uniqueWordIds.clear();
            player.countdownReviewQuestions.clear();
            player.currentQuestion = null;
            player.currentQuestionSequence = 0L;

            refillCountdownPendingLocked(
                    room,
                    player
            );

            if (MODE_MONEY_BEG.equals(room.settings.mode)) {
                preparePasswordSelectionLocked(player);
            }

            if (player.connected) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }
        }

        scheduleMatchFinish(
                room.code,
                room.matchEndsAt
            );
    }


    /* =========================================================
       ANSWER
       ========================================================= */

    @Override
    public BattleOnlineAnswerResultDto answer(
            String roomCode,
            String username,
            BattleOnlineAnswerDto answerDto) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);

        if (isCountdownLikeMode(room.settings.mode)) {
            return answerCountdown(
                    room,
                    username,
                    answerDto
            );
        }

        return answerClassic(
                room,
                username,
                answerDto
        );
    }


    private BattleOnlineAnswerResultDto answerClassic(
            RoomState room,
            String username,
            BattleOnlineAnswerDto answerDto) {

        BattleOnlineAnswerResultDto result =
                new BattleOnlineAnswerResultDto();

        boolean advanceSoon;
        int expectedIndex;

        synchronized (room) {
            requirePlaying(room);

            PlayerState player =
                    requirePlayer(room, username);

            requireActivePlayer(player);

            QuestionState question =
                    currentClassicQuestionLocked(room);

            if (question == null) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Không có câu hỏi hiện tại."
                );
            }

            if (
                System.currentTimeMillis() >
                room.questionEndsAt
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Câu hỏi đã hết giờ."
                );
            }

            validateAnswerDto(
                    answerDto,
                    question,
                    room.classicQuestionIndex + 1L
            );

            if (
                player.answeredClassicIndex ==
                room.classicQuestionIndex
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn đã trả lời câu này rồi."
                );
            }

            boolean correct =
                    normalizeAnswerKey(
                        answerDto.getAnswerKey()
                    ).equals(
                        question.correctKey
                    );

            player.connected = true;

            if (
                MODE_MONEY_BEG.equals(room.settings.mode) &&
                player.passwordSelectionRequired
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hãy chọn mật khẩu của bạn trước khi trả lời."
                );
            }

            if (player.pendingPasswordGuessTargetUsername != null) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hãy đoán mật khẩu của người đã chọn trước khi trả lời tiếp."
                );
            }
            player.answeredClassicIndex =
                    room.classicQuestionIndex;

            int correctOrder = 0;
            double scoreDelta;

            if (correct) {
                /*
                 * Mọi request CLASSIC đều đi qua synchronized(room),
                 * nên thứ tự này chính là thứ tự backend nhận đáp án
                 * đúng và được đồng bộ cho toàn bộ phòng.
                 */
                room.classicCorrectAnswerCount += 1;
                correctOrder =
                        room.classicCorrectAnswerCount;

                scoreDelta = applyClassicSpeedScore(
                        player,
                        correctOrder
                );
            } else {
                scoreDelta = applyScore(
                        player,
                        false,
                        false,
                        System.currentTimeMillis()
                );
            }

            fillAnswerResult(
                    result,
                    player,
                    correct,
                    scoreDelta,
                    false,
                    false
            );

            if (correct) {
                if (correctOrder == 1) {
                    result.setMessage(
                            "CHÍNH XÁC! NHANH NHẤT: +3 điểm."
                    );
                } else if (correctOrder == 2) {
                    result.setMessage(
                            "CHÍNH XÁC! HẠNG TỐC ĐỘ 2: +2 điểm."
                    );
                } else {
                    result.setMessage(
                            "CHÍNH XÁC! +1 điểm."
                    );
                }
            }

            expectedIndex =
                    room.classicQuestionIndex;

            advanceSoon =
                    allConnectedClassicAnsweredLocked(
                        room
                    );
        }

        broadcastGeneric(room);

        if (advanceSoon) {
            scheduleClassicAdvance(
                    room.code,
                    expectedIndex,
                    250L
            );
        }

        return result;
    }


    private BattleOnlineAnswerResultDto answerCountdown(
            RoomState room,
            String username,
            BattleOnlineAnswerDto answerDto) {

        BattleOnlineAnswerResultDto result =
                new BattleOnlineAnswerResultDto();

        synchronized (room) {
            requirePlaying(room);

            long now = System.currentTimeMillis();

            if (
                now >=
                room.matchEndsAt
            ) {
                finishMatchLocked(room);
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hết thời gian trận."
                );
            }

            PlayerState player =
                    requirePlayer(room, username);

            requireActivePlayer(player);

            player.connected = true;

            clearExpiredWrongAnswerPenaltyLocked(player, now);

            if (now < player.wrongAnswerPenaltyUntil) {
                long seconds = Math.max(
                        1L,
                        (player.wrongAnswerPenaltyUntil - now + 999L) / 1000L
                );

                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn đang xem lại câu vừa sai. Còn " + seconds + " giây."
                );
            }

            if (player.pendingSkillType != null) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hãy chọn người chơi để dùng skill trước khi trả lời câu tiếp theo."
                );
            }

            if (now < player.frozenUntil) {
                long seconds = Math.max(
                        1L,
                        (player.frozenUntil - now + 999L) / 1000L
                );

                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn đang bị đóng băng. Còn " + seconds + " giây."
                );
            }

            if (player.currentQuestion == null) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }

            QuestionState question =
                    player.currentQuestion;

            if (question == null) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Server chưa có câu tiếp theo. Vui lòng thử lại."
                );
            }

            validateAnswerDto(
                    answerDto,
                    question,
                    player.currentQuestionSequence
            );

            boolean correct =
                    normalizeAnswerKey(
                        answerDto.getAnswerKey()
                    ).equals(
                        question.correctKey
                    );

            if (!correct) {
                applyWrongAnswerPenaltyLocked(
                        room,
                        player,
                        question,
                        answerDto.getAnswerKey(),
                        now
                );
            }

            updateCountdownReviewStateLocked(
                    player,
                    question,
                    correct
            );

            String earnedSkill =
                    correct
                            ? player.currentSkillType
                            : null;

            boolean fireBoostApplied =
                    correct &&
                    now < player.burningUntil;

            applyDumbBallAnswerLocked(
                    room,
                    player,
                    correct,
                    fireBoostApplied
            );

            double scoreDelta = applyScore(
                    player,
                    correct,
                    true,
                    now
            );

            scoreDelta = applyEscapeDoubleActionScoreLocked(
                    room,
                    player,
                    scoreDelta
            );

            boolean fireActivated =
                    SKILL_FIRE_UP.equals(earnedSkill);

            if (fireActivated) {
                /*
                 * Trả lời đúng câu FIRE_UP sẽ kích hoạt buff cho
                 * những câu tiếp theo trong đúng 15 giây.
                 * Nếu đang cháy, lần nhận mới sẽ làm mới mốc 15 giây.
                 */
                player.burningUntil =
                        now + FIRE_UP_DURATION_MS;

                addSkillEventLocked(
                        room,
                        SKILL_FIRE_UP,
                        player,
                        player,
                        0D,
                        now
                );
            }

            fillAnswerResult(
                    result,
                    player,
                    correct,
                    scoreDelta,
                    fireBoostApplied,
                    fireActivated
            );

            if (MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)) {
                int otherTeam = player.teamNumber == 1 ? 2 : 1;
                int dumbBallSteps = calculateDumbBallAnswerDistanceLocked(
                        room,
                        player,
                        correct,
                        fireBoostApplied
                );
                String doubleActionLabel =
                        isEscapeDoubleActionPlayerLocked(room, player)
                                ? " NGƯỜI GÁNH ĐỘI x2!"
                                : "";

                if (correct) {
                    result.setMessage(
                            "CHÍNH XÁC!" + doubleActionLabel +
                            " Đẩy QUỶ NGU sang ĐỘI " +
                            otherTeam +
                            " " + dumbBallSteps + " bước."
                    );
                } else {
                    result.setMessage(
                            "SAI RỒI!" + doubleActionLabel +
                            " QUỶ NGU bị hút về ĐỘI " +
                            player.teamNumber +
                            " " + dumbBallSteps + " bước."
                    );
                }
            }

            /*
             * COUNTDOWN không chờ người khác:
             * mỗi account nhận câu random riêng ngay sau answer.
             */
            player.currentQuestion = null;
            player.currentSkillType = null;

            if (SKILL_RESET_PASSWORD.equals(earnedSkill)) {
                player.pendingSkillType = SKILL_RESET_PASSWORD;
                preparePasswordSelectionLocked(player);
            } else if (fireActivated) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            } else if (
                earnedSkill != null &&
                countSkillTargetsLocked(room, player, earnedSkill) > 0
            ) {
                player.pendingSkillType = earnedSkill;
                preparePendingSkillTargetsLocked(
                        room,
                        player
                );
            } else {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }

            result.setRoom(
                    snapshotLocked(
                        room,
                        username
                    )
            );
        }

        broadcastGeneric(room);

        return result;
    }


    @Override
    public BattleOnlineRoomDto useSkill(
            String roomCode,
            String username,
            BattleOnlineUseSkillDto skillDto) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requirePlaying(room);

            if (!isCountdownLikeMode(room.settings.mode)) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Skill chỉ sử dụng trong COUNTDOWN."
                );
            }

            if (System.currentTimeMillis() >= room.matchEndsAt) {
                finishMatchLocked(room);
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hết thời gian trận."
                );
            }

            PlayerState actor = requirePlayer(room, username);

            requireActivePlayer(actor);

            if (actor.pendingSkillType == null) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn không có skill đang chờ sử dụng."
                );
            }

            ensurePendingSkillTargetsLocked(
                    room,
                    actor
            );

            String targetUsername =
                    skillDto != null
                            ? clean(skillDto.getTargetUsername())
                            : "";

            if (
                actor.pendingSkillTargetUsernames.isEmpty() &&
                countSkillTargetsLocked(room, actor) == 0
            ) {
                releasePendingSkillWhenNoTargetLocked(
                        room,
                        actor
                );
            } else {
                if (targetUsername.length() == 0) {
                    throw new BattleOnlineException(
                            HttpStatus.BAD_REQUEST,
                            "Bạn phải chọn một mục tiêu để sử dụng skill."
                    );
                }

                if (
                    !actor.pendingSkillTargetUsernames.contains(
                        targetUsername
                    )
                ) {
                    throw new BattleOnlineException(
                            HttpStatus.BAD_REQUEST,
                            "Người chơi này không nằm trong 4 mục tiêu được random."
                    );
                }

                PlayerState target = room.players.get(targetUsername);

                if (!isSkillTargetEligibleLocked(
                        room,
                        actor,
                        target,
                        actor.pendingSkillType
                )) {
                    throw new BattleOnlineException(
                            HttpStatus.BAD_REQUEST,
                            "Người chơi được chọn không hợp lệ, cùng đội hoặc đã mất kết nối."
                    );
                }

                String skillType = actor.pendingSkillType;
                double amount = 0D;
                long now = System.currentTimeMillis();

                if (SKILL_MONEY_BEG.equals(skillType)) {
                    if (isBlank(target.currentPassword)) {
                        throw new BattleOnlineException(
                                HttpStatus.BAD_REQUEST,
                                "Người chơi này chưa chọn mật khẩu. Hãy chọn người khác."
                        );
                    }

                    preparePasswordGuessLocked(actor, target);
                    actor.pendingSkillTargetUsernames.clear();
                } else if (SKILL_FREEZE.equals(skillType)) {
                    target.frozenUntil =
                            Math.max(now, target.frozenUntil) +
                            FREEZE_DURATION_MS;
                } else if (SKILL_BREAK_STREAK.equals(skillType)) {
                    /*
                     * Luôn cho phép phá, kể cả streak hiện đang bằng 0.
                     */
                    target.streak = 0;
                } else if (SKILL_STEAL_SCORE.equals(skillType)) {
                    amount = Math.floor(
                            Math.max(0D, target.score) * 0.05D
                    );

                    target.score -= amount;
                    actor.score += amount;
                } else {
                    throw new BattleOnlineException(
                            HttpStatus.CONFLICT,
                            "Skill không hợp lệ."
                    );
                }

                if (!SKILL_MONEY_BEG.equals(skillType)) {
                    addSkillEventLocked(
                            room,
                            skillType,
                            actor,
                            target,
                            amount,
                            now
                    );

                    actor.pendingSkillType = null;
                    actor.pendingSkillTargetUsernames.clear();

                    assignNextCountdownQuestionLocked(
                            room,
                            actor
                    );
                }
            }

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
    }


    @Override
    public BattleOnlineRoomDto choosePassword(
            String roomCode,
            String username,
            BattleOnlinePasswordChoiceDto passwordDto) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlineRoomDto dto;

        synchronized (room) {
            requirePlaying(room);

            if (!MODE_MONEY_BEG.equals(room.settings.mode)) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Phòng này không sử dụng mật khẩu XIN TÍ TIỀN."
                );
            }

            if (System.currentTimeMillis() >= room.matchEndsAt) {
                finishMatchLocked(room);
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hết thời gian trận."
                );
            }

            PlayerState player = requirePlayer(room, username);
            requireActivePlayer(player);

            if (
                !player.passwordSelectionRequired ||
                player.passwordOptions.isEmpty()
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn không có lượt chọn mật khẩu đang chờ."
                );
            }

            String optionKey = normalizePasswordOptionKey(
                    passwordDto != null
                            ? passwordDto.getOptionKey()
                            : null
            );

            String customPassword = validateCustomPassword(
                    passwordDto != null
                            ? passwordDto.getCustomPassword()
                            : null
            );

            String selectedPassword = customPassword != null
                    ? customPassword
                    : player.passwordOptions.get(optionKey);

            if (selectedPassword == null) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Mật khẩu được chọn không hợp lệ."
                );
            }

            boolean resetSkill =
                    SKILL_RESET_PASSWORD.equals(player.pendingSkillType);

            if (
                resetSkill &&
                selectedPassword.equals(player.currentPassword)
            ) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Mật khẩu mới phải khác mật khẩu hiện tại."
                );
            }

            player.currentPassword = selectedPassword;
            player.passwordSelectionRequired = false;
            player.passwordOptions.clear();

            if (resetSkill) {
                addSkillEventLocked(
                        room,
                        SKILL_RESET_PASSWORD,
                        player,
                        player,
                        0D,
                        System.currentTimeMillis()
                );

                player.pendingSkillType = null;
                player.pendingSkillTargetUsernames.clear();
            }

            assignNextCountdownQuestionLocked(room, player);
            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);
        return dto;
    }


    @Override
    public BattleOnlinePasswordGuessResultDto guessPassword(
            String roomCode,
            String username,
            BattleOnlinePasswordGuessDto passwordDto) {

        username = requireUsername(username);

        RoomState room = requireRoom(roomCode);
        BattleOnlinePasswordGuessResultDto result =
                new BattleOnlinePasswordGuessResultDto();

        synchronized (room) {
            requirePlaying(room);

            if (!MODE_MONEY_BEG.equals(room.settings.mode)) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Phòng này không có skill XIN TÍ TIỀN."
                );
            }

            if (System.currentTimeMillis() >= room.matchEndsAt) {
                finishMatchLocked(room);
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Hết thời gian trận."
                );
            }

            PlayerState actor = requirePlayer(room, username);
            requireActivePlayer(actor);

            if (
                !SKILL_MONEY_BEG.equals(actor.pendingSkillType) ||
                actor.pendingPasswordGuessTargetUsername == null ||
                actor.passwordGuessOptions.isEmpty()
            ) {
                throw new BattleOnlineException(
                        HttpStatus.CONFLICT,
                        "Bạn không có lượt đoán mật khẩu đang chờ."
                );
            }

            String optionKey = normalizePasswordOptionKey(
                    passwordDto != null
                            ? passwordDto.getOptionKey()
                            : null
            );

            if (!actor.passwordGuessOptions.containsKey(optionKey)) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Mật khẩu dự đoán không hợp lệ."
                );
            }

            PlayerState target = room.players.get(
                    actor.pendingPasswordGuessTargetUsername
            );

            boolean correct = optionKey.equals(
                    actor.pendingPasswordGuessCorrectKey
            );

            double amount = 0D;

            if (correct && target != null && target != actor) {
                amount = roundScoreToOneDecimal(
                        Math.max(0D, target.score) * MONEY_BEG_STEAL_RATE
                );

                target.score = roundScoreToOneDecimal(
                        Math.max(0D, target.score - amount)
                );

                actor.score = roundScoreToOneDecimal(actor.score + amount);
            }

            addPasswordGuessEventLocked(
                    room,
                    actor,
                    target,
                    correct,
                    amount,
                    System.currentTimeMillis()
            );

            actor.pendingSkillType = null;
            actor.pendingSkillTargetUsernames.clear();
            actor.pendingPasswordGuessTargetUsername = null;
            actor.pendingPasswordGuessCorrectKey = null;
            actor.passwordGuessOptions.clear();

            assignNextCountdownQuestionLocked(room, actor);
            result.setCorrect(correct);
            result.setAmount(amount);
            result.setMessage(
                    correct
                            ? "CORRECT! Bạn đã lấy được " +
                                formatScore(amount) + " điểm."
                            : "INCORRECT! Bạn không lấy được điểm."
            );
            result.setRoom(snapshotLocked(room, username));
        }

        broadcastGeneric(room);
        return result;
    }


    private void preparePasswordSelectionLocked(PlayerState player) {
        player.passwordOptions.clear();

        Set<String> disallowed = new LinkedHashSet<String>();

        if (!isBlank(player.currentPassword)) {
            disallowed.add(player.currentPassword);
        }

        List<String> values = generateTieredPasswords(disallowed);

        for (int index = 0; index < PASSWORD_OPTION_KEYS.length; index++) {
            player.passwordOptions.put(
                    PASSWORD_OPTION_KEYS[index],
                    values.get(index)
            );
        }

        player.passwordSelectionRequired = true;
        player.currentQuestion = null;
        player.currentSkillType = null;
    }


    private void preparePasswordGuessLocked(
            PlayerState actor,
            PlayerState target) {

        actor.passwordGuessOptions.clear();

        Set<String> values = new LinkedHashSet<String>();
        values.add(target.currentPassword);
        values.addAll(generateSimilarPasswordDecoys(
                target.currentPassword,
                2
        ));

        List<String> shuffled = new ArrayList<String>(values);
        Collections.shuffle(shuffled, random);

        for (int index = 0; index < PASSWORD_OPTION_KEYS.length; index++) {
            String key = PASSWORD_OPTION_KEYS[index];
            String value = shuffled.get(index);

            actor.passwordGuessOptions.put(key, value);

            if (target.currentPassword.equals(value)) {
                actor.pendingPasswordGuessCorrectKey = key;
            }
        }

        actor.pendingPasswordGuessTargetUsername = target.username;
        actor.currentQuestion = null;
        actor.currentSkillType = null;
    }


    private List<String> generateTieredPasswords(Set<String> disallowed) {
        Set<String> result = new LinkedHashSet<String>();

        for (int difficulty = 0; difficulty < 3; difficulty++) {
            int attempts = 0;

            while (attempts < 100) {
                attempts += 1;
                String password = generatePassword(difficulty);

                if (
                    !result.contains(password) &&
                    (disallowed == null || !disallowed.contains(password))
                ) {
                    result.add(password);
                    break;
                }
            }
        }

        while (result.size() < 3) {
            String fallback = generatePassword(random.nextInt(3));

            if (
                !result.contains(fallback) &&
                (disallowed == null || !disallowed.contains(fallback))
            ) {
                result.add(fallback);
            }
        }

        List<String> values = new ArrayList<String>(result);
        Collections.shuffle(values, random);
        return values;
    }


    private List<String> generateUniquePasswords(
            int count,
            Set<String> disallowed) {

        Set<String> result = new LinkedHashSet<String>();
        int attempts = 0;

        while (result.size() < count && attempts < 200) {
            attempts += 1;
            String password = generatePassword(random.nextInt(3));

            if (disallowed == null || !disallowed.contains(password)) {
                result.add(password);
            }
        }

        while (result.size() < count) {
            String fallback = "PIN" + (10 + random.nextInt(90));

            if (disallowed == null || !disallowed.contains(fallback)) {
                result.add(fallback);
            }
        }

        return new ArrayList<String>(result);
    }


    /*
     * Hai phương án sai đều là mật khẩu hoàn chỉnh do hệ thống sinh ra,
     * sau đó được xếp theo độ giống mật khẩu thật về cấu trúc.
     *
     * Không sửa ngẫu nhiên từng chữ của mật khẩu thật: cách cũ vô tình biến
     * chữ tiếng Việt có dấu thành ASCII, khiến học sinh nhận ra phương án nào
     * viết đúng dấu thì đó chính là mật khẩu thật.
     */
    private List<String> generateSimilarPasswordDecoys(
            String realPassword,
            int count) {

        Set<String> result = new LinkedHashSet<String>();

        /*
         * Nếu mã có số, dấu câu, emoji hoặc là một chuỗi liền không có
         * khoảng trắng, ưu tiên tạo mồi cùng khuôn. Dấu tiếng Việt luôn
         * được giữ hoặc thay bằng một chữ vẫn có dấu, tuyệt đối không
         * chuyển riêng phương án mồi sang ASCII như trước.
         */
        int shapeAttempts = 0;

        while (result.size() < count && shapeAttempts < 100) {
            shapeAttempts += 1;

            String candidate = mutatePasswordWithoutAccentLeak(realPassword);

            if (!realPassword.equals(candidate)) {
                result.add(candidate);
            }
        }

        Set<String> candidateSet = new LinkedHashSet<String>();
        int attempts = 0;

        while (candidateSet.size() < 120 && attempts < 500) {
            attempts += 1;

            String candidate = generatePassword(random.nextInt(3));

            if (!realPassword.equals(candidate)) {
                candidateSet.add(candidate);
            }
        }

        final String passwordToMatch = realPassword;
        List<String> candidates =
                new ArrayList<String>(candidateSet);

        /* Xáo trước để các trường hợp cùng điểm không bị thiên vị cụm đầu. */
        Collections.shuffle(candidates, random);
        Collections.sort(
                candidates,
                new Comparator<String>() {
                    @Override
                    public int compare(String left, String right) {
                        return Integer.compare(
                                passwordShapeDistance(passwordToMatch, left),
                                passwordShapeDistance(passwordToMatch, right)
                        );
                    }
                }
        );

        for (String candidate : candidates) {
            if (result.size() >= count) {
                break;
            }

            result.add(candidate);
        }

        if (result.size() < count) {
            Set<String> disallowed = new LinkedHashSet<String>(result);
            disallowed.add(realPassword);

            List<String> fallback = generateUniquePasswords(
                    count - result.size(),
                    disallowed
            );

            result.addAll(fallback);
        }

        return new ArrayList<String>(result);
    }


    private String mutatePasswordWithoutAccentLeak(String password) {
        int[] codePoints = password.codePoints().toArray();
        List<Integer> mutablePositions = new ArrayList<Integer>();
        boolean hasWordBoundary = false;

        for (int codePoint : codePoints) {
            if (
                Character.isWhitespace(codePoint) ||
                isPasswordWordSeparator(codePoint)
            ) {
                hasWordBoundary = true;
                break;
            }
        }

        for (int index = 0; index < codePoints.length; index++) {
            int characterClass = passwordCharacterClass(codePoints[index]);

            if (
                characterClass != 0 ||
                !hasWordBoundary
            ) {
                if (!Character.isWhitespace(codePoints[index])) {
                    mutablePositions.add(index);
                }
            }
        }

        if (mutablePositions.isEmpty()) {
            return password;
        }

        int position = mutablePositions.get(
                random.nextInt(mutablePositions.size())
        );

        int original = codePoints[position];
        int replacement = randomSameClassPasswordCodePoint(original);

        if (isPasswordWordSeparator(original)) {
            for (int index = 0; index < codePoints.length; index++) {
                if (codePoints[index] == original) {
                    codePoints[index] = replacement;
                }
            }
        } else {
            codePoints[position] = replacement;
        }

        return new String(codePoints, 0, codePoints.length);
    }


    private int randomSameClassPasswordCodePoint(int original) {
        if (Character.isDigit(original)) {
            int replacement;

            do {
                replacement = '0' + random.nextInt(10);
            } while (replacement == original);

            return replacement;
        }

        if (Character.isLetter(original)) {
            boolean upperCase = Character.isUpperCase(original);
            int replacement;

            if (original <= 127) {
                do {
                    replacement =
                            (upperCase ? 'A' : 'a') + random.nextInt(26);
                } while (replacement == original);

                return replacement;
            }

            int[] vietnameseLetters =
                    PASSWORD_VIETNAMESE_LETTERS.codePoints().toArray();

            do {
                replacement = vietnameseLetters[
                        random.nextInt(vietnameseLetters.length)
                ];
                replacement = upperCase
                        ? Character.toUpperCase(replacement)
                        : replacement;
            } while (replacement == original);

            return replacement;
        }

        int characterClass = passwordCharacterClass(original);

        if (characterClass == 3) {
            int replacement;

            if (isPasswordWordSeparator(original)) {
                do {
                    replacement = PASSWORD_WORD_SEPARATORS.charAt(
                            random.nextInt(PASSWORD_WORD_SEPARATORS.length())
                    );
                } while (replacement == original);

                return replacement;
            }

            do {
                replacement = PASSWORD_PUNCTUATION.charAt(
                        random.nextInt(PASSWORD_PUNCTUATION.length())
                );
            } while (replacement == original);

            return replacement;
        }

        int replacement;

        do {
            String icon = PASSWORD_ICONS[
                    random.nextInt(PASSWORD_ICONS.length)
            ];
            replacement = icon.codePointAt(0);
        } while (replacement == original);

        return replacement;
    }


    private boolean isPasswordWordSeparator(int codePoint) {
        return PASSWORD_WORD_SEPARATORS.indexOf(codePoint) >= 0;
    }


    private int passwordShapeDistance(String expected, String candidate) {
        int[] left = passwordShape(expected);
        int[] right = passwordShape(candidate);
        int score = 0;

        /* Độ dài gần nhau là quan trọng nhất, nhưng không phải dấu hiệu duy nhất. */
        score += Math.abs(left[0] - right[0]) * 3;
        score += Math.abs(left[1] - right[1]) * 5;
        score += Math.abs(left[2] - right[2]) * 3;
        score += Math.abs(left[3] - right[3]) * 5;
        score += Math.abs(left[4] - right[4]) * 7;
        score += Math.abs(left[5] - right[5]) * 2;

        /* Cùng kiểu tiếng Việt/có dấu để không lộ phương án thật. */
        if ((left[6] > 0) != (right[6] > 0)) {
            score += 30;
        }

        if (left[7] != right[7]) {
            score += 12;
        }

        if (left[8] != right[8]) {
            score += 12;
        }

        return score;
    }


    /*
     * [0] length, [1] digit, [2] whitespace, [3] punctuation,
     * [4] symbol/emoji, [5] uppercase, [6] non-ASCII letter,
     * [7] first character class, [8] last character class.
     */
    private int[] passwordShape(String password) {
        int[] shape = new int[9];
        int[] codePoints = password.codePoints().toArray();

        shape[0] = codePoints.length;

        for (int codePoint : codePoints) {
            int characterClass = passwordCharacterClass(codePoint);

            if (characterClass == 1) {
                shape[1] += 1;
            } else if (characterClass == 2) {
                shape[2] += 1;
            } else if (characterClass == 3) {
                shape[3] += 1;
            } else if (characterClass == 4) {
                shape[4] += 1;
            }

            if (Character.isUpperCase(codePoint)) {
                shape[5] += 1;
            }

            if (Character.isLetter(codePoint) && codePoint > 127) {
                shape[6] += 1;
            }
        }

        if (codePoints.length > 0) {
            shape[7] = passwordCharacterClass(codePoints[0]);
            shape[8] = passwordCharacterClass(
                    codePoints[codePoints.length - 1]
            );
        }

        return shape;
    }


    private int passwordCharacterClass(int codePoint) {
        if (Character.isDigit(codePoint)) {
            return 1;
        }

        if (Character.isWhitespace(codePoint)) {
            return 2;
        }

        int type = Character.getType(codePoint);

        if (
            type == Character.CONNECTOR_PUNCTUATION ||
            type == Character.DASH_PUNCTUATION ||
            type == Character.START_PUNCTUATION ||
            type == Character.END_PUNCTUATION ||
            type == Character.INITIAL_QUOTE_PUNCTUATION ||
            type == Character.FINAL_QUOTE_PUNCTUATION ||
            type == Character.OTHER_PUNCTUATION
        ) {
            return 3;
        }

        if (Character.isLetter(codePoint)) {
            return 0;
        }

        return 4;
    }


    private String generatePassword(int difficulty) {
        String phrase = PASSWORD_PHRASES[
                random.nextInt(PASSWORD_PHRASES.length)
        ];
        String icon = PASSWORD_ICONS[random.nextInt(PASSWORD_ICONS.length)];
        int digit = 2 + random.nextInt(8);

        if (difficulty <= 0) {
            return phrase;
        }

        if (difficulty == 1) {
            switch (random.nextInt(4)) {
                case 0:
                    return limitPasswordLength(phrase + digit);
                case 1:
                    return limitPasswordLength(icon + phrase);
                case 2:
                    return limitPasswordLength(phrase.replace(' ', '-'));
                default:
                    return limitPasswordLength(phrase + icon);
            }
        }

        String hardPhrase = toHardPasswordPhrase(phrase);
        String number = String.valueOf(10 + random.nextInt(90));

        switch (random.nextInt(3)) {
            case 0:
                return limitPasswordLength(icon + hardPhrase + number);
            case 1:
                return limitPasswordLength(
                        hardPhrase +
                        PASSWORD_PUNCTUATION.charAt(
                            random.nextInt(PASSWORD_PUNCTUATION.length())
                        ) +
                        number
                );
            default:
                return limitPasswordLength(number + hardPhrase + icon);
        }
    }


    private String toHardPasswordPhrase(String phrase) {
        StringBuilder result = new StringBuilder();

        for (int offset = 0; offset < phrase.length();) {
            int codePoint = phrase.codePointAt(offset);

            switch (Character.toLowerCase(codePoint)) {
                case 'a':
                    result.append('4');
                    break;
                case 'e':
                    result.append('3');
                    break;
                case 'i':
                    result.append('1');
                    break;
                case 'o':
                    result.append('0');
                    break;
                case 's':
                    result.append('5');
                    break;
                case ' ':
                    result.append(random.nextBoolean() ? '_' : '.');
                    break;
                default:
                    result.appendCodePoint(codePoint);
                    break;
            }

            offset += Character.charCount(codePoint);
        }

        return result.toString();
    }


    private String limitPasswordLength(String value) {
        int codePointLength = value.codePointCount(0, value.length());

        if (codePointLength <= 20) {
            return value;
        }

        return value.substring(0, value.offsetByCodePoints(0, 20));
    }


    private String validateCustomPassword(String value) {
        if (value == null) {
            return null;
        }

        String password = value.trim();

        if (password.length() == 0) {
            return null;
        }

        int codePointLength = password.codePointCount(0, password.length());

        if (codePointLength > 20) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Mật khẩu tự nhập chỉ được dài tối đa 20 ký tự."
            );
        }

        for (int offset = 0; offset < password.length();) {
            int codePoint = password.codePointAt(offset);

            if (Character.isISOControl(codePoint)) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Mật khẩu không được chứa ký tự điều khiển."
                );
            }

            offset += Character.charCount(codePoint);
        }

        return password;
    }


    private String normalizePasswordOptionKey(String value) {
        String key = safe(value)
                .toUpperCase(Locale.ENGLISH)
                .trim();

        if (
            !"A".equals(key) &&
            !"B".equals(key) &&
            !"C".equals(key)
        ) {
            return "";
        }

        return key;
    }


    private void validateAnswerDto(
            BattleOnlineAnswerDto answerDto,
            QuestionState question,
            long expectedSequence) {

        if (
            answerDto == null ||
            answerDto.getQuestionId() == null ||
            !answerDto
                .getQuestionId()
                .equals(question.id)
        ) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "Câu hỏi không còn hợp lệ."
            );
        }

        if (
            answerDto.getQuestionSequence() !=
            expectedSequence
        ) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "Đây là request của câu hỏi cũ."
            );
        }

        if (
            normalizeAnswerKey(
                answerDto.getAnswerKey()
            ) == null
        ) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Đáp án không hợp lệ."
            );
        }
    }


    private void applyWrongAnswerPenaltyLocked(
            RoomState room,
            PlayerState player,
            QuestionState question,
            String selectedKey,
            long now) {

        int seconds = normalizeWrongAnswerFreezeSeconds(
                room.settings.wrongAnswerFreezeSeconds
        );

        player.wrongAnswerPenaltyUntil =
                now + (seconds * 1000L);
        player.wrongAnswerQuestion = question.question;
        player.wrongAnswerCorrectAnswer =
                findAnswerText(question, question.correctKey);
        player.wrongAnswerSelectedAnswer =
                findAnswerText(question, selectedKey);
    }


    private void clearExpiredWrongAnswerPenaltyLocked(
            PlayerState player,
            long now) {

        if (
            player.wrongAnswerPenaltyUntil <= 0L ||
            now < player.wrongAnswerPenaltyUntil
        ) {
            return;
        }

        player.wrongAnswerPenaltyUntil = 0L;
        player.wrongAnswerQuestion = null;
        player.wrongAnswerCorrectAnswer = null;
        player.wrongAnswerSelectedAnswer = null;
    }


    private String findAnswerText(
            QuestionState question,
            String answerKey) {

        String normalizedKey = normalizeAnswerKey(answerKey);

        if (question == null || normalizedKey == null) {
            return "";
        }

        for (OptionState option : question.options) {
            if (normalizedKey.equals(option.key)) {
                return safe(option.text);
            }
        }

        return "";
    }


    private double applyScore(
            PlayerState player,
            boolean correct,
            boolean quizBattle2Scoring,
            long scoreAt) {

        double scoreDelta = 0D;

        if (correct) {
            player.streak += 1;
            player.correctCount += 1;

            if (
                quizBattle2Scoring &&
                player.streak >= 5
            ) {
                scoreDelta =
                        Math.floor(player.streak / 3D);
            } else {
                scoreDelta = 1D;
            }

            if (
                quizBattle2Scoring &&
                scoreAt < player.burningUntil
            ) {
                /*
                 * CHÁY LÊN nhân trực tiếp số điểm vừa tính của câu hiện tại
                 * (bao gồm điểm theo streak), không cộng một lượng điểm cố
                 * định. Làm tròn 1 chữ số để tránh sai số double kiểu 3.5999.
                 */
                scoreDelta = roundScoreToOneDecimal(
                        scoreDelta * FIRE_UP_SCORE_MULTIPLIER
                );
            }

            player.score += scoreDelta;
        } else {
            player.streak = 0;
            player.wrongCount += 1;

            if (quizBattle2Scoring) {
                scoreDelta = -0.5D;
                player.score += scoreDelta;
            }
        }

        return scoreDelta;
    }


    private double applyClassicSpeedScore(
            PlayerState player,
            int correctOrder) {

        player.streak += 1;
        player.correctCount += 1;

        double scoreDelta;

        if (correctOrder == 1) {
            scoreDelta = 3D;
        } else if (correctOrder == 2) {
            scoreDelta = 2D;
        } else {
            scoreDelta = 1D;
        }

        player.score += scoreDelta;

        return scoreDelta;
    }


    private void fillAnswerResult(
            BattleOnlineAnswerResultDto result,
            PlayerState player,
            boolean correct,
            double scoreDelta,
            boolean fireBoostApplied,
            boolean fireActivated) {

        result.setAccepted(true);
        result.setCorrect(correct);
        result.setScore(player.score);
        result.setStreak(player.streak);
        if (!correct) {
            result.setMessage("SAI RỒI!");
        } else if (fireActivated) {
            result.setMessage(
                    "CHÍNH XÁC! CHÁY LÊN đã bật trong 15 giây."
            );
        } else if (fireBoostApplied) {
            result.setMessage(
                    "CHÍNH XÁC! CHÁY LÊN x1.2: +" +
                    formatScore(scoreDelta) + " điểm."
            );
        } else {
            result.setMessage("CHÍNH XÁC!");
        }
    }


    /* =========================================================
       CLASSIC TIMER
       ========================================================= */

    private void startClassicQuestionLocked(
            RoomState room) {

        if (
            room.classicQuestionIndex < 0 ||
            room.classicQuestionIndex >=
                room.classicQuestions.size()
        ) {
            finishMatchLocked(room);
            return;
        }

        for (PlayerState player : room.players.values()) {
            player.answeredClassicIndex = -1;
        }

        room.classicCorrectAnswerCount = 0;

        room.questionEndsAt =
                System.currentTimeMillis() +
                (
                    room.settings.secondsPerQuestion *
                    1000L
                );

        scheduleClassicAdvance(
                room.code,
                room.classicQuestionIndex,
                (
                    room.settings.secondsPerQuestion *
                    1000L
                ) + 80L
        );
    }


    private void scheduleClassicAdvance(
            final String roomCode,
            final int expectedIndex,
            long delayMillis) {

        cancelClassicTimer(roomCode);

        ScheduledFuture<?> future =
                scheduler.schedule(
                    new Runnable() {
                        @Override
                        public void run() {
                            advanceClassicQuestion(
                                    roomCode,
                                    expectedIndex
                            );
                        }
                    },
                    Math.max(20L, delayMillis),
                    TimeUnit.MILLISECONDS
                );

        classicTimers.put(
                normalizeRoomCode(roomCode),
                future
        );
    }


    private void advanceClassicQuestion(
            String roomCode,
            int expectedIndex) {

        RoomState room =
                rooms.get(
                    normalizeRoomCode(roomCode)
                );

        if (room == null) {
            return;
        }

        synchronized (room) {
            if (
                !PLAYING.equals(room.status) ||
                !MODE_CLASSIC.equals(room.settings.mode) ||
                room.classicQuestionIndex !=
                    expectedIndex
            ) {
                return;
            }

            int next =
                    room.classicQuestionIndex + 1;

            if (
                next >=
                room.classicQuestions.size()
            ) {
                finishMatchLocked(room);
            } else {
                room.classicQuestionIndex = next;
                startClassicQuestionLocked(room);
            }
        }

        broadcastGeneric(room);
    }


    /* =========================================================
       COUNTDOWN PLAYER RANDOM QUESTION
       ========================================================= */

    private void buildCountdownSkillPlanLocked(RoomState room) {
        room.countdownSkillPlan.clear();

        int total = displayTotal(room);

        if (total <= 0) {
            return;
        }

        Set<Integer> blocked = new LinkedHashSet<Integer>();
        int[] skillCounts = getCountdownSkillCounts(
                total,
                MODE_MONEY_BEG.equals(room.settings.mode)
        );

        if (MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)) {
            /*
             * Mode hai đội không dùng CƯỚP ĐIỂM. Phân bổ lại toàn bộ
             * lượt đó cho FREEZE, FIRE_UP và BREAK_STREAK để tổng tần
             * suất skill vẫn tương đương COUNTDOWN.
             */
            int removedStealCount = skillCounts[2];
            int[] replacementCycle = new int[] {0, 3, 1};

            skillCounts[2] = 0;

            for (int index = 0; index < removedStealCount; index++) {
                skillCounts[replacementCycle[index % replacementCycle.length]] += 1;
            }
        }

        List<Integer> freezePositions =
                buildBalancedSkillPositions(
                    total,
                    skillCounts[0],
                    blocked
                );

        for (Integer position : freezePositions) {
            room.countdownSkillPlan.put(position, SKILL_FREEZE);
            blocked.add(position);
        }

        List<Integer> breakPositions =
                buildBalancedSkillPositions(
                    total,
                    skillCounts[1],
                    blocked
                );

        for (Integer position : breakPositions) {
            room.countdownSkillPlan.put(position, SKILL_BREAK_STREAK);
            blocked.add(position);
        }

        List<Integer> stealPositions =
                buildBalancedSkillPositions(
                    total,
                    skillCounts[2],
                    blocked
                );

        for (Integer position : stealPositions) {
            room.countdownSkillPlan.put(position, SKILL_STEAL_SCORE);
            blocked.add(position);
        }

        List<Integer> firePositions =
                buildBalancedSkillPositions(
                    total,
                    skillCounts[3],
                    blocked
                );

        for (Integer position : firePositions) {
            room.countdownSkillPlan.put(position, SKILL_FIRE_UP);
            blocked.add(position);
        }

        List<Integer> moneyBegPositions =
                buildBalancedSkillPositions(
                    total,
                    skillCounts[4],
                    blocked
                );

        for (Integer position : moneyBegPositions) {
            room.countdownSkillPlan.put(position, SKILL_MONEY_BEG);
        }
    }


    /**
     * Số câu càng lớn thì TỔNG tỉ lệ xuất hiện skill càng tăng.
     *
     * Tỉ lệ gốc:
     * 10-14 câu: 10% | 15-29: 16% | 30-49: 20%
     * 50-69: 24% | 70-89: 28% | 90-109: 32% | >=110: 36%.
     *
     * Tổng số skill thực tế được nhân 0.75, tương đương khoảng:
     * 7.5% | 12% | 15% | 18% | 21% | 24% | 27%.
     *
     * Không đặt trần số lượng tuyệt đối, nên phòng 200 câu luôn có nhiều
     * skill hơn phòng 100 câu và không còn bị tụt tỉ lệ vì chạm giới hạn.
     * COUNTDOWN thường chia 4 skill theo vòng ưu tiên. Riêng XIN TÍ TIỀN
     * dành xấp xỉ 30% tổng số lượt skill cho HACK/MONEY_BEG.
     */
    private int[] getCountdownSkillCounts(
            int total,
            boolean includeMoneyBeg) {

        int[] counts = new int[] {0, 0, 0, 0, 0};

        if (total < 10) {
            return counts;
        }

        double totalRate =
                total >= 110 ? 0.36D :
                total >= 90 ? 0.32D :
                total >= 70 ? 0.28D :
                total >= 50 ? 0.24D :
                total >= 30 ? 0.20D :
                total >= 15 ? 0.16D : 0.10D;

        /* buildBalancedSkillPositions dùng các vị trí từ 3 đến total - 3. */
        int availablePositions = Math.max(0, total - 5);
        int totalSkillCount = Math.min(
                availablePositions,
                Math.max(
                    1,
                    (int) Math.round(
                        total *
                        totalRate *
                        COUNTDOWN_SKILL_RATE_FACTOR
                    )
                )
        );

        /*
         * Trong mode XIN TÍ TIỀN, HACK/MONEY_BEG chiếm xấp xỉ 30%
         * tổng số skill; 70% còn lại giữ cách chia skill COUNTDOWN cũ.
         */
        double expectedMoneyBegCount = includeMoneyBeg
                ? totalSkillCount * 0.30D
                : 0D;

        int moneyBegCount = (int) Math.floor(expectedMoneyBegCount);

        if (
            includeMoneyBeg &&
            random.nextDouble() <
                (expectedMoneyBegCount - moneyBegCount)
        ) {
            moneyBegCount += 1;
        }

        moneyBegCount = Math.min(totalSkillCount, moneyBegCount);
        counts[4] = moneyBegCount;

        int regularSkillCount = totalSkillCount - moneyBegCount;
        int[] firstRound = new int[] {0, 3, 1, 2};
        int assigned = 0;

        while (assigned < regularSkillCount && assigned < firstRound.length) {
            counts[firstRound[assigned]] += 1;
            assigned += 1;
        }

        /*
         * Vòng lặp sau giữ FREEZE phổ biến nhất, FIRE_UP/BREAK_STREAK ở mức
         * trung bình và STEAL_SCORE hiếm nhất.
         */
        int[] weightedCycle = new int[] {0, 3, 1, 0, 3, 2, 1, 0};
        int cycleIndex = 0;

        while (assigned < regularSkillCount) {
            counts[weightedCycle[cycleIndex]] += 1;
            assigned += 1;
            cycleIndex = (cycleIndex + 1) % weightedCycle.length;
        }

        return counts;
    }


    private List<Integer> buildBalancedSkillPositions(
            int total,
            int skillCount,
            Set<Integer> blocked) {

        List<Integer> candidates = new ArrayList<Integer>();

        if (skillCount <= 0) {
            return candidates;
        }

        int firstAllowed = 3;
        int lastAllowed = total - 3;

        for (int index = firstAllowed; index <= lastAllowed; index++) {
            if (blocked == null || !blocked.contains(index)) {
                candidates.add(index);
            }
        }

        if (candidates.isEmpty()) {
            return candidates;
        }

        skillCount = Math.min(skillCount, candidates.size());

        List<Integer> result = new ArrayList<Integer>();
        double segmentSize = candidates.size() / (double) skillCount;

        for (int segmentIndex = 0; segmentIndex < skillCount; segmentIndex++) {
            int start = (int) Math.floor(segmentIndex * segmentSize);
            int end = (int) Math.floor((segmentIndex + 1) * segmentSize) - 1;

            if (segmentIndex == skillCount - 1) {
                end = candidates.size() - 1;
            }

            end = Math.max(start, end);

            int picked = start + random.nextInt(end - start + 1);
            result.add(candidates.get(picked));
        }

        return result;
    }


    private int countSkillTargetsLocked(
            RoomState room,
            PlayerState actor) {

        return countSkillTargetsLocked(
                room,
                actor,
                actor != null ? actor.pendingSkillType : null
        );
    }


    private int countSkillTargetsLocked(
            RoomState room,
            PlayerState actor,
            String skillType) {

        int count = 0;

        for (PlayerState player : room.players.values()) {
            if (isSkillTargetEligibleLocked(
                    room,
                    actor,
                    player,
                    skillType
            )) {
                count += 1;
            }
        }

        return count;
    }


    private boolean isSkillTargetEligibleLocked(
            RoomState room,
            PlayerState actor,
            PlayerState candidate,
            String skillType) {

        if (
            candidate == null ||
            candidate == actor ||
            candidate.spectator ||
            !candidate.connected
        ) {
            return false;
        }

        if (
            room.settings.teamCount >= 2 &&
            actor != null &&
            actor.teamNumber >= 1 &&
            actor.teamNumber == candidate.teamNumber
        ) {
            return false;
        }

        return !SKILL_MONEY_BEG.equals(skillType) ||
                !isBlank(candidate.currentPassword);
    }


    private boolean releasePendingSkillWhenNoTargetLocked(
            RoomState room,
            PlayerState actor) {

        if (
            actor.pendingSkillType == null ||
            SKILL_RESET_PASSWORD.equals(actor.pendingSkillType) ||
            actor.pendingPasswordGuessTargetUsername != null ||
            countSkillTargetsLocked(room, actor) > 0
        ) {
            return false;
        }

        actor.pendingSkillType = null;
        actor.pendingSkillTargetUsernames.clear();

        assignNextCountdownQuestionLocked(
                room,
                actor
        );

        return true;
    }


    /**
     * Tạo tối đa 4 mục tiêu và lưu trong state của người nhận skill:
     * - 2 slot đầu random đều giữa mọi đối thủ đang online.
     * - các slot còn lại random theo trọng số; hạng 1 và hạng 2 có
     *   trọng số 1.4, các hạng khác có trọng số 1.0.
     *
     * Danh sách được lưu server-side để refresh trình duyệt không thể
     * random lại và useSkill chỉ chấp nhận đúng một trong các mục tiêu này.
     */
    private void preparePendingSkillTargetsLocked(
            RoomState room,
            PlayerState actor) {

        actor.pendingSkillTargetUsernames.clear();

        List<PlayerState> rankedPlayers =
                rankedPlayerStatesLocked(room);

        Map<String, Integer> rankByUsername =
                new LinkedHashMap<String, Integer>();

        List<PlayerState> pool =
                new ArrayList<PlayerState>();

        for (int index = 0; index < rankedPlayers.size(); index++) {
            PlayerState candidate = rankedPlayers.get(index);

            rankByUsername.put(
                    candidate.username,
                    index + 1
            );

            if (isSkillTargetEligibleLocked(
                    room,
                    actor,
                    candidate,
                    actor.pendingSkillType
            )) {
                pool.add(candidate);
            }
        }

        int targetCount = Math.min(
                SKILL_TARGET_CANDIDATE_COUNT,
                pool.size()
        );

        List<String> selected =
                new ArrayList<String>();

        int pureRandomSlots = Math.min(
                SKILL_TARGET_RANDOM_SLOT_COUNT,
                targetCount
        );

        while (
            selected.size() < pureRandomSlots &&
            !pool.isEmpty()
        ) {
            PlayerState picked = pool.remove(
                    random.nextInt(pool.size())
            );

            selected.add(picked.username);
        }

        while (
            selected.size() < targetCount &&
            !pool.isEmpty()
        ) {
            PlayerState picked =
                    removeWeightedSkillTarget(
                        pool,
                        rankByUsername
                    );

            if (picked == null) {
                break;
            }

            selected.add(picked.username);
        }

        /* Không để UI biết slot nào là random đều / random trọng số. */
        Collections.shuffle(selected, random);

        actor.pendingSkillTargetUsernames.addAll(selected);
    }


    private void ensurePendingSkillTargetsLocked(
            RoomState room,
            PlayerState actor) {

        if (
            actor.pendingSkillType == null ||
            SKILL_RESET_PASSWORD.equals(actor.pendingSkillType) ||
            actor.pendingPasswordGuessTargetUsername != null
        ) {
            actor.pendingSkillTargetUsernames.clear();
            return;
        }

        List<PlayerState> rankedPlayers =
                rankedPlayerStatesLocked(room);

        Map<String, PlayerState> eligibleByUsername =
                new LinkedHashMap<String, PlayerState>();

        Map<String, Integer> rankByUsername =
                new LinkedHashMap<String, Integer>();

        for (int index = 0; index < rankedPlayers.size(); index++) {
            PlayerState candidate = rankedPlayers.get(index);

            rankByUsername.put(
                    candidate.username,
                    index + 1
            );

            if (isSkillTargetEligibleLocked(
                    room,
                    actor,
                    candidate,
                    actor.pendingSkillType
            )) {
                eligibleByUsername.put(
                        candidate.username,
                        candidate
                );
            }
        }

        int targetCount = Math.min(
                SKILL_TARGET_CANDIDATE_COUNT,
                eligibleByUsername.size()
        );

        List<String> validExisting =
                new ArrayList<String>();

        for (String targetUsername : actor.pendingSkillTargetUsernames) {
            if (
                eligibleByUsername.containsKey(targetUsername) &&
                !validExisting.contains(targetUsername)
            ) {
                validExisting.add(targetUsername);
            }
        }

        actor.pendingSkillTargetUsernames.clear();
        actor.pendingSkillTargetUsernames.addAll(validExisting);

        if (
            actor.pendingSkillTargetUsernames.isEmpty() &&
            targetCount > 0
        ) {
            preparePendingSkillTargetsLocked(room, actor);
            return;
        }

        List<PlayerState> refillPool =
                new ArrayList<PlayerState>();

        for (PlayerState candidate : eligibleByUsername.values()) {
            if (
                !actor.pendingSkillTargetUsernames.contains(
                    candidate.username
                )
            ) {
                refillPool.add(candidate);
            }
        }

        while (
            actor.pendingSkillTargetUsernames.size() < targetCount &&
            !refillPool.isEmpty()
        ) {
            PlayerState picked =
                    removeWeightedSkillTarget(
                        refillPool,
                        rankByUsername
                    );

            if (picked == null) {
                break;
            }

            actor.pendingSkillTargetUsernames.add(
                    picked.username
            );
        }
    }


    private List<PlayerState> rankedPlayerStatesLocked(
            RoomState room) {

        List<PlayerState> players =
                new ArrayList<PlayerState>();

        for (PlayerState player : room.players.values()) {
            if (!player.spectator) {
                players.add(player);
            }
        }

        Collections.sort(
                players,
                new Comparator<PlayerState>() {
                    @Override
                    public int compare(
                            PlayerState left,
                            PlayerState right) {

                        if (left.score != right.score) {
                            return Double.compare(
                                    right.score,
                                    left.score
                            );
                        }

                        if (
                            left.correctCount !=
                            right.correctCount
                        ) {
                            return right.correctCount -
                                    left.correctCount;
                        }

                        return safe(left.username)
                                .compareToIgnoreCase(
                                    safe(right.username)
                                );
                    }
                }
        );

        return players;
    }


    private PlayerState removeWeightedSkillTarget(
            List<PlayerState> pool,
            Map<String, Integer> rankByUsername) {

        if (pool == null || pool.isEmpty()) {
            return null;
        }

        double totalWeight = 0D;

        for (PlayerState candidate : pool) {
            Integer rank = rankByUsername.get(candidate.username);

            totalWeight +=
                    rank != null && rank <= 2
                            ? SKILL_TOP_RANK_WEIGHT
                            : 1D;
        }

        double ticket = random.nextDouble() * totalWeight;

        for (int index = 0; index < pool.size(); index++) {
            PlayerState candidate = pool.get(index);
            Integer rank = rankByUsername.get(candidate.username);

            ticket -=
                    rank != null && rank <= 2
                            ? SKILL_TOP_RANK_WEIGHT
                            : 1D;

            if (ticket < 0D) {
                return pool.remove(index);
            }
        }

        return pool.remove(pool.size() - 1);
    }


    private void addSkillEventLocked(
            RoomState room,
            String skillType,
            PlayerState actor,
            PlayerState target,
            double amount,
            long createdAt) {

        BattleOnlineEventDto event = new BattleOnlineEventDto();

        event.setId(++room.nextEventId);
        event.setType(skillType);
        event.setActorUsername(actor.username);
        event.setActorDisplayName(actor.displayName);
        event.setTargetUsername(target.username);
        event.setTargetDisplayName(target.displayName);
        event.setAmount(amount);
        event.setCreatedAt(createdAt);

        String actorName = displayName(actor);
        String targetName = displayName(target);

        if (SKILL_FREEZE.equals(skillType)) {
            event.setMessage(
                    actorName + " vừa đóng băng " + targetName + " trong 3 giây."
            );
        } else if (SKILL_BREAK_STREAK.equals(skillType)) {
            event.setMessage(
                    actorName + " vừa phá streak của " + targetName + "."
            );
        } else if (SKILL_STEAL_SCORE.equals(skillType)) {
            event.setMessage(
                    actorName + " vừa cướp " + formatScore(amount) +
                    " điểm của " + targetName + "."
            );
        } else if (SKILL_FIRE_UP.equals(skillType)) {
            if (MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)) {
                event.setMessage(
                        actorName +
                        " vừa kích hoạt CHÁY LÊN: câu đúng đẩy QUỶ NGU " +
                        (isEscapeDoubleActionPlayerLocked(room, actor) ? 4 : 2) +
                        " bước trong 15 giây."
                );
            } else {
                event.setMessage(
                        actorName + " vừa kích hoạt CHÁY LÊN x1.2 trong 15 giây."
                );
            }
        } else if (SKILL_RESET_PASSWORD.equals(skillType)) {
            event.setMessage(
                    actorName + " vừa dùng skill ĐẶT LẠI MẬT KHẨU."
            );
        }

        room.recentEvents.add(0, event);

        while (room.recentEvents.size() > MAX_RECENT_EVENTS) {
            room.recentEvents.remove(room.recentEvents.size() - 1);
        }
    }


    private void addPasswordGuessEventLocked(
            RoomState room,
            PlayerState actor,
            PlayerState target,
            boolean correct,
            double amount,
            long createdAt) {

        BattleOnlineEventDto event = new BattleOnlineEventDto();

        event.setId(++room.nextEventId);
        event.setType(SKILL_MONEY_BEG);
        event.setActorUsername(actor.username);
        event.setActorDisplayName(actor.displayName);
        event.setTargetUsername(target != null ? target.username : null);
        event.setTargetDisplayName(target != null ? target.displayName : null);
        event.setAmount(amount);
        event.setCreatedAt(createdAt);

        String actorName = displayName(actor);
        String targetName = displayName(target);

        if (correct) {
            event.setMessage(
                    actorName + " đoán đúng mật khẩu và xin được " +
                    formatScore(amount) + " điểm của " + targetName + "."
            );
        } else {
            event.setMessage(
                    actorName + " đoán sai mật khẩu của " + targetName +
                    ", không xin được điểm."
            );
        }

        room.recentEvents.add(0, event);

        while (room.recentEvents.size() > MAX_RECENT_EVENTS) {
            room.recentEvents.remove(room.recentEvents.size() - 1);
        }
    }


    private String displayName(PlayerState player) {
        if (player == null) {
            return "Người chơi";
        }

        return isBlank(player.displayName)
                ? "Người chơi"
                : player.displayName;
    }


    private String formatScore(double value) {
        if (value == Math.floor(value)) {
            return String.valueOf((long) value);
        }

        return String.valueOf(value);
    }


    private double roundScoreToOneDecimal(double value) {
        return Math.round(value * 10D) / 10D;
    }

    private void assignNextCountdownQuestionLocked(
            RoomState room,
            PlayerState player) {

        if (player.spectator) {
            player.currentQuestion = null;
            player.currentSkillType = null;
            player.pendingSkillType = null;
            player.pendingSkillTargetUsernames.clear();
            return;
        }

        if (
            player.pendingSkillType != null ||
            player.passwordSelectionRequired ||
            player.pendingPasswordGuessTargetUsername != null
        ) {
            player.currentQuestion = null;
            player.currentSkillType = null;
            return;
        }

        if (
            !PLAYING.equals(room.status) ||
            !isCountdownLikeMode(room.settings.mode) ||
            System.currentTimeMillis() >=
                room.matchEndsAt
        ) {
            player.currentQuestion = null;
            return;
        }

        /*
         * Ưu tiên câu ôn lại đã đến hạn trước câu random thông thường.
         * next sequence được dùng để đảm bảo có đủ 5-7 câu xen giữa.
         */
        QuestionState dueReviewQuestion =
                findCountdownReviewQuestionLocked(
                        room,
                        player,
                        true
                );

        if (dueReviewQuestion != null) {
            setCurrentCountdownQuestionLocked(
                    room,
                    player,
                    dueReviewQuestion
            );

            return;
        }

        int maxAttempts =
                Math.max(
                    12,
                    room.rawQuestions.size() * 2
                );

        int attempts = 0;

        while (attempts < maxAttempts) {
            attempts += 1;

            if (player.pendingWordIds.isEmpty()) {
                refillCountdownPendingLocked(
                        room,
                        player
                );
            }

            if (player.pendingWordIds.isEmpty()) {
                /*
                 * Pool quá nhỏ hoặc mọi từ đều đang chờ ôn lại:
                 * không để client bị treo currentQuestion = null.
                 * Khi không đủ 5 câu khác, lấy câu có hạn gần nhất.
                 */
                QuestionState fallbackReviewQuestion =
                        findCountdownReviewQuestionLocked(
                                room,
                                player,
                                false
                        );

                if (fallbackReviewQuestion != null) {
                    setCurrentCountdownQuestionLocked(
                            room,
                            player,
                            fallbackReviewQuestion
                    );
                } else {
                    assignEmergencyCountdownQuestionLocked(
                            room,
                            player
                    );
                }

                return;
            }

            Long wordId =
                    player.pendingWordIds.remove(
                        player.pendingWordIds.size() - 1
                    );

            QuestionState prepared =
                    room.preparedQuestions.get(
                        wordId
                    );

            if (prepared == null) {
                continue;
            }

            /*
             * Câu đã sai do review queue quản lý, không cho random thường
             * lấy lại sớm hơn mốc 5-7 câu.
             */
            if (
                player.countdownReviewQuestions
                    .containsKey(wordId)
            ) {
                continue;
            }

            if (
                isCurrentQuestionUsedByOtherPlayerLocked(
                    room,
                    player,
                    wordId
                ) &&
                room.preparedQuestions.size() >
                    countConnectedPlayersLocked(room)
            ) {
                /*
                 * Nếu pool đủ lớn, tránh 2 người đang nhìn
                 * cùng một từ ở COUNTDOWN. Tuy nhiên khi đây là
                 * từ cuối cùng trong vòng của người chơi thì phải
                 * phát luôn; đưa lại vào danh sách lúc này sẽ lặp
                 * đến maxAttempts và làm currentQuestion = null.
                 */
                if (!player.pendingWordIds.isEmpty()) {
                    player.pendingWordIds.add(
                            0,
                            wordId
                    );

                    continue;
                }
            }

            setCurrentCountdownQuestionLocked(
                    room,
                    player,
                    prepared
            );

            return;
        }

        /*
         * Không recurse vô hạn nếu dữ liệu có quá nhiều nghĩa trùng.
         * Nếu pool thường tạm thời không chọn được, dùng câu ôn gần nhất
         * để phía client vẫn luôn nhận được một câu hợp lệ.
         */
        QuestionState fallbackReviewQuestion =
                findCountdownReviewQuestionLocked(
                        room,
                        player,
                        false
                );

        if (fallbackReviewQuestion != null) {
            setCurrentCountdownQuestionLocked(
                    room,
                    player,
                    fallbackReviewQuestion
            );
        } else {
            assignEmergencyCountdownQuestionLocked(
                    room,
                    player
            );
        }
    }


    /*
     * Lưới an toàn cho COUNTDOWN và THOÁT KHỎI QUỶ NGU.
     * Trong mọi trường hợp pool tạm thời không chọn được câu, người chơi
     * vẫn phải nhận một câu riêng tiếp theo thay vì currentQuestion = null.
     */
    private void assignEmergencyCountdownQuestionLocked(
            RoomState room,
            PlayerState player) {

        List<QuestionState> candidates =
                new ArrayList<QuestionState>(
                    room.preparedQuestions.values()
                );

        Collections.shuffle(candidates, random);

        QuestionState selected = null;

        for (QuestionState candidate : candidates) {
            if (
                candidate != null &&
                !isCurrentQuestionUsedByOtherPlayerLocked(
                    room,
                    player,
                    candidate.id
                )
            ) {
                selected = candidate;
                break;
            }
        }

        if (selected == null && !candidates.isEmpty()) {
            selected = candidates.get(0);
        }

        if (selected != null) {
            setCurrentCountdownQuestionLocked(
                    room,
                    player,
                    selected
            );
        } else {
            player.currentQuestion = null;
            player.currentSkillType = null;
        }
    }


    private void setCurrentCountdownQuestionLocked(
            RoomState room,
            PlayerState player,
            QuestionState prepared) {

        QuestionState question =
                copyQuestionState(prepared);

        player.currentQuestionSequence += 1L;

        question.sequence =
                player.currentQuestionSequence;

        player.currentQuestion =
                question;

        int skillCycleSize =
                Math.max(
                        1,
                        displayTotal(room)
                );

        int skillPosition =
                (int) (
                    (player.currentQuestionSequence - 1L) %
                    skillCycleSize
                );

        if (
            MODE_MONEY_BEG.equals(room.settings.mode) &&
            !player.passwordResetSkillIssued &&
            System.currentTimeMillis() >= room.passwordResetAvailableAt
        ) {
            /*
             * Câu đầu tiên của riêng mỗi người chơi được cấp sau mốc nửa trận
             * mang RESET_PASSWORD. Đánh dấu ngay lúc xuất hiện để mỗi người
             * chỉ thấy đúng 1 lần; trả lời sai thì lượt của chính người đó
             * cũng được xem là đã dùng mất, không ảnh hưởng người chơi khác.
             */
            player.currentSkillType = SKILL_RESET_PASSWORD;
            player.passwordResetSkillIssued = true;
        } else {
            player.currentSkillType =
                    room.countdownSkillPlan.get(
                            skillPosition
                    );
        }

        player.uniqueWordIds.add(
                prepared.id
        );
    }


    private void updateCountdownReviewStateLocked(
            PlayerState player,
            QuestionState question,
            boolean correct) {

        if (
            question == null ||
            question.id == null
        ) {
            return;
        }

        if (correct) {
            /*
             * Đúng ở lần ôn lại (hoặc gặp lại bằng luồng hợp lệ)
             * thì hoàn tất câu này, không hỏi lại nữa.
             */
            player.countdownReviewQuestions.remove(
                    question.id
            );

            return;
        }

        int gap =
                COUNTDOWN_REVIEW_MIN_GAP +
                random.nextInt(
                    COUNTDOWN_REVIEW_MAX_GAP -
                    COUNTDOWN_REVIEW_MIN_GAP +
                    1
                );

        CountdownReviewState review =
                player.countdownReviewQuestions.get(
                        question.id
                );

        if (review == null) {
            review = new CountdownReviewState();
            review.questionId = question.id;

            player.countdownReviewQuestions.put(
                    question.id,
                    review
            );
        }

        /*
         * +1 vì cần đủ gap câu khác ở giữa:
         * sai tại S, câu S+1..S+gap là câu xen giữa,
         * câu ôn lại sớm nhất là S+gap+1.
         */
        review.dueSequence =
                player.currentQuestionSequence +
                gap +
                1L;
    }


    private QuestionState findCountdownReviewQuestionLocked(
            RoomState room,
            PlayerState player,
            boolean dueOnly) {

        if (player.countdownReviewQuestions.isEmpty()) {
            return null;
        }

        long nextSequence =
                player.currentQuestionSequence + 1L;

        CountdownReviewState selected = null;
        List<Long> invalidQuestionIds =
                new ArrayList<Long>();

        for (
            Map.Entry<Long, CountdownReviewState> entry :
                player.countdownReviewQuestions.entrySet()
        ) {
            QuestionState prepared =
                    room.preparedQuestions.get(
                            entry.getKey()
                    );

            if (prepared == null) {
                invalidQuestionIds.add(
                        entry.getKey()
                );
                continue;
            }

            CountdownReviewState review =
                    entry.getValue();

            if (
                review == null ||
                (
                    dueOnly &&
                    review.dueSequence > nextSequence
                )
            ) {
                continue;
            }

            if (
                selected == null ||
                review.dueSequence < selected.dueSequence
            ) {
                selected = review;
            }
        }

        for (Long invalidId : invalidQuestionIds) {
            player.countdownReviewQuestions.remove(
                    invalidId
            );
        }

        return selected == null
                ? null
                : room.preparedQuestions.get(
                        selected.questionId
                );
    }


    private void refillCountdownPendingLocked(
            RoomState room,
            PlayerState player) {

        List<Long> unseen =
                new ArrayList<Long>();

        for (Long id : room.preparedQuestions.keySet()) {
            if (
                !player.uniqueWordIds.contains(id) &&
                !player.countdownReviewQuestions
                    .containsKey(id)
            ) {
                unseen.add(id);
            }
        }

        /*
         * Đã gặp toàn bộ số từ hiện có:
         * - nếu server còn preload: review lại pool hiện tại,
         *   batch mới khi tới sẽ được append riêng.
         * - nếu đã load hết: bắt đầu vòng review mới.
         */
        if (unseen.isEmpty()) {
            for (Long id : room.preparedQuestions.keySet()) {
                if (
                    !player.countdownReviewQuestions
                        .containsKey(id)
                ) {
                    unseen.add(id);
                }
            }
        }

        Collections.shuffle(
                unseen,
                random
        );

        player.pendingWordIds.clear();
        player.pendingWordIds.addAll(
                unseen
        );
    }


    private void appendNewWordsToCountdownPlayersLocked(
            RoomState room,
            List<Long> newIds) {

        if (
            !PLAYING.equals(room.status) ||
            !isCountdownLikeMode(room.settings.mode) ||
            newIds == null ||
            newIds.isEmpty()
        ) {
            return;
        }

        for (PlayerState player : room.players.values()) {
            if (player.spectator) {
                continue;
            }

            List<Long> append =
                    new ArrayList<Long>();

            for (Long id : newIds) {
                if (
                    !player.uniqueWordIds.contains(id) &&
                    !player.pendingWordIds.contains(id)
                ) {
                    append.add(id);
                }
            }

            Collections.shuffle(
                    append,
                    random
            );

            player.pendingWordIds.addAll(
                    append
            );

            if (
                player.connected &&
                player.currentQuestion == null
            ) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }
        }
    }


    /* =========================================================
       COUNTDOWN MATCH TIMER
       ========================================================= */

    private void scheduleMatchFinish(
            final String roomCode,
            long matchEndsAt) {

        cancelMatchTimer(roomCode);

        long delay =
                Math.max(
                    20L,
                    matchEndsAt -
                    System.currentTimeMillis() +
                    50L
                );

        ScheduledFuture<?> future =
                scheduler.schedule(
                    new Runnable() {
                        @Override
                        public void run() {
                            finishCountdownByTimer(
                                    roomCode
                            );
                        }
                    },
                    delay,
                    TimeUnit.MILLISECONDS
                );

        matchTimers.put(
                normalizeRoomCode(roomCode),
                future
        );
    }


    private void finishCountdownByTimer(
            String roomCode) {

        RoomState room =
                rooms.get(
                    normalizeRoomCode(roomCode)
                );

        if (room == null) {
            return;
        }

        synchronized (room) {
            if (
                !PLAYING.equals(room.status) ||
                !isCountdownLikeMode(room.settings.mode)
            ) {
                return;
            }

            finishMatchLocked(room);
        }

        broadcastGeneric(room);
    }


    private void finishMatchLocked(
            RoomState room) {

        room.status = FINISHED;
        room.questionEndsAt = 0L;
        room.matchEndsAt = 0L;

        cancelClassicTimer(room.code);
        cancelMatchTimer(room.code);

        for (PlayerState player : room.players.values()) {
            player.currentQuestion = null;
            player.currentSkillType = null;
            player.pendingSkillType = null;
            player.pendingSkillTargetUsernames.clear();
            player.passwordSelectionRequired = false;
            player.passwordOptions.clear();
            player.pendingPasswordGuessTargetUsername = null;
            player.pendingPasswordGuessCorrectKey = null;
            player.passwordGuessOptions.clear();
            player.frozenUntil = 0L;
            player.burningUntil = 0L;
        }
    }


    /* =========================================================
       SERVER-SIDE LAZY PRELOAD
       ========================================================= */

    private void schedulePreload(
            final String roomCode,
            long delayMillis) {

        String code =
                normalizeRoomCode(roomCode);

        ScheduledFuture<?> existing =
                preloadTimers.get(code);

        if (
            existing != null &&
            !existing.isDone()
        ) {
            return;
        }

        ScheduledFuture<?> future =
                scheduler.schedule(
                    new Runnable() {
                        @Override
                        public void run() {
                            loadNextPreloadBatch(
                                    roomCode
                            );
                        }
                    },
                    Math.max(0L, delayMillis),
                    TimeUnit.MILLISECONDS
                );

        preloadTimers.put(
                code,
                future
        );
    }


    private void loadNextPreloadBatch(
            String roomCode) {

        final String code =
                normalizeRoomCode(roomCode);

        RoomState room =
                rooms.get(code);

        if (room == null) {
            preloadTimers.remove(code);
            return;
        }

        int pageIndex;
        Long ownerUserId;
        List<Long> topicIds;

        synchronized (room) {
            if (
                room.allQuestionsLoaded ||
                FINISHED.equals(room.status)
            ) {
                room.loadingQuestions = false;
                preloadTimers.remove(code);
                return;
            }

            if (room.loadingQuestions) {
                return;
            }

            room.loadingQuestions = true;
            room.preloadError = false;

            pageIndex = room.nextPreloadPage;
            ownerUserId = room.ownerUserId;
            topicIds =
                    new ArrayList<Long>(
                        room.settings.topicIds
                    );
        }

        Page<QuestionForGamesDto> page = null;
        Exception loadException = null;

        try {
            QuestionDto searchDto =
                    buildQuestionSearchDto(
                        ownerUserId,
                        topicIds
                    );

            page =
                    questionService
                        .getPageObjectForGames(
                            searchDto,
                            pageIndex,
                            PRELOAD_BATCH_SIZE
                        );
        } catch (Exception exception) {
            loadException = exception;
        }

        boolean scheduleNext = false;
        long nextDelay =
                PRELOAD_BATCH_DELAY_MS;

        synchronized (room) {
            room.loadingQuestions = false;

            if (loadException != null) {
                room.preloadRetryCount += 1;

                if (
                    room.preloadRetryCount <=
                    PRELOAD_MAX_RETRY
                ) {
                    scheduleNext = true;
                    nextDelay =
                            700L *
                            room.preloadRetryCount;
                } else {
                    room.preloadError = true;
                }
            } else {
                room.preloadRetryCount = 0;

                List<QuestionForGamesDto> content =
                        page != null &&
                        page.getContent() != null
                                ? page.getContent()
                                : new ArrayList<QuestionForGamesDto>();

                if (page != null) {
                    long total =
                            page.getTotalElements();

                    room.totalLessonWords =
                            total > Integer.MAX_VALUE
                                    ? Integer.MAX_VALUE
                                    : (int) total;
                }

                List<Long> newIds =
                        appendRawQuestionsLocked(
                            room,
                            content
                        );

                List<Long> preparedNewIds =
                        prepareQuestionBatchLocked(
                            room,
                            newIds
                        );

                appendNewWordsToCountdownPlayersLocked(
                        room,
                        preparedNewIds
                );

                room.nextPreloadPage += 1;

                if (
                    content.isEmpty() ||
                    content.size() <
                        PRELOAD_BATCH_SIZE ||
                    (
                        room.totalLessonWords > 0 &&
                        room.rawQuestions.size() >=
                            room.totalLessonWords
                    )
                ) {
                    room.allQuestionsLoaded = true;

                    prepareMissingQuestionsLocked(
                            room
                    );
                } else {
                    scheduleNext = true;
                }
            }
        }

        broadcastGeneric(room);

        preloadTimers.remove(code);

        if (scheduleNext) {
            schedulePreload(
                    room.code,
                    nextDelay
            );
        }
    }


    private QuestionDto buildQuestionSearchDto(
            Long ownerUserId,
            List<Long> topicIds) {

        QuestionDto searchDto =
                new QuestionDto();

        searchDto.setUpper(100);
        searchDto.setLower(0);
        searchDto.setStatus(3);
        searchDto.setUserId(ownerUserId);

        QuestionTypeDto type =
                new QuestionTypeDto();

        type.setId(6L);

        searchDto.setQuestionType(type);

        List<QuestionTopicDto> wrappers =
                new ArrayList<QuestionTopicDto>();

        for (Long topicId : topicIds) {
            if (topicId == null) {
                continue;
            }

            TopicDto topic =
                    new TopicDto();

            topic.setId(topicId);

            QuestionTopicDto wrapper =
                    new QuestionTopicDto();

            wrapper.setTopic(topic);

            wrappers.add(wrapper);
        }

        searchDto.setQuestionTopics(
                wrappers
        );

        return searchDto;
    }


    private List<Long> appendRawQuestionsLocked(
            RoomState room,
            List<QuestionForGamesDto> content) {

        List<Long> newIds =
                new ArrayList<Long>();

        for (QuestionForGamesDto question : content) {
            if (
                question == null ||
                question.getId() == null ||
                isBlank(question.getQuestion()) ||
                isBlank(question.getMotherTongue())
            ) {
                continue;
            }

            if (
                room.rawQuestions.containsKey(
                    question.getId()
                )
            ) {
                continue;
            }

            room.rawQuestions.put(
                    question.getId(),
                    question
            );

            newIds.add(
                    question.getId()
            );
        }

        return newIds;
    }


    private List<Long> prepareQuestionBatchLocked(
            RoomState room,
            List<Long> ids) {

        List<Long> preparedIds =
                new ArrayList<Long>();

        if (ids == null) {
            return preparedIds;
        }

        for (Long id : ids) {
            QuestionForGamesDto parent =
                    room.rawQuestions.get(id);

            QuestionState question =
                    buildQuestion(
                        parent,
                        room.rawQuestions
                    );

            if (question == null) {
                continue;
            }

            room.preparedQuestions.put(
                    id,
                    question
            );

            preparedIds.add(id);
        }

        return preparedIds;
    }


    private void prepareMissingQuestionsLocked(
            RoomState room) {

        for (
            Map.Entry<Long, QuestionForGamesDto> entry :
                room.rawQuestions.entrySet()
        ) {
            if (
                room.preparedQuestions
                    .containsKey(entry.getKey())
            ) {
                continue;
            }

            QuestionState question =
                    buildQuestion(
                        entry.getValue(),
                        room.rawQuestions
                    );

            if (question != null) {
                room.preparedQuestions.put(
                        entry.getKey(),
                        question
                );
            }
        }
    }


    private QuestionState copyQuestionState(
            QuestionState source) {

        if (source == null) {
            return null;
        }

        QuestionState result =
                new QuestionState();

        result.id = source.id;
        result.question = source.question;
        result.pronounce = source.pronounce;
        result.correctKey = source.correctKey;
        result.sequence = source.sequence;

        for (OptionState sourceOption : source.options) {
            OptionState option =
                    new OptionState();

            option.key = sourceOption.key;
            option.text = sourceOption.text;

            result.options.add(option);
        }

        return result;
    }


    private int countConnectedPlayersLocked(
            RoomState room) {

        int count = 0;

        for (PlayerState player : room.players.values()) {
            if (player.connected && !player.spectator) {
                count += 1;
            }
        }

        return count;
    }


    private boolean isCurrentQuestionUsedByOtherPlayerLocked(
            RoomState room,
            PlayerState currentPlayer,
            Long questionId) {

        for (PlayerState player : room.players.values()) {
            if (
                player == currentPlayer ||
                player.spectator ||
                !player.connected ||
                player.currentQuestion == null
            ) {
                continue;
            }

            if (
                questionId.equals(
                    player.currentQuestion.id
                )
            ) {
                return true;
            }
        }

        return false;
    }


    /* =========================================================
       FAST QUESTION BUILDER
       Không filter/shuffle cả 1000 từ cho từng câu.
       ========================================================= */

    private QuestionState buildQuestion(
            QuestionForGamesDto parent,
            Map<Long, QuestionForGamesDto> sourceMap) {

        if (
            parent == null ||
            parent.getId() == null ||
            isBlank(parent.getQuestion()) ||
            isBlank(parent.getMotherTongue()) ||
            sourceMap == null ||
            sourceMap.size() < 4
        ) {
            return null;
        }

        List<QuestionForGamesDto> source =
                new ArrayList<QuestionForGamesDto>(
                    sourceMap.values()
                );

        String correctText =
                clean(parent.getMotherTongue());

        Map<String, String> uniqueAnswers =
                new LinkedHashMap<String, String>();

        uniqueAnswers.put(
                normalizeText(correctText),
                correctText
        );

        int attempts = 0;
        int maxAttempts =
                Math.max(
                    30,
                    source.size() * 2
                );

        while (
            uniqueAnswers.size() < 4 &&
            attempts < maxAttempts
        ) {
            attempts += 1;

            QuestionForGamesDto candidate =
                    source.get(
                        random.nextInt(
                            source.size()
                        )
                    );

            if (
                candidate == null ||
                candidate.getId() == null ||
                candidate.getId()
                    .equals(parent.getId()) ||
                isBlank(
                    candidate.getMotherTongue()
                )
            ) {
                continue;
            }

            String text =
                    clean(
                        candidate.getMotherTongue()
                    );

            uniqueAnswers.put(
                    normalizeText(text),
                    text
            );
        }

        if (uniqueAnswers.size() < 4) {
            for (QuestionForGamesDto candidate : source) {
                if (uniqueAnswers.size() >= 4) {
                    break;
                }

                if (
                    candidate == null ||
                    candidate.getId() == null ||
                    candidate.getId()
                        .equals(parent.getId()) ||
                    isBlank(
                        candidate.getMotherTongue()
                    )
                ) {
                    continue;
                }

                String text =
                        clean(
                            candidate.getMotherTongue()
                        );

                uniqueAnswers.put(
                        normalizeText(text),
                        text
                );
            }
        }

        if (uniqueAnswers.size() < 4) {
            return null;
        }

        List<String> choices =
                new ArrayList<String>(
                    uniqueAnswers.values()
                );

        /*
         * uniqueAnswers có thể >4 ở fallback tương lai.
         */
        while (choices.size() > 4) {
            choices.remove(
                    choices.size() - 1
            );
        }

        Collections.shuffle(
                choices,
                random
        );

        QuestionState question =
                new QuestionState();

        question.id = parent.getId();
        question.question = parent.getQuestion();
        question.pronounce = parent.getPronounce();

        String[] keys =
                new String[] {
                    "A",
                    "B",
                    "C",
                    "D"
                };

        for (
            int index = 0;
            index < 4;
            index++
        ) {
            OptionState option =
                    new OptionState();

            option.key = keys[index];
            option.text = choices.get(index);

            question.options.add(option);

            if (
                normalizeText(option.text)
                    .equals(
                        normalizeText(correctText)
                    )
            ) {
                question.correctKey =
                        option.key;
            }
        }

        return question.correctKey != null
                ? question
                : null;
    }


    /* =========================================================
       SNAPSHOT / WEBSOCKET
       ========================================================= */

    private BattleOnlineRoomDto snapshot(
            RoomState room,
            String viewerUsername) {

        synchronized (room) {
            return snapshotLocked(
                    room,
                    viewerUsername
            );
        }
    }


    private BattleOnlineRoomDto snapshotLocked(
            RoomState room,
            String viewerUsername) {

        BattleOnlineRoomDto dto =
                new BattleOnlineRoomDto();

        dto.setCode(room.code);
        dto.setStatus(room.status);
        dto.setHostUsername(
                room.hostUsername
        );

        dto.setSettings(
                copySettings(
                    room.settings
                )
        );

        dto.setServerTime(
                System.currentTimeMillis()
        );

        dto.setQuestionEndsAt(
                room.questionEndsAt
        );

        dto.setMatchEndsAt(
                room.matchEndsAt
        );

        if (MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)) {
            room.dumbBallMaxDistance =
                    calculateDumbBallMaxDistance(room);
            room.dumbBallPosition = clamp(
                    room.dumbBallPosition,
                    -room.dumbBallMaxDistance,
                    room.dumbBallMaxDistance
            );

            dto.setDumbBallPosition(room.dumbBallPosition);
            dto.setDumbBallMaxDistance(room.dumbBallMaxDistance);
        }

        dto.setLoadingQuestions(
                room.loadingQuestions
        );

        dto.setAllQuestionsLoaded(
                room.allQuestionsLoaded
        );

        dto.setPreloadError(
                room.preloadError
        );

        dto.setLoadedQuestionCount(
                room.rawQuestions.size()
        );

        dto.setTotalLessonWords(
                room.totalLessonWords
        );

        dto.setQuestionsReady(
                room.preparedQuestions.size() >= 4
        );

        dto.setRecentEvents(
                new ArrayList<BattleOnlineEventDto>(
                    room.recentEvents
                )
        );

        if (
            PLAYING.equals(room.status) &&
            MODE_CLASSIC.equals(
                room.settings.mode
            )
        ) {
            QuestionState question =
                    currentClassicQuestionLocked(
                        room
                    );

            if (question != null) {
                long sequence =
                        room.classicQuestionIndex +
                        1L;

                dto.setCurrentQuestion(
                        toPublicQuestion(
                            question,
                            sequence,
                            room.classicQuestionIndex + 1,
                            room.classicQuestions.size(),
                            null
                        )
                );

                dto.setCurrentQuestionIndex(
                        room.classicQuestionIndex + 1
                );

                dto.setTotalQuestions(
                        room.classicQuestions.size()
                );
            }
        }

        if (
            PLAYING.equals(room.status) &&
            isCountdownLikeMode(room.settings.mode)
        ) {
            /*
             * Chỉ REST snapshot dành cho viewer mới có
             * câu cá nhân. WebSocket generic truyền null viewer.
             */
            if (viewerUsername != null) {
                PlayerState viewer =
                        room.players.get(
                            viewerUsername
                        );

                if (viewer != null && !viewer.spectator) {
                    ensurePendingSkillTargetsLocked(
                            room,
                            viewer
                    );

                    clearExpiredWrongAnswerPenaltyLocked(
                            viewer,
                            System.currentTimeMillis()
                    );

                    dto.setPendingSkillType(
                            viewer.pendingSkillType
                    );

                    dto.setPendingSkillTargetUsernames(
                            new ArrayList<String>(
                                viewer.pendingSkillTargetUsernames
                            )
                    );

                    if (viewer.wrongAnswerPenaltyUntil > 0L) {
                        dto.setWrongAnswerPenaltyUntil(
                                viewer.wrongAnswerPenaltyUntil
                        );
                        dto.setWrongAnswerQuestion(
                                viewer.wrongAnswerQuestion
                        );
                        dto.setWrongAnswerCorrectAnswer(
                                viewer.wrongAnswerCorrectAnswer
                        );
                        dto.setWrongAnswerSelectedAnswer(
                                viewer.wrongAnswerSelectedAnswer
                        );
                    }

                    if (MODE_MONEY_BEG.equals(room.settings.mode)) {
                        dto.setPasswordSelectionRequired(
                                viewer.passwordSelectionRequired
                        );

                        dto.setPasswordOptions(
                                toPasswordOptions(viewer.passwordOptions)
                        );

                        dto.setPendingPasswordGuessTargetUsername(
                                viewer.pendingPasswordGuessTargetUsername
                        );

                        PlayerState passwordTarget = room.players.get(
                                viewer.pendingPasswordGuessTargetUsername
                        );

                        dto.setPendingPasswordGuessTargetDisplayName(
                                passwordTarget != null
                                        ? displayName(passwordTarget)
                                        : null
                        );

                        dto.setPasswordGuessOptions(
                                toPasswordOptions(viewer.passwordGuessOptions)
                        );
                    }
                }

                if (
                    viewer != null &&
                    !viewer.spectator &&
                    viewer.currentQuestion != null
                ) {
                    dto.setCurrentQuestion(
                            toPublicQuestion(
                                viewer.currentQuestion,
                                viewer.currentQuestionSequence,
                                (int) viewer.currentQuestionSequence,
                                displayTotal(room),
                                viewer.currentSkillType
                            )
                    );

                    dto.setCurrentQuestionIndex(
                            (int) viewer.currentQuestionSequence
                    );
                }
            }

            dto.setTotalQuestions(
                    displayTotal(room)
            );
        }

        if (FINISHED.equals(room.status)) {
            dto.setTotalQuestions(
                    MODE_CLASSIC.equals(
                        room.settings.mode
                    )
                            ? room.classicQuestions.size()
                            : displayTotal(room)
            );
        }

        List<BattleOnlinePlayerDto> players =
                new ArrayList<BattleOnlinePlayerDto>();

        for (PlayerState state : room.players.values()) {
            BattleOnlinePlayerDto player =
                    new BattleOnlinePlayerDto();

            player.setUsername(
                    state.username
            );

            player.setDisplayName(
                    state.displayName
            );

            player.setHost(
                    state.host
            );

            player.setSpectator(
                    state.spectator
            );

            player.setReady(
                    state.ready
            );

            player.setConnected(
                    state.connected
            );

            player.setScore(
                    state.score
            );

            player.setStreak(
                    state.streak
            );

            player.setCorrectCount(
                    state.correctCount
            );

            player.setWrongCount(
                    state.wrongCount
            );

            player.setTeamNumber(
                    state.teamNumber
            );

            player.setUniqueWordsSeen(
                    state.uniqueWordIds.size()
            );

            player.setTotalLessonWords(
                    displayTotal(room)
            );

            player.setFrozenUntil(
                    state.frozenUntil
            );

            player.setBurningUntil(
                    state.burningUntil
            );

            player.setAnsweredCurrentQuestion(
                    MODE_CLASSIC.equals(
                        room.settings.mode
                    ) &&
                    PLAYING.equals(
                        room.status
                    ) &&
                    state.answeredClassicIndex ==
                        room.classicQuestionIndex
            );

            players.add(player);
        }

        sortAndRankPlayers(players);

        dto.setPlayers(players);

        return dto;
    }


    private List<BattleOnlinePasswordOptionDto> toPasswordOptions(
            Map<String, String> source) {

        List<BattleOnlinePasswordOptionDto> result =
                new ArrayList<BattleOnlinePasswordOptionDto>();

        if (source == null) {
            return result;
        }

        for (Map.Entry<String, String> entry : source.entrySet()) {
            result.add(
                    new BattleOnlinePasswordOptionDto(
                            entry.getKey(),
                            entry.getValue()
                    )
            );
        }

        return result;
    }


    private BattleOnlineQuestionDto toPublicQuestion(
            QuestionState state,
            long sequence,
            int index,
            int total,
            String skillType) {

        BattleOnlineQuestionDto dto =
                new BattleOnlineQuestionDto();

        dto.setId(state.id);
        dto.setQuestion(
                state.question
        );
        dto.setPronounce(
                state.pronounce
        );

        dto.setSequence(sequence);
        dto.setIndex(index);
        dto.setTotal(total);
        dto.setSkillType(skillType);

        List<BattleOnlineAnswerOptionDto> answers =
                new ArrayList<BattleOnlineAnswerOptionDto>();

        for (OptionState option : state.options) {
            answers.add(
                new BattleOnlineAnswerOptionDto(
                    option.key,
                    option.text
                )
            );
        }

        dto.setAnswers(
                answers
        );

        return dto;
    }


    private void broadcastGeneric(
            RoomState room) {

        if (room == null) {
            return;
        }

        BattleOnlineRoomDto dto;

        synchronized (room) {
            dto = snapshotLocked(
                    room,
                    null
            );
        }

        messagingTemplate.convertAndSend(
                "/topic/battle-online/room/" +
                room.code,
                dto
        );
    }


    private void sortAndRankPlayers(
            List<BattleOnlinePlayerDto> players) {

        Collections.sort(
                players,
                new Comparator<BattleOnlinePlayerDto>() {
                    @Override
                    public int compare(
                            BattleOnlinePlayerDto left,
                            BattleOnlinePlayerDto right) {

                        if (
                            left.isSpectator() !=
                            right.isSpectator()
                        ) {
                            return left.isSpectator()
                                    ? 1
                                    : -1;
                        }

                        if (
                            left.isSpectator() &&
                            right.isSpectator()
                        ) {
                            return safe(
                                    left.getUsername()
                                ).compareToIgnoreCase(
                                    safe(
                                        right.getUsername()
                                    )
                                );
                        }

                        if (
                            left.getScore() !=
                            right.getScore()
                        ) {
                            return Double.compare(
                                    right.getScore(),
                                    left.getScore()
                            );
                        }

                        if (
                            left.getCorrectCount() !=
                            right.getCorrectCount()
                        ) {
                            return right.getCorrectCount() -
                                    left.getCorrectCount();
                        }

                        return safe(
                                left.getUsername()
                            ).compareToIgnoreCase(
                                safe(
                                    right.getUsername()
                                )
                            );
                    }
                }
        );

        int rank = 1;

        for (BattleOnlinePlayerDto player : players) {
            if (player.isSpectator()) {
                player.setRank(0);
            } else {
                player.setRank(rank);
                rank += 1;
            }
        }
    }


    /* =========================================================
       STATE / VALIDATION
       ========================================================= */

    private int normalizeWrongAnswerFreezeSeconds(int value) {
        if (value <= 0) {
            return DEFAULT_WRONG_ANSWER_FREEZE_SECONDS;
        }

        return clamp(
                value,
                MIN_WRONG_ANSWER_FREEZE_SECONDS,
                MAX_WRONG_ANSWER_FREEZE_SECONDS
        );
    }


    private int normalizeTeamCount(int value) {
        if (value < 2) {
            return 0;
        }

        return clamp(value, 2, MAX_TEAM_COUNT);
    }


    private void normalizeTeamAssignmentsLocked(RoomState room) {
        if (room.settings.teamCount < 2) {
            for (PlayerState player : room.players.values()) {
                player.teamNumber = 0;
            }

            return;
        }

        for (PlayerState player : room.players.values()) {
            if (
                player.spectator ||
                player.teamNumber < 1 ||
                player.teamNumber > room.settings.teamCount
            ) {
                player.teamNumber = 0;
            }
        }

        for (PlayerState player : room.players.values()) {
            if (!player.spectator && player.teamNumber == 0) {
                player.teamNumber = nextBalancedTeamLocked(room);
            }
        }
    }


    private int getSmallerEscapeTeamNumberLocked(RoomState room) {
        if (
            room == null ||
            !MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)
        ) {
            return 0;
        }

        int teamOneCount = 0;
        int teamTwoCount = 0;

        for (PlayerState player : room.players.values()) {
            if (
                player == null ||
                player.spectator ||
                !player.connected
            ) {
                continue;
            }

            if (player.teamNumber == 1) {
                teamOneCount += 1;
            } else if (player.teamNumber == 2) {
                teamTwoCount += 1;
            }
        }

        if (teamOneCount == teamTwoCount) {
            return 0;
        }

        return teamOneCount < teamTwoCount ? 1 : 2;
    }


    private void normalizeEscapeDoubleActionPlayerLocked(RoomState room) {
        if (
            room == null ||
            !MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)
        ) {
            if (room != null) {
                room.settings.doubleActionUsername = null;
            }

            return;
        }

        int smallerTeam = getSmallerEscapeTeamNumberLocked(room);
        String selectedUsername = clean(
                room.settings.doubleActionUsername
        );
        PlayerState selected = room.players.get(selectedUsername);

        if (
            smallerTeam == 0 ||
            selected == null ||
            selected.spectator ||
            !selected.connected ||
            selected.teamNumber != smallerTeam
        ) {
            room.settings.doubleActionUsername = null;
            return;
        }

        room.settings.doubleActionUsername = selected.username;
    }


    private boolean isEscapeDoubleActionPlayerLocked(
            RoomState room,
            PlayerState player) {

        return room != null &&
                player != null &&
                MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode) &&
                !isBlank(room.settings.doubleActionUsername) &&
                room.settings.doubleActionUsername.equals(player.username);
    }


    /*
     * applyScore đã cộng scoreDelta cơ bản vào player.score. Người gánh đội
     * nhận thêm đúng một lần phần delta đó để tổng tác động điểm thành x2.
     * Cách này áp dụng đồng đều cho điểm đúng, FIRE/streak và cả điểm trừ khi sai.
     */
    private double applyEscapeDoubleActionScoreLocked(
            RoomState room,
            PlayerState player,
            double scoreDelta) {

        if (
            !isEscapeDoubleActionPlayerLocked(room, player) ||
            scoreDelta == 0D
        ) {
            return scoreDelta;
        }

        player.score = roundScoreToOneDecimal(
                player.score + scoreDelta
        );

        return roundScoreToOneDecimal(
                scoreDelta * 2D
        );
    }


    private int nextBalancedTeamLocked(RoomState room) {
        if (room.settings.teamCount < 2) {
            return 0;
        }

        int[] counts = new int[room.settings.teamCount + 1];

        for (PlayerState player : room.players.values()) {
            if (
                !player.spectator &&
                player.teamNumber >= 1 &&
                player.teamNumber <= room.settings.teamCount
            ) {
                counts[player.teamNumber] += 1;
            }
        }

        int selectedTeam = 1;

        for (int team = 2; team <= room.settings.teamCount; team++) {
            if (counts[team] < counts[selectedTeam]) {
                selectedTeam = team;
            }
        }

        return selectedTeam;
    }

    private void validatePlayersReadyLocked(
            RoomState room) {

        int connected = 0;
        boolean hasTeamOne = false;
        boolean hasTeamTwo = false;

        for (PlayerState player : room.players.values()) {
            if (
                !player.connected ||
                player.spectator
            ) {
                continue;
            }

            connected += 1;

            if (player.teamNumber == 1) {
                hasTeamOne = true;
            } else if (player.teamNumber == 2) {
                hasTeamTwo = true;
            }

            if (
                !player.ready
            ) {
                throw new BattleOnlineException(
                        HttpStatus.BAD_REQUEST,
                        "Tất cả người chơi phải READY trước khi START."
                );
            }
        }

        if (connected < 2) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "Cần ít nhất 2 người đang online để START."
            );
        }

        if (
            MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode) &&
            (!hasTeamOne || !hasTeamTwo)
        ) {
            throw new BattleOnlineException(
                    HttpStatus.BAD_REQUEST,
                    "THOÁT KHỎI QUỶ NGU cần ít nhất 1 người online ở mỗi đội."
            );
        }
    }


    private void resetScoresLocked(
            RoomState room) {

        room.dumbBallPosition = 0;
        room.dumbBallMaxDistance =
                calculateDumbBallMaxDistance(room);

        for (PlayerState player : room.players.values()) {
            resetPlayerMatchState(player);
        }
    }


    private void resetPlayerMatchState(
            PlayerState player) {

        player.score = 0;
        player.streak = 0;
        player.correctCount = 0;
        player.wrongCount = 0;

        player.answeredClassicIndex = -1;

        player.currentQuestion = null;
        player.currentQuestionSequence = 0L;
        player.currentSkillType = null;
        player.pendingSkillType = null;
        player.pendingSkillTargetUsernames.clear();
        player.currentPassword = null;
        player.passwordResetSkillIssued = false;
        player.passwordSelectionRequired = false;
        player.passwordOptions.clear();
        player.pendingPasswordGuessTargetUsername = null;
        player.pendingPasswordGuessCorrectKey = null;
        player.passwordGuessOptions.clear();
        player.frozenUntil = 0L;
        player.burningUntil = 0L;
        player.wrongAnswerPenaltyUntil = 0L;
        player.wrongAnswerQuestion = null;
        player.wrongAnswerCorrectAnswer = null;
        player.wrongAnswerSelectedAnswer = null;

        player.pendingWordIds.clear();
        player.uniqueWordIds.clear();
        player.countdownReviewQuestions.clear();
    }


    private boolean allConnectedClassicAnsweredLocked(
            RoomState room) {

        int connected = 0;

        for (PlayerState player : room.players.values()) {
            if (
                !player.connected ||
                player.spectator
            ) {
                continue;
            }

            connected += 1;

            if (
                player.answeredClassicIndex !=
                room.classicQuestionIndex
            ) {
                return false;
            }
        }

        return connected > 0;
    }


    private QuestionState currentClassicQuestionLocked(
            RoomState room) {

        if (
            room.classicQuestionIndex < 0 ||
            room.classicQuestionIndex >=
                room.classicQuestions.size()
        ) {
            return null;
        }

        return room.classicQuestions.get(
                room.classicQuestionIndex
        );
    }


    private RoomState requireRoom(
            String roomCode) {

        String code =
                normalizeRoomCode(
                    roomCode
                );

        RoomState room =
                rooms.get(code);

        if (room == null) {
            throw new BattleOnlineException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy phòng " +
                    code +
                    "."
            );
        }

        return room;
    }


    private PlayerState requirePlayer(
            RoomState room,
            String username) {

        PlayerState player =
                room.players.get(username);

        if (player == null) {
            throw new BattleOnlineException(
                    HttpStatus.FORBIDDEN,
                    "Bạn chưa JOIN phòng này."
            );
        }

        return player;
    }


    private void requireActivePlayer(
            PlayerState player) {

        if (player != null && player.spectator) {
            throw new BattleOnlineException(
                    HttpStatus.FORBIDDEN,
                    "Bạn đang ở chế độ khán giả và không thể trả lời hoặc sử dụng skill."
            );
        }
    }


    private void requireHost(
            RoomState room,
            String username) {

        if (
            !safe(
                room.hostUsername
            ).equals(username)
        ) {
            throw new BattleOnlineException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ HOST mới được thực hiện thao tác này."
            );
        }
    }


    private void requireLobby(
            RoomState room) {

        if (!LOBBY.equals(room.status)) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "Phòng không còn ở trạng thái LOBBY."
            );
        }
    }


    private void requirePlaying(
            RoomState room) {

        if (!PLAYING.equals(room.status)) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "Trận hiện không ở trạng thái PLAYING."
            );
        }
    }


    private void promoteHostLocked(
            RoomState room) {

        PlayerState next = null;

        for (PlayerState player : room.players.values()) {
            next = player;
            break;
        }

        if (next == null) {
            room.hostUsername = null;
            return;
        }

        for (PlayerState player : room.players.values()) {
            player.host = false;
        }

        next.host = true;
        next.ready = true;

        room.hostUsername =
                next.username;
    }


    private void detachFromOldRooms(
            String username) {

        List<String> codes =
                new ArrayList<String>(
                    rooms.keySet()
                );

        for (String code : codes) {
            RoomState old =
                    rooms.get(code);

            if (old == null) {
                continue;
            }

            synchronized (old) {
                PlayerState player =
                        old.players.get(username);

                if (player == null) {
                    continue;
                }

                if (PLAYING.equals(old.status)) {
                    player.connected = false;
                } else {
                    old.players.remove(username);

                    if (
                        username.equals(
                            old.hostUsername
                        )
                    ) {
                        promoteHostLocked(old);
                    }
                }

                if (old.players.isEmpty()) {
                    destroyRoom(old.code);
                } else {
                    broadcastGeneric(old);
                }
            }
        }
    }


    private void destroyRoom(
            String roomCode) {

        String code =
                normalizeRoomCode(
                    roomCode
                );

        cancelClassicTimer(code);
        cancelMatchTimer(code);
        cancelPreloadTimer(code);

        rooms.remove(code);
    }


    /* =========================================================
       TIMER CLEANUP
       ========================================================= */

    private void cancelClassicTimer(
            String roomCode) {

        ScheduledFuture<?> future =
                classicTimers.remove(
                    normalizeRoomCode(
                        roomCode
                    )
                );

        if (future != null) {
            future.cancel(false);
        }
    }


    private void cancelMatchTimer(
            String roomCode) {

        ScheduledFuture<?> future =
                matchTimers.remove(
                    normalizeRoomCode(
                        roomCode
                    )
                );

        if (future != null) {
            future.cancel(false);
        }
    }


    private void cancelPreloadTimer(
            String roomCode) {

        ScheduledFuture<?> future =
                preloadTimers.remove(
                    normalizeRoomCode(
                        roomCode
                    )
                );

        if (future != null) {
            future.cancel(false);
        }
    }


    /* =========================================================
       UTIL
       ========================================================= */

    private PlayerIdentity findPlayerIdentity(
            String username) {

        Query query =
                entityManager.createQuery(
                    "select u.id, p.lastName, p.firstName, p.displayName " +
                    "from User u left join u.person p " +
                    "where u.username = :username"
                );

        query.setParameter(
                "username",
                username
        );

        query.setMaxResults(1);

        @SuppressWarnings("unchecked")
        List<Object[]> rows =
                query.getResultList();

        if (
            rows == null ||
            rows.isEmpty()
        ) {
            throw new BattleOnlineException(
                    HttpStatus.UNAUTHORIZED,
                    "Không xác định được account hiện tại."
            );
        }

        Object[] row = rows.get(0);

        PlayerIdentity identity =
                new PlayerIdentity();

        identity.userId =
                row[0] instanceof Number
                        ? ((Number) row[0]).longValue()
                        : null;

        if (identity.userId == null) {
            throw new BattleOnlineException(
                    HttpStatus.UNAUTHORIZED,
                    "Không xác định được account hiện tại."
            );
        }

        String lastName =
                row.length > 1 && row[1] != null
                        ? String.valueOf(row[1])
                        : "";

        String firstName =
                row.length > 2 && row[2] != null
                        ? String.valueOf(row[2])
                        : "";

        String personDisplayName =
                row.length > 3 && row[3] != null
                        ? String.valueOf(row[3])
                        : "";

        /*
         * Bảng xếp hạng ưu tiên đúng thứ tự Last name + First name.
         */
        identity.displayName =
                clean(lastName + " " + firstName);

        if (isBlank(identity.displayName)) {
            identity.displayName =
                    clean(personDisplayName);
        }

        if (isBlank(identity.displayName)) {
            identity.displayName = "Người chơi";
        }

        return identity;
    }


    private String newRoomCode() {
        for (
            int attempt = 0;
            attempt < 1000;
            attempt++
        ) {
            StringBuilder builder =
                    new StringBuilder();

            for (
                int index = 0;
                index < 6;
                index++
            ) {
                builder.append(
                    ROOM_CHARS[
                        random.nextInt(
                            ROOM_CHARS.length
                        )
                    ]
                );
            }

            String code =
                    builder.toString();

            if (!rooms.containsKey(code)) {
                return code;
            }
        }

        throw new BattleOnlineException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Không thể tạo mã phòng. Vui lòng thử lại."
        );
    }


    private BattleOnlineRoomSettingsDto copySettings(
            RoomSettingsState source) {

        BattleOnlineRoomSettingsDto dto =
                new BattleOnlineRoomSettingsDto();

        dto.setTopicIds(
                new ArrayList<Long>(
                    source.topicIds
                )
        );

        dto.setTopicNames(
                new ArrayList<String>(
                    source.topicNames
                )
        );

        dto.setMode(
                source.mode
        );

        dto.setQuestionCount(
                source.questionCount
        );

        dto.setSecondsPerQuestion(
                source.secondsPerQuestion
        );

        dto.setCountdownMinutes(
                source.countdownMinutes
        );

        dto.setWrongAnswerFreezeSeconds(
                source.wrongAnswerFreezeSeconds
        );

        dto.setTeamCount(
                source.teamCount
        );

        dto.setDoubleActionUsername(
                source.doubleActionUsername
        );

        return dto;
    }


    private int displayTotal(
            RoomState room) {

        if (room.totalLessonWords > 0) {
            return room.totalLessonWords;
        }

        return room.rawQuestions.size();
    }


    private int calculateDumbBallMaxDistance(RoomState room) {
        return Math.max(
                1,
                (int) Math.ceil(displayTotal(room) * 0.20D)
        );
    }


    private int calculateDumbBallAnswerDistanceLocked(
            RoomState room,
            PlayerState player,
            boolean correct,
            boolean fireBoostApplied) {

        int distance = correct && fireBoostApplied ? 2 : 1;

        return isEscapeDoubleActionPlayerLocked(room, player)
                ? distance * 2
                : distance;
    }


    private void applyDumbBallAnswerLocked(
            RoomState room,
            PlayerState player,
            boolean correct,
            boolean fireBoostApplied) {

        if (!MODE_ESCAPE_DUMB_DEMON.equals(room.settings.mode)) {
            return;
        }

        if (player.teamNumber != 1 && player.teamNumber != 2) {
            throw new BattleOnlineException(
                    HttpStatus.CONFLICT,
                    "Người chơi phải thuộc ĐỘI 1 hoặc ĐỘI 2."
            );
        }

        int distance = calculateDumbBallAnswerDistanceLocked(
                room,
                player,
                correct,
                fireBoostApplied
        );
        int direction;

        if (player.teamNumber == 1) {
            direction = correct ? distance : -distance;
        } else {
            direction = correct ? -distance : distance;
        }

        room.dumbBallMaxDistance =
                calculateDumbBallMaxDistance(room);
        room.dumbBallPosition = clamp(
                room.dumbBallPosition + direction,
                -room.dumbBallMaxDistance,
                room.dumbBallMaxDistance
        );
    }


    private List<Long> cleanTopicIds(
            List<Long> source) {

        List<Long> result =
                new ArrayList<Long>();

        if (source == null) {
            return result;
        }

        for (Long id : source) {
            if (
                id != null &&
                !result.contains(id)
            ) {
                result.add(id);
            }
        }

        return result;
    }


    private List<String> cleanTopicNames(
            List<String> source) {

        List<String> result =
                new ArrayList<String>();

        if (source == null) {
            return result;
        }

        for (String value : source) {
            String text = clean(value);

            if (
                text.length() > 0 &&
                !result.contains(text)
            ) {
                result.add(text);
            }
        }

        return result;
    }


    private String normalizeMode(
            String value) {

        String mode =
                safe(value)
                    .toUpperCase(
                        Locale.ENGLISH
                    )
                    .trim();

        if (MODE_COUNTDOWN.equals(mode)) {
            return MODE_COUNTDOWN;
        }

        if (
            MODE_MONEY_BEG.equals(mode) ||
            "XIN_TIEN".equals(mode)
        ) {
            return MODE_MONEY_BEG;
        }

        if (
            MODE_ESCAPE_DUMB_DEMON.equals(mode) ||
            "WHO_IS_DUMBER".equals(mode) ||
            "XEM_AI_NGU_HON".equals(mode) ||
            "THOAT_KHOI_QUY_NGU".equals(mode)
        ) {
            return MODE_ESCAPE_DUMB_DEMON;
        }

        return MODE_CLASSIC;
    }


    private boolean isCountdownLikeMode(String mode) {
        return MODE_COUNTDOWN.equals(mode) ||
                MODE_MONEY_BEG.equals(mode) ||
                MODE_ESCAPE_DUMB_DEMON.equals(mode);
    }


    private String normalizeAnswerKey(
            String value) {

        String key =
                safe(value)
                    .toUpperCase(
                        Locale.ENGLISH
                    )
                    .trim();

        if (
            !"A".equals(key) &&
            !"B".equals(key) &&
            !"C".equals(key) &&
            !"D".equals(key)
        ) {
            return null;
        }

        return key;
    }


    private String normalizeRoomCode(
            String value) {

        return safe(value)
                .toUpperCase(
                    Locale.ENGLISH
                )
                .replaceAll(
                    "[^A-Z0-9]",
                    ""
                )
                .trim();
    }


    private String normalizeText(
            String value) {

        return clean(value)
                .toLowerCase(
                    Locale.ENGLISH
                );
    }


    private String requireUsername(
            String username) {

        String result =
                clean(username);

        if (result.length() == 0) {
            throw new BattleOnlineException(
                    HttpStatus.UNAUTHORIZED,
                    "Bạn chưa đăng nhập."
            );
        }

        return result;
    }


    private int clamp(
            int value,
            int min,
            int max) {

        if (value < min) {
            return min;
        }

        if (value > max) {
            return max;
        }

        return value;
    }


    private String clean(
            String value) {

        return safe(value)
                .trim()
                .replaceAll(
                    "\\s+",
                    " "
                );
    }


    private String safe(
            String value) {

        return value != null
                ? value
                : "";
    }


    private boolean isBlank(
            String value) {

        return clean(value)
                .length() == 0;
    }


    @PreDestroy
    public void destroy() {
        for (String code : new ArrayList<String>(rooms.keySet())) {
            destroyRoom(code);
        }

        scheduler.shutdownNow();
    }


    /* =========================================================
       INTERNAL STATE
       ========================================================= */

    private static class PlayerIdentity {
        Long userId;
        String displayName;
    }

    private static class RoomState {
        String code;
        String status;
        String hostUsername;

        Long ownerUserId;

        Map<String, PlayerState> players =
                new LinkedHashMap<String, PlayerState>();

        Set<String> kickedUsernames =
                new LinkedHashSet<String>();

        RoomSettingsState settings =
                new RoomSettingsState();

        /*
         * Lazy pool.
         */
        Map<Long, QuestionForGamesDto> rawQuestions =
                new LinkedHashMap<Long, QuestionForGamesDto>();

        /*
         * Câu + 4 đáp án được build sẵn trong background,
         * START không phải dựng hàng trăm câu cùng lúc.
         */
        Map<Long, QuestionState> preparedQuestions =
                new LinkedHashMap<Long, QuestionState>();

        int nextPreloadPage = 1;
        int totalLessonWords = 0;

        boolean loadingQuestions = false;
        boolean allQuestionsLoaded = false;
        boolean preloadError = false;

        int preloadRetryCount = 0;

        /*
         * CLASSIC.
         */
        List<QuestionState> classicQuestions =
                new ArrayList<QuestionState>();

        int classicQuestionIndex = -1;
        long questionEndsAt = 0L;
        int classicCorrectAnswerCount = 0;

        /*
         * COUNTDOWN.
         */
        long matchEndsAt = 0L;

        /*
         * ESCAPE_DUMB_DEMON: âm gần ĐỘI 1, dương gần ĐỘI 2.
         */
        int dumbBallPosition = 0;
        int dumbBallMaxDistance = 1;

        Map<Integer, String> countdownSkillPlan =
                new LinkedHashMap<Integer, String>();

        long passwordResetAvailableAt = 0L;

        List<BattleOnlineEventDto> recentEvents =
                new ArrayList<BattleOnlineEventDto>();

        long nextEventId = 0L;
    }


    private static class RoomSettingsState {
        List<Long> topicIds =
                new ArrayList<Long>();

        List<String> topicNames =
                new ArrayList<String>();

        String mode = MODE_CLASSIC;

        int questionCount = 20;
        int secondsPerQuestion = 10;

        int countdownMinutes = 5;

        int wrongAnswerFreezeSeconds =
                DEFAULT_WRONG_ANSWER_FREEZE_SECONDS;

        int teamCount = 0;

        String doubleActionUsername;
    }


    private static class PlayerState {
        String username;
        String displayName;

        boolean host;
        boolean spectator;
        boolean ready;
        boolean connected;

        double score;
        int streak;
        int correctCount;
        int wrongCount;
        int teamNumber;

        /*
         * CLASSIC.
         */
        int answeredClassicIndex = -1;

        /*
         * COUNTDOWN.
         */
        QuestionState currentQuestion;
        long currentQuestionSequence = 0L;

        List<Long> pendingWordIds =
                new ArrayList<Long>();

        Set<Long> uniqueWordIds =
                new LinkedHashSet<Long>();

        Map<Long, CountdownReviewState> countdownReviewQuestions =
                new LinkedHashMap<Long, CountdownReviewState>();

        String currentSkillType;
        String pendingSkillType;

        List<String> pendingSkillTargetUsernames =
                new ArrayList<String>();

        String currentPassword;
        boolean passwordResetSkillIssued = false;
        boolean passwordSelectionRequired;

        Map<String, String> passwordOptions =
                new LinkedHashMap<String, String>();

        String pendingPasswordGuessTargetUsername;
        String pendingPasswordGuessCorrectKey;

        Map<String, String> passwordGuessOptions =
                new LinkedHashMap<String, String>();

        long frozenUntil = 0L;
        long burningUntil = 0L;

        long wrongAnswerPenaltyUntil = 0L;
        String wrongAnswerQuestion;
        String wrongAnswerCorrectAnswer;
        String wrongAnswerSelectedAnswer;
    }


    private static class CountdownReviewState {
        Long questionId;
        long dueSequence;
    }


    private static class QuestionState {
        Long id;
        String question;
        String pronounce;

        String correctKey;
        long sequence;

        List<OptionState> options =
                new ArrayList<OptionState>();
    }


    private static class OptionState {
        String key;
        String text;
    }
}
