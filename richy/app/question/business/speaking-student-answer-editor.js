(function () {
    'use strict';
    function historyNotebookGeometry(paper, availableWidth, textHeight, devicePixelRatio) {
        var width = paper.orientation === 'landscape' ? 1123 : 794, height = paper.orientation === 'landscape' ? 794 : 1123;
        (Array.isArray(paper.strokes) ? paper.strokes : []).forEach(function (stroke) {
            (stroke && Array.isArray(stroke.points) ? stroke.points : []).forEach(function (point) {
                if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number'
                        || !isFinite(point[0]) || !isFinite(point[1]) || point[0] < 0 || point[1] < 0 || point[0] > 100000 || point[1] > 100000) { return; }
                width = Math.max(width, point[0] + 24); height = Math.max(height, point[1] + 24);
            });
        });
        var cssWidth = Math.max(1, Math.min(width, Number(availableWidth) || width)), scale = cssWidth / width;
        if (isFinite(textHeight) && textHeight > 0) { height = Math.max(height, Math.min(32000100, textHeight / scale + 4)); }
        var cssHeight = Math.max(1, Math.ceil(height * scale));
        // The entire document remains scrollable at canonical coordinates. Only
        // its bitmap is uniformly reduced, matching the study notebook limits.
        var dpr = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1), Math.sqrt(4000000 / (cssWidth * cssHeight)), 8192 / Math.max(cssWidth, cssHeight));
        return {logicalWidth: width, logicalHeight: height, cssWidth: cssWidth, cssHeight: cssHeight, scale: scale, rasterScale: scale * dpr,
            pixelsWide: Math.max(1, Math.floor(cssWidth * dpr)), pixelsHigh: Math.max(1, Math.floor(cssHeight * dpr))};
    }
    angular.module('Hrm.Question').factory('SpeakingStudentAnswerStore', ['$q', '$window', 'SpeakingService', function ($q, $window, api) {
        function copy(value) { return JSON.parse(JSON.stringify(value)); }
        function valueOf(row) { return JSON.stringify({html: row.html || '', notes: row.notes || []}); }
        function sameContext(row, context) { return row && ['setId', 'studentId', 'questionId'].every(function (key) { return Number(row[key]) === Number(context[key]); }); }
        function session(context, clean) {
            context = copy(context);
            var key = 'speaking-answer:v1:' + context.userId + ':' + context.setId + ':' + context.studentId + ':' + context.questionId;
            var state = {context: context, loading: true, ready: false, saving: false, dirty: false, revision: 0, html: '', notes: [], error: '', status: 'Đang tải câu trả lời…'};
            var baseline = valueOf(state), pending = null, inFlightPayload = null, syncing = null, restoring = null, historyGeneration = 0, destroyed = false, lastBackup;
            state.history = {loading: false, versions: [], error: '', preview: null};
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
            function receive(row) {
                if (!validRow(row) || row.revision < state.revision) { return false; }
                var remote = normalized(row), content = valueOf(remote), local = valueOf(state);
                if (!state.dirty || content === local) {
                    clearMatchingBackup({revision: state.revision, html: state.html, notes: state.notes}); apply(row); state.error = ''; state.status = 'Đã đồng bộ'; return true;
                }
                if (content === baseline) {
                    // A separate A4-notebook edit bumps the answer revision without
                    // changing this editor. Rebase its pending text safely.
                    state.revision = remote.revision; state.remote = null; state.conflict = false; state.error = ''; backup(); return false;
                }
                state.remote = copy(row); state.conflict = true; state.status = 'Có bản mới; bản đang sửa được giữ để đối chiếu.'; backup(); return false;
            }
            function refresh(canApply) {
                if (destroyed || !state.ready || state.loading || pending || restoring || typeof api.studentAnswerSync !== 'function') { return $q.when(false); }
                if (syncing) { return syncing; }
                var revision = state.revision;
                syncing = api.studentAnswerSync(context.setId, context.studentId, context.questionId, revision).then(function (data) {
                    if (destroyed || state.revision !== revision || pending || restoring || (canApply && !canApply())) { return false; }
                    if (!sameContext(data, context) || typeof data.changed !== 'boolean' || !Number.isInteger(data.revision) || data.revision < revision
                            || (!data.changed && data.revision !== revision) || (data.changed && (data.revision <= revision || !validRow(data.answer) || data.answer.revision !== data.revision))) {
                        throw new Error('Bản đồng bộ không khớp học sinh, câu hỏi hoặc phiên bản.');
                    }
                    state.syncError = ''; return data.changed ? receive(data.answer) : false;
                }).catch(function (error) { if (!destroyed) { state.syncError = (error.data && error.data.message) || error.message || 'Chưa kiểm tra được thay đổi mới. Bản đang xem vẫn được giữ.'; } return false; })
                    .finally(function () { syncing = null; });
                return syncing;
            }
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
                if (restoring) { return restoring; }
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
                                if (!destroyed && data && Number(data.setId) === context.setId && Number(data.studentId) === context.studentId && Array.isArray(data.answers) && data.answers.length === 1 && validRow(data.answers[0])) { receive(data.answers[0]); }
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
            function historyError(error) { state.history.error = (error.data && error.data.message) || error.message || 'Chưa tải được lịch sử. Bản đang sửa vẫn được giữ.'; }
            function loadHistory() {
                var generation = ++historyGeneration; state.history.loading = true; state.history.error = ''; state.history.preview = null;
                if (typeof api.studentAnswerHistory !== 'function') { state.history.loading = false; state.history.error = 'Cần cập nhật backend để xem lịch sử phiên bản.'; return $q.when(); }
                return api.studentAnswerHistory(context.setId, context.studentId, context.questionId).then(function (data) {
                    if (destroyed || generation !== historyGeneration) { return; }
                    var seen = {};
                    if (!sameContext(data, context) || !Number.isInteger(data.currentRevision) || data.currentRevision < 0
                            || data.retainedLimit !== 5 || data.retentionDays !== 14 || data.checkpointMinutes !== 10
                            || !Array.isArray(data.versions) || data.versions.length > 5 || data.versions.some(function (version) {
                        if (!version || !Number.isInteger(version.id) || version.id <= 0 || !Number.isInteger(version.revision) || version.revision < 1 || seen[version.id]) { return true; } seen[version.id] = true; return false;
                    })) { throw new Error('Lịch sử không khớp câu trả lời đang mở.'); }
                    state.history.versions = data.versions; state.history.currentRevision = data.currentRevision;
                }).catch(function (error) { if (!destroyed && generation === historyGeneration) { historyError(error); } })
                    .finally(function () { if (!destroyed && generation === historyGeneration) { state.history.loading = false; } });
            }
            function previewVersion(id) {
                var generation = ++historyGeneration; state.history.loading = true; state.history.error = ''; state.history.preview = null;
                return api.studentAnswerVersion(context.setId, context.studentId, context.questionId, id).then(function (data) {
                    if (destroyed || generation !== historyGeneration) { return; }
                    if (!sameContext(data, context) || !data.version || data.version.id !== id || !Number.isInteger(data.version.revision) || data.version.revision < 1
                            || typeof data.version.html !== 'string' || !Array.isArray(data.version.notes)) { throw new Error('Phiên bản nhận được không khớp câu trả lời.'); }
                    var value = clean(data.version.html, data.version.notes); state.history.preview = copy(data.version); state.history.preview.html = value.html; state.history.preview.notes = value.notes;
                }).catch(function (error) { if (!destroyed && generation === historyGeneration) { historyError(error); } })
                    .finally(function () { if (!destroyed && generation === historyGeneration) { state.history.loading = false; } });
            }
            function restoreVersion() {
                var preview = state.history.preview;
                if (destroyed || restoring || !preview || !state.ready || state.dirty || state.saving || pending || state.conflict || state.invalid) {
                    state.history.error = 'Cần đồng bộ bản đang sửa trước khi khôi phục phiên bản.'; return $q.when();
                }
                var request = {setId: context.setId, studentId: context.studentId, questionId: context.questionId, versionId: preview.id, versionRevision: preview.revision, revision: state.revision};
                state.history.restoring = true; state.history.error = '';
                restoring = api.restoreStudentAnswer(request).then(function (ack) {
                    if (destroyed) { return; }
                    if (!validRow(ack) || ack.revision < request.revision || ack.restoredVersionId !== request.versionId) { throw new Error('Chưa nhận đúng xác nhận khôi phục. Hãy kiểm tra bản đã đồng bộ trước khi thử lại.'); }
                    // A user may continue typing while restoration is in flight.
                    // Keep that newer draft rather than replace it with the receipt.
                    receive(ack); if (!state.dirty && !state.conflict) { state.status = 'Đã khôi phục và đồng bộ'; }
                    return ack;
                }).catch(function (error) {
                    if (!destroyed) { historyError(error); if (error.status === 409) { state.history.error = 'Câu trả lời hoặc mốc lịch sử đã thay đổi. Tải lại lịch sử và đối chiếu trước khi khôi phục.'; } }
                }).finally(function () { restoring = null; if (!destroyed) { state.history.restoring = false; } });
                return restoring;
            }
            return {state: state, load: load, change: change, save: save, refresh: refresh, loadHistory: loadHistory, previewVersion: previewVersion, restoreVersion: restoreVersion,
                backup: backup, overwriteReviewed: overwriteReviewed, useServer: useServer, destroy: function () { backup(); destroyed = true; historyGeneration++; }};
        }
        return {open: session, previewGeometry: historyNotebookGeometry};
    }]);

    angular.module('Hrm.Question').directive('speakingStudentAnswerEditor', ['$window', '$timeout', 'SpeakingStudentAnswerStore', function ($window, $timeout, store) {
        return {
            restrict: 'E', scope: {setId: '<', studentId: '<', questionId: '<', userId: '<', studentLabel: '@'},
            template: '<section class="sp-answer-editor"><header class="sp-toolbar"><strong class="sp-grow">{{studentLabel}}</strong><span class="sp-answer-sync" role="status" ng-class="{\'is-error\':ed.state.error}">{{ed.state.status}}</span><button type="button" class="sp-button" ng-click="ed.openHistory()" ng-disabled="ed.state.loading"><i class="fa fa-history"></i> Lịch sử phiên bản</button><button type="button" class="sp-button" ng-if="ed.state.error && ed.state.ready && !ed.state.conflict" ng-click="ed.save()" ng-disabled="ed.state.saving">Thử đồng bộ lại</button></header>' +
                '<div class="sp-answer-format" role="toolbar" aria-label="Định dạng câu trả lời"><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'bold\')" ng-disabled="ed.state.loading" aria-label="Chữ đậm"><b>B</b></button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'italic\')" ng-disabled="ed.state.loading" aria-label="Chữ nghiêng"><i>I</i></button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.format(\'underline\')" ng-disabled="ed.state.loading" aria-label="Gạch chân"><u>U</u></button><span></span><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(true)" ng-disabled="ed.state.loading || !ed.hasSelection"><i class="fa fa-sticky-note-o"></i> Take note</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(false)" ng-disabled="ed.state.loading || !ed.hasSelection"><i class="fa fa-pencil"></i> Highlight</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.removeAnnotation()" ng-disabled="!ed.marker"><i class="fa fa-eraser"></i> Bỏ đánh dấu</button></div>' +
                '<p class="sp-error-text" role="alert" ng-if="ed.state.error">{{ed.state.error}} <button class="sp-link" type="button" ng-if="ed.state.status===\'Chưa tải được\'" ng-click="ed.reload()">Tải lại</button></p><p class="sp-error-text" role="status" ng-if="ed.state.syncError">{{ed.state.syncError}}</p><p class="sp-error-text" role="alert" ng-if="ed.state.storageError">Bộ nhớ thiết bị đã đầy; giữ trang mở để tự đồng bộ lên server.</p>' +
                '<div class="sp-answer-editable" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Câu trả lời riêng" data-placeholder="Viết câu trả lời của bạn…" spellcheck="true"></div>' +
                '<div class="sp-answer-selection" ng-if="ed.hasSelection && !ed.state.loading" ng-style="ed.selectionStyle" role="toolbar" aria-label="Công cụ đoạn chữ"><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.readSelection()" ng-attr-aria-label="{{ed.speaking ? \'Dừng đọc\' : \'Đọc đoạn đã chọn\'}}" aria-pressed="{{ed.speaking}}"><i class="fa" ng-class="ed.speaking ? \'fa-stop\' : \'fa-volume-up\'"></i> {{ed.speaking ? \'Dừng\' : \'Nghe\'}}</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.addPhonetic()"><i class="fa fa-language"></i> Phiên âm</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(true)"><i class="fa fa-sticky-note-o"></i> Take note</button><button type="button" ng-mousedown="$event.preventDefault()" ng-click="ed.annotate(false)"><i class="fa fa-pencil"></i> Highlight</button></div>' +
                '<p class="sp-error-text" role="status" ng-if="ed.speechError">{{ed.speechError}}</p>' +
                '<p class="sp-error-text" role="status" ng-if="ed.phoneticError">{{ed.phoneticError}}</p>' +
                '<aside class="sp-answer-note" ng-if="ed.activeNote" ng-style="ed.noteStyle" role="dialog" aria-label="Ghi chú đoạn chữ"><header><strong><i class="fa fa-sticky-note"></i> Ghi chú</strong><button type="button" class="sp-close" ng-click="ed.closeNote()" aria-label="Đóng ghi chú">×</button></header><div class="sp-note-lookup" ng-if="ed.lookupText"><a ng-href="{{ed.cambridgeUrl()}}" target="_blank" rel="noopener noreferrer"><i class="fa fa-external-link"></i> Tra Cambridge · {{ed.lookupText}}</a><small>Copy phiên âm IPA rồi dán vào ghi chú bên dưới. Ghi chú tự lưu.</small></div><textarea aria-label="Nội dung ghi chú" maxlength="2000" ng-model="ed.activeNote.text" ng-change="ed.noteChanged()" placeholder="Ghi điều cần nhớ…"></textarea><footer><small>Bấm vào đoạn đã đánh dấu để mở hoặc đóng.</small><button type="button" class="sp-note-delete" ng-click="ed.deleteNote()"><i class="fa fa-trash-o"></i> Xóa ghi chú</button></footer></aside>' +
                '<div class="sp-answer-conflict" ng-if="ed.state.conflict"><strong>Bản mới vừa được lưu ở nơi khác</strong><p>Bản bạn đang sửa vẫn được giữ. Đối chiếu trước khi thay nội dung trên server.</p><details ng-if="ed.state.remote"><summary>Xem bản mới trên server</summary><p class="sp-preserve">{{ed.remoteText()}}</p></details><div class="sp-toolbar"><button class="sp-button" type="button" ng-disabled="!ed.state.remote || ed.state.saving" ng-click="ed.useServer()">Dùng bản máy chủ, giữ nháp cũ trên thiết bị</button><button class="sp-button" type="button" ng-disabled="!ed.state.remote || ed.state.saving" ng-click="ed.overwrite()">Lưu bản đang sửa thay bản máy chủ</button></div></div><small class="sp-muted">Tự lưu chữ, định dạng, ghi chú và highlight. Thay đổi từ người cùng xem được cập nhật sau vài giây.</small>' +
                '<div class="sp-overlay sp-version-overlay" ng-if="ed.historyOpen" ng-click="ed.closeHistory()"><section class="sp-modal sp-version-dialog" role="dialog" aria-modal="true" aria-label="Lịch sử câu trả lời" ng-click="$event.stopPropagation()"><header><div><h2>Lịch sử phiên bản</h2><small>Giữ tối đa 5 mốc trong 14 ngày gần nhất; gộp sửa liên tiếp khoảng 10 phút. Bài hiện tại vẫn được giữ và tự lưu ngay khi sửa.</small></div><button type="button" class="sp-close" ng-click="ed.closeHistory()" aria-label="Đóng lịch sử" ng-disabled="ed.state.history.restoring">×</button></header><div class="sp-modal-body"><p class="sp-error-text" role="alert" ng-if="ed.state.history.error">{{ed.state.history.error}}</p><p role="status" ng-if="ed.state.history.loading">Đang tải phiên bản…</p><div class="sp-version-layout"><nav class="sp-version-list" aria-label="Các phiên bản đã lưu"><button type="button" class="sp-button" ng-repeat="version in ed.state.history.versions track by version.id" ng-click="ed.previewVersion(version)" ng-disabled="ed.state.history.restoring" ng-class="{\'is-active\':ed.state.history.preview.id===version.id}"><strong>{{version.updatedAt | date:\'dd/MM/yyyy HH:mm\'}}</strong><small>{{version.editorName || (\'Tài khoản #\'+version.editorId)}} · {{ed.versionSource(version.source)}}</small></button><p class="sp-muted" ng-if="!ed.state.history.loading && !ed.state.history.versions.length">Chưa có phiên bản. Lịch sử bắt đầu được giữ sau khi cập nhật tính năng.</p></nav><article class="sp-version-preview" ng-if="ed.state.history.preview"><h3>Bản xem trước · {{ed.state.history.preview.updatedAt | date:\'dd/MM/yyyy HH:mm\'}}</h3><div class="sp-version-answer" ng-bind-html="ed.state.history.preview.html"></div><div ng-if="ed.state.history.preview.notes.length"><h3>Ghi chú trong đoạn chữ</h3><p class="sp-preserve" ng-repeat="note in ed.state.history.preview.notes track by note.id">{{note.text || \'(Ghi chú trống)\'}}</p></div><div ng-if="ed.state.history.preview.notebook"><h3>Sổ ghi chú A4</h3><div class="sp-version-paper-scroll"><div class="sp-version-paper" ng-class="\'is-\'+ed.state.history.preview.notebook.orientation"><pre>{{ed.state.history.preview.notebook.text}}</pre><canvas aria-label="Nét vẽ trong phiên bản ghi chú" class="sp-version-drawing"></canvas></div></div></div></article><p class="sp-muted" ng-if="!ed.state.history.preview && ed.state.history.versions.length">Chọn một mốc để xem nội dung, ghi chú và nét vẽ.</p></div></div><footer><button type="button" class="sp-button" ng-click="ed.refreshHistory()" ng-disabled="ed.state.history.loading || ed.state.history.restoring">Làm mới lịch sử</button><button type="button" class="sp-button sp-primary" ng-click="ed.restoreVersion()" ng-disabled="!ed.state.history.preview || ed.state.history.loading || ed.state.history.restoring">{{ed.state.history.restoring ? \'Đang khôi phục…\' : \'Khôi phục thành phiên bản mới\'}}</button></footer></section></div></section>',
            link: function (scope, element) {
                var doc = $window.document, root = element[0], editable = root.querySelector('.sp-answer-editable'), current, timer, pollTimer, previewTimer, selectedRange, composing = false, destroyed = false, generation = 0;
                var ed = scope.ed = {state: {loading: true, status: 'Đang tải câu trả lời…'}, hasSelection: false, speaking: false};
                var speechOwner = {}, speechRequest = 0;
                function stopSpeech() {
                    speechRequest++; ed.speaking = false;
                    if ($window.EnglishSpeech) { $window.EnglishSpeech.cancel(speechOwner); }
                }
                ed.readSelection = function () {
                    if (ed.speaking) { stopSpeech(); return; }
                    if (destroyed || !ed.state.ready || ed.state.loading || !ed.hasSelection || !selectedRange || !editable.contains(selectedRange.commonAncestorContainer)) { return; }
                    var text = selectedRange.toString().replace(/\s+/g, ' ').trim(), speech = $window.EnglishSpeech;
                    ed.speechError = '';
                    if (!text) { return; }
                    if (!speech || !speech.isSupported()) { ed.speechError = 'Trình duyệt này chưa hỗ trợ đọc thành tiếng.'; return; }
                    var request = ++speechRequest, sessionGeneration = generation;
                    function complete(error) {
                        scope.$evalAsync(function () {
                            if (destroyed || generation !== sessionGeneration || speechRequest !== request) { return; }
                            ed.speaking = false;
                            if (error && error.error !== 'interrupted' && error.error !== 'canceled') { ed.speechError = 'Chưa đọc được đoạn chữ. Bạn thử lại hoặc kiểm tra giọng tiếng Anh trên thiết bị.'; }
                        });
                    }
                    ed.speaking = true;
                    try {
                        if (!speech.speak(text, {lang: 'en-GB', plainText: true, owner: speechOwner, onend: function () { complete(); }, onerror: complete})) {
                            ed.speaking = false; ed.speechError = 'Chưa đọc được đoạn chữ. Bạn thử lại nhé.';
                        }
                    } catch (error) { complete({error: 'synthesis-failed'}); }
                };
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
                function renderIncoming() {
                    var noteId = ed.activeNote && ed.activeNote.id, selection = $window.getSelection(), offsets = null;
                    if (selection && selection.rangeCount && editable.contains(selection.getRangeAt(0).commonAncestorContainer)) {
                        var range = selection.getRangeAt(0), prefix = range.cloneRange(); prefix.selectNodeContents(editable); prefix.setEnd(range.startContainer, range.startOffset);
                        offsets = [prefix.toString().length, prefix.toString().length + range.toString().length];
                    }
                    render(); selectedRange = null; ed.hasSelection = false; ed.marker = null;
                    if (offsets) {
                        var walker = doc.createTreeWalker(editable, 4, null, false), text, index = 0, start = null, end = null;
                        while ((text = walker.nextNode())) { if (!start && offsets[0] <= index + text.nodeValue.length) { start = [text, Math.max(0, offsets[0] - index)]; } if (offsets[1] <= index + text.nodeValue.length) { end = [text, Math.max(0, offsets[1] - index)]; break; } index += text.nodeValue.length; }
                        if (start && end) { var restored = doc.createRange(); restored.setStart(start[0], start[1]); restored.setEnd(end[0], end[1]); selection.removeAllRanges(); selection.addRange(restored); selectedRange = restored.cloneRange(); }
                    }
                    if (noteId) { var marker = editable.querySelector('[data-note-id="' + noteId + '"]'), note = ed.state.notes.filter(function (item) { return item.id === noteId; })[0]; if (marker && note) { openNote(note, marker); } else { ed.activeNote = null; } }
                }
                function cancelTimer() { if (timer) { $timeout.cancel(timer); timer = null; } }
                function schedule() { cancelTimer(); if (current && ed.state.dirty && !ed.state.conflict && !composing) { timer = $timeout(function () { timer = null; ed.save(); }, 1300); } }
                function changed() { if (!current || ed.state.loading || !ed.state.ready) { return; } var activeId = ed.activeNote && ed.activeNote.id; current.change(editable.innerHTML, ed.state.notes); if (activeId) { ed.activeNote = ed.state.notes.filter(function (note) { return note.id === activeId; })[0] || null; } schedule(); }
                function capture() {
                    var selection = $window.getSelection(), range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
                    if (range && editable.contains(range.commonAncestorContainer)) {
                        selectedRange = range.cloneRange(); ed.hasSelection = !range.collapsed && !!selection.toString().trim();
                        if (ed.hasSelection) { var bounds = range.getBoundingClientRect(), width = $window.innerWidth || doc.documentElement.clientWidth, height = $window.innerHeight || doc.documentElement.clientHeight, popupWidth = Math.min(390, width - 16), popupTop = Math.max(8, Math.min(bounds.bottom + 8, height - 94)); ed.selectionStyle = {left: Math.max(8, Math.min(bounds.left, width - popupWidth - 8)) + 'px', top: popupTop + 'px', maxHeight: Math.max(24, height - popupTop - 8) + 'px'}; }
                    }
                    else { ed.hasSelection = false; }
                }
                function restoreSelection() { if (!selectedRange || !editable.contains(selectedRange.commonAncestorContainer)) { return false; } var selection = $window.getSelection(); editable.focus(); selection.removeAllRanges(); selection.addRange(selectedRange); return true; }
                function markerAt(target) { while (target && target !== editable) { if (target.nodeType === 1 && /\bielts-annotation\b/.test(target.className || '')) { return target; } target = target.parentNode; } return null; }
                function openNote(note, marker, lookupText) {
                    ed.activeNote = note; ed.marker = marker;
                    ed.lookupText = String(lookupText || Array.prototype.slice.call(editable.querySelectorAll('span[data-note-id]')).filter(function (span) { return span.getAttribute('data-note-id') === note.id; }).map(function (span) { return span.textContent || ''; }).join('')).replace(/\s+/g, ' ').trim().slice(0, 200);
                    var bounds = marker.getBoundingClientRect(), width = $window.innerWidth || doc.documentElement.clientWidth, height = $window.innerHeight || doc.documentElement.clientHeight;
                    var top = bounds.bottom + 8; if (top + 330 > height) { top = Math.max(8, Math.min(bounds.top - 320, height - 338)); }
                    var positionTop = Math.max(8, top);
                    ed.noteStyle = {position: 'fixed', top: positionTop + 'px', left: Math.max(8, Math.min(bounds.left, width - 316)) + 'px', maxHeight: Math.max(40, height - positionTop - 8) + 'px'};
                }
                ed.closeNote = function () { ed.activeNote = null; };
                ed.cambridgeUrl = function () { return 'https://dictionary.cambridge.org/dictionary/english/?q=' + encodeURIComponent(ed.lookupText || ''); };
                ed.addPhonetic = function () {
                    if (destroyed || !ed.state.ready || !ed.hasSelection || !selectedRange || !editable.contains(selectedRange.commonAncestorContainer)) { return; }
                    var text = selectedRange.toString().replace(/\s+/g, ' ').trim(), marker = selectedRange.commonAncestorContainer;
                    ed.phoneticError = ''; if (!text) { return; }
                    while (marker && marker !== editable && !(marker.nodeType === 1 && marker.getAttribute('data-note-id'))) { marker = marker.parentNode; }
                    var id = marker && marker !== editable && marker.getAttribute('data-note-id'), existing = id && ed.state.notes.filter(function (note) { return note.id === id; })[0];
                    if (existing) {
                        openNote(existing, marker, text); selectedRange = null; ed.hasSelection = false; $window.getSelection().removeAllRanges(); return;
                    }
                    var overlapsNote = Array.prototype.slice.call(editable.querySelectorAll('span[data-note-id]')).some(function (span) { return selectedRange.intersectsNode(span); });
                    if (overlapsNote) { ed.phoneticError = 'Đoạn chọn đang chứa ghi chú. Chọn riêng một đoạn đã ghi chú để bổ sung phiên âm.'; return; }
                    var added = ed.annotate(true); if (added && ed.activeNote && ed.activeNote.id === added.id) { ed.lookupText = text.slice(0, 200); }
                };
                ed.noteChanged = function () { changed(); };
                ed.deleteNote = function () {
                    if (!current || !ed.state.ready || !ed.activeNote) { return; }
                    var id = ed.activeNote.id;
                    Array.prototype.slice.call(editable.querySelectorAll('span[data-note-id]')).forEach(function (span) {
                        if (span.getAttribute('data-note-id') !== id) { return; }
                        span.removeAttribute('data-note-id'); span.classList.remove('has-note');
                        if (!span.classList.contains('is-highlighted')) {
                            span.classList.remove('ielts-annotation'); span.removeAttribute('data-annotation-group');
                            if (!span.className) { while (span.firstChild) { span.parentNode.insertBefore(span.firstChild, span); } span.parentNode.removeChild(span); }
                        }
                    });
                    ed.state.notes = ed.state.notes.filter(function (note) { return note.id !== id; }); ed.activeNote = null; ed.marker = null; changed();
                };
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
                    ed.marker = markers[0]; selectedRange = null; ed.hasSelection = false; $window.getSelection().removeAllRanges(); changed(); return withNote ? note : null;
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
                ed.versionSource = function (source) { return {EDIT:'Chỉnh sửa', IMPORT:'Import', RESTORE:'Khôi phục', BASELINE:'Bản trước khi sửa', NOTEBOOK:'Sổ ghi chú'}[source] || 'Đã lưu'; };
                ed.openHistory = function () { if (!current || !ed.state.ready) { return; } ed.activeNote = null; ed.historyOpen = true; return current.loadHistory(); };
                ed.closeHistory = function () { if (ed.state.history && ed.state.history.restoring) { return; } ed.historyOpen = false; };
                ed.refreshHistory = function () { if (!current) { return; } return current.loadHistory(); };
                function drawHistoryNotebook() {
                    var preview = ed.state.history.preview, canvas = root.querySelector('.sp-version-drawing'), paper = preview && preview.notebook;
                    if (!canvas || !paper || !Array.isArray(paper.strokes)) { return; }
                    var frame = canvas.parentNode, scroller = frame.parentNode, text = frame.querySelector('pre');
                    var available = scroller.clientWidth || scroller.getBoundingClientRect().width || 500;
                    var geometry = store.previewGeometry(paper, available, 0, $window.devicePixelRatio);
                    frame.style.width = geometry.cssWidth + 'px';
                    if (text) {
                        var lineHeight = paper.pattern === 'grid' ? 20 : paper.pattern === 'squares' ? 64 : 28;
                        text.style.fontSize = (17 * geometry.scale) + 'px'; text.style.lineHeight = (lineHeight * geometry.scale) + 'px'; text.style.padding = (40 * geometry.scale) + 'px';
                        geometry = store.previewGeometry(paper, available, text.scrollHeight, $window.devicePixelRatio);
                    }
                    frame.style.height = geometry.cssHeight + 'px'; canvas.style.width = geometry.cssWidth + 'px'; canvas.style.height = geometry.cssHeight + 'px';
                    canvas.width = geometry.pixelsWide; canvas.height = geometry.pixelsHigh; var context = canvas.getContext('2d'); if (!context) { return; }
                    context.setTransform(geometry.rasterScale, 0, 0, geometry.rasterScale, 0, 0);
                    paper.strokes.forEach(function (stroke) {
                        if (!stroke || !/^#[0-9a-f]{6}$/i.test(stroke.color || '') || !Array.isArray(stroke.points) || !stroke.points.length || !isFinite(stroke.width)) { return; }
                        context.beginPath(); context.strokeStyle = stroke.color; context.lineWidth = Math.max(.1, Math.min(100, stroke.width)); context.lineJoin = context.lineCap = 'round'; context.globalAlpha = stroke.tool === 'highlighter' ? .28 : 1;
                        stroke.points.forEach(function (point, index) { if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) { return; } if (!index) { context.moveTo(point[0], point[1]); } else { context.lineTo(point[0], point[1]); } });
                        if (stroke.points.length === 1) { var point = stroke.points[0]; context.arc(point[0], point[1], context.lineWidth / 2, 0, Math.PI * 2); context.fillStyle = stroke.color; context.fill(); } else { context.stroke(); }
                    });
                }
                ed.previewVersion = function (version) {
                    if (!current || ed.state.history.restoring) { return; } var session = current;
                    return session.previewVersion(version.id).then(function () { if (!destroyed && session === current) { $timeout.cancel(previewTimer); previewTimer = $timeout(drawHistoryNotebook, 0); } });
                };
                function resizeHistory() { if (ed.historyOpen && ed.state.history.preview) { $timeout.cancel(previewTimer); previewTimer = $timeout(drawHistoryNotebook, 0); } }
                ed.restoreVersion = function () {
                    if (!current || composing || !ed.state.history.preview || ed.state.history.restoring) { return; }
                    if (!$window.confirm('Khôi phục toàn bộ chữ, ghi chú, highlight và sổ A4 của mốc này? Bản hiện tại vẫn được giữ trong lịch sử.')) { return; }
                    var session = current; changed(); cancelTimer();
                    return session.save().then(function () { if (!destroyed && session === current) { return session.restoreVersion(); } }).then(function (ack) {
                        if (destroyed || session !== current) { return; }
                        if (ack && !ed.state.dirty && !ed.state.conflict) { renderIncoming(); ed.historyOpen = false; }
                        if (ed.state.dirty && !ed.state.conflict && !ed.state.error) { schedule(); }
                    });
                };
                function stopPolling() { $timeout.cancel(pollTimer); pollTimer = null; }
                function poll() {
                    stopPolling(); if (destroyed || !current) { return; }
                    pollTimer = $timeout(function () { pollTimer = null; checkRemote(); }, 3000);
                }
                function checkRemote() {
                    if (destroyed || !current) { return; }
                    if (doc.hidden || composing || ed.state.history && ed.state.history.restoring) { poll(); return; }
                    var session = current, before = ed.state.html, beforeNotes = JSON.stringify(ed.state.notes || []);
                    return session.refresh(function () {
                        if (destroyed || session !== current || composing) { return false; }
                        // A browser input event may still be queued for Angular.
                        // Capture it before deciding whether a remote copy is safe.
                        if (editable.innerHTML !== ed.state.html) { changed(); }
                        return true;
                    }).then(function () {
                        if (destroyed || session !== current) { return; }
                        if (!composing && !ed.state.dirty && !ed.state.conflict && (before !== ed.state.html || beforeNotes !== JSON.stringify(ed.state.notes || []))) { renderIncoming(); }
                        if (ed.state.dirty && !ed.state.error && !ed.state.conflict) { schedule(); }
                    }).finally(function () { if (!destroyed && session === current) { poll(); } });
                }
                function visible() { if (!doc.hidden) { scope.$evalAsync(checkRemote); } }
                function click(event) { var marker = markerAt(event.target); scope.$evalAsync(function () { ed.marker = marker; var id = marker && marker.getAttribute('data-note-id'), note = id && ed.state.notes.filter(function (item) { return item.id === id; })[0]; if (note && (!ed.activeNote || ed.activeNote.id !== id)) { openNote(note, marker); } else { ed.activeNote = null; } }); }
                function outside(event) { if (!root.contains(event.target)) { scope.$evalAsync(function () { ed.activeNote = null; ed.marker = null; ed.hasSelection = false; }); } else if (!editable.contains(event.target) && !event.target.closest('.sp-answer-note, .sp-answer-format, .sp-answer-selection')) { scope.$evalAsync(function () { ed.activeNote = null; }); } }
                function input() { scope.$evalAsync(function () { changed(); capture(); }); }
                function selectionChanged() { scope.$evalAsync(capture); }
                function compositionStart() { composing = true; cancelTimer(); }
                function compositionEnd() { composing = false; input(); }
                function paste(event) { event.preventDefault(); var text = event.clipboardData ? event.clipboardData.getData('text/plain') : ''; doc.execCommand('insertText', false, text); input(); }
                function drop(event) { event.preventDefault(); }
                function escape(event) { if (event.key === 'Escape') { scope.$evalAsync(function () { ed.activeNote = null; ed.closeHistory(); }); } }
                function leaving() { if (current) { current.backup(); } }
                editable.addEventListener('input', input); editable.addEventListener('click', click); editable.addEventListener('mouseup', selectionChanged); editable.addEventListener('touchend', selectionChanged); editable.addEventListener('keyup', selectionChanged); editable.addEventListener('compositionstart', compositionStart); editable.addEventListener('compositionend', compositionEnd); editable.addEventListener('paste', paste); editable.addEventListener('drop', drop); doc.addEventListener('pointerdown', outside); doc.addEventListener('selectionchange', selectionChanged); doc.addEventListener('keydown', escape); doc.addEventListener('visibilitychange', visible); $window.addEventListener('focus', visible); $window.addEventListener('resize', resizeHistory); $window.addEventListener('pagehide', leaving);
                scope.$watchGroup(['setId', 'studentId', 'questionId', 'userId'], function (values) {
                    var next = ++generation; stopSpeech(); ed.speechError = ''; ed.phoneticError = ''; ed.lookupText = ''; cancelTimer(); stopPolling(); $timeout.cancel(previewTimer); if (current) { current.save(); current.destroy(); } ed.activeNote = null; ed.marker = null; ed.hasSelection = false; ed.historyOpen = false; selectedRange = null;
                    if (!values.every(function (id) { return Number.isInteger(Number(id)) && Number(id) > 0; })) { return; }
                    current = store.open({setId: Number(values[0]), studentId: Number(values[1]), questionId: Number(values[2]), userId: Number(values[3])}, clean); ed.state = current.state; render();
                    current.load().then(function () { if (!destroyed && generation === next) { render(); if (ed.state.dirty && !ed.state.conflict) { schedule(); } poll(); } });
                });
                scope.$on('$destroy', function () { destroyed = true; generation++; stopSpeech(); cancelTimer(); stopPolling(); $timeout.cancel(previewTimer); if (current) { current.save(); current.destroy(); } editable.removeEventListener('input', input); editable.removeEventListener('click', click); editable.removeEventListener('mouseup', selectionChanged); editable.removeEventListener('touchend', selectionChanged); editable.removeEventListener('keyup', selectionChanged); editable.removeEventListener('compositionstart', compositionStart); editable.removeEventListener('compositionend', compositionEnd); editable.removeEventListener('paste', paste); editable.removeEventListener('drop', drop); doc.removeEventListener('pointerdown', outside); doc.removeEventListener('selectionchange', selectionChanged); doc.removeEventListener('keydown', escape); doc.removeEventListener('visibilitychange', visible); $window.removeEventListener('focus', visible); $window.removeEventListener('resize', resizeHistory); $window.removeEventListener('pagehide', leaving); });
            }
        };
    }]);
})();
