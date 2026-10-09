const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.join(__dirname, '..');
const definitions = {};
const angular = {module() { return {
    factory(name, definition) { definitions[name] = definition; return this; },
    directive() { return this; }
}; }, forEach(items, callback) { Object.keys(items || {}).forEach(key => callback(items[key], Array.isArray(items) ? Number(key) : key)); }};
for (const name of ['ComprehensiveVideo', 'ComprehensiveListening']) {
    nodeVm.runInNewContext(fs.readFileSync(path.join(app, 'question/business/' + name + '.js'), 'utf8'), {angular});
}
const video = definitions.ComprehensiveVideo.at(-1)({URL}, {});
const listening = definitions.ComprehensiveListening.at(-1)({URL}, video);
const builder = fs.readFileSync(path.join(app, 'question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const runtime = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

test('text automatically produces aligned gaps and answers, preserving names, punctuation and line breaks', () => {
    const result = listening.generate('Alice visits London, then buys 12.5 tickets.\nA costs 4 on monday.', 50, () => 0);
    assert.deepEqual(Array.from(result.answers), ['visits', 'then', 'buys', '12.5', 'tickets', 'A', 'costs', '4', 'on', 'monday']);
    assert.equal((result.html.match(/\}\{SPACE\}\{/g) || []).length, result.answers.length);
    assert.match(result.html, /Alice/);
    assert.match(result.html, /London,/);
    assert.match(result.html, /<br>/);
    assert.match(result.html, /\.\<\/span>/);
});

test('low random sampling still produces a gap; invalid or empty transcripts do not replace a test', () => {
    const result = listening.generate('We learn everyday.', 30, () => 0.99);
    assert.equal(result.answers.length, 1);
    for (const text of ['', '  ', 'London Paris']) { assert.throws(() => listening.generate(text, 50)); }
    for (const rate of [0, 29, 51, 101, NaN]) { assert.throws(() => listening.generate('We learn daily.', rate)); }
});

test('transcript markup and literal template markers remain text instead of becoming extra gaps or bindings', () => {
    const result = listening.generate('<script>alert(1)</script> {{vm.secret}} }{SPACE}{ We learn daily.', 100, () => 0);
    assert.doesNotMatch(result.html, /<script>|\{\{vm\.secret\}\}/);
    assert.match(result.html, /ng-non-bindable/);
    assert.equal((result.html.match(/\}\{SPACE\}\{/g) || []).length, result.answers.length);
});

test('saved authoring settings detect transcript or rate edits without changing saved gaps on reopen', () => {
    const pack = {motherTongue: 'We learn daily.', _listeningGapRate: 50};
    const generated = listening.generate(pack.motherTongue, pack._listeningGapRate, () => 0);
    pack.description = generated.description;
    assert.equal(listening.isCurrent(pack), true);
    const reloaded = JSON.parse(JSON.stringify(pack)); delete reloaded._listeningGapRate;
    assert.equal(listening.gapRate(reloaded), 50);
    assert.equal(listening.isCurrent(reloaded), true);
    pack._listeningGapRate = 75; listening.configure(pack);
    assert.equal(listening.isCurrent(pack), false);
    pack._listeningGapRate = 50; pack.motherTongue += ' More words.';
    assert.equal(listening.isCurrent(pack), false);
});

test('supports direct audio and YouTube with a start time and rejects unsupported schemes and hosts', () => {
    assert.equal(listening.parseUrl('https://cdn.example.test/audio.mp3?token=123').provider, 'audio');
    assert.equal(listening.parseUrl('https://school.test/media/42').provider, 'audio');
    assert.equal(listening.parseUrl('https://youtu.be/M7lc1UVf-VE?t=1m30s').start, 90);
    assert.equal(listening.parseUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE&start=120').start, 120);
    for (const value of ['javascript:alert(1)', 'file:///audio.mp3', 'https://user:pass@school.test/audio.mp3',
        'https://youtu.be/no-id', 'https://www.tiktok.com/@person/video/6718335390845095173']) {
        assert.equal(listening.parseUrl(value), null, value);
    }
});

test('generating a listening section between other question formats renumbers the whole test continuously', () => {
    const pack = {type: 18, pronounce: 'https://school.test/audio.mp3', motherTongue: 'We learn daily.', _listeningGapRate: 100, subQuestions: []};
    const preceding = {type: 1, subQuestions: [{id: 1, ordinalNumber: 1}]};
    const following = {type: 16, subQuestions: [{id: 2, ordinalNumber: 2}]};
    const state = {isComprehensiveMode: true, ieltsReadingTest: {subQuestions: [{subQuestions: [preceding, pack, following]}]},
        getOrdinalNumber() {}, refreshBuilderValidation() {}, changeInTheProcessOfCreatingReadingTest() {}};
    const errors = [];
    const context = {vm: state, listening, angular, toastr: {success() {}, warning(message) { errors.push(message); }}};
    nodeVm.runInNewContext(section(builder, '        vm.dailyListeningNeedsGenerate =', '        vm.addDailyListeningPackage ='), context);
    state.generateDailyListeningGaps(pack, 0);
    assert.equal(pack.subQuestions.length, 2);
    assert.equal(pack.subQuestions[0].questionAnswers[0].answer.answer, 'learn');
    assert.deepEqual([preceding, pack, following].flatMap(group => group.subQuestions.map(q => q.ordinalNumber)), [1, 2, 3, 4]);
    assert.match(state.dailyListeningPreview(pack), /\[2\]/);
    assert.match(state.dailyListeningPreview(pack), /\[3\]/);
    assert.equal(listening.isCurrent(pack), true);
    const before = JSON.stringify(pack.subQuestions); pack.motherTongue = '';
    state.generateDailyListeningGaps(pack, 0);
    assert.equal(JSON.stringify(pack.subQuestions), before);
    assert.equal(errors.length, 1);
});

test('the candidate fills generated inputs, submits text answers, and gets case-insensitive Study feedback', () => {
    const pack = {type: 18, subQuestions: [{id: 20, ordinalNumber: 2, question: '<p>We }{SPACE}{ daily.</p>',
        questionAnswers: [{id: 200, correct: true, answer: {answer: 'learn'}, clientAnswer: 'LEARN', question: {id: 20, parent: {type: 18}}}]}]};
    const entries = [{question: pack.subQuestions[0], questionPackage: pack, packageType: 18}];
    const state = {testSessionMode: 'STUDY', isWritingRoute: false, testResult: {questionAnswerTestResult: []}};
    const context = {vm: state, angular, getReadingQuestionEntries: () => entries};
    nodeVm.runInNewContext(section(runtime, '        function buildOneEditorQuestion(', '        function shuffleCompleteListWords(') +
        section(runtime, '        function synchronizeReadingResultsBeforeSubmit()', '        function getCurrentReadingQuestionIndex('), context);
    context.buildOneEditorQuestion(pack);
    assert.match(pack.oneEditorRenderedQuestion, /ng-model="item\.subQuestions\[0\]\.questionAnswers\[0\]\.clientAnswer"/);
    assert.doesNotMatch(pack.oneEditorRenderedQuestion, /SPACE/);
    context.synchronizeReadingResultsBeforeSubmit();
    assert.equal(state.testResult.questionAnswerTestResult[0].clientAnswer, 'LEARN');
    assert.equal(context.isStudyAnswerCorrect(entries[0], state.testResult.questionAnswerTestResult[0], 'LEARN', ['learn']), true);
    assert.equal(context.isStudyAnswerCorrect(entries[0], null, 'wrong', ['learn']), false);
    assert.equal(context.isStudyAnswerCorrect(entries[0], null, '', ['learn']), false);
});
