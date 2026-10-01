(function () {
    'use strict';
    angular.module('Hrm.Campaign').controller('CampaignController', CampaignController);
    CampaignController.$inject = ['$scope', '$state', '$stateParams', '$window', 'settings', 'CampaignService', 'toastr', '$location'];
    function CampaignController($scope, $state, $stateParams, $window, settings, service, toastr, $location) {
        var vm = this;
        var requestNumber = 0;
        var studentRequest = 0;
        var serverClockOffset = 0, dayTimer;
        vm.studentMode = $stateParams.studentMode === true;
        var studentToken = vm.studentMode ? String($window.location.hash || '').slice(1) : '';
        vm.needsScan = vm.studentMode && !/^[A-Za-z0-9_-]{43}$/.test(studentToken);
        vm.checks = {}; vm.savedChecks = {}; vm.pendingChecks = {};
        vm.settings = settings;
        vm.page = 1;
        vm.query = '';
        vm.campaigns = [];
        vm.weekIndex = 0;
        vm.canManage = function () {
            return !vm.studentMode && settings.permissionsLoaded === true && (settings.isAdmin === true || settings.isEducationManagerment === true);
        };
        var imageFields = ['desktopLeftImageUrl', 'desktopRightImageUrl', 'mobileImageUrl'];
        function validImageUrl(value) {
            try {
                var url = new $window.URL(value);
                return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname && !url.username && !url.password;
            } catch (error) { return false; }
        }
        vm.imageUrl = function (value) {
            var url = typeof value === 'string' ? value.trim() : '';
            return url && validImageUrl(url) ? url : '';
        };
        vm.formatDate = function (value) {
            var parts = String(value || '').split('-');
            return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '';
        };
        function iso(date) {
            return ('0000' + date.getFullYear()).slice(-4) + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
        }
        function date(value) {
            var parts = String(value || '').split('-');
            var result = new Date(0);
            result.setFullYear(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            result.setHours(12, 0, 0, 0);
            return result;
        }
        vm.status = function (campaign) {
            var today = iso(new Date());
            if (today < campaign.startDate) { return 'Sắp diễn ra'; }
            return today > campaign.endDate ? 'Đã kết thúc' : 'Đang diễn ra';
        };
        function errorMessage(error) {
            if (error.status === 403) { return 'Chỉ Admin hoặc Education Management có quyền tạo, sửa, xóa chiến dịch.'; }
            if (error.status === 404) { return 'Chiến dịch không còn tồn tại.'; }
            if (error.status === 409) { return 'Chiến dịch đã được thay đổi. Hãy tải lại trang trước khi sửa.'; }
            if (error.status === 401) { return 'Vui lòng đăng nhập bằng tài khoản Admin hoặc Education Management.'; }
            return error.data && error.data.message || 'Không thể kết nối. Vui lòng thử lại.';
        }
        vm.load = function (page) {
            vm.page = page || 1;
            vm.loading = true; vm.error = '';
            var request = ++requestNumber;
            return service.list(vm.query, vm.page).then(function (response) {
                if (request !== requestNumber) { return; }
                vm.campaigns = response.data.content;
                vm.totalPages = response.data.totalPages;
                vm.total = response.data.totalElements;
            }, function (error) {
                if (request === requestNumber) { vm.error = errorMessage(error); }
            }).finally(function () { if (request === requestNumber) { vm.loading = false; } });
        };
        function loadDetail() {
            vm.loading = true; vm.error = '';
            return service.get($stateParams.id).then(function (response) {
                vm.campaign = response.data;
                prepareCampaign(0);
            }, function (error) { vm.error = errorMessage(error); }).finally(function () { vm.loading = false; });
        }
        function prepareCampaign(week) {
                var start = date(vm.campaign.startDate), end = date(vm.campaign.endDate);
                // Calculate by calendar days, independent of daylight-saving changes.
                var firstDay = new Date(start.getTime()), lastDay = new Date(end.getTime());
                firstDay.setUTCHours(0, 0, 0, 0); firstDay.setUTCFullYear(start.getFullYear(), start.getMonth(), start.getDate());
                lastDay.setUTCHours(0, 0, 0, 0); lastDay.setUTCFullYear(end.getFullYear(), end.getMonth(), end.getDate());
                vm.weekCount = Math.ceil((Math.round((lastDay - firstDay) / 86400000) + 1) / 7);
                renderWeek(week);
        }
        function renderWeek(index) {
            if (!vm.campaign || index < 0 || index >= vm.weekCount) { return; }
            vm.weekIndex = index;
            var day = date(vm.campaign.startDate);
            day.setDate(day.getDate() + index * 7);
            vm.weekDays = [];
            var names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            for (var i = 0; i < 7 && iso(day) <= vm.campaign.endDate; i++) {
                vm.weekDays.push({date: iso(day), label: names[day.getDay()]});
                day.setDate(day.getDate() + 1);
            }
        }
        function loadStudentSheet(id, week) {
            var request = ++studentRequest;
            vm.sheetLoading = true; vm.error = ''; vm.checkError = ''; vm.saveNotice = '';
            return service.studentSheet(studentToken, id, week).then(function (response) {
                if (request !== studentRequest) { return; }
                vm.student = response.data.student; vm.campaign = response.data.campaign;
                if (response.data.serverTime) { serverClockOffset = response.data.serverTime - Date.now(); }
                scheduleNewDay();
                vm.checks = {}; vm.savedChecks = {};
                (response.data.entries || []).forEach(function (entry) { vm.checks[entry.itemKey + ':' + entry.date] = vm.savedChecks[entry.itemKey + ':' + entry.date] = entry.completed === true; });
                prepareCampaign(week);
            }, function (error) { if (request === studentRequest) { vm.error = errorMessage(error); } })
                .finally(function () { if (request === studentRequest) { vm.sheetLoading = false; } });
        }
        vm.useScannedQr = function (decoded) {
            if (!vm.studentMode || vm.scanBusy) { return; }
            var value = String(decoded || '').trim(), token = '';
            if (/^https?:\/\//i.test(value)) {
                try {
                    var url = new $window.URL(value), currentHost = $window.location.hostname;
                    if ((url.hostname !== currentHost && !/^(www\.)?tnttphungkhoang\.com$/i.test(url.hostname)) || !/^\/hoa-thieng\/?$/.test(url.pathname) || !/^[A-Za-z0-9_-]{43}$/.test(url.hash.slice(1))) { throw new Error('Invalid'); }
                    token = url.hash.slice(1);
                } catch (error) { vm.scanError = 'Đây không phải mã QR học sinh. Em hãy quét mã trên thẻ của mình.'; return; }
            } else if (!value || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) {
                vm.scanError = 'Mã QR học sinh không hợp lệ. Em hãy quét lại thẻ.'; return;
            }
            vm.scanBusy = true; vm.scanError = ''; vm.error = '';
            var request = token ? service.studentLanding(token) : service.scanStudentQr(value);
            return request.then(function (response) {
                var resolved = token || response.data.token;
                if (!/^[A-Za-z0-9_-]{43}$/.test(resolved || '')) { throw new Error('Invalid token'); }
                studentToken = resolved;
                $location.hash(resolved).replace();
                vm.needsScan = false;
                return loadStudentLanding();
            }).catch(function () { vm.needsScan = true; vm.scanError = 'Không mở được phiếu. Em hãy kiểm tra đúng thẻ học sinh và thử quét lại.'; })
                .finally(function () { vm.scanBusy = false; });
        };
        vm.scanAnotherStudent = function () {
            ++studentRequest; vm.student = null; vm.campaign = null; vm.campaigns = []; studentToken = '';
            vm.needsScan = true; vm.error = ''; vm.scanError = ''; vm.checkError = ''; vm.saveNotice = '';
            vm.checks = {}; vm.savedChecks = {}; vm.pendingChecks = {};
            if (dayTimer) { $window.clearTimeout(dayTimer); dayTimer = null; }
            $location.hash('').replace();
        };
        function loadStudentLanding() {
            if (!studentToken) { vm.needsScan = true; return; }
            if (!/^[A-Za-z0-9_-]{43}$/.test(studentToken)) {
                vm.error = 'Mã QR học sinh không hợp lệ. Vui lòng quét lại mã QR được cấp.'; return;
            }
            vm.loading = true; vm.error = '';
            return service.studentLanding(studentToken).then(function (response) {
                vm.needsScan = false; vm.student = response.data.student; vm.campaigns = response.data.campaigns;
                if (response.data.serverTime) { serverClockOffset = response.data.serverTime - Date.now(); }
                vm.total = vm.campaigns.length;
                if (vm.campaigns.length === 1) { return vm.selectCampaign(vm.campaigns[0].id); }
                if (!vm.campaigns.length) { return vm.load(1); }
            }, function (error) { vm.needsScan = true; vm.error = error.status === 404 ? 'Mã QR không hợp lệ hoặc tài khoản học sinh đã ngừng hoạt động.' : errorMessage(error); })
                .finally(function () { vm.loading = false; });
        }
        vm.selectCampaign = function (id) {
            if (!vm.studentMode) { return; }
            var campaign = vm.campaigns.filter(function (value) { return value.id === id; })[0];
            var week = 0;
            if (campaign) {
                var day = studentToday() < campaign.endDate ? studentToday() : campaign.endDate;
                week = Math.max(0, Math.floor((Date.parse(day + 'T00:00:00Z') - Date.parse(campaign.startDate + 'T00:00:00Z')) / (7 * 86400000)));
            }
            return loadStudentSheet(id, week);
        };
        vm.chooseCampaign = function () { ++studentRequest; vm.campaign = null; vm.sheetLoading = false; vm.error = ''; vm.checkError = ''; vm.saveNotice = ''; return vm.load(1); };
        vm.retry = function () {
            if (vm.studentMode) { return vm.campaign ? loadStudentSheet(vm.campaign.id, vm.weekIndex) : loadStudentLanding(); }
            return $stateParams.id ? loadDetail() : vm.load(vm.page);
        };
        vm.setWeek = function (index) {
            if (!vm.campaign || index < 0 || index >= vm.weekCount) { return; }
            return vm.studentMode ? loadStudentSheet(vm.campaign.id, index) : renderWeek(index);
        };
        function studentToday() { return new Date(Date.now() + serverClockOffset + 7 * 3600000).toISOString().slice(0, 10); }
        function scheduleNewDay() {
            if (!$window.setTimeout) { return; }
            if (dayTimer) { $window.clearTimeout(dayTimer); }
            var now = Date.now() + serverClockOffset + 7 * 3600000;
            dayTimer = $window.setTimeout(function () { $scope.$evalAsync(); scheduleNewDay(); }, 86400000 - (now % 86400000) + 50);
        }
        vm.isDayLocked = function (day) { return day.date !== studentToday(); };
        vm.toggleFlower = function (item, day) {
            var key = item.itemKey + ':' + day.date, campaignId = vm.campaign.id;
            if (!vm.studentMode || vm.sheetLoading || vm.isDayLocked(day)) { vm.checks[key] = vm.savedChecks[key] === true; return; }
            var pendingKey = campaignId + ':' + key, checks = vm.checks;
            if (vm.pendingChecks[pendingKey]) { return; }
            var completed = checks[key] === true;
            vm.pendingChecks[pendingKey] = true; vm.checkError = ''; vm.saveNotice = 'Đang lưu…';
            return service.checkFlower(studentToken, campaignId, day.date, item.itemKey, completed).then(function (response) {
                checks[key] = response.data.completed === true;
                if (vm.checks === checks) { vm.savedChecks[key] = checks[key]; }
                if (vm.checks === checks) { vm.saveNotice = 'Đã lưu hoa thiêng.'; }
            }, function (error) {
                checks[key] = !completed;
                if (vm.checks === checks) { vm.checkError = errorMessage(error); vm.saveNotice = ''; }
            }).finally(function () { delete vm.pendingChecks[pendingKey]; });
        };
        vm.create = function () {
            if (!vm.canManage()) { return; }
            vm.editor = {name: '', theme: '', description: '', startDate: null, endDate: null,
                desktopLeftImageUrl: '', desktopRightImageUrl: '', mobileImageUrl: '',
                flowerInstructions: 'Mỗi ngày, các em thực hành và ghi lại những việc đã làm vào phiếu hoa thiêng. Nộp phiếu theo hướng dẫn của xứ đoàn.',
                flowerItems: ['Cầu nguyện', 'Tham dự Thánh lễ', 'Rước lễ', 'Đọc Lời Chúa', 'Hy sinh', 'Làm việc bác ái'].map(function (name) {
                    return {name: name, instructions: ''};
                })};
            vm.editError = ''; vm.deleteTarget = null;
        };
        vm.edit = function (campaign) {
            if (!vm.canManage() || vm.editLoading) { return; }
            vm.editLoading = true;
            return service.get(campaign.id).then(function (response) {
                if (!vm.canManage()) { return; }
                vm.editor = angular.copy(response.data);
                vm.editor.startDate = date(vm.editor.startDate);
                vm.editor.endDate = date(vm.editor.endDate);
                vm.editError = ''; vm.deleteTarget = null;
            }, function (error) { toastr.error(errorMessage(error)); }).finally(function () { vm.editLoading = false; });
        };
        vm.cancelEdit = function () { if (!vm.saving) { vm.editor = null; vm.editError = ''; } };
        vm.addItem = function () {
            if (vm.canManage() && vm.editor && vm.editor.flowerItems.length < 30) {
                vm.editor.flowerItems.push({name: '', instructions: ''});
            }
        };
        vm.removeItem = function (index) {
            if (vm.canManage() && vm.editor && vm.editor.flowerItems.length > 1) { vm.editor.flowerItems.splice(index, 1); }
        };
        vm.save = function (form) {
            if (!vm.canManage() || vm.saving || !vm.editor) { return; }
            for (var i = 0; i < imageFields.length; i++) {
                var image = vm.editor[imageFields[i]];
                if (image && image.trim() && (image.trim().length > 2048 || !validImageUrl(image.trim()))) {
                    vm.editError = 'Link ảnh cần là địa chỉ http:// hoặc https:// hợp lệ, tối đa 2048 ký tự.'; return;
                }
            }
            if (form.$invalid) { vm.editError = 'Vui lòng kiểm tra tên chiến dịch, ngày, các việc hoa thiêng và link ảnh.'; return; }
            if (vm.editor.endDate < vm.editor.startDate) { vm.editError = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'; return; }
            vm.saving = true; vm.editError = '';
            var payload = angular.copy(vm.editor);
            payload.startDate = iso(payload.startDate);
            payload.endDate = iso(payload.endDate);
            imageFields.forEach(function (field) { payload[field] = vm.imageUrl(payload[field]) || null; });
            return service.save(payload).then(function (response) {
                vm.editor = null;
                toastr.success('Đã lưu chiến dịch và hoa thiêng.');
                if ($stateParams.id) { return loadDetail(); }
                return $state.go('campaign_detail', {id: response.data.id});
            }, function (error) { vm.editError = errorMessage(error); }).finally(function () { vm.saving = false; });
        };
        vm.askDelete = function (campaign) {
            if (vm.canManage() && !vm.deleting) { vm.deleteTarget = campaign; vm.deleteError = ''; }
        };
        vm.deleteCampaign = function () {
            if (!vm.canManage() || vm.deleting || !vm.deleteTarget) { return; }
            vm.deleting = true;
            return service.remove(vm.deleteTarget.id).then(function () {
                vm.deleteTarget = null;
                toastr.success('Đã xóa chiến dịch.');
                if ($stateParams.id) { return $state.go('campaigns'); }
                return vm.load(vm.campaigns.length === 1 && vm.page > 1 ? vm.page - 1 : vm.page);
            }, function (error) { vm.deleteError = errorMessage(error); }).finally(function () { vm.deleting = false; });
        };
        vm.print = function () { $window.print(); };
        $scope.$watch(vm.canManage, function (allowed) {
            if (!allowed) { vm.editor = null; vm.deleteTarget = null; }
        });
        if (vm.studentMode) { loadStudentLanding(); }
        else if ($stateParams.id) { loadDetail(); } else { vm.load(1); }
        if ($scope.$on) { $scope.$on('$destroy', function () { ++studentRequest; if (dayTimer) { $window.clearTimeout(dayTimer); } }); }
    }
    angular.module('Hrm.Campaign').directive('campaignViewport', ['$window', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var document = $window.document, target = element[0];
                var meta = document.querySelector('meta[name="viewport"]');
                var previousViewport = meta && meta.getAttribute('content');
                var layout = target.querySelector('.campaign-layout');
                var campaignViewport = 'width=device-width, initial-scale=1, minimum-scale=0.5, user-scalable=yes';
                if (meta) { meta.setAttribute('content', campaignViewport); }
                scope.vm.viewZoom = 1;
                function applyZoom() {
                    scope.vm.viewStyle = scope.vm.viewZoom === 1 ? {} : {zoom: scope.vm.viewZoom, width: layout.clientWidth + 'px', maxWidth: 'none'};
                    scope.$evalAsync();
                }
                scope.vm.changeZoom = function (delta) {
                    scope.vm.viewZoom = Math.max(0.5, Math.min(3, scope.vm.viewZoom + delta));
                    applyZoom();
                };
                $window.addEventListener('resize', applyZoom);
                scope.vm.fullscreenSupported = !!((document.fullscreenEnabled && target.requestFullscreen) ||
                    (document.webkitFullscreenEnabled && target.webkitRequestFullscreen));
                function fullscreenChanged() {
                    scope.vm.fullscreen = (document.fullscreenElement || document.webkitFullscreenElement) === target;
                    applyZoom();
                }
                function failure() {
                    scope.vm.viewError = 'Trình duyệt chưa mở được chế độ toàn màn hình. Bạn vẫn có thể phóng to hoặc thu nhỏ trang bằng hai ngón tay.';
                    scope.$evalAsync();
                }
                scope.vm.toggleFullscreen = function () {
                    scope.vm.viewError = '';
                    try {
                        var result;
                        if ((document.fullscreenElement || document.webkitFullscreenElement) === target) {
                            result = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
                        } else {
                            result = target.requestFullscreen ? target.requestFullscreen({navigationUI: 'hide'}) : target.webkitRequestFullscreen();
                        }
                        if (result && result.catch) { result.catch(failure); }
                    } catch (error) { failure(); }
                };
                document.addEventListener('fullscreenchange', fullscreenChanged);
                document.addEventListener('webkitfullscreenchange', fullscreenChanged);
                fullscreenChanged();
                scope.$on('$destroy', function () {
                    document.removeEventListener('fullscreenchange', fullscreenChanged);
                    document.removeEventListener('webkitfullscreenchange', fullscreenChanged);
                    $window.removeEventListener('resize', applyZoom);
                    if (meta && meta.getAttribute('content') === campaignViewport) {
                        if (previousViewport === null) { meta.removeAttribute('content'); }
                        else { meta.setAttribute('content', previousViewport); }
                    }
                });
            }
        };
    }]);
})();
