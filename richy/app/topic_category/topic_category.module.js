(function () {
    'use strict';

    Hrm.TopicCategory = angular.module('Hrm.TopicCategory', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.TopicCategory.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.topic_category', {
                url: '/topic_categories',
                templateUrl: 'topic_category/views/listing.html',
                data: {pageTitle: 'TopicCategory'},
                controller: 'TopicCategoryController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.TopicCategory',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'topic_category/controllers/TopicCategoryController.js',
                                'topic_category/business/TopicCategoryService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();