(function () {
    'use strict';

    angular.module('Hrm.EnrolmentClass').service('EnrolmentClassService', EnrolmentClassService);

    EnrolmentClassService.$inject = ['$q', 'settings', 'Utilities'];

    function EnrolmentClassService($q, settings, utils) {
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url + 'enrolment_class';
        var self = this;

        self.getTree = function () {
            return utils.resolve(baseUrl + '/tree', 'GET', angular.noop, angular.noop);
        };

        self.getTeacherCandidates = function () {
            return utils.resolve(baseUrl + '/teacher_candidates', 'GET', angular.noop, angular.noop);
        };

        self.getResponsibleCandidates = function (parentClassId) {
            if (!parentClassId) {
                return self.getTeacherCandidates();
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
