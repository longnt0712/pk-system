/**
 * Created by bizic on 28/8/2016.
 */
(function () {
    'use strict';

    angular.module('Hrm.User').controller('UserController', UserController);

    UserController.$inject = [
        '$rootScope',
        '$scope',
        '$timeout',
        'settings',
        '$uibModal',
        'toastr',
        'blockUI',
        'bsTableAPI',
        'Utilities',
        'focus',
        'UserService',
        '$q',
        'Upload',
        '$cookies'
    ];

    angular.module('Hrm.User').directive('cropperSource', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                function onLoad() {
                    $timeout(function () {
                        if (scope.profilePhoto && scope.profilePhoto.initCropperFromElement) {
                            scope.profilePhoto.initCropperFromElement(element[0]);
                        }
                    }, 100);
                }

                element.on('load', onLoad);

                scope.$on('$destroy', function () {
                    element.off('load', onLoad);
                });
            }
        };
    }]);

    angular.module('Hrm.User').directive('myDatePicker', function () {
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

    function UserController($rootScope, $scope, $timeout, settings, modal, toastr, blockUI, bsTableAPI, utils, focus, service,$q,Upload,$cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        // window.addEventListener('beforeunload', function (e) {
        //     // Cancel the event
        //     e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        //     // Chrome requires returnValue to be set
        //     e.returnValue = '';
        // });

        // search user by username
        vm.filter = {
            keyword: '',
            active: null,
            roles: [],
            groups: [],
            filtered: 0
        };

        vm.user = {};
        vm.users = [];
        vm.selectedUsers = [];
        
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
        vm.genders = [
            {id: 'M', name: "NAM"},
            {id: 'F', name: "NỮ"},
            {id: 'U', name: "KHÔNG RÕ"},
        ];
        // vm.user.enrollmentClass = vm.enrollmentClasses[0].id;

        vm.roles = [];
        vm.groups = [];

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
                console.log('ROLE_STAFF_MANAGEMENT');
            }
            if(value.name === "ROLE_STUDENT_MANAGERMENT"){
                vm.isRoleStudentManagerment = true;
                // angular.forEach(vm.roles, function(value1, key1) {
                //     if(value1.name === "ROLE_STUDENT"){
                //         vm.filter.roles.add(value1);
                //     }
                // });
                console.log('ROLE_STUDENT_MANAGERMENT');
            }
        });

        /**
         * Get all roles
         */
        service.getAllRoles().then(function (data) {
            if (data && data.length > 0) {
                vm.roles = data;
            } else {
                vm.roles = [];
            }
            vm.getUsers();
        });

        vm.processEducationPrograms = function () {
            vm.educationPrograms = [];
            vm.userEducationPrograms = [];
            service.getEducationPrograms(vm.filter, 1, 1000000).then(function (data) {
                vm.educationPrograms = data.content;
                vm.userEducationPrograms = [];

                angular.forEach(vm.educationPrograms, function(value, key) {
                    var userEducationProgram = {};
                    userEducationProgram.user = {};
                    userEducationProgram.educationProgram = value;
                    userEducationProgram.name = value.name;
                    vm.userEducationPrograms.push(userEducationProgram);
                });
                console.log(vm.userEducationPrograms);
            });
        };

        vm.processEducationPrograms();

        vm.userEducationProgramsChange = function (s) {
            // angular.forEach(vm.educationPrograms, function(value, key) {
            //
            // });
        };

        // UI
        vm.modalInstance = null;

        // pagination
        vm.pageIndex = 1;
        vm.pageSize = 25;

        /**
         * Get a list of users
         */
        vm.getUsers = function () {

            angular.forEach(vm.roles, function(value1, key1) {
                if(value1.name === "ROLE_STUDENT"){
                    // vm.filter.roles = [];
                    if(vm.isRoleStudentManagerment == true){
                        vm.filter.roles.push(value1);
                        // console.log()
                    }
                }
            });
            service.getUsers(vm.filter, vm.pageIndex, vm.pageSize).then(function (data) {
                vm.users = data.content;
                vm.users.totalElement = data.totalElements;
                // vm.bsTableControl.options.data = vm.users;
                // vm.bsTableControl.options.totalRows = data.totalElements;
                // console.log(vm.bsTableControl.options.totalRows);

                // angular.forEach(vm.users, function (user) {
                //     var username = user?.username || '';
                //     if (!username) return;
                //
                //     if (user.qrcodeByUsername) return; // cache
                //
                //     generateQrPro(username, vm.logoUrl, { qrSize: 240 }).then(function (url) {
                //         $timeout(function () {
                //             user.qrcodeByUsername = url;
                //         }, 0);
                //     }).catch(function (e) {
                //         console.error('QR error:', e);
                //     });
                // });
                
            });
        };

        $scope.pageChanged = function() {
            // $log.log('Page changed to: ' + $scope.currentPage);
            vm.getUsers();
        };

        /**
         * Get all user groups
         */
        service.getAllGroups().then(function (data) {
            if (data && data.length > 0) {
                vm.groups = data;
            } else {
                vm.groups = [];
            }
        });

        vm.saveUser = function () {

            if (!vm.user.person) {
                vm.user.person = {};
            }

            if (!vm.user.person.firstName || !vm.user.person.lastName) {
                toastr.error('Vui lòng nhập đầy đủ họ tên người dùng!', 'Thông báo');
                focus('vm.user.person.displayName');
                return;
            }

            if (!vm.user.email || vm.user.email.trim().length <= 0) {
                toastr.error('Vui lòng nhập địa chỉ email!', 'Thông báo');
                focus('vm.user.email');
                return;
            }

            if (!vm.user.id) {
                if (!vm.user.username || vm.user.username.trim().length <= 0) {
                    toastr.error('Vui lòng nhập tên đăng nhập!', 'Thông báo');
                    focus('vm.user.username');
                    return;
                }
            }

            if (!vm.user.id) {
                if (!vm.user.password || vm.user.password.trim().length <= 0) {
                    toastr.error('Vui lòng nhập mật khẩu!', 'Thông báo');
                    focus('vm.user.password');
                    return;
                }

                if (vm.user.password != vm.user.confirmPassword) {
                    toastr.error('Mật khẩu không khớp nhau!', 'Thông báo');
                    focus('vm.user.confirmPassword');
                    return;
                }
            }

            if (!vm.user.roles || vm.user.roles.length <= 0) {
                toastr.error('Vui lòng chọn ít nhất một vai trò cho người dùng!', 'Thông báo');
                return;
            }

            // Check for duplicate username & email
            service.getUserByUsername(vm.user.username).then(function (data) {
                if (data && data.id) {
                    if (!vm.user.id || (vm.user.id && data.id != vm.user.id)) {
                        toastr.error('Tên đăng nhập đã tồn tại!', 'Thông báo');
                        focus('vm.user.username');
                        return;
                    }
                }

                service.emailAlreadyUsed(vm.user).then(function (data2) {
                    if (data2 && data2 == true && (vm.user.id==null || vm.user.id==0) ) {
                        toastr.error('Địa chỉ email đã tồn tại!', 'Thông báo');
                        focus('vm.user.email');
                        return;
                    }

                    service.saveUser(vm.user, function successCallback(data) {
                        toastr.info('Đã lưu thông tin người dùng thành công!', 'Thông báo');

                        // Reload users
                        vm.getUsers();

                    }, function errorCallback(response) {
                        toastr.error('Có lỗi xảy ra khi lưu.', 'Thông báo');
                    }).then(function () {
                        // Close the modal
                        if (vm.modalInstance) {
                            vm.modalInstance.close();
                        }
                    });
                });
            });
        };

        /**
         * Create a new user
         */
        vm.newUser = function () {
            vm.user = {isNew: true};

            vm.modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_modal.html',
                scope: $scope,
                size: 'md',
                backdrop: 'static',
            });
        };

        /**
         * Edit an existing user
         *
         * @param userId
         */
        vm.editUser = function (userId) {

            vm.processEducationPrograms();
            service.getUser(userId).then(function (data) {
                if (data && data.id) {
                    vm.user = data;
                    vm.user.isNew = false;



                    var normalized = [];

                    if (vm.user.userEducationPrograms && vm.userEducationPrograms) {
                        angular.forEach(vm.user.userEducationPrograms, function (selectedItem) {
                            angular.forEach(vm.userEducationPrograms, function (option) {
                                if (
                                    selectedItem.educationProgram &&
                                    option.educationProgram &&
                                    selectedItem.educationProgram.id === option.educationProgram.id
                                ) {
                                    normalized.push(option);
                                }
                            });
                        });
                    }

                    vm.user.userEducationPrograms = normalized;

                    vm.modalInstance = modal.open({
                        animation: true,
                        templateUrl: 'edit_modal.html',
                        scope: $scope,
                        size: 'md',
                        backdrop: 'static',
                    });
                }
            });
        };

        /**
         * Save user's new password
         */
        vm.saveNewPassword = function () {
            if (!vm.user || !vm.user.id) {
                return;
            }

            vm.user.password1 = vm.user.password1.trim();
            vm.user.password2 = vm.user.password2.trim();

            if (vm.user.password1 == '') {
                toastr.error('Bạn vui lòng nhập mật khẩu mới!', 'Thông báo');
                focus('vm.user.password1');
                return;
            }

            // console.log(vm.user.password1);
            // console.log(vm.user.password2);

            if (vm.user.password1 != vm.user.password2) {
                toastr.error('Mật khẩu không trùng nhau!', 'Thông báo');
                focus('vm.user.password2');
                return;
            }

            var userObj = {
                id: vm.user.id,
                fullname: vm.user.displayName,
                username: vm.user.username,
                password: vm.user.password1
            };

            service.changePassword(userObj, function success() {
                toastr.info('Bạn đã cập nhật thành công mật khẩu cho người dùng [ ' + userObj.fullname + ' ].', 'Thông báo');
            }, function error() {
                toastr.error('Có lỗi xảy ra khi cập nhật mật khẩu. Mật khẩu của người dùng vẫn được giữ nguyên như cũ.', 'Thông báo');
            }).then(function (data) {

                vm.user = {};

                if (vm.modalInstance) {
                    vm.modalInstance.close(null);
                }
            });
        };

        /**
         * Change user password
         * @param userId
         */
        vm.changeUserPassword = function (userId) {
            service.getUser(userId).then(function (data) {
                if (data && data.id) {

                    vm.user = data;
                    vm.user.isNew = false;

                    vm.modalInstance = modal.open({
                        animation: true,
                        templateUrl: 'change_user_password_modal.html',
                        scope: $scope,
                        size: 'md',
                        backdrop: 'static',
                    });
                }
            });
        };

        /**
         * Delete a selected user
         */
        // vm.deleteUsers = function () {
        //     vm.modalInstance = modal.open({
        //         animation: true,
        //         templateUrl: 'confirm_delete_modal.html',
        //         scope: $scope,
        //         size: 'md',
        //         backdrop: 'static',
        //     });
        //
        //     vm.modalInstance.result.then(function (confirm) {
        //         if (confirm == 'yes') {
        //             blockUI.start();
        //             service.deleteUsers(vm.selectedUsers[0], function success() {
        //                 // Refresh list
        //                 vm.getUsers();
        //
        //                 // Block UI
        //                 blockUI.stop();
        //
        //                 // Notify
        //                 toastr.info('Bạn đã xoá thành công ' + vm.selectedUsers.length + ' bản ghi.', 'Thông báo');
        //
        //                 // Clear selected tags
        //                 vm.selectedUsers = [];
        //             }, function failure() {
        //                 // Block UI
        //                 blockUI.stop();
        //
        //                 toastr.error('Có lỗi xảy ra khi xóa bản khi.', 'Thông báo');
        //             });
        //         }
        //     }, function () {
        //         console.log('Modal dismissed at: ' + new Date());
        //     });
        // };

        vm.deleteUser = function (userId) {
            vm.modalInstance = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md'
            });

            vm.modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    blockUI.start();
                    service.deleteUser(userId, function success() {
                        // Refresh list
                        vm.getUsers();

                        // Block UI
                        blockUI.stop();

                        // Notify
                        toastr.info('Bạn đã xoá thành công', 'Thông báo');
                    }, function failure() {
                        // Block UI
                        blockUI.stop();

                        toastr.error('Có lỗi xảy ra khi xóa bản khi.', 'Thông báo');
                    });
                }
            }, function () {
                console.log('Modal dismissed at: ' + new Date());
            });
        };

        /**
         * Open search form...
         */
        vm.filterTemp = {};

        vm.advancedSearch = function () {
            angular.copy(vm.filter, vm.filterTemp);

            vm.modalInstance = modal.open({
                animation: true,
                templateUrl: 'search_user_modal.html',
                scope: $scope,
                size: 'md',
                backdrop: 'static',
            });

            vm.modalInstance.result.then(function (confirm) {
                if (confirm == 'yes') {
                    angular.copy(vm.filterTemp, vm.filter);
                    vm.filterTemp = {filtered: 0};
                    vm.filter.filtered = (vm.filter.keyword.trim() != '') || (vm.filter.groups.length > 0) || (vm.filter.roles.length > 0);

                    vm.pageIndex = 0;
                    vm.getUsers();
                }
            });
        };

        vm.changeGroups = function () {
            // vm.filter.groups = 
        };

        /**
         * Perform search
         */
        vm.search = function () {
            // vm.filter.keyword = vm.filterTemp.keyword;
            // angular.copy(vm.filterTemp, vm.filter);
            // vm.filterTemp = {filtered: 0};
            // vm.filter.filtered = (vm.filter.keyword.trim() != '') || (vm.filter.groups.length > 0) || (vm.filter.roles.length > 0);

            console.log(vm.filter);

            if(vm.filter.enrollmentClass != null || (vm.filter.groups != null && vm.filter.groups.length > 0)){ //class change
                vm.pageSize = 1000;
            } else {
                vm.pageSize = 25;
            }

            vm.pageIndex = 1;
            vm.getUsers();
        };

        /**
         * When removing a selected filter criteria
         *
         * @param type
         * @param id
         */
        vm.onFilterRemoved = function (type, item) {

            if (!type || !item) {
                return;
            }

            var index = -1;

            switch (type) {
                case '_keyword':
                    vm.filter.keyword = '';

                    break;
                case '_roles':
                    index = utils.indexOf(item, vm.filter.roles);
                    if (index >= 0) {
                        vm.filter.roles.splice(index, 1);
                    }

                    break;
                case '_groups':
                    index = utils.indexOf(item, vm.filter.groups);
                    if (index >= 0) {
                        vm.filter.groups.splice(index, 1);
                    }

                    break;
            }

            // Update filter status
            vm.filter.filtered = (vm.filter.keyword.trim() != '') || (vm.filter.groups.length > 0) || (vm.filter.roles.length > 0);

            // Update data
            vm.pageIndex = 0;
            vm.getUsers();
        };

        /**
         * Get Firstname & Lastname from fullname
         */
        $scope.$watch('vm.user.person.displayName', function (newVal, oldVal) {

            if (!newVal) {
                return;
            }

            var fullname = String(newVal).trim();
            if (fullname.length <= 0) {
                return;
            }

            var spaceIndex = fullname.indexOf(' ');

            if (spaceIndex > 0) {
                vm.user.person.firstName = fullname.substr(0, spaceIndex);
                vm.user.person.lastName = fullname.substr(spaceIndex + 1);
            }
        });

        /**
         * Table definition
         */
        // vm.bsTableControl = {
        //     options: {
        //         data: vm.users,
        //         idField: 'id',
        //         sortable: true,
        //         striped: true,
        //         maintainSelected: true,
        //         clickToSelect: false,
        //         showColumns: false,
        //         singleSelect: true,
        //         showToggle: false,
        //         pagination: true,
        //         pageSize: vm.pageSize,
        //         pageList: [5, 10, 25, 50, 100],
        //         locale: settings.locale,
        //         sidePagination: 'server',
        //         columns: service.getTableDefinition(),
        //         onCheck: function (row, $element) {
        //             $scope.safeApply(function () {
        //                 vm.selectedUsers = [];
        //                 if (row.username && row.username != 'admin') {
        //                     vm.selectedUsers.push(row);
        //                 } else {
        //                     bsTableAPI('bsTableControl', 'uncheckBy', {field: 'username', values: ['admin']});
        //                 }
        //             });
        //         },
        //         onUncheck: function (row, $element) {
        //             $scope.safeApply(function () {
        //                 vm.selectedUsers = [];
        //             });
        //         },
        //         onPageChange: function (index, pageSize) {
        //             vm.pageSize = pageSize;
        //             vm.pageIndex = index;
        //
        //             vm.getUsers();
        //         }
        //     }
        // };

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
        vm.zoomPerson = {};
        vm.openQr = function (dataUrl,person) {
            vm.zoomPerson = person;
            vm.qrPreview = dataUrl;
            $('#qrModal').modal('show'); // Bootstrap 3/4
        };

        vm.photoPreviewUser = {};
        vm.photoPreviewUrl = null;

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

        $scope.profilePhoto = {

            uploadedFile: null,
            errorFile: null,
            selectedUser: null,
            isUploading: false,

            loadedImageData: null,
            croppedImage: null,

            cropper: null,
            cropModalInstance: null,

            resetState: function () {

                if ($scope.profilePhoto.cropper) {
                    $scope.profilePhoto.cropper.destroy();
                    $scope.profilePhoto.cropper = null;
                }

                $scope.profilePhoto.uploadedFile = null;
                $scope.profilePhoto.errorFile = null;
                $scope.profilePhoto.selectedUser = null;
                $scope.profilePhoto.isUploading = false;

                $scope.profilePhoto.loadedImageData = null;
                $scope.profilePhoto.croppedImage = null;
            },

            openCropModal: function () {

                if ($scope.profilePhoto.cropper) {
                    $scope.profilePhoto.cropper.destroy();
                    $scope.profilePhoto.cropper = null;
                }

                $scope.profilePhoto.cropModalInstance = modal.open({
                    animation: true,
                    templateUrl: 'crop_photo_modal.html',
                    scope: $scope,
                    size: 'lg',
                    backdrop: 'static'
                });
            },

            closeCropModal: function () {

                if ($scope.profilePhoto.cropper) {
                    $scope.profilePhoto.cropper.destroy();
                    $scope.profilePhoto.cropper = null;
                }

                if ($scope.profilePhoto.cropModalInstance) {
                    $scope.profilePhoto.cropModalInstance.close();
                    $scope.profilePhoto.cropModalInstance = null;
                }

                $timeout(function () {
                    $scope.profilePhoto.resetState();
                }, 100);
            },

            initCropperFromElement: function (imgEl) {

                if (!imgEl) return;

                if ($scope.profilePhoto.cropper) {
                    $scope.profilePhoto.cropper.destroy();
                    $scope.profilePhoto.cropper = null;
                }

                $scope.profilePhoto.cropper = new Cropper(imgEl, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    responsive: true,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    background: false,

                    ready: function () {
                        $scope.$applyAsync(function () {
                            $scope.profilePhoto.updatePreview();
                        });
                    },

                    crop: function () {
                        $scope.$applyAsync(function () {
                            $scope.profilePhoto.updatePreview();
                        });
                    }
                });
            },

            updatePreview: function () {

                if (!$scope.profilePhoto.cropper) return;

                try {

                    var canvas = $scope.profilePhoto.cropper.getCroppedCanvas({
                        width: 400,
                        height: 400,
                        imageSmoothingEnabled: true,
                        imageSmoothingQuality: 'high',
                        fillColor: '#fff'
                    });

                    if (canvas) {
                        $scope.profilePhoto.croppedImage = canvas.toDataURL('image/jpeg', 0.9);
                    }

                } catch (e) {
                    console.error(e);
                }
            },

            readFileAsDataURL: function (file) {

                return new Promise(function (resolve, reject) {

                    var reader = new FileReader();

                    reader.onload = function (e) {
                        resolve(e.target.result);
                    };

                    reader.onerror = reject;

                    reader.readAsDataURL(file);
                });
            },

            triggerUpload: function (file, errFiles, user) {

                $scope.profilePhoto.resetState();

                $scope.profilePhoto.uploadedFile = file || null;
                $scope.profilePhoto.errorFile = errFiles && errFiles[0] ? errFiles[0] : null;
                $scope.profilePhoto.selectedUser = user || null;

                if ($scope.profilePhoto.errorFile) {

                    if ($scope.profilePhoto.errorFile.$error === 'maxSize') {
                        toastr.error('Ảnh vượt quá 10MB');
                    } else {
                        toastr.error('Ảnh không hợp lệ');
                    }

                    return;
                }

                if (!file) return;

                if (!user || !user.id) {
                    toastr.error('Không xác định được user');
                    return;
                }

                var fileName = (file.name || '').toLowerCase();
                var fileType = (file.type || '').toLowerCase();

                var isHeic =
                    fileType === 'image/heic' ||
                    fileType === 'image/heif' ||
                    fileName.endsWith('.heic') ||
                    fileName.endsWith('.heif');

                function loadToCropModal(finalFile) {

                    $scope.profilePhoto.uploadedFile = finalFile;

                    $scope.profilePhoto.readFileAsDataURL(finalFile).then(function (dataUrl) {

                        $scope.$applyAsync(function () {
                            $scope.profilePhoto.loadedImageData = dataUrl;
                            $scope.profilePhoto.croppedImage = null;
                        });

                        $timeout(function () {
                            $scope.profilePhoto.openCropModal();
                        }, 120);

                    }).catch(function () {
                        toastr.error('Không thể đọc ảnh');
                    });
                }

                if (isHeic) {

                    heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.9
                    }).then(function (converted) {

                        var blob = Array.isArray(converted) ? converted[0] : converted;

                        var jpgFile = new File(
                            [blob],
                            file.name.replace(/\.(heic|heif)$/i, '.jpg'),
                            {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }
                        );

                        loadToCropModal(jpgFile);

                    }).catch(function () {
                        toastr.error('Không thể chuyển HEIC sang JPG');
                    });

                } else {

                    loadToCropModal(file);

                }
            },

            canvasToFile: function (canvas, originalName) {

                return new Promise(function (resolve, reject) {

                    canvas.toBlob(function (blob) {

                        if (!blob) {
                            reject();
                            return;
                        }

                        var outputFile = new File(
                            [blob],
                            (originalName || 'avatar.jpg').replace(/\.(png|jpeg|jpg)$/i, '.jpg'),
                            {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }
                        );

                        resolve(outputFile);

                    }, 'image/jpeg', 0.85);

                });
            },

            startUploadCroppedFile: function () {

                if (!$scope.profilePhoto.cropper) {
                    toastr.error('Chưa có vùng crop');
                    return;
                }

                if (!$scope.profilePhoto.selectedUser) {
                    toastr.error('Không xác định user');
                    return;
                }

                var canvas = $scope.profilePhoto.cropper.getCroppedCanvas({
                    width: 400,
                    height: 400,
                    fillColor: '#fff'
                });

                if (!canvas) {
                    toastr.error('Không thể crop ảnh');
                    return;
                }

                $scope.profilePhoto.isUploading = true;

                $scope.profilePhoto.canvasToFile(
                    canvas,
                    $scope.profilePhoto.uploadedFile.name
                ).then(function (file) {

                    $scope.profilePhoto.startUploadFile(
                        file,
                        $scope.profilePhoto.selectedUser
                    );

                }).catch(function () {

                    toastr.error('Không thể tạo file sau crop');

                });
            },

            startUploadFile: function (file, user) {

                var url =
                    settings.api.baseUrl +
                    settings.api.apiPrefix +
                    'users/photo/upload/'+user.id;

                file.upload = Upload.upload({
                        url: url,
                        data: {
                            file: file,
                            userId: user.id,
                            username: user.username
                        }
                    })

                    .progress(function (evt) {

                        $scope.$applyAsync(function () {

                            if (!$scope.profilePhoto.uploadedFile) {
                                $scope.profilePhoto.uploadedFile = file;
                            }

                            $scope.profilePhoto.uploadedFile.progress =
                                parseInt(100 * evt.loaded / evt.total);

                        });

                    })

                    .success(function () {

                        toastr.success('Upload ảnh thành công');

                        if ($scope.profilePhoto.cropper) {
                            $scope.profilePhoto.cropper.destroy();
                        }

                        if ($scope.profilePhoto.cropModalInstance) {
                            $scope.profilePhoto.cropModalInstance.close();
                        }

                        $scope.profilePhoto.resetState();

                        vm.getUsers();

                    })

                    .error(function () {

                        toastr.error('Upload thất bại');

                        $scope.profilePhoto.isUploading = false;

                    });
            }

        };



    }

})();
