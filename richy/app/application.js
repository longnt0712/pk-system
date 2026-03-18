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
    Hrm.run(['$rootScope', 'settings', '$http', '$cookies', '$state', '$injector', 'constants', 'OAuth', 'blockUI', 'toastr', 'Idle', 'Keepalive',
        function ($rootScope, settings, $http, $cookies, $state, $injector, constants, OAuth, blockUI, toastr, Idle, Keepalive) {
            $rootScope.$state = $state; // state to be accessed from view
            settings.api.apiV1Url=Hrm.API_PREFIX;
            $rootScope.$settings = settings; // state to be accessed from view

            $rootScope.islogOut = false;
            
            
            console.log("ver 1.0");

            var currentUser = {};
            if($cookies.getAll()["education.user"] != null && !angular.isUndefined($cookies.getAll()["education.user"])){
                currentUser = JSON.parse($cookies.getAll()["education.user"]);
            }

            if(currentUser.roles != null){
                angular.forEach(currentUser.roles, function(value, key) {
                    if(value.name == "ROLE_ADMIN"){
                        settings.isAdmin = true;
                        console.log("ADMIN");
                    }else if(value.name == "ROLE_VIEWER"){
                        settings.isViewer = true;
                        console.log("VIEWER");
                    }else if(value.name == "ROLE_STAFF" || value.name == "ROLE_STAFF_MANAGEMENT"){
                        settings.isStaff = true;
                        console.log("staff");
                    }else if(value.name == "ROLE_STUDENT_MANAGERMENT"){
                        settings.isStudentManagerment = true;
                        console.log("isStudentManagerment");
                    }else if(value.name == "ROLE_EDUCATION_MANAGERMENT"){
                        settings.isEducationManagerment = true;
                        console.log("isEducationManagerment");
                    }
                });
            }

            document.documentElement.setAttribute('translate','no');
            document.documentElement.classList.add('notranslate');
            // Optional: for specific chunks you create dynamically
            document.querySelectorAll('[data-notranslate]').forEach(el=>{
                el.setAttribute('translate','no');
            el.classList.add('notranslate');
            });

            var hostname = window.location.hostname;

            if (hostname === "giaoxuphungkhoang.org" || hostname === "tnttphungkhoang.com" ) {
                // alert("Đúng domain");
                settings.chapter = true;
            }
            if (hostname === "ieltsroom.com") {
                // alert("Đúng domain");
                settings.ieltsRoom = true;
            }

            // $rootScope.facebookAppId = '367012131893866'; // set your facebook app id here

            // Idle management
            // Idle.watch();
            // Keepalive.start();

            // $rootScope.$on('IdleStart', function() {
            //     $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
            //         if (response) {
            //             /* Display modal warning or sth */
            //             $rootScope.idleToastr = toastr.warning('Bạn đã ngưng làm việc trên hệ thống một khoảng thời gian khá lâu. Phiên làm việc của bạn sẽ tự động kết thúc ngay sau đây nếu bạn không thực hiện một thao tác nào.', 'Cảnh báo...', {
            //                 timeOut: 60000, // 60 seconds
            //                 closeButton: true,
            //                 progressBar: true});
            //         }
            //     }).error(function (response, status, headers, config) {
            //     });
            // });
            //
            // $rootScope.$on('IdleEnd', function() {
            //     if ($rootScope.idleToastr) {
            //         toastr.remove($rootScope.idleToastr);
            //     }
            // });
            //
            // $rootScope.$on('IdleTimeout', function() {
            //     OAuth.revokeToken();
            //
            //     $cookies.remove(constants.oauth2_token);
            //     $state.go('login');
            // });

            // $state.go('church');
            // $cookies.putObject(constants.cookies_user, $rootScope.currentUser);
            // OAuth.getRefreshToken();
            // console.log($state.current.name);

            // vm.user =
            //
            // vm.user.username = 'admin';
            // vm.user.password = 'admin';
            // OAuth.getAccessToken({
            //
            //     username: 'admin', password : 'admin'
            // }, 'POST');

            // oauth2...
            $rootScope.$on('oauth:error', function (event, rejection) {

                blockUI.stop();

                // Ignore `invalid_grant` error - should be catched on `LoginController`.
                if (angular.isDefined(rejection.data) && 'invalid_grant' === rejection.data.error) {
                    $cookies.remove(constants.oauth2_token);
                    $state.go('login');
                    // $state.go('church');

                    return;
                }

                // Refresh token when a `invalid_token` error occurs.
                if (angular.isDefined(rejection.data) && 'invalid_token' === rejection.data.error) {
                    return OAuth.getRefreshToken();
                }

                // Redirect to `/login` with the `error_reason`.
                $rootScope.$emit('$unauthorized', function (event, data) {});
                $state.go('login');
                // $state.go('church');


            });

            $rootScope.$on('$locationChangeSuccess', function (event) {


                if (!OAuth.isAuthenticated()) {
                    $rootScope.$emit('$unauthorized', function (event, data) {});
                    $state.go('login');
                    // $state.go('church');
                }

                blockUI.start();
                $http.get(settings.api.baseUrl + 'api/users/getCurrentUser').success(function (response, status, headers, config) {
                    blockUI.stop();
                    if (response) {
                        $rootScope.$emit('$onCurrentUserData', response);

                        if ($state.current.name == 'login') {
                            $state.go('application.dashboard');
                            // $state.go('church');
                        }
                    }
                }).error(function (response, status, headers, config) {
                    blockUI.stop();
                    $cookies.remove(constants.oauth2_token);
                    $state.go('login');
                    // $state.go('church');
                });
            });
        }
    ]);

})(window);
