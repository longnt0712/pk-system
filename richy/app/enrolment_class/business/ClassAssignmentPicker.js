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
                        vm.folderId = null; vm.search = ''; vm.catalog = []; vm.topics = []; vm.folderLabels = [];
                        vm.selectedTopicId = options.topicId || null;
                        function fileMode(file) {
                            if (['COMPREHENSIVE', 'WRITING', 'DAILY_LISTENING'].indexOf(file.testFormat) >= 0) { return file.testFormat; }
                            return file.pronounce && String(file.pronounce).trim() ? 'LISTENING' : 'READING';
                        }
                        vm.topicsFor = function (file) {
                            var ids = ((file || {}).topics || []).map(function (topic) { return String(topic.id); });
                            return vm.topics.filter(function (topic) { return ids.indexOf(String(topic.id)) >= 0; });
                        };
                        vm.select = function (file) {
                            vm.selected = file;
                            var linked = vm.topicsFor(file);
                            if (!linked.some(function (topic) { return String(topic.id) === String(vm.selectedTopicId); })) {
                                vm.selectedTopicId = linked.length ? linked[0].id : null;
                            }
                        };
                        vm.load = function () {
                            var request = ++requestId;
                            vm.loading = true; vm.error = '';
                            var catalog = vm.dailyListening ? service.getAssignableDailyListeningTests() : service.getAssignableIeltsTests();
                            return $q.all([catalog, vm.dailyListening ? service.getScheduleTopics() : $q.when([]),
                                folders.load(true, false, mode)]).then(function (data) {
                                if (request !== requestId) { return; }
                                vm.catalog = (data[0] || []).filter(function (file) { return vm.dailyListening || fileMode(file) === mode; })
                                    .sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'vi', {numeric: true}); });
                                vm.topics = data[1] || []; vm.folderLabels = folders.options(data[2], true);
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
                            var search = String(vm.search || '').trim().toLocaleLowerCase();
                            return vm.catalog.filter(function (file) {
                                var id = file.testFolder && file.testFolder.id;
                                var inFolder = search ? folders.contains(id, vm.folderId, mode)
                                    : String(id == null ? '' : id) === String(vm.folderId == null ? '' : vm.folderId);
                                return inFolder && (!search || String(file.title || '').toLocaleLowerCase().indexOf(search) >= 0);
                            });
                        };
                        vm.openFolder = function (folderId) { vm.folderId = folderId; vm.search = ''; };
                        vm.folderLabel = function (file) {
                            var match = vm.folderLabels.filter(function (folder) { return file.testFolder && String(folder.id) === String(file.testFolder.id); })[0];
                            return match ? match.label : 'Chưa vào folder';
                        };
                        vm.canSelect = function () {
                            return !vm.loading && !vm.error && !!vm.selected && (!vm.dailyListening || vm.topicsFor(vm.selected).some(function (topic) {
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
