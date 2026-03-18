/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.ClassicalLearning').controller('ClassicalLearningController', ClassicalLearningController);

    ClassicalLearningController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'ClassicalLearningService',
        '$cookies'
    ];

    function ClassicalLearningController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.question = {};
        vm.answer = {};

        vm.result = {};
        
        vm.typeChange = function () {
            // clearInterval(idInterval);
            // setInterval(showNotification,36000);
            // vm.question.type = vm.type.id;
            // vm.searchDto.type = vm.type.id;
            // vm.getPage();
            console.log(vm.from);
            console.log(vm.to);
        };

        /* TINYMCE */
        vm.tinymceOptions = {
            height: 130,
            theme: 'modern',
            plugins: [
                'lists fullscreen' //autoresize
            ],
            toolbar1: 'bold underline italic | removeformat | bullist numlist outdent indent | fullscreen',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.getRandomObject = function (from, to) {
            service.getRandomObject(from, to).then(function (data) {
                vm.question = data;
            });
        };
        vm.getRandomObject(vm.from.id, vm.to.id);

        vm.clickAnswer = function () {
            service.answerQuestion(vm.question).then(function (data) {
                vm.result = data;
                console.log(data);
                if (vm.result.result) {
                    toastr.success('Đúng rồi');
                } else {
                    toastr.error('Sai rồi');
                }
            });
        };

        vm.enterSearchCode = function () {
            console.log(event.keyCode);
            if (event.keyCode == 61) {//Phím \
                vm.clickAnswer();
            }
            if (event.keyCode == 47) {//Phím =
                vm.getRandomObject(vm.from.id, vm.to.id);
            }

        };

        vm.writingText = '';
        vm.writingTextForCount = '';
        vm.countWords = 0;
        vm.fontSize = 18;

        vm.onTextChange = function () {

            vm.writingTextForCount = vm.writingText;
            vm.writingTextForCount = vm.writingTextForCount.replace(/\s{2,}/g, ' ');
            // vm.writingText = vm.writingText.replace(/\s+/g, '');
            const myArr = vm.writingTextForCount.split(" ");
            vm.countWords = myArr.length;
            if(myArr.length == 1){
                vm.countWords = 0
            }

            // console.log(vm.countWords);
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
            audio.load();
        };

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            $scope.counter = 3600;
        }

    }

})();