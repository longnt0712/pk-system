(function () {
    'use strict';

    angular.module('Hrm.Question')
        .controller(
            'BattleQuizOnlineController',
            BattleQuizOnlineController
        );

    BattleQuizOnlineController.$inject = [
        '$rootScope',
        '$scope',
        '$state',
        '$stateParams',
        '$interval',
        '$timeout',
        '$cookies',
        '$window',
        'toastr',
        'blockUI',
        'QuestionService',
        'BattleQuizOnlineService'
    ];

    function BattleQuizOnlineController(
        $rootScope,
        $scope,
        $state,
        $stateParams,
        $interval,
        $timeout,
        $cookies,
        $window,
        toastr,
        blockUI,
        questionService,
        battleService
    ) {
        var vm = this;

        if (
            $rootScope.settings &&
            $rootScope.settings.layout
        ) {
            $rootScope.settings.layout.pageContentWhite =
                true;

            $rootScope.settings.layout.pageBodySolid =
                false;

            $rootScope.settings.layout.pageSidebarClosed =
                false;
        }

        vm.room = null;
        vm.roomCodeInput = '';

        vm.creatingRoom = false;
        vm.joiningRoom = false;
        vm.savingSettings = false;
        vm.startingMatch = false;
        vm.refreshingPrivateState = false;

        vm.realtimeConnected = false;
        vm.connectionMode = 'CONNECTING';

        vm.answerLocked = false;
        vm.lastAnswerCorrect = null;
        vm.lastAnswerMessage = '';

        /*
         * CLASSIC: số giây của câu hiện tại.
         * COUNTDOWN: tổng số giây còn lại của trận.
         */
        vm.countdown = 0;

        vm.topicCategories = [];
        vm.topics = [];

        /*
         * Bài được chọn TRƯỚC khi CREATE ROOM.
         */
        vm.selectedTopicToCreate = null;

        vm.searchTopicDto = {};
        vm.searchTopicCategory = {};

        vm.hostSettings = {
            mode: 'CLASSIC',

            questionCount: 20,
            secondsPerQuestion: 10,

            countdownMinutes: 5
        };

        vm.classicQuestionCountTouched = false;

        /*
         * Khi HOST đang chỉnh mode ở lobby, các WebSocket/polling
         * update do preload không được ghi đè lựa chọn local.
         * Flag sẽ được clear sau khi saveSettings thành công.
         */
        vm.hostModeDirty = false;

        vm.currentUser =
            readCurrentUser();

        vm.currentUserDisplayName =
            getFullName(
                vm.currentUser
            );

        vm.searchTopicDto.userId =
            vm.currentUser.id;

        var pollingTimer = null;
        var countdownTimer = null;
        var destroyed = false;

        /*
         * Đồng bộ clock client/server.
         */
        var serverTimeOffset = 0;


        /* =====================================================
           EXPOSE
           ===================================================== */

        vm.isHost = isHost;
        vm.me = getMe;

        vm.createRoom = createRoom;
        vm.joinRoom = joinRoom;
        vm.leaveRoom = leaveRoom;

        vm.getTopics = getTopics;

        vm.selectMode = selectMode;
        vm.markClassicQuestionCountTouched =
            markClassicQuestionCountTouched;

        vm.saveSettings = saveSettings;

        vm.toggleReady = toggleReady;
        vm.startMatch = startMatch;
        vm.restartMatch = restartMatch;

        vm.answer = answer;

        vm.copyRoomLink = copyRoomLink;
        vm.sayCurrentQuestion =
            sayCurrentQuestion;

        vm.getPlayerClass =
            getPlayerClass;

        vm.formatTime =
            formatTime;

        vm.getPreloadPercent =
            getPreloadPercent;


        /* =====================================================
           USER
           ===================================================== */

        function readCurrentUser() {
            var raw =
                $cookies.get(
                    'education.user'
                );

            if (!raw) {
                return {};
            }

            try {
                return angular.fromJson(raw);
            } catch (e) {
                return {};
            }
        }


        function getFullName(user) {
            if (
                user &&
                user.person
            ) {
                var first =
                    user.person.firstName || '';

                var last =
                    user.person.lastName || '';

                var full =
                    (last + ' ' + first)
                        .trim();

                if (full) {
                    return full;
                }
            }

            return (
                user &&
                (
                    user.displayName ||
                    user.username
                )
            ) || '';
        }


        /* =====================================================
           ROOM HELPERS
           ===================================================== */

        function normalizeRoomCode(value) {
            return String(value || '')
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]/g,
                    ''
                )
                .trim();
        }


        function routeRoomCode() {
            var code =
                normalizeRoomCode(
                    $stateParams.roomCode
                );

            if (
                code === '0' ||
                code === 'NULL' ||
                code === 'UNDEFINED'
            ) {
                return '';
            }

            return code;
        }


        function isHost() {
            return !!(
                vm.room &&
                vm.currentUser &&
                vm.room.hostUsername ===
                    vm.currentUser.username
            );
        }


        function getMe() {
            var found = null;

            angular.forEach(
                (
                    vm.room &&
                    vm.room.players
                ) || [],
                function (player) {
                    if (
                        !found &&
                        player.username ===
                            vm.currentUser.username
                    ) {
                        found = player;
                    }
                }
            );

            return found;
        }


        function isCountdownMode() {
            return !!(
                vm.room &&
                vm.room.settings &&
                vm.room.settings.mode ===
                    'COUNTDOWN'
            );
        }


        /* =====================================================
           SELECT LESSON BEFORE CREATE ROOM
           ===================================================== */

        function normalizeText(value) {
            return String(value || '')
                .toLowerCase()
                .trim();
        }


        function findGrade6Category(
            categories
        ) {
            var found = null;

            angular.forEach(
                categories || [],
                function (category) {
                    if (found) {
                        return;
                    }

                    var name =
                        normalizeText(
                            category &&
                            category.name
                        );

                    var code =
                        normalizeText(
                            category &&
                            category.code
                        );

                    var compact =
                        name.replace(
                            /\s+/g,
                            ''
                        );

                    if (
                        name === 'grade 6' ||
                        compact === 'grade6' ||
                        name === 'lớp 6' ||
                        name === 'lop 6' ||
                        code === 'grade6' ||
                        code === 'grade 6'
                    ) {
                        found = category;
                    }
                }
            );

            return found;
        }


        function getPageTopicCategory() {
            questionService
                .getPageTopicCategory(
                    vm.searchTopicCategory,
                    1,
                    100
                )
                .then(
                    function (data) {
                        vm.topicCategories =
                            data &&
                            data.content
                                ? data.content
                                : [];

                        if (
                            vm.topicCategories
                                .length > 0
                        ) {
                            vm.searchTopicDto
                                .topicCategory =
                                findGrade6Category(
                                    vm.topicCategories
                                ) ||
                                vm.topicCategories[0];

                            getTopics();
                        }
                    }
                );
        }


        function getTopics() {
            vm.selectedTopicToCreate = null;

            if (
                !vm.searchTopicDto
                    .topicCategory
            ) {
                vm.topics = [];
                return;
            }

            questionService
                .getTopicsForGames(
                    vm.searchTopicDto,
                    1,
                    10000000
                )
                .then(
                    function (data) {
                        vm.topics =
                            data &&
                            data.content
                                ? data.content
                                : [];
                    }
                );
        }


        /* =====================================================
           CREATE / JOIN
           ===================================================== */

        function createRoom() {
            if (vm.creatingRoom) {
                return;
            }

            if (
                !vm.selectedTopicToCreate ||
                vm.selectedTopicToCreate.id == null
            ) {
                toastr.warning(
                    'Chọn bài từ vựng trước khi tạo phòng.',
                    'BATTLE ONLINE'
                );
                return;
            }

            vm.creatingRoom = true;
            blockUI.start();

            var createDto = {
                topicIds: [
                    vm.selectedTopicToCreate.id
                ],

                topicNames: [
                    vm.selectedTopicToCreate.name ||
                    ''
                ]
            };

            battleService
                .createRoom(
                    createDto
                )
                .then(
                    function (room) {
                        toastr.success(
                            'Đã tạo phòng ' +
                            room.code +
                            '. Server đang nạp bài ở background.',
                            'BATTLE ONLINE'
                        );

                        $state.go(
                            'application.battle_quiz_online_room',
                            {
                                roomCode:
                                    room.code
                            }
                        );
                    },
                    showRequestError
                )
                .finally(
                    function () {
                        vm.creatingRoom = false;
                        blockUI.stop();
                    }
                );
        }


        function joinRoom() {
            var code =
                normalizeRoomCode(
                    vm.roomCodeInput
                );

            if (!code) {
                toastr.warning(
                    'Nhập mã phòng trước.',
                    'BATTLE ONLINE'
                );
                return;
            }

            $state.go(
                'application.battle_quiz_online_room',
                {
                    roomCode: code
                }
            );
        }


        function joinCurrentRouteRoom() {
            var code =
                routeRoomCode();

            if (
                !code ||
                vm.joiningRoom
            ) {
                return;
            }

            vm.joiningRoom = true;
            vm.roomCodeInput = code;

            blockUI.start();

            battleService
                .joinRoom(code)
                .then(
                    function (room) {
                        applyRoom(
                            room,
                            false
                        );

                        connectRealtime(
                            code
                        );
                    },
                    function (error) {
                        showRequestError(
                            error
                        );

                        $state.go(
                            'application.battle_quiz_online'
                        );
                    }
                )
                .finally(
                    function () {
                        vm.joiningRoom = false;
                        blockUI.stop();
                    }
                );
        }


        function leaveRoom() {
            if (!vm.room) {
                $state.go(
                    'application.battle_quiz_online'
                );

                return;
            }

            var code =
                vm.room.code;

            battleService
                .leaveRoom(code)
                .finally(
                    function () {
                        stopRealtimeAndPolling();

                        vm.room = null;

                        $state.go(
                            'application.battle_quiz_online'
                        );
                    }
                );
        }


        /* =====================================================
           REALTIME / POLLING
           ===================================================== */

        function connectRealtime(code) {
            stopPolling();

            vm.connectionMode =
                'CONNECTING';

            battleService
                .connectRealtime(
                    code,

                    function (room) {
                        /*
                         * WebSocket COUNTDOWN là generic:
                         * không có câu private của từng account.
                         */
                        applyRoom(
                            room,
                            true
                        );
                    },

                    function (connected) {
                        vm.realtimeConnected =
                            connected === true;

                        if (connected) {
                            vm.connectionMode =
                                'REALTIME';

                            stopPolling();
                        } else {
                            vm.connectionMode =
                                'POLLING';

                            startPolling();
                        }
                    }
                )
                .then(
                    function (connected) {
                        if (!connected) {
                            vm.connectionMode =
                                'POLLING';

                            startPolling();
                        }
                    }
                );
        }


        function startPolling() {
            if (
                pollingTimer ||
                !vm.room ||
                destroyed
            ) {
                return;
            }

            pollingTimer =
                $interval(
                    function () {
                        if (
                            !vm.room ||
                            destroyed
                        ) {
                            return;
                        }

                        battleService
                            .getRoom(
                                vm.room.code
                            )
                            .then(
                                function (room) {
                                    applyRoom(
                                        room,
                                        false
                                    );
                                },
                                angular.noop
                            );
                    },
                    1000
                );
        }


        function stopPolling() {
            if (pollingTimer) {
                $interval.cancel(
                    pollingTimer
                );

                pollingTimer = null;
            }
        }


        function stopRealtimeAndPolling() {
            battleService
                .disconnectRealtime();

            stopPolling();

            vm.realtimeConnected =
                false;
        }


        function refreshPrivateRoomState() {
            if (
                !vm.room ||
                vm.refreshingPrivateState ||
                destroyed
            ) {
                return;
            }

            vm.refreshingPrivateState =
                true;

            battleService
                .getRoom(
                    vm.room.code
                )
                .then(
                    function (room) {
                        applyRoom(
                            room,
                            false
                        );
                    },
                    angular.noop
                )
                .finally(
                    function () {
                        vm.refreshingPrivateState =
                            false;
                    }
                );
        }


        /* =====================================================
           APPLY ROOM
           ===================================================== */

        function applyRoom(
            incoming,
            fromGenericSocket
        ) {
            if (
                !incoming ||
                !incoming.code
            ) {
                return;
            }

            var previousRoom =
                vm.room;

            var previousQuestion =
                previousRoom &&
                previousRoom.currentQuestion
                    ? previousRoom.currentQuestion
                    : null;

            var previousQuestionId =
                previousQuestion
                    ? previousQuestion.id
                    : null;

            var previousQuestionSequence =
                previousQuestion
                    ? previousQuestion.sequence
                    : null;

            var previousStatus =
                previousRoom
                    ? previousRoom.status
                    : null;

            /*
             * COUNTDOWN websocket broadcast không có câu private.
             * Giữ câu hiện tại của account thay vì bị null.
             */
            if (
                fromGenericSocket === true &&
                incoming.status === 'PLAYING' &&
                incoming.settings &&
                incoming.settings.mode ===
                    'COUNTDOWN' &&
                !incoming.currentQuestion &&
                previousQuestion
            ) {
                incoming.currentQuestion =
                    previousQuestion;

                incoming.currentQuestionIndex =
                    previousRoom
                        .currentQuestionIndex;
            }

            vm.room = incoming;

            if (incoming.serverTime) {
                serverTimeOffset =
                    Number(
                        incoming.serverTime
                    ) -
                    new Date().getTime();
            }

            if (incoming.settings) {
                /*
                 * HOST có thể đang vừa click COUNTDOWN nhưng server
                 * chưa nhận save. Preload background vẫn broadcast room
                 * với mode cũ CLASSIC, nên không được kéo UI về CLASSIC.
                 *
                 * Non-host vẫn luôn nhận mode chính thức từ server.
                 * Khi không có chỉnh sửa local, HOST cũng sync bình thường.
                 */
                if (
                    !isHost() ||
                    incoming.status !== 'LOBBY' ||
                    vm.hostModeDirty !== true
                ) {
                    vm.hostSettings.mode =
                        incoming.settings.mode ||
                        'CLASSIC';
                }

                vm.hostSettings.secondsPerQuestion =
                    incoming.settings
                        .secondsPerQuestion ||
                    vm.hostSettings
                        .secondsPerQuestion;

                if (
                    !vm.hostSettings.countdownMinutesDirty &&
                    incoming.settings.countdownMinutes != null
                ) {
                    vm.hostSettings.countdownMinutes =
                        incoming.settings.countdownMinutes;
                }

                /*
                 * Classic mặc định = toàn bộ bài.
                 * Chỉ auto-set nếu Host chưa tự sửa field.
                 */
                if (
                    isHost() &&
                    incoming.status ===
                        'LOBBY' &&
                    !vm.classicQuestionCountTouched &&
                    incoming.totalLessonWords > 0
                ) {
                    vm.hostSettings.questionCount =
                        incoming.totalLessonWords;
                } else {
                    vm.hostSettings.questionCount =
                        incoming.settings
                            .questionCount ||
                        vm.hostSettings
                            .questionCount;
                }
            }

            var newQuestion =
                incoming.currentQuestion;

            var newQuestionId =
                newQuestion
                    ? newQuestion.id
                    : null;

            var newQuestionSequence =
                newQuestion
                    ? newQuestion.sequence
                    : null;

            if (
                newQuestion &&
                (
                    newQuestionId !==
                        previousQuestionId ||
                    newQuestionSequence !==
                        previousQuestionSequence
                )
            ) {
                vm.answerLocked = false;
                vm.lastAnswerCorrect = null;
                vm.lastAnswerMessage = '';

                sayCurrentQuestion();
            }

            if (
                incoming.status !==
                    'PLAYING'
            ) {
                vm.answerLocked =
                    incoming.status ===
                    'FINISHED';
            }

            /*
             * Người chơi COUNTDOWN vừa nhận broadcast START
             * nhưng generic socket không chứa câu riêng:
             * GET private state đúng 1 lần để lấy câu.
             */
            if (
                incoming.status ===
                    'PLAYING' &&
                incoming.settings &&
                incoming.settings.mode ===
                    'COUNTDOWN' &&
                !incoming.currentQuestion
            ) {
                refreshPrivateRoomState();
            }

            /*
             * Khi vừa chuyển từ lobby sang PLAYING,
             * reset feedback.
             */
            if (
                previousStatus !==
                    'PLAYING' &&
                incoming.status ===
                    'PLAYING'
            ) {
                vm.lastAnswerCorrect = null;
                vm.lastAnswerMessage = '';
            }

            updateCountdown();
        }


        /* =====================================================
           MODE SETTINGS
           ===================================================== */

        function selectMode(mode) {
            if (!isHost()) {
                return;
            }

            vm.hostSettings.mode =
                mode === 'COUNTDOWN'
                    ? 'COUNTDOWN'
                    : 'CLASSIC';

            /*
             * Giữ lựa chọn này qua các room update do lazy preload.
             * Save/Start sẽ gửi mode lên server và clear flag.
             */
            vm.hostModeDirty = true;
        }


        function markClassicQuestionCountTouched() {
            vm.classicQuestionCountTouched =
                true;
        }


        function clampInteger(
            value,
            min,
            max,
            fallback
        ) {
            value =
                parseInt(
                    value,
                    10
                );

            if (isNaN(value)) {
                value = fallback;
            }

            return Math.min(
                max,
                Math.max(
                    min,
                    value
                )
            );
        }


        function buildSettingsDto() {
            return {
                mode:
                    vm.hostSettings.mode ===
                    'COUNTDOWN'
                        ? 'COUNTDOWN'
                        : 'CLASSIC',

                questionCount:
                    clampInteger(
                        vm.hostSettings
                            .questionCount,
                        1,
                        5000,
                        vm.room &&
                        vm.room.totalLessonWords
                            ? vm.room
                                .totalLessonWords
                            : 20
                    ),

                secondsPerQuestion:
                    clampInteger(
                        vm.hostSettings
                            .secondsPerQuestion,
                        3,
                        120,
                        10
                    ),

                countdownMinutes:
                    clampInteger(
                        vm.hostSettings
                            .countdownMinutes,
                        1,
                        180,
                        5
                    )
            };
        }


        function saveSettings(silent) {
            if (
                !vm.room ||
                !isHost() ||
                vm.savingSettings
            ) {
                return null;
            }

            vm.savingSettings =
                true;

            var promise =
                battleService
                    .updateSettings(
                        vm.room.code,
                        buildSettingsDto()
                    );

            promise
                .then(
                    function (room) {
                        /*
                         * Server đã nhận mode mới, từ đây có thể sync
                         * room.settings.mode trở lại bình thường.
                         */
                        vm.hostModeDirty = false;
                        vm.hostSettings.countdownMinutesDirty = false;

                        applyRoom(
                            room,
                            false
                        );

                        if (
                            silent !==
                            true
                        ) {
                            toastr.success(
                                'Đã lưu chế độ chơi.',
                                'BATTLE ONLINE'
                            );
                        }
                    },
                    showRequestError
                )
                .finally(
                    function () {
                        vm.savingSettings =
                            false;
                    }
                );

            return promise;
        }


        /* =====================================================
           READY / START
           ===================================================== */

        function toggleReady() {
            var me =
                getMe();

            if (
                !vm.room ||
                !me ||
                me.host
            ) {
                return;
            }

            battleService
                .setReady(
                    vm.room.code,
                    me.ready !==
                        true
                )
                .then(
                    function (room) {
                        applyRoom(
                            room,
                            false
                        );
                    },
                    showRequestError
                );
        }


        function startMatch() {
            if (
                !vm.room ||
                !isHost() ||
                vm.startingMatch
            ) {
                return;
            }

            if (!vm.room.questionsReady) {
                toastr.warning(
                    'Server chưa READY đủ 4 từ để tạo đáp án.',
                    'BATTLE ONLINE'
                );

                return;
            }

            var settingsPromise =
                saveSettings(true);

            if (!settingsPromise) {
                return;
            }

            vm.startingMatch =
                true;

            settingsPromise
                .then(
                    function () {
                        return battleService
                            .startMatch(
                                vm.room.code
                            );
                    }
                )
                .then(
                    function (room) {
                        applyRoom(
                            room,
                            false
                        );
                    },
                    showRequestError
                )
                .finally(
                    function () {
                        vm.startingMatch =
                            false;
                    }
                );
        }


        function restartMatch() {
            if (
                !vm.room ||
                !isHost()
            ) {
                return;
            }

            battleService
                .restartMatch(
                    vm.room.code
                )
                .then(
                    function (room) {
                        vm.classicQuestionCountTouched =
                            false;

                        vm.hostModeDirty =
                            false;

                        applyRoom(
                            room,
                            false
                        );
                    },
                    showRequestError
                );
        }


        /* =====================================================
           ANSWER
           ===================================================== */

        function answer(option) {
            if (
                !vm.room ||
                vm.room.status !==
                    'PLAYING' ||
                !vm.room.currentQuestion ||
                !option ||
                vm.answerLocked
            ) {
                return;
            }

            if (
                isCountdownMode() &&
                vm.countdown <= 0
            ) {
                return;
            }

            vm.answerLocked =
                true;

            var question =
                vm.room.currentQuestion;

            battleService
                .answer(
                    vm.room.code,
                    question.id,
                    option.key,
                    question.sequence
                )
                .then(
                    function (result) {
                        /*
                         * COUNTDOWN server trả room private
                         * chứa câu random tiếp theo.
                         */
                        if (result.room) {
                            applyRoom(
                                result.room,
                                false
                            );
                        }

                        vm.lastAnswerCorrect =
                            result.correct ===
                            true;

                        vm.lastAnswerMessage =
                            result.message ||
                            (
                                result.correct
                                    ? 'CHÍNH XÁC!'
                                    : 'SAI RỒI!'
                            );

                        /*
                         * CLASSIC chờ tất cả / timer.
                         * COUNTDOWN đã nhận câu tiếp nên mở khóa.
                         */
                        if (
                            isCountdownMode() &&
                            vm.room &&
                            vm.room.currentQuestion
                        ) {
                            vm.answerLocked =
                                false;
                        }
                    },
                    function (error) {
                        showRequestError(
                            error
                        );

                        if (
                            isCountdownMode()
                        ) {
                            refreshPrivateRoomState();
                        }
                    }
                );
        }


        /* =====================================================
           TIMER
           ===================================================== */

        function updateCountdown() {
            if (
                !vm.room ||
                vm.room.status !==
                    'PLAYING'
            ) {
                vm.countdown = 0;
                return;
            }

            var serverNow =
                new Date().getTime() +
                serverTimeOffset;

            var endAt =
                isCountdownMode()
                    ? Number(
                        vm.room.matchEndsAt ||
                        0
                    )
                    : Number(
                        vm.room.questionEndsAt ||
                        0
                    );

            if (!endAt) {
                vm.countdown = 0;
                return;
            }

            vm.countdown =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            endAt -
                            serverNow
                        ) /
                        1000
                    )
                );

            if (
                vm.countdown <= 0
            ) {
                vm.answerLocked =
                    true;
            }
        }


        function getPreloadPercent() {
            if (
                !vm.room ||
                !vm.room.totalLessonWords ||
                vm.room.totalLessonWords <= 0
            ) {
                return 8;
            }

            var percent =
                (
                    Number(
                        vm.room.loadedQuestionCount ||
                        0
                    ) /
                    Number(
                        vm.room.totalLessonWords
                    )
                ) * 100;

            return Math.max(
                0,
                Math.min(
                    100,
                    percent
                )
            );
        }


        function formatTime(seconds) {
            seconds =
                Math.max(
                    0,
                    parseInt(
                        seconds,
                        10
                    ) || 0
                );

            var minutes =
                Math.floor(
                    seconds / 60
                );

            var rest =
                seconds % 60;

            return (
                minutes +
                ':' +
                (
                    rest < 10
                        ? '0'
                        : ''
                ) +
                rest
            );
        }


        /* =====================================================
           SPEECH / COPY
           ===================================================== */

        function sayCurrentQuestion() {
            if (
                !vm.room ||
                !vm.room.currentQuestion ||
                !vm.room.currentQuestion
                    .question ||
                !$window.speechSynthesis
            ) {
                return;
            }

            try {
                $window.speechSynthesis
                    .cancel();

                var utterance =
                    new SpeechSynthesisUtterance(
                        vm.room
                            .currentQuestion
                            .question
                    );

                utterance.lang =
                    'en-US';

                utterance.rate =
                    1;

                $window.speechSynthesis
                    .speak(
                        utterance
                    );
            } catch (e) {
                // Speech không được ảnh hưởng game.
            }
        }


        function copyRoomLink() {
            if (!vm.room) {
                return;
            }

            var link =
                $window.location.origin +
                '/battle-quiz-online/' +
                vm.room.code;

            if (
                $window.navigator &&
                $window.navigator.clipboard &&
                angular.isFunction(
                    $window.navigator
                        .clipboard
                        .writeText
                )
            ) {
                $window.navigator
                    .clipboard
                    .writeText(link)
                    .then(
                        function () {
                            toastr.success(
                                'Đã copy link phòng.'
                            );
                        }
                    );

                return;
            }

            var temp =
                $window.document
                    .createElement(
                        'textarea'
                    );

            temp.value =
                link;

            $window.document.body
                .appendChild(
                    temp
                );

            temp.select();

            try {
                $window.document
                    .execCommand(
                        'copy'
                    );

                toastr.success(
                    'Đã copy link phòng.'
                );
            } catch (e) {
                toastr.info(
                    link
                );
            }

            $window.document.body
                .removeChild(
                    temp
                );
        }


        function getPlayerClass(player) {
            if (!player) {
                return '';
            }

            if (player.rank === 1) {
                return 'is-rank-1';
            }

            if (player.rank === 2) {
                return 'is-rank-2';
            }

            if (player.rank === 3) {
                return 'is-rank-3';
            }

            return '';
        }


        function showRequestError(error) {
            var message =
                error &&
                error.data &&
                error.data.message
                    ? error.data.message
                    : 'Không thể thực hiện thao tác.';

            toastr.error(
                message,
                'BATTLE ONLINE'
            );
        }


        /* =====================================================
           KEYBOARD
           ===================================================== */

        function keydownHandler(event) {
            if (
                !vm.room ||
                vm.room.status !==
                    'PLAYING' ||
                !vm.room.currentQuestion ||
                vm.answerLocked
            ) {
                return;
            }

            var target =
                event.target ||
                event.srcElement;

            if (
                target &&
                (
                    target.tagName ===
                        'INPUT' ||
                    target.tagName ===
                        'TEXTAREA' ||
                    target.tagName ===
                        'SELECT'
                )
            ) {
                return;
            }

            var key =
                String(
                    event.key || ''
                ).toUpperCase();

            var map = {
                '1': 0,
                '2': 1,
                '3': 2,
                '4': 3,
                'A': 0,
                'B': 1,
                'C': 2,
                'D': 3
            };

            if (
                !map.hasOwnProperty(
                    key
                )
            ) {
                return;
            }

            var option =
                vm.room
                    .currentQuestion
                    .answers[
                        map[key]
                    ];

            if (!option) {
                return;
            }

            event.preventDefault();

            $scope.$evalAsync(
                function () {
                    answer(option);
                }
            );
        }


        angular.element(
            $window.document
        ).on(
            'keydown',
            keydownHandler
        );


        /* =====================================================
           INIT / DESTROY
           ===================================================== */

        countdownTimer =
            $interval(
                updateCountdown,
                250
            );

        $scope.$on(
            '$destroy',
            function () {
                destroyed = true;

                stopRealtimeAndPolling();

                if (countdownTimer) {
                    $interval.cancel(
                        countdownTimer
                    );

                    countdownTimer =
                        null;
                }

                angular.element(
                    $window.document
                ).off(
                    'keydown',
                    keydownHandler
                );

                try {
                    if (
                        $window.speechSynthesis
                    ) {
                        $window
                            .speechSynthesis
                            .cancel();
                    }
                } catch (e) {
                    // Ignore cleanup.
                }
            }
        );

        getPageTopicCategory();

        if (routeRoomCode()) {
            $timeout(
                joinCurrentRouteRoom,
                0
            );
        }
    }
})();
