/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.VoucherCrocs').service('VoucherCrocsService', VoucherCrocsService);

    VoucherCrocsService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities'
    ];

    function VoucherCrocsService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        console.log(baseUrl);
        self.getPage = getPage;
        self.saveObject = saveObject;
        self.getOne = getOne;
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;

        self.getItems = getItems;
        self.getJb = getJb;
        self.processVoucher = processVoucher;
        self.getDefaultPrice = getDefaultPrice;
        self.getStream = getStream;
        self.getStreamQuantity = getStreamQuantity;

        self.getStreamBody = getStreamBody;
        self.getStreamDelivery = getStreamDelivery;
        self.getPageShop = getPageShop;

        var restUrl = 'voucher_crocs';

        function getPageShop(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'shop' + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function processVoucher(searchDto, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/process_voucher';
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getStream(searchDto){
            console.log("RUNNING");
            var deferred = $q.defer();

            $http({
                url:baseUrl +'file/export_voucher_crocs/',
                method:"POST",//you can use also GET or POST
                data: searchDto,
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

        function getStreamDelivery(searchDto){
            console.log("RUNNING");
            var deferred = $q.defer();

            $http({
                url:baseUrl +'file/export_delivery/',
                method:"POST",//you can use also GET or POST
                data: searchDto,
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

        function getStreamQuantity(searchDto){
            console.log("RUNNING");
            var deferred = $q.defer();

            $http({
                url:baseUrl +'file/export_quantity/',
                method:"POST",//you can use also GET or POST
                data: searchDto,
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

        function getStreamBody(searchDto){
            console.log("RUNNING");
            var deferred = $q.defer();

            $http({
                url:baseUrl +'file/export_body/',
                method:"POST",//you can use also GET or POST
                data: searchDto,
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

        function getPage(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page';
            url += '/' + pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getDefaultPrice(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'default_price' + '/get_page';
            url += '/' + pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getJb(searchDto, successCallback, errorCallback) {
            var url = baseUrl + 'item' + '/get_list_sticker';
            // url += '/'+pageIndex;
            // url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getItems(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'item' + '/get_page';
            url += '/' + pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            console.log(url);

            return utils.resolveAlt(url, 'POST', null, null, {
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

            var url = baseUrl + restUrl + '/' + 'get_one/' + id;
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        function deleteObject(id, successCallback, errorCallback) {
            if (!id) {
                return $q.when(null);
            }
            var url = baseUrl + restUrl + '/delete/' + id;
            return utils.resolveAlt(url, 'DELETE', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getTableDefinition() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.editObject(' + "'" + row.id + "'" + ')"><i class="icon-pencil margin-right-5"></i>Edit</a>'
                    + '<a class="green-dark margin-right-20" href="#" data-ng-click="$parent.deleteObject(' + "'" + row.id + "'" + ')"><i class="fa fa-trash margin-right-5"></i>Delete</a>';
                ;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _VoucherCrocsType = function (value, row, index, field) {
                if (value == 1) {
                    return 'duet';
                }
                if (value == 2) {
                    return 'jibitz';
                }
                if (value == 1) {
                    return 'band';
                }
                return '';
            };
            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            var _userFormatter = function (value, row, index) {
                if (value == null) {
                    return '';
                }
                return value.displayName;
            };

            var _shopNameFormatter = function (value, row, index) {
                if (value == null) {
                    return '';
                }
                return value.code;
            };

            var _numberFormatter = function (value, row, index) {
                if (value == null) {
                    return '';
                }
                return $filter('number')(value, 0);
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
                    title: 'Mã',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'customerName',
                    title: 'Tên khách hàng',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                }
                , {
                    field: 'quantityCrocs',
                    title: 'Số lượng dép',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'quantitySticker',
                    title: 'Số Jb',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'voucherDate',
                    title: 'Ngày lập hóa đơn',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _dateFormatter
                }
                , {
                    field: 'phoneNumber',
                    title: 'Số điện thoại',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'totalAmountIssue',
                    title: 'Tổng tiền',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _numberFormatter
                }
                , {
                    field: 'shopDto',
                    title: 'Tên shop',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _shopNameFormatter
                }
                , {
                    field: 'user',
                    title: 'Người chốt',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _userFormatter
                }

            ]
        }
    }

})();