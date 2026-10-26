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
const viewportCode = controller.slice(controller.indexOf('/* Keep the active exam inside one viewport'), controller.indexOf('/* Adjustable exam panels'));
assert.ok(viewportCode.includes('unwatchExamLayout'), 'exercise the real candidate viewport lifecycle');
const shell = fs.readFileSync(path.join(app, 'common/views/application.html'), 'utf8');
const css = ['assets/css/external/bootstrap.min.css', 'assets/css/external/font-awesome.min.css', 'assets/css/components-md.min.css', 'assets/css/plugins-md.min.css',
    'assets/css/layout-hoz.min.css', 'assets/css/default.min.css', 'assets/css/custom.css', 'assets/css/ui-layer-safety.css']
    .map(name => fs.readFileSync(path.join(app, name), 'utf8')).join('\n') +
    [...view.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser, server, origin;
const wav = Buffer.alloc(44 + 8000 * 2 * 60);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
before(async () => {
    server = http.createServer((request, response) => {
        if (request.url.endsWith('/lesson.wav')) {
            const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range || '');
            if (range) {
                const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                response.writeHead(206, {'content-type':'audio/wav', 'accept-ranges':'bytes', 'content-range':`bytes ${start}-${end}/${wav.length}`, 'content-length':end-start+1});
                return response.end(wav.subarray(start, end+1));
            }
            response.writeHead(200, {'content-type':'audio/wav', 'accept-ranges':'bytes', 'content-length':wav.length});
            return response.end(wav);
        }
        if (/fontawesome-webfont\.woff2/.test(request.url)) {
            response.writeHead(200, {'content-type':'font/woff2'});
            return response.end(fs.readFileSync(path.join(app, 'assets/fonts/fontawesome-webfont.woff2')));
        }
        if (request.url.endsWith('/assets/images/troop.jpg')) {
            response.writeHead(200, {'content-type':'image/jpeg'});
            return response.end(fs.readFileSync(path.join(app, 'assets/images/troop.jpg')));
        }
        response.writeHead(200, {'content-type':'text/html'});
        response.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await (process.env.CANDIDATE_BROWSER === 'webkit' ? playwright.webkit.launch({headless:true}) : playwright.chromium.launch({headless:true, executablePath}));
});
after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
});

async function fixture({width = 1180, height = 820, listening = true, preview = false, visual = null} = {}) {
    const page = await browser.newPage({viewport:{width, height}, hasTouch:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.goto(origin);
    const content = await page.evaluate(({view, shell}) => {
        // Angular/jQuery expands legacy self-closing textareas when inserting the
        // route template. DOMParser needs the same normalization before cloning.
        const doc = new DOMParser().parseFromString(view.replace(/<textarea\b([^>]*)\/>/gi, '<textarea$1></textarea>'), 'text/html');
        const root = doc.querySelector('.idp-reading-page');
        const exam = root.querySelector('.idp-reading-test-shell');
        root.replaceChildren(exam);
        const stage = exam.querySelector('.idp-exam-stage');
        const main = stage.querySelector('.idp-main-test');
        const workspace = main.querySelector('.idp-workspace');
        const body = workspace.querySelector('.portlet-body');
        const split = body.querySelector('.idp-split-row');
        const passage = split.querySelector('.idp-reading-pane');
        const passageRow = passage.querySelector('.row').cloneNode(false);
        const text = passage.querySelector('.passage-text').cloneNode(false);
        text.innerHTML = Array.from({length:60}, (_, i) => '<p>Reading paragraph ' + (i+1) + '. This is a long passage used to exercise independent scrolling in the candidate workspace.</p>').join('');
        passageRow.append(text);
        passage.replaceChildren(passageRow);
        const questions = split.querySelector('.idp-question-pane');
        questions.innerHTML = Array.from({length:40}, (_, i) => '<p><strong>Question ' + (i+1) + '</strong></p><p>Complete the answer <input type="text" aria-label="Answer ' + (i+1) + '"></p>').join('');
        split.replaceChildren(passage, questions);
        body.replaceChildren(split);
        workspace.replaceChildren(body);
        main.replaceChildren(main.querySelector('#listening-toolbar-panel'), workspace, main.querySelector('.idp-question-nav'));
        stage.replaceChildren(main);
        const row = stage.parentElement;
        row.replaceChildren(stage);
        exam.replaceChildren(exam.querySelector('.idp-reading-preview-banner'), exam.querySelector('.idp-exam-topbar'), row);
        const appDoc = new DOMParser().parseFromString(shell, 'text/html');
        const appRoot = appDoc.querySelector('.application-shell');
        appRoot.querySelector('[ui-view]').append(root);
        appRoot.querySelector('[ui-view]').setAttribute('ng-controller', 'CandidateViewportFixture as vm');
        // The normal app chrome is retained in the shell. Its includes are replaced
        // locally so this test exercises the real fullscreen ancestor selectors.
        appRoot.querySelectorAll('[data-ng-include]').forEach(node => {
            node.removeAttribute('data-ng-include');
            node.removeAttribute('data-ng-controller');
            node.textContent = 'Normal site header or footer';
        });
        return appRoot.outerHTML;
    }, {view, shell});
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        '</style></head><body class="page-container-bg-solid">' + content + '</body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js']) await page.addScriptTag({path:path.join(app, 'assets/scripts/external/' + name)});
    await page.evaluate(() => { angular.module('Hrm', []); });
    await page.addScriptTag({path:path.join(app, 'common/utils/audio-seek.js')});
    await page.evaluate(({listening, preview, visual, viewportCode}) => {
        if (visual) {
            window.qaViewport = new EventTarget();
            Object.assign(qaViewport, {offsetTop:0, offsetLeft:0, scale:1}, visual);
            window.qaViewportListeners = new Map();
            const add = qaViewport.addEventListener.bind(qaViewport), remove = qaViewport.removeEventListener.bind(qaViewport);
            qaViewport.addEventListener = (name, fn, options) => {
                if (!qaViewportListeners.has(name)) qaViewportListeners.set(name, new Set());
                qaViewportListeners.get(name).add(fn);
                add(name, fn, options);
            };
            qaViewport.removeEventListener = (name, fn, options) => {
                qaViewportListeners.get(name)?.delete(fn);
                if (!qaViewportListeners.get(name)?.size) qaViewportListeners.delete(name);
                remove(name, fn, options);
            };
            Object.defineProperty(window, 'visualViewport', {configurable:true, value:qaViewport});
        }
        angular.module('CandidateViewport', ['Hrm']).controller('CandidateViewportFixture', ['$scope', '$window', '$timeout', function ($scope, $window, $timeout) {
            const vm = this;
            const parts = Array.from({length:listening ? 4 : 3}, (_, index) => ({number:index+1,
                questions:Array.from({length:index === 0 ? 10 : 13}, (_, q) => ({question:{id:index*100+q, ordinalNumber:index*10+q+1}}))}));
            Object.assign(vm, {
                isHasTestTakerName:true, isStartTest:true, passageNumber:1, isListeningRoute:listening, isPreviewMode:preview,
                isWritingRoute:false, isComprehensiveRoute:false, displayContrast:'black-white', readingTextSize:'regular',
                showListeningToolbar:true, showListeningContent:false, playbackValue:1, testSessionMode:'STUDY',
                isStudyMode:() => true, minimumPlaybackSpeed:() => .6, hasPendingReadingSubmission:() => false,
                isListeningContentVisible:() => listening && (preview || vm.showListeningContent), hasComprehensiveVideo:() => false,
                getRemainingMinutes:() => 0, getTimerStatusLabel:() => 'studied', getRemainingClock:() => '0:00',
                readingPaneStyle:() => innerWidth <= 996 ? {'flex-basis':'50%'} : {width:'50%'},
                questionPaneStyle:full => innerWidth <= 996 ? {'flex-basis':full ? '100%' : '50%'} : {width:full ? '100%' : '50%'},
                ieltsReadingActualTest:{title:'Cambridge IELTS 21 – Listening Test 04', subQuestions:[{type:1}]},
                testResult:{testTakerName:'Tablet learner'}, nextAssignmentParts:[],
                getIeltsNavigationParts:() => parts,
                activeIeltsNavigationPart:() => 1, ieltsNavigationAnsweredCount:() => 0
            });
            window.candidateScope = $scope;
            window.candidateVm = vm;
            new Function('$scope', '$window', '$timeout', 'vm', 'stopReadingResize', 'writingTaskDraftTimer', viewportCode)($scope, $window, $timeout, vm, () => {}, null);
        }]);
        angular.bootstrap(document.body, ['CandidateViewport']);
        if (listening) document.getElementById('main-audio').src = '/lesson.wav';
    }, {listening, preview, visual, viewportCode});
    await page.waitForFunction(() => document.body.classList.contains('ielts-reading-test-running'));
    if (listening) await page.waitForFunction(() => document.getElementById('main-audio').duration === 60);
    return {page, errors};
}

async function bounds(page) {
    return page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height}; };
        const viewport = window.qaViewport || window.visualViewport;
        return {body:rect('body'), shell:rect('.idp-reading-test-shell'), topbar:rect('.idp-exam-topbar'),
            toolbar:rect('#listening-toolbar-panel'), nav:rect('.idp-question-nav'), workspace:rect('.idp-workspace'),
            passage:rect('.passage-text'), questions:rect('.question-content'), preview:document.querySelector('.idp-reading-preview-banner') ? rect('.idp-reading-preview-banner') : null,
            visual:{top:viewport?.offsetTop || 0, height:viewport?.height || innerHeight, width:viewport?.width || innerWidth},
            pageWidth:document.documentElement.scrollWidth, pageScroll:document.scrollingElement.scrollTop};
    });
}

function assertChromeVisible(layout) {
    assert.ok(layout.nav.height >= 50, JSON.stringify(layout));
    assert.ok(layout.nav.bottom <= layout.visual.top + layout.visual.height + 1, JSON.stringify(layout));
    assert.ok(layout.nav.bottom >= layout.visual.top + layout.visual.height - 20, JSON.stringify(layout));
    assert.ok(layout.workspace.top >= layout.topbar.bottom - 1, JSON.stringify(layout));
    assert.ok(layout.workspace.bottom <= layout.nav.top + 1, JSON.stringify(layout));
    assert.ok(layout.workspace.height > 60, JSON.stringify(layout));
    assert.equal(layout.pageScroll, 0);
    assert.ok(layout.pageWidth <= layout.visual.width + 1, JSON.stringify(layout));
}

test('full candidate shell keeps Part navigation visible while only Reading and Listening content scrolls', async () => {
    for (const listening of [false, true]) for (const size of [{width:1024,height:620}, {width:1180,height:680}, {width:820,height:1000}]) {
        const {page, errors} = await fixture({...size, listening});
        try {
            assertChromeVisible(await bounds(page));
            const pane = page.locator('.question-content');
            await pane.evaluate(node => { node.scrollTop = 800; });
            assert.ok(await pane.evaluate(node => node.scrollTop) > 100);
            if (!listening) {
                await page.locator('.passage-text').evaluate(node => { node.scrollTop = 600; });
                assert.ok(await page.locator('.passage-text').evaluate(node => node.scrollTop) > 100);
            }
            await page.mouse.move(size.width / 2, 10);
            await page.mouse.wheel(0, 500);
            assertChromeVisible(await bounds(page));
            await page.setViewportSize({width:size.height, height:size.width});
            await page.evaluate(() => { candidateScope.$digest(); });
            await page.waitForTimeout(70);
            assertChromeVisible(await bounds(page));
            if (listening) {
                const before = (await bounds(page)).workspace.height;
                await page.locator('#listening-toolbar-switch').check({force:true});
                await page.evaluate(() => { candidateVm.showListeningToolbar = false; candidateScope.$digest(); });
                assert.equal(await page.locator('#listening-toolbar-panel').isVisible(), false);
                assert.ok((await bounds(page)).workspace.height > before);
                assertChromeVisible(await bounds(page));
            }
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    }
});

test('Preview is a separate row and a shorter Safari visual viewport keeps the bottom navigation accessible', async () => {
    const {page, errors} = await fixture({preview:true, visual:{width:1180, height:640}});
    try {
        let layout = await bounds(page);
        assertChromeVisible(layout);
        assert.ok(layout.preview.bottom <= layout.topbar.top + 1, JSON.stringify(layout));
        assert.ok(layout.toolbar.top >= layout.topbar.bottom - 1, JSON.stringify(layout));
        if (process.env.CANDIDATE_SCREENSHOT) await page.screenshot({path:process.env.CANDIDATE_SCREENSHOT,
            clip:{x:0, y:layout.visual.top, width:layout.visual.width, height:layout.visual.height}});
        await page.locator('.question-content input').nth(10).evaluate(input => input.focus({preventScroll:true}));
        await page.waitForTimeout(70);
        await page.evaluate(() => {
            Object.assign(qaViewport, {height:430, offsetTop:35});
            qaViewport.dispatchEvent(new Event('resize'));
            qaViewport.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(70);
        layout = await bounds(page);
        assertChromeVisible(layout);
        assert.ok(Math.abs(layout.body.top - 35) <= 1, JSON.stringify(layout));
        assert.ok(Math.abs(layout.body.height - 430) <= 1, JSON.stringify(layout));
        assert.ok(await page.evaluate(() => {
            const answer = document.activeElement.getBoundingClientRect();
            const pane = document.activeElement.closest('.question-content').getBoundingClientRect();
            return answer.top >= pane.top && answer.bottom <= pane.bottom;
        }), 'the focused answer remains visible above the software keyboard');
        const normalHeight = layout.body.height;
        await page.evaluate(() => {
            Object.assign(qaViewport, {height:215, width:590, offsetTop:100, scale:2});
            qaViewport.dispatchEvent(new Event('resize'));
            qaViewport.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(70);
        assert.equal((await bounds(page)).body.height, normalHeight, 'pinch zoom magnifies the existing layout without shrinking it');
        await page.evaluate(() => {
            Object.assign(qaViewport, {height:640, width:1180, offsetTop:0, scale:1});
            qaViewport.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(70);
        assertChromeVisible(await bounds(page));
        await page.evaluate(() => { candidateVm.isStartTest = false; candidateScope.$digest(); });
        assert.equal(await page.evaluate(() => document.body.classList.contains('ielts-reading-test-running')), false);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ielts-reading-test-running')), false);
        assert.equal(await page.evaluate(() => qaViewportListeners.size), 0);
        assert.equal(await page.locator('meta[name="viewport"]').getAttribute('content'), 'width=device-width,initial-scale=1');
        await page.evaluate(() => { candidateVm.isStartTest = true; candidateScope.$digest(); });
        await page.waitForTimeout(70);
        assertChromeVisible(await bounds(page));
        await page.evaluate(() => { candidateScope.$destroy(); });
        assert.equal(await page.evaluate(() => qaViewportListeners.size), 0);
        assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--idp-viewport-height')), '');
        assert.equal(await page.evaluate(() => document.body.classList.contains('ielts-reading-test-running')), false);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ielts-reading-test-running')), false);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
