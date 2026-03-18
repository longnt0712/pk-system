/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSWritingActualTestController', IELTSWritingActualTestController);

    IELTSWritingActualTestController.$inject = [
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

    function IELTSWritingActualTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
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

        //--------------------- Actual Writing test -------------------------//

        $scope.tinymceOptionsToActualTestAnswer = {
            height: 550,

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

        //--------------------- End Actual Writing test -------------------------//

    }

})();