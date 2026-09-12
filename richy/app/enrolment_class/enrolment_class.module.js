(function () {
    'use strict';

    Hrm.EnrolmentClass = angular.module('Hrm.EnrolmentClass', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'dndLists',
        'Hrm.Common'
    ]);

	Hrm.EnrolmentClass.config(['$stateProvider', function ($stateProvider) {
		var version = window.APP_VERSION || new Date().getTime();

        function classPage(url, schoolId, title) {
            return {
                url: url,
				templateUrl: 'enrolment_class/views/listing.html?v=' + version,
                data: {pageTitle: title, enrolmentSchoolId: schoolId},
                controller: 'EnrolmentClassController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.EnrolmentClass',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
								'enrolment_class/controllers/EnrolmentClassController.js?v=' + version,
								'enrolment_class/business/EnrolmentClassService.js?v=' + version
                            ]
                        });
                    }]
                }
            };
        }
        $stateProvider
            .state('application.class', classPage('/enrolment_classes', 2, 'Lớp nhà thờ'))
            .state('application.englishClass', classPage('/english_classes', 1, 'Lớp tiếng Anh'));
    }]);

})();
