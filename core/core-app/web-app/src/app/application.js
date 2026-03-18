(function () {
    'use strict';

    /* Core App */
    if (typeof window.Core == 'undefined') {
        var Core = angular.module('Core', [
            'ui.router',
            'ui.bootstrap',
            'oc.lazyLoad',
            'ngSanitize',
            'ngCookies',
            'angular-oauth2',
            'blockUI',
            'ngFileUpload',
            'uiCropper',
            'toastr',
            'ngIdle',

            // Sub modules
            'Core.Common',
            'Core.Dashboard',
            'Core.Settings',
            'Core.User'
        ]);

        window.Core = Core;
    }
    Core.API_SERVER_URL = 'http://localhost:8080/core/'; //
    Core.API_CLIENT_ID = 'education_client';
    Core.API_CLIENT_KEY = 'password';
    Core.API_PREFIX = 'api/';

    /* Init global settings and run the app */
    Core.run(['$rootScope', 'settings', '$http', '$cookies', '$state', '$injector', 'constants', 'OAuth', 'blockUI', 'toastr', 'Idle', 'Keepalive',
        function ($rootScope, settings, $http, $cookies, $state, $injector, constants, OAuth, blockUI, toastr, Idle, Keepalive) {
            $rootScope.$state = $state; // state to be accessed from view
            $rootScope.$settings = settings; // state to be accessed from view

            // Idle management
            Idle.watch();
            Keepalive.start();

            $rootScope.$on('IdleStart', function() {
                $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
                    if (response) {
                        /* Display modal warning or sth */
                        $rootScope.idleToastr = toastr.warning('Bạn đã ngưng làm việc trên hệ thống một khoảng thời gian khá lâu. Phiên làm việc của bạn sẽ tự động kết thúc ngay sau đây nếu bạn không thực hiện một thao tác nào.', 'Cảnh báo...', {
                            timeOut: 60000, // 60 seconds
                            closeButton: true,
                            progressBar: true});
                    }
                }).error(function (response, status, headers, config) {
                });
            });

            $rootScope.$on('IdleEnd', function() {
                if ($rootScope.idleToastr) {
                    toastr.remove($rootScope.idleToastr);
                }
            });

            $rootScope.$on('IdleTimeout', function() {
                OAuth.revokeToken();

                $cookies.remove(constants.oauth2_token);
                $state.go('login');
            });

            // oauth2...
            $rootScope.$on('oauth:error', function (event, rejection) {

                blockUI.stop();

                // Ignore `invalid_grant` error - should be catched on `LoginController`.
                if (angular.isDefined(rejection.data) && 'invalid_grant' === rejection.data.error) {
                    toastr.error('Tên đăng nhập hoặc mật khẩu không đúng. Xin mời thử lại.', 'Lỗi');

                    $cookies.remove(constants.oauth2_token);
                    $state.go('login');

                    return;
                }

                // Refresh token when a `invalid_token` error occurs.
                if (angular.isDefined(rejection.data) && 'invalid_token' === rejection.data.error) {
                    return OAuth.getRefreshToken();
                }

                // Redirect to `/login` with the `error_reason`.
                $rootScope.$emit('$unauthorized', function (event, data) {});
                $state.go('login');
            });

            $rootScope.$on('$locationChangeSuccess', function (event) {

                if (!OAuth.isAuthenticated()) {
                    $rootScope.$emit('$unauthorized', function (event, data) {});
                    $state.go('login');
                }

                blockUI.start();
                $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
                    blockUI.stop();
                    if (response) {
                        $rootScope.$emit('$onCurrentUserData', response);

                        if ($state.current.name == 'login') {
                            $state.go('application.dashboard');
                        }
                    }
                }).error(function (response, status, headers, config) {
                    blockUI.stop();
                    $cookies.remove(constants.oauth2_token);
                    $state.go('login');
                });
            });
        }
    ]);

})(window);
