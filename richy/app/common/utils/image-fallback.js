(function () {
    'use strict';

    // Keep the original ng-src binding so a refreshed photo or corrected product
    // URL can recover after a previous load failure.
    angular.module('Hrm').directive('imageFallback', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var image = element[0];
                var usingFallback = false;
                var destroyed = false;

                function showFallback() {
                    var fallback = attrs.imageFallback;
                    if (destroyed || usingFallback || !fallback) { return; }
                    usingFallback = true;
                    element.addClass('image-fallback');
                    if (element.attr('src') !== fallback) {
                        attrs.$set('src', fallback);
                    }
                }

                function onError() {
                    // A source change may have started a new request before an
                    // older error was delivered. Leave a pending image alone.
                    if (image.complete && image.naturalWidth === 0) {
                        showFallback();
                    }
                }

                function sourceChanged(value) {
                    usingFallback = false;
                    element.removeClass('image-fallback');
                    scope.$evalAsync(function () {
                        if (destroyed) { return; }
                        if (!value || !String(value).trim()) {
                            showFallback();
                        } else {
                            onError(); // Also handles failures cached before linking.
                        }
                    });
                }

                element.on('error', onError);
                var stopObserving;
                if (attrs.ngSrc !== undefined) {
                    stopObserving = attrs.$observe('ngSrc', sourceChanged);
                } else {
                    sourceChanged(attrs.src);
                }

                scope.$on('$destroy', function () {
                    destroyed = true;
                    element.off('error', onError);
                    if (stopObserving) { stopObserving(); }
                });
            }
        };
    });
})();
