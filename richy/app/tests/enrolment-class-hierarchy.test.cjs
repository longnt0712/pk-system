const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function setup(schoolId = 2, classes = []) {
    let Controller;
    const calls = {candidates: [], modals: [], saves: [], trees: [], closed: 0, warnings: []};
    const settings = {layout: {}, permissionsLoaded: true, isAdmin: true};
    const angular = {
        module: () => ({controller(name, value) { Controller = value; }, directive() {}}),
        copy: structuredClone,
        isArray: Array.isArray,
        isUndefined: value => value === undefined,
        noop() {},
        forEach(values, callback) {
            if (Array.isArray(values)) { values.forEach(callback); }
            else if (values) { Object.keys(values).forEach(key => callback(values[key], key)); }
        }
    };
    nodeVm.runInNewContext(source, {angular, window: {location: {hostname: schoolId === 1 ? 'ieltsroom.com' : 'tnttphungkhoang.com'}}});
    const rows = structuredClone(classes).map(item => ({schoolId, teachers: [], ...item}));
    const service = {
        getResponsibleCandidates(...args) { calls.candidates.push(args); return Promise.resolve([]); },
        getOne(id) { return Promise.resolve(rows.find(item => String(item.id) === String(id))); },
        getTree(id) { calls.trees.push(id); return Promise.resolve(rows); },
        saveObject(payload) { calls.saves.push(plain(payload)); return Promise.resolve(true); }
    };
    const modal = {open(options) {
        calls.modals.push(options);
        return {close() { calls.closed++; }, result: new Promise(() => {})};
    }};
    const state = {current: {name: schoolId === 1 ? 'application.englishClass' : 'application.class', data: {enrolmentSchoolId: schoolId}}, href() { return ''; }};
    const scope = {$on() {}, $watchGroup() {}, $evalAsync(callback) { callback(); }};
    const toastr = {warning(message) { calls.warnings.push(message); }, error() {}, success() {}};
    const vm = new Controller({settings}, scope, toastr, modal, service, state, {}, {}, {});
    vm.allClasses = rows;
    return {vm, rows, calls};
}

function tree() {
    return [
        {id: 10, name: 'Lớp A', parentId: null, childCount: 1, canEdit: true, canAddChild: true},
        {id: 20, name: 'Lớp B', parentId: null, childCount: 0, canEdit: true, canAddChild: true},
        {id: 30, name: 'Lớp không được tạo đội', parentId: null, canEdit: false, canAddChild: false},
        {id: 11, name: 'Đội A', parentId: 10, childCount: 1, canEdit: true, canAddChild: true},
        {id: 12, name: 'Đội khác', parentId: 10, canEdit: true, canAddChild: true},
        {id: 111, name: 'Tổ 1 (a3)', parentId: 11, canEdit: true, canAddChild: true}
    ];
}

function parentIds(vm) {
    return Array.from(vm.availableParents(), item => String(item.id));
}

function editor(vm, value) {
    vm.showEditor({name: 'Tên giữ nguyên', schoolId: vm.schoolId, parentId: null, teacherIds: [], ...value});
    vm.teacherCandidates = [{id: 1}, {id: 2}];
}

test('church parent choices allow permitted classes and exclude team parents', () => {
    const {vm} = setup(2, tree());
    editor(vm, {isNew: true});
    assert.deepEqual(parentIds(vm), ['10', '20']);
    editor(vm, {id: 20});
    assert.deepEqual(parentIds(vm), ['10']);
});

test('an unchanged legacy team parent remains available across numeric/string IDs', () => {
    const {vm} = setup(2, tree());
    editor(vm, {id: 111, name: 'Tổ 1 (a3)', parentId: '11'});
    assert.deepEqual(parentIds(vm), ['10', '20', '11']);
    assert.equal(vm.enrolmentClass.parentId, '11');
    assert.equal(vm.enrolmentClass.name, 'Tổ 1 (a3)');
    editor(vm, {id: 20, parentId: '30'});
    assert.deepEqual(parentIds(vm), ['10', '30']);
});

test('English parent choices preserve nested teams and existing permission/cycle exclusions', () => {
    const {vm} = setup(1, tree());
    editor(vm, {isNew: true});
    assert.deepEqual(parentIds(vm), ['10', '20', '11', '12', '111']);
    editor(vm, {id: '11', parentId: '30'});
    assert.deepEqual(parentIds(vm), ['10', '20', '30', '12']);
});

test('descendants remain excluded even when an intermediate parent is not editable', () => {
    const rows = tree().map(item => item.id === 11 ? {...item, canAddChild: false} : item);
    const {vm} = setup(1, rows);
    editor(vm, {id: '10'});
    assert.deepEqual(parentIds(vm), ['20']);
});

test('a church class with children cannot be moved underneath another class', async () => {
    for (const evidence of ['loaded child', 'server child count']) {
        const rows = evidence === 'loaded child' ? tree().map(item => ({...item, childCount: 0})) : tree().filter(item => item.id === 10 || item.id === 20);
        const {vm, calls} = setup(2, rows);
        editor(vm, {id: '10', parentId: null, primaryTeacherId: 1, deputyTeacherIds: [], childCount: evidence === 'server child count' ? 1 : 0});
        assert.deepEqual(parentIds(vm), [], evidence);
        vm.enrolmentClass.parentId = 20;
        vm.saveObject();
        await tick();
        assert.equal(calls.saves.length, 0, evidence);
        assert.ok(calls.warnings.length, evidence);
    }
});

test('creating a church team under a team is blocked before candidates or a modal load', async () => {
    const church = setup(2, tree());
    church.vm.openEditor(null, 11);
    await tick();
    assert.equal(church.calls.candidates.length, 0);
    assert.equal(church.calls.modals.length, 0);
    assert.ok(church.calls.warnings.length);

    church.vm.openEditor(null, 30);
    await tick();
    assert.equal(church.calls.candidates.length, 0);
    assert.equal(church.calls.modals.length, 0);

    church.vm.openEditor(null, 10);
    await tick();
    assert.equal(church.calls.candidates.length, 1);
    assert.equal(church.calls.modals.length, 1);
    assert.equal(church.vm.enrolmentClass.parentId, 10);

    const english = setup(1, tree());
    english.vm.openEditor(null, 11);
    await tick();
    assert.equal(english.calls.candidates.length, 1);
    assert.equal(english.calls.modals.length, 1);
    assert.equal(english.vm.enrolmentClass.parentId, 11);
});

test('a stale, forbidden, team, or self church parent is rejected before the save API', async () => {
    for (const parentId of [999, 30, 11, 20]) {
        const {vm, calls} = setup(2, tree());
        editor(vm, {id: 20, parentId: null, primaryTeacherId: 1, deputyTeacherIds: []});
        vm.enrolmentClass.parentId = parentId;
        vm.saveObject();
        await tick();
        assert.equal(calls.saves.length, 0, 'parent ' + parentId);
        assert.ok(calls.warnings.length, 'parent ' + parentId);
        assert.equal(vm.saving, false);
    }
});

test('valid class and team saves retain their names, parent IDs and responsible-person payload', async () => {
    for (const [schoolId, parentId] of [[2, null], [2, '10'], [1, 11]]) {
        const {vm, calls} = setup(schoolId, tree());
        const value = {name: 'Tên người dùng giữ nguyên', code: 'A3', parentId, primaryTeacherId: 1, deputyTeacherIds: [2]};
        editor(vm, value);
        vm.saveObject();
        await tick();
        assert.equal(calls.saves.length, 1);
        assert.deepEqual(calls.saves[0], {...value, schoolId, teacherIds: [2, 1], isNew: true});
        assert.equal(calls.closed, 1);
        assert.deepEqual(calls.trees, [schoolId]);
    }
});

test('editing an old nested team saves its unchanged legacy relationship without rewriting user data', async () => {
    const {vm, calls} = setup(2, tree());
    editor(vm, {id: 111, name: 'Tổ 1 (a3)', parentId: '11', primaryTeacherId: 1, deputyTeacherIds: [2]});
    vm.saveObject();
    await tick();
    assert.equal(calls.saves.length, 1);
    assert.equal(calls.saves[0].parentId, '11');
    assert.equal(calls.saves[0].name, 'Tổ 1 (a3)');
    assert.deepEqual(calls.saves[0].teacherIds, [2, 1]);
});
