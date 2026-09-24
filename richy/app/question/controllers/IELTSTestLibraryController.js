(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSTestLibraryController', IELTSTestLibraryController);

    IELTSTestLibraryController.$inject = [
        '$rootScope', '$scope', '$location', '$window', '$cookies',
        'settings', 'QuestionService', 'blockUI'
    ];

    function IELTSTestLibraryController($rootScope, $scope, $location, $window, $cookies,
                                        settings, service, blockUI) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;
        var userCookie = $cookies.get('education.user');

        vm.currentUser = {};
        try {
            vm.currentUser = userCookie ? JSON.parse(userCookie) : {};
        } catch (ignoreInvalidUserCookie) {
            vm.currentUser = {};
        }

        vm.isComprehensiveMode = /\/comprehensive_tests(?:\/|$)/i.test($location.path());
        vm.isWritingMode = /\/ielts_writing_tests(?:\/|$)/i.test($location.path());
        vm.isListeningMode = !vm.isComprehensiveMode && !vm.isWritingMode && /\/ielts_listening_tests(?:\/|$)/i.test($location.path());
        vm.testModeName = vm.isComprehensiveMode ? 'Tổng hợp' : (vm.isWritingMode ? 'Writing' : (vm.isListeningMode ? 'Listening' : 'Reading'));
        vm.testModeIcon = vm.isComprehensiveMode ? 'fa-list-alt' : (vm.isWritingMode ? 'fa-pencil' : (vm.isListeningMode ? 'fa-headphones' : 'fa-book'));
        vm.ieltsReadingTests = [];
        vm.learningProgressByTestId = {};
        vm.learningProgressByTestTask = {};
        vm.totalItems = 0;
        vm.loading = false;
        vm.searchDto = {
            upper: 100,
            lower: 0,
            type: 100,
            pageSize: 12,
            pageIndex: 1,
            status: 7,
            questionType: {id: 11},
            listeningTest: vm.isComprehensiveMode || vm.isWritingMode ? null : vm.isListeningMode,
            testFormat: vm.isWritingMode ? 'WRITING' : (vm.isComprehensiveMode ? 'COMPREHENSIVE' : null)
        };
        var DEFAULT_TOPIC_SOURCE_ID = 26;
        var DEFAULT_TOPIC_CATEGORY_NAME = 'GRADE 6';
        var topicFilterRequestId = 0;
        var testRequestId = 0;

        vm.topicSources = [];
        vm.selectedTopicSource = null;
        vm.selectedTopicCategory = null;
        vm.selectedTopic = null;
        vm.sourceTopics = [];
        vm.topicCategories = [];
        vm.topics = [];
        vm.topicFiltersLoading = false;
        vm.topicFiltersError = '';

        function buildTopicSources() {
            var sources = [{id: DEFAULT_TOPIC_SOURCE_ID, name: 'EM YÊU INH LÍCH'}];
            var currentUserId = vm.currentUser && vm.currentUser.id;
            if (currentUserId != null && String(currentUserId) !== String(DEFAULT_TOPIC_SOURCE_ID)) {
                sources.push({id: currentUserId, name: 'TỪ CỦA TÔI'});
            }
            return sources;
        }

        vm.topicSourceLabel = function (source) {
            if (source && String(source.id) === String(DEFAULT_TOPIC_SOURCE_ID)) {
                return 'EM YÊU INH LỊCH';
            }
            return (source && source.name) || 'EM YÊU INH LỊCH';
        };

        function topicCategoriesFromTopics(topics) {
            var categories = [];
            var seen = {};
            angular.forEach(topics || [], function (topic) {
                var category = topic && topic.topicCategory;
                if (!category || category.id == null || seen[String(category.id)]) { return; }
                seen[String(category.id)] = true;
                categories.push(category);
            });
            return categories.sort(function (left, right) {
                return String(left.name || '').localeCompare(String(right.name || ''));
            });
        }

        function topicsForCategory(topics, category) {
            if (!category || category.id == null) { return []; }
            return (topics || []).filter(function (topic) {
                return topic && topic.topicCategory &&
                    String(topic.topicCategory.id) === String(category.id);
            });
        }

        function defaultTopicCategory(categories) {
            var matched = null;
            angular.forEach(categories || [], function (category) {
                if (!matched && category && String(category.name || '').trim().toUpperCase() === DEFAULT_TOPIC_CATEGORY_NAME) {
                    matched = category;
                }
            });
            return matched;
        }

        vm.loadTopicSource = function () {
            if (!vm.isComprehensiveMode) { return; }
            var requestId = ++topicFilterRequestId;
            vm.topicFiltersLoading = true;
            vm.topicFiltersError = '';
            vm.selectedTopicCategory = null;
            vm.selectedTopic = null;
            vm.sourceTopics = [];
            vm.topicCategories = [];
            vm.topics = [];

            service.getTopicsForGames({userId: vm.selectedTopicSource && vm.selectedTopicSource.id}, 1, 10000000).then(function (data) {
                if (requestId !== topicFilterRequestId) { return; }
                vm.sourceTopics = (data && data.content) || [];
                vm.topicCategories = topicCategoriesFromTopics(vm.sourceTopics);
                vm.selectedTopicCategory = defaultTopicCategory(vm.topicCategories);
                vm.topics = topicsForCategory(vm.sourceTopics, vm.selectedTopicCategory);
                if (!vm.sourceTopics.length) { vm.topicFiltersError = 'Nguồn này chưa có topic.'; }
                vm.topicFiltersLoading = false;
                vm.applyTopicFilter();
            }, function () {
                if (requestId !== topicFilterRequestId) { return; }
                vm.topicFiltersLoading = false;
                vm.topicFiltersError = 'Không tải được danh sách topic.';
                vm.applyTopicFilter();
            });
        };

        vm.topicCategoryChanged = function () {
            vm.selectedTopic = null;
            vm.topics = topicsForCategory(vm.sourceTopics, vm.selectedTopicCategory);
            vm.applyTopicFilter();
        };

        vm.applyTopicFilter = function () {
            if (!vm.isComprehensiveMode) { return; }
            vm.searchDto.questionTopics = [];
            vm.searchDto.topicOwnerUserId = vm.selectedTopicSource ? vm.selectedTopicSource.id : null;
            vm.searchDto.topicCategoryId = vm.selectedTopicCategory ? vm.selectedTopicCategory.id : null;
            vm.searchDto.topicId = vm.selectedTopic ? vm.selectedTopic.id : null;
            vm.searchDto.pageIndex = 1;
            vm.loadTests();
        };

        function draftSavedAt(draft, serverSavedAt) {
            return new Date((draft || {}).savedAt || (draft || {}).updatedAt || serverSavedAt || 0).getTime() || 0;
        }

        function keepNewestProgress(progressMap, key, draft, savedAtValue) {
            if (!progressMap[key] || savedAtValue >= progressMap[key].savedAtValue) {
                var progress = angular.copy(draft);
                progress.savedAtValue = savedAtValue;
                progressMap[key] = progress;
            }
        }

        function collectIeltsDraft(progressByTestId, progressByTestTask, draft, serverSavedAt) {
            if (!draft || !draft.testId || draft.sessionMode !== 'STUDY') { return; }
            if (vm.currentUser.id && draft.userId && String(draft.userId) !== String(vm.currentUser.id)) { return; }

            var isComprehensiveDraft = draft.testMode === 'COMPREHENSIVE';
            if (isComprehensiveDraft !== vm.isComprehensiveMode) { return; }
            var isWritingDraft = draft.testMode === 'WRITING';
            if (isWritingDraft !== vm.isWritingMode) { return; }
            var isListeningDraft = draft.isListening === true || draft.testMode === 'LISTENING';
            if (isListeningDraft !== vm.isListeningMode) { return; }

            var key = String(draft.testId);
            var savedAtValue = draftSavedAt(draft, serverSavedAt);
            keepNewestProgress(progressByTestId, key, draft, savedAtValue);
            var writingTask = Number(draft.assignmentPart);
            if (vm.isWritingMode && (writingTask === 1 || writingTask === 2)) {
                keepNewestProgress(progressByTestTask, key + ':' + writingTask, draft, savedAtValue);
            }
        }

        function readLocalLearningProgress(progressByTestId, progressByTestTask) {
            var userId = String(vm.currentUser.id || '');
            var prefix = 'ieltsReadingInProgress:' + userId;
            if (!userId) { return; }

            try {
                for (var index = 0; index < $window.localStorage.length; index++) {
                    var storageKey = $window.localStorage.key(index);
                    if (!storageKey || (storageKey !== prefix && storageKey.indexOf(prefix + ':') !== 0)) { continue; }
                    collectIeltsDraft(progressByTestId, progressByTestTask, JSON.parse($window.localStorage.getItem(storageKey)));
                }
            } catch (ignoreLearningProgressStorageError) {}
        }

        vm.refreshLearningProgress = function () {
            var progressByTestId = {};
            var progressByTestTask = {};
            readLocalLearningProgress(progressByTestId, progressByTestTask);
            vm.learningProgressByTestId = progressByTestId;
            vm.learningProgressByTestTask = progressByTestTask;

            return service.getLearningDrafts().then(function (items) {
                angular.forEach(items || [], function (item) {
                    if (!item || item.draftType !== 'IELTS' || !item.payload) { return; }
                    try {
                        collectIeltsDraft(progressByTestId, progressByTestTask, JSON.parse(item.payload), item.savedAt);
                    } catch (ignoreInvalidDraftPayload) {}
                });
                vm.learningProgressByTestId = progressByTestId;
                vm.learningProgressByTestTask = progressByTestTask;
            }, angular.noop);
        };

        vm.getLearningProgress = function (testId, writingTask) {
            if (vm.isWritingMode && (Number(writingTask) === 1 || Number(writingTask) === 2)) {
                return vm.learningProgressByTestTask[String(testId) + ':' + Number(writingTask)] || null;
            }
            return vm.learningProgressByTestId[String(testId)] || null;
        };

        vm.hasWritingLearningProgress = function (item) {
            return !!(item && (vm.getLearningProgress(item.id, 1) || vm.getLearningProgress(item.id, 2)));
        };

        vm.formatLearningDuration = function (seconds) {
            var totalMinutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
            if (totalMinutes < 60) { return totalMinutes + ' phút'; }
            return Math.floor(totalMinutes / 60) + ' giờ ' + (totalMinutes % 60) + ' phút';
        };

        vm.testCatalogUrl = function (item, writingTask) {
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isWritingMode ? 'ielts_writing_actual_test/' : (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/'));
            var params = [];
            if (writingTask) { params.push('assignmentPart=' + writingTask); }
            if (vm.getLearningProgress(item.id, writingTask)) { params.push('sessionMode=STUDY'); }
            return route + item.id + (params.length ? '?' + params.join('&') : '');
        };

        vm.seriousTestCatalogUrl = function (item, writingTask) {
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isWritingMode ? 'ielts_writing_actual_test/' : (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/'));
            return route + item.id + '?sessionMode=SERIOUS&startFresh=1' + (writingTask ? '&assignmentPart=' + writingTask : '');
        };

        vm.loadTests = function () {
            var requestId = ++testRequestId;
            vm.loading = true;
            blockUI.start();
            service.getPageForTests(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                if (requestId !== testRequestId) { return; }
                data = data || {content: [], totalElements: 0};
                vm.ieltsReadingTests = data.content || [];
                vm.totalItems = Number(data.totalElements) || 0;
            }, function () {
                if (requestId !== testRequestId) { return; }
                vm.ieltsReadingTests = [];
                vm.totalItems = 0;
            }).finally(function () {
                if (requestId === testRequestId) {
                    vm.loading = false;
                    blockUI.stop();
                }
            });
        };

        vm.search = function () {
            vm.searchDto.pageIndex = 1;
            vm.searchDto.findExactWord = false;
            vm.loadTests();
        };

        vm.enterSearchCode = function (event) {
            if (event && event.keyCode === 13) { vm.search(); }
        };

        $scope.pageChanged = function () {
            vm.loadTests();
        };

        function refreshOnFocus() {
            $scope.$evalAsync(vm.refreshLearningProgress);
        }

        $window.addEventListener('focus', refreshOnFocus);
        $window.addEventListener('storage', refreshOnFocus);
        $scope.$on('$destroy', function () {
            $window.removeEventListener('focus', refreshOnFocus);
            $window.removeEventListener('storage', refreshOnFocus);
        });

        vm.refreshLearningProgress();
        if (vm.isComprehensiveMode) {
            vm.topicSources = buildTopicSources();
            vm.selectedTopicSource = vm.topicSources[0] || null;
            vm.loadTopicSource();
        } else {
            vm.loadTests();
        }
    }
})();
