/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.VoucherCrocs').controller('VoucherCrocsController', VoucherCrocsController);

    VoucherCrocsController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'VoucherCrocsService',
        'Upload'
    ];

    angular.module('Hrm.VoucherCrocs').directive('numberInput', function ($filter) {
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

    angular.module('Hrm.VoucherCrocs').directive('myDatePicker', function () {
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

    angular.module('Hrm.VoucherCrocs').directive('fileDownload', function () {
        return {
            restrict: 'A',
            scope: {
                fileDownload: '=',
                fileName: '=',
            },

            link: function (scope, elem, atrs) {


                scope.$watch('fileDownload', function (newValue, oldValue) {

                    if (newValue != undefined && newValue != null) {
                        console.debug('Downloading a new file');
                        var isFirefox = typeof InstallTrigger !== 'undefined';
                        var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
                        var isIE = /*@cc_on!@*/false || !!document.documentMode;
                        var isEdge = !isIE && !!window.StyleMedia;
                        var isChrome = !!window.chrome && !!window.chrome.webstore || window.chrome != null;
                        ;
                        var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
                        var isBlink = (isChrome || isOpera) && !!window.CSS;

                        if (isFirefox || isIE || isChrome) {
                            if (isChrome) {
                                console.log('Manage Google Chrome download');
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var downloadLink = angular.element('<a></a>');//create a new  <a> tag element
                                downloadLink.attr('href', fileURL);
                                downloadLink.attr('download', scope.fileName);
                                downloadLink.attr('target', '_self');
                                downloadLink[0].click();//call click function
                                url.revokeObjectURL(fileURL);//revoke the object from URL
                            }
                            if (isIE) {
                                console.log('Manage IE download>10');
                                window.navigator.msSaveOrOpenBlob(scope.fileDownload, scope.fileName);
                            }
                            if (isFirefox) {
                                console.log('Manage Mozilla Firefox download');
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var a = elem[0];//recover the <a> tag from directive
                                a.href = fileURL;
                                a.download = scope.fileName;
                                a.target = '_self';
                                a.click();//we call click function
                            }


                        } else {
                            alert('SORRY YOUR BROWSER IS NOT COMPATIBLE');
                        }
                    }
                });

            }
        }
    });

    angular.module('Hrm.VoucherCrocs').filter('removeHTMLTags', function () {

        return function (text) {

            return text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function VoucherCrocsController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;
        var vm = this;

        vm.voucherCrocs = {};
        vm.voucherCrocss = [];
        vm.selectedVoucherCrocss = [];
        vm.pageIndex = 1;
        vm.pageSize = 25;

        vm.searchDto = {};
        vm.searchDto.teamName = 1;
        vm.voucherCrocsTypes = [
            {id: 1, name: 'duet'},
            {id: 2, name: 'jibitz'},
            {id: 3, name: 'band'},
            {id: 4, name: 'dép nike'},
            {id: 5, name: 'Balo'}
        ];

        vm.defaultPrices = [];
        vm.defaultReceipt = 175000;//giá nhập
        vm.defaultIssue = 280000;//giá bán
        vm.defaultStickerReceipt = 3000;//giá nhập sticker
        vm.defaultStickerIssue = 7000;//giá bán sticker
        vm.defaultStickerFree = 4;//giá bán sticker

        vm.defaultShipFee = 33000;//giá ship chịu
        vm.defaultShip = 30000;//giá ship lúc bán

        vm.defaultPromotionFee = 12000;//giá khuyến mãi mặc định
        vm.defaultOtherFee = 23000;//phụ phí mặc định
        vm.defaultVoucherDate;


        vm.getDefaultPrice = function () {
            service.getDefaultPrice(vm.searchDto, vm.pageIndex, vm.pageSize).then(function (data) {
                vm.defaultPrices = data.content;
                for(var i = 0; i < vm.defaultPrices.length; i++){
                    if(vm.defaultPrices[i].code === 'GND'){
                        vm.defaultReceipt = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'GBD'){
                        vm.defaultIssue = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'GNJB'){
                        vm.defaultStickerReceipt = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'GBJB'){
                        vm.defaultStickerIssue = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'GSSC'){
                        vm.defaultShipFee = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'GSNMC'){
                        vm.defaultShip = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'PP'){
                        vm.defaultOtherFee = vm.defaultPrices[i].price;
                    }
                    if(vm.defaultPrices[i].code === 'VC'){
                        vm.defaultVoucherDate = vm.defaultPrices[i].date;
                    }
                }
            });
        };
        vm.getDefaultPrice();


        vm.shops = [];

        vm.getPageShop = function () {
            service.getPageShop(vm.searchDto, 1, 100000).then(function (data) {
                vm.shops = data.content;
                vm.bsTableControl.options.data = vm.shops;
                vm.bsTableControl.options.totalRows = data.totalElements;
                console.log(vm.shops);
            });
        };
        vm.getPageShop();

        // vm.shops = [
        //     {code: 'henry', name: 'Crocs.henry'},
        //     {code: 'cecile', name: 'Crocs.cecille'},
        //     {code: 'lin', name: 'Crocs.lin'},
        //     {code: 'vnlin', name: 'Crocs.vietnam.lin'},
        //     {code: 'zalo', name: 'Zalo'},
        //     {code: 'hn', name: 'Crocs Hà Nội'},
        //     {code: 'tx', name: 'Crocs Thanh Xuân'},
        //     {code: 'qa', name: 'Crocs Quần áo'},
        //     {code: '1993', name: 'The 1993'},
        //     {code: 'big', name: 'Crocs.big'},
        //     {code: 'vn', name: 'Crocs.viet.nam'},
        //     {code: 'kd', name: 'Kịch độc store'},
        //     {code: 'vnxk', name: 'Việt Nam Xuất Khẩu'},
        //     {code: 'aloha', name: 'Aloha'}
        // ];

        vm.status = [
            {id: 1, name: 'Nhập hàng'},
            {id: 2, name: 'Chốt đơn'},
            {id: 3, name: 'Chờ ship'},
            {id: 4, name: 'Thành công'},
            {id: 5, name: 'Hủy đơn'}
        ];


        vm.items = [];

        vm.voucherCrocs.priceProductIssue = 0;
        vm.voucherCrocs.priceProductReceipt = 0;

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
        vm.testFunction = function () {
            service.test(vm.test, function success() {
                toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                vm.voucherCrocs = {};
            }, function failure() {
                toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
            });
        };

        vm.getPage = function () {
            service.getPage(vm.searchDto, vm.pageIndex, vm.pageSize).then(function (data) {
                vm.voucherCrocss = data.content;
                vm.bsTableControl.options.data = vm.voucherCrocss;
                vm.bsTableControl.options.totalRows = data.totalElements;
                console.log(vm.voucherCrocss);
            });
        };

        vm.getByDate = function () {
            vm.pageIndex = 1;
            // vm.bsTableControl.state.pageNumber.state = 1;
            vm.getPage();
        };

        vm.enterSearchCode = function(){
            console.log(event.keyCode);
            if(event.keyCode == 13){//Phím Enter
                vm.codeChange();
                console.log(a);
            }
        };
        vm.codeChange=function () {
            vm.pageIndex = 1;
            // vm.bsTableControl.state.pageNumber.state = 1;
            vm.getPage();
        };

        vm.getItems = function () {
            service.getItems(vm.searchDto, 1, 100000).then(function (data) {
                vm.items = data.content;
                console.log(vm.items);
            });
        };

        vm.searchJb = {};
        vm.textJb = '';
        vm.getJb = function () {
            vm.searchJb.textSearch = vm.textJb;
            vm.searchJb.date = vm.defaultDateReceipt;
            service.getJb(vm.searchJb).then(function (data) {
                vm.itemJbs = data;
                if (vm.itemJbs != null) {
                    if (vm.voucherCrocs.items == null) {
                        vm.voucherCrocs.items = []
                    }
                    if (vm.voucherCrocs.totalAmountReceipt == null) {
                        vm.voucherCrocs.totalAmountReceipt = 0;
                    }
                    if (vm.voucherCrocs.totalAmountIssue == null) {
                        vm.voucherCrocs.totalAmountIssue = 0;
                    }
                    for (var i = 0; i < vm.voucherCrocs.items.length; i++) {
                        if (vm.voucherCrocs.items[i].isSticker == true) {
                            // vm.voucherCrocs.priceProductReceipt -= vm.voucherCrocs.items[i].priceReceipt;
                            // vm.voucherCrocs.priceProductIssue -= vm.voucherCrocs.items[i].priceIssue;
                            //
                            // vm.voucherCrocs.totalFee -= vm.voucherCrocs.items[i].priceReceipt;
                            // vm.voucherCrocs.totalAmountIssue -= vm.voucherCrocs.items[i].priceIssue;

                            vm.voucherCrocs.items.splice(i, 1);

                            i = 0;
                        }
                    }

                    console.log(vm.voucherCrocs.items);
                    console.log(vm.voucherCrocs.quantityCrocs * vm.defaultStickerFree);

                    for (var i = 0; i < vm.itemJbs.length; i++) {
                        var item = {};
                        item.item = vm.itemJbs[i];
                        item.priceReceipt = vm.defaultStickerReceipt;
                        if (i >= 0) {
                            item.priceIssue = 0;
                        }
                        if (i > vm.voucherCrocs.quantityCrocs * vm.defaultStickerFree - 1) {
                            item.priceIssue = vm.defaultStickerIssue;
                        }
                        item.isSticker = true;
                        vm.voucherCrocs.items.push(item);

                        vm.voucherCrocs.priceProductReceipt += item.priceReceipt;
                        vm.voucherCrocs.priceProductIssue += item.priceIssue;

                        vm.voucherCrocs.totalFee += item.priceReceipt;
                        vm.voucherCrocs.totalAmountIssue += item.priceIssue;
                    }

                    vm.calculateFeeReceipt();
                    vm.calculateTotalFee();
                    vm.calculateFeeIssue();
                    vm.calculateTotalAmountIssue();
                    vm.calculateRealAmount();
                }
                // console.log(vm.itemJbs);
            });
        };


        vm.voucherCrocs.totalFee = 0;
        vm.voucherCrocs.totalAmountIssue = 0;

        vm.voucherCrocs.quantityCrocs = 0;
        vm.addItem = function () {
            if (vm.voucherCrocs.items == null) {
                vm.voucherCrocs.items = []
            }
            if (vm.voucherCrocs.totalAmountReceipt == null) {
                vm.voucherCrocs.totalAmountReceipt = 0;
            }
            if (vm.voucherCrocs.totalAmountIssue == null) {
                vm.voucherCrocs.totalAmountIssue = 0;
            }
            var item = {};
            item.item = vm.item;

            item.priceReceipt = vm.defaultReceipt;
            item.priceIssue = vm.defaultIssue;
            item.isSticker = false;
            vm.voucherCrocs.items.push(item);
            vm.voucherCrocs.quantityCrocs += 1;
            vm.voucherCrocs.priceProductReceipt += item.priceReceipt;
            vm.voucherCrocs.priceProductIssue += item.priceIssue;

            vm.voucherCrocs.totalFee += item.priceReceipt;
            vm.voucherCrocs.totalAmountIssue += item.priceIssue;

            console.log(vm.voucherCrocs.items);
        };

        vm.deleteItem = function (index) {
            vm.voucherCrocs.priceProductReceipt -= vm.voucherCrocs.items[index].priceReceipt;
            vm.voucherCrocs.priceProductIssue -= vm.voucherCrocs.items[index].priceIssue;

            vm.voucherCrocs.totalFee -= vm.voucherCrocs.items[index].priceReceipt;
            vm.voucherCrocs.totalAmountIssue -= vm.voucherCrocs.items[index].priceIssue;

            vm.voucherCrocs.items.splice(index, 1);
            vm.voucherCrocs.quantityCrocs -= 1;

            vm.calculateFeeReceipt();
            vm.calculateTotalFee();
            vm.calculateFeeIssue();
            vm.calculateTotalAmountIssue();
            vm.calculateRealAmount();

        };

        vm.isType = 0;
        vm.current = 0;
        vm.changeCostOne = function (index) {
            if(vm.current != index){
                vm.isType = 0;
            }
            if(vm.isType === 0){
                vm.voucherCrocs.items[index].priceReceipt = 135000*vm.voucherCrocs.items[index].quantity;
                vm.voucherCrocs.items[index].priceIssue = 285000*vm.voucherCrocs.items[index].quantity;
                vm.calculateFeeReceipt();vm.calculateTotalFee();
                vm.calculateFeeIssue();vm.calculateTotalAmountIssue();
                vm.isType = 1;
            }else if(vm.isType === 1){
                vm.voucherCrocs.items[index].priceReceipt = 45000*vm.voucherCrocs.items[index].quantity;
                vm.voucherCrocs.items[index].priceIssue = 150000*vm.voucherCrocs.items[index].quantity;
                vm.calculateFeeReceipt();vm.calculateTotalFee();
                vm.calculateFeeIssue();vm.calculateTotalAmountIssue();
                vm.isType = 2;
            }else if(vm.isType === 2){
                vm.voucherCrocs.items[index].priceReceipt = 100000*vm.voucherCrocs.items[index].quantity;
                vm.voucherCrocs.items[index].priceIssue = 225000*vm.voucherCrocs.items[index].quantity;
                vm.calculateFeeReceipt();vm.calculateTotalFee();
                vm.calculateFeeIssue();vm.calculateTotalAmountIssue();
                vm.isType = 3;
            }else if(vm.isType > 2){
                vm.isType = 0;
                vm.changeCostOne(index);
            }
            vm.current = index;
        };

        vm.calculateTotalFee = function () {
            vm.voucherCrocs.totalFee = 0;
            vm.voucherCrocs.totalFee = vm.voucherCrocs.shipFee + vm.voucherCrocs.promotionFee + vm.voucherCrocs.otherFee + vm.voucherCrocs.priceProductReceipt;
        };

        vm.calculateTotalAmountIssue = function () {
            vm.voucherCrocs.totalAmountIssue = 0;
            vm.voucherCrocs.totalAmountIssue = vm.voucherCrocs.ship + vm.voucherCrocs.priceProductIssue;
            vm.voucherCrocs.realAmount = vm.voucherCrocs.totalAmountIssue;
        };

        vm.calculateRealAmount = function () {
            vm.voucherCrocs.realAmount = 0;
            vm.voucherCrocs.realAmount = vm.voucherCrocs.ship + vm.voucherCrocs.priceProductIssue;
        };

        vm.calculateFeeReceipt = function () {
            vm.voucherCrocs.priceProductReceipt = 0;
            for (var i = 0; i < vm.voucherCrocs.items.length; i++) {
                vm.voucherCrocs.priceProductReceipt += vm.voucherCrocs.items[i].priceReceipt;
            }
        };

        vm.calculateFeeIssue = function () {
            vm.voucherCrocs.priceProductIssue = 0;
            for (var i = 0; i < vm.voucherCrocs.items.length; i++) {
                vm.voucherCrocs.priceProductIssue += vm.voucherCrocs.items[i].priceIssue;
            }
        };

        vm.getItems();

        vm.getPage();

        vm.bsTableControl = {
            options: {
                data: vm.voucherCrocss,
                idField: 'id',
                sortable: true,
                striped: true,
                maintainSelected: true,
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
                        vm.selectedVoucherCrocss.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedVoucherCrocss = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedVoucherCrocss.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedVoucherCrocss = [];
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

            if(vm.searchDto.teamName == 0){
                toastr.warning("team nam phai khac 0 ");
                return;
            }

            vm.voucherCrocs.isNew = true;
            // var date = new Date();
            vm.voucherCrocs.voucherDate = vm.defaultVoucherDate;
            vm.voucherCrocs.status = 2;

            vm.voucherCrocs.shipFee = vm.defaultShipFee;//giá ship chịu
            vm.voucherCrocs.ship = vm.defaultShip;//giá ship lúc bán

            vm.voucherCrocs.otherFee = vm.defaultOtherFee;//phụ phí mặc định
            vm.isType = 0;

            vm.voucherCrocs.teamName = vm.searchDto.teamName;



            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'lg'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.voucherCrocs, function success() {
                        vm.getPage();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                        vm.voucherCrocs = {};
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.voucherCrocs = {};
            });
        };

        vm.textVoucher = '';
        vm.isCrocs = false;
        vm.processNewVoucher = function () {
            if(vm.searchDto.teamName === "0" || vm.searchDto.teamName === 0){
                toastr.warning("team name phai khac 0");
                return;
            }

            if(vm.searchDto.teamName == '' || vm.searchDto.teamName.length == 0 || vm.searchDto.teamName == null){
                toastr.warning("Team name không đc null");
                return;
            }

            // vm.voucherCrocs.teamName = vm.searchDto.teamName;

            vm.isType = 0;
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'process_new_voucher_modal.html',
                scope: $scope,
                size: 'md'
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    var item = {};
                    item.textSearch = vm.textVoucher;
                    item.teamName = vm.searchDto.teamName;
                    item.isCrocs = vm.isCrocs;
                    service.processVoucher(item).then(function (data) {
                        // vm.getPage();
                        vm.voucherCrocs = data;
                        vm.newObject();
                        vm.textJb = vm.voucherCrocs.textSearch;
                        vm.searchJb.textSearch = vm.textJb;
                        vm.getJb();
                        toastr.info('Bạn đã tạo mới thành công một tài khoản.', 'Thông báo');
                    }, function failure() {
                        toastr.error('Có lỗi xảy ra khi thêm mới một tài khoản.', 'Thông báo');
                    });
                }
            }, function () {
                vm.voucherCrocs = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            vm.isType = 0;
            service.getOne(id).then(function (data) {
                vm.voucherCrocs = data;
                vm.voucherCrocs.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'lg'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.voucherCrocs, function success() {
                            vm.getPage();
                            toastr.info('Bạn đã lưu thành công một bản ghi.', 'Thông báo');
                            vm.voucherCrocs = {};
                        }, function failure() {
                            toastr.error('Có lỗi xảy ra khi lưu thông tin tài khoản.', 'Lỗi');
                        });
                    }
                }, function () {
                    vm.voucherCrocs = {};
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
                    console.log(vm.selectedVoucherCrocss);
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

        $scope.uploadFiles = function (file, errFiles) {
            $scope.f = file;
            $scope.errFile = errFiles && errFiles[0];
        };

        vm.startUploadFile = function (file) {
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
                }, function errorCallback(response) {
                    toastr.error('Import lỗi.', 'Lỗi');
                });
            }
        };

        vm.importBills = function () {
            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'import_modal.html',
                scope: $scope,
                size: 'lg'
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

        $scope.myBlobObject = undefined;
        $scope.getFile = function () {
            console.log('download started, you can show a wating animation');
            service.getStream(vm.searchDto)
                .then(function (data) {//is important that the data was returned as Aray Buffer
                    console.log('Stream download complete, stop animation!');
                    $scope.myBlobObject = new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                }, function (fail) {
                    console.log('Download Error, stop animation and show error message');
                    $scope.myBlobObject = [];
                });
        };


        $scope.myBlobObject1 = undefined;
        $scope.getFileQuantity = function () {
            console.log('download started, you can show a wating animation');
            service.getStreamQuantity(vm.searchDto)
                .then(function (data) {//is important that the data was returned as Aray Buffer
                    console.log('Stream download complete, stop animation!');
                    $scope.myBlobObject1 = new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                }, function (fail) {
                    console.log('Download Error, stop animation and show error message');
                    $scope.myBlobObject1 = [];
                });
        };

        $scope.myBlobObject2 = undefined;
        $scope.getBody = function () {
            console.log('download started, you can show a wating animation');
            service.getStreamBody(vm.searchDto)
                .then(function (data) {//is important that the data was returned as Aray Buffer
                    console.log('Stream download complete, stop animation!');
                    $scope.myBlobObject2 = new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                }, function (fail) {
                    console.log('Download Error, stop animation and show error message');
                    $scope.myBlobObject2 = [];
                });
        };

        $scope.myBlobObject3 = undefined;
        $scope.getFileDelivery = function () {
            console.log('download started, you can show a wating animation');
            service.getStreamDelivery(vm.searchDto)
                .then(function (data) {//is important that the data was returned as Aray Buffer
                    console.log('Stream download complete, stop animation!');
                    $scope.myBlobObject3 = new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                }, function (fail) {
                    console.log('Download Error, stop animation and show error message');
                    $scope.myBlobObject3 = [];
                });
        };
    }

})();