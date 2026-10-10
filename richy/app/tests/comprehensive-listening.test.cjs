const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.join(__dirname, '..'), definitions = {};
const angular = {module() { return {
    factory(name, definition) { definitions[name] = definition; return this; }, directive() { return this; }
}; }, forEach(items, callback) { Object.keys(items || {}).forEach(key => callback(items[key], Array.isArray(items) ? Number(key) : key)); }};
for (const name of ['ComprehensiveVideo', 'ComprehensiveListening']) {
    nodeVm.runInNewContext(fs.readFileSync(path.join(app, 'question/business/' + name + '.js'), 'utf8'), {angular});
}
const listening = definitions.ComprehensiveListening.at(-1)({URL}, definitions.ComprehensiveVideo.at(-1)({URL}, {}));
const builder = fs.readFileSync(path.join(app, 'question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const runtime = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start); return source.slice(from, to);
}

test('opening a transcript creates gaps while preserving proper names, punctuation and line breaks', () => {
    const text = 'Alice visits London, then buys 12.5 tickets.\nA costs 4 on monday.';
    const result = listening.start(text, null, () => 0);
    assert.equal(result.total, 7);
    for (const word of ['12.5', 'A', '4', 'monday']) { assert.ok(result.gaps.some(gap => gap.answer === word)); }
    assert.equal(result.tokens.map(token => token.gap ? token.before + token.gap.answer + token.after : token.text).join(''), text);
    assert.ok(result.tokens.some(token => /Alice|London/.test(token.text || '')));
    assert.equal(result.percent, 0); assert.equal(result.passed, false);
    for (const text of ['', '  ', 'London Paris']) { assert.throws(() => listening.start(text)); }
});

test('a new attempt selects gaps at runtime; resuming preserves the layout and typed values', () => {
    const text = 'We learn every day and practice listening with friends.';
    const first = listening.start(text, null, () => 0), second = listening.start(text, null, () => 0.99);
    assert.notDeepEqual(first.gaps.map(gap => gap.index), second.gaps.map(gap => gap.index));
    first.gaps[0].value = first.gaps[0].answer.toUpperCase(); listening.update(first);
    const snapshot = listening.serialize(first), restored = listening.start(text, snapshot, () => { throw Error('Must not regenerate'); });
    assert.equal(listening.serialize(restored), snapshot); assert.equal(restored.correct, 1);
    const changed = listening.start(text + ' Extra text.', snapshot, () => 0);
    assert.notEqual(changed.source, first.source); assert.equal(changed.correct, 0);
});

test('typing is checked immediately and exactly 90% passes while 80% fails', () => {
    const session = listening.start('We hear 1 2 3 4 5 6 7 8 9.');
    assert.equal(session.total, 10);
    session.gaps.slice(0, 8).forEach(gap => { gap.value = ' ' + gap.answer.toUpperCase() + ' '; });
    listening.update(session); assert.equal(session.percent, 80); assert.equal(session.passed, false);
    session.gaps[8].value = session.gaps[8].answer; listening.update(session);
    assert.equal(session.percent, 90); assert.equal(session.passed, true);
    session.gaps[0].value = 'wrong'; listening.update(session);
    assert.equal(session.correct, 8); assert.equal(session.passed, false);
    const accents = listening.start("We can't practice café.", null, () => 0.99);
    accents.gaps.forEach(gap => { gap.value = gap.answer.replace("'", '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); });
    listening.update(accents); assert.equal(accents.passed, true);
});

test('transcript markup and template expressions are ordinary text tokens', () => {
    const text = '<script>alert(1)</script> {{vm.secret}} }{SPACE}{ We learn daily.';
    const session = listening.start(text, null, () => 0);
    assert.equal(session.tokens.map(token => token.gap ? token.before + token.gap.answer + token.after : token.text).join(''), text);
    const source = fs.readFileSync(path.join(app, 'question/business/ComprehensiveListening.js'), 'utf8');
    assert.doesNotMatch(section(source, "directive('comprehensiveListeningExercise'", "directive('comprehensiveListeningPlayer'"), /compile|ng-bind-html/);
});

test('supports direct audio and YouTube with a start time and rejects unsupported schemes', () => {
    assert.equal(listening.parseUrl('https://school.test/media/42').provider, 'audio');
    assert.equal(listening.parseUrl('https://youtu.be/M7lc1UVf-VE?t=1m30s').start, 90);
    for (const value of ['javascript:alert(1)', 'file:///audio.mp3', 'https://user:pass@school.test/audio.mp3',
        'https://youtu.be/no-id', 'https://www.tiktok.com/@person/video/6718335390845095173']) { assert.equal(listening.parseUrl(value), null); }
});

test('authoring stores only the transcript and one response slot, requiring no gap generation or answer entry', () => {
    const pack = {type: 18, pronounce: 'https://school.test/audio.mp3', motherTongue: 'We learn daily.', subQuestions: []};
    const context = {listening, plainText: value => String(value || '').trim()};
    nodeVm.runInNewContext(section(builder, '        function ensureDailyListeningPackage(', '        vm.isComprehensivePassageVisible ='), context);
    context.ensureDailyListeningPackage(pack, 2);
    assert.equal(pack.subQuestions.length, 1); assert.equal(pack.subQuestions[0].ordinalNumber, 2);
    assert.equal(pack.subQuestions[0].questionAnswers[0].answer.answer, 'DAILY_LISTENING_RESPONSE');
    assert.equal(listening.isRuntime(pack), true); assert.doesNotMatch(pack.subQuestions[0].question, /SPACE/);
    pack.motherTongue = 'New transcript text.'; context.ensureDailyListeningPackage(pack, 2);
    assert.equal(pack.motherTongue, 'New transcript text.');
});

test('each section saves one complete response and Study feedback uses the 90% threshold', () => {
    const pack = {type: 18, motherTongue: 'We hear 1 2 3 4 5 6 7 8 9.', subQuestions: [{id: 20, ordinalNumber: 2,
        questionAnswers: [{id: 200, answer: {answer: listening.responseMarker}, question: {id: 20, parent: {type: 18}}}]}]};
    pack._listeningSession = listening.start(pack.motherTongue);
    pack._listeningSession.gaps.slice(0, 9).forEach(gap => { gap.value = gap.answer; }); listening.update(pack._listeningSession);
    pack.subQuestions[0].questionAnswers[0].clientAnswer = listening.serialize(pack._listeningSession);
    const entry = {question: pack.subQuestions[0], questionPackage: pack, packageType: 18};
    const state = {testResult: {questionAnswerTestResult: [{ordinalNumber: 1, clientAnswer: 'other'}]}};
    const context = {vm: state, listening, angular, getReadingQuestionEntries: () => [entry], saveReadingDraft() {}};
    nodeVm.runInNewContext(section(runtime, '        vm.isRuntimeDailyListening =', '        vm.changeTextQuestionAnswer =') +
        section(runtime, '        function synchronizeReadingResultsBeforeSubmit()', '        function getCurrentReadingQuestionIndex('), context);
    state.changeDailyListeningAnswer(pack); state.changeDailyListeningAnswer(pack);
    assert.equal(state.testResult.questionAnswerTestResult.length, 2); assert.equal(pack.subQuestions[0].answered, true);
    context.synchronizeReadingResultsBeforeSubmit();
    assert.equal(context.isStudyAnswerCorrect(entry, state.testResult.questionAnswerTestResult[1], 'summary', []), true);
    pack._listeningSession.gaps[0].value = ''; listening.update(pack._listeningSession);
    pack.subQuestions[0].questionAnswers[0].clientAnswer = listening.serialize(pack._listeningSession);
    state.changeDailyListeningAnswer(pack);
    assert.equal(pack.subQuestions[0].answered, false);
    assert.equal(context.isStudyAnswerCorrect(entry, state.testResult.questionAnswerTestResult[1], 'summary', []), false);
});
