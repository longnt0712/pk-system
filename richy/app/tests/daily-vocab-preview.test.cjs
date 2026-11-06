const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const controller = fs.readFileSync(path.join(__dirname, '../question/controllers/DailyVocabController.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname, '../question/views/daily_vocab.html'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const church = {id: 11, name: '  CHURCH  '};
const grade = {id: 6, name: 'Grade 6'};
const cards = (first, count) => Array.from({length: count}, (_, index) => {
    const id = first + index;
    return {id, question: 'word ' + id, motherTongue: 'nghĩa ' + id, pronounce: '/wɜːd/'};
});

function storage() {
    const values = new Map();
    return {
        get length() { return values.size; },
        key(index) { return [...values.keys()][index]; },
        getItem(key) { return values.get(key) || null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
}

async function setup({category = church, resume = false, legacyTopic = false, assigned = false} = {}) {
    let Controller, previewScroll;
    const calls = {pages: [], dialogs: [], speech: [], audio: [], drafts: [], errors: [], timers: []};
    const topic = {id: 101, name: 'Bài 1', ...(legacyTopic ? {} : {topicCategory: category})};
    const first = cards(1, resume ? 1 : 50);
    const localStorage = storage();
    const sessionStorage = storage();
    if (resume) {
        const key = 'daily-vocab-active:v1:7';
        localStorage.setItem(key, JSON.stringify({
            version: 1, ownerId: 7, savedAt: Date.now(), runId: 'run', categoryId: category.id,
            topicIds: [topic.id], questions: first, rawQuestions: first, duration: 400, counter: 300,
            dailyPreparedRawCount: 1, allQuestionsLoaded: true
        }));
        sessionStorage.setItem('daily-vocab-dashboard-resume:v1:7', key);
    }

    function timeout(callback) {
        const timer = {callback, cancelled: false};
        calls.timers.push(timer);
        return timer;
    }
    timeout.cancel = timer => { timer.cancelled = true; };
    const listeners = {};
    const scope = {$on(event, callback) { listeners[event] = callback; }, $evalAsync(callback) { callback(); }};
    const angular = {
        module() { return {
            controller(name, value) { Controller = value; return this; },
            directive(name, factory) { if (name === 'dailyWordPreviewScroll') previewScroll = factory; return this; }
        }; },
        isArray: Array.isArray, isFunction: value => typeof value === 'function',
        isDefined: value => value !== undefined, copy: structuredClone, noop() {},
        forEach(values, callback) { Object.entries(values || {}).forEach(([key, value]) => callback(value, key)); }
    };
    const window = {
        localStorage, sessionStorage, addEventListener() {}, removeEventListener() {},
        EnglishSpeech: {speak(text, options) { calls.speech.push({text, lang: options.lang}); }, cancel() {}}
    };
    const document = {addEventListener() {}, removeEventListener() {}, getElementById(id) {
        return {pause() {}, play() { calls.audio.push(id); return Promise.resolve(); }};
    }};
    const random = Object.create(Math);
    random.random = () => 0;
    nodeVm.runInNewContext(controller, {angular, window, document, Math: random});

    const service = {
        getLearningDrafts: async () => [],
        getAssignedTask: async () => ({activityType: 'DAILY_VOCAB', topicId: 101, categoryId: category.id, canStartNewAttempt: true}),
        saveLearningDraft: async request => { calls.drafts.push(JSON.parse(request.payload)); },
        deleteLearningDraft: async () => true,
        getPageTopicCategory: async () => ({content: [category]}),
        getTopicsForGames: async () => ({content: [topic]}),
        getPageForDailyVocab(dto, page, pageSize) {
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            calls.pages.push({page, pageSize, topicId: dto.questionTopics[0].topic.id, resolve, reject});
            if (page === 1) {
                resolve({content: first, last: resume, totalPages: resume ? 1 : 3, totalElements: resume ? 1 : 102});
            }
            return promise;
        }
    };
    const modal = {open(options) {
        let reject;
        const result = new Promise((resolve, no) => { reject = no; });
        const dialog = {options, result, dismissed: false, dismiss() { this.dismissed = true; reject('closed'); }};
        calls.dialogs.push(dialog);
        return dialog;
    }};
    const toastr = {warning() {}, success() {}, error(message) { calls.errors.push(message); }};
    const vm = new Controller({settings: {layout: {}}}, scope, toastr, timeout, {}, service,
        assigned ? {assignmentTaskId: 55, assignmentTopicId: 101} : {}, {start() {}, stop() {}},
        {get() { return '{"id":7}'; }}, modal);
    assert.equal(vm.canPreviewDailyWords(), false);
    await tick();
    if (!resume && !assigned) {
        vm.selectedTopicToSearch = [topic];
        vm.searchTopicChange();
        await tick();
    }
    assert.deepEqual(calls.errors, []);
    return {vm, calls, random, previewScroll, destroy: listeners.$destroy};
}

function attachPreviewScroll(vm, factory) {
    const body = Object.assign(new EventTarget(), {clientHeight: 500, scrollHeight: 500, scrollTop: 0});
    const viewport = new EventTarget();
    const timers = [];
    let afterRender, destroy;
    const scope = {
        vm,
        $evalAsync(callback) { callback(); },
        $watchGroup(expressions, callback) { afterRender = callback; },
        $on(event, callback) { if (event === '$destroy') destroy = callback; }
    };
    function timeout(callback) {
        const timer = {callback, cancelled: false};
        timers.push(timer);
        return timer;
    }
    timeout.cancel = timer => { timer.cancelled = true; };
    factory(timeout, viewport).link(scope, [body]);
    return {
        render(height) { body.scrollHeight = height; afterRender(); },
        scrollTo(top) { body.scrollTop = top; body.dispatchEvent(new Event('scroll')); },
        resize() { viewport.dispatchEvent(new Event('resize')); },
        flush() { timers.splice(0).forEach(timer => { if (!timer.cancelled) timer.callback(); }); },
        destroy() { destroy(); }
    };
}

test('the word list loads one batch when scrolling near the end and shares the cache with the round', async () => {
    const {vm, calls, previewScroll} = await setup();
    assert.equal(vm.canPreviewDailyWords(), true);
    vm.openDailyWordPreview();
    assert.equal(calls.dialogs[0].options.templateUrl, 'daily-vocab-word-preview.html');
    assert.equal(calls.dialogs[0].options.windowClass, 'daily-word-preview-window');
    assert.equal(vm.dailyWordPreviewLimit, 50);
    const scroll = attachPreviewScroll(vm, previewScroll);
    scroll.render(3000);
    scroll.flush();
    scroll.scrollTo(400);
    scroll.flush();
    assert.deepEqual(calls.pages.map(call => call.page), [1]);

    scroll.scrollTo(2375);
    scroll.scrollTo(2390);
    scroll.flush();
    scroll.scrollTo(2500);
    scroll.flush();
    assert.deepEqual(calls.pages.map(call => call.page), [1, 2]);
    calls.pages[1].resolve({content: cards(51, 50), totalPages: 3, totalElements: 102});
    await tick();
    scroll.render(5500);
    scroll.flush();
    assert.equal(calls.pages.length, 2);
    assert.equal(vm.rawQuestions.length, 100);
    assert.equal(vm.dailyWordPreviewLimit, 100);
    assert.equal(vm.loadedCardCount, 50, 'preview does not build game questions');

    scroll.scrollTo(4900);
    scroll.flush();
    assert.deepEqual(calls.pages.map(call => call.page), [1, 2, 3]);
    calls.pages[2].resolve({content: [cards(101, 1)[0], {id: 102, question: 'incomplete'}, cards(25, 1)[0]], last: true});
    await tick();
    scroll.render(5550);
    scroll.scrollTo(5050);
    scroll.flush();
    assert.equal(calls.pages.length, 3);
    assert.equal(vm.totalCard, 101);
    assert.equal(vm.allQuestionsLoaded, true);
    assert.equal(vm.rawQuestions.at(-1).question, 'word 101');
    assert.equal(vm.rawQuestions.filter(word => word.id === 25).length, 1);

    vm.startDailyVocab();
    assert.equal(calls.dialogs[0].dismissed, true);
    assert.equal(vm.canPreviewDailyWords(), false);
    assert.equal(calls.pages.length, 3, 'the round reuses the previewed pages');
    vm.openDailyWordPreview();
    assert.equal(calls.dialogs.length, 1);
    vm.stopDailyVocabTimer();
    assert.equal(vm.canPreviewDailyWords(), false);
    vm.resetDailyVocabTimer();
    assert.equal(vm.canPreviewDailyWords(), true);
});

test('a short preview can load without a scrollbar and teardown cancels a scheduled check', async () => {
    const {vm, calls, previewScroll} = await setup();
    vm.openDailyWordPreview();
    const scroll = attachPreviewScroll(vm, previewScroll);
    scroll.render(500);
    scroll.flush();
    assert.deepEqual(calls.pages.map(call => call.page), [1, 2]);
    calls.pages[1].resolve({content: cards(51, 50), totalPages: 3});
    await tick();
    scroll.render(500);
    scroll.destroy();
    scroll.scrollTo(0);
    scroll.resize();
    scroll.flush();
    assert.equal(calls.pages.length, 2);
});

test('preview failure can retry, and starting while a page is pending ignores the old response', async () => {
    const {vm, calls} = await setup({assigned: true});
    vm.openDailyWordPreview();
    const failed = vm.loadMoreDailyPreviewWords();
    calls.pages[1].reject(new Error('offline'));
    await failed;
    assert.equal(vm.dailyWordPreviewError, true);
    assert.equal(vm.dailyLazyLoadError, false);

    vm.loadMoreDailyPreviewWords();
    assert.equal(calls.pages.length, 2, 'scrolling does not keep retrying failed pages');
    const retried = vm.loadMoreDailyPreviewWords(true);
    assert.equal(calls.pages[2].page, 2);
    await vm.startDailyVocab();
    assert.equal(calls.dialogs[0].dismissed, true);
    assert.equal(vm.canPreviewDailyWords(), false);
    assert.equal(calls.pages[3].page, 2);
    calls.pages[2].resolve({content: cards(700, 50), totalPages: 3, totalElements: 102});
    await retried;
    assert.equal(vm.rawQuestions.length, 50);
    calls.pages[3].resolve({content: cards(51, 50), totalPages: 3, totalElements: 102});
    await tick();
    assert.equal(vm.rawQuestions[50].id, 51);
});

test('a resumed lesson stays locked and Church feedback reads only Vietnamese encouragement', async () => {
    const {vm, calls, random} = await setup({resume: true});
    assert.equal(vm.dailyVocabRunning, true);
    assert.equal(vm.canPreviewDailyWords(), false);
    vm.searchTopicDto.topicCategory = grade;
    const expected = ['Cố lên!', 'Bạn làm được!', 'Một chút nữa thôi.', 'Chúa ở cùng bạn.', 'Yên tâm.'];
    expected.forEach((phrase, index) => {
        random.random = () => (index + 0.5) / expected.length;
        vm.sayingWhenWrong();
    });
    assert.deepEqual(calls.speech, expected.map(text => ({text, lang: 'vi-VN'})));
    assert.deepEqual(calls.audio, []);
    vm.voiceEnabled = false;
    vm.sayingWhenWrong();
    assert.equal(calls.speech.length, 5);
    assert.deepEqual(calls.audio, []);
});

test('legacy topics use the selected Church category and other lessons retain their usual sound', async () => {
    const legacy = await setup({legacyTopic: true});
    legacy.vm.searchTopicDto.topicCategory = grade;
    legacy.vm.startDailyVocab();
    legacy.vm.sayingWhenWrong();
    assert.deepEqual(legacy.calls.speech.at(-1), {text: 'Cố lên!', lang: 'vi-VN'});
    assert.equal(legacy.calls.drafts.at(-1).categoryId, church.id);
    assert.deepEqual(legacy.calls.drafts.at(-1).topicIds, [101]);

    const other = await setup({category: grade});
    other.vm.searchTopicDto.topicCategory = church;
    other.vm.sayingWhenWrong();
    assert.deepEqual(other.calls.audio, ['sai']);
    assert.deepEqual(other.calls.speech, []);
});

test('the preview UI is hidden when locked and displays words, pronunciation and meaning', () => {
    assert.match(view, /ng-if="vm\.canPreviewDailyWords\(\)"\s+ng-click="vm\.openDailyWordPreview\(\)"/);
    for (const field of ['question', 'pronounce', 'motherTongue']) assert.ok(view.includes('{{word.' + field + '}}'));
    assert.match(view, /id="daily-vocab-word-preview-title"/);
});

test('the vocabulary dialog keeps scrolling inside the list despite the global modal overflow rule', () => {
    assert.match(view, /\.daily-word-preview-window \.modal-content\s*\{[^}]*overflow:\s*hidden !important/);
    assert.match(view, /\.daily-word-preview\s*\{[^}]*flex-direction:\s*column;[^}]*max-height:\s*calc\(100dvh - 24px\)/);
    assert.match(view, /\.daily-word-preview > \.modal-header,\s*\.daily-word-preview > \.modal-footer\s*\{[^}]*flex:\s*0 0 auto/);
    assert.match(view, /\.daily-word-preview > \.modal-body\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto !important/);
    assert.match(view, /class="modal-body" tabindex="0" role="region"[^>]*daily-word-preview-scroll>\s*<ol class="daily-word-preview-list"/);
    assert.doesNotMatch(view, /Xem thêm từ/);
    assert.match(view, /ng-if="vm\.dailyWordPreviewError"\s+ng-click="vm\.loadMoreDailyPreviewWords\(true\)">\s*Thử lại/);
});
