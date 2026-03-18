(function () {
    'use strict';

    Hrm.Question = angular.module('Hrm.Question', [
        'ui.router',
        'oc.lazyLoad',
        'bsTable',
        'toastr',
        'ui.select',
        'Hrm.Common',
        'ngSanitize',
        'dndLists',
        // 'pubnub.angular.service',
    ]);

    	Hrm.Question.config(['$stateProvider', function ($stateProvider) {

        $stateProvider

            // Event priority
            .state('application.question', {
                url: '/question/:listFlashCard',
                templateUrl: 'question/views/listing.html',
                data: {pageTitle: 'Flash Card'},
                controller: 'QuestionController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/QuestionController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.print_flash_card', {
                url: '/print_flash_card/:listFlashCard',
                templateUrl: 'question/views/print_flash_card.html',
                data: {pageTitle: 'Print Flash Card'},
                controller: 'QuestionController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/QuestionController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.question_catechism', {
                url: '/question_catechism',
                templateUrl: 'question/views/listing_catechism.html',
                data: {pageTitle: 'Question Catechism'},
                controller: 'QuestionCatechismController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/QuestionCatechismController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })


            .state('application.flash_card_mode', {
                url: '/flash_card_mode/:flashCardModeId',
                templateUrl: 'question/views/flash_card_mode.html',
                data: {pageTitle: 'Question Flash Card'},
                controller: 'QuestionController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/QuestionController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.ielts_writing_collection', {
                url: '/collection_writing',
                templateUrl: 'question/views/ielts_writing_collection.html',
                data: {pageTitle: 'IELTS Writing'},
                controller: 'IELTSWritingCollectionController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSWritingCollectionController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })


            .state('application.ielts_vocabulary', {
                url: '/ielts_vocabulary',
                templateUrl: 'question/views/ielts_vocabulary.html',
                data: {pageTitle: 'IELTS Writing'},
                controller: 'IELTSVocabularyController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSVocabularyController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js',
                            ]
                        });
                    }]
                }
            })

            .state('application.ielts_material', {
                url: '/ielts_material/admin',
                templateUrl: 'question/views/ielts_material.html',
                data: {pageTitle: 'IELTS Material'},
                controller: 'IELTSMaterialController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSMaterialController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js',
                            ]
                        });
                    }]
                }
            })

            .state('application.ielts_writing_actual_test', {
                url: '/ielts_writing_actual_test/:questionId',
                templateUrl: 'question/views/ielts_writing_actual_test.html',
                data: {pageTitle: 'IELTS Writing Actual Test Mode'},
                controller: 'IELTSWritingActualTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSWritingActualTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })


            .state('application.ielts_test', {
                url: '/create_ielts_writing_test',
                templateUrl: 'question/views/create_ielts_writing_test.html',
                data: {pageTitle: 'IELTS Create IELTS Writing Test'},
                controller: 'IELTSCreateWritingTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSCreateWritingTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.create_ielts_reading_test', {
                url: '/create_ielts_reading_test',
                templateUrl: 'question/views/create_ielts_reading_test.html',
                data: {pageTitle: 'Create IELTS Reading Test'},
                controller: 'IELTSCreateReadingTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSCreateReadingTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.create_ielts_listening_test', {
                url: '/create_ielts_listening_test',
                templateUrl: 'question/views/create_ielts_listening_test.html',
                data: {pageTitle: 'Create IELTS Listening Test'},
                controller: 'IELTSCreateListeningTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSCreateListeningTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.ielts_reading_actual_test', {
                url: '/ielts_reading_actual_test/:ieltsReadingTestId',
                templateUrl: 'question/views/ielts_reading_actual_test.html',
                data: {pageTitle: 'IELTS Reading Actual Test'},
                controller: 'IELTSReadingActualTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSReadingActualTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.ielts_listening_actual_test', {
                url: '/ielts_listening_actual_test/:ieltsReadingTestId',
                templateUrl: 'question/views/ielts_listening_actual_test.html',
                data: {pageTitle: 'IELTS Listening Actual Test'},
                controller: 'IELTSListeningActualTestController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/IELTSListeningActualTestController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            })

            .state('application.view', {
                url: '/view/:listFlashCard',
                templateUrl: 'question/views/view.html',
                data: {pageTitle: 'IELTS VIEW'},
                controller: 'ViewController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',

                            files: [
                                'question/controllers/ViewController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js'
                            ],
                            cache: false          // add a cache-busting query param
                        });
                    }]
                }
            })

            .state('application.listening_game_mode', {
                url: '/listening-game-mode/:listFlashCard',
                templateUrl: 'question/views/listening_game_mode.html',
                data: {pageTitle: 'IELTS LISTENING'},
                controller: 'ListeningGameModeController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',

                            files: [
                                'question/controllers/ListeningGameModeController.js',
                                'question/business/QuestionService.js',
                                'topic/business/TopicService.js'
                            ]
                        });
                    }]
                }
            })
            

            .state('application.statistic_user', {
                url: '/statistic_user',
                templateUrl: 'question/views/statistic_user.html',
                data: {pageTitle: 'IELTS Statistic User'},
                controller: 'StatisticUserController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/StatisticUserController.js',
                                'question/business/QuestionService.js'
                            ]
                        });
                    }]
                }
            });
    }]);

})();