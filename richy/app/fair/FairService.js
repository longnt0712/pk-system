(function () {
    'use strict';
    angular.module('Hrm.Fair').service('FairService', ['$http', 'settings', function ($http, settings) {
        var publicUrl = settings.api.baseUrl + 'public/fairs', privateUrl = settings.api.baseUrl + 'api/fairs';
        var publicOptions = {skipSessionAuth: true, timeout: 15000};
        this.events = function (admin) { return $http.get(admin ? privateUrl : publicUrl, admin ? {timeout: 15000} : publicOptions); };
        this.event = function (id) { return $http.get(publicUrl + '/' + id, publicOptions); };
        this.balance = function (id, code) { return $http.get(publicUrl + '/' + id + '/balance', {params: {cardCode: code}, skipSessionAuth: true, timeout: 15000}); };
        this.operator = function (id) { return $http.get(privateUrl + '/' + id + '/operator', {timeout: 15000}); };
        this.saveEvent = function (event) { return event.id ? $http.put(privateUrl + '/' + event.id, event) : $http.post(privateUrl, event); };
        this.stations = function (id) { return $http.get(privateUrl + '/' + id + '/stations'); };
        this.saveStation = function (id, station) { return $http.post(privateUrl + '/' + id + '/stations', station); };
        this.guests = function (id) { return $http.get(privateUrl + '/' + id + '/guests'); };
        this.generateGuests = function (id, count) { return $http.post(privateUrl + '/' + id + '/guests', {count: count}); };
        this.transact = function (id, request) { return $http.post(privateUrl + '/' + id + '/transactions', request, {timeout: 20000}); };
        this.undo = function (id, transactionId, request) { return $http.post(privateUrl + '/' + id + '/transactions/' + transactionId + '/undo', request, {timeout: 20000}); };
        this.correct = function (id, transactionId, request) { return $http.post(privateUrl + '/' + id + '/transactions/' + transactionId + '/correct', request, {timeout: 20000}); };
        this.history = function (id, code, before) { return $http.get(privateUrl + '/' + id + '/transactions', {params: {cardCode: code || '', before: before || 0}, timeout: 15000}); };
    }]);
})();
