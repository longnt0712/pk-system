/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('ListeningGameModeController', ListeningGameModeController);

    ListeningGameModeController.$inject = [
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

    function ListeningGameModeController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies,topicService) {
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
        console.log(vm.currentUser);
        
        vm.question = {};
        vm.questions = [];
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

        // location.reload();

        // if(settings.isViewer == true){
            // console.log('here');
            vm.users = [
                {id: 40,name:'LÍT SỪN NINH'}
            ];
        // }
        vm.selectedUser = {
            id:40,name: 'LÍT SỪN NINH'
        };

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
        //     vm.selectedUser = {
        //         id:26,name: 'EM YÊU INH LÍCH'
        //     };
        // } else if(vm.myUser.id != null){
        //     vm.selectedUser = vm.myUser;
        // }

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
        vm.searchDto.pageSize = 5;
        vm.searchDto.pageIndex = 1;
        vm.searchDto.findExactWord = false;
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
        vm.showListFlashCard = false;

        // $scope.setPage = function (pageNo) {
        //     $scope.currentPage = pageNo;
        // };

        $scope.pageChanged = function() {
            // $log.log('Page changed to: ' + $scope.currentPage);
            vm.getPageFlashCard();
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
        vm.fillingGapQuestion = '';

        //audio process//
        var mainAudio = document.getElementById('main-audio');
        // var mainVideo = document.getElementById('main-video');
        // var loadVideo = document.getElementById('load-video');
        var loadVideoYouTube = document.getElementById('load-video-youtube');

        vm.setUpAudio = function () {
            mainAudio.src = vm.currentCard.pronounce; // local server
            mainAudio.load();
            mainAudio.loop = true;
        };
        // vm.setUpAudio();


        var playBackInput = document.getElementById('play-back-input');
        // playBackInput.inc


        vm.backForthAudio = function () {
            if(event.keyCode == 37){
                vm.backwardAudio();
            }
            if(event.keyCode == 39){
                vm.forwardAudio();
            }
        };

        vm.playbackValue = 1.0;

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
            // loadVideo.playbackRate  = vm.playbackValue;
        };

        vm.backwardAudio = function () {
            var currentTime = mainAudio.currentTime;
            // console.log(audio.currentTime);
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
        
        //audio process//

        //video process//

        vm.setUpVideo = function () {
            // mainVideo.src = vm.currentCard.motherTongue; // local server
            // loadVideo.load();
            // mainVideo.loop = true;
            loadVideoYouTube.src = vm.currentCard.pronounce; // local server
        };


        // var playBackInput = document.getElementById('play-back-input');
        // playBackInput.inc


        vm.backForthVideo = function () {
            if(event.keyCode == 37){
                vm.backwardVideo();
            }
            if(event.keyCode == 39){
                vm.forwardVideo();
            }
        };
        //
        // vm.backwardVideo = function () {
        //     var currentTime = mainVideo.currentTime;
        //     // console.log(audio.currentTime);
        //     var timeValue = 3;
        //     if(currentTime < timeValue){
        //         loadVideoYouTube.currentTime = 0;
        //     }else{
        //         loadVideoYouTube.currentTime = currentTime - timeValue;
        //     }
        // };
        // vm.forwardVideo = function () {
        //     // var audio = document.getElementById('main-audio');
        //     var currentTime = mainVideo.currentTime;
        //     // console.log(audio.duration);
        //     var timeValue = 3;
        //     if((currentTime + timeValue) > mainVideo.duration){
        //         loadVideoYouTube.currentTime = loadVideoYouTube.duration;
        //     }else{
        //         loadVideoYouTube.currentTime = currentTime + timeValue;
        //     }
        // };



        //video process//


        vm.getPageFlashCard = function () {
            vm.searchDto.questionType = {id: 6};
            // if(settings.isViewer == true) {
                // vm.searchDto.username = vm.selectedUser.username;
                vm.searchDto.userId = vm.selectedUser.id;
            // }
            // else{
            //     vm.searchDto.username = vm.currentUser.username;
            //     vm.searchDto.userId = vm.currentUser.id;
            // }
            // vm.searchDto.pageSize = 15;

            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                vm.questions = data.content;
                // console.log(data);


                blockUI.stop();


                // vm.questions2 = vm.questions;
                
                //tạm thời
                // vm.totalCard = vm.questions.length;
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
                    vm.currentCard.forSpeech = processText(vm.currentCard.question);
                    vm.currentCard.mediaLink = $sce.trustAsResourceUrl(vm.currentCard.pronounce);
                    vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));

                    vm.setUpAudio();

                    vm.setUpVideo();
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
        // vm.getAnswers();

        //--game mode//
        vm.gameModes = [
            {id:1,name: 'CƠ BẢN'},
            {id:2,name: 'ĐIỀN TỪ'}
        ];
        vm.gameMode = {id: 2, name: 'ĐIỀN TỪ'};
        vm.enterSearchCode = function () {
            // console.log(event.keyCode);
            if (event.keyCode == 61) {//Phím =
                vm.clickAnswer();
            }
            if (event.keyCode == 47) {//Phím /
                // vm.getRandomObject(vm.from.id, vm.to.id);
            }

        };

        // This function converts the string to lowercase, then perform the conversion
        function toLowerCaseNonAccentVietnamese(str) {
            str = str.toLowerCase();
//     We can also use this instead of from line 11 to line 17
//     str = str.replace(/\u00E0|\u00E1|\u1EA1|\u1EA3|\u00E3|\u00E2|\u1EA7|\u1EA5|\u1EAD|\u1EA9|\u1EAB|\u0103|\u1EB1|\u1EAF|\u1EB7|\u1EB3|\u1EB5/g, "a");
//     str = str.replace(/\u00E8|\u00E9|\u1EB9|\u1EBB|\u1EBD|\u00EA|\u1EC1|\u1EBF|\u1EC7|\u1EC3|\u1EC5/g, "e");
//     str = str.replace(/\u00EC|\u00ED|\u1ECB|\u1EC9|\u0129/g, "i");
//     str = str.replace(/\u00F2|\u00F3|\u1ECD|\u1ECF|\u00F5|\u00F4|\u1ED3|\u1ED1|\u1ED9|\u1ED5|\u1ED7|\u01A1|\u1EDD|\u1EDB|\u1EE3|\u1EDF|\u1EE1/g, "o");
//     str = str.replace(/\u00F9|\u00FA|\u1EE5|\u1EE7|\u0169|\u01B0|\u1EEB|\u1EE9|\u1EF1|\u1EED|\u1EEF/g, "u");
//     str = str.replace(/\u1EF3|\u00FD|\u1EF5|\u1EF7|\u1EF9/g, "y");
//     str = str.replace(/\u0111/g, "d");
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

        function processText(text) {
            var regex = /(<([^>]+)>)/ig
                , body = text
                , answer = body.replace(regex, ""); //remove html


            if (vm.exactAnswer === false) {
                //answer = answer.toLowerCase();
                //answer = answer.replace('ð','đ');
                answer = toLowerCaseNonAccentVietnamese(answer);
                answer = toNonAccentVietnamese(answer);
                answer = (answer.replace(/[`~!@#$%^&*()_|+\-=?;:'"“”‘’,.<>\{\}\[\]\\\/]/gi, '')).replace(/  +/g, ' '); //special characters
                // answer = answer.toLowerCase();
                answer = answer.trim();


                answer = answer.replace(/  +/g, ' ');//redundant spaces


                answer = answer.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); //deaccent
                answer = stringToSlug(answer);
            }else{
                answer = (answer.replace(/[`~!@#$%^&*()_|+\-=?;:'"“”‘’,.<>\{\}\[\]\\\/]/gi, '')).replace(/  +/g, ' '); //special characters
                answer = answer.toLowerCase();
                answer = answer.trim();


                answer = answer.replace(/  +/g, ' ');//redundant spaces
            }



            // setTimeout(function(){
            //     answer = answer.replace(/  +/g, ' ');//redundant spaces
            //     console.log(answer);
            //     return answer;
            // }, 20);

            // console.log(answer);
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

        // function processFillingGaps(text){
        //
        //     var x = text.split(" ");
        //     var indexGap = 0;
        //     var processedText = '';
        //     var previousIndex = null;
        //     var isFirstGap = true;
        //     for(var i = 0; i < x.length; i++){
        //         var randomNumber = getRndInteger(1,3);
        //         if(randomNumber === 2) {
        //             processedText = processedText + ' ' + x[i];
        //         } else {
        //             indexGap++;
        //             var input = '<input ng-keyup="vm.backForthAudio();vm.speakSingleWord(e,'+ "'"  + x[i] + "'" +');vm.fillingGaps('+ x.length + ',' + i +',vm.currentCard.question)" class="input-underline-only margin-bottom-10" type="text" style="width: 70px" id="gap-number-' + i +  '"' + '/> ' +
        //                 '<i class="fa fa-volume-up" style="cursor:pointer;font-size: 10px" ng-click="sayIt(' + "'"  + x[i] + "'" + ')"></i>';
        //             // processedText = processedText + " (" + indexGap + ") " + input;
        //             processedText = processedText + " " + input;
        //             previousIndex = i;
        //         }
        //     }
        //
        //     return processedText;
        // }

        function isStrictlyNumber(value) {
            return typeof value === 'number';
        }

        function isFirstLetterCapital(str) {
            // if(isStrictlyNumber(str)){
            //     return false;
            // }

            if (str.length === 0) {
                return false; // Handle empty strings
            }
            const firstLetter = str.charAt(0);

            return firstLetter === firstLetter.toUpperCase();
        }

        function processFillingGaps(text) {

            var x = text.split(" ");
            var indexGap = 0;
            var processedText = '';
            var previousIndex = null;
            for (var i = 0; i < x.length; i++) {

                // if(vm.gameMode.id === 2){
                    var randomNumber = getRndInteger(1, 3);

                    if (randomNumber === 2 || isFirstLetterCapital(x[i])) {
                        processedText = processedText + ' ' + x[i];
                    } else {
                        indexGap++;
                        var input = '<input autocomplete="off" ng-keyup="vm.backForthAudio();vm.speakSingleWord(e,'+ "'"  + x[i] + "'" +');vm.fillingGaps(' + x.length + ',' + i + ',vm.currentCard.motherTongue)" class="input-underline-only" type="text" style="width: 70px" id="gap-number-' + i + '"' + '/>' +
                            '<i class="fa fa-volume-up" style="cursor:pointer;font-size: 10px" ng-click="sayIt(' + "'"  + x[i] + "'" + ')"></i>';
                        // processedText = processedText + " (" + indexGap + ") " + input;
                        processedText = processedText + " " + input;
                        previousIndex = i;
                    }
                // }

                // if(vm.gameMode.id === 3){
                //     indexGap++;
                //     var input = '<input autocomplete="off" ng-keyup="vm.fillingGaps(' + x.length + ',' + i + ',vm.currentCard.motherTongue)" class="input-underline-only" type="text" style="width: 70px" id="gap-number-' + i + '"' + '/>';
                //     // processedText = processedText + " (" + indexGap + ") " + input;
                //     processedText = processedText + " " + input;
                //     previousIndex = i;
                // }

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
                }
            }

            return rest;
        }

        vm.speakSingleWord = function (e,text) {
            if(event.keyCode == 13){//Phím Enter
                $scope.sayIt(text);
            }
        };

        vm.fillingGaps = function (maxIndex, index, motherTongue) {
            // console.log(previousIndex);
            // console.log(index);
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

                    if(vm.currentPosition == 0 ) {
                        vm.nextCard();
                        vm.backCard();
                    } else{
                        vm.backCard();
                        vm.nextCard();
                    }

                }


            }


            // console.log(vm.currentCard.fillingGapsAnswer);
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


        //----------------------- Flash Card -------------------------//
        vm.topics = [];
        vm.topic = {};
        vm.topic.userId = vm.currentUser.id;
        vm.getTopics = function () {
            service.getTopics(vm.searchDto,1, 10000000).then(function (data) {
                vm.topics = data.content;
                // console.log(vm.topics);
            });
        };
        vm.getTopics();
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
        
        vm.nextCard = function () {

            // if(vm.currentPosition + 1 < vm.totalCard){
            if(vm.currentPosition + 1 < vm.searchDto.pageSize){
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.createQuiz(vm.currentCard);
                vm.currentCard.forSpeech = processText(vm.currentCard.question);
                vm.currentCard.mediaLink = $sce.trustAsResourceUrl(vm.currentCard.pronounce);
                vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
                vm.answerRewriteWord = '';
                vm.setUpAudio();
                vm.setUpVideo();
                // console.log("next");
                // if(vm.isPlayQuiz || vm.isPlayRewriteWord || vm.isPlayQuiz2){
                //     if(!vm.isMuted){
                //         window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.forSpeech));
                //     }
                // }

                // var arrayText = vm.currentCard.question.split(" ");
                //
                // for(var i = 0; i < arrayText.length; i++){
                //     // console.log('herre');
                //     var element = document.getElementById('gap-number-'+i);
                //     if(element != null){
                //         $timeout(function() {
                //             document.getElementById('gap-number-'+i).focus()
                //         }, 1000);
                //         // document.getElementById('gap-number-'+i).focus();
                //         break;
                //     }
                // }


            }

        };

        vm.backCard = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.currentCard.forSpeech = processText(vm.currentCard.question);
                vm.currentCard.mediaLink = $sce.trustAsResourceUrl(vm.currentCard.pronounce);
                vm.createQuiz(vm.currentCard);
                vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
                vm.answerRewriteWord = '';
                vm.setUpAudio();
                vm.setUpVideo();
                // console.log("back");

                // if(vm.isPlayQuiz || vm.isPlayRewriteWord || vm.isPlayQuiz2){
                //     if(!vm.isMuted){
                //         window.speechSynthesis.speak(new SpeechSynthesisUtterance(vm.currentCard.forSpeech));
                //     }
                // }

            }

        };

        vm.doShuffle = function() {
            shuffleArray(vm.questions);
            vm.currentPosition = 0;
            vm.currentCard = vm.questions[vm.currentPosition];
            vm.isShowDetail = false;
            vm.createQuiz(vm.currentCard);
            vm.currentCard.forSpeech = processText(vm.currentCard.question);
            vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
            vm.answerRewriteWord = '';
            vm.setUpAudio();
            vm.setUpVideo();
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
            // console.log(vm.question);
        };

        vm.clickNext = function () {
            if(vm.currentPosition <= vm.questions.length){
                vm.currentPosition = vm.currentPosition + 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                vm.createQuiz(vm.currentCard);
                vm.currentCard.forSpeech = processText(vm.currentCard.question);
                vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
            }
        };

        vm.clickBack = function () {
            if(vm.currentPosition > 0){
                vm.currentPosition = vm.currentPosition - 1;
                vm.currentCard = vm.questions[vm.currentPosition];
                vm.isShowDetail = false;
                vm.createQuiz(vm.currentCard);
                vm.currentCard.forSpeech = processText(vm.currentCard.question);
                vm.fillingGapQuestion = (processFillingGaps(vm.currentCard.motherTongue));
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

        
        
        vm.isNormal = false;
        vm.isPlayQuiz = false;
        vm.isPlayQuiz2 = true;
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



                // vm.currentCard.questions.splice(0,vm.searchDto.numberOfAnswers);


                shuffleArray(currentCard.questions);
            }

        };

        vm.isMuted = false;
        // $scope.theText = "Welcome to the speech enabled world!";
        const synth = window.speechSynthesis;
        // const rate = document.querySelector("#rate");

        $scope.sayIt = function (text) {
            console.log(text);
            // console.log(vm.isMuted);
            if(!vm.isMuted){
                if (synth.speaking) {
                    synth.cancel();
                }
                const utterThis = new SpeechSynthesisUtterance();
                // utterThis.lang = lang;
                utterThis.text = text;
                // utterThis.rate = rate.value;

                synth.speak(utterThis);

                // window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
            }
        };
        
        $scope.shutUp = function () {
            if (synth.speaking && vm.isMuted) {
                synth.cancel();
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




        vm.chooseUsers = function () {

            vm.getQuestionTypes();
            vm.getPageFlashCard();
            vm.getTopics();
        };






        //------------------ End Flash Card ---------------------------------//







    }

})();