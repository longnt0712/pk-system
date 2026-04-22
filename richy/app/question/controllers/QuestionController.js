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
        '$cookies',
        'TopicService',
        // 'Pubnub'
        // 'pubnub.angular.service'
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

    function QuestionController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies,topicService) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;


        window.addEventListener('beforeunload', function (e) {
            // Cancel the event
            e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
            // Chrome requires returnValue to be set
            e.returnValue = '';
        });


        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        // console.log(vm.currentUser);
        
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

        vm.status = {id: 3, name: "Tất cả (no listening)"};
        vm.statuses = [
            // {id: 1, name: "Chưa thuộc"},
            // {id: 2, name: "Thuộc"},
            {id: 3, name: "Tất cả (no listening)"},
            {id: 4, name:"Đánh dấu"},
            {id: 5, name: "Listening"},
            // {id: 3, name:"Tất cả"}
        ];

        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 100;
        vm.searchDto.pageSize = 5;
        vm.searchDto.pageIndex = 1;
        vm.searchDto.findExactWord = true;
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

        vm.totalCard = 0;
        vm.showListFlashCard = true;

        // $scope.setPage = function (pageNo) {
        //     $scope.currentPage = pageNo;
        // };

        $scope.pageChanged = function() {
            // $log.log('Page changed to: ' + $scope.currentPage);
            vm.getPageFlashCard();
        };

        $scope.pageChangedOnlyQuestion = function() {
            // $log.log('Page changed to: ' + $scope.currentPage);
            vm.getPageOnlyQuestion();
        };

        // $scope.maxSize = 5;
        // $scope.bigTotalItems = 175;
        // $scope.bigCurrentPage = 1;

        vm.questions1 = [];
        vm.questions2 = [];
        vm.questions3 = [];
        vm.questions4 = [];
        vm.questions5 = [];
        vm.questions6 = [];
        vm.questions7 = [];

        vm.getPageOnlyQuestion = function () {
            blockUI.start();
            service.getPageOnlyQuestion(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                vm.questions = data.content;
                blockUI.stop();
                console.log(vm.questions);
                //tạm thời
                vm.totalCard = data.totalElements; //cmt tạm
                vm.searchDto.totalItems = data.totalElements;
            });
        };


        vm.getPageFlashCard = function () {
            vm.searchDto.questionType = {id: 6};
            vm.searchDto.username = vm.currentUser.username;
            vm.searchDto.userId = vm.currentUser.id;
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                vm.questions = data.content;
                blockUI.stop();
                
                //tạm thời
                vm.totalCard = data.totalElements; //cmt tạm
                vm.searchDto.totalItems = data.totalElements;
                vm.currentPosition = 0;
                // console.log(data.content);
                if(angular.isUndefined(vm.questions)){
                    vm.questions = [];
                    vm.currentCard = {};
                    vm.totalCard = 0;
                } else {
                    vm.currentCard = vm.questions[vm.currentPosition];
                    vm.createQuiz(vm.currentCard);
                }

                if (vm.isFlashCardMode == 1) {
                    vm.doShuffle();
                }

                vm.questions1 = [];
                vm.questions2 = [];
                vm.questions3 = [];
                vm.questions4 = [];
                vm.questions5 = [];
                vm.questions6 = [];
                vm.questions7 = [];
                angular.forEach(vm.questions, function(value, key) {
                    vm.questions1.push(value);
                    vm.questions2.push(value);
                    vm.questions3.push(value);
                    vm.questions4.push(value);
                    vm.questions5.push(value);
                    vm.questions6.push(value);
                    vm.questions7.push(value);
                });

                shuffleArray1(vm.questions1);
                shuffleArray2(vm.questions2);
                shuffleArray2(vm.questions3);
                shuffleArray2(vm.questions4);
                shuffleArray2(vm.questions5);
                shuffleArray2(vm.questions6);
                shuffleArray2(vm.questions7);

            });
        };
        vm.clickShowListFlashCard = function () {
            if(vm.showListFlashCard == true){
                vm.showListFlashCard = false;
            } else{
                vm.showListFlashCard = true;
            }
        };

        vm.listFlashCard = 0;
        vm.listFlashCard = $stateParams.listFlashCard;
        vm.isFlashCardMode = $stateParams.flashCardModeId | 0; // flashCardModeId = 1 => in this mode.

        vm.getPageFlashCard();

        vm.totalItems = 0;
        vm.pageIndexAnswer = 1;
        vm.pageSizeAnswer = 2;
        vm.searchDtoAnswer = {};
        vm.questionTypes = [];

        vm.questionTypeFlashCard = {};
        vm.getQuestionTypes = function () {
            service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.questionTypes = data.content;
                vm.question.questionType = vm.questionTypes[0];

            });
        };

        vm.getQuestionTypes();

        vm.topicCategories = [];
        vm.searchTopicCategory = {};
        vm.getPageTopicCategory = function () {
            blockUI.start();
            service.getPageTopicCategory(vm.searchTopicCategory,1, 100).then(function (data) {
                blockUI.stop();

                vm.topicCategories = data.content;
                // if(vm.topicCategories != null){
                    // vm.searchTopicDto.topicCategory = vm.topicCategories[0];
                // }
                vm.getTopics();
            });
        };
        vm.getPageTopicCategory();

        //----------------------- Flash Card -------------------------//
        vm.topics = [];
        vm.topic = {};
        vm.topic.userId = vm.currentUser.id;
        vm.searchTopicDto = {};
        vm.searchTopicDto.username = vm.currentUser.username;
        vm.searchTopicDto.userId = vm.currentUser.id;

        vm.getTopics = function () {
            blockUI.start();
            service.getTopics(vm.searchTopicDto,1, 10000000).then(function (data) {
                vm.topics = data.content;
                blockUI.stop();
                // console.log(vm.topics);
            });
        };
        vm.saveTopic = function () {

            topicService.saveObject(vm.topic).then(function (data) {
                vm.topic = {};
                vm.topic.userId = vm.currentUser.id;
                vm.getTopics();
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }

            });
        };

        vm.editTopic = function (item) {
            // console.log(item);
            // console.log('editing...');
        };

        vm.loadMore = function () {
            vm.searchDto.pageSize = vm.searchDto.pageSize + 15;
            vm.getPageFlashCard();
        };


        vm.loadAll = function () {
            vm.searchDto.pageSize = 10000000;
            vm.getPageFlashCard();
        };

        vm.changePageSize = function () {
            //calculate page index
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.changePageSizeOnlyQuestion = function () {
            //calculate page index
            vm.searchDto.pageIndex = 1;
            vm.getPageOnlyQuestion();
        };
        
        vm.nextCard = function () {
            // if(vm.currentPosition + 1 < vm.totalCard){
            if(vm.currentPosition + 1 < vm.searchDto.pageSize){
                vm.showQuestionTemp = false;
                tenSec.load();

                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.createQuiz(vm.currentCard);
                vm.answerRewriteWord = '';
                // console.log("next");
                if(vm.isPlayQuiz || vm.isPlayRewriteWord){
                    if(!vm.isMuted){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
                    }

                }

            }

        };

        vm.backCard = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.createQuiz(vm.currentCard);
                vm.answerRewriteWord = '';
                // console.log("back");

                if(vm.isPlayQuiz || vm.isPlayRewriteWord){
                    if(!vm.isMuted){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
                    }
                }

            }

        };

        vm.doShuffle = function() {
            shuffleArray(vm.questions);
            vm.currentPosition = 0;
            vm.currentCard = vm.questions[vm.currentPosition];
            vm.isShowDetail = false;
            vm.createQuiz(vm.currentCard);
            vm.answerRewriteWord = '';
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

        // -> Fisher–Yates shuffle algorithm
        var shuffleArray1 = function(array) {
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

        // -> Fisher–Yates shuffle algorithm
        var shuffleArray2 = function(array) {
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
                // console.log('listFlashCard');
                vm.getPageFlashCard();
            }

            if($stateParams.writingCollectionMode == 2){
                // console.log('IELTSWriting');

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
            questionTopics: [],
            userId: vm.currentUser.id
        };
        if(settings.isAdmin == true){
            vm.newCard.website = 1;
        }


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

            if(vm.currentCard === null || typeof(vm.currentCard) !== "undefined"){
                vm.currentCard.questionTopics = pushTopic(vm.selectedTopicToEdit);
            }

            vm.currentPosition = 0;
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.topicChangeItem = function (item) {

            item.questionTopics = pushTopic(item.selectedTopicToEdit);

        };

        vm.title = '';
        vm.searchTopicChange = function () {
            vm.title = '';
            vm.searchDto.questionTopics = pushTopic(vm.selectedTopicToSearch);
            for(var i = 0; i < vm.searchDto.questionTopics.length; i++){
                vm.title = vm.title + ' ' + vm.searchDto.questionTopics[i].topic.name;
            }
            console.log(vm.title);
            vm.currentPosition = 0;
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.newFlashCard = function () {
            
            if(vm.newCard.question == null || angular.isUndefined(vm.newCard.question)){
                toastr.warning('Please fill in the word');
                return;
            }

            // service.saveObject(vm.newCard, function success() {
            //     vm.getPageFlashCard();
            //     toastr.info('Save successfully');
            //     vm.newCard = {
            //         questionType : {
            //             code: 'FC',
            //             id: 6,
            //             name: 'Flash card',
            //             textSearch: null
            //         },
            //         status : 1,
            //         questionTopics: [],
            //         userId: vm.currentUser.id
            //     };
            //     vm.selectedTopicToAdd = [];
            // }, function failure() {
            //     toastr.error('There is something wrong!!');
            // });
            blockUI.start();
            service.saveObject(vm.newCard).then(function (data) {
                blockUI.stop();
                vm.getPageFlashCard();
                // toastr.info('Save successfully');
                vm.newCard = {
                    questionType : {
                        code: 'FC',
                        id: 6,
                        name: 'Flash card',
                        textSearch: null
                    },
                    status : 1,
                    questionTopics: pushTopic(vm.selectedTopicToAdd),
                    userId: vm.currentUser.id
                };
                if(settings.isAdmin == true){
                    vm.newCard.website = 1;
                }
                // vm.newCard.questionTopics = pushTopic(vm.selectedTopicToAdd);
                // vm.topicChange();
                // vm.selectedTopicToAdd = [];
                if(data.message != null){
                    if(data.message === 'Successfully, but there is another card like this'){
                        toastr.warning(data.message, 'Warning');
                    } else{
                        toastr.info(data.message, 'Notification');
                    }
                }else{
                    toastr.error('Error.', 'Warning');
                }
            });

        };



        vm.editFlashCard = function (item) {
            // vm.selectedTopicToEdit = getListTopicFromCard(item.questionTopics);
            // service.saveObject(item, function success() {
            //
            //     vm.getPageFlashCard();
            //     toastr.info('Save successfully');
            //     // vm.currentCard = {};
            // }, function failure() {
            //     // console.log(vm.currentCard);
            //
            //     toastr.error('Error');
            // });

            service.saveObject(item).then(function (data) {
                vm.getPageFlashCard();
                // toastr.info('Save successfully');
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }
            });

        };

        vm.saveImportant = function (item) {

            item.status = 4;

            service.saveObject(item).then(function (data) {
                vm.getPageFlashCard();
                // toastr.info('Save successfully');
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }
            });

        };

        vm.saveTypeNormal = function (item) {

            item.status = 1;

            service.saveObject(item).then(function (data) {
                vm.getPageFlashCard();
                // toastr.info('Save successfully');
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }
            });

        };

        vm.saveListening = function (item) {

            item.status = 5;

            service.saveObject(item).then(function (data) {
                vm.getPageFlashCard();
                // toastr.info('Save successfully');
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }
            });

        };
        
        vm.showDetailFlashCard = function (item) {
            // console.log(item);
            item.selectedTopicToEdit = getListTopicFromCard(item.questionTopics);
            // item.questionTopics = pushTopic(vm.selectedTopicToAdd);
            item.showDetail = true;
        };

        vm.hideDetailFlashCard = function (item) {
            item.showDetail = false;
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
            // console.log(vm.flashCard);
            if(vm.myAnswer.toLowerCase().trim() == vm.flashCard.question.toLowerCase()){
                vm.flashCard.timeReviewd = vm.flashCard.timeReviewd + 1;
                vm.flashCard.correctAnswer = vm.flashCard.correctAnswer + 1;
                // console.log(vm.flashCard);
                vm.answer = true;
                service.saveObject(vm.flashCard, function success() {

                    toastr.info('À ghê!!!', 'Cũng kinh đấy :)');
                    service.getOne(vm.flashCard.id).then(function (data) {
                        vm.question = data;
                    });
                }, function failure() {
                    // console.log(vm.question);
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
                    // console.log(vm.question);
                    toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                });
            }
        };

        vm.showPronunciation = false;
        vm.isShowPronunciation = function () {
            // console.log('show');
            vm.showPronunciation = true;
        };
        vm.showExamples = false;

        vm.isShowExamples = function () {
            // console.log('show');
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
                //     description = vm.question.description.replace( /(<([^>]+)>)/ig, '');
                description = vm.question.motherTongue.replace( /(<([^>]+)>)/ig, '');
                $scope.sayIt(vm.question.question);
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
        vm.timeGap = 36000;
        var idInterval;
        vm.startNoti = function () {


            toastr.info('Start Noti', 'Thông báo');


            if(Notification.permission === "granted") {
                // showNotification();
                // console.log(123);
                // setTimeout(showNotification,500);
                clearInterval(idInterval);
                idInterval = setInterval(showNotification,vm.timeGap);
            } else if (Notification.permission !== "denied"){
                Notification.requestPermission().then(function (permission) {
                    if(permission === "granted"){
                        // showNotification();
                        // setTimeout(showNotification,300000);
                        // setInterval(showNotification,500);
                    }
                });
            }

            // clearInterval(idInterval);
            //
            // setInterval(showNotification,vm.timeGap);


        };

        // var idInterval;

        // if(Notification.permission === "granted") {
        //     // showNotification();
        //     // console.log(123);
        //     // setTimeout(showNotification,500);
        //     idInterval = setInterval(showNotification,vm.timeGap);
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
            vm.currentPosition = 0;
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
            // console.log(vm.question);
        };

        vm.clickNext = function () {
            if(vm.currentPosition <= vm.questions.length){
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                vm.createQuiz(vm.currentCard);
            }
        };

        vm.clickBack = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                vm.createQuiz(vm.currentCard);
            }
        };

        vm.isShowDetail = false;
        vm.showDetails = function () {
            vm.isShowDetail = true;
        };


        $scope.tinymceOptions = {
            height: 200,
            theme: 'modern',
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'bold underline italic | forecolor backcolor  | removeformat | bullist numlist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinymceOptionsToReview = {
            height: 100,
            theme: 'modern',
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'bold underline italic | forecolor backcolor | removeformat | bullist numlist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        function showNotification() {
            // console.log(vm.type.id);
            service.getRandomQuestion(vm.searchDto).then(function (data) {
                vm.question = data;
                var question = vm.question.question + " " + vm.question.pronounce;
                var description = '';
                if ((vm.question != null) && (vm.question.motherTongue != null)) {
                    description = vm.question.motherTongue.replace(/(<([^>]+)>)/ig, '');
                }
                $scope.sayIt(vm.question.question);
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

        // vm.startNoti = function () {
        //     var idInterval;
        //
        //     toastr.info('Start Noti', 'Thông báo');
        //
        //
        //     if(Notification.permission === "granted") {
        //         // showNotification();
        //         // console.log(123);
        //         // setTimeout(showNotification,500);
        //         idInterval = setInterval(showNotification,vm.timeGap);
        //     } else if (Notification.permission !== "denied"){
        //         Notification.requestPermission().then(function (permission) {
        //             if(permission === "granted"){
        //                 // showNotification();
        //                 // setTimeout(showNotification,300000);
        //                 // setInterval(showNotification,500);
        //             }
        //         });
        //     }
        //
        //     clearInterval(idInterval);
        //
        //     setInterval(showNotification,vm.timeGap);
        //
        //
        // };

        vm.getSelectedText = function () {
            var text = "";
            if (window.getSelection) {
                text = window.getSelection().toString();
            } else if (document.selection && document.selection.type != "Control") {
                text = document.selection.createRange().text;
            }

            if(text.length > 0 && text.trim().length > 0){
                $window.open('https://dictionary.cambridge.org/vi/dictionary/english/'+ text, '_blank');
            }

        };

        vm.quizs = [

        ];
        //timer
        vm.counterChange = function () {
            $scope.counter = vm.tempCounter;
        };
        $scope.counter = 90;
        vm.tempCounter = 90;
        var mytimeout = null; // the current timeoutID
        var audio = document.getElementById("audio1");
        var well = document.getElementById("well");
        var sai = document.getElementById("sai");
        var ngao = document.getElementById("ngao");
        var stupid = document.getElementById("stupid");
        var endSound = document.getElementById("end-sound");

        // actual timer method, counts down every second, stops on zero
        $scope.onTimeout = function() {
            if($scope.counter ===  0 || $scope.counter < 0) {
                $scope.counter = 0;
                audio.load();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Time's up"));
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            $scope.counter--;

            // if($scope.counter == 90){
            //     audio.load();
            //     // audio.loop = true;
            //     audio.play();
            // }

            if($scope.counter == 0){
                // audio.loop = false;
                vm.endGame = true;
            }
            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        $scope.startCount = function() {
            $scope.refreshTimer();
            vm.doShuffle();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            audio.load();
            audio.play();
            audio.loop = true;

            vm.endGame = false;
            vm.blindMode = false;
            vm.streak = 0;

            window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));

        };

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            audio.load();

            // $scope.counter = 90;
            $scope.counter = vm.tempCounter;
        };
        //--//

        //timer
        vm.counterChange = function () {
            $scope.counter = vm.tempCounter;
        };
        $scope.counter = 90;
        vm.tempCounter = 90;
        var mytimeout = null; // the current timeoutID
        var audio = document.getElementById("audio1");

        vm.resetBackgroundMusic = function () {
            audio.load();
            if(getRndInteger(1,4) == 1){
                console.log(1);
                audio = document.getElementById("endgame");
            }else if(getRndInteger(1,4) == 2){
                console.log(2);
                audio = document.getElementById("mixue");
            }else if(getRndInteger(1,4) == 3){
                console.log(3);
                audio = document.getElementById("audio1");
            }else {
                audio = document.getElementById("audio1");
            }
        };


        var well = document.getElementById("well");
        var sai = document.getElementById("sai");
        var ngao = document.getElementById("ngao");
        var stupid = document.getElementById("stupid");
        var endSound = document.getElementById("end-sound");

        // actual timer method, counts down every second, stops on zero
        $scope.onTimeout = function() {
            if($scope.counter ===  0 || $scope.counter < 0) {
                $scope.counter = 0;
                audio.load();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Time's up"));
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            $scope.counter--;

            // if($scope.counter == 90){
            //     audio.load();
            //     // audio.loop = true;
            //     audio.play();
            // }

            if($scope.counter == 0){
                // audio.loop = false;
                vm.endGame = true;
            }
            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        $scope.startCount = function() {
            $scope.refreshTimer();
            vm.doShuffle();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            audio.load();
            audio.play();
            audio.loop = true;

            vm.endGame = false;
            vm.blindMode = false;
            vm.streak = 0;

            window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));

        };

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            vm.resetBackgroundMusic();

            // audio.load();

            // $scope.counter = 90;
            $scope.counter = vm.tempCounter;
        };
        //--//

        //answer quiz
        vm.endGame = false;
        vm.blindMode = false;
        vm.blindModeScore = 1500000;
        vm.streak = 0;
        vm.bonusTime = 2;
        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min) ) + min;
        }


        vm.answerQuiz = function (correct,item,questions) {

            angular.forEach(questions, function(value, key) {
                value.chosen = false;
            });

            // item.chosen = true;


            if(correct == true){
                if((vm.currentPosition + 1) >= vm.searchDto.pageSize){
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("GAME OVER"));
                    if(vm.endGame == false){
                        vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score + ($scope.counter)/12;
                    }
                    vm.endGame = true;

                    $scope.refreshTimer();
                }else{
                    if(vm.endGame == false) {

                        vm.streak = vm.streak + 1;

                        if(vm.blindModeScore == vm.players[vm.indexPlayer].score){
                            vm.blindMode = true;
                        }

                        if(vm.streak >= 5){
                            // toastr.info('+ 5s !!!');
                            $scope.counter= $scope.counter + vm.bonusTime;
                            vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score + parseInt(vm.streak/3);
                            toastr.success('Correct; +'+vm.bonusTime+'; bonus score: ' + parseInt(vm.streak/3));
                        }else{
                            toastr.info('Correct !!!');
                        }

                        if(vm.players[vm.indexPlayer].highestStreak < vm.streak){
                            vm.players[vm.indexPlayer].highestStreak = vm.streak;
                        }

                        vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score + 1;
                        vm.nextCard();
                    }
                }

            }else{
                if((vm.currentPosition + 1) >= vm.searchDto.pageSize){
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("GAME OVER"));

                }else {
                    if(vm.endGame == false) {
                        vm.streak = 0;
                        vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score - 0.5;
                        toastr.error('Wrong !!!');
                        if(getRndInteger(1,4) == 1){
                            sai.load();
                            sai.play();
                        }else if(getRndInteger(1,4) == 2){
                            ngao.load();
                            ngao.play();
                        }else if(getRndInteger(1,4) == 3){
                            stupid.load();
                            stupid.play();
                        }else {
                            stupid.load();
                            stupid.play();
                        }

                    }
                }
            }
        };

        vm.score = 0;
        vm.players = [];
        vm.indexPlayer = -1;
        vm.player ={
            name: '',
            score: 0,
            timeLeft: 0,
            highestStreak: 0
            // index: 1,
        };

        vm.putPlayers = function () {
            vm.indexPlayer = vm.indexPlayer + 1;
            vm.players.push(vm.player);
            vm.player ={
                name: '',
                score: 0,
                timeLeft: 0,
                highestStreak: 0
                // index: 1,
            };
        };

        //--//
        
        vm.isNormal = true;
        vm.isPlayQuiz = false;
        vm.isPlayQuiz2 = false;
        vm.isPlayRewriteWord = false;
        // service.getRandomQuestionQuiz(vm.searchDto).then(function (data) {
        //     console.log(data);
        // });
        //
        vm.answerRewriteWord = '';

        vm.changeMode = function (mode) {
            if(mode == 'normal'){
                vm.isNormal = true;
                vm.isPlayQuiz = false;
                vm.isPlayQuiz2 = false;
                vm.isPlayRewriteWord = false;
            }
            if(mode == 'quiz'){
                vm.isNormal = false;
                vm.isPlayQuiz = true;
                vm.isPlayQuiz2 = false;
                vm.isPlayRewriteWord = false;
                vm.isMuted = false;
                if(!vm.isMuted){
                    if(vm.currentCard != null && angular.isDefined(vm.currentCard)){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
                    }
                }
            }
            if(mode == 'quiz2'){
                vm.isNormal = false;
                vm.isPlayQuiz = false;
                vm.isPlayQuiz2 = true;
                vm.isPlayRewriteWord = false;
                vm.isMuted = false;
                if(!vm.isMuted){
                    if(vm.currentCard != null && angular.isDefined(vm.currentCard)){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
                    }
                }
            }
            if(mode == 'rewrite'){
                vm.isNormal = false;
                vm.isPlayQuiz = false;
                vm.isPlayQuiz2 = false;
                vm.isPlayRewriteWord = true;
                vm.isMuted = false;
                if(!vm.isMuted){
                    if(vm.currentCard != null && angular.isDefined(vm.currentCard)){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
                    }
                }
            }
        };

        vm.playQuiz = function () {
            if(vm.isPlayQuiz == true){
                vm.isPlayQuiz = false;
            }else{
                vm.isPlayQuiz = true;
                // window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.question));
            }
        };

        vm.searchDto.numberOfAnswers = 4;
        vm.createQuiz = function (currentCard) {
            var mainQuestion = {};
            mainQuestion.id = currentCard.id;
            mainQuestion.question = currentCard.question;
            mainQuestion.motherTongue = currentCard.motherTongue;
            mainQuestion.correct = true;

            var hasThisQuestion = false;
            angular.forEach(currentCard.questions, function(value, key) {
                if(value.id == mainQuestion.id){
                    hasThisQuestion = true;
                }
            });

            if(hasThisQuestion == false){
                currentCard.questions.push(mainQuestion);
            }

            shuffleArray(currentCard.questions);
        };
        
        vm.isMuted = true;
        // $scope.theText = "Welcome to the speech enabled world!";
        $scope.sayIt = function (text) {
            // console.log(vm.isMuted);
            if(!vm.isMuted){
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
            }
        };


        vm.clickAnswerRewriteWord = function () {
            // console.log(event.keyCode);
            if(event.keyCode == 39) {//Phím ->
                vm.nextCard();
            }

            if(event.keyCode == 37) {//Phím ->
                vm.backCard();
            }

            if(event.keyCode == 13){//Phím Enter
                vm.answerRewriteWord = vm.answerRewriteWord.trim();
                vm.answerRewriteWord = vm.answerRewriteWord.toLowerCase();

                var root = '';

                root = vm.currentCard.question.trim();
                root = vm.currentCard.question.toLowerCase();
                
                if(vm.answerRewriteWord.trim() == root){
                    toastr.info('Correct !!!');
                } else {
                    toastr.error('Wrong !!!');
                }
            }
            
        };

        vm.printFormsNumber = 1;

        vm.printForms = function (number) {
            vm.printFormsNumber = number;
            vm.questions1 = [];
            vm.questions2 = [];
            angular.forEach(vm.questions, function(value, key) {
                vm.questions1.push(value);
                vm.questions2.push(value);
            });

            shuffleArray1(vm.questions1);
            shuffleArray2(vm.questions2);
            
            if(number == 11){
                vm.getPageOnlyQuestion();
            }
            // vm.questions1 = x1;
            // vm.questions2 = shuffleArray(vm.questions);
        };
        
        vm.print = function () {
            window.print();
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
                    console.log(vm.selectedShops);
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


        //add words by text
        vm.text = 'how are you today?';
        var specialChars = "!@#$^&%*()+=-[]\/{}|:<>?,.";



        vm.splitText = function () {

            for (var i = 0; i < specialChars.length; i++) {
                vm.text = vm.text.replace(new RegExp("\\" + specialChars[i], "gi"), "");
            }

            var list = vm.text.split(" ");
            vm.words = [];

            vm.words = Array.from(new Set(vm.text.split(' '))).toString();
            vm.words = vm.words.split(",");
            console.log(vm.words);
        };

        vm.checkWords = function (word) {
            vm.searchDto.textSearch = word;
            vm.codeChange();
        };

        vm.addToNewCard = function (word) {
            vm.newCard.question = word;
        };

        var tenSec = document.getElementById("10s");
        var quec = document.getElementById("quec");
        vm.tenSeconds = function () {
            tenSec.load();
            tenSec.play();
        };

        vm.showQuestionTemp = false;

        vm.clickShowQuestionTemp = function () {
            // quec.load();
            quec.play();
            vm.showQuestionTemp = true;
        };





        //end add words by text//

        // binggo
        // vm.bingo = [];
        // vm.bingos = [];
        // vm.textBingo = '';
        //
        // vm.textBingoChange = function () {
        //     // vm.bingo = vm.textBingo.split("\n");
        //     // vm.bingos = [];
        //     for(var i = 0; i < 1; i++){
        //         var a = vm.textBingo.split("\n");
        //         shuffleArray(a);
        //         vm.bingos.push(a);
        //     }
        //     console.log(vm.bingos);
        // };




        //------------------ End Flash Card ---------------------------------//






    }

})();