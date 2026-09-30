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
                token.setToken = function (value) {
                    var previous = token.getToken() || {};
                    var next = angular.copy(value);
                    var now = Date.now();
                    next.access_expires_at = now + Number(next.expires_in || 86400) * 1000;
                    next.session_expires_at = next.session_expires_at ||
                        (next.refresh_token && next.refresh_token === previous.refresh_token &&
                            previous.session_expires_at) ||
                        (next.refresh_token ? now + 30 * 24 * 60 * 60 * 1000 : next.access_expires_at);
                    $cookies.putObject(constants.oauth2_token, next,
                        angular.extend({}, options, {expires: new Date(next.session_expires_at)}));
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
        $httpProvider.interceptors = $httpProvider.interceptors.filter(function (name) {
            return name !== 'oauthInterceptor';
        });
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
