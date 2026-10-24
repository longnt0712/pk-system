(function () {
    'use strict';

    var app = angular.module('Hrm');
    var customDialogs = [];
    var focusable = 'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable="true"]';

    function visible(node) {
        return !!(node && node.ownerDocument.documentElement.contains(node) &&
            (node.offsetWidth || node.offsetHeight || node.getClientRects().length) &&
            !node.disabled && !node.matches(':disabled') &&
            node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'hidden' &&
            !node.closest('[inert], [aria-hidden="true"]'));
    }

    function focus(node) {
        if (!visible(node)) { return; }
        try { node.focus({preventScroll: true}); } catch (ignoreFocusOptions) { node.focus(); }
    }

    app.factory('DialogFocus', ['$document', '$timeout', '$uibModalStack', function ($document, $timeout, modalStack) {
        var document = $document[0];
        return {
            restore: function (opener) {
                // UI Bootstrap initially restores before ng-disabled on the opener clears.
                // Wait until its close animation and the callers' result handlers finish.
                return $timeout(function () {
                    var nativeTop = modalStack.getTop();
                    var customTop = customDialogs[customDialogs.length - 1];
                    if (nativeTop && !nativeTop.value.modalDomEl[0].contains(opener)) { return; }
                    if (customTop && !customTop.contains(opener)) { return; }
                    var active = document.activeElement;
                    if (active && active !== document.body && active !== document.documentElement &&
                        visible(active) && active !== opener &&
                        !active.closest('.modal, [modal-focus]')) { return; }
                    focus(opener);
                }, 0, false);
            }
        };
    }]);

    app.config(['$provide', function ($provide) {
        $provide.decorator('$uibModal', ['$delegate', '$document', 'DialogFocus', function (modal, $document, dialogFocus) {
            var open = modal.open;
            modal.open = function (options) {
                if (!options || !/comprehensive_move_test_folder_modal\.html(?:\?|$)/.test(options.templateUrl || '')) {
                    return open.apply(modal, arguments);
                }
                var opener = $document[0].activeElement;
                options = angular.extend({}, options, {
                    windowClass: ((options.windowClass || '') + ' test-move-modal-window').trim()
                });
                var instance = open.call(modal, options);
                instance.closed.then(function () { dialogFocus.restore(opener); });
                return instance;
            };
            return modal;
        }]);
    }]);

    // Custom ng-if overlays need the same keyboard lifecycle as native dialogs.
    app.directive('modalFocus', ['$document', '$timeout', '$uibModalStack', 'DialogFocus',
        function ($document, $timeout, modalStack, dialogFocus) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    var document = $document[0], node = element[0], opener = document.activeElement;
                    var stopped = false, nativeAtOpen = modalStack.getTop();
                    node.setAttribute('tabindex', '-1');
                    customDialogs.push(node);
                    angular.element(document.body).addClass('ui-dialog-open');

                    function isTop() {
                        if (customDialogs[customDialogs.length - 1] !== node) { return false; }
                        var nativeTop = modalStack.getTop();
                        return !nativeTop || (nativeAtOpen && nativeTop.key === nativeAtOpen.key);
                    }
                    function items() {
                        return Array.prototype.filter.call(node.querySelectorAll(focusable), function (item) {
                            return visible(item) && item.tabIndex >= 0 && item.type !== 'hidden';
                        });
                    }
                    function initialFocus() { focus(items()[0] || node); }
                    function keydown(event) {
                        if (stopped || !isTop() || event.defaultPrevented) { return; }
                        var key = event.key || event.keyCode;
                        if ((key === 'Escape' || key === 27) && attrs.modalFocusClose) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            scope.$evalAsync(attrs.modalFocusClose);
                        } else if (key === 'Tab' || key === 9) {
                            var list = items(), active = document.activeElement;
                            if (!list.length) { event.preventDefault(); focus(node); return; }
                            if (event.shiftKey && (active === list[0] || !node.contains(active) || active === node)) {
                                event.preventDefault(); focus(list[list.length - 1]);
                            } else if (!event.shiftKey && (active === list[list.length - 1] || !node.contains(active))) {
                                event.preventDefault(); focus(list[0]);
                            }
                        }
                    }
                    function focusin(event) {
                        if (!stopped && isTop() && !node.contains(event.target)) { initialFocus(); }
                    }
                    // Capture before UI Bootstrap's document handler when dialogs are nested.
                    document.addEventListener('keydown', keydown, true);
                    document.addEventListener('focusin', focusin, true);
                    var initial = $timeout(function () {
                        if (!stopped && isTop()) { initialFocus(); }
                    }, 0, false);
                    scope.$on('$destroy', function () {
                        stopped = true;
                        $timeout.cancel(initial);
                        document.removeEventListener('keydown', keydown, true);
                        document.removeEventListener('focusin', focusin, true);
                        var index = customDialogs.indexOf(node);
                        if (index !== -1) { customDialogs.splice(index, 1); }
                        if (!customDialogs.length) { angular.element(document.body).removeClass('ui-dialog-open'); }
                        dialogFocus.restore(opener);
                    });
                }
            };
        }]);

    // This bundled UI Bootstrap predates ariaLabelledBy/ariaDescribedBy options.
    app.directive('uibDialogAccessibility', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var pending = $timeout(function () {
                    var dialog = element[0].closest('.modal[role="dialog"]');
                    var title = element[0].querySelector('.modal-title');
                    var description = element[0].querySelector('.test-move-title');
                    if (!dialog || !title) { return; }
                    title.id = 'test-move-dialog-title-' + scope.$id;
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-labelledby', title.id);
                    if (description) {
                        description.id = 'test-move-dialog-description-' + scope.$id;
                        dialog.setAttribute('aria-describedby', description.id);
                    }
                }, 0, false);
                scope.$on('$destroy', function () { $timeout.cancel(pending); });
            }
        };
    }]);
}());
