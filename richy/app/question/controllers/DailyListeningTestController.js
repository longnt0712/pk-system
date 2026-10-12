(function () {
    'use strict';
    angular.module('Hrm.Question').controller('DailyListeningTestController', [
        '$cookies', '$location', '$window', 'settings', 'QuestionService', 'ComprehensiveListening', 'toastr',
        function ($cookies, $location, $window, settings, service, listening, toastr) {
            var vm = this, requestId = 0;
            try { vm.currentUser = JSON.parse($cookies.get('education.user') || '{}'); }
            catch (ignoreCookie) { vm.currentUser = {}; }
            var canCreate = (vm.currentUser.roles || []).some(function (role) { return role && role.name === 'ROLE_ADMIN'; });
            if (!canCreate || !vm.currentUser.id) { $location.path('/comprehensive_tests'); return; }
            settings.isAdmin = true;
            vm.items = [];
            vm.totalItems = 0;
            vm.searchDto = {questionType: {id: 6}, status: 5, type: 100, userId: vm.currentUser.id,
                textSearch: '', findExactWord: false, pageIndex: 1, pageSize: 12};
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
            vm.newTest = function () {
                if (vm.saving || vm.editing) { return; }
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
                    if (!isListening(data) || String(ownerId(data)) !== String(vm.currentUser.id)) {
                        vm.error = 'Không tìm thấy bài Daily Listening của bạn.'; return;
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
                payload.userId = vm.currentUser.id;
                vm.saving = true;
                return service.saveObject(payload).then(function (saved) {
                    if (!saved || !saved.id) { vm.error = (saved || {}).message || 'Chưa lưu được bài. Nội dung đang nhập vẫn được giữ.'; return; }
                    vm.draft = angular.copy(saved);
                    vm.draft.userId = vm.currentUser.id;
                    vm.originalTranscript = saved.motherTongue || payload.motherTongue;
                    vm.originalTranscriptText = vm.transcript;
                    var index = -1;
                    vm.items.some(function (item, position) { if (String(item.id) === String(saved.id)) { index = position; return true; } return false; });
                    if (index >= 0) { vm.items[index] = saved; }
                    else if (!payload.id) {
                        vm.items.unshift(saved); vm.totalItems++;
                        if (vm.items.length > vm.searchDto.pageSize) { vm.items.pop(); }
                    }
                    vm.savedMessage = 'Đã lưu bài Daily Listening.';
                    toastr.success(vm.savedMessage);
                }, function (response) {
                    vm.error = (response.data || {}).message || 'Không lưu được bài. Nội dung đang nhập vẫn được giữ để bạn thử lại.';
                }).finally(function () { vm.saving = false; });
            };
            vm.newTest();
            vm.load();
        }
    ]);
})();
