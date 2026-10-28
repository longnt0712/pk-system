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
    Core.run(['$rootScope', 'settings', '$http', '$cookies', '$state', '$injector', 'constants', 'OAuth', 'blockUI', 'toastr', 'Idle', 'Keepalive', 'AuthSession',
        function ($rootScope, settings, $http, $cookies, $state, $injector, constants, OAuth, blockUI, toastr, Idle, Keepalive, authSession) {
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
                authSession.logout();
                $state.go('login');
            });

            authSession.restore();
            $rootScope.$on('session:expired', function () {
                blockUI.stop();
                toastr.warning('Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.', 'Đăng nhập');
                $rootScope.$emit('$unauthorized', function () {});
                $state.go('login');
            });

            var userCheckInFlight = false;
            $rootScope.$on('$locationChangeSuccess', function () {
                if (!authSession.hasCredentials()) {
                    if ($rootScope.currentUser || $cookies.getObject(constants.cookies_user)) {
                        authSession.expire();
                        return;
                    }
                    $rootScope.$emit('$unauthorized', function () {});
                    $state.go('login');
                    return;
                }
                if (userCheckInFlight) { return; }
                userCheckInFlight = true;
                var identity = authSession.capture();
                blockUI.start();
                $http.get(settings.api.baseUrl + 'api/users/getCurrentUser', {timeout: 15000})
                    .then(function (response) {
                        if (!authSession.saveUser(response.data, identity)) { return; }
                        $rootScope.$emit('$onCurrentUserData', response.data);
                        if ($state.current.name === 'login') {
                            $state.go('application.dashboard');
                        }
                    }, function (error) {
                        if (error.status === 401 && authSession.isCurrent(identity)) { authSession.expire(); }
                    }).finally(function () {
                        userCheckInFlight = false;
                        blockUI.stop();
                    });
            });
        }
    ]);

})(window);
