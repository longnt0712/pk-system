(function () {
    'use strict';

    Hrm.Calendar = angular.module('Hrm.Calendar', [
        'ui.router',
        'ui.select',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ng-bootstrap-datepicker',
        'ui.tinymce',
        'ngJsTree',
        'ngFileSaver',
        'Hrm.Common'
    ]);

    Hrm.Calendar.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

        // User Listing
            .state('application.calendar', {
                url: '/calendar',
                templateUrl: 'calendar/views/calendars.html',
                data: {
                    icon: 'icon-equalizer',
                    pageTitle: 'Quản lý',
                    pageSubTitle: 'Quản lý Lịch'
                },
                controller: 'CalendarController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Calendar',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'calendar/controllers/CalendarController.js',
                                'calendar/business/CalendarService.js'
                            ]
                        });
                    }]
                }
            })

    }]);

})();