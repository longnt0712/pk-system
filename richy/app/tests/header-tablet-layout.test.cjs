const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const executablePath = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(fs.existsSync);

const header = fs.readFileSync(path.join(app, 'common/views/navs/header-hoz.html'), 'utf8');
const shell = fs.readFileSync(path.join(app, 'common/views/application.html'), 'utf8')
    .replace(/<div\b[^>]*class="page-header"[^>]*>\s*<\/div>/, '<div class="page-header" ng-controller="HeaderController">' + header.match(/<nav\b[\s\S]*?<\/nav>/)[0] + '</div>')
    .replace(/\sdata-ng-(include|controller)="[^"]*"/g, '')
    .replace('<div ui-view class="fade-in-up"> </div>', '<div id="content-probe" style="min-height:1400px;position:relative"><button id="page-tool" style="position:absolute;top:0;right:0;z-index:20">Page action</button>Page content</div>');
const styles = [...header.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');

for (const viewport of [
    {width: 320, height: 568}, {width: 390, height: 844},
    {width: 768, height: 1024}, {width: 1024, height: 768},
    {width: 1180, height: 820}, {width: 1366, height: 1024},
    {width: 1920, height: 1080}
]) test('header stays in flow and account menu is usable at ' + viewport.width + 'x' + viewport.height, async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const page = await browser.newPage({viewport, reducedMotion: 'reduce'});
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + shell + '</body></html>');
        for (const css of ['external/bootstrap.min.css', 'components-md.min.css', 'plugins-md.min.css', 'layout-hoz.min.css', 'default.min.css', 'custom.css']) {
            await page.addStyleTag({path: path.join(app, 'assets/css', css)});
        }
        await page.addStyleTag({content: styles});
        for (const script of ['jquery.min.js', 'bootstrap.min.js', 'angular.min.js']) {
            await page.addScriptTag({path: path.join(app, 'assets/scripts/external', script)});
        }
        await page.evaluate(() => {
            window.Hrm = angular.module('HeaderLayoutTest', []).value('$state', {});
            window.Layout = {initContent() {}};
            Hrm.run(['$rootScope', root => {
                root.settings = {permissionsLoaded: true, ieltsRoom: true, isAdmin: true, isViewer: true, campaignsEnabled: true, assetsPath: 'assets', api: {baseUrl: '/'}};
                root.currentUser = {person: {lastName: 'NGUYỄN', firstName: 'NGƯỜI DÙNG THỬ NGHIỆM'}, username: 'long.tablet.account', hasPhoto: false};
                root.canManageOwnProfile = () => true;
                root.$state = {current: {name: 'application.dashboard'}, includes: () => false};
            }]);
        });
        await page.addScriptTag({path: path.join(app, 'application.controllers.js')});
        await page.evaluate(() => angular.bootstrap(document.body, ['HeaderLayoutTest']));
        const collapse = page.locator('#bs-example-navbar-collapse-1');
        if (viewport.width < 768) {
            assert.equal(await collapse.isVisible(), false, 'mobile menu starts collapsed');
            const geometry = await page.locator('.navbar-toggle').boundingBox();
            const nav = await page.locator('.learning-login-nav').boundingBox();
            assert.ok(geometry.x >= nav.x && geometry.x + geometry.width <= nav.x + nav.width + 1, 'hamburger stays inside navbar');
            await page.locator('.navbar-toggle').click();
            await page.waitForFunction(() => document.querySelector('#bs-example-navbar-collapse-1').classList.contains('in') && !document.querySelector('#bs-example-navbar-collapse-1').classList.contains('collapsing'));
        }
        const inspectGeometry = () => page.evaluate(() => {
            const rect = element => { const r = element.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom}; };
            return {
                header: rect(document.querySelector('.page-header')),
                navbar: rect(document.querySelector('.learning-login-nav')),
                content: rect(document.querySelector('#content-probe')),
                items: [...document.querySelectorAll('.learning-login-nav .navbar-nav > li > a')].filter(a => a.getClientRects().length).map(rect),
                scrollWidth: document.documentElement.scrollWidth,
                width: innerWidth,
                headerLayer: getComputedStyle(document.querySelector('.page-header')).zIndex
            };
        });
        for (const dark of [false, true]) {
            await page.evaluate(dark => document.documentElement.classList.toggle('global-dark-mode', dark), dark);
            const geometry = await inspectGeometry();
            assert.ok(geometry.header.bottom >= geometry.navbar.bottom - 1, 'header contains every navigation row');
            assert.ok(geometry.content.top >= geometry.navbar.bottom - 1, 'content begins after navigation');
            assert.ok(geometry.scrollWidth <= geometry.width, 'no page overflow');
            assert.ok(Number(geometry.headerLayer) < 1040, 'header remains below modal backdrop');
            for (const item of geometry.items) {
                assert.ok(item.left >= geometry.navbar.left - 1 && item.right <= geometry.navbar.right + 1, 'navigation item fits navbar');
                assert.ok(item.bottom <= geometry.navbar.bottom + 1, 'navigation item contributes to header height');
            }
            for (const item of await page.locator('.learning-login-nav .navbar-nav > li:has(> .dropdown-menu)').all()) {
                await item.locator(':scope > a').click();
                const menu = item.locator(':scope > .dropdown-menu');
                assert.equal(await menu.isVisible(), true, 'navigation dropdown opens');
                const bounds = await menu.boundingBox();
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, 'navigation dropdown fits viewport');
                const action = menu.locator(':scope > li > a').first();
                await action.scrollIntoViewIfNeeded();
                assert.equal(await action.evaluate(element => {
                    const r = element.getBoundingClientRect();
                    return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
                }), true, 'dropdown action is not covered by page content');
                await item.locator(':scope > a').click();
            }
            await page.locator('.user-dropdown-mobile > a').click();
            assert.equal(await page.locator('.user-dropdown-menu').isVisible(), true);
            const account = await page.locator('.user-dropdown-menu').boundingBox();
            assert.ok(account.x >= 0 && account.x + account.width <= viewport.width + 1, 'account dropdown fits viewport');
            const logout = page.locator('.user-dropdown-menu > li:last-child > a');
            await logout.scrollIntoViewIfNeeded();
            assert.equal(await logout.evaluate(element => {
                const r = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
            }), true, 'account action is not covered by page content');
            await page.locator('.user-dropdown-mobile > a').click();
        }
        if (viewport.width === 1180) {
            const system = page.locator('.learning-login-nav .navbar-nav > li').filter({hasText: 'System'});
            await system.locator(':scope > a').click();
            for (const width of [1024, 1366, 768]) {
                await page.setViewportSize({width, height: 820});
                await page.evaluate(() => new Promise(requestAnimationFrame));
                const bounds = await system.locator(':scope > .dropdown-menu').boundingBox();
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'open dropdown is repositioned after rotation');
            }
            await page.setViewportSize({width: 390, height: 844});
            await page.locator('.navbar-toggle').click();
            await page.waitForFunction(() => document.querySelector('#bs-example-navbar-collapse-1').classList.contains('in') && !document.querySelector('#bs-example-navbar-collapse-1').classList.contains('collapsing'));
            await system.locator(':scope > a').click();
            assert.deepEqual(await system.locator(':scope > .dropdown-menu').evaluate(menu => ({position: getComputedStyle(menu).position, transform: getComputedStyle(menu).transform})), {position: 'static', transform: 'none'}, 'phone dropdown returns to normal flow after rotation');
            await page.setViewportSize(viewport);
            await page.evaluate(() => new Promise(requestAnimationFrame));
            const bounds = await system.locator(':scope > .dropdown-menu').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, 'dropdown fits again when returning to tablet width');
            await system.locator(':scope > a').click();
        }
        if (viewport.width < 768) {
            await page.locator('.navbar-toggle').click();
            await page.waitForFunction(() => !document.querySelector('#bs-example-navbar-collapse-1').classList.contains('in') && !document.querySelector('#bs-example-navbar-collapse-1').classList.contains('collapsing'));
            assert.equal(await collapse.isVisible(), false, 'mobile menu can close again');
            const geometry = await inspectGeometry();
            assert.ok(geometry.content.top >= geometry.navbar.bottom - 1, 'collapsed header still reserves its height');
        }
        await page.evaluate(() => {
            const header = document.querySelector('.page-header');
            angular.element(header).scope().$destroy();
            document.querySelector('.user-dropdown-mobile').classList.add('open');
            document.querySelector('.user-dropdown-menu').style.setProperty('--header-dropdown-shift', '7px');
            dispatchEvent(new Event('resize'));
        });
        assert.equal(await page.locator('.user-dropdown-menu').evaluate(menu => menu.style.getPropertyValue('--header-dropdown-shift')), '7px', 'destroying the header removes its resize listener');
    } finally {
        await browser.close();
    }
});
