/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSWritingCollectionController', IELTSWritingCollectionController);

    IELTSWritingCollectionController.$inject = [
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

    function IELTSWritingCollectionController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
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

        $scope.tabs = [
            {id: 1, title:'Your list', content:'Dynamic content 1' },
            {id: 2, title:'Your item', content:'Dynamic content 2'}
        ];

        $scope.model = {
            name: 'Tabs'
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
        vm.searchDto.username = vm.currentUser.username;
        vm.searchDto.userId = vm.currentUser.id;
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


        vm.getPageIELTSWriting = function () {
            vm.searchDto.questionType = {id: 7};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.writingQuestions = data.content;
                vm.bsTableControlIELTSWriting.options.data = vm.writingQuestions;
                vm.bsTableControlIELTSWriting.options.totalRows = data.totalElements;
            });
        };

        // vm.getQuestionTypes = function () {
        //     service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
        //         vm.questionTypes = data.content;
        //         vm.question.questionType = vm.questionTypes[0];
        //
        //     });
        // };

        console.log('IELTSWriting');
        vm.searchDto.pageSize = 10;
        vm.getPageIELTSWriting();
        // vm.getQuestionTypes();

        vm.topics = [];
        vm.topic = {};
        vm.getTopics = function () {
            service.getTopics(vm.searchDto,1, 10000).then(function (data) {
                vm.topics = data.content;
                // console.log(vm.topics);
            });
        };
        vm.getTopics();

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

        //---------------------- IELTS Writing ---------------------------//
        vm.idCurrentWriting = 0;
        vm.isNewCard = true;
        vm.saveFlashCard = function () {
            service.saveObject(vm.newCard, function success() {
                // vm.getPageFlashCard();
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

                service.getOne(vm.idCurrentWriting).then(function (data) {
                    // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                    vm.newWritingQuestion = data;
                    console.log(data);


                    vm.subFlashCards = data.subQuestions;
                    if(vm.subFlashCards == null){
                        vm.subFlashCards = [];
                    }

                    vm.bsTableControlIELTSWritingSubQuestion.options.data = vm.subFlashCards;
                    vm.bsTableControlIELTSWritingSubQuestion.options.totalRows = 0;
                    if(data.subQuestions!==null){
                        vm.bsTableControlIELTSWritingSubQuestion.options.totalRows = data.subQuestions.length;
                    }


                    vm.newCard.parent = vm.newWritingQuestion;
                    vm.selectedTopicToAddIELTSWriting = getListTopicFromCard(vm.newWritingQuestion.questionTopics);

                    // vm.newCard.parent = vm.newWritingQuestion;

                }, function failure() {
                    toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                });

                vm.selectedTopicToAdd = [];
                vm.isNewCard = true;

            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });

        };

        $scope.editFlashCard = function (id) {
            vm.isNewCard = false;
            service.getOne(id).then(function (data) {
                vm.newCard = data;
                // console.log(vm.currentCard);
                vm.selectedTopicToEdit = getListTopicFromCard(vm.newCard.questionTopics);

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

        vm.isShowWordList = false;
        vm.showWordList = function () {
            vm.isShowWordList = true;
            $scope.tinymceOptionsToQuestion.height = 560;
        };

        vm.hideWordList = function () {
            vm.isShowWordList = false;
            $scope.tinymceOptionsToQuestion.height = 560;
        };

        $scope.counter = 3600;
        $scope.minuteDisplay = 60;
        $scope.secondDisplay = 60;
        var mytimeout = null; // the current timeoutID
        // var audio = document.getElementById("audio1");


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
            height: 560,
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
            height: 560,
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

        $scope.tinymceOptions = {
            height: 100,
            theme: 'modern',
            // selector: '#tiny-question',
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
                pageList: [5, 10, 25, 100],
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
            $scope.active = 2;
            vm.isNewWriting = false;
            vm.idCurrentWriting = id;
            service.getOne(id).then(function (data) {
                // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.newWritingQuestion = data;
                console.log(data);

                
                vm.subFlashCards = data.subQuestions;
                if(vm.subFlashCards == null){
                    vm.subFlashCards = [];
                }
                
                vm.bsTableControlIELTSWritingSubQuestion.options.data = vm.subFlashCards;
                vm.bsTableControlIELTSWritingSubQuestion.options.totalRows = 0;
                if(data.subQuestions!==null){
                    vm.bsTableControlIELTSWritingSubQuestion.options.totalRows = data.subQuestions.length;
                }

                
                vm.newCard.parent = vm.newWritingQuestion;
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
            },360000);
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

        $scope.active = 1;

        vm.switchTab = function (id) {
          // console.log(id);
            if(id === 1){
                vm.getPageIELTSWriting();
            }
          //   vm.tabIndex = id;
        };

        vm.enterSearchCode = function(){
            // console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.codeChange();
            }
        };

        vm.codeChange=function () {
            vm.searchDto.pageIndex = 1;

            vm.getPageIELTSWriting();

        };


        vm.subFlashCards = [];
        // vm.getPageFlashCard = function () {
        //     vm.searchDto.questionType = {id: 6};
        //     service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
        //         vm.subFlashCards = data.content;
        //         vm.bsTableControl.options.data = vm.subFlashCards;
        //         vm.bsTableControl.options.totalRows = data.totalElements;
        //     });
        // };

        vm.bsTableControlIELTSWritingSubQuestion = {
            options: {
                data: vm.subFlashCards,
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
                columns: service.getTableDefinitionSubFlashCards(),
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
                    vm.getPageFlashCard();
                }
            }
        };
        //---------------------- END IELTS Writing ---------------------------//


    }

})();