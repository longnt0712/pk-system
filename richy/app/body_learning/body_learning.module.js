(function () {
    'use strict';

    Hrm.BodyLearning = angular.module('Hrm.BodyLearning', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.BodyLearning.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.body_learning', {
                url: '/body_learning',
                templateUrl: 'body_learning/views/listing.html',
                data: {pageTitle: 'Body Learning'},
                controller: 'BodyLearningController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.BodyLearning',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'body_learning/controllers/BodyLearningController.js',
                                'body_learning/business/BodyLearningService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();