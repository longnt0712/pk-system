(function () {
    'use strict';

    Hrm.Answer = angular.module('Hrm.Answer', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Answer.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.answer', {
                url: '/answer',
                templateUrl: 'answer/views/listing.html',
                data: {pageTitle: 'Answer'},
                controller: 'AnswerController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Answer',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'answer/controllers/AnswerController.js',
                                'answer/business/AnswerService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();