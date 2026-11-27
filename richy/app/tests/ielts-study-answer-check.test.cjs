const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const controllerSource = fs.readFileSync(
    path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'),
    'utf8'
);
const template = fs.readFileSync(
    path.join(__dirname, '../question/views/ielts_reading_actual_test_idp.html'),
    'utf8'
);
const findMistakesSource = fs.readFileSync(path.join(__dirname, '../question/business/ComprehensiveFindMistakes.js'), 'utf8');

function forEach(items, callback) {
    Object.keys(items || {}).forEach(key => callback(items[key], Array.isArray(items) ? Number(key) : key));
}

function question(id, ordinalNumber, type, answers, prompt) {
    const value = {id, ordinalNumber, question: prompt, answered: false, questionAnswers: []};
    value.questionAnswers = answers.map((answer, index) => ({
        id: id * 10 + index,
        answer: {answer: answer.text},
        correct: answer.correct,
        selected: answer.selected === true,
        clientAnswer: answer.clientAnswer || '',
        correctAnswer: answer.correctAnswer || '',
        question: {id, parent: {type}}
    }));
    return value;
}

function studyContext(extraEntries = [], service) {
    const questions = [
        question(1, 1, 1, [
            {text: 'A', correct: true, selected: true},
            {text: 'B', correct: false}
        ], 'Question one'),
        question(2, 2, 1, [
            {text: 'A', correct: true},
            {text: 'B', correct: false, selected: true}
        ], 'Question two'),
        question(3, 3, 2, [
            {text: 'Paris', correct: true}
        ], '<p>Complete the sentence:</p><div>Paris is }{SPACE}{ capital.</div><p>Drop }{HEADING}{ here.</p>'),
        question(4, 4, 2, [
            {text: 'US / USA', correct: true, clientAnswer: 'usa'}
        ], 'Question four')
    ];
    const entries = questions.map((item, index) => ({
        question: item,
        packageType: index < 2 ? 1 : 2,
        packageQuestions: questions,
        passageQuestions: [{subQuestions: questions}],
        passageNumber: 1
    }));
    const definition = {factory(name, create) { this.mistakes = create(); return this; }, component() { return this; }};
    nodeVm.runInNewContext(findMistakesSource, {angular: {module: () => definition}, window: {APP_VERSION: 'test'}});
    const context = nodeVm.createContext({
        vm: {
            testSessionMode: 'STUDY',
            isWritingRoute: false,
            isPreviewMode: false,
            isStartTest: true,
            ieltsReadingActualTest: {id: 99},
            testResult: {questionAnswerTestResult: []}
        },
        angular: {forEach},
        getReadingQuestionEntries: () => entries.concat(extraEntries),
        mistakes: definition.mistakes,
        service
    });
    const start = controllerSource.indexOf('        function synchronizeReadingResultsBeforeSubmit()');
    const end = controllerSource.indexOf('        function getCurrentReadingQuestionIndex(', start);
    assert.ok(start >= 0 && end > start);
    nodeVm.runInContext(controllerSource.slice(start, end), context);
    return context;
}

test('Study answer check classifies correct, incorrect and unanswered questions without submitting', () => {
    const context = studyContext();

    context.vm.openStudyAnswerCheck();

    assert.equal(context.vm.showStudyAnswerCheck, true);
    assert.deepEqual(
        {
            total: context.vm.studyAnswerCheck.total,
            answered: context.vm.studyAnswerCheck.answered,
            correct: context.vm.studyAnswerCheck.correct,
            incorrect: context.vm.studyAnswerCheck.incorrect,
            unanswered: context.vm.studyAnswerCheck.unanswered
        },
        {total: 4, answered: 3, correct: 2, incorrect: 1, unanswered: 1}
    );
    assert.equal(context.vm.studyAnswerCheck.rows[1].studentAnswer, 'B');
    assert.equal(context.vm.studyAnswerCheck.rows[1].correctAnswer, 'A');
    assert.equal(context.vm.studyAnswerCheck.rows[2].studentAnswer, 'Chưa chọn đáp án');
    assert.equal(context.vm.studyAnswerCheck.rows[2].prompt, 'Complete the sentence:\nParis is _____ capital.\nDrop _____ here.');
    assert.doesNotMatch(context.vm.studyAnswerCheck.rows[2].prompt, /SPACE|HEADING|<[^>]+>/);
    assert.equal(context.vm.studyAnswerCheck.rows[3].status, 'correct');
});

test('Study reviews Find Mistakes together with other questions and checks unsaved text without changing the attempt', async () => {
    const questions = [5, 6, 7].map(ordinalNumber => ({ordinalNumber, questionAnswers: [{id: ordinalNumber + 100}]}));
    questions[0].questionAnswers[0].clientAnswer = '3|two loaves';
    const pack = {motherTongue: 'She [[go]] home and [[buy]] [[two loafs]].', subQuestions: questions,
        _findMistakesEdit: {index: 1, candidate: {id: 1}, text: 'goes'}};
    const entries = questions.map(question => ({question, questionPackage: pack, packageType: 19}));
    const context = studyContext(entries, {
        reviewStudyMistakes(testId, submissions) {
            assert.equal(testId, 99);
            assert.deepEqual({...submissions}, {105: '3|two loaves', 106: '1|goes', 107: ''});
            return Promise.resolve({
                105: {submitted: 'go → goes', expected: 'go → went', correct: false},
                106: {submitted: '', expected: 'buy → bought', correct: false},
                107: {submitted: 'two loafs → two loaves', expected: 'two loafs → two loaves', correct: true}
            });
        }
    });
    const pending = context.vm.openStudyAnswerCheck();
    const summary = context.vm.studyAnswerCheck;
    assert.equal(summary.total, 7);
    assert.equal(summary.checkingMistakes, true);
    assert.equal(summary.rows[4].prompt, 'She go home and buy two loafs.');
    assert.equal(summary.rows[4].studentAnswer, 'two loafs → two loaves');
    assert.equal(summary.rows[5].studentAnswer, 'go → goes');
    await pending;
    assert.equal(summary.checkingMistakes, false);
    assert.deepEqual([summary.correct, summary.incorrect, summary.unanswered], [3, 2, 2]);
    assert.deepEqual(Array.from(summary.rows.slice(4), row => row.status), ['incorrect', 'unanswered', 'correct']);
    assert.equal(summary.rows[4].correctAnswer, 'go → went');
    assert.equal(questions[1].questionAnswers[0].clientAnswer, undefined);
    assert.deepEqual(context.vm.testResult.questionAnswerTestResult, []);
});

test('a failed review keeps Find Mistakes visible without counting them as wrong', async () => {
    const question = {ordinalNumber: 5, questionAnswers: [{id: 105, clientAnswer: '1|went'}]};
    const pack = {motherTongue: 'She [[go]] home.', subQuestions: [question]};
    const context = studyContext([{question, questionPackage: pack, packageType: 19}], {
        reviewStudyMistakes: () => Promise.reject(new Error('Failed'))
    });
    await context.vm.openStudyAnswerCheck();
    const summary = context.vm.studyAnswerCheck;
    assert.equal(summary.total, 5);
    assert.equal(summary.incorrect, 1);
    assert.equal(summary.mistakeReviewFailed, true);
    assert.equal(summary.rows[4].status, 'pending');
    assert.equal(summary.rows[4].studentAnswer, 'go → went');
});

test('answer check cannot open outside Study mode', () => {
    const context = studyContext();
    context.vm.testSessionMode = 'SERIOUS';
    context.vm.openStudyAnswerCheck();
    assert.notEqual(context.vm.showStudyAnswerCheck, true);
});

test('Study mode template exposes the review modal and keeps dark question ranges readable', () => {
    assert.match(template, /vm\.testSessionMode === 'STUDY'[\s\S]*?vm\.openStudyAnswerCheck\(\)/);
    assert.match(template, /Kiểm tra đáp án/);
    assert.match(template, /Bạn chọn/);
    assert.match(template, /Đáp án đúng/);
    assert.match(template, /Chưa trả lời/);
    assert.match(template, /width:\s*min\(1480px,\s*calc\(100vw - 32px\)\)/);
    assert.match(template, /\.idp-study-check-prompt\s*\{[^}]*white-space:\s*pre-line/);
    assert.match(template, /idp-contrast-white-black \.idp-multiple-answer-range\s*\{[\s\S]*?color:\s*#ffffff\s*!important;[\s\S]*?background:\s*#181818\s*!important;/);
    assert.match(template, /idp-contrast-yellow-black \.idp-multiple-answer-range\s*\{[\s\S]*?color:\s*#ffe600\s*!important;[\s\S]*?background:\s*#181818\s*!important;/);
});

