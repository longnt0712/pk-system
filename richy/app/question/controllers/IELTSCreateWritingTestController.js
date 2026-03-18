/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSCreateWritingTestController', IELTSCreateWritingTestController);

    IELTSCreateWritingTestController.$inject = [
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

    function IELTSCreateWritingTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
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

        
        console.log('Create IELTSWriting');
        vm.searchDto.pageSize = 10;
        vm.getPageCreateIELTSWritingTest();
        

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
        

        //--------------------- Create Writing test -------------------------//
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
    }

})();