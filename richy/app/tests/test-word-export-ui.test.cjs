const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const app = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const builder = read('question/controllers/IELTSCreateReadingTestController.js');
const daily = read('question/controllers/DailyListeningTestController.js');
const copy = value => structuredClone(value);
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let index = 0; index < 8; index++) { await Promise.resolve(); } };
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'Source section exists: ' + start);
    return source.slice(from, to);
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function failWrite() { throw new Error('Export must not save, create preview data or modify a learning draft'); }

function fixture(mode, overrides = {}) {
    const saved = {id: 21, title: 'Saved ' + mode, question: 'Saved title', testFormat: mode,
        questionType: {id: 11}, motherTongue: '<p>Saved listening transcript.</p>',
        subQuestions: [{id: 30, question: '<p>Complete passage from server.</p>',
            subQuestions: [{id: 40, type: 1, question: '<p>Choose one answer.</p>',
                subQuestions: [{id: 50, question: 'Complete saved question',
                    questionAnswers: [{answer: {answer: 'Saved option'}, correct: true}]}]}]}]};
    const reads = [], opens = [], errors = [];
    const service = {
        getOne(id) { reads.push(id); return overrides.read ? overrides.read(id) : Promise.resolve(saved); },
        saveObject: failWrite, saveDailyListening: failWrite, saveLearningDraft: failWrite,
        deleteLearningDraft: failWrite, getDailyListeningTests() { return Promise.resolve({content: [], totalElements: 0}); }
    };
    const exporter = {open(snapshot, options) {
        opens.push({snapshot, options});
        return overrides.open ? overrides.open(snapshot, options) : Promise.resolve();
    }};
    const vm = {};
    const angular = {copy, noop() {}, forEach: (items, callback) => (items || []).forEach(callback),
        isArray: Array.isArray, isDefined: value => value !== undefined};
    const context = {vm, angular, service, wordExport: exporter, $q: {when: value => Promise.resolve(value)},
        toastr: {error(...args) { errors.push(args); }},
        $window: {localStorage: {setItem: failWrite, removeItem: failWrite},
            sessionStorage: {setItem: failWrite, removeItem: failWrite}, open: failWrite},
        clearOldReadingPreviews: failWrite};
    if (mode === 'DAILY_LISTENING') {
        let definition;
        angular.module = () => ({controller(name, value) { definition = value; }});
        nodeVm.runInNewContext(daily, {angular});
        const dependencies = {
            '$cookies': {get: () => JSON.stringify({id: 7, roles: [{name: 'ROLE_ADMIN'}]})},
            '$location': {path: () => '/create_daily_listening_test'},
            '$window': {...context.$window, document: {}}, settings: {}, QuestionService: service,
            ComprehensiveListening: {transcriptText: value => String(value || '').replace(/<[^>]*>/g, ''), parseUrl: () => ({})},
            toastr: context.toastr, '$uibModal': {open: failWrite}, '$q': context.$q,
            ComprehensiveFolders: {bindUrl: () => () => {}, applyFilter() {}}, '$scope': {$on() {}},
            TestWordExport: exporter
        };
        definition.at(-1).apply(vm, definition.slice(0, -1).map(name => {
            assert.ok(name in dependencies, 'Mock injected dependency: ' + name);
            return dependencies[name];
        }));
    } else {
        const route = {READING: '/create_ielts_reading_test', LISTENING: '/create_ielts_listening_test',
            WRITING: '/create_ielts_writing_test', COMPREHENSIVE: '/create_comprehensive_test'}[mode];
        context.$location = {path: () => route};
        nodeVm.runInNewContext(section(builder, '        vm.isComprehensiveMode =', '        vm.comprehensiveContentMode ='), context);
        nodeVm.runInNewContext(section(builder, '        vm.exportTestWord = function', '        vm.previewReadingTest ='), context);
        vm.catalogStatusUpdating = {};
        vm.catalogTitleUpdating = {};
        vm.ieltsReadingTest = {id: 77, title: 'Unsaved editor title', subQuestions: [{question: '<p>Unsaved passage.</p>',
            subQuestions: [{type: 11, question: 'Write one word', subQuestions: [{question: 'Unsaved }{SPACE}{'}]}]}]};
    }
    return {vm, saved, reads, opens, errors};
}

for (const mode of ['READING', 'LISTENING', 'WRITING', 'COMPREHENSIVE', 'DAILY_LISTENING']) {
    test(mode + ' catalog export loads the complete saved test and isolates it from exporter changes', async () => {
        const f = fixture(mode, {open(snapshot) { snapshot.subQuestions[0].question = 'Exporter-local change'; return Promise.resolve(); }});
        const row = {id: 21, title: 'Abbreviated catalog row'};
        const before = copy(f.saved);
        const operation = f.vm.exportTestWord(row);
        assert.equal(f.vm.exportingWord, true);
        assert.equal(f.vm.exportingWordId, 21);
        assert.deepEqual(f.reads, [21]);
        await operation;
        assert.equal(f.opens.length, 1);
        assert.equal(f.opens[0].snapshot.subQuestions[0].subQuestions[0].subQuestions[0].question, 'Complete saved question');
        assert.deepEqual(plain(f.opens[0].options), {testMode: mode});
        assert.notStrictEqual(f.opens[0].snapshot, f.saved);
        assert.notStrictEqual(f.opens[0].snapshot.subQuestions, f.saved.subQuestions);
        assert.deepEqual(f.saved, before);
        assert.deepEqual(row, {id: 21, title: 'Abbreviated catalog row'});
        assert.equal(f.vm.exportingWord, false);
        assert.equal(f.vm.exportingWordId, null);
        assert.deepEqual(f.errors, []);
    });
}

for (const mode of ['READING', 'LISTENING', 'WRITING', 'COMPREHENSIVE']) {
    test(mode + ' editor export captures current unsaved content without loading or changing the test', async () => {
        const f = fixture(mode, {open(snapshot) { snapshot.subQuestions[0].question = 'Export-only mutation'; return Promise.resolve(); }});
        const editor = f.vm.ieltsReadingTest;
        const before = copy(editor);
        const operation = f.vm.exportTestWord();
        assert.equal(f.vm.exportingWordId, null);
        await operation;
        assert.deepEqual(f.reads, []);
        assert.equal(f.opens[0].snapshot.title, 'Unsaved editor title');
        assert.equal(f.opens[0].snapshot.subQuestions[0].subQuestions[0].subQuestions[0].question, 'Unsaved }{SPACE}{');
        assert.strictEqual(f.vm.ieltsReadingTest, editor);
        assert.deepEqual(editor, before);
    });
}

test('Daily Listening editor exports changed transcript and keeps the editor draft untouched', async () => {
    const f = fixture('DAILY_LISTENING');
    f.vm.draft = {title: 'Old stored title', question: 'Unsaved listening title', pronounce: 'https://school.test/unsaved.mp3',
        motherTongue: 'Stale persisted transcript', testFormat: 'DAILY_LISTENING', questionType: {id: 11}};
    f.vm.originalTranscript = '<p>Original transcript.</p>';
    f.vm.originalTranscriptText = 'Original transcript.';
    f.vm.transcript = '  Changed first line.\n\n  Changed second line.\n';
    const editor = f.vm.draft, before = copy(editor), transcript = f.vm.transcript;
    const operation = f.vm.exportTestWord();
    f.vm.transcript = 'Later typing must not change the snapshot';
    await operation;
    assert.equal(f.opens[0].snapshot.motherTongue, transcript);
    assert.equal(f.opens[0].snapshot.pronounce, editor.pronounce);
    assert.equal(f.opens[0].snapshot.question, editor.question);
    assert.equal(f.opens[0].snapshot.title, editor.question);
    assert.equal(editor.title, 'Old stored title');
    assert.deepEqual(f.reads, []);
    assert.strictEqual(f.vm.draft, editor);
    assert.deepEqual(editor, before);
    assert.equal(f.vm.transcript, 'Later typing must not change the snapshot');
});

test('Daily Listening unchanged imported transcript preserves its stored HTML in the export snapshot', async () => {
    const f = fixture('DAILY_LISTENING');
    f.vm.originalTranscript = '<p>First <b>line</b>.</p><p>Second line.</p>';
    f.vm.originalTranscriptText = 'First line.Second line.';
    f.vm.transcript = f.vm.originalTranscriptText;
    f.vm.draft.motherTongue = f.vm.originalTranscript;
    await f.vm.exportTestWord();
    assert.equal(f.opens[0].snapshot.motherTongue, f.vm.originalTranscript);
    assert.equal(f.vm.draft.motherTongue, f.vm.originalTranscript);
});

for (const mode of ['READING', 'DAILY_LISTENING']) {
    test(mode + ' blocks duplicate export while loading and while the options dialog remains open', async () => {
        const load = deferred(), dialog = deferred();
        const f = fixture(mode, {read: () => load.promise, open: () => dialog.promise});
        const operation = f.vm.exportTestWord({id: 21});
        assert.equal(f.vm.exportTestWord({id: 22}), undefined);
        assert.equal(f.vm.exportTestWord(), undefined);
        assert.deepEqual(f.reads, [21]);
        load.resolve(f.saved);
        await tick();
        assert.equal(f.opens.length, 1);
        assert.equal(f.vm.exportingWord, true);
        assert.equal(f.vm.exportTestWord({id: 21}), undefined);
        dialog.resolve();
        await operation;
        assert.equal(f.vm.exportingWord, false);
        assert.equal(f.vm.exportingWordId, null);
    });

    test(mode + ' reports loading and exporter failures, resets busy state and allows retry', async () => {
        for (const stage of ['read', 'open']) {
            let failed = true;
            const message = stage === 'read' ? 'Test could not be loaded' : 'Word generation failed';
            let saved;
            const f = fixture(mode, {[stage]: () => failed ? Promise.reject(new Error(message)) : Promise.resolve(stage === 'read' ? saved : undefined)});
            saved = f.saved;
            await f.vm.exportTestWord({id: 21});
            assert.equal(f.errors.length, 1);
            assert.equal(f.errors[0][0], message);
            assert.equal(f.vm.exportingWord, false);
            assert.equal(f.vm.exportingWordId, null);
            assert.equal(f.opens.length, stage === 'read' ? 0 : 1);
            failed = false;
            await f.vm.exportTestWord({id: 21});
            assert.equal(f.opens.length, stage === 'read' ? 1 : 2);
            assert.equal(f.errors.length, 1);
        }
    });

    test(mode + ' silently handles cancel, backdrop and escape without leaving export busy', async () => {
        for (const reason of ['cancel', 'backdrop click', 'escape key press']) {
            const f = fixture(mode, {open: () => Promise.reject(reason)});
            await f.vm.exportTestWord({id: 21});
            assert.deepEqual(f.errors, []);
            assert.equal(f.vm.exportingWord, false);
            assert.equal(f.vm.exportingWordId, null);
        }
    });

    test(mode + ' prevents export during conflicting saves, imports and moves', () => {
        const flags = mode === 'DAILY_LISTENING' ? ['saving', 'editing', 'catalogMovePending', 'importDialogOpen']
            : ['savingReadingTest', 'importingReadingTest', 'catalogMovePending'];
        for (const flag of flags) {
            const f = fixture(mode);
            f.vm[flag] = true;
            assert.equal(f.vm.exportTestWord({id: 21}), undefined, flag);
            assert.equal(f.vm.exportTestWord(), undefined, flag);
            assert.deepEqual(f.reads, []);
            assert.deepEqual(f.opens, []);
        }
        for (const flag of (mode === 'DAILY_LISTENING' ? ['catalogStatusUpdating'] : ['catalogStatusUpdating', 'catalogTitleUpdating'])) {
            const f = fixture(mode);
            f.vm[flag][21] = true;
            assert.equal(f.vm.exportTestWord({id: 21}), undefined, flag);
            assert.deepEqual(f.reads, []);
        }
    });
}

test('Daily Listening catalog rejects a DTO from a different test collection', async () => {
    const f = fixture('DAILY_LISTENING', {read: () => Promise.resolve({id: 21, questionType: {id: 11}, testFormat: 'READING'})});
    await f.vm.exportTestWord({id: 21});
    assert.equal(f.opens.length, 0);
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0][0], /Daily Listening/);
    assert.equal(f.vm.exportingWord, false);
});

test('all builder routes expose both saved-row and unsaved-editor Word export controls', () => {
    const states = {};
    const angular = {module: () => ({filter() { return this; }, config(definition) {
        definition.at(-1)({state(name, configuration) { states[name] = configuration; return this; }});
    }})};
    nodeVm.runInNewContext(read('question/question.module.js'), {angular, Hrm: {}, window: {APP_VERSION: 'test'}});
    for (const state of ['create_ielts_reading_test', 'create_ielts_listening_test', 'create_ielts_writing_test',
        'create_comprehensive_test', 'create_daily_listening_test']) {
        const template = read(states['application.' + state].templateUrl.split('?')[0]);
        for (const expression of ['vm.exportTestWord(item)', 'vm.exportTestWord()']) {
            const controls = template.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
            const button = controls.find(control => control.includes('ng-click="' + expression + '"'));
            assert.ok(button, state + ': ' + expression);
            assert.match(button, /type="button"/);
            assert.match(button, /ng-disabled="[^"]*vm\.exportingWord/);
            assert.match(button, /Xuất Word/);
        }
    }
    assert.match(builder, /'TestWordExport'/);
    assert.match(builder, /'\$q'/);
    assert.match(daily, /'TestWordExport'/);
});
