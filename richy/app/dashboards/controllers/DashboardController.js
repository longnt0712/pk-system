/**
 * Created by bizic on 28/8/2016.
 */
(function () {
    'use strict';

    angular.module('Hrm.Dashboard').controller('DashboardController', DashboardController);

    DashboardController.$inject = [
        '$rootScope',
        '$scope',
        '$http',
        '$timeout',
        'settings',
        'Utilities',
        '$cookies',
        '$location',
        '$window',
        '$state'
    ];

    function DashboardController($rootScope, $scope, $http, $timeout, settings, utils, $cookies, $location, $window, $state) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.currentUser = {};
        vm.myUser = {
            id: null,
            name: '',
            roles: []
        };

        vm.permissionsLoaded = false;

        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;
        vm.isRoleStaff = false;
        vm.isRoleStaffManagement = false;
        vm.isRoleStudentManagerment = false;
        vm.isEducationManagerment = false;

        vm.resetRoles = function () {
            vm.isRoleView = false;
            vm.isRoleUser = false;
            vm.isRoleAdmin = false;
            vm.isRoleStaff = false;
            vm.isRoleStaffManagement = false;
            vm.isRoleStudentManagerment = false;
            settings.isAdmin = false;
            vm.isEducationManagerment = false;
        };

        vm.applyRoles = function (roles) {
            vm.resetRoles();

            angular.forEach(roles || [], function (value) {
                if (value.name === "ROLE_VIEWER") {
                    vm.isRoleView = true;
                }
                if (value.name === "ROLE_USER") {
                    vm.isRoleUser = true;
                    console.log('User');
                }
                if (value.name === "ROLE_ADMIN") {
                    vm.isRoleAdmin = true;
                    settings.isAdmin = true;
                    console.log('Admin');
                }
                if (value.name === "ROLE_STAFF") {
                    vm.isRoleStaff = true;
                    console.log('Staff');
                }
                if (value.name === "ROLE_STAFF_MANAGEMENT") {
                    vm.isRoleStaffManagement = true;
                    console.log('Staff Management');
                }
                if (value.name === "ROLE_STUDENT_MANAGERMENT") {
                    vm.isRoleStudentManagerment = true;
                    console.log('isRoleStudentManagerment');
                }
                if (value.name === "ROLE_EDUCATION_MANAGERMENT") {
                    vm.isEducationManagerment = true;
                    console.log('isEducationManagerment');
                }
            });
        };

        vm.hasRole = function (roleName) {
            if (!vm.myUser || !vm.myUser.roles || !vm.myUser.roles.length) {
                return false;
            }

            for (var i = 0; i < vm.myUser.roles.length; i++) {
                if (vm.myUser.roles[i].name === roleName) {
                    return true;
                }
            }
            return false;
        };

        vm.buildCurrentUser = function (rawUser) {
            vm.currentUser = rawUser || {};
            vm.myUser = {
                id: vm.currentUser.id || null,
                name: vm.currentUser.displayName || '',
                roles: vm.currentUser.roles || []
            };

            vm.applyRoles(vm.myUser.roles);
        };

        vm.loadCurrentUserFromCookie = function () {
            vm.permissionsLoaded = false;

            var userCookie = $cookies.get("education.user");

            if (userCookie) {
                try {
                    vm.buildCurrentUser(JSON.parse(userCookie));
                } catch (e) {
                    console.error("Parse education.user failed:", e);
                    vm.currentUser = {};
                    vm.myUser = {
                        id: null,
                        name: '',
                        roles: []
                    };
                    vm.resetRoles();
                }

                vm.permissionsLoaded = true;
                return;
            }

            $timeout(function () {
                var retryCookie = $cookies.get("education.user");

                if (retryCookie) {
                    try {
                        vm.buildCurrentUser(JSON.parse(retryCookie));
                    } catch (e) {
                        console.error("Retry parse education.user failed:", e);
                        vm.currentUser = {};
                        vm.myUser = {
                            id: null,
                            name: '',
                            roles: []
                        };
                        vm.resetRoles();
                    }
                } else {
                    vm.currentUser = {};
                    vm.myUser = {
                        id: null,
                        name: '',
                        roles: []
                    };
                    vm.resetRoles();
                }

                vm.permissionsLoaded = true;
            }, 300);
        };

        vm.loadCurrentUserFromCookie();

        var checkHttp = $location.protocol();
        if (checkHttp === 'http') {
            // để nguyên nếu bạn cần xử lý sau
            /*console.log(checkHttp);
            $state.go('login');
            var hostname = window.location.hostname;
            $window.location.href = hostname + '/dashboard';*/
        }
    }

})();