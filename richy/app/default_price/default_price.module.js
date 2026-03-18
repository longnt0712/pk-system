(function () {
    'use strict';

    Hrm.DefaultPrice = angular.module('Hrm.DefaultPrice', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.DefaultPrice.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.default_price', {
                url: '/default_price',
                templateUrl: 'default_price/views/listing.html',
                data: {pageTitle: 'DefaultPrice'},
                controller: 'DefaultPriceController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.DefaultPrice',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'default_price/controllers/DefaultPriceController.js',
                                'default_price/business/DefaultPriceService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();