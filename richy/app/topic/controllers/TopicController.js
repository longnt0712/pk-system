/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Topic').controller('TopicController', TopicController);

    TopicController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'TopicService',
        'Upload',
        '$cookies',
        'QuestionService',
        '$stateParams',
        '$filter',
        'blockUI'
    ];

    angular.module('Hrm.Topic').directive('compile', ['$compile', function ($compile) {
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

    angular.module('Hrm.Topic').directive('fileDownload',function(){
        return{
            restrict:'A',
            scope:{
                fileDownload:'=',
                fileName:'=',
            },

            link:function(scope,elem,atrs){


                scope.$watch('fileDownload',function(newValue, oldValue){

                    if(newValue!=undefined && newValue!=null){
                        console.debug('Downloading a new file');
                        var isFirefox = typeof InstallTrigger !== 'undefined';
                        var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
                        var isIE = /*@cc_on!@*/false || !!document.documentMode;
                        var isEdge = !isIE && !!window.StyleMedia;
                        var isChrome = !!window.chrome && !!window.chrome.webstore || window.chrome!=null;;
                        var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
                        var isBlink = (isChrome || isOpera) && !!window.CSS;

                        if(isFirefox || isIE || isChrome){
                            if(isChrome){
                                console.log('Manage Google Chrome download');
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var downloadLink = angular.element('<a></a>');//create a new  <a> tag element
                                downloadLink.attr('href',fileURL);
                                downloadLink.attr('download',scope.fileName);
                                downloadLink.attr('target','_self');
                                downloadLink[0].click();//call click function
                                url.revokeObjectURL(fileURL);//revoke the object from URL
                            }
                            if(isIE){
                                console.log('Manage IE download>10');
                                window.navigator.msSaveOrOpenBlob(scope.fileDownload,scope.fileName);
                            }
                            if(isFirefox){
                                console.log('Manage Mozilla Firefox download');
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var a=elem[0];//recover the <a> tag from directive
                                a.href=fileURL;
                                a.download=scope.fileName;
                                a.target='_self';
                                a.click();//we call click function
                            }


                        }else{
                            alert('SORRY YOUR BROWSER IS NOT COMPATIBLE');
                        }
                    }
                });

            }
        }
    });

    angular.module('Hrm.Topic').filter('removeHTMLTags', function() {

        return function(text) {

            return  text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function TopicController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload,$cookies,questionService,$stateParams,$filter, blockUI) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;
        var vm = this;

        vm.topic = {};
        vm.topics = [];
        vm.selectedTopics = [];
        vm.pageIndex = 1;
        vm.pageSize = 25;
        vm.searchDto = {};

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        vm.searchDto.username = vm.currentUser.username;
        vm.searchDto.userId = vm.currentUser.id;

        /* TINYMCE */
        $scope.tinymceOptions = {
            height: 400,
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


        vm.getPage = function () {
            blockUI.start();
            service.getPage(vm.searchDto,vm.pageIndex, vm.pageSize).then(function (data) {
                blockUI.stop();
                vm.topics = data.content;
                vm.bsTableControl.options.data = vm.topics;
                vm.bsTableControl.options.totalRows = data.totalElements;
                // console.log(vm.topics);
            });
        };

        vm.getPage();

        vm.topicCategories = [];
        vm.getPageTopicCategory = function () {
            blockUI.start();
            service.getPageTopicCategory(null,1, 100).then(function (data) {
                blockUI.stop();
                vm.topicCategories = data.content;
            });
        };

        vm.getPageTopicCategory();

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
            
            // if(vm.listFlashCard == 3 || vm.isFlashCardMode == 1){
                // console.log('listFlashCard');

            // }

            // if($stateParams.writingCollectionMode == 2){
            //     // console.log('IELTSWriting');
            //
            //     vm.getPageIELTSWriting();
            // }
        };

        vm.bsTableControl = {
            options: {
                data: vm.topics,
                idField: 'id',
                sortable: false,
                striped: true,
                maintainSelected: false,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.pageSize,
                pageList: [5, 10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinition(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedTopics.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedTopics = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedTopics.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedTopics = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    vm.pageSize = pageSize;
                    vm.pageIndex = index;
                    vm.getPage();
                }
            }
        };

        /**
         * New content
         */

        //validation gaps
        function checkGap(text) {
            if(text.length <= 0)
                return false;


            if(!isNaN(text))
                return true;

            if(text === 'he' || text === 'He'  || text === 'she'  || text === 'She'
                || text === 'it'  || text === 'It'  || text === 'they' || text === 'They'
                || text === 'you'  || text === 'You' ||  text === 'i' ||  text === 'I'
                ||  text === 'we' || text === 'We'
                || text === 'there' || text === 'There'
                || text === 'people' || text === 'my'
                || text === 'and' || text === 'of') {
                return false;
            }

            if(/\r|\n/.exec(text)){
                return false;
            }

            var a = text.split("");
            if(a[0] === a[0].toUpperCase()){
                return false;
            }

            // console.log('true');

            return true;
        }

        //validation gaps articles
        function gapArticles(text) {
            if(text.length <= 0)
                return false;

            if(text ==='a' || text === 'A'
                || text ==='an'  || text === 'An'
                || text ==='the' ||  text === 'The'
                || text ==='am' || text ==='Am'
                || text ==='is' || text ==='Is'
                || text ==='are' || text ==='Are'
                || text ==='was' || text ==='Was'
                || text ==='were' || text ==='Were'
                || text ==='been' || text ==='Been'
                || text ==='be' || text ==='Be'
                || text ==='have' || text ==='Have'
                || text ==='has' || text ==='Has'
                || text ==='had' || text ==='Had'
                || text ==='on' || text ==='On'
                || text ==='at' || text ==='At'
                || text ==='in' || text ==='In'
                || text ==='by' || text === 'By'
                || text ==='of' || text ==='Of'
                || text ==='with' || text ==='With'
                || text ==='which' || text ==='Which'
                || text ==='when' || text ==='When'
                || text ==='what' || text ==='What'
                || text ==='where' || text ==='Where'
                || text ==='that' || text ==='That'
                || text ==='for' || text ==='For'
                || text ==='of' || text ==='Of'
                || text ==='around' || text ==='Around'
                || text ==='about' || text ==='About'
                || text ==='to' || text ==='To'
                || text ==='more' || text ==='More'
                || text ==='less' || text ==='Less'
                || text ==='from' || text ==='From'
                || text ==='as' || text ==='As'
                || text ==='since' || text ==='Since'
                || text ==='also' || text ==='Also'
                || text ==='but' || text ==='But'
                || text ==='so' || text ==='So'
                || text ==='between' || text ==='Between'
                || text ==='and' || text ==='And') {
                return true;
            }

            return false;
        }

        //filling gaps
        vm.fillingGapQuestion = '';
        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min) ) + min;
        }

        function processFillingGaps(text){
            if(text == null || text.length <= 0 || angular.isUndefined(text)){
                return;
            }
            
            var x = text.split(" ");
            // console.log(x);
            var indexGap = 0;
            var processedText = '';
            var previousIndex = null;
            var isFirstGap = true;
            // for(var i = 0; i < x.length; i++){
            //     var randomNumber = getRndInteger(1,3);
            //     if(randomNumber === 2) {
            //         processedText = processedText + ' ' + x[i];
            //     } else {
            //         indexGap++;
            //         var input = '_____________';
            //         // processedText = processedText + " (" + indexGap + ") " + input;
            //         processedText = processedText + " " + input;
            //         previousIndex = i;
            //     }
            // }

            for(var i = 0; i < x.length; i++){
                var randomNumber = getRndInteger(1,4);

                    if(!checkGap(x[i])) {
                        processedText = processedText + ' ' + x[i];

                    } else if(randomNumber === 2 || randomNumber === 3) {
                        // indexGap++;
                        var input = '_____________';
                        // processedText = processedText + " (" + indexGap + ") " + input;
                        var a = x[i].split("");
                        if(a[a.length - 1] === ','
                            || a[a.length - 1] === '.'
                            || a[a.length - 1] === ';'
                            || a[a.length - 1] === '?')
                            input = input + a[a.length - 1];

                        processedText = processedText + " " + input;
                        if(/\r|\n/.exec(x[i])){
                            processedText = processedText + '\n' + '\n';
                        }
                        previousIndex = i;
                    } else {
                        processedText = processedText + ' ' + x[i];
                    }


            }

            // console.log(processedText);
            return processedText;
        }

        //filling gaps
        vm.fillingGapQuestion2 = '';

        function processFillingGaps2(text){
            if(text == null || text.length <= 0 || angular.isUndefined(text)){
                return;
            }

            var x = text.split(" ");
            // console.log(x);
            var indexGap = 0;
            var processedText = '';
            var previousIndex = null;
            var isFirstGap = true;

            for(var i = 0; i < x.length; i++){
                if(!gapArticles(x[i])) {
                    processedText = processedText + ' ' + x[i];

                } else {
                    // indexGap++;
                    var input = '_______';
                    // processedText = processedText + " (" + indexGap + ") " + input;
                    var a = x[i].split("");
                    if(a[a.length - 1] === ','
                        || a[a.length - 1] === '.'
                        || a[a.length - 1] === ';')
                        input = input + a[a.length - 1];

                    processedText = processedText + " " + input;
                    if(/\r|\n/.exec(x[i])){
                        processedText = processedText + '\n' + '\n';
                    }
                    previousIndex = i;
                }
            }

            // console.log(processedText);
            return processedText;
        }

        //filling gaps
        vm.fillingGapQuestion3 = '';

        // vm.doShuffle = function() {
        //     shuffleArray(vm.questions);
        // };

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

        function processFillingGaps3(text){
            if(text == null || text.length <= 0 || angular.isUndefined(text)){
                return;
            }

            var x = text.split("\n");
            // console.log(x);
            var processedText = '';


            for(var i = 0; i < x.length; i++){


                var x2 = x[i].split(".");
                x2 = x2.filter(function(str) {
                    return /\S/.test(str);
                });
                // console.log(x2);
                for(var j = 0; j <x2.length; j++){
                    var a = x2[j].split(" ");
                    shuffleArray(a);
                    console.log(a);
                    for(var k = 0; k < a.length; k++){
                        // console.log(a[k]);
                        processedText = processedText + a[k] + " / ";
                        if(k === a.length - 1){
                            processedText = processedText + '\n' + '\n';
                        }
                    }
                }

                // var a = x[i].split(" ");
                // shuffleArray(a);
                // for(var j = 0; j < a.length; j++){
                //     processedText = processedText + a[j] + " / ";
                // }

            }

            // console.log(processedText);
            return processedText;
        }


        // vm.searchDto.pageSize = 15;
        vm.searchDtoQuestion= {};
        vm.searchDtoQuestion.upper = 100;
        vm.searchDtoQuestion.lower = 0;
        vm.searchDtoQuestion.type = 100;
        vm.searchDtoQuestion.pageSize = 15;
        vm.searchDtoQuestion.pageIndex = 1;

        vm.getPageQuestion = function () {
            vm.searchDtoQuestion.questionType = {id: 6};
            vm.searchDtoQuestion.username = vm.currentUser.username;
            vm.searchDtoQuestion.userId = vm.currentUser.id;

            questionService.getPage(vm.searchDtoQuestion, 1, 100000).then(function (data) {
                vm.questions = $filter('orderBy')(data.content, 'question', false);
                // console.log(data.content);
            });
        };

        vm.sortQuestions = function () {
            vm.questions = $filter('orderBy')(vm.questions, 'question', false);
        };


        $scope.createGaps = function (id) {


            service.getOne(id).then(function (data) {
                vm.topic = data;
                vm.fillingGapQuestion = (processFillingGaps(vm.topic.content));
                vm.topic.isNew = false;

                var qt = {};
                qt.topic = vm.topic;
                vm.searchDtoQuestion.questionTopics = [];
                vm.searchDtoQuestion.questionTopics.push(qt);

                vm.getPageQuestion();

                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'create_gaps_modal.html',
                    scope: $scope,
                    size: 'lg',
                    backdrop: 'static',
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                    }
                }, function () {
                });
            });
        };

        $scope.createContentNormal = function (id) {
            service.getOne(id).then(function (data) {
                vm.topic = data;
                vm.fillingGapQuestion = (processFillingGaps(vm.topic.content));
                vm.fillingGapQuestion2 = (processFillingGaps2(vm.topic.content));
                vm.fillingGapQuestion3 = (processFillingGaps3(vm.topic.content));
                vm.topic.isNew = false;

                var qt = {};
                qt.topic = vm.topic;
                vm.searchDtoQuestion.questionTopics = [];
                vm.searchDtoQuestion.questionTopics.push(qt);

                vm.getPageQuestion();

                // var modalInstance = modal.open({
                //     animation: true,
                //     templateUrl: 'create_normal_modal.html',
                //     scope: $scope,
                //     size: 'lg',
                //     backdrop: 'static',
                // });
                //
                // modalInstance.result.then(function (confirm) {
                //     if (confirm == 'yes') {
                //     }
                // }, function () {
                // });
            });
        };

        if($stateParams.topicId != null){
            $scope.createContentNormal ($stateParams.topicId);
        }

        /**
         * New event account
         */
        vm.newObject = function () {

            vm.topic.isNew = true;
            vm.topic.userId = vm.currentUser.id;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md',
                backdrop: 'static',
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.topic).then(function (data) {
                        vm.getPage();
                        vm.topic = {};
                        if(data.message != null){
                            toastr.info(data.message, 'Notification');
                        }else{
                            toastr.error('Error.', 'Warning');
                        }

                    });

                    // service.saveObject(vm.topic, function success(data) {
                    //     console.log(vm.topic);
                    //     vm.getPage();
                    //     toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                    //     vm.topic = {};
                    // }, function failure() {
                    //     toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    // });
                }
            }, function () {
                vm.topic = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.topic = data;
                vm.topic.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md',
                    backdrop: 'static',
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.topic).then(function (data) {
                            vm.getPage();
                            vm.topic = {};
                            if(data.message != null){
                                toastr.info(data.message, 'Notification');
                            }else{
                                toastr.error('Error.', 'Warning');
                            }
                        });
                        // service.saveObject(vm.topic, function success(data) {
                        //     console.log(vm.topic);
                        //     vm.getPage();
                        //     toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                        //     vm.topic = {};
                        // }, function failure() {
                        //     toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        // });
                    }
                }, function () {
                    vm.topic = {};
                });
            });
        };
        
        vm.saveTopicForCategoryTopic = function (topic,topicCategory) {
            console.log(topic);
            service.saveObject(topic).then(function (data) {
                vm.getPage();
                vm.topic = {};
                if(data.message != null){
                    toastr.info(data.message, 'Notification');
                }else{
                    toastr.error('Error.', 'Warning');
                }
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
                	console.log(vm.selectedTopics);
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

        //// Upload file
        $scope.MAX_FILE_SIZE = '2MB';
        $scope.f = null;
        $scope.errFile = null;
        vm.baseUrl = settings.api.baseUrl + settings.api.apiPrefix;

        $scope.uploadFiles = function(file, errFiles) {
            $scope.f = file;
            $scope.errFile = errFiles && errFiles[0];
        };

        vm.startUploadFile = function(file) {
            // console.log(file);
            if (file) {
                file.upload = Upload.upload({
                    url: vm.baseUrl + 'file/import_bill/',
                    data: {uploadfile: file}
                });

                file.upload.then(function (response) {
                    // console.log(response);
                    file.result = response.data;
                    // getListSubject(vm.pageIndex,vm.pageSize);
                    toastr.info('Import thành công.', 'Thông báo');
                },function errorCallback(response) {
                    toastr.error('Import lỗi.', 'Lỗi');
                });
            }
        };

        vm.importBills = function () {
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'import_modal.html',
                scope: $scope,
                size: 'md'
            });

            vm.student = {};
            $scope.f = null;
            $scope.errFile = null;

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    vm.startUploadFile($scope.f);
                    // console.log($scope.f);
                }
            }, function () {
                vm.educationProgram = null;
                vm.address = {};
                // console.log("cancel");
            });
        }

        $scope.myBlobObject=undefined;
        $scope.getFile=function(){
            console.log('download started, you can show a wating animation');
            service.getStream()
                .then(function(data){//is important that the data was returned as Aray Buffer
                    console.log('Stream download complete, stop animation!');
                    $scope.myBlobObject=new Blob([data],{ type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                },function(fail){
                    console.log('Download Error, stop animation and show error message');
                    $scope.myBlobObject=[];
                });
        };

    }

})();