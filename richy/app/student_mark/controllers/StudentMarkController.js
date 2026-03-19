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
        'Upload'
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

    function StudentMarkController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, Upload) {
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
            service.getListDisplayStudentMark(vm.searchDisplayDto).then(function (data) {
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
    }
})();