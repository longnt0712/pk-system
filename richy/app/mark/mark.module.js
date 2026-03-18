(function () {
    'use strict';

    Hrm.Mark = angular.module('Hrm.Mark', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Mark.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.mark', {
                url: '/marks',
                templateUrl: 'mark/views/listing.html',
                data: {pageTitle: 'Mark'},
                controller: 'MarkController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Mark',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'mark/controllers/MarkController.js',
                                'mark/business/MarkService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();