(function () {
    'use strict';
    angular.module('Hrm.Common', []);
    angular.module('Hrm.Question', ['ngCookies', 'ngSanitize', 'Hrm.Common']);
    angular.module('SpeakingPublic', ['Hrm.Question']).factory('SpeakingService', ['$http', '$q', '$window', function ($http, $q, $window) {
        var token = String($window.location.hash || '').slice(1), access = {key: '', canEdit: false}, data = null;
        function scopeMatches(context) { return data && Number(context.setId) === data.setId && Number(context.studentId) === data.studentId && data.questions.some(function (q) { return q.id === Number(context.questionId); }); }
        access.matches = function (context) { return !!(scopeMatches(context) && Number(context.userId) === data.shareId); };
        function request(method, path, params, body) {
            if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { return $q.reject({data: {message: 'Link Speaking không hợp lệ.'}}); }
            if (method === 'PUT' && (!access.canEdit || !scopeMatches(body || {}))) { return $q.reject({status: 403, data: {message: 'Link không cho phép sửa bài này.'}}); }
            return $http({method: method, url: '/service/public/speaking' + path, params: params || {}, data: body, timeout: 45000, cache: false, headers: {'X-Speaking-Share': token}}).then(function (r) { return r.data; });
        }
        return {
            publicAccess: access,
            bootstrap: function () { return request('GET', '').then(function (result) {
                if (!result || ![result.shareId, result.setId, result.studentId].every(function (id) { return Number.isInteger(id) && id > 0; }) || typeof result.canEdit !== 'boolean' || !Array.isArray(result.questions)) { throw new Error('Chưa xác nhận được bài được chia sẻ.'); }
                data = result; access.key = String(data.shareId); access.canEdit = data.canEdit; return data;
            }); },
            studentAnswers: function (set, student, question) { return request('GET', '/answer', {questionId: question}); },
            studentAnswerSync: function (set, student, question, revision) { return request('GET', '/answer', {questionId: question, revision: revision}); },
            saveStudentAnswer: function (body) { return request('PUT', '/answer', null, body); },
            speakingNotebook: function (set, student, question, revision) { return request('GET', '/notebook', {questionId: question, revision: revision}); },
            saveSpeakingNotebook: function (body) { return request('PUT', '/notebook', null, body); }
        };
    }]).controller('SpeakingPublicController', ['$scope', 'SpeakingService', function ($scope, api) {
        var vm = this; vm.loading = true; vm.part = 1; vm.groups = []; vm.limit = 6; vm.query = '';
        vm.rebuild = function () {
            var map = {}, term = vm.query.trim().toLowerCase(); vm.groups = []; vm.limit = 6;
            vm.data.questions.forEach(function (q) { if (q.part !== vm.part || term && (q.topic + ' ' + q.prompt).toLowerCase().indexOf(term) < 0) { return; }
                var key = q.part + ':' + q.topic + ':' + (q.linkedPart2Id || '');
                if (!map[key]) { map[key] = {key: key, part: q.part, title: q.topic, questions: []}; vm.groups.push(map[key]); } map[key].questions.push(q);
            });
        };
        vm.more = function () { vm.limit = Math.min(vm.groups.length, vm.limit + 6); };
        vm.changePart = function (part) { vm.part = part; vm.answerId = null; vm.notebookId = null; vm.rebuild(); };
        var alive = true; $scope.$on('$destroy', function () { alive = false; });
        api.bootstrap().then(function (data) { if (!alive) { return; } vm.data = data; vm.ready = true;
            var first = data.questions.filter(function (q) { return q.hasAnswer; })[0] || data.questions[0];
            if (first) { vm.part = first.part; vm.answerId = first.id; } vm.rebuild();
        }).catch(function (error) { if (alive) { vm.error = error.data && error.data.message || error.message || 'Chưa mở được bài. Link có thể đã bị thu hồi.'; } }).finally(function () { if (alive) { vm.loading = false; } });
    }]);
}());
