(function () {
    'use strict';

    angular.module('Hrm').factory('SiteTheme', ['$http', '$q', '$window', '$rootScope', 'settings',
        function ($http, $q, $window, $rootScope, settings) {
            var document = $window.document;
            var allowed = /^(www\.)?ieltsroom\.com$/i.test($window.location.hostname || '');
            var state = {theme: 'NORMAL', loaded: false, loading: false, saving: false, error: '', readError: ''};
            var started = false, timer = null, reading = null, writing = null, revision = 0;
            settings.siteThemeEnabled = allowed;

            function valid(theme) { return theme === 'NORMAL' || theme === 'HALLOWEEN'; }
            function url(path) { return (settings.api.baseUrl || '').replace(/\/?$/, '/') + path; }
            function apply(theme) {
                state.theme = allowed && valid(theme) ? theme : 'NORMAL';
                document.documentElement.classList.toggle('ieltsroom-halloween', state.theme === 'HALLOWEEN');
                document.documentElement.setAttribute('data-site-theme', state.theme);
            }
            function options() { return {cache: false, timeout: 10000, skipNetworkNotice: true, backgroundSessionCheck: true}; }
            function responseTheme(response) {
                var theme = response && response.data && response.data.theme;
                if (!valid(theme)) { throw new Error('Invalid site theme response'); }
                return theme;
            }
            function refresh() {
                if (!allowed || !started || state.saving) { return $q.when(state); }
                if (reading) { return reading; }
                var requestRevision = revision;
                state.loading = !state.loaded;
                var request = $http.get(url('public/site-theme/ieltsroom'), options()).then(function (response) {
                    var theme = responseTheme(response);
                    if (started && revision === requestRevision) {
                        apply(theme);
                        state.loaded = true;
                        state.readError = '';
                    }
                    return state;
                }).catch(function () {
                    if (started && revision === requestRevision) {
                        state.readError = 'Chưa tải được giao diện đang áp dụng. Vui lòng thử lại.';
                    }
                    return state;
                }).finally(function () {
                    if (reading === request) { state.loading = false; reading = null; }
                });
                reading = request;
                return request;
            }
            function save(theme) {
                if (!allowed || settings.isAdmin !== true) { return $q.reject(new Error('Chỉ admin IELTS Room được đổi giao diện.')); }
                if (!valid(theme)) { return $q.reject(new Error('Giao diện không hợp lệ.')); }
                if (writing) { return writing; }
                revision += 1;
                var requestRevision = revision;
                state.saving = true;
                state.error = '';
                writing = $http.put(url('api/site-theme/ieltsroom'), {theme: theme}, options()).then(function (response) {
                    var savedTheme = responseTheme(response);
                    if (started && revision === requestRevision) {
                        apply(savedTheme);
                        state.loaded = true;
                        state.readError = '';
                    }
                    return state;
                }).catch(function (error) {
                    state.error = error && error.status === 409
                        ? 'Giao diện vừa được admin khác thay đổi. Hãy tải lại và lưu lại.'
                        : 'Chưa lưu được giao diện. Giao diện hiện tại vẫn được giữ nguyên. Vui lòng thử lại.';
                    return $q.reject(error);
                }).finally(function () { state.saving = false; writing = null; });
                return writing;
            }
            function refreshVisible() {
                if (!document.hidden) { $rootScope.$evalAsync(function () { refresh(); }); }
            }
            function start() {
                if (started || !allowed) { if (!allowed) { apply('NORMAL'); } return; }
                started = true;
                refresh();
                timer = $window.setInterval(refreshVisible, 15000);
                document.addEventListener('visibilitychange', refreshVisible);
                $window.addEventListener('focus', refreshVisible);
                $window.addEventListener('online', refreshVisible);
            }
            function stop() {
                started = false;
                revision += 1;
                reading = null;
                state.loading = false;
                if (timer !== null) { $window.clearInterval(timer); timer = null; }
                document.removeEventListener('visibilitychange', refreshVisible);
                $window.removeEventListener('focus', refreshVisible);
                $window.removeEventListener('online', refreshVisible);
                apply('NORMAL');
            }
            return {state: state, enabled: function () { return allowed; }, start: start, stop: stop, refresh: refresh, save: save};
        }
    ]).directive('siteThemeControl', ['SiteTheme', '$uibModal', 'settings', function (siteTheme, modal, settings) {
        return {
            restrict: 'E',
            template: '<button type="button" class="site-theme-open" ng-if="canChooseTheme()" ng-click="openSiteTheme()" aria-label="Chọn giao diện cho IELTS Room" title="Giao diện dùng chung cho IELTS Room"><i class="fa fa-paint-brush" aria-hidden="true"></i><span>Giao diện</span></button>',
            scope: true,
            link: function (scope) {
                var dialog = null;
                scope.canChooseTheme = function () { return siteTheme.enabled() && settings.isAdmin === true; };
                scope.openSiteTheme = function () {
                    if (!scope.canChooseTheme() || dialog) { return; }
                    dialog = modal.open({
                        animation: true,
                        windowClass: 'site-theme-dialog',
                        ariaLabelledBy: 'site-theme-title',
                        backdrop: 'static',
                        size: 'md',
                        template: '<div class="site-theme-editor">' +
                            '<div class="modal-header"><button type="button" class="site-theme-close" ng-click="themeEditor.cancel()" aria-label="Đóng" ng-disabled="themeEditor.state.saving">×</button><span class="site-theme-kicker">IELTS ROOM</span><h2 id="site-theme-title">Giao diện IELTS Room</h2><p>Chọn giao diện dùng chung cho tất cả mọi người.</p></div>' +
                            '<div class="modal-body"><div class="site-theme-options" role="radiogroup" aria-label="Giao diện dùng chung">' +
                            '<label class="site-theme-option" ng-class="{\'is-selected\':themeEditor.selection===\'NORMAL\'}"><input type="radio" name="siteThemeChoice" value="NORMAL" ng-model="themeEditor.selection" ng-change="themeEditor.edited=true" ng-disabled="themeEditor.state.saving"><span class="site-theme-preview site-theme-preview--normal" aria-hidden="true"><i></i><i></i><i></i></span><strong>Normal</strong><span>Giao diện quen thuộc</span></label>' +
                            '<label class="site-theme-option" ng-class="{\'is-selected\':themeEditor.selection===\'HALLOWEEN\'}"><input type="radio" name="siteThemeChoice" value="HALLOWEEN" ng-model="themeEditor.selection" ng-change="themeEditor.edited=true" ng-disabled="themeEditor.state.saving"><span class="site-theme-preview site-theme-preview--halloween" aria-hidden="true"><i></i><i></i><i></i></span><strong>Halloween</strong><span>Sắc cam bí ngô và tím đêm</span></label></div>' +
                            '<p class="site-theme-current" ng-if="themeEditor.state.loaded">Đang áp dụng: <strong>{{themeEditor.state.theme === "HALLOWEEN" ? "Halloween" : "Normal"}}</strong></p>' +
                            '<p role="status" ng-if="themeEditor.state.loading">Đang tải giao diện…</p>' +
                            '<div class="alert alert-danger" role="alert" ng-if="themeEditor.state.error">{{themeEditor.state.error}} <button type="button" class="site-theme-retry" ng-click="themeEditor.retry()" ng-disabled="themeEditor.state.loading || themeEditor.state.saving">Tải lại lựa chọn</button></div>' +
                            '<div class="alert alert-warning" role="alert" ng-if="themeEditor.state.readError">{{themeEditor.state.readError}} <button type="button" class="site-theme-retry" ng-click="themeEditor.retry()" ng-disabled="themeEditor.state.loading || themeEditor.state.saving">Thử lại</button></div></div>' +
                            '<div class="modal-footer"><button type="button" class="btn btn-default" ng-click="themeEditor.cancel()" ng-disabled="themeEditor.state.saving">Hủy</button><button type="button" class="btn btn-primary site-theme-save" ng-click="themeEditor.save()" ng-disabled="!themeEditor.state.loaded || themeEditor.state.saving"><i class="fa fa-spinner fa-spin" ng-if="themeEditor.state.saving" aria-hidden="true"></i>{{themeEditor.state.saving ? "Đang lưu…" : "Lưu áp dụng"}}</button></div></div>',
                        controllerAs: 'themeEditor',
                        controller: ['$uibModalInstance', '$scope', function (instance, editorScope) {
                            var editor = this;
                            editor.state = siteTheme.state;
                            editor.selection = siteTheme.state.theme;
                            editor.cancel = function () { if (!editor.state.saving) { instance.dismiss('cancel'); } };
                            editor.retry = function () { editor.edited = false; siteTheme.refresh().then(function () { if (!editor.edited) { editor.selection = editor.state.theme; } if (!editor.state.readError) { editor.state.error = ""; } }); };
                            editor.save = function () {
                                siteTheme.save(editor.selection).then(function () { instance.close(); }, angular.noop);
                            };
                            editorScope.$on('modal.closing', function (event) {
                                if (editor.state.saving) { event.preventDefault(); }
                            });
                            editor.retry();
                        }]
                    });
                    dialog.result.then(angular.noop, angular.noop).finally(function () { dialog = null; });
                };
                scope.$on('$destroy', function () { if (dialog) { dialog.dismiss('header-destroyed'); } });
            }
        };
    }]).run(['SiteTheme', '$rootScope', function (siteTheme, root) {
        siteTheme.start();
        root.$on('$destroy', siteTheme.stop);
    }]);
})();
