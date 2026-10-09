const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(value => fs.existsSync(value));
const builderTemplate = fs.readFileSync(path.join(app, 'question/views/create_ielts_reading_test.html'), 'utf8');
const runtimeTemplate = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const builderSource = fs.readFileSync(path.join(app, 'question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const builderHtml = section(builderTemplate, '<section class="comprehensive-listening-builder"', '</section>') + '</section>';
const runtimeHtml = section(runtimeTemplate, '<div class="idp-one-editor-runtime', '</div>') + '</div>';
const builderCode = section(builderSource, '        vm.dailyListeningNeedsGenerate =', '        vm.addDailyListeningPackage =');
const renderCode = section(runtimeSource, '        function buildOneEditorQuestion(', '        function shuffleCompleteListWords(');
const answerCode = section(runtimeSource, '        vm.changeTextQuestionAnswer =', '        vm.hoverAnswerMatchingHeading=');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8') +
    fs.readFileSync(path.join(app, 'assets/css/comprehensive-listening.css'), 'utf8');

function audioFixture() {
    const wave = Buffer.alloc(44 + 8000 * 2 * 12);
    wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVE', 8); wave.write('fmt ', 12);
    wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(8000, 24);
    wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
    return wave;
}

async function pageWithAngular(browser, origin, width, html) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    page.setDefaultTimeout(10000);
    // Serve the entire fixture through Playwright; this test needs no network.
    await page.route('**/*', route => {
        if (route.request().url() !== origin + '/audio.wav') {
            return route.fulfill({status: 200, contentType: 'text/html', body: '<html><head></head><body></body></html>'});
        }
        const wave = audioFixture(), range = (route.request().headers().range || '').match(/bytes=(\d+)-(\d*)/);
        const start = range ? Number(range[1]) : 0, end = range && range[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1;
        const headers = {'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1)};
        if (range) { headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + wave.length; }
        return route.fulfill({status: range ? 206 : 200, contentType: 'audio/wav', headers, body: wave.subarray(start, end + 1)});
    });
    await page.goto(origin);
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + css +
        'main {padding:16px;max-width:900px;margin:auto;} .reading-one-editor-input {width:100px;margin:4px;} .reading-one-editor-answers input {margin-bottom:8px;} * {box-sizing:border-box;}</style></head><body>' +
        '<main id="qa" ng-controller="Qa as vm">' + html + '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(() => {
        angular.module('Hrm.Question', []).directive('compile', ['$compile', function ($compile) {
            return {link(scope, element, attrs) { scope.$watch(attrs.compile, value => { element.html(value || ''); $compile(element.contents())(scope); }); }};
        }]);
    });
    for (const name of ['ComprehensiveVideo', 'ComprehensiveListening']) {
        await page.addScriptTag({path: path.join(app, 'question/business/' + name + '.js')});
    }
    return page;
}

test('teacher pastes transcript, generates a mixed-test section, and a student fills and restores its answers on desktop and mobile', async () => {
    const origin = 'http://daily-listening.test';
    const browser = await playwright.chromium.launch({headless: true, executablePath: chromePath});
    try {
        for (const width of [1366, 390]) {
            const author = await pageWithAngular(browser, origin, width, '<div ng-init="item=vm.ieltsReadingTest.subQuestions[0].subQuestions[1]">' + builderHtml + '</div>');
            const errors = []; author.on('pageerror', error => errors.push(error.message));
            await author.evaluate(({builderCode}) => {
                angular.module('Hrm.Question').controller('Qa', ['ComprehensiveListening', function (listening) {
                    const vm = this, pack = {type: 18, question: 'Daily Listening', _listeningGapRate: 50, subQuestions: []};
                    Object.assign(vm, {isComprehensiveMode: true, ieltsReadingTest: {subQuestions: [{subQuestions: [
                        {type: 1, subQuestions: [{ordinalNumber: 1}]}, pack, {type: 16, subQuestions: [{ordinalNumber: 2}]}]}]},
                        getOrdinalNumber() {}, refreshBuilderValidation() {}, changeInTheProcessOfCreatingReadingTest() {}});
                    new Function('vm', 'listening', 'angular', 'toastr', builderCode)(vm, listening, angular, {success() {}, warning(message) { throw new Error(message); }});
                    window.qaVm = vm;
                }]);
                angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
            }, {builderCode});
            await author.getByRole('textbox', {name: 'Link audio hoặc YouTube', exact: true}).fill(origin + '/audio.wav');
            await author.getByRole('textbox', {name: 'Transcript tiếng Anh', exact: true}).fill('Alice visits London, then buys 12.5 tickets.');
            await author.getByRole('spinbutton', {name: 'Tỷ lệ ô trống', exact: true}).fill('100');
            await author.getByRole('button', {name: 'Tạo ô trống', exact: true}).click();
            await author.getByText('5 ô trống', {exact: true}).waitFor();
            assert.equal(await author.getByRole('textbox', {name: 'Transcript tiếng Anh', exact: true}).inputValue(), 'Alice visits London, then buys 12.5 tickets.');
            assert.ok(await author.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            const saved = await author.evaluate(() => {
                const pack = structuredClone(window.qaVm.ieltsReadingTest.subQuestions[0].subQuestions[1]); pack.id = 42;
                pack.subQuestions.forEach((question, index) => { question.id = index + 100; question.parent = {type: 18};
                    question.questionAnswers.forEach(answer => { answer.id = index + 1000; answer.question = {id: question.id, parent: {type: 18}}; }); });
                return pack;
            });
            const student = await pageWithAngular(browser, origin, width, '<div ng-repeat="item in vm.ieltsReadingActualTest.subQuestions[0].subQuestions">' + runtimeHtml + '</div>');
            student.on('pageerror', error => errors.push(error.message));
            await student.evaluate(({saved, renderCode, answerCode}) => {
                angular.module('Hrm.Question').controller('Qa', function () {
                    const vm = this;
                    Object.assign(vm, {passageNumber: 1, ieltsReadingActualTest: {subQuestions: [{subQuestions: [saved]}]}, testResult: {questionAnswerTestResult: []}, clickShowChildren() {}});
                    new Function('angular', 'pack', renderCode + '\nbuildOneEditorQuestion(pack);')(angular, saved);
                    new Function('vm', 'angular', 'document', answerCode)(vm, angular, document);
                    window.qaVm = vm;
                });
                angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
            }, {saved, renderCode, answerCode});
            assert.equal(await student.locator('.reading-one-editor-input').count(), 5);
            await student.getByRole('button', {name: 'Phát audio', exact: true}).waitFor();
            await student.locator('.reading-one-editor-input').first().fill('visits');
            assert.equal(await student.evaluate(() => window.qaVm.testResult.questionAnswerTestResult[0].clientAnswer), 'visits');
            await student.getByRole('button', {name: 'Tiến 3 giây'}).click();
            await student.waitForFunction(() => document.querySelector('audio').currentTime === 3);
            await student.getByRole('combobox', {name: 'Tốc độ audio'}).selectOption('1.5');
            assert.equal(await student.locator('audio').evaluate(audio => audio.playbackRate), 1.5);
            const retained = await student.evaluate(() => JSON.parse(JSON.stringify(window.qaVm.ieltsReadingActualTest)));
            assert.equal(retained.subQuestions[0].subQuestions[0].subQuestions[0].questionAnswers[0].clientAnswer, 'visits');
            assert.equal(retained.subQuestions[0].subQuestions[0]._listeningAudioTime, 3);
            await student.evaluate(() => {
                const root = angular.element(document.getElementById('qa')).scope();
                root.$apply(() => { window.qaVm.passageNumber = 4; });
            });
            assert.equal(await student.locator('audio').count(), 0, 'submitting/results removes and stops the audio player');
            await student.evaluate(() => {
                const root = angular.element(document.getElementById('qa')).scope();
                root.$apply(() => { window.qaVm.passageNumber = 1; });
            });
            await student.waitForFunction(() => document.querySelector('audio').currentTime === 3);
            assert.equal(await student.locator('.reading-one-editor-input').first().inputValue(), 'visits');
            assert.ok(await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            assert.deepEqual(errors, []);
            const output = path.join(app, '../../.tmp'); fs.mkdirSync(output, {recursive: true});
            await author.screenshot({path: path.join(output, 'comprehensive-listening-author-' + width + '.png'), fullPage: true});
            await student.screenshot({path: path.join(output, 'comprehensive-listening-student-' + width + '.png'), fullPage: true});
            await author.close(); await student.close();
        }
    } finally { await browser.close(); }
});

test('YouTube starts at the saved position, supports speed and seek controls, and cleans up on leaving the section', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chromePath});
    try {
        const page = await pageWithAngular(browser, 'http://daily-listening.test', 390,
            '<comprehensive-listening-player ng-if="vm.visible" audio-link="vm.link" position="vm.position"></comprehensive-listening-player>');
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.evaluate(() => {
            window.YT = {Player: function (target, config) {
                const frame = document.createElement('iframe'); frame.title = 'YouTube fixture'; target.replaceWith(frame);
                const player = window.qaPlayer = {seconds: config.playerVars.start, rate: 1, destroyed: false,
                    getCurrentTime() { return this.seconds; }, getDuration() { return 300; },
                    seekTo(seconds) { this.seconds = seconds; }, setPlaybackRate(rate) { this.rate = rate; },
                    playVideo() { config.events.onStateChange({data: 1}); }, pauseVideo() { config.events.onStateChange({data: 2}); },
                    destroy() { this.destroyed = true; }};
                setTimeout(() => config.events.onReady({target: player}), 0);
                return player;
            }};
            angular.module('Hrm.Question').controller('Qa', function () {
                Object.assign(this, {visible: true, link: 'https://youtu.be/M7lc1UVf-VE?t=90', position: 37}); window.qaVm = this;
            });
            angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        });
        await page.getByRole('button', {name: 'Phát audio', exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.qaPlayer.seconds), 37);
        await page.getByRole('button', {name: 'Lùi 3 giây'}).click();
        assert.equal(await page.evaluate(() => window.qaPlayer.seconds), 34);
        await page.getByRole('combobox', {name: 'Tốc độ audio'}).selectOption('1.5');
        assert.equal(await page.evaluate(() => window.qaPlayer.rate), 1.5);
        await page.getByRole('button', {name: 'Phát audio', exact: true}).click();
        await page.getByRole('button', {name: 'Tạm dừng', exact: true}).waitFor();
        await page.evaluate(() => angular.element(document.getElementById('qa')).scope().$apply(() => { window.qaVm.visible = false; }));
        assert.equal(await page.evaluate(() => window.qaPlayer.destroyed), true);
        assert.equal(await page.locator('iframe').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
