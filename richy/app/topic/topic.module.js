(function () {
    'use strict';

    Hrm.Topic = angular.module('Hrm.Topic', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common'
    ]);

    	Hrm.Topic.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.topic', {
                url: '/topics',
                templateUrl: 'topic/views/listing.html',
                data: {pageTitle: 'Topic'},
                controller: 'TopicController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Topic',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'topic/controllers/TopicController.js',
                                'topic/business/TopicService.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('content', {
                url: '/topics/:topicId',
                templateUrl: 'topic/views/create_content_normal.html',
                data: {pageTitle: 'Topic Content Normal'},
                controller: 'TopicController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Topic',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'topic/controllers/TopicController.js',
                                'topic/business/TopicService.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })


        ;
    }]);

})();