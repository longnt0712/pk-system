(function () {
    'use strict';

    angular.module('Hrm.Question').controller(
        'DailyVocabController',
        DailyVocabController
    );

    DailyVocabController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'QuestionService',
        '$stateParams',
        'blockUI',
        '$cookies'
    ];

    function DailyVocabController(
        $rootScope,
        $scope,
        toastr,
        $timeout,
        settings,
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

        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        /*
         * DAILY VOCAB là một controller riêng.
         * mode chỉ giữ lại để tương thích với một số tên state cũ,
         * không còn dùng ViewController.
         */
        vm.mode = {
            id: 5,
            name: 'DAILY VOCAB'
        };

        vm.listFlashCard = $stateParams.listFlashCard || 0;

        // =====================================================
        // USER
        // =====================================================

        function getCurrentUser() {
            var raw = $cookies.get('education.user');

            if (!raw) {
                return {};
            }

            try {
                return JSON.parse(raw);
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

        var userAlreadyExists = false;

        angular.forEach(vm.users, function (user) {
            if (user.id == vm.myUser.id) {
                userAlreadyExists = true;
            }
        });

        if (!userAlreadyExists && vm.myUser.id != null) {
            vm.users.push(vm.myUser);
        }

        if (vm.isRoleUser === true) {
            vm.selectedUser = vm.myUser;
        } else if (vm.isRoleView === true) {
            vm.selectedUser = {
                id: 26,
                name: 'EM YÊU INH LÍCH'
            };
        } else {
            vm.selectedUser = vm.myUser.id != null
                ? vm.myUser
                : vm.users[0];
        }

        // =====================================================
        // SEARCH / TOPIC
        // =====================================================

        vm.searchDto = {
            upper: 100,
            lower: 0,
            type: 100,
            /*
             * DAILY VOCAB LAZY LOAD:
             * chỉ lấy 50 từ mỗi request.
             */
            pageSize: 50,
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
        vm.currentCard = {};
        vm.currentPosition = 0;
        vm.totalCard = 0;

        vm.title = '';
        vm.showTimer = false;

        function pushTopic(selectedTopics) {
            var result = [];

            angular.forEach(selectedTopics || [], function (topic) {
                result.push({
                    topic: topic
                });
            });

            return result;
        }

        function normalizeCategoryText(value) {
            return String(value || '')
                .toLowerCase()
                .trim();
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
                    vm.topics =
                        data && data.content
                            ? data.content
                            : [];
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
                        data && data.content
                            ? data.content
                            : [];

                    if (vm.topicCategories.length === 0) {
                        vm.topics = [];
                        return;
                    }

                    /*
                     * Mặc định Grade 6 giống yêu cầu hiện tại.
                     */
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
            vm.searchDto.userId = vm.selectedUser.id;
            vm.searchTopicDto.userId = vm.selectedUser.id;

            vm.selectedTopicToSearch = [];

            /*
             * Bỏ mọi request/buffer của user/bài cũ.
             */
            resetDailyLazyState(true);

            vm.resetDailyVocabRun();
            vm.getTopics();
        };

        // =====================================================
        // QUESTIONS / 4 ANSWERS
        // =====================================================

        function shuffleArray(array) {
            var result = (array || []).slice();
            var i;
            var j;
            var temp;

            for (i = result.length - 1; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));

                temp = result[i];
                result[i] = result[j];
                result[j] = temp;
            }

            return result;
        }

        /*
         * =====================================================
         * FAST QUESTION BUILDER
         * =====================================================
         *
         * Bản cũ dùng parents.filter(...) cho từng câu.
         * Với 1000 từ sẽ quét lại cả mảng rất nhiều lần.
         *
         * Bản mới chỉ random trực tiếp 3 đáp án sai.
         */
        function isSameDailyQuestion(left, right) {
            if (!left || !right) {
                return false;
            }

            if (
                left.id != null &&
                right.id != null
            ) {
                return left.id == right.id;
            }

            return left === right;
        }

        function pickFastDailyWrongAnswers(
            source,
            current,
            count,
            shouldShuffle
        ) {
            var pool = source || [];
            var result = [];
            var usedIndexes = {};
            var needed = Math.max(
                0,
                count || 0
            );

            if (
                needed <= 0 ||
                pool.length <= 1
            ) {
                return result;
            }

            if (shouldShuffle === true) {
                var maxAttempts =
                    Math.max(
                        20,
                        pool.length * 3
                    );

                var attempts = 0;

                while (
                    result.length < needed &&
                    attempts < maxAttempts
                ) {
                    attempts = attempts + 1;

                    var randomIndex =
                        Math.floor(
                            Math.random() *
                            pool.length
                        );

                    if (usedIndexes[randomIndex]) {
                        continue;
                    }

                    var candidate =
                        pool[randomIndex];

                    if (
                        !candidate ||
                        isSameDailyQuestion(
                            candidate,
                            current
                        )
                    ) {
                        continue;
                    }

                    usedIndexes[randomIndex] = true;
                    result.push(candidate);
                }
            }

            /*
             * Fallback tuyến tính:
             * - preview chưa shuffle
             * - hoặc random chưa lấy đủ 3 đáp án.
             */
            if (result.length < needed) {
                var index;

                for (
                    index = 0;
                    index < pool.length;
                    index = index + 1
                ) {
                    if (result.length >= needed) {
                        break;
                    }

                    if (usedIndexes[index]) {
                        continue;
                    }

                    var fallback =
                        pool[index];

                    if (
                        !fallback ||
                        isSameDailyQuestion(
                            fallback,
                            current
                        )
                    ) {
                        continue;
                    }

                    usedIndexes[index] = true;
                    result.push(fallback);
                }
            }

            return result;
        }

        function createOneDailyQuestionWithOptions(
            parent,
            answerSource,
            optionCount,
            shouldShuffleAnswers
        ) {
            if (!parent) {
                return {};
            }

            var totalOptions =
                optionCount || 4;

            var shuffleAnswers =
                shouldShuffleAnswers === true;

            var wrongAnswers =
                pickFastDailyWrongAnswers(
                    answerSource || [],
                    parent,
                    totalOptions - 1,
                    shuffleAnswers
                )
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

            var answers =
                [correctAnswer].concat(
                    wrongAnswers
                );

            if (shuffleAnswers) {
                answers =
                    shuffleArray(answers);
            }

            var question =
                angular.copy(parent);

            question.questions = answers;

            return question;
        }

        function createQuestionsWithOptions(
            parents,
            optionCount,
            shouldShuffleAnswers,
            answerSource
        ) {
            if (!Array.isArray(parents)) {
                return [];
            }

            var answerPool =
                answerSource || parents;

            return parents.map(function (parent) {
                return createOneDailyQuestionWithOptions(
                    parent,
                    answerPool,
                    optionCount,
                    shouldShuffleAnswers
                );
            });
        }


        // =====================================================
        // DAILY VOCAB - LAZY LOAD / BUFFER
        // =====================================================

        /*
         * Cơ chế giống QUIZ BATTLE 2:
         *
         * - request đầu: 50 từ
         * - có batch đầu là START được
         * - đang chơi thì tải tiếp ở background
         * - còn <= 20 câu ready thì prefetch batch tiếp
         * - mỗi nhịp chỉ build 8 câu để tránh block main thread
         */
        var DAILY_LAZY_PAGE_SIZE = 50;
        var DAILY_PREFETCH_THRESHOLD = 20;
        var DAILY_PREPARE_CHUNK_SIZE = 8;
        var DAILY_PREPARE_CHUNK_DELAY = 12;

        var dailyLazyGeneration = 0;
        var dailyLazyNextPage = 1;

        var dailyLazyPrepareTimer = null;
        var dailyLazyRetryTimer = null;
        var dailyLazyRetryCount = 0;

        vm.loadedCardCount = 0;
        vm.loadingMoreQuestions = false;
        vm.allQuestionsLoaded = false;
        vm.dailyLazyLoadError = false;
        vm.dailyBufferWaiting = false;

        function cancelDailyLazyTimers() {
            if (dailyLazyPrepareTimer !== null) {
                $timeout.cancel(
                    dailyLazyPrepareTimer
                );

                dailyLazyPrepareTimer = null;
            }

            if (dailyLazyRetryTimer !== null) {
                $timeout.cancel(
                    dailyLazyRetryTimer
                );

                dailyLazyRetryTimer = null;
            }
        }

        function resetDailyLazyState(
            clearQuestions
        ) {
            dailyLazyGeneration =
                dailyLazyGeneration + 1;

            cancelDailyLazyTimers();

            dailyLazyNextPage = 1;
            dailyLazyRetryCount = 0;

            vm.loadedCardCount = 0;
            vm.loadingMoreQuestions = false;
            vm.allQuestionsLoaded = false;
            vm.dailyLazyLoadError = false;
            vm.dailyBufferWaiting = false;

            if (clearQuestions === true) {
                vm.rawQuestions = [];
                vm.questions = [];
                vm.currentCard = {};
                vm.currentPosition = 0;
                vm.totalCard = 0;
            }
        }

        function updateDailyLoadedCount() {
            vm.loadedCardCount =
                vm.questions
                    ? vm.questions.length
                    : 0;
        }

        function buildDailyQuestions(
            shuffleAnswers
        ) {
            /*
             * Chỉ build số rawQuestions đang có trong RAM.
             *
             * Search mới bình thường chỉ có batch đầu 50 từ,
             * nên START không còn phải xử lý 1000 từ cùng lúc.
             */
            var parents =
                shuffleAnswers === true
                    ? shuffleArray(
                        vm.rawQuestions || []
                    )
                    : (vm.rawQuestions || []).slice();

            vm.questions =
                createQuestionsWithOptions(
                    parents,
                    4,
                    shuffleAnswers === true,
                    vm.rawQuestions
                );

            vm.currentPosition = 0;
            vm.currentCard =
                vm.questions.length > 0
                    ? vm.questions[0]
                    : {};

            vm.dailyBufferWaiting = false;

            updateDailyLoadedCount();
        }

        function appendUniqueDailyRawQuestions(
            batch
        ) {
            var existing = {};
            var appended = [];

            angular.forEach(
                vm.rawQuestions || [],
                function (question) {
                    if (
                        question &&
                        question.id != null
                    ) {
                        existing[
                            String(question.id)
                        ] = true;
                    }
                }
            );

            angular.forEach(
                batch || [],
                function (question) {
                    if (!question) {
                        return;
                    }

                    /*
                     * Không có id thì không thể dedupe an toàn.
                     */
                    if (question.id == null) {
                        vm.rawQuestions.push(question);
                        appended.push(question);
                        return;
                    }

                    var key =
                        String(question.id);

                    if (existing[key]) {
                        return;
                    }

                    existing[key] = true;

                    vm.rawQuestions.push(question);
                    appended.push(question);
                }
            );

            return appended;
        }

        function resumeDailyBufferIfNeeded() {
            if (
                vm.dailyBufferWaiting !== true ||
                vm.dailyVocabRunning !== true
            ) {
                return;
            }

            if (
                vm.currentPosition + 1 >=
                vm.questions.length
            ) {
                return;
            }

            vm.dailyBufferWaiting = false;

            vm.currentPosition =
                vm.currentPosition + 1;

            vm.currentCard =
                vm.questions[
                    vm.currentPosition
                ] || {};

            stillInAQuestion1 = false;

            if (
                vm.voiceEnabled === true &&
                vm.currentCard &&
                vm.currentCard.question
            ) {
                sayIt(
                    vm.currentCard.question
                );
            }
        }

        function prepareDailyBackgroundBatch(
            batch,
            requestGeneration,
            done
        ) {
            if (
                requestGeneration !==
                dailyLazyGeneration
            ) {
                done();
                return;
            }

            var parents =
                shuffleArray(batch || []);

            var index = 0;

            function processChunk() {
                if (
                    requestGeneration !==
                    dailyLazyGeneration
                ) {
                    dailyLazyPrepareTimer = null;
                    done();
                    return;
                }

                /*
                 * Nếu user đã dừng game trong lúc request về,
                 * không tốn CPU build tiếp.
                 * rawQuestions vẫn giữ để lần START sau dùng được.
                 */
                if (
                    vm.dailyVocabRunning !== true
                ) {
                    dailyLazyPrepareTimer = null;
                    done();
                    return;
                }

                var end =
                    Math.min(
                        index +
                            DAILY_PREPARE_CHUNK_SIZE,
                        parents.length
                    );

                var localIndex;

                for (
                    localIndex = index;
                    localIndex < end;
                    localIndex = localIndex + 1
                ) {
                    vm.questions.push(
                        createOneDailyQuestionWithOptions(
                            parents[localIndex],
                            vm.rawQuestions,
                            4,
                            true
                        )
                    );
                }

                index = end;

                updateDailyLoadedCount();
                resumeDailyBufferIfNeeded();

                if (index < parents.length) {
                    dailyLazyPrepareTimer =
                        $timeout(
                            processChunk,
                            DAILY_PREPARE_CHUNK_DELAY
                        );

                    return;
                }

                dailyLazyPrepareTimer = null;
                done();
            }

            /*
             * Yield trước khi build batch.
             */
            dailyLazyPrepareTimer =
                $timeout(
                    processChunk,
                    0
                );
        }

        function getDailyRemainingReadyQuestions() {
            return Math.max(
                0,
                vm.questions.length -
                vm.currentPosition -
                1
            );
        }

        function shouldPrefetchDailyQuestions() {
            if (
                vm.dailyVocabRunning !== true ||
                vm.dailyVocabAnswersEnabled !== true ||
                vm.loadingMoreQuestions === true ||
                vm.allQuestionsLoaded === true
            ) {
                return false;
            }

            return (
                getDailyRemainingReadyQuestions() <=
                DAILY_PREFETCH_THRESHOLD
            );
        }

        function scheduleDailyLazyRetry() {
            if (
                vm.dailyVocabRunning !== true ||
                vm.allQuestionsLoaded === true ||
                dailyLazyRetryCount >= 3
            ) {
                return;
            }

            dailyLazyRetryCount =
                dailyLazyRetryCount + 1;

            if (
                dailyLazyRetryTimer !== null
            ) {
                $timeout.cancel(
                    dailyLazyRetryTimer
                );
            }

            dailyLazyRetryTimer =
                $timeout(
                    function () {
                        dailyLazyRetryTimer = null;
                        loadNextDailyQuestionPage();
                    },
                    1200 *
                        dailyLazyRetryCount
                );
        }

        function loadNextDailyQuestionPage() {
            if (
                vm.loadingMoreQuestions === true ||
                vm.allQuestionsLoaded === true ||
                vm.dailyVocabRunning !== true
            ) {
                return;
            }

            var requestGeneration =
                dailyLazyGeneration;

            var page =
                dailyLazyNextPage;

            vm.loadingMoreQuestions = true;
            vm.dailyLazyLoadError = false;

            /*
             * Background request:
             * KHÔNG blockUI để gameplay không bị che/giật.
             */
            service.getPageForGames(
                vm.searchDto,
                page,
                DAILY_LAZY_PAGE_SIZE
            ).then(
                function (data) {
                    if (
                        requestGeneration !==
                        dailyLazyGeneration
                    ) {
                        return;
                    }

                    var content =
                        data && data.content
                            ? data.content
                            : [];

                    if (
                        data &&
                        angular.isDefined(
                            data.totalElements
                        )
                    ) {
                        vm.totalCard =
                            Number(
                                data.totalElements
                            ) ||
                            vm.totalCard;
                    }

                    dailyLazyNextPage =
                        page + 1;

                    var appended =
                        appendUniqueDailyRawQuestions(
                            content
                        );

                    var reachedLastPage =
                        (
                            vm.rawQuestions.length >=
                            vm.totalCard
                        ) ||
                        content.length <
                            DAILY_LAZY_PAGE_SIZE ||
                        content.length === 0;

                    if (appended.length === 0) {
                        vm.loadingMoreQuestions = false;

                        if (reachedLastPage) {
                            vm.allQuestionsLoaded = true;
                        }

                        updateDailyLoadedCount();
                        resumeDailyBufferIfNeeded();
                        return;
                    }

                    prepareDailyBackgroundBatch(
                        appended,
                        requestGeneration,
                        function () {
                            if (
                                requestGeneration !==
                                dailyLazyGeneration
                            ) {
                                return;
                            }

                            vm.loadingMoreQuestions = false;
                            vm.dailyLazyLoadError = false;
                            dailyLazyRetryCount = 0;

                            if (reachedLastPage) {
                                vm.allQuestionsLoaded = true;
                            }

                            updateDailyLoadedCount();
                            resumeDailyBufferIfNeeded();

                            /*
                             * Player trả lời cực nhanh:
                             * nếu buffer vẫn thấp thì nạp tiếp ngay.
                             */
                            if (
                                shouldPrefetchDailyQuestions()
                            ) {
                                loadNextDailyQuestionPage();
                            }
                        }
                    );
                },
                function () {
                    if (
                        requestGeneration !==
                        dailyLazyGeneration
                    ) {
                        return;
                    }

                    vm.loadingMoreQuestions = false;
                    vm.dailyLazyLoadError = true;

                    scheduleDailyLazyRetry();
                }
            );
        }

        function scheduleDailyQuestionPrefetch(
            force
        ) {
            if (
                vm.dailyVocabRunning !== true ||
                vm.dailyVocabAnswersEnabled !== true ||
                vm.allQuestionsLoaded === true ||
                vm.loadingMoreQuestions === true
            ) {
                return;
            }

            if (
                force === true ||
                shouldPrefetchDailyQuestions()
            ) {
                loadNextDailyQuestionPage();
            }
        }

        function loadInitialDailyQuestionPage() {
            var requestGeneration =
                dailyLazyGeneration;

            vm.loadingMoreQuestions = true;
            vm.dailyLazyLoadError = false;

            blockUI.start();

            service.getPageForGames(
                vm.searchDto,
                1,
                DAILY_LAZY_PAGE_SIZE
            ).then(
                function (data) {
                    if (
                        requestGeneration !==
                        dailyLazyGeneration
                    ) {
                        return;
                    }

                    var content =
                        data && data.content
                            ? data.content
                            : [];

                    vm.rawQuestions =
                        content.slice();

                    vm.totalCard =
                        data &&
                        angular.isDefined(
                            data.totalElements
                        )
                            ? Number(
                                data.totalElements
                            ) ||
                                content.length
                            : content.length;

                    dailyLazyNextPage = 2;

                    vm.allQuestionsLoaded =
                        (
                            vm.rawQuestions.length >=
                            vm.totalCard
                        ) ||
                        content.length <
                            DAILY_LAZY_PAGE_SIZE;

                    /*
                     * Preview chỉ build 50 từ đầu.
                     */
                    buildDailyQuestions(false);

                    vm.showTimer = true;
                    vm.loadingMoreQuestions = false;

                    vm.resetDailyVocabRun();
                },
                function () {
                    if (
                        requestGeneration !==
                        dailyLazyGeneration
                    ) {
                        return;
                    }

                    vm.loadingMoreQuestions = false;
                    vm.dailyLazyLoadError = true;

                    vm.rawQuestions = [];
                    vm.questions = [];
                    vm.currentCard = {};
                    vm.totalCard = 0;
                    vm.loadedCardCount = 0;

                    toastr.error(
                        'Không tải được dữ liệu DAILY VOCAB.',
                        'Thông báo'
                    );
                }
            ).finally(function () {
                blockUI.stop();
            });
        }

        vm.getPageFlashCard = function () {
            vm.searchDto.questionType = {id: 6};
            vm.searchDto.userId =
                vm.selectedUser.id;

            vm.searchDto.pageSize =
                DAILY_LAZY_PAGE_SIZE;

            vm.searchDto.pageIndex = 1;

            if (
                !vm.searchDto.questionTopics ||
                vm.searchDto.questionTopics.length <= 0
            ) {
                toastr.warning(
                    'Phải chọn bài từ vựng cần học rồi ấn TÌM KIẾM.'
                );
                return;
            }

            /*
             * Search mới:
             * invalidate mọi request/background của bài trước.
             */
            resetDailyLazyState(true);

            loadInitialDailyQuestionPage();
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
                        vm.title +=
                            ' ' + questionTopic.topic.name;
                    }
                }
            );

            vm.getPageFlashCard();
        };

        vm.nextCard = function () {
            shutUp();

            if (
                vm.currentPosition + 1 <
                vm.questions.length
            ) {
                vm.currentPosition += 1;

                vm.currentCard =
                    vm.questions[
                        vm.currentPosition
                    ];

                stillInAQuestion1 = false;
                vm.dailyBufferWaiting = false;

                if (
                    vm.voiceEnabled === true
                ) {
                    sayIt(
                        vm.currentCard.question
                    );
                }

                scheduleDailyQuestionPrefetch(
                    false
                );

                return;
            }

            /*
             * Hết BUFFER, chưa phải hết toàn bộ 1000 từ.
             * Tạm khóa answer cho tới khi batch nền tới.
             */
            if (
                vm.currentPosition + 1 <
                vm.totalCard
            ) {
                vm.dailyBufferWaiting = true;

                scheduleDailyQuestionPrefetch(
                    true
                );
            }
        };

        // =====================================================
        // TIMER RIÊNG DAILY VOCAB
        // =====================================================

        var dailyVocabTimeout = null;

        vm.dailyVocabDuration = 900;
        vm.dailyVocabCounter = 900;
        vm.dailyVocabRunning = false;
        vm.dailyVocabAnswersEnabled = false;

        // =====================================================
        // RUNNING MAN MODE
        // =====================================================

        /*
         * Luật chung:
         *
         * - HỌC SINH bắt đầu cách NGU đúng 5 khoảng.
         * - Trả lời ĐÚNG: +1 khoảng.
         * - Trả lời SAI: -1 khoảng.
         * - NGU tự tiến theo thời gian: -1 khoảng.
         * - gap <= 0: bị bắt -> thua.
         *
         * Độ khó chỉ thay đổi tốc độ của NGU,
         * còn phần thưởng câu đúng luôn +1 để trọng tâm
         * vẫn là học thuộc và trả lời nhanh.
         */
        var runningManTimeout = null;
        var runningManTauntTimeout = null;

        vm.runningManDevilTaunt = '';

        /*
         * Thoại khi kết thúc RUNNING MAN.
         */
        vm.runningManStudentVictoryQuote = '';
        vm.runningManDevilLoseQuote = '';

        var runningManStudentVictoryQuotes = [
            'Mình làm được rồi! Cứ cố gắng là sẽ tiến bộ 💪',
            'Không có từ nào khó nếu mình chịu học mỗi ngày ✨',
            'Học một chút mỗi ngày, rồi mình sẽ giỏi hơn hôm qua 😎',
            'Kiên trì thật sự có tác dụng. Mình đã làm được! 🏆',
            'Chậm cũng được, miễn là mình không bỏ cuộc 💙',
            'Học chăm thì chẳng có con quỷ nào đuổi kịp mình 😏',
            'Mỗi từ nhớ được là một bước tiến về phía trước 🚀',
            'Mình thắng vì mình đã chịu học. Quá đã! 🔥'
        ];

        var runningManDevilLoseQuotes = [
            'Lười học thì sẽ bị ta ăn thịt! Hahaha 😈',
            'Không học thì chạy mấy cũng không thoát đâu! Hahaha 👿',
            'Ta đã bảo rồi, không nhớ từ là ta bắt được ngay 😏',
            'Học đi rồi quay lại đấu với ta nhé! Hahaha 😈',
            'Chạy nhanh mà không thuộc bài thì cũng vô ích thôi 👿',
            'Ta bắt được rồi! Lần sau nhớ học chăm hơn nhé 😈',
            'Không học là thành bữa tối của ta đấy! Hahaha 🍴😈',
            'Hahaha! Muốn thoát ta thì phải học thuộc trước đã 👿'
        ];

        function getRandomRunningManQuote(list) {
            if (!list || list.length === 0) {
                return '';
            }

            var index =
                Math.floor(
                    Math.random() *
                    list.length
                );

            return list[index];
        }

        var runningManDevilTaunts = [
            'Không học thì chạy mấy cũng bị bắt 😈',
            'Không thuộc từ là ta dí kịp ngay 😏',
            'Chạy nhanh chưa đủ, phải nhớ từ nữa nhé 😈',
            'Sai nhiều là khoảng cách ngắn lại đấy 😎',
            'Học đi rồi hãy mong thoát khỏi ta 😈',
            'Không nhớ từ thì chuẩn bị bị bắt nhé 👿',
            'Cố lên, ta đang ở ngay phía sau 😏',
            'Đừng chỉ chạy, nhớ đáp án nữa chứ 😈'
        ];

        function cancelRunningManTauntTimeout() {
            if (runningManTauntTimeout !== null) {
                $timeout.cancel(runningManTauntTimeout);
                runningManTauntTimeout = null;
            }

            vm.runningManDevilTaunt = '';
        }

        function scheduleRunningManTaunt() {
            cancelRunningManTauntTimeout();

            if (
                vm.runningManEnabled !== true ||
                vm.runningManActive !== true ||
                vm.runningManLost === true ||
                vm.runningManWon === true
            ) {
                return;
            }

            /*
             * Taunt xuất hiện ngẫu nhiên khoảng 9 - 15 giây/lần.
             * Không quá dày để không làm mất tập trung khi học.
             */
            var delay =
                9000 +
                Math.floor(Math.random() * 6001);

            runningManTauntTimeout =
                $timeout(
                    function () {
                        if (
                            vm.runningManEnabled !== true ||
                            vm.runningManActive !== true ||
                            vm.runningManLost === true ||
                            vm.runningManWon === true
                        ) {
                            runningManTauntTimeout = null;
                            return;
                        }

                        var index =
                            Math.floor(
                                Math.random() *
                                runningManDevilTaunts.length
                            );

                        vm.runningManDevilTaunt =
                            runningManDevilTaunts[index];

                        runningManTauntTimeout =
                            $timeout(
                                function () {
                                    vm.runningManDevilTaunt = '';
                                    runningManTauntTimeout = null;

                                    scheduleRunningManTaunt();
                                },
                                2200
                            );
                    },
                    delay
                );
        }

        vm.runningManEnabled = false;
        vm.runningManDifficultyModal = false;
        vm.runningManDifficulty = null;
        vm.runningManDifficultyName = '';
        vm.runningManChaseInterval = 0;
        vm.runningManChaseIntervalLabel = '';

        vm.runningManInitialGap = 5;
        vm.runningManGap = 5;
        vm.runningManStudentLeft = 48;

        vm.runningManActive = false;
        vm.runningManLost = false;
        vm.runningManWon = false;

        var runningManDifficultyMap = {
            easy: {
                id: 'easy',
                name: 'DỄ',
                interval: 8000,
                intervalLabel: '8 giây'
            },
            medium: {
                id: 'medium',
                name: 'TRUNG BÌNH',
                interval: 6000,
                intervalLabel: '6 giây'
            },
            hard: {
                id: 'hard',
                name: 'KHÓ',
                interval: 4500,
                intervalLabel: '4.5 giây'
            },
            insane: {
                id: 'insane',
                name: 'SIÊU KHÓ',
                interval: 3200,
                intervalLabel: '3.2 giây'
            }
        };

        function cancelRunningManTimeout() {
            if (runningManTimeout !== null) {
                $timeout.cancel(runningManTimeout);
                runningManTimeout = null;
            }
        }

        function updateRunningManPosition() {
            var gap = Number(vm.runningManGap || 0);

            if (gap < 0) {
                gap = 0;
            }

            /*
             * Track hiển thị tối đa 10 khoảng để HỌC SINH
             * không chạy ra khỏi thanh.
             *
             * Gap thật vẫn có thể > 10 và vẫn được hiển thị bằng số.
             */
            var visualGap = Math.min(gap, 10);

            vm.runningManStudentLeft =
                8 + (visualGap * 8);

            if (vm.runningManStudentLeft > 88) {
                vm.runningManStudentLeft = 88;
            }

            if (vm.runningManStudentLeft < 8) {
                vm.runningManStudentLeft = 8;
            }
        }

        function resetRunningManRound() {
            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();

            vm.runningManGap =
                vm.runningManInitialGap;

            vm.runningManActive = false;
            vm.runningManLost = false;
            vm.runningManWon = false;

            vm.runningManStudentVictoryQuote = '';
            vm.runningManDevilLoseQuote = '';

            updateRunningManPosition();
        }

        vm.openRunningManDifficulty = function () {
            if (vm.dailyVocabRunning === true) {
                toastr.warning(
                    'Hãy reset lượt chơi trước khi đổi chế độ RUNNING MAN.',
                    'RUNNING MAN'
                );
                return;
            }

            vm.runningManDifficultyModal = true;
        };

        vm.closeRunningManDifficulty = function () {
            vm.runningManDifficultyModal = false;
        };

        vm.selectRunningManDifficulty = function (level) {
            if (vm.dailyVocabRunning === true) {
                return;
            }

            var config =
                runningManDifficultyMap[level];

            if (!config) {
                return;
            }

            vm.runningManEnabled = true;
            vm.runningManDifficulty = config.id;
            vm.runningManDifficultyName = config.name;
            vm.runningManChaseInterval =
                config.interval;
            vm.runningManChaseIntervalLabel =
                config.intervalLabel;

            vm.runningManDifficultyModal = false;

            resetRunningManRound();

            toastr.info(
                'RUNNING MAN ' +
                config.name +
                ': NGU tiến 1 khoảng mỗi ' +
                config.intervalLabel +
                '.',
                'RUNNING MAN'
            );
        };

        vm.disableRunningMan = function () {
            if (vm.dailyVocabRunning === true) {
                toastr.warning(
                    'Hãy reset lượt chơi trước khi tắt RUNNING MAN.',
                    'RUNNING MAN'
                );
                return;
            }

            cancelRunningManTimeout();

            vm.runningManEnabled = false;
            vm.runningManDifficulty = null;
            vm.runningManDifficultyName = '';
            vm.runningManChaseInterval = 0;
            vm.runningManChaseIntervalLabel = '';
            vm.runningManDifficultyModal = false;

            resetRunningManRound();
        };

        function runningManLose() {
            if (
                vm.runningManEnabled !== true ||
                vm.runningManLost === true
            ) {
                return;
            }

            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();
            cancelDailyVocabTimeout();

            vm.runningManGap = 0;
            vm.runningManActive = false;
            vm.runningManLost = true;
            vm.runningManWon = false;

            vm.runningManStudentVictoryQuote = '';
            vm.runningManDevilLoseQuote =
                getRandomRunningManQuote(
                    runningManDevilLoseQuotes
                );

            updateRunningManPosition();

            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;

            vm.finishDailyVocab = 'BỊ BẮT';

            stopBackgroundMusic();
            shutUp();

            playAudioById('boom-sound', false);

            toastr.error(
                'NGU đã bắt kịp HỌC SINH! Reset để thử lại.',
                'RUNNING MAN'
            );
        }

        function runningManTick() {
            if (
                vm.runningManEnabled !== true ||
                vm.runningManActive !== true ||
                vm.dailyVocabRunning !== true
            ) {
                runningManTimeout = null;
                return;
            }

            /*
             * Không để mạng chậm làm NGU tiến lên miễn phí.
             * Trong lúc chờ buffer, cuộc đuổi bắt tạm đứng.
             */
            if (vm.dailyBufferWaiting === true) {
                runningManTimeout =
                    $timeout(
                        runningManTick,
                        250
                    );

                return;
            }

            vm.runningManGap =
                Number(vm.runningManGap || 0) - 1;

            updateRunningManPosition();

            if (vm.runningManGap <= 0) {
                runningManLose();
                return;
            }

            runningManTimeout =
                $timeout(
                    runningManTick,
                    vm.runningManChaseInterval
                );
        }

        function startRunningManRound() {
            cancelRunningManTimeout();

            if (
                vm.runningManEnabled !== true ||
                !vm.runningManDifficulty ||
                vm.runningManChaseInterval <= 0
            ) {
                return;
            }

            vm.runningManGap =
                vm.runningManInitialGap;

            vm.runningManLost = false;
            vm.runningManWon = false;
            vm.runningManActive = true;

            updateRunningManPosition();

            runningManTimeout =
                $timeout(
                    runningManTick,
                    vm.runningManChaseInterval
                );

            /*
             * NGU bắt đầu thỉnh thoảng cà khịa sau khi cuộc đuổi
             * bắt thực sự bắt đầu.
             */
            scheduleRunningManTaunt();
        }

        function runningManCorrectAnswer() {
            if (
                vm.runningManEnabled !== true ||
                vm.runningManActive !== true ||
                vm.runningManLost === true
            ) {
                return;
            }

            /*
             * Câu đúng = chạy xa thêm 1 khoảng.
             */
            vm.runningManGap =
                Number(vm.runningManGap || 0) + 1;

            updateRunningManPosition();
        }

        function runningManWrongAnswer() {
            if (
                vm.runningManEnabled !== true ||
                vm.runningManActive !== true ||
                vm.runningManLost === true
            ) {
                return;
            }

            /*
             * Câu sai = mất 1 khoảng.
             */
            vm.runningManGap =
                Number(vm.runningManGap || 0) - 1;

            updateRunningManPosition();

            /*
             * Sai mà khoảng cách về 0 thì NGU bắt được ngay.
             */
            if (vm.runningManGap <= 0) {
                runningManLose();
            }
        }

        function runningManFinishWin() {
            if (
                vm.runningManEnabled !== true ||
                vm.runningManLost === true
            ) {
                return;
            }

            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();

            vm.runningManActive = false;
            vm.runningManWon = true;

            vm.runningManDevilLoseQuote = '';
            vm.runningManStudentVictoryQuote =
                getRandomRunningManQuote(
                    runningManStudentVictoryQuotes
                );
        }

        function cancelDailyVocabTimeout() {
            if (dailyVocabTimeout !== null) {
                $timeout.cancel(dailyVocabTimeout);
                dailyVocabTimeout = null;
            }
        }

        vm.dailyVocabTimerSettingChange = function () {
            var value =
                parseInt(vm.dailyVocabDuration, 10);

            if (isNaN(value) || value < 1) {
                value = 1;
            }

            if (value > 9999) {
                value = 9999;
            }

            vm.dailyVocabDuration = value;

            /*
             * Khi chưa chạy, sửa SET TIMER là đồng hồ phía trên
             * đổi ngay lập tức.
             */
            if (vm.dailyVocabRunning !== true) {
                vm.dailyVocabCounter = value;
            }
        };

        vm.stopDailyVocabTimer = function () {
            cancelDailyVocabTimeout();
            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();

            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;
            vm.dailyBufferWaiting = false;
            vm.runningManActive = false;

            stopBackgroundMusic();
            shutUp();
        };

        vm.resetDailyVocabTimer = function () {
            vm.stopDailyVocabTimer();

            vm.dailyVocabCounter =
                parseInt(vm.dailyVocabDuration, 10) || 900;

            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;

            resetRunningManRound();
        };

        function dailyVocabTimeUp() {
            cancelDailyVocabTimeout();
            cancelRunningManTimeout();

            vm.dailyVocabCounter = 0;
            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;
            vm.dailyBufferWaiting = false;
            vm.runningManActive = false;

            stopBackgroundMusic();
            shutUp();

            playAudioById('boom-sound', false);
        }

        function dailyVocabTick() {
            if (vm.dailyVocabRunning !== true) {
                return;
            }

            /*
             * Nếu mạng chậm đến mức hết buffer:
             * không trừ thời gian của người học.
             */
            if (vm.dailyBufferWaiting === true) {
                dailyVocabTimeout =
                    $timeout(
                        dailyVocabTick,
                        250
                    );

                return;
            }

            if (Number(vm.dailyVocabCounter) <= 1) {
                dailyVocabTimeUp();
                return;
            }

            vm.dailyVocabCounter =
                Number(vm.dailyVocabCounter) - 1;

            dailyVocabTimeout =
                $timeout(dailyVocabTick, 1000);
        }

        vm.startDailyVocab = function () {
            if (vm.dailyVocabRunning === true) {
                return;
            }

            if (!vm.rawQuestions || vm.rawQuestions.length === 0) {
                toastr.warning(
                    'Chưa có dữ liệu. Hãy chọn bài và nhấn TÌM KIẾM trước.'
                );
                return;
            }

            cancelDailyVocabTimeout();
            shutUp();

            /*
             * Chỉ khi bấm đồng hồ mới bắt đầu:
             * - Trộn câu.
             * - Trộn 4 đáp án.
             * - Hiện đáp án.
             */
            buildDailyQuestions(true);

            vm.resetDailyVocabSaveState();

            vm.finishDailyVocab = 'Unfinished';
            vm.dailyVocabCounter =
                parseInt(vm.dailyVocabDuration, 10) || 900;

            vm.dailyVocabRunning = true;
            vm.dailyVocabAnswersEnabled = true;

            vm.score1 = 0;
            vm.streakPlayer1 = 0;
            vm.wrongPlayer1 = 0;
            vm.tempWrong = '';

            stillInAQuestion1 = false;

            vm.showStart = true;
            vm.showWrong = false;
            vm.showCorrect = false;

            startBackgroundMusic();

            /*
             * Nếu đã chọn RUNNING MAN thì cuộc đuổi bắt
             * bắt đầu cùng lúc với đồng hồ DAILY VOCAB.
             */
            startRunningManRound();

            /*
             * Có batch đầu là chơi ngay.
             * Batch 2 được tải ngầm ngay sau START.
             */
            scheduleDailyQuestionPrefetch(true);

            if (vm.voiceEnabled === true && vm.currentCard) {
                sayIt(vm.currentCard.question);
            }

            /*
             * Giữ nguyên số ban đầu trong 1 giây đầu.
             */
            dailyVocabTimeout =
                $timeout(dailyVocabTick, 1000);
        };

        // =====================================================
        // AUDIO / SPEECH
        // =====================================================

        /*
         * DAILY VOCAB - trạng thái ÂM THANH theo nghĩa dương:
         *
         * true  = BẬT
         * false = TẮT
         *
         * Như vậy trạng thái switch trên giao diện khớp hoàn toàn
         * với hành vi mà người dùng nhìn thấy.
         */
        vm.voiceEnabled = true;
        vm.backgroundMusicEnabled = false;
        vm.speechLang = 'en-US';

        // =====================================================
        // DARK MODE - chỉ dành cho DAILY VOCAB
        // =====================================================

        var dailyVocabDarkModeStorageKey =
            'dailyVocab.darkMode';

        function loadDailyVocabDarkMode() {
            try {
                var saved =
                    window.localStorage.getItem(
                        dailyVocabDarkModeStorageKey
                    );

                vm.darkModeEnabled =
                    saved === 'true';
            } catch (e) {
                /*
                 * Nếu browser chặn localStorage,
                 * vẫn cho dark mode hoạt động trong phiên hiện tại.
                 */
                vm.darkModeEnabled = false;
            }
        }

        vm.toggleDarkMode = function () {
            vm.darkModeEnabled =
                vm.darkModeEnabled === true;

            try {
                window.localStorage.setItem(
                    dailyVocabDarkModeStorageKey,
                    vm.darkModeEnabled
                        ? 'true'
                        : 'false'
                );
            } catch (e) {
                // Không để lỗi storage ảnh hưởng game.
            }
        };

        loadDailyVocabDarkMode();

        var backgroundAudio = null;

        function getAudio(id) {
            return document.getElementById(id);
        }

        function playAudioById(id, loop) {
            var element = getAudio(id);

            if (!element) {
                return;
            }

            try {
                element.pause();
                element.currentTime = 0;
                element.loop = loop === true;

                var promise = element.play();

                if (
                    promise &&
                    angular.isFunction(promise.catch)
                ) {
                    promise.catch(angular.noop);
                }
            } catch (e) {
                // Browser có thể chặn autoplay.
            }
        }

        function stopBackgroundMusic() {
            if (!backgroundAudio) {
                return;
            }

            try {
                backgroundAudio.pause();
                backgroundAudio.currentTime = 0;
                backgroundAudio.loop = false;
            } catch (e) {
                // Không làm gì.
            }

            backgroundAudio = null;
        }

        function startBackgroundMusic() {
            stopBackgroundMusic();

            if (vm.backgroundMusicEnabled !== true) {
                return;
            }

            var ids = [
                'audio-1',
                'audio-5',
                'audio-6',
                'audio-7'
            ];

            var randomId =
                ids[Math.floor(Math.random() * ids.length)];

            backgroundAudio = getAudio(randomId);

            if (!backgroundAudio) {
                return;
            }

            try {
                backgroundAudio.currentTime = 0;
                backgroundAudio.loop = true;

                var promise = backgroundAudio.play();

                if (
                    promise &&
                    angular.isFunction(promise.catch)
                ) {
                    promise.catch(angular.noop);
                }
            } catch (e) {
                // Không làm gì.
            }
        }

        function sayIt(text) {
            if (
                vm.voiceEnabled !== true ||
                !text ||
                !window.speechSynthesis
            ) {
                return;
            }

            try {
                window.speechSynthesis.cancel();

                var utterance =
                    new SpeechSynthesisUtterance(
                        String(text)
                    );

                utterance.lang = 'en-US';
                utterance.rate = 1;
                utterance.pitch = 1;
                utterance.volume = 1;

                var voices =
                    window.speechSynthesis.getVoices() || [];

                var selectedVoice = null;

                angular.forEach(voices, function (voice) {
                    if (
                        !selectedVoice &&
                        voice &&
                        voice.lang &&
                        (
                            voice.lang === 'en-US' ||
                            voice.lang.indexOf('en-') === 0
                        )
                    ) {
                        selectedVoice = voice;
                    }
                });

                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }

                window.speechSynthesis.speak(
                    utterance
                );
            } catch (e) {
                // Speech lỗi không làm hỏng game.
            }
        }

        function shutUp() {
            if (!window.speechSynthesis) {
                return;
            }

            try {
                window.speechSynthesis.cancel();
            } catch (e) {
                // Không làm gì.
            }
        }

        vm.sayCurrentWord = function () {
            if (vm.currentCard) {
                sayIt(vm.currentCard.question);
            }
        };

        /*
         * GIỌNG ĐỌC
         * Switch ON  -> voiceEnabled = true  -> được phép nói.
         * Switch OFF -> voiceEnabled = false -> dừng speech ngay.
         */
        vm.toggleVoice = function () {
            if (vm.voiceEnabled !== true) {
                shutUp();
                return;
            }

            /*
             * Nếu đang làm bài và vừa bật lại giọng đọc,
             * đọc luôn từ hiện tại để user thấy switch có tác dụng ngay.
             */
            if (
                vm.dailyVocabRunning === true &&
                vm.currentCard &&
                vm.currentCard.question
            ) {
                sayIt(vm.currentCard.question);
            }
        };

        /*
         * NHẠC NỀN
         * Switch ON  -> backgroundMusicEnabled = true.
         * Switch OFF -> backgroundMusicEnabled = false và dừng nhạc ngay.
         */
        vm.toggleBackgroundMusic = function () {
            if (vm.backgroundMusicEnabled !== true) {
                stopBackgroundMusic();
                return;
            }

            /*
             * Chỉ tự phát nhạc khi game đang chạy.
             * Nếu chưa bấm START thì chỉ lưu trạng thái ON,
             * tới lúc bắt đầu game nhạc mới chạy.
             */
            if (vm.dailyVocabRunning === true) {
                startBackgroundMusic();
            }
        };

        vm.sayingWhenWrong = function () {
            var wrongAudioIds = [
                'sai',
                'phai-chiu',
                'quec',
                'dung-co-keu',
                'stupid'
            ];

            var randomId =
                wrongAudioIds[
                    Math.floor(
                        Math.random() *
                        wrongAudioIds.length
                    )
                ];

            playAudioById(randomId, false);
        };

        // =====================================================
        // FEEDBACK IMAGE
        // =====================================================

        vm.showStart = true;
        vm.showWrong = false;
        vm.showCorrect = false;

        vm.linkStart1 =
            'https://lh3.googleusercontent.com/pw/AP1GczPEqogicPymXIHsXPhJdbo0Mg6-d5MJE8aJ1w4XbxXWe295w-ZDBc_HmtgDy_iwALkaM_yM99TedpZYmdvz5wbhl4QhdvbL8yEWZBs35wLU7y-iiM4VA-mAYRUmq9JfpUt5fJlaZC4C9P5qhjbcoKgB=w919-h919-s-no-gm?authuser=1';

        vm.linkStart2 =
            'https://lh3.googleusercontent.com/pw/AP1GczMlQpFC5mxUfomDjlskHiy-_wKfnSN_YBmA8iWr-f17Ypb5siqavs308dIOTsrDYbQHIA2Ia3__A9jOwMDcP4-NBkJYB4X3iOzJzjfrwxGBzRFunsZof5okn6_0CBTTcHbHFNGrPan_cfnvY6WFLWiR=w919-h919-s-no-gm?authuser=1';

        var correctImages = [
            'https://lh3.googleusercontent.com/pw/AP1GczMWD3uVqUpqROszj5p_a0W5j2lvpD_Nuh8P0rCmeh03DNmj1CE-XOttzUpK7vWtBgjtbbdsuw_X-i3jskTDSxMloH5U_2scXD-B5BTpTchPfv8h1RQGIgx5PG0e22SHpYo5Pcf4GEIWi-TIxLvOkXMj=w989-h989-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczPL-li6WBV1fJoowvP5987OYY389QGXS01oLKysc4LAW-bljOk4B1wzGhyVRZNdEfP0aX3ajQYvZEFQTWFHQwsWnn1HvgGSOrjdtBamVUbn8BAACuoEXVNQalmz-IlFshHL3d_qYwoVuInT4i8nLVrN=w989-h989-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczPrexogtWayS4t4D5VRWp3UswdLhwuurFtsvqUe-Qy3HUELJ-N6D8_qSL0PYjemP14C3AcKMo4VO960W_8oaeQxuF5oB5L-9bw6MFkI1BPf6SNmda8y7cK15XqyPx3gul-HKaJKAA58XWRvbrSZu2d2=w989-h989-s-no-gm?authuser=1',
            vm.linkStart2
        ];

        var wrongImages = [
            'https://lh3.googleusercontent.com/pw/AP1GczMUHTKwnGcAhVh37rguI5kYNzMR-dOPYNhaBRpzswBtoOsZoqBeuhRquwkh0lWUbxUQo4DoKo3fRB5Rr_0JwpD3L7V5_LIGwp81X866DIWdzqHAFLX6fc2Y-_Vzzl3iemRkC8gRe8nPLHiVHifRotM2=w989-h989-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczMjCTwNZ8YxHbhBnhF09K6XlW1HUJ4jeNHgE6wn_Rj2TxKGikeSXYx__oUL7xPWCVNOaPTETUvMJDSIEFgmA4msqSZQ3byIaY37oPaCXOOgxL-XdHqf-glIIIwiN8S1U47I3z3R6z_sq0TtH8T9lpO_=w989-h989-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczMLB7Qj4lPY1GHl8v__m74-K0sEdJXzLN7Os2wgIcy3UxNRmMiX0BYXM1AB4PjPIwMVMehIoALtnrxoBL8T9O433ZmHh5g94--u4B6yz1BKrKp3bbBVRezoaP8bU1Aedfos5r89SZwni1oz-btiCcbO=w989-h989-s-no-gm?authuser=1'
        ];

        vm.changeImageForAnswer = function () {
            vm.linkImageCorrect =
                correctImages[
                    Math.floor(
                        Math.random() *
                        correctImages.length
                    )
                ];

            vm.linkImageWrong =
                wrongImages[
                    Math.floor(
                        Math.random() *
                        wrongImages.length
                    )
                ];
        };

        vm.changeImageForAnswer();

        // =====================================================
        // KEYBOARD SHORTCUTS - DAILY VOCAB
        //
        // 1 -> Q
        // 2 -> W / Ư
        // 3 -> A
        // 4 -> S
        //
        // Dùng event.code thay vì event.key để vẫn hoạt động
        // khi UniKey / Telex đang bật.
        // =====================================================

        var dailyVocabKeyboardMap = {
            KeyQ: 0,
            KeyW: 1,
            KeyA: 2,
            KeyS: 3
        };

        function isEditableKeyboardTarget(target) {
            if (!target) {
                return false;
            }

            var tagName =
                String(target.tagName || '')
                    .toLowerCase();

            if (
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select'
            ) {
                return true;
            }

            if (
                target.isContentEditable === true ||
                target.getAttribute('contenteditable') === 'true'
            ) {
                return true;
            }

            return false;
        }

        function dailyVocabKeyboardHandler(event) {
            event = event || window.event;

            if (!event) {
                return;
            }

            /*
             * Không cho giữ phím tạo nhiều lần answer liên tiếp.
             */
            if (event.repeat === true) {
                return;
            }

            /*
             * Ctrl / Alt / Meta có thể là shortcut của browser/OS.
             */
            if (
                event.ctrlKey === true ||
                event.altKey === true ||
                event.metaKey === true
            ) {
                return;
            }

            /*
             * Khi user đang nhập text/search/timer thì KHÔNG bắt
             * Q/W/A/S để tránh phá việc gõ chữ bằng UniKey.
             */
            if (isEditableKeyboardTarget(event.target)) {
                return;
            }

            var answerIndex =
                dailyVocabKeyboardMap[event.code];

            /*
             * Fallback cho UniKey / Telex / browser cũ:
             * Nếu event.code không cho kết quả, đọc thêm event.key.
             *
             * Đặc biệt:
             *   W / w / Ư / ư  => đáp án 2
             */
            if (answerIndex === undefined) {
                var pressedKey =
                    String(event.key || '')
                        .toLowerCase();

                var dailyVocabKeyboardKeyMap = {
                    q: 0,
                    w: 1,
                    'ư': 1,
                    a: 2,
                    s: 3
                };

                answerIndex =
                    dailyVocabKeyboardKeyMap[pressedKey];
            }

            if (answerIndex === undefined) {
                return;
            }

            /*
             * Chỉ nhận shortcut khi game thực sự đang chạy
             * và 4 đáp án đang được phép chọn.
             */
            if (
                vm.dailyVocabRunning !== true ||
                vm.dailyVocabAnswersEnabled !== true ||
                vm.dailyBufferWaiting === true ||
                Number(vm.dailyVocabCounter) <= 0
            ) {
                return;
            }

            if (
                !vm.currentCard ||
                !angular.isArray(vm.currentCard.questions) ||
                !vm.currentCard.questions[answerIndex]
            ) {
                return;
            }

            var selectedAnswer =
                vm.currentCard.questions[answerIndex];

            /*
             * Ngăn browser xử lý phím theo cách khác sau khi
             * đã xác định đây là shortcut của DAILY VOCAB.
             */
            if (event.preventDefault) {
                event.preventDefault();
            }

            if (event.stopPropagation) {
                event.stopPropagation();
            }

            /*
             * Listener chạy ngoài Angular digest.
             */
            $scope.$evalAsync(function () {
                vm.answerDailyVocab(
                    selectedAnswer.correct,
                    selectedAnswer,
                    vm.currentCard.questions
                );
            });
        }

        document.addEventListener(
            'keydown',
            dailyVocabKeyboardHandler,
            false
        );

        /*
         * Khi rời DAILY VOCAB phải gỡ listener,
         * tránh shortcut tiếp tục chạy ở trang khác.
         */
        $scope.$on('$destroy', function () {
            document.removeEventListener(
                'keydown',
                dailyVocabKeyboardHandler,
                false
            );
        });

        // =====================================================
        // SCORE / ANSWER
        // =====================================================

        var stillInAQuestion1 = false;

        vm.score1 = 0;
        vm.streakPlayer1 = 0;
        vm.wrongPlayer1 = 0;
        vm.finishDailyVocab = 'Unfinished';
        vm.tempWrong = '';

        vm.answerDailyVocab = function (
            correct,
            item,
            questions
        ) {
            /*
             * Khi 4 đáp án đang hiện thì click phải được xử lý.
             */
            if (
                vm.dailyVocabRunning !== true ||
                vm.dailyVocabAnswersEnabled !== true ||
                vm.dailyBufferWaiting === true ||
                Number(vm.dailyVocabCounter) <= 0
            ) {
                return;
            }

            if (!angular.isArray(questions) || !item) {
                return;
            }

            var isCorrect =
                correct === true ||
                correct === 1 ||
                String(correct).toLowerCase() === 'true';

            angular.forEach(
                questions,
                function (answer) {
                    answer.chosen = false;
                }
            );

            item.chosen = true;

            vm.changeImageForAnswer();

            if (isCorrect) {
                vm.showStart = false;
                vm.showWrong = false;
                vm.showCorrect = true;

                stillInAQuestion1 = false;

                vm.streakPlayer1 =
                    Number(vm.streakPlayer1 || 0) + 1;

                /*
                 * RUNNING MAN:
                 * đúng thì HỌC SINH chạy xa thêm 1 khoảng.
                 */
                runningManCorrectAnswer();

                if (vm.streakPlayer1 >= 5) {
                    vm.score1 =
                        Number(vm.score1 || 0) +
                        parseInt(
                            vm.streakPlayer1 / 3,
                            10
                        );
                } else {
                    vm.score1 =
                        Number(vm.score1 || 0) + 1;
                }

                /*
                 * Câu cuối.
                 */
                if (
                    vm.currentPosition + 1 >=
                    vm.totalCard
                ) {
                    vm.score1 =
                        Number(vm.score1 || 0) +
                        (
                            Number(
                                vm.dailyVocabCounter
                            ) / 12
                        );

                    vm.score1 =
                        Number(vm.score1).toFixed(2);

                    vm.currentPosition += 1;

                    /*
                     * Hoàn thành toàn bộ từ trước khi bị bắt
                     * = thắng RUNNING MAN.
                     */
                    runningManFinishWin();

                    try {
                        window.speechSynthesis.speak(
                            new SpeechSynthesisUtterance(
                                'Player one is OVER'
                            )
                        );
                    } catch (e) {
                        // Không làm gì.
                    }

                    if (
                        vm.isSaveTestResult !== true
                    ) {
                        vm.saveTestResult();
                    }

                    vm.stopDailyVocabTimer();
                    return;
                }

                vm.nextCard();
                return;
            }

            /*
             * Sai.
             */
            vm.showStart = false;
            vm.showWrong = true;
            vm.showCorrect = false;

            /*
             * RUNNING MAN:
             * trả lời sai thì bị NGU thu hẹp 1 khoảng ngay.
             */
            runningManWrongAnswer();

            /*
             * runningManWrongAnswer() có thể làm thua ngay
             * và dừng lượt chơi nếu khoảng cách <= 0.
             */
            if (vm.runningManLost === true) {
                return;
            }

            vm.streakPlayer1 = 0;
            vm.score1 =
                Number(vm.score1 || 0) - 0.5;

            if (stillInAQuestion1 === false) {
                vm.wrongPlayer1 =
                    Number(vm.wrongPlayer1 || 0) + 1;

                stillInAQuestion1 = true;

                if (!vm.testResult) {
                    vm.setUpTestResult();
                }

                if (
                    !vm.testResult
                        .testTakerPerformance
                ) {
                    vm.testResult
                        .testTakerPerformance = '';
                }

                vm.testResult
                    .testTakerPerformance +=
                    (
                        (
                            vm.currentCard &&
                            vm.currentCard.question
                        ) || ''
                    ) +
                    ' --- ' +
                    (
                        (
                            vm.currentCard &&
                            vm.currentCard.motherTongue
                        ) || ''
                    ) +
                    ' <br> ';

                vm.tempWrong =
                    vm.testResult
                        .testTakerPerformance;
            }

            vm.sayingWhenWrong();
        };

        // =====================================================
        // TEST RESULT
        // =====================================================

        vm.testResult = {};
        vm.isSaveTestResult = false;
        vm.savingTestResult = false;

        vm.setUpTestResult = function () {
            vm.testResult = {
                user: vm.currentUser,
                testTakerPerformance: '',
                totalWord: vm.totalCard
            };

            vm.isSaveTestResult = false;
        };

        vm.resetDailyVocabSaveState = function () {
            vm.isSaveTestResult = false;
            vm.savingTestResult = false;
            vm.finishDailyVocab = 'Unfinished';
            vm.tempWrong = '';

            vm.setUpTestResult();
        };

        vm.saveTestResult = function () {
            if (
                vm.savingTestResult === true ||
                vm.isSaveTestResult === true
            ) {
                return;
            }

            vm.savingTestResult = true;

            if (!vm.testResult) {
                vm.setUpTestResult();
            }

            vm.testResult.testType = 1;
            vm.testResult.testName =
                (vm.title || 'DAILY VOCAB')
                    .substring(0, 50);

            vm.testResult.testTime =
                vm.totalCard.toString() +
                ' WORD(s)|' +
                vm.score1.toString() +
                'pt' +
                '|INCORRECT: ' +
                vm.wrongPlayer1.toString() +
                '|TIME: ' +
                vm.dailyVocabCounter +
                '/' +
                vm.dailyVocabDuration;

            vm.testResult.numberOfWords =
                Math.max(
                    0,
                    vm.totalCard -
                    vm.wrongPlayer1
                );

            vm.testResult.totalWord =
                vm.totalCard;

            blockUI.start();

            service.saveTestResult(
                vm.testResult
            ).then(
                function (data) {
                    if (
                        data &&
                        data.messageCode == 1
                    ) {
                        toastr.error(
                            'Sai quá nhiều => chưa đạt',
                            'Thông báo'
                        );

                        vm.finishDailyVocab =
                            'Not Passed';
                    } else {
                        toastr.info(
                            'Lưu thành công',
                            'Thông báo'
                        );

                        vm.finishDailyVocab =
                            'Finished';
                    }

                    if (data) {
                        vm.testResult.id = data.id;
                    }

                    vm.isSaveTestResult = true;
                },
                function () {
                    toastr.error(
                        'Có lỗi xảy ra.',
                        'Thông báo'
                    );
                }
            ).finally(function () {
                vm.savingTestResult = false;
                blockUI.stop();
            });
        };

        vm.resetDailyVocabRun = function () {
            vm.resetDailyVocabTimer();

            resetRunningManRound();

            vm.resetDailyVocabSaveState();

            vm.currentPosition = 0;
            vm.dailyBufferWaiting = false;

            vm.score1 = 0;
            vm.streakPlayer1 = 0;
            vm.wrongPlayer1 = 0;
            vm.tempWrong = '';

            stillInAQuestion1 = false;

            vm.showStart = true;
            vm.showWrong = false;
            vm.showCorrect = false;

            if (vm.questions.length > 0) {
                vm.currentCard =
                    vm.questions[0];
            }
        };

        vm.setUpTestResult();

        // =====================================================
        // CLEANUP
        // =====================================================

        $scope.$on('$destroy', function () {
            cancelDailyVocabTimeout();
            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();
            cancelDailyLazyTimers();

            stopBackgroundMusic();
            shutUp();
        });

        /*
         * Load Grade 6 + danh sách bài ngay khi vào trang.
         */
        vm.getPageTopicCategory();
    }
})();
