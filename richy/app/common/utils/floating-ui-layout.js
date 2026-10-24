(function () {
    'use strict';

    angular.module('Hrm').directive('floatingUiLayout', ['$window', '$document', function ($window, $document) {
        return {
            restrict: 'A',
            link: function (scope) {
                var document = $document[0];
                var root = document.documentElement;
                var body = document.body;
                var frame = null;
                var destroyed = false;
                var barHeight = -1;
                var observedBar = null;
                var mutationObserver;
                var resizeObserver;
                var controls = 'button, a[href], input, select, textarea, [role="button"]';

                function visible(node) {
                    if (!node || !node.getClientRects().length) { return false; }
                    var style = $window.getComputedStyle(node);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }

                function overlaps(first, second) {
                    return first.left < second.right + 4 && first.right > second.left - 4 &&
                        first.top < second.bottom + 4 && first.bottom > second.top - 4;
                }

                function setShift(shell, x, y) {
                    var nextX = x + 'px', nextY = y + 'px';
                    if (shell.style.getPropertyValue('--pet-clearance-x') !== nextX) {
                        shell.style.setProperty('--pet-clearance-x', nextX);
                    }
                    if (shell.style.getPropertyValue('--pet-clearance-y') !== nextY) {
                        shell.style.setProperty('--pet-clearance-y', nextY);
                    }
                }

                function positionPet(bar) {
                    var shell = document.querySelector('.learning-pet-shell');
                    if (!shell) { return; }
                    if (body.classList.contains('modal-open') || body.classList.contains('ui-dialog-open')) { return; }
                    if (shell.classList.contains('is-dragging')) {
                        setShift(shell, 0, 0);
                        shell.classList.remove('is-ui-obstructed');
                        return;
                    }
                    // Do not move an explicitly opened panel or a currently focused pet control.
                    if (shell.classList.contains('is-open') || shell.contains(document.activeElement)) { return; }
                    shell.classList.remove('is-ui-obstructed');
                    setShift(shell, 0, 0);
                    if (!visible(shell)) { return; }
                    var bounds = shell.getBoundingClientRect();
                    var message = shell.querySelector('.learning-pet-message');
                    if (visible(message)) {
                        var bubble = message.getBoundingClientRect();
                        bounds = {left: Math.min(bounds.left, bubble.left), right: Math.max(bounds.right, bubble.right),
                            top: Math.min(bounds.top, bubble.top), bottom: Math.max(bounds.bottom, bubble.bottom)};
                    }
                    var viewport = $window.visualViewport;
                    var top = viewport ? viewport.offsetTop : 0;
                    var left = viewport ? viewport.offsetLeft : 0;
                    var right = left + (viewport ? viewport.width : $window.innerWidth);
                    var bottom = top + (viewport ? viewport.height : $window.innerHeight);
                    var obstacles = [];
                    Array.prototype.forEach.call(document.querySelectorAll(controls), function (node) {
                        if (shell.contains(node) || !visible(node)) { return; }
                        var rect = node.getBoundingClientRect();
                        if (rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right) {
                            obstacles.push(rect);
                        }
                    });
                    if (bar) { obstacles.push(bar.getBoundingClientRect()); }
                    var scrollTop = document.querySelector('.student-scroll-top');
                    if (visible(scrollTop)) { obstacles.push(scrollTop.getBoundingClientRect()); }
                    var header = document.querySelector('.page-header');
                    if (visible(header)) { obstacles.push(header.getBoundingClientRect()); }
                    function clear(x, y) {
                        var candidate = {left: bounds.left + x, right: bounds.right + x,
                            top: bounds.top + y, bottom: bounds.bottom + y};
                        return candidate.left >= left + 4 && candidate.right <= right - 4 &&
                            candidate.top >= top + 4 && candidate.bottom <= bottom - 4 &&
                            !obstacles.some(function (rect) { return overlaps(candidate, rect); });
                    }
                    // Keep the saved/user-dragged anchor; clearance is transient and never persisted.
                    if (clear(0, 0)) { return; }
                    var maxShift = Math.ceil((bottom - top) / 48);
                    for (var step = 1; step <= maxShift; step++) {
                        if (clear(0, -48 * step)) { setShift(shell, 0, -48 * step); return; }
                        if (clear(0, 48 * step)) { setShift(shell, 0, 48 * step); return; }
                    }
                    var xCandidates = [right - 4 - bounds.right, left + 4 - bounds.left];
                    for (var column = 0; column < xCandidates.length; column++) {
                        var x = xCandidates[column];
                        for (var row = 0; row <= maxShift; row++) {
                            if (clear(x, -48 * row)) { setShift(shell, x, -48 * row); return; }
                            if (clear(x, 48 * row)) { setShift(shell, x, 48 * row); return; }
                        }
                    }
                    // A dense form has priority over a decorative floating control.
                    shell.classList.add('is-ui-obstructed');
                }

                function update() {
                    frame = null;
                    if (destroyed) { return; }
                    var bar = document.querySelector('.reading-builder-actionbar');
                    if (!visible(bar)) { bar = null; }
                    var height = bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
                    if (height !== barHeight) {
                        barHeight = height;
                        root.style.setProperty('--builder-actionbar-height', height + 'px');
                    }
                    if (resizeObserver && bar !== observedBar) {
                        if (observedBar) { resizeObserver.unobserve(observedBar); }
                        observedBar = bar;
                        if (bar) { resizeObserver.observe(bar); }
                    }
                    positionPet(bar);
                }

                function schedule() {
                    if (!destroyed && frame === null) { frame = $window.requestAnimationFrame(update); }
                }

                document.addEventListener('scroll', schedule, true);
                document.addEventListener('focusout', schedule, true);
                document.addEventListener('pointerup', schedule, true);
                $window.addEventListener('resize', schedule);
                if ($window.visualViewport) {
                    $window.visualViewport.addEventListener('resize', schedule);
                    $window.visualViewport.addEventListener('scroll', schedule);
                }
                if ($window.MutationObserver) {
                    mutationObserver = new $window.MutationObserver(schedule);
                    mutationObserver.observe(body, {childList: true, subtree: true});
                }
                if ($window.ResizeObserver) { resizeObserver = new $window.ResizeObserver(schedule); }
                var unwatch = scope.$watch(function () {
                    var shell = document.querySelector('.learning-pet-shell');
                    return body.className + ':' + (shell ? shell.className : '');
                }, schedule);
                schedule();

                scope.$on('$destroy', function () {
                    destroyed = true;
                    if (frame !== null) { $window.cancelAnimationFrame(frame); }
                    if (mutationObserver) { mutationObserver.disconnect(); }
                    if (resizeObserver) { resizeObserver.disconnect(); }
                    unwatch();
                    document.removeEventListener('scroll', schedule, true);
                    document.removeEventListener('focusout', schedule, true);
                    document.removeEventListener('pointerup', schedule, true);
                    $window.removeEventListener('resize', schedule);
                    if ($window.visualViewport) {
                        $window.visualViewport.removeEventListener('resize', schedule);
                        $window.visualViewport.removeEventListener('scroll', schedule);
                    }
                    root.style.removeProperty('--builder-actionbar-height');
                });
            }
        };
    }]);
})();
