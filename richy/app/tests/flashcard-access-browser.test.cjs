const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'question/controllers/QuestionController.js'), 'utf8');
const template = fs.readFileSync(path.join(app, 'question/views/listing.html'), 'utf8');
const policies = source.slice(source.indexOf('vm.canManageFullFlashCards ='), source.indexOf('// console.log(vm.currentUser)'));
const saves = source.slice(source.indexOf('\n        vm.newFlashCard = function ()'), source.indexOf('vm.saveImportant = function'));
const panelStart = template.lastIndexOf('<div class="portlet light bordered">', template.indexOf('<h4 class="bold">NEW WORD'));
const panel = template.slice(panelStart, template.indexOf('<!--<div ng-if="vm.showListFlashCard', panelStart));
const listStart = template.indexOf('<div class="flashcard-delete-toolbar"');
const list = template.slice(listStart, template.indexOf('<!--<div  id="flashcards"', listStart));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);

async function fixture(browser, role, reached = false) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setContent('<html><body><main ng-controller="Fixture as vm">' +
        (list + panel).replace(/<textarea\b([^>]*?)\/>/g, '<textarea$1></textarea>') + '</main></body></html>');
    for (const file of ['angular.min.js', 'angular-sanitize.min.js']) {
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
    }
    await page.evaluate(({role, reached, policies, saves}) => {
        window.requests = []; window.messages = [];
        const max = role === 'USER' ? 10000 : 5000;
        window.usage = {role, wordCount: reached ? max : 3, wordLimit: role === 'ADMIN' ? -1 : max,
            wordLimitReached: reached, wordLimitMessage: `Bạn đã có ${max}/${max} thẻ từ vựng và đã đạt hạn mức của tài khoản. Bạn vẫn có thể sửa và học các thẻ đã có. Liên hệ quản trị viên để được hỗ trợ giải phóng hoặc nâng hạn mức trước khi thêm từ mới.`};
        angular.module('FixtureApp', ['ngSanitize']).filter('highlight', () => value => value)
            .controller('Fixture', ['$q', '$timeout', function ($q, $timeout) {
            const vm = this, settings = {isAdmin: role === 'ADMIN'};
            vm.currentUser = {id: 7, roles: [{name: 'ROLE_' + role}]};
            vm.newCard = {question: '', questionType: {id: 6}, userId: 7};
            vm.questions = [{id: 31, question: 'apple', motherTongue: 'quả táo', level: 'A1'}];
            vm.showListFlashCard = true; vm.status = {id: 3}; vm.searchDto = {pageIndex: 1, pageSize: 5};
            vm.allFlashCardsSelected = () => false; vm.getSelectedFlashCards = () => [];
            vm.isListeningFlashCardList = () => false; vm.getPageFlashCard = () => $q.when();
            const toastr = Object.fromEntries(['success', 'error', 'warning', 'info'].map(kind =>
                [kind, message => window.messages.push({kind, message})]));
            const service = {
                getVocabularyUsage: () => $q.when(angular.copy(window.usage)),
                saveObject(card) {
                    window.requests.push(angular.copy(card));
                    return $q.when(window.rejectCreate && !card.id ? {message: window.usage.wordLimitMessage} :
                        Object.assign({}, card, {id: card.id || 40}));
                }
            };
            new Function('vm', 'settings', 'service', 'document', 'toastr', 'blockUI', 'angular', '$timeout', 'buildNewCard',
                policies + '\n' + saves)(vm, settings, service, document, toastr, {start() {}, stop() {}}, angular, $timeout,
                () => ({question: '', questionType: {id: 6}, userId: 7}));
            window.vm = vm;
        }]);
        angular.bootstrap(document, ['FixtureApp']);
    }, {role, reached, policies, saves});
    await page.waitForFunction(() => window.vm && window.vm.vocabularyUsage, null, {timeout: 5000})
        .catch(error => { throw new Error(errors.join('\n') || error.message); });
    assert.deepEqual(errors, []);
    return page;
}

test('VIEWER and USER see basic fields, export and a clear quota explanation while editing remains possible', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const role of ['VIEWER', 'USER']) {
            const page = await fixture(browser, role, true);
            const max = role === 'USER' ? '10,000' : '5,000';
            assert.match(await page.locator('.alert').innerText(), new RegExp(max));
            assert.match(await page.locator('.alert').innerText(), /sửa và học/);
            assert.match(await page.locator('.alert').innerText(), /Liên hệ quản trị viên/);
            assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), true);
            assert.equal(await page.getByRole('button', {name: 'Export Excel'}).count(), 1);
            assert.equal(await page.getByRole('button', {name: 'Import Excel'}).count(), 0);
            assert.equal(await page.locator('textarea[ng-model="vm.newCard.description"]').count(), 0);
            assert.equal(await page.locator('[ng-click="vm.duplicateFlashCard(item)"]').count(), 0);
            assert.equal(await page.getByText('Question Answers', {exact: true}).count(), 0);
            await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).fill('nghĩa mới');
            await page.evaluate(() => { window.vm.editFlashCard(window.vm.questions[0]); angular.element(document).injector().get('$rootScope').$apply(); });
            assert.equal(await page.evaluate(() => window.requests[0].motherTongue), 'nghĩa mới');
            assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), true);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('oversized inputs stay intact and explain the field limit, and a late quota response preserves the form', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const page = await fixture(browser, 'VIEWER');
        await page.getByLabel('Word mới', {exact: true}).fill('x'.repeat(201));
        assert.equal((await page.getByLabel('Word mới', {exact: true}).inputValue()).length, 201);
        assert.equal(await page.evaluate(() => window.vm.newCard.question.length), 201);
        assert.match(await page.locator('p.text-danger').innerText(), /200 ký tự/);
        assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), true);
        await page.getByLabel('Word mới', {exact: true}).fill('new word');
        await page.getByLabel('Nghĩa tiếng Việt mới', {exact: true}).fill('x'.repeat(501));
        assert.match(await page.locator('p.text-danger').innerText(), /500 ký tự/);
        await page.getByLabel('Nghĩa tiếng Việt mới', {exact: true}).fill('keep this');
        await page.evaluate(() => { window.rejectCreate = true; window.usage.wordLimitReached = true; });
        await page.getByRole('button', {name: 'New card'}).click();
        await page.waitForFunction(() => window.vm.vocabularyUsage.wordLimitReached && !window.vm.newCardSaving);
        assert.equal(await page.getByLabel('Word mới', {exact: true}).inputValue(), 'new word');
        assert.equal(await page.getByLabel('Nghĩa tiếng Việt mới', {exact: true}).inputValue(), 'keep this');
        assert.match(await page.evaluate(() => window.messages.at(-1).message), /quản trị viên/);
    } finally { await browser.close(); }
});

test('ADMIN keeps advanced fields but has no flashcard answer editor or quota block', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const page = await fixture(browser, 'ADMIN');
        assert.equal(await page.getByRole('button', {name: 'Import Excel'}).count(), 1);
        assert.equal(await page.locator('textarea[ng-model="vm.newCard.description"]').count(), 1);
        assert.equal(await page.getByText('Question Answers', {exact: true}).count(), 0);
        assert.equal(await page.locator('.alert').count(), 0);
        await page.getByLabel('Word mới', {exact: true}).fill('apple');
        assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), false);
        const description = page.locator('textarea[ng-model="vm.newCard.description"]');
        await description.fill('<p>' + 'x'.repeat(2000) + '</p>');
        assert.equal(await page.evaluate(() => window.vm.descriptionLength(window.vm.newCard.description)), 2000);
        assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), false);
        await description.fill('<p>' + 'x'.repeat(2001) + '</p>');
        assert.equal(await page.getByRole('button', {name: 'New card'}).isDisabled(), true);
        assert.match(await page.locator('p.text-danger').innerText(), /2.000 ký tự nội dung/);
    } finally { await browser.close(); }
});
