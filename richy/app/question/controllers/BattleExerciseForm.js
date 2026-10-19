(function () {
    'use strict';
    angular.module('Hrm.Question').directive('battleExerciseForm', ['$sanitize', 'QuestionDragDrop', function ($sanitize, dragDrop) {
        return {
            restrict: 'E', scope: {exercise: '=', answers: '=', disabled: '=', onAnswer: '&'},
            templateUrl: 'question/views/battle_online_exercise_form.html?v=' + window.APP_VERSION + '&individualQuestions=20261007_1',
            link: function (scope, element) {
                var root = element[0], documentNode = root.ownerDocument, version = 0, selection = null, bindings = [];
                var identity = 'battle-' + Math.random().toString(36).slice(2), mime = 'application/x-battle-answer';
                function type() { return Number((scope.exercise || {}).type); }
                function items() { return (scope.exercise || {}).items || []; }
                function itemById(id) { return items().filter(function (item) { return String(item.id) === String(id); })[0]; }
                function value(item) { return String(((scope.answers || {})[item.id] || [])[0] || ''); }
                function optionFor(item, key) { return item && (item.options || []).filter(function (option) { return String(option.key) === String(key); })[0]; }
                function sameOption(a, b) { return a && b && String(a.key) === String(b.key) && String(a.text || a.html || '') === String(b.text || b.html || ''); }
                function announce(message) { scope.interactionStatus = message; scope.$evalAsync(angular.noop); }
                scope.optionLabel = function (index) {
                    var label = '';
                    for (var next = index + 1; next > 0; next = Math.floor((next - 1) / 26)) { label = String.fromCharCode(65 + (next - 1) % 26) + label; }
                    return label;
                };
                scope.isDragExercise = function () { return [4, 13, 14, 15].indexOf(type()) >= 0 && scope.exercise.answerMode === 'MATCH'; };
                scope.isMatrix = function () { return [9, 10, 12].indexOf(type()) >= 0; };
                scope.isInline = function () { return [4, 11, 13, 18].indexOf(type()) >= 0; };
                scope.isSupported = function () {
                    var modes = {1: ['SINGLE'], 2: ['TEXT'], 3: ['TEXT'], 4: ['MATCH'], 5: ['MULTIPLE'], 6: ['SINGLE'], 7: ['MULTIPLE'], 8: ['MATCH', 'TEXT'], 9: ['SINGLE'], 10: ['MATCH'], 11: ['TEXT'], 12: ['SINGLE'], 13: ['MATCH'], 14: ['MATCH'], 15: ['MATCH'], 16: ['WRITING'], 17: ['WRITING'], 18: ['TEXT', 'LISTENING']};
                    return !!modes[type()] && modes[type()].indexOf((scope.exercise || {}).answerMode) >= 0;
                };
                scope.choose = function (item, option, multiple) {
                    if (scope.disabled || !scope.isSupported() || !optionFor(itemById(item.id), option.key)) { return; }
                    var values = (scope.answers[item.id] || []).slice(), key = String(option.key), index = values.indexOf(key);
                    if (multiple) { if (index < 0) { values.push(key); } else { values.splice(index, 1); } scope.answers[item.id] = values; }
                    else { scope.answers[item.id] = [key]; if (scope.exercise.answerMode === 'SINGLE') { scope.onAnswer(); } }
                };
                scope.selected = function (item, option) { return (scope.answers[item.id] || []).indexOf(String(option.key)) >= 0; };
                scope.wordCount = function (item) { return value(item).trim().split(/\s+/).filter(Boolean).length; };
                scope.bankOptions = [];
                scope.optionUsed = function (option) { return items().some(function (item) { return sameOption(optionFor(item, value(item)), option); }); };
                scope.dragPayload = function (option, sourceId) { return {owner: identity, version: version, key: String(option.key), sourceId: sourceId == null ? null : String(sourceId)}; };
                function valid(payload) {
                    if (scope.disabled || !scope.isDragExercise() || !payload || payload.owner !== identity || payload.version !== version) { return false; }
                    if (payload.sourceId != null) { var source = itemById(payload.sourceId); return !!source && value(source) === payload.key && !!optionFor(source, payload.key); }
                    var option = scope.bankOptions.filter(function (choice) { return String(choice.key) === payload.key; })[0];
                    return !!option && !scope.optionUsed(option);
                }
                function sourceOption(payload) {
                    return payload.sourceId != null ? optionFor(itemById(payload.sourceId), payload.key) : scope.bankOptions.filter(function (option) { return String(option.key) === payload.key; })[0];
                }
                function accepts(item, payload) {
                    var current = item && itemById(item.id);
                    return !!current && valid(payload) && sameOption(optionFor(current, payload.key), sourceOption(payload));
                }
                function cancelSelection() { selection = null; refresh(); }
                function place(item, payload) {
                    if (!accepts(item, payload)) { announce(scope.disabled ? 'Đã khóa trả lời câu hỏi này.' : 'Hãy chọn đáp án phù hợp trong danh sách.'); return; }
                    var option = sourceOption(payload);
                    items().forEach(function (other) { if (String(other.id) !== String(item.id) && sameOption(optionFor(other, value(other)), option)) { scope.answers[other.id] = []; } });
                    scope.answers[item.id] = [payload.key]; selection = null; announce('Đã đặt đáp án câu ' + item.number + '.'); refresh();
                }
                function clear(item) {
                    if (scope.disabled || !item) { return; }
                    scope.answers[item.id] = []; selection = null; announce('Đã trả đáp án về danh sách.'); refresh();
                }
                function returnToBank(payload) { if (valid(payload) && payload.sourceId != null) { clear(itemById(payload.sourceId)); } }
                function closest(node, selector) { while (node && node !== root) { if (node.matches && node.matches(selector)) { return node; } node = node.parentNode; } return null; }
                function payloadFor(node) { return scope.dragPayload({key: node.getAttribute('data-option-key')}, node.getAttribute('data-source-id')); }
                function readDrag(event) { try { return JSON.parse(event.dataTransfer.getData(mime)); } catch (invalid) { return null; } }
                function makeToken(item, option) {
                    var token = documentNode.createElement('button'); token.type = 'button'; token.className = 'battle-exercise-choice-token'; token.draggable = true;
                    token.setAttribute('data-option-key', option.key); token.setAttribute('data-source-id', item.id);
                    token.setAttribute('aria-label', 'Đáp án câu ' + item.number + ': ' + (option.text || ''));
                    token.innerHTML = $sanitize(option.html || option.text || '');
                    var cleanup = dragDrop.bindSource(scope, angular.element(token), {touchDndSource: function () { return payloadFor(token); }, touchDndDisabled: function () { return !!scope.disabled; }});
                    bindings.push({node: token, cleanup: cleanup}); return token;
                }
                function refresh() {
                    if (!scope.exercise || !scope.answers) { return; }
                    bindings = bindings.filter(function (binding) { if (root.contains(binding.node)) { return true; } binding.cleanup(); return false; });
                    Array.prototype.forEach.call(root.querySelectorAll('.battle-exercise-slot'), function (slot) {
                        var item = itemById(slot.getAttribute('data-item-id')); if (!item) { return; }
                        var option = optionFor(item, value(item)), next = option ? String(option.key) : '';
                        slot.setAttribute('tabindex', scope.disabled ? '-1' : '0'); slot.setAttribute('aria-disabled', !!scope.disabled);
                        slot.setAttribute('role', 'group'); slot.setAttribute('aria-label', 'Đáp án câu ' + item.number);
                        if (slot.getAttribute('data-value') !== next || !slot.firstChild) {
                            slot.innerHTML = ''; slot.setAttribute('data-value', next);
                            if (option) {
                                slot.appendChild(makeToken(item, option));
                                var remove = documentNode.createElement('button'); remove.type = 'button'; remove.className = 'battle-exercise-clear'; remove.textContent = '×';
                                remove.setAttribute('aria-label', 'Trả đáp án câu ' + item.number + ' về danh sách'); slot.appendChild(remove);
                            } else { var hint = documentNode.createElement('span'); hint.className = 'battle-exercise-slot-hint'; hint.textContent = 'Câu ' + item.number + ' · Thả đáp án'; slot.appendChild(hint); }
                        }
                        Array.prototype.forEach.call(slot.querySelectorAll('button'), function (button) { button.disabled = !!scope.disabled; button.draggable = !scope.disabled && !button.classList.contains('battle-exercise-clear'); });
                        var touchDrop = function (payload) {
                            var answerSet = scope.answers;
                            if (accepts(item, payload)) { scope.$evalAsync(function () { if (scope.answers === answerSet) { place(item, payload); } }); }
                        };
                        touchDrop.accept = function (payload) { return accepts(item, payload); }; slot.__ieltsTouchDrop = touchDrop;
                    });
                    Array.prototype.forEach.call(root.querySelectorAll('.battle-exercise-bank'), function (bank) {
                        var touchReturn = function (payload) {
                            var answerSet = scope.answers;
                            scope.$evalAsync(function () { if (scope.answers === answerSet) { returnToBank(payload); } });
                        };
                        touchReturn.accept = function (payload) { return valid(payload) && payload.sourceId != null; }; bank.__ieltsTouchDrop = touchReturn;
                    });
                    Array.prototype.forEach.call(root.querySelectorAll('.battle-exercise-choice-token'), function (token) {
                        var payload = payloadFor(token), selected = selection && selection.key === payload.key && selection.sourceId === payload.sourceId;
                        token.classList.toggle('is-selected', !!selected); token.setAttribute('aria-pressed', !!selected);
                    });
                }
                function activate(event) {
                    var clearButton = closest(event.target, '.battle-exercise-clear'), slot = closest(event.target, '.battle-exercise-slot'), token = closest(event.target, '.battle-exercise-choice-token');
                    if (scope.disabled) { return; }
                    if (clearButton) { event.preventDefault(); clear(itemById(slot.getAttribute('data-item-id'))); return; }
                    if (slot && selection) { event.preventDefault(); place(itemById(slot.getAttribute('data-item-id')), selection); return; }
                    if (token) {
                        var payload = payloadFor(token); if (!valid(payload)) { return; }
                        event.preventDefault(); selection = selection && selection.key === payload.key && selection.sourceId === payload.sourceId ? null : payload;
                        announce(selection ? 'Đã chọn đáp án. Chạm hoặc bấm Enter tại ô cần điền.' : 'Đã bỏ chọn đáp án.'); refresh();
                    }
                }
                function keydown(event) {
                    if (event.key === 'Escape') { cancelSelection(); return; }
                    var slot = closest(event.target, '.battle-exercise-slot');
                    if (slot && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); clear(itemById(slot.getAttribute('data-item-id'))); }
                    else if ((event.key === 'Enter' || event.key === ' ') && closest(event.target, '.battle-exercise-choice-token, .battle-exercise-slot, .battle-exercise-clear')) { activate(event); }
                }
                function dragstart(event) {
                    var token = closest(event.target, '.battle-exercise-choice-token'), payload = token && payloadFor(token);
                    if (!payload || !valid(payload)) { event.preventDefault(); return; }
                    selection = null; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(mime, JSON.stringify(payload)); event.dataTransfer.setData('text/plain', payload.key); refresh();
                }
                function dragover(event) {
                    if (scope.disabled || !scope.isDragExercise()) { return; }
                    var slot = closest(event.target, '.battle-exercise-slot'), bank = closest(event.target, '.battle-exercise-bank');
                    if (slot || bank) { event.preventDefault(); if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; } }
                    var view = documentNode.defaultView, scrollHost = event.target;
                    while (scrollHost && scrollHost !== documentNode.body) {
                        if (scrollHost.nodeType === 1 && /(auto|scroll)/.test(view.getComputedStyle(scrollHost).overflowY) && scrollHost.scrollHeight > scrollHost.clientHeight + 2) {
                            var bounds = scrollHost.getBoundingClientRect(), edge = Math.min(60, bounds.height / 4);
                            if (event.clientY < bounds.top + edge) { scrollHost.scrollTop -= 14; }
                            else if (event.clientY > bounds.bottom - edge) { scrollHost.scrollTop += 14; }
                            return;
                        }
                        scrollHost = scrollHost.parentNode;
                    }
                    if (event.clientY < 50) { view.scrollBy(0, -12); }
                    else if (event.clientY > view.innerHeight - 50) { view.scrollBy(0, 12); }
                }
                function drop(event) {
                    var slot = closest(event.target, '.battle-exercise-slot'), bank = closest(event.target, '.battle-exercise-bank'); if (!slot && !bank) { return; }
                    event.preventDefault(); var payload = readDrag(event);
                    if (slot) { place(itemById(slot.getAttribute('data-item-id')), payload); } else { returnToBank(payload); }
                }
                root.addEventListener('click', activate); root.addEventListener('keydown', keydown); root.addEventListener('dragstart', dragstart); root.addEventListener('dragover', dragover); root.addEventListener('drop', drop);
                scope.$watch(function () { return JSON.stringify(scope.exercise, function (key, entry) { return key.charAt(0) === '$' ? undefined : entry; }); }, function () {
                    var exercise = scope.exercise;
                    version++; selection = null; scope.interactionStatus = ''; scope.answers = scope.answers || {}; scope.bankOptions = [];
                    (exercise && exercise.items || []).forEach(function (item) {
                        if (!Array.isArray(scope.answers[item.id])) { scope.answers[item.id] = []; }
                        (item.options || []).forEach(function (option) { if (!scope.bankOptions.some(function (existing) { return sameOption(existing, option); })) { scope.bankOptions.push(option); } });
                    });
                    scope.$evalAsync(refresh);
                });
                scope.$watch('answers', function (next, previous) {
                    if (next !== previous) { version++; selection = null; }
                    scope.answers = scope.answers || {};
                    items().forEach(function (item) { if (!Array.isArray(scope.answers[item.id])) { scope.answers[item.id] = []; } });
                    scope.$evalAsync(refresh);
                });
                scope.$watch('answers', function () { scope.$evalAsync(refresh); }, true);
                scope.$watch('disabled', function () { if (scope.disabled) { version++; selection = null; } scope.$evalAsync(refresh); });
                scope.$on('battleExerciseSlotsChanged', function () { scope.$evalAsync(refresh); });
                scope.$on('$destroy', function () {
                    bindings.forEach(function (binding) { binding.cleanup(); });
                    root.removeEventListener('click', activate); root.removeEventListener('keydown', keydown); root.removeEventListener('dragstart', dragstart); root.removeEventListener('dragover', dragover); root.removeEventListener('drop', drop);
                });
            }
        };
    }]);

    // Imported HTML is sanitized and never compiled. Only native input and slot nodes
    // replace original marker positions, including gaps from a later Battle turn.
    angular.module('Hrm.Question').directive('battleExerciseGaps', ['$sanitize', function ($sanitize) {
        return {
            restrict: 'E', scope: {content: '=', items: '=', answers: '=', disabled: '=', mode: '='},
            link: function (scope, element) {
                var controls = [], renderRevision = 0;
                function update() {
                    controls.forEach(function (entry) {
                        if (entry.control.tagName !== 'INPUT') { return; }
                        entry.control.disabled = !!scope.disabled;
                        var next = ((scope.answers || {})[entry.item.id] || [])[0] || ''; if (entry.control.value !== next) { entry.control.value = next; }
                    });
                }
                function render() {
                    var root = element[0], doc = root.ownerDocument; controls = []; renderRevision++;
                    root.innerHTML = $sanitize(String(scope.content || '').replace(/\}\{ENTER\}\{/gi, '<br><br>'));
                    function makeControl(item) {
                        var control;
                        if (scope.mode === 'TEXT') {
                            control = doc.createElement('input'); control.className = 'battle-exercise-gap'; control.type = 'text'; control.maxLength = 1000;
                            control.placeholder = String(item.number || 'Điền từ'); control.autocomplete = 'off'; control.setAttribute('aria-label', 'Câu ' + item.number);
                            control.addEventListener('input', function () {
                                if (scope.disabled) { return; }
                                var next = control.value, answerSet = scope.answers, revision = renderRevision;
                                scope.$evalAsync(function () {
                                    if (!scope.disabled && answerSet && scope.answers === answerSet && revision === renderRevision) { answerSet[item.id] = next ? [next] : []; }
                                });
                            });
                        } else {
                            control = doc.createElement('span'); control.className = 'battle-exercise-slot battle-exercise-inline-slot'; control.setAttribute('data-item-id', item.id);
                        }
                        controls.push({item: item, control: control}); return control;
                    }
                    var walker = doc.createTreeWalker(root, 4, null, false), nodes = [], node, index = 0, byIndex = {}, rendered = {};
                    while ((node = walker.nextNode())) { nodes.push(node); }
                    (scope.items || []).forEach(function (item, itemIndex) { byIndex[item.gapIndex == null ? itemIndex : item.gapIndex] = item; });
                    nodes.forEach(function (textNode) {
                        var chunks = textNode.nodeValue.split(/\}\{\s*(?:SPACE|HEADING)\s*\}\{/gi); if (chunks.length < 2) { return; }
                        var fragment = doc.createDocumentFragment();
                        chunks.forEach(function (chunk, chunkIndex) {
                            fragment.appendChild(doc.createTextNode(chunk)); if (chunkIndex === chunks.length - 1) { return; }
                            var item = byIndex[index++]; if (!item) { fragment.appendChild(doc.createTextNode('[…]')); return; }
                            rendered[item.id] = true; fragment.appendChild(makeControl(item));
                        });
                        textNode.parentNode.replaceChild(fragment, textNode);
                    });
                    (scope.items || []).filter(function (item) { return !rendered[item.id]; }).forEach(function (item) {
                        var row = doc.createElement('label'); row.className = 'battle-exercise-gap-fallback'; row.textContent = 'Đáp án câu ' + item.number + ' '; row.appendChild(makeControl(item)); root.appendChild(row);
                    });
                    update(); scope.$emit('battleExerciseSlotsChanged');
                }
                scope.$watch(function () { return JSON.stringify([scope.content, scope.items, scope.mode]); }, render);
                scope.$watch('answers', update, true); scope.$watch('disabled', update);
            }
        };
    }]);
})();
