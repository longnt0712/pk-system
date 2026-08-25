package com.globits.richy.service.impl;

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
import com.globits.richy.dto.BattleOnlinePlayerDto;
import com.globits.richy.dto.BattleOnlineQuestionDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
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

    private static final String SKILL_FREEZE = "FREEZE";
    private static final String SKILL_BREAK_STREAK = "BREAK_STREAK";
    private static final String SKILL_STEAL_SCORE = "STEAL_SCORE";
    private static final String SKILL_FIRE_UP = "FIRE_UP";

    private static final long FREEZE_DURATION_MS = 3000L;
    private static final long FIRE_UP_DURATION_MS = 15000L;
    private static final double FIRE_UP_SCORE_MULTIPLIER = 1.2D;
    private static final double COUNTDOWN_SKILL_RATE_FACTOR = 0.75D;
    private static final int SKILL_TARGET_CANDIDATE_COUNT = 4;
    private static final int SKILL_TARGET_RANDOM_SLOT_COUNT = 2;
    private static final double SKILL_TOP_RANK_WEIGHT = 1.4D;
    private static final int MAX_RECENT_EVENTS = 12;

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

    private final Random random = new Random();

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
            PlayerState existing =
                    room.players.get(username);

            if (existing != null) {
                existing.connected = true;
                existing.displayName = identity.displayName;

                /*
                 * COUNTDOWN reconnect:
                 * nếu chưa có câu cá nhân thì cấp lại.
                 */
                if (
                    PLAYING.equals(room.status) &&
                    MODE_COUNTDOWN.equals(room.settings.mode) &&
                    existing.currentQuestion == null
                ) {
                    assignNextCountdownQuestionLocked(
                            room,
                            existing
                    );
                }

                dto = snapshotLocked(room, username);
            } else {
                if (PLAYING.equals(room.status)) {
                    throw new BattleOnlineException(
                            HttpStatus.CONFLICT,
                            "Trận đã bắt đầu. Chỉ người chơi cũ mới có thể reconnect."
                    );
                }

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
                player.ready = false;

                room.players.put(username, player);

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
                MODE_COUNTDOWN.equals(room.settings.mode) &&
                player.currentQuestion == null &&
                player.pendingSkillType == null
            ) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            }

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

            if (MODE_COUNTDOWN.equals(room.settings.mode)) {
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

            room.questionEndsAt = 0L;
            room.matchEndsAt = 0L;

            for (PlayerState player : room.players.values()) {
                resetPlayerMatchState(player);
                player.ready = player.host;
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

        room.matchEndsAt =
                System.currentTimeMillis() +
                (
                    room.settings.countdownMinutes *
                    60L *
                    1000L
                );

        buildCountdownSkillPlanLocked(room);

        for (PlayerState player : room.players.values()) {
            player.pendingWordIds.clear();
            player.uniqueWordIds.clear();
            player.currentQuestion = null;
            player.currentQuestionSequence = 0L;

            refillCountdownPendingLocked(
                    room,
                    player
            );

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

        if (MODE_COUNTDOWN.equals(room.settings.mode)) {
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

            player.connected = true;

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

            String earnedSkill =
                    correct
                            ? player.currentSkillType
                            : null;

            boolean fireBoostApplied =
                    correct &&
                    now < player.burningUntil;

            double scoreDelta = applyScore(
                    player,
                    correct,
                    true,
                    now
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

            /*
             * COUNTDOWN không chờ người khác:
             * mỗi account nhận câu random riêng ngay sau answer.
             */
            player.currentQuestion = null;
            player.currentSkillType = null;

            if (fireActivated) {
                assignNextCountdownQuestionLocked(
                        room,
                        player
                );
            } else if (
                earnedSkill != null &&
                countSkillTargetsLocked(room, player) > 0
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

            if (!MODE_COUNTDOWN.equals(room.settings.mode)) {
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

            if (targetUsername.length() > 0) {
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

                if (
                    target == null ||
                    target == actor ||
                    !target.connected
                ) {
                    throw new BattleOnlineException(
                            HttpStatus.BAD_REQUEST,
                            "Người chơi được chọn không hợp lệ hoặc đã mất kết nối."
                    );
                }

                String skillType = actor.pendingSkillType;
                double amount = 0D;
                long now = System.currentTimeMillis();

                if (SKILL_FREEZE.equals(skillType)) {
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

                addSkillEventLocked(
                        room,
                        skillType,
                        actor,
                        target,
                        amount,
                        now
                );
            }

            actor.pendingSkillType = null;
            actor.pendingSkillTargetUsernames.clear();

            assignNextCountdownQuestionLocked(
                    room,
                    actor
            );

            dto = snapshotLocked(room, username);
        }

        broadcastGeneric(room);

        return dto;
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
        int[] skillCounts = getCountdownSkillCounts(total);

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
     * Bốn loại skill được chia theo vòng ưu tiên để khi có đủ từ 4 skill
     * trở lên thì FREEZE, FIRE_UP, BREAK_STREAK và STEAL_SCORE đều xuất hiện.
     */
    private int[] getCountdownSkillCounts(int total) {
        int[] counts = new int[] {0, 0, 0, 0};

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

        /* FREEZE, FIRE_UP, BREAK_STREAK, STEAL_SCORE. */
        int[] firstRound = new int[] {0, 3, 1, 2};
        int assigned = 0;

        while (assigned < totalSkillCount && assigned < firstRound.length) {
            counts[firstRound[assigned]] += 1;
            assigned += 1;
        }

        /*
         * Vòng lặp sau giữ FREEZE phổ biến nhất, FIRE_UP/BREAK_STREAK ở mức
         * trung bình và STEAL_SCORE hiếm nhất.
         */
        int[] weightedCycle = new int[] {0, 3, 1, 0, 3, 2, 1, 0};
        int cycleIndex = 0;

        while (assigned < totalSkillCount) {
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

        int count = 0;

        for (PlayerState player : room.players.values()) {
            if (player != actor && player.connected) {
                count += 1;
            }
        }

        return count;
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

            if (
                candidate != actor &&
                candidate.connected
            ) {
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

        if (actor.pendingSkillType == null) {
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

            if (
                candidate != actor &&
                candidate.connected
            ) {
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
                new ArrayList<PlayerState>(
                    room.players.values()
                );

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
            event.setMessage(
                    actorName + " vừa kích hoạt CHÁY LÊN x1.2 trong 15 giây."
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

        if (player.pendingSkillType != null) {
            player.currentQuestion = null;
            player.currentSkillType = null;
            return;
        }

        if (
            !PLAYING.equals(room.status) ||
            !MODE_COUNTDOWN.equals(room.settings.mode) ||
            System.currentTimeMillis() >=
                room.matchEndsAt
        ) {
            player.currentQuestion = null;
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
                player.currentQuestion = null;
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

            QuestionState question =
                    copyQuestionState(
                        prepared
                    );

            player.currentQuestionSequence += 1L;

            question.sequence =
                    player.currentQuestionSequence;

            player.currentQuestion =
                    question;

            int skillCycleSize = Math.max(1, displayTotal(room));
            int skillPosition =
                    (int) ((player.currentQuestionSequence - 1L) % skillCycleSize);

            player.currentSkillType =
                    room.countdownSkillPlan.get(skillPosition);

            player.uniqueWordIds.add(
                    wordId
            );

            return;
        }

        /*
         * Không recurse vô hạn nếu dữ liệu có quá nhiều nghĩa trùng.
         */
        player.currentQuestion = null;
        player.currentSkillType = null;
    }


    private void refillCountdownPendingLocked(
            RoomState room,
            PlayerState player) {

        List<Long> unseen =
                new ArrayList<Long>();

        for (Long id : room.preparedQuestions.keySet()) {
            if (!player.uniqueWordIds.contains(id)) {
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
            unseen.addAll(
                    room.preparedQuestions.keySet()
            );
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
            !MODE_COUNTDOWN.equals(room.settings.mode) ||
            newIds == null ||
            newIds.isEmpty()
        ) {
            return;
        }

        for (PlayerState player : room.players.values()) {
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
                !MODE_COUNTDOWN.equals(room.settings.mode)
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
            if (player.connected) {
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
            MODE_COUNTDOWN.equals(
                room.settings.mode
            )
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

                if (viewer != null) {
                    ensurePendingSkillTargetsLocked(
                            room,
                            viewer
                    );

                    dto.setPendingSkillType(
                            viewer.pendingSkillType
                    );

                    dto.setPendingSkillTargetUsernames(
                            new ArrayList<String>(
                                viewer.pendingSkillTargetUsernames
                            )
                    );
                }

                if (
                    viewer != null &&
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

        for (
            int index = 0;
            index < players.size();
            index++
        ) {
            players.get(index)
                .setRank(index + 1);
        }
    }


    /* =========================================================
       STATE / VALIDATION
       ========================================================= */

    private void validatePlayersReadyLocked(
            RoomState room) {

        int connected = 0;

        for (PlayerState player : room.players.values()) {
            if (!player.connected) {
                continue;
            }

            connected += 1;

            if (
                !player.host &&
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
    }


    private void resetScoresLocked(
            RoomState room) {

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
        player.frozenUntil = 0L;
        player.burningUntil = 0L;

        player.pendingWordIds.clear();
        player.uniqueWordIds.clear();
    }


    private boolean allConnectedClassicAnsweredLocked(
            RoomState room) {

        int connected = 0;

        for (PlayerState player : room.players.values()) {
            if (!player.connected) {
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

        return dto;
    }


    private int displayTotal(
            RoomState room) {

        if (room.totalLessonWords > 0) {
            return room.totalLessonWords;
        }

        return room.rawQuestions.size();
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

        return MODE_CLASSIC;
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

        Map<Integer, String> countdownSkillPlan =
                new LinkedHashMap<Integer, String>();

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
    }


    private static class PlayerState {
        String username;
        String displayName;

        boolean host;
        boolean ready;
        boolean connected;

        double score;
        int streak;
        int correctCount;
        int wrongCount;

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

        String currentSkillType;
        String pendingSkillType;

        List<String> pendingSkillTargetUsernames =
                new ArrayList<String>();

        long frozenUntil = 0L;
        long burningUntil = 0L;
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
