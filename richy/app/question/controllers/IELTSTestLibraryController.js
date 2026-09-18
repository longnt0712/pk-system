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

        vm.isListeningMode = /\/ielts_listening_tests(?:\/|$)/i.test($location.path());
        vm.testModeName = vm.isListeningMode ? 'Listening' : 'Reading';
        vm.testModeIcon = vm.isListeningMode ? 'fa-headphones' : 'fa-book';
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
            listeningTest: vm.isListeningMode
        };

        function draftSavedAt(draft, serverSavedAt) {
            return new Date((draft || {}).savedAt || (draft || {}).updatedAt || serverSavedAt || 0).getTime() || 0;
        }

        function collectIeltsDraft(progressByTestId, draft, serverSavedAt) {
            if (!draft || !draft.testId || draft.sessionMode !== 'STUDY') { return; }
            if (vm.currentUser.id && draft.userId && String(draft.userId) !== String(vm.currentUser.id)) { return; }

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
            var route = vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/';
            return route + item.id + (vm.getLearningProgress(item.id) ? '?sessionMode=STUDY' : '');
        };

        vm.seriousTestCatalogUrl = function (item) {
            var route = vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/';
            return route + item.id + '?sessionMode=SERIOUS&startFresh=1';
        };

        vm.loadTests = function () {
            vm.loading = true;
            blockUI.start();
            service.getPageForTests(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                vm.ieltsReadingTests = data.content || [];
                vm.totalItems = Number(data.totalElements) || 0;
            }, function () {
                vm.ieltsReadingTests = [];
                vm.totalItems = 0;
            }).finally(function () {
                vm.loading = false;
                blockUI.stop();
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
        vm.loadTests();
    }
})();
