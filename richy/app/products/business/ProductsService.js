/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Products').service('ProductsService', ProductsService);

    ProductsService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function ProductsService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getPage = getPage;
        self.getPageBills = getPageBills;
        self.saveObject = saveObject;
        self.saveBill = saveBill;
        self.saveBillForManager = saveBillForManager;
        self.getOne = getOne;
        self.getOneBill = getOneBill;
        self.deleteObject = deleteObject;
        self.deleteBill = deleteBill;
        self.getTableDefinition = getTableDefinition;
        self.getTableDefinitionImportedBills = getTableDefinitionImportedBills;
        self.saveList = saveList;
        self.saveListSticker = saveListSticker;
        self.getStatistics = getStatistics;
        self.getListUsers = getListUsers;

        function getListUsers() {
            var url = baseUrl + 'users' + '/' + 'get-all-user';
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        var restUrl = 'product';
        function getPage(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getPageBills(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'bill' + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getStatistics(searchDto, successCallback, errorCallback) {
            var url = baseUrl + 'bill' + '/get_page_statistics';

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

        function saveBill(object, successCallback, errorCallback) {
            var url = baseUrl + 'bill' + '/save';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveBillForManager(object, successCallback, errorCallback) {
            var url = baseUrl + 'bill' + '/save_bill_for_manager';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveList(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save_list';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveListSticker(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save_list_sticker';

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

        function getOneBill(id) {
            if (!id) {
                return $q.when(null);
            }

            var url = baseUrl + 'bill'+'/' + 'get_one/' + id;
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

        function deleteBill(id, successCallback, errorCallback) {
            if (!id) {
                return $q.when(null);
            }
            var url = baseUrl+ 'bill' + '/delete/' + id;
            return utils.resolveAlt(url, 'POST', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getTableDefinition() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editObject(' + "'" + row.id + "'" + ')"><i class="icon-pencil margin-right-5"></i>Edit</a>'
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash margin-right-5"></i>Delete</a>'
                +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.addProduct(' + "'" + row.id + "'" + ')"><i class="fa fa-plus margin-right-5"></i>ADD</a>';

            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _price = function (value, row, index, field) {
                return $filter('number')(value, 0);
            };

            var _itemType = function (value, row, index, field) {
                if(value == 1){
                    return 'duet';
                }
                if(value == 2){
                    return 'jibitz';
                }
                if(value == 1){
                    return 'band';
                }
                return '';
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
                    field: 'code',
                    title: 'Tên',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'name',
                    title: 'Tên',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'firstPrice',
                    title: 'Giá nhập',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _price
                }
                , {
                    field: 'secondPrice',
                    title: 'Giá bán',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _price
                }
                , {
                    field: 'quantity',
                    title: 'Số tồn kho',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }

        function getTableDefinitionImportedBills() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editImportedBill(' + "'" + row.id + "'" + ')"><i class="icon-pencil margin-right-5"></i>Sửa</a>'
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteImportedBill(' + "'" + row.id + "'" + ')"><i class="fa fa-trash margin-right-5"></i>Xóa</a>'
                    +  '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.exportProducts(' + "'" + row + "'" + ')"><i class="fa fa-pencil margin-right-5"></i>Xuất kho</a>';
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _price = function (value, row, index, field) {
                return $filter('number')(value, 0);
            };

            var _quantity = function (value, row, index, field) {
                return $filter('number')(value, 0);
            };

            var _type = function (value, row, index, field) {
                if(value == 1){
                    return 'nhập';
                }
                if(value == 2){
                    return 'xuất';
                }
                return '';
            };

            var _product = function (value, row, index, field) {
                if(value == null){
                    return;
                }
                if(value.name == null){
                    return;
                }
                return value.name;
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
                // , {
                //     field: 'code',
                //     title: 'Tên',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                // , {
                //     field: 'name',
                //     title: 'Tên',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                , {
                    field: 'product',
                    title: 'Sản phẩm',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _product
                }
                , {
                    field: 'firstPrice',
                    title: 'Giá nhập',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _price
                }
                , {
                    field: 'quantity',
                    title: 'Số lượng',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'sumImportedPrice',
                    title: 'Tổng tiền nhập',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _price

                }
                , {
                    field: 'description',
                    title: 'Ghi chú',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                }
                // , {
                //     field: 'secondPrice',
                //     title: 'Giá bán',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap,
                //     formatter: _price
                // }
                // , {
                //     field: 'ordinalNumber',
                //     title: 'Số j',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
            ]
        }
    }

})();