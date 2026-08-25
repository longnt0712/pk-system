(function () {
    'use strict';

    Hrm.StudentMark = angular.module('Hrm.StudentMark', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

	Hrm.StudentMark.config(['$stateProvider', function ($stateProvider) {

        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Event priority
            .state('application.student_mark', {
                url: '/student_marks',
                templateUrl: 'student_mark/views/listing.html?v=' + version,
                data: {pageTitle: 'StudentMark'},
                controller: 'StudentMarkController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.StudentMark',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'student_mark/controllers/StudentMarkController.js?v=' + version,
                                'student_mark/business/StudentMarkService.js?v=' + version
                            ]
                        });
                    }]
                }
            });
    }]);

})();
