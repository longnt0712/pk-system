const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../users/controllers/UserController.js'), 'utf8');

function setup(ielts = false) {
    const errors = [];
    const vm = {isIeltsRoomDomain: ielts, user: {person: {}}};
    const context = nodeVm.createContext({vm, toastr: {error: message => errors.push(message)}});
    const start = source.indexOf('// TNTT profile:');
    const end = source.indexOf('// End TNTT profile.', start);
    nodeVm.runInContext(source.slice(start, end), context);
    nodeVm.runInContext(source.slice(source.indexOf('vm.exportColumns = ['),
        source.indexOf('vm.exportPreviewRows = []')), context);
    return {vm, errors};
}

test('each student branch supports all three ranks and readable row labels', () => {
    const {vm} = setup();
    assert.deepEqual(Array.from(vm.tnttBranches, item => item.name),
        ['Chiên con', 'Ấu nhi', 'Thiếu nhi', 'Nghĩa sĩ', 'Hiệp sĩ']);
    for (const branch of vm.tnttBranches) for (const level of vm.tnttLevels) {
        vm.user.person = {tnttMemberType: 'DOAN_SINH', tnttBranch: branch.code, tnttLevel: level.value};
        assert.equal(vm.validateTnttProfile(), true);
        assert.equal(vm.getTnttProfileLabel(vm.user), `${branch.name} — ${level.name}`);
    }
});

test('special rank is available only to leaders; a student rank requires a branch', () => {
    const {vm, errors} = setup();
    vm.user.person = {tnttMemberType: 'HUYNH_TRUONG', tnttLevel: 4};
    assert.equal(vm.validateTnttProfile(), true);
    assert.equal(vm.getTnttProfileLabel(vm.user), 'Huynh trưởng — Đặc cấp');
    vm.user.person = {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 4};
    assert.equal(vm.validateTnttProfile(), false);
    vm.user.person = {tnttMemberType: 'DOAN_SINH', tnttLevel: 2};
    assert.equal(vm.validateTnttProfile(), false);
    assert.match(errors.at(-1), /chọn ngành/);
    vm.user.person = {tnttMemberType: 'DU_TRUONG', tnttLevel: 1};
    assert.equal(vm.validateTnttProfile(), false);
});

test('changing a branch or member type clears the previous rank', () => {
    const {vm} = setup();
    vm.user.person = {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 3};
    vm.user.person.tnttBranch = 'THIEU_NHI';
    vm.changeTnttBranch();
    assert.equal(vm.user.person.tnttBranch, 'THIEU_NHI');
    assert.equal(vm.user.person.tnttLevel, null);
    vm.user.person.tnttMemberType = 'HUYNH_TRUONG';
    vm.changeTnttMemberType();
    assert.equal(vm.user.person.tnttBranch, null);
    assert.equal(vm.user.person.tnttLevel, null);
    assert.equal(vm.validateTnttProfile(), true);
});

test('unknown existing profiles and cleared selects send explicit nulls', () => {
    const {vm} = setup();
    assert.equal(vm.getTnttProfileLabel({}), '');
    assert.equal(vm.validateTnttProfile(), true);
    assert.deepEqual(JSON.parse(JSON.stringify(vm.user.person)),
        {tnttMemberType: null, tnttBranch: null, tnttLevel: null});
    vm.user.person = {tnttMemberType: 'TRO_TA'};
    assert.equal(vm.validateTnttProfile(), true);
    assert.equal(vm.getTnttProfileLabel(vm.user), 'Trợ tá');
});

test('sorting follows branch progression and numeric rank', () => {
    const {vm} = setup();
    const rows = [
        {tnttMemberType: 'HUYNH_TRUONG', tnttLevel: 1},
        {tnttMemberType: 'DOAN_SINH', tnttBranch: 'THIEU_NHI', tnttLevel: 1},
        {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 3},
        {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 1}
    ];
    rows.sort((a, b) => vm.getTnttSortValue(a) - vm.getTnttSortValue(b));
    assert.deepEqual(rows.map(person => vm.getTnttProfileLabel({person})),
        ['Ấu nhi — Cấp I', 'Ấu nhi — Cấp III', 'Thiếu nhi — Cấp I', 'Huynh trưởng — Cấp I']);
});

test('exports contain separate type, branch and rank columns only for TNTT', () => {
    const {vm} = setup();
    const user = {person: {tnttMemberType: 'DOAN_SINH', tnttBranch: 'NGHIA_SI', tnttLevel: 2}};
    const columns = Array.from(vm.exportColumns).filter(column => column.key.startsWith('tntt'));
    assert.deepEqual(columns.map(column => column.getter(user)), ['Đoàn sinh', 'Nghĩa sĩ', 'Cấp II']);
    const {vm: ielts} = setup(true);
    assert.equal(ielts.exportColumns.some(column => column.key.startsWith('tntt')), false);
    assert.equal(ielts.validateTnttProfile(), true);
    assert.deepEqual(ielts.user.person, {});
});
