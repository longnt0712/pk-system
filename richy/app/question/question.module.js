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
                                'question/controllers/QuestionController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'question/controllers/QuestionExcelImportController.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION
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
                                'question/controllers/QuestionController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION
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
                                'question/controllers/QuestionCatechismController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/QuestionController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSWritingCollectionController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSVocabularyController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION,
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
                                'question/controllers/IELTSMaterialController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSWritingActualTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSCreateWritingTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSCreateReadingTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSCreateListeningTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSReadingActualTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/IELTSListeningActualTestController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            })


            .state('application.daily_vocab', {
                url: '/daily-vocab/:listFlashCard',
                templateUrl: 'question/views/daily_vocab.html?v=' + window.APP_VERSION,
                data: {pageTitle: 'DAILY VOCAB'},
                controller: 'DailyVocabController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/DailyVocabController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            })


            .state('application.battle_quiz_online', {
                url: '/battle-quiz-online',
                templateUrl: 'question/views/battle_quiz_online.html?v=' + window.APP_VERSION,
                data: {pageTitle: 'BATTLE QUIZ ONLINE'},
                controller: 'BattleQuizOnlineController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/BattleQuizOnlineController.js?v=' + window.APP_VERSION + '&qrCameraFix=20260825_2&qrDisplay=20260825_1',
                                'question/business/BattleQuizOnlineService.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            })

            .state('application.battle_quiz_online_room', {
                url: '/battle-quiz-online/:roomCode',
                templateUrl: 'question/views/battle_quiz_online.html?v=' + window.APP_VERSION,
                data: {pageTitle: 'BATTLE QUIZ ONLINE'},
                controller: 'BattleQuizOnlineController as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/BattleQuizOnlineController.js?v=' + window.APP_VERSION + '&qrCameraFix=20260825_2&qrDisplay=20260825_1',
                                'question/business/BattleQuizOnlineService.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            })


            .state('application.quiz_battle_2', {
                url: '/quiz-battle-2/:listFlashCard',
                templateUrl: 'question/views/quiz_battle_2.html?v=' + window.APP_VERSION,
                data: {pageTitle: 'QUIZ BATTLE 2'},
                controller: 'QuizBattle2Controller as vm',
                resolve: {
                    deps: ['$ocLazyLoad', function ($ocLazyLoad) {
                        return $ocLazyLoad.load({
                            name: 'Hrm.Question',
                            insertBefore: '#ng_load_plugins_before',
                            files: [
                                'question/controllers/QuizBattle2Controller.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
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
                                'question/controllers/ViewController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION
                            ]
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
                                'question/controllers/ListeningGameModeController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION,
                                'topic/business/TopicService.js?v=' + window.APP_VERSION
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
                                'question/controllers/StatisticUserController.js?v=' + window.APP_VERSION,
                                'question/business/QuestionService.js?v=' + window.APP_VERSION
                            ]
                        });
                    }]
                }
            });
    }]);

})();
