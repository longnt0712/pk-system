const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8').replace(/\r\n/g, '\n');
const dashboard = read('dashboards/controllers/DashboardController.js');
const html = read('dashboards/views/general-alt.html');
const view = read('question/controllers/ViewController.js');
const routes = read('question/question.module.js');
const plain = value => JSON.parse(JSON.stringify(value));
const angular = {copy: structuredClone, isArray: Array.isArray, isUndefined: value => value === undefined};
function section(text, start, end) {
    const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start); return text.slice(from, to);
}
const board = section(html, '<section class="student-assignment-board"', '</section>');
const tags = [...board.matchAll(/<[a-z][^>]*>/gi)].map(match => match[0]);
const tag = marker => {const found = tags.find(value => value.includes(marker)); assert.ok(found, marker); return found;};
const attr = (element, name) => {const match = element.match(new RegExp(name + '="([^"]*)"')); assert.ok(match, name); return match[1];};
function dashboardFixture() {
    const calls = [];
    const context = nodeVm.createContext({vm: {}, angular, $state: {go(name, params) {calls.push({name, params: plain(params)});}}});
    nodeVm.runInContext(section(dashboard, '        vm.assignmentKey =', '        function ieltsReminderParts('), context);
    return {vm: context.vm, calls, evaluate(expression, task) {context.task = task; return nodeVm.runInContext('(' + expression + ')', context);}};
}
function cardState(fixture, task) {
    return {
        button: !!fixture.evaluate(attr(tag('ng-click="vm.openAssignedTask(task)"'), 'ng-if'), task),
        badge: !!fixture.evaluate(attr(tag('class="is-free"'), 'ng-if'), task),
        freeText: !!fixture.evaluate(attr(tag('student-assignment-topic is-free'), 'ng-if'), task),
        note: !!fixture.evaluate(attr(tag('student-assignment-read-note'), 'ng-if'), task),
        freeStyle: !!fixture.evaluate(attr(tag('ng-class='), 'ng-class'), task)['is-free-task']
    };
}
const directTask = (id = 74406, taskId = 257) => ({activityType: 'DAILY_LISTENING', taskId,
    sourceQuestionId: id, sourceQuestionTitle: 'CAM.14.TEST.1.PART.1.1', topicId: null, ieltsTestId: null, requiredAttempts: 1, completedAttempts: 0});

test('source-only dictation cards show the real exercise button instead of note-only labels', () => {
    const fixture = dashboardFixture();
    assert.deepEqual(cardState(fixture, directTask()), {button: true, badge: false, freeText: false, note: false, freeStyle: false});
    assert.equal(fixture.vm.assignmentActionLabel(directTask()), 'Làm Daily Listening');
    assert.ok(tag('ng-if="task.sourceQuestionId"'));
});

test('genuine note-only tasks keep their instruction labels and do not gain an unrelated exercise button', () => {
    const fixture = dashboardFixture();
    for (const activityType of ['DAILY_LISTENING', 'DAILY_VOCAB', 'OTHER']) {
        const task = {activityType, taskId: 258, topicId: null, ieltsTestId: null};
        assert.deepEqual(cardState(fixture, task), {button: false, badge: true, freeText: true, note: true, freeStyle: true}, activityType);
    }
    assert.equal(fixture.vm.hasAssignmentExercise(null), false);
    assert.equal(fixture.vm.hasAssignmentExercise({activityType: 'DAILY_VOCAB', sourceQuestionId: 74406}), false);
});

test('legacy Topic, IELTS Parts and completed multi-topic vocab keep their existing dashboard behavior', () => {
    const fixture = dashboardFixture();
    const tasks = [
        {activityType: 'DAILY_LISTENING', taskId: 10, topicId: 20, sourceQuestionId: 30, categoryId: 5},
        {activityType: 'DAILY_VOCAB', taskId: 11, topicId: 21},
        ...['IELTS_READING', 'IELTS_LISTENING', 'IELTS_WRITING', 'COMPREHENSIVE'].map((activityType, index) =>
            ({activityType, taskId: 12 + index, ieltsTestId: 40 + index, ieltsPart: 1, ieltsParts: [1, 2], remainingIeltsParts: [2]}))
    ];
    for (const task of tasks) {assert.equal(cardState(fixture, task).button, true); fixture.vm.openAssignedTask(task);}
    assert.equal(fixture.calls[0].name, 'application.view');
    assert.deepEqual(fixture.calls[0].params, {listFlashCard: 0, assignmentTaskId: 10, assignmentTopicId: 20, assignmentCategoryId: 5, assignmentSourceQuestionId: 30});
    assert.equal(fixture.calls[1].name, 'application.daily_vocab');
    for (const call of fixture.calls.slice(2)) {assert.equal(call.params.assignmentParts, '2'); assert.equal(call.params.sessionMode, 'SERIOUS');}
    const completed = {activityType: 'DAILY_VOCAB', taskId: 11, topicId: 21, taskTotalTopics: 3, requiredAttempts: 1, completedAttempts: 1};
    assert.equal(cardState(fixture, completed).button, false); fixture.vm.openAssignedTask(completed); assert.equal(fixture.calls.length, 6);
});

async function tick() {for (let index = 0; index < 16; index++) {await Promise.resolve();}}
function listeningFixture(params, authoritativeTask) {
    const loaded = [], verified = [], vm = {searchDto: {questionTopics: []}, selectedUser: {id: 999}, mode: {id: 8},
        resetFlipCard() {}, setUpTable() {this.bsTableControl = {options: {}};}, setUpAudio() {}};
    const context = nodeVm.createContext({vm, $stateParams: params, angular,
        service: {
            getAssignedTask(id) {verified.push(id); return authoritativeTask instanceof Error ? Promise.reject(authoritativeTask) : Promise.resolve(authoritativeTask);},
            getOne(id) {loaded.push(id); return Promise.resolve({id, question: 'CAM listening ' + id, motherTongue: 'Listen and write the missing words', questionType: {id: 11}, testFormat: 'DAILY_LISTENING', status: 7});},
            getPageForGames() {throw Error('Must not load unrelated Topic exercises');}
        }, blockUI: {start() {}, stop() {}}, toastr: {error() {}, warning() {}}, alert() {throw Error('Must not request a Topic');},
        createQuestionsWithOptions: structuredClone, processFillingGapsByMode: text => text, resumeDailyListeningFromDashboard() {}, $scope: {chooseFillingGaps() {}}});
    nodeVm.runInContext(section(view, '        vm.isDirectAssignedDailyListening =', '        vm.standaloneListeningLoading =')
        + section(view, '        vm.assignmentLaunch =', '        vm.isFlashCardMode =')
        + section(view, '        vm.getPageFlashCard = function', '        vm.createQuiz =')
        + section(view, '        function initializeAssignedDailyListening()', '        if (vm.isDirectAssignedDailyListening)'), context);
    return {vm, context, loaded, verified};
}

test('clicking each topicless dictation card opens and verifies that exact task and lesson in standalone dictation mode', async () => {
    const fixture = dashboardFixture();
    for (const task of [directTask(74406, 257), directTask(74407, 258)]) {
        assert.equal(cardState(fixture, task).button, true); fixture.vm.openAssignedTask(task);
        const launch = fixture.calls.at(-1); assert.equal(launch.name, 'application.view');
        assert.equal(launch.params.assignmentTaskId, task.taskId); assert.equal(launch.params.assignmentSourceQuestionId, task.sourceQuestionId);
        const lesson = listeningFixture(launch.params, task);
        assert.equal(lesson.vm.isStandaloneDailyListening, true); assert.equal(lesson.vm.isDirectAssignedDailyListening, true);
        assert.equal(lesson.vm.standaloneDailyListeningId, task.sourceQuestionId);
        lesson.vm.getPageFlashCard(); assert.equal(lesson.loaded.length, 0, 'task must be verified before content loads');
        lesson.context.initializeAssignedDailyListening(); await tick();
        assert.deepEqual(lesson.verified, [task.taskId]); assert.deepEqual(lesson.loaded, [task.sourceQuestionId]);
        assert.equal(lesson.vm.assignmentLaunch.verified, true); assert.equal(lesson.vm.currentCard.id, task.sourceQuestionId);
        assert.equal(lesson.vm.showGapTitleTable, false); assert.equal(lesson.vm.assignmentLaunch.taskId, task.taskId);
    }
    const route = section(routes, ".state('application.view',", ".state(");
    for (const param of ['assignmentTaskId', 'assignmentSourceQuestionId']) {assert.match(route, new RegExp(param));}
    assert.match(read('question/views/view.html'), /ng-if="vm\.isStandaloneDailyListening" class="daily-listening-standalone-heading"/);
});

test('an unavailable task or mismatched server source cannot load an unrelated dictation lesson', async () => {
    const fixture = dashboardFixture(), task = directTask(); fixture.vm.openAssignedTask(task); const params = fixture.calls[0].params;
    for (const metadata of [null, {...task, taskId: 999}, {...task, sourceQuestionId: 74407}, {...task, activityType: 'DAILY_VOCAB'}, new Error('offline')]) {
        const lesson = listeningFixture(params, metadata); lesson.context.initializeAssignedDailyListening(); await tick();
        assert.equal(lesson.loaded.length, 0); assert.notEqual(lesson.vm.assignmentLaunch.verified, true); assert.ok(lesson.vm.standaloneListeningError);
    }
});
