/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Body').controller('BodyController', BodyController);

    BodyController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'BodyService'
    ];

    function BodyController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.body = {};
        vm.bodys = [];
        vm.selectedBodys = [];
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

        vm.getPage = function () {
            service.getPage(vm.searchDto,vm.pageIndex, vm.pageSize).then(function (data) {
                vm.bodys = data.content;
                vm.bsTableControl.options.data = vm.bodys;
                vm.bsTableControl.options.totalRows = data.totalElements;
            });
        };

        vm.getPage();

        vm.enterSearchCode = function(){
            console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.pageIndex = 1;
                vm.searchChange();
            }
        }
        vm.searchChange=function () {
            vm.pageIndex = 1;
            vm.getPage();
        }

        vm.bsTableControl = {
            options: {
                data: vm.bodys,
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
                        vm.selectedBodys.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedBodys.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = [];
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
         * New event account
         */
        vm.newObject = function () {

            vm.body.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.body, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.body = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.body = {};
            });
        };

        /**
         * New event account
         */
        vm.newObjectType2 = function () {

            vm.body.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_type2_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveListObject(vm.body, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.body = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.body = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.body = data;
                vm.body.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.body, function success() {
                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.body = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.body = {};
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
                	console.log(vm.selectedBodys);
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
    }

})();