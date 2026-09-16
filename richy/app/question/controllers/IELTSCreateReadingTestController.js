/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSCreateReadingTestController', IELTSCreateReadingTestController);

    IELTSCreateReadingTestController.$inject = [
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

    function IELTSCreateReadingTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.isListeningMode = /\/create_ielts_listening_test(?:\/|$)/i.test($location.path());
        vm.testModeName = vm.isListeningMode ? 'Listening' : 'Reading';
        vm.testModeIcon = vm.isListeningMode ? 'fa-headphones' : 'fa-book';

        window.addEventListener('beforeunload', function (e) {
            // Cancel the event
            e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
            // Chrome requires returnValue to be set
            e.returnValue = '';
        });

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        // console.log(vm.currentUser);
        if(vm.currentUser.roles != null){
            angular.forEach(vm.currentUser.roles, function(value, key) {
                if(value.name == "ROLE_ADMIN"){
                    settings.isAdmin = true;
                    console.log("ADMIN");
                }
            });
        }

        vm.question = {};
        vm.questions = [];
        vm.selectedQuestions = [];
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};
        // vm.searchDto.userId = vm.currentUser.id;
        vm.answer = null;
        vm.answers = [];

        vm.type = {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"};
        vm.types = [
            {id: 1, name: "Multiple Choices", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 2, name: "Filling Gaps", notice: "Fill words in gaps"},
            {id: 3, name: "Filling Gaps Enter", notice: "Fill A-G in gaps"},
            {id: 4, name: "Matching Heading", notice: "Drag and Drop"},
            {id: 5, name: "Multiple Choices - Multiple Answers", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 6, name: "Multiple Choices - Listening (horizon)", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 7, name: "Multiple Answers - Listening", notice: "T/F/NG or Y/N/NG is also multiple choice question"},
            {id: 8, name: "Matching Heading - Listening", notice: "Drop box (temp)"},
            {id: 9, name: "MAPS - Listening", notice: "..."},
            {id: 10, name: "MATCHING NAMES", notice: "Use one shared A–Z researcher list; the list appears below the matching table"},
            {id: 11, name: "Filling Gaps New (One Editor)", notice: "Write all questions in one editor; each }{SPACE}{ becomes the next numbered answer"},
            {id: 12, name: "MATCHING INFORMATION", notice: "Same creation and test layout as Matching Names"},
            {id: 13, name: "COMPLETE LIST OF WORDS", notice: "One editor with ordered correct words followed by distractors; students drag a shuffled word list into the gaps"},
            {id: 14, name: "Complete each sentence with the correct ending", notice: "Use one shared A–Z list of endings; students drag each ending into the blank after a sentence"}
        ];
        vm.passageTypes = vm.types.slice(0, 10);

        vm.matchingOptionLabel = function (index) {
            index = parseInt(index, 10);
            if (isNaN(index) || index < 0) {
                return '';
            }
            var label = '';
            do {
                label = String.fromCharCode(65 + (index % 26)) + label;
                index = Math.floor(index / 26) - 1;
            } while (index >= 0);
            return label;
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
        vm.currentPosition = 0;
        vm.currentCard = {};

        vm.ieltsWritingTests = [];

        vm.ieltsReadingTests = [];
        vm.learningProgressByTestId = {};

        vm.refreshLearningProgress = function () {
            var progressByTestId = {};
            var userId = String(vm.currentUser.id || '');
            var prefix = 'ieltsReadingInProgress:' + userId;
            try {
                for (var storageIndex = 0; storageIndex < $window.localStorage.length; storageIndex++) {
                    var storageKey = $window.localStorage.key(storageIndex);
                    if (!storageKey || (storageKey !== prefix && storageKey.indexOf(prefix + ':') !== 0)) {
                        continue;
                    }
                    var draft = JSON.parse($window.localStorage.getItem(storageKey));
                    if (!draft || !draft.testId || String(draft.userId) !== userId || draft.sessionMode !== 'STUDY') {
                        continue;
                    }
                    var isListeningDraft = draft.isListening === true || draft.testMode === 'LISTENING';
                    if (isListeningDraft !== vm.isListeningMode) {
                        continue;
                    }
                    var mapKey = String(draft.testId);
                    var savedAt = new Date(draft.savedAt || 0).getTime() || 0;
                    if (!progressByTestId[mapKey] || savedAt > progressByTestId[mapKey].savedAtValue) {
                        draft.savedAtValue = savedAt;
                        progressByTestId[mapKey] = draft;
                    }
                }
            } catch (ignoreLearningProgressStorageError) {
                progressByTestId = {};
            }
            vm.learningProgressByTestId = progressByTestId;
        };

        vm.getLearningProgress = function (testId) {
            return vm.learningProgressByTestId[String(testId)] || null;
        };

        vm.formatLearningDuration = function (seconds) {
            var totalMinutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
            if (totalMinutes < 60) { return totalMinutes + ' phút'; }
            return Math.floor(totalMinutes / 60) + ' giờ ' + (totalMinutes % 60) + ' phút';
        };

        vm.testCatalogUrl = function (item) {
            var route = vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/';
            return route + item.id + (vm.getLearningProgress(item.id) ? '?sessionMode=STUDY' : '');
        };

        function refreshLearningProgressOnFocus() {
            $scope.$evalAsync(vm.refreshLearningProgress);
        }

        $window.addEventListener('focus', refreshLearningProgressOnFocus);
        $window.addEventListener('storage', refreshLearningProgressOnFocus);
        $scope.$on('$destroy', function () {
            $window.removeEventListener('focus', refreshLearningProgressOnFocus);
            $window.removeEventListener('storage', refreshLearningProgressOnFocus);
        });
        vm.refreshLearningProgress();

        vm.ieltsReadingTest = {
            questionType: {
                code: 'IELTSRT',
                id: 11,
                name: 'IELTS ' + vm.testModeName + ' Test',
                textSearch: null
            },
            type: 0,
            status: 1,
            questionTopics: [],
            countWords: 0,
            ordinalNumber: 1,
            subQuestions: [],
            userId: vm.currentUser.id
        };  //create a new test

        vm.getPageCreateIELTSReadingTest = function () {
            vm.searchDto.questionType = {id: 11};
            vm.searchDto.listeningTest = vm.isListeningMode;
            blockUI.start();
            service.getPageForTests(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.ieltsReadingTests = data.content;
                vm.refreshLearningProgress();
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsReadingTests;
                vm.bsTableControlCreateIELTSReadingTest.options.totalRows = data.totalElements;
                // x.focus();
                console.log(vm.ieltsReadingTests);

            });
        };

        vm.searchDto.pageSize = 12;
        vm.showHiddenTests = false;
        if(settings.isAdmin){
            // 9 is a search-only status: show drafts and published tests, excluding hidden tests.
            vm.searchDto.status = 9;
            vm.getPageCreateIELTSReadingTest();
            console.log('admin');
        }else{
            vm.searchDto.status = 7;
            vm.getPageCreateIELTSReadingTest();
            console.log('view');
        }


        $scope.pageChanged = function() {
            // $log.log('Page changed to: ' + $scope.currentPage);
            vm.getPageCreateIELTSReadingTest();
        };

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

        vm.getQuestionTypes = function () {
            service.getQuestionTypes(vm.searchDtoAnswer,vm.pageIndexAnswer, vm.pageSizeAnswer).then(function (data) {
                vm.questionTypes = data.content;
                vm.question.questionType = vm.questionTypes[0];

            });
        };
        
        //--------------------- Create Reading test -------------------------//
        vm.ieltsReadingTests = [];
        var example = '<p class="bold"><strong>Question ?  to ? ' + '</strong></p><p>Choose <strong>TRUE&nbsp;</strong>if the statement agrees with the information in the text, choose <strong>FALSE</strong> if the statement disagrees with the information in the text, or choose <strong>NOT GIVEN</strong> if there is no information on this</p>';

        // vm.readingQuestionTypes = [
        //     {
        //         id: 1,
        //         name: 'A, B, C, D, E, F, G...'
        //     },
        //     {
        //         id: 2,
        //         name: 'T/F/NG'
        //     },
        //     {
        //         id: 3,
        //         name: 'Y/N/NG'
        //     }
        // ];
        // vm.readingQuestionType = null;

        vm.ieltsReadingTest = {
            questionType : {
                code: 'IELTSRT',
                id: 11,
                name: vm.isListeningMode ? 'IELTS Listening Test' : 'IELTS Reading Test',
                textSearch: null
            },
            status : 6,
            questionTopics: [],
            countWords : 0,
            ordinalNumber: 1,
            userId: vm.currentUser.id,
            subQuestions : [
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP1',
                        id: 13,
                        name: 'IELTS Reading Test Passage 1'
                    },
                    ordinalNumber: 1,
                    subQuestions: [
                    //     {
                    //         question: example,
                    //         questionType : {
                    //             code: 'IELTSRTPK',
                    //             id: 18,
                    //             name: 'IELTS Reading Test Package',
                    //             textSearch: null
                    //         },
                    //         subQuestions : [],
                    //         ordinalNumber: 1
                    //     }
                    ]
                },
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP2',
                        id: 14,
                        name: 'IELTS Reading Test Passage 2'
                    },
                    ordinalNumber: 2,
                    subQuestions: [
                        // {
                        //     question: example,
                        //     questionType : {
                        //         code: 'IELTSRTPK',
                        //         id: 18,
                        //         name: 'IELTS Reading Test Package',
                        //         textSearch: null
                        //     },
                        //     subQuestions : [],
                        //     ordinalNumber: 1
                        // }
                    ]
                },
                {
                    question: '',
                    questionType : {
                        code: 'IELTSRTP3',
                        id: 15,
                        name: 'IELTS Reading Test Passage 3'
                    },
                    ordinalNumber: 3,
                    subQuestions: [
                        // {
                        //     question: example,
                        //     questionType : {
                        //         code: 'IELTSRTPK',
                        //         id: 18,
                        //         name: 'IELTS Reading Test Package',
                        //         textSearch: null
                        //     },
                        //     subQuestions : [],
                        //     ordinalNumber: 1
                        // }
                    ]
                }
            ]
        };  //create a new test
        vm.createPassageNumber = 1;

        vm.saveReadingTest = function (saveMode) {
            blockUI.start();
            return service.saveObject(vm.ieltsReadingTest).then(function (data) {
                blockUI.stop();
                vm.ieltsReadingTest = data;
                vm.getOrdinalNumber(data);
                isHavingQuestions(vm.ieltsReadingTest);

                if(vm.createPassageNumber == 1){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }
                if(vm.createPassageNumber == 2){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage2 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 3){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage3 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }







                vm.refreshBuilderValidation();
                vm.getPageCreateIELTSReadingTest();
                var saveMessage = saveMode === 'publish' ? 'Đã kiểm tra và xuất bản bài ' + vm.testModeName + '.' :
                    (saveMode === 'preview' ? 'Đã lưu dữ liệu để mở bản xem trước.' : 'Đã lưu bản nháp.');
                toastr.success(saveMessage, 'Thông báo');
                return data;
            }, function failure() {
                blockUI.stop();
                toastr.error('Không thể lưu bài ' + vm.testModeName + '. Vui lòng thử lại.', 'Thông báo');
            });
        };

        var readingPartRules = [
            {name: 'Part 1', start: 1, end: 13},
            {name: 'Part 2', start: 14, end: 26},
            {name: 'Part 3', start: 27, end: 40}
        ];

        vm.builderSteps = [
            {number: 1, title: 'Thông tin bài thi', target: 'reading-builder-info'},
            {number: 2, title: 'Part 1', target: 'reading-builder-part-1'},
            {number: 3, title: 'Part 2', target: 'reading-builder-part-2'},
            {number: 4, title: 'Part 3', target: 'reading-builder-part-3'},
            {number: 5, title: 'Kiểm tra & xuất bản', target: 'reading-builder-review'}
        ];

        function plainText(value) {
            return (value || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;|&#160;/gi, ' ')
                .replace(/&[a-z0-9#]+;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        vm.countOneEditorGaps = function (content) {
            var matches = String(content || '').match(/\}\{SPACE\}\{/gi);
            return matches ? matches.length : 0;
        };

        function ensureOneEditorPackage(questionPackage) {
            if (!questionPackage || Number(questionPackage.type) !== 11) {
                return;
            }
            questionPackage.subQuestions = questionPackage.subQuestions || [];
            questionPackage.subQuestions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            angular.forEach(questionPackage.subQuestions || [], function (question, questionIndex) {
                question.questionAnswers = question.questionAnswers || [];
                if (!question.questionAnswers.length) {
                    question.questionAnswers.push({
                        answer: {answer: ''},
                        question: {},
                        ordinalNumberQuestionAnswer: 1,
                        correct: true
                    });
                }
                question.questionAnswers.sort(function (left, right) {
                    return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
                });
                angular.forEach(question.questionAnswers, function (answer, answerIndex) {
                    answer.answer = answer.answer || {answer: ''};
                    answer.ordinalNumberQuestionAnswer = answerIndex + 1;
                    answer.correct = true;
                });
                if (questionIndex > 0 && /^Question number\s*\d*$/i.test(plainText(question.question))) {
                    question.question = '';
                }
            });
            if (questionPackage.subQuestions && questionPackage.subQuestions.length) {
                var firstQuestion = questionPackage.subQuestions[0];
                if (/^Question number\s*\d*$/i.test(plainText(firstQuestion.question))) {
                    firstQuestion.question = '';
                }
            }
        }

        function ensureCompleteListPackage(questionPackage) {
            if (!questionPackage || Number(questionPackage.type) !== 13) {
                return;
            }
            questionPackage.subQuestions = questionPackage.subQuestions || [];
            questionPackage.subQuestions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            if (!questionPackage.subQuestions.length) {
                return;
            }

            var firstCompleteListQuestion = questionPackage.subQuestions[0];
            firstCompleteListQuestion.questionAnswers = firstCompleteListQuestion.questionAnswers || [];
            firstCompleteListQuestion.questionAnswers.sort(function (left, right) {
                return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
            });
            var sourceAnswers = firstCompleteListQuestion.questionAnswers;
            angular.forEach(questionPackage.subQuestions, function (question, questionIndex) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.sort(function (left, right) {
                    return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
                });
                while (question.questionAnswers.length < sourceAnswers.length) {
                    question.questionAnswers.push(angular.copy(sourceAnswers[question.questionAnswers.length]));
                }
                if (question.questionAnswers.length > sourceAnswers.length) {
                    question.questionAnswers = question.questionAnswers.slice(0, sourceAnswers.length);
                }
                angular.forEach(question.questionAnswers, function (answer, answerIndex) {
                    answer.answer = answer.answer || {answer: ''};
                    if (questionIndex > 0 && sourceAnswers[answerIndex] && sourceAnswers[answerIndex].answer) {
                        answer.answer.answer = sourceAnswers[answerIndex].answer.answer;
                    }
                    answer.ordinalNumberQuestionAnswer = answerIndex + 1;
                    answer.correct = answerIndex === questionIndex;
                });
                if (questionIndex > 0 && /^Question number\s*\d*$/i.test(plainText(question.question))) {
                    question.question = '';
                }
            });
            var firstQuestion = questionPackage.subQuestions[0];
            if (/^Question number\s*\d*$/i.test(plainText(firstQuestion.question))) {
                firstQuestion.question = '';
            }
        }

        function isSharedChoicePackage(questionPackage) {
            var type = Number(questionPackage && questionPackage.type);
            return type === 4 || type === 10 || type === 14;
        }

        function ensureSharedChoicePackage(questionPackage) {
            if (!isSharedChoicePackage(questionPackage)) {
                return;
            }
            questionPackage.subQuestions = questionPackage.subQuestions || [];
            questionPackage.subQuestions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            if (!questionPackage.subQuestions.length) {
                return;
            }

            var firstQuestion = questionPackage.subQuestions[0];
            firstQuestion.questionAnswers = firstQuestion.questionAnswers || [];
            firstQuestion.questionAnswers.sort(function (left, right) {
                return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
            });
            var sourceAnswers = firstQuestion.questionAnswers;

            angular.forEach(questionPackage.subQuestions, function (question, questionIndex) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.sort(function (left, right) {
                    return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
                });
                while (question.questionAnswers.length < sourceAnswers.length) {
                    question.questionAnswers.push(angular.copy(sourceAnswers[question.questionAnswers.length]));
                }
                if (question.questionAnswers.length > sourceAnswers.length) {
                    question.questionAnswers = question.questionAnswers.slice(0, sourceAnswers.length);
                }
                angular.forEach(question.questionAnswers, function (answer, answerIndex) {
                    answer.answer = answer.answer || {answer: ''};
                    answer.ordinalNumberQuestionAnswer = answerIndex + 1;
                    if (questionIndex > 0 && sourceAnswers[answerIndex] && sourceAnswers[answerIndex].answer) {
                        answer.answer.answer = sourceAnswers[answerIndex].answer.answer;
                    }
                });
            });
        }

        vm.sharedChoiceTitle = function (type) {
            type = Number(type);
            if (type === 4) {
                return 'List of Headings';
            }
            if (type === 14) {
                return 'List of Endings';
            }
            return 'List of Researchers';
        };

        vm.sharedChoiceLabel = function (type, index) {
            if (Number(type) === 4) {
                var roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
                return roman[index] || String(index + 1);
            }
            return vm.matchingOptionLabel(index);
        };

        vm.sharedChoiceHelp = function (type) {
            type = Number(type);
            if (type === 4) {
                return 'Nhập toàn bộ heading một lần tại đây theo thứ tự i, ii, iii… Hệ thống dùng chung danh sách này cho cả nhóm câu.';
            }
            if (type === 14) {
                return 'Nhập các phần kết thúc A, B, C… một lần tại đây. Học sinh sẽ kéo từng lựa chọn vào ô trống sau câu.';
            }
            return 'Nhập tên một lần tại đây. Hệ thống hiển thị A, B, C… trên đầu bảng và danh sách tên ở dưới bảng.';
        };

        vm.sharedChoicePlaceholder = function (type, index) {
            if (Number(type) === 4) {
                return 'Heading ' + (index + 1);
            }
            if (Number(type) === 14) {
                return 'Nội dung ending ' + vm.matchingOptionLabel(index);
            }
            return 'Tên người hoặc nhóm nghiên cứu ' + vm.matchingOptionLabel(index);
        };

        vm.updateSharedChoice = function (questionPackage, sourceAnswer) {
            if (!questionPackage || !sourceAnswer) {
                return;
            }
            ensureSharedChoicePackage(questionPackage);
            var ordinal = parseInt(sourceAnswer.ordinalNumberQuestionAnswer, 10);
            angular.forEach(questionPackage.subQuestions || [], function (question, questionIndex) {
                if (questionIndex === 0) {
                    return;
                }
                angular.forEach(question.questionAnswers || [], function (answer) {
                    if (parseInt(answer.ordinalNumberQuestionAnswer, 10) === ordinal) {
                        answer.answer = answer.answer || {};
                        answer.answer.answer = sourceAnswer.answer ? sourceAnswer.answer.answer : '';
                    }
                });
            });
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.addSharedChoiceAnswer = function (questionPackage) {
            if (!isSharedChoicePackage(questionPackage) || !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            ensureSharedChoicePackage(questionPackage);
            var answerIndex = questionPackage.subQuestions[0].questionAnswers.length;
            angular.forEach(questionPackage.subQuestions, function (question) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.push({
                    answer: {answer: ''},
                    question: question.id ? {id: question.id} : {},
                    ordinalNumberQuestionAnswer: answerIndex + 1,
                    correct: false
                });
            });
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.removeSharedChoiceAnswer = function (questionPackage, answerIndex) {
            if (!isSharedChoicePackage(questionPackage) || !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            if ((questionPackage.subQuestions[0].questionAnswers || []).length <= 1) {
                toastr.warning('Danh sách lựa chọn phải còn ít nhất 1 đáp án.', 'Không thể xóa');
                return;
            }
            angular.forEach(questionPackage.subQuestions, function (question) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.splice(answerIndex, 1);
            });
            ensureSharedChoicePackage(questionPackage);
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.updateMatchingName = vm.updateSharedChoice;

        vm.updateCompleteListContent = function (questionPackage) {
            ensureCompleteListPackage(questionPackage);
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.updateCompleteListWord = function (questionPackage, answerIndex) {
            if (!questionPackage || !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            var source = questionPackage.subQuestions[0].questionAnswers[answerIndex];
            angular.forEach(questionPackage.subQuestions, function (question, questionIndex) {
                var target = question.questionAnswers && question.questionAnswers[answerIndex];
                if (target && source && source.answer) {
                    target.answer = target.answer || {};
                    target.answer.answer = source.answer.answer;
                    target.correct = answerIndex === questionIndex;
                }
            });
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.addCompleteListAnswer = function (questionPackage) {
            if (!questionPackage || Number(questionPackage.type) !== 13 ||
                !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            ensureCompleteListPackage(questionPackage);
            var answerIndex = questionPackage.subQuestions[0].questionAnswers.length;
            angular.forEach(questionPackage.subQuestions, function (question, questionIndex) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.push({
                    answer: {answer: ''},
                    question: question.id ? {id: question.id} : {},
                    ordinalNumberQuestionAnswer: answerIndex + 1,
                    correct: answerIndex === questionIndex
                });
            });
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.removeCompleteListAnswer = function (questionPackage, answerIndex) {
            if (!questionPackage || Number(questionPackage.type) !== 13 ||
                !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            var minimumAnswers = questionPackage.subQuestions.length;
            var currentAnswers = questionPackage.subQuestions[0].questionAnswers || [];
            if (currentAnswers.length <= minimumAnswers) {
                toastr.warning('Nhóm ' + minimumAnswers + ' câu phải có ít nhất ' + minimumAnswers + ' đáp án đúng.', 'Không thể xóa');
                return;
            }
            angular.forEach(questionPackage.subQuestions, function (question) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.splice(answerIndex, 1);
            });
            ensureCompleteListPackage(questionPackage);
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.addReadingQuestionAnswer = function (question, questionType) {
            if (!question) {
                return;
            }
            question.questionAnswers = question.questionAnswers || [];
            question.questionAnswers.push({
                answer: {answer: ''},
                question: question.id ? {id: question.id} : {},
                ordinalNumberQuestionAnswer: question.questionAnswers.length + 1,
                correct: Number(questionType) === 2 || Number(questionType) === 3 || Number(questionType) === 11
            });
            vm.changeInTheProcessOfCreatingReadingTest();
        };

        vm.removeReadingQuestionAnswer = function (question, answerIndex) {
            if (!question) {
                return;
            }
            question.questionAnswers = question.questionAnswers || [];
            if (question.questionAnswers.length <= 1) {
                toastr.warning('Mỗi câu phải còn ít nhất 1 đáp án.', 'Không thể xóa');
                return;
            }
            question.questionAnswers.splice(answerIndex, 1);
            angular.forEach(question.questionAnswers, function (answer, index) {
                answer.ordinalNumberQuestionAnswer = index + 1;
            });
            vm.changeInTheProcessOfCreatingReadingTest();
        };

        vm.onReadingPackageTypeChange = function (questionPackage, partIndex, packageIndex) {
            if (questionPackage && Number(questionPackage.type) === 11) {
                vm.numberOfAnswers = 1;
                vm.tempAnswers = [{
                    answer: {answer: ''},
                    question: {},
                    ordinalNumberQuestionAnswer: 1,
                    correct: true,
                    packageNumber: packageIndex
                }];
                ensureOneEditorPackage(questionPackage);
            }
            if (questionPackage && Number(questionPackage.type) === 13) {
                ensureCompleteListPackage(questionPackage);
            }
            if (isSharedChoicePackage(questionPackage)) {
                ensureSharedChoicePackage(questionPackage);
            }
            if (questionPackage && Number(questionPackage.type) === 4 && vm.ieltsReadingTest.subQuestions[partIndex]) {
                vm.ieltsReadingTest.subQuestions[partIndex].type = 4;
            }
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.updateOneEditorContent = function (questionPackage) {
            ensureOneEditorPackage(questionPackage);
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.appendOneEditorGap = function (questionPackage) {
            ensureOneEditorPackage(questionPackage);
            if (!questionPackage || !questionPackage.subQuestions || !questionPackage.subQuestions.length) {
                return;
            }
            var firstQuestion = questionPackage.subQuestions[0];
            var content = String(firstQuestion.question || '');
            firstQuestion.question = content + (content ? ' ' : '') + '}{SPACE}{';
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        function getPartQuestions(partIndex) {
            var test = vm.ieltsReadingTest || {};
            var passage = (test.subQuestions || [])[partIndex];
            var result = [];
            angular.forEach((passage && passage.subQuestions) || [], function (questionPackage, packageIndex) {
                angular.forEach(questionPackage.subQuestions || [], function (question) {
                    result.push({question: question, questionPackage: questionPackage, packageIndex: packageIndex});
                });
            });
            return result;
        }

        function buildReadingTestValidation() {
            var test = vm.ieltsReadingTest || {};
            var result = {
                valid: true,
                issues: [],
                totalQuestions: 0,
                percent: 0,
                parts: []
            };

            function addIssue(message, target, partIndex) {
                result.issues.push({message: message, target: target, partIndex: partIndex});
            }

            if (!plainText(test.title)) {
                addIssue('Chưa nhập tên bài thi.', 'reading-builder-info');
            }
            if (vm.isListeningMode && !plainText(test.pronounce)) {
                addIssue('Bài Listening chưa có link audio chính.', 'reading-builder-info');
            }

            angular.forEach(readingPartRules, function (rule, partIndex) {
                var passage = (test.subQuestions || [])[partIndex] || {};
                var packages = passage.subQuestions || [];
                var questionEntries = getPartQuestions(partIndex);
                var numberMap = {};
                var missing = [];
                var partIssueStart = result.issues.length;
                var matchingHeadingQuestionCount = 0;

                result.totalQuestions += questionEntries.length;

                if (!plainText(passage.question)) {
                    addIssue(rule.name + ': chưa nhập nội dung bài đọc.', 'reading-builder-part-' + (partIndex + 1), partIndex);
                }
                if (!passage.type) {
                    addIssue(rule.name + ': chưa chọn dạng hiển thị bài đọc.', 'reading-builder-part-' + (partIndex + 1), partIndex);
                }
                if (!packages.length) {
                    addIssue(rule.name + ': chưa có nhóm câu hỏi.', 'reading-builder-part-' + (partIndex + 1), partIndex);
                }

                angular.forEach(packages, function (questionPackage, packageIndex) {
                    var packageTarget = 'reading-builder-part-' + (partIndex + 1);
                    if (!questionPackage.type) {
                        addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': chưa chọn dạng câu hỏi.', packageTarget, partIndex);
                    }
                    var instruction = plainText(questionPackage.question);
                    if (!instruction || /Question\s*\?\s*to\s*\?/i.test(instruction)) {
                        addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': hướng dẫn vẫn đang để mẫu.', packageTarget, partIndex);
                    }
                    if (!(questionPackage.subQuestions || []).length) {
                        addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': chưa tạo câu hỏi.', packageTarget, partIndex);
                    }
                    if (Number(questionPackage.type) === 4) {
                        matchingHeadingQuestionCount += (questionPackage.subQuestions || []).length;
                    }
                    if (Number(questionPackage.type) === 11 && (questionPackage.subQuestions || []).length) {
                        var oneEditorContent = questionPackage.subQuestions[0].question;
                        var gapCount = vm.countOneEditorGaps(oneEditorContent);
                        var expectedGapCount = questionPackage.subQuestions.length;
                        if (!plainText(oneEditorContent)) {
                            addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': chưa nhập nội dung vào editor chung.', packageTarget, partIndex);
                        } else if (gapCount !== expectedGapCount) {
                            addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': có ' + gapCount + ' ô điền từ nhưng cần đúng ' + expectedGapCount + ' ô.', packageTarget, partIndex);
                        }
                    }
                    if (Number(questionPackage.type) === 13 && (questionPackage.subQuestions || []).length) {
                        var completeListContent = questionPackage.subQuestions[0].question;
                        var completeListGapCount = vm.countOneEditorGaps(completeListContent);
                        var completeListQuestionCount = questionPackage.subQuestions.length;
                        var completeListAnswerCount = (questionPackage.subQuestions[0].questionAnswers || []).length;
                        if (!plainText(completeListContent)) {
                            addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': chưa nhập nội dung Complete List of Words.', packageTarget, partIndex);
                        } else if (completeListGapCount !== completeListQuestionCount) {
                            addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': có ' + completeListGapCount + ' ô kéo-thả nhưng cần đúng ' + completeListQuestionCount + ' ô.', packageTarget, partIndex);
                        }
                        if (completeListAnswerCount < completeListQuestionCount) {
                            addIssue(rule.name + ', nhóm ' + (packageIndex + 1) + ': danh sách từ phải có ít nhất ' + completeListQuestionCount + ' từ.', packageTarget, partIndex);
                        }
                    }
                });

                if (matchingHeadingQuestionCount > 0) {
                    var headingPlaceholderCount = countHeadingPlaceholders(passage.question);
                    if (headingPlaceholderCount !== matchingHeadingQuestionCount) {
                        addIssue(rule.name + ': Matching Heading có ' + headingPlaceholderCount +
                            ' vị trí }{HEADING}{ nhưng cần đúng ' + matchingHeadingQuestionCount +
                            ' vị trí, đặt ngay sau nhãn Section A, B, C...',
                            'reading-builder-part-' + (partIndex + 1), partIndex);
                    }
                }

                angular.forEach(questionEntries, function (entry) {
                    var question = entry.question || {};
                    var number = parseInt(question.ordinalNumber, 10);
                    var questionTarget = 'reading-builder-part-' + (partIndex + 1);
                    if (!number || number < rule.start || number > rule.end) {
                        addIssue(rule.name + ': có số câu ngoài khoảng ' + rule.start + '–' + rule.end + '.', questionTarget, partIndex);
                    } else if (numberMap[number]) {
                        addIssue(rule.name + ': câu ' + number + ' bị trùng.', questionTarget, partIndex);
                    } else {
                        numberMap[number] = true;
                    }

                    var questionText = plainText(question.question);
                    if (Number(entry.questionPackage.type) !== 11 && Number(entry.questionPackage.type) !== 13 && (!questionText || /^Question number\s*\d*$/i.test(questionText))) {
                        addIssue('Câu ' + (number || '?') + ': chưa nhập nội dung câu hỏi.', questionTarget, partIndex);
                    }

                    var answers = question.questionAnswers || [];
                    if (!answers.length) {
                        addIssue('Câu ' + (number || '?') + ': chưa có đáp án.', questionTarget, partIndex);
                    } else {
                        var hasBlankAnswer = false;
                        var correctAnswerCount = 0;
                        angular.forEach(answers, function (answer) {
                            var answerText = answer && answer.answer ? plainText(answer.answer.answer) : '';
                            hasBlankAnswer = hasBlankAnswer || !answerText || answerText.toLowerCase() === 'hihi';
                            if (answer.correct === true) {
                                correctAnswerCount++;
                            }
                        });
                        if (hasBlankAnswer) {
                            addIssue('Câu ' + (number || '?') + ': còn đáp án để trống.', questionTarget, partIndex);
                        }
                        if (correctAnswerCount === 0) {
                            addIssue('Câu ' + (number || '?') + ': chưa đánh dấu đáp án đúng.', questionTarget, partIndex);
                        } else if ((Number(entry.questionPackage.type) === 5 || Number(entry.questionPackage.type) === 7) && correctAnswerCount < 2) {
                            addIssue('Câu ' + (number || '?') + ': dạng nhiều đáp án cần đánh dấu ít nhất 2 đáp án đúng.', questionTarget, partIndex);
                        } else if (Number(entry.questionPackage.type) !== 2 && Number(entry.questionPackage.type) !== 3 &&
                            Number(entry.questionPackage.type) !== 5 && Number(entry.questionPackage.type) !== 7 &&
                            Number(entry.questionPackage.type) !== 11 && correctAnswerCount > 1) {
                            addIssue('Câu ' + (number || '?') + ': dạng này chỉ nên có 1 đáp án đúng.', questionTarget, partIndex);
                        }
                    }
                });

                for (var number = rule.start; number <= rule.end; number++) {
                    if (!numberMap[number]) {
                        missing.push(number);
                    }
                }
                if (missing.length) {
                    addIssue(rule.name + ': thiếu câu ' + missing.join(', ') + '.', 'reading-builder-part-' + (partIndex + 1), partIndex);
                }

                result.parts.push({
                    name: rule.name,
                    count: questionEntries.length,
                    expected: rule.end - rule.start + 1,
                    missing: missing,
                    issueCount: result.issues.length - partIssueStart
                });
            });

            result.valid = result.issues.length === 0 && result.totalQuestions === 40;
            var completedChecks = Math.max(0, 5 - Math.min(5, result.issues.length));
            result.percent = Math.min(100, Math.round(((result.totalQuestions / 40) * 80) + ((completedChecks / 5) * 20)));
            return result;
        }

        vm.refreshBuilderValidation = function () {
            vm.builderValidation = buildReadingTestValidation();
            return vm.builderValidation;
        };

        vm.goToBuilderTarget = function (target) {
            var element = document.getElementById(target);
            if (!element) {
                return;
            }
            element.scrollIntoView({behavior: 'smooth', block: 'start'});
            angular.element(element).addClass('reading-builder-focus');
            $timeout(function () {
                angular.element(element).removeClass('reading-builder-focus');
            }, 1400);
        };

        vm.goToBuilderStep = function (stepIndex) {
            if (stepIndex === 4) {
                vm.openBuilderReviewModal();
                return;
            }
            if (stepIndex === 2 && vm.createPassageNumber < 2) {
                vm.createPassageNumber = 2;
            }
            if (stepIndex >= 3) {
                vm.createPassageNumber = 3;
            }
            $timeout(function () {
                vm.goToBuilderTarget(vm.builderSteps[stepIndex].target);
            });
        };

        vm.continueBuilder = function () {
            var validation = vm.refreshBuilderValidation();
            if (validation.issues.length) {
                vm.goToBuilderTarget(validation.issues[0].target);
            } else {
                vm.openBuilderReviewModal();
            }
        };

        vm.openBuilderReviewModal = function () {
            vm.refreshBuilderValidation();
            vm.showBuilderReview = true;
        };

        vm.closeBuilderReviewModal = function () {
            vm.showBuilderReview = false;
        };

        vm.toggleBuilderReview = function () {
            if (vm.showBuilderReview) {
                vm.closeBuilderReviewModal();
            } else {
                vm.openBuilderReviewModal();
            }
        };

        vm.openBuilderIssue = function (issue) {
            if (!issue || !issue.target) { return; }
            vm.closeBuilderReviewModal();
            $timeout(function () {
                vm.goToBuilderTarget(issue.target);
            }, 120);
        };

        vm.saveDraftReadingTest = function () {
            vm.ieltsReadingTest.status = 6;
            vm.refreshBuilderValidation();
            return vm.saveReadingTest('draft');
        };

        function clearOldReadingPreviews() {
            var previewPrefix = 'ieltsReadingPreview-';
            var keysToRemove = [];
            try {
                for (var storageIndex = 0; storageIndex < $window.localStorage.length; storageIndex++) {
                    var storageKey = $window.localStorage.key(storageIndex);
                    if (storageKey && storageKey.indexOf(previewPrefix) === 0) {
                        keysToRemove.push(storageKey);
                    }
                }
                angular.forEach(keysToRemove, function (storageKey) {
                    $window.localStorage.removeItem(storageKey);
                });
            } catch (ignorePreviewCleanupError) {
                // The following setItem call will show the useful error if storage is unavailable.
            }
        }

        vm.previewReadingTest = function (partIndex) {
            var targetPart = Math.max(1, Math.min(3, parseInt(partIndex, 10) || 1));
            var previewKey = 'ieltsReadingPreview-' + new Date().getTime();
            var previewStorage = 'local';
            var previewJson;
            clearOldReadingPreviews();
            try {
                previewJson = angular.toJson(vm.ieltsReadingTest);
                $window.localStorage.setItem(previewKey, previewJson);
            } catch (previewStorageError) {
                try {
                    previewStorage = 'session';
                    $window.sessionStorage.setItem(previewKey, previewJson || angular.toJson(vm.ieltsReadingTest));
                } catch (sessionPreviewStorageError) {
                    toastr.error('Không thể tạo dữ liệu Preview trên trình duyệt này.', 'Không thể mở Preview');
                    return;
                }
            }
            var baseElement = document.getElementsByTagName('base')[0];
            var appBaseUrl = baseElement ? baseElement.href : ($window.location.protocol + '//' + $window.location.host + '/');
            var previewRoute = vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/';
            var previewUrl = appBaseUrl.replace(/\/?$/, '/') + previewRoute + 'preview-local' +
                '?preview=1&previewPart=' + targetPart + '&previewKey=' + encodeURIComponent(previewKey) +
                '&previewStorage=' + previewStorage;
            var previewWindow = $window.open(previewUrl, '_blank');
            if (!previewWindow) {
                (previewStorage === 'session' ? $window.sessionStorage : $window.localStorage).removeItem(previewKey);
                toastr.warning('Trình duyệt đang chặn cửa sổ xem trước. Vui lòng cho phép pop-up.', 'Không thể mở Preview');
            }
        };

        vm.publishReadingTest = function () {
            var validation = vm.refreshBuilderValidation();
            if (!validation.valid) {
                toastr.warning('Bài thi còn ' + validation.issues.length + ' mục cần hoàn thiện.', 'Chưa thể xuất bản');
                vm.openBuilderReviewModal();
                return;
            }
            vm.ieltsReadingTest.status = 7;
            return vm.saveReadingTest('publish');
        };

        vm.preparePart = function (partIndex) {
            var rule = readingPartRules[partIndex];
            var used = {};
            angular.forEach(getPartQuestions(partIndex), function (entry) {
                used[parseInt(entry.question.ordinalNumber, 10)] = true;
            });
            var next = rule.start;
            while (next <= rule.end && used[next]) {
                next++;
            }
            vm.fromQuestion = next <= rule.end ? next : rule.end;
            vm.toQuestion = vm.fromQuestion;
            vm.numberOfAnswers = vm.numberOfAnswers > 0 ? vm.numberOfAnswers : 4;
            vm.createPackage = true;
            vm.createPassageNumber = Math.max(vm.createPassageNumber, partIndex + 1);
        };

        function validateQuestionRange(partIndex) {
            var rule = readingPartRules[partIndex];
            var from = parseInt(vm.fromQuestion, 10);
            var to = parseInt(vm.toQuestion, 10);
            if (!from || !to || from > to) {
                toastr.warning('Số câu bắt đầu phải nhỏ hơn hoặc bằng số câu kết thúc.', 'Kiểm tra khoảng câu');
                return false;
            }
            if (from < rule.start || to > rule.end) {
                toastr.warning(rule.name + ' chỉ được dùng câu ' + rule.start + '–' + rule.end + '.', 'Sai khoảng câu');
                return false;
            }
            var used = {};
            angular.forEach(getPartQuestions(partIndex), function (entry) {
                used[parseInt(entry.question.ordinalNumber, 10)] = true;
            });
            for (var number = from; number <= to; number++) {
                if (used[number]) {
                    toastr.warning('Câu ' + number + ' đã tồn tại. Không thể tạo trùng số câu.', 'Trùng câu hỏi');
                    return false;
                }
            }
            if (parseInt(vm.numberOfAnswers, 10) <= 0) {
                toastr.warning('Mỗi câu phải có ít nhất 1 đáp án.', 'Kiểm tra đáp án');
                return false;
            }
            return true;
        }

        function isHavingQuestions (ieltsReadingTest) {
            var passages = ieltsReadingTest.subQuestions;

            if(passages != null){
                if(passages[2].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 3;
                } else if(passages[1].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 2;
                }else if(passages[0].subQuestions != null && passages.length > 0){
                    vm.createPassageNumber = 1;
                }
                // var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                for(var i = 0; i< passages.length; i++){
                    var packages = passages[i].subQuestions;
                    if(packages != null){
                        for(var j = 0; j < packages.length; j++){
                            var questions = packages[j].subQuestions;
                            ensureOneEditorPackage(packages[j]);
                            ensureCompleteListPackage(packages[j]);
                            ensureSharedChoicePackage(packages[j]);
                            if(questions != null && questions.length > 0){
                                packages[j].isHaveChildren = true;
                            } else {
                                packages[j].isHaveChildren = false;
                            }
                            console.log(packages[j].isHaveChildren);
                        }
                        
                    }
                }

            }
        }

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

        vm.getOrdinalNumberPassage3 = function (ieltsReadingTest){
            vm.highestOrdinalNumberPackageForPassage3 = 0;
            vm.highestOrdinalNumberQuestionForPassage3 = 0;
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage3 = getHighestOrdinalNumber(packagesForPassage3);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 3: ' + vm.highestOrdinalNumberPackageForPassage3);
                    if(packagesForPassage3 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[2].subQuestions.length; i++){
                            var questionsForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage3);

                            if(vm.highestOrdinalNumberQuestionForPassage3 < temp){
                                vm.highestOrdinalNumberQuestionForPassage3 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 3: ' + vm.highestOrdinalNumberQuestionForPassage3);
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

        };

        vm.getOrdinalNumberPassage2 = function (ieltsReadingTest){
            vm.highestOrdinalNumberPackageForPassage2 = 0;
            vm.highestOrdinalNumberQuestionForPassage2 = 0;
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage2 = getHighestOrdinalNumber(packagesForPassage2);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    console.log('highest orinal number packages for passage 2: ' + vm.highestOrdinalNumberPackageForPassage2);
                    if(packagesForPassage2 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[1].subQuestions.length; i++){
                            var questionsForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage2);

                            if(vm.highestOrdinalNumberQuestionForPassage2 < temp){
                                vm.highestOrdinalNumberQuestionForPassage2 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 2: ' + vm.highestOrdinalNumberQuestionForPassage2);
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
            vm.highestOrdinalNumberPackageForPassage1 = 0;
            vm.highestOrdinalNumberQuestionForPassage1 = 0;
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage1 = getHighestOrdinalNumber(packagesForPassage1);
                    console.log('highest orinal number packages for passage 1: ' + vm.highestOrdinalNumberPackageForPassage1);
                    if(packagesForPassage1 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[0].subQuestions.length; i++){
                            var questionsForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage1);
                            if(vm.highestOrdinalNumberQuestionForPassage1 < temp){
                                vm.highestOrdinalNumberQuestionForPassage1 = temp;
                            }
                        }
                        console.log('highest orinal number questions for passage 1: ' + vm.highestOrdinalNumberQuestionForPassage1);
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
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            // vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
            // vm.toQuestion = vm.fromQuestion + 1;
            // if(vm.fromQuestion > 0){
            //     vm.disableFromQuestion = true;
            // }
            // example = '<p class="bold"><strong>Question '+ vm.fromQuestion + ' to '+ vm.toQuestion + '</strong></p><p>Choose <strong>TRUE&nbsp;</strong>if the statement agrees with the information in the text, choose <strong>FALSE</strong> if the statement disagrees with the information in the text, or choose <strong>NOT GIVEN</strong> if there is no information on this</p>';
            vm.getOrdinalNumberPassage2(ieltsReadingTest);
        };

        $scope.editCreateIELTSReadingTest= function (id) {
            vm.createPackage = true;
            vm.isShowConfigureQuestion = false;

            // console.log(vm.ieltsReadingTest.subQuestions[0]);
            service.getOne(id).then(function (data) {
                vm.ieltsReadingTest = data;
                vm.getOrdinalNumber(data);

                isHavingQuestions(vm.ieltsReadingTest);

                if(vm.createPassageNumber == 1){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage1 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }
                if(vm.createPassageNumber == 2){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage2 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                if(vm.createPassageNumber == 3){
                    vm.fromQuestion = vm.highestOrdinalNumberQuestionForPassage3 + 1;
                    // vm.toQuestion = vm.fromQuestion + 1;
                    if(vm.fromQuestion > 0){
                        vm.disableFromQuestion = true;
                    }
                }

                vm.refreshBuilderValidation();
                console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        //the process of creating

        //passage 1
        vm.createPackage = false;
        vm.startCreateQuestionForPassage1 = function () {
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;
            if (!vm.ieltsReadingTest.subQuestions[0].subQuestions.length) {
                vm.addPackageForPassage1();
            }

            // vm.saveReadingTest();
        };

        //configure question answer
        vm.tempAnswers = [];
        vm.numberOfAnswers = 1;
        vm.fromQuestion = 1;
        vm.toQuestion = 0;
        vm.disableFromQuestion = false;

        vm.createTempAnswers = function (index) {
            if(vm.numberOfAnswers <= 0){
                toastr.warning('number of answers must be higher than 0.', 'Thông báo');
                // vm.toQuestion = vm.fromQuestion + 1;
                return;
            }

            console.log('for package: ' + (index+1));
            vm.tempAnswers = [];
            for(var i = 0; i < vm.numberOfAnswers; i++){
                var item = {
                    answer: {
                        answer:''
                    },
                    question: {},
                    ordinalNumberQuestionAnswer : 0,
                    correct: false,
                    i:i,
                    packageNumber: index
                };
                vm.tempAnswers.push(item);
            }
        };

        vm.validateFromToQuestion = function () {
            if(vm.fromQuestion > vm.toQuestion){
                toastr.warning('to Question must be higher than from Question.', 'Thông báo');
                // vm.toQuestion = vm.fromQuestion + 1;
                return;
            }
        };

        function validateCompleteListOptionCount(questionPackage) {
            if (!questionPackage || Number(questionPackage.type) !== 13) {
                return true;
            }
            var questionCount = (parseInt(vm.toQuestion, 10) - parseInt(vm.fromQuestion, 10)) + 1;
            var optionCount = parseInt(vm.numberOfAnswers, 10) || 0;
            if (optionCount < questionCount) {
                toastr.warning('Complete List of Words cần ít nhất ' + questionCount + ' từ: ' +
                    questionCount + ' đáp án đúng trước, sau đó mới đến các từ nhiễu.', 'Thiếu từ trong danh sách');
                return false;
            }
            return true;
        }

        vm.addQuestionForPassage1 = function (index) {
            if (!validateQuestionRange(0)) {
                return;
            }

            if (!validateCompleteListOptionCount(vm.ieltsReadingTest.subQuestions[0].subQuestions[index])) {
                return;
            }

            if (vm.tempAnswers.length !== parseInt(vm.numberOfAnswers, 10)) {
                vm.createTempAnswers(index);
            }

            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };
                item.question = item.question +  i;
                item.ordinalNumber = i;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(angular.copy(vm.tempAnswers[j]));
                }

                // item.questionAnswers = tempAnswers;
            }
            ensureOneEditorPackage(vm.ieltsReadingTest.subQuestions[0].subQuestions[index]);
            ensureCompleteListPackage(vm.ieltsReadingTest.subQuestions[0].subQuestions[index]);
            ensureSharedChoicePackage(vm.ieltsReadingTest.subQuestions[0].subQuestions[index]);
            vm.ieltsReadingTest.subQuestions[0].subQuestions[index].isHaveChildren = true;
            vm.getOrdinalNumber(vm.ieltsReadingTest);
            vm.refreshBuilderValidation();




            //
            // var item = {
            //     question: 'Question number ',
            //     questionType : {
            //         code: 'IELTSRTQ',
            //         id: 19,
            //         name: 'IELTS Reading Test Question'
            //     },
            //     ordinalNumber: 0,
            //     subQuestions: [],
            //     questionAnswers: []
            // };
            // item.question = item.question +  (vm.highestOrdinalNumberQuestionForPassage1 + 1);
            // item.ordinalNumber = vm.highestOrdinalNumberQuestionForPassage1 + 1;
            // // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;
            //
            // if(vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions == null){
            //     vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
            //
            // item.questionAnswers = tempAnswers;
            //
            //
            // vm.saveReadingTest();
        };
        


        vm.addAnswerForQuestionForPassage1 = function(index,items,type){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            item.question.id = vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[0].subQuestions[vm.highestOrdinalNumberPackageForPassage1 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            // vm.saveReadingTest();
        };

        vm.addPackageForPassage1 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: [],
                isHaveChildren: false
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = getHighestOrdinalNumber(vm.ieltsReadingTest.subQuestions[0].subQuestions) + 1;

            if(vm.ieltsReadingTest.subQuestions[0].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[0].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[0].subQuestions.push(item);
            vm.preparePart(0);
            vm.refreshBuilderValidation();

            // vm.saveReadingTest();

        };

        // vm.isStartCreatePassage2 = false;
        vm.startCreatePassage2 = function () {
            // vm.isStartCreatePassage2 = true;
            vm.createPassageNumber = 2;
            vm.createPackage = true;
            if (!vm.ieltsReadingTest.subQuestions[1].subQuestions.length) {
                vm.addPackageForPassage2();
            }
        };

        //passage 2
        vm.createPackagePassage2 = false;

        vm.startCreateQuestionForPassage2 = function () {
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            // vm.saveReadingTest();
        };


        // vm.numberFrom = 0;
        // vm.numberTo= 0;

        vm.addQuestionForPassage2 = function (index) {
            if (!validateQuestionRange(1)) {
                return;
            }
            if (!validateCompleteListOptionCount(vm.ieltsReadingTest.subQuestions[1].subQuestions[index])) {
                return;
            }
            if (vm.tempAnswers.length !== parseInt(vm.numberOfAnswers, 10)) {
                vm.createTempAnswers(index);
            }
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };

                item.question = item.question + i;
                item.ordinalNumber = i;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(angular.copy(vm.tempAnswers[j]));
                }

                // item.questionAnswers = tempAnswers;
            }
            ensureOneEditorPackage(vm.ieltsReadingTest.subQuestions[1].subQuestions[index]);
            ensureCompleteListPackage(vm.ieltsReadingTest.subQuestions[1].subQuestions[index]);
            ensureSharedChoicePackage(vm.ieltsReadingTest.subQuestions[1].subQuestions[index]);
            vm.ieltsReadingTest.subQuestions[1].subQuestions[index].isHaveChildren = true;
            vm.getOrdinalNumber(vm.ieltsReadingTest);
            vm.refreshBuilderValidation();


            // var item = {
            //     question: 'Question number ',
            //     questionType : {
            //         code: 'IELTSRTQ',
            //         id: 19,
            //         name: 'IELTS Reading Test Question'
            //     },
            //     ordinalNumber: 0,
            //     subQuestions: [],
            //     questionAnswers: []
            // };
            // item.question = item.question +  (vm.highestOrdinalNumberQuestionForPassage2 + 1);
            // item.ordinalNumber = vm.highestOrdinalNumberQuestionForPassage2 + 1;
            // // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;
            //
            // if(vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions == null){
            //     vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions = [];//question
            // }
            //
            // vm.ieltsReadingTest.subQuestions[1].subQuestions[index].subQuestions.push(item);
            // // vm.ieltsReadingTest.subQuestions[0].subQuestions[index].subQuestions.push(item);
            // // console.log(a);
            //
            // vm.saveReadingTest();
        };

        vm.addAnswerForQuestionForPassage2 = function(index){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 - vm.highestOrdinalNumberPackageForPassage1;

            item.question.id = vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].id;
            // item.ordinalNumber =

            if(vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[1].subQuestions[vm.highestOrdinalNumberPackageForPassage2 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            // vm.saveReadingTest();
        };

        vm.addPackageForPassage2 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: [],
                isHaveChildren: false
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = getHighestOrdinalNumber(vm.ieltsReadingTest.subQuestions[1].subQuestions) + 1;

            if(vm.ieltsReadingTest.subQuestions[1].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[1].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[1].subQuestions.push(item);
            vm.preparePart(1);
            vm.refreshBuilderValidation();

            // vm.saveReadingTest();

        };

        vm.startCreatePassage3 = function () {
            vm.createPassageNumber = 3;
            vm.createPackage = true;
            if (!vm.ieltsReadingTest.subQuestions[2].subQuestions.length) {
                vm.addPackageForPassage3();
            }
        };

        //passage 3

        vm.startCreateQuestionForPassage3 = function () {
            if(vm.ieltsReadingTest.title == null || vm.ieltsReadingTest.title == ""){
                toastr.warning('Please fill in the title.', 'Thông báo');
                return;
            }
            vm.createPackage = true;

            // vm.saveReadingTest();
        };

        vm.addQuestionForPassage3 = function (index) {
            if (!validateQuestionRange(2)) {
                return;
            }
            if (!validateCompleteListOptionCount(vm.ieltsReadingTest.subQuestions[2].subQuestions[index])) {
                return;
            }
            if (vm.tempAnswers.length !== parseInt(vm.numberOfAnswers, 10)) {
                vm.createTempAnswers(index);
            }
            for(var i = vm.fromQuestion; i <= vm.toQuestion; i++){
                var item = {
                    question: 'Question number ',
                    questionType : {
                        code: 'IELTSRTQ',
                        id: 19,
                        name: 'IELTS Reading Test Question'
                    },
                    ordinalNumber: 0,
                    subQuestions: [],
                    questionAnswers: []
                };

                item.question = item.question + i;
                item.ordinalNumber = i;
                // vm.ordinalNumberForQuestion = vm.ordinalNumberForQuestion + 1;

                if(vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions == null){
                    vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions = [];//question
                }

                vm.ieltsReadingTest.subQuestions[2].subQuestions[index].subQuestions.push(item);

                for(var  j = 0; j < vm.tempAnswers.length; j++){
                    vm.tempAnswers[j].ordinalNumberQuestionAnswer = j + 1;
                    item.questionAnswers.push(angular.copy(vm.tempAnswers[j]));
                }

                // item.questionAnswers = tempAnswers;
            }
            ensureOneEditorPackage(vm.ieltsReadingTest.subQuestions[2].subQuestions[index]);
            ensureCompleteListPackage(vm.ieltsReadingTest.subQuestions[2].subQuestions[index]);
            ensureSharedChoicePackage(vm.ieltsReadingTest.subQuestions[2].subQuestions[index]);
            vm.ieltsReadingTest.subQuestions[2].subQuestions[index].isHaveChildren = true;
            vm.getOrdinalNumber(vm.ieltsReadingTest);
            vm.refreshBuilderValidation();
            
        };

        vm.addAnswerForQuestionForPassage3 = function(index){
            var item = {
                answer: {
                    answer:'hihi'
                },
                question: {},
                ordinalNumberQuestionAnswer : 0
            };

            vm.highestOrdinalNumberPackageForPassage3 = vm.highestOrdinalNumberPackageForPassage3 - vm.highestOrdinalNumberPackageForPassage2;

            item.question.id = vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].id;

            if(vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers == null){
                vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers = [];
            }
            var tempOrdinalNumber = 0;

            for(var i = 0; i< vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.length; i++){
                if(vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer > tempOrdinalNumber){
                    tempOrdinalNumber = vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers[i].ordinalNumberQuestionAnswer;
                }
            }
            item.ordinalNumberQuestionAnswer = tempOrdinalNumber + 1;

            vm.ieltsReadingTest.subQuestions[2].subQuestions[vm.highestOrdinalNumberPackageForPassage3 - 1].subQuestions[index].questionAnswers.push(item);
            console.log('ordinal number for answer: ' + item.ordinalNumberQuestionAnswer);

            // vm.saveReadingTest();
        };

        vm.addPackageForPassage3 = function () {
            vm.isShowConfigureQuestion = true;

            var item = {
                question: example,
                questionType : {
                    code: 'IELTSRTQ',
                    id: 18,
                    name: 'IELTS Reading Test Package'
                },
                ordinalNumber: 0,
                subQuestions: [],
                isHaveChildren: false
            };

            console.log(item.ordinalNumber);

            item.ordinalNumber = getHighestOrdinalNumber(vm.ieltsReadingTest.subQuestions[2].subQuestions) + 1;

            if(vm.ieltsReadingTest.subQuestions[2].subQuestions == null){
                vm.ieltsReadingTest.subQuestions[2].subQuestions = [];
            }

            vm.ieltsReadingTest.subQuestions[2].subQuestions.push(item);
            vm.preparePart(2);
            vm.refreshBuilderValidation();

            // vm.saveReadingTest();

        };

        var _timeoutReading;
        vm.changeInTheProcessOfCreatingReadingTest = function (q) {
            // console.log(q);
            // if(_timeoutReading){ //if there is already a timeout in process cancel it
            //     $timeout.cancel(_timeoutReading);
            // }
            // _timeoutReading = $timeout(function(){
            //     vm.saveReadingTest();
            //     _timeoutReading = null;
            // },10000);
            if (_timeoutReading) {
                $timeout.cancel(_timeoutReading);
            }
            _timeoutReading = $timeout(function () {
                vm.refreshBuilderValidation();
                _timeoutReading = null;
            }, 180);
        };


        $scope.tinymceOptionsToCreateQuestionForReadingTest = {
            height: 100,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            // selector: '#tiny-answer',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify | removeformat',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinymceOptionsToCreateQuestionForReadingTestPassage = {
            height: 1000,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'image'
            ],
            toolbar1: ' image | alignleft aligncenter alignright alignjustify | removeformat',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
        
            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        $scope.tinyConFigQuestion = {
            height: 200,
            theme: 'modern',
            plugins: [
                'autosave print preview fullpage searchreplace autolink directionality visualblocks visualchars fullscreen image link media template table charmap hr pagebreak nonbreaking anchor insertdatetime advlist lists textcolor wordcount imagetools  contextmenu colorpicker textpattern '
            ],
            toolbar1: 'insertReadingGap | table | bold underline italic | forecolor backcolor | removeformat | bullist numlist | alignleft aligncenter alignright alignjustify',
            setup: function (editor) {
                editor.addButton('insertReadingGap', {
                    text: 'Chèn ô điền từ',
                    icon: false,
                    tooltip: 'Chèn ký hiệu }{SPACE}{ tại vị trí con trỏ',
                    onclick: function () {
                        var bookmark = null;
                        try {
                            bookmark = editor.selection.getBookmark(2, true);
                        } catch (ignoreBookmarkError) {
                            bookmark = null;
                        }
                        editor.focus();
                        if (bookmark) {
                            try {
                                editor.selection.moveToBookmark(bookmark);
                            } catch (ignoreRestoreBookmarkError) {
                                // TinyMCE still inserts at its last valid caret when a saved bookmark is stale.
                            }
                        }
                        editor.undoManager.transact(function () {
                            editor.execCommand('mceInsertContent', false, '}{SPACE}{');
                        });
                        editor.nodeChanged();
                        editor.fire('input');
                        editor.fire('change');
                        editor.save();

                        // ui-tinymce can miss a toolbar-generated change on an editor
                        // loaded from an existing test. Push the content into ngModel
                        // explicitly so the gap counter and the saved payload update now.
                        var textarea = editor.getElement();
                        var ngModelController = textarea ? angular.element(textarea).controller('ngModel') : null;
                        var currentContent = editor.getContent();
                        $scope.$evalAsync(function () {
                            if (ngModelController) {
                                ngModelController.$setViewValue(currentContent);
                                ngModelController.$setTouched();
                                ngModelController.$setDirty();
                            }
                            vm.changeInTheProcessOfCreatingReadingTest();
                        });
                    }
                });
            },
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.bsTableControlCreateIELTSReadingTest = {
            options: {
                data: vm.ieltsReadingTests,
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
                columns: service.getTableDefinitionCreateIELTSReadingTest(
                    vm.isListeningMode ? 'ielts_listening_actual_test/' : 'ielts_reading_actual_test/'
                ),
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
                    vm.getPageCreateIELTSReadingTest();
                }
            }
        };

        $scope.deleteObject = function (id) {
            console.log(id);
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
                        $scope.editCreateIELTSReadingTest(vm.ieltsReadingTest.id);
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
                    });
                }
            }, function () {
            });
        };

        vm.removeReadingPackage = function (partIndex, packageIndex, item) {
            var passage = (vm.ieltsReadingTest.subQuestions || [])[partIndex];
            if (!passage || !passage.subQuestions) {
                return;
            }

            var removeFromForm = function () {
                passage.subQuestions.splice(packageIndex, 1);
                vm.getOrdinalNumber(vm.ieltsReadingTest);
                vm.refreshBuilderValidation();
            };

            if (!item || !item.id) {
                removeFromForm();
                return;
            }

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md'
            });
            modalInstance.result.then(function (confirm) {
                if (confirm !== 'yes') {
                    return;
                }
                service.deleteObject(item.id, function success() {
                    removeFromForm();
                    toastr.success('Đã xóa nhóm câu hỏi.', 'Thông báo');
                }, function failure() {
                    toastr.error('Không thể xóa nhóm câu hỏi.', 'Thông báo');
                });
            });
        };

        vm.enterSearchCode = function(keyboardEvent){
            // console.log(event.keyCode);
            keyboardEvent = keyboardEvent || $window.event;
            if(keyboardEvent && keyboardEvent.keyCode == 13){//Phím Enter
                vm.codeChange();
            }
        };

        vm.codeChange=function () {
            vm.searchDto.pageIndex = 1;
            vm.searchDto.findExactWord = false;
            vm.getPageCreateIELTSReadingTest();
        };

        vm.toggleHiddenTests = function () {
            vm.showHiddenTests = !vm.showHiddenTests;
            vm.searchDto.status = vm.showHiddenTests ? 8 : 9;
            vm.searchDto.pageIndex = 1;
            vm.getPageCreateIELTSReadingTest();
        };

        vm.catalogStatusUpdating = {};

        function findReadingTestCatalogRow(id) {
            var matched = null;
            angular.forEach(vm.ieltsReadingTests || [], function (item) {
                if (!matched && item && String(item.id) === String(id)) {
                    matched = item;
                }
            });
            return matched;
        }

        function removeReadingTestCatalogRow(id) {
            for (var index = (vm.ieltsReadingTests || []).length - 1; index >= 0; index--) {
                if (String(vm.ieltsReadingTests[index].id) === String(id)) {
                    vm.ieltsReadingTests.splice(index, 1);
                    break;
                }
            }
            vm.bsTableControlCreateIELTSReadingTest.options.totalRows = Math.max(
                0,
                Number(vm.bsTableControlCreateIELTSReadingTest.options.totalRows || 0) - 1
            );
            try {
                $('#bsTableControl').bootstrapTable('removeByUniqueId', id);
            } catch (ignoreCatalogTableRemoveError) {
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsReadingTests;
            }
        }

        function updateReadingTestCatalogRow(id, status) {
            var row = findReadingTestCatalogRow(id);
            if (row) {
                row.status = status;
            }
            try {
                $('#bsTableControl').bootstrapTable('updateByUniqueId', {
                    id: id,
                    row: {status: status}
                });
            } catch (ignoreCatalogTableUpdateError) {
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsReadingTests;
            }
        }

        function statusBelongsToCurrentCatalog(status) {
            return vm.showHiddenTests ? Number(status) === 8 : Number(status) !== 8;
        }

        function updateReadingTestCatalogStatus(id, status, successMessage) {
            if (!id || vm.catalogStatusUpdating[id]) {
                return;
            }
            vm.catalogStatusUpdating[id] = true;
            service.updateTestStatus(id, status).then(function (savedTest) {
                if (vm.ieltsReadingTest && String(vm.ieltsReadingTest.id) === String(id)) {
                    vm.ieltsReadingTest.status = status;
                }
                if (statusBelongsToCurrentCatalog(status)) {
                    updateReadingTestCatalogRow(id, status);
                } else {
                    removeReadingTestCatalogRow(id);
                }
                toastr.success(successMessage, 'Thông báo');
                return savedTest;
            }, function () {
                toastr.error('Không thể cập nhật trạng thái bài test.', 'Thông báo');
            }).finally(function () {
                delete vm.catalogStatusUpdating[id];
            });
        }

        $scope.hideReadingTest = function (id) {
            updateReadingTestCatalogStatus(id, 8, 'Đã ẩn bài test khỏi danh sách.');
        };

        $scope.restoreReadingTest = function (id) {
            // Restore as a draft so an old hidden test is never published accidentally.
            updateReadingTestCatalogStatus(id, 6, 'Đã khôi phục bài test về bản nháp.');
        };

        function readingQuestionType(id, code, name) {
            return {id: id, code: code, name: name};
        }

        function importedAnswer(answer, answerIndex) {
            var rawAnswer = angular.isObject(answer) ? answer : {text: answer};
            return {
                answer: {answer: String(rawAnswer.text || rawAnswer.answer || '')},
                question: {},
                ordinalNumberQuestionAnswer: answerIndex + 1,
                correct: rawAnswer.correct === true
            };
        }

        function importedQuestion(question, fallbackNumber) {
            var number = parseInt(question.number || question.ordinalNumber || fallbackNumber, 10);
            return {
                question: question.text || question.question || ('Question number ' + number),
                questionType: readingQuestionType(19, 'IELTSRTQ', 'IELTS Reading Test Question'),
                ordinalNumber: number,
                subQuestions: [],
                questionAnswers: (question.answers || question.questionAnswers || []).map(importedAnswer)
            };
        }

        function importedGroup(group, groupIndex) {
            var questions = group.questions || group.subQuestions || [];
            return {
                question: group.instructionHtml || group.instruction || group.question || '',
                questionType: readingQuestionType(18, 'IELTSRTPK', 'IELTS Reading Test Package'),
                ordinalNumber: parseInt(group.ordinalNumber || (groupIndex + 1), 10),
                type: parseInt(group.type, 10) || 1,
                isHaveChildren: questions.length > 0,
                subQuestions: questions.map(function (question, questionIndex) {
                    return importedQuestion(question, questionIndex + 1);
                })
            };
        }

        function importedPart(part, partIndex) {
            var passageTypeIds = [13, 14, 15];
            var groups = part.groups || part.subQuestions || [];
            return {
                question: part.passageHtml || part.passage || part.question || '',
                questionType: readingQuestionType(
                    passageTypeIds[partIndex],
                    'IELTSRTP' + (partIndex + 1),
                    'IELTS ' + vm.testModeName + ' Test Part ' + (partIndex + 1)
                ),
                ordinalNumber: partIndex + 1,
                subQuestions: groups.map(importedGroup)
            };
        }

        function removeImportedIdentifiers(question) {
            if (!question) {
                return;
            }
            delete question.id;
            delete question.parent;
            delete question.user;
            delete question.createDate;
            delete question.modifiedDate;
            delete question.modifyDate;
            angular.forEach(question.questionTopics || [], function (questionTopic) {
                if (questionTopic) {
                    delete questionTopic.id;
                    delete questionTopic.question;
                }
            });
            angular.forEach(question.questionAnswers || [], function (questionAnswer, answerIndex) {
                if (!questionAnswer) {
                    return;
                }
                delete questionAnswer.id;
                questionAnswer.question = {};
                questionAnswer.ordinalNumberQuestionAnswer =
                    parseInt(questionAnswer.ordinalNumberQuestionAnswer, 10) || (answerIndex + 1);
                questionAnswer.answer = questionAnswer.answer || {answer: ''};
                delete questionAnswer.answer.id;
            });
            angular.forEach(question.subQuestions || [], removeImportedIdentifiers);
        }

        function normalizeImportedReadingTest(source) {
            source = source && source.test ? source.test : source;
            if (!source || !angular.isObject(source)) {
                throw new Error('File import không chứa dữ liệu bài test.');
            }

            var test;
            if (angular.isArray(source.parts)) {
                if (source.parts.length !== 3) {
                    throw new Error('File import phải có đúng 3 parts.');
                }
                test = {
                    title: source.title,
                    pronounce: source.audioUrl || source.pronounce || null,
                    questionType: readingQuestionType(11, 'IELTSRT', 'IELTS ' + vm.testModeName + ' Test'),
                    type: 0,
                    status: 6,
                    questionTopics: [],
                    countWords: 0,
                    ordinalNumber: 1,
                    subQuestions: source.parts.map(importedPart)
                };
            } else {
                test = angular.copy(source);
            }

            if (!test.title || !String(test.title).trim()) {
                throw new Error('File import chưa có title.');
            }
            if (!angular.isArray(test.subQuestions) || test.subQuestions.length !== 3) {
                throw new Error('Bài test phải có đúng 3 parts.');
            }

            removeImportedIdentifiers(test);
            test.title = String(test.title).trim();
            test.pronounce = test.pronounce == null ? '' : String(test.pronounce).trim();
            if (vm.isListeningMode && !test.pronounce) {
                throw new Error('File Listening chưa có Audio URL trong sheet THONG_TIN.');
            }
            if (!vm.isListeningMode && test.pronounce) {
                throw new Error('File này có Audio URL nên được xác định là Listening. Hãy import tại trang Tạo IELTS Listening Test.');
            }
            test.questionType = readingQuestionType(11, 'IELTSRT', 'IELTS ' + vm.testModeName + ' Test');
            test.status = 6;
            test.userId = vm.currentUser.id;
            test.ordinalNumber = parseInt(test.ordinalNumber, 10) || 1;
            test.questionTopics = test.questionTopics || [];

            var seenNumbers = {};
            var questionCount = 0;
            angular.forEach(test.subQuestions, function (part, partIndex) {
                var passageTypeIds = [13, 14, 15];
                part.ordinalNumber = partIndex + 1;
                part.questionType = readingQuestionType(
                    passageTypeIds[partIndex],
                    'IELTSRTP' + (partIndex + 1),
                    'IELTS ' + vm.testModeName + ' Test Part ' + (partIndex + 1)
                );
                part.subQuestions = part.subQuestions || [];
                angular.forEach(part.subQuestions, function (group, groupIndex) {
                    group.ordinalNumber = parseInt(group.ordinalNumber, 10) || (groupIndex + 1);
                    group.questionType = readingQuestionType(18, 'IELTSRTPK', 'IELTS Reading Test Package');
                    group.type = parseInt(group.type, 10) || 1;
                    group.subQuestions = group.subQuestions || [];
                    group.isHaveChildren = group.subQuestions.length > 0;
                    angular.forEach(group.subQuestions, function (question) {
                        var questionNumber = parseInt(question.ordinalNumber, 10);
                        if (!questionNumber || questionNumber < 1 || questionNumber > 40) {
                            throw new Error('Số câu hỏi phải nằm trong khoảng 1–40.');
                        }
                        if (seenNumbers[questionNumber]) {
                            throw new Error('Câu số ' + questionNumber + ' đang bị lặp trong file.');
                        }
                        seenNumbers[questionNumber] = true;
                        questionCount += 1;
                        question.questionType = readingQuestionType(19, 'IELTSRTQ', 'IELTS Reading Test Question');
                        question.subQuestions = question.subQuestions || [];
                        question.questionAnswers = question.questionAnswers || [];
                    });
                    ensureSharedChoicePackage(group);
                });
            });
            if (!questionCount) {
                throw new Error('File import chưa có câu hỏi nào.');
            }
            test.importedQuestionCount = questionCount;
            return test;
        }

        function normalizedExcelText(value) {
            return String(value === null || value === undefined ? '' : value)
                .toLowerCase()
                .trim()
                .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
                .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
                .replace(/[ìíịỉĩ]/g, 'i')
                .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
                .replace(/[ùúụủũưừứựửữ]/g, 'u')
                .replace(/[ỳýỵỷỹ]/g, 'y')
                .replace(/đ/g, 'd')
                .replace(/[^a-z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function excelRowValue(row, aliases) {
            var result = '';
            angular.forEach(row, function (value, key) {
                if (result !== '') {
                    return;
                }
                var normalizedKey = normalizedExcelText(key);
                for (var i = 0; i < aliases.length; i++) {
                    if (normalizedKey === normalizedExcelText(aliases[i])) {
                        result = value;
                        return;
                    }
                }
            });
            return result;
        }

        function findExcelSheet(workbook, aliases, fallbackIndex) {
            for (var i = 0; i < workbook.SheetNames.length; i++) {
                var normalizedName = normalizedExcelText(workbook.SheetNames[i]);
                for (var j = 0; j < aliases.length; j++) {
                    if (normalizedName === normalizedExcelText(aliases[j])) {
                        return workbook.Sheets[workbook.SheetNames[i]];
                    }
                }
            }
            if (fallbackIndex < workbook.SheetNames.length) {
                return workbook.Sheets[workbook.SheetNames[fallbackIndex]];
            }
            return null;
        }

        function excelQuestionType(value, fallbackType) {
            if (value === '' || value === null || value === undefined) {
                return fallbackType || 1;
            }
            var numericType = parseInt(value, 10);
            if (numericType >= 1 && numericType <= 14) {
                return numericType;
            }
            var normalizedType = normalizedExcelText(value);
            for (var i = 0; i < vm.types.length; i++) {
                if (normalizedExcelText(vm.types[i].name) === normalizedType) {
                    return vm.types[i].id;
                }
            }
            throw new Error('Loại câu hỏi "' + value + '" không hợp lệ. Vui lòng xem sheet LOAI_CAU_HOI.');
        }

        function markExcelCorrectAnswers(answers, correctValue, questionNumber) {
            var tokens = String(correctValue === null || correctValue === undefined ? '' : correctValue)
                .split(/[,;|]/)
                .map(function (token) { return token.trim(); })
                .filter(function (token) { return token.length > 0; });
            if (!tokens.length) {
                throw new Error('Câu ' + questionNumber + ' chưa nhập cột Đáp án đúng.');
            }

            var matched = 0;
            angular.forEach(tokens, function (token) {
                var tokenMatched = false;
                var answerIndex = parseInt(token, 10) - 1;
                if (!/^\d+$/.test(token) && /^[a-z]$/i.test(token)) {
                    answerIndex = token.toUpperCase().charCodeAt(0) - 65;
                }
                if (answerIndex >= 0 && answerIndex < answers.length) {
                    if (!answers[answerIndex].correct) {
                        answers[answerIndex].correct = true;
                        matched += 1;
                    }
                    tokenMatched = true;
                    return;
                }
                var normalizedToken = normalizedExcelText(token);
                angular.forEach(answers, function (answer) {
                    if (!answer.correct && normalizedExcelText(answer.text) === normalizedToken) {
                        answer.correct = true;
                        matched += 1;
                        tokenMatched = true;
                    }
                });
                if (!tokenMatched) {
                    throw new Error('Đáp án đúng "' + token + '" của câu ' + questionNumber + ' không khớp với các đáp án đã nhập.');
                }
            });
            if (!matched) {
                throw new Error('Đáp án đúng của câu ' + questionNumber + ' không khớp với các đáp án đã nhập.');
            }
        }

        function parseExcelMatchingOptions(value, rowNumber) {
            var text = String(value === null || value === undefined ? '' : value).trim();
            if (!text) {
                return [];
            }
            var chunks = text.split(/\r?\n|\s*\|\s*/);
            if (chunks.length === 1 && text.indexOf(';') >= 0) {
                chunks = text.split(/\s*;\s*/);
            }
            var options = chunks.map(function (chunk) {
                return String(chunk || '')
                    .replace(/^\s*(?:[ivxlcdm]+|[A-Z]|\d+)\s*[\).:=\-–—]\s*/i, '')
                    .trim();
            }).filter(function (option) {
                return option.length > 0;
            });
            if (options.length < 2 || options.length > 26) {
                throw new Error('Dòng ' + rowNumber + ': Danh sách dùng chung phải có từ 2 đến 26 lựa chọn, ngăn cách bằng dấu | hoặc xuống dòng.');
            }
            return options;
        }

        function countHeadingPlaceholders(content) {
            var matches = String(content || '').match(/\}\{\s*HEADING\s*\}\{/gi);
            return matches ? matches.length : 0;
        }

        function escapeRegularExpression(value) {
            return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function matchingHeadingSectionLabel(question, fallbackIndex) {
            var text = plainText(question && (question.text || question.question));
            var match = text.match(/(?:section|paragraph)\s+([A-Z])\b/i) || text.match(/^([A-Z])(?:\s|$)/i);
            return match ? match[1].toUpperCase() : vm.matchingOptionLabel(fallbackIndex);
        }

        function ensureImportedHeadingPlaceholders(part, partIndex) {
            var passageHtml = String((part && part.passageHtml) || '');
            var matchingQuestions = [];
            angular.forEach((part && part.groups) || [], function (group) {
                if (Number(group.type) === 4) {
                    matchingQuestions = matchingQuestions.concat(group.questions || []);
                }
            });
            if (!matchingQuestions.length) {
                return;
            }

            angular.forEach(matchingQuestions, function (question, questionIndex) {
                var label = escapeRegularExpression(matchingHeadingSectionLabel(question, questionIndex));
                var alreadyMarked = new RegExp(
                    '<(?:p|h[1-6]|div)\\b[^>]*>\\s*(?:<(?:strong|b)\\b[^>]*>\\s*)?' + label +
                    '\\s*(?:</(?:strong|b)>\\s*)?\\}\{\\s*HEADING\\s*\\}\{',
                    'i'
                );
                if (alreadyMarked.test(passageHtml)) {
                    return;
                }
                var sectionMarker = new RegExp(
                    '(<(?:p|h[1-6]|div)\\b[^>]*>\\s*(?:<(?:strong|b)\\b[^>]*>\\s*)?' + label +
                    '\\s*(?:</(?:strong|b)>\\s*)?)(\\s*</(?:p|h[1-6]|div)>)',
                    'i'
                );
                passageHtml = passageHtml.replace(sectionMarker, '$1 }{HEADING}{$2');
            });

            var expectedCount = matchingQuestions.length;
            var actualCount = countHeadingPlaceholders(passageHtml);
            if (actualCount !== expectedCount) {
                throw new Error('Part ' + (partIndex + 1) + ': Matching Heading có ' + actualCount +
                    '/' + expectedCount + ' vị trí }{HEADING}{. Hãy đặt mỗi ký hiệu ngay sau nhãn Section A, B, C... trong Passage HTML.');
            }
            part.passageHtml = passageHtml;
            part.type = 4;
        }

        function readingTestFromExcel(workbook) {
            var infoSheet = findExcelSheet(workbook, ['THONG_TIN', 'THÔNG TIN', 'INFO'], 1);
            var contentSheet = findExcelSheet(workbook, ['NOI_DUNG', 'NỘI DUNG', 'CONTENT'], 2);
            if (!infoSheet || !contentSheet) {
                throw new Error('File Excel phải có sheet THONG_TIN và NOI_DUNG. Hãy tải file mẫu để nhập đúng cấu trúc.');
            }

            var infoRows = XLSX.utils.sheet_to_json(infoSheet, {header: 1, defval: '', raw: false});
            var info = {};
            angular.forEach(infoRows, function (row) {
                var key = normalizedExcelText(row[0]);
                if (key) {
                    info[key] = row[1];
                }
            });
            var title = info['tieu de'] || info.title || '';
            var audioUrl = info['audio url'] || info.audio || '';
            var workbookMode = normalizedExcelText(info['loai bai'] || info['test type'] || '');
            if (workbookMode && vm.isListeningMode && workbookMode.indexOf('listening') < 0) {
                throw new Error('Đây là file mẫu Reading. Hãy import tại trang IELTS Reading hoặc tải mẫu Listening mới.');
            }
            if (workbookMode && !vm.isListeningMode && workbookMode.indexOf('reading') < 0) {
                throw new Error('Đây là file mẫu Listening. Hãy import tại trang IELTS Listening.');
            }

            var source = {
                title: title,
                audioUrl: audioUrl,
                parts: [
                    {passageHtml: '', groups: []},
                    {passageHtml: '', groups: []},
                    {passageHtml: '', groups: []}
                ]
            };
            var rows = XLSX.utils.sheet_to_json(contentSheet, {defval: '', raw: false});
            var currentPartNumber = null;
            var currentGroupByPart = {};
            var groupsByPart = [{}, {}, {}];

            angular.forEach(rows, function (row, rowIndex) {
                var partCell = excelRowValue(row, ['Part', 'Phần']);
                if (partCell !== '') {
                    currentPartNumber = parseInt(partCell, 10);
                }
                if (!currentPartNumber || currentPartNumber < 1 || currentPartNumber > 3) {
                    throw new Error('Dòng ' + (rowIndex + 2) + ': Part phải là 1, 2 hoặc 3.');
                }

                var part = source.parts[currentPartNumber - 1];
                var passage = excelRowValue(row, ['Passage HTML', 'Nội dung passage', 'Passage']);
                if (String(passage).trim()) {
                    part.passageHtml = passage;
                }

                var groupCell = excelRowValue(row, ['Nhóm', 'Group']);
                if (groupCell !== '') {
                    currentGroupByPart[currentPartNumber] = parseInt(groupCell, 10);
                }
                var groupNumber = currentGroupByPart[currentPartNumber];
                if (!groupNumber || groupNumber < 1) {
                    throw new Error('Dòng ' + (rowIndex + 2) + ': chưa có số Nhóm.');
                }

                var typeCell = excelRowValue(row, ['Loại câu hỏi', 'Type']);
                var instruction = excelRowValue(row, ['Hướng dẫn HTML', 'Hướng dẫn', 'Instruction HTML']);
                var group = groupsByPart[currentPartNumber - 1][groupNumber];
                if (!group) {
                    group = {
                        type: excelQuestionType(typeCell, 1),
                        instructionHtml: instruction || '',
                        ordinalNumber: groupNumber,
                        matchingOptions: [],
                        questions: []
                    };
                    groupsByPart[currentPartNumber - 1][groupNumber] = group;
                    part.groups.push(group);
                } else {
                    if (typeCell !== '') {
                        group.type = excelQuestionType(typeCell, group.type);
                    }
                    if (String(instruction).trim()) {
                        group.instructionHtml = instruction;
                    }
                }

                var matchingOptionsCell = excelRowValue(row, [
                    'Danh sách dùng chung (A=... | B=...)',
                    'Danh sách dùng chung',
                    'Danh sách ghép (Matching Names)',
                    'Danh sách ghép',
                    'Danh sách người',
                    'Danh sách heading',
                    'Danh sách headings',
                    'Danh sách ending',
                    'Danh sách endings',
                    'Shared choices',
                    'Matching options',
                    'Option list'
                ]);
                if (String(matchingOptionsCell).trim()) {
                    group.matchingOptions = parseExcelMatchingOptions(matchingOptionsCell, rowIndex + 2);
                }

                var questionNumberCell = excelRowValue(row, ['Số câu', 'Question number', 'Number']);
                if (questionNumberCell === '') {
                    return;
                }
                var questionNumber = parseInt(questionNumberCell, 10);
                var questionRanges = [{start: 1, end: 13}, {start: 14, end: 26}, {start: 27, end: 40}];
                var questionRange = questionRanges[currentPartNumber - 1];
                if (!questionNumber || questionNumber < questionRange.start || questionNumber > questionRange.end) {
                    throw new Error('Dòng ' + (rowIndex + 2) + ': Part ' + currentPartNumber +
                        ' chỉ được dùng câu ' + questionRange.start + '–' + questionRange.end + '.');
                }
                var answers = [];
                if ((Number(group.type) === 4 || Number(group.type) === 10 || Number(group.type) === 14) && group.matchingOptions.length) {
                    angular.forEach(group.matchingOptions, function (option) {
                        answers.push({text: option, correct: false});
                    });
                } else {
                    for (var answerNumber = 1; answerNumber <= 12; answerNumber++) {
                        var answerText = excelRowValue(row, ['Đáp án ' + answerNumber, 'Answer ' + answerNumber]);
                        if (String(answerText).trim()) {
                            answers.push({text: String(answerText).trim(), correct: false});
                        }
                    }
                }
                if (!answers.length) {
                    throw new Error('Dòng ' + (rowIndex + 2) + ': câu ' + questionNumber + ' chưa có đáp án.');
                }
                markExcelCorrectAnswers(
                    answers,
                    excelRowValue(row, ['Đáp án đúng', 'Correct answer', 'Correct']),
                    questionNumber
                );
                group.questions.push({
                    number: questionNumber,
                    text: excelRowValue(row, ['Nội dung câu hỏi', 'Question']) || ('Question number ' + questionNumber),
                    answers: answers
                });
            });

            angular.forEach(source.parts, function (part) {
                part.groups.sort(function (left, right) {
                    return Number(left.ordinalNumber) - Number(right.ordinalNumber);
                });
                if (!part.type) {
                    part.type = 1;
                }
            });
            angular.forEach(source.parts, ensureImportedHeadingPlaceholders);
            return normalizeImportedReadingTest(source);
        }

        vm.importReadingTestFile = function (file, invalidFiles) {
            var importTitle = 'Import IELTS ' + vm.testModeName;
            if ((!file && invalidFiles && invalidFiles.length) || (file && file.size > 10 * 1024 * 1024)) {
                toastr.warning('File Excel không được lớn hơn 10 MB.', importTitle);
                return;
            }
            if (!file) {
                return;
            }
            if (!/\.(xlsx|xls)$/i.test(file.name || '')) {
                toastr.warning('Vui lòng chọn file Excel có đuôi .xlsx hoặc .xls.', importTitle);
                return;
            }
            if (!$window.XLSX) {
                toastr.error('Thư viện đọc Excel chưa tải được. Vui lòng tải lại trang.', importTitle);
                return;
            }

            vm.importingReadingTest = true;
            var reader = new FileReader();
            reader.onload = function (event) {
                $scope.$applyAsync(function () {
                    try {
                        var workbook = XLSX.read(event.target.result, {type: 'array'});
                        var importedTest = readingTestFromExcel(workbook);
                        var importedQuestionCount = importedTest.importedQuestionCount;
                        delete importedTest.importedQuestionCount;
                        vm.ieltsReadingTest = importedTest;
                        vm.createPackage = true;
                        vm.getOrdinalNumber(vm.ieltsReadingTest);
                        isHavingQuestions(vm.ieltsReadingTest);
                        vm.refreshBuilderValidation();
                        vm.saveReadingTest('draft').finally(function () {
                            vm.importingReadingTest = false;
                        });
                        if (importedQuestionCount < 40) {
                            toastr.warning('Đã nhập ' + importedQuestionCount + '/40 câu. Bạn có thể bổ sung trước khi xuất bản.', importTitle);
                        }
                    } catch (error) {
                        vm.importingReadingTest = false;
                        toastr.error(error.message || 'File Excel không đúng định dạng.', importTitle);
                    }
                });
            };
            reader.onerror = function () {
                $scope.$applyAsync(function () {
                    vm.importingReadingTest = false;
                    toastr.error('Không thể đọc file Excel đã chọn.', importTitle);
                });
            };
            reader.readAsArrayBuffer(file);
        };

        vm.downloadReadingImportTemplate = function () {
            var modeName = vm.testModeName;
            var modeUpper = String(modeName).toUpperCase();
            var audioInstruction = vm.isListeningMode
                ? 'Bắt buộc nhập URL HTTPS công khai trỏ trực tiếp tới file audio (ví dụ .mp3 hoặc .m4a). Không dùng link trang nghe cần đăng nhập.'
                : 'Phải để trống. Nếu có Audio URL, file thuộc Listening và phải import ở trang IELTS Listening.';
            var automaticReadingHeader = 'Riêng Reading: không nhập dòng “READING PASSAGE 1/2/3” vì giao diện bài làm đã bỏ dòng này. Không nhập câu “You should spend about 20 minutes on Questions ...” vì hệ thống tự hiện đúng khoảng câu. Passage HTML bắt đầu từ tiêu đề riêng của bài đọc.';
            var passageHtmlInstruction = vm.isListeningMode
                ? 'Giữ đủ tiêu đề riêng, phụ đề, ký hiệu A/B/C…, xuống dòng và nội dung gốc. Không tóm tắt hoặc tự sửa câu chữ của đề.'
                : 'Giữ đủ tiêu đề riêng của bài đọc, phụ đề, ký hiệu A/B/C…, xuống dòng và nội dung gốc. Không lặp tiêu đề READING PASSAGE và câu You should spend vì hệ thống tự hiện. Không tóm tắt hoặc tự sửa câu chữ của đề.';
            var promptPartHeaderInstruction = vm.isListeningMode
                ? 'Với Listening, nhập nội dung/bối cảnh được in trong đề nếu có; không tự thêm nội dung không có trong đề gốc.'
                : automaticReadingHeader;
            var part1PassageExample = vm.isListeningMode
                ? '<h2>Listening Part 1</h2><p>Nhập nội dung hoặc bối cảnh của Part 1 nếu đề gốc có.</p>'
                : '<h2>Tiêu đề riêng của bài đọc</h2><p><em>Phụ đề nếu có</em></p><p>Dán nội dung bài tại đây; không nhập READING PASSAGE 1 và câu You should spend.</p>';
            var part2PassageExample = vm.isListeningMode
                ? '<h2>Listening Part 2</h2><p><strong>A</strong></p><p>Nội dung đoạn A.</p><p><strong>B</strong></p><p>Nội dung đoạn B.</p>'
                : '<h2>Tiêu đề riêng của bài đọc Part 2</h2><p><strong>A</strong> }{HEADING}{</p><p>Nội dung đoạn A.</p><p><strong>B</strong> }{HEADING}{</p><p>Nội dung đoạn B.</p>';
            var part3PassageExample = vm.isListeningMode
                ? '<h2>Listening Part 3</h2><p>Nhập nội dung hoặc bối cảnh của Part 3 nếu đề gốc có.</p>'
                : '<h2>Tiêu đề riêng của bài đọc Part 3</h2><p>Dán nội dung bài tại đây; không lặp tiêu đề Part tự động.</p>';
            if (!$window.XLSX) {
                toastr.error('Thư viện tạo Excel chưa tải được. Vui lòng tải lại trang.', 'IELTS ' + modeName);
                return;
            }
            var workbook = XLSX.utils.book_new();
            workbook.Props = {
                Title: 'Mẫu import IELTS ' + modeName + ' Test',
                Subject: 'IELTS ' + modeName,
                Author: 'IELTS Room'
            };

            var guideRows = [
                ['HƯỚNG DẪN IMPORT IELTS ' + modeUpper + ' TEST', 'ĐỌC KỸ TRƯỚC KHI TẠO FILE'],
                ['Mục tiêu', 'Tạo đúng một bài IELTS ' + modeName + ' gồm 3 parts và tối đa 40 câu, sau đó import trực tiếp tại trang IELTS ' + modeName + '.'],
                ['Bước 1', 'Trong THONG_TIN, giữ Loại bài=' + modeUpper + ', nhập Tiêu đề và Audio URL theo quy tắc bên dưới.'],
                ['Audio URL', audioInstruction],
                ['Bước 2', 'Thay toàn bộ dòng ví dụ trong NOI_DUNG bằng dữ liệu của đề thật; giữ nguyên tên sheet và tiêu đề cột.'],
                ['Bước 3', 'Mỗi dòng trong NOI_DUNG là một câu hỏi. Các dòng cùng Part + Nhóm tạo thành một question package.'],
                ['Bước 4', 'Part 1 chỉ dùng câu 1–13; Part 2 chỉ dùng câu 14–26; Part 3 chỉ dùng câu 27–40. Không lặp số câu.'],
                ['Bước 5', 'Passage HTML chỉ cần nhập ở dòng đầu của mỗi Part. Nhóm, Loại câu hỏi, Hướng dẫn HTML và Danh sách dùng chung có thể bỏ trống ở dòng sau để kế thừa.'],
                ['Reading: tiêu đề Part tự động', automaticReadingHeader],
                ['Bước 6', 'Đáp án đúng có thể nhập số thứ tự 1,2… hoặc chữ A,B,C…; nhiều đáp án ngăn cách bằng dấu phẩy, ví dụ A,C.'],
                ['HTML được phép', 'Dùng HTML đơn giản như <h2>, <h3>, <p>, <strong>, <em>, <br>, <ul>, <ol>, <li>. Không chèn script, iframe, CSS hoặc công thức Excel.'],
                ['Passage HTML', passageHtmlInstruction],
                ['Hướng dẫn HTML', 'Ghi nguyên phần Questions x–y và yêu cầu của nhóm, ví dụ Choose the correct letter, A–F.'],
                ['Nội dung câu hỏi', 'Ghi phần statement/question của đúng số câu. Không thêm số câu vào nội dung vì hệ thống tự hiển thị số.'],
                ['Đáp án 1–12', 'Dùng cho Multiple Choices, Complete List of Words và các loại thông thường. Nhập đủ lựa chọn theo đúng thứ tự; ô không dùng để trống.'],
                ['MATCHING HEADINGS (mã 4)', 'Nhóm câu hỏi dùng Loại câu hỏi=4. Cột Danh sách dùng chung nhập i=Heading thứ nhất | ii=Heading thứ hai | iii=Heading thứ ba... ở dòng đầu nhóm. Mỗi câu nhập Section A, Section B...; Đáp án đúng nhập vị trí heading A/B/C... hoặc 1/2/3...'],
                ['MATCHING HEADINGS - Passage', 'Trong Passage HTML, đặt đúng một }{HEADING}{ ngay sau từng nhãn đoạn cần ghép, ví dụ <p><strong>A</strong> }{HEADING}{</p>. Số ký hiệu phải bằng số câu Matching Heading và theo đúng thứ tự câu.'],
                ['MATCHING HEADINGS - tự sửa', 'Importer sẽ tự chèn ký hiệu nếu nhãn A/B/C... nằm riêng trong thẻ như <p><strong>A</strong></p>. Tuy vậy ChatGPT phải tạo sẵn }{HEADING}{ để file rõ ràng và không phụ thuộc tự nhận diện. Khi import, Part có nhóm mã 4 tự chuyển sang Matching Heading; không cần chọn tay.'],
                ['MATCHING NAMES (mã 10)', 'Nhập danh sách chung tại cột Danh sách dùng chung theo dạng A=Jim Bowler | B=Alan Thorne | C=Tim Flannery. Chỉ cần nhập ở dòng đầu của nhóm.'],
                ['MATCHING NAMES - đáp án', 'Các cột Đáp án 1–12 để trống. Cột Đáp án đúng của mỗi câu nhập A/B/C… tương ứng người đúng. Trên bài làm, bảng hiện A/B/C… và danh sách tên hiện dưới bảng.'],
                ['SENTENCE ENDINGS (mã 14)', 'Dùng cho “Complete each sentence with the correct ending”. Cột Danh sách dùng chung nhập A=is not backed... | B=is provided... ở dòng đầu nhóm. Nội dung câu hỏi là phần đầu của câu; Đáp án đúng nhập A/B/C... Học sinh kéo ending vào ô sau câu.'],
                ['FILLING GAPS MỚI / ONE EDITOR (mã 11)', 'Mọi dạng điền từ mới phải dùng mã 11. Dòng đầu nhóm chứa toàn bộ đoạn/các câu và đúng một ký hiệu }{SPACE}{ cho mỗi số câu. Mỗi số câu bắt buộc có một dòng riêng; Đáp án 1 của từng dòng là từ đúng của chính câu đó, Đáp án đúng nhập A. Các dòng sau chỉ được để trống Nội dung câu hỏi, không được bỏ dòng hoặc bỏ Đáp án 1.'],
                ['FILLING GAPS MỚI - ví dụ', 'Koster believes that games remove people’s fear of }{SPACE}{. Robertson’s view is associated with }{SPACE}{. Nhóm 2 câu phải có đúng 2 ký hiệu, đúng 2 dòng câu và cả 2 dòng đều phải có Đáp án 1. Không gõ dấu chấm/gạch dưới thay cho ô trống.'],
                ['FILLING GAPS CŨ (mã 2 và 3)', 'Chỉ giữ để tương thích và chỉnh sửa dữ liệu cũ. Không dùng mã 2 hoặc 3 khi ChatGPT tạo file import mới; luôn chuyển dạng điền từ mới sang mã 11.'],
                ['COMPLETE LIST OF WORDS (mã 13)', 'Dùng một editor và đúng một }{SPACE}{ cho mỗi câu. Nếu nhóm có N câu, phải tạo đủ N dòng câu. Trên MỌI dòng của nhóm, lặp lại nguyên vẹn cùng danh sách ở Đáp án 1–12: N đáp án đúng đặt trước theo đúng thứ tự số câu, rồi mới tới từ nhiễu. Danh sách A–J phải điền đủ cả 10 cột, không được dừng ở đáp án đầu. Đáp án đúng của dòng thứ 1/2/3... lần lượt là A/B/C...; không được chỉ nhập đáp án cho dòng đầu.'],
                ['Multiple Answers', 'Nhập toàn bộ lựa chọn vào Đáp án 1–12 và các chữ/số đúng, ngăn cách bằng dấu phẩy, trong Đáp án đúng.'],
                ['Kiểm tra trước import', 'Đủ title; đúng 3 parts; đúng khoảng số câu; không trùng số; mỗi câu có đáp án; đáp án đúng khớp danh sách; không còn chữ mẫu.'],
                ['Dùng với ChatGPT', 'Gửi đề gốc cùng file mẫu này và yêu cầu ChatGPT đọc sheet PROMPT_CHATGPT. ChatGPT phải trả về một file .xlsx theo đúng cấu trúc, không trả JSON/CSV.']
            ];
            var guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
            guideSheet['!cols'] = [{wch: 31}, {wch: 125}];
            XLSX.utils.book_append_sheet(workbook, guideSheet, 'HUONG_DAN');

            var promptRows = [
                ['PROMPT DÀNH CHO CHATGPT - PHẢI THỰC HIỆN ĐÚNG TOÀN BỘ'],
                ['Bạn là chuyên gia số hóa đề IELTS ' + modeName + '. Tôi gửi kèm (1) đề IELTS ' + modeName + ' gốc và (2) file Excel mẫu này. Hãy phân tích toàn bộ đề và tạo một file Excel .xlsx hoàn chỉnh để tôi import trực tiếp vào hệ thống.'],
                ['YÊU CẦU BẮT BUỘC'],
                ['1. Giữ nguyên các sheet HUONG_DAN, PROMPT_CHATGPT, THONG_TIN, NOI_DUNG, LOAI_CAU_HOI và toàn bộ sheet VI_DU_*; không đổi tên cột trong NOI_DUNG.'],
                ['2. Trong THONG_TIN, giữ nguyên Loại bài=' + modeUpper + ', điền Tiêu đề và xử lý Audio URL theo quy tắc: ' + audioInstruction],
                ['3. Tạo đúng 3 parts. Part 1 dùng câu 1–13, Part 2 dùng câu 14–26, Part 3 dùng câu 27–40. Giữ đúng số câu, thứ tự câu và đáp án gốc.'],
                ['4. Mỗi nhóm câu liên tiếp có cùng Part, Nhóm, Loại câu hỏi và Hướng dẫn HTML. Passage HTML chỉ lặp một lần ở dòng đầu mỗi Part.'],
                ['4A. ' + promptPartHeaderInstruction],
                ['5. Chọn mã theo LOAI_CAU_HOI: Matching Headings=4, Matching Names/List of Researchers=10, mọi dạng điền từ/gap mới=11 (Filling Gaps New - One Editor), Complete List of Words có danh sách từ cho sẵn=13, Complete each sentence with the correct ending=14. TUYỆT ĐỐI không dùng mã 2 hoặc 3 trong file mới; hai mã đó chỉ dành cho dữ liệu cũ.'],
                ['6. Với mã 4, 10 hoặc 14, cột Danh sách dùng chung nhập một lần ở dòng đầu nhóm theo dạng ký hiệu=nội dung, ngăn cách bằng |. Các dòng sau để trống cột này để kế thừa. Các cột Đáp án 1–12 để trống; Đáp án đúng nhập A/B/C… theo vị trí.'],
                ['6A. Riêng Matching Headings mã 4: Passage HTML phải có đúng một }{HEADING}{ sau từng nhãn đoạn được hỏi, ví dụ <p><strong>A</strong> }{HEADING}{</p>. Số }{HEADING}{ phải bằng số câu của nhóm và thứ tự A/B/C... phải trùng Nội dung câu hỏi Section A/Section B/Section C...'],
                ['7. Với mã 11, Nội dung câu hỏi ở dòng đầu nhóm chứa toàn bộ đoạn và đúng một }{SPACE}{ cho mỗi số câu theo đúng thứ tự. BẮT BUỘC tạo một dòng cho từng số câu; trên mỗi dòng nhập đầy đủ từ đúng của chính câu đó tại Đáp án 1 và nhập A tại Đáp án đúng. Chỉ Nội dung câu hỏi ở các dòng sau được để trống. Không được bỏ Đáp án 1 của câu thứ hai trở đi và không thay }{SPACE}{ bằng dấu chấm/gạch dưới.'],
                ['7A. Với mã 13 Complete List of Words: nhóm N câu phải có đúng N ký hiệu }{SPACE}{ và đúng N dòng. Xác định đủ N đáp án đúng trước, sắp theo số câu tăng dần, rồi mới thêm từ nhiễu. Lặp lại TOÀN BỘ danh sách giống hệt ở các cột Đáp án 1–12 trên TẤT CẢ N dòng; Đáp án đúng của các dòng lần lượt A, B, C... Không chỉ điền dòng đầu và không được bỏ bất kỳ lựa chọn nào ở cuối danh sách. Ví dụ câu 31–35 có danh sách A–J: cả 5 dòng đều phải điền đủ cùng 10 đáp án, và Đáp án đúng lần lượt A/B/C/D/E.'],
                ['8. Với loại khác (không phải mã 11 hoặc 13), nhập lựa chọn/đáp án vào Đáp án 1–12. Đáp án đúng nhập vị trí 1–12 hoặc chữ A–L; nhiều đáp án ngăn cách bằng dấu phẩy.'],
                ['9. Passage và hướng dẫn dùng HTML đơn giản. Giữ nguyên nội dung đề, chính tả, dấu câu, tên riêng, tiêu đề đoạn và ký hiệu A/B/C…; không tóm tắt.'],
                ['10. Không tạo macro, công thức, link ngoài, sheet phụ hoặc cột phụ. Không để ô lỗi Excel. File phải mở được bằng Excel và SheetJS.'],
                ['11. Tự kiểm tra từng dòng trước khi xuất file: đủ 40 câu nếu đề đủ 40; không trùng/thiếu số; đúng part; KHÔNG có dòng câu nào thiếu Đáp án 1 khi loại yêu cầu đáp án; Đáp án đúng khớp lựa chọn; mã 4 có số }{HEADING}{ bằng số câu; mã 11 và 13 có số }{SPACE}{ bằng số câu. Với mã 13, kiểm tra mọi dòng đều có cùng danh sách đầy đủ và số đáp án đúng không nhỏ hơn số câu. Nếu còn thiếu dù chỉ một đáp án thì phải sửa xong mới tạo file.'],
                ['KẾT QUẢ ĐẦU RA'],
                ['Chỉ gửi lại file .xlsx hoàn chỉnh. Không gửi JSON, CSV hoặc hướng dẫn thay thế cho file. Nếu đề gốc thiếu dữ liệu, ghi rõ phần thiếu trong một tin nhắn ngắn và không tự bịa đáp án.']
            ];
            var promptSheet = XLSX.utils.aoa_to_sheet(promptRows);
            promptSheet['!cols'] = [{wch: 150}];
            XLSX.utils.book_append_sheet(workbook, promptSheet, 'PROMPT_CHATGPT');

            var infoSheet = XLSX.utils.aoa_to_sheet([
                ['Trường', 'Giá trị'],
                ['Loại bài', modeUpper],
                ['Tiêu đề', 'IELTS Academic ' + modeName + ' Test 01'],
                ['Audio URL', vm.isListeningMode ? 'https://example.com/audio/ielts-listening-test-01.mp3' : '']
            ]);
            infoSheet['!cols'] = [{wch: 22}, {wch: 70}];
            XLSX.utils.book_append_sheet(workbook, infoSheet, 'THONG_TIN');

            var contentRows = [
                ['Part', 'Passage HTML', 'Nhóm', 'Loại câu hỏi', 'Hướng dẫn HTML', 'Số câu', 'Nội dung câu hỏi', 'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8', 'Đáp án 9', 'Đáp án 10', 'Đáp án 11', 'Đáp án 12', 'Danh sách dùng chung (A=... | B=...)', 'Đáp án đúng'],
                [1, part1PassageExample, 1, 1, '<p><strong>Questions 1–2</strong></p><p>Choose the correct answer.</p>', 1, 'Nội dung câu hỏi 1', 'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', '', '', '', '', '', '', '', '', '', 'A'],
                ["","","","","",2,"Nội dung câu hỏi 2","TRUE","FALSE","NOT GIVEN","","","","","","","","","","","A"],
                [2, part2PassageExample, 1, 4, '<p><strong>Questions 14–15</strong></p><p>Choose the correct heading for each section.</p>', 14, 'Section A', '', '', '', '', '', '', '', '', '', '', '', '', 'i=Heading about section B | ii=Heading about section A | iii=Heading not used', 'B'],
                ["","","","","",15,"Section B","","","","","","","","","","","","","","A"],
                [3, part3PassageExample, 1, 10, '<p><strong>Questions 27–28</strong></p><p>Match each statement with the correct researcher, A–F.</p>', 27, 'Our human ancestors did not originate in only one area.', '', '', '', '', '', '', '', '', '', '', '', '', 'A=Jim Bowler | B=Alan Thorne | C=Tim Flannery | D=Rainer Grün | E=Richard Roberts and Tim Flannery | F=Judith Field and Richard Fullager', 'A'],
                ["","","","","",28,"The extinction of the megafauna happened within a particular period.","","","","","","","","","","","","","","C"]
            ];
            var contentSheet = XLSX.utils.aoa_to_sheet(contentRows);
            contentSheet['!cols'] = [
                {wch: 8}, {wch: 55}, {wch: 9}, {wch: 18}, {wch: 55}, {wch: 10}, {wch: 35},
                {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20},
                {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 90}, {wch: 16}
            ];
            contentSheet['!autofilter'] = {ref: 'A1:U7'};
            XLSX.utils.book_append_sheet(workbook, contentSheet, 'NOI_DUNG');

            var typeImportNotes = {
                1: 'Một đáp án: dùng cho Multiple Choice, TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN. Nhập lựa chọn ở Đáp án 1–12 và một Đáp án đúng.',
                2: 'LEGACY - Filling Gaps cũ. Chỉ dùng cho đề cũ; không dùng trong file import mới. Dạng điền từ mới phải dùng mã 11.',
                3: 'LEGACY - Filling Gaps Enter cũ. Chỉ dùng cho đề cũ; không dùng trong file import mới. Dạng điền từ mới phải dùng mã 11.',
                4: 'Matching Headings. Danh sách heading dùng chung nhập một lần; Passage HTML có một }{HEADING}{ sau mỗi nhãn A/B/C...; mỗi câu dùng Đáp án đúng A–Z theo vị trí heading. Importer tự đặt Part về loại Matching Heading.',
                5: 'Multiple Choice có nhiều đáp án. Đáp án đúng nhập nhiều vị trí/chữ, ví dụ A,C.',
                6: vm.isListeningMode ? 'Bố cục lựa chọn ngang cho câu hỏi Listening.' : 'Bố cục lựa chọn ngang, chủ yếu dùng Listening; chỉ dùng khi đề Reading thật sự yêu cầu.',
                7: vm.isListeningMode ? 'Multiple Answers cho Listening; nhập nhiều đáp án đúng, ngăn cách bằng dấu phẩy.' : 'Multiple Answers kiểu Listening; không ưu tiên cho IELTS Reading.',
                8: vm.isListeningMode ? 'Matching/drop box cho Listening; giữ đúng danh sách lựa chọn và thứ tự đáp án.' : 'Matching Heading kiểu Listening/drop box; không ưu tiên cho IELTS Reading.',
                9: vm.isListeningMode ? 'Map/diagram Listening; Passage HTML giữ ảnh/bản đồ và các vị trí cần trả lời.' : 'Map/diagram kiểu Listening; không ưu tiên cho IELTS Reading.',
                10: 'MATCHING NAMES. Danh sách người dùng chung nhập ở cột Danh sách dùng chung; mỗi câu dùng Đáp án đúng A–Z.',
                11: 'Filling Gaps New / ONE WORD ONLY / một editor. Dòng đầu chứa toàn bộ nội dung và đúng một }{SPACE}{ cho mỗi câu; bắt buộc đủ một dòng cho từng số câu; Đáp án 1 từng dòng là từ đúng, Đáp án đúng=A. Không dùng mã 2 hoặc 3 cho đề mới.',
                12: 'MATCHING INFORMATION. Nhập cùng danh sách lựa chọn theo thứ tự ở Đáp án 1–12 cho mỗi câu.',
                13: 'Complete List of Words. Một editor; N đáp án đúng đặt trước theo thứ tự N câu, sau đó mới tới từ nhiễu. Phải lặp nguyên danh sách Đáp án 1–12 trên mọi dòng trong nhóm; danh sách A–J phải đủ 10 mục; Đáp án đúng lần lượt A/B/C... Không chỉ nhập dòng đầu.',
                14: 'Complete each sentence with the correct ending. Danh sách endings chung nhập ở cột Danh sách dùng chung; mỗi câu dùng Đáp án đúng A–Z.'
            };
            var typeRows = [['Mã', 'Loại câu hỏi', 'Quy tắc nhập chính xác']];
            angular.forEach(vm.types, function (type) {
                typeRows.push([type.id, type.name, typeImportNotes[type.id] || type.notice]);
            });
            var typeSheet = XLSX.utils.aoa_to_sheet(typeRows);
            typeSheet['!cols'] = [{wch: 10}, {wch: 42}, {wch: 75}];
            XLSX.utils.book_append_sheet(workbook, typeSheet, 'LOAI_CAU_HOI');

            var matchingExampleSheet = XLSX.utils.aoa_to_sheet([
                ['MATCHING NAMES - VÍ DỤ CHUẨN'],
                ['Tên hiển thị dưới bảng', 'Giá trị trong cột Danh sách dùng chung'],
                ['A', 'Jim Bowler'],
                ['B', 'Alan Thorne'],
                ['C', 'Tim Flannery'],
                ['D', 'Rainer Grün'],
                ['E', 'Richard Roberts and Tim Flannery'],
                ['F', 'Judith Field and Richard Fullager'],
                [],
                ['Chuỗi nhập vào NOI_DUNG'],
                ['A=Jim Bowler | B=Alan Thorne | C=Tim Flannery | D=Rainer Grün | E=Richard Roberts and Tim Flannery | F=Judith Field and Richard Fullager'],
                [],
                ['Quy tắc', 'Nhập chuỗi trên ở dòng đầu của nhóm mã 10. Các dòng câu tiếp theo cùng nhóm để trống cột Danh sách dùng chung. Đáp án đúng dùng A–F.']
            ]);
            matchingExampleSheet['!cols'] = [{wch: 28}, {wch: 125}];
            XLSX.utils.book_append_sheet(workbook, matchingExampleSheet, 'VI_DU_MATCHING_NAMES');

            var headingExampleSheet = XLSX.utils.aoa_to_sheet([
                ['MATCHING HEADINGS (MÃ 4) - VÍ DỤ CHUẨN'],
                ['Ký hiệu trong đề', 'Nội dung heading'],
                ['i', 'Being able to experiment without consequences'],
                ['ii', 'Why stories are included in games'],
                ['iii', 'The key role of the unexpected for game players'],
                ['iv', 'Transferring features of games to other types of products'],
                [],
                ['Chuỗi nhập vào cột Danh sách dùng chung'],
                ['i=Being able to experiment without consequences | ii=Why stories are included in games | iii=The key role of the unexpected for game players | iv=Transferring features of games to other types of products'],
                [],
                ['Nội dung câu hỏi', 'Nhập tên section/đoạn cần ghép, ví dụ Section A.'],
                ['Đáp án đúng', 'Nhập A nếu đúng heading đầu tiên (i), B nếu đúng heading thứ hai (ii), C nếu đúng heading thứ ba (iii)… Hệ thống chấm theo vị trí trong danh sách.'],
                [],
                ['Passage HTML chuẩn', '<p><strong>A</strong> }{HEADING}{</p><p>Nội dung Section A...</p><p><strong>B</strong> }{HEADING}{</p><p>Nội dung Section B...</p>'],
                ['Vị trí ký hiệu', '}{HEADING}{ phải nằm ngay sau nhãn của section cần ghép. Có 6 câu Section A–F thì Passage phải có đúng 6 ký hiệu theo thứ tự A–F.'],
                ['Tự nhận diện khi import', 'Nếu passage chỉ có <p><strong>A</strong></p>, <p><strong>B</strong></p>..., hệ thống sẽ thử tự chèn. File do ChatGPT tạo vẫn phải ghi sẵn ký hiệu để tránh sai khi HTML phức tạp.'],
                ['Loại của Passage', 'Chỉ cần nhóm câu hỏi dùng mã 4. Khi import, hệ thống tự đặt Part/Passage thành Matching Heading; không cần sửa tay sau import.']
            ]);
            headingExampleSheet['!cols'] = [{wch: 34}, {wch: 125}];
            XLSX.utils.book_append_sheet(workbook, headingExampleSheet, 'VI_DU_MATCHING_HEADING');

            var endingExampleSheet = XLSX.utils.aoa_to_sheet([
                ['COMPLETE EACH SENTENCE WITH THE CORRECT ENDING (MÃ 14)'],
                ['Ký hiệu', 'Ending'],
                ['A', 'is not backed by scientific evidence.'],
                ['B', 'is provided by memory.'],
                ['C', 'has been especially fruitful in recent times.'],
                ['D', 'causes us to overlook other details.'],
                ['E', 'has sparked significant public debate.'],
                ['F', 'is challenging for us to accept.'],
                ['G', 'helps us see the overall picture more clearly.'],
                [],
                ['Chuỗi nhập vào cột Danh sách dùng chung'],
                ['A=is not backed by scientific evidence. | B=is provided by memory. | C=has been especially fruitful in recent times. | D=causes us to overlook other details. | E=has sparked significant public debate. | F=is challenging for us to accept. | G=helps us see the overall picture more clearly.'],
                [],
                ['Nội dung câu hỏi', 'Chỉ nhập phần đầu của từng câu, không thêm ending và không cần tự gõ ô trống. Giao diện tự đặt ô kéo-thả ngay sau nội dung.'],
                ['Đáp án đúng', 'Nhập A–G theo ending đúng. Chỉ nhập danh sách dùng chung ở dòng đầu của nhóm; các dòng sau để trống.']
            ]);
            endingExampleSheet['!cols'] = [{wch: 34}, {wch: 145}];
            XLSX.utils.book_append_sheet(workbook, endingExampleSheet, 'VI_DU_SENTENCE_ENDINGS');

            var oneWordExampleSheet = XLSX.utils.aoa_to_sheet([
                ['ONE WORD ONLY / FILLING GAPS NEW (MÃ 11)'],
                ['Trường', 'Giá trị mẫu và quy tắc'],
                ['Hướng dẫn HTML', '<p><strong>Questions 24–26</strong></p><p>Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.</p>'],
                ['Nội dung câu hỏi ở dòng câu 24', 'Koster believes that games remove people’s fear of }{SPACE}{. Robertson’s view is that games feel exciting partly because of the }{SPACE}{ associated with them. Narrative games are structured so that the first and last parts are both }{SPACE}{.'],
                ['Nội dung câu hỏi ở dòng 25 và 26', 'Để trống. Toàn bộ nội dung chung chỉ đặt ở dòng đầu nhóm.'],
                ['Đáp án 1 dòng 24', 'Nhập đúng một từ là đáp án câu 24.'],
                ['Đáp án 1 dòng 25', 'Nhập đúng một từ là đáp án câu 25.'],
                ['Đáp án 1 dòng 26', 'Nhập đúng một từ là đáp án câu 26.'],
                ['Đáp án đúng của cả ba dòng', 'A'],
                ['Kiểm tra bắt buộc', 'Nhóm có 3 câu thì nội dung dòng đầu phải có đúng 3 ký hiệu }{SPACE}{ theo đúng thứ tự câu 24, 25, 26.']
            ]);
            oneWordExampleSheet['!cols'] = [{wch: 38}, {wch: 145}];
            XLSX.utils.book_append_sheet(workbook, oneWordExampleSheet, 'VI_DU_ONE_WORD_ONLY');

            var completeListExampleSheet = XLSX.utils.aoa_to_sheet([
                ['COMPLETE LIST OF WORDS (MÃ 13) - VÍ DỤ KHÔNG ĐƯỢC THIẾU ĐÁP ÁN'],
                ['Nhóm câu', '31–35 (5 câu, vì vậy phải có đúng 5 dòng và đúng 5 ký hiệu }{SPACE}{)'],
                ['Nội dung câu hỏi dòng 31', 'In cities, horse manure led to }{SPACE}{ and diseases. Horses might cause }{SPACE}{. The }{SPACE}{ was damaged. Producers created }{SPACE}{. Workers needed }{SPACE}{.'],
                ['Nội dung câu hỏi dòng 32–35', 'Để trống vì toàn bộ nội dung nằm trong editor chung ở dòng 31.'],
                [],
                ['Số câu', 'Đáp án 1 (A)', 'Đáp án 2 (B)', 'Đáp án 3 (C)', 'Đáp án 4 (D)', 'Đáp án 5 (E)', 'Đáp án 6 (F)', 'Đáp án 7 (G)', 'Đáp án 8 (H)', 'Đáp án 9 (I)', 'Đáp án 10 (J)', 'Đáp án đúng'],
                [31, 'unpleasant smells', 'injuries', 'environment', 'financial controls', 'food', 'diseases', 'untrained workers', 'small-scale cultivation', 'migrant workers', 'national governments', 'A'],
                [32, 'unpleasant smells', 'injuries', 'environment', 'financial controls', 'food', 'diseases', 'untrained workers', 'small-scale cultivation', 'migrant workers', 'national governments', 'B'],
                [33, 'unpleasant smells', 'injuries', 'environment', 'financial controls', 'food', 'diseases', 'untrained workers', 'small-scale cultivation', 'migrant workers', 'national governments', 'C'],
                [34, 'unpleasant smells', 'injuries', 'environment', 'financial controls', 'food', 'diseases', 'untrained workers', 'small-scale cultivation', 'migrant workers', 'national governments', 'D'],
                [35, 'unpleasant smells', 'injuries', 'environment', 'financial controls', 'food', 'diseases', 'untrained workers', 'small-scale cultivation', 'migrant workers', 'national governments', 'E'],
                [],
                ['Quy tắc bắt buộc', 'Danh sách A–J (Đáp án 1–10) phải được lặp giống hệt trên cả 5 dòng. Năm đáp án đúng nằm ở 5 vị trí đầu theo thứ tự câu 31–35; năm từ nhiễu đặt phía sau. Không được chỉ điền danh sách ở dòng 31 hoặc bỏ các đáp án cuối.']
            ]);
            completeListExampleSheet['!cols'] = [
                {wch: 28}, {wch: 30}, {wch: 24}, {wch: 24}, {wch: 24}, {wch: 24}, {wch: 24},
                {wch: 24}, {wch: 26}, {wch: 24}, {wch: 26}, {wch: 18}
            ];
            XLSX.utils.book_append_sheet(workbook, completeListExampleSheet, 'VI_DU_COMPLETE_LIST');

            XLSX.writeFile(workbook, vm.isListeningMode ? 'mau_import_ielts_listening.xlsx' : 'mau_import_ielts_reading.xlsx');
            toastr.success('Đã tải file Excel mẫu ' + modeName + '.', 'IELTS ' + modeName);
        };

        vm.status = {id: 3, name: "Tất cả (no listening)"};
        vm.statuses = [
            // {id: 1, name: "Chưa thuộc"},
            // {id: 2, name: "Thuộc"},
            // {id: 3, name: "Tất cả (no listening)"},
            // {id: 4, name:"Đánh dấu"},
            // {id: 5, name: "Listening"},
            {id: 6, name: "Bản nháp (chưa hiển thị)"},
            {id: 7, name: "Đã xuất bản (hiển thị)"},
        ];
        
        $scope.changeStatus = function (id,status) {
            updateReadingTestCatalogStatus(
                id,
                status,
                Number(status) === 7 ? 'Đã xuất bản bài test.' : 'Đã chuyển bài test về bản nháp.'
            );
        };

        vm.showAudioListening = false;

        vm.refreshBuilderValidation();


        //--------------------- End Create Reading test -------------------------//

    }

})();
