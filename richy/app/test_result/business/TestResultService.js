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
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;
        self.getUsers = getUsers;
        self.getRanking = getRanking;
        self.getStudyCalendar = getStudyCalendar;

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

        function deleteObject(id, successCallback, errorCallback) {
            if (!id) {
                return $q.when(null);
            }
            var url = baseUrl+ restUrl + '/delete/' + id;
            return utils.resolveAlt(url, 'DELETE', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getTableDefinition(group) {
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
                return {1: 'Daily Vocab', 3: 'Daily Listening', 2: 'IELTS Listening', 4: 'IELTS Reading'}[value] || 'Khác';
            }

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editObject(' + "'" + row.id + "'" + ')"><i class="fa fa-eye"></i></a>'
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';;
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

            var columns = [
                // {
                //     // field: 'state',
                //     checkbox: false
                // }
                // ,
                {
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
                        if (Number(row.testType) !== 1) return '';
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
                    formatter: function (value, row) { return Number(row.testType) === 1 ? value : ''; },
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
                    formatter: function (value, row) { return Number(row.testType) === 2 || Number(row.testType) === 4 ? value : ''; },
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ];
            return columns.filter(function (column) {
                if (group === 'VOCAB') { return column.field !== 'bandScore' && column.field !== 'correctAnswer'; }
                if (group === 'DAILY_LISTENING') { return column.field !== 'resultStatus' && column.field !== 'bandScore' && column.field !== 'numberOfWords'; }
                if (group === 'IELTS') { return column.field !== 'resultStatus' && column.field !== 'numberOfWords'; }
                return true;
            });
        }
    }

})();
