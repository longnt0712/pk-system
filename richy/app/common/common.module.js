(function () {
    'use strict';

    Hrm.Common = angular.module('Hrm.Common', [
        'ui.router',
        'oc.lazyLoad',
        'toastr',
        'ngCookies',
        'blockUI'
    ]);

    Hrm.Common.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Login page
            .state('login', {
                url: '/login',
                templateUrl: 'common/views/login/login.html?v=' + version,
                data: {pageTitle: 'Đăng nhập hệ thống'},
                controller: 'LoginController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Common',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'common/controllers/LoginController.js?v=' + version,
                                'common/business/LoginService.js?v=' + version,
                                'assets/css/login.min.css?v=' + version
                            ]
                        });
                    }]
                }
            });
    }]);

})();
