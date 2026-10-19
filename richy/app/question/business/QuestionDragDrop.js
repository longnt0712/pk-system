(function () {
    'use strict';

    // Shared pointer/touch drag engine. Stored question HTML is never compiled here.
    angular.module('Hrm.Question').factory('QuestionDragDrop', ['$document', '$window', function ($document, $window) {
        function bindSource(scope, element, attrs) {
            var documentNode = $document[0];
            var active = false;
            var dragging = false;
            var startX = 0;
            var startY = 0;
            var draggedItem = null;
            var ghost = null;
            var activeDrop = null;
            var suppressClick = false;
            var usingPointer = !!$window.PointerEvent;
            var activePointerId = null;
            var moveFrame = null;
            var pendingPoint = null;
            var lastPoint = null;

            element.css({
                'touch-action': 'none',
                '-webkit-user-select': 'none',
                'user-select': 'none'
            });

            function isDisabled() {
                return scope.$$destroyed || (attrs.touchDndDisabled && scope.$eval(attrs.touchDndDisabled));
            }

            function eventPoint(event) {
                var source = event.touches && event.touches.length
                    ? event.touches[0]
                    : (event.changedTouches && event.changedTouches.length
                        ? event.changedTouches[0]
                        : event);
                return {x: source.clientX, y: source.clientY};
            }

            function closestDropTarget(node) {
                while (node && node !== documentNode.body) {
                    if (node.__ieltsTouchDrop && (!node.__ieltsTouchDrop.accept || node.__ieltsTouchDrop.accept(draggedItem))) {
                        return node;
                    }
                    node = node.parentNode;
                }
                return null;
            }

            function setActiveDrop(target) {
                if (activeDrop === target) {
                    return;
                }
                if (activeDrop) {
                    angular.element(activeDrop).removeClass('touch-dnd-over');
                }
                activeDrop = target;
                if (activeDrop) {
                    angular.element(activeDrop).addClass('touch-dnd-over');
                }
            }

            function createGhost() {
                ghost = element[0].cloneNode(true);
                ghost.removeAttribute('id');
                Array.prototype.forEach.call(ghost.querySelectorAll('[id]'), function (node) { node.removeAttribute('id'); });
                ghost.className += ' touch-dnd-ghost';
                ghost.style.left = '0';
                ghost.style.top = '0';
                ghost.style.willChange = 'transform';
                angular.element(documentNode.body).append(ghost);
                angular.element(documentNode.body).addClass('touch-dnd-active');
            }

            function moveGhost(point) {
                if (!ghost) {
                    return;
                }
                ghost.style.transform = 'translate3d(' + (point.x + 14) + 'px,' + (point.y + 14) + 'px,0)';
            }

            function closestScrollable(node) {
                while (node && node !== documentNode.body) {
                    var style = $window.getComputedStyle(node);
                    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) {
                        return node;
                    }
                    node = node.parentNode;
                }
                return null;
            }

            function processMove(point) {
                if (isDisabled()) { cleanup(); return; }
                if (!active || !dragging || !point) {
                    return;
                }
                var pointNode = documentNode.elementFromPoint(point.x, point.y);
                moveGhost(point);
                setActiveDrop(closestDropTarget(pointNode));

                var scrollHost = closestScrollable(pointNode);
                if (scrollHost) {
                    var bounds = scrollHost.getBoundingClientRect();
                    var edge = Math.min(70, Math.max(42, bounds.height * 0.12));
                    if (point.y < bounds.top + edge) {
                        scrollHost.scrollTop -= 14;
                    } else if (point.y > bounds.bottom - edge) {
                        scrollHost.scrollTop += 14;
                    }
                } else if (point.y < 55) {
                    $window.scrollBy(0, -12);
                } else if (point.y > $window.innerHeight - 55) {
                    $window.scrollBy(0, 12);
                }
            }

            function flushMove() {
                moveFrame = null;
                var point = pendingPoint || lastPoint;
                pendingPoint = null;
                processMove(point);
                if (active && dragging && point) {
                    lastPoint = point;
                    moveFrame = $window.requestAnimationFrame(flushMove);
                }
            }

            function onMove(event) {
                if (!active) {
                    return;
                }
                if (usingPointer && activePointerId !== null && event.pointerId !== activePointerId) {
                    return;
                }
                var point = eventPoint(event);
                if (!dragging && Math.max(Math.abs(point.x - startX), Math.abs(point.y - startY)) >= 7) {
                    dragging = true;
                    createGhost();
                }
                if (!dragging) {
                    return;
                }
                event.preventDefault();
                pendingPoint = point;
                if (moveFrame === null) {
                    moveFrame = $window.requestAnimationFrame(flushMove);
                }
            }

            function unbindDocumentEvents() {
                if (usingPointer) {
                    documentNode.removeEventListener('pointermove', onMove, false);
                    documentNode.removeEventListener('pointerup', onEnd, false);
                    documentNode.removeEventListener('pointercancel', onEnd, false);
                } else {
                    documentNode.removeEventListener('touchmove', onMove, false);
                    documentNode.removeEventListener('touchend', onEnd, false);
                    documentNode.removeEventListener('touchcancel', onEnd, false);
                }
            }

            function cleanup() {
                unbindDocumentEvents();
                if (moveFrame !== null) {
                    $window.cancelAnimationFrame(moveFrame);
                    moveFrame = null;
                }
                pendingPoint = null;
                lastPoint = null;
                setActiveDrop(null);
                if (ghost && ghost.parentNode) {
                    ghost.parentNode.removeChild(ghost);
                }
                ghost = null;
                angular.element(documentNode.body).removeClass('touch-dnd-active');
                active = false;
                dragging = false;
                draggedItem = null;
                activePointerId = null;
            }

            function onEnd(event) {
                if (!active) {
                    return;
                }
                if (usingPointer && activePointerId !== null && event.pointerId !== activePointerId) {
                    return;
                }
                if (dragging && event.type !== 'pointercancel' && event.type !== 'touchcancel' && !isDisabled()) {
                    event.preventDefault();
                    if (pendingPoint) {
                        processMove(pendingPoint);
                        pendingPoint = null;
                    }
                    suppressClick = true;
                    if (activeDrop && activeDrop.__ieltsTouchDrop) {
                        activeDrop.__ieltsTouchDrop(draggedItem);
                    }
                }
                cleanup();
            }

            function onStart(event) {
                if (isDisabled()) { return; }
                if (usingPointer && event.pointerType === 'mouse') {
                    return;
                }
                if (usingPointer && event.isPrimary === false) {
                    return;
                }
                if (active) {
                    cleanup();
                }
                draggedItem = scope.$eval(attrs.touchDndSource);
                if (!draggedItem) {
                    return;
                }
                var point = eventPoint(event);
                startX = point.x;
                startY = point.y;
                active = true;
                if (usingPointer) {
                    activePointerId = event.pointerId;
                    if (element[0].setPointerCapture) {
                        try {
                            element[0].setPointerCapture(activePointerId);
                        } catch (ignorePointerCaptureError) {
                            // Document listeners remain as the fallback.
                        }
                    }
                    documentNode.addEventListener('pointermove', onMove, {passive: false});
                    documentNode.addEventListener('pointerup', onEnd, false);
                    documentNode.addEventListener('pointercancel', onEnd, false);
                } else {
                    documentNode.addEventListener('touchmove', onMove, {passive: false});
                    documentNode.addEventListener('touchend', onEnd, false);
                    documentNode.addEventListener('touchcancel', onEnd, false);
                }
            }

            function onClick(event) {
                if (suppressClick) {
                    suppressClick = false;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }

            if (usingPointer) {
                element[0].addEventListener('pointerdown', onStart, false);
            } else {
                element[0].addEventListener('touchstart', onStart, {passive: true});
            }
            element[0].addEventListener('click', onClick, true);

            function destroy() {
                cleanup();
                if (usingPointer) {
                    element[0].removeEventListener('pointerdown', onStart, false);
                } else {
                    element[0].removeEventListener('touchstart', onStart, false);
                }
                element[0].removeEventListener('click', onClick, true);
            }
            var offDestroy = scope.$on('$destroy', destroy);
            return function () { destroy(); offDestroy(); };
        }
        return {bindSource: bindSource};
    }]);

    angular.module('Hrm.Question').directive('touchDndSource', ['QuestionDragDrop', function (dragDrop) {
        return {restrict: 'A', link: function (scope, element, attrs) {
            dragDrop.bindSource(scope, element, attrs);
        }};
    }]);

    angular.module('Hrm.Question').directive('touchDndDrop', function () {
        return {restrict: 'A', link: function (scope, element, attrs) {
            function enabled() { return !scope.$$destroyed && !(attrs.touchDndDisabled && scope.$eval(attrs.touchDndDisabled)); }
            var drop = element[0].__ieltsTouchDrop = function (item) {
                if (!enabled()) { return; }
                scope.$evalAsync(function () {
                    if (enabled()) { scope.$eval(attrs.touchDndDrop, {item: item, index: 0}); }
                });
            };
            drop.accept = function () { return enabled(); };
            scope.$on('$destroy', function () { delete element[0].__ieltsTouchDrop; });
        }};
    });
}());
