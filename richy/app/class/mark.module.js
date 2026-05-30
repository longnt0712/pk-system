(function () {
    'use strict';

    Hrm.Class = angular.module('Hrm.Class', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Class.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.class', {
                url: '/classes',
                templateUrl: 'class/views/listing.html',
                data: {pageTitle: 'Class'},
                controller: 'ClassController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Class',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'class/controllers/ClassController.js',
                                'class/business/ClassService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();