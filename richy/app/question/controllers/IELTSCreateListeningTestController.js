/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSCreateListeningTestController', IELTSCreateListeningTestController);

    IELTSCreateListeningTestController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'QuestionService',
        '$location',
        '$stateParams',
        '$window',
        'blockUI',
        '$sce',
        '$cookies'
        // 'dndLists'
        // 'ngSanitize',
        
    ];

    function IELTSCreateListeningTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        // console.log(vm.currentUser);
        if(vm.currentUser.roles != null){
            angular.forEach(vm.currentUser.roles, function(value, key) {
                if(value.name == "ROLE_ADMIN"){
                    settings.isAdmin = true;
                    console.log("ADMIN");
                }
            });
        }

        vm.question = {};
        vm.questions = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};
        // vm.searchDto.userId = vm.currentUser.id;
        vm.answer = null;
        vm.answers = [];

        vm.type = {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"};
        vm.types = [
            {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 2, name: "Filling Gaps", notice: "Fill words in gaps"},
            {id: 3, name: "Filling Gaps Enter", notice: "Fill A-G in gaps"},
            {id: 4, name: "Matching Heading", notice: "Drag and Drop"},
            {id: 5, name: "Multiple Choices - Multiple Answers", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 6, name: "Multiple Choices - Listening (horizon)", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
        ];

        vm.status = {id: 1, name: "Chưa thuộc"};
        vm.statuses = [
            {id: 1, name: "Chưa thuộc"},
            {id: 2, name: "Thuộc"},
            {id: 3, name: "Tất cả"}
            // {id: 3, name:"Tất cả"}
        ];


        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 100;
        vm.searchDto.pageSize = 12;
        vm.searchDto.pageIndex = 1;
        vm.currentPosition = 0;
        vm.currentCard = {};

        vm.ieltsWritingTests = [];

        // vm.ieltsListeningTests = [];
        // vm.ieltsListeningTest = {
        //     questionType: {
        //         code: 'IELTSRT',
        //         id: 11,
        //         name: 'IELTS Writing Test',
        //         textSearch: null
        //     },
        //     type: 0,
        //     status: 1,
        //     questionTopics: [],
        //     countWords: 0,
        //     ordinalNumber: 1,
        //     subQuestions: [],
        //     userId: vm.currentUser.id
        // };  //create a new test

        vm.getPageCreateIELTSReadingTest = function () {
            vm.searchDto.questionType = {id: 22};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.ieltsListeningTests = data.content;
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsListeningTests;
                vm.bsTableControlCreateIELTSReadingTest.options.totalRows = data.totalElements;
                // x.focus();
                console.log(vm.ieltsListeningTests);

            });
        };

        vm.searchDto.pageSize = 10;
        vm.getPageCreateIELTSReadingTest();

        // function secondCallFunction() {
        //     var timeout;
        //     timeout = $timeout(function(){
        //         alert('222');
        //         timeout = null;
        //     },2000);
        // }
        //
        // function firstCallFunction(myCallback) {
        //     var timeout;
        //     timeout = $timeout(function(){
        //         alert('111');
        //         // myCallback('bbb');
        //     },3000);
        // }
        //
        // firstCallFunction(secondCallFunction);

        vm.getQuestionTypes = function () {
            service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.questionTypes = data.content;
                vm.question.questionType = vm.questionTypes[0];

            });
        };
        
        //--------------------- Create Reading test -------------------------//
        vm.ieltsListeningTests = [];
        var example = '<p class="bold"><strong>Question ?  to ? ' + '</strong></p><p>Choose <strong>TRUE&nbsp;</strong>if the statement agrees with the information in the text, choose <strong>FALSE</strong> if the statement disagrees with the information in the text, or choose <strong>NOT GIVEN</strong> if there is no information on this</p>';

        // vm.readingQuestionTypes = [
        //     {
        //         id: 1,
        //         name: 'A, B, C, D, E, F, G...'
        //     },
        //     {
        //         id: 2,
        //         name: 'T/F/NG'
        //     },
        //     {
        //         id: 3,
        //         name: 'Y/N/NG'
        //     }
        // ];
        // vm.readingQuestionType = null;

        vm.ieltsListeningTest = {
            questionType : {
                code: 'IELTSLT',
                id: 22,
                name: 'IELTS Listening Test',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0,
            ordinalNumber: 1,
            userId: vm.currentUser.id,
            subQuestions : [
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP1',
                        id: 23,
                        name: 'IELTS Listening Test Part 1'
                    },
                    ordinalNumber: 1,
                    subQuestions: [
                    //     {
                    //         question: example,
                    //         questionType : {
                    //             code: 'IELTSRTPK',
                    //             id: 18,
                    //             name: 'IELTS Reading Test Package',
                    //             textSearch: null
                    //         },
                    //         subQuestions : [],
                    //         ordinalNumber: 1
                    //     }
                    ]
                },
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP2',
                        id: 24,
                        name: 'IELTS Listening Test Part 2'
                    },
                    ordinalNumber: 2,
                    subQuestions: [
                        // {
                        //     question: example,
                        //     questionType : {
                        //         code: 'IELTSRTPK',
                        //         id: 18,
                        //         name: 'IELTS Reading Test Package',
                        //         textSearch: null
                        //     },
                        //     subQuestions : [],
                        //     ordinalNumber: 1
                        // }
                    ]
                },
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP3',
                        id: 25,
                        name: 'IELTS Lítening Test Part 3'
                    },
                    ordinalNumber: 3,
                    subQuestions: [
                        // {
                        //     question: example,
                        //     questionType : {
                        //         code: 'IELTSRTPK',
                        //         id: 18,
                        //         name: 'IELTS Reading Test Package',
                        //         textSearch: null
                        //     },
                        //     subQuestions : [],
                        //     ordinalNumber: 1
                        // }
                    ]
                },
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP3',
                        id: 26,
                        name: 'IELTS Lítening Test Part 4'
                    },
                    ordinalNumber: 4,
                    subQuestions: [
                        // {
                        //     question: example,
                        //     questionType : {
                        //         code: 'IELTSRTPK',
                        //         id: 18,
                        //         name: 'IELTS Reading Test Package',
                        //         textSearch: null
                        //     },
                        //     subQuestions : [],
                        //     ordinalNumber: 1
                        // }
                    ]
                }
            ]
        };  //create a new test
        vm.createPassageNumber = 1;

        vm.saveReadingTest = function () {
            service.saveObject(vm.ieltsListeningTest).then(function (data) {

                vm.ieltsListeningTest = data;
                vm.getOrdinalNumber(data);
                isHavingQuestions(vm.ieltsListeningTest);

                if(vm.createPassageNumber == 1){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }
                if(vm.createPassageNumber == 2){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage2 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 3){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage3 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 4){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage4 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                // console.log(data);
                vm.getPageCreateIELTSReadingTest();
            }, function success() {
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        function isHavingQuestions (ieltsListeningTest) {
            var passages = ieltsListeningTest.subQuestions;

            if(passages != null){
                if(passages[3].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 4;
                } else if(passages[2].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 3;
                } else if(passages[1].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 2;
                }else if(passages[0].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 1;
                }
                // var packagesForPassage2 = ieltsListeningTest.subQuestions[1].subQuestions;
                for(var i = 0; i< passages.length; i++){
                    var packages = passages[i].subQuestions;
                    if(packages != null){
                        for(var j = 0; j < packages.length; j++){
                            var questions = packages[j].subQuestions;
                            if(questions != null && questions.length > 0){
                                packages[j].isHaveChildren = true;
                            } else {
                                packages[j].isHaveChildren = false;
                            }
                            console.log(packages[j].isHaveChildren);
                        }
                        
                    }
                }

            }
        }

        vm.highestOrdinalNumberPassage = 0;
        vm.highestOrdinalNumberPackageForPassage1 = 0;
        vm.highestOrdinalNumberQuestionForPassage1 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage1 = 0;

        vm.highestOrdinalNumberPackageForPassage2 = 0;
        vm.highestOrdinalNumberQuestionForPassage2 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage2 = 0;

        vm.highestOrdinalNumberPackageForPassage3 = 0;
        vm.highestOrdinalNumberQuestionForPassage3 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage3 = 0;

        vm.highestOrdinalNumberPackageForPassage4 = 0;
        vm.highestOrdinalNumberQuestionForPassage4 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage4 = 0;

        vm.isShowConfigureQuestion = false;

        function getHighestOrdinalNumber(objects) {
            var temp = 0;
            if(objects != null){ //Passage
                for(var i = 0; i < objects.length; i++){
                    if(objects[i].ordinalNumber != null && objects[i].ordinalNumber > temp){
                        temp = objects[i].ordinalNumber;
                    }
                }
            }
            return temp;
        }

        vm.getOrdinalNumberPassage4 = function (ieltsListeningTest){
            if(ieltsListeningTest!= null){
                var passages = ieltsListeningTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    // var packagesForPassage2 = ieltsListeningTest.subQuestions[1].subQuestions;
                    var packagesForPassage4 = ieltsListeningTest.subQuestions[3].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage4 = getHighestOrdinalNumber(packagesForPassage4);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 4: ' + vm.highestOrdinalNumberPackageForPassage4);
                    if(packagesForPassage4 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsListeningTest.subQuestions[3].subQuestions.length; i++){
                            var questionsForPassage4 = ieltsListeningTest.subQuestions[3].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage4);

                            if(vm.highestOrdinalNumberQuestionForPassage4 < temp){
                                vm.highestOrdinalNumberQuestionForPassage4 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 4: ' + vm.highestOrdinalNumberQuestionForPassage4);
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage4 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage4 = 0;
                    // vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage4 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }

        };

        vm.getOrdinalNumberPassage3 = function (ieltsListeningTest){
            if(ieltsListeningTest!= null){
                var passages = ieltsListeningTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsListeningTest.subQuestions[1].subQuestions;
                    var packagesForPassage3 = ieltsListeningTest.subQuestions[2].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage3 = getHighestOrdinalNumber(packagesForPassage3);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 3: ' + vm.highestOrdinalNumberPackageForPassage3);
                    if(packagesForPassage3 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsListeningTest.subQuestions[2].subQuestions.length; i++){
                            var questionsForPassage3 = ieltsListeningTest.subQuestions[2].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage3);

                            if(vm.highestOrdinalNumberQuestionForPassage3 < temp){
                                vm.highestOrdinalNumberQuestionForPassage3 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 3: ' + vm.highestOrdinalNumberQuestionForPassage3);
                        vm.highestOrdinalNumberQuestionForPassage4 = vm.highestOrdinalNumberQuestionForPassage3;
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage3 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage3 = 0;
                    // vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage3 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            vm.getOrdinalNumberPassage4(ieltsListeningTest);
        };

        vm.getOrdinalNumberPassage2 = function (ieltsListeningTest){
            if(ieltsListeningTest!= null){
                var passages = ieltsListeningTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsListeningTest.subQuestions[1].subQuestions;
                    var packagesForPassage1 = ieltsListeningTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage2 = getHighestOrdinalNumber(packagesForPassage2);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 2: ' + vm.highestOrdinalNumberPackageForPassage2);
                    if(packagesForPassage2 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsListeningTest.subQuestions[1].subQuestions.length; i++){
                            var questionsForPassage2 = ieltsListeningTest.subQuestions[1].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage2);

                            if(vm.highestOrdinalNumberQuestionForPassage2 < temp){
                                vm.highestOrdinalNumberQuestionForPassage2 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 2: ' + vm.highestOrdinalNumberQuestionForPassage2);
                        vm.highestOrdinalNumberQuestionForPassage3 = vm.highestOrdinalNumberQuestionForPassage2;
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage2 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage2 = 0;
                    // vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage2 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            vm.getOrdinalNumberPassage3(ieltsListeningTest);
        };

        vm.getOrdinalNumber = function (ieltsListeningTest){
            if(ieltsListeningTest!= null){
                var passages = ieltsListeningTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage1 = ieltsListeningTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage1 = getHighestOrdinalNumber(packagesForPassage1);
                    console.log('highest orinal number packages for passage 1: ' + vm.highestOrdinalNumberPackageForPassage1);
                    if(packagesForPassage1 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsListeningTest.subQuestions[0].subQuestions.length; i++){
                            var questionsForPassage1 = ieltsListeningTest.subQuestions[0].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage1);
                            if(vm.highestOrdinalNumberQuestionForPassage1 < temp){
                                vm.highestOrdinalNumberQuestionForPassage1 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 1: ' + vm.highestOrdinalNumberQuestionForPassage1);
                        vm.highestOrdinalNumberQuestionForPassage2 = vm.highestOrdinalNumberQuestionForPassage1;
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage1 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage1 = 0;
                    vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage1 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            // vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
            // vm.toQuestion = vm.fromQuestion + 1;
            // if(vm.fromQuestion > 0){
            //     vm.disableFromQuestion = true;
            // }
            // example = '<p class="bold"><strong>Question '+ vm.fromQuestion + ' to '+ vm.toQuestion + '</strong></p><p>Choose <strong>TRUE&nbsp;</strong>if the statement agrees with the information in the text, choose <strong>FALSE</strong> if the statement disagrees with the information in the text, or choose <strong>NOT GIVEN</strong> if there is no information on this</p>';
            vm.getOrdinalNumberPassage2(ieltsListeningTest);
        };

        $scope.editCreateIELTSReadingTest= function (id) {
            vm.createPackage = true;
            vm.isShowConfigureQuestion = false;

            // console.log(vm.ieltsListeningTest.subQuestions[0]);
            service.getOne(id).then(function (data) {
                vm.ieltsListeningTest = data;
                vm.getOrdinalNumber(data);

                isHavingQuestions(vm.ieltsListeningTest);

                if(vm.createPassageNumber == 1){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }
                if(vm.createPassageNumber == 2){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage2 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 3){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage3 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 4){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage4 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }



                console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        //the process of creating

        //passage 1
        vm.createPackage = false;
        vm.startCreateQuestionForPassage1 = function () {
            if(vm.ieltsListeningTest.title == null || vm.ieltsListeningTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };

        //configure question answer
        vm.tempAnswers = [];
        vm.numberOfAnswers = 0;
        vm.fromQuestion = 1;
        vm.toQuestion = 0;
        vm.disableFromQuestion = false;

        vm.createTempAnswers = function (index) {
            console.log('for package: ' + (index+1));
            vm.tempAnswers = [];
            for(var i = 0; i < vm.numberOfAnswers; i++){
                var item = {
                    answer: {
                        answer:'hihi'
                    },
                    question: {},
                    ordinalNumberQuestionAnswer : 0,
                    correct: false,
                    i:i,
                    packageNumber: index
                };
                vm.tempAnswers.push(item);
            }
        };

        vm.validateFromToQuestion = function () {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                // vm.toQuestion = vm.fromQuestion + 1;
                return;
            }
        };

        vm.addQuestionForPassage1 = function (index) {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                return;
            }
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };
                item.question = item.question +  i;
                item.ordinalNumber = i;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions == null){
                    vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(vm.tempAnswers[j]);
                }

                // item.questionAnswers = tempAnswers;
            }
            vm.saveReadingTest();




            //
            // var item = {
            //     question: 'Question number ',
            //     questionType : {
            //         code: 'IELTSRTQ',
            //         id: 19,
            //         name: 'IELTS Reading Test Question'
            //     },
            //     ordinalNumber: 0,
            //     subQuestions: [],
            //     questionAnswers: []
            // };
            // item.question = item.question +  (vm.highestOrdinalNumberQuestionForPassage1 + 1);
            // item.ordinalNumber = vm.highestOrdinalNumberQuestionForPassage1 + 1;
            // // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;
            //
            // if(vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions == null){
            //     vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
            //
            // item.questionAnswers = tempAnswers;
            //
            //
            // vm.saveReadingTest();
        };
        


        vm.addAnswerForQuestionForPassage1 = function(index,items,type){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            item.question.id = vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsListeningTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            vm.saveReadingTest();
        };

        vm.addPackageForPassage1 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: []
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = vm.highestOrdinalNumberPackageForPassage1 + 1;

            if(vm.ieltsListeningTest.subQuestions[0].subQuestions == null){
                vm.ieltsListeningTest.subQuestions[0].subQuestions = [];
            }

            vm.ieltsListeningTest.subQuestions[0].subQuestions.push(item);

            vm.saveReadingTest();

        };

        // vm.isStartCreatePassage2 = false;
        vm.startCreatePassage2 = function () {
            // vm.isStartCreatePassage2 = true;
            vm.createPassageNumber = 2;
        };

        //passage 2
        vm.createPackagePassage2 = false;

        vm.startCreateQuestionForPassage2 = function () {
            if(vm.ieltsListeningTest.title == null || vm.ieltsListeningTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };


        // vm.numberFrom = 0;
        // vm.numberTo= 0;

        vm.addQuestionForPassage2 = function (index) {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                return;
            }
            var ordinal = vm.highestOrdinalNumberQuestionForPassage2;
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };

                item.question = item.question +  (ordinal + 1);
                item.ordinalNumber = ordinal + 1;
                ordinal++;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions == null){
                    vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(vm.tempAnswers[j]);
                }

                // item.questionAnswers = tempAnswers;
            }
            vm.saveReadingTest();


            // var item = {
            //     question: 'Question number ',
            //     questionType : {
            //         code: 'IELTSRTQ',
            //         id: 19,
            //         name: 'IELTS Reading Test Question'
            //     },
            //     ordinalNumber: 0,
            //     subQuestions: [],
            //     questionAnswers: []
            // };
            // item.question = item.question +  (vm.highestOrdinalNumberQuestionForPassage2 + 1);
            // item.ordinalNumber = vm.highestOrdinalNumberQuestionForPassage2 + 1;
            // // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;
            //
            // if(vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions == null){
            //     vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsListeningTest.subQuestions[1].subQuestions[index].subQuestions.push(item);
            // // vm.ieltsListeningTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
            // // console.log(a);
            //
            // vm.saveReadingTest();
        };

        vm.addAnswerForQuestionForPassage2 = function(index){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 - vm.highestOrdinalNumberPackageForPassage1;

            item.question.id = vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsListeningTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            vm.saveReadingTest();
        };

        vm.addPackageForPassage2 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: []
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = vm.highestOrdinalNumberPackageForPassage2 + 1;

            if(vm.ieltsListeningTest.subQuestions[1].subQuestions == null){
                vm.ieltsListeningTest.subQuestions[1].subQuestions = [];
            }

            vm.ieltsListeningTest.subQuestions[1].subQuestions.push(item);

            vm.saveReadingTest();

        };

        vm.startCreatePassage3 = function () {
            vm.createPassageNumber = 3;
        };

        //passage 3

        vm.startCreateQuestionForPassage3 = function () {
            if(vm.ieltsListeningTest.title == null || vm.ieltsListeningTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };

        vm.addQuestionForPassage3 = function (index) {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                return;
            }
            var ordinal = vm.highestOrdinalNumberQuestionForPassage3;
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };

                item.question = item.question +  (ordinal + 1);
                item.ordinalNumber = ordinal + 1;
                ordinal++;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsListeningTest.subQuestions[2].subQuestions[index].subQuestions == null){
                    vm.ieltsListeningTest.subQuestions[2].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsListeningTest.subQuestions[2].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(vm.tempAnswers[j]);
                }

                // item.questionAnswers = tempAnswers;
            }
            vm.saveReadingTest();
            
        };

        vm.addAnswerForQuestionForPassage3 = function(index){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            vm.highestOrdinalNumberPackageForPassage3 = vm.highestOrdinalNumberPackageForPassage3 - vm.highestOrdinalNumberPackageForPassage2;

            item.question.id = vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].id;

            if(vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsListeningTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            vm.saveReadingTest();
        };

        vm.addPackageForPassage3 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: []
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = vm.highestOrdinalNumberPackageForPassage3 + 1;

            if(vm.ieltsListeningTest.subQuestions[2].subQuestions == null){
                vm.ieltsListeningTest.subQuestions[2].subQuestions = [];
            }

            vm.ieltsListeningTest.subQuestions[2].subQuestions.push(item);

            vm.saveReadingTest();

        };

        vm.startCreatePassage4 = function () {
            vm.createPassageNumber = 4;
        };

        //passage 4

        vm.startCreateQuestionForPassage4 = function () {
            if(vm.ieltsListeningTest.title == null || vm.ieltsListeningTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };

        vm.addQuestionForPassage4 = function (index) {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                return;
            }
            var ordinal = vm.highestOrdinalNumberQuestionForPassage4;
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSLTQ',
                        id: 30,
                        name: 'IELTS Listening Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };

                item.question = item.question +  (ordinal + 1);
                item.ordinalNumber = ordinal + 1;
                ordinal++;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsListeningTest.subQuestions[3].subQuestions[index].subQuestions == null){
                    vm.ieltsListeningTest.subQuestions[3].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsListeningTest.subQuestions[3].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(vm.tempAnswers[j]);
                }

                // item.questionAnswers = tempAnswers;
            }
            vm.saveReadingTest();

        };

        vm.addAnswerForQuestionForPassage4 = function(index){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            vm.highestOrdinalNumberPackageForPassage4 = vm.highestOrdinalNumberPackageForPassage4 - vm.highestOrdinalNumberPackageForPassage3;

            item.question.id = vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].id;

            if(vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsListeningTest.subQuestions[4].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsListeningTest.subQuestions[3].subQuestions[vm.highestOrdinalNumberPackageForPassage4 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            vm.saveReadingTest();
        };

        vm.addPackageForPassage4 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSLTQ',
                    id: 29,
                    name: 'IELTS Listening Test Package'
                },
                ordinalNumber: 0,
                subQuestions: []
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = vm.highestOrdinalNumberPackageForPassage4 + 1;

            if(vm.ieltsListeningTest.subQuestions[3].subQuestions == null){
                vm.ieltsListeningTest.subQuestions[3].subQuestions = [];
            }

            vm.ieltsListeningTest.subQuestions[3].subQuestions.push(item);

            vm.saveReadingTest();

        };

        var _timeoutReading;
        vm.changeInTheProcessOfCreatingReadingTest = function (q) {
            console.log(q);
            if(_timeoutReading){ //if there is already a timeout in process cancel it
                $timeout.cancel(_timeoutReading);
            }
            _timeoutReading = $timeout(function(){
                vm.saveReadingTest();
                _timeoutReading = null;
            },10000);
        };


        $scope.tinymceOptionsToCreateQuestionForReadingTest = {
            height: 100,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            // selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify | removeformat',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinymceOptionsToCreateQuestionForReadingTestPassage = {
            height: 1000,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image media link'
            ],
            toolbar1: 'media link | image | alignleft aligncenter alignright alignjustify | removeformat',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
        
            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinyConFigQuestion = {
            height: 200,
            theme: 'modern',
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'table | bold underline italic | forecolor backcolor  | removeformat | bullist numlist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.bsTableControlCreateIELTSReadingTest = {
            options: {
                data: vm.ieltsListeningTests,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.searchDto.pageSize,
                pageList: [10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinitionCreateIELTSListeningTest(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedQuestions.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedQuestions = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedQuestions.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedQuestions = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    vm.searchDto.pageSize = pageSize;
                    vm.searchDto.pageIndex = index;
                    vm.getPageCreateIELTSReadingTest();
                }
            }
        };

        $scope.deleteObject = function (id) {
            console.log(id);
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    console.log(vm.selectedQuestions);
                    service.deleteObject(id, function success() {
                        toastr.info('Bạn đã xóa thành công', 'Thông báo');
                        $scope.editCreateIELTSReadingTest(vm.ieltsListeningTest.id);
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
                    });
                }
            }, function () {
            });
        };
        //--------------------- End Create Reading test -------------------------//

    }

})();