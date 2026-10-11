const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../person_date/controllers/PersonDateController.js'), 'utf8');
const defaults = {massStartTime: '08:00', massLateMinutes: 5, massAutoLate: true,
    classStartTime: '09:00', classLateMinutes: 15, classAutoLate: false, qrSwitchTime: '09:00'};
const copy = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({time = '08:00:00', manager = true, loadError = null, savedQr = null, saveError = null, qrError = null} = {}) {
    const calls = [], messages = [], modals = [];
    let serverConfig = copy(defaults), now = Date.parse('2026-10-11T' + time + '+07:00');
    class Clock extends Date { static now() { return now; } }
    const vm = {isRoleAdmin: manager, directorySchoolId: 2, qrAttendanceDate: new Date(2026, 9, 11),
        personDates: [{id: 7, user: {id: 10}, statusMass: 2, statusClass: 6, extraClass: 2}],
        searchDto: {user: {person: {enrollmentClassId: 100}}}, scanning: false, showExtraFeatures: true,
        confirmCheck() { calls.push(['confirmed', vm.checkPerson.status]); }};
    const service = {
        getAttendanceConfig() { calls.push(['getConfig']); return loadError ? Promise.reject(loadError) : Promise.resolve(copy(serverConfig)); },
        saveAttendanceConfig(config) { calls.push(['saveConfig', copy(config)]); if (saveError) return Promise.reject(saveError);
            serverConfig = copy(config); return Promise.resolve(copy(config)); },
        saveByQr(request, date) { calls.push(['qr', copy(request), date]); if (qrError) return Promise.reject(qrError); return Promise.resolve(copy(savedQr || {
            id: 7, user: {id: 10}, statusMass: 3, statusClass: 6, extraClass: 2,
            timeGoToChurch: '2026-10-11T01:05:00Z', modifiedBy: 'teacher'
        })); },
        saveObject(request) { calls.push(['manual', copy(request)]); return Promise.resolve({
            id: 7, user: {id: 10}, statusMass: 2, statusClass: 2, extraClass: 2, ...copy(request)
        }); }
    };
    const context = nodeVm.createContext({vm, service, Date: Clock, console,
        angular: {copy, noop() {}, forEach: (values, action) => (values || []).forEach(action)},
        toastr: {error: message => messages.push(message), warning: message => messages.push(message), success: message => messages.push(message)},
        $q: {reject: value => Promise.reject(value)}, $scope: {}, $timeout: callback => callback(),
        modal: {open(options) { let resolve, reject; const result = new Promise((yes, no) => {resolve = yes; reject = no;});
            const modal = {options, result, close: resolve, dismiss: reject}; modals.push(modal); return modal; }},
        window: {location: {hostname: 'tnttphungkhoang.com'}, URL},
        parseDateOnly: value => value ? new Date(value) : null,
        moment: () => ({format: () => '2026-10-11'}), refreshAttendanceSummary: () => calls.push(['summary'])
    });
    for (const [start, end] of [
        ['// Shared QR schedule.', 'vm.start = function'],
        ['vm.resetPersonDate = function', 'function applyQrSavedAttendance'],
        ['function applyQrSavedAttendance', '/**\n         * Kiểm tra mục này'],
        ['vm.isAttendanceChecked = function', 'vm.saveNote = function']
    ]) {
        const startIndex = source.indexOf(start), endIndex = source.indexOf(end, startIndex);
        assert.ok(startIndex >= 0 && endIndex > startIndex, 'Controller section exists: ' + start);
        nodeVm.runInContext(source.slice(startIndex, endIndex), context);
    }
    vm.start = () => calls.push(['camera']); vm.stop = () => {vm.scanning = false; calls.push(['stop']);};
    return {vm, calls, messages, modals, at: time => {now = Date.parse('2026-10-11T' + time + '+07:00');},
        server: config => {serverConfig = copy(config);}};
}

test('opening the camera loads the shared schedule before selecting a QR type', async () => {
    const h = setup(); await h.vm.toggleCamera();
    assert.equal(h.modals[0].options.templateUrl, 'qr_attendance_type_modal.html');
    assert.equal(h.vm.attendanceConfig.qrSwitchTime, '09:00');
    h.vm.pendingCheckType = 1; h.vm.confirmQrAttendanceType();
    assert.ok(h.calls.some(call => call[0] === 'camera'));
});

test('a failed configuration load prevents the camera from opening with guessed hours', async () => {
    const h = setup({loadError: {data: {message: 'Không tải được cấu hình'}}});
    await h.vm.toggleCamera(); assert.equal(h.modals.length, 0);
    assert.match(h.messages.at(-1), /Không tải được cấu hình/);
    assert.equal(h.vm.attendanceConfigLoading, false);
});

test('the QR switch has no gap at nine and follows Vietnam time independent of browser timezone', async () => {
    const h = setup({time: '08:59:59'}); await h.vm.loadAttendanceConfig();
    assert.equal(h.vm.isMassAttendanceAllowed(), true); assert.equal(h.vm.isClassAttendanceAllowed(), false);
    h.at('09:00:00'); assert.equal(h.vm.isMassAttendanceAllowed(), false); assert.equal(h.vm.isClassAttendanceAllowed(), true);
    h.server({...defaults, qrSwitchTime: '09:20'}); await h.vm.loadAttendanceConfig();
    assert.equal(h.vm.isMassAttendanceAllowed(), true); h.at('09:20:00');
    assert.equal(h.vm.isMassAttendanceAllowed(), false); assert.equal(h.vm.isClassAttendanceAllowed(), true);
});

test('QR type availability uses the server clock when the device clock is wrong', async () => {
    const h = setup({time: '10:00:00'});
    h.server({...defaults, serverTimeMillis: Date.parse('2026-10-11T08:59:59+07:00')});
    await h.vm.loadAttendanceConfig();
    assert.equal(h.vm.isMassAttendanceAllowed(), true); assert.equal(h.vm.isClassAttendanceAllowed(), false);
    h.at('10:00:01');
    assert.equal(h.vm.isMassAttendanceAllowed(), false); assert.equal(h.vm.isClassAttendanceAllowed(), true);
});

test('a scan uses the server schedule even when the locally loaded switch time is stale', async () => {
    const h = setup({time: '09:05:00'}); await h.vm.loadAttendanceConfig(); h.vm.checkType = 1;
    assert.equal(h.vm.isMassAttendanceAllowed(), false);
    await h.vm.saveByScanQr('HS001');
    assert.ok(h.calls.some(call => call[0] === 'qr'));
    assert.equal(h.vm.checkPerson.status, 3);
});

test('a server QR cutoff rejection stops scanning and surfaces the current server reason', async () => {
    const h = setup({qrError: {data: {message: 'QR Lễ đã khóa từ 08:50.'}}});
    await h.vm.loadAttendanceConfig(); h.vm.checkType = 1; h.vm.scanning = true;
    await assert.rejects(h.vm.saveByScanQr('HS001'));
    assert.ok(h.calls.some(call => call[0] === 'stop'));
    assert.equal(h.vm.scanning, false); assert.equal(h.messages.at(-1), 'QR Lễ đã khóa từ 08:50.');
});

test('configuration edits are drafts until saved and changes load on the next camera opening', async () => {
    const h = setup(); await h.vm.openAttendanceConfig();
    h.vm.attendanceConfigDraft.massStartTime = '07:30';
    assert.equal(h.vm.attendanceConfig.massStartTime, '08:00');
    h.modals.at(-1).dismiss('cancel'); await tick();
    await h.vm.openAttendanceConfig(); assert.equal(h.vm.attendanceConfigDraft.massStartTime, '08:00');
    h.vm.attendanceConfigDraft.massStartTime = '07:45'; h.vm.attendanceConfigDraft.classAutoLate = true;
    await h.vm.saveAttendanceConfig(); await tick();
    assert.equal(h.vm.attendanceConfig.massStartTime, '07:45'); assert.equal(h.vm.attendanceConfig.classAutoLate, true);
    h.server({...defaults, qrSwitchTime: '09:30'}); await h.vm.toggleCamera();
    assert.equal(h.vm.attendanceConfig.qrSwitchTime, '09:30');
});

test('failed configuration saves leave the active schedule intact and show the server reason', async () => {
    const h = setup({saveError: {data: {message: 'Mốc tính muộn Lễ phải trước giờ khóa'}}});
    await h.vm.openAttendanceConfig(); h.vm.attendanceConfigDraft.massLateMinutes = 60;
    await h.vm.saveAttendanceConfig();
    assert.equal(h.vm.attendanceConfig.massLateMinutes, 5);
    assert.match(h.vm.attendanceConfigError, /trước giờ khóa/);
    assert.equal(h.vm.attendanceConfigSaving, false); assert.notEqual(h.vm.attendanceConfigModalInstance, null);
});

test('teachers cannot edit the global schedule and late previews use the entered grace minutes', async () => {
    const h = setup({manager: false}); await h.vm.openAttendanceConfig();
    assert.equal(h.modals.length, 0); assert.equal(h.vm.canManageAttendanceConfig(), false);
    assert.equal(h.vm.attendanceLateTime('08:00', 5), '08:05');
    assert.equal(h.vm.attendanceLateTime('09:00', 15), '09:15');
    assert.equal(h.vm.attendanceLateTime('23:59', 1), '');
});

test('QR accepts server-calculated late and keeps unrelated attendance fields intact', async () => {
    const h = setup({time: '08:05:00'}); await h.vm.loadAttendanceConfig(); h.vm.checkType = 1;
    await h.vm.saveByScanQr('HS001');
    assert.equal(h.vm.personDates[0].statusMass, 3); assert.equal(h.vm.personDates[0].statusClass, 6);
    assert.equal(h.vm.checkPerson.status, 3); assert.equal(h.messages.length, 0);
    assert.deepEqual(h.calls.find(call => call[0] === 'qr'), ['qr', {schoolId: 2, user: {username: 'HS001'}, statusMass: 1}, '2026-10-11']);
});

test('class QR accepts late when enabled and present at end of class when disabled', async () => {
    for (const status of [1, 3]) {
        const h = setup({time: '11:00:00', savedQr: {id: 7, user: {id: 10}, statusMass: 2, statusClass: status}});
        await h.vm.loadAttendanceConfig(); h.vm.checkType = 2; await h.vm.saveByScanQr('HS001');
        assert.equal(h.vm.personDates[0].statusClass, status); assert.equal(h.vm.personDates[0].statusMass, 2);
        assert.equal(h.messages.length, 0);
    }
});

test('manual late and present remain teacher choices even after the QR cutoff', async () => {
    const h = setup({time: '12:00:00'}); const row = h.vm.personDates[0];
    await h.vm.saveByClick(row, row.user, 2, 3); assert.equal(row.statusClass, 3);
    await h.vm.saveByClick(row, row.user, 1, 1); assert.equal(row.statusMass, 1);
    assert.equal(h.calls.filter(call => call[0] === 'manual').length, 2);
    assert.equal(h.calls.some(call => call[0] === 'getConfig'), false);
});

test('late attendance counts as present in both row totals and daily statistics', () => {
    const vm = {personDates: [{statusMass: 3, statusClass: 3}, {statusMass: 1, statusClass: 1}, {statusMass: 6, statusClass: 2}]};
    const context = nodeVm.createContext({vm, angular: {forEach: (values, action) => values.forEach(action)}});
    nodeVm.runInContext(source.slice(source.indexOf('vm.resetSum = function'), source.indexOf('function parseDateOnly')), context);
    nodeVm.runInContext('refreshAttendanceSummary()', context);
    assert.equal(vm.totalGoToChurch, 2); assert.equal(vm.totalGoToClass, 2);
    assert.equal(vm.totalMass3, 1); assert.equal(vm.totalClass3, 1);
    assert.equal(vm.totalAbsentChurch, 1); assert.equal(vm.totalAbsentClass, 1);
    nodeVm.runInContext(source.slice(source.indexOf('function addAttendance('), source.indexOf('function buildAttendanceByUserId')), context);
    const totals = {present: 0, excused: 0, unexcused: 0, unmarked: 0, massPresent: 0, massExcused: 0};
    context.totals = totals;
    nodeVm.runInContext('vm.personDates.forEach(row => addAttendance(totals, row))', context);
    assert.deepEqual(totals, {present: 2, excused: 0, unexcused: 1, unmarked: 0, massPresent: 2, massExcused: 1});
});
