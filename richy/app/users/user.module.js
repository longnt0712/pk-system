(function () {
    'use strict';

    Hrm.User = angular.module('Hrm.User', [
        'ui.router',
        'ui.select',
        'oc.lazyLoad',
        'bsTable',
        'toastr',

        'Hrm.Common'
    ]);

    Hrm.User.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

        // User Listing
            .state('application.user_accounts', {
                url: '/user/accounts',
                templateUrl: 'users/views/users.html?v=' + version,
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Hệ thống',
                    pageSubTitle: 'Quản lý người dùng'
                },
                controller: 'UserController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.User',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'users/controllers/UserController.js?v=' + version,
                            ]
                        });
                    }]
                }
            })

            // User Group Listing
            .state('application.user_groups', {
                url: '/user/groups',
                templateUrl: 'users/views/user_groups.html?v=' + version,
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Hệ thống',
                    pageSubTitle: 'Nhóm người dùng'
                },
                controller: 'UserGroupController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.User',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'users/controllers/UserGroupController.js?v=' + version,
                                'users/business/UserGroupService.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            // Role Listing
            .state('application.user_roles', {
                url: '/user/roles',
                templateUrl: 'users/views/roles.html?v=' + version,
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Hệ thống',
                    pageSubTitle: 'Vai trò người dùng'
                },
                controller: 'UserRoleController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.User',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'users/controllers/UserRoleController.js?v=' + version,
                                'users/business/UserRoleService.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            // Permission Granting
            .state('application.user_permissions', {
                url: '/user/permissions',
                templateUrl: 'users/views/permissions.html?v=' + version,
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Hệ thống',
                    pageSubTitle: 'Phân quyền'
                },
                controller: 'PermissionController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.User',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'users/controllers/PermissionController.js?v=' + version,
                                'users/business/PermissionService.js?v=' + version
                            ]
                        });
                    }]
                }
            })
    }]);

})();
