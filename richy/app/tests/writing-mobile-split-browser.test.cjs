// Run with: node --test richy/app/tests/writing-mobile-split-browser.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const app = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const source = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(text, start, end) {
    const first = text.indexOf(start), last = text.indexOf(end, first);
    assert.ok(first >= 0 && last > first, start);
    return text.slice(first, last);
}
const workspace = section(template, '<div class="idp-writing-workspace"', '<!--<div class="col-md-6 passage-text-for-media">');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8') +
    Array.from(template.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
const resizeCode = section(source, '        /* Adjustable exam panels', '        /* Reading display preferences') +
    "\n$scope.$on('$destroy', stopReadingResize);";
const splitterCode = section(source, "    angular.module('Hrm.Question').directive('readingSplitResize'", '    /* Mobile Safari/Chrome');
const growCode = section(source, "    angular.module('Hrm.Question').directive('writingTaskAutoGrow'", '    /* Floating Study-mode outline');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const chart = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#f1f6fc"/><text x="40" y="70" font-size="36">Percentage of goods bought</text><path d="M80 440h840M120 440V160h100v280M330 440V260h100v180M540 440V200h100v240M750 440V320h100v120" fill="#f8ce42" stroke="#305481" stroke-width="4"/></svg>');
function fixture() {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
    <body class="ielts-reading-test-running"><main id="qa" class="idp-reading-page idp-writing-page" ng-controller="Qa as vm">
    <div class="row margin-top-10 wrap-test idp-reading-test-shell">
      <div class="idp-exam-topbar"><span class="idp-exam-logo">IELTS <small>WRITING</small></span><div class="idp-exam-name"><strong>Test taker name</strong></div></div>
      <div class="row"><div class="col-md-12 idp-exam-stage">
        <div class="alert alert-info"><strong>Serious Test · Writing Task {{vm.part}}</strong></div>
        <div class="portlet idp-candidate-bar"><div class="portlet-body"><div class="row for-media idp-candidate-mobile"><div class="col-md-6"><button class="idp-finish-btn">Finish</button></div><div class="col-md-6"><p class="idp-timer">60 min <small>REMAINING</small></p></div></div></div></div>
        <div class="col-md-12 main-test idp-main-test">
          <div class="portlet idp-instruction-bar"><div class="portlet-body"><div class="idp-writing-part-instruction"><h3>Part {{vm.part}}</h3><h4>You should spend about 20 minutes on this task. Write at least 150 words.</h4></div></div></div>
          <div class="portlet idp-workspace"><div class="portlet-body"><div class="row idp-split-row">${workspace}</div></div></div>
        </div>
      </div></div>
    </div></main></body></html>`;
}
async function initialize(page, {fallback = false} = {}) {
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(fallback => {
        if (fallback) { window.PointerEvent = undefined; }
        angular.module('Hrm.Question', []);
    }, fallback);
    await page.addScriptTag({content: splitterCode + growCode});
    await page.evaluate(({resizeCode, chart}) => {
        angular.module('Hrm.Question').directive('compile', () => ({link(scope, element, attrs) {
            scope.$watch(attrs.compile, value => element.html(value || ''));
        }})).controller('Qa', ['$scope', '$window', function ($scope, $window) {
            const vm = this;
            Object.assign(vm, {part: 1, isWritingRoute: true, testSessionMode: 'SERIOUS',
                activeIeltsNavigationPart: () => vm.part,
                updateWritingTaskResponse() {}, hasWritingOutline: () => false, isWritingTaskWordTargetMet: () => false,
                countWritingTaskWords: answer => String(answer || '').trim().split(/\s+/).filter(Boolean).length,
                ieltsReadingActualTest: {subQuestions: [{subQuestions: [16, 17].map(type => ({type,
                    question: `<img src="${chart}" alt="Writing chart">` + '<p>Compare the figures and describe the main differences.</p>'.repeat(12),
                    subQuestions: [{questionAnswers: [{clientAnswer: ''}]}]}))}]}});
            new Function('vm', '$scope', '$window', resizeCode)(vm, $scope, $window);
            window.qaVm = vm; window.qaScope = $scope;
        }]);
        angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
    }, {resizeCode, chart});
    await page.locator('#writing-task-screen-1').waitFor();
}
async function open(browser, width, height = 812, options = {}) {
    const context = await browser.newContext({viewport: {width, height}, hasTouch: true});
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.route('http://writing.test/', route => route.fulfill({contentType: 'text/html', body: fixture()}));
    await page.goto('http://writing.test/');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await initialize(page, options);
    return {page, context, errors};
}
async function dragTouch(page, percent, cancel = false) {
    const handle = page.locator('.idp-writing-task-screen:visible .idp-writing-split-divider');
    const thumb = await handle.boundingBox();
    const screen = await page.locator('.idp-writing-task-screen:visible').boundingBox();
    const session = await page.context().newCDPSession(page);
    const x = thumb.x + thumb.width / 2;
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: thumb.y + thumb.height / 2}]});
    await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: screen.y + screen.height * percent / 100}]});
    await session.send('Input.dispatchTouchEvent', {type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: []});
    await session.detach();
    await page.waitForFunction(() => !document.body.classList.contains('idp-is-resizing'));
}
async function metrics(page) {
    return page.locator('.idp-writing-task-screen:visible').evaluate(screen => {
        const prompt = screen.querySelector('.idp-writing-prompt-pane');
        const answer = screen.querySelector('.idp-writing-answer-pane');
        const handle = screen.querySelector('.idp-writing-split-divider');
        const rect = screen.getBoundingClientRect(), p = prompt.getBoundingClientRect(), a = answer.getBoundingClientRect(), h = handle.getBoundingClientRect();
        return {height: rect.height, prompt: p.height, answer: a.height, gap: a.top - p.bottom,
            handleY: h.top + h.height / 2, boundary: p.bottom, screenBottom: rect.bottom,
            scrollHeight: screen.parentElement.scrollHeight, workspaceHeight: screen.parentElement.clientHeight,
            documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
            viewportWidth: innerWidth, viewportHeight: innerHeight};
    });
}

test('mobile Writing touch splitter resizes both panes, keeps scrolling independent and persists across tasks and reload', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        for (const width of [320, 375, 767]) {
            const {page, context, errors} = await open(browser, width);
            const before = await metrics(page);
            assert.ok(before.height > 200);
            assert.ok(Math.abs(before.prompt / before.height - .42) < .01, JSON.stringify(before));
            assert.ok(before.scrollHeight <= before.workspaceHeight + 1, 'workspace fits without an outer scrollbar');
            assert.ok(before.documentWidth <= width + 1 && before.documentHeight <= 813, 'no document overflow');
            await dragTouch(page, 65);
            const after = await metrics(page);
            assert.ok(after.prompt > before.prompt + 50 && after.answer < before.answer - 50);
            assert.ok(Math.abs(after.handleY - after.boundary) < 2, 'handle stays on the panel boundary');
            assert.ok(Math.abs(after.gap) < 1);
            assert.equal(await page.evaluate(() => qaVm.readingPanePercent), 50, 'Reading preference is independent');
            assert.ok(Math.abs(Number(await page.evaluate(() => localStorage.getItem('ieltsWritingPromptPercent'))) - 65) < 1);
            await dragTouch(page, 30, true);
            assert.ok(Math.abs((await metrics(page)).prompt / before.height - .3) < .01, 'cancel finishes the drag cleanly');
            const answerText = 'This is the answer I have written.\n'.repeat(60);
            await page.locator('#writing-task-screen-1 textarea').fill(answerText);
            await page.waitForFunction(() => document.querySelector('#writing-task-screen-1 textarea').style.height.endsWith('px'));
            const scroll = await page.evaluate(() => {
                const screen = document.getElementById('writing-task-screen-1');
                const prompt = screen.querySelector('article'), answer = screen.querySelector('.idp-writing-answer-pane');
                prompt.scrollTop = 100; const initialAnswerTop = answer.scrollTop;
                answer.scrollTop = 200;
                return {promptTop: prompt.scrollTop, answerTop: answer.scrollTop, initialAnswerTop, workspaceTop: screen.parentElement.scrollTop};
            });
            assert.equal(scroll.promptTop, 100); assert.equal(scroll.answerTop, 200); assert.equal(scroll.initialAnswerTop, 0); assert.equal(scroll.workspaceTop, 0);
            await page.evaluate(() => qaScope.$apply(() => { qaVm.part = 2; }));
            assert.ok(Math.abs((await metrics(page)).prompt / before.height - .3) < .01);
            await page.evaluate(() => qaScope.$apply(() => { qaVm.part = 1; }));
            assert.equal(await page.locator('#writing-task-screen-1 textarea').inputValue(), answerText);
            await page.reload(); await initialize(page);
            assert.ok(Math.abs((await metrics(page)).prompt / before.height - .3) < .01, 'saved position restored');
            const handle = page.locator('#writing-task-screen-1 .idp-writing-split-divider');
            await handle.press('ArrowDown');
            assert.ok(Math.abs(Number(await handle.getAttribute('aria-valuenow')) - 35) < 1);
            await handle.press('Home'); assert.equal(await handle.getAttribute('aria-valuenow'), '10');
            await handle.press('End'); assert.equal(await handle.getAttribute('aria-valuenow'), '90');
            await handle.dblclick(); assert.equal(await handle.getAttribute('aria-valuenow'), '42');
            if (width === 375) {
                const output = path.resolve(app, '../richy-api/target/codex-writing-check');
                fs.mkdirSync(output, {recursive: true});
                await page.screenshot({path: path.join(output, 'mobile-writing-split.png')});
                await page.setViewportSize({width, height: 560});
                const short = await metrics(page);
                assert.ok(short.screenBottom <= 560 && short.scrollHeight <= short.workspaceHeight + 1, JSON.stringify(short));
            }
            assert.deepEqual(errors, []);
            await context.close();
        }
    } finally { await browser.close(); }
});

test('touch fallback works; desktop remains two columns; Reading drag keeps its own preference', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const {page, context, errors} = await open(browser, 375, 812, {fallback: true});
        await dragTouch(page, 60);
        assert.ok(Math.abs(await page.evaluate(() => qaVm.writingPromptPercent) - 60) < 1);
        await page.setViewportSize({width: 1366, height: 900});
        assert.equal(await page.locator('#writing-task-screen-1 .idp-writing-split-divider').isVisible(), false);
        const desktop = await page.locator('#writing-task-screen-1').evaluate(screen => {
            const p = screen.querySelector('article').getBoundingClientRect(), a = screen.querySelector('.idp-writing-answer-pane').getBoundingClientRect();
            return {sameTop: Math.abs(p.top - a.top) < 1, sameWidth: Math.abs(p.width - a.width) < 1, columns: a.left >= p.right};
        });
        assert.deepEqual(desktop, {sameTop: true, sameWidth: true, columns: true});
        await page.evaluate(() => {
            const row = document.createElement('div'); row.style.cssText = 'position:fixed;top:100px;left:0;width:1000px;height:300px';
            const target = row.appendChild(document.createElement('div')); document.body.appendChild(row);
            qaVm.startReadingResize({type: 'mousedown', currentTarget: target, preventDefault() {}});
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 710, clientY: 200}));
            document.dispatchEvent(new MouseEvent('mouseup'));
            row.remove();
        });
        assert.equal(await page.evaluate(() => qaVm.readingPanePercent), 71);
        assert.equal(await page.evaluate(() => localStorage.getItem('ieltsReadingPanePercent')), '71');
        assert.ok(Math.abs(await page.evaluate(() => qaVm.writingPromptPercent) - 60) < 1);
        await page.setViewportSize({width: 375, height: 812});
        await dragTouch(page, 50);
        await page.evaluate(() => {
            const target = document.querySelector('#writing-task-screen-1 .idp-writing-split-divider');
            qaVm.startWritingResize({type: 'touchstart', currentTarget: target, preventDefault() {}});
            qaScope.$destroy();
        });
        assert.equal(await page.evaluate(() => document.body.classList.contains('idp-is-resizing')), false);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});
