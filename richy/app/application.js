(function () {
    'use strict';

    /* Hrm App */
    if (typeof window.Hrm == 'undefined') {
        var Hrm = angular.module('Hrm', [
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
            'dndLists',
            

            // Sub modules
            'Hrm.Common',
            'Hrm.Dashboard',
            'Hrm.Settings',
            'Hrm.User',

            // Sub modules
            'Hrm.Account',
            'Hrm.Calendar',
            'Hrm.Answer',
            'Hrm.Question',
            'Hrm.ClassicalLearning',
            'Hrm.Body',
            'Hrm.BodyLearning',
            'Hrm.QuestionType',
            'Hrm.Item',
            'Hrm.VoucherCrocs',
            'Hrm.DefaultPrice',
            'Hrm.Shop',
            'Hrm.Topic',
            'Hrm.TestResult',
            'Hrm.Products',
            'Hrm.PersonDate',
            'Hrm.EducationProgram',
            'Hrm.Mark',
            'Hrm.StudentMark',
            // 'Hrm.Wine',
            // 'Hrm.Church',
            // 'Hrm.Folder',
            // 'Hrm.Article'
        ]);

        window.Hrm = Hrm;
    }
    // Hrm.API_SERVER_URL = 'https://giaoxuphungkhoang.org:8085/service/';
    // Hrm.API_SERVER_URL = 'https://tnttphungkhoang.com/service/';
    Hrm.API_SERVER_URL = 'https://ieltsroom.com:8443/service/';
    // Hrm.API_SERVER_URL = 'http://localhost:8443/service/'; // đoạn này mình call local
    //--------------------//

    // Hrm.API_SERVER_URL = 'https://localhost:8085/service/'; // đoạn này mình call local
    // Hrm.API_SERVER_URL = 'https://richywine.com:8085/service/'; // đoạn này mình call local
    // Hrm.API_SERVER_URL = 'http://ieltsroom.com:8080/letter/'; // đoạn này mình call local
    // Hrm.API_SERVER_URL = 'http://giaoxuphungkhoang.org:8081/letter/'; // đoạn này mình call local
    // Hrm.API_SERVER_URL = 'http://sv313.tlu.edu.vn:8082/letter/'; //
    //Hrm.API_SERVER_URL = 'http://150.95.113.209:8080/letter/'; //

    Hrm.API_CLIENT_ID = 'education_client';
    Hrm.API_CLIENT_KEY = 'password';
    Hrm.API_PREFIX = 'api/';

    /* Init global settings and run the app */
    /* Init global settings and run the app */
    Hrm.run([
        '$rootScope',
        'settings',
        '$http',
        '$cookies',
        '$state',
        '$injector',
        'constants',
        'OAuth',
        'blockUI',
        'toastr',
        'Idle',
        'Keepalive',
        '$timeout',
        function ($rootScope, settings, $http, $cookies, $state, $injector, constants, OAuth, blockUI, toastr, Idle, Keepalive, $timeout) {
            $rootScope.$state = $state;
            settings.api.apiV1Url = Hrm.API_PREFIX;
            $rootScope.$settings = settings;

            $rootScope.islogOut = false;

            // console.log("ver 1.0");

            // =========================
            // Init permission flags
            // =========================
            settings.permissionsLoaded = false;
            settings.isAdmin = false;
            settings.isViewer = false;
            settings.isStaff = false;
            settings.isStudentManagerment = false;
            settings.isEducationManagerment = false;

            function resetPermissionSettings() {
                settings.isAdmin = false;
                settings.isViewer = false;
                settings.isStaff = false;
                settings.isStudentManagerment = false;
                settings.isEducationManagerment = false;
            }

            function applyRolesToSettings(user) {
                resetPermissionSettings();

                if (!user || !user.roles || !user.roles.length) {
                    return;
                }

                angular.forEach(user.roles, function (value) {
                    if (value.name === "ROLE_ADMIN") {
                        settings.isAdmin = true;
                        console.log("ADMIN");
                    } else if (value.name === "ROLE_VIEWER") {
                        settings.isViewer = true;
                        console.log("VIEWER");
                    } else if (value.name === "ROLE_STAFF" || value.name === "ROLE_STAFF_MANAGEMENT") {
                        settings.isStaff = true;
                        console.log("STAFF");
                    } else if (value.name === "ROLE_STUDENT_MANAGERMENT") {
                        settings.isStudentManagerment = true;
                        console.log("isStudentManagerment");
                    } else if (value.name === "ROLE_EDUCATION_MANAGERMENT") {
                        settings.isEducationManagerment = true;
                        console.log("isEducationManagerment");
                    }
                });
            }

            function loadPermissionsFromCookie(done) {
                settings.permissionsLoaded = false;

                var raw = $cookies.get("education.user");

                if (raw) {
                    try {
                        var currentUser = JSON.parse(raw);
                        applyRolesToSettings(currentUser);
                    } catch (e) {
                        console.error("Parse education.user failed:", e);
                        resetPermissionSettings();
                    }

                    settings.permissionsLoaded = true;
                    $rootScope.$broadcast('permissionsLoaded');
                    if (done) {
                        done();
                    }
                    return;
                }

                $timeout(function () {
                    var retryRaw = $cookies.get("education.user");

                    if (retryRaw) {
                        try {
                            var retryUser = JSON.parse(retryRaw);
                            applyRolesToSettings(retryUser);
                        } catch (e) {
                            console.error("Retry parse education.user failed:", e);
                            resetPermissionSettings();
                        }
                    } else {
                        resetPermissionSettings();
                    }

                    settings.permissionsLoaded = true;
                    $rootScope.$broadcast('permissionsLoaded');

                    if (done) {
                        done();
                    }
                }, 300);
            }

            loadPermissionsFromCookie();

            // =========================
            // Notranslate
            // =========================
            document.documentElement.setAttribute('translate', 'no');
            document.documentElement.classList.add('notranslate');

            document.querySelectorAll('[data-notranslate]').forEach(function (el) {
                el.setAttribute('translate', 'no');
                el.classList.add('notranslate');
            });

            // =========================
            // Domain mode
            // =========================
            var hostname = window.location.hostname;

            settings.chapter = false;
            settings.ieltsRoom = false;

            if (hostname === "giaoxuphungkhoang.org" || hostname === "tnttphungkhoang.com") {
                settings.chapter = true;
            }

            if (hostname === "ieltsroom.com") {
                settings.ieltsRoom = true;
            }

            // =========================
            // OAuth errors
            // =========================
            $rootScope.$on('oauth:error', function (event, rejection) {
                blockUI.stop();

                if (angular.isDefined(rejection.data) && rejection.data.error === 'invalid_grant') {
                    $cookies.remove(constants.oauth2_token);
                    $state.go('login');
                    return;
                }

                if (angular.isDefined(rejection.data) && rejection.data.error === 'invalid_token') {
                    return OAuth.getRefreshToken();
                }

                $rootScope.$emit('$unauthorized', function () {});
                $state.go('login');
            });

            // =========================
            // Route change / auth check
            // =========================
            $rootScope.$on('$locationChangeSuccess', function () {

                if (!OAuth.isAuthenticated()) {
                    $rootScope.$emit('$unauthorized', function () {});
                    $state.go('login');
                    return;
                }

                blockUI.start();

                $http.get(settings.api.baseUrl + 'api/users/getCurrentUser')
                    .success(function (response) {
                        blockUI.stop();

                        if (response) {
                            $rootScope.$emit('$onCurrentUserData', response);

                            // Ưu tiên update settings role theo response backend cho chắc ăn hơn cookie
                            applyRolesToSettings(response);
                            settings.permissionsLoaded = true;
                            $rootScope.$broadcast('permissionsLoaded');

                            if ($state.current.name === 'login') {
                                $state.go('application.dashboard');
                            }
                        }
                    })
                    .error(function () {
                        blockUI.stop();
                        $cookies.remove(constants.oauth2_token);
                        $state.go('login');
                    });
            });
        }
    ]);

})(window);
