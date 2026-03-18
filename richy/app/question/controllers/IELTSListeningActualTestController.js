/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSListeningActualTestController', IELTSListeningActualTestController);

    IELTSListeningActualTestController.$inject = [
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

    angular.module('Hrm.Question').directive('draggable', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element[0].addEventListener('dragstart', scope.handleDragStart, false);
                element[0].addEventListener('dragend', scope.handleDragEnd, false);
            }
        }
    });

    angular.module('Hrm.Question').directive('droppable', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element[0].addEventListener('drop', scope.handleDrop, false);
                element[0].addEventListener('dragover', scope.handleDragOver, false);
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

    function IELTSListeningActualTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
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
        if(vm.currentUser.roles != null){
            angular.forEach(vm.currentUser.roles, function(value, key) {
                if(value.name == "ROLE_ADMIN"){
                    settings.isAdmin = true;
                    console.log("ADMIN");
                }
            });
        }
        // console.log(vm.currentUser);
        vm.question = {};
        vm.questions = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};

        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 100;
        vm.searchDto.pageSize = 12;
        vm.searchDto.pageIndex = 1;
        vm.currentPosition = 0;
        vm.currentCard = {};

        vm.testResult = {};

        vm.testResult.questionAnswerTestResult = [];
        vm.testResult.user = vm.currentUser;

        vm.testResultAfterSubmitting = {};

        vm.ieltsListeningTests = [];
        vm.ieltsListeningTest = {
            questionType : {
                code: 'IELTSLT',
                id: 22,
                name: 'IELTS Listening Test',
                textSearch: null
            },
            type: 0,
            status: 1,
            questionTopics: [],
            countWords: 0,
            ordinalNumber: 1,
            subQuestions: []
        };  //create a new test

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

        //for passage 1
        $scope.listA = [

        ];

        $scope.listB =
        {
            items:[]
        };

        //for passage 2
        $scope.listA2 = [

        ];

        $scope.listB2 =
        {
            items:[]
        };

        //for passage 3
        $scope.listA3 = [

        ];

        $scope.listB3 =
        {
            items:[]
        };

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

        vm.getOrdinalNumberPassage2 = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                // console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage2 = getHighestOrdinalNumber(packagesForPassage2);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    // console.log('highest orinal number packages for passage 2: ' + vm.highestOrdinalNumberPackageForPassage2);
                    if(packagesForPassage2 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[1].subQuestions.length; i++){
                            var questionsForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage2);

                            if(vm.highestOrdinalNumberQuestionForPassage2 < temp){
                                vm.highestOrdinalNumberQuestionForPassage2 = temp;
                            }
                        }
                        // console.log('highest orinal number questions for passage 2: ' + vm.highestOrdinalNumberQuestionForPassage2);
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
                // console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage1 = getHighestOrdinalNumber(packagesForPassage1);
                    // console.log('highest orinal number packages for passage 1: ' + vm.highestOrdinalNumberPackageForPassage1);
                    if(packagesForPassage1 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[0].subQuestions.length; i++){
                            var questionsForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage1);
                            if(vm.highestOrdinalNumberQuestionForPassage1 < temp){
                                vm.highestOrdinalNumberQuestionForPassage1 = temp;
                            }
                        }
                        // console.log('highest orinal number questions for passage 1: ' + vm.highestOrdinalNumberQuestionForPassage1);
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
            }
            vm.getOrdinalNumberPassage2(ieltsReadingTest);
        };

        console.log('IELTS Listening Actual Test');
        vm.searchDto.pageSize = 10;
        // console.log($stateParams.ieltsReadingTestId);
        if ($stateParams.ieltsReadingTestId != null) {
            service.getOne($stateParams.ieltsReadingTestId).then(function (data) {
                vm.ieltsListeningActualTest = data;
                vm.getOrdinalNumber(data);

                function secondCallFunction(ieltsReadingActualTest) {
                    var timeout;
                    timeout = $timeout(function(){
                        var questionNumber = '';
                        for(var k = 0; k < vm.ieltsListeningActualTest.subQuestions.length; k++){
                            for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions[k].subQuestions.length; i++) {
                                for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                                    if (vm.ieltsListeningActualTest.subQuestions[k].subQuestions[i].type == 2) {
                                        questionNumber = vm.ieltsListeningActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber + ' ';
                                        // vm.addFields(vm.ieltsListeningActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber);
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
                        vm.ieltsListeningActualTest = vm.processQuestionATT(data);
                        myCallback(vm.ieltsListeningActualTest);
                    },0);
                }

                firstCallFunction(secondCallFunction);

                // console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        }


        vm.getOneTestResult = function (id) {
            service.getOneTestResult(id).then(function (data) {
                vm.testResultAfterSubmitting = data;

                // console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        vm.saveTestResult = function () {

            service.saveTestResult(vm.testResult).then(function (data) {

                vm.testResultAfterSubmitting = data;
                vm.testResultDisPlay = 4;
                console.log(vm.testResultAfterSubmitting );

            }, function success() {
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        //--------------------- Reading Actual test -------------------------//
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

        vm.passageNumber = 1;
        vm.testResultDisPlay = 1;
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

        vm.ieltsListeningActualTest = {};

        vm.clickShowChildren = function(question,questions){
            // console.log('here');
            vm.tempQuestion = question;
            // vm.tempBeforeQuestion = beforeQuestion;
            // vm.tempAfterQuestion = afterQuestion;
            for(var i = 0; i < vm.ieltsListeningActualTest.subQuestions[0].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsListeningActualTest.subQuestions[0].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsListeningActualTest.subQuestions[0].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            for(var i = 0; i < vm.ieltsListeningActualTest.subQuestions[1].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsListeningActualTest.subQuestions[1].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsListeningActualTest.subQuestions[1].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            for(var i = 0; i < vm.ieltsListeningActualTest.subQuestions[2].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsListeningActualTest.subQuestions[2].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsListeningActualTest.subQuestions[2].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }
            for(var i = 0; i < vm.ieltsListeningActualTest.subQuestions[3].subQuestions.length; i++){
                for(var j = 0; j < vm.ieltsListeningActualTest.subQuestions[3].subQuestions[i].subQuestions.length; j++){
                    vm.ieltsListeningActualTest.subQuestions[3].subQuestions[i].subQuestions[j].showChildren = false;
                }
            }

            if(question.parent.type == 5){
                // console.log("type = 5 here");
                // console.log(questions);
                questions[0].isFirstQuestion = true;
                for(var i = 0; i < questions.length; i++){
                    questions[i].showChildren = true;
                }
            } else{
                question.showChildren = true;
            }
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
                        if(items[0].parent.questionType.code == "IELTSLTP1"){
                            vm.passageNumber = 1;
                        }
                        if(items[0].parent.questionType.code == "IELTSLTP2"){
                            vm.passageNumber = 2;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage2 = document.getElementById('passage-number-2');
                            //     passage2.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }

                        }
                        if(items[0].parent.questionType.code == "IELTSLTP3"){
                            vm.passageNumber = 3;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage3 = document.getElementById('passage-number-3');
                            //     passage3.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }
                        }
                        if(items[0].parent.questionType.code == "IELTSLTP4"){
                            vm.passageNumber = 4;
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

        vm.A1 = [
        ];
        vm.B1= [];
        // $scope.models = {
        //     selected: null,
        //     lists: {
        //         "A1": [
        //             {label: ""},
        //             {content: "paragraph 1"}
        //         ]
        //         , "B1": [
        //
        //         ]
        //     }
        // };

        // Generate initial model
        // for (var i = 1; i <= 3; ++i) {
        //     $scope.models.lists.A.push({label: ""});
            // $scope.models.lists.B1.push({label: "Item B1" + i});
        // }

        vm.processQuestionATT = function (data,idName) {
            var z = 0;
            var z2 = 0;
            var z3 = 0;
            for(var k = 0; k < data.subQuestions.length; k++){
                //process passage for matching heading
                // var passage = data.subQuestions[k].subQuestions[i].question;
                var typePassage = data.subQuestions[k].type;

                //
                // if(typePassage == 4){
                //     var inputMatchingHeading = '<input droppable="true" ng-model="vm.answerDropBox"  class="matching-heading-drop-box" id="matching-heading-drop-box-'+i+'" placeholder="dragging heading and dropping hear"> </input>';
                //
                //     var arrs = data.subQuestions[k].question.split('\n');
                //     // var arr = {};
                //     for(var y = 0; y < arrs.length; y++){
                //
                //     }
                //
                //     console.log(arrs);
                // }
                for (var i = 0; i < data.subQuestions[k].subQuestions.length; i++) {
                    for (var j = 0; j < data.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                        var parentType = 4;
                        //process filling gaps
                        if (data.subQuestions[k].subQuestions[i].type == 2) {
                            var type = data.subQuestions[k].subQuestions[i].type;
                            var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                            var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                            var input = '<input autocomplete="off" type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.clientAnswer" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'">';
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br> <br>');
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input);
                            // data.subQuestions[k].subQuestions[i].subQuestions[j].question = $sce.trustAsHtml(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                            // console.log(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                        }
                        else if (data.subQuestions[k].subQuestions[i].type == 3) { //process filling gap enter
                            var type = data.subQuestions[k].subQuestions[i].type;
                            var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                            var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                            var input1 = '<br><input autocomplete="off" type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.clientAnswer" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'"><br><br>';
                            data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input1);
                            // data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br>');
                            // console.log('yes');
                        }
                        
                        else if (data.subQuestions[k].subQuestions[i].type == 4) { //process matching heading
                            var type = data.subQuestions[k].subQuestions[i].type;
                            var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;

                            var question = data.subQuestions[k].subQuestions[i].subQuestions[j];

                            for(var m = 0; m < question.questionAnswers.length; m++){
                                if(question.questionAnswers[m].correct == true){
                                    var qa = null;
                                    qa = {};
                                    qa.id = question.questionAnswers[m].id;
                                    qa.answer = question.questionAnswers[m].answer;
                                    qa.question = question.questionAnswers[m].question;
                                    qa.ordinalNumberQuestionAnswer = question.questionAnswers[m].ordinalNumberQuestionAnswer;
                                    qa.correct = question.questionAnswers[m].correct;

                                    if(k==0){
                                        var n = {
                                            selected: null,
                                            listName: "Heading",
                                            items: [
                                            ],
                                            dragging: false
                                        };
                                        n.items.push(qa);
                                        $scope.listA.push(n);
                                    }

                                    if(k==1){ //passage 2
                                        var n = {
                                            selected: null,
                                            listName: "Heading",
                                            items: [
                                            ],
                                            dragging: false
                                        };
                                        n.items.push(qa);
                                        $scope.listA2.push(n);
                                    }

                                    if(k==2){ //passage 3
                                        var n = {
                                            selected: null,
                                            listName: "Heading",
                                            items: [
                                            ],
                                            dragging: false
                                        };
                                        n.items.push(qa);
                                        $scope.listA3.push(n);
                                    }
                                }
                            }

                            if(k==0){
                                if($scope.listB.items.length === 0){
                                    angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                        item.parentType = type;
                                        $scope.listB.items.push(item);
                                    });
                                }
                            }

                            if(k==1){
                                if($scope.listB2.items.length === 0){
                                    angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                        $scope.listB2.items.push(item);
                                    });
                                }
                            }

                            if(k==2){
                                if($scope.listB3.items.length === 0){
                                    angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                        $scope.listB3.items.push(item);
                                    });
                                }
                            }

                            if(typeof $scope.listA[z] !== "undefined"){
                                var inputMatchingHeading =
                                    '<span dnd-drop="onDropA(listA['+z+'], item, 0)" ' +
                                    'dnd-draggable="getSelectedItemsIncluding(listA['+z+'], listA['+z+'].items[0])" ' +
                                    'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                    'dnd-list="listA['+z+'].items" ' +
                                    'dnd-selected="listA.items['+z+'].selected = !listA.items['+z+'].selected" ' +
                                    'dnd-effect-allowed="move" ' +

                                    'type="text"  rows="1"' +
                                    'data-ng-bind="listA['+z+'].items[0].clientAnswer">' +
                                    '</span>';

                                z = z+1;
                                data.subQuestions[k].question = data.subQuestions[k].question.replace('}{HEADING}{', inputMatchingHeading);
                            }

                            //passage 2
                            if(typeof $scope.listA2[z2] !== "undefined"){
                                var inputMatchingHeading =
                                    '<span dnd-drop="onDropA2(listA2['+z2+'], item, 0)" ' +
                                    'dnd-draggable="getSelectedItemsIncluding(listA2['+z+'], listA2['+z2+'].items[0])" ' +
                                    'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                    'dnd-list="listA2['+z2+'].items" ' +
                                    'dnd-selected="listA2.items['+z2+'].selected = !listA2.items['+2+'].selected" ' +
                                    'dnd-effect-allowed="move" ' +

                                    'type="text"  rows="1"' +
                                    'data-ng-bind="listA2['+z2+'].items[0].clientAnswer">' +
                                    '</span>';

                                z2 = z2 + 1;
                                data.subQuestions[k].question = data.subQuestions[k].question.replace('}{HEADING}{', inputMatchingHeading);
                            }

                            //passage 3
                            if(typeof $scope.listA3[z3] !== "undefined"){
                                var inputMatchingHeading =
                                    '<span dnd-drop="onDropA3(listA3['+z3+'], item, 0)" ' +
                                    'dnd-draggable="getSelectedItemsIncluding(listA3['+z3+'], listA3['+z3+'].items[0])" ' +
                                    'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                    'dnd-list="listA3['+z3+'].items" ' +
                                    'dnd-selected="listA3.items['+z3+'].selected = !listA3.items['+z3+'].selected" ' +
                                    'dnd-effect-allowed="move" ' +

                                    'type="text"  rows="1"' +
                                    'data-ng-bind="listA3['+z3+'].items[0].clientAnswer">' +
                                    '</span>';

                                z3 = z3 + 1;
                                data.subQuestions[k].question = data.subQuestions[k].question.replace('}{HEADING}{', inputMatchingHeading);
                            }
                        }
                    }
                }
            }

            for(var v = 0; v < $scope.listA.length; v++){
                $scope.listA[v].items[0].typeDnD = 1;//drop box
                $scope.listA[v].items[0].clientAnswer = $scope.listA[v].items[0].question.ordinalNumber;
                $scope.listA[v].items[0].objectFromListB = null;//drop box

            }

            for(var c = 0; c < $scope.listB.items.length; c++){
                $scope.listB.items[c].clientAnswer = $scope.listB.items[c].answer.answer;
                $scope.listB.items[c].typeDnD = 2;//drag box
            }

            //passage 2
            for(var v = 0; v < $scope.listA2.length; v++){
                $scope.listA2[v].items[0].typeDnD = 1;//drop box
                $scope.listA2[v].items[0].clientAnswer = $scope.listA2[v].items[0].question.ordinalNumber;
                $scope.listA2[v].items[0].objectFromListB = null;//drop box
            }

            for(var c = 0; c < $scope.listB2.items.length; c++){
                $scope.listB2.items[c].clientAnswer = $scope.listB2.items[c].answer.answer;
                $scope.listB2.items[c].typeDnD = 2;//drag box
            }

            //passage 3
            for(var v = 0; v < $scope.listA3.length; v++){
                $scope.listA3[v].items[0].typeDnD = 1;//drop box
                $scope.listA3[v].items[0].clientAnswer = $scope.listA3[v].items[0].question.ordinalNumber;
                $scope.listA3[v].items[0].objectFromListB = null;//drop box

            }

            for(var c = 0; c < $scope.listB3.items.length; c++){
                $scope.listB3.items[c].clientAnswer = $scope.listB3.items[c].answer.answer;
                $scope.listB3.items[c].typeDnD = 2;//drag box
            }

            // console.log($scope.listA);
            console.log($scope.listB.items);
            console.log($scope.listB2.items);
            console.log($scope.listB3.items);

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
        vm.notes4 = [];
        vm.note = {};
        vm.surroundedId1 = 0;
        vm.surroundedId2 = 0;
        vm.surroundedId3 = 0;
        vm.surroundedId4 = 0;
        $scope.showContextMenu = function(){
            console.log('here');

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
            // console.log('close 1');
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

        //passage 4
        $scope.closeNotes4 = function (){
            console.log('close');
            for(var i = 0; i< vm.notes4.length; i++){
                if(vm.notes4[i].passage == 4){
                    var currentId = i+1;
                    var currentElementId = 'passage-4-notes-highlight-'+currentId;
                    var currentNote = document.getElementById(currentElementId);
                    currentNote.style.display = 'none';
                }

            }
        };

        $scope.createNotes4 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            vm.surroundedId4 = vm.surroundedId4 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-4-surrounded-text-have-note-'+vm.surroundedId4;
            span.style.zIndex = 4;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes4);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 4};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes4.push(note);
        };

        $scope.closeASpecificNote4 = function (currentId) {
            var currentElementId = 'passage-4-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes4 = function (a) {

            var passage = document.getElementById('passage-text-4');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-4-notes-highlight-'+currentId;

            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');

        };



        vm.setReviewQuestion = function () {

            for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(vm.tempQuestion.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].needReview = vm.tempQuestion.needReview;
                            // vm.tempQuestion.needReview = true;

                        }
                    }
                }
            }
        };

        vm.checkBoxMultipleChoiceQuestions = function (questionAnswer,question,selected) {

            for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            //set answered
                            // vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // if(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == true){
                            //     vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            // } else if(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == false){
                            //     vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // }
                            vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = selected;


                            // console.log(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k]);
                            for(var l = 0; l < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers.length; l++){
                                if(questionAnswer.id != vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].id){
                                    //set answer is selected
                                    vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = false;
                                }else {
                                    vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = selected;
                                    if(selected){
                                        for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                            if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                                vm.testResult.questionAnswerTestResult.splice(m,1);
                                            }
                                        }

                                        var qat = {};
                                        qat.questionAnswer = questionAnswer;
                                        qat.ordinalNumber = question.ordinalNumber;

                                        // questionAnswer.id = null;
                                        vm.testResult.questionAnswerTestResult.push(qat);
                                    } else if (!selected){
                                        for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                            if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                                vm.testResult.questionAnswerTestResult.splice(m,1);
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

        vm.checkBoxMultipleChoiceMultipleAnswerQuestions = function (questionAnswer,question,selected) {

            // console.log(listAnswers);

            function secondCallFunction(countAnswer) {
                var timeout;
                timeout = $timeout(function(){
                    for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++) {//passage
                        for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++) {//package
                            if (vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].type == 5) {
                                for(var l = 0; l < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers.length; l++){ // get QAs of question index = 0;
                                    //add lại những thằng là true
                                    if(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers[l].selected == true && countAnswer < 3){
                                        var qat = {};
                                        qat.questionAnswer = questionAnswer;
                                        qat.ordinalNumber = question.ordinalNumber;

                                        vm.testResult.questionAnswerTestResult.push(qat);
                                    }
                                }
                            }
                        }
                    }

                    console.log(vm.testResult);

                    timeout = null;
                },0);
            }

            function firstCallFunction(myCallback) {
                var timeout;
                timeout = $timeout(function(){
                    for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++){//passage
                        for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++){//package
                            if(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].type == 5){


                                //số câu hỏi tương ứng với số câu trả lời (số lần được tích vào checkbox
                                var numberQuestion = vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length;

                                //khi 1 ô được tích => tất cả câu trả lời trong package đều được tính là đã trả lời
                                for(var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++){ //question
                                    if(selected == true){
                                        vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                                    }
                                }

                                //đếm số ô đang được tích (chỉ cần làm việc với câu hỏi đầu tiên trong package)
                                var countAnswer = 0;
                                for(var l = 0; l < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers.length; l++){ // get QAs of question index = 0;
                                    if(vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers[l].selected == true){
                                        countAnswer = countAnswer + 1;
                                    }
                                }

                                //khi 0 ô nào được tích => tất cả câu trả lời trong package đều được tính là chưa trả lời
                                for(var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++){ //question
                                    if(countAnswer == 0){
                                        vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                                    }
                                }

                                // nếu số ô được tích đã vượt quá số câu hỏi => set cái được tích sau đó = false.
                                if(countAnswer > numberQuestion){
                                    // console.log('continue to set');
                                    for(var l = 0; l < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers.length; l++){ // get QAs of question index = 0;
                                        if(questionAnswer.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers[l].id){
                                            vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers[l].selected = false;
                                        }
                                    }
                                    countAnswer = numberQuestion;
                                }

                                //xóa tất những thằng đang có trong test result
                                for(var l = 0; l < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers.length; l++){
                                    for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                        if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[0].questionAnswers[l].question.id){

                                            vm.testResult.questionAnswerTestResult.splice(m,1);
                                        }
                                    }
                                }
                            }

                        }
                    }
                    myCallback(countAnswer);
                },0);
            }

            firstCallFunction(secondCallFunction);

            // console.log(countAnswer);
            // console.log("-----------");

            // console.log(vm.testResult.questionAnswers);
            // console.log("===========");
        };
        
        vm.changeTextQuestionAnswer = function (questionAnswer,answer,question) {
            // console.log(questionAnswer);
            // console.log(answer);
            // console.log(question);

            document.getElementById("matching-heading-drop-box-" + question.ordinalNumber).size = questionAnswer.clientAnswer.length;


            for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++) {//passage

                for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++) {//package

                    for (var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question


                        if(questionAnswer.clientAnswer != null && questionAnswer.clientAnswer.length > 0 && answer != null && answer.length > 0){

                            if (question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            }

                            //splice the old one
                            for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                    vm.testResult.questionAnswerTestResult.splice(m,1);
                                }
                            }


                            //add the new one
                            var qat = {};
                            qat.questionAnswer = questionAnswer;
                            qat.ordinalNumber = question.ordinalNumber;

                            qat.clientAnswer = questionAnswer.clientAnswer.trim();

                            vm.testResult.questionAnswerTestResult.push(qat);

                        } else {
                            if (question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                        vm.testResult.questionAnswerTestResult.splice(m,1);
                                    }
                                }

                                vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            }
                        }
                    }
                }
            }


            console.log("-----------");
            console.log(vm.testResult);
            console.log("===========");


        };


        vm.hoverAnswerMatchingHeading= function (k,i,j,x,qOrdinalNumber) {
            // console.log('mouseleave');
            // var content = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent;
            // if(content != null){
            //     document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent = '';
            //     // var flexWidth = (document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value.length+1) + 'ch';
            //     document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).style.width = 200+'px';
            // }


        };
        vm.changeTextQuestionAnswerMatchingHeading = function (k,i,j,x,qOrdinalNumber) {
            console.log('change');

            // questionAnswer = JSON.parse(questionAnswer);
            // question = JSON.parse(question);
            // document.getElementById("matching-heading-drop-box-" + question.ordinalNumber).textContent
            // document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent;

            var content = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value;
            var flexWidth = (document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value.length+1) + 'ch';
            document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).style.width = flexWidth;


            // for (var i = 0; i < vm.ieltsListeningActualTest.subQuestions.length; i++) {//passage
            //
            //     for (var j = 0; j < vm.ieltsListeningActualTest.subQuestions[i].subQuestions.length; j++) {//package
            //
            //         for (var k = 0; k < vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
            //
            //
            //             if(questionAnswer.clientAnswer != null && questionAnswer.clientAnswer.length > 0 && answer != null && answer.length > 0){
            //
            //                 if (question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {
            //
            //                     vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
            //                 }
            //
            //                 //splice the old one
            //                 for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
            //                     if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
            //                         vm.testResult.questionAnswerTestResult.splice(m,1);
            //                     }
            //                 }
            //
            //
            //                 //add the new one
            //                 var qat = {};
            //                 qat.questionAnswer = questionAnswer;
            //                 qat.ordinalNumber = question.ordinalNumber;
            //
            //                 qat.clientAnswer = questionAnswer.clientAnswer.trim();
            //
            //                 vm.testResult.questionAnswerTestResult.push(qat);
            //
            //             } else {
            //                 if (question.id == vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {
            //
            //                     for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
            //                         if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
            //                             vm.testResult.questionAnswerTestResult.splice(m,1);
            //                         }
            //                     }
            //
            //                     vm.ieltsListeningActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
            //                 }
            //             }
            //         }
            //     }
            // }


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

        // $scope.models = [
        //     {
        //         listName: "A",
        //         items: [],
        //         dragging: false},
        //     {
        //         listName: "B",
        //         items: [],
        //         dragging: false}
        // ];

        /**
         * dnd-dragging determines what data gets serialized and send to the receiver
         * of the drop. While we usually just send a single object, we send the array
         * of all selected items here.
         */
        $scope.getSelectedItemsIncluding = function(list, item) {
            item.selected = true;

            return item;
            // return list.items.filter(function(item) { return item.selected; });
        };

        /**
         * We set the list into dragging state, meaning the items that are being
         * dragged are hidden. We also use the HTML5 API directly to set a custom
         * image, since otherwise only the one item that the user actually dragged
         * would be shown as drag image.
         */
        $scope.onDragstart = function(list, event) {
            // list.dragging = true;
            if (event.dataTransfer.setDragImage) {
                // var img = new Image();
                // img.src = 'framework/vendor/ic_content_copy_black_24dp_2x.png';
                // event.dataTransfer.setDragImage(img, 0, 0);
            }
        };

        /**
         * In the dnd-drop callback, we now have to handle the data array that we
         * sent above. We handle the insertion into the list ourselves. By returning
         * true, the dnd-list directive won't do the insertion itself.
         */
        $scope.onDropA = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA.length; x++){
                        if($scope.listA[x].items[0].id === items.id){
                            $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                            $scope.listA[x].items[0].ordinalFromListB = null;
                            $scope.listA[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(items.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(items.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                for(var n = 0; n < $scope.listA.length; n++){
                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == $scope.listA[n].items[0].question.id){
                        vm.testResult.questionAnswerTestResult.splice(m,1);
                    }
                }
            }

            for(var n = 0; n < $scope.listA.length; n++){

                var qat = {};
                qat.questionAnswer = $scope.listA[n].items[0];
                qat.ordinalNumber = $scope.listA[n].items[0].question.ordinalNumber;

                qat.clientAnswer = $scope.listA[n].items[0].clientAnswer;

                // questionAnswer.id = null;
                vm.testResult.questionAnswerTestResult.push(qat);
            }

            // console.log(vm.testResult);


            return true;
        };

        $scope.onDropB = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB.items[x].id){
                        $scope.listB.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA.length; x++){
                    if($scope.listA[x].items[0].id === items.id){
                        $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                        $scope.listA[x].items[0].ordinalFromListB = null;
                        $scope.listA[x].items[0].objectFromListB = null;
                    }
                }
            }


            // console.log('B');
            // console.log($scope.listB);
            // console.log('A');
            // console.log($scope.listA);

            return true;
        };


        $scope.onDropA2 = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA2.length; x++){
                        if($scope.listA2[x].items[0].id === items.id){
                            $scope.listA2[x].items[0].clientAnswer = $scope.listA2[x].items[0].question.ordinalNumber;
                            $scope.listA2[x].items[0].ordinalFromListB = null;
                            $scope.listA2[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(items.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(items.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                for(var n = 0; n < $scope.listA2.length; n++){
                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == $scope.listA2[n].items[0].question.id){
                        vm.testResult.questionAnswerTestResult.splice(m,1);
                    }
                }
            }

            for(var n = 0; n < $scope.listA2.length; n++){

                var qat = {};
                qat.questionAnswer = $scope.listA2[n].items[0];
                qat.ordinalNumber = $scope.listA2[n].items[0].question.ordinalNumber;

                qat.clientAnswer = $scope.listA2[n].items[0].clientAnswer;

                // questionAnswer.id = null;
                vm.testResult.questionAnswerTestResult.push(qat);
            }

            // console.log(vm.testResult);


            return true;
        };

        $scope.onDropB2 = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB2.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB2.items[x].id){
                        $scope.listB2.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA2.length; x++){
                    if($scope.listA2[x].items[0].id === items.id){
                        $scope.listA2[x].items[0].clientAnswer = $scope.listA2[x].items[0].question.ordinalNumber;
                        $scope.listA2[x].items[0].ordinalFromListB = null;
                        $scope.listA2[x].items[0].objectFromListB = null;
                    }
                }
            }

            return true;
        };

        $scope.onDropA3 = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA3.length; x++){
                        if($scope.listA3[x].items[0].id === items.id){
                            $scope.listA3[x].items[0].clientAnswer = $scope.listA3[x].items[0].question.ordinalNumber;
                            $scope.listA3[x].items[0].ordinalFromListB = null;
                            $scope.listA3[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(items.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(items.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                for(var n = 0; n < $scope.listA3.length; n++){
                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == $scope.listA3[n].items[0].question.id){
                        vm.testResult.questionAnswerTestResult.splice(m,1);
                    }
                }
            }

            for(var n = 0; n < $scope.listA3.length; n++){

                var qat = {};
                qat.questionAnswer = $scope.listA3[n].items[0];
                qat.ordinalNumber = $scope.listA3[n].items[0].question.ordinalNumber;

                qat.clientAnswer = $scope.listA3[n].items[0].clientAnswer;

                // questionAnswer.id = null;
                vm.testResult.questionAnswerTestResult.push(qat);
            }

            // console.log(vm.testResult);


            return true;
        };

        $scope.onDropB3 = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB3.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB3.items[x].id){
                        $scope.listB3.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA3.length; x++){
                    if($scope.listA3[x].items[0].id === items.id){
                        $scope.listA3[x].items[0].clientAnswer = $scope.listA3[x].items[0].question.ordinalNumber;
                        $scope.listA3[x].items[0].ordinalFromListB = null;
                        $scope.listA3[x].items[0].objectFromListB = null;
                    }
                }
            }

            return true;
        };
        

        /**
         * Last but not least, we have to remove the previously dragged items in the
         * dnd-moved callback.
         */
        $scope.onMoved = function(list) {
            list.items = list.items.filter(function(item) { return !item.selected; });
        };


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



        // Model to JSON for demo purpose
        // $scope.$watch('models', function(model) {
        //     $scope.modelAsJson = angular.toJson(model, true);
        // }, true);
        //
        // $scope.drag_types = [
        //     {name: "Charan"},
        //     {name: "Vijay"},
        //     {name: "Mahesh"},
        //     {name: "Dhananjay"},
        // ];
        // $scope.items = [];
        // //
        //
        // var currentDrag;
        // var currentHideDrags = [];
        // $scope.handleDragStart = function(e){
        //     // this.style.opacity = '0.4';
        //     e.dataTransfer.setData('text/plain', this.innerHTML);
        //
        //     if(e.currentTarget.className === "drag-matching-heading"){
        //         currentDrag = e.currentTarget;
        //     }
        //
        //
        //     // console.log(currentDrag);
        // };
        //
        // $scope.handleDragEnd = function(e){
        //     // this.style.opacity = '1.0';
        //     // console.log(e);
        //     console.log(e.currentTarget);
        //
        //     // var currentTarget = document.getElementById(e.currentTarget.id);
        //     // var currentTargetId = e.currentTarget.id;
        //     // var a = [];
        //     // a = currentTargetId.split("-");
        //     // var currentQOrdinalNumber = a[a.length-1];
        //     //
        //     // if(e.currentTarget.textContent != currentQOrdinalNumber){
        //     //     console.log("hello");
        //     //     for(var i = 0; i < currentHideDrags.length;i++){
        //     //         if(currentHideDrags[i].textContent === e.currentTarget.textContent){
        //     //             console.log("hello1");
        //     //         }
        //     //     }
        //     // } else {
        //     //     console.log("hi");
        //     //
        //     // }
        //
        // };
        //
        // $scope.handleDrop = function(e){
        //     e.preventDefault();
        //     e.stopPropagation();
        //     var dataText = e.dataTransfer.getData('text/plain');
        //     var currentTarget = document.getElementById(e.currentTarget.id);
        //     var currentTargetId = e.currentTarget.id;
        //     var a = [];
        //     a = currentTargetId.split("-");
        //     var currentQOrdinalNumber = a[a.length-1];
        //
        //     document.getElementById(e.currentTarget.id).textContent = dataText;
        //
        //     var flexWidth = (document.getElementById(e.currentTarget.id).textContent.length+1) + 'ch';
        //     document.getElementById(e.currentTarget.id).style.width = flexWidth;
        //
        //
        //     //hide current Drag
        //     if(typeof currentDrag === 'undefined'){
        //
        //     } else{
        //         currentDrag.style.display = 'none';
        //     }
        //
        //
        //
        //     // currentDrag.ordinalNumber = c
        //     currentHideDrags.push(currentDrag);
        //     console.log(currentHideDrags);
        //
        //
        //     // $scope.$apply(function() {
        //     //
        //     // });
        //     // console.log($scope.items);
        // };
        //
        // $scope.handleDragOver = function (e) {
        //     e.preventDefault(); // Necessary. Allows us to drop.
        //     e.dataTransfer.dropEffect = 'move';  // See the section on the DataTransfer object.
        //     return false;
        // };
        //--------------------- End Reading Actual test -------------------------//



    }

})();