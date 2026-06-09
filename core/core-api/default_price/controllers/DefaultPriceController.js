/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.DefaultPrice').controller('DefaultPriceController', DefaultPriceController);

    DefaultPriceController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'DefaultPriceService',
        'Upload'
    ];

    angular.module('Hrm.DefaultPrice').directive('myDatePicker', function () {
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

    angular.module('Hrm.DefaultPrice').directive('numberInput', function ($filter) {
        return {
            require: 'ngModel',
            link: function (scope, elem, attrs, ngModelCtrl) {

                ngModelCtrl.$formatters.push(function (modelValue) {
                    return setDisplayNumber(modelValue, true);
                });

                // it's best to change the displayed text using elem.val() rather than
                // ngModelCtrl.$setViewValue because the latter will re-trigger the parser
                // and not necessarily in the correct order with the changed value last.
                // see http://radify.io/blog/understanding-ngmodelcontroller-by-example-part-1/
                // for an explanation of how ngModelCtrl works.
                ngModelCtrl.$parsers.push(function (viewValue) {
                    setDisplayNumber(viewValue);
                    return setModelNumber(viewValue);
                });

                // occasionally the parser chain doesn't run (when the user repeatedly
                // types the same non-numeric character)
                // for these cases, clean up again half a second later using "keyup"
                // (the parser runs much sooner than keyup, so it's better UX to also do it within parser
                // to give the feeling that the comma is added as they type)
                elem.bind('keyup focus', function () {
                    setDisplayNumber(elem.val());
                });

                function setDisplayNumber(val, formatter) {
                    var valStr, displayValue;

                    if (typeof val === 'undefined' || val === null) {
                        return 0;
                    }

                    valStr = val.toString();

                    displayValue = valStr.replace(/,/g, '').replace(/[A-Za-z]/g, '');
                    displayValue = parseFloat(displayValue);
                    displayValue = (!isNaN(displayValue)) ? displayValue.toString() : '';

                    // handle leading character -/0
                    if (valStr.length === 1 && valStr[0] === '-') {
                        displayValue = valStr[0];
                    } else if (valStr.length === 1 && valStr[0] === '0') {
                        displayValue = '';
                    } else {
                        displayValue = $filter('number')(displayValue);
                    }

                    // handle decimal
                    if (!attrs.integer) {
                        if (displayValue.indexOf('.') === -1) {
                            if (valStr.slice(-1) === '.') {
                                displayValue += '.';
                            } else if (valStr.slice(-2) === '.0') {
                                displayValue += '.0';
                            } else if (valStr.slice(-3) === '.00') {
                                displayValue += '.00';
                            }
                        } // handle last character 0 after decimal and another number
                        else {
                            if (valStr.slice(-1) === '0') {
                                displayValue += '0';
                            }
                        }
                    }

                    if (attrs.positive && displayValue[0] === '-') {
                        displayValue = displayValue.substring(1);
                    }

                    if (typeof formatter !== 'undefined') {
                        return (displayValue === '') ? 0 : displayValue;
                    } else {
                        elem.val((displayValue === '0') ? '' : displayValue);
                    }
                }

                function setModelNumber(val) {
                    var modelNum = val.toString().replace(/,/g, '').replace(/[A-Za-z]/g, '');
                    modelNum = parseFloat(modelNum);
                    modelNum = (!isNaN(modelNum)) ? modelNum : 0;
                    if (modelNum.toString().indexOf('.') !== -1) {
                        modelNum = Math.round((modelNum + 0.00001) * 100) / 100;
                    }
                    if (attrs.positive) {
                        modelNum = Math.abs(modelNum);
                    }
                    return modelNum;
                }
            }
        };
    });

    // angular.module('Hrm.DefaultPrice').directive('fileDownload',function(){
    //     return{
    //         restrict:'A',
    //         scope:{
    //             fileDownload:'=',
    //             fileName:'=',
    //         },
    //
    //         link:function(scope,elem,atrs){
    //
    //
    //             scope.$watch('fileDownload',function(newValue, oldValue){
    //
    //                 if(newValue!=undefined && newValue!=null){
    //                     console.debug('Downloading a new file');
    //                     var isFirefox = typeof InstallTrigger !== 'undefined';
    //                     var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    //                     var isIE = /*@cc_on!@*/false || !!document.documentMode;
    //                     var isEdge = !isIE && !!window.StyleMedia;
    //                     var isChrome = !!window.chrome && !!window.chrome.webstore || window.chrome!=null;;
    //                     var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    //                     var isBlink = (isChrome || isOpera) && !!window.CSS;
    //
    //                     if(isFirefox || isIE || isChrome){
    //                         if(isChrome){
    //                             console.log('Manage Google Chrome download');
    //                             var url = window.URL || window.webkitURL;
    //                             var fileURL = url.createObjectURL(scope.fileDownload);
    //                             var downloadLink = angular.element('<a></a>');//create a new  <a> tag element
    //                             downloadLink.attr('href',fileURL);
    //                             downloadLink.attr('download',scope.fileName);
    //                             downloadLink.attr('target','_self');
    //                             downloadLink[0].click();//call click function
    //                             url.revokeObjectURL(fileURL);//revoke the object from URL
    //                         }
    //                         if(isIE){
    //                             console.log('Manage IE download>10');
    //                             window.navigator.msSaveOrOpenBlob(scope.fileDownload,scope.fileName);
    //                         }
    //                         if(isFirefox){
    //                             console.log('Manage Mozilla Firefox download');
    //                             var url = window.URL || window.webkitURL;
    //                             var fileURL = url.createObjectURL(scope.fileDownload);
    //                             var a=elem[0];//recover the <a> tag from directive
    //                             a.href=fileURL;
    //                             a.download=scope.fileName;
    //                             a.target='_self';
    //                             a.click();//we call click function
    //                         }
    //
    //
    //                     }else{
    //                         alert('SORRY YOUR BROWSER IS NOT COMPATIBLE');
    //                     }
    //                 }
    //             });
    //
    //         }
    //     }
    // });

    angular.module('Hrm.DefaultPrice').filter('removeHTMLTags', function() {

        return function(text) {

            return  text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function DefaultPriceController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;
        var vm = this;

        vm.defaultPrice = {};
        vm.defaultPrices = [];
        vm.selectedDefaultPrices = [];
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
                vm.defaultPrices = data.content;
                vm.bsTableControl.options.data = vm.defaultPrices;
                vm.bsTableControl.options.totalRows = data.totalElements;
            });
        };

        vm.getPage();

        vm.bsTableControl = {
            options: {
                data: vm.defaultPrices,
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
                        vm.selectedDefaultPrices.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedDefaultPrices = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedDefaultPrices.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedDefaultPrices = [];
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

            vm.defaultPrice.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.defaultPrice, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.defaultPrice = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.defaultPrice = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.defaultPrice = data;
                vm.defaultPrice.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.defaultPrice, function success() {
                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.defaultPrice = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.defaultPrice = {};
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
                	console.log(vm.selectedDefaultPrices);
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
        // $scope.MAX_FILE_SIZE = '2MB';
        // $scope.f = null;
        // $scope.errFile = null;
        // vm.baseUrl = settings.api.baseUrl + settings.api.apiPrefix;
        //
        // $scope.uploadFiles = function(file, errFiles) {
        //     $scope.f = file;
        //     $scope.errFile = errFiles && errFiles[0];
        // };
        //
        // vm.startUploadFile = function(file) {
        //     // console.log(file);
        //     if (file) {
        //         file.upload = Upload.upload({
        //             url: vm.baseUrl + 'file/import_bill/',
        //             data: {uploadfile: file}
        //         });
        //
        //         file.upload.then(function (response) {
        //             // console.log(response);
        //             file.result = response.data;
        //             // getListSubject(vm.pageIndex,vm.pageSize);
        //             toastr.info('Import thành công.', 'Thông báo');
        //         },function errorCallback(response) {
        //             toastr.error('Import lỗi.', 'Lỗi');
        //         });
        //     }
        // };
        //
        // vm.importBills = function () {
        //     var modalInstance = modal.open({
        //         animation: true,
        //         templateUrl: 'import_modal.html',
        //         scope: $scope,
        //         size: 'md'
        //     });
        //
        //     vm.student = {};
        //     $scope.f = null;
        //     $scope.errFile = null;
        //
        //     modalInstance.result.then(function (confirm) {
        //         if (confirm == 'yes') {
        //             vm.startUploadFile($scope.f);
        //             // console.log($scope.f);
        //         }
        //     }, function () {
        //         vm.educationProgram = null;
        //         vm.address = {};
        //         // console.log("cancel");
        //     });
        // }

        // $scope.myBlobObject=undefined;
        // $scope.getFile=function(){
        //     console.log('download started, you can show a wating animation');
        //     service.getStream()
        //         .then(function(data){//is important that the data was returned as Aray Buffer
        //             console.log('Stream download complete, stop animation!');
        //             $scope.myBlobObject=new Blob([data],{ type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        //         },function(fail){
        //             console.log('Download Error, stop animation and show error message');
        //             $scope.myBlobObject=[];
        //         });
        // };

    }

})();