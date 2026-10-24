const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../person_date/controllers/PersonDateController.js'), 'utf8');

function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'Actual controller section exists: ' + start);
    return source.slice(from, to);
}

function setup({schoolId = 2, classId = null, keyword = ''} = {}) {
    const calls = {requests: [], starts: 0, stops: 0, summaries: 0, resets: 0, warnings: [], errors: []};
    const vm = {
        attendanceDate: new Date(2026, 9, 19), directorySchoolId: schoolId,
        pageIndex: 1, pageSize: 1000, personDates: [{id: 99}], totalStudent: 99,
        searchTextClient: keyword,
        searchDto: {schoolId, group: null, groupId: null, user: {person: {enrollmentClassId: classId}}},
        resetSum() { calls.resets++; vm.totalStudent = 0; },
        sortPersonDatesLikeUserTable(rows) { return rows.slice().sort((a, b) => a.id - b.id); }
    };
    const service = {getPage(payload, page, size) {
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        calls.requests.push({payload, page, size, resolve, reject});
        return promise;
    }};
    const context = nodeVm.createContext({vm, service,
        angular: {copy: structuredClone},
        parseDateOnly(value) { return value instanceof Date && !isNaN(value.getTime()) ? new Date(value.getTime()) : null; },
        normalizeId(value) { return value === null || value === undefined || value === '' || isNaN(Number(value)) ? null : Number(value); },
        refreshAttendanceSummary() { calls.summaries++; },
        blockUI: {start() { calls.starts++; }, stop() { calls.stops++; }},
        toastr: {warning(message) { calls.warnings.push(message); }, error(message) { calls.errors.push(message); }},
        console: {error() {}}
    });
    nodeVm.runInContext(section('vm.groupChange = function', 'service.getAllGroups()'), context);
    nodeVm.runInContext(section('var attendanceListRequest =', 'service.getEnrolmentClass('), context);
    return {vm, calls};
}

function selectGroup(h, id, refresh = true) {
    h.vm.searchDto.group = id == null ? null : {id, name: 'Ban ' + id};
    return h.vm.groupChange(refresh);
}

test('a group alone requests its date and school without a class or keyword', async () => {
    const h = setup();
    const selectedDay = h.vm.attendanceDate.getTime();
    const pending = selectGroup(h, '8');
    const request = h.calls.requests[0];
    assert.equal(request.payload.schoolId, 2);
    assert.equal(request.payload.groupId, 8);
    assert.equal(request.payload.user.person.enrollmentClassId, null);
    assert.equal(request.payload.attendanceClassId, null);
    assert.equal(request.payload.textSearch, null);
    assert.equal(request.payload.startDate, selectedDay);
    assert.equal(request.payload.endDate, selectedDay);
    assert.equal(request.page, 1);
    assert.equal(request.size, 1000);
    request.resolve({content: [{id: 3}, {id: 1}], totalElements: 2});
    await pending;
    assert.deepEqual(h.vm.personDates, [{id: 1}, {id: 3}]);
    assert.equal(h.vm.totalStudent, 2);
    assert.equal(h.calls.summaries, 1);
    assert.equal(h.calls.starts, h.calls.stops);
});

test('group filtering preserves a selected class, keyword and the English school scope', async () => {
    const h = setup({schoolId: 1, classId: '14', keyword: '  Maria   An  '});
    const pending = selectGroup(h, 9);
    const request = h.calls.requests[0];
    assert.equal(request.payload.schoolId, 1);
    assert.equal(request.payload.groupId, 9);
    assert.equal(request.payload.user.person.enrollmentClassId, 14);
    assert.equal(request.payload.attendanceClassId, 14);
    assert.equal(request.payload.textSearch, 'Maria An');
    request.resolve({content: [], totalElements: 0});
    await pending;
    assert.equal(h.calls.starts, h.calls.stops);
});

test('no filters leaves an empty table without requesting all attendance', () => {
    const h = setup();
    h.vm.getPage();
    assert.equal(h.vm.personDates.length, 0);
    assert.equal(h.vm.totalStudent, 0);
    assert.equal(h.calls.requests.length, 0);
    assert.equal(h.calls.starts, 0);
    assert.equal(h.calls.stops, 0);
    assert.equal(h.calls.summaries, 1);
});

test('clearing the only group empties previous rows and counters without a new API call', async () => {
    const h = setup();
    const pending = selectGroup(h, 8);
    h.calls.requests[0].resolve({content: [{id: 1}], totalElements: 1});
    await pending;
    selectGroup(h, null);
    assert.equal(h.vm.personDates.length, 0);
    assert.equal(h.vm.totalStudent, 0);
    assert.equal(h.vm.searchDto.groupId, null);
    assert.equal(h.calls.requests.length, 1);
    assert.equal(h.calls.summaries, 2);
    assert.equal(h.calls.starts, h.calls.stops);
});

test('statistics selection only syncs the group while table selection reloads page one', async () => {
    const h = setup();
    h.vm.pageIndex = 4;
    h.vm.searchDto.group = {id: 8, name: 'Ca đoàn'};
    h.vm.groupChange();
    assert.equal(h.vm.searchDto.groupId, 8);
    assert.equal(h.vm.pageIndex, 4);
    assert.equal(h.calls.requests.length, 0);
    const pending = h.vm.groupChange(true);
    assert.equal(h.vm.pageIndex, 1);
    assert.equal(h.calls.requests[0].page, 1);
    h.calls.requests[0].resolve({content: [], totalElements: 0});
    await pending;
    assert.equal(h.calls.starts, h.calls.stops);
});

test('an invalid date blocks group requests without starting the loading overlay', () => {
    const h = setup();
    h.vm.attendanceDate = 'invalid';
    selectGroup(h, 8);
    assert.equal(h.calls.requests.length, 0);
    assert.equal(h.calls.warnings.length, 1);
    assert.equal(h.calls.starts, 0);
    assert.equal(h.calls.stops, 0);
});

test('rapid group changes keep the newest result and ignore an older request failure', async () => {
    const h = setup();
    const first = selectGroup(h, 8), second = selectGroup(h, 9);
    h.calls.requests[1].resolve({content: [{id: 9}], totalElements: 1});
    await second;
    h.calls.requests[0].reject(new Error('Old group request failed'));
    await first;
    assert.deepEqual(h.vm.personDates, [{id: 9}]);
    assert.equal(h.vm.totalStudent, 1);
    assert.equal(h.calls.summaries, 1);
    assert.equal(h.calls.errors.length, 0);
    assert.equal(h.calls.starts, 2);
    assert.equal(h.calls.stops, 2);
});

test('clearing a pending group invalidates its response and each request owns a filter snapshot', async () => {
    const h = setup();
    const pending = selectGroup(h, 8);
    const payload = h.calls.requests[0].payload;
    const selectedDay = payload.startDate;
    assert.notEqual(payload, h.vm.searchDto);
    assert.notEqual(payload.user.person, h.vm.searchDto.user.person);
    h.vm.searchDto.group.name = 'Tên đã đổi';
    selectGroup(h, null);
    h.vm.searchDto.user.person.enrollmentClassId = 14;
    h.vm.searchDto.startDate = 0;
    assert.equal(payload.group.name, 'Ban 8');
    assert.equal(payload.groupId, 8);
    assert.equal(payload.user.person.enrollmentClassId, null);
    assert.equal(payload.startDate, selectedDay);
    h.calls.requests[0].resolve({content: [{id: 8}], totalElements: 1});
    await pending;
    assert.equal(h.vm.personDates.length, 0);
    assert.equal(h.vm.totalStudent, 0);
    assert.equal(h.calls.summaries, 1);
    assert.equal(h.calls.starts, h.calls.stops);
});

test('a current request failure reports the problem and always stops the loading overlay', async () => {
    const h = setup();
    const pending = selectGroup(h, 8);
    h.calls.requests[0].reject(new Error('Offline'));
    await pending;
    assert.equal(h.calls.errors.length, 1);
    assert.equal(h.calls.starts, 1);
    assert.equal(h.calls.stops, 1);
});

test('statistics use the newly selected class and clear an old class scope when selection is cleared', async () => {
    for (const selectedClassId of [200, null]) {
        const calls = [], selectedDate = new Date(2026, 9, 24);
        const vm = {statStartDate: selectedDate, statEndDate: selectedDate,
            searchDto: {schoolId: 2, attendanceClassId: 100, user: {person: {enrollmentClassId: selectedClassId}}},
            updateVisibleStatisticDates() {}};
        const context = nodeVm.createContext({vm, angular: {copy: structuredClone},
            getSearchDateRange: () => ({start: selectedDate, end: selectedDate}),
            normalizeId: value => value == null ? null : Number(value),
            buildDateColumns: () => [], buildStatisticRows: () => [],
            blockUI: {start() {}, stop() {}}, toastr: {warning() {}, error() {}},
            service: {getPage(payload) {calls.push(payload); return Promise.resolve({content: []});}}});
        nodeVm.runInContext(section('vm.loadDailyStatistics = function', 'function buildDateColumns('), context);
        vm.loadDailyStatistics();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, 1);
        assert.equal(calls[0].attendanceClassId, selectedClassId);
        assert.equal(calls[0].user.person.enrollmentClassId, selectedClassId);
        assert.equal(calls[0].schoolId, 2);
        assert.equal(vm.searchDto.attendanceClassId, 100);
    }
});
