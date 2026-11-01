(function () {
    'use strict';
    var rules = window.TnttNoticeRules = {
        mascot: function (gender) { return String(gender || '').toUpperCase() === 'M' ? 'leader-female.png' : 'leader-male.png'; },
        active: function (item, now) { return item && !item.disabled && !item.readAt && Number(item.startsAt) <= now && now < Number(item.endsAt); }
    };
    angular.module('Hrm.TnttDocuments').factory('TnttNoticeCenter', ['$rootScope', '$cookies', '$timeout', '$state', '$uibModal', 'AuthSession', 'settings', 'TnttDocumentApi',
        function ($rootScope, cookies, timeout, state, modal, auth, settings, api) {
            var center = {unread: [], caps: null, error: '', loading: false}, generation = 0, poll = null, pending = null, unsubscribe = null, opened = null, offset = 0, identity = '';
            function current() { try { return cookies.getObject ? cookies.getObject('education.user') : JSON.parse(cookies.get('education.user') || '{}'); } catch (ignore) { return null; } }
            center.currentUser = current;
            function now() { return Date.now() + offset; }
            function counts() { center.unread = center.unread.filter(function (item) { return rules.active(item, now()); }); settings.tnttUnreadCount = center.unread.length; if (!center.unread.length) { close(); } }
            function shownKey() { return 'tntt-notice-popup:v1:' + ((current() || {}).id || ''); }
            function alreadyShown() { try { return window.sessionStorage.getItem(shownKey()) === 'yes'; } catch (ignore) { return center.shown; } }
            function rememberShown() { center.shown = true; try { window.sessionStorage.setItem(shownKey(), 'yes'); } catch (ignore) {} }
            function close() { if (opened) { opened.dismiss('context'); opened = null; } }
            function reset() { ++generation; timeout.cancel(poll); poll = null; pending = null; close(); center.unread = []; center.caps = null; center.error = ''; center.loading = false; center.reading = null; center.shown = false; settings.tnttUnreadCount = 0; settings.tnttDocumentAccess = false; }
            function schedule() {
                timeout.cancel(poll); if (!center.caps || !center.caps.canReceive) { return; }
                var delay = 60000; center.unread.forEach(function (n) { delay = Math.min(delay, Math.max(250, Number(n.endsAt) - now() + 30)); });
                poll = timeout(function () { poll = null; counts(); if (!window.document.hidden) { center.refresh(); } else { schedule(); } }, delay);
            }
            center.open = function (automatic) {
                counts(); if (opened || !center.unread.length) { return; }
                if (automatic && (!state.is('application.dashboard') || alreadyShown() || window.document.hidden || window.document.body.classList.contains('study-notebook-open') || window.document.querySelector('.modal.in'))) { return; }
                rememberShown(); center.error = '';
                opened = modal.open({animation: true, windowClass: 'tntt-notice-window', backdrop: true,
                    template: '<section class="tn-popup"><header><div><small>THÔNG BÁO TNTT</small><h2>Bạn có {{center.unread.length}} thông báo chưa đọc</h2></div><button type="button" ng-click="$dismiss()" aria-label="Để sau">×</button></header><div class="tn-popup-body"><p role="alert" ng-if="center.error">{{center.error}}</p><article ng-repeat="notice in center.unread track by notice.id"><h3>{{notice.title}}</h3><p class="tn-preserve">{{notice.summary}}</p><small>Hiển thị đến {{notice.endsAt | date:\'dd/MM/yyyy HH:mm\'}}</small><div><button class="tn-button tn-primary" ng-click="center.view(notice)">Xem tài liệu</button><button class="tn-button" ng-click="center.read(notice)" ng-disabled="center.reading===notice.id">Đã đọc</button></div></article></div><footer><button class="tn-button" ng-click="$dismiss()">Để sau</button><button class="tn-button" ng-click="center.history()">Tất cả thông báo</button></footer></section>',
                    controller: ['$scope', function (scope) { scope.center = center; }]});
                var instance = opened; instance.result.then(function () { if (opened === instance) { opened = null; } }, function () { if (opened === instance) { opened = null; } });
            };
            center.view = function (notice) { close(); state.go('application.tntt_documents', {tab: 'notices', notice: notice.id}); };
            center.history = function () { close(); state.go('application.tntt_documents', {tab: 'notices', notice: null}); };
            center.read = function (notice) {
                if (center.reading) { return; } var request = generation; center.reading = notice.id;
                return api.markRead(notice.id).then(function () { if (request !== generation) { return; } center.unread = center.unread.filter(function (n) { return n.id !== notice.id; }); counts(); if (!center.unread.length) { close(); } return center.refresh(); })
                    .catch(function (error) { if (request === generation) { center.error = error.data && error.data.message || 'Chưa xác nhận đã đọc. Vui lòng thử lại.'; } }).finally(function () { if (request === generation) { center.reading = null; } });
            };
            center.refresh = function () {
                counts(); if (pending || !center.caps || !center.caps.canReceive || !auth.hasCredentials()) { return pending; }
                var request = generation; center.loading = true;
                pending = api.notifications(true).then(function (items) { if (request !== generation) { return; } center.unread = Array.isArray(items) ? items : []; counts(); center.error = ''; timeout(function () { if (request === generation) { center.open(true); } }, 350); })
                    .catch(function (error) { if (request !== generation) { return; } if (error.status === 401 || error.status === 403) { center.unread = []; counts(); close(); } center.error = 'Chưa cập nhật được thông báo.'; })
                    .finally(function () { if (request === generation) { pending = null; center.loading = false; schedule(); } });
                return pending;
            };
            function identityValue() {
                var user = current(); return settings.campaignsEnabled === true && settings.permissionsLoaded && auth.hasCredentials() && user && user.id ? user.id + ':' + JSON.stringify(user.roles || []) : '';
            }
            center.start = function () {
                if (unsubscribe) { return; }
                unsubscribe = $rootScope.$watch(identityValue, function (value) {
                    if (identity === value && center.caps) { return; } if (identity && !value) { try { window.sessionStorage.removeItem('tntt-notice-popup:v1:' + identity.split(':')[0]); } catch (ignore) {} } identity = value; reset(); if (!value) { return; }
                    var request = generation;
                    api.capabilities().then(function (caps) { if (request !== generation) { return; } center.caps = caps; offset = Number(caps.serverNow || Date.now()) - Date.now(); settings.tnttDocumentAccess = !!caps.enabled && (caps.canEdit || caps.canReceive); if (caps.enabled && caps.canReceive) { center.refresh(); } }).catch(angular.noop);
                });
            };
            center.stop = function () { if (unsubscribe) { unsubscribe(); unsubscribe = null; } identity = ''; reset(); };
            $rootScope.$on('session:restored', function () { center.shown = false; try { window.sessionStorage.removeItem(shownKey()); } catch (ignore) {} if (center.caps) { center.refresh(); } });
            $rootScope.$on('$stateChangeSuccess', function () { if (center.caps) { center.open(true); } });
            $rootScope.$on('$stateChangeStart', function (event, next, params) { if (next.name === 'login' && !(params && params.showHome)) { try { window.sessionStorage.removeItem(shownKey()); } catch (ignore) {} center.shown = false; } });
            return center;
        }]);
    angular.module('Hrm.TnttDocuments').directive('tnttNotificationPet', ['TnttNoticeCenter', 'settings', function (center, settings) {
        return {restrict: 'E', scope: {}, controllerAs: 'pet', bindToController: true,
            controller: function () { this.center = center; this.settings = settings; this.image = function () { return 'assets/images/tntt-notices/' + rules.mascot(((center.currentUser() || {}).person || {}).gender); }; },
            template: '<div class="tntt-notice-mascot" ng-show="pet.settings.campaignsEnabled && pet.center.unread.length"><button type="button" class="tn-mascot-button" aria-label="Xem thông báo TNTT chưa đọc" aria-haspopup="dialog"><img ng-if="pet.center.unread.length" ng-src="{{pet.image()}}" alt="Huynh trưởng nhắc thông báo" draggable="false"><span class="tn-mascot-count">{{pet.center.unread.length}}</span><span class="tn-mascot-label">Thông báo mới</span></button></div>',
            link: function (scope, element) {
                var host = element[0].querySelector('.tntt-notice-mascot'), button = element[0].querySelector('button'), drag = null, movedAt = 0, currentUser = null;
                function position(x, y) { var box = host.getBoundingClientRect(); x = Math.max(8, Math.min(window.innerWidth - (box.width || 110) - 8, x)); y = Math.max(8, Math.min(window.innerHeight - (box.height || 160) - 8, y)); host.style.left = x + 'px'; host.style.top = y + 'px'; host.style.right = host.style.bottom = 'auto'; }
                function restore() { var user = center.currentUser() || {}; if (user.id === currentUser) { return; } currentUser = user.id; host.style.left = host.style.top = ''; host.style.right = '18px'; host.style.bottom = '18px'; try { var stored = JSON.parse(window.localStorage.getItem('tntt-notice-position:' + currentUser) || 'null'); if (stored && isFinite(stored.x) && isFinite(stored.y)) { position(stored.x, stored.y); } } catch (ignore) {} }
                function down(e) { if (e.button !== undefined && e.button !== 0 || drag) { return; } var box = host.getBoundingClientRect(); drag = {id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left, top: box.top, moved: false}; if (button.setPointerCapture) { button.setPointerCapture(e.pointerId); } }
                function move(e) { if (!drag || drag.id !== e.pointerId) { return; } var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; position(drag.left + dx, drag.top + dy); e.preventDefault(); } }
                function up(e) { if (!drag || drag.id !== e.pointerId) { return; } if (drag.moved) { movedAt = Date.now(); var box = host.getBoundingClientRect(); try { window.localStorage.setItem('tntt-notice-position:' + currentUser, JSON.stringify({x: box.left, y: box.top})); } catch (ignore) {} } drag = null; if (button.hasPointerCapture && button.hasPointerCapture(e.pointerId)) { button.releasePointerCapture(e.pointerId); } }
                function click(e) { if (Date.now() - movedAt < 400) { e.preventDefault(); return; } scope.$evalAsync(function () { center.open(false); }); }
                function resize() { if (host.style.left) { position(parseFloat(host.style.left), parseFloat(host.style.top)); } }
                var unwatch = scope.$watch(function () { return (center.currentUser() || {}).id; }, restore);
                button.addEventListener('pointerdown', down); button.addEventListener('pointermove', move); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('click', click); window.addEventListener('resize', resize); center.start();
                scope.$on('$destroy', function () { unwatch(); center.stop(); button.removeEventListener('pointerdown', down); button.removeEventListener('pointermove', move); button.removeEventListener('pointerup', up); button.removeEventListener('pointercancel', up); button.removeEventListener('click', click); window.removeEventListener('resize', resize); });
            }};
    }]);
}());
