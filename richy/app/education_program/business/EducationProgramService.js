/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.EducationProgram').service('EducationProgramService', EducationProgramService);

    EducationProgramService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function EducationProgramService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getPage = getPage;
        self.saveObject = saveObject;
        self.getOne = getOne;
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;
        self.setMain = function (id) {
            return utils.resolveAlt(baseUrl + 'education_program/set_main/' + id, 'POST', null, {}, {'Content-Type':'application/json; charset=utf-8'});
        };

        var restUrl = 'education_program';
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
            // A metadata form opened earlier must not undo another user's Main selection.
            var payload = angular.copy(object); delete payload.main;
            return utils.resolveAlt(url, 'POST', null, payload, {
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
                    field: 'main',
                    title: 'Main',
                    switchable: false,
                    align: 'center',
                    formatter: function (value, row) {
                        return '<input type="radio" name="education-program-main" aria-label="Đặt chương trình làm Main" title="Dùng mặc định tại student_marks và marks" ng-checked="' + (row.main === true) + '" ng-disabled="$parent.vm.mainSaving || !$parent.vm.canSetMain()" ng-click="$parent.setMainProgram(' + Number(row.id) + ')" style="width:17px;height:17px;cursor:pointer">';
                    }
                }
                , {
                    field: 'name',
                    title: 'Tên chương trình',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'code',
                    title: 'Mã',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'schoolId',
                    title: 'School ID',
                    formatter: function (value) { return Number(value) || '—'; }
                }
                , {
                    field: 'createDate',
                    title: 'Thời gian tạo',
                    switchable: true,
                    formatter: function (value) { return value ? $filter('date')(value, 'dd/MM/yyyy HH:mm') : '—'; },
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();
