(function () {
    'use strict';
    Hrm.Campaign = angular.module('Hrm.Campaign', ['ui.router', 'oc.lazyLoad', 'Hrm.Common']);
    Hrm.Campaign.config(['$stateProvider', function ($stateProvider) {
        var version = window.APP_VERSION;
        function route(url) {
            return {
                url: url,
                reloadOnSearch: url.indexOf('/hoa-thieng') !== 0,
                params: {studentMode: url.indexOf('/hoa-thieng') === 0},
                templateUrl: 'campaign/views/campaign.html?v=' + version,
                data: {pageTitle: 'Chiến dịch · Hoa thiêng', publicCampaign: true},
                controller: 'CampaignController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({name: 'Hrm.Campaign', files: [
                            'campaign/campaign.css?v=' + version,
                            'campaign/business/CampaignService.js?v=' + version,
                            'campaign/controllers/CampaignQrScanner.js?v=' + version,
                            'campaign/controllers/CampaignController.js?v=' + version
                        ]});
                    }]
                }
            };
        }
        $stateProvider.state('campaigns', route('/campaigns'))
            .state('campaign_detail', route('/campaigns/{id:int}'))
            .state('campaign_detail_shared', route('/campaigns/c/{campaignCode}'))
            .state('campaign_student', route('/hoa-thieng'))
            .state('campaign_student_campaign', route('/hoa-thieng/{campaignId:int}'))
            .state('campaign_student_shared', route('/hoa-thieng/c/{campaignCode}'));
    }]);
})();
