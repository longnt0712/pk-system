const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const builder = fs.readFileSync(path.join(app, 'question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const builderTemplate = fs.readFileSync(path.join(app, 'question/views/create_ielts_reading_test.html'), 'utf8');
const library = fs.readFileSync(path.join(app, 'question/controllers/IELTSTestLibraryController.js'), 'utf8');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
function section(text, start, end, offset = 0) {
    const first = text.indexOf(start, offset), last = text.indexOf(end, first);
    assert.ok(first >= 0 && last > first, start);
    return text.slice(first, last);
}
const initialization = section(source, '        var vm = this;', '        vm.videoApi = {};', source.indexOf('    function IELTSReadingActualTestController('));
const persistence = section(source, '        var readingDraftBaseKey =', '        var currentPerson =');
const submissionIdentity = section(source, '        function readingSubmissionType()', '        function persistReadingSubmissionState()');
const annotations = section(source, '        var savedAnnotationRange =', '        vm.setReviewQuestion =');
const preview = section(builder, '        function clearOldReadingPreviews()', '        vm.publishReadingTest =');
const libraryUrl = section(library, '        vm.testCatalogUrl = function', '        vm.seriousTestCatalogUrl =');
const catalogActions = section(builderTemplate, '<div class="test-explorer-file-actions">', '</div>') + '</div>';
const catalogHtml = `<!doctype html><html><head><meta charset="utf-8"><base href="http://ielts-notes.test/"></head><body>
<main id="catalog" ng-controller="Catalog as vm">${catalogActions}<button ng-click="vm.previewReadingTest(1)">Preview Part 1</button></main>
<script src="jquery.js"></script><script src="angular.js"></script><script>
angular.module('CatalogApp', []).controller('Catalog', ['$scope', '$window', function ($scope, $window) {
    const vm = this; $scope.item = {id: 42, title: 'Reading test'};
    vm.ieltsReadingTest = {id: 42, title: 'Reading test', subQuestions: []};
    const toastr = {error(message) { throw Error(message); }, warning(message) { throw Error(message); }};
    new Function('vm', '$window', 'angular', 'toastr', ${JSON.stringify(preview)})(vm, $window, angular, toastr);
}]);
angular.bootstrap(document.getElementById('catalog'), ['CatalogApp']);
</script></body></html>`;
const code = initialization + `
    vm.currentUser = {id: 7}; vm.testSessionMode = 'STUDY'; vm.passageNumber = 1;
    vm.isPartAssignment = false; vm.assignmentTaskId = null; vm.assignedParts = [];
    const question = {id: 101, ordinalNumber: 1, questionAnswers: [{id: 201, ordinalNumberQuestionAnswer: 1, question: {id: 101}}]};
    vm.ieltsReadingActualTest = {id: 42, title: 'Reading test', subQuestions: [{subQuestions: [{type: 2, subQuestions: [question]}]}]};
    vm.testResult = {questionAnswerTestResult: []};
    vm.autoScrollToView = angular.noop; vm.activeIeltsNavigationPart = () => 1;
    let timerRestoredFromDraft = false;
    const maximumAssignedPart = 3;
    function getReadingQuestionEntries() { return [{question, packageType: 2, passageNumber: 1}]; }
    function getAllReadingQuestionEntries() { return getReadingQuestionEntries(); }
    function syncTimerForPersistence() {} function getActiveDurationSeconds() { return 30; }
    function setStudyElapsedSeconds() {} function setCountdownSeconds() {}
    const toastr = {success() {}};
` + submissionIdentity + persistence + annotations + `
    vm.persist = saveReadingDraft;
    vm.answerChanged = function () {
        vm.testResult.questionAnswerTestResult = [{ordinalNumber: 1, questionAnswer: question.questionAnswers[0], clientAnswer: vm.answer || ''}];
        saveReadingDraft();
    };
    function ready() {
        if (!vm.isPreviewMode) {
            restoreReadingDraft();
            vm.answer = (vm.testResult.questionAnswerTestResult[0] || {}).clientAnswer || '';
        }
        vm.isStartTest = true; vm.ready = true;
    }
    if (readingLearningDraftsReady) { readingLearningDraftsReady.then(ready); } else { ready(); }
    window.qaVm = vm; window.qaScope = $scope;
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><base href="http://ielts-notes.test/"></head><body>
<main id="qa" ng-controller="Qa as vm">
  <span ng-if="vm.ready">Ready</span>
  <p id="passage-text-1" class="passage-text" ng-mouseup="showSelectionTools($event)">Rats live here. Remember this detail.</p>
  <input aria-label="Answer" ng-model="vm.answer" ng-change="vm.answerChanged()">
  <button ng-click="applySelectionNote()">Note</button><button ng-click="applySelectionHighlight()">Highlight</button>
  <textarea aria-label="Note text" ng-if="vm.activeAnnotationNote" ng-model="vm.activeAnnotationNote.specificNote"></textarea>
</main>
<script src="jquery.js"></script><script src="angular.js"></script><script>
angular.module('QaApp', []).controller('Qa', ['$scope', '$window', '$timeout', '$q', function ($scope, $window, $timeout, $q) {
    const params = Object.fromEntries(new URLSearchParams(location.search));
    const $location = {path: () => location.pathname, search: () => params};
    const $stateParams = {ieltsReadingTestId: location.pathname.includes('preview-local') ? 'preview-local' : 42};
    const service = {
        getLearningDrafts: () => $q.when(fetch('/api/drafts').then(response => response.json())),
        saveLearningDraft: dto => $q.when(fetch('/api/drafts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dto)}).then(response => response.json())),
        deleteLearningDraft: () => $q.when(true)
    };
    new Function('$scope', '$window', '$timeout', '$location', '$stateParams', 'service', ${JSON.stringify(code)})
        .call(this, $scope, $window, $timeout, $location, $stateParams, service);
}]);
angular.bootstrap(document.getElementById('qa'), ['QaApp']);
</script></body></html>`;

test('the learner library opens Study in every IELTS mode', () => {
    for (const [mode, route] of [['READING', 'ielts_reading_actual_test'], ['LISTENING', 'ielts_listening_actual_test'], ['WRITING', 'ielts_writing_actual_test'], ['COMPREHENSIVE', 'comprehensive_test']]) {
        const vm = {isComprehensiveMode: mode === 'COMPREHENSIVE', isWritingMode: mode === 'WRITING', isListeningMode: mode === 'LISTENING'};
        new Function('vm', libraryUrl)(vm);
        assert.equal(vm.testCatalogUrl({id: 42}), route + '/42?sessionMode=STUDY', mode);
    }
});

test('Study annotations survive builder Preview and return to Study; the catalog has no Xem bai action and deletion still persists', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath});
    try {
        const context = await browser.newContext();
        const drafts = new Map(), requests = [];
        await context.route('http://ielts-notes.test/**', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.pathname === '/api/drafts') {
                requests.push({method: request.method(), url: request.url()});
                if (request.method() === 'POST') {
                    const dto = request.postDataJSON(); drafts.set(dto.draftKey, {id:1,...dto, savedAt: Date.now()});
                    return route.fulfill({json: drafts.get(dto.draftKey)});
                }
                return route.fulfill({json: [...drafts.values()]});
            }
            if (url.pathname === '/jquery.js' || url.pathname === '/angular.js') {
                return route.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(app, 'assets/scripts/external', url.pathname === '/jquery.js' ? 'jquery.min.js' : 'angular.min.js'), 'utf8')});
            }
            return route.fulfill({contentType: 'text/html', body: url.pathname === '/builder' ? catalogHtml : html});
        });
        const page = await context.newPage(), errors = [];
        context.on('page', current => current.on('pageerror', error => errors.push(error.message)));
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://ielts-notes.test/ielts_reading_actual_test/42?sessionMode=STUDY');
        await page.waitForFunction(() => window.qaVm && window.qaVm.ready === true);
        await page.getByRole('textbox', {name: 'Answer', exact: true}).fill('rats');
        await page.evaluate(() => {
            const paragraph = document.getElementById('passage-text-1');
            const range = document.createRange(); range.setStart(paragraph.firstChild, 0); range.setEnd(paragraph.firstChild, 4);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
            qaScope.$apply(() => qaScope.showSelectionTools({target: paragraph}));
        });
        await page.getByRole('button', {name: 'Note', exact: true}).click();
        await page.getByRole('textbox', {name: 'Note text', exact: true}).fill('Ghi chú cần giữ');
        await page.evaluate(() => {
            const marker = document.querySelector('.ielts-annotation.has-note');
            const range = document.createRange(); range.selectNodeContents(marker);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
            qaScope.$apply(() => qaScope.showSelectionTools({target: marker}));
        });
        await page.getByRole('button', {name: 'Highlight', exact: true}).click();
        await page.evaluate(() => {
            const paragraph = document.getElementById('passage-text-1'), text = paragraph.lastChild;
            const start = text.textContent.indexOf('Remember');
            const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + 8);
            getSelection().removeAllRanges(); getSelection().addRange(range);
            qaScope.$apply(() => { qaScope.showSelectionTools({target: paragraph}); qaScope.applySelectionHighlight(); });
        });
        await page.waitForFunction(() => qaVm.readingDraftSyncStatus === 'saved');
        const key = 'ieltsReadingInProgress:7:reading:test:42';
        const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        assert.equal(before.annotationNotes[0].specificNote, 'Ghi chú cần giữ');
        assert.equal(before.annotations[0].highlighted, true);
        assert.equal(before.annotations.length, 2);
        assert.equal(before.annotations[1].highlighted, true);
        assert.equal(before.annotations[1].hasNote, false, 'standalone highlights must survive too');
        // Route removal may detach the passage before the controller's final save.
        await page.evaluate(() => {
            const scope = qaScope;
            angular.element(document.getElementById('qa')).remove();
            scope.$destroy();
        });
        await page.waitForFunction(() => qaVm.readingDraftSyncStatus === 'saved');
        const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        assert.deepEqual(after.annotations, before.annotations, 'destroy save must preserve anchors');
        assert.equal(after.results[0].clientAnswer, 'rats');
        await page.goto('http://ielts-notes.test/builder');
        assert.equal(await page.getByRole('link', {name: 'Xem bài', exact: true}).count(), 0);
        for (const action of [{role: 'button', name: 'Preview Part 1'}]) {
            const requestCount = requests.length;
            const popupPromise = page.waitForEvent('popup');
            await page.getByRole(action.role, {name: action.name, exact: true}).click();
            const popup = await popupPromise;
            await popup.waitForFunction(() => window.qaVm && window.qaVm.ready === true);
            assert.equal(await popup.evaluate(() => qaVm.isPreviewMode), true, action.name);
            await popup.evaluate(() => qaScope.$apply(() => { qaVm.annotationNotes = []; qaVm.persist(); }));
            assert.equal(requests.length, requestCount, action.name + ' must make no learning-draft requests');
            const saved = await popup.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
            assert.deepEqual(saved.annotations, before.annotations);
            assert.deepEqual(saved.annotationNotes, before.annotationNotes);
            assert.deepEqual(saved.results, before.results);
            await popup.close();
        }
        await page.goto('http://ielts-notes.test/ielts_reading_actual_test/42?sessionMode=STUDY');
        await page.locator('.ielts-annotation.has-note.is-highlighted').waitFor();
        assert.equal(await page.locator('.ielts-annotation.is-highlighted:not(.has-note)').count(), 1);
        assert.equal(await page.getByRole('textbox', {name: 'Answer', exact: true}).inputValue(), 'rats');
        assert.equal(await page.evaluate(() => qaVm.annotationNotes[0].specificNote), 'Ghi chú cần giữ');
        await page.evaluate(() => {
            const marker = document.querySelector('.ielts-annotation');
            const range = document.createRange(); range.selectNodeContents(marker);
            getSelection().removeAllRanges(); getSelection().addRange(range);
            qaScope.$apply(() => {
                qaScope.showSelectionTools({target: marker}); qaScope.removeSelectionNote();
                getSelection().addRange(range); qaScope.showSelectionTools({target: marker}); qaScope.removeSelectionHighlight();
                const standaloneHighlight = document.querySelector('.ielts-annotation.is-highlighted');
                const highlightRange = document.createRange(); highlightRange.selectNodeContents(standaloneHighlight);
                getSelection().removeAllRanges(); getSelection().addRange(highlightRange);
                qaScope.showSelectionTools({target: standaloneHighlight}); qaScope.removeSelectionHighlight();
                qaVm.persist();
            });
        });
        await page.waitForFunction(() => qaVm.readingDraftSyncStatus === 'saved');
        const removed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        assert.equal(removed.annotationNotes.length, 0);
        assert.equal(removed.annotations.length, 0);
        assert.deepEqual(errors, []);
        await context.close();
    } finally { await browser.close(); }
});
