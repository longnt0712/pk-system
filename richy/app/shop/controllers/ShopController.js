/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Shop').controller('ShopController', ShopController);

    ShopController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'ShopService',
        'Upload'
    ];

    angular.module('Hrm.Shop').directive('fileDownload',function(){
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

    angular.module('Hrm.Shop').filter('removeHTMLTags', function() {

        return function(text) {

            return  text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function ShopController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;
        var vm = this;

        vm.shop = {};
        vm.shops = [];
        vm.selectedShops = [];
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

        vm.test = '';
        vm.testFunction = function() {
            service.test(vm.test, function success() {
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.shop = {};
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        vm.getPage = function () {
            service.getPage(vm.searchDto,vm.pageIndex, vm.pageSize).then(function (data) {
                vm.shops = data.content;
                vm.bsTableControl.options.data = vm.shops;
                vm.bsTableControl.options.totalRows = data.totalElements;
            });
        };

        vm.getPage();

        vm.bsTableControl = {
            options: {
                data: vm.shops,
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
                        vm.selectedShops.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedShops = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedShops.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedShops = [];
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

            vm.shop.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.shop, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.shop = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.shop = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.shop = data;
                vm.shop.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.shop, function success() {
                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.shop = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.shop = {};
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
                	console.log(vm.selectedShops);
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