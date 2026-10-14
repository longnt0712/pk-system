// Run with: node --test richy/app/tests/comprehensive-assignment-shuffle.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const editorSource = fs.readFileSync(path.join(__dirname, '../enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const resultSource = fs.readFileSync(path.join(__dirname, '../test_result/controllers/TestResultController.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../question/views/ielts_reading_actual_test_idp.html'), 'utf8');
function section(text, start, end) {
    const from = text.indexOf(start), to = text.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return text.slice(from, to);
}
const shuffleCode = section(source, '        function shuffledComprehensiveItems(', '        function normalizeLocalReadingPreview(');
const selectCode = section(source, '        vm.checkBoxMultipleChoiceQuestions =', '        vm.type5Index =');
const angular = {isArray: Array.isArray, copy: structuredClone,
    forEach(items, callback) { Object.entries(items || {}).forEach(([key, value]) => callback(value, Array.isArray(items) ? Number(key) : key)); }};
function runtime(draft = null, enabled = true) {
    const context = nodeVm.createContext({vm: {isComprehensiveRoute: true, assignmentTaskId: 10,
        assignmentShuffleQuestions: enabled, testSessionMode: 'SERIOUS'},
        angular, startFreshSeriousTest: false, readReadingDraft: () => draft});
    nodeVm.runInContext(shuffleCode, context);
    return context;
}
function fixture() {
    let ordinal = 0;
    const pack = (id, type, count) => ({id, type, subQuestions: Array.from({length: count}, (_, index) => {
        const number = ++ordinal, questionId = id * 10 + index;
        return {id: questionId, ordinalNumber: number, question: 'Question ' + number,
            parent: {type}, questionAnswers: Array.from({length: 4}, (_, answerIndex) => ({
                id: questionId * 10 + answerIndex, ordinalNumberQuestionAnswer: answerIndex + 1,
                correct: answerIndex === 1, answer: {answer: 'Option ' + (answerIndex + 1)},
                question: {id: questionId, ordinalNumber: number, parent: {type}}
            }))};
    })});
    return {id: 42, subQuestions: [{id: 1, subQuestions: [pack(10, 1, 5), pack(20, 10, 3),
        pack(30, 11, 3), pack(40, 5, 2), pack(50, 18, 1), pack(60, 4, 2)]}]};
}
function questions(data) { return data.subQuestions.flatMap(part => part.subQuestions.flatMap(pack => pack.subQuestions)); }
const ids = items => Array.from(items, item => item.id);
test('shuffle changes presentation while every original question, option and correct key survives', () => {
    const data = fixture(), original = structuredClone(data), context = runtime();
    context.Math = Object.create(Math); context.Math.random = () => 0.12345;
    context.applyComprehensiveAssignmentShuffle(data);
    assert.notDeepEqual(ids(questions(data)), ids(questions(original)));
    const originals = new Map(questions(original).map(question => [question.id, question]));
    let shuffledOptions = 0;
    for (const question of questions(data)) {
        const previous = originals.get(question.id);
        assert.equal(question.ordinalNumber, previous.ordinalNumber);
        assert.deepEqual(ids(question.questionAnswers).sort(), ids(previous.questionAnswers).sort());
        if (ids(question.questionAnswers).join() !== ids(previous.questionAnswers).join()) shuffledOptions++;
        for (const answer of question.questionAnswers) {
            const old = previous.questionAnswers.find(item => item.id === answer.id);
            assert.equal(answer.correct, old.correct);
            assert.equal(answer.ordinalNumberQuestionAnswer, old.ordinalNumberQuestionAnswer);
            assert.equal(answer.answer.answer, old.answer.answer);
        }
    }
    assert.ok(shuffledOptions > 0);
    const packs = data.subQuestions[0].subQuestions, originalPacks = original.subQuestions[0].subQuestions;
    for (const type of [11, 5, 18, 4]) {
        assert.deepEqual(ids(packs.find(pack => pack.type === type).subQuestions), ids(originalPacks.find(pack => pack.type === type).subQuestions));
    }
    assert.equal(packs[5].type, 4, 'passage heading placeholders retain their package order');
    const shared = packs.find(pack => pack.type === 10).subQuestions;
    assert.deepEqual(shared[0].questionAnswers.map(answer => answer.answer.answer), shared[1].questionAnswers.map(answer => answer.answer.answer));
    assert.match(template, /orderBy:vm\.questionAnswerDisplayOrder/);
});
test('resume keeps the exact order and answer IDs even when assignment settings later change', () => {
    const first = runtime(); first.applyComprehensiveAssignmentShuffle(fixture());
    const layout = structuredClone(first.vm.comprehensiveShuffleState);
    const resumed = runtime({comprehensiveShuffle: layout}, false);
    const data = fixture(); resumed.applyComprehensiveAssignmentShuffle(data);
    assert.deepEqual(structuredClone(resumed.vm.comprehensiveShuffleState), layout);
    const fresh = runtime(); fresh.applyComprehensiveAssignmentShuffle(fixture());
    assert.notEqual(fresh.vm.comprehensiveShuffleState.seed, layout.seed);
});
test('unchecked assignments, personal practice, previews and legacy drafts keep their original order', () => {
    for (const change of [c => { c.vm.assignmentShuffleQuestions = false; }, c => { c.vm.assignmentTaskId = null; },
        c => { c.vm.isPreviewMode = true; }, c => { c.readReadingDraft = () => ({results: []}); }]) {
        const context = runtime(), data = fixture(), original = structuredClone(data);
        change(context); context.applyComprehensiveAssignmentShuffle(data);
        assert.deepEqual(data, original);
    }
});
test('new comprehensive assignments default on; editing and payload preserve an explicit opt-out', () => {
    const context = nodeVm.createContext({vm: {taskEditor: {activityType: 'COMPREHENSIVE'},
        initializeComprehensiveAssignment() {}, isIeltsTask: () => true, scheduleDay: {tasks: []},
        taskDeadlineChanged() {}, loadTaskListeningItems() {}}, angular});
    nodeVm.runInContext(section(editorSource, 'vm.taskActivityTypeChanged =', 'vm.isIeltsTask ='), context);
    context.vm.taskActivityTypeChanged(); assert.equal(context.vm.taskEditor.shuffleQuestions, true);
    nodeVm.runInContext(section(editorSource, '\t\tvm.openScheduleTask =', '\t\tvm.cancelScheduleTask ='), context);
    context.vm.taskEditor = null;
    context.vm.openScheduleTask('HOMEWORK', {activityType: 'COMPREHENSIVE', shuffleQuestions: false, ieltsParts: [1]});
    assert.equal(context.vm.taskEditor.shuffleQuestions, false);
    nodeVm.runInContext(section(editorSource, '\t\tfunction scheduleTaskPayload(', '\t\tvm.commitScheduleTask ='), context);
    assert.equal(context.scheduleTaskPayload(context.vm.taskEditor).shuffleQuestions, false);
    context.vm.taskEditor.shuffleQuestions = true;
    assert.equal(context.scheduleTaskPayload(context.vm.taskEditor).shuffleQuestions, true);
});
test('TestResult review follows the submitted question IDs and retains correctness and missing rows', () => {
    const context = nodeVm.createContext({angular});
    nodeVm.runInContext(section(resultSource, '        function addMissingResultRows(', '        vm.getResultYourAnswer ='), context);
    const rows = [1, 3, 4].map(number => ({ordinalNumber: number, clientAnswer: 'Answer ' + number,
        isCorrectTestResultDetail: number !== 3, questionAnswer: {id: number * 100, question: {id: number * 10}}}));
    const result = {testType: 6, questionAnswerTestResult: rows,
        ieltsLearningState: JSON.stringify({comprehensiveShuffle: {enabled: true, questionOrder: [40, 10, 30]}})};
    context.addMissingResultRows(result);
    assert.deepEqual(Array.from(result.questionAnswerTestResult.filter(row => !row.isMissingResultRecord), row => row.ordinalNumber), [4, 1, 3]);
    assert.equal(result.questionAnswerTestResult.find(row => row.ordinalNumber === 3).isCorrectTestResultDetail, false);
    assert.ok(result.questionAnswerTestResult.find(row => row.ordinalNumber === 2).isMissingResultRecord);
});

test('real Angular renders shuffled choices and clicks save original answer IDs on desktop and mobile', async () => {
    const os = require('node:os');
    const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const candidateHtml = section(template, '<div class="col-md-12 idp-single-choice-question"', '<span style="padding-bottom: 50px;"');
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 900}});
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.setContent('<main id="qa" ng-controller="Qa as vm"><div ng-repeat="item in vm.test.subQuestions[0].subQuestions">' + candidateHtml + '</div></main>');
            await page.addScriptTag({path: path.join(__dirname, '../assets/scripts/external/angular.min.js')});
            await page.evaluate(({shuffleCode, selectCode, data}) => {
                angular.module('qa', []).directive('compile', ['$compile', function ($compile) {
                    return {link(scope, element, attrs) { element.html(scope.$eval(attrs.compile)); $compile(element.contents())(scope); }};
                }]).controller('Qa', ['$scope', function ($scope) {
                    const vm = this, startFreshSeriousTest = false, readReadingDraft = () => null;
                    vm.isComprehensiveRoute = true; vm.assignmentTaskId = 10; vm.assignmentShuffleQuestions = true;
                    eval(shuffleCode + '\nvm.test = vm.ieltsReadingActualTest = applyComprehensiveAssignmentShuffle(data);');
                    vm.clickShowChildren = () => {};
                    vm.videoQuestionVisible = () => true;
                    vm.testResult = {questionAnswerTestResult: []};
                    eval(selectCode);
                    vm.settingActualTest = {fontSize: '17px'};
                    $scope.vm = vm;
                }]);
                angular.bootstrap(document.getElementById('qa'), ['qa']);
            }, {shuffleCode, selectCode, data: fixture()});
            const expected = await page.evaluate(() => {
                const vm = angular.element(document.getElementById('qa')).scope().vm;
                const pack = vm.test.subQuestions[0].subQuestions.find(pack => pack.type === 1);
                return pack.subQuestions.flatMap(question => question.questionAnswers.map(answer => ({id: answer.id, text: answer.answer.answer, correct: answer.correct, questionId: question.id})));
            });
            const rendered = await page.locator('.idp-single-choice-answer').allTextContents();
            assert.deepEqual(errors, []);
            assert.deepEqual(rendered.map(text => text.trim()), expected.map(answer => answer.text));
            const correctIndex = expected.findIndex(answer => answer.correct);
            await page.locator('.idp-single-choice-answer input').nth(correctIndex).check();
            const saved = await page.evaluate(() => {
                const row = angular.element(document.getElementById('qa')).scope().vm.testResult.questionAnswerTestResult[0];
                return {answerId: row.questionAnswer.id, questionId: row.questionAnswer.question.id, correct: row.questionAnswer.correct};
            });
            assert.deepEqual(saved, {answerId: expected[correctIndex].id, questionId: expected[correctIndex].questionId, correct: true});
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});
