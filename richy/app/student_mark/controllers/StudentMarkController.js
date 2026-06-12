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

    function StudentMarkController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload,blockUI) {
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

        vm.searchDisplayDto = {};
        vm.searchDisplayDto.enrollmentClass = 1;
        vm.searchDisplayDto.educationProgramId = 1;
        vm.searchDisplayDto.textSearch = null;

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

        service.getEnrolmentClass(null, 1, 1000000).then(function (data) {
            vm.enrollmentClasses = data.content || [];

            if (vm.enrollmentClasses.length > 0 && !vm.searchDisplayDto.enrollmentClass) {
                vm.searchDisplayDto.enrollmentClass = vm.enrollmentClasses[0].id;
            }

            vm.getListDisplayStudentMark();
        });

        service.getEducationPrograms(vm.filter, 1, 1000000).then(function (data) {
            vm.educationPrograms = data.content || [];
            if (vm.educationPrograms.length > 0) {
                vm.searchDisplayDto.educationProgramId = vm.educationPrograms[0].id;
            }
        });

        vm.allowEdit = function (studentMark) {
            angular.forEach(vm.studentMarks, function(value, key) {
                if (value.id == studentMark.id) {
                    value.allowEdit = true;
                } else {
                    value.allowEdit = false;
                }
            });
        };

        vm.getListDisplayStudentMark = function () {
            blockUI.start();
            service.getListDisplayStudentMark(vm.searchDisplayDto).then(function (data) {
                blockUI.stop();
                vm.studentMarks = data || [];

                angular.forEach(vm.studentMarks, function(value, key) {
                    value.allowEdit = false;
                });

                vm.markColumns = [];
                if (vm.studentMarks.length > 0 && vm.studentMarks[0].studentMarks) {
                    angular.forEach(vm.studentMarks[0].studentMarks, function (item) {
                        if (item && item.mark) {
                            vm.markColumns.push(item.mark);
                        }
                    });
                }

                console.log("vm.studentMarks =", vm.studentMarks);
                console.log("vm.markColumns =", vm.markColumns);
            });
        };

        vm.getListDisplayStudentMark();
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

                vm.saveMark(markItem);
                markItem._lastSaved = normalizedValue;
            }, 1000);
        };

        vm.saveMark = function (markItem) {
            if (!markItem) {
                return;
            }

            var normalizedMarkNumber = vm.parseMarkNumber(markItem.markNumber);

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

            service.saveObject(dto, function success(response) {
                toastr.success('Đã cập nhật điểm thành công', 'Thông báo');

                if (response && response.id) {
                    markItem.id = response.id;
                }

                // đồng bộ lại model sau khi save
                markItem.markNumber = normalizedMarkNumber;
            }, function failure() {
                toastr.error('Có lỗi khi cập nhật điểm', 'Lỗi');
            });
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
            return (vm.studentMarks || []).filter(function (student) {
                return vm.filterStudentByName(student);
            });
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