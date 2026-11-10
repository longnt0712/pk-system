(function () {
    'use strict';
    angular.module('Hrm.EnrolmentClass').factory('ClassAssignmentPicker', [
        '$uibModal', 'EnrolmentClassService', 'ComprehensiveFolders',
        function (modal, service, folders) {
            var modes = {IELTS_READING: 'READING', IELTS_LISTENING: 'LISTENING', IELTS_WRITING: 'WRITING',
                COMPREHENSIVE: 'COMPREHENSIVE', DAILY_LISTENING: 'DAILY_LISTENING'};
            var names = {READING: 'IELTS Reading', LISTENING: 'IELTS Listening', WRITING: 'IELTS Writing',
                COMPREHENSIVE: 'Test tổng hợp', DAILY_LISTENING: 'Daily Listening'};
            function getSelected(activityType, id) {
                return service.getAssignableExercisePage(modes[activityType], null, '', 1, id)
                    .then(function (page) { return (page.content || [])[0] || null; });
            }
            function open(options) {
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
                        function loadPage(append, selectedId) {
                            var request = ++requestId, page = append ? vm.page + 1 : 1;
                            vm.loading = true; vm.error = '';
                            if (!append) { vm.catalog = []; vm.hasMore = false; }
                            return service.getAssignableExercisePage(mode, vm.folderId, vm.search, page, selectedId).then(function (data) {
                                if (request !== requestId) { return; }
                                var items = data.content || [];
                                initialSelection = false;
                                if (selectedId) {
                                    if (items.length) {
                                        vm.select(items[0]);
                                        vm.folderId = items[0].testFolder ? items[0].testFolder.id : null;
                                    }
                                    return loadPage(false);
                                }
                                vm.catalog = append ? vm.catalog.concat(items) : items;
                                vm.page = page; vm.hasMore = data.last === false;
                            }, function () {
                                if (request === requestId) { vm.error = 'Không tải được danh sách bài. Vui lòng thử lại.'; }
                            }).finally(function () { if (request === requestId) { vm.loading = false; } });
                        }
                        vm.loadMore = function () {
                            if (vm.hasMore && !vm.loading && !vm.error) { return loadPage(true); }
                        };
                        vm.load = function () {
                            folders.load(true, initialSelection, mode).then(setFolderLabels, angular.noop);
                            return loadPage(false, initialSelection ? options.selectedId : null);
                        };
                        vm.visibleFiles = function () { return vm.catalog; };
                        vm.searchChanged = function () {
                            initialSelection = false;
                            return loadPage(false);
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
            }
            return {open: open, getSelected: getSelected};
        }
    ]);
})();
