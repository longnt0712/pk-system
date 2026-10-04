// Run with: node --test richy/app/tests/unassigned-students.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../users/controllers/UserController.js'), 'utf8');

function setup(hostname = 'ieltsroom.com') {
    const requests = [];
    const vm = {
        filter: {keyword: '', active: true, roles: [], groups: []},
        showUnassignedStudents: false,
        advancedSearchApplied: {active: false, classIds: []},
        pageIndex: 3, pageSize: 25,
        getClassAndDescendantIds: id => id == null ? [] : [id, id + 1]
    };
    const context = nodeVm.createContext({
        vm, window: {location: {hostname}}, console: {log() {}},
        angular: {copy: value => JSON.parse(JSON.stringify(value)), isArray: Array.isArray},
        toCalendarDate: value => new Date(value),
        service: {getUsers(filter, pageIndex, pageSize) {
            requests.push({filter, pageIndex, pageSize});
            return Promise.resolve({content: [{id: 7}], totalElements: 1});
        }}
    });
    for (const [start, end] of [
        ['function isIeltsRoomDomain()', '// window.addEventListener'],
        ['vm.changeInactiveUsersVisibility =', 'vm.filterQuickEnrollmentClass ='],
        ['function getDirectorySearchRoles()', 'function isEducationManagedRole'],
        ['vm.getUsers = function', 'function toCalendarDate'],
        ['vm.hasAnyFilterValue =', 'vm.syncModalEnrollmentClassToFilter ='],
        ['vm.search = function', 'vm.searchByCreatedDate =']
    ]) {
        nodeVm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
    }
    return {vm, requests};
}

test('checking the filter loads unassigned students from page one and removes conflicting class filters', async () => {
    const {vm, requests} = setup();
    vm.filter.keyword = '  Nguyễn   An  ';
    vm.filter.enrollmentClass = 13;
    vm.advancedSearchApplied = {active: true, classIds: [13, 14]};
    vm.appliedCreatedDateFrom = Date.now();
    vm.appliedCreatedDateTo = Date.now();
    vm.showUnassignedStudents = true;
    vm.changeUnassignedStudentsVisibility();
    await Promise.resolve();
    const request = requests[0];
    assert.equal(request.filter.schoolId, 1);
    assert.equal(request.filter.withoutEnrollmentClass, true);
    assert.equal(request.filter.enrollmentClass, null);
    assert.equal(request.filter.enrollmentClassIds.length, 0);
    assert.equal(request.filter.keyword, 'Nguyễn An');
    assert.equal(request.filter.active, true);
    assert.equal(request.filter.startDate, null);
    assert.equal(request.filter.endDate, null);
    assert.equal(request.pageIndex, 1);
    assert.equal(request.pageSize, 1000);
    assert.equal(vm.advancedSearchApplied.active, false);
    assert.equal(vm.users.totalElement, 1);
});

test('unchecking the filter returns to the regular IELTS directory', () => {
    const {vm, requests} = setup('www.ieltsroom.com');
    vm.showUnassignedStudents = true;
    vm.changeUnassignedStudentsVisibility();
    vm.showUnassignedStudents = false;
    vm.changeUnassignedStudentsVisibility();
    assert.equal(requests[1].filter.withoutEnrollmentClass, false);
    assert.equal(requests[1].filter.schoolId, 1);
    assert.equal(requests[1].pageSize, 25);
});

test('other domains cannot send the IELTS unassigned-student filter', () => {
    for (const host of ['tnttphungkhoang.com', 'localhost', 'ieltsroom.com.other.example']) {
        const {vm, requests} = setup(host);
        vm.filter.enrollmentClass = 13;
        vm.showUnassignedStudents = true;
        vm.changeUnassignedStudentsVisibility();
        assert.equal(requests[0].filter.withoutEnrollmentClass, false);
        assert.equal(requests[0].filter.schoolId, 2);
        assert.equal(requests[0].filter.enrollmentClass, 13);
        assert.equal(requests[0].filter.enrollmentClassIds.length, 2);
    }
});

test('the inactive-account option and keyword search still combine with unassigned students', () => {
    const {vm, requests} = setup();
    vm.showUnassignedStudents = true;
    vm.showInactiveUsers = true;
    vm.filter.keyword = 'hs001';
    vm.changeInactiveUsersVisibility();
    assert.equal(requests[0].filter.withoutEnrollmentClass, true);
    assert.equal(requests[0].filter.active, null);
    assert.equal(requests[0].filter.keyword, 'hs001');
    vm.showInactiveUsers = false;
    vm.changeInactiveUsersVisibility();
    assert.equal(requests[1].filter.active, true);
});

test('request construction suppresses stale class selections without changing stored filters', () => {
    const {vm, requests} = setup();
    vm.showUnassignedStudents = true;
    vm.filter.enrollmentClass = 13;
    vm.advancedSearchApplied = {active: true, classIds: [13, 14]};
    vm.getUsers();
    assert.equal(requests[0].filter.enrollmentClass, null);
    assert.equal(requests[0].filter.enrollmentClassIds.length, 0);
    assert.equal(vm.filter.enrollmentClass, 13);
    assert.equal(vm.advancedSearchApplied.classIds.length, 2);
});
