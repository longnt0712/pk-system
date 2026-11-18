(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSTestLibraryController', IELTSTestLibraryController);

    IELTSTestLibraryController.$inject = [
        '$rootScope', '$scope', '$location', '$window', '$cookies',
        'settings', 'QuestionService', 'blockUI', 'ComprehensiveFolders', '$uibModal'
    ];

    function IELTSTestLibraryController($rootScope, $scope, $location, $window, $cookies,
                                        settings, service, blockUI, folders, $uibModal) {
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

        vm.isDailyListeningMode = /\/daily_listening_tests(?:\/|$)/i.test($location.path());
        vm.isComprehensiveMode = /\/comprehensive_tests(?:\/|$)/i.test($location.path());
        vm.isWritingMode = /\/ielts_writing_tests(?:\/|$)/i.test($location.path());
        vm.isListeningMode = !vm.isComprehensiveMode && !vm.isWritingMode && /\/ielts_listening_tests(?:\/|$)/i.test($location.path());
        vm.folderTestMode = vm.isDailyListeningMode ? 'DAILY_LISTENING' : (vm.isComprehensiveMode ? 'COMPREHENSIVE' : (vm.isWritingMode ? 'WRITING' : (vm.isListeningMode ? 'LISTENING' : 'READING')));
        vm.testModeName = vm.isDailyListeningMode ? 'Daily Listening' : (vm.isComprehensiveMode ? 'Tổng hợp' : (vm.isWritingMode ? 'Writing' : (vm.isListeningMode ? 'Listening' : 'Reading')));
        vm.testModeIcon = vm.isDailyListeningMode ? 'fa-headphones' : (vm.isComprehensiveMode ? 'fa-list-alt' : (vm.isWritingMode ? 'fa-pencil' : (vm.isListeningMode ? 'fa-headphones' : 'fa-book')));
        vm.hasReadingVocabulary = vm.folderTestMode === 'READING';
        vm.canLinkReadingVocabulary = (vm.currentUser.roles || []).some(function (role) {
            return (role && (role.name || role)) === 'ROLE_ADMIN';
        });
        vm.ieltsReadingTests = [];
        vm.learningProgressByTestId = {};
        vm.learningProgressByTestTask = {};
        vm.totalItems = 0;
        vm.loading = false;
        vm.searchDto = {
            upper: vm.isDailyListeningMode ? 2147483647 : 100,
            lower: 0,
            type: 100,
            pageSize: 10,
            pageIndex: 1,
            status: 7,
            questionType: {id: 11},
            listeningTest: vm.isComprehensiveMode || vm.isWritingMode || vm.isDailyListeningMode ? null : vm.isListeningMode,
            testFormat: vm.isDailyListeningMode ? 'DAILY_LISTENING' : (vm.isWritingMode ? 'WRITING' : (vm.isComprehensiveMode ? 'COMPREHENSIVE' : null))
        };
        var testRequestId = 0;
        vm.selectedTestFolderId = null;
        vm.applyFolderFilter = function (id) {
            if (id !== undefined) { vm.selectedTestFolderId = id; updateFolderUrl(); }
            folders.applyFilter(vm.searchDto, vm.selectedTestFolderId, true);
            vm.loadTests();
        };
        var updateFolderUrl = folders.bindUrl($scope, $location, vm, 'selectedTestFolderId', vm.applyFolderFilter);

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
            if (!draft || !draft.testId || draft.sessionMode !== 'STUDY' || draft.assignmentSession) { return; }
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
            } else if (vm.isWritingMode) {
                angular.forEach(draft.partNumbers || [], function (part) {
                    var taskProgress = angular.copy(draft);
                    taskProgress.completed = (draft.studiedParts || []).indexOf(Number(part)) >= 0;
                    keepNewestProgress(progressByTestTask, key + ':' + part, taskProgress, savedAtValue);
                });
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
            if (vm.isDailyListeningMode) { return; }
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
            if (vm.isDailyListeningMode) { return 'daily_listening/' + item.id; }
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isWritingMode ? 'ielts_writing_actual_test/' : (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/'));
            var params = [];
            if (writingTask) { params.push('assignmentPart=' + writingTask); }
            params.push('sessionMode=STUDY');
            return route + item.id + (params.length ? '?' + params.join('&') : '');
        };

        vm.seriousTestCatalogUrl = function (item, writingTask) {
            if (vm.isDailyListeningMode) { return vm.testCatalogUrl(item); }
            var route = vm.isComprehensiveMode ? 'comprehensive_test/' :
                (vm.isWritingMode ? 'ielts_writing_actual_test/' : (vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/'));
            return route + item.id + '?sessionMode=SERIOUS&startFresh=1' + (writingTask ? '&assignmentPart=' + writingTask : '');
        };

        vm.openReadingVocabulary = function (test, editing) {
            if (!vm.hasReadingVocabulary || (editing && !vm.canLinkReadingVocabulary)) { return; }
            $uibModal.open({
                templateUrl: 'question/views/reading_vocabulary_lessons.html?v=' + window.APP_VERSION,
                ariaLabelledBy: 'reading-vocab-modal-title',
                size: editing ? 'lg' : 'md',
                controllerAs: 'vocab',
                controller: ['$uibModalInstance', function ($uibModalInstance) {
                    var picker = this;
                    var optionRequest = 0;
                    picker.editing = editing;
                    picker.title = test.title;
                    picker.selected = [];
                    picker.options = [];
                    picker.categories = [];
                    picker.close = function () {
                        if (!picker.saving) { $uibModalInstance.dismiss('close'); }
                    };
                    picker.lessonUrl = function (lesson) {
                        return 'daily-vocab/0?practiceTestId=' + encodeURIComponent(test.id)
                            + '&practiceTopicId=' + encodeURIComponent(lesson.id);
                    };
                    picker.reload = function () {
                        picker.loading = true;
                        picker.loadError = '';
                        service.getReadingVocabularyLessons(test.id).then(function (lessons) {
                            picker.selected = lessons || [];
                        }, function () {
                            picker.loadError = 'Không tải được bài từ vựng của đề này.';
                        }).finally(function () { picker.loading = false; });
                    };

                    picker.categoryChanged = function () {
                        picker.search = '';
                        picker.loadOptions(1);
                    };
                    picker.loadOptions = function (page) {
                        if (!picker.category) { return; }
                        var generation = ++optionRequest;
                        picker.loadingOptions = true;
                        picker.optionsError = '';
                        service.getReadingVocabularyOptions(picker.category.id, picker.search || '', page).then(function (data) {
                            if (generation !== optionRequest) { return; }
                            picker.options = data.content || [];
                            picker.page = page;
                            picker.totalPages = data.totalPages;
                        }, function () {
                            if (generation !== optionRequest) { return; }
                            picker.options = [];
                            picker.optionsError = 'Không tải được danh sách bài trong thư mục này.';
                        }).finally(function () {
                            if (generation === optionRequest) { picker.loadingOptions = false; }
                        });
                    };
                    picker.isSelected = function (topic) {
                        return picker.selected.some(function (item) { return item.id === topic.id; });
                    };
                    picker.toggle = function (topic) {
                        if (picker.isSelected(topic)) {
                            picker.selected = picker.selected.filter(function (item) { return item.id !== topic.id; });
                        } else {
                            picker.selected.push(topic);
                        }
                    };
                    picker.save = function () {
                        if (picker.loading || picker.loadError || picker.saving) { return; }
                        picker.saving = true;
                        picker.saveError = '';
                        service.saveReadingVocabularyLessons(test.id, picker.selected.map(function (topic) {
                            return topic.id;
                        })).then(function () {
                            $uibModalInstance.close();
                        }, function (error) {
                            picker.saveError = error.data && error.data.message || 'Không lưu được bài từ vựng.';
                        }).finally(function () { picker.saving = false; });
                    };

                    function loadCategories(page, categories) {
                        return service.getPageTopicCategory({}, page, 100).then(function (data) {
                            categories = categories.concat(data.content || []);
                            if (page < data.totalPages) { return loadCategories(page + 1, categories); }
                            var byId = {};
                            categories = categories.filter(function (category) { return !category.personal; });
                            categories.forEach(function (category) { byId[category.id] = category; });
                            categories.forEach(function (category) {
                                var names = [category.name];
                                var parent = byId[category.parentId];
                                for (var depth = 0; parent && depth < 50; depth++) {
                                    names.unshift(parent.name);
                                    parent = byId[parent.parentId];
                                }
                                category.path = names.join(' / ');
                            });
                            picker.categories = categories.sort(function (left, right) {
                                return left.path.localeCompare(right.path, 'vi', {numeric: true});
                            });
                        });
                    }

                    picker.reload();
                    if (editing) {
                        picker.loadingCategories = true;
                        loadCategories(1, []).catch(function () {
                            picker.categoryError = 'Không tải được thư mục từ vựng.';
                        }).finally(function () { picker.loadingCategories = false; });
                    }
                }]
            }).result.catch(angular.noop);
        };

        vm.loadTests = function () {
            var requestId = ++testRequestId;
            vm.loading = true;
            vm.loadError = '';
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
                vm.loadError = 'Không tải được danh sách bài test. Hãy thử lại.';
            }).finally(function () {
                if (requestId === testRequestId) {
                    vm.loading = false;
                    blockUI.stop();
                }
            });
        };

        vm.search = function () {
            folders.applyFilter(vm.searchDto, vm.selectedTestFolderId, true);
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
        vm.applyFolderFilter();
    }
})();
