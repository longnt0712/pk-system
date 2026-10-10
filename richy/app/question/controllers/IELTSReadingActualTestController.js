/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').controller('IELTSReadingActualTestController', IELTSReadingActualTestController);

    IELTSReadingActualTestController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'QuestionService',
        '$location',
        '$stateParams',
        '$window',
        'blockUI',
        '$sce',
        '$cookies',
        'ComprehensiveVideo',
        'ComprehensiveListening'
        // 'dndLists'
        // 'ngSanitize',
        
    ];
    
    /**
     * Filters an array of drop effects using a HTML5 effectAllowed string.
     */
    function filterEffects(effects, effectAllowed) {
        if (effectAllowed == 'all') return effects;
        return effects.filter(function(effect) {
            return effectAllowed.toLowerCase().indexOf(effect) != -1;
        });
    }

    angular.module('Hrm.Question').directive('inputFieldSelection', function(){
        return{
            restrict: 'A',
            scope:{
                onSelected: '='
            },
            link:function(scope, elem, attrs){
                elem.on('select', function(){
                    var text = elem.val().substring(elem.prop('selectionStart'),
                        elem.prop('selectionEnd'));
                    scope.onSelected(text);
                });

                elem.on('blur', function(){ scope.onSelected('') });
                elem.on('keydown', function(){ scope.onSelected('')});
                elem.on('mousedown', function(){ scope.onSelected('')  });
            }
        }
    });

    /* Writing answers may only receive text copied from the same answer box.
       This blocks clipboard and drag/drop text brought in from other pages or
       applications while preserving normal copy, cut and paste while editing. */
    angular.module('Hrm.Question').directive('writingTaskClipboard', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var node = element[0];
                var internallyCopiedText = null;
                var internalPastePending = false;
                var lastValue = String(node.value || '');
                var lastKeydownAt = 0;

                function reportAudit(details) {
                    if (!attrs.writingTaskAudit) { return; }
                    scope.$evalAsync(function () {
                        scope.$eval(attrs.writingTaskAudit, {$audit: details});
                    });
                }

                function normalizeClipboardText(value) {
                    return String(value == null ? '' : value).replace(/\r\n/g, '\n');
                }

                function rememberSelection() {
                    var start = Number(node.selectionStart);
                    var end = Number(node.selectionEnd);
                    if (!isNaN(start) && !isNaN(end) && end > start) {
                        internallyCopiedText = normalizeClipboardText(node.value.substring(start, end));
                    }
                }

                function rejectExternalInsert(event, source) {
                    if (event && event.preventDefault) {
                        event.preventDefault();
                    }
                    reportAudit({type: source === 'drop' ? 'blocked-drop' : 'blocked-paste', at: Date.now()});
                    scope.$evalAsync(function () {
                        if (attrs.writingTaskClipboard) {
                            scope.$eval(attrs.writingTaskClipboard);
                        }
                    });
                }

                function onPaste(event) {
                    var clipboard = event.clipboardData || (event.originalEvent && event.originalEvent.clipboardData) || window.clipboardData;
                    var pastedText = clipboard && clipboard.getData ? normalizeClipboardText(clipboard.getData('text/plain') || clipboard.getData('Text')) : '';
                    if (!internallyCopiedText || pastedText !== internallyCopiedText) {
                        rejectExternalInsert(event, 'paste');
                    } else {
                        internalPastePending = true;
                    }
                }

                function onDrop(event) {
                    rejectExternalInsert(event, 'drop');
                }

                function onKeydown() {
                    lastKeydownAt = Date.now();
                }

                function onFocus() {
                    lastValue = String(node.value || '');
                }

                function onInput(event) {
                    var currentValue = String(node.value || '');
                    var addedCharacters = Math.max(0, currentValue.length - lastValue.length);
                    reportAudit({
                        type: 'input',
                        at: Date.now(),
                        addedCharacters: addedCharacters,
                        currentLength: currentValue.length,
                        inputType: String((event && event.inputType) || ''),
                        trusted: !!(event && event.isTrusted),
                        recentKeydown: Date.now() - lastKeydownAt < 1000,
                        internalClipboard: internalPastePending === true
                    });
                    internalPastePending = false;
                    lastValue = currentValue;
                }

                node.addEventListener('copy', rememberSelection, false);
                node.addEventListener('cut', rememberSelection, false);
                node.addEventListener('paste', onPaste, false);
                node.addEventListener('drop', onDrop, false);
                node.addEventListener('focus', onFocus, false);
                node.addEventListener('keydown', onKeydown, false);
                node.addEventListener('input', onInput, false);

                scope.$on('$destroy', function () {
                    node.removeEventListener('copy', rememberSelection, false);
                    node.removeEventListener('cut', rememberSelection, false);
                    node.removeEventListener('paste', onPaste, false);
                    node.removeEventListener('drop', onDrop, false);
                    node.removeEventListener('focus', onFocus, false);
                    node.removeEventListener('keydown', onKeydown, false);
                    node.removeEventListener('input', onInput, false);
                });
            }
        };
    });

    /* Start Writing answers at 60% of their pane and grow with the content.
       The pane itself owns scrolling, so the candidate never has to scroll
       inside the answer box. */
    angular.module('Hrm.Question').directive('writingTaskAutoGrow', function ($timeout, $window) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var node = element[0];
                var resizeTimer = null;
                var restoreFrame = null;

                function rememberScrollPosition() {
                    var positions = [];
                    var parent = node.parentElement;
                    while (parent) {
                        positions.push({
                            node: parent,
                            top: parent.scrollTop,
                            left: parent.scrollLeft
                        });
                        parent = parent.parentElement;
                    }
                    return {
                        positions: positions,
                        windowX: $window.pageXOffset || 0,
                        windowY: $window.pageYOffset || 0
                    };
                }

                function restoreScrollPosition(state) {
                    if (!state) { return; }
                    for (var i = 0; i < state.positions.length; i++) {
                        state.positions[i].node.scrollTop = state.positions[i].top;
                        state.positions[i].node.scrollLeft = state.positions[i].left;
                    }
                    $window.scrollTo(state.windowX, state.windowY);
                }

                function resizeToContent() {
                    if (!node.parentElement || node.offsetParent === null) {
                        return;
                    }
                    var scrollState = rememberScrollPosition();
                    var baseHeight = Math.round(node.parentElement.clientHeight * 0.6);
                    var currentHeight = Math.round(node.getBoundingClientRect().height);
                    var targetHeight = Math.max(baseHeight, node.scrollHeight + 2);

                    /* Do not temporarily reset the textarea to auto/zero height.
                       That layout collapse made the focused answer pane jump to
                       the top whenever a new line increased scrollHeight. */
                    if (targetHeight > currentHeight) {
                        node.style.height = targetHeight + 'px';
                    }

                    restoreScrollPosition(scrollState);
                    if (restoreFrame && $window.cancelAnimationFrame) {
                        $window.cancelAnimationFrame(restoreFrame);
                    }
                    if ($window.requestAnimationFrame) {
                        restoreFrame = $window.requestAnimationFrame(function () {
                            restoreFrame = null;
                            restoreScrollPosition(scrollState);
                        });
                    }
                }

                function scheduleResize() {
                    if (resizeTimer) {
                        $timeout.cancel(resizeTimer);
                    }
                    resizeTimer = $timeout(function () {
                        resizeTimer = null;
                        resizeToContent();
                    }, 0, false);
                }

                node.addEventListener('input', scheduleResize, false);
                $window.addEventListener('resize', scheduleResize, false);

                var unwatchModel = scope.$watch(attrs.ngModel, scheduleResize);
                var unwatchVisibility = scope.$watch(function () {
                    return node.offsetParent !== null;
                }, function (isVisible) {
                    if (isVisible) { scheduleResize(); }
                });

                scope.$on('$destroy', function () {
                    if (resizeTimer) { $timeout.cancel(resizeTimer); }
                    if (restoreFrame && $window.cancelAnimationFrame) {
                        $window.cancelAnimationFrame(restoreFrame);
                    }
                    node.removeEventListener('input', scheduleResize, false);
                    $window.removeEventListener('resize', scheduleResize, false);
                    unwatchModel();
                    unwatchVisibility();
                });
            }
        };
    });

    /* Floating Study-mode outline. The browser provides corner resizing while
       this directive keeps header dragging inside the visible viewport. */
    angular.module('Hrm.Question').directive('writingOutlineNote', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var node = element[0];
                var handle = node.querySelector('.idp-writing-outline-note__header');
                var dragging = false;
                var startX = 0;
                var startY = 0;
                var startLeft = 0;
                var startTop = 0;

                function onMouseDown(event) {
                    if (event.button !== 0 || event.target.closest('button')) { return; }
                    var rect = node.getBoundingClientRect();
                    dragging = true;
                    startX = event.clientX;
                    startY = event.clientY;
                    startLeft = rect.left;
                    startTop = rect.top;
                    node.style.left = rect.left + 'px';
                    node.style.top = rect.top + 'px';
                    node.style.right = 'auto';
                    event.preventDefault();
                }

                function onMouseMove(event) {
                    if (!dragging) { return; }
                    var maxLeft = Math.max(0, $window.innerWidth - node.offsetWidth);
                    var maxTop = Math.max(0, $window.innerHeight - node.offsetHeight);
                    node.style.left = Math.max(0, Math.min(maxLeft, startLeft + event.clientX - startX)) + 'px';
                    node.style.top = Math.max(0, Math.min(maxTop, startTop + event.clientY - startY)) + 'px';
                }

                function stopDragging() {
                    dragging = false;
                }

                if (handle) { handle.addEventListener('mousedown', onMouseDown, false); }
                $window.document.addEventListener('mousemove', onMouseMove, false);
                // Capture mouseup before the floating note's Angular handler
                // stops propagation, otherwise the note remains attached to
                // the pointer after the button has already been released.
                $window.document.addEventListener('mouseup', stopDragging, true);
                $window.addEventListener('blur', stopDragging, false);

                scope.$on('$destroy', function () {
                    if (handle) { handle.removeEventListener('mousedown', onMouseDown, false); }
                    $window.document.removeEventListener('mousemove', onMouseMove, false);
                    $window.document.removeEventListener('mouseup', stopDragging, true);
                    $window.removeEventListener('blur', stopDragging, false);
                });
            }
        };
    });

    angular.module('Hrm.Question').directive('draggable', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element[0].addEventListener('dragstart', scope.handleDragStart, false);
                element[0].addEventListener('dragend', scope.handleDragEnd, false);
            }
        }
    });

    angular.module('Hrm.Question').directive('droppable', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element[0].addEventListener('drop', scope.handleDrop, false);
                element[0].addEventListener('dragover', scope.handleDragOver, false);
            }
        }
    });

    angular.module('Hrm.Question').directive('dragAutoScroll', ['$window', '$document', function ($window, $document) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var node = element[0];
                var frame = null;
                var lastClientY = null;
                var lastDragOverAt = 0;
                var requestFrame = $window.requestAnimationFrame || function (callback) {
                    return $window.setTimeout(callback, 16);
                };
                var cancelFrame = $window.cancelAnimationFrame || $window.clearTimeout;

                function stopAutoScroll() {
                    if (frame !== null) {
                        cancelFrame(frame);
                        frame = null;
                    }
                    lastClientY = null;
                    node.classList.remove('is-drag-autoscrolling');
                }

                function scrollFrame() {
                    frame = null;
                    if (lastClientY === null || Date.now() - lastDragOverAt > 500) {
                        stopAutoScroll();
                        return;
                    }

                    var rect = node.getBoundingClientRect();
                    var edgeSize = Math.min(120, Math.max(70, rect.height * 0.18));
                    var distanceFromTop = lastClientY - rect.top;
                    var distanceFromBottom = rect.bottom - lastClientY;
                    var direction = 0;
                    var strength = 0;

                    if (distanceFromTop >= 0 && distanceFromTop < edgeSize) {
                        direction = -1;
                        strength = (edgeSize - distanceFromTop) / edgeSize;
                    } else if (distanceFromBottom >= 0 && distanceFromBottom < edgeSize) {
                        direction = 1;
                        strength = (edgeSize - distanceFromBottom) / edgeSize;
                    }

                    if (direction !== 0 && node.scrollHeight > node.clientHeight) {
                        node.scrollTop += direction * Math.max(5, Math.round(24 * strength));
                        node.classList.add('is-drag-autoscrolling');
                    } else {
                        node.classList.remove('is-drag-autoscrolling');
                    }
                    frame = requestFrame(scrollFrame);
                }

                function onDragOver(event) {
                    lastClientY = event.clientY;
                    lastDragOverAt = Date.now();
                    if (frame === null) {
                        frame = requestFrame(scrollFrame);
                    }
                }

                // Capture before dnd-list stops bubbling so edge scrolling also
                // works while the pointer is directly over a drop slot.
                node.addEventListener('dragover', onDragOver, true);
                $document[0].addEventListener('drop', stopAutoScroll, true);
                $document[0].addEventListener('dragend', stopAutoScroll, true);

                scope.$on('$destroy', function () {
                    stopAutoScroll();
                    node.removeEventListener('dragover', onDragOver, true);
                    $document[0].removeEventListener('drop', stopAutoScroll, true);
                    $document[0].removeEventListener('dragend', stopAutoScroll, true);
                });
            }
        };
    }]);

    angular.module('Hrm.Question').directive('touchDndDrop', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element[0].__ieltsTouchDrop = function (item) {
                    scope.$evalAsync(function () {
                        scope.$eval(attrs.touchDndDrop, {item: item, index: 0});
                    });
                };

                scope.$on('$destroy', function () {
                    delete element[0].__ieltsTouchDrop;
                });
            }
        };
    });

    angular.module('Hrm.Question').directive('doubleTap', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var lastTapAt = 0;
                var resetTimer = null;

                function resetTap() {
                    lastTapAt = 0;
                    resetTimer = null;
                }

                function onClick(event) {
                    var now = Date.now();
                    if (lastTapAt && now - lastTapAt <= 420) {
                        if (resetTimer) {
                            $timeout.cancel(resetTimer);
                        }
                        resetTap();
                        event.preventDefault();
                        event.stopPropagation();
                        scope.$evalAsync(function () {
                            scope.$eval(attrs.doubleTap, {$event: event});
                        });
                        return;
                    }

                    lastTapAt = now;
                    if (resetTimer) {
                        $timeout.cancel(resetTimer);
                    }
                    resetTimer = $timeout(resetTap, 420, false);
                }

                element[0].addEventListener('click', onClick, false);
                scope.$on('$destroy', function () {
                    if (resetTimer) {
                        $timeout.cancel(resetTimer);
                    }
                    element[0].removeEventListener('click', onClick, false);
                });
            }
        };
    }]);

    /* AngularJS does not provide an ng-touchstart/ng-pointerdown directive. Keep
       the reading splitter on one native start event so touch does not also fire
       a second synthetic mouse drag on mobile browsers. */
    angular.module('Hrm.Question').directive('readingSplitResize', ['$window', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var eventName = $window.PointerEvent ? 'pointerdown' : 'touchstart';
                var node = element[0];
                var capturedPointerId = null;

                function startResize(event) {
                    if (event.type === 'pointerdown') {
                        if (event.isPrimary === false || (event.button != null && event.button !== 0)) {
                            return;
                        }
                        capturedPointerId = event.pointerId;
                        if (node.setPointerCapture) {
                            try {
                                node.setPointerCapture(capturedPointerId);
                            } catch (ignorePointerCaptureError) {
                                // Document listeners remain as the fallback.
                            }
                        }
                    }
                    if (event.cancelable) {
                        event.preventDefault();
                    }
                    scope.$eval(attrs.readingSplitResize, {$event: event});
                }

                node.addEventListener(eventName, startResize, {passive: false});
                if (!$window.PointerEvent) {
                    node.addEventListener('mousedown', startResize, {passive: false});
                }

                scope.$on('$destroy', function () {
                    if (capturedPointerId !== null && node.releasePointerCapture) {
                        try {
                            node.releasePointerCapture(capturedPointerId);
                        } catch (ignorePointerReleaseError) {
                            // The browser may already have released it.
                        }
                    }
                    node.removeEventListener(eventName, startResize, false);
                    if (!$window.PointerEvent) {
                        node.removeEventListener('mousedown', startResize, false);
                    }
                });
            }
        };
    }]);

    /* Mobile Safari/Chrome update the native text selection after touchend and
       while the selection handles are moving. Angular's ng-mouseup never sees
       those changes, so forward a settled in-test selection to the same menu
       handler used by desktop mouse selection. */
    angular.module('Hrm.Question').directive('readingSelectionTools', ['$document', '$timeout', '$window', function ($document, $timeout, $window) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var node = element[0];
                var pending = null;

                function nodeInsideReadingTest(candidate) {
                    if (!candidate) { return false; }
                    if (candidate.nodeType === 3) { candidate = candidate.parentNode; }
                    return candidate === node || node.contains(candidate);
                }

                function dispatchSelection(event) {
                    $timeout.cancel(pending);
                    pending = $timeout(function () {
                        var selection = $window.getSelection && $window.getSelection();
                        if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()
                                || !nodeInsideReadingTest(selection.anchorNode) || !nodeInsideReadingTest(selection.focusNode)) {
                            return;
                        }
                        var target = event && event.target;
                        if (!nodeInsideReadingTest(target)) {
                            target = selection.anchorNode && (selection.anchorNode.nodeType === 3
                                ? selection.anchorNode.parentNode : selection.anchorNode);
                        }
                        scope.$eval(attrs.readingSelectionTools, {
                            $event: {target: target || node, type: event && event.type}
                        });
                    }, event && event.type === 'selectionchange' ? 140 : 70);
                }

                function onPointerUp(event) {
                    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                        dispatchSelection(event);
                    }
                }

                node.addEventListener('touchend', dispatchSelection, {passive: true});
                if ($window.PointerEvent) {
                    node.addEventListener('pointerup', onPointerUp, false);
                }
                $document[0].addEventListener('selectionchange', dispatchSelection, false);

                scope.$on('$destroy', function () {
                    $timeout.cancel(pending);
                    node.removeEventListener('touchend', dispatchSelection, false);
                    if ($window.PointerEvent) {
                        node.removeEventListener('pointerup', onPointerUp, false);
                    }
                    $document[0].removeEventListener('selectionchange', dispatchSelection, false);
                });
            }
        };
    }]);

    angular.module('Hrm.Question').directive('touchDndSource', ['$document', '$window', function ($document, $window) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
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

                element.css({
                    'touch-action': 'none',
                    '-webkit-user-select': 'none',
                    'user-select': 'none'
                });

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
                        if (node.__ieltsTouchDrop) {
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
                    var point = pendingPoint;
                    pendingPoint = null;
                    processMove(point);
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
                    if (dragging) {
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

                scope.$on('$destroy', function () {
                    cleanup();
                    if (usingPointer) {
                        element[0].removeEventListener('pointerdown', onStart, false);
                    } else {
                        element[0].removeEventListener('touchstart', onStart, false);
                    }
                    element[0].removeEventListener('click', onClick, true);
                });
            }
        };
    }]);

    angular.module('Hrm.Question').directive('myDraggable', ['$document', function($document) {
        return {
            link: function(scope, element, attr) {
                var startX = 0, startY = 0, x = 0, y = 0;

                element.css({
                    position: 'absolute',
                    // border: '1px solid red',
                    // backgroundColor: 'lightgrey',
                    cursor: 'all-scroll',
                    // 'z-index': 2
                });

                element.on('mousedown', function(event) {
                    // Prevent default dragging of selected content
                    // event.preventDefault();
                    startX = event.pageX - x;
                    startY = event.pageY - y;
                    $document.on('mousemove', mousemove);
                    $document.on('mouseup', mouseup);
                });

                function mousemove(event) {
                    y = event.pageY - startY;
                    x = event.pageX - startX;
                    element.css({
                        top: y + 'px',
                        left:  x + 'px'
                    });
                }

                function mouseup() {
                    $document.off('mousemove', mousemove);
                    $document.off('mouseup', mouseup);
                }


                //touch
                // element.on('touchstart', function(event) {
                //     // Prevent default dragging of selected content
                //     // event.preventDefault();
                //     startX = event.pageX - x;
                //     startY = event.pageY - y;
                //     $document.on('touchmove', touchmove);
                //     $document.on('touchend', touchend);
                // });
                //
                // function touchmove(event) {
                //     y = event.pageY - startY;
                //     x = event.pageX - startX;
                //     element.css({
                //         top: y + 'px',
                //         left:  x + 'px'
                //     });
                //
                //     var e = document.getElementById("passage-2-notes-highlight-1");
                //     var e = document.getElementById("test-drop-drag-1");
                //     var n = e.getBoundingClientRect();
                //     console.log(n.top, n.right, n.bottom, n.left);
                //
                //     var e = document.getElementById("question-number-15");
                //     var q = e.getBoundingClientRect();
                //     // console.log(q.top, q.right, q.bottom, q.left);
                //
                //     if(n.left > q.left && n.top > q.top && n.top < q.bottom && n.left < q.right ) {
                //         console.log(true);
                //     }
                // }
                //
                // function touchend() {
                //     $document.off('touchmove', touchmove);
                //     $document.off('touchend', touchend);
                // }

            }
        };
    }]);

    angular.module('Hrm.Question').directive('compile', ['$compile', function ($compile) {
        return function(scope, element, attrs) {
            scope.$watch(
                function(scope) {
                    return scope.$eval(attrs.compile);
                },
                function(value) {
                    element.html(value);
                    $compile(element.contents())(scope);
                }
            )};
    }]);

    angular.module('Hrm.Question').directive('cellHighlight', function() {
        return {
            restrict: 'C',
            link: function postLink(scope, iElement, iAttrs) {
                iElement.find('td')
                    .mouseover(function() {
                        $(this).parent('tr').css('opacity', '0.7');
                    }).mouseout(function() {
                    $(this).parent('tr').css('opacity', '1.0');
                });
            }
        };
    });

    angular.module('Hrm.Question').directive('context', [

        function() {
            return {
                restrict: 'A',
                scope: '@&',
                compile: function compile(tElement, tAttrs, transclude) {
                    return {
                        post: function postLink(scope, iElement, iAttrs, controller) {
                            var ul = $('#' + iAttrs.context),
                                last = null;

                            ul.css({
                                'display': 'none'
                            });
                            $(iElement).bind('contextmenu', function(event) {
                                event.preventDefault();
                                ul.css({
                                    position: "fixed",
                                    display: "block",
                                    left: event.clientX + 'px',
                                    top: event.clientY + 'px'
                                });
                                last = event.timeStamp;
                            });
                            //$(iElement).click(function(event) {
                            //  ul.css({
                            //    position: "fixed",
                            //    display: "block",
                            //    left: event.clientX + 'px',
                            //    top: event.clientY + 'px'
                            //  });
                            //  last = event.timeStamp;
                            //});

                            $(document).click(function(event) {
                                var target = $(event.target);
                                if (!target.is(".popover") && !target.parents().is(".popover")) {
                                    if (last === event.timeStamp)
                                        return;
                                    ul.css({
                                        'display': 'none'
                                    });
                                }
                            });
                        }
                    };
                }
            };
        }
    ]);

    // Rightclick directive
    angular.module('Hrm.Question').directive('ngRightClick', function($parse) {
        return function(scope, element, attrs) {
            var fn = $parse(attrs.ngRightClick);
            element.bind('contextmenu', function(event) {
                scope.$apply(function() {
                    event.preventDefault();
                    fn(scope, {$event:event});
                });
            });
        };
    });

    function IELTSReadingActualTestController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service, $location,$stateParams,$window,blockUI,$sce,$cookies,video,listening) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;
        var writingTaskDraftTimer = null;
        vm.isComprehensiveRoute = /\/comprehensive_test(?:\/|$)/i.test($location.path());
        vm.isWritingRoute = /\/ielts_writing_actual_test(?:\/|$)/i.test($location.path());
        vm.isListeningRoute = !vm.isComprehensiveRoute && !vm.isWritingRoute && /\/ielts_listening_actual_test(?:\/|$)/i.test($location.path());
        vm.isFlexibleRoute = vm.isComprehensiveRoute || vm.isWritingRoute;
        vm.videoApi = {};
        vm.formatVideoTime = video.formatTime;
        vm.hasComprehensiveVideo = function () {
            var passage = (((vm.ieltsReadingActualTest || {}).subQuestions || [])[0]) || {};
            return vm.isComprehensiveRoute && !!String(passage.videoUrl || '').trim();
        };
        $scope.$watchGroup([
            function () { return vm.ieltsReadingActualTest; },
            function () { return (((vm.ieltsReadingActualTest || {}).subQuestions || [])[0] || {}).videoUrl; }
        ], function () {
            var passage = (((vm.ieltsReadingActualTest || {}).subQuestions || [])[0]) || {};
            vm.videoTimeline = video.timeline(passage.subQuestions || []);
            vm.videoFallbackMode = false;
            vm.videoDuration = 0;
            vm.videoTimeline.cues.forEach(function (cue) {
                cue.revealed = cue.questions.length > 0 && cue.questions.every(function (q) { return q.answered === true; });
            });
        });
        vm.videoPackageVisible = function (pack) {
            if (!vm.hasComprehensiveVideo() || !vm.videoTimeline || vm.passageNumber === 4) { return true; }
            if (Number(pack.type) === 1) {
                return (pack.subQuestions || []).some(function (q) { return vm.videoTimeline.visible(q); });
            }
            return vm.videoTimeline.visible(pack);
        };
        vm.videoQuestionVisible = function (question) {
            return !vm.hasComprehensiveVideo() || !vm.videoTimeline || vm.passageNumber === 4 || vm.videoTimeline.visible(question);
        };
        vm.videoQuestionActive = function (question) {
            return vm.videoTimeline && vm.videoTimeline.active.some(function (cue) { return cue.questions.indexOf(question) !== -1; });
        };
        vm.videoCanContinue = function () {
            return vm.videoTimeline && vm.videoTimeline.active.every(function (cue) {
                return cue.questions.every(function (question) {
                    return question.answered === true || (question.questionAnswers || []).some(function (answer) {
                        return answer.selected === true || !!String(answer.clientAnswer || '').trim();
                    });
                });
            });
        };
        vm.onVideoProgress = function (seconds, duration) {
            if (!vm.hasComprehensiveVideo() || !vm.videoTimeline) { return; }
            vm.videoDuration = duration;
            if (vm.videoFallbackMode || vm.passageNumber === 4) { return; }
            var active = vm.videoTimeline.advance(seconds);
            if (!active.length) { return; }
            if (vm.videoApi.pause) { vm.videoApi.pause(); }
            if (seconds > active[0].seconds + 1 && vm.videoApi.seek) { vm.videoApi.seek(active[0].seconds); }
            $timeout(function () {
                var question = active[0].questions[0];
                var target = question && $window.document.getElementById('question-number-' + question.ordinalNumber);
                if (target) { target.scrollIntoView({behavior: 'smooth', block: 'center'}); }
            });
        };
        vm.onVideoState = function (playing) {
            if (playing && vm.videoTimeline && vm.videoTimeline.active.length) {
                if (vm.videoCanContinue()) { vm.videoTimeline.active = []; }
                else if (vm.videoApi.pause) { vm.videoApi.pause(); }
            }
        };
        vm.continueVideo = function () {
            if (!vm.videoCanContinue() || !vm.videoApi.ready) { return; }
            vm.videoTimeline.active = [];
            vm.videoApi.play();
        };
        vm.revealVideoQuestions = function () {
            if (vm.videoApi.pause) { vm.videoApi.pause(); }
            vm.videoFallbackMode = true;
            vm.videoTimeline.revealAll();
        };
        vm.videoHasInvalidCues = function () {
            return vm.videoDuration > 0 && vm.videoTimeline && vm.videoTimeline.cues.some(function (cue) {
                return cue.seconds >= vm.videoDuration;
            });
        };
        vm.assignmentTaskId = /^\d+$/.test(String($stateParams.assignmentTaskId || '')) ? Number($stateParams.assignmentTaskId) : null;
        var requestedAssignedPart = /^\d+$/.test(String($stateParams.assignmentPart || '')) ? Number($stateParams.assignmentPart) : null;
        var maximumAssignedPart = vm.isComprehensiveRoute ? 1 : (vm.isWritingRoute ? 2 : (vm.isListeningRoute ? 4 : 3));
        function normalizeAssignedParts(value) {
            var parts = angular.isArray(value) ? value : String(value || '').split(',');
            return parts.map(Number).filter(function (part, index, all) {
                return part >= 1 && part <= maximumAssignedPart && Math.floor(part) === part && all.indexOf(part) === index;
            }).sort(function (left, right) { return left - right; });
        }
        vm.assignedParts = normalizeAssignedParts($stateParams.assignmentParts);
        if (!vm.assignedParts.length) { vm.assignedParts = normalizeAssignedParts(requestedAssignedPart); }
        vm.assignedPart = vm.assignedParts[0] || null;
        var requestedAssignmentParts = angular.copy(vm.assignedParts);
        vm.nextAssignmentParts = [];
        vm.isPartAssignment = vm.assignedParts.length > 0;
        vm.assignedPartsLabel = function () {
            return (vm.isWritingRoute ? 'Writing Task ' : 'Part ') + vm.assignedParts.join(', ');
        };
        vm.testSessionMode = 'STUDY';
        vm.selectedTestSessionMode = vm.testSessionMode;
        vm.showTestModeDialog = false;
        vm.resultQuestionTotal = 40;
        vm.showStudyAnswerCheck = false;
        vm.studyAnswerCheck = {
            rows: [],
            total: 0,
            answered: 0,
            correct: 0,
            incorrect: 0,
            unanswered: 0
        };

        function getResultQuestionType(item) {
            return item && item.questionAnswer && item.questionAnswer.question &&
                item.questionAnswer.question.parent ? item.questionAnswer.question.parent.type : null;
        }

        vm.getResultYourAnswer = function (item) {
            var type = getResultQuestionType(item);
            if (type == 18 && item.listeningTotalGaps != null) {
                return item.listeningCorrectGaps + '/' + item.listeningTotalGaps + ' ô đúng (' +
                    Math.round(item.listeningCorrectGaps * 10000 / (item.listeningTotalGaps || 1)) / 100 + '%)';
            }
            var submittedAnswer = item && item.clientAnswer != null ? String(item.clientAnswer).trim() : '';
            if (!submittedAnswer) {
                return '';
            }
            if (type == 2 || type == 3 || type == 4 || type == 8 || type == 11 || type == 18 || type == 16 || type == 17) {
                return submittedAnswer;
            }

            var answer = item && item.questionAnswer && item.questionAnswer.answer;
            return answer && answer.answer != null ? answer.answer :
                submittedAnswer;
        };

        vm.getResultCorrectAnswer = function (item) {
            var type = getResultQuestionType(item);
            var questionAnswer = item && item.questionAnswer;

            if (type == 18 && questionAnswer && questionAnswer.answer && questionAnswer.answer.answer === listening.responseMarker) { return 'Đúng từ 90% tổng số ô trống'; }

            if (type == 16 || type == 17) {
                return type == 17 ? 'Trên 250 từ' : 'Trên 150 từ';
            }

            if (type == 5 || type == 7) {
                return String((item && item.correctAnswerForMultipleAnswer) || '')
                    .replace(/<br\s*\/?\s*>/gi, ' / ')
                    .replace(/\s*\/\s*(?:\/\s*)+/g, ' / ')
                    .replace(/^\s*\/|\/\s*$/g, '')
                    .trim();
            }
            if (type == 2 || type == 3 || type == 11 || type == 18) {
                return questionAnswer && questionAnswer.correctAnswer ? questionAnswer.correctAnswer :
                    (questionAnswer && questionAnswer.answer && questionAnswer.answer.answer != null ?
                        questionAnswer.answer.answer : '');
            }

            return questionAnswer && questionAnswer.correctAnswer != null ?
                questionAnswer.correctAnswer : '';
        };

        vm.getResultQuestionLabel = function (item) {
            var type = getResultQuestionType(item);
            if (type == 16) { return 'Task 1'; }
            if (type == 17) { return 'Task 2'; }
            return item && item.ordinalNumber;
        };

        vm.countWritingTaskWords = function (value) {
            var text = String(value == null ? '' : value).trim();
            return text ? text.split(/\s+/).length : 0;
        };

        function getWritingTaskPackage() {
            var found = null;
            angular.forEach((vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.subQuestions) || [], function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    if (!found && (Number(questionPackage.type) === 16 || Number(questionPackage.type) === 17)) {
                        found = questionPackage;
                    }
                });
            });
            return found;
        }

        var writingInputAudit = {
            version: 1,
            inputEvents: 0,
            inputEventsWithKeydown: 0,
            blockedPasteCount: 0,
            blockedDropCount: 0,
            untrustedInputCount: 0,
            totalCharactersAdded: 0,
            maxCharactersAddedAtOnce: 0,
            maxCharactersPerSecond: 0,
            draftRestoreCount: 0,
            restoredCharacters: 0
        };
        var writingInputWindow = [];

        function normalizedWritingInputAudit(value) {
            var source = value || {};
            var normalized = angular.extend({}, writingInputAudit);
            angular.forEach(normalized, function (defaultValue, key) {
                if (key === 'version') { return; }
                normalized[key] = Math.max(0, Number(source[key]) || 0);
            });
            normalized.version = 1;
            return normalized;
        }

        vm.recordWritingTaskAudit = function (event) {
            event = event || {};
            if (event.type === 'blocked-paste') {
                writingInputAudit.blockedPasteCount += 1;
                return;
            }
            if (event.type === 'blocked-drop') {
                writingInputAudit.blockedDropCount += 1;
                return;
            }
            if (event.type !== 'input') { return; }

            var now = Number(event.at) || Date.now();
            var added = Math.max(0, Number(event.addedCharacters) || 0);
            writingInputAudit.inputEvents += 1;
            writingInputAudit.totalCharactersAdded += added;
            if (event.recentKeydown === true) { writingInputAudit.inputEventsWithKeydown += 1; }
            if (event.trusted === false) { writingInputAudit.untrustedInputCount += 1; }

            // Pasting text copied from the same answer box is an allowed editing action,
            // so it must not create a false rapid-input warning.
            if (event.internalClipboard === true) { return; }
            writingInputAudit.maxCharactersAddedAtOnce = Math.max(writingInputAudit.maxCharactersAddedAtOnce, added);

            writingInputWindow.push({at: now, added: added});
            writingInputWindow = writingInputWindow.filter(function (sample) { return now - sample.at <= 1000; });
            var charactersInLastSecond = writingInputWindow.reduce(function (total, sample) {
                return total + sample.added;
            }, 0);
            writingInputAudit.maxCharactersPerSecond = Math.max(
                writingInputAudit.maxCharactersPerSecond,
                charactersInLastSecond
            );
        };

        function writingInputAuditSummary() {
            var summary = angular.copy(writingInputAudit);
            var finalText = '';
            angular.forEach(getWritingTaskPackages(), function (questionPackage) {
                var answer = questionPackage.subQuestions && questionPackage.subQuestions[0]
                    && questionPackage.subQuestions[0].questionAnswers
                    && questionPackage.subQuestions[0].questionAnswers[0];
                finalText += (finalText ? '\n' : '') + String((answer && answer.clientAnswer) || '');
            });
            summary.finalCharacters = finalText.length;
            summary.finalWords = vm.countWritingTaskWords(finalText);
            return summary;
        }

        function restoreWritingInputAudit(draft) {
            var restoredText = ((draft && draft.results) || []).map(function (result) {
                return String((result && result.clientAnswer) || '');
            }).join('\n');
            writingInputAudit = normalizedWritingInputAudit(draft && draft.writingInputAudit);
            writingInputAudit.draftRestoreCount += 1;
            writingInputAudit.restoredCharacters = Math.max(writingInputAudit.restoredCharacters, restoredText.length);
            writingInputWindow = [];
        }

        function getWritingTaskPackages() {
            var found = [];
            angular.forEach((vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.subQuestions) || [], function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    if (Number(questionPackage.type) === 16 || Number(questionPackage.type) === 17) { found.push(questionPackage); }
                });
            });
            return found;
        }

        vm.writingTaskWordTarget = function (questionPackage) {
            return questionPackage && Number(questionPackage.type) === 17 ? 250 : 150;
        };

        vm.writingOutlineNote = {
            visible: false,
            packageKey: null,
            title: '',
            content: ''
        };

        function writingOutlinePackageKey(questionPackage) {
            if (!questionPackage) { return ''; }
            return String(questionPackage.id || ('type-' + questionPackage.type + '-order-' + questionPackage.ordinalNumber));
        }

        vm.hasWritingOutline = function (questionPackage) {
            var content = String((questionPackage && questionPackage.description) || '');
            if (!content.trim()) { return false; }
            var probe = $window.document.createElement('div');
            probe.innerHTML = content;
            return !!String(probe.textContent || '').trim() || !!probe.querySelector('img, table, ul, ol');
        };

        vm.isWritingOutlineOpen = function (questionPackage) {
            return vm.writingOutlineNote.visible === true
                && vm.writingOutlineNote.packageKey === writingOutlinePackageKey(questionPackage);
        };

        vm.toggleWritingOutline = function (questionPackage) {
            if (vm.testSessionMode !== 'STUDY' || !vm.hasWritingOutline(questionPackage)) { return; }
            var packageKey = writingOutlinePackageKey(questionPackage);
            if (vm.writingOutlineNote.visible && vm.writingOutlineNote.packageKey === packageKey) {
                vm.writingOutlineNote.visible = false;
                return;
            }
            vm.writingOutlineNote.packageKey = packageKey;
            vm.writingOutlineNote.title = Number(questionPackage.type) === 17 ? 'Task 2 · Hint / Outline' : 'Task 1 · Hint / Outline';
            vm.writingOutlineNote.content = questionPackage.description;
            vm.writingOutlineNote.visible = true;
        };

        vm.closeWritingOutline = function () {
            vm.writingOutlineNote.visible = false;
        };

        vm.isWritingTaskWordTargetMet = function (questionPackage) {
            var answer = questionPackage && questionPackage.subQuestions && questionPackage.subQuestions[0] &&
                questionPackage.subQuestions[0].questionAnswers && questionPackage.subQuestions[0].questionAnswers[0];
            return vm.countWritingTaskWords(answer && answer.clientAnswer) > vm.writingTaskWordTarget(questionPackage);
        };

        vm.onWritingTaskClipboardBlocked = function () {
            toastr.warning('Chỉ được dán phần văn bản vừa sao chép hoặc cắt từ chính ô bài làm này.', 'Không thể dán nội dung bên ngoài');
        };

        vm.updateWritingTaskResponse = function (questionPackage) {
            var question = questionPackage && questionPackage.subQuestions && questionPackage.subQuestions[0];
            var questionAnswer = question && question.questionAnswers && question.questionAnswers[0];
            if (!question || !questionAnswer) {
                return;
            }
            vm.changeTextQuestionAnswer(questionAnswer,
                questionAnswer.answer && questionAnswer.answer.answer,
                question);
            if (writingTaskDraftTimer) { $timeout.cancel(writingTaskDraftTimer); }
            writingTaskDraftTimer = $timeout(function () {
                saveReadingDraft();
                writingTaskDraftTimer = null;
            }, 450, false);
        };

        /* Keep the active exam inside one viewport and restore the normal site
           layout as soon as the test ends or this screen is left. */
        var examBodyClass = 'ielts-reading-test-running';
        var viewportMeta = $window.document.querySelector('meta[name="viewport"]');
        var normalViewportContent = 'width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1';
        var examViewportContent = 'width=device-width, initial-scale=1, minimum-scale=0.5, maximum-scale=5, user-scalable=yes, viewport-fit=cover';

        function setExamViewportZoom(enabled) {
            if (!viewportMeta) {
                return;
            }
            viewportMeta.setAttribute(
                'content',
                enabled ? examViewportContent : normalViewportContent
            );
        }

        var unwatchExamLayout = $scope.$watch(function () {
            return vm.isStartTest === true && vm.passageNumber != 4;
        }, function (isRunning) {
            $window.document.body.classList.toggle(examBodyClass, isRunning);
            setExamViewportZoom(isRunning);
        });

        $scope.$on('$destroy', function () {
            stopReadingResize();
            if (writingTaskDraftTimer) { $timeout.cancel(writingTaskDraftTimer); }
            unwatchExamLayout();
            $window.document.body.classList.remove(examBodyClass);
            setExamViewportZoom(false);
        });

        /* Adjustable Reading / Questions split for mouse, pen and touch. */
        vm.readingPanePercent = 50;
        var readingResizeState = null;
        var readingResizeFrame = null;
        var pendingReadingResizePoint = null;

        try {
            var savedReadingPanePercent = parseFloat(
                $window.localStorage.getItem('ieltsReadingPanePercent')
            );
            if (!isNaN(savedReadingPanePercent)) {
                vm.readingPanePercent = Math.max(5, Math.min(95, savedReadingPanePercent));
            }
        } catch (ignoreReadingPaneStorageError) {
            vm.readingPanePercent = 50;
        }

        function stopReadingResize() {
            if (!readingResizeState) {
                return;
            }

            if (readingResizeFrame !== null) {
                $window.cancelAnimationFrame(readingResizeFrame);
                readingResizeFrame = null;
            }
            if (pendingReadingResizePoint) {
                applyReadingResizePoint(pendingReadingResizePoint);
                pendingReadingResizePoint = null;
            }

            $window.document.removeEventListener('mousemove', readingResizeState.onMove, false);
            $window.document.removeEventListener('mouseup', stopReadingResize, false);
            $window.document.removeEventListener('pointermove', readingResizeState.onMove, false);
            $window.document.removeEventListener('pointerup', stopReadingResize, false);
            $window.document.removeEventListener('pointercancel', stopReadingResize, false);
            $window.document.removeEventListener('touchmove', readingResizeState.onMove, false);
            $window.document.removeEventListener('touchend', stopReadingResize, false);
            $window.document.removeEventListener('touchcancel', stopReadingResize, false);
            $window.document.body.classList.remove('idp-is-resizing');

            if (readingResizeState.target && readingResizeState.pointerId != null &&
                readingResizeState.target.releasePointerCapture) {
                try {
                    readingResizeState.target.releasePointerCapture(readingResizeState.pointerId);
                } catch (ignorePointerReleaseError) {
                    // The browser may already have released it.
                }
            }

            try {
                $window.localStorage.setItem(
                    'ieltsReadingPanePercent',
                    String(vm.readingPanePercent)
                );
            } catch (ignoreReadingPaneStorageError) {
                // The split still works when localStorage is unavailable.
            }

            readingResizeState = null;
        }

        function applyReadingResizePoint(point) {
            if (!readingResizeState || !point) {
                return;
            }
            var splitBounds = readingResizeState.bounds;
            var nextPercent = readingResizeState.vertical
                ? ((point.y - splitBounds.top) / splitBounds.height) * 100
                : ((point.x - splitBounds.left) / splitBounds.width) * 100;
            vm.readingPanePercent = Math.round(
                Math.max(5, Math.min(95, nextPercent)) * 10
            ) / 10;
            $scope.$evalAsync();
        }

        function flushReadingResize() {
            readingResizeFrame = null;
            var point = pendingReadingResizePoint;
            pendingReadingResizePoint = null;
            applyReadingResizePoint(point);
        }

        vm.startReadingResize = function ($event) {
            if (!$event) {
                return;
            }

            $event.preventDefault();

            stopReadingResize();

            var splitRow = $event.currentTarget.parentNode;
            var splitBounds = splitRow.getBoundingClientRect();
            var verticalSplit = $window.innerWidth <= 996;

            function eventPoint(event) {
                var source = event.touches && event.touches.length
                    ? event.touches[0]
                    : (event.changedTouches && event.changedTouches.length
                        ? event.changedTouches[0]
                        : event);
                return {x: source.clientX, y: source.clientY};
            }

            function onMove(moveEvent) {
                if (readingResizeState && readingResizeState.pointerId != null &&
                    moveEvent.pointerId != null &&
                    moveEvent.pointerId !== readingResizeState.pointerId) {
                    return;
                }
                if (moveEvent.cancelable) {
                    moveEvent.preventDefault();
                }
                pendingReadingResizePoint = eventPoint(moveEvent);
                if (readingResizeFrame === null) {
                    readingResizeFrame = $window.requestAnimationFrame(flushReadingResize);
                }
            }

            readingResizeState = {
                onMove: onMove,
                bounds: splitBounds,
                vertical: verticalSplit,
                target: $event.currentTarget,
                pointerId: $event.pointerId != null ? $event.pointerId : null
            };
            $window.document.body.classList.add('idp-is-resizing');
            if ($event.type.indexOf('pointer') === 0) {
                $window.document.addEventListener('pointermove', onMove, {passive: false});
                $window.document.addEventListener('pointerup', stopReadingResize, false);
                $window.document.addEventListener('pointercancel', stopReadingResize, false);
            } else if ($event.type.indexOf('touch') === 0) {
                $window.document.addEventListener('touchmove', onMove, {passive: false});
                $window.document.addEventListener('touchend', stopReadingResize, false);
                $window.document.addEventListener('touchcancel', stopReadingResize, false);
            } else {
                $window.document.addEventListener('mousemove', onMove, false);
                $window.document.addEventListener('mouseup', stopReadingResize, false);
            }
        };

        vm.readingPaneStyle = function () {
            if ($window.innerWidth <= 996) {
                return {'flex-basis': vm.readingPanePercent + '%'};
            }
            return {'width': vm.readingPanePercent + '%'};
        };

        vm.questionPaneStyle = function (isFullWidth) {
            if (isFullWidth) {
                return $window.innerWidth <= 996 ? {'flex-basis': '100%'} : {'width': '100%'};
            }
            if ($window.innerWidth <= 996) {
                return {'flex-basis': (100 - vm.readingPanePercent) + '%'};
            }
            return {'width': (100 - vm.readingPanePercent) + '%'};
        };

        vm.readingDividerStyle = function () {
            return $window.innerWidth <= 996
                ? {'top': vm.readingPanePercent + '%'}
                : {'left': vm.readingPanePercent + '%'};
        };

        vm.resetReadingResize = function () {
            vm.readingPanePercent = 50;
            try {
                $window.localStorage.setItem('ieltsReadingPanePercent', '50');
            } catch (ignoreReadingPaneStorageError) {
                // The reset still works when localStorage is unavailable.
            }
        };

        /* Reading display preferences (the three IDP contrast and text modes). */
        var readingContrastStorageKey = 'ieltsReadingContrast';
        var readingTextSizeStorageKey = 'ieltsReadingTextSize';
        var readingZoomStorageKey = 'ieltsReadingZoomPercent';
        var allowedReadingContrasts = ['black-white', 'white-black', 'yellow-black'];
        var allowedReadingTextSizes = ['regular', 'large', 'extra-large'];

        vm.displayContrast = 'black-white';
        vm.readingTextSize = 'regular';
        vm.readingPageZoom = 100;
        vm.showDisplaySettings = false;

        try {
            var savedReadingContrast = $window.localStorage.getItem(readingContrastStorageKey);
            var savedReadingTextSize = $window.localStorage.getItem(readingTextSizeStorageKey);
            var savedReadingZoom = Number($window.localStorage.getItem(readingZoomStorageKey));
            if (allowedReadingContrasts.indexOf(savedReadingContrast) !== -1) {
                vm.displayContrast = savedReadingContrast;
            }
            if (allowedReadingTextSizes.indexOf(savedReadingTextSize) !== -1) {
                vm.readingTextSize = savedReadingTextSize;
            }
            if (isFinite(savedReadingZoom) && savedReadingZoom >= 60 && savedReadingZoom <= 160) {
                vm.readingPageZoom = Math.round(savedReadingZoom / 10) * 10;
            }
        } catch (ignoreReadingDisplayStorageError) {
            // Display settings still work for the current test session.
        }

        vm.openDisplaySettings = function () {
            vm.isShowContextMenu = false;
            vm.activeAnnotationNote = null;
            vm.showDisplaySettings = true;
        };

        vm.closeDisplaySettings = function () {
            vm.showDisplaySettings = false;
        };

        vm.setDisplayContrast = function (contrast) {
            if (allowedReadingContrasts.indexOf(contrast) === -1) {
                return;
            }
            vm.displayContrast = contrast;
            try {
                $window.localStorage.setItem(readingContrastStorageKey, contrast);
            } catch (ignoreReadingDisplayStorageError) {
                // Keep the in-memory preference when storage is unavailable.
            }
        };

        vm.setReadingTextSize = function (size) {
            if (allowedReadingTextSizes.indexOf(size) === -1) {
                return;
            }
            vm.readingTextSize = size;
            try {
                $window.localStorage.setItem(readingTextSizeStorageKey, size);
            } catch (ignoreReadingDisplayStorageError) {
                // Keep the in-memory preference when storage is unavailable.
            }
        };

        vm.setReadingPageZoom = function (percent) {
            var next = Math.round((Number(percent) || 100) / 10) * 10;
            vm.readingPageZoom = Math.max(60, Math.min(160, next));
            try {
                $window.localStorage.setItem(readingZoomStorageKey, String(vm.readingPageZoom));
            } catch (ignoreReadingDisplayStorageError) {
                // Keep the in-memory preference when storage is unavailable.
            }
        };

        vm.changeReadingPageZoom = function (delta) {
            vm.setReadingPageZoom(vm.readingPageZoom + Number(delta || 0));
        };

        vm.readingZoomInverse = function () {
            return 10000 / (Number(vm.readingPageZoom) || 100);
        };

        $scope.$on('$destroy', stopReadingResize);

        vm.currentUser = JSON.parse($cookies.getAll()["education.user"]);
        if(vm.currentUser.roles != null){
            angular.forEach(vm.currentUser.roles, function(value, key) {
                if(value.name == "ROLE_ADMIN"){
                    settings.isAdmin = true;
                    console.log("ADMIN");
                }
            });
        }
        // console.log(vm.currentUser);
        vm.question = {};
        vm.questions = [];
        vm.selectedQuestions = [];

        vm.matchingOptionLabel = function (index) {
            index = parseInt(index, 10);
            if (isNaN(index) || index < 0) {
                return '';
            }
            var label = '';
            do {
                label = String.fromCharCode(65 + (index % 26)) + label;
                index = Math.floor(index / 26) - 1;
            } while (index >= 0);
            return label;
        };
        vm.pageIndex = 1;
        vm.pageSize = 10000;
        vm.searchDto = {};

        vm.searchDto.upper = 100;
        vm.searchDto.lower = 0;
        vm.searchDto.type = 100;
        vm.searchDto.pageSize = 12;
        vm.searchDto.pageIndex = 1;
        vm.currentPosition = 0;
        vm.currentCard = {};

        vm.testResult = {};

        vm.testResult.questionAnswerTestResult = [];
        vm.testResult.user = vm.currentUser;

        var readingDraftBaseKey = 'ieltsReadingInProgress:' + (vm.currentUser.id || 'anonymous');
        var legacyReadingDraftTaskSuffix = vm.assignmentTaskId ? ':task:' + vm.assignmentTaskId
            : (vm.assignedPart ? (vm.isWritingRoute ? ':writing-task:' : ':part:') + vm.assignedPart : '');
        var readingDraftTaskSuffix = vm.assignmentTaskId && vm.isPartAssignment
            ? legacyReadingDraftTaskSuffix + ':parts:' + vm.assignedParts.join('-') : legacyReadingDraftTaskSuffix;
        var legacyReadingDraftStorageKey = readingDraftBaseKey + legacyReadingDraftTaskSuffix;
        var legacyModeDraftStorageKey = readingDraftBaseKey
            + (vm.isComprehensiveRoute ? ':comprehensive' : (vm.isWritingRoute ? ':writing' : (vm.isListeningRoute ? ':listening' : ':reading'))) + legacyReadingDraftTaskSuffix;
        var readingDraftAutosaveTimer = null;
        var readingDraftSubmitted = false;
        var readingLearningDraftsReady = null;

        function readingDraftStorageKey(testId, sessionMode) {
            testId = testId || (vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id)
                || $stateParams.ieltsReadingTestId;
            var normalizedMode = String(sessionMode || vm.testSessionMode || vm.selectedTestSessionMode || '').toUpperCase();
            var sessionSuffix = normalizedMode === 'SERIOUS' ? ':serious' : '';
            return readingDraftBaseKey + (vm.isComprehensiveRoute ? ':comprehensive:test:' : (vm.isWritingRoute ? ':writing:test:' : (vm.isListeningRoute ? ':listening:test:' : ':reading:test:')))
                + String(testId || 'unknown') + sessionSuffix + (normalizedMode === 'STUDY' ? '' :
                    (vm.assignmentTaskId ? ':task:' + vm.assignmentTaskId + ':parts:' + vm.assignedParts.join('-') : readingDraftTaskSuffix));
        }

        function assignmentStudyDraftKey(testId) {
            return readingDraftStorageKey(testId, 'STUDY') + ':task:' + vm.assignmentTaskId + ':parts:' + vm.assignedParts.join('-');
        }

        function mergeStudyLearningDrafts(drafts) {
            drafts.sort(function (left, right) { return new Date(left.savedAt || 0) - new Date(right.savedAt || 0); });
            var merged = angular.copy(drafts[drafts.length - 1]);
            function collect(field, keyFor) {
                var records = {};
                angular.forEach(drafts, function (draft) {
                    angular.forEach(draft[field] || [], function (record) { records[keyFor(record)] = angular.copy(record); });
                });
                return Object.keys(records).map(function (key) { return records[key]; });
            }
            merged.results = collect('results', function (record) { return record.ordinalNumber + ':' + record.answerId; });
            merged.questionStates = collect('questionStates', function (record) { return record.questionId || record.ordinalNumber; });
            merged.completeListStates = collect('completeListStates', function (record) { return record.questionId || record.ordinalNumber; });
            merged.annotationNotes = collect('annotationNotes', function (record) { return record.id; });
            merged.annotations = collect('annotations', function (record) { return record.containerId + ':' + record.start + ':' + record.end; });
            var studied = [];
            angular.forEach(drafts, function (draft) {
                var completedParts = draft.studiedParts || (draft.completed
                    ? (draft.assignmentParts || (draft.assignmentPart ? [draft.assignmentPart] : draft.partNumbers)) : []);
                angular.forEach(completedParts || [], function (part) { if (studied.indexOf(Number(part)) < 0) { studied.push(Number(part)); } });
            });
            merged.studiedParts = studied.sort(function (a, b) { return a - b; });
            merged.completed = studied.length >= maximumAssignedPart;
            merged.assignmentTaskId = null;
            merged.assignmentPart = null;
            merged.assignmentParts = [];
            merged.isPartAssignment = false;
            return merged;
        }

        var readingDraftMemory = {};
        var readingDraftSaveQueues = {};
        var readingDraftPendingSaves = {};
        var readingAnnotationsRestoring = false;
        var readingDraftLoadGeneration = 0;
        var pendingReadingAnnotations = null;
        var unrestoredReadingAnnotations = [];
        var readingAnnotationRestoreTimer = null;
        var readingDraftWaitTimer = null;
        var readingDraftDestroyed = false;

        function storeReadingDraft(key, draft) {
            readingDraftMemory[key] = angular.copy(draft);
            try {
                $window.localStorage.setItem(key, JSON.stringify(draft));
            } catch (ignoreLocalDraftWrite) {
                // Cloud persistence must still run when local storage is full or blocked.
            }
        }

        function readStoredDraft(key) {
            try {
                var raw = $window.localStorage.getItem(key);
                var stored = raw ? JSON.parse(raw) : null;
                var memory = readingDraftMemory[key];
                return memory && (!stored || new Date(memory.savedAt) >= new Date(stored.savedAt)) ? memory : stored;
            } catch (ignoreStoredDraftReadError) {
                return readingDraftMemory[key] || null;
            }
        }

        function saveReadingLearningDraft(key, draft) {
            var payload = {
                draftKey: key,
                draftType: 'IELTS',
                title: draft.title || (draft.testMode === 'COMPREHENSIVE' ? 'Bài tập tổng hợp' :
                    (draft.testMode === 'WRITING' ? 'IELTS Writing Test' : (draft.isListening ? 'IELTS Listening Test' : 'IELTS Reading Test'))),
                payload: JSON.stringify(draft),
                savedAt: new Date(draft.savedAt || 0).getTime() || Date.now()
            };
            // Keep requests for each mode in order so an older snapshot cannot
            // finish after, and overwrite, a more recent note edit.
            var previous = readingDraftSaveQueues[key];
            readingDraftPendingSaves[key] = (readingDraftPendingSaves[key] || 0) + 1;
            vm.readingDraftSyncStatus = 'saving';
            function persist() {
                vm.readingDraftSyncStatus = 'saving';
                return service.saveLearningDraft(payload).then(function () {
                    readingDraftPendingSaves[key] -= 1;
                    vm.readingDraftSyncStatus = readingDraftPendingSaves[key] ? 'saving' : 'saved';
                }, function () {
                    readingDraftPendingSaves[key] -= 1;
                    vm.readingDraftSyncStatus = 'error';
                });
            }
            readingDraftSaveQueues[key] = previous ? previous.then(persist, persist) : persist();
        }

        function deleteReadingLearningDraft(key) {
            if (!key) { return; }
            delete readingDraftMemory[key];
            function remove() { return service.deleteLearningDraft(key).catch(angular.noop); }
            var previous = readingDraftSaveQueues[key];
            readingDraftSaveQueues[key] = previous ? previous.then(remove, remove) : remove();
        }

        function loadReadingLearningDrafts() {
            if (vm.isPreviewMode || !vm.currentUser || !vm.currentUser.id) { return null; }
            var generation = ++readingDraftLoadGeneration;
            return service.getLearningDrafts().then(function (items) {
                if (generation !== readingDraftLoadGeneration) { return false; }
                var invalidDraft = false;
                angular.forEach(items || [], function (item) {
                    if (!item || item.draftType !== 'IELTS' || !item.draftKey
                            || item.draftKey.indexOf(readingDraftBaseKey) !== 0 || !item.payload) { return; }
                    try {
                        var serverDraft = JSON.parse(item.payload);
                        if (!serverDraft || String(serverDraft.userId) !== String(vm.currentUser.id) || !serverDraft.testId) {
                            invalidDraft = true;
                            return;
                        }
                        var localDraft = readStoredDraft(item.draftKey);
                        var localSavedAt = new Date((localDraft || {}).savedAt || 0).getTime() || 0;
                        if (!localDraft || Number(item.savedAt) >= localSavedAt) {
                            storeReadingDraft(item.draftKey, serverDraft);
                        }
                    } catch (invalidServerDraft) { invalidDraft = true; }
                });
                return !invalidDraft;
            }, function () { return false; });
        }

        readingLearningDraftsReady = loadReadingLearningDrafts();

        function waitForReadingLearningDrafts(onReady, onFailure) {
            var settled = false;
            var timeout = $timeout(function () {
                if (settled || readingDraftDestroyed) { return; }
                settled = true;
                onFailure();
            }, 10000);
            readingDraftWaitTimer = timeout;
            readingLearningDraftsReady = loadReadingLearningDrafts();
            function finish(success) {
                if (settled || readingDraftDestroyed) { return; }
                settled = true;
                $timeout.cancel(timeout);
                if (success) { onReady(); } else { onFailure(); }
            }
            if (readingLearningDraftsReady) {
                readingLearningDraftsReady.then(finish, function () { finish(false); });
            } else {
                finish(true);
            }
        }

        function readReadingDraft(testId, sessionMode) {
            if (vm.isPreviewMode) {
                return null;
            }
            try {
                var expectedTestId = testId || (vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id)
                    || $stateParams.ieltsReadingTestId;
                var expectedMode = String(sessionMode || '').toUpperCase();
                var candidateKeys = expectedMode === 'SERIOUS'
                    ? [readingDraftStorageKey(expectedTestId, 'SERIOUS'), legacyModeDraftStorageKey, legacyReadingDraftStorageKey]
                    : expectedMode === 'STUDY'
                        ? [readingDraftStorageKey(expectedTestId, 'STUDY'), legacyModeDraftStorageKey, legacyReadingDraftStorageKey]
                        : [readingDraftStorageKey(expectedTestId, 'STUDY'), readingDraftStorageKey(expectedTestId, 'SERIOUS'), legacyModeDraftStorageKey, legacyReadingDraftStorageKey];
                var newestDraft = null;
                var newestDraftTime = -1;
                var studyDrafts = [];
                var sharedStudyKey = readingDraftStorageKey(expectedTestId, 'STUDY');
                var sharedStudyDraft = readStoredDraft(sharedStudyKey);
                var sharedStudyFound = false;
                if (expectedMode === 'STUDY') {
                    candidateKeys = [sharedStudyKey, legacyModeDraftStorageKey, legacyReadingDraftStorageKey];
                    candidateKeys = candidateKeys.concat(Object.keys(readingDraftMemory));
                    try {
                        for (var storageIndex = 0; storageIndex < $window.localStorage.length; storageIndex++) {
                            var storageKey = $window.localStorage.key(storageIndex);
                            if (storageKey.indexOf(readingDraftBaseKey + ':') === 0) { candidateKeys.push(storageKey); }
                        }
                    } catch (ignoreStudyKeyListing) {}
                    candidateKeys = candidateKeys.filter(function (key, index, all) { return all.indexOf(key) === index; });
                }
                for (var keyIndex = 0; keyIndex < candidateKeys.length; keyIndex++) {
                    var draft = readStoredDraft(candidateKeys[keyIndex]);
                    if (!draft || String(draft.userId) !== String(vm.currentUser.id) || !draft.testId
                            || (expectedTestId && String(draft.testId) !== String(expectedTestId))) {
                        continue;
                    }
                    if ((draft.testMode === 'COMPREHENSIVE') !== vm.isComprehensiveRoute) {
                        continue;
                    }
                    if ((draft.testMode === 'WRITING') !== vm.isWritingRoute) {
                        continue;
                    }
                    if (!vm.isFlexibleRoute && (draft.testMode === 'LISTENING' || draft.isListening === true) !== vm.isListeningRoute
                            && (draft.testMode || angular.isDefined(draft.isListening))) {
                        continue;
                    }
                    if (expectedMode && String(draft.sessionMode || '').toUpperCase() !== expectedMode) {
                        continue;
                    }
                    if (expectedMode === 'STUDY') {
                        if (candidateKeys[keyIndex] === sharedStudyKey) { sharedStudyFound = true; }
                        if (!sharedStudyDraft || candidateKeys[keyIndex] === sharedStudyKey) { studyDrafts.push(draft); }
                    } else if (vm.isPartAssignment) {
                        if (String(draft.assignmentTaskId || '') !== String(vm.assignmentTaskId || '')) { continue; }
                        var draftParts = normalizeAssignedParts(draft.assignmentParts || draft.assignmentPart);
                        if (!draftParts.length || draftParts.some(function (part) { return vm.assignedParts.indexOf(part) < 0; })) { continue; }
                        var sameParts = draftParts.join(',') === vm.assignedParts.join(',');
                        // Old single-Part drafts can seed the new combined attempt. A
                        // submitted Part must never turn the remaining Parts into review.
                        if (draft.assignmentParts && !sameParts) { continue; }
                        if (sameParts && draft.completed && vm.assignmentTaskId) { continue; }
                        if (!sameParts) {
                            draft = angular.copy(draft);
                            draft.completed = false;
                            draft.resultId = null;
                        }
                    } else if (draft.isPartAssignment || draft.assignmentTaskId) { continue; }
                    var draftTime = new Date(draft.savedAt || 0).getTime() || 0;
                    if (!newestDraft || draftTime > newestDraftTime) {
                        newestDraft = draft;
                        newestDraftTime = draftTime;
                    }
                }
                if (expectedMode === 'STUDY' && studyDrafts.length) {
                    newestDraft = sharedStudyFound
                        ? angular.copy(sharedStudyDraft) : mergeStudyLearningDrafts(studyDrafts);
                    if (!sharedStudyFound) { storeReadingDraft(sharedStudyKey, newestDraft); }
                    if (vm.assignmentTaskId) {
                        newestDraft.completed = false;
                        newestDraft.resultId = null;
                    }
                }
                return newestDraft;
            } catch (ignoreReadingDraftReadError) {
                return null;
            }
        }

        function clearReadingDraft() {
            try {
                var currentTestId = vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id;
                var currentMode = vm.testSessionMode === 'STUDY' ? 'STUDY' : 'SERIOUS';
                var currentKey = readingDraftStorageKey(currentTestId, currentMode);
                try { $window.localStorage.removeItem(currentKey); } catch (ignoreLocalClear) {}
                deleteReadingLearningDraft(currentKey);
                angular.forEach([legacyModeDraftStorageKey, legacyReadingDraftStorageKey], function (key) {
                    var legacyDraft = readStoredDraft(key);
                    var legacyMode = String((legacyDraft || {}).sessionMode || 'STUDY').toUpperCase();
                    if (!legacyDraft || (String(legacyDraft.testId) === String(currentTestId) && legacyMode === currentMode)) {
                        try { $window.localStorage.removeItem(key); } catch (ignoreLegacyClear) {}
                        deleteReadingLearningDraft(key);
                    }
                });
            } catch (ignoreReadingDraftClearError) {
                // Submission can still finish when browser storage is unavailable.
            }
        }

        function serializeReadingDraftResults() {
            return (vm.testResult.questionAnswerTestResult || []).map(function (result) {
                var questionAnswer = result.questionAnswer || {};
                var question = questionAnswer.question || {};
                return {
                    ordinalNumber: result.ordinalNumber,
                    questionId: question.id,
                    answerId: questionAnswer.id,
                    answerOrdinal: questionAnswer.ordinalNumberQuestionAnswer,
                    clientAnswer: result.clientAnswer == null ? '' : String(result.clientAnswer)
                };
            });
        }

        function serializeReadingQuestionStates() {
            return getReadingQuestionEntries().map(function (entry) {
                var question = entry.question || {};
                return {
                    questionId: question.id,
                    ordinalNumber: question.ordinalNumber,
                    needReview: question.needReview === true,
                    answered: question.answered === true,
                    answers: (question.questionAnswers || []).map(function (questionAnswer) {
                        return {
                            answerId: questionAnswer.id,
                            answerOrdinal: questionAnswer.ordinalNumberQuestionAnswer,
                            selected: questionAnswer.selected === true,
                            clientAnswer: questionAnswer.clientAnswer == null ? '' : String(questionAnswer.clientAnswer)
                        };
                    })
                };
            });
        }

        function serializeCompleteListStates() {
            var states = [];
            angular.forEach((vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.subQuestions) || [], function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    if (Number(questionPackage.type) !== 13) { return; }
                    angular.forEach(questionPackage.subQuestions || [], function (question, questionIndex) {
                        var slot = (questionPackage.completeListSlots || [])[questionIndex];
                        var word = slot && slot.items && slot.items.length ? slot.items[0] : null;
                        if (!word) { return; }
                        states.push({
                            questionId: question.id,
                            ordinalNumber: question.ordinalNumber,
                            answerId: word.answerId,
                            answerIndex: Number(word.answerIndex),
                            clientAnswer: word.clientAnswer == null ? '' : String(word.clientAnswer)
                        });
                    });
                });
            });
            return states;
        }

        function serializeListeningAudioPositions() {
            var positions = {};
            angular.forEach((vm.ieltsReadingActualTest || {}).subQuestions || [], function (part) {
                angular.forEach(part.subQuestions || [], function (pack) {
                    if (Number(pack.type) === 18 && pack.id != null && isFinite(pack._listeningAudioTime)) {
                        positions[String(pack.id)] = Math.max(0, Number(pack._listeningAudioTime));
                    }
                });
            });
            return positions;
        }

        function getReadingDraftPartNumbers() {
            var partNumbers = [];
            angular.forEach(getReadingQuestionEntries(), function (entry) {
                var partNumber = vm.isComprehensiveRoute ? 1
                    : (vm.isWritingRoute ? (Number(entry.packageType) === 17 ? 2 : 1)
                        : (vm.isListeningRoute ? listeningPartNumberForOrdinal(entry.question.ordinalNumber) : entry.passageNumber));
                partNumber = Number(partNumber);
                if (partNumber > 0 && partNumbers.indexOf(partNumber) < 0) {
                    partNumbers.push(partNumber);
                }
            });
            partNumbers.sort(function (a, b) { return a - b; });
            if (!partNumbers.length) {
                partNumbers.push(Number(vm.assignedPart || vm.passageNumber) || 1);
            }
            return partNumbers;
        }

        function saveReadingDraft() {
            var testId = vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id;
            if (readingAnnotationsRestoring || vm.isStartingTest || vm.isPreviewMode || readingDraftSubmitted || !vm.currentUser.id || !testId || vm.isStartTest !== true || vm.passageNumber == 4) {
                return;
            }
            try {
                syncTimerForPersistence();
                var results = serializeReadingDraftResults();
                var answeredNumbers = {};
                angular.forEach(results, function (result) {
                    if (String(result.clientAnswer || '').trim()) {
                        answeredNumbers[result.ordinalNumber] = true;
                    }
                });
                var activeDraftKey = readingDraftStorageKey(testId, vm.testSessionMode);
                var previousDraft = readStoredDraft(activeDraftKey) || {};
                var partNumbers = getReadingDraftPartNumbers();
                var readingDraft = {
                    version: 5,
                    userId: vm.currentUser.id,
                    testId: testId,
                    title: vm.ieltsReadingActualTest.title || 'IELTS Reading Test',
                    isListening: vm.isListeningRoute === true,
                    testMode: vm.isComprehensiveRoute ? 'COMPREHENSIVE' : (vm.isWritingRoute ? 'WRITING' : (vm.isListeningRoute ? 'LISTENING' : 'READING')),
                    sessionMode: vm.testSessionMode,
                    assignmentTaskId: vm.assignmentTaskId || null,
                    isPartAssignment: vm.isPartAssignment === true,
                    assignmentPart: vm.isPartAssignment ? (vm.assignedPart || null) : null,
                    assignmentParts: vm.isPartAssignment ? angular.copy(vm.assignedParts) : [],
                    partNumbers: partNumbers,
                    partCount: partNumbers.length,
                    savedAt: new Date().toISOString(),
                    passageNumber: vm.passageNumber || 1,
                    currentOrdinalNumber: Number(vm.tempOrdinalNumber) || null,
                    remainingSeconds: Math.max(0, Number($scope.counter) || 0),
                    elapsedSeconds: getActiveDurationSeconds(),
                    answeredCount: Object.keys(answeredNumbers).length,
                    totalQuestions: getReadingQuestionEntries().length,
                    results: results,
                    questionStates: serializeReadingQuestionStates(),
                    completeListStates: serializeCompleteListStates(),
                    listeningAudioPositions: serializeListeningAudioPositions(),
                    writingInputAudit: vm.isWritingRoute ? writingInputAuditSummary() : null,
                    annotationNotes: angular.copy(vm.annotationNotes || []),
                    annotations: serializeReadingAnnotations(),
                    hiddenFromDashboard: previousDraft.hiddenFromDashboard === true,
                    studiedParts: angular.copy(previousDraft.studiedParts || []),
                    completed: previousDraft.completed === true,
                    resultId: vm.isLearningReview === true ? (previousDraft.resultId || null) : null
                };
                if (vm.testSessionMode === 'STUDY') {
                    var visibleOrdinals = getReadingQuestionEntries().map(function (entry) { return Number(entry.question.ordinalNumber); });
                    ['results', 'questionStates', 'completeListStates'].forEach(function (field) {
                        readingDraft[field] = (previousDraft[field] || []).filter(function (record) {
                            return visibleOrdinals.indexOf(Number(record.ordinalNumber)) < 0;
                        }).concat(readingDraft[field]);
                    });
                    readingDraft.assignmentTaskId = null;
                    readingDraft.assignmentPart = null;
                    readingDraft.assignmentParts = [];
                    readingDraft.isPartAssignment = false;
                    readingDraft.partNumbers = angular.copy(vm.availableIeltsParts || partNumbers);
                    readingDraft.partCount = readingDraft.partNumbers.length;
                    readingDraft.totalQuestions = vm.availableIeltsQuestionCount || getAllReadingQuestionEntries().length;
                    var sharedAnswered = {};
                    angular.forEach(readingDraft.results, function (result) {
                        if (String(result.clientAnswer || '').trim()) { sharedAnswered[result.ordinalNumber] = true; }
                    });
                    readingDraft.answeredCount = Object.keys(sharedAnswered).length;
                }
                storeReadingDraft(activeDraftKey, readingDraft);
                saveReadingLearningDraft(activeDraftKey, readingDraft);
                if (vm.assignmentTaskId && vm.testSessionMode === 'STUDY') {
                    var assignmentDraft = angular.copy(readingDraft);
                    assignmentDraft.assignmentSession = true;
                    assignmentDraft.assignmentTaskId = vm.assignmentTaskId;
                    assignmentDraft.assignmentPart = vm.assignedPart;
                    assignmentDraft.assignmentParts = angular.copy(vm.assignedParts);
                    assignmentDraft.isPartAssignment = true;
                    assignmentDraft.completed = false;
                    var assignmentKey = assignmentStudyDraftKey(testId);
                    storeReadingDraft(assignmentKey, assignmentDraft);
                    saveReadingLearningDraft(assignmentKey, assignmentDraft);
                }
                angular.forEach([legacyModeDraftStorageKey, legacyReadingDraftStorageKey], function (key) {
                    var legacyDraft = readStoredDraft(key);
                    if (legacyDraft && String(legacyDraft.testId) === String(testId)
                            && String(legacyDraft.sessionMode || 'STUDY').toUpperCase() === String(vm.testSessionMode || '').toUpperCase()) {
                        $window.localStorage.removeItem(key);
                    }
                });
            } catch (ignoreReadingDraftWriteError) {
                // The test remains usable when private browsing blocks localStorage.
            }
        }

        function markStudyDraftCompleted(resultId) {
            if (vm.testSessionMode !== 'STUDY') { return; }
            try {
                var testId = vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id;
                var key = readingDraftStorageKey(testId, 'STUDY');
                var draft = readStoredDraft(key);
                if (!draft) { return; }
                var studiedParts = draft.studiedParts || [];
                angular.forEach(getReadingDraftPartNumbers(), function (part) {
                    if (studiedParts.indexOf(part) < 0) { studiedParts.push(part); }
                });
                draft.studiedParts = studiedParts.sort(function (a, b) { return a - b; });
                draft.completed = (vm.availableIeltsParts || getReadingDraftPartNumbers()).every(function (part) {
                    return studiedParts.indexOf(part) >= 0;
                });
                draft.resultId = resultId || null;
                draft.savedAt = new Date().toISOString();
                storeReadingDraft(key, draft);
                saveReadingLearningDraft(key, draft);
                if (vm.assignmentTaskId) {
                    var assignmentKey = assignmentStudyDraftKey(testId);
                    var assignmentDraft = readStoredDraft(assignmentKey);
                    if (assignmentDraft) {
                        assignmentDraft.completed = true;
                        assignmentDraft.resultId = resultId || null;
                        assignmentDraft.savedAt = draft.savedAt;
                        storeReadingDraft(assignmentKey, assignmentDraft);
                        saveReadingLearningDraft(assignmentKey, assignmentDraft);
                    }
                }
            } catch (ignoreStudyDraftCompletionError) {
                // The submitted server result is still available when storage is blocked.
            }
        }

        function findDraftQuestionState(draft, question) {
            var states = (draft && draft.questionStates) || [];
            for (var index = 0; index < states.length; index++) {
                if ((question.id != null && states[index].questionId == question.id) ||
                        states[index].ordinalNumber == question.ordinalNumber) {
                    return states[index];
                }
            }
            return null;
        }

        function findDraftResult(draft, question) {
            var results = findDraftResults(draft, question);
            return results.length ? results[0] : null;
        }

        function findDraftResults(draft, question) {
            return ((draft && draft.results) || []).filter(function (result) {
                return (question.id != null && result.questionId == question.id) ||
                    result.ordinalNumber == question.ordinalNumber;
            });
        }

        function findQuestionAnswer(question, draftAnswer) {
            var questionAnswers = (question && question.questionAnswers) || [];
            for (var index = 0; index < questionAnswers.length; index++) {
                if ((draftAnswer.answerId != null && questionAnswers[index].id == draftAnswer.answerId) ||
                        Number(questionAnswers[index].ordinalNumberQuestionAnswer) === Number(draftAnswer.answerOrdinal)) {
                    return questionAnswers[index];
                }
            }
            return questionAnswers.length ? questionAnswers[0] : null;
        }

        function findCompleteListDraftState(draft, question) {
            var states = (draft && draft.completeListStates) || [];
            for (var index = 0; index < states.length; index++) {
                if ((question.id != null && states[index].questionId == question.id) ||
                        states[index].ordinalNumber == question.ordinalNumber) {
                    return states[index];
                }
            }
            return null;
        }

        function findCompleteListWord(questionPackage, savedState, savedResult) {
            var words = (questionPackage && questionPackage.completeListWordBank) || [];
            var expectedIndex = savedState && savedState.answerIndex !== null && savedState.answerIndex !== '' &&
                isFinite(Number(savedState.answerIndex))
                ? Number(savedState.answerIndex)
                : (savedResult && savedResult.answerOrdinal !== null && savedResult.answerOrdinal !== '' &&
                    isFinite(Number(savedResult.answerOrdinal))
                    ? Number(savedResult.answerOrdinal) - 1 : null);
            var expectedText = String((savedState && savedState.clientAnswer) ||
                (savedResult && savedResult.clientAnswer) || '').trim().toLowerCase();
            var matched = null;
            angular.forEach(words, function (word) {
                if (matched) { return; }
                if (expectedIndex !== null && Number(word.answerIndex) === expectedIndex) {
                    matched = word;
                    return;
                }
                if (expectedText && String(word.clientAnswer || '').trim().toLowerCase() === expectedText) {
                    matched = word;
                }
            });
            return matched;
        }

        function restoreMatchingHeadingDraft(draft, lists, bank) {
            angular.forEach(lists || [], function (list) {
                var slot = list && list.items && list.items[0];
                var question = slot && slot.question;
                var savedResult = question ? findDraftResult(draft, question) : null;
                if (!slot || !savedResult || !String(savedResult.clientAnswer || '').trim()) {
                    return;
                }
                var selectedHeading = null;
                angular.forEach((bank && bank.items) || [], function (heading) {
                    if (!selectedHeading && heading.answer &&
                            String(heading.answer.answer || '').trim() === String(savedResult.clientAnswer).trim()) {
                        selectedHeading = heading;
                    }
                });
                if (!selectedHeading) {
                    return;
                }
                slot.clientAnswer = selectedHeading.clientAnswer || selectedHeading.answer.answer;
                slot.ordinalFromListB = selectedHeading.ordinalNumberQuestionAnswer;
                slot.objectFromListB = selectedHeading;
                selectedHeading.isHide = true;
                question.answered = true;
                vm.testResult.questionAnswerTestResult.push({
                    questionAnswer: slot,
                    ordinalNumber: question.ordinalNumber,
                    clientAnswer: slot.clientAnswer
                });
            });
        }

        function restoreReadingDraft() {
            var draft = readReadingDraft(vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id, vm.testSessionMode);
            var currentTestId = vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.id;
            if (!draft || String(draft.testId) !== String(currentTestId)) {
                return;
            }

            angular.forEach((vm.ieltsReadingActualTest || {}).subQuestions || [], function (part) {
                angular.forEach(part.subQuestions || [], function (pack) {
                    var position = (draft.listeningAudioPositions || {})[String(pack.id)];
                    if (Number(pack.type) === 18 && isFinite(position)) { pack._listeningAudioTime = Math.max(0, Number(position)); }
                });
            });
            if (vm.isWritingRoute) { restoreWritingInputAudit(draft); }
            vm.testResult.questionAnswerTestResult = [];
            angular.forEach(getReadingQuestionEntries(), function (entry) {
                var question = entry.question;
                var state = findDraftQuestionState(draft, question);
                if (state) {
                    question.needReview = state.needReview === true;
                    angular.forEach(state.answers || [], function (savedAnswer) {
                        var questionAnswer = findQuestionAnswer(question, savedAnswer);
                        if (questionAnswer) {
                            questionAnswer.selected = savedAnswer.selected === true;
                            questionAnswer.clientAnswer = savedAnswer.clientAnswer || '';
                        }
                    });
                }

                var savedResults = findDraftResults(draft, question);
                var savedResult = savedResults.length ? savedResults[0] : null;
                if (Number(entry.packageType) === 13 && entry.questionPackage.completeListWordBank) {
                    var completeState = findCompleteListDraftState(draft, question);
                    var completeWord = findCompleteListWord(entry.questionPackage, completeState, savedResult);
                    if (completeWord) {
                        vm.dropCompleteListWord(entry.questionPackage,
                            entry.questionPackage.subQuestions.indexOf(question), completeWord, true);
                    }
                    return;
                }
                if (!savedResult || Number(entry.packageType) === 4) {
                    return;
                }
                var answer = findQuestionAnswer(question, savedResult);
                if (!answer) {
                    return;
                }
                if ((Number(entry.packageType) === 14 || Number(entry.packageType) === 15) && entry.questionPackage.sentenceEndingBank) {
                    var ending = entry.questionPackage.sentenceEndingBank[Number(savedResult.answerOrdinal) - 1];
                    if (ending) {
                        vm.dropSentenceEnding(entry.questionPackage, entry.questionPackage.subQuestions.indexOf(question), ending);
                    }
                    return;
                }
                angular.forEach(savedResults, function (result) {
                    var restoredAnswer = findQuestionAnswer(question, result);
                    if (!restoredAnswer) {
                        return;
                    }
                    question.answered = question.answered || !!String(result.clientAnswer || '').trim() || restoredAnswer.selected === true;
                    vm.testResult.questionAnswerTestResult.push({
                        questionAnswer: restoredAnswer,
                        ordinalNumber: question.ordinalNumber,
                        clientAnswer: result.clientAnswer || ''
                    });
                });
            });

            restoreMatchingHeadingDraft(draft, $scope.listA, $scope.listB);
            restoreMatchingHeadingDraft(draft, $scope.listA2, $scope.listB2);
            restoreMatchingHeadingDraft(draft, $scope.listA3, $scope.listB3);
            vm.passageNumber = vm.isPartAssignment
                ? displayPassageForAssignedPart()
                : Math.max(1, Math.min(3, Number(draft.passageNumber) || 1));
            if (Number(draft.currentOrdinalNumber) > 0) {
                vm.tempOrdinalNumber = Number(draft.currentOrdinalNumber);
                $timeout(function () {
                    vm.autoScrollToView(vm.tempOrdinalNumber);
                }, 250);
            }
            if (vm.testSessionMode === 'STUDY' && draft.sessionMode === 'STUDY') {
                timerRestoredFromDraft = true;
                setStudyElapsedSeconds(Number(draft.elapsedSeconds) || 0);
            } else if (vm.testSessionMode !== 'STUDY' && Number(draft.remainingSeconds) > 0) {
                timerRestoredFromDraft = true;
                setCountdownSeconds(Number(draft.remainingSeconds));
            }
            vm.annotationNotes = angular.copy(draft.annotationNotes || []);
            readingAnnotationsRestoring = true;
            pendingReadingAnnotations = angular.copy(draft.annotations || []);
            readingAnnotationRestoreTimer = $timeout(function () {
                try {
                    restoreReadingAnnotations(pendingReadingAnnotations);
                } catch (annotationRestoreError) {
                    // Preserve the original anchors if a malformed DOM interrupts restoration.
                    unrestoredReadingAnnotations = angular.copy(pendingReadingAnnotations || []);
                } finally {
                    readingAnnotationsRestoring = false;
                    pendingReadingAnnotations = null;
                    readingAnnotationRestoreTimer = null;
                }
            }, 350);
            vm.isStartTest = true;
            vm.isStartingTest = false;
            vm.showTestModeDialog = false;
            toastr.success('Your in-progress test has been restored.', 'Continue test');
        }

        function startReadingDraftAutosave() {
            $timeout.cancel(readingDraftAutosaveTimer);
            function autosave() {
                saveReadingDraft();
                readingDraftAutosaveTimer = $timeout(autosave, 3000);
            }
            readingDraftAutosaveTimer = $timeout(autosave, 1000);
        }

        var allowConfirmedTestNavigation = false;

        function isActiveTestNavigationProtected() {
            return vm.isStartTest === true && vm.passageNumber != 4;
        }

        function confirmLeavingActiveTest(message) {
            if (!isActiveTestNavigationProtected() || allowConfirmedTestNavigation) {
                return true;
            }
            if (!$window.confirm(message || 'Bạn có muốn rời bài đang làm và chuyển sang trang khác không?')) {
                return false;
            }

            saveReadingDraft();
            allowConfirmedTestNavigation = true;
            return true;
        }

        function handleLocationChangeStart(event, newUrl, oldUrl) {
            if (newUrl === oldUrl || confirmLeavingActiveTest()) {
                return;
            }
            event.preventDefault();
        }

        function handleReadingBeforeUnload(event) {
            saveReadingDraft();
            if (isActiveTestNavigationProtected() && !allowConfirmedTestNavigation) {
                event.preventDefault();
                event.returnValue = '';
            }
        }

        var unregisterLocationChangeGuard = $scope.$on('$locationChangeStart', handleLocationChangeStart);
        $window.addEventListener('beforeunload', handleReadingBeforeUnload);
        $window.addEventListener('pagehide', saveReadingDraft);
        $scope.$on('$destroy', function () {
            saveReadingDraft();
            readingDraftDestroyed = true;
            readingDraftLoadGeneration += 1;
            $timeout.cancel(readingAnnotationRestoreTimer);
            $timeout.cancel(readingDraftWaitTimer);
            $timeout.cancel(readingDraftAutosaveTimer);
            unregisterLocationChangeGuard();
            $window.removeEventListener('beforeunload', handleReadingBeforeUnload);
            $window.removeEventListener('pagehide', saveReadingDraft);
        });

        var currentPerson = vm.currentUser.person || {};
        vm.testResult.testTakerName = [
            currentPerson.lastName,
            currentPerson.firstName
        ].filter(function (namePart) {
            return namePart !== null && namePart !== undefined && String(namePart).trim() !== '';
        }).join(' ').trim();

        if (!vm.testResult.testTakerName) {
            vm.testResult.testTakerName = vm.currentUser.displayName || vm.currentUser.username || '';
        }

        vm.testResultAfterSubmitting = {};

        vm.ieltsReadingTests = [];
        vm.ieltsReadingTest = {
            questionType: {
                code: 'IELTSRT',
                id: 11,
                name: 'IELTS Writing Test',
                textSearch: null
            },
            type: 0,
            status: 1,
            questionTopics: [],
            countWords: 0,
            ordinalNumber: 1,
            subQuestions: []
        };  //create a new test

        vm.highestOrdinalNumberPassage = 0;
        vm.highestOrdinalNumberPackageForPassage1 = 0;
        vm.highestOrdinalNumberQuestionForPassage1 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage1 = 0;

        vm.highestOrdinalNumberPackageForPassage2 = 0;
        vm.highestOrdinalNumberQuestionForPassage2 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage2 = 0;

        vm.highestOrdinalNumberPackageForPassage3 = 0;
        vm.highestOrdinalNumberQuestionForPassage3 = 0;
        vm.highestOrdinalNumberQuestionAnswerForPassage3 = 0;

        vm.isShowConfigureQuestion = false;

        //for passage 1
        $scope.listA = [

        ];

        $scope.listB =
        {
            items:[]
        };

        //for passage 2
        $scope.listA2 = [

        ];

        $scope.listB2 =
        {
            items:[]
        };

        //for passage 3
        $scope.listA3 = [

        ];

        $scope.listB3 =
        {
            items:[]
        };

        function getHighestOrdinalNumber(objects) {
            var temp = 0;
            if(objects != null){ //Passage
                for(var i = 0; i < objects.length; i++){
                    if(objects[i].ordinalNumber != null && objects[i].ordinalNumber > temp){
                        temp = objects[i].ordinalNumber;
                    }
                }
            }
            return temp;
        }

        vm.getOrdinalNumberPassage3 = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                // console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage3 = getHighestOrdinalNumber(packagesForPassage3);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    // console.log('highest orinal number packages for passage 3: ' + vm.highestOrdinalNumberPackageForPassage3);
                    if(packagesForPassage3 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[2].subQuestions.length; i++){
                            var questionsForPassage3 = ieltsReadingTest.subQuestions[2].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage3);

                            if(vm.highestOrdinalNumberQuestionForPassage3 < temp){
                                vm.highestOrdinalNumberQuestionForPassage3 = temp;
                            }
                        }
                        // console.log('highest orinal number questions for passage 3: ' + vm.highestOrdinalNumberQuestionForPassage3);
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage3 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage3 = 0;
                    // vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage3 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }

        };

        vm.getOrdinalNumberPassage2 = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                // console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions;
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage2 = getHighestOrdinalNumber(packagesForPassage2);
                    // vm.highestOrdinalNumberPackageForPassage2 = vm.highestOrdinalNumberPackageForPassage2 + vm.highestOrdinalNumberPackageForPassage1;

                    // console.log('highest orinal number packages for passage 2: ' + vm.highestOrdinalNumberPackageForPassage2);
                    if(packagesForPassage2 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[1].subQuestions.length; i++){
                            var questionsForPassage2 = ieltsReadingTest.subQuestions[1].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage2);

                            if(vm.highestOrdinalNumberQuestionForPassage2 < temp){
                                vm.highestOrdinalNumberQuestionForPassage2 = temp;
                            }
                        }
                        // console.log('highest orinal number questions for passage 2: ' + vm.highestOrdinalNumberQuestionForPassage2);
                        vm.highestOrdinalNumberQuestionForPassage3 = vm.highestOrdinalNumberQuestionForPassage2;
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage2 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage2 = 0;
                    // vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage2 = 0;
                // vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            vm.getOrdinalNumberPassage3(ieltsReadingTest);
        };

        vm.getOrdinalNumber = function (ieltsReadingTest){
            if(ieltsReadingTest!= null){
                var passages = ieltsReadingTest.subQuestions;
                vm.highestOrdinalNumberPassage = getHighestOrdinalNumber(passages);
                // console.log('highest for passages: ' + vm.highestOrdinalNumberPassage);

                if(passages != null){
                    var packagesForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions;
                    vm.highestOrdinalNumberPackageForPassage1 = getHighestOrdinalNumber(packagesForPassage1);
                    // console.log('highest orinal number packages for passage 1: ' + vm.highestOrdinalNumberPackageForPassage1);
                    if(packagesForPassage1 != null){
                        var temp = 0;
                        for(var i = 0; i < ieltsReadingTest.subQuestions[0].subQuestions.length; i++){
                            var questionsForPassage1 = ieltsReadingTest.subQuestions[0].subQuestions[i].subQuestions;
                            temp = getHighestOrdinalNumber(questionsForPassage1);
                            if(vm.highestOrdinalNumberQuestionForPassage1 < temp){
                                vm.highestOrdinalNumberQuestionForPassage1 = temp;
                            }
                        }
                        // console.log('highest orinal number questions for passage 1: ' + vm.highestOrdinalNumberQuestionForPassage1);
                        vm.highestOrdinalNumberQuestionForPassage2 = vm.highestOrdinalNumberQuestionForPassage1;
                    }else {
                        vm.highestOrdinalNumberQuestionForPassage1 = 0;
                    }
                }else {
                    vm.highestOrdinalNumberPackageForPassage1 = 0;
                    vm.highestOrdinalNumberPackageForPassage1 = 0;
                }
            }else {
                vm.highestOrdinalNumberPassage = 0;
                vm.highestOrdinalNumberPackageForPassage1 = 0;
            }
            vm.getOrdinalNumberPassage2(ieltsReadingTest);
        };

        console.log('IELTS Reading Actual Test');
        vm.searchDto.pageSize = 10;
        // console.log($stateParams.ieltsReadingTestId);
        vm.isPreviewMode = $location.search().preview === '1' || $location.search().preview === 1;
        vm.previewPart = Math.max(1, Math.min(vm.isComprehensiveRoute ? 1 : (vm.isListeningRoute ? 4 : 3),
            parseInt($location.search().previewPart, 10) || 1));
        if (vm.isPreviewMode && vm.isListeningRoute && vm.previewPart === 4) {
            // Giao diện thi cũ có ba workspace hiển thị. Part 4 dùng workspace
            // thứ ba nhưng phải lọc từ payload bốn Part trước khi gộp dữ liệu.
            vm.assignedPart = 4;
            vm.assignedParts = [4];
            vm.isPartAssignment = true;
        }
        vm.previewKey = $location.search().previewKey;
        vm.previewStorage = $location.search().previewStorage === 'session' ? 'session' : 'local';
        vm.isHasTestTakerName = true;
        vm.isStartTest = false;
        vm.isStartingTest = false;
        vm.startTestError = '';

        var requestedSessionMode = vm.assignmentTaskId ? 'SERIOUS' :
            (String($location.search().sessionMode || '').toUpperCase() === 'SERIOUS' ? 'SERIOUS' : 'STUDY');
        var startFreshSeriousTest = requestedSessionMode === 'SERIOUS'
            && String($location.search().startFresh || '') === '1';
        var existingSessionDraft = startFreshSeriousTest ? null
            : readReadingDraft($stateParams.ieltsReadingTestId, requestedSessionMode);
        if (requestedSessionMode === 'STUDY' || requestedSessionMode === 'SERIOUS') {
            vm.selectedTestSessionMode = requestedSessionMode;
        } else if (existingSessionDraft && String(existingSessionDraft.testId) === String($stateParams.ieltsReadingTestId)
                && (existingSessionDraft.sessionMode === 'STUDY' || existingSessionDraft.sessionMode === 'SERIOUS')) {
            vm.selectedTestSessionMode = existingSessionDraft.sessionMode;
        }

        vm.requestStartTest = function () {
            if (vm.isStartingTest) { return; }
            if (vm.isPreviewMode) {
                vm.testSessionMode = 'SERIOUS';
                vm.startTest();
                return;
            }
            if (vm.assignmentTaskId) {
                waitForReadingLearningDrafts(function () {
                    if (vm.isStartTest || vm.isStartingTest) { return; }
                    requestedSessionMode = 'SERIOUS';
                    vm.assignedParts = angular.copy(requestedAssignmentParts);
                    vm.assignedPart = vm.assignedParts[0];
                    vm.nextAssignmentParts = [];
                    vm.nextAssignmentSessionMode = null;
                    vm.testSessionMode = vm.selectedTestSessionMode = requestedSessionMode;
                    vm.isLearningReview = false;
                    vm.showTestModeDialog = false;
                    vm.showAudioListening = false;
                    vm.showAudio = vm.showAudioListening;
                    vm.startTest();
                }, function () {
                    vm.startTestError = 'Không thể tải tiến trình học. Vui lòng thử lại.';
                    toastr.error(vm.startTestError, 'Khôi phục bài làm');
                });
                return;
            }
            if (requestedSessionMode === 'STUDY') {
                vm.testSessionMode = 'STUDY';
                vm.selectedTestSessionMode = 'STUDY';
                vm.startTest();
                return;
            }
            if (startFreshSeriousTest) {
                vm.testSessionMode = 'SERIOUS';
                vm.selectedTestSessionMode = 'SERIOUS';
                vm.startTest();
                return;
            }
            vm.showTestModeDialog = true;
        };

        vm.continueAssignedParts = function () {
            if (!vm.nextAssignmentParts.length) { return; }
            $location.search({assignmentTaskId: vm.assignmentTaskId, assignmentParts: vm.nextAssignmentParts.join(','),
                assignmentPart: vm.nextAssignmentParts[0], sessionMode: vm.nextAssignmentSessionMode});
        };

        vm.confirmLeaveTest = function ($event) {
            if ($event) {
                $event.preventDefault();
                $event.stopPropagation();
            }
            if (!confirmLeavingActiveTest('Bạn có chắc muốn rời bài đang làm và quay về trang chủ không?')) {
                return;
            }

            $location.url('/dashboard');
        };

        vm.selectTestSessionMode = function (mode) {
            vm.selectedTestSessionMode = mode === 'STUDY' ? 'STUDY' : 'SERIOUS';
        };

        vm.confirmTestSessionMode = function () {
            if (vm.isStartingTest) { return; }
            vm.testSessionMode = vm.selectedTestSessionMode === 'STUDY' ? 'STUDY' : 'SERIOUS';
            vm.showAudioListening = vm.isListeningRoute && vm.testSessionMode === 'STUDY';
            vm.showAudio = vm.showAudioListening;
            vm.startTest();
        };

        vm.closeTestSessionMode = function () {
            if (vm.isStartingTest) { return; }
            vm.showTestModeDialog = false;
        };

        function normalizeLocalReadingPreview(data) {
            angular.forEach(data.subQuestions || [], function (passage, passageIndex) {
                angular.forEach(passage.subQuestions || [], function (questionPackage, packageIndex) {
                    questionPackage.parent = {
                        ordinalNumber: passage.ordinalNumber,
                        questionType: passage.questionType
                    };
                    angular.forEach(questionPackage.subQuestions || [], function (question, questionIndex) {
                        if (question.id == null) {
                            question.id = 'preview-question-' + passageIndex + '-' + packageIndex + '-' + questionIndex;
                        }
                        question.parent = {type: questionPackage.type, questionType: questionPackage.questionType};
                        angular.forEach(question.questionAnswers || [], function (questionAnswer, answerIndex) {
                            if (questionAnswer.id == null) {
                                questionAnswer.id = question.id + '-answer-' + answerIndex;
                            }
                            questionAnswer.question = {id: question.id, parent: {type: questionPackage.type}};
                        });
                    });
                });
            });
            return data;
        }

        function normalizeListeningCandidateParts(data) {
            if (!vm.isListeningRoute || !data || !angular.isArray(data.subQuestions)
                    || data.subQuestions.length <= 3) {
                return data;
            }

            var thirdWorkspace = data.subQuestions[2];
            if (!thirdWorkspace) { return data; }
            thirdWorkspace.subQuestions = thirdWorkspace.subQuestions || [];

            angular.forEach(data.subQuestions.slice(3), function (extraPart) {
                if (extraPart && extraPart.question) {
                    thirdWorkspace.question = String(thirdWorkspace.question || '') +
                        (thirdWorkspace.question ? '<hr>' : '') + String(extraPart.question);
                }
                Array.prototype.push.apply(thirdWorkspace.subQuestions,
                    (extraPart && extraPart.subQuestions) || []);
            });
            angular.forEach(thirdWorkspace.subQuestions, function (questionPackage, packageIndex) {
                questionPackage.ordinalNumber = packageIndex + 1;
            });
            data.subQuestions = data.subQuestions.slice(0, 3);
            return data;
        }

        function restrictListeningAssignmentToSelectedPart(data) {
            if (!vm.isListeningRoute || !vm.isPartAssignment || !data ||
                    !angular.isArray(data.subQuestions) || !data.subQuestions.length) {
                return data;
            }

            if (vm.assignedParts.length > 1) {
                angular.forEach(data.subQuestions, function (passage) {
                    passage.subQuestions = (passage.subQuestions || []).filter(function (questionPackage) {
                        questionPackage.subQuestions = (questionPackage.subQuestions || []).filter(function (question) {
                            return vm.assignedParts.indexOf(listeningPartNumberForOrdinal(question.ordinalNumber)) >= 0;
                        });
                        return questionPackage.subQuestions.length > 0;
                    });
                });
                return data;
            }
            var assignedPart = Number(vm.assignedPart);
            var passages = data.subQuestions;
            var displayIndex = Math.min(assignedPart, 3) - 1;
            var sourceIndex = Math.min(assignedPart - 1, passages.length - 1);
            var sourcePassage = passages[sourceIndex] || passages[displayIndex];
            var displayPassages = passages.slice(0, 3);
            var displayShell = displayPassages[displayIndex] || sourcePassage;
            var assignedPackages = [];

            angular.forEach(passages, function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    var assignedQuestions = (questionPackage.subQuestions || []).filter(function (question) {
                        return listeningPartNumberForOrdinal(question.ordinalNumber) === assignedPart;
                    });
                    if (assignedQuestions.length) {
                        questionPackage.subQuestions = assignedQuestions;
                        assignedPackages.push(questionPackage);
                    }
                });
            });

            if (!sourcePassage || !displayShell) {
                return data;
            }

            // Part 4 dùng workspace thứ ba của giao diện cũ, nhưng lấy đúng
            // transcript/nội dung Part 4 nếu payload đã có đủ bốn Part.
            if (sourcePassage !== displayShell) {
                sourcePassage.questionType = displayShell.questionType;
                sourcePassage.ordinalNumber = displayShell.ordinalNumber;
                displayPassages[displayIndex] = sourcePassage;
            }

            angular.forEach(displayPassages, function (passage) {
                if (passage) {
                    passage.subQuestions = [];
                }
            });

            sourcePassage.subQuestions = assignedPackages;
            angular.forEach(assignedPackages, function (questionPackage) {
                questionPackage.parent = {
                    ordinalNumber: sourcePassage.ordinalNumber,
                    questionType: sourcePassage.questionType
                };
            });

            data.subQuestions = displayPassages;
            return data;
        }

        function restrictWritingAssignmentToSelectedTask(data) {
            if (!vm.isWritingRoute || !vm.isPartAssignment || !data || !angular.isArray(data.subQuestions)) {
                return data;
            }
            var selectedPackages = [];
            angular.forEach(data.subQuestions, function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    var taskNumber = Number(questionPackage.type) === 17 ? 2 : (Number(questionPackage.type) === 16 ? 1 : null);
                    if (vm.assignedParts.indexOf(taskNumber) >= 0) { selectedPackages.push(questionPackage); }
                });
            });
            if (!data.subQuestions.length) { return data; }
            angular.forEach(data.subQuestions, function (passage) {
                if (passage) { passage.subQuestions = []; }
            });
            data.subQuestions[0].subQuestions = selectedPackages;
            angular.forEach(selectedPackages, function (questionPackage, index) {
                questionPackage.ordinalNumber = index + 1;
            });
            return data;
        }

        vm.startTest = function () {
            if (vm.isStartTest || vm.isStartingTest) { return; }
            vm.isStartingTest = true;
            vm.startTestError = '';

            function failToStartTest(message, title) {
                blockUI.stop();
                vm.isStartTest = false;
                vm.isStartingTest = false;
                vm.startTestError = message;
                toastr.error(message, title || 'Unable to start test');
            }

            function normalizeLegacyMultipleAnswerPackages(data) {
                angular.forEach((data && data.subQuestions) || [], function (passage) {
                    angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                        var questions = questionPackage.subQuestions || [];
                        if (Number(questionPackage.type) === 7) {
                            questionPackage.type = 5;
                        }
                        var isLegacySingleChoice = Number(questionPackage.type) === 1 && questions.length >= 2;
                        if (Number(questionPackage.type) !== 5 && !isLegacySingleChoice) {
                            return;
                        }
                        if (isLegacySingleChoice) {
                            var instruction = String(questionPackage.question || '').replace(/<[^>]*>/g, ' ').toLowerCase();
                            if (!/choose\s+(?:two|three|four|2|3|4)\b/.test(instruction)) {
                                return;
                            }
                            var firstText = String(questions[0].question || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                            var samePrompt = questions.every(function (question) {
                                return String(question.question || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() === firstText;
                            });
                            if (!samePrompt) {
                                return;
                            }
                            questionPackage.type = 5;
                        }

                        var primaryQuestion = questions[0] || {};
                        var primaryAnswers = primaryQuestion.questionAnswers || [];
                        var correctByIndex = {};
                        angular.forEach(questions, function (question) {
                            angular.forEach(question.questionAnswers || [], function (answer, answerIndex) {
                                if (!answer.correct) { return; }
                                var answerText = String(answer.answer && answer.answer.answer || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                                var matchedIndex = -1;
                                angular.forEach(primaryAnswers, function (primaryAnswer, primaryIndex) {
                                    var primaryText = String(primaryAnswer.answer && primaryAnswer.answer.answer || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                                    if (matchedIndex < 0 && primaryText === answerText) {
                                        matchedIndex = primaryIndex;
                                    }
                                });
                                correctByIndex[matchedIndex >= 0 ? matchedIndex : answerIndex] = true;
                            });
                        });
                        angular.forEach(questions, function (question) {
                            question.question = primaryQuestion.question;
                            angular.forEach(question.questionAnswers || [], function (answer, answerIndex) {
                                if (primaryAnswers[answerIndex] && primaryAnswers[answerIndex].answer) {
                                    answer.answer = answer.answer || {};
                                    answer.answer.answer = primaryAnswers[answerIndex].answer.answer;
                                }
                                answer.correct = !!correctByIndex[answerIndex];
                            });
                            if (question.parent) {
                                question.parent.type = questionPackage.type;
                            }
                        });
                    });
                });
                return data;
            }

            function loadReadingTest(data) {
                    if (!data || !angular.isArray(data.subQuestions)) {
                        failToStartTest('The test data could not be loaded. Please try again.');
                        return;
                    }
                    vm.listeningPartAudioUrls = vm.isListeningRoute ? data.subQuestions.map(function (part) {
                        return String(part && part.pronounce || '').trim();
                    }) : [];
                    vm.availableIeltsParts = [];
                    vm.availableIeltsQuestionCount = 0;
                    angular.forEach(data.subQuestions, function (passage, passageIndex) {
                        angular.forEach(passage.subQuestions || [], function (questionPackage) {
                            angular.forEach(questionPackage.subQuestions || [], function (question) {
                                var part = vm.isComprehensiveRoute ? 1 : (vm.isWritingRoute ? (Number(questionPackage.type) === 17 ? 2 : 1)
                                    : (vm.isListeningRoute ? listeningPartNumberForOrdinal(question.ordinalNumber) : passageIndex + 1));
                                if (vm.availableIeltsParts.indexOf(part) < 0) { vm.availableIeltsParts.push(part); }
                                vm.availableIeltsQuestionCount++;
                            });
                        });
                    });
                    data = restrictWritingAssignmentToSelectedTask(data);
                    data = restrictListeningAssignmentToSelectedPart(data);
                    data = normalizeListeningCandidateParts(data);
                    data = normalizeLegacyMultipleAnswerPackages(data);
                    cachedIeltsNavigationParts = null;
                    vm.ieltsReadingActualTest = data;
                    if (vm.isWritingRoute) {
                        var writingMinutes = 0;
                        angular.forEach(getWritingTaskPackages(), function (writingPackage) {
                            writingMinutes += Number(writingPackage.type) === 17 ? 40 : 20;
                        });
                        seriousTotalSeconds = Math.max(20, writingMinutes || 60) * 60;
                        if (!timerRestoredFromDraft) { setCountdownSeconds(seriousTotalSeconds); }
                    }
                    vm.getOrdinalNumber(data);
                    if (vm.isFlexibleRoute) {
                        vm.resultQuestionTotal = getAllReadingQuestionEntries().length || 1;
                    }
                    blockUI.stop();
                    vm.isStartTest = vm.isPreviewMode === true;
                    // var timeout10;
                    // timeout10 = $timeout(function(){
                    //     vm.setUpAudio();
                    // },1000);

                    function secondCallFunction(ieltsReadingActualTest) {
                        var timeout;
                        timeout = $timeout(function(){
                            var questionNumber = '';
                            for(var k = 0; k < vm.ieltsReadingActualTest.subQuestions.length; k++){
                                if(vm.ieltsReadingActualTest.subQuestions[k].subQuestions != null){ //update 12/12/2025
                                    for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions[k].subQuestions.length; i++) {
                                        for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                                            if (vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].type == 2) {
                                                questionNumber = vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber + ' ';
                                                // vm.addFields(vm.ieltsReadingActualTest.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber);
                                                // console.log(questionNumber);
                                            }
                                        }
                                    }
                                }
                            }
                            // alert(questionNumber);
                            timeout = null;
                        },0);
                    }

                    function firstCallFunction(myCallback) {
                        var timeout;
                        timeout = $timeout(function(){
                            try {
                                vm.ieltsReadingActualTest = vm.processQuestionATT(data);
                            } catch (questionProcessingError) {
                                // The raw server payload is still renderable. A malformed legacy
                                // package must not leave the candidate stuck on the loading screen.
                                console.error('Unable to finish IELTS question preprocessing.', questionProcessingError);
                                vm.ieltsReadingActualTest = data;
                            }
                            cachedIeltsNavigationParts = null;
                if (vm.isPreviewMode) {
                                vm.passageNumber = vm.isListeningRoute ? Math.min(vm.previewPart, 3) : vm.previewPart;
                                vm.isStartingTest = false;
                                vm.showTestModeDialog = false;
                                vm.setUpAudio();
                                $scope.startCount();
                                myCallback(vm.ieltsReadingActualTest);
                            } else {
                                var hasInitializedLoadedTest = false;
                                var initializeLoadedTest = function () {
                                    if (hasInitializedLoadedTest) { return; }
                                    hasInitializedLoadedTest = true;
                                    if (!startFreshSeriousTest) {
                                        try {
                                            restoreReadingDraft();
                                        } catch (draftRestoreError) {
                                            console.error('Unable to restore IELTS draft.', draftRestoreError);
                                            failToStartTest('Không thể khôi phục bản nháp. Vui lòng tải lại trang; ghi chú đã lưu sẽ được giữ nguyên.', 'Khôi phục bài làm');
                                            return;
                                        }
                                    }
                                    if (vm.isPartAssignment) {
                                        vm.passageNumber = displayPassageForAssignedPart();
                                        vm.resultQuestionTotal = assignedPartQuestionOrdinals().length || 1;
                                        $timeout(function () {
                                            var assignedEntries = getReadingQuestionEntries();
                                            if (assignedEntries.length) {
                                                vm.openReadingQuestion(assignedEntries[0].question,
                                                    assignedEntries[0].packageQuestions, assignedEntries[0].passageQuestions);
                                            }
                                        }, 0);
                                    }
                                    startReadingDraftAutosave();
                                    vm.isStartTest = true;
                                    vm.isStartingTest = false;
                                    vm.showTestModeDialog = false;
                                    vm.setUpAudio();
                                    $scope.startCount();
                                    $scope.$evalAsync(angular.noop);
                                    myCallback(vm.ieltsReadingActualTest);
                                };
                                // Never autosave an empty test before its server draft is loaded.
                                // Retry starts a fresh request; a timed-out response cannot open the test.
                                waitForReadingLearningDrafts(initializeLoadedTest, function () {
                                    vm.showTestModeDialog = true;
                                    failToStartTest('Chưa tải được ghi chú và tiến độ từ server. Vui lòng kiểm tra mạng rồi bấm Start để thử lại.', 'Khôi phục bài làm');
                                });
                            }
                        },0);
                    }

                    firstCallFunction(secondCallFunction);

                    // console.log(data);
            }

            if (vm.isPreviewMode && vm.previewKey) {
                try {
                    var activePreviewStorage = vm.previewStorage === 'session' ? $window.sessionStorage : $window.localStorage;
                    var previewData = JSON.parse(activePreviewStorage.getItem(vm.previewKey));
                    if (previewData) {
                        activePreviewStorage.removeItem(vm.previewKey);
                        loadReadingTest(normalizeLocalReadingPreview(previewData));
                        return;
                    }
                } catch (previewReadError) {
                    failToStartTest('The preview data is invalid.', 'Unable to open preview');
                    return;
                }
                vm.isStartingTest = false;
                vm.startTestError = 'This preview has expired. Open it again from the test builder.';
                toastr.warning(vm.startTestError, 'Preview not found');
                return;
            }

            if ($stateParams.ieltsReadingTestId != null) {
                blockUI.start();
                service.getOne($stateParams.ieltsReadingTestId).then(loadReadingTest, function failure() {
                    failToStartTest('The test could not be loaded. Please check your connection and try again.');
                });
            } else {
                failToStartTest('The test ID is missing. Please return to the test list and open it again.');
            }

        };

        vm.getOneTestResult = function (id) {
            service.getOneTestResult(id).then(function (data) {
                vm.testResultAfterSubmitting = data;
            }, function failure() {
                toastr.error('An error occurred while creating the account.', 'Notification');
            });
        };

        function showSubmittedTestResult(resultId, completed) {
            service.getOneTestResult(resultId).then(function (data1) {
                vm.testResultAfterSubmitting = data1;

                vm.passageNumber = 4;
                console.log(vm.testResultAfterSubmitting);

                vm.percentageAfterSubmit = (vm.testResultAfterSubmitting.correctAnswer / vm.resultQuestionTotal)*100;
                vm.textBandScore = vm.isFlexibleRoute ?
                    (vm.testResultAfterSubmitting.correctAnswer + '/' + vm.resultQuestionTotal) :
                    ('Band ' + vm.testResultAfterSubmitting.bandScore.toString());

                var x = document.getElementById('circlechart');
                x.setAttribute("data-percentage", vm.percentageAfterSubmit.toString());
                $('.circlechart').circlechart(vm.textBandScore);
                blockUI.stop();
                if (completed) { completed(data1); }
            }, function failure() {
                blockUI.stop();
                if (completed) { completed(null); }
                toastr.error('An error occurred while loading the test result.', 'Notification');
            });
        }

        vm.isRetryingWritingGrade = false;
        vm.canRetryWritingGrade = function (result) {
            if (!vm.isWritingRoute || !result || !result.id) { return false; }
            return ['FAILED', 'NOT_CONFIGURED', 'PENDING', 'PROCESSING']
                .indexOf(result.aiGradingStatus) >= 0;
        };

        vm.retryWritingGrade = function () {
            var result = vm.testResultAfterSubmitting;
            if (vm.isRetryingWritingGrade || !vm.canRetryWritingGrade(result)) { return; }
            vm.isRetryingWritingGrade = true;
            service.gradeWritingTestResult(result.id).then(function () {
                showSubmittedTestResult(result.id, function (reloadedResult) {
                    vm.isRetryingWritingGrade = false;
                    if (!reloadedResult) { return; }
                    if (reloadedResult.aiGradingStatus === 'COMPLETED') {
                        toastr.success('Bài Writing đã được chấm lại bằng GPT.', 'Thông báo');
                    } else {
                        toastr.warning((reloadedResult && reloadedResult.aiGradingError)
                            || 'Chưa thể chấm lại bài Writing. Vui lòng thử lại sau.', 'Thông báo');
                    }
                });
            }, function () {
                vm.isRetryingWritingGrade = false;
                toastr.error('Không thể gửi lại bài Writing để chấm.', 'Thông báo');
            });
        };

        vm.saveTestResult = function () {
            if (vm.isSubmittingTest || readingDraftSubmitted || vm.isPreviewMode || vm.isLearningReview) { return; }
            synchronizeReadingResultsBeforeSubmit();
            // Capture the last keystrokes before submission as well. This is
            // especially important for a Writing task that does not yet meet
            // its word target and therefore remains available for another try.
            saveReadingDraft();
            syncTimerForPersistence();
            var activeDurationSeconds = getActiveDurationSeconds();
            vm.testResult.testTime = formatTimerClock(vm.testSessionMode === 'STUDY'
                ? activeDurationSeconds : Math.max(0, Number($scope.counter) || 0));
            vm.testResult.ieltsSessionMode = vm.testSessionMode;
            vm.testResult.activeDurationSeconds = activeDurationSeconds;
            vm.testResult.ieltsLearningState = JSON.stringify(buildIeltsLearningState());
            var passage1 = document.getElementById('passage-text-1').innerHTML;
            var passage2 = document.getElementById('passage-text-2').innerHTML;
            var passage3 = document.getElementById('passage-text-3').innerHTML;

            vm.testResult.testTakerPerformance = vm.isFlexibleRoute ? passage1 :
                "<h2>Passage 1</h2>" + passage1
                + "<br><br><h2>Passage 2</h2>" + passage2
                + "<br><br><h2>Passage 3</h2>" + passage3;

            // vm.testResult.testTakerPerformance = all;

            vm.testResult.testName = vm.ieltsReadingActualTest.title;
			var writingWordTotal = 0;
			angular.forEach(getWritingTaskPackages(), function (writingTaskPackage) {
				var writingTaskAnswer = writingTaskPackage.subQuestions && writingTaskPackage.subQuestions[0] &&
					writingTaskPackage.subQuestions[0].questionAnswers && writingTaskPackage.subQuestions[0].questionAnswers[0];
				writingWordTotal += vm.countWritingTaskWords(writingTaskAnswer && writingTaskAnswer.clientAnswer);
			});
			if (getWritingTaskPackages().length) { vm.testResult.numberOfWords = writingWordTotal; }
			vm.testResult.sourceQuestionId = Number($stateParams.ieltsReadingTestId);
			if (vm.isPartAssignment) {
				var allowedOrdinals = assignedPartQuestionOrdinals();
				if (!allowedOrdinals.length) {
					toastr.error('The assigned part has no questions to submit.', 'Unable to finish');
					return;
				}
				var allowed = {};
				angular.forEach(allowedOrdinals, function (ordinal) { allowed[String(ordinal)] = true; });
				vm.testResult.questionAnswerTestResult = (vm.testResult.questionAnswerTestResult || []).filter(function (answer) {
					return allowed[String(answer.ordinalNumber)] === true;
				});
                vm.testResult.completedPart = vm.assignedParts.length === 1 ? vm.assignedPart : null;
                vm.testResult.completedParts = angular.copy(vm.assignedParts);
				vm.testResult.assignmentTaskId = vm.assignmentTaskId;
                var assignedLabel = vm.assignedPartsLabel();
				vm.testResult.testName += ' · ' + assignedLabel;
                vm.testResult.testTakerPerformance = vm.isWritingRoute ? '<h2>' + assignedLabel + '</h2>' + passage1 :
                    vm.assignedParts.filter(function (part, index, parts) {
                        return !vm.isListeningRoute || part !== 4 || parts.indexOf(3) < 0;
                    }).map(function (part) {
                        var workspace = vm.isListeningRoute ? Math.min(part, 3) : part;
                        var label = vm.isListeningRoute && part === 3 && vm.assignedParts.indexOf(4) >= 0 ? 'Part 3, 4' : 'Part ' + part;
                        return '<h2>' + label + '</h2>' + ([passage1, passage2, passage3][workspace - 1] || '');
                    }).join('<br><br>');
				vm.resultQuestionTotal = allowedOrdinals.length || 1;
			}


            vm.testResult.testType = vm.isComprehensiveRoute ? 6 : (vm.isWritingRoute ? 7 : 4);
            if(!vm.isFlexibleRoute && vm.ieltsReadingActualTest.pronounce != null && vm.ieltsReadingActualTest.pronounce.length > 0 && angular.isDefined(vm.ieltsReadingActualTest.pronounce)){
                vm.testResult.testType = 2; //ielts lis
            }else if (!vm.isFlexibleRoute) {
                vm.testResult.testType = 4; // ielts read
            }

            blockUI.start();
            vm.isSubmittingTest = true;
            service.saveTestResult(vm.testResult).then(function (data) {
                vm.isSubmittingTest = false;
                readingDraftSubmitted = true;
                var keepFailedAssignmentDraft = vm.assignmentTaskId && data && data.resultStatus === 'FAILED';
                if ((!vm.isFlexibleRoute || !data || data.resultStatus !== 'FAILED') && !keepFailedAssignmentDraft) {
                    markStudyDraftCompleted(data && data.id);
                }
                if (vm.testSessionMode !== 'STUDY' && !keepFailedAssignmentDraft) {
                    clearReadingDraft();
                }
                $timeout.cancel(readingDraftAutosaveTimer);

                if (vm.isWritingRoute) {
                    service.gradeWritingTestResult(data.id).then(function (gradedResult) {
                        showSubmittedTestResult((gradedResult && gradedResult.id) || data.id);
                    }, function () {
                        // The submission has already been saved. Loading it here keeps
                        // Finish reliable even when the grading provider is unavailable.
                        showSubmittedTestResult(data.id);
                    });
                } else {
                    showSubmittedTestResult(data.id);
                }
            }, function failure() {
                vm.isSubmittingTest = false;
                blockUI.stop();
                toastr.error('An error occurred while saving the test result.', 'Notification');
            });
        };

        vm.isShowDetail = false;
        vm.showDetailTestAfterSubmit = function () {
          if(vm.isShowDetail) {
              vm.isShowDetail = false;
          } else{
              vm.isShowDetail = true;
          }
        };

        //--------------------- Reading Actual test -------------------------//
        var mainAudio = null;

        function getMainAudio() {
            mainAudio = document.getElementById('main-audio');
            return mainAudio;
        }

        function stripEmbeddedReadingIntro(passage) {
            if (vm.isListeningRoute || !passage || !passage.question) {
                return;
            }

            var container = document.createElement('div');
            container.innerHTML = String(passage.question);
            var nodes = container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div');
            angular.forEach(nodes, function (node) {
                var text = String(node.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (/^READING\s+PASSAGE\s+[123]$/i.test(text) ||
                    /^You\s+should\s+spend\s+about\s+20\s+minutes\s+on\s+Questions.+Reading\s+Passage.+below\.?$/i.test(text)) {
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            });
            passage.question = container.innerHTML;
        }


        function selectedListeningAudioUrl() {
            var mainAudioUrl = String(vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.pronounce || '').trim();
            var selectedPart = vm.isPartAssignment ? (vm.activeIeltsNavigationPart() || Number(vm.assignedPart))
                : (vm.isPreviewMode ? Number(vm.previewPart) : null);
            if (!selectedPart || !vm.listeningPartAudioUrls) {
                return mainAudioUrl;
            }
            return vm.listeningPartAudioUrls[selectedPart - 1] || mainAudioUrl;
        }

        vm.setUpAudio = function () {
            if (!vm.isListeningRoute) { return; }
            // The audio element is created by ng-if/ng-show after the test data
            // arrives, so resolve it after Angular has rendered the candidate view.
            $timeout(function () {
                var audioElement = getMainAudio();
                if (!audioElement) { return; }
                audioElement.src = selectedListeningAudioUrl();
                audioElement.loop = false;
                trackAudioDuration(audioElement);
                audioElement.load();
                var playPromise = audioElement.play();
                if (playPromise && angular.isFunction(playPromise.catch)) {
                    playPromise.catch(angular.noop);
                }
            }, 0);
        };

        vm.playbackValue = 1.0;

        vm.increaseSpeed = function () {
            if(vm.playbackValue >= 4){
                return;
            }

            vm.playbackValue = vm.playbackValue + 0.1;

            var audioElement = getMainAudio();
            if (audioElement) { audioElement.playbackRate = vm.playbackValue; }
            // loadVideoYouTube.playbackRate  = vm.playbackValue;
            // loadVideo.playbackRate  = vm.playbackValue;
        };

        vm.decreaseSpeed = function () {
            if(vm.playbackValue <= 0.6){
                return;
            }

            vm.playbackValue = vm.playbackValue - 0.1;

            var audioElement = getMainAudio();
            if (audioElement) { audioElement.playbackRate = vm.playbackValue; }
            // loadVideoYouTube.playbackRate  = vm.playbackValue;
            // loadVideo.playbackRate  = vm.playbackValue;
        };

        $scope.counter = 3600;
        $scope.minuteDisplay = 60;
        $scope.secondDisplay = 0;

        vm.totalAudioSeconds = 0;
        var mytimeout = null; // the current timeoutID
        var countdownEndsAt = null;
        var seriousTotalSeconds = 3600;
        var studyElapsedSeconds = 0;
        var studyActiveSince = null;
        var timerRestoredFromDraft = false;
        var audio = document.getElementById("audio1");
        
        vm.showAudioListening = vm.isListeningRoute && vm.testSessionMode === 'STUDY';
        vm.showAudio = vm.showAudioListening;


        function updateCountdownDisplay() {
            $scope.minuteDisplay = parseInt($scope.counter / 60, 10);
            $scope.secondDisplay = $scope.counter % 60;
        }

        function setCountdownSeconds(seconds) {
            $scope.counter = Math.max(0, Math.ceil(Number(seconds) || 0));
            countdownEndsAt = Date.now() + ($scope.counter * 1000);
            updateCountdownDisplay();
        }

        vm.isStudyMode = function () {
            return vm.testSessionMode === 'STUDY';
        };

        function currentStudyElapsedSeconds() {
            var elapsed = studyElapsedSeconds;
            if (studyActiveSince !== null && vm.isStartTest === true) {
                elapsed += Math.max(0, Math.floor((Date.now() - studyActiveSince) / 1000));
            }
            return Math.max(0, elapsed);
        }

        function updateStudyDisplay() {
            $scope.counter = currentStudyElapsedSeconds();
            updateCountdownDisplay();
        }

        function pauseStudyTimer() {
            if (studyActiveSince !== null) {
                studyElapsedSeconds = currentStudyElapsedSeconds();
                studyActiveSince = null;
            }
            updateStudyDisplay();
        }

        function resumeStudyTimer() {
            if (vm.isStudyMode() && vm.isStartTest === true && !$window.document.hidden && studyActiveSince === null) {
                studyActiveSince = Date.now();
            }
            updateStudyDisplay();
        }

        function setStudyElapsedSeconds(seconds) {
            studyElapsedSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
            studyActiveSince = null;
            resumeStudyTimer();
        }

        function syncCountdownFromDeadline() {
            if (countdownEndsAt === null) {
                return;
            }
            $scope.counter = Math.max(
                0,
                Math.ceil((countdownEndsAt - Date.now()) / 1000)
            );
            updateCountdownDisplay();
        }

        function syncTimerForPersistence() {
            if (vm.isStudyMode()) {
                pauseStudyTimer();
                resumeStudyTimer();
            } else {
                syncCountdownFromDeadline();
            }
        }

        function getActiveDurationSeconds() {
            if (vm.isStudyMode()) {
                return currentStudyElapsedSeconds();
            }
            syncCountdownFromDeadline();
            return Math.max(0, seriousTotalSeconds - Math.max(0, Number($scope.counter) || 0));
        }

        function formatTimerClock(totalSeconds) {
            totalSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
            var minutes = Math.floor(totalSeconds / 60);
            var seconds = totalSeconds % 60;
            return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        }

        // Browser background tabs throttle JavaScript timers. Derive the
        // remaining time from an absolute deadline instead of counter-- so the
        // exam clock stays correct after switching tabs or locking the screen.
        $scope.onTimeout = function() {
            if (vm.isStudyMode()) {
                updateStudyDisplay();
                mytimeout = $timeout($scope.onTimeout, 1000);
                return;
            }
            syncCountdownFromDeadline();
            if($scope.counter <= 0) {
                countdownEndsAt = null;
                vm.saveTestResult();
                var finishedAudio = getMainAudio();
                if (finishedAudio) { finishedAudio.load(); }
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        $scope.startCount = function() {
            $scope.refreshTimer();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            // audio.load();
        };

        function trackAudioDuration(audioElement) {
            if (!vm.isListeningRoute || !audioElement) { return; }
            audioElement.onloadedmetadata = function() {
                vm.totalAudioSeconds = audioElement.duration;
                if (vm.totalAudioSeconds > 0) {
                    seriousTotalSeconds = Math.max(parseInt(vm.totalAudioSeconds, 10) + 60,
                        Number($scope.counter) || 0);
                    if (!timerRestoredFromDraft) { setCountdownSeconds(seriousTotalSeconds); }
                    $scope.$evalAsync();
                }
            };
            if (isFinite(audioElement.duration) && audioElement.duration > 0) {
                vm.totalAudioSeconds = audioElement.duration;
                seriousTotalSeconds = Math.max(parseInt(vm.totalAudioSeconds, 10) + 60,
                    Number($scope.counter) || 0);
                if (!timerRestoredFromDraft) { setCountdownSeconds(seriousTotalSeconds); }
            }
        }

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            if (vm.isStudyMode()) {
                countdownEndsAt = null;
                setStudyElapsedSeconds(0);
                return;
            }
            seriousTotalSeconds = 3600;
            setCountdownSeconds(3600);
            vm.totalAudioSeconds = 0;
            trackAudioDuration(getMainAudio());
        };

        function syncTimerWhenVisible() {
            if ($window.document.hidden) {
                if (vm.isStudyMode()) {
                    pauseStudyTimer();
                }
                saveReadingDraft();
            } else if (vm.isStudyMode()) {
                $scope.$evalAsync(resumeStudyTimer);
            } else {
                $scope.$evalAsync(syncCountdownFromDeadline);
            }
        }

        $window.document.addEventListener('visibilitychange', syncTimerWhenVisible);
        $scope.$on('$destroy', function () {
            $timeout.cancel(mytimeout);
            $window.document.removeEventListener('visibilitychange', syncTimerWhenVisible);
        });

        // $scope.startCount();

        vm.passageNumber = 1;
        vm.displayAllTimer = false;

        vm.tempBeforeQuestion = {};
        vm.tempQuestion = {};
        vm.tempAfterQuestion = {};
        vm.tempOrdinalNumber = {};
        vm.tempPackages = [];

        vm.displayTimer = function () {
            vm.displayAllTimer = true;
        };

        vm.displayOnlyMinute = function () {
            vm.displayAllTimer = false;
        };

        vm.toggleTimerDetails = function () {
            vm.displayAllTimer = !vm.displayAllTimer;
        };

        vm.getRemainingMinutes = function () {
            if (vm.isStudyMode()) {
                return Math.max(0, Math.floor(currentStudyElapsedSeconds() / 60));
            }
            return Math.max(0, Math.ceil(Number($scope.counter || 0) / 60));
        };

        vm.getRemainingClock = function () {
            if (vm.isStudyMode()) {
                return formatTimerClock(currentStudyElapsedSeconds());
            }
            var minutes = Math.max(0, Number($scope.minuteDisplay || 0));
            var seconds = Math.max(0, Number($scope.secondDisplay || 0));
            return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        };

        vm.getTimerStatusLabel = function () {
            return vm.isStudyMode() ? 'studied' : 'remaining';
        };

        vm.ieltsReadingActualTest = {};


        vm.questionsForType5 = [];
        vm.clickShowChildren = function(question,questions){

            vm.questionsForType5 = questions;
            // console.log('here');
            vm.tempQuestion = question;
            // vm.tempBeforeQuestion = beforeQuestion;
            // vm.tempAfterQuestion = afterQuestion;
            angular.forEach((vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.subQuestions) || [], function (passage) {
                angular.forEach((passage && passage.subQuestions) || [], function (questionPackage) {
                    angular.forEach((questionPackage && questionPackage.subQuestions) || [], function (childQuestion) {
                        childQuestion.showChildren = false;
                    });
                });
            });

            if(question.parent && question.parent.type == 5){
                // console.log("type = 5 here");
                // console.log(questions);

                for(var i = 0; i < questions.length; i++){
                    questions[i].showChildren = true;
                }
            } else{
                question.showChildren = true;
            }
        };

        vm.autoScrollToView = function (ordinalNumber) {

            vm.tempOrdinalNumber = ordinalNumber;
            var elmnt = document.getElementById('question-number-'+ordinalNumber) ||
                document.getElementById('text-question-number-'+ordinalNumber);
            if(elmnt != null){
                elmnt.scrollIntoView({
                    behavior: 'auto',
                    block: 'center',
                    inline: 'center'
                });
            } 


        };

        vm.autoFocusOnText = function (ordinalNumber) {
            // console.log('here');
            vm.tempOrdinalNumber = ordinalNumber;
            // var elmnt1 = document.getElementById('question-number-'+ordinalNumber);
            // elmnt1.scrollIntoView();

            var elmnt2 = document.getElementById('text-question-number-'+ordinalNumber);
            if (!elmnt2) {
                var listeningSection = document.getElementById('question-number-' + ordinalNumber);
                elmnt2 = listeningSection && listeningSection.querySelector('.listening-gap-input');
            }
            if(elmnt2 != null){
                elmnt2.focus();
                elmnt2.focus();
                // elmnt2.placeholder="";
                // elmnt2.appendChild(input);
            }
        };        

        vm.tempPassage = 1;
        vm.changePassage = function (items) {
            vm.tempPackages = items;
            if(items!= null && items.length > 0 && items[0] != null){
                if(items[0].parent != null){
                    if(items[0].parent.questionType != null){
						var requestedPart = items[0].parent.questionType.code == "IELTSRTP1" ? 1
							: items[0].parent.questionType.code == "IELTSRTP2" ? 2
							: items[0].parent.questionType.code == "IELTSRTP3" ? 3 : null;
                        if (vm.isPartAssignment && !vm.assignedParts.some(function (part) {
                            return (vm.isWritingRoute ? 1 : (vm.isListeningRoute ? Math.min(part, 3) : part)) === requestedPart;
                        })) { return; }
                        if(items[0].parent.questionType.code == "IELTSRTP1"){
                            vm.passageNumber = 1;
                        }
                        if(items[0].parent.questionType.code == "IELTSRTP2"){
                            vm.passageNumber = 2;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage2 = document.getElementById('passage-number-2');
                            //     passage2.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }

                        }
                        if(items[0].parent.questionType.code == "IELTSRTP3"){
                            vm.passageNumber = 3;
                            // if(vm.tempPassage != vm.passageNumber){
                            //     var passage3 = document.getElementById('passage-number-3');
                            //     passage3.scrollIntoView(true);
                            //     vm.tempPassage = vm.passageNumber;
                            // }
                        }
                    }
                }
            }
        };

        function listeningPartNumberForOrdinal(ordinalNumber) {
            var ordinal = Number(ordinalNumber);
            return ordinal >= 1 && ordinal <= 40 ? Math.ceil(ordinal / 10) : null;
        }

        function displayPassageForAssignedPart() {
            if (!vm.isPartAssignment) { return vm.passageNumber || 1; }
            if (vm.isWritingRoute) { return 1; }
            return vm.isListeningRoute ? Math.min(vm.assignedPart, 3) : vm.assignedPart;
        }

        function getAllReadingQuestionEntries() {
            var entries = [];
            var passages = vm.ieltsReadingActualTest && vm.ieltsReadingActualTest.subQuestions;

            angular.forEach(passages || [], function (passage, passageIndex) {
                angular.forEach(passage.subQuestions || [], function (questionPackage) {
                    angular.forEach(questionPackage.subQuestions || [], function (question) {
                        entries.push({
                            question: question,
                            questionPackage: questionPackage,
                            packageType: questionPackage.type,
                            packageQuestions: questionPackage.subQuestions,
                            passageQuestions: passage.subQuestions,
                            passageNumber: passageIndex + 1
                        });
                    });
                });
            });

            entries.sort(function (left, right) {
                return Number(left.question.ordinalNumber) - Number(right.question.ordinalNumber);
            });
            return entries;
        }

        function getReadingQuestionEntries() {
            var entries = getAllReadingQuestionEntries();
            if (!vm.isPartAssignment) { return entries; }

            return entries.filter(function (entry) {
                if (vm.isWritingRoute) {
                    return vm.assignedParts.indexOf(Number(entry.packageType) === 17 ? 2 : 1) >= 0;
                }
                return vm.assignedParts.indexOf(vm.isListeningRoute
                    ? listeningPartNumberForOrdinal(entry.question.ordinalNumber) : entry.passageNumber) >= 0;
            });
        }

        function assignedPartQuestionOrdinals() {
            if (!vm.isPartAssignment) { return []; }
            return getReadingQuestionEntries().map(function (entry) {
                return entry.question.ordinalNumber;
            });
        }

        var cachedIeltsNavigationParts = null;

        vm.getIeltsNavigationParts = function () {
            if (cachedIeltsNavigationParts) {
                return cachedIeltsNavigationParts;
            }
            var parts = [];
            var partByNumber = {};
            angular.forEach(getReadingDraftPartNumbers(), function (number) {
                var part = {number: number, questions: []};
                parts.push(part);
                partByNumber[number] = part;
            });

            angular.forEach(getReadingQuestionEntries(), function (entry) {
                var partNumber = vm.isWritingRoute ? (Number(entry.packageType) === 17 ? 2 : 1)
                    : (vm.isListeningRoute ? listeningPartNumberForOrdinal(entry.question.ordinalNumber) : entry.passageNumber);
                if (partByNumber[partNumber]) {
                    partByNumber[partNumber].questions.push(entry);
                }
            });
            cachedIeltsNavigationParts = parts;
            return cachedIeltsNavigationParts;
        };

        vm.activeIeltsNavigationPart = function () {
            if (vm.isWritingRoute) {
                var requestedWritingPart = vm.tempQuestion && vm.tempQuestion.parent
                    ? (Number(vm.tempQuestion.parent.type) === 17 ? 2 : 1) : (vm.assignedPart || 1);
                var writingParts = vm.getIeltsNavigationParts();
                var writingPartExists = writingParts.some(function (part) {
                    return Number(part.number) === Number(requestedWritingPart);
                });
                return writingPartExists ? Number(requestedWritingPart) :
                    (writingParts.length ? Number(writingParts[0].number) : Number(requestedWritingPart));
            }
            if (vm.isListeningRoute) {
                var currentPart = listeningPartNumberForOrdinal(vm.tempQuestion && vm.tempQuestion.ordinalNumber);
                return currentPart || vm.assignedPart || Math.min(vm.passageNumber || 1, 4);
            }
            return vm.passageNumber || vm.assignedPart;
        };

        vm.ieltsNavigationAnsweredCount = function (part) {
            var answered = 0;
            angular.forEach((part && part.questions) || [], function (entry) {
                if (entry.question && entry.question.answered === true) { answered++; }
            });
            return answered;
        };

        vm.openIeltsNavigationPart = function (part) {
            if (part && part.questions && part.questions.length) {
                var entry = part.questions[0];
                vm.openReadingQuestion(entry.question, entry.packageQuestions, entry.passageQuestions);
                if (vm.isWritingRoute) {
                    $timeout(function () {
                        var taskScreen = document.getElementById('writing-task-screen-' + part.number);
                        if (taskScreen) { taskScreen.scrollIntoView({behavior: 'smooth', block: 'start'}); }
                    }, 0);
                }
            }
        };

        function synchronizeReadingResultsBeforeSubmit() {
            var results = vm.testResult.questionAnswerTestResult || [];
            var entries = getReadingQuestionEntries();

            angular.forEach(entries, function (entry) {
                var question = entry.question || {};
                var questionAnswers = question.questionAnswers || [];
                var type = Number(entry.packageType);
                if (type === 18 && listening.isRuntime(entry.questionPackage) && !questionAnswers[0].clientAnswer) {
                    questionAnswers[0].clientAnswer = listening.serialize(listening.start(entry.questionPackage.motherTongue));
                }
                var existingResults = [];

                angular.forEach(results, function (result) {
                    var resultQuestion = result.questionAnswer && result.questionAnswer.question;
                    if ((question.id != null && resultQuestion && resultQuestion.id == question.id) ||
                        (question.ordinalNumber != null && result.ordinalNumber == question.ordinalNumber)) {
                        existingResults.push(result);
                    }
                });

                var representativeAnswer = null;
                var submittedAnswer = '';

                if (type == 2 || type == 3 || type == 11 || type == 18 || type == 16 || type == 17) {
                    representativeAnswer = questionAnswers.length ? questionAnswers[0] : null;
                    submittedAnswer = representativeAnswer && representativeAnswer.clientAnswer != null ?
                        String(representativeAnswer.clientAnswer).trim() : '';
                } else {
                    angular.forEach(questionAnswers, function (questionAnswer) {
                        if (!representativeAnswer && questionAnswer && questionAnswer.selected === true) {
                            representativeAnswer = questionAnswer;
                        }
                    });
                    if (!representativeAnswer && existingResults.length && existingResults[0].questionAnswer) {
                        representativeAnswer = existingResults[0].questionAnswer;
                    }
                    if (!representativeAnswer && questionAnswers.length) {
                        representativeAnswer = questionAnswers[0];
                    }
                    if (representativeAnswer && representativeAnswer.selected === true &&
                        representativeAnswer.answer && representativeAnswer.answer.answer != null) {
                        submittedAnswer = String(representativeAnswer.answer.answer).trim();
                    }
                }

                // A saved result needs a QuestionAnswer id. If a question has no
                // configured answer, it cannot be represented by the current DTO.
                if (!representativeAnswer || representativeAnswer.id == null) {
                    return;
                }

                if (existingResults.length) {
                    angular.forEach(existingResults, function (existingResult) {
                        if (!existingResult.questionAnswer || existingResult.questionAnswer.id == null) {
                            existingResult.questionAnswer = representativeAnswer;
                        }
                        if (submittedAnswer && (type == 2 || type == 3 || type == 11 || type == 18 || type == 16 || type == 17 ||
                            !existingResult.clientAnswer)) {
                            existingResult.questionAnswer = representativeAnswer;
                            existingResult.clientAnswer = submittedAnswer;
                        }
                    });
                    return;
                }

                results.push({
                    questionAnswer: representativeAnswer,
                    ordinalNumber: question.ordinalNumber,
                    clientAnswer: submittedAnswer
                });
            });

            results.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            vm.testResult.questionAnswerTestResult = results;
        }

        function cleanStudyAnswerText(value) {
            return String(value == null ? '' : value)
                .replace(/<br\s*\/?\s*>/gi, ' / ')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function formatStudyQuestionPrompt(value) {
            return String(value == null ? '' : value)
                .replace(/(?:\{\{|\}\{|\{)ENTER(?:\}\}|\}\{|\})/gi, '\n')
                .replace(/(?:\{\{|\}\{|\{)(?:SPACE|HEADING)(?:\}\}|\}\{|\})/gi, ' _____ ')
                .replace(/<br\s*\/?\s*>/gi, '\n')
                .replace(/<li[^>]*>/gi, '• ')
                .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/[ \t]+/g, ' ')
                .replace(/ *\n */g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        function studyAnswerValue(questionAnswer) {
            return cleanStudyAnswerText(questionAnswer && questionAnswer.answer &&
                questionAnswer.answer.answer != null ? questionAnswer.answer.answer : '');
        }

        function uniqueStudyAnswers(values) {
            var unique = [];
            angular.forEach(values || [], function (value) {
                var cleaned = cleanStudyAnswerText(value);
                if (cleaned && unique.indexOf(cleaned) < 0) {
                    unique.push(cleaned);
                }
            });
            return unique;
        }

        function studyCorrectAnswers(entry, result) {
            var type = Number(entry.packageType);
            var sourceQuestion = entry.question;
            if ((type == 5 || type == 7) && entry.questionPackage &&
                entry.questionPackage.subQuestions && entry.questionPackage.subQuestions.length) {
                sourceQuestion = entry.questionPackage.subQuestions[0];
            }
            var questionAnswers = (sourceQuestion && sourceQuestion.questionAnswers) || [];
            var correctAnswers = [];

            angular.forEach(questionAnswers, function (questionAnswer) {
                if (questionAnswer && questionAnswer.correct === true) {
                    correctAnswers.push(studyAnswerValue(questionAnswer));
                }
            });

            if (!correctAnswers.length) {
                angular.forEach(questionAnswers, function (questionAnswer) {
                    if (questionAnswer && questionAnswer.correctAnswer) {
                        correctAnswers.push(questionAnswer.correctAnswer);
                    }
                });
            }

            if (!correctAnswers.length && result && result.questionAnswer) {
                if (result.questionAnswer.correctAnswer) {
                    correctAnswers.push(result.questionAnswer.correctAnswer);
                } else if (result.correctAnswerForMultipleAnswer) {
                    correctAnswers.push(result.correctAnswerForMultipleAnswer);
                }
            }

            return uniqueStudyAnswers(correctAnswers);
        }

        function isStudyAnswerCorrect(entry, result, submittedAnswer, correctAnswers) {
            var type = Number(entry.packageType);
            var selectedAnswer = result && result.questionAnswer;
            var normalizedSubmitted = cleanStudyAnswerText(submittedAnswer);

            if (type === 18 && listening.isRuntime(entry.questionPackage)) {
                return listening.start(entry.questionPackage.motherTongue, result && result.clientAnswer).passed;
            }

            if (!normalizedSubmitted) { return false; }

            if (type == 2 || type == 3 || type == 11 || type == 18) {
                var acceptedAnswers = [];
                angular.forEach(correctAnswers || [], function (answer) {
                    angular.forEach(String(answer || '').split('/'), function (alternative) {
                        var normalizedAlternative = cleanStudyAnswerText(alternative).toLowerCase();
                        if (normalizedAlternative) { acceptedAnswers.push(normalizedAlternative); }
                    });
                });
                return acceptedAnswers.indexOf(normalizedSubmitted.toLowerCase()) >= 0;
            }

            // Matching Headings and Matching Features are persisted as the
            // selected answer text. Mirror the server's exact comparison.
            if (type == 4 || type == 8) {
                return !!selectedAnswer && normalizedSubmitted === studyAnswerValue(selectedAnswer);
            }

            if (selectedAnswer && selectedAnswer.correct === true) {
                return true;
            }

            return (correctAnswers || []).some(function (answer) {
                return cleanStudyAnswerText(answer).toLowerCase() === normalizedSubmitted.toLowerCase();
            });
        }

        function studyResultForEntry(entry, results) {
            var question = entry.question || {};
            var matched = null;
            angular.forEach(results || [], function (result) {
                if (matched) { return; }
                var resultQuestion = result && result.questionAnswer && result.questionAnswer.question;
                if ((question.id != null && resultQuestion && String(resultQuestion.id) === String(question.id)) ||
                    (question.ordinalNumber != null && result &&
                        String(result.ordinalNumber) === String(question.ordinalNumber))) {
                    matched = result;
                }
            });
            return matched;
        }

        vm.openStudyAnswerCheck = function () {
            if (vm.testSessionMode !== 'STUDY' || vm.isWritingRoute || vm.isPreviewMode || vm.isStartTest !== true) {
                return;
            }

            synchronizeReadingResultsBeforeSubmit();
            var results = vm.testResult.questionAnswerTestResult || [];
            var summary = {
                rows: [],
                total: 0,
                answered: 0,
                correct: 0,
                incorrect: 0,
                unanswered: 0
            };

            angular.forEach(getReadingQuestionEntries(), function (entry) {
                var result = studyResultForEntry(entry, results);
                var submittedAnswer = cleanStudyAnswerText(result && result.clientAnswer);
                var correctAnswers = studyCorrectAnswers(entry, result);
                if (Number(entry.packageType) === 18 && listening.isRuntime(entry.questionPackage)) {
                    var listeningSession = listening.start(entry.questionPackage.motherTongue, result && result.clientAnswer);
                    submittedAnswer = listeningSession.correct + '/' + listeningSession.total + ' ô đúng (' + listeningSession.percent + '%)';
                    correctAnswers = ['Đúng từ 90% tổng số ô trống'];
                }
                var status = 'unanswered';

                if (submittedAnswer) {
                    status = isStudyAnswerCorrect(entry, result, submittedAnswer, correctAnswers) ? 'correct' : 'incorrect';
                    summary.answered++;
                    summary[status]++;
                } else {
                    summary.unanswered++;
                }

                summary.rows.push({
                    ordinalNumber: entry.question && entry.question.ordinalNumber,
                    prompt: formatStudyQuestionPrompt(entry.question && entry.question.question),
                    studentAnswer: submittedAnswer || 'Chưa chọn đáp án',
                    correctAnswer: correctAnswers.length ? correctAnswers.join(' / ') : 'Chưa có dữ liệu đáp án',
                    status: status,
                    question: entry.question,
                    packageQuestions: entry.packageQuestions,
                    passageQuestions: entry.passageQuestions
                });
                summary.total++;
            });

            vm.studyAnswerCheck = summary;
            vm.showStudyAnswerCheck = true;
        };

        vm.closeStudyAnswerCheck = function () {
            vm.showStudyAnswerCheck = false;
        };

        vm.openStudyAnswerQuestion = function (row) {
            if (!row || !row.question) { return; }
            vm.closeStudyAnswerCheck();
            vm.openReadingQuestion(row.question, row.packageQuestions, row.passageQuestions);
        };

        function getCurrentReadingQuestionIndex(entries) {
            var currentOrdinalNumber = vm.tempQuestion && vm.tempQuestion.ordinalNumber;

            for (var i = 0; i < entries.length; i++) {
                if (entries[i].question === vm.tempQuestion ||
                    (currentOrdinalNumber != null && entries[i].question.ordinalNumber == currentOrdinalNumber)) {
                    return i;
                }
            }

            for (var j = 0; j < entries.length; j++) {
                if (entries[j].question.showChildren === true) {
                    return j;
                }
            }

            return entries.length ? 0 : -1;
        }

        vm.openReadingQuestion = function (question, packageQuestions, passageQuestions) {
            if (!question) {
                return;
            }

            vm.changePassage(passageQuestions);
            vm.clickShowChildren(question, packageQuestions);

            $timeout(function () {
                vm.autoScrollToView(question.ordinalNumber);
                vm.autoFocusOnText(question.ordinalNumber);
            }, 0);
        };

        vm.canNavigateReadingQuestion = function (step) {
            if (vm.isWritingRoute) {
                var writingParts = vm.getIeltsNavigationParts();
                var activeWritingPart = Number(vm.activeIeltsNavigationPart());
                var activeWritingIndex = -1;
                angular.forEach(writingParts, function (part, index) {
                    if (Number(part.number) === activeWritingPart) { activeWritingIndex = index; }
                });
                var targetWritingIndex = activeWritingIndex + Number(step || 0);
                return activeWritingIndex >= 0 && targetWritingIndex >= 0 && targetWritingIndex < writingParts.length;
            }
            var entries = getReadingQuestionEntries();
            var currentIndex = getCurrentReadingQuestionIndex(entries);
            var targetIndex = currentIndex + Number(step || 0);

            return currentIndex >= 0 && targetIndex >= 0 && targetIndex < entries.length;
        };

        vm.navigateReadingQuestion = function (step) {
            if (vm.isWritingRoute) {
                var writingParts = vm.getIeltsNavigationParts();
                var activeWritingPart = Number(vm.activeIeltsNavigationPart());
                var activeWritingIndex = -1;
                angular.forEach(writingParts, function (part, index) {
                    if (Number(part.number) === activeWritingPart) { activeWritingIndex = index; }
                });
                var targetWritingIndex = activeWritingIndex + Number(step || 0);
                if (activeWritingIndex >= 0 && targetWritingIndex >= 0 && targetWritingIndex < writingParts.length) {
                    vm.openIeltsNavigationPart(writingParts[targetWritingIndex]);
                }
                return;
            }
            var entries = getReadingQuestionEntries();
            var currentIndex = getCurrentReadingQuestionIndex(entries);
            var targetIndex = currentIndex + Number(step || 0);

            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= entries.length) {
                return;
            }

            var target = entries[targetIndex];
            vm.openReadingQuestion(target.question, target.packageQuestions, target.passageQuestions);
        };

        vm.buttonBottomNextQuestion = function () {
            vm.changePassage(vm.tempPackages);
            // if(vm.tempOrdinalNumber > 0 || vm.tempOrdinalNumber < 40);{
            //     vm.tempOrdinalNumber = vm.tempOrdinalNumber + 1;
            // }
            vm.autoScrollToView(vm.tempOrdinalNumber);
            vm.clickShowChildren(vm.tempQuestion);
            vm.autoFocusOnText(vm.tempOrdinalNumber);
        };

        vm.A1 = [
        ];
        vm.B1= [];
        // $scope.models = {
        //     selected: null,
        //     lists: {
        //         "A1": [
        //             {label: ""},
        //             {content: "paragraph 1"}
        //         ]
        //         , "B1": [
        //
        //         ]
        //     }
        // };

        // Generate initial model
        // for (var i = 1; i <= 3; ++i) {
        //     $scope.models.lists.A.push({label: ""});
            // $scope.models.lists.B1.push({label: "Item B1" + i});
        // }

        function buildOneEditorQuestion(questionPackage) {
            var questions = questionPackage.subQuestions || [];
            questions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            var content = questions.length ? String(questions[0].question || '') : '';

            angular.forEach(questions, function (question, questionIndex) {
                var ordinalNumber = question.ordinalNumber;
                var answerExpression = 'item.subQuestions[' + questionIndex + '].questionAnswers[0]';
                var questionExpression = 'item.subQuestions[' + questionIndex + ']';
                var input = '<input autocomplete="off" type="text" ' +
                    'ng-click="vm.clickShowChildren(' + questionExpression + ',item.subQuestions)" ' +
                    'ng-change="vm.changeTextQuestionAnswer(' + answerExpression + ',' + answerExpression + '.answer.answer,' + questionExpression + ')" ' +
                    'ng-model="' + answerExpression + '.clientAnswer" ' +
                    'class="text-question-filling-root reading-one-editor-input" ' +
                    'id="text-question-number-' + ordinalNumber + '" placeholder="' + ordinalNumber + '">';
                content = content.replace(/\}\{SPACE\}\{/i, input);
            });

            questionPackage.oneEditorRenderedQuestion = content.replace(/\}\{ENTER\}\{/gi, '<br><br>');
        }

        function shuffleCompleteListWords(words) {
            var shuffled = words.slice();
            for (var index = shuffled.length - 1; index > 0; index--) {
                var randomIndex = Math.floor(Math.random() * (index + 1));
                var current = shuffled[index];
                shuffled[index] = shuffled[randomIndex];
                shuffled[randomIndex] = current;
            }
            return shuffled;
        }

        function buildCompleteListQuestion(questionPackage) {
            var questions = questionPackage.subQuestions || [];
            questions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });

            angular.forEach(questions, function (question) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.sort(function (left, right) {
                    return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
                });
            });
            var content = questions.length ? String(questions[0].question || '') : '';
            var sourceAnswers = questions.length ? questions[0].questionAnswers : [];
            questionPackage.completeListSlots = [];
            questionPackage.completeListReturnList = [];
            questionPackage.completeListSelectedWord = null;
            questionPackage.completeListWordBank = shuffleCompleteListWords(sourceAnswers.map(function (questionAnswer, answerIndex) {
                return {
                    answerIndex: answerIndex,
                    answerId: questionAnswer.id,
                    clientAnswer: questionAnswer.answer ? questionAnswer.answer.answer : ''
                };
            }));

            angular.forEach(questions, function (question, questionIndex) {
                questionPackage.completeListSlots.push({items: []});
                var ordinalNumber = question.ordinalNumber;
                var dropBox = '<span class="complete-list-drop-box" ' +
                    'id="question-number-' + ordinalNumber + '" ' +
                    'dnd-list="completeListPackage.completeListSlots[' + questionIndex + '].items" ' +
                    'dnd-drop="vm.dropCompleteListWord(completeListPackage,' + questionIndex + ',item)" ' +
                    'touch-dnd-drop="vm.dropCompleteListWord(completeListPackage,' + questionIndex + ',item)" ' +
                    'ng-click="vm.handleCompleteListSlotTap(completeListPackage,' + questionIndex + ',$event)" ' +
                    'ng-class="{\'is-tap-target\': completeListPackage.completeListSelectedWord, ' +
                    '\'is-filled\': completeListPackage.completeListSlots[' + questionIndex + '].items.length}">' +
                    '<span ng-if="!completeListPackage.completeListSlots[' + questionIndex + '].items.length" class="complete-list-drop-number">' + ordinalNumber + '</span>' +
                    '<span ng-if="completeListPackage.completeListSlots[' + questionIndex + '].items.length" ' +
                    'class="complete-list-slot-answer" ' +
                    'dnd-draggable="completeListPackage.completeListSlots[' + questionIndex + '].items[0]" ' +
                    'touch-dnd-source="completeListPackage.completeListSlots[' + questionIndex + '].items[0]" ' +
                    'double-tap="vm.clearCompleteListSlot(completeListPackage,' + questionIndex + ')" ' +
                    'dnd-effect-allowed="copy" ' +
                    'title="Nhấp hoặc chạm hai lần để bỏ đáp án">' +
                    '<span ng-bind="completeListPackage.completeListSlots[' + questionIndex + '].items[0].clientAnswer"></span>' +
                    '</span>' +
                    '</span>';
                content = content.replace(/\}\{SPACE\}\{/i, dropBox);
            });

            questionPackage.completeListRenderedQuestion = content.replace(/\}\{ENTER\}\{/gi, '<br><br>');
        }

        vm.isCompleteListWordUsed = function (questionPackage, word) {
            var used = false;
            var wordIdentity = word && word.answerId != null
                ? 'id:' + String(word.answerId)
                : 'index:' + String(word && word.answerIndex);
            angular.forEach((questionPackage && questionPackage.completeListSlots) || [], function (slot) {
                var slotWord = slot.items && slot.items.length ? slot.items[0] : null;
                var slotIdentity = slotWord && slotWord.answerId != null
                    ? 'id:' + String(slotWord.answerId)
                    : 'index:' + String(slotWord && slotWord.answerIndex);
                if (slotWord && slotIdentity === wordIdentity) {
                    used = true;
                }
            });
            return used;
        };

        function completeListWordIdentity(word) {
            if (!word) { return null; }
            return word.answerId != null
                ? 'id:' + String(word.answerId)
                : 'index:' + String(word.answerIndex);
        }

        vm.isCompleteListWordSelected = function (questionPackage, word) {
            return completeListWordIdentity(questionPackage && questionPackage.completeListSelectedWord) ===
                completeListWordIdentity(word);
        };

        vm.selectCompleteListWord = function (questionPackage, word, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!questionPackage || !word) { return; }

            if (vm.isCompleteListWordSelected(questionPackage, word)) {
                questionPackage.completeListSelectedWord = null;
                return;
            }
            questionPackage.completeListSelectedWord = angular.copy(word);
        };

        vm.handleCompleteListSlotTap = function (questionPackage, slotIndex, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!questionPackage) { return; }

            if (questionPackage.completeListSelectedWord) {
                vm.dropCompleteListWord(
                    questionPackage,
                    slotIndex,
                    questionPackage.completeListSelectedWord
                );
                questionPackage.completeListSelectedWord = null;
                return;
            }
        };

        function setCompleteListAnswer(question, questionAnswer, selected) {
            if (!question) { return; }
            angular.forEach(question.questionAnswers || [], function (answer) {
                answer.selected = selected === true && answer === questionAnswer;
            });
            question.answered = selected === true;
            vm.testResult.questionAnswerTestResult = (vm.testResult.questionAnswerTestResult || []).filter(function (result) {
                var resultAnswer = result && result.questionAnswer;
                var resultQuestion = resultAnswer && resultAnswer.question;
                return !((question.id != null && resultQuestion && String(resultQuestion.id) === String(question.id)) ||
                    Number(result && result.ordinalNumber) === Number(question.ordinalNumber));
            });
            if (selected === true && questionAnswer) {
                vm.testResult.questionAnswerTestResult.push({
                    questionAnswer: questionAnswer,
                    ordinalNumber: question.ordinalNumber,
                    clientAnswer: questionAnswer.answer && questionAnswer.answer.answer
                        ? questionAnswer.answer.answer : ''
                });
            }
        }

        vm.clearCompleteListSlot = function (questionPackage, slotIndex, skipDraftSave) {
            var slot = questionPackage && questionPackage.completeListSlots ? questionPackage.completeListSlots[slotIndex] : null;
            var question = questionPackage && questionPackage.subQuestions ? questionPackage.subQuestions[slotIndex] : null;
            if (!slot || !slot.items || !slot.items.length || !question) {
                return false;
            }
            var answerIndex = slot.items[0].answerIndex;
            var questionAnswer = (question.questionAnswers || [])[answerIndex];
            // Keep the same array reference used by dnd-list. Replacing it can
            // leave the drag directive attached to stale data and make × inert.
            slot.items.splice(0, slot.items.length);
            setCompleteListAnswer(question, questionAnswer, false);
            if (!skipDraftSave) {
                saveReadingDraft();
            }
            $scope.$evalAsync();
            return true;
        };

        vm.dropCompleteListWord = function (questionPackage, slotIndex, droppedWord, skipDraftSave) {
            if (!questionPackage || !droppedWord || !questionPackage.subQuestions || !questionPackage.completeListSlots) {
                return false;
            }

            angular.forEach(questionPackage.completeListSlots, function (slot, existingIndex) {
                var existingWord = slot.items && slot.items.length ? slot.items[0] : null;
                var sameWord = existingWord && (
                    (existingWord.answerId != null && droppedWord.answerId != null && String(existingWord.answerId) === String(droppedWord.answerId)) ||
                    (String(existingWord.answerIndex) === String(droppedWord.answerIndex))
                );
                if (existingIndex !== slotIndex && sameWord) {
                    vm.clearCompleteListSlot(questionPackage, existingIndex, true);
                }
            });
            vm.clearCompleteListSlot(questionPackage, slotIndex, true);

            var question = questionPackage.subQuestions[slotIndex];
            var questionAnswer = question && question.questionAnswers ? question.questionAnswers[droppedWord.answerIndex] : null;
            if (question && questionAnswer) {
                questionPackage.completeListSlots[slotIndex].items.push(angular.copy(droppedWord));
                setCompleteListAnswer(question, questionAnswer, true);
                vm.clickShowChildren(question, questionPackage.subQuestions);
            }
            questionPackage.completeListSelectedWord = null;
            if (!skipDraftSave) {
                saveReadingDraft();
            }
            $scope.$evalAsync();
            // Signal that the callback already updated dnd-list itself.
            return true;
        };

        vm.returnCompleteListWord = function (questionPackage, droppedWord) {
            if (!questionPackage || !droppedWord || !questionPackage.completeListSlots) {
                return true;
            }
            angular.forEach(questionPackage.completeListSlots, function (slot, slotIndex) {
                var existingWord = slot.items && slot.items.length ? slot.items[0] : null;
                var sameWord = existingWord && (
                    (existingWord.answerId != null && droppedWord.answerId != null && String(existingWord.answerId) === String(droppedWord.answerId)) ||
                    (String(existingWord.answerIndex) === String(droppedWord.answerIndex))
                );
                if (sameWord) {
                    vm.clearCompleteListSlot(questionPackage, slotIndex, true);
                }
            });
            questionPackage.completeListReturnList = [];
            saveReadingDraft();
            $scope.$evalAsync();
            return true;
        };

        function buildSentenceEndingQuestion(questionPackage) {
            var questions = questionPackage.subQuestions || [];
            questions.sort(function (left, right) {
                return Number(left.ordinalNumber) - Number(right.ordinalNumber);
            });
            angular.forEach(questions, function (question) {
                question.questionAnswers = question.questionAnswers || [];
                question.questionAnswers.sort(function (left, right) {
                    return Number(left.ordinalNumberQuestionAnswer) - Number(right.ordinalNumberQuestionAnswer);
                });
            });

            var sourceAnswers = questions.length ? questions[0].questionAnswers : [];
            questionPackage.sentenceEndingSlots = [];
            questionPackage.sentenceEndingBank = sourceAnswers.map(function (questionAnswer, answerIndex) {
                return {
                    answerIndex: answerIndex,
                    label: vm.matchingOptionLabel(answerIndex),
                    clientAnswer: questionAnswer.answer ? questionAnswer.answer.answer : ''
                };
            });
            angular.forEach(questions, function () {
                questionPackage.sentenceEndingSlots.push({items: []});
            });
        }

        vm.isSentenceEndingUsed = function (questionPackage, ending) {
            var used = false;
            angular.forEach((questionPackage && questionPackage.sentenceEndingSlots) || [], function (slot) {
                if (slot.items && slot.items.length && slot.items[0].answerIndex === ending.answerIndex) {
                    used = true;
                }
            });
            return used;
        };

        vm.clearSentenceEndingSlot = function (questionPackage, slotIndex) {
            var slot = questionPackage && questionPackage.sentenceEndingSlots ? questionPackage.sentenceEndingSlots[slotIndex] : null;
            var question = questionPackage && questionPackage.subQuestions ? questionPackage.subQuestions[slotIndex] : null;
            if (!slot || !slot.items || !slot.items.length || !question) {
                return;
            }
            var questionAnswer = (question.questionAnswers || [])[slot.items[0].answerIndex];
            if (questionAnswer) {
                vm.checkBoxMultipleChoiceQuestions(questionAnswer, question, false);
            }
            slot.items = [];
        };

        vm.dropSentenceEnding = function (questionPackage, slotIndex, droppedEnding) {
            if (!questionPackage || !droppedEnding || !questionPackage.subQuestions || !questionPackage.sentenceEndingSlots) {
                return false;
            }
            angular.forEach(questionPackage.sentenceEndingSlots, function (slot, existingIndex) {
                if (existingIndex !== slotIndex && slot.items && slot.items.length && slot.items[0].answerIndex === droppedEnding.answerIndex) {
                    vm.clearSentenceEndingSlot(questionPackage, existingIndex);
                }
            });
            vm.clearSentenceEndingSlot(questionPackage, slotIndex);

            var question = questionPackage.subQuestions[slotIndex];
            var questionAnswer = question && question.questionAnswers ? question.questionAnswers[droppedEnding.answerIndex] : null;
            if (question && questionAnswer) {
                questionPackage.sentenceEndingSlots[slotIndex].items = [angular.copy(droppedEnding)];
                vm.checkBoxMultipleChoiceQuestions(questionAnswer, question, true);
                vm.clickShowChildren(question, questionPackage.subQuestions);
            }
            $scope.$evalAsync();
            return true;
        };

        function actualHeadingLabel(question, fallbackIndex) {
            var text = String((question && question.question) || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            var match = text.match(/(?:section|paragraph|part)\s*([A-Z])/i);
            return match ? match[1].toUpperCase() : String.fromCharCode(65 + fallbackIndex);
        }

        function ensureActualHeadingPlaceholders(passage) {
            if (!passage || !passage.subQuestions || !passage.question) {
                return;
            }
            var matchingQuestions = [];
            angular.forEach(passage.subQuestions, function (questionPackage) {
                if (Number(questionPackage.type) === 4) {
                    angular.forEach(questionPackage.subQuestions || [], function (question) {
                        matchingQuestions.push(question);
                    });
                }
            });
            if (!matchingQuestions.length) {
                return;
            }

            var html = String(passage.question);
            var placeholderCount = (html.match(/\}\{\s*HEADING\s*\}\{/gi) || []).length;
            if (placeholderCount >= matchingQuestions.length) {
                return;
            }

            angular.forEach(matchingQuestions, function (question, index) {
                var label = actualHeadingLabel(question, index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                var marker = new RegExp(
                    '(<(?:p|h[1-6]|div)\\b[^>]*>\\s*(?:<(?:strong|b)\\b[^>]*>\\s*)?' + label +
                    '\\s*(?:</(?:strong|b)>\\s*)?)(\\s*</(?:p|h[1-6]|div)>)',
                    'i'
                );
                html = html.replace(marker, '$1 }{HEADING}{$2');
            });
            passage.question = html;
        }

        vm.processQuestionATT = function (data,idName) {
            var z = 0;
            var z2 = 0;
            var z3 = 0;
            for(var k = 0; k < data.subQuestions.length; k++){
                stripEmbeddedReadingIntro(data.subQuestions[k]);
                // Older imports may have valid Matching Heading questions but no
                // }{HEADING}{ markers in the passage. Repair them at render time
                // so already-saved tests also display their drop targets.
                ensureActualHeadingPlaceholders(data.subQuestions[k]);
                //process passage for matching heading
                // var passage = data.subQuestions[k].subQuestions[i].question;
                var typePassage = data.subQuestions[k].type;

                //
                // if(typePassage == 4){
                //     var inputMatchingHeading = '<input droppable="true" ng-model="vm.answerDropBox"  class="matching-heading-drop-box" id="matching-heading-drop-box-'+i+'" placeholder="dragging heading and dropping hear"> </input>';
                //
                //     var arrs = data.subQuestions[k].question.split('\n');
                //     // var arr = {};
                //     for(var y = 0; y < arrs.length; y++){
                //
                //     }
                //
                //     console.log(arrs);
                // }
                //UPDATE 12 12 2025
                if(data.subQuestions[k].subQuestions != null){
                    for (var i = 0; i < data.subQuestions[k].subQuestions.length; i++) {
                        if (data.subQuestions[k].subQuestions[i].type == 11 || (data.subQuestions[k].subQuestions[i].type == 18 && !listening.isRuntime(data.subQuestions[k].subQuestions[i]))) {
                            buildOneEditorQuestion(data.subQuestions[k].subQuestions[i]);
                        }
                        if (data.subQuestions[k].subQuestions[i].type == 13) {
                            buildCompleteListQuestion(data.subQuestions[k].subQuestions[i]);
                        }
                        if (data.subQuestions[k].subQuestions[i].type == 14 || data.subQuestions[k].subQuestions[i].type == 15) {
                            buildSentenceEndingQuestion(data.subQuestions[k].subQuestions[i]);
                        }
                        for (var j = 0; j < data.subQuestions[k].subQuestions[i].subQuestions.length; j++) {
                            var parentType = 4;
                            //process filling gaps
                            if (data.subQuestions[k].subQuestions[i].type == 2) {
                                var type = data.subQuestions[k].subQuestions[i].type;
                                var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                                var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                                var input = '<input autocomplete="off" type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.clientAnswer" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'">';
                                data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br> <br>');
                                data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input);
                                // data.subQuestions[k].subQuestions[i].subQuestions[j].question = $sce.trustAsHtml(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                                // console.log(data.subQuestions[k].subQuestions[i].subQuestions[j].question);
                            }
                            else if (data.subQuestions[k].subQuestions[i].type == 3) { //process filling gap enter
                                var type = data.subQuestions[k].subQuestions[i].type;
                                var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;
                                var question = data.subQuestions[k].subQuestions[i].subQuestions[j];
                                // var input1 = '<br><input autocomplete="off" type="text" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.clientAnswer" class="text-question-filling-root" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'"><br><br>';

                                var input1 = '<textarea style="width: 100%" autocomplete="off" rows="4" ng-click="vm.clickShowChildren(q)" ng-change="vm.changeTextQuestionAnswer(a,a.answer.answer,q)" ng-model="a.clientAnswer" id="text-question-number-'+ordinalNumber+'" placeholder="'+ordinalNumber+'">';
                                data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{SPACE}{', input1);
                                // data.subQuestions[k].subQuestions[i].subQuestions[j].question = data.subQuestions[k].subQuestions[i].subQuestions[j].question.replaceAll('}{ENTER}{', '<br>');
                                // console.log('yes');
                            }

                            else if (data.subQuestions[k].subQuestions[i].type == 4) { //process matching heading
                                var type = data.subQuestions[k].subQuestions[i].type;
                                var ordinalNumber = data.subQuestions[k].subQuestions[i].subQuestions[j].ordinalNumber;

                                var question = data.subQuestions[k].subQuestions[i].subQuestions[j];

                                for(var m = 0; m < question.questionAnswers.length; m++){
                                    if(question.questionAnswers[m].correct == true){
                                        var qa = null;
                                        qa = {};
                                        qa.id = question.questionAnswers[m].id;
                                        qa.answer = question.questionAnswers[m].answer;
                                        qa.question = question.questionAnswers[m].question;
                                        qa.ordinalNumberQuestionAnswer = question.questionAnswers[m].ordinalNumberQuestionAnswer;
                                        qa.correct = question.questionAnswers[m].correct;

                                        if(k==0){
                                            var n = {
                                                selected: null,
                                                listName: "Heading",
                                                items: [
                                                ],
                                                dragging: false
                                            };
                                            n.items.push(qa);
                                            $scope.listA.push(n);
                                        }

                                        if(k==1){ //passage 2
                                            var n = {
                                                selected: null,
                                                listName: "Heading",
                                                items: [
                                                ],
                                                dragging: false
                                            };
                                            n.items.push(qa);
                                            $scope.listA2.push(n);
                                        }

                                        if(k==2){ //passage 3
                                            var n = {
                                                selected: null,
                                                listName: "Heading",
                                                items: [
                                                ],
                                                dragging: false
                                            };
                                            n.items.push(qa);
                                            $scope.listA3.push(n);
                                        }
                                    }
                                }

                                if(k==0){
                                    if($scope.listB.items.length === 0){
                                        angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                            item.parentType = type;
                                            $scope.listB.items.push(item);
                                        });
                                    }
                                }

                                if(k==1){
                                    if($scope.listB2.items.length === 0){
                                        angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                            $scope.listB2.items.push(item);
                                        });
                                    }
                                }

                                if(k==2){
                                    if($scope.listB3.items.length === 0){
                                        angular.forEach(data.subQuestions[k].subQuestions[i].subQuestions[j].questionAnswers, function (item) {
                                            $scope.listB3.items.push(item);
                                        });
                                    }
                                }

                                if(typeof $scope.listA[z] !== "undefined"){
                                    var inputMatchingHeading =
                                        '<span dnd-drop="onDropA(listA['+z+'], item, 0)" ' +
                                        'touch-dnd-drop="onDropA(listA['+z+'], item, 0)" ' +
                                        'dnd-draggable="getSelectedItemsIncluding(listA['+z+'], listA['+z+'].items[0])" ' +
                                        'touch-dnd-source="listA['+z+'].items[0]" ' +
                                        'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                        'dnd-list="listA['+z+'].items" ' +
                                        'dnd-selected="listA['+z+'].items[0].selected = !listA['+z+'].items[0].selected" ' +
                                        'dnd-effect-allowed="move" ' +

                                        'type="text"  rows="1"' +
                                        'data-ng-bind="listA['+z+'].items[0].clientAnswer">' +
                                        '</span>';

                                    z = z+1;
                                    data.subQuestions[k].question = data.subQuestions[k].question.replace(/\}\{\s*HEADING\s*\}\{/i, inputMatchingHeading);
                                }

                                //passage 2
                                if(typeof $scope.listA2[z2] !== "undefined"){
                                    var inputMatchingHeading =
                                        '<span dnd-drop="onDropA2(listA2['+z2+'], item, 0)" ' +
                                        'touch-dnd-drop="onDropA2(listA2['+z2+'], item, 0)" ' +
                                        'dnd-draggable="getSelectedItemsIncluding(listA2['+z2+'], listA2['+z2+'].items[0])" ' +
                                        'touch-dnd-source="listA2['+z2+'].items[0]" ' +
                                        'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                        'dnd-list="listA2['+z2+'].items" ' +
                                        'dnd-selected="listA2['+z2+'].items[0].selected = !listA2['+z2+'].items[0].selected" ' +
                                        'dnd-effect-allowed="move" ' +

                                        'type="text"  rows="1"' +
                                        'data-ng-bind="listA2['+z2+'].items[0].clientAnswer">' +
                                        '</span>';

                                    z2 = z2 + 1;
                                    data.subQuestions[k].question = data.subQuestions[k].question.replace(/\}\{\s*HEADING\s*\}\{/i, inputMatchingHeading);

                                }

                                //passage 3
                                if(typeof $scope.listA3[z3] !== "undefined"){
                                    var inputMatchingHeading =
                                        '<span dnd-drop="onDropA3(listA3['+z3+'], item, 0)" ' +
                                        'touch-dnd-drop="onDropA3(listA3['+z3+'], item, 0)" ' +
                                        'dnd-draggable="getSelectedItemsIncluding(listA3['+z3+'], listA3['+z3+'].items[0])" ' +
                                        'touch-dnd-source="listA3['+z3+'].items[0]" ' +
                                        'class="matching-heading-drop-box" id="question-number-'+ question.ordinalNumber +'" ' +
                                        'dnd-list="listA3['+z3+'].items" ' +
                                        'dnd-selected="listA3['+z3+'].items[0].selected = !listA3['+z3+'].items[0].selected" ' +
                                        'dnd-effect-allowed="move" ' +

                                        'type="text"  rows="1"' +
                                        'data-ng-bind="listA3['+z3+'].items[0].clientAnswer">' +
                                        '</span>';

                                    z3 = z3 + 1;
                                    data.subQuestions[k].question = data.subQuestions[k].question.replace(/\}\{\s*HEADING\s*\}\{/i, inputMatchingHeading);
                                }
                            }
                        }
                    }
                }

            }

            for(var v = 0; v < $scope.listA.length; v++){
                $scope.listA[v].items[0].typeDnD = 1;//drop box
                $scope.listA[v].items[0].clientAnswer = $scope.listA[v].items[0].question.ordinalNumber;
                $scope.listA[v].items[0].objectFromListB = null;//drop box

            }

            for(var c = 0; c < $scope.listB.items.length; c++){
                $scope.listB.items[c].clientAnswer = $scope.listB.items[c].answer.answer;
                $scope.listB.items[c].typeDnD = 2;//drag box
            }

            //passage 2
            for(var v = 0; v < $scope.listA2.length; v++){
                $scope.listA2[v].items[0].typeDnD = 1;//drop box
                $scope.listA2[v].items[0].clientAnswer = $scope.listA2[v].items[0].question.ordinalNumber;
                $scope.listA2[v].items[0].objectFromListB = null;//drop box
            }

            for(var c = 0; c < $scope.listB2.items.length; c++){
                $scope.listB2.items[c].clientAnswer = $scope.listB2.items[c].answer.answer;
                $scope.listB2.items[c].typeDnD = 2;//drag box
            }

            //passage 3
            for(var v = 0; v < $scope.listA3.length; v++){
                $scope.listA3[v].items[0].typeDnD = 1;//drop box
                $scope.listA3[v].items[0].clientAnswer = $scope.listA3[v].items[0].question.ordinalNumber;
                $scope.listA3[v].items[0].objectFromListB = null;//drop box

            }

            for(var c = 0; c < $scope.listB3.items.length; c++){
                $scope.listB3.items[c].clientAnswer = $scope.listB3.items[c].answer.answer;
                $scope.listB3.items[c].typeDnD = 2;//drag box
            }

            console.log($scope.listA);
            console.log($scope.listB.items);
            console.log($scope.listB2.items);
            console.log($scope.listB3.items);

            return data;

        };




        vm.isShowContextMenu = false;
        vm.notes = [];
        vm.notes2 = [];
        vm.notes3 = [];
        vm.note = {};
        vm.surroundedId1 = 0;
        vm.surroundedId2 = 0;
        vm.surroundedId3 = 0;

        $scope.showContextMenu = function(){

            // var range = window.getSelection().getRangeAt(0);
            // var text = document.querySelector('#passage-text-1');
            // var textElements = document.querySelectorAll('#passage-text-1 *');
            //
            // var selection = window.getSelection();
            // console.log(range);
            //
            // if (selection && selection.anchorNode && selection.focusNode) {
            //     const selectionStartsAtElement = selection.anchorNode.parentNode;
            //     const selectionEndsAtElement = selection.focusNode.parentNode;
            //
            //     if (selectionStartsAtElement === text && selectionEndsAtElement === text) {
            //         console.log('no markup elements have been selected');
            //         return;
            //     }
            //
            //     const areElementsSelectedInsideText = text.contains(selectionStartsAtElement) && text.contains(selectionEndsAtElement);
            //
            //     if (areElementsSelectedInsideText) {
            //         console.log('markup elements have been selected');
            //
            //         var parentElementsForSelectionEnd;
            //         var parentElementsForSelectionStart;
            //
            //         // get selection end elements
            //         if (selectionEndsAtElement !== text) {
            //             parentElementsForSelectionEnd = [selectionEndsAtElement];
            //
            //             var nextParentAtSelectionEnd = selectionEndsAtElement.parentNode;
            //
            //             while (nextParentAtSelectionEnd !== text) {
            //                 parentElementsForSelectionEnd.push(nextParentAtSelectionEnd);
            //                 nextParentAtSelectionEnd = nextParentAtSelectionEnd.parentNode;
            //             }
            //         }
            //
            //         // get selection start elements
            //         if (selectionStartsAtElement !== text) {
            //             parentElementsForSelectionStart = [selectionStartsAtElement];
            //
            //             var nextParentAtSelectionStart = selectionStartsAtElement.parentNode;
            //
            //             while (nextParentAtSelectionStart !== text) {
            //                 parentElementsForSelectionStart.push(nextParentAtSelectionStart);
            //                 nextParentAtSelectionStart = nextParentAtSelectionStart.parentNode;
            //             }
            //         }
            //
            //         // do what ever you need here
            //         // (as I understood - you should highlight buttons somewhere)
            //         console.log(1);
            //         console.log(parentElementsForSelectionStart);
            //         console.log(2);
            //         console.log(parentElementsForSelectionEnd);
            //     }
            // }



            if(window.getSelection().toString() == null || window.getSelection().toString().length > 0){
                vm.isShowContextMenu = true;
            } else {
                vm.isShowContextMenu = false;
            }

        };

        var highlightNumber = 1;
        var rangeNumber = 0;
        $scope.highlightText = function () {

            // const sel = window.getSelection();
            // const text = sel.toString();

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('span');
            if(range.endContainer !== range.startContainer){
                return;
            }
            // const startOffset = text.length - text.trimStart().length;
            // const endOffset = text.length - text.trimEnd().length;
            //
            // if (startOffset) {
            //     range.setStart(range.startContainer, range.startOffset + startOffset);
            // }
            //
            // if (endOffset) {
            //     range.setEnd(range.endContainer, range.endOffset - endOffset);
            // }



            span.className = 'surrounded-text';
            span.id = "surrounded-text-"+highlightNumber;
            span.style.backgroundColor = 'yellow';
            span.appendChild(range.extractContents());
            range.insertNode(span);
            // rangeNumber = rangeNumber + 1;
            highlightNumber = highlightNumber+1;
        };

        $scope.getAllBetween = function (firstEl,lastEl) {
            var firstElement = $(firstEl); // First Element
            var lastElement = $(lastEl); // Last Element
            var collection = new Array(); // Collection of Elements
            collection.push(firstElement.attr('id')); // Add First Element to Collection
            $(firstEl).nextAll().each(function(){ // Traverse all siblings
                var siblingID  = $(this).attr('id'); // Get Sibling ID
                if (siblingID != $(lastElement).attr('id')) { // If Sib is not LastElement
                    collection.push($(this).attr('id')); // Add Sibling to Collection
                } else { // Else, if Sib is LastElement
                    collection.push(lastElement.attr('id')); // Add Last Element to Collection
                    return false; // Break Loop
                }
            });

            if(collection.length > 0 && (lastElement[0] != null && !angular.isUndefined(lastElement[0]))){
                if(lastElement != null && lastElement.length >0){
                    console.log(lastElement[0].get('id'));
                }
            }
            return collection; // Return Collection
        };

        $scope.clearHighlightText = function () {
            // var range = window.getSelection().getRangeAt(0);
            // var range = window.getSelection();
            // console.log(range);

            // var currentHighlight = document.getElementById(range.commonAncestorContainer.children.id);
            // currentHighlight.className = "";

            if (window.getSelection) { // non-IE
                var userSelection = window.getSelection();
                var rangeObject = userSelection.getRangeAt(0);
                if (rangeObject.startContainer == rangeObject.endContainer) {
                    // alert(rangeObject.startContainer.parentNode.id);

                    var onlyOneNode = document.getElementById(rangeObject.startContainer.parentNode.id);
                    if(onlyOneNode.id.length > 0 && onlyOneNode.id != null){
                        onlyOneNode.className = "";
                        onlyOneNode.style.backgroundColor = "white";
                        onlyOneNode.id = "";
                    }
                } else {

                    var ids = $scope.getAllBetween(
                        rangeObject.startContainer.parentNode,
                        rangeObject.endContainer.parentNode);
                    // alert(ids);
                    // if(ids.length == 1){
                    //     var onlyOneNode = document.getElementById(rangeObject.startContainer.parentNode.id);
                    //     if(onlyOneNode.id.length > 0 && onlyOneNode.id != null){
                    //         onlyOneNode.className = "";
                    //         onlyOneNode.id = "";
                    //     }
                    // } else{
                        for(var i = 0; i < ids.length; i++){
                            // var x = document.getElementById(range.commonAncestorContainer.children[i].id);
                            var currentHighlight = document.getElementById(ids[i]);
                            if(currentHighlight != null &&currentHighlight.id.length > 0 && currentHighlight.id != null){
                                currentHighlight.className = "";
                                currentHighlight.style.backgroundColor = "white";
                                currentHighlight.id = "";
                            }
                        }
                    // }

                }
            } else if (document.selection) { // IE lesser
                userSelection = document.selection.createRange();
                var ids = new Array();

                if (userSelection.htmlText.toLowerCase().indexOf('span') >= 0) {
                    $(userSelection.htmlText).filter('span').each(function(index, span) {
                        ids.push(span.id);
                    });
                    alert(ids);
                } else {
                    alert(userSelection.parentElement().id);
                }
            }
        };

        //passage 1
        $scope.closeNotes1 = function (){
            // console.log('close 1');
            for(var i = 0; i< vm.notes.length; i++){
                var currentId = i+1;
                var currentElementId = 'passage-1-notes-highlight-'+currentId;
                var currentNote = document.getElementById(currentElementId);
                currentNote.style.display = 'none';
            }
        };

        $scope.createNotes1 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            // var note = {};
            // note.header = window.getSelection().toString();
            // vm.notes.push(note);


            vm.surroundedId1 = vm.surroundedId1 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-1-surrounded-text-have-note-'+vm.surroundedId1;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes1);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);
            
            var note = {passage: 1};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes.push(note);
        };

        $scope.closeASpecificNote1 = function (currentId) {
            var currentElementId = 'passage-1-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes1 = function (a) {

            var passage = document.getElementById('passage-text-1');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-1-notes-highlight-'+currentId;

            // console.log(currentId);
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            // for(var i = 0; i< vm.notes.length; i++){
            //     vm.notes[i].isShowNote = true;
            // }
        };

        // ---------------------question passage 1 -------------------------//
        $scope.createNotesQuestion1 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            // var note = {};
            // note.header = window.getSelection().toString();
            // vm.notes.push(note);


            vm.surroundedId1 = vm.surroundedId1 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-1-surrounded-text-have-note-'+vm.surroundedId1;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotesQuestion1);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 1};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes.push(note);
        };

        $scope.showNotesQuestion1 = function (a) {

            var passage = document.getElementById('passage-question-text-1');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-question-1-notes-highlight-'+currentId;

            // console.log(currentId);
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            // for(var i = 0; i< vm.notes.length; i++){
            //     vm.notes[i].isShowNote = true;
            // }
        };
        // --------------------- question passage 1 -------------------------//


        // --------------------- end - passage 1 ---------------------------//

        //passage 2
        $scope.closeNotes2 = function (){
            // console.log('close');
            for(var i = 0; i< vm.notes2.length; i++){
                if(vm.notes2[i].passage == 2){
                    var currentId = i+1;
                    var currentElementId = 'passage-2-notes-highlight-'+currentId;
                    var currentNote = document.getElementById(currentElementId);
                    currentNote.style.display = 'none';
                }

            }
        };

        $scope.createNotes2 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            vm.surroundedId2 = vm.surroundedId2 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-2-surrounded-text-have-note-'+vm.surroundedId2;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes2);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 2};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes2.push(note);
        };

        $scope.closeASpecificNote2 = function (currentId) {
            var currentElementId = 'passage-2-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes2 = function (a) {

            var passage = document.getElementById('passage-text-2');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-2-notes-highlight-'+currentId;
            
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            
        };

        // ---------------------question passage 2 -------------------------//
        $scope.createNotesQuestion2 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            // var note = {};
            // note.header = window.getSelection().toString();
            // vm.notes.push(note);


            vm.surroundedId2 = vm.surroundedId2 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-2-surrounded-text-have-note-'+vm.surroundedId2;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotesQuestion2);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 2};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes.push(note);
        };

        $scope.showNotesQuestion2 = function (a) {

            var passage = document.getElementById('passage-question-text-2');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-2];
            var currentElementId = 'passage-question-2-notes-highlight-'+currentId;

            // console.log(currentId);
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            // for(var i = 0; i< vm.notes.length; i++){
            //     vm.notes[i].isShowNote = true;
            // }
        };
        // --------------------- question passage 2 -------------------------//

        //------------- end passage 2 ------------------//

        //passage 3
        $scope.closeNotes3 = function (){
            console.log('close');
            for(var i = 0; i< vm.notes3.length; i++){
                if(vm.notes3[i].passage == 3){
                    var currentId = i+1;
                    var currentElementId = 'passage-3-notes-highlight-'+currentId;
                    var currentNote = document.getElementById(currentElementId);
                    currentNote.style.display = 'none';
                }

            }
        };

        $scope.createNotes3 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');
            
            vm.surroundedId3 = vm.surroundedId3 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-3-surrounded-text-have-note-'+vm.surroundedId3;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotes3);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 3};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes3.push(note);
        };

        $scope.closeASpecificNote3 = function (currentId) {
            var currentElementId = 'passage-3-notes-highlight-'+currentId;
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'none';
        };

        $scope.showNotes3 = function (a) {

            var passage = document.getElementById('passage-text-3');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-1];
            var currentElementId = 'passage-3-notes-highlight-'+currentId;

            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');

        };

        // ---------------------question passage 3 -------------------------//
        $scope.createNotesQuestion3 = function () {
            // document.addEventListener("click", printMousePos);

            var range = window.getSelection().getRangeAt(0),
                span = document.createElement('a');

            // var note = {};
            // note.header = window.getSelection().toString();
            // vm.notes.push(note);


            vm.surroundedId3 = vm.surroundedId3 + 1;
            span.className = 'surrounded-text-have-note';
            span.id = 'passage-3-surrounded-text-have-note-'+vm.surroundedId3;
            span.style.zIndex = 3;

            // span.setAttribute("ng-click","someFunction()");
            span.addEventListener("click",$scope.showNotesQuestion3);

            // span.setAttribute = ('onclick','someFunction()');
            span.appendChild(range.extractContents());
            range.insertNode(span);

            var note = {passage: 3};
            note.header = window.getSelection().toString();
            note.specificNote = '';
            note.isShowNote = true;


            vm.notes.push(note);
        };

        $scope.showNotesQuestion3 = function (a) {

            var passage = document.getElementById('passage-question-text-3');

            console.log(a.target.id);
            var text = a.target.id.split("-");
            var currentId = text[text.length-2];
            var currentElementId = 'passage-question-3-notes-highlight-'+currentId;

            // console.log(currentId);
            var currentNote = document.getElementById(currentElementId);
            currentNote.style.display = 'block';

            console.log('show');
            // for(var i = 0; i< vm.notes.length; i++){
            //     vm.notes[i].isShowNote = true;
            // }
        };
        // --------------------- question passage 3 -------------------------//

        //------------- end passage 3 ------------------//

        /*
         * Reliable IDP-style annotations.
         *
         * The legacy implementation read window.getSelection() after the
         * toolbar was clicked and only accepted selections inside one text
         * node. Clicking the toolbar can collapse the browser selection, and
         * real passage content frequently crosses inline elements. Keep a
         * cloned Range as soon as mouseup occurs and annotate every text node
         * that intersects that saved range instead.
         */
        var savedAnnotationRange = null;
        var annotationSequence = 0;
        vm.annotationNotes = [];
        $scope.$watch(function () { return vm.annotationNotes; }, function (notes, previousNotes) {
            if (notes !== previousNotes) { saveReadingDraft(); }
        }, true);
        vm.activeAnnotationNote = null;
        vm.selectionMenuStyle = {};
        vm.annotationNoteStyle = {};
        vm.selectionHasHighlight = false;
        vm.selectionHasNote = false;
        vm.isAnnotationRemoveMenu = false;
        var clickedAnnotationMarker = null;

        function closestElement(element, selector) {
            if (!element) {
                return null;
            }
            if (element.nodeType === 3) {
                element = element.parentNode;
            }
            if (element.closest) {
                return element.closest(selector);
            }
            while (element && element.nodeType === 1) {
                if ($(element).is(selector)) {
                    return element;
                }
                element = element.parentNode;
            }
            return null;
        }

        var annotationContainerIds = [
            'passage-text-1', 'passage-question-text-1',
            'passage-text-2', 'passage-question-text-2',
            'passage-text-3', 'passage-question-text-3'
        ];

        function serializeReadingAnnotations() {
            if (pendingReadingAnnotations) { return angular.copy(pendingReadingAnnotations); }
            var records = angular.copy(unrestoredReadingAnnotations);
            angular.forEach(annotationContainerIds, function (containerId) {
                var container = document.getElementById(containerId);
                if (!container) { return; }
                angular.forEach(container.querySelectorAll('.ielts-annotation'), function (marker) {
                    try {
                        var before = document.createRange();
                        before.selectNodeContents(container);
                        before.setEndBefore(marker);
                        var start = before.toString().length;
                        records.push({
                            containerId: containerId,
                            start: start,
                            end: start + (marker.textContent || '').length,
                            quote: marker.textContent || '',
                            prefix: String(container.textContent || '').slice(Math.max(0, start - 32), start),
                            suffix: String(container.textContent || '').slice(start + (marker.textContent || '').length, start + (marker.textContent || '').length + 32),
                            highlighted: marker.classList.contains('is-highlighted'),
                            hasNote: marker.classList.contains('has-note'),
                            noteId: marker.getAttribute('data-note-id') || null,
                            groupId: marker.getAttribute('data-annotation-group') || null
                        });
                    } catch (ignoreAnnotationSerializeError) {}
                });
            });
            return records;
        }

        function textRangeForOffsets(container, start, end) {
            var showText = window.NodeFilter ? window.NodeFilter.SHOW_TEXT : 4;
            var walker = document.createTreeWalker(container, showText, null, false);
            var range = document.createRange();
            var offset = 0;
            var startNode = null;
            var endNode = null;
            var startOffset = 0;
            var endOffset = 0;
            var node;
            while ((node = walker.nextNode())) {
                var nextOffset = offset + node.nodeValue.length;
                if (!startNode && start >= offset && start <= nextOffset) {
                    startNode = node;
                    startOffset = Math.max(0, Math.min(node.nodeValue.length, start - offset));
                }
                if (endNode === null && end >= offset && end <= nextOffset) {
                    endNode = node;
                    endOffset = Math.max(0, Math.min(node.nodeValue.length, end - offset));
                    break;
                }
                offset = nextOffset;
            }
            if (!startNode || !endNode || end <= start) { return null; }
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            return range;
        }

        function textRangeForAnnotation(container, record) {
            if (!record.quote) { return textRangeForOffsets(container, Number(record.start), Number(record.end)); }
            var text = container.textContent || '';
            var originalStart = Number(record.start);
            if (text.slice(originalStart, Number(record.end)) === record.quote &&
                    ((!record.prefix && !record.suffix) ||
                    (record.prefix && text.slice(Math.max(0, originalStart - record.prefix.length), originalStart) === record.prefix) ||
                    (record.suffix && text.slice(Number(record.end), Number(record.end) + record.suffix.length) === record.suffix))) {
                return textRangeForOffsets(container, originalStart, Number(record.end));
            }
            var start = text.indexOf(record.quote);
            var bestStart = -1, bestScore = -1, tied = false;
            while (start >= 0) {
                var score = 0;
                if (record.prefix && text.slice(Math.max(0, start - record.prefix.length), start) === record.prefix) { score++; }
                if (record.suffix && text.slice(start + record.quote.length, start + record.quote.length + record.suffix.length) === record.suffix) { score++; }
                if (score > bestScore) { bestStart = start; bestScore = score; tied = false; }
                else if (score === bestScore) { tied = true; }
                start = text.indexOf(record.quote, start + 1);
            }
            if (bestStart < 0 || tied) { return null; }
            return textRangeForOffsets(container, bestStart, bestStart + record.quote.length);
        }

        function restoreReadingAnnotations(records) {
            unrestoredReadingAnnotations = [];
            angular.forEach(records || [], function (record) {
                var container = document.getElementById(record.containerId);
                if (!container || Number(record.end) <= Number(record.start)) {
                    unrestoredReadingAnnotations.push(angular.copy(record));
                    return;
                }
                var range = textRangeForAnnotation(container, record);
                if (!range || !range.toString()) {
                    unrestoredReadingAnnotations.push(angular.copy(record));
                    return;
                }
                var restored = [];
                if (record.highlighted) {
                    restored = addAnnotationClass(range, 'is-highlighted', record.hasNote ? record.noteId : null);
                } else if (record.hasNote) {
                    restored = addAnnotationClass(range, 'has-note', record.noteId);
                }
                if (!restored.length) { unrestoredReadingAnnotations.push(angular.copy(record)); }
                angular.forEach(restored, function (marker) {
                    if (record.highlighted) { marker.classList.add('is-highlighted'); }
                    if (record.hasNote) {
                        marker.classList.add('has-note');
                        if (record.noteId) { marker.setAttribute('data-note-id', record.noteId); }
                    }
                    if (record.groupId) { marker.setAttribute('data-annotation-group', record.groupId); }
                });
            });
        }

        function buildIeltsLearningState() {
            return {
                version: 2,
                sessionMode: vm.testSessionMode,
                activeDurationSeconds: getActiveDurationSeconds(),
                passageNumber: vm.passageNumber || 1,
                assignmentParts: vm.isPartAssignment ? angular.copy(vm.assignedParts) : [],
                results: serializeReadingDraftResults(),
                questionStates: serializeReadingQuestionStates(),
                completeListStates: serializeCompleteListStates(),
                writingInputAudit: vm.isWritingRoute ? writingInputAuditSummary() : null,
                annotationNotes: angular.copy(vm.annotationNotes || []),
                annotations: serializeReadingAnnotations()
            };
        }

        function selectionBelongsToReadingTest(range) {
            var startArea = closestElement(range.startContainer, '.passage-text, .question-content');
            var endArea = closestElement(range.endContainer, '.passage-text, .question-content');
            return startArea !== null && endArea !== null && startArea === endArea;
        }

        function rangeIntersectsNode(range, node) {
            if (range.intersectsNode) {
                try {
                    return range.intersectsNode(node);
                } catch (ignore) {
                    return false;
                }
            }

            var nodeRange = document.createRange();
            nodeRange.selectNodeContents(node);
            return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
                range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
        }

        function annotationElementsInRange(range) {
            var elements = [];
            var seen = [];
            var parentAnnotation = closestElement(range.startContainer, '.ielts-annotation');

            function add(element) {
                if (element && seen.indexOf(element) === -1 && rangeIntersectsNode(range, element)) {
                    seen.push(element);
                    elements.push(element);
                }
            }

            add(parentAnnotation);
            var root = range.commonAncestorContainer.nodeType === 3 ?
                range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
            if (root && root.querySelectorAll) {
                angular.forEach(root.querySelectorAll('.ielts-annotation'), add);
            }
            return elements;
        }

        function selectableTextNodes(range) {
            var root = range.commonAncestorContainer.nodeType === 3 ?
                range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
            var nodes = [];
            var showText = window.NodeFilter ? window.NodeFilter.SHOW_TEXT : 4;
            var walker = document.createTreeWalker(root, showText, null, false);
            var current;

            if (root.nodeType === 3) {
                return [root];
            }

            while ((current = walker.nextNode())) {
                if (!rangeIntersectsNode(range, current)) {
                    continue;
                }
                if (closestElement(current, 'button, input, textarea, select, option, .dropdown-menu-highlight, .idp-annotation-note, .idp-question-stepper')) {
                    continue;
                }
                nodes.push(current);
            }
            return nodes;
        }

        function selectedOffsets(range, node) {
            var start = node === range.startContainer ? range.startOffset : 0;
            var end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
            return {
                start: Math.max(0, Math.min(start, node.nodeValue.length)),
                end: Math.max(0, Math.min(end, node.nodeValue.length))
            };
        }

        function addAnnotationClass(range, className, noteId) {
            var touched = annotationElementsInRange(range);
            var nodes = selectableTextNodes(range);
            var groupId = 'annotation-' + (++annotationSequence);

            /* Work backwards so splitting a later node cannot invalidate an
             * earlier boundary in the saved Range. */
            for (var i = nodes.length - 1; i >= 0; i--) {
                var node = nodes[i];
                var offsets = selectedOffsets(range, node);
                if (offsets.end <= offsets.start || !node.nodeValue.substring(offsets.start, offsets.end).trim()) {
                    continue;
                }

                var existing = closestElement(node, '.ielts-annotation');
                if (existing) {
                    if (touched.indexOf(existing) === -1) {
                        touched.push(existing);
                    }
                    continue;
                }

                if (offsets.end < node.nodeValue.length) {
                    node.splitText(offsets.end);
                }
                var selectedNode = offsets.start > 0 ? node.splitText(offsets.start) : node;
                var marker = document.createElement('span');
                marker.className = 'ielts-annotation';
                marker.setAttribute('data-annotation-group', groupId);
                selectedNode.parentNode.insertBefore(marker, selectedNode);
                marker.appendChild(selectedNode);
                touched.push(marker);
            }

            angular.forEach(touched, function (element) {
                $(element).addClass(className);
                element.setAttribute('title', 'Click to remove');
                if (noteId) {
                    element.setAttribute('data-note-id', noteId);
                }
            });
            return touched;
        }

        function unwrapIfEmptyAnnotation(element) {
            if (!element || $(element).hasClass('is-highlighted') || $(element).hasClass('has-note')) {
                return;
            }
            var parent = element.parentNode;
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            parent.normalize();
        }

        function hideSelectionMenu(clearRange) {
            vm.isShowContextMenu = false;
            if (clearRange) {
                savedAnnotationRange = null;
                var selection = window.getSelection && window.getSelection();
                if (selection && selection.removeAllRanges) {
                    selection.removeAllRanges();
                }
            }
        }

        function updateSelectionState(range) {
            var elements = annotationElementsInRange(range);
            vm.selectionHasHighlight = elements.some(function (element) {
                return $(element).hasClass('is-highlighted');
            });
            vm.selectionHasNote = elements.some(function (element) {
                return $(element).hasClass('has-note');
            });
        }

        $scope.showSelectionTools = function ($event) {
            if (closestElement($event.target, '.dropdown-menu-highlight, .idp-annotation-note, .idp-display-settings')) {
                return;
            }

            var selection = window.getSelection && window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
                hideSelectionMenu(false);
                return;
            }

            var range = selection.getRangeAt(0);
            if (!selectionBelongsToReadingTest(range)) {
                hideSelectionMenu(false);
                return;
            }

            savedAnnotationRange = range.cloneRange();
            updateSelectionState(savedAnnotationRange);
            vm.activeAnnotationNote = null;
            vm.isAnnotationRemoveMenu = false;
            clickedAnnotationMarker = null;

            var rect = range.getBoundingClientRect();
            var menuWidth = 102;
            var left = Math.max(8, Math.min(rect.left + (rect.width / 2) - (menuWidth / 2), window.innerWidth - menuWidth - 8));
            var top = rect.top - 52;
            if (top < 8) {
                top = rect.bottom + 10;
            }
            vm.selectionMenuStyle = {
                left: left + 'px',
                top: top + 'px'
            };
            vm.isShowContextMenu = true;

            var navigatorInfo = window.navigator || {};
            var isIosTouchDevice = /iPad|iPhone|iPod/i.test(navigatorInfo.userAgent || '')
                || (navigatorInfo.platform === 'MacIntel' && Number(navigatorInfo.maxTouchPoints) > 1);
            if (isIosTouchDevice && selection.removeAllRanges) {
                selection.removeAllRanges();
            }
        };

        vm.openQuestionIfNotSelecting = function (question, questions, $event) {
            if ($event && closestElement($event.target, '.ielts-annotation')) {
                return;
            }
            var selection = window.getSelection && window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) {
                return;
            }
            vm.clickShowChildren(question, questions);
        };

        $scope.applySelectionHighlight = function () {
            if (!savedAnnotationRange) {
                return;
            }
            addAnnotationClass(savedAnnotationRange, 'is-highlighted');
            hideSelectionMenu(true);
            saveReadingDraft();
        };

        $scope.removeSelectionHighlight = function () {
            if (!savedAnnotationRange) {
                return;
            }
            angular.forEach(annotationElementsInRange(savedAnnotationRange), function (element) {
                $(element).removeClass('is-highlighted surrounded-text');
                element.style.backgroundColor = '';
                unwrapIfEmptyAnnotation(element);
            });
            hideSelectionMenu(true);
            saveReadingDraft();
        };

        function noteById(noteId) {
            for (var i = 0; i < vm.annotationNotes.length; i++) {
                if (vm.annotationNotes[i].id === noteId) {
                    return vm.annotationNotes[i];
                }
            }
            return null;
        }

        $scope.applySelectionNote = function () {
            if (!savedAnnotationRange) {
                return;
            }

            var existingElements = annotationElementsInRange(savedAnnotationRange);
            var existingNoteId = null;
            angular.forEach(existingElements, function (element) {
                existingNoteId = existingNoteId || element.getAttribute('data-note-id');
            });

            var note = existingNoteId ? noteById(existingNoteId) : null;
            if (!note) {
                var noteId = 'note-' + Date.now() + '-' + (++annotationSequence);
                note = {
                    id: noteId,
                    partNumber: vm.activeIeltsNavigationPart(),
                    header: savedAnnotationRange.toString().trim(),
                    specificNote: ''
                };
                vm.annotationNotes.push(note);
            }

            addAnnotationClass(savedAnnotationRange, 'has-note', note.id);
            vm.activeAnnotationNote = note;
            var noteLeft = Math.max(8, Math.min(parseInt(vm.selectionMenuStyle.left, 10), window.innerWidth - 292));
            var noteTop = Math.max(8, Math.min(parseInt(vm.selectionMenuStyle.top, 10) + 82, window.innerHeight - 218));
            vm.annotationNoteStyle = {
                left: noteLeft + 'px',
                top: noteTop + 'px'
            };
            hideSelectionMenu(true);
        };

        $scope.removeSelectionNote = function () {
            if (!savedAnnotationRange) {
                return;
            }
            var noteIds = [];
            angular.forEach(annotationElementsInRange(savedAnnotationRange), function (element) {
                var noteId = element.getAttribute('data-note-id');
                if (noteId && noteIds.indexOf(noteId) === -1) {
                    noteIds.push(noteId);
                }
            });

            angular.forEach(noteIds, function (noteId) {
                angular.forEach(document.querySelectorAll('.ielts-annotation[data-note-id="' + noteId + '"]'), function (element) {
                    $(element).removeClass('has-note');
                    element.removeAttribute('data-note-id');
                    unwrapIfEmptyAnnotation(element);
                });
                vm.annotationNotes = vm.annotationNotes.filter(function (note) {
                    return note.id !== noteId;
                });
                if (vm.activeAnnotationNote && vm.activeAnnotationNote.id === noteId) {
                    vm.activeAnnotationNote = null;
                }
            });
            hideSelectionMenu(true);
        };

        function showAnnotationNoteForMarker(marker) {
            if (!marker) { return false; }
            var note = noteById(marker.getAttribute('data-note-id'));
            if (!note) {
                return false;
            }
            var rect = marker.getBoundingClientRect();
            vm.activeAnnotationNote = note;
            vm.isShowContextMenu = false;
            vm.isAnnotationRemoveMenu = false;
            clickedAnnotationMarker = null;
            vm.annotationNoteStyle = {
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 292)) + 'px',
                top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 218)) + 'px'
            };
            return true;
        }

        $scope.openAnnotationNote = function ($event) {
            var marker = closestElement($event.target, '.ielts-annotation.has-note');
            if (!marker || (window.getSelection && window.getSelection().toString().trim())) {
                return;
            }
            showAnnotationNoteForMarker(marker);
        };

        $scope.closeAnnotationNote = function () {
            vm.activeAnnotationNote = null;
        };

        $scope.handleReadingAnnotationClick = function ($event) {
            if (closestElement($event.target, '.dropdown-menu-highlight, .idp-annotation-note, .idp-display-settings')) {
                return;
            }

            var marker = closestElement($event.target, '.ielts-annotation');
            var selection = window.getSelection && window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) {
                return;
            }

            // A normal click anywhere outside annotated text dismisses the
            // open note and its action menu.
            if (!marker) {
                vm.activeAnnotationNote = null;
                vm.isShowContextMenu = false;
                vm.isAnnotationRemoveMenu = false;
                clickedAnnotationMarker = null;
                return;
            }

            // Reopen the note on a left click, but keep exposing the Remove
            // action for the annotated text as well.
            if ($(marker).hasClass('has-note')) {
                showAnnotationNoteForMarker(marker);
            } else {
                vm.activeAnnotationNote = null;
            }

            clickedAnnotationMarker = marker;
            savedAnnotationRange = null;
            vm.isAnnotationRemoveMenu = true;

            var rect = marker.getBoundingClientRect();
            var menuWidth = 86;
            var left = Math.max(8, Math.min(rect.left + (rect.width / 2) - (menuWidth / 2), window.innerWidth - menuWidth - 8));
            var top = rect.top - 51;
            if (top < 8) {
                top = rect.bottom + 8;
            }
            vm.selectionMenuStyle = {
                left: left + 'px',
                top: top + 'px'
            };
            vm.isShowContextMenu = true;
        };

        $scope.removeClickedAnnotation = function () {
            if (!clickedAnnotationMarker) {
                return;
            }

            var groupId = clickedAnnotationMarker.getAttribute('data-annotation-group');
            var groupElements = groupId ?
                Array.prototype.slice.call(document.querySelectorAll('.ielts-annotation[data-annotation-group="' + groupId + '"]')) :
                [clickedAnnotationMarker];
            var noteIds = [];

            angular.forEach(groupElements, function (element) {
                var noteId = element.getAttribute('data-note-id');
                if (noteId && noteIds.indexOf(noteId) === -1) {
                    noteIds.push(noteId);
                }
            });

            angular.forEach(noteIds, function (noteId) {
                angular.forEach(document.querySelectorAll('.ielts-annotation[data-note-id="' + noteId + '"]'), function (element) {
                    $(element).removeClass('has-note');
                    element.removeAttribute('data-note-id');
                    unwrapIfEmptyAnnotation(element);
                });
                vm.annotationNotes = vm.annotationNotes.filter(function (note) {
                    return note.id !== noteId;
                });
            });

            /* Resolve the group again because removing a note may already have
             * unwrapped note-only markers. */
            if (groupId) {
                groupElements = Array.prototype.slice.call(document.querySelectorAll('.ielts-annotation[data-annotation-group="' + groupId + '"]'));
            }
            angular.forEach(groupElements, function (element) {
                $(element).removeClass('is-highlighted has-note');
                element.removeAttribute('data-note-id');
                unwrapIfEmptyAnnotation(element);
            });

            clickedAnnotationMarker = null;
            vm.isAnnotationRemoveMenu = false;
            vm.isShowContextMenu = false;
        };


        vm.setReviewQuestion = function () {

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(vm.tempQuestion.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].needReview = vm.tempQuestion.needReview;
                            // vm.tempQuestion.needReview = true;

                        }
                    }
                }
            }
        };

        vm.checkBoxMultipleChoiceQuestions = function (questionAnswer,question,selected) {

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++){//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++){//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
                        if(question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id){
                            //set answered
                            // vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // if(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == true){
                            //     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            // } else if(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered == false){
                            //     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            // }
                            vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = selected;


                            // console.log(vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k]);
                            for(var l = 0; l < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers.length; l++){
                                if(questionAnswer.id != vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].id){
                                    //set answer is selected
                                    vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = false;
                                }else {
                                    vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].questionAnswers[l].selected = selected;
                                    if(selected){
                                        for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                            if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                                vm.testResult.questionAnswerTestResult.splice(m,1);
                                            }
                                        }

                                        var qat = {};
                                        qat.questionAnswer = questionAnswer;
                                        qat.ordinalNumber = question.ordinalNumber;
                                        qat.clientAnswer = questionAnswer.answer.answer;

                                        // questionAnswer.id = null;
                                        vm.testResult.questionAnswerTestResult.push(qat);
                                    } else if (!selected){
                                        for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                            if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                                vm.testResult.questionAnswerTestResult.splice(m,1);
                                            }
                                        }
                                    }
                                }
                            }

                        }

                    }
                }
            }

            console.log("-----------");
            console.log(vm.testResult);
            console.log(vm.testResult.questionAnswers);
            console.log("===========");
        };

        vm.type5Index = 0;
        vm.multipleAnswerRange = function (questionPackage) {
            var questions = (questionPackage && questionPackage.subQuestions) || [];
            if (!questions.length) { return ''; }
            var first = questions[0].ordinalNumber;
            var last = questions[questions.length - 1].ordinalNumber;
            return String(first) + (String(first) === String(last) ? '' : '–' + String(last));
        };
        vm.numberSelectedAnswers = 0;
        // vm.selectedIndex = [];
        vm.answered = [];

        vm.checkBoxMultipleChoiceMultipleAnswerQuestions = function (questionAnswer,question,selected,index,parent) {

            var firstQuestion = parent.subQuestions[0].ordinalNumber;
            var lastQuestion = parent.subQuestions[parent.subQuestions.length-1].ordinalNumber;

            //check xem 2 câu này đã trả lời chưa
            var isAnswered = false;
            angular.forEach(parent.subQuestions, function(value, key) {
                angular.forEach(vm.testResult.questionAnswerTestResult, function(value1, key1) {
                    if(value1.ordinalNumber === value.ordinalNumber){
                        isAnswered = true;
                    }
                });
            });

            //nếu chưa thì khởi tạo qat cho những câu này
            if(isAnswered === false){
                angular.forEach(parent.subQuestions, function(value, key) {
                    var qat = {};
                    qat.questionAnswer = {};
                    qat.ordinalNumber = value.ordinalNumber;
                    qat.clientAnswer = '';
                    vm.testResult.questionAnswerTestResult.push(qat);
                });

            }

            var numberOfAnswers = parent.subQuestions.length; // thông thường là có 2

            //khi mà ấn check box
            var numberOfSelected = 0;
            angular.forEach(question.questionAnswers, function(value, key) {
                if(value.selected == true){
                    numberOfSelected = numberOfSelected+1;
                }
            });

            if(selected === true){
                if(numberOfSelected > numberOfAnswers){
                    questionAnswer.selected = false;
                    numberOfSelected = numberOfAnswers;
                }
            }

            //set lại check tất cả là chưa answer
            for(var i = 0; i < parent.subQuestions.length; i++){
                parent.subQuestions[i].answered = false;
            }
            //check là đã answer rồi
            for(var i = 0; i < numberOfSelected; i++){
                parent.subQuestions[i].answered = true;
            }

            //lấy list các câu selected
            var answers = [];
            for(var i = firstQuestion; i <= lastQuestion; i ++){
                var a = {};
                a.ordinalNumber = i;
                a.questionAnswer = {};
                // a.questionAnswer = question.questionAnswers[0];
                answers.push(a);
            }

            var n = 0;
            angular.forEach(question.questionAnswers, function(value, key) {
                if(value.selected == true){
                    answers[n].questionAnswer = value;
                    n = n+1;
                }
            });

            // console.log(answers);

            // add test result
            angular.forEach(vm.testResult.questionAnswerTestResult, function(value, key) {
                angular.forEach(answers, function(value1, key1) {
                    if(value1.ordinalNumber === value.ordinalNumber){
                        value.questionAnswer = value1.questionAnswer;
                        if(angular.isUndefined(value1.questionAnswer.answer)){
                            value.questionAnswer = {};
                            // value.questionAnswer.id = ;
                            value.clientAnswer = ''

                        }else{
                            value.clientAnswer = value1.questionAnswer.answer.answer;    
                        }
                        
                    }
                });
            });

            console.log(vm.testResult.questionAnswerTestResult);
        };
        
        vm.isRuntimeDailyListening = listening.isRuntime;
        vm.changeDailyListeningAnswer = function (pack) {
            var question = pack.subQuestions[0], answer = question.questionAnswers[0];
            var results = vm.testResult.questionAnswerTestResult || [];
            question.answered = !!(pack._listeningSession && pack._listeningSession.passed);
            vm.testResult.questionAnswerTestResult = results.filter(function (result) {
                return result.ordinalNumber != question.ordinalNumber;
            });
            if (answer.id != null) {
                vm.testResult.questionAnswerTestResult.push({questionAnswer: answer, ordinalNumber: question.ordinalNumber, clientAnswer: answer.clientAnswer});
            }
            saveReadingDraft();
        };

        vm.changeTextQuestionAnswer = function (questionAnswer,answer,question) {
            // console.log(questionAnswer);
            // console.log(answer);
            // console.log(question);

            var x = document.getElementById("matching-heading-drop-box-" + question.ordinalNumber);
            if(x != null && angular.isDefined(x)){
                document.getElementById("matching-heading-drop-box-" + question.ordinalNumber).size = questionAnswer.clientAnswer.length;
            }

            for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++) {//passage

                for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++) {//package

                    for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question


                        if(questionAnswer.clientAnswer != null && questionAnswer.clientAnswer.length > 0 && answer != null && answer.length > 0){

                            if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
                            }

                            //splice the old one
                            for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                if(angular.isDefined(vm.testResult.questionAnswerTestResult[m].questionAnswer.question)){
                                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                        vm.testResult.questionAnswerTestResult.splice(m,1);
                                    }
                                }
                            }


                            //add the new one
                            var qat = {};
                            qat.questionAnswer = questionAnswer;
                            qat.ordinalNumber = question.ordinalNumber;

                            qat.clientAnswer = questionAnswer.clientAnswer.trim();

                            vm.testResult.questionAnswerTestResult.push(qat);

                        } else {
                            if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {

                                for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
                                    if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
                                        vm.testResult.questionAnswerTestResult.splice(m,1);
                                    }
                                }

                                vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
                            }
                        }
                    }
                }
            }


            console.log("-----------");
            console.log(vm.testResult);
            console.log("===========");


        };


        vm.hoverAnswerMatchingHeading= function (k,i,j,x,qOrdinalNumber) {
            // console.log('mouseleave');
            // var content = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent;
            // if(content != null){
            //     document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent = '';
            //     // var flexWidth = (document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value.length+1) + 'ch';
            //     document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).style.width = 200+'px';
            // }


        };
        vm.changeTextQuestionAnswerMatchingHeading = function (k,i,j,x,qOrdinalNumber) {
            console.log('change');

            // questionAnswer = JSON.parse(questionAnswer);
            // question = JSON.parse(question);
            // document.getElementById("matching-heading-drop-box-" + question.ordinalNumber).textContent
            // document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).textContent;

            var content = document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value;
            var flexWidth = (document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).value.length+1) + 'ch';
            document.getElementById("matching-heading-drop-box-" + qOrdinalNumber).style.width = flexWidth;


            // for (var i = 0; i < vm.ieltsReadingActualTest.subQuestions.length; i++) {//passage
            //
            //     for (var j = 0; j < vm.ieltsReadingActualTest.subQuestions[i].subQuestions.length; j++) {//package
            //
            //         for (var k = 0; k < vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions.length; k++) {//question
            //
            //
            //             if(questionAnswer.clientAnswer != null && questionAnswer.clientAnswer.length > 0 && answer != null && answer.length > 0){
            //
            //                 if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {
            //
            //                     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = true;
            //                 }
            //
            //                 //splice the old one
            //                 for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
            //                     if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
            //                         vm.testResult.questionAnswerTestResult.splice(m,1);
            //                     }
            //                 }
            //
            //
            //                 //add the new one
            //                 var qat = {};
            //                 qat.questionAnswer = questionAnswer;
            //                 qat.ordinalNumber = question.ordinalNumber;
            //
            //                 qat.clientAnswer = questionAnswer.clientAnswer.trim();
            //
            //                 vm.testResult.questionAnswerTestResult.push(qat);
            //
            //             } else {
            //                 if (question.id == vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].id) {
            //
            //                     for (var m = 0; m < vm.testResult.questionAnswerTestResult.length; m++){
            //                         if(vm.testResult.questionAnswerTestResult[m].questionAnswer.question.id == question.id){
            //                             vm.testResult.questionAnswerTestResult.splice(m,1);
            //                         }
            //                     }
            //
            //                     vm.ieltsReadingActualTest.subQuestions[i].subQuestions[j].subQuestions[k].answered = false;
            //                 }
            //             }
            //         }
            //     }
            // }


            console.log("-----------");
            console.log(vm.testResult);
            console.log("===========");


        };
        // $scope.currentUser = {id:'',displayName: ''};
        // $rootScope.$on('$onCurrentUserData', function (event, data) {
        //
        //     if (data != null) {
        //         $scope.currentUser = data;
        //     }
        //     console.log($scope.currentUser);
        //
        //
        // });

        // $scope.models = [
        //     {
        //         listName: "A",
        //         items: [],
        //         dragging: false},
        //     {
        //         listName: "B",
        //         items: [],
        //         dragging: false}
        // ];

        /**
         * dnd-dragging determines what data gets serialized and send to the receiver
         * of the drop. While we usually just send a single object, we send the array
         * of all selected items here.
         */
        $scope.getSelectedItemsIncluding = function(list, item) {
            item.selected = true;

            return item;
            // return list.items.filter(function(item) { return item.selected; });
        };

        function syncMatchingHeadingAnswered(lists) {
            var entries = getReadingQuestionEntries();
            var results = vm.testResult.questionAnswerTestResult;
            angular.forEach(lists || [], function (list) {
                var slot = list && list.items && list.items[0];
                var question = slot && slot.question;
                var droppedAnswer = slot && slot.objectFromListB;
                var hasDroppedAnswer = droppedAnswer != null &&
                    Object.getOwnPropertyNames(droppedAnswer).length > 0;

                if (question) {
                    question.answered = hasDroppedAnswer;
                    // questionAnswer.question is a DTO copy, not the question
                    // instance used by the bottom question palette.
                    angular.forEach(entries, function (entry) {
                        if ((question.id != null && entry.question.id == question.id) ||
                            (question.ordinalNumber != null && entry.question.ordinalNumber == question.ordinalNumber)) {
                            entry.question.answered = hasDroppedAnswer;
                        }
                    });

                    // Keep one result per heading and remove it when cleared.
                    // The number displayed in an empty slot is a placeholder,
                    // not a student's answer.
                    for (var i = results.length - 1; i >= 0; i--) {
                        var result = results[i];
                        var resultQuestion = result.questionAnswer && result.questionAnswer.question;
                        if ((question.ordinalNumber != null && result.ordinalNumber == question.ordinalNumber) ||
                            (question.id != null && resultQuestion && resultQuestion.id == question.id)) {
                            results.splice(i, 1);
                        }
                    }
                    if (hasDroppedAnswer) {
                        results.push({questionAnswer: slot, ordinalNumber: question.ordinalNumber,
                            clientAnswer: slot.clientAnswer});
                    }
                }
            });
        }

        /**
         * We set the list into dragging state, meaning the items that are being
         * dragged are hidden. We also use the HTML5 API directly to set a custom
         * image, since otherwise only the one item that the user actually dragged
         * would be shown as drag image.
         */
        $scope.onDragstart = function(list, event) {
            // list.dragging = true;
            if (event.dataTransfer.setDragImage) {
                // var img = new Image();
                // img.src = 'framework/vendor/ic_content_copy_black_24dp_2x.png';
                // event.dataTransfer.setDragImage(img, 0, 0);
            }
        };

        /**
         * In the dnd-drop callback, we now have to handle the data array that we
         * sent above. We handle the insertion into the list ourselves. By returning
         * true, the dnd-list directive won't do the insertion itself.
         */
        $scope.onDropA = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA.length; x++){
                        if($scope.listA[x].items[0].id === items.id){
                            $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                            $scope.listA[x].items[0].ordinalFromListB = null;
                            $scope.listA[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(items.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB.items.length; x++){
                        if(items.id === $scope.listB.items[x].id){
                            $scope.listB.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            syncMatchingHeadingAnswered($scope.listA);
            return true;
        };

        $scope.onDropB = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB.items[x].id){
                        $scope.listB.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA.length; x++){
                    if($scope.listA[x].items[0].id === items.id){
                        $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                        $scope.listA[x].items[0].ordinalFromListB = null;
                        $scope.listA[x].items[0].objectFromListB = null;
                    }
                }
            }


            // console.log('B');
            // console.log($scope.listB);
            // console.log('A');
            // console.log($scope.listA);

            syncMatchingHeadingAnswered($scope.listA);
            return true;
        };


        $scope.onDropA2 = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA2.length; x++){
                        if($scope.listA2[x].items[0].id === items.id){
                            $scope.listA2[x].items[0].clientAnswer = $scope.listA2[x].items[0].question.ordinalNumber;
                            $scope.listA2[x].items[0].ordinalFromListB = null;
                            $scope.listA2[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(items.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB2.items.length; x++){
                        if(items.id === $scope.listB2.items[x].id){
                            $scope.listB2.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            syncMatchingHeadingAnswered($scope.listA2);
            return true;
        };

        $scope.onDropB2 = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB2.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB2.items[x].id){
                        $scope.listB2.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA2.length; x++){
                    if($scope.listA2[x].items[0].id === items.id){
                        $scope.listA2[x].items[0].clientAnswer = $scope.listA2[x].items[0].question.ordinalNumber;
                        $scope.listA2[x].items[0].ordinalFromListB = null;
                        $scope.listA2[x].items[0].objectFromListB = null;
                    }
                }
            }

            syncMatchingHeadingAnswered($scope.listA2);
            return true;
        };

        $scope.onDropA3 = function(list, items, index) {

            if(items.typeDnD === 1){
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    // list.items[0].clientAnswer = items.clientAnswer;
                    // list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    // list.items[0].objectFromListB = items;
                    //
                    // //xóa dữ liệu item
                    // for(var x = 0; x < $scope.listA.length; x++){
                    //     if($scope.listA[x].items[0].id === items.id){
                    //         $scope.listA[x].items[0].clientAnswer = $scope.listA[x].items[0].question.ordinalNumber;
                    //         $scope.listA[x].items[0].ordinalFromListB = null;
                    //         $scope.listA[x].items[0].objectFromListB = {};
                    //     }
                    // }
                } else {
                    //gán list = item
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.objectFromListB.ordinalNumberQuestionAnswer;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = items.objectFromListB;

                    //xóa dữ liệu item
                    for(var x = 0; x < $scope.listA3.length; x++){
                        if($scope.listA3[x].items[0].id === items.id){
                            $scope.listA3[x].items[0].clientAnswer = $scope.listA3[x].items[0].question.ordinalNumber;
                            $scope.listA3[x].items[0].ordinalFromListB = null;
                            $scope.listA3[x].items[0].objectFromListB = {};
                        }
                    }
                }

            } else {
                if(typeof list.items[0].objectFromListB === "undefined" || list.items[0].objectFromListB == null || Object.getOwnPropertyNames(list.items[0].objectFromListB).length === 0){
                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(items.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = true;
                        }
                    }
                } else {
                    list.items[0].clientAnswer = '';
                    list.items[0].ordinalFromListB = null;

                    // trước khi gán thì phải hiển thị thằng list B của thằng A bị thay thế.
                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(list.items[0].objectFromListB.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = false;
                        }
                    }

                    list.items[0].objectFromListB = null;

                    list.items[0].clientAnswer = items.clientAnswer;
                    list.items[0].ordinalFromListB = items.ordinalNumberQuestionAnswer;
                    list.items[0].objectFromListB = items;

                    for(var x = 0; x < $scope.listB3.items.length; x++){
                        if(items.id === $scope.listB3.items[x].id){
                            $scope.listB3.items[x].isHide = true;
                        }
                    }
                }
            }


            // console.log(list.items[0]);

            syncMatchingHeadingAnswered($scope.listA3);
            return true;
        };

        $scope.onDropB3 = function(list, items, index) {

            if(items.typeDnD !== 2 && typeof items.ordinalFromListB !== "undefined"){
                var ordinalNumber = items.ordinalFromListB;

                // list.items.splice(ordinalNumber-1, 0, items.objectFromListB);
                for(var x = 0; x < $scope.listB3.items.length; x++){
                    if(items.objectFromListB.id === $scope.listB3.items[x].id){
                        $scope.listB3.items[x].isHide = false;
                    }
                }

                for(var x = 0; x < $scope.listA3.length; x++){
                    if($scope.listA3[x].items[0].id === items.id){
                        $scope.listA3[x].items[0].clientAnswer = $scope.listA3[x].items[0].question.ordinalNumber;
                        $scope.listA3[x].items[0].ordinalFromListB = null;
                        $scope.listA3[x].items[0].objectFromListB = null;
                    }
                }
            }

            syncMatchingHeadingAnswered($scope.listA3);
            return true;
        };
        

        /**
         * Last but not least, we have to remove the previously dragged items in the
         * dnd-moved callback.
         */
        $scope.onMoved = function(list) {
            list.items = list.items.filter(function(item) { return !item.selected; });
        };


        $scope.tinymceOptionsToCreateQuestionForReadingTestPassageActualTest = {
            height: 600,
            // placeholder: "Ask a question or post an update...",
            // selector: 'textarea',
            theme: 'modern',
            // selector: 'div',
            // auto_focus: true,
            // plugins: 'wordcount',
            plugins: [
                'contextmenu image lists link  table textcolor'
            ],

            toolbar1: ' link image inserttable | cell row column deletetable | numlist bullist | forecolor backcolor',
            contextmenu: 'link image inserttable | cell row column deletetable | numlist bullist',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content_ielts_reading_actual_test.css'
            ],

            // autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false,
            // readonly : 1
            contextmenu_never_use_native: true
        };



        // Model to JSON for demo purpose
        // $scope.$watch('models', function(model) {
        //     $scope.modelAsJson = angular.toJson(model, true);
        // }, true);
        //
        // $scope.drag_types = [
        //     {name: "Charan"},
        //     {name: "Vijay"},
        //     {name: "Mahesh"},
        //     {name: "Dhananjay"},
        // ];
        // $scope.items = [];
        // //
        //
        // var currentDrag;
        // var currentHideDrags = [];
        // $scope.handleDragStart = function(e){
        //     // this.style.opacity = '0.4';
        //     e.dataTransfer.setData('text/plain', this.innerHTML);
        //
        //     if(e.currentTarget.className === "drag-matching-heading"){
        //         currentDrag = e.currentTarget;
        //     }
        //
        //
        //     // console.log(currentDrag);
        // };
        //
        // $scope.handleDragEnd = function(e){
        //     // this.style.opacity = '1.0';
        //     // console.log(e);
        //     console.log(e.currentTarget);
        //
        //     // var currentTarget = document.getElementById(e.currentTarget.id);
        //     // var currentTargetId = e.currentTarget.id;
        //     // var a = [];
        //     // a = currentTargetId.split("-");
        //     // var currentQOrdinalNumber = a[a.length-1];
        //     //
        //     // if(e.currentTarget.textContent != currentQOrdinalNumber){
        //     //     console.log("hello");
        //     //     for(var i = 0; i < currentHideDrags.length;i++){
        //     //         if(currentHideDrags[i].textContent === e.currentTarget.textContent){
        //     //             console.log("hello1");
        //     //         }
        //     //     }
        //     // } else {
        //     //     console.log("hi");
        //     //
        //     // }
        //
        // };
        //
        // $scope.handleDrop = function(e){
        //     e.preventDefault();
        //     e.stopPropagation();
        //     var dataText = e.dataTransfer.getData('text/plain');
        //     var currentTarget = document.getElementById(e.currentTarget.id);
        //     var currentTargetId = e.currentTarget.id;
        //     var a = [];
        //     a = currentTargetId.split("-");
        //     var currentQOrdinalNumber = a[a.length-1];
        //
        //     document.getElementById(e.currentTarget.id).textContent = dataText;
        //
        //     var flexWidth = (document.getElementById(e.currentTarget.id).textContent.length+1) + 'ch';
        //     document.getElementById(e.currentTarget.id).style.width = flexWidth;
        //
        //
        //     //hide current Drag
        //     if(typeof currentDrag === 'undefined'){
        //
        //     } else{
        //         currentDrag.style.display = 'none';
        //     }
        //
        //
        //
        //     // currentDrag.ordinalNumber = c
        //     currentHideDrags.push(currentDrag);
        //     console.log(currentHideDrags);
        //
        //
        //     // $scope.$apply(function() {
        //     //
        //     // });
        //     // console.log($scope.items);
        // };
        //
        // $scope.handleDragOver = function (e) {
        //     e.preventDefault(); // Necessary. Allows us to drop.
        //     e.dataTransfer.dropEffect = 'move';  // See the section on the DataTransfer object.
        //     return false;
        // };

        vm.length = '65';
        vm.changeLength = function () {
            // var a = document.querySelector('.passage-text');
            // var b = document.querySelector('.question-content');
            var t1 = document.querySelector('#passage-text-1');
            var t2 = document.querySelector('#passage-text-2');
            var t3 = document.querySelector('#passage-text-3');
            t1.style.height = vm.length+'vh';
            t2.style.height = vm.length+'vh';
            t3.style.height = vm.length+'vh';

            var q1 = document.querySelector('#passage-question-text-1');
            var q2 = document.querySelector('#passage-question-text-2');
            var q3 = document.querySelector('#passage-question-text-3');

            q1.style.height = vm.length+'vh';
            q2.style.height = vm.length+'vh';
            q3.style.height = vm.length+'vh';

            // a.style.height = vm.length+'vh';
            // b.style.height = vm.length+'vh';
        };

        vm.fontSize = '18';
        // vm.changeFontSize = function () {
        //     var styleSizeArray = [];
        //     var a = document.querySelector('#passage-text-1 > p > span');
        //     var a1 = document.querySelector('#passage-text-1 > p > span > span');
        //     var a2 = document.querySelector('#passage-text-1 > p > span > em');
        //     var a3 = document.querySelector('#passage-text-1 > h2 > span > span');
        //     styleSizeArray.push(a);
        //     styleSizeArray.push(a1);
        //     styleSizeArray.push(a2);
        //
        //     var size = 'font-size: ' + vm.fontSize + 'px !important';
        //     console.log(size);
        //     var timeoutSize;
        //     timeoutSize = $timeout(function(){
        //         a.setAttribute('style', 'font-size: 50px !important');
        //         console.log(a.style.fontSize);
        //     },100);
        // };

        vm.questionChange = function () {
            console.log(vm.ieltsReadingActualTest.subQuestions[0].question);
        };

        function handleBrowserFindShortcut(e) {
            var key = String(e.key || '').toLowerCase();
            var isFindShortcut = (e.ctrlKey || e.metaKey) && (key === 'f' || e.keyCode === 70);
            var isFindNextShortcut = key === 'f3' || e.keyCode === 114;

            // Study mode may use the browser's native page search. Serious mode
            // keeps the existing shortcut restriction for the live exam.
            if (!vm.isStudyMode() && (isFindShortcut || isFindNextShortcut)) {
                e.preventDefault();
            }
        }

        $window.addEventListener('keydown', handleBrowserFindShortcut);
        $scope.$on('$destroy', function () {
            $window.removeEventListener('keydown', handleBrowserFindShortcut);
        });


        //DROP BOX PASSAGE 1
        // vm.testMedia = {};
        vm.initAnswer = true;
        vm.listDisplayAnswers = [];
        vm.listStringSelected = [];
        vm.previvouslySelected = false;
        
        vm.selectHeadingMedia1 = function (x, itemSubQuestions, q, clientAnswer, subQuestions) {

            var listCorrectAnswer = [];
            for(var a = 0; a < subQuestions.length; a++){ // get question answers from each heading
                for(var b = 0; b < subQuestions[a].questionAnswers.length; b++){ // get correct answer
                    if(subQuestions[a].questionAnswers[b].correct == true){
                        var answer = {};
                        answer.ordinalNumber = subQuestions[a].ordinalNumber;
                        answer.answer = subQuestions[a].questionAnswers[b];
                        listCorrectAnswer.push(answer);
                    }
                }
            }

            if(vm.initAnswer == true){
                for(var a = 0; a < listCorrectAnswer.length; a++){
                    var qat = {};
                    qat.questionAnswer = listCorrectAnswer[a].answer;
                    qat.clientAnswer = '';
                    qat.ordinalNumber = listCorrectAnswer[a].ordinalNumber;
                    vm.testResult.questionAnswerTestResult.push(qat);
                }
                vm.initAnswer = false;
            }

            for(var i = 0; i < vm.testResult.questionAnswerTestResult.length ; i++){
                if(vm.testResult.questionAnswerTestResult[i].ordinalNumber == q.ordinalNumber){
                    if(angular.isDefined(x) && x != null && angular.isDefined(x.answer)){
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = x.answer.answer.answer;
                    } else{
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = '';
                    }

                }
            }

            // console.log(vm.testResult.questionAnswerTestResult);

            var firstPoint = subQuestions[0].ordinalNumber;
            var lastPoint = subQuestions[subQuestions.length-1].ordinalNumber;

            if(vm.testResult.questionAnswerTestResult.length < 1){ // chua co test result thi khong gan duoc nen gan truc tiep gia tri dau tien luon
                vm.listStringSelected = [];
                vm.listStringSelected.push(clientAnswer);
            }else{
                vm.listStringSelected = [];
                for(var i = 0; i < vm.testResult.questionAnswerTestResult.length; i++){
                    if(vm.testResult.questionAnswerTestResult[i].ordinalNumber >= firstPoint && vm.testResult.questionAnswerTestResult[i].ordinalNumber <= lastPoint){
                        var text = "";
                        text = vm.testResult.questionAnswerTestResult[i].clientAnswer;
                        vm.listStringSelected.push(vm.testResult.questionAnswerTestResult[i].clientAnswer);
                    }
                }
            }

            // console.log(vm.listStringSelected);

            //reset selected media
            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    subQuestions[i].questionAnswers[j].selectedMedia = false; // gán lại false để đặt lại
                }
            }

            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    for (var k = 0; k < vm.listStringSelected.length; k++) { //check từng iem trong list answer xem có trùng trong list đã chọn không
                        if(subQuestions[i].questionAnswers[j].answer.answer === vm.listStringSelected[k]){ //nếu bằng thì set nó là đã được chọn thôi
                            subQuestions[i].questionAnswers[j].selectedMedia = true;
                            // q.answered = true;
                        }
                    }
                }
            }

            if(angular.isDefined(x.answer) && x.answer != null){
                q.answered = true;
            }else{
                q.answered = false;
            }

        };

        //DROP BOX PASSAGE 1

        //DROP BOX PASSAGE 2
        // vm.testMedia = {};
        vm.initAnswer2 = true;
        // vm.listDisplayAnswers = [];
        vm.listStringSelected2 = [];
        // vm.previvouslySelected = false;

        vm.selectHeadingMedia2 = function (x, itemSubQuestions, q, clientAnswer, subQuestions) {

            var listCorrectAnswer = [];
            for(var a = 0; a < subQuestions.length; a++){ // get question answers from each heading
                for(var b = 0; b < subQuestions[a].questionAnswers.length; b++){ // get correct answer
                    if(subQuestions[a].questionAnswers[b].correct == true){
                        var answer = {};
                        answer.ordinalNumber = subQuestions[a].ordinalNumber;
                        answer.answer = subQuestions[a].questionAnswers[b];
                        listCorrectAnswer.push(answer);
                    }
                }
            }

            if(vm.initAnswer2 == true){
                for(var a = 0; a < listCorrectAnswer.length; a++){
                    var qat = {};
                    qat.questionAnswer = listCorrectAnswer[a].answer;
                    qat.clientAnswer = '';
                    qat.ordinalNumber = listCorrectAnswer[a].ordinalNumber;
                    vm.testResult.questionAnswerTestResult.push(qat);
                }
                vm.initAnswer2 = false;
            }

            for(var i = 0; i < vm.testResult.questionAnswerTestResult.length ; i++){
                if(vm.testResult.questionAnswerTestResult[i].ordinalNumber == q.ordinalNumber){
                    if(angular.isDefined(x) && x != null && angular.isDefined(x.answer)){
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = x.answer.answer.answer;
                    } else{
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = '';
                    }

                }
            }



            var firstPoint = subQuestions[0].ordinalNumber;
            var lastPoint = subQuestions[subQuestions.length-1].ordinalNumber;

            if(vm.testResult.questionAnswerTestResult.length < 1){ // chua co test result thi khong gan duoc nen gan truc tiep gia tri dau tien luon
                vm.listStringSelected2 = [];
                vm.listStringSelected2.push(clientAnswer);
            }else{
                vm.listStringSelected2 = [];
                for(var i = 0; i < vm.testResult.questionAnswerTestResult.length; i++){
                    if(vm.testResult.questionAnswerTestResult[i].ordinalNumber >= firstPoint && vm.testResult.questionAnswerTestResult[i].ordinalNumber <= lastPoint){
                        var text = "";
                        text = vm.testResult.questionAnswerTestResult[i].clientAnswer;
                        vm.listStringSelected2.push(vm.testResult.questionAnswerTestResult[i].clientAnswer);
                    }
                }
            }

            console.log(vm.listStringSelected2);

            //reset selected media
            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    subQuestions[i].questionAnswers[j].selectedMedia = false; // gán lại false để đặt lại
                    // subQuestions[i].answered = false;
                }
            }

            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    for (var k = 0; k < vm.listStringSelected2.length; k++) { //check từng iem trong list answer xem có trùng trong list đã chọn không
                        if(subQuestions[i].questionAnswers[j].answer.answer === vm.listStringSelected2[k]){ //nếu bằng thì set nó là đã được chọn thôi
                            subQuestions[i].questionAnswers[j].selectedMedia = true;

                        }
                    }
                }
            }

            if(angular.isDefined(x.answer) && x.answer != null){
                q.answered = true;
            }else{
                q.answered = false;
            }


            console.log(vm.testResult.questionAnswerTestResult);

        };

        //DROP BOX PASSAGE 2

        //DROP BOX PASSAGE 3
        // vm.testMedia = {};
        vm.initAnswer3 = true;
        // vm.listDisplayAnswers = [];
        vm.listStringSelected3 = [];
        // vm.previvouslySelected = false;

        vm.selectHeadingMedia3 = function (x, itemSubQuestions, q, clientAnswer, subQuestions) {

            var listCorrectAnswer = [];
            for(var a = 0; a < subQuestions.length; a++){ // get question answers from each heading
                for(var b = 0; b < subQuestions[a].questionAnswers.length; b++){ // get correct answer
                    if(subQuestions[a].questionAnswers[b].correct == true){
                        var answer = {};
                        answer.ordinalNumber = subQuestions[a].ordinalNumber;
                        answer.answer = subQuestions[a].questionAnswers[b];
                        listCorrectAnswer.push(answer);
                    }
                }
            }

            if(vm.initAnswer3 == true){
                for(var a = 0; a < listCorrectAnswer.length; a++){
                    var qat = {};
                    qat.questionAnswer = listCorrectAnswer[a].answer;
                    qat.clientAnswer = '';
                    qat.ordinalNumber = listCorrectAnswer[a].ordinalNumber;
                    vm.testResult.questionAnswerTestResult.push(qat);
                }
                vm.initAnswer3 = false;
            }

            for(var i = 0; i < vm.testResult.questionAnswerTestResult.length ; i++){
                if(vm.testResult.questionAnswerTestResult[i].ordinalNumber == q.ordinalNumber){
                    if(angular.isDefined(x) && x != null && angular.isDefined(x.answer)){
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = x.answer.answer.answer;
                    } else{
                        vm.testResult.questionAnswerTestResult[i].clientAnswer = '';
                    }

                }
            }

            var firstPoint = subQuestions[0].ordinalNumber;
            var lastPoint = subQuestions[subQuestions.length-1].ordinalNumber;

            if(vm.testResult.questionAnswerTestResult.length < 1){ // chua co test result thi khong gan duoc nen gan truc tiep gia tri dau tien luon
                vm.listStringSelected3 = [];
                vm.listStringSelected3.push(clientAnswer);
            }else{
                vm.listStringSelected3 = [];
                for(var i = 0; i < vm.testResult.questionAnswerTestResult.length; i++){
                    if(vm.testResult.questionAnswerTestResult[i].ordinalNumber >= firstPoint && vm.testResult.questionAnswerTestResult[i].ordinalNumber <= lastPoint){
                        var text = "";
                        text = vm.testResult.questionAnswerTestResult[i].clientAnswer;
                        vm.listStringSelected3.push(vm.testResult.questionAnswerTestResult[i].clientAnswer);
                    }
                }
            }

            // console.log(vm.listStringSelected);

            //reset selected media
            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    subQuestions[i].questionAnswers[j].selectedMedia = false; // gán lại false để đặt lại
                }
            }

            for (var i = 0; i < subQuestions.length; i++){ //list của các question
                for(var j = 0; j < subQuestions[i].questionAnswers.length; j++) { //list answer của từng thằng
                    for (var k = 0; k < vm.listStringSelected3.length; k++) { //check từng iem trong list answer xem có trùng trong list đã chọn không
                        if(subQuestions[i].questionAnswers[j].answer.answer === vm.listStringSelected3[k]){ //nếu bằng thì set nó là đã được chọn thôi
                            subQuestions[i].questionAnswers[j].selectedMedia = true;
                        }
                    }
                }
            }

            if(angular.isDefined(x.answer) && x.answer != null){
                q.answered = true;
            }else{
                q.answered = false;
            }

            console.log(vm.testResult.questionAnswerTestResult);

        };

        //DROP BOX PASSAGE 3


        (function disableAllAutocomplete(){
            const SELECTOR = 'input, textarea';
            const AUTOFILL_TYPES = new Set(['text','email','search','tel','url','password','number']);

            function harden(el){
                if (!el || el.__noAutofill) return;
                el.__noAutofill = true;

                // Form-level signal
                if (el.form) el.form.setAttribute('autocomplete','off');

                // Input-level signals
                el.setAttribute('autocomplete','off');
                el.setAttribute('autocapitalize','off');
                el.setAttribute('autocorrect','off');
                el.setAttribute('spellcheck','false');

                // Prevent silent autofill on paint; unlock on first user intent
                if (AUTOFILL_TYPES.has((el.type || 'text').toLowerCase())) {
                    el.setAttribute('readonly','readonly');
                    const unlock = () => el.removeAttribute('readonly');
                    ['pointerdown','focus','keydown','touchstart'].forEach(evt =>
                    el.addEventListener(evt, unlock, { once:true, capture:true })
                );
                }
            }

            // Initial pass
            document.querySelectorAll(SELECTOR).forEach(harden);

            // Observe future additions
            const mo = new MutationObserver(muts => {
                    for (const m of muts) {
                m.addedNodes && m.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                if (n.matches && n.matches(SELECTOR)) harden(n);
                n.querySelectorAll && n.querySelectorAll(SELECTOR).forEach(harden);
            });
            }
        });
            mo.observe(document.documentElement, { childList:true, subtree:true });

            // Optional: add off-screen decoys for aggressive password managers
            // (uncomment if needed)
            /*
             document.querySelectorAll('form').forEach(f => {
             const mk = (type,name,ac) => {
             const i = document.createElement('input');
             i.type = type; i.name = name; i.autocomplete = ac; i.tabIndex = -1;
             i.style.cssText='position:absolute;left:-9999px;opacity:0;width:0;height:0;';
             return i;
             };
             f.prepend(mk('text','fake-username','username'));
             f.prepend(mk('password','fake-password','new-password'));
             });
             */
        })();

        window.addEventListener('contextmenu', function (e) {
            // document.body.innerHTML += '<p>Right-click is disabled</p>'
            e.preventDefault();
        }, false);

        function makesvg(percentage, inner_text=""){

            var abs_percentage = Math.abs(percentage).toString();
            var percentage_str = percentage.toString();
            var classes = ""

            if(percentage < 0){
                classes = "danger-stroke circle-chart__circle--negative";
            } else if(percentage > 0 && percentage <= 30){
                classes = "warning-stroke";
            } else{
                classes = "success-stroke";
            }

            var svg = '<svg class="circle-chart" viewbox="0 0 33.83098862 33.83098862" xmlns="http://www.w3.org/2000/svg">'
                + '<circle class="circle-chart__background" cx="16.9" cy="16.9" r="15.9" />'
                + '<circle class="circle-chart__circle '+classes+'"'
                + 'stroke-dasharray="'+ abs_percentage+',100"    cx="16.9" cy="16.9" r="15.9" />'
                + '<g class="circle-chart__info">'
                + '   <text class="circle-chart__percent" x="17.9" y="15.5">'+percentage_str+'%</text>';

            if(inner_text){
                svg += '<text class="circle-chart__subline" x="16.91549431" y="22">'+inner_text+'</text>'
            }

            svg += ' </g></svg>';

            return svg
        }

        $.fn.circlechart = function(text) {
            this.each(function() {
                var percentage = $(this).data("percentage");
                // var inner_text = $(this).text();
                $(this).html(makesvg(percentage, text));
            });
            return this;
        };


        // $('.circlechart').circlechart();

        // vm.afterSubmit = function () {
        //
        // };

        if (vm.isPreviewMode) {
            $timeout(function () {
                vm.startTest();
            }, 0);
        } else {
            function startPendingReadingDraft() {
                if (readingDraftDestroyed || startFreshSeriousTest || vm.isStartTest || vm.isStartingTest) { return; }
                if (vm.assignmentTaskId) { $timeout(function () { vm.requestStartTest(); }, 0); return; }
                var pendingReadingDraft = readReadingDraft($stateParams.ieltsReadingTestId, requestedSessionMode);
                if (!pendingReadingDraft) {
                    if (requestedSessionMode === 'STUDY') { $timeout(function () { vm.requestStartTest(); }, 0); }
                    return;
                }
                if (String(pendingReadingDraft.testId) !== String($stateParams.ieltsReadingTestId)) { return; }
                vm.testSessionMode = pendingReadingDraft.sessionMode === 'STUDY' ? 'STUDY' : 'SERIOUS';
                vm.selectedTestSessionMode = vm.testSessionMode;
                vm.isLearningReview = !vm.assignmentTaskId && pendingReadingDraft.completed === true;
                $timeout(function () {
                    vm.startTest();
                }, 0);
            }
            if (readingLearningDraftsReady) {
                readingLearningDraftsReady.then(function (success) {
                    if (success) { startPendingReadingDraft(); }
                }, angular.noop);
            } else {
                startPendingReadingDraft();
            }
        }

        //--------------------- End Reading Actual test -------------------------//



    }

})();
