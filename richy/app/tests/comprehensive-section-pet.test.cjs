// Run with: node --test richy/app/tests/comprehensive-section-pet.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const clone = value => JSON.parse(JSON.stringify(value));
const attempt = 'a'.repeat(32);
const timer = () => 1;
timer.cancel = () => {};

function scope() {
    const handlers = new Map();
    return {
        $on(name, callback) {
            if (!handlers.has(name)) handlers.set(name, new Set());
            handlers.get(name).add(callback);
            return () => handlers.get(name).delete(callback);
        },
        $broadcast(name, data) { for (const callback of handlers.get(name) || []) callback({}, data); },
        $evalAsync() {}
    };
}

function sectionDraft(section = 'section-a', options = {}) {
    const data = {
        version: 5, userId: 7, testId: 42, testMode: 'COMPREHENSIVE', sessionMode: 'SERIOUS',
        assignmentTaskId: 88, assignmentPart: 1, assignmentParts: [1], isPartAssignment: true,
        assignmentSectionKey: section, sectionNumber: section === 'section-a' ? 1 : 2, sectionCount: 4,
        answeredCount: 12, totalQuestions: 50, clientAttemptKey: attempt,
        savedAt: '2026-10-29T10:00:00Z', ...options.data
    };
    const payload = {
        clientAttemptKey: attempt, user: {id: 7}, testType: 6, sourceQuestionId: 42,
        assignmentTaskId: 88, assignmentSectionKey: section, completedParts: [1], ...options.payload
    };
    if (options.status) {
        data.submissionState = {key: attempt, status: options.status, payload,
            result: {id: 9, ...payload, ...options.result}};
    }
    const key = 'ieltsReadingInProgress:7:comprehensive:test:42:serious:task:88:parts:1'
        + (section ? ':section:' + section : '') + (options.pendingKey ? ':attempt:' + attempt : '');
    return {draftType: 'IELTS', draftKey: key, title: '200-question test', payload: JSON.stringify(data)};
}

function task(section, extra = {}) {
    return {taskId: 88, ieltsTestId: 42, activityType: 'COMPREHENSIVE', assignmentSectionKey: section,
        sectionNumber: 1, sectionCount: 4, sectionQuestionCount: 50, requiredAttempts: 1,
        completedAttempts: 0, dueDate: '2026-12-31', ieltsPart: 1, ieltsParts: [1], ...extra};
}

async function setup(items = [], tasks = []) {
    let factory;
    const angular = {
        module() { return {directive(name, value) { factory = value; }}; },
        noop() {}, isArray: Array.isArray, fromJson: JSON.parse, toJson: JSON.stringify, copy: clone,
        forEach(values, callback) { (values || []).forEach(callback); }
    };
    const context = nodeVm.createContext({angular, window: {APP_VERSION: 'section-pet-test'}});
    nodeVm.runInContext(fs.readFileSync(path.join(__dirname, '../common/utils/learning-pet.directive.js'), 'utf8'), context);
    const storage = new Map(items.map(item => [item.draftKey, item.payload])), session = new Map(), routes = [];
    const window = {
        localStorage: {
            get length() { return storage.size; }, key(index) { return [...storage.keys()][index]; },
            getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        sessionStorage: {
            getItem(key) { return session.get(key) || null; }, setItem(key, value) { session.set(key, value); },
            removeItem(key) { session.delete(key); }
        },
        addEventListener() {}, removeEventListener() {}
    };
    const root = scope(), petScope = scope();
    root.settings = {layout: {}};
    const state = {current: {name: 'application.dashboard'}, go(name, params) { routes.push({name, params: clone(params)}); }};
    const http = {get(url) { return Promise.resolve({data: clone(url.endsWith('test_result/drafts') ? items : tasks)}); }};
    const user = {id: 7, vocabularyExperienceLevel: 0, roles: [{name: 'ROLE_STUDENT'}]};
    const definition = factory(http, {all: Promise.all.bind(Promise), when: Promise.resolve.bind(Promise)},
        state, timer, timer, window, {get() { return JSON.stringify(user); }}, root,
        {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}});
    const pet = {};
    definition.controller.call(pet, petScope);
    await pet.refresh();
    return {pet, root, routes, storage, session};
}

test('reminders retain each section while collapsing active and pending copies only within that section', async () => {
    const h = await setup([sectionDraft(), sectionDraft('section-a', {status: 'PENDING', pendingKey: true}),
        sectionDraft('section-b'), sectionDraft(null)]);
    assert.equal(h.pet.drafts.length, 3);
    assert.equal(h.pet.drafts.filter(item => item.assignmentSectionKey === 'section-a').length, 1);
    assert.equal(h.pet.drafts.find(item => item.assignmentSectionKey === 'section-a').pendingSave, true);
    assert.equal(h.pet.drafts.find(item => item.assignmentSectionKey === 'section-b').pendingSave, false);
    assert.equal(new Set(h.pet.drafts.map(item => item.ieltsContext)).size, 3);
    assert.equal(h.pet.notificationCount, 3);
});

test('a saved receipt must identify the exact section and cannot hide another section draft', async () => {
    const h = await setup([
        sectionDraft('section-a', {status: 'SAVED'}),
        sectionDraft('section-b', {status: 'SAVED', result: {assignmentSectionKey: 'section-a'}}),
        sectionDraft('section-c', {status: 'SAVED', payload: {assignmentSectionKey: 'section-a'}}),
        sectionDraft('section-d', {status: 'SAVED', data: {assignmentSectionKey: 'section-a'}}),
        sectionDraft(null, {status: 'SAVED', result: {assignmentSectionKey: 'section-a'}})
    ]);
    assert.equal(h.pet.drafts.length, 4);
    assert.equal(h.pet.drafts.some(item => item.assignmentSectionKey === 'section-a'), false);
    assert.ok(h.pet.drafts.some(item => item.assignmentSectionKey === 'section-b'));
    assert.ok(h.pet.drafts.some(item => item.assignmentSectionKey === 'section-c'));
    assert.ok(h.pet.drafts.some(item => item.assignmentSectionKey === 'section-d'));
    assert.ok(h.pet.drafts.some(item => item.assignmentSectionKey === null));
});

test('section resume carries section identity through the selected draft marker and runtime route', async () => {
    const h = await setup([sectionDraft('section-b', {data: {assignmentUntimed: true, elapsedSeconds: 4750}})]);
    const draft = h.pet.drafts[0];
    assert.equal(draft.assignmentUntimed, true);
    assert.match(draft.typeLabel, /Bài tập tổng hợp · Phần 2\/4/);
    assert.equal(draft.progressValue, '12/50 câu');
    h.pet.resumeDraft(draft);
    assert.equal(h.routes[0].name, 'application.comprehensive_actual_test');
    assert.equal(h.routes[0].params.assignmentSectionKey, 'section-b');
    assert.equal(h.routes[0].params.assignmentTaskId, 88);
    assert.equal(h.routes[0].params.sessionMode, 'SERIOUS');
    const marker = JSON.parse(h.session.get('ielts-draft-resume:v1:7'));
    assert.equal(marker.assignmentSectionKey, 'section-b');
    assert.equal(marker.draftKey, draft.storageKey);
    assert.deepEqual(marker.assignmentParts, [1]);
});

test('canonical storage key restores missing section metadata without admitting a mismatched confirmation', async () => {
    const item = sectionDraft('section-b', {data: {assignmentTaskId: null, assignmentSectionKey: null, testMode: null}});
    const h = await setup([item]);
    const draft = h.pet.drafts[0];
    assert.equal(draft.assignmentTaskId, 88);
    assert.equal(draft.assignmentSectionKey, 'section-b');
    assert.equal(draft.testMode, 'COMPREHENSIVE');
    h.pet.resumeDraft(draft);
    assert.equal(h.routes[0].params.assignmentSectionKey, 'section-b');
});

test('completed section cards leave sibling sections actionable with unique tracking and time labels', async () => {
    const completed = task('section-a', {completedAttempts: 1});
    const h = await setup([], [completed, task('section-b', {comprehensiveTimeLimitMinutes: 0}),
        task('section-c', {comprehensiveTimeLimitMinutes: 30}), task('section-d')]);
    assert.equal(h.pet.tasks.length, 3);
    assert.equal(h.pet.pendingTaskCount, 3);
    assert.equal(new Set(h.pet.tasks.map(h.pet.taskKey)).size, 3);
    assert.equal(h.pet.taskTimeLabel(h.pet.tasks[0]), 'Không tính giờ');
    assert.equal(h.pet.taskTimeLabel(h.pet.tasks[1]), '30 phút');
    assert.equal(h.pet.taskTimeLabel(h.pet.tasks[2]), 'Theo thời gian của đề');
    h.pet.openTask(completed);
    assert.equal(h.routes.length, 0);
    h.pet.openTask(h.pet.tasks[0]);
    assert.equal(h.routes[0].params.assignmentSectionKey, 'section-b');
    assert.equal(h.routes[0].params.assignmentParts, '1');
    const html = fs.readFileSync(path.join(__dirname, '../common/views/learning-pet.html'), 'utf8');
    assert.match(html, /track by pet\.taskKey\(task\)/);
    assert.match(html, /task\.sectionNumber/);
    assert.match(html, /pet\.taskTimeLabel\(task\)/);
});

test('dismissal of one section preserves sibling reminders and legacy resumes omit the section parameter', async () => {
    const first = sectionDraft('section-a'), h = await setup([first, sectionDraft('section-b'), sectionDraft(null)]);
    const siblingPayload = h.storage.get(h.pet.drafts.find(item => item.assignmentSectionKey === 'section-b').storageKey);
    h.root.$broadcast('learningDraftDismissed', {draftKey: first.draftKey, userId: 7});
    assert.equal(h.pet.drafts.length, 2);
    assert.equal(h.pet.notificationCount, 2);
    assert.equal(h.storage.get(sectionDraft('section-b').draftKey), siblingPayload);
    h.pet.resumeDraft(h.pet.drafts.find(item => item.assignmentSectionKey === null));
    assert.equal(Object.hasOwn(h.routes[0].params, 'assignmentSectionKey'), false);
    assert.equal(Object.hasOwn(JSON.parse(h.session.get('ielts-draft-resume:v1:7')), 'assignmentSectionKey'), false);
    h.pet.openTask(task(null));
    assert.equal(Object.hasOwn(h.routes[1].params, 'assignmentSectionKey'), false);
});
