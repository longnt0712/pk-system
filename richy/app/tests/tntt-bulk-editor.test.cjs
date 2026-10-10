const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../users/controllers/UserController.js'), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));
const students = () => [
    {id: 7, username: 'HS001', person: {lastName: 'Nguyễn', firstName: 'An', birthDate: 1262304000000,
        tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 2, enrollmentClassId: 99}},
    {id: 8, username: 'HS002', person: {displayName: 'Trần Bình',
        tnttMemberType: 'HUYNH_TRUONG', tnttLevel: 4}},
    {id: 9, username: 'HS003'}
];

function setup(users = students()) {
    const calls = [];
    const modalCalls = [];
    const vm = {isIeltsRoomDomain: false, isRoleStudentManagerment: true, users, user: {person: {}}};
    vm.getDisplayedUsers = () => users.slice().reverse();
    const service = {saveTnttProfile: async (id, patch) => {
        calls.push({id, patch: json(patch)});
        return Object.assign({}, users.find(user => user.id === id).person, patch);
    }};
    const context = nodeVm.createContext({vm, service, $scope: {}, $q: {when: () => Promise.resolve()},
        modal: {open: options => {modalCalls.push(options); return {dismiss: () => {vm.dismissed = true;}};}},
        toastr: {success: () => {}, error: () => {}}});
    nodeVm.runInContext(source.slice(source.indexOf('// TNTT profile:'),
        source.indexOf('// End TNTT bulk editor.')), context);
    return {vm, service, calls, modalCalls};
}

test('modal follows displayed order and isolates drafts from personal data', () => {
    const {vm, modalCalls} = setup();
    vm.openTnttBulkModal();
    const rows = vm.tnttBulk.rows;
    assert.deepEqual(Array.from(rows, row => row.username), ['HS003', 'HS002', 'HS001']);
    assert.equal(rows[1].name, 'Trần Bình');
    assert.equal(rows[2].name, 'Nguyễn An');
    assert.equal(rows[2].birthDate, 1262304000000);
    rows[2].profile.tnttLevel = 3;
    assert.equal(vm.users[0].person.tnttLevel, 2);
    assert.equal(vm.tnttChangedCount(), 1);
    vm.closeTnttBulkModal();
    assert.equal(vm.dismissed, true);
    vm.openTnttBulkModal();
    assert.equal(vm.tnttChangedCount(), 0);
    assert.equal(modalCalls[0].templateUrl, 'tntt_bulk_modal.html');
});

test('header toggles a whole column without changing values; individual cells can be unlocked', () => {
    const {vm} = setup(); vm.openTnttBulkModal();
    const original = json(vm.tnttBulk.rows.map(row => row.profile));
    vm.tnttBulk.columns.tnttBranch = true; vm.toggleTnttColumn('tnttBranch');
    assert.ok(vm.tnttBulk.rows.every(row => row.edit.tnttBranch));
    assert.ok(vm.tnttBulk.rows.every(row => !row.edit.tnttMemberType && !row.edit.tnttLevel));
    assert.deepEqual(json(vm.tnttBulk.rows.map(row => row.profile)), original);
    vm.tnttBulk.rows[0].edit.tnttBranch = false; vm.syncTnttColumn('tnttBranch');
    assert.equal(vm.tnttBulk.columns.tnttBranch, false);
    vm.toggleTnttColumn('tnttBranch');
    assert.ok(vm.tnttBulk.rows.every(row => !row.edit.tnttBranch));
    assert.equal(vm.tnttChangedCount(), 0);
});

test('saving patches only changed rows and retains rank reselected after a branch change', async () => {
    const {vm, calls} = setup(); vm.openTnttBulkModal();
    const row = vm.tnttBulk.rows.find(row => row.id === 7);
    row.profile.tnttBranch = 'THIEU_NHI'; vm.changeTnttBranch(row.profile);
    assert.equal(row.profile.tnttLevel, null);
    row.profile.tnttLevel = 2;
    await vm.saveTnttBulk();
    assert.deepEqual(calls, [{id: 7, patch: {tnttBranch: 'THIEU_NHI', tnttLevel: 2}}]);
    assert.equal(vm.users[0].person.tnttBranch, 'THIEU_NHI');
    assert.equal(vm.users[0].person.enrollmentClassId, 99);
    assert.equal(vm.users[0].person.firstName, 'An');
    assert.equal(vm.tnttChangedCount(), 0);
    assert.equal(vm.tnttBulk.completed, 1);
    assert.equal(vm.tnttBulk.saving, false);
    await vm.saveTnttBulk();
    assert.equal(calls.length, 1);
});

test('one master checkbox unlocks every TNTT column and follows individual column changes', () => {
    const {vm} = setup(); vm.openTnttBulkModal();
    const original = json(vm.tnttBulk.rows.map(row => row.profile));
    vm.tnttBulk.editAll = true; vm.toggleTnttEditAll();
    assert.ok(Object.values(vm.tnttBulk.columns).every(Boolean));
    assert.ok(vm.tnttBulk.rows.every(row => Object.values(row.edit).every(Boolean)));
    assert.deepEqual(json(vm.tnttBulk.rows.map(row => row.profile)), original);
    vm.tnttBulk.rows[0].edit.tnttMemberType = false; vm.syncTnttColumn('tnttMemberType');
    assert.equal(vm.tnttBulk.editAll, false);
    vm.tnttBulk.columns.tnttMemberType = true; vm.toggleTnttColumn('tnttMemberType');
    assert.equal(vm.tnttBulk.editAll, true);
    vm.tnttBulk.rows[2].profile.tnttLevel = 3;
    vm.tnttBulk.editAll = false; vm.toggleTnttEditAll();
    assert.ok(vm.tnttBulk.rows.every(row => Object.values(row.edit).every(value => !value)));
    assert.equal(vm.tnttChangedCount(), 1);
});

test('common type, branch and level choices fill the whole table but save only after clicking save', async () => {
    const {vm, calls} = setup(); vm.openTnttBulkModal();
    vm.tnttBulk.editAll = true; vm.toggleTnttEditAll();
    const apply = (field, value) => {vm.tnttBulk.values[field] = value; vm.applyTnttColumnValue(field);};
    apply('tnttMemberType', 'DOAN_SINH');
    assert.equal(vm.tnttBulk.rows[1].profile.tnttLevel, null);
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, 2); // Same member type retains the previous rank.
    apply('tnttBranch', 'AU_NHI');
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, 2); // Same branch also retains its rank.
    apply('tnttBranch', 'NGHIA_SI');
    assert.ok(vm.tnttBulk.rows.every(row => row.profile.tnttLevel === null));
    apply('tnttLevel', 3);
    assert.ok(vm.tnttBulk.rows.every(row => row.profile.tnttMemberType === 'DOAN_SINH'
        && row.profile.tnttBranch === 'NGHIA_SI' && row.profile.tnttLevel === 3));
    assert.equal(vm.tnttChangedCount(), 3);
    assert.equal(calls.length, 0);
    assert.equal(vm.users[0].person.tnttBranch, 'AU_NHI');
    assert.equal(vm.tnttBulk.values.tnttLevel, null); // Allows choosing the same value again.
    await vm.saveTnttBulk();
    assert.equal(calls.length, 3);
    assert.equal(vm.tnttChangedCount(), 0);
    assert.ok(vm.users.every(user => user.person.tnttBranch === 'NGHIA_SI' && user.person.tnttLevel === 3));
});

test('common choices respect branch and leader rules, clear dependent ranks, and reject writes while locked or busy', () => {
    const {vm} = setup(); vm.openTnttBulkModal();
    const apply = (field, value) => {vm.tnttBulk.values[field] = value; vm.applyTnttColumnValue(field);};
    apply('tnttMemberType', 'DOAN_SINH');
    assert.equal(vm.tnttChangedCount(), 0); // Header is still locked.
    vm.tnttBulk.editAll = true; vm.toggleTnttEditAll();
    apply('tnttLevel', 4);
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, 2);
    assert.match(vm.tnttBulk.message, /2 dòng không phù hợp/);
    apply('tnttBranch', 'THIEU_NHI');
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, null);
    assert.equal(vm.tnttBulk.rows[1].profile.tnttBranch, null);
    assert.equal(vm.tnttBulk.rows[0].profile.tnttMemberType, null);
    apply('tnttLevel', 1);
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, 1);
    assert.equal(vm.tnttBulk.rows[1].profile.tnttLevel, 1);
    apply('tnttBranch', '__CLEAR__');
    assert.equal(vm.tnttBulk.rows[2].profile.tnttBranch, null);
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, null);
    apply('tnttLevel', 2);
    assert.equal(vm.tnttBulk.rows[2].profile.tnttLevel, null); // Student still needs a branch.
    apply('tnttLevel', '__CLEAR__');
    assert.equal(vm.tnttBulk.rows[1].profile.tnttLevel, null);
    vm.tnttBulk.saving = true;
    apply('tnttMemberType', '__CLEAR__');
    assert.equal(vm.tnttBulk.rows[1].profile.tnttMemberType, 'HUYNH_TRUONG');
    vm.tnttBulk.saving = false;
    apply('tnttMemberType', '__CLEAR__');
    assert.ok(vm.tnttBulk.rows.every(row => Object.values(row.profile).every(value => value === null)));
});

test('one failed row keeps its draft and retry excludes successfully saved rows', async () => {
    const {vm, service, calls} = setup(); vm.openTnttBulkModal();
    const student = vm.tnttBulk.rows.find(row => row.id === 7);
    const leader = vm.tnttBulk.rows.find(row => row.id === 8);
    student.profile.tnttLevel = 3; leader.profile.tnttLevel = null;
    const save = service.saveTnttProfile;
    let fail = true;
    service.saveTnttProfile = (id, patch) => id === 7 && fail
        ? Promise.reject({data: {message: 'Lỗi kết nối'}}) : save(id, patch);
    await vm.saveTnttBulk();
    assert.equal(leader.saved, true);
    assert.equal(student.error, 'Lỗi kết nối');
    assert.equal(student.profile.tnttLevel, 3);
    assert.equal(vm.tnttChangedCount(), 1);
    assert.equal(vm.tnttBulk.completed, 2);
    assert.match(vm.tnttBulk.message, /1 dòng chưa lưu/);
    fail = false;
    await vm.saveTnttBulk();
    assert.equal(student.error, '');
    assert.deepEqual(calls, [{id: 8, patch: {tnttLevel: null}}, {id: 7, patch: {tnttLevel: 3}}]);
    assert.equal(vm.tnttChangedCount(), 0);
});

test('invalid ranks block writes and busy state prevents duplicate saves or closing', async () => {
    const {vm, calls, service} = setup(); vm.openTnttBulkModal();
    const row = vm.tnttBulk.rows.find(row => row.id === 7);
    row.profile.tnttLevel = 4;
    vm.saveTnttBulk(); assert.equal(calls.length, 0); assert.match(row.error, /không phù hợp/);
    row.profile.tnttLevel = 3;
    let finish;
    const save = service.saveTnttProfile;
    service.saveTnttProfile = (id, patch) => new Promise(resolve => {finish = () => resolve(save(id, patch));});
    const saving = vm.saveTnttBulk();
    await Promise.resolve();
    assert.equal(vm.tnttBulk.saving, true);
    vm.closeTnttBulkModal(); vm.openTnttBulkModal(); vm.saveTnttBulk();
    assert.equal(vm.dismissed, undefined);
    assert.equal(vm.tnttBulk.rows.find(item => item.id === 7), row);
    finish(); await saving;
    assert.equal(calls.length, 1);
});

test('IELTS and unprivileged users cannot open or save the editor; empty lists are safe', () => {
    for (const config of [{isIeltsRoomDomain: true}, {isRoleStudentManagerment: false}]) {
        const {vm, modalCalls} = setup(); Object.assign(vm, config);
        assert.equal(vm.canEditTntt(), false);
        vm.openTnttBulkModal(); vm.saveTnttBulk();
        assert.equal(modalCalls.length, 0);
    }
    const {vm, calls} = setup([]); vm.openTnttBulkModal();
    vm.saveTnttBulk(); assert.equal(calls.length, 0); assert.equal(vm.tnttChangedCount(), 0);
});
