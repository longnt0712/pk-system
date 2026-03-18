/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.PersonDate').service('PersonDateService', PersonDateService);

    PersonDateService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function PersonDateService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        // console.log(baseUrl);
        self.getPage = getPage;
        self.saveObject = saveObject;
        self.getOne = getOne;
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;
        self.getUsers = getUsers;
        self.saveListByEnrollmentClass = saveListByEnrollmentClass;
        self.getAllGroups = getAllGroups;

        var restUrl = 'person_date';
        function getAllGroups() {
            var url = baseUrl + 'usergroup/all';
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        function getUsers(filter, pageIndex, pageSize) {

            pageSize = 100000;

            var url = baseUrl + 'users/search';
            url += '/' + ((pageIndex > 0) ? pageIndex : 1);
            url += '/' + ((pageSize > 0) ? pageSize : 10);

            return utils.resolveAlt(url, 'POST', null, filter, {
                'Content-Type': 'application/json; charset=utf-8'
            }, angular.noop, angular.noop);
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

        function saveObject(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveListByEnrollmentClass(enrollmentClass, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save_list_by_enrollment_class/' + enrollmentClass;

            return utils.resolveAlt(url, 'POST', null, enrollmentClass, {
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

        self.test = test;
        self.getStream=getStream;
        function test(test, successCallback, errorCallback) {
            var url = baseUrl + 'file' + '/export_bill/';

            return utils.resolveAlt(url, 'POST', null, test, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getStream(){
            console.log("RUNNING");
            var deferred = $q.defer();

            $http({
                url:baseUrl +'file/exportTimeTable/'+semesterId+'/'+subjectId,
                method:"GET",//you can use also GET or POST

                headers:{'Content-type': 'application/json'},
                responseType : 'arraybuffer',//THIS IS IMPORTANT
            })
                .success(function (data) {
                    console.debug("SUCCESS");
                    deferred.resolve(data);
                }).error(function (data) {
                console.error("ERROR");
                deferred.reject(data);
            });

            return deferred.promise;
        };

        function getTableDefinition() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editObject(' + "'" + row.id + "'" + ')"><i class="icon-pencil margin-right-5"></i>Edit</a>'
                        + '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.createGaps(' + "'" + row.id + "'" + ')"><i class="fa fa-pencil margin-right-5"></i>Create gaps</a>'
                    + '<a class="green-dark margin-right-20" target="_blank" href="personDates/' + row.id +'" ><i class="fa fa-pencil margin-right-5"></i>Create normal</a>'
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash margin-right-5"></i>Delete</a>';;
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
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                {
                    field: 'state',
                    checkbox: true
                }
                , {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'createDate',
                    title: 'Ngày',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _dateFormatter
                }
                , {
                    field: 'lastName',
                    title: 'lastName',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();