const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const css = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css', 'assets/css/external/select.min.css',
    'assets/fontawesome/css/all.css'].map(file => fs.readFileSync(path.join(app, file), 'utf8')).join('\n');
const productionCss = ['assets/css/custom.css', 'assets/css/ui-layer-safety.css'].map(file => fs.readFileSync(path.join(app, file), 'utf8')).join('\n');
const vocabularyCss = fs.readFileSync(path.join(app, 'topic/vocabulary.css'), 'utf8');

async function fixture(browser, {role = 'ADMIN', width = 1600, full = false, initialLesson = null, initialCategory = null, holdInitial = false, clock = false, productionStyles = false} = {}) {
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
    lessons.forEach(lesson => { lesson.userId = 7; });
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
        if (url.pathname.startsWith('/api/')) {
            const contentType = request.headers()['content-type'] || '';
            state.requests.push({url: url.pathname, data: contentType.includes('application/json') ? request.postDataJSON() : null});
        }
        if (url.pathname === '/api/question/vocabulary_usage') return json({role, wordCount: state.full ? 5000 : state.cards.length, wordLimit: role === 'ADMIN' ? -1 : role === 'USER' ? 10000 : 5000,
            topicCount: state.full ? 50 : lessons.length, topicLimit: role === 'ADMIN' ? -1 : role === 'USER' ? 100 : 50,
            wordLimitReached: state.full, topicLimitReached: state.full,
            wordLimitMessage: 'Bạn đã có 5000/5000 thẻ từ vựng. Bạn vẫn có thể sửa và học các thẻ đã có. Liên hệ quản trị viên để nâng hạn mức.',
            topicLimitMessage: 'Bạn đã có 50/50 bài từ vựng. Bạn vẫn có thể sửa và học các bài đã có. Liên hệ quản trị viên để được hỗ trợ.'});
        if (url.pathname.startsWith('/api/topic_category/get_page/')) return json({content: categories, totalPages: 1});
        if (url.pathname.startsWith('/api/topic_category/delete/')) {
            const id = Number(url.pathname.split('/').at(-1));
            if (categories.some(category => category.parentId === id)) return json({message: 'Hãy chuyển các nhóm con trước khi xóa nhóm này.'}, 400);
            if (lessons.some(lesson => lesson.topicCategory?.id === id)) return json({message: 'Nhóm còn bài từ vựng.'}, 400);
            const index = categories.findIndex(category => category.id === id);
            if (index < 0) return json(false);
            categories.splice(index, 1);
            return json(true);
        }
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
        const lessonSelection = url.pathname.match(/^\/api\/topic\/(?:uncategorized|category\/(\d+))\/selection$/);
        if (lessonSelection) {
            const categoryId = lessonSelection[1] ? Number(lessonSelection[1]) : undefined;
            const query = (url.searchParams.get('search') || '').toLowerCase();
            return json(lessons.filter(lesson => lesson.topicCategory?.id === categoryId &&
                lesson.name.toLowerCase().includes(query)).map(lesson => lesson.id));
        }
        if (/^\/api\/topic\/(?:uncategorized|category\/\d+)\/bulk\//.test(url.pathname)) {
            const dto = request.postDataJSON();
            if (url.pathname.endsWith('/move')) {
                lessons.filter(lesson => dto.lessonIds.includes(lesson.id)).forEach(lesson => {
                    lesson.topicCategory = categories.find(category => category.id === dto.targetCategoryId);
                });
            } else {
                dto.lessonIds.forEach(id => lessons.splice(lessons.findIndex(lesson => lesson.id === id), 1));
                state.cards.forEach(card => { card.questionTopics = card.questionTopics.filter(link => !dto.lessonIds.includes(link.topic.id)); });
            }
            return json(dto.lessonIds.length);
        }
        if (url.pathname === '/api/question/vocabulary/selection' || url.pathname.startsWith('/api/question/vocabulary/get_page/')) {
            const dto = request.postDataJSON(), numbers = url.pathname.split('/').slice(-2).map(Number);
            if (state.holdUnassigned && dto.withoutTopics) await new Promise(resolve => { state.releaseUnassigned = resolve; });
            if (state.holdLesson === dto.topicId) await new Promise(resolve => { state.releaseLesson = resolve; });
            const rows = state.cards.filter(card => (!dto.topicId || card.questionTopics.some(link => link.topic.id === dto.topicId)) &&
                (!dto.withoutTopics || !card.questionTopics.length) && (!dto.status || (dto.status === 3 ? card.status !== 5 : card.status === dto.status)) &&
                (!dto.textSearch || (dto.findExactWord ? card.question.toLowerCase() === dto.textSearch.trim().toLowerCase() :
                    (card.question + ' ' + card.motherTongue).toLowerCase().includes(dto.textSearch.toLowerCase()))));
            if (url.pathname.endsWith('/selection')) return json(rows.map(card => card.id));
            return json({content: rows.slice((numbers[0]-1)*numbers[1], numbers[0]*numbers[1]), totalElements: rows.length});
        }
        if (url.pathname.startsWith('/api/question/vocabulary/bulk/')) {
            const dto = request.postDataJSON();
            if (url.pathname.endsWith('/move')) {
                state.cards.filter(card => dto.cardIds.includes(card.id)).forEach(card => {
                    card.questionTopics = card.questionTopics.filter(link => link.topic.id !== dto.sourceTopicId);
                    if (!card.questionTopics.some(link => link.topic.id === dto.targetTopicId)) {
                        card.questionTopics.push({topic: lessons.find(lesson => lesson.id === dto.targetTopicId)});
                    }
                });
            } else {
                state.cards = state.cards.filter(card => !dto.cardIds.includes(card.id));
            }
            return json(dto.cardIds.length);
        }
        if (url.pathname === '/api/question/save') {
            const dto = request.postDataJSON(); state.saves.push(dto);
            if (state.failSave) return json({message: 'Bạn đã đạt hạn mức. Nội dung được giữ lại.'});
            dto.id = dto.id || 20; dto.questionTopics = dto.questionTopics || [];
            state.cards = state.cards.filter(card => card.id !== dto.id); state.cards.unshift(dto); return json(dto);
        }
        if (url.pathname.startsWith('/api/question/delete/')) { const id = Number(url.pathname.split('/').at(-1)); state.cards = state.cards.filter(card => card.id !== id); return json(true); }
        if (url.pathname === '/api/question/import_excel/preview') return json({rows: state.importRows || []});
        if (url.pathname === '/api/question/import_excel/confirm') {
            if (state.importGate) await state.importGate;
            return json({success: true, message: 'Đã nhập từ vựng.'});
        }
        if (url.pathname.startsWith('/question/views/')) return route.fulfill({contentType: 'text/html', body: fs.readFileSync(path.join(app, url.pathname), 'utf8')});
        if (url.pathname.includes('/webfonts/')) return route.fulfill({body: fs.readFileSync(path.join(app, 'assets/fontawesome/webfonts', path.basename(url.pathname)))});
        return route.fulfill({contentType: 'text/html', body: '<html><body></body></html>'});
    });
    const search = new URLSearchParams();
    if (initialCategory) search.set('category', initialCategory);
    if (initialLesson) search.set('lesson', initialLesson);
    await page.goto('http://vocabulary.test/topics' + (search.size ? '?' + search : ''));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + css + '\n' + (productionStyles ? productionCss : '') + '\n' + vocabularyCss +
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
            assert.equal(await sidebar.getByRole('button', {name: 'Sửa nhóm Reading', exact: true}).isVisible(), true);
            assert.equal(await sidebar.getByRole('button', {name: 'Thêm nhóm con vào Reading', exact: true}).isVisible(), true);
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
            assert.ok(await sidebar.locator('.vw-category-tree').evaluate(tree => tree.scrollWidth <= tree.clientWidth));
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
        const tree = page.getByRole('list', {name: 'Cây nhóm bài'});
        await tree.getByRole('button', {name: 'Thêm nhóm con vào Reading', exact: true}).click();
        assert.equal(await page.locator('#vw-category-title').innerText(), 'IELTS & học thuật');
        await page.getByLabel('Tên nhóm', {exact: true}).fill('Writing');
        assert.equal(await page.getByLabel('Nhóm cha', {exact: true}).locator('option:checked').innerText(), 'IELTS & học thuật / Reading');
        await page.getByRole('button', {name: 'Lưu nhóm', exact: true}).click();
        await tree.getByRole('button', {name: 'Writing', exact: true}).click();
        await tree.getByRole('button', {name: 'Sửa nhóm Writing', exact: true}).click();
        assert.equal(await page.getByLabel('Nhóm cha', {exact: true}).locator('option').filter({hasText: 'Writing'}).count(), 0);
        await page.getByLabel('Nhóm cha', {exact: true}).selectOption({label: 'Đời sống hằng ngày'});
        await page.getByRole('button', {name: 'Lưu nhóm', exact: true}).click();
        await page.waitForFunction(() => window.vm.categoryPath[0]?.name === 'Đời sống hằng ngày');
        assert.equal(state.categories.find(category => category.name === 'Writing').parentId, 1);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('group actions live on tree rows and only empty groups can be deleted', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser);
        const sidebar = page.locator('.vw-sidebar');
        assert.equal(await sidebar.getByRole('button', {name: /^(Sửa nhóm|Thêm nhóm|Tạo bài từ vựng)$/}).count(), 0);
        await selectCategory(page);
        assert.equal(await page.locator('.vw-category-content').getByRole('button', {name: /Sửa nhóm|Thêm nhóm con/}).count(), 0);
        const tree = page.getByRole('list', {name: 'Cây nhóm bài'});
        await tree.getByRole('button', {name: 'Sửa nhóm Đời sống hằng ngày', exact: true}).click();
        assert.equal(await page.getByLabel('Tên nhóm', {exact: true}).inputValue(), 'Đời sống hằng ngày');
        await page.getByRole('button', {name: 'Hủy', exact: true}).click();

        for (const [name, error] of [['Đời sống hằng ngày', /còn bài từ vựng/], ['IELTS & học thuật', /chuyển các nhóm con/]]) {
            await tree.getByRole('button', {name: 'Xóa nhóm ' + name, exact: true}).click();
            await page.getByRole('button', {name: 'Xác nhận xóa nhóm', exact: true}).click();
            await page.getByRole('alert').filter({hasText: error}).waitFor();
            await page.getByRole('button', {name: 'Hủy', exact: true}).click();
        }
        await tree.getByRole('button', {name: 'Mở rộng IELTS & học thuật', exact: true}).click();
        await tree.getByRole('button', {name: 'Mở rộng Reading', exact: true}).click();
        await tree.getByRole('button', {name: 'Cambridge IELTS 19', exact: true}).click();
        await tree.getByRole('button', {name: 'Xóa nhóm Cambridge IELTS 19', exact: true}).click();
        await page.getByRole('button', {name: 'Xác nhận xóa nhóm', exact: true}).click();
        await tree.getByRole('button', {name: 'Cambridge IELTS 19', exact: true}).waitFor({state: 'hidden'});
        assert.equal(await page.locator('#vw-category-title').innerText(), 'Reading');
        assert.equal(new URL(page.url()).searchParams.get('category'), '3');
        assert.equal(state.lessons.length, 4);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('the lesson category picker stays inside the scrolled dialog and leaves its footer clickable', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const [width, height] of [[1366, 768], [390, 560]]) {
            const {page, state} = await fixture(browser, {width, initialCategory: 3, productionStyles: true});
            await page.setViewportSize({width, height});
            await page.waitForFunction(() => window.vm.lessonCategory?.id === 3);
            await page.evaluate(() => {
                const spacer = document.createElement('div');
                spacer.style.height = '430px';
                document.body.prepend(spacer);
                window.scrollTo(0, 420);
            });
            if (width < 768) await page.locator('.vw-mobile-picker').click();
            const header = page.locator('.vw-category-content .vw-content-head');
            const create = header.getByRole('button', {name: 'Tạo bài từ vựng', exact: true});
            const [button, title, heading] = await Promise.all([create.boundingBox(), header.locator('.vw-context').boundingBox(), header.boundingBox()]);
            assert.ok(Math.abs((button.y + button.height / 2) - (title.y + title.height / 2)) < 1);
            assert.ok(Math.abs((button.x + button.width) - (heading.x + heading.width)) < 1);
            assert.equal(await page.getByRole('button', {name: 'Tạo bài từ vựng', exact: true}).count(), 1);
            await create.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => window.scrollY > 0));
            await create.click();

            const dialog = page.locator('.modal-dialog');
            const toggle = dialog.locator('.ui-select-toggle');
            assert.match(await toggle.innerText(), /IELTS & học thuật \/ Reading/);
            await toggle.click();
            assert.equal(await page.locator('body > .ui-select-container.open').count(), 0, 'opening the picker does not detach it from the dialog');
            const search = dialog.locator('input.ui-select-search');
            const footer = await dialog.locator('.vw-modal-footer').boundingBox();
            assert.ok(footer && footer.y + footer.height <= height, 'the footer fits while all groups are listed');
            await search.fill('Cambridge IELTS 19');
            const option = dialog.getByRole('option', {name: 'IELTS & học thuật / Reading / Cambridge IELTS 19', exact: true});
            await option.waitFor();
            const position = await option.evaluate(node => {
                const box = node.getBoundingClientRect();
                const input = node.closest('.ui-select-container').querySelector('input.ui-select-search').getBoundingClientRect();
                const footer = node.closest('.vw-modal').querySelector('.vw-modal-footer').getBoundingClientRect();
                return {gap: box.top - input.bottom, optionBottom: box.bottom, footerTop: footer.top, footerBottom: footer.bottom,
                    hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))};
            });
            assert.ok(position.gap >= 0 && position.gap < 20, JSON.stringify(position));
            assert.ok(position.optionBottom <= position.footerTop && position.footerBottom <= height, JSON.stringify(position));
            assert.equal(position.hit, true);
            await option.click();
            assert.match(await toggle.innerText(), /Reading \/ Cambridge IELTS 19/);
            await page.getByRole('button', {name: 'Hủy', exact: true}).click();
            await dialog.waitFor({state: 'hidden'});
            assert.deepEqual(state.errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('one workspace selects a lesson, creates a lesson with category and saves words directly inside it', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'VIEWER'});
        assert.ok(await page.getByRole('button', {name: 'Tạo nhóm', exact: true}).isVisible());
        assert.ok(state.requests.some(request => request.url.startsWith('/api/topic_category/get_page/')
            && request.data.personalLibrary === true));
        await selectCategory(page);
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.waitForFunction(() => window.vm.activeLesson && window.vm.activeLesson.id === 101 && !window.vm.cardsLoading);
        assert.match(await page.locator('#vocabulary-heading').innerText(), /Little things/);
        assert.ok(await page.getByRole('button', {name: 'Xóa bài', exact: true}).isVisible());
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
        await page.locator('.modal-dialog .vw-lesson-category input.ui-select-search').fill('IELTS');
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

test('select all includes other card pages and moving requires a confirmed destination', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER', initialLesson: 101});
        state.cards[0].questionTopics.push({topic: state.lessons[2]});
        const all = page.getByRole('checkbox', {name: 'Chọn tất cả thẻ', exact: true});
        await all.check();
        await page.getByText('Đã chọn 10 thẻ', {exact: true}).waitFor();
        await page.getByRole('button', {name: 'Trang từ sau'}).click();
        const last = page.getByRole('checkbox', {name: 'Chọn từ slow down', exact: true});
        assert.ok(await last.isChecked());
        await last.uncheck();
        await page.getByText('Đã chọn 9 thẻ', {exact: true}).waitFor();
        await page.getByLabel('Loại flashcard').selectOption({label: 'Listening'});
        await last.waitFor();
        assert.equal(await last.isChecked(), false, 'changing the filter clears selection');
        await page.getByLabel('Loại flashcard').selectOption({label: 'Tất cả thẻ'});
        await all.check();
        await page.getByRole('button', {name: 'Di chuyển', exact: true}).click();
        await page.getByRole('heading', {name: 'Di chuyển 10 thẻ từ vựng?'}).waitFor();
        const confirm = page.getByRole('button', {name: 'Xác nhận di chuyển'});
        assert.equal(await confirm.isEnabled(), false);
        await page.locator('.modal-dialog .ui-select-toggle').click();
        await page.locator('.modal-dialog input.ui-select-search').fill('world');
        await page.getByRole('option', {name: /A world to discover/}).click();
        assert.ok(!state.requests.some(request => request.url.includes('/bulk/')));
        await confirm.click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        const move = state.requests.find(request => request.url.endsWith('/bulk/move'));
        assert.deepEqual(move.data, {sourceTopicId: 101, targetTopicId: 102, cardIds: [1, 2, 3, 4, 6, 7, 8, 9, 10, 12]});
        assert.deepEqual(state.cards[0].questionTopics.map(link => link.topic.id), [103, 102]);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('uncategorized lessons select across the scroll list and move into a child category', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER', width: 390});
        const ids = Array.from({length: 45}, (_, index) => 200 + index);
        state.lessons.push(...ids.map(id => ({id, name: 'Tài liệu ' + id})), {id: 300, name: 'Bài còn lại'});
        state.cards[10].questionTopics = [{topic: state.lessons.find(lesson => lesson.id === 300)}];
        await selectCategory(page, 'Bài chưa phân nhóm');
        const search = page.getByLabel('Tìm bài từ vựng trong nhóm');
        await search.fill('Tài liệu');
        await page.getByText('45 bài phù hợp', {exact: true}).waitFor();
        assert.ok(await page.locator('.vw-lesson-row').count() < ids.length);
        await page.getByRole('checkbox', {name: 'Chọn tất cả bài', exact: true}).check();
        await page.getByText('Đã chọn 45 bài', {exact: true}).waitFor();
        await page.getByRole('button', {name: 'Di chuyển', exact: true}).click();
        await page.getByRole('heading', {name: 'Di chuyển 45 bài từ vựng?'}).waitFor();
        await page.locator('.modal-dialog .ui-select-toggle').click();
        await page.locator('.modal-dialog input.ui-select-search').fill('Cambridge');
        await page.getByRole('option', {name: 'IELTS & học thuật / Reading / Cambridge IELTS 19'}).click();
        assert.ok(!state.requests.some(request => request.url.includes('/bulk/')));
        await page.getByRole('button', {name: 'Xác nhận di chuyển'}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        const move = state.requests.find(request => request.url.endsWith('/bulk/move'));
        assert.deepEqual(move.data, {lessonIds: ids, targetCategoryId: 4});
        await search.fill('');
        await page.getByRole('checkbox', {name: 'Chọn bài Bài còn lại'}).check();
        await page.getByRole('button', {name: 'Xóa đã chọn'}).click();
        await page.getByRole('heading', {name: 'Xóa 1 bài từ vựng?'}).waitFor();
        assert.ok(!state.requests.some(request => request.url.endsWith('/bulk/delete')));
        await page.getByRole('button', {name: 'Xác nhận xóa'}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.ok(!state.lessons.some(lesson => lesson.id === 300));
        assert.equal(state.cards.length, 12);
        assert.deepEqual(state.cards[10].questionTopics, []);
        assert.deepEqual(state.errors, []);
    } finally { await browser.close(); }
});

test('searching within a category lets the user move selected matches to one folder', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'USER'});
        const source = state.categories[1], child = state.categories[2];
        const matches = Array.from({length: 42}, (_, index) => ({
            id: 200 + index, name: 'iR.VOL ' + index, topicCategory: source
        }));
        state.lessons.push(...matches, {id: 300, name: 'iR.VOL in child', topicCategory: child});
        await selectCategory(page, source.name);
        const search = page.getByLabel('Tìm bài từ vựng trong nhóm');
        await search.fill('vol');
        await page.getByText('42 bài phù hợp', {exact: true}).waitFor();
        assert.ok(await page.locator('.vw-lesson-row').count() < matches.length);
        const first = page.getByRole('checkbox', {name: 'Chọn bài iR.VOL 0', exact: true});
        await first.check();
        await page.getByText('Đã chọn 1 bài', {exact: true}).waitFor();
        await page.getByRole('checkbox', {name: 'Chọn tất cả bài', exact: true}).check();
        await page.getByText('Đã chọn 42 bài', {exact: true}).waitFor();
        await first.uncheck();
        await page.getByRole('button', {name: 'Di chuyển', exact: true}).click();
        await page.getByRole('heading', {name: 'Di chuyển 41 bài từ vựng?'}).waitFor();
        await page.locator('.modal-dialog .ui-select-toggle').click();
        assert.equal(await page.getByRole('option', {name: source.name, exact: true}).count(), 0);
        await page.getByRole('option', {name: 'IELTS & học thuật / Reading', exact: true}).click();
        assert.ok(!state.requests.some(request => request.url.endsWith('/bulk/move')));
        await page.getByRole('button', {name: 'Xác nhận di chuyển'}).click();
        await page.getByText('1 bài phù hợp', {exact: true}).waitFor();
        const move = state.requests.find(request => request.url.endsWith('/bulk/move'));
        assert.equal(move.url, '/api/topic/category/2/bulk/move');
        assert.deepEqual(move.data, {lessonIds: matches.slice(1).map(lesson => lesson.id), targetCategoryId: child.id});
        assert.equal(await search.inputValue(), 'vol');
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

test('large Excel previews keep the selected count and footer in view while importing', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        for (const [width, height] of [[1366, 768], [390, 560]]) {
            const {page, state} = await fixture(browser, {width, initialLesson: 101, productionStyles: true});
            await page.setViewportSize({width, height});
            state.importRows = Array.from({length: 369}, (_, index) => ({
                rowNumber: index + 2, word: 'Word ' + index, firstLanguage: 'Nghĩa của từ', level: 'B2', status: 'NEW'
            }));
            let releaseImport;
            state.importGate = new Promise(resolve => {releaseImport = resolve;});
            await page.getByRole('button', {name: 'Import', exact: true}).click();
            const modal = page.locator('.vocab-import-dialog');
            await modal.locator('input[type=file]').setInputFiles(path.join(app, 'question/templates/flashcard_import_template.xlsx'));
            await modal.getByRole('button', {name: 'Read and preview', exact: true}).click();
            const confirm = modal.locator('.modal-footer button[ng-click="importVm.confirmImport()"]');
            await confirm.waitFor();
            assert.match(await confirm.textContent(), /Confirm import \(369\)/);
            async function assertLayout() {
                const layout = await modal.evaluate(element => {
                    const body = element.querySelector('.modal-body').getBoundingClientRect();
                    const footer = element.querySelector('.modal-footer').getBoundingClientRect();
                    const table = element.querySelector('.question-import-scroll');
                    const count = element.querySelector('.question-import-selection');
                    const actions = Array.from(element.querySelectorAll('.modal-footer .btn'), button => button.getBoundingClientRect());
                    return {bodyBottom: body.bottom, footerTop: footer.top, footerBottom: footer.bottom,
                        footerRight: footer.right, actionsFit: actions.every(rect => rect.left >= 0 && rect.right <= innerWidth),
                        countBottom: count.getBoundingClientRect().bottom, tableHeight: table.clientHeight,
                        tableContentHeight: table.scrollHeight, pageWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight};
                });
                assert.ok(layout.bodyBottom <= layout.footerTop + 1 && layout.footerBottom <= layout.height + 1
                    && layout.countBottom <= layout.footerBottom && layout.tableContentHeight > layout.tableHeight
                    && layout.footerRight <= layout.width && layout.actionsFit && layout.pageWidth <= layout.width, JSON.stringify(layout));
            }
            await page.waitForFunction(() => {
                const transform = getComputedStyle(document.querySelector('.vocab-import-dialog .modal-dialog')).transform;
                return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
            });
            await assertLayout();
            const scrollTop = await modal.locator('.question-import-scroll').evaluate(table => {
                table.scrollTop = 120;
                return table.scrollTop;
            });
            assert.ok(scrollTop > 0);
            await confirm.click();
            await modal.getByText('Đang nhập các dòng đã chọn...').waitFor();
            await assertLayout();
            assert.equal(await confirm.isDisabled(), true);
            releaseImport();
            await modal.waitFor({state: 'hidden'});
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

test('a viewer can delete an owned lesson after confirming and keep its vocabulary in the library', async () => {
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    try {
        const {page, state} = await fixture(browser, {role: 'VIEWER', width: 390});
        await selectCategory(page);
        await page.getByRole('button', {name: /Little things, every day/}).click();
        await page.getByRole('button', {name: 'Sửa bài từ vựng', exact: true}).click();
        await page.locator('.modal-dialog').getByRole('button', {name: 'Xóa bài', exact: true}).click();
        await page.getByRole('button', {name: 'Giữ lại bài', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.ok(!state.requests.some(request => request.url.startsWith('/api/topic/delete/')));
        await page.locator('.vw-lesson-actions').getByRole('button', {name: 'Xóa bài', exact: true}).click();
        const confirmation = page.locator('.modal-dialog');
        await confirmation.getByRole('button', {name: 'Xác nhận xóa bài', exact: true}).waitFor();
        assert.equal(state.lessons.length, 4); assert.equal(state.cards.length, 12);
        assert.match(await confirmation.innerText(), /Little things, every day/);
        assert.match(await confirmation.innerText(), /vẫn được giữ trong thư viện/);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button', {name: 'Xác nhận xóa bài', exact: true}).click();
        await page.locator('.modal-dialog').waitFor({state: 'hidden'});
        assert.equal(state.lessons.length, 3); assert.equal(state.cards.length, 12);
        await page.locator('.vw-mobile-picker').click();
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
