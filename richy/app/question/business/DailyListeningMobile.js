(function () {
    'use strict';

    angular.module('Hrm.Question').directive('dailyListeningMobile', ['$window', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var root = element[0];
                var document = $window.document;
                var enabled = false, active = false, destroyed = false;
                var frame = null, keyboardTimers = [], viewport = null;
                var hadHtmlClass = false, hadBodyClass = false;
                var query = $window.matchMedia
                    ? $window.matchMedia('(max-width: 767px), (max-width: 1024px) and (pointer: coarse)') : null;
                var viewportProperties = ['top', 'left', 'width', 'height'];
                var requestFrame = $window.requestAnimationFrame
                    ? function (callback) { return $window.requestAnimationFrame(callback); }
                    : function (callback) { return $window.setTimeout(callback, 16); };
                var cancelFrame = $window.cancelAnimationFrame
                    ? function (id) { $window.cancelAnimationFrame(id); }
                    : function (id) { $window.clearTimeout(id); };

                function positive(value, fallback) {
                    return typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;
                }

                function offset(value) {
                    return typeof value === 'number' && isFinite(value) ? Math.max(0, value) : 0;
                }

                function isZoomed() {
                    return viewport && typeof viewport.scale === 'number' && Math.abs(viewport.scale - 1) > 0.05;
                }

                function revealFocusedGap() {
                    var input = document.activeElement;
                    if (!input || !root.contains(input) || !input.matches || !input.matches('.gap-inline-input')) { return; }
                    var transcript = input.closest('.daily-listening-transcript');
                    if (!transcript || !root.contains(transcript)) { return; }
                    var inputRect = input.getBoundingClientRect();
                    var transcriptRect = transcript.getBoundingClientRect();
                    if (!transcriptRect.height) { return; }
                    var top = transcriptRect.top + 10;
                    var bottom = transcriptRect.bottom - 10;
                    if (inputRect.bottom > bottom) {
                        transcript.scrollTop += inputRect.bottom - bottom;
                    } else if (inputRect.top < top) {
                        transcript.scrollTop -= top - inputRect.top;
                    }
                }

                function refresh() {
                    frame = null;
                    if (!active || destroyed) { return; }
                    // Let pinch zoom magnify and pan the existing layout rather than reflowing it.
                    if (isZoomed()) { return; }
                    var layout = document.documentElement;
                    var dimensions = {
                        top: viewport ? offset(viewport.offsetTop) : 0,
                        left: viewport ? offset(viewport.offsetLeft) : 0,
                        width: positive(viewport && viewport.width, positive($window.innerWidth, layout.clientWidth || 320)),
                        height: positive(viewport && viewport.height, positive($window.innerHeight, layout.clientHeight || 480))
                    };
                    viewportProperties.forEach(function (property) {
                        var name = '--dl-viewport-' + property;
                        var value = Math.round(dimensions[property] * 100) / 100 + 'px';
                        if (root.style.getPropertyValue(name) !== value) { root.style.setProperty(name, value); }
                    });
                    root.classList.toggle('dl-mobile-compact', dimensions.height < 500);
                    revealFocusedGap();
                }

                function scheduleRefresh() {
                    if (active && !destroyed && frame === null) { frame = requestFrame(refresh); }
                }

                function clearKeyboardTimers() {
                    keyboardTimers.forEach(function (timer) { $window.clearTimeout(timer); });
                    keyboardTimers = [];
                }

                function onFocusChange() {
                    if (!active) { return; }
                    clearKeyboardTimers();
                    scheduleRefresh();
                    // Keyboard animations may finish after focus and viewport events on mobile browsers.
                    [80, 250, 550].forEach(function (delay) {
                        keyboardTimers.push($window.setTimeout(scheduleRefresh, delay));
                    });
                }

                function deactivate() {
                    if (!active) { return; }
                    active = false;
                    if (frame !== null) { cancelFrame(frame); frame = null; }
                    clearKeyboardTimers();
                    $window.removeEventListener('resize', scheduleRefresh);
                    $window.removeEventListener('scroll', scheduleRefresh);
                    $window.removeEventListener('orientationchange', onFocusChange);
                    if (viewport && viewport.removeEventListener) {
                        viewport.removeEventListener('resize', scheduleRefresh);
                        viewport.removeEventListener('scroll', scheduleRefresh);
                    }
                    document.removeEventListener('focusin', onFocusChange, true);
                    document.removeEventListener('focusout', onFocusChange, true);
                    viewport = null;
                    root.classList.remove('dl-mobile-workspace', 'dl-mobile-compact');
                    if (!hadHtmlClass) { document.documentElement.classList.remove('daily-listening-mobile-open'); }
                    if (!hadBodyClass && document.body) { document.body.classList.remove('daily-listening-mobile-open'); }
                    viewportProperties.forEach(function (property) { root.style.removeProperty('--dl-viewport-' + property); });
                }

                function reconcile() {
                    if (destroyed) { return; }
                    var mobile = query ? query.matches : $window.innerWidth <= 767;
                    if (!enabled || !mobile) { deactivate(); return; }
                    if (active) { scheduleRefresh(); return; }
                    active = true;
                    viewport = $window.visualViewport || null;
                    hadHtmlClass = document.documentElement.classList.contains('daily-listening-mobile-open');
                    hadBodyClass = !!document.body && document.body.classList.contains('daily-listening-mobile-open');
                    document.documentElement.classList.add('daily-listening-mobile-open');
                    if (document.body) { document.body.classList.add('daily-listening-mobile-open'); }
                    root.classList.add('dl-mobile-workspace');
                    $window.addEventListener('resize', scheduleRefresh);
                    $window.addEventListener('scroll', scheduleRefresh);
                    $window.addEventListener('orientationchange', onFocusChange);
                    if (viewport && viewport.addEventListener) {
                        viewport.addEventListener('resize', scheduleRefresh);
                        viewport.addEventListener('scroll', scheduleRefresh);
                    }
                    document.addEventListener('focusin', onFocusChange, true);
                    document.addEventListener('focusout', onFocusChange, true);
                    refresh();
                }

                function watchEnvironment(shouldWatch) {
                    if (query && query.addEventListener) {
                        query[shouldWatch ? 'addEventListener' : 'removeEventListener']('change', reconcile);
                    } else if (query && query.addListener) {
                        query[shouldWatch ? 'addListener' : 'removeListener'](reconcile);
                    } else {
                        $window[shouldWatch ? 'addEventListener' : 'removeEventListener']('resize', reconcile);
                    }
                }

                var unwatch = scope.$watch(attrs.dailyListeningMobile, function (value) {
                    if (enabled !== !!value) {
                        enabled = !!value;
                        watchEnvironment(enabled);
                    }
                    reconcile();
                });
                scope.$on('$destroy', function () {
                    destroyed = true;
                    unwatch();
                    if (enabled) { watchEnvironment(false); }
                    deactivate();
                });
            }
        };
    }]);
})();
