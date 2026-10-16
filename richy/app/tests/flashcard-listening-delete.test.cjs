// Run with: node --test richy/app/tests/flashcard-listening-delete.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/QuestionController.js'), 'utf8');
const feature = source.slice(source.indexOf('vm.selectedFlashCardIds = {};'), source.indexOf('// $scope.setPage'));
const loadPage = source.slice(source.indexOf('vm.getPageFlashCard = function ()'), source.indexOf('vm.clickShowListFlashCard = function'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(outcomes = {}) {
    const calls = {deleted: [], dialogs: [], success: [], error: [], reload: 0, levels: 0, blocks: 0};
    const cards = [1, 2, 3].map(id => ({id, question: 'Mirror ' + id, motherTongue: 'Answer ' + id, status: 5}));
    const vm = {questions: cards, status: {id: 5}, searchDto: {status: 5, pageIndex: 2, pageSize: 5, totalItems: 8},
        getPageFlashCard() {calls.reload++; vm.selectedFlashCardIds = {};},
        loadLevelTable() {calls.levels++;}};
    const context = nodeVm.createContext({vm, $scope: {},
        angular: {forEach(items, callback) {(items || []).forEach(callback);}},
        blockUI: {start() {calls.blocks++;}, stop() {calls.blocks--; }},
        toastr: {success(message) {calls.success.push(message);}, error(message) {calls.error.push(message);}},
        service: {deleteObject(id) {
            calls.deleted.push(id);
            if (outcomes[id] instanceof Error) return Promise.reject(outcomes[id]);
            return Promise.resolve(outcomes[id] === undefined ? true : outcomes[id]);
        }},
        modal: {open(options) {
            const scope = {};
            options.controller[1](scope);
            let confirm, dismiss;
            const result = new Promise((resolve, reject) => {confirm = resolve; dismiss = reject;});
            calls.dialogs.push({options, scope, confirm, dismiss});
            return {result};
        }}});
    nodeVm.runInContext(feature, context);
    return {vm, calls, context};
}

test('selection includes all current page flashcards and excludes stale IDs and saving rows', () => {
    const {vm, calls} = setup();
    vm.questions.push({id: 4, status: 1}, {id: 5, status: 5, _rowSaving: true});
    vm.selectedFlashCardIds[99] = true;
    vm.toggleAllFlashCards();
    assert.deepEqual(Array.from(vm.getSelectedFlashCards(), card => card.id), [1, 2, 3, 4]);
    assert.equal(vm.allFlashCardsSelected(), true);
    vm.toggleAllFlashCards();
    assert.equal(vm.getSelectedFlashCards().length, 0);
    vm.status.id = 3;
    vm.searchDto.status = 3;
    vm.toggleAllFlashCards();
    vm.deleteListeningCard(vm.questions[0]);
    assert.equal(vm.getSelectedFlashCards().length, 4);
    assert.equal(calls.dialogs.length, 0, 'row delete stays restricted to Listening');
    vm.flashCardsLoading = true;
    vm.toggleAllFlashCards();
    assert.equal(vm.allFlashCardsSelected(), false);
});

test('non-Listening filters support selecting one flashcard, cancellation and confirmed deletion', async () => {
    for (const status of [undefined, 3, 4]) {
        const {vm, calls} = setup();
        vm.status.id = status || 3;
        vm.searchDto.status = status;
        vm.questions = [
            {id: 10, question: 'First word', status: 1},
            {id: 11, question: 'Second word', status: 4},
            {id: 12, question: 'Third word', status: 1}
        ];
        vm.selectedFlashCardIds = {11: true, 99: true};
        vm.deleteSelectedFlashCards();
        assert.deepEqual(calls.deleted, []);
        assert.deepEqual(Array.from(calls.dialogs[0].scope.flashCardsToDelete, card => card.id), [11]);
        calls.dialogs[0].dismiss('cancel');
        await tick();
        assert.deepEqual(calls.deleted, []);
        assert.equal(vm.getSelectedFlashCards().length, 1);
        vm.deleteSelectedFlashCards();
        calls.dialogs[1].confirm('yes');
        await tick();
        assert.deepEqual(calls.deleted, [11]);
        assert.match(calls.success[0], /1 flashcard\./);
        assert.doesNotMatch(calls.success[0], /Listening/);
        assert.equal(calls.reload, 1);
    }
});

test('single delete snapshots the card; cancel, dismiss and duplicate clicks never delete', async () => {
    const {vm, calls} = setup();
    vm.deleteListeningCard(vm.questions[0]);
    vm.deleteListeningCard(vm.questions[1]);
    assert.equal(calls.dialogs.length, 1);
    assert.deepEqual(calls.deleted, []);
    vm.questions[0].question = 'Changed after confirmation';
    assert.equal(calls.dialogs[0].scope.flashCardsToDelete[0].question, 'Mirror 1');
    calls.dialogs[0].confirm('no');
    await tick();
    assert.equal(vm.flashCardDeleteConfirmOpen, false);
    vm.deleteListeningCard(vm.questions[1]);
    calls.dialogs[1].dismiss('escape');
    await tick();
    assert.deepEqual(calls.deleted, []);
    assert.equal(vm.flashCardDeleteConfirmOpen, false);
});

test('single confirmation deletes exactly that card regardless of the bulk selection', async () => {
    const {vm, calls} = setup();
    vm.toggleAllFlashCards();
    vm.deleteListeningCard(vm.questions[1]);
    assert.equal(calls.dialogs[0].scope.flashCardsToDelete.length, 1);
    calls.dialogs[0].confirm('yes');
    await tick();
    assert.deepEqual(calls.deleted, [2]);
    assert.equal(calls.reload, 1);
    assert.equal(calls.blocks, 0);
});

test('bulk delete requires confirmation, removes only selected visible cards and handles last page', async () => {
    const {vm, calls} = setup();
    vm.toggleAllFlashCards();
    vm.selectedFlashCardIds[99] = true;
    vm.showLevelTable = true;
    vm.deleteSelectedFlashCards();
    assert.deepEqual(calls.deleted, []);
    assert.equal(calls.dialogs[0].scope.flashCardsToDelete.length, 3);
    calls.dialogs[0].confirm('yes');
    await tick();
    assert.deepEqual(calls.deleted, [1, 2, 3]);
    assert.equal(vm.searchDto.pageIndex, 1);
    assert.equal(calls.reload, 1);
    assert.equal(calls.levels, 1);
    assert.equal(calls.success.length, 1);
    assert.equal(calls.blocks, 0);
    assert.equal(vm.flashCardDeleteBusy, false);
});

test('HTTP failures and false API responses report partial success accurately', async () => {
    const {vm, calls} = setup({2: false, 3: new Error('network failure')});
    vm.toggleAllFlashCards();
    vm.deleteSelectedFlashCards();
    calls.dialogs[0].confirm('yes');
    await tick();
    assert.deepEqual(calls.deleted, [1, 2, 3]);
    assert.match(calls.error[0], /2 thẻ/);
    assert.match(calls.success[0], /1 flashcard/);
    assert.equal(calls.reload, 1);
    assert.equal(calls.blocks, 0);
    assert.equal(vm.flashCardDeleteBusy, false);
});

test('complete failure preserves the selection for retry without a success notification', async () => {
    const {vm, calls} = setup({1: false, 2: false, 3: false});
    vm.toggleAllFlashCards();
    vm.deleteSelectedFlashCards();
    calls.dialogs[0].confirm('yes');
    await tick();
    assert.equal(calls.reload, 0);
    assert.equal(calls.success.length, 0);
    assert.equal(vm.getSelectedFlashCards().length, 3);
    assert.equal(vm.flashCardDeleteBusy, false);
    assert.equal(calls.blocks, 0);
});

test('deletion stays sequential and rejects new confirmation dialogs while in progress', async () => {
    const {vm, calls, context} = setup();
    const release = [];
    context.service.deleteObject = id => {
        calls.deleted.push(id);
        return new Promise(resolve => release.push(resolve));
    };
    vm.toggleAllFlashCards();
    vm.deleteSelectedFlashCards();
    calls.dialogs[0].confirm('yes');
    await tick();
    assert.deepEqual(calls.deleted, [1]);
    assert.equal(vm.flashCardDeleteBusy, true);
    vm.deleteListeningCard(vm.questions[1]);
    vm.toggleAllFlashCards();
    assert.equal(calls.dialogs.length, 1);
    assert.equal(vm.getSelectedFlashCards().length, 3);
    for (let index = 0; index < 3; index++) {release[index](true); await tick();}
    assert.deepEqual(calls.deleted, [1, 2, 3]);
    assert.equal(vm.flashCardDeleteBusy, false);
});

test('reloading clears selection on page/filter changes and handles deleting the final card', async () => {
    const {vm, calls, context} = setup();
    vm.currentUser = {id: 7, username: 'teacher'};
    vm.toggleAllFlashCards();
    context.service.getPage = () => Promise.resolve({content: [], totalElements: 0});
    context.shuffleArray1 = context.shuffleArray2 = () => {};
    vm.createQuiz = () => {throw new Error('Empty page must not create a quiz');};
    nodeVm.runInContext(loadPage, context);
    const loading = vm.getPageFlashCard();
    assert.equal(vm.flashCardsLoading, true);
    assert.equal(Object.keys(vm.selectedFlashCardIds).length, 0);
    await loading;
    assert.equal(vm.currentCard.id, undefined);
    assert.equal(vm.questions.length, 0);
    assert.equal(vm.searchDto.totalItems, 0);
    assert.equal(vm.flashCardsLoading, false);
    assert.equal(calls.blocks, 0);
    context.service.getPage = () => Promise.reject(new Error('offline'));
    await vm.getPageFlashCard();
    assert.equal(vm.flashCardsLoading, false);
    assert.equal(calls.blocks, 0);
    assert.equal(calls.error.length, 1);
});
