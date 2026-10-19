// Run with: node --test richy/app/tests/flashcard-excel-import-topic.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
    const definitions = {}, calls = {save: [], preview: [], confirm: [], categories: [], created: [], closed: [], dismissed: [], messages: []};
    const module = {
        service(name, definition) {definitions[name] = definition; return this;},
        controller(name, definition) {definitions[name] = definition; return this;},
        directive() {return this;}
    };
    const context = nodeVm.createContext({angular: {
        module() {return module;}, copy: structuredClone,
        forEach(items, fn) {(items || []).forEach(fn);},
        isDefined: value => value !== undefined,
        isString: value => typeof value === 'string',
        isFunction: value => typeof value === 'function'
    }});
    for (const relative of ['topic/business/TopicService.js', 'question/controllers/QuestionExcelImportController.js']) {
        nodeVm.runInContext(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), context);
    }
    const deps = {
        $http(config) {
            calls.save.push(plain(config.data));
            return Promise.resolve().then(() => options.save
                ? options.save(config.data) : {data: {...config.data, id: 41}});
        },
        $q: {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)},
        settings: {api: {baseUrl: '/', apiV1Url: 'api/'}}, Utilities: {},
        $uibModalInstance: {close(result) {calls.closed.push(result);}, dismiss(reason) {calls.dismissed.push(reason);}},
        QuestionService: {
            getPageTopicCategory(search, page, size) {
                calls.categories.push({search, page, size});
                return Promise.resolve().then(() => options.categories
                    ? options.categories(page) : {content: [{id: 7, name: 'IELTS'}], totalPages: 1});
            },
            previewExcelImport(file, topicId) {
                calls.preview.push({file, topicId});
                return Promise.resolve().then(() => options.preview ? options.preview(file, topicId) :
                    {rows: [{rowNumber: 2, word: 'apple', status: 'NEW', level: 'A2'}]});
            },
            confirmExcelImport(request) {
                calls.confirm.push(plain(request));
                return Promise.resolve().then(() => options.confirm ? options.confirm(request) : {success: true, createdCount: 1});
            }
        },
        toastr: Object.fromEntries(['error', 'warning', 'success'].map(type =>
            [type, message => calls.messages.push({type, message})])),
        importTopics: options.topics || [],
        importUserId: options.userId === undefined ? 5 : options.userId,
        onImportTopicCreated(topic) {calls.created.push(topic);}
    };
    function instantiate(name) {const fn = definitions[name]; return new fn(...fn.$inject.map(key => deps[key]));}
    deps.TopicService = instantiate('TopicService');
    const vm = instantiate('QuestionExcelImportModalController');
    return {vm, calls};
}

function fillNewTopic(vm) {
    vm.newTopic.name = '  My new topic  ';
    vm.newTopic.topicCategory = {id: 7, name: 'IELTS'};
    vm.onFileSelected({name: 'words.xlsx', size: 123});
}

test('empty topic lists start with new topic, load categories and require name, category and valid Excel before saving', async () => {
    const {vm, calls} = harness();
    await tick();
    assert.equal(vm.topicMode, 'new');
    assert.equal(vm.topicCategories[0].id, 7);
    vm.onFileSelected({name: 'words.xlsx', size: 123});
    assert.equal(vm.canPreview(), false);
    vm.loadPreview();
    vm.newTopic.name = '  ';
    vm.loadPreview();
    vm.newTopic.name = 'Words';
    vm.loadPreview();
    vm.newTopic.topicCategory = {id: 7};
    vm.onFileSelected({name: 'invalid.csv', size: 123});
    vm.loadPreview();
    vm.onFileSelected({name: 'words.xlsx', size: 11 * 1024 * 1024});
    assert.equal(vm.canPreview(), false);
    assert.deepEqual(calls.save, []);
    assert.deepEqual(calls.preview, []);
});

test('new topic is saved with category and owner; preview and confirmation use exactly its saved ID', async () => {
    const {vm, calls} = harness();
    await tick();
    fillNewTopic(vm);
    assert.equal(vm.canPreview(), true);
    await vm.loadPreview();
    assert.deepEqual(calls.save, [{name: 'My new topic', topicCategory: {id: 7}, userId: 5, isShow: true}]);
    assert.equal(calls.created.length, 1);
    assert.equal(calls.created[0].id, 41);
    assert.equal(vm.selectedTopic.id, 41);
    assert.equal(vm.topicMode, 'existing');
    assert.equal(vm.preview.topicId, 41);
    assert.equal(vm.preview.topicName, 'My new topic');
    assert.equal(calls.confirm.length, 0, 'creating a topic must not confirm import automatically');
    await vm.confirmImport();
    assert.equal(calls.confirm[0].topicId, 41);
    assert.equal(calls.confirm[0].rows[0].word, 'apple');
    assert.equal(calls.closed[0].imported, true);
});

test('existing topic import does not create a topic or require loading categories', async () => {
    const topic = {id: 8, name: 'Existing'};
    const {vm, calls} = harness({topics: [topic]});
    vm.selectedTopic = topic;
    vm.onFileSelected({name: 'words.xls', size: 123});
    await vm.loadPreview();
    await vm.confirmImport();
    assert.equal(calls.preview[0].topicId, 8);
    assert.equal(calls.confirm[0].topicId, 8);
    assert.deepEqual(calls.save, []);
    assert.deepEqual(calls.categories, []);
});

test('category loading supports multiple pages and retry without exposing a partial failed list', async () => {
    let fail = true;
    const {vm, calls} = harness({categories(page) {
        if (page === 2 && fail) throw {data: {message: 'Category unavailable'}};
        return {content: [{id: page, name: 'Page ' + page}], totalPages: 2};
    }});
    await tick();
    assert.equal(vm.categoryLoadError, 'Category unavailable');
    assert.equal(vm.loadingCategories, false);
    assert.equal(vm.topicCategories.length, 0);
    fail = false;
    await vm.loadTopicCategories();
    assert.deepEqual(Array.from(vm.topicCategories, category => category.id), [1, 2]);
    assert.equal(vm.categoryLoadError, '');
    assert.deepEqual(calls.categories.map(call => call.page), [1, 2, 1, 2]);
});

test('failed or unconfirmed topic creation preserves inputs and never uploads the Excel file', async () => {
    for (const save of [() => Promise.reject({data: {message: 'Save failed'}}), () => ({data: {message: 'Topic limit reached'}})]) {
        const {vm, calls} = harness({save});
        await tick();
        fillNewTopic(vm);
        await vm.loadPreview();
        assert.equal(vm.topicMode, 'new');
        assert.equal(vm.newTopic.name, '  My new topic  ');
        assert.equal(vm.newTopic.topicCategory.id, 7);
        assert.equal(vm.file.name, 'words.xlsx');
        assert.equal(vm.loadingPreview, false);
        assert.equal(vm.savingTopic, false);
        assert.equal(calls.preview.length, 0);
        assert.equal(calls.created.length, 0);
        assert.equal(calls.messages.at(-1).type, 'error');
    }
});

test('preview errors and changing files reuse the saved topic without creating duplicates', async () => {
    let fail = true;
    const {vm, calls} = harness({preview() {
        if (fail) throw {data: {message: 'Invalid worksheet'}};
        return {rows: [{rowNumber: 2, word: 'apple', status: 'NEW'}]};
    }});
    await tick();
    fillNewTopic(vm);
    await vm.loadPreview();
    assert.equal(vm.preview, null);
    assert.equal(vm.selectedTopic.id, 41);
    fail = false;
    await vm.loadPreview();
    vm.backToFileSelection();
    vm.onFileSelected({name: 'corrected.xlsx', size: 456});
    await vm.loadPreview();
    assert.equal(calls.save.length, 1);
    assert.deepEqual(calls.preview.map(call => call.topicId), [41, 41, 41]);
    assert.equal(calls.created.length, 1);
    assert.equal(vm.preview.topicId, 41);
});

test('pending creation blocks double clicks, closing and file replacement; pending confirm blocks a second import', async () => {
    let releaseSave, releaseConfirm;
    const {vm, calls} = harness({
        save: () => new Promise(resolve => {releaseSave = resolve;}),
        confirm: () => new Promise(resolve => {releaseConfirm = resolve;})
    });
    await tick();
    fillNewTopic(vm);
    const pending = vm.loadPreview();
    vm.loadPreview();
    vm.cancel();
    vm.onFileSelected({name: 'different.xlsx', size: 456});
    assert.equal(vm.canPreview(), false);
    await tick();
    assert.equal(calls.save.length, 1);
    assert.equal(calls.dismissed.length, 0);
    assert.equal(vm.file.name, 'words.xlsx');
    releaseSave({data: {id: 41, name: 'My new topic', topicCategory: {id: 7}}});
    await pending;
    const confirming = vm.confirmImport();
    vm.confirmImport();
    vm.backToFileSelection();
    vm.cancel();
    await tick();
    assert.equal(calls.confirm.length, 1);
    assert.equal(calls.dismissed.length, 0);
    releaseConfirm({success: true});
    await confirming;
    assert.equal(calls.closed.length, 1);
});

test('closing after topic creation keeps the created topic available without importing rows', async () => {
    const {vm, calls} = harness();
    await tick();
    fillNewTopic(vm);
    await vm.loadPreview();
    vm.cancel();
    assert.equal(calls.created.length, 1);
    assert.equal(calls.confirm.length, 0);
    assert.deepEqual(calls.dismissed, ['cancel']);
});
