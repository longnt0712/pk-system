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

        $stateProvider

            // Event priority
            .state('application.test_results', {
                url: '/test_results',
                templateUrl: 'test_result/views/listing.html',
                data: {pageTitle: 'TestResult'},
                controller: 'TestResultController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.TestResult',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'test_result/controllers/TestResultController.js',
                                'test_result/business/TestResultService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();