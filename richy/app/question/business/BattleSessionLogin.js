(function () {
    'use strict';

    angular.module('Hrm.Question').factory('BattleSessionLogin', [
        '$rootScope', '$http', '$q', '$uibModal', 'AuthSession', 'settings', '$window', '$interval', '$timeout',
        function ($rootScope, $http, $q, $uibModal, auth, settings, $window, $interval, $timeout) {
            // Kept inline so an expired/offline session never needs another template request.
            var template = [
                '<form class="battle-session-login" ng-submit="login.submit()" novalidate>',
                '<h2 id="battle-session-login-title">Đăng nhập để tiếp tục Battle</h2>',
                '<p>Phiên đăng nhập đã hết hạn. Đăng nhập lại tài khoản đang chơi để tiếp tục trong phòng {{login.roomCode}}.</p>',
                '<label for="battle-session-username">Tài khoản đang chơi</label>',
                '<input id="battle-session-username" class="form-control" type="text" ng-model="login.username" autocomplete="username" readonly>',
                '<label for="battle-session-password">Mật khẩu</label>',
                '<input id="battle-session-password" class="form-control" type="password" ng-model="login.password" autocomplete="current-password" ng-disabled="login.busy" required>',
                '<p class="battle-session-login-error" role="alert" ng-if="login.error">{{login.error}}</p>',
                '<button class="btn btn-primary" type="submit" ng-disabled="login.busy">{{login.busy ? "Đang kết nối lại…" : "Đăng nhập và tiếp tục"}}</button>',
                '</form>'
            ].join('');

            return {bind: function (scope, options) {
                var popup = null, pending = false, disposed = false, loginView = null;
                var authenticatedUser = null, identity = null, expectedUser = null;

                function current() { return !disposed && auth.isCurrent(identity); }
                function focusPassword() {
                    $timeout(function () {
                        var input = !disposed && $window.document.getElementById('battle-session-password');
                        if (input) { input.focus(); }
                    }, 0);
                }
                function samePlayer(user) {
                    return user && String(user.username || '').toLowerCase() === String(expectedUser.username || '').toLowerCase() &&
                        (expectedUser.id == null || String(user.id) === String(expectedUser.id));
                }
                function resume() {
                    if (!current()) { return $q.reject({sessionChanged: true}); }
                    return $q.when(options.resume(authenticatedUser, current)).then(function () {
                        if (!current()) { return $q.reject({sessionChanged: true}); }
                        pending = false;
                        popup.close(); popup = null; loginView = null;
                    });
                }
                function open() {
                    if (disposed || popup) { return; }
                    popup = $uibModal.open({
                        animation: false, backdrop: 'static', keyboard: false,
                        windowClass: 'battle-session-login-window', backdropClass: 'battle-session-login-backdrop',
                        ariaLabelledBy: 'battle-session-login-title', template: template,
                        controllerAs: 'login', controller: function () {
                            var login = loginView = this;
                            login.username = expectedUser.username; login.roomCode = options.roomCode();
                            login.password = ''; login.error = ''; login.busy = false;
                            login.submit = function () {
                                if (login.busy || disposed) { return; }
                                login.error = '';
                                if ($window.navigator.onLine === false) { login.error = 'Bạn đang mất kết nối Internet. Kiểm tra mạng rồi thử lại.'; return; }
                                var canResume = authenticatedUser && current();
                                if (!canResume && !login.password) { login.error = 'Vui lòng nhập mật khẩu.'; focusPassword(); return; }
                                login.busy = true;
                                var accepted = !!canResume;
                                var task;
                                if (canResume) { task = resume(); }
                                else {
                                    authenticatedUser = null;
                                    task = auth.login({username: expectedUser.username, password: login.password}).then(function (response) {
                                        identity = response.sessionIdentity || auth.capture();
                                        if (!current()) { return $q.reject({sessionChanged: true}); }
                                        accepted = true;
                                        return $http.get(settings.api.baseUrl + 'api/users/getCurrentUser', {loginRequest: true, timeout: 20000});
                                    }).then(function (response) {
                                        if (!current()) { return $q.reject({sessionChanged: true}); }
                                        if (!samePlayer(response.data)) {
                                            auth.logout(); return $q.reject({differentBattleUser: true});
                                        }
                                        if (!auth.saveUser(response.data, identity)) { return $q.reject({sessionChanged: true}); }
                                        authenticatedUser = response.data;
                                        $rootScope.$emit('session:restored', authenticatedUser);
                                        return resume();
                                    });
                                }
                                login.password = '';
                                return task.catch(function (error) {
                                    if (disposed) { return; }
                                    var status = error && error.status, code = error && error.data && error.data.error;
                                    if (error && error.differentBattleUser) { login.error = 'Tài khoản này không trùng với người đang chơi. Vui lòng đăng nhập lại đúng tài khoản.'; }
                                    else if (error && error.sessionChanged) { login.error = 'Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại tài khoản đang chơi.'; }
                                    else if (!accepted && (status === 401 || code === 'invalid_grant')) { login.error = 'Mật khẩu không đúng. Vui lòng thử lại.'; }
                                    else if (accepted && current() && authenticatedUser) { login.error = 'Đã đăng nhập. Chưa kết nối lại được phòng, bấm nút bên dưới để thử lại.'; }
                                    else { login.error = 'Chưa thể đăng nhập lúc này. Kiểm tra kết nối rồi thử lại.'; }
                                    focusPassword();
                                }).finally(function () { login.busy = false; });
                            };
                        }
                    });
                    popup.result.catch(angular.noop);
                    popup.opened.then(focusPassword, angular.noop);
                }
                function requestLogin(event) {
                    if (disposed || !options.active()) { return; }
                    event.preventDefault();
                    if (pending) { options.pause(); authenticatedUser = null; identity = null; return; }
                    pending = true; expectedUser = angular.copy(options.user());
                    authenticatedUser = null; identity = null;
                    options.pause();
                    // Browser top-layer fullscreen otherwise covers even the highest modal z-index.
                    var document = $window.document, exit = document.exitFullscreen || document.webkitExitFullscreen;
                    var exiting;
                    try { if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) { exiting = exit.call(document); } } catch (ignore) {}
                    $q.when(exiting).catch(angular.noop).then(function () { if (!disposed) { open(); } });
                }
                var stop = scope.$on('session:reauthenticate', requestLogin);
                var watchdog = $interval(function () {
                    if (!disposed && !pending && options.active() && !auth.hasCredentials()) { auth.expire(); }
                }, 1000);
                scope.$on('$destroy', function () {
                    disposed = true; stop(); $interval.cancel(watchdog);
                    if (loginView) { loginView.password = ''; }
                    if (popup) { popup.dismiss('battle-view-destroyed'); popup = null; }
                });
            }};
        }
    ]);
})();
