const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

const app = path.join(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    .find(file => fs.existsSync(file));
const templates = ['builder', 'exercise'].map(name => fs.readFileSync(path.join(app, `question/views/find_mistakes_${name}.html`), 'utf8'));
const css = fs.readFileSync(path.join(app, 'assets/css/comprehensive-find-mistakes.css'), 'utf8');

test('author marks real and distractor phrases, then students select and correct one phrase at a time', async () => {
    const browser = await chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [390, 1366]) {
            const page = await browser.newPage({viewport: {width, height: 900}});
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.setContent(`<style>${css}</style><main ng-controller="Fixture as vm">
                <find-mistakes-builder ng-if="!vm.run" pack="vm.pack"></find-mistakes-builder>
                <find-mistakes-exercise ng-if="vm.run" pack="vm.student" editor-state="vm.editorState"></find-mistakes-exercise>
                <find-mistakes-exercise ng-if="vm.run && vm.other" pack="vm.other" editor-state="vm.editorState"></find-mistakes-exercise>
                </main>`);
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
            await page.evaluate(() => { window.APP_VERSION = 'test'; angular.module('Hrm.Question', []); });
            await page.addScriptTag({path: path.join(app, 'question/business/ComprehensiveFindMistakes.js')});
            await page.evaluate(([builder, exercise]) => {
                angular.module('Hrm.Question').controller('Fixture', function () {
                    this.pack = {type: 19, subQuestions: []};
                    this.editorState = {};
                    window.fixture = this;
                }).run(['$templateCache', '$rootScope', function (cache, scope) {
                    cache.put('question/views/find_mistakes_builder.html?v=test', builder);
                    cache.put('question/views/find_mistakes_exercise.html?v=test', exercise);
                    window.refresh = () => scope.$apply();
                }]);
                angular.bootstrap(document.querySelector('main'), ['Hrm.Question']);
            }, templates);

            const passage = page.getByRole('textbox', {name: 'Đoạn văn tìm lỗi'});
            await passage.fill('Yesterday, she go to school and buy two loafs of bread. Then she run into Ana.');
            for (const phrase of ['Yesterday', 'go', 'to school', 'buy', 'two loafs of bread', 'run into']) {
                await passage.evaluate((input, phrase) => {
                    const start = input.value.indexOf(phrase);
                    input.focus();
                    input.setSelectionRange(start, start + phrase.length);
                }, phrase);
                await page.getByRole('button', {name: 'Đánh dấu vùng chọn'}).click();
            }
            for (const [phrase, replacement] of [['go', 'went'], ['buy', 'bought'], ['two loafs of bread', 'two loaves of bread'], ['run into', 'ran into']]) {
                const row = page.locator('.find-mistakes-option').filter({has: page.getByRole('checkbox', {name: new RegExp(`\\. ${phrase} \\(`)})});
                await row.getByRole('checkbox').check();
                await row.getByRole('textbox').fill(replacement);
            }
            assert.deepEqual(await page.evaluate(() => fixture.pack.subQuestions.map(q => q.questionAnswers[0].answer.answer)),
                ['2|went', '4|bought', '5|two loaves of bread', '6|ran into']);
            // Serve the same reference-only answer rows that students get from the API.
            await page.evaluate(() => {
                fixture.student = {motherTongue: fixture.pack.motherTongue, subQuestions: fixture.pack.subQuestions.map((q, index) => ({
                    ordinalNumber: index + 1, questionAnswers: [{id: index + 1}]
                }))};
                fixture.other = {motherTongue: '[[Another group]]', subQuestions: [{ordinalNumber: 5, questionAnswers: [{id: 5}]}]};
                fixture.run = true;
                refresh();
            });

            const correction = page.locator('.find-mistakes-correction textarea');
            const save = page.getByRole('button', {name: 'Lưu và chọn tiếp'});
            const otherGroup = page.getByRole('button', {name: 'Another group', exact: true});
            for (const [phrase, replacement] of [['run into', 'ran into'], ['Yesterday', 'Today'], ['go', 'went'], ['two loafs of bread', 'two loaves of bread']]) {
                await page.getByRole('button', {name: phrase, exact: true}).click();
                assert.equal(await correction.count(), 1);
                assert.equal(await page.getByRole('button', {name: 'to school', exact: true}).isDisabled(), true);
                assert.equal(await otherGroup.isDisabled(), true);
                await correction.fill(replacement);
                await save.click();
                assert.equal(await correction.count(), 0);
                assert.equal(await otherGroup.isDisabled(), false);
            }
            assert.match(await page.locator('.find-mistakes-progress').first().textContent(), /4 \/ 4/);
            assert.equal(await page.getByRole('button', {name: 'buy', exact: true}).isDisabled(), true);
            await page.getByRole('button', {name: 'Yesterday', exact: true}).click();
            assert.equal(await correction.inputValue(), 'Today');
            await page.getByRole('button', {name: 'Bỏ chọn vị trí này'}).click();
            await page.getByRole('button', {name: 'buy', exact: true}).click();
            await correction.fill('bought');
            await save.click();
            assert.deepEqual(await page.evaluate(() => fixture.student.subQuestions.map(q => q.questionAnswers[0].clientAnswer)),
                ['6|ran into', '4|bought', '2|went', '5|two loaves of bread']);

            // Mount a one-error group and restore a saved answer from its draft model.
            await page.evaluate(() => { fixture.run = false; refresh(); });
            await page.evaluate(() => {
                fixture.student = {motherTongue: '[[She]] [[go]] to school.', subQuestions: [
                    {ordinalNumber: 1, questionAnswers: [{id: 11, clientAnswer: '2|goes'}]}
                ]};
                fixture.other = null;
                fixture.run = true;
                refresh();
            });
            assert.match(await page.locator('.find-mistakes-progress').textContent(), /1 \/ 1/);
            assert.equal(await page.getByRole('button', {name: 'She', exact: true}).isDisabled(), true);
            await page.getByRole('button', {name: 'go', exact: true}).click();
            assert.equal(await correction.inputValue(), 'goes');
            await correction.fill('went');
            await page.getByRole('button', {name: 'Hủy', exact: true}).click();
            await page.getByRole('button', {name: 'go', exact: true}).click();
            assert.equal(await correction.inputValue(), 'goes');
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
    }
});
