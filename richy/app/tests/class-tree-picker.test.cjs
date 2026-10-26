const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../common/directives/ClassTreePicker.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const classes = () => [
    {id: 10, name: 'Ấu Nhi', code: 'AN', schoolId: 2, parentId: null},
    {id: '11', name: 'Lucia - Vâng Lời', code: 'LC', schoolId: 2, parentId: '10'},
    {id: 12, name: 'Mát-ta', schoolId: 2, parentId: 10},
    {id: 20, name: 'Ca đoàn', code: 'CD', schoolId: 2, parentId: null},
    {id: 30, name: 'English', schoolId: 1, parentId: null}
];
function setup(options = {}) {
    let registration, refresh, destroy;
    const angular = {module: () => ({directive(name, value) {registration = value;}}),
        forEach(values, fn) {if (Array.isArray(values)) values.forEach(fn); else Object.keys(values).forEach(key => fn(values[key], key));}};
    nodeVm.runInNewContext(source, {angular});
    const calls = {opened: [], changed: [], closed: 0, dismissed: 0};
    const picker = {classes: classes(), schoolId: 2, ...options};
    const model = {$viewValue: options.selected ?? null, $setViewValue(value) {this.$viewValue = value;}};
    picker.onChange = values => {assert.equal(model.$viewValue, values.selectedId); calls.changed.push(values.selectedId);};
    const scope = {picker, $watchCollection(getter, callback) {refresh = () => callback(getter()); refresh();}, $on(event, fn) {destroy = fn;}};
    const directive = registration.at(-1)({open(config) {
        let resolve, reject;
        const modal = {result: new Promise((yes, no) => {resolve = yes; reject = no;}),
            close() {calls.closed++; resolve();}, dismiss() {calls.dismissed++; reject('cancel');}};
        calls.opened.push({config, modal}); return modal;
    }});
    directive.link(scope, {}, {}, model); model.$render();
    return {picker, model, calls, refresh: () => refresh(), destroy: () => destroy()};
}
const ids = picker => Array.from(picker.rows, row => row.id);

test('every open starts with parent classes only even when a team is selected', async () => {
    const h = setup({selected: 11}); h.picker.open();
    assert.deepEqual(ids(h.picker), [10, 20]);
    h.picker.toggle(h.picker.rows[0]); assert.deepEqual(ids(h.picker), [10, 11, 12, 20]);
    h.calls.opened[0].modal.dismiss(); await tick(); h.picker.open();
    assert.deepEqual(ids(h.picker), [10, 20]);
    assert.equal(h.picker.selectedLabel, 'Ấu Nhi / Lucia - Vâng Lời');
    assert.deepEqual(h.calls.changed, []);
});

test('searching names without accents or a code reveals the matching team and its parent', () => {
    const h = setup();
    for (const query of ['vang loi', 'lc']) {
        h.picker.query = query; h.picker.rebuild(); assert.deepEqual(ids(h.picker), [10, 11]);
        assert.equal(h.picker.rows[0].expanded, true);
    }
    h.picker.query = 'nothing'; h.picker.rebuild(); assert.deepEqual(ids(h.picker), []);
});

test('school and role predicates limit choices before hierarchy construction and selection', () => {
    const h = setup({filterClass: ({item}) => item.id !== 12}); h.picker.open();
    h.picker.toggle(h.picker.rows[0]); assert.deepEqual(ids(h.picker), [10, 11, 20]);
    h.picker.select(30); h.picker.select(12); assert.deepEqual(h.calls.changed, []);
    h.picker.select('11'); assert.equal(h.model.$viewValue, 11); assert.deepEqual(h.calls.changed, [11]);
});

test('selecting and clearing write the model before invoking the existing screen callback', () => {
    const h = setup(); h.picker.open(); h.picker.select(20);
    assert.equal(h.model.$viewValue, 20); assert.equal(h.picker.selectedLabel, 'Ca đoàn');
    h.picker.clear(); assert.equal(h.model.$viewValue, null); assert.equal(h.picker.selectedLabel, '');
    assert.deepEqual(h.calls.changed, [20, null]);
});

test('unsaved marks, loading failures and disabled changes cannot select a class', () => {
    const h = setup({disabled: true}); h.picker.open(); assert.equal(h.calls.opened.length, 0);
    h.picker.disabled = false; h.picker.open();
    h.picker.disabled = true; h.picker.select(20); h.picker.clear();
    h.picker.disabled = false; h.picker.loading = true; h.picker.select(20);
    h.picker.loading = false; h.picker.loadError = true; h.picker.select(20);
    assert.equal(h.model.$viewValue, null); assert.deepEqual(h.calls.changed, []);
});

test('class data changes rebuild the tree and remove choices that are no longer eligible', () => {
    const h = setup(); h.picker.open();
    h.picker.classes = [{id: 40, name: 'New', schoolId: 2}]; h.refresh();
    assert.deepEqual(ids(h.picker), [40]); h.picker.select(10); assert.deepEqual(h.calls.changed, []);
    h.picker.select(40); assert.equal(h.model.$viewValue, 40);
});

test('orphans and legacy cycles terminate without duplicate rows or rewriting names', () => {
    const h = setup({classes: [{id: 1, name: 'Tổ cũ', parentId: 9}, {id: 2, name: 'Cycle A', parentId: 3},
        {id: 3, name: 'Cycle B', parentId: 2}], schoolId: undefined});
    h.picker.expanded = {1: true, 2: true, 3: true}; h.picker.rebuild();
    assert.deepEqual(ids(h.picker), [1, 2, 3]); assert.equal(h.picker.classes[0].name, 'Tổ cũ');
});

test('destroy closes an open modal and never changes the selected value', () => {
    const h = setup({selected: 10}); h.picker.open(); h.destroy(); h.picker.select(20); h.picker.open();
    assert.equal(h.calls.dismissed, 1); assert.equal(h.calls.opened.length, 1);
    assert.equal(h.model.$viewValue, 10); assert.deepEqual(h.calls.changed, []);
});
