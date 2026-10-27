const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSCreateReadingTestController.js'), 'utf8');

function productionFunction(name) {
    const start = source.indexOf('        function ' + name + '(');
    const end = source.indexOf('\n        }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + '\n        }'.length);
}
function productionMethod(name) {
    const start = source.indexOf('        vm.' + name + ' = function');
    const end = source.indexOf('\n        };', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + '\n        };'.length);
}
function fixture() {
    const context = nodeVm.createContext({vm: {isListeningMode: true}, angular: {
        isArray: Array.isArray, isDefined: value => value !== undefined, copy: structuredClone,
        forEach(collection, callback) { (collection || []).forEach(callback); }
    }});
    for (const name of ['plainText', 'createListeningPartFour', 'ensureListeningBuilderParts',
        'ensureMultipleAnswerPackage', 'isSharedChoicePackage', 'ensureSharedChoicePackage',
        'ensureCompleteListPackage', 'ensureWritingTaskPackage', 'prepareSharedChoicePackagesForSave',
        'getPartQuestions', 'buildReadingTestValidation']) {
        nodeVm.runInContext(productionFunction(name), context);
    }
    return context;
}
function answer(id, ordinal, text, owner) {
    return {id, ordinalNumberQuestionAnswer: ordinal, correct: ordinal === 1,
        question: {id: owner}, answer: {id: id + 1000, answer: text}};
}
function sharedPackage(type, start = 11) {
    const first = {id: 100 + start, ordinalNumber: start, question: 'Question ' + start,
        questionAnswers: [answer(1001, 1, 'Option A', 100 + start), answer(1002, 2, 'Option B', 100 + start)]};
    const second = {id: 101 + start, ordinalNumber: start + 1, question: 'Question ' + (start + 1),
        questionAnswers: [answer(1003, 1, 'Older A text', 101 + start)]};
    return {id: 90 + start, type, subQuestions: [first, second]};
}
function assertNewChoice(value, owner) {
    assert.equal(Object.hasOwn(value, 'id'), false, 'a newly padded option must be inserted rather than move a stored QA');
    assert.equal(Object.hasOwn(value.answer, 'id'), false, 'the new option must not overwrite a stored Answer');
    assert.equal(value.question.id, owner);
    assert.equal(value.answer.answer, 'Option B');
    assert.equal(value.ordinalNumberQuestionAnswer, 2);
}

for (const type of [4, 10, 14, 15]) {
    test('shared choice type ' + type + ' creates independent missing options and preserves every existing identity', () => {
        const c = fixture(), pack = sharedPackage(type), [first, second] = pack.subQuestions;
        const existing = [...first.questionAnswers, ...second.questionAnswers], ids = existing.map(item => [item.id, item.answer.id]);
        c.ensureSharedChoicePackage(pack);
        const created = second.questionAnswers[1];
        assertNewChoice(created, second.id);
        assert.notEqual(created, first.questionAnswers[1]); assert.notEqual(created.answer, first.questionAnswers[1].answer);
        existing.forEach((item, index) => {
            assert.deepEqual([item.id, item.answer.id], ids[index]);
            assert.ok(first.questionAnswers.includes(item) || second.questionAnswers.includes(item));
        });
        assert.equal(new Set(pack.subQuestions.flatMap(q => q.questionAnswers).filter(a => a.id != null).map(a => a.id)).size, 3);
        const all = pack.subQuestions.flatMap(q => q.questionAnswers);
        c.ensureSharedChoicePackage(pack);
        pack.subQuestions.flatMap(q => q.questionAnswers).forEach((item, index) => assert.equal(item, all[index]));
        assertNewChoice(second.questionAnswers[1], second.id);
    });
}

test('Complete List padding has no copied IDs and repeated normalization retains the same slots and existing IDs', () => {
    const c = fixture(), pack = sharedPackage(13), [first, second] = pack.subQuestions;
    const sourceOption = first.questionAnswers[1], retained = second.questionAnswers[0];
    c.ensureCompleteListPackage(pack);
    const created = second.questionAnswers[1]; assertNewChoice(created, second.id);
    assert.equal(created.correct, true); assert.equal(sourceOption.correct, false);
    assert.equal(retained.id, 1003); assert.equal(retained.answer.id, 2003);
    c.ensureCompleteListPackage(pack);
    assert.equal(second.questionAnswers[0], retained); assert.equal(second.questionAnswers[1], created);
    assert.equal(sourceOption.id, 1002); assert.equal(sourceOption.answer.id, 2002);
});

test('a new child question receives an unbound QA rather than a copied source question reference', () => {
    const c = fixture(), pack = sharedPackage(10), second = pack.subQuestions[1];
    delete second.id; second.questionAnswers = [];
    c.ensureSharedChoicePackage(pack);
    second.questionAnswers.forEach(item => {
        assert.equal(Object.hasOwn(item, 'id'), false); assert.equal(Object.hasOwn(item.answer, 'id'), false);
        assert.deepEqual(Object.keys(item.question), []);
    });
});

test('opening and preparing a legacy three-part Listening test moves Part 4 without regenerating stored questions or answers', () => {
    const c = fixture(), pack = sharedPackage(15, 31), retainedAnswers = pack.subQuestions.flatMap(q => q.questionAnswers);
    const retainedIds = retainedAnswers.map(item => [item.id, item.answer.id]);
    const testData = {id: 42, title: 'Legacy Listening', subQuestions: [
        {id: 1, subQuestions: []}, {id: 2, subQuestions: []}, {id: 3, subQuestions: [pack]}
    ]};
    c.ensureListeningBuilderParts(testData); c.vm.ieltsReadingTest = testData;
    assert.equal(testData.id, 42); assert.equal(testData.subQuestions.length, 4);
    assert.equal(testData.subQuestions[2].subQuestions.length, 0);
    assert.equal(testData.subQuestions[3].id, undefined); assert.equal(testData.subQuestions[3].subQuestions[0], pack);
    c.prepareSharedChoicePackagesForSave();
    retainedAnswers.forEach((item, index) => {
        assert.deepEqual([item.id, item.answer.id], retainedIds[index]);
        assert.ok(pack.subQuestions.some(question => question.questionAnswers.includes(item)));
    });
    assertNewChoice(pack.subQuestions[1].questionAnswers[1], pack.subQuestions[1].id);
    const prepared = pack.subQuestions.flatMap(q => q.questionAnswers);
    c.ensureListeningBuilderParts(testData); c.prepareSharedChoicePackagesForSave();
    assert.equal(testData.subQuestions.length, 4); assert.equal(testData.subQuestions[3].subQuestions[0], pack);
    pack.subQuestions.flatMap(q => q.questionAnswers).forEach((item, index) => assert.equal(item, prepared[index]));
});

function completeListeningTest(c) {
    c.readingPartRules = Array.from({length: 4}, (_, index) => ({name: 'Part ' + (index + 1), start: index * 10 + 1, end: index * 10 + 10}));
    c.vm.isVideoBuilder = () => false;
    c.vm.ieltsReadingTest = {title: 'Older Listening test', pronounce: 'https://school.test/listening.mp3',
        subQuestions: c.readingPartRules.map(rule => ({question: '', subQuestions: [{type: 1, question: 'Choose one answer.',
            subQuestions: Array.from({length: 10}, (_, index) => ({ordinalNumber: rule.start + index,
                question: 'What does the speaker say?', questionAnswers: [{correct: true, answer: {answer: 'A'}}]}))}]}))};
}

test('a complete Listening test can publish without optional reference passages or Reading display settings', () => {
    const c = fixture(); completeListeningTest(c);
    const validation = c.buildReadingTestValidation();
    assert.equal(validation.totalQuestions, 40);
    assert.equal(validation.valid, true);
    assert.equal(validation.issues.length, 0);
    assert.equal(c.vm.ieltsReadingTest.subQuestions.every(part => !part.question && part.type == null), true);
});

test('Listening publication still requires audio and correct answers, while Reading retains its passage checks', () => {
    const c = fixture(); completeListeningTest(c);
    c.vm.ieltsReadingTest.pronounce = '';
    c.vm.ieltsReadingTest.subQuestions[0].subQuestions[0].subQuestions[0].questionAnswers[0].correct = false;
    const invalid = c.buildReadingTestValidation();
    assert.equal(invalid.valid, false);
    assert.ok(invalid.issues.some(issue => /link audio chính/.test(issue.message)));
    assert.ok(invalid.issues.some(issue => /chưa đánh dấu đáp án đúng/.test(issue.message)));
    c.vm.isListeningMode = false;
    const reading = c.buildReadingTestValidation();
    assert.ok(reading.issues.some(issue => /chưa nhập nội dung bài đọc/.test(issue.message)));
    assert.ok(reading.issues.some(issue => /chưa chọn dạng hiển thị bài đọc/.test(issue.message)));
});

test('both Listening Save Draft and Publish buttons reach saving with the correct status and existing test identity', () => {
    const c = fixture(); completeListeningTest(c);
    c.vm.ieltsReadingTest.id = 42;
    const testData = c.vm.ieltsReadingTest, questionTree = testData.subQuestions, calls = [];
    c.vm.saveReadingTest = mode => {
        const receipt = {mode, status: testData.status, testId: testData.id};
        calls.push(receipt); return receipt;
    };
    c.vm.openBuilderReviewModal = () => { throw Error('A complete Listening test must not be blocked by optional reference content'); };
    c.toastr = {warning() { throw Error('A complete Listening test must not raise a publication warning'); }};
    for (const name of ['refreshBuilderValidation', 'saveDraftReadingTest', 'publishReadingTest']) {
        nodeVm.runInContext(productionMethod(name), c);
    }
    assert.equal(c.vm.saveDraftReadingTest(), calls[0]);
    assert.deepEqual(calls[0], {mode: 'draft', status: 6, testId: 42});
    assert.equal(c.vm.publishReadingTest(), calls[1]);
    assert.deepEqual(calls[1], {mode: 'publish', status: 7, testId: 42});
    assert.equal(c.vm.builderValidation.valid, true); assert.equal(c.vm.builderValidation.totalQuestions, 40);
    assert.equal(c.vm.ieltsReadingTest, testData); assert.equal(testData.subQuestions, questionTree);
});
