/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('QuestionCatechismController', QuestionCatechismController);

    QuestionCatechismController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'QuestionService',
        '$location'
    ];

    function QuestionCatechismController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location) {
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
        vm.questions = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};
        vm.answer = null;
        vm.answers = [];

        vm.from = {id: 6001, name:"Trang 4"};
        vm.to = {id: 6002, name:"Trang 5"};
        

        vm.type = {id: 6001, name:"Trang 4"};
        vm.types = [
            {id: 6001, name:"Trang 4"},
            {id: 6002, name:"Trang 5"},
            {id: 6003, name:"Trang 6"},
            {id: 6004, name:"Trang 7"},
            {id: 6005, name:"Trang 8"},
            {id: 6006, name:"Trang 9"},
            {id: 6007, name:"Trang 10"},
            {id: 6008, name:"Trang 11"},
            {id: 6009, name:"Trang 12"},
            {id: 6010, name:"Trang 13"},
            {id: 6011, name:"Trang 14"},
            {id: 6012, name:"Trang 15"},
            {id: 6013, name:"Trang 16"},
            {id: 6014, name:"Trang 17"},
            {id: 6015, name:"Trang 18"},
            {id: 6016, name:"Trang 19"},
            {id: 6017, name:"Trang 20"},
            {id: 6018, name:"Trang 21"},
            {id: 6019, name:"Trang 22"},
            {id: 6020, name:"Trang 23"},
            {id: 6021, name:"Trang 25"},
            {id: 6022, name:"Trang 26"},
            {id: 6023, name:"Trang 27"},
            {id: 6024, name:"Trang 28"},
            {id: 6025, name:"Trang 29"},
            {id: 6026, name:"Trang 30"},
            {id: 6027, name:"Trang 31"},
            {id: 6028, name:"Trang 32"},
            {id: 6029, name:"Trang 33"},
            {id: 6030, name:"Trang 34"},
            {id: 6031, name:"Trang 35"},
            {id: 6032, name:"Trang 36"},
            {id: 6033, name:"Trang 37"},
            {id: 6034, name:"Trang 38"},
            {id: 6035, name:"Trang 39"},
            {id: 6036, name:"Trang 40"},
            {id: 6037, name:"Trang 41"},
            {id: 6038, name:"Trang 42"},
            {id: 6039, name:"Trang 43"},
            {id: 6040, name:"Trang 44"},
            {id: 6041, name:"Trang 45"},
            {id: 6042, name:"Trang 46"},
            {id: 6043, name:"Trang 47"},
            {id: 6044, name:"Trang 48"},
            {id: 6045, name:"Trang 49"},
            {id: 6046, name:"Trang 50"},
            {id: 6047, name:"Trang 51"},
            {id: 6048, name:"Trang 52"},
            {id: 6049, name:"Trang 53"},
            {id: 6050, name:"Trang 54"},
            {id: 6051, name:"Trang 55"},
            {id: 6052, name:"Trang 56"},
            {id: 6053, name:"Trang 57"},
            {id: 6054, name:"Trang 58"},
            {id: 6055, name:"Trang 59"},
            {id: 6056, name:"Trang 60"},
            {id: 6057, name:"Trang 61"},
            {id: 6058, name:"Trang 62"},
            {id: 6059, name:"Trang 63"},
            {id: 6060, name:"Trang 64"},
            {id: 6061, name:"Trang 65"},
            {id: 6062, name:"Trang 66"},
            {id: 6063, name:"Trang 67"},
            {id: 6064, name:"Trang 68"},
            {id: 6065, name:"Trang 69"},
            {id: 6066, name:"Trang 70"}
            
        ];
        //1:writing; 2: wimpy kid; 3: idiom - expression; 4: other

        // vm.status = {id: 1, name:"Chưa thuộc"};
        vm.searchDto.status = 4;
        vm.status = {id: 4, name:"Hỏi thưa"};
        vm.statuses = [
            // {id: 1, name:"Chưa thuộc"},
            // {id: 2, name:"Thuộc"},
            // {id: 3, name:"Tất cả"},
            {id: 4, name:"Hỏi thưa"},
            {id: 5, name:"Âm tiết"}

            // {id: 3, name:"Tất cả"}
        ];

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

        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 6001;

        vm.getPage = function () {
            service.getPage(vm.searchDto,vm.pageIndex, vm.pageSize).then(function (data) {
                vm.questions = data.content;
                // shuffleArray(vm.questions);
                // console.log(vm.questions[Math.floor(Math.random()*data.totalElements)]);
                // vm.questions = list.sort(() => Math.random() - 0.5)
                vm.bsTableControl.options.data = vm.questions;
                vm.bsTableControl.options.totalRows = data.totalElements;
                console.log(vm.questions);

            });
        };

        $scope.doShuffle = function() {
            shuffleArray(vm.questions);
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
        vm.getQuestionTypes = function () {
            service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.questionTypes = data.content;
                vm.question.questionType = vm.questionTypes[0];
                console.log(vm.questionTypes);
            });
        };
        $scope.pageChanged = function () {
            vm.getAnswers();
        };

        vm.getPage();
        vm.getAnswers();
        vm.getQuestionTypes();

        vm.bsTableControl = {
            options: {
                data: vm.questions,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
                clickToSelect: false,
                showColumns: true,
                showToggle: true,
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
                    vm.getPage();
                }
            }
        };

        vm.selectType = function () {
            console.log(vm.question);
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
                        vm.getPage();
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
                            vm.getPage();
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

        vm.enterSearchCode = function(){
            // console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.codeChange();
            }
        };
        vm.codeChange=function () {
            vm.pageIndex = 1;
            // vm.bsTableControl.state.pageNumber.state = 1;
            vm.getPage();
        };

        vm.newFlashCard = function () {
            vm.question = {};
            vm.question.isNew = true;
            vm.question.questionType = vm.questionTypes[5];
            vm.question.type = vm.type.id;
            vm.question.status = 4;
            vm.searchDto.status = 4;
            vm.status = {id: 4, name:"Hỏi Thưa"};
            vm.getPage();
            console.log(vm.question.questionType);

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_flash_card_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {

                    service.saveObject(vm.question, function success() {
                        vm.getPage();
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

        $scope.editFlashCard = function (id) {
            service.getOne(id).then(function (data) {
                vm.question = data;
                console.log(data);

                vm.question.isNew = false;


                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_flash_card_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.question, function success() {

                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.question = {};
                        }, function failure() {
                            console.log(vm.question);                     toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.question = {};
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
            service.getRandomQuestion(vm.type.id,vm.searchDto.lower, vm.searchDto.upper).then(function (data) {
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
                        //         // vm.getPage();
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

        vm.clickNext = function () {
            vm.answer = false;
            vm.myAnswer = '';
            vm.flashCard = {};
            service.getRandomQuestion(vm.type.id,vm.searchDto.lower, vm.searchDto.upper).then(function (data) {
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
                    service.getObject(vm.flashCard.id).then(function (data) {
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

                    // vm.getPage();
                    toastr.warning('Sai cmnr!!!', 'Vãiii');
                    service.getObject(vm.flashCard.id).then(function (data) {
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

        vm.editFlashCard1 = function (id) {
            service.getOne(id).then(function (data) {
                vm.question = data;
                console.log(vm.question.status);
                vm.question.isNew = false;


                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_flash_card_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.question, function success() {

                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.question = {};
                        }, function failure() {
                            console.log(vm.question);                     toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
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
                        vm.getPage();
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

        function showBackFlashCard(text) {
            const notification = new Notification("Back: " + text,{
                // body: text
            });

        }
        
        function showNotification() {
            console.log(vm.type.id);
            service.getRandomQuestion(vm.type.id,vm.searchDto.lower, vm.searchDto.upper).then(function (data) {
                vm.question = data;
                var question = vm.question.question + " " + vm.question.pronounce;
                var description = vm.question.description;
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

        vm.typeChange = function () {
            // clearInterval(idInterval);
            // setInterval(showNotification,36000);
            vm.question.type = vm.type.id;
            vm.searchDto.type = vm.type.id;
            vm.getPage();
            console.log(vm.question);
        };


        vm.statusChange = function () {
            vm.question.status = vm.status.id;
            vm.searchDto.status = vm.status.id;
            vm.getPage();
            console.log(vm.question);
        };

        // setInterval(showNotification,500);
        
        //-------------------------------- IELTS Ư

    }

})();