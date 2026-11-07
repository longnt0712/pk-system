(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentNotebookStore', ['$window', '$timeout', '$q', '$cookies', 'TnttDocumentApi',
        function ($window, $timeout, $q, $cookies, api) {
            var entries = {}, serial = 0;
            function copy(value) { return JSON.parse(JSON.stringify(value)); }
            function positive(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
            function blank() { return {text: '', orientation: 'portrait', pattern: 'lined', strokes: [], pageCount: 3}; }
            function documentValue(value) {
                if (!value || typeof value.text !== 'string' || value.text.length > 500000 ||
                    ['portrait', 'landscape'].indexOf(value.orientation) < 0 || ['blank', 'lined', 'vertical', 'grid', 'squares', 'sketch'].indexOf(value.pattern) < 0 ||
                    !Array.isArray(value.strokes) || value.strokes.length > 10000) { throw new Error('Nội dung ghi chú không hợp lệ hoặc quá dài.'); }
                var points = 0;
                value.strokes.forEach(function (stroke) {
                    if (!stroke || typeof stroke.id !== 'string' || !stroke.id || stroke.id.length > 100 || ['pen', 'highlighter'].indexOf(stroke.tool) < 0 ||
                        !/^#[0-9a-f]{6}$/i.test(stroke.color) || typeof stroke.width !== 'number' || !(stroke.width > 0 && stroke.width <= 100) ||
                        !Array.isArray(stroke.points) || !stroke.points.length) { throw new Error('Nét vẽ ghi chú không hợp lệ.'); }
                    points += stroke.points.length;
                    stroke.points.forEach(function (point) {
                        if (!Array.isArray(point) || point.length < 2 || point.length > 3 || point.some(function (n) { return typeof n !== 'number' || !isFinite(n) || n < 0 || n > 100000; }) ||
                            point.length === 3 && point[2] > 1) { throw new Error('Tọa độ nét vẽ không hợp lệ.'); }
                    });
                });
                if (points > 200000 || JSON.stringify(value).length > 8000000) { throw new Error('Ghi chú vượt dung lượng đồng bộ. Bản đang viết vẫn được giữ.'); }
                if (value.textColor !== undefined && (typeof value.textColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.textColor))) { throw new Error('Màu chữ tài liệu không hợp lệ.'); }
                if (value.pageCount !== undefined && (!Number.isInteger(value.pageCount) || value.pageCount < 1 || value.pageCount > 80)) {
                    throw new Error('Số trang tài liệu phải từ 1 đến 80.');
                }
                var result = {text: value.text, orientation: value.orientation, pattern: value.pattern, strokes: value.strokes.map(function (stroke) {
                    return {id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points: copy(stroke.points)};
                })};
                if (value.textColor !== undefined) { result.textColor = value.textColor; }
                if (value.pageCount !== undefined) { result.pageCount = value.pageCount; }
                if (value.textDelta !== undefined) {
                    var delta = value.textDelta, text = '';
                    if (!delta || !Array.isArray(delta.ops) || !delta.ops.length || delta.ops.length > 10000) { throw new Error('Định dạng chữ tài liệu không hợp lệ.'); }
                    result.textDelta = {ops: delta.ops.map(function (op) {
                        if (!op || typeof op.insert !== 'string' || !op.insert.length) { throw new Error('Định dạng chữ tài liệu không hợp lệ.'); }
                        text += op.insert;
                        var clean = {insert: op.insert}, attributes = {};
                        if (op.attributes !== undefined) {
                            if (!op.attributes || typeof op.attributes !== 'object' || Array.isArray(op.attributes) ||
                                Object.keys(op.attributes).some(function (key) { return ['bold', 'italic'].indexOf(key) < 0 || typeof op.attributes[key] !== 'boolean'; })) {
                                throw new Error('Định dạng chữ tài liệu không hợp lệ.');
                            }
                            ['bold', 'italic'].forEach(function (key) { if (op.attributes[key]) { attributes[key] = true; } });
                        }
                        if (Object.keys(attributes).length) { clean.attributes = attributes; }
                        return clean;
                    })};
                    if (text !== value.text + '\n') { throw new Error('Định dạng chữ không khớp nội dung tài liệu.'); }
                }
                return result;
            }
            function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
            function open(identity) {
                var context = {documentId: Number(identity.documentId), userId: Number(identity.userId)};
                if (!Object.keys(context).every(function (key) { return positive(context[key]); })) { throw new Error('Thiếu thông tin tài liệu TNTT.'); }
                var key = 'tntt-document-notebook:v1:' + context.userId + ':' + context.documentId;
                if (!authenticated()) { throw new Error('Tài khoản ghi chú không khớp tài khoản đang đăng nhập.'); }
                if (entries[key]) { entries[key].refs++; return entries[key].session; }
                var session = {document: blank(), status: 'loading', error: '', revision: 0, ready: null};
                var entry = {session: session, refs: 1}, loaded = false, dirty = false, baseline = JSON.stringify(session.document), operation = null, reading = null;
                var timer = null, poll = null, visible = false, interaction = false, interactions = {}, deferredRemote = null, conflict = null, lastBackup = null, localSaved = true;
                entries[key] = entry;
                function authenticated() { try { return Number(JSON.parse($cookies.get('education.user') || '{}').id) === context.userId; } catch (ignore) { return false; } }
                function matches(row) { return row && Number(row.id) === context.documentId && Number.isInteger(row.revision) && row.revision >= 0; }
                function fail(error) { session.status = conflict ? 'conflict' : localSaved ? 'local' : 'error'; session.error = (error && error.data && error.data.message) || (error && error.message) || 'Chưa đồng bộ được ghi chú. Bản đang viết vẫn được giữ.'; }
                function persist() {
                    try {
                        if (dirty) { lastBackup = JSON.stringify({context: context, revision: session.revision, document: session.document, stamp: Date.now() + '-' + (++serial)}); $window.localStorage.setItem(key, lastBackup); }
                        else if (lastBackup && $window.localStorage.getItem(key) === lastBackup) { $window.localStorage.removeItem(key); lastBackup = null; }
                        localSaved = true;
                    } catch (error) { localSaved = false; }
                }
                function apply(row) {
                    var value = documentValue(row.document);
                    if (!equal(session.document, value)) { session.document = value; }
                    session.revision = row.revision; baseline = JSON.stringify(value); dirty = false; conflict = null;
                    session.status = row.revision ? 'saved' : 'ready'; session.error = ''; persist();
                }
                function reconcile(row) {
                    row = {id: context.documentId, revision: row.revision, document: documentValue(row.document)};
                    if (interaction) { deferredRemote = row; return; }
                    if (row.revision < session.revision) { return; }
                    if (!dirty || equal(session.document, row.document)) { apply(row); }
                    else if (row.revision !== session.revision) { conflict = row; session.status = 'conflict'; session.error = 'Có ghi chú mới của người soạn tài liệu. Bản đang viết được giữ để đối chiếu.'; persist(); }
                }
                function schedule() {
                    $timeout.cancel(timer); timer = null;
                    if (entry.refs && dirty && !conflict && !interaction) { timer = $timeout(function () { timer = null; session.save(); }, 900); }
                }
                session.changed = function () {
                    dirty = JSON.stringify(session.document) !== baseline;
                    persist();
                    if (!conflict) { session.status = dirty ? localSaved ? 'local' : 'error' : session.revision ? 'saved' : 'ready'; session.error = localSaved ? '' : 'Chưa giữ được bản nháp trên thiết bị. Hãy giữ trang mở và thử đồng bộ lại.'; }
                    schedule();
                };
                session.refresh = function (force) {
                    if (reading) { return reading; }
                    if (operation || interaction || !entry.refs || !authenticated()) { return $q.when(session); }
                    reading = api.read(context.documentId, loaded && !force ? session.revision : undefined).then(function (row) {
                        if (!entry.refs || operation || !authenticated()) { return session; }
                        if (!matches(row)) { throw new Error('Ghi chú nhận được không khớp tài liệu.'); }
                        if (row.changed === false) {
                            if (!loaded || row.revision !== session.revision) { throw new Error('Phiên bản đồng bộ ghi chú không khớp.'); }
                            if (!conflict) { session.error = ''; session.status = dirty ? 'local' : session.revision ? 'saved' : 'ready'; schedule(); }
                            return session;
                        }
                        loaded = true; reconcile(row); schedule(); return session;
                    }).catch(function (error) { if (entry.refs) { fail(error); } return session; }).finally(function () { reading = null; });
                    return reading;
                };
                function cleanup() {
                    if (!entry.refs && (!dirty || localSaved) && entries[key] === entry) { delete entries[key]; }
                }
                session.save = function () {
                    $timeout.cancel(timer); timer = null;
                    if (operation) { return operation; }
                    if (!dirty || conflict || interaction || !authenticated()) { return $q.when(session); }
                    if (!loaded) { return session.refresh(true).then(function () { return loaded && !conflict ? session.save() : session; }); }
                    var payload;
                    try {
                        payload = {revision: session.revision, document: documentValue(session.document)};
                        if (payload.document.textDelta) { session.document.textDelta = copy(payload.document.textDelta); }
                    }
                    catch (error) { persist(); fail(error); return $q.when(session); }
                    session.status = 'saving'; session.error = ''; persist();
                    operation = api.save(context.documentId, payload).then(function (row) {
                        if (!authenticated() || !matches(row) || row.revision < 1 || row.revision < payload.revision || !equal(documentValue(row.document), payload.document)) { throw new Error('Chưa nhận đúng xác nhận lưu ghi chú. Bản đang viết vẫn được giữ.'); }
                        session.revision = row.revision; baseline = JSON.stringify(documentValue(row.document)); dirty = JSON.stringify(session.document) !== baseline; conflict = null;
                        session.status = dirty ? 'local' : 'saved'; session.error = ''; persist(); return session;
                    }).catch(function (error) {
                        if (error.status === 409 && authenticated()) {
                            return api.read(context.documentId).then(function (row) {
                                if (matches(row)) { reconcile(row); } if (!conflict && dirty) { fail(error); } return session;
                            }, function () { fail(error); return session; });
                        }
                        persist(); fail(error); return session;
                    }).finally(function () {
                        operation = null;
                        if (dirty && !conflict && session.status !== 'error' && !session.error) { if (entry.refs) { schedule(); } else { session.save(); } }
                        cleanup();
                    });
                    return operation;
                };
                session.keepLocal = function () {
                    if (!conflict) { return session.save(); }
                    return api.read(context.documentId).then(function (row) {
                        if (!authenticated() || !matches(row)) { throw new Error('Chưa xác nhận được phiên bản ghi chú mới.'); }
                        session.revision = row.revision; baseline = JSON.stringify(documentValue(row.document)); conflict = null;
                        dirty = JSON.stringify(session.document) !== baseline; session.error = ''; persist(); return session.save();
                    }).catch(function (error) { fail(error); return session; });
                };
                session.useRemote = function () {
                    if (!conflict) { return session.refresh(true); }
                    try { $window.localStorage.setItem(key + ':previous:' + Date.now(), JSON.stringify({context: context, revision: session.revision, document: session.document})); }
                    catch (error) { fail(new Error('Chưa giữ được bản dự phòng; chưa thay nội dung đang viết.')); return $q.when(session); }
                    apply(conflict); return $q.when(session);
                };
                function nextPoll() {
                    $timeout.cancel(poll); poll = null;
                    if (visible && entry.refs) { poll = $timeout(function () { poll = null; if (!$window.document.hidden) { session.refresh(); } nextPoll(); }, 3000); }
                }
                session.setVisible = function (value) { visible = value === true; nextPoll(); if (visible && loaded && !$window.document.hidden) { session.refresh(); } };
                session.setInteraction = function (value, kind) {
                    interactions[kind || 'input'] = value === true; interaction = Object.keys(interactions).some(function (name) { return interactions[name]; });
                    if (!interaction) { if (deferredRemote) { var row = deferredRemote; deferredRemote = null; reconcile(row); } schedule(); }
                };
                function focus() { if (visible && !$window.document.hidden) { session.refresh(); } }
                function leaving() { persist(); session.save(); }
                $window.addEventListener('focus', focus); $window.document.addEventListener('visibilitychange', focus); $window.addEventListener('pagehide', leaving);
                session.destroy = function () {
                    if (!entry.refs) { return; } entry.refs--; if (entry.refs) { return; }
                    visible = false; $timeout.cancel(poll); $timeout.cancel(timer); poll = timer = null;
                    $window.removeEventListener('focus', focus); $window.document.removeEventListener('visibilitychange', focus); $window.removeEventListener('pagehide', leaving);
                    persist(); session.save().finally(cleanup);
                };
                var draft = null;
                try {
                    var raw = $window.localStorage.getItem(key); draft = raw ? JSON.parse(raw) : null;
                    if (draft && (!draft.context || Object.keys(context).some(function (name) { return Number(draft.context[name]) !== context[name]; }) || !Number.isInteger(draft.revision) || draft.revision < 0)) { draft = null; }
                    if (draft) { draft.document = documentValue(draft.document); lastBackup = raw; session.document = copy(draft.document); session.revision = draft.revision; dirty = true; }
                } catch (error) { draft = null; fail(new Error('Chưa đọc được bản nháp ghi chú trên thiết bị.')); }
                session.ready = api.read(context.documentId).then(function (row) {
                    if (!entry.refs && entries[key] !== entry) { return session; }
                    if (!authenticated() || !matches(row)) { throw new Error('Ghi chú nhận được không khớp tài liệu.'); }
                    row.document = documentValue(row.document); loaded = true;
                    if (draft && !equal(draft.document, row.document)) { lastBackup = null; }
                    apply(row);
                    if (draft && !equal(draft.document, row.document)) {
                        session.document = copy(draft.document); session.revision = draft.revision; dirty = true; persist();
                        if (draft.revision !== row.revision) { conflict = row; session.status = 'conflict'; session.error = 'Bản nháp trên thiết bị khác bản mới của người soạn tài liệu; hãy đối chiếu.'; }
                        else { session.status = 'local'; schedule(); }
                    }
                    return session;
                }).catch(function (error) { if (!entry.refs && entries[key] !== entry) { return session; } if (draft) { session.document = copy(draft.document); session.revision = draft.revision; dirty = true; persist(); } fail(error); return session; });
                return session;
            }
            return {open: open, validDocument: documentValue, hasDraft: function (identity) { var key = 'tntt-document-notebook:v1:' + Number(identity.userId) + ':' + Number(identity.documentId); if (entries[key] && ['loading','saving','local','error','conflict'].indexOf(entries[key].session.status) >= 0) { return true; } try { return !!$window.localStorage.getItem(key); } catch (ignore) { return true; } }};
        }]);
}());
