const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const template = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8');
const essay = Array.from({length: 100}, (_, index) => 'word' + index).join(' ');

async function fixture(browser, options = {}) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}));
    await page.goto('http://result-status.test/' + (options.writing ? 'ielts_writing_actual_test' : 'comprehensive_test') +
        '/8123?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS');
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        '</style></head><body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"></main></body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js']) {
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external', name)});
    }
    // UI-router inserts this legacy view through jQuery, which expands its
    // self-closing note textareas before the browser parses the template.
    await page.evaluate(html => $('#qa').html(html), template);
    await page.evaluate(({options, essay}) => {
        window.App = {initAjax() {}};
        window.toasts = [];
        window.submissions = [];
        window.gradeCalls = 0;
        window.resultReads = 0;
        window.deletedDrafts = [];
        window.savedDrafts = [];
        window.blocking = false;
        const writing = options.writing === true;
        const type = writing ? 16 : 1;
        const answerText = writing ? essay : 'Option 2';
        const question = {id: 1001, ordinalNumber: 1, question: writing ? '' : 'Choose the correct option.', parent: {id: 100, type},
            questionAnswers: (writing ? [0] : [0, 1]).map(index => ({id: 10001 + index, ordinalNumberQuestionAnswer: index + 1,
                correct: writing || index === 1, answer: {id: 20001 + index, answer: writing ? 'PRIVATE_MODEL_ANSWER' : 'Option ' + (index + 1)},
                question: {id: 1001, ordinalNumber: 1, parent: {id: 100, type}}}))};
        const answer = question.questionAnswers.at(-1);
        const data = {id: 8123, title: 'Assigned test feedback', testFormat: writing ? 'WRITING' : 'COMPREHENSIVE', subQuestions: [
            {id: 10, type: 1, ordinalNumber: 1, question: writing ? '' : '<p>Read the exercise.</p>', questionType: {code: 'IELTSRTP1'}, subQuestions: [
                {id: 100, type, ordinalNumber: 1, question: writing ? '<p>Describe the chart.</p>' : '<p>Choose one answer.</p>', subQuestions: [question]}]},
            {id: 11, type: 1, ordinalNumber: 2, question: '', questionType: {code: 'IELTSRTP2'}, subQuestions: []},
            {id: 12, type: 1, ordinalNumber: 3, question: '', questionType: {code: 'IELTSRTP3'}, subQuestions: []}]};
        const draft = {version: 5, userId: 7, testId: 8123, title: data.title, testMode: writing ? 'WRITING' : 'COMPREHENSIVE', sessionMode: 'SERIOUS',
            assignmentTaskId: 238, assignmentPart: 1, assignmentParts: [1], isPartAssignment: true, savedAt: new Date().toISOString(),
            passageNumber: 1, remainingSeconds: 900, elapsedSeconds: writing ? 300 : 2700, answeredCount: 1, totalQuestions: 1,
            results: [{questionId: 1001, ordinalNumber: 1, answerId: answer.id, answerOrdinal: answer.ordinalNumberQuestionAnswer, clientAnswer: answerText}],
            questionStates: [{questionId: 1001, ordinalNumber: 1, answered: true,
                answers: question.questionAnswers.map(a => ({answerId: a.id, answerOrdinal: a.ordinalNumberQuestionAnswer,
                    selected: !writing && a.id === answer.id, clientAnswer: a.id === answer.id ? answerText : ''}))}],
            annotations: [], annotationNotes: [{id: 'retained-note', specificNote: 'Keep this note for another attempt'}]};
        window.draftKey = 'ieltsReadingInProgress:7:' + (writing ? 'writing' : 'comprehensive') + ':test:8123:serious:task:238:parts:1';
        localStorage.setItem(draftKey, JSON.stringify(draft));
        const cookie = JSON.stringify({id: 7, displayName: 'Learner', roles: [{name: 'ROLE_VIEWER'}]});
        angular.module('Hrm.Question', []).value('settings', {}).value('Utilities', {}).value('$uibModal', {})
            .value('$location', {path: () => location.pathname, search: () => Object.fromEntries(new URLSearchParams(location.search))})
            .value('$stateParams', {ieltsReadingTestId: '8123', assignmentTaskId: '238', assignmentPart: '1', assignmentParts: '1', sessionMode: 'SERIOUS'})
            .value('$cookies', {getAll: () => ({'education.user': cookie})})
            .value('blockUI', {start() { blocking = true; }, stop() { blocking = false; }})
            .value('toastr', Object.fromEntries(['success', 'warning', 'error', 'info'].map(level => [level, (...args) => toasts.push({level, args})])))
            .run(['$rootScope', root => { root.settings = {layout: {}}; }])
            .directive('compile', () => ({link(scope, element, attrs) { scope.$watch(attrs.compile, value => element.html(value || '')); }}))
            .factory('QuestionService', ['$q', '$rootScope', (q, root) => ({
                getAssignedTask: () => q.when({activityType: 'COMPREHENSIVE', ieltsTestId: 8123, shuffleQuestions: false}),
                getOne: () => q.when(angular.copy(data)),
                getLearningDrafts: () => q.when([{draftKey, draftType: 'IELTS', savedAt: Date.now(), payload: JSON.stringify(draft)}]),
                saveLearningDraft(dto) { savedDrafts.push(structuredClone(dto)); return q.when(true); },
                deleteLearningDraft(key) { deletedDrafts.push(key); return q.when(true); },
                saveTestResult(payload) { submissions.push(angular.copy(payload)); window.saveRequest = q.defer(); return saveRequest.promise; },
                gradeWritingTestResult() { gradeCalls++; window.gradeRequest = q.defer(); return gradeRequest.promise; },
                getOneTestResult() { resultReads++; return q.when(angular.copy(savedResult)); },
                _registerTestCallbacks: (() => {
                    window.completeSave = status => {
                        window.savedResult = Object.assign({}, angular.copy(submissions.at(-1)), {id: 9001, correctAnswer: status === 'SUCCESS' ? 1 : 0,
                            bandScore: null, testDate: new Date().toISOString(), aiGradingStatus: writing ? 'PENDING' : null, resultStatus: status,
                            questionAnswerTestResult: [], testTakerPerformance: null, ieltsLearningState: null});
                        saveRequest.resolve(angular.copy(savedResult)); root.$evalAsync();
                    };
                    window.failSave = () => { saveRequest.reject(new Error('Connection failed')); root.$evalAsync(); };
                    window.failGrade = () => { gradeRequest.reject(new Error('Grading unavailable')); root.$evalAsync(); };
                })()
            })]);
    }, {options, essay});
    for (const script of ['question/business/ComprehensiveVideo.js', 'question/business/ComprehensiveListening.js', 'question/controllers/IELTSReadingActualTestController.js']) {
        await page.addScriptTag({path: path.join(app, script)});
    }
    await page.evaluate(() => {
        angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        window.qaVm = angular.element(document.getElementById('qa')).scope().vm;
    });
    await page.waitForFunction(() => qaVm.isStartTest || qaVm.startTestError);
    assert.equal(await page.evaluate(() => qaVm.startTestError), '', errors.join('\n'));
    const finish = page.locator('.idp-candidate-mobile .idp-finish-btn');
    assert.ok(await finish.isVisible(), 'the actual mobile Finish control must be visible');
    return {page, context, errors, finish};
}

async function assertFailedSavedOutcome(page) {
    const screen = page.locator('.idp-result-screen');
    assert.ok(await screen.isVisible());
    assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.resultStatus), 'FAILED');
    assert.match(await screen.innerText(), /chưa đạt|chưa hoàn thành/i, 'a saved unsuccessful attempt must state its outcome');
    assert.ok(await screen.locator('.idp-result-outcome--failed[role="status"]').isVisible());
    assert.match(await screen.locator('.idp-result-outcome--failed').innerText(), /chưa được tính hoàn thành/i);
    assert.doesNotMatch(await screen.innerText(), /has been recorded/, 'an unsuccessful assignment must not show the green completion message');
    assert.equal(await page.evaluate(() => blocking), false);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)));
    assert.ok(draft && draft.results.length, 'the unsuccessful assigned attempt keeps its answers for another attempt');
    assert.equal(draft.annotationNotes[0].specificNote, 'Keep this note for another attempt');
    assert.equal(await page.evaluate(() => deletedDrafts.length), 0);
    const warnings = await page.evaluate(() => toasts.filter(toast => toast.level === 'warning' && /chưa đạt|chưa hoàn thành/i.test(toast.args.join(' '))));
    assert.equal(warnings.length, 1, 'a saved unsuccessful attempt produces one outcome warning');
}

test('saved unsuccessful assigned comprehensive exercise warns the student and preserves the retry draft', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 1);
        assert.equal(await page.evaluate(() => submissions[0].testType), 6);
        await page.evaluate(() => completeSave('FAILED'));
        await page.waitForFunction(() => qaVm.passageNumber === 4);
        await assertFailedSavedOutcome(page);
        await page.evaluate(() => { qaVm.saveTestResult(); qaVm.saveTestResult(); });
        assert.equal(await page.evaluate(() => submissions.length), 1, 'outcome feedback cannot create a duplicate submission');
        assert.equal(await page.evaluate(() => gradeCalls), 0);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});

test('saved successful assigned comprehensive exercise clearly reports success and clears its draft', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 1);
        await page.evaluate(() => completeSave('SUCCESS'));
        await page.waitForFunction(() => qaVm.passageNumber === 4);
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.resultStatus), 'SUCCESS');
        assert.match(await page.locator('.idp-result-screen .idp-result-outcome--passed').innerText(), /đạt yêu cầu/i);
        assert.doesNotMatch(await page.locator('.idp-result-screen').innerText(), /chưa đạt|chưa hoàn thành/i);
        assert.equal(await page.evaluate(() => localStorage.getItem(draftKey)), null);
        assert.ok(await page.evaluate(() => deletedDrafts.length > 0));
        assert.equal(await page.evaluate(() => toasts.filter(toast => toast.level === 'warning' && /chưa đạt|chưa hoàn thành/i.test(toast.args.join(' '))).length), 0);
        assert.equal(await page.evaluate(() => blocking), false);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});

test('unsuccessful assigned Writing keeps its outcome and essay while GPT is pending or unavailable', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const {page, context, errors, finish} = await fixture(browser, {writing: true});
        assert.equal(await page.locator('.idp-writing-task-screen:visible textarea').inputValue(), essay);
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 1);
        await page.evaluate(() => completeSave('FAILED'));
        await page.waitForFunction(() => qaVm.passageNumber === 4 && qaVm.isWritingGrading === true);
        await assertFailedSavedOutcome(page);
        assert.match(await page.locator('.idp-result-screen').innerText(), /Đang chấm Writing bằng GPT/);
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.questionAnswerTestResult[0].clientAnswer), essay);
        await page.evaluate(() => failGrade());
        await page.waitForFunction(() => qaVm.isWritingGrading === false);
        await assertFailedSavedOutcome(page);
        assert.match(await page.locator('.idp-result-screen').innerText(), /Bài Writing đã được lưu/);
        assert.ok(await page.locator('.gpt-regrade-btn').isVisible());
        assert.equal(await page.evaluate(() => submissions.length), 1);
        assert.equal(await page.evaluate(() => gradeCalls), 1);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});

test('a rejected save reports a save error without claiming the assignment was saved or unsuccessful', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 1);
        await page.evaluate(() => failSave());
        await page.waitForFunction(() => qaVm.isSubmittingTest === false);
        assert.equal(await page.evaluate(() => qaVm.passageNumber), 1);
        assert.ok(await page.locator('.idp-result-screen').isHidden());
        assert.ok(await page.evaluate(() => toasts.some(toast => toast.level === 'error' && /saving|lưu/i.test(toast.args.join(' ')))));
        assert.equal(await page.evaluate(() => toasts.filter(toast => toast.level === 'warning' && /chưa đạt|chưa hoàn thành/i.test(toast.args.join(' '))).length), 0);
        assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)).results.length > 0));
        assert.equal(await page.evaluate(() => deletedDrafts.length), 0);
        assert.equal(await page.evaluate(() => gradeCalls), 0);
        assert.equal(await page.evaluate(() => blocking), false);
        assert.ok(await finish.isEnabled());
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 2);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});
