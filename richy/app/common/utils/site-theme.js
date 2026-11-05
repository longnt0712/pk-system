(function () {
    'use strict';

    angular.module('Hrm').factory('SiteTheme', ['$http', '$q', '$window', '$rootScope', 'settings',
        function ($http, $q, $window, $rootScope, settings) {
            var document = $window.document;
            var hostname = String($window.location.hostname || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
            var allowed = hostname === 'ieltsroom.com';
            var state = {theme: 'NORMAL', schoolId: null, domain: hostname, loaded: false, loading: false, saving: false, error: '', readError: ''};
            var started = false, timer = null, reading = null, writing = null, revision = 0, snow = null, routeListener = null;
            settings.siteThemeEnabled = allowed;

            function valid(theme) { return theme === 'NORMAL' || theme === 'HALLOWEEN' || theme === 'CHRISTMAS'; }
            function pauseSnow(stateName) {
                if (snow) {
                    if (typeof stateName === 'string') { snow.classList.toggle('is-exam', /actual_test|test_results|speaking_shared/.test(stateName)); }
                    snow.classList.toggle('is-paused', !!document.hidden);
                }
            }
            function updateSnow() {
                if (state.theme !== 'CHRISTMAS') {
                    if (snow && snow.parentNode) { snow.parentNode.removeChild(snow); }
                    snow = null;
                    return;
                }
                if (!snow && document.body) {
                    snow = document.createElement('div');
                    snow.className = 'christmas-snow';
                    snow.setAttribute('aria-hidden', 'true');
                    for (var i = 0; i < 10; i += 1) {
                        var flake = document.createElement('i');
                        flake.style.setProperty('--snow-x', (4 + i * 9.5) + '%');
                        flake.style.setProperty('--snow-size', (16 + (i % 4) * 5) + 'px');
                        flake.style.setProperty('--snow-duration', (19 + (i % 5) * 4) + 's');
                        flake.style.setProperty('--snow-delay', (-i * 4.3) + 's');
                        snow.appendChild(flake);
                    }
                    document.body.appendChild(snow);
                }
                pauseSnow(($rootScope.$state && $rootScope.$state.current || {}).name);
            }
            function url(path) { return (settings.api.baseUrl || '').replace(/\/?$/, '/') + path; }
            function apply(theme) {
                state.theme = allowed && valid(theme) ? theme : 'NORMAL';
                document.documentElement.classList.toggle('ieltsroom-halloween', state.theme === 'HALLOWEEN');
                document.documentElement.classList.toggle('ieltsroom-christmas', state.theme === 'CHRISTMAS');
                document.documentElement.setAttribute('data-site-theme', state.theme);
                updateSnow();
            }
            function options() { return {cache: false, timeout: 10000, skipNetworkNotice: true, backgroundSessionCheck: true}; }
            function responseTheme(response) {
                var theme = response && response.data && response.data.theme;
                if (!valid(theme)) { throw new Error('Invalid site theme response'); }
                return theme;
            }
            function currentRequest() {
                return $http.get(url('public/site-theme'), angular.extend(options(), {params:{domain:hostname}})).catch(function (error) {
                    if (error.status !== 404 || hostname !== 'ieltsroom.com') { return $q.reject(error); }
                    return $http.get(url('public/site-theme/ieltsroom'), options()).then(function (response) {
                        response.data.configured = true; response.data.legacy = true;
                        response.data.domain = hostname; response.data.name = 'IELTS Room';
                        return response;
                    });
                });
            }
            function refresh() {
                if (!started || state.saving) { return $q.when(state); }
                if (reading) { return reading; }
                var requestRevision = revision;
                state.loading = !state.loaded;
                var request = currentRequest().then(function (response) {
                    var theme = responseTheme(response);
                    if (started && revision === requestRevision) {
                        allowed = response.data.configured === true;
                        settings.siteThemeEnabled = allowed;
                        state.schoolId = response.data.schoolId || null;
                        state.domain = response.data.domain || hostname;
                        state.name = response.data.name || state.domain;
                        state.legacy = response.data.legacy === true;
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
                if (state.schoolId) { return saveSchools(theme, [state.schoolId]); }
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
            function schools() {
                if (settings.isAdmin !== true) { return $q.reject(new Error('Chỉ admin được chọn trường.')); }
                if (state.legacy) { return $q.when([]); }
                return $http.get(url('api/site-theme/schools'), options()).then(function (response) { return response.data; });
            }
            function saveSchools(theme, schoolIds) {
                if (settings.isAdmin !== true || !allowed) { return $q.reject(new Error('Chỉ admin được cấu hình giao diện.')); }
                if (!valid(theme) || !schoolIds || !schoolIds.length) { return $q.reject(new Error('Chọn trường và giao diện.')); }
                if (writing) { return writing; }
                revision += 1;
                var requestRevision = revision;
                state.saving = true; state.error = '';
                writing = $http.put(url('api/site-theme/schools'), {theme:theme,schoolIds:schoolIds}, options()).then(function (response) {
                    if (started && revision === requestRevision) {
                        angular.forEach(response.data, function (row) {
                            if (row.schoolId === state.schoolId && valid(row.theme)) { apply(row.theme); }
                        });
                        state.loaded = true; state.readError = '';
                    }
                    return response.data;
                }).catch(function (error) {
                    state.error = error && error.data && error.data.message || 'Chưa lưu được giao diện cho các trường đã chọn. Vui lòng thử lại.';
                    return $q.reject(error);
                }).finally(function () { state.saving = false; writing = null; });
                return writing;
            }
            function refreshVisible() {
                pauseSnow();
                if (!document.hidden) { $rootScope.$evalAsync(function () { refresh(); }); }
            }
            function start() {
                if (started) { return; }
                started = true;
                refresh();
                timer = $window.setInterval(refreshVisible, 15000);
                document.addEventListener('visibilitychange', refreshVisible);
                $window.addEventListener('focus', refreshVisible);
                $window.addEventListener('online', refreshVisible);
                routeListener = $rootScope.$on('$stateChangeSuccess', function (event, state) { pauseSnow(state.name); });
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
                if (routeListener) { routeListener(); routeListener = null; }
                apply('NORMAL');
            }
            return {state: state, enabled: function () { return allowed; }, start: start, stop: stop, refresh: refresh, save: save, schools: schools, saveSchools: saveSchools};
        }
    ]).directive('siteThemeControl', ['SiteTheme', '$uibModal', 'settings', function (siteTheme, modal, settings) {
        return {
            restrict: 'E',
            template: '<button type="button" class="site-theme-open" ng-if="canChooseTheme()" ng-click="openSiteTheme()" aria-label="Chọn giao diện theo trường" title="Giao diện dùng chung theo trường"><i class="fa fa-paint-brush" aria-hidden="true"></i><span>Giao diện</span></button>',
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
                            '<div class="modal-header"><button type="button" class="site-theme-close" ng-click="themeEditor.cancel()" aria-label="Đóng" ng-disabled="themeEditor.state.saving">×</button><span class="site-theme-kicker">GIAO DIỆN DÙNG CHUNG</span><h2 id="site-theme-title">Giao diện theo trường</h2><p>Chọn một hoặc nhiều trường, rồi chọn giao diện áp dụng cho người dùng của các trường đó.</p></div>' +
                            '<div class="modal-body"><fieldset class="site-theme-schools" ng-if="!themeEditor.state.legacy"><legend>Trường áp dụng</legend><div class="site-theme-school-actions"><button type="button" ng-click="themeEditor.selectAll(true)" ng-disabled="themeEditor.state.saving">Chọn tất cả</button><button type="button" ng-click="themeEditor.selectAll(false)" ng-disabled="themeEditor.state.saving">Bỏ chọn</button></div><div class="site-theme-school-list"><label ng-repeat="school in themeEditor.schools track by school.schoolId"><input type="checkbox" ng-model="school.selected" ng-disabled="themeEditor.state.saving"><span><strong>{{school.name}} · #{{school.schoolId}}</strong><small>{{school.domain}}</small></span><em>{{school.theme === "CHRISTMAS" ? "Christmas" : school.theme === "HALLOWEEN" ? "Halloween" : "Normal"}}</em></label></div><p ng-if="themeEditor.schoolsLoaded && !themeEditor.schools.length">Chưa có trường đang hoạt động. Thêm trường trong Quản lý School trước khi áp dụng giao diện.</p><p role="alert" ng-if="themeEditor.schoolError">{{themeEditor.schoolError}} <button type="button" ng-click="themeEditor.loadSchools()">Thử lại</button></p></fieldset><div class="site-theme-options" role="radiogroup" aria-label="Giao diện dùng chung">' +
                            '<label class="site-theme-option" ng-class="{\'is-selected\':themeEditor.selection===\'NORMAL\'}"><input type="radio" name="siteThemeChoice" value="NORMAL" ng-model="themeEditor.selection" ng-change="themeEditor.edited=true" ng-disabled="themeEditor.state.saving"><span class="site-theme-preview site-theme-preview--normal" aria-hidden="true"><i></i><i></i><i></i></span><strong>Normal</strong><span>Giao diện quen thuộc</span></label>' +
                            '<label class="site-theme-option" ng-class="{\'is-selected\':themeEditor.selection===\'HALLOWEEN\'}"><input type="radio" name="siteThemeChoice" value="HALLOWEEN" ng-model="themeEditor.selection" ng-change="themeEditor.edited=true" ng-disabled="themeEditor.state.saving"><span class="site-theme-preview site-theme-preview--halloween" aria-hidden="true"><i></i><i></i><i></i></span><strong>Halloween</strong><span>Sắc cam bí ngô và tím đêm</span></label>' +
                            '<label class="site-theme-option" ng-class="{\'is-selected\':themeEditor.selection===\'CHRISTMAS\'}"><input type="radio" name="siteThemeChoice" value="CHRISTMAS" ng-model="themeEditor.selection" ng-change="themeEditor.edited=true" ng-disabled="themeEditor.state.saving"><span class="site-theme-preview site-theme-preview--christmas" aria-hidden="true"><i></i><i></i><i></i></span><strong>Christmas</strong><span>Đèn Noel và tuyết pha lê nhẹ</span></label></div>' +
                            '<p class="site-theme-current" ng-if="themeEditor.state.loaded">Trang hiện tại ({{themeEditor.state.domain}}): <strong>{{themeEditor.state.theme === "CHRISTMAS" ? "Christmas" : themeEditor.state.theme === "HALLOWEEN" ? "Halloween" : "Normal"}}</strong></p>' +
                            '<p role="status" ng-if="themeEditor.state.loading">Đang tải giao diện…</p>' +
                            '<div class="alert alert-danger" role="alert" ng-if="themeEditor.state.error">{{themeEditor.state.error}} <button type="button" class="site-theme-retry" ng-click="themeEditor.retry()" ng-disabled="themeEditor.state.loading || themeEditor.state.saving">Tải lại lựa chọn</button></div>' +
                            '<div class="alert alert-warning" role="alert" ng-if="themeEditor.state.readError">{{themeEditor.state.readError}} <button type="button" class="site-theme-retry" ng-click="themeEditor.retry()" ng-disabled="themeEditor.state.loading || themeEditor.state.saving">Thử lại</button></div></div>' +
                            '<div class="modal-footer"><button type="button" class="btn btn-default" ng-click="themeEditor.cancel()" ng-disabled="themeEditor.state.saving">Hủy</button><button type="button" class="btn btn-primary site-theme-save" ng-click="themeEditor.save()" ng-disabled="!themeEditor.state.loaded || themeEditor.state.saving || !themeEditor.hasSelection()"><i class="fa fa-spinner fa-spin" ng-if="themeEditor.state.saving" aria-hidden="true"></i>{{themeEditor.state.saving ? "Đang lưu…" : "Lưu áp dụng"}}</button></div></div>',
                        controllerAs: 'themeEditor',
                        controller: ['$uibModalInstance', '$scope', function (instance, editorScope) {
                            var editor = this;
                            editor.state = siteTheme.state;
                            editor.selection = siteTheme.state.theme;
                            editor.schools = []; editor.schoolsLoaded = false;
                            editor.hasSelection = function () { return editor.state.legacy || editor.schools.some(function (school) { return school.selected; }); };
                            editor.selectAll = function (selected) { angular.forEach(editor.schools, function (school) { school.selected = selected; }); };
                            editor.loadSchools = function () {
                                editor.schoolError = ''; editor.schoolsLoaded = false;
                                siteTheme.schools().then(function (rows) {
                                    editor.schools = rows.map(function (row) { return angular.extend({}, row, {selected:row.schoolId === editor.state.schoolId}); });
                                    editor.schoolsLoaded = true;
                                }, function () { editor.schoolError = 'Chưa tải được danh sách trường.'; });
                            };
                            editor.cancel = function () { if (!editor.state.saving) { instance.dismiss('cancel'); } };
                            editor.retry = function () { editor.edited = false; siteTheme.refresh().then(function () { if (!editor.edited) { editor.selection = editor.state.theme; } if (!editor.state.readError) { editor.state.error = ""; } if (!editor.schoolsLoaded) { editor.loadSchools(); } }); };
                            editor.save = function () {
                                if (!editor.hasSelection()) { return; }
                                var work = editor.state.legacy ? siteTheme.save(editor.selection) : siteTheme.saveSchools(editor.selection,
                                    editor.schools.filter(function (school) { return school.selected; }).map(function (school) { return school.schoolId; }));
                                work.then(function () { instance.close(); }, angular.noop);
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
