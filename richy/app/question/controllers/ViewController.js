/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('ViewController', ViewController);

    ViewController.$inject = [
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
        // 'Pubnub',
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

    function ViewController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies,topicService) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        // ===== SPEECH INIT =====
        // var voices = [];
        //
        // function loadVoices() {
        //     voices = speechSynthesis.getVoices();
        // }
        //
        // speechSynthesis.onvoiceschanged = loadVoices;
        // loadVoices();
        
        // ======== PASTE ============

        (function () {
        
            function isBlockMode() {
                return vm && vm.mode && vm.mode.id === 8;
            }
        
            // Chặn paste
            document.addEventListener('paste', function (e) {
                if (isBlockMode()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
        
            // Chặn Ctrl+V, Shift+Insert
            document.addEventListener('keydown', function (e) {
                if (!isBlockMode()) return;
        
                var key = (e.key || '').toLowerCase();
        
                if (
                    (e.ctrlKey && key === 'v') ||
                    (e.shiftKey && e.keyCode === 45)
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
        
            // Chặn menu chuột phải
            document.addEventListener('contextmenu', function (e) {
                if (isBlockMode()) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        
            // Chặn kéo thả
            document.addEventListener('drop', function (e) {
                if (isBlockMode()) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        
            document.addEventListener('dragover', function (e) {
                if (isBlockMode()) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        
            // Tắt autocomplete nhưng không phá nhập tay
            document.addEventListener('focus', function (e) {
                if (!isBlockMode()) return;
        
                var el = e.target;
        
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    el.setAttribute('autocomplete', 'off');
                    el.setAttribute('autocorrect', 'off');
                    el.setAttribute('autocapitalize', 'off');
                    el.setAttribute('spellcheck', 'false');
                }
            }, true);
        
        })();

        window.addEventListener('beforeunload', function (e) {
            // Cancel the event
            e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
            e.returnValue = '';
        });

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);

        vm.question = {};
        vm.questions = [];
        vm.questionTable = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};
        vm.answer = null;
        vm.answers = [];

        vm.myUser = {};
        vm.myUser.id = vm.currentUser.id;
        // vm.myUser.username = vm.currentUser.username;
        vm.myUser.name = vm.currentUser.displayName;
        vm.myUser.roles = vm.currentUser.roles;
        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;
        angular.forEach(vm.myUser.roles, function(value, key) {
            if(value.name === "ROLE_VIEWER"){
                vm.isRoleView = true;
            }
            if(value.name === "ROLE_USER"){
                vm.isRoleUser = true;
                console.log('User');
            }
            if(value.name === "ROLE_ADMIN"){
                vm.isRoleAdmin = true;
                console.log('Admin');
            }
        });
        // console.log(vm.myUser);
        // location.reload();

        // if(settings.isViewer == true){
            // console.log('here');
            vm.users = [
                {id: 32,name:'IELTS IELTS'},
                {id: 37,name:'NO ROOT'},
                {id: 26,name:'EM YÊU INH LÍCH'},
                {id: 33,name:'SADDLEBACK'}
            ];
        // }

        vm.haveInHashUsers = false;
        angular.forEach(vm.users, function(value, key) {
            if(value.id == vm.myUser.id){
                vm.haveInHashUsers = true;
            }
        });
        if(vm.haveInHashUsers == false){
            vm.users.push(vm.myUser);
        }

        // if(vm.myUser.id == 39) {
        if(vm.isRoleView == true) {
            vm.selectedUser = {
                id:26,name: 'EM YÊU INH LÍCH'
            };
        } else if(vm.myUser.id != null){
            vm.selectedUser = vm.myUser;
        }

        vm.type = {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"};
        vm.types = [
            {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 2, name: "Filling Gaps", notice: "Fill words in gaps"},
            {id: 3, name: "Filling Gaps Enter", notice: "Fill A-G in gaps"},
            {id: 4, name: "Matching Heading", notice: "Drag and Drop"}
        ];
        //1:writing; 2: wimpy kid; 3: idiom - expression; 4: other

        vm.status = {id: 3, name: "Tất cả"};
        vm.statuses = [
            // {id: 1, name: "Chưa thuộc"},
            // {id: 2, name: "Thuộc"},
            {id: 4, name: "Đánh dấu"},
            {id: 3, name: "Tất cả"}
            // {id: 3, name:"Tất cả"}
        ];

        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 100;
        vm.searchDto.pageSize = 1;
        vm.searchDto.pageIndex = 1;
        vm.currentPosition = 0;
        vm.currentPosition1 = 0;
        vm.currentCard = {};
        vm.currentCard1 = {};
        vm.questions1 = [];

        // vm.ieltsWritingTests = [];
        //
        // vm.ieltsReadingTests = [];
        // vm.ieltsReadingTest = {
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
        //     subQuestions: []
        // };  //create a new test

        vm.totalCard = 0;
        vm.showListFlashCard = false;

        function createQuestionsWithOptions(parents, optionCount) {
            if (!Array.isArray(parents)) {
                throw new Error('parents phải là một array');
            }

            var totalOptions = optionCount || 4;

            if (totalOptions < 2) {
                throw new Error('optionCount phải >= 2');
            }

            function shuffle(arr) {
                var result = arr.slice();
                for (var i = result.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var temp = result[i];
                    result[i] = result[j];
                    result[j] = temp;
                }
                return result;
            }

            function pickRandomWrongAnswers(source, currentId, count) {
                var filtered = source.filter(function(item) {
                    return item.id !== currentId;
                });

                return shuffle(filtered).slice(0, count);
            }

            return parents.map(function(parent) {
                var wrongAnswers = pickRandomWrongAnswers(parents, parent.id, totalOptions - 1)
                    .map(function(item) {
                        return {
                            id: item.id,
                            question: item.question,
                            motherTongue: item.motherTongue,
                            pronounce: item.pronounce,
                            ordinalNumber: item.ordinalNumber,
                            result: false,
                            correct: false
                        };
                    });

                var correctAnswer = {
                    id: parent.id,
                    question: parent.question,
                    motherTongue: parent.motherTongue,
                    pronounce: parent.pronounce,
                    ordinalNumber: parent.ordinalNumber,
                    result: false,
                    correct: true
                };

                return {
                    ...parent,
                    questions: shuffle([correctAnswer].concat(wrongAnswers))
            };
            });
        }


        $scope.pageChanged = function() {
            vm.getPageFlashCard();
        };

        vm.searchDto.questionType = {id: 6};
        vm.searchDto.userId = vm.selectedUser.id;
        vm.numberFlipCard = 6;

        vm.modes = [
            {id:5,name: 'DAILY VOCAB'},
            {id:8,name: 'FILLING GAPS'},
            {id:6,name: 'QUIZ BATTLE 2'},
            {id:7,name: 'QUIZ BATTLE TUG OF WAR'},
            {id:9,name: 'FLIPPING CARD'},
            {id:1,name: 'NORMAL'},
            {id:4,name: 'REWRITE'}
        ];
        vm.mode = {id:5,name: 'DAILY VOCAB'};
        vm.rawQuestions = [];

        vm.getPageFlashCard = function () {
            vm.searchDto.questionType = {id: 6};
            vm.searchDto.userId = vm.selectedUser.id;
            vm.searchDto.pageSize = 5000;
            vm.resetFlipCard();

            if(vm.searchDto.questionTopics == null || vm.searchDto.questionTopics.length <= 0){
                alert('Phải chọn bài từ vựng cần học rồi ấn tìm kiếm');
                return;
            }

            blockUI.start();
            service.getPageForGames(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.rawQuestions = data.content;

                if(vm.mode.id == 9){ // flipping
                    // shuffleArray(data.content);
                    vm.questions = data.content.splice(0,vm.numberFlipCard);
                    angular.forEach(vm.questions, function(value, key) {
                        value.display = true;
                        value.flipped = false;
                    });
                    vm.questions1 = structuredClone(vm.questions);
                    angular.forEach(vm.questions1, function(value, key) {
                        value.duplicate = true;
                        value.flipped = false;
                    });
                    vm.flippingQuestions = vm.questions.concat(vm.questions1);
                    shuffleArray(vm.flippingQuestions);
                } else{
                    vm.questions = shuffleArray(createQuestionsWithOptions(data.content));
                    vm.questions1 = shuffleArray(createQuestionsWithOptions(data.content));
                    // vm.questions = data.content;
                    // vm.questions.arrayNumber = 1;
                    // vm.questions1 = structuredClone(data.content);
                    // vm.questions1.arrayNumber = 2;
                }

                if(vm.mode.id != 8) { //không phải filling gaps
                    vm.doShuffle();
                }

                if(vm.mode.id == 8){ //filling gaps
                    vm.setUpTable();
                    vm.bsTableControl.options.data = vm.questions;
                    vm.bsTableControl.options.totalRows = data.totalElements;
                }

                if(vm.mode.id == 1){ // normal
                    // var tableSource = angular.copy(data.content || []);
                    vm.questionTable = buildQuestionTable(shuffleArray(createQuestionsWithOptions(data.content)));
                }

                //tạm thời
                vm.totalCard = data.totalElements; //cmt tạm
                vm.searchDto.totalItems = data.totalElements;
                vm.currentPosition = 0;
                vm.currentPosition1 = 0;
                if(angular.isUndefined(vm.questions)){
                    vm.questions = [];
                    vm.questions1 = [];
                    vm.currentCard = {};
                    vm.currentCard1 = {};
                    vm.totalCard = 0;
                } else {
                    vm.currentCard = vm.questions[vm.currentPosition];
                    // vm.createQuiz(vm.currentCard);

                    if(vm.mode.id != 5){ //daily
                        vm.currentCard1 = vm.questions1[vm.currentPosition1];
                        // vm.createQuiz(vm.currentCard1,2);
                    }
                    if(vm.mode.id == 8){ // fill gaps
                        vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
                        vm.setUpAudio();
                    }
                    if(vm.mode.id == 7){ // tug of war
                        vm.resetTugOfWarDefault();
                    }
                }
            });
        };

        vm.createQuiz = function (currentCard,player) {
            var mainQuestion = {};
            if(currentCard != null && angular.isDefined(currentCard)){
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

                if(player == 2){
                    shuffleArray(currentCard.questions);
                } else {
                    shuffleArray(currentCard.questions);
                }
            }
        };

        vm.doShuffle = function() {
            vm.questions = shuffleArray(createQuestionsWithOptions(vm.rawQuestions));
            vm.questions1 = shuffleArray(createQuestionsWithOptions(vm.rawQuestions));
            shuffleArray(vm.questions);
            shuffleArray(vm.questions1);
            vm.currentPosition = 0;
            vm.currentPosition1 = 0;
            vm.currentCard = vm.questions[vm.currentPosition];
            vm.currentCard1 = vm.questions1[vm.currentPosition1];
            vm.isShowDetail = false;
            // vm.createQuiz(vm.currentCard);
            // vm.createQuiz(vm.currentCard1);
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

        vm.bsTableControl = {};
        vm.setUpTable = function () {
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
                    columns: service.getTableDefinitionQuestions(),
                    onCheck: function (row, $element) {
                        $scope.$apply(function () {
                            vm.selectedTestResults.push(row);
                        });
                    },
                    onCheckAll: function (rows) {
                        $scope.$apply(function () {
                            vm.selectedTestResults = rows;
                        });
                    },
                    onUncheck: function (row, $element) {
                        var index = utils.indexOf(row, vm.selectedpositiontitles);
                        if (index >= 0) {
                            $scope.$apply(function () {
                                vm.selectedTestResults.splice(index, 1);
                            });
                        }
                    },
                    onUncheckAll: function (rows) {
                        $scope.$apply(function () {
                            vm.selectedTestResults = [];
                        });
                    },
                    onPageChange: function (index, pageSize) {
                        vm.pageSize = pageSize;
                        vm.pageIndex = index;
                        vm.getPage();
                    }
                }
            };
        };


        $scope.chooseFillingGaps = function (index) {
            vm.currentCard = vm.questions[index];
            vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
            vm.finishFillingGaps = "Unfinished";
            vm.percentage = 0;
            vm.allowChangeInformation = false;

            vm.setUpAudio();
            vm.setUpTestResult();
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
        // vm.getQuestionTypes();

        //----------------------- Flash Card -------------------------//
        vm.topics = [];
        vm.topic = {};
        vm.topic.userId = vm.currentUser.id;
        vm.getTopics = function () {
            blockUI.start();
            service.getAllTopics(vm.searchDto).then(function (data) {
                blockUI.stop();
                vm.topics = data;
                // console.log(vm.topics);
            });
        };
        vm.getTopics();

        vm.changePageSize = function () {
            //calculate page index
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.nextCard = function (player) {
            $scope.shutUp();

            if(player == 2){
                // if(vm.currentPosition1 + 1 < vm.searchDto.pageSize){
                if(vm.currentPosition1 + 1 < vm.totalCard){
                    vm.currentPosition1 = vm.currentPosition1 + 1;
                    vm.currentCard1 = vm.questions1[vm.currentPosition1];
                    // vm.createQuiz(vm.currentCard1,2);
                    vm.answerRewriteWord = '';
                    if(!vm.isMuted && vm.mode.id !=4){
                        $scope.sayIt(vm.currentCard1.question);
                    }
                }
            } else {
                // if(vm.currentPosition + 1 < vm.searchDto.pageSize){
                if(vm.currentPosition + 1 < vm.totalCard){
                    vm.currentPosition = vm.currentPosition + 1;
                    vm.currentCard = vm.questions[vm.currentPosition];
                    // vm.createQuiz(vm.currentCard);
                    vm.answerRewriteWord = '';
                    if(!vm.isMuted && vm.mode.id !=4){
                        $scope.sayIt(vm.currentCard.question);
                    }
                }
            }
        };

        vm.backCard = function (player) {
            if(player == 2 ){
                if(vm.currentPosition1 > 0){
                    vm.currentPosition1 = vm.currentPosition1 - 1;
                    vm.currentCard1 = vm.questions1[vm.currentPosition1];
                    // vm.createQuiz(vm.currentCard1);
                    vm.answerRewriteWord = '';
                    if(!vm.isMuted){
                        $scope.sayIt(vm.currentCard1.question);
                    }
                }
            }else {
                if(vm.currentPosition > 0){
                    vm.currentPosition = vm.currentPosition - 1;
                    vm.currentCard = vm.questions[vm.currentPosition];
                    // vm.createQuiz(vm.currentCard);
                    vm.answerRewriteWord = '';
                    if(!vm.isMuted){
                        $scope.sayIt(vm.currentCard.question);
                    }
                }
            }
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
                vm.getPageFlashCard();
            }

            if($stateParams.writingCollectionMode == 2){

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

        vm.showTimer = false;

        vm.topicChange = function () {

            vm.newCard.questionTopics = pushTopic(vm.selectedTopicToAdd);

            if(vm.currentCard === null || typeof(vm.currentCard) !== "undefined"){
                vm.currentCard.questionTopics = pushTopic(vm.selectedTopicToEdit);
            }


        };

        vm.topicChangeItem = function (item) {

            item.questionTopics = pushTopic(item.selectedTopicToEdit);

        };

        vm.title = '';
        vm.searchTopicChange = function () {
            vm.showTimer = false;

            if(vm.mode.id == 5){
                vm.endGame = true;
            }

            vm.title = '';
            vm.searchDto.questionTopics = pushTopic(vm.selectedTopicToSearch);
            for(var i = 0; i < vm.searchDto.questionTopics.length; i++){
                vm.title = vm.title + ' ' + vm.searchDto.questionTopics[i].topic.name;
            }

            if(vm.mode.id == 5){
                // if(vm.testResult.testTakerName == null || vm.testResult.testTakerName.length <= 0){
                //     alert('Phải nhập tên. Ví dụ: Long');
                //     return;
                // }
                // if(vm.class == null || vm.class.id == null){
                //     alert('Phải chọn lớp');
                //     return;
                // }

                if(vm.searchDto.questionTopics == null || vm.searchDto.questionTopics.length <= 0){
                    alert('Phải chọn bài từ vựng cần học rồi ấn tìm kiếm');
                    return;
                }

                // if(vm.allowChangeInformation == true){
                //     vm.testResult.testTakerName = vm.testResult.testTakerName + ' | ' + vm.class.name;
                // }

                vm.isSaveTestResult = false;

                // vm.allowChangeInformation = false;
                vm.finishDailyVocab = "Unfinished";
            }

            if(vm.mode.id == 8){
                // if(vm.testResult.testTakerName == null || vm.testResult.testTakerName.length <= 0){
                //     alert('Phải nhập tên. Ví dụ: Long');
                //     return;
                // }
                // if(vm.class == null || vm.class.id == null){
                //     alert('Phải chọn lớp');
                //     return;
                // }

                if(vm.searchDto.questionTopics == null || vm.searchDto.questionTopics.length <= 0){
                    alert('Phải chọn các bài nghe cần học rồi ấn tìm kiếm');
                    return;
                }

                // if(vm.allowChangeInformation == true){
                //     vm.testResult.testTakerName = vm.testResult.testTakerName + ' | ' + vm.class.name;
                // }

                vm.isSaveTestResult = false;
                vm.percentage = 0;
                vm.numberOfGaps = 0;

                // vm.allowChangeInformation = false;
                vm.finishDailyVocab = "Unfinished";
            }

            if(vm.mode.id == 7){

                if(vm.searchDto.questionTopics == null || vm.searchDto.questionTopics.length <= 0){
                    alert('Phải chọn bài từ vựng rồi ấn tìm kiếm');
                    return;
                }
            }



            vm.showTimer = true;

            // console.log(vm.title);
            vm.currentPosition = 0;
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.newFlashCard = function () {

            if(vm.newCard.question == null || angular.isUndefined(vm.newCard.question)){
                toastr.warning('Please fill in the word');
                return;
            }

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
            item.selectedTopicToEdit = getListTopicFromCard(item.questionTopics);
            item.showDetail = true;
        };

        vm.hideDetailFlashCard = function (item) {
            item.showDetail = false;
        };

        vm.myAnswer = '';
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
            if(vm.myAnswer.toLowerCase().trim() == vm.flashCard.question.toLowerCase()){
                vm.flashCard.timeReviewd = vm.flashCard.timeReviewd + 1;
                vm.flashCard.correctAnswer = vm.flashCard.correctAnswer + 1;
                vm.answer = true;
                service.saveObject(vm.flashCard, function success() {

                    toastr.info('À ghê!!!', 'Cũng kinh đấy :)');
                    service.getOne(vm.flashCard.id).then(function (data) {
                        vm.question = data;
                    });
                }, function failure() {
                    toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                });
            }
            if(vm.myAnswer.toLowerCase().trim() != vm.flashCard.question.toLowerCase()){
                vm.flashCard.timeReviewd = vm.flashCard.timeReviewd + 1;
                vm.flashCard.wrongAnswer = vm.flashCard.wrongAnswer + 1;
                vm.answer = false;
                service.saveObject(vm.flashCard, function success() {

                    toastr.warning('Sai cmnr!!!', 'Vãiii');
                    service.getOne(vm.flashCard.id).then(function (data) {
                        vm.question = data;
                    });
                }, function failure() {
                    toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                });
            }
        };

        vm.showPronunciation = false;
        vm.isShowPronunciation = function () {
            vm.showPronunciation = true;
        };
        vm.showExamples = false;

        vm.isShowExamples = function () {
            vm.showExamples = true;
        };

        function showBackFlashCard(text) {
            const notification = new Notification("Back: " + text,{
                // body: text
            });

        }

        function showNotification() {
            service.getRandomQuestion(vm.searchDto).then(function (data) {
                vm.question = data;
                var question = vm.question.question + " " + vm.question.pronounce;
                var description = '';
                description = vm.question.motherTongue.replace( /(<([^>]+)>)/ig, '');
                $scope.sayIt(vm.question.question);
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

                clearInterval(idInterval);
                idInterval = setInterval(showNotification,vm.timeGap);
            } else if (Notification.permission !== "denied"){
                Notification.requestPermission().then(function (permission) {
                    if(permission === "granted"){

                    }
                });
            }
        };



        vm.statusChange = function () {
            vm.question.status = vm.status.id;
            vm.searchDto.status = vm.status.id;
            vm.currentPosition = 0;
            vm.searchDto.pageIndex = 1;
            vm.getPageFlashCard();
        };

        vm.clickNext = function () {
            if(vm.currentPosition <= vm.questions.length){
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                // vm.createQuiz(vm.currentCard);
            }
        };

        vm.clickBack = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                // vm.createQuiz(vm.currentCard);
            }
        };

        document.body.onkeydown = function(e){
            // alert(e.keyCode);
            // if(!vm.endGame && vm.mode.id != 7) {
            if(!vm.endGame) {
                // player 1
                if (e.keyCode == 81) {
                    var a = document.getElementById('answer-quiz-1-' + 0).click();
                }
                if (e.keyCode == 231 || e.keyCode == 87) {
                    var a = document.getElementById('answer-quiz-1-' + 1).click();
                }
                if (e.keyCode == 65) {
                    var a = document.getElementById('answer-quiz-1-' + 2).click();
                }
                if (e.keyCode == 83) {
                    var a = document.getElementById('answer-quiz-1-' + 3).click();
                }

                // player 2
                if (e.keyCode == 73) {
                    var a = document.getElementById('answer-quiz-2-' + 0).click();
                }
                if (e.keyCode == 79) {
                    var a = document.getElementById('answer-quiz-2-' + 1).click();
                }
                if (e.keyCode == 75) {
                    var a = document.getElementById('answer-quiz-2-' + 2).click();
                }
                if (e.keyCode == 76) {
                    var a = document.getElementById('answer-quiz-2-' + 3).click();
                }
            }
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

            });

        }

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
        const now = new Date();
        const currentDateTime = now.toLocaleString();
        vm.showDateTime = currentDateTime;
        // console.log(currentDateTime);

        vm.tempCounter = 90;

        vm.counterChange = function () {
            if(vm.tempCounter > 9999){
                alert('Not greater than 9999');
                // vm.tempCounter = 900;
                $scope.counter = vm.tempCounter;
                // return;
            }else if (vm.tempCounter <=0) {
                // vm.tempCounter = 900;
                $scope.counter = vm.tempCounter;
                alert('Not lower than 0');
            }else {
                $scope.counter = vm.tempCounter;
            }
        };

        $scope.counter = 90;

        var mytimeout = null; // the current timeoutID
        var audio = document.getElementById("audio-1");
        vm.endGame = true;

        vm.resetBackgroundMusic = function () {
            audio.load();
            var audioNumber = getRndInteger(1,8);
            // console.log(audioNumber);
            if(audioNumber == 1){
                audio = document.getElementById("audio-1");
            }
            if(audioNumber == 2){
                // audio = document.getElementById("audio-2");
                audio = document.getElementById("audio-1");
            }
            if(audioNumber == 3){
                // audio = document.getElementById("audio-3");
                audio = document.getElementById("audio-5");
            }
            if(audioNumber == 4){
                // audio = document.getElementById("audio-4");
                audio = document.getElementById("audio-7");
            }
            if(audioNumber == 5){
                audio = document.getElementById("audio-5");
            }
            if(audioNumber == 6){
                audio = document.getElementById("audio-6");
            }
            if(audioNumber == 7){
                audio = document.getElementById("audio-7");
            }
        };

        vm.noBGMusic = true;

        var sai = document.getElementById("sai");
        var ngao = document.getElementById("ngao");
        var stupid = document.getElementById("stupid");
        var quec = document.getElementById("quec");
        var phaiChiu = document.getElementById("phai-chiu");
        var dungCoKeu = document.getElementById("dung-co-keu");
        var voTayPew = document.getElementById("vo-tay-pew");
        var applause = document.getElementById("applause");
        // var endSound = document.getElementById("end-sound");

        // actual timer method, counts down every second, stops on zero
        $scope.onTimeout = function() {
            if(($scope.counter ===  0 || $scope.counter < 0) && vm.mode.id != 7 ) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Time's up"));
                $scope.counter = 0;
                audio.load();
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            $scope.counter = $scope.counter - 1;

            // if($scope.counter == 0){
            //     vm.endGame = true;
            //
            // }

            if($scope.counter <= 0){
                stopGameByTimeout();

                if((vm.currentPosition + 1) >= vm.totalCard){
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Time's up"));
                    vm.endGame = true;
                    $scope.counter = 0;
                    audio.load();
                    $scope.counter = 0;
                    $scope.$broadcast('timer-stopped', 0);
                    $timeout.cancel(mytimeout);

                    return;

                }
                // else if (vm.showQuestionBattlel3 == true) {
                //     $scope.counter = 3;
                //     vm.showQuestionBattlel3 = false;
                //     battleTimeout = $timeout($scope.setupQuestionBattle3, 3000);
                // }
            }

            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        vm.finishDailyVocab = "Unfinished";
        $scope.startCount = function() {

            if(vm.tempCounter > 9999){
                vm.tempCounter = 900;
                $scope.counter = vm.tempCounter;
                alert('Timer should not be greater than 9999');
                return;
            }else if (vm.tempCounter <=0) {
                vm.tempCounter = 900;
                $scope.counter = vm.tempCounter;
                alert('Timer should not be lower than 0');
                return;
            } else {
            }


            vm.finishDailyVocab = "Unfinished";

            vm.allowChangeInformation = false;

            $scope.refreshTimer();
            vm.doShuffle();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            audio.load();
            if(vm.noBGMusic == false){
                audio.play();
            }

            audio.loop = true;

            vm.endGame = false;
            vm.endGamePlayer1 = false;
            vm.endGamePlayer2 = false;
            vm.blindMode = false;
            vm.streak = 0;
            vm.streakPlayer1 = 0;
            vm.streakPlayer2 = 0;
            vm.wrong = 0;
            vm.wrongPlayer1 = 0;
            vm.wrongPlayer2 = 0;

            vm.score1 = 0;
            vm.score2 = 0;

            if(vm.mode.id != 4){
                $scope.sayIt(vm.currentCard.question);
            }

            if (vm.mode.id == 7) {
                vm.resetTugOfWarDefault();

                // sau khi reset xong mới mở trận
                vm.endGame = false;
                vm.endGamePlayer1 = false;
                vm.endGamePlayer2 = false;

                tuongLai.load();
                tuongLai.play();

                mytimeout = $timeout($scope.onTimeout, 1000);

            }

        };

        $scope.refreshTimer = function () {
            $scope.shutUp();
            $timeout.cancel(mytimeout);
            vm.resetBackgroundMusic();
            if (vm.mode.id == 7) {
                vm.resetTugOfWarDefault();
            }

            vm.endGame = false;
            if(vm.mode.id == 5){
                vm.endGame = true;
            }
            if(vm.players.length === 0){
                vm.indexPlayer = vm.indexPlayer + 1;
                vm.player ={
                    name: 'no name',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
                vm.players.push(vm.player);
                vm.player ={
                    name: '',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
            }
            else if(vm.players[vm.indexPlayer].name.length === 0 && vm.players[vm.indexPlayer].score !== 0){
                vm.indexPlayer = vm.indexPlayer + 1;
                vm.player ={
                    name: 'no name',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
                vm.players.push(vm.player);
                vm.player ={
                    name: '',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
            } else if(vm.players[vm.indexPlayer].name.length !== 0 && vm.players[vm.indexPlayer].score !== 0){
                vm.indexPlayer = vm.indexPlayer + 1;
                vm.player ={
                    name: 'no name',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
                vm.players.push(vm.player);
                vm.player ={
                    name: '',
                    score: 0,
                    timeLeft: 0,
                    highestStreak: 0,
                    wrong: 0
                    // index: 1,
                };
            }

            $scope.counter = vm.tempCounter;
            if(tuongLai != null){
                tuongLai.load();
            }


        };
        //--//

        //answer quiz
        vm.endGame = true;
        vm.blindMode = false;
        vm.blindModeScore = 1500000;
        vm.streak = 0;
        vm.bonusTime = 2;
        vm.wrong = 0;
        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min) ) + min;
        }
        var stillInAQuestion = false;

        vm.answerQuiz = function (correct,item,questions) {

            angular.forEach(questions, function(value, key) {
                value.chosen = false;
            });

            if(correct == true){
                stillInAQuestion = false;
                if((vm.currentPosition + 1) >= vm.totalCard){
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
                        }else{
                        }

                        if(vm.players[vm.indexPlayer].highestStreak < vm.streak){
                            vm.players[vm.indexPlayer].highestStreak = vm.streak;
                        }

                        vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score + 1;
                        vm.nextCard();
                    }
                }

            }else{
                if((vm.currentPosition + 1) >= vm.totalCard){
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("GAME OVER"));

                }else {
                    if(vm.endGame == false) {
			            vm.streak = 0;
                        vm.players[vm.indexPlayer].score = vm.players[vm.indexPlayer].score - 0.5;
                        if(stillInAQuestion == false){
                            vm.players[vm.indexPlayer].wrong = vm.players[vm.indexPlayer].wrong + 1;
                            stillInAQuestion = true;
                        }

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


        vm.score1 = 0;
        vm.score2 = 0;
        vm.answerQuizBattle = function (correct,item,questions,player) { //player1 = 1 player 2 = 2

            angular.forEach(questions, function(value, key) {
                value.chosen = false;
            });

            // item.chosen = true;
            if(correct == true){
                // if((vm.currentPosition + 1) >= vm.searchDto.pageSize){
                if((vm.currentPosition + 1) >= vm.totalCard){
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("GAME OVER"));
                    if(vm.endGame == false){
                        if(player == 1){
                        }
                        if(player == 2){
                        }
                    }
                    vm.endGame = true;

                    $scope.refreshTimer();
                }else{
                    if(vm.endGame == false) {

                        if(vm.blindModeScore == vm.players[vm.indexPlayer].score){
                            vm.blindMode = true;
                        }

                        if(player == 1){
                            vm.score1 = vm.score1 + 1;
                        }
                        if(player == 2){
                            vm.score2 = vm.score2 + 1;
                        }

                        vm.nextCard();
                    }
                }

            }else{
                if(vm.endGame == false) {
                    if(player == 1){
                        vm.score1 = vm.score1 - 0.5;
                    }
                    if(player == 2){
                        vm.score2 = vm.score2 - 0.5;
                    }

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
        };

        vm.streakPlayer1 = 0;
        vm.streakPlayer2 = 0;
        vm.wrongPlayer1 = 0;
        vm.wrongPlayer2 = 0;
        vm.endGamePlayer1 = false;
        vm.endGamePlayer2 = false;
        var stillInAQuestion1 = false;
        var stillInAQuestion2 = false;

        vm.answerQuizBattle2 = function (correct,item,questions,player) { //player1 = 1 player 2 = 2

            console.log(2);
            angular.forEach(questions, function(value, key) {
                value.chosen = false;
            });

            // item.chosen = true;
            if(correct == true){

                if(player == 1){
                    stillInAQuestion1 = false;
                    if((vm.currentPosition + 1) >= vm.totalCard){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Player one is OVER"));
                        if(vm.endGamePlayer1 == false){
                            vm.score1 = vm.score1 + ($scope.counter)/12;
                        }

                        vm.endGamePlayer1 = true;

                        if(vm.endGamePlayer1 && vm.endGamePlayer2){
                            vm.endGame = true;
                            $scope.refreshTimer();
                        }

                    }else{
                        if(vm.endGamePlayer1 == false) {
                            vm.streakPlayer1 = vm.streakPlayer1 + 1;

                            if(vm.streakPlayer1 >= 5){
                                vm.score1 = vm.score1 + parseInt(vm.streakPlayer1/3);
                            }else{
                                vm.score1 = vm.score1 + 1;
                            }

                            vm.nextCard();
                        }
                    }
                } else if(player == 2){
                    stillInAQuestion2 = false;
                    if((vm.currentPosition1 + 1) >= vm.totalCard){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Player two is OVER"));
                        if(vm.endGamePlayer2 == false){
                            vm.score2 = vm.score2 + ($scope.counter)/12;
                        }

                        vm.endGamePlayer2 = true;
                        if(vm.endGamePlayer1 && vm.endGamePlayer2){
                            vm.endGame = true;
                            $scope.refreshTimer();
                        }
                            // $scope.refreshTimer();
                    }else{
                        if(vm.endGamePlayer2 == false) {
                            vm.streakPlayer2 = vm.streakPlayer2 + 1;

                            if(vm.streakPlayer2 >= 5){
                                vm.score2 = vm.score2 + parseInt(vm.streakPlayer2/3);
                            }else{
                                vm.score2 = vm.score2 + 1;

                            }
                            vm.nextCard(2);
                        }
                    }
                }

            }else{
                if(player == 1){
                    if(vm.endGamePlayer1 == false) {
                        if(player == 1){
                            if(stillInAQuestion1 == false){
                                vm.wrongPlayer1 = vm.wrongPlayer1 + 1;
                                stillInAQuestion1 = true;
                                if(vm.streakPlayer1 >= 5){
                                    vm.sayingWhenWrong();
                                }
                            }

                            vm.streakPlayer1 = 0;
                            vm.score1 = vm.score1 - 0.5;
                        }
                    }
                } else if (player == 2){
                    if(vm.endGamePlayer2 == false) {
                        if(player == 2){

                            if(stillInAQuestion2 == false){
                                vm.wrongPlayer2 = vm.wrongPlayer2 + 1;
                                stillInAQuestion2 = true;

                                if(vm.streakPlayer2 >= 5){
                                    vm.sayingWhenWrong();
                                }
                            }

                            vm.streakPlayer2 = 0;
                            vm.score2 = vm.score2 - 0.5;
                        }

                    }
                }
            }
        };

        vm.isSaveTestResult = false;
        vm.showStart = true;
        vm.showWrong = null;
        vm.showCorrect = null;

        vm.linkStart1 = 'https://lh3.googleusercontent.com/pw/AP1GczPEqogicPymXIHsXPhJdbo0Mg6-d5MJE8aJ1w4XbxXWe295w-ZDBc_HmtgDy_iwALkaM_yM99TedpZYmdvz5wbhl4QhdvbL8yEWZBs35wLU7y-iiM4VA-mAYRUmq9JfpUt5fJlaZC4C9P5qhjbcoKgB=w919-h919-s-no-gm?authuser=1';
        vm.linkStart2 = 'https://lh3.googleusercontent.com/pw/AP1GczMlQpFC5mxUfomDjlskHiy-_wKfnSN_YBmA8iWr-f17Ypb5siqavs308dIOTsrDYbQHIA2Ia3__A9jOwMDcP4-NBkJYB4X3iOzJzjfrwxGBzRFunsZof5okn6_0CBTTcHbHFNGrPan_cfnvY6WFLWiR=w919-h919-s-no-gm?authuser=1';

        vm.linkImageCorrect = 'https://lh3.googleusercontent.com/pw/AP1GczMWD3uVqUpqROszj5p_a0W5j2lvpD_Nuh8P0rCmeh03DNmj1CE-XOttzUpK7vWtBgjtbbdsuw_X-i3jskTDSxMloH5U_2scXD-B5BTpTchPfv8h1RQGIgx5PG0e22SHpYo5Pcf4GEIWi-TIxLvOkXMj=w989-h989-s-no-gm?authuser=1';


        vm.changeImageForAnswer = function () {

            if(getRndInteger(1,4) == 1){
                vm.linkImageWrong = 'https://lh3.googleusercontent.com/pw/AP1GczMUHTKwnGcAhVh37rguI5kYNzMR-dOPYNhaBRpzswBtoOsZoqBeuhRquwkh0lWUbxUQo4DoKo3fRB5Rr_0JwpD3L7V5_LIGwp81X866DIWdzqHAFLX6fc2Y-_Vzzl3iemRkC8gRe8nPLHiVHifRotM2=w989-h989-s-no-gm?authuser=1';
                vm.linkImageCorrect = 'https://lh3.googleusercontent.com/pw/AP1GczMWD3uVqUpqROszj5p_a0W5j2lvpD_Nuh8P0rCmeh03DNmj1CE-XOttzUpK7vWtBgjtbbdsuw_X-i3jskTDSxMloH5U_2scXD-B5BTpTchPfv8h1RQGIgx5PG0e22SHpYo5Pcf4GEIWi-TIxLvOkXMj=w989-h989-s-no-gm?authuser=1';
            }else if(getRndInteger(1,4) == 2){
                vm.linkImageWrong = 'https://lh3.googleusercontent.com/pw/AP1GczMjCTwNZ8YxHbhBnhF09K6XlW1HUJ4jeNHgE6wn_Rj2TxKGikeSXYx__oUL7xPWCVNOaPTETUvMJDSIEFgmA4msqSZQ3byIaY37oPaCXOOgxL-XdHqf-glIIIwiN8S1U47I3z3R6z_sq0TtH8T9lpO_=w989-h989-s-no-gm?authuser=1';
                vm.linkImageCorrect = 'https://lh3.googleusercontent.com/pw/AP1GczPL-li6WBV1fJoowvP5987OYY389QGXS01oLKysc4LAW-bljOk4B1wzGhyVRZNdEfP0aX3ajQYvZEFQTWFHQwsWnn1HvgGSOrjdtBamVUbn8BAACuoEXVNQalmz-IlFshHL3d_qYwoVuInT4i8nLVrN=w989-h989-s-no-gm?authuser=1';
            }else if(getRndInteger(1,4) == 3){
                vm.linkImageWrong = 'https://lh3.googleusercontent.com/pw/AP1GczMLB7Qj4lPY1GHl8v__m74-K0sEdJXzLN7Os2wgIcy3UxNRmMiX0BYXM1AB4PjPIwMVMehIoALtnrxoBL8T9O433ZmHh5g94--u4B6yz1BKrKp3bbBVRezoaP8bU1Aedfos5r89SZwni1oz-btiCcbO=w989-h989-s-no-gm?authuser=1';
                vm.linkImageCorrect = 'https://lh3.googleusercontent.com/pw/AP1GczPrexogtWayS4t4D5VRWp3UswdLhwuurFtsvqUe-Qy3HUELJ-N6D8_qSL0PYjemP14C3AcKMo4VO960W_8oaeQxuF5oB5L-9bw6MFkI1BPf6SNmda8y7cK15XqyPx3gul-HKaJKAA58XWRvbrSZu2d2=w989-h989-s-no-gm?authuser=1';
            }else {
                vm.linkImageWrong = 'https://lh3.googleusercontent.com/pw/AP1GczMLB7Qj4lPY1GHl8v__m74-K0sEdJXzLN7Os2wgIcy3UxNRmMiX0BYXM1AB4PjPIwMVMehIoALtnrxoBL8T9O433ZmHh5g94--u4B6yz1BKrKp3bbBVRezoaP8bU1Aedfos5r89SZwni1oz-btiCcbO=w989-h989-s-no-gm?authuser=1';
                vm.linkImageCorrect = 'https://lh3.googleusercontent.com/pw/AP1GczMlQpFC5mxUfomDjlskHiy-_wKfnSN_YBmA8iWr-f17Ypb5siqavs308dIOTsrDYbQHIA2Ia3__A9jOwMDcP4-NBkJYB4X3iOzJzjfrwxGBzRFunsZof5okn6_0CBTTcHbHFNGrPan_cfnvY6WFLWiR=w989-h989-s-no-gm?authuser=1';
            }

            // vm.linkStart = '';

        };

        vm.changeImageForAnswer();

        vm.answerDailyVocab = function (correct,item,questions,player) { //player1 = 1 player 2 = 2

            angular.forEach(questions, function(value, key) {
                value.chosen = false;
            });

            // item.chosen = true;
            if(correct == true){
                vm.changeImageForAnswer();
                vm.showStart = false;
                vm.showWrong = false;
                vm.showCorrect = true;

                if(player == 1){
                    stillInAQuestion1 = false;
                    if((vm.currentPosition + 1) >= vm.totalCard){
                        if(vm.endGamePlayer1 == false){
                            vm.streakPlayer1 = vm.streakPlayer1 + 1;

                            if(vm.streakPlayer1 >= 5){
                                vm.score1 = vm.score1 + parseInt(vm.streakPlayer1/3);
                            }else{
                                vm.score1 = vm.score1 + 1;
                            }

                            vm.score1 = vm.score1 + ($scope.counter)/12;
                            vm.score1 = vm.score1.toFixed(2);
                            vm.currentPosition = vm.currentPosition + 1;
                        }

                        vm.endGamePlayer1 = true;

                        if(vm.endGamePlayer1){
                            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Player one is OVER"));
                            vm.endGame = true;

                            if(vm.isSaveTestResult == false){
                                vm.saveTestResult();
                            }

                            $scope.refreshTimer();
                        }

                    }else{
                        if(vm.endGamePlayer1 == false) {
                            vm.streakPlayer1 = vm.streakPlayer1 + 1;

                            if(vm.streakPlayer1 >= 5){
                                vm.score1 = vm.score1 + parseInt(vm.streakPlayer1/3);
                            }else{
                                vm.score1 = vm.score1 + 1;
                            }

                            vm.nextCard();
                        }
                    }
                } else if(player == 2){
                    stillInAQuestion2 = false;
                    if((vm.currentPosition1 + 1) >= vm.totalCard){
                        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Player two is OVER"));
                        if(vm.endGamePlayer2 == false){
                            vm.score2 = vm.score2 + ($scope.counter)/12;
                        }

                        vm.endGamePlayer2 = true;
                        if(vm.endGamePlayer1 && vm.endGamePlayer2){
                            vm.endGame = true;
                            $scope.refreshTimer();
                        }
                    }else{
                        if(vm.endGamePlayer2 == false) {
                            vm.streakPlayer2 = vm.streakPlayer2 + 1;

                            if(vm.streakPlayer2 >= 5){
                                vm.score2 = vm.score2 + parseInt(vm.streakPlayer2/3);
                            }else{
                                vm.score2 = vm.score2 + 1;

                            }

                            vm.nextCard(2);
                        }
                    }
                }

            }else{ // trả lời sai
                if(player == 1){
                    vm.changeImageForAnswer();
                    vm.showStart = false;
                    vm.showWrong = true;
                    vm.showCorrect = false;

                    if(vm.endGame == false) {
                        if(player == 1){
                            vm.streakPlayer1 = 0;
                            vm.score1 = vm.score1 - 0.5;
                            if(stillInAQuestion1 == false){
                                vm.wrongPlayer1 = vm.wrongPlayer1 + 1;
                                stillInAQuestion1 = true;
                                vm.testResult.testTakerPerformance = vm.testResult.testTakerPerformance + vm.currentCard.question + ' --- ' + vm.currentCard.motherTongue + ' <br> ';
                                vm.tempWrong = vm.testResult.testTakerPerformance;
                            }
                        }
                        vm.sayingWhenWrong();
                    }
                } else if (player == 2){
                    if(vm.endGame == false) {
                        if(player == 2){
                            vm.streakPlayer2 = 0;
                            vm.score2 = vm.score2 - 0.5;
                            if(stillInAQuestion2 == false){
                                vm.wrongPlayer2 = vm.wrongPlayer2 + 1;
                                stillInAQuestion2 = true;
                            }
                        }
                        vm.sayingWhenWrong();
                    }
                }
            }
        };

        vm.sayingWhenWrong = function () {
            if(getRndInteger(1,7) == 1){
                sai.load();
                sai.play();
            }else if(getRndInteger(1,7) == 2){
                // ngao.load();
                // ngao.play();
                phaiChiu.load();
                phaiChiu.play();
            }else if(getRndInteger(1,7) == 3){
                // stupid.load();
                // stupid.play();
                phaiChiu.load();
                phaiChiu.play();
            }else if(getRndInteger(1,7) == 4){
                quec.load();
                quec.play();
            }else if(getRndInteger(1,7) == 5){
                dungCoKeu.load();
                dungCoKeu.play();
            }else if(getRndInteger(1,7) == 6){
                phaiChiu.load();
                phaiChiu.play();
            }else {
                stupid.load();
                stupid.play();
            }
        };

        vm.showQuestionBattlel3 = true;
        var battleTimeout = null;

        vm.score = 0;
        vm.players = [];
        vm.indexPlayer = -1;
        vm.player ={
            name: '',
            score: 0,
            timeLeft: 0,
            highestStreak: 0,
            wrong: 0
            // index: 1,
        };

        vm.putPlayers = function () {
            vm.indexPlayer = vm.indexPlayer + 1;
            vm.players.push(vm.player);
            vm.player ={
                name: '',
                score: 0,
                timeLeft: 0,
                highestStreak: 0,
                wrong: 0
                // index: 1,
            };
        };

        //--//

        vm.classes = [
            {id:10,name: 'CHURCH'},
            {id:1,name: 'GRADE 6'},
            {id:2,name: 'GRADE 7.1'},
            {id:10,name: 'GRADE 7.2'},
            {id:3,name: 'GRADE 8'},
            {id:4,name: 'GRADE 9'},
            {id:5,name: 'GRADE 10'},
            {id:6,name: 'GRADE 11'},
            {id:7,name: 'GRADE 12'},
            {id:8,name: 'iSpa07'},
            {id:9,name: 'iSpa09'},
        ];
        vm.class = null;

        if(vm.mode.id == 6 || vm.mode.id == 5 || vm.mode.id == 7){
            $scope.counter = 900;
            vm.tempCounter = 900;
        }

        if(vm.mode.id == 7){
            $scope.counter = 180;
            vm.tempCounter = 180;
        }

        var tuongLai = null;
        vm.modeChange = function () {
            if(vm.mode.id == 4){
                vm.doShuffle();
            }

            if(vm.mode.id == 6 || vm.mode.id == 7){
                $scope.counter = 900;
                vm.tempCounter = 900;
            }

            if(vm.mode.id == 7){
                $timeout(function () {
                    tuongLai = document.getElementById('tuong-lai');
                });
                if(tuongLai != null){
                    tuongLai.load();
                }

                $scope.counter = 180;
                vm.tempCounter = 180;
                vm.resetTugOfWarDefault();
            }
        };

        vm.answerRewriteWord = '';

        vm.playQuiz = function () {
            if(vm.isPlayQuiz == true){
                vm.isPlayQuiz = false;
            }else{
                vm.isPlayQuiz = true;
            }
        };

        vm.searchDto.numberOfAnswers = 4;
        vm.showQuestion = false;
        vm.showMotherTongue = true;

        //old//
        vm.isMuted = false;

        vm.showVoiceOption = true;
        vm.loop = true;

        /*
         * Check for browser support
         */
        var supportMsg = document.getElementById('msg');

        if ('speechSynthesis' in window) {
            supportMsg.innerHTML = 'Your browser <strong>supports</strong> speech synthesis.';
        } else {
            supportMsg.innerHTML = 'Sorry your browser <strong>does not support</strong> speech synthesis.<br>Try this in <a href="https://www.google.co.uk/intl/en/chrome/browser/canary.html">Chrome Canary</a>.';
            supportMsg.classList.add('not-supported');
        }

// Get the voice select element.
        var voiceSelect = document.getElementById('voice');

        // Get the attribute controls.
        var volumeInput = document.getElementById('volume');
        var rateInput = document.getElementById('rate');
        var pitchInput = document.getElementById('pitch');

        vm.allVoices = null;

        function isIOS() {
            const userAgent = navigator.userAgent || navigator.vendor || (window.opera && opera.toString() === '[object Opera]');
            // Regular expression to check for common iOS device identifiers
            return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        }

        // Fetch the list of voices and populate the voice options.
        var voices = speechSynthesis.getVoices();
        function loadVoices() {
            // Fetch the available voices.
            // var voices = speechSynthesis.getVoices();
            vm.allVoices = voices;

            // Loop through each of the voices.
            voices.forEach(function (voice, i) {
                // Create a new option element.
                // console.log(voice);

                //english
                if(angular.isDefined(voice) && voice != null){
                    if(angular.isDefined(voice.lang) && voice.lang != null && voice.lang.length > 0){

                        if (isIOS()) {
                            //ios
                            if((voice.lang == 'en-GB' && voice.name == 'Daniel')
                                || (voice.lang == 'en-AU' && voice.name == 'Karen')
                                || (voice.lang == 'en-US' && voice.name == 'Samantha')  ){

                                var option = document.createElement('option');

                                // Set the options value and text.
                                option.value = voice.name;
                                option.innerHTML = voice.name;

                                // Add the option to the voice selector.
                                voiceSelect.appendChild(option);

                            }
                        } else {
                            if(voice.lang == 'en-US' || voice.lang == 'en-GB'){
                                var option = document.createElement('option');

                                // Set the options value and text.
                                option.value = voice.name;
                                option.innerHTML = voice.name;

                                // Add the option to the voice selector.
                                voiceSelect.appendChild(option);
                            }
                        }

                    }
                }

                //all languages

                // var option = document.createElement('option');
                //
                // // if(voice.lang === 'vi-VN'){
                //     // Set the options value and text.
                //     option.value = voice.name;
                //     option.innerHTML = voice.name;
                //
                //     // Add the option to the voice selector.
                //     voiceSelect.appendChild(option);
                // // }
            });
        }

        // Execute loadVoices.
        loadVoices();

        // Chrome loads voices asynchronously.
        window.speechSynthesis.onvoiceschanged = function (e) {
            // console.log('hello');
            loadVoices();
        };

        // warm up (fix mất chữ đầu + delay)
        (function () {
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            speechSynthesis.speak(u);
        })();

// Create a new utterance for the specified text and add it to
// the queue.
//         const synth = window.speechSynthesis;

        function speak(text) {
            // Create a new instance of SpeechSynthesisUtterance.
            var msg = new SpeechSynthesisUtterance();

            // Set the text.
            msg.text = text;

            // Set the attributes.
            msg.volume = parseFloat(volumeInput.value);
            msg.rate = parseFloat(rateInput.value);
            msg.pitch = parseFloat(pitchInput.value);

            // If a voice has been selected, find the voice and set the
            // utterance instance's voice attribute.
            if (voiceSelect.value) {
                msg.voice = speechSynthesis.getVoices().filter(function (voice) {
                    return voice.name == voiceSelect.value;
                })[0];
            }

            // Queue this utterance.
            window.speechSynthesis.speak(msg);

            msg.addEventListener("end", (event) => {
                if(vm.loopSpeech === true){
                window.speechSynthesis.speak(msg);
            }
        });
        }

        vm.test = null;
        vm.loopSpeech = false;
        // $scope.sayIt = function (text) {
        //     if (!vm.isMuted) {
        //
        //         if (window.speechSynthesis.speaking) {
        //             window.speechSynthesis.cancel();
        //         }
        //
        //         speak(text);
        //
        //     }
        // };

        $scope.sayIt = function (text) {
            if (!text) return;

            const u = new SpeechSynthesisUtterance(' ' + text);

            u.rate = 1;
            u.pitch = 1;
            u.volume = 1;

            const v = voices.find(v => v.lang && v.lang.includes('en'));
            if (v) u.voice = v;

            speechSynthesis.pause();
            speechSynthesis.resume();
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
        };

        $scope.shutUp = function () {
            window.speechSynthesis.cancel();
        };
        $scope.shutUp();


        vm.clickAnswerRewriteWord = function () {

            if(vm.endGame == true){
                return;
            }

            vm.answerRewriteWord = vm.answerRewriteWord.trim();
            vm.answerRewriteWord = vm.answerRewriteWord.toLowerCase();

            var root = '';

            root = vm.currentCard.question.trim();
            root = vm.currentCard.question.toLowerCase();

            if(vm.answerRewriteWord.trim() == root){
                // toastr.info('Correct !!!');
                vm.nextCard();
            } else {
                // toastr.error('Wrong !!!');

                vm.wrong = vm.wrong + 1;

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

        };

        vm.typeAnswerRewriteWord = function () {
            if(vm.endGame == true){
                return;
            }

            if(event.keyCode == 13){//Phím Enter
                vm.answerRewriteWord = vm.answerRewriteWord.trim();
                vm.answerRewriteWord = vm.answerRewriteWord.toLowerCase();

                var root = '';

                root = vm.currentCard.question.trim();
                root = vm.currentCard.question.toLowerCase();

                if(vm.answerRewriteWord.trim() == root){
                    vm.nextCard();
                } else {
                    vm.wrong = vm.wrong + 1;

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

        vm.chooseUsers = function () {
            // vm.getQuestionTypes();
            // vm.getPageFlashCard();
            vm.searchDto.userId = vm.selectedUser.id;
            vm.getTopics();
        };


        var fifteenSec = document.getElementById("15s");
        var tenSec = document.getElementById("10s");
        vm.fifteenSeconds = function () {
            fifteenSec.load();
            fifteenSec.play();
        };

        vm.tenSeconds = function () {
            tenSec.load();
            tenSec.play();
        };

        vm.loadAudio = function () {
            tenSec.load();
            fifteenSec.load();
        };

        $(document).keydown(function (event) {
            if (event.keyCode == 123) { // Prevent F12
                return false;
            } else if (event.ctrlKey && event.shiftKey && event.keyCode == 73) { // Prevent Ctrl+Shift+I
                return false;
            }
        });

        vm.testResult = {};
        vm.setUpTestResult = function () {
            // var testTakerName = '';
            // if(vm.testResult.testTakerName != null && angular.isDefined(vm.testResult.testTakerName) && vm.testResult.testTakerName.length > 0){
            //     testTakerName = vm.testResult.testTakerName;
            // }
            vm.testResult = {};
            // vm.testResult.testTakerName = testTakerName;
            vm.testResult.user = vm.currentUser;
            vm.testResult.testTakerPerformance = '';
            // vm.tempWrong = vm.testResult.testTakerPerformance;
            if(vm.mode.id == 5){
                vm.testResult.totalWord = vm.totalCard;
            }
            // if(vm.mode.id != 8){
            //     vm.allowChangeInformation = true;
            // }
            vm.isSaveTestResult = false;
        };
        vm.setUpTestResult();

        vm.tempWrong = '';
        vm.saveTestResult = function () {
            vm.tempWrong = vm.testResult.testTakerPerformance;
            if(vm.mode.id == 8){
                vm.testResult.testType = 3; //FILLING GAPS
                vm.testResult.testName = vm.currentCard.question;
                vm.testResult.testTime = "GAPS " + vm.percentage +"%";
            }else if (vm.mode.id == 5) {
                vm.testResult.testType = 1; //DAILY VOCAB
                vm.testResult.testName = vm.title.substring(0,50);
                // vm.testResult.testTime = vm.totalCard.toString() +  ' WORD(s) | '+ vm.score1.toString() +'pt' + ' | STREAK: ' + vm.streakPlayer1 + '| INCORRECT: ' + vm.wrongPlayer1.toString() + '| TIME: ' + $scope.counter + '/'+ vm.tempCounter;
                vm.testResult.testTime = vm.totalCard.toString() +  ' WORD(s)|' + vm.score1.toString() + 'pt' + '|INCORRECT: ' + vm.wrongPlayer1.toString() + '|TIME: ' + $scope.counter + '/'+ vm.tempCounter;
                vm.testResult.numberOfWords = vm.totalCard - vm.wrongPlayer1;
                vm.testResult.totalWord = vm.totalCard;
            }

            blockUI.start();
            service.saveTestResult(vm.testResult).then(function (data1) {
                blockUI.stop();

                if(data1.messageCode == 1){
                    toastr.error('Sai quá nhiều => chưa đạt', 'Thông báo');
                }else {
                    toastr.info('Lưu thành công', 'Thông báo');
                }

                // vm.setUpTestResult();
                if(vm.mode.id != 8){
                    vm.setUpTestResult();
                    console.log(data1.id);
                }

                if(vm.mode.id == 8) {
                    vm.testResult.id = data1.id;
                    // vm.finishListening = "Finished";
                    vm.finishFillingGaps = "Finished";
                    // vm.percentage = 0;
                } else if (vm.mode.id == 5 && data1.messageCode == 0) {
                    vm.finishDailyVocab = "Finished";
                }
            }, function success() {
            }, function failure() {
                toastr.error('Có lỗi xảy ra.', 'Thông báo');
            });
        };

        //--filling gaps
        vm.fillingGapQuestion = '';
        var mainAudio = null;
        var playBackInput = null;
        var loadVideoYouTube = null;

        vm.playbackValue = 1.0;
        vm.volumeValue = 1.0;

        vm.setUpAudio = function () {
            mainAudio = document.getElementById('main-audio');
            playBackInput = document.getElementById('play-back-input');
            mainAudio.src = vm.currentCard.pronounce; // local server
            mainAudio.load();
            mainAudio.loop = true;
        };

        // vm.setUpVideo = function () {
        //     loadVideoYouTube = document.getElementById('load-video-youtube');
        //     loadVideoYouTube.src = vm.currentCard.pronounce; // local server
        // };

        vm.backForthAudio = function () {
            if(event.keyCode == 37){
                vm.backwardAudio();
            }
            if(event.keyCode == 39){
                vm.forwardAudio();
            }
        };

        vm.increaseSpeed = function () {
            if(vm.playbackValue >= 4){
                return;
            }

            vm.playbackValue = vm.playbackValue + 0.1;

            mainAudio.playbackRate  = vm.playbackValue;
            loadVideoYouTube.playbackRate  = vm.playbackValue;
            // loadVideo.playbackRate  = vm.playbackValue;
        };

        vm.decreaseSpeed = function () {
            if(vm.playbackValue <= 0.6){
                return;
            }

            vm.playbackValue = vm.playbackValue - 0.1;

            mainAudio.playbackRate  = vm.playbackValue;
            loadVideoYouTube.playbackRate  = vm.playbackValue;
        };

        vm.increaseVolume = function () {
            if(vm.volumeValue >= 1){
                return;
            }

            vm.volumeValue = vm.volumeValue + 0.05;

            mainAudio.volume  = vm.volumeValue;
            // loadVideoYouTube.volume  = vm.volumeValue;
            // loadVideo.playbackRate  = vm.playbackValue;
        };

        vm.decreaseVolume = function () {
            if(vm.volumeValue <= 0){
                return;
            }

            vm.volumeValue = vm.volumeValue - 0.05;

            mainAudio.volume  = vm.volumeValue;
            // loadVideoYouTube.volume  = vm.volumeValue;
        };

        vm.backwardAudio = function () {
            var currentTime = mainAudio.currentTime;
            var timeValue = 3;
            if(currentTime < timeValue){
                mainAudio.currentTime = 0;
            }else{
                mainAudio.currentTime = currentTime - timeValue;
            }
        };

        vm.forwardAudio = function () {
            var currentTime = mainAudio.currentTime;
            var timeValue = 3;
            if((currentTime + timeValue) > mainAudio.duration){
                mainAudio.currentTime = mainAudio.duration;
            }else{
                mainAudio.currentTime = currentTime + timeValue;
            }
        };

        vm.backForthVideo = function () {
            if(event.keyCode == 37){
                vm.backwardVideo();
            }
            if(event.keyCode == 39){
                vm.forwardVideo();
            }
        };


        vm.pauseAudio = function () {
            if(event.keyCode == 32){
                if (mainAudio.paused) {
                    mainAudio.play();
                } else {
                    mainAudio.pause();
                }
            }
        };

        // This function converts the string to lowercase, then perform the conversion
        function toLowerCaseNonAccentVietnamese(str) {
            str = str.toLowerCase();
            str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
            str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
            str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
            str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
            str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
            str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
            str = str.replace(/đ/g, "d");
            str = str.replace(/ð/g, "d");
            // Some system encode vietnamese combining accent as individual utf-8 characters
            str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // Huyền sắc hỏi ngã nặng
            str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
            return str;
        }

        // This function keeps the casing unchanged for str, then perform the conversion
        function toNonAccentVietnamese(str) {
            str = str.replace(/A|Á|À|Ã|Ạ|Â|Ấ|Ầ|Ẫ|Ậ|Ă|Ắ|Ằ|Ẵ|Ặ/g, "A");
            str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
            str = str.replace(/E|É|È|Ẽ|Ẹ|Ê|Ế|Ề|Ễ|Ệ/, "E");
            str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
            str = str.replace(/I|Í|Ì|Ĩ|Ị/g, "I");
            str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
            str = str.replace(/O|Ó|Ò|Õ|Ọ|Ô|Ố|Ồ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ỡ|Ợ/g, "O");
            str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
            str = str.replace(/U|Ú|Ù|Ũ|Ụ|Ư|Ứ|Ừ|Ữ|Ự/g, "U");
            str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
            str = str.replace(/Y|Ý|Ỳ|Ỹ|Ỵ/g, "Y");
            str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
            str = str.replace(/Đ/g, "D");
            str = str.replace(/đ/g, "d");
            str = str.replace(/ð/g, "d");
            // Some system encode vietnamese combining accent as individual utf-8 characters
            str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // Huyền sắc hỏi ngã nặng
            str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
            return str;
        }

        vm.exactAnswer = false;
        function processText(text) {
            var regex = /(<([^>]+)>)/ig
                , body = text
                , answer = body.replace(regex, ""); //remove html


            if (vm.exactAnswer === false) {
                //answer = answer.toLowerCase();
                //answer = answer.replace('ð','đ');
                answer = toLowerCaseNonAccentVietnamese(answer);
                answer = toNonAccentVietnamese(answer);
                answer = (answer.replace(/[`~!@#$%^&£*()_|+\-=?;:'"“”‘’,.<>\{\}\[\]\\\/]/gi, '')).replace(/  +/g, ' '); //special characters
                // answer = answer.toLowerCase();
                answer = answer.trim();


                answer = answer.replace(/  +/g, ' ');//redundant spaces


                answer = answer.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); //deaccent
                answer = stringToSlug(answer);
            }else{
                answer = (answer.replace(/[`~!@#$%^&£*()_|+\-=?;:'"“”‘’,.<>\{\}\[\]\\\/]/gi, '')).replace(/  +/g, ' '); //special characters
                answer = answer.toLowerCase();
                answer = answer.trim();


                answer = answer.replace(/  +/g, ' ');//redundant spaces
            }

            return answer;
        }

        function stringToSlug(str) {
            // remove accents
            var from = "àáãảạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđùúủũụưừứửữựòóỏõọôồốổỗộơờớởỡợìíỉĩịäëïîöüûñçýỳỹỵỷ",
                to = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeduuuuuuuuuuuoooooooooooooooooiiiiiaeiiouuncyyyyy";
            for (var i = 0, l = from.length; i < l; i++) {
                str = str.replace(RegExp(from[i], "gi"), to[i]);
            }

            str = str.toLowerCase()
                .trim()
                .replace(/[^a-z0-9\-]/g, ' ')
                .replace(/-+/g, ' ');

            return str;
        }


        function findMistakes(a, b) {
            var result = {};
            var textRight = '';
            var textFalse = '';
            var x = a.split(" ");
            var y = b.split(" ");

            for (var i = 0; i < x.length; i++) {
                if (x[i] === y[i]) {
                    textRight = textRight + " " + x[i];
                } else {
                    textFalse = textRight + " " + y[i];
                    textRight = textRight + " " + x[i];
                    break;
                }
            }

            result.textRight = textRight.trim();
            result.textFalse = textFalse.trim();
            // console.log(result);
            return result;
        }

        vm.result = {};
        vm.clickAnswer = function () {
            var a = processText(vm.currentCard.question);
            var b = processText(vm.currentCard.answer);
            // console.log(a);
            // console.log(b);

            if(a === b){
                toastr.success('Yesss !!!');
            }else {
                vm.result = findMistakes(a,b);
                toastr.error('Wrong !!!');
            }
        };

        //filling gaps
        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min) ) + min;
        }

        function isStrictlyNumber(value) {
            return typeof value === 'number';
        }

        function isFirstLetterCapital(str) {
            // console.log(Number(str));

            if (str.length === 0) {
                return false; // Handle empty strings
            }
            const firstLetter = str.charAt(0);

            return firstLetter === firstLetter.toUpperCase();
        }

        function checkIfDateOrNumber(str) {
            str = processText(str);
            if(!Number.isNaN(Number(str)) && angular.isNumber(Number(str))){
                // console.log(str);
                return true;
            }

            if(str.toLowerCase() === 'monday' || str.toLowerCase() === 'mondays'
            || str.toLowerCase() === 'tuesday' || str.toLowerCase() === 'tuesdays'
                || str.toLowerCase() === 'wednesday' || str.toLowerCase() === 'wednesdays'
                || str.toLowerCase() === 'thursday' || str.toLowerCase() === 'thursdays'
                || str.toLowerCase() === 'friday' || str.toLowerCase() === 'fridays'
                || str.toLowerCase() === 'saturday' || str.toLowerCase() === 'saturdays'
                || str.toLowerCase() === 'sunday' || str.toLowerCase() === 'sundays'
                || str.toLowerCase() === 'january'
                || str.toLowerCase() === 'february'
                || str.toLowerCase() === 'march'
                || str.toLowerCase() === 'april'
                || str.toLowerCase() === 'may'
                || str.toLowerCase() === 'june'
                || str.toLowerCase() === 'july'
                || str.toLowerCase() === 'august'
                || str.toLowerCase() === 'september'
                || str.toLowerCase() === 'october'
                || str.toLowerCase() === 'november'
                || str.toLowerCase() === 'december'){
                // console.log(str);
                return true;
            }
            return false;
        }

        // vm.numberOfGaps = 0;
        function processFillingGaps(text) {
            vm.numberOfGaps = 0;
            // text = processText(text);
            var x = text.split(" ");
            var indexGap = 0;
            var processedText = '';
            var previousIndex = null;
            for (var i = 0; i < x.length; i++) {
                var randomNumber = getRndInteger(1, 4);
                if(checkIfDateOrNumber(x[i]) === true){
                    x[i] = processText(x[i]);
                    vm.numberOfGaps = vm.numberOfGaps + 1;
                    indexGap++;
                    var input = '<input autocomplete="off" ng-keyup="vm.backForthAudio();vm.pauseAudio();vm.speakSingleWord(e,'+ "'"  + x[i] + "'" +');vm.fillingGaps(' + x.length + ',' + i + ',vm.currentCard.motherTongue)" class="input-underline-only" type="text" style="width: 70px" id="gap-number-' + i + '"' + '/>' +
                        '<i class="fa fa-volume-up" style="cursor:pointer;font-size: 10px" ng-click="sayIt(' + "'"  + x[i] + "'" + ')"></i>';
                    processedText = processedText + " " + input;
                    previousIndex = i;
                }else if (isFirstLetterCapital(x[i])){
                    processedText = processedText + ' ' + x[i];
                }else if (randomNumber === 2 || randomNumber === 3) {
                    processedText = processedText + ' ' + x[i];
                } else {
                    x[i] = processText(x[i]);
                    vm.numberOfGaps = vm.numberOfGaps + 1;
                    indexGap++;
                    var input = '<input autocomplete="off" ng-keyup="vm.backForthAudio();vm.pauseAudio();vm.speakSingleWord(e,'+ "'"  + x[i] + "'" +');vm.fillingGaps(' + x.length + ',' + i + ',vm.currentCard.motherTongue)" class="input-underline-only" type="text" style="width: 70px" id="gap-number-' + i + '"' + '/>' +
                        '<i class="fa fa-volume-up" style="cursor:pointer;font-size: 10px" ng-click="sayIt(' + "'"  + x[i] + "'" + ')"></i>';
                    processedText = processedText + " " + input;
                    previousIndex = i;
                }
            }

            return processedText;
        }

        function isHaveMistake(a, b, index) {
            var result = {};
            var textRight = '';
            var textFalse = '';
            var x = a.split(" ");
            var y = b.split(" ");

            var rest = true;

            for(var i = 0; i <= index; i++){
                if(x[i] === y[i]){
                    rest = false;

                }else {
                    rest = true;
                    return rest;
                }
            }

            return rest;
        }

        vm.speakSingleWord = function (e,text) {
            if(event.keyCode == 13){//Phím Enter
                $scope.sayIt(text);
            }
        };

        vm.finishFillingGaps = "Unfinished";
        // vm.testResult.testTakerPerformance = '';
        vm.percentage = 0;
        vm.fillingGaps = function (maxIndex, index, motherTongue) {
            // console.log(previousIndex);

            var x = motherTongue.split(" ");
            var gap = document.getElementById('gap-number-' + index).value;

            angular.forEach(x, function (value, key) {
                if (key === index) {
                    x[key] = gap;
                }
            });

            var y = '';
            angular.forEach(x, function (value, key) {
                y = y + " " + value;
            });

            vm.currentCard.fillingGapsAnswer = y;

            var a = processText(vm.currentCard.motherTongue);
            var b = processText(vm.currentCard.fillingGapsAnswer);

            if (!isHaveMistake(a, b, index)) {
                var nextIndex = index + 1;
                var inputId = 'gap-number-' + index;
                var id = 'gap-number-' + nextIndex;
                var nextGap = document.getElementById(id);

                const input = document.getElementById(inputId);
                input.style.background = 'rgba(183, 244, 216, 0.7)';

                if (nextGap === null) {
                    do {
                        // console.log('loop');
                        nextIndex = nextIndex + 1;
                        id = 'gap-number-' + nextIndex;
                        nextGap = document.getElementById(id);
                        if (nextGap !== null) {
                            // jQuery(id).trigger( e );
                            document.getElementById(id).focus();
                        }
                    } while (nextGap === null && nextIndex < maxIndex);
                } else {
                    // jQuery(id).trigger( e );
                    document.getElementById(id).focus();
                }

                if (nextGap === null) {
                    if(vm.mode.id != 8){
                        if(vm.currentPosition == 0 ) {
                            vm.nextCard();
                            vm.backCard();
                        } else{
                            vm.backCard();
                            vm.nextCard();
                        }
                    }
                }

                var complete = true;
                var numberOfCorrectAnswers = 0;
                for(var k = 0; k < maxIndex; k++){
                    if(document.getElementById('gap-number-' + k) != null){
                        var l = document.getElementById('gap-number-' + k).value;
                        if(l == null || l.length <= 0){
                            complete = false;
                        } else {
                            numberOfCorrectAnswers = numberOfCorrectAnswers + 1;
                        }
                    }
                }
                vm.percentage = (numberOfCorrectAnswers/vm.numberOfGaps)*100;
                vm.percentage = vm.percentage.toFixed(2);
                if(complete == true){
                    vm.saveTestResult();
                }
            }
        };


        vm.clickAnswerFillingGaps = function () {
            var a = processText(vm.currentCard.question);
            var b = processText(vm.currentCard.answer);
            console.log(a);
            console.log(b);

            if(a === b){
                toastr.success('Yesss !!!');
            }else {
                vm.result = findMistakes(a,b);
                toastr.error('Wrong !!!');
            }
        };
        //---filling gaps--//

        //youtube//
        vm.focusYoutube = function () {
            var player = document.getElementById("movie-player");
            player.focus();
        };
        //youtube//


        // flipping
        vm.flip1 = null;
        vm.flip2 = null;
        vm.flip3 = null;
        vm.currentIndex = -1;
        vm.inProcess = null;
        vm.reward = {};
        // vm.isFlipped = false;


        vm.clickFlipCard = function (item,index) {
            console.log(0);

            //click liên tục vào 1 cái
            if(vm.currentIndex == index){
                item.flipped = true;
                return;
            }else{
                vm.currentIndex = index;
            }

            //không được lật cái thứ 3
            if(vm.inProcess == true){
                item.flipped = false;
                return;
            }


            // xử lý chính
            if(vm.flip1 == null){
                vm.flip1 = item;
            } else if(vm.flip2 == null) {
                vm.flip2 = item;
            } else {
                item.flipped = false;
            }

            if(vm.flip1 != null && vm.flip2 != null){
                vm.inProcess = true;
                //check if match
                if(vm.flip1.id == vm.flip2.id){
                    var timeoutFlip1;
                    timeoutFlip1 = $timeout(function(){

                        angular.forEach(vm.flippingQuestions, function(value, key) {
                            if(value.id === item.id){
                                value.display = false;
                            }
                        });
                        vm.flip1 = null;
                        vm.flip2 = null;
                        vm.currentIndex = -1;
                        vm.inProcess = false;

                        vm.reward = vm.rewards[Math.floor(Math.random()*vm.rewards.length)];

                        var modalInstance = modal.open({
                            animation: true,
                            templateUrl: 'reward.html',
                            scope: $scope,
                            size: 'md',
                            backdrop: 'static'
                        });

                        modalInstance.result.then(function (confirm) {
                            if (confirm == 'yes') {
                            }
                        }, function () {
                        });

                        if(vm.reward.type == 1){
                            // if(getRndInteger(1,3) == 1){
                            //     voTayPew.load();
                            //     voTayPew.play();
                            // }else if(getRndInteger(1,3) == 2){
                            //     applause.load();
                            //     applause.play();
                            // } else {
                            //     applause.load();
                            //     applause.play();
                            // }
                            applause.load();
                            applause.play();
                        } else if(vm.reward.type == 2){
                            if(getRndInteger(1,4) == 1){
                                phaiChiu.load();
                                phaiChiu.play();
                            }else if(getRndInteger(1,4) == 2){
                                dungCoKeu.load();
                                dungCoKeu.play();
                            }else if(getRndInteger(1,4) == 3){
                                voTayPew.load();
                                voTayPew.play();
                            } else {
                                phaiChiu.load();
                                phaiChiu.play();
                            }
                        }

                    },1500);

                } else {
                    var timeoutFlip2;
                    timeoutFlip2 = $timeout(function(){
                        vm.resetFlipCard();
                    },2000);
                }
            }
        };

        vm.resetFlipCard = function (flip1,flip2) {

            angular.forEach(vm.flippingQuestions, function(value, key) {

                value.flipped = false;

            });

            vm.flip1 = null;
            vm.flip2 = null;
            vm.flip3 = null;
            vm.currentIndex = -1;
            vm.inProcess = false;

            // function secondCallFunction() {
            //     var timeoutFlip2;
            //     timeoutFlip2 = $timeout(function(){
            //         flip1.click();
            //         flip1.click();
            //
            //     },200);
            // }
            //
            // function firstCallFunction(myCallback) {
            //     var timeoutFlip1;
            //     timeoutFlip1 = $timeout(function(){
            //         flip1 = document.getElementById("flip-card-number-"+number1);
            //         flip2 = document.getElementById("flip-card-number-"+number2);
            //         console.log('here');
            //     },300);
            // }
            //
            // firstCallFunction(secondCallFunction);

        };

        vm.textReward = '';
        vm.textPunishment = '';

        vm.rewards = [];
        vm.punishments = [];

        vm.setUpReward = function () {
            vm.rewards = [];
            vm.punishments = [];

            var x = vm.textReward.split("\n");
            var y = vm.textPunishment.split("\n");

            for(var i = 0; i<x.length;i++){
                var reward = {};
                reward.id = i;
                reward.text = x[i];
                reward.type = 1; // thuong

                vm.rewards.push(reward);
            }

            for(var i = 0; i<y.length;i++){
                var punishment = {};
                punishment.id = i;
                punishment.text = y[i];
                punishment.type = 2; // thuong

                vm.punishments.push(punishment);
            }

            for(var i = 0; i < vm.punishments.length; i++){
                vm.rewards.push(vm.punishments[i]);
            }

            // console.log(vm.rewards);

            vm.isShowHidesetUpReward = false;

            toastr.info('Set up successfully');
        };

        vm.isShowHidesetUpReward = true;
        vm.showHideSetUpReward = function () {
            if(vm.isShowHidesetUpReward){
                vm.isShowHidesetUpReward = false;
            } else{
                vm.isShowHidesetUpReward = true;
            }
        };


        // flipping

        //------------------ End Flash Card ---------------------------------//

        function buildQuestionTable(data) {
            function shuffleArray(arr) {
                var array = angular.copy(arr || []);
                for (var i = array.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var temp = array[i];
                    array[i] = array[j];
                    array[j] = temp;
                }
                return array;
            }

            return (data || []).map(function (item) {
                var rawQuestions = angular.copy(Array.isArray(item.questions) ? item.questions : []);
                var questions = [];

                // Chuẩn hóa dữ liệu từ item.questions
                angular.forEach(rawQuestions, function (q) {
                    if (!q) return;

                    questions.push({
                        id: q.id || null,
                        question: q.question || '',
                        motherTongue: q.motherTongue || '',
                        correct: q.correct === true || q.result === true
                    });
                });

                // Nếu đáp án đúng chưa có trong questions thì thêm từ object cha
                var hasMainQuestion = false;

                angular.forEach(questions, function (q) {
                    if (
                        (q.id != null && item.id != null && q.id === item.id) ||
                        ((q.question || '').trim().toLowerCase() === (item.question || '').trim().toLowerCase())
                    ) {
                        hasMainQuestion = true;
                        q.correct = true;
                        q.question = q.question || item.question || '';
                        q.motherTongue = q.motherTongue || item.motherTongue || '';
                    }
                });

                if (!hasMainQuestion) {
                    questions.push({
                        id: item.id || null,
                        question: item.question || '',
                        motherTongue: item.motherTongue || '',
                        correct: true
                    });
                }

                // Loại trùng nhưng giữ thứ tự
                var uniqueQuestions = [];
                var seen = {};

                angular.forEach(questions, function (q) {
                    var key = q.id != null
                        ? 'id_' + q.id
                        : 'q_' + (q.question || '').trim().toLowerCase();

                    if (!seen[key]) {
                        seen[key] = true;
                        uniqueQuestions.push(q);
                    }
                });

                // Tách đúng / sai
                var wrongAnswers = [];
                var correctAnswersObj = [];

                angular.forEach(uniqueQuestions, function (q) {
                    if (q.correct === true) {
                        correctAnswersObj.push(q);
                    } else {
                        wrongAnswers.push(q);
                    }
                });

                // Fallback nếu vẫn chưa có đáp án đúng
                if (correctAnswersObj.length === 0) {
                    correctAnswersObj.push({
                        id: item.id || null,
                        question: item.question || '',
                        motherTongue: item.motherTongue || '',
                        correct: true
                    });
                }

                // Lấy tối đa 3 đáp án sai + 1 đáp án đúng
                var displayAnswers = wrongAnswers.slice(0, 3).concat(correctAnswersObj.slice(0, 1));

                // Nếu chưa đủ 4 thì thêm ô trống
                while (displayAnswers.length < 4) {
                    displayAnswers.push({
                        question: '',
                        motherTongue: '',
                        correct: false
                    });
                }

                // Random vị trí đáp án
                displayAnswers = shuffleArray(displayAnswers);

                // Correct Answer(s) = vị trí sau khi random
                var correctAnswerIndexes = [];
                angular.forEach(displayAnswers, function (q, index) {
                    if (q.correct === true) {
                        correctAnswerIndexes.push(index + 1);
                    }
                });

                return {
                    "Từ vựng": item.question || '',
                    "Đáp án 1": displayAnswers[0] ? (displayAnswers[0].motherTongue || '') : '',
                    "Đáp án 2": displayAnswers[1] ? (displayAnswers[1].motherTongue || '') : '',
                    "Đáp án 3": displayAnswers[2] ? (displayAnswers[2].motherTongue || '') : '',
                    "Đáp án 4": displayAnswers[3] ? (displayAnswers[3].motherTongue || '') : '',
                    "Time Limit": 20,
                    "Correct Answer(s)": correctAnswerIndexes.join(', ')
                };
            });
        }

        var tugResetTimeout = null;
        var tugMoveTimeout1 = null;
        var tugMoveTimeout2 = null;

        vm.cancelTugTimeouts = function () {
            if (tugResetTimeout) {
                $timeout.cancel(tugResetTimeout);
                tugResetTimeout = null;
            }
            if (tugMoveTimeout1) {
                $timeout.cancel(tugMoveTimeout1);
                tugMoveTimeout1 = null;
            }
            if (tugMoveTimeout2) {
                $timeout.cancel(tugMoveTimeout2);
                tugMoveTimeout2 = null;
            }
        };

        vm.getTugPointGain = function (streak) {
            // điểm cơ bản luôn là 1
            // streak càng cao thì mỗi câu đúng cộng càng nhiều
            if (streak >= 15) return 5;
            if (streak >= 10) return 4;
            if (streak >= 7) return 3;
            if (streak >= 4) return 2;
            return 1;
        };

        vm.tugWinPulls = 7;       // đổi 6 / 7 / 8 tùy ý
        vm.tugScore = 0;          // 0 là giữa, âm nghiêng P1, dương nghiêng P2
        vm.tugMoveDuration = 850; // ms
        vm.tugWinner = null;
        vm.tugStatusText = 'Kéo chùm năng lượng về phía mình';
        vm.pullCount1 = 0;
        vm.pullCount2 = 0;
        vm.isPulling1 = false;
        vm.isPulling2 = false;

        vm.getTugProgress = function () {
            return ((vm.tugScore + vm.tugWinPulls) / (vm.tugWinPulls * 2)) * 100;
        };

        vm.getTugPercent = function () {
            return vm.getTugProgress() + '%';
        };

        vm.getTugRightPercent = function () {
            return (100 - vm.getTugProgress()) + '%';
        };

        vm.resetTugOfWarDefault = function () {
            vm.cancelTugTimeouts();
            $timeout.cancel(mytimeout);

            audio.load();

            vm.tugScore = 0;
            vm.tugWinner = null;
            vm.tugStatusText = 'Kéo chùm năng lượng về phía mình';
            vm.pullCount1 = 0;
            vm.pullCount2 = 0;
            vm.isPulling1 = false;
            vm.isPulling2 = false;

            vm.score1 = 0;
            vm.score2 = 0;
            vm.streakPlayer1 = 0;
            vm.streakPlayer2 = 0;
            vm.wrongPlayer1 = 0;
            vm.wrongPlayer2 = 0;

            stillInAQuestion1 = false;
            stillInAQuestion2 = false;

            // reset hoàn toàn trạng thái trận tug
            vm.endGame = true;
            vm.endGamePlayer1 = false;
            vm.endGamePlayer2 = false;
            vm.blindMode = false;

            $scope.counter = vm.tempCounter;
            // vm.tempCounter = 180;

            vm.currentPosition = 0;
            vm.currentPosition1 = 0;

            if (angular.isArray(vm.questions) && vm.questions.length > 0) {
                shuffleArray(vm.questions);
                vm.currentCard = vm.questions[0];
                // vm.createQuiz(vm.currentCard);

                if (vm.currentCard.questions) {
                    angular.forEach(vm.currentCard.questions, function (q) {
                        q.chosen = false;
                    });
                }
            } else {
                vm.currentCard = {};
            }

            if (angular.isArray(vm.questions1) && vm.questions1.length > 0) {
                shuffleArray(vm.questions1);
                vm.currentCard1 = vm.questions1[0];
                // vm.createQuiz(vm.currentCard1, 2);

                if (vm.currentCard1.questions) {
                    angular.forEach(vm.currentCard1.questions, function (q) {
                        q.chosen = false;
                    });
                }
            } else {
                vm.currentCard1 = {};
            }
        };

        vm.finishTugOfWar = function (winner) {
            vm.cancelTugTimeouts();

            vm.tugWinner = winner;
            vm.endGame = true;
            vm.isPulling1 = false;
            vm.isPulling2 = false;

            if (winner === 1) {
                vm.tugStatusText = 'PLAYER 1 THẮNG!';
            } else {
                vm.tugStatusText = 'PLAYER 2 THẮNG!';
            }

            $timeout.cancel(mytimeout);
            tuongLai.load();

            window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.tugStatusText));

            tugResetTimeout = $timeout(function () {
                vm.resetTugOfWarDefault();
            }, 100000);
        };

        vm.pullRope = function (player) {
            if (vm.endGame) return;

            if (player === 1) {
                vm.tugScore = Math.max(-vm.tugWinPulls, vm.tugScore - 1);
                if (vm.tugScore <= -vm.tugWinPulls) {
                    vm.finishTugOfWar(1);
                } else {
                    vm.tugStatusText = 'PLAYER 1 ĐANG ÉP DẦN';
                }
            } else {
                vm.tugScore = Math.min(vm.tugWinPulls, vm.tugScore + 1);
                if (vm.tugScore >= vm.tugWinPulls) {
                    vm.finishTugOfWar(2);
                } else {
                    vm.tugStatusText = 'PLAYER 2 ĐANG ÉP DẦN';
                }
            }
        };

        vm.loopCardsForPlayer = function (player) {
            if (player === 1) {
                if ((vm.currentPosition + 1) >= vm.totalCard) {
                    shuffleArray(vm.questions);
                    vm.currentPosition = 0;
                    vm.currentCard = vm.questions[0];
                    // vm.createQuiz(vm.currentCard);
                } else {
                    vm.nextCard(1);
                }
            } else {
                if ((vm.currentPosition1 + 1) >= vm.totalCard) {
                    shuffleArray(vm.questions1);
                    vm.currentPosition1 = 0;
                    vm.currentCard1 = vm.questions1[0];
                    // vm.createQuiz(vm.currentCard1, 2);
                } else {
                    vm.nextCard(2);
                }
            }
        };

        vm.pushBackRope = function (player) {
            if (vm.endGame) return;

            // player trả lời sai sẽ bị đẩy ngược về phía đối thủ 1 nhịp
            if (player === 1) {
                vm.tugScore = Math.min(vm.tugWinPulls, vm.tugScore + 1);

                if (vm.tugScore >= vm.tugWinPulls) {
                    vm.finishTugOfWar(2);
                } else {
                    vm.tugStatusText = 'PLAYER 1 BỊ Never Give Up';
                }
            } else {
                vm.tugScore = Math.max(-vm.tugWinPulls, vm.tugScore - 1);

                if (vm.tugScore <= -vm.tugWinPulls) {
                    vm.finishTugOfWar(1);
                } else {
                    vm.tugStatusText = 'PLAYER 2 BỊ Never Give Up';
                }
            }
        };

        vm.answerQuizBattle3 = function (correct, item, questions, player) {
            if (vm.endGame) return;

            if (player === 1 && vm.isPulling1) return;
            if (player === 2 && vm.isPulling2) return;

            angular.forEach(questions, function(value) {
                value.chosen = false;
            });
            item.chosen = true;

            if (correct === true) {
                if (player === 1) {
                    stillInAQuestion1 = false;
                    vm.streakPlayer1 = vm.streakPlayer1 + 1;

                    // điểm thuần tăng theo streak
                    vm.score1 = vm.score1 + vm.getTugPointGain(vm.streakPlayer1);

                    vm.isPulling1 = true;
                    vm.pullRope(1);

                    if (!vm.endGame) {
                        tugMoveTimeout1 = $timeout(function () {
                            vm.loopCardsForPlayer(1);
                            vm.isPulling1 = false;
                            tugMoveTimeout1 = null;
                        }, vm.tugMoveDuration);
                    } else {
                        vm.isPulling1 = false;
                    }
                } else {
                    stillInAQuestion2 = false;
                    vm.streakPlayer2 = vm.streakPlayer2 + 1;

                    // điểm thuần tăng theo streak
                    vm.score2 = vm.score2 + vm.getTugPointGain(vm.streakPlayer2);

                    vm.isPulling2 = true;
                    vm.pullRope(2);

                    if (!vm.endGame) {
                        tugMoveTimeout2 = $timeout(function () {
                            vm.loopCardsForPlayer(2);
                            vm.isPulling2 = false;
                            tugMoveTimeout2 = null;
                        }, vm.tugMoveDuration);
                    } else {
                        vm.isPulling2 = false;
                    }
                }
            } else {
                if (player === 1 && stillInAQuestion1 === false) {
                    vm.wrongPlayer1 = vm.wrongPlayer1 + 1;
                    vm.streakPlayer1 = 0;
                    stillInAQuestion1 = true;
                    vm.isPulling1 = true;

                    vm.pushBackRope(1);
                    vm.sayingWhenWrong();

                    if (!vm.endGame) {
                        tugMoveTimeout1 = $timeout(function () {
                            vm.isPulling1 = false;
                            tugMoveTimeout1 = null;
                        }, vm.tugMoveDuration);
                    } else {
                        vm.isPulling1 = false;
                    }
                }

                if (player === 2 && stillInAQuestion2 === false) {
                    vm.wrongPlayer2 = vm.wrongPlayer2 + 1;
                    vm.streakPlayer2 = 0;
                    stillInAQuestion2 = true;
                    vm.isPulling2 = true;

                    vm.pushBackRope(2);
                    vm.sayingWhenWrong();

                    if (!vm.endGame) {
                        tugMoveTimeout2 = $timeout(function () {
                            vm.isPulling2 = false;
                            tugMoveTimeout2 = null;
                        }, vm.tugMoveDuration);
                    } else {
                        vm.isPulling2 = false;
                    }
                }
            }
        };

        function stopGameByTimeout() {
            $scope.counter = 0;
            vm.endGame = true;

            if (vm.mode.id == 7) {
                vm.endGamePlayer1 = true;
                vm.endGamePlayer2 = true;
                vm.isPulling1 = false;
                vm.isPulling2 = false;

                if (angular.isFunction(vm.cancelTugTimeouts)) {
                    vm.cancelTugTimeouts();
                }

                // Hết giờ => ai điểm cao hơn thắng
                if (vm.score1 > vm.score2) {
                    vm.tugWinner = 1;
                    vm.tugStatusText = 'HẾT GIỜ - PLAYER 1 THẮNG!';
                } else if (vm.score2 > vm.score1) {
                    vm.tugWinner = 2;
                    vm.tugStatusText = 'HẾT GIỜ - PLAYER 2 THẮNG!';
                } else {
                    vm.tugWinner = 0;
                    vm.tugStatusText = 'HẾT GIỜ - HÒA!';
                }
            }

            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Time's up"));
            audio.load();
            $scope.$broadcast('timer-stopped', 0);
            $timeout.cancel(mytimeout);
        }


    }

})();