// Run with: node --test richy/app/tests/flashcard-excel-import-topic-browser.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const template = fs.readFileSync(path.join(app, 'question/views/listing.html'), 'utf8');
const start = template.indexOf('<script type="text/ng-template" id="question_excel_import_modal.html">');
const modalTemplate = template.slice(start, template.indexOf('</script>', start) + '</script>'.length);
const button = template.match(/<button type="button" class="btn btn-success" question-excel-import[\s\S]*?<\/button>/)[0];
const styles = [...template.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const css = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css',
    'assets/fontawesome/css/all.css'].map(name => fs.readFileSync(path.join(app, name), 'utf8')).join('\n');

async function settledModal(page) {
    await page.locator('.modal-body').waitFor();
    await page.waitForFunction(() => {
        const modal = document.querySelector('.modal'), dialog = document.querySelector('.modal-dialog');
        const transform = getComputedStyle(dialog).transform;
        return getComputedStyle(modal).opacity === '1' &&
            (transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)');
    });
}

async function fixture(browser, {width = 1440, existing = false, failSave = false, failPreview = false, failCategories = false} = {}) {
    const page = await browser.newPage({viewport: {width, height: 1100}});
    page.setDefaultTimeout(10000);
    const state = {saves: [], previews: [], confirms: [], errors: [], failSave, failPreview, failCategories};
    page.on('pageerror', error => state.errors.push(error.message));
    const categories = [{id: 7, name: 'IELTS'}, {id: 9, name: 'Giao tiếp'}];
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        function json(data, status = 200) {return route.fulfill({status, contentType: 'application/json', body: JSON.stringify(data)});}
        if (url.pathname.startsWith('/api/topic_category/get_page/')) {
            return state.failCategories ? json({message: 'Category unavailable'}, 503) : json({content: categories, totalPages: 1});
        }
        if (url.pathname === '/api/topic/save') {
            const dto = request.postDataJSON();
            state.saves.push(dto);
            if (state.failSave) return json({message: 'Could not save topic'}, 500);
            return json({...dto, id: 41, topicCategory: categories.find(category => category.id === dto.topicCategory.id)});
        }
        if (url.pathname === '/api/question/import_excel/preview') {
            state.previews.push(request.postDataBuffer().toString('latin1'));
            if (state.failPreview) return json({message: 'Invalid worksheet'}, 422);
            return json({rows: [
                {rowNumber: 2, word: 'apple', motherTongue: 'quả táo', level: 'A2', status: 'NEW'},
                {rowNumber: 3, word: 'pear', motherTongue: 'quả lê', level: 'B1', status: 'NEW'}
            ]});
        }
        if (url.pathname === '/api/question/import_excel/confirm') {
            state.confirms.push(request.postDataJSON());
            return json({success: true, createdCount: 2, message: 'Import thành công'});
        }
        if (url.pathname.includes('/webfonts/')) {
            return route.fulfill({body: fs.readFileSync(path.join(app, 'assets/fontawesome/webfonts', path.basename(url.pathname)))});
        }
        return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'});
    });
    await page.goto('http://excel-import.test/');
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + css + styles +
        'body{padding:24px!important;background:#f7f8fc}</style></head><body><main ng-controller="Fixture as vm">' +
        button + modalTemplate + '</main></body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js', 'angular-sanitize.min.js', 'ui-bootstrap-tpls.min.js']) {
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external', name)});
    }
    await page.evaluate(existing => {
        window.messages = [];
        window.createdNotifications = 0;
        window.importedNotifications = 0;
        angular.module('Hrm.Common', []);
        angular.module('Hrm.Topic', []);
        angular.module('Hrm.Question', ['ui.bootstrap', 'ngSanitize', 'Hrm.Common', 'Hrm.Topic'])
            .value('settings', {api: {baseUrl: '/', apiV1Url: 'api/'}})
            .value('toastr', Object.fromEntries(['error', 'warning', 'success'].map(type =>
                [type, message => window.messages.push({type, message})])))
            .controller('Fixture', function () {
                this.currentUser = {id: 5};
                this.topics = existing ? [{id: 8, name: 'Existing topic'}] : [];
                this.getTopics = () => window.createdNotifications++;
                this.onFlashCardImported = () => window.importedNotifications++;
            });
    }, existing);
    for (const file of ['common/utils/utilities.js', 'topic/business/TopicService.js', 'question/business/QuestionService.js',
        'question/controllers/QuestionExcelImportController.js']) {
        await page.addScriptTag({path: path.join(app, file)});
    }
    await page.evaluate(() => angular.bootstrap(document, ['Hrm.Question']));
    await page.getByRole('button', {name: 'Import Excel', exact: true}).click();
    await settledModal(page);
    return {page, state};
}

async function fillNewTopic(page) {
    await page.getByLabel('Tên topic mới').fill('  My words  ');
    await page.locator('#excel-import-topic-category option').filter({hasText: 'Giao tiếp'}).waitFor({state: 'attached'});
    await page.getByLabel('Category (loại topic)').selectOption({label: 'Giao tiếp'});
    await page.locator('input[type=file]').setInputFiles(path.join(app, 'question/templates/flashcard_import_template.xlsx'));
}

test('create topic with category and import within the same modal on desktop and mobile', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [1440, 390]) {
            const {page, state} = await fixture(browser, {width});
            assert.equal(await page.getByLabel('Tạo topic mới', {exact: true}).isChecked(), true);
            const preview = page.getByRole('button', {name: 'Tạo topic và xem trước', exact: true});
            assert.equal(await preview.isDisabled(), true);
            await fillNewTopic(page);
            assert.equal(await preview.isEnabled(), true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (process.env.EXCEL_IMPORT_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.EXCEL_IMPORT_SCREENSHOT_DIR, {recursive: true});
                await page.locator('.modal').evaluate(element => element.scrollTop = 0);
                await page.screenshot({path: path.join(process.env.EXCEL_IMPORT_SCREENSHOT_DIR, 'excel-new-topic-' + width + '.png'), fullPage: true});
            }
            await preview.click();
            await page.getByRole('button', {name: /Confirm import/}).waitFor();
            assert.deepEqual(state.saves, [{name: 'My words', userId: 5, topicCategory: {id: 9}, isShow: true}]);
            assert.equal(state.previews.length, 1);
            assert.match(state.previews[0], /name="topicId"\r\n\r\n41/);
            assert.match(state.previews[0], /filename="flashcard_import_template.xlsx"/);
            assert.match(await page.locator('.modal-body').innerText(), /My words/);
            assert.equal(await page.evaluate(() => window.createdNotifications), 1);
            assert.equal(state.confirms.length, 0);
            if (process.env.EXCEL_IMPORT_SCREENSHOT_DIR) {
                await page.screenshot({path: path.join(process.env.EXCEL_IMPORT_SCREENSHOT_DIR, 'excel-new-topic-preview-' + width + '.png'), fullPage: true});
            }
            await page.getByRole('button', {name: /Confirm import/}).click();
            await page.locator('.modal-dialog').waitFor({state: 'hidden'});
            assert.equal(state.confirms.length, 1);
            assert.equal(state.confirms[0].topicId, 41);
            assert.deepEqual(state.confirms[0].rows.map(row => row.word), ['apple', 'pear']);
            assert.equal(await page.evaluate(() => window.importedNotifications), 1);
            assert.deepEqual(state.errors, []);
            await page.close();
        }
    } finally {await browser.close();}
});

test('existing topic imports retain their original flow', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {existing: true});
        assert.equal(await page.getByLabel('Topic có sẵn', {exact: true}).isChecked(), true);
        await page.getByLabel('Topic', {exact: true}).selectOption({label: 'Existing topic'});
        await page.locator('input[type=file]').setInputFiles(path.join(app, 'question/templates/flashcard_import_template.xlsx'));
        await page.getByRole('button', {name: 'Read and preview', exact: true}).click();
        await page.getByRole('button', {name: /Confirm import/}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.deepEqual(state.saves, []);
        assert.match(state.previews[0], /name="topicId"\r\n\r\n8/);
        assert.equal(state.confirms[0].topicId, 8);
        assert.deepEqual(state.errors, []);
    } finally {await browser.close();}
});

test('category and creation errors preserve inputs; preview retry reuses the newly created topic', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {failCategories: true, failSave: true, failPreview: true});
        await page.getByRole('button', {name: 'Thử lại', exact: true}).waitFor();
        state.failCategories = false;
        await page.getByRole('button', {name: 'Thử lại', exact: true}).click();
        await fillNewTopic(page);
        await page.getByRole('button', {name: 'Tạo topic và xem trước', exact: true}).click();
        await page.waitForFunction(() => window.messages.some(message => message.message === 'Could not save topic'));
        assert.equal(state.previews.length, 0);
        assert.equal(await page.getByLabel('Tên topic mới').inputValue(), '  My words  ');
        state.failSave = false;
        await page.getByRole('button', {name: 'Tạo topic và xem trước', exact: true}).click();
        await page.waitForFunction(() => window.messages.some(message => message.message === 'Invalid worksheet'));
        assert.equal(await page.getByLabel('Topic', {exact: true}).inputValue(), '41');
        assert.equal(await page.evaluate(() => window.createdNotifications), 1);
        state.failPreview = false;
        await page.getByRole('button', {name: 'Read and preview', exact: true}).click();
        await page.getByRole('button', {name: /Confirm import/}).waitFor();
        assert.equal(state.saves.length, 2, 'one failed save and one successful save; preview retry must not create again');
        assert.equal(state.previews.length, 2);
        await page.getByRole('button', {name: 'Close', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.deepEqual(state.confirms, []);
        assert.deepEqual(state.errors, []);
    } finally {await browser.close();}
});
