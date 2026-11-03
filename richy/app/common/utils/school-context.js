(function () {
    'use strict';
    angular.module('Hrm').factory('SchoolContext', ['$http', '$q', '$window', 'settings',
        function ($http, $q, $window, settings) {
            var base = settings.api.baseUrl + settings.api.apiV1Url + 'schools';
            var domain = String($window.location.hostname || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
            var pending, generation = 0;
            function reset() {
                generation++; pending = null;
                settings.school = null;
                settings.schoolAccess = {education: [], studentMarks: []};
                settings.hideAttendance = domain === 'ieltsroom.com';
            }
            function load() {
                if (pending) { return pending; }
                var stamp = generation;
                pending = $q.all([
                    $http.get(base + '/current', {params: {domain: domain}}),
                    $http.get(base + '/access')
                ]).then(function (responses) {
                    if (stamp !== generation) { return pending; }
                    var school = responses[0].data;
                    settings.school = school && school.id ? school : null;
                    settings.schoolAccess = responses[1].data;
                    settings.hideAttendance = domain === 'ieltsroom.com' || !!(settings.school && !settings.school.showAttendance);
                    return settings.school;
                }).catch(function (error) {
                    if (stamp === generation) { pending = null; }
                    return $q.reject(error);
                });
                return pending;
            }
            reset();
            return {
                load: load, reset: reset,
                refresh: function () { reset(); return load(); },
                list: function () { return $http.get(base).then(function (response) { return response.data; }); },
                classes: function (id) { return $http.get(base + '/' + id + '/classes').then(function (response) { return response.data; }); },
                save: function (school) { return $http.post(base + '/save', school); },
                roles: function () { return $http.get(base + '/roles'); },
                assignments: function (id) { return $http.get(base + '/' + id + '/roles'); },
                setRoles: function (id, assignment) { return $http.put(base + '/' + id + '/roles', assignment); }
            };
        }
    ]).run(['$rootScope', 'SchoolContext', 'AuthSession', function ($rootScope, schools, auth) {
        function load() { schools.refresh().catch(angular.noop); }
        $rootScope.$on('session:restored', load);
        $rootScope.$on('session:expired', schools.reset);
        if (auth.hasCredentials()) { schools.load().catch(angular.noop); }
    }]);
})();
