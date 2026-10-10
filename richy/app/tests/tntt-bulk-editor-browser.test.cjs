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
const code = source.slice(source.indexOf('// TNTT profile:'), source.indexOf('// End TNTT bulk editor.'));
const start = template.indexOf('<script type="text/ng-template" id="tntt_bulk_modal.html">');
const modalTemplate = template.slice(start, template.indexOf('</script>', start) + '</script>'.length);
const button = template.match(/<button type="button" class="btn btn-primary margin-left-10"\s+ng-if="vm.canEditTntt\(\)"[\s\S]*?<\/button>/)[0];
const style = template.slice(template.indexOf('.tntt-profile-fields {'), template.indexOf('.order-table .student-level-cell'));
const bootstrap = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8');
const users = [
    {id: 7, username: 'HS001', person: {lastName: 'Nguyễn Văn', firstName: 'An', birthDate: '2010-01-02',
        tnttMemberType: 'DOAN_SINH', tnttBranch: 'AU_NHI', tnttLevel: 2}},
    {id: 8, username: 'HS002', person: {lastName: 'Trần', firstName: 'Bình', birthDate: '2000-02-03',
        tnttMemberType: 'HUYNH_TRUONG', tnttBranch: null, tnttLevel: 4}},
    {id: 9, username: 'HS003', person: {lastName: 'Lê', firstName: 'Chi'}}
];

test('actual modal opens from toolbar, edits columns and retries only failed rows on desktop and mobile', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 900}});
            const errors = [], requests = [];
            const server = JSON.parse(JSON.stringify(users));
            let failFirstStudent = true;
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html></html>'}));
            await page.route('**/api/users/*/tntt-profile', async route => {
                const id = Number(route.request().url().match(/users\/(\d+)/)[1]);
                const patch = route.request().postDataJSON();
                requests.push({id, patch});
                await new Promise(resolve => setTimeout(resolve, 150));
                if (id === 7 && failFirstStudent) {
                    failFirstStudent = false;
                    return route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({message: 'Không lưu được học sinh An'})});
                }
                const person = server.find(user => user.id === id).person;
                Object.assign(person, patch);
                return route.fulfill({contentType: 'application/json', body: JSON.stringify(person)});
            });
            await page.goto('http://tntt-bulk.test');
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<style>' + bootstrap + style + 'main{padding:20px}body{background:#f5f7fa}</style></head>' +
                '<body><main id="qa" ng-controller="Qa as vm"><h3>Danh sách học sinh</h3>' + button + modalTemplate + '</main></body></html>');
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/ui-bootstrap-tpls.min.js')});
            await page.evaluate(() => {angular.module('Hrm.User', []).value('settings', {api: {baseUrl: '/', apiPrefix: 'api/'}}).value('Utilities', {});});
            await page.addScriptTag({path: path.join(app, 'users/business/UserService.js')});
            await page.evaluate(({code, users}) => {
                angular.module('Qa', ['ui.bootstrap', 'Hrm.User']).controller('Qa', ['$scope', '$q', '$uibModal', 'UserService',
                    function ($scope, $q, modal, service) {
                        const vm = this;
                        vm.isIeltsRoomDomain = false; vm.isRoleStudentManagerment = true;
                        vm.users = users; vm.user = {person: {}}; vm.getDisplayedUsers = () => vm.users.slice();
                        new Function('vm', 'toastr', '$scope', '$q', 'modal', 'service', code)(vm,
                            {success: () => {}, error: () => {}}, $scope, $q, modal, service);
                        window.qaVm = vm;
                    }]);
                angular.bootstrap(document.body, ['Qa']);
            }, {code, users});

            const open = page.getByRole('button', {name: 'Sửa/Thêm thông tin TNTT', exact: true});
            await open.click();
            const rows = page.locator('.tntt-bulk-table tbody tr');
            assert.equal(await rows.count(), 3);
            assert.match(await rows.nth(0).innerText(), /Nguyễn Văn An[\s\S]*HS001[\s\S]*02\/01\/2010/);
            assert.equal(await page.locator('.tntt-bulk-modal input:not([type=checkbox])').count(), 0);
            const branch = page.getByRole('combobox', {name: 'Ngành TNTT của Nguyễn Văn An', exact: true});
            const rank = page.getByRole('combobox', {name: 'Cấp TNTT của Nguyễn Văn An', exact: true});
            const leaderRank = page.getByRole('combobox', {name: 'Cấp TNTT của Trần Bình', exact: true});
            assert.equal(await branch.isDisabled(), true);
            assert.equal(await rank.isDisabled(), true);
            const branchHeader = page.getByRole('checkbox', {name: 'Sửa cả cột ngành TNTT', exact: true});
            await branchHeader.check(); assert.equal(await branch.isEnabled(), true);
            assert.equal(await rank.isDisabled(), true);
            const selectCode = async (select, value) => select.selectOption(await select.locator('option').evaluateAll(
                (options, value) => options.find(option => option.value.endsWith(':' + value)).value, value));
            await selectCode(branch, 'THIEU_NHI');
            assert.equal(await page.evaluate(() => window.qaVm.tnttBulk.rows[0].profile.tnttLevel), null);
            assert.equal(await page.evaluate(() => window.qaVm.users[0].person.tnttBranch), 'AU_NHI');
            await page.getByRole('checkbox', {name: 'Sửa cả cột cấp TNTT', exact: true}).check();
            assert.equal(await rank.isEnabled(), true); assert.equal(await leaderRank.isEnabled(), true);
            assert.equal(await rank.locator('option').count(), 4);
            assert.equal(await leaderRank.locator('option').count(), 5);
            await selectCode(rank, '2'); await selectCode(leaderRank, '3');
            await branchHeader.uncheck(); assert.equal(await branch.isDisabled(), true);
            assert.equal(await page.evaluate(() => window.qaVm.tnttChangedCount()), 2);
            const blankType = page.getByRole('combobox', {name: 'Thành phần TNTT của Lê Chi', exact: true});
            await page.getByRole('checkbox', {name: 'Sửa thành phần TNTT của Lê Chi', exact: true}).check();
            assert.equal(await blankType.isEnabled(), true);
            await selectCode(blankType, 'DOAN_SINH');
            const blankRank = page.getByRole('combobox', {name: 'Cấp TNTT của Lê Chi', exact: true});
            assert.equal(await blankRank.isDisabled(), true);
            await page.screenshot({path: path.join(repo, `.tmp/tntt-bulk-editor-${width}.png`)});
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
            // Cancel discards all drafts; re-open and edit two rows to exercise server errors.
            await page.getByRole('button', {name: 'Đóng', exact: true}).last().click();
            await page.locator('.tntt-bulk-modal').waitFor({state: 'detached'});
            await open.click();
            assert.equal(await page.evaluate(() => window.qaVm.tnttChangedCount()), 0);
            await branchHeader.check(); await selectCode(branch, 'THIEU_NHI');
            await page.getByRole('checkbox', {name: 'Sửa cả cột cấp TNTT', exact: true}).check();
            await selectCode(rank, '2'); await selectCode(leaderRank, '3');
            await page.getByRole('button', {name: 'Lưu thay đổi', exact: true}).click();
            assert.equal(await page.getByRole('button', {name: 'Đóng', exact: true}).last().isDisabled(), true);
            await page.waitForFunction(() => !window.qaVm.tnttBulk.saving);
            assert.match(await rows.nth(0).innerText(), /Không lưu được học sinh An/);
            assert.match(await rows.nth(1).innerText(), /Đã lưu/);
            assert.equal(await page.evaluate(() => window.qaVm.tnttChangedCount()), 1);
            await page.getByRole('button', {name: 'Lưu thay đổi', exact: true}).click();
            await page.waitForFunction(() => !window.qaVm.tnttBulk.saving && window.qaVm.tnttChangedCount() === 0);
            assert.deepEqual(requests, [
                {id: 7, patch: {tnttBranch: 'THIEU_NHI', tnttLevel: 2}},
                {id: 8, patch: {tnttLevel: 3}},
                {id: 7, patch: {tnttBranch: 'THIEU_NHI', tnttLevel: 2}}
            ]);
            assert.equal(await page.getByRole('button', {name: 'Lưu thay đổi', exact: true}).isDisabled(), true);
            await page.getByRole('button', {name: 'Đóng', exact: true}).last().click();
            await page.locator('.tntt-bulk-modal').waitFor({state: 'detached'});
            await page.evaluate(() => {
                angular.element(document.getElementById('qa')).scope().$apply(() => {window.qaVm.isIeltsRoomDomain = true;});
            });
            assert.equal(await open.count(), 0);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {await browser.close();}
});
