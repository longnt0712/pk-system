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

        var restUrl = 'test_result';
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

        function getTableDefinition() {

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

            return [
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
                    title: 'Test',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
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
                    title: 'Number of Words',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'correctAnswer',
                    title: 'Correct Answer',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'bandScore',
                    title: 'Band',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();