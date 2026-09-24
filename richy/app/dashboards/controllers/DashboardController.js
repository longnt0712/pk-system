/**
 * Created by bizic on 28/8/2016.
 */
(function () {
    'use strict';

    angular.module('Hrm.Dashboard').controller('DashboardController', DashboardController);

    DashboardController.$inject = [
        '$rootScope',
        '$scope',
        '$http',
        '$timeout',
        'settings',
        'Utilities',
        '$cookies',
        '$location',
        '$window',
        '$state'
    ];

    function DashboardController($rootScope, $scope, $http, $timeout, settings, utils, $cookies, $location, $window, $state) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.currentUser = {};
        vm.myUser = {
            id: null,
            name: '',
            roles: []
        };

        vm.permissionsLoaded = false;
        vm.assignedTasks = [];
        vm.assignedTasksLoading = false;
        vm.assignedTasksError = false;
        vm.resumeDrafts = [];

        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;
        vm.isRoleStaff = false;
        vm.isRoleStaffManagement = false;
        vm.isRoleStudentManagerment = false;
        vm.isEducationManagerment = false;

        vm.resetRoles = function () {
            vm.isRoleView = false;
            vm.isRoleUser = false;
            vm.isRoleAdmin = false;
            vm.isRoleStaff = false;
            vm.isRoleStaffManagement = false;
            vm.isRoleStudentManagerment = false;
            settings.isAdmin = false;
            vm.isEducationManagerment = false;
        };

        vm.applyRoles = function (roles) {
            vm.resetRoles();

            angular.forEach(roles || [], function (value) {
                if (value.name === "ROLE_VIEWER") {
                    vm.isRoleView = true;
                }
                if (value.name === "ROLE_USER") {
                    vm.isRoleUser = true;
                    console.log('User');
                }
                if (value.name === "ROLE_ADMIN") {
                    vm.isRoleAdmin = true;
                    settings.isAdmin = true;
                    console.log('Admin');
                }
                if (value.name === "ROLE_STAFF") {
                    vm.isRoleStaff = true;
                    console.log('Staff');
                }
                if (value.name === "ROLE_STAFF_MANAGEMENT") {
                    vm.isRoleStaffManagement = true;
                    console.log('Staff Management');
                }
                if (value.name === "ROLE_STUDENT_MANAGERMENT") {
                    vm.isRoleStudentManagerment = true;
                    console.log('isRoleStudentManagerment');
                }
                if (value.name === "ROLE_EDUCATION_MANAGERMENT") {
                    vm.isEducationManagerment = true;
                    console.log('isEducationManagerment');
                }
            });
        };

        vm.hasRole = function (roleName) {
            if (!vm.myUser || !vm.myUser.roles || !vm.myUser.roles.length) {
                return false;
            }

            for (var i = 0; i < vm.myUser.roles.length; i++) {
                if (vm.myUser.roles[i].name === roleName) {
                    return true;
                }
            }
            return false;
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

        vm.buildCurrentUser = function (rawUser) {
            vm.currentUser = rawUser || {};
            vm.myUser = {
                id: vm.currentUser.id || null,
                name: vm.currentUser.displayName || '',
                roles: vm.currentUser.roles || []
            };

            vm.applyRoles(vm.myUser.roles);
            vm.loadResumeDrafts();
        };

        vm.loadAssignedTasks = function () {
            if (!settings.ieltsRoom || !vm.myUser.id || !(vm.isRoleView || vm.isRoleUser || vm.hasRole('ROLE_STUDENT'))) {
                vm.assignedTasks = [];
                return;
            }
            vm.assignedTasksLoading = true;
            vm.assignedTasksError = false;
            var url = settings.api.baseUrl + settings.api.apiV1Url + 'enrolment_class/schedule/my-assignments';
            $http.get(url).then(function (response) {
                vm.assignedTasks = angular.isArray(response.data) ? response.data : [];
            }, function () {
                vm.assignedTasks = [];
                vm.assignedTasksError = true;
            }).finally(function () {
                vm.assignedTasksLoading = false;
            });
        };

        vm.assignmentTypeLabel = function (task) {
            var labels = {
                DAILY_VOCAB: 'Daily Vocab',
                DAILY_LISTENING: 'Daily Listening',
                IELTS_READING: 'IELTS Reading',
                IELTS_LISTENING: 'IELTS Listening',
                IELTS_WRITING: 'IELTS Writing',
                COMPREHENSIVE: 'Bài tập tổng hợp',
                OTHER: 'Bài được giao'
            };
            return labels[(task || {}).activityType] || 'Bài được giao';
        };

        vm.assignmentIcon = function (task) {
            var icons = {
                DAILY_VOCAB: 'fa-language',
                DAILY_LISTENING: 'fa-headphones',
                IELTS_READING: 'fa-file-text-o',
                IELTS_LISTENING: 'fa-volume-up',
                IELTS_WRITING: 'fa-pencil-square-o',
                COMPREHENSIVE: 'fa-pencil-square-o',
                OTHER: 'fa-bookmark'
            };
            return icons[(task || {}).activityType] || 'fa-bookmark';
        };

        vm.assignmentActionLabel = function (task) {
            if (task && task.activityType === 'DAILY_VOCAB') { return 'Làm Daily Vocab'; }
            if (task && task.activityType === 'DAILY_LISTENING') { return 'Làm Daily Listening'; }
			if (task && task.activityType === 'IELTS_READING') { return 'Làm Reading Part ' + task.ieltsPart; }
			if (task && task.activityType === 'IELTS_LISTENING') { return 'Làm Listening Part ' + task.ieltsPart; }
			if (task && task.activityType === 'IELTS_WRITING') { return 'Làm Writing Task ' + task.ieltsPart; }
			if (task && task.activityType === 'COMPREHENSIVE') { return 'Làm bài được giao'; }
            return 'Xem bài được giao';
        };

		vm.isIeltsAssignment = function (task) {
			return !!task && !!task.ieltsTestId && (task.activityType === 'IELTS_READING'
				|| task.activityType === 'IELTS_LISTENING' || task.activityType === 'IELTS_WRITING' || task.activityType === 'COMPREHENSIVE');
		};

        vm.openAssignedTask = function (task) {
            if (!task) { return; }
            var params = {
                listFlashCard: 0,
                assignmentTopicId: task.topicId,
                assignmentCategoryId: task.categoryId,
                assignmentTaskId: task.taskId,
                assignmentSourceQuestionId: task.sourceQuestionId
            };
            if (task.activityType === 'DAILY_VOCAB') {
                $state.go('application.daily_vocab', params);
            } else if (task.activityType === 'DAILY_LISTENING') {
                $state.go('application.view', params);
			} else if (vm.isIeltsAssignment(task)) {
				$state.go(task.activityType === 'COMPREHENSIVE' ? 'application.comprehensive_actual_test'
					: (task.activityType === 'IELTS_WRITING' ? 'application.ielts_writing_actual_test' : (task.activityType === 'IELTS_LISTENING' ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test')), {
					ieltsReadingTestId: task.ieltsTestId,
					assignmentTaskId: task.taskId,
					assignmentPart: task.ieltsPart,
					sessionMode: 'STUDY'
				});
            } else {
                $state.go('application.englishClass');
            }
        };

        vm.loadResumeDrafts = function () {
            vm.resumeDrafts = [];
            if (!vm.myUser.id) { return; }

            var userId = String(vm.myUser.id);
            var ieltsPrefix = 'ieltsReadingInProgress:' + userId;
            var dailyVocabKey = 'daily-vocab-active:v1:' + userId;
            var dailyListeningPrefix = 'daily-listening-progress:v1:' + userId + ':';

            function readDraft(key) {
                try { return JSON.parse($window.localStorage.getItem(key)); }
                catch (ignoreDraftReadError) { return null; }
            }

            function pushResumeDraft(item) {
                if (!item || !item.storageKey) { return; }
                for (var i = 0; i < vm.resumeDrafts.length; i++) {
                    if (vm.resumeDrafts[i].storageKey === item.storageKey) {
                        if (Number(item.savedAt) >= Number(vm.resumeDrafts[i].savedAt)) {
                            vm.resumeDrafts[i] = item;
                        }
                        return;
                    }
                }
                vm.resumeDrafts.push(item);
            }

            function sortResumeDrafts() {
                vm.resumeDrafts.sort(function (a, b) { return Number(b.savedAt) - Number(a.savedAt); });
            }

            function addIeltsDraft(key, draft) {
                if (!draft || !draft.testId || String(draft.userId) !== userId || draft.completed === true) { return; }
                var savedAt = new Date(draft.savedAt || 0).getTime();
                var taskMatch = /:task:(\d+)$/.exec(key);
                var comprehensive = draft.testMode === 'COMPREHENSIVE'
                    || key.indexOf(ieltsPrefix + ':comprehensive') === 0;
                var writing = draft.testMode === 'WRITING' || key.indexOf(ieltsPrefix + ':writing') === 0;
                var listening = draft.isListening === true || draft.testMode === 'LISTENING'
                    || key.indexOf(ieltsPrefix + ':listening') === 0
                    || /listening/i.test(String(draft.title || ''));
                pushResumeDraft({
                    kind: comprehensive ? 'COMPREHENSIVE' : (writing ? 'IELTS_WRITING' : (listening ? 'IELTS_LISTENING' : 'IELTS_READING')),
                    storageKey: key,
                    title: draft.title || (comprehensive ? 'Bài tập tổng hợp' : (writing ? 'IELTS Writing Test' : (listening ? 'IELTS Listening Test' : 'IELTS Reading Test'))),
                    savedAt: isFinite(savedAt) ? savedAt : 0,
                    remainingSeconds: Number(draft.remainingSeconds) || 0,
                    elapsedSeconds: Number(draft.elapsedSeconds) || 0,
                    sessionMode: draft.sessionMode || 'SERIOUS',
                    progressLabel: 'Đã trả lời',
                    progressValue: (Number(draft.answeredCount) || 0) + '/' + (Number(draft.totalQuestions) || 40) + ' câu',
                    testId: draft.testId,
                    assignmentTaskId: draft.assignmentTaskId || (taskMatch ? Number(taskMatch[1]) : null),
                    assignmentPart: draft.assignmentPart || (taskMatch ? draft.passageNumber : null)
                });
            }

            function addDailyVocabDraft(draft) {
                if (!draft || draft.version !== 1 || String(draft.ownerId) !== userId
                        || !draft.savedAt
                        || !angular.isArray(draft.questions) || !draft.questions.length) { return; }
                var completed = Math.max(0, Math.min(Number(draft.currentPosition) || 0, Number(draft.totalCard) || draft.questions.length));
                pushResumeDraft({
                    kind: 'DAILY_VOCAB',
                    storageKey: dailyVocabKey,
                    title: draft.title || 'Daily Vocab',
                    savedAt: Number(draft.savedAt) || 0,
                    remainingSeconds: Number(draft.counter) || 0,
                    progressLabel: 'Đã làm',
                    progressValue: completed + '/' + (Number(draft.totalCard) || draft.questions.length) + ' từ'
                });
            }

            function addDailyListeningDraft(key, draft) {
                if (!draft || draft.version !== 1 || draft.modeId !== 8 || String(draft.ownerId) !== userId
                        || !draft.card || draft.card.id == null || !draft.updatedAt) { return; }
                pushResumeDraft({
                    kind: 'DAILY_LISTENING',
                    storageKey: key,
                    title: draft.card.question || 'Daily Listening',
                    savedAt: Number(draft.updatedAt) || 0,
                    progressLabel: 'Tiến độ',
                    progressValue: (Number(draft.percentage) || 0) + '%',
                    assignmentTaskId: draft.assignmentTaskId || null,
                    assignmentTopicId: draft.assignmentTopicId || null,
                    assignmentCategoryId: draft.assignmentCategoryId || null,
                    assignmentSourceQuestionId: draft.assignmentSourceQuestionId || draft.card.id
                });
            }

            try {
                addDailyVocabDraft(readDraft(dailyVocabKey));
                for (var index = 0; index < $window.localStorage.length; index++) {
                    var key = $window.localStorage.key(index);
                    if (!key) { continue; }
                    if (key === ieltsPrefix || key.indexOf(ieltsPrefix + ':task:') === 0
                            || key.indexOf(ieltsPrefix + ':reading') === 0
                            || key.indexOf(ieltsPrefix + ':listening') === 0
                            || key.indexOf(ieltsPrefix + ':writing') === 0
                            || key.indexOf(ieltsPrefix + ':comprehensive') === 0) {
                        addIeltsDraft(key, readDraft(key));
                    }
                    if (key.indexOf(dailyListeningPrefix) === 0) { addDailyListeningDraft(key, readDraft(key)); }
                }
            } catch (ignoreDraftStorageError) {
                vm.resumeDrafts = [];
            }
            sortResumeDrafts();

            var draftsUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_result/drafts';
            $http.get(draftsUrl).then(function (response) {
                angular.forEach(angular.isArray(response.data) ? response.data : [], function (item) {
                    if (!item || !item.draftKey || !item.payload) { return; }
                    var payload = null;
                    try { payload = JSON.parse(item.payload); } catch (ignoreServerPayload) { return; }
                    var displayPayload = payload;
                    try {
                        var local = readDraft(item.draftKey);
                        var localTime = new Date((local || {}).savedAt || (local || {}).updatedAt || (local || {}).createdAt || 0).getTime() || 0;
                        if (!local || Number(item.savedAt) >= localTime) {
                            $window.localStorage.setItem(item.draftKey, item.payload);
                        } else {
                            displayPayload = local;
                        }
                    } catch (ignoreServerCacheError) {}
                    if (item.draftType === 'IELTS') { addIeltsDraft(item.draftKey, displayPayload); }
                    if (item.draftType === 'DAILY_VOCAB') { addDailyVocabDraft(displayPayload); }
                    if (item.draftType === 'DAILY_LISTENING') { addDailyListeningDraft(item.draftKey, displayPayload); }
                });
                sortResumeDrafts();
            }, angular.noop);
        };

        vm.formatReadingDraftTime = function (seconds) {
            var totalSeconds = Math.max(0, Number(seconds) || 0);
            var minutes = Math.floor(totalSeconds / 60);
            var remainingSeconds = totalSeconds % 60;
            return minutes + ':' + (remainingSeconds < 10 ? '0' : '') + remainingSeconds;
        };

        vm.resumeDraft = function (draft) {
            if (!draft) { return; }
            if (draft.kind === 'DAILY_VOCAB') {
                try { $window.sessionStorage.setItem('daily-vocab-dashboard-resume:v1:' + vm.myUser.id, '1'); } catch (ignoreResumeFlagError) {}
                $state.go('application.daily_vocab', {listFlashCard: 0});
                return;
            }
            if (draft.kind === 'DAILY_LISTENING') {
                try { $window.sessionStorage.setItem('daily-listening-dashboard-resume:v1:' + vm.myUser.id, '1'); } catch (ignoreListeningResumeFlagError) {}
                $state.go('application.view', {
                    listFlashCard: 0,
                    assignmentTaskId: draft.assignmentTaskId,
                    assignmentTopicId: draft.assignmentTopicId,
                    assignmentCategoryId: draft.assignmentCategoryId,
                    assignmentSourceQuestionId: draft.assignmentSourceQuestionId
                });
                return;
            }
            if (!draft.testId) { return; }
            $state.go(draft.kind === 'COMPREHENSIVE' ? 'application.comprehensive_actual_test'
                : (draft.kind === 'IELTS_WRITING' ? 'application.ielts_writing_actual_test' : (draft.kind === 'IELTS_LISTENING' ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test')), {
                ieltsReadingTestId: draft.testId,
                assignmentTaskId: draft.assignmentTaskId,
                assignmentPart: draft.assignmentPart,
                sessionMode: draft.sessionMode || (draft.assignmentTaskId ? 'STUDY' : 'SERIOUS')
            });
        };

        vm.cancelDraft = function (draft) {
            if (!draft || !draft.storageKey) { return; }
            if (!$window.confirm('Bạn có chắc muốn hủy bài đang làm dở? Toàn bộ tiến độ đã tự lưu của bài này sẽ bị xóa.')) { return; }
            try { $window.localStorage.removeItem(draft.storageKey); }
            catch (ignoreDraftCancelError) { return; }
            var deleteUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_result/draft/delete';
            $http.post(deleteUrl, {draftKey: draft.storageKey}).finally(function () {
                vm.loadResumeDrafts();
            });
        };

        vm.loadCurrentUserFromCookie = function () {
            vm.permissionsLoaded = false;

            var userCookie = $cookies.get("education.user");

            if (userCookie) {
                try {
                    vm.buildCurrentUser(JSON.parse(userCookie));
                } catch (e) {
                    console.error("Parse education.user failed:", e);
                    vm.currentUser = {};
                    vm.myUser = {
                        id: null,
                        name: '',
                        roles: []
                    };
                    vm.resetRoles();
                }

                vm.permissionsLoaded = true;
                vm.loadAssignedTasks();
                return;
            }

            $timeout(function () {
                var retryCookie = $cookies.get("education.user");

                if (retryCookie) {
                    try {
                        vm.buildCurrentUser(JSON.parse(retryCookie));
                    } catch (e) {
                        console.error("Retry parse education.user failed:", e);
                        vm.currentUser = {};
                        vm.myUser = {
                            id: null,
                            name: '',
                            roles: []
                        };
                        vm.resetRoles();
                    }
                } else {
                    vm.currentUser = {};
                    vm.myUser = {
                        id: null,
                        name: '',
                        roles: []
                    };
                    vm.resetRoles();
                }

                vm.permissionsLoaded = true;
                vm.loadAssignedTasks();
            }, 300);
        };

        vm.loadCurrentUserFromCookie();

        var checkHttp = $location.protocol();
        if (checkHttp === 'http') {
            // để nguyên nếu bạn cần xử lý sau
            /*console.log(checkHttp);
            $state.go('login');
            var hostname = window.location.hostname;
            $window.location.href = hostname + '/dashboard';*/
        }
    }

})();
