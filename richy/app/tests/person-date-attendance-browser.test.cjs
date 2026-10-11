const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const repo = path.resolve(app, '../..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const source = fs.readFileSync(path.join(app, 'person_date/controllers/PersonDateController.js'), 'utf8');
const template = fs.readFileSync(path.join(app, 'person_date/views/listing.html'), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const code = section('// Shared QR schedule.', 'vm.start = function') +
    section('vm.statusMasses = [', 'function applyQrSavedAttendance') +
    section('function applyQrSavedAttendance', '/**\n         * Kiểm tra mục này') +
    section('vm.isAttendanceChecked = function', 'vm.saveNote = function');
function modal(id) {
    const start = template.indexOf('<script type="text/ng-template" id="' + id + '">');
    return template.slice(start, template.indexOf('</script>', start) + '</script>'.length);
}
const configModal = modal('attendance_config_modal.html'), qrModal = modal('qr_attendance_type_modal.html');
const cells = template.slice(template.indexOf('<td class="attendance-mass-cell"'), template.indexOf('<td class="attendance-classroom-cell"'));
const styles = Array.from(template.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
const css = ['bootstrap.min.css', 'select.min.css'].map(file => fs.readFileSync(path.join(app, 'assets/css/external', file), 'utf8')).join('\n');
const menu = template.match(/<li ng-if="vm.canManageAttendanceConfig\(\)">[\s\S]*?<\/li>/)[0];
const defaults = {massStartTime: '08:00', massLateMinutes: 5, massAutoLate: true,
    classStartTime: '09:00', classLateMinutes: 15, classAutoLate: false, qrSwitchTime: '09:00'};

test('real Angular forms save shared settings, preview late times and allow manual late on desktop and phone', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 900}, timezoneId: 'America/Los_Angeles'});
            const errors = [], saves = [], manual = [];
            let config = {...defaults}, failSave = true;
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html></html>'}));
            await page.route('**/api/person_date/attendance_config', async route => {
                if (route.request().method() === 'PUT') {
                    const draft = route.request().postDataJSON(); saves.push(draft);
                    if (failSave) { failSave = false; return route.fulfill({status: 400, contentType: 'application/json',
                        body: JSON.stringify({message: 'Mốc tính muộn Lễ phải trước giờ khóa QR Lễ.'})}); }
                    config = draft;
                }
                return route.fulfill({contentType: 'application/json', body: JSON.stringify(config)});
            });
            await page.route('**/api/person_date/save', route => {
                const dto = route.request().postDataJSON(); manual.push(dto);
                return route.fulfill({contentType: 'application/json', body: JSON.stringify({id: 7, user: {id: 10},
                    statusMass: 2, statusClass: 2, extraClass: 2, ...dto})});
            });
            await page.goto('http://attendance.test');
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<style>' + css + styles + 'body{background:#f5f7fa}main{padding:20px;max-width:1000px;margin:auto}.qa-manual{overflow:auto}li{list-style:none}' +
                '</style></head><body><main id="qa" ng-controller="Qa as vm"><h3>Điểm danh</h3>' + menu + configModal + qrModal +
                '<div class="qa-manual"><table class="table"><tr ng-repeat="personDate in vm.personDates">' + cells + '</tr></table></div></main></body></html>');
            for (const file of ['angular.min.js', 'angular-sanitize.min.js', 'ui-bootstrap-tpls.min.js', 'select.min.js'])
                await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
            await page.evaluate(() => {
                Date.now = () => new Date('2026-10-11T09:00:00+07:00').getTime();
                angular.module('Hrm.PersonDate', []).value('settings', {api: {baseUrl: '/', apiV1Url: 'api/'}})
                    .factory('Utilities', ['$http', function ($http) { return {
                        resolve: (url, method) => $http({url, method}).then(result => result.data),
                        resolveAlt: (url, method, params, data) => $http({url, method, data}).then(result => result.data)
                    }; }]);
            });
            await page.addScriptTag({path: path.join(app, 'person_date/business/PersonDateService.js')});
            await page.evaluate(code => {
                angular.module('Qa', ['ui.bootstrap', 'ui.select', 'ngSanitize', 'Hrm.PersonDate'])
                    .filter('propsFilter', () => (items, props) => items.filter(item => item.name.toLowerCase().includes(String(props.name || '').toLowerCase())))
                    .controller('Qa', ['$scope', '$q', '$uibModal', '$timeout', 'PersonDateService', function ($scope, $q, modal, $timeout, service) {
                        const vm = this;
                        vm.isRoleAdmin = true; vm.directorySchoolId = 2; vm.showExtraFeatures = true;
                        vm.searchDto = {user: {person: {enrollmentClassId: 100}}};
                        vm.personDates = [{id: 7, user: {id: 10}, statusMass: 2, statusClass: 2, extraClass: 2}];
                        vm.confirmCheck = () => {}; vm.stop = () => {};
                        new Function('vm', '$scope', '$q', 'modal', '$timeout', 'service', 'toastr',
                            'parseDateOnly', 'refreshAttendanceSummary', code)(vm, $scope, $q, modal, $timeout, service,
                            {success() {}, error() {}, warning() {}}, value => value, () => {});
                        window.qaVm = vm;
                    }]);
                angular.bootstrap(document.body, ['Qa']);
            }, code);
            const open = page.getByText('Cấu hình giờ điểm danh', {exact: true}).first();
            await open.click();
            await page.locator('#attendance-mass-start').waitFor();
            assert.equal(await page.locator('#attendance-mass-start').inputValue(), '08:00');
            assert.equal(await page.locator('#attendance-qr-switch').inputValue(), '09:00');
            assert.match(await page.locator('.attendance-config-modal').innerText(), /08:05/);
            assert.match(await page.locator('.attendance-config-modal').innerText(), /Quét QR Giáo lý luôn ghi CÓ ĐI HỌC/);
            await page.getByRole('checkbox', {name: 'Tự ghi MUỘN khi quét QR Giáo lý', exact: true}).check();
            assert.match(await page.locator('.attendance-config-modal').innerText(), /09:15/);
            await page.locator('#attendance-mass-start').fill('24:00');
            assert.equal(await page.getByRole('button', {name: 'Lưu cấu hình', exact: true}).isDisabled(), true);
            await page.locator('#attendance-mass-start').fill('08:00');
            await page.screenshot({path: path.join(repo, `.tmp/attendance-config-${width}.png`)});
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
            await page.getByRole('button', {name: 'Lưu cấu hình', exact: true}).click();
            await page.locator('.attendance-config-modal .alert-danger').waitFor();
            assert.match(await page.locator('.attendance-config-modal .alert-danger').innerText(), /trước giờ khóa/);
            assert.equal(await page.evaluate(() => window.qaVm.attendanceConfig.classAutoLate), false);
            await page.getByRole('button', {name: 'Lưu cấu hình', exact: true}).click();
            await page.locator('.attendance-config-modal').waitFor({state: 'detached'});
            assert.equal(config.classAutoLate, true); assert.equal(saves.length, 2);
            await open.click(); await page.locator('#attendance-class-late').waitFor();
            assert.equal(await page.getByRole('checkbox', {name: 'Tự ghi MUỘN khi quét QR Giáo lý', exact: true}).isChecked(), true);
            await page.getByRole('button', {name: 'Hủy', exact: true}).click();
            await page.locator('.attendance-config-modal').waitFor({state: 'detached'});
            // At exactly 09:00, Mass is disabled and Catechism is available, even in a US browser timezone.
            await page.evaluate(() => angular.element(document.getElementById('qa')).scope().$apply(() => window.qaVm.openQrAttendanceTypeModal()));
            const massRadio = page.locator('.qr-attendance-type-option input').nth(0);
            const classRadio = page.locator('.qr-attendance-type-option input').nth(1);
            assert.equal(await massRadio.isDisabled(), true); assert.equal(await classRadio.isEnabled(), true);
            await page.getByRole('button', {name: 'Hủy', exact: true}).click();
            await page.locator('.qr-attendance-type-modal').waitFor({state: 'detached'});
            // Use the actual ui-select dropdown and ng-change callback to save manual late.
            for (const [cell, field] of [['.attendance-mass-cell', 'statusMass'], ['.attendance-class-cell', 'statusClass'], ['.attendance-extra-cell', 'extraClass']]) {
                await page.locator(cell + ' .ui-select-toggle').click();
                await page.locator(cell).getByText('MUỘN', {exact: true}).click();
                await page.waitForFunction(field => window.qaVm.personDates[0][field] === 3, field);
                assert.equal(manual.at(-1)[field], 3);
            }
            await page.evaluate(() => angular.element(document.getElementById('qa')).scope().$apply(() => {window.qaVm.isRoleAdmin = false;}));
            assert.equal(await open.count(), 0);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
