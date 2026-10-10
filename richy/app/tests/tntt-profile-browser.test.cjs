const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const repo = path.resolve(app, '../..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const source = fs.readFileSync(path.join(app, 'users/controllers/UserController.js'), 'utf8');
const template = fs.readFileSync(path.join(app, 'users/views/users.html'), 'utf8');
const profileCode = source.slice(source.indexOf('// TNTT profile:'), source.indexOf('// End TNTT profile.'));
const fieldset = template.slice(template.indexOf('<fieldset class="tntt-profile-fields">'),
    template.indexOf('</fieldset>', template.indexOf('<fieldset class="tntt-profile-fields">')) + '</fieldset>'.length);
const style = template.slice(template.indexOf('.tntt-profile-fields {'), template.indexOf('.order-table .student-level-cell'));
const bootstrap = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8');

test('Angular form handles student and leader ranks, clearing, and IELTS visibility on desktop and mobile', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 900}});
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html></html>'}));
            await page.goto('http://tntt-profile.test');
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + bootstrap + style +
                'body{padding:20px}main{max-width:650px;margin:auto}.margin-top-10{margin-top:10px}fieldset{margin-bottom:20px}' +
                '</style></head><body><main id="qa" ng-controller="Qa as vm"><h3>Thông tin học sinh</h3>' +
                '<div ng-if="!vm.isIeltsRoomDomain">' + fieldset + '</div>' +
                '<button id="save" ng-click="vm.save()">Lưu</button>' +
                '<p id="summary" ng-if="!vm.isIeltsRoomDomain">{{vm.getTnttProfileLabel(vm.saved) || "Chưa xác định"}}</p>' +
                '</main></body></html>');
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
            await page.evaluate(code => {
                angular.module('Qa', []).controller('Qa', function () {
                    const vm = this;
                    vm.isIeltsRoomDomain = false;
                    vm.user = {person: {tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 2}};
                    vm.saved = angular.copy(vm.user);
                    new Function('vm', 'toastr', code)(vm, {error: message => {window.validationError = message;}});
                    vm.save = () => { if (vm.validateTnttProfile()) vm.saved = angular.copy(vm.user); };
                    window.qaVm = vm;
                });
                angular.bootstrap(document.getElementById('qa'), ['Qa']);
            }, profileCode);

            assert.equal(await page.locator('#summary').innerText(), 'Ấu nhi — Cấp II');
            const selectCode = async (selector, value) => {
                await page.locator(selector).selectOption(await page.locator(selector + ' option').evaluateAll(
                    (options, value) => options.find(option => option.value.endsWith(':' + value)).value, value));
            };
            await selectCode('#tntt-branch', 'THIEU_NHI');
            assert.equal(await page.evaluate(() => window.qaVm.user.person.tnttLevel), null);
            await selectCode('#tntt-level', '3');
            await page.locator('#save').click();
            assert.equal(await page.locator('#summary').innerText(), 'Thiếu nhi — Cấp III');
            await selectCode('#tntt-member-type', 'HUYNH_TRUONG');
            assert.equal(await page.locator('#tntt-branch').count(), 0);
            assert.equal(await page.locator('label[for="tntt-level"]').innerText(), 'Cấp Huynh trưởng');
            await selectCode('#tntt-level', '4');
            await page.locator('#save').click();
            assert.equal(await page.locator('#summary').innerText(), 'Huynh trưởng — Đặc cấp');
            await page.screenshot({path: path.join(repo, `.tmp/tntt-profile-${width}.png`)});
            await selectCode('#tntt-member-type', 'DU_TRUONG');
            assert.equal(await page.locator('#tntt-level').count(), 0);
            await page.locator('#save').click();
            assert.equal(await page.locator('#summary').innerText(), 'Dự trưởng');
            await page.locator('#tntt-member-type').selectOption('');
            await page.locator('#save').click();
            assert.equal(await page.locator('#summary').innerText(), 'Chưa xác định');
            assert.deepEqual(await page.evaluate(() => window.qaVm.saved.person),
                {tnttMemberType: null, tnttBranch: null, tnttLevel: null});
            await page.evaluate(() => {
                angular.element(document.getElementById('qa')).scope().$apply(() => { window.qaVm.isIeltsRoomDomain = true; });
            });
            assert.equal(await page.locator('.tntt-profile-fields').count(), 0);
            assert.equal(await page.locator('#summary').count(), 0);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
