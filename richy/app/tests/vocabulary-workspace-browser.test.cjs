const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const css = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css', 'assets/css/external/select.min.css',
    'assets/fontawesome/css/all.css', 'topic/vocabulary.css'].map(file => fs.readFileSync(path.join(app, file), 'utf8')).join('\n');

async function fixture(browser, {role = 'ADMIN', width = 1600, full = false, initialLesson = null, initialCategory = null, holdInitial = false, clock = false} = {}) {
    const page = await browser.newPage({viewport: {width, height: 1120}});
    const waitForInitialLesson = initialLesson && !holdInitial;
    if (clock) await page.clock.install();
    page.setDefaultTimeout(8000);
    const categories = [{id: 1, name: 'Đời sống hằng ngày'}, {id: 2, name: 'IELTS & học thuật'},
        {id: 3, name: 'Reading', parentId: 2}, {id: 4, name: 'Cambridge IELTS 19', parentId: 3},
        {id: 5, name: 'Listening', parentId: 2}, {id: 6, name: 'GRADE 12'}];
    const lessons = [{id: 101, name: 'Little things, every day', topicCategory: categories[0]},
        {id: 102, name: 'A world to discover', topicCategory: categories[0]},
        {id: 103, name: 'Work, dreams & ambitions', topicCategory: categories[1]},
        {id: 104, name: 'Feelings & connections', topicCategory: categories[0]}];
    const words = [['serendipity', '/ˌser.ənˈdɪp.ə.ti/', 'Một điều tốt đẹp tình cờ tìm thấy', 'B2'],
        ['embrace', '/ɪmˈbreɪs/', 'Đón nhận, trân trọng', 'B1'], ['mindful', '/ˈmaɪnd.fəl/', 'Chú tâm, lưu tâm đến hiện tại', 'B2'],
        ['little by little', '/ˈlɪt.əl baɪ ˈlɪt.əl/', 'Từng chút một, dần dần', 'A2'], ['wanderlust', '/ˈwɒn.də.lʌst/', 'Niềm khao khát đi khám phá', 'C1'],
        ['cherish', '/ˈtʃer.ɪʃ/', 'Trân quý, yêu thương và gìn giữ', 'B2'], ['bloom', '/bluːm/', 'Nở hoa, phát triển rực rỡ', 'B1'],
        ['a fresh start', '/ə freʃ stɑːt/', 'Một khởi đầu mới', 'A2'], ['grateful', '/ˈɡreɪt.fəl/', 'Biết ơn, cảm kích', 'B1'],
        ['curiosity', '/ˌkjʊə.riˈɒs.ə.ti/', 'Sự tò mò, ham tìm hiểu', 'B2'], ['take a break', '/teɪk ə breɪk/', 'Nghỉ ngơi một chút', 'A2'], ['slow down', '/sləʊ daʊn/', 'Chậm lại, thong thả hơn', 'A2']];
    const state = {requests: [], saves: [], errors: [], full, lessons, categories, cards: words.map((word, index) =>
        ({id: index + 1, question: word[0], pronounce: word[1], motherTongue: word[2], level: word[3], status: index === 11 ? 5 : 1,
            questionTopics: index === 10 ? [] : [{topic: lessons[index === 4 ? 1 : 0]}]}))};
    page.on('pageerror', error => state.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) state.errors.push(message.text()); });
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const json = (data, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(data)});
        if (url.pathname.startsWith('/api/')) state.requests.push({url: url.pathname, data: request.method() === 'POST' ? request.postDataJSON() : null});
        if (url.pathname === '/api/question/vocabulary_usage') return json({role, wordCount: state.full ? 5000 : state.cards.length, wordLimit: role === 'ADMIN' ? -1 : role === 'USER' ? 10000 : 5000,
            topicCount: state.full ? 50 : lessons.length, topicLimit: role === 'ADMIN' ? -1 : role === 'USER' ? 100 : 50,
            wordLimitReached: state.full, topicLimitReached: state.full,
            wordLimitMessage: 'Bạn đã có 5000/5000 thẻ từ vựng. Bạn vẫn có thể sửa và học các thẻ đã có. Liên hệ quản trị viên để nâng hạn mức.',
            topicLimitMessage: 'Bạn đã có 50/50 bài từ vựng. Bạn vẫn có thể sửa và học các bài đã có. Liên hệ quản trị viên để được hỗ trợ.'});
        if (url.pathname.startsWith('/api/topic_category/get_page/')) return json({content: categories, totalPages: 1});
        if (url.pathname === '/api/topic_category/save') {
            const dto = request.postDataJSON();
            if (dto.id) Object.assign(categories.find(category => category.id === dto.id), dto);
            else categories.push({...dto, id: categories.length + 1});
            return json(true);
        }
        if (url.pathname.startsWith('/api/topic/get_page/')) {
            const dto = request.postDataJSON(), [pageIndex, pageSize] = url.pathname.split('/').slice(-2).map(Number);
            if (state.holdCategory === dto.topicCategory?.id && state.holdCategory) await new Promise(resolve => { state.releaseCategory = resolve; });
            const list = lessons.filter(lesson => (!dto.textSearch || lesson.name.toLowerCase().includes(dto.textSearch.toLowerCase())) &&
                (!dto.withoutCategory || !lesson.topicCategory) && (!dto.topicCategory || lesson.topicCategory?.id === dto.topicCategory.id));
            return json({content: list.slice((pageIndex - 1) * pageSize, pageIndex * pageSize), totalElements: list.length});
        }
        if (url.pathname.startsWith('/api/topic/get_one/')) {
            if (holdInitial) { holdInitial = false; await new Promise(resolve => { state.releaseInitial = resolve; }); }
            return json(lessons.find(lesson => lesson.id === Number(url.pathname.split('/').at(-1))));
        }
        if (url.pathname === '/api/topic/save') { const dto = request.postDataJSON(); dto.id = dto.id || 105; state.saves.push(dto); lessons.push(dto); return json(dto); }
        if (url.pathname.startsWith('/api/topic/delete/')) {
            const id = Number(url.pathname.split('/').at(-1)); lessons.splice(lessons.findIndex(lesson => lesson.id === id), 1);
            state.cards.forEach(card => { card.questionTopics = card.questionTopics.filter(link => link.topic.id !== id); }); return json(true);
        }
        if (url.pathname.startsWith('/api/question/vocabulary/get_page/')) {
            const dto = request.postDataJSON(), numbers = url.pathname.split('/').slice(-2).map(Number);
            if (state.holdUnassigned && dto.withoutTopics) await new Promise(resolve => { state.releaseUnassigned = resolve; });
            if (state.holdLesson === dto.topicId) await new Promise(resolve => { state.releaseLesson = resolve; });
            const rows = state.cards.filter(card => (!dto.topicId || card.questionTopics.some(link => link.topic.id === dto.topicId)) &&
                (!dto.withoutTopics || !card.questionTopics.length) && (!dto.status || (dto.status === 3 ? card.status !== 5 : card.status === dto.status)) &&
                (!dto.textSearch || (dto.findExactWord ? card.question.toLowerCase() === dto.textSearch.trim().toLowerCase() :
                    (card.question + ' ' + card.motherTongue).toLowerCase().includes(dto.textSearch.toLowerCase()))));
            return json({content: rows.slice((numbers[0]-1)*numbers[1], numbers[0]*numbers[1]), totalElements: rows.length});
        }
        if (url.pathname === '/api/question/save') {
            const dto = request.postDataJSON(); state.saves.push(dto);
            if (state.failSave) return json({message: 'Bạn đã đạt hạn mức. Nội dung được giữ lại.'});
            dto.id = dto.id || 20; dto.questionTopics = dto.questionTopics || [];
            state.cards = state.cards.filter(card => card.id !== dto.id); state.cards.unshift(dto); return json(dto);
        }
        if (url.pathname.startsWith('/api/question/delete/')) { const id = Number(url.pathname.split('/').at(-1)); state.cards = state.cards.filter(card => card.id !== id); return json(true); }
        if (url.pathname.startsWith('/question/views/')) return route.fulfill({contentType: 'text/html', body: fs.readFileSync(path.join(app, url.pathname), 'utf8')});
        if (url.pathname.includes('/webfonts/')) return route.fulfill({body: fs.readFileSync(path.join(app, 'assets/fontawesome/webfonts', path.basename(url.pathname)))});
        return route.fulfill({contentType: 'text/html', body: '<html><body></body></html>'});
    });
    const search = new URLSearchParams();
    if (initialCategory) search.set('category', initialCategory);
    if (initialLesson) search.set('lesson', initialLesson);
    await page.goto('http://vocabulary.test/topics' + (search.size ? '?' + search : ''));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + css +
        'body{padding:24px!important;background:#f3f4f0} @media(max-width:767px){body{padding:8px!important}}</style></head><body><div ng-controller="VocabularyController as vm">' +
        fs.readFileSync(path.join(app, 'topic/views/vocabulary.html'), 'utf8') + '</div></body></html>');
    for (const file of ['jquery.min.js', 'angular.min.js', 'angular-sanitize.min.js', 'ui-bootstrap-tpls.min.js', 'select.min.js']) await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
    await page.evaluate(role => {
        angular.module('Hrm.Question', []); angular.module('Hrm.Topic', []);
        angular.module('Fixture', ['Hrm.Question', 'Hrm.Topic', 'ui.bootstrap', 'ngSanitize', 'ui.select'])
            .config(['$locationProvider', function (provider) { provider.html5Mode({enabled: true, requireBase: false}); }])
            .value('settings', {isAdmin: role === 'ADMIN', api: {baseUrl: '/', apiV1Url: 'api/'}})
            .value('$cookies', {get: () => JSON.stringify({id: 7, username: 'learner', roles: [{name: 'ROLE_' + role}]})})
            .value('toastr', {success() {}, info() {}, warning() {}, error() {}})
            .factory('Utilities', ['$http', function ($http) { return {
                resolveAlt: (url, method, params, data) => $http({url, method, data}).then(response => response.data),
                resolve: (url, method) => $http({url, method}).then(response => response.data)}; }]);
    }, role);
    for (const file of ['question/business/QuestionService.js', 'topic/business/TopicService.js', 'question/controllers/QuestionExcelImportController.js', 'topic/controllers/VocabularyController.js']) await page.addScriptTag({path: path.join(app, file)});
    await page.evaluate(() => { angular.bootstrap(document, ['Fixture']); window.vm = angular.element(document.querySelector('[ng-controller]')).controller(); });
    await page.waitForFunction(() => !window.vm.categoriesLoading);
    if (waitForInitialLesson) await page.locator('#vocabulary-heading').waitFor();
    return {page, state};
}

async function selectCategory(page, name = 'Đời sống hằng ngày') {
    const sidebar = page.locator('.vw-sidebar');
    if (!await sidebar.isVisible()) await page.locator('.vw-mobile-picker').click();
    await sidebar.getByRole('button', {name, exact: true}).click();
}

test('categories open before lessons and the tree shows ancestors, direct lessons and uncategorized lessons separately', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [1366, 390]) {
            const {page, state} = await fixture(browser, {width});
            const sidebar = page.locator('.vw-sidebar');
            assert.equal(await page.locator('.vw-lesson,.vw-word-card').count(), 0);
            assert.ok(!state.requests.some(request => /\/api\/(topic\/get_page|question\/vocabulary\/get_page)/.test(request.url)));
            assert.equal(await sidebar.getByRole('button', {name: 'Reading', exact: true}).count(), 0);
            await sidebar.getByRole('button', {name: 'Mở rộng IELTS & học thuật', exact: true}).click();
            assert.equal(await sidebar.getByRole('button', {name: 'Reading', exact: true}).isVisible(), true);
            assert.equal(await page.locator('.vw-lesson').count(), 0, 'expanding a folder does not open its lessons');
            const search = page.getByLabel('Tìm nhóm bài', {exact: true});
            await search.fill('cambridge');
            assert.equal(await sidebar.getByRole('button', {name: 'Cambridge IELTS 19', exact: true}).isVisible(), true);
            assert.equal(await sidebar.getByRole('button', {name: 'IELTS & học thuật', exact: true}).isVisible(), true);
            await search.clear();

            state.lessons.push({id: 120, name: 'Cambridge 19 · Test 1 · Reading', topicCategory: state.categories[3]},
                {id: 121, name: 'Cambridge 19 · Test 2 · Reading', topicCategory: state.categories[3]},
                {id: 122, name: 'Bài cũ chưa phân nhóm', topicCategory: null});
            await selectCategory(page, 'IELTS & học thuật');
            await page.locator('.vw-lesson').first().waitFor();
            assert.equal(await page.locator('.vw-lesson').count(), 1);
            await page.locator('.vw-child-categories').getByRole('button', {name: 'Reading', exact: true}).click();
            await page.locator('.vw-child-categories').getByRole('button', {name: 'Cambridge IELTS 19', exact: true}).click();
            await page.getByRole('button', {name: /Cambridge 19 · Test 1 · Reading/}).waitFor();
            assert.equal(await page.locator('.vw-lesson').count(), 2);
            assert.match(await page.locator('.vw-breadcrumb').innerText(), /IELTS & học thuật.*Reading.*Cambridge IELTS 19/s);
            assert.equal(await page.locator('.vw-word-card').count(), 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (process.env.VOCABULARY_TREE_PREVIEW && width === 1366) {
                await page.locator('.vocab-workspace').screenshot({path: process.env.VOCABULARY_TREE_PREVIEW});
            }
            await page.getByLabel('Tìm bài từ vựng trong nhóm', {exact: true}).fill('Test 2');
            await page.waitForFunction(() => window.vm.lessons.length === 1 && window.vm.lessons[0].id === 121);
            await selectCategory(page, 'Bài chưa phân nhóm');
            await page.getByRole('button', {name: /Bài cũ chưa phân nhóm/}).waitFor();
            assert.equal(await page.locator('.vw-lesson').count(), 1);
            assert.ok(state.requests.some(request => request.url.includes('/api/topic/get_page/') && request.data.withoutCategory));
            assert.match(page.url(), /category=uncategorized/);
            assert.deepEqual(state.errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('administrators can create and move groups, and a slower group cannot overwrite the latest choice', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser);
        state.holdCategory = 1;
        await selectCategory(page);
        await page.getByText('Đang tải bài...', {exact: true}).waitFor();
        await selectCategory(page, 'IELTS & học thuật');
        await page.getByRole('button', {name: /Work, dreams/}).waitFor();
        state.holdCategory = null; state.releaseCategory();
        await page.waitForTimeout(120);
        assert.equal(await page.locator('.vw-lesson').count(), 1);
        await page.getByRole('button', {name: 'Thêm nhóm con', exact: true}).click();
        await page.getByLabel('Tên nhóm', {exact: true}).fill('Writing');
        assert.equal(await page.getByLabel('Nhóm cha', {exact: true}).locator('option:checked').innerText(), 'IELTS & học thuật');
        await page.getByRole('button', {name: 'Lưu nhóm', exact: true}).click();
        await page.locator('.vw-child-categories').getByRole('button', {name: 'Writing', exact: true}).click();
        await page.getByRole('button', {name: 'Sửa nhóm', exact: true}).click();
        assert.equal(await page.getByLabel('Nhóm cha', {exact: true}).locator('option').filter({hasText: 'Writing'}).count(), 0);
        await page.getByLabel('Nhóm cha', {exact: true}).selectOption({label: 'Đời sống hằng ngày'});
        await page.getByRole('button', {name: 'Lưu nhóm', exact: true}).click();
        await page.waitForFunction(() => window.vm.categoryPath[0]?.name === 'Đời sống hằng ngày');
        assert.equal(state.categories.find(category => category.name === 'Writing').parentId, 1);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('one workspace selects a lesson, creates a lesson with category and saves words directly inside it', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'VIEWER'});
        await selectCategory(page);
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.waitForFunction(() => window.vm.activeLesson && window.vm.activeLesson.id === 101 && !window.vm.cardsLoading);
        assert.match(await page.locator('#vocabulary-heading').innerText(), /Little things/);
        assert.ok(!await page.locator('.vw-word-card').filter({hasText: 'wanderlust'}).count());
        await page.getByRole('button', {name: 'Thêm từ', exact: true}).click();
        await page.getByLabel('Từ / cụm từ', {exact: true}).fill('stay curious');
        await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).fill('luôn ham học hỏi');
        assert.equal(await page.getByRole('button', {name: /Tùy chọn nâng cao/}).count(), 0);
        await page.getByRole('button', {name: 'Lưu từ vựng', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.deepEqual(state.saves[0].questionTopics, [{topic: {id: 101}}]);
        await page.getByRole('button', {name: 'Tạo bài từ vựng', exact: true}).click();
        await page.getByLabel('Tên bài từ vựng', {exact: true}).fill('My new vocabulary');
        await page.locator('.modal-dialog .ui-select-toggle').click();
        await page.locator('body > .vw-overlay-select.open input.ui-select-search').fill('IELTS');
        await page.getByRole('option', {name: 'IELTS & học thuật', exact: true}).click();
        await page.getByRole('button', {name: 'Lưu bài từ vựng', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.equal(state.saves[1].topicCategory.id, 2);
        assert.equal(await page.locator('#vocabulary-heading').innerText(), 'My new vocabulary');
        assert.match(await page.locator('.vw-empty').innerText(), /Từ mới sẽ được lưu ngay vào bài/);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('word modal stays compact and its searchable lesson dropdown is clickable above the footer on desktop and phone', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [1366, 390]) {
            const {page, state} = await fixture(browser, {width});
            await page.setViewportSize({width, height: 640});
            const target = {id: 120, name: 'iR.VOL5.4.PASSAGE2.Bristlecone Pines — A very long vocabulary lesson name', topicCategory: {id: 1}};
            state.lessons.push(target);
            await page.getByRole('button', {name: 'Chưa vào bài', exact: true}).click();
            await page.getByRole('button', {name: 'Thêm từ', exact: true}).click();
            const header = page.locator('.modal-dialog .vw-modal-head');
            assert.ok((await header.boundingBox()).height <= 75, 'header uses one compact row');
            assert.equal(await header.locator('p').count(), 0);
            assert.equal(await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).evaluate(node => node.tagName), 'INPUT');
            const cefr = page.getByLabel('Trình độ CEFR', {exact: true});
            assert.equal(await cefr.isVisible(), true);
            assert.match(await cefr.locator('option:checked').innerText(), /Chưa xác định/);
            await cefr.selectOption({label: 'B2'});
            await page.getByLabel('Từ / cụm từ', {exact: true}).fill('bristlecone');
            await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).fill('thông gai');
            await page.locator('.modal-dialog .vw-overlay-select .ui-select-toggle').click();
            const portal = page.locator('body > .vw-overlay-select.open');
            await portal.locator('input.ui-select-search').fill('Bristlecone');
            const option = portal.locator('.ui-select-choices-row').filter({hasText: target.name});
            await option.waitFor();
            await page.waitForTimeout(300);
            const box = await option.boundingBox();
            assert.ok(box.y >= 0 && box.y + box.height <= 640, 'the choice fits inside the viewport');
            const hit = await option.evaluate(node => {
                const box = node.getBoundingClientRect();
                return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
            });
            assert.equal(hit, true, 'the modal footer cannot cover the choice');
            await page.screenshot({path: path.join(app, '../../.tmp/vocabulary-modal-' + width + '.png'), fullPage: false});
            await option.click();
            await page.getByRole('button', {name: 'Lưu từ vựng', exact: true}).click();
            await page.locator('.modal-dialog').waitFor({state: 'hidden'});
            assert.equal(state.saves[0].level, 'B2');
            assert.deepEqual(state.saves[0].questionTopics, [{topic: {id: 120}}]);
            assert.deepEqual(state.errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('a stalled unassigned request stops loading, shows retry, and can recover without refreshing the page', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'VIEWER', clock: true});
        state.holdUnassigned = true;
        const pendingRequest = page.waitForRequest(request => request.url().includes('/vocabulary/get_page/') && request.postDataJSON().withoutTopics);
        await page.getByRole('button', {name: 'Chưa vào bài', exact: true}).click();
        await pendingRequest;
        await page.waitForFunction(() => window.vm.cardsLoading);
        await page.clock.fastForward(31000);
        await page.clock.runFor(100);
        await page.getByRole('alert').filter({hasText: 'Tải từ vựng quá 30 giây'}).waitFor();
        assert.equal(await page.locator('.vw-loading').count(), 0);
        assert.equal(await page.evaluate(() => window.vm.total), 0);
        state.holdUnassigned = false; state.releaseUnassigned();
        await page.clock.resume();
        await page.getByRole('button', {name: 'Thử lại', exact: true}).click();
        await page.locator('.vw-word-card h3').filter({hasText: 'take a break'}).waitFor();
        assert.equal(await page.locator('.vw-word-card').count(), 1);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('full quotas explain the restriction, editing still works, and failed saves preserve typed input', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'VIEWER', full: true, initialLesson: 101});
        assert.match(await page.locator('.vw-notice.warning').innerText(), /5000\/5000.*sửa và học.*quản trị viên/s);
        assert.equal(await page.getByRole('button', {name: 'Thêm từ', exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole('button', {name: 'Tạo bài từ vựng', exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole('button', {name: 'Import', exact: true}).count(), 0);
        assert.equal(await page.getByRole('button', {name: 'Export', exact: true}).count(), 1);
        await page.getByRole('button', {name: 'Sửa từ serendipity', exact: true}).click();
        await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).fill('x'.repeat(501));
        assert.equal((await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).inputValue()).length, 501);
        assert.equal(await page.getByRole('button', {name: 'Lưu từ vựng', exact: true}).isDisabled(), true);
        await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).fill('Nội dung cần giữ lại'); state.failSave = true;
        await page.getByRole('button', {name: 'Lưu từ vựng', exact: true}).click();
        await page.getByRole('alert').filter({hasText: 'Nội dung được giữ lại'}).waitFor();
        assert.equal(await page.getByLabel('Nghĩa tiếng Việt', {exact: true}).inputValue(), 'Nội dung cần giữ lại');
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('deletion requires confirmation, unassigned and Listening filters work, and switching lessons rejects stale responses', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER', initialLesson: 101});
        await page.getByRole('checkbox', {name: 'Chọn từ serendipity', exact: true}).check();
        await page.getByRole('button', {name: 'Xóa đã chọn', exact: true}).click();
        assert.equal(state.cards.length, 12);
        await page.getByRole('button', {name: 'Giữ lại', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        await page.getByRole('button', {name: 'Xóa đã chọn', exact: true}).click();
        await page.getByRole('button', {name: 'Xác nhận xóa', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.equal(state.cards.length, 11);
        await page.getByRole('button', {name: 'Chưa vào bài', exact: true}).click();
        await page.locator('.vw-word-card h3').filter({hasText: 'take a break'}).waitFor();
        assert.equal(await page.locator('.vw-word-card').count(), 1);
        await selectCategory(page);
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.getByLabel('Loại flashcard').selectOption({label: 'Listening'});
        await page.getByRole('button', {name: 'Xóa từ slow down', exact: true}).waitFor();
        await page.getByLabel('Loại flashcard').selectOption({label: 'Tất cả thẻ'});
        await selectCategory(page);
        state.holdLesson = 101;
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.waitForFunction(() => window.vm.cardsLoading);
        await selectCategory(page);
        await page.getByRole('button', {name: /A world to discover/}).click();
        await page.locator('.vw-word-card h3').filter({hasText: 'wanderlust'}).waitFor();
        state.holdLesson = null; state.releaseLesson();
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.vw-word-card').count(), 1);
        assert.equal(await page.locator('.vw-word-card h3').innerText(), 'wanderlust');
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('desktop and phone layouts fit the viewport; ADMIN imports in the same workspace', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const width of [1600, 390]) {
            const {page, state} = await fixture(browser, {width});
            await selectCategory(page);
            await page.getByRole('button', {name: /Little things, every day/}).click();
            await page.waitForFunction(() => !window.vm.cardsLoading && window.vm.activeLesson);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({path: path.join(app, '../../.tmp/vocabulary-workspace-' + width + '.png'), fullPage: true});
            await page.getByRole('button', {name: 'Import', exact: true}).click();
            await page.getByRole('button', {name: 'Read and preview', exact: true}).waitFor();
            assert.match(await page.locator('.modal-dialog .ui-select-match').first().innerText(), /Little things/i);
            await page.getByRole('button', {name: 'Close', exact: true}).click();
            await page.locator('.modal-dialog').waitFor({state: 'hidden'});
            assert.deepEqual(state.errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('export follows the selected lesson and exports every result while preserving the workbook values', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER'});
        await selectCategory(page);
        state.cards = Array.from({length: 501}, (_, index) => ({id: index + 1, question: 'word ' + index, pronounce: '/word/',
            motherTongue: 'nghĩa ' + index, status: 1, questionTopics: [{topic: {id: 102}}]}));
        await page.getByRole('button', {name: /A world to discover/}).click();
        await page.waitForFunction(() => !window.vm.cardsLoading && window.vm.total === 501);
        await page.evaluate(() => {
            window.exportRows = []; window.downloads = [];
            window.ExcelJS = {Workbook: class {
                constructor() { this.xlsx = {writeBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]))}; }
                addWorksheet() { return {addRow: row => window.exportRows.push(row), getRow: () => ({})}; }
            }};
            window.saveAs = (blob, name) => window.downloads.push({name, bytes: blob.size});
        });
        await page.getByRole('button', {name: 'Export', exact: true}).click();
        await page.waitForFunction(() => window.downloads.length === 1);
        assert.equal(await page.evaluate(() => window.exportRows.length), 501);
        assert.equal(await page.evaluate(() => window.exportRows.at(-1).meaning), 'nghĩa 500');
        assert.equal(await page.evaluate(() => window.downloads[0].name), 'A world to discover.xlsx');
        const pages = state.requests.filter(request => request.url.endsWith('/500'));
        assert.equal(pages.length, 2); assert.ok(pages.every(request => request.data.topicId === 102));
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('deleting a lesson confirms first and keeps its vocabulary in the library', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER'});
        await selectCategory(page);
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.getByRole('button', {name: 'Sửa bài từ vựng', exact: true}).click();
        await page.getByRole('button', {name: 'Xóa bài', exact: true}).click();
        await page.getByRole('button', {name: 'Xác nhận xóa bài', exact: true}).waitFor();
        assert.equal(state.lessons.length, 4); assert.equal(state.cards.length, 12);
        assert.match(await page.locator('.modal-dialog').innerText(), /vẫn được giữ trong thư viện/);
        await page.getByRole('button', {name: 'Xác nhận xóa bài', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.equal(state.lessons.length, 3); assert.equal(state.cards.length, 12);
        await page.getByRole('button', {name: 'Chưa vào bài', exact: true}).click();
        await page.waitForFunction(() => !window.vm.cardsLoading && window.vm.total === 11);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('a slow bookmarked lesson never replaces the newer lesson selected by the user', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {initialCategory: 1, initialLesson: 101, holdInitial: true});
        await page.getByRole('button', {name: /A world to discover/}).click();
        await page.locator('.vw-word-card h3').filter({hasText: 'wanderlust'}).waitFor();
        state.releaseInitial();
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#vocabulary-heading').innerText(), 'A world to discover');
        assert.equal(await page.locator('.vw-word-card h3').innerText(), 'wanderlust');
        assert.match(page.url(), /lesson=102/);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});
