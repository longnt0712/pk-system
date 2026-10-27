(function () {
    'use strict';

    angular.module('ui.tinymce', []).value('uiTinymceConfig', {})
        .service('uiTinymceService', ['$window', '$timeout', function ($window, $timeout) {
            var records = [], queue = [], active = null, timer = null, scanTimer = null, serial = 0;
            var nearObserver = null, farObserver = null, watching = false;

            this.getUniqueId = function () { return 'ui-tinymce-' + (++serial); };
            this.flush = function () {
                records.slice().forEach(function (record) { record.flush(); });
                return true;
            };
            function drain() {
                if (active || timer || !queue.length) { return; }
                timer = $timeout(function () {
                    timer = null;
                    var record = queue.shift();
                    if (!record || record.destroyed) { drain(); return; }
                    active = record;
                    record.mount(function () { if (active === record) { active = null; drain(); } });
                }, 0, false);
            }
            this.enqueue = function (record, first) {
                if (record.destroyed || active === record || queue.indexOf(record) !== -1) { return; }
                if (first) { queue.unshift(record); } else { queue.push(record); }
                drain();
            };
            function scan() {
                scanTimer = null;
                var height = $window.innerHeight || $window.document.documentElement.clientHeight;
                records.slice().forEach(function (record) {
                    if (!record.lazy || record.destroyed) { return; }
                    var box = record.host.getBoundingClientRect();
                    var visible = box.width > 0 && box.height > 0;
                    record.near = visible && box.bottom >= -500 && box.top <= height + 500;
                    record.retained = visible && box.bottom >= -1500 && box.top <= height + 1500;
                    record.check();
                });
            }
            function requestScan() {
                if (!scanTimer) { scanTimer = $timeout(scan, 80, false); }
            }
            function watch() {
                if (watching) { return; }
                watching = true;
                if ($window.IntersectionObserver) {
                    function receive(entries, near) {
                        entries.forEach(function (entry) {
                            var record = entry.target._uiTinymceRecord;
                            if (!record || record.destroyed) { return; }
                            if (near) { record.near = entry.isIntersecting; if (record.near) { record.retained = true; } }
                            else { record.retained = entry.isIntersecting; }
                            record.check();
                        });
                    }
                    nearObserver = new $window.IntersectionObserver(function (entries) { receive(entries, true); }, { rootMargin: '500px' });
                    farObserver = new $window.IntersectionObserver(function (entries) { receive(entries, false); }, { rootMargin: '1500px' });
                } else { $window.addEventListener('scroll', requestScan, true); }
                $window.addEventListener('resize', requestScan);
                $window.document.addEventListener('click', requestScan, true);
            }
            this.register = function (record) {
                records.push(record);
                if (record.lazy) {
                    watch(); record.host._uiTinymceRecord = record;
                    if (nearObserver) { nearObserver.observe(record.host); farObserver.observe(record.host); }
                    requestScan();
                }
            };
            this.unregister = function (record) {
                var index = records.indexOf(record); if (index !== -1) { records.splice(index, 1); }
                index = queue.indexOf(record); if (index !== -1) { queue.splice(index, 1); }
                if (record.host && nearObserver) { nearObserver.unobserve(record.host); farObserver.unobserve(record.host); }
                if (record.host) { delete record.host._uiTinymceRecord; }
                if (!records.some(function (item) { return item.lazy; }) && watching) {
                    if (nearObserver) { nearObserver.disconnect(); farObserver.disconnect(); nearObserver = farObserver = null; }
                    $window.removeEventListener('scroll', requestScan, true);
                    $window.removeEventListener('resize', requestScan);
                    $window.document.removeEventListener('click', requestScan, true);
                    $timeout.cancel(scanTimer); scanTimer = null; watching = false;
                }
                if (!queue.length) { $timeout.cancel(timer); timer = null; }
            };
        }])
        .directive('uiTinymce', ['$rootScope', '$compile', '$timeout', '$window', '$sce', 'uiTinymceConfig', 'uiTinymceService',
            function ($rootScope, $compile, $timeout, $window, $sce, defaults, service) {
                return {
                    require: ['ngModel', '^?form'], priority: 599,
                    link: function (scope, element, attrs, controllers) {
                        if (!$window.tinymce) { return; }
                        var tiny = $window.tinymce, model = controllers[0], node = element[0];
                        var options = angular.extend({}, defaults || {}, scope.$eval(attrs.uiTinymce) || {});
                        var lazy = attrs.uiTinymceLazy !== undefined && scope.$eval(attrs.uiTinymceLazy) !== false;
                        var editor = null, generation = 0, initializing = false, rendering = false, evicting = false;
                        var debounce = null, watchdog = null, checkTimer = null, release = null, initTimer = null;
                        var host = null, placeholder = null, composing = false, dialogs = 0, fullscreen = false, focusAfterMount = false;
                        var originalDisplay = node.style.display, bodyComposition = null;
                        var record = { lazy: lazy, host: null, near: !lazy, retained: !lazy, destroyed: false,
                            flush: flush, mount: mount, check: check };
                        attrs.$set('id', service.getUniqueId());

                        function modelHtml() {
                            var value = model.$viewValue;
                            return value ? String($sce.getTrustedHtml(value)) : '';
                        }
                        function notifyDigest() { if (!$rootScope.$$phase && !record.destroyed) { scope.$evalAsync(angular.noop); } }
                        function updateView(instance) {
                            if (!instance || record.destroyed || instance !== editor) { return; }
                            if (!instance.getDoc()) { throw new Error('Không thể đọc nội dung trình soạn thảo.'); }
                            if (instance.save) { instance.save(); }
                            var html = instance.getContent({ format: options.format || 'html' }).trim();
                            node.value = html;
                            if (html !== modelHtml()) { model.$setViewValue($sce.trustAsHtml(html)); }
                            if (model.$commitViewValue) { model.$commitViewValue(); }
                            notifyDigest();
                        }
                        function flush() {
                            $timeout.cancel(debounce); debounce = null;
                            if (record.destroyed) { return; }
                            // A catalog selection can replace the object before ngModel's next
                            // digest renders it. Never write the previous editor into that object.
                            if (attrs.ngModel) {
                                var externalValue = scope.$eval(attrs.ngModel), knownValue = model.$modelValue;
                                if (externalValue !== knownValue && (externalValue === externalValue || knownValue === knownValue)) { return; }
                            }
                            if (editor && !initializing) { updateView(editor); }
                            else if (model.$commitViewValue) { model.$commitViewValue(); }
                        }
                        function changed() {
                            if (rendering || record.destroyed || initializing) { return; }
                            $timeout.cancel(debounce);
                            if (options.debounce === false) { flush(); }
                            else { debounce = $timeout(function () { debounce = null; flush(); }, 400, false); }
                        }
                        function render() {
                            var html = modelHtml(); node.value = html;
                            if (editor && !initializing && editor.getDoc()) {
                                rendering = true;
                                try { if (editor.getContent({ format: options.format || 'html' }) !== html) { editor.setContent(html); } }
                                finally { rendering = false; }
                            }
                        }
                        function disabled() {
                            if (!editor || !editor.getBody()) { return; }
                            var value = attrs.ngDisabled ? scope.$eval(attrs.ngDisabled) : node.disabled;
                            editor.getBody().setAttribute('contenteditable', value || editor.settings.readonly ? 'false' : 'true');
                        }
                        function showPlaceholder(loading) {
                            if (!placeholder) { return; }
                            placeholder.style.display = 'block'; node.style.display = 'none';
                            host.style.minHeight = loading ? placeholder.style.height : '';
                            placeholder.style.position = loading ? 'absolute' : '';
                            placeholder.style.top = placeholder.style.left = loading ? '0' : '';
                            placeholder.style.right = loading ? '0' : '';
                            placeholder.textContent = loading ? 'Đang tải trình soạn thảo…' : 'Trình soạn thảo sẽ hiển thị khi cuộn đến đây.';
                            host.className = 'ui-tinymce-viewport' + (loading ? ' is-loading' : '');
                        }
                        function finishMount() {
                            $timeout.cancel(watchdog); watchdog = null;
                            var done = release; release = null; if (done) { done(); }
                        }
                        function pinned() {
                            if (!editor) { return false; }
                            var active = $window.document.activeElement;
                            var container = editor.getContainer && editor.getContainer();
                            var windows = editor.windowManager && editor.windowManager.getWindows && editor.windowManager.getWindows();
                            var fullscreenPlugin = editor.plugins && editor.plugins.fullscreen;
                            return composing || dialogs > 0 || fullscreen || (windows && windows.length > 0) ||
                                (fullscreenPlugin && fullscreenPlugin.isFullscreen && fullscreenPlugin.isFullscreen()) ||
                                (editor.hasFocus && editor.hasFocus()) || (container && active && container.contains(active));
                        }
                        function requestCheck() {
                            $timeout.cancel(checkTimer);
                            checkTimer = $timeout(function () { checkTimer = null; check(); }, 0, false);
                        }
                        function clearBodyComposition() {
                            if (!bodyComposition) { return; }
                            bodyComposition.removeEventListener('compositionstart', compositionStart);
                            bodyComposition.removeEventListener('compositionend', compositionEnd); bodyComposition = null;
                        }
                        function removeEditor() {
                            clearBodyComposition();
                            var previous = editor; editor = null; initializing = false; generation++;
                            if (previous) { evicting = true; try { previous.remove(); } finally { evicting = false; } }
                            finishMount();
                        }
                        function evict() {
                            if (!editor || initializing || pinned()) { return; }
                            // A failed content read must keep the live editor; saving also reports this failure.
                            try { flush(); } catch (error) { return; }
                            var container = editor.getContainer && editor.getContainer();
                            var height = container && container.getBoundingClientRect().height;
                            if (height > 0) { placeholder.style.height = Math.max(100, height) + 'px'; }
                            removeEditor(); showPlaceholder(false);
                        }
                        function check() {
                            if (record.destroyed || !lazy) { return; }
                            if (record.near && !editor && !initializing) { service.enqueue(record); }
                            else if (!record.retained && editor) { evict(); }
                        }
                        function compositionStart() { composing = true; }
                        function compositionEnd() { composing = false; changed(); requestCheck(); }
                        function mount(done) {
                            if (record.destroyed || editor || initializing || (lazy && !record.near && !focusAfterMount)) { done(); return; }
                            release = done; initializing = true;
                            var token = ++generation;
                            var settings = angular.extend({}, options, { selector: '#' + attrs.id, setup: function (instance) {
                                if (token !== generation || record.destroyed) {
                                    instance.on('init', function () { instance.remove(); }); return;
                                }
                                editor = instance;
                                instance.on('init', function () {
                                    if (token !== generation || record.destroyed || instance !== editor) { instance.remove(); return; }
                                    initializing = false; render(); disabled();
                                    if (placeholder) { placeholder.style.display = 'none'; host.className = 'ui-tinymce-viewport'; }
                                    if (host) { host.style.minHeight = ''; }
                                    bodyComposition = instance.getBody();
                                    if (bodyComposition) {
                                        bodyComposition.addEventListener('compositionstart', compositionStart);
                                        bodyComposition.addEventListener('compositionend', compositionEnd);
                                    }
                                    finishMount();
                                    if (focusAfterMount) { focusAfterMount = false; instance.focus(); }
                                    requestCheck();
                                });
                                instance.on('input change undo redo paste ExecCommand NodeChange ObjectResized', changed);
                                instance.on('compositionstart', compositionStart); instance.on('compositionend', compositionEnd);
                                instance.on('focus', requestCheck);
                                instance.on('blur', function () { if (!record.destroyed) { flush(); model.$setTouched(); notifyDigest(); requestCheck(); } });
                                instance.on('OpenWindow', function () { dialogs++; });
                                instance.on('CloseWindow', function () { dialogs = Math.max(0, dialogs - 1); requestCheck(); });
                                instance.on('FullscreenStateChanged', function (event) { fullscreen = !!event.state; requestCheck(); });
                                instance.on('remove', function () {
                                    if (instance === editor && !evicting) { clearBodyComposition(); editor = null; initializing = false; finishMount(); showPlaceholder(false); }
                                });
                                if (defaults && defaults.setup) { defaults.setup(instance, { updateView: updateView }); }
                                if (options.setup && (!defaults || options.setup !== defaults.setup)) { options.setup(instance, { updateView: updateView }); }
                            } });
                            showPlaceholder(true); node.style.display = originalDisplay;
                            if (settings.baseURL || settings.baseUrl) { tiny.baseURL = settings.baseURL || settings.baseUrl; }
                            watchdog = $timeout(function () {
                                if (token === generation && initializing) { removeEditor(); showPlaceholder(false); }
                            }, 15000, false);
                            try {
                                var result = tiny.init(settings);
                                if (result && typeof result.then === 'function') {
                                    result.then(angular.noop, function () { if (token === generation) { removeEditor(); showPlaceholder(false); } });
                                }
                            } catch (error) {
                                if (token === generation) { removeEditor(); showPlaceholder(false); }
                            }
                        }
                        function activate(event) {
                            if (event.type === 'keydown' && event.keyCode !== 13 && event.keyCode !== 32) { return; }
                            event.preventDefault(); focusAfterMount = true; record.near = record.retained = true; service.enqueue(record, true);
                        }
                        if (lazy) {
                            host = $window.document.createElement('div'); host.className = 'ui-tinymce-viewport'; host.style.position = 'relative';
                            placeholder = $window.document.createElement('div'); placeholder.className = 'ui-tinymce-placeholder';
                            placeholder.style.height = Math.max(100, parseInt(options.height, 10) || 200) + 'px';
                            placeholder.setAttribute('role', 'button'); placeholder.setAttribute('tabindex', '0');
                            node.parentNode.insertBefore(host, node); host.appendChild(node); host.appendChild(placeholder);
                            record.host = host; showPlaceholder(false);
                            placeholder.addEventListener('click', activate); placeholder.addEventListener('keydown', activate);
                        }
                        model.$formatters.unshift(function (value) { return value ? $sce.trustAsHtml(value) : ''; });
                        model.$parsers.unshift(function (value) { return value ? $sce.getTrustedHtml(value) : ''; });
                        model.$render = render;
                        attrs.$observe('disabled', disabled);
                        node.addEventListener('compositionstart', compositionStart); node.addEventListener('compositionend', compositionEnd);
                        service.register(record);
                        if (!lazy) { initTimer = $timeout(function () { initTimer = null; mount(angular.noop); }, 0, false); }
                        scope.$on('$tinymce:flush', flush);
                        scope.$on('$tinymce:refresh', function (event, id) {
                            if (id !== undefined && id !== attrs.id) { return; }
                            flush(); removeEditor(); options = angular.extend({}, defaults || {}, scope.$eval(attrs.uiTinymce) || {});
                            if (lazy) { showPlaceholder(false); check(); } else { mount(angular.noop); }
                        });
                        scope.$on('$destroy', function () {
                            // Commit any last input before Angular removes this field's scope.
                            try { flush(); } finally {
                                record.destroyed = true;
                                $timeout.cancel(debounce); $timeout.cancel(checkTimer); $timeout.cancel(initTimer);
                                removeEditor(); service.unregister(record);
                                node.removeEventListener('compositionstart', compositionStart); node.removeEventListener('compositionend', compositionEnd);
                                if (placeholder) { placeholder.removeEventListener('click', activate); placeholder.removeEventListener('keydown', activate); }
                                node.style.display = originalDisplay;
                                if (host && host.parentNode) { host.parentNode.insertBefore(node, host); host.parentNode.removeChild(host); }
                            }
                        });
                    }
                };
            }]);
}());
