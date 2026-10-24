const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vmModule = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSCreateReadingTestController.js'), 'utf8');

function productionFunction(name) {
    const start = source.indexOf('        function ' + name + '(');
    const end = source.indexOf('\n        }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + '\n        }'.length);
}
function section(startMarker, endMarker) {
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, startMarker);
    return source.slice(start, end);
}
function harness(writing) {
    const state = {
        isWritingMode: writing,
        ieltsReadingTest: {subQuestions: [{subQuestions: []}]},
        preparePart() {}, refreshBuilderValidation() {}, changeInTheProcessOfCreatingReadingTest() {}
    };
    const context = {
        vm: state,
        angular: {forEach: (items, callback) => (items || []).forEach(callback)},
        example: '<p>Question ? to ? Choose TRUE, FALSE, NOT GIVEN.</p>',
        isSharedChoicePackage: () => false
    };
    vmModule.createContext(context);
    vmModule.runInContext(['plainText', 'ensureWritingTaskPackage', 'getPartQuestions', 'createReadingQuestionPackage', 'renumberReadingPackages'].map(productionFunction).join('\n') + '\n' +
        section('        vm.onReadingPackageTypeChange =', '        vm.updateOneEditorContent =') + '\n' +
        section('        vm.insertPackageAfter =', '        vm.addQuestionForPart ='), context);
    return state;
}

test('new Writing tasks immediately use Writing editors and reserve the other Task type for the next insertion', () => {
    const state = harness(true);
    state.insertPackageAfter(0, -1);
    const tasks = state.ieltsReadingTest.subQuestions[0].subQuestions;
    assert.equal(tasks[0].type, 16);
    assert.equal(tasks[0].isHaveChildren, true);
    assert.match(tasks[0].question, /Writing Task 1/);
    assert.doesNotMatch(tasks[0].question, /TRUE|FALSE|NOT GIVEN|Question \?/);
    assert.equal(tasks[0].subQuestions.length, 1);
    assert.equal(tasks[0].subQuestions[0].questionAnswers[0].answer.answer, 'WRITING_TASK_1_RESPONSE');
    state.insertPackageAfter(0, 0);
    assert.equal(tasks[1].type, 17);
    assert.equal(tasks[1].subQuestions[0].ordinalNumber, 2);
    assert.equal(tasks[1].subQuestions[0].questionAnswers[0].answer.answer, 'WRITING_TASK_2_RESPONSE');
    assert.equal(tasks[0].ordinalNumber, 1);
    assert.equal(tasks[1].ordinalNumber, 2);
});

test('Writing creation preserves existing task content; Reading and Listening keep their unconfigured package workflow', () => {
    const state = harness(true);
    state.insertPackageAfter(0, -1);
    const first = state.ieltsReadingTest.subQuestions[0].subQuestions[0];
    first.question = '<p>Describe the chart.</p>';
    first.description = 'Keep the outline.';
    const before = JSON.stringify(first);
    state.insertPackageAfter(0, -1);
    assert.equal(JSON.stringify(first), before.replace('"ordinalNumber":1', '"ordinalNumber":2'));
    for (const mode of ['READING', 'LISTENING']) {
        const nonWriting = harness(false);
        nonWriting.insertPackageAfter(0, -1);
        const pack = nonWriting.ieltsReadingTest.subQuestions[0].subQuestions[0];
        assert.equal(pack.type, undefined, mode);
        assert.equal(pack.isHaveChildren, false, mode);
        assert.equal(pack.subQuestions.length, 0, mode);
        assert.match(pack.question, /Question \? to \?/, mode);
    }
});
