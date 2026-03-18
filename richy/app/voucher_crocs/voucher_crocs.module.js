(function () {
    'use strict';

    Hrm.VoucherCrocs = angular.module('Hrm.VoucherCrocs', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.VoucherCrocs.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.voucher_crocs', {
                url: '/voucher_crocs',
                templateUrl: 'voucher_crocs/views/listing.html',
                data: {pageTitle: 'VoucherCrocs'},
                controller: 'VoucherCrocsController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.VoucherCrocs',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'voucher_crocs/controllers/VoucherCrocsController.js',
                                'voucher_crocs/business/VoucherCrocsService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();