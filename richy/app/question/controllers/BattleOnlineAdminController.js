(function () {
    'use strict';

    angular.module('Hrm.Question').controller('BattleOnlineAdminController', BattleOnlineAdminController);

    BattleOnlineAdminController.$inject = ['$scope', '$interval', '$cookies', 'toastr',
        'BattleQuizOnlineService', 'settings', '$document', '$timeout'];

    function BattleOnlineAdminController($scope, $interval, $cookies, toastr, service, settings, $document, $timeout) {
        var vm = this;
        var destroyed = false, requestVersion = 0, refreshTimer = null, returnFocus = null;
        var document = $document[0];
        var modeNames = {
            CLASSIC: 'Classic', COUNTDOWN: 'Countdown', MONEY_BEG: 'Xin tí tiền',
            ESCAPE_DUMB_DEMON: 'Thoát khỏi quỷ ngu', DEMON_DEFENSE: 'Diệt quỷ ngu',
            GUESS_WORD: 'Guess the Word', LUM_NGAY: 'Lụm ngay'
        };

        vm.checkingAccess = !!(settings && settings.permissionsLoaded === false);
        vm.allowed = !vm.checkingAccess && hasAdminAccess();
        vm.forbidden = !vm.checkingAccess && !vm.allowed;
        vm.rooms = [];
        vm.search = '';
        vm.statusFilter = 'PLAYING';
        vm.refreshing = false;
        vm.loaded = false;
        vm.loadError = '';
        vm.lastUpdatedAt = null;
        vm.confirmRoom = null;
        vm.terminating = false;
        vm.terminateError = '';
        vm.refresh = refresh;
        vm.openTerminate = openTerminate;
        vm.cancelTerminate = cancelTerminate;
        vm.confirmTerminate = confirmTerminate;
        vm.modeName = function (mode) { return modeNames[mode] || mode || 'Chưa chọn mode'; };
        vm.statusName = function (room) {
            return room.status === 'LOBBY' ? 'Phòng chờ' : room.giftOpening ? 'Bóc trứng cuối' : 'Đang chơi';
        };
        vm.visibleRooms = function () {
            var query = String(vm.search || '').trim().toLocaleLowerCase();
            return vm.rooms.filter(function (room) {
                if (vm.statusFilter !== 'ALL' && room.status !== vm.statusFilter) { return false; }
                return !query || [room.code, room.hostUsername, room.hostDisplayName, room.topicName,
                    room.mode, vm.modeName(room.mode)].join(' ').toLocaleLowerCase().indexOf(query) >= 0;
            });
        };
        vm.countStatus = function (status) {
            return vm.rooms.filter(function (room) { return room.status === status; }).length;
        };

        function hasAdminAccess() {
            if (settings && settings.permissionsLoaded === false) { return false; }
            if (settings && settings.permissionsLoaded === true) { return settings.isAdmin === true; }
            if (settings && settings.isAdmin === true) { return true; }
            try {
                var account = angular.fromJson($cookies.get('education.user')) || {};
                return (account.roles || []).some(function (role) {
                    return role === 'ROLE_ADMIN' || !!(role && role.name === 'ROLE_ADMIN');
                });
            } catch (ignoreInvalidAccount) { return false; }
        }

        function stopRefresh() {
            if (refreshTimer) { $interval.cancel(refreshTimer); refreshTimer = null; }
        }

        function isAccessError(error) { return error && (error.status === 401 || error.status === 403); }

        function denyAccess() {
            requestVersion++;
            vm.allowed = false;
            vm.checkingAccess = false;
            vm.forbidden = true;
            vm.rooms = [];
            vm.lastUpdatedAt = null;
            vm.loadError = '';
            vm.refreshing = false;
            vm.terminating = false;
            closeConfirmation(false);
            stopRefresh();
        }

        function permissionsLoaded() {
            if (destroyed) { return; }
            vm.checkingAccess = !!(settings && settings.permissionsLoaded === false);
            if (vm.checkingAccess) {
                requestVersion++;
                vm.allowed = false;
                vm.forbidden = false;
                vm.rooms = [];
                vm.lastUpdatedAt = null;
                vm.refreshing = false;
                closeConfirmation(false);
                stopRefresh();
                return;
            }
            if (!hasAdminAccess()) { denyAccess(); return; }
            vm.allowed = true;
            vm.forbidden = false;
            refresh();
            if (!refreshTimer) { refreshTimer = $interval(refresh, 5000); }
        }

        function refresh() {
            if (destroyed || !vm.allowed || vm.refreshing || vm.terminating || vm.confirmRoom) { return; }
            var request = ++requestVersion;
            vm.refreshing = true;
            vm.loadError = '';
            service.getAdminRooms().then(function (rooms) {
                if (destroyed || request !== requestVersion) { return; }
                vm.rooms = (angular.isArray(rooms) ? rooms : []).filter(function (room) {
                    return room && room.code && (room.status === 'LOBBY' || room.status === 'PLAYING');
                });
                vm.lastUpdatedAt = new Date();
                vm.loaded = true;
            }, function (error) {
                if (destroyed || request !== requestVersion) { return; }
                if (isAccessError(error)) { denyAccess(); return; }
                vm.loadError = 'Không tải được danh sách phòng. Bấm Làm mới để thử lại.';
            }).finally(function () {
                if (!destroyed && request === requestVersion) { vm.refreshing = false; }
            });
        }

        function setScrollLock(locked) {
            if (document.body && document.body.classList) {
                document.body.classList[locked ? 'add' : 'remove']('battle-admin-confirm-open');
            }
        }

        function closeConfirmation(restoreFocus) {
            vm.confirmRoom = null;
            vm.terminateError = '';
            setScrollLock(false);
            var previous = returnFocus;
            returnFocus = null;
            if (restoreFocus) {
                $timeout(function () {
                    if (destroyed) { return; }
                    var target = previous && previous.isConnected !== false ? previous : document.getElementById('battle-admin-search');
                    if (target && target.focus) { target.focus(); }
                }, 0);
            }
        }

        function openTerminate(room, event) {
            if (destroyed || !vm.allowed || vm.refreshing || vm.terminating || vm.confirmRoom || !room) { return; }
            var current = vm.rooms.filter(function (item) { return item.code === room.code; })[0];
            if (!current) { return; }
            vm.confirmRoom = angular.copy(current);
            vm.terminateError = '';
            returnFocus = event && event.currentTarget;
            setScrollLock(true);
            $timeout(function () {
                var cancel = document.getElementById('battle-admin-cancel-terminate');
                if (!destroyed && vm.confirmRoom && cancel && cancel.focus) { cancel.focus(); }
            }, 0);
        }

        function cancelTerminate(event) {
            if (event && event.target !== event.currentTarget) { return; }
            if (vm.terminating) { return; }
            closeConfirmation(true);
        }

        function confirmTerminate() {
            if (destroyed || !vm.allowed || !vm.confirmRoom || vm.terminating) { return; }
            var roomCode = vm.confirmRoom.code;
            var request = ++requestVersion;
            vm.terminating = true;
            vm.terminateError = '';
            service.terminateAdminRoom(roomCode).then(function () {
                if (destroyed || request !== requestVersion) { return; }
                vm.rooms = vm.rooms.filter(function (room) { return room.code !== roomCode; });
                vm.lastUpdatedAt = new Date();
                closeConfirmation(true);
                toastr.success('Đã chấm dứt phòng ' + roomCode + '.', 'Battle Online');
            }, function (error) {
                if (destroyed || request !== requestVersion) { return; }
                if (isAccessError(error)) { denyAccess(); return; }
                vm.terminateError = error && error.data && error.data.message
                    ? error.data.message : 'Không chấm dứt được phòng. Bạn có thể thử lại.';
            }).finally(function () {
                if (!destroyed && request === requestVersion) { vm.terminating = false; }
            });
        }

        function keydown(event) {
            if (!vm.confirmRoom) { return; }
            var key = event.which || event.keyCode;
            if (key === 27) {
                event.preventDefault();
                event.stopPropagation();
                $scope.$evalAsync(function () { cancelTerminate(); });
            } else if (key === 9) {
                var modal = document.getElementById('battle-admin-terminate-dialog');
                var controls = modal ? Array.prototype.filter.call(modal.querySelectorAll('button:not([disabled])'), function (button) {
                    return button.offsetParent !== null;
                }) : [];
                if (!controls.length) { event.preventDefault(); return; }
                var first = controls[0], last = controls[controls.length - 1];
                if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                }
            }
        }

        $document.on('keydown', keydown);
        $scope.$on('permissionsLoaded', permissionsLoaded);
        $scope.$on('$destroy', function () {
            destroyed = true;
            requestVersion++;
            stopRefresh();
            closeConfirmation(false);
            $document.off('keydown', keydown);
        });

        if (vm.allowed) {
            refresh();
            refreshTimer = $interval(refresh, 5000);
        }
    }
})();
