/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.PersonDate').controller('PersonDateController', PersonDateController);

    PersonDateController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'PersonDateService',
        'Upload',
        '$cookies',
        'QuestionService',
        '$stateParams',
        '$filter',
        'blockUI',
        '$q'
    ];

    angular.module('Hrm.PersonDate').directive('myDatePicker', function () {
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

    angular.module('Hrm.PersonDate').directive('compile', ['$compile', function ($compile) {
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

    angular.module('Hrm.PersonDate').directive('fileDownload',function(){
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

    angular.module('Hrm.PersonDate').filter('removeHTMLTags', function() {

        return function(text) {

            return  text ? String(text).replace(/<[^>]+>/gm, '') : '';

        };

    });

    function PersonDateController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload,$cookies,questionService,$stateParams,$filter, blockUI,$q) {
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
        vm.isRoleStudentManagerment = false;

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
                console.log('staff');
            }
            if(value.name === "ROLE_STUDENT_MANAGERMENT"){
                vm.isRoleStudentManagerment = true;
                console.log('isRoleStudentManagerment');
            }
            if(value.name === "ROLE_EDUCATION_MANAGERMENT"){
                vm.isRoleEducationManagerment = true;
                console.log('isRoleEducationManagerment');
            }
        });
        
        vm.personDate = {};
        vm.personDates = [];
        vm.selectedPersonDates = [];
        vm.pageIndex = 1;
        vm.pageSize = 1000;
        vm.searchDto = {};
        vm.searchTextClient = '';
        vm.searchEnrollmentClass = 1;
        vm.enrollmentClasses = [
            {id: 1, name: "DCN1"},
            {id: 2, name: "DCN2"},
            {id: 3, name: "HATT1A"},
            {id: 4, name: "HATT1B"},
            {id: 5, name: "HATT2"},
            {id: 6, name: "HATT3A"},
            {id: 7, name: "HATT3B"},
            {id: 8, name: "TS1"},
            {id: 9, name: "TS2"},
            {id: 10, name: "TS3A"},
            {id: 11, name: "TS3B"},
            {id: 12, name: "HT"},
            {id: 13, name: "SĐ"},
            {id: 14, name: "KHÁC"}
        ];

        vm.searchDto.groupId = null;
        vm.groupChange = function () {
            if(vm.searchDto.group != null){
                vm.searchDto.groupId = vm.searchDto.group.id;
                vm.getPage();
            }else {
                vm.searchDto.groupId = null;
            }
        };
        service.getAllGroups().then(function (data) {
            if (data && data.length > 0) {
                vm.groups = data;
                console.log(vm.groups);
            } else {
                vm.groups = [];
            }
        });

        // map id -> name cho nhanh
        vm.enrollmentClassMap = {};
        angular.forEach(vm.enrollmentClasses, function (cls) {
            vm.enrollmentClassMap[cls.id] = cls.name;
            // console.log(cls);
        });

        // vm.enrollmentClassMap = {};
        // angular.forEach(vm.enrollmentClasses, function (cls) {
        //     vm.enrollmentClassMap[String(cls.id)] = cls.name;
        // });

        vm.clearSearchClient = function () {
            vm.searchTextClient = '';
            vm.searchEnrollmentClass = null;
        };

        vm.searchClient = function (item) {
            if (!item || !item.user || !item.user.person) {
                return false;
            }

            var person = item.user.person;
            var matchName = true;

            // lọc theo tên
            if (vm.searchTextClient && vm.searchTextClient.trim() !== '') {
                var fullName = (
                    (person.patron || '') + ' ' +
                    (person.lastName || '') + ' ' +
                    (person.firstName || '')
                ).toLowerCase();

                matchName = fullName.indexOf(vm.searchTextClient.toLowerCase().trim()) !== -1;
            }

            return matchName;
        };


        vm.users = [];
        vm.getUsers = function () {
            service.getUsers(vm.filter, vm.pageIndex, vm.pageSize).then(function (data) {
                vm.users = data.content;
                console.log(vm.users);
                // vm.bsTableControl.options.data = vm.users;
                // vm.bsTableControl.options.totalRows = data.totalElements;
                // console.log(vm.bsTableControl.options.totalRows);
            });
        };
        vm.getUsers();

        // URL logo (cùng domain là dễ nhất)
        vm.logoUrl = '/assets/images/logo-xu-doan.png';

        vm.qrPreview = null;

        // ===== Helpers =====
        function loadImage(url) {
            return $q(function (resolve, reject) {
                var img = new Image();
                img.crossOrigin = 'anonymous'; // cần nếu logo từ domain khác + có CORS
                img.onload = function () { resolve(img); };
                img.onerror = function (e) { reject(e); };
                img.src = url;
            });
        }

        // cắt chữ thành nhiều dòng để vừa bề ngang canvas
        function wrapTextLines(ctx, text, maxWidth) {
            if (!text) return [];
            var words = String(text).split(' ');
            // nếu username không có khoảng trắng, vẫn wrap theo ký tự
            if (words.length === 1) {
                var s = words[0], lines = [], line = '';
                for (var i = 0; i < s.length; i++) {
                    var test = line + s[i];
                    if (ctx.measureText(test).width > maxWidth && line) {
                        lines.push(line);
                        line = s[i];
                    } else {
                        line = test;
                    }
                }
                if (line) lines.push(line);
                return lines;
            }

            var lines = [];
            var line = words[0];
            for (var w = 1; w < words.length; w++) {
                var testLine = line + ' ' + words[w];
                if (ctx.measureText(testLine).width <= maxWidth) {
                    line = testLine;
                } else {
                    lines.push(line);
                    line = words[w];
                }
            }
            lines.push(line);
            return lines;
        }

        // vẽ logo dạng tròn
        function drawCircularImage(ctx, img, x, y, size) {
            var r = size / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + r, y + r, r, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, x, y, size, size);
            ctx.restore();
        }

        // ===== Main: QR + logo + username text =====
        function generateQrPro(username, logoUrl, opts) {
            opts = opts || {};
            var qrSize = opts.qrSize || 260;
            var paddingBottom = opts.paddingBottom || 72; // chỗ cho text
            var logoRatio = opts.logoRatio || 0.22; // logo chiếm ~22% QR
            var margin = opts.margin != null ? opts.margin : 1;

            return $q(function (resolve, reject) {
                QRCode.toCanvas(username, {
                    width: qrSize,
                    margin: margin,
                    errorCorrectionLevel: 'H'
                }, function (err, qrCanvas) {
                    if (err) return reject(err);

                    // canvas cuối cùng (cao hơn để có text)
                    var finalCanvas = document.createElement('canvas');
                    finalCanvas.width = qrCanvas.width;
                    finalCanvas.height = qrCanvas.height + paddingBottom;

                    var ctx = finalCanvas.getContext('2d');

                    // nền trắng
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                    // vẽ QR
                    ctx.drawImage(qrCanvas, 0, 0);

                    // chuẩn bị vẽ text
                    ctx.fillStyle = '#111';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '600 16px Arial';

                    // load logo rồi vẽ
                    loadImage(logoUrl).then(function (logoImg) {
                        var size = Math.floor(qrCanvas.width * logoRatio);
                        var x = Math.floor((qrCanvas.width - size) / 2);
                        var y = Math.floor((qrCanvas.height - size) / 2);

                        // nền trắng bo góc phía sau logo (để dễ quét)
                        var pad = Math.floor(size * 0.18);
                        var rx = x - pad, ry = y - pad;
                        var rw = size + pad * 2, rh = size + pad * 2;

                        // rounded rect
                        var radius = Math.min(16, Math.floor(rw * 0.18));
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(rx + radius, ry);
                        ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
                        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
                        ctx.arcTo(rx, ry + rh, rx, ry, radius);
                        ctx.arcTo(rx, ry, rx + rw, ry, radius);
                        ctx.closePath();
                        ctx.fillStyle = '#ffffff';
                        ctx.fill();
                        ctx.restore();

                        // vẽ logo tròn
                        drawCircularImage(ctx, logoImg, x, y, size);

                        // vẽ text username dưới QR (auto wrap)
                        var maxTextWidth = finalCanvas.width - 24;
                        var lines = wrapTextLines(ctx, username, maxTextWidth);
                        if (lines.length > 2) lines = lines.slice(0, 2); // tối đa 2 dòng cho gọn

                        var startY = qrCanvas.height + 26;
                        var lineHeight = 20;

                        ctx.fillStyle = '#111';
                        ctx.font = '600 16px Arial';
                        for (var i = 0; i < lines.length; i++) {
                            ctx.fillText(lines[i], finalCanvas.width / 2, startY + i * lineHeight);
                        }

                        resolve(finalCanvas.toDataURL('image/png'));
                    }).catch(function () {
                        // logo fail: vẫn vẽ text và trả QR
                        var maxTextWidth = finalCanvas.width - 24;
                        var lines = wrapTextLines(ctx, username, maxTextWidth);
                        if (lines.length > 2) lines = lines.slice(0, 2);

                        var startY = qrCanvas.height + 26;
                        var lineHeight = 20;

                        ctx.fillStyle = '#111';
                        ctx.font = '600 16px Arial';
                        for (var i = 0; i < lines.length; i++) {
                            ctx.fillText(lines[i], finalCanvas.width / 2, startY + i * lineHeight);
                        }

                        resolve(finalCanvas.toDataURL('image/png'));
                    });
                });
            });
        }

        // ===== Public: open modal =====
        vm.openQr = function (dataUrl,person) {
            vm.zoomPerson = person;
            vm.qrPreview = dataUrl;
            $('#qrModal').modal('show'); // Bootstrap 3/4
        };

        // ===== Get page + generate QR for each row =====
        vm.startDate = new Date();
        vm.endDate = new Date();
        vm.searchDto.user = {};
        vm.searchDto.user.person = {};
        vm.searchDto.user.person.enrollmentClass = 1;

        vm.resetSum = function () {
            vm.totalStudent = 0;
            vm.totalMass1 = 0;
            vm.totalMass2 = 0;
            vm.totalMass5 = 0;
            vm.totalMass6 = 0;
            vm.totalClass1 = 0;
            vm.totalClass2 = 0;
            vm.totalClass5 = 0;
            vm.totalClass6 = 0;

            vm.totalGoToChurch = 0;
            vm.totalGoToClass = 0;
            vm.totalAbsentChurch = 0;
            vm.totalAbsentClass = 0;
        };

        vm.getPage = function () {
            blockUI.start();
            vm.startDate.setHours(0, 0, 0, 0);
            vm.endDate.setHours(0, 0, 0, 0);
            vm.searchDto.startDate =  Date.parse(vm.startDate);
            vm.searchDto.endDate =  Date.parse(vm.endDate);
            vm.resetSum();

            service.getPage(vm.searchDto, vm.pageIndex, vm.pageSize).then(function (data) {
                blockUI.stop();
                vm.personDates = data.content || [];
                vm.totalStudent = data.totalElements;

                angular.forEach(vm.personDates, function(value, key) {
                    if(value.statusMass == 1){ //có
                        vm.totalMass1 = vm.totalMass1 + 1;
                    }
                    if(value.statusMass == 2){ // không
                        vm.totalMass2 = vm.totalMass2 + 1;
                    }
                    if(value.statusMass == 5){ // ca đoàn
                        vm.totalMass5 = vm.totalMass5 + 1;
                    }
                    if(value.statusMass == 6){ // phép
                        vm.totalMass6 = vm.totalMass6 + 1;
                    }

                    if(value.statusClass == 1){ //có
                        vm.totalClass1 = vm.totalClass1 + 1;
                    }
                    if(value.statusClass == 2){ // không
                        vm.totalClass2 = vm.totalClass2 + 1;
                    }
                    // if(value.statusClass == 5){ // ca đoàn
                    //     vm.totalClass5 = vm.totalClass5 + 1;
                    // }
                    if(value.statusClass == 6){ // phép
                        vm.totalClass6 = vm.totalClass6 + 1;
                    }
                });

                vm.totalGoToChurch = vm.totalMass1 + vm.totalMass5;
                // vm.totalGoToClass = vm.totalClass1 + vm.totalClass5;
                vm.totalAbsentChurch = vm.totalMass2 + vm.totalMass6;
                vm.totalAbsentClass = vm.totalClass2 + vm. totalClass6;

                // angular.forEach(vm.personDates, function (personDate) {
                //     var username = personDate?.user?.username || '';
                //     if (!username) return;
                //
                //     if (personDate.qrcodeByUsername) return; // cache
                //
                //     generateQrPro(username, vm.logoUrl, { qrSize: 240 }).then(function (url) {
                //         $timeout(function () {
                //             personDate.qrcodeByUsername = url;
                //         }, 0);
                //     }).catch(function (e) {
                //         console.error('QR error:', e);
                //     });
                // });
            });
        };

        vm.getPage();

        /**
         * New event account
         */
        vm.newObject = function () {

            vm.personDate.isNew = true;
            // vm.personDate.userId = vm.currentUser.id;

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'md',
                // backdrop: 'static',
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    service.saveObject(vm.personDate).then(function (data) {
                        vm.getPage();
                        vm.personDate = {};
                        if(data.message != null){
                            toastr.info(data.message, 'Notification');
                        }else{
                            toastr.error('Error.', 'Warning');
                        }

                    });

               
                }
            }, function () {
                vm.personDate = {};
            });
        };

        /**
         * Edit a account
         */
        $scope.editObject = function (id) {
            service.getOne(id).then(function (data) {
                vm.personDate = data;
                vm.personDate.isNew = false;
                var modalInstance = modal.open({
                    animation: true,
                    templateUrl: 'edit_object_modal.html',
                    scope: $scope,
                    size: 'md',
                    // backdrop: 'static',
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm == 'yes') {
                        service.saveObject(vm.personDate).then(function (data) {
                            vm.getPage();
                            vm.personDate = {};
                            if(data.message != null){
                                toastr.info(data.message, 'Notification');
                            }else{
                                toastr.error('Error.', 'Warning');
                            }
                        });
                    }
                }, function () {
                    vm.personDate = {};
                });
            });
        };

        vm.confirmCheck = function () {


            // generateQrPro(vm.checkPerson.user.username, vm.logoUrl, { qrSize: 240 }).then(function (url) {
            //     $timeout(function () {
            //         vm.checkPerson.qrcodeByUsername = url;
            //     }, 0);
            // }).catch(function (e) {
            //     console.error('QR error:', e);
            // });

            var modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_check_object_modal.html',
                scope: $scope,
                size: 'md',
                // backdrop: 'static',
            });

            modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    
                }
            }, function () {
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
                	console.log(vm.selectedPersonDates);
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

            vm.personDate = {};
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
        };

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

        vm.scanning = false;
        vm.status = "Idle";

        var html5QrCode = null;

        function updateStatus(msg) {
            vm.status = msg;
            $scope.$applyAsync();
        }

        // chống bắn nhiều lần liên tục
        var scanLock = false;
        var lastText = null;
        var lastAt = 0;

        vm.start = function () {

            if (!window.isSecureContext) {
                alert("Camera requires HTTPS.");
                updateStatus("Blocked: Not HTTPS.");
                return;
            }

            if (!window.Html5Qrcode) {
                alert("QR library failed to load.");
                updateStatus("Library not loaded.");
                return;
            }

            // nếu đang chạy rồi thì không start lại
            if (vm.scanning) return;

            vm.scanning = true;
            updateStatus("Starting camera...");

            html5QrCode = new Html5Qrcode("reader");

            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                function (decodedText) {

                    // khóa để tránh gọi save liên tục nhiều lần / 1 QR
                    var now = Date.now();
                    if (scanLock) return;

                    // chống trùng cùng mã trong vài giây (do camera đọc lặp)
                    if (decodedText === lastText && (now - lastAt) < 2500) return;

                    scanLock = true;
                    lastText = decodedText;
                    lastAt = now;

                    // gọi API / lưu
                    // nếu saveByScanQr trả về promise thì càng tốt
                    try {
                        // alert(decodedText);
                        var maybePromise = vm.saveByScanQr(decodedText);

                        // Nếu hàm của bạn trả promise: mở khóa khi xong
                        if (maybePromise && typeof maybePromise.finally === "function") {
                            maybePromise.finally(function () {
                                // mở khóa sau 1 chút để khỏi quét trùng
                                setTimeout(function () { scanLock = false; }, 1200);
                            });
                        } else {
                            // nếu không trả promise, vẫn mở khóa sau 1 chút
                            setTimeout(function () { scanLock = false; }, 1200);
                        }
                    } catch (e) {
                        scanLock = false;
                        alert("saveByScanQr error: " + (e && e.message ? e.message : e));
                    }

                    // ✅ QUAN TRỌNG: KHÔNG vm.stop() ở đây nữa
                    // camera vẫn chạy => iOS Safari sẽ không hỏi quyền lại
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

        //statusMass =>  1: có đi lễ ; 2: không đi lễ; 3: muộn; 5: ca đoàn; 6: Phép (lễ)

        //statusClass => 1: có đi học ; 2: không đi học; 3: muộn; 5: ca đoàn; 6: Phép (GL)
        
        vm.statusMasses = [
            {id: 1,name: "CÓ ĐI LỄ"},
            {id: 2,name: "KHÔNG ĐI LỄ"},
            {id: 3,name: "MUỘN"},
            {id: 5,name: "CA ĐOÀN"},
            {id: 6,name: "PHÉP (LỄ)"}
        ];

        vm.statusClasses = [
            {id: 1,name: "CÓ ĐI HỌC"},
            {id: 2,name: "KHÔNG ĐI HỌC"},
            {id: 3,name: "MUỘN"},
            {id: 5,name: "CA ĐOÀN"},
            {id: 6,name: "PHÉP (GL)"}
        ];

        vm.resetPersonDate = function (user,status,username) {
            vm.personDate = {};
            vm.personDate.user = {};
            vm.personDate.user.username = username;
            if(user != null){
                vm.personDate.user.id = user.id;
            }

            // var now = new Date();

            if(vm.checkType == 1){ //điểm danh lễ
                // vm.personDate.timeGoToChurch = Date.parse(now);
                vm.personDate.statusMass = status;
            }
            if(vm.checkType == 2){ //điểm danh học GL
                // vm.personDate.timeGoToClass = Date.parse(now);
                vm.personDate.statusClass = status;
            }
            // alert(vm.personDate.user.username + "hehe");
        };
        
        vm.checkPerson = {};
        vm.saveByScanQr = function (username) { // quét qr thì chỉ cho điểm danh là có đi lễ hoặc có đi học giáo lý thôi
            vm.resetPersonDate(null,1,username); // nên là 2 cái status set là 1 hết

            service.saveObject(vm.personDate).then(function (data) {
                // // vm.getPage();
                // vm.personDate = {};
                // // console.log(data);
                // vm.checkPerson = data;
                // vm.confirmCheck();

                // personDate.statusMass = data.statusMass;
                // personDate.timeGoToChurch = data.timeGoToChurch;
                // personDate.statusClass = data.statusClass;
                // personDate.timeGoToClass = data.timeGoToClass;
                // personDate = data;
                vm.personDate = {};
                // console.log(data);
                vm.checkPerson = data;
                if(vm.checkType == 1){
                    vm.checkPerson.status = data.statusMass;
                }
                if(vm.checkType == 2){
                    vm.checkPerson.status = data.statusClass;
                }
                vm.confirmCheck();
            });
        };

        vm.saveByClick = function (personDate,user,checkType,status) {
            // console.log(username);
            vm.checkType = checkType;
            vm.resetPersonDate(user,status,null);
            vm.personDate.id = personDate.id;

            service.saveObject(vm.personDate).then(function (data) {
                // vm.getPage();
                personDate.statusMass = data.statusMass;
                personDate.timeGoToChurch = data.timeGoToChurch;
                personDate.statusClass = data.statusClass;
                personDate.timeGoToClass = data.timeGoToClass;
                // personDate = data;
                vm.personDate = {};
                // console.log(data);
                vm.checkPerson = data;
                if(checkType == 1){
                    vm.checkPerson.status = data.statusMass;
                }
                if(checkType == 2){
                    vm.checkPerson.status = data.statusClass;
                }
                vm.confirmCheck();
            });
        };

        vm.openPhotoPreview = function (user) {
            if (!user || !user.username) {
                return;
            }

            vm.photoPreviewUser = user;
            vm.photoPreviewUrl = settings.api.baseUrl + 'public/users/photo/' + user.username + '?v=' + new Date().getTime();

            $('#photoPreviewModal').modal('show');
        };

        vm.closePhotoPreview = function () {
            vm.photoPreviewUser = {};
            vm.photoPreviewUrl = null;
            $('#photoPreviewModal').modal('hide');
        };

        // vm.saveStatus = function (personDate) {
        //     service.saveObject(personDate).then(function (data) {
        //         // vm.getPage();
        //         // vm.personDate = {};
        //         // console.log(data);
        //         // vm.checkPerson = data;
        //         // vm.confirmCheck();
        //     });
        // };


        // var date = new Date();
        // vm.startDate = new Date();
        // vm.endDate = new Date();

        // vm.startDate.setHours(0, 0, 0, 0);
        // vm.endDate.setHours(0, 0, 0, 0);

        vm.setDateForBills = function () {
            if(vm.startDate != null && vm.endDate != null){
                //vm.startDate = DateUtil.addDays(myDate, 1);
                vm.startDate.setHours(0, 0, 0, 0);
                vm.endDate.setHours(0, 0, 0, 0);
                vm.searchDto.startDate =  Date.parse(vm.startDate);
                vm.searchDto.endDate =  Date.parse(vm.endDate);
            }
        };

        vm.statistics = function () {

            if(angular.isUndefined(vm.startDate)){
                vm.startDate = new Date();
            }
            if(angular.isUndefined(vm.endDate)){
                vm.endDate = new Date();
            }

            vm.setDateForBills();
            vm.getPage();
        };

        vm.createCheckList = function () {
            service.saveListByEnrollmentClass(0).then(function (data) { // tạm thời để 0
                vm.statistics();
            });
        };

        vm.checkType = null; // 1 là lễ 2 là giáo lý
        vm.checkDate = new Date();

        vm.checkTypeChange = function () {
            if(vm.checkType == 1){
                vm.checkDate.setHours(8, 0, 0, 0);
            }
            if(vm.checkType == 2){
                vm.checkDate.setHours(9, 0, 0, 0);
            }
        };

        vm.startSetUp = false;
        vm.finishSetup = false;

        vm.setUpForChecking = function () {
            vm.finishSetup = true;
        };

        vm.statusMass = [
            {id:1}
        ]
        

    }

})();