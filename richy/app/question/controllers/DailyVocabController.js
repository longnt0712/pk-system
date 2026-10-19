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

        function speakEnglish(text, options) {
            if (window.EnglishSpeech) {
                window.EnglishSpeech.speak(text, options || {lang: 'en-US'});
            }
        }

        function stopEnglishSpeech() {
            if (window.EnglishSpeech) { window.EnglishSpeech.cancel(); }
        }

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
        vm.assignmentLaunch = {
            taskId: $stateParams.assignmentTaskId || null,
            topicId: $stateParams.assignmentTopicId || null,
            categoryId: $stateParams.assignmentCategoryId || null,
            applied: false
        };
        vm.assignmentSelectionLocked = !!vm.assignmentLaunch.taskId;

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

        var activeDailyResumeDraft = null;
        var activeDailyLastPersistAt = 0;
        var activeDailyRunId = null;
        var dailyCloudDrafts = {};

        function saveDailyLearningDraft(key, type, title, draft) {
            if (!key || !draft) { return; }
            return service.saveLearningDraft({
                draftKey: key,
                draftType: type,
                title: title || 'Daily Vocab',
                payload: JSON.stringify(draft),
                savedAt: Number(draft.savedAt || draft.createdAt) || Date.now()
            }).catch(angular.noop);
        }

        function deleteDailyLearningDraft(key) {
            if (key) { service.deleteLearningDraft(key).catch(angular.noop); }
        }

        function dailyAssignmentIdentity(draft) {
            var result = (draft || {}).payload || (draft || {}).testResult || {};
            return {
                taskId: (draft || {}).assignmentTaskId || result.assignmentTaskId || null,
                topicId: (draft || {}).assignmentTopicId || result.assignmentTopicId
                    || ((draft || {}).topicIds && draft.topicIds.length === 1 ? draft.topicIds[0] : null)
            };
        }

        function dailyAssignmentSuffix(assignment) {
            if (!assignment || !assignment.taskId || !assignment.topicId) { return ''; }
            return ':task:' + assignment.taskId + ':topic:' + assignment.topicId;
        }

        function dailyDraftMatchesLaunch(draft) {
            var identity = dailyAssignmentIdentity(draft);
            if (!vm.assignmentSelectionLocked) { return !identity.taskId; }
            return String(identity.taskId) === String(vm.assignmentLaunch.taskId)
                && String(identity.topicId) === String(vm.assignmentLaunch.topicId);
        }

        function dailyDraftValue(key) {
            var local = null;
            try { local = JSON.parse(window.localStorage.getItem(key)); } catch (ignoreLocalDraft) {}
            var cloud = dailyCloudDrafts[key];
            return cloud && (!local || dailyDraftTimestamp(cloud) > dailyDraftTimestamp(local)
                || (dailyDraftTimestamp(cloud) === dailyDraftTimestamp(local) && local.localFallback === true && cloud.localFallback !== true)) ? cloud : local;
        }

        function validDailyPendingDraft(draft, userId) {
            var result = draft && draft.payload;
            return !!draft && draft.version === 1 && String(draft.ownerId) === String(userId)
                && !!result && result.testType === 1 && !!result.user && String(result.user.id) === String(userId)
                && /^[a-f0-9]{32}$/.test(result.clientAttemptKey || '') && result.totalWord > 0 && draft.createdAt > 0;
        }

        function readDailyScopedDraft(userId, pending) {
            var prefix = pending ? 'daily-vocab-pending:v1:' : 'daily-vocab-active:v1:';
            var legacyKey = prefix + userId;
            var key = pending ? dailyDraftKey(userId) : activeDailyDraftKey(userId);
            var keys = [key, legacyKey];
            var requested = null;
            if (pending) {
                try {
                    requested = window.sessionStorage.getItem('daily-vocab-pending-resume:v1:' + userId);
                    window.sessionStorage.removeItem('daily-vocab-pending-resume:v1:' + userId);
                } catch (ignorePendingChoice) {}
                try {
                    for (var index = 0; index < window.localStorage.length; index++) {
                        var storedKey = window.localStorage.key(index);
                        if (storedKey && storedKey.indexOf(key + ':attempt:') === 0) { keys.push(storedKey); }
                    }
                } catch (ignorePendingKeys) {}
                Object.keys(dailyCloudDrafts).forEach(function (cloudKey) {
                    if (cloudKey.indexOf(key + ':attempt:') === 0) { keys.push(cloudKey); }
                });
            }
            if (!pending) {
                try {
                    for (var activeIndex = 0; activeIndex < window.localStorage.length; activeIndex++) {
                        var activeKey = window.localStorage.key(activeIndex);
                        if (activeKey && activeKey.indexOf(key + ':run:') === 0) { keys.push(activeKey); }
                    }
                } catch (ignoreActiveKeys) {}
                Object.keys(dailyCloudDrafts).forEach(function (cloudKey) {
                    if (cloudKey.indexOf(key + ':run:') === 0) { keys.push(cloudKey); }
                });
            }
            var candidates = [];
            keys.forEach(function (candidateKey, index) {
                if (keys.indexOf(candidateKey) !== index) { return; }
                var draft = dailyDraftValue(candidateKey);
                if (!draft || !dailyDraftMatchesLaunch(draft) || (pending && !validDailyPendingDraft(draft, userId))) { return; }
                candidates.push({key: candidateKey, draft: draft});
            });
            candidates.sort(function (first, second) {
                if (requested && first.key === requested) { return -1; }
                if (requested && second.key === requested) { return 1; }
                return dailyDraftTimestamp(second.draft) - dailyDraftTimestamp(first.draft)
                    || (first.draft.localFallback === true ? 1 : 0) - (second.draft.localFallback === true ? 1 : 0);
            });
            if (!candidates.length) { return null; }
            var selected = candidates[0];
            var draft = selected.draft;
            if (!pending && selected.key.indexOf(key + ':run:') === 0) { draft.cloudDraftKey = selected.key; }
            if (pending) {
                draft.storageKey = selected.key;
            } else if (selected.key === legacyKey && key !== legacyKey) {
                var movedLocally = false;
                try {
                    window.localStorage.setItem(key, JSON.stringify(draft));
                    window.localStorage.removeItem(legacyKey);
                    movedLocally = true;
                } catch (ignoreLegacyMigration) {}
                dailyCloudDrafts[key] = draft;
                saveDailyLearningDraft(key, 'DAILY_VOCAB', draft.title, draft);
                if (movedLocally) { deleteDailyLearningDraft(legacyKey); delete dailyCloudDrafts[legacyKey]; }
            }
            return draft;
        }

        function dailyDraftTimestamp(draft) {
            return Number((draft || {}).savedAt || (draft || {}).createdAt || (draft || {}).updatedAt) || 0;
        }

        function loadDailyLearningDrafts() {
            if (!vm.currentUser || !vm.currentUser.id) { return null; }
            return service.getLearningDrafts().then(function (items) {
                angular.forEach(items || [], function (item) {
                    if (!item || (item.draftType !== 'DAILY_VOCAB' && item.draftType !== 'DAILY_VOCAB_PENDING')
                            || !item.draftKey || !item.payload) { return; }
                    var expectedActive = activeDailyDraftKey(vm.currentUser.id);
                    var expectedPending = dailyDraftKey(vm.currentUser.id);
                    var legacyActive = 'daily-vocab-active:v1:' + vm.currentUser.id;
                    var legacyPending = 'daily-vocab-pending:v1:' + vm.currentUser.id;
                    if (item.draftKey !== expectedActive && item.draftKey !== expectedPending
                            && item.draftKey.indexOf(expectedPending + ':attempt:') !== 0
                            && item.draftKey.indexOf(expectedActive + ':run:') !== 0
                            && item.draftKey !== legacyActive && item.draftKey !== legacyPending) { return; }
                    try {
                        var serverDraft = JSON.parse(item.payload);
                        if (!dailyDraftMatchesLaunch(serverDraft)) { return; }
                        if (item.draftType === 'DAILY_VOCAB') { serverDraft.cloudDraftKey = item.draftKey; }
                        dailyCloudDrafts[item.draftKey] = serverDraft;
                        var localDraft = null;
                        try { localDraft = JSON.parse(window.localStorage.getItem(item.draftKey)); } catch (ignoreLocalRead) {}
                        if (!localDraft || Number(item.savedAt) >= dailyDraftTimestamp(localDraft)) {
                            window.localStorage.setItem(item.draftKey, item.payload);
                        }
                    } catch (ignoreServerDraft) {}
                });
            }, angular.noop);
        }

        function activeDailyDraftKey(userId) {
            return 'daily-vocab-active:v1:' + userId + dailyAssignmentSuffix(vm.assignmentLaunch);
        }

        function removeActiveDailyDraft(ownerId) {
            if (!ownerId) { return; }
            var key = activeDailyDraftKey(ownerId);
            var draft = dailyDraftValue(key);
            if (activeDailyRunId && draft && draft.runId && draft.runId !== activeDailyRunId) { return; }
            var cloudKey = (draft || {}).cloudDraftKey || (activeDailyRunId ? key + ':run:' + activeDailyRunId : key);
            try { window.localStorage.removeItem(key); window.localStorage.removeItem(cloudKey); } catch (ignore) {}
            delete dailyCloudDrafts[key];
            delete dailyCloudDrafts[cloudKey];
            deleteDailyLearningDraft(cloudKey);
        }

        function readActiveDailyDraft() {
            if (!vm.currentUser || !vm.currentUser.id) { return null; }
            try {
                var draft = readDailyScopedDraft(vm.currentUser.id, false);
                if (!draft) { return null; }
                if (draft.localFallback === true) {
                    vm.dailyDraftRecoveryBlocked = true;
                    toastr.warning('Bản lưu trên trình duyệt chưa đầy đủ. Hãy kết nối mạng và tải lại trang để khôi phục đầy đủ tiến độ trước khi làm tiếp.');
                    return null;
                }
                vm.dailyDraftRecoveryBlocked = false;
                if (!draft || draft.version !== 1 || draft.ownerId !== vm.currentUser.id ||
                    !draft.savedAt ||
                    !angular.isArray(draft.topicIds) || draft.topicIds.length === 0 ||
                    !angular.isArray(draft.questions) || draft.questions.length === 0) {
                    removeActiveDailyDraft(vm.currentUser.id);
                    return null;
                }
                return draft;
            } catch (ignore) {
                return null;
            }
        }

        function chooseActiveDailyResume() {
            if (vm.assignmentSelectionLocked) { return; }
            var draft = readActiveDailyDraft();
            if (!draft) { return; }
            try {
                var dashboardResumeKey = 'daily-vocab-dashboard-resume:v1:' + vm.currentUser.id;
                if (window.sessionStorage.getItem(dashboardResumeKey) === '1') {
                    window.sessionStorage.removeItem(dashboardResumeKey);
                    activeDailyResumeDraft = draft;
                    return;
                }
            } catch (ignoreDashboardResumeFlagError) {}
            if (window.confirm('Bạn có một bài Daily Vocab đang làm dở. Bạn muốn tiếp tục không?')) {
                activeDailyResumeDraft = draft;
                return;
            }
            if (window.confirm('Bạn muốn làm lại thật chứ? Toàn bộ tiến độ đang làm dở sẽ bị xóa.')) {
                removeActiveDailyDraft(vm.currentUser.id);
                return;
            }
            activeDailyResumeDraft = draft;
        }

        function loadDailyAssignment() {
            if (!vm.assignmentSelectionLocked) { return null; }
            return service.getAssignedTask(vm.assignmentLaunch.taskId).then(function (task) {
                var topicIds = task && angular.isArray(task.topicIds) && task.topicIds.length
                    ? task.topicIds : (task && task.topicId ? [task.topicId] : []);
                var requested = vm.assignmentLaunch.topicId || topicIds[0];
                var allowed = topicIds.some(function (id) { return String(id) === String(requested); });
                if (!task || task.activityType !== 'DAILY_VOCAB' || !allowed) {
                    vm.assignmentLaunch.invalid = true;
                    toastr.error('Topic này không thuộc bài được giao hoặc bài đã hết hạn. Hãy mở lại bài từ trang chủ.');
                    return;
                }
                vm.assignmentLaunch.topicId = requested;
                vm.assignmentLaunch.verified = true;
                vm.assignmentLaunch.topicIds = topicIds.slice(0);
                var assignedTopic = null;
                angular.forEach(task.topics || [], function (topic) {
                    if (String(topic.topicId) === String(requested)) { assignedTopic = topic; }
                });
                vm.assignmentLaunch.categoryId = (assignedTopic || {}).categoryId
                    || (String(task.topicId) === String(requested) ? task.categoryId : null) || vm.assignmentLaunch.categoryId;
            }, function () {
                vm.assignmentLaunch.invalid = true;
                toastr.error('Chưa kiểm tra được bài được giao. Vui lòng tải lại trang để thử lại.');
            });
        }

        var assignmentReady = loadDailyAssignment();
        var dailyLearningDraftsReady = assignmentReady
            ? assignmentReady.then(loadDailyLearningDrafts) : loadDailyLearningDrafts();

        vm.myUser = {
            id: vm.currentUser.id,
            name: getFullName(vm.currentUser),
            roles: vm.currentUser.roles || []
        };

        function getVocabularyTotalWords(user) {
            if (user && user.totalVocabularyWordsLearned != null) {
                return Math.max(0, Number(user.totalVocabularyWordsLearned) || 0);
            }

            return Math.max(0, Number((user || {}).vocabularyExperienceLevel) || 0) * 1000 +
                Math.max(0, Number((user || {}).vocabularyExperienceWords) || 0);
        }

        vm.getUserVocabularyLevel = function (user) {
            return Math.floor(getVocabularyTotalWords(user) / 1000);
        };

        vm.getUserVocabularyProgressPercent = function (user) {
            return (getVocabularyTotalWords(user) % 1000) / 10;
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

        // This selects the vocabulary source, not the student taking the task.
        // Set it before loading topics so assignment links resolve shared lessons.
        vm.selectedUser = vm.users[0];

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

        function findById(items, id) {
            var found = null;
            angular.forEach(items || [], function (item) {
                if (!found && item && String(item.id) === String(id)) { found = item; }
            });
            return found;
        }

        function applyAssignedTopic() {
            if (vm.assignmentLaunch.invalid || !vm.assignmentLaunch.topicId || vm.assignmentLaunch.applied) { return; }
            var assignedTopic = findById(vm.topics, vm.assignmentLaunch.topicId);
            if (!assignedTopic) {
                toastr.warning('Topic của bài được giao không còn trong danh sách.');
                return;
            }
            vm.assignmentLaunch.applied = true;
            vm.selectedTopicToSearch = [assignedTopic];
            vm.searchTopicChange();
        }

        function enforceAssignedTopicSelection() {
            if (!vm.assignmentSelectionLocked) { return true; }
            if (vm.assignmentLaunch.invalid) { return false; }
            var assignedTopic = findById(vm.topics, vm.assignmentLaunch.topicId);
            if (!assignedTopic) {
                toastr.warning('Topic của bài được giao không còn trong danh sách.');
                return false;
            }
            vm.selectedTopicToSearch = [assignedTopic];
            vm.searchDto.questionTopics = pushTopic(vm.selectedTopicToSearch);
            return true;
        }

        function applyResumeTopics() {
            if (!activeDailyResumeDraft || activeDailyResumeDraft.topicApplied) { return false; }
            var selected = [];
            angular.forEach(activeDailyResumeDraft.topicIds || [], function (topicId) {
                var topic = findById(vm.topics, topicId);
                if (topic) { selected.push(topic); }
            });
            if (!selected.length) {
                toastr.warning('Bài đang làm dở không còn topic tương ứng nên không thể tiếp tục.');
                removeActiveDailyDraft(vm.currentUser.id);
                activeDailyResumeDraft = null;
                return false;
            }
            activeDailyResumeDraft.topicApplied = true;
            vm.selectedTopicToSearch = selected;
            vm.searchTopicChange();
            return true;
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
                    if (!applyResumeTopics()) { applyAssignedTopic(); }
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
                        findById(vm.topicCategories, activeDailyResumeDraft && activeDailyResumeDraft.categoryId) ||
                        findById(vm.topicCategories, vm.assignmentLaunch.categoryId) ||
                        findGrade6Category(vm.topicCategories) || vm.topicCategories[0];

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
            if (vm.assignmentSelectionLocked) { return; }
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

        /*
         * Không đưa bản ghi thiếu từ hoặc thiếu nghĩa vào lượt chơi.
         * Backend vẫn có thể tính các bản ghi này trong totalElements;
         * nếu giữ lại, giao diện sẽ chuyển tới một "câu trắng".
         */
        function isPlayableDailyQuestion(question) {
            if (!question) {
                return false;
            }

            var word = String(question.question || '').trim();
            var meaning = String(question.motherTongue || '').trim();

            return word.length > 0 && meaning.length > 0;
        }

        function getPlayableDailyQuestions(questions) {
            return (questions || []).filter(
                isPlayableDailyQuestion
            );
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

        /*
         * TIMER MẶC ĐỊNH:
         * tổng số từ x 7 giây.
         */
        var DAILY_SECONDS_PER_WORD = 7;

        /*
         * Số raw question đã được biến thành question chơi
         * trong RUN hiện tại.
         *
         * Khi chơi lại, dù cache đã có 1000 từ,
         * START vẫn chỉ build 50 từ đầu.
         */
        var dailyPreparedRawCount = 0;

        var dailyLazyGeneration = 0;
        var dailyLazyNextPage = 1;

        var dailyLazyPrepareTimer = null;
        var dailyLazyRetryTimer = null;
        var dailyLazyRetryCount = 0;

        vm.loadedCardCount = 0;
        vm.loadingMoreQuestions = false;
        vm.dailyLazyHttpPending = false;
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

        function stopDailyLazyBackgroundWork() {
            /*
             * Invalidate callback/request của RUN cũ.
             * Request HTTP có thể vẫn hoàn tất ở browser,
             * nhưng callback cũ sẽ không được phép append/build.
             */
            dailyLazyGeneration =
                dailyLazyGeneration + 1;

            cancelDailyLazyTimers();

            vm.loadingMoreQuestions = false;
            vm.dailyLazyHttpPending = false;
            vm.dailyLazyLoadError = false;
            vm.dailyBufferWaiting = false;
        }

        function getDefaultDailyVocabTimerSeconds() {
            var total =
                parseInt(vm.totalCard, 10);

            if (isNaN(total) || total <= 0) {
                return 0;
            }

            var seconds =
                total *
                DAILY_SECONDS_PER_WORD;

            if (seconds > 999999) {
                seconds = 999999;
            }

            return seconds;
        }

        function applyDefaultDailyVocabTimer() {
            var seconds =
                getDefaultDailyVocabTimerSeconds();

            if (seconds <= 0) {
                return;
            }

            vm.dailyVocabDuration = seconds;
            vm.dailyVocabCounter = seconds;
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
            vm.dailyLazyHttpPending = false;
            vm.allQuestionsLoaded = false;
            vm.dailyLazyLoadError = false;
            vm.dailyBufferWaiting = false;

            dailyPreparedRawCount = 0;

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
             * Mỗi lần START chỉ build tối đa 50 từ đầu.
             * Nếu cache đã có 500 / 1000 từ, phần còn lại
             * được chuẩn bị nền theo chunk.
             */
            var initialSource =
                (vm.rawQuestions || []).slice(
                    0,
                    DAILY_LAZY_PAGE_SIZE
                );

            var parents =
                shuffleAnswers === true
                    ? shuffleArray(
                        initialSource
                    )
                    : initialSource.slice();

            vm.questions =
                createQuestionsWithOptions(
                    parents,
                    4,
                    shuffleAnswers === true,
                    vm.rawQuestions
                );

            dailyPreparedRawCount =
                initialSource.length;

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
                    if (!isPlayableDailyQuestion(question)) {
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
                /*
                 * Server đã hết trang nhưng totalElements có thể lớn hơn
                 * số câu hợp lệ/không trùng thực tế. Người chơi vừa trả lời
                 * câu cuối của buffer thật, vì vậy phải kết thúc thay vì
                 * đứng mãi ở "ĐANG NẠP CÂU TIẾP THEO".
                 */
                if (
                    vm.allQuestionsLoaded === true &&
                    !hasCachedDailyQuestionsToPrepare() &&
                    vm.loadingMoreQuestions !== true
                ) {
                    vm.totalCard = vm.questions.length;
                    finishDailyVocabSuccessfully();
                }

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

            function finishBatch() {
                if (
                    requestGeneration !==
                    dailyLazyGeneration ||
                    vm.dailyVocabRunning !== true
                ) {
                    done();
                    return;
                }

                dailyPreparedRawCount =
                    dailyPreparedRawCount +
                    parents.length;

                /*
                 * Chỉ digest một lần khi xong batch.
                 */
                $scope.$evalAsync(function () {
                    updateDailyLoadedCount();
                    resumeDailyBufferIfNeeded();
                    done();
                });
            }

            function processChunk() {
                if (
                    requestGeneration !==
                    dailyLazyGeneration
                ) {
                    dailyLazyPrepareTimer = null;
                    done();
                    return;
                }

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

                if (index < parents.length) {
                    /*
                     * invokeApply = false:
                     * không ép Angular digest sau từng chunk.
                     */
                    dailyLazyPrepareTimer =
                        $timeout(
                            processChunk,
                            DAILY_PREPARE_CHUNK_DELAY,
                            false
                        );

                    return;
                }

                dailyLazyPrepareTimer = null;
                finishBatch();
            }

            dailyLazyPrepareTimer =
                $timeout(
                    processChunk,
                    0,
                    false
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

        function hasCachedDailyQuestionsToPrepare() {
            return (
                dailyPreparedRawCount <
                (vm.rawQuestions || []).length
            );
        }

        function getNextCachedDailyBatch() {
            if (
                !hasCachedDailyQuestionsToPrepare()
            ) {
                return [];
            }

            return (
                vm.rawQuestions || []
            ).slice(
                dailyPreparedRawCount,
                Math.min(
                    dailyPreparedRawCount +
                        DAILY_LAZY_PAGE_SIZE,
                    vm.rawQuestions.length
                )
            );
        }

        function shouldPrefetchDailyQuestions() {
            if (
                vm.dailyVocabRunning !== true ||
                vm.dailyVocabAnswersEnabled !== true ||
                vm.loadingMoreQuestions === true ||
                (
                    vm.allQuestionsLoaded === true &&
                    !hasCachedDailyQuestionsToPrepare()
                )
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
                vm.allQuestionsLoaded === true
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
                    Math.min(
                        5000,
                        1200 * dailyLazyRetryCount
                    )
                );
        }

        function loadNextDailyQuestionPage() {
            if (
                vm.loadingMoreQuestions === true ||
                vm.dailyVocabRunning !== true
            ) {
                return;
            }

            var requestGeneration =
                dailyLazyGeneration;

            /*
             * Nếu cache từ lượt trước còn dữ liệu chưa prepare,
             * dùng RAM trước, không request server lại.
             */
            if (
                hasCachedDailyQuestionsToPrepare()
            ) {
                var cachedBatch =
                    getNextCachedDailyBatch();

                if (cachedBatch.length <= 0) {
                    return;
                }

                vm.loadingMoreQuestions = true;
                vm.dailyLazyLoadError = false;

                prepareDailyBackgroundBatch(
                    cachedBatch,
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

                        updateDailyLoadedCount();
                        resumeDailyBufferIfNeeded();

                        if (
                            shouldPrefetchDailyQuestions()
                        ) {
                            loadNextDailyQuestionPage();
                        }
                    }
                );

                return;
            }

            if (vm.allQuestionsLoaded === true) {
                return;
            }

            var page =
                dailyLazyNextPage;

            vm.loadingMoreQuestions = true;
            vm.dailyLazyHttpPending = true;
            vm.dailyLazyLoadError = false;

            /*
             * Background request:
             * KHÔNG blockUI để gameplay không bị che/giật.
             */
            service.getPageForDailyVocab(
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

                    vm.dailyLazyHttpPending = false;

                    var content =
                        data && data.content
                            ? data.content
                            : [];

                    var playableContent =
                        getPlayableDailyQuestions(content);

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
                            playableContent
                        );

                    var reachedLastPage =
                        (data && data.last === true) ||
                        (
                            data &&
                            angular.isDefined(data.totalPages) &&
                            page >= Number(data.totalPages)
                        ) ||
                        content.length <
                            DAILY_LAZY_PAGE_SIZE ||
                        content.length === 0;

                    if (appended.length === 0) {
                        vm.loadingMoreQuestions = false;

                        if (reachedLastPage) {
                            vm.allQuestionsLoaded = true;
                            vm.totalCard = vm.rawQuestions.length;
                        }

                        updateDailyLoadedCount();
                        resumeDailyBufferIfNeeded();

                        if (
                            reachedLastPage !== true &&
                            vm.dailyVocabRunning === true
                        ) {
                            loadNextDailyQuestionPage();
                        }

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
                                vm.totalCard = vm.rawQuestions.length;
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

                    vm.dailyLazyHttpPending = false;
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
                (
                    vm.allQuestionsLoaded === true &&
                    !hasCachedDailyQuestionsToPrepare()
                ) ||
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
            var requestedTopicIds = (vm.searchDto.questionTopics || []).map(function (link) { return link.topic.id; });
            var requestGeneration =
                dailyLazyGeneration;

            vm.loadingMoreQuestions = true;
            vm.dailyLazyLoadError = false;

            blockUI.start();

            service.getPageForDailyVocab(
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
                        getPlayableDailyQuestions(content);
                    vm.resultTopicIds = requestedTopicIds;

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
                        (data && data.last === true) ||
                        (
                            data &&
                            angular.isDefined(data.totalPages) &&
                            Number(data.totalPages) <= 1
                        ) ||
                        content.length <
                            DAILY_LAZY_PAGE_SIZE;

                    if (vm.allQuestionsLoaded === true) {
                        vm.totalCard = vm.rawQuestions.length;
                    }

                    /*
                     * Timer mặc định = TOTAL x 7 giây.
                     * 1000 từ -> 7000 giây.
                     */
                    applyDefaultDailyVocabTimer();

                    /*
                     * Preview chỉ build 50 từ đầu.
                     */
                    buildDailyQuestions(false);

                    vm.showTimer = true;
                    vm.loadingMoreQuestions = false;

                    vm.resetDailyVocabRun();
                    resumeActiveDailySession();
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
            if (!enforceAssignedTopicSelection()) { return; }
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
            if (!enforceAssignedTopicSelection()) { return; }
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

        function finishDailyVocabSuccessfully() {
            if (vm.dailyVocabRunning !== true) {
                return;
            }

            syncDailyVocabCountdown();

            vm.score1 =
                Number(vm.score1 || 0) +
                (Number(vm.dailyVocabCounter) / 12);

            vm.score1 = Number(vm.score1).toFixed(2);

            vm.currentPosition = Math.max(
                vm.currentPosition + 1,
                vm.totalCard
            );

            vm.dailyBufferWaiting = false;

            runningManFinishWin();

            speakEnglish('Player one is OVER', {lang: 'en-US', rate: 0.95});

            if (vm.isSaveTestResult !== true) {
                vm.dailySaveReady = true;
                vm.saveTestResult();
            }

            vm.stopDailyVocabTimer();
        }

        // =====================================================
        // TIMER RIÊNG DAILY VOCAB
        // =====================================================

        var dailyVocabTimeout = null;
        var dailyVocabDeadline = null;
        var dailyVocabPausedAt = null;

        vm.dailyVocabDuration = 900;
        vm.dailyVocabCounter = 900;
        vm.dailyVocabRunning = false;
        vm.dailyVocabAnswersEnabled = false;

        function setDailyVocabCountdown(seconds) {
            vm.dailyVocabCounter = Math.max(0, Math.ceil(Number(seconds) || 0));
            dailyVocabDeadline = Date.now() + (vm.dailyVocabCounter * 1000);
            dailyVocabPausedAt = vm.dailyBufferWaiting === true ? Date.now() : null;
        }

        function syncDailyVocabCountdown() {
            if (vm.dailyVocabRunning !== true || dailyVocabDeadline === null) {
                return;
            }

            var now = Date.now();

            /* Không tính thời gian khi hệ thống đang chờ nạp thêm câu. */
            if (vm.dailyBufferWaiting === true) {
                if (dailyVocabPausedAt === null) {
                    dailyVocabPausedAt = now;
                }
                return;
            }

            if (dailyVocabPausedAt !== null) {
                dailyVocabDeadline += now - dailyVocabPausedAt;
                dailyVocabPausedAt = null;
            }

            vm.dailyVocabCounter = Math.max(
                0,
                Math.ceil((dailyVocabDeadline - now) / 1000)
            );
        }

        function persistActiveDailySession(force) {
            if (!vm.currentUser || !vm.currentUser.id || vm.dailyVocabRunning !== true ||
                !vm.questions || !vm.questions.length) { return; }
            syncDailyVocabCountdown();
            if (Number(vm.dailyVocabCounter) <= 0) {
                removeActiveDailyDraft(vm.currentUser.id);
                return;
            }
            var now = Date.now();
            if (force !== true && now - activeDailyLastPersistAt < 3000) { return; }
            var category = vm.searchTopicDto && vm.searchTopicDto.topicCategory;
            var topicIds = (vm.selectedTopicToSearch || []).map(function (topic) { return topic.id; });
            if (!topicIds.length) { return; }
            var draft = {
                version: 1,
                ownerId: vm.currentUser.id,
                savedAt: now,
                runId: activeDailyRunId,
                categoryId: category && category.id,
                assignmentTaskId: vm.assignmentLaunch.taskId || null,
                assignmentTopicId: vm.assignmentLaunch.topicId || null,
                assignmentCategoryId: vm.assignmentLaunch.categoryId || null,
                topicIds: topicIds,
                title: vm.title,
                rawQuestions: angular.copy(vm.rawQuestions || []),
                questions: angular.copy(vm.questions || []),
                currentPosition: Number(vm.currentPosition) || 0,
                totalCard: Number(vm.totalCard) || vm.questions.length,
                loadedCardCount: Number(vm.loadedCardCount) || vm.questions.length,
                dailyLazyNextPage: dailyLazyNextPage,
                dailyPreparedRawCount: dailyPreparedRawCount,
                allQuestionsLoaded: vm.allQuestionsLoaded === true,
                duration: Number(vm.dailyVocabDuration) || 900,
                counter: Math.max(1, Number(vm.dailyVocabCounter) || 1),
                score: Number(vm.score1) || 0,
                streak: Number(vm.streakPlayer1) || 0,
                wrong: Number(vm.wrongPlayer1) || 0,
                tempWrong: vm.tempWrong || '',
                testResult: angular.copy(vm.testResult || {}),
                attemptedQuestionIds: angular.copy(vm.attemptedDailyQuestionIds || {}),
                completedQuestionIds: angular.copy(vm.completedDailyQuestionIds || {}),
                runningManEnabled: vm.runningManEnabled === true,
                runningManDifficulty: vm.runningManDifficulty,
                runningManGap: vm.runningManGap
            };
            draft.cloudDraftKey = activeDailyDraftKey(vm.currentUser.id) + ':run:' + activeDailyRunId;
            dailyCloudDrafts[activeDailyDraftKey(vm.currentUser.id)] = draft;
            dailyCloudDrafts[draft.cloudDraftKey] = draft;
            try {
                window.localStorage.setItem(activeDailyDraftKey(vm.currentUser.id), JSON.stringify(draft));
                activeDailyLastPersistAt = now;
            } catch (ignore) {
                /* Nếu topic quá lớn, giữ bản nhẹ nhưng vẫn đủ để tiếp tục từ câu hiện tại. */
                try {
                    var compactDraft = angular.copy(draft);
                    compactDraft.rawQuestions = [];
                    compactDraft.questions = [angular.copy(vm.currentCard)];
                    compactDraft.currentPosition = 0;
                    compactDraft.loadedCardCount = 1;
                    compactDraft.allQuestionsLoaded = false;
                    compactDraft.localFallback = true;
                    window.localStorage.setItem(activeDailyDraftKey(vm.currentUser.id), JSON.stringify(compactDraft));
                    activeDailyLastPersistAt = now;
                } catch (ignoredAgain) {}
            }
            saveDailyLearningDraft(
                draft.cloudDraftKey,
                'DAILY_VOCAB',
                draft.title || 'Daily Vocab',
                draft
            );
        }

        function resumeActiveDailySession() {
            var draft = activeDailyResumeDraft;
            if (!draft || !angular.isArray(draft.questions) || !draft.questions.length) { return; }
            activeDailyResumeDraft = null;
            activeDailyRunId = draft.runId || ('legacy:' + draft.savedAt);

            vm.rawQuestions = angular.copy(draft.rawQuestions || []);
            vm.questions = angular.copy(draft.questions);
            vm.currentPosition = Math.max(0, Math.min(Number(draft.currentPosition) || 0, vm.questions.length - 1));
            vm.currentCard = vm.questions[vm.currentPosition] || {};
            vm.totalCard = Math.max(vm.questions.length, Number(draft.totalCard) || vm.questions.length);
            vm.loadedCardCount = Number(draft.loadedCardCount) || vm.questions.length;
            dailyLazyNextPage = Math.max(2, Number(draft.dailyLazyNextPage) || 2);
            dailyPreparedRawCount = Math.max(vm.questions.length, Number(draft.dailyPreparedRawCount) || 0);
            vm.allQuestionsLoaded = draft.allQuestionsLoaded === true;
            vm.dailyVocabDuration = Math.max(1, Number(draft.duration) || getDefaultDailyVocabTimerSeconds() || 900);
            vm.dailyVocabCounter = Math.max(1, Number(draft.counter) || vm.dailyVocabDuration);
            vm.score1 = Number(draft.score) || 0;
            vm.streakPlayer1 = Number(draft.streak) || 0;
            vm.wrongPlayer1 = Number(draft.wrong) || 0;
            vm.tempWrong = draft.tempWrong || '';
            vm.testResult = angular.copy(draft.testResult || {});
            vm.attemptedDailyQuestionIds = angular.copy(draft.attemptedQuestionIds || {});
            vm.completedDailyQuestionIds = angular.copy(draft.completedQuestionIds || {});
            vm.runningManEnabled = draft.runningManEnabled === true;
            vm.runningManDifficulty = draft.runningManDifficulty || vm.runningManDifficulty;
            if (angular.isDefined(draft.runningManGap)) { vm.runningManGap = Number(draft.runningManGap); }
            vm.finishDailyVocab = 'Unfinished';
            vm.dailyVocabRunning = true;
            vm.dailyVocabAnswersEnabled = true;
            vm.dailyBufferWaiting = false;
            setDailyVocabCountdown(vm.dailyVocabCounter);
            vm.showTimer = true;
            vm.showStart = true;
            vm.showWrong = false;
            vm.showCorrect = false;
            stillInAQuestion1 = false;
            startBackgroundMusic();
            cancelDailyVocabTimeout();
            dailyVocabTimeout = $timeout(dailyVocabTick, 1000);
            scheduleDailyQuestionPrefetch(false);
            persistActiveDailySession(true);
            toastr.success('Đã tiếp tục bài Daily Vocab đang làm dở.', 'Daily Vocab');
        }

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
        vm.runningManDevilLeft = 8;
        vm.runningManStudentLeft = 48;

        /*
         * Tọa độ "thế giới" của hai nhân vật.
         *
         * Trước đây NGU đứng yên ở 8%, chỉ HỌC SINH nhảy qua lại nên chưa
         * tạo được cảm giác rượt đuổi. Hai biến step cho phép mỗi nhân vật
         * thật sự tiến lên, còn updateRunningManPosition() đóng vai trò
         * camera để cả hai luôn nằm gọn trong đường chạy.
         */
        var runningManDevilStep = 0;
        var runningManStudentStep = 5;

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

            var visualWidth = 10;
            var furthestStep = Math.max(
                runningManDevilStep,
                runningManStudentStep
            );

            /*
             * Camera bắt đầu cuộn khi người chạy đầu tiên vượt quá 10 bước.
             * Nhờ vậy NGU vẫn tiến về phía HỌC SINH thay vì đứng yên, nhưng
             * không nhân vật nào chạy ra khỏi mép phải của track.
             */
            var cameraStart = Math.max(
                0,
                furthestStep - visualWidth
            );

            vm.runningManDevilLeft =
                8 + ((runningManDevilStep - cameraStart) * 8);

            vm.runningManStudentLeft =
                8 + ((runningManStudentStep - cameraStart) * 8);

            vm.runningManDevilLeft = Math.max(
                8,
                Math.min(88, vm.runningManDevilLeft)
            );

            vm.runningManStudentLeft = Math.max(
                8,
                Math.min(88, vm.runningManStudentLeft)
            );
        }

        /*
         * Cho học sinh tự gọi lại đúng trang đang bị treo mà không làm mất
         * câu đã làm, điểm, streak hoặc thời gian còn lại.
         *
         * dailyLazyGeneration làm callback của request cũ mất hiệu lực nếu
         * nó trả về muộn, nhờ đó cùng một trang không bị append hai lần.
         */
        vm.retryDailyQuestionLoad = function () {
            if (
                vm.dailyVocabRunning !== true ||
                (
                    vm.allQuestionsLoaded === true &&
                    !hasCachedDailyQuestionsToPrepare()
                )
            ) {
                return;
            }

            /* Đang build batch trong RAM thì chỉ cần chờ vài mili giây. */
            if (
                vm.loadingMoreQuestions === true &&
                vm.dailyLazyHttpPending !== true
            ) {
                return;
            }

            if (vm.dailyLazyHttpPending === true) {
                dailyLazyGeneration = dailyLazyGeneration + 1;
                cancelDailyLazyTimers();

                vm.dailyLazyHttpPending = false;
                vm.loadingMoreQuestions = false;
            }

            dailyLazyRetryCount = 0;
            vm.dailyLazyLoadError = false;
            vm.dailyBufferWaiting = true;

            loadNextDailyQuestionPage();
        };

        function resetRunningManRound() {
            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();

            vm.runningManGap =
                vm.runningManInitialGap;

            runningManDevilStep = 0;
            runningManStudentStep =
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

            stopDailyLazyBackgroundWork();

            vm.runningManGap = 0;

            /* Cho NGU chạm đúng vị trí HỌC SINH khi bắt được. */
            runningManDevilStep = runningManStudentStep;
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

            removeActiveDailyDraft(vm.currentUser.id);

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

            /* Hết một nhịp: NGU thật sự chạy lên một bước. */
            runningManDevilStep += 1;

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

            runningManDevilStep = 0;
            runningManStudentStep =
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

            /* Trả lời đúng: HỌC SINH lao lên một bước. */
            runningManStudentStep += 1;

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

            /* Trả lời sai: NGU chớp thời cơ tiến sát thêm một bước. */
            runningManDevilStep += 1;

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

            if (value > 999999) {
                value = 999999;
            }

            vm.dailyVocabDuration = value;

            /*
             * Khi chưa chạy, sửa SET TIMER là đồng hồ phía trên
             * đổi ngay lập tức.
             */
            if (vm.dailyVocabRunning !== true) {
                vm.dailyVocabCounter = value;
                dailyVocabDeadline = null;
                dailyVocabPausedAt = null;
            }
        };

        vm.stopDailyVocabTimer = function () {
            syncDailyVocabCountdown();
            cancelDailyVocabTimeout();
            cancelRunningManTimeout();
            cancelRunningManTauntTimeout();

            stopDailyLazyBackgroundWork();

            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;
            vm.dailyBufferWaiting = false;
            vm.runningManActive = false;
            dailyVocabDeadline = null;
            dailyVocabPausedAt = null;

            stopBackgroundMusic();
            shutUp();
        };

        vm.resetDailyVocabTimer = function () {
            var wasRunning = vm.dailyVocabRunning === true;
            vm.stopDailyVocabTimer();

            if (wasRunning) { removeActiveDailyDraft(vm.currentUser.id); }

            vm.dailyVocabCounter =
                parseInt(
                    vm.dailyVocabDuration,
                    10
                ) ||
                getDefaultDailyVocabTimerSeconds() ||
                900;

            dailyVocabDeadline = null;
            dailyVocabPausedAt = null;

            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;

            resetRunningManRound();
        };

        function dailyVocabTimeUp() {
            cancelDailyVocabTimeout();
            cancelRunningManTimeout();

            stopDailyLazyBackgroundWork();

            vm.dailyVocabCounter = 0;
            vm.dailyVocabRunning = false;
            vm.dailyVocabAnswersEnabled = false;
            vm.dailyBufferWaiting = false;
            vm.runningManActive = false;
            dailyVocabDeadline = null;
            dailyVocabPausedAt = null;

            stopBackgroundMusic();
            shutUp();

            playAudioById('boom-sound', false);
            removeActiveDailyDraft(vm.currentUser.id);
        }

        function dailyVocabTick() {
            if (vm.dailyVocabRunning !== true) {
                return;
            }

            syncDailyVocabCountdown();

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

            if (Number(vm.dailyVocabCounter) <= 0) {
                dailyVocabTimeUp();
                return;
            }

            persistActiveDailySession(false);

            dailyVocabTimeout =
                $timeout(dailyVocabTick, 1000);
        }

        vm.startDailyVocab = function () {
            if (!vm.canBeginDailyVocabRun()) return;
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

            /*
             * Loại bỏ callback nền của lượt trước.
             */
            stopDailyLazyBackgroundWork();

            shutUp();

            /*
             * Chỉ khi bấm đồng hồ mới bắt đầu:
             * - Trộn câu.
             * - Trộn 4 đáp án.
             * - Hiện đáp án.
             */
            buildDailyQuestions(true);

            vm.resetDailyVocabSaveState();
            activeDailyRunId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
            vm.attemptedDailyQuestionIds = {};
            vm.completedDailyQuestionIds = {};

            vm.finishDailyVocab = 'Unfinished';
            vm.dailyVocabCounter =
                parseInt(
                    vm.dailyVocabDuration,
                    10
                ) ||
                getDefaultDailyVocabTimerSeconds() ||
                900;

            vm.dailyVocabRunning = true;
            vm.dailyVocabAnswersEnabled = true;
            setDailyVocabCountdown(vm.dailyVocabCounter);

            vm.score1 = 0;
            vm.streakPlayer1 = 0;
            vm.wrongPlayer1 = 0;
            vm.tempWrong = '';

            stillInAQuestion1 = false;

            vm.showStart = true;
            vm.showWrong = false;
            vm.showCorrect = false;

            startBackgroundMusic();
            persistActiveDailySession(true);

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

        function handleDailyVocabVisibilityChange() {
            if (vm.dailyVocabRunning !== true) {
                return;
            }

            $scope.$evalAsync(function () {
                syncDailyVocabCountdown();
                if (Number(vm.dailyVocabCounter) <= 0) {
                    dailyVocabTimeUp();
                    return;
                }
                persistActiveDailySession(document.hidden === true);
            });
        }

        document.addEventListener(
            'visibilitychange',
            handleDailyVocabVisibilityChange,
            false
        );

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
                !window.EnglishSpeech
            ) {
                return;
            }

            speakEnglish(String(text), {
                lang: 'en-US',
                rate: 0.95,
                pitch: 1,
                volume: 1
            });
        }

        function shutUp() {
            stopEnglishSpeech();
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
            syncDailyVocabCountdown();
            if (vm.dailyVocabRunning === true && Number(vm.dailyVocabCounter) <= 0) {
                dailyVocabTimeUp();
                return;
            }

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
            vm.attemptedDailyQuestionIds = vm.attemptedDailyQuestionIds || {};
            vm.completedDailyQuestionIds = vm.completedDailyQuestionIds || {};
            vm.attemptedDailyQuestionIds[String(vm.currentCard.id)] = true;
            if (isCorrect) { vm.completedDailyQuestionIds[String(vm.currentCard.id)] = true; }

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
                    finishDailyVocabSuccessfully();
                    return;
                }

                vm.nextCard();
                persistActiveDailySession(true);
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
            persistActiveDailySession(true);
        };

        // =====================================================
        // TEST RESULT
        // =====================================================

        vm.testResult = {};
        vm.isSaveTestResult = false;
        vm.savingTestResult = false;
        vm.dailySaveStatus = 'idle';
        vm.dailySaveMessage = '';
        vm.dailySaveReady = false;
        vm.dailyVocabPendingResult = null;
        vm.dailySaveStorageNotice = '';
        var dailySaveDestroyed = false;

        function dailyDraftKey(userId, draft) {
            var assignment = draft ? dailyAssignmentIdentity(draft) : vm.assignmentLaunch;
            var attemptKey = draft && draft.payload && draft.payload.clientAttemptKey;
            return 'daily-vocab-pending:v1:' + userId + dailyAssignmentSuffix(assignment)
                + (/^[a-f0-9]{32}$/.test(attemptKey || '') ? ':attempt:' + attemptKey : '');
        }
        function removeDailyDraft(ownerId, draft) {
            draft = draft || vm.dailyVocabPendingResult;
            var key = dailyDraftKey(ownerId, draft);
            var keys = [key];
            if (draft && draft.storageKey && draft.storageKey !== key) { keys.push(draft.storageKey); }
            if (draft && draft.legacyStorageKey && keys.indexOf(draft.legacyStorageKey) < 0) { keys.push(draft.legacyStorageKey); }
            keys.forEach(function (storedKey) {
                var prefix = 'daily-vocab-pending:v1:' + ownerId;
                if (storedKey !== prefix && storedKey.indexOf(prefix + ':') !== 0) { return; }
                try { window.localStorage.removeItem(storedKey); } catch (ignore) {}
                delete dailyCloudDrafts[storedKey];
                deleteDailyLearningDraft(storedKey);
            });
        }
        function removeActiveDailyDraftForPending(pending) {
            if (!pending || !pending.ownerId) { return; }
            var base = 'daily-vocab-active:v1:' + pending.ownerId + dailyAssignmentSuffix(dailyAssignmentIdentity(pending));
            var keys = [base];
            try {
                for (var index = 0; index < window.localStorage.length; index++) {
                    var storedKey = window.localStorage.key(index);
                    if (storedKey && storedKey.indexOf(base + ':run:') === 0) { keys.push(storedKey); }
                }
            } catch (ignoreActiveKeys) {}
            Object.keys(dailyCloudDrafts).forEach(function (key) {
                if (key.indexOf(base + ':run:') === 0) { keys.push(key); }
            });
            var deletedCloudKeys = [];
            keys.forEach(function (key) {
                var active = dailyDraftValue(key);
                if (!active) { return; }
                if (pending.activeRunId || active.runId) {
                    if (!pending.activeRunId || pending.activeRunId !== active.runId) { return; }
                } else if (!(Number(active.savedAt) > 0) || Number(active.savedAt) > Number(pending.createdAt)) { return; }
                var cloudKey = active.cloudDraftKey || (active.runId ? base + ':run:' + active.runId : key);
                if (cloudKey !== base && cloudKey.indexOf(base + ':run:') !== 0) { return; }
                try { window.localStorage.removeItem(key); window.localStorage.removeItem(cloudKey); } catch (ignoreActiveRemoval) {}
                delete dailyCloudDrafts[key];
                delete dailyCloudDrafts[cloudKey];
                if (deletedCloudKeys.indexOf(cloudKey) < 0) {
                    deletedCloudKeys.push(cloudKey);
                    deleteDailyLearningDraft(cloudKey);
                }
            });
        }
        function dailyAssignmentContextMatches(result, pending) {
            var expected = dailyAssignmentIdentity(pending);
            if (result.user && result.user.id != null && String(result.user.id) !== String(pending.ownerId)) { return false; }
            if (String(result.assignmentTaskId || '') !== String(expected.taskId || '')) { return false; }
            if (String(result.assignmentTopicId || '') === String(expected.topicId || '')) { return true; }
            if (result.assignmentTopicId != null || !expected.taskId || !expected.topicId
                    || !vm.assignmentLaunch.verified
                    || String(vm.assignmentLaunch.taskId) !== String(expected.taskId)) { return false; }
            var assignedIds = vm.assignmentLaunch.topicIds || [];
            if (assignedIds.length !== 1 || String(assignedIds[0]) !== String(expected.topicId)) { return false; }
            // Older backends return saved topic evidence without assignmentTopicId.
            var savedIds = (result.topicIds || []).concat((result.topics || []).map(function (topic) { return topic.id; }));
            return savedIds.some(function (id) { return String(id) === String(expected.topicId); });
        }
        function persistDailyDraft() {
            var pending = vm.dailyVocabPendingResult;
            if (!pending || !pending.ownerId) { return false; }
            var key = dailyDraftKey(pending.ownerId, pending);
            if (pending.storageKey && pending.storageKey !== key) { pending.legacyStorageKey = pending.storageKey; }
            pending.storageKey = key;
            var localSaved = false;
            try {
                window.localStorage.setItem(key, JSON.stringify(pending));
                localSaved = true;
                vm.dailySaveStorageNotice = '';
                removeActiveDailyDraftForPending(pending);
            } catch (ignore) {
                vm.dailySaveStorageNotice = 'Trình duyệt không giữ được bản tạm. Hãy giữ trang này mở và không tải lại trang trước khi lưu thành công.';
            }
            var request = saveDailyLearningDraft(key, 'DAILY_VOCAB_PENDING',
                pending.title || 'Kết quả Daily Vocab chưa xác nhận', pending);
            if (request && angular.isFunction(request.then)) {
                request.then(function (acknowledgement) {
                    if (dailySaveDestroyed || vm.dailyVocabPendingResult !== pending || vm.isSaveTestResult === true) { return; }
                    if (!acknowledgement || !(Number(acknowledgement.id) > 0)
                            || acknowledgement.draftKey !== key || !acknowledgement.payload) { return; }
                    var saved;
                    try { saved = JSON.parse(acknowledgement.payload); } catch (ignoreCloudPayload) { return; }
                    if (Number(saved.ownerId) !== Number(pending.ownerId) || !saved.payload
                            || saved.payload.clientAttemptKey !== pending.payload.clientAttemptKey
                            || !dailyAssignmentContextMatches(saved.payload, pending)) { return; }
                    dailyCloudDrafts[key] = saved;
                    removeActiveDailyDraftForPending(pending);
                    vm.dailySaveStorageNotice = '';
                });
            }
            return localSaved;
        }
        function restoreDailyDraft() {
            if (!vm.currentUser.id) return;
            try {
                var draft = readDailyScopedDraft(vm.currentUser.id, true);
                if (!draft) return;
                var result = draft.payload;
                if (draft.version !== 1 || draft.ownerId !== vm.currentUser.id || !result || result.testType !== 1 ||
                    !/^[a-f0-9]{32}$/.test(result.clientAttemptKey || '') || !result.user || result.user.id !== draft.ownerId ||
                    !(result.totalWord > 0) || !(draft.createdAt > 0)) {
                    removeDailyDraft(vm.currentUser.id); return;
                }
                vm.dailyVocabPendingResult = draft;
                removeActiveDailyDraftForPending(draft);
                vm.dailySaveReady = true;
                vm.dailySaveStatus = 'pending';
                vm.dailySaveMessage = 'Có kết quả của lượt trước chưa nhận được xác nhận lưu. Kết nối mạng rồi bấm Lưu kết quả.';
            } catch (ignore) {
                vm.dailySaveStorageNotice = 'Không đọc được bản tạm của trình duyệt. Nếu đang có kết quả trên trang, hãy giữ trang mở để lưu.';
            }
        }
        vm.canBeginDailyVocabRun = function () {
            if (vm.dailyDraftRecoveryBlocked) {
                toastr.warning('Hãy kết nối mạng và tải lại trang để khôi phục đầy đủ tiến độ đã lưu trước khi làm tiếp.');
                return false;
            }
            if (vm.savingTestResult || vm.dailySaveStatus === 'pending') {
                toastr.warning('Lượt trước chưa lưu xong. Hãy Lưu kết quả hoặc chọn Bỏ kết quả trước khi làm lượt mới.');
                return false;
            }
            return true;
        };
        vm.discardDailyVocabPending = function () {
            if (vm.savingTestResult || (!vm.dailyVocabPendingResult && !vm.dailySaveReady)) return;
            if (!window.confirm('Bỏ kết quả chưa lưu này? Bản tạm sẽ bị xóa và không thể khôi phục.')) return;
            if (vm.dailyVocabPendingResult) removeDailyDraft(vm.dailyVocabPendingResult.ownerId);
            vm.dailyVocabPendingResult = null; vm.dailySaveReady = false;
            vm.dailySaveStatus = 'idle'; vm.dailySaveMessage = ''; vm.dailySaveStorageNotice = '';
        };

        vm.setUpTestResult = function () {
            vm.testResult = {
                user: vm.currentUser,
                testTakerPerformance: '',
                totalWord: vm.totalCard,
                assignmentTaskId: vm.assignmentLaunch.taskId || null,
                assignmentTopicId: vm.assignmentLaunch.topicId || null
            };

            vm.isSaveTestResult = false;
        };

        vm.resetDailyVocabSaveState = function () {
            if (!vm.canBeginDailyVocabRun()) return false;
            vm.dailyVocabPendingResult = null;
            vm.dailySaveReady = false; vm.dailySaveStatus = 'idle'; vm.dailySaveMessage = '';
            vm.dailySaveStorageNotice = '';
            vm.isSaveTestResult = false;
            vm.savingTestResult = false;
            vm.finishDailyVocab = 'Unfinished';
            vm.tempWrong = '';

            vm.setUpTestResult();
        };

        function appendAssignmentTopicEvidence(result, assignmentTopicId) {
            if (!result || !result.assignmentTaskId || !/^\d+$/.test(String(assignmentTopicId || ''))) return;
            var topicId = Number(assignmentTopicId);
            result.assignmentTopicId = topicId;
            result.topicIds = result.topicIds || [];
            var alreadyIncluded = result.topicIds.some(function (id) {
                return Number(id) === topicId;
            });
            if (!alreadyIncluded) result.topicIds.push(topicId);
        }

        function dailySaveFailureMessage(error) {
            if (error && error.assignmentContextMismatch) {
                return 'Server chưa xác nhận đúng bài và topic của lượt này. Bản tạm vẫn được giữ. Vui lòng báo giáo viên kiểm tra hệ thống, rồi bấm Lưu kết quả để thử lại.';
            }
            var status = error && Number(error.status);
            if (status === 401 || status === 403) {
                return 'Phiên đăng nhập đã hết hạn hoặc không có quyền lưu (HTTP ' + status + '). Đăng nhập lại đúng tài khoản rồi bấm Lưu kết quả.';
            }
            if (!status || status === -1) {
                return 'Không kết nối được tới server hoặc yêu cầu đã quá thời gian. Kết nối lại rồi bấm Lưu kết quả. Không cần làm lại bài.';
            }
            var detail = error && error.data && typeof error.data.message === 'string'
                ? error.data.message.replace(/\s+/g, ' ').trim().substring(0, 180) : '';
            return 'Server chưa nhận kết quả (HTTP ' + status + '). ' +
                (detail ? detail + ' ' : '') + 'Bấm Lưu kết quả để thử lại; không cần làm lại bài.';
        }

        function handleDailySaveFailure(error) {
            if (dailySaveDestroyed) { return; }
            vm.isSaveTestResult = false;
            vm.dailySaveStatus = 'pending';
            vm.dailySaveMessage = dailySaveFailureMessage(error);
            persistDailyDraft();
            toastr.error(vm.dailySaveMessage, 'Thông báo');
        }

        vm.prepareResultTopicEvidence = function () {
            var played = {}, totals = {}, completed = {};
            angular.forEach(vm.rawQuestions || [], function (question) {
                angular.forEach(question.topicIds || [], function (id) {
                    var key = String(id);
                    totals[key] = (totals[key] || 0) + 1;
                    if ((vm.attemptedDailyQuestionIds || {})[String(question.id)]) { played[key] = true; }
                    if ((vm.completedDailyQuestionIds || {})[String(question.id)]) { completed[key] = (completed[key] || 0) + 1; }
                });
            });
            vm.testResult.topicIds = (vm.resultTopicIds || []).filter(function (id, index, ids) {
                return played[String(id)] && ids.indexOf(id) === index;
            });
            // Questions may carry child topics while the assigned homework points at
            // their containing topic. Include that server-issued topic for both old
            // and new backends; do not mark it as fully learned below.
            appendAssignmentTopicEvidence(vm.testResult, vm.assignmentLaunch.topicId);
            vm.testResult.completedVocabularyTopicIds = vm.testResult.topicIds.filter(function (id) {
                return vm.allQuestionsLoaded === true && totals[String(id)] > 0 && completed[String(id)] === totals[String(id)];
            });
        };

        vm.saveTestResult = function () {
            if (
                vm.savingTestResult === true ||
                vm.isSaveTestResult === true
            ) {
                return;
            }
            if (!vm.dailySaveReady) { toastr.info('Hoàn thành lượt Daily Vocab trước khi lưu kết quả.'); return; }

            if (!vm.dailyVocabPendingResult) {
            if (!vm.testResult) {
                vm.setUpTestResult();
            }

            vm.testResult.testType = 1;
            vm.prepareResultTopicEvidence();
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
                var crypto = window.crypto || window.msCrypto;
                if (!crypto || !crypto.getRandomValues) { vm.dailySaveMessage = 'Không tạo được mã lượt làm. Hãy mở website bằng HTTPS trên trình duyệt mới.'; vm.dailySaveStatus = 'pending'; return; }
                var bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
                var key = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
                var payload = angular.copy(vm.testResult);
                payload.user = {id: vm.currentUser.id};
                delete payload.id; delete payload.testDate; delete payload.startDate; delete payload.endDate;
                payload.clientAttemptKey = key;
                vm.dailyVocabPendingResult = {version:1, ownerId:vm.currentUser.id, createdAt:Date.now(),
                    title:vm.title || payload.testName || 'Daily Vocab',
                    activeRunId:activeDailyRunId,
                    assignmentTaskId:vm.assignmentLaunch.taskId || null,
                    assignmentTopicId:vm.assignmentLaunch.topicId || null, payload:payload};
            }
            var pending = vm.dailyVocabPendingResult;
            // Retries retain the topic of the original attempt, even after navigation.
            appendAssignmentTopicEvidence(pending.payload,
                pending.assignmentTopicId || pending.payload.assignmentTopicId);
            var signedIn = getCurrentUser();
            if (!pending.ownerId || signedIn.id !== pending.ownerId) {
                vm.dailySaveStatus = 'pending'; vm.dailySaveMessage = 'Hãy đăng nhập lại đúng tài khoản đã làm lượt này rồi bấm Lưu kết quả.';
                persistDailyDraft(); return;
            }
            vm.dailySaveStatus = 'pending'; persistDailyDraft();
            if (window.navigator && window.navigator.onLine === false) {
                vm.dailySaveMessage = 'Đang mất mạng, kết quả chưa lưu. Kết nối lại mạng rồi bấm Lưu kết quả.'; return;
            }
            vm.savingTestResult = true; vm.dailySaveStatus = 'saving';
            vm.dailySaveMessage = 'Đang lưu kết quả...';
            service.saveDailyVocabResult(
                pending.payload
            ).then(
                function (data) {
                    if (dailySaveDestroyed) return;
                    if (!data || !(Number(data.id) > 0)) {
                        handleDailySaveFailure({assignmentContextMismatch: true});
                        return;
                    }
                    if (!dailyAssignmentContextMatches(data, pending)) {
                        handleDailySaveFailure({assignmentContextMismatch: true});
                        return;
                    }
                    removeActiveDailyDraftForPending(pending);
                    if (
                        data &&
                        (data.resultStatus === 'FAILED' || data.messageCode == 1)
                    ) {
                        vm.dailySaveStatus = 'failed';
                        vm.dailySaveMessage = 'Đã lưu kết quả: Thất bại vì sai quá nhiều. Lượt này chưa được tính hoàn thành bài tập.';
                        if (Number(data.vocabularyExperienceAwardedWords) > 0) {
                            vm.dailySaveMessage += ' Đã ghi nhận ' + Number(data.vocabularyExperienceAwardedWords) + ' từ đúng vào kinh nghiệm.';
                        }
                        removeDailyDraft(pending.ownerId, pending);
                        toastr.warning(
                            vm.dailySaveMessage,
                            'Thông báo'
                        );

                        vm.finishDailyVocab =
                            'Thất bại';
                    } else if (data && Number(data.id) > 0) {
                        vm.dailySaveStatus = 'saved';
                        vm.dailySaveMessage = 'Đã lưu kết quả thành công.';
                        removeDailyDraft(pending.ownerId, pending);
                        toastr.info(
                            'Lưu thành công',
                            'Thông báo'
                        );

                        vm.finishDailyVocab =
                            'Thành công';
                    }

                    if (data) {
                        vm.testResult.id = data.id;

						/*
						 * Backend trả về user sau khi đã cộng kinh nghiệm.
						 * Cập nhật đúng cụm Level trên banner, không reload trang.
						 */
						if (data.user) {
							vm.currentUser = data.user;
							$rootScope.$emit('$onCurrentUserData', data.user);
						}
                    }

                    vm.isSaveTestResult = true;
                    vm.dailySaveStorageNotice = '';
                }
            ).catch(handleDailySaveFailure).finally(function () {
                if (dailySaveDestroyed) return;
                vm.savingTestResult = false;
            });
        };

        vm.resetDailyVocabRun = function () {
            if (!vm.canBeginDailyVocabRun()) return;
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

        function saveActiveDailyBeforeLeaving() {
            persistActiveDailySession(true);
        }

        window.addEventListener('pagehide', saveActiveDailyBeforeLeaving, false);
        window.addEventListener('beforeunload', saveActiveDailyBeforeLeaving, false);

        // =====================================================
        // CLEANUP
        // =====================================================

        $scope.$on('$destroy', function () {
            persistActiveDailySession(true);
            dailySaveDestroyed = true;
            window.removeEventListener('pagehide', saveActiveDailyBeforeLeaving, false);
            window.removeEventListener('beforeunload', saveActiveDailyBeforeLeaving, false);
            document.removeEventListener('visibilitychange', handleDailyVocabVisibilityChange, false);
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
        function initializeDailyVocabFromDrafts() {
            var explicitActive = false;
            try {
                var resumeKey = 'daily-vocab-dashboard-resume:v1:' + vm.currentUser.id;
                explicitActive = window.sessionStorage.getItem(resumeKey) === activeDailyDraftKey(vm.currentUser.id);
                if (explicitActive) { window.sessionStorage.removeItem(resumeKey); }
            } catch (ignoreActiveChoice) {}
            if (explicitActive && !vm.assignmentLaunch.invalid) {
                activeDailyResumeDraft = readActiveDailyDraft();
            }
            if (!activeDailyResumeDraft) { restoreDailyDraft(); }
            if (vm.assignmentLaunch.invalid || vm.dailyVocabPendingResult) { return; }
            if (vm.assignmentSelectionLocked && !activeDailyResumeDraft) {
                activeDailyResumeDraft = readActiveDailyDraft();
            }
            if (!activeDailyResumeDraft) { chooseActiveDailyResume(); }
            vm.getPageTopicCategory();
        }
        if (dailyLearningDraftsReady && angular.isFunction(dailyLearningDraftsReady.finally)) {
            dailyLearningDraftsReady.finally(initializeDailyVocabFromDrafts);
        } else {
            initializeDailyVocabFromDrafts();
        }
    }
})();
