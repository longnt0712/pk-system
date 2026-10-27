const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
function source(relative) {
    return fs.readFileSync(path.join(app, relative), 'utf8');
}
const header = source('common/views/navs/header-hoz-for-login.html');
const login = source('common/views/login/login.html');
const styles = [header, login].flatMap(html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1])).join('\n');
const css = ['external/bootstrap.min.css', 'external/font-awesome.min.css', 'components-md.min.css', 'plugins-md.min.css',
    'layout-hoz.min.css', 'default.min.css', 'custom.css'].map(name => source('assets/css/' + name)).join('\n') + styles;
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async () => { browser = await (process.env.HEADER_BROWSER === 'webkit' ? playwright.webkit.launch({headless:true}) : playwright.chromium.launch({headless:true, executablePath})); });
after(async () => { if (browser) await browser.close(); });

async function fixture(viewport, chapter = true) {
    const page = await browser.newPage({viewport, reducedMotion:'reduce', hasTouch:true});
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.route('**/*', route => {
        const url = route.request().url();
        if (/\/troop(?:-1)?\.jpg$/.test(url)) return route.fulfill({contentType:'image/jpeg', body:fs.readFileSync(path.join(app, 'assets/images', url.endsWith('troop-1.jpg') ? 'troop-1.jpg' : 'troop.jpg'))});
        if (/\/fontawesome-webfont\.woff2(?:\?.*)?$/.test(url)) return route.fulfill({contentType:'font/woff2', body:fs.readFileSync(path.join(app, 'assets/fonts/fontawesome-webfont.woff2'))});
        return route.fulfill({contentType:'text/html', body:'<!doctype html><html><body></body></html>'});
    });
    await page.goto('http://public-header.test/');
    const shell = await page.evaluate(({header, login}) => {
        const doc = new DOMParser().parseFromString(login, 'text/html');
        const root = doc.querySelector('.page-wrapper');
        root.querySelectorAll('[data-ng-include]').forEach(node => {
            node.removeAttribute('data-ng-include');
            node.removeAttribute('data-ng-controller');
        });
        const nav = new DOMParser().parseFromString(header, 'text/html').querySelector('nav');
        const host = root.querySelector('.page-header');
        host.replaceChildren(nav);
        host.setAttribute('ng-controller', 'HeaderController');
        root.querySelector('.page-content > .container').innerHTML = '<section id="content-probe" style="min-height:1200px;background:#e9effa"><button id="content-action" style="float:right">Page action</button><h1>Chapter landing content</h1></section>';
        return root.outerHTML;
    }, {header, login});
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        '</style></head><body ng-controller="PublicHeaderFixture as vm">' + shell + '</body></html>');
    for (const name of ['jquery.min.js', 'bootstrap.min.js', 'angular.min.js']) await page.addScriptTag({path:path.join(app, 'assets/scripts/external/' + name)});
    await page.evaluate(chapter => {
        window.Hrm = angular.module('PublicHeaderTest', []).value('$state', {});
        window.Layout = {initContent() {}};
        Hrm.run(['$rootScope', root => {
            root.settings = {chapter, ieltsRoom:!chapter, assetsPath:'assets', api:{baseUrl:'/'}};
            root.$state = {current:{name:'login'}, includes:() => false};
        }]).controller('PublicHeaderFixture', function () {
            this.user = {username:'', password:''};
            this.login = () => { window.loginCalls = (window.loginCalls || 0) + 1; };
        });
    }, chapter);
    await page.addScriptTag({path:path.join(app, 'application.controllers.js')});
    await page.evaluate(() => angular.bootstrap(document.body, ['PublicHeaderTest']));
    return {page, errors};
}

async function assertFlow(page) {
    const geometry = await page.evaluate(() => {
        const rect = node => { const r = node.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height}; };
        const nav = document.querySelector('.learning-public-nav');
        return {header:rect(document.querySelector('.page-header')), nav:rect(nav), content:rect(document.querySelector('#content-probe')),
            controls:[...nav.querySelectorAll('.learning-public-brand,.learning-public-theme-toggle,.navbar-toggle,.learning-desktop-login > li > a,.for-media')]
                .filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none').map(rect),
            width:innerWidth, scrollWidth:document.documentElement.scrollWidth};
    });
    assert.ok(geometry.header.bottom >= geometry.nav.bottom - 1, 'header includes every public navigation row: ' + JSON.stringify(geometry));
    assert.ok(geometry.content.top >= geometry.nav.bottom - 1, 'content starts after the public header: ' + JSON.stringify(geometry));
    assert.ok(geometry.scrollWidth <= geometry.width + 1, 'no horizontal page overflow: ' + JSON.stringify(geometry));
    for (const item of geometry.controls) {
        assert.ok(item.left >= geometry.nav.left - 1 && item.right <= geometry.nav.right + 1, 'control stays within navbar: ' + JSON.stringify({item, geometry}));
        assert.ok(item.top >= geometry.nav.top - 1 && item.bottom <= geometry.nav.bottom + 1, 'control contributes to header height: ' + JSON.stringify({item, geometry}));
    }
    return geometry;
}

for (const viewport of [{width:320,height:568}, {width:390,height:844}, {width:768,height:1024}, {width:820,height:1180},
    {width:1024,height:768}, {width:1180,height:820}, {width:1366,height:1024}, {width:1920,height:1080}]) {
    test('public Chapter header stays above content and login remains usable at ' + viewport.width + 'px', async () => {
        const {page, errors} = await fixture(viewport);
        try {
            const theme = page.locator(viewport.width < 768 ? '.learning-public-mobile-theme-toggle' : '.learning-desktop-login .learning-public-theme-toggle');
            await theme.click();
            assert.equal(await page.evaluate(() => document.documentElement.classList.contains('global-dark-mode')), true, 'public theme control enables dark mode');
            await theme.click();
            assert.equal(await page.evaluate(() => document.documentElement.classList.contains('global-dark-mode')), false, 'public theme control restores light mode');
            for (const dark of [false, true]) {
                await page.evaluate(dark => document.documentElement.classList.toggle('global-dark-mode', dark), dark);
                await assertFlow(page);
                if (viewport.width >= 768) {
                    const positions = await page.evaluate(() => ['.learning-public-brand', '.learning-desktop-login .learning-public-theme-toggle', '.learning-desktop-login > .menu-dropdown > a']
                        .map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return (r.top + r.bottom) / 2; }));
                    assert.ok(Math.max(...positions) - Math.min(...positions) <= 2, 'brand, theme and LOGIN share one row: ' + JSON.stringify(positions));
                    const trigger = page.locator('.learning-desktop-login > .menu-dropdown > a');
                    await trigger.click();
                    const dropdown = page.locator('.learning-login-dropdown');
                    assert.equal(await dropdown.isVisible(), true);
                    const bounds = await dropdown.boundingBox();
                    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, JSON.stringify(bounds));
                    const username = dropdown.getByPlaceholder('Tên đăng nhập');
                    await username.fill('chapter.teacher');
                    assert.equal(await username.evaluate(node => {
                        const r = node.getBoundingClientRect();
                        return node === document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                    }), true, 'login field is above the landing content');
                    await dropdown.getByPlaceholder('Mật khẩu').fill('example-password');
                    await dropdown.locator('.learning-login-submit').click();
                    if (await dropdown.isVisible()) await trigger.click();
                } else {
                    assert.equal(await page.locator('.learning-public-mobile-theme-toggle').isVisible(), true);
                    const collapse = page.locator('#bs-example-navbar-collapse-1');
                    if (!await collapse.isVisible()) await page.locator('.navbar-toggle').click();
                    await page.waitForFunction(() => document.querySelector('#bs-example-navbar-collapse-1').classList.contains('in') && !document.querySelector('#bs-example-navbar-collapse-1').classList.contains('collapsing'));
                    await assertFlow(page);
                    await page.locator('.learning-mobile-login input[type="text"]').fill('chapter.student');
                    await page.locator('.learning-mobile-login input[type="password"]').fill('example-password');
                    await page.locator('.for-media .learning-login-submit').click();
                }
            }
            assert.equal(await page.evaluate(() => loginCalls), 2, 'the real visible login form invokes its action in both themes');
            if (viewport.width === 1180) {
                for (const size of [{width:820,height:1180}, {width:1024,height:768}, {width:390,height:844}, viewport]) {
                    await page.setViewportSize(size);
                    await page.evaluate(() => new Promise(requestAnimationFrame));
                    await assertFlow(page);
                }
                if (process.env.PUBLIC_HEADER_SCREENSHOT) await page.screenshot({path:process.env.PUBLIC_HEADER_SCREENSHOT, clip:{x:0,y:0,width:1180,height:400}});
            }
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('IELTS public branding uses the same bounded header shell', async () => {
    const {page, errors} = await fixture({width:1024,height:768}, false);
    try {
        await assertFlow(page);
        assert.equal(await page.locator('.learning-public-brand-text').innerText(), 'IELTS ROOM');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
