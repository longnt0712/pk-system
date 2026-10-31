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
    const storage = new Map((options.localItems || items).map(item => [item.draftKey, item.payload]));
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

test('Study notebooks do not create homework reminders or duplicate their large payloads in the draft cache', async () => {
    const h = await setup([]), key = 'study-notebook:v1:7:READING:42';
    const localKey = 'study-notebook-local:v1:7:READING:42';
    const local = JSON.stringify({document: {text: 'Unsynced writing'}, dirty: true});
    h.storage.set(localKey, local);
    h.cloud.push({id: 90, draftKey: key, draftType: 'STUDY_NOTEBOOK', payload: JSON.stringify({userId: 7,
        document: {text: 'Synced writing'}, hiddenFromDashboard: true})});
    h.dashboard.loadResumeDrafts(); await tick(); await h.pet.refresh(); await tick();
    assert.equal(h.dashboard.resumeDrafts.length, 0);
    assert.equal(h.pet.drafts.length, 0); assert.equal(h.pet.notificationCount, 0);
    assert.equal(h.storage.has(key), false, 'ignored notebook payloads must not consume another local storage slot');
    assert.equal(h.storage.get(localKey), local);
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
        const item = draft(kind); item.payload=JSON.stringify({...JSON.parse(item.payload),sessionMode:'STUDY'});
        const h = await setup([item], {saveFails: true});
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

function ieltsItem(mode = 'COMPREHENSIVE', extra = {}) {
    const payload = {userId:7,testId:54,testMode:mode,sessionMode:'SERIOUS',clientAttemptKey:'a'.repeat(32),
        assignmentTaskId:19,assignmentParts:[1],assignmentPart:1,isPartAssignment:true,partNumbers:[1],
        title:'An assigned test',answeredCount:22,totalQuestions:63,savedAt:'2026-10-31T06:54:09Z',...extra};
    return {draftType:'IELTS',draftKey:'ieltsReadingInProgress:7:'+mode.toLowerCase()+':test:54:'+payload.sessionMode.toLowerCase()
        +(payload.assignmentTaskId?':task:'+payload.assignmentTaskId+':parts:1':''),payload:JSON.stringify(payload),savedAt:Date.parse(payload.savedAt)};
}
function savedResult(extra={}) {
    return {id:91,user:{id:7},clientAttemptKey:'a'.repeat(32),testType:6,sourceQuestionId:54,
        assignmentTaskId:19,assignmentSectionKey:null,completedParts:[1],ieltsSessionMode:'SERIOUS',resultStatus:'SUCCESS',...extra};
}

for (const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']) {
    test(mode+' Study stays visible with a non-destructive Hide action until the learner chooses to hide it',async()=>{
        const item=ieltsItem(mode,{sessionMode:'STUDY',assignmentTaskId:null,annotationNotes:[{id:'n1',text:'Keep this note'}],annotations:[{highlight:true}],audioPosition:300});
        const h=await setup([item]);assert.equal(h.dashboard.resumeDrafts.length,1);assert.equal(h.pet.drafts.length,1);assert.equal(h.pet.notificationCount,1);
        assert.equal(h.dashboard.isStudyDraft(h.dashboard.resumeDrafts[0]),true);
        assert.equal(h.storage.get(item.draftKey),item.payload);assert.equal(h.cloud.length,1);assert.equal(h.requests.some(r=>r.method==='POST'),false);
        h.dashboard.hideDraft(h.dashboard.resumeDrafts[0]);await tick();await h.pet.refresh();
        assert.equal(h.dashboard.resumeDrafts.length,0);assert.equal(h.pet.drafts.length,0);
        const hidden=JSON.parse(h.storage.get(item.draftKey));assert.equal(hidden.audioPosition,300);assert.deepEqual(hidden.annotationNotes,[{id:'n1',text:'Keep this note'}]);assert.deepEqual(hidden.annotations,[{highlight:true}]);
        assert.equal(h.requests.some(r=>r.url.endsWith('draft/delete')),false);
    });
}
test('legacy Study keys offer Hide and a real assignment remains Serious even with an old Study flag',async()=>{
    const legacy=ieltsItem('COMPREHENSIVE',{sessionMode:'STUDY',assignmentTaskId:null}),payload=JSON.parse(legacy.payload);delete payload.sessionMode;legacy.payload=JSON.stringify(payload);
    const assigned=ieltsItem('COMPREHENSIVE',{sessionMode:'STUDY'});const h=await setup([legacy,assigned]);
    assert.equal(h.dashboard.resumeDrafts.length,2);assert.equal(h.pet.drafts.length,2);
    assert.equal(h.dashboard.isStudyDraft(h.dashboard.resumeDrafts.find(d=>d.storageKey===legacy.draftKey)),true);
    const test=h.dashboard.resumeDrafts.find(d=>d.storageKey===assigned.draftKey);assert.equal(test.sessionMode,'SERIOUS');assert.equal(h.dashboard.isStudyDraft(test),false);
    assert.equal(h.storage.get(legacy.draftKey),legacy.payload);
});
test('Study never deletes progress through the cancel handler; Serious tests still support confirmed cancellation',async()=>{
    const study=ieltsItem('COMPREHENSIVE',{sessionMode:'STUDY',assignmentTaskId:null});let h=await setup([study]);
    await h.dashboard.cancelDraft(h.dashboard.resumeDrafts[0]);await tick();assert.equal(JSON.parse(h.storage.get(study.draftKey)).hiddenFromDashboard,true);
    assert.equal(h.requests.some(r=>r.url.endsWith('draft/delete')),false);
    for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
        const item=ieltsItem(mode);h=await setup([item]);const draft=h.dashboard.resumeDrafts[0];assert.equal(h.dashboard.isStudyDraft(draft),false);
        h.dashboard.hideDraft(draft);assert.equal(h.requests.some(r=>r.method==='POST'),false);assert.equal(h.dashboard.resumeDrafts.length,1);
        await h.dashboard.cancelDraft(draft);await tick();assert.equal(h.dashboard.resumeDrafts.length,0);assert.equal(h.storage.has(item.draftKey),false);assert.ok(h.requests.some(r=>r.url.endsWith('draft/delete')));
    }
    const view=fs.readFileSync(path.join(__dirname,'../dashboards/views/general-alt.html'),'utf8');
    assert.match(view,/ng-if="vm\.isStudyDraft\(draft\)" ng-click="vm\.hideDraft\(draft\)"/);
    assert.match(view,/ng-if="!vm\.isStudyDraft\(draft\)" ng-click="vm\.cancelDraft\(draft\)"/);
    assert.match(view,/vm\.resumeDrafts\.length/);assert.match(view,/Có, làm tiếp/);
});
test('database-confirmed saved attempts suppress stale local and cloud reminders without deleting answers',async()=>{
    const item=ieltsItem();item.savedResult=savedResult();const local={...item,payload:JSON.stringify({...JSON.parse(item.payload),savedAt:'2026-10-31T07:00:00Z',answeredCount:36})};
    const h=await setup([item],{localItems:[local]});assert.equal(h.dashboard.resumeDrafts.length,0);assert.equal(h.pet.notificationCount,0);
    assert.equal(h.storage.get(item.draftKey),local.payload);assert.equal(h.cloud[0].payload,item.payload);assert.equal(h.requests.some(r=>r.method==='POST'),false);
});
test('a later attempt at the same test/task is retained when the older attempt is confirmed',async()=>{
    const item=ieltsItem();item.savedResult=savedResult();const local={...item,payload:JSON.stringify({...JSON.parse(item.payload),clientAttemptKey:'b'.repeat(32),savedAt:'2026-10-31T07:00:00Z'})};
    const h=await setup([item],{localItems:[local]});assert.equal(h.dashboard.resumeDrafts.length,1);assert.equal(h.pet.drafts.length,1);assert.equal(h.pet.drafts[0].ieltsAttemptKey,'b'.repeat(32));
});
test('a receipt for another owner, source, task, section, part, type, key or Study session never hides a draft',async()=>{
    for(const change of [{user:{id:8}},{sourceQuestionId:55},{assignmentTaskId:20},{assignmentSectionKey:'another'},
        {completedParts:[2]},{testType:7},{clientAttemptKey:'b'.repeat(32)},{id:0},{ieltsSessionMode:'STUDY'},{resultStatus:null}]){
        const item=ieltsItem();item.savedResult=savedResult(change);const h=await setup([item]);
        assert.equal(h.dashboard.resumeDrafts.length,1,JSON.stringify(change));assert.equal(h.pet.drafts.length,1,JSON.stringify(change));
    }
});
test('failed active work stays available; a verified failed pending submission stops claiming it is unsaved',async()=>{
    const active=ieltsItem();active.savedResult=savedResult({resultStatus:'FAILED'});let h=await setup([active]);assert.equal(h.dashboard.resumeDrafts.length,1);assert.equal(h.pet.drafts.length,1);
    const pending=JSON.parse(active.payload);pending.submissionState={key:pending.clientAttemptKey,status:'PENDING',payload:{clientAttemptKey:pending.clientAttemptKey,user:{id:7},testType:6,sourceQuestionId:54,assignmentTaskId:19,completedParts:[1]}};
    active.payload=JSON.stringify(pending);h=await setup([active]);assert.equal(h.dashboard.resumeDrafts.length,0);assert.equal(h.pet.drafts.length,0);
});
