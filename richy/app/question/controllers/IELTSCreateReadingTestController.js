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
            {id: 10, name: "MATCHING NAMES", notice: "temp"},
            {id: 11, name: "Filling Gaps New (One Editor)", notice: "Write all questions in one editor; each }{SPACE}{ becomes the next numbered answer"},
            {id: 12, name: "MATCHING INFORMATION", notice: "Same creation and test layout as Matching Names"}
        ];
        vm.passageTypes = vm.types.slice(0, 10);

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
            subQuestions: [],
            userId: vm.currentUser.id
        };  //create a new test

        vm.getPageCreateIELTSReadingTest = function () {
            vm.searchDto.questionType = {id: 11};
            blockUI.start();
            service.getPageForTests(vm.searchDto, vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.ieltsReadingTests = data.content;
                vm.bsTableControlCreateIELTSReadingTest.options.data = vm.ieltsReadingTests;
                vm.bsTableControlCreateIELTSReadingTest.options.totalRows = data.totalElements;
                // x.focus();
                console.log(vm.ieltsReadingTests);

            });
        };

        vm.searchDto.pageSize = 12;
        if(settings.isAdmin){
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
                name: 'IELTS Reading Test',
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
                var saveMessage = saveMode === 'publish' ? 'Đã kiểm tra và xuất bản bài Reading.' :
                    (saveMode === 'preview' ? 'Đã lưu dữ liệu để mở bản xem trước.' : 'Đã lưu bản nháp.');
                toastr.success(saveMessage, 'Thông báo');
                return data;
            }, function failure() {
                blockUI.stop();
                toastr.error('Không thể lưu bài Reading. Vui lòng thử lại.', 'Thông báo');
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
                question.questionAnswers = [question.questionAnswers[0]];
                question.questionAnswers[0].ordinalNumberQuestionAnswer = 1;
                question.questionAnswers[0].correct = true;
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
            vm.changeInTheProcessOfCreatingReadingTest(questionPackage);
        };

        vm.updateOneEditorContent = function (questionPackage) {
            ensureOneEditorPackage(questionPackage);
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

            angular.forEach(readingPartRules, function (rule, partIndex) {
                var passage = (test.subQuestions || [])[partIndex] || {};
                var packages = passage.subQuestions || [];
                var questionEntries = getPartQuestions(partIndex);
                var numberMap = {};
                var missing = [];
                var partIssueStart = result.issues.length;

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
                });

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
                    if (Number(entry.questionPackage.type) !== 11 && (!questionText || /^Question number\s*\d*$/i.test(questionText))) {
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
                        } else if (Number(entry.questionPackage.type) === 11 && answers.length !== 1) {
                            addIssue('Câu ' + (number || '?') + ': Filling Gaps New chỉ dùng 1 đáp án.', questionTarget, partIndex);
                        } else if ((entry.questionPackage.type === 5 || entry.questionPackage.type === 7) && correctAnswerCount < 2) {
                            addIssue('Câu ' + (number || '?') + ': dạng nhiều đáp án cần đánh dấu ít nhất 2 đáp án đúng.', questionTarget, partIndex);
                        } else if (entry.questionPackage.type !== 5 && entry.questionPackage.type !== 7 && correctAnswerCount > 1) {
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
                vm.goToBuilderTarget('reading-builder-review');
            }
        };

        vm.toggleBuilderReview = function () {
            vm.showBuilderReview = !vm.showBuilderReview;
            vm.refreshBuilderValidation();
        };

        vm.saveDraftReadingTest = function () {
            vm.ieltsReadingTest.status = 6;
            vm.refreshBuilderValidation();
            return vm.saveReadingTest('draft');
        };

        vm.previewReadingTest = function (partIndex) {
            var targetPart = Math.max(1, Math.min(3, parseInt(partIndex, 10) || 1));
            var previewKey = 'ieltsReadingPreview-' + new Date().getTime();
            try {
                $window.localStorage.setItem(previewKey, angular.toJson(vm.ieltsReadingTest));
            } catch (previewStorageError) {
                toastr.error('Không thể tạo dữ liệu Preview trên trình duyệt này.', 'Không thể mở Preview');
                return;
            }
            var baseElement = document.getElementsByTagName('base')[0];
            var appBaseUrl = baseElement ? baseElement.href : ($window.location.protocol + '//' + $window.location.host + '/');
            var previewUrl = appBaseUrl.replace(/\/?$/, '/') + 'ielts_reading_actual_test/preview-local' +
                '?preview=1&previewPart=' + targetPart + '&previewKey=' + encodeURIComponent(previewKey);
            var previewWindow = $window.open(previewUrl, '_blank');
            if (!previewWindow) {
                $window.localStorage.removeItem(previewKey);
                toastr.warning('Trình duyệt đang chặn cửa sổ xem trước. Vui lòng cho phép pop-up.', 'Không thể mở Preview');
            }
        };

        vm.publishReadingTest = function () {
            var validation = vm.refreshBuilderValidation();
            vm.showBuilderReview = true;
            if (!validation.valid) {
                toastr.warning('Bài thi còn ' + validation.issues.length + ' mục cần hoàn thiện.', 'Chưa thể xuất bản');
                if (validation.issues.length) {
                    vm.goToBuilderTarget(validation.issues[0].target);
                }
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
            vm.goToBuilderStep(partIndex + 1);
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

        vm.addQuestionForPassage1 = function (index) {
            if (!validateQuestionRange(0)) {
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
                        editor.focus();
                        editor.undoManager.transact(function () {
                            editor.insertContent('}{SPACE}{');
                        });
                        editor.fire('change');
                        editor.save();
                        vm.changeInTheProcessOfCreatingReadingTest();
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
                columns: service.getTableDefinitionCreateIELTSReadingTest(),
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

        vm.enterSearchCode = function(){
            // console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.codeChange();
            }
        };

        vm.codeChange=function () {
            vm.searchDto.pageIndex = 1;
            vm.searchDto.findExactWord = false;
            vm.getPageCreateIELTSReadingTest();
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

                vm.ieltsReadingTest.status = status;
                vm.saveReadingTest();

                console.log(data);
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });


        };

        vm.showAudioListening = false;

        vm.refreshBuilderValidation();


        //--------------------- End Create Reading test -------------------------//

    }

})();
