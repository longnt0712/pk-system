/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Mark').service('MarkService', MarkService);

    MarkService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function MarkService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getPage = getPage;
        self.saveObject = saveObject;
        self.getOne = getOne;
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;

        var restUrl = 'mark';
        function getPage(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

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

        self.getPageEducationProgram = getPageEducationProgram;
        function getPageEducationProgram(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'education_program' + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
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
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash margin-right-5"></i>Delete</a>';;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
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
                    field: 'name',
                    title: 'name',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'code',
                    title: 'code',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();