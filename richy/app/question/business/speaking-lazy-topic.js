(function () {
    'use strict';

    angular.module('Hrm.Question').directive('speakingLazyTopic', ['$window', function ($window) {
        return {restrict: 'A', link: function (scope, element, attrs) {
            var node = element[0], group = null, observer = null, generation = 0, destroyed = false;
            function disconnect() { if (observer) { observer.disconnect(); observer = null; } }
            function reveal(expected, stamp) {
                if (destroyed || expected !== group || stamp !== generation || !group) { return; }
                group.lazyLoaded = true; disconnect();
            }
            var unwatch = scope.$watchGroup([attrs.speakingLazyTopic, attrs.speakingLazyEager || 'false'], function (values) {
                disconnect(); group = values[0]; var stamp = ++generation, expected = group;
                if (!group || group.lazyLoaded) { return; }
                if (values[1] || !$window.IntersectionObserver) { reveal(expected, stamp); return; }
                try {
                    observer = new $window.IntersectionObserver(function (entries) {
                        if (!entries.some(function (entry) { return entry.target === node && entry.isIntersecting; })) { return; }
                        scope.$evalAsync(function () { reveal(expected, stamp); });
                    }, {rootMargin: '400px'});
                    observer.observe(node);
                } catch (error) { reveal(expected, stamp); }
            });
            var unwatchLoaded = scope.$watch(attrs.speakingLazyTopic + '.lazyLoaded', function (loaded) { if (loaded) { disconnect(); } });
            function focus() { var expected = group, stamp = generation; scope.$evalAsync(function () { reveal(expected, stamp); }); }
            node.addEventListener('focusin', focus);
            scope.$on('$destroy', function () { destroyed = true; generation++; disconnect(); unwatch(); unwatchLoaded(); node.removeEventListener('focusin', focus); });
        }};
    }]);

    // Closed <details> otherwise still creates its Angular bindings and sample
    // text nodes. Mount the body only while the user opens the sample.
    angular.module('Hrm.Question').directive('speakingLazySample', [function () {
        return {restrict: 'A', link: function (scope, element) {
            var node = element[0], destroyed = false;
            scope.spSampleOpen = !!node.open;
            function changed() { scope.$evalAsync(function () { if (!destroyed) { scope.spSampleOpen = !!node.open; } }); }
            node.addEventListener('toggle', changed);
            scope.$on('$destroy', function () { destroyed = true; node.removeEventListener('toggle', changed); });
        }};
    }]);
})();
