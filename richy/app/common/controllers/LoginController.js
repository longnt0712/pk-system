/**
 * Created by bizic on 28/8/2016.
 */
(function () {
    'use strict';

    angular.module('Hrm.Common').controller('LoginController', LoginController);

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
        '$location',
        '$window'
    ];

    function LoginController($rootScope, $scope, $state, $cookies, $http, settings, constants, service, toastr, focus, blockUI,$location,$window) {
        var vm = this;
        vm.user = {};

        var checkHttp =  $location.protocol();
        if(checkHttp == 'http'){
             console.log(checkHttp);
             $state.go('login');
             // $window.location.href = 'https://ieltsroom.com';
        }

        //
        // service.performLogin(vm.user).then(function(response) {
        //     if (response && angular.isObject(response.data)) {
        //
        //         $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
        //             $rootScope.currentUser = response;
        //             $cookies.putObject(constants.cookies_user, $rootScope.currentUser);
        //
        //             blockUI.stop();
        //
        //             //$state.go('application.dashboard');
        //             $state.go('church');
        //         });
        //     } else {
        //         blockUI.stop();
        //         toastr.error('Something wrong happened. Please try again later.', 'Error');
        //     }
        // }).catch(function () {
        //     blockUI.stop();
        // });

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
                if (response && angular.isObject(response.data)) {

                    $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
                        $rootScope.currentUser = response;
                        $cookies.putObject(constants.cookies_user, $rootScope.currentUser);

                        // if($rootScope.currentUser.id == 1){
                            if($rootScope.currentUser.roles != null){
                                angular.forEach($rootScope.currentUser.roles, function(value, key) {
                                    if(value.name == "ROLE_ADMIN"){
                                        settings.isAdmin = true;
                                        console.log("ADMIN");
                                    }
                                });
                            }

                            
                        // }

                        blockUI.stop();

                        $state.go('application.dashboard');
                        // $state.go('church');
                    });
                } else {
                    blockUI.stop();
                    toastr.error('Something wrong happened. Please try again later.', 'Error');
                }
            }).catch(function () {
                blockUI.stop();
            });
        };

        vm.xuDoanImages = [];

        for (var i = 1; i <= 89; i++) {
            // var num = ('000' + i).slice(-3);
            var num = i;
            vm.xuDoanImages.push({
                index: i,
                src: 'assets/images/xu-doan-2022/' + num + '.jpg'
            });
        }
        
        // if($rootScope.islogOut){
        //     //ve trang login
        //     console.log('yes');
        //
        // }else{
        //     vm.user.username = 'admin';
        //     vm.user.password = 'admin';
        //
        //     blockUI.start();
        //
        //     // Username?
        //     if (!vm.user.username || vm.user.username.trim() == '') {
        //         blockUI.stop();
        //
        //         toastr.error('Please enter your username.', 'Error');
        //         focus('username');
        //         return;
        //     }
        //
        //     // Password?
        //     if (!vm.user.password || vm.user.password.trim() == '') {
        //         blockUI.stop();
        //
        //         toastr.error('Please enter your password.', 'Error');
        //         focus('password');
        //         return;
        //     }
        //
        //     service.performLogin(vm.user).then(function(response) {
        //         if (response && angular.isObject(response.data)) {
        //
        //             $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
        //                 $rootScope.currentUser = response;
        //                 $cookies.putObject(constants.cookies_user, $rootScope.currentUser);
        //
        //                 blockUI.stop();
        //
        //                 // $state.go('application.dashboard');
        //                 $state.go('church');
        //             });
        //         } else {
        //             blockUI.stop();
        //             toastr.error('Something wrong happened. Please try again later.', 'Error');
        //         }
        //     }).catch(function () {
        //         blockUI.stop();
        //     });
        //
        //
        //     console.log('no');
        // }



        // vm.login();
        // Focus on username field
        focus('username');

        // vm.login();
    }

})();