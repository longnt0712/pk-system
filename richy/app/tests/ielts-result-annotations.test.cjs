// Run with: node --test richy/app/tests/ielts-result-annotations.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../test_result/controllers/TestResultController.js'), 'utf8');

function setup(width = 1280, height = 800) {
    const vm = {};
    const start = source.indexOf('vm.loadIeltsLearningState = function');
    const end = source.indexOf('vm.formatIeltsActiveDuration = function', start);
    nodeVm.runInNewContext(source.slice(start, end), {vm, window: {innerWidth: width, innerHeight: height}});
    return vm;
}

test('saved notes and offsets survive loading; switching results clears the open note', () => {
    const vm = setup();
    const state = {annotationNotes: [{id: 'note-1', header: 'being attacked', specificNote: 'Ghi chú\nDòng hai'}],
        annotations: [{containerId: 'passage-text-1', start: 20, end: 34, highlighted: true, hasNote: true, noteId: 'note-1'}]};
    vm.activeResultAnnotationNote = {id: 'other-student'};
    vm.loadIeltsLearningState({ieltsLearningState: JSON.stringify(state)});
    assert.deepEqual(JSON.parse(JSON.stringify(vm.ieltsLearningState)), state);
    assert.equal(vm.activeResultAnnotationNote, null);
    vm.activeResultAnnotationNote = vm.ieltsLearningState.annotationNotes[0];
    vm.loadIeltsLearningState({ieltsLearningState: JSON.stringify({annotationNotes: []})});
    assert.equal(vm.activeResultAnnotationNote, null);
    assert.equal(vm.ieltsLearningState.annotationNotes.length, 0);
});

test('old results and malformed learning state remain viewable', () => {
    for (const result of [null, {}, {ieltsLearningState: 'broken JSON'}, {ieltsLearningState: 'null'}]) {
        const vm = setup();
        vm.loadIeltsLearningState(result);
        assert.equal(Object.keys(vm.ieltsLearningState).length, 0);
        assert.equal(vm.activeResultAnnotationNote, null);
    }
});

test('notes open inside the scrollable modal bounds on desktop and mobile', () => {
    for (const [width, height] of [[1280, 800], [390, 650]]) {
        const vm = setup(width, height);
        const bounds = {left: 18, top: 75, right: width - 18, bottom: height - 75};
        const anchor = {left: width - 40, top: height - 110, bottom: height - 85, bounds};
        const note = {id: 'note-1', header: 'selected text', specificNote: 'Student note'};
        vm.openResultAnnotationNote(note, anchor);
        assert.equal(vm.activeResultAnnotationNote, note);
        const style = vm.resultAnnotationNoteStyle;
        assert.ok(parseFloat(style.left) >= bounds.left + 8);
        assert.ok(parseFloat(style.left) + parseFloat(style.width) <= bounds.right - 8);
        const popupTop = parseFloat(style.top) - (style.transform === 'none' ? 0 : parseFloat(style['max-height']));
        assert.ok(popupTop >= bounds.top + 8);
        assert.ok(popupTop + parseFloat(style['max-height']) <= bounds.bottom - 8);
        vm.closeResultAnnotationNote();
        assert.equal(vm.activeResultAnnotationNote, null);
        assert.equal(note.specificNote, 'Student note');
    }
});

test('clicking outside a note closes it without changing the saved text', () => {
    const vm = setup();
    vm.activeResultAnnotationNote = {specificNote: 'Kept'};
    vm.openResultAnnotationNote(null, null);
    assert.equal(vm.activeResultAnnotationNote, null);
});

test('passage events resolve the current saved note and pass plain coordinates through Angular', () => {
    const definitions = {};
    const angular = {isArray: Array.isArray, forEach: (items, fn) => items.forEach(fn),
        module: () => ({controller() {}, directive(name, definition) {definitions[name] = definition;}})};
    nodeVm.runInNewContext(source, {angular});
    const listeners = {}, scrollListeners = {}, calls = [], timers = [];
    const timeout = fn => {timers.push(fn);return fn;};
    timeout.cancel = () => {};
    let state = {annotationNotes: [{id: 9, specificNote: 'First result'}]}, watcher, destroy, unwatched = false;
    const scope = {$eval: () => state, $evalAsync: fn => fn(),
        $watchGroup: (expressions, fn) => {watcher = fn;return () => {unwatched = true;};},
        $on: (event, fn) => {destroy = fn;}};
    const bounds = {left: 20, top: 80, right: 1260, bottom: 700};
    const body = {getBoundingClientRect: () => bounds,
        addEventListener: (name, fn) => {scrollListeners[name] = fn;},
        removeEventListener: name => {delete scrollListeners[name];}};
    const attributes = {'data-note-id': '9'};
    const marker = {textContent: 'selected text', nodeType: 1,
        getBoundingClientRect: () => ({left: 500, top: 350, bottom: 370}),
        classList: {contains: name => name === 'has-note'},
        getAttribute: name => attributes[name], setAttribute: (name, value) => {attributes[name] = value;},
        removeAttribute: name => {delete attributes[name];}};
    const root = {closest: () => body, contains: node => node === marker, querySelectorAll: () => [marker]};
    const element = {0: root, on: (names, fn) => names.split(' ').forEach(name => {listeners[name] = fn;}),
        off: names => names.split(' ').forEach(name => {delete listeners[name];})};
    const definition = definitions.ieltsResultAnnotations;
    const directive = definition.at(-1)(() => (currentScope, locals) => calls.push(locals), timeout);
    directive.link(scope, element, {compile: 'html', ieltsResultAnnotations: 'state', ieltsResultNote: 'open'});
    watcher();timers.shift()();
    assert.equal(attributes.role, 'button');
    assert.equal(attributes.tabindex, '0');
    const event = {type: 'click', target: {closest: () => marker}, preventDefault() {}};
    listeners.click(event);
    assert.equal(calls.at(-1).note.specificNote, 'First result');
    assert.equal(calls.at(-1).anchor.nodeType, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).anchor)), {left: 500, top: 350, bottom: 370, bounds});
    state = {annotationNotes: [{id: 9, specificNote: 'Another student'}]};
    listeners.keydown({...event, type: 'keydown', key: 'Enter'});
    assert.equal(calls.at(-1).note.specificNote, 'Another student');
    listeners.keydown({...event, type: 'keydown', key: 'Escape'});
    assert.equal(calls.at(-1).note, null);
    state = {annotationNotes: []};
    const before = calls.length;
    listeners.click(event);
    assert.equal(calls.length, before, 'a marker without a matching saved note cannot show another note');
    scrollListeners.wheel();assert.equal(calls.at(-1).note, null);
    destroy();
    assert.equal(unwatched, true);
    assert.deepEqual(Object.keys(listeners), []);
    assert.deepEqual(Object.keys(scrollListeners), []);
});
