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
        vm.isListeningMode = !vm.isComprehensiveMode && /\/ielts_listening_tests(?:\/|$)/i.test($location.path());
        vm.testModeName = vm.isComprehensiveMode ? 'Tổng hợp' : (vm.isListeningMode ? 'Listening' : 'Reading');
        vm.testModeIcon = vm.isComprehensiveMode ? 'fa-list-alt' : (vm.isListeningMode ? 'fa-headphones' : 'fa-book');
        vm.ieltsReadingTests = [];
        vm.learningProgressByTestId = {};
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
            listeningTest: vm.isComprehensiveMode ? null : vm.isListeningMode,
            testFormat: vm.isComprehensiveMode ? 'COMPREHENSIVE' : null
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
            } else if (currentUserId != null) {
                sources[0].name = 'EM YÊU INH LÍCH — TỪ CỦA TÔI';
            }
            return sources;
        }

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

        function collectIeltsDraft(progressByTestId, draft, serverSavedAt) {
            if (!draft || !draft.testId || draft.sessionMode !== 'STUDY') { return; }
            if (vm.currentUser.id && draft.userId && String(draft.userId) !== String(vm.currentUser.id)) { return; }

            var isComprehensiveDraft = draft.testMode === 'COMPREHENSIVE';
            if (isComprehensiveDraft !== vm.isComprehensiveMode) { return; }
            var isListeningDraft = draft.isListening === true || draft.testMode === 'LISTENING';
            if (isListeningDraft !== vm.isListeningMode) { return; }

            var key = String(draft.testId);
            var savedAtValue = draftSavedAt(draft, serverSavedAt);
            if (!progressByTestId[key] || savedAtValue >= progressByTestId[key].savedAtValue) {
                draft.savedAtValue = savedAtValue;
                progressByTestId[key] = draft;
            }
        }

        function readLocalLearningProgress(progressByTestId) {
            var userId = String(vm.currentUser.id || '');
            var prefix = 'ieltsReadingInProgress:' + userId;
            if (!userId) { return; }

            try {
                for (var index = 0; index < $window.localStorage.length; index++) {
                    var storageKey = $window.localStorage.key(index);
                    if (!storageKey || (storageKey !== prefix && storageKey.indexOf(prefix + ':') !== 0)) { continue; }
                    collectIeltsDraft(progressByTestId, JSON.parse($window.localStorage.getItem(storageKey)));
                }
            } catch (ignoreLearningProgressStorageError) {}
        }

        vm.refreshLearningProgress = function () {
            var progressByTestId = {};
            readLocalLearningProgress(progressByTestId);
            vm.learningProgressByTestId = progressByTestId;

            return service.getLearningDrafts().then(function (items) {
                angular.forEach(items || [], function (item) {
                    if (!item || item.draftType !== 'IELTS' || !item.payload) { return; }
                    try {
                        collectIeltsDraft(progressByTestId, JSON.parse(item.payload), item.savedAt);
                    } catch (ignoreInvalidDraftPayload) {}
                });
                vm.learningProgressByTestId = progressByTestId;
            }, angular.noop);
        };

        vm.getLearningProgress = function (testId) {
            return vm.learningProgressByTestId[String(testId)] || null;
        };

        vm.formatLearningDuration = function (seconds) {
            var totalMinutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
            if (totalMinutes < 60) { return totalMinutes + ' phút'; }
            return Math.floor(totalMinutes / 60) + ' giờ ' + (totalMinutes % 60) + ' phút';
        };

        vm.testCatalogUrl = function (item) {
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/');
            return route + item.id + (vm.getLearningProgress(item.id) ? '?sessionMode=STUDY' : '');
        };

        vm.seriousTestCatalogUrl = function (item) {
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/');
            return route + item.id + '?sessionMode=SERIOUS&startFresh=1';
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
