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
        'blockUI'
    ];

    function LoginController($rootScope, $scope, $state, $cookies, $http, settings, constants, service, toastr, focus, blockUI) {
        var vm = this;
        vm.login = function () {

            blockUI.start();

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

            service.performLogin(vm.user).then(function(response) {

                blockUI.stop();

                if (angular.isDefined(response) && angular.isObject(response.data)) {
                    $state.go('application.dashboard');
                } else {
                    toastr.error('Something wrong happened. Please try again later.', 'Error');
                }

            }).catch(function () {
                blockUI.stop();
            });
        };

        // Focus on username field
        focus('username');
    }

})();