const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');

function setup(candidates = []) {
    let Controller;
    const angular = {
        module: () => ({controller(name, value) { Controller = value; }, directive() {}}),
        copy: structuredClone, isArray: Array.isArray, isUndefined: value => value === undefined,
        forEach(values, callback) { (values || []).forEach(callback); }
    };
    nodeVm.runInNewContext(source, {angular, window: {location: {hostname: 'tnttphungkhoang.com'}}});
    const service = {getResponsibleCandidates: () => Promise.resolve(candidates)};
    return new Controller({settings: {layout: {}}}, {$on() {}, $watchGroup() {}}, {}, {}, service,
        {current: {data: {enrolmentSchoolId: 2}}}, {}, {}, {});
}

const people = [
    {id: 1, username: 'phuongvy', firstName: 'Phương Vy', lastName: 'Hoàng Nguyễn', displayName: 'Phương Vy Hoàng Nguyễn'},
    {id: 2, username: 'gl20240034', firstName: 'Đăng Khoa', lastName: 'Nguyễn Hoàng', displayName: 'Đăng Khoa Nguyễn Hoàng'},
    {id: 3, username: 'dinhduc', firstName: 'Đình Đức', lastName: 'Nguyễn Hoàng', displayName: 'Đình Đức Nguyễn Hoàng'}
];
const expected = ['Hoàng Nguyễn Phương Vy', 'Nguyễn Hoàng Đăng Khoa', 'Nguyễn Hoàng Đình Đức'];

test('class and team responsible names match student-list family/given-name order', () => {
    const vm = setup();
    for (const [index, teacher] of people.entries()) {
        assert.equal(vm.teacherNames({teachers: [teacher], primaryTeacherId: teacher.id}, true), expected[index]);
        assert.equal(vm.teacherNames({teachers: [teacher], primaryTeacherId: null}, false), expected[index]);
    }
});

test('responsible-person choices keep canonical compound names across repeated loads without changing IDs', async () => {
    const candidates = structuredClone(people), vm = setup(candidates);
    await vm.loadTeachers(10, false, 11);
    for (const [index, person] of people.entries()) {
        const candidate = vm.teacherCandidates.find(item => item.id === person.id);
        assert.equal(candidate.displayName, expected[index]);
        assert.equal(candidate.originalDisplayName, person.displayName);
        assert.equal(candidate.username, person.username);
        assert.equal(candidate.firstName, person.firstName);
        assert.equal(candidate.lastName, person.lastName);
    }
    await vm.loadTeachers(10, false, 11);
    assert.deepEqual(Array.from(vm.teacherCandidates, item => item.displayName).sort(), expected.slice().sort());
});

test('full account names follow person fields and fallback-only names are preserved without guessing', () => {
    const vm = setup();
    const name = teacher => vm.teacherNames({teachers: [teacher], primaryTeacherId: teacher.id}, true);
    assert.equal(name({id: 1, person: {lastName: ' Hoàng  Nguyễn ', firstName: 'Phương Vy'},
        firstName: 'stale', lastName: 'stale', displayName: 'Phương Vy Hoàng Nguyễn'}), expected[0]);
    assert.equal(name({id: 2, displayName: 'Nguyễn Hoàng Đăng Khoa'}), expected[1]);
    assert.equal(name({id: 3, displayName: 'Mai Anh'}), 'Mai Anh');
    assert.equal(name({id: 4, username: 'no-profile'}), 'no-profile');
    assert.equal(name({id: 5, person: {lastName: 'Nguyễn', firstName: 'An (Lớp A)'}}), 'Nguyễn An (Lớp A)');
});
