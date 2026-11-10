(function () {
    'use strict';
    angular.module('Hrm.EnrolmentClass').factory('ClassAssignmentPicker', [
        '$uibModal', 'EnrolmentClassService', 'ComprehensiveFolders', '$q',
        function (modal, service, folders, $q) {
            var modes = {IELTS_READING: 'READING', IELTS_LISTENING: 'LISTENING', IELTS_WRITING: 'WRITING',
                COMPREHENSIVE: 'COMPREHENSIVE', DAILY_LISTENING: 'DAILY_LISTENING'};
            var names = {READING: 'IELTS Reading', LISTENING: 'IELTS Listening', WRITING: 'IELTS Writing',
                COMPREHENSIVE: 'Test tổng hợp', DAILY_LISTENING: 'Daily Listening'};
            return {open: function (options) {
                var mode = modes[options.activityType];
                return modal.open({
                    templateUrl: 'enrolment_class/views/assignment_picker_modal.html?v=' + encodeURIComponent(window.APP_VERSION || 'dev'),
                    windowClass: 'class-assignment-picker-window', size: 'lg', backdrop: 'static',
                    ariaLabelledBy: 'class-assignment-picker-title',
                    controllerAs: 'picker',
                    controller: ['$uibModalInstance', function (instance) {
                        var vm = this, requestId = 0, initialSelection = true;
                        vm.mode = mode; vm.name = names[mode]; vm.dailyListening = mode === 'DAILY_LISTENING';
                        vm.folderId = null; vm.search = ''; vm.catalog = []; vm.folderLabels = {};
                        vm.selectedTopicId = options.topicId || null;
                        function fileMode(file) {
                            if (['COMPREHENSIVE', 'WRITING', 'DAILY_LISTENING'].indexOf(file.testFormat) >= 0) { return file.testFormat; }
                            return file.pronounce && String(file.pronounce).trim() ? 'LISTENING' : 'READING';
                        }
                        vm.topicsFor = function (file) {
                            return vm.dailyListening && file ? (file.topics || []) : [];
                        };
                        vm.select = function (file) {
                            vm.selected = file;
                            var linked = vm.topicsFor(file);
                            if (!linked.some(function (topic) { return String(topic.id) === String(vm.selectedTopicId); })) {
                                vm.selectedTopicId = linked.length ? linked[0].id : null;
                            }
                        };
                        function setFolderLabels(items) {
                            vm.folderLabels = {};
                            folders.options(items, true).forEach(function (folder) { vm.folderLabels[folder.id] = folder.label; });
                        }
                        function loadDailyPage(append, selectedId) {
                            var request = ++requestId, page = append ? vm.page + 1 : 1;
                            vm.loading = true; vm.error = '';
                            if (!append) { vm.catalog = []; vm.hasMore = false; }
                            return service.getAssignableDailyListeningPage(vm.folderId, vm.search, page, selectedId).then(function (data) {
                                if (request !== requestId) { return; }
                                var items = data.content || [];
                                initialSelection = false;
                                if (selectedId) {
                                    if (items.length) {
                                        vm.select(items[0]);
                                        vm.folderId = items[0].testFolder ? items[0].testFolder.id : null;
                                    }
                                    return loadDailyPage(false);
                                }
                                vm.catalog = append ? vm.catalog.concat(items) : items;
                                vm.page = page; vm.hasMore = data.last === false;
                            }, function () {
                                if (request === requestId) { vm.error = 'Không tải được bài nghe. Vui lòng thử lại.'; }
                            }).finally(function () { if (request === requestId) { vm.loading = false; } });
                        }
                        vm.loadMore = function () {
                            if (vm.dailyListening && vm.hasMore && !vm.loading && !vm.error) { return loadDailyPage(true); }
                        };
                        vm.load = function () {
                            if (vm.dailyListening) {
                                folders.load(true, initialSelection, mode).then(setFolderLabels, angular.noop);
                                return loadDailyPage(false, initialSelection ? options.selectedId : null);
                            }
                            var request = ++requestId;
                            vm.loading = true; vm.error = '';
                            return $q.all([service.getAssignableIeltsTests(), folders.load(true, true, mode)]).then(function (data) {
                                if (request !== requestId) { return; }
                                vm.catalog = (data[0] || []).filter(function (file) { return fileMode(file) === mode; })
                                    .sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'vi', {numeric: true}); });
                                setFolderLabels(data[1]);
                                if (initialSelection) {
                                    initialSelection = false;
                                    var selected = vm.catalog.filter(function (file) { return String(file.id) === String(options.selectedId); })[0];
                                    if (selected) { vm.select(selected); vm.folderId = selected.testFolder ? selected.testFolder.id : null; }
                                } else if (vm.selected) {
                                    var refreshed = vm.catalog.filter(function (file) { return String(file.id) === String(vm.selected.id); })[0];
                                    if (refreshed) { vm.select(refreshed); } else { vm.selected = null; }
                                }
                            }, function () {
                                if (request === requestId) { vm.error = 'Không tải được thư viện bài tập. Vui lòng thử lại.'; }
                            }).finally(function () { if (request === requestId) { vm.loading = false; } });
                        };
                        vm.visibleFiles = function () {
                            if (vm.dailyListening) { return vm.catalog; }
                            var search = String(vm.search || '').trim().toLocaleLowerCase();
                            return vm.catalog.filter(function (file) {
                                var id = file.testFolder && file.testFolder.id;
                                var inFolder = search ? folders.contains(id, vm.folderId, mode)
                                    : String(id == null ? '' : id) === String(vm.folderId == null ? '' : vm.folderId);
                                return inFolder && (!search || String(file.title || '').toLocaleLowerCase().indexOf(search) >= 0);
                            });
                        };
                        vm.searchChanged = function () {
                            if (vm.dailyListening) { initialSelection = false; return loadDailyPage(false); }
                        };
                        vm.openFolder = function (folderId) { vm.folderId = folderId; vm.search = ''; return vm.searchChanged(); };
                        vm.folderLabel = function (file) {
                            return (file.testFolder && vm.folderLabels[file.testFolder.id]) || 'Chưa vào folder';
                        };
                        vm.canSelect = function () {
                            return !vm.loading && !vm.error && !!vm.selected && (!vm.dailyListening
                                || (vm.selected.testFormat === 'DAILY_LISTENING' && !vm.topicsFor(vm.selected).length)
                                || vm.topicsFor(vm.selected).some(function (topic) {
                                return String(topic.id) === String(vm.selectedTopicId);
                            }));
                        };
                        vm.confirm = function () {
                            if (!vm.canSelect()) { return; }
                            requestId++;
                            var topic = vm.topicsFor(vm.selected).filter(function (item) { return String(item.id) === String(vm.selectedTopicId); })[0];
                            instance.close({test: vm.selected, topic: topic || null});
                        };
                        vm.cancel = function () { requestId++; instance.dismiss('cancel'); };
                        vm.load();
                    }]
                }).result;
            }};
        }
    ]);
})();
