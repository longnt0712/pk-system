(function () {
    'use strict';

    Hrm.Body = angular.module('Hrm.Body', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Body.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.body', {
                url: '/body',
                templateUrl: 'body/views/listing.html',
                data: {pageTitle: 'Body'},
                controller: 'BodyController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Body',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'body/controllers/BodyController.js',
                                'body/business/BodyService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();