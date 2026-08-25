(function () {
    'use strict';

    Hrm.Dashboard = angular.module('Hrm.Dashboard', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',

        'Hrm.Common'
    ]);

    Hrm.Dashboard.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Dashboard
            .state('application.dashboard', {
                url: '/dashboard',
                templateUrl: 'dashboards/views/general-alt.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: ''},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-category', {
                url: '/dashboard/category',
                templateUrl: 'dashboards/views/comlet-category.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý đào tạo'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-work_managerment', {
                url: '/dashboard/work_managerment',
                templateUrl: 'dashboards/views/comlet-work_managerment.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý công việc'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-project_managerment', {
                url: '/dashboard/project_managerment',
                templateUrl: 'dashboards/views/comlet-project_managerment.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý dự án'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-document_managerment', {
                url: '/dashboard/document_managerment',
                templateUrl: 'dashboards/views/comlet-document.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý tài liệu'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-settings', {
                url: '/dashboard/settings',
                templateUrl: 'dashboards/views/comlet-settings.html?v=' + version,
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Hệ thống'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Education.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboards/controllers/DashboardController.js?v=' + version
                            ]
                        });
                    }]
                }
            })

        .state('application.dashboard-staff', {
            url: '/dashboard/staff',
            templateUrl: 'dashboards/views/comlet-staff.html?v=' + version,
            data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý Nhân sự'},
            controller: 'DashboardController as vm',
            resolve: {
                deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                    return $ocLazyLoad.load({
                        name: 'Education.Dashboard',
                        insertBefore: '#ng_load_plugins_before',
                        files: [
                            // 'assets/css/external/book.css',
                            'dashboards/controllers/DashboardController.js?v=' + version
                        ]
                    });
                }]
            }
        });
        
    }]);

})();
