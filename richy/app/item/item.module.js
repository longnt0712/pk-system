(function () {
    'use strict';

    Hrm.Item = angular.module('Hrm.Item', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Item.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.item', {
                url: '/item',
                templateUrl: 'item/views/listing.html',
                data: {pageTitle: 'Item'},
                controller: 'ItemController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Item',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'item/controllers/ItemController.js',
                                'item/business/ItemService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();