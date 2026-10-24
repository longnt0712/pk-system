const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../person_date/controllers/PersonDateController.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'Actual controller section exists: ' + start);
    return source.slice(from, to);
}

function assignment(start) {
    return section(start, '\n        };') + '\n        };';
}

function classes() {
    return [
        {id: 10, name: 'ẤU NHI 1', code: 'AN1', schoolId: 2, parentId: null},
        {id: '11', name: 'Đội Lucia', code: 'LC1', schoolId: 2, parentId: '10'},
        {id: 111, name: 'Đội Hoa Hồng', code: 'HH1', schoolId: 2, parentId: 11},
        {id: 12, name: 'Đội Mát-ta', code: 'MT1', schoolId: 2, parentId: 10},
        {id: 20, name: 'CA ĐOÀN', code: 'CD', schoolId: 2, parentId: null},
        {id: 30, name: 'Đội lẻ', schoolId: 2, parentId: 999},
        {id: 31, name: 'Đội khác trường cha', schoolId: 2, parentId: 40},
        {id: 40, name: 'English class', schoolId: 1, parentId: null},
        {id: 50, name: 'Đội tự trỏ', schoolId: 2, parentId: 50},
        {id: 60, name: 'Đội vòng A', schoolId: 2, parentId: 61},
        {id: 61, name: 'Đội vòng B', schoolId: 2, parentId: 60}
    ];
}

function setup({schoolId = 2, classId = null, data = classes()} = {}) {
    const calls = {loads: [], modals: [], refreshes: 0, closes: 0, warnings: []};
    const vm = {
        directorySchoolId: schoolId, pageIndex: 4, enrollmentClasses: structuredClone(data), enrollmentClassMap: {},
        searchDto: {schoolId, attendanceClassId: classId, groupId: 8, user: {person: {enrollmentClassId: classId}}},
        searchTextClient: 'Maria', classFilterSearch: '', classFilterRows: [],
        classFilterExpanded: {}, classFilterModalInstance: null,
        getPage() { calls.refreshes++; return Promise.resolve(); }
    };
    const service = {getEnrolmentClass(filter, page, size) {
        let resolve, reject;
        const result = new Promise((yes, no) => { resolve = yes; reject = no; });
        calls.loads.push({filter, page, size, resolve, reject}); return result;
    }};
    const modal = {open(options) {
        let resolve, reject;
        const result = new Promise((yes, no) => { resolve = yes; reject = no; });
        const instance = {result, close() { calls.closes++; resolve(); }, dismiss() { reject('cancel'); }};
        calls.modals.push({options, instance}); return instance;
    }};
    const context = nodeVm.createContext({vm, service, modal, $scope: {},
        angular: {copy: structuredClone, isArray: Array.isArray,
            forEach(values, callback) {
                if (Array.isArray(values)) values.forEach(callback);
                else if (values) Object.keys(values).forEach(key => callback(values[key], key));
            }},
        toastr: {warning(message) { calls.warnings.push(message); }, error(message) { calls.warnings.push(message); }},
        console: {error() {}}
    });
    nodeVm.runInContext(section('function normalizeId(', 'function getDirectorySchoolParentClasses('), context);
    nodeVm.runInContext(assignment('vm.loadEnrollmentClasses = function'), context);
    return {vm, calls};
}

function expandAll(h) {
    h.vm.enrollmentClasses.forEach(item => { h.vm.classFilterExpanded[item.id] = true; });
    h.vm.rebuildClassFilterTree();
}

function ids(vm) { return Array.from(vm.classFilterRows, row => Number(row.id)); }

test('class picker builds a same-school hierarchy with normalized IDs and visits malformed links once', () => {
    const h = setup(); expandAll(h);
    assert.deepEqual(ids(h.vm).slice().sort((a, b) => a - b), [10, 11, 12, 20, 30, 31, 50, 60, 61, 111]);
    const rows = h.vm.classFilterRows;
    const parent = rows.find(row => Number(row.id) === 10);
    const child = rows.find(row => Number(row.id) === 11);
    const descendant = rows.find(row => Number(row.id) === 111);
    assert.equal(parent.level, 0);
    assert.equal(child.level, 1);
    assert.equal(descendant.level, 2);
    assert.equal(rows.find(row => Number(row.id) === 30).level, 0);
    assert.equal(rows.find(row => Number(row.id) === 31).level, 0);
    assert.equal(new Set(ids(h.vm)).size, rows.length);
});

test('accent-insensitive name and code searches retain ancestors and reveal matching teams', () => {
    const h = setup();
    h.vm.classFilterSearch = 'hoa hong'; h.vm.rebuildClassFilterTree();
    assert.deepEqual(ids(h.vm), [10, 11, 111]);
    h.vm.classFilterSearch = 'lc1'; h.vm.rebuildClassFilterTree();
    assert.deepEqual(ids(h.vm), [10, 11]);
    h.vm.classFilterSearch = 'no matching class'; h.vm.rebuildClassFilterTree();
    assert.equal(h.vm.classFilterRows.length, 0);
});

test('collapsing a class hides its descendants and expanding restores them', () => {
    const h = setup(); expandAll(h);
    const root = h.vm.classFilterRows.find(row => Number(row.id) === 10);
    h.vm.toggleClassFilterNode(root);
    assert.ok(ids(h.vm).includes(10));
    assert.ok(!ids(h.vm).includes(11));
    assert.ok(!ids(h.vm).includes(111));
    h.vm.toggleClassFilterNode(root);
    assert.ok(ids(h.vm).includes(11));
    assert.ok(ids(h.vm).includes(111));
});

test('selected team label includes the canonical class and team path without changing user names', () => {
    const h = setup({classId: '111'});
    const label = h.vm.classFilterLabel();
    assert.ok(label.includes('ẤU NHI 1'));
    assert.ok(label.includes('Đội Lucia'));
    assert.ok(label.includes('Đội Hoa Hồng'));
    assert.ok(label.indexOf('ẤU NHI 1') < label.indexOf('Đội Lucia'));
    assert.ok(label.indexOf('Đội Lucia') < label.indexOf('Đội Hoa Hồng'));
    assert.equal(h.vm.enrollmentClasses.find(item => item.id === 111).name, 'Đội Hoa Hồng');
});

test('main picker selection sets both class scopes, resets pagination, closes and reloads once', async () => {
    const h = setup(); expandAll(h);
    h.vm.openClassFilter(true);
    expandAll(h);
    const row = h.vm.classFilterRows.find(item => Number(item.id) === 11);
    h.vm.selectClassFilter(row); await tick();
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    assert.equal(h.vm.searchDto.attendanceClassId, 11);
    assert.equal(h.vm.pageIndex, 1);
    assert.equal(h.calls.closes, 1);
    assert.equal(h.calls.refreshes, 1);
    assert.equal(h.vm.searchDto.groupId, 8);
    assert.equal(h.vm.searchTextClient, 'Maria');
});

test('statistics selection updates the class scope and waits for the statistics button', async () => {
    const h = setup(); expandAll(h);
    h.vm.openClassFilter(false);
    const row = h.vm.classFilterRows.find(item => Number(item.id) === 20);
    h.vm.selectClassFilter(row); await tick();
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 20);
    assert.equal(h.vm.searchDto.attendanceClassId, 20);
    assert.equal(h.vm.pageIndex, 1);
    assert.equal(h.calls.closes, 1);
    assert.equal(h.calls.refreshes, 0);
});

test('clearing either picker keeps group and keyword filters and obeys its reload policy', () => {
    for (const refresh of [true, false]) {
        const h = setup({classId: 11});
        h.vm.clearClassFilter(refresh);
        assert.equal(h.vm.searchDto.user.person.enrollmentClassId, null);
        assert.equal(h.vm.searchDto.attendanceClassId, null);
        assert.equal(h.vm.pageIndex, 1);
        assert.equal(h.vm.searchDto.groupId, 8);
        assert.equal(h.vm.searchTextClient, 'Maria');
        assert.equal(h.calls.refreshes, refresh ? 1 : 0);
    }
});

test('class loader requests the current school and does not fetch attendance or erase an existing choice', async () => {
    for (const schoolId of [1, 2]) {
        const h = setup({schoolId, classId: schoolId === 1 ? 40 : 11, data: []});
        const selected = h.vm.searchDto.user.person.enrollmentClassId;
        const pending = h.vm.loadEnrollmentClasses();
        assert.equal(h.calls.loads.length, 1);
        assert.equal(h.calls.loads[0].filter.schoolId, schoolId);
        h.calls.loads[0].resolve({content: classes()}); await pending; await tick();
        assert.equal(h.vm.searchDto.user.person.enrollmentClassId, selected);
        assert.equal(h.calls.refreshes, 0);
        expandAll(h);
        assert.ok(h.vm.classFilterRows.every(row => classes().some(item => Number(item.id) === Number(row.id) && item.schoolId === schoolId)));
    }
});

test('canceling the picker preserves the current selection and opening again is possible', async () => {
    const h = setup({classId: 11});
    h.vm.openClassFilter(true);
    h.vm.openClassFilter(true);
    assert.equal(h.calls.modals.length, 1);
    assert.ok(!ids(h.vm).includes(11), 'A previously selected team stays collapsed until expanded or searched');
    h.calls.modals[0].instance.dismiss(); await tick();
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    assert.equal(h.vm.searchDto.attendanceClassId, 11);
    assert.equal(h.calls.refreshes, 0);
    h.vm.openClassFilter(false);
    assert.equal(h.calls.modals.length, 2);
});

test('every picker open starts with only parent classes even after selecting a team or expanding before', async () => {
    const h = setup({classId: 11, data: classes().filter(item => [10, 11, 111, 12, 20].includes(Number(item.id)))});
    h.vm.openClassFilter(true);
    assert.deepEqual(ids(h.vm).slice().sort((a, b) => a - b), [10, 20]);
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    const parent = h.vm.classFilterRows.find(row => row.id === 10);
    h.vm.toggleClassFilterNode(parent);
    assert.ok(ids(h.vm).includes(11));
    h.calls.modals[0].instance.dismiss(); await tick();
    h.vm.openClassFilter(false);
    assert.deepEqual(ids(h.vm).slice().sort((a, b) => a - b), [10, 20]);
    assert.equal(Object.keys(h.vm.classFilterExpanded).length, 0);
    h.vm.classFilterSearch = 'hoa hong'; h.vm.rebuildClassFilterTree();
    assert.deepEqual(ids(h.vm), [10, 11, 111]);
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    assert.equal(h.calls.refreshes, 0);
});

test('foreign, stale, loading or failed class selections cannot change attendance scope', () => {
    const h = setup({classId: 11});
    h.vm.openClassFilter(true);
    for (const row of [{id: 40}, {id: 999}, null]) h.vm.selectClassFilter(row);
    h.vm.enrollmentClassesLoading = true; h.vm.selectClassFilter({id: 20});
    h.vm.enrollmentClassesLoading = false;
    h.vm.enrollmentClassesError = true; h.vm.selectClassFilter({id: 20});
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    assert.equal(h.vm.searchDto.attendanceClassId, 11);
    assert.equal(h.calls.refreshes, 0);
    assert.equal(h.calls.closes, 0);
});

test('failed class loads can be retried and concurrent opens do not duplicate the request', async () => {
    const h = setup({classId: 11});
    const first = h.vm.loadEnrollmentClasses();
    h.vm.loadEnrollmentClasses();
    assert.equal(h.calls.loads.length, 1);
    h.calls.loads[0].reject(new Error('Offline')); await first;
    assert.equal(h.vm.enrollmentClassesError, true);
    assert.equal(h.vm.enrollmentClassesLoading, false);
    assert.equal(h.vm.searchDto.user.person.enrollmentClassId, 11);
    const retry = h.vm.loadEnrollmentClasses();
    assert.equal(h.vm.enrollmentClassesError, false);
    h.calls.loads[1].resolve({content: classes()}); await retry;
    assert.equal(h.vm.enrollmentClassesLoading, false);
    assert.equal(h.vm.enrollmentClassesError, false);
    assert.equal(h.calls.refreshes, 0);
});
