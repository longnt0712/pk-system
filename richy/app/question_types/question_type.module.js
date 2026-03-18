(function () {
    'use strict';

    Hrm.QuestionType = angular.module('Hrm.QuestionType', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.QuestionType.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.question_type', {
                url: '/question_type',
                templateUrl: 'question_types/views/listing.html',
                data: {pageTitle: 'QuestionType'},
                controller: 'QuestionTypeController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.QuestionType',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question_types/controllers/QuestionTypeController.js',
                                'question_types/business/QuestionTypeService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();