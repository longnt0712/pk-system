(function () {
    'use strict';

    Hrm.EducationProgram = angular.module('Hrm.EducationProgram', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.EducationProgram.config(['$stateProvider', function ($stateProvider) {
        var version = window.APP_VERSION || new Date().getTime();

        $stateProvider

            // Event priority
            .state('application.education_program', {
                url: '/education_programs',
                templateUrl: 'education_program/views/listing.html?v=' + version,
                data: {pageTitle: 'EducationProgram'},
                controller: 'EducationProgramController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.EducationProgram',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'education_program/controllers/EducationProgramController.js?v=' + version,
                                'education_program/business/EducationProgramService.js?v=' + version
                            ]
                        });
                    }]
                }
            });
    }]);

})();
