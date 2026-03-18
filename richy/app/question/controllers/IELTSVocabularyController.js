/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSVocabularyController', IELTSVocabularyController);

    IELTSVocabularyController.$inject = [
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
        'TopicService'
        // 'dndLists'
        // 'ngSanitize',
        
    ];

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

    function IELTSVocabularyController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies,topicService) {
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
            {id: 0, title:'Choose items for your room', content:'Dynamic content 1' },
            {id: 1, title:'Your items', content:'Dynamic content 1' },
            {id: 2, title:'Item', content:'Dynamic content 2'}
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
            questionTopics: pushTopic(vm.selectedTopicToAdd),
            userId: vm.currentUser.id
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

        vm.getPageIELTSWriting = function () {
            vm.searchDto.questionType = {id: 20};
            blockUI.start();
            service.getPage(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.writingQuestions = data.content;
                vm.bsTableControlIELTSWriting.options.data = vm.writingQuestions;
                vm.bsTableControlIELTSWriting.options.totalRows = data.totalElements;
            });
        };


        vm.ieltsMaterials = [];
        vm.searchDtoForMaterial = {};
        vm.getPageMaterial = function () {
            function firstCallFunction(myCallback) {
                var timeout;
                timeout = $timeout(function(){
                    vm.searchDtoForMaterial.pageSize = 12;
                    vm.searchDtoForMaterial.pageIndex = 1;
                    vm.searchDtoForMaterial.questionType = {id: 21};
                    vm.searchDtoForMaterial.upper = 100;
                    vm.searchDtoForMaterial.lower = 0;
                    // vm.searchDto.type = 100;
                    vm.searchDtoForMaterial.username = null;
                    vm.searchDtoForMaterial.userId = null;

                    myCallback(vm.searchDtoForMaterial);
                },0);
            }

            function secondCallFunction(searchDtoForMaterial) {
                console.log(searchDtoForMaterial);
                var timeout;
                timeout = $timeout(function(){
                    blockUI.start();
                    service.getPage(searchDtoForMaterial, searchDtoForMaterial.pageIndex, searchDtoForMaterial.pageSize).then(function (data) {
                        blockUI.stop();
                        vm.ieltsMaterials = data.content;
                        vm.bsTableControlIELTSMaterial.options.data = vm.ieltsMaterials;
                        vm.bsTableControlIELTSMaterial.options.totalRows = data.totalElements;
                    });
                    timeout = null;
                },0);
            }
            firstCallFunction(secondCallFunction);
        };
        vm.searchDto.pageSize = 10;
        vm.getPageIELTSWriting();
        vm.getPageMaterial();

        vm.topics = [];
        vm.topic = {};
        vm.topic.userId = vm.currentUser.id;
        vm.getTopics = function () {
            service.getTopics(vm.searchDto,1, 10000).then(function (data) {
                vm.topics = data.content;
                // console.log(vm.topics);
            });
        };
        vm.saveTopic = function () {
            if(vm.topic.name == null || angular.isUndefined(vm.topic.name)){
                toastr.warning('Please fill in the name of the topic');
                return;
            }
            topicService.saveObject(vm.topic, function success() {
                toastr.info('successfully');
                vm.topic = {};
                vm.topic.userId = vm.currentUser.id;
                vm.getTopics();
            }, function failure() {
                toastr.error('Error');
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

        vm.topicChangeItem = function (item) {

            item.questionTopics = pushTopic(item.selectedTopicToEdit);

        };

        vm.topicChange = function () {

            vm.newCard.questionTopics = pushTopic(vm.selectedTopicToAdd);

            // if(vm.currentCard === null || typeof(vm.currentCard) !== "undefined"){
            //     vm.currentCard.questionTopics = pushTopic(vm.selectedTopicToEdit);
            // }


        };

        //---------------------- IELTS Writing ---------------------------//
        vm.idCurrentWriting = 0;
        vm.isNewCard = true;
        vm.saveFlashCard = function () {
            if(vm.newCard.question == null || angular.isUndefined(vm.newCard.question)){
                toastr.warning('Please fill in the word');
                return;
            }
            service.saveObject(vm.newCard).then(function (data1) {
                // vm.getPageFlashCard();
                // toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
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

                if(data1.message != null){
                    if(data1.message === 'Successfully, but there is another card like this'){
                        toastr.warning(data1.message, 'Warning');
                        // vm.newCard = data;
                        // console.log(data);
                    } else{
                        toastr.info(data1.message, 'Notification');
                        // vm.newCard = {
                        //     questionType : {
                        //         code: 'FC',
                        //         id: 6,
                        //         name: 'Flash card',
                        //         textSearch: null
                        //     },
                        //     status : 1,
                        //     questionTopics: pushTopic(vm.selectedTopicToAdd),
                        //     userId: vm.currentUser.id
                        // };
                    }
                }else{
                    toastr.error('Error.', 'Warning');
                }

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

                // vm.selectedTopicToAdd = [];
                vm.isNewCard = true;

            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });

        };

        vm.showDetailFlashCard = function (item) {
            item.selectedTopicToEdit = getListTopicFromCard(item.questionTopics);
            item.showDetail = true;
        };

        vm.hideDetailFlashCard = function (item) {
            item.showDetail = false;
        };

        vm.editFlashCard = function (item) {
            service.saveObject(item, function success() {

                // vm.getPageFlashCard();
                toastr.info('Save successfully');
                // vm.currentCard = {};
            }, function failure() {
                // console.log(vm.currentCard);

                toastr.error('Error');
            });

            // vm.isNewCard = false;
            // service.getOne(id).then(function (data) {
            //     vm.newCard = data;
            //     // console.log(vm.currentCard);
            //     vm.selectedTopicToEdit = getListTopicFromCard(vm.newCard.questionTopics);
            //
            //     var modalInstance = modal.open({
            //         animation: true,
            //         templateUrl: 'edit_flash_card_modal.html',
            //         scope: $scope,
            //         size: 'md'
            //     });
            //
            //     modalInstance.result.then(function (confirm) {
            //         if (confirm == 'yes') {
            //             service.saveObject(vm.currentCard, function success() {
            //
            //                 vm.getPageFlashCard();
            //                 toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
            //                 vm.currentCard = {};
            //             }, function failure() {
            //                 console.log(vm.currentCard);
            //
            //                 toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
            //             });
            //         }
            //     }, function () {
            //         // vm.currentCard = {};
            //     });
            // });
        };

        vm.isShowWordList = false;

        vm.showWordList = function () {
            vm.isShowWordList = true;
            $scope.tinymceOptionsToQuestion.height = 560;
        };

        vm.isShowWords = true;
        vm.isShowNotes = false;
        vm.isShowAddWords = false;
        vm.chosen = 'green';
        vm.showTypes = function (type) {
            if(type === 1){
                vm.isShowWords = true;
                vm.isShowNotes = false;
                vm.isShowAddWords = false;
            }
            if(type === 2){
                vm.isShowWords = false;
                vm.isShowNotes = true;
                vm.isShowAddWords = false;
            }
            if(type === 3){
                vm.isShowWords = false;
                vm.isShowNotes = false;
                vm.isShowAddWords = true;
            }
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
            toolbar1: 'example bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image media  ',
            // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
            // autoresize_bottom_margin: 0,
            statusbar: false,
            image_advtab: true,
            menubar: false,
            // contextmenu: "link image inserttable | cell row column deletetable | example1",
            setup: function(ed) {
                ed.addButton('example', {
                    title: 'Search words',
                    image: 'https://www.cambridge.org/packages/cambridge_themes/images/english/CambEng.png',
                    onclick: function() {
                        // ed.insertContent('Hello world!!');
                        console.log(ed.selection.getContent());
                        $scope.getSelectedText(ed.selection.getContent({format : 'text'}));
                    }
                });
                // ed.addContextToolbar('example1', {
                //     title: 'My title1',
                //     image: '',
                //     onclick: function() {
                //         ed.insertContent('Hello world!!');
                //     }
                // });
            },
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
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
            toolbar1: 'bold italic underline strikethrough removeformat | fontsize | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image media  ',
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
            toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image media  ',
            // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
            // autoresize_bottom_margin: 0,
            statusbar: false,
            image_advtab: true,
            menubar: false,
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
        };

        vm.writingQuestions = [];
        vm.selectedTopicToAddIELTSWriting = [];
        vm.selectedTopicToSearchIELTSWriting = [];
        vm.isNewWriting = true;
        vm.newWritingQuestion = {
            questionType : {
                code: 'IV',
                id: 20,
                name: 'IELTS Vocabulary',
                textSearch: null
            },
            status : 1,
            questionTopics: [],
            countWords : 0,
            userId: vm.currentUser.id
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
                                code: '	IV',
                                id: 20,
                                name: 'IELTS Vocabulary',
                                textSearch: null
                            },
                            status : 1,
                            questionTopics: [],
                            countWords : 0,
                            userId: vm.currentUser.id
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

        $scope.selectToLearn = function (id) {
            $scope.active = 2;
            // console.log(id);
            service.getOne(id).then(function (data) {
                var newItem = data;
                newItem.id = null;
                newItem.questionType = {
                    code: '	IV',
                    id: 20,
                    name: 'IELTS Vocabulary',
                    textSearch: null
                };
                newItem.userId = vm.currentUser.id;
                newItem.parent = {id: id};
                // console.log(data);
                if(validateSaveIELTSWriting(newItem) == true){
                    // service.saveMaterial(newItem, function success() {
                    //     toastr.info('Select Successfully');
                    // }, function failure() {
                    //     toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    // }, function complete() {
                    //     toastr.error('a', 'Thông báo');
                    // });

                    service.saveMaterial(newItem).then(function (data) {
                        if(data == null || data.id == null){
                            toastr.warning('Duplicated');
                        }else{
                            toastr.info('Successfully');
                        }
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }


            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        vm.cancelEditingIELTSWriting = function () {
            vm.newWritingQuestion = {
                questionType : {
                    code: '	IV',
                    id: 20,
                    name: 'IELTS Vocabulary',
                    textSearch: null
                },
                status : 1,
                questionTopics: [],
                countWords : 0,
                userId: vm.currentUser.id
            };
            vm.selectedTopicToAddIELTSWriting = [];
            vm.isNewWriting = true;
            vm.isView = false;
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

        vm.bsTableControlIELTSMaterial = {
            options: {
                data: vm.ieltsMaterials,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.searchDtoForMaterial.pageSize,
                pageList: [5, 10, 25, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinitionIeltsMaterial(),
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
                    vm.searchDtoForMaterial.pageSize = pageSize;
                    vm.searchDtoForMaterial.pageIndex = index;
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
            $scope.active = 3;
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
            console.log('15');
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
            toolbar1: 'bold italic underline strikethrough removeformat | forecolor backcolor  | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent | image media  ',
            // toolbar1: 'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify  | numlist bullist outdent indent  | removeformat',
            // autoresize_bottom_margin: 0,
            statusbar: false,
            image_advtab: true,
            menubar: false,
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
        };

        vm.isShowAll = true;
        vm.isShowAllEventChange = function () {
          if(vm.isShowAll == true){
              vm.isShowAll = false;
              
          }  else if(vm.isShowAll == false){
              vm.isShowAll = true;
          }
        };

        $scope.active = 2;

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

        $scope.getSelectedText = function (text) {
            // var node = tinyMCE.activeEditor.selection.getContent();
            // console.log('selected');
            // var text = "";
            // if (window.getSelection) {
            //     text = window.getSelection().toString();
            // } else if (document.selection && document.selection.type != "Control") {
            //     text = document.selection.createRange().text;
            // }

            if(text.length > 0 && text.trim().length > 0){
                $window.open('https://dictionary.cambridge.org/vi/dictionary/english/'+ text, '_blank');
            }

        };


        vm.isView = false;
        vm.viewAndEdit = function () {
            if(vm.isView == true){
                vm.isView = false;
            }else{
                vm.isView = true;
            }
        };
        //---------------------- END IELTS Writing ---------------------------//


    }

})();