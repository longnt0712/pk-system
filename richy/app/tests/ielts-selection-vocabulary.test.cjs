const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function vocabularyService(responses, session = {capture: () => 1, isCurrent: () => true}) {
    let Service;
    const calls = [];
    const angular = {
        module() { return {service(name, fn) { Service = fn; }}; },
        isArray: Array.isArray,
        isFunction: value => typeof value === 'function'
    };
    function http(config) {
        calls.push(config);
        return Promise.resolve(responses.shift()).then(data => ({data}));
    }
    http.post = (url, data, options) => http({method: 'POST', url, data, ...options});
    nodeVm.runInNewContext(read('question/business/QuestionService.js'), {angular});
    const api = new Service(http, {reject: Promise.reject.bind(Promise)}, null, {
        api: {baseUrl: '/', apiV1Url: 'api/'}
    }, {}, session);
    return {api, calls};
}

function selectionMenu() {
    const source = read('question/controllers/IELTSReadingActualTestController.js');
    const vm = {
        currentUser: {id: 7, roles: [{name: 'ROLE_VIEWER'}]},
        study: true,
        active: true,
        isStudyMode() { return this.study; }
    };
    const pending = [];
    let selectionText = '';
    const context = nodeVm.createContext({
        vm,
        isActiveTestNavigationProtected: () => vm.active,
        service: {
            saveUnassignedVocabularyWord(word, userId) {
                return new Promise((resolve, reject) => pending.push({word, userId, resolve, reject}));
            }
        },
        $scope: {},
        window: {
            innerWidth: 360,
            navigator: {userAgent: 'iPhone'},
            getSelection() {
                return {
                    rangeCount: selectionText ? 1 : 0,
                    toString: () => selectionText,
                    removeAllRanges() { selectionText = ''; },
                    getRangeAt: () => ({
                        cloneRange() { return this; },
                        getBoundingClientRect: () => ({left: 280, top: 150, bottom: 170, width: 25})
                    })
                };
            }
        },
        closestElement: () => null,
        selectionBelongsToReadingTest: () => true,
        updateSelectionState() {}
    });
    const state = source.indexOf('        function hideSelectionMenu(');
    nodeVm.runInContext(source.slice(state, source.indexOf('        function updateSelectionState(', state)), context);
    const show = source.indexOf('        $scope.showSelectionTools =');
    nodeVm.runInContext(source.slice(show, source.indexOf('        vm.openQuestionIfNotSelecting', show)), context);
    return {
        vm,
        pending,
        select(text) {
            selectionText = text;
            context.$scope.showSelectionTools({target: {}});
            return vm.selectionVocabulary;
        }
    };
}

test('selected text uses exact lookup before creating a personal card without a topic', async () => {
    const {api, calls} = vocabularyService([{content: []}, {id: 17, user: {id: 7}}]);
    assert.equal((await api.saveUnassignedVocabularyWord('Weather forecast', 7)).alreadyExists, false);
    assert.equal(calls[0].url, '/api/question/vocabulary/get_page/1/1');
    assert.deepEqual(plain(calls[0].data), {textSearch: 'Weather forecast', findExactWord: true});
    assert.equal(calls[1].url, '/api/question/save');
    assert.deepEqual(plain(calls[1].data), {
        question: 'Weather forecast', userId: 7, questionType: {id: 6}, status: 1, questionTopics: []
    });
    assert.ok(calls.every(call => call.handleErrorsLocally));
});

test('an existing word is accepted without writing and a malformed response never confirms a save', async () => {
    const existing = vocabularyService([{content: [{id: 17}]}]);
    assert.equal((await existing.api.saveUnassignedVocabularyWord('weather', 7)).alreadyExists, true);
    assert.equal(existing.calls.length, 1);
    const invalidLookup = vocabularyService([{}]);
    await assert.rejects(invalidLookup.api.saveUnassignedVocabularyWord('weather', 7), /Chưa kiểm tra/);
    assert.equal(invalidLookup.calls.length, 1);
    const missingId = vocabularyService([{content: []}, {message: 'Kho đã đầy'}]);
    await assert.rejects(missingId.api.saveUnassignedVocabularyWord('weather', 7), /Kho đã đầy/);
});

test('simultaneous saves share one exact lookup and a session change prevents writing', async () => {
    let resolveLookup;
    const lookup = new Promise(resolve => { resolveLookup = resolve; });
    const sameSession = vocabularyService([lookup, {id: 17, user: {id: 7}}]);
    const first = sameSession.api.saveUnassignedVocabularyWord('Wind', 7);
    assert.equal(sameSession.api.saveUnassignedVocabularyWord('wind', 7), first);
    resolveLookup({content: []});
    await first;
    assert.equal(sameSession.calls.length, 2);

    let marker = 1;
    const switched = vocabularyService([{content: []}], {capture: () => marker, isCurrent: captured => captured === marker});
    const pending = switched.api.saveUnassignedVocabularyWord('wind', 7);
    marker++;
    await assert.rejects(pending, /Phiên đăng nhập đã đổi/);
    assert.equal(switched.calls.length, 1);
});

test('the selection menu offers save only in active Study or an assigned test', () => {
    const {vm, select} = selectionMenu();
    assert.equal(select('Wind   speed').word, 'Wind speed');
    vm.study = false;
    assert.equal(select('wind'), null);
    vm.assignmentTaskId = 10;
    assert.equal(select('wind').word, 'wind');
    vm.isPreviewMode = true;
    assert.equal(select('wind'), null);
    vm.isPreviewMode = false;
    vm.active = false;
    assert.equal(select('wind'), null);
});

test('the check waits for confirmation, follows the saved word and allows retry', async () => {
    const {vm, pending, select} = selectionMenu();
    const wind = select('Wind speed');
    const save = vm.saveSelectionVocabulary();
    assert.equal(wind.status, 'saving');
    const rain = select('rain');
    assert.equal(select('wind speed'), wind);
    assert.equal(vm.saveSelectionVocabulary(), undefined);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].word, 'Wind speed');
    assert.equal(pending[0].userId, 7);
    select('rain');
    pending[0].reject(new Error('Mất kết nối'));
    await save;
    assert.equal(wind.status, 'error');
    assert.equal(rain.status, undefined);
    const retryWord = select('wind speed');
    const retry = vm.saveSelectionVocabulary();
    assert.equal(retryWord.status, 'saving');
    pending[1].resolve({alreadyExists: false});
    await retry;
    assert.equal(retryWord.status, 'saved');
    assert.equal(vm.selectionVocabulary, retryWord);
});

