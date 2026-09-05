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

        vm.testResult = {};
        vm.testResults = [];
        vm.selectedTestResults = [];
        vm.searchDto = {};
        vm.searchDto.pageIndex = 1;
        vm.searchDto.pageSize = 15;
        vm.searchDto.textSearch = '';

        vm.searchDto.testType = null;
        vm.testTypes = [
            {id: 1, name: "DAILY VOCAB", notice: ""},
            {id: 3, name: "FILLING GAPS", notice: ""}
        ];

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
            blockUI.start();
            service.getPage(vm.searchDto,vm.searchDto.pageIndex, vm.searchDto.pageSize).then(function (data) {
                blockUI.stop();
                vm.testResults = data.content;
                vm.bsTableControl.options.data = vm.testResults;
                vm.bsTableControl.options.totalRows = data.totalElements;
                console.log(vm.bsTableControl);
            });
        };

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
            return ownerId + '-' + vm.studyCalendarDate.getFullYear()
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
                return 'Reading';
            }
            if (testType === 3) {
                return 'Filling Gaps';
            }
            if (testType === 4) {
                return 'Listening';
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
                columns: service.getTableDefinition(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedTestResults.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedTestResults = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedTestResults.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
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
                vm.testResult = data;
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

        service.getEnrolmentClass(null, 1, 1000000).then(function (data) {
            vm.enrollmentClasses = data.content;
        });

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
