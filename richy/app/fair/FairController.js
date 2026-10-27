(function () {
    'use strict';
    angular.module('Hrm.Fair').controller('FairController', FairController);
    FairController.$inject = ['$scope', '$state', '$stateParams', '$window', '$timeout', 'settings', 'FairService'];
    function FairController($scope, $state, $stateParams, $window, $timeout, settings, api) {
        if (settings.fairsEnabled !== true) {
            $state.go('login', {showHome: true}, {location: 'replace'});
            return;
        }
        var vm = this, core = $window.FairCore, resetTimer, pendingKey, disposed = false;
        var viewport = $window.document && $window.document.querySelector('meta[name="viewport"]');
        var previousViewport = viewport && viewport.getAttribute('content');
        if (viewport) { viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover'); }
        vm.mode = $stateParams.fairMode || 'lookup'; vm.loading = true; vm.error = ''; vm.message = '';
        vm.events = []; vm.tiers = []; vm.code = ''; vm.operation = ''; vm.selectedTier = ''; vm.guestCount = 100;
        vm.eventForm = {name: 'Hội chợ tổng kết ' + new Date().getFullYear(), active: true, easyAmount: 8, mediumAmount: 12, hardAmount: 20};
        vm.stationForm = {operation: 'PLAY', tier: 'HARD'}; vm.guests = []; vm.stations = []; vm.transactions = [];
        function errorMessage(error) {
            if (error && error.data && error.data.message) { return error.data.message; }
            if (error && error.status === 401) { vm.needLogin = true; return 'Hãy đăng nhập bằng tài khoản người trực.'; }
            if (error && error.status === 403) { return 'Tài khoản không có quyền sử dụng chức năng này.'; }
            return error && error.message || 'Chưa kết nối được hệ thống. Hãy kiểm tra mạng rồi thử lại.';
        }
        function failure(error) { if (!disposed) { vm.error = errorMessage(error); } }
        function storageGet(key) { try { return JSON.parse($window.localStorage.getItem(key) || 'null'); } catch (error) { return null; } }
        function rememberPending(request) {
            // Persist before sending. If storage is unavailable, no transaction is sent.
            $window.localStorage.setItem(pendingKey, JSON.stringify(request)); vm.pending = request;
        }
        function clearPending() {
            var stored = storageGet(pendingKey);
            // A late response from a different tab must not erase a newer turn's recovery record.
            if (stored && vm.pending && stored.request && stored.request.requestKey === vm.pending.request.requestKey) {
                $window.localStorage.removeItem(pendingKey);
            }
            vm.pending = null;
        }
        vm.login = function () {
            try { $window.sessionStorage.setItem('fair.returnPath', $window.location.pathname); } catch (error) {}
            $state.go('login');
        };
        vm.lookupLink = function () { return vm.event ? '/hoi-cho/' + vm.event.id + '/tra-cuu' : '/hoi-cho'; };
        vm.canScan = function () { return !!vm.event && !vm.busy && !vm.loading && !vm.participant && !vm.receipt && !vm.pending && !vm.error; };
        vm.tier = function () { return vm.tiers.filter(function (tier) { return tier.key === vm.selectedTier; })[0]; };
        vm.canOperate = function () {
            return vm.operator && (vm.operator.admin || vm.operator.station) && vm.event && vm.event.active
                && ((vm.operation === 'PLAY' && vm.operator.canPlay) || (vm.operation === 'GIFT' && vm.operator.canGift));
        };
        vm.chooseOperation = function (operation) { if (!vm.participant && !vm.pending && !vm.receipt) { vm.operation = operation; vm.selectedTier = ''; } };
        vm.chooseTier = function (tier) { if (!vm.busy && !vm.pending && !vm.receipt) { vm.selectedTier = tier.key; } };
        vm.scan = function (raw) {
            if (!vm.canScan()) { return; }
            var code;
            try { code = core.cardCode(raw); } catch (error) { failure(error); return; }
            vm.busy = true; vm.error = ''; vm.message = '';
            return api.balance(vm.event.id, code).then(function (response) {
                if (disposed) { return; }
                vm.participant = response.data; vm.code = '';
                if (vm.mode === 'lookup') { resetTimer = $timeout(vm.next, 8000); }
            }).catch(failure).finally(function () { vm.busy = false; });
        };
        vm.next = function () {
            if (vm.busy || vm.pending) { return; }
            $timeout.cancel(resetTimer); vm.participant = null; vm.receipt = null; vm.error = ''; vm.message = ''; vm.code = '';
            if (!vm.operator || !vm.operator.station || vm.operator.station.tier === 'CHOOSE' || vm.operator.admin) { vm.selectedTier = ''; }
        };
        function sendPending() {
            if (vm.busy || !vm.pending) { return; }
            vm.busy = true; vm.error = '';
            var payload = vm.pending, call = payload.correctionId
                ? api.correct(vm.event.id, payload.correctionId, payload.request)
                : api.transact(vm.event.id, payload.request);
            return call.then(function (response) {
                clearPending(); vm.receipt = response.data; vm.participant = response.data.participant;
                vm.message = response.data.replayed ? 'Lượt này đã được ghi nhận trước đó, số phiếu không bị tính thêm. Hãy kiểm tra lượt trao quà trước khi trao thêm.' : 'Đã ghi nhận thành công.';
                if (vm.mode === 'admin') { vm.refreshHistory(); }
            }).catch(function (error) {
                if (error && (error.status === 401 || error.status === 403)) {
                    vm.error = errorMessage(error) + ' Lượt này chưa được xác nhận; hãy đăng nhập đúng tài khoản rồi kiểm tra kết quả.';
                } else if (core.uncertain(error)) {
                    vm.error = 'Chưa xác nhận được kết quả. Bấm “Kiểm tra kết quả” để kiểm tra đúng lượt này; không quét lại thành lượt mới.';
                } else {
                    clearPending(); failure(error);
                    // A price or station assignment may have changed since the page opened.
                    if (error.status === 400) {
                        api.event(vm.event.id).then(function (result) {
                            vm.event = result.data; vm.tiers = core.tiers(vm.event);
                            return api.operator(vm.event.id);
                        }).then(function (result) {
                            vm.operator = result.data;
                            if (!vm.operator.admin && vm.operator.station) {
                                vm.operation = vm.operator.station.operation;
                                vm.selectedTier = vm.operator.station.tier === 'CHOOSE' ? '' : vm.operator.station.tier;
                            }
                        }).catch(function () {});
                    }
                }
            }).finally(function () { vm.busy = false; });
        }
        vm.retry = sendPending;
        vm.submit = function () {
            var tier = vm.tier();
            if (vm.busy || vm.pending || vm.receipt || !vm.participant || !tier || !vm.canOperate()) { return; }
            if (vm.operation === 'GIFT' && vm.participant.balance < tier.amount) { vm.error = 'Không đủ phiếu để đổi quà này.'; return; }
            try {
                rememberPending({request: {cardCode: vm.participant.cardCode, operation: vm.operation,
                    tier: tier.key, amount: tier.amount, requestKey: core.key($window.crypto)}});
            } catch (error) { vm.error = 'Chưa lưu được lượt giao dịch trên điện thoại. Hãy cho phép lưu trữ rồi thử lại.'; return; }
            return sendPending();
        };
        vm.refreshHistory = function (more) {
            if (!vm.event) { return; }
            var before = more && vm.transactions.length ? vm.transactions[vm.transactions.length - 1].id : 0;
            return api.history(vm.event.id, vm.historyCode, before).then(function (response) {
                vm.transactions = more ? vm.transactions.concat(response.data) : response.data; vm.moreHistory = response.data.length === 50;
            }).catch(failure);
        };
        vm.beginCorrection = function (tx) {
            vm.correction = {id: tx.id, amount: tx.amount, reason: '', original: tx}; vm.error = '';
            $timeout(function () { var panel = $window.document && $window.document.getElementById('fair-correction'); if (panel) { panel.scrollIntoView({behavior: 'smooth', block: 'start'}); } }, 0);
        };
        vm.correct = function () {
            if (vm.busy || vm.pending || !vm.correction || !vm.correction.reason.trim()) { return; }
            try {
                rememberPending({correctionId: vm.correction.id, request: {amount: vm.correction.amount,
                    reason: vm.correction.reason.trim(), requestKey: core.key($window.crypto)}});
            } catch (error) { failure(error); return; }
            vm.correction = null; return sendPending();
        };
        vm.saveEvent = function () {
            if (vm.busy) { return; } vm.busy = true; vm.error = ''; vm.message = '';
            return api.saveEvent(vm.eventForm).then(function (response) {
                var changedEvent = !vm.event || vm.event.id !== response.data.id;
                vm.event = response.data; vm.eventForm = angular.copy(response.data); vm.tiers = core.tiers(vm.event);
                vm.message = 'Đã lưu cấu hình hội chợ. Giao dịch cũ và số dư được giữ nguyên.';
                return api.events(true).then(function (result) { vm.events = result.data; vm.selectedEvent = vm.event.id; if (changedEvent) { return load(vm.event); } });
            }).catch(failure).finally(function () { vm.busy = false; });
        };
        vm.saveStation = function () {
            if (vm.busy) { return; } vm.busy = true; vm.error = '';
            return api.saveStation(vm.event.id, vm.stationForm).then(function () {
                vm.message = 'Đã gán gian hàng.'; return api.stations(vm.event.id).then(function (response) { vm.stations = response.data; });
            }).catch(failure).finally(function () { vm.busy = false; });
        };
        vm.editStation = function (station) { vm.stationForm = angular.copy(station); };
        vm.generateGuests = function () {
            if (vm.busy) { return; } vm.busy = true; vm.error = '';
            return api.generateGuests(vm.event.id, vm.guestCount).then(function () {
                vm.message = 'Đã tạo thêm thẻ khách, mỗi thẻ có số dư ban đầu bằng 0.';
                return api.guests(vm.event.id).then(function (response) { vm.guests = response.data; });
            }).catch(failure).finally(function () { vm.busy = false; });
        };
        vm.printGuests = function () { $window.print(); };
        vm.newEvent = function () {
            if (vm.busy || vm.pending) { return; }
            vm.eventForm = {name: 'Hội chợ tổng kết ' + new Date().getFullYear(), active: true, easyAmount: 8, mediumAmount: 12, hardAmount: 20};
        };
        vm.selectEvent = function () {
            if (vm.pending || vm.busy) { return; }
            $state.go('fair_' + vm.mode + '_event', {id: vm.selectedEvent, ma: null});
        };
        function load(event) {
            vm.event = event; vm.selectedEvent = event.id; vm.tiers = core.tiers(event); vm.eventForm = angular.copy(event);
            if (vm.mode === 'lookup') { return; }
            return api.operator(event.id).then(function (response) {
                vm.operator = response.data;
                if (vm.mode === 'admin' && !vm.operator.admin) { throw Error('Chỉ quản trị viên được mở trang quản lý hội chợ.'); }
                vm.operation = vm.operator.station && !vm.operator.admin ? vm.operator.station.operation : (vm.operator.canPlay ? 'PLAY' : 'GIFT');
                vm.selectedTier = vm.operator.station && !vm.operator.admin && vm.operator.station.tier !== 'CHOOSE' ? vm.operator.station.tier : '';
                pendingKey = 'fair.pending.' + event.id + '.' + vm.operator.username;
                vm.pending = storageGet(pendingKey);
                if (vm.pending) { vm.error = 'Có một lượt chưa xác nhận kết quả. Hãy bấm “Kiểm tra kết quả” trước khi tiếp tục.'; }
                if (vm.mode === 'admin') {
                    return Promise.all([
                        api.guests(event.id).then(function (result) { vm.guests = result.data; }),
                        api.stations(event.id).then(function (result) { vm.stations = result.data; }), vm.refreshHistory()
                    ]);
                }
            });
        }
        api.events(vm.mode === 'admin').then(function (response) {
            vm.events = response.data;
            var selected = $stateParams.id ? api.event($stateParams.id).then(function (result) { return result.data; }) : Promise.resolve(vm.events[0]);
            return selected.then(function (event) { if (event) { return load(event); } });
        }).catch(failure).finally(function () {
            vm.loading = false;
            if (vm.mode === 'lookup' && $stateParams.ma && vm.event && !vm.error) { vm.scan($stateParams.ma); }
        });
        $scope.$on('$destroy', function () {
            disposed = true; $timeout.cancel(resetTimer);
            if (viewport) { if (previousViewport === null) { viewport.removeAttribute('content'); } else { viewport.setAttribute('content', previousViewport); } }
        });
        $scope.$on('$stateChangeStart', function (event) { if (vm.pending && vm.busy) { event.preventDefault(); } });
    }
})();
