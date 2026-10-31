(function () {
    'use strict';

    Hrm.factory('SessionLoginModal', ['$rootScope', '$http', '$q', '$uibModal', 'AuthSession', 'settings', '$state', '$window', '$timeout',
        function ($rootScope, $http, $q, modal, auth, settings, $state, $window, $timeout) {
            var popup = null, opening = false;
            // Inline so an expired session never needs a template HTTP request.
            var template = [
                '<form class="session-login-dialog" ng-submit="login.submit()" novalidate>',
                '<div class="modal-header"><h3 id="session-login-title" class="modal-title">Đăng nhập lại để tiếp tục</h3></div>',
                '<div class="modal-body">',
                '<p>Không thể sử dụng phiên đăng nhập hiện tại. Vui lòng đăng nhập lại. Bài làm đã lưu trên thiết bị vẫn được giữ.</p>',
                '<div class="form-group"><label for="session-modal-username">Tên đăng nhập</label>',
                '<input id="session-modal-username" class="form-control" type="text" autocomplete="username" ng-model="login.username" ng-readonly="login.fixedUser" ng-disabled="login.busy" required></div>',
                '<div class="form-group"><label for="session-modal-password">Mật khẩu</label>',
                '<input id="session-modal-password" class="form-control" type="password" autocomplete="current-password" ng-model="login.password" ng-disabled="login.busy" required></div>',
                '<p class="alert alert-danger" role="alert" aria-live="polite" ng-if="login.error">{{login.error}}</p>',
                '</div><div class="modal-footer">',
                '<button type="button" class="btn btn-default" ng-click="login.leave()" ng-disabled="login.busy">Về trang đăng nhập</button>',
                '<button type="submit" class="btn btn-primary" ng-disabled="login.busy">{{login.busy ? "Đang đăng nhập…" : "Đăng nhập và tiếp tục"}}</button>',
                '</div></form>'
            ].join('');

            function open(previousUser) {
                if (popup || opening) { return; }
                opening = true;
                var expected = angular.copy(previousUser || {}), identity = auth.capture();
                var document = $window.document, exit = document.exitFullscreen || document.webkitExitFullscreen, exiting;
                try { if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) { exiting = exit.call(document); } } catch (ignore) {}
                $q.when(exiting).catch(angular.noop).then(function () {
                    if (!auth.isCurrent(identity)) { opening = false; return; }
                    var view;
                    function focus() {
                        $timeout(function () {
                            var field = document.getElementById(expected.username ? 'session-modal-password' : 'session-modal-username');
                            if (field) { field.focus(); }
                        }, 0);
                    }
                    var instance = modal.open({
                        animation: false, backdrop: 'static', keyboard: false,
                        windowClass: 'session-login-modal-window', backdropClass: 'session-login-modal-backdrop',
                        ariaLabelledBy: 'session-login-title', template: template, controllerAs: 'login',
                        controller: function () {
                            var login = view = this;
                            login.username = String(expected.username || ''); login.fixedUser = !!expected.username;
                            login.password = ''; login.error = ''; login.busy = false;
                            login.leave = function () {
                                if (login.busy) { return; }
                                auth.logout();
                                instance.close();
                                $state.go('login');
                            };
                            login.submit = function () {
                                if (login.busy) { return; }
                                login.error = '';
                                if (!auth.isCurrent(identity)) {
                                    login.password = '';
                                    login.error = 'Phiên đăng nhập đã thay đổi ở tab khác. Về trang đăng nhập để tiếp tục.';
                                    return;
                                }
                                if (!login.username.trim() || !login.password) { login.error = 'Vui lòng nhập tên đăng nhập và mật khẩu.'; focus(); return; }
                                if ($window.navigator.onLine === false) { login.error = 'Bạn đang mất kết nối Internet. Kiểm tra mạng rồi thử lại.'; return; }
                                login.busy = true;
                                var accepted = false;
                                var credentials = {username: expected.username || login.username.trim(), password: login.password};
                                var task = auth.login(credentials).then(function (response) {
                                    identity = response.sessionIdentity || auth.capture();
                                    if (!auth.isCurrent(identity)) { return $q.reject({sessionChanged: true}); }
                                    accepted = true;
                                    return $http.get(settings.api.baseUrl + 'api/users/getCurrentUser', {loginRequest: true, timeout: 20000});
                                }).then(function (response) {
                                    if (!auth.isCurrent(identity)) { return $q.reject({sessionChanged: true}); }
                                    var user = response.data;
                                    if (!user || !user.id || !user.username ||
                                        (expected.id != null && String(user.id) !== String(expected.id)) ||
                                        (expected.username && String(user.username).toLowerCase() !== String(expected.username).toLowerCase())) {
                                        auth.logout(); identity = auth.capture();
                                        return $q.reject({differentUser: true});
                                    }
                                    if (!auth.saveUser(user, identity)) { return $q.reject({sessionChanged: true}); }
                                    instance.close();
                                    $rootScope.$emit('session:restored', user, {modal: true});
                                });
                                login.password = ''; credentials = null;
                                return task.catch(function (error) {
                                    if (accepted && !auth.isCurrent(identity)) { error = {sessionChanged: true}; }
                                    var status = error && error.status, code = error && error.data && error.data.error;
                                    if (error && error.sessionChanged) { login.error = 'Phiên đăng nhập đã thay đổi. Về trang đăng nhập để tiếp tục.'; }
                                    else if (error && error.differentUser) { login.error = 'Tài khoản không trùng với phiên đang mở. Về trang đăng nhập để đổi tài khoản.'; }
                                    else if (!accepted && (status === 401 || code === 'invalid_grant')) { login.error = 'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.'; }
                                    else { login.error = accepted ? 'Chưa xác nhận được tài khoản. Kiểm tra kết nối rồi đăng nhập lại.' : 'Chưa thể đăng nhập. Kiểm tra kết nối rồi thử lại.'; }
                                    // A failed password attempt advances the browser marker too.
                                    // AuthSession has already checked that it still owns that
                                    // attempt. Never adopt a different tab's newer credentials.
                                    if ((!accepted && !(error && error.sessionChanged)) || !auth.hasCredentials()) {
                                        identity = auth.capture();
                                    }
                                    focus();
                                }).finally(function () { login.busy = false; });
                            };
                        }
                    });
                    popup = instance; opening = false;
                    function cleanup() { if (view) { view.password = ''; } if (popup === instance) { popup = null; } }
                    instance.result.then(cleanup, cleanup);
                    instance.opened.then(focus, angular.noop);
                }).catch(function () { opening = false; });
            }
            return {open: open, isOpen: function () { return opening || !!popup; }};
        }
    ]);
})();
