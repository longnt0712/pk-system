const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function angularCopy(value, destination) {
    const copied = clone(value);
    if (!destination) return copied;
    if (Array.isArray(destination)) { destination.splice(0, destination.length, ...copied); }
    else { Object.keys(destination).forEach(key => delete destination[key]); Object.assign(destination, copied); }
    return destination;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function clock() {
    let now = 0, nextId = 0;
    const jobs = new Map();
    function timeout(callback, delay = 0) {
        const id = ++nextId;
        jobs.set(id, {callback, at: now + delay});
        return id;
    }
    timeout.cancel = id => jobs.delete(id);
    timeout.advance = async duration => {
        const end = now + duration;
        for (let safety = 0; safety < 1000; safety++) {
            const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            now = next[1].at; jobs.delete(next[0]); next[1].callback(); await tick();
            if (safety === 999) throw new Error('Notebook timer loop did not settle');
        }
        now = end; await tick();
    };
    timeout.pending = () => jobs.size;
    return timeout;
}
const identity = {userId: 7, testId: 42, testMode: 'READING'};
const cloudKey = (value = identity) => 'study-notebook:v1:' + value.userId + ':' + value.testMode + ':' + value.testId;
function cloudDraft(text, revision = 'remote-a', value = identity, document = {}) {
    const payload = {schemaVersion: 1, ...value, revision, parentRevision: null,
        document: {text, orientation: 'portrait', pattern: 'lined', strokes: [], ...document}, hiddenFromDashboard: true};
    return {id: 90, draftType: 'STUDY_NOTEBOOK', draftKey: cloudKey(value), title: 'Study notebook',
        payload: JSON.stringify(payload), savedAt: 1000};
}
function harness(options = {}) {
    let definition;
    const angular = {
        module() { return {factory(name, value) { assert.equal(name, 'StudyNotebookStore'); definition = value; return this; }}; },
        copy: angularCopy, noop() {}, isArray: Array.isArray, isObject: value => value !== null && typeof value === 'object',
        toJson: JSON.stringify, fromJson: JSON.parse,
        forEach(items, callback) { Array.isArray(items) ? items.forEach(callback) : Object.keys(items || {}).forEach(key => callback(items[key], key)); },
        extend: Object.assign
    };
    nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname, '../common/utils/study-notebook-store.js'), 'utf8'),
        {angular, console, Date, JSON, Math, Uint8Array, Promise, Error, isFinite, parseInt});
    assert.ok(definition, 'Notebook factory is registered');
    const storage = options.storage || new Map(), cloud = new Map((options.cloud || []).map(item => [item.draftKey, clone(item)]));
    const timeout = clock(), reads = [], posts = [], heldReads = [], heldSaves = [];
    const controls = {userId: 7, failRead: false, failPost: false, blockStorage: false, holdRead: false, holdSave: false, ack: null};
    Object.assign(controls, options.controls);
    const listeners = new Map();
    const window = {
        document: {hidden: false,
            addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
            removeEventListener(name, callback) { (listeners.get(name) || new Set()).delete(callback); }},
        localStorage: {
            getItem(key) { if (controls.blockStorage) throw new Error('Storage blocked'); return storage.get(key) || null; },
            setItem(key, value) { if (controls.blockStorage) throw new Error('Storage blocked'); storage.set(key, value); },
            removeItem(key) { if (controls.blockStorage) throw new Error('Storage blocked'); storage.delete(key); }
        },
        addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
        removeEventListener(name, callback) { (listeners.get(name) || new Set()).delete(callback); },
        fire(name, values = {}) {
            const event = {prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; }, ...values};
            for (const callback of [...(listeners.get(name) || [])]) callback(event);
            return event;
        },
        crypto: {getRandomValues(array) { for (let index = 0; index < array.length; index++) array[index] = (Math.random() * 0xffffffff) >>> 0; return array; }}
    };
    const service = {
        getLearningDrafts() {
            reads.push({userId: controls.userId});
            if (controls.failRead) return Promise.reject(new Error('Draft read offline'));
            const snapshot = [...cloud.values()].map(clone);
            if (controls.holdRead) {
                const pending = deferred(); heldReads.push({pending, snapshot}); return pending.promise;
            }
            return Promise.resolve(snapshot);
        },
        saveLearningDraft(value) {
            const dto = clone(value); posts.push(dto);
            if (controls.failPost) return Promise.reject(new Error('Draft write offline'));
            function acknowledge() {
                const accepted = {...dto, id: 90 + posts.length, savedAt: 2000 + posts.length};
                if (controls.ack) return controls.ack(clone(accepted));
                cloud.set(dto.draftKey, clone(accepted)); return accepted;
            }
            if (controls.holdSave) {
                const pending = deferred(); heldSaves.push({pending, dto, acknowledge}); return pending.promise;
            }
            return Promise.resolve(acknowledge());
        }
    };
    function q(executor) { return new Promise(executor); }
    q.when = value => Promise.resolve(value); q.resolve = q.when; q.reject = reason => Promise.reject(reason);
    q.all = values => Promise.all(values); q.defer = deferred;
    const dependencies = {$window: window, $timeout: timeout, $q: q,
        $cookies: {get(name) { assert.equal(name, 'education.user'); return controls.userId == null ? undefined : JSON.stringify({id: controls.userId}); }},
        QuestionService: service};
    function instantiate() {
        const factory = Array.isArray(definition) ? definition.at(-1) : definition;
        const names = Array.isArray(definition) ? definition.slice(0, -1) : factory.$inject;
        return factory(...names.map(name => { assert.ok(name in dependencies, 'Injected dependency ' + name); return dependencies[name]; }));
    }
    const store = instantiate();
    return {store, instantiate, storage, cloud, timeout, reads, posts, heldReads, heldSaves, controls, window, listeners,
        open(value = identity) { return store.open(clone(value)); },
        releaseRead(index = 0, value) { const held = heldReads[index]; assert.ok(held, 'Held read exists'); held.pending.resolve(value || held.snapshot); },
        releaseSave(index = 0) { const held = heldSaves[index]; assert.ok(held, 'Held save exists'); held.pending.resolve(held.acknowledge()); }};
}

test('notebooks isolate all four test modes, students and drafts without creating blank cloud records', async () => {
    const unrelated = {id: 11, draftType: 'IELTS', draftKey: 'ieltsReadingInProgress:7:reading:test:42', payload: '{"annotationNotes":[{"text":"keep"}]}'};
    const h = harness({cloud: [unrelated]});
    const sessions = ['READING', 'LISTENING', 'WRITING', 'COMPREHENSIVE'].map(testMode => h.open({...identity, testMode}));
    await Promise.all(sessions.map(session => session.ready));
    assert.equal(new Set(sessions.map(session => session.key)).size, 4);
    for (const session of sessions) { assert.notEqual(session.key, session.localKey); assert.equal(session.document.text, ''); }
    await h.timeout.advance(2000);
    assert.equal(h.posts.length, 0); assert.deepEqual(h.cloud.get(unrelated.draftKey), unrelated);
    for (const bad of [{...identity, userId: 8}, {...identity, userId: 0}, {...identity, testId: -1}, {...identity, testId: 'preview-local'}, {...identity, testMode: 'SERIOUS'}]) {
        const readCount = h.reads.length, size = h.storage.size;
        assert.throws(() => h.open(bad)); assert.equal(h.reads.length, readCount); assert.equal(h.storage.size, size);
    }
});

test('a slow initial read never posts an empty page over an existing cloud notebook', async () => {
    const h = harness({cloud: [cloudDraft('Existing page', 'remote-a', identity, {orientation: 'landscape', pattern: 'grid'})], controls: {holdRead: true}});
    const session = h.open(); await h.timeout.advance(2500);
    assert.equal(h.posts.length, 0);
    h.releaseRead(); await session.ready;
    assert.equal(session.document.text, 'Existing page'); assert.equal(session.document.orientation, 'landscape'); assert.equal(session.document.pattern, 'grid');
    assert.equal(h.posts.length, 0);
});

test('typing during an unresolved remote read preserves the local draft and exposes a conflict', async () => {
    const h = harness({cloud: [cloudDraft('Remote page')], controls: {holdRead: true}}), session = h.open();
    session.document.text = 'My edit before the cloud loaded'; session.changed();
    assert.ok(h.storage.has(session.localKey)); await h.timeout.advance(2000); assert.equal(h.posts.length, 0);
    h.releaseRead(); await session.ready;
    assert.equal(session.document.text, 'My edit before the cloud loaded'); assert.equal(session.status, 'conflict');
    assert.equal(h.posts.length, 0);
    await session.useRemote();
    assert.equal(session.document.text, 'Remote page'); assert.equal(h.posts.length, 0);
});

test('a notebook edit is stored locally immediately and syncs text plus paper settings after the debounce', async () => {
    const h = harness(), session = h.open(); await session.ready;
    session.document.text = 'Planning my answer\nTourism → culture'; session.document.orientation = 'landscape'; session.document.pattern = 'squares';
    session.changed();
    const local = JSON.parse(h.storage.get(session.localKey));
    assert.equal(local.document.text, session.document.text); assert.equal(local.document.orientation, 'landscape'); assert.equal(local.dirty, true);
    assert.equal(h.posts.length, 0); await h.timeout.advance(2000);
    assert.equal(h.posts.length, 1);
    const sent = h.posts[0], payload = JSON.parse(sent.payload);
    assert.equal(sent.draftType, 'STUDY_NOTEBOOK'); assert.equal(sent.draftKey, session.key);
    assert.equal(payload.document.pattern, 'squares'); assert.equal(payload.document.orientation, 'landscape');
    assert.equal(payload.document.text, session.document.text); assert.equal(payload.hiddenFromDashboard, true);
    assert.equal(session.status, 'saved');
});

test('the pet cloud cache cannot replace the notebook local recovery envelope', async () => {
    const remote = cloudDraft('Cloud version'), h = harness({cloud: [remote]}), session = h.open(); await session.ready;
    session.document.text = 'Unsynced notebook edit'; session.changed();
    const envelope = h.storage.get(session.localKey);
    h.storage.set(session.key, remote.payload); // The learning pet writes to the cloud key, not our recovery key.
    assert.equal(h.storage.get(session.localKey), envelope);
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.equal(reopened.document.text, 'Unsynced notebook edit');
});

test('an older in-flight acknowledgement cannot mark a newer notebook edit synced or change the sent snapshot', async () => {
    const h = harness({controls: {holdSave: true}}), session = h.open(); await session.ready;
    session.document.text = 'Snapshot A'; session.changed(); const firstSave = session.save(); await tick();
    assert.equal(h.posts.length, 1); const firstPayload = h.posts[0].payload;
    session.document.text = 'Snapshot B'; session.changed(); const secondSave = session.save(); await tick();
    assert.equal(h.posts.length, 1, 'Only one cloud write for this notebook may be in flight');
    assert.equal(JSON.parse(firstPayload).document.text, 'Snapshot A');
    h.controls.holdSave = false; h.releaseSave(); await tick();
    await Promise.all([firstSave, secondSave]); await h.timeout.advance(2000);
    assert.equal(h.posts.length, 2); assert.equal(JSON.parse(h.posts[1].payload).document.text, 'Snapshot B');
    assert.equal(h.posts[0].payload, firstPayload); assert.equal(session.document.text, 'Snapshot B'); assert.equal(session.status, 'saved');
    assert.equal(JSON.parse(h.storage.get(session.localKey)).dirty, false);
});

test('invalid acknowledgements retain the full local draft and can be retried safely', async () => {
    for (const invalid of [ack => ({...ack, id: 0}), ack => ({...ack, draftKey: 'wrong-key'}), ack => ({...ack, draftType: 'IELTS'}), ack => ({...ack, payload: '{}'})]) {
        const h = harness({controls: {ack: invalid}}), session = h.open(); await session.ready;
        session.document.text = 'Important unsaved notes'; session.changed(); await session.save();
        assert.notEqual(session.status, 'saved'); assert.equal(session.document.text, 'Important unsaved notes');
        assert.equal(JSON.parse(h.storage.get(session.localKey)).dirty, true);
        h.controls.ack = null; await session.save();
        assert.equal(session.status, 'saved'); assert.equal(JSON.parse(h.posts.at(-1).payload).document.text, 'Important unsaved notes');
    }
});

test('a failed initial read permits local editing but prevents cloud writes until a successful refresh', async () => {
    const h = harness({controls: {failRead: true}}), session = h.open(); await session.ready;
    session.document.text = 'Offline worksheet'; session.changed(); await session.save(); await h.timeout.advance(2000);
    assert.equal(session.document.text, 'Offline worksheet'); assert.equal(h.posts.length, 0); assert.notEqual(session.status, 'saved');
    assert.equal(JSON.parse(h.storage.get(session.localKey)).document.text, 'Offline worksheet');
    h.controls.failRead = false; await session.refresh(); await session.save();
    assert.equal(h.posts.length, 1); assert.equal(session.status, 'saved');
});

test('cloud failure and blocked local storage never discard in-memory notes or claim a save before confirmation', async () => {
    const h = harness({controls: {blockStorage: true, failPost: true}}), session = h.open(); await session.ready;
    session.document.text = 'Private browser notes'; session.changed();
    assert.notEqual(session.status, 'saved'); await session.save();
    assert.equal(session.document.text, 'Private browser notes'); assert.notEqual(session.status, 'saved');
    h.controls.failPost = false; await session.save();
    assert.equal(session.status, 'saved'); assert.equal(JSON.parse(h.posts.at(-1).payload).document.text, 'Private browser notes');
});

test('a changed cloud revision creates a conflict and never silently overwrites the other device', async () => {
    const h = harness({cloud: [cloudDraft('First device', 'revision-a')]}), session = h.open(); await session.ready;
    session.document.text = 'My new local note'; session.changed();
    h.cloud.set(session.key, cloudDraft('Second device', 'revision-b'));
    await session.save();
    assert.equal(session.status, 'conflict'); assert.equal(session.document.text, 'My new local note'); assert.equal(h.posts.length, 0);
    assert.equal(JSON.parse(h.cloud.get(session.key).payload).document.text, 'Second device');
    await session.keepLocal(); await session.save();
    assert.equal(session.status, 'saved'); assert.equal(JSON.parse(h.posts.at(-1).payload).document.text, 'My new local note');
    assert.equal(JSON.parse(h.posts.at(-1).payload).parentRevision, 'revision-b');
});

test('refreshing an untouched page uses the latest remote revision without posting a rewrite', async () => {
    const h = harness({cloud: [cloudDraft('Initial', 'revision-a')]}), session = h.open(); await session.ready;
    const documentReference = session.document;
    h.cloud.set(session.key, cloudDraft('Refreshed from other device', 'revision-b', identity, {orientation: 'landscape', pattern: 'vertical'}));
    await session.refresh();
    assert.equal(session.document, documentReference); assert.equal(session.document.text, 'Refreshed from other device');
    assert.equal(session.document.pattern, 'vertical'); assert.equal(h.posts.length, 0);
});

test('an unchanged cloud refresh preserves stroke references used by the drawing undo history', async () => {
    const stroke = {id: 'existing-ink', tool: 'pen', color: '#315bbe', width: 4, points: [[10, 20, 0.5], [30, 40, 0.8]]};
    const h = harness({cloud: [cloudDraft('Notes', 'revision-a', identity, {strokes: [stroke]})]});
    const session = h.open(); await session.ready;
    const strokes = session.document.strokes, first = strokes[0];
    await session.refresh();
    assert.equal(session.document.strokes, strokes); assert.equal(session.document.strokes[0], first);
    assert.equal(h.posts.length, 0);
});

test('logout or a different authenticated student cannot send this notebook snapshot', async () => {
    const h = harness(), session = h.open(); await session.ready;
    session.document.text = 'Original student'; session.changed(); h.controls.userId = 8;
    const before = h.reads.length; await session.save(); await session.refresh(); await h.timeout.advance(2000);
    assert.equal(h.posts.length, 0); assert.equal(h.reads.length, before); assert.equal(session.document.text, 'Original student');
    assert.notEqual(session.status, 'saved');
});

test('oversized text is not truncated and is never submitted as a partial notebook', async () => {
    const h = harness(), session = h.open(); await session.ready;
    const text = 'x'.repeat(500001); session.document.text = text; session.changed(); await session.save();
    assert.equal(session.document.text.length, text.length); assert.ok(session.document.text === text);
    assert.equal(h.posts.length, 0); assert.notEqual(session.status, 'saved'); assert.ok(session.error);
});

test('closing a session preserves its pending local notebook for the next visit', async () => {
    const h = harness({controls: {holdSave: true}}), session = h.open(); await session.ready;
    session.document.text = 'Keep this after leaving the test'; session.document.orientation = 'landscape'; session.changed();
    session.destroy(); await tick();
    assert.equal(JSON.parse(h.storage.get(session.localKey)).document.text, 'Keep this after leaving the test');
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.equal(reopened.document.text, 'Keep this after leaving the test'); assert.equal(reopened.document.orientation, 'landscape');
});

test('pen and highlighter vectors round-trip through the cloud without changing their geometry or paper settings', async () => {
    const h = harness(), session = h.open(); await session.ready;
    const strokes = [{id: 'stroke-pen', tool: 'pen', color: '#2457ff', width: 3,
        points: [[0.1, 0.2, 0.3], [0.3, 0.5, 0.7], [0.9, 0.8, 1]]},
    {id: 'stroke-highlight', tool: 'highlighter', color: '#ffd166', width: 18,
        points: [[0.2, 0.3], [0.7, 0.3]]}];
    session.document.strokes = clone(strokes); session.document.pattern = 'grid'; session.document.orientation = 'landscape';
    session.changed(); await session.save();
    assert.deepEqual(JSON.parse(h.posts[0].payload).document.strokes, strokes);
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.deepEqual(clone(reopened.document.strokes), strokes); assert.equal(reopened.document.pattern, 'grid');
    assert.equal(reopened.document.orientation, 'landscape');
});

test('a cloud record with another student or test in its payload cannot populate or overwrite this notebook', async () => {
    for (const changedIdentity of [{userId: 8}, {testId: 99}, {testMode: 'LISTENING'}]) {
        const remote = cloudDraft('Do not load this notebook');
        remote.payload = JSON.stringify({...JSON.parse(remote.payload), ...changedIdentity});
        const h = harness({cloud: [remote]}), session = h.open(); await session.ready;
        assert.equal(session.document.text, ''); assert.notEqual(session.status, 'saved');
        session.document.text = 'Current student'; session.changed(); await session.save();
        assert.equal(h.posts.length, 0); assert.equal(session.document.text, 'Current student');
    }
});

test('an oversized notebook remains fully recoverable locally even though it cannot be uploaded', async () => {
    const h = harness(), session = h.open(); await session.ready;
    const text = 'z'.repeat(500001); session.document.text = text; session.changed(); await session.save();
    assert.equal(JSON.parse(h.storage.get(session.localKey)).document.text.length, text.length);
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.equal(reopened.document.text.length, text.length); assert.ok(reopened.document.text === text);
    assert.equal(h.posts.length, 0); assert.notEqual(reopened.status, 'saved');
});

test('leaving during an in-flight save immediately drains the newer edit before releasing the session', async () => {
    const h = harness({controls: {holdSave: true}}), session = h.open(); await session.ready;
    session.document.text = 'Snapshot A'; session.changed(); const first = session.save(); await tick();
    assert.equal(h.posts.length, 1);
    session.document.text = 'Snapshot B before leaving'; session.changed(); session.destroy();
    h.controls.holdSave = false; h.releaseSave(); await first; await tick();
    assert.equal(h.posts.length, 2, 'The final edit must be uploaded without reopening or advancing a mounted-view timer');
    assert.equal(JSON.parse(h.cloud.get(session.key).payload).document.text, 'Snapshot B before leaving');
    assert.equal(JSON.parse(h.storage.get(session.localKey)).dirty, false);
    assert.equal(h.timeout.pending(), 0);
});

test('malformed local JSON or schema is preserved for recovery while new offline edits can still be stored', async () => {
    for (const raw of ['{"broken', JSON.stringify({schemaVersion: 99, userId: 7, testId: 42, testMode: 'READING', revision: 'bad-schema', document: {text: 'Recover me'}})]) {
        const localKey = 'study-notebook-local:v1:7:READING:42', storage = new Map([[localKey, raw]]);
        const h = harness({storage, controls: {failRead: true}}), session = h.open(); await session.ready;
        session.document.text = 'Valid replacement kept offline'; session.changed(); await session.save();
        assert.equal(h.storage.get(localKey + ':recovery'), raw);
        assert.equal(JSON.parse(h.storage.get(localKey)).document.text, 'Valid replacement kept offline');
        assert.equal(h.posts.length, 0); assert.notEqual(session.status, 'saved');
        const reopened = h.instantiate().open(identity); await reopened.ready;
        assert.equal(reopened.document.text, 'Valid replacement kept offline');
        assert.equal(h.storage.get(localKey + ':recovery'), raw);
    }
});

test('explicitly keeping a recovered local notebook recreates a missing cloud record with no stale parent revision', async () => {
    const h = harness({cloud: [cloudDraft('Original cloud page', 'revision-a')]}), original = h.open(); await original.ready;
    original.document.text = 'Recovered local page'; original.changed();
    h.cloud.delete(original.key);
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.equal(reopened.document.text, 'Recovered local page'); assert.equal(reopened.status, 'conflict'); assert.equal(h.posts.length, 0);
    await reopened.keepLocal();
    assert.equal(reopened.status, 'saved'); assert.equal(h.posts.length, 1);
    const saved = JSON.parse(h.cloud.get(reopened.key).payload);
    assert.equal(saved.document.text, 'Recovered local page'); assert.equal(saved.parentRevision, null);
});

test('a failed conflict-resolution read keeps both the conflict and local note until the student retries', async () => {
    const h = harness({cloud: [cloudDraft('Original page', 'revision-a')]}), session = h.open(); await session.ready;
    session.document.text = 'My conflicted page'; session.changed();
    h.cloud.set(session.key, cloudDraft('Other device page', 'revision-b')); await session.save();
    assert.equal(session.status, 'conflict');
    const localBefore = h.storage.get(session.localKey);
    h.controls.failRead = true; await session.keepLocal();
    assert.equal(session.status, 'conflict'); assert.equal(session.document.text, 'My conflicted page'); assert.ok(session.error);
    assert.equal(h.storage.get(session.localKey), localBefore); assert.equal(h.posts.length, 0);
    assert.equal(JSON.parse(h.cloud.get(session.key).payload).document.text, 'Other device page');
    h.controls.failRead = false; await session.keepLocal();
    assert.equal(session.status, 'saved'); assert.equal(JSON.parse(h.posts[0].payload).document.text, 'My conflicted page');
    assert.equal(JSON.parse(h.posts[0].payload).parentRevision, 'revision-b');
});

test('when both storage and cloud fail, route re-entry keeps the sole memory copy and reload warns until online recovery succeeds', async () => {
    const h = harness({controls: {blockStorage: true, failPost: true}}), session = h.open(); await session.ready;
    session.document.text = 'The only surviving copy'; session.changed(); await session.save();
    const warning = h.window.fire('beforeunload'); assert.equal(warning.prevented, true); assert.equal(warning.returnValue, '');
    session.destroy(); await tick();
    const reopened = h.open(); assert.equal(reopened, session); assert.equal(reopened.document.text, 'The only surviving copy');
    reopened.destroy(); await tick();
    assert.equal(h.window.fire('beforeunload').prevented, true);
    h.controls.failPost = false; h.window.fire('online');
    for (let index = 0; index < 4; index++) await tick();
    assert.equal(JSON.parse(h.cloud.get(session.key).payload).document.text, 'The only surviving copy');
    assert.equal(h.window.fire('beforeunload').prevented, false);
    for (const callbacks of h.listeners.values()) assert.equal(callbacks.size, 0, 'Recovered unmounted sessions release their global listeners');
    const fromCloud = h.open(); await fromCloud.ready; assert.equal(fromCloud.document.text, 'The only surviving copy');
});

test('a durable local backup permits leaving without a reload warning even while cloud saving is unavailable', async () => {
    const h = harness({controls: {failPost: true}}), session = h.open(); await session.ready;
    session.document.text = 'Safely cached on this device'; session.changed(); await session.save();
    assert.equal(h.window.fire('beforeunload').prevented, false);
    session.destroy(); await tick(); assert.equal(h.window.fire('beforeunload').prevented, false);
    const reopened = h.instantiate().open(identity); await reopened.ready;
    assert.equal(reopened.document.text, 'Safely cached on this device'); assert.notEqual(reopened.status, 'saved');
});

test('a background cloud refresh keeps an existing notebook editable and preserves text entered while its GET is pending', async () => {
    const h = harness({cloud: [cloudDraft('Existing note', 'revision-a')]}), session = h.open(); await session.ready;
    assert.equal(session.status, 'saved'); h.controls.holdRead = true;
    const refresh = session.refresh(); assert.notEqual(session.status, 'loading');
    session.document.text = 'Text entered during the background refresh'; session.changed();
    h.releaseRead(); await refresh;
    assert.equal(session.document.text, 'Text entered during the background refresh'); assert.notEqual(session.status, 'loading');
    assert.equal(JSON.parse(h.storage.get(session.localKey)).document.text, session.document.text);
    assert.equal(JSON.parse(h.storage.get(session.localKey)).dirty, true); assert.equal(h.posts.length, 0);
});
