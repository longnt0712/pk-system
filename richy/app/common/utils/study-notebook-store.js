(function () {
    'use strict';

    angular.module('Hrm.Common').factory('StudyNotebookStore', ['$window', '$timeout', '$q', '$cookies', 'QuestionService',
        function ($window, $timeout, $q, $cookies, api) {
            var entries = {}, listening = false, sequence = 0;
            var modes = ['READING', 'LISTENING', 'WRITING', 'COMPREHENSIVE'];
            var patterns = ['blank', 'lined', 'vertical', 'grid', 'squares', 'sketch'];

            function revision() {
                return Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 12);
            }
            function positive(value) { return /^\d+$/.test(String(value)) && Number(value) > 0; }
            function validDocument(value, local) {
                if (!value || typeof value.text !== 'string' || (!local && value.text.length > 500000) ||
                        ['portrait', 'landscape'].indexOf(value.orientation) < 0 || patterns.indexOf(value.pattern) < 0 ||
                        !Array.isArray(value.strokes) || (!local && value.strokes.length > 10000)) { throw new Error('Invalid notebook document'); }
                var points = 0;
                value.strokes.forEach(function (stroke) {
                    if (!stroke || typeof stroke.id !== 'string' || ['pen', 'highlighter'].indexOf(stroke.tool) < 0 ||
                            !/^#[0-9a-f]{6}$/i.test(stroke.color) || !(stroke.width > 0 && stroke.width <= 100) ||
                            !Array.isArray(stroke.points) || !stroke.points.length) { throw new Error('Invalid notebook stroke'); }
                    points += stroke.points.length;
                    stroke.points.forEach(function (point) {
                        if (!Array.isArray(point) || point.length < 2 || point.length > 3 || point.some(function (n) {
                            return typeof n !== 'number' || !isFinite(n) || n < 0 || n > 100000;
                        }) || (point.length === 3 && point[2] > 1)) { throw new Error('Invalid notebook point'); }
                    });
                });
                if (!local && points > 200000) { throw new Error('NOTEBOOK_LIMIT'); }
                return angular.copy(value);
            }
            function sameDocument(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
            function each(callback) { Object.keys(entries).forEach(function (key) {
                if (entries[key].refs > 0 || entries[key].unbacked()) { callback(entries[key]); }
            }); }
            function onPageHide() { each(function (entry) { entry.persist(); entry.session.save(); }); }
            function recover(entry) { entry.session.refresh().then(function () { entry.session.save(); }); }
            function onVisible() { if (!$window.document.hidden) { each(recover); } }
            function onOnline() { each(recover); }
            function beforeUnload(event) {
                if (Object.keys(entries).some(function (key) { return entries[key].unbacked(); })) {
                    event.preventDefault(); event.returnValue = ''; return '';
                }
            }
            function onStorage(event) {
                each(function (entry) { if (event.key === entry.session.localKey) { entry.session.refresh(); } });
            }
            function listen() {
                if (listening) { return; } listening = true;
                $window.addEventListener('pagehide', onPageHide);
                $window.addEventListener('online', onOnline);
                $window.addEventListener('storage', onStorage);
                $window.addEventListener('beforeunload', beforeUnload);
                $window.document.addEventListener('visibilitychange', onVisible);
            }
            function unlisten() {
                if (Object.keys(entries).some(function (key) { return entries[key].refs > 0 || entries[key].unbacked(); }) || !listening) { return; }
                listening = false;
                $window.removeEventListener('pagehide', onPageHide);
                $window.removeEventListener('online', onOnline);
                $window.removeEventListener('storage', onStorage);
                $window.removeEventListener('beforeunload', beforeUnload);
                $window.document.removeEventListener('visibilitychange', onVisible);
            }

            function open(identity) {
                var userId = Number(identity && identity.userId), testId = Number(identity && identity.testId);
                var mode = String(identity && identity.testMode || '').toUpperCase();
                if (!positive(userId) || !positive(testId) || modes.indexOf(mode) < 0) { throw new Error('Invalid notebook identity'); }
                function authenticated() {
                    try { return Number(JSON.parse($cookies.get('education.user') || '{}').id) === userId; }
                    catch (error) { return false; }
                }
                if (!authenticated()) { throw new Error('Notebook user does not match the signed-in user'); }
                var key = 'study-notebook:v1:' + userId + ':' + mode + ':' + testId;
                if (entries[key]) { entries[key].refs++; listen(); return entries[key].session; }
                var session = {
                    key: key, localKey: 'study-notebook-local:v1:' + userId + ':' + mode + ':' + testId,
                    document: {text: '', orientation: 'portrait', pattern: 'lined', strokes: []},
                    status: 'loading', error: '', ready: null
                };
                var entry = {session: session, refs: 1, persist: persist, unbacked: function () { return dirty && !localSaved; }}; entries[key] = entry;
                var dirty = false, loaded = false, localSaved = false, baseRevision = null, currentRevision = null;
                var lastLocalRevision = null, sentRevisions = [], conflict = null, timer = null, operation = null, loading = null;

                function owns(value) {
                    return value && value.schemaVersion === 1 && Number(value.userId) === userId && Number(value.testId) === testId && value.testMode === mode;
                }
                function parseLocal(raw) {
                    if (!raw) { return null; }
                    var value = JSON.parse(raw);
                    if (!owns(value) || typeof value.revision !== 'string') { throw new Error('Invalid local notebook'); }
                    validDocument(value.document, true); return value;
                }
                function readLocal() { return parseLocal($window.localStorage.getItem(session.localKey)); }
                function envelope() {
                    return {schemaVersion: 1, userId: userId, testId: testId, testMode: mode,
                        document: angular.copy(session.document), revision: currentRevision, baseRevision: baseRevision,
                        sentRevisions: sentRevisions.slice(-8), dirty: dirty, savedAt: new Date().toISOString()};
                }
                function setConflict(remote, message) {
                    conflict = {remote: remote}; session.status = 'conflict';
                    session.error = message || 'Có một bản ghi chú khác mới hơn. Bản đang viết vẫn được giữ; hãy chọn bản muốn dùng.';
                }
                function persist(force) {
                    if (!currentRevision) { return false; }
                    try {
                        var raw = $window.localStorage.getItem(session.localKey), previous = null;
                        try { previous = parseLocal(raw); }
                        catch (invalidLocal) {
                            // Keep the unreadable bytes recoverable instead of permanently
                            // blocking backups for all subsequent, valid edits.
                            $window.localStorage.setItem(session.localKey + ':recovery', raw);
                        }
                        if (!force && previous && previous.dirty && previous.revision !== lastLocalRevision && previous.revision !== currentRevision) {
                            setConflict(null, 'Ghi chú đã thay đổi ở tab khác. Bản đang viết vẫn được giữ; hãy đóng tab kia rồi đồng bộ lại.');
                            localSaved = false; return false;
                        }
                        if (force && previous && previous.dirty && previous.revision !== currentRevision) {
                            $window.localStorage.setItem(session.localKey + ':backup', raw);
                        }
                        $window.localStorage.setItem(session.localKey, JSON.stringify(envelope()));
                        lastLocalRevision = currentRevision; localSaved = true; return true;
                    } catch (error) { localSaved = false; return false; }
                }
                function apply(document, local) { angular.copy(validDocument(document, local), session.document); }
                function acknowledge(remote) {
                    if (!sameDocument(session.document, remote.document)) { apply(remote.document); }
                    currentRevision = remote.revision; baseRevision = remote.revision;
                    dirty = false; conflict = null; session.status = 'saved'; session.error = ''; persist();
                }
                function remoteRecord() {
                    if (!authenticated()) { return $q.reject(new Error('Authentication changed')); }
                    return api.getLearningDrafts().then(function (items) {
                        if (!authenticated() || !Array.isArray(items)) { throw new Error('Invalid notebook response'); }
                        var record = null;
                        items.forEach(function (item) { if (item && item.draftKey === key) { record = item; } });
                        if (!record) { return null; }
                        if (record.draftType !== 'STUDY_NOTEBOOK' || !positive(record.id)) { throw new Error('Invalid notebook record'); }
                        var value = JSON.parse(record.payload);
                        if (!owns(value) || typeof value.revision !== 'string' || !value.revision) { throw new Error('Invalid notebook owner'); }
                        validDocument(value.document); return value;
                    });
                }
                function reconcile(remote) {
                    if (dirty) {
                        if (remote && remote.revision === currentRevision && sameDocument(remote.document, session.document)) {
                            acknowledge(remote);
                        } else if ((remote ? remote.revision : null) !== baseRevision) {
                            if (remote && sentRevisions.indexOf(remote.revision) !== -1) { baseRevision = remote.revision; persist(); }
                            else { setConflict(remote); }
                        }
                    } else if (remote) { acknowledge(remote); }
                    else if (currentRevision) {
                        // A missing cloud record must never erase a surviving local notebook.
                        dirty = true; baseRevision = null; persist(); session.status = 'local';
                    } else { session.status = 'ready'; }
                }
                function failed(message) {
                    if (conflict) { return; }
                    session.status = localSaved ? 'local' : 'error'; session.error = message;
                }
                function schedule() {
                    $timeout.cancel(timer);
                    if (!entry.refs || !dirty || conflict) { return; }
                    timer = $timeout(function () { timer = null; session.save(); }, 900, false);
                }
                session.changed = function () {
                    currentRevision = revision(); dirty = true;
                    persist();
                    if (!conflict) {
                        session.status = localSaved ? 'local' : 'error';
                        session.error = localSaved ? '' : 'Chưa lưu được bản trên máy. Hãy giữ trang và bấm Đồng bộ.';
                    }
                    schedule();
                };
                session.refresh = function () {
                    if (loading) { return loading; }
                    if (operation) { return operation.then(function () { return session.refresh(); }); }
                    // New sessions start in loading. Background retries must not
                    // disable an existing text composition or pen gesture.
                    loading = remoteRecord().then(function (remote) {
                        loaded = true; reconcile(remote);
                        if (!conflict) { session.error = ''; schedule(); }
                        return session;
                    }).catch(function () {
                        loaded = false; failed('Chưa tải được bản đồng bộ. Bạn có thể ghi tiếp; hãy giữ bản trên máy và thử đồng bộ lại.');
                        return session;
                    }).finally(function () { loading = null; });
                    return loading;
                };
                function pump() {
                    if (!dirty || conflict) { return $q.when(session); }
                    if (operation) { return operation; }
                    if (!loaded) {
                        return session.refresh().then(function () { return loaded && !conflict ? pump() : session; });
                    }
                    session.status = 'saving'; session.error = '';
                    var snapshot = null, successful = false;
                    operation = remoteRecord().then(function (remote) {
                        reconcile(remote);
                        if (!dirty || conflict) { return null; }
                        if (session.document.text.length > 500000 || session.document.strokes.length > 10000) { throw new Error('NOTEBOOK_LIMIT'); }
                        validDocument(session.document);
                        snapshot = {schemaVersion: 1, userId: userId, testId: testId, testMode: mode,
                            revision: currentRevision, parentRevision: baseRevision, document: angular.copy(session.document), hiddenFromDashboard: true};
                        var payload = JSON.stringify(snapshot);
                        if (payload.length > 8000000) { throw new Error('NOTEBOOK_LIMIT'); }
                        sentRevisions.push(snapshot.revision); persist();
                        if (conflict || !authenticated()) { throw new Error('Notebook changed before upload'); }
                        return api.saveLearningDraft({draftKey: key, draftType: 'STUDY_NOTEBOOK', title: 'Ghi chú Study · ' + mode + ' · ' + testId, payload: payload})
                            .then(function (saved) {
                                if (!authenticated() || !saved || !positive(saved.id) || saved.draftKey !== key || saved.draftType !== 'STUDY_NOTEBOOK' || saved.payload !== payload) {
                                    throw new Error('Notebook save was not acknowledged');
                                }
                                baseRevision = snapshot.revision;
                                if (currentRevision === snapshot.revision) { dirty = false; }
                                successful = true; persist();
                                if (!conflict) { session.status = dirty ? 'saving' : 'saved'; session.error = ''; }
                                return session;
                            });
                    }).catch(function (error) {
                        failed(error && error.message === 'NOTEBOOK_LIMIT'
                            ? 'Ghi chú đã vượt dung lượng đồng bộ. Nội dung vẫn được giữ trên trang; hãy giảm bớt nội dung hoặc nét vẽ rồi đồng bộ lại.'
                            : 'Chưa xác nhận đồng bộ ghi chú. Bản đang viết được giữ lại; bấm Đồng bộ để thử lại.');
                        return session;
                    }).finally(function () {
                        operation = null;
                        if (successful && dirty && !conflict) { schedule(); }
                    });
                    return operation;
                }
                session.save = function () {
                    $timeout.cancel(timer); timer = null;
                    return pump().then(function () {
                        // A newer edit can arrive while an older snapshot is in flight.
                        // Explicit saves, including route teardown, drain that last edit
                        // even when no mounted notebook remains to run a debounce timer.
                        if (dirty && !conflict && loaded && session.status === 'saving') { return session.save(); }
                        if (!entry.refs && !entry.unbacked() && entries[key] === entry) { delete entries[key]; unlisten(); }
                        return session;
                    });
                };
                session.useRemote = function () {
                    if (!conflict || !conflict.remote) { return session.refresh(); }
                    try { $window.localStorage.setItem(session.localKey + ':backup', JSON.stringify(envelope())); }
                    catch (error) { session.error = 'Chưa giữ được bản dự phòng trên máy; chưa thay nội dung đang viết.'; return $q.when(session); }
                    acknowledge(conflict.remote); return $q.when(session);
                };
                session.keepLocal = function () {
                    if (!conflict) { return session.save(); }
                    return remoteRecord().then(function (remote) {
                        // The cloud copy may have disappeared, or a second tab may
                        // have caused the conflict before we knew its cloud version.
                        baseRevision = remote ? remote.revision : null;
                        conflict = null; currentRevision = revision(); dirty = true; persist(true);
                        return session.save();
                    }).catch(function () {
                        session.error = 'Chưa kiểm tra được bản đồng bộ. Nội dung đang viết vẫn được giữ; hãy thử lại.';
                        return session;
                    });
                };
                session.destroy = function () {
                    if (!entry.refs) { return; } entry.refs--; if (entry.refs) { return; }
                    $timeout.cancel(timer); timer = null; persist(); unlisten();
                    session.save().finally(function () {
                        // If both storage and the network failed, this is the only
                        // surviving copy. Keep it for route re-entry and warn on reload.
                        if (!entry.refs && !entry.unbacked() && entries[key] === entry) { delete entries[key]; }
                        unlisten();
                    });
                };

                try {
                    var local = readLocal();
                    if (local) {
                        apply(local.document, true); currentRevision = local.revision; lastLocalRevision = local.revision;
                        baseRevision = local.baseRevision || null; dirty = local.dirty === true; localSaved = true;
                        sentRevisions = Array.isArray(local.sentRevisions) ? local.sentRevisions.slice(-8) : [];
                    }
                } catch (error) { session.error = 'Chưa đọc được bản ghi chú trên máy.'; }
                listen(); session.ready = session.refresh();
                return session;
            }
            return {open: open};
        }]);
}());
