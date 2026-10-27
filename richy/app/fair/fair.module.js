(function () {
    'use strict';
    Hrm.Fair = angular.module('Hrm.Fair', ['ui.router', 'oc.lazyLoad', 'Hrm.Common']);
    Hrm.Fair.config(['$stateProvider', function ($stateProvider) {
        var version = window.APP_VERSION;
        function route(url, mode) {
            return {
                url: url, reloadOnSearch: false,
                data: {pageTitle: 'Hội chợ', publicFair: mode === 'lookup', fairPrivate: mode !== 'lookup'},
                params: {fairMode: mode},
                templateUrl: 'fair/fair.html?v=' + version,
                controller: 'FairController as vm',
                resolve: {deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                    return $ocLazyLoad.load({name: 'Hrm.Fair', files: [
                        'fair/fair.css?v=' + version,
                        'assets/scripts/external/html5-qrcode.min.js?v=' + version,
                        'assets/scripts/external/qrcode.min.js?v=' + version,
                        'fair/fair-core.js?v=' + version,
                        'fair/FairService.js?v=' + version,
                        'fair/FairScanner.js?v=' + version,
                        'fair/FairController.js?v=' + version
                    ]});
                }]}
            };
        }
        $stateProvider.state('fair_lookup', route('/hoi-cho?ma', 'lookup'))
            .state('fair_lookup_event', route('/hoi-cho/{id:int}/tra-cuu?ma', 'lookup'))
            .state('fair_work', route('/hoi-cho/lam-viec', 'work'))
            .state('fair_work_event', route('/hoi-cho/{id:int}/lam-viec', 'work'))
            .state('fair_admin', route('/hoi-cho/quan-tri', 'admin'))
            .state('fair_admin_event', route('/hoi-cho/{id:int}/quan-tri', 'admin'));
    }]);
})();
