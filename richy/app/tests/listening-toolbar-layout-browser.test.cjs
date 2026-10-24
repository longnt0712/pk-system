const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8') +
    fs.readFileSync(path.join(app, 'assets/css/external/font-awesome.min.css'), 'utf8') +
    fs.readFileSync(path.join(app, 'assets/css/custom.css'), 'utf8') +
    [...view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const wav = Buffer.alloc(44 + 8000 * 2 * 60);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
let browser;
before(async () => { browser = await playwright.chromium.launch({headless: true, executablePath}); });
after(async () => { if (browser) await browser.close(); });

async function open(width, study = true) {
    const page = await browser.newPage({viewport: {width, height: 800}, hasTouch:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://listening-toolbar.test/**', route => {
        if (route.request().url().endsWith('.wav')) {
            const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
            if (range) {
                const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                return route.fulfill({status:206,contentType:'audio/wav',headers:{'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${wav.length}`},body:wav.subarray(start,end+1)});
            }
            return route.fulfill({contentType:'audio/wav',headers:{'accept-ranges':'bytes'},body:wav});
        }
        if (/fontawesome-webfont\.woff2/.test(route.request().url())) return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(app,'assets/fonts/fontawesome-webfont.woff2'))});
        return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'});
    });
    await page.goto('http://listening-toolbar.test/');
    const toolbar = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return '<div class="idp-exam-test-context">' + doc.getElementById('listening-toolbar-switch').closest('label').outerHTML + '</div>' + doc.getElementById('listening-toolbar-panel').outerHTML;
    }, view);
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        'body{margin:0;padding:12px;background:#f4f6fb}.idp-reading-page{height:auto!important;min-height:0!important}@font-face{font-family:FontAwesome;src:url(http://listening-toolbar.test/fontawesome-webfont.woff2)}</style></head><body><main class="idp-reading-page idp-listening-page">' + toolbar + '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/jquery.min.js')});
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(study => {
        angular.module('Hrm', []).run(['$rootScope', function (root) {
            root.vm = {isListeningRoute: true, passageNumber: 1, showListeningToolbar: true, showAudio: true,
                showListeningContent: false, playbackValue: 1, isStudyMode: () => study,
                minimumPlaybackSpeed: () => study ? 0.6 : 1, toggleListeningContent() {}};
            window.toolbarScope = root;
        }]);
    }, study);
    await page.addScriptTag({path: path.join(app, 'common/utils/audio-seek.js')});
    await page.evaluate(() => {
        angular.bootstrap(document.body, ['Hrm']);
        const audio = document.getElementById('main-audio');
        audio.muted = true; audio.src = '/lesson.wav';
        window.originalAudio = audio;
    });
    await page.waitForFunction(() => Number.isFinite(document.getElementById('main-audio').duration));
    return {page, errors};
}

test('Listening controls share one row on wide screens and retain a usable player without page overflow on small screens', async () => {
    for (const width of [390, 768, 1024, 1180, 1366, 1920]) {
        const {page, errors} = await open(width);
        try {
            const layout = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,width:r.width,left:r.left,right:r.right}; };
                return {player:rect('.idp-listening-player'), audio:rect('#main-audio'), seek:rect('.idp-listening-seek'), speed:rect('.idp-listening-speed'),
                    toggles:rect('.idp-listening-toggles'), pageWidth:document.documentElement.scrollWidth};
            });
            assert.ok(layout.pageWidth <= width + 1, JSON.stringify({width, layout}));
            assert.ok(layout.audio.bottom - layout.audio.top >= 60, JSON.stringify({width, layout}));
            assert.ok(layout.seek.width >= 80 && layout.seek.bottom - layout.seek.top >= 44, JSON.stringify({width, layout}));
            assert.equal((await page.locator('.idp-header-audio-switch').innerText()).trim(), '', 'header toggle keeps its headphones icon without text');
            assert.equal(await page.locator('.idp-header-audio-switch .fa-headphones').isVisible(), true);
            if (width >= 992) {
                const center = rect => (rect.top + rect.bottom) / 2;
                assert.ok(Math.abs(center(layout.player) - center(layout.speed)) <= 2, JSON.stringify({width, layout}));
                assert.ok(Math.abs(center(layout.player) - center(layout.toggles)) <= 2, JSON.stringify({width, layout}));
            }
            assert.deepEqual(errors, []);
            if (process.env.LISTENING_TOOLBAR_SCREENSHOT && width === 1920) {
                const panel = await page.locator('#listening-toolbar-panel').boundingBox();
                await page.screenshot({path: process.env.LISTENING_TOOLBAR_SCREENSHOT, clip: {x:0,y:0,width,height:Math.ceil(panel.y+panel.height+14)}});
            }
        } finally { await page.close(); }
    }
});

test('the enlarged seek target supports pointer and keyboard, while display switches preserve the playing media', async () => {
    const {page, errors} = await open(1366);
    try {
        const slider = page.getByRole('slider', {name:'Tua bài nghe'});
        await slider.waitFor();
        await page.waitForFunction(() => !document.querySelector('.idp-listening-seek').disabled);
        const target = await slider.boundingBox();
        assert.ok(target.height >= 44 && target.width >= 150, JSON.stringify(target));
        await page.mouse.click(target.x + target.width * 0.65, target.y + 7);
        await page.waitForFunction(() => document.getElementById('main-audio').currentTime > 20 && !document.getElementById('main-audio').seeking, null, {timeout:5000});
        const beforeKey = await page.locator('#main-audio').evaluate(audio => audio.currentTime);
        await slider.press('ArrowRight');
        assert.ok(await page.locator('#main-audio').evaluate(audio => audio.currentTime) > beforeKey);
        await page.touchscreen.tap(target.x + target.width * 0.8, target.y + target.height - 5);
        assert.ok(await page.locator('#main-audio').evaluate(audio => audio.currentTime) > 40, 'touch can seek from the lower edge of the enlarged target');
        await page.evaluate(async () => {
            const audio = document.getElementById('main-audio');
            audio.playbackRate = 1.7; await audio.play();
        });
        await page.locator('label[for="listening-audio-switch"]').click();
        await page.locator('label[for="listening-audio-switch"]').click();
        await page.locator('.idp-header-audio-switch').click();
        await page.locator('.idp-header-audio-switch').click();
        const state = await page.locator('#main-audio').evaluate(audio => ({same:audio === window.originalAudio, time:audio.currentTime, paused:audio.paused, rate:audio.playbackRate}));
        assert.equal(state.same, true); assert.ok(state.time > 20); assert.equal(state.paused, false); assert.equal(state.rate, 1.7);
        await page.evaluate(() => {
            toolbarScope.$destroy();
            const audio = document.getElementById('main-audio');
            audio.pause(); audio.currentTime = 12;
            const slider = document.querySelector('.idp-listening-seek');
            slider.value = 48; slider.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await page.locator('#main-audio').evaluate(audio => audio.currentTime), 12, 'destroyed controls release their seek handler');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
    const serious = await open(1366, false);
    try {
        assert.equal(await serious.page.locator('#main-audio').isVisible(), false);
        assert.equal(await serious.page.locator('.idp-listening-toggles').count(), 0);
        assert.equal(await serious.page.locator('.idp-listening-speed').isVisible(), true);
        await serious.page.evaluate(() => {
            const audio = document.getElementById('main-audio'); audio.currentTime = 5;
            const slider = document.querySelector('.idp-listening-seek'); slider.value = 30;
            slider.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await serious.page.locator('#main-audio').evaluate(audio => audio.currentTime), 5, 'Serious mode does not permit the custom seek control');
        assert.deepEqual(serious.errors, []);
    } finally { await serious.page.close(); }
});
