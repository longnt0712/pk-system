const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vmModule = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');

function setup(blocked = false) {
    const stored = new Map(), calls = [], pending = [], timers = [];
    function timeout(callback, delay) { const timer = {callback, delay, cancelled: false}; timers.push(timer); return timer; }
    timeout.cancel = timer => { if (timer) timer.cancelled = true; };
    const context = vmModule.createContext({
        Date, JSON, String,
        vm: {currentUser: {id: 7}, testSessionMode: 'STUDY', isComprehensiveRoute: false, isWritingRoute: false, isListeningRoute: false},
        legacyModeDraftStorageKey: 'legacy-mode', legacyReadingDraftStorageKey: 'legacy',
        $stateParams: {ieltsReadingTestId: 42},
        readingDraftBaseKey: 'ieltsReadingInProgress:7', readingDraftTaskSuffix: '',
        readingDraftSubmitted: false,
        angular: {copy: structuredClone, isDefined: value => value !== undefined, forEach: (items, callback) => (items || []).forEach(callback), noop() {}},
        $timeout: timeout,
        $window: {localStorage: {
            getItem(key) { if (blocked) throw Error('blocked'); return stored.get(key); },
            setItem(key, value) { if (blocked) throw Error('quota'); stored.set(key, value); },
            removeItem(key) { if (blocked) throw Error('blocked'); stored.delete(key); }
        }},
        service: {
            saveLearningDraft(payload) { calls.push(payload); return new Promise(resolve => pending.push(resolve)); },
            deleteLearningDraft(key) { calls.push({deleted: key}); return Promise.resolve(); }
        }
    });
    const start = source.indexOf('        function readingDraftStorageKey(');
    const end = source.indexOf('        function loadReadingLearningDrafts()', start);
    vmModule.runInContext(source.slice(start, end), context);
    const loadStart = source.indexOf('        function loadReadingLearningDrafts()');
    vmModule.runInContext(source.slice(loadStart, source.indexOf('        readingLearningDraftsReady = loadReadingLearningDrafts();', loadStart)), context);
    const waitStart = source.indexOf('        function waitForReadingLearningDrafts(');
    vmModule.runInContext(source.slice(waitStart, source.indexOf('        function readReadingDraft(', waitStart)), context);
    const restoreStart = source.indexOf('        function readReadingDraft(');
    vmModule.runInContext(source.slice(restoreStart, source.indexOf('        function clearReadingDraft()', restoreStart)), context);
    const clearStart = source.indexOf('        function clearReadingDraft()');
    vmModule.runInContext(source.slice(clearStart, source.indexOf('        function serializeReadingDraftResults()', clearStart)), context);
    return {context, calls, pending, stored, timers};
}

test('Study and Serious use independent keys and payloads', () => {
    const {context: c} = setup();
    const study = c.readingDraftStorageKey(42, 'STUDY');
    const serious = c.readingDraftStorageKey(42, 'SERIOUS');
    assert.notEqual(study, serious);
    c.storeReadingDraft(study, {savedAt: '2026-10-07', annotationNotes: ['study'], annotations: ['highlight']});
    c.storeReadingDraft(serious, {savedAt: '2026-10-07', annotationNotes: ['serious'], annotations: []});
    assert.deepEqual(Array.from(c.readStoredDraft(study).annotationNotes), ['study']);
    assert.deepEqual(Array.from(c.readStoredDraft(study).annotations), ['highlight']);
    assert.deepEqual(Array.from(c.readStoredDraft(serious).annotationNotes), ['serious']);
});

test('restore filters legacy drafts by mode, account and test; reload retains annotations', () => {
    const {context: c, stored} = setup();
    const study = {userId: 7, testId: 42, testMode: 'READING', sessionMode: 'STUDY', savedAt: '2026-10-06', annotationNotes: ['study'], annotations: ['highlight']};
    c.storeReadingDraft(c.readingDraftStorageKey(42, 'STUDY'), study);
    c.storeReadingDraft('legacy', {...study, savedAt: '2026-10-07'});
    assert.equal(c.readReadingDraft(42, 'SERIOUS'), null);
    c.storeReadingDraft('legacy', {...study, userId: 8});
    assert.equal(c.readReadingDraft(42, 'STUDY').userId, 7);
    assert.equal(c.readReadingDraft(99, 'STUDY'), null);
    // Simulate a fresh controller with only the persisted browser contents.
    const reloaded = setup();
    for (const [key, payload] of stored) reloaded.stored.set(key, payload);
    assert.deepEqual(Array.from(reloaded.context.readReadingDraft(42, 'STUDY').annotations), ['highlight']);
});

test('blocked local storage still preserves loaded notes in memory and sends cloud save', () => {
    const {context: c, calls} = setup(true);
    const draft = {savedAt: '2026-10-07', annotationNotes: ['important']};
    c.storeReadingDraft('study', draft);
    c.saveReadingLearningDraft('study', draft);
    assert.deepEqual(Array.from(c.readStoredDraft('study').annotationNotes), ['important']);
    assert.equal(JSON.parse(calls[0].payload).annotationNotes[0], 'important');
});

test('cloud saves are ordered and a deletion waits for outstanding saves', async () => {
    const {context: c, calls, pending} = setup();
    c.saveReadingLearningDraft('study', {annotationNotes: ['old']});
    c.saveReadingLearningDraft('study', {annotationNotes: ['new']});
    c.deleteReadingLearningDraft('study');
    assert.equal(calls.length, 1);
    pending.shift()();
    await new Promise(setImmediate);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].payload).annotationNotes[0], 'new');
    pending.shift()();
    await new Promise(setImmediate);
    assert.equal(calls[2].deleted, 'study');
});

test('a second device with empty or blocked local storage restores notes and highlights from server', async () => {
    for (const blocked of [false, true]) {
        const {context: c, stored} = setup(blocked);
        const payload = {userId: 7, testId: 42, testMode: 'READING', sessionMode: 'STUDY', savedAt: '2026-10-07', annotationNotes: [{id: 'n1', specificNote: 'Ghi chú'}], annotations: [{start: 0, end: 7, highlighted: true}]};
        c.service.getLearningDrafts = () => Promise.resolve([{draftKey: c.readingDraftStorageKey(42, 'STUDY'), draftType: 'IELTS', savedAt: Date.now(), payload: JSON.stringify(payload)}]);
        assert.equal(stored.size, 0);
        assert.equal(await c.loadReadingLearningDrafts(), true);
        const restored = c.readReadingDraft(42, 'STUDY');
        assert.equal(restored.annotationNotes[0].specificNote, 'Ghi chú');
        assert.equal(restored.annotations[0].highlighted, true);
        assert.equal(c.readReadingDraft(42, 'SERIOUS'), null);
    }
});

test('slow server restore waits; timeout cannot open or autosave an empty test', async () => {
    const {context: c, timers} = setup();
    let resolve, opened = 0, failed = 0;
    c.service.getLearningDrafts = () => new Promise(done => { resolve = done; });
    c.waitForReadingLearningDrafts(() => opened++, () => failed++);
    assert.equal(opened, 0);
    assert.equal(timers[0].delay, 10000);
    timers[0].callback();
    assert.equal(failed, 1);
    resolve([]);
    await new Promise(setImmediate);
    assert.equal(opened, 0);
    // Retrying starts a new API request and is allowed to open after it succeeds.
    c.service.getLearningDrafts = () => Promise.resolve([]);
    c.waitForReadingLearningDrafts(() => opened++, () => failed++);
    await new Promise(setImmediate);
    assert.equal(opened, 1);
});

test('failed or malformed server restore does not proceed; an older response cannot replace retry data', async () => {
    const {context: c} = setup();
    let opened = 0, failed = 0;
    c.service.getLearningDrafts = () => Promise.reject(Error('offline'));
    c.waitForReadingLearningDrafts(() => opened++, () => failed++);
    await new Promise(setImmediate);
    assert.equal(opened, 0); assert.equal(failed, 1);
    c.service.getLearningDrafts = () => Promise.resolve([{draftKey: c.readingDraftStorageKey(42, 'STUDY'), draftType: 'IELTS', payload: '{bad json'}]);
    assert.equal(await c.loadReadingLearningDrafts(), false);
    let resolveOld;
    c.service.getLearningDrafts = () => new Promise(resolve => { resolveOld = resolve; });
    const old = c.loadReadingLearningDrafts();
    c.service.getLearningDrafts = () => Promise.resolve([]);
    await c.loadReadingLearningDrafts();
    resolveOld([{draftKey: c.readingDraftStorageKey(42, 'STUDY'), draftType: 'IELTS', savedAt: Date.now(), payload: JSON.stringify({annotationNotes: ['stale']})}]);
    assert.equal(await old, false);
    assert.equal(c.readStoredDraft(c.readingDraftStorageKey(42, 'STUDY')), null);
});

test('server synchronization indicator only confirms successful saves and shows failures', async () => {
    const {context: c, pending} = setup();
    c.saveReadingLearningDraft('study', {annotationNotes: ['saved']});
    assert.equal(c.vm.readingDraftSyncStatus, 'saving');
    pending.shift()();
    await new Promise(setImmediate);
    assert.equal(c.vm.readingDraftSyncStatus, 'saved');
    c.service.saveLearningDraft = () => Promise.reject(Error('offline'));
    c.saveReadingLearningDraft('study', {annotationNotes: ['unsaved']});
    await new Promise(setImmediate);
    assert.equal(c.vm.readingDraftSyncStatus, 'error');
});

test('submission during annotation restore and missing anchors preserve saved annotation records', () => {
    const {context: c} = setup();
    c.annotationContainerIds = ['passage-text-1'];
    c.document = {getElementById: () => null};
    c.annotation = {containerId: 'passage-text-1', start: 0, end: 7, highlighted: true, hasNote: true, noteId: 'n1'};
    const serializeStart = source.indexOf('        function serializeReadingAnnotations()');
    vmModule.runInContext(source.slice(serializeStart, source.indexOf('        function textRangeForOffsets(', serializeStart)), c);
    const restoreStart = source.indexOf('        function restoreReadingAnnotations(');
    vmModule.runInContext(source.slice(restoreStart, source.indexOf('        function buildIeltsLearningState()', restoreStart)), c);
    vmModule.runInContext('pendingReadingAnnotations = [annotation];', c);
    assert.equal(c.serializeReadingAnnotations()[0].noteId, 'n1');
    vmModule.runInContext('pendingReadingAnnotations = null;', c);
    c.restoreReadingAnnotations([c.annotation]);
    assert.equal(c.serializeReadingAnnotations()[0].highlighted, true);
    assert.equal(c.serializeReadingAnnotations()[0].noteId, 'n1');
});

function apiService(transport) {
    let Service;
    const context = vmModule.createContext({
        angular: {
            module: () => ({service(name, definition) { Service = definition; }}),
            copy: structuredClone, isArray: Array.isArray, noop() {}
        }
    });
    const code = fs.readFileSync(path.join(__dirname, '../question/business/QuestionService.js'), 'utf8');
    vmModule.runInContext(code, context);
    return new Service({
        get: url => Promise.resolve().then(() => transport('GET', url)),
        post: (url, data) => Promise.resolve().then(() => transport('POST', url, data))
    }, {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)}, null,
    {api: {baseUrl: 'https://example.test/', apiV1Url: 'api/'}}, {});
}

test('actual API service saves to the server endpoint and a fresh client reads its payload', async () => {
    let saved;
    const transport = (method, url, data) => {
        if (method === 'POST') {
            assert.equal(url, 'https://example.test/api/test_result/draft/save');
            saved = {...data, savedAt: Date.now()}; return {data: saved};
        }
        assert.equal(url, 'https://example.test/api/test_result/drafts');
        return {data: [saved]};
    };
    const first = apiService(transport);
    await first.saveLearningDraft({draftKey: 'study', draftType: 'IELTS', payload: JSON.stringify({annotationNotes: [{specificNote: 'Ghi chú tiếng Việt'}]})});
    const second = apiService(transport);
    assert.equal(JSON.parse((await second.getLearningDrafts())[0].payload).annotationNotes[0].specificNote, 'Ghi chú tiếng Việt');
});

test('actual API service rejects an invalid server response instead of treating it as no saved notes', async () => {
    const service = apiService(() => ({data: '<html>Login</html>'}));
    await assert.rejects(service.getLearningDrafts(), /Invalid learning drafts response/);
});

test('Test Result viewer reads the submitted server snapshot and resets previous result notes', () => {
    const context = vmModule.createContext({vm: {}, JSON});
    const code = fs.readFileSync(path.join(__dirname, '../test_result/controllers/TestResultController.js'), 'utf8');
    const start = code.indexOf('        vm.loadIeltsLearningState = function (testResult)');
    vmModule.runInContext(code.slice(start, code.indexOf('        vm.formatIeltsActiveDuration', start)), context);
    context.vm.loadIeltsLearningState({ieltsLearningState: JSON.stringify({sessionMode: 'STUDY', annotationNotes: ['study'], annotations: ['highlight']})});
    assert.equal(context.vm.ieltsLearningState.annotationNotes[0], 'study');
    context.vm.loadIeltsLearningState({ieltsLearningState: JSON.stringify({sessionMode: 'SERIOUS', annotationNotes: ['test']})});
    assert.deepEqual(Array.from(context.vm.ieltsLearningState.annotationNotes), ['test']);
    context.vm.loadIeltsLearningState({});
    assert.equal(Object.keys(context.vm.ieltsLearningState).length, 0);
});

test('leaving during startup cannot save before server restoration has completed', () => {
    const {context: c, calls} = setup();
    const start = source.indexOf('        function saveReadingDraft()');
    vmModule.runInContext(source.slice(start, source.indexOf('        function markStudyDraftCompleted(', start)), c);
    c.vm.ieltsReadingActualTest = {id: 42}; c.vm.isStartTest = true; c.vm.isStartingTest = true;
    c.saveReadingDraft();
    assert.equal(calls.length, 0);
});

test('serious completion clears its server draft even when local storage is blocked, preserving Study', async () => {
    const {context: c, calls} = setup(true);
    c.vm.ieltsReadingActualTest = {id: 42}; c.vm.testSessionMode = 'SERIOUS';
    c.storeReadingDraft(c.readingDraftStorageKey(42, 'STUDY'), {annotationNotes: ['study']});
    c.storeReadingDraft(c.readingDraftStorageKey(42, 'SERIOUS'), {annotationNotes: ['serious']});
    c.clearReadingDraft();
    await new Promise(setImmediate);
    assert.ok(calls.some(call => call.deleted === c.readingDraftStorageKey(42, 'SERIOUS')));
    assert.equal(c.readStoredDraft(c.readingDraftStorageKey(42, 'SERIOUS')), null);
    assert.equal(c.readStoredDraft(c.readingDraftStorageKey(42, 'STUDY')).annotationNotes[0], 'study');
});
