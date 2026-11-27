(function () {
    'use strict';

    angular.module('Hrm.Question').factory('ComprehensiveFindMistakes', function () {
        function parse(value) {
            var source = String(value || ''), pattern = /\[\[([^\[\]\r\n]+)\]\]/g;
            var parts = [], candidates = [], end = 0, match;
            var invalid = /\[\[|\]\]/.test(source.replace(pattern, ''));
            while ((match = pattern.exec(source))) {
                if (match.index > end) { parts.push({text: source.slice(end, match.index)}); }
                end = pattern.lastIndex;
                var candidate = {id: candidates.length + 1, text: match[1], start: match.index, end: end};
                invalid = invalid || !candidate.text.trim();
                candidates.push(candidate);
                parts.push(candidate);
            }
            if (end < source.length) { parts.push({text: source.slice(end)}); }
            return {parts: parts, candidates: candidates, invalid: invalid};
        }

        function decode(value) {
            var match = /^([1-9]\d*)\|([\s\S]*)$/.exec(String(value || ''));
            return match ? {id: Number(match[1]), text: match[2]} : null;
        }

        function encode(id, text) { return id + '|' + String(text || '').trim(); }

        return {parse: parse, decode: decode, encode: encode};
    }).component('findMistakesBuilder', {
        bindings: {pack: '<', onChange: '&'},
        templateUrl: 'question/views/find_mistakes_builder.html?v=' + window.APP_VERSION,
        controller: ['$element', 'ComprehensiveFindMistakes', function ($element, mistakes) {
            var editor = this, previousText = '';
            editor.$onInit = function () {
                var saved = {};
                (editor.pack.subQuestions || []).forEach(function (question) {
                    var answer = question.questionAnswers[0];
                    var key = mistakes.decode(answer && answer.answer && answer.answer.answer);
                    if (key) { saved[key.id] = {isError: true, correction: key.text, question: question}; }
                });
                editor.text = editor.pack.motherTongue || '';
                editor.preview = mistakes.parse(editor.text);
                editor.preview.candidates.forEach(function (candidate) { angular.extend(candidate, saved[candidate.id]); });
                previousText = editor.text;
            };

            editor.updateText = function () {
                var text = editor.text || '', preview = mistakes.parse(text), prefix = 0, suffix = 0;
                var limit = Math.min(text.length, previousText.length);
                while (prefix < limit && text[prefix] === previousText[prefix]) { prefix++; }
                while (suffix < limit - prefix && text[text.length - suffix - 1] === previousText[previousText.length - suffix - 1]) { suffix++; }
                var kept = {}, discarded = false;
                editor.preview.candidates.forEach(function (candidate) {
                    if (candidate.end <= prefix) { kept[candidate.start] = candidate; }
                    else if (candidate.start >= previousText.length - suffix) {
                        kept[candidate.start + text.length - previousText.length] = candidate;
                    } else if (candidate.isError) { discarded = true; }
                });
                preview.candidates.forEach(function (candidate) {
                    var old = kept[candidate.start];
                    if (old && old.text === candidate.text) {
                        candidate.isError = old.isError;
                        candidate.correction = old.correction;
                        candidate.question = old.question;
                    }
                });
                editor.changedChoices = discarded;
                editor.preview = preview;
                previousText = text;
                editor.updateAnswers();
            };

            editor.markSelection = function () {
                var input = $element[0].querySelector('textarea');
                var start = input.selectionStart, end = input.selectionEnd, selection = (editor.text || '').slice(start, end);
                if (!selection.trim() || /[\[\]\r\n]/.test(selection) || editor.preview.candidates.some(function (candidate) {
                    return candidate.start < end && candidate.end > start;
                })) {
                    editor.selectionError = 'Bôi đen một từ hoặc cụm từ trên cùng một dòng, ở ngoài các vị trí đã đánh dấu.';
                    return;
                }
                start += selection.length - selection.replace(/^\s+/, '').length;
                end -= selection.length - selection.replace(/\s+$/, '').length;
                editor.selectionError = '';
                editor.text = editor.text.slice(0, start) + '[[' + editor.text.slice(start, end) + ']]' + editor.text.slice(end);
                editor.updateText();
                input.focus();
            };

            editor.updateAnswers = function () {
                var previousCount = (editor.pack.subQuestions || []).length;
                var questions = [];
                editor.preview.candidates.forEach(function (candidate) {
                    if (!candidate.isError) { return; }
                    var question = candidate.question || {
                        question: 'Tìm và sửa lỗi trong đoạn văn', questionType: {id: 19, code: 'IELTSRTQ'},
                        questionAnswers: [{answer: {}, ordinalNumberQuestionAnswer: 1, correct: true}]
                    };
                    question.questionAnswers[0].answer.answer = mistakes.encode(candidate.id, candidate.correction);
                    candidate.question = question;
                    questions.push(question);
                });
                editor.pack.motherTongue = editor.text;
                editor.pack.isHaveChildren = questions.length > 0;
                editor.pack.subQuestions = questions;
                editor.onChange({countChanged: previousCount !== questions.length});
            };
        }]
    }).component('findMistakesExercise', {
        bindings: {pack: '<', locked: '<', editorState: '<', showAnchors: '<', onChange: '&'},
        templateUrl: 'question/views/find_mistakes_exercise.html?v=' + window.APP_VERSION,
        controller: ['$element', '$timeout', '$window', 'ComprehensiveFindMistakes', function ($element, $timeout, $window, mistakes) {
            var exercise = this, popupObserver;
            exercise.$onInit = function () {
                exercise.passage = mistakes.parse(exercise.pack.motherTongue);
                exercise.editorState = exercise.editorState || {};
            };

            // Read from the same models used by the draft and resume logic.
            exercise.savedAt = function (candidate) {
                return exercise.pack.subQuestions.findIndex(function (question) {
                    var saved = mistakes.decode(question.questionAnswers[0].clientAnswer);
                    return saved && saved.id === candidate.id;
                });
            };
            exercise.wordText = function (candidate) {
                var index = exercise.savedAt(candidate);
                if (index < 0) { return candidate.text; }
                return mistakes.decode(exercise.pack.subQuestions[index].questionAnswers[0].clientAnswer).text;
            };
            exercise.count = function () {
                return exercise.pack.subQuestions.filter(function (question) {
                    return !!mistakes.decode(question.questionAnswers[0].clientAnswer);
                }).length;
            };
            exercise.select = function (candidate) {
                if (exercise.locked || exercise.editorState.pack) { return; }
                var index = exercise.savedAt(candidate);
                if (index < 0) {
                    index = exercise.pack.subQuestions.findIndex(function (question) { return !question.questionAnswers[0].clientAnswer; });
                }
                if (index < 0) { return; }
                var saved = mistakes.decode(exercise.pack.subQuestions[index].questionAnswers[0].clientAnswer);
                var edit = {candidate: candidate, index: index, text: saved ? saved.text : '', saved: !!saved};
                exercise.active = edit;
                exercise.editorState.pack = exercise.pack;
                exercise.pack._findMistakesEdit = edit;
                $timeout(function () {
                    if (exercise.active !== edit) { return; }
                    var popup = $element[0].querySelector('.find-mistakes-correction');
                    var anchor = $element[0].querySelector('[data-candidate="' + candidate.id + '"]');
                    var passage = anchor.closest('.find-mistakes-passage');

                    function positionPopup() {
                        var container = popup.offsetParent;
                        if (!container) { return; }
                        var bounds = container.getBoundingClientRect(), word = anchor.getBoundingClientRect();
                        var width = popup.offsetWidth, center = word.left + word.width / 2 - bounds.left;
                        var left = Math.max(0, Math.min(center - width / 2, container.clientWidth - width));
                        var tip = Math.max(9, Math.min(center - left, width - 9));
                        popup.style.left = left + 'px';
                        popup.style.top = (word.bottom - bounds.top + 10) + 'px';
                        popup.style.setProperty('--correction-tip', tip + 'px');
                    }

                    positionPopup();
                    popup.classList.add('is-positioned');
                    if ($window.ResizeObserver) {
                        popupObserver = new $window.ResizeObserver(positionPopup);
                        popupObserver.observe(passage);
                        popupObserver.observe(anchor);
                    }
                    popup.scrollIntoView({block: 'nearest', inline: 'nearest'});
                    popup.querySelector('textarea').focus({preventScroll: true});
                }, 0);
            };
            function stopPositioning() {
                if (popupObserver) { popupObserver.disconnect(); popupObserver = null; }
            }
            exercise.close = function (event) {
                if (event) { event.preventDefault(); event.stopPropagation(); }
                var candidate = exercise.active.candidate;
                stopPositioning();
                exercise.active = null;
                delete exercise.editorState.pack;
                delete exercise.pack._findMistakesEdit;
                $timeout(function () {
                    var button = $element[0].querySelector('[data-candidate="' + candidate.id + '"]');
                    if (button && !button.disabled) { button.focus(); }
                }, 0);
            };
            exercise.save = function (remove) {
                if (exercise.locked || !exercise.active || (!remove && !String(exercise.active.text || '').trim())) { return; }
                var question = exercise.pack.subQuestions[exercise.active.index];
                question.questionAnswers[0].clientAnswer = remove ? '' : mistakes.encode(exercise.active.candidate.id, exercise.active.text);
                question.answered = !remove;
                exercise.close();
                exercise.onChange();
            };
            exercise.$onDestroy = function () {
                stopPositioning();
                exercise.active = null;
                if (exercise.editorState.pack === exercise.pack) { delete exercise.editorState.pack; }
                delete exercise.pack._findMistakesEdit;
            };
        }]
    });
})();
