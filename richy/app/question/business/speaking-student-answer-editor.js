(function () {
    'use strict';
    angular.module('Hrm.Question').factory('SpeakingStudentAnswerStore', ['$q', '$window', 'SpeakingService', function ($q, $window, api) {
        function copy(value) { return JSON.parse(JSON.stringify(value)); }
        function valueOf(row) { return JSON.stringify({html: row.html || '', notes: row.notes || []}); }
        function sameContext(row, context) { return row && ['setId', 'studentId', 'questionId'].every(function (key) { return Number(row[key]) === Number(context[key]); }); }
        function session(context, clean) {
            context = copy(context);
            var key = 'speaking-answer:v1:' + context.userId + ':' + context.setId + ':' + context.studentId + ':' + context.questionId;
            var state = {context: context, loading: true, ready: false, saving: false, dirty: false, revision: 0, html: '', notes: [], error: '', status: 'Đang tải câu trả lời…'};
            var baseline = valueOf(state), pending = null, inFlightPayload = null, destroyed = false, lastBackup;
            function readBackup() { try { return JSON.parse($window.localStorage.getItem(key) || 'null'); } catch (ignore) { return null; } }
            function backup() {
                if (!state.dirty) { return; }
                try { lastBackup = JSON.stringify({context: context, revision: state.revision, html: state.html, notes: state.notes}); $window.localStorage.setItem(key, lastBackup); state.storageError = false; }
                catch (error) { state.storageError = true; }
            }
            function clearMatchingBackup(payload) {
                var saved = readBackup();
                if (saved && sameContext(saved.context, context) && Number(saved.context.userId) === Number(context.userId) && saved.revision === payload.revision && valueOf(saved) === valueOf(payload)) {
                    try { $window.localStorage.removeItem(key); } catch (ignore) {}
                }
            }
            function normalized(row) {
                var value = clean(row.html || '', row.notes || []);
                return {html: value.html, notes: value.notes, revision: Number(row.revision)};
            }
            function validRow(row) { return sameContext(row, context) && typeof row.revision === 'number' && Number.isInteger(row.revision) && row.revision >= 0 && typeof row.html === 'string' && Array.isArray(row.notes); }
            function apply(row) { var data = normalized(row); state.html = data.html; state.notes = data.notes; state.revision = data.revision; baseline = valueOf(state); state.dirty = false; state.conflict = false; state.remote = null; state.invalid = false; }
            function load() {
                state.loading = true; state.ready = false; state.error = '';
                if (typeof api.studentAnswers !== 'function') { state.loading = false; state.error = 'Cần cập nhật backend để mở câu trả lời riêng.'; state.status = 'Chưa tải được'; return $q.when(); }
                return api.studentAnswers(context.setId, context.studentId, context.questionId).then(function (data) {
                    if (destroyed) { return; }
                    if (!data || Number(data.setId) !== context.setId || Number(data.studentId) !== context.studentId || data.canEdit !== true || !Array.isArray(data.answers) || data.answers.length !== 1 || !validRow(data.answers[0])) { throw new Error('Câu trả lời nhận được không khớp học sinh hoặc câu hỏi.'); }
                    apply(data.answers[0]); state.ready = true;
                    var saved = readBackup();
                    if (saved && sameContext(saved.context, context) && Number(saved.context.userId) === context.userId && typeof saved.revision === 'number' && Number.isInteger(saved.revision) && saved.revision >= 0) {
                        var draft = normalized(saved);
                        if (valueOf(draft) !== baseline) {
                            state.html = draft.html; state.notes = draft.notes; state.dirty = true;
                            state.conflict = draft.revision !== state.revision; state.remote = copy(data.answers[0]);
                            state.revision = draft.revision;
                            state.status = state.conflict ? 'Có bản mới trên server; bản nháp của bạn được giữ để đối chiếu.' : 'Đã khôi phục bản nháp trên thiết bị; đang chờ đồng bộ.';
                        } else { clearMatchingBackup(saved); state.status = 'Đã đồng bộ'; }
                    } else { state.status = state.revision ? 'Đã đồng bộ' : 'Sẵn sàng ghi câu trả lời'; }
                }).catch(function (error) { if (!destroyed) { state.error = error.status === 404 ? 'Phần câu trả lời riêng cần backend mới. Bản nháp trên thiết bị vẫn được giữ.' : (error.data && error.data.message) || error.message || 'Chưa tải được câu trả lời. Bản nháp trên thiết bị vẫn được giữ.'; state.status = 'Chưa tải được'; } })
                    .finally(function () { if (!destroyed) { state.loading = false; } });
            }
            function change(html, notes) {
                if (!state.ready) { return; }
                var value = clean(html, notes); state.html = value.html; state.notes = value.notes;
                state.dirty = valueOf(state) !== baseline || !!(inFlightPayload && valueOf(state) !== valueOf(inFlightPayload)); state.invalid = state.html.length > 100000; state.error = state.invalid ? 'Câu trả lời quá dài (tối đa 100.000 ký tự định dạng). Bản nháp vẫn được giữ; hãy rút gọn trước khi lưu.' : '';
                state.status = state.conflict ? 'Có thay đổi đồng thời; hãy đối chiếu trước khi lưu.' : state.dirty ? 'Đã giữ bản nháp trên thiết bị; chưa xác nhận đồng bộ.' : 'Đã đồng bộ';
                if (!state.dirty && lastBackup) { try { if ($window.localStorage.getItem(key) === lastBackup) { $window.localStorage.removeItem(key); } } catch (ignore) {} }
                backup();
            }
            function save() {
                if (!state.ready || state.loading || state.conflict || state.invalid || !state.dirty) { return $q.when(); }
                if (pending) { return pending; }
                var payload = {setId: context.setId, studentId: context.studentId, questionId: context.questionId, revision: state.revision, html: state.html, notes: copy(state.notes)};
                inFlightPayload = payload;
                state.saving = true; state.error = ''; state.status = 'Đang đồng bộ…'; backup();
                pending = api.saveStudentAnswer(payload).then(function (ack) {
                    if (!validRow(ack) || ack.revision < 1 || ack.revision < payload.revision || (ack.revision === payload.revision && valueOf(normalized(ack)) !== valueOf(payload))) { throw new Error('Chưa nhận đúng xác nhận lưu. Bản nháp vẫn được giữ.'); }
                    clearMatchingBackup(payload);
                    if (destroyed) { return ack; }
                    var saved = normalized(ack); state.revision = saved.revision; baseline = valueOf(saved);
                    if (valueOf(state) === valueOf(payload)) { state.html = saved.html; state.notes = saved.notes; }
                    state.dirty = valueOf(state) !== baseline; state.status = state.dirty ? 'Có thay đổi mới đang chờ đồng bộ.' : 'Đã đồng bộ'; backup(); return ack;
                }).catch(function (error) {
                    if (!destroyed) {
                        state.error = (error.data && error.data.message) || error.message || 'Chưa đồng bộ được. Bản nháp trên thiết bị vẫn được giữ.'; state.status = 'Chưa đồng bộ'; backup();
                        if (error.status === 409) {
                            state.conflict = true;
                            api.studentAnswers(context.setId, context.studentId, context.questionId).then(function (data) {
                                if (!destroyed && data && Number(data.setId) === context.setId && Number(data.studentId) === context.studentId && Array.isArray(data.answers) && data.answers.length === 1 && validRow(data.answers[0])) { state.remote = data.answers[0]; }
                            }, angular.noop);
                        }
                    }
                }).finally(function () { pending = null; inFlightPayload = null; if (!destroyed) { state.saving = false; } });
                return pending;
            }
            function overwriteReviewed() { if (!state.remote || !validRow(state.remote)) { return $q.when(); } state.revision = Number(state.remote.revision); baseline = valueOf(normalized(state.remote)); state.conflict = false; state.error = ''; state.dirty = valueOf(state) !== baseline; backup(); return save(); }
            function useServer() {
                if (!state.remote || !validRow(state.remote)) { return; }
                try { var saved = readBackup(); if (saved) { $window.localStorage.setItem(key + ':previous:' + Date.now(), JSON.stringify(saved)); } $window.localStorage.removeItem(key); } catch (ignore) {}
                apply(state.remote); state.conflict = false; state.error = ''; state.status = 'Đang xem bản đã lưu trên server';
            }
            return {state: state, load: load, change: change, save: save, backup: backup, overwriteReviewed: overwriteReviewed, useServer: useServer, destroy: function () { backup(); destroyed = true; }};
        }
        return {open: session};
    }]);

    angular.module('Hrm.Question').directive('speakingStudentAnswerEditor', ['$window', '$timeout', 'SpeakingStudentAnswerStore', function ($window, $timeout, store) {
        return {
            restrict: 'E', scope: {setId: '<', studentId: '<', questionId: '<', userId: '<', studentLabel: '@'},
            template: '<section class="sp-answer-editor"><header class="sp-toolbar"><strong class="sp-grow">{{studentLabel}}</strong><span class="sp-answer-sync" role="status" ng-class="{\'is-error\':ed.state.error}">{{ed.state.status}}</span><button type="button" class="sp-button sp-primary" ng-click="ed.save()" ng-disabled="ed.state.loading || ed.state.saving || ed.state.conflict || !ed.state.dirty">{{ed.state.saving ? \'Đang lưu…\' : \'Lưu câu trả lời\'}}</button></header>' +
                '<div class="sp-answer-format" role="toolbar" aria-label="Định dạng câu trả lời"><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'bold\')" ng-disabled="ed.state.loading" aria-label="Chữ đậm"><b>B</b></button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'italic\')" ng-disabled="ed.state.loading" aria-label="Chữ nghiêng"><i>I</i></button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'underline\')" ng-disabled="ed.state.loading" aria-label="Gạch chân"><u>U</u></button><span></span><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(true)" ng-disabled="ed.state.loading || !ed.hasSelection"><i class="fa fa-sticky-note-o"></i> Take note</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(false)" ng-disabled="ed.state.loading || !ed.hasSelection"><i class="fa fa-pencil"></i> Highlight</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.removeAnnotation()" ng-disabled="!ed.marker"><i class="fa fa-eraser"></i> Bỏ đánh dấu</button></div>' +
                '<p class="sp-error-text" role="alert" ng-if="ed.state.error">{{ed.state.error}} <button class="sp-link" type="button" ng-if="ed.state.status===\'Chưa tải được\'" ng-click="ed.reload()">Tải lại</button></p><p class="sp-error-text" role="alert" ng-if="ed.state.storageError">Bộ nhớ thiết bị đã đầy; giữ trang mở và bấm lưu để đồng bộ lên server.</p>' +
                '<div class="sp-answer-editable" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Câu trả lời riêng" data-placeholder="Viết câu trả lời của bạn…" spellcheck="true"></div>' +
                '<div class="sp-answer-selection" ng-if="ed.hasSelection && !ed.state.loading" ng-style="ed.selectionStyle" role="toolbar" aria-label="Đánh dấu đoạn chữ"><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(true)"><i class="fa fa-sticky-note-o"></i> Take note</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(false)"><i class="fa fa-pencil"></i> Highlight</button></div>' +
                '<aside class="sp-answer-note" ng-if="ed.activeNote" ng-style="ed.noteStyle" role="dialog" aria-label="Ghi chú đoạn chữ"><header><strong><i class="fa fa-sticky-note"></i> Ghi chú</strong><button type="button" class="sp-close" ng-click="ed.closeNote()" aria-label="Đóng ghi chú">×</button></header><textarea aria-label="Nội dung ghi chú" maxlength="2000" ng-model="ed.activeNote.text" ng-change="ed.noteChanged()" placeholder="Ghi điều cần nhớ…"></textarea><small>Bấm vào đoạn đã đánh dấu để mở hoặc đóng.</small></aside>' +
                '<div class="sp-answer-conflict" ng-if="ed.state.conflict"><strong>Bản mới vừa được lưu ở nơi khác</strong><p>Bản bạn đang sửa vẫn được giữ. Đối chiếu trước khi thay nội dung trên server.</p><details ng-if="ed.state.remote"><summary>Xem bản mới trên server</summary><p class="sp-preserve">{{ed.remoteText()}}</p></details><div class="sp-toolbar"><button class="sp-button" type="button" ng-disabled="!ed.state.remote || ed.state.saving" ng-click="ed.useServer()">Dùng bản máy chủ, giữ nháp cũ trên thiết bị</button><button class="sp-button" type="button" ng-disabled="!ed.state.remote || ed.state.saving" ng-click="ed.overwrite()">Lưu bản đang sửa thay bản máy chủ</button></div></div><small class="sp-muted">Chọn đoạn chữ để ghi chú hoặc đánh dấu. Giáo viên và học sinh cùng chỉnh sửa câu trả lời này.</small></section>',
            link: function (scope, element) {
                var doc = $window.document, root = element[0], editable = root.querySelector('.sp-answer-editable'), current, timer, selectedRange, composing = false, destroyed = false, generation = 0;
                var ed = scope.ed = {state: {loading: true, status: 'Đang tải câu trả lời…'}, hasSelection: false};
                var tags = {B: 1, STRONG: 1, I: 1, EM: 1, U: 1, P: 1, DIV: 1, BR: 1, UL: 1, OL: 1, LI: 1, SPAN: 1}, forbidden = {SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TEMPLATE: 1};
                function clean(html, notes) {
                    // Parse untrusted local backups in inert template content so
                    // image/error handlers cannot run before the allowlist pass.
                    var template = doc.createElement('template'); template.innerHTML = String(html || ''); var container = template.content;
                    var noteMap = Object.create(null), result = [];
                    (Array.isArray(notes) ? notes.slice(0, 200) : []).forEach(function (note) { if (note && /^[A-Za-z0-9_-]{1,80}$/.test(note.id || '') && !noteMap[note.id]) { noteMap[note.id] = {id: note.id, text: String(note.text || '').slice(0, 2000)}; } });
                    function scrub(parent) {
                        Array.prototype.slice.call(parent.childNodes).forEach(function (node) {
                            if (node.nodeType === 3) { return; }
                            if (node.nodeType !== 1 || forbidden[node.nodeName]) { parent.removeChild(node); return; }
                            scrub(node);
                            if (!tags[node.nodeName]) { while (node.firstChild) { parent.insertBefore(node.firstChild, node); } parent.removeChild(node); return; }
                            var noteId = node.nodeName === 'SPAN' ? node.getAttribute('data-note-id') : null, group = node.nodeName === 'SPAN' ? node.getAttribute('data-annotation-group') : null;
                            var classes = String(node.className || '').split(/\s+/).filter(function (name) { return ['ielts-annotation', 'has-note', 'is-highlighted'].indexOf(name) >= 0; });
                            Array.prototype.slice.call(node.attributes).forEach(function (attribute) { node.removeAttribute(attribute.name); });
                            if (node.nodeName === 'SPAN') {
                                classes = classes.filter(function (name) { return name !== 'has-note' || !!noteMap[noteId]; });
                                if (classes.length) { node.className = classes.join(' '); }
                                if (noteMap[noteId]) { node.setAttribute('data-note-id', noteId); if (!result.some(function (note) { return note.id === noteId; })) { result.push(noteMap[noteId]); } }
                                if (/^[A-Za-z0-9_-]{1,80}$/.test(group || '')) { node.setAttribute('data-annotation-group', group); }
                            }
                        });
                    }
                    scrub(container); var serialized = doc.createElement('div'); serialized.appendChild(container.cloneNode(true)); return {html: serialized.innerHTML, notes: result};
                }
                function render() { editable.innerHTML = ed.state.html || ''; editable.setAttribute('contenteditable', ed.state.loading || ed.state.status === 'Chưa tải được' ? 'false' : 'true'); }
                function cancelTimer() { if (timer) { $timeout.cancel(timer); timer = null; } }
                function schedule() { cancelTimer(); if (current && ed.state.dirty && !ed.state.conflict && !composing) { timer = $timeout(function () { timer = null; ed.save(); }, 1300); } }
                function changed() { if (!current || ed.state.loading || !ed.state.ready) { return; } var activeId = ed.activeNote && ed.activeNote.id; current.change(editable.innerHTML, ed.state.notes); if (activeId) { ed.activeNote = ed.state.notes.filter(function (note) { return note.id === activeId; })[0] || null; } schedule(); }
                function capture() {
                    var selection = $window.getSelection(), range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
                    if (range && editable.contains(range.commonAncestorContainer)) {
                        selectedRange = range.cloneRange(); ed.hasSelection = !range.collapsed && !!selection.toString().trim();
                        if (ed.hasSelection) { var bounds = range.getBoundingClientRect(), width = $window.innerWidth || doc.documentElement.clientWidth, height = $window.innerHeight || doc.documentElement.clientHeight; ed.selectionStyle = {left: Math.max(8, Math.min(bounds.left, width - 240)) + 'px', top: Math.max(8, Math.min(bounds.bottom + 8, height - 52)) + 'px'}; }
                    }
                    else { ed.hasSelection = false; }
                }
                function restoreSelection() { if (!selectedRange || !editable.contains(selectedRange.commonAncestorContainer)) { return false; } var selection = $window.getSelection(); editable.focus(); selection.removeAllRanges(); selection.addRange(selectedRange); return true; }
                function markerAt(target) { while (target && target !== editable) { if (target.nodeType === 1 && /\bielts-annotation\b/.test(target.className || '')) { return target; } target = target.parentNode; } return null; }
                function openNote(note, marker) {
                    ed.activeNote = note; ed.marker = marker;
                    var bounds = marker.getBoundingClientRect(), width = $window.innerWidth || doc.documentElement.clientWidth, height = $window.innerHeight || doc.documentElement.clientHeight;
                    var top = bounds.bottom + 8; if (top + 245 > height) { top = Math.max(8, Math.min(bounds.top - 235, height - 253)); }
                    ed.noteStyle = {position: 'fixed', top: Math.max(8, top) + 'px', left: Math.max(8, Math.min(bounds.left, width - 316)) + 'px', maxHeight: Math.max(100, height - 16) + 'px'};
                }
                ed.closeNote = function () { ed.activeNote = null; };
                ed.noteChanged = function () { changed(); };
                ed.format = function (command) { if (ed.state.loading || !ed.state.ready) { return; } restoreSelection(); editable.focus(); doc.execCommand(command, false, null); capture(); changed(); };
                ed.annotate = function (withNote) {
                    if (!ed.state.ready || !ed.hasSelection || !restoreSelection()) { return; }
                    if (withNote && ed.state.notes.length >= 200) { ed.state.error = 'Mỗi câu trả lời có tối đa 200 note. Hãy xoá note cũ trước khi thêm.'; return; }
                    var range = selectedRange.cloneRange(), walker = doc.createTreeWalker(editable, 4, null, false), nodes = [], node;
                    while ((node = walker.nextNode())) { if (range.intersectsNode(node) && node.nodeValue.length) { nodes.push(node); } }
                    if (!nodes.length) { return; }
                    var id = 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), note = {id: id, text: ''}, markers = [];
                    nodes.reverse().forEach(function (text) {
                        var start = text === range.startContainer ? range.startOffset : 0, end = text === range.endContainer ? range.endOffset : text.nodeValue.length;
                        if (start >= end) { return; } if (end < text.nodeValue.length) { text.splitText(end); } var selected = start ? text.splitText(start) : text;
                        var span = doc.createElement('span'); span.className = 'ielts-annotation ' + (withNote ? 'has-note' : 'is-highlighted'); span.setAttribute('data-annotation-group', id); if (withNote) { span.setAttribute('data-note-id', id); }
                        selected.parentNode.insertBefore(span, selected); span.appendChild(selected); markers.push(span);
                    });
                    if (!markers.length) { return; } if (withNote) { ed.state.notes.push(note); openNote(note, markers[markers.length - 1]); }
                    ed.marker = markers[0]; selectedRange = null; ed.hasSelection = false; $window.getSelection().removeAllRanges(); changed();
                };
                ed.removeAnnotation = function () {
                    if (!ed.marker || !editable.contains(ed.marker)) { return; } var group = ed.marker.getAttribute('data-annotation-group'), noteId = ed.marker.getAttribute('data-note-id');
                    Array.prototype.slice.call(editable.querySelectorAll('span.ielts-annotation')).forEach(function (span) { if ((group && span.getAttribute('data-annotation-group') === group) || (!group && span === ed.marker)) { while (span.firstChild) { span.parentNode.insertBefore(span.firstChild, span); } span.parentNode.removeChild(span); } });
                    ed.state.notes = ed.state.notes.filter(function (note) { return note.id !== noteId || editable.querySelector('[data-note-id="' + note.id + '"]'); }); ed.marker = null; ed.activeNote = null; changed();
                };
                ed.save = function () {
                    if (!current || composing || !ed.state.ready) { return; } cancelTimer(); changed(); cancelTimer(); var session = current, before = editable.innerHTML;
                    return session.save().then(function () { if (!destroyed && session === current) { if (before === editable.innerHTML && !ed.state.dirty && !editable.contains(doc.activeElement)) { render(); } if (ed.state.dirty && !ed.state.error && !ed.state.conflict) { schedule(); } } });
                };
                ed.reload = function () { if (!current) { return; } return current.load().then(function () { render(); if (ed.state.dirty && !ed.state.conflict) { schedule(); } }); };
                ed.remoteText = function () { var div = doc.createElement('div'); div.innerHTML = clean(ed.state.remote && ed.state.remote.html, ed.state.remote && ed.state.remote.notes).html; return div.textContent || ''; };
                ed.overwrite = function () { if (!$window.confirm('Thay câu trả lời vừa được lưu trên server bằng bản bạn đang sửa?')) { return; } return current.overwriteReviewed().then(function () { if (!destroyed) { render(); } }); };
                ed.useServer = function () { if (!$window.confirm('Dùng bản máy chủ? Bản nháp đang sửa sẽ được giữ riêng trên thiết bị.')) { return; } current.useServer(); ed.activeNote = null; render(); };
                function click(event) { var marker = markerAt(event.target); scope.$evalAsync(function () { ed.marker = marker; var id = marker && marker.getAttribute('data-note-id'), note = id && ed.state.notes.filter(function (item) { return item.id === id; })[0]; if (note && (!ed.activeNote || ed.activeNote.id !== id)) { openNote(note, marker); } else { ed.activeNote = null; } }); }
                function outside(event) { if (!root.contains(event.target)) { scope.$evalAsync(function () { ed.activeNote = null; ed.marker = null; ed.hasSelection = false; }); } else if (!editable.contains(event.target) && !event.target.closest('.sp-answer-note, .sp-answer-format, .sp-answer-selection')) { scope.$evalAsync(function () { ed.activeNote = null; }); } }
                function input() { scope.$evalAsync(function () { changed(); capture(); }); }
                function selectionChanged() { scope.$evalAsync(capture); }
                function compositionStart() { composing = true; cancelTimer(); }
                function compositionEnd() { composing = false; input(); }
                function paste(event) { event.preventDefault(); var text = event.clipboardData ? event.clipboardData.getData('text/plain') : ''; doc.execCommand('insertText', false, text); input(); }
                function drop(event) { event.preventDefault(); }
                function escape(event) { if (event.key === 'Escape') { scope.$evalAsync(function () { ed.activeNote = null; }); } }
                function leaving() { if (current) { current.backup(); } }
                editable.addEventListener('input', input); editable.addEventListener('click', click); editable.addEventListener('mouseup', selectionChanged); editable.addEventListener('touchend', selectionChanged); editable.addEventListener('keyup', selectionChanged); editable.addEventListener('compositionstart', compositionStart); editable.addEventListener('compositionend', compositionEnd); editable.addEventListener('paste', paste); editable.addEventListener('drop', drop); doc.addEventListener('pointerdown', outside); doc.addEventListener('selectionchange', selectionChanged); doc.addEventListener('keydown', escape); $window.addEventListener('pagehide', leaving);
                scope.$watchGroup(['setId', 'studentId', 'questionId', 'userId'], function (values) {
                    var next = ++generation; cancelTimer(); if (current) { current.destroy(); } ed.activeNote = null; ed.marker = null; ed.hasSelection = false; selectedRange = null;
                    if (!values.every(function (id) { return Number.isInteger(Number(id)) && Number(id) > 0; })) { return; }
                    current = store.open({setId: Number(values[0]), studentId: Number(values[1]), questionId: Number(values[2]), userId: Number(values[3])}, clean); ed.state = current.state; render();
                    current.load().then(function () { if (!destroyed && generation === next) { render(); if (ed.state.dirty && !ed.state.conflict) { schedule(); } } });
                });
                scope.$on('$destroy', function () { destroyed = true; generation++; cancelTimer(); if (current) { current.destroy(); } editable.removeEventListener('input', input); editable.removeEventListener('click', click); editable.removeEventListener('mouseup', selectionChanged); editable.removeEventListener('touchend', selectionChanged); editable.removeEventListener('keyup', selectionChanged); editable.removeEventListener('compositionstart', compositionStart); editable.removeEventListener('compositionend', compositionEnd); editable.removeEventListener('paste', paste); editable.removeEventListener('drop', drop); doc.removeEventListener('pointerdown', outside); doc.removeEventListener('selectionchange', selectionChanged); doc.removeEventListener('keydown', escape); $window.removeEventListener('pagehide', leaving); });
            }
        };
    }]);
})();
