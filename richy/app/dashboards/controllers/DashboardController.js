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
        '$state',
        
    ];
    
    function DashboardController ($rootScope, $scope, $http, $timeout, settings, utils,$cookies,$location,$window,$state) {
        $scope.$on('$viewContentLoaded', function() {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.currentUser = {};
        if($cookies.getAll()["education.user"] != null && !angular.isUndefined($cookies.getAll()["education.user"])){
            vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        }

        if(vm.currentUser.roles != null){
            angular.forEach(vm.currentUser.roles, function(value, key) {
                if(value.name == "ROLE_ADMIN"){
                    settings.isAdmin = true;
                    console.log("ADMIN");
                }
                // if(value.name == "ROLE_STAFF" || value.name == "ROLE_STAFF_MANAGEMENT"){
                //     $window.location.href = 'https://ieltsroom.com/product';
                // }
            });
        }

        // vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        vm.myUser = {};
        vm.myUser.id = vm.currentUser.id;
        // vm.myUser.username = vm.currentUser.username;
        vm.myUser.name = vm.currentUser.displayName;
        vm.myUser.roles = vm.currentUser.roles;
        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;
        vm.isRoleStaff = false;
        vm.isRoleStaffManagement = false;
        angular.forEach(vm.myUser.roles, function(value, key) {
            if(value.name === "ROLE_VIEWER"){
                vm.isRoleView = true;
            }
            if(value.name === "ROLE_USER"){
                vm.isRoleUser = true;
                console.log('User');
            }
            if(value.name === "ROLE_ADMIN"){
                vm.isRoleAdmin = true;
                console.log('Admin');
            }
            if(value.name === "ROLE_STAFF"){
                vm.isRoleStaff = true;
                console.log('Staff');
            }
            if(value.name === "ROLE_STAFF_MANAGEMENT"){
                vm.isRoleStaffManagement = true;
                console.log('Staff');
            }
            if(value.name === "ROLE_STUDENT_MANAGERMENT"){
                vm.isRoleStudentManagerment = true;
                console.log('isRoleStudentManagerment');
            }
        });
        
        // vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);

        var checkHttp =  $location.protocol();
        if(checkHttp == 'http'){
            // console.log(checkHttp);
            // $state.go('login');
            // var hostname = window.location.hostname;
            // $window.location.href = hostname + '/dashboard';
        }
    }

})();
