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

                function visible(node) {
                    if (!node || !node.getClientRects().length) { return false; }
                    var style = $window.getComputedStyle(node);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }

                // Keep the default or manually dragged anchor. Layout changes must
                // not send the mascot across the page or hide it behind a form.
                function keepPetAnchor() {
                    var shell = document.querySelector('.learning-pet-shell');
                    if (!shell) { return; }
                    shell.style.removeProperty('--pet-clearance-x');
                    shell.style.removeProperty('--pet-clearance-y');
                    shell.classList.remove('is-ui-obstructed');
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
                    keepPetAnchor();
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
