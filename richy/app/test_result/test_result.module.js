(function () {
    'use strict';

    Hrm.TestResult = angular.module('Hrm.TestResult', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    Hrm.TestResult.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            .state('application.test_results', {
                url: '/test_results',

                // chống cache listing.html
                templateUrl: 'test_result/views/listing.html?v=' + version,

                data: {
                    pageTitle: 'TestResult'
                },

                controller: 'TestResultController as vm',

                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {

                        return $ocLazyLoad.load({
                            name: 'Hrm.TestResult',
                            insertBefore: '#ng_load_plugins_before',

                            files: [
                                'test_result/controllers/TestResultController.js?v=' + version,
                                'test_result/business/TestResultService.js?v=' + version
                            ]
                        });

                    }]
                }
            });

    }]);

})();