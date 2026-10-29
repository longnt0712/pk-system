(function () {
    'use strict';
    angular.module('Hrm.Question').factory('SpeakingRecorder', ['$window', '$q', '$rootScope', '$cookies', 'SpeakingService',
        function ($window, $q, $rootScope, $cookies, api) {
            var jobs = {}, uploads = {}, database, capture = null, stopWait = null, sequence = $q.when(), generation = 0;
            var state = {active: false, starting: false, pending: [], message: '', error: '', storageError: false};
            function notify() { $rootScope.$evalAsync(); }
            function currentUserId() { try { return Number(JSON.parse($cookies.get('education.user') || '{}').id) || 0; } catch (ignore) { return 0; } }
            function key() {
                if ($window.crypto && $window.crypto.getRandomValues) { var values = new Uint32Array(4); $window.crypto.getRandomValues(values); return Array.prototype.map.call(values, function (v) { return ('00000000' + v.toString(16)).slice(-8); }).join(''); }
                return 'rec-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
            }
            function openDb() {
                if (database) { return database; }
                var deferred = $q.defer(); database = deferred.promise;
                if (!$window.indexedDB) { deferred.reject(new Error('IndexedDB unavailable')); return database; }
                var request;
                try { request = $window.indexedDB.open('ieltsroom-speaking-v1', 1); }
                catch (error) { deferred.reject(error); return database; }
                request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('jobs')) { request.result.createObjectStore('jobs', {keyPath: 'key'}); } };
                request.onsuccess = function () { deferred.resolve(request.result); };
                request.onerror = function () { deferred.reject(request.error || new Error('Cannot open recording backup')); };
                return database;
            }
            function dbAction(mode, action) {
                return openDb().then(function (db) {
                    var deferred = $q.defer(), transaction, result;
                    try { transaction = db.transaction('jobs', mode); var request = action(transaction.objectStore('jobs')); request.onsuccess = function () { result = request.result; }; }
                    catch (error) { deferred.reject(error); return deferred.promise; }
                    transaction.oncomplete = function () { deferred.resolve(result); };
                    transaction.onerror = transaction.onabort = function () { deferred.reject(transaction.error || new Error('Cannot save recording backup')); };
                    return deferred.promise;
                });
            }
            function snapshot(job) {
                return {key: job.key, userId: job.userId, practiceId: job.practiceId, questionIndex: job.questionIndex,
                    uploadKey: job.uploadKey, contentType: job.contentType, recordingId: job.recordingId || null,
                    parts: job.parts.slice(), uploaded: job.uploaded, stopped: job.stopped, bytes: job.bytes, updatedAt: Date.now()};
            }
            function pendingState() {
                var user = currentUserId(); state.pending = Object.keys(jobs).map(function (id) { return jobs[id]; }).filter(function (job) { return job.userId === user; }); notify();
            }
            function persist(job) {
                return dbAction('readwrite', function (store) { return store.put(snapshot(job)); }).then(function () { job.durable = true; return true; }, function () {
                    job.durable = false; state.storageError = true; state.error = 'Chưa sao lưu được trên thiết bị. Hãy giữ trang mở để tải bản ghi lên server.'; notify(); return false;
                });
            }
            function forget(job) {
                delete jobs[job.key]; pendingState();
                return dbAction('readwrite', function (store) { return store.delete(job.key); }).catch(angular.noop);
            }
            function sameUser(job) { if (currentUserId() !== job.userId) { throw new Error('Tài khoản đã thay đổi; bản ghi của tài khoản cũ vẫn được giữ riêng.'); } }
            function bytes(blob) {
                if (blob.arrayBuffer) { return $q.when(blob.arrayBuffer()); }
                var deferred = $q.defer(), reader = new $window.FileReader(); reader.onload = function () { deferred.resolve(reader.result); }; reader.onerror = function () { deferred.reject(reader.error); }; reader.readAsArrayBuffer(blob); return deferred.promise;
            }
            function flush(job) {
                if (uploads[job.key]) { return uploads[job.key]; }
                if (!job.parts.length) { return $q.when(false); }
                var failed = false, work = $q.when().then(function () {
                    sameUser(job);
                    if (job.recordingId) { return; }
                    return api.initRecording(job.practiceId, {uploadKey: job.uploadKey, contentType: job.contentType, questionIndex: job.questionIndex}).then(function (result) {
                        sameUser(job); if (!result || !(Number(result.id) > 0) || result.uploadKey !== job.uploadKey || Number(result.questionIndex) !== Number(job.questionIndex)) { throw new Error('Chưa xác nhận được mã bản ghi.'); } job.recordingId = result.id; return persist(job);
                    });
                });
                function next() {
                    sameUser(job);
                    if (job.uploaded < job.parts.length) {
                        var index = job.uploaded, blob = job.parts[index]; if (!blob) { throw new Error('Thiếu bản sao của một đoạn ghi âm; cần khôi phục trước khi tiếp tục.'); }
                        return bytes(blob).then(function (buffer) { sameUser(job); return api.chunk(job.recordingId, index, buffer); }).then(function (ack) {
                            sameUser(job); if (!ack || ack.saved !== true || Number(ack.index) !== index) { throw new Error('Server chưa xác nhận đoạn ghi âm.'); }
                            job.parts[index] = null; job.uploaded = index + 1; return persist(job);
                        }).then(next);
                    }
                    if (!job.stopped) { return false; }
                    return api.finishRecording(job.recordingId, job.parts.length).then(function (ack) {
                        sameUser(job); if (!ack || ack.complete !== true || Number(ack.id) !== Number(job.recordingId)) { throw new Error('Server chưa xác nhận đã lưu đủ ghi âm.'); }
                        state.message = 'Đã lưu bản ghi âm lên server.'; state.error = ''; return forget(job).then(function () { return true; });
                    });
                }
                work = work.then(next).catch(function (error) {
                    failed = true;
                    job.error = (error.data && error.data.message) || error.message || 'Chưa đồng bộ được ghi âm. Bạn có thể thử lại.';
                    state.error = job.error; state.message = job.durable ? 'Bản ghi còn trên thiết bị, chưa xác nhận lưu đủ trên server.' : 'Bản ghi còn trong trang này; hãy giữ trang mở và thử tải lại.'; pendingState(); return false;
                }).finally(function () { delete uploads[job.key]; pendingState(); if (!failed && jobs[job.key] && (job.stopped || job.uploaded < job.parts.length)) { $q.when().then(function () { flush(job); }); } });
                uploads[job.key] = work; return work;
            }
            function stopTracks(stream) { if (stream && stream.getTracks) { stream.getTracks().forEach(function (track) { track.stop(); }); } }
            function stop() {
                generation++;
                if (state.starting && !capture) { state.starting = false; }
                if (!capture) { return $q.when(); }
                if (stopWait) { return stopWait.promise; }
                stopWait = $q.defer(); var result = stopWait.promise;
                try { if (capture.recorder.state !== 'inactive') { capture.recorder.stop(); } else { capture.finish(); } }
                catch (error) { state.error = 'Bản ghi bị gián đoạn. Phần đã sao lưu vẫn được giữ.'; capture.finish(); }
                return result;
            }
            function supported() { return !!($window.MediaRecorder && $window.navigator && $window.navigator.mediaDevices && $window.navigator.mediaDevices.getUserMedia); }
            function start(userId, practiceId, questionIndex) {
                if (capture || state.starting) { return $q.reject(new Error('Đang có một bản ghi âm.')); }
                if (!supported()) { state.error = 'Trình duyệt chưa hỗ trợ ghi âm. Bạn vẫn có thể luyện câu hỏi.'; return $q.reject(new Error(state.error)); }
                if (Number(userId) !== currentUserId()) { return $q.reject(new Error('Tài khoản đã thay đổi.')); }
                state.starting = true; state.error = ''; state.message = 'Đang xin quyền microphone…'; notify();
                var startedGeneration = ++generation;
                // Call directly from the student's click, before any network wait.
                var permission;
                try { permission = $window.navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
                catch (error) { permission = $q.reject(error); }
                return $q.when(permission).then(function (stream) {
                    if (Number(userId) !== currentUserId() || startedGeneration !== generation) { stopTracks(stream); throw new Error('Đã hủy mở microphone.'); }
                    var types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'], type;
                    for (var index = 0; index < types.length; index++) { if ($window.MediaRecorder.isTypeSupported && $window.MediaRecorder.isTypeSupported(types[index])) { type = types[index]; break; } }
                    var recorder;
                    try { recorder = new $window.MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 64000} : {}); }
                    catch (error) { stopTracks(stream); throw error; }
                    var actualType = String(recorder.mimeType || type || '').split(';')[0];
                    if (['audio/webm', 'audio/mp4', 'audio/ogg'].indexOf(actualType) < 0) { stopTracks(stream); throw new Error('Trình duyệt chưa hỗ trợ định dạng ghi âm phù hợp.'); }
                    var uploadKey = key(), job = {key: userId + ':' + uploadKey, userId: Number(userId), practiceId: practiceId, questionIndex: questionIndex,
                        uploadKey: uploadKey, contentType: actualType, parts: [], uploaded: 0, stopped: false, bytes: 0, durable: false};
                    jobs[job.key] = job; sequence = $q.when(); var finished = false;
                    var active = {recorder: recorder, stream: stream, job: job}; capture = active;
                    function finish() {
                        if (finished) { return; } finished = true; stopTracks(stream); state.active = false; state.starting = false;
                        sequence = sequence.then(function () { job.stopped = true; return persist(job); }).then(function () {
                            if (job.parts.length) { flush(job); } else { forget(job); }
                            if (capture === active) { capture = null; } if (stopWait) { stopWait.resolve(); stopWait = null; } pendingState();
                        });
                    }
                    active.finish = finish;
                    recorder.ondataavailable = function (event) {
                        if (!event.data || !event.data.size) { return; }
                        var blob = event.data;
                        sequence = sequence.then(function () {
                            if (job.bytes + blob.size > 64 * 1024 * 1024) { state.error = 'Bản ghi đạt giới hạn 64 MB; phần đã ghi được giữ lại.'; stop(); return; }
                            for (var offset = 0; offset < blob.size; offset += 512 * 1024) { job.parts.push(blob.slice(offset, offset + 512 * 1024, job.contentType)); }
                            job.bytes += blob.size; return persist(job);
                        }).then(function () { pendingState(); flush(job); });
                    };
                    recorder.onstop = finish;
                    recorder.onerror = function () { state.error = 'Ghi âm bị gián đoạn. Phần đã lưu vẫn được giữ để đồng bộ lại.'; stop(); notify(); };
                    return persist(job).then(function () {
                        if (finished || startedGeneration !== generation || Number(userId) !== currentUserId()) { finish(); throw new Error('Đã hủy mở microphone.'); }
                        try { recorder.start(5000); } catch (error) { finish(); throw error; }
                        state.starting = false; state.active = true; state.message = 'Đang ghi âm. Bản thu được sao lưu từng đoạn.'; pendingState();
                    });
                }).catch(function (error) {
                    if (startedGeneration === generation) { state.starting = false; state.active = false; state.error = error.name === 'NotAllowedError' ? 'Bạn chưa cho phép microphone. Có thể luyện câu hỏi hoặc cấp quyền rồi thử lại.' : error.message || 'Chưa mở được microphone.'; notify(); } return $q.reject(error);
                });
            }
            function loadPending() {
                var userId = currentUserId();
                return dbAction('readonly', function (store) { return store.getAll(); }).then(function (saved) {
                    (saved || []).forEach(function (job) { if (job.userId === userId && !jobs[job.key]) { job.durable = true; jobs[job.key] = job; } }); pendingState(); return state.pending;
                }, function () { pendingState(); return state.pending; });
            }
            function retry() { return loadPending().then(function () { return $q.all(state.pending.filter(function (job) { return job.stopped || (capture && capture.job === job); }).map(flush)); }); }
            function recover(job) {
                if (!job || job.userId !== currentUserId() || (capture && capture.job.key === job.key)) { return $q.when(false); }
                job.stopped = true; return persist(job).then(function () { return job.parts.length ? flush(job) : forget(job); });
            }
            $window.addEventListener('online', retry);
            $window.addEventListener('pagehide', function () { if (capture) { stop(); } });
            return {state: state, supported: supported, start: start, stop: stop, loadPending: loadPending, retry: retry, recover: recover};
        }]);
})();
