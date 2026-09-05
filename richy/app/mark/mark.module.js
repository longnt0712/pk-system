(function () {
    'use strict';

    Hrm.Mark = angular.module('Hrm.Mark', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common',
        'dndLists'
    ]);

    	Hrm.Mark.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Event priority
            .state('application.mark', {
                url: '/marks',
                templateUrl: 'mark/views/listing.html?v=' + version,
                data: {pageTitle: 'Mark'},
                controller: 'MarkController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Mark',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'mark/controllers/MarkController.js?v=' + version,
                                'mark/business/MarkService.js?v=' + version
                            ]
                        });
                    }]
                }
            });
    }]);

})();
