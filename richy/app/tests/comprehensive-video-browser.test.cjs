const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const builder = fs.readFileSync(path.join(app, 'question/views/create_ielts_reading_test.html'), 'utf8');
const candidate = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const builderController = fs.readFileSync(path.join(app, 'question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const candidateController = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(text, start, end) {
    const index = text.indexOf(start); assert.ok(index >= 0, start);
    const stop = text.indexOf(end, index); assert.ok(stop > index, end);
    return text.slice(index, stop);
}
const runtimePane = section(candidate, '<section class="comprehensive-video-runtime"', '</section>') + '</section>';
const singleChoice = section(candidate, '<div class="col-md-12 idp-single-choice-question"', '<span style="padding-bottom: 50px;"');
const builderCue = section(builder, '<div class="comprehensive-video-cue-field" ng-if="vm.isVideoBuilder() && item.type == 1"', '<div class="col-md-12">');
const runtimeCode = section(candidateController, '        vm.videoApi = {};', '        vm.assignmentTaskId =');
const builderCode = section(builderController, "        vm.comprehensiveContentMode = 'TEXT';", '        vm.testModeName =');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8') +
    Array.from(candidate.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), match => match[1]).join('\n') +
    fs.readFileSync(path.join(app, 'assets/css/comprehensive-video.css'), 'utf8');

async function pageWithAngular(browser, html, width) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    page.setDefaultTimeout(10000);
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + css +
        '</style></head><body><main id="qa" class="idp-reading-page idp-comprehensive-page" ng-controller="Qa as vm">' + html + '</main></body></html>');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(() => {
        angular.module('Hrm.Question', []);
        // Keep tests deterministic while exercising the actual API adapter.
        window.player = {seconds: 0, paused: true, pauseCount: 0, seeks: [], getCurrentTime() { return this.seconds; }, getDuration() { return 300; },
            pauseVideo() { this.paused = true; this.pauseCount++; }, playVideo() { this.paused = false; }, seekTo(value) { this.seconds = value; this.seeks.push(value); }, destroy() {}};
        window.YT = {Player: function (target, config) {
            const frame = document.createElement('iframe'); frame.title = 'Video YouTube'; target.replaceWith(frame);
            setTimeout(() => config.events.onReady({target: window.player}), 0);
            return window.player;
        }};
    });
    await page.addScriptTag({path: path.join(app, 'question/business/ComprehensiveVideo.js')});
    return page;
}

test('real Angular renders video on the left, pauses at 01:30, accepts an answer and resumes on desktop and mobile', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
    try {
        for (const width of [1366, 390]) {
            const html = '<div class="idp-workspace"><div class="portlet-body"><div class="row idp-split-row">' +
                '<div class="col-md-6 idp-reading-pane" style="width:50%">' + runtimePane + '</div>' +
                '<div class="col-md-6 idp-question-pane" style="width:50%"><div ng-repeat="item in vm.ieltsReadingActualTest.subQuestions[0].subQuestions" ng-show="vm.videoPackageVisible(item)">' + singleChoice + '</div></div></div></div></div>';
            const page = await pageWithAngular(browser, html, width), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.evaluate(({runtimeCode}) => {
                angular.module('Hrm.Question').directive('compile', function () { return {link(scope, element, attrs) {
                    scope.$watch(attrs.compile, value => element.html(value || ''));
                }}; }).controller('Qa', ['$scope', '$timeout', '$window', 'ComprehensiveVideo', function ($scope, $timeout, $window, video) {
                    const vm = this;
                    Object.assign(vm, {isComprehensiveRoute: true, isStartTest: true, passageNumber: 1,
                        ieltsReadingActualTest: {subQuestions: [{videoUrl: 'https://youtu.be/M7lc1UVf-VE', subQuestions: [{type: 1, subQuestions: [
                            {ordinalNumber: 1, question: 'What happened at 01:30?', videoTimeSeconds: 90, parent: {type: 1}, questionAnswers: [
                                {answer: {answer: 'The student opened a book'}, ordinalNumberQuestionAnswer: 1},
                                {answer: {answer: 'The student closed a door'}, ordinalNumberQuestionAnswer: 2}]},
                            {ordinalNumber: 2, question: 'What happened at 03:00?', videoTimeSeconds: 180, parent: {type: 1}, questionAnswers: [
                                {answer: {answer: 'They went home'}, ordinalNumberQuestionAnswer: 1}]}]}]}]}});
                    new Function('vm', 'video', '$scope', '$timeout', '$window', runtimeCode)(vm, video, $scope, $timeout, $window);
                    vm.checkBoxMultipleChoiceQuestions = (answer, question) => { answer.selected = true; answer.clientAnswer = answer.answer.answer; question.answered = true; };
                    vm.openQuestionIfNotSelecting = vm.clickShowChildren = () => {};
                    window.qaVm = vm; window.qaScope = $scope;
                }]);
                angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
            }, {runtimeCode});
            await page.waitForFunction(() => window.qaVm.videoApi.ready);
            assert.equal(await page.locator('iframe[title="Video YouTube"]').count(), 1);
            assert.equal(await page.getByText('What happened at 01:30?').count(), 0);
            await page.evaluate(() => { window.player.seconds = 90; });
            await page.getByText('What happened at 01:30?').waitFor();
            assert.equal(await page.evaluate(() => window.player.paused), true);
            assert.equal(await page.getByText('What happened at 03:00?').count(), 0);
            assert.equal(await page.getByRole('button', {name: 'Tiếp tục video'}).isDisabled(), true);
            await page.getByRole('radio', {name: 'The student opened a book'}).check();
            await page.getByRole('button', {name: 'Tiếp tục video'}).click();
            assert.equal(await page.evaluate(() => window.player.paused), false);
            const bounds = await page.locator('.idp-reading-pane').boundingBox();
            const questions = await page.locator('.idp-question-pane').boundingBox();
            assert.ok(width > 996 ? bounds.x < questions.x : bounds.y < questions.y);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await page.evaluate(() => { window.player.seconds = 280; });
            await page.getByText('What happened at 03:00?').waitFor();
            assert.equal(await page.evaluate(() => window.player.seeks.at(-1)), 180);
            assert.equal(await page.evaluate(() => window.player.paused), true);
            assert.deepEqual(errors, []);
            await page.screenshot({path: path.join(app, '../../.tmp/comprehensive-video-student-' + width + '.png'), fullPage: true});
            await page.close();
        }
    } finally { await browser.close(); }
});

test('author enters a cue, previews the cue and sees invalid seconds without losing the saved question', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
    try {
        const page = await pageWithAngular(browser, '<div ng-init="item=vm.ieltsReadingTest.subQuestions[0].subQuestions[0];q=item.subQuestions[0]">' + builderCue + '</div>', 1366);
        await page.evaluate(({builderCode}) => {
            angular.module('Hrm.Question').controller('Qa', ['$scope', '$timeout', '$window', 'ComprehensiveVideo', function ($scope, $timeout, $window, video) {
                const vm = this, toastr = {warning() {}};
                Object.assign(vm, {isComprehensiveMode: true, ieltsReadingTest: {subQuestions: [{videoUrl: 'https://youtu.be/M7lc1UVf-VE', subQuestions: [
                    {type: 1, subQuestions: [{ordinalNumber: 1, videoTimeSeconds: 60, question: 'Saved question'}]}]}]},
                    changeInTheProcessOfCreatingReadingTest() {}, refreshBuilderValidation() {}});
                new Function('vm', 'video', '$scope', '$timeout', '$window', 'toastr', builderCode)(vm, video, $scope, $timeout, $window, toastr);
                vm.builderVideoApi = {ready: true, seek(value) { window.previewCue = value; }, play() { window.previewStarted = true; }};
                window.qaVm = vm;
            }]);
            angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        }, {builderCode});
        const input = page.getByRole('textbox', {name: 'Mốc video của câu 1'});
        assert.equal(await input.inputValue(), '01:00');
        await input.fill('01:30');
        assert.equal(await page.evaluate(() => window.qaVm.ieltsReadingTest.subQuestions[0].subQuestions[0].subQuestions[0].videoTimeSeconds), 90);
        await page.getByRole('button', {name: 'Xem tại mốc'}).click();
        assert.equal(await page.evaluate(() => window.previewCue), 90);
        await input.fill('01:75');
        await page.getByText('Nhập phút:giây, ví dụ 01:30 (giây từ 00 đến 59).').waitFor();
        assert.equal(await page.getByRole('button', {name: 'Xem tại mốc'}).isDisabled(), true);
        assert.equal(await page.evaluate(() => window.qaVm.ieltsReadingTest.subQuestions[0].subQuestions[0].subQuestions[0].question), 'Saved question');
        assert.equal(await page.evaluate(() => {
            window.qaVm.setComprehensiveContentMode('TEXT');
            window.qaVm.setComprehensiveContentMode('TEXT');
            window.qaVm.setComprehensiveContentMode('VIDEO');
            return window.qaVm.ieltsReadingTest.subQuestions[0].videoUrl;
        }), 'https://youtu.be/M7lc1UVf-VE', 'switching content mode preserves the video link');
        await page.close();
    } finally { await browser.close(); }
});
