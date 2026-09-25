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
        '$window',
        '$document'
    ];

    function LoginController($rootScope, $scope, $state, $cookies, $http, settings, constants, service, toastr, focus, blockUI,$location,$window,$document) {
        var vm = this;
        vm.user = {};

        vm.openGalleryImage = function (src) {
            vm.selectedGalleryImage = src;
        };

        vm.openGalleryImageFromEvent = function (event) {
            var image = event && event.currentTarget;
            if (!image) {
                return;
            }

            vm.openGalleryImage(image.currentSrc || image.src);
        };

        vm.openGalleryImageFromKeyboard = function (event, src) {
            if (event.keyCode !== 13 && event.keyCode !== 32) {
                return;
            }

            event.preventDefault();
            if (src) {
                vm.openGalleryImage(src);
                return;
            }

            vm.openGalleryImageFromEvent(event);
        };

        vm.closeGalleryImage = function () {
            vm.selectedGalleryImage = null;
        };

        function closeGalleryOnEscape(event) {
            if (event.keyCode !== 27 || !vm.selectedGalleryImage) {
                return;
            }

            $scope.$applyAsync(vm.closeGalleryImage);
        }

        $document.on('keydown', closeGalleryOnEscape);
        $scope.$on('$destroy', function () {
            $document.off('keydown', closeGalleryOnEscape);
        });

        /*
         * Mỗi lần vào màn hình đăng nhập cho phép đúng một lần điều hướng
         * sau login. application.js sẽ ưu tiên mã phòng Battle Online đã
         * lưu khi người dùng mở link QR trước lúc đăng nhập.
         */
        if (
            angular.isFunction(
                $rootScope.resetPostLoginNavigation
            )
        ) {
            $rootScope.resetPostLoginNavigation();
        }

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

                        if (
                            angular.isFunction(
                                $rootScope.navigateAfterLogin
                            )
                        ) {
                            $rootScope.navigateAfterLogin();
                        } else {
                            $state.go('application.dashboard');
                        }
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

        vm.ieltsMoreScoreImages = [
            'https://lh3.googleusercontent.com/pw/AP1GczOB1QhB1mafyMrdYK23-jXmozijk0YKMIea1d2W1MuEk2a6SJyBoCxgPoGEn5R3Fc_scbTRyHx2HdtUebZkJ-zTrmU5SwnImXB1_NV_yD8fi9tSda8H5T5lyKpJ2bnWlAoUUgsgTezRth7jnYWiCdM3=w521-h927-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczP7w3tywg7-6lS6MXZGS4bksnmOIpzcXbohek6kUfBrzPbP5XbLn4e8t-fx22IAH8cD4WibBf330A5adDWjKRTJmCVdUihhp5bfCQpD-qmKKndLQs-YT5n1IXDGJQOPaYLR-7OQdInr3li8PJJBcit_=w521-h927-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczO5ciH-queSJlz9SJIOUTdaCA6oGQyGIN2E0EZwS1-5qyutOXNigpQZI4JHENXZXI1L9enmhEplsJTkgklcOGHwyDUaDSP0hdRem4HejfpvEReqyKs0RnlIisKFEHqYq4OM_5WTSWTyjkF4atTsrL3c=w521-h927-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczNzV78OecOKdnLiGeQ7419RTi-zGJ2O5fd_IvZq6wuwCp4gG4mGptbAGrDSd4aON_sa2j3srydmlTAkih4mXG-W16GWMgNb_hSJGJjyDPCoeGOgB0J4dW8a_ey48KdF4BLQu6thI-k4DxOUIANsJozH=w521-h927-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/AP1GczM4zkoY2cPG7epNewSnsN471l-EYnwm0xK20pna-ph-E1n4dU4tuRcvDEhKCv1Xo5aPp2iyihpHWY48nreDu7CYb-v3Hm2B_29VkZdWr3yTup586R5isx23ub6w1trWEOyRe0ZyKZHrYt382qhW8Zud=w521-h927-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/ABLVV86BtTQxbYwi7bYMjGa6rfQ0MhFCdibX3MON3QJDoydz15BDCJ4wOb-DahsiIr5Hk_cnxXlZlpULKDN5v6U2mnAYx6O6Reu14UHpm54GGHQpFDUgqAPC1UbxV9gBeszuCDhmqFEmIyqqrAFPWxtLJ9E=w425-h919-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/ABLVV85XDMxpTMJggLPyRQepDLvbGzkJNiyCGQ6aexysPC118yybKZ4Y0gvZnyPrNKW-u78T_UkAOpIEKsvgDQZMr4gslGheYEnw_K0RnmpE929ydSt_i-OwA3gzv1t-Y5anHGRZ2Bi9YAkmPUI7xYdE7uY=w425-h919-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/ABLVV86uzKyCPb6ijU2j4zOwoU2Jz96noh-yAh0xMlskB_Wkts834tFq_-gDp-FlE9r4liqiUCH2s6sFJtBfhw7pl6zSdeFESKbWqw0N-j6hp3mUHdpYqP9tB1Psg4SEv1K22SD_9zqgVx-mM_W3mYeaPGU=w425-h919-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/ABLVV84RyEtYruOGP_o-oz0AJxSw_E82L-1qt2I86v29cT0lmMEtw35kbL4lObG87g9ToJtme9DBRztIWAgM65Hh2dOq0hpAXHDV5pl1HX0QP3Cnpf93gBaVrhyB63DeAfH3uMGzQSIOEVzmkl2tFb7NpXE=w425-h919-s-no-gm?authuser=1',
            'https://lh3.googleusercontent.com/pw/ABLVV87_hfNqG7LACqgt8Chh_IAj4JF6s6Z1mB5bozNK1FXpxONnvTHv9b5X3W8nzOgwGNSPCNlNN8NuGlB1ZWlAakgl0a2-HxyhRq9ITYESwvvGYg7Q0_dPp7iM18YVTqA05T8xapgLdQwIN6LAxZFrWhs=w425-h919-s-no-gm?authuser=1'
        ].map(function (src, index) {
            return {
                number: index + 6,
                src: src
            };
        });

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
