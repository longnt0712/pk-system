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
        var pdfFiles = ['enrolment_class/teaching_pdf.css?v=' + version,
            'enrolment_class/business/TeachingPdf.js?v=' + version];

        function loadFiles($ocLazyLoad, files) {
            return $ocLazyLoad.load({
                name: 'Hrm.EnrolmentClass',
                insertBefore: '#ng_load_plugins_before',
                files: files
            });
        }

        function classPage(url, schoolId, title) {
            return {
                url: url + '?scheduleClassId',
				templateUrl: 'enrolment_class/views/listing.html?v=' + version,
                data: {pageTitle: title, enrolmentSchoolId: schoolId},
                controller: 'EnrolmentClassController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return loadFiles($ocLazyLoad, pdfFiles.concat([
                            'assets/css/class-assignment-picker.css?v=' + version,
                            'enrolment_class/business/ClassAssignmentPicker.js?v=' + version,
                            'enrolment_class/controllers/EnrolmentClassController.js?v=' + version,
                            'enrolment_class/business/EnrolmentClassService.js?v=' + version
                        ]));
                    }]
                }
            };
        }
        $stateProvider
            .state('application.class', classPage('/enrolment_classes', 2, 'Lớp nhà thờ'))
            .state('application.englishClass', classPage('/english_classes', 1, 'Lớp tiếng Anh'))
            .state('application.englishClassPdf', {
                url: '/english_classes/pdf?classId&date&runId',
                data: {pageTitle: 'Tài liệu PDF'},
                template: '<section class="teaching-pdf-route">' +
                    '<div ng-if="pdf" ng-include="pdfReaderTemplate"></div>' +
                    '<div ng-if="pdfLaunchError" class="alert alert-danger" role="alert">{{pdfLaunchError}} ' +
                    '<a ui-sref="application.englishClass">Về lịch lớp</a></div></section>',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return loadFiles($ocLazyLoad, pdfFiles);
                    }]
                },
                controller: ['$scope', '$stateParams', '$state', 'TeachingPdf', function ($scope, params, $state, teachingPdf) {
                    var classId = Number(params.classId);
                    if (!Number.isSafeInteger(classId) || classId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(params.date) || !params.runId) {
                        $scope.pdfLaunchError = 'Link tài liệu PDF không hợp lệ.';
                        return;
                    }
                    $scope.pdfReaderTemplate = 'enrolment_class/views/teaching_pdf.html?v=' + version;
                    $scope.pdf = teachingPdf.mountPage($scope, classId, params.date, params.runId, function () {
                        return $state.go('application.englishClass', {scheduleClassId: classId});
                    });
                }]
            });
    }]);

})();
