(function () {
    'use strict';
    angular.module('Hrm.School', ['ui.router']).config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('application.schools', {
            url: '/schools',
            templateUrl: 'school/listing.html?v=' + window.APP_VERSION,
            controller: 'SchoolController as vm',
            data: {pageTitle: 'Quản lý School'}
        });
    }]).controller('SchoolController', ['$q', 'settings', 'SchoolContext', function ($q, settings, schools) {
        var vm = this;
        vm.settings = settings;
        vm.rows = [];
        vm.roles = [];
        function fail(error) { vm.error = error && error.data && error.data.message || 'Không thể cập nhật School. Vui lòng thử lại.'; }
        function run(work) {
            vm.error = ''; vm.busy = true;
            return work.catch(fail).finally(function () { vm.busy = false; });
        }
        function list() { return schools.list().then(function (rows) { vm.rows = rows; }); }
        vm.edit = function (row) {
            vm.error = '';
            vm.editing = angular.copy(row || {active: true, showAttendance: true});
            vm.roleSchool = null;
        };
        vm.save = function () {
            if (vm.busy) { return; }
            return run(schools.save(vm.editing).then(function () {
                vm.editing = null;
                schools.refresh().catch(angular.noop);
                return list();
            }));
        };
        vm.openRoles = function (row) {
            if (vm.busy) { return; }
            vm.editing = null;
            vm.roleSchool = row;
            vm.rolesLoaded = false;
            vm.rolesSaved = false;
            vm.roleSelection = {};
            return run($q.all([schools.roles(), schools.allowedRoles(row.id)]).then(function (responses) {
                vm.roles = responses[0].data;
                responses[1].data.forEach(function (id) { vm.roleSelection[id] = true; });
                vm.rolesLoaded = true;
            }));
        };
        vm.saveRoles = function () {
            if (vm.busy || !vm.roleSchool || !vm.rolesLoaded) { return; }
            vm.rolesSaved = false;
            var roleIds = vm.roles.filter(function (role) { return vm.roleSelection[role.id]; })
                .map(function (role) { return role.id; });
            return run(schools.setAllowedRoles(vm.roleSchool.id, roleIds).then(function () {
                vm.rolesSaved = true;
                schools.refresh().catch(angular.noop);
            }));
        };
        if (settings.isAdmin) {
            run(list());
        }
    }]);
})();
