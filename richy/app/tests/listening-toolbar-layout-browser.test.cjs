const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const controller = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const playbackControls = controller.slice(controller.indexOf('        vm.playbackValue = 1.0;'), controller.indexOf('        $scope.counter = 3600;'));
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
let browser, server, origin;
before(async () => {
    server = http.createServer((request, response) => {
        if (request.url.endsWith('.wav')) {
            const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range || '');
            if (range) {
                const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                response.writeHead(206, {'content-type':'audio/wav','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${wav.length}`,'content-length':end-start+1});
                return response.end(wav.subarray(start,end+1));
            }
            response.writeHead(200, {'content-type':'audio/wav','accept-ranges':'bytes','content-length':wav.length});
            return response.end(wav);
        }
        if (/fontawesome-webfont\.woff2/.test(request.url)) {
            response.writeHead(200, {'content-type':'font/woff2'});
            return response.end(fs.readFileSync(path.join(app,'assets/fonts/fontawesome-webfont.woff2')));
        }
        response.writeHead(200, {'content-type':'text/html'});
        response.end('<!doctype html><html><head></head><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    const engine = process.env.LISTENING_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true, ...(engine === 'chromium' ? {executablePath} : {})});
});
after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
});

async function open(width, study = true) {
    const page = await browser.newPage({viewport: {width, height: 800}, hasTouch:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    const toolbar = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.querySelector('.idp-exam-test-context').outerHTML + doc.getElementById('listening-toolbar-panel').outerHTML;
    }, view);
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        'body{margin:0;padding:12px;background:#f4f6fb}.idp-reading-page{height:auto!important;min-height:0!important}@font-face{font-family:FontAwesome;src:url(/fontawesome-webfont.woff2)}</style></head><body><main class="idp-reading-page idp-listening-page">' + toolbar + '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/jquery.min.js')});
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(({study, playbackControls}) => {
        angular.module('Hrm', []).run(['$rootScope', function (root) {
            root.vm = {isListeningRoute: true, passageNumber: 1, showListeningToolbar: true, showAudio: true,
                ieltsReadingActualTest:{title:'Vol 1 LISTENING FULL TEST 1'}, testSessionMode:study?'STUDY':'SERIOUS',
                showListeningContent: false, playbackValue: 1, isStudyMode() {return this.testSessionMode === 'STUDY';},
                minimumPlaybackSpeed: () => study ? 0.6 : 1, toggleListeningContent() {}};
            new Function('vm','getMainAudio',playbackControls)(root.vm,()=>document.getElementById('main-audio'));
            window.toolbarScope = root;
        }]);
    }, {study, playbackControls});
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
                return {player:rect('.idp-listening-player'), play:rect('.idp-listening-play'), seek:rect('.idp-listening-seek'), speed:rect('.idp-listening-speed'),
                    toggles:rect('.idp-listening-toggles'), pageWidth:document.documentElement.scrollWidth};
            });
            assert.ok(layout.pageWidth <= width + 1, JSON.stringify({width, layout}));
            assert.ok(layout.play.width >= 26 && layout.play.bottom - layout.play.top >= 26, JSON.stringify({width, layout}));
            assert.ok(layout.seek.width >= 80 && layout.seek.bottom - layout.seek.top >= 26, JSON.stringify({width, layout}));
            assert.equal(await page.locator('#main-audio').isVisible(), false, 'browser-native controls stay hidden, including Safari');
            assert.equal(await page.locator('#main-audio').evaluate(audio => audio.controls), false, 'there is only one seek timeline');
            assert.equal(await page.locator('.idp-listening-seek:visible').count(), 1);
            assert.equal(await page.locator('.idp-listening-time').innerText(), '0:00 / 1:00');
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
        assert.ok(target.height >= 26 && target.width >= 150, JSON.stringify(target));
        await page.mouse.click(target.x + target.width * 0.65, target.y + 7);
        await page.waitForFunction(() => document.getElementById('main-audio').currentTime > 20 && !document.getElementById('main-audio').seeking, null, {timeout:5000});
        const beforeKey = await page.locator('#main-audio').evaluate(audio => audio.currentTime);
        await slider.press('ArrowRight');
        assert.ok(await page.locator('#main-audio').evaluate(audio => audio.currentTime) > beforeKey);
        await page.touchscreen.tap(target.x + target.width * 0.8, target.y + target.height - 5);
        assert.ok(await page.locator('#main-audio').evaluate(audio => audio.currentTime) > 40, 'touch can seek from the lower edge of the enlarged target');
        await page.evaluate(async () => {
            const audio = document.getElementById('main-audio');
            audio.playbackRate = 1.7;
        });
        await page.getByRole('button', {name:'Phát bài nghe', exact:true}).click();
        await page.waitForFunction(() => !document.getElementById('main-audio').paused);
        assert.equal(await page.getByRole('button', {name:'Tạm dừng bài nghe', exact:true}).count(), 1);
        assert.match(await page.locator('.idp-listening-time').innerText(), /^0:4\d \/ 1:00$/);
        await page.locator('.idp-header-audio-switch').click();
        await page.locator('.idp-header-audio-switch').click();
        const state = await page.locator('#main-audio').evaluate(audio => ({same:audio === window.originalAudio, time:audio.currentTime, paused:audio.paused, rate:audio.playbackRate}));
        assert.equal(state.same, true); assert.ok(state.time > 20); assert.equal(state.paused, false); assert.equal(state.rate, 1.7);
        await page.getByRole('button', {name:'Tạm dừng bài nghe', exact:true}).click();
        assert.equal(await page.locator('#main-audio').evaluate(audio => audio.paused), true);
        await page.locator('.idp-listening-play').press('Space');
        await page.waitForFunction(() => !document.getElementById('main-audio').paused);
        await page.evaluate(() => {
            toolbarScope.$destroy();
            const audio = document.getElementById('main-audio');
            audio.pause(); audio.currentTime = 12;
            const slider = document.querySelector('.idp-listening-seek');
            slider.value = 48; slider.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await page.locator('#main-audio').evaluate(audio => audio.currentTime), 12, 'destroyed controls release their seek handler');
        await page.locator('.idp-listening-play').click();
        assert.equal(await page.locator('#main-audio').evaluate(audio => audio.paused), true, 'destroyed player releases its click handler');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
    const serious = await open(1366, false);
    try {
        assert.equal(await serious.page.locator('#main-audio').isVisible(), false);
        assert.equal(await serious.page.locator('#listening-toolbar-panel').isVisible(), false);
        assert.equal(await serious.page.locator('#listening-toolbar-switch').count(), 0);
        assert.equal(await serious.page.locator('.idp-listening-toggles').count(), 0);
        assert.equal(await serious.page.locator('.idp-header-audio-speed').isVisible(), true);
        await serious.page.evaluate(() => {
            const audio = document.getElementById('main-audio'); audio.currentTime = 5;
            const slider = document.querySelector('.idp-listening-seek'); slider.value = 30;
            slider.dispatchEvent(new Event('input', {bubbles:true}));
            document.querySelector('.idp-listening-play').dispatchEvent(new MouseEvent('click', {bubbles:true}));
        });
        assert.equal(await serious.page.locator('#main-audio').evaluate(audio => audio.currentTime), 5, 'Serious mode does not permit the custom seek control');
        assert.equal(await serious.page.locator('#main-audio').evaluate(audio => audio.paused), true, 'Serious mode does not permit the custom play control');
        assert.deepEqual(serious.errors, []);
    } finally { await serious.page.close(); }
});

test('Serious header shows the live audio clock and speed without a separate strip or switch', async () => {
    for (const width of [390, 768, 1366, 1920]) {
        const {page, errors} = await open(width, false);
        try {
            assert.equal(await page.locator('#listening-toolbar-panel').isVisible(), false);
            assert.equal(await page.locator('.idp-header-audio-switch').count(), 0);
            assert.equal(await page.locator('.idp-listening-speed:visible').count(), 1);
            assert.equal(await page.locator('#play-back-input').count(), 1, 'only the active speed control has an ID');
            assert.equal(await page.locator('.idp-header-audio-time').innerText(), '00:00 / 01:00');
            await page.evaluate(() => {document.getElementById('main-audio').currentTime = 50;});
            await page.waitForFunction(() => document.querySelector('.idp-header-audio-time').textContent === '00:50 / 01:00');
            const minus = page.getByRole('button', {name:'Giảm tốc độ', exact:true});
            const plus = page.getByRole('button', {name:'Tăng tốc độ', exact:true});
            assert.equal(await minus.isDisabled(), true);
            await plus.click();
            assert.equal(await page.locator('#main-audio').evaluate(audio=>audio.playbackRate), 1.1);
            await minus.click();
            assert.equal(await minus.isDisabled(), true);
            assert.equal(await page.locator('#main-audio').evaluate(audio=>audio.currentTime), 50);
            const layout = await page.evaluate(() => {
                const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
                return {time:rect('.idp-header-audio-time'),title:rect('.idp-exam-test-title'),speed:rect('.idp-header-audio-speed'),width:document.documentElement.scrollWidth};
            });
            assert.ok(layout.width <= width + 1, JSON.stringify({width,layout}));
            assert.ok(layout.time.right <= layout.title.left && layout.title.right <= layout.speed.left, JSON.stringify({width,layout}));
            assert.ok(Math.abs(layout.time.top + layout.time.bottom - layout.speed.top - layout.speed.bottom) <= 2, JSON.stringify({width,layout}));
            await page.evaluate(() => {
                const audio=document.getElementById('main-audio');
                Object.defineProperties(audio,{currentTime:{configurable:true,value:110},duration:{configurable:true,value:1618}});
                audio.dispatchEvent(new Event('timeupdate'));
            });
            assert.equal(await page.locator('.idp-header-audio-time').innerText(), '01:50 / 26:58');
            await page.evaluate(() => {const audio=document.getElementById('main-audio');delete audio.currentTime;delete audio.duration;});
            await page.evaluate(() => {const audio=document.getElementById('main-audio');audio.removeAttribute('src');audio.load();});
            await page.waitForFunction(() => document.querySelector('.idp-header-audio-time').textContent === '00:00 / 00:00');
            assert.deepEqual(errors, []);
        } finally {await page.close();}
    }
});

test('switching Study and Serious keeps the same media and releases the read-only clock on destruction', async () => {
    const {page, errors} = await open(1366, false);
    try {
        await page.evaluate(async () => {const audio=document.getElementById('main-audio');audio.currentTime=25;await audio.play();});
        await page.evaluate(() => toolbarScope.$apply(()=>{toolbarScope.vm.testSessionMode='STUDY';}));
        assert.equal(await page.locator('.idp-header-audio-time').count(), 0);
        assert.equal(await page.locator('#listening-toolbar-panel').isVisible(), true);
        assert.equal(await page.locator('.idp-header-audio-switch').count(), 1);
        await page.evaluate(() => toolbarScope.$apply(()=>{toolbarScope.vm.testSessionMode='SERIOUS';}));
        await page.waitForFunction(()=>document.querySelector('.idp-header-audio-time').textContent.startsWith('00:25'));
        const state=await page.locator('#main-audio').evaluate(audio=>({same:audio===originalAudio,paused:audio.paused,time:audio.currentTime}));
        assert.equal(state.same,true);assert.equal(state.paused,false);assert.ok(state.time>=25);
        await page.evaluate(() => {
            window.retiredAudioClock=document.querySelector('.idp-header-audio-time');
            window.retiredAudioClockText=retiredAudioClock.textContent;
            toolbarScope.$destroy();
            const audio=document.getElementById('main-audio');audio.pause();audio.currentTime=12;
            audio.dispatchEvent(new Event('timeupdate'));
        });
        assert.equal(await page.evaluate(()=>retiredAudioClock.textContent),await page.evaluate(()=>retiredAudioClockText), 'a destroyed clock no longer handles media events');
        assert.deepEqual(errors, []);
    } finally {await page.close();}
});

test('the custom player catches playback rejection and synchronizes source, time and paused state', async () => {
    const {page, errors} = await open(1024);
    try {
        assert.equal(await page.locator('#main-audio').evaluate(audio => audio.paused), true, 'loading the toolbar never auto plays');
        await page.evaluate(() => {
            const audio = document.getElementById('main-audio');
            window.originalPlay = audio.play.bind(audio);
            audio.play = () => Promise.reject(new DOMException('Playback denied', 'NotAllowedError'));
        });
        await page.getByRole('button', {name:'Phát bài nghe', exact:true}).click();
        await page.getByRole('status').filter({hasText:'Chưa phát được audio'}).waitFor();
        assert.equal(await page.getByRole('button', {name:'Phát bài nghe', exact:true}).count(), 1);
        await page.evaluate(() => { document.getElementById('main-audio').play = window.originalPlay; });
        await page.getByRole('button', {name:'Phát bài nghe', exact:true}).click();
        await page.waitForFunction(() => !document.getElementById('main-audio').paused);
        assert.equal(await page.locator('.idp-listening-status').isVisible(), false);
        await page.evaluate(() => {
            const audio = document.getElementById('main-audio'); audio.pause(); audio.currentTime = 26;
        });
        await page.waitForFunction(() => document.querySelector('.idp-listening-time').textContent === '0:26 / 1:00');
        await page.evaluate(() => {
            const audio = document.getElementById('main-audio'); audio.removeAttribute('src'); audio.load();
        });
        await page.waitForFunction(() => document.querySelector('.idp-listening-play').disabled);
        assert.equal(await page.locator('.idp-listening-time').innerText(), '0:00 / 0:00');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
