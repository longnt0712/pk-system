/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.BodyLearning').service('BodyLearningService', BodyLearningService);

    BodyLearningService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function BodyLearningService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getTableLeftDefinition = getTableLeftDefinition;
        self.getTableRightDefinition = getTableRightDefinition;
        self.getRandomAllObject = getRandomAllObject;

        var restUrl = 'body_learning';

        function getRandomAllObject() {
            var url = baseUrl + 'body' + '/' + 'get_random_all';
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        function getTableLeftDefinition() {

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

            var _index = function (value, row, index, field) {
                console.log(index%10);
                return index%10 + 1;
            };

            return [
                {
                    field: 'state',
                    checkbox: true
                }
                , {
                    field: '',
                    title: 'index',
                    switchable: true,
                    visible: true,
                    formatter: _index,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'text',
                    title: 'Words',
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }

        function getTableRightDefinition() {

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

            var _index = function (value, row, index, field) {
                console.log(index%10);
                return index%10 + 1;
            };

            return [
                {
                    field: 'state',
                    checkbox: true
                }
                , {
                    field: '',
                    title: 'index',
                    switchable: true,
                    visible: true,
                    formatter: _index,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'text',
                    title: 'Words',
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();