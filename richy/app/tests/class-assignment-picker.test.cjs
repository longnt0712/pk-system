const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'enrolment_class/business/ClassAssignmentPicker.js'), 'utf8');
const controller = fs.readFileSync(path.join(app, 'enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const folderTree = [{id: 1, name: 'Grade 6', ownerName: 'Teacher', parentId: null},
    {id: 2, name: 'Unit 1', ownerName: 'Teacher', parentId: 1}, {id: 3, name: 'Other', ownerName: 'Teacher', parentId: null}];
const topics = [{id: 50, name: 'Animals', categoryId: 4, categoryName: 'Grade 6'}, {id: 51, name: 'Food', categoryId: 4}];
const tests = [{id: 10, title: 'Reading root', testFormat: null, testFolder: null},
    {id: 11, title: 'Reading nested', testFormat: null, testFolder: {id: 2}},
    {id: 12, title: 'Listening', pronounce: 'audio.mp3', testFolder: {id: 1}},
    {id: 13, title: 'Writing', testFormat: 'WRITING', hasWritingTask2: true, testFolder: {id: 1}},
    {id: 14, title: 'Comprehensive', testFormat: 'COMPREHENSIVE', testFolder: {id: 1}}];
const daily = [{id: 20, title: 'Daily root', testFormat: 'DAILY_LISTENING', testFolder: null, topics: [{id: 50}]},
    {id: 21, title: 'Daily nested', testFormat: 'DAILY_LISTENING', testFolder: {id: 2}, topics: [{id: 50}, {id: 51}]},
    {id: 22, title: 'Missing topic', testFormat: 'DAILY_LISTENING', testFolder: {id: 1}, topics: []},
    {id: 23, title: 'Old Track', testFormat: null, testFolder: null, topics: [{id: 51}]}];
function contains(id, selected) {
    if (selected == null) { return true; }
    const seen = new Set();
    while (id != null && !seen.has(id)) { if (String(id) === String(selected)) return true; seen.add(id); id = folderTree.find(folder => folder.id === id)?.parentId; }
    return false;
}
async function setup(activityType, selectedId, overrides = {}) {
    let definition, dialog, opened;
    nodeVm.runInNewContext(source, {window: {APP_VERSION: 'test'}, angular: {module: () => ({factory(name, value) { definition = value; }})}});
    const api = {getAssignableIeltsTests: () => Promise.resolve(structuredClone(tests)),
        getAssignableDailyListeningTests: () => Promise.resolve(structuredClone(daily)), getScheduleTopics: () => Promise.resolve(structuredClone(topics)), ...overrides};
    const folders = {load: () => Promise.resolve(folderTree), contains, options: items => items.map(item => ({...item, label: item.name}))};
    const instance = {close(value) { dialog.confirmed = value; }, dismiss(value) { dialog.dismissed = value; }};
    const modal = {open(options) { opened = options; dialog = new (options.controller.at(-1))(instance); return {result: Promise.resolve()}; }};
    const factory = definition.at(-1)(modal, api, folders, {all: Promise.all.bind(Promise), when: Promise.resolve.bind(Promise)});
    factory.open({activityType, selectedId});
    await new Promise(resolve => setImmediate(resolve));
    return {dialog, opened, factory};
}
test('each test type opens its own catalog and the selected test starts in its real folder', async () => {
    for (const [type, ids, mode] of [['IELTS_READING', [11, 10], 'READING'], ['IELTS_LISTENING', [12], 'LISTENING'],
        ['IELTS_WRITING', [13], 'WRITING'], ['COMPREHENSIVE', [14], 'COMPREHENSIVE']]) {
        const {dialog} = await setup(type, ids[0]);
        assert.equal(dialog.mode, mode); assert.deepEqual(Array.from(dialog.catalog, file => file.id), ids);
        assert.equal(dialog.folderId, tests.find(file => file.id === ids[0]).testFolder?.id || null);
        dialog.confirm(); assert.equal(dialog.confirmed.test.id, ids[0]);
    }
});
test('browsing shows direct contents and search finds descendants without losing the provisional choice', async () => {
    const {dialog} = await setup('IELTS_READING');
    assert.deepEqual(Array.from(dialog.visibleFiles(), file => file.id), [10]);
    dialog.select(dialog.catalog.find(file => file.id === 10));
    dialog.openFolder(1); assert.deepEqual(Array.from(dialog.visibleFiles()), []);
    dialog.search = 'READING'; assert.deepEqual(Array.from(dialog.visibleFiles(), file => file.id), [11]);
    dialog.openFolder(2); assert.equal(dialog.search, ''); assert.equal(dialog.selected.id, 10);
    dialog.cancel(); assert.equal(dialog.dismissed, 'cancel'); assert.equal(dialog.confirmed, undefined);
});
test('Daily Listening preserves linked topics and legacy tracks while allowing standalone modern lessons', async () => {
    const {dialog} = await setup('DAILY_LISTENING');
    assert.equal(dialog.catalog.length, 4);
    dialog.select(dialog.catalog.find(file => file.id === 21)); assert.equal(dialog.selectedTopicId, 50);
    dialog.selectedTopicId = 51; dialog.confirm();
    assert.equal(dialog.confirmed.test.id, 21); assert.equal(dialog.confirmed.topic.name, 'Food');
    dialog.select(dialog.catalog.find(file => file.id === 22)); assert.equal(dialog.canSelect(), true);
    dialog.confirm(); assert.equal(dialog.confirmed.test.id, 22); assert.equal(dialog.confirmed.topic, null);
    dialog.select({id: 24, title: 'Unlinked legacy Track', testFormat: null, topics: []}); assert.equal(dialog.canSelect(), false);
    dialog.select(dialog.catalog.find(file => file.id === 23)); assert.equal(dialog.selectedTopicId, 51); assert.equal(dialog.canSelect(), true);
});
test('catalog failures can be retried and confirming waits for a loaded catalog', async () => {
    let calls = 0;
    const {dialog} = await setup('IELTS_READING', 11, {getAssignableIeltsTests() { return ++calls === 1 ? Promise.reject(Error('offline')) : Promise.resolve(tests); }});
    assert.ok(dialog.error); assert.equal(dialog.canSelect(), false);
    await dialog.load(); assert.equal(dialog.error, ''); assert.equal(dialog.selected.id, 11); assert.equal(dialog.canSelect(), true);
});
test('assignment selection fills IDs, topic and Writing parts; cancel and stale callbacks preserve the task', async () => {
    const from = controller.indexOf('        vm.taskSelectedExerciseTitle ='), to = controller.indexOf('\t\tvm.isIeltsTask =', from);
    assert.ok(from >= 0 && to > from);
    for (const type of ['DAILY_LISTENING', 'IELTS_WRITING']) {
        let resolve, reject;
        const task = {activityType: type, title: '', requiredAttempts: 2, shuffleQuestions: true};
        const vm = {taskEditor: task, scheduleTopics: [], scheduleListeningItems: [], assignableIeltsTests: [], selectAllTaskParts() { this.taskEditor.ieltsParts = [2]; }};
        const context = nodeVm.createContext({vm, angular: {noop() {}}, scheduleListeningItemsRequest: 0,
            assignmentPicker: {open: () => new Promise((yes, no) => {resolve = yes; reject = no;})}});
        nodeVm.runInContext(controller.slice(from, to), context);
        vm.openTaskExercisePicker(); assert.equal(vm.taskExercisePickerOpen, true);
        resolve({test: type === 'DAILY_LISTENING' ? daily[1] : tests[3], topic: topics[0]});
        await new Promise(done => setImmediate(done));
        assert.equal(vm.taskExercisePickerOpen, false); assert.equal(task.requiredAttempts, 2); assert.equal(task.shuffleQuestions, true);
        if (type === 'DAILY_LISTENING') {
            assert.equal(task.sourceQuestionId, 21); assert.equal(task.topicId, 50); assert.equal(vm.scheduleListeningItems[0].id, 21);
            assert.equal(vm.scheduleTopics[0].id, 50);
        } else { assert.equal(task.ieltsTestId, 13); assert.deepEqual(task.ieltsParts, [2]); }
        const before = structuredClone(task);
        vm.openTaskExercisePicker(); reject('cancel'); await new Promise(done => setImmediate(done));
        assert.deepEqual(task, before);
        vm.openTaskExercisePicker(); vm.taskEditor = {activityType: type, title: 'Other task'};
        resolve({test: tests[3], topic: topics[0]}); await new Promise(done => setImmediate(done));
        assert.equal(vm.taskEditor.title, 'Other task'); assert.equal(vm.taskEditor.ieltsTestId, undefined);
    }
});

test('real modal browses folders, searches, selects topics and keeps its footer reachable on desktop/mobile', async () => {
    const os = require('node:os');
    const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    const css = ['assets/css/external/bootstrap.min.css', 'assets/css/external/font-awesome.min.css', 'assets/css/comprehensive-folders.css',
        'assets/css/class-assignment-picker.css'].map(file => fs.readFileSync(path.join(app, file), 'utf8')).join('\n');
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 850}}), errors = [];
            page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.pathname.endsWith('assignment_picker_modal.html')) return route.fulfill({contentType: 'text/html', body: fs.readFileSync(path.join(app, 'enrolment_class/views/assignment_picker_modal.html'), 'utf8')});
                if (url.pathname.endsWith('test_folder_explorer.html')) return route.fulfill({contentType: 'text/html', body: fs.readFileSync(path.join(app, 'question/views/test_folder_explorer.html'), 'utf8')});
                if (url.pathname.endsWith('/test_folder')) return route.fulfill({contentType: 'application/json', body: JSON.stringify(folderTree)});
                if (/fontawesome-webfont\.(woff2?|ttf|eot)/.test(url.pathname)) return route.fulfill({body: fs.readFileSync(path.join(app, 'assets/fonts/' + url.pathname.split('/').pop()))});
                return route.fulfill({contentType: 'text/html', body: '<html></html>'});
            });
            await page.goto('http://assignment.test');
            await page.setContent('<style>' + css + '</style><main id="qa" ng-controller="Qa as vm"><button ng-click="vm.open()">Chọn bài</button><output>{{vm.chosen.test.title}}</output></main>');
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external/ui-bootstrap-tpls.min.js')});
            await page.evaluate(({tests, daily, topics}) => {
                window.APP_VERSION = 'test';
                angular.module('Hrm.Question', []);
                angular.module('Hrm.EnrolmentClass', ['Hrm.Question', 'ui.bootstrap'])
                    .value('settings', {api: {baseUrl: '/', apiV1Url: 'api/'}})
                    .value('QuestionService', {})
                    .factory('EnrolmentClassService', ['$q', function ($q) {
                        return {getAssignableIeltsTests: () => $q.when(tests), getAssignableDailyListeningTests: () => $q.when(daily), getScheduleTopics: () => $q.when(topics)};
                    }]);
            }, {tests, daily, topics});
            await page.addScriptTag({path: path.join(app, 'question/business/ComprehensiveFolders.js')});
            await page.addScriptTag({path: path.join(app, 'enrolment_class/business/ClassAssignmentPicker.js')});
            await page.evaluate(() => {
                angular.module('Hrm.EnrolmentClass').controller('Qa', ['ClassAssignmentPicker', function (picker) {
                    const vm = this; vm.type = 'IELTS_READING';
                    vm.open = () => picker.open({activityType: vm.type}).then(selection => { vm.chosen = selection; }, angular.noop);
                }]);
                angular.bootstrap(document.getElementById('qa'), ['Hrm.EnrolmentClass']);
            });
            await page.getByRole('button', {name: 'Chọn bài', exact: true}).click();
            await page.locator('.test-explorer-folder[title="Mở folder Grade 6"]').waitFor();
            await page.screenshot({path: path.join(app, '../../.tmp/class-assignment-folders-' + width + '.png'), fullPage: true, animations: 'disabled'});
            await page.locator('.test-explorer-folder[title="Mở folder Grade 6"]').click();
            await page.locator('.test-explorer-folder[title="Mở folder Unit 1"]').click();
            await page.getByRole('button', {name: /Reading nested/}).click();
            const footer = page.getByRole('button', {name: 'Chọn bài này', exact: true});
            assert.equal(await footer.isEnabled(), true);
            const bounds = await footer.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 850);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
            await page.screenshot({path: path.join(app, '../../.tmp/class-assignment-picker-' + width + '.png'), fullPage: true, animations: 'disabled'});
            await footer.click();
            await page.waitForFunction(() => document.querySelector('output').textContent === 'Reading nested');
            await page.evaluate(() => { const scope = angular.element(document.getElementById('qa')).scope(); scope.$apply(() => {scope.vm.type = 'DAILY_LISTENING';}); });
            await page.getByRole('button', {name: 'Chọn bài', exact: true}).click();
            await page.getByRole('searchbox', {name: 'Tìm bài'}).fill('Daily nested');
            await page.getByRole('button', {name: /Daily nested/}).click();
            await page.getByRole('combobox').selectOption({label: 'Food'});
            await page.getByRole('button', {name: 'Chọn bài này', exact: true}).click();
            const choice = await page.evaluate(() => angular.element(document.getElementById('qa')).scope().vm.chosen);
            assert.equal(choice.test.id, 21); assert.equal(choice.topic.id, 51);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
