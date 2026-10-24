const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read = name => fs.readFileSync(path.join(app, name), 'utf8');
const builder = read('question/views/create_ielts_reading_test.html');
const start = builder.indexOf('<div class="reading-builder-review-modal-backdrop"');
const review = builder.slice(start, builder.indexOf('</section>', start) + '</section>'.length) + '</div>';
const source = read('question/controllers/IELTSCreateReadingTestController.js');
const builderActions = source.slice(source.indexOf('        vm.goToBuilderTarget ='), source.indexOf('        vm.saveDraftReadingTest ='));

async function fixture(browser, listening = false, viewport = {width: 1024, height: 700}) {
    const page = await browser.newPage({viewport});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(6000);
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: route.request().url().includes('comprehensive_move_test_folder_modal.html') ? read('question/views/comprehensive_move_test_folder_modal.html') : '<!doctype html><html></html>'}));
    await page.goto('http://modal-focus.test/');
    const css = ['assets/css/external/bootstrap.min.css', 'assets/css/custom.css', 'assets/css/comprehensive-folders.css', 'assets/css/ui-layer-safety.css'].map(read).join('\n');
    const inlineCss = builder.slice(builder.lastIndexOf('<style>') + 7, builder.lastIndexOf('</style>'));
    await page.setContent('<!doctype html><html><head><style>' + css + '\n' + inlineCss + '</style></head><body><main id="fixture" ng-controller="Harness as vm">' +
        '<button id="review-open" ng-click="vm.openBuilderReviewModal()">Xem checklist</button>' +
        '<input id="background-input" aria-label="Background input" ng-model="vm.saved.title">' +
        '<button id="move-open" ng-disabled="vm.moveOpen" ng-click="vm.openMove()">Di chuyển</button>' +
        '<section id="builder-target"><h2>Questions</h2><input aria-label="Question title"></section>' + review +
        '<section id="nested-custom" ng-if="vm.nested" role="dialog" aria-label="Nested checklist" modal-focus modal-focus-close="vm.nested=false"><button id="nested-close" ng-click="vm.nested=false">Close nested</button></section>' +
        '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/ui-bootstrap-tpls.min.js')});
    await page.evaluate(() => angular.module('Hrm', ['ui.bootstrap']));
    await page.addScriptTag({path: path.join(app, 'common/utils/modalFocus.js')});
    await page.evaluate(({listening, builderActions}) => {
        angular.module('Hrm').controller('Harness', ['$scope', '$timeout', '$uibModal', function ($scope, $timeout, modal) {
            const vm = this;
            window.vm = vm;
            window.scope = $scope;
            $scope.settings = {isAdmin: true};
            vm.isListeningMode = listening;
            vm.saved = {title: 'Unchanged draft', questions: ['One', 'Two']};
            vm.refreshBuilderValidation = () => vm.builderValidation = {valid: false, parts: [], issues: [{message: 'Fix question one', target: 'builder-target'}, {message: 'Fix question two', target: 'builder-target'}]};
            new Function('vm', '$timeout', builderActions)(vm, $timeout);
            vm.openMove = function () {
                vm.moveOpen = true;
                const instance = modal.open({
                    templateUrl: 'question/views/comprehensive_move_test_folder_modal.html?v=test',
                    controllerAs: 'move',
                    controller: ['$uibModalInstance', function (dialog) {
                        Object.assign(this, {
                            testTitle: 'A long test title '.repeat(12), isFolder: vm.folderMode,
                            currentFolderId: null, selectedFolderId: null, choices: Array.from({length: 70}, (_, index) => ({id: index + 1, name: 'Folder ' + (index + 1), depth: 0})),
                            collapsed: {}, failures: [], label: () => 'Folder của tôi (cấp gốc)',
                            visible: () => true, hasChildren: () => false, canSelect: () => true,
                            select(id) {this.selectedFolderId = id;}, canMove() {return this.selectedFolderId !== null;},
                            save() {window.saves = (window.saves || 0) + 1; dialog.close();}, cancel() {dialog.dismiss('cancel');}
                        });
                    }]
                });
                instance.result.then(() => vm.moveOpen = false, () => vm.moveOpen = false);
            };
        }]);
        angular.bootstrap(document.getElementById('fixture'), ['Hrm']);
    }, {listening, builderActions});
    return {page, errors};
}

test('Reading and Listening checklist trap focus, close on Escape, and restore the opener without changing the draft', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const listening of [false, true]) {
            const {page, errors} = await fixture(browser, listening);
            for (let repeat = 0; repeat < 3; repeat++) {
                await page.locator('#review-open').click();
                await page.waitForFunction(() => document.activeElement.matches('.reading-builder-review-modal__close'));
                for (const key of ['Tab', 'Shift+Tab']) {
                    for (let tab = 0; tab < 10; tab++) {
                        await page.keyboard.press(key);
                        assert.equal(await page.evaluate(() => !!document.activeElement.closest('#reading-builder-review')), true);
                    }
                }
                // Programmatic background focus is also redirected into the open dialog.
                await page.evaluate(() => document.getElementById('background-input').focus());
                assert.equal(await page.evaluate(() => !!document.activeElement.closest('#reading-builder-review')), true);
                await page.keyboard.press('Escape');
                await page.waitForFunction(() => !document.getElementById('reading-builder-review') && document.activeElement.id === 'review-open');
                assert.equal(await page.evaluate(() => document.body.classList.contains('ui-dialog-open')), false);
            }
            await page.locator('#review-open').click();
            await page.locator('.reading-builder-checklist button').first().click();
            await page.waitForFunction(() => document.activeElement.id === 'builder-target');
            assert.deepEqual(await page.evaluate(() => vm.saved), {title: 'Unchanged draft', questions: ['One', 'Two']});
            assert.equal(await page.evaluate(() => window.saves || 0), 0);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('nested dialogs keep Escape and focus on the top dialog and release listeners on scope destruction', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        await page.locator('#review-open').click();
        await page.waitForFunction(() => document.activeElement.matches('.reading-builder-review-modal__close'));
        await page.evaluate(() => scope.$apply(() => vm.nested = true));
        await page.waitForFunction(() => document.activeElement.id === 'nested-close');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('nested-custom'));
        assert.equal(await page.locator('#reading-builder-review').count(), 1);
        assert.equal(await page.evaluate(() => document.body.classList.contains('ui-dialog-open')), true);
        await page.waitForFunction(() => document.activeElement.matches('.reading-builder-review-modal__close'));
        await page.evaluate(() => scope.$apply(() => vm.openMove()));
        await page.locator('.modal.in').waitFor();
        await page.waitForFunction(() => !!document.activeElement.closest('.modal'));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.modal'));
        assert.equal(await page.locator('#reading-builder-review').count(), 1);
        await page.waitForFunction(() => document.activeElement.matches('.reading-builder-review-modal__close'));
        await page.evaluate(() => {scope.$destroy(); document.getElementById('fixture').remove();});
        assert.equal(await page.evaluate(() => document.body.classList.contains('ui-dialog-open')), false);
        await page.evaluate(() => {const input = document.createElement('input'); input.id = 'after-destroy'; document.body.appendChild(input); input.focus();});
        assert.equal(await page.evaluate(() => document.activeElement.id), 'after-destroy');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('move dialog has an accessible name, keeps a long folder list usable and restores its disabled opener after cancel or Escape', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const viewport of [{width: 1024, height: 600}, {width: 768, height: 480}, {width: 390, height: 600}]) {
            const {page, errors} = await fixture(browser, false, viewport);
            for (const folderMode of [false, true]) {
                await page.evaluate(folderMode => scope.$apply(() => vm.folderMode = folderMode), folderMode);
                await page.locator('#move-open').click();
                const dialog = page.getByRole('dialog', {name: folderMode ? 'Di chuyển folder' : 'Di chuyển bài test', exact: true});
                await dialog.waitFor();
                assert.equal(await dialog.getAttribute('aria-modal'), 'true');
                assert.equal(await page.locator('#move-open').isDisabled(), true);
                const footer = await dialog.locator('.modal-footer').boundingBox();
                assert.ok(footer.y >= 0 && footer.y + footer.height <= viewport.height + 1, JSON.stringify({viewport, footer}));
                await dialog.locator('.test-move-tree').evaluate(element => element.scrollTop = element.scrollHeight);
                await dialog.locator('.test-move-tree button.test-move-folder').last().click();
                await dialog.locator('.modal-footer button').first().focus();
                for (let tab = 0; tab < 8; tab++) {
                    await page.keyboard.press('Tab');
                    assert.equal(await page.evaluate(() => !!document.activeElement.closest('.modal')), true);
                }
                if (folderMode) await page.keyboard.press('Escape');
                else await dialog.locator('.modal-footer button').first().click();
                await page.waitForFunction(() => !document.querySelector('.modal') && document.activeElement.id === 'move-open');
                assert.equal(await page.evaluate(() => window.saves || 0), 0);
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('a full Listening checklist keeps close controls and every issue reachable at short tablet and mobile heights', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const viewport of [{width: 1024, height: 600}, {width: 768, height: 480}, {width: 390, height: 600}]) {
            const {page, errors} = await fixture(browser, true, viewport);
            await page.evaluate(() => scope.$apply(() => {
                vm.refreshBuilderValidation = () => vm.builderValidation = {
                    valid: false,
                    parts: Array.from({length: 4}, (_, index) => ({name: 'Part ' + (index + 1), count: 0, expected: 10, issueCount: 8})),
                    issues: Array.from({length: 30}, (_, index) => ({message: 'Question ' + (index + 1) + ' needs a complete answer before publishing', target: 'builder-target'}))
                };
            }));
            await page.locator('#review-open').click();
            const dialog = page.locator('#reading-builder-review');
            const footer = await dialog.locator('.reading-builder-review-modal__footer').boundingBox();
            assert.ok(footer.y >= 0 && footer.y + footer.height <= viewport.height + 1, JSON.stringify({viewport, footer}));
            const last = dialog.locator('.reading-builder-checklist button').last();
            await last.scrollIntoViewIfNeeded();
            const issue = await last.boundingBox();
            assert.ok(issue.y >= 0 && issue.y + issue.height <= viewport.height + 1, JSON.stringify({viewport, issue}));
            await dialog.locator('.reading-builder-review-modal__footer button').click();
            await page.waitForFunction(() => !document.getElementById('reading-builder-review') && document.activeElement.id === 'review-open');
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
