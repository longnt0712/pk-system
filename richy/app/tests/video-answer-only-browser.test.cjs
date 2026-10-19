// Run with: node --test richy/app/tests/video-answer-only-browser.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.join(__dirname, '..');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const source = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const choices = section('<div class="col-md-12 idp-single-choice-question"', '<span style="padding-bottom: 50px;"');
const navigation = section('<div ng-hide="vm.passageNumber == 4" class="portlet bg-white bordered list-question-bottom idp-question-nav">', '<label class="idp-review-control');
const draftKey = 'ieltsReadingInProgress:7:comprehensive:test:42:serious:task:238:parts:1';

for (const scenario of [{width: 1366, enabled: false, legacy: false}, {width: 390, enabled: true, legacy: false},
    {width: 1366, enabled: false, legacy: true}]) {
    test('video answers only: real controller, navigation, answer IDs and reload at ' + scenario.width + 'px' + (scenario.legacy ? ' with legacy shuffled draft' : ' checkbox ' + scenario.enabled), async () => {
        const browser = await playwright.chromium.launch({headless: true, executablePath});
        try {
            const page = await browser.newPage({viewport: {width: scenario.width, height: 900}}), errors = [];
            page.on('pageerror', error => errors.push(error.stack));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}));
            await page.goto('http://video-order.test/comprehensive_test/42?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS');
            async function boot(first, enabled) {
                await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"><audio id="audio1"></audio>' +
                    '<div id="passage-text-1"></div><div id="passage-text-2"></div><div id="passage-text-3"></div>' +
                    '<div ng-repeat="item in vm.ieltsReadingActualTest.subQuestions[0].subQuestions">' + choices + '</div>' + navigation + '</div></div></main></body></html>');
                for (const script of ['jquery.min.js', 'angular.min.js']) await page.addScriptTag({path: path.join(app, 'assets/scripts/external', script)});
                await page.evaluate(({first, enabled, legacy, draftKey}) => {
                    window.App = {initAjax() {}}; window.toasts = []; window.saved = [];
                    const questions = Array.from({length: 8}, (_, index) => {
                        const packId = index < 4 ? 100 : 200, id = 1000 + index;
                        return {id, ordinalNumber: index + 1, question: 'Video question ' + (index + 1), videoTimeSeconds: 10 * (index + 1),
                            parent: {id: packId, type: 1}, questionAnswers: [0, 1, 2, 3].map(option => ({id: id * 10 + option, ordinalNumberQuestionAnswer: option + 1,
                                correct: option === 1, answer: {id: id * 100 + option, answer: 'Option ' + (option + 1)}, question: {id, ordinalNumber: index + 1, parent: {id: packId, type: 1}}}))};
                    });
                    const data = {id: 42, title: 'Video answer-only regression', subQuestions: [{id: 10, type: 1, question: 'Video passage', videoUrl: 'https://youtu.be/M7lc1UVf-VE',
                        questionType: {code: 'IELTSRTP1'}, subQuestions: [{id: 100, type: 1, question: 'Choose one answer', subQuestions: questions.slice(0, 4)},
                            {id: 200, type: 1, question: 'Choose one answer', subQuestions: questions.slice(4)}]},
                        {id: 11, type: 1, question: '', subQuestions: []}, {id: 12, type: 1, question: '', subQuestions: []}]};
                    if (first && legacy) {
                        const answer = questions[2].questionAnswers[1];
                        localStorage.setItem(draftKey, JSON.stringify({version: 5, userId: 7, testId: 42, testMode: 'COMPREHENSIVE', sessionMode: 'SERIOUS',
                            assignmentTaskId: 238, assignmentPart: 1, assignmentParts: [1], isPartAssignment: true, savedAt: new Date().toISOString(),
                            passageNumber: 1, currentOrdinalNumber: 3, remainingSeconds: 3450, elapsedSeconds: 150, answeredCount: 1, totalQuestions: 8,
                            comprehensiveShuffle: {enabled: true, seed: 123456789, questionOrder: questions.map(q => q.id).reverse()},
                            results: [{questionId: questions[2].id, ordinalNumber: 3, answerId: answer.id, answerOrdinal: 2, clientAnswer: 'Option 2'}],
                            questionStates: [{questionId: questions[2].id, ordinalNumber: 3, answered: true, answers: [{answerId: answer.id, answerOrdinal: 2, selected: true, clientAnswer: 'Option 2'}]}]}));
                    }
                    const cookie = JSON.stringify({id: 7, roles: [{name: 'ROLE_VIEWER'}]});
                    angular.module('Hrm.Question', []).directive('compile', ['$compile', $compile => ({link(scope, element, attrs) {
                        element.html(scope.$eval(attrs.compile)); $compile(element.contents())(scope);
                    }})]).value('settings', {}).value('Utilities', {}).value('$uibModal', {})
                        .value('$location', {path: () => location.pathname, search: () => Object.fromEntries(new URLSearchParams(location.search))})
                        .value('$stateParams', {ieltsReadingTestId: '42', assignmentTaskId: '238', assignmentPart: '1', assignmentParts: '1', sessionMode: 'SERIOUS'})
                        .value('$cookies', {getAll: () => ({'education.user': cookie})})
                        .value('blockUI', {start() {}, stop() {}})
                        .value('toastr', Object.fromEntries(['success', 'warning', 'error', 'info'].map(level => [level, (...args) => toasts.push({level, args})])))
                        .run(['$rootScope', root => { root.settings = {layout: {}}; }])
                        .factory('QuestionService', ['$q', q => ({getAssignedTask: () => q.when({activityType: 'COMPREHENSIVE', ieltsTestId: 42, shuffleQuestions: enabled}),
                            getOne: () => q.when(angular.copy(data)), getLearningDrafts: () => q.when([]),
                            saveLearningDraft(dto) { saved.push(structuredClone(dto)); return q.when(true); }, deleteLearningDraft() { throw Error('Must preserve attempt'); }})]);
                }, {first, enabled, legacy: scenario.legacy, draftKey});
                for (const script of ['question/business/ComprehensiveVideo.js', 'question/business/ComprehensiveListening.js', 'question/controllers/IELTSReadingActualTestController.js']) await page.addScriptTag({path: path.join(app, script)});
                await page.evaluate(() => { angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']); window.qaVm = angular.element(document.getElementById('qa')).scope().vm; });
                await page.waitForFunction(() => qaVm.isStartTest || qaVm.startTestError, {}, {timeout: 5000});
                assert.equal(await page.evaluate(() => qaVm.startTestError), '', errors.join('\n'));
                await page.evaluate(() => { qaVm.revealVideoQuestions(); angular.element(document.getElementById('qa')).scope().$digest(); });
            }
            const state = () => page.evaluate(() => {
                const pack = qaVm.ieltsReadingActualTest.subQuestions[0].subQuestions;
                return {packages: pack.map(p => p.id), questions: pack.flatMap(p => p.subQuestions.map(q => q.ordinalNumber)),
                    answers: pack.flatMap(p => p.subQuestions.map(q => q.questionAnswers.map(a => a.id))), seed: qaVm.comprehensiveShuffleState.seed,
                    selected: pack.flatMap(p => p.subQuestions.flatMap(q => q.questionAnswers.filter(a => a.selected).map(a => a.id))),
                    results: qaVm.testResult.questionAnswerTestResult.map(row => ({id: row.questionAnswer.id, questionId: row.questionAnswer.question.id, ordinal: row.ordinalNumber})),
                    cues: qaVm.videoTimeline.cues.map(cue => ({seconds: cue.seconds, ordinals: cue.questions.map(q => q.ordinalNumber)}))};
            });
            await boot(true, scenario.enabled);
            const initial = await state();
            assert.deepEqual(initial.packages, [100, 200]); assert.deepEqual(initial.questions, [1, 2, 3, 4, 5, 6, 7, 8]);
            assert.deepEqual((await page.locator('.idp-part-question-button').allTextContents()).map(text => Number(text.trim())), initial.questions);
            assert.deepEqual(initial.cues, initial.questions.map(ordinal => ({seconds: ordinal * 10, ordinals: [ordinal]})));
            assert.ok(initial.answers.some((answers, index) => answers.join(',') !== [0, 1, 2, 3].map(option => (1000 + index) * 10 + option).join(',')), 'answer options are shuffled');
            if (scenario.legacy) { assert.deepEqual(initial.selected, [10021]); assert.deepEqual(initial.results, [{id: 10021, questionId: 1002, ordinal: 3}]); }
            const answerId = initial.answers[0][0];
            await page.locator('.idp-single-choice-answer input').first().check();
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            // Restore protects annotation anchors briefly; wait for the real autosave to finish before reloading.
            await page.waitForFunction(({key, answerId}) => {
                const draft = JSON.parse(localStorage.getItem(key) || 'null');
                return draft && draft.comprehensiveShuffle && draft.comprehensiveShuffle.questionsEnabled === false &&
                    draft.results.some(row => row.answerId === answerId);
            }, {key: draftKey, answerId});
            const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
            assert.equal(saved.comprehensiveShuffle.questionsEnabled, false); assert.equal(saved.comprehensiveShuffle.answersEnabled, true);
            assert.ok(saved.results.some(row => row.answerId === answerId));
            await page.reload(); await boot(false, !scenario.enabled);
            const resumed = await state();
            assert.deepEqual(resumed.questions, initial.questions); assert.deepEqual(resumed.packages, initial.packages);
            assert.deepEqual(resumed.answers, initial.answers); assert.equal(resumed.seed, initial.seed); assert.deepEqual(resumed.cues, initial.cues);
            assert.ok(resumed.results.some(row => row.id === answerId && row.questionId === 1000 && row.ordinal === 1));
            assert.ok(resumed.selected.includes(answerId));
            assert.deepEqual((await page.locator('.idp-part-question-button').allTextContents()).map(text => Number(text.trim())), initial.questions);
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    });
}
