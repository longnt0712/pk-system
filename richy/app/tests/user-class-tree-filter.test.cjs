const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../users/controllers/UserController.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'Actual User controller section exists: ' + start);
    return source.slice(from, to);
}

function setup(schoolId = 2) {
    const calls = {loads: [], requests: []};
    const vm = {
        directorySchoolId: schoolId, isIeltsRoomDomain: schoolId === 1,
        showUnassignedStudents: false, pageIndex: 4, pageSize: 25,
        enrollmentClasses: [], filter: {active: true, groups: [{id: 8}], roles: [], keyword: ' Maria '},
        advancedSearchApplied: {active: true, schoolId, classIds: [99]},
        appliedCreatedDateFrom: 10, appliedCreatedDateTo: 20
    };
    const service = {
        getEnrollmentClassTree(id) {
            let resolve, reject;
            const result = new Promise((yes, no) => { resolve = yes; reject = no; });
            calls.loads.push({schoolId: id, resolve, reject}); return result;
        },
        getUsers(filter, pageIndex, pageSize) {
            calls.requests.push({filter, pageIndex, pageSize});
            return Promise.resolve({content: [], totalElements: 0});
        }
    };
    const context = nodeVm.createContext({vm, service, console: {log() {}},
        angular: {copy: structuredClone, isArray: Array.isArray,
            forEach(values, callback) {
                if (Array.isArray(values)) values.forEach(callback);
                else if (values) Object.keys(values).forEach(key => callback(values[key], key));
            }},
        toCalendarDate: value => new Date(value)
    });
    for (const [start, end] of [
        ['vm.filterQuickEnrollmentClass = function', 'vm.user = {};'],
        ['vm.enrollmentClassesLoading = false;', 'vm.findEnrollmentClass = function'],
        ['vm.getClassAndDescendantIds = function', 'vm.genders ='],
        ['function getDirectorySearchRoles()', 'function isEducationManagedRole'],
        ['vm.getUsers = function', 'function toCalendarDate'],
        ['vm.hasAnyFilterValue = function', 'vm.syncModalEnrollmentClassToFilter ='],
        ['vm.search = function', 'vm.searchByCreatedDate =']
    ]) nodeVm.runInContext(section(start, end), context);
    return {vm, calls};
}

function tree(schoolId) {
    return [{id: 10, name: 'Lớp A', schoolId, parentId: null},
        {id: 11, name: 'Đội Lucia', schoolId, parentId: 10},
        {id: 111, name: 'Tổ 1 (a3)', schoolId, parentId: 11}];
}

test('User class picker loader retains the domain school and builds existing class paths', async () => {
    for (const schoolId of [1, 2]) {
        const h = setup(schoolId);
        h.vm.filter.enrollmentClass = 11;
        assert.equal(h.calls.loads[0].schoolId, schoolId);
        h.calls.loads[0].resolve(tree(schoolId)); await tick();
        assert.equal(h.vm.enrollmentClassesLoading, false);
        assert.equal(h.vm.enrollmentClassesError, false);
        assert.equal(h.vm.filter.enrollmentClass, 11);
        assert.equal(h.vm.enrollmentClasses.find(item => item.id === 111).treeLabel, 'Lớp A / Đội Lucia / Tổ 1 (a3)');
        assert.equal(h.calls.requests.length, 0);
        assert.equal(h.vm.filterQuickEnrollmentClass({schoolId}), true);
        assert.equal(h.vm.filterQuickEnrollmentClass({schoolId: schoolId === 1 ? 2 : 1}), false);
    }
});

test('selecting a quick class clears only conflicting advanced filters and searches its descendants', async () => {
    const h = setup(); h.calls.loads[0].resolve(tree(2)); await tick();
    h.vm.filter.enrollmentClass = 10;
    h.vm.searchByQuickEnrollmentClass();
    const request = h.calls.requests[0];
    assert.equal(request.filter.schoolId, 2);
    assert.equal(request.filter.enrollmentClass, 10);
    assert.deepEqual(Array.from(request.filter.enrollmentClassIds), [10, 11, 111]);
    assert.deepEqual(request.filter.groups, [{id: 8}]);
    assert.equal(request.filter.keyword, 'Maria');
    assert.equal(request.filter.active, true);
    assert.equal(request.filter.startDate, null);
    assert.equal(request.filter.endDate, null);
    assert.equal(h.vm.advancedSearchApplied.active, false);
    assert.equal(request.pageIndex, 1);
    assert.equal(request.pageSize, 1000);
});

test('selecting a team or clearing the quick picker preserves other filters and English scope', async () => {
    const h = setup(1); h.calls.loads[0].resolve(tree(1)); await tick();
    h.vm.filter.enrollmentClass = 11; h.vm.searchByQuickEnrollmentClass();
    assert.equal(h.calls.requests[0].filter.schoolId, 1);
    assert.deepEqual(Array.from(h.calls.requests[0].filter.enrollmentClassIds), [11, 111]);
    h.vm.filter.enrollmentClass = null; h.vm.searchByQuickEnrollmentClass();
    assert.equal(h.calls.requests[1].filter.enrollmentClass, null);
    assert.equal(h.calls.requests[1].filter.enrollmentClassIds.length, 0);
    assert.deepEqual(h.calls.requests[1].filter.groups, [{id: 8}]);
    assert.equal(h.calls.requests[1].filter.keyword, 'Maria');
});

test('failed class loads preserve current filters, expose retry and avoid duplicate pending calls', async () => {
    const h = setup(); h.vm.filter.enrollmentClass = 11;
    h.vm.loadEnrollmentClasses();
    assert.equal(h.calls.loads.length, 1);
    h.calls.loads[0].reject(new Error('Offline')); await tick();
    assert.equal(h.vm.enrollmentClassesError, true);
    assert.equal(h.vm.enrollmentClassesLoading, false);
    assert.equal(h.vm.filter.enrollmentClass, 11);
    const retry = h.vm.loadEnrollmentClasses();
    assert.equal(h.vm.enrollmentClassesError, false);
    h.calls.loads[1].resolve(tree(2)); await retry;
    assert.equal(h.vm.enrollmentClassesError, false);
    assert.equal(h.vm.enrollmentClassesLoading, false);
    assert.equal(h.calls.requests.length, 0);
});
