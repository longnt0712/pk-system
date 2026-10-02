(function () {
    'use strict';
    angular.module('Hrm.Campaign').service('CampaignService', ['$http', 'settings', function ($http, settings) {
        var publicUrl = settings.api.baseUrl + 'public/campaigns';
        var privateUrl = settings.api.baseUrl + 'api/campaigns';
        this.list = function (query, page) {
            return $http.get(publicUrl, {params: {q: query || '', page: page || 1, size: 12}, skipSessionAuth: true});
        };
        this.get = function (id) { return $http.get(publicUrl + '/' + id, {skipSessionAuth: true}); };
        this.getByShareCode = function (code) { return $http.get(publicUrl + '/by-code/' + encodeURIComponent(code), {skipSessionAuth: true}); };
        this.save = function (campaign) {
            return campaign.id ? $http.put(privateUrl + '/' + campaign.id, campaign) : $http.post(privateUrl, campaign);
        };
        this.remove = function (id) { return $http.delete(privateUrl + '/' + id); };
        var flowerUrl = settings.api.baseUrl + 'public/campaign-flower/';
        this.scanStudentQr = function (studentCode) { return $http.post(flowerUrl + 'scan', {studentCode: studentCode}, {skipSessionAuth: true}); };
        this.studentLanding = function (token) { return $http.get(flowerUrl + encodeURIComponent(token), {skipSessionAuth: true}); };
        this.studentSheet = function (token, id, week) {
            return $http.get(flowerUrl + encodeURIComponent(token) + '/campaigns/' + id, {params: {week: week}, skipSessionAuth: true});
        };
        this.checkFlower = function (token, id, date, key, completed) {
            return $http.put(flowerUrl + encodeURIComponent(token) + '/campaigns/' + id + '/entries/' + encodeURIComponent(date) + '/' + encodeURIComponent(key), {completed: completed}, {skipSessionAuth: true});
        };
        this.studentGarden = function (token, id) {
            return $http.get(flowerUrl + encodeURIComponent(token) + '/campaigns/' + id + '/garden', {skipSessionAuth: true});
        };
        this.paintFlower = function (token, id, date, key, color) {
            return $http.put(flowerUrl + encodeURIComponent(token) + '/campaigns/' + id + '/garden/' + encodeURIComponent(date) + '/' + encodeURIComponent(key), {color: color}, {skipSessionAuth: true});
        };
        this.resetFlowerPaint = function (token, id) {
            return $http.post(flowerUrl + encodeURIComponent(token) + '/campaigns/' + id + '/garden/reset', {}, {skipSessionAuth: true});
        };
    }]);
})();
