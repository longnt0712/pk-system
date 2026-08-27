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
        vm.changingSpectator = false;
        vm.kickingPlayer = false;

        vm.realtimeConnected = false;
        vm.connectionMode = 'CONNECTING';

        vm.answerLocked = false;
        vm.lastAnswerCorrect = null;
        vm.lastAnswerMessage = '';

        vm.usingSkill = false;
        vm.availableSkillTargets = [];
        vm.skillTargetModalOpen = false;
        vm.personalSkillNotice = null;
        vm.skillHitEffect = null;
        vm.rankingModalOpen = false;
        vm.skillActivityModalOpen = false;
        vm.wrongQuestionsModalOpen = false;
        vm.wrongQuestions = [];
        vm.kickConfirmModalOpen = false;
        vm.playerToKick = null;
        vm.qrModalOpen = false;
        vm.scannerModalOpen = false;
        vm.roomLink = '';
        vm.qrImageUrl = '';
        vm.cameraStarting = false;
        vm.cameraError = '';
        vm.cameraActive = false;
        vm.cameraAwaitingPermission = true;
        vm.cameraZoomSupported = false;
        vm.cameraZoom = 1;
        vm.cameraZoomMin = 1;
        vm.cameraZoomMax = 1;
        vm.cameraZoomStep = 0.1;

        /*
         * CLASSIC: số giây của câu hiện tại.
         * COUNTDOWN: tổng số giây còn lại của trận.
         */
        vm.countdown = 0;

        vm.topicCategories = [];
        vm.topics = [];
        vm.topicOwners = [];
        vm.selectedTopicOwner = null;

        /*
         * Có thể gom nhiều bài từ nhiều category trước khi CREATE ROOM.
         * selectedTopicToCreate chỉ là bài đang đứng trong ô chọn.
         */
        vm.selectedTopicToCreate = null;
        vm.selectedTopicsToCreate = [];

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
        vm.hostCountdownMinutesDirty = false;

        vm.currentUser =
            readCurrentUser();

        vm.currentUserDisplayName =
            getFullName(
                vm.currentUser
            );

        vm.topicOwners = buildTopicOwners();
        vm.selectedTopicOwner = vm.topicOwners.length
            ? vm.topicOwners[0]
            : null;

        vm.searchTopicDto.userId =
            vm.selectedTopicOwner
                ? vm.selectedTopicOwner.id
                : vm.currentUser.id;

        var pollingTimer = null;
        var countdownTimer = null;
        var skillHitEffectTimer = null;
        var qrScanner = null;
        var qrScannerRunning = false;
        var qrScanHandled = false;
        var qrZoomApplyTimer = null;
        var destroyed = false;

        /*
         * Đồng bộ clock client/server.
         */
        var serverTimeOffset = 0;
        var lastSeenEventId = 0;
        var activeWrongQuestionMatchKey = '';
        var kickedNavigationHandled = false;


        /* =====================================================
           EXPOSE
           ===================================================== */

        vm.isHost = isHost;
        vm.isSpectator = isSpectator;
        vm.canKickPlayer = canKickPlayer;
        vm.me = getMe;

        vm.createRoom = createRoom;
        vm.joinRoom = joinRoom;
        vm.leaveRoom = leaveRoom;

        vm.getTopics = getTopics;
        vm.chooseTopicOwner = chooseTopicOwner;
        vm.addTopicToCreate = addTopicToCreate;
        vm.removeTopicToCreate = removeTopicToCreate;
        vm.formatTopicNames = formatTopicNames;

        vm.selectMode = selectMode;
        vm.markClassicQuestionCountTouched =
            markClassicQuestionCountTouched;
        vm.markCountdownMinutesTouched =
            markCountdownMinutesTouched;

        vm.saveSettings = saveSettings;

        vm.toggleReady = toggleReady;
        vm.toggleSpectator = toggleSpectator;
        vm.openKickConfirm = openKickConfirm;
        vm.closeKickConfirm = closeKickConfirm;
        vm.confirmKickPlayer = confirmKickPlayer;
        vm.getActivePlayerCount = getActivePlayerCount;
        vm.getSpectatorCount = getSpectatorCount;
        vm.startMatch = startMatch;
        vm.restartMatch = restartMatch;

        vm.answer = answer;
        vm.useSkill = useSkill;
        vm.getSkillLabel = getSkillLabel;
        vm.getSkillIcon = getSkillIcon;
        vm.isMeFrozen = isMeFrozen;
        vm.getFreezeRemaining = getFreezeRemaining;
        vm.isMeBurning = isMeBurning;
        vm.isPlayerBurning = isPlayerBurning;
        vm.getBurnRemaining = getBurnRemaining;
        vm.dismissPersonalSkillNotice = dismissPersonalSkillNotice;
        vm.getPlayerDisplayName = getPlayerDisplayName;
        vm.getSkillEventMessage = getSkillEventMessage;
        vm.getActiveSkillEffectType = getActiveSkillEffectType;
        vm.getActiveSkillEffectIcon = getActiveSkillEffectIcon;
        vm.getActiveSkillEffectTitle = getActiveSkillEffectTitle;
        vm.getActiveSkillEffectActor = getActiveSkillEffectActor;
        vm.openRankingModal = openRankingModal;
        vm.closeRankingModal = closeRankingModal;
        vm.openSkillActivityModal = openSkillActivityModal;
        vm.closeSkillActivityModal = closeSkillActivityModal;
        vm.openWrongQuestionsModal = openWrongQuestionsModal;
        vm.closeWrongQuestionsModal = closeWrongQuestionsModal;
        vm.openQrModal = openQrModal;
        vm.closeQrModal = closeQrModal;
        vm.openScannerModal = openScannerModal;
        vm.closeScannerModal = closeScannerModal;
        vm.requestCameraAccess = requestCameraAccess;
        vm.applyCameraZoom = applyCameraZoom;
        vm.formatScore = formatScore;

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

            var displayName = String(
                user && user.displayName || ''
            ).trim();

            var username = String(
                user && user.username || ''
            ).trim();

            return displayName &&
                displayName.toLowerCase() !== username.toLowerCase()
                    ? displayName
                    : 'Người chơi';
        }


        function getPlayerDisplayName(player) {
            var displayName = String(
                player && player.displayName || ''
            ).trim();

            var username = String(
                player && player.username || ''
            ).trim();

            if (
                displayName &&
                displayName.toLowerCase() !== username.toLowerCase()
            ) {
                return displayName;
            }

            if (
                username &&
                username === vm.currentUser.username &&
                vm.currentUserDisplayName !== 'Người chơi'
            ) {
                return vm.currentUserDisplayName;
            }

            return 'Người chơi';
        }


        function buildTopicOwners() {
            var owners = [];
            var currentUserId = vm.currentUser && vm.currentUser.id;

            if (currentUserId != null) {
                owners.push({
                    id: currentUserId,
                    name: currentUserId == 26
                        ? 'EM YÊU INH LÍCH — TỪ CỦA TÔI'
                        : 'TỪ CỦA TÔI'
                });
            }

            if (String(currentUserId || '') !== '26') {
                owners.push({
                    id: 26,
                    name: 'EM YÊU INH LÍCH'
                });
            }

            return owners;
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


        function isSpectator() {
            var me = getMe();

            return !!(
                me &&
                me.spectator === true
            );
        }


        function canKickPlayer(player) {
            return !!(
                isHost() &&
                vm.room &&
                (
                    vm.room.status === 'LOBBY' ||
                    vm.room.status === 'PLAYING'
                ) &&
                player &&
                player.username &&
                player.username !== vm.currentUser.username &&
                player.host !== true
            );
        }


        function getActivePlayerCount() {
            var count = 0;

            angular.forEach(
                (vm.room && vm.room.players) || [],
                function (player) {
                    if (player && player.spectator !== true) {
                        count += 1;
                    }
                }
            );

            return count;
        }


        function getSpectatorCount() {
            var count = 0;

            angular.forEach(
                (vm.room && vm.room.players) || [],
                function (player) {
                    if (player && player.spectator === true) {
                        count += 1;
                    }
                }
            );

            return count;
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


        function chooseTopicOwner() {
            vm.searchTopicDto.userId =
                vm.selectedTopicOwner
                    ? vm.selectedTopicOwner.id
                    : vm.currentUser.id;

            vm.selectedTopicToCreate = null;
            vm.selectedTopicsToCreate = [];
            vm.topics = [];

            getTopics();
        }


        function addTopicToCreate() {
            var topic = vm.selectedTopicToCreate;

            if (!topic || topic.id == null) {
                toastr.warning(
                    'Chọn một bài rồi bấm THÊM BÀI.',
                    'BATTLE ONLINE'
                );
                return;
            }

            var duplicate = false;

            angular.forEach(
                vm.selectedTopicsToCreate,
                function (selected) {
                    if (
                        selected &&
                        String(selected.id) === String(topic.id)
                    ) {
                        duplicate = true;
                    }
                }
            );

            if (duplicate) {
                toastr.info(
                    'Bài này đã có trong danh sách.',
                    'BATTLE ONLINE'
                );
                vm.selectedTopicToCreate = null;
                return;
            }

            var category =
                vm.searchTopicDto.topicCategory || {};

            var owner =
                vm.selectedTopicOwner || {};

            vm.selectedTopicsToCreate.push({
                id: topic.id,
                name: topic.name || '',
                ownerId: owner.id,
                ownerName: owner.name || 'TỪ CỦA TÔI',
                categoryId: category.id,
                categoryName: category.name || '',
                displayName:
                    (owner.name
                        ? owner.name + ' — '
                        : '') +
                    (category.name
                        ? category.name + ' — '
                        : '') +
                    (topic.name || 'Bài từ vựng')
            });

            vm.selectedTopicToCreate = null;
        }


        function removeTopicToCreate(topic) {
            if (!topic) {
                return;
            }

            for (
                var index = vm.selectedTopicsToCreate.length - 1;
                index >= 0;
                index -= 1
            ) {
                if (
                    String(vm.selectedTopicsToCreate[index].id) ===
                    String(topic.id)
                ) {
                    vm.selectedTopicsToCreate.splice(index, 1);
                }
            }
        }


        function formatTopicNames(topicNames) {
            var names = topicNames || [];

            return names.length
                ? names.join(' • ')
                : 'Bài từ vựng';
        }


        /* =====================================================
           CREATE / JOIN
           ===================================================== */

        function createRoom() {
            if (vm.creatingRoom) {
                return;
            }

            if (
                !vm.selectedTopicsToCreate ||
                vm.selectedTopicsToCreate.length === 0
            ) {
                toastr.warning(
                    'Thêm ít nhất một bài từ vựng trước khi tạo phòng.',
                    'BATTLE ONLINE'
                );
                return;
            }

            vm.creatingRoom = true;
            blockUI.start();

            var createDto = {
                topicIds: [],
                topicNames: [],
                questionOwnerUserId:
                    vm.selectedTopicOwner
                        ? vm.selectedTopicOwner.id
                        : vm.currentUser.id
            };

            angular.forEach(
                vm.selectedTopicsToCreate,
                function (topic) {
                    if (!topic || topic.id == null) {
                        return;
                    }

                    createDto.topicIds.push(topic.id);
                    createDto.topicNames.push(
                        topic.displayName ||
                        topic.name ||
                        ''
                    );
                }
            );

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
                        vm.rankingModalOpen = false;
                        vm.skillActivityModalOpen = false;
                        vm.wrongQuestionsModalOpen = false;
                        vm.kickConfirmModalOpen = false;
                        vm.playerToKick = null;
                        vm.wrongQuestions = [];
                        activeWrongQuestionMatchKey = '';

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
                                function (error) {
                                    if (
                                        error &&
                                        error.status === 403
                                    ) {
                                        handleKickedFromRoom();
                                    }
                                }
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
                    function (error) {
                        if (
                            error &&
                            error.status === 403
                        ) {
                            handleKickedFromRoom();
                        }
                    }
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

        function roomContainsCurrentUser(room) {
            var found = false;

            angular.forEach(
                (room && room.players) || [],
                function (player) {
                    if (
                        player &&
                        player.username === vm.currentUser.username
                    ) {
                        found = true;
                    }
                }
            );

            return found;
        }


        function handleKickedFromRoom() {
            if (kickedNavigationHandled || destroyed) {
                return;
            }

            kickedNavigationHandled = true;

            stopRealtimeAndPolling();

            vm.room = null;
            vm.rankingModalOpen = false;
            vm.skillActivityModalOpen = false;
            vm.wrongQuestionsModalOpen = false;
            vm.skillTargetModalOpen = false;
            vm.kickConfirmModalOpen = false;
            vm.playerToKick = null;

            toastr.warning(
                'HOST đã kích bạn khỏi phòng.',
                'BATTLE ONLINE'
            );

            $state.go(
                'application.battle_quiz_online'
            );
        }

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

            if (
                previousRoom &&
                previousRoom.code === incoming.code &&
                !roomContainsCurrentUser(incoming)
            ) {
                handleKickedFromRoom();
                return;
            }

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

            /*
             * pendingSkillType cũng là state riêng của account.
             * Broadcast generic không được làm mất popup chọn mục tiêu.
             */
            if (
                fromGenericSocket === true &&
                incoming.status === 'PLAYING' &&
                incoming.settings &&
                incoming.settings.mode === 'COUNTDOWN' &&
                !incoming.pendingSkillType &&
                previousRoom &&
                previousRoom.pendingSkillType
            ) {
                incoming.pendingSkillType =
                    previousRoom.pendingSkillType;
            }

            /*
             * Danh sách 4 mục tiêu là state riêng do backend random.
             * Generic WebSocket không được làm mất danh sách đang hiện
             * trong modal của account hiện tại.
             */
            if (
                fromGenericSocket === true &&
                incoming.status === 'PLAYING' &&
                incoming.settings &&
                incoming.settings.mode === 'COUNTDOWN' &&
                incoming.pendingSkillType &&
                (
                    !incoming.pendingSkillTargetUsernames ||
                    !incoming.pendingSkillTargetUsernames.length
                ) &&
                previousRoom &&
                previousRoom.pendingSkillTargetUsernames &&
                previousRoom.pendingSkillTargetUsernames.length
            ) {
                incoming.pendingSkillTargetUsernames =
                    previousRoom.pendingSkillTargetUsernames.slice(0);
            }

            vm.room = incoming;

            vm.availableSkillTargets = [];

            var playersByUsername = {};

            angular.forEach(
                incoming.players || [],
                function (player) {
                    if (
                        player &&
                        player.username
                    ) {
                        playersByUsername[player.username] = player;
                    }
                }
            );

            angular.forEach(
                incoming.pendingSkillTargetUsernames || [],
                function (targetUsername) {
                    var target = playersByUsername[targetUsername];

                    if (
                        target &&
                        target.connected === true &&
                        target.spectator !== true &&
                        target.username !== vm.currentUser.username
                    ) {
                        vm.availableSkillTargets.push(target);
                    }
                }
            );

            vm.skillTargetModalOpen =
                incoming.status === 'PLAYING' &&
                !isSpectator() &&
                !!incoming.pendingSkillType;

            processSkillEvents(incoming.recentEvents || []);

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
                    !isHost() ||
                    incoming.status !== 'LOBBY' ||
                    vm.hostCountdownMinutesDirty !== true
                ) {
                    vm.hostSettings.countdownMinutes =
                        incoming.settings
                            .countdownMinutes ||
                        vm.hostSettings
                            .countdownMinutes;
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
                !incoming.currentQuestion &&
                !incoming.pendingSkillType &&
                !isSpectator()
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
                prepareWrongQuestionHistory(incoming);
                vm.lastAnswerCorrect = null;
                vm.lastAnswerMessage = '';
                vm.personalSkillNotice = null;
                clearSkillHitEffect();
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


        function markCountdownMinutesTouched() {
            vm.hostCountdownMinutesDirty = true;
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
                        vm.hostCountdownMinutesDirty = false;

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


        function toggleSpectator() {
            var me = getMe();

            if (
                !vm.room ||
                vm.room.status !== 'LOBBY' ||
                !isHost() ||
                !me ||
                vm.changingSpectator
            ) {
                return;
            }

            vm.changingSpectator = true;

            battleService
                .setSpectator(
                    vm.room.code,
                    me.spectator !== true
                )
                .then(
                    function (room) {
                        applyRoom(room, false);

                        toastr.success(
                            isSpectator()
                                ? 'Bạn đang ở chế độ khán giả.'
                                : 'Bạn đã trở lại chế độ người chơi.',
                            'BATTLE ONLINE'
                        );
                    },
                    showRequestError
                )
                .finally(
                    function () {
                        vm.changingSpectator = false;
                    }
                );
        }


        function openKickConfirm(player) {
            if (!canKickPlayer(player)) {
                return;
            }

            vm.playerToKick = player;
            vm.kickConfirmModalOpen = true;
        }


        function closeKickConfirm() {
            if (vm.kickingPlayer) {
                return;
            }

            vm.kickConfirmModalOpen = false;
            vm.playerToKick = null;
        }


        function confirmKickPlayer() {
            var target = vm.playerToKick;

            if (
                !canKickPlayer(target) ||
                vm.kickingPlayer
            ) {
                return;
            }

            vm.kickingPlayer = true;

            battleService
                .kickPlayer(
                    vm.room.code,
                    target.username
                )
                .then(
                    function (room) {
                        var name = getPlayerDisplayName(target);

                        vm.kickConfirmModalOpen = false;
                        vm.playerToKick = null;

                        applyRoom(room, false);

                        toastr.success(
                            'Đã kích ' + name + ' khỏi phòng.',
                            'BATTLE ONLINE'
                        );
                    },
                    showRequestError
                )
                .finally(
                    function () {
                        vm.kickingPlayer = false;
                    }
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

                        vm.hostCountdownMinutesDirty =
                            false;

                        vm.personalSkillNotice =
                            null;

                        lastSeenEventId = 0;

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
                vm.answerLocked ||
                vm.room.pendingSkillType ||
                isSpectator() ||
                isMeFrozen()
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
                        if (
                            isCountdownMode() &&
                            result.correct !== true
                        ) {
                            rememberWrongQuestion(
                                question,
                                result
                            );
                        }

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
                        vm.answerLocked = false;

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


        function useSkill(player) {
            if (
                !vm.room ||
                !vm.room.pendingSkillType ||
                vm.usingSkill ||
                !player ||
                !player.username
            ) {
                return;
            }

            vm.usingSkill = true;

            battleService
                .useSkill(
                    vm.room.code,
                    player && player.username
                )
                .then(
                    function (room) {
                        applyRoom(room, false);
                    },
                    function (error) {
                        showRequestError(error);
                        refreshPrivateRoomState();
                    }
                )
                .finally(
                    function () {
                        vm.usingSkill = false;
                    }
                );
        }


        function getSkillLabel(type) {
            if (type === 'FREEZE') {
                return 'ĐÓNG BĂNG 3 GIÂY';
            }

            if (type === 'BREAK_STREAK') {
                return 'PHÁ STREAK';
            }

            if (type === 'STEAL_SCORE') {
                return 'CƯỚP 5% ĐIỂM';
            }

            if (type === 'FIRE_UP') {
                return 'CHÁY LÊN x1.2 TRONG 15 GIÂY';
            }

            return 'SKILL';
        }


        function getSkillIcon(type) {
            if (type === 'FREEZE') {
                return '❄️';
            }

            if (type === 'BREAK_STREAK') {
                return '💥';
            }

            if (type === 'STEAL_SCORE') {
                return '💰';
            }

            if (type === 'FIRE_UP') {
                return '🔥';
            }

            return '⚡';
        }


        function serverNow() {
            return new Date().getTime() + serverTimeOffset;
        }


        function isMeFrozen() {
            var me = getMe();

            return !!(
                me &&
                Number(me.frozenUntil || 0) > serverNow()
            );
        }


        function getFreezeRemaining() {
            var me = getMe();

            if (!me) {
                return 0;
            }

            return Math.max(
                0,
                Math.ceil(
                    (
                        Number(me.frozenUntil || 0) -
                        serverNow()
                    ) / 1000
                )
            );
        }


        function isPlayerBurning(player) {
            return !!(
                player &&
                Number(player.burningUntil || 0) > serverNow()
            );
        }


        function isMeBurning() {
            return isPlayerBurning(getMe());
        }


        function getBurnRemaining() {
            var me = getMe();

            if (!me) {
                return 0;
            }

            return Math.max(
                0,
                Math.ceil(
                    (
                        Number(me.burningUntil || 0) -
                        serverNow()
                    ) / 1000
                )
            );
        }


        function processSkillEvents(events) {
            var newestId = lastSeenEventId;

            for (var index = events.length - 1; index >= 0; index -= 1) {
                var event = events[index];
                var eventId = Number(event && event.id || 0);

                if (eventId <= lastSeenEventId) {
                    continue;
                }

                newestId = Math.max(newestId, eventId);

                if (
                    event.targetUsername === vm.currentUser.username &&
                    event.actorUsername !== vm.currentUser.username
                ) {
                    vm.personalSkillNotice = {
                        id: eventId,
                        icon: getSkillIcon(event.type),
                        message: buildPersonalSkillMessage(event)
                    };

                    showSkillHitEffect(event);
                }
            }

            lastSeenEventId = newestId;
        }


        function buildPersonalSkillMessage(event) {
            var actor =
                safeEventName(
                    event.actorDisplayName,
                    event.actorUsername,
                    'Một người chơi'
                );

            if (event.type === 'FREEZE') {
                return actor + ' vừa đóng băng bạn trong 3 giây.';
            }

            if (event.type === 'BREAK_STREAK') {
                return actor + ' vừa phá streak của bạn.';
            }

            return actor + ' vừa cướp ' +
                formatScore(event.amount) +
                ' điểm của bạn.';
        }


        function dismissPersonalSkillNotice() {
            vm.personalSkillNotice = null;
        }


        function safeEventName(displayName, username, fallback) {
            displayName = String(displayName || '').trim();
            username = String(username || '').trim();

            return displayName &&
                displayName.toLowerCase() !== username.toLowerCase()
                    ? displayName
                    : fallback;
        }


        function getSkillEventMessage(event) {
            event = event || {};

            var actor = safeEventName(
                event.actorDisplayName,
                event.actorUsername,
                'Một người chơi'
            );

            var target = safeEventName(
                event.targetDisplayName,
                event.targetUsername,
                'người chơi khác'
            );

            if (event.type === 'FREEZE') {
                return actor + ' vừa đóng băng ' + target + ' trong 3 giây.';
            }

            if (event.type === 'BREAK_STREAK') {
                return actor + ' vừa phá streak của ' + target + '.';
            }

            if (event.type === 'STEAL_SCORE') {
                return actor + ' vừa cướp ' +
                    formatScore(event.amount) + ' điểm của ' + target + '.';
            }

            return actor + ' vừa kích hoạt CHÁY LÊN x1.2 trong 15 giây.';
        }


        function clearSkillHitEffect() {
            if (skillHitEffectTimer) {
                $timeout.cancel(skillHitEffectTimer);
                skillHitEffectTimer = null;
            }

            vm.skillHitEffect = null;
        }


        function showSkillHitEffect(event) {
            clearSkillHitEffect();

            vm.skillHitEffect = {
                id: event.id,
                type: event.type,
                amount: event.amount,
                actorName: safeEventName(
                    event.actorDisplayName,
                    event.actorUsername,
                    'Một người chơi'
                )
            };

            var duration = event.type === 'FREEZE'
                ? Math.max(3200, getFreezeRemaining() * 1000 + 350)
                : 2200;

            skillHitEffectTimer = $timeout(
                function () {
                    vm.skillHitEffect = null;
                    skillHitEffectTimer = null;
                },
                duration
            );
        }


        function getActiveSkillEffectType() {
            return isMeFrozen()
                ? 'FREEZE'
                : vm.skillHitEffect && vm.skillHitEffect.type || '';
        }


        function getActiveSkillEffectIcon() {
            return getSkillIcon(getActiveSkillEffectType());
        }


        function getActiveSkillEffectTitle() {
            var type = getActiveSkillEffectType();

            if (type === 'FREEZE') {
                return 'ĐÓNG BĂNG';
            }

            if (type === 'BREAK_STREAK') {
                return 'STREAK BỊ PHÁ';
            }

            if (type === 'STEAL_SCORE') {
                return 'BỊ CƯỚP ' + formatScore(
                    vm.skillHitEffect && vm.skillHitEffect.amount
                ) + ' ĐIỂM';
            }

            return 'TRÚNG SKILL';
        }


        function getActiveSkillEffectActor() {
            return vm.skillHitEffect && vm.skillHitEffect.actorName
                ? vm.skillHitEffect.actorName + ' vừa dùng skill lên bạn'
                : '';
        }


        function openRankingModal() {
            vm.rankingModalOpen = true;
        }


        function closeRankingModal() {
            vm.rankingModalOpen = false;
        }


        function openSkillActivityModal() {
            vm.skillActivityModalOpen = true;
        }


        function closeSkillActivityModal() {
            vm.skillActivityModalOpen = false;
        }


        function openWrongQuestionsModal() {
            vm.wrongQuestionsModalOpen = true;
        }


        function closeWrongQuestionsModal() {
            vm.wrongQuestionsModalOpen = false;
        }


        function getWrongQuestionMatchKey(room) {
            if (
                !room ||
                !room.code ||
                !room.matchEndsAt ||
                !vm.currentUser.username
            ) {
                return '';
            }

            return [
                'battle-online-wrong-questions',
                room.code,
                vm.currentUser.username,
                room.matchEndsAt
            ].join(':');
        }


        function prepareWrongQuestionHistory(room) {
            var matchKey = getWrongQuestionMatchKey(room);

            if (!matchKey || matchKey === activeWrongQuestionMatchKey) {
                return;
            }

            activeWrongQuestionMatchKey = matchKey;
            vm.wrongQuestions = [];
            vm.skillActivityModalOpen = false;
            vm.wrongQuestionsModalOpen = false;

            try {
                var saved = $window.sessionStorage.getItem(matchKey);
                var parsed = saved ? angular.fromJson(saved) : [];

                if (angular.isArray(parsed)) {
                    vm.wrongQuestions = parsed;
                }
            } catch (e) {
                vm.wrongQuestions = [];
            }
        }


        function saveWrongQuestionHistory() {
            if (!activeWrongQuestionMatchKey) {
                return;
            }

            try {
                $window.sessionStorage.setItem(
                    activeWrongQuestionMatchKey,
                    angular.toJson(vm.wrongQuestions)
                );
            } catch (e) {
                // Vẫn giữ trong RAM nếu trình duyệt chặn sessionStorage.
            }
        }


        function extractCorrectAnswer(source) {
            source = source || {};

            var direct =
                source.correctAnswerText ||
                source.correctAnswer ||
                source.motherTongue ||
                '';

            if (String(direct).trim()) {
                return String(direct).trim();
            }

            var correct = '';

            angular.forEach(
                source.questionAnswers || [],
                function (questionAnswer) {
                    if (correct || !questionAnswer) {
                        return;
                    }

                    if (
                        questionAnswer.correct === true ||
                        questionAnswer.isCorrect === true
                    ) {
                        correct =
                            questionAnswer.correctAnswer ||
                            (
                                questionAnswer.answer &&
                                questionAnswer.answer.answer
                            ) ||
                            questionAnswer.answer ||
                            '';
                    }
                }
            );

            return String(correct || '').trim();
        }


        function storeWrongQuestion(
            question,
            correctAnswer,
            expectedMatchKey
        ) {
            correctAnswer = String(correctAnswer || '').trim();

            if (!question || !correctAnswer) {
                return;
            }

            prepareWrongQuestionHistory(vm.room);

            if (
                expectedMatchKey &&
                expectedMatchKey !== activeWrongQuestionMatchKey
            ) {
                return;
            }

            var questionKey = String(
                question.id != null
                    ? question.id
                    : question.question || ''
            );

            var exists = vm.wrongQuestions.some(
                function (item) {
                    return String(item.questionKey) === questionKey;
                }
            );

            if (exists) {
                return;
            }

            vm.wrongQuestions.unshift({
                questionKey: questionKey,
                question: question.question,
                pronounce: question.pronounce,
                correctAnswer: correctAnswer
            });

            saveWrongQuestionHistory();
        }


        function rememberWrongQuestion(question, answerResult) {
            if (!question) {
                return;
            }

            prepareWrongQuestionHistory(vm.room);

            var matchKey = activeWrongQuestionMatchKey;

            var answerFromResult = extractCorrectAnswer(answerResult);

            var correctKey =
                answerResult &&
                (
                    answerResult.correctOptionKey ||
                    answerResult.correctKey
                );

            if (!answerFromResult && correctKey) {
                angular.forEach(
                    question.answers || [],
                    function (answer) {
                        if (
                            !answerFromResult &&
                            answer &&
                            String(answer.key) === String(correctKey)
                        ) {
                            answerFromResult = answer.text;
                        }
                    }
                );
            }

            if (answerFromResult) {
                storeWrongQuestion(
                    question,
                    answerFromResult,
                    matchKey
                );
                return;
            }

            /*
             * DTO chơi online không công khai đáp án đúng. Chỉ sau khi
             * người chơi trả lời sai mới lấy chi tiết câu để lưu phần ôn lại.
             */
            questionService.getOne(question.id).then(
                function (questionDetail) {
                    storeWrongQuestion(
                        question,
                        extractCorrectAnswer(questionDetail),
                        matchKey
                    );
                },
                angular.noop
            );
        }


        function formatScore(value) {
            value = Number(value || 0);

            if (Math.floor(value) === value) {
                return String(value);
            }

            return value.toFixed(1);
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


        function getRoomLink() {
            if (!vm.room) {
                return '';
            }

            return (
                $window.location.origin +
                '/battle-quiz-online/' +
                vm.room.code
            );
        }


        function copyRoomLink() {
            var link = getRoomLink();

            if (!link) {
                return;
            }

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


        function openQrModal() {
            vm.roomLink = getRoomLink();

            if (!vm.roomLink) {
                return;
            }

            /*
             * QR luôn lấy origin hiện tại, vì vậy đổi giữa các domain
             * triển khai không cần sửa code hay cấu hình cố định.
             */
            vm.qrImageUrl =
                'https://api.qrserver.com/v1/create-qr-code/' +
                '?size=1000x1000&margin=20&format=png&data=' +
                encodeURIComponent(vm.roomLink);

            vm.qrModalOpen = true;
        }


        function closeQrModal() {
            vm.qrModalOpen = false;
        }


        function openScannerModal() {
            vm.cameraStarting = false;
            vm.cameraError = '';
            vm.cameraActive = false;
            vm.cameraAwaitingPermission = true;
            resetCameraZoomState();
            vm.scannerModalOpen = true;
            qrScanHandled = false;
        }


        function closeScannerModal() {
            vm.scannerModalOpen = false;
            vm.cameraStarting = false;
            vm.cameraActive = false;
            vm.cameraAwaitingPermission = true;
            stopQrScanner();
        }


        /*
         * iOS Safari chỉ hiện hộp xin quyền camera ổn định khi
         * getUserMedia được gọi trực tiếp từ thao tác chạm của người dùng.
         * Vì vậy không tự mở camera bằng $timeout sau khi mở modal nữa.
         */
        function requestCameraAccess() {
            if (
                vm.cameraStarting ||
                vm.cameraActive ||
                !vm.scannerModalOpen
            ) {
                return;
            }

            if (
                !$window.navigator ||
                !$window.navigator.mediaDevices ||
                !$window.navigator.mediaDevices.getUserMedia
            ) {
                vm.cameraError = getCameraErrorMessage({
                    name: 'NotSupportedError'
                });
                return;
            }

            /*
             * Không gọi getUserMedia để "thử quyền" trước nữa.
             * html5-qrcode phải nhận chính luồng camera đầu tiên;
             * iOS dễ lỗi khi camera bị mở -> đóng -> mở lại liên tiếp.
             */
            if (!$window.Html5Qrcode) {
                vm.cameraStarting = true;
                vm.cameraError = '';

                loadQrScannerLibrary()
                    .then(
                        function () {
                            $scope.$evalAsync(
                                function () {
                                    vm.cameraStarting = false;
                                    vm.cameraAwaitingPermission = true;
                                    vm.cameraError =
                                        'Đã tải xong bộ quét. Chạm BẬT CAMERA một lần nữa.';
                                }
                            );
                        }
                    )
                    .catch(
                        function () {
                            $scope.$evalAsync(
                                function () {
                                    vm.cameraStarting = false;
                                    vm.cameraAwaitingPermission = true;
                                    vm.cameraError =
                                        'Không tải được bộ quét QR. Hãy tải lại trang rồi thử lại.';
                                }
                            );
                        }
                    );

                return;
            }

            vm.cameraStarting = true;
            vm.cameraActive = false;
            vm.cameraAwaitingPermission = false;
            vm.cameraError = '';

            /*
             * Gọi scanner.start ngay trong lần chạm này để Safari
             * hiện hộp xin quyền và giữ nguyên cùng một camera stream.
             */
            startQrScanner();
        }


        function getCameraErrorMessage(error) {
            var errorName =
                error && error.name
                    ? String(error.name)
                    : '';

            var errorText =
                String(
                    error && (error.message || error)
                        ? (error.message || error)
                        : ''
                ).toLowerCase();

            if (
                errorName === 'NotAllowedError' ||
                errorName === 'PermissionDeniedError' ||
                errorName === 'SecurityError' ||
                errorText.indexOf('notallowed') >= 0 ||
                errorText.indexOf('permission denied') >= 0 ||
                errorText.indexOf('permission dismissed') >= 0
            ) {
                return (
                    'Safari đang chặn quyền camera. Nhấn biểu tượng bên trái ' +
                    'thanh địa chỉ → Cài đặt trang web → Camera → Cho phép, ' +
                    'sau đó tải lại trang. Nếu vẫn bị chặn, vào Cài đặt ' +
                    'iPhone → Ứng dụng → Safari → Camera → Hỏi.'
                );
            }

            if (
                errorName === 'NotFoundError' ||
                errorName === 'DevicesNotFoundError' ||
                errorText.indexOf('notfound') >= 0 ||
                errorText.indexOf('no camera') >= 0
            ) {
                return 'Không tìm thấy camera trên thiết bị này.';
            }

            if (
                errorName === 'NotReadableError' ||
                errorName === 'TrackStartError' ||
                errorName === 'AbortError' ||
                errorText.indexOf('notreadable') >= 0 ||
                errorText.indexOf('could not start video') >= 0
            ) {
                return (
                    'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng ' +
                    'camera/video rồi thử lại.'
                );
            }

            if (errorName === 'NotSupportedError') {
                return (
                    'Trình duyệt không hỗ trợ camera. Hãy mở trang bằng HTTPS ' +
                    'trong Safari hoặc Chrome mới nhất.'
                );
            }

            return (
                'Không mở được camera. Hãy kiểm tra HTTPS, quyền camera ' +
                'và thử lại.'
            );
        }


        function loadQrScannerLibrary() {
            if ($window.Html5Qrcode) {
                return $window.Promise.resolve();
            }

            return new $window.Promise(
                function (resolve, reject) {
                    var scriptId =
                        'battle-online-html5-qrcode';

                    var existing =
                        $window.document.getElementById(scriptId);

                    if (existing) {
                        if (
                            existing.getAttribute('data-load-failed') === 'true' ||
                            existing.getAttribute('data-loaded') === 'true'
                        ) {
                            existing.parentNode.removeChild(existing);
                            existing = null;
                        }
                    }

                    if (existing) {
                        existing.addEventListener('load', resolve, {once: true});
                        existing.addEventListener('error', reject, {once: true});
                        return;
                    }

                    var script =
                        $window.document.createElement('script');

                    script.id = scriptId;
                    script.async = true;
                    script.src =
                        'https://unpkg.com/html5-qrcode@2.3.8/' +
                        'html5-qrcode.min.js';

                    script.onload = function () {
                        script.setAttribute('data-loaded', 'true');
                        resolve();
                    };

                    script.onerror = function (error) {
                        script.setAttribute('data-load-failed', 'true');
                        reject(error);
                    };

                    $window.document.head.appendChild(script);
                }
            );
        }


        function startQrScanner() {
            if (
                !vm.scannerModalOpen ||
                destroyed
            ) {
                return;
            }

            if (
                !$window.navigator ||
                !$window.navigator.mediaDevices ||
                !$window.navigator.mediaDevices.getUserMedia
            ) {
                vm.cameraStarting = false;
                vm.cameraActive = false;
                vm.cameraAwaitingPermission = true;
                vm.cameraError =
                    getCameraErrorMessage({
                        name: 'NotSupportedError'
                    });
                return;
            }

            var scanner;

            try {
                scanner = new $window.Html5Qrcode(
                    'battle-online-qr-reader',
                    {
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: true
                        }
                    },
                    false
                );
            } catch (createError) {
                vm.cameraStarting = false;
                vm.cameraActive = false;
                vm.cameraAwaitingPermission = true;
                vm.cameraError =
                    getCameraErrorMessage(createError);
                return;
            }

            qrScanner = scanner;

            /*
             * Phiên bản html5-qrcode đang dùng chỉ chấp nhận đúng 1 key
             * trong cameraIdOrConfig. Vì vậy phải truyền chính xác
             * {facingMode: 'environment'}; thêm width/height ở đây sẽ
             * làm thư viện từ chối trước khi camera được mở.
             */
            startQrScannerCamera(scanner)
                .then(
                    function () {
                        if (
                            !vm.scannerModalOpen ||
                            destroyed ||
                            qrScanner !== scanner
                        ) {
                            return scanner.stop()
                                .catch(angular.noop)
                                .then(
                                    function () {
                                        try {
                                            scanner.clear();
                                        } catch (e) {
                                            // Ignore cleanup.
                                        }
                                    }
                                );
                        }

                        qrScannerRunning = true;
                        configureRunningCamera(scanner);

                        $scope.$evalAsync(
                            function () {
                                vm.cameraStarting = false;
                                vm.cameraActive = true;
                                vm.cameraAwaitingPermission = false;
                            }
                        );
                    }
                )
                .catch(
                    function (error) {
                        qrScannerRunning = false;

                        if (qrScanner === scanner) {
                            qrScanner = null;
                        }

                        try {
                            scanner.clear();
                        } catch (e) {
                            // Ignore cleanup after a failed start.
                        }

                        if (
                            $window.console &&
                            angular.isFunction(
                                $window.console.error
                            )
                        ) {
                            $window.console.error(
                                '[Battle Online QR] Camera start failed:',
                                error
                            );
                        }

                        if (
                            destroyed ||
                            !vm.scannerModalOpen
                        ) {
                            return;
                        }

                        $scope.$evalAsync(
                            function () {
                                vm.cameraStarting = false;
                                vm.cameraActive = false;
                                vm.cameraAwaitingPermission = true;
                                vm.cameraError =
                                    getCameraErrorMessage(error);
                            }
                        );
                    }
                );
        }


        function startQrScannerCamera(scanner) {
            return scanner.start(
                {
                    facingMode: 'environment'
                },
                {
                    fps: 12,
                    qrbox: function (width, height) {
                        var available = Math.max(
                            180,
                            Math.min(width, height) - 24
                        );

                        var size = Math.min(
                            520,
                            Math.floor(available * 0.86)
                        );

                        return {
                            width: size,
                            height: size
                        };
                    }
                },
                handleScannedRoom,
                angular.noop
            );
        }


        function stopQrScanner() {
            var scanner = qrScanner;

            qrScanner = null;
            cancelCameraZoomApply();
            resetCameraZoomState();
            vm.cameraActive = false;

            if (!scanner) {
                qrScannerRunning = false;
                return $window.Promise.resolve();
            }

            var stopped = qrScannerRunning
                ? scanner.stop()
                : $window.Promise.resolve();

            qrScannerRunning = false;

            return stopped
                .catch(angular.noop)
                .then(
                    function () {
                        try {
                            scanner.clear();
                        } catch (e) {
                            // Ignore cleanup.
                        }
                    }
                );
        }


        function configureRunningCamera(scanner) {
            if (
                !scanner ||
                !angular.isFunction(
                    scanner.getRunningTrackCapabilities
                )
            ) {
                return;
            }

            var capabilities;
            var settings = {};

            try {
                capabilities =
                    scanner.getRunningTrackCapabilities() || {};

                if (
                    angular.isFunction(
                        scanner.getRunningTrackSettings
                    )
                ) {
                    settings =
                        scanner.getRunningTrackSettings() || {};
                }
            } catch (e) {
                return;
            }

            /*
             * Camera đã mở thành công rồi mới xin tăng chất lượng.
             * Constraint nào Safari không hỗ trợ sẽ bị bỏ qua mà không
             * làm tắt luồng quét đang chạy.
             */
            var qualityConstraints = {};
            var advancedConstraints = {};

            if (
                capabilities.width &&
                isFinite(capabilities.width.max)
            ) {
                qualityConstraints.width = {
                    ideal: Math.min(
                        1920,
                        capabilities.width.max
                    )
                };
            }

            if (
                capabilities.height &&
                isFinite(capabilities.height.max)
            ) {
                qualityConstraints.height = {
                    ideal: Math.min(
                        1080,
                        capabilities.height.max
                    )
                };
            }

            if (
                angular.isArray(capabilities.focusMode) &&
                capabilities.focusMode.indexOf('continuous') >= 0
            ) {
                advancedConstraints.focusMode = 'continuous';
            }

            var zoomSupported = (
                capabilities.zoom &&
                isFinite(capabilities.zoom.min) &&
                isFinite(capabilities.zoom.max) &&
                capabilities.zoom.max > capabilities.zoom.min
            );

            var initialZoom = 1;

            if (zoomSupported) {
                initialZoom = Math.min(
                    capabilities.zoom.max,
                    Math.max(
                        capabilities.zoom.min,
                        Math.max(
                            Number(settings.zoom) ||
                                capabilities.zoom.min,
                            1.5
                        )
                    )
                );

                advancedConstraints.zoom = initialZoom;

                $scope.$evalAsync(
                    function () {
                        vm.cameraZoomSupported = true;
                        vm.cameraZoomMin = capabilities.zoom.min;
                        vm.cameraZoomMax = capabilities.zoom.max;
                        vm.cameraZoomStep =
                            capabilities.zoom.step || 0.1;
                        vm.cameraZoom = initialZoom;
                    }
                );
            }

            if (Object.keys(advancedConstraints).length > 0) {
                qualityConstraints.advanced = [
                    advancedConstraints
                ];
            }

            if (
                Object.keys(qualityConstraints).length > 0 &&
                angular.isFunction(
                    scanner.applyVideoConstraints
                )
            ) {
                scanner.applyVideoConstraints(
                    qualityConstraints
                ).catch(
                    function (error) {
                        if (
                            $window.console &&
                            angular.isFunction(
                                $window.console.info
                            )
                        ) {
                            $window.console.info(
                                '[Battle Online QR] Giữ chất lượng camera mặc định:',
                                error
                            );
                        }
                    }
                );
            }
        }


        function applyCameraZoom() {
            if (
                !vm.cameraZoomSupported ||
                !qrScanner ||
                !qrScannerRunning ||
                !angular.isFunction(
                    qrScanner.applyVideoConstraints
                )
            ) {
                return;
            }

            cancelCameraZoomApply();

            qrZoomApplyTimer = $timeout(
                function () {
                    qrZoomApplyTimer = null;

                    if (
                        !qrScanner ||
                        !qrScannerRunning
                    ) {
                        return;
                    }

                    var zoom = Math.min(
                        vm.cameraZoomMax,
                        Math.max(
                            vm.cameraZoomMin,
                            Number(vm.cameraZoom) ||
                                vm.cameraZoomMin
                        )
                    );

                    vm.cameraZoom = zoom;

                    qrScanner.applyVideoConstraints({
                        advanced: [{
                            zoom: zoom
                        }]
                    }).catch(angular.noop);
                },
                80,
                false
            );
        }


        function cancelCameraZoomApply() {
            if (qrZoomApplyTimer) {
                $timeout.cancel(qrZoomApplyTimer);
                qrZoomApplyTimer = null;
            }
        }


        function resetCameraZoomState() {
            vm.cameraZoomSupported = false;
            vm.cameraZoom = 1;
            vm.cameraZoomMin = 1;
            vm.cameraZoomMax = 1;
            vm.cameraZoomStep = 0.1;
        }


        function parseScannedRoom(value) {
            value = String(value || '').trim();

            if (!value) {
                return null;
            }

            if (/^[A-Z0-9]{4,12}$/i.test(value)) {
                value =
                    $window.location.origin +
                    '/battle-quiz-online/' +
                    value;
            }

            try {
                var parsed = new $window.URL(
                    value,
                    $window.location.origin
                );

                if (
                    parsed.protocol !== 'https:' &&
                    parsed.protocol !== 'http:'
                ) {
                    return null;
                }

                var matched = parsed.pathname.match(
                    /^\/battle-quiz-online\/([A-Z0-9]{4,12})\/?$/i
                );

                if (!matched) {
                    return null;
                }

                var code = normalizeRoomCode(matched[1]);

                return {
                    code: code,
                    link:
                        parsed.origin +
                        '/battle-quiz-online/' +
                        code
                };
            } catch (e) {
                return null;
            }
        }


        function handleScannedRoom(decodedText) {
            if (qrScanHandled) {
                return;
            }

            var scanned = parseScannedRoom(decodedText);

            if (!scanned) {
                qrScanHandled = true;

                stopQrScanner().then(
                    function () {
                        if (destroyed) {
                            return;
                        }

                        $scope.$evalAsync(
                            function () {
                                vm.scannerModalOpen = false;
                                toastr.warning(
                                    'Mã QR này không phải link phòng Battle Online.'
                                );
                            }
                        );
                    }
                );

                return;
            }

            qrScanHandled = true;

            stopQrScanner().then(
                function () {
                    /*
                     * QR phòng hợp lệ được mở ngay, không hỏi xác nhận.
                     * Nếu chưa đăng nhập, application.js sẽ giữ mã phòng,
                     * đưa tới login rồi tự quay lại JOIN đúng phòng này.
                     */
                    $window.location.assign(scanned.link);
                }
            );
        }


        function getPlayerClass(player) {
            if (!player) {
                return {};
            }

            return {
                'is-rank-1': player.rank === 1,
                'is-rank-2': player.rank === 2,
                'is-rank-3': player.rank === 3,
                'is-player-burning': isPlayerBurning(player),
                'is-player-frozen':
                    Number(player.frozenUntil || 0) > serverNow(),
                'is-kickable': canKickPlayer(player),
                'is-spectator': player.spectator === true
            };
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
                vm.answerLocked ||
                vm.room.pendingSkillType ||
                isSpectator() ||
                isMeFrozen()
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

                clearSkillHitEffect();
                stopQrScanner();

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
