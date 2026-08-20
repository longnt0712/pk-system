(function () {
    'use strict';

    angular.module('Hrm.Question').controller(
        'QuizBattle2Controller',
        QuizBattle2Controller
    );

    QuizBattle2Controller.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'QuestionService',
        '$stateParams',
        'blockUI',
        '$cookies'
    ];

    function QuizBattle2Controller(
        $rootScope,
        $scope,
        toastr,
        $timeout,
        service,
        $stateParams,
        blockUI,
        $cookies
    ) {
        var vm = this;

        $scope.$on('$viewContentLoaded', function () {
            if (window.App && App.initAjax) {
                App.initAjax();
            }
        });

        if ($rootScope.settings && $rootScope.settings.layout) {
            $rootScope.settings.layout.pageContentWhite = true;
            $rootScope.settings.layout.pageBodySolid = false;
            $rootScope.settings.layout.pageSidebarClosed = false;
        }

        vm.mode = {id: 6, name: 'QUIZ BATTLE 2'};
        vm.listFlashCard = $stateParams.listFlashCard || 0;

        function getCookieValue(name) {
            if ($cookies.get) {
                return $cookies.get(name);
            }

            if ($cookies.getAll) {
                var allCookies = $cookies.getAll();
                return allCookies ? allCookies[name] : null;
            }

            return null;
        }

        function getCurrentUser() {
            var raw = getCookieValue('education.user');

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
            if (user && user.person) {
                var firstName = user.person.firstName || '';
                var lastName = user.person.lastName || '';
                var fullName = (lastName + ' ' + firstName).trim();

                if (fullName) {
                    return fullName;
                }
            }

            return (
                (user && user.displayName) ||
                (user && user.username) ||
                ''
            );
        }

        vm.currentUser = getCurrentUser();

        vm.myUser = {
            id: vm.currentUser.id,
            name: getFullName(vm.currentUser),
            roles: vm.currentUser.roles || []
        };

        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;

        angular.forEach(vm.myUser.roles, function (role) {
            if (!role) {
                return;
            }

            if (role.name === 'ROLE_VIEWER') {
                vm.isRoleView = true;
            }

            if (role.name === 'ROLE_USER') {
                vm.isRoleUser = true;
            }

            if (role.name === 'ROLE_ADMIN') {
                vm.isRoleAdmin = true;
            }
        });

        vm.users = [
            {id: 26, name: 'EM YÊU INH LÍCH'},
            {id: 33, name: 'CHURCH'}
        ];

        var currentUserAlreadyExists = false;

        angular.forEach(vm.users, function (user) {
            if (user.id == vm.myUser.id) {
                currentUserAlreadyExists = true;
            }
        });

        if (!currentUserAlreadyExists && vm.myUser.id != null) {
            vm.users.push(vm.myUser);
        }

        vm.selectedUser = vm.users[0];

        if (vm.isRoleView) {
            angular.forEach(vm.users, function (user) {
                if (user.id == 26) {
                    vm.selectedUser = user;
                }
            });
        } else if (vm.myUser.id != null) {
            angular.forEach(vm.users, function (user) {
                if (user.id == vm.myUser.id) {
                    vm.selectedUser = user;
                }
            });
        }

        vm.searchDto = {
            upper: 100,
            lower: 0,
            type: 100,
            pageSize: 5000,
            pageIndex: 1,
            questionType: {id: 6},
            userId: vm.selectedUser.id
        };

        vm.searchTopicDto = {
            userId: vm.selectedUser.id
        };

        vm.searchTopicCategory = {};
        vm.topicCategories = [];
        vm.topics = [];
        vm.selectedTopicToSearch = [];

        vm.rawQuestions = [];
        vm.questions = [];
        vm.questions1 = [];
        vm.currentCard = {};
        vm.currentCard1 = {};
        vm.currentPosition = 0;
        vm.currentPosition1 = 0;
        vm.totalCard = 0;
        vm.title = '';

        function pushTopic(selectedTopics) {
            var result = [];

            angular.forEach(selectedTopics || [], function (topic) {
                result.push({topic: topic});
            });

            return result;
        }

        function normalizeCategoryText(value) {
            return String(value || '').toLowerCase().trim();
        }

        function findGrade6Category(categories) {
            var found = null;

            angular.forEach(categories || [], function (category) {
                if (found) {
                    return;
                }

                var name = normalizeCategoryText(category && category.name);
                var code = normalizeCategoryText(category && category.code);
                var compactName = name.replace(/\s+/g, '');

                if (
                    name === 'grade 6' ||
                    compactName === 'grade6' ||
                    name === 'lớp 6' ||
                    name === 'lop 6' ||
                    code === 'grade6' ||
                    code === 'grade 6'
                ) {
                    found = category;
                }
            });

            return found;
        }

        vm.getTopics = function () {
            if (!vm.searchTopicDto.topicCategory) {
                vm.topics = [];
                return;
            }

            blockUI.start();

            service.getTopicsForGames(
                vm.searchTopicDto,
                1,
                10000000
            ).then(
                function (data) {
                    vm.topics = data && data.content ? data.content : [];
                },
                function () {
                    vm.topics = [];
                    toastr.error(
                        'Không tải được danh sách bài.',
                        'Thông báo'
                    );
                }
            ).finally(function () {
                blockUI.stop();
            });
        };

        vm.getPageTopicCategory = function () {
            blockUI.start();

            service.getPageTopicCategory(
                vm.searchTopicCategory,
                1,
                100
            ).then(
                function (data) {
                    vm.topicCategories =
                        data && data.content ? data.content : [];

                    if (vm.topicCategories.length === 0) {
                        vm.topics = [];
                        return;
                    }

                    vm.searchTopicDto.topicCategory =
                        findGrade6Category(vm.topicCategories) ||
                        vm.topicCategories[0];

                    vm.getTopics();
                },
                function () {
                    vm.topicCategories = [];
                    vm.topics = [];

                    toastr.error(
                        'Không tải được Grade.',
                        'Thông báo'
                    );
                }
            ).finally(function () {
                blockUI.stop();
            });
        };

        vm.chooseUsers = function () {
            if (!vm.selectedUser) {
                return;
            }

            vm.searchDto.userId = vm.selectedUser.id;
            vm.searchTopicDto.userId = vm.selectedUser.id;

            vm.selectedTopicToSearch = [];
            vm.rawQuestions = [];
            vm.questions = [];
            vm.questions1 = [];
            vm.currentCard = {};
            vm.currentCard1 = {};
            vm.currentPosition = 0;
            vm.currentPosition1 = 0;
            vm.totalCard = 0;

            vm.timerDuration = 0;
            vm.counter = 0;

            vm.resetBattle(true);
            vm.getPageTopicCategory();
        };

        vm.categoryChange = function () {
            vm.selectedTopicToSearch = [];
            vm.getTopics();
        };

        function shuffleArray(array) {
            var result = (array || []).slice();
            var m = result.length;
            var t;
            var i;

            while (m) {
                i = Math.floor(Math.random() * m--);

                t = result[m];
                result[m] = result[i];
                result[i] = t;
            }

            return result;
        }

        function createQuestionsWithOptions(
            parents,
            optionCount,
            shouldShuffleAnswers
        ) {
            var source = parents || [];
            var totalOptions = optionCount || 4;
            var shuffleAnswers = shouldShuffleAnswers === true;

            function pickWrongAnswers(currentId, count) {
                var filtered = source.filter(function (item) {
                    return item.id !== currentId;
                });

                if (shuffleAnswers) {
                    filtered = shuffleArray(filtered);
                }

                return filtered.slice(0, count);
            }

            return source.map(function (parent) {
                var wrongAnswers =
                    pickWrongAnswers(parent.id, totalOptions - 1)
                        .map(function (item) {
                            return {
                                id: item.id,
                                question: item.question,
                                motherTongue: item.motherTongue,
                                pronounce: item.pronounce,
                                ordinalNumber: item.ordinalNumber,
                                result: false,
                                chosen: false,
                                correct: false
                            };
                        });

                var correctAnswer = {
                    id: parent.id,
                    question: parent.question,
                    motherTongue: parent.motherTongue,
                    pronounce: parent.pronounce,
                    ordinalNumber: parent.ordinalNumber,
                    result: false,
                    chosen: false,
                    correct: true
                };

                var answers = [correctAnswer].concat(wrongAnswers);

                if (shuffleAnswers) {
                    answers = shuffleArray(answers);
                }

                var question = angular.copy(parent);
                question.questions = answers;

                return question;
            });
        }

        /*
         * =====================================================
         * BALANCED FREEZE SKILL
         * =====================================================
         *
         * Mục tiêu: skill chỉ là gia vị.
         * Trọng tâm vẫn là học thuộc + tốc độ trả lời.
         *
         * - < 10 câu: 0 freeze.
         * - Khoảng 8% số câu có freeze.
         * - Tối đa 3 freeze / player / trận.
         * - Không rơi vào 3 câu đầu và 2 câu cuối.
         * - Chia đều theo các đoạn của trận.
         * - Hai player dùng CHUNG cùng các mốc tiến trình
         *   skill -> cùng số lượng, cùng vị trí thứ tự,
         *   giảm tối đa yếu tố may mắn.
         */
        function getFreezeSkillCount(totalQuestions) {
            var total = parseInt(totalQuestions, 10);

            if (isNaN(total) || total < 10) {
                return 0;
            }

            /*
             * CÀNG NHIỀU CÂU -> TỶ LỆ FREEZE TĂNG NHẸ.
             *
             * 10 - 29 câu : ~7%
             * 30 - 49 câu : ~8%
             * 50 - 79 câu : ~9%
             * 80+ câu     : ~10%
             *
             * Trần 8 skill / player / trận để game vẫn
             * phụ thuộc chủ yếu vào học thuộc + tốc độ.
             */
            var rate = 0.07;

            if (total >= 80) {
                rate = 0.10;
            } else if (total >= 50) {
                rate = 0.09;
            } else if (total >= 30) {
                rate = 0.08;
            }

            var count = Math.round(total * rate);

            if (count < 1) {
                count = 1;
            }

            if (count > 8) {
                count = 8;
            }

            return count;
        }

        function buildBalancedFreezePositions(totalQuestions) {
            var total = parseInt(totalQuestions, 10);
            var positions = [];
            var skillCount = getFreezeSkillCount(total);

            if (skillCount <= 0) {
                return positions;
            }

            /*
             * Index 0-based:
             * firstAllowed = 3  => bỏ 3 câu đầu.
             * lastAllowed = total - 3 => bỏ 2 câu cuối.
             */
            var firstAllowed = 3;
            var lastAllowed = total - 3;

            if (lastAllowed < firstAllowed) {
                return positions;
            }

            var usableCount =
                lastAllowed - firstAllowed + 1;

            var segmentSize =
                usableCount / skillCount;

            var segmentIndex;

            for (
                segmentIndex = 0;
                segmentIndex < skillCount;
                segmentIndex = segmentIndex + 1
            ) {
                var segmentStart = Math.floor(
                    firstAllowed +
                    (segmentIndex * segmentSize)
                );

                var segmentEnd = Math.floor(
                    firstAllowed +
                    ((segmentIndex + 1) * segmentSize)
                ) - 1;

                if (segmentIndex === skillCount - 1) {
                    segmentEnd = lastAllowed;
                }

                if (segmentEnd < segmentStart) {
                    segmentEnd = segmentStart;
                }

                /*
                 * Random chỉ ở bên trong từng đoạn.
                 * Sau đó dùng CHUNG vị trí này cho cả P1/P2.
                 */
                var position =
                    segmentStart +
                    Math.floor(
                        Math.random() *
                        (segmentEnd - segmentStart + 1)
                    );

                positions.push(position);
            }

            return positions;
        }

        function applyFreezePositions(
            questions,
            positions
        ) {
            var positionMap = {};

            angular.forEach(
                positions || [],
                function (position) {
                    positionMap[position] = true;
                }
            );

            angular.forEach(
                questions || [],
                function (question, index) {
                    question.hasFreezeSkill =
                        positionMap[index] === true;

                    question.freezeConsumed = false;
                }
            );
        }

        /*
         * =====================================================
         * BREAK STREAK SKILL
         * =====================================================
         *
         * Tỷ lệ thấp hơn Freeze:
         * - khoảng 6% tổng số câu
         * - tối đa 2 lần / player / trận
         * - hai bên dùng chung mốc tiến trình
         * - tránh 3 câu đầu + 2 câu cuối
         * - ưu tiên KHÔNG trùng với Freeze
         *
         * Skill chỉ reset streak đối thủ về 0.
         * Không trừ score.
         */
        function getBreakStreakSkillCount(totalQuestions) {
            var total = parseInt(totalQuestions, 10);

            if (isNaN(total) || total < 12) {
                return 0;
            }

            /*
             * BREAK STREAK hiếm hơn FREEZE.
             *
             * 12 - 29 câu : ~4%
             * 30 - 49 câu : ~5%
             * 50 - 79 câu : ~6%
             * 80+ câu     : ~7%
             *
             * Trần 6 skill / player / trận.
             *
             * Hai player vẫn có cùng số skill + cùng mốc,
             * và BREAK STREAK vẫn tránh trùng câu FREEZE.
             */
            var rate = 0.04;

            if (total >= 80) {
                rate = 0.07;
            } else if (total >= 50) {
                rate = 0.06;
            } else if (total >= 30) {
                rate = 0.05;
            }

            var count = Math.round(total * rate);

            if (count < 1) {
                count = 1;
            }

            if (count > 6) {
                count = 6;
            }

            return count;
        }

        function buildBalancedBreakStreakPositions(
            totalQuestions,
            blockedPositions
        ) {
            var total = parseInt(totalQuestions, 10);
            var positions = [];
            var blockedMap = {};

            angular.forEach(
                blockedPositions || [],
                function (position) {
                    blockedMap[position] = true;
                }
            );

            var skillCount =
                getBreakStreakSkillCount(total);

            if (skillCount <= 0) {
                return positions;
            }

            var firstAllowed = 3;
            var lastAllowed = total - 3;

            if (lastAllowed < firstAllowed) {
                return positions;
            }

            var candidates = [];
            var index;

            for (
                index = firstAllowed;
                index <= lastAllowed;
                index = index + 1
            ) {
                if (blockedMap[index] !== true) {
                    candidates.push(index);
                }
            }

            if (candidates.length <= 0) {
                return positions;
            }

            if (skillCount > candidates.length) {
                skillCount = candidates.length;
            }

            /*
             * Chia đều candidates thành từng đoạn.
             * Mỗi đoạn chọn 1 mốc ngẫu nhiên.
             */
            var segmentSize =
                candidates.length / skillCount;

            var segmentIndex;

            for (
                segmentIndex = 0;
                segmentIndex < skillCount;
                segmentIndex = segmentIndex + 1
            ) {
                var start = Math.floor(
                    segmentIndex * segmentSize
                );

                var end = Math.floor(
                    (segmentIndex + 1) * segmentSize
                ) - 1;

                if (segmentIndex === skillCount - 1) {
                    end = candidates.length - 1;
                }

                if (end < start) {
                    end = start;
                }

                var pickedArrayIndex =
                    start +
                    Math.floor(
                        Math.random() *
                        (end - start + 1)
                    );

                if (candidates[pickedArrayIndex] != null) {
                    positions.push(
                        candidates[pickedArrayIndex]
                    );
                }
            }

            return positions;
        }

        function applyBreakStreakPositions(
            questions,
            positions
        ) {
            var positionMap = {};

            angular.forEach(
                positions || [],
                function (position) {
                    positionMap[position] = true;
                }
            );

            angular.forEach(
                questions || [],
                function (question, index) {
                    question.hasBreakStreakSkill =
                        positionMap[index] === true;

                    question.breakStreakConsumed = false;
                }
            );
        }

        function prepareBattleQuestions(shouldShuffleAnswers) {
            vm.questions = createQuestionsWithOptions(
                vm.rawQuestions,
                4,
                shouldShuffleAnswers
            );

            vm.questions1 = createQuestionsWithOptions(
                vm.rawQuestions,
                4,
                shouldShuffleAnswers
            );

            /*
             * Câu hỏi của 2 bên vẫn shuffle độc lập.
             * Đáp án cũng shuffle khi START.
             */
            vm.questions = shuffleArray(vm.questions);
            vm.questions1 = shuffleArray(vm.questions1);

            /*
             * Nhưng mốc skill được chia công bằng theo
             * tiến trình câu hỏi của trận.
             */
            var freezePositions =
                buildBalancedFreezePositions(
                    vm.rawQuestions.length
                );

            applyFreezePositions(
                vm.questions,
                freezePositions
            );

            applyFreezePositions(
                vm.questions1,
                freezePositions
            );

            /*
             * BREAK STREAK dùng cùng mốc cho cả 2 bên
             * và tránh trùng với FREEZE.
             */
            var breakStreakPositions =
                buildBalancedBreakStreakPositions(
                    vm.rawQuestions.length,
                    freezePositions
                );

            applyBreakStreakPositions(
                vm.questions,
                breakStreakPositions
            );

            applyBreakStreakPositions(
                vm.questions1,
                breakStreakPositions
            );

            vm.currentPosition = 0;
            vm.currentPosition1 = 0;

            vm.currentCard =
                vm.questions.length > 0
                    ? vm.questions[0]
                    : {};

            vm.currentCard1 =
                vm.questions1.length > 0
                    ? vm.questions1[0]
                    : {};

            vm.totalCard = vm.rawQuestions.length;
        }

        vm.getPageFlashCard = function () {
            if (
                !vm.searchDto.questionTopics ||
                vm.searchDto.questionTopics.length <= 0
            ) {
                toastr.warning(
                    'Phải chọn bài từ vựng cần học rồi ấn TÌM KIẾM.'
                );
                return;
            }

            vm.searchDto.questionType = {id: 6};
            vm.searchDto.userId = vm.selectedUser.id;
            vm.searchDto.pageSize = 5000;
            vm.searchDto.pageIndex = 1;

            blockUI.start();

            service.getPageForGames(
                vm.searchDto,
                vm.searchDto.pageIndex,
                vm.searchDto.pageSize
            ).then(
                function (data) {
                    vm.rawQuestions =
                        data && data.content ? data.content : [];

                    vm.questions = createQuestionsWithOptions(
                        vm.rawQuestions,
                        4,
                        false
                    );

                    vm.questions1 = createQuestionsWithOptions(
                        vm.rawQuestions,
                        4,
                        false
                    );

                    vm.currentPosition = 0;
                    vm.currentPosition1 = 0;
                    vm.totalCard = vm.rawQuestions.length;

                    /*
                     * Mỗi lần search ra bộ từ mới:
                     * timer tự về mặc định = totalCard x 5.
                     */
                    applyDefaultBattleTimer();

                    vm.currentCard =
                        vm.questions.length > 0 ? vm.questions[0] : {};

                    vm.currentCard1 =
                        vm.questions1.length > 0 ? vm.questions1[0] : {};

                    vm.resetBattle(true);
                },
                function () {
                    vm.rawQuestions = [];
                    vm.questions = [];
                    vm.questions1 = [];
                    vm.currentCard = {};
                    vm.currentCard1 = {};
                    vm.totalCard = 0;

                    vm.timerDuration = 0;
                    vm.counter = 0;

                    toastr.error(
                        'Không tải được dữ liệu QUIZ BATTLE 2.',
                        'Thông báo'
                    );
                }
            ).finally(function () {
                blockUI.stop();
            });
        };

        vm.searchTopicChange = function () {
            vm.searchDto.questionTopics =
                pushTopic(vm.selectedTopicToSearch);

            if (
                !vm.searchDto.questionTopics ||
                vm.searchDto.questionTopics.length === 0
            ) {
                toastr.warning(
                    'Phải chọn bài từ vựng cần học rồi ấn TÌM KIẾM.'
                );
                return;
            }

            vm.title = '';

            angular.forEach(
                vm.searchDto.questionTopics,
                function (questionTopic) {
                    if (
                        questionTopic &&
                        questionTopic.topic &&
                        questionTopic.topic.name
                    ) {
                        vm.title += ' ' + questionTopic.topic.name;
                    }
                }
            );

            vm.getPageFlashCard();
        };

        vm.isMuted = false;

        function shutUp() {
            if (
                window.speechSynthesis &&
                window.speechSynthesis.cancel
            ) {
                window.speechSynthesis.cancel();
            }
        }

        function sayIt(text) {
            if (
                vm.isMuted ||
                !text ||
                !window.speechSynthesis ||
                !window.SpeechSynthesisUtterance
            ) {
                return;
            }

            shutUp();

            var utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 1;

            window.speechSynthesis.speak(utterance);
        }

        vm.sayPlayerQuestion = function (player) {
            if (player === 2) {
                sayIt(vm.currentCard1 && vm.currentCard1.question);
                return;
            }

            sayIt(vm.currentCard && vm.currentCard.question);
        };

        function announce(text) {
            if (
                !window.speechSynthesis ||
                !window.SpeechSynthesisUtterance
            ) {
                return;
            }

            var utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }

        var battleTimer = null;

        /*
         * TIMER MẶC ĐỊNH = TỔNG SỐ TỪ x 5 GIÂY
         * Ví dụ:
         * 32 từ -> 160 giây
         * 50 từ -> 250 giây
         */
        vm.timerDuration = 0;
        vm.counter = 0;
        vm.timerRunning = false;
        vm.battleTimeUp = false;

        function getDefaultBattleTimerSeconds() {
            var total =
                parseInt(vm.totalCard, 10);

            if (isNaN(total) || total < 0) {
                total = 0;
            }

            return total * 5;
        }

        function applyDefaultBattleTimer() {
            var seconds =
                getDefaultBattleTimerSeconds();

            vm.timerDuration = seconds;
            vm.counter = seconds;
        }

        function cancelBattleTimer() {
            if (battleTimer !== null) {
                $timeout.cancel(battleTimer);
                battleTimer = null;
            }
        }

        function stopAudioById(id) {
            var audio = document.getElementById(id);

            if (!audio) {
                return;
            }

            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {
                // Không cần xử lý thêm.
            }
        }

        function playAudioById(id) {
            var audio = document.getElementById(id);

            if (!audio) {
                return;
            }

            try {
                audio.pause();
                audio.currentTime = 0;

                var playPromise = audio.play();

                if (
                    playPromise &&
                    angular.isFunction(playPromise.catch)
                ) {
                    playPromise.catch(angular.noop);
                }
            } catch (e) {
                // Browser có thể chặn autoplay.
            }
        }

        /*
         * =====================================================
         * BACKGROUND MUSIC
         * =====================================================
         * Giống DAILY VOCAB:
         * - mặc định TẮT
         * - bật trong lúc trận đang chạy -> phát ngay
         * - tắt -> dừng ngay
         * - mỗi lượt START chọn ngẫu nhiên 1 bài
         * - reset / hết giờ / trận kết thúc -> dừng
         */
        vm.backgroundMusicEnabled = false;

        var backgroundAudio = null;

        function stopBackgroundMusic() {
            if (!backgroundAudio) {
                return;
            }

            try {
                backgroundAudio.pause();
                backgroundAudio.currentTime = 0;
                backgroundAudio.loop = false;
            } catch (e) {
                // Không để lỗi audio ảnh hưởng game.
            }

            backgroundAudio = null;
        }

        function startBackgroundMusic() {
            stopBackgroundMusic();

            if (
                vm.backgroundMusicEnabled !== true ||
                vm.timerRunning !== true ||
                vm.endGame === true
            ) {
                return;
            }

            var ids = [
                'quiz-battle-bg-1',
                'quiz-battle-bg-5',
                'quiz-battle-bg-6',
                'quiz-battle-bg-7'
            ];

            var available = [];

            angular.forEach(ids, function (id) {
                var element =
                    document.getElementById(id);

                if (element) {
                    available.push(element);
                }
            });

            if (available.length === 0) {
                return;
            }

            backgroundAudio =
                available[
                    Math.floor(
                        Math.random() *
                        available.length
                    )
                ];

            try {
                backgroundAudio.pause();
                backgroundAudio.currentTime = 0;
                backgroundAudio.loop = true;

                var playPromise =
                    backgroundAudio.play();

                if (
                    playPromise &&
                    angular.isFunction(playPromise.catch)
                ) {
                    playPromise.catch(angular.noop);
                }
            } catch (e) {
                backgroundAudio = null;
            }
        }

        vm.toggleBackgroundMusic = function () {
            vm.backgroundMusicEnabled =
                vm.backgroundMusicEnabled === true;

            if (
                vm.backgroundMusicEnabled === true &&
                vm.timerRunning === true &&
                vm.endGame !== true
            ) {
                startBackgroundMusic();
                return;
            }

            stopBackgroundMusic();
        };

        function battleTick() {
            if (vm.timerRunning !== true) {
                return;
            }

            if (vm.counter <= 1) {
                vm.counter = 0;
                vm.timerRunning = false;
                vm.battleTimeUp = true;

                /*
                 * HẾT GIỜ = KHÓA GAME NGAY.
                 *
                 * - click đáp án không còn xử lý
                 * - keyboard không còn xử lý
                 * - taunt / skill cũng dừng
                 * - muốn chơi lại phải RESET
                 */
                vm.endGame = true;

                battleTimer = null;

                clearBattleEffects();
                stopBackgroundMusic();

                playAudioById('quiz-battle-boom');
                return;
            }

            vm.counter = vm.counter - 1;
            battleTimer = $timeout(battleTick, 1000);
        }

        vm.timerSettingChange = function () {
            var value =
                parseInt(vm.timerDuration, 10);

            if (isNaN(value) || value < 1) {
                value = 1;
            }

            /*
             * Cho phép bộ từ rất lớn.
             * Không còn bị giới hạn 9999 giây.
             */
            if (value > 999999) {
                value = 999999;
            }

            vm.timerDuration = value;

            if (vm.timerRunning !== true) {
                vm.counter = value;
            }
        };

        var stillInAQuestion1 = false;
        var stillInAQuestion2 = false;

        /*
         * =====================================================
         * CÀ KHỊA / TAUNT
         * =====================================================
         * P1 = E
         * P2 = P
         * Cooldown 5 giây.
         * Không ảnh hưởng score.
         */
        var tauntPhrases = [
            'Nhanh lên bạn ơi 😏',
            'Câu này mà cũng phải nghĩ à? 😂',
            'Tôi đang đợi bạn đấy 😎',
            'Streak đâu rồi? 🔥',
            'Ủa, căng vậy sao? 🤭',
            'Come on! 😈',
            'Too slow! ⚡',
            'Đừng nhìn tôi, nhìn câu hỏi đi 😌',
            'Tập trung nào đối thủ ơi 😏',
            'Sắp theo không kịp rồi kìa 😎'
        ];

        vm.tauntCooldown1 = 0;
        vm.tauntCooldown2 = 0;

        vm.tauntOnPlayer1 = '';
        vm.tauntOnPlayer2 = '';

        var tauntCooldownTimer1 = null;
        var tauntCooldownTimer2 = null;
        var tauntBubbleTimer1 = null;
        var tauntBubbleTimer2 = null;

        var lastTauntIndex1 = -1;
        var lastTauntIndex2 = -1;

        function cancelTimeoutSafe(timer) {
            if (timer !== null) {
                $timeout.cancel(timer);
            }
        }

        function clearTauntBubble(player) {
            if (player === 1) {
                cancelTimeoutSafe(tauntBubbleTimer1);
                tauntBubbleTimer1 = null;
                vm.tauntOnPlayer1 = '';
                return;
            }

            cancelTimeoutSafe(tauntBubbleTimer2);
            tauntBubbleTimer2 = null;
            vm.tauntOnPlayer2 = '';
        }

        function showTauntOnPlayer(
            targetPlayer,
            message
        ) {
            clearTauntBubble(targetPlayer);

            if (targetPlayer === 1) {
                vm.tauntOnPlayer1 = message;

                tauntBubbleTimer1 = $timeout(
                    function () {
                        vm.tauntOnPlayer1 = '';
                        tauntBubbleTimer1 = null;
                    },
                    1900
                );

                return;
            }

            vm.tauntOnPlayer2 = message;

            tauntBubbleTimer2 = $timeout(
                function () {
                    vm.tauntOnPlayer2 = '';
                    tauntBubbleTimer2 = null;
                },
                1900
            );
        }

        function getRandomTaunt(player) {
            var lastIndex =
                player === 1
                    ? lastTauntIndex1
                    : lastTauntIndex2;

            var index = Math.floor(
                Math.random() *
                tauntPhrases.length
            );

            if (
                tauntPhrases.length > 1 &&
                index === lastIndex
            ) {
                index =
                    (index + 1) %
                    tauntPhrases.length;
            }

            if (player === 1) {
                lastTauntIndex1 = index;
            } else {
                lastTauntIndex2 = index;
            }

            return tauntPhrases[index];
        }

        function startTauntCooldown(player) {
            if (player === 1) {
                cancelTimeoutSafe(tauntCooldownTimer1);
                vm.tauntCooldown1 = 5;
            } else {
                cancelTimeoutSafe(tauntCooldownTimer2);
                vm.tauntCooldown2 = 5;
            }

            function tick() {
                if (player === 1) {
                    if (vm.tauntCooldown1 <= 1) {
                        vm.tauntCooldown1 = 0;
                        tauntCooldownTimer1 = null;
                        return;
                    }

                    vm.tauntCooldown1 =
                        vm.tauntCooldown1 - 1;

                    tauntCooldownTimer1 =
                        $timeout(tick, 1000);

                    return;
                }

                if (vm.tauntCooldown2 <= 1) {
                    vm.tauntCooldown2 = 0;
                    tauntCooldownTimer2 = null;
                    return;
                }

                vm.tauntCooldown2 =
                    vm.tauntCooldown2 - 1;

                tauntCooldownTimer2 =
                    $timeout(tick, 1000);
            }

            if (player === 1) {
                tauntCooldownTimer1 =
                    $timeout(tick, 1000);
            } else {
                tauntCooldownTimer2 =
                    $timeout(tick, 1000);
            }
        }

        vm.taunt = function (player) {
            if (vm.endGame === true) {
                return;
            }

            if (
                player === 1 &&
                vm.tauntCooldown1 > 0
            ) {
                return;
            }

            if (
                player === 2 &&
                vm.tauntCooldown2 > 0
            ) {
                return;
            }

            showTauntOnPlayer(
                player === 1 ? 2 : 1,
                getRandomTaunt(player)
            );

            startTauntCooldown(player);
        };


        /*
         * =====================================================
         * FREEZE SKILL
         * =====================================================
         * Trả lời đúng câu có ❄:
         * đóng băng đối thủ đúng 3 giây.
         *
         * Freeze không stack.
         */
        vm.player1Frozen = false;
        vm.player2Frozen = false;

        vm.freezeSeconds1 = 0;
        vm.freezeSeconds2 = 0;

        var freezeTimer1 = null;
        var freezeTimer2 = null;

        function isPlayerFrozen(player) {
            return (
                player === 1
                    ? vm.player1Frozen
                    : vm.player2Frozen
            );
        }

        function cancelFreezeTimer(player) {
            if (player === 1) {
                cancelTimeoutSafe(freezeTimer1);
                freezeTimer1 = null;
                return;
            }

            cancelTimeoutSafe(freezeTimer2);
            freezeTimer2 = null;
        }

        function clearFreezeState(player) {
            cancelFreezeTimer(player);

            if (player === 1) {
                vm.player1Frozen = false;
                vm.freezeSeconds1 = 0;
                return;
            }

            vm.player2Frozen = false;
            vm.freezeSeconds2 = 0;
        }

        function freezePlayer(player) {
            /*
             * Không cộng dồn thời gian freeze.
             */
            if (isPlayerFrozen(player)) {
                return;
            }

            if (
                player === 1 &&
                vm.endGamePlayer1 === true
            ) {
                return;
            }

            if (
                player === 2 &&
                vm.endGamePlayer2 === true
            ) {
                return;
            }

            clearFreezeState(player);

            if (player === 1) {
                vm.player1Frozen = true;
                vm.freezeSeconds1 = 3;
            } else {
                vm.player2Frozen = true;
                vm.freezeSeconds2 = 3;
            }

            function tickFreeze() {
                if (player === 1) {
                    if (vm.freezeSeconds1 <= 1) {
                        clearFreezeState(1);
                        return;
                    }

                    vm.freezeSeconds1 =
                        vm.freezeSeconds1 - 1;

                    freezeTimer1 =
                        $timeout(tickFreeze, 1000);

                    return;
                }

                if (vm.freezeSeconds2 <= 1) {
                    clearFreezeState(2);
                    return;
                }

                vm.freezeSeconds2 =
                    vm.freezeSeconds2 - 1;

                freezeTimer2 =
                    $timeout(tickFreeze, 1000);
            }

            if (player === 1) {
                freezeTimer1 =
                    $timeout(tickFreeze, 1000);
            } else {
                freezeTimer2 =
                    $timeout(tickFreeze, 1000);
            }
        }

        function triggerFreezeSkill(player) {
            var card =
                player === 1
                    ? vm.currentCard
                    : vm.currentCard1;

            if (
                !card ||
                card.hasFreezeSkill !== true ||
                card.freezeConsumed === true
            ) {
                return;
            }

            card.freezeConsumed = true;

            freezePlayer(
                player === 1 ? 2 : 1
            );
        }


        /*
         * =====================================================
         * BREAK STREAK EFFECT
         * =====================================================
         */
        vm.breakStreakHit1 = false;
        vm.breakStreakHit2 = false;

        var breakStreakFxTimer1 = null;
        var breakStreakFxTimer2 = null;

        function clearBreakStreakFx(player) {
            if (player === 1) {
                cancelTimeoutSafe(breakStreakFxTimer1);
                breakStreakFxTimer1 = null;
                vm.breakStreakHit1 = false;
                return;
            }

            cancelTimeoutSafe(breakStreakFxTimer2);
            breakStreakFxTimer2 = null;
            vm.breakStreakHit2 = false;
        }

        function showBreakStreakFx(player) {
            clearBreakStreakFx(player);

            if (player === 1) {
                vm.breakStreakHit1 = true;

                breakStreakFxTimer1 = $timeout(
                    function () {
                        vm.breakStreakHit1 = false;
                        breakStreakFxTimer1 = null;
                    },
                    1300
                );

                return;
            }

            vm.breakStreakHit2 = true;

            breakStreakFxTimer2 = $timeout(
                function () {
                    vm.breakStreakHit2 = false;
                    breakStreakFxTimer2 = null;
                },
                1300
            );
        }

        function triggerBreakStreakSkill(player) {
            var card =
                player === 1
                    ? vm.currentCard
                    : vm.currentCard1;

            if (
                !card ||
                card.hasBreakStreakSkill !== true ||
                card.breakStreakConsumed === true
            ) {
                return;
            }

            card.breakStreakConsumed = true;

            /*
             * P1 kích hoạt -> phá streak P2.
             * P2 kích hoạt -> phá streak P1.
             *
             * Chỉ reset streak, KHÔNG trừ score.
             */
            if (player === 1) {
                if (vm.streakPlayer2 > 0) {
                    vm.streakPlayer2 = 0;
                    showBreakStreakFx(2);
                }

                return;
            }

            if (vm.streakPlayer1 > 0) {
                vm.streakPlayer1 = 0;
                showBreakStreakFx(1);
            }
        }

        function clearBattleEffects() {
            clearFreezeState(1);
            clearFreezeState(2);

            clearTauntBubble(1);
            clearTauntBubble(2);

            cancelTimeoutSafe(tauntCooldownTimer1);
            cancelTimeoutSafe(tauntCooldownTimer2);

            tauntCooldownTimer1 = null;
            tauntCooldownTimer2 = null;

            vm.tauntCooldown1 = 0;
            vm.tauntCooldown2 = 0;

            clearBreakStreakFx(1);
            clearBreakStreakFx(2);
        }

        function startBattleAfterShuffle(shouldShuffleAnswers) {
            cancelBattleTimer();
            stopAudioById('quiz-battle-boom');
            shutUp();

            clearBattleEffects();

            prepareBattleQuestions(shouldShuffleAnswers === true);

            vm.counter =
                parseInt(vm.timerDuration, 10);

            if (
                isNaN(vm.counter) ||
                vm.counter < 1
            ) {
                applyDefaultBattleTimer();
            }

            vm.timerRunning = true;
            vm.battleTimeUp = false;

            vm.endGame = false;
            vm.endGamePlayer1 = false;
            vm.endGamePlayer2 = false;

            vm.streakPlayer1 = 0;
            vm.streakPlayer2 = 0;
            vm.wrongPlayer1 = 0;
            vm.wrongPlayer2 = 0;
            vm.score1 = 0;
            vm.score2 = 0;

            stillInAQuestion1 = false;
            stillInAQuestion2 = false;

            vm.flipped1 = false;
            vm.flipped2 = false;

            startBackgroundMusic();

            sayIt(vm.currentCard && vm.currentCard.question);

            battleTimer = $timeout(battleTick, 1000);
        }

        vm.startBattle = function () {
            if (vm.battleTimeUp === true) {
                toastr.warning(
                    'Đã hết giờ. Hãy nhấn RESET trước khi chơi lại.',
                    'QUIZ BATTLE 2'
                );
                return;
            }

            if (
                !vm.rawQuestions ||
                vm.rawQuestions.length === 0
            ) {
                toastr.warning(
                    'Chưa có dữ liệu. Hãy chọn bài và nhấn TÌM KIẾM trước.'
                );
                return;
            }

            var duration =
                parseInt(vm.timerDuration, 10);

            /*
             * Nếu timer bị xóa/trống,
             * tự trả về totalCard x 5.
             */
            if (isNaN(duration) || duration < 1) {
                applyDefaultBattleTimer();

                duration =
                    parseInt(vm.timerDuration, 10);
            }

            if (
                isNaN(duration) ||
                duration < 1 ||
                duration > 999999
            ) {
                toastr.warning(
                    'Thời gian phải từ 1 đến 999999 giây.'
                );
                return;
            }

            /*
             * BẤM ĐỒNG HỒ = BẮT ĐẦU NGAY.
             *
             * true:
             * - shuffle thứ tự câu hỏi
             * - shuffle vị trí 4 đáp án
             *
             * Không hiện popup hỏi nữa.
             */
            startBattleAfterShuffle(true);
        };

        vm.resetBattle = function (keepLoadedQuestions) {
            cancelBattleTimer();
            stopAudioById('quiz-battle-boom');
            stopBackgroundMusic();
            shutUp();

            clearBattleEffects();

            vm.battleTimeUp = false;

            vm.counter =
                parseInt(vm.timerDuration, 10);

            if (
                isNaN(vm.counter) ||
                vm.counter < 0
            ) {
                vm.counter = 0;
            }

            vm.timerRunning = false;

            vm.endGame = true;
            vm.endGamePlayer1 = false;
            vm.endGamePlayer2 = false;

            vm.streakPlayer1 = 0;
            vm.streakPlayer2 = 0;
            vm.wrongPlayer1 = 0;
            vm.wrongPlayer2 = 0;
            vm.score1 = 0;
            vm.score2 = 0;

            stillInAQuestion1 = false;
            stillInAQuestion2 = false;

            vm.flipped1 = false;
            vm.flipped2 = false;

            if (
                keepLoadedQuestions === true &&
                vm.rawQuestions &&
                vm.rawQuestions.length > 0
            ) {
                vm.currentPosition = 0;
                vm.currentPosition1 = 0;

                vm.currentCard =
                    vm.questions.length > 0 ? vm.questions[0] : {};

                vm.currentCard1 =
                    vm.questions1.length > 0 ? vm.questions1[0] : {};
            }
        };

        vm.score1 = 0;
        vm.score2 = 0;
        vm.streakPlayer1 = 0;
        vm.streakPlayer2 = 0;
        vm.wrongPlayer1 = 0;
        vm.wrongPlayer2 = 0;
        vm.endGame = true;
        vm.endGamePlayer1 = false;
        vm.endGamePlayer2 = false;
        vm.flipped1 = false;
        vm.flipped2 = false;

        vm.nextCard = function (player) {
            shutUp();

            if (player === 2) {
                if (vm.currentPosition1 + 1 < vm.questions1.length) {
                    vm.currentPosition1 = vm.currentPosition1 + 1;
                    vm.currentCard1 =
                        vm.questions1[vm.currentPosition1];
                    vm.flipped2 = false;
                    sayIt(vm.currentCard1.question);
                }

                return;
            }

            if (vm.currentPosition + 1 < vm.questions.length) {
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard =
                    vm.questions[vm.currentPosition];
                vm.flipped1 = false;
                sayIt(vm.currentCard.question);
            }
        };

        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }

        vm.sayingWhenWrong = function () {
            var randomNumber = getRndInteger(1, 8);

            if (randomNumber === 1) {
                playAudioById('quiz-battle-sai');
            } else if (
                randomNumber === 2 ||
                randomNumber === 3 ||
                randomNumber === 6
            ) {
                playAudioById('quiz-battle-phai-chiu');
            } else if (randomNumber === 4) {
                playAudioById('quiz-battle-quec');
            } else if (randomNumber === 5) {
                playAudioById('quiz-battle-dung-co-keu');
            } else {
                playAudioById('quiz-battle-stupid');
            }
        };

        vm.answerQuizBattle2 = function (
            correct,
            item,
            questions,
            player
        ) {
            if (
                vm.endGame === true ||
                vm.battleTimeUp === true ||
                vm.timerRunning !== true ||
                Number(vm.counter) <= 0 ||
                isPlayerFrozen(player)
            ) {
                return;
            }

            angular.forEach(questions || [], function (value) {
                value.chosen = false;
            });

            if (correct == true) {
                if (player == 1) {
                    triggerFreezeSkill(1);
                    triggerBreakStreakSkill(1);

                    stillInAQuestion1 = false;

                    if ((vm.currentPosition + 1) >= vm.totalCard) {
                        announce('Player one is OVER');

                        if (vm.endGamePlayer1 == false) {
                            vm.score1 =
                                vm.score1 + (vm.counter / 12);
                        }

                        vm.endGamePlayer1 = true;

                        if (
                            vm.endGamePlayer1 &&
                            vm.endGamePlayer2
                        ) {
                            vm.endGame = true;
                            vm.timerRunning = false;

                            cancelBattleTimer();
                            stopBackgroundMusic();
                        }
                    } else if (vm.endGamePlayer1 == false) {
                        vm.streakPlayer1 = vm.streakPlayer1 + 1;

                        if (vm.streakPlayer1 >= 5) {
                            vm.score1 =
                                vm.score1 +
                                parseInt(vm.streakPlayer1 / 3, 10);
                        } else {
                            vm.score1 = vm.score1 + 1;
                        }

                        vm.nextCard(1);
                    }
                } else if (player == 2) {
                    triggerFreezeSkill(2);
                    triggerBreakStreakSkill(2);

                    stillInAQuestion2 = false;

                    if ((vm.currentPosition1 + 1) >= vm.totalCard) {
                        announce('Player two is OVER');

                        if (vm.endGamePlayer2 == false) {
                            vm.score2 =
                                vm.score2 + (vm.counter / 12);
                        }

                        vm.endGamePlayer2 = true;

                        if (
                            vm.endGamePlayer1 &&
                            vm.endGamePlayer2
                        ) {
                            vm.endGame = true;
                            vm.timerRunning = false;

                            cancelBattleTimer();
                            stopBackgroundMusic();
                        }
                    } else if (vm.endGamePlayer2 == false) {
                        vm.streakPlayer2 = vm.streakPlayer2 + 1;

                        if (vm.streakPlayer2 >= 5) {
                            vm.score2 =
                                vm.score2 +
                                parseInt(vm.streakPlayer2 / 3, 10);
                        } else {
                            vm.score2 = vm.score2 + 1;
                        }

                        vm.nextCard(2);
                    }
                }

                return;
            }

            if (player == 1 && vm.endGamePlayer1 == false) {
                if (stillInAQuestion1 == false) {
                    vm.wrongPlayer1 = vm.wrongPlayer1 + 1;
                    stillInAQuestion1 = true;

                    if (vm.streakPlayer1 >= 5) {
                        vm.sayingWhenWrong();
                    }
                }

                vm.streakPlayer1 = 0;
                vm.score1 = vm.score1 - 0.5;
            } else if (
                player == 2 &&
                vm.endGamePlayer2 == false
            ) {
                if (stillInAQuestion2 == false) {
                    vm.wrongPlayer2 = vm.wrongPlayer2 + 1;
                    stillInAQuestion2 = true;

                    if (vm.streakPlayer2 >= 5) {
                        vm.sayingWhenWrong();
                    }
                }

                vm.streakPlayer2 = 0;
                vm.score2 = vm.score2 - 0.5;
            }
        };

        function isTypingTarget(target) {
            if (!target) {
                return false;
            }

            var tagName = (target.tagName || '').toLowerCase();

            return (
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select' ||
                target.isContentEditable === true
            );
        }

        function getAnswerByIndex(player, index) {
            var card =
                player === 2 ? vm.currentCard1 : vm.currentCard;

            if (
                !card ||
                !card.questions ||
                !card.questions[index]
            ) {
                return null;
            }

            return card.questions[index];
        }

        function chooseAnswerFromKeyboard(player, index) {
            var answer = getAnswerByIndex(player, index);

            if (!answer) {
                return;
            }

            var card =
                player === 2 ? vm.currentCard1 : vm.currentCard;

            vm.answerQuizBattle2(
                answer.correct,
                answer,
                card.questions,
                player
            );
        }

        function keyboardHandler(event) {
            if (
                vm.endGame === true ||
                vm.battleTimeUp === true ||
                vm.timerRunning !== true ||
                Number(vm.counter) <= 0 ||
                isTypingTarget(event.target) ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                event.repeat
            ) {
                return;
            }

            var code = event.code || '';
            var key = String(event.key || '').toLowerCase();

            /*
             * CÀ KHỊA:
             * P1 = E
             * P2 = P
             */
            if (
                code === 'KeyE' ||
                key === 'e'
            ) {
                if (event.preventDefault) {
                    event.preventDefault();
                }

                $scope.$evalAsync(function () {
                    vm.taunt(1);
                });

                return;
            }

            if (
                code === 'KeyP' ||
                key === 'p'
            ) {
                if (event.preventDefault) {
                    event.preventDefault();
                }

                $scope.$evalAsync(function () {
                    vm.taunt(2);
                });

                return;
            }

            var player = 0;
            var index = -1;

            if (code === 'KeyQ' || key === 'q') {
                player = 1;
                index = 0;
            } else if (
                code === 'KeyW' ||
                key === 'w' ||
                key === 'ư'
            ) {
                player = 1;
                index = 1;
            } else if (code === 'KeyA' || key === 'a') {
                player = 1;
                index = 2;
            } else if (code === 'KeyS' || key === 's') {
                player = 1;
                index = 3;
            } else if (code === 'KeyI' || key === 'i') {
                player = 2;
                index = 0;
            } else if (code === 'KeyO' || key === 'o') {
                player = 2;
                index = 1;
            } else if (code === 'KeyK' || key === 'k') {
                player = 2;
                index = 2;
            } else if (code === 'KeyL' || key === 'l') {
                player = 2;
                index = 3;
            }

            if (player === 0 || index < 0) {
                return;
            }

            if (event.preventDefault) {
                event.preventDefault();
            }

            $scope.$evalAsync(function () {
                chooseAnswerFromKeyboard(player, index);
            });
        }

        document.addEventListener('keydown', keyboardHandler);

        $scope.$on('$destroy', function () {
            cancelBattleTimer();
            clearBattleEffects();
            stopBackgroundMusic();
            shutUp();

            document.removeEventListener(
                'keydown',
                keyboardHandler
            );
        });

        vm.getPageTopicCategory();
    }
})();
