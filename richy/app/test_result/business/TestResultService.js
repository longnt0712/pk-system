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

        function getTableDefinition(group, allowDelete) {
            function escapeText(value) {
                return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
                    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character];
                });
            }
            function topicFormatter(value, row) {
                if (row.topics && row.topics.length) {
                    return row.topics.map(function (topic) {
                        return '<div class="test-result-topic-line" style="white-space:normal;padding:4px 0">'
                            + escapeText(topic.name || ('Topic #' + topic.id)) + '</div>';
                    }).join('');
                }
                return escapeText(value); // Historical title-only results remain readable.
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
                    field: 'resultStatus', title: 'Kết quả', switchable: true,
                    formatter: function (value, row) {
                        if (Number(row.testType) === 5 || value === 'BATTLE') {
                            return '<span class="label" style="background:linear-gradient(135deg,#6d5dfc,#168fc6);color:#fff">Battle</span>';
                        }
                        if (Number(row.testType) !== 1 && Number(row.testType) !== 7) return '';
                        return value === 'FAILED'
                            ? '<span class="label label-danger">Thất bại</span>'
                            : '<span class="label label-success">Thành công</span>';
                    }
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
                if (group === 'VOCAB') { return column.field !== 'bandScore' && column.field !== 'correctAnswer'; }
                if (group === 'DAILY_LISTENING') { return column.field !== 'resultStatus' && column.field !== 'bandScore' && column.field !== 'numberOfWords'; }
                if (group === 'IELTS') { return column.field !== 'resultStatus' && column.field !== 'numberOfWords'; }
                if (group === 'WRITING') { return column.field !== 'correctAnswer'; }
                if (group === 'COMPREHENSIVE') { return column.field !== 'resultStatus' && column.field !== 'bandScore' && column.field !== 'numberOfWords'; }
                if (group === 'BATTLE') { return column.field !== 'bandScore' && column.field !== 'correctAnswer' && column.field !== 'numberOfWords'; }
                return true;
            });
        }
    }

})();
