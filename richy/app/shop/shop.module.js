(function () {
    'use strict';

    Hrm.Shop = angular.module('Hrm.Shop', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Shop.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.shop', {
                url: '/shop',
                templateUrl: 'shop/views/listing.html',
                data: {pageTitle: 'Shop'},
                controller: 'ShopController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Shop',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'shop/controllers/ShopController.js',
                                'shop/business/ShopService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();