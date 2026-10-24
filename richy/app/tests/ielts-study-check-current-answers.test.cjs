const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.env.IELTS_STUDY_CHECK_CONTROLLER ||
    path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const listeningSource = fs.readFileSync(process.env.IELTS_STUDY_CHECK_LISTENING ||
    path.join(app, 'question/business/ComprehensiveListening.js'), 'utf8');
const forEach = (items, callback) => Object.keys(items || {}).forEach(key => callback(items[key], Array.isArray(items) ? Number(key) : key));

function listeningApi() {
    let api;
    const module = {factory(name, dependencies) { api = dependencies.at(-1)({}, {}); return module; }, directive() { return module; }};
    nodeVm.runInNewContext(listeningSource, {angular: {module: () => module}});
    return api;
}
const listening = listeningApi();

function question(id, ordinal, options = []) {
    return {id, ordinalNumber: ordinal, question: `Question ${ordinal}`, answered: true,
        questionAnswers: options.map((option, index) => ({id: id * 100 + index,
            ordinalNumberQuestionAnswer: index + 1, answer: {answer: option.text},
            correct: option.correct === true, selected: option.selected === true,
            clientAnswer: option.value == null ? '' : option.value,
            correctAnswer: option.correctAnswer || '', question: {id, ordinalNumber: ordinal}}))};
}
function pack(type, questions, extra = {}) { return {type, subQuestions: questions, ...extra}; }
function entriesFor(packs) {
    return packs.flatMap(pack => pack.subQuestions.map(question => ({question, questionPackage: pack,
        packageType: pack.type, packageQuestions: pack.subQuestions, passageQuestions: packs, passageNumber: 1})));
}
function staleResults(entries) {
    return entries.map(entry => ({ordinalNumber: entry.question.ordinalNumber, clientAnswer: 'old correct answer',
        questionAnswer: {...entry.question.questionAnswers[0], correct: true, question: {id: entry.question.id}}}));
}
function fixture(packs, overrides = {}) {
    const entries = entriesFor(packs);
    const context = nodeVm.createContext({vm: {testSessionMode: 'STUDY', isStartTest: true,
        isWritingRoute: false, isPreviewMode: false, testResult: {questionAnswerTestResult: staleResults(entries)},
        ...overrides}, angular: {forEach, isDefined: value => value !== undefined}, listening, $scope: {},
        getReadingQuestionEntries: () => entries, synchronizeReadingResultsBeforeSubmit() { throw new Error('Study must not synchronize results'); },
        saveReadingDraft() { throw new Error('Study check must not save'); }, service: {save() { throw new Error('Study check must not POST'); }}});
    const start = source.indexOf('        function decodeStudyTextEntities(');
    const end = source.indexOf('        function getCurrentReadingQuestionIndex(', start);
    assert.ok(start > 0 && end > start);
    nodeVm.runInContext(source.slice(start, end), context);
    return context;
}
function check(context) { context.vm.openStudyAnswerCheck(); return context.vm.studyAnswerCheck; }
function totals(summary) {
    return Object.fromEntries(['total', 'answered', 'correct', 'incorrect', 'unanswered'].map(key => [key, summary[key]]));
}
function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
    return value;
}

test('40 cleared current fields remain unanswered despite 40 stale correct saved rows; checking is pure', () => {
    const questions = Array.from({length: 40}, (_, index) => question(index + 1, index + 1,
        [{text: 'correct', correct: true, value: ''}]));
    const packs = [pack(2, questions)];
    const context = fixture(packs);
    const previous = JSON.stringify({packs, result: context.vm.testResult});
    deepFreeze(packs); deepFreeze(context.vm.testResult);
    const summary = check(context);
    assert.deepEqual(totals(summary), {total: 40, answered: 0, correct: 0, incorrect: 0, unanswered: 40});
    assert.equal(JSON.stringify({packs, result: context.vm.testResult}), previous);
    assert.ok(summary.rows.every(row => row.studentAnswer === 'Chưa chọn đáp án'));
    assert.equal(check(context).correct, 0);
});

for (const type of [5, 7]) {
    test(`Choose TWO type ${type} maps each unique current option to one slot and gives partial credit`, () => {
        const first = question(1, 10, [{text: 'A', correct: true, selected: true}, {text: 'B', correct: true}, {text: 'C'}]);
        const second = question(2, 11, [{text: 'A', correct: true, selected: true}]);
        const context = fixture([pack(type, [first, second])]);
        let summary = check(context);
        assert.deepEqual(totals(summary), {total: 2, answered: 1, correct: 1, incorrect: 0, unanswered: 1});
        assert.equal(summary.rows[0].studentAnswer, 'A');
        assert.equal(summary.rows[1].status, 'unanswered');
        first.questionAnswers[2].selected = true;
        summary = check(context);
        assert.deepEqual(totals(summary), {total: 2, answered: 2, correct: 1, incorrect: 1, unanswered: 0});
        first.questionAnswers[2].selected = false; first.questionAnswers[1].selected = true;
        assert.equal(check(context).correct, 2);
        first.questionAnswers.push({...first.questionAnswers[0]});
        first.questionAnswers[1].selected = false;
        assert.deepEqual(totals(check(context)), {total: 2, answered: 1, correct: 1, incorrect: 0, unanswered: 1});
        first.questionAnswers.forEach(answer => { answer.selected = false; });
        assert.equal(check(context).unanswered, 2);
    });
}

test('40-question mixed test with two half-filled Choose TWO groups cannot show 40/40', () => {
    const packs = [];
    for (let n = 1; n <= 36; n++) { packs.push(pack(2, [question(n, n, [{text: 'yes', correct: true, value: 'yes'}])])); }
    for (const [index, type] of [5, 7].entries()) {
        const ordinal = 37 + index * 2;
        packs.push(pack(type, [question(ordinal, ordinal, [{text: 'A', correct: true, selected: true}, {text: 'B', correct: true}]),
            question(ordinal + 1, ordinal + 1, [{text: 'A', correct: true, selected: true}])]));
    }
    assert.deepEqual(totals(check(fixture(packs))), {total: 40, answered: 38, correct: 38, incorrect: 0, unanswered: 2});
});

test('single-choice and table/list formats grade current selection, not old correct QA/result text', () => {
    const packs = [1, 6, 9, 10, 12].map((type, index) => pack(type, [question(index + 1, index + 1,
        [{text: 'Right', correct: true}, {text: 'Wrong', selected: true}])]));
    const context = fixture(packs);
    assert.deepEqual(totals(check(context)), {total: 5, answered: 5, correct: 0, incorrect: 5, unanswered: 0});
    packs.forEach(item => item.subQuestions[0].questionAnswers.forEach(answer => { answer.selected = false; }));
    assert.equal(check(context).unanswered, 5);
});

test('text types use current input including zero, slash alternatives and inert pound/numeric entities', () => {
    const packs = [2, 3, 11, 18].map((type, index) => pack(type, [question(index + 1, index + 1,
        [{text: '£20 / 0', correct: true, value: index === 0 ? 0 : '£20'}])]));
    const context = fixture(packs);
    assert.equal(check(context).correct, 4);
    assert.equal(context.vm.studyAnswerCheck.rows[0].studentAnswer, '0');
    assert.equal(context.vm.studyAnswerCheck.rows[1].studentAnswer, '£20');
    packs[0].subQuestions[0].questionAnswers[0].clientAnswer = '';
    assert.equal(check(context).unanswered, 1);
    assert.equal(context.cleanStudyAnswerText('<script>throw 1</script><b>&pound;&#163;&#xA3;</b>'), '£££');
    assert.equal(context.cleanStudyAnswerText('&#60;img src=x onerror=throw(1)&#62;'), '<img src=x onerror=throw(1)>');
});

test('text grading mirrors raw server trim/case rules without forgiving extra inner spaces or markup', () => {
    for (const type of [2, 3, 11, 18]) {
        const q = question(type, 1, [{text: 'New York / USA', correct: true, value: 'New  York'}]);
        const context = fixture([pack(type, [q])]);
        assert.equal(check(context).incorrect, 1);
        q.questionAnswers[0].clientAnswer = '  NEW YORK  '; assert.equal(check(context).correct, 1);
        q.questionAnswers[0].clientAnswer = '\u00a0New York'; assert.equal(check(context).incorrect, 1);
        q.questionAnswers[0].clientAnswer = '<b>New York</b>'; assert.equal(check(context).incorrect, 1);
        q.questionAnswers[0].answer.answer = '&pound;20'; q.questionAnswers[0].clientAnswer = '£20';
        assert.equal(check(context).incorrect, 1);
        q.questionAnswers[0].clientAnswer = '&pound;20'; assert.equal(check(context).correct, 1);
        assert.equal(context.vm.studyAnswerCheck.rows[0].studentAnswer, '£20');
    }
});

test('heading drag slots override stale cache and numeric placeholders; matching compares raw trim case-sensitively', () => {
    const q = question(1, 1, [{text: 'A &amp;  B', correct: true}, {text: 'Wrong'}]);
    const context = fixture([pack(4, [q])]);
    const slot = {question: {id: 1, ordinalNumber: 1}, answer: {answer: 'A &amp;  B'}, clientAnswer: 1, objectFromListB: null};
    context.$scope.listA = [{items: [slot]}];
    assert.equal(check(context).unanswered, 1);
    slot.objectFromListB = {id: 2}; slot.clientAnswer = 'a &amp;  B';
    assert.equal(check(context).incorrect, 1);
    slot.clientAnswer = 'A & B'; assert.equal(check(context).incorrect, 1);
    slot.clientAnswer = 'A &amp; B'; assert.equal(check(context).incorrect, 1);
    slot.clientAnswer = '  A &amp;  B  '; assert.equal(check(context).correct, 1);
    slot.clientAnswer = '\u00a0A &amp;  B'; assert.equal(check(context).incorrect, 1);
    slot.objectFromListB = null; assert.equal(check(context).unanswered, 1);
});

test('matching feature bound model is authoritative even when old cache and answered flag are correct', () => {
    const q = question(1, 1, [{text: 'Alpha / Beta', correct: true}, {text: 'Wrong'}]);
    const context = fixture([pack(8, [q])]);
    assert.equal(check(context).unanswered, 1);
    const model = context.vm.getStudyMatchingModel(q);
    model.answer.answer = {answer: {answer: 'Alpha'}}; assert.equal(check(context).incorrect, 1);
    model.answer.answer = {answer: {answer: 'alpha / Beta'}}; assert.equal(check(context).incorrect, 1);
    model.answer.answer = q.questionAnswers[0]; assert.equal(check(context).correct, 1);
    model.answer.answer = null; assert.equal(check(context).unanswered, 1);
    assert.equal(context.vm.getStudyMatchingModel(q), model);
});

for (const type of [13, 14, 15]) {
    test(`drag/drop format ${type} grades filled current slot, treats cleared slot as unanswered`, () => {
        const q = question(type, 1, [{text: 'Right', correct: true, selected: true}, {text: 'Wrong'}]);
        const slots = [{items: []}];
        const context = fixture([pack(type, [q], {[type === 13 ? 'completeListSlots' : 'sentenceEndingSlots']: slots})]);
        assert.equal(check(context).unanswered, 1);
        slots[0].items = [{answerIndex: 1, clientAnswer: 'Wrong'}];
        assert.equal(check(context).incorrect, 1);
        slots[0].items = [{answerIndex: 0, clientAnswer: 'Right'}];
        assert.equal(check(context).correct, 1);
        slots[0].items = []; assert.equal(check(context).unanswered, 1);
    });
}

test('runtime Daily Listening empty/invalid snapshots remain unanswered; current valid gap values control score', () => {
    const transcript = 'monday 20 apples are fresh oranges today';
    const q = question(18, 1, [{text: listening.responseMarker, correct: true}]);
    const p = pack(18, [q], {motherTongue: transcript});
    const context = fixture([p]);
    const session = listening.start(transcript, null, () => 0);
    q.questionAnswers[0].clientAnswer = listening.serialize(session);
    assert.equal(check(context).unanswered, 1);
    session.gaps[0].value = 'wrong'; listening.update(session);
    q.questionAnswers[0].clientAnswer = listening.serialize(session);
    assert.equal(check(context).incorrect, 1);
    session.gaps.forEach(gap => { gap.value = gap.answer; }); listening.update(session);
    q.questionAnswers[0].clientAnswer = listening.serialize(session);
    assert.equal(check(context).correct, 1);
    assert.match(context.vm.studyAnswerCheck.rows[0].studentAnswer, /100%/);
    q.questionAnswers[0].clientAnswer = '{invalid'; assert.equal(check(context).unanswered, 1);
    const malformed = JSON.parse(listening.serialize(session)); malformed.source = 'other-transcript';
    q.questionAnswers[0].clientAnswer = JSON.stringify(malformed); assert.equal(check(context).unanswered, 1);
    q.questionAnswers[0].clientAnswer = ''; assert.equal(check(context).unanswered, 1);
});

test('shared one-editor table prompts use the current numbered blank context, capped at 300 characters', () => {
    const questions = Array.from({length: 4}, (_, index) => question(index + 1, 21 + index, [{text: 'value', correct: true}]));
    const rows = questions.map((q, index) => `<tr><td>Specific row ${index + 1}</td><td>${'detail '.repeat(100)}}{SPACE}{</td></tr>`);
    questions[0].question = `<table>${rows.join('')}</table>`;
    const context = fixture([pack(11, questions)]);
    const summary = check(context);
    summary.rows.forEach((row, index) => {
        assert.ok(row.prompt.length <= 300, `${index}: ${row.prompt.length}`);
        assert.match(row.prompt, /_____/);
        assert.doesNotMatch(row.prompt, /SPACE|<[^>]*>/);
    });
    questions[0].question = '<table>' + questions.map((q, index) => `<tr><td>Unique row ${index + 1}</td><td>}{SPACE}{</td></tr>`).join('') + '</table>';
    check(context).rows.forEach((row, index) => {
        assert.equal(row.prompt, `Unique row ${index + 1} _____`);
        for (let other = 0; other < 4; other++) { if (other !== index) { assert.doesNotMatch(row.prompt, new RegExp(`Unique row ${other + 1}`)); } }
    });
    assert.equal(context.formatStudyQuestionPrompt('<p>Complete the sentence:</p><div>Paris is }{SPACE}{ capital.</div><p>Drop }{HEADING}{ here.</p>'),
        'Complete the sentence:\nParis is _____ capital.\nDrop _____ here.');
});

test('Study modal guards and jump-to-question API remain intact', () => {
    const context = fixture([pack(2, [question(1, 1, [{text: 'yes', correct: true}])])]);
    for (const override of [{testSessionMode: 'SERIOUS'}, {isWritingRoute: true}, {isPreviewMode: true}, {isStartTest: false}]) {
        const guarded = fixture([], override); guarded.vm.openStudyAnswerCheck(); assert.notEqual(guarded.vm.showStudyAnswerCheck, true);
    }
    const row = check(context).rows[0]; let opened;
    context.vm.openReadingQuestion = (...args) => { opened = args; };
    context.vm.openStudyAnswerQuestion(row);
    assert.equal(context.vm.showStudyAnswerCheck, false);
    assert.deepEqual(opened, [row.question, row.packageQuestions, row.passageQuestions]);
});

test('all three type8 UI handlers retain result behavior and support clearing the shared bound model', () => {
    for (const passage of [1, 2, 3]) {
        const q = question(passage, 1, [{text: 'Correct', correct: true}, {text: 'Wrong'}]);
        const context = fixture([pack(8, [q])]);
        const start = source.indexOf(`        vm.selectHeadingMedia${passage} = function (`);
        const end = source.indexOf('\n        };', start) + '\n        };'.length;
        nodeVm.runInContext(source.slice(start, end), context);
        context.vm[`initAnswer${passage === 1 ? '' : passage}`] = true;
        context.vm.testResult.questionAnswerTestResult = [];
        const handler = context.vm[`selectHeadingMedia${passage}`];
        const model = context.vm.getStudyMatchingModel(q);
        model.answer.answer = q.questionAnswers[1];
        handler(model.answer, q.questionAnswers, q, 'Wrong', [q]);
        assert.equal(check(context).incorrect, 1);
        model.answer.answer = null;
        handler(model.answer, q.questionAnswers, q, '', [q]);
        assert.equal(check(context).unanswered, 1);
        context.vm.testSessionMode = 'SERIOUS';
        handler({answer: {answer: {answer: 'Correct'}}}, q.questionAnswers, q, 'Correct', [q]);
        assert.deepEqual(Object.keys(context.vm.getStudyMatchingModel(q)), []);
        assert.equal(model.answer.answer, null);
        assert.equal(context.vm.testResult.questionAnswerTestResult[0].clientAnswer, 'Correct');
    }
});

test('type8 restore hydrates the same bound model and clearing it makes the current selection blank', () => {
    const q = question(1, 1, [{text: 'Correct', correct: true}]);
    const p = pack(8, [q]); const context = fixture([p]);
    const boundModel = context.vm.getStudyMatchingModel(q);
    const boundContainer = boundModel.answer;
    const draft = {testId: 100, sessionMode: 'STUDY', elapsedSeconds: 12};
    Object.assign(context, {
        readReadingDraft: () => draft, restoreReadingSubmissionIdentity() {}, findDraftQuestionState: () => null,
        findDraftResults: () => [{clientAnswer: 'Correct', questionAnswer: {id: q.questionAnswers[0].id}}],
        findQuestionAnswer: () => q.questionAnswers[0], restoreMatchingHeadingDraft() {}, setStudyElapsedSeconds() {},
        reopenSubmittedStudyDraft() {}, toastr: {success() {}}, readingAnnotationsRestoring: false,
        timerRestoredFromDraft: false, pendingReadingAnnotations: null, lastReadingAnnotations: [], readingAnnotationRestoreTimer: null,
        $timeout: () => 0
    });
    context.angular.copy = value => JSON.parse(JSON.stringify(value));
    context.vm.ieltsReadingActualTest = {id: 100, subQuestions: [{subQuestions: [p]}]};
    const start = source.indexOf('        function restoreReadingDraft() {');
    const end = source.indexOf('        function startReadingDraftAutosave()', start);
    nodeVm.runInContext(source.slice(start, end), context);
    context.restoreReadingDraft();
    assert.equal(context.vm.getStudyMatchingModel(q), boundModel);
    assert.equal(boundModel.answer, boundContainer);
    assert.equal(boundModel.answer.answer, q.questionAnswers[0]); assert.equal(check(context).correct, 1);
    boundModel.answer.answer = null;
    assert.equal(check(context).unanswered, 1);
    context.findDraftResults = () => [];
    context.restoreReadingDraft();
    assert.equal(boundModel.answer.answer, null); assert.equal(check(context).unanswered, 1);
});
