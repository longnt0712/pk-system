(function () {
    'use strict';
    angular.module('Hrm.School', ['ui.router']).config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('application.schools', {
            url: '/schools',
            templateUrl: 'school/listing.html?v=' + window.APP_VERSION,
            controller: 'SchoolController as vm',
            data: {pageTitle: 'Quản lý School'}
        });
    }]).controller('SchoolController', ['settings', 'SchoolContext', function (settings, schools) {
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
            vm.members = null;
        };
        vm.save = function () {
            if (vm.busy) { return; }
            return run(schools.save(vm.editing).then(function () {
                vm.editing = null;
                schools.refresh().catch(angular.noop);
                return list();
            }));
        };
        vm.openMembers = function (row) {
            vm.editing = null;
            vm.members = row;
            vm.assignment = {username: '', roles: []};
            vm.assignments = {};
            return run(schools.assignments(row.id).then(function (response) { vm.assignments = response.data; }));
        };
        vm.selectUser = function (username) {
            vm.assignment = {username: username, roles: angular.copy(vm.assignments[username] || [])};
        };
        vm.saveRoles = function () {
            if (vm.busy) { return; }
            return run(schools.setRoles(vm.members.id, vm.assignment).then(function (response) {
                vm.assignments = response.data;
                vm.assignment = {username: '', roles: []};
                schools.refresh().catch(angular.noop);
            }));
        };
        if (settings.isAdmin) {
            run(list().then(function () {
                return schools.roles().then(function (response) { vm.roles = response.data; });
            }));
        }
    }]);
})();
