(function () {

    'use strict';

    /* Setup global constants */
    Core.constant('constants', {
        cookies_user: 'education.user',
        oauth2_token: 'token',
        auth_session: 'education.auth-session'
    });

    Core.factory('AuthSession', ['$q', '$injector', '$rootScope', '$cookies', 'OAuthToken', 'constants',
        function ($q, $injector, $rootScope, $cookies, token, constants) {
            var refreshPromise = null;
            var refreshIdentity = null;
            var sessionGeneration = 0;
            var expirationNotified = false;
            var lastRenewedAt = 0;
            var lastRenewedIdentity = null;
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
                    Core.API_SERVER_URL.replace(/\/$/, '') + '/oauth/revoke',
                    'token=' + encodeURIComponent(secret) + '&token_type_hint=' + (refresh ? 'refresh_token' : 'access_token') +
                    '&client_id=' + encodeURIComponent(Core.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Core.API_CLIENT_KEY),
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

            function touch(force) {
                var value = token.getToken();
                if (!token.isPersistentSession(value)) { return true; }
                var identity = capture();
                if (!force && isCurrent(lastRenewedIdentity) && Date.now() - lastRenewedAt < 60 * 60 * 1000) {
                    return true;
                }
                value = token.renewPersistentSession();
                if (!isCurrent(identity)) {
                    var current = token.getToken();
                    if (current && value && current.access_token === value.access_token &&
                        current.refresh_token === value.refresh_token) { token.removeToken(); }
                    return false;
                }
                if (identity.marker !== undefined) {
                    $cookies.putObject(constants.auth_session, identity.marker, angular.extend({}, options,
                        {expires: new Date(value.session_expires_at)}));
                    if (!isCurrent(identity)) { return false; }
                }
                // A cached user belongs to the browser session that fetched it.
                // Do not prolong another account's stale cached user after a tab
                // changed credentials; a missing cache is fetched from the API.
                var user = $cookies.getObject(constants.cookies_user);
                if (user && value._browser_session_id && user._auth_session_id === value._browser_session_id) {
                    $cookies.putObject(constants.cookies_user, user, angular.extend({}, options,
                        {expires: new Date(value.session_expires_at)}));
                    if (!isCurrent(identity)) {
                        var saved = $cookies.getObject(constants.cookies_user);
                        if (saved && saved._auth_session_id === value._browser_session_id) {
                            $cookies.remove(constants.cookies_user, options);
                        }
                        return false;
                    }
                }
                lastRenewedAt = Date.now();
                lastRenewedIdentity = identity;
                return true;
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
                var body = 'grant_type=refresh_token&client_id=' + encodeURIComponent(Core.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Core.API_CLIENT_KEY) +
                    '&refresh_token=' + encodeURIComponent(generation);
                function newerAccess() {
                    var current = token.getToken() || {};
                    return current.access_token && current.access_token !== oldToken.access_token ? current : null;
                }
                function performRefresh() {
                    if (!isCurrent(identity)) { return $q.reject(changed()); }
                    var updated = newerAccess();
                    if (updated) { return $q.when({data: updated}); }
                    return $injector.get('$http').post(
                        Core.API_SERVER_URL.replace(/\/$/, '') + '/oauth/token', body,
                        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}, skipSessionAuth: true,
                            sessionRefreshRequest: true, timeout: 20000}
                    ).then(function (response) {
                        if (!isCurrent(identity)) {
                            discardIssuedToken(response.data);
                            return $q.reject(changed());
                        }
                        // A response can arrive after another tab has refreshed
                        // this same grant. Keep that tab's access token rather
                        // than overwriting it or revoking their shared refresh.
                        var current = newerAccess();
                        if (current) { return {data: current}; }
                        if (!response.data || !response.data.access_token || !response.data.token_type) {
                            expire();
                            return $q.reject({status: 401, data: {error: 'invalid_token'}});
                        }
                        if (!installToken(response.data, identity)) { return $q.reject(changed()); }
                        expirationNotified = false;
                        return response;
                    }, function (error) {
                        if (!isCurrent(identity)) { return $q.reject(changed()); }
                        var current = newerAccess();
                        if (current) { return {data: current}; }
                        if (error.status === 401 || (error.status === 400 && error.data &&
                                (error.data.error === 'invalid_grant' || error.data.error === 'invalid_token'))) {
                            expire();
                        }
                        // Network/server failures leave the token available for another attempt.
                        return $q.reject(error);
                    });
                }
                var locks = window.navigator && window.navigator.locks;
                var pending;
                if (locks && typeof locks.request === 'function') {
                    var started = false;
                    try {
                        pending = $q.when(locks.request('pk-system.oauth-refresh:' + Core.API_SERVER_URL + Core.API_CLIENT_ID,
                            function () { started = true; return performRefresh(); })).catch(function (error) {
                            // Older/restricted browsers can deny Web Locks. The
                            // access comparison and bounded API recovery remain.
                            return started ? $q.reject(error) : performRefresh();
                        });
                    } catch (ignore) { pending = performRefresh(); }
                } else { pending = performRefresh(); }
                pending = pending.finally(function () {
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
                var body = 'grant_type=password&client_id=' + encodeURIComponent(Core.API_CLIENT_ID) +
                    '&client_secret=' + encodeURIComponent(Core.API_CLIENT_KEY) +
                    '&username=' + encodeURIComponent(user.username) + '&password=' + encodeURIComponent(user.password);
                return $injector.get('$http').post(Core.API_SERVER_URL.replace(/\/$/, '') + '/oauth/token', body,
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
                isPersistent: function () { return token.isPersistentSession(token.getToken()); },
                touch: touch,
                expire: expire,
                hasCredentials: function () {
                    return !!(token.getAuthorizationHeader() || token.getRefreshToken());
                },
                restore: function () {
                    var value = token.getToken();
                    if (value && !value.session_expires_at) { token.setToken(value); }
                    return touch(true);
                },
                saveUser: function (user, identity) {
                    if (identity && !isCurrent(identity)) { return false; }
                    var value = token.getToken();
                    if (!value) { return false; }
                    if (!touch(false)) { return false; }
                    value = token.getToken();
                    expirationNotified = false;
                    $rootScope.sessionNotice = '';
                    $rootScope.currentUser = user;
                    var cachedUser = angular.extend({}, user, {_auth_session_id: value._browser_session_id});
                    $cookies.putObject(constants.cookies_user, cachedUser, angular.extend({}, options,
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

    Core.factory('SessionAuthInterceptor', ['$q', '$injector', 'OAuthToken',
        function ($q, $injector, token) {
            var apiRoot = Core.API_SERVER_URL.replace(/\/$/, '') + '/api/';
            function isApi(config) {
                if (!config || config.skipSessionAuth || typeof config.url !== 'string') { return false; }
                // Also recognize root-relative URLs without sending credentials
                // to a different origin. Resolve just as the browser does.
                try {
                    var base = (window.document && window.document.baseURI) || window.location.href || Core.API_SERVER_URL;
                    return new window.URL(config.url, base).href.indexOf(apiRoot) === 0;
                } catch (ignore) {
                    return config.url.indexOf(apiRoot) === 0;
                }
            }
            function sameSession(config) {
                return token.getRefreshToken() === config.sessionAuthRefresh &&
                    (config.sessionAuthRefresh || token.getAccessToken() === config.sessionAuthAccess);
            }
            function retry(config) {
                if (!sameSession(config)) {
                    return $q.reject({status: -1, sessionChanged: true});
                }
                if (!token.getAccessToken()) {
                    return $q.reject({status: 401, sessionChanged: true});
                }
                // Preserve FormData/Blob upload bodies; deep copying them loses
                // the browser's native data. Only the headers need a new object.
                var next = angular.extend({}, config, {headers: angular.extend({}, config.headers)});
                next.sessionAuthRetried = true;
                next.sessionAuthRecoveries = (config.sessionAuthRecoveries || 0) + 1;
                Object.keys(next.headers).forEach(function (name) {
                    if (name.toLowerCase() === 'authorization') { delete next.headers[name]; }
                });
                return $injector.get('$http')(next);
            }
            return {
                request: function (config) {
                    config.headers = config.headers || {};
                    if (isApi(config)) {
                        if (config.sessionAuthRetried && !sameSession(config)) {
                            return $q.reject({status: -1, sessionChanged: true});
                        }
                        var header = token.getAuthorizationHeader();
                        var explicitHeader;
                        Object.keys(config.headers).forEach(function (name) {
                            if (name.toLowerCase() === 'authorization') { explicitHeader = config.headers[name]; }
                        });
                        // Respect requests intentionally using a different identity.
                        if (explicitHeader && explicitHeader !== header) { return config; }
                        $injector.get('AuthSession').touch(false);
                        if (config.sessionAuthRetried && !sameSession(config)) {
                            return $q.reject({status: -1, sessionChanged: true});
                        }
                        header = token.getAuthorizationHeader();
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
                    if ((config.sessionAuthRecoveries || 0) >= 2) {
                        // A resource 401 can belong to an access token replaced
                        // by another tab. Only a rejected refresh grant proves
                        // that this device session must end.
                        return $q.reject(error);
                    }
                    if (token.getAccessToken() && token.getAccessToken() !== config.sessionAuthAccess) {
                        return retry(config);
                    }
                    return session.refresh(config.sessionAuthHeader).then(function () {
                        return retry(config);
                    });
                }
            };
        }
    ]);

    Core.filter('weekDay', [function () {
        return function (input) {
            if (input < 2 || input > 8) {
                return '';
            }

            var arr = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
            return arr[input - 2];
        };
    }]);

    /* Setup global settings */
    Core.factory('settings', ['$rootScope', '$state', 'constants', function ($rootScope, $state, constants) {
        // supported languages
        var settings = {
            layout: {
                pageSidebarClosed: false, // sidebar menu state
                pageContentWhite: true, // set page content layout
                pageBodySolid: true, // solid body color state
                pageAutoScrollOnLoad: 1000, // auto scroll to top on page load,
            },
            locale: 'vi-VN',
            assetsPath: 'assets',
            api: {
                baseUrl: Core.API_SERVER_URL,
                apiPrefix: Core.API_PREFIX,
                clientId: Core.API_CLIENT_ID,
                clientKey: Core.API_CLIENT_KEY,
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
    Core.factory('focus', ['$timeout', '$window', function ($timeout, $window) {
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
    Core.factory('bsTableAPI', ['$window', function ($window) {
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
    Core.factory('ServerExceptionHandlerInterceptor', [
        '$q',
        'toastr',
        '$cookies',
        '$injector',
        'blockUI',
        'constants',
        function ($q, toastr, $cookies, $injector, blockUI, constants) {
            return {
                responseError: function (rejection) {
                    if (rejection.sessionChanged || rejection.config &&
                        (rejection.config.loginRequest || rejection.config.sessionRevokeRequest)) {
                        return $q.reject(rejection);
                    }
                    if (rejection.status <= 0) {
                        toastr.warning('Không thể kết nối đến máy chủ.', 'Cảnh báo');
                    }

                    if (rejection.status == 400) {
                        toastr.error('Đã có lỗi xảy ra. Xin vui lòng thử lại.', 'Lỗi (400)');
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
