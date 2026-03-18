/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Products').controller('ProductsController', ProductsController);

    ProductsController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'ProductsService',
        'Upload',
        '$cookies'
    ];

    angular.module('Hrm.Products').directive('formatNumber', ['$filter', function ($filter) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, ctrl) {
                if (!ctrl) return;

                // 1. Format từ model (số) -> view (có dấu phẩy)
                ctrl.$formatters.push(function (data) {
                    return $filter('number')(data);
                });

                // 2. Parse từ view (có dấu phẩy) -> model (số thuần)
                ctrl.$parsers.push(function (data) {
                    if (!data) return '';

                    // Loại bỏ tất cả ký tự không phải số (giữ lại dấu chấm thập phân nếu cần)
                    var plainNumber = data.replace(/[^\d|\.]/g, '');

                    // Định dạng lại hiển thị trên input
                    var formattedNumber = $filter('number')(plainNumber);
                    if (formattedNumber !== data) {
                        ctrl.$setViewValue(formattedNumber);
                        ctrl.$render();
                    }
                    return plainNumber;
                });
            }
        };
    }]);

    angular.module('Hrm.Products').directive('numberInput', function ($filter) {
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

                    if (typeof val === 'undefined') {
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

    angular.module('Hrm.Products').directive('numbersOnly', function () {
        return {
            require: 'ngModel',
            link: function (scope, element, attr, ngModelCtrl) {
                function fromUser(text) {
                    if (text) {
                        var transformedInput = text.replace(/[^0-9]/g, '');
                        if (transformedInput !== text) {
                            ngModelCtrl.$setViewValue(transformedInput);
                            ngModelCtrl.$render();
                        }
                        return transformedInput;
                    }
                    return undefined;
                }
                ngModelCtrl.$parsers.push(fromUser);
            }
        };
    });

    angular.module('Hrm.Products').directive('myDatePicker', function () {
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

    angular.module('Hrm.Products').directive('fileDownload',function(){
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

    angular.module('Hrm.Products').filter('removeHTMLTags', function() {

        return function(text) {

            return  text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function ProductsController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload, $cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;
        var vm = this;

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        vm.myUser = {};
        vm.myUser.id = vm.currentUser.id;
        // vm.myUser.username = vm.currentUser.username;
        vm.myUser.name = vm.currentUser.displayName;
        vm.myUser.roles = vm.currentUser.roles;
        vm.isRoleView = false;
        vm.isRoleUser = false;
        vm.isRoleAdmin = false;
        vm.isRoleStaff = false;
        vm.isRoleStaffManagement = false;
        angular.forEach(vm.myUser.roles, function(value, key) {
            if(value.name === "ROLE_VIEWER"){
                vm.isRoleView = true;
            }
            if(value.name === "ROLE_USER"){
                vm.isRoleUser = true;
                console.log('User');
            }
            if(value.name === "ROLE_ADMIN"){
                vm.isRoleAdmin = true;
                console.log('Admin');
            }
            if(value.name === "ROLE_STAFF"){
                vm.isRoleStaff = true;
                console.log('Staff');
            }
            if(value.name === "ROLE_STAFF_MANAGEMENT"){
                vm.isRoleStaffManagement = true;
                console.log('Staff');
            }
        });

        vm.selectedProductss = [];
        vm.pageIndex = 1;
        vm.pageSize = 25;
        vm.searchDto = {};
        
        vm.productTypes = [
            {id: 1, name: 'duet'},
            {id: 2, name: 'jibitz'},
            {id: 3, name: 'band'},
            {id: 4, name: 'dép nike'},
            {id: 5, name: 'Balo'},
            {id: 6, name: 'Giày'}
        ];


        vm.actions = [
            {id: 1, name: 'NHẬP'},
            {id: 2, name: 'XUẤT'}
        ];
        vm.action = {};
        vm.action.id = 1;

        vm.billExchangeMoney = [
            {id: 1, name: 'CHƯA OK'},
            {id: 2, name: 'ĐÃ OK'}
        ];


        vm.categories = [
            // {id: null, name: 'TẤT CẢ'},
            {id: 1, name: 'ÁO MÙA HÈ'},
            {id: 2, name: 'TÚI'},
            {id: 3, name: 'SÁCH'},
            {id: 4, name: 'ỦNG HỘ'},
            {id: 5, name: 'ÁO MÙA ĐÔNG'},
            {id: 6, name: 'KHĂN'},
            {id: 7, name: 'MÁC'},

        ];
        vm.category = {};
        vm.category.id = 1;

        //list product
        vm.product = {};
        vm.products = [];
        vm.searchProduct = {};
        vm.searchProduct.pageIndex = 1;
        vm.searchProduct.pageSize = 100000;
        // vm.searchProduct.category = null;

        vm.getPageProduct = function (category) {

            if(category == 0 ) {
                vm.searchProduct.category = null;
            }else{
                vm.searchProduct.category = category;
            }



            service.getPage(vm.searchProduct,vm.searchProduct.pageIndex, vm.searchProduct.pageSize).then(function (data) {
                vm.products = data.content;
                if(vm.products != null){
                    if(category == 4 || category == 7) {
                        vm.addProduct(vm.products[0]);
                    }
                }
                console.log(data.content);
            });

        };

        vm.getPageProductCategoryChange = function () {
            // if(vm.searchProduct.category == 0){
            //     vm.searchProduct.category = null;
            // }
            service.getPage(vm.searchProduct,vm.searchProduct.pageIndex, vm.searchProduct.pageSize).then(function (data) {
                vm.products = data.content;
            });
        };

        vm.showForStaff = false;
        vm.getPageProductModal = function (category) {
            vm.showForStaff = true;
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'list_product_modal.html',
                scope: $scope,
                size: 'lg'
            });

            if(category == 0 ) {
                vm.searchProduct.category = null;
            }else{
                vm.searchProduct.category = category;
            }

            vm.getPageProduct(category);

            modalInstance.result.then(function (confirm) {

            }, function () {
                vm.showForStaff = false;
            });
        };


        vm.detailBill = {};
        vm.seeDetailBill = function (bill) {
            service.getOneBill(bill.id).then(function (data) {
                // vm.detailBill = data;
                vm.bill = data;
                console.log(data);
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'detail_bill_modal.html',
                    scope: $scope,
                    size: 'lg'
                });

                modalInstance.result.then(function (confirm) {

                }, function () {
                    // vm.bill = {};
                    vm.resetBill();
                });
            });
        };
        // vm.seeDetailBill();
        vm.getPageProduct();

        //list bill
        var date = new Date();
        vm.startDate = new Date();
        vm.endDate = new Date();

        vm.startDate.setHours(0, 0, 0, 0);
        vm.endDate.setHours(0, 0, 0, 0);

        vm.setDateForBills = function () {
            if(vm.startDate != null && vm.endDate != null){
                //vm.startDate = DateUtil.addDays(myDate, 1);
                vm.startDate.setHours(0, 0, 0, 0);
                vm.endDate.setHours(0, 0, 0, 0);
                vm.searchBill.startDate =  Date.parse(vm.startDate);
                vm.searchBill.endDate =  Date.parse(vm.endDate);
            }
        };

        vm.statistics = function () {
            // console.log(vm.startDate);
            // console.log(vm.endDate);
            if(angular.isUndefined(vm.startDate)){
                vm.searchBill.startDate = null;
            }
            if(angular.isUndefined(vm.endDate)){
                vm.searchBill.endDate = null;
            }
            // vm.searchDto.pageIndex = 1;
            // vm.bsTableControl.state.pageNumber = 1;
            // if(vm.startDate != null && vm.endDate != null){
            //     //vm.startDate = DateUtil.addDays(myDate, 1);
            //     vm.startDate.setHours(0, 0, 0, 0);
            //     vm.endDate.setHours(0, 0, 0, 0);
            //     vm.searchBill.startDate =  Date.parse(vm.startDate);
            //     vm.searchBill.endDate =  Date.parse(vm.endDate);
            // }

            vm.setDateForBills();
            vm.getStatistics();
            vm.getPageBills();
            // vm.getRanking();
        };

        vm.users = [];
        vm.searchDto.user = null;
        service.getListUsers().then(function (data) {
            vm.users = data;
            console.log(data);
        });

        vm.bills = [];
        vm.resetBill = function () {
            vm.bill = {};
            vm.bill.paymentMethod = 1;
            vm.bill.billProduct = [];
            vm.bill.voided = false;
            vm.bill.user = vm.currentUser;
        };
        vm.resetBill();
        vm.searchBill = {};
        vm.searchBill.pageIndex = 1;
        vm.searchBill.pageSize = 1000000;
        vm.voideds = [
            {id: true, name: "ĐƠN HỦY"},
            {id: false, name: "ĐƠN OK"},
        ];

        vm.getPageBills = function () {
            vm.setDateForBills();
            service.getPageBills(vm.searchBill,vm.searchBill.pageIndex, vm.searchBill.pageSize).then(function (data) {
                vm.bills = data.content;
                console.log(data.content);
                // vm.bsTableControl.options.data = vm.products;
                // vm.bsTableControl.options.totalRows = data.totalElements;
            });
        };
        vm.getPageBills();

        
        vm.statistic = {};
        vm.showDetailStatistic = false;
        vm.getStatistics = function () {
            service.getStatistics(vm.searchBill).then(function (data) {
                vm.statistic = data;
                console.log(data);
                // vm.bsTableControl.options.data = vm.products;
                // vm.bsTableControl.options.totalRows = data.totalElements;
            });
        };
        vm.getPageBills();
        
        vm.bsTableControl = {
            options: {
                data: vm.products,
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
                        vm.selectedProductss.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedProductss = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedProductss.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedProductss = [];
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

            vm.product.isNew = true;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.product, function success() {
                        vm.getPageProduct();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.product = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.product = {};
            });
        };

        /**
         * Edit a account
         */

        vm.editObject = function (id) {
            vm.addedQuantity = 0;
            service.getOne(id).then(function (data) {
                vm.product = data;
                vm.product.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.product, function success() {
                            vm.getPageProduct();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.product = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.product = {};
                });
            });
        };

        vm.saveObjectForStaffManagement = function (product) {
            service.saveObject(product, function success() {
                vm.getPageProduct(vm.searchProduct.category);
                toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                vm.product = {};
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
            });
        };
        
        vm.addedQuantity = 0;
        // vm.firstQuantity = 0;
        vm.addQuantity = function (quantity) {
            // var number = quantity;
            vm.product.quantity = quantity + vm.addedQuantity;
        };


        vm.methods = [
            {id: 1, name: 'CHUYỂN KHOẢN'},
            {id: 2, name: 'TIỀN MẶT'}
        ];
        vm.method = {};
        vm.method.id = 1;
        
        function outOfStock(quantityProduct,quantityBill) {
            if(quantityProduct === quantityBill) return true;
            return false;
        }
        
        vm.addProduct = function (item) {
            var x = false;
            angular.forEach(vm.bill.billProduct, function(value, key) {
                if(value.product.id == item.id){ //có cái thêm mới
                    if(!outOfStock(value.product.firstQuantity, value.quantity)) {
                        if(value.product.category != 4){
                            value.quantity = value.quantity + 1;
                            value.totalAmount = value.quantity * value.product.secondPrice;
                            item.quantity = item.quantity - 1;
                            toastr.success('OK nha.', 'Thông báo');
                        }
                    }else if(value.product.category == 4) {
                        toastr.warning('Ủng hộ thì không thêm số lượng, chỉ điều thành tiền thôi', 'Thông báo');
                    }else {
                        toastr.warning('Số lượng không được lớn hơn số tồn', 'Thông báo');
                    }
                    x = true;
                }
            });
            
            if(!x){
                var billProduct = {};
                if(billProduct.quantity == null){
                    billProduct.quantity = 0;
                }

                if(!outOfStock(item.firstQuantity, billProduct.quantity)){
                    billProduct.product = item;
                    billProduct.quantity = billProduct.quantity + 1;
                    billProduct.totalAmount = item.secondPrice*billProduct.quantity;
                    vm.bill.billProduct.push(billProduct);
                    toastr.success('OK nha.', 'Thông báo');

                    item.quantity = item.quantity - 1;

                    console.log(vm.bill.billProduct);
                } else if (item.category == 4) {
                    billProduct.product = item;
                    // billProduct.quantity = billProduct.quantity + 1;
                    // billProduct.totalAmount = item.secondPrice*billProduct.quantity;
                    vm.bill.billProduct.push(billProduct);
                    toastr.success('OK nha.', 'Thông báo');

                    // item.quantity = item.quantity - 1;

                    console.log(vm.bill.billProduct);
                }else {
                    toastr.warning('Số lượng không được lớn hơn số tồn', 'Thông báo');
                }

            }

            vm.calBillAmount();

        };

        vm.deleteProduct = function (index,billProduct) {
            vm.bill.billProduct.splice(index,1);
            // vm.quantityChange(billProduct, billProduct.product);

            angular.forEach(vm.products, function(value, key) {
                if(value.id == billProduct.product.id){
                    value.quantity = value.firstQuantity;
                    // value.quantity = value.quantity - billProduct.quantity;
                }
            });

            vm.calBillAmount();
        };

        vm.calBillAmount = function () {
            vm.bill.totalAmount = 0;
            angular.forEach(vm.bill.billProduct, function(value, key) {
                vm.bill.totalAmount = vm.bill.totalAmount + value.totalAmount;
            });
        };

        vm.quantityChange = function (billProduct,product) {
            if(billProduct.quantity > product.firstQuantity){
                billProduct.quantity = product.firstQuantity;
                toastr.warning('Số lượng không được lớn hơn số tồn', 'Thông báo');
            }
            if(billProduct.quantity <= 0 || billProduct == null || angular.isUndefined(billProduct.quantity)){
                billProduct.quantity = 0;
            }

            angular.forEach(vm.products, function(value, key) {
                if(value.id == product.id){
                    value.quantity = value.firstQuantity;
                    value.quantity = value.quantity - billProduct.quantity;
                }
            });

            billProduct.totalAmount = billProduct.quantity * product.secondPrice;
            vm.calBillAmount();

        };

        vm.totalAmountChange = function () {
            vm.calBillAmount();
        };

        vm.saveBill = function () {
            if(vm.bill.billProduct.length <= 0){
                toastr.warning('Hãy thêm sản phẩm', 'Thông báo');
                return;
            }
            service.saveBill(vm.bill, function success() {
                vm.getPageBills();
                vm.getPageProduct();
                vm.resetBill();
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                // vm.importedBill = {};
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        vm.updateStatusExchange = function (bill) {
            // if(vm.bill.billProduct.length <= 0){
            //     toastr.warning('Hãy thêm sản phẩm', 'Thông báo');
            //     return;
            // }
            service.saveBill(bill, function success() {
                vm.getPageBills();
                vm.getPageProduct();
                vm.resetBill();
                toastr.info('Đổi trạng thái thành công.', 'Thông báo');
                // vm.importedBill = {};
            }, function failure() {
                toastr.error('Có lỗi xảy ra.', 'Thông báo');
            });
        };
        
        vm.deleteBill = function (bill) {
            bill.voided = true;
            service.saveBillForManager(bill, function success() {
                toastr.info('Sửa đơn thành công', 'Thông báo');
                vm.getPageBills();
                vm.getPageProduct();
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
            });
        };

        /**
         * Delete accounts
         */
        vm.deleteObject = function (id) {
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                	console.log(vm.selectedProductss);
                    service.deleteObject(id, function success() {
                        toastr.info('Bạn đã xóa thành công', 'Thông báo');
                        vm.getPageProduct();
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi xóa bản ghi.', 'Lỗi');
                    });
                }
            }, function () {
            });
        };

        vm.deleteImportedBill = function (id) {
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_bill_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    // console.log(vm.selectedProductss);
                    service.deleteBill(id, function success() {
                        toastr.info('Bạn đã xóa thành công', 'Thông báo');
                        vm.getPageImportedBills();
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

        $scope.blockSpecialChars = function (event) {
            var key = event.key;
            var keyCode = event.keyCode || event.which;

            // ❌ Chặn các ký tự không mong muốn
            if (
                key === '-' ||
                key === '+' ||
                key === 'e' ||
                key === 'E' ||
                key === '.'
            ) {
                event.preventDefault();
                return false;
            }

            // ✅ Cho phép: số 0-9
            if (keyCode >= 48 && keyCode <= 57) return true;      // số hàng trên
            if (keyCode >= 96 && keyCode <= 105) return true;     // numpad

            // ✅ Cho phép các phím điều khiển
            switch (keyCode) {
                case 8:   // backspace
                case 9:   // tab
                case 13:  // enter
                case 27:  // esc
                case 37:  // left
                case 38:  // up
                case 39:  // right
                case 40:  // down
                case 46:  // delete
                    return true;
            }

            // ❌ Còn lại chặn hết
            event.preventDefault();
            return false;
        };


        var vm = this;
        vm.scanning = false;
        vm.status = "Idle";

        var html5QrCode = null;

        function updateStatus(msg) {
            vm.status = msg;
            $scope.$applyAsync();
        }

        vm.start = function () {

            // Must be HTTPS for iPhone Safari
            if (!window.isSecureContext) {
                alert("Camera requires HTTPS.");
                updateStatus("Blocked: Not HTTPS.");
                return;
            }

            // Check library loaded
            if (!window.Html5Qrcode) {
                alert("QR library failed to load.");
                updateStatus("Library not loaded.");
                return;
            }

            vm.scanning = true;
            updateStatus("Starting camera...");

            html5QrCode = new Html5Qrcode("reader");

            html5QrCode.start(
                { facingMode: "environment" }, // use back camera
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                function (decodedText) {
                    alert("hehe"+decodedText);
                    vm.stop();
                }
            ).then(function () {
                updateStatus("Camera started. Point at QR code.");
            }).catch(function (err) {
                vm.scanning = false;
                updateStatus("Camera failed: " + err);
                alert("Camera failed: " + err);
            });
        };

        vm.stop = function () {
            if (!html5QrCode || !vm.scanning) return;

            updateStatus("Stopping camera...");

            html5QrCode.stop()
                .then(function () {
                    return html5QrCode.clear();
                })
                .finally(function () {
                    vm.scanning = false;
                    updateStatus("Stopped.");
                    $scope.$applyAsync();
                });
        };

        $scope.$on("$destroy", function () {
            if (vm.scanning) vm.stop();
        });
                
    }

})();