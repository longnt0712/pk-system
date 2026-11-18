const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const app = join(__dirname, '..');
const read = (file) => readFileSync(join(app, file), 'utf8');
const library = read('question/controllers/IELTSTestLibraryController.js');

function catalog(path, roles, service = {}) {
    let Controller;
    let config;
    const angular = {
        noop() {},
        forEach(items, callback) { (items || []).forEach(callback); },
        module: () => ({controller: (_, impl) => { Controller = impl; }})
    };
    vm.runInNewContext(library, {angular, window: {APP_VERSION: 'test'}});
    const page = new Controller({settings: {layout: {}}}, { $on() {} }, {path: () => path},
        {addEventListener() {}, localStorage: {length: 0}}, {get: () => JSON.stringify({roles})},
        {}, {getLearningDrafts: () => Promise.resolve([]), getPageForTests: () => Promise.resolve({}), ...service},
        {start() {}, stop() {}}, {bindUrl() {}, applyFilter() {}},
        {open(options) { config = options; return {result: Promise.resolve()}; }});
    return { page, config: () => config };
}

const flushPromises = () => new Promise(setImmediate);

test('the Reading student can choose a linked lesson but cannot open the editing modal', async () => {
    const testRow = {id: 80, title: 'Reading Test 01'};
    const learner = catalog('/ielts_reading_tests', [{name: 'ROLE_VIEWER'}], {
        getReadingVocabularyLessons: () => Promise.resolve([{id: 42, name: 'Passage 1'}])
    });
    learner.page.openReadingVocabulary(testRow, true);
    assert.equal(learner.config(), undefined);
    learner.page.openReadingVocabulary(testRow, false);
    const picker = new (learner.config().controller.at(-1))({});
    await flushPromises();
    assert.equal(picker.selected[0].name, 'Passage 1');
    assert.equal(picker.lessonUrl(picker.selected[0]), 'daily-vocab/0?practiceTestId=80&practiceTopicId=42');
    assert.equal(catalog('/ielts_listening_tests', []).page.hasReadingVocabulary, false);
});

test('the admin keeps selections across folders and saves them together', async () => {
    let saved;
    let closed = false;
    const oldLesson = {id: 41, name: 'Passage 1'};
    const passage = {id: 42, name: 'Passage 2'};
    const summary = {id: 43, name: 'Tổng hợp'};
    const folders = [{id: 10, name: 'Cambridge'}, {id: 20, name: 'IELTS 10', parentId: 10}];
    const admin = catalog('/ielts_reading_tests', [{name: 'ROLE_ADMIN'}], {
        getReadingVocabularyLessons: () => Promise.resolve([oldLesson]),
        getPageTopicCategory: () => Promise.resolve({content: folders, totalPages: 1}),
        getReadingVocabularyOptions: (id) => Promise.resolve({content: [id === 10 ? passage : summary], totalPages: 1}),
        saveReadingVocabularyLessons: (id, selected) => {
            saved = [id, Array.from(selected)];
            return Promise.resolve();
        }
    });
    admin.page.openReadingVocabulary({id: 80, title: 'Reading Test 01'}, true);
    const picker = new (admin.config().controller.at(-1))({close() { closed = true; }});
    await flushPromises();
    assert.equal(picker.categories[1].path, 'Cambridge / IELTS 10');
    picker.category = folders[0];
    picker.categoryChanged();
    await flushPromises();
    picker.toggle(picker.options[0]);
    picker.category = folders[1];
    picker.categoryChanged();
    await flushPromises();
    picker.toggle(picker.options[0]);
    picker.save();
    await flushPromises();
    assert.deepEqual(saved, [80, [41, 42, 43]]);
    assert.equal(closed, true);
});

test('the linked practice URL resolves a lesson and fills the corresponding source and folder', async () => {
    const controller = read('question/controllers/DailyVocabController.js');
    const state = read('question/question.module.js');
    const setupStart = controller.indexOf('        vm.assignmentLaunch =');
    const setupEnd = controller.indexOf('        // ===', setupStart);
    const start = controller.indexOf('        function initializeDailyVocabFromDrafts()');
    const end = controller.indexOf('        if (dailyLearningDraftsReady', start);
    assert.ok(state.includes('practiceTestId&practiceTopicId'));
    const categoryStart = controller.indexOf('        var topicRequestGeneration');
    const categoryEnd = controller.indexOf('        vm.chooseUsers =', categoryStart);
    const lesson = {id: 42, sourceUserId: 66, sourceUserName: 'Vocabulary', topicCategory: {id: 20}};
    let loaded;
    const page = {
        currentUser: {id: 100},
        users: [],
        searchDto: {},
        searchTopicDto: {},
        searchTopicCategory: {},
        searchTopicChange() { loaded = this.selectedTopicToSearch[0]; }
    };
    const context = vm.createContext({
        vm: page,
        window: {sessionStorage: {getItem() { return null; }}},
        $stateParams: {practiceTestId: '80', practiceTopicId: '42'},
        activeDailyResumeDraft: null,
        activeDailyDraftKey() { return 'draft'; },
        restoreDailyDraft() {},
        blockUI: {start() {}, stop() {}},
        buildCategoryTree() {},
        expandCategoryPath() {},
        chooseActiveDailyResume() { assert.fail('linked practice should use the selected lesson'); },
        findById(items, id) { return items.find((item) => String(item.id) === String(id)); },
        service: {
            getReadingVocabularyLessons(id) {
                assert.equal(id, '80');
                return Promise.resolve([lesson]);
            },
            getPageTopicCategory() {
                return Promise.resolve({content: [{id: 10, name: 'Grade 6'}, lesson.topicCategory], totalPages: 1});
            },
            getTopicsForGames(search) {
                assert.equal(search.userId, 66);
                assert.equal(search.topicCategory.id, 20);
                return Promise.resolve({content: [lesson]});
            }
        }
    });
    vm.runInContext(controller.slice(setupStart, setupEnd) + controller.slice(categoryStart, categoryEnd)
        + controller.slice(start, end) + 'initializeDailyVocabFromDrafts();', context);
    await flushPromises();
    assert.equal(page.assignmentLaunch.taskId, null);
    assert.equal(page.selectedUser.name, 'Vocabulary');
    assert.equal(page.searchTopicDto.userId, 66);
    assert.equal(page.searchTopicDto.topicCategory.id, 20);
    assert.equal(loaded.id, 42);
});
