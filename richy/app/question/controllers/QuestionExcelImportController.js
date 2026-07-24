/**
 * Import flash cards from Excel.
 *
 * Backend contract:
 * POST /api/question/import_excel/preview
 *      multipart/form-data, field name: file
 *
 * POST /api/question/import_excel/confirm
 *      application/json
 */
(function () {
    'use strict';

    angular.module('Hrm.Question')
        .directive('questionExcelImport', questionExcelImport)
        .directive('questionFileSelect', questionFileSelect)
        .controller('QuestionExcelImportModalController', QuestionExcelImportModalController);

    questionExcelImport.$inject = ['$uibModal', '$timeout'];

    function questionExcelImport($uibModal, $timeout) {
        return {
            restrict: 'A',
            scope: {
                topics: '=',
                onImported: '&'
            },
            link: function (scope, element) {
                function openImportModal() {
                    var modalInstance = $uibModal.open({
                        animation: true,
                        backdrop: 'static',
                        keyboard: false,
                        size: 'lg',
                        templateUrl: 'question_excel_import_modal.html',
                        controller: 'QuestionExcelImportModalController',
                        controllerAs: 'importVm',
                        resolve: {
                            importTopics: function () {
                                return angular.copy(scope.topics || []);
                            }
                        }
                    });

                    modalInstance.result.then(function (result) {
                        if (result && result.imported) {
                            scope.onImported({
                                result: result.result
                            });
                        }
                    });
                }

                element.on('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    $timeout(function () {
                        openImportModal();
                    }, 0);
                });

                scope.$on('$destroy', function () {
                    element.off('click');
                });
            }
        };
    }

    function questionFileSelect() {
        return {
            restrict: 'A',
            scope: {
                questionFileSelect: '&'
            },
            link: function (scope, element) {
                element.on('change', function () {
                    var file = element[0].files && element[0].files.length > 0
                        ? element[0].files[0]
                        : null;

                    scope.$applyAsync(function () {
                        scope.questionFileSelect({
                            file: file
                        });
                    });
                });

                scope.$on('$destroy', function () {
                    element.off('change');
                });
            }
        };
    }

    QuestionExcelImportModalController.$inject = [
        '$uibModalInstance',
        'QuestionService',
        'toastr',
        'importTopics'
    ];

    function QuestionExcelImportModalController(
        $uibModalInstance,
        questionService,
        toastr,
        importTopics
    ) {
        var importVm = this;

        importVm.file = null;
        importVm.fileName = '';
        importVm.topics = importTopics || [];
        importVm.selectedTopic = null;
        importVm.loadingPreview = false;
        importVm.loadingConfirm = false;
        importVm.preview = null;
        importVm.updateEmptyFields = true;
        importVm.selectAll = true;

        importVm.onFileSelected = onFileSelected;
        importVm.loadPreview = loadPreview;
        importVm.confirmImport = confirmImport;
        importVm.backToFileSelection = backToFileSelection;
        importVm.toggleAllRows = toggleAllRows;
        importVm.onRowSelectionChanged = onRowSelectionChanged;
        importVm.onConflictCandidateChanged =
            onConflictCandidateChanged;
        importVm.getSelectedCount = getSelectedCount;
        importVm.isImportable = isImportable;
        importVm.getStatusText = getStatusText;
        importVm.getStatusClass = getStatusClass;
        importVm.cancel = cancel;
        importVm.downloadStaticTemplate = downloadStaticTemplate;

        function onConflictCandidateChanged(row) {
            if (!row) {
                return;
            }

            if (row.selectedExistingQuestionId) {
                row.importable = true;

                /*
                 * Tự tick sau khi chọn candidate.
                 * Người dùng vẫn có thể bỏ tick.
                 */
                row.selected = true;

                row.message =
                    'Đã chọn flashcard ID '
                    + row.selectedExistingQuestionId
                    + ' để gán topic';
            } else {
                row.importable = false;
                row.selected = false;

                row.message =
                    'Hãy chọn một flashcard để gán topic';
            }

            onRowSelectionChanged();
        }

        function downloadStaticTemplate(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            var link = document.createElement('a');

            link.href = '/question/templates/flashcard_import_template.xlsx';
            link.download = 'flashcard_import_template.xlsx';
            link.target = '_blank';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function onFileSelected(file) {
            importVm.file = file;
            importVm.fileName = file ? file.name : '';
            importVm.preview = null;

            if (!file) {
                return;
            }

            if (!isExcelFile(file.name)) {
                importVm.file = null;
                importVm.fileName = '';
                toastr.warning('Chỉ chấp nhận file .xlsx hoặc .xls', 'Excel import');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                importVm.file = null;
                importVm.fileName = '';
                toastr.warning('File không được lớn hơn 10 MB', 'Excel import');
            }
        }

        function loadPreview() {
            if (!importVm.selectedTopic || !importVm.selectedTopic.id) {
                toastr.warning('Bạn chưa chọn topic', 'Excel import');
                return;
            }

            if (!importVm.file) {
                toastr.warning('Bạn chưa chọn file Excel', 'Excel import');
                return;
            }

            importVm.loadingPreview = true;

            questionService.previewExcelImport(
                importVm.file,
                importVm.selectedTopic.id
            ).then(
                function (data) {
                    importVm.preview = normalizePreview(data);
                    importVm.preview.topicId =
                        importVm.preview.topicId || importVm.selectedTopic.id;
                    importVm.preview.topicName =
                        importVm.preview.topicName || importVm.selectedTopic.name;
                    importVm.selectAll = getSelectedCount() > 0;
                },
                function (error) {
                    toastr.error(
                        getErrorMessage(error, 'Không thể đọc file Excel'),
                        'Excel import'
                    );
                }
            ).finally(function () {
                importVm.loadingPreview = false;
            });
        }

        function confirmImport() {
            if (!importVm.preview) {
                toastr.warning('Chưa có dữ liệu preview', 'Excel import');
                return;
            }

            var selectedRows = [];

            angular.forEach(importVm.preview.rows, function (row) {
                if (row.selected && isImportable(row)) {
                    selectedRows.push({
                        rowNumber: row.rowNumber,
                        word: row.word,
                        pronounce: row.pronounce,
                        motherTongue: row.firstLanguage,
                        status: row.status,

                        existingQuestionId:
                        row.existingQuestionId ||
                        row.questionId ||
                        null,

                        selectedExistingQuestionId:
                        row.selectedExistingQuestionId ||
                        null
                    });
                }
            });

            if (selectedRows.length === 0) {
                toastr.warning('Không có dòng hợp lệ nào được chọn', 'Excel import');
                return;
            }

            if (!importVm.preview.topicId) {
                toastr.error(
                    'Server chưa trả về topicId. Hãy kiểm tra Topic ID trong file Excel.',
                    'Excel import'
                );
                return;
            }

            var request = {
                batchId: importVm.preview.batchId || null,
                topicId: importVm.preview.topicId,
                updateEmptyFields: importVm.updateEmptyFields,
                rows: selectedRows
            };

            importVm.loadingConfirm = true;

            questionService.confirmExcelImport(request).then(
                function (data) {
                    toastr.success(
                        data && data.message ? data.message : 'Import thành công',
                        'Excel import'
                    );

                    $uibModalInstance.close({
                        imported: true,
                        result: data
                    });
                },
                function (error) {
                    toastr.error(
                        getErrorMessage(error, 'Import không thành công'),
                        'Excel import'
                    );
                }
            ).finally(function () {
                importVm.loadingConfirm = false;
            });
        }

        function normalizePreview(data) {
            data = data || {};

            var rows = data.rows || data.items || [];
            var topic = data.topic || {};

            data.rows = rows;
            data.topicId = data.topicId || topic.id || null;
            data.topicName = data.topicName || topic.name || '';

            data.totalRows = angular.isDefined(data.totalRows)
                ? data.totalRows
                : rows.length;

            angular.forEach(rows, function (row) {

                /*
                 * Chuẩn hóa dữ liệu chính của từng dòng.
                 */
                row.rowNumber =
                    row.rowNumber ||
                    row.excelRow ||
                    row.index ||
                    '';

                row.word =
                    row.word ||
                    row.question ||
                    '';

                row.pronounce =
                    row.pronounce ||
                    row.pronunciation ||
                    '';

                row.firstLanguage =
                    row.firstLanguage ||
                    row.motherTongue ||
                    row.first_language ||
                    '';

                row.status =
                    (row.status || 'INVALID').toUpperCase();

                /*
                 * Backend trả candidates khi có nhiều word trùng.
                 * Nếu không có thì dùng mảng rỗng để tránh lỗi.
                 */
                row.candidates = row.candidates || [];

                /*
                 * Tạo nội dung hiển thị trong dropdown.
                 */
                angular.forEach(
                    row.candidates,
                    function (candidate) {

                        var candidateWord =
                            candidate.word ||
                            candidate.question ||
                            '';

                        var candidatePronounce =
                            candidate.pronounce ||
                            'No pronunciation';

                        var candidateMeaning =
                            candidate.motherTongue ||
                            candidate.firstLanguage ||
                            'No first language';

                        var topicStatus =
                            candidate.alreadyInTopic === true
                                ? ' | Already in topic'
                                : '';

                        candidate.displayText =
                            'ID ' + candidate.id
                            + ' | ' + candidateWord
                            + ' | ' + candidatePronounce
                            + ' | ' + candidateMeaning
                            + topicStatus;
                    }
                );

                /*
                 * Với dòng CONFLICT:
                 * - Chưa chọn candidate: không cho tick.
                 * - Đã chọn candidate: cho tick.
                 */
                if (row.status === 'CONFLICT') {

                    row.importable =
                        !!row.selectedExistingQuestionId;

                    /*
                     * Khi mới preview thì mặc định không tick.
                     */
                    if (!angular.isDefined(row.selected)) {
                        row.selected = false;
                    }

                    /*
                     * Nếu backend trả selected=true nhưng chưa chọn candidate
                     * thì vẫn phải bỏ tick.
                     */
                    if (!row.selectedExistingQuestionId) {
                        row.selected = false;
                    }

                } else {

                    /*
                     * Các trạng thái bình thường:
                     * NEW, ADD_TOPIC...
                     */
                    if (!angular.isDefined(row.importable)) {
                        row.importable =
                            isImportableStatus(row.status);
                    }

                    if (!angular.isDefined(row.selected)) {
                        row.selected = row.importable;
                    }
                }

                /*
                 * Nếu backend không trả message thì frontend tự tạo.
                 */
                if (!row.message) {
                    row.message = getStatusText(row);
                }
            });

            data.summary = buildSummary(data, rows);

            return data;
        }

        function buildSummary(data, rows) {
            var summary = {
                total: rows.length,
                newCount: 0,
                addTopicCount: 0,
                alreadyInTopicCount: 0,
                duplicateInFileCount: 0,
                invalidCount: 0,
                conflictCount: 0
            };

            angular.forEach(rows, function (row) {
                switch (row.status) {
                    case 'NEW':
                    case 'CREATE_NEW':
                        summary.newCount++;
                        break;

                    case 'ADD_TOPIC':
                    case 'EXISTING_ADD_TOPIC':
                        summary.addTopicCount++;
                        break;

                    case 'ALREADY_IN_TOPIC':
                        summary.alreadyInTopicCount++;
                        break;

                    case 'DUPLICATE_IN_FILE':
                        summary.duplicateInFileCount++;
                        break;

                    case 'CONFLICT':
                        summary.conflictCount++;
                        break;

                    default:
                        summary.invalidCount++;
                        break;
                }
            });

            summary.total = angular.isDefined(data.totalRows)
                ? data.totalRows
                : summary.total;

            summary.newCount = angular.isDefined(data.newCount)
                ? data.newCount
                : summary.newCount;

            summary.addTopicCount = angular.isDefined(data.addTopicCount)
                ? data.addTopicCount
                : summary.addTopicCount;

            summary.alreadyInTopicCount = angular.isDefined(data.alreadyInTopicCount)
                ? data.alreadyInTopicCount
                : summary.alreadyInTopicCount;

            summary.duplicateInFileCount = angular.isDefined(data.duplicateInFileCount)
                ? data.duplicateInFileCount
                : summary.duplicateInFileCount;

            summary.invalidCount = angular.isDefined(data.invalidCount)
                ? data.invalidCount
                : summary.invalidCount;

            summary.conflictCount = angular.isDefined(data.conflictCount)
                ? data.conflictCount
                : summary.conflictCount;

            return summary;
        }

        function toggleAllRows() {
            angular.forEach(importVm.preview.rows, function (row) {
                if (isImportable(row)) {
                    row.selected = importVm.selectAll;
                }
            });
        }

        function onRowSelectionChanged() {
            var importableCount = 0;
            var selectedCount = 0;

            angular.forEach(importVm.preview.rows, function (row) {
                if (isImportable(row)) {
                    importableCount++;

                    if (row.selected) {
                        selectedCount++;
                    }
                }
            });

            importVm.selectAll =
                importableCount > 0 &&
                importableCount === selectedCount;
        }

        function getSelectedCount() {
            if (!importVm.preview || !importVm.preview.rows) {
                return 0;
            }

            var count = 0;

            angular.forEach(importVm.preview.rows, function (row) {
                if (row.selected && isImportable(row)) {
                    count++;
                }
            });

            return count;
        }

        function isImportable(row) {
            if (!row) {
                return false;
            }

            if (row.status === 'CONFLICT') {
                return !!row.selectedExistingQuestionId;
            }

            if (angular.isDefined(row.importable)) {
                return row.importable === true;
            }

            return isImportableStatus(row.status);
        }

        function isImportableStatus(status) {
            return status === 'NEW' ||
                status === 'CREATE_NEW' ||
                status === 'ADD_TOPIC' ||
                status === 'EXISTING_ADD_TOPIC';
        }

        function getStatusText(row) {
            var status = row && row.status ? row.status : '';

            switch (status) {
                case 'NEW':
                case 'CREATE_NEW':
                    return 'Tạo từ mới';

                case 'ADD_TOPIC':
                case 'EXISTING_ADD_TOPIC':
                    return 'Từ đã tồn tại, sẽ gán thêm topic';

                case 'ALREADY_IN_TOPIC':
                    return 'Từ đã thuộc topic này';

                case 'DUPLICATE_IN_FILE':
                    return 'Bị trùng trong file Excel';

                case 'CONFLICT':
                    return 'Có nhiều dữ liệu trùng trong hệ thống';

                case 'INVALID':
                    return 'Dữ liệu không hợp lệ';

                default:
                    return status || 'Không xác định';
            }
        }

        function getStatusClass(row) {
            var status = row && row.status ? row.status : '';

            if (status === 'NEW' || status === 'CREATE_NEW') {
                return 'label label-success';
            }

            if (status === 'ADD_TOPIC' || status === 'EXISTING_ADD_TOPIC') {
                return 'label label-info';
            }

            if (status === 'ALREADY_IN_TOPIC') {
                return 'label label-default';
            }

            if (status === 'DUPLICATE_IN_FILE') {
                return 'label label-warning';
            }

            return 'label label-danger';
        }

        function backToFileSelection() {
            importVm.preview = null;
        }

        function cancel() {
            $uibModalInstance.dismiss('cancel');
        }

        function isExcelFile(fileName) {
            if (!fileName) {
                return false;
            }

            var lowerName = fileName.toLowerCase();

            return lowerName.lastIndexOf('.xlsx') === lowerName.length - 5 ||
                lowerName.lastIndexOf('.xls') === lowerName.length - 4;
        }

        function getErrorMessage(error, fallback) {
            if (error && error.data) {
                if (angular.isString(error.data)) {
                    return error.data;
                }

                if (error.data.message) {
                    return error.data.message;
                }

                if (error.data.error) {
                    return error.data.error;
                }
            }

            return fallback;
        }
    }
})();
