/**
 * Created by bizic on 29/8/2016.
 */
(function () {
    'use strict';

    angular.module('Core.Common').service('LoginService', LoginService);
    LoginService.$inject = [
        'AuthSession'
    ];

    function LoginService(AuthSession) {
        var self = this;

        self.performLogin = performLogin;

        /**
         * Perform login
         * @param user
         */
        function performLogin(user) {
            return AuthSession.login(user);
        }
    }

})();
