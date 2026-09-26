/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.TestResult').controller('TestResultController', TestResultController);

    TestResultController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'TestResultService',
        'blockUI',
    ];

    angular.module('Hrm.TestResult').directive('compile', ['$compile', function ($compile) {
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

    angular.module('Hrm.TestResult').directive('writingFeedbackEditor', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, element, attrs, ngModel) {
                var quill;
                var changeHandler;
                var rendering = false;
                $timeout(function () {
                    if (!window.Quill) { return; }
                    quill = new window.Quill(element[0], {
                        theme: 'snow',
                        placeholder: 'Nhập nhận xét chi tiết cho học sinh...',
                        modules: {
                            toolbar: [
                                ['bold', 'italic', 'underline', 'strike'],
                                [{color: []}, {background: []}],
                                ['blockquote', 'link'],
                                ['clean']
                            ]
                        }
                    });
                    ngModel.$render();
                    changeHandler = function () {
                        if (rendering) { return; }
                        var html = quill.root.innerHTML;
                        scope.$evalAsync(function () {
                            ngModel.$setViewValue(html === '<p><br></p>' ? '' : html);
                        });
                    };
                    quill.on('text-change', changeHandler);
                });
                ngModel.$render = function () {
                    if (!quill) { return; }
                    var html = ngModel.$viewValue || '';
                    if (quill.root.innerHTML === html || (!html && quill.root.innerHTML === '<p><br></p>')) { return; }
                    rendering = true;
                    quill.clipboard.dangerouslyPasteHTML(html);
                    rendering = false;
                };
                scope.$on('$destroy', function () {
                    if (quill && changeHandler) { quill.off('text-change', changeHandler); }
                    quill = null;
                });
            }
        };
    }]);

    angular.module('Hrm.TestResult').directive('myDatePicker', function () {
        return {
            restrict: 'A',
            require: '?ngModel',
            link: function (scope, element, attrs, ngModelController) {

                // Private variables
                var datepickerFormat = 'dd/mm/yyyy',
                    momentFormat = 'DD/MM/YYYY',
                    datepicker,
                    elPicker;

                // Init date picker and get objects http://bootstrap-datepicker.readthedocs.org/en/release/index.html
                datepicker = element.datepicker({
                    autoclose: true,
                    keyboardNavigation: false,
                    todayHighlight: true,
                    format: datepickerFormat
                });
                elPicker = datepicker.data('datepicker').picker;

                // Adjust offset on show
                datepicker.on('show', function (evt) {
                    elPicker.css('left', parseInt(elPicker.css('left')) + +attrs.offsetX);
                    elPicker.css('top', parseInt(elPicker.css('top')) + +attrs.offsetY);
                });

                // Only watch and format if ng-model is present https://docs.angularjs.org/api/ng/type/ngModel.NgModelController
                if (ngModelController) {
                    // So we can maintain time
                    var lastModelValueMoment;

                    ngModelController.$formatters.push(function (modelValue) {
                        //
                        // Date -> String
                        //

                        // Get view value (String) from model value (Date)
                        var viewValue,
                            m = moment(modelValue);
                        if (modelValue && m.isValid()) {
                            // Valid date obj in model
                            lastModelValueMoment = m.clone(); // Save date (so we can restore time later)
                            viewValue = m.format(momentFormat);
                        } else {
                            // Invalid date obj in model
                            lastModelValueMoment = undefined;
                            viewValue = undefined;
                        }

                        // Update picker
                        element.datepicker('update', viewValue);

                        // Update view
                        return viewValue;
                    });

                    ngModelController.$parsers.push(function (viewValue) {
                        //
                        // String -> Date
                        //

                        // Get model value (Date) from view value (String)
                        var modelValue,
                            m = moment(viewValue, momentFormat, true);
                        if (viewValue && m.isValid()) {
                            // Valid date string in view
                            if (lastModelValueMoment) { // Restore time
                                m.hour(lastModelValueMoment.hour());
                                m.minute(lastModelValueMoment.minute());
                                m.second(lastModelValueMoment.second());
                                m.millisecond(lastModelValueMoment.millisecond());
                            }
                            modelValue = m.toDate();
                        } else {
                            // Invalid date string in view
                            modelValue = undefined;
                        }

                        // Update model
                        return modelValue;
                    });

                    datepicker.on('changeDate', function (evt) {
                        // Only update if it's NOT an <input> (if it's an <input> the datepicker plugin trys to cast the val to a Date)
                        if (evt.target.tagName !== 'INPUT') {
                            ngModelController.$setViewValue(moment(evt.date).format(momentFormat)); // $seViewValue basically calls the $parser above so we need to pass a string date value in
                            ngModelController.$render();
                        }
                    });
                }

            }
        };
    });

    function TestResultController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, blockUI) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        function getResultQuestionType(item) {
            return item && item.questionAnswer && item.questionAnswer.question &&
                item.questionAnswer.question.parent ? item.questionAnswer.question.parent.type : null;
        }

        function addMissingResultRows(testResult) {
            var sourceRows = testResult && testResult.questionAnswerTestResult;
            if (!sourceRows || sourceRows.length < 2) {
                return testResult;
            }

            sourceRows.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });

            var rows = [];
            var previousOrdinalNumber = null;
            angular.forEach(sourceRows, function (row) {
                var ordinalNumber = Number(row.ordinalNumber);
                if (previousOrdinalNumber != null && !isNaN(ordinalNumber)) {
                    for (var missingNumber = previousOrdinalNumber + 1;
                         missingNumber < ordinalNumber; missingNumber++) {
                        rows.push({
                            ordinalNumber: missingNumber,
                            clientAnswer: '',
                            isCorrectTestResultDetail: false,
                            isMissingResultRecord: true
                        });
                    }
                }
                rows.push(row);
                if (!isNaN(ordinalNumber) &&
                    (previousOrdinalNumber == null || ordinalNumber > previousOrdinalNumber)) {
                    previousOrdinalNumber = ordinalNumber;
                }
            });

            testResult.questionAnswerTestResult = rows;
            return testResult;
        }

        vm.getResultYourAnswer = function (item) {
            if (item && item.isMissingResultRecord) {
                return 'Không có dữ liệu';
            }
            var type = getResultQuestionType(item);
            var submittedAnswer = item && item.clientAnswer != null ? String(item.clientAnswer).trim() : '';
            if (!submittedAnswer) {
                return '';
            }
            if (type == 2 || type == 3 || type == 4 || type == 8 || type == 11 || type == 16 || type == 17) {
                return submittedAnswer;
            }

            var answer = item && item.questionAnswer && item.questionAnswer.answer;
            return answer && answer.answer != null ? answer.answer :
                submittedAnswer;
        };

        vm.getResultCorrectAnswer = function (item) {
            if (item && item.isMissingResultRecord) {
                return '—';
            }
            var type = getResultQuestionType(item);
            var questionAnswer = item && item.questionAnswer;

            if (type == 16 || type == 17) {
                return type == 17 ? 'Trên 250 từ' : 'Trên 150 từ';
            }

            if (type == 5 || type == 7) {
                return String((item && item.correctAnswerForMultipleAnswer) || '')
                    .replace(/<br\s*\/?\s*>/gi, ' / ')
                    .replace(/\s*\/\s*(?:\/\s*)+/g, ' / ')
                    .replace(/^\s*\/|\/\s*$/g, '')
                    .trim();
            }
            if (type == 2 || type == 3 || type == 11) {
                return questionAnswer && questionAnswer.answer &&
                    questionAnswer.answer.answer != null ? questionAnswer.answer.answer : '';
            }

            return questionAnswer && questionAnswer.correctAnswer != null ?
                questionAnswer.correctAnswer : '';
        };

        vm.getResultQuestionLabel = function (item) {
            var type = getResultQuestionType(item);
            if (type == 16) { return 'Task 1'; }
            if (type == 17) { return 'Task 2'; }
            return item && item.ordinalNumber;
        };

        vm.testResult = {};
        vm.ieltsLearningState = {};
        vm.isRetryingWritingGrade = false;
        vm.isSavingWritingFeedback = false;

        function currentUserIsAdmin() {
            var roles = ($rootScope.currentUser && $rootScope.currentUser.roles) || [];
            return roles.some(function (role) {
                return role && role.name === 'ROLE_ADMIN';
            });
        }

        vm.canUseResultDeletion = function () {
            var roles = ($rootScope.currentUser && $rootScope.currentUser.roles) || [];
            var roleNames = {};
            angular.forEach(roles, function (role) {
                if (role && role.name) { roleNames[role.name] = true; }
            });
            if (roleNames.ROLE_ADMIN) { return true; }
            if (roleNames.ROLE_VIEWER || roleNames.ROLE_STUDENT) { return false; }
            return !!(
                roleNames.ROLE_USER ||
                roleNames.ROLE_STAFF ||
                roleNames.ROLE_STAFF_MANAGEMENT ||
                roleNames.ROLE_EDUCATION_MANAGERMENT ||
                roleNames.ROLE_STUDENT_MANAGERMENT
            );
        };

        vm.canRetryWritingGrade = function (testResult) {
            if (!testResult || Number(testResult.testType) !== 7 || !testResult.id) { return false; }
            if (['FAILED', 'NOT_CONFIGURED', 'PENDING', 'PROCESSING']
                    .indexOf(testResult.aiGradingStatus) < 0) { return false; }
            var currentUserId = $rootScope.currentUser && $rootScope.currentUser.id;
            var ownerId = testResult.user && testResult.user.id;
            return currentUserIsAdmin() || (currentUserId != null && ownerId != null
                && Number(currentUserId) === Number(ownerId));
        };

        vm.retryWritingGrade = function () {
            var resultId = vm.testResult && vm.testResult.id;
            if (vm.isRetryingWritingGrade || !vm.canRetryWritingGrade(vm.testResult)) { return; }
            vm.isRetryingWritingGrade = true;
            service.gradeWritingTestResult(resultId).then(function () {
                return service.getOne(resultId);
            }).then(function (data) {
                vm.testResult = addMissingResultRows(data);
                vm.loadIeltsLearningState(vm.testResult);
                vm.isRetryingWritingGrade = false;
                if (vm.testResult.aiGradingStatus === 'COMPLETED') {
                    toastr.success('Bài Writing đã được chấm lại bằng GPT.', 'Thông báo');
                } else {
                    toastr.warning(vm.testResult.aiGradingError
                        || 'Chưa thể chấm lại bài Writing. Vui lòng thử lại sau.', 'Thông báo');
                }
            }, function () {
                vm.isRetryingWritingGrade = false;
                toastr.error('Không thể gửi lại bài Writing để chấm.', 'Thông báo');
            });
        };

        vm.displayWritingBand = function (testResult) {
            if (!testResult) { return 'Chưa chấm'; }
            return testResult.writingTeacherBand || (testResult.aiOverallBand != null
                ? String(testResult.aiOverallBand) : 'Chưa chấm');
        };

        vm.saveWritingFeedback = function () {
            if (vm.isSavingWritingFeedback || !vm.testResult || !vm.testResult.id
                    || !vm.testResult.canEditWritingFeedback) { return; }
            vm.isSavingWritingFeedback = true;
            service.saveWritingFeedback(vm.testResult.id, {
                writingTeacherBand: vm.testResult.writingTeacherBand,
                writingTeacherFeedback: vm.testResult.writingTeacherFeedback
            }).then(function (data) {
                vm.testResult = addMissingResultRows(data);
                vm.loadIeltsLearningState(vm.testResult);
                vm.isSavingWritingFeedback = false;
                vm.getPage();
                toastr.success('Đã lưu Band và feedback cho học sinh.', 'Thông báo');
            }, function (response) {
                vm.isSavingWritingFeedback = false;
                var message = response && response.data && (response.data.message || response.data.error);
                toastr.error(message || 'Không thể lưu kết quả chấm Writing.', 'Lỗi');
            });
        };

        vm.loadIeltsLearningState = function (testResult) {
            vm.ieltsLearningState = {};
            if (!testResult || !testResult.ieltsLearningState) { return; }
            try {
                vm.ieltsLearningState = JSON.parse(testResult.ieltsLearningState) || {};
            } catch (ignoreInvalidIeltsLearningState) {
                vm.ieltsLearningState = {};
            }
        };

        vm.formatIeltsActiveDuration = function (seconds) {
            seconds = Math.max(0, Math.floor(Number(seconds) || 0));
            var hours = Math.floor(seconds / 3600);
            var minutes = Math.floor((seconds % 3600) / 60);
            var remainingSeconds = seconds % 60;
            return (hours ? hours + ' giờ ' : '') + minutes + ' phút ' + remainingSeconds + ' giây';
        };
        vm.testResults = [];
        vm.selectedTestResults = [];
        vm.searchDto = {};
        vm.searchDto.pageIndex = 1;
        vm.searchDto.pageSize = 15;
        vm.searchDto.textSearch = '';

        vm.searchDto.testType = null;
        vm.searchDto.resultGroup = 'ALL';
        vm.resultGroups = [{id: 'ALL', name: 'Tất cả'}, {id: 'VOCAB', name: 'Daily Vocab'},
            {id: 'DAILY_LISTENING', name: 'Daily Listening'}, {id: 'IELTS', name: 'IELTS Tests'},
            {id: 'WRITING', name: 'IELTS Writing'},
            {id: 'COMPREHENSIVE', name: 'Bài tập tổng hợp'},
            {id: 'BATTLE', name: 'Battle Online'}];
        vm.selectResultGroup = function (group) {
            vm.searchDto.resultGroup = group;
            vm.searchDto.testType = null;
            vm.testTypes = allTestTypes.filter(function (type) {
                return group === 'ALL' || group === 'VOCAB' && type.id === 1
                    || group === 'DAILY_LISTENING' && type.id === 3 || group === 'IELTS' && (type.id === 2 || type.id === 4)
                    || group === 'WRITING' && type.id === 7
                    || group === 'COMPREHENSIVE' && type.id === 6
                    || group === 'BATTLE' && type.id === 5;
            });
            vm.codeChange();
        };
        var allTestTypes = [
            {id: 1, name: 'Daily Vocab'}, {id: 3, name: 'Daily Listening'},
            {id: 2, name: 'IELTS Listening'}, {id: 4, name: 'IELTS Reading'},
            {id: 7, name: 'IELTS Writing'},
            {id: 6, name: 'Bài tập tổng hợp'}, {id: 5, name: 'Battle Online'}
        ];
        vm.testTypes = [
            {id: 1, name: "DAILY VOCAB", notice: ""},
            {id: 3, name: "FILLING GAPS", notice: ""}
        ];
        vm.testTypes = allTestTypes.slice();

        var date = new Date();
        vm.startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        vm.endDate = new Date();

        vm.startDate.setHours(0, 0, 0, 0);
        vm.endDate.setHours(0, 0, 0, 0);

        vm.searchDto.startDate =  Date.parse(vm.startDate);
        vm.searchDto.endDate =  Date.parse(vm.endDate);

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

        vm.getPage = function () {
            var requestId = ++resultPageRequest;
            vm.testResults = [];
            vm.selectedTestResults = [];
            if (vm.bsTableControl && vm.bsTableControl.options) {
                vm.bsTableControl.options.data = [];
                vm.bsTableControl.options.totalRows = 0;
            }
            blockUI.start();
            service.getPage(angular.copy(vm.searchDto),vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                if (requestId !== resultPageRequest) { return; }
                vm.testResults = data.content;
                vm.bsTableControl.options.columns = service.getTableDefinition(
                    vm.searchDto.resultGroup,
                    vm.canUseResultDeletion()
                );
                vm.bsTableControl.options.data = vm.testResults;
                vm.bsTableControl.options.totalRows = data.totalElements;
                console.log(vm.bsTableControl);
            }, function () {
                blockUI.stop();
                if (requestId !== resultPageRequest) { return; }
                toastr.error('Không tải được kết quả. Vui lòng thử lại.');
            });
        };

        var resultPageRequest = 0;
        vm.getPage();

        vm.rankings = [];
        vm.isRankingLoading = false;
        vm.isRankingLoaded = false;
        vm.rankingLoadError = false;
        vm.rankingRequestId = 0;

        // Mặc định đóng. Chỉ gọi API ở lần người dùng chủ động mở.
        vm.isRankingCollapsed = true;

        vm.toggleRanking = function () {
            vm.isRankingCollapsed = !vm.isRankingCollapsed;

            if (!vm.isRankingCollapsed && !vm.isRankingLoaded) {
                vm.getRanking();
            }
        };

        vm.getRanking = function () {
            var requestId = ++vm.rankingRequestId;
            vm.isRankingLoading = true;
            vm.rankingLoadError = false;

            service.getRanking(angular.copy(vm.searchDto)).then(function (data) {

                if (requestId !== vm.rankingRequestId) {
                    return;
                }

                vm.rankings = data || [];
                vm.isRankingLoaded = true;

                if (vm.rankings.length === 0) {
                    vm.isRankingLoading = false;
                    return;
                }

                var half = Math.floor(vm.rankings.length / 2);
                var rank = 1;

                // TIMES DO TEST
                if (half > 0 && vm.rankings[0]) {
                    vm.rankings[0].rank = 1;

                    for (var i = 1; i < half; i++) {
                        if (!vm.rankings[i] || !vm.rankings[i - 1]) {
                            continue;
                        }

                        if (vm.rankings[i].times < vm.rankings[i - 1].times) {
                            rank++;
                            vm.rankings[i].rank = rank;
                        } else {
                            vm.rankings[i].rank = vm.rankings[i - 1].rank;
                        }
                    }
                }

                // WORDS LEARNED
                rank = 1;

                if (half < vm.rankings.length && vm.rankings[half]) {
                    vm.rankings[half].rank = 1;

                    for (var j = half + 1; j < vm.rankings.length; j++) {
                        if (!vm.rankings[j] || !vm.rankings[j - 1]) {
                            continue;
                        }

                        if (
                            vm.rankings[j].numberOfWords <
                            vm.rankings[j - 1].numberOfWords
                        ) {
                            rank++;
                            vm.rankings[j].rank = rank;
                        } else {
                            vm.rankings[j].rank = vm.rankings[j - 1].rank;
                        }
                    }
                }

                vm.isRankingLoading = false;

            }, function () {

                if (requestId !== vm.rankingRequestId) {
                    return;
                }

                vm.rankings = [];
                vm.isRankingLoading = false;
                vm.isRankingLoaded = false;
                vm.rankingLoadError = true;

            });
        };

        vm.invalidateRanking = function () {
            vm.rankingRequestId++;
            vm.rankings = [];
            vm.isRankingLoaded = false;
            vm.isRankingLoading = false;
            vm.rankingLoadError = false;

            if (!vm.isRankingCollapsed) {
                vm.getRanking();
            }
        };

        /* =====================================================
           MONTHLY STUDY CALENDAR - LAZY LOAD
           ===================================================== */
        vm.isStudyCalendarCollapsed = true;
        vm.isStudyCalendarLoading = false;
        vm.isStudyCalendarLoaded = false;
        vm.studyCalendarLoadError = false;
        vm.studyCalendarCache = {};
        vm.studyCalendarRequestId = 0;
        vm.studyCalendarDate = new Date(date.getFullYear(), date.getMonth(), 1);
        vm.studyCalendarWeekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        vm.studyCalendarDays = [];
        vm.studyCalendarActivities = [];
        vm.studyCalendarStats = {
            activeDays: 0,
            totalTests: 0,
            bestStreak: 0
        };

        vm.getStudyCalendarOwnerName = function () {
            if (vm.searchDto.user && vm.searchDto.user.displayName) {
                return vm.searchDto.user.displayName;
            }
            if ($rootScope.currentUser && $rootScope.currentUser.displayName) {
                return $rootScope.currentUser.displayName;
            }
            return 'Bạn';
        };

        vm.getStudyCalendarKey = function () {
            var ownerId = vm.searchDto.user && vm.searchDto.user.id
                ? vm.searchDto.user.id
                : 'self';
            return ownerId + '-' + vm.searchDto.resultGroup + '-' + vm.studyCalendarDate.getFullYear()
                + '-' + (vm.studyCalendarDate.getMonth() + 1);
        };

        vm.getVietnameseWeekday = function (dateValue) {
            var labels = [
                'Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư',
                'Thứ năm', 'Thứ sáu', 'Thứ bảy'
            ];
            return labels[dateValue.getDay()];
        };

        vm.getStudyTestTypeName = function (testType) {
            if (testType === 1) {
                return 'Daily Vocab';
            }
            if (testType === 2) {
                return 'IELTS Listening';
            }
            if (testType === 3) {
                return 'Daily Listening';
            }
            if (testType === 4) {
                return 'IELTS Reading';
            }
            if (testType === 6) {
                return 'Bài tập tổng hợp';
            }
            if (testType === 7) {
                return 'IELTS Writing';
            }
            return 'Bài luyện tập';
        };

        vm.buildStudyCalendar = function (items) {
            var year = vm.studyCalendarDate.getFullYear();
            var monthIndex = vm.studyCalendarDate.getMonth();
            var numberOfDays = new Date(year, monthIndex + 1, 0).getDate();
            var leadingBlankDays = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
            var groupedTests = {};
            var calendarDays = [];
            var activities = [];
            var totalTests = 0;
            var activeDays = 0;
            var bestStreak = 0;
            var runningStreak = 0;
            var today = new Date();

            angular.forEach(items || [], function (item) {
                var resultMoment = moment(item.testDate);
                if (!resultMoment.isValid()
                    || resultMoment.year() !== year
                    || resultMoment.month() !== monthIndex) {
                    return;
                }

                var dateKey = resultMoment.format('YYYY-MM-DD');
                if (!groupedTests[dateKey]) {
                    groupedTests[dateKey] = [];
                }

                groupedTests[dateKey].push({
                    id: item.id,
                    testName: item.testName || vm.getStudyTestTypeName(item.testType),
                    topics: item.topics || [],
                    testTypeName: vm.getStudyTestTypeName(item.testType),
                    timeLabel: resultMoment.format('HH:mm')
                });
                totalTests++;
            });

            for (var blankIndex = 0; blankIndex < leadingBlankDays; blankIndex++) {
                calendarDays.push({isBlank: true});
            }

            for (var dayNumber = 1; dayNumber <= numberOfDays; dayNumber++) {
                var dayDate = new Date(year, monthIndex, dayNumber);
                var dayKey = moment(dayDate).format('YYYY-MM-DD');
                var tests = groupedTests[dayKey] || [];
                var studied = tests.length > 0;

                if (studied) {
                    activeDays++;
                    runningStreak++;
                    bestStreak = Math.max(bestStreak, runningStreak);
                } else {
                    runningStreak = 0;
                }

                calendarDays.push({
                    isBlank: false,
                    day: dayNumber,
                    dateKey: dayKey,
                    studied: studied,
                    tests: tests,
                    isToday: dayDate.getFullYear() === today.getFullYear()
                        && dayDate.getMonth() === today.getMonth()
                        && dayDate.getDate() === today.getDate(),
                    tooltip: studied
                        ? dayNumber + '/' + (monthIndex + 1) + ': ' + tests.length + ' bài đã làm'
                        : dayNumber + '/' + (monthIndex + 1) + ': chưa có bài test'
                });

                if (studied) {
                    activities.push({
                        dateKey: dayKey,
                        dateLabel: vm.getVietnameseWeekday(dayDate)
                            + ', ' + (dayNumber < 10 ? '0' : '') + dayNumber
                            + '/' + (monthIndex + 1 < 10 ? '0' : '') + (monthIndex + 1)
                            + '/' + year,
                        tests: tests
                    });
                }
            }

            while (calendarDays.length % 7 !== 0) {
                calendarDays.push({isBlank: true});
            }

            vm.studyCalendarDays = calendarDays;
            vm.studyCalendarActivities = activities.reverse();
            vm.studyCalendarStats = {
                activeDays: activeDays,
                totalTests: totalTests,
                bestStreak: bestStreak
            };
            vm.studyCalendarMonthLabel = 'THÁNG ' + (monthIndex + 1) + ' / ' + year;
            vm.studyCalendarOwnerName = vm.getStudyCalendarOwnerName();
        };

        vm.loadStudyCalendar = function (forceReload) {
            var cacheKey = vm.getStudyCalendarKey();

            if (!forceReload && vm.studyCalendarCache[cacheKey]) {
                vm.studyCalendarRequestId++;
                vm.buildStudyCalendar(vm.studyCalendarCache[cacheKey]);
                vm.isStudyCalendarLoading = false;
                vm.isStudyCalendarLoaded = true;
                vm.studyCalendarLoadError = false;
                return;
            }

            var requestId = ++vm.studyCalendarRequestId;
            var payload = {
                calendarYear: vm.studyCalendarDate.getFullYear(),
                calendarMonth: vm.studyCalendarDate.getMonth() + 1,
                resultGroup: vm.searchDto.resultGroup,
                user: vm.searchDto.user && vm.searchDto.user.id
                    ? {id: vm.searchDto.user.id}
                    : null
            };

            vm.isStudyCalendarLoading = true;
            vm.isStudyCalendarLoaded = false;
            vm.studyCalendarLoadError = false;

            service.getStudyCalendar(payload).then(function (data) {
                vm.studyCalendarCache[cacheKey] = data || [];

                if (requestId !== vm.studyCalendarRequestId
                    || cacheKey !== vm.getStudyCalendarKey()) {
                    return;
                }

                vm.buildStudyCalendar(vm.studyCalendarCache[cacheKey]);
                vm.isStudyCalendarLoading = false;
                vm.isStudyCalendarLoaded = true;
            }, function () {
                if (requestId !== vm.studyCalendarRequestId) {
                    return;
                }

                vm.isStudyCalendarLoading = false;
                vm.isStudyCalendarLoaded = false;
                vm.studyCalendarLoadError = true;
            });
        };

        vm.toggleStudyCalendar = function () {
            vm.isStudyCalendarCollapsed = !vm.isStudyCalendarCollapsed;

            if (!vm.isStudyCalendarCollapsed) {
                vm.loadStudyCalendar(false);
            }
        };

        vm.canGoToNextStudyMonth = function () {
            var currentMonth = new Date();
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);
            return vm.studyCalendarDate.getTime() < currentMonth.getTime();
        };

        vm.changeStudyCalendarMonth = function (monthOffset) {
            if (monthOffset > 0 && !vm.canGoToNextStudyMonth()) {
                return;
            }

            vm.studyCalendarDate = new Date(
                vm.studyCalendarDate.getFullYear(),
                vm.studyCalendarDate.getMonth() + monthOffset,
                1
            );
            vm.loadStudyCalendar(false);
        };


        function updateSelection(callback) {
            if ($scope.$$phase) { callback(); }
            else { $scope.$apply(callback); }
        }

        vm.bsTableControl = {
            options: {
                data: vm.testResults,
                idField: 'id',
                sortable: false,
                striped: true,
                maintainSelected: false,
                clickToSelect: false,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: vm.searchDto.pageSize,
                pageList: [5, 10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'server',
                columns: service.getTableDefinition(null, vm.canUseResultDeletion()),
                onCheck: function (row, $element) {
                    updateSelection(function () {
                        if (utils.indexOf(row, vm.selectedTestResults) < 0) {
                            vm.selectedTestResults.push(row);
                        }
                    });
                },
                onCheckAll: function (rows) {
                    updateSelection(function () {
                        vm.selectedTestResults = rows.filter(function (row) {
                            return row && row.canDelete === true;
                        });
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedTestResults);
                    if (index >= 0) {
                        updateSelection(function () {
                            vm.selectedTestResults.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    updateSelection(function () {
                        vm.selectedTestResults = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    vm.searchDto.pageSize = pageSize;
                    vm.searchDto.pageIndex = index;
                    vm.getPage();
                }
            }
        };

        /**
         * New event account
         */
        vm.newObject = function () {

            vm.testResult.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'lg'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.testResult, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.testResult = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.testResult = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.testResult = addMissingResultRows(data);
                vm.loadIeltsLearningState(vm.testResult);
                console.log(data);
                vm.testResult.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'lg'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.testResult, function success() {
                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.testResult = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.testResult = {};
                });
            });
        };

        /**
         * Delete accounts
         */
        $scope.deleteObject = function (id) {
            vm.deleteConfirmationCount = 1;
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'lg'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                   console.log(vm.selectedTestResults);
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

        vm.hasDeletableResults = function () {
            return vm.testResults.some(function (result) {
                return result && result.canDelete === true;
            });
        };

        vm.selectAllResults = function () {
            if (!vm.canUseResultDeletion() || !vm.hasDeletableResults()) { return; }
            angular.element(document.getElementById('bsTableControl')).bootstrapTable('checkAll');
        };

        vm.clearSelectedResults = function () {
            angular.element(document.getElementById('bsTableControl')).bootstrapTable('uncheckAll');
        };

        vm.deleteSelectedResults = function () {
            if (vm.isDeletingResults || !vm.selectedTestResults.length) { return; }
            var ids = vm.selectedTestResults.map(function (result) { return result.id; })
                .filter(function (id, index, values) {
                    return id != null && values.indexOf(id) === index;
                });
            if (!ids.length) { return; }

            vm.deleteConfirmationCount = ids.length;
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'lg'
            });
            modalInstance.result.then(function (confirm) {
                if (confirm !== 'yes') { return; }
                vm.isDeletingResults = true;
                service.deleteObjects(ids).then(function (deletedCount) {
                    vm.isDeletingResults = false;
                    vm.selectedTestResults = [];
                    toastr.success('Đã xóa ' + deletedCount + ' kết quả.', 'Thông báo');
                    vm.getPage();
                }, function (response) {
                    vm.isDeletingResults = false;
                    var message = response && response.data && (response.data.message || response.data.error);
                    toastr.error(message || 'Không thể xóa các kết quả đã chọn.', 'Lỗi');
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
            console.log(vm.startDate);
            console.log(vm.endDate);
            if(angular.isUndefined(vm.startDate)){
                vm.searchDto.startDate = null;
            }
            if(angular.isUndefined(vm.endDate)){
                vm.searchDto.endDate = null;
            }
            vm.searchDto.pageIndex = 1;
            vm.bsTableControl.state.pageNumber = 1;
            if(vm.startDate != null && vm.endDate != null){
                //vm.startDate = DateUtil.addDays(myDate, 1);
                vm.startDate.setHours(0, 0, 0, 0);
                vm.endDate.setHours(0, 0, 0, 0);
                vm.searchDto.startDate =  Date.parse(vm.startDate);
                vm.searchDto.endDate =  Date.parse(vm.endDate);
            }

            vm.getPage();
            vm.invalidateRanking();

            if (!vm.isStudyCalendarCollapsed) {
                vm.loadStudyCalendar(false);
            }
        };

        vm.users = [];
        vm.searchDto.user = null;
        // service.getListUsers().then(function (data) {
        //     vm.users = data;
        //     // console.log(data);
        // });

        vm.filter = {};
        vm.filter.roles = [];
        var role = {};
        role.authority = "ROLE_VIEWER";
        role.name = "ROLE_VIEWER";
        role.id = 12; // tạm thời, vì k có tgian :)
        vm.filter.roles.push(role);
        vm.filter.active = true;

        angular.forEach(vm.roles, function(value1, key1) {
            if(value1.name === "ROLE_STUDENT" || value1.name === "ROLE_STUDENT_MANAGERMENT" || value1.name === "ROLE_EDUCATION_MANAGERMENT" ){
                // vm.filter.roles = [];
                if(vm.isRoleStudentManagerment == true || vm.isRoleEducationManagerment == true){
                    vm.filter.roles.push(value1);

                }
            }
        });

        // $timeout(function () {
        //     service.getUsers(vm.filter, 1, 1000000).then(function (data) {
        //         vm.users = data.content;
        //         console.log(vm.users);
        //     });
        // }, 1000);

        vm.loadUsers = function () {
            service.getUsers(vm.filter, 1, 1000000).then(function (data) {
                vm.users = data.content || [];
            });
        };

        $timeout(function () {
            vm.loadUsers();
        }, 1000);

        vm.resultSchoolId = window.location.hostname.toLowerCase() === 'ieltsroom.com' ? 1 : 2;
        vm.enrollmentClasses = [];
        vm.enrollmentClassesLoading = false;
        vm.enrollmentClassesError = false;
        var enrollmentClassesRequest = 0;
        vm.loadEnrollmentClasses = function () {
            var request = ++enrollmentClassesRequest;
            vm.enrollmentClassesLoading = true;
            vm.enrollmentClassesError = false;
            return service.getEnrolmentClass({schoolId: vm.resultSchoolId}, 1, 1000000).then(function (data) {
                if (request !== enrollmentClassesRequest) { return; }
                vm.enrollmentClasses = (data && angular.isArray(data.content) ? data.content : []).filter(function (item) {
                    return item && Number(item.schoolId) === vm.resultSchoolId;
                });
                vm.enrollmentClassesLoading = false;
            }, function () {
                if (request !== enrollmentClassesRequest) { return; }
                vm.enrollmentClasses = [];
                vm.enrollmentClassesLoading = false;
                vm.enrollmentClassesError = true;
                toastr.error('Không tải được danh sách lớp. Hãy thử tải lại.', 'Lỗi');
            });
        };
        vm.loadEnrollmentClasses();

        vm.enrollmentClassChange = function () {

            // User đã chọn có thể thuộc lớp cũ => clear
            vm.searchDto.user = null;

            // Filter danh sách user theo lớp
            vm.filter.enrollmentClass =
                vm.searchDto.enrollmentClassId || null;

            // Load lại dropdown user
            vm.loadUsers();

            // Load TestResult + Ranking
            vm.codeChange();
        };


    }

})();
