const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const classView = read('enrolment_class/views/listing.html');
const bootstrap = read('assets/css/external/bootstrap.min.css');
const custom = read('assets/css/custom.css');
const classCss = classView.match(/<style>([\s\S]*?)<\/style>/)[1];
const table = classView.slice(classView.indexOf('<div class="table-responsive class-tree-scroll"'),
    classView.indexOf('</table>') + '</table>'.length) + '</div>';
const productView = read('products/views/listing.html');
const userView = read('users/views/users.html');
const productImage = productView.match(/<img\b[^>]*ng-src="{{p.imageUrl}}"[^>]*>/)[0];
const avatarImage = userView.match(/<img\b[^>]*class="img-circle avatar-user"[^>]*>/)[0];

async function angularPage(browser, markup, css = '', width = 1024) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html>'}));
    await page.goto('http://admin-ui.test');
    await page.setContent('<!doctype html><html><head><base href="http://admin-ui.test/"><meta charset="utf-8"><style>'
        + bootstrap + custom + css + '</style></head><body><main id="qa">' + markup + '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    return page;
}

test('class table preserves readable columns and contained keyboard scrolling at desktop, tablet and phone widths', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [1366, 768, 390]) {
            const page = await angularPage(browser, table,
                classCss + 'body{margin:0}main{padding:24px;max-width:1200px;margin:auto}', width);
            await page.evaluate(() => {
                angular.module('Qa', []).run(function ($rootScope) {
                    $rootScope.vm = {
                        expanded: {},
                        visibleClasses: [{id: 1, name: 'Lớp tiếng Anh IELTS Foundation', level: 0,
                            levelMarkers: [], hasChildren: true, childCount: 3, primaryTeacherId: 2,
                            teachers: [2], canManageTeams: true, canEdit: true, canAddChild: true},
                        {id: 2, name: 'Đội luyện đọc và nghe', parentId: 1, level: 1, levelMarkers: [1], teachers: []}],
                        teacherNames: (row, primary) => row.teachers.length
                            ? (primary ? 'Nguyễn Văn Hướng Dẫn' : 'Trần Thị Trợ Giảng') : '',
                        schedulePageUrl: () => '#/schedule',
                        toggle: row => {$rootScope.vm.expanded[row.id] = !$rootScope.vm.expanded[row.id];},
                        openTeamBoard: () => {window.teamBoardOpened = true;},
                        openEditor: () => {}, confirmDelete: () => {}
                    };
                });
                angular.bootstrap(document.getElementById('qa'), ['Qa']);
            });
            const dimensions = await page.evaluate(() => ({
                pageWidth: document.documentElement.scrollWidth,
                viewport: innerWidth,
                columns: [...document.querySelectorAll('.class-tree-table th')].map(th => th.getBoundingClientRect().width),
                heights: [...document.querySelectorAll('.class-tree-table tbody tr')].map(row => row.getBoundingClientRect().height),
                scrollWidth: document.querySelector('.class-tree-scroll').scrollWidth,
                clientWidth: document.querySelector('.class-tree-scroll').clientWidth
            }));
            assert.ok(dimensions.columns[0] >= 220, JSON.stringify(dimensions));
            assert.ok(dimensions.columns[1] >= 220, JSON.stringify(dimensions));
            assert.ok(dimensions.columns[2] >= 300, JSON.stringify(dimensions));
            assert.ok(dimensions.heights.every(height => height < 180), JSON.stringify(dimensions));
            assert.ok(dimensions.pageWidth <= dimensions.viewport + 1, JSON.stringify(dimensions));
            if (width < 1000) {
                assert.ok(dimensions.scrollWidth > dimensions.clientWidth, 'the table scrolls inside its region');
                await page.locator('.class-tree-scroll').focus();
                await page.keyboard.press('ArrowRight');
                await page.waitForFunction(() => document.querySelector('.class-tree-scroll').scrollLeft > 0);
            }
            await page.locator('.class-tree-actions button[title="Mở bảng phân đội"]').click();
            assert.equal(await page.evaluate(() => window.teamBoardOpened), true);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('education and topic editors identify their resource in both create and update states', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const [file, model, name] of [
            ['education_program/views/listing.html', 'educationProgram', 'chương trình đào tạo'],
            ['topic_category/views/listing.html', 'topicCategory', 'danh mục chủ đề']
        ]) {
            const template = read(file).match(/id="edit_object_modal.html">([\s\S]*?)<\/script>/)[1];
            const page = await angularPage(browser, template);
            await page.evaluate(model => {
                angular.module('Qa', []).run(function ($rootScope) {
                    $rootScope.vm = {[model]: {isNew: true}};
                    window.qaScope = $rootScope;
                });
                angular.bootstrap(document.getElementById('qa'), ['Qa']);
            }, model);
            assert.equal(await page.locator('.modal-title').innerText(), 'Thêm ' + name);
            await page.evaluate(model => window.qaScope.$apply(() => {window.qaScope.vm[model].isNew = false;}), model);
            assert.equal(await page.locator('.modal-title').innerText(), 'Cập nhật ' + name);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('product and account images use local fallbacks, preserve valid URLs and recover when ng-src changes', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const page = await angularPage(browser, '<div id="product">' + productImage + '</div><div id="avatar">'
            + avatarImage + '</div><img id="empty" ng-src="{{empty}}" image-fallback="assets/images/product-placeholder.svg">'
            + '<img id="static" src="/cached-broken.jpg" image-fallback="assets/images/product-placeholder.svg">'
            + '<img id="valid" ng-src="{{valid}}" image-fallback="assets/images/product-placeholder.svg">'
            + '<img id="no-loop" ng-src="{{broken}}" image-fallback="/missing-fallback.svg">');
        await page.waitForFunction(() => document.getElementById('static').complete);
        const requests = new Map();
        await page.unroute('**/*');
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            requests.set(url.pathname, (requests.get(url.pathname) || 0) + 1);
            if (url.pathname.startsWith('/assets/images/')) {
                return route.fulfill({contentType: 'image/svg+xml', body: read(url.pathname.slice(1))});
            }
            if (url.pathname === '/valid.svg' || url.pathname === '/initial-valid.svg'
                || (url.pathname.includes('/photo/') && url.search === '?v=2')) {
                return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/></svg>'});
            }
            // The production photo endpoint returns an empty JPEG body for accounts without a photo.
            if (url.pathname.includes('/photo/')) { return route.fulfill({contentType: 'image/jpeg', body: ''}); }
            return route.fulfill({status: 404, body: ''});
        });
        await page.evaluate(() => angular.module('Hrm', []));
        await page.addScriptTag({path: path.join(app, 'common/utils/image-fallback.js')});
        await page.evaluate(() => {
            angular.module('Hrm').run(function ($rootScope) {
                Object.assign($rootScope, {p: {imageUrl: '/broken.jpg', name: 'Sản phẩm'},
                    settings: {api: {baseUrl: '/'}}, user: {username: 'student', photoVersion: 1},
                    broken: '/broken-again.jpg', valid: '/initial-valid.svg'});
                window.qaScope = $rootScope;
            });
            angular.bootstrap(document.getElementById('qa'), ['Hrm']);
        });
        const loadedFallback = selector => page.waitForFunction(selector => {
            const image = document.querySelector(selector);
            return image.complete && image.naturalWidth > 0 && image.classList.contains('image-fallback');
        }, selector);
        for (const selector of ['#product img', '#avatar img', '#empty', '#static']) { await loadedFallback(selector); }
        await page.waitForFunction(() => document.getElementById('valid').complete
            && document.getElementById('valid').naturalWidth === 12);
        assert.equal(await page.locator('#valid').getAttribute('src'), '/initial-valid.svg');
        assert.equal(await page.locator('#valid').evaluate(image => image.classList.contains('image-fallback')), false);
        await page.waitForFunction(() => document.getElementById('no-loop').src.endsWith('/missing-fallback.svg')
            && document.getElementById('no-loop').complete);
        await page.evaluate(() => window.qaScope.$apply(() => {
            window.qaScope.p.imageUrl = '/valid.svg';
            window.qaScope.user.photoVersion = 2;
        }));
        await page.waitForFunction(() => ['#product img', '#avatar img'].every(selector => {
            const image = document.querySelector(selector);
            return image.complete && image.naturalWidth === 12 && !image.classList.contains('image-fallback');
        }));
        assert.ok((await page.locator('#product img').getAttribute('src')).endsWith('/valid.svg'));
        assert.ok((await page.locator('#avatar img').getAttribute('src')).endsWith('?v=2'));
        await page.evaluate(() => window.qaScope.$apply(() => {window.qaScope.p.imageUrl = '';}));
        await loadedFallback('#product img');
        // Delivering repeated errors cannot assign the fallback again or start another request.
        await page.evaluate(() => {
            const image = document.getElementById('no-loop');
            for (let index = 0; index < 5; index++) { image.dispatchEvent(new Event('error')); }
        });
        assert.equal(requests.get('/missing-fallback.svg'), 1);
        assert.equal(requests.get('/valid.svg'), 1);
        assert.equal(requests.get('/initial-valid.svg'), 1);
        await page.close();
    } finally { await browser.close(); }
});

test('product descriptions appear on both product cards without an unrelated note field', async () => {
    const notes = [...productView.matchAll(/<div class="p-note"[\s\S]*?<\/div>/g)].map(match => match[0]);
    assert.equal(notes.length, 2);
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const page = await angularPage(browser, notes.join(''));
        await page.evaluate(() => {
            angular.module('Qa', []).run(function ($rootScope) {$rootScope.p = {description: 'Áo đồng phục lớp'};});
            angular.bootstrap(document.getElementById('qa'), ['Qa']);
        });
        assert.equal(await page.locator('.p-note').count(), 2);
        for (const text of await page.locator('.p-note').allTextContents()) { assert.ok(text.includes('Áo đồng phục lớp')); }
        await page.close();
    } finally { await browser.close(); }
});
