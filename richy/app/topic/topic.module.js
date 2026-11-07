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
                url: '/topics?lesson',
                reloadOnSearch: false,
                templateUrl: 'topic/views/vocabulary.html',
                data: {pageTitle: 'Bài từ vựng'},
                controller: 'VocabularyController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Topic',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'topic/vocabulary.css?v=' + window.APP_VERSION,
                                'topic/controllers/VocabularyController.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'question/controllers/QuestionExcelImportController.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            })

            .state('application.vocabulary_duplicates', {
                url: '/vocabulary_duplicates',
                templateUrl: 'topic/views/vocabulary_duplicates.html',
                data: {pageTitle: 'Quản lý từ trùng'},
                controller: 'VocabularyDuplicateController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Topic',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'topic/vocabulary.css?v=' + window.APP_VERSION,
                                'topic/vocabulary_duplicates.css?v=' + window.APP_VERSION,
                                'topic/controllers/VocabularyDuplicateController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
