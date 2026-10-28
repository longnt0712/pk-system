(function () {

    'use strict';

    /* Setup global constants */
    Hrm.constant('constants', {
        cookies_user: 'education.user',
        oauth2_token: 'token',
        auth_session: 'education.auth-session'
    });

    Hrm.factory('AuthSession', ['$q', '$injector', '$rootScope', '$cookies', 'OAuthToken', 'constants',
        function ($q, $injector, $rootScope, $cookies, token, constants) {
            var refreshPromise = null;
            var refreshIdentity = null;
            var sessionGeneration = 0;
            var expirationNotified = false;
            var options = {path: '/', secure: window.location.protocol === 'https:'};

            function credentialKey(value) {
                return value && (value.refresh_token || value.access_token);
            }

            function capture() {
                return {generation: sessionGeneration, marker: $cookies.getObject(constants.auth_session),
                    credential: credentialKey(token.getToken())};
            }

            function isCurrent(identity) {
                return !!identity && identity.generation === sessionGeneration &&
                    identity.marker === $cookies.getObject(constants.auth_session) &&
                    identity.credential === credentialKey(token.getToken());
            }

            function advanceSession() {
                sessionGeneration++;
                // A shared marker also invalidates pending work in another tab,
                // including password logins that started with no token cookie.
                var marker = Date.now() + '-' + Math.random().toString(36).slice(2);
                $cookies.putObject(constants.auth_session, marker,
                    angular.extend({}, options, {expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}));
                return marker;
            }

            function revoke(value) {
                var refresh = value && value.refresh_token;
                var secret = refresh || (value && value.access_token);
                if (!secret) { return $q.when(); }
                return $injector.get('$http').post(
                    Hrm.API_SERVER_URL.replace(/\/$/, '') + '/oauth/revoke',
                    'token=' + encodeURIComponent(secret) + '&token_type_hint=' + (refresh ? 'refresh_token' : 'access_token') +
                    '&client_id=' + encodeURIComponent(Hrm.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Hrm.API_CLIENT_KEY),
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}, skipSessionAuth: true,
                        sessionRevokeRequest: true, timeout: 20000}
                ).catch(function () { /* Local logout also works offline. */ });
            }

            function discardIssuedToken(value) {
                // Concurrent logins for the same user may reuse the same refresh
                // token. Never revoke credentials belonging to the winning login.
                if (credentialKey(value) && credentialKey(value) !== credentialKey(token.getToken())) {
                    revoke(value);
                }
            }

            function changed() { return {status: -1, sessionChanged: true}; }

            function installToken(value, identity) {
                token.setToken(value);
                var installed = {generation: identity.generation, marker: identity.marker,
                    credential: credentialKey(value)};
                // Cookie writes in different tabs are not atomic. Check again
                // after writing and fail closed if another tab superseded us.
                if (!isCurrent(installed)) {
                    var current = token.getToken();
                    if (current && current.access_token === value.access_token &&
                        current.refresh_token === value.refresh_token) { token.removeToken(); }
                    discardIssuedToken(value);
                    return null;
                }
                return installed;
            }

            function clear() {
                advanceSession();
                token.removeToken();
                $cookies.remove(constants.cookies_user, options);
                $rootScope.currentUser = null;
            }

            function expire(expectedHeader) {
                // Ignore responses belonging to an earlier login/logout.
                if (expectedHeader && token.getAuthorizationHeader() !== expectedHeader) { return; }
                // Several dashboard requests can fail at once after the cookie
                // disappears. Notify/navigate once, not once per request.
                if (expirationNotified && !token.getToken()) { return; }
                clear();
                expirationNotified = true;
                $rootScope.$emit('session:expired');
            }

            function refresh(expectedHeader) {
                if (expectedHeader && token.getAuthorizationHeader() !== expectedHeader) {
                    return $q.when();
                }
                if (refreshPromise && isCurrent(refreshIdentity)) { return refreshPromise; }
                var oldToken = token.getToken() || {};
                if (!oldToken.refresh_token) {
                    expire(expectedHeader);
                    return $q.reject({status: 401, data: {error: 'invalid_grant'}});
                }
                var generation = oldToken.refresh_token;
                var identity = capture();
                var body = 'grant_type=refresh_token&client_id=' + encodeURIComponent(Hrm.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Hrm.API_CLIENT_KEY) +
                    '&refresh_token=' + encodeURIComponent(generation);
                var pending = $injector.get('$http').post(
                    Hrm.API_SERVER_URL.replace(/\/$/, '') + '/oauth/token', body,
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}, skipSessionAuth: true,
                        sessionRefreshRequest: true, timeout: 20000}
                ).then(function (response) {
                    if (!isCurrent(identity)) {
                        discardIssuedToken(response.data);
                        return $q.reject(changed());
                    }
                    if (!response.data || !response.data.access_token || !response.data.token_type) {
                        expire();
                        return $q.reject({status: 401, data: {error: 'invalid_token'}});
                    }
                    if (!installToken(response.data, identity)) { return $q.reject(changed()); }
                    expirationNotified = false;
                    return response;
                }, function (error) {
                    if (!isCurrent(identity)) { return $q.reject(changed()); }
                    if (error.status === 401 || (error.status === 400 && error.data &&
                            (error.data.error === 'invalid_grant' || error.data.error === 'invalid_token'))) {
                        expire();
                    }
                    // Network/server failures leave the token available for another attempt.
                    return $q.reject(error);
                }).finally(function () {
                    if (refreshPromise === pending) { refreshPromise = null; refreshIdentity = null; }
                });
                refreshPromise = pending;
                refreshIdentity = identity;
                return refreshPromise;
            }

            function login(user) {
                var marker = advanceSession();
                var identity = capture();
                identity.marker = marker;
                var body = 'grant_type=password&client_id=' + encodeURIComponent(Hrm.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Hrm.API_CLIENT_KEY) +
                    '&username=' + encodeURIComponent(user.username) + '&password=' + encodeURIComponent(user.password);
                return $injector.get('$http').post(Hrm.API_SERVER_URL.replace(/\/$/, '') + '/oauth/token', body,
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}, skipSessionAuth: true,
                        loginRequest: true, timeout: 20000}).then(function (response) {
                    if (!isCurrent(identity)) {
                        discardIssuedToken(response.data);
                        return $q.reject(changed());
                    }
                    if (!response.data || !response.data.access_token || !response.data.token_type) {
                        return $q.reject({status: 502});
                    }
                    var installed = installToken(response.data, identity);
                    if (!installed) { return $q.reject(changed()); }
                    expirationNotified = false;
                    response.sessionIdentity = installed;
                    return response;
                }, function (error) {
                    return $q.reject(isCurrent(identity) ? error : changed());
                });
            }

            return {
                refresh: refresh,
                login: login,
                capture: capture,
                isCurrent: isCurrent,
                expire: expire,
                hasCredentials: function () {
                    return !!(token.getAuthorizationHeader() || token.getRefreshToken());
                },
                restore: function () {
                    var value = token.getToken();
                    if (value && !value.session_expires_at) { token.setToken(value); }
                },
                saveUser: function (user, identity) {
                    if (identity && !isCurrent(identity)) { return false; }
                    var value = token.getToken();
                    if (!value) { return false; }
                    expirationNotified = false;
                    $rootScope.sessionNotice = '';
                    $rootScope.currentUser = user;
                    $cookies.putObject(constants.cookies_user, user, angular.extend({}, options,
                        {expires: new Date(value.session_expires_at)}));
                    if (identity && !isCurrent(identity)) {
                        var saved = $cookies.getObject(constants.cookies_user);
                        if (saved && saved.id === user.id) { $cookies.remove(constants.cookies_user, options); }
                        if ($rootScope.currentUser === user) { $rootScope.currentUser = null; }
                        return false;
                    }
                    return true;
                },
                logout: function () {
                    var value = token.getToken();
                    clear();
                    return revoke(value);
                }
            };
        }
    ]);

    Hrm.factory('SessionAuthInterceptor', ['$q', '$injector', 'OAuthToken',
        function ($q, $injector, token) {
            var apiRoot = Hrm.API_SERVER_URL.replace(/\/$/, '') + '/api/';
            function isApi(config) {
                if (!config || config.skipSessionAuth || typeof config.url !== 'string') { return false; }
                // Also recognize root-relative URLs without sending credentials
                // to a different origin. Resolve just as the browser does.
                try {
                    var base = (window.document && window.document.baseURI) || window.location.href || Hrm.API_SERVER_URL;
                    return new window.URL(config.url, base).href.indexOf(apiRoot) === 0;
                } catch (ignore) {
                    return config.url.indexOf(apiRoot) === 0;
                }
            }
            function retry(config) {
                if (!token.getAccessToken()) {
                    return $q.reject({status: 401, sessionChanged: true});
                }
                // Preserve FormData/Blob upload bodies; deep copying them loses
                // the browser's native data. Only the headers need a new object.
                var next = angular.extend({}, config, {headers: angular.extend({}, config.headers)});
                next.sessionAuthRetried = true;
                Object.keys(next.headers).forEach(function (name) {
                    if (name.toLowerCase() === 'authorization') { delete next.headers[name]; }
                });
                return $injector.get('$http')(next);
            }
            return {
                request: function (config) {
                    config.headers = config.headers || {};
                    if (isApi(config)) {
                        var header = token.getAuthorizationHeader();
                        var explicitHeader;
                        Object.keys(config.headers).forEach(function (name) {
                            if (name.toLowerCase() === 'authorization') { explicitHeader = config.headers[name]; }
                        });
                        // Respect requests intentionally using a different identity.
                        if (explicitHeader && explicitHeader !== header) { return config; }
                        config.sessionAuthManaged = true;
                        config.sessionAuthHeader = header;
                        config.sessionAuthAccess = token.getAccessToken();
                        config.sessionAuthRefresh = token.getRefreshToken();
                        if (header && !explicitHeader) {
                            config.headers.Authorization = header;
                        }
                    }
                    return config;
                },
                responseError: function (error) {
                    var config = error.config;
                    if (!isApi(config) || error.status !== 401 || !config.sessionAuthManaged) {
                        return $q.reject(error);
                    }
                    if (token.getRefreshToken() !== config.sessionAuthRefresh ||
                        (!config.sessionAuthRefresh && token.getAccessToken() !== config.sessionAuthAccess)) {
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
