(function () {
    'use strict';

    angular.module('Hrm.StudentMark').controller('StudentMarkController', StudentMarkController);

    StudentMarkController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'StudentMarkService',
        'Upload',
        'blockUI',
        '$filter'
    ];

    angular.module('Hrm.StudentMark').directive('fileDownload', function () {
        return {
            restrict: 'A',
            scope: {
                fileDownload: '=',
                fileName: '='
            },
            link: function (scope, elem, atrs) {
                scope.$watch('fileDownload', function (newValue, oldValue) {
                    if (newValue != undefined && newValue != null) {
                        var isFirefox = typeof InstallTrigger !== 'undefined';
                        var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
                        var isIE = false || !!document.documentMode;
                        var isEdge = !isIE && !!window.StyleMedia;
                        var isChrome = !!window.chrome && !!window.chrome.webstore || window.chrome != null;
                        var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
                        var isBlink = (isChrome || isOpera) && !!window.CSS;

                        if (isFirefox || isIE || isChrome) {
                            if (isChrome) {
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var downloadLink = angular.element('<a></a>');
                                downloadLink.attr('href', fileURL);
                                downloadLink.attr('download', scope.fileName);
                                downloadLink.attr('target', '_self');
                                downloadLink[0].click();
                                url.revokeObjectURL(fileURL);
                            }
                            if (isIE) {
                                window.navigator.msSaveOrOpenBlob(scope.fileDownload, scope.fileName);
                            }
                            if (isFirefox) {
                                var url = window.URL || window.webkitURL;
                                var fileURL = url.createObjectURL(scope.fileDownload);
                                var a = elem[0];
                                a.href = fileURL;
                                a.download = scope.fileName;
                                a.target = '_self';
                                a.click();
                            }
                        } else {
                            alert('SORRY YOUR BROWSER IS NOT COMPATIBLE');
                        }
                    }
                });
            }
        };
    });

    angular.module('Hrm.StudentMark').directive('decimalInput', ['$timeout', function ($timeout) {
        function normalizeDecimal(value) {
            if (value === null || value === undefined) {
                return '';
            }

            value = String(value);

            // đổi toàn bộ dấu phẩy thành dấu chấm
            value = value.replace(/,/g, '.');

            // chỉ giữ số và dấu chấm
            value = value.replace(/[^\d.]/g, '');

            // chỉ cho phép 1 dấu chấm
            var parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }

            return value;
        }

        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, element, attrs, ngModelCtrl) {

                ngModelCtrl.$parsers.push(function (viewValue) {
                    var normalized = normalizeDecimal(viewValue);

                    if (normalized !== viewValue) {
                        ngModelCtrl.$setViewValue(normalized);
                        ngModelCtrl.$render();
                    }

                    return normalized;
                });

                element.on('input', function () {
                    var currentValue = element.val();
                    var normalized = normalizeDecimal(currentValue);

                    if (currentValue !== normalized) {
                        scope.$applyAsync(function () {
                            ngModelCtrl.$setViewValue(normalized);
                            ngModelCtrl.$render();
                        });
                    }
                });

                element.on('paste', function () {
                    $timeout(function () {
                        var currentValue = element.val();
                        var normalized = normalizeDecimal(currentValue);

                        if (currentValue !== normalized) {
                            ngModelCtrl.$setViewValue(normalized);
                            ngModelCtrl.$render();
                        }
                    });
                });
            }
        };
    }]);

    angular.module('Hrm.StudentMark').filter('removeHTMLTags', function () {
        return function (text) {
            return text ? String(text).replace(/<[^>]+>/gm, '') : '';
        };
    });

    function StudentMarkController(
        $rootScope,
        $scope,
        toastr,
        $timeout,
        settings,
        utils,
        modal,
        service,
        Upload,
        blockUI,
        $filter
    ) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.studentMark = {};
        vm.studentMarks = [];
        vm.markColumns = [];

        vm.pageIndex = 1;
        vm.pageSize = 25;
        vm.searchDto = {};

        vm.searchDisplayDto = {
            enrollmentClass: 1,
            educationProgramId: 1,
            textSearch: null,
            groupId: null
        };

        vm.selectedGroup = null;

        vm.markColumns = [];
        vm.keywordStudentName = '';

        function normalizeVietnameseTonePositionForSearch(text) {
            text = String(text || '');

            var map = {
                // oa: Hoà -> Hòa
                'oà': 'òa',
                'oá': 'óa',
                'oả': 'ỏa',
                'oã': 'õa',
                'oạ': 'ọa',

                'Oà': 'Òa',
                'Oá': 'Óa',
                'Oả': 'Ỏa',
                'Oã': 'Õa',
                'Oạ': 'Ọa',

                'OÀ': 'ÒA',
                'OÁ': 'ÓA',
                'OẢ': 'ỎA',
                'OÃ': 'ÕA',
                'OẠ': 'ỌA',

                // oe: Khoẻ -> Khỏe
                'oè': 'òe',
                'oé': 'óe',
                'oẻ': 'ỏe',
                'oẽ': 'õe',
                'oẹ': 'ọe',

                'Oè': 'Òe',
                'Oé': 'Óe',
                'Oẻ': 'Ỏe',
                'Oẽ': 'Õe',
                'Oẹ': 'Ọe',

                'OÈ': 'ÒE',
                'OÉ': 'ÓE',
                'OẺ': 'ỎE',
                'OẼ': 'ÕE',
                'OẸ': 'ỌE',

                // uy: Thuý -> Thúy
                'uỳ': 'ùy',
                'uý': 'úy',
                'uỷ': 'ủy',
                'uỹ': 'ũy',
                'uỵ': 'ụy',

                'Uỳ': 'Ùy',
                'Uý': 'Úy',
                'Uỷ': 'Ủy',
                'Uỹ': 'Ũy',
                'Uỵ': 'Ụy',

                'UỲ': 'ÙY',
                'UÝ': 'ÚY',
                'UỶ': 'ỦY',
                'UỸ': 'ŨY',
                'UỴ': 'ỤY'
            };

            return text.replace(
                /o[àáảãạ]|O[àáảãạ]|O[ÀÁẢÃẠ]|o[èéẻẽẹ]|O[èéẻẽẹ]|O[ÈÉẺẼẸ]|u[ỳýỷỹỵ]|U[ỳýỷỹỵ]|U[ỲÝỶỸỴ]/g,
                function (match) {
                    return map[match] || match;
                }
            );
        }

        function normalizeTextForStudentSearch(text) {
            var result = String(text || '');

            if (typeof result.normalize === 'function') {
                result = result.normalize('NFC');
            }

            result = normalizeVietnameseTonePositionForSearch(result);

            if (typeof result.normalize === 'function') {
                result = result.normalize('NFC');
            }

            return result
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
        }

        /*
         * ==========================================================
         * SORT TÊN GIỐNG BẢNG USER
         * ==========================================================
         *
         * Không dùng patron vì patron là tên Thánh.
         *
         * Ví dụ:
         * lastName  = Nguyễn Thị
         * firstName = Lan Anh
         *
         * Khóa sort:
         * anh | lan | thị | nguyễn
         *
         * Dùng AngularJS orderBy giống bảng User để các trường hợp
         * Linh A, An, Anh, Linh B có đúng cùng một thứ tự.
         */
        function normalizeVietnameseNameSortText(value) {
            if (value === null || value === undefined) {
                return '';
            }

            var text = String(value)
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

            /*
             * Chuẩn hóa Unicode:
             * Nguyễn và Nguyễn có thể nhìn giống nhau
             * nhưng được lưu bằng mã Unicode khác nhau.
             */
            if (typeof text.normalize === 'function') {
                text = text.normalize('NFC');
            }

            return text;
        }

        function removeTrailingNameNoteForSort(value) {
            var text = normalizeVietnameseNameSortText(value);
            var oldText;

            /*
             * Loại bỏ ghi chú ở cuối tên:
             * Hải Đăng (nghỉ học) -> Hải Đăng
             * Hoàng Long (15/3)   -> Hoàng Long
             * Đức Phúc [bỏ]       -> Đức Phúc
             */
            do {
                oldText = text;

                text = text
                    .replace(/\s*\([^()]*\)\s*$/g, '')
                    .replace(/\s*\[[^\[\]]*\]\s*$/g, '')
                    .trim();
            } while (text !== oldText);

            return text;
        }

        function buildVietnameseNameSortKey(person) {
            if (!person) {
                return '';
            }

            var lastName = normalizeVietnameseNameSortText(person.lastName);
            var firstName = removeTrailingNameNoteForSort(person.firstName);

            var fullName = normalizeVietnameseNameSortText(
                lastName + ' ' + firstName
            );

            if (!fullName) {
                return '';
            }

            var nameParts = fullName.split(' ');
            var reversedParts = [];

            for (var i = nameParts.length - 1; i >= 0; i--) {
                var part = normalizeVietnameseNameSortText(nameParts[i]);

                if (part) {
                    reversedParts.push(part);
                }
            }

            return reversedParts.join('|');
        }

        vm.getStudentNameSortValue = function (student) {
            if (
                !student ||
                !student.user ||
                !student.user.person
            ) {
                return '';
            }

            return buildVietnameseNameSortKey(
                student.user.person
            );
        };

        /*
         * Trả về mảng mới đã sắp xếp.
         * Không làm mất liên kết tới các object điểm đang sửa.
         */
        vm.sortStudentMarksLikeUserTable = function (students) {
            var source = angular.isArray(students)
                ? students
                : [];

            return $filter('orderBy')(
                source,
                vm.getStudentNameSortValue,
                false
            );
        };

        vm.filterStudentByName = function (student) {
            if (!vm.keywordStudentName || vm.keywordStudentName.trim() === '') {
                return true;
            }

            if (!student || !student.user || !student.user.person) {
                return false;
            }

            var person = student.user.person;

            var fullNameAndCode = [
                person.patron,
                person.lastName,
                person.firstName,
                student.user.username
            ].join(' ');

            var normalizedFullNameAndCode = normalizeTextForStudentSearch(fullNameAndCode);
            var normalizedKeyword = normalizeTextForStudentSearch(vm.keywordStudentName);

            return normalizedFullNameAndCode.indexOf(normalizedKeyword) !== -1;
        };;

        vm.enrollmentClasses = [];

        vm.groupChange = function () {
            if (vm.selectedGroup && vm.selectedGroup.id) {
                vm.searchDisplayDto.groupId = vm.selectedGroup.id;
            } else {
                vm.searchDisplayDto.groupId = null;
            }

            vm.getListDisplayStudentMark();
        };
        service.getAllGroups().then(function (data) {
            if (data && data.length > 0) {
                vm.groups = data;
                // console.log(vm.groups);
            } else {
                vm.groups = [];
            }
        });

        var classesReady = false, programsReady = false, boardGeneration = 0, rowGeneration = 0, shareGeneration = 0, destroyed = false;
        function initialBoard() {
            if (classesReady && programsReady) vm.getListDisplayStudentMark();
        }
        service.getEnrolmentClass(null, 1, 1000000).then(function (data) {
            vm.enrollmentClasses = data.content || [];

            var visibleClasses = vm.enrollmentClasses.filter(function (cls) { return Number(cls.schoolId) === 2; });
            if (visibleClasses.length && !visibleClasses.some(function (cls) { return cls.id === vm.searchDisplayDto.enrollmentClass; })) {
                vm.searchDisplayDto.enrollmentClass = visibleClasses[0].id;
            }

            classesReady = true;
            initialBoard();
        }, function () { vm.boardError = 'Không tải được danh sách lớp. Vui lòng tải lại trang.'; });

        service.getEducationPrograms(vm.filter, 1, 1000000).then(function (data) {
            vm.educationPrograms = data.content || [];
            if (vm.educationPrograms.length > 0) {
                vm.searchDisplayDto.educationProgramId = vm.educationPrograms[0].id;
            }
            programsReady = true;
            initialBoard();
        }, function () { vm.boardError = 'Không tải được chương trình. Vui lòng tải lại trang.'; });

        function initializeMarks(student) {
            angular.forEach(student.studentMarks || [], function (item) {
                item._lastSaved = vm.parseMarkNumber(item.markNumber);
                item._saving = false;
                item._saveError = false;
            });
            student.allowEdit = false;
        }
        vm.hasUnsavedMarks = function () {
            return (vm.studentMarks || []).some(function (student) {
                return (student.studentMarks || []).some(function (item) {
                    return item._saving || item._saveError || vm.parseMarkNumber(item.markNumber) !== item._lastSaved;
                });
            });
        };
        vm.allowEdit = function (studentMark) {
            if (vm.tableLoading || studentMark.loading) return;
            if (vm.hasUnsavedMarks()) {
                toastr.warning('Chờ điểm lưu xong. Nếu lưu lỗi, bấm Thử lưu lại trước khi đổi học sinh.');
                return;
            }
            if (studentMark.allowEdit) { studentMark.allowEdit = false; return; }
            var generation = boardGeneration, request = ++rowGeneration;
            angular.forEach(vm.studentMarks, function (row) { row.allowEdit = false; });
            studentMark.loading = true;
            studentMark.rowError = '';
            service.getStudentDisplay(vm.loadedScope, studentMark.user.id).then(function (data) {
                studentMark.loading = false;
                if (destroyed || generation !== boardGeneration || request !== rowGeneration) return;
                var fresh = data && data.length === 1 ? data[0] : null;
                if (!fresh || !fresh.user || fresh.user.id !== studentMark.user.id ||
                    JSON.stringify((fresh.studentMarks || []).map(function (i) { return i.mark.id; })) !==
                    JSON.stringify(vm.markColumns.map(function (m) { return m.id; }))) {
                    studentMark.rowError = 'Học sinh hoặc cột điểm đã thay đổi. Hãy tải lại bảng trước khi sửa.';
                    return;
                }
                // Keep the row, order and scroll position; replace only this student's cells.
                angular.forEach(vm.studentMarks, function (row) { row.allowEdit = false; });
                studentMark.studentMarks = fresh.studentMarks;
                initializeMarks(studentMark);
                studentMark.allowEdit = true;
            }, function () {
                studentMark.loading = false;
                if (!destroyed && generation === boardGeneration && request === rowGeneration)
                    studentMark.rowError = 'Không tải được điểm mới. Bấm bút chì để thử lại.';
            });
        };

        vm.getListDisplayStudentMark = function () {
            if (vm.hasUnsavedMarks()) {
                vm.searchDisplayDto = angular.copy(vm.loadedScope);
                vm.selectedGroup = (vm.groups || []).filter(function (g) { return g.id === vm.loadedScope.groupId; })[0] || null;
                toastr.warning('Chờ lưu hết điểm hoặc thử lưu lại các ô bị lỗi trước khi đổi bảng.');
                return;
            }
            var generation = ++boardGeneration, scope = angular.copy(vm.searchDisplayDto);
            if (!vm.tableLoading) blockUI.start();
            vm.tableLoading = true;
            vm.boardError = '';
            service.getListDisplayStudentMark(scope).then(function (data) {
                if (destroyed || generation !== boardGeneration) return;
                vm.tableLoading = false; blockUI.stop();
                /*
                 * Mỗi lần tải hoặc tải lại dữ liệu đều sort mặc định
                 * theo đúng AngularJS orderBy của bảng User.
                 */
                vm.studentMarks = vm.sortStudentMarksLikeUserTable(
                    data || []
                );

                angular.forEach(vm.studentMarks, function(value, key) {
                    initializeMarks(value);
                });
                vm.loadedScope = scope;

                vm.markColumns = [];
                if (vm.studentMarks.length > 0 && vm.studentMarks[0].studentMarks) {
                    angular.forEach(vm.studentMarks[0].studentMarks, function (item) {
                        if (item && item.mark) {
                            vm.markColumns.push(item.mark);
                        }
                    });
                }

            }, function () {
                if (destroyed || generation !== boardGeneration) return;
                vm.tableLoading = false; blockUI.stop();
                vm.studentMarks = []; vm.markColumns = []; vm.loadedScope = null;
                vm.boardError = 'Không tải được bảng điểm. Vui lòng chọn lại bộ lọc để thử lại.';
            });
        };

        vm.markTimeouts = {};

        vm.parseMarkNumber = function (value) {
            if (value === null || value === undefined || value === '') {
                return null;
            }

            value = String(value).replace(/,/g, '.').trim();
            var num = parseFloat(value);

            return isNaN(num) ? null : num;
        };

        vm.onMarkKeyup = function (markItem) {
            if (!markItem) return;

            var userId = markItem.user ? markItem.user.id : markItem.userId;
            var markId = markItem.mark ? markItem.mark.id : markItem.markId;

            var key = userId + '_' + markId;

            if (vm.markTimeouts[key]) {
                $timeout.cancel(vm.markTimeouts[key]);
            }

            vm.markTimeouts[key] = $timeout(function () {
                var normalizedValue = vm.parseMarkNumber(markItem.markNumber);

                if (markItem._lastSaved === normalizedValue) {
                    return;
                }

                delete vm.markTimeouts[key];
                vm.saveMark(markItem);
            }, 1000);
        };

        vm.saveMark = function (markItem) {
            if (!markItem || destroyed || markItem._saving) {
                return;
            }

            var normalizedMarkNumber = vm.parseMarkNumber(markItem.markNumber);
            if (!markItem._saveError && normalizedMarkNumber === markItem._lastSaved) return;
            markItem._saving = true;
            markItem._saveError = false;

            var dto = {
                id: markItem.id,
                markNumber: normalizedMarkNumber,
                markText: markItem.markText,
                user: {
                    id: markItem.user ? markItem.user.id : null
                },
                mark: {
                    id: markItem.mark ? markItem.mark.id : null
                }
            };

            // Utilities.resolveAlt invokes legacy callbacks without response data;
            // the promise is the authoritative response (including a newly created ID).
            service.saveObject(dto).then(function success(response) {
                markItem._saving = false;
                if (destroyed) return;
                toastr.success('Đã cập nhật điểm thành công', 'Thông báo');

                if (response && response.id) {
                    markItem.id = response.id;
                }

                // Only acknowledge the sent value. Do not overwrite newer typing.
                markItem._lastSaved = normalizedMarkNumber;
                if (vm.parseMarkNumber(markItem.markNumber) !== normalizedMarkNumber) vm.saveMark(markItem);
            }, function failure() {
                markItem._saving = false;
                markItem._saveError = true;
                if (destroyed) return;
                toastr.error('Có lỗi khi cập nhật điểm', 'Lỗi');
            });
        };

        $scope.$on('$destroy', function () {
            destroyed = true; boardGeneration++; rowGeneration++; shareGeneration++;
            angular.forEach(vm.markTimeouts, function (timer) { $timeout.cancel(timer); });
            if (vm.tableLoading) blockUI.stop();
            if (vm.shareModal) vm.shareModal.dismiss();
        });

        vm.openShare = function () {
            if (!vm.loadedScope || vm.tableLoading || vm.hasUnsavedMarks()) {
                toastr.warning('Chọn bảng điểm và chờ lưu hết điểm trước khi tạo link.'); return;
            }
            if (!vm.loadedScope.enrollmentClass || !vm.loadedScope.educationProgramId) {
                toastr.warning('Cần chọn một lớp và một chương trình cụ thể.'); return;
            }
            vm.shareScope = angular.copy(vm.loadedScope);
            vm.shareScope.keywordStudentName = vm.keywordStudentName || '';
            vm.shareClassName = (vm.enrollmentClasses.filter(function (c) { return c.id === vm.shareScope.enrollmentClass; })[0] || {}).name;
            vm.shareProgramName = (vm.educationPrograms.filter(function (p) { return p.id === vm.shareScope.educationProgramId; })[0] || {}).name;
            vm.shareLink = ''; vm.shareError = ''; vm.shareItems = []; vm.shareBusy = true;
            var generation = ++shareGeneration;
            vm.shareModal = modal.open({templateUrl: 'student_mark_share_modal.html', scope: $scope, size: 'lg'});
            if (vm.shareModal.result) vm.shareModal.result.then(closeShare, closeShare);
            function closeShare() { if (generation === shareGeneration) { shareGeneration++; vm.shareModal = null; } }
            service.listShares(vm.shareScope).then(function (items) {
                if (destroyed || generation !== shareGeneration) return;
                vm.shareItems = items || []; vm.shareBusy = false;
            }, function () { if (destroyed || generation !== shareGeneration) return; vm.shareBusy = false; vm.shareError = 'Không có quyền chia sẻ lớp này hoặc không tải được danh sách link.'; });
        };
        vm.canShare = function () {
            var permissions = $rootScope.settings || {};
            return permissions.isAdmin === true || permissions.isEducationManagerment === true || permissions.isStudentManagerment === true;
        };
        vm.createShare = function () {
            if (vm.shareBusy || vm.hasUnsavedMarks()) return;
            var generation = shareGeneration;
            vm.shareBusy = true; vm.shareError = '';
            service.createShare(vm.shareScope).then(function (item) {
                if (destroyed || generation !== shareGeneration) return;
                vm.shareBusy = false;
                vm.shareLink = window.location.protocol + '//' + window.location.host + item.relativeUrl;
                vm.shareItems.unshift(item);
            }, function (error) {
                if (destroyed || generation !== shareGeneration) return;
                vm.shareBusy = false;
                vm.shareError = error && error.data && error.data.message || 'Không tạo được link. Kiểm tra quyền chia sẻ và chọn lớp/chương trình.';
            });
        };
        vm.revokeShare = function (item) {
            if (vm.shareBusy || item.revoked || !window.confirm('Thu hồi link này? Người nhận sẽ không xem được nữa.')) return;
            var generation = shareGeneration;
            vm.shareBusy = true;
            service.revokeShare(item.id).then(function () {
                if (destroyed || generation !== shareGeneration) return;
                item.revoked = true; vm.shareBusy = false;
                if (item.relativeUrl && vm.shareLink.indexOf(item.relativeUrl) !== -1) vm.shareLink = '';
            }, function () { if (destroyed || generation !== shareGeneration) return; vm.shareBusy = false; vm.shareError = 'Không thu hồi được link. Vui lòng thử lại.'; });
        };
        vm.copyShare = function () {
            var input = document.getElementById('student-mark-share-link');
            if (!input) return;
            input.focus(); input.select();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(vm.shareLink).then(function () { toastr.success('Đã sao chép link'); }, function () { toastr.info('Bấm Ctrl+C để sao chép link đã chọn.'); });
            } else if (document.execCommand('copy')) toastr.success('Đã sao chép link');
            else toastr.info('Bấm Ctrl+C để sao chép link đã chọn.');
        };

        vm.getMarkValueClass = function(markNumber) {
            markNumber = vm.parseMarkNumber(markNumber);

            if (markNumber === null) {
                return '';
            }

            if (markNumber < 5) {
                return 'mark-danger';
            }

            if (markNumber >= 8) {
                return 'mark-good';
            }

            return 'mark-normal';
        };

        vm.getWeightedAverage = function(studentMarks) {
            if (!studentMarks || !studentMarks.length) {
                return '';
            }

            var totalScore = 0;
            var totalCoefficient = 0;

            angular.forEach(studentMarks, function(item) {
                if (!item) {
                    return;
                }

                var markNumber = vm.parseMarkNumber(item.markNumber);
                var coefficient = 1;

                if (item.mark && item.mark.coefficient != null && item.mark.coefficient !== undefined) {
                    coefficient = parseFloat(item.mark.coefficient) || 1;
                }

                if (markNumber !== null) {
                    totalScore += markNumber * coefficient;
                    totalCoefficient += coefficient;
                }
            });

            if (totalCoefficient === 0) {
                return '';
            }

            return (totalScore / totalCoefficient).toFixed(2);
        };

        function pad2(value) {
            value = String(value);
            return value.length < 2 ? '0' + value : value;
        }

        function getDateTimeForFileName() {
            var now = new Date();

            var yyyy = now.getFullYear();
            var mm = pad2(now.getMonth() + 1);
            var dd = pad2(now.getDate());
            var hh = pad2(now.getHours());
            var mi = pad2(now.getMinutes());

            return yyyy + mm + dd + '_' + hh + mi;
        }

        function findNameById(list, id) {
            var result = '';

            angular.forEach(list || [], function (item) {
                if (String(item.id) === String(id)) {
                    result = item.name || '';
                }
            });

            return result;
        }

        function getStudentFullName(student) {
            if (!student || !student.user || !student.user.person) {
                return '';
            }

            var person = student.user.person;

            return [
                person.patron,
                person.lastName,
                person.firstName
            ].join(' ').replace(/\s+/g, ' ').trim();
        }

        function formatDateToDDMMYYYY(value) {
            if (!value) {
                return '';
            }

            // Trường hợp backend trả về dạng mảng: [2020, 5, 12]
            if (angular.isArray(value) && value.length >= 3) {
                return pad2(value[2]) + '/' + pad2(value[1]) + '/' + value[0];
            }

            // Trường hợp backend trả về timestamp
            if (typeof value === 'number') {
                var dateFromNumber = new Date(value);

                if (!isNaN(dateFromNumber.getTime())) {
                    return pad2(dateFromNumber.getDate()) + '/' +
                        pad2(dateFromNumber.getMonth() + 1) + '/' +
                        dateFromNumber.getFullYear();
                }
            }

            // Trường hợp backend trả về chuỗi yyyy-MM-dd hoặc yyyy-MM-ddTHH:mm:ss
            if (typeof value === 'string') {
                var match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

                if (match) {
                    return match[3] + '/' + match[2] + '/' + match[1];
                }

                // Trường hợp đã là dd/MM/yyyy thì giữ nguyên
                var matchVN = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

                if (matchVN) {
                    return value;
                }
            }

            // Trường hợp là Date object
            var date = new Date(value);

            if (isNaN(date.getTime())) {
                return '';
            }

            return pad2(date.getDate()) + '/' +
                pad2(date.getMonth() + 1) + '/' +
                date.getFullYear();
        }

        vm.getStudentBirthDate = getStudentBirthDate;
        function getStudentBirthDate(student) {
            if (!student) {
                return '';
            }

            var person = null;

            if (student.user && student.user.person) {
                person = student.user.person;
            }

            var birthDate = '';

            if (person) {
                birthDate =
                    person.birthDate ||
                    person.birthdate ||
                    person.dateOfBirth ||
                    person.dob ||
                    person.birthday;
            }

            // Dự phòng nếu ngày sinh nằm trực tiếp trong student
            birthDate =
                birthDate ||
                student.birthDate ||
                student.birthdate ||
                student.dateOfBirth ||
                student.dob ||
                student.birthday;

            return formatDateToDDMMYYYY(birthDate);
        }

        function getFilteredStudentMarksForExport() {
            var filteredStudents = (vm.studentMarks || []).filter(function (student) {
                return vm.filterStudentByName(student);
            });

            /*
             * Excel, ảnh và dữ liệu table dùng chung đúng thứ tự.
             */
            return vm.sortStudentMarksLikeUserTable(
                filteredStudents
            );
        }

        function getMarkValueByMarkId(student, markId) {
            var result = '';

            angular.forEach(student.studentMarks || [], function (item) {
                var currentMarkId = null;

                if (item.mark && item.mark.id !== undefined && item.mark.id !== null) {
                    currentMarkId = item.mark.id;
                } else if (item.markId !== undefined && item.markId !== null) {
                    currentMarkId = item.markId;
                }

                if (String(currentMarkId) === String(markId)) {
                    if (item.markNumber !== null && item.markNumber !== undefined) {
                        result = item.markNumber;
                    }
                }
            });

            return result;
        }

        function buildStudentMarkExportInfo() {
            return {
                className: findNameById(vm.enrollmentClasses, vm.searchDisplayDto.enrollmentClass),
                educationProgramName: findNameById(vm.educationPrograms, vm.searchDisplayDto.educationProgramId)
            };
        }

        function buildStudentMarkTableRows() {
            var students = getFilteredStudentMarksForExport();

            var rows = [];

            var headerRow = [
                'STT',
                'Tên học sinh',
                'Ngày sinh'
            ];

            angular.forEach(vm.markColumns || [], function (mark) {
                headerRow.push(mark.name || '');
            });

            headerRow.push('Trung bình');

            rows.push(headerRow);

            angular.forEach(students, function (student, index) {
                var row = [
                    index + 1,
                    getStudentFullName(student),
                    getStudentBirthDate(student)
                ];

                angular.forEach(vm.markColumns || [], function (mark) {
                    row.push(getMarkValueByMarkId(student, mark.id));
                });

                row.push(vm.getWeightedAverage(student.studentMarks));

                rows.push(row);
            });

            return rows;
        }

        vm.exportStudentMarksExcel = function () {
            if (!window.XLSX) {
                toastr.error('Thiếu thư viện XLSX để xuất Excel', 'Lỗi');
                return;
            }

            var students = getFilteredStudentMarksForExport();

            if (!students.length) {
                toastr.warning('Không có dữ liệu để xuất', 'Thông báo');
                return;
            }

            var info = buildStudentMarkExportInfo();
            var tableRows = buildStudentMarkTableRows();

            var excelRows = [];

            excelRows.push(['DANH SÁCH ĐIỂM']);
            excelRows.push([
                'Lớp',
                info.className || '',
                'Chương trình',
                info.educationProgramName || ''
            ]);
            excelRows.push([]);

            excelRows = excelRows.concat(tableRows);

            var worksheet = XLSX.utils.aoa_to_sheet(excelRows);

            var totalColumns = tableRows[0] ? tableRows[0].length : 1;

            worksheet['!merges'] = [
                {
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: totalColumns - 1 }
                }
            ];

            var columnWidths = [
                { wch: 8 },
                { wch: 30 },
                { wch: 15 }
            ];

            angular.forEach(vm.markColumns || [], function () {
                columnWidths.push({ wch: 15 });
            });

            columnWidths.push({ wch: 15 });

            worksheet['!cols'] = columnWidths;

            var workbook = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách điểm');

            var fileName = 'danh_sach_diem_' + getDateTimeForFileName() + '.xlsx';

            XLSX.writeFile(workbook, fileName);
        };

        function createStudentMarkImageElement(info, tableRows) {
            var wrapper = document.createElement('div');

            wrapper.style.position = 'absolute';
            wrapper.style.left = '-99999px';
            wrapper.style.top = '0';
            wrapper.style.background = '#ffffff';
            wrapper.style.padding = '20px';
            wrapper.style.fontFamily = 'Arial, sans-serif';
            wrapper.style.color = '#000000';

            var title = document.createElement('h3');

            title.innerText = 'DANH SÁCH ĐIỂM';
            title.style.textAlign = 'center';
            title.style.margin = '0 0 15px 0';
            title.style.fontWeight = 'bold';

            wrapper.appendChild(title);

            var meta = document.createElement('div');

            meta.style.marginBottom = '12px';
            meta.style.fontSize = '14px';

            meta.innerHTML =
                '<strong>Lớp:</strong> ' + (info.className || '') +
                ' &nbsp;&nbsp;&nbsp; <strong>Chương trình:</strong> ' + (info.educationProgramName || '');

            wrapper.appendChild(meta);

            var table = document.createElement('table');

            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.fontSize = '13px';

            angular.forEach(tableRows, function (row, rowIndex) {
                var tr = document.createElement('tr');

                angular.forEach(row, function (cell, cellIndex) {
                    var td = document.createElement(rowIndex === 0 ? 'th' : 'td');

                    td.innerText = cell === null || cell === undefined ? '' : String(cell);

                    td.style.border = '1px solid #333333';
                    td.style.padding = '6px 8px';
                    td.style.whiteSpace = 'nowrap';

                    if (rowIndex === 0) {
                        td.style.textAlign = 'center';
                        td.style.fontWeight = 'bold';
                        td.style.background = '#eeeeee';
                    } else {
                        if (cellIndex === 0 || cellIndex >= 3) {
                            td.style.textAlign = 'center';
                        } else {
                            td.style.textAlign = 'left';
                        }
                    }

                    tr.appendChild(td);
                });

                table.appendChild(tr);
            });

            wrapper.appendChild(table);

            return wrapper;
        }

        function downloadCanvasAsPng(canvas, fileName) {
            var link = document.createElement('a');

            link.href = canvas.toDataURL('image/png');
            link.download = fileName;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        vm.exportStudentMarksImage = function () {
            if (!window.html2canvas) {
                toastr.error('Thiếu thư viện html2canvas để xuất ảnh', 'Lỗi');
                return;
            }

            var students = getFilteredStudentMarksForExport();

            if (!students.length) {
                toastr.warning('Không có dữ liệu để xuất', 'Thông báo');
                return;
            }

            var info = buildStudentMarkExportInfo();
            var tableRows = buildStudentMarkTableRows();

            var exportElement = createStudentMarkImageElement(info, tableRows);

            document.body.appendChild(exportElement);

            html2canvas(exportElement, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true
            }).then(function (canvas) {
                var fileName = 'danh_sach_diem_' + getDateTimeForFileName() + '.png';

                downloadCanvasAsPng(canvas, fileName);

                if (exportElement && exportElement.parentNode) {
                    exportElement.parentNode.removeChild(exportElement);
                }

            }).catch(function () {
                if (exportElement && exportElement.parentNode) {
                    exportElement.parentNode.removeChild(exportElement);
                }

                toastr.error('Có lỗi khi xuất ảnh', 'Lỗi');
            });
        };
    }
})();
