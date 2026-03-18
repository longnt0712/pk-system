(function () {
    'use strict';

    Core.Dashboard = angular.module('Core.Dashboard', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',

        // Start: For tree table...
        'treeGrid',
        // End: For tree table

        'Core.Common'
    ]);

    Core.Dashboard.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Dashboard
            .state('application.dashboard', {
                url: '/dashboard',
                templateUrl: 'dashboard/views/general-alt.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: ''},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-edu', {
                url: '/dashboard/edu',
                templateUrl: 'dashboard/views/comlet-edu.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý đào tạo'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-students', {
                url: '/dashboard/students',
                templateUrl: 'dashboard/views/comlet-students.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý sinh viên'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-exam', {
                url: '/dashboard/exam',
                templateUrl: 'dashboard/views/comlet-exam.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý khảo thí'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-hr', {
                url: '/dashboard/hr',
                templateUrl: 'dashboard/views/comlet-hr.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý nhân sự'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-fee', {
                url: '/dashboard/fee',
                templateUrl: 'dashboard/views/comlet-fee.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Quản lý học phí'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.dashboard-settings', {
                url: '/dashboard/settings',
                templateUrl: 'dashboard/views/comlet-settings.html',
                data: {icon: 'fa fa-desktop', pageTitle: 'Trang chủ', pageSubTitle: 'Thiết lập hệ thống'},
                controller: 'DashboardController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Dashboard',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                // 'assets/css/external/book.css',
                                'dashboard/controllers/DashboardController.js'
                            ]
                        });
                    }]
                }
            })
    }]);

})();