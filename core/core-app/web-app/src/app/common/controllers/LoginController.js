/**
 * Created by bizic on 28/8/2016.
 */
(function () {
    'use strict';

    angular.module('Core.Common').controller('LoginController', LoginController);

    LoginController.$inject = [
        '$rootScope',
        '$scope',
        '$state',
        '$cookies',
        '$http',
        'settings',
        'constants',
        'LoginService',
        'toastr',
        'focus',
        'blockUI',
        'AuthSession'
    ];

    function LoginController($rootScope, $scope, $state, $cookies, $http, settings, constants, service, toastr, focus, blockUI, authSession) {
        var vm = this;
        vm.user = {};
        vm.isLoggingIn = false;
        vm.login = function () {
            if (vm.isLoggingIn) { return; }

            // Username?
            if (!vm.user.username || vm.user.username.trim() == '') {
                blockUI.stop();

                toastr.error('Please enter your username.', 'Error');
                focus('username');
                return;
            }

            // Password?
            if (!vm.user.password || vm.user.password.trim() == '') {
                blockUI.stop();

                toastr.error('Please enter your password.', 'Error');
                focus('password');
                return;
            }

            vm.isLoggingIn = true;
            blockUI.start();
            return service.performLogin(vm.user).then(function(response) {
                if (!response || !angular.isObject(response.data)) { throw {status: 502}; }
                var identity = response.sessionIdentity || authSession.capture();
                if (!authSession.isCurrent(identity)) { throw {sessionChanged: true}; }
                return $http.get(settings.api.baseUrl + 'api/users/getCurrentUser',
                    {loginRequest: true, timeout: 20000}).then(function (result) {
                    if (!authSession.saveUser(result.data, identity)) { return; }
                    $rootScope.$emit('$onCurrentUserData', result.data);
                    $state.go('application.dashboard');
                });
            }).catch(function (error) {
                if (error && error.sessionChanged) { return; }
                toastr.error(error && (error.status === 401 || error.data && error.data.error === 'invalid_grant')
                    ? 'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.'
                    : 'Chưa thể đăng nhập. Kiểm tra kết nối rồi thử lại.', 'Đăng nhập');
            }).finally(function () {
                vm.isLoggingIn = false;
                blockUI.stop();
            });
        };

        // Focus on username field
        focus('username');
    }

})();
