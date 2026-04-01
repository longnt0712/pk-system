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
        vm.getRanking = function () {
            service.getRanking(vm.searchDto).then(function (data) {
                vm.rankings = data;
                var rank = 1;
                vm.rankings[0].rank = 1;
                // console.log(vm.rankings.length);
                for(var i = 1; i < vm.rankings.length/2; i++){
                    if(vm.rankings[i].times < vm.rankings[i-1].times){
                        rank = rank + 1;
                        vm.rankings[i].rank = rank;
                    } else {
                        vm.rankings[i].rank = vm.rankings[i-1].rank;
                    }

                }

                rank = 1;
                vm.rankings[vm.rankings.length/2].rank = 1;
                for(var i = vm.rankings.length/2+1; i < vm.rankings.length; i++){
                    if(vm.rankings[i].numberOfWords < vm.rankings[i-1].numberOfWords){
                        rank = rank + 1;
                        vm.rankings[i].rank = rank;
                    } else {
                        vm.rankings[i].rank = vm.rankings[i-1].rank;
                    }

                }
                
                console.log(vm.rankings);
            });
        };

        vm.getRanking();


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
            vm.getRanking();
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

        angular.forEach(vm.roles, function(value1, key1) {
            if(value1.name === "ROLE_STUDENT" || value1.name === "ROLE_STUDENT_MANAGERMENT" || value1.name === "ROLE_EDUCATION_MANAGERMENT" ){
                // vm.filter.roles = [];
                if(vm.isRoleStudentManagerment == true || vm.isRoleEducationManagerment == true){
                    vm.filter.roles.push(value1);

                }
            }
        });

        $timeout(function () {
            service.getUsers(vm.filter, 1, 1000000).then(function (data) {
                vm.users = data.content;
                console.log(vm.users);
            });
        }, 1000);


    }

})();