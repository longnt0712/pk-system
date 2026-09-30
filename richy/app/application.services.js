(function () {

    'use strict';

    /* Setup global constants */
    Hrm.constant('constants', {
        cookies_user: 'education.user',
        oauth2_token: 'token'
    });

    Hrm.factory('AuthSession', ['$q', '$injector', '$rootScope', '$cookies', 'OAuthToken', 'constants',
        function ($q, $injector, $rootScope, $cookies, token, constants) {
            var refreshPromise = null;
            var sessionGeneration = 0;
            var options = {path: '/', secure: window.location.protocol === 'https:'};

            function clear() {
                sessionGeneration++;
                token.removeToken();
                $cookies.remove(constants.cookies_user, options);
                $rootScope.currentUser = null;
            }

            function expire(expectedHeader) {
                // Ignore responses belonging to an earlier login/logout.
                if (expectedHeader && token.getAuthorizationHeader() !== expectedHeader) { return; }
                clear();
                $rootScope.$emit('session:expired');
            }

            function refresh(expectedHeader) {
                if (refreshPromise) { return refreshPromise; }
                if (expectedHeader && token.getAuthorizationHeader() !== expectedHeader) {
                    return $q.when();
                }
                var oldToken = token.getToken() || {};
                if (!oldToken.refresh_token) {
                    expire(expectedHeader);
                    return $q.reject({status: 401, data: {error: 'invalid_grant'}});
                }
                var generation = oldToken.refresh_token;
                var startedGeneration = sessionGeneration;
                var body = 'grant_type=refresh_token&client_id=' + encodeURIComponent(Hrm.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Hrm.API_CLIENT_KEY) +
                    '&refresh_token=' + encodeURIComponent(generation);
                refreshPromise = $injector.get('$http').post(
                    Hrm.API_SERVER_URL.replace(/\/$/, '') + '/oauth/token', body,
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}, skipSessionAuth: true,
                        sessionRefreshRequest: true}
                ).then(function (response) {
                    var current = token.getToken() || {};
                    if (sessionGeneration !== startedGeneration || current.refresh_token !== generation) {
                        return $q.reject({status: -1, sessionChanged: true});
                    }
                    token.setToken(response.data);
                    return response;
                }, function (error) {
                    var current = token.getToken() || {};
                    if (sessionGeneration === startedGeneration && current.refresh_token === generation && error.status === 400 &&
                        error.data && error.data.error === 'invalid_grant') {
                        expire();
                    }
                    // Network/server failures leave the token available for another attempt.
                    return $q.reject(error);
                }).finally(function () { refreshPromise = null; });
                return refreshPromise;
            }

            return {
                refresh: refresh,
                expire: expire,
                restore: function () {
                    var value = token.getToken();
                    if (value && !value.session_expires_at) { token.setToken(value); }
                },
                saveUser: function (user) {
                    var value = token.getToken();
                    if (!value) { return; }
                    $rootScope.currentUser = user;
                    $cookies.putObject(constants.cookies_user, user, angular.extend({}, options,
                        {expires: new Date(value.session_expires_at)}));
                },
                logout: function () {
                    var header = token.getAuthorizationHeader();
                    clear();
                    // Capture the header before clearing the cookie so revocation
                    // remains authenticated, even if a refresh is in progress.
                    if (!header) { return $q.when(); }
                    return $injector.get('$http').delete(
                        Hrm.API_SERVER_URL.replace(/\/$/, '') + '/oauth/logout',
                        {headers: {Authorization: header}, skipSessionAuth: true}
                    ).catch(function () { /* Local logout also works offline. */ });
                }
            };
        }
    ]);

    Hrm.factory('SessionAuthInterceptor', ['$q', '$injector', 'OAuthToken',
        function ($q, $injector, token) {
            var apiRoot = Hrm.API_SERVER_URL.replace(/\/$/, '') + '/api/';
            function isApi(config) {
                return config && !config.skipSessionAuth && config.url.indexOf(apiRoot) === 0;
            }
            function retry(config) {
                if (!token.getAccessToken()) {
                    return $q.reject({status: 401, sessionChanged: true});
                }
                // Preserve FormData/Blob upload bodies; deep copying them loses
                // the browser's native data. Only the headers need a new object.
                var next = angular.extend({}, config, {headers: angular.extend({}, config.headers)});
                next.sessionAuthRetried = true;
                delete next.headers.Authorization;
                return $injector.get('$http')(next);
            }
            return {
                request: function (config) {
                    config.headers = config.headers || {};
                    if (isApi(config) && !config.headers.hasOwnProperty('Authorization')) {
                        var header = token.getAuthorizationHeader();
                        if (header) {
                            config.headers.Authorization = header;
                            config.sessionAuthHeader = header;
                            config.sessionAuthRefresh = token.getRefreshToken();
                        }
                    }
                    return config;
                },
                responseError: function (error) {
                    var config = error.config;
                    if (!isApi(config) || error.status !== 401 || !config.sessionAuthHeader) {
                        return $q.reject(error);
                    }
                    if (token.getRefreshToken() !== config.sessionAuthRefresh || !token.getAccessToken()) {
                        return $q.reject(error);
                    }
                    var session = $injector.get('AuthSession');
                    if (config.sessionAuthRetried) {
                        session.expire(config.sessionAuthHeader);
                        return $q.reject(error);
                    }
                    return session.refresh(config.sessionAuthHeader).then(function () {
                        return retry(config);
                    });
                }
            };
        }
    ]);

    Hrm.filter('weekDay', [function () {
        return function (input) {
            if (input < 2 || input > 8) {
                return '';
            }

            var arr = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
            return arr[input - 2];
        };
    }]);

    /* Setup global settings */
    Hrm.factory('settings', ['$rootScope', '$state', 'constants', function ($rootScope, $state, constants) {
        // supported languages
        var settings = {
            layout: {
                pageSidebarClosed: false, // sidebar menu state
                pageContentWhite: true, // set page content layout
                pageBodySolid: true // solid body color state
                // pageAutoScrollOnLoad: 1000, // auto scroll to top on page load,
            },
            locale: 'vi-VN',
            assetsPath: 'assets',
            api: {
                baseUrl: Hrm.API_SERVER_URL,
                apiPrefix: Hrm.API_PREFIX,
                clientId: Hrm.API_CLIENT_ID,
                clientKey: Hrm.API_CLIENT_KEY,
                oauth: {
                    token: constants.oauth2_token
                }
            }
        };

        $rootScope.settings = settings;

        return settings;
    }]);

    /**
     * Set focus on element
     */
    Hrm.factory('focus', ['$timeout', '$window', function ($timeout, $window) {
        return function (id) {
            $timeout(function () {
                var element = $window.document.getElementById(id);
                if (element)
                    element.focus();
            });
        };
    }]);

    /**
     * Invoke bstable API_PREFIX
     */
    Hrm.factory('bsTableAPI', ['$window', function ($window) {
        return function (id, api, parameter) {
            var element = $window.document.getElementById(id);
            if (element && element.hasAttribute('bs-table-control')) {
                return $(element).bootstrapTable(api, parameter);
            }
        };
    }]);

    /**
     * No server response interceptor
     */
    Hrm.factory('ServerExceptionHandlerInterceptor', [
        '$q',
        'toastr',
        '$cookies',
        '$injector',
        'blockUI',
        'constants',
        function ($q, toastr, $cookies, $injector, blockUI, constants) {
            return {
                responseError: function (rejection) {
                    if (rejection.status <= 0) {
                        toastr.warning('Kết nối đang gián đoạn. Phiên đăng nhập vẫn được giữ; vui lòng thử lại khi có mạng.', 'Cảnh báo');
                    }

                    if (rejection.status == 400 && !(rejection.config && rejection.config.sessionRefreshRequest)) {
                        toastr.error('Sai thông tin đăng nhập', 'Lỗi (400)');
                    }

                    if (rejection.status == 401) {
                        // Force refresh token in application.run()
                    }

                    if (rejection.status == 403) {
                        toastr.error('Bạn không có quyền thực hiện thao tác này.', 'Lỗi (403)');
                    }
					
					if (rejection.status == 409) {
                        toastr.error('Có lỗi xảy ra. Xin vui lòng thử lại sau.', 'Lỗi (409)');
                    }

                    if (rejection.status == 500) {
                        toastr.error('Đã có lỗi xảy ra với hệ thống. Xin vui lòng thử lại sau.', 'Lỗi (500)');
                    }

                    blockUI.stop();

                    return $q.reject(rejection);
                }
            };
        }
    ]);

})();
