/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('StatisticUserController', StatisticUserController);

    StatisticUserController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'QuestionService',
        '$filter'
    ];

    function StatisticUserController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service,$filter) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.statisticUser = {};
        vm.statisticUsers = [];
        vm.selectedStatisticUsers = [];
        vm.pageIndex = 1;
        vm.pageSize = 25;
        vm.searchDto = {};

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

        vm.getStatisticQuestionUser = function () {
            service.getStatisticQuestionUser(vm.searchDto,vm.pageIndex, vm.pageSize).then(function (data) {
                vm.statisticUsers = data.content;
                vm.bsTableControl.options.data = vm.statisticUsers;
                vm.bsTableControl.options.totalRows = data.totalElements;

                // vm.statisticUsers = $filter('orderBy')(vm.statisticUsers,'numberOfWords', true);
                console.log(vm.statisticUsers);
            });
        };

        vm.getStatisticQuestionUser();

        vm.bsTableControl = {
            options: {
                data: vm.statisticUsers,
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
                columns: service.getTableDefinitionStatisticUser(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedStatisticUsers.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedStatisticUsers = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedStatisticUsers.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedStatisticUsers = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    vm.pageSize = pageSize;
                    vm.pageIndex = index;
                    vm.getStatisticQuestionUser();
                }
            }
        };

        /**
         * New event account
         */
        vm.newObject = function () {

            vm.statisticUser.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.statisticUser, function success() {
                        vm.getStatisticQuestionUser();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.statisticUser = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.statisticUser = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.statisticUser = data;
                vm.statisticUser.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.statisticUser, function success() {
                            vm.getStatisticQuestionUser();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.statisticUser = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.statisticUser = {};
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
                	console.log(vm.selectedStatisticUsers);
                    service.deleteObject(id, function success() {
                        toastr.info('Bạn đã xóa thành công', 'Thông báo');
                        vm.getStatisticQuestionUser();
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
                    });
                }
            }, function () {
            });
        };
    }

})();