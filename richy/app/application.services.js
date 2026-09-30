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
                        sessionRefreshRequest: true, timeout: 20000}
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

    // One non-blocking connection notice shared by all API requests.
    Hrm.factory('NetworkStatus', ['$window', '$timeout', 'toastr',
        function ($window, $timeout, toastr) {
            var state = 'ready';
            var notice = null;
            var slowRequests = 0;
            var serviceRoot = Hrm.API_SERVER_URL.replace(/\/$/, '') + '/';

            function show(next, message, kind, persistent) {
                if (state === next) { return; }
                state = next;
                if (notice) { toastr.clear(notice); }
                notice = toastr[kind || 'warning'](message, 'Kết nối', {
                    timeOut: persistent ? 0 : 5000,
                    extendedTimeOut: persistent ? 0 : 1000,
                    closeButton: true
                });
            }
            function offline() {
                show('offline', 'Mất kết nối Internet. Vui lòng kiểm tra Wi-Fi hoặc dữ liệu di động.', 'warning', true);
            }
            function online() {
                if (state !== 'ready') {
                    show('checking', 'Thiết bị đã có mạng trở lại. Đang kiểm tra kết nối đến máy chủ…', 'info', false);
                }
            }
            function finish(config) {
                var watch = config && config.networkWatch;
                if (!watch || watch.finished) { return false; }
                watch.finished = true;
                $timeout.cancel(watch.timer);
                if (watch.slow) { slowRequests--; }
                return true;
            }
            function recovered() {
                if ($window.navigator.onLine !== false && slowRequests === 0 && state !== 'ready') {
                    show('ready', 'Kết nối đã ổn định trở lại.', 'success', false);
                }
            }
            return {
                start: function () {
                    $window.addEventListener('offline', offline);
                    $window.addEventListener('online', online);
                    if ($window.navigator.onLine === false) { offline(); }
                    return function () {
                        $window.removeEventListener('offline', offline);
                        $window.removeEventListener('online', online);
                        if (notice) { toastr.clear(notice); }
                    };
                },
                begin: function (config) {
                    if (!config.url || config.url.indexOf(serviceRoot) !== 0 || config.skipNetworkNotice) { return; }
                    var watch = config.networkWatch = {finished: false, slow: false};
                    watch.timer = $timeout(function () {
                        if (!watch.finished && !$window.document.hidden &&
                            $window.navigator.onLine !== false && (state === 'ready' || state === 'slow')) {
                            watch.slow = true;
                            slowRequests++;
                            show('slow', 'Yêu cầu đang mất nhiều thời gian hơn bình thường. Vui lòng chờ thêm…', 'info', true);
                        }
                    }, 8000);
                },
                success: function (response) {
                    if (finish(response.config)) { recovered(); }
                },
                failure: function (error) {
                    if (!finish(error.config)) { return; }
                    if (error.sessionChanged || error.xhrStatus === 'abort') {
                        if (state === 'slow' && slowRequests === 0) {
                            if (notice) { toastr.clear(notice); notice = null; }
                            state = 'ready';
                        }
                        return;
                    }
                    if ($window.navigator.onLine === false) { offline(); }
                    else if (error.status <= 0 || error.status === 408 || error.status === 504) {
                        show('unreachable', 'Chưa kết nối được với máy chủ hoặc yêu cầu đã quá thời gian chờ. Vui lòng thử lại.', 'warning', true);
                    } else if (error.status >= 500 || error.status === 429) {
                        show('server', 'Máy chủ đang bận hoặc tạm thời gián đoạn. Vui lòng thử lại sau ít phút.', 'warning', true);
                    } else { recovered(); }
                }
            };
        }
    ]);

    Hrm.factory('ServerExceptionHandlerInterceptor', [
        '$q',
        'toastr',
        'blockUI',
        'NetworkStatus',
        function ($q, toastr, blockUI, networkStatus) {
            return {
                request: function (config) {
                    networkStatus.begin(config);
                    return config;
                },
                response: function (response) {
                    networkStatus.success(response);
                    return response;
                },
                responseError: function (rejection) {
                    var config = rejection.config || {};
                    networkStatus.failure(rejection);
                    // Login errors are displayed beside the login form.
                    if (rejection.status == 400 && !config.loginRequest && !config.sessionRefreshRequest) {
                        toastr.error('Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.', 'Thông báo');
                    }
                    if (rejection.status == 403 && !config.loginRequest) {
                        toastr.error('Bạn không có quyền thực hiện thao tác này.', 'Lỗi (403)');
                    }
					
					if (rejection.status == 409) {
                        toastr.error('Có lỗi xảy ra. Xin vui lòng thử lại sau.', 'Lỗi (409)');
                    }

                    if (!config.backgroundSessionCheck && !config.sessionRefreshRequest && !config.loginRequest) {
                        blockUI.stop();
                    }

                    return $q.reject(rejection);
                }
            };
        }
    ]);

})();
