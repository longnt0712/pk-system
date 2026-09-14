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
        vm.assignedTasks = [];
        vm.assignedTasksLoading = false;
        vm.assignedTasksError = false;

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

        vm.getUserVocabularyProgressPercent = function (user) {
            var level = Math.max(0, Number((user || {}).vocabularyExperienceLevel) || 0);
            var learnedWords = Math.max(0, Number((user || {}).vocabularyExperienceWords) || 0);
            var threshold = 1000 * (level + 1);

            return threshold > 0
                ? Math.min(100, learnedWords * 100 / threshold)
                : 0;
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

        vm.loadAssignedTasks = function () {
            if (!settings.ieltsRoom || !vm.myUser.id || !(vm.isRoleView || vm.isRoleUser || vm.hasRole('ROLE_STUDENT'))) {
                vm.assignedTasks = [];
                return;
            }
            vm.assignedTasksLoading = true;
            vm.assignedTasksError = false;
            var url = settings.api.baseUrl + settings.api.apiV1Url + 'enrolment_class/schedule/my-assignments';
            $http.get(url).then(function (response) {
                vm.assignedTasks = angular.isArray(response.data) ? response.data : [];
            }, function () {
                vm.assignedTasks = [];
                vm.assignedTasksError = true;
            }).finally(function () {
                vm.assignedTasksLoading = false;
            });
        };

        vm.assignmentTypeLabel = function (task) {
            var labels = {
                DAILY_VOCAB: 'Daily Vocab',
                DAILY_LISTENING: 'Daily Listening',
                IELTS_READING: 'IELTS Reading',
                IELTS_LISTENING: 'IELTS Listening',
                OTHER: 'Bài được giao'
            };
            return labels[(task || {}).activityType] || 'Bài được giao';
        };

        vm.assignmentIcon = function (task) {
            var icons = {
                DAILY_VOCAB: 'fa-language',
                DAILY_LISTENING: 'fa-headphones',
                IELTS_READING: 'fa-file-text-o',
                IELTS_LISTENING: 'fa-volume-up',
                OTHER: 'fa-bookmark'
            };
            return icons[(task || {}).activityType] || 'fa-bookmark';
        };

        vm.assignmentActionLabel = function (task) {
            if (task && task.activityType === 'DAILY_VOCAB') { return 'Làm Daily Vocab'; }
            if (task && task.activityType === 'DAILY_LISTENING') { return 'Làm Daily Listening'; }
            return 'Xem bài được giao';
        };

        vm.openAssignedTask = function (task) {
            if (!task) { return; }
            var params = {
                listFlashCard: 0,
                assignmentTopicId: task.topicId,
                assignmentCategoryId: task.categoryId,
                assignmentTaskId: task.taskId
            };
            if (task.activityType === 'DAILY_VOCAB') {
                $state.go('application.daily_vocab', params);
            } else if (task.activityType === 'DAILY_LISTENING') {
                $state.go('application.view', params);
            } else {
                $state.go('application.englishClass');
            }
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
                vm.loadAssignedTasks();
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
                vm.loadAssignedTasks();
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
