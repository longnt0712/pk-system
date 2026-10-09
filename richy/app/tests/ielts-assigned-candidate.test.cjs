const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../question/views/ielts_reading_actual_test_idp.html'), 'utf8');

function candidate(parts, format = 'READING') {
    const c = nodeVm.createContext({
        vm: {currentUser: {id: 7}, isWritingRoute: format === 'WRITING', isListeningRoute: format === 'LISTENING',
            isComprehensiveRoute: false, isFlexibleRoute: format === 'WRITING', passageNumber: 1,
            testResult: {questionAnswerTestResult: []}, annotationNotes: [{id: 'n1', specificNote: 'Student note'}]},
        $stateParams: {ieltsReadingTestId: 42, assignmentTaskId: 10, assignmentParts: parts, assignmentPart: 1},
        angular: {isArray: Array.isArray, copy: structuredClone, isDefined: value => value !== undefined,
            forEach(items, callback) { Object.keys(items || {}).forEach(key => callback(items[key], Array.isArray(items) ? Number(key) : key)); }},
        readingDraftSubmitted: false,
        readingDraftAutosaveTimer: null,
        saveReadingDraft() {}, syncTimerForPersistence() {}, getActiveDurationSeconds: () => 60,
        formatTimerClock: () => '01:00', buildIeltsLearningState: () => ({annotationNotes: [{id: 'n1', specificNote: 'Student note'}]}),
        getWritingTaskPackages: () => [],
        $scope: {counter: 3600},
        blockUI: {start() {}, stop() {}},
        toastr: {error(message) { throw Error(message); }},
        document: {getElementById(id) { return {innerHTML: '<p>' + id + '<mark class="ielts-annotation has-note" data-note-id="n1">text</mark></p>'}; }},
        service: {saveTestResult(payload) { c.submitted = structuredClone(payload); c.saveCount = (c.saveCount || 0) + 1; return new Promise(() => {}); }},
        $timeout(callback) { callback(); }
    });
    c.$timeout.cancel = () => {};
    const run = (start, end) => {
        const index = source.indexOf(start);
        assert.ok(index >= 0, start);
        nodeVm.runInContext(source.slice(index, source.indexOf(end, index)), c);
    };
    run('        vm.assignmentTaskId =', '        function getResultQuestionType(');
    run('        function listeningPartNumberForOrdinal(', '        vm.ieltsNavigationAnsweredCount =');
    run('        function getReadingDraftPartNumbers()', '        function saveReadingDraft()');
    run('        function synchronizeReadingResultsBeforeSubmit()', '        function getCurrentReadingQuestionIndex(');
    run('        vm.saveTestResult = function', '        vm.isShowDetail =');
    run('        vm.changePassage = function', '        function listeningPartNumberForOrdinal(');
    run('        function normalizeListeningCandidateParts(', '        vm.startTest = function');
    c.vm.testSessionMode = 'SERIOUS';
    c.vm.selectedTestSessionMode = 'SERIOUS';
    const count = format === 'LISTENING' ? 4 : 3;
    c.vm.ieltsReadingActualTest = {id: 42, title: 'Reading test', subQuestions: Array.from({length: count}, (_, index) => {
        const number = index + 1;
        const questions = [0, 1].map(offset => {
            const ordinal = format === 'LISTENING' ? index * 10 + offset + 1 : index * 13 + offset + 1;
            return {id: ordinal, ordinalNumber: ordinal, questionAnswers: [{id: ordinal + 100,
                clientAnswer: 'answer-' + ordinal, question: {id: ordinal, parent: {type: 2}}}]};
        });
        const parent = {ordinalNumber: number, questionType: {code: 'IELTSRTP' + number}};
        return {ordinalNumber: number, questionType: parent.questionType, question: 'Passage ' + number,
            subQuestions: [{type: 2, parent, subQuestions: questions}]};
    })};
    return c;
}

test('three selected Reading Parts appear together and Finish saves every answer and passage', () => {
    const c = candidate('1,2,3');
    assert.equal(c.vm.testSessionMode, 'SERIOUS');
    assert.deepEqual(Array.from(c.vm.getIeltsNavigationParts(), part => part.number), [1, 2, 3]);
    c.vm.changePassage(c.vm.ieltsReadingActualTest.subQuestions[1].subQuestions);
    assert.equal(c.vm.passageNumber, 2); assert.equal(c.vm.activeIeltsNavigationPart(), 2);
    c.vm.saveTestResult();
    assert.deepEqual(Array.from(c.submitted.completedParts), [1, 2, 3]);
    assert.equal(c.submitted.assignmentTaskId, 10); assert.equal(c.submitted.completedPart, null);
    assert.deepEqual(c.submitted.questionAnswerTestResult.map(row => row.ordinalNumber), [1, 2, 14, 15, 27, 28]);
    for (const part of [1, 2, 3]) { assert.ok(c.submitted.testTakerPerformance.includes('passage-text-' + part)); }
    assert.ok(c.submitted.testTakerPerformance.includes('data-note-id="n1"'));
    assert.equal(JSON.parse(c.submitted.ieltsLearningState).annotationNotes[0].specificNote, 'Student note');
    c.vm.saveTestResult(); assert.equal(c.saveCount, 1, 'double clicking Finish cannot submit twice');
});

test('only selected Reading Parts are navigable and included in the submitted result', () => {
    const c = candidate('3,1,1,0,4');
    assert.deepEqual(Array.from(c.vm.getIeltsNavigationParts(), part => part.number), [1, 3]);
    c.vm.changePassage(c.vm.ieltsReadingActualTest.subQuestions[1].subQuestions);
    assert.equal(c.vm.passageNumber, 1, 'unassigned Part 2 stays hidden');
    c.vm.changePassage(c.vm.ieltsReadingActualTest.subQuestions[2].subQuestions);
    assert.equal(c.vm.passageNumber, 3);
    c.vm.saveTestResult();
    assert.deepEqual(c.submitted.questionAnswerTestResult.map(row => row.ordinalNumber), [1, 2, 27, 28]);
    assert.ok(!c.submitted.testTakerPerformance.includes('passage-text-2'));
});

test('a single assigned Part retains the legacy completedPart field', () => {
    const c = candidate('2'); c.vm.saveTestResult();
    assert.equal(c.submitted.completedPart, 2);
    assert.deepEqual(Array.from(c.submitted.completedParts), [2]);
    assert.deepEqual(c.submitted.questionAnswerTestResult.map(row => row.ordinalNumber), [14, 15]);
});

test('Listening subsets include Part 4 and preserve both selected navigation tabs', () => {
    const c = candidate('2,4', 'LISTENING');
    c.vm.ieltsReadingActualTest = c.normalizeListeningCandidateParts(c.restrictListeningAssignmentToSelectedPart(c.vm.ieltsReadingActualTest));
    assert.deepEqual(Array.from(c.vm.getIeltsNavigationParts(), part => part.number), [2, 4]);
    c.vm.saveTestResult();
    assert.deepEqual(Array.from(c.submitted.completedParts), [2, 4]);
    assert.ok(c.submitted.testTakerPerformance.includes('passage-text-3'), 'Part 4 uses the third display workspace');
    assert.deepEqual(c.submitted.questionAnswerTestResult.map(row => row.ordinalNumber), [11, 12, 31, 32]);
});

test('homework always starts directly in Serious mode', () => {
    const c = candidate('1,2'); let started = 0;
    c.$location = {search: () => ({sessionMode: 'STUDY'})};
    c.readReadingDraft = () => null; c.vm.startTest = () => { started++; };
    c.waitForReadingLearningDrafts = ready => ready();
    const start = source.indexOf('        var requestedSessionMode =');
    nodeVm.runInContext(source.slice(start, source.indexOf('        vm.confirmLeaveTest =', start)), c);
    c.vm.requestStartTest();
    assert.equal(started, 1); assert.equal(c.vm.testSessionMode, 'SERIOUS');
    assert.deepEqual(Array.from(c.vm.assignedParts), [1, 2]);
    assert.deepEqual(Array.from(c.vm.nextAssignmentParts), []);
    assert.equal(c.vm.showTestModeDialog, false);
    assert.ok(!template.includes('part.number === vm.assignedPart'), 'the template must not hide selected tabs');
});

test('personal Study notes never choose or populate assigned Serious Parts', () => {
    const c = candidate('1,3');
    c.$location = {search: () => ({})};
    const personalStudy = {partNumbers: [1, 2, 3], studiedParts: [1, 3],
        annotationNotes: [{partNumber: 1, specificNote: 'Remember this'}, {partNumber: 3, specificNote: 'Part 3 note'}]};
    let studyRead = false;
    c.readingDraftStorageKey = () => 'study'; c.readStoredDraft = () => personalStudy;
    c.readReadingDraft = (id, mode) => { if (mode === 'STUDY') { studyRead = true; } return null; };
    c.waitForReadingLearningDrafts = ready => ready(); c.vm.startTest = () => {};
    const start = source.indexOf('        var requestedSessionMode =');
    nodeVm.runInContext(source.slice(start, source.indexOf('        vm.confirmLeaveTest =', start)), c);
    c.vm.requestStartTest();
    assert.equal(studyRead, false);
    assert.equal(c.vm.testSessionMode, 'SERIOUS');
    assert.deepEqual(Array.from(c.vm.assignedParts), [1, 3]);
    assert.deepEqual(Array.from(c.vm.nextAssignmentParts), []);
    assert.equal(personalStudy.annotationNotes[0].specificNote, 'Remember this');
    assert.equal(c.vm.showTestModeDialog, false);
});

test('an unfinished assigned attempt resumes in Serious without using a Study session', () => {
    const c = candidate('2');
    const pending = {userId: 7, testId: 42, assignmentTaskId: 10, assignmentParts: [2],
        sessionMode: 'SERIOUS', completed: false,
        annotationNotes: [{partNumber: 2, specificNote: 'Assigned note'}]};
    c.readingDraftMemory = {pending}; c.readStoredDraft = key => key === 'pending' ? pending : null;
    c.readReadingDraft = (id, mode) => mode === 'SERIOUS' ? pending : null;
    c.waitForReadingLearningDrafts = ready => ready();
    c.$location = {search: () => ({})}; c.vm.startTest = () => {};
    const start = source.indexOf('        var requestedSessionMode =');
    nodeVm.runInContext(source.slice(start, source.indexOf('        vm.confirmLeaveTest =', start)), c);
    c.vm.requestStartTest();
    assert.equal(c.vm.testSessionMode, 'SERIOUS');
    assert.deepEqual(Array.from(c.vm.assignedParts), [2]);
    assert.equal(c.vm.isLearningReview, false, 'Finish stays available until the student submits');
});

test('assigned Serious submission includes all assigned Parts and its own note snapshot', () => {
    const c = candidate('1,3');
    c.readingDraftMemory = {}; c.readStoredDraft = () => null;
    c.readReadingDraft = () => null; c.waitForReadingLearningDrafts = ready => ready();
    c.$location = {search: () => ({})};
    c.vm.startTest = () => {};
    const start = source.indexOf('        var requestedSessionMode =');
    nodeVm.runInContext(source.slice(start, source.indexOf('        vm.confirmLeaveTest =', start)), c);
    c.vm.requestStartTest();
    assert.equal(c.vm.testSessionMode, 'SERIOUS');
    assert.deepEqual(Array.from(c.vm.assignedParts), [1, 3]);
    assert.deepEqual(Array.from(c.vm.getIeltsNavigationParts(), part => part.number), [1, 3]);
    c.vm.saveTestResult();
    assert.equal(c.submitted.assignmentTaskId, 10); assert.equal(c.submitted.ieltsSessionMode, 'SERIOUS');
    assert.deepEqual(c.submitted.questionAnswerTestResult.map(row => row.ordinalNumber), [1, 2, 27, 28]);
    assert.equal(JSON.parse(c.submitted.ieltsLearningState).annotationNotes[0].specificNote, 'Student note');
});

test('failed assigned submission keeps its task draft for the next attempt', async () => {
    const c = candidate('1');
    c.service.saveTestResult = payload => {
        c.submitted = structuredClone(payload);
        return Promise.resolve({id: 501, resultStatus: 'FAILED'});
    };
    c.clearReadingDraft = () => { c.cleared = (c.cleared || 0) + 1; };
    c.markStudyDraftCompleted = () => { c.marked = (c.marked || 0) + 1; };
    c.showSubmittedTestResult = () => {};
    c.vm.saveTestResult();
    await new Promise(setImmediate);
    assert.equal(c.submitted.assignmentTaskId, 10);
    assert.equal(c.submitted.ieltsSessionMode, 'SERIOUS');
    assert.equal(c.marked || 0, 0);
    assert.equal(c.cleared || 0, 0);
});

test('real Angular navigation keeps all assigned tabs and Finish accessible on desktop and mobile', async () => {
    const playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
    const browser = await playwright.chromium.launch({headless: true,
        executablePath: chromePaths.find(candidatePath => fs.existsSync(candidatePath))});
    const navStart = template.indexOf('<div class="idp-part-switcher">');
    const navEnd = template.indexOf('<label class="idp-review-control', navStart);
    const finish = template.match(/<button ng-if="!vm.isPreviewMode && !vm.isLearningReview" ng-disabled="vm.isSubmittingTest" type="button"[\s\S]*?<\/button>/)[0];
    const css = Array.from(template.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
    const navCode = source.slice(source.indexOf('        function listeningPartNumberForOrdinal('), source.indexOf('        function synchronizeReadingResultsBeforeSubmit()'));
    const partCode = source.slice(source.indexOf('        function getReadingDraftPartNumbers()'), source.indexOf('        function saveReadingDraft()'));
    try {
        for (const [width, parts] of [[1366, '1,2,3'], [390, '1,2,3'], [1366, '1,3'], [390, '2']]) {
            const c = candidate(parts);
            const page = await browser.newPage({viewport: {width, height: 850}});
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
            await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><main class="idp-reading-page" ng-controller="CandidateQa as vm">' + finish +
                '<div ng-repeat="passage in vm.ieltsReadingActualTest.subQuestions" ng-show="vm.passageNumber === $index + 1"><h2>Passage {{$index + 1}}</h2><input ng-model="passage.subQuestions[0].subQuestions[0].questionAnswers[0].clientAnswer" aria-label="Answer Part {{$index + 1}}"></div>' +
                '<div class="idp-question-nav"><div class="idp-question-nav-inner">' + template.slice(navStart, navEnd) + '</div></div></main></body></html>');
            await page.addScriptTag({path: path.join(__dirname, '../assets/scripts/external/angular.min.js')});
            await page.evaluate(({fixture, navCode, partCode}) => {
                angular.module('candidateQa', []).controller('CandidateQa', ['$timeout', function ($timeout) {
                    const vm = this;
                    Object.assign(vm, fixture);
                    vm.saveTestResult = () => { vm.submitted = true; };
                    vm.openReadingQuestion = question => {
                        vm.passageNumber = vm.getIeltsNavigationParts().find(part => part.questions.some(entry => entry.question.id === question.id)).number;
                        vm.tempQuestion = question;
                    };
                    vm.autoScrollToView = () => {};
                    new Function('vm', 'angular', '$timeout', navCode + partCode)(vm, angular, $timeout);
                    window.candidateQaVm = vm;
                }]);
                angular.bootstrap(document, ['candidateQa']);
            }, {fixture: JSON.parse(JSON.stringify(c.vm)), navCode, partCode});
            const expected = parts.split(',').map(Number);
            assert.deepEqual(await page.locator('.idp-part-tab strong').allTextContents(), expected.map(part => 'Part ' + part));
            for (const part of expected) {
                await page.getByRole('button', {name: 'Part ' + part, exact: false}).first().click();
                assert.ok(await page.getByRole('heading', {name: 'Passage ' + part, exact: true}).isVisible());
                await page.getByRole('textbox', {name: 'Answer Part ' + part, exact: true}).fill('saved-' + part);
            }
            assert.ok(await page.getByRole('button', {name: 'Finish test'}).isVisible());
            await page.getByRole('button', {name: 'Finish test'}).click();
            assert.equal(await page.evaluate(() => candidateQaVm.submitted), true);
            for (const part of expected) {
                assert.equal(await page.evaluate(part => candidateQaVm.ieltsReadingActualTest.subQuestions[part - 1].subQuestions[0].subQuestions[0].questionAnswers[0].clientAnswer, part), 'saved-' + part);
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
