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
            isVideoHomeworkPractice: () => false,
            taskEditor: {activityType: 'IELTS_READING', title: 'Practice', section: 'HOMEWORK', requiredAttempts: 1},
            taskEditorIndex: -1,
            assignableIeltsTests: [{id: 20, title: 'Reading'},
                {id: 21, title: 'Writing Task 2', hasWritingTask1: false, hasWritingTask2: true},
                {id: 22, title: 'Writing Task 1', hasWritingTask1: true, hasWritingTask2: false}],
            scheduleDay: {tasks: [], scheduleDate: '2026-10-06'}, scheduleTopics: [], scheduleListeningItems: [],
            taskDeadlineChanged() {}, loadTaskListeningItems() {}, loadTaskCategoryTopics() {}, initializeComprehensiveAssignment() {},
            refreshTaskExerciseVideo() {}, taskHasComprehensiveVideo() { return false; },
            saveScheduleDay(options) { this.saved = context.scheduleTaskPayload(this.scheduleDay.tasks[0]); if (options.onSuccess) { options.onSuccess(); } }
        },
        angular: {isArray: Array.isArray, copy: value => JSON.parse(JSON.stringify(value)), forEach: (items, callback) => (items || []).forEach(callback)},
        toastr: {warning(message) { context.warning = message; }}
    });
    const run = (start, end) => nodeVm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);
    run('        vm.taskTopicIds =', '\t\tvm.tasksForSection =');
    run('vm.taskActivityTypeChanged = function', 'vm.comprehensiveTaskTopics = function');
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
    vm.taskEditor.ieltsTestId = 21; vm.assignableIeltsTests = [{id: 21, hasWritingTask2: true}]; vm.selectAllTaskParts();
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

test('editing a legacy Writing assignment only fetches the selected test and defaults to its actual task', async () => {
    const context = editor(), {vm} = context;
    const requests = [];
    context.assignmentPicker = {
        getSelected(type, id) {
            requests.push([type, id]);
            return Promise.resolve({id, title: 'Task 2 only', hasWritingTask2: true});
        }
    };
    vm.taskEditor = null;
    vm.openScheduleTask('HOMEWORK', {activityType: 'IELTS_WRITING', ieltsTestId: 21});
    assert.equal(vm.assignableIeltsTestsLoading, true);
    await new Promise(setImmediate);
    assert.deepEqual(requests, [['IELTS_WRITING', 21]]);
    assert.equal(vm.assignableIeltsTestsLoading, false);
    assert.deepEqual(array(vm.taskEditor.ieltsParts), [2]);
});

test('a Writing test with only Task 1 automatically selects it and can be saved', () => {
    const {vm} = editor();
    vm.taskEditor.activityType = 'IELTS_WRITING'; vm.taskActivityTypeChanged();
    vm.taskEditor.ieltsTestId = 22; vm.assignableIeltsTests = [{id: 22, title: 'Writing Task 1', hasWritingTask1: true}]; vm.selectAllTaskParts();
    assert.deepEqual(array(vm.ieltsPartsForTask()), [1]);
    assert.deepEqual(array(vm.taskEditor.ieltsParts), [1]);
    vm.commitScheduleTask();
    assert.deepEqual(array(vm.saved.ieltsParts), [1]);
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
