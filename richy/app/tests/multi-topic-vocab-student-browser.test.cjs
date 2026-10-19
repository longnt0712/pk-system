const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const assetApp = process.env.IELTS_QA_APP || app;
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const html = fs.readFileSync(path.join(app, 'dashboards/views/general-alt.html'), 'utf8');
const sectionStart = html.indexOf('<section class="student-assignment-board"');
const board = html.slice(sectionStart, html.indexOf('</section>', sectionStart) + '</section>'.length);
const resumeStart = html.indexOf('<section class="student-resume-board"');
const resumeBoard = html.slice(resumeStart, html.indexOf('</section>', resumeStart) + '</section>'.length);
const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)).map(match => match[1]).join('\n');
for (const viewport of [{width: 1440, height: 1050}, {width: 390, height: 844}]) {
    test('three topic cards render and launch their own child on ' + viewport.width + 'px screen', async () => {
        const browser = await playwright.chromium.launch({headless: true, executablePath});
        try {
            const page = await browser.newPage({viewport});
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'}));
            await page.goto('http://multi-vocab.test/dashboard');
            await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial;margin:0}*{box-sizing:border-box}' + styles + '</style></head><body><main id="qa" ng-controller="DashboardController as vm">' + resumeBoard + board + '</main></body></html>');
            await page.addScriptTag({path: path.join(assetApp, 'assets/scripts/external/angular.min.js')});
            await page.evaluate(() => {
                window.routes = [];
                window.assigned = [100, 200, 300].map((topicId, index) => ({taskId: 55, activityType: 'DAILY_VOCAB', topicId, categoryId: 2,
                    topicName: ['Travel', 'Education', 'Environment'][index], categoryName: 'IELTS', title: 'Ôn tập ba chủ đề', className: 'IELTS 6.5',
                    dueDate: '2026-10-30', requiredAttempts: 1, completedAttempts: index === 0 ? 1 : 0, remainingAttempts: index === 0 ? 0 : 1,
                    taskTotalTopics: 3, taskCompletedTopics: 1, taskProgressPercent: 33}));
                for (const topicId of [100, 200]) {
                    localStorage.setItem('daily-vocab-active:v1:7:task:55:topic:' + topicId, JSON.stringify({version: 1, ownerId: 7,
                        assignmentTaskId: 55, assignmentTopicId: topicId, assignmentCategoryId: 2, title: 'Topic ' + topicId,
                        savedAt: Date.now(), counter: 400, currentPosition: 2, totalCard: 10, questions: [{id: 1}]}));
                }
                angular.module('Hrm.Dashboard', []).value('settings', {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}})
                    .value('Utilities', {}).value('$cookies', {get: () => JSON.stringify({id: 7, roles: [{name: 'ROLE_STUDENT'}]})})
                    .value('$state', {go: (name, params) => routes.push({name, params})})
                    .factory('$http', ['$q', q => ({get(url) { return q.when({data: url.endsWith('my-assignments') ? angular.copy(assigned) : []}); }})])
                    .run(['$rootScope', root => { root.settings = {layout: {}, ieltsRoom: true}; }]);
            });
            await page.addScriptTag({path: path.join(app, 'dashboards/controllers/DashboardController.js')});
            await page.evaluate(() => { angular.bootstrap(document.getElementById('qa'), ['Hrm.Dashboard']); window.qaVm = angular.element(document.getElementById('qa')).scope().vm; });
            await page.waitForFunction(() => document.querySelectorAll('.student-assignment-card').length === 3, {}, {timeout: 5000}).catch(async error => { throw Error(error.message + '\n' + errors.join('\n') + '\n' + JSON.stringify(await page.evaluate(() => ({tasks: qaVm.assignedTasks, user: qaVm.myUser, permissions: qaVm.permissionsLoaded, body: document.body.innerText.slice(0,500)})))); });
            assert.equal(await page.locator('.student-assignment-card').count(), 3);
            assert.equal(await page.locator('.student-assignment-card.is-complete').count(), 1);
            assert.match(await page.locator('.student-assignment-card').first().innerText(), /1\/3 topic · 33%/);
            assert.equal(await page.locator('.student-assignment-card').first().locator('button').count(), 0);
            await page.locator('.student-assignment-card').nth(1).locator('button').click();
            assert.equal(await page.evaluate(() => routes[0].params.assignmentTopicId), 200);
            assert.equal(await page.evaluate(() => routes[0].params.assignmentTaskId), 55);
            assert.equal(await page.evaluate(() => qaVm.resumeDrafts.length), 2);
            await page.evaluate(() => qaVm.resumeDraft(qaVm.resumeDrafts.find(draft => draft.assignmentTopicId === 200)));
            assert.equal(await page.evaluate(() => routes.at(-1).params.assignmentTopicId), 200);
            assert.equal(await page.evaluate(() => routes.at(-1).params.assignmentTaskId), 55);
            const width = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, viewport: innerWidth}));
            assert.ok(width.scroll <= width.viewport + 1, 'assignment board must fit the viewport');
            if (process.env.IELTS_QA_SCREENSHOTS) {
                await page.screenshot({path: path.join(process.env.IELTS_QA_SCREENSHOTS, 'student-topic-cards-' + viewport.width + '.png'), fullPage: true});
            }
            await page.evaluate(() => { assigned.forEach(task => { task.taskCompletedTopics = 2; task.taskProgressPercent = 67; }); angular.element(document.getElementById('qa')).scope().$apply(() => qaVm.loadAssignedTasks()); });
            await page.waitForFunction(() => document.querySelector('.student-assignment-card').innerText.includes('2/3 topic · 67%'));
            await page.evaluate(() => { assigned = []; angular.element(document.getElementById('qa')).scope().$apply(() => qaVm.loadAssignedTasks()); });
            await page.waitForFunction(() => document.querySelectorAll('.student-assignment-card').length === 0);
            assert.match(await page.locator('.student-assignment-empty').innerText(), /không có bài lớp giao/);
            await page.evaluate(() => {
                const result = {version: 1, ownerId: 7, createdAt: Date.now() + 1000, assignmentTaskId: 55, assignmentTopicId: 200,
                    title: 'Education · Kết quả chưa xác nhận', payload: {testType: 1, assignmentTaskId: 55, assignmentTopicId: 200,
                        clientAttemptKey: 'a'.repeat(32), user: {id: 7}, totalWord: 10}};
                localStorage.setItem('daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32), JSON.stringify(result));
                angular.element(document.getElementById('qa')).scope().$apply(() => qaVm.loadResumeDrafts());
            });
            const saveAction = page.getByRole('button', {name: 'Lưu kết quả đang chờ', exact: true});
            await saveAction.waitFor();
            assert.equal(await page.locator('.reading-resume-card').count(), 2, 'same-run pending replaces only the matching active card');
            await saveAction.click();
            assert.equal(await page.evaluate(() => routes.at(-1).params.assignmentTopicId), 200);
            assert.match(await page.evaluate(() => sessionStorage.getItem('daily-vocab-pending-resume:v1:7')), /:attempt:a{32}$/);
            if (process.env.IELTS_QA_SCREENSHOTS) {
                await page.screenshot({path: path.join(process.env.IELTS_QA_SCREENSHOTS, 'student-pending-result-' + viewport.width + '.png'), fullPage: true});
            }

            await page.evaluate(() => {
                localStorage.clear();
                const key = 'ieltsReadingInProgress:7:writing:test:8123:serious:task:238:parts:1';
                const a = 'a'.repeat(32), b = 'b'.repeat(32);
                const frozen = {clientAttemptKey: a, user: {id: 7}, testType: 7, sourceQuestionId: 8123, assignmentTaskId: 238, completedParts: [1]};
                const base = {version: 5, userId: 7, testId: 8123, testMode: 'WRITING', sessionMode: 'SERIOUS', assignmentTaskId: 238,
                    assignmentParts: [1], assignmentPart: 1, isPartAssignment: true, title: 'Writing assignment', savedAt: new Date().toISOString()};
                const receipt = {...base, clientAttemptKey: a, submissionState: {status: 'SAVED', key: a, payload: frozen, result: {...frozen, id: 9001, resultStatus: 'FAILED'}}};
                const active = {...base, clientAttemptKey: b};
                localStorage.setItem(key + ':attempt:' + a, JSON.stringify(receipt));
                localStorage.setItem(key, JSON.stringify(active));
                localStorage.setItem(key + ':attempt:' + b, JSON.stringify(active));
                window.writingPendingDraft = {...receipt, submissionState: {...receipt.submissionState, status: 'PENDING'}};
                window.writingPendingKey = key + ':attempt:' + a;
                angular.element(document.getElementById('qa')).scope().$apply(() => qaVm.loadResumeDrafts());
            });
            await page.waitForFunction(() => qaVm.resumeDrafts.length === 1);
            assert.equal(await page.locator('.reading-resume-card').count(), 1, 'saved FAILED receipt is not unfinished and active base/cloud copies deduplicate');
            await page.evaluate(() => {
                localStorage.setItem(writingPendingKey, JSON.stringify(writingPendingDraft));
                angular.element(document.getElementById('qa')).scope().$apply(() => qaVm.loadResumeDrafts());
            });
            await page.waitForFunction(() => qaVm.resumeDrafts.length === 2);
            await page.getByRole('button', {name: 'Lưu kết quả đang chờ', exact: true}).click();
            const selected = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ielts-draft-resume:v1:7')));
            assert.equal(selected.clientAttemptKey, 'a'.repeat(32));
            assert.equal(selected.assignmentTaskId, 238);
            assert.deepEqual(selected.assignmentParts, [1]);
            assert.equal(await page.evaluate(() => routes.at(-1).name), 'application.ielts_writing_actual_test');
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    });
}


test('full Daily Vocab controller restores a cloud-only retry and rejects a wrong-topic saved ID before confirming it', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
        await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'}));
        await page.goto('http://multi-vocab.test/daily_vocab/0?assignmentTaskId=55&assignmentTopicId=200');
        await page.setContent('<!doctype html><html><body><main id="qa" ng-controller="DailyVocabController as vm"><section id="pending" ng-if="vm.dailyVocabPendingResult"><p id="message">{{vm.dailySaveMessage}}</p><button id="save" ng-click="vm.saveTestResult()" ng-disabled="vm.savingTestResult || vm.isSaveTestResult">Lưu kết quả</button></section></main></body></html>');
        await page.addScriptTag({path: path.join(assetApp, 'assets/scripts/external/angular.min.js')});
        await page.evaluate(() => {
            window.requests = []; window.deletions = []; window.toasts = []; window.wrongContext = true;
            const payload = {version: 1, ownerId: 7, createdAt: 1000, assignmentTaskId: 55, assignmentTopicId: 200, activeRunId: 'run-a',
                title: 'Education', payload: {testType: 1, assignmentTaskId: 55, assignmentTopicId: 200, clientAttemptKey: 'a'.repeat(32), totalWord: 10, user: {id: 7}}};
            const key = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
            Object.defineProperty(window, 'localStorage', {value: {getItem() { throw Error('Storage blocked'); }, setItem() { throw Error('Storage blocked'); }, removeItem() {}, length: 0, key() { return null; }}});
            angular.module('Hrm.Question', [])
                .value('settings', {})
                .value('$cookies', {get: () => JSON.stringify({id: 7, roles: [{name: 'ROLE_VIEWER'}]})})
                .value('$stateParams', {listFlashCard: 0, assignmentTaskId: 55, assignmentTopicId: 200, assignmentCategoryId: 2})
                .value('blockUI', {start() {}, stop() {}})
                .value('toastr', Object.fromEntries(['success', 'error', 'warning', 'info'].map(level => [level, message => toasts.push({level, message})])))
                .factory('QuestionService', ['$q', q => ({
                    getAssignedTask: () => q.when({taskId: 55, activityType: 'DAILY_VOCAB', topicId: 100, topicIds: [100, 200, 300], topics: [{topicId: 200, categoryId: 2}]}),
                    getLearningDrafts: () => q.when([{draftKey: key, draftType: 'DAILY_VOCAB_PENDING', payload: JSON.stringify(payload), savedAt: 2000}]),
                    saveLearningDraft: dto => q.when({...dto, id: 99}),
                    deleteLearningDraft: key => { deletions.push(key); return q.when(true); },
                    saveDailyVocabResult: dto => { requests.push(angular.copy(dto)); return q.when({id: 101, assignmentTaskId: 55, assignmentTopicId: wrongContext ? 100 : 200, user: {id: 7}}); },
                    getPageTopicCategory: () => { throw Error('A pending retry must not need to replay the questions'); }
                })])
                .run(['$rootScope', root => { root.settings = {layout: {}}; }]);
        });
        await page.addScriptTag({path: path.join(app, 'question/controllers/DailyVocabController.js')});
        await page.evaluate(() => { angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']); window.qaVm = angular.element(document.getElementById('qa')).scope().vm; });
        await page.waitForFunction(() => qaVm.dailyVocabPendingResult && qaVm.dailySaveStatus === 'pending');
        assert.equal(await page.evaluate(() => qaVm.assignmentLaunch.topicId), 200);
        await page.locator('#save').click();
        await page.waitForFunction(() => qaVm.dailySaveStatus === 'pending' && qaVm.dailySaveMessage.includes('chưa xác nhận đúng bài'));
        assert.equal(await page.evaluate(() => qaVm.isSaveTestResult), false);
        assert.equal(await page.evaluate(() => deletions.some(key => key.startsWith('daily-vocab-pending:'))), false);
        await page.evaluate(() => { wrongContext = false; });
        await page.locator('#save').click();
        await page.waitForFunction(() => qaVm.dailySaveStatus === 'saved');
        assert.equal(await page.evaluate(() => requests.length), 2);
        assert.equal(await page.evaluate(() => requests[0].clientAttemptKey === requests[1].clientAttemptKey), true);
        assert.equal(await page.evaluate(() => requests[1].assignmentTopicId), 200);
        assert.equal(await page.evaluate(() => requests[1].assignmentTaskId), 55);
        assert.ok(await page.evaluate(() => deletions.some(key => key.endsWith(':attempt:' + 'a'.repeat(32)))));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
