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

        vm.isTnttDomain = /^(www\.)?tnttphungkhoang\.com$/i.test(($window.location || {}).hostname || '');

        vm.currentUser = {};
        vm.myUser = {
            id: null,
            name: '',
            roles: []
        };

        vm.permissionsLoaded = false;
        vm.assignedTasks = [];
        vm.assignmentClassGroups = [];
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

        vm.groupAssignmentsByClass = function (tasks) {
            var groups = [], byClass = Object.create(null);
            (angular.isArray(tasks) ? tasks : []).forEach(function (task) {
                if (!task) { return; }
                var className = String(task.className || '').trim();
                var classId = task.classId == null ? '' : String(task.classId).trim();
                var key = classId ? 'class:' + classId : (className ? 'name:' + className : 'unknown');
                var group = byClass[key];
                if (!group) {
                    group = {key: key, classId: classId ? task.classId : null,
                        className: className || 'Chưa xác định lớp', tasks: []};
                    byClass[key] = group;
                    groups.push(group);
                } else if (className && group.className === 'Chưa xác định lớp') {
                    group.className = className;
                }
                group.tasks.push(task);
            });
            return groups;
        };

        vm.loadAssignedTasks = function () {
            if (!settings.ieltsRoom || !vm.myUser.id || !(vm.isRoleView || vm.isRoleUser || vm.hasRole('ROLE_STUDENT'))) {
                vm.assignedTasks = [];
                vm.assignmentClassGroups = [];
                return;
            }
            vm.assignedTasksLoading = true;
            vm.assignedTasksError = false;
            var url = settings.api.baseUrl + settings.api.apiV1Url + 'enrolment_class/schedule/my-assignments';
            $http.get(url).then(function (response) {
                vm.assignedTasks = (angular.isArray(response.data) ? response.data : []).filter(function (task) {
                    return task && !!task.dueDate && task.overdue !== true;
                });
                vm.assignmentClassGroups = vm.groupAssignmentsByClass(vm.assignedTasks);
            }, function () {
                vm.assignedTasks = [];
                vm.assignmentClassGroups = [];
                vm.assignedTasksError = true;
            }).finally(function () {
                vm.assignedTasksLoading = false;
            });
        };

        vm.assignmentKey = function (task) {
            return String(task.taskId) + ':topic:' + (task.topicId || 'none')
                + (task.activityType === 'COMPREHENSIVE' && task.assignmentSectionKey ? ':section:' + task.assignmentSectionKey : '');
        };

        vm.assignmentTopicComplete = function (task) {
            return !!task && ((task.activityType === 'DAILY_VOCAB' && Number(task.taskTotalTopics) > 1)
                || (task.activityType === 'COMPREHENSIVE' && !!task.assignmentSectionKey))
                && Number(task.completedAttempts) >= Number(task.requiredAttempts) && Number(task.requiredAttempts) > 0;
        };

        vm.assignmentTaskProgressPercent = function (task) {
            return Math.max(0, Math.min(100, Math.round(Number((task || {}).taskProgressPercent) || 0)));
        };
        vm.assignmentTimeLabel = function (task) {
            var minutes = task && task.comprehensiveTimeLimitMinutes;
            if (minutes == null) { return 'Theo thời gian của đề'; }
            return Number(minutes) === 0 ? 'Không tính giờ' : Number(minutes) + ' phút';
        };

        vm.assignmentProgressPercent = function (task) {
            var required = Number((task || {}).requiredAttempts);
            return required > 0 ? Math.max(0, Math.min(100, Math.round(Number(task.completedAttempts || 0) * 100 / required))) : 0;
        };

        vm.hasAssignmentExercise = function (task) {
            return !!task && (!!task.topicId || !!task.ieltsTestId
                || (task.activityType === 'DAILY_LISTENING' && !!task.sourceQuestionId));
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
			if (task && task.activityType === 'COMPREHENSIVE') { return task.assignmentSectionKey ? 'Làm phần ' + task.sectionNumber : 'Làm bài được giao'; }
            return 'Xem bài được giao';
        };

		vm.isIeltsAssignment = function (task) {
			return !!task && !!task.ieltsTestId && (task.activityType === 'IELTS_READING'
				|| task.activityType === 'IELTS_LISTENING' || task.activityType === 'IELTS_WRITING' || task.activityType === 'COMPREHENSIVE');
		};
		vm.assignmentPartsLabel = function (task) {
			if (task.activityType === 'COMPREHENSIVE' && task.assignmentSectionKey) { return 'Phần ' + task.sectionNumber + '/' + task.sectionCount; }
			var parts = angular.isArray(task.ieltsParts) ? task.ieltsParts : [task.ieltsPart];
			return (task.activityType === 'IELTS_WRITING' ? 'Task ' : 'Part ') + parts.join(', ');
		};

        vm.openAssignedTask = function (task) {
            if (!task || vm.assignmentTopicComplete(task)) { return; }
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
				var ieltsParams = {
					ieltsReadingTestId: task.ieltsTestId,
					assignmentTaskId: task.taskId,
					assignmentPart: task.ieltsPart,
					assignmentParts: (task.remainingIeltsParts && task.remainingIeltsParts.length ? task.remainingIeltsParts : (task.ieltsParts || [task.ieltsPart])).join(','),
					sessionMode: 'SERIOUS'
				};
				if (task.activityType === 'COMPREHENSIVE' && task.assignmentSectionKey) { ieltsParams.assignmentSectionKey = task.assignmentSectionKey; }
				$state.go(task.activityType === 'COMPREHENSIVE' ? 'application.comprehensive_actual_test'
					: (task.activityType === 'IELTS_WRITING' ? 'application.ielts_writing_actual_test' : (task.activityType === 'IELTS_LISTENING' ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test')), ieltsParams);
            } else {
                $state.go('application.englishClass');
            }
        };

        function ieltsReminderParts(parts) {
            return (angular.isArray(parts) ? parts : []).map(Number).sort(function (a, b) { return a - b; }).join(',');
        }
        function ieltsReminderInfo(key, draft, savedResult) {
            var base = String(key || '').replace(/:attempt:[a-f0-9]{32}$/, '');
            var taskMatch = /:task:(\d+)(?=:|$)/.exec(base);
            var taskId = draft.assignmentTaskId || (taskMatch ? Number(taskMatch[1]) : null);
            var parts = angular.isArray(draft.assignmentParts) && draft.assignmentParts.length ? draft.assignmentParts
                : (draft.isPartAssignment !== false && draft.assignmentPart ? [draft.assignmentPart] : []);
            var mode = draft.testMode || (/comprehensive/i.test(base) ? 'COMPREHENSIVE'
                : (/writing/i.test(base) ? 'WRITING' : (draft.isListening || /listening/i.test(base) ? 'LISTENING' : 'READING')));
            var type = mode === 'COMPREHENSIVE' ? 6 : (mode === 'WRITING' ? 7 : (mode === 'LISTENING' ? 2 : 4));
            var sectionMatch = /:section:([A-Za-z0-9_-]{1,40})(?=:|$)/.exec(base);
            var storedSection = typeof draft.assignmentSectionKey === 'string' ? draft.assignmentSectionKey : '';
            var sectionKey = mode === 'COMPREHENSIVE' ? (sectionMatch ? sectionMatch[1] : (storedSection || null)) : null;
            var coherentSection = !sectionMatch || !storedSection || sectionMatch[1] === storedSection;
            var state = draft.submissionState || {}, payload = state.payload || {}, result = state.result || {};
            var attempt = /^[a-f0-9]{32}$/.test(draft.clientAttemptKey || '') ? draft.clientAttemptKey
                : (/^[a-f0-9]{32}$/.test(state.key || '') ? state.key : null);
            var validState = coherentSection && !!attempt && state.key === attempt && payload.clientAttemptKey === attempt
                && payload.user && String(payload.user.id) === String(draft.userId)
                && (Number(payload.testType) === type || ((mode === 'READING' || mode === 'LISTENING')
                    && (Number(payload.testType) === 2 || Number(payload.testType) === 4))) && String(payload.sourceQuestionId) === String(draft.testId)
                && String(payload.assignmentTaskId || '') === String(taskId || '')
                && String(payload.assignmentSectionKey || '') === String(sectionKey || '')
                && ieltsReminderParts(payload.completedParts) === ieltsReminderParts(parts);
            var confirmed = validState && state.status === 'SAVED' && isFinite(Number(result.id)) && Number(result.id) > 0
                && (result.clientAttemptKey == null || result.clientAttemptKey === attempt)
                && result.user && String(result.user.id) === String(draft.userId) && Number(result.testType) === Number(payload.testType)
                && String(result.sourceQuestionId) === String(draft.testId)
                && Object.prototype.hasOwnProperty.call(result, 'assignmentTaskId')
                && String(result.assignmentTaskId || '') === String(taskId || '') && angular.isArray(result.completedParts)
                && String(result.assignmentSectionKey || '') === String(sectionKey || '')
                && ieltsReminderParts(result.completedParts) === ieltsReminderParts(parts);
            var sessionMode = taskId ? 'SERIOUS' : String(draft.sessionMode || (/:study(?=:|$)/i.test(base) ? 'STUDY' : 'SERIOUS')).toUpperCase();
            var receiptParts = parts.length ? parts : (angular.isArray(draft.partNumbers) ? draft.partNumbers : []);
            var serverConfirmed = coherentSection && !!attempt && savedResult && Number(savedResult.id) > 0
                && savedResult.clientAttemptKey === attempt && savedResult.user && String(savedResult.user.id) === String(draft.userId)
                && Number(savedResult.testType) === type && String(savedResult.sourceQuestionId) === String(draft.testId)
                && Object.prototype.hasOwnProperty.call(savedResult, 'assignmentTaskId')
                && String(savedResult.assignmentTaskId || '') === String(taskId || '')
                && String(savedResult.assignmentSectionKey || '') === String(sectionKey || '')
                && receiptParts.length && angular.isArray(savedResult.completedParts)
                && ieltsReminderParts(savedResult.completedParts) === ieltsReminderParts(receiptParts)
                && savedResult.ieltsSessionMode !== 'STUDY'
                && (savedResult.resultStatus === 'SUCCESS' || (validState && state.status === 'PENDING' && savedResult.resultStatus === 'FAILED'));
            return {baseKey: base, attemptKey: attempt, taskId: taskId, parts: parts, sectionKey: sectionKey, sessionMode: sessionMode,
                confirmed: !!(confirmed || serverConfirmed), pending: !!(validState && state.status === 'PENDING'),
                context: 'IELTS:' + draft.userId + ':' + mode + ':' + draft.testId + ':' + sessionMode
                    + ':task:' + (taskId || '') + ':parts:' + ieltsReminderParts(parts) + (sectionKey ? ':section:' + sectionKey : '')};
        }
        function sameIeltsReminderRun(first, second) {
            return first.ieltsContext && first.ieltsContext === second.ieltsContext
                && !!first.pendingSave !== !!second.pendingSave && first.ieltsAttemptKey
                && first.ieltsAttemptKey === second.ieltsAttemptKey;
        }

        vm.loadResumeDrafts = function () {
            vm.resumeDrafts = [];
            if (!vm.myUser.id) { return; }

            var userId = String(vm.myUser.id);
            var ieltsPrefix = 'ieltsReadingInProgress:' + userId;
            var dailyVocabKey = 'daily-vocab-active:v1:' + userId;
            var dailyPendingKey = 'daily-vocab-pending:v1:' + userId;
            var dailyListeningPrefix = 'daily-listening-progress:v1:' + userId + ':';

            function readDraft(key) {
                try { return JSON.parse($window.localStorage.getItem(key)); }
                catch (ignoreDraftReadError) { return null; }
            }

            function sameVocabRun(first, second) {
                if (!first.vocabContext || first.vocabContext !== second.vocabContext || !!first.pendingSave === !!second.pendingSave) { return false; }
                var pending = first.pendingSave ? first : second;
                var active = first.pendingSave ? second : first;
                if (pending.vocabRunId || active.vocabRunId) { return !!pending.vocabRunId && pending.vocabRunId === active.vocabRunId; }
                return Number(active.savedAt) <= Number(pending.savedAt);
            }

            function pushResumeDraft(item) {
                if (!item || !item.storageKey) { return; }
                for (var i = 0; i < vm.resumeDrafts.length; i++) {
                    var existing = vm.resumeDrafts[i];
                    if (sameIeltsReminderRun(existing, item)) {
                        if (item.pendingSave) { vm.resumeDrafts[i] = item; }
                        return;
                    }
                    if (sameVocabRun(existing, item)) {
                        if (item.pendingSave) { vm.resumeDrafts[i] = item; }
                        return;
                    }
                    if ((existing.resumeIdentity || existing.storageKey) === (item.resumeIdentity || item.storageKey)) {
                        if (Number(item.savedAt) >= Number(existing.savedAt)) { vm.resumeDrafts[i] = item; }
                        return;
                    }
                }
                vm.resumeDrafts.push(item);
            }

            function sortResumeDrafts() {
                vm.resumeDrafts.sort(function (a, b) { return Number(b.savedAt) - Number(a.savedAt); });
            }

            function ieltsDraftAssignmentPart(key, draft) {
                if (!draft || draft.isPartAssignment === false) { return null; }
                var draftKey = String(key || '');
                var storedPart = Number(draft.assignmentPart) || null;
                var isPartAssignment = draft.isPartAssignment === true
                    || /:(?:part|writing-task):\d+$/.test(draftKey)
                    || (!!storedPart && (!!draft.assignmentTaskId || /:task:\d+(?=:|$)/.test(draftKey)));
                if (!isPartAssignment) { return null; }
                return storedPart || Number(draft.passageNumber) || null;
            }

            function addIeltsDraft(key, draft, savedResult) {
                if (!draft || !draft.testId || String(draft.userId) !== userId
                        || draft.completed === true || draft.hiddenFromDashboard === true) { return; }
                var info = ieltsReminderInfo(key, draft, savedResult);
                if (info.confirmed) {
                    vm.resumeDrafts = vm.resumeDrafts.filter(function (item) { return item.ieltsContext !== info.context || item.ieltsAttemptKey !== info.attemptKey; });
                    return;
                }
                var savedAt = new Date(draft.savedAt || 0).getTime();
                var comprehensive = draft.testMode === 'COMPREHENSIVE'
                    || key.indexOf(ieltsPrefix + ':comprehensive') === 0;
                var writing = draft.testMode === 'WRITING' || key.indexOf(ieltsPrefix + ':writing') === 0;
                var listening = draft.isListening === true || draft.testMode === 'LISTENING'
                    || key.indexOf(ieltsPrefix + ':listening') === 0
                    || /listening/i.test(String(draft.title || ''));
                pushResumeDraft({
                    kind: comprehensive ? 'COMPREHENSIVE' : (writing ? 'IELTS_WRITING' : (listening ? 'IELTS_LISTENING' : 'IELTS_READING')),
                    storageKey: key,
                    resumeIdentity: info.context + (info.pending ? ':pending:' + info.attemptKey : ':active'),
                    ieltsContext: info.context, ieltsAttemptKey: info.attemptKey, pendingSave: info.pending,
                    title: draft.title || (comprehensive ? 'Bài tập tổng hợp' : (writing ? 'IELTS Writing Test' : (listening ? 'IELTS Listening Test' : 'IELTS Reading Test'))),
                    savedAt: isFinite(savedAt) ? savedAt : 0,
                    remainingSeconds: Number(draft.remainingSeconds) || 0,
                    elapsedSeconds: Number(draft.elapsedSeconds) || 0,
                    assignmentUntimed: draft.assignmentUntimed === true,
                    assignmentSectionKey: info.sectionKey,
                    sectionNumber: Number(draft.sectionNumber) || null,
                    sectionCount: Number(draft.sectionCount) || null,
                    sessionMode: info.sessionMode,
                    progressLabel: info.pending ? 'Trạng thái' : 'Đã trả lời',
                    progressValue: info.pending ? 'Chưa nhận xác nhận lưu' : (Number(draft.answeredCount) || 0) + '/' + (Number(draft.totalQuestions) || 40) + ' câu',
                    testId: draft.testId,
                    assignmentTaskId: info.taskId,
                    assignmentPart: ieltsDraftAssignmentPart(info.baseKey, draft),
                    assignmentParts: angular.copy(info.parts)
                });
            }

            function addDailyVocabDraft(key, draft) {
                if (!draft || draft.version !== 1 || String(draft.ownerId) !== userId
                        || !draft.savedAt
                        || !angular.isArray(draft.questions) || !draft.questions.length) { return; }
                var completed = Math.max(0, Math.min(Number(draft.currentPosition) || 0, Number(draft.totalCard) || draft.questions.length));
                var context = dailyVocabKey + (draft.assignmentTaskId && draft.assignmentTopicId ? ':task:' + draft.assignmentTaskId + ':topic:' + draft.assignmentTopicId : '');
                pushResumeDraft({
                    kind: 'DAILY_VOCAB',
                    storageKey: key,
                    resumeIdentity: context + ':active', vocabContext: context, vocabRunId: draft.runId || null,
                    title: draft.title || 'Daily Vocab',
                    savedAt: Number(draft.savedAt) || 0,
                    remainingSeconds: Number(draft.counter) || 0,
                    progressLabel: 'Đã làm',
                    progressValue: completed + '/' + (Number(draft.totalCard) || draft.questions.length) + ' từ',
                    assignmentTaskId: draft.assignmentTaskId || null,
                    assignmentTopicId: draft.assignmentTopicId || null,
                    assignmentCategoryId: draft.assignmentCategoryId || draft.categoryId || null
                });
            }

            function addDailyVocabPending(key, draft) {
                var result = draft && draft.payload;
                if (!draft || draft.version !== 1 || String(draft.ownerId) !== userId || !result
                        || result.testType !== 1 || !result.user || String(result.user.id) !== userId
                        || !/^[a-f0-9]{32}$/.test(result.clientAttemptKey || '') || !(result.totalWord > 0)) { return; }
                var taskId = draft.assignmentTaskId || result.assignmentTaskId || null;
                var topicId = draft.assignmentTopicId || result.assignmentTopicId || null;
                pushResumeDraft({
                    kind: 'DAILY_VOCAB_PENDING', pendingSave: true, storageKey: key,
                    resumeIdentity: dailyPendingKey + ':attempt:' + result.clientAttemptKey,
                    vocabContext: dailyVocabKey + (taskId && topicId ? ':task:' + taskId + ':topic:' + topicId : ''),
                    vocabRunId: draft.activeRunId || null,
                    title: draft.title || result.testName || 'Daily Vocab',
                    savedAt: Number(draft.savedAt || draft.createdAt) || 0,
                    progressLabel: 'Trạng thái', progressValue: 'Chưa nhận xác nhận lưu',
                    assignmentTaskId: taskId, assignmentTopicId: topicId,
                    assignmentCategoryId: draft.assignmentCategoryId || null
                });
            }

            function addDailyListeningDraft(key, draft) {
                if (!draft || draft.version !== 1 || draft.modeId !== 8 || String(draft.ownerId) !== userId
                        || !draft.card || draft.card.id == null || !draft.updatedAt) { return; }
                pushResumeDraft({
                    kind: 'DAILY_LISTENING',
                    storageKey: key,
                    resumeIdentity: dailyListeningPrefix + draft.card.id + (draft.assignmentTaskId ? ':task:' + draft.assignmentTaskId : ''),
                    title: draft.card.question || 'Daily Listening',
                    dailyListeningId: draft.dailyListeningId || draft.card.id,
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
                addDailyVocabDraft(dailyVocabKey, readDraft(dailyVocabKey));
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
                    if (key === dailyPendingKey || key.indexOf(dailyPendingKey + ':task:') === 0 || key.indexOf(dailyPendingKey + ':attempt:') === 0) { addDailyVocabPending(key, readDraft(key)); }
                    if (key.indexOf(dailyVocabKey + ':task:') === 0 || key.indexOf(dailyVocabKey + ':run:') === 0) { addDailyVocabDraft(key, readDraft(key)); }
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
                    if (item.draftType === 'STUDY_NOTEBOOK') { return; }
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
                    if (item.draftType === 'IELTS') { addIeltsDraft(item.draftKey, displayPayload, item.savedResult); }
                    if (item.draftType === 'DAILY_VOCAB') { addDailyVocabDraft(item.draftKey, displayPayload); }
                    if (item.draftType === 'DAILY_VOCAB_PENDING') { addDailyVocabPending(item.draftKey, displayPayload); }
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
            if (draft.kind === 'DAILY_VOCAB' || draft.kind === 'DAILY_VOCAB_PENDING') {
                try {
                    if (draft.pendingSave) {
                        $window.sessionStorage.setItem('daily-vocab-pending-resume:v1:' + vm.myUser.id, draft.storageKey);
                        $window.sessionStorage.removeItem('daily-vocab-dashboard-resume:v1:' + vm.myUser.id);
                    } else {
                        $window.sessionStorage.setItem('daily-vocab-dashboard-resume:v1:' + vm.myUser.id, draft.vocabContext || draft.storageKey);
                        $window.sessionStorage.removeItem('daily-vocab-pending-resume:v1:' + vm.myUser.id);
                    }
                } catch (ignoreResumeFlagError) {}
                $state.go('application.daily_vocab', {
                    listFlashCard: 0,
                    assignmentTaskId: draft.assignmentTaskId || null,
                    assignmentTopicId: draft.assignmentTopicId || null,
                    assignmentCategoryId: draft.assignmentCategoryId || null
                });
                return;
            }
            if (draft.kind === 'DAILY_LISTENING') {
                var listeningId = draft.dailyListeningId || draft.assignmentSourceQuestionId;
                try { $window.sessionStorage.setItem('daily-listening-dashboard-resume:v1:' + vm.myUser.id, String(listeningId || '1')); } catch (ignoreListeningResumeFlagError) {}
                if (listeningId && !draft.assignmentTaskId) {
                    $state.go('application.daily_listening_actual_test', {dailyListeningId: listeningId});
                    return;
                }
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
            try {
                var marker = {
                    draftKey: draft.storageKey, clientAttemptKey: draft.ieltsAttemptKey || null, testId: draft.testId,
                    assignmentTaskId: draft.assignmentTaskId || null, assignmentParts: draft.assignmentParts || [],
                    sessionMode: draft.assignmentTaskId ? 'SERIOUS' : (draft.sessionMode || 'SERIOUS')
                };
                if (draft.assignmentSectionKey) { marker.assignmentSectionKey = draft.assignmentSectionKey; }
                $window.sessionStorage.setItem('ielts-draft-resume:v1:' + vm.myUser.id, JSON.stringify(marker));
            } catch (ignoreIeltsResumeChoice) {}
            var resumeParams = {
                ieltsReadingTestId: draft.testId,
                assignmentTaskId: draft.assignmentTaskId,
                assignmentPart: draft.assignmentPart,
                assignmentParts: (draft.assignmentParts || []).join(','),
                sessionMode: draft.sessionMode || (draft.assignmentTaskId ? 'SERIOUS' : 'STUDY')
            };
            if (draft.kind === 'COMPREHENSIVE' && draft.assignmentSectionKey) { resumeParams.assignmentSectionKey = draft.assignmentSectionKey; }
            $state.go(draft.kind === 'COMPREHENSIVE' ? 'application.comprehensive_actual_test'
                : (draft.kind === 'IELTS_WRITING' ? 'application.ielts_writing_actual_test' : (draft.kind === 'IELTS_LISTENING' ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test')), resumeParams);
        };

        function matchingIeltsLocalKeys(draft) {
            if (!draft.ieltsContext) { return [draft.storageKey]; }
            var base = draft.storageKey.replace(/:attempt:[a-f0-9]{32}$/, '');
            var candidates = [draft.storageKey, base];
            if (draft.ieltsAttemptKey) { candidates.push(base + ':attempt:' + draft.ieltsAttemptKey); }
            return candidates.filter(function (key, index) {
                if (candidates.indexOf(key) !== index) { return false; }
                try {
                    var payload = JSON.parse($window.localStorage.getItem(key) || 'null');
                    if (!payload) { return key === draft.storageKey; }
                    var info = ieltsReminderInfo(key, payload);
                    return info.context === draft.ieltsContext && info.attemptKey === draft.ieltsAttemptKey;
                } catch (ignoreMatchingDraft) { return key === draft.storageKey; }
            });
        }
        function ieltsReminderCloudKey(draft) {
            var base = draft.storageKey.replace(/:attempt:[a-f0-9]{32}$/, '');
            return draft.ieltsAttemptKey ? base + ':attempt:' + draft.ieltsAttemptKey : draft.storageKey;
        }

        vm.cancelDraft = function (draft) {
            if (!draft || !draft.storageKey) { return; }
            if (vm.isStudyDraft(draft)) { return vm.hideDraft(draft); }
            if (!$window.confirm('Bạn có chắc muốn hủy bài đang làm dở? Toàn bộ tiến độ đã tự lưu của bài này sẽ bị xóa.')) { return; }
            var localKeys = matchingIeltsLocalKeys(draft);
            try { localKeys.forEach(function (key) { $window.localStorage.removeItem(key); }); }
            catch (ignoreDraftCancelError) { return; }
            var deleteUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_result/draft/delete';
            var userId = vm.myUser.id;
            var cloudKeys = [draft.ieltsContext ? ieltsReminderCloudKey(draft) : draft.storageKey];
            if (draft.ieltsContext) {
                var base = draft.storageKey.replace(/:attempt:[a-f0-9]{32}$/, '');
                if (localKeys.indexOf(base) >= 0 && cloudKeys.indexOf(base) < 0) { cloudKeys.push(base); }
            }
            var request = null;
            cloudKeys.forEach(function (key) {
                function remove() {
                    return $http.post(deleteUrl, {draftKey: key}).then(function (response) {
                        if (response.data === true) { $rootScope.$broadcast('learningDraftDismissed', {draftKey: key, userId: userId}); }
                        return response;
                    });
                }
                request = request ? request.then(remove) : remove();
            });
            return request.catch(angular.noop).finally(function () { vm.loadResumeDrafts(); });
        };

        vm.isStudyDraft = function (draft) {
            return !!draft && !draft.assignmentTaskId && String(draft.sessionMode || '').toUpperCase() === 'STUDY'
                && ['IELTS_READING', 'IELTS_LISTENING', 'IELTS_WRITING', 'COMPREHENSIVE'].indexOf(draft.kind) >= 0;
        };

        vm.hideDraft = function (draft) {
            if (!vm.isStudyDraft(draft) || !draft.storageKey) { return; }

            var localKeys = matchingIeltsLocalKeys(draft);
            var storedDraft = null;
            for (var keyIndex = 0; keyIndex < localKeys.length; keyIndex++) {
                try {
                    var candidate = JSON.parse($window.localStorage.getItem(localKeys[keyIndex]) || 'null');
                    if (!candidate) { continue; }
                    if (draft.ieltsContext) {
                        var info = ieltsReminderInfo(localKeys[keyIndex], candidate);
                        if (info.context !== draft.ieltsContext || info.attemptKey !== draft.ieltsAttemptKey) { continue; }
                    }
                    storedDraft = candidate; break;
                } catch (ignoreHiddenDraftReadError) {}
            }
            if (!storedDraft) { return; }

            storedDraft.hiddenFromDashboard = true;
            storedDraft.savedAt = new Date().toISOString();
            try {
                localKeys.forEach(function (key) { $window.localStorage.setItem(key, JSON.stringify(storedDraft)); });
            } catch (ignoreHiddenDraftWriteError) { return; }

            vm.resumeDrafts = vm.resumeDrafts.filter(function (item) {
                return !(item.ieltsContext && item.ieltsContext === draft.ieltsContext && item.ieltsAttemptKey === draft.ieltsAttemptKey)
                    && item.storageKey !== draft.storageKey;
            });
            localKeys.forEach(function (key) { $rootScope.$broadcast('learningDraftDismissed', {draftKey: key, userId: vm.myUser.id}); });

            var saveUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_result/draft/save';
            $http.post(saveUrl, {
                draftKey: draft.ieltsContext ? ieltsReminderCloudKey(draft) : draft.storageKey,
                draftType: 'IELTS', title: draft.title,
                payload: JSON.stringify(storedDraft), savedAt: new Date(storedDraft.savedAt).getTime()
            }).catch(angular.noop);
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
