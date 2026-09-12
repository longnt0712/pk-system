(function () {
    'use strict';

    angular.module('Hrm.EnrolmentClass').service('EnrolmentClassService', EnrolmentClassService);

    EnrolmentClassService.$inject = ['$q', 'settings', 'Utilities'];

    function EnrolmentClassService($q, settings, utils) {
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url + 'enrolment_class';
        var self = this;

        self.getTree = function (schoolId) {
            return utils.resolve(baseUrl + '/tree?schoolId=' + encodeURIComponent(schoolId || 2), 'GET', angular.noop, angular.noop);
        };
        self.updateTaskProgress = function (classId, dayId, taskId, payload) {
            return utils.resolveAlt(baseUrl + '/schedule/' + classId + '/day/' + dayId + '/task/' + taskId + '/progress',
                'PUT', null, payload, {'Content-Type': 'application/json; charset=utf-8'});
        };

        self.getTeacherCandidates = function () {
            return utils.resolve(baseUrl + '/teacher_candidates', 'GET', angular.noop, angular.noop);
        };

        self.getResponsibleCandidates = function (parentClassId, classId) {
            if (!parentClassId) {
                return self.getTeacherCandidates();
            }
            if (classId) {
                return utils.resolve(
                    baseUrl + '/responsible_candidates/' + parentClassId + '/' + classId,
                    'GET',
                    angular.noop,
                    angular.noop
                );
            }
            return utils.resolve(
                baseUrl + '/responsible_candidates/' + parentClassId,
                'GET',
                angular.noop,
                angular.noop
            );
        };

        self.getTeamBoard = function (classId) {
            if (!classId) {
                return $q.when(null);
            }
            return utils.resolve(baseUrl + '/team_board/' + classId, 'GET', angular.noop, angular.noop);
        };

        self.moveStudentToTeam = function (classId, moveDto) {
            if (!classId || !moveDto || !moveDto.userId) {
                return $q.when(null);
            }
            return utils.resolveAlt(baseUrl + '/team_board/' + classId + '/move', 'POST', null, moveDto, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };

        self.getSchedule = function (classId, fromDate, toDate) {
            if (!classId || !fromDate || !toDate) {
                return $q.when([]);
            }
            return utils.resolve(
                baseUrl + '/schedule/' + classId
                    + '?fromDate=' + encodeURIComponent(fromDate)
                    + '&toDate=' + encodeURIComponent(toDate),
                'GET', angular.noop, angular.noop
            );
        };

        self.getScheduleTopics = function () {
            return utils.resolve(baseUrl + '/schedule/topics', 'GET', angular.noop, angular.noop);
        };

        self.getScheduleSession = function (classId, date) {
            return utils.resolve(baseUrl + '/schedule/' + classId + '/session?date=' + encodeURIComponent(date),
                'GET', angular.noop, angular.noop);
        };

        self.moveScheduleDay = function (classId, object) {
            return utils.resolveAlt(baseUrl + '/schedule/' + classId + '/move', 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };

        self.getScheduleStudents = function (classId) {
            return utils.resolve(baseUrl + '/schedule/' + classId + '/students', 'GET', angular.noop, angular.noop);
        };

        self.getPreviousScheduleDay = function (classId, beforeDate) {
            return utils.resolve(baseUrl + '/schedule/' + classId + '/previous?beforeDate=' + encodeURIComponent(beforeDate),
                'GET', angular.noop, angular.noop);
        };

        self.saveScheduleSettings = function (classId, object) {
            return utils.resolveAlt(baseUrl + '/schedule/' + classId + '/settings', 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };

        self.saveScheduleDay = function (classId, object) {
            return utils.resolveAlt(baseUrl + '/schedule/' + classId + '/day', 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };

        self.getOne = function (id) {
            if (!id) {
                return $q.when(null);
            }
            return utils.resolve(baseUrl + '/get_one/' + id, 'GET', angular.noop, angular.noop);
        };

        self.saveObject = function (object) {
            return utils.resolveAlt(baseUrl + '/save', 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };

        self.deleteObject = function (id) {
            if (!id) {
                return $q.when(false);
            }
            return utils.resolveAlt(baseUrl + '/delete/' + id, 'DELETE', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        };
    }
})();
