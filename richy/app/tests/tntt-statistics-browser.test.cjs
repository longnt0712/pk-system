// Set STUDENT_QR_XLSX_PATH to the SheetJS 0.18.5 bundle used by index.html.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const app = path.resolve(__dirname, '..'), repo = path.resolve(app, '../..');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const source = read('users/controllers/UserController.js'), template = read('users/views/users.html');
const start = source.indexOf('        function createEmptyStudentStatistics()');
const code = source.slice(start, source.indexOf('        $scope.pageChanged', start));
const modalStart = template.indexOf('<script type="text/ng-template" id="student_statistics_modal.html">');
const modalTemplate = template.slice(modalStart, template.indexOf('</script>', modalStart) + 9);
const styles = Array.from(template.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
const button = template.match(/<button[^>]*ng-click="vm.openStudentStatisticsModal\(\)"[\s\S]*?<\/button>/)[0];
const classes = [{id: 1, name: 'ẤU NHI 1A (ĐCN2 CŨ)', schoolId: 2},
    {id: 2, name: 'THIẾU NHI 2 (TS1 CŨ)', schoolId: 2},
    {id: 3, name: 'Ca đoàn', schoolId: 2}, {id: 11, name: 'Đội Lucia', parentId: 1, schoolId: 2}];
const good = {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 1};
const student = (id, classId, name, profile, active = true) => ({id, username: '000' + id, active,
    enrollmentClassIds: [classId, 3], person: {lastName: name, firstName: '', patron: 'Gioan',
        enrollmentClassId: classId, birthDate: '2018-10-23', ...profile}});
const users = Array.from({length: 500}, (_, i) => student(i + 1, i % 2 ? 11 : 1, 'Học sinh ' + i, good)).concat([
    student(501, 11, 'Nguyễn Hoàng Đăng Khoa', {}),
    student(502, 2, 'Hoàng Nguyễn Phương Vy', {...good, tnttLevel: 2}),
    student(503, 2, 'Trần Bảo An', {...good, tnttBranch: 'THIEU_NHI', tnttLevel: 1}),
    student(504, 1, 'Lê Minh Bình', {}, false)
]);

test('actual statistics modal paginates scoped students, filters names and downloads all Excel sheets on desktop/mobile',
    {skip: !process.env.STUDENT_QR_XLSX_PATH && 'Set STUDENT_QR_XLSX_PATH for browser integration', timeout: 90000}, async () => {
    const XLSX = require(path.resolve(process.env.STUDENT_QR_XLSX_PATH));
    const downloadsPath = path.join(repo, '.tmp/tntt-statistics-downloads');
    fs.mkdirSync(downloadsPath, {recursive: true});
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome, downloadsPath});
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 900}, acceptDownloads: true});
            const errors = [], requests = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html></html>'}));
            await page.route('**/api/users/search/*/*', route => {
                const filter = route.request().postDataJSON();
                const [, index, size] = route.request().url().match(/search\/(\d+)\/(\d+)/).map(Number);
                requests.push({filter, index, size});
                const filtered = users.filter(u => (filter.active == null || u.active === filter.active)
                    && u.enrollmentClassIds.some(id => filter.enrollmentClassIds.includes(id)));
                return route.fulfill({contentType: 'application/json', body: JSON.stringify({
                    content: filtered.slice((index - 1) * size, index * size), totalElements: filtered.length})});
            });
            await page.goto('https://tntt-statistics.test');
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<style>' + read('assets/css/external/bootstrap.min.css') + styles +
                'main{padding:20px}body{background:#f5f7fa}</style></head><body><main id="qa" ng-controller="Qa as vm">' +
                '<h3>Danh sách học sinh</h3>' + button + modalTemplate + '</main></body></html>');
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/ui-bootstrap-tpls.min.js')});
            await page.addScriptTag({path: path.resolve(process.env.STUDENT_QR_XLSX_PATH)});
            await page.addScriptTag({path: path.join(app, 'users/StudentQrWorkbook.js')});
            await page.addScriptTag({path: path.join(app, 'users/TnttProfileStatistics.js')});
            await page.evaluate(() => {
                angular.module('Hrm.User', []).value('settings', {api: {baseUrl: '/', apiPrefix: 'api/'}})
                    .factory('Utilities', ['$http', $http => ({resolveAlt(url, method, params, body) {
                        return $http({url, method, data: body}).then(response => response.data);
                    }})]);
            });
            await page.addScriptTag({path: path.join(app, 'users/business/UserService.js')});
            await page.evaluate(({code, classes}) => {
                angular.module('Qa', ['ui.bootstrap', 'Hrm.User']).controller('Qa', ['$scope', '$uibModal', 'UserService',
                    function ($scope, modal, service) {
                        const vm = this;
                        vm.enrollmentClasses = classes; vm.directorySchoolId = 2; vm.isIeltsRoomDomain = false;
                        vm.findEnrollmentClass = id => classes.find(c => c.id === Number(id));
                        vm.getClassAndDescendantIds = id => Number(id) === 1 ? [1, 11] : [Number(id)];
                        vm.getEnrollmentClassName = id => (vm.findEnrollmentClass(id) || {}).name;
                        const toNumber = value => Number(value) > 0 ? Number(value) : null;
                        window.qaToasts = [];
                        new Function('vm', '$scope', 'modal', 'service', 'toNumberOrNull', 'getDirectorySearchRoles', 'toastr', 'moment', code)(
                            vm, $scope, modal, service, toNumber, () => [], {warning: m => window.qaToasts.push(m), error: m => window.qaToasts.push(m)},
                            () => ({format: () => '20261102_120000'}));
                        window.qaVm = vm;
                    }]);
                angular.bootstrap(document.body, ['Qa']);
            }, {code, classes});

            const open = page.getByRole('button', {name: 'Thống kê', exact: true});
            await open.click();
            assert.equal(requests.length, 0, 'Opening modal never fetches all students');
            await page.getByRole('button', {name: /Theo ngành\/cấp TNTT/}).click();
            assert.equal(await page.locator('.student-statistics-parent-option').count(), 2);
            assert.equal(await page.getByLabel('Bao gồm tài khoản không kích hoạt').isChecked(), false);
            await page.getByRole('button', {name: 'Xác nhận thống kê', exact: true}).click();
            await page.waitForFunction(() => window.qaVm.tnttStatistics && !window.qaVm.studentStatisticsLoading);
            assert.deepEqual(requests.map(r => [r.index, r.size]), [[1, 500], [2, 500]]);
            assert.ok(requests.every(r => r.filter.active === true && r.filter.schoolId === 2 &&
                [...r.filter.enrollmentClassIds].sort((a, b) => a - b).join(',') === '1,2,11'));
            assert.equal(await page.evaluate(() => window.qaVm.tnttStatistics.total), 503);
            assert.equal(await page.locator('.tntt-stat-details tbody tr').count(), 3);
            assert.match(await page.locator('.tntt-stat-totals').innerText(), /503[\s\S]*500[\s\S]*3/);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({path: path.join(repo, `.tmp/tntt-statistics-${width}.png`), fullPage: true});

            await page.getByRole('button', {name: 'Xem học sinh cần bổ sung lớp ' + classes[0].name, exact: true}).click();
            assert.equal(await page.locator('.tntt-stat-details tbody tr').count(), 1);
            assert.match(await page.locator('.tntt-stat-details').innerText(), /Nguyễn Hoàng Đăng Khoa[\s\S]*000501/);
            const [download] = await Promise.all([page.waitForEvent('download'),
                page.getByRole('button', {name: 'Xuất Excel thống kê', exact: true}).click()]);
            assert.match(download.suggestedFilename(), /^thong_ke_nganh_cap_TNTT_.*\.xlsx$/);
            const book = XLSX.read(fs.readFileSync(await download.path()), {type: 'buffer'});
            assert.deepEqual(book.SheetNames, ['Theo ngành', 'Theo lớp', 'Danh sách cần bổ sung']);
            const rows = XLSX.utils.sheet_to_json(book.Sheets['Danh sách cần bổ sung']);
            assert.equal(rows.length, 3, 'Export includes all scoped issues even when one class is being inspected');
            assert.equal(rows[0]['Mã học sinh'], '000501');
            assert.ok(rows.some(r => r['Họ và tên'] === 'Hoàng Nguyễn Phương Vy'));
            await page.getByRole('button', {name: 'Xem tất cả', exact: true}).click();
            assert.equal(await page.locator('.tntt-stat-details tbody tr').count(), 3);
            await page.getByRole('button', {name: 'Quay lại', exact: true}).click();
            await page.getByLabel('Bao gồm tài khoản không kích hoạt').check();
            await page.getByRole('button', {name: 'Xác nhận thống kê', exact: true}).click();
            await page.waitForFunction(() => window.qaVm.tnttStatistics && !window.qaVm.studentStatisticsLoading);
            assert.equal(await page.evaluate(() => window.qaVm.tnttStatistics.total), 504);
            assert.equal(await page.locator('.tntt-stat-details tbody tr').count(), 4);
            assert.ok(requests.slice(2).every(r => r.filter.active === null));
            await page.getByRole('button', {name: 'Đóng', exact: true}).click();
            await page.locator('.student-statistics-modal').waitFor({state: 'detached'});
            await page.evaluate(() => angular.element(document.getElementById('qa')).scope().$apply(() => {window.qaVm.isIeltsRoomDomain = true;}));
            await open.click();
            assert.equal(await page.getByRole('button', {name: /Theo ngành\/cấp TNTT/}).count(), 0);
            assert.equal(await page.getByRole('button', {name: /Thống kê theo lớp/}).count(), 1);
            assert.equal(await page.getByRole('button', {name: /Thống kê theo đội/}).count(), 1);
            assert.deepEqual(await page.evaluate(() => window.qaToasts), []);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {await browser.close();}
});
