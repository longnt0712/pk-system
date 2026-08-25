(function () {
    'use strict';

    Hrm.Products = angular.module('Hrm.Products', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

	Hrm.Products.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Event priority
            .state('application.products', {
                url: '/product',
                templateUrl: 'products/views/listing.html?v=' + version,
                data: {pageTitle: 'Products'},
                controller: 'ProductsController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Products',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'products/controllers/ProductsController.js?v=' + version,
                                'products/business/ProductsService.js?v=' + version
                            ]
                        });
                    }]
                }
            });
    }]);

})();
