(function () {
    'use strict';
    angular.module('Hrm.Question').factory('SpeakingService', ['$http', 'settings', function ($http, settings) {
        var base = settings.api.baseUrl + settings.api.apiV1Url + 'speaking';
        function get(path, params) { return $http.get(base + path, {params: params || {}, timeout: 30000}).then(function (r) { return r.data; }); }
        function post(path, data) { return $http.post(base + path, data || {}, {timeout: 45000}).then(function (r) { return r.data; }); }
        return {
            bootstrap: function () { return get('/bootstrap'); },
            createSet: function (data) { return post('/sets', data); },
            bank: function (id, studentId) { return get('/sets/' + id, studentId ? {studentId: studentId} : {}); },
            students: function (id, query) { return get('/sets/' + id + '/students', {q: query || ''}); },
            share: function (id, data) { return post('/sets/' + id + '/share', data); },
            preview: function (id, file) {
                var body = new FormData(); body.append('file', file);
                return $http.post(base + '/sets/' + id + '/import/preview', body, {timeout: 120000, transformRequest: angular.identity, headers: {'Content-Type': undefined}}).then(function (r) { return r.data; });
            },
            confirm: function (id, data) { return post('/sets/' + id + '/import/confirm', data); },
            markPass: function (id, data) { return post('/sets/' + id + '/pass', data); },
            start: function (data) { return post('/practice', data); },
            practice: function (id) { return get('/practice/' + id); },
            progress: function (id, data) { return post('/practice/' + id + '/progress', data); },
            history: function (setId, studentId) { return get('/history', {setId: setId, studentId: studentId}); },
            initRecording: function (id, data) { return post('/practice/' + id + '/recordings', data); },
            chunk: function (id, index, bytes) {
                return $http.post(base + '/recordings/' + id + '/chunks/' + index, bytes, {timeout: 30000, transformRequest: angular.identity, headers: {'Content-Type': 'application/octet-stream'}}).then(function (r) { return r.data; });
            },
            finishRecording: function (id, count) { return post('/recordings/' + id + '/finish', {chunkCount: count}); },
            audio: function (id) { return $http.get(base + '/recordings/' + id + '/audio', {responseType: 'blob', timeout: 60000}).then(function (r) { return r.data; }); },
            exportSet: function (id) { return $http.get(base + '/sets/' + id + '/export', {responseType: 'arraybuffer', timeout: 60000}).then(function (r) { return r.data; }); }
        };
    }]);
})();
