const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const stats = require('../users/TnttProfileStatistics');
const app = path.resolve(__dirname, '..');
const classes = [
    {id: 1, name: 'ẤU NHI 1A (ĐCN2 CŨ)', schoolId: 2},
    {id: 2, name: 'THIẾU NHI 2 (TS1 CŨ)', schoolId: 2},
    {id: 3, name: 'Ca đoàn', schoolId: 2},
    {id: 4, name: 'Huynh trưởng', schoolId: 2},
    {id: 11, name: 'Đội Lucia', parentId: 1, schoolId: 2},
    {id: 12, name: 'Nhóm nhỏ', parentId: 11, schoolId: 2},
    {id: 99, name: 'Ấu nhi 3', schoolId: 1}
];
function student(id, classId, profile = {}, extras = [], active = true) {
    return {id, username: '000' + id, active, enrollmentClassIds: extras,
        person: {lastName: 'Nguyễn Hoàng', firstName: 'Đăng Khoa', patron: 'Gioan', birthDate: '2018-10-23',
            enrollmentClassId: classId, ...profile}};
}
const good = {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 1};
const fixtures = () => [student(1, 1, good, [3, 11]), student(2, 12),
    student(3, 2, {...good, tnttLevel: 2}), student(4, 1, {...good, tnttLevel: 3}),
    student(5, 1, {}, [], false), student(6, 4), student(7, 99)];

test('current class name defines branch and level; legacy parentheses and non-sector classes never define it', () => {
    for (const [name, branch, level] of [
        ['CHIÊN CON 3B (LỚP MỚI)', 'CHIEN_CON', 3], ['Ấu nhi 1A (ĐCN2 cũ)', 'AU_NHI', 1],
        ['Thiếu nhi 2 (TS1 cũ)', 'THIEU_NHI', 2], ['NGHĨA SĨ 1B (TS3B cũ)', 'NGHIA_SI', 1],
        ['Hiệp sĩ III', 'HIEP_SI', 3], ['Ấu nhi cấp II', 'AU_NHI', 2]
    ]) assert.deepEqual([stats.expected(name).branch, stats.expected(name).level], [branch, level]);
    for (const name of ['Ca đoàn', 'Huynh trưởng', 'Khác (Ấu nhi 1)', 'Giáo lý viên', 'Ấu nhi', 'Ấu nhi 12', 'Hiệp sĩ IV'])
        assert.equal(stats.expected(name), null, name);
});

test('counts unique students, missing data, wrong branch and wrong rank without mutating profiles', () => {
    const users = fixtures(), original = structuredClone(users);
    const report = stats.build(users.concat(users[1]), classes, [1, 2, 3, 99], false);
    assert.equal(report.total, 4); assert.equal(report.matched, 1); assert.equal(report.mismatched, 3);
    assert.equal(report.missing, 1); assert.equal(report.branchMismatch, 2); assert.equal(report.levelMismatch, 2);
    assert.deepEqual(report.classes.map(r => r.total).sort(), [1, 3]);
    assert.equal(report.issues.find(r => r.userId === 2).className, classes[0].name);
    assert.equal(report.issues.find(r => r.userId === 3).expectedBranch, 'Thiếu nhi');
    assert.equal(report.issues.find(r => r.userId === 4).branchMismatch, false);
    assert.equal(report.issues[0].name, 'Nguyễn Hoàng Đăng Khoa');
    assert.deepEqual(users, original);
});

test('inactive accounts are opt-in; primary TNTT class takes precedence over extra memberships', () => {
    const users = [student(1, 1, good, [2, 3]), student(2, null, good, [11, 3]), student(3, 1, {}, [], false)];
    assert.equal(stats.build(users, classes, [1, 2], false).total, 2);
    assert.equal(stats.build(users, classes, [1, 2], true).total, 3);
    assert.equal(stats.build(users, classes, [2], true).total, 0);
    assert.equal(stats.build(users, classes, [1], false).mismatched, 0);
});

test('ambiguous extra classes require review; broken or cyclic trees do not invent a branch', () => {
    const report = stats.build([student(1, null, good, [1, 2])], classes, [1, 2], false);
    assert.equal(report.total, 1); assert.equal(report.mismatched, 1);
    assert.match(report.issues[0].reason, /nhiều lớp/); assert.equal(report.issues[0].classId, 'review');
    const broken = classes.concat([{id: 50, schoolId: 2, name: 'Ấu nhi 3', parentId: 51}, {id: 51, schoolId: 2, parentId: 50}]);
    assert.equal(stats.build([student(9, 50)], broken, [1, 2], false).total, 0);
});

// Use the same SheetJS 0.18.5 bundle loaded by index.html.
test('actual XLSX round trip has three sheets and preserves student codes, names, reasons and empty headers',
    {skip: !process.env.STUDENT_QR_XLSX_PATH && 'Set STUDENT_QR_XLSX_PATH for real SheetJS integration'}, () => {
    const XLSX = require(path.resolve(process.env.STUDENT_QR_XLSX_PATH));
    const report = stats.build(fixtures(), classes, [1, 2], true);
    const bytes = XLSX.write(stats.workbook(XLSX, report), {type: 'buffer', bookType: 'xlsx'});
    const book = XLSX.read(bytes, {type: 'buffer'});
    assert.deepEqual(book.SheetNames, ['Theo ngành', 'Theo lớp', 'Danh sách cần bổ sung']);
    const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[2]]);
    assert.equal(rows.length, 4);
    assert.equal(rows[0]['Họ và tên'], 'Nguyễn Hoàng Đăng Khoa');
    assert.equal(rows[0]['Mã học sinh'], '0002');
    assert.equal(rows[0]['Ngày sinh'], '23/10/2018');
    assert.ok(rows.every(r => r['Nội dung cần kiểm tra']));
    const empty = stats.workbook(XLSX, stats.build([], classes, [1], false));
    assert.equal(empty.Sheets['Danh sách cần bổ sung'].A1.v, 'STT');
});

function controllerHarness(getUsers) {
    const source = fs.readFileSync(path.join(app, 'users/controllers/UserController.js'), 'utf8');
    const start = source.indexOf('        function createEmptyStudentStatistics()');
    const end = source.indexOf('        $scope.pageChanged', start);
    const vm = {directorySchoolId: 2, isIeltsRoomDomain: false, enrollmentClasses: classes,
        findEnrollmentClass: id => classes.find(c => c.id === Number(id)),
        getClassAndDescendantIds: id => Number(id) === 1 ? [1, 11, 12] : [Number(id)],
        getEnrollmentClassName: id => (classes.find(c => c.id === Number(id)) || {}).name};
    const modals = [], calls = [], handlers = {};
    nodeVm.runInNewContext(source.slice(start, end), {vm, window: {TnttProfileStatistics: stats},
        $scope: {$on(name, fn) {handlers[name] = fn;}}, toNumberOrNull: value => Number(value) > 0 ? Number(value) : null,
        angular: {isArray: Array.isArray, forEach: (items, fn) => Array.isArray(items) ? items.forEach(fn) : Object.keys(items || {}).forEach(k => fn(items[k], k))},
        getDirectorySearchRoles: () => [], toastr: {warning() {}, error() {}},
        service: {getUsers(filter, page, size) {calls.push({filter: structuredClone(filter), page, size}); return getUsers(filter, page, size);}},
        modal: {open() {const closed = {}; modals.push(closed); return {result: {then(ok, cancel) {closed.cancel = cancel;}}};}}});
    return {vm, modals, calls, handlers};
}

test('controller scopes and paginates the entire report, handles details and makes no save calls', async () => {
    const users = fixtures();
    const h = controllerHarness((filter, page) => Promise.resolve({content: page === 1 ? users.slice(0, 3) : users.slice(3), totalElements: users.length}));
    h.vm.openStudentStatisticsModal(); h.vm.chooseStudentStatisticsMode('branch');
    assert.deepEqual(Array.from(h.vm.studentStatisticsSelectedClassIds), [1, 2]);
    h.vm.tnttStatisticsIncludeInactive = true;
    await h.vm.loadStudentStatistics();
    assert.equal(h.calls.length, 2); assert.equal(h.calls[0].size, 500); assert.equal(h.calls[0].filter.active, null);
    assert.equal(h.calls[0].filter.schoolId, 2);
    assert.deepEqual(Array.from(h.calls[0].filter.enrollmentClassIds), [1, 11, 12, 2]);
    assert.equal(h.vm.tnttStatistics.total, 5);
    h.vm.showTnttStatisticsDetails('class', 2, 'Thiếu nhi 2');
    assert.deepEqual(h.vm.tnttStatisticsDetails.map(r => r.userId), [3]);
});

test('dismissed or superseded statistics never render late results; incomplete pages do not produce a partial report', async () => {
    let resolve;
    const h = controllerHarness(() => new Promise(done => {resolve = done;}));
    h.vm.openStudentStatisticsModal(); h.vm.chooseStudentStatisticsMode('branch');
    const pending = h.vm.loadStudentStatistics(); h.modals[0].cancel();
    resolve({content: fixtures(), totalElements: fixtures().length}); await pending;
    assert.equal(h.vm.tnttStatistics, null);
    const broken = controllerHarness(() => Promise.resolve({content: [], totalElements: 5}));
    broken.vm.openStudentStatisticsModal(); broken.vm.chooseStudentStatisticsMode('branch');
    await broken.vm.loadStudentStatistics();
    assert.equal(broken.vm.tnttStatistics, null); assert.match(broken.vm.studentStatisticsError, /Không tải đủ/);
});
