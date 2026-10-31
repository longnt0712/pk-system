(function () {
    'use strict';

    Core.Common = angular.module('Core.Common', [
        'ui.router',
        'oc.lazyLoad',
        'toastr',
        'ngCookies',
        'blockUI'
    ]);

    Core.Common.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Login page
            .state('login', {
                url: '/login',
                templateUrl: 'common/views/login/login.html?v=20261031-auth-recovery',
                data: {pageTitle: 'System login'},
                controller: 'LoginController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Common',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'common/controllers/LoginController.js?v=20261031-auth-refreshfix',
                                'common/business/LoginService.js?v=20261031-auth-refreshfix',
                                'assets/css/login.min.css'
                            ]
                        });
                    }]
                }
            });
    }]);

})();
