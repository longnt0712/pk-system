(function () {
    'use strict';

    Hrm.ClassicalLearning = angular.module('Hrm.ClassicalLearning', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.ClassicalLearning.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.classical_learning', {
                url: '/classical_learning',
                templateUrl: 'classical_learning/views/listing.html',
                data: {pageTitle: 'Classical Learning'},
                controller: 'ClassicalLearningController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.ClassicalLearning',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'classical_learning/controllers/ClassicalLearningController.js',
                                'classical_learning/business/ClassicalLearningService.js'
                            ]
                        });
                    }]
                }
            })
            
            .state('application.ielts_writing', {
                url: '/ielts_writing',
                templateUrl: 'classical_learning/views/ielts_writing.html',
                data: {pageTitle: 'IELTS Writing'},
                controller: 'ClassicalLearningController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.ClassicalLearning',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'classical_learning/controllers/ClassicalLearningController.js',
                                'classical_learning/business/ClassicalLearningService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();