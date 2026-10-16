// Run with: node --test richy/app/tests/flashcard-listening-delete-browser.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const assetApp = process.env.FLASHCARD_ASSET_APP || app;
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const source = fs.readFileSync(path.join(app, 'question/controllers/QuestionController.js'), 'utf8');
const template = fs.readFileSync(path.join(app, 'question/views/listing.html'), 'utf8');
const feature = source.slice(source.indexOf('vm.selectedListeningCardIds = {};'), source.indexOf('// $scope.setPage'));
const loadPage = source.slice(source.indexOf('vm.getPageFlashCard = function ()'), source.indexOf('vm.clickShowListFlashCard = function'));
const listStart = template.indexOf('<div class="listening-delete-toolbar"');
const listEnd = template.indexOf('<!--<div  id="flashcards"', listStart);
// The app's jQuery template loader expands these legacy self-closing textareas.
const listTemplate = template.slice(listStart, listEnd).replace(/<textarea\b([^>]*?)\/>/g, '<textarea$1></textarea>');
const modalStart = template.indexOf('<script type="text/ng-template" id="confirm_delete_listening_cards_modal.html">');
const modalTemplate = template.slice(modalStart, template.indexOf('</script>', modalStart) + '</script>'.length);
const styles = [...template.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const bootstrap = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css',
    'assets/fontawesome/css/all.css'].map(name => fs.readFileSync(path.join(assetApp, name), 'utf8')).join('\n');

async function settledModal(page) {
    await page.locator('.modal-body').waitFor();
    await page.waitForFunction(() => {
        const dialog = document.querySelector('.modal-dialog');
        const modal = document.querySelector('.modal');
        const transform = getComputedStyle(dialog).transform;
        return getComputedStyle(modal).opacity === '1' &&
            (transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)');
    });
}

async function fixture(browser, width = 1440) {
    const page = await browser.newPage({viewport: {width, height: 1000}});
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/webfonts/')) {
            return route.fulfill({body: fs.readFileSync(path.join(assetApp, 'assets/fontawesome/webfonts', path.basename(url.pathname)))});
        }
        return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'});
    });
    await page.goto('http://flashcard-delete.test');
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + bootstrap + styles +
        'body{padding:24px!important;background:#f7f8fc;}main{padding:20px;background:white;border-radius:16px}.btn-brown{background:#3b142c;color:white}.hover-item{margin-bottom:4px}</style></head>' +
        '<body><main ng-controller="Fixture as vm"><h2>Flashcard</h2>' +
        '<label>Loại thẻ <select id="status" ng-model="vm.status.id" ng-options="status.id as status.name for status in vm.statuses" ' +
        'ng-change="vm.searchDto.status=vm.status.id;vm.searchDto.pageIndex=1;vm.getPageFlashCard()"></select></label>' +
        '<div class="row"><div class="col-md-12">' + listTemplate +
        '</div></div>' + modalTemplate + '</main></body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js', 'angular-sanitize.min.js', 'ui-bootstrap-tpls.min.js']) {
        await page.addScriptTag({path: path.join(assetApp, 'assets/scripts/external', name)});
    }
    await page.evaluate(({feature, loadPage}) => {
        window.records = [1, 2, 3, 4, 5, 6].map(id => ({id, question: 'Mirror ' + id, pronounce: '',
            motherTongue: 'Do you like looking at yourself in the mirror? Answer ' + id,
            level: 'A2', status: 5, showDetail: false}));
        window.records.push({id: 20, question: 'Vocabulary', status: 1, level: 'B1', showDetail: false});
        window.deletes = [];
        window.messages = [];
        angular.module('FixtureApp', ['ui.bootstrap', 'ngSanitize'])
            .controller('Fixture', ['$scope', '$uibModal', '$q', function ($scope, modal, $q) {
                const vm = this;
                vm.status = {id: 3};
                vm.statuses = [{id: 3, name: 'Tất cả (no listening)'}, {id: 5, name: 'Listening'}];
                vm.searchDto = {status: 3, pageIndex: 1, pageSize: 5};
                vm.currentUser = {id: 7, username: 'teacher'};
                vm.showListFlashCard = true;
                vm.createQuiz = () => {};
                vm.loadLevelTable = () => {};
                const toastr = {};
                for (const type of ['error', 'success']) toastr[type] = message => window.messages.push({type, message});
                const service = {
                    getPage(dto, index, size) {
                        const cards = window.records.filter(card => dto.status === 5 ? card.status === 5 : card.status !== 5);
                        return $q.when({content: angular.copy(cards.slice((index - 1) * size, index * size)), totalElements: cards.length});
                    },
                    deleteObject(id) {
                        window.deletes.push(id);
                        const pending = $q.defer();
                        function finish() {
                            if (window.failId === id) pending.resolve(false);
                            else {window.records = window.records.filter(card => card.id !== id); pending.resolve(true);}
                        }
                        if (window.holdDelete) window.releaseDelete = finish;
                        else finish();
                        return pending.promise;
                    }
                };
                new Function('vm', 'angular', 'modal', '$scope', 'service', 'toastr', 'blockUI',
                    'shuffleArray1', 'shuffleArray2', feature + '\n' + loadPage)(
                    vm, angular, modal, $scope, service, toastr, {start() {}, stop() {}}, () => {}, () => {});
                window.fixtureVm = vm;
                vm.getPageFlashCard();
            }]);
        angular.bootstrap(document, ['FixtureApp']);
    }, {feature, loadPage});
    return {page, errors};
}

test('Listening controls, cancel, single delete, bulk confirmation and filter reset work in the browser', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, errors} = await fixture(browser);
        assert.equal(await page.locator('.listening-delete-toolbar').count(), 0);
        assert.equal(await page.locator('.listening-card-delete').count(), 0);
        await page.selectOption('#status', {label: 'Listening'});
        await page.locator('.listening-delete-toolbar').waitFor();
        assert.equal(await page.locator('.listening-card-delete').count(), 5);
        const bulk = page.getByRole('button', {name: /Xóa đã chọn/});
        assert.equal(await bulk.isDisabled(), true);
        await page.getByRole('checkbox', {name: 'Chọn flashcard Mirror 2 (ID 2)', exact: true}).check();
        await bulk.click();
        await settledModal(page);
        assert.match(await page.locator('.modal-body').innerText(), /1 flashcard Listening/);
        assert.deepEqual(await page.evaluate(() => window.deletes), []);
        await page.getByRole('button', {name: 'Hủy', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.deepEqual(await page.evaluate(() => window.deletes), []);
        await page.getByRole('button', {name: 'Xóa flashcard Mirror 1 (ID 1)', exact: true}).click();
        await page.getByRole('button', {name: 'Xóa 1 thẻ', exact: true}).click();
        await page.waitForFunction(() => window.deletes.length === 1 && !window.fixtureVm.listeningDeleteBusy);
        assert.deepEqual(await page.evaluate(() => window.deletes), [1]);
        assert.equal(await page.locator('input[type=checkbox]:checked').count(), 0);
        await page.getByRole('button', {name: 'Chọn tất cả trên trang', exact: true}).click();
        await bulk.click();
        assert.match(await page.locator('.modal-body').innerText(), /5 flashcard Listening/);
        await page.getByRole('button', {name: 'Xóa 5 thẻ', exact: true}).click();
        await page.waitForFunction(() => window.deletes.length === 6 && !window.fixtureVm.listeningDeleteBusy);
        assert.deepEqual(await page.evaluate(() => window.deletes), [1, 2, 3, 4, 5, 6]);
        assert.equal(await page.locator('.listening-card-delete').count(), 0);
        await page.selectOption('#status', {label: 'Tất cả (no listening)'});
        assert.equal(await page.locator('.listening-delete-toolbar').count(), 0);
        assert.match(await page.locator('main').innerText(), /Flashcard/);
        assert.deepEqual(errors, []);
    } finally {await browser.close();}
});

test('Listening actions fit desktop and phone widths; confirmation wraps long content', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [1440, 390]) {
            const {page, errors} = await fixture(browser, width);
            await page.selectOption('#status', {label: 'Listening'});
            await page.getByRole('button', {name: 'Chọn tất cả trên trang', exact: true}).click();
            assert.equal(await page.locator('input[type=checkbox]:checked').count(), 5);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (process.env.FLASHCARD_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.FLASHCARD_SCREENSHOT_DIR, {recursive: true});
                await page.screenshot({path: path.join(process.env.FLASHCARD_SCREENSHOT_DIR, 'listening-delete-' + width + '.png'), fullPage: true});
            }
            await page.getByRole('button', {name: /Xóa đã chọn/}).click();
            await settledModal(page);
            assert.equal(await page.locator('.listening-delete-preview li').count(), 5);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (process.env.FLASHCARD_SCREENSHOT_DIR) {
                await page.screenshot({path: path.join(process.env.FLASHCARD_SCREENSHOT_DIR, 'listening-delete-confirm-' + width + '.png'), fullPage: true});
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {await browser.close();}
});
