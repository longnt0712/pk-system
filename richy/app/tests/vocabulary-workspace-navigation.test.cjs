const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = path.resolve(__dirname, '..');

test('vocabulary has one navigation entry and the old flashcard URL opens the same workspace', () => {
    const states = {};
    const provider = {state(name, definition) { states[name] = definition; return this; }};
    const module = {filter() { return this; }, config(definition) { definition.at(-1)(provider); return this; }};
    const context = vm.createContext({Hrm: {}, angular: {module: () => module}, window: {APP_VERSION: 'test'}});
    for (const file of ['topic/topic.module.js', 'question/question.module.js']) vm.runInContext(fs.readFileSync(path.join(app, file), 'utf8'), context);
    const primary = states['application.topic'];
    assert.equal(primary.templateUrl, 'topic/views/vocabulary.html');
    assert.equal(primary.controller, 'VocabularyController as vm');
    assert.equal(primary.reloadOnSearch, false);
    const destinations = [], enter = states['application.question'].onEnter.at(-1);
    const state = {go(...args) { destinations.push(args); }};
    enter(state, {listFlashCard: '3', lesson: '101'});
    assert.equal(destinations[0][0], 'application.topic'); assert.equal(destinations[0][1].lesson, '101');
    assert.equal(destinations[0][2].location, 'replace');
    enter(state, {listFlashCard: '1'}); assert.equal(destinations.length, 1);
    const nav = fs.readFileSync(path.join(app, 'common/views/navs/header-hoz.html'), 'utf8');
    assert.equal((nav.match(/href="topics"/g) || []).length, 1);
    assert.ok(!nav.includes('YOUR FLASHCARDS'));
    let dependencies;
    primary.resolve.deps.at(-1)({load(config) { dependencies = config.files; }});
    assert.ok(dependencies.includes('topic/vocabulary.css?v=test'));
    assert.ok(dependencies.includes('question/controllers/QuestionExcelImportController.js?v=test'));
});

test('exact search is sent to the API and word details show all linked lessons', async () => {
    let Controller, lastSearch;
    const module = {
        controller(name, fn) { Controller = fn; return this; },
        directive() { return this; }
    };
    const context = vm.createContext({angular: {
        module: () => module, copy: value => JSON.parse(JSON.stringify(value)), noop() {}
    }});
    vm.runInContext(fs.readFileSync(path.join(app, 'topic/controllers/VocabularyController.js'), 'utf8'), context);
    const cards = {
        getVocabularyUsage: () => Promise.resolve({wordCount: 0, topicCount: 0}),
        getVocabularyPage(search) { lastSearch = search; return Promise.resolve({content: [], totalElements: 0}); }
    };
    const lessons = {
        getPage: () => Promise.resolve({content: [], totalElements: 0}),
        getPageTopicCategory: () => Promise.resolve({content: [], totalPages: 1})
    };
    const timeout = () => ({}); timeout.cancel = () => {};
    const modal = {open: () => ({result: Promise.resolve(), dismiss() {}})};
    const q = {defer() {
        let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve};
    }};
    const workspace = new Controller({$on() {}}, q, modal, {get: () => '{"id":26,"username":"english"}'},
        {search: (...args) => args.length ? {replace() {}} : {}}, {isAdmin: true}, cards, lessons, {}, {}, timeout);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lastSearch, undefined, 'entering the library does not fetch unfiltered cards');
    await workspace.selectLesson({id: 101, name: 'My lesson', topicCategory: {id: 1, name: 'Group'}});
    assert.equal(lastSearch.findExactWord, true);
    workspace.findExactWord = false; workspace.query = 'minimal';
    await workspace.loadCards(true);
    assert.equal(lastSearch.findExactWord, false);
    assert.equal(lastSearch.textSearch, 'minimal');

    const links = Array.from({length: 36}, (_, index) => ({
        topic: {id: index + 1, name: 'Lesson ' + (index + 1)}
    }));
    const card = {id: 48652, question: 'minimal', questionTopics: links};
    workspace.openCard(card);
    assert.equal(workspace.cardTopics.length, 36);
    assert.equal(workspace.cardTopics[35].name, 'Lesson 36');
    assert.deepEqual(JSON.parse(JSON.stringify(workspace.cardDraft.questionTopics)), links);
    assert.equal(workspace.lessons.length, 0, 'membership list must not depend on the sidebar page');

    workspace.openCard({id: 42, question: 'new word'});
    assert.equal(workspace.cardTopics.length, 0);
});

test('a viewer can create a personal folder and opens old category links under uncategorized', async () => {
    let Controller;
    const module = {
        controller(name, fn) { Controller = fn; return this; },
        directive() { return this; }
    };
    const context = vm.createContext({angular: {module: () => module, noop() {}}});
    vm.runInContext(fs.readFileSync(path.join(app, 'topic/controllers/VocabularyController.js'), 'utf8'), context);
    const categoryReads = [], lessonReads = [], saves = [];
    const lessons = {
        getPageTopicCategory(search) {
            categoryReads.push(search);
            return Promise.resolve({content: [{id: 42, name: 'Nhóm của tôi', personal: true}], totalPages: 1});
        },
        getPage(search) {
            lessonReads.push(search);
            return Promise.resolve({content: [{id: 101, name: 'Bài cũ', topicCategory: {id: 5}}], totalElements: 1});
        },
        saveCategory(draft) { saves.push(draft); return Promise.resolve(true); }
    };
    const workspace = new Controller({$on() {}}, {}, {open: () => ({result: Promise.resolve(), close() {}})},
        {get: () => '{"id":7,"roles":[{"name":"ROLE_VIEWER"}]}'},
        {search: (...args) => args.length ? {replace() {}} : {category: '5'}}, {},
        {getVocabularyUsage: () => Promise.resolve({role: 'VIEWER'})}, lessons, {success() {}}, {}, {});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(categoryReads[0].personalLibrary, true);
    assert.equal(workspace.canManageCategories, true);
    assert.equal(workspace.canDelete, false);
    assert.equal(workspace.lessonCategory.id, 'uncategorized');
    assert.equal(lessonReads[0].withoutCategory, true);
    assert.equal(workspace.lessons[0].id, 101);
    workspace.editCategory();
    workspace.categoryDraft.name = 'Nhóm mới';
    await workspace.saveCategory();
    assert.equal(saves[0].parentId, null);
    assert.equal(saves[0].name, 'Nhóm mới');
});
