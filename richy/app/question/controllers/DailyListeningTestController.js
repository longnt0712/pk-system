(function () {
    'use strict';
    angular.module('Hrm.Question').controller('DailyListeningTestController', [
        '$cookies', '$location', '$window', 'settings', 'QuestionService', 'ComprehensiveListening', 'toastr', '$uibModal', '$q',
        function ($cookies, $location, $window, settings, service, listening, toastr, modal, $q) {
            var vm = this, requestId = 0;
            try { vm.currentUser = JSON.parse($cookies.get('education.user') || '{}'); }
            catch (ignoreCookie) { vm.currentUser = {}; }
            var canCreate = (vm.currentUser.roles || []).some(function (role) { return role && role.name === 'ROLE_ADMIN'; });
            if (!canCreate || !vm.currentUser.id) { $location.path('/comprehensive_tests'); return; }
            settings.isAdmin = true;
            vm.items = [];
            vm.totalItems = 0;
            vm.sources = [{id: vm.currentUser.id, name: 'Bài của tôi'}];
            [{id: 26, name: 'EM YÊU INH LÍCH'}, {id: 33, name: 'CHURCH'}].forEach(function (source) {
                if (String(source.id) !== String(vm.currentUser.id)) { vm.sources.push(source); }
            });
            vm.sourceId = vm.currentUser.id;
            vm.searchDto = {questionType: {id: 6}, status: 5, type: 100, userId: vm.currentUser.id,
                lower: 0, upper: 2147483647, textSearch: '', findExactWord: false, pageIndex: 1, pageSize: 12};
            function text(value) {
                var element = $window.document.createElement('div');
                element.innerHTML = String(value || '').replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, '\n');
                return (element.textContent || '').trim();
            }
            function ownerId(item) { return item.userId || (item.user || {}).id; }
            function isListening(item) { return item && Number((item.questionType || {}).id) === 6 && Number(item.status) === 5; }
            vm.preview = function (item) { return text(item.motherTongue).slice(0, 160); };
            vm.practiceUrl = function (item) { return 'daily_listening/' + encodeURIComponent(item.id); };
            vm.load = function () {
                var currentRequest = ++requestId;
                vm.loading = true; vm.listError = '';
                return service.getPage(angular.copy(vm.searchDto), vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                    if (currentRequest !== requestId) { return; }
                    vm.items = (data || {}).content || [];
                    vm.totalItems = Number((data || {}).totalElements || 0);
                }, function () {
                    if (currentRequest === requestId) { vm.listError = 'Không tải được danh sách Daily Listening.'; }
                }).finally(function () { if (currentRequest === requestId) { vm.loading = false; } });
            };
            vm.search = function () { vm.searchDto.pageIndex = 1; return vm.load(); };
            vm.sourceChanged = function () {
                vm.searchDto.userId = vm.sourceId;
                vm.searchDto.pageIndex = 1;
                return vm.load();
            };
            vm.newTest = function () {
                if (vm.saving || vm.editing) { return; }
                if (String(vm.sourceId) !== String(vm.currentUser.id)) {
                    vm.sourceId = vm.currentUser.id; vm.sourceChanged();
                }
                vm.draft = {questionType: {id: 6, code: 'FC', name: 'Flash card'}, status: 5,
                    question: '', pronounce: '', motherTongue: '', userId: vm.currentUser.id,
                    questionTopics: [], questionAnswers: [], subQuestions: [], website: 1};
                vm.transcript = ''; vm.originalTranscript = ''; vm.originalTranscriptText = '';
                vm.error = ''; vm.savedMessage = '';
            };
            vm.edit = function (item) {
                if (vm.saving || vm.editing) { return; }
                vm.editing = true; vm.error = ''; vm.savedMessage = '';
                return service.getOne(item.id).then(function (data) {
                    if (!isListening(data) || String(ownerId(data)) !== String(vm.sourceId)) {
                        vm.error = 'Không tìm thấy bài Daily Listening trong nguồn đã chọn.'; return;
                    }
                    vm.draft = angular.copy(data);
                    vm.draft.userId = ownerId(data);
                    vm.originalTranscript = data.motherTongue || '';
                    vm.originalTranscriptText = text(vm.originalTranscript);
                    vm.transcript = vm.originalTranscriptText;
                }, function () { vm.error = 'Không tải được nội dung bài. Bạn có thể thử lại.'; })
                    .finally(function () { vm.editing = false; });
            };
            vm.save = function () {
                if (vm.saving || vm.editing) { return; }
                vm.error = ''; vm.savedMessage = '';
                if (!String(vm.transcript || '').trim()) { vm.error = 'Hãy dán transcript của bài nghe.'; return; }
                if (!listening.parseUrl(vm.draft.pronounce)) { vm.error = 'Hãy nhập link audio hoặc YouTube hợp lệ.'; return; }
                var payload = angular.copy(vm.draft);
                payload.question = String(payload.question || '').trim() || text(vm.transcript).replace(/\s+/g, ' ').slice(0, 100);
                if (payload.question.length > 200) { vm.error = 'Tên bài tối đa 200 ký tự.'; return; }
                payload.pronounce = String(payload.pronounce || '').trim();
                payload.motherTongue = vm.transcript === vm.originalTranscriptText ? vm.originalTranscript : vm.transcript;
                payload.questionType = {id: 6, code: 'FC', name: 'Flash card'};
                payload.status = 5;
                payload.userId = ownerId(vm.draft) || vm.currentUser.id;
                vm.saving = true;
                return service.saveObject(payload).then(function (saved) {
                    if (!saved || !saved.id) { vm.error = (saved || {}).message || 'Chưa lưu được bài. Nội dung đang nhập vẫn được giữ.'; return; }
                    vm.draft = angular.copy(saved);
                    vm.draft.userId = payload.userId;
                    vm.originalTranscript = saved.motherTongue || payload.motherTongue;
                    vm.originalTranscriptText = vm.transcript;
                    if (String(vm.sourceId) !== String(payload.userId)) {
                        vm.sourceId = payload.userId; vm.searchDto.textSearch = ''; vm.sourceChanged();
                    } else {
                        var index = -1;
                        vm.items.some(function (item, position) { if (String(item.id) === String(saved.id)) { index = position; return true; } return false; });
                        if (index >= 0) { vm.items[index] = saved; }
                        else if (!payload.id) {
                            vm.items.unshift(saved); vm.totalItems++;
                            if (vm.items.length > vm.searchDto.pageSize) { vm.items.pop(); }
                        }
                    }
                    vm.savedMessage = 'Đã lưu bài Daily Listening.';
                    toastr.success(vm.savedMessage);
                }, function (response) {
                    vm.error = (response.data || {}).message || 'Không lưu được bài. Nội dung đang nhập vẫn được giữ để bạn thử lại.';
                }).finally(function () { vm.saving = false; });
            };
            vm.importOldListening = function () {
                if (vm.saving || vm.editing || vm.importDialogOpen) { return; }
                vm.importDialogOpen = true;
                var sourceId = vm.sourceId, importCount = 0;
                var instance = modal.open({
                    templateUrl: 'question/views/daily_listening_import_modal.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'),
                    controllerAs: 'transfer', size: 'lg',
                    controller: ['$scope', '$uibModalInstance', function (scope, dialog) {
                        var transfer = this;
                        transfer.items = []; transfer.selected = {}; transfer.errors = {}; transfer.moved = 0;
                        transfer.searchDto = {questionType: {id: 6}, status: 3, type: 100, userId: sourceId,
                            lower: 0, upper: 2147483647, textSearch: '', findExactWord: false, pageIndex: 1, pageSize: 20};
                        transfer.eligible = function (item) { return !!(item && item.id && listening.parseUrl(item.pronounce) && text(item.motherTongue)); };
                        transfer.preview = vm.preview;
                        transfer.load = function () {
                            if (transfer.busy) { return; }
                            transfer.loading = true; transfer.error = '';
                            return service.getPage(angular.copy(transfer.searchDto), transfer.searchDto.pageIndex, transfer.searchDto.pageSize).then(function (data) {
                                transfer.items = (data || {}).content || []; transfer.totalItems = Number((data || {}).totalElements || 0);
                                transfer.selected = {}; transfer.errors = {};
                            }, function () { transfer.error = 'Không tải được flashcard cũ. Bạn có thể thử lại.'; })
                                .finally(function () { transfer.loading = false; });
                        };
                        transfer.search = function () { transfer.searchDto.pageIndex = 1; return transfer.load(); };
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
                                    return service.getOne(item.id).then(function (data) {
                                        if (!data || String(data.id) !== String(item.id) || Number((data.questionType || {}).id) !== 6 ||
                                                String(ownerId(data)) !== String(sourceId) || !transfer.eligible(data)) {
                                            throw new Error('Bài đã thay đổi hoặc chưa đủ audio và transcript.');
                                        }
                                        if (Number(data.status) === 5) { return data; }
                                        var payload = angular.copy(data);
                                        payload.status = 5; payload.userId = ownerId(data);
                                        return service.saveObject(payload);
                                    }).then(function (saved) {
                                        if (!saved || String(saved.id) !== String(item.id) || Number(saved.status) !== 5) {
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
                    if (moved) { vm.searchDto.textSearch = ''; vm.searchDto.pageIndex = 1; vm.load(); }
                }, function () { vm.importDialogOpen = false; if (importCount) { vm.load(); } });
            };
            vm.newTest();
            vm.load();
        }
    ]);
})();
