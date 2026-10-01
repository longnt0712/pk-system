(function () {
    'use strict';
    angular.module('Hrm.Campaign').service('CampaignService', ['$http', 'settings', function ($http, settings) {
        var publicUrl = settings.api.baseUrl + 'public/campaigns';
        var privateUrl = settings.api.baseUrl + 'api/campaigns';
        this.list = function (query, page) {
            return $http.get(publicUrl, {params: {q: query || '', page: page || 1, size: 12}, skipSessionAuth: true});
        };
        this.get = function (id) { return $http.get(publicUrl + '/' + id, {skipSessionAuth: true}); };
        this.save = function (campaign) {
            return campaign.id ? $http.put(privateUrl + '/' + campaign.id, campaign) : $http.post(privateUrl, campaign);
        };
        this.remove = function (id) { return $http.delete(privateUrl + '/' + id); };
    }]);
})();
