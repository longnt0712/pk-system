(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentNotebookStore', ['$window', '$timeout', '$q', '$cookies', 'TnttDocumentApi', '$injector',
        function ($window, $timeout, $q, $cookies, api, $injector) {
            var entries = {}, serial = 0;
            var merger = $injector && $injector.has('TnttDocumentMerge') ? $injector.get('TnttDocumentMerge') : null;
            var liveService = $injector && $injector.has('TnttDocumentLive') ? $injector.get('TnttDocumentLive') : null;
            function copy(value) { return JSON.parse(JSON.stringify(value)); }
            function positive(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
            function validLink(value) {
                return typeof value === 'string' && value.length <= 2048 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[a-f0-9:]+\])(?::[0-9]{1,5})?(?:[/?#][^\s<>"'\\\u0000-\u001f\u007f]*)?$/i.test(value);
            }
            function blank() { return {text: '', orientation: 'portrait', pattern: 'lined', strokes: [], pageCount: 3}; }
            function utf8Length(text) {
                var size = 0;
                for (var i = 0; i < text.length; i++) {
                    var code = text.charCodeAt(i);
                    if (code < 128) { size++; } else if (code < 2048) { size += 2; }
                    else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { size += 4; i++; }
                    else { size += 3; }
                }
                return size;
            }
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
                if (points > 200000 || utf8Length(JSON.stringify(value)) > 8 * 1024 * 1024) { throw new Error('Ghi chú vượt dung lượng đồng bộ 8 MB. Bản đang viết vẫn được giữ.'); }
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
                    var delta = value.textDelta, text = '', images = 0;
                    if (!delta || !Array.isArray(delta.ops) || !delta.ops.length || delta.ops.length > 10000) { throw new Error('Định dạng chữ tài liệu không hợp lệ.'); }
                    result.textDelta = {ops: delta.ops.map(function (op) {
                        if (!op || Object.keys(op).some(function (key) { return ['insert', 'attributes'].indexOf(key) < 0; })) { throw new Error('Định dạng chữ tài liệu không hợp lệ.'); }
                        var image = op.insert && typeof op.insert === 'object' && !Array.isArray(op.insert) && Object.keys(op.insert).length === 1 && op.insert.image;
                        var softbreak = op.insert && typeof op.insert === 'object' && !Array.isArray(op.insert) && Object.keys(op.insert).length === 1 && op.insert.softbreak === true;
                        if (image) {
                            if (typeof image !== 'string' || image.length > 2796226 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || (image.length - image.indexOf(',') - 1) % 4 !== 0 ||
                                !(image.indexOf('data:image/png;base64,iVBORw0KGgo') === 0 || image.indexOf('data:image/jpeg;base64,/9j/') === 0) || ++images > 40) { throw new Error('Định dạng ảnh không hợp lệ hoặc ảnh quá lớn (tối đa 40 ảnh, 2 MB mỗi ảnh).'); }
                        } else if (softbreak) { text += '\u2028'; } else {
                            if (typeof op.insert !== 'string' || !op.insert.length) { throw new Error('Định dạng chữ tài liệu không hợp lệ.'); }
                            text += op.insert;
                        }
                        var clean = {insert: image ? {image: image} : softbreak ? {softbreak: true} : op.insert}, attributes = {};
                        if (op.attributes !== undefined) {
                            if (!op.attributes || typeof op.attributes !== 'object' || Array.isArray(op.attributes) ||
                                Object.keys(op.attributes).some(function (key) {
                                    var v = op.attributes[key];
                                    if (key === 'bold' || key === 'italic' || key === 'underline') { return typeof v !== 'boolean'; }
                                    if (key === 'color') { return typeof v !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(v); }
                                    if (key === 'link') { return image || softbreak || !/[^\n]/.test(op.insert) || !validLink(v); }
                                    if (key === 'align') { return image || softbreak || !/^\n+$/.test(op.insert) || ['center', 'right', 'justify'].indexOf(v) < 0; }
                                    if (key === 'width') { return !image || typeof v !== 'string' || !/^[1-9][0-9]{0,3}$/.test(v) || Number(v) > 4096; }
                                    if (key === 'table') { return image || softbreak || !/^\n+$/.test(op.insert) || typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v); }
                                    if (key === 'table-colspan' || key === 'table-rowspan') { return !op.attributes.table || typeof v !== 'string' || !/^[1-9][0-9]?$/.test(v) || Number(v) > 50; }
                                    return true;
                                })) {
                                throw new Error('Định dạng chữ tài liệu không hợp lệ.');
                            }
                            ['bold', 'italic', 'underline', 'color', 'link', 'align', 'table', 'table-colspan', 'table-rowspan', 'width'].forEach(function (key) { if (op.attributes[key]) { attributes[key] = op.attributes[key]; } });
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
                var protocol = false, baseTrusted = false, uncertain = null, liveHint = 0, wantsRefresh = false, dirtySince = 0, remoteListeners = [], lastLiveState = '';
                entries[key] = entry;
                function authenticated() { try { return Number(JSON.parse($cookies.get('education.user') || '{}').id) === context.userId; } catch (ignore) { return false; } }
                function matches(row) { return row && Number(row.id) === context.documentId && Number.isInteger(row.revision) && row.revision >= 0; }
                function fail(error) { session.status = conflict ? 'conflict' : localSaved ? 'local' : 'error'; session.error = (error && error.data && error.data.message) || (error && error.message) || 'Chưa đồng bộ được ghi chú. Bản đang viết vẫn được giữ.'; }
                function packImages(value, local) {
                    value = copy(value);
                    var images = (local.textDelta ? local.textDelta.ops : []).filter(function (op) { return op.insert && op.insert.image; }).map(function (op) { return op.insert.image; });
                    if (value.textDelta) value.textDelta.ops.forEach(function (op) {
                        if (op.insert && op.insert.image) { var index = images.indexOf(op.insert.image); if (index >= 0) op.insert = {draftImage: index}; }
                    });
                    return value;
                }
                function unpackImages(value, local) {
                    value = copy(value);
                    var images = (local.textDelta ? local.textDelta.ops : []).filter(function (op) { return op.insert && op.insert.image; }).map(function (op) { return op.insert.image; });
                    if (value.textDelta) value.textDelta.ops.forEach(function (op) {
                        if (op.insert && op.insert.draftImage !== undefined) { var index = op.insert.draftImage; if (!Number.isInteger(index) || !images[index]) throw new Error('Không đọc được ảnh trong bản nháp.'); op.insert = {image: images[index]}; }
                    });
                    return documentValue(value);
                }
                function persist() {
                    try {
                        if (dirty || uncertain) {
                            var draft = {context: context, revision: session.revision, document: session.document, stamp: Date.now() + '-' + (++serial)};
                            if (protocol && baseTrusted) { draft.baseDocument = packImages(JSON.parse(baseline), session.document); }
                            if (uncertain) { draft.pending = {mutationId: uncertain.mutationId, revision: uncertain.revision, document: packImages(uncertain.document, session.document)}; }
                            lastBackup = JSON.stringify(draft); $window.localStorage.setItem(key, lastBackup);
                        }
                        else if (lastBackup && $window.localStorage.getItem(key) === lastBackup) { $window.localStorage.removeItem(key); lastBackup = null; }
                        localSaved = true;
                    } catch (error) { localSaved = false; }
                }
                function replaceDocument(value) {
                    if (!equal(session.document, value)) {
                        var rendered = remoteListeners.slice().map(function (listener) { return listener(session.document, value); });
                        session.document = value;
                        rendered.forEach(function (callback) { if (typeof callback === 'function') callback(); });
                    }
                }
                session.onRemote = function (listener) { remoteListeners.push(listener); return function () { remoteListeners = remoteListeners.filter(function (item) { return item !== listener; }); }; };
                function startLive() {
                    if (!session.live && loaded && protocol && liveService && visible && entry.refs && authenticated()) {
                        session.live = liveService.connect(context.documentId, function (revision) {
                            if (Number.isInteger(revision) && revision >= 0) {
                                liveHint = Math.max(liveHint, revision);
                                if (liveHint > session.revision || uncertain || session.error) { wantsRefresh = true; if (!$window.document.hidden) { session.refresh(); } }
                            }
                            var state = session.live && session.live.state;
                            if (state !== lastLiveState) { lastLiveState = state; nextPoll(); }
                        });
                    }
                }
                function acceptProtocol(row) { if (row.syncProtocol === 1 && merger) { protocol = true; startLive(); } }
                function apply(row) {
                    var value = documentValue(row.document);
                    acceptProtocol(row); replaceDocument(value);
                    session.revision = row.revision; baseline = JSON.stringify(value); baseTrusted = true; dirty = false; conflict = null;
                    dirtySince = 0;
                    session.status = row.revision ? 'saved' : 'ready'; session.error = ''; persist();
                }
                function receipt(row, id) {
                    return row.sync && Array.isArray(row.sync.recent) && row.sync.recent.find(function (item) { return item.id === id && Number.isInteger(item.revision) && item.revision > 0 && item.revision <= row.revision; });
                }
                function recoverPending(row) {
                    if (!uncertain) return true;
                    var accepted = receipt(row, uncertain.mutationId);
                    if (accepted) {
                        session.revision = accepted.revision; baseline = JSON.stringify(uncertain.document); baseTrusted = true; uncertain = null;
                        dirty = JSON.stringify(session.document) !== baseline; return true;
                    }
                    if (row.sync && Number.isInteger(row.sync.floor) && row.sync.floor <= uncertain.revision) {
                        if (row.revision === uncertain.revision) { return 'retry'; }
                        uncertain = null; return true;
                    }
                    return false;
                }
                function reconcile(row) {
                    row = Object.assign({}, row, {id: context.documentId, document: documentValue(row.document)});
                    if (interaction) { deferredRemote = row; return; }
                    if (row.revision < session.revision) { return; }
                    acceptProtocol(row);
                    var pending = protocol && recoverPending(row);
                    if (pending === 'retry') { session.error = ''; session.status = 'local'; persist(); schedule(); return; }
                    if (protocol && !pending) { conflict = row; session.status = 'conflict'; session.error = 'Chưa xác nhận được lần lưu trước. Bản trên máy được giữ để đối chiếu.'; persist(); return; }
                    if (!dirty || !protocol && equal(session.document, row.document)) { apply(row); }
                    else if (protocol && merger && row.revision !== session.revision) {
                        try {
                            var merged = documentValue(merger.merge(JSON.parse(baseline), session.document, row.document));
                            replaceDocument(merged); session.revision = row.revision; baseline = JSON.stringify(row.document); baseTrusted = true;
                            dirty = JSON.stringify(merged) !== baseline; conflict = null; session.error = ''; session.status = dirty ? 'local' : 'saved'; persist();
                        } catch (error) { conflict = row; session.status = 'conflict'; session.error = 'Chưa ghép được thay đổi. Bản đang viết được giữ để đối chiếu.'; persist(); }
                    }
                    else if (row.revision !== session.revision) { conflict = row; session.status = 'conflict'; session.error = 'Có ghi chú mới của người soạn tài liệu. Bản đang viết được giữ để đối chiếu.'; persist(); }
                }
                function schedule() {
                    $timeout.cancel(timer); timer = null;
                    if (entry.refs && (dirty || uncertain) && !conflict && !interaction) {
                        var live = session.live && session.live.state === 'online';
                        var large = baseline.length > 256000, pause = large ? 900 : 300, maximum = large ? 1500 : 800;
                        var delay = live ? Math.min(pause, Math.max(0, maximum - (Date.now() - dirtySince))) : 900;
                        timer = $timeout(function () { timer = null; session.save(); }, delay);
                    }
                }
                session.changed = function () {
                    dirty = JSON.stringify(session.document) !== baseline;
                    if (dirty && !dirtySince) dirtySince = Date.now();
                    persist();
                    if (!conflict) { session.status = dirty || uncertain ? localSaved ? 'local' : 'error' : session.revision ? 'saved' : 'ready'; session.error = localSaved ? '' : 'Chưa giữ được bản nháp trên thiết bị. Hãy giữ trang mở và thử đồng bộ lại.'; }
                    schedule();
                };
                session.refresh = function (force) {
                    if (reading) { return reading; }
                    if (operation || interaction || !entry.refs || !authenticated()) { return $q.when(session); }
                    wantsRefresh = false;
                    reading = api.read(context.documentId, loaded && !force && !uncertain ? session.revision : undefined).then(function (row) {
                        if (!entry.refs || operation || !authenticated()) { return session; }
                        if (!matches(row)) { throw new Error('Ghi chú nhận được không khớp tài liệu.'); }
                        acceptProtocol(row);
                        if (row.changed === false) {
                            if (!loaded || row.revision !== session.revision) { throw new Error('Phiên bản đồng bộ ghi chú không khớp.'); }
                            if (!conflict) { session.error = ''; session.status = dirty ? 'local' : session.revision ? 'saved' : 'ready'; schedule(); }
                            return session;
                        }
                        loaded = true; reconcile(row); schedule(); return session;
                    }).catch(function (error) { if (entry.refs) { fail(error); } wantsRefresh = false; return session; }).finally(function () {
                        reading = null;
                        if (wantsRefresh && liveHint > session.revision) { wantsRefresh = false; session.refresh(); }
                    });
                    return reading;
                };
                function cleanup() {
                    if (!entry.refs && (!dirty || localSaved) && entries[key] === entry) { delete entries[key]; }
                }
                session.save = function () {
                    $timeout.cancel(timer); timer = null;
                    if (operation) { return operation; }
                    if ((!dirty && !uncertain) || conflict || interaction || !authenticated()) { return $q.when(session); }
                    if (!loaded) { return session.refresh(true).then(function () { return loaded && !conflict ? session.save() : session; }); }
                    var payload;
                    try {
                        payload = uncertain || {revision: session.revision, document: documentValue(session.document)};
                        if (!uncertain && payload.document.textDelta) { session.document.textDelta = copy(payload.document.textDelta); }
                        if (protocol && !payload.mutationId) { payload.mutationId = liveService ? liveService.uuid() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (key) { var n = Math.random() * 16 | 0; return (key === 'x' ? n : n & 3 | 8).toString(16); }); }
                        if (protocol) { uncertain = copy(payload); }
                    }
                    catch (error) { persist(); fail(error); return $q.when(session); }
                    session.status = 'saving'; session.error = ''; dirtySince = Date.now(); persist();
                    operation = api.save(context.documentId, payload).then(function (row) {
                        if (!authenticated() || !matches(row) || row.revision < 1 || row.revision < payload.revision) { throw new Error('Chưa nhận đúng xác nhận lưu ghi chú. Bản đang viết vẫn được giữ.'); }
                        var accepted = protocol && receipt(row, payload.mutationId);
                        if (protocol && !accepted || !protocol && !equal(documentValue(row.document), payload.document)) { throw new Error('Chưa nhận đúng xác nhận lưu ghi chú. Bản đang viết vẫn được giữ.'); }
                        if (accepted && accepted.revision === row.revision && !equal(documentValue(row.document), payload.document)) { throw new Error('Nội dung xác nhận lưu không khớp. Bản đang viết được giữ.'); }
                        session.revision = accepted ? accepted.revision : row.revision; baseline = JSON.stringify(payload.document); baseTrusted = true; uncertain = null;
                        dirty = JSON.stringify(session.document) !== baseline; conflict = null; session.error = ''; session.status = dirty ? 'local' : 'saved';
                        if (protocol) { reconcile(row); }
                        persist(); return session;
                    }).catch(function (error) {
                        if (error.status === 409 && authenticated()) {
                            uncertain = null;
                            return api.read(context.documentId).then(function (row) {
                                if (matches(row)) { reconcile(row); } if (!protocol && !conflict && dirty) { fail(error); } return session;
                            }, function () { fail(error); return session; });
                        }
                        persist(); fail(error); return session;
                    }).finally(function () {
                        operation = null;
                        if ((dirty || uncertain) && !conflict && session.status !== 'error' && !session.error) { if (entry.refs) { schedule(); } else { session.save(); } }
                        if (wantsRefresh && liveHint > session.revision && visible && !interaction) { wantsRefresh = false; session.refresh(); }
                        cleanup();
                    });
                    return operation;
                };
                session.keepLocal = function () {
                    if (!conflict) { return session.save(); }
                    return api.read(context.documentId).then(function (row) {
                        if (!authenticated() || !matches(row)) { throw new Error('Chưa xác nhận được phiên bản ghi chú mới.'); }
                        session.revision = row.revision; baseline = JSON.stringify(documentValue(row.document)); baseTrusted = true; conflict = null; uncertain = null;
                        dirty = JSON.stringify(session.document) !== baseline; session.error = ''; persist(); return session.save();
                    }).catch(function (error) { fail(error); return session; });
                };
                session.useRemote = function () {
                    if (!conflict) { return session.refresh(true); }
                    try { $window.localStorage.setItem(key + ':previous:' + Date.now(), JSON.stringify({context: context, revision: session.revision, document: session.document})); }
                    catch (error) { fail(new Error('Chưa giữ được bản dự phòng; chưa thay nội dung đang viết.')); return $q.when(session); }
                    uncertain = null; apply(conflict); return $q.when(session);
                };
                function nextPoll() {
                    $timeout.cancel(poll); poll = null;
                    if (visible && entry.refs) { poll = $timeout(function () { poll = null; if (!$window.document.hidden) { session.refresh(); } nextPoll(); }, session.live && session.live.state === 'online' ? 15000 : 3000); }
                }
                session.setVisible = function (value) {
                    visible = value === true;
                    if (!visible && session.live) { session.live.close(); session.live = null; lastLiveState = ''; }
                    else if (visible) { startLive(); }
                    nextPoll(); if (visible && loaded && !$window.document.hidden) { session.refresh(); }
                };
                session.cursor = function (value) { if (session.live) session.live.cursor(value); };
                session.setInteraction = function (value, kind) {
                    interactions[kind || 'input'] = value === true; interaction = Object.keys(interactions).some(function (name) { return interactions[name]; });
                    if (!interaction) { if (deferredRemote) { var row = deferredRemote; deferredRemote = null; reconcile(row); } schedule(); if (wantsRefresh && liveHint > session.revision) session.refresh(); }
                };
                function focus() { if (visible && !$window.document.hidden) { session.refresh(); } }
                function leaving() { persist(); session.save(); }
                $window.addEventListener('focus', focus); $window.document.addEventListener('visibilitychange', focus); $window.addEventListener('pagehide', leaving);
                session.destroy = function () {
                    if (!entry.refs) { return; } entry.refs--; if (entry.refs) { return; }
                    visible = false; $timeout.cancel(poll); $timeout.cancel(timer); poll = timer = null;
                    if (session.live) { session.live.close(); session.live = null; }
                    $window.removeEventListener('focus', focus); $window.document.removeEventListener('visibilitychange', focus); $window.removeEventListener('pagehide', leaving);
                    persist(); session.save().finally(cleanup);
                };
                var draft = null;
                try {
                    var raw = $window.localStorage.getItem(key); draft = raw ? JSON.parse(raw) : null;
                    if (draft && (!draft.context || Object.keys(context).some(function (name) { return Number(draft.context[name]) !== context[name]; }) || !Number.isInteger(draft.revision) || draft.revision < 0)) { draft = null; }
                    if (draft) {
                        draft.document = documentValue(draft.document);
                        if (draft.baseDocument) { draft.baseDocument = unpackImages(draft.baseDocument, draft.document); baseline = JSON.stringify(draft.baseDocument); baseTrusted = true; protocol = true; }
                        if (draft.pending) {
                            if (!/^[a-f0-9-]{36}$/.test(draft.pending.mutationId) || !Number.isInteger(draft.pending.revision) || draft.pending.revision < 0) throw new Error('Mã bản nháp không hợp lệ.');
                            draft.pending.document = unpackImages(draft.pending.document, draft.document);
                            uncertain = draft.pending;
                        }
                        lastBackup = raw; session.document = copy(draft.document); session.revision = draft.revision; dirty = true;
                    }
                } catch (error) { draft = null; fail(new Error('Chưa đọc được bản nháp ghi chú trên thiết bị.')); }
                session.ready = api.read(context.documentId).then(function (row) {
                    if (!entry.refs && entries[key] !== entry) { return session; }
                    if (!authenticated() || !matches(row)) { throw new Error('Ghi chú nhận được không khớp tài liệu.'); }
                    row.document = documentValue(row.document); loaded = true; acceptProtocol(row);
                    if (protocol && draft && draft.baseDocument && (!equal(draft.document, row.document) || draft.pending)) {
                        baseline = JSON.stringify(draft.baseDocument); baseTrusted = true; uncertain = draft.pending || null; dirtySince = Date.now();
                        reconcile(row); persist(); schedule(); return session;
                    }
                    if (draft && !equal(draft.document, row.document)) { lastBackup = null; }
                    apply(row);
                    if (draft && !equal(draft.document, row.document)) {
                        session.document = copy(draft.document); session.revision = draft.revision; dirty = true;
                        if (draft.revision !== row.revision) { baseTrusted = false; conflict = row; session.status = 'conflict'; session.error = 'Bản nháp trên thiết bị khác bản mới của người soạn tài liệu; hãy đối chiếu.'; }
                        else { session.status = 'local'; schedule(); }
                        persist();
                    }
                    return session;
                }).catch(function (error) { if (!entry.refs && entries[key] !== entry) { return session; } if (draft) { session.document = copy(draft.document); session.revision = draft.revision; dirty = true; persist(); } fail(error); return session; });
                return session;
            }
            return {open: open, validDocument: documentValue, hasDraft: function (identity) { var key = 'tntt-document-notebook:v1:' + Number(identity.userId) + ':' + Number(identity.documentId); if (entries[key] && ['loading','saving','local','error','conflict'].indexOf(entries[key].session.status) >= 0) { return true; } try { return !!$window.localStorage.getItem(key); } catch (ignore) { return true; } }};
        }]);
}());
