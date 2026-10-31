(function () {

    'use strict';

    /* OAuth2 configuration */
    Hrm.config(['OAuthProvider', 'OAuthTokenProvider', 'constants', function(OAuthProvider, OAuthTokenProvider, constants) {

        OAuthProvider.configure({
            baseUrl: Hrm.API_SERVER_URL,
            clientId: Hrm.API_CLIENT_ID,
            clientSecret: Hrm.API_CLIENT_KEY,
            grantPath: '/oauth/token',
            revokePath: '/oauth/logout'
        });

        OAuthTokenProvider.configure({
            name: constants.oauth2_token,
            options: {
                path: '/',
                secure: window.location.protocol === 'https:'
            }
        });
    }]);

    // Persist the session across browser restarts. Keep the original refresh
    // expiry when Spring reuses the same refresh token (it does not rotate it).
    Hrm.config(['$provide', function ($provide) {
        $provide.decorator('OAuthToken', ['$delegate', '$cookies', 'constants',
            function (token, $cookies, constants) {
                var options = {path: '/', secure: window.location.protocol === 'https:'};
                var persistentLifetime = 365 * 24 * 60 * 60 * 1000;
                token.isPersistentSession = function (value) {
                    var refreshExpiry = value && Number(value.refresh_token_expires_at);
                    var refreshLifetime = value && Number(value.refresh_expires_in);
                    return !!(value && value.persistent_session === true && value.refresh_token &&
                        !(isFinite(refreshExpiry) && refreshExpiry > 0) &&
                        !(value.refresh_expires_in != null && isFinite(refreshLifetime) && refreshLifetime >= 0));
                };
                token.setToken = function (value) {
                    var previous = token.getToken() || {};
                    var next = angular.copy(value);
                    var now = Date.now();
                    next._browser_session_id = (next.refresh_token || next.access_token) ===
                        (previous.refresh_token || previous.access_token) && previous._browser_session_id ||
                        now + '-' + Math.random().toString(36).slice(2);
                    var accessLifetime = Number(next.expires_in);
                    next.access_expires_at = now + (isFinite(accessLifetime) && accessLifetime >= 0 ? accessLifetime : 86400) * 1000;
                    var refreshExpiry = Number(next.refresh_token_expires_at);
                    var refreshLifetime = Number(next.refresh_expires_in);
                    // The server knows the original refresh expiry, even when a
                    // token is reused on login or this is a new browser profile.
                    next.session_expires_at = token.isPersistentSession(next) ? now + persistentLifetime :
                        (isFinite(refreshExpiry) && refreshExpiry > 0 ? refreshExpiry : 0) ||
                        (next.refresh_expires_in != null && isFinite(refreshLifetime) && refreshLifetime >= 0
                            ? now + refreshLifetime * 1000 : 0) || next.session_expires_at ||
                        (next.refresh_token && next.refresh_token === previous.refresh_token &&
                            previous.session_expires_at) ||
                        (next.refresh_token ? now + 30 * 24 * 60 * 60 * 1000 : next.access_expires_at);
                    $cookies.putObject(constants.oauth2_token, next,
                        angular.extend({}, options, {expires: new Date(next.session_expires_at)}));
                };
                token.renewPersistentSession = function () {
                    var value = token.getToken();
                    if (!token.isPersistentSession(value)) { return value; }
                    // Renew browser storage without changing the server's access
                    // expiry or inventing a nonexpiring grant for older sessions.
                    value.session_expires_at = Date.now() + persistentLifetime;
                    $cookies.putObject(constants.oauth2_token, value,
                        angular.extend({}, options, {expires: new Date(value.session_expires_at)}));
                    return value;
                };
                token.removeToken = function () {
                    $cookies.remove(constants.oauth2_token, options);
                };
                return token;
            }
        ]);
    }]);

    Hrm.config(['$compileProvider', function ($compileProvider) {
        $compileProvider.debugInfoEnabled(false);
    }]);

    /* Route views and ng-includes must share the asset release version. Apply
       it before Angular checks $templateCache, so a cached bare view cannot
       hide a newer release. Inline modal/UI Bootstrap template IDs stay local. */
    Hrm.config(['$provide', function ($provide) {
        $provide.decorator('$templateRequest', ['$delegate', '$window',
            function ($delegate, $window) {
                function templateUrl(url) {
                    if (typeof url !== 'string' || typeof $window.versionedAppUrl !== 'function') { return url; }
                    try {
                        var document = $window.document;
                        var inline = document.getElementById(url);
                        if (inline && String(inline.tagName).toLowerCase() === 'script' && inline.type === 'text/ng-template') { return url; }
                        var parsed = new $window.URL(url, document.baseURI || $window.location.href);
                        if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== $window.location.origin ||
                            /^\/(?:service|api|oauth|public)(?:\/|$)/i.test(parsed.pathname) ||
                            !/\/views\/.+\.html$/i.test(parsed.pathname)) { return url; }
                        return $window.versionedAppUrl(url);
                    } catch (ignore) { return url; }
                }
                function request() {
                    var args = Array.prototype.slice.call(arguments);
                    args[0] = templateUrl(args[0]);
                    return $delegate.apply(this, args);
                }
                angular.extend(request, $delegate);
                Object.defineProperty(request, 'totalPendingRequests', {
                    get: function () { return $delegate.totalPendingRequests; },
                    set: function (value) { $delegate.totalPendingRequests = value; }
                });
                return request;
            }
        ]);
    }]);

    /* Block UI configuration */
    Hrm.config(['blockUIConfig', function(blockUIConfig) {

        // Change the default overlay message
        // blockUIConfig.message = 'Vui lòng chờ...';

        // Change the default delay to 100ms before the blocking is visible
        // blockUIConfig.delay = 10;

        blockUIConfig.autoBlock = false;

    }]);

    /* Toastr configuration */
    Hrm.config(['toastrConfig', function (toastrConfig) {
        angular.extend(toastrConfig, {
            autoDismiss: true,
            closeButton: true,
            containerId: 'toast-container',
            maxOpened: 0,
            newestOnTop: true,
            positionClass: 'toast-bottom-right',
            preventDuplicates: false,
            preventOpenDuplicates: false,
            target: 'body'
        });
    }]);

    /* HTTP Provider configuration */
    Hrm.config(['$httpProvider', function ($httpProvider) {
        // $httpProvider.defaults.withCredentials = true;
        // $httpProvider.defaults.xsrfCookieName = 'XSRF-TOKEN';
        // $httpProvider.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';
        // $httpProvider.defaults.useXDomain = true;
        //
        // $httpProvider.interceptors.push('XSRFInterceptor');
        // The bundled interceptor emits an error before refresh completes and
        // does not retry the failed request. Replace it with our session flow.
        // AngularJS retains this array by reference. Replacing the property
        // leaves $http using the old interceptors and silently skips ours.
        for (var i = $httpProvider.interceptors.length - 1; i >= 0; i--) {
            if ($httpProvider.interceptors[i] === 'oauthInterceptor') {
                $httpProvider.interceptors.splice(i, 1);
            }
        }
        $httpProvider.interceptors.push('SessionAuthInterceptor');
        $httpProvider.interceptors.push('ServerExceptionHandlerInterceptor');
    }]);

    /* Location provider */
    Hrm.config(['$locationProvider', function ($locationProvider) {
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: true,
            rewriteLinks: 'string'
        });
        $locationProvider.html5Mode(true).hashPrefix('!');
    }]);

    /* Configure ocLazyLoader(refer: https://github.com/ocombe/ocLazyLoad) */
    Hrm.config(['$ocLazyLoadProvider', function ($ocLazyLoadProvider) {
        $ocLazyLoadProvider.config({
            // global configs go here
        });
    }]);

    /* AngularJS v1.3.x workaround for old style controller declarition in HTML */
    Hrm.config(['$controllerProvider', function ($controllerProvider) {
    }]);

    Hrm.config(['$urlRouterProvider', '$stateProvider', 'constants',
        function ($urlRouterProvider, $stateProvider, constants) {
            // Redirect any unmatched url

            // Member area
            $stateProvider.state('application', {
                templateUrl: 'common/views/application.html?v=' + window.APP_VERSION,
                abstract: true
            });

            // Guest area
            $urlRouterProvider.otherwise(function(a, b) {
                var $injector = a, $location = b; // To support for minification

                var $cookies = $injector.get('$cookies');
                var user = $cookies.getObject(constants.cookies_user);

                if (user) {
                    $location.path('/dashboard');
                    // $state.go('church');
                    // $location.path('/church');
                } else {
                    $location.path('/login');
                    // $location.path('/church');
                    // $state.go('church');
                }
            });
        }
    ]);
})();
