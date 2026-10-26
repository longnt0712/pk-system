const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');

test('Hoa thiêng uses the real class tree with public filtering on desktop and mobile', {timeout: 60000}, async () => {
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await chromium.launch({headless: true, executablePath: chrome});
    const classes = [{id: 10, name: 'Ấu Nhi', code: 'AN', schoolId: 2, parentId: null},
        {id: 11, name: 'Lucia - Vâng Lời', code: 'LC', schoolId: 2, parentId: 10},
        {id: 20, name: 'Ca đoàn', code: 'CD', schoolId: 2, parentId: null}];
    const css = ['assets/css/external/bootstrap.min.css', 'assets/css/external/font-awesome.min.css',
        'common/class-tree-picker.css', 'campaign/field.css'].map(read).join('\n');
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 850}});
            const requests = [], errors = [];
            let classReads = 0;
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const request = route.request(), url = new URL(request.url());
                assert.equal(request.method(), 'GET', 'Fixture must never write data');
                if (url.pathname.startsWith('/service/')) {
                    assert.equal(request.headers().authorization, undefined);
                    let result;
                    if (url.pathname.startsWith('/service/public/campaigns/by-code/')) {
                        result = {id: 5, shareCode: 'c'.repeat(32), name: 'Cùng Mẹ, em yêu mến Chúa', startDate: '2026-10-01', endDate: '2026-10-31', flowerItems: []};
                    } else if (url.pathname === '/service/public/campaigns/5/field/classes') {
                        classReads++; result = classes;
                    } else if (url.pathname === '/service/public/campaigns/5/field') {
                        requests.push(Object.fromEntries(url.searchParams)); result = {gardens: [], hasMore: false};
                    } else { throw Error('Unexpected API ' + url.pathname); }
                    return route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});
                }
                const local = path.join(app, url.pathname.startsWith('/fonts/') ? 'assets' + url.pathname : url.pathname.replace(/^\//, ''));
                return fs.existsSync(local) && fs.statSync(local).isFile() ? route.fulfill({path: local}) :
                    route.fulfill({contentType: 'text/html', body: '<html></html>'});
            });
            await page.goto('http://flower-picker.test');
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
                '</style></head><body><div ng-controller="CampaignFieldController as vm">' + read('campaign/views/field.html') + '</div></body></html>');
            for (const file of ['angular.min.js', 'ui-bootstrap-tpls.min.js']) {
                await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
            }
            await page.evaluate(() => {
                window.FlowerGarden2026 = {enabled: () => true, svgMarkup: () => ''};
                angular.module('Hrm.Common', []);
                angular.module('Hrm.Campaign', ['Hrm.Common', 'ui.bootstrap'])
                    .value('settings', {campaignsEnabled: true, permissionsLoaded: true, api: {baseUrl: '/service/'}})
                    .value('AuthSession', {hasCredentials: () => false})
                    .value('$state', {go() {}}).value('$stateParams', {campaignCode: 'c'.repeat(32)});
            });
            for (const file of ['common/directives/ClassTreePicker.js', 'campaign/business/CampaignService.js', 'campaign/controllers/CampaignFieldController.js']) {
                await page.addScriptTag({path: path.join(app, file)});
            }
            await page.evaluate(() => angular.bootstrap(document.body, ['Hrm.Campaign']));
            await page.waitForFunction(() => {
                const scope = angular.element(document.querySelector('class-tree-picker')).isolateScope();
                return scope && scope.picker.classes.length === 3;
            });
            assert.equal(requests.length, 1); assert.equal(classReads, 1);
            const trigger = page.getByRole('button', {name: 'Chọn lớp để lọc Hoa thiêng', exact: true});
            const dialog = page.locator('.class-tree-dialog');
            await trigger.click();
            await page.waitForFunction(() => {
                const modal = document.querySelector('.class-tree-picker-window');
                if (!modal || getComputedStyle(modal).opacity !== '1') { return false; }
                return new DOMMatrix(getComputedStyle(modal.querySelector('.modal-dialog')).transform).m42 === 0;
            });
            assert.equal(await dialog.locator('.class-tree-row').count(), 2);
            const layout = await page.evaluate(() => {
                const modal = document.querySelector('.class-tree-picker-window'), box = document.querySelector('.class-tree-dialog').getBoundingClientRect();
                return {z: +getComputedStyle(modal).zIndex, fieldZ: +getComputedStyle(document.querySelector('.campaign-field-page')).zIndex,
                    left: box.left, right: box.right, width: innerWidth};
            });
            assert.ok(layout.z > layout.fieldZ); assert.ok(layout.left >= 0 && layout.right <= layout.width);
            await dialog.getByRole('searchbox', {name: 'Tìm lớp hoặc đội'}).fill('vang loi');
            assert.equal(await dialog.locator('.class-tree-row').count(), 2);
            await dialog.locator('.class-tree-option').filter({hasText: 'Lucia'}).click();
            await dialog.waitFor({state: 'detached'});
            await page.waitForFunction(() => !angular.element(document.querySelector('class-tree-picker')).scope().vm.loading);
            assert.equal(requests.length, 2); assert.equal(requests[1].classId, '11'); assert.equal(requests[1].cursor, '');
            assert.match(await trigger.innerText(), /Ấu Nhi.*Lucia/);
            await page.evaluate(() => document.documentElement.classList.add('global-dark-mode'));
            await trigger.click();
            assert.equal(await dialog.locator('.class-tree-row').count(), 2, 'Reopening must reset to parent classes');
            await dialog.locator('.modal-footer').getByRole('button', {name: 'Đóng', exact: true}).click();
            await dialog.waitFor({state: 'detached'});
            assert.equal(requests.length, 2, 'Cancel must preserve the current filter');
            await page.getByRole('button', {name: 'Bỏ lọc lớp', exact: true}).click();
            await page.waitForFunction(() => !angular.element(document.querySelector('class-tree-picker')).scope().vm.loading);
            assert.equal(requests.length, 3); assert.equal(requests[2].classId, undefined);
            assert.equal(classReads, 1); assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
