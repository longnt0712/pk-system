/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('QuestionController', QuestionController);

    QuestionController.$inject = [
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
    
    /**
     * Filters an array of drop effects using a HTML5 effectAllowed string.
     */
    function filterEffects(effects, effectAllowed) {
        if (effectAllowed == 'all') return effects;
        return effects.filter(function(effect) {
            return effectAllowed.toLowerCase().indexOf(effect) != -1;
        });
    }

    angular.module('Hrm.Question').directive('inputFieldSelection', function(){
        return{
            restrict: 'A',
            scope:{
                onSelected: '='
            },
            link:function(scope, elem, attrs){
                elem.on('select', function(){
                    var text = elem.val().substring(elem.prop('selectionStart'),
                        elem.prop('selectionEnd'));
                    scope.onSelected(text);
                });

                elem.on('blur', function(){ scope.onSelected('') });
                elem.on('keydown', function(){ scope.onSelected('')});
                elem.on('mousedown', function(){ scope.onSelected('')  });
            }
        }
    });

    // angular.module('Hrm.Question').directive('draggable', function () {
    //     return {
    //         restrict: 'A',
    //         link: function (scope, element, attrs) {
    //             element[0].addEventListener('dragstart', scope.handleDragStart, false);
    //             element[0].addEventListener('dragend', scope.handleDragEnd, false);
    //         }
    //     }
    // });
    //
    // angular.module('Hrm.Question').directive('droppable', function () {
    //     return {
    //         restrict: 'A',
    //         link: function (scope, element, attrs) {
    //             element[0].addEventListener('drop', scope.handleDrop, false);
    //             element[0].addEventListener('dragover', scope.handleDragOver, false);
    //         }
    //     }
    // });

    angular.module('Hrm.Question').directive('myDraggable', ['$document', function($document) {
        return {
            link: function(scope, element, attr) {
                var startX = 0, startY = 0, x = 0, y = 0;

                element.css({
                    position: 'absolute',
                    // border: '1px solid red',
                    // backgroundColor: 'lightgrey',
                    cursor: 'all-scroll'
                    // 'z-index': 2
                });

                element.on('mousedown', function(event) {
                    // Prevent default dragging of selected content
                    // event.preventDefault();
                    startX = event.pageX - x;
                    startY = event.pageY - y;
                    $document.on('mousemove', mousemove);
                    $document.on('mouseup', mouseup);
                });

                function mousemove(event) {
                    y = event.pageY - startY;
                    x = event.pageX - startX;
                    element.css({
                        top: y + 'px',
                        left:  x + 'px'
                    });
                }

                function mouseup() {
                    $document.off('mousemove', mousemove);
                    $document.off('mouseup', mouseup);
                }

            }
        };
    }]);


    // angular.module('Hrm.Question').directive('draggable', ['$document', function($document) {
    //     return {
    //         restrict: 'A',
    //         link: function(scope, elm, attrs) {
    //             var startX, startY, initialMouseX, initialMouseY;
    //             elm.css({ position: 'absolute' });
    //
    //             elm.bind('mousedown', function($event) {
    //                 startX = elm.prop('offsetLeft');
    //                 startY = elm.prop('offsetTop');
    //                 initialMouseX = $event.clientX;
    //                 initialMouseY = $event.clientY;
    //                 $document.bind('mousemove', mousemove);
    //                 $document.bind('mouseup', mouseup);
    //                 return false;
    //             });
    //
    //             function mousemove($event) {
    //                 var dx = $event.clientX - initialMouseX;
    //                 var dy = $event.clientY - initialMouseY;
    //                 elm.css({
    //                     top: startY + dy + 'px',
    //                     left: startX + dx + 'px'
    //                 });
    //                 return false;
    //             }
    //
    //             function mouseup() {
    //                 $document.unbind('mousemove', mousemove);
    //                 $document.unbind('mouseup', mouseup);
    //             }
    //         }
    //     };
    // }]);

    angular.module('Hrm.Question').directive('compile', ['$compile', function ($compile) {
        return function(scope, element, attrs) {
            scope.$watch(
                function(scope) {
                    return scope.$eval(attrs.compile);
                },
                function(value) {
                    element.html(value);
                    $compile(element.contents())(scope);
                }
            )};
    }]);

    angular.module('Hrm.Question').directive('cellHighlight', function() {
        return {
            restrict: 'C',
            link: function postLink(scope, iElement, iAttrs) {
                iElement.find('td')
                    .mouseover(function() {
                        $(this).parent('tr').css('opacity', '0.7');
                    }).mouseout(function() {
                    $(this).parent('tr').css('opacity', '1.0');
                });
            }
        };
    });

    angular.module('Hrm.Question').directive('context', [

        function() {
            return {
                restrict: 'A',
                scope: '@&',
                compile: function compile(tElement, tAttrs, transclude) {
                    return {
                        post: function postLink(scope, iElement, iAttrs, controller) {
                            var ul = $('#' + iAttrs.context),
                                last = null;

                            ul.css({
                                'display': 'none'
                            });
                            $(iElement).bind('contextmenu', function(event) {
                                event.preventDefault();
                                ul.css({
                                    position: "fixed",
                                    display: "block",
                                    left: event.clientX + 'px',
                                    top: event.clientY + 'px'
                                });
                                last = event.timeStamp;
                            });
                            //$(iElement).click(function(event) {
                            //  ul.css({
                            //    position: "fixed",
                            //    display: "block",
                            //    left: event.clientX + 'px',
                            //    top: event.clientY + 'px'
                            //  });
                            //  last = event.timeStamp;
                            //});

                            $(document).click(function(event) {
                                var target = $(event.target);
                                if (!target.is(".popover") && !target.parents().is(".popover")) {
                                    if (last === event.timeStamp)
                                        return;
                                    ul.css({
                                        'display': 'none'
                                    });
                                }
                            });
                        }
                    };
                }
            };
        }
    ]);

    // Rightclick directive
    angular.module('Hrm.Question').directive('ngRightClick', function($parse) {
        return function(scope, element, attrs) {
            var fn = $parse(attrs.ngRightClick);
            element.bind('contextmenu', function(event) {
                scope.$apply(function() {
                    event.preventDefault();
                    fn(scope, {$event:event});
                });
            });
        };
    });

    function QuestionController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
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
        console.log(vm.currentUser);
        vm.question = {};
        vm.questions = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};
        vm.answer = null;
        vm.answers = [];

        vm.type = {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"};
        vm.types = [
            {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 2, name: "Filling Gaps", notice: "Fill words in gaps"},
            {id: 3, name: "Filling Gaps Enter", notice: "Fill A-G in gaps"},
            {id: 4, name: "Matching Heading", notice: "Drag and Drop"}
        ];
        //1:writing; 2: wimpy kid; 3: idiom - expression; 4: other

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

        vm.ieltsReadingTests = [];
        vm.ieltsReadingTest = {
            questionType: {
                code: 'IELTSRT',
                id: 11,
                name: 'IELTS Writing Test',
                textSearch: null
            },
            type: 0,
            status: 1,
            questionTopics: [],
            countWords: 0,
            ordinalNumber: 1,
            subQuestions: []
        };  //create a new test

        vm.getPageCreateIELTSReadingTest = function () {
            vm.searchDto.questionType = {id: 11};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.ieltsReadingTests = data.content;
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsReadingTests;
                vm.bsTableControlCreateIELTSReadingTest.options.totalRows = data.totalElements;
                // x.focus();
                console.log(vm.ieltsReadingTests);

            });
        };

        vm.getPageFlashCard = function () {
            vm.searchDto.questionType = {id: 6};
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                vm.questions = data.content;
                vm.bsTableControl.options.data = vm.questions;
                vm.bsTableControl.options.totalRows = data.totalElements;
                // console.log(vm.questions);
                vm.searchDto.totalItems = data.totalElements;
                vm.currentCard = vm.questions[vm.currentPosition];
                if (vm.isFlashCardMode == 1) {
                    vm.doShuffle();
                }


            });
        };

        vm.getPageIELTSWriting = function () {
            vm.searchDto.questionType = {id: 7};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.writingQuestions = data.content;
                vm.bsTableControlIELTSWriting.options.data = vm.writingQuestions;
                vm.bsTableControlIELTSWriting.options.totalRows = data.totalElements;
                // x.focus();
                // console.log(vm.writingQuestions);

            });
        };

        vm.getPageCreateIELTSWritingTest = function () {
            vm.searchDto.questionType = {id: 10};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.ieltsWritingTests = data.content;
                vm.bsTableControlCreateIELTSWritingTest.options.data = vm.ieltsWritingTests;
                vm.bsTableControlCreateIELTSWritingTest.options.totalRows = data.totalElements;
                // x.focus();
                // console.log(vm.writingQuestions);

            });
        };


        vm.listFlashCard = 0;
        vm.listFlashCard = $stateParams.listFlashCard;
        vm.isFlashCardMode = $stateParams.flashCardModeId | 0; // flashCardModeId = 1 => in this mode.

        if (vm.listFlashCard == 3 || vm.isFlashCardMode == 1) {
            if (vm.isFlashCardMode == 1) {
                vm.searchDto.pageSize = 100000000;
            }
            console.log('listFlashCard');
            vm.getPageFlashCard();
        }

        if (vm.listFlashCard == 3 || vm.isFlashCardMode == 1) {
            console.log('listFlashCard');
            vm.getPageFlashCard();
        }

        if ($stateParams.writingCollectionMode == 2) {
            console.log('IELTSWriting');
            vm.searchDto.pageSize = 3;
            vm.getPageIELTSWriting();
        }

        if ($stateParams.writingCollectionMode == 2) {
            console.log('IELTSWriting');
            vm.searchDto.pageSize = 3;
            vm.getPageIELTSWriting();
        }

        if ($stateParams.createIeltsWritingTest == 5) {
            console.log('Create IELTSWriting');
            vm.searchDto.pageSize = 10;
            vm.getPageCreateIELTSWritingTest();
        }

        if ($stateParams.createIeltsReadingTest == 6) {
            console.log('Create IELTS Reading');
            vm.searchDto.pageSize = 10;
            vm.getPageCreateIELTSReadingTest();
        }

        if ($stateParams.ieltsReadingActualTest == 7) {
            console.log('IELTS Reading Actual Test');
            vm.searchDto.pageSize = 10;
            console.log($stateParams.ieltsReadingTestId);
            if ($stateParams.ieltsReadingTestId != null) {
                service.getOne($stateParams.ieltsReadingTestId).then(function (data) {
                    vm.ieltsReadingActualTest = data;
                    vm.getOrdinalNumber(data);

                    function secondCallFunction(ieltsReadingActualTest) {
                        var timeout;
                        timeout = $timeout(function(){
                            var questionNumber = '';
                            for(var k = 0; k < vm.ieltsReadingActualTest.subQuestions.length; k++){
                                for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions[k].subQuestions.length; i++) {
                                    for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                                        if (vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].type == 2) {
                                            questionNumber = vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber + ' ';
                                            // vm.addFields(vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber);
                                            // console.log(questionNumber);
                                        }
                                    }
                                }
                            }
                            // alert(questionNumber);
                            timeout = null;
                        },0);
                    }

                    function firstCallFunction(myCallback) {
                        var timeout;
                        timeout = $timeout(function(){
                            vm.ieltsReadingActualTest = vm.processQuestionATT(data);
                            myCallback(vm.ieltsReadingActualTest);
                        },0);
                    }

                    firstCallFunction(secondCallFunction);


                    // console.log(data);
                }, function failure() {
                    toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                });
            }
        }

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

        vm.totalItems = 0;
        vm.pageIndexAnswer = 1;
        vm.pageSizeAnswer = 2;
        vm.searchDtoAnswer = {};
        vm.questionTypes = [];
        vm.getAnswers = function () {
            service.getAnswers(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.answers = data.content;
                vm.totalItems = data.totalElements;
            });
        };

        vm.questionTypeFlashCard = {};
        vm.getQuestionTypes = function () {
            service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.questionTypes = data.content;
                vm.question.questionType = vm.questionTypes[0];

            });
        };


        //----------------------- Flash Card -------------------------//
        vm.topics = [];
        vm.topic = {};
        vm.getTopics = function () {
            service.getTopics(vm.searchDto,1, 10000).then(function (data) {
                vm.topics = data.content;
                // console.log(vm.topics);
            });
        };
        vm.getTopics();

        vm.loadMore = function () {
            vm.searchDto.pageSize = vm.searchDto.pageSize + 30;
            vm.getPageFlashCard();
        };

        vm.doShuffle = function() {
            shuffleArray(vm.questions);
            vm.currentPosition = 0;
            vm.currentCard = vm.questions[vm.currentPosition];
            vm.isShowDetail = false;
            // console.log('...');
        };

        // -> Fisher–Yates shuffle algorithm
        var shuffleArray = function(array) {
            var m = array.length, t, i;

            // While there remain elements to shuffle
            while (m) {
                // Pick a remaining element…
                i = Math.floor(Math.random() * m--);

                // And swap it with the current element.
                t = array[m];
                array[m] = array[i];
                array[i] = t;
            }

            return array;
        };

        vm.selectType = function () {
            // console.log(vm.question);
        };

        vm.enterSearchCode = function(){
            // console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.codeChange();
            }
        };

        vm.codeChange=function () {
            vm.pageIndex = 1;
            // vm.bsTableControl.state.pageNumber.state = 1;
            if(vm.listFlashCard == 3 || vm.isFlashCardMode == 1){
                console.log('listFlashCard');
                vm.getPageFlashCard();
            }

            if($stateParams.writingCollectionMode == 2){
                console.log('IELTSWriting');

                vm.getPageIELTSWriting();
            }
        };

        vm.newCard = {
            questionType : {
                code: 'FC',
                id: 6,
                name: 'Flash card',
                textSearch: null
            },
            status : 1,
            questionTopics: []
        };
        vm.selectedTopicToAdd = [];
        vm.selectedTopicToSearch= [];
        vm.selectedTopicToEdit = [];

        function pushTopic(selectedTopics) {
            if(selectedTopics == null){
                return;
            }

            var questionTopics = [];

            for(var i = 0; i < selectedTopics.length; i++){
                var questionTopic = {};
                questionTopic.topic = selectedTopics[i];
                questionTopics.push(questionTopic);
            }

            return questionTopics;
        }

        function getListTopicFromCard(questionTopics) {
            if(questionTopics == null){
                return;
            }

            var topics = [];

            for(var i = 0; i < questionTopics.length; i++){
                var topic = {};
                topics.push(questionTopics[i].topic);
            }

            return topics;
        }

        vm.topicChange = function () {

            vm.newCard.questionTopics = pushTopic(vm.selectedTopicToAdd);

            vm.currentCard.questionTopics = pushTopic(vm.selectedTopicToEdit);

        };

        vm.searchTopicChange = function () {
            vm.searchDto.questionTopics = pushTopic(vm.selectedTopicToSearch);
            vm.getPageFlashCard();
        };

        vm.newFlashCard = function () {
            service.saveObject(vm.newCard, function success() {
                vm.getPageFlashCard();
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.newCard = {
                    questionType : {
                        code: 'FC',
                        id: 6,
                        name: 'Flash card',
                        textSearch: null
                    },
                    status : 1,
                    questionTopics: []
                };
                vm.selectedTopicToAdd = [];
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });

        };

        vm.editFlashCard = function (id) {
            service.getOne(id).then(function (data) {
                vm.currentCard = data;
                console.log(vm.currentCard);
                vm.selectedTopicToEdit = getListTopicFromCard(vm.currentCard.questionTopics);

                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_flash_card_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.currentCard, function success() {

                            vm.getPageFlashCard();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.currentCard = {};
                        }, function failure() {
                            console.log(vm.currentCard);

                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    // vm.currentCard = {};
                });
            });
        };

        vm.myAnswer = '';
        // vm.clickAnswer = false;
        vm.flashCard = {};
        vm.answer = false;
        vm.reviewFlashCard = function () {
            vm.isReviewMode = true;

            vm.answer = false;
            vm.myAnswer = '';
            vm.flashCard = {};
            service.getRandomQuestion(vm.searchDto).then(function (data) {
                vm.question = data;
                vm.flashCard = vm.question;
                vm.showExamples = false;
                vm.showPronunciation = false;
                vm.question.isNew = false;


                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'review_flash_card_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        // if(vm.myAnswer == vm.question.question){
                        //     vm.question.timeReviewed = vm.question.timeReviewed++;
                        //     vm.question.correctAnswer = vm.question.correctAnswer++;
                        //         service.saveObject(vm.question, function success() {
                        //
                        //         toastr.info('À ghê!!!', 'Cũng kinh đấy :)');
                        //         vm.question = {};
                        //     }, function failure() {
                        //             console.log(vm.question);
                        //             toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        //     });
                        // }
                        // if(vm.myAnswer != vm.question.question){
                        //     vm.question.timeReviewed = vm.question.timeReviewed++;
                        //     vm.question.wrongAnswer = vm.question.wrongAnswer++;
                        //     service.saveObject(vm.question, function success() {
                        //
                        //         // vm.getPageFlashCard();
                        //         toastr.warning('Sai cmnr!!!', 'Vãiii');
                        //         vm.question = {};
                        //     }, function failure() {
                        //         console.log(vm.question);
                        //         toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        //     });
                        // }
                    }
                }, function () {
                    vm.question = {};
                });
            });
        };

        vm.clickNextInMode = function () {
            vm.answer = false;
            vm.myAnswer = '';
            vm.flashCard = {};
            service.getRandomQuestion(vm.searchDto).then(function (data) {
                vm.question = data;
                vm.flashCard = vm.question;
                vm.showExamples = false;
                vm.showPronunciation = false;
                vm.question.isNew = false;
            });
        };

        vm.clickAnswer = function () {
            console.log(vm.flashCard);
            if(vm.myAnswer.toLowerCase().trim() == vm.flashCard.question.toLowerCase()){
                vm.flashCard.timeReviewd = vm.flashCard.timeReviewd + 1;
                vm.flashCard.correctAnswer = vm.flashCard.correctAnswer + 1;
                console.log(vm.flashCard);
                vm.answer = true;
                service.saveObject(vm.flashCard, function success() {

                    toastr.info('À ghê!!!', 'Cũng kinh đấy :)');
                    service.getOne(vm.flashCard.id).then(function (data) {
                        vm.question = data;
                    });
                }, function failure() {
                    console.log(vm.question);
                    toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                });
            }
            if(vm.myAnswer.toLowerCase().trim() != vm.flashCard.question.toLowerCase()){
                vm.flashCard.timeReviewd = vm.flashCard.timeReviewd + 1;
                vm.flashCard.wrongAnswer = vm.flashCard.wrongAnswer + 1;
                vm.answer = false;
                service.saveObject(vm.flashCard, function success() {

                    // vm.getPageFlashCard();
                    toastr.warning('Sai cmnr!!!', 'Vãiii');
                    service.getOne(vm.flashCard.id).then(function (data) {
                        vm.question = data;
                    });
                }, function failure() {
                    console.log(vm.question);
                    toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                });
            }
        };

        vm.showPronunciation = false;
        vm.isShowPronunciation = function () {
            console.log('show');
            vm.showPronunciation = true;
        };
        vm.showExamples = false;

        vm.isShowExamples = function () {
            console.log('show');
            vm.showExamples = true;
        };

        function showBackFlashCard(text) {
            const notification = new Notification("Back: " + text,{
                // body: text
            });

        }

        function showNotification() {
            // console.log(vm.type.id);
            service.getRandomQuestion(vm.searchDto).then(function (data) {
                vm.question = data;
                var question = vm.question.question + " " + vm.question.pronounce;
                var description = '';
                // if ((vm.question.description == null) || (vm.question.description == '')){
                    description = vm.question.description.replace( /(<([^>]+)>)/ig, '');
                // }
                const notification = new Notification("Front: " + question,{
                });

                notification.onclick = function(event) {
                    event.preventDefault(); // prevent the browser from focusing the Notification's tab
                    const notification2 = new Notification("Back: ",{
                        body: description
                    });
                };

                // var x = setTimeout(showBackFlashCard(description),10000);

                // clearTimeout(x);
            });

        }

        vm.isReviewMode = false;
        vm.startNoti = function () {
            var idInterval;

            toastr.info('Start Noti', 'Thông báo');


            if(Notification.permission === "granted") {
                // showNotification();
                // console.log(123);
                // setTimeout(showNotification,500);
                idInterval = setInterval(showNotification,36000);
            } else if (Notification.permission !== "denied"){
                Notification.requestPermission().then(function (permission) {
                    if(permission === "granted"){
                        // showNotification();
                        // setTimeout(showNotification,300000);
                        // setInterval(showNotification,500);
                    }
                });
            }

            clearInterval(idInterval);

            setInterval(showNotification,36000);


        };

        // var idInterval;

        // if(Notification.permission === "granted") {
        //     // showNotification();
        //     // console.log(123);
        //     // setTimeout(showNotification,500);
        //     idInterval = setInterval(showNotification,36000);
        // } else if (Notification.permission !== "denied"){
        //     Notification.requestPermission().then(function (permission) {
        //         if(permission === "granted"){
        //             // showNotification();
        //             // setTimeout(showNotification,300000);
        //             // setInterval(showNotification,500);
        //         }
        //     });
        // }

        vm.statusChange = function () {
            vm.question.status = vm.status.id;
            vm.searchDto.status = vm.status.id;
            vm.getPageFlashCard();
            console.log(vm.question);
        };

        vm.clickNext = function () {
            if(vm.currentPosition <= vm.questions.length){
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
            }
        };

        vm.clickBack = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
            }
        };

        vm.isShowDetail = false;
        vm.showDetails = function () {
            vm.isShowDetail = true;
        };


        $scope.tinymceOptions = {
            height: 70,
            theme: 'modern',
            plugins: [
                'lists fullscreen' //autoresize
            ],
            toolbar1: 'bold underline italic | removeformat | bullist numlist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.tinymceOptionsToReview = {
            height: 130,
            theme: 'modern',
            plugins: [
                'lists fullscreen' //autoresize
            ],
            toolbar1: 'bold underline italic | removeformat | bullist numlist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        //------------------ End Flash Card ---------------------------------//



        vm.bsTableControl = {
            options: {
                data: vm.questions,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.pageSize,
                pageList: [5, 10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinition(),
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
                    vm.pageSize = pageSize;
                    vm.pageIndex = index;
                    vm.getPageFlashCard();
                }
            }
        };

        /**
         * New event account
         */
        vm.newObject = function () {

            vm.question.isNew = true;
            vm.question.questionType = vm.questionTypes[0];

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'lg'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {

                    service.saveObject(vm.question, function success() {
                        vm.getPageFlashCard();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.question = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.question = {};
            });
        };


        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.question = data;
                vm.question.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'lg'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.question, function success() {
                            console.log(vm.question);
                            vm.getPageFlashCard();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.question = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.question = {};
                });
            });
        };


        /**
         * Delete accounts
         */
        $scope.deleteObject = function (id) {
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
                        vm.getPageFlashCard();
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
                    });
                }
            }, function () {
            });
        };

        vm.addAnswer = function (item) {
            var q = {};
            q.answer = {};
            q.answer = item;
            if(angular.isUndefined(vm.question.questionAnswers) || vm.question.questionAnswers == null || vm.question.questionAnswers.length <= 0){
                vm.question.questionAnswers = [];
            }
            var dup = false;
            for(var i = 0; i < vm.question.questionAnswers.length; i++){
                if(vm.question.questionAnswers[i].answer.id == item.id){
                    dup = true;
                }
            }
            if(!dup){
                vm.question.questionAnswers.push(q);
            }
            q = null;
        };
        vm.deleteAnswer = function (index) {
            vm.question.questionAnswers.splice(index,1);
        };


        // vm.totalItems = 0;
        // vm.pageIndexAnswer = 1;
        // vm.pageSizeAnswer = 2;
        // vm.searchDtoAnswer = {};
        vm.textSearch = '';
        vm.searchByCode = function () {
            vm.textSearch = String(vm.textSearch).trim();
            if (vm.textSearch != '') {
                vm.searchDtoAnswer.textSearch = vm.textSearch;
                vm.getAnswers();
            }
            if (vm.textSearch == '') {
                vm.searchDtoAnswer.textSearch = '';
                vm.getAnswers();
            }
        };

        // vm.enterSearchCode = function(){
        //     vm.pageIndexUser = 0;
        //     if(event.keyCode == 13){//Phím Enter
        //         vm.searchByCode();
        //     }
        // };

        //permission
        // console.log(Notification.permission);

        //---------------------- IELTS Writing ---------------------------//


        $scope.counter = 3600;
        $scope.minuteDisplay = 60;
        $scope.secondDisplay = 60;
        var mytimeout = null; // the current timeoutID
        var audio = document.getElementById("audio1");


        // actual timer method, counts down every second, stops on zero
        $scope.onTimeout = function() {
            if($scope.counter ===  0 || $scope.counter < 0) {
                $scope.counter = 0;
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            $scope.counter--;
            $scope.minuteDisplay = parseInt($scope.counter/60);
            $scope.secondDisplay = $scope.counter%60;
            // if($scope.counter == 60){
            //     // var audio = document.getElementById("audio1");
            //     audio.load();
            //     audio.play();
            // }
            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        $scope.startCount = function() {
            $scope.refreshTimer();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            // audio.load();
        };

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            $scope.counter = 3600;
        };

        $scope.startCount();

        $scope.tinymceOptionsToQuestion = {
            height: 100,
            theme: 'modern',
            selector: '#tiny-question',
            // auto_focus: true,
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image ',
            // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
            // autoresize_bottom_margin: 0,
            statusbar: false,
            image_advtab: true,
            menubar: false
        };
        
        $scope.tinymceOptionsToAnswer = {
            height: 460,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'wordcount print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'bold italic underline strikethrough removeformat | fontsize | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image ',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
        
            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        // tinymce.init({
        //     height: 500,
        //     // placeholder: "Ask a question or post an update...",
        //     // selector: 'textarea',
        //     selector: '#tiny-answer',
        //     theme: 'modern',
        //     // selector: 'div',
        //     // auto_focus: true,
        //     plugins: [
        //         ' print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
        //     ],
        //     toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image',
        //     content_css: [
        //         '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
        //         '/assets/css/tinymce_content.css'
        //     ],
        //
        //     // autoresize_bottom_margin: 0,
        //     statusbar: false,
        //     menubar: false,
        //    
        // });
        //
        // tinymce.init({
        //     height: 100,
        //     theme: 'modern',
        //     selector: '#tiny-question',
        //     // auto_focus: true,
        //     plugins: [
        //         'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
        //     ],
        //     toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent ',
        //     // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
        //     // autoresize_bottom_margin: 0,
        //     statusbar: false,
        //     image_advtab: true,
        //     menubar: false
        // });

        // var a = tinymce.execCommand('mceInsertContent',false,'<b>Hello world!!</b>');return false;


        // console.log($scope.tinyMCE);

        vm.writingQuestions = [];
        vm.selectedTopicToAddIELTSWriting = [];
        vm.selectedTopicToSearchIELTSWriting = [];
        vm.isNewWriting = true;
        vm.newWritingQuestion = {
            questionType : {
                code: 'IELTSW',
                id: 7,
                name: 'IELTS Writing',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0
        };


        // vm.test = function () {
        //     console.log(1);
        //     window.tinyMCE.get('tiny-answer').execCommand('mceFocus',false);
        // };
        // var x = document.getElementById('tiny-answer');


        // console.log(x);
        // window.tinyMCE.get('tiny-answer').execCommand('mceFocus',false);

        vm.saveIELTSWriting= function () {
            // console.log(x);
            // blockUI.start();
            if(validateSaveIELTSWriting(vm.newWritingQuestion) == true){
                service.saveObject(vm.newWritingQuestion, function success() {
                    // blockUI.stop();
                    if(vm.isNewWriting == false) {


                        vm.timeEdited = '';
                        var date = new Date();

                        vm.timeEdited = date.getDay() + '/' + date.getMonth() + '/' + date.getYear() + ' '  + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();


                    }

                    // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                    if(vm.isNewWriting == true){
                        vm.newWritingQuestion = {
                            questionType : {
                                code: 'IELTSW',
                                id: 7,
                                name: 'IELTS Writing',
                                textSearch: null
                            },
                            status : 1,
                            questionTopics: [],
                            countWords : 0
                        };
                        vm.selectedTopicToAddIELTSWriting = [];
                    }
                    // vm.getPageIELTSWriting();
                }, function failure() {
                    toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                }, function complete() {
                    toastr.error('a', 'Thông báo');
                });
            }
        };

        vm.cancelEditingIELTSWriting = function () {
            vm.newWritingQuestion = {
                questionType : {
                    code: 'IELTSW',
                    id: 7,
                    name: 'IELTS Writing',
                    textSearch: null
                },
                status : 1,
                questionTopics: [],
                countWords : 0
            };
            vm.selectedTopicToAddIELTSWriting = [];
            vm.isNewWriting = true;
        };

        vm.bsTableControlIELTSWriting = {
            options: {
                data: vm.writingQuestions,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.searchDto.pageSize,
                pageList: [3, 10, 30, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinition(),
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
                    vm.getPageIELTSWriting();
                }
            }
        };

        vm.searchTopicIELTSWritingChange = function () {
            vm.searchDto.questionTopics = pushTopic(vm.selectedTopicToSearchIELTSWriting);
            vm.getPageIELTSWriting();
        };

        vm.topicIELTSWritingToAddChange = function () {

            vm.newWritingQuestion.questionTopics = pushTopic(vm.selectedTopicToAddIELTSWriting);
            vm.changeIELTSWritingGeneral();
            // vm.currentCard.questionTopics = pushTopic(vm.selectedTopicToEdit);

        };

        // vm.statusChange = function () {
        //     vm.newWritingQuestion.status = vm.status.id;
        //     vm.searchDto.status = vm.status.id;
        //     vm.getPageFlashCard();
        //     console.log(vm.question);
        // };

        // vm.isNewWriting = true;
        $scope.editIELTSWriting= function (id) {
            vm.isNewWriting = false;
            service.getOne(id).then(function (data) {
                // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.newWritingQuestion = data;
                vm.selectedTopicToAddIELTSWriting = getListTopicFromCard(vm.newWritingQuestion.questionTopics);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };


        vm.newWritingQuestion.description = '';
        vm.writingTextForCount = '';
        vm.newWritingQuestion.countWords = 0;
        // vm.fontSize = 18;

        vm.selectedTopicToAddIELTSWritingChange = function () {
            vm.newWritingQuestion.questionTopics = [];
            vm.newWritingQuestion.questionTopics = pushTopic(vm.selectedTopicToAddIELTSWriting);
            vm.changeIELTSWritingGeneral();
        };
        
        vm.onTextChange = function () {

            vm.writingTextForCount = vm.newWritingQuestion.description;
            vm.writingTextForCount = vm.writingTextForCount.replace(/\s{2,}/g, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/<[^>]+>/gm, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/&nbsp;/g, '');
            // vm.writingTextForCount = vm.writingTextForCount.replace(' rsquo ', '');

            vm.writingTextForCount = vm.writingTextForCount.replace(/[`’~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/\r?\n|\r/g, ' ').trim();

            console.log(vm.writingTextForCount);
            var myArr = vm.writingTextForCount.split(' ');

            console.log(myArr);

            if(myArr.length == 1 && vm.writingTextForCount == ''){
                vm.newWritingQuestion.countWords = 0
            }else{
                var count = 0;
                var c = 0;
                for(var i = 0; i < myArr.length; i++){
                    if(myArr[i] != ''){
                        count = count + 1;
                    }else {
                        c = c + 1;

                    }

                    // if(myArr == ""){
                    //     console.log('haha');
                    // }
                }
                console.log(c + ' và ' + count + ' và ' + (c + count));
                vm.newWritingQuestion.countWords = count;
            }

            // console.log(vm.newWritingQuestion.countWords);

            vm.changeIELTSWritingGeneral();
        };

        

        var _timeout;

        vm.changeIELTSWritingGeneral = function () {
            if(_timeout){ //if there is already a timeout in process cancel it
                $timeout.cancel(_timeout);
            }
            _timeout = $timeout(function(){
                vm.saveIELTSWriting();
                _timeout = null;
            },2000);
        };


        function validateSaveIELTSWriting(object) {
            if(object.title == null){
                toastr.warning('Bạn hãy nhập title đầu tiên để bản ghi được tự động lưu.', 'Thông báo');
                return false;
            }
            return true;
        }
            // setTimeout(function() {
            //     if(vm.isNewWriting == false){
            //         vm.saveIELTSWriting();
            //     }
            // }, 5000);


        $scope.tinymceOptionsToQuestionShowAllIsFalse = {
            height: 460,
            theme: 'modern',
            selector: '#tiny-question',
            // auto_focus: true,
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image ',
            // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
            // autoresize_bottom_margin: 0,
            statusbar: false,
            image_advtab: true,
            menubar: false
        };

        vm.isShowAll = true;
        vm.isShowAllEventChange = function () {
          if(vm.isShowAll == true){
              vm.isShowAll = false;
              
          }  else if(vm.isShowAll == false){
              vm.isShowAll = true;
          }
        };

        //---------------------- END IELTS Writing ---------------------------//

        //--------------------- Actual Writing test -------------------------//

        $scope.tinymceOptionsToActualTestAnswer = {
            height: 550,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinymceOptionsToActualTestQuestion = {
            height: 600,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        if($stateParams.writingActualTestMode == 4){
            vm.isShowAll = false;
        }

        // vm.writingTask1 = {
        //     questionType : {
        //         code: 'IELTSWT1',
        //         id: 8,
        //         name: 'IELTS Writing Task 1',
        //         textSearch: null
        //     },
        //     status : 1,
        //     questionTopics: [],
        //     countWords : 0
        // };
        //
        // vm.writingTask2 = {
        //     questionType : {
        //         code: 'IELTSWT2',
        //         id: 9,
        //         name: 'IELTS Writing Task 2',
        //         textSearch: null
        //     },
        //     status : 1,
        //     questionTopics: [],
        //     countWords : 0
        // };


        var date = new Date();
        vm.createDate = date.getDay() + '/' + date.getMonth() + '/' + date.getYear() + ' '  + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();

        // vm.writingTask1.title = 'Actual Test Task 1 - ' + vm.createDate;
        // vm.writingTask2.title = 'Actual Test Task 2 - ' + vm.createDate;


        
        vm.task = 1;

        vm.changeTask2IELTSWriting = function () {
            vm.task = 2;
        };

        vm.changeTask1IELTSWriting = function () {
            vm.task = 1;
        };



        vm.onTextChangeActualTestTask1 = function () {

            vm.writingTextForCount = vm.writingTask1.description;
            vm.writingTextForCount = vm.writingTextForCount.replace(/\s{2,}/g, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/<[^>]+>/gm, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/&nbsp;/g, '');

            vm.writingTextForCount = vm.writingTextForCount.replace(/[`’~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/\r?\n|\r/g, ' ').trim();

            console.log(vm.writingTextForCount);
            var myArr = vm.writingTextForCount.split(' ');

            console.log(myArr);

            if(myArr.length == 1 && vm.writingTextForCount == ''){
                vm.writingTask1.countWords = 0
            }else{
                var count = 0;
                var c = 0;
                for(var i = 0; i < myArr.length; i++){
                    if(myArr[i] != ''){
                        count = count + 1;
                    }else {
                        c = c + 1;

                    }
                }
                vm.writingTask1.countWords = count;
            }


        };

        vm.onTextChangeActualTestTask2 = function () {

            vm.writingTextForCount = vm.writingTask2.description;
            vm.writingTextForCount = vm.writingTextForCount.replace(/\s{2,}/g, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/<[^>]+>/gm, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/&nbsp;/g, '');

            vm.writingTextForCount = vm.writingTextForCount.replace(/[`’~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
            vm.writingTextForCount = vm.writingTextForCount.replace(/\r?\n|\r/g, ' ').trim();

            console.log(vm.writingTextForCount);
            var myArr = vm.writingTextForCount.split(' ');

            console.log(myArr);

            if(myArr.length == 1 && vm.writingTextForCount == ''){
                vm.writingTask2.countWords = 0
            }else{
                var count = 0;
                var c = 0;
                for(var i = 0; i < myArr.length; i++){
                    if(myArr[i] != ''){
                        count = count + 1;
                    }else {
                        c = c + 1;

                    }
                }
                vm.writingTask2.countWords = count;
            }


        };

        vm.saveIELTSWritingActualTest = function () {

            service.saveObject(vm.writingTask1, function success() {
                vm.writingTask1 = {
                    questionType : {
                        code: 'IELTSWT1',
                        id: 8,
                        name: 'IELTS Writing Task 1',
                        textSearch: null
                    },
                    status : 1,
                    questionTopics: [],
                    countWords : 0
                };



            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            }, function complete() {
                toastr.error('a', 'Thông báo');
            });

            service.saveObject(vm.writingTask2, function success() {
                vm.writingTask2 = {
                    questionType : {
                        code: 'IELTSWT2',
                        id: 9,
                        name: 'IELTS Writing Task 2',
                        textSearch: null
                    },
                    status : 1,
                    questionTopics: [],
                    countWords : 0
                };

            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            }, function complete() {
                toastr.error('a', 'Thông báo');
            });
        };

        //--------------------- End Actual Writing test -------------------------//

        //--------------------- Create Writing test -------------------------//
        // vm.createIELTSWritingTest = $stateParams.ieltsTest;
        // if($stateParams.writingActualTestMode == 4){
        //     vm.isShowAll = false;
        // }



        vm.writingTask1 = {
            questionType : {
                code: 'IELTSWT1',
                id: 8,
                name: 'IELTS Writing Task 1',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0
        };

        vm.writingTask2 = {
            questionType : {
                code: 'IELTSWT2',
                id: 9,
                name: 'IELTS Writing Task 2',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0
        };

        vm.ieltsWritingTest = {
            questionType : {
                code: 'IELTSWT',
                id: 10,
                name: 'IELTS Writing Test',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0,
            subQuestions : []
        };

        vm.isCreateNewIELTSWritingTest = true;


        vm.cancelEditingCreateIELTSWritingTest = function () {
            vm.ieltsWritingTest = {
                questionType : {
                    code: 'IELTSWT',
                    id: 10,
                    name: 'IELTS Writing Test',
                    textSearch: null
                },
                status : 1,
                questionTopics: [],
                countWords : 0,
                subQuestions : []
            };

            vm.writingTask1 = {
                questionType : {
                    code: 'IELTSWT1',
                    id: 8,
                    name: 'IELTS Writing Task 1',
                    textSearch: null
                },
                status : 1,
                questionTopics: [],
                countWords : 0
            };

            vm.writingTask2 = {
                questionType : {
                    code: 'IELTSWT2',
                    id: 9,
                    name: 'IELTS Writing Task 2',
                    textSearch: null
                },
                status : 1,
                questionTopics: [],
                countWords : 0
            };

            vm.isCreateNewIELTSWritingTest = true;
        };
        
        vm.saveCreateIELTSWriting= function () {
            vm.ieltsWritingTest.subQuestions.push(vm.writingTask1);
            vm.ieltsWritingTest.subQuestions.push(vm.writingTask2);
            service.saveObject(vm.ieltsWritingTest, function success() {
                vm.getPageCreateIELTSWritingTest();
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');

                if(vm.isCreateNewIELTSWritingTest == true){
                    vm.cancelEditingCreateIELTSWritingTest();
                }

            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });


        };

        $scope.editCreateIELTSWritingTest= function (id) {
            vm.isCreateNewIELTSWritingTest = false;
            service.getOne(id).then(function (data) {
                // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.ieltsWritingTest = data;
                for(var i = 0; i < vm.ieltsWritingTest.subQuestions.length; i++){
                    if(vm.ieltsWritingTest.subQuestions[i].questionType.code == 'IELTSWT1'){
                        vm.writingTask1 = vm.ieltsWritingTest.subQuestions[i];
                    }
                    if(vm.ieltsWritingTest.subQuestions[i].questionType.code == 'IELTSWT2'){
                        vm.writingTask2 = vm.ieltsWritingTest.subQuestions[i];
                    }
                }
                console.log(data);
                // vm.selectedTopicToAddIELTSWriting = getListTopicFromCard(vm.newWritingQuestion.questionTopics);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        if($stateParams.writingActualTestMode == 4){
            console.log('Actual Test IELTSWriting');
            service.getOne($stateParams.questionId).then(function (data) {
                for(var i = 0; i < data.subQuestions.length; i++){
                    if(data.subQuestions[i].questionType.code == 'IELTSWT1'){
                        vm.writingTask1 = data.subQuestions[i];
                    }
                    if(data.subQuestions[i].questionType.code == 'IELTSWT2'){
                        vm.writingTask2 = data.subQuestions[i];
                    }
                }
                console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        }


        $scope.tinymceOptionsToCreateTestTask1 = {
            height: 600,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinymceOptionsToCreateTestTask2 = {
            height: 150,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.bsTableControlCreateIELTSWritingTest = {
            options: {
                data: vm.ieltsWritingTests,
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
                columns: service.getTableDefinitionCreateIELTSWritingTest(),
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
                    vm.getPageCreateIELTSWritingTest();
                }
            }
        };

        //--------------------- End Writing test -------------------------//

        //--------------------- Create Reading test -------------------------//
        vm.ieltsReadingTests = [];
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

        vm.ieltsReadingTest = {
            questionType : {
                code: 'IELTSRT',
                id: 11,
                name: 'IELTS Reading Test',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0,
            ordinalNumber: 1,
            subQuestions : [
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP1',
                        id: 13,
                        name: 'IELTS Reading Test Passage 1'
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
                        id: 14,
                        name: 'IELTS Reading Test Passage 2'
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
                        id: 15,
                        name: 'IELTS Reading Test Passage 3'
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
                }
            ]
        };  //create a new test
        vm.createPassageNumber = 1;

        vm.saveReadingTest = function () {
            service.saveObject(vm.ieltsReadingTest).then(function (data) {

                vm.ieltsReadingTest = data;
                vm.getOrdinalNumber(data);
                isHavingQuestions(vm.ieltsReadingTest);

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







                // console.log(data);
                vm.getPageCreateIELTSReadingTest();
            }, function success() {
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        function isHavingQuestions (ieltsReadingTest) {
            var passages = ieltsReadingTest.subQuestions;

            if(passages != null){
                if(passages[2].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 3;
                } else if(passages[1].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 2;
                }else if(passages[0].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 1;
                }
                // var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
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

        vm.getOrdinalNumberPassage3 = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage3 = getHighestOrdinalNumber(packagesForPassage3);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 3: ' + vm.highestOrdinalNumberPackageForPassage3);
                    if(packagesForPassage3 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[2].subQuestions.length; i++){
                            var questionsForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage3);

                            if(vm.highestOrdinalNumberQuestionForPassage3 < temp){
                                vm.highestOrdinalNumberQuestionForPassage3 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 3: ' + vm.highestOrdinalNumberQuestionForPassage3);
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

        };

        vm.getOrdinalNumberPassage2 = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage2 = getHighestOrdinalNumber(packagesForPassage2);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 2: ' + vm.highestOrdinalNumberPackageForPassage2);
                    if(packagesForPassage2 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[1].subQuestions.length; i++){
                            var questionsForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions[i].subQuestions;
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
            vm.getOrdinalNumberPassage3(ieltsReadingTest);
        };

        vm.getOrdinalNumber = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage1 = getHighestOrdinalNumber(packagesForPassage1);
                    console.log('highest orinal number packages for passage 1: ' + vm.highestOrdinalNumberPackageForPassage1);
                    if(packagesForPassage1 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[0].subQuestions.length; i++){
                            var questionsForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions[i].subQuestions;
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
            vm.getOrdinalNumberPassage2(ieltsReadingTest);
        };

        $scope.editCreateIELTSReadingTest= function (id) {
            vm.createPackage = true;
            vm.isShowConfigureQuestion = false;

            // console.log(vm.ieltsReadingTest.subQuestions[0]);
            service.getOne(id).then(function (data) {
                vm.ieltsReadingTest = data;
                vm.getOrdinalNumber(data);

                isHavingQuestions(vm.ieltsReadingTest);

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



                console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        //the process of creating

        //passage 1
        vm.createPackage = false;
        vm.startCreateQuestionForPassage1 = function () {
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
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
            if(vm.fromQuestion >= vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                // vm.toQuestion = vm.fromQuestion + 1;
                return;
            }
        };

        vm.addQuestionForPassage1 = function (index) {
            if(vm.fromQuestion >= vm.toQuestion){
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

                if(vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);

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
            // if(vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions == null){
            //     vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
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

            item.question.id = vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.push(item);
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

            if(vm.ieltsReadingTest.subQuestions[0].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[0].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[0].subQuestions.push(item);

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
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };


        // vm.numberFrom = 0;
        // vm.numberTo= 0;

        vm.addQuestionForPassage2 = function (index) {
            if(vm.fromQuestion >= vm.toQuestion){
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

                if(vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions.push(item);

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
            // if(vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions == null){
            //     vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions.push(item);
            // // vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
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

            item.question.id = vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.push(item);
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

            if(vm.ieltsReadingTest.subQuestions[1].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[1].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[1].subQuestions.push(item);

            vm.saveReadingTest();

        };

        vm.startCreatePassage3 = function () {
            vm.createPassageNumber = 3;
        };

        //passage 3

        vm.startCreateQuestionForPassage3 = function () {
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            vm.saveReadingTest();
        };

        vm.addQuestionForPassage3 = function (index) {
            if(vm.fromQuestion >= vm.toQuestion){
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

                if(vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions.push(item);

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

            item.question.id = vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].id;

            if(vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.push(item);
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

            if(vm.ieltsReadingTest.subQuestions[2].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[2].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[2].subQuestions.push(item);

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
            },5000);
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

        vm.bsTableControlCreateIELTSReadingTest = {
            options: {
                data: vm.ieltsReadingTests,
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
                columns: service.getTableDefinitionCreateIELTSReadingTest(),
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
                    vm.getPageCreateIELTSWritingTest();
                }
            }
        };
        //--------------------- End Create Reading test -------------------------//

        //--------------------- Reading Actual test -------------------------//
        vm.passageNumber = 1;
        vm.displayAllTimer = false;

        vm.tempBeforeQuestion = {};
        vm.tempQuestion = {};
        vm.tempAfterQuestion = {};
        vm.tempOrdinalNumber = {};
        vm.tempPackages = [];

        vm.displayTimer = function () {
            vm.displayAllTimer = true;
        };

        vm.displayOnlyMinute = function () {
            vm.displayAllTimer = false;
        };

        vm.clickShowChildren = function(question,beforeQuestion,afterQuestion){
            // console.log('here');
            vm.tempQuestion = question;
            vm.tempBeforeQuestion = beforeQuestion;
            vm.tempAfterQuestion = afterQuestion;
            for(var i = 0; i < vm.ieltsReadingActualTest.subQuestions[0].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsReadingActualTest.subQuestions[0].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsReadingActualTest.subQuestions[0].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            for(var i = 0; i < vm.ieltsReadingActualTest.subQuestions[1].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsReadingActualTest.subQuestions[1].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsReadingActualTest.subQuestions[1].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            for(var i = 0; i < vm.ieltsReadingActualTest.subQuestions[2].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsReadingActualTest.subQuestions[2].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsReadingActualTest.subQuestions[2].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            
            question.showChildren = true;
        };

        vm.autoScrollToView = function (ordinalNumber) {

            vm.tempOrdinalNumber = ordinalNumber;
            var elmnt = document.getElementById('question-number-'+ordinalNumber);
            elmnt.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'center'
            });

        };

        vm.autoFocusOnText = function (ordinalNumber) {
            // console.log('here');
            vm.tempOrdinalNumber = ordinalNumber;
            // var elmnt1 = document.getElementById('question-number-'+ordinalNumber);
            // elmnt1.scrollIntoView();

            var elmnt2 = document.getElementById('text-question-number-'+ordinalNumber);
            if(elmnt2 != null){
                elmnt2.focus();
                elmnt2.focus();
                // elmnt2.placeholder="";
                // elmnt2.appendChild(input);
            }
        };        

        vm.tempPassage = 1;
        vm.changePassage = function (items) {
            vm.tempPackages = items;
            if(items!= null && items.length > 0 && items[0] != null){
                if(items[0].parent != null){
                    if(items[0].parent.questionType != null){
                        if(items[0].parent.questionType.code == "IELTSRTP1"){
                            vm.passageNumber = 1;
                        }
                        if(items[0].parent.questionType.code == "IELTSRTP2"){
                            vm.passageNumber = 2;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage2 = document.getElementById('passage-number-2');
                            //     passage2.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }

                        }
                        if(items[0].parent.questionType.code == "IELTSRTP3"){
                            vm.passageNumber = 3;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage3 = document.getElementById('passage-number-3');
                            //     passage3.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }
                        }
                    }
                }
            }
        };

        vm.buttonBottomNextQuestion = function () {
            vm.changePassage(vm.tempPackages);
            // if(vm.tempOrdinalNumber > 0 || vm.tempOrdinalNumber < 40);{
            //     vm.tempOrdinalNumber = vm.tempOrdinalNumber + 1;
            // }
            vm.autoScrollToView(vm.tempOrdinalNumber);
            vm.clickShowChildren(vm.tempQuestion);
            vm.autoFocusOnText(vm.tempOrdinalNumber);
        };

        vm.processQuestionATT = function (data,idName) {
            function testInput(){
                console.log('test success');
            }
            for(var k = 0; k < data.subQuestions.length; k++){
                //process passage for matching heading
                // var passage = data.subQuestions[k].subQuestions[i].question;
                var typePassage = data.subQuestions[k].type;

                var inputMatchingHeading = '<input ng-click="" droppable="true" ng-model="vm.answerDropBox"  class="matching-heading-drop-box" id="matching-heading-drop-box-'+i+'" placeholder="dragging heading and dropping hear"> </input>';
                if(typePassage == 4){
                    data.subQuestions[k].question = data.subQuestions[k].question.replaceAll('}{HEADING}{', inputMatchingHeading);
                }

                for (var i = 0; i < data.subQuestions[k].subQuestions.length; i++) {
                    for (var j = 0; j < data.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                        
                        //process filling gáp
                        if (data.subQuestions[k].subQuestions[i].type == 2) {
                            var type = data.subQuestions[k].subQuestions[i].type;
                            var arrs = []
                            var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                            var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                            var input = '<input type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.answerClient" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'">';
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br> <br>');
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input);
                            // data.subQuestions[k].subQuestions[i].subQuestions[j].question = $sce.trustAsHtml(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                            // console.log(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                        } else if (data.subQuestions[k].subQuestions[i].type == 3) { //process filling gap enter
                            var type = data.subQuestions[k].subQuestions[i].type;
                            var arrs = []
                            var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                            var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                            var input1 = '<br><input type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.answerClient" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'"><br><br>';
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input1);
                            // data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br>');
                            console.log('yes');
                        }
                    }
                }
            }


            return data;

        };



        window.addEventListener('contextmenu', function (e) {
            // document.body.innerHTML += '<p>Right-click is disabled</p>'
            e.preventDefault();
        }, false);


        vm.isShowContextMenu = false;
        vm.notes = [];
        vm.notes2 = [];
        vm.notes3 = [];
        vm.note = {};
        vm.surroundedId1 = 0;
        vm.surroundedId2 = 0;
        vm.surroundedId3 = 0;
        $scope.showContextMenu = function(){

            if(window.getSelection().toString() == null || window.getSelection().toString().length > 0){
                vm.isShowContextMenu = true;
            } else {
                vm.isShowContextMenu = false;
            }

        };

        $scope.highlightText = function () {
            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('span');

            span.className = 'surrounded-text';
            span.appendChild(range.extractContents());
            range.insertNode(span);
        };

        //passage 1
        $scope.closeNotes1 = function (){
            console.log('close 1');
            for(var i = 0; i< vm.notes.length; i++){
                var currentId = i+1;
                var currentElementId = 'passage-1-notes-highlight-'+currentId;
                var currentNote = document.getElementById(currentElementId);
                currentNote.style.display = 'none';
            }
        };

        $scope.createNotes1 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            // var note = {};
            // note.header = window.getSelection().toString();
            // vm.notes.push(note);


            vm.surroundedId1 = vm.surroundedId1 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-1-surrounded-text-have-note-'+vm.surroundedId1;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes1);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);
            
            var note = {passage: 1};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes.push(note);
        };

        $scope.closeASpecificNote1 = function (currentId) {
            var currentElementId = 'passage-1-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes1 = function (a) {

            var passage = document.getElementById('passage-text-1');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-1-notes-highlight-'+currentId;

            // console.log(currentId);
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            // for(var i = 0; i< vm.notes.length; i++){
            //     vm.notes[i].isShowNote = true;
            // }
        };

        //passage 2
        $scope.closeNotes2 = function (){
            console.log('close');
            for(var i = 0; i< vm.notes2.length; i++){
                if(vm.notes2[i].passage == 2){
                    var currentId = i+1;
                    var currentElementId = 'passage-2-notes-highlight-'+currentId;
                    var currentNote = document.getElementById(currentElementId);
                    currentNote.style.display = 'none';
                }

            }
        };

        $scope.createNotes2 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            vm.surroundedId2 = vm.surroundedId2 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-2-surrounded-text-have-note-'+vm.surroundedId2;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes2);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 2};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes2.push(note);
        };

        $scope.closeASpecificNote2 = function (currentId) {
            var currentElementId = 'passage-2-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes2 = function (a) {

            var passage = document.getElementById('passage-text-2');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-2-notes-highlight-'+currentId;
            
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            
        };

        //passage 3
        $scope.closeNotes3 = function (){
            console.log('close');
            for(var i = 0; i< vm.notes3.length; i++){
                if(vm.notes3[i].passage == 3){
                    var currentId = i+1;
                    var currentElementId = 'passage-3-notes-highlight-'+currentId;
                    var currentNote = document.getElementById(currentElementId);
                    currentNote.style.display = 'none';
                }

            }
        };

        $scope.createNotes3 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');
            
            vm.surroundedId3 = vm.surroundedId3 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-3-surrounded-text-have-note-'+vm.surroundedId3;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes3);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 3};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes3.push(note);
        };

        $scope.closeASpecificNote3 = function (currentId) {
            var currentElementId = 'passage-3-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes3 = function (a) {

            var passage = document.getElementById('passage-text-3');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-3-notes-highlight-'+currentId;

            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');

        };

        vm.testResult = {};

        vm.testResult.questionAnswers = [];
        vm.testResult.user = vm.currentUser;

        vm.setReviewQuestion = function () {

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(vm.tempQuestion.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].needReview = vm.tempQuestion.needReview;
                            // vm.tempQuestion.needReview = true;

                        }
                    }
                }
            }
        };

        vm.checkBoxMultipleChoiceQuestions = function (questionAnswer,question,selected) {

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            //set answered
                            // vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // if(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == true){
                            //     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            // } else if(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == false){
                            //     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // }
                            vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = selected;


                            // console.log(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k]);
                            for(var l = 0; l < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers.length; l++){
                                if(questionAnswer.id != vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].id){
                                    //set answer is selected
                                    vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = false;
                                }else {
                                    vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = selected;
                                    if(selected){
                                        for (var m = 0; m < vm.testResult.questionAnswers.length; m++){
                                            if(vm.testResult.questionAnswers[m].question.id == question.id){
                                                vm.testResult.questionAnswers.splice(m,1);
                                            }
                                        }

                                        vm.testResult.questionAnswers.push(questionAnswer);
                                    } else if (!selected){
                                        for (var m = 0; m < vm.testResult.questionAnswers.length; m++){
                                            if(vm.testResult.questionAnswers[m].question.id == question.id){
                                                vm.testResult.questionAnswers.splice(m,1);
                                            }
                                        }
                                    }
                                }
                            }

                        }

                    }
                }
            }

            console.log("-----------");
            console.log(vm.testResult);
            console.log(vm.testResult.questionAnswers);
            console.log("===========");
        };
        
        vm.changeTextQuestionAnswer = function (questionAnswer,answer,question) {
            // console.log(questionAnswer);
            // console.log(answer);
            // console.log(question);

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++) {//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++) {//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question


                        if(questionAnswer.answerClient != null && questionAnswer.answerClient.length > 0 && answer != null && answer.length > 0){

                            if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            }

                            var qa = questionAnswer;
                            qa.id = null;

                            var a = {
                                answer: questionAnswer.answerClient.trim()
                            };
                            qa.answer = a;
                            // qa.

                            if(questionAnswer.answerClient.trim() != answer.trim()){
                                qa.correct = false;
                            }

                            for (var m = 0; m < vm.testResult.questionAnswers.length; m++){
                                if(vm.testResult.questionAnswers[m].question.id == question.id){
                                    vm.testResult.questionAnswers.splice(m,1);
                                }
                            }

                            vm.testResult.questionAnswers.push(qa);

                        } else {
                            if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                for (var m = 0; m < vm.testResult.questionAnswers.length; m++){
                                    if(vm.testResult.questionAnswers[m].question.id == question.id){
                                        vm.testResult.questionAnswers.splice(m,1);
                                    }
                                }

                                vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            }
                        }
                    }
                }
            }


            console.log("-----------");
            console.log(vm.testResult);
            console.log("===========");


        };
        // $scope.currentUser = {id:'',displayName: ''};
        // $rootScope.$on('$onCurrentUserData', function (event, data) {
        //
        //     if (data != null) {
        //         $scope.currentUser = data;
        //     }
        //     console.log($scope.currentUser);
        //
        //
        // });




        $scope.tinymceOptionsToCreateQuestionForReadingTestPassageActualTest = {
            height: 600,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'contextmenu image lists link  table textcolor'
            ],

            toolbar1: ' link image inserttable | cell row column deletetable | numlist bullist | forecolor backcolor',
            contextmenu: 'link image inserttable | cell row column deletetable | numlist bullist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content_ielts_reading_actual_test.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false,
            // readonly : 1
            contextmenu_never_use_native: true
        };

        $scope.models = {
            selected: null,
            lists: {"A": [], "B": []}
        };

        // Generate initial model
        for (var i = 1; i <= 3; ++i) {
            $scope.models.lists.A.push({label: "Item A" + i});
            $scope.models.lists.B.push({label: "Item B" + i});
        }

        // Model to JSON for demo purpose
        $scope.$watch('models', function(model) {
            $scope.modelAsJson = angular.toJson(model, true);
        }, true);

        $scope.drag_types = [
            {name: "Charan"},
            {name: "Vijay"},
            {name: "Mahesh"},
            {name: "Dhananjay"},
        ];
        $scope.items = [];

        $scope.handleDragStart = function(e){
            this.style.opacity = '0.4';
            e.dataTransfer.setData('text/plain', this.innerHTML);
        };

        $scope.handleDragEnd = function(e){
            this.style.opacity = '1.0';
        };

        $scope.handleDrop = function(e){
            e.preventDefault();
            e.stopPropagation();
            var dataText = e.dataTransfer.getData('text/plain');
            $scope.$apply(function() {
                $scope.items.push(dataText);
            });
            // console.log($scope.items);
        };

        $scope.handleDragOver = function (e) {
            e.preventDefault(); // Necessary. Allows us to drop.
            e.dataTransfer.dropEffect = 'move';  // See the section on the DataTransfer object.
            return false;
        };
        //--------------------- End Reading Actual test -------------------------//



    }

})();