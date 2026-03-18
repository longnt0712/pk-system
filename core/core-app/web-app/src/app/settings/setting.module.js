(function () {
    'use strict';

    Core.Settings = angular.module('Core.Settings', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',

        'Core.Common'
    ]);

    Core.Settings.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // General Settings
            .state('application.settings', {
                url: '/settings',
                templateUrl: 'settings/views/general.html',
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Hệ thống',
                    pageSubTitle: 'Thiết lập các tham số hệ thống'
                },
                controller: 'SettingsController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Core.Settings',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'settings/controllers/SettingsController.js',
                                'settings/business/SettingsService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();