(function () {
    'use strict';

    Hrm.PersonDate = angular.module('Hrm.PersonDate', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.PersonDate.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.person_date', {
                url: '/person_dates',
                templateUrl: 'person_date/views/listing.html',
                data: {pageTitle: 'ĐIỂM DANH'},
                controller: 'PersonDateController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.PersonDate',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'person_date/controllers/PersonDateController.js',
                                'person_date/business/PersonDateService.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            


        ;
    }]);

})();