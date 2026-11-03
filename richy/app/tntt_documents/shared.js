(function () {
    'use strict';
    angular.module('Hrm.Common', []);
    angular.module('TnttPublicDocument', ['Hrm.Common']).controller('PublicDocumentController',
        ['$http', '$q', '$window', function ($http, $q, win) {
            var vm = this;
            var token = win.location.hash.slice(1);
            var unavailable = 'Liên kết không hợp lệ hoặc đã bị thu hồi.';
            if (!/^[a-f0-9]{32}$/.test(token)) {
                vm.error = unavailable;
                return;
            }
            vm.loading = true;
            $http.get('/service/public/tntt-documents/' + token, {timeout: 20000}).then(function (response) {
                vm.title = response.data.title;
                vm.document = response.data.document;
            }).catch(function (response) {
                vm.error = response.status === 404 ? unavailable : 'Không tải được tài liệu. Vui lòng thử lại.';
            }).finally(function () { vm.loading = false; });
            vm.openSession = function () {
                return {
                    document: angular.copy(vm.document), status: 'saved', ready: $q.when(),
                    save: angular.noop, changed: angular.noop, refresh: angular.noop, destroy: angular.noop
                };
            };
        }]);
}());
