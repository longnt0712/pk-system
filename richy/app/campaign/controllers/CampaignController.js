(function () {
    'use strict';
    angular.module('Hrm.Campaign').controller('CampaignController', CampaignController);
    CampaignController.$inject = ['$scope', '$state', '$stateParams', '$window', 'settings', 'CampaignService', 'toastr'];
    function CampaignController($scope, $state, $stateParams, $window, settings, service, toastr) {
        var vm = this;
        var requestNumber = 0;
        vm.settings = settings;
        vm.page = 1;
        vm.query = '';
        vm.campaigns = [];
        vm.weekIndex = 0;
        vm.canManage = function () {
            return settings.permissionsLoaded === true && (settings.isAdmin === true || settings.isEducationManagerment === true);
        };
        vm.hasSession = function () { return !!$scope.$root.currentUser; };
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
                var start = date(vm.campaign.startDate), end = date(vm.campaign.endDate);
                // Calculate by calendar days, independent of daylight-saving changes.
                var firstDay = new Date(start.getTime()), lastDay = new Date(end.getTime());
                firstDay.setUTCHours(0, 0, 0, 0); firstDay.setUTCFullYear(start.getFullYear(), start.getMonth(), start.getDate());
                lastDay.setUTCHours(0, 0, 0, 0); lastDay.setUTCFullYear(end.getFullYear(), end.getMonth(), end.getDate());
                vm.weekCount = Math.ceil((Math.round((lastDay - firstDay) / 86400000) + 1) / 7);
                vm.weekIndex = 0;
                vm.setWeek(0);
            }, function (error) { vm.error = errorMessage(error); }).finally(function () { vm.loading = false; });
        }
        vm.retry = function () { return $stateParams.id ? loadDetail() : vm.load(vm.page); };
        vm.setWeek = function (index) {
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
        };
        vm.create = function () {
            if (!vm.canManage()) { return; }
            vm.editor = {name: '', theme: '', description: '', startDate: null, endDate: null,
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
            if (form.$invalid) { vm.editError = 'Vui lòng nhập đủ tên chiến dịch, ngày hợp lệ và tên các việc hoa thiêng.'; return; }
            if (vm.editor.endDate < vm.editor.startDate) { vm.editError = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'; return; }
            vm.saving = true; vm.editError = '';
            var payload = angular.copy(vm.editor);
            payload.startDate = iso(payload.startDate);
            payload.endDate = iso(payload.endDate);
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
        if ($stateParams.id) { loadDetail(); } else { vm.load(1); }
    }
})();
