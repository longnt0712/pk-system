// Run with: node --test richy/app/tests/learning-pet-draft-sync.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
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
        $broadcast(name, value) {
            for (const callback of handlers.get(name) || []) callback({name}, value);
        },
        $evalAsync() {},
        listeners(name) { return (handlers.get(name) || new Set()).size; }
    };
}

function draft(kind, id = 21) {
    const payload = kind === 'DAILY_LISTENING'
        ? {version: 1, ownerId: 7, modeId: 8, updatedAt: 1000, percentage: 0.17,
            card: {id, testFormat: 'DAILY_LISTENING', question: 'PHINEAS AND FERB S1E3'}}
        : {version: 5, userId: 7, testId: id, testMode: kind === 'IELTS_LISTENING' ? 'LISTENING' : 'READING',
            savedAt: '2026-10-01T10:00:00Z', answeredCount: 4, totalQuestions: 40};
    return {
        draftKey: kind === 'DAILY_LISTENING' ? 'daily-listening-progress:v1:7:' + id
            : 'ieltsReadingInProgress:7:' + kind.toLowerCase() + ':test:' + id,
        draftType: kind === 'DAILY_LISTENING' ? kind : 'IELTS',
        title: payload.card ? payload.card.question : 'IELTS ' + id,
        payload: JSON.stringify(payload), savedAt: 1000
    };
}

async function setup(items, options = {}) {
    let Dashboard, petFactory;
    const angular = {
        module() { return {controller(name, value) { Dashboard = value; }, directive(name, value) { petFactory = value; }}; },
        noop() {}, isArray: Array.isArray, fromJson: JSON.parse, toJson: JSON.stringify, copy: clone,
        forEach(items, callback) { (items || []).forEach(callback); }
    };
    const context = nodeVm.createContext({angular, window: {APP_VERSION: 'draft-sync-test'}});
    for (const file of ['dashboards/controllers/DashboardController.js', 'common/utils/learning-pet.directive.js']) {
        nodeVm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    const user = {id: 7, vocabularyExperienceLevel: 0, roles: [{name: 'ROLE_STUDENT'}]};
    const storage = new Map(items.map(item => [item.draftKey, item.payload]));
    const root = scope(), petScope = scope();
    root.settings = {layout: {}};
    const cloud = clone(items), requests = [];
    let holdNextRead = false, releaseRead;
    const http = {
        get(url) {
            requests.push({method: 'GET', url});
            const snapshot = {data: clone(url.endsWith('test_result/drafts') ? cloud : (options.tasks || []))};
            if (holdNextRead && url.endsWith('test_result/drafts')) {
                holdNextRead = false;
                return new Promise(resolve => { releaseRead = () => resolve(snapshot); });
            }
            return Promise.resolve(snapshot);
        },
        post(url, body) {
            requests.push({method: 'POST', url, body: clone(body)});
            if (url.endsWith('draft/delete')) {
                if (options.deleteFails) return Promise.reject(Error('Offline'));
                const index = cloud.findIndex(item => item.draftKey === body.draftKey);
                if (index !== -1) cloud.splice(index, 1);
            } else if (url.endsWith('draft/save')) {
                if (options.saveFails) return Promise.reject(Error('Offline'));
                const index = cloud.findIndex(item => item.draftKey === body.draftKey);
                if (index !== -1) cloud[index] = clone(body);
            } else { throw Error('Unexpected write: ' + url); }
            return Promise.resolve({data: true});
        }
    };
    const window = {
        localStorage: {
            get length() { return storage.size; }, key(index) { return [...storage.keys()][index]; },
            getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        sessionStorage: {getItem() { return null; }}, confirm() { return options.confirm !== false; },
        addEventListener() {}, removeEventListener() {}
    };
    const settings = {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}};
    const state = {current: {name: 'application.dashboard'}};
    const dashboard = new Dashboard(root, scope(), http, timer, settings, {}, {get() { return null; }},
        {protocol() { return 'https'; }}, window, state);
    dashboard.myUser = {id: 7};
    dashboard.loadResumeDrafts();
    const definition = petFactory(http, {all: Promise.all.bind(Promise), when: Promise.resolve.bind(Promise)},
        state, timer, timer, window, {get() { return JSON.stringify(user); }}, root, settings);
    const pet = {};
    definition.controller.call(pet, petScope);
    await pet.refresh();
    await tick();
    return {dashboard, pet, storage, root, petScope, cloud, requests, window,
        holdRead() { holdNextRead = true; }, releaseRead() { releaseRead(); }};
}

test('canceling Daily Listening removes its dashboard card and pet reminder without waiting for polling', async () => {
    const item = draft('DAILY_LISTENING');
    const h = await setup([item]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.notificationCount, 1);
    assert.match(h.pet.message, /đang làm dở 1 bài/);
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]);
    await tick();
    assert.equal(h.dashboard.resumeDrafts.length, 0);
    assert.equal(h.pet.drafts.length, 0);
    assert.equal(h.pet.notificationCount, 0);
    assert.doesNotMatch(h.pet.message, /đang làm dở/);
    assert.equal(h.storage.has(item.draftKey), false);
    await h.pet.refresh();
    assert.equal(h.pet.drafts.length, 0, 'the reminder remains gone on the next refresh');
});

test('dismissal removes only that draft and preserves the other draft and assigned task counts', async () => {
    const h = await setup([draft('DAILY_LISTENING', 21), draft('DAILY_LISTENING', 22)],
        {tasks: [{taskId: 88, dueDate: '2026-12-31', overdue: false}]});
    assert.equal(h.pet.notificationCount, 3);
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts.find(item => item.storageKey.endsWith(':21')));
    await tick();
    assert.equal(h.pet.drafts.length, 1);
    assert.ok(h.pet.drafts[0].storageKey.endsWith(':22'));
    assert.equal(h.pet.pendingTaskCount, 1);
    assert.equal(h.pet.notificationCount, 2);
    assert.match(h.pet.message, /đang làm dở 1 bài/);
});

for (const kind of ['IELTS_READING', 'IELTS_LISTENING']) {
    test('hiding ' + kind + ' also dismisses the pet reminder while preserving progress', async () => {
        const item = draft(kind), h = await setup([item], {saveFails: true});
        h.dashboard.hideDraft(h.dashboard.resumeDrafts[0]);
        assert.equal(h.dashboard.resumeDrafts.length, 0);
        assert.equal(h.pet.drafts.length, 0, 'the pet updates before the cloud save completes');
        assert.equal(h.pet.notificationCount, 0);
        const saved = JSON.parse(h.storage.get(item.draftKey));
        assert.equal(saved.hiddenFromDashboard, true);
        assert.equal(saved.answeredCount, 4);
        await tick();
        await h.pet.refresh();
        assert.equal(h.pet.drafts.length, 0, 'a stale cloud copy cannot undo a newer local hide');
    });
}

test('an older in-flight pet refresh cannot restore the deleted draft or its local cache', async () => {
    const item = draft('DAILY_LISTENING'), h = await setup([item]);
    h.holdRead();
    const pending = h.pet.refresh();
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]);
    await tick();
    h.releaseRead();
    await pending;
    assert.equal(h.dashboard.resumeDrafts.length, 0);
    assert.equal(h.pet.drafts.length, 0);
    assert.equal(h.pet.notificationCount, 0);
    assert.equal(h.storage.has(item.draftKey), false, 'stale data is not cached back into local storage');
});

test('a rejected cancellation confirmation preserves both reminders and does not write to the server', async () => {
    const h = await setup([draft('DAILY_LISTENING')], {confirm: false});
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]);
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.notificationCount, 1);
    assert.equal(h.requests.some(item => item.method === 'POST'), false);
});

test('failed cloud deletion leaves the pet reminder and restores the dashboard draft', async () => {
    const item = draft('DAILY_LISTENING'), h = await setup([item], {deleteFails: true});
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]);
    await tick();
    assert.equal(h.dashboard.resumeDrafts.length, 1);
    assert.equal(h.pet.notificationCount, 1);
    assert.equal(h.storage.has(item.draftKey), true);
});

test('dismissals for another account are ignored and the pet releases its event listener on destruction', async () => {
    const item = draft('DAILY_LISTENING'), h = await setup([item]);
    h.root.$broadcast('learningDraftDismissed', {draftKey: item.draftKey, userId: 8});
    assert.equal(h.pet.notificationCount, 1);
    assert.equal(h.root.listeners('learningDraftDismissed'), 1);
    h.petScope.$broadcast('$destroy');
    assert.equal(h.root.listeners('learningDraftDismissed'), 0);
});
