const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.join(__dirname, '..');
const daily = fs.readFileSync(path.join(app, 'question/controllers/DailyVocabController.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(app, 'dashboards/controllers/DashboardController.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 12; i++) { await Promise.resolve(); } };
function functionSource(source, declaration) {
    const start = source.indexOf(declaration);
    assert.ok(start >= 0, declaration);
    const body = source.indexOf('{', start);
    let depth = 1;
    for (let end = body + 1; end < source.length; end++) {
        if (source[end] === '{') { depth++; }
        if (source[end] === '}' && --depth === 0) { return source.slice(start, end + 1) + ';'; }
    }
    throw Error('Unclosed function: ' + declaration);
}
function storage(initial = []) {
    const values = new Map(initial);
    return {values, get length() { return values.size; }, key(index) { return [...values.keys()][index]; },
        getItem(key) { return values.get(key) || null; }, setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }};
}
function dailySetup(topicId = 200, taskId = 55) {
    const localStorage = storage(), writes = [], deletions = [], warnings = [];
    const vm = {currentUser: {id: 7}, assignmentSelectionLocked: !!taskId,
        assignmentLaunch: {taskId, topicId, categoryId: 2}, dailySaveReady: true,
        dailyVocabPendingResult: null, testResult: {}, dailySaveStatus: 'idle'};
    const service = {
        saveLearningDraft(dto) { writes.push(plain(dto)); return Promise.resolve(true); },
        deleteLearningDraft(key) { deletions.push(key); return Promise.resolve(true); },
        getAssignedTask() { return Promise.resolve({activityType: 'DAILY_VOCAB', topicId: 100,
            topicIds: [100, 200, 300], topics: [{topicId: 100, categoryId: 1}, {topicId: 200, categoryId: 2}, {topicId: 300, categoryId: 3}]}); }
    };
    const angular = {noop() {}, isArray: Array.isArray, isFunction: value => typeof value === 'function', copy: plain,
        forEach(items, callback) { (items || []).forEach(callback); }};
    const window = {localStorage, navigator: {onLine: true}};
    const context = nodeVm.createContext({vm, service, angular, window,
        toastr: {error(message) { warnings.push(message); }, info() {}, warning() {}},
        getCurrentUser() { return {id: 7}; }, dailySaveDestroyed: false, dailyCloudDrafts: {}, activeDailyRunId: null, activeDailyLastPersistAt: 0, dailyLazyNextPage: 2, dailyPreparedRawCount: 0, $rootScope: {$emit() {}}});
    const helpers = ['dailyAssignmentIdentity', 'dailyAssignmentSuffix', 'dailyDraftMatchesLaunch',
        'dailyDraftValue', 'validDailyPendingDraft', 'readDailyScopedDraft', 'dailyDraftTimestamp', 'loadDailyLearningDrafts', 'saveDailyLearningDraft', 'deleteDailyLearningDraft',
        'activeDailyDraftKey', 'removeActiveDailyDraft', 'readActiveDailyDraft', 'dailyDraftKey', 'removeDailyDraft',
        'removeActiveDailyDraftForPending', 'dailyAssignmentContextMatches', 'persistDailyDraft', 'restoreDailyDraft', 'appendAssignmentTopicEvidence', 'dailySaveFailureMessage', 'handleDailySaveFailure', 'loadDailyAssignment'];
    for (const helper of helpers) { nodeVm.runInContext(functionSource(daily, 'function ' + helper + '('), context); }
    return {context, vm, service, localStorage, writes, deletions, warnings};
}
function active(topicId, extra = {}) {
    return {version: 1, ownerId: 7, savedAt: 1000, assignmentTaskId: 55, assignmentTopicId: topicId,
        assignmentCategoryId: 2, topicIds: [topicId], questions: [{id: topicId + 1}], counter: 400, ...extra};
}
function pending(topicId) {
    return {version: 1, ownerId: 7, createdAt: 1000, assignmentTaskId: 55, assignmentTopicId: topicId,
        payload: {testType: 1, assignmentTaskId: 55, assignmentTopicId: topicId, topicIds: [topicId],
            clientAttemptKey: 'a'.repeat(32), totalWord: 4, user: {id: 7}}};
}

test('opening the second child validates its membership and keeps its own category', async () => {
    const h = dailySetup();
    await h.context.loadDailyAssignment();
    assert.equal(h.vm.assignmentLaunch.topicId, 200);
    assert.equal(h.vm.assignmentLaunch.categoryId, 2);
    assert.equal(h.vm.assignmentLaunch.invalid, undefined);
});

test('foreign child topic is rejected instead of silently opening the first assigned topic', async () => {
    const h = dailySetup(999);
    await h.context.loadDailyAssignment();
    assert.equal(h.vm.assignmentLaunch.invalid, true);
    assert.equal(h.vm.assignmentLaunch.topicId, 999);
    assert.equal(h.warnings.length, 1);
});

test('legacy single-topic links and links without a child keep working', async () => {
    const h = dailySetup(null);
    h.service.getAssignedTask = () => Promise.resolve({activityType: 'DAILY_VOCAB', topicId: 100, categoryId: 1});
    await h.context.loadDailyAssignment();
    assert.equal(h.vm.assignmentLaunch.topicId, 100);
    assert.equal(h.vm.assignmentLaunch.categoryId, 1, 'the assigned topic supplies its authoritative category');
    assert.equal(h.vm.assignmentLaunch.invalid, undefined);
});

test('active drafts use task and child topic identity without replacing sibling or free practice drafts', () => {
    const h = dailySetup();
    const first = 'daily-vocab-active:v1:7:task:55:topic:100';
    const second = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(first, JSON.stringify(active(100)));
    h.localStorage.setItem(second, JSON.stringify(active(200)));
    h.localStorage.setItem('daily-vocab-active:v1:7', JSON.stringify(active(999, {assignmentTaskId: null, assignmentTopicId: null})));
    assert.equal(h.context.activeDailyDraftKey(7), second);
    assert.equal(h.context.readActiveDailyDraft().assignmentTopicId, 200);
    h.context.removeActiveDailyDraft(7);
    assert.equal(h.localStorage.getItem(second), null);
    assert.ok(h.localStorage.getItem(first));
    assert.ok(h.localStorage.getItem('daily-vocab-active:v1:7'));
    assert.deepEqual(h.deletions, [second]);
});

test('legacy draft migrates only when it belongs to the selected child', () => {
    const h = dailySetup();
    const legacy = 'daily-vocab-active:v1:7';
    h.localStorage.setItem(legacy, JSON.stringify(active(100)));
    assert.equal(h.context.readActiveDailyDraft(), null);
    assert.equal(h.deletions.length, 0);
    h.localStorage.setItem(legacy, JSON.stringify(active(200)));
    assert.equal(h.context.readActiveDailyDraft().assignmentTopicId, 200);
    assert.equal(h.localStorage.getItem(legacy), null);
    assert.ok(h.localStorage.getItem('daily-vocab-active:v1:7:task:55:topic:200'));
    assert.equal(h.writes[0].draftType, 'DAILY_VOCAB');
});

test('pending result restore and cleanup use the selected topic while a sibling retry stays intact', () => {
    const h = dailySetup();
    const first = 'daily-vocab-pending:v1:7:task:55:topic:100';
    const second = 'daily-vocab-pending:v1:7:task:55:topic:200';
    h.localStorage.setItem(first, JSON.stringify(pending(100)));
    h.localStorage.setItem(second, JSON.stringify(pending(200)));
    h.context.restoreDailyDraft();
    assert.equal(h.vm.dailyVocabPendingResult.payload.assignmentTopicId, 200);
    assert.equal(h.vm.dailySaveStatus, 'pending');
    h.context.persistDailyDraft();
    assert.equal(h.writes.at(-1).draftKey, second + ':attempt:' + 'a'.repeat(32));
    h.context.removeDailyDraft(7, h.vm.dailyVocabPendingResult);
    assert.equal(h.localStorage.getItem(second), null);
    assert.ok(h.localStorage.getItem(first));
});

test('queued retry sends its original child topic even after the visible route changes', async () => {
    const h = dailySetup(100);
    const draft = pending(200);
    delete draft.payload.assignmentTopicId;
    h.vm.dailyVocabPendingResult = draft;
    const requests = [];
    h.service.saveDailyVocabResult = value => { requests.push(plain(value)); return Promise.resolve({id: 80, resultStatus: 'PASSED', assignmentTaskId: 55, assignmentTopicId: 200}); };
    nodeVm.runInContext(functionSource(daily, 'vm.saveTestResult = function ('), h.context);
    h.vm.saveTestResult();
    await tick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].assignmentTaskId, 55);
    assert.equal(requests[0].assignmentTopicId, 200);
    assert.deepEqual(requests[0].topicIds, [200]);
    assert.equal(h.vm.dailySaveStatus, 'saved');
    assert.match(h.deletions.at(-1), /:task:55:topic:200:attempt:[a-f0-9]{32}$/);
});

test('dashboard gives siblings distinct keys, exact progress and routes the clicked child', () => {
    const routes = [];
    const context = nodeVm.createContext({vm: {}, angular: {isArray: Array.isArray}, $state: {go(name, params) { routes.push({name, params}); }}});
    for (const name of ['assignmentKey', 'assignmentTopicComplete', 'assignmentProgressPercent', 'openAssignedTask']) {
        nodeVm.runInContext(functionSource(dashboard, 'vm.' + name + ' = function ('), context);
    }
    const first = {taskId: 55, topicId: 100, taskTotalTopics: 3, taskProgressPercent: 33, requiredAttempts: 1, completedAttempts: 1, activityType: 'DAILY_VOCAB'};
    const second = {...first, topicId: 200, completedAttempts: 0, categoryId: 2};
    assert.notEqual(context.vm.assignmentKey(first), context.vm.assignmentKey(second));
    assert.equal(context.vm.assignmentTopicComplete(first), true);
    assert.equal(context.vm.assignmentTopicComplete(second), false);
    assert.equal(context.vm.assignmentProgressPercent(first), 100);
    context.vm.openAssignedTask(first);
    context.vm.openAssignedTask(second);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].params.assignmentTopicId, 200);
    assert.equal(routes[0].params.assignmentTaskId, 55);
    assert.match(fs.readFileSync(path.join(app, 'dashboards/views/general-alt.html'), 'utf8'), /task\.taskProgressPercent/);
});

test('HTTP save failure keeps the same attempt and child draft for an accurate retry', async () => {
    const h = dailySetup();
    h.vm.dailyVocabPendingResult = pending(200);
    const key = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    h.localStorage.setItem(key, JSON.stringify(h.vm.dailyVocabPendingResult));
    h.service.saveDailyVocabResult = () => Promise.reject({status: 503});
    nodeVm.runInContext(functionSource(daily, 'vm.saveTestResult = function ('), h.context);
    h.vm.saveTestResult();
    await tick();
    assert.equal(h.vm.dailySaveStatus, 'pending');
    assert.equal(h.vm.isSaveTestResult, false);
    assert.equal(h.vm.savingTestResult, false);
    assert.ok(h.deletions.every(key => !key.startsWith('daily-vocab-pending:')));
    const stored = JSON.parse(h.localStorage.getItem(key));
    assert.equal(stored.payload.assignmentTopicId, 200);
    assert.equal(stored.payload.clientAttemptKey, 'a'.repeat(32));
});

test('a persisted failed result is reported as failed rather than completed successfully', async () => {
    const h = dailySetup();
    h.vm.dailyVocabPendingResult = pending(200);
    h.service.saveDailyVocabResult = () => Promise.resolve({id: 81, resultStatus: 'FAILED', assignmentTaskId: 55, assignmentTopicId: 200});
    nodeVm.runInContext(functionSource(daily, 'vm.saveTestResult = function ('), h.context);
    h.vm.saveTestResult();
    await tick();
    assert.equal(h.vm.dailySaveStatus, 'failed');
    assert.equal(h.vm.finishDailyVocab, 'Thất bại');
    assert.match(h.vm.dailySaveMessage, /chưa được tính hoàn thành/);
});


test('a positive result ID from another child never confirms or clears the frozen pending attempt', async () => {
    const h = dailySetup();
    h.vm.dailyVocabPendingResult = pending(200);
    const key = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    h.service.saveDailyVocabResult = () => Promise.resolve({id: 82, assignmentTaskId: 55, assignmentTopicId: 100});
    nodeVm.runInContext(functionSource(daily, 'vm.saveTestResult = function ('), h.context);
    h.vm.saveTestResult();
    await tick();
    assert.equal(h.vm.dailySaveStatus, 'pending');
    assert.equal(h.vm.isSaveTestResult, false);
    assert.ok(h.localStorage.getItem(key));
    assert.ok(h.deletions.every(key => !key.startsWith('daily-vocab-pending:')));
    assert.match(h.vm.dailySaveMessage, /chưa xác nhận đúng bài và topic/);
});

test('legacy acknowledgement needs authoritative single-topic metadata and persisted topic evidence', () => {
    const h = dailySetup(200);
    const original = pending(200);
    const response = {id: 83, assignmentTaskId: 55, topics: [{id: 200}]};
    assert.equal(h.context.dailyAssignmentContextMatches(response, original), false, 'unverified URL is insufficient');
    h.vm.assignmentLaunch.verified = true;
    h.vm.assignmentLaunch.topicIds = [100, 200];
    assert.equal(h.context.dailyAssignmentContextMatches(response, original), false, 'multi-topic task requires explicit child identity');
    h.vm.assignmentLaunch.topicIds = [200];
    assert.equal(h.context.dailyAssignmentContextMatches(response, original), true);
    assert.equal(h.context.dailyAssignmentContextMatches({...response, topics: [{id: 100}]}, original), false);
    assert.equal(h.context.dailyAssignmentContextMatches({...response, assignmentTaskId: 999}, original), false);
    assert.equal(h.context.dailyAssignmentContextMatches({...response, assignmentTopicId: 100}, original), false);
});

test('failed local and cloud queue writes preserve the active draft until an exact server draft acknowledgement', async () => {
    const h = dailySetup();
    h.vm.dailyVocabPendingResult = pending(200);
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(activeKey, JSON.stringify(active(200)));
    const originalSet = h.localStorage.setItem;
    h.localStorage.setItem = (key, value) => { if (key.startsWith('daily-vocab-pending:')) { throw Error('Quota exceeded'); } originalSet(key, value); };
    h.service.saveLearningDraft = () => Promise.reject(Error('Offline'));
    assert.equal(h.context.persistDailyDraft(), false);
    await tick();
    assert.ok(h.localStorage.getItem(activeKey));
    assert.equal(h.deletions.length, 0);
    assert.match(h.vm.dailySaveStorageNotice, /không giữ được bản tạm/);
    h.service.saveLearningDraft = dto => Promise.resolve({...dto, id: 70});
    h.context.persistDailyDraft();
    await tick();
    assert.equal(h.localStorage.getItem(activeKey), null);
    assert.equal(h.vm.dailySaveStorageNotice, '');
});

test('an acknowledgement for a different queued attempt cannot remove the active draft', async () => {
    const h = dailySetup();
    h.vm.dailyVocabPendingResult = pending(200);
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(activeKey, JSON.stringify(active(200)));
    h.localStorage.setItem = () => { throw Error('Quota exceeded'); };
    h.service.saveLearningDraft = dto => { const other = pending(200); other.payload.clientAttemptKey = 'b'.repeat(32); return Promise.resolve({...dto, id: 71, payload: JSON.stringify(other)}); };
    h.context.persistDailyDraft();
    await tick();
    assert.ok(h.localStorage.getItem(activeKey));
    assert.equal(h.deletions.length, 0);
});

test('finishing without a cryptographic attempt key leaves the active draft available', () => {
    const h = dailySetup();
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(activeKey, JSON.stringify(active(200)));
    Object.assign(h.vm, {dailyVocabRunning: true, currentPosition: 3, totalCard: 4, score1: 0, wrongPlayer1: 0, dailyVocabCounter: 400, dailyVocabDuration: 900,
        title: 'Education', prepareResultTopicEvidence() {}, stopDailyVocabTimer() { h.vm.dailyVocabRunning = false; }});
    h.context.syncDailyVocabCountdown = () => {};
    h.context.runningManFinishWin = () => {};
    h.context.speakEnglish = () => {};
    nodeVm.runInContext(functionSource(daily, 'vm.saveTestResult = function ('), h.context);
    nodeVm.runInContext(functionSource(daily, 'function finishDailyVocabSuccessfully('), h.context);
    h.context.finishDailyVocabSuccessfully();
    assert.ok(h.localStorage.getItem(activeKey));
    assert.equal(h.deletions.length, 0);
    assert.equal(h.vm.dailySaveStatus, 'pending');
    assert.match(h.vm.dailySaveMessage, /Không tạo được mã lượt làm/);
});


test('cloud-only pending results restore in memory even when browser reads and writes are blocked', async () => {
    const h = dailySetup();
    const draft = pending(200);
    const key = h.context.dailyDraftKey(7, draft);
    h.localStorage.getItem = () => { throw Error('Blocked'); };
    h.localStorage.setItem = () => { throw Error('Blocked'); };
    h.service.getLearningDrafts = () => Promise.resolve([{draftKey: key, draftType: 'DAILY_VOCAB_PENDING', savedAt: 2000, payload: JSON.stringify(draft)}]);
    await h.context.loadDailyLearningDrafts();
    h.context.restoreDailyDraft();
    assert.equal(h.vm.dailyVocabPendingResult.payload.clientAttemptKey, draft.payload.clientAttemptKey);
    assert.equal(h.vm.dailyVocabPendingResult.payload.assignmentTopicId, 200);
    assert.equal(h.vm.dailySaveStatus, 'pending');
});

test('an explicitly selected older pending attempt remains reachable beside a newer attempt', () => {
    const h = dailySetup();
    const older = pending(200), newer = pending(200);
    newer.createdAt = 3000;
    newer.payload.clientAttemptKey = 'b'.repeat(32);
    const oldKey = h.context.dailyDraftKey(7, older), newKey = h.context.dailyDraftKey(7, newer);
    h.localStorage.setItem(oldKey, JSON.stringify(older));
    h.localStorage.setItem(newKey, JSON.stringify(newer));
    const sessionStorage = storage([['daily-vocab-pending-resume:v1:7', oldKey]]);
    h.context.window.sessionStorage = sessionStorage;
    h.context.restoreDailyDraft();
    assert.equal(h.vm.dailyVocabPendingResult.payload.clientAttemptKey, older.payload.clientAttemptKey);
    assert.ok(h.localStorage.getItem(newKey));
});

test('a late pending cloud acknowledgement cannot delete a newer run or a destroyed controller draft', async () => {
    for (const replacePending of [true, false]) {
        const h = dailySetup();
        const older = pending(200); older.activeRunId = 'run-a';
        h.vm.dailyVocabPendingResult = older;
        const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200';
        h.localStorage.setItem(activeKey, JSON.stringify(active(200, {runId: replacePending ? 'run-b' : 'run-a'})));
        h.localStorage.setItem = () => { throw Error('Blocked'); };
        let acknowledge;
        h.service.saveLearningDraft = dto => new Promise(resolve => { acknowledge = () => resolve({...dto, id: 90}); });
        h.context.persistDailyDraft();
        if (replacePending) { h.vm.dailyVocabPendingResult = {...pending(200), activeRunId: 'run-b'}; }
        else { h.context.dailySaveDestroyed = true; }
        acknowledge();
        await tick();
        assert.ok(h.localStorage.getItem(activeKey));
        assert.equal(h.deletions.length, 0);
    }
});

test('restoring stale pending A preserves newer active B even before the controller has a current run', () => {
    const h = dailySetup();
    const older = pending(200); older.activeRunId = 'run-a';
    const oldKey = h.context.dailyDraftKey(7, older);
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(oldKey, JSON.stringify(older));
    h.localStorage.setItem(activeKey, JSON.stringify(active(200, {savedAt: 3000, runId: 'run-b'})));
    h.context.restoreDailyDraft();
    assert.equal(h.vm.dailyVocabPendingResult.activeRunId, 'run-a');
    assert.equal(JSON.parse(h.localStorage.getItem(activeKey)).runId, 'run-b');
    assert.equal(h.deletions.length, 0);
});

test('late cloud writes and deletes for A cannot overwrite or remove B active or pending backups', async () => {
    const h = dailySetup();
    const cloud = new Map(), delayed = [];
    h.service.saveLearningDraft = dto => new Promise(resolve => { delayed.push(() => { cloud.set(dto.draftKey, dto.payload); resolve({...dto, id: 91}); }); });
    h.service.deleteLearningDraft = key => { h.deletions.push(key); cloud.delete(key); return Promise.resolve(true); };
    h.context.syncDailyVocabCountdown = () => {};
    nodeVm.runInContext(functionSource(daily, 'function persistActiveDailySession('), h.context);
    Object.assign(h.vm, {dailyVocabRunning: true, dailyVocabCounter: 400, questions: [{id: 1}], currentCard: {id: 1},
        selectedTopicToSearch: [{id: 200}], searchTopicDto: {topicCategory: {id: 2}}});
    h.localStorage.setItem = () => { throw Error('Blocked'); };
    h.context.activeDailyRunId = 'run-a';
    h.context.persistActiveDailySession(true);
    const a = pending(200); a.activeRunId = 'run-a';
    h.vm.dailyVocabPendingResult = a;
    h.context.persistDailyDraft();
    h.context.activeDailyRunId = 'run-b';
    h.context.persistActiveDailySession(true);
    const b = pending(200); b.activeRunId = 'run-b'; b.payload.clientAttemptKey = 'b'.repeat(32);
    h.vm.dailyVocabPendingResult = b;
    h.context.persistDailyDraft();
    delayed[2](); delayed[3]();
    await tick();
    const bActiveKey = 'daily-vocab-active:v1:7:task:55:topic:200:run:run-b';
    const bPendingKey = h.context.dailyDraftKey(7, b);
    // Pending B is durable, so B's matching active backup may be removed; create an independent newer active C.
    h.context.activeDailyRunId = 'run-c';
    h.context.persistActiveDailySession(true);
    delayed[4](); await tick();
    const cActiveKey = 'daily-vocab-active:v1:7:task:55:topic:200:run:run-c';
    delayed[0](); delayed[1](); await tick();
    assert.ok(cloud.has(cActiveKey));
    assert.ok(cloud.has(bPendingKey));
    h.context.removeDailyDraft(7, a);
    h.context.removeActiveDailyDraftForPending(a);
    assert.ok(cloud.has(cActiveKey));
    assert.ok(cloud.has(bPendingKey));
    assert.ok(h.deletions.every(key => key !== cActiveKey && key !== bPendingKey));
    assert.notEqual(h.context.dailyDraftKey(7, a), bPendingKey);
    assert.notEqual('daily-vocab-active:v1:7:task:55:topic:200:run:run-a', bActiveKey);
});


async function reminderSetup(items, localOnly = []) {
    let Dashboard, petFactory;
    const angular = {module() { return {controller(name, value) { Dashboard = value; }, directive(name, value) { petFactory = value; }}; },
        noop() {}, isArray: Array.isArray, fromJson: JSON.parse, toJson: JSON.stringify, copy: plain,
        forEach(items, callback) { (items || []).forEach(callback); }};
    const context = nodeVm.createContext({angular, window: {APP_VERSION: 'multi-vocab-test'}});
    nodeVm.runInContext(dashboard, context);
    nodeVm.runInContext(fs.readFileSync(path.join(app, 'common/utils/learning-pet.directive.js'), 'utf8'), context);
    const user = {id: 7, roles: [{name: 'ROLE_STUDENT'}]};
    const localStorage = storage(items.concat(localOnly).map(item => [item.draftKey, item.payload]));
    const sessionStorage = storage();
    const root = {settings: {layout: {}}, $on() { return () => {}; }, $broadcast() {}, $emit() {}};
    const scope = () => ({$on() { return () => {}; }, $evalAsync() {}});
    const window = {localStorage, sessionStorage, addEventListener() {}, removeEventListener() {}, confirm() { return true; }};
    const settings = {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}};
    const cloud = plain(items), draftWrites = [];
    const http = {get(url) { return Promise.resolve({data: plain(url.endsWith('test_result/drafts') ? cloud : [])}); },
        post(url, dto) {
            draftWrites.push({url, dto: plain(dto)});
            const index = cloud.findIndex(item => item.draftKey === dto.draftKey);
            if (url.endsWith('draft/delete')) { if (index >= 0) { cloud.splice(index, 1); } }
            else if (url.endsWith('draft/save')) { if (index >= 0) { cloud[index] = plain(dto); } else { cloud.push(plain(dto)); } }
            return Promise.resolve({data: true});
        }};
    const routes = [], state = {current: {name: 'application.dashboard'}, go(name, params) { routes.push({name, params: plain(params)}); }};
    const timer = () => 1; timer.cancel = () => {};
    const dash = new Dashboard(root, scope(), http, timer, settings, {}, {get() { return null; }}, {protocol() { return 'https'; }}, window, state);
    dash.myUser = {id: 7}; dash.loadResumeDrafts();
    const definition = petFactory(http, {all: Promise.all.bind(Promise), when: Promise.resolve.bind(Promise)}, state,
        timer, timer, window, {get() { return JSON.stringify(user); }}, root, settings);
    const pet = {}; definition.controller.call(pet, scope());
    await pet.refresh(); await tick();
    return {dashboard: dash, pet, localStorage, sessionStorage, routes, cloud, draftWrites};
}
function draftItem(kind, key, payload) {
    return {draftType: kind, draftKey: key, savedAt: payload.savedAt || payload.createdAt, payload: JSON.stringify(payload)};
}

test('matching active and pending reminders collapse into a clear save action after the parent leaves the assignment list', async () => {
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200:run:run-a';
    const pendingKey = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    const result = {...pending(200), activeRunId: 'run-a'};
    const h = await reminderSetup([draftItem('DAILY_VOCAB', activeKey, active(200, {runId: 'run-a'})), draftItem('DAILY_VOCAB_PENDING', pendingKey, result)]);
    assert.equal(h.dashboard.assignedTasks.length, 0);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
    assert.equal(h.dashboard.resumeDrafts[0].pendingSave, true);
    assert.equal(h.pet.drafts[0].pendingSave, true);
    assert.match(h.pet.message, /chưa nhận xác nhận lưu/);
    h.dashboard.resumeDraft(h.dashboard.resumeDrafts[0]);
    assert.equal(h.sessionStorage.getItem('daily-vocab-pending-resume:v1:7'), pendingKey);
    assert.equal(h.routes.at(-1).params.assignmentTaskId, 55);
    assert.equal(h.routes.at(-1).params.assignmentTopicId, 200);
    h.pet.resumeDraft(h.pet.drafts[0]);
    assert.equal(h.routes.at(-1).params.assignmentTopicId, 200);
});

test('old pending A and newer active B stay separately reachable rather than deleting or hiding B', async () => {
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200:run:run-b';
    const pendingKey = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    const h = await reminderSetup([draftItem('DAILY_VOCAB_PENDING', pendingKey, {...pending(200), activeRunId: 'run-a'}),
        draftItem('DAILY_VOCAB', activeKey, active(200, {runId: 'run-b', savedAt: 3000}))]);
    assert.equal(h.dashboard.resumeDrafts.length, 2);
    assert.equal(h.pet.drafts.length, 2);
    const newer = h.dashboard.resumeDrafts.find(draft => !draft.pendingSave);
    assert.equal(newer.vocabRunId, 'run-b');
    h.dashboard.resumeDraft(newer);
    assert.equal(h.sessionStorage.getItem('daily-vocab-dashboard-resume:v1:7'), 'daily-vocab-active:v1:7:task:55:topic:200');
    assert.equal(h.sessionStorage.getItem('daily-vocab-pending-resume:v1:7'), null);
    assert.ok(h.localStorage.getItem(activeKey));
});

test('local-only pending result is visible in the pet even when its cloud draft upload failed', async () => {
    const activeKey = 'daily-vocab-active:v1:7:task:55:topic:200:run:run-a';
    const pendingKey = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    const h = await reminderSetup([draftItem('DAILY_VOCAB', activeKey, active(200, {runId: 'run-a'}))],
        [draftItem('DAILY_VOCAB_PENDING', pendingKey, {...pending(200), activeRunId: 'run-a'})]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
    assert.equal(h.pet.drafts[0].storageKey, pendingKey);
    assert.equal(h.pet.drafts[0].pendingSave, true);
});

test('multiple pending attempts keep distinct reminders and the selected retry identity', async () => {
    const a = pending(200), b = pending(200); b.payload.clientAttemptKey = 'b'.repeat(32); b.createdAt = 3000;
    const first = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'a'.repeat(32);
    const second = 'daily-vocab-pending:v1:7:task:55:topic:200:attempt:' + 'b'.repeat(32);
    const h = await reminderSetup([draftItem('DAILY_VOCAB_PENDING', first, a), draftItem('DAILY_VOCAB_PENDING', second, b)]);
    assert.equal(h.dashboard.resumeDrafts.length, 2);
    assert.equal(h.pet.drafts.length, 2);
    h.pet.resumeDraft(h.pet.drafts.find(draft => draft.storageKey === first));
    assert.equal(h.sessionStorage.getItem('daily-vocab-pending-resume:v1:7'), first);
});

test('cloud active backups for one child show only its latest run', async () => {
    const base = 'daily-vocab-active:v1:7:task:55:topic:200:run:';
    const h = await reminderSetup([draftItem('DAILY_VOCAB', base + 'run-a', active(200, {runId: 'run-a'})),
        draftItem('DAILY_VOCAB', base + 'run-b', active(200, {runId: 'run-b', savedAt: 3000}))]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
    assert.equal(h.dashboard.resumeDrafts[0].vocabRunId, 'run-b');
    assert.equal(h.pet.drafts[0].vocabRunId, 'run-b');
});


test('local quota fallback keeps full cloud questions, real totals, and full runtime restore', () => {
    const h = dailySetup();
    const questions = Array.from({length: 12}, (_, index) => ({id: index + 1}));
    Object.assign(h.vm, {dailyVocabRunning: true, dailyVocabCounter: 400, questions, rawQuestions: questions, currentCard: questions[4],
        currentPosition: 4, totalCard: 12, loadedCardCount: 12, allQuestionsLoaded: true,
        selectedTopicToSearch: [{id: 200}], searchTopicDto: {topicCategory: {id: 2}}});
    h.context.activeDailyRunId = 'quota-run'; h.context.syncDailyVocabCountdown = () => {};
    const originalSet = h.localStorage.setItem;
    h.localStorage.setItem = (key, value) => { if (JSON.parse(value).questions.length > 1) { throw Error('Quota exceeded'); } originalSet(key, value); };
    nodeVm.runInContext(functionSource(daily, 'function persistActiveDailySession('), h.context);
    h.context.persistActiveDailySession(true);
    const cloud = JSON.parse(h.writes[0].payload);
    assert.equal(cloud.questions.length, 12);
    assert.equal(cloud.rawQuestions.length, 12);
    assert.equal(cloud.totalCard, 12);
    assert.equal(cloud.currentPosition, 4);
    assert.equal(cloud.allQuestionsLoaded, true);
    const local = JSON.parse(h.localStorage.getItem('daily-vocab-active:v1:7:task:55:topic:200'));
    assert.equal(local.questions.length, 1);
    assert.equal(local.totalCard, 12);
    assert.equal(local.allQuestionsLoaded, false);
    assert.equal(local.localFallback, true);
    const restored = h.context.readActiveDailyDraft();
    assert.equal(restored.questions.length, 12, 'full matching memory/cloud copy wins over compact local fallback');
    assert.equal(restored.currentPosition, 4);
});

test('compact-only local recovery is retained but cannot grade one card as the complete exercise', () => {
    const h = dailySetup();
    const key = 'daily-vocab-active:v1:7:task:55:topic:200';
    h.localStorage.setItem(key, JSON.stringify(active(200, {localFallback: true, totalCard: 12, allQuestionsLoaded: false})));
    assert.equal(h.context.readActiveDailyDraft(), null);
    assert.equal(h.vm.dailyDraftRecoveryBlocked, true);
    nodeVm.runInContext(functionSource(daily, 'vm.canBeginDailyVocabRun = function ('), h.context);
    assert.equal(h.vm.canBeginDailyVocabRun(), false);
    assert.ok(h.localStorage.getItem(key));
    assert.equal(h.deletions.length, 0);
});


function ieltsDraft(attemptKey, status, savedAt = '2026-10-19T00:00:01Z') {
    const payload = {clientAttemptKey: attemptKey, user: {id: 7}, testType: 7, sourceQuestionId: 8123, assignmentTaskId: 238, completedParts: [1]};
    const draft = {version: 5, userId: 7, testId: 8123, testMode: 'WRITING', sessionMode: 'SERIOUS', assignmentTaskId: 238,
        assignmentPart: 1, assignmentParts: [1], isPartAssignment: true, title: 'Annual Travel Distance', clientAttemptKey: attemptKey,
        savedAt, answeredCount: 1, totalQuestions: 1, remainingSeconds: 0};
    if (status) { draft.submissionState = {status, key: attemptKey, payload}; }
    if (status === 'SAVED') { draft.submissionState.result = {...payload, id: 9001, resultStatus: 'FAILED'}; }
    return draft;
}
const ieltsBase = 'ieltsReadingInProgress:7:writing:test:8123:serious:task:238:parts:1';

test('confirmed FAILED IELTS receipt is not unfinished and base/cloud copies of new active B show one reminder', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32);
    const receipt = ieltsDraft(a, 'SAVED'), active = ieltsDraft(b, null, '2026-10-19T00:00:02Z');
    const h = await reminderSetup([draftItem('IELTS', ieltsBase + ':attempt:' + a, receipt), draftItem('IELTS', ieltsBase + ':attempt:' + b, active)],
        [draftItem('IELTS', ieltsBase, active)]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
    assert.equal(h.dashboard.resumeDrafts[0].ieltsAttemptKey, b);
    assert.equal(h.pet.drafts[0].ieltsAttemptKey, b);
});

test('IELTS pending A and active B stay distinct and each sends an exact validated-route resume marker', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32);
    const pending = ieltsDraft(a, 'PENDING'), active = ieltsDraft(b, null, '2026-10-19T00:00:02Z');
    const aKey = ieltsBase + ':attempt:' + a, bKey = ieltsBase + ':attempt:' + b;
    const h = await reminderSetup([draftItem('IELTS', aKey, pending), draftItem('IELTS', bKey, active)], [draftItem('IELTS', ieltsBase, active)]);
    assert.equal(h.dashboard.resumeDrafts.length, 2);
    assert.equal(h.pet.drafts.length, 2);
    h.dashboard.resumeDraft(h.dashboard.resumeDrafts.find(draft => draft.ieltsAttemptKey === a));
    const marker = JSON.parse(h.sessionStorage.getItem('ielts-draft-resume:v1:7'));
    assert.deepEqual(marker, {draftKey: aKey, clientAttemptKey: a, testId: 8123, assignmentTaskId: 238, assignmentParts: [1], sessionMode: 'SERIOUS'});
    assert.equal(h.routes.at(-1).name, 'application.ielts_writing_actual_test');
    assert.equal(h.routes.at(-1).params.assignmentTaskId, 238);
    assert.equal(h.routes.at(-1).params.assignmentParts, '1');
    h.pet.resumeDraft(h.pet.drafts.find(draft => draft.ieltsAttemptKey === b));
    assert.equal(JSON.parse(h.sessionStorage.getItem('ielts-draft-resume:v1:7')).clientAttemptKey, b);
    assert.equal(JSON.parse(h.localStorage.getItem(ieltsBase)).clientAttemptKey, b);
});

test('two distinct pending IELTS attempts remain reachable while their own base copies deduplicate', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32);
    const first = ieltsDraft(a, 'PENDING'), second = ieltsDraft(b, 'PENDING', '2026-10-19T00:00:02Z');
    const h = await reminderSetup([draftItem('IELTS', ieltsBase + ':attempt:' + a, first), draftItem('IELTS', ieltsBase + ':attempt:' + b, second)],
        [draftItem('IELTS', ieltsBase, second)]);
    assert.equal(h.dashboard.resumeDrafts.length, 2);
    assert.equal(h.pet.drafts.length, 2);
    assert.ok(h.dashboard.resumeDrafts.every(draft => draft.pendingSave));
    h.pet.resumeDraft(h.pet.drafts.find(draft => draft.ieltsAttemptKey === a));
    assert.equal(JSON.parse(h.sessionStorage.getItem('ielts-draft-resume:v1:7')).draftKey, ieltsBase + ':attempt:' + a);
});

test('a corrupt saved IELTS receipt is retained rather than filtered using its positive ID alone', async () => {
    const a = 'a'.repeat(32), draft = ieltsDraft(a, 'SAVED');
    delete draft.submissionState.result.user;
    const h = await reminderSetup([draftItem('IELTS', ieltsBase + ':attempt:' + a, draft)]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
});

test('a legacy saved IELTS receipt without echoed key is filtered only when full saved context matches', async () => {
    const a = 'a'.repeat(32), draft = ieltsDraft(a, 'SAVED');
    delete draft.submissionState.result.clientAttemptKey;
    const h = await reminderSetup([draftItem('IELTS', ieltsBase + ':attempt:' + a, draft)]);
    assert.equal(h.dashboard.resumeDrafts.length, 0);
    assert.equal(h.pet.drafts.length, 0);
});

test('canceling pending IELTS A removes its cloud/local copies and preserves different active B', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32);
    const pending = ieltsDraft(a, 'PENDING'), active = ieltsDraft(b, null, '2026-10-19T00:00:02Z');
    const aKey = ieltsBase + ':attempt:' + a, bKey = ieltsBase + ':attempt:' + b;
    const h = await reminderSetup([draftItem('IELTS', aKey, pending), draftItem('IELTS', bKey, active)], [draftItem('IELTS', ieltsBase, active)]);
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts.find(draft => draft.ieltsAttemptKey === a)); await tick();
    assert.ok(h.localStorage.getItem(ieltsBase));
    assert.equal(JSON.parse(h.localStorage.getItem(ieltsBase)).clientAttemptKey, b);
    assert.ok(h.cloud.some(item => item.draftKey === bKey));
    assert.ok(!h.cloud.some(item => item.draftKey === aKey));
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.dashboard.resumeDrafts[0].ieltsAttemptKey, b);
});

test('canceling active IELTS B also removes its matching base copy so the same reminder cannot reappear', async () => {
    const b = 'b'.repeat(32), active = ieltsDraft(b, null);
    const bKey = ieltsBase + ':attempt:' + b;
    const h = await reminderSetup([draftItem('IELTS', bKey, active)], [draftItem('IELTS', ieltsBase, active)]);
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]); await tick();
    assert.equal(h.localStorage.getItem(ieltsBase), null);
    assert.equal(h.localStorage.getItem(bKey), null);
    assert.equal(h.dashboard.resumeDrafts.length, 0);
});


test('saved legacy Listening through a Reading route is verified against its persisted type rather than shown unfinished', async () => {
    const a = 'a'.repeat(32), draft = ieltsDraft(a, 'SAVED');
    draft.testMode = 'READING'; draft.isListening = false;
    draft.submissionState.payload.testType = 2; draft.submissionState.result.testType = 2;
    const base = ieltsBase.replace(':writing:', ':reading:');
    const h = await reminderSetup([draftItem('IELTS', base + ':attempt:' + a, draft)]);
    assert.equal(h.dashboard.resumeDrafts.length, 0);
    assert.equal(h.pet.drafts.length, 0);
});


function studyReadingDraft(attempt, status, savedAt) {
    const value=ieltsDraft(attempt,status,savedAt);value.testMode='READING';value.sessionMode='STUDY';value.assignmentTaskId=null;
    if(value.submissionState){value.submissionState.payload.testType=4;value.submissionState.payload.assignmentTaskId=null;}
    return value;
}
const studyReadingBase='ieltsReadingInProgress:7:reading:test:8123:study';
test('hiding pending Study A keeps its frozen submission and leaves newer active B visible', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), first = studyReadingDraft(a, 'PENDING'), active = studyReadingDraft(b, null, '2026-10-19T00:00:02Z');
    const base = studyReadingBase, aKey = base + ':attempt:' + a, bKey = base + ':attempt:' + b;
    const h = await reminderSetup([draftItem('IELTS', aKey, first), draftItem('IELTS', bKey, active)], [draftItem('IELTS', base, active)]);
    h.dashboard.hideDraft(h.dashboard.resumeDrafts.find(draft => draft.ieltsAttemptKey === a)); await tick();
    assert.equal(JSON.parse(h.localStorage.getItem(base)).clientAttemptKey, b);
    assert.notEqual(JSON.parse(h.localStorage.getItem(base)).hiddenFromDashboard, true);
    const hidden = JSON.parse(h.cloud.find(item => item.draftKey === aKey).payload);
    assert.equal(hidden.hiddenFromDashboard, true);
    assert.equal(hidden.submissionState.payload.clientAttemptKey, a);
    assert.equal(hidden.submissionState.status, 'PENDING');
    h.dashboard.loadResumeDrafts(); await h.pet.refresh(); await tick();
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.drafts.length, 1);
    assert.equal(h.dashboard.resumeDrafts[0].ieltsAttemptKey, b);
});


test('stale hide card A reads its matching per-attempt payload after the base slot has become B', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), first = studyReadingDraft(a, 'PENDING'), active = studyReadingDraft(b, null, '2026-10-19T00:00:02Z');
    const base = studyReadingBase, aKey = base + ':attempt:' + a, bKey = base + ':attempt:' + b;
    const h = await reminderSetup([draftItem('IELTS', aKey, first)], [draftItem('IELTS', base, first)]);
    const stale = {...h.dashboard.resumeDrafts[0], storageKey: base};
    h.localStorage.setItem(base, JSON.stringify(active)); h.localStorage.setItem(bKey, JSON.stringify(active));
    h.cloud.push(draftItem('IELTS', bKey, active));
    h.dashboard.hideDraft(stale); await tick();
    const savedA = JSON.parse(h.cloud.find(item => item.draftKey === aKey).payload);
    assert.equal(savedA.clientAttemptKey, a);
    assert.equal(savedA.submissionState.payload.clientAttemptKey, a);
    assert.equal(savedA.hiddenFromDashboard, true);
    assert.equal(JSON.parse(h.localStorage.getItem(base)).clientAttemptKey, b);
    assert.notEqual(JSON.parse(h.localStorage.getItem(base)).hiddenFromDashboard, true);
    assert.equal(JSON.parse(h.cloud.find(item => item.draftKey === bKey).payload).clientAttemptKey, b);
});

test('stale hide card A does nothing when only another attempt B remains in its old base slot', async () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), first = studyReadingDraft(a, 'PENDING'), active = studyReadingDraft(b, null, '2026-10-19T00:00:02Z');
    const base = studyReadingBase;
    const h = await reminderSetup([], [draftItem('IELTS', base, first)]);
    const stale = h.dashboard.resumeDrafts[0];
    h.localStorage.setItem(base, JSON.stringify(active));
    h.dashboard.hideDraft(stale); await tick();
    assert.equal(h.draftWrites.length, 0);
    assert.equal(JSON.parse(h.localStorage.getItem(base)).clientAttemptKey, b);
    assert.notEqual(JSON.parse(h.localStorage.getItem(base)).hiddenFromDashboard, true);
});
