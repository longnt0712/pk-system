(function () {
    'use strict';

    angular.module('Hrm').directive('learningPet', learningPet);

    learningPet.$inject = ['$http', '$q', '$state', '$timeout', '$interval', '$window', '$cookies', '$rootScope', 'settings'];

    function learningPet($http, $q, $state, $timeout, $interval, $window, $cookies, $rootScope, settings) {
        var version = window.APP_VERSION || new Date().getTime();

        return {
            restrict: 'E',
            scope: {},
            bindToController: true,
            controllerAs: 'pet',
            controller: LearningPetController,
            templateUrl: 'common/views/learning-pet.html?v=' + version
        };

        function LearningPetController($scope) {
            var vm = this;
            var spriteTimer = null;
            var refreshTimer = null;
            var greetingTimer = null;
            var frameIndex = 0;
            var currentAnimation = '';
            var liveUser = null;
            var spriteScale = 0.5;
            var atlasWidth = 1536;
            var atlasHeight = 2288;
            var cellWidth = 192;
            var cellHeight = 208;
            var spriteUrl = 'assets/images/learning-pets/mam-hoc/spritesheet.webp?v=' + version;
            var animations = {
                idle: {row: 0, durations: [280, 110, 110, 140, 140, 320]},
                right: {row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220]},
                left: {row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220]},
                waving: {row: 3, durations: [140, 140, 140, 280]},
                completed: {row: 4, durations: [140, 140, 140, 140, 280]},
                failed: {row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240]},
                waiting: {row: 6, durations: [150, 150, 150, 150, 150, 260]},
                working: {row: 7, durations: [120, 120, 120, 120, 120, 220]},
                review: {row: 8, durations: [150, 150, 150, 150, 150, 280]}
            };

            vm.visible = false;
            vm.loading = false;
            vm.error = false;
            vm.panelOpen = false;
            vm.minimized = false;
            vm.activeSection = 'tasks';
            vm.tasks = [];
            vm.drafts = [];
            vm.pendingTaskCount = 0;
            vm.overdueCount = 0;
            vm.notificationCount = 0;
            vm.summaryTitle = 'Tiến độ học tập của bạn';
            vm.message = '';
            vm.spriteStyle = {};
            vm.petForm = 'egg-intact';
            vm.petImage = 'assets/images/learning-pets/mam-hoc/egg-level-0.png?v=' + version;

            function readCurrentUser() {
                if (liveUser && liveUser.id) { return liveUser; }
                var raw = $cookies.get('education.user');
                if (!raw) { return null; }
                try { return angular.fromJson(raw); }
                catch (ignoreUserCookie) { return null; }
            }

            function updatePetForm(user) {
                var level = Math.max(0, Number((user || {}).vocabularyExperienceLevel) || 0);
                if (level === 0) {
                    vm.petForm = 'egg-intact';
                    vm.petImage = 'assets/images/learning-pets/mam-hoc/egg-level-0.png?v=' + version;
                } else if (level === 1) {
                    vm.petForm = 'egg-cracked';
                    vm.petImage = 'assets/images/learning-pets/mam-hoc/egg-level-1.png?v=' + version;
                } else {
                    vm.petForm = 'hatched';
                    vm.petImage = '';
                }
            }

            function hasStudentRole(user) {
                var allowed = {ROLE_USER: true, ROLE_VIEWER: true, ROLE_STUDENT: true};
                var roles = (user || {}).roles || [];
                for (var i = 0; i < roles.length; i++) {
                    if (allowed[roles[i].name]) { return true; }
                }
                return false;
            }

            function sessionKey(suffix) {
                var user = readCurrentUser();
                return 'learning-pet:' + suffix + ':v1:' + (user && user.id ? user.id : 'guest');
            }

            function isMuted() {
                try { return $window.sessionStorage.getItem(sessionKey('muted')) === '1'; }
                catch (ignoreStorage) { return false; }
            }

            function shouldDisplay() {
                var user = readCurrentUser();
                return !!settings.ieltsRoom && !!user && !!user.id && hasStudentRole(user) && !isMuted();
            }

            function spritePosition(row, frame) {
                return {
                    backgroundImage: 'url("' + spriteUrl + '")',
                    backgroundSize: (atlasWidth * spriteScale) + 'px ' + (atlasHeight * spriteScale) + 'px',
                    backgroundPosition: (-frame * cellWidth * spriteScale) + 'px ' + (-row * cellHeight * spriteScale) + 'px',
                    width: (cellWidth * spriteScale) + 'px',
                    height: (cellHeight * spriteScale) + 'px'
                };
            }

            function stopSpriteTimer() {
                if (spriteTimer) {
                    $timeout.cancel(spriteTimer);
                    spriteTimer = null;
                }
            }

            function tickAnimation(animation) {
                vm.spriteStyle = spritePosition(animation.row, frameIndex);
                var delay = animation.durations[frameIndex] || 160;
                frameIndex = (frameIndex + 1) % animation.durations.length;
                spriteTimer = $timeout(function () { tickAnimation(animation); }, delay);
            }

            function playAnimation(name, restart) {
                name = animations[name] ? name : 'idle';
                if (!restart && currentAnimation === name && spriteTimer) { return; }
                stopSpriteTimer();
                currentAnimation = name;
                frameIndex = 0;
                tickAnimation(animations[name]);
            }

            function derivedAnimation() {
                if (vm.loading) { return 'working'; }
                if (vm.error || vm.overdueCount > 0) { return 'failed'; }
                if (vm.drafts.length > 0) { return 'review'; }
                if (vm.pendingTaskCount > 0) { return 'waiting'; }
                return 'idle';
            }

            function updateMessage() {
                vm.notificationCount = vm.pendingTaskCount + vm.drafts.length;
                if (vm.overdueCount > 0) {
                    vm.summaryTitle = 'Có bài cần bạn chú ý';
                    vm.message = 'Bạn có ' + vm.overdueCount + ' bài đã quá hạn. Mình xem ngay nhé!';
                } else if (vm.drafts.length > 0) {
                    vm.summaryTitle = 'Bạn có bài đang làm dở';
                    vm.message = 'Bạn đang làm dở ' + vm.drafts.length + ' bài. Làm tiếp cùng mình nhé!';
                } else if (vm.pendingTaskCount > 0) {
                    vm.summaryTitle = 'Bài cần hoàn thành';
                    vm.message = 'Bạn còn ' + vm.pendingTaskCount + ' bài cần hoàn thành.';
                } else {
                    vm.summaryTitle = 'Tuyệt lắm!';
                    vm.message = 'Hiện tại bạn không còn bài nào cần làm.';
                }
            }

            function parseDraft(item) {
                if (!item || !item.draftKey || !item.payload) { return null; }
                var payload;
                try { payload = angular.fromJson(item.payload); }
                catch (ignorePayload) { return null; }
                if (!payload || payload.completed === true) { return null; }

                var kind = item.draftType;
                var draft = {
                    kind: kind,
                    storageKey: item.draftKey,
                    savedAt: Number(item.savedAt) || 0,
                    title: item.title || payload.title || 'Bài đang làm dở',
                    assignmentTaskId: payload.assignmentTaskId || null,
                    assignmentPart: payload.assignmentPart || null,
                    assignmentTopicId: payload.assignmentTopicId || null,
                    assignmentCategoryId: payload.assignmentCategoryId || null,
                    assignmentSourceQuestionId: payload.assignmentSourceQuestionId || (payload.card || {}).id || null
                };

                if (kind === 'IELTS') {
                    draft.isListening = payload.isListening === true || payload.testMode === 'LISTENING' || /listening/i.test(draft.title);
                    draft.testId = payload.testId;
                    draft.sessionMode = payload.sessionMode || (draft.assignmentTaskId ? 'STUDY' : 'SERIOUS');
                    draft.assignmentPart = draft.assignmentPart || payload.passageNumber || null;
                    draft.typeLabel = draft.isListening ? 'IELTS Listening' : 'IELTS Reading';
                    draft.progressLabel = 'Đã trả lời';
                    draft.progressValue = (Number(payload.answeredCount) || 0) + '/' + (Number(payload.totalQuestions) || 40) + ' câu';
                } else if (kind === 'DAILY_VOCAB') {
                    draft.typeLabel = 'Daily Vocab';
                    draft.progressLabel = 'Đã làm';
                    draft.progressValue = (Number(payload.currentPosition) || 0) + '/' + (Number(payload.totalCard) || (payload.questions || []).length || 0) + ' từ';
                } else if (kind === 'DAILY_LISTENING') {
                    draft.typeLabel = 'Daily Listening';
                    draft.title = item.title || (payload.card || {}).question || 'Daily Listening';
                    draft.progressLabel = 'Tiến độ';
                    draft.progressValue = (Number(payload.percentage) || 0) + '%';
                } else {
                    return null;
                }
                return draft;
            }

            vm.refresh = function () {
                if (!shouldDisplay()) {
                    vm.visible = false;
                    return $q.when();
                }
                vm.visible = true;
                vm.loading = true;
                vm.error = false;
                playAnimation('working');
                var apiRoot = settings.api.baseUrl + settings.api.apiV1Url;
                return $q.all([
                    $http.get(apiRoot + 'enrolment_class/schedule/my-assignments'),
                    $http.get(apiRoot + 'test_result/drafts')
                ]).then(function (responses) {
                    vm.tasks = angular.isArray(responses[0].data) ? responses[0].data : [];
                    vm.pendingTaskCount = vm.tasks.length;
                    vm.overdueCount = vm.tasks.filter(function (task) { return task && task.overdue; }).length;
                    vm.drafts = [];
                    angular.forEach(angular.isArray(responses[1].data) ? responses[1].data : [], function (item) {
                        var draft = parseDraft(item);
                        if (draft) { vm.drafts.push(draft); }
                    });
                    vm.drafts.sort(function (a, b) { return b.savedAt - a.savedAt; });
                    updateMessage();
                }, function () {
                    vm.error = true;
                    vm.message = 'Mình chưa kiểm tra được bài tập. Bạn thử lại nhé!';
                }).finally(function () {
                    vm.loading = false;
                    playAnimation(derivedAnimation());
                });
            };

            vm.taskTypeLabel = function (task) {
                var labels = {DAILY_VOCAB: 'Daily Vocab', DAILY_LISTENING: 'Daily Listening', IELTS_READING: 'IELTS Reading', IELTS_LISTENING: 'IELTS Listening', OTHER: 'Bài được giao'};
                return labels[(task || {}).activityType] || 'Bài được giao';
            };

            vm.taskIcon = function (task) {
                var icons = {DAILY_VOCAB: 'fa-language', DAILY_LISTENING: 'fa-headphones', IELTS_READING: 'fa-file-text-o', IELTS_LISTENING: 'fa-volume-up', OTHER: 'fa-bookmark'};
                return icons[(task || {}).activityType] || 'fa-bookmark';
            };

            vm.draftIcon = function (draft) {
                if (draft.kind === 'DAILY_VOCAB') { return 'fa-language'; }
                if (draft.kind === 'DAILY_LISTENING' || draft.isListening) { return 'fa-headphones'; }
                return 'fa-file-text-o';
            };

            vm.openTask = function (task) {
                if (!task) { return; }
                vm.panelOpen = false;
                var params = {listFlashCard: 0, assignmentTopicId: task.topicId, assignmentCategoryId: task.categoryId, assignmentTaskId: task.taskId, assignmentSourceQuestionId: task.sourceQuestionId};
                if (task.activityType === 'DAILY_VOCAB') {
                    $state.go('application.daily_vocab', params);
                } else if (task.activityType === 'DAILY_LISTENING') {
                    $state.go('application.view', params);
                } else if (task.ieltsTestId && (task.activityType === 'IELTS_READING' || task.activityType === 'IELTS_LISTENING')) {
                    $state.go(task.activityType === 'IELTS_LISTENING' ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test', {ieltsReadingTestId: task.ieltsTestId, assignmentTaskId: task.taskId, assignmentPart: task.ieltsPart, sessionMode: 'STUDY'});
                } else {
                    $state.go('application.englishClass');
                }
            };

            vm.resumeDraft = function (draft) {
                if (!draft) { return; }
                vm.panelOpen = false;
                var user = readCurrentUser();
                if (draft.kind === 'DAILY_VOCAB') {
                    try { $window.sessionStorage.setItem('daily-vocab-dashboard-resume:v1:' + user.id, '1'); } catch (ignoreVocabFlag) {}
                    $state.go('application.daily_vocab', {listFlashCard: 0});
                } else if (draft.kind === 'DAILY_LISTENING') {
                    try { $window.sessionStorage.setItem('daily-listening-dashboard-resume:v1:' + user.id, '1'); } catch (ignoreListeningFlag) {}
                    $state.go('application.view', {listFlashCard: 0, assignmentTaskId: draft.assignmentTaskId, assignmentTopicId: draft.assignmentTopicId, assignmentCategoryId: draft.assignmentCategoryId, assignmentSourceQuestionId: draft.assignmentSourceQuestionId});
                } else if (draft.testId) {
                    $state.go(draft.isListening ? 'application.ielts_listening_actual_test' : 'application.ielts_reading_actual_test', {ieltsReadingTestId: draft.testId, assignmentTaskId: draft.assignmentTaskId, assignmentPart: draft.assignmentPart, sessionMode: draft.sessionMode});
                }
            };

            vm.selectSection = function (section) {
                vm.activeSection = section;
                playAnimation(section === 'drafts' ? 'review' : derivedAnimation(), true);
            };

            vm.openPanel = function (event) {
                if (event) { event.stopPropagation(); }
                vm.panelOpen = true;
                vm.minimized = false;
                vm.activeSection = vm.drafts.length ? 'drafts' : 'tasks';
                playAnimation(vm.activeSection === 'drafts' ? 'review' : derivedAnimation(), true);
            };

            vm.closePanel = function (event) {
                if (event) { event.stopPropagation(); }
                vm.panelOpen = false;
                playAnimation(derivedAnimation(), true);
            };

            vm.togglePanel = function (event) {
                if (vm.minimized) {
                    vm.minimized = false;
                    vm.openPanel(event);
                    return;
                }
                if (vm.panelOpen) { vm.closePanel(event); }
                else { vm.openPanel(event); }
            };

            vm.toggleMinimized = function (event) {
                if (event) { event.stopPropagation(); }
                vm.minimized = !vm.minimized;
                vm.panelOpen = false;
                playAnimation(vm.minimized ? 'idle' : derivedAnimation(), true);
            };

            vm.muteForSession = function () {
                try { $window.sessionStorage.setItem(sessionKey('muted'), '1'); } catch (ignoreMuteStorage) {}
                vm.visible = false;
            };

            function initialize() {
                updatePetForm(readCurrentUser());
                vm.visible = shouldDisplay();
                if (!vm.visible) { return; }
                playAnimation('waving', true);
                vm.refresh();
                greetingTimer = $timeout(function () { playAnimation(derivedAnimation(), true); }, 2200);
                if (!refreshTimer) { refreshTimer = $interval(vm.refresh, 180000); }
            }

            var permissionsListener = $scope.$on('permissionsLoaded', initialize);
            var userListener = $rootScope.$on('$onCurrentUserData', function (event, user) {
                if (!user || !user.id) { return; }
                liveUser = user;
                updatePetForm(user);
                vm.visible = shouldDisplay();
            });
            var routeListener = $scope.$on('$stateChangeSuccess', function () {
                if (vm.visible) { $timeout(vm.refresh, 600); }
            });

            $timeout(initialize, 350);

            $scope.$on('$destroy', function () {
                stopSpriteTimer();
                if (refreshTimer) { $interval.cancel(refreshTimer); }
                if (greetingTimer) { $timeout.cancel(greetingTimer); }
                permissionsListener();
                userListener();
                routeListener();
            });
        }
    }
})();
