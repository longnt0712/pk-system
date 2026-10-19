/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.TestResult').service('TestResultService', TestResultService);

    TestResultService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function TestResultService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getPage = getPage;
        self.saveObject = saveObject;
        self.getOne = getOne;
        self.saveWritingFeedback = saveWritingFeedback;
        self.deleteObject = deleteObject;
        self.deleteObjects = deleteObjects;
        self.getTableDefinition = getTableDefinition;
        self.getResultStatusFeedback = getResultStatusFeedback;
        self.getUsers = getUsers;
        self.getRanking = getRanking;
        self.getStudyCalendar = getStudyCalendar;
        self.gradeWritingTestResult = gradeWritingTestResult;

        var restUrl = 'test_result';

        self.getEnrolmentClass = getEnrolmentClass;
        function getEnrolmentClass(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'enrolment_class' + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }
        
        function getPage(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getRanking(searchDto,successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_ranking';

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getStudyCalendar(searchDto, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/study_calendar';

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getUsers(filter, pageIndex, pageSize) {

            var url = baseUrl + 'users/search';
            url += '/' + ((pageIndex > 0) ? pageIndex : 1);
            url += '/' + ((pageSize > 0) ? pageSize : 10);

            return utils.resolveAlt(url, 'POST', null, filter, {
                'Content-Type': 'application/json; charset=utf-8'
            }, angular.noop, angular.noop);
        }

        function saveObject(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getOne(id) {
            if (!id) {
                return $q.when(null);
            }

            var url = baseUrl + restUrl+'/' + 'get_one/' + id;
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        function gradeWritingTestResult(id) {
            if (!id) {
                return $q.reject(new Error('Missing Writing test result ID.'));
            }
            return $http({
                method: 'POST',
                url: baseUrl + restUrl + '/grade-writing/' + id,
                timeout: 130000,
                cache: false,
                headers: {'Content-Type': 'application/json; charset=utf-8'}
            }).then(function (response) {
                return response.data;
            });
        }

        function saveWritingFeedback(id, payload) {
            if (!id) {
                return $q.reject(new Error('Missing Writing test result ID.'));
            }
            return $http({
                method: 'POST',
                url: baseUrl + restUrl + '/writing-feedback/' + id,
                data: payload,
                headers: {'Content-Type': 'application/json; charset=utf-8'}
            }).then(function (response) {
                return response.data;
            });
        }

        function deleteObject(id, successCallback, errorCallback) {
            if (!id) {
                return $q.when(null);
            }
            var url = baseUrl+ restUrl + '/delete/' + id;
            return utils.resolveAlt(url, 'DELETE', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function deleteObjects(ids) {
            if (!angular.isArray(ids) || !ids.length) {
                return $q.when(0);
            }
            return $http({
                method: 'POST',
                url: baseUrl + restUrl + '/delete-many',
                data: ids,
                headers: {'Content-Type': 'application/json; charset=utf-8'}
            }).then(function (response) {
                return Number(response.data) || 0;
            });
        }

        function getResultStatusFeedback(result) {
            result = result || {};
            var status = String(result.resultStatus || '').trim().toUpperCase();
            if (Number(result.testType) === 5 || status === 'BATTLE') {
                return {label: 'Battle', tone: 'info', message: 'Bài làm Battle đã được lưu.'};
            }
            if (status === 'SUCCESS') {
                var successMessage = 'Bài làm đã được lưu và đạt yêu cầu.';
                successMessage += result.assignmentTaskId != null
                    ? ' Lượt này chỉ được tính vào tiến độ khi đúng bài được giao, đúng topic/phần và trong thời hạn; chưa xác nhận đủ mọi bài trong task.'
                    : ' Kết quả này không gắn với task, nên không tự cộng tiến độ bài được giao.';
                return {label: 'Đạt yêu cầu', tone: 'success', message: successMessage};
            }
            if (status === 'FAILED') {
                var message = 'Bài làm đã được lưu nhưng chưa đạt yêu cầu.';
                if (result.assignmentTaskId != null) {
                    message += ' Lượt làm này chưa được tính hoàn thành phần bài được giao; học sinh cần làm lại.';
                } else {
                    message += ' Học sinh cần luyện tập và làm lại.';
                }
                return {label: 'Chưa đạt', tone: 'warning', message: message};
            }
            return {label: 'Đã lưu', tone: 'info', message: 'Bài làm đã được lưu; chưa có thông tin đánh giá đạt yêu cầu.'};
        }

        function getTableDefinition(group, allowDelete) {
            function escapeText(value) {
                return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
                    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character];
                });
            }
            function topicFormatter(value, row) {
                var topics = row.topics || [], assignedId = row.assignmentTaskId != null && Number(row.testType) === 1
                    ? row.assignmentTopicId : null;
                var assigned = null, related = topics;
                if (assignedId != null) {
                    topics.forEach(function (topic) { if (String(topic.id) === String(assignedId)) { assigned = topic; } });
                    related = topics.filter(function (topic) { return String(topic.id) !== String(assignedId); });
                }
                var html = assignedId == null ? ''
                    : '<div class="test-result-assigned-topic" style="white-space:normal;padding:6px 8px;margin:3px 0 5px;border:1px solid #c7d6f8;border-radius:6px;background:#edf3ff;color:#234b94"'
                        + ' title="Chỉ topic được giao này được đối chiếu để tính tiến độ task; cần đạt yêu cầu và trong thời hạn.">'
                        + '<strong>Topic được giao:</strong> ' + escapeText(assigned && assigned.name ? assigned.name : 'Topic #' + assignedId) + '</div>';
                if (related.length) {
                    if (assignedId != null) {
                        html += '<div class="test-result-related-topics" style="font-size:11px;color:#718096"'
                            + ' title="Các topic liên quan đến nội dung câu hỏi; không tự cộng thêm bài hoàn thành.">Topic liên quan đến nội dung:</div>';
                    }
                    html += related.map(function (topic) {
                        return '<div class="test-result-topic-line" style="white-space:normal;padding:4px 0">'
                            + escapeText(topic.name || ('Topic #' + topic.id)) + '</div>';
                    }).join('');
                }
                return html || escapeText(value); // Historical title-only results remain readable.
            }
            function typeFormatter(value) {
                return {1: 'Daily Vocab', 3: 'Daily Listening', 2: 'IELTS Listening', 4: 'IELTS Reading', 5: 'Battle Online', 6: 'Bài tập tổng hợp', 7: 'IELTS Writing'}[value] || 'Khác';
            }

            var _tableOperation = function (value, row, index) {
                var actions = '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editObject(' + "'" + row.id + "'" + ')"><i class="fa fa-eye"></i></a>';
                if (allowDelete && row.canDelete === true) {
                    actions += '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
                }
                return actions;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM HH:mm:ss');
            };

            var _userFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return value.displayName;
            };

            var columns = [{
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'testName',
                    title: 'Topic / Bài đã làm',
                    formatter: topicFormatter,
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'testType', title: 'Loại bài', formatter: typeFormatter, switchable: true
                }, {
                    field: 'assignmentTaskId',
                    title: 'Nguồn làm bài',
                    formatter: function (value, row) {
                        if (value != null) {
                            return '<span class="label label-primary" title="Nguồn: Task #' + escapeText(value)
                                + '. Nhãn nguồn không xác nhận hoàn thành; chỉ lượt đạt đúng bài và trong thời hạn mới được tính tiến độ."><i class="fa fa-tasks"></i> Bài tập</span>';
                        }
                        return '<span class="label label-default" title="Không gắn với task; kết quả này không tự động tính hoàn thành bài được giao.">'
                            + '<i class="fa fa-unlink"></i> Không gắn task</span>';
                    },
                    sortable: false,
                    switchable: true,
                    cellStyle: _cellNowrap
                }, {
                    field: 'resultStatus', title: 'Kết quả', switchable: true,
                    formatter: function (value, row) {
                        var result = {testType: row.testType, resultStatus: value, assignmentTaskId: row.assignmentTaskId};
                        var feedback = getResultStatusFeedback(result);
                        if (feedback.label === 'Battle') {
                            return '<span class="label" style="background:linear-gradient(135deg,#6d5dfc,#168fc6);color:#fff">Battle</span>';
                        }
                        return '<span class="label test-result-status-badge label-' + feedback.tone + '" title="' + escapeText(feedback.message)
                            + '">' + escapeText(feedback.label) + '</span>';
                    },
                    cellStyle: _cellNowrap
                }, {
                    field: 'user',
                    title: 'Test Taker',
                    sortable: true,
                    switchable: false,
                    formatter: _userFormatter,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'testTakerName',
                //     title: 'Test Taker (old)',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }

                , {
                    field: 'testDate',
                    title: 'Test Date',
                    sortable: true,
                    switchable: false,
                    formatter: _dateFormatter,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'testTime',
                    title: 'Test time',
                    sortable: true,
                    switchable: false,
                    // formatter: _dateFormatter,
                    cellStyle: _cellNowrap
                }, {
                    field: 'numberOfWords',
                    title: 'Từ đạt',
                    formatter: function (value, row) { return Number(row.testType) === 1 || Number(row.testType) === 7 ? value : ''; },
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }, {
                    field: 'writingIntegrityFlagged',
                    title: 'Kiểm tra',
                    formatter: function (value, row) {
                        if (Number(row.testType) !== 7) { return ''; }
                        var reasons = (row.writingIntegrityReasons || []).join('; ');
                        if (value === true) {
                            return '<span class="label label-warning" title="' + escapeText(reasons)
                                + '"><i class="fa fa-exclamation-triangle"></i> Cần kiểm tra</span>';
                        }
                        return '<span class="label label-success"><i class="fa fa-check"></i> Bình thường</span>';
                    },
                    sortable: false,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'correctAnswer',
                    title: 'Correct Answer',
                    formatter: function (value, row) { return Number(row.testType) !== 1 ? value : ''; },
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'bandScore',
                    title: 'Band',
                    formatter: function (value, row) {
                        if (Number(row.testType) === 7) {
                            if (row.writingTeacherBand) { return escapeText(row.writingTeacherBand); }
                            return row.aiOverallBand != null ? escapeText(row.aiOverallBand) : '<span class="text-muted">Chưa chấm</span>';
                        }
                        return Number(row.testType) === 2 || Number(row.testType) === 4 ? value : '';
                    },
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ];
            if (allowDelete) {
                columns.unshift({
                    field: 'state',
                    checkbox: true,
                    formatter: function (value, row) {
                        return {disabled: row.canDelete !== true};
                    }
                });
            }
            return columns.filter(function (column) {
                if (column.field === 'writingIntegrityFlagged') { return group === 'WRITING'; }
                if (group === 'VOCAB') { return column.field !== 'bandScore' && column.field !== 'correctAnswer'; }
                if (group === 'DAILY_LISTENING') { return column.field !== 'bandScore' && column.field !== 'numberOfWords'; }
                if (group === 'IELTS') { return column.field !== 'numberOfWords'; }
                if (group === 'WRITING') { return column.field !== 'correctAnswer'; }
                if (group === 'COMPREHENSIVE') { return column.field !== 'bandScore' && column.field !== 'numberOfWords'; }
                if (group === 'BATTLE') { return column.field !== 'bandScore' && column.field !== 'correctAnswer' && column.field !== 'numberOfWords'; }
                return true;
            });
        }
    }

})();
