(function () {
    'use strict';

    angular.module('Hrm.Question').directive('dailyListeningTimestamps', [function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var destroyed = false;
                var root = element[0];

                function decorate() {
                    if (destroyed || !scope.$eval(attrs.dailyListeningTimestamps)) { return; }
                    // Decorate the rendered transcript so existing drafts keep their original gap HTML.
                    var walker = document.createTreeWalker(root, 4), nodes = [], node;
                    while ((node = walker.nextNode())) {
                        if (node.nodeValue.indexOf('[') >= 0 && !node.parentElement.closest('a, button, input, textarea, script, style, .gap-inline-wrap')) {
                            nodes.push(node);
                        }
                    }
                    nodes.forEach(function (textNode) {
                        var text = textNode.nodeValue;
                        var pattern = /\[(?:(\d{1,3}):)?(\d{1,3}):([0-5]\d)\]/g;
                        var fragment = document.createDocumentFragment(), cursor = 0, match;
                        while ((match = pattern.exec(text))) {
                            if (match[1] != null && Number(match[2]) >= 60) { continue; }
                            var seconds = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
                            fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
                            var link = document.createElement('a');
                            link.className = 'daily-listening-timestamp';
                            link.href = '#t=' + seconds;
                            link.setAttribute('data-listening-seconds', String(seconds));
                            link.setAttribute('aria-label', 'Nghe từ ' + match[0].slice(1, -1));
                            link.title = 'Tua đến ' + match[0].slice(1, -1);
                            link.textContent = match[0];
                            fragment.appendChild(link);
                            cursor = pattern.lastIndex;
                        }
                        if (!cursor) { return; }
                        fragment.appendChild(document.createTextNode(text.slice(cursor)));
                        textNode.parentNode.replaceChild(fragment, textNode);
                    });
                }

                function seek(event) {
                    var link = event.target.closest && event.target.closest('a.daily-listening-timestamp');
                    if (!link || !root.contains(link)) { return; }
                    event.preventDefault();
                    event.stopPropagation();
                    var seconds = Number(link.getAttribute('data-listening-seconds'));
                    scope.$evalAsync(function () { scope.$eval(attrs.onTimestampSeek, {seconds: seconds}); });
                }

                var unwatch = scope.$watchGroup([attrs.compile, attrs.dailyListeningTimestamps], function () { scope.$evalAsync(decorate); });
                element.on('click', seek);
                scope.$on('$destroy', function () { destroyed = true; unwatch(); element.off('click', seek); });
            }
        };
    }]);
})();
