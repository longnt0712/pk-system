(function () {
    'use strict';
    angular.module('Hrm.Question').controller('DailyListeningTestController', [
        '$cookies', '$location', '$window', 'settings', 'QuestionService', 'ComprehensiveListening', 'toastr', '$uibModal', '$q', 'ComprehensiveFolders', '$scope', 'TestWordExport',
        function ($cookies, $location, $window, settings, service, listening, toastr, modal, $q, folders, $scope, wordExport) {
            var vm = this, requestId = 0;
            try { vm.currentUser = JSON.parse($cookies.get('education.user') || '{}'); }
            catch (ignoreCookie) { vm.currentUser = {}; }
            var canCreate = (vm.currentUser.roles || []).some(function (role) { return role && role.name === 'ROLE_ADMIN'; });
            if (!canCreate || !vm.currentUser.id) { $location.path('/comprehensive_tests'); return; }
            settings.isAdmin = true;
            vm.items = [];
            vm.totalItems = 0;
            vm.searchDto = {status: 9, textSearch: '', pageIndex: 1, pageSize: 10};
            vm.catalogStatusUpdating = {};
            vm.isCatalogStatusSaving = function () { return Object.keys(vm.catalogStatusUpdating).some(function (id) { return vm.catalogStatusUpdating[id]; }); };
            vm.catalogTestStatusChanged = function (test, previousStatus) {
                vm.items.some(function (row) { if (String(row.id) !== String(test.id)) { return false; } row.status = test.status; return true; });
                if (vm.draft && String(vm.draft.id) === String(test.id) && Number(vm.draft.status) === Number(previousStatus)) { vm.draft.status = test.status; }
            };
            vm.folderTestMode = 'DAILY_LISTENING';
            vm.catalogTestFolderId = null;
            function text(value) {
                return listening.transcriptText(value);
            }
            function ownerId(item) { return item.userId || (item.user || {}).id; }
            function isListening(item) { return item && Number((item.questionType || {}).id) === 11 && item.testFormat === 'DAILY_LISTENING'; }
            function showEditor() {
                var editor = $window.document.getElementById && $window.document.getElementById('daily-listening-editor');
                if (editor && editor.scrollIntoView) { editor.scrollIntoView({behavior: 'smooth', block: 'start'}); }
            }
            vm.exportTestWord = function (item) {
                if (vm.exportingWord || vm.saving || vm.editing || vm.catalogMovePending || vm.importDialogOpen ||
                    (item && vm.catalogStatusUpdating[item.id])) { return; }
                vm.exportingWord = true;
                vm.exportingWordId = item ? item.id : null;
                var snapshot;
                if (!item) {
                    snapshot = angular.copy(vm.draft);
                    snapshot.title = snapshot.question;
                    snapshot.motherTongue = vm.transcript === vm.originalTranscriptText ? vm.originalTranscript : vm.transcript;
                }
                var request = item ? service.getOne(item.id) : $q.when(snapshot);
                return request.then(function (test) {
                    if (!test || (item && (!test.id || !isListening(test)))) { throw new Error('Không tải được nội dung bài Daily Listening để xuất Word.'); }
                    return wordExport.open(angular.copy(test), {testMode: vm.folderTestMode});
                }).catch(function (error) {
                    if (error === 'cancel' || error === 'backdrop click' || error === 'escape key press') { return; }
                    toastr.error((error && error.message) || 'Không tải được nội dung bài để xuất Word. Bạn có thể thử lại.', 'Xuất Word');
                }).finally(function () {
                    vm.exportingWord = false;
                    vm.exportingWordId = null;
                });
            };
            vm.preview = function (item) { return text(item.motherTongue).trim().slice(0, 160); };
            vm.practiceUrl = function (item) { return 'daily_listening/' + encodeURIComponent(item.id); };
            vm.load = function () {
                var currentRequest = ++requestId;
                vm.loading = true; vm.listError = '';
                return service.getDailyListeningTests(angular.copy(vm.searchDto), vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                    if (currentRequest !== requestId) { return; }
                    vm.items = (data || {}).content || [];
                    vm.totalItems = Number((data || {}).totalElements || 0);
                }, function () {
                    if (currentRequest === requestId) { vm.listError = 'Không tải được danh sách Daily Listening.'; }
                }).finally(function () { if (currentRequest === requestId) { vm.loading = false; } });
            };
            vm.applyCatalogFolderFilter = function (id) {
                if (id !== undefined) { vm.catalogTestFolderId = id; updateCatalogFolderUrl(); }
                folders.applyFilter(vm.searchDto, vm.catalogTestFolderId, true);
                return vm.load();
            };
            var updateCatalogFolderUrl = folders.bindUrl($scope, $location, vm, 'catalogTestFolderId', vm.applyCatalogFolderFilter);
            vm.search = function () { return vm.applyCatalogFolderFilter(); };
            vm.catalogPaginationTotal = function () {
                return Math.max(vm.totalItems, (vm.searchDto.pageIndex - 1) * vm.searchDto.pageSize + 1);
            };
            function matchesFolder(id) {
                return vm.searchDto.withoutTestFolder ? id == null : (vm.searchDto.testFolderId == null ||
                    (vm.searchDto.includeSubfolders ? folders.contains(id, vm.searchDto.testFolderId, vm.folderTestMode) : String(id) === String(vm.searchDto.testFolderId)));
            }
            vm.catalogTestMoved = function (test, deferFill) {
                var id = test.testFolder ? test.testFolder.id : null;
                if (vm.draft && String(vm.draft.id) === String(test.id)) {
                    vm.draft.testFolder = angular.copy(test.testFolder || null); vm.draft.testFolderId = id;
                }
                var rows = vm.items, removed = false;
                rows.some(function (item, index) {
                    if (String(item.id) !== String(test.id)) { return false; }
                    if (matchesFolder(id)) { item.testFolder = angular.copy(test.testFolder || null); item.testFolderId = id; }
                    else { rows.splice(index, 1); vm.totalItems = Math.max(0, vm.totalItems - 1); removed = true; }
                    return true;
                });
                if (!removed) { return; }
                var version = vm.moveVersion = (vm.moveVersion || 0) + 1;
                function fillSlot() {
                    if (vm.loading || rows !== vm.items || version !== vm.moveVersion) { return; }
                    var offset = (vm.searchDto.pageIndex - 1) * vm.searchDto.pageSize;
                    if (rows.length >= Math.min(vm.searchDto.pageSize, vm.totalItems - offset)) { return; }
                    service.getDailyListeningTests(angular.copy(vm.searchDto), offset + rows.length + 1, 1).then(function (data) {
                        if (vm.loading || rows !== vm.items || version !== vm.moveVersion) { return; }
                        var next = ((data || {}).content || [])[0];
                        if (!next || rows.some(function (item) { return String(item.id) === String(next.id); })) { return; }
                        rows.push(next); fillSlot();
                    }, angular.noop);
                }
                if (!deferFill) { fillSlot(); }
            };
            vm.openCatalogMoveDialog = function (test) {
                if (vm.isCatalogStatusSaving() || vm.catalogMoveDialogOpen || vm.catalogMovePending || vm.saving || vm.editing || vm.loading || vm.importDialogOpen) { return; }
                vm.catalogMoveDialogOpen = true;
                var instance = modal.open({templateUrl: 'question/views/comprehensive_move_test_folder_modal.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'),
                    controllerAs: 'move', controller: ['$scope', '$uibModalInstance', function (scope, dialogInstance) {
                        var dialog = this;
                        dialog.testTitle = test.title || test.question;
                        dialog.currentFolderId = (test.testFolder || {}).id || null; dialog.selectedFolderId = dialog.currentFolderId;
                        dialog.choices = []; dialog.collapsed = {};
                        dialog.load = function () {
                            dialog.loading = true; dialog.error = '';
                            return folders.load(false, false, vm.folderTestMode).then(function (items) {
                                dialog.choices = folders.options(items.filter(function (folder) { return folder.canManage; }), false);
                            }, function () { dialog.error = 'Không tải được folder. Bạn có thể thử lại.'; }).finally(function () { dialog.loading = false; });
                        };
                        dialog.label = function (id) {
                            if (id == null) { return 'Folder của tôi (cấp gốc)'; }
                            var match = dialog.choices.filter(function (folder) { return String(folder.id) === String(id); })[0];
                            return match ? match.label : ((test.testFolder || {}).name || '');
                        };
                        dialog.hasChildren = function (folder) { return dialog.choices.some(function (child) { return child.parentId === folder.id; }); };
                        dialog.visible = function (folder) {
                            var id = folder.parentId, seen = {};
                            while (id != null && !seen[id]) {
                                if (dialog.collapsed[id]) { return false; } seen[id] = true;
                                var parent = dialog.choices.filter(function (item) { return item.id === id; })[0]; id = parent ? parent.parentId : null;
                            }
                            return true;
                        };
                        dialog.select = function (id) { if (!dialog.saving) { dialog.selectedFolderId = id; } };
                        dialog.canMove = function () {
                            return !dialog.loading && !dialog.saving && !vm.catalogMovePending && !vm.loading && !vm.saving && !vm.editing &&
                                String(dialog.selectedFolderId) !== String(dialog.currentFolderId) &&
                                (dialog.selectedFolderId == null || dialog.choices.some(function (folder) { return folder.id === dialog.selectedFolderId; }));
                        };
                        dialog.save = function () {
                            if (!dialog.canMove()) { return; } dialog.saving = true; vm.catalogMovePending = true; dialog.error = '';
                            return folders.moveTest(test.id, dialog.selectedFolderId).then(function (saved) {
                                vm.catalogTestMoved(saved); dialog.saving = false; vm.catalogMovePending = false; dialogInstance.close();
                            }, function (response) { dialog.error = (response.data || {}).message || 'Không di chuyển được bài. Bạn có thể thử lại.'; })
                                .finally(function () { dialog.saving = false; vm.catalogMovePending = false; });
                        };
                        dialog.cancel = function () { if (!dialog.saving) { dialogInstance.dismiss('cancel'); } };
                        scope.$on('modal.closing', function (event) { if (dialog.saving) { event.preventDefault(); } });
                        dialog.load();
                    }]});
                instance.result.finally(function () { vm.catalogMoveDialogOpen = false; }).catch(angular.noop);
            };
            vm.newTest = function () {
                if (vm.saving || vm.editing || vm.catalogMovePending || vm.catalogMoveDialogOpen) { return; }
                vm.draft = {questionType: {id: 11}, testFormat: 'DAILY_LISTENING', status: 7,
                    question: '', pronounce: '', motherTongue: '', userId: vm.currentUser.id,
                    questionTopics: [], questionAnswers: [], subQuestions: [], website: 1,
                    testFolderId: Number(vm.catalogTestFolderId) > 0 ? Number(vm.catalogTestFolderId) : null};
                vm.transcript = ''; vm.originalTranscript = ''; vm.originalTranscriptText = '';
                vm.error = ''; vm.savedMessage = '';
                if (vm.initialized) { showEditor(); }
            };
            vm.edit = function (item) {
                if (vm.catalogStatusUpdating[item.id] || vm.saving || vm.editing || vm.catalogMovePending || vm.catalogMoveDialogOpen) { return; }
                vm.editing = true; vm.error = ''; vm.savedMessage = '';
                return service.getOne(item.id).then(function (data) {
                    if (!isListening(data)) {
                        vm.error = 'Không tìm thấy bài trong kho Daily Listening.'; return;
                    }
                    vm.draft = angular.copy(data);
                    vm.draft.question = data.title || data.question;
                    vm.draft.userId = ownerId(data);
                    vm.originalTranscript = data.motherTongue || '';
                    vm.originalTranscriptText = text(vm.originalTranscript);
                    vm.transcript = vm.originalTranscriptText;
                    showEditor();
                }, function () { vm.error = 'Không tải được nội dung bài. Bạn có thể thử lại.'; })
                    .finally(function () { vm.editing = false; });
            };
            vm.save = function () {
                if (vm.catalogStatusUpdating[vm.draft.id] || vm.saving || vm.editing || vm.catalogMovePending || vm.catalogMoveDialogOpen) { return; }
                vm.error = ''; vm.savedMessage = '';
                if (!String(vm.transcript || '').trim()) { vm.error = 'Hãy dán transcript của bài nghe.'; return; }
                if (!listening.parseUrl(vm.draft.pronounce)) { vm.error = 'Hãy nhập link audio hoặc YouTube hợp lệ.'; return; }
                var payload = angular.copy(vm.draft);
                payload.question = String(payload.question || '').trim() || text(vm.transcript).replace(/\s+/g, ' ').trim().slice(0, 100);
                if (payload.question.length > 200) { vm.error = 'Tên bài tối đa 200 ký tự.'; return; }
                payload.pronounce = String(payload.pronounce || '').trim();
                payload.motherTongue = vm.transcript === vm.originalTranscriptText ? vm.originalTranscript : vm.transcript;
                payload.questionType = {id: 11};
                payload.testFormat = 'DAILY_LISTENING';
                payload.status = Number(vm.draft.status) === 6 ? 6 : 7;
                payload.userId = ownerId(vm.draft) || vm.currentUser.id;
                vm.saving = true;
                return service.saveDailyListening(payload).then(function (saved) {
                    if (!saved || !saved.id || !isListening(saved)) { vm.error = (saved || {}).message || 'Chưa lưu được bài. Nội dung đang nhập vẫn được giữ.'; return; }
                    vm.draft = angular.copy(saved);
                    vm.draft.userId = payload.userId;
                    vm.originalTranscript = saved.motherTongue || payload.motherTongue;
                    vm.originalTranscriptText = vm.transcript;
                    var index = -1;
                    vm.items.some(function (item, position) { if (String(item.id) === String(saved.id)) { index = position; return true; } return false; });
                    if (index >= 0) { vm.items[index] = saved; vm.catalogTestMoved(saved); }
                    else if (!payload.id && matchesFolder(saved.testFolderId)) {
                        vm.items.unshift(saved); vm.totalItems++;
                        if (vm.items.length > vm.searchDto.pageSize) { vm.items.pop(); }
                    }
                    vm.savedMessage = 'Đã lưu bài Daily Listening.';
                    toastr.success(vm.savedMessage);
                }, function (response) {
                    vm.error = (response.data || {}).message || 'Không lưu được bài. Nội dung đang nhập vẫn được giữ để bạn thử lại.';
                }).finally(function () { vm.saving = false; });
            };
            vm.importOldListening = function () {
                if (vm.saving || vm.editing || vm.importDialogOpen || vm.catalogMovePending || vm.catalogMoveDialogOpen) { return; }
                vm.importDialogOpen = true;
                var importCount = 0;
                var instance = modal.open({
                    templateUrl: 'question/views/daily_listening_import_modal.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'),
                    controllerAs: 'transfer', size: 'lg',
                    controller: ['$scope', '$uibModalInstance', function (scope, dialog) {
                        var transfer = this;
                        transfer.items = []; transfer.selected = {}; transfer.errors = {}; transfer.moved = 0;
                        transfer.searchDto = {status: 5, textSearch: '', pageIndex: 1, pageSize: 20};
                        transfer.eligible = function (item) { return !!(item && item.id && listening.parseUrl(item.pronounce) && text(item.motherTongue).trim()); };
                        transfer.preview = vm.preview;
                        transfer.load = function () {
                            if (transfer.busy) { return; }
                            transfer.loading = true; transfer.error = '';
                            return service.getLegacyDailyListening(angular.copy(transfer.searchDto), transfer.searchDto.pageIndex, transfer.searchDto.pageSize).then(function (data) {
                                transfer.items = (data || {}).content || []; transfer.totalItems = Number((data || {}).totalElements || 0);
                                transfer.selected = {}; transfer.errors = {};
                            }, function () { transfer.error = 'Không tải được flashcard cũ. Bạn có thể thử lại.'; })
                                .finally(function () { transfer.loading = false; });
                        };
                        transfer.search = function () { transfer.searchDto.pageIndex = 1; return transfer.load(); };
                        transfer.unmarkedChanged = function () { transfer.searchDto.status = transfer.includeUnmarked ? 3 : 5; return transfer.search(); };
                        transfer.selectAll = function () {
                            transfer.items.forEach(function (item) { if (transfer.eligible(item)) { transfer.selected[item.id] = true; } });
                        };
                        transfer.count = function () { return transfer.items.filter(function (item) { return transfer.selected[item.id] && transfer.eligible(item); }).length; };
                        transfer.save = function () {
                            if (transfer.busy || transfer.loading || !transfer.count()) { return; }
                            transfer.busy = true; transfer.error = ''; transfer.message = ''; transfer.errors = {};
                            var selected = transfer.items.filter(function (item) { return transfer.selected[item.id] && transfer.eligible(item); });
                            var succeeded = 0, failed = 0, queue = $q.when();
                            selected.forEach(function (item) {
                                queue = queue.then(function () {
                                    return service.migrateDailyListening(item.id).then(function (saved) {
                                        if (!saved || String(saved.id) !== String(item.id) || !isListening(saved)) {
                                            throw new Error((saved || {}).message || 'Chưa lưu được bài.');
                                        }
                                        transfer.selected[item.id] = false;
                                        transfer.items = transfer.items.filter(function (row) { return String(row.id) !== String(item.id); });
                                        transfer.totalItems = Math.max(0, transfer.totalItems - 1); transfer.moved++; importCount++; succeeded++;
                                    }).catch(function (response) {
                                        response = response || {};
                                        failed++; transfer.errors[item.id] = (response.data || {}).message || response.message || 'Không chuyển được bài, bạn có thể thử lại.';
                                    });
                                });
                            });
                            return queue.finally(function () {
                                transfer.busy = false;
                                transfer.message = 'Đã đưa ' + succeeded + ' bài sang Daily Listening.';
                                if (failed) { transfer.error = 'Còn ' + failed + ' bài chưa chuyển được. Các bài này vẫn được chọn để bạn thử lại.'; }
                                else { dialog.close(transfer.moved); }
                            });
                        };
                        transfer.cancel = function () { if (!transfer.busy) { dialog.close(transfer.moved); } };
                        scope.$on('modal.closing', function (event) { if (transfer.busy) { event.preventDefault(); } });
                        transfer.load();
                    }]
                });
                instance.result.then(function (moved) {
                    vm.importDialogOpen = false;
                    if (moved) { vm.searchDto.textSearch = ''; vm.applyCatalogFolderFilter(null); }
                }, function () { vm.importDialogOpen = false; if (importCount) { vm.searchDto.textSearch = ''; vm.applyCatalogFolderFilter(null); } });
            };
            vm.newTest();
            vm.initialized = true;
            vm.applyCatalogFolderFilter();
        }
    ]);
})();
