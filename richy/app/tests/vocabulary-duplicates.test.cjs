const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'topic/controllers/VocabularyDuplicateController.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function fixture(overrides = {}) {
    let Controller, dialog, modalCalls = 0;
    const events = {}, notices = [], payloads = [];
    const group = {word: 'minimal', ids: [10, 20, 30], count: 3};
    const cards = [
        {id: 10, question: 'minimal', motherTongue: ' tối thiểu ', pronounce: '/one/', level: 'B2', fingerprint: 'a',
            questionTopics: [{topic: {id: 1, name: 'Bài 2'}}]},
        {id: 20, question: 'minimal', motherTongue: 'rất ít', pronounce: '/two/', level: 'C1', fingerprint: 'b',
            questionTopics: [{topic: {id: 1, name: 'Bài 2'}}, {topic: {id: 2, name: 'Bài 10'}}]},
        {id: 30, question: 'minimal', motherTongue: 'tối thiểu', fingerprint: 'c', questionTopics: []}
    ];
    const module = {controller(name, fn) { Controller = fn; return this; }, directive() { return this; }};
    vm.runInNewContext(source, {angular: {module: () => module, noop() {}}});
    const api = Object.assign({
        getVocabularyDuplicateGroups: () => Promise.resolve([group]),
        getVocabularyDuplicateDetails: () => Promise.resolve(cards),
        mergeVocabularyDuplicates(payload) { payloads.push(plain(payload)); return Promise.resolve({card: {id: payload.primaryId}, mergedCount: payload.sources.length - 1}); }
    }, overrides);
    const scope = {$on(name, callback) { events[name] = callback; }};
    const modal = {open() {
        modalCalls++;
        dialog = {result: new Promise(() => {}), close() { this.closed = true; }, dismiss() { this.dismissed = true; }};
        return dialog;
    }};
    const controller = new Controller(scope, modal, api, {
        success(text) { notices.push(text); }, info(text) { notices.push(text); }
    });
    return {controller, group, cards, api, events, payloads, notices, get dialog() { return dialog; }, get modalCalls() { return modalCalls; }};
}

test('all duplicate groups are searchable while the scroll list renders batches', async () => {
    const groups = Array.from({length: 95}, (_, index) => ({word: 'word ' + index, ids: [index * 2 + 1, index * 2 + 2], count: 2}));
    const {controller: page} = fixture({getVocabularyDuplicateGroups: () => Promise.resolve(groups)});
    await tick();
    assert.equal(page.groups.length, 95);
    assert.equal(page.visibleGroups.length, 30);
    page.loadMore(); assert.equal(page.visibleGroups.length, 60);
    page.loadMore(); page.loadMore(); assert.equal(page.visibleGroups.length, 95);
    page.query = 'word 94'; page.filterGroups();
    assert.equal(page.visibleGroups[0].word, 'word 94');
    page.query = null; page.filterGroups(); assert.equal(page.visibleGroups.length, 30);
});

test('selecting a subset unions its topics, deduplicates meanings and retains manual meaning edits', async () => {
    const {controller: page, group, cards} = fixture();
    await tick(); await page.openGroup(group);
    assert.equal(page.primaryId, 10);
    assert.equal(page.meaning, 'tối thiểu / rất ít');
    assert.deepEqual(plain(page.topics).map(topic => topic.id), [1, 2]);
    page.meaning = 'Nghĩa đã biên tập'; page.meaningChanged();
    page.selected[20] = false; page.changeSelection();
    assert.equal(page.meaning, 'Nghĩa đã biên tập');
    assert.equal(page.topics.length, 1);
    page.useSuggestedMeaning(); assert.equal(page.meaning, 'tối thiểu');
    page.selectPrimary(cards[1]); assert.equal(page.primaryId, 20);
    assert.equal(page.selected[20], true);
    page.selected[20] = false; page.changeSelection(); assert.equal(page.primaryId, 10);
    page.toggleAll(); assert.equal(page.chosen.length, 3);
    page.toggleAll(); assert.equal(page.chosen.length, 0); assert.equal(!!page.canMerge(), false);
});

test('confirm merges only the chosen cards and blocks duplicate requests while waiting for acknowledgement', async () => {
    const save = deferred(), calls = [];
    const f = fixture({mergeVocabularyDuplicates(payload) { calls.push(plain(payload)); return save.promise; }});
    const page = f.controller;
    await tick(); await page.openGroup(f.group);
    page.selected[30] = false; page.changeSelection(); page.selectPrimary(f.cards[1]);
    page.meaning = 'Tối thiểu / rất ít'; page.meaningChanged();
    page.confirmMerge(); assert.equal(f.modalCalls, 1); assert.equal(calls.length, 0);
    const pending = page.merge(); page.merge(); page.refresh();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {primaryId: 20, meaning: 'Tối thiểu / rất ít', sources: [{id: 10, fingerprint: 'a'}, {id: 20, fingerprint: 'b'}]});
    let prevented = false;
    f.events.$locationChangeStart({preventDefault() { prevented = true; }}); assert.equal(prevented, true);
    save.resolve({card: {id: 20, motherTongue: 'Tối thiểu / rất ít'}, mergedCount: 1}); await pending;
    assert.equal(f.dialog.closed, true); assert.equal(page.merging, false); assert.equal(page.lastMerge.card.id, 20);
    assert.equal(page.activeGroup, null);
});

test('stale data rejection preserves the selected words and edited meaning until reloaded', async () => {
    const f = fixture({mergeVocabularyDuplicates: () => Promise.reject({status: 409, data: {message: 'Từ đã thay đổi'}})});
    const page = f.controller;
    await tick(); await page.openGroup(f.group);
    page.meaning = 'Giữ phần đang sửa'; page.meaningChanged(); page.confirmMerge(); await page.merge();
    assert.equal(page.mergeError, 'Từ đã thay đổi'); assert.equal(page.meaning, 'Giữ phần đang sửa');
    assert.equal(page.chosen.length, 3); assert.equal(f.dialog.closed, undefined);
    assert.equal(!!page.canMerge(), false); assert.equal(f.notices.length, 0);
    page.cancelMerge(); assert.equal(f.dialog.dismissed, true);
    await page.openGroup(f.group); assert.equal(!!page.canMerge(), true);
});

test('an unconfirmed response never reports success and excessive meaning cannot be submitted', async () => {
    const f = fixture({mergeVocabularyDuplicates: () => Promise.resolve({card: {id: 999}, mergedCount: 2})});
    const page = f.controller;
    await tick(); await page.openGroup(f.group);
    page.meaning = 'x'.repeat(501); page.confirmMerge(); assert.equal(f.modalCalls, 0);
    page.meaning = 'edited'; page.confirmMerge(); await page.merge();
    assert.equal(f.dialog.closed, undefined); assert.equal(f.notices.length, 0);
    assert.equal(page.lastMerge, undefined); assert.match(page.mergeError, /Chưa xác nhận/);
});

test('changing groups ignores old detail responses and refuses incomplete or unrelated card data', async () => {
    const old = deferred();
    const f = fixture({getVocabularyDuplicateDetails(ids) {
        return ids[0] === 10 ? old.promise : Promise.resolve([{id: 80, fingerprint: 'new-a'}, {id: 90, fingerprint: 'new-b'}]);
    }});
    const page = f.controller;
    await tick(); const pending = page.openGroup(f.group);
    const next = {word: 'next', ids: [80, 90], count: 2}; await page.openGroup(next);
    old.resolve(f.cards); await pending;
    assert.equal(page.activeGroup, next); assert.equal(page.primaryId, 80);
    f.api.getVocabularyDuplicateDetails = () => Promise.resolve([{id: 80, fingerprint: 'a'}, {id: 80, fingerprint: 'a'}]);
    await page.openGroup(next); assert.equal(page.cards.length, 0); assert.ok(page.groupError); assert.equal(!!page.canMerge(), false);
    f.api.getVocabularyDuplicateDetails = () => Promise.resolve([{id: 80, fingerprint: 'a'}, {id: 99, fingerprint: 'b'}]);
    await page.openGroup(next); assert.equal(page.cards.length, 0); assert.ok(page.groupError);
});

test('the route and menu load the manager on demand and the service sends scoped API requests', async () => {
    const states = {};
    const provider = {state(name, definition) { states[name] = definition; return this; }};
    const module = {config(definition) { definition.at(-1)(provider); return this; }};
    vm.runInNewContext(fs.readFileSync(path.join(app, 'topic/topic.module.js'), 'utf8'), {
        Hrm: {}, angular: {module: () => module}, window: {APP_VERSION: 'checks'}
    });
    const state = states['application.vocabulary_duplicates'];
    assert.equal(state.templateUrl, 'topic/views/vocabulary_duplicates.html');
    assert.equal(state.controller, 'VocabularyDuplicateController as vm');
    let dependencies;
    state.resolve.deps.at(-1)({load(config) { dependencies = config.files; }});
    assert.ok(dependencies.includes('topic/controllers/VocabularyDuplicateController.js?v=checks'));
    assert.ok(dependencies.includes('question/business/QuestionService.js?v=checks'));
    assert.ok(dependencies.includes('topic/vocabulary_duplicates.css?v=checks'));
    const menu = fs.readFileSync(path.join(app, 'common/views/navs/header-hoz.html'), 'utf8');
    assert.match(menu, /ng-if="settings\.isAdmin \|\| settings\.isFlashCardUser"[^\n]+href="vocabulary_duplicates"/);
    let Service;
    vm.runInNewContext(fs.readFileSync(path.join(app, 'question/business/QuestionService.js'), 'utf8'), {
        angular: {module: () => ({service(name, fn) { Service = fn; }})}
    });
    const calls = [], response = {data: 'server result'};
    const http = {get(...args) { calls.push(['GET', ...args]); return Promise.resolve(response); },
        post(...args) { calls.push(['POST', ...args]); return Promise.resolve(response); }};
    const service = new Service(http, {}, {}, {api: {baseUrl: '/api/', apiV1Url: ''}}, {});
    assert.equal(await service.getVocabularyDuplicateGroups(), 'server result');
    await service.getVocabularyDuplicateDetails([10, 20]);
    const payload = {primaryId: 20, meaning: 'one / two', sources: [{id: 10, fingerprint: 'a'}, {id: 20, fingerprint: 'b'}]};
    await service.mergeVocabularyDuplicates(payload);
    assert.deepEqual(plain(calls), [
        ['GET', '/api/question/vocabulary/duplicates', {timeout: 30000}],
        ['POST', '/api/question/vocabulary/duplicates/details', {ids: [10, 20]}, {timeout: 30000}],
        ['POST', '/api/question/vocabulary/duplicates/merge', payload, {timeout: 90000}]
    ]);
});
