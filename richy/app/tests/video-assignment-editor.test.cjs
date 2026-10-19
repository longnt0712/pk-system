const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const view = fs.readFileSync(path.join(app, 'enrolment_class/views/listing.html'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const video = id => ({id, subQuestions: [{videoUrl: 'https://www.youtube.com/watch?v=abcdef12345'}]});
const text = id => ({id, subQuestions: [{videoUrl: ''}]});
const summary = id => ({id, title: 'Exercise ' + id, testFormat: 'COMPREHENSIVE'});
const tick = () => new Promise(resolve => setImmediate(resolve));
function editor(catalog = [summary(1), summary(2)]) {
    const requests = [], picks = [];
    const vm = {assignableIeltsTests: structuredClone(catalog), scheduleTopics: [], scheduleListeningItems: [],
        scheduleDay: {tasks: [], scheduleDate: '2026-10-19'}, taskEditor: null,
        taskDeadlineChanged() {}, loadTaskListeningItems() {}, initializeComprehensiveAssignment() {},
        isIeltsTask: task => task?.activityType === 'COMPREHENSIVE', ieltsPartsForTask: () => [1],
        selectAllTaskParts() { this.taskEditor.ieltsParts = [1]; },
        saveScheduleDay() { this.saved = context.scheduleTaskPayload(this.scheduleDay.tasks[0]); }};
    const context = nodeVm.createContext({vm,
        angular: {noop() {}, isArray: Array.isArray, copy: structuredClone, forEach: (items, fn) => (items || []).forEach(fn)},
        toastr: {warning(message) { vm.warning = message; }}, scheduleListeningItemsRequest: 0,
        service: {getAssignmentExerciseDetails(id) { return new Promise((resolve, reject) => requests.push({id, resolve, reject})); }},
        assignmentPicker: {open() { return new Promise(resolve => picks.push(resolve)); }}});
    nodeVm.runInContext(section('        vm.taskSelectedExerciseTitle =', '\t\tvm.isIeltsTask ='), context);
    nodeVm.runInContext(section('\t\tvm.openScheduleTask =', '        vm.taskDeadlineChanged ='), context);
    nodeVm.runInContext(section('\t\tfunction scheduleTaskPayload(', '\t\tvm.removeScheduleTask ='), context);
    vm.ieltsTestsForTask = () => vm.assignableIeltsTests;
    function open(task = {ieltsTestId: 1, shuffleQuestions: true}) {
        vm.openScheduleTask('IN_CLASS', {activityType: 'COMPREHENSIVE', title: 'Practice', requiredAttempts: 1,
            section: 'IN_CLASS', ieltsParts: [1], ...task});
    }
    async function choose(test) { vm.openTaskExercisePicker(); picks.shift()({test}); await tick(); }
    return {vm, context, requests, open, choose};
}
test('editing a saved video assignment loads real metadata and enforces an unchecked payload', async () => {
    const e = editor(); e.open();
    assert.equal(e.vm.taskExerciseVideoLoading, true); assert.equal(e.requests[0].id, '1');
    e.vm.commitScheduleTask(); assert.match(e.vm.warning, /thông tin bài tập/); assert.equal(e.vm.scheduleDay.tasks.length, 0);
    e.requests[0].resolve(video(1)); await tick();
    assert.equal(e.vm.taskExerciseVideo, true); assert.equal(e.vm.taskExerciseVideoLoading, false);
    assert.equal(e.vm.taskEditor.shuffleQuestions, false);
    // A stale checkbox value cannot re-enable question shuffling in the submitted task.
    e.vm.taskEditor.shuffleQuestions = true;
    assert.equal(e.context.scheduleTaskPayload(e.vm.taskEditor).shuffleQuestions, false);
    e.vm.commitScheduleTask(); assert.equal(e.vm.saved.shuffleQuestions, false);
});
test('selecting video from a full catalog needs no request and switching to text restores the preference', async () => {
    for (const initial of [true, false]) {
        const e = editor([{...summary(1), ...video(1)}, {...summary(2), ...text(2)}]);
        e.open({ieltsTestId: 2, shuffleQuestions: initial});
        assert.equal(e.vm.taskEditor.shuffleQuestions, initial);
        await e.choose(e.vm.assignableIeltsTests[0]);
        assert.equal(e.vm.taskExerciseVideo, true); assert.equal(e.vm.taskEditor.shuffleQuestions, false);
        assert.equal(e.requests.length, 0);
        await e.choose(e.vm.assignableIeltsTests[1]);
        assert.equal(e.vm.taskExerciseVideo, false); assert.equal(e.vm.taskEditor.shuffleQuestions, initial);
        assert.equal(e.context.scheduleTaskPayload(e.vm.taskEditor).shuffleQuestions, initial);
    }
});
test('late video replies cannot change the newly selected exercise or a different task', async () => {
    const e = editor(); e.open();
    await e.choose(summary(2));
    assert.equal(e.requests.length, 2);
    e.requests[0].resolve(video(1)); await tick();
    assert.equal(e.vm.taskEditor.ieltsTestId, 2); assert.equal(e.vm.taskExerciseVideo, false);
    assert.equal(e.vm.taskExerciseVideoLoading, true); assert.equal(e.vm.taskEditor.shuffleQuestions, true);
    e.requests[1].resolve(text(2)); await tick();
    assert.equal(e.vm.taskExerciseVideoLoading, false);
    e.vm.cancelScheduleTask(); e.open({ieltsTestId: 2, shuffleQuestions: false});
    assert.equal(e.requests.length, 2); assert.equal(e.vm.taskEditor.shuffleQuestions, false);
    assert.equal(e.vm.taskExerciseVideo, false);
});
test('cancelled editors ignore pending replies and cached metadata is reused when reopened', async () => {
    const e = editor(); e.open(); e.vm.cancelScheduleTask();
    e.open({ieltsTestId: 2, shuffleQuestions: false});
    e.requests[0].resolve(video(1)); await tick();
    assert.equal(e.vm.taskEditor.ieltsTestId, 2); assert.equal(e.vm.taskExerciseVideo, false);
    assert.equal(e.vm.taskExerciseVideoLoading, true);
    e.requests[1].resolve(text(2)); await tick();
    e.vm.cancelScheduleTask(); e.open({ieltsTestId: 1, shuffleQuestions: true});
    assert.equal(e.vm.taskExerciseVideo, true); assert.equal(e.vm.taskEditor.shuffleQuestions, false);
    assert.equal(e.requests.length, 2);
});
test('failed or incomplete metadata is visible, blocks saving and can be retried', async () => {
    const e = editor(); e.open();
    e.requests[0].reject(Error('offline')); await tick();
    assert.equal(e.vm.taskExerciseVideoError, true); assert.equal(e.vm.taskExerciseVideoLoading, false);
    e.vm.commitScheduleTask(); assert.equal(e.vm.scheduleDay.tasks.length, 0);
    e.vm.refreshTaskExerciseVideo(); assert.equal(e.vm.taskExerciseVideoError, false);
    e.requests[1].resolve(summary(1)); await tick();
    assert.equal(e.vm.taskExerciseVideoError, true);
    e.vm.refreshTaskExerciseVideo(); e.requests[2].resolve(text(1)); await tick();
    assert.equal(e.vm.taskExerciseVideoError, false); assert.equal(e.vm.taskEditor.shuffleQuestions, true);
    e.vm.commitScheduleTask(); assert.equal(e.vm.saved.shuffleQuestions, true);
});
test('assignment detail lookup uses the existing question endpoint without a backend change', async () => {
    const serviceSource = fs.readFileSync(path.join(app, 'enrolment_class/business/EnrolmentClassService.js'), 'utf8');
    let Service, called;
    nodeVm.runInNewContext(serviceSource, {angular: {noop() {}, module: () => ({service(name, value) { Service = value; }})}});
    const api = new Service({when: Promise.resolve.bind(Promise)}, {api: {baseUrl: '/richy/', apiV1Url: 'api/'}},
        {resolve(...args) { called = args; return Promise.resolve(video(7)); }});
    assert.equal((await api.getAssignmentExerciseDetails(7)).id, 7);
    assert.equal(called[0], '/richy/api/question/get_one/7'); assert.equal(called[1], 'GET');
});
test('the real shuffle control is disabled and gray for video, with the answer-only explanation', async () => {
    const os = require('node:os');
    const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    const start = view.indexOf('                    <label data-ng-class="{\'class-task-shuffle-disabled\':'),
        end = view.indexOf('                </div>', start);
    assert.ok(start >= 0 && end > start);
    const css = view.slice(view.indexOf('<style>') + 7, view.indexOf('</style>'));
    try {
        const page = await browser.newPage({viewport: {width: 390, height: 844}});
        await page.setContent('<style>' + css + '</style><form class="class-task-editor" id="qa" ng-controller="Qa as vm">' + view.slice(start, end) + '</form>');
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
        await page.evaluate(() => {
            angular.module('Qa', []).controller('Qa', function () { this.taskEditor = {shuffleQuestions: false}; this.taskExerciseVideo = true; });
            angular.bootstrap(document.getElementById('qa'), ['Qa']);
        });
        const checkbox = page.getByRole('checkbox');
        assert.equal(await checkbox.isDisabled(), true); assert.equal(await checkbox.isChecked(), false);
        assert.equal(await checkbox.locator('..').evaluate(label => getComputedStyle(label).color), 'rgb(146, 153, 167)');
        assert.equal(await page.getByText('Bài có video giữ nguyên thứ tự câu hỏi, chỉ đảo đáp án.').isVisible(), true);
        await page.evaluate(() => { const scope = angular.element(document.getElementById('qa')).scope(); scope.$apply(() => { scope.vm.taskExerciseVideo = false; }); });
        assert.equal(await checkbox.isEnabled(), true);
        await checkbox.check(); assert.equal(await checkbox.isChecked(), true);
    } finally { await browser.close(); }
});
