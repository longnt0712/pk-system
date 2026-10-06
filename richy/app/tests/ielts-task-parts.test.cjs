// Run with: node --test richy/app/tests/ielts-task-parts.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');

function editor() {
    const context = nodeVm.createContext({
        vm: {
            taskEditor: {activityType: 'IELTS_READING', title: 'Practice', section: 'HOMEWORK', requiredAttempts: 1},
            taskEditorIndex: -1,
            assignableIeltsTests: [{id: 20, title: 'Reading'}, {id: 21, title: 'Writing', hasWritingTask1: false, hasWritingTask2: true}],
            scheduleDay: {tasks: [], scheduleDate: '2026-10-06'}, scheduleTopics: [], scheduleListeningItems: [],
            taskDeadlineChanged() {}, loadTaskListeningItems() {}, initializeComprehensiveAssignment() {},
            saveScheduleDay() { this.saved = context.scheduleTaskPayload(this.scheduleDay.tasks[0]); }
        },
        angular: {isArray: Array.isArray, copy: value => JSON.parse(JSON.stringify(value)), forEach: (items, callback) => (items || []).forEach(callback)},
        toastr: {warning(message) { context.warning = message; }}
    });
    const run = (start, end) => nodeVm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);
    run('vm.taskActivityTypeChanged = function', 'vm.ieltsTestsForTask = function');
    run('vm.openScheduleTask = function', 'vm.cancelScheduleTask = function');
    run('function scheduleTaskPayload(task)', 'vm.removeScheduleTask = function');
    nodeVm.runInContext('vm.cancelScheduleTask = function () {vm.taskEditor = null;};', context);
    return context;
}
const array = value => Array.from(value);

test('new Reading, Listening and Writing assignments select every part by default', () => {
    const {vm} = editor();
    for (const [type, parts] of [['IELTS_READING', [1, 2, 3]], ['IELTS_LISTENING', [1, 2, 3, 4]], ['IELTS_WRITING', [1, 2]]]) {
        vm.taskEditor.activityType = type; vm.taskActivityTypeChanged();
        assert.deepEqual(array(vm.taskEditor.ieltsParts), parts);
    }
    vm.taskEditor.ieltsTestId = 21; vm.selectAllTaskParts();
    assert.deepEqual(array(vm.taskEditor.ieltsParts), [2], 'Writing selects only available tasks');
});

test('editing retains the saved subset and legacy single part', () => {
    const {vm} = editor(); vm.taskEditor = null;
    vm.openScheduleTask('HOMEWORK', {activityType: 'IELTS_READING', ieltsPart: 1, ieltsParts: [1, 3]});
    assert.deepEqual(array(vm.taskEditor.ieltsParts), [1, 3]);
    vm.taskEditor = null;
    vm.openScheduleTask('HOMEWORK', {activityType: 'IELTS_READING', ieltsPart: 2});
    assert.deepEqual(array(vm.taskEditor.ieltsParts), [2]);
});

test('a deselected part stays omitted when committing and serializing the task', () => {
    const {vm} = editor();
    vm.taskEditor.ieltsTestId = 20; vm.taskEditor.ieltsParts = [3, 1];
    vm.commitScheduleTask();
    assert.equal(vm.taskEditor, null);
    assert.deepEqual(array(vm.saved.ieltsParts), [1, 3]);
    assert.equal(vm.saved.ieltsPart, 1);
    assert.equal(vm.taskIeltsPartsLabel(vm.scheduleDay.tasks[0]), 'Part 1, 3');
});

test('removing all parts blocks saving and selecting all restores the complete test', () => {
    const context = editor(); const {vm} = context;
    vm.taskEditor.ieltsTestId = 20; vm.taskEditor.ieltsParts = [];
    vm.commitScheduleTask();
    assert.ok(context.warning); assert.equal(vm.scheduleDay.tasks.length, 0);
    vm.selectAllTaskParts(); vm.commitScheduleTask();
    assert.deepEqual(array(vm.saved.ieltsParts), [1, 2, 3]);
});

test('switching away from IELTS clears the previous selection', () => {
    const {vm} = editor(); vm.taskEditor.ieltsParts = [1, 3];
    vm.taskEditor.activityType = 'OTHER'; vm.taskActivityTypeChanged();
    assert.equal(vm.taskEditor.ieltsParts, null);
});
