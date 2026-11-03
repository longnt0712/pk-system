(function () {
    'use strict';
    Hrm.TnttDocuments = angular.module('Hrm.TnttDocuments', ['ui.router', 'oc.lazyLoad', 'ui.bootstrap', 'Hrm.Common']);
    Hrm.TnttDocuments.config(['$stateProvider', function (states) {
        var v = (window.APP_VERSION || '') + '-tntt-documents-1';
        states.state('application.tntt_documents', {url: '/tai-lieu?tab&notice&document&mode', data: {pageTitle: 'Tài liệu TNTT'},
            templateUrl: 'tntt_documents/documents.html?v=' + v, controller: 'TnttDocumentsController as vm',
            resolve: {deps: ['$ocLazyLoad', function (loader) { return loader.load({name: 'Hrm.TnttDocuments', files: [
                'tntt_documents/TnttDocumentNotebookStore.js?v=' + v, 'tntt_documents/TnttDocumentPrint.js?v=' + v,
                'tntt_documents/documents.css?v=' + v, 'tntt_documents/TnttDocumentsController.js?v=' + v
            ]}); }]}});
    }]);
    Hrm.TnttDocuments.factory('TnttDocumentApi', ['$http', 'settings', function ($http, settings) {
        var base = settings.api.baseUrl + 'api/tntt-documents';
        function request(method, path, data, params) { return $http({method: method, url: base + path, data: data, params: params, timeout: 20000}).then(function (r) { return r.data; }); }
        return {capabilities: function () { return request('GET', '/capabilities'); }, list: function (trash, q) { return request('GET', '/entries', null, {trash: !!trash, q: q || ''}); },
            recipients: function () { return request('GET', '/recipients'); }, create: function (data) { return request('POST', '/entries', data); },
            read: function (id, revision) { return request('GET', '/entries/' + id, null, {revision: revision}); }, save: function (id, data) { return request('PUT', '/entries/' + id, data); },
            metadata: function (id, data) { return request('PUT', '/entries/' + id + '/metadata', data); }, publish: function (id, data) { return request('POST', '/entries/' + id + '/publish', data); },
            sharing: function (id, data) { return request('PUT', '/entries/' + id + '/sharing', data); }, history: function (id) { return request('GET', '/entries/' + id + '/history'); },
            version: function (id, version) { return request('GET', '/entries/' + id + '/history/' + version); }, restore: function (id, data) { return request('POST', '/entries/' + id + '/restore', data); },
            delivery: function (id) { return request('GET', '/entries/' + id + '/delivery'); }, testEmail: function (id) { return request('POST', '/entries/' + id + '/email-test', {}); },
            notifications: function (unread) { return request('GET', '/notifications', null, {unread: !!unread}); }, notification: function (id) { return request('GET', '/notifications/' + id); },
            markRead: function (id) { return request('POST', '/notifications/' + id + '/read', {}); }};
    }]);
}());
