(function () {
    'use strict';
    angular.module('Hrm.Question').directive('battleExerciseForm', function () {
        return {
            restrict: 'E', scope: {exercise: '=', answers: '=', disabled: '='},
            templateUrl: 'question/views/battle_online_exercise_form.html?v=' + window.APP_VERSION,
            link: function (scope) {
                scope.choose = function (item, option, multiple) {
                    if (scope.disabled) { return; }
                    var values = scope.answers[item.id] || [];
                    if (!multiple) { scope.answers[item.id] = [option.key]; return; }
                    var index = values.indexOf(option.key);
                    if (index < 0) { values.push(option.key); } else { values.splice(index, 1); }
                    scope.answers[item.id] = values;
                };
                scope.selected = function (item, option) { return (scope.answers[item.id] || []).indexOf(option.key) >= 0; };
                scope.wordCount = function (item) { return String((scope.answers[item.id] || [])[0] || '').trim().split(/\s+/).filter(Boolean).length; };
                scope.$watch('exercise', function (exercise) {
                    scope.answers = scope.answers || {};
                    (exercise && exercise.items || []).forEach(function (item) {
                        if (!scope.answers[item.id]) { scope.answers[item.id] = []; }
                    });
                });
            }
        };
    });

    // Only the static controls are compiled by Angular. Stored passage HTML is sanitized,
    // then native DOM controls replace gap markers; it is never compiled as Angular code.
    angular.module('Hrm.Question').directive('battleExerciseGaps', ['$sanitize', function ($sanitize) {
        return {
            restrict: 'E', scope: {content: '=', items: '=', answers: '=', disabled: '=', mode: '='},
            link: function (scope, element) {
                var controls = [];
                function update() {
                    controls.forEach(function (entry) {
                        entry.control.disabled = !!scope.disabled;
                        var value = (scope.answers[entry.item.id] || [])[0] || '';
                        if (entry.control.value !== value) { entry.control.value = value; }
                    });
                }
                function render() {
                    var root = element[0], doc = root.ownerDocument;
                    root.innerHTML = $sanitize(String(scope.content || '').replace(/\}\{ENTER\}\{/gi, '<br><br>')); controls = [];
                    function makeControl(item) {
                        var control = doc.createElement(scope.mode === 'TEXT' ? 'input' : 'select');
                        control.className = 'battle-exercise-gap';
                        control.setAttribute('aria-label', 'Câu ' + item.number);
                        if (scope.mode === 'TEXT') {
                            control.type = 'text'; control.maxLength = 1000; control.placeholder = String(item.number || 'Điền từ');
                            control.autocomplete = 'off';
                        } else {
                            var empty = doc.createElement('option'); empty.value = ''; empty.textContent = 'Câu ' + item.number;
                            control.appendChild(empty);
                            item.options.forEach(function (option) {
                                var choice = doc.createElement('option'); choice.value = option.key; choice.textContent = option.text;
                                control.appendChild(choice);
                            });
                        }
                        function change() {
                            if (scope.disabled) { return; }
                            var value = control.value;
                            scope.$evalAsync(function () { scope.answers[item.id] = value ? [value] : []; });
                        }
                        control.addEventListener(scope.mode === 'TEXT' ? 'input' : 'change', change);
                        control.addEventListener('dragover', function (event) { if (!scope.disabled && scope.mode !== 'TEXT') { event.preventDefault(); } });
                        control.addEventListener('drop', function (event) {
                            if (scope.disabled || scope.mode === 'TEXT') { return; }
                            event.preventDefault(); var key = event.dataTransfer.getData('text/plain');
                            if (item.options.some(function (option) { return option.key === key; })) { control.value = key; change(); }
                        });
                        controls.push({item: item, control: control}); return control;
                    }
                    var walker = doc.createTreeWalker(root, 4, null, false), nodes = [], node;
                    while ((node = walker.nextNode())) { nodes.push(node); }
                    var index = 0;
                    nodes.forEach(function (textNode) {
                        var text = textNode.nodeValue;
                        var chunks = text.split(/\}\{\s*(?:SPACE|HEADING)\s*\}\{/gi);
                        if (chunks.length < 2) { return; }
                        var fragment = doc.createDocumentFragment();
                        chunks.forEach(function (chunk, c) {
                            fragment.appendChild(doc.createTextNode(chunk));
                            if (c === chunks.length - 1) { return; }
                            var item = (scope.items || [])[index++];
                            if (!item) { fragment.appendChild(doc.createTextNode('[…]')); return; }
                            fragment.appendChild(makeControl(item));
                        });
                        textNode.parentNode.replaceChild(fragment, textNode);
                    });
                    // Older saved questions may have fewer markers than answer rows.
                    // Keep every answer accessible without rewriting the original passage.
                    (scope.items || []).slice(index).forEach(function (item) {
                        var row = doc.createElement('label'); row.textContent = 'Đáp án câu ' + item.number + ' ';
                        row.appendChild(makeControl(item)); root.appendChild(row);
                    });
                    update();
                }
                scope.$watch(function () { return JSON.stringify([scope.content, scope.items, scope.mode]); }, render);
                scope.$watch('answers', update, true); scope.$watch('disabled', update);
            }
        };
    }]);
    angular.module('Hrm.Question').directive('battleExerciseDrag', function () {
        return {link: function (scope, element, attrs) {
            function drag(event) {
                if (scope.$eval(attrs.battleExerciseDisabled)) { event.preventDefault(); return; }
                event.dataTransfer.setData('text/plain', scope.$eval(attrs.battleExerciseDrag).key);
            }
            element[0].addEventListener('dragstart', drag);
            scope.$on('$destroy', function () { element[0].removeEventListener('dragstart', drag); });
        }};
    });
    angular.module('Hrm.Question').directive('battleExerciseDrop', function () {
        return {link: function (scope, element, attrs) {
            function over(event) { if (!scope.$eval(attrs.battleExerciseDisabled)) { event.preventDefault(); } }
            function drop(event) {
                if (scope.$eval(attrs.battleExerciseDisabled)) { return; }
                event.preventDefault(); var item = scope.$eval(attrs.battleExerciseDrop), key = event.dataTransfer.getData('text/plain');
                if (item.options.some(function (option) { return option.key === key; })) {
                    scope.$evalAsync(function () { scope.answers[item.id] = [key]; });
                }
            }
            element[0].addEventListener('dragover', over); element[0].addEventListener('drop', drop);
            scope.$on('$destroy', function () { element[0].removeEventListener('dragover', over); element[0].removeEventListener('drop', drop); });
        }};
    });
})();
