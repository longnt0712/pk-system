const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const template = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8');
const essay = Array.from({length: 160}, (_, index) => 'word' + index).join(' ');

async function fixture(browser) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}));
    await page.goto('http://writing-assignment.test/ielts_writing_actual_test/8123?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS');
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head>' +
        '<body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"></main></body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js']) {
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external', name)});
    }
    // UI-router inserts this legacy view through jQuery. Its HTML prefilter
    // expands the self-closing note textareas before the browser parses them.
    await page.evaluate(template => $('#qa').html(template), template);
    await page.evaluate(essay => {
        window.App = {initAjax() {}};
        window.toasts = [];
        window.submissions = [];
        window.gradeCalls = 0;
        window.resultReads = 0;
        window.deletedDrafts = [];
        window.savedDrafts = [];
        window.blocking = false;
        const question = {id: 1001, ordinalNumber: 1, question: '', parent: {id: 100, type: 16},
            questionAnswers: [{id: 10001, ordinalNumberQuestionAnswer: 1, correct: true,
                answer: {id: 20001, answer: 'PRIVATE_MODEL_ANSWER'}, question: {id: 1001, ordinalNumber: 1, parent: {id: 100, type: 16}}}]};
        const data = {id: 8123, title: 'Annual Travel Distance', testFormat: 'WRITING', subQuestions: [
            {id: 10, type: 1, ordinalNumber: 1, question: '', questionType: {code: 'IELTSRTP1'}, subQuestions: [
                {id: 100, type: 16, ordinalNumber: 1, question: '<p>Describe the chart.</p>', subQuestions: [question]}]},
            {id: 11, type: 1, ordinalNumber: 2, question: '', questionType: {code: 'IELTSRTP2'}, subQuestions: []},
            {id: 12, type: 1, ordinalNumber: 3, question: '', questionType: {code: 'IELTSRTP3'}, subQuestions: []}]};
        const draft = {version: 5, userId: 7, testId: 8123, title: data.title, testMode: 'WRITING', sessionMode: 'SERIOUS',
            assignmentTaskId: 238, assignmentPart: 1, assignmentParts: [1], isPartAssignment: true,
            savedAt: new Date().toISOString(), passageNumber: 1, remainingSeconds: 900, elapsedSeconds: 300,
            answeredCount: 1, totalQuestions: 1, results: [{questionId: 1001, ordinalNumber: 1, answerId: 10001, answerOrdinal: 1, clientAnswer: essay}],
            questionStates: [{questionId: 1001, ordinalNumber: 1, answered: true,
                answers: [{answerId: 10001, answerOrdinal: 1, selected: false, clientAnswer: essay}]}],
            annotations: [], annotationNotes: []};
        window.draftKey = 'ieltsReadingInProgress:7:writing:test:8123:serious:task:238:parts:1';
        localStorage.setItem(draftKey, JSON.stringify(draft));
        const cookie = JSON.stringify({id: 7, displayName: 'Mai', roles: [{name: 'ROLE_VIEWER'}]});
        angular.module('Hrm.Question', []).value('settings', {}).value('Utilities', {}).value('$uibModal', {})
            .value('$location', {path: () => location.pathname, search: () => Object.fromEntries(new URLSearchParams(location.search))})
            .value('$stateParams', {ieltsReadingTestId: '8123', assignmentTaskId: '238', assignmentPart: '1', assignmentParts: '1', sessionMode: 'SERIOUS'})
            .value('$cookies', {getAll: () => ({'education.user': cookie})})
            .value('blockUI', {start() { blocking = true; }, stop() { blocking = false; }})
            .value('toastr', Object.fromEntries(['success', 'warning', 'error', 'info'].map(level => [level, (...args) => toasts.push({level, args})])))
            .run(['$rootScope', root => { root.settings = {layout: {}}; }])
            .directive('compile', () => ({link(scope, element, attrs) { scope.$watch(attrs.compile, value => element.html(value || '')); }}))
            .factory('QuestionService', ['$q', '$rootScope', (q, root) => {
                const service = {
                    getOne: () => q.when(angular.copy(data)),
                    getLearningDrafts: () => q.when([{draftKey, draftType: 'IELTS', savedAt: Date.now(), payload: JSON.stringify(draft)}]),
                    saveLearningDraft(dto) { savedDrafts.push(structuredClone(dto)); return q.when(true); },
                    deleteLearningDraft(key) { deletedDrafts.push(key); return q.when(true); },
                    saveTestResult(payload) {
                        submissions.push(angular.copy(payload));
                        window.saveRequest = q.defer();
                        return saveRequest.promise;
                    },
                    gradeWritingTestResult() { gradeCalls++; window.gradeRequest = q.defer(); return gradeRequest.promise; },
                    getOneTestResult() { resultReads++; return q.reject(new Error('Saved Writing must render from its returned DTO.')); }
                };
                window.completeSave = () => {
                    window.savedResult = Object.assign({}, angular.copy(submissions.at(-1)), {id: 9001, correctAnswer: 1, bandScore: null,
                        testDate: new Date().toISOString(), aiGradingStatus: 'PENDING', resultStatus: 'COMPLETED',
                        questionAnswerTestResult: [], testTakerPerformance: null, ieltsLearningState: null});
                    saveRequest.resolve(angular.copy(savedResult)); root.$evalAsync();
                };
                window.failSave = () => { saveRequest.reject(new Error('Connection failed')); root.$evalAsync(); };
                window.completeGrade = () => { gradeRequest.resolve({id: 9001, testType: 7, aiGradingStatus: 'COMPLETED',
                    aiGradingProvider: 'OPENAI', aiOverallBand: 6.5, correctAnswer: 0, bandScore: 0,
                    testName: null, testTime: null, testDate: null, activeDurationSeconds: null,
                    questionAnswerTestResult: null, testTakerPerformance: null, ieltsLearningState: null}); root.$evalAsync(); };
                window.failGrade = () => { gradeRequest.reject(new Error('Grading unavailable')); root.$evalAsync(); };
                return service;
            }]);
    }, essay);
    for (const script of ['question/business/ComprehensiveVideo.js', 'question/business/ComprehensiveListening.js', 'question/controllers/IELTSReadingActualTestController.js']) {
        await page.addScriptTag({path: path.join(app, script)});
    }
    await page.evaluate(() => {
        angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        window.qaVm = angular.element(document.getElementById('qa')).scope().vm;
    });
    await page.waitForFunction(() => qaVm.isStartTest || qaVm.startTestError);
    assert.equal(await page.evaluate(() => qaVm.startTestError), '', errors.join('\n'));
    assert.equal(await page.locator('.idp-writing-task-screen:visible textarea').inputValue(), essay);
    const finish = page.locator('.idp-candidate-mobile .idp-finish-btn');
    assert.ok(await finish.isVisible(), 'the real mobile Finish control must be visible');
    return {page, context, errors, finish};
}

test('assigned Writing on iPhone confirms the saved essay before GPT finishes and preserves restored time', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 1, {}, {timeout: 5000}).catch(async error => {
            throw Error(error.message + '\n' + errors.join('\n') + '\n' + JSON.stringify(await page.evaluate(() => ({
                submitting: qaVm.isSubmittingTest, preview: qaVm.isPreviewMode, review: qaVm.isLearningReview,
                started: qaVm.isStartTest, toasts, total: qaVm.resultQuestionTotal, blocking
            }))));
        });
        const payload = await page.evaluate(() => submissions[0]);
        assert.equal(payload.testType, 7);
        assert.equal(payload.assignmentTaskId, 238);
        assert.equal(payload.sourceQuestionId, 8123);
        assert.deepEqual(payload.completedParts, [1]);
        assert.equal(payload.questionAnswerTestResult[0].clientAnswer, essay);
        assert.equal(payload.numberOfWords, 160);
        assert.ok(payload.activeDurationSeconds >= 300 && payload.activeDurationSeconds < 315, 'restored five minutes remain in the submitted duration');
        assert.match(payload.testTime, /^1[45]:[0-5]\d$/, 'legacy testTime retains the restored remaining fifteen minutes');
        assert.ok(await page.evaluate(() => localStorage.getItem(draftKey)), 'draft remains until save succeeds');
        await page.evaluate(() => completeSave());
        await page.waitForFunction(() => qaVm.passageNumber === 4);
        assert.ok(await page.locator('.idp-result-screen').isVisible());
        assert.match(await page.locator('.idp-result-screen').innerText(), /Writing Task 1 has been recorded/);
        assert.equal(await page.evaluate(() => blocking), false, 'GPT must not keep the saved essay behind a blocking overlay');
        assert.equal(await page.evaluate(() => qaVm.isWritingGrading), true);
        assert.match(await page.locator('.idp-result-screen [role="status"]').innerText(), /Bài đã được lưu\. Đang chấm Writing bằng GPT/);
        assert.equal(await page.locator('.gpt-regrade-btn').count(), 0, 'retry stays unavailable while the first grade request is pending');
        assert.equal(await page.evaluate(() => gradeCalls), 1);
        assert.equal(await page.evaluate(() => resultReads), 0, 'success must not depend on an extra result GET');
        assert.ok(await page.evaluate(() => qaVm.submittedDurationLabel(qaVm.testResultAfterSubmitting)).then(label => /^5:[0-1]\d$/.test(label)));
        assert.match(await page.locator('.idp-result-screen .left-result').innerText(), /Thời gian làm bài:\s*5:[0-1]\d/);
        await page.getByText('CLICK TO SEE DETAILS', {exact: false}).tap();
        assert.ok((await page.locator('.writing-result-answer').innerText()).includes(essay), 'the summary save DTO must not erase the submitted essay');
        await page.evaluate(() => { qaVm.saveTestResult(); qaVm.saveTestResult(); });
        assert.equal(await page.evaluate(() => submissions.length), 1, 'late or repeated taps cannot submit the essay twice');
        const deletionsBeforeGradeFailure = await page.evaluate(() => deletedDrafts.length);
        await page.evaluate(() => failGrade());
        await page.waitForFunction(() => qaVm.isWritingGrading === false);
        assert.equal(await page.evaluate(() => qaVm.passageNumber), 4);
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.id), 9001);
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.questionAnswerTestResult[0].clientAnswer), essay);
        assert.equal(await page.evaluate(() => deletedDrafts.length), deletionsBeforeGradeFailure, 'a grading error must not change draft persistence');
        assert.equal(await page.evaluate(() => submissions.length), 1);
        assert.equal(await page.evaluate(() => blocking), false);
        assert.match(await page.locator('.idp-result-screen [role="status"]').innerText(), /Bài Writing đã được lưu/);
        assert.ok(await page.locator('.gpt-regrade-btn').isVisible(), 'the student can retry GPT without resubmitting');
        await page.locator('.gpt-regrade-btn').tap();
        await page.waitForFunction(() => gradeCalls === 2);
        assert.equal(await page.evaluate(() => submissions.length), 1, 'GPT retry never creates another submission');
        await page.evaluate(() => completeGrade());
        await page.waitForFunction(() => qaVm.isWritingGrading === false && qaVm.testResultAfterSubmitting.aiGradingStatus === 'COMPLETED');
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.aiOverallBand), 6.5);
        assert.equal(await page.evaluate(() => resultReads), 0);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});

test('a completed GPT response updates the already visible assigned Writing result', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.evaluate(() => completeSave());
        await page.waitForFunction(() => qaVm.isWritingGrading === true && qaVm.passageNumber === 4);
        await page.evaluate(() => completeGrade());
        await page.waitForFunction(() => qaVm.isWritingGrading === false && qaVm.testResultAfterSubmitting.aiGradingStatus === 'COMPLETED');
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.aiOverallBand), 6.5);
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.correctAnswer), 1, 'partial grading DTO defaults must not overwrite the saved task count');
        assert.match(await page.evaluate(() => qaVm.testResultAfterSubmitting.testName), /Annual Travel Distance/);
        assert.match(await page.evaluate(() => qaVm.testResultAfterSubmitting.testTime), /^1[45]:[0-5]\d$/);
        assert.ok(await page.evaluate(() => qaVm.testResultAfterSubmitting.activeDurationSeconds >= 300));
        assert.equal(await page.evaluate(() => qaVm.testResultAfterSubmitting.questionAnswerTestResult[0].clientAnswer), essay);
        assert.equal(await page.evaluate(() => submissions.length), 1);
        assert.equal(await page.evaluate(() => resultReads), 0);
        assert.equal(await page.evaluate(() => blocking), false);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});

test('failed assigned Writing save keeps the essay and permits another Finish attempt', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, context, errors, finish} = await fixture(browser);
        await finish.tap();
        await page.evaluate(() => failSave());
        await page.waitForFunction(() => qaVm.isSubmittingTest === false);
        assert.equal(await page.evaluate(() => qaVm.passageNumber), 1);
        assert.equal(await page.locator('.idp-writing-task-screen:visible textarea').inputValue(), essay);
        const savedDraft = await page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)));
        assert.equal(savedDraft.results[0].clientAnswer, essay);
        assert.equal(await page.evaluate(() => deletedDrafts.length), 0);
        assert.equal(await page.evaluate(() => gradeCalls), 0);
        assert.equal(await page.evaluate(() => blocking), false);
        assert.ok(await finish.isEnabled());
        await finish.tap();
        await page.waitForFunction(() => submissions.length === 2);
        assert.equal(await page.evaluate(() => submissions[1].questionAnswerTestResult[0].clientAnswer), essay);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});
