const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const template = fs.readFileSync(path.join(app, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'assets/css/external/bootstrap.min.css'), 'utf8');
const essay = Array.from({length: 160}, (_, index) => 'word' + index).join(' ');

async function fixture(browser, options = {}) {
    const context = options.context || await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); } });
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}));
    await page.goto('http://writing-assignment.test/ielts_writing_actual_test/8123?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS' + (options.fresh ? '&startFresh=1' : ''));
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head>' +
        '<body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"></main></body></html>');
    for (const name of ['jquery.min.js', 'angular.min.js']) {
        await page.addScriptTag({path: path.join(app, 'assets/scripts/external', name)});
    }
    // UI-router inserts this legacy view through jQuery. Its HTML prefilter
    // expands the self-closing note textareas before the browser parses them.
    await page.evaluate(template => $('#qa').html(template), template);
    await page.evaluate(({essay, options}) => {
        window.App = {initAjax() {}};
        window.toasts = [];
        window.submissions = [];
        window.gradeCalls = 0;
        window.resultReads = 0;
        window.deletedDrafts = [];
        window.savedDrafts = [];
        window.blocking = false;
        const question = {id: 1001, ordinalNumber: 1, question: '', parent: {id: 100, type: 16},
            questionAnswers: [{id: 10001, ordinalNumberQuestionAnswer: 1, correct: true,
                answer: {id: 20001, answer: 'PRIVATE_MODEL_ANSWER'}, question: {id: 1001, ordinalNumber: 1, parent: {id: 100, type: 16}}}]};
        const data = {id: 8123, title: 'Annual Travel Distance', testFormat: 'WRITING', subQuestions: [
            {id: 10, type: 1, ordinalNumber: 1, question: '', questionType: {code: 'IELTSRTP1'}, subQuestions: [
                {id: 100, type: 16, ordinalNumber: 1, question: '<p>Describe the chart.</p>', subQuestions: [question]}]},
            {id: 11, type: 1, ordinalNumber: 2, question: '', questionType: {code: 'IELTSRTP2'}, subQuestions: []},
            {id: 12, type: 1, ordinalNumber: 3, question: '', questionType: {code: 'IELTSRTP3'}, subQuestions: []}]};
        const draft = {version: 5, userId: 7, testId: 8123, title: data.title, testMode: 'WRITING', sessionMode: 'SERIOUS',
            assignmentTaskId: 238, assignmentPart: 1, assignmentParts: [1], isPartAssignment: true,
            savedAt: new Date().toISOString(), passageNumber: 1, remainingSeconds: options.expired ? 0 : 900, elapsedSeconds: options.expired ? 1200 : 300,
            answeredCount: 1, totalQuestions: 1, results: [{questionId: 1001, ordinalNumber: 1, answerId: 10001, answerOrdinal: 1, clientAnswer: essay}],
            questionStates: [{questionId: 1001, ordinalNumber: 1, answered: true,
                answers: [{answerId: 10001, answerOrdinal: 1, selected: false, clientAnswer: essay}]}],
            annotations: [], annotationNotes: []};
        window.draftKey = 'ieltsReadingInProgress:7:writing:test:8123:serious:task:238:parts:1';
        if(options.resumeMarker)sessionStorage.setItem('ielts-draft-resume:v1:7',JSON.stringify(options.resumeMarker));
        if (!options.resume || !localStorage.getItem(draftKey)) { localStorage.setItem(draftKey, JSON.stringify(draft)); }
        const cookie = JSON.stringify({id: 7, displayName: 'Learner', roles: [{name: 'ROLE_VIEWER'}]});
        angular.module('Hrm.Question', []).value('settings', {}).value('Utilities', {}).value('$uibModal', {})
            .value('$location', {path: () => location.pathname, search: () => Object.fromEntries(new URLSearchParams(location.search))})
            .value('$stateParams', {ieltsReadingTestId: '8123', assignmentTaskId: '238', assignmentPart: '1', assignmentParts: '1', sessionMode: 'SERIOUS'})
            .value('$cookies', {getAll: () => ({'education.user': cookie})})
            .value('blockUI', {start() { blocking = true; }, stop() { blocking = false; }})
            .value('toastr', Object.fromEntries(['success', 'warning', 'error', 'info'].map(level => [level, (...args) => toasts.push({level, args})])))
            .run(['$rootScope', root => { root.settings = {layout: {}}; }])
            .directive('compile', () => ({link(scope, element, attrs) { scope.$watch(attrs.compile, value => element.html(value || '')); }}))
            .factory('QuestionService', ['$q', '$rootScope', (q, root) => {
                const service = {
                    getOne: () => q.when(angular.copy(data)),
                    getAssignedTask: () => q.when({taskId:238,activityType:'IELTS_WRITING',ieltsTestId:8123,ieltsParts:[1],canStartNewAttempt:!options.expiredAssignment,newAttemptUnavailableReason:'Bài được giao đã quá hạn.'}),
                    getLearningDrafts: () => q.when(options.cloudAttempts || (localStorage.getItem(draftKey) ? [{draftKey, draftType: 'IELTS', savedAt: Date.now(), payload: localStorage.getItem(draftKey)}] : [])),
                    saveLearningDraft(dto) { savedDrafts.push(structuredClone(dto)); return q.when({id:1,draftKey:dto.draftKey,payload:dto.payload,savedAt:dto.savedAt}); },
                    deleteLearningDraft(key) { deletedDrafts.push(key); return q.when(true); },
                    saveTestResult(payload) {
                        submissions.push(angular.copy(payload));
                        window.saveRequest = q.defer();
                        return saveRequest.promise;
                    },
                    gradeWritingTestResult() { gradeCalls++; window.gradeRequest = q.defer(); return gradeRequest.promise; },
                    getOneTestResult() { resultReads++; return q.reject(new Error('Saved Writing must render from its returned DTO.')); }
                };
                window.qaService = service;
                window.completeCustom = data => { saveRequest.resolve(data); root.$evalAsync(); };
                window.completeSave = status => {
                    window.savedResult = Object.assign({}, angular.copy(submissions.at(-1)), {id: 9001, correctAnswer: 1, bandScore: null,
                        testDate: new Date().toISOString(), aiGradingStatus: 'PENDING', resultStatus: status || 'SUCCESS',
                        questionAnswerTestResult: [], testTakerPerformance: null, ieltsLearningState: null});
                    saveRequest.resolve(angular.copy(savedResult)); root.$evalAsync();
                };
                window.failSave = () => { saveRequest.reject(new Error('Connection failed')); root.$evalAsync(); };
                window.completeGrade = () => { gradeRequest.resolve({id: 9001, testType: 7, aiGradingStatus: 'COMPLETED',
                    aiGradingProvider: 'OPENAI', aiOverallBand: 6.5, correctAnswer: 0, bandScore: 0,
                    testName: null, testTime: null, testDate: null, activeDurationSeconds: null,
                    questionAnswerTestResult: null, testTakerPerformance: null, ieltsLearningState: null}); root.$evalAsync(); };
                window.failGrade = () => { gradeRequest.reject(new Error('Grading unavailable')); root.$evalAsync(); };
                return service;
            }]);
    }, {essay: options.shortEssay ? essay.split(' ').slice(0,126).join(' ') : essay, options:{expired:options.expired,resume:options.resume,expiredAssignment:options.expiredAssignment,resumeMarker:options.resumeMarker,cloudAttempts:options.cloudAttempts}});
    for (const script of ['question/business/ComprehensiveVideo.js', 'question/business/ComprehensiveListening.js', 'question/controllers/IELTSReadingActualTestController.js']) {
        await page.addScriptTag({path: path.join(app, script)});
    }
    await page.evaluate(fresh => {
        angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        window.qaVm = angular.element(document.getElementById('qa')).scope().vm;
        if (fresh) { qaVm.requestStartTest(); }
    }, options.fresh === true);
    await page.waitForFunction(() => qaVm.isStartTest || qaVm.startTestError);
    assert.equal(await page.evaluate(() => qaVm.startTestError), '', errors.join('\n'));
    if (!options.expectSaved && !options.fresh) { assert.equal(await page.locator('.idp-writing-task-screen:visible textarea').inputValue(), options.shortEssay ? essay.split(' ').slice(0,126).join(' ') : essay); }
    const finish = page.locator('.idp-candidate-mobile .idp-finish-btn');
    if (!options.expectSaved) { assert.ok(await finish.isVisible(), 'the real mobile Finish control must be visible'); }
    return {page, context, errors, finish};
}


const keyPattern = /^[a-f0-9]{32}$/;
async function finishAndWait(f) { await f.page.evaluate(() => qaVm.saveTestResult()); await f.page.waitForFunction(() => submissions.length > 0); }

test('overlapping Finish, timeout and retry calls reuse one frozen Writing attempt across a reload', async () => {
    const browser = await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        let f = await fixture(browser); const context = f.context;
        await f.page.evaluate(() => { qaVm.saveTestResult(); qaVm.saveTestResult(); angular.element(document.getElementById('qa')).scope().onTimeout(); });
        await f.page.waitForFunction(() => submissions.length===1);
        const original = await f.page.evaluate(() => submissions[0]); assert.match(original.clientAttemptKey,keyPattern);
        const pending = await f.page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)));
        assert.equal(pending.submissionState.status,'PENDING'); assert.equal(pending.submissionState.key,original.clientAttemptKey);
        assert.deepEqual(pending.submissionState.payload,original);
        await f.page.evaluate(() => failSave()); await f.page.waitForFunction(() => !qaVm.isSubmittingTest);
        assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').inputValue(),essay);
        await f.page.evaluate(() => {
            qaVm.testResult.sourceQuestionId = 99;
            qaVm.testResult.questionAnswerTestResult[0].clientAnswer = 'Changed transport must not change a pending attempt';
            qaVm.saveTestResult(); qaVm.saveTestResult(); qaVm.saveTestResult();
        });
        await f.page.waitForFunction(() => submissions.length===2);
        assert.deepEqual(await f.page.evaluate(() => submissions[1]),original);
        await f.page.evaluate(() => failSave()); await f.page.waitForFunction(() => !qaVm.isSubmittingTest);
        await f.page.close();
        f = await fixture(browser,{context,resume:true}); await finishAndWait(f);
        const resumed = await f.page.evaluate(() => submissions[0]); assert.deepEqual(resumed,original);
        await f.page.evaluate(() => completeSave('SUCCESS')); await f.page.waitForFunction(() => qaVm.passageNumber===4);
        assert.equal(await f.page.evaluate(() => qaVm.testResultAfterSubmitting.id),9001);
        assert.equal(await f.page.locator('.idp-writing-result-status strong').innerText(),'Đạt');
        assert.equal(await f.page.locator('#circlechart').count(),0);
        assert.deepEqual(f.errors,[]); await context.close();
    } finally { await browser.close(); }
});

test('126-word zero-time failed Writing restores its saved receipt repeatedly without automatic duplicate rows', async () => {
    const browser = await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        let f = await fixture(browser,{expired:true,shortEssay:true}); const context=f.context;
        assert.equal(await f.page.evaluate(() => submissions.length),0,'legacy expired restoration must not submit itself');
        assert.equal(await f.page.evaluate(() => angular.element(document.getElementById('qa')).scope().counter),0);
        await finishAndWait(f);
        const key = await f.page.evaluate(() => submissions[0].clientAttemptKey);
        assert.equal(await f.page.evaluate(() => submissions[0].numberOfWords),126);
        await f.page.evaluate(() => completeSave('FAILED')); await f.page.waitForFunction(() => qaVm.passageNumber===4);
        assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)).submissionState.status),'SAVED');
        for (let reload=0;reload<3;reload++) {
            await f.page.close(); f=await fixture(browser,{context,resume:true,expectSaved:true,shortEssay:true});
            await f.page.waitForFunction(() => qaVm.passageNumber===4);
            assert.equal(await f.page.evaluate(() => submissions.length),0);
            assert.equal(await f.page.evaluate(() => qaVm.testResultAfterSubmitting.id),9001);
            assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)).submissionState.key),key);
            assert.equal(await f.page.evaluate(() => gradeCalls),0,'restoring a receipt must not start grading or saving again');
            assert.equal(await f.page.locator('.idp-writing-result-status strong').innerText(),'Chưa đạt');
            assert.equal(await f.page.locator('#circlechart').count(),0);
            if(reload===0)await f.page.screenshot({path:path.join(app,'../../../../writing-failed-status-mobile.png'),fullPage:true});
            assert.deepEqual(f.errors,[]);
        }
        await context.close();
    } finally { await browser.close(); }
});

test('missing or mismatching save acknowledgments keep the essay and pending key until a matching result is confirmed', async () => {
    const browser = await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        const f=await fixture(browser); let key;
        for (const invalid of ['empty','missing-id','wrong-key','wrong-user','wrong-source','wrong-task','wrong-parts']) {
            await f.page.evaluate(() => qaVm.saveTestResult());
            await f.page.waitForFunction(() => qaVm.isSubmittingTest);
            key = key || await f.page.evaluate(() => submissions[0].clientAttemptKey);
            await f.page.evaluate(invalid => {
                const result=Object.assign({},submissions.at(-1),{id:9001,resultStatus:'SUCCESS'});
                if(invalid==='empty') { completeCustom(null); return; }
                if(invalid==='missing-id')delete result.id;
                if(invalid==='wrong-key')result.clientAttemptKey='a'.repeat(32);
                if(invalid==='wrong-user')result.user={id:999};
                if(invalid==='wrong-source')result.sourceQuestionId=999;
                if(invalid==='wrong-task')result.assignmentTaskId=999;
                if(invalid==='wrong-parts')result.completedParts=[2];
                completeCustom(result);
            },invalid);
            await f.page.waitForFunction(() => !qaVm.isSubmittingTest);
            assert.notEqual(await f.page.evaluate(() => qaVm.passageNumber),4);
            assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').inputValue(),essay);
            assert.equal(await f.page.evaluate(() => deletedDrafts.length),0);
            assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem(draftKey)).submissionState.key),key);
        }
        await f.page.evaluate(() => qaVm.saveTestResult()); await f.page.evaluate(() => completeSave('SUCCESS'));
        await f.page.waitForFunction(() => qaVm.passageNumber===4);
        assert.equal(await f.page.evaluate(() => new Set(submissions.map(item=>item.clientAttemptKey)).size),1);
        assert.deepEqual(f.errors,[]); await f.context.close();
    } finally { await browser.close(); }
});

test('blocked local storage and failed cloud persistence prevent posting until the pending snapshot is durable', async () => {
    const browser = await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        const f=await fixture(browser);
        await f.page.evaluate(() => {
            window.originalSetItem=Storage.prototype.setItem;
            Storage.prototype.setItem=function(){throw Error('Storage blocked');};
            const q=angular.element(document.getElementById('qa')).injector().get('$q');
            window.originalCloudSave=qaService.saveLearningDraft;
            qaService.saveLearningDraft=()=>q.reject(Error('Offline'));
            qaVm.saveTestResult();
        });
        await f.page.waitForFunction(() => !qaVm.isSubmittingTest);
        assert.equal(await f.page.evaluate(() => submissions.length),0);
        assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').inputValue(),essay);
        await f.page.evaluate(() => { Storage.prototype.setItem=originalSetItem; qaService.saveLearningDraft=originalCloudSave; qaVm.saveTestResult(); });
        await f.page.waitForFunction(() => submissions.length===1);
        assert.match(await f.page.evaluate(() => submissions[0].clientAttemptKey),keyPattern);
        assert.deepEqual(f.errors,[]); await f.context.close();
    } finally { await browser.close(); }
});

test('the existing explicit startFresh flow creates a different real attempt while a normal reload retains the failed one', async () => {
    const browser = await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        let f=await fixture(browser);const context=f.context;await finishAndWait(f);
        const oldKey=await f.page.evaluate(()=>submissions[0].clientAttemptKey);
        await f.page.evaluate(()=>completeSave('FAILED'));await f.page.waitForFunction(()=>qaVm.passageNumber===4);await f.page.close();
        f=await fixture(browser,{context,resume:true,fresh:true});
        await f.page.locator('.idp-writing-task-screen:visible textarea').fill(essay);
        await finishAndWait(f);const newKey=await f.page.evaluate(()=>submissions[0].clientAttemptKey);
        assert.match(newKey,keyPattern);assert.notEqual(newKey,oldKey);
        assert.equal(await f.page.evaluate(()=>submissions[0].assignmentTaskId),238);
        assert.deepEqual(await f.page.evaluate(()=>submissions[0].completedParts),[1]);
        assert.deepEqual(f.errors,[]);await context.close();
    } finally {await browser.close();}
});


test('Làm lượt mới explicitly preserves 126-word essay and assignment, resets configured time once and ignores old GPT callbacks', async () => {
    const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        let f=await fixture(browser,{expired:true,shortEssay:true});const context=f.context;
        await finishAndWait(f);const old=await f.page.evaluate(()=>submissions[0]);
        await f.page.evaluate(()=>completeSave('FAILED'));await f.page.waitForFunction(()=>qaVm.passageNumber===4);
        const oldUrl=f.page.url();
        if(process.env.QA_SCREENSHOT_DIR) {
            await f.page.getByRole('button',{name:'Làm lượt mới',exact:true}).scrollIntoViewIfNeeded();
            await f.page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'writing-failed-new-attempt.png')});
        }
        await f.page.getByRole('button',{name:'Làm lượt mới',exact:true}).click();
        const newDraft=await f.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)));
        assert.match(newDraft.clientAttemptKey,keyPattern);assert.notEqual(newDraft.clientAttemptKey,old.clientAttemptKey);
        assert.equal(newDraft.assignmentTaskId,238);assert.deepEqual(newDraft.assignmentParts,[1]);
        assert.equal(newDraft.testId,8123);assert.equal(f.page.url(),oldUrl,'retaking must not change the assigned task or route');
        assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').inputValue(),essay.split(' ').slice(0,126).join(' '));
        assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').isEditable(),true);
        const remaining=await f.page.evaluate(()=>angular.element(document.getElementById('qa')).scope().counter);
        assert.ok(remaining>=1198 && remaining<=1200,'Task 1 gets its configured 20 minutes only after the explicit action');
        await f.page.evaluate(()=>completeGrade());
        assert.notEqual(await f.page.evaluate(()=>qaVm.passageNumber),4,'a late GPT reply for the old result must not interrupt the new attempt');
        await f.page.close();f=await fixture(browser,{context,resume:true,shortEssay:true});
        assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)).clientAttemptKey),newDraft.clientAttemptKey);
        const resumedRemaining=await f.page.evaluate(()=>angular.element(document.getElementById('qa')).scope().counter);
        assert.ok(resumedRemaining<=remaining && resumedRemaining>=remaining-3,'ordinary reload resumes rather than creates another time budget');
        await f.page.locator('.idp-writing-task-screen:visible textarea').fill(essay);await finishAndWait(f);
        const current=await f.page.evaluate(()=>submissions[0]);
        assert.equal(current.clientAttemptKey,newDraft.clientAttemptKey);assert.equal(current.assignmentTaskId,old.assignmentTaskId);
        assert.equal(current.sourceQuestionId,old.sourceQuestionId);assert.deepEqual(current.completedParts,old.completedParts);
        assert.equal(current.numberOfWords,160);
        await f.page.evaluate(()=>completeSave('SUCCESS'));await f.page.waitForFunction(()=>qaVm.passageNumber===4);
        assert.equal(await f.page.evaluate(()=>qaVm.testResultAfterSubmitting.resultStatus),'SUCCESS');
        assert.deepEqual(f.errors,[]);await context.close();
    } finally {await browser.close();}
});


test('fulfilled but missing or unrelated cloud ACKs cannot authorize a cloud-only submission',async()=>{
    const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        const f=await fixture(browser);
        await f.page.evaluate(()=>{
            window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('blocked');};
            window.originalCloudSave=qaService.saveLearningDraft;
        });
        for(const invalid of ['null','false','wrong-key','wrong-payload']) {
            await f.page.evaluate(invalid=>{
                const q=angular.element(document.getElementById('qa')).injector().get('$q');
                qaService.saveLearningDraft=dto=>q.when(invalid==='null'?null:invalid==='false'?false:{id:1,
                    draftKey:invalid==='wrong-key'?'unrelated':dto.draftKey,payload:invalid==='wrong-payload'?'{}':dto.payload});
                qaVm.saveTestResult();
            },invalid);
            await f.page.waitForFunction(()=>!qaVm.isSubmittingTest);
            assert.equal(await f.page.evaluate(()=>submissions.length),0);
            assert.equal(await f.page.locator('.idp-writing-task-screen:visible textarea').inputValue(),essay);
        }
        await f.page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;qaService.saveLearningDraft=originalCloudSave;qaVm.saveTestResult();});
        await f.page.waitForFunction(()=>submissions.length===1);
        const pending=await f.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)));
        const cloud=await f.page.evaluate(()=>savedDrafts.at(-1));
        assert.equal(cloud.draftKey,await f.page.evaluate(()=>draftKey)+':attempt:'+pending.clientAttemptKey);
        assert.equal(JSON.parse(cloud.payload).submissionState.key,pending.clientAttemptKey);
        assert.deepEqual(f.errors,[]);await f.context.close();
    } finally {await browser.close();}
});

test('a late result from an older tab cannot delete the draft or cloud snapshot of a new attempt',async()=>{
    const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        const first=await fixture(browser);const context=first.context;await finishAndWait(first);
        const oldKey=await first.page.evaluate(()=>submissions[0].clientAttemptKey);
        let current=await fixture(browser,{context,resume:true});await finishAndWait(current);
        assert.equal(await current.page.evaluate(()=>submissions[0].clientAttemptKey),oldKey);
        await current.page.evaluate(()=>completeSave('SUCCESS'));await current.page.waitForFunction(()=>qaVm.passageNumber===4);
        await current.page.close();current=await fixture(browser,{context,resume:true,fresh:true});
        await current.page.locator('.idp-writing-task-screen:visible textarea').fill(essay);
        await current.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
        const next=await current.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)));
        assert.match(next.clientAttemptKey,keyPattern);assert.notEqual(next.clientAttemptKey,oldKey);
        await first.page.evaluate(()=>completeSave('SUCCESS'));await first.page.waitForFunction(()=>qaVm.passageNumber===4);
        const retained=await current.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)));
        assert.equal(retained.clientAttemptKey,next.clientAttemptKey);
        assert.equal(retained.results[0].clientAnswer,essay);
        const deleted=await first.page.evaluate(()=>deletedDrafts);
        assert.ok(deleted.some(key=>key.endsWith(':attempt:'+oldKey)));
        assert.equal(deleted.some(key=>key.endsWith(':attempt:'+next.clientAttemptKey)),false);
        assert.deepEqual(first.errors,[]);assert.deepEqual(current.errors,[]);await context.close();
    } finally {await browser.close();}
});


test('selecting a cloud pending attempt A opens its frozen essay while preserving a different active base draft B',async()=>{
    const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        for(const legacy of [false,true]) {
        let first=await fixture(browser);const context=first.context;await finishAndWait(first);
        const a=await first.page.evaluate(()=>({payload:submissions[0],cloud:savedDrafts.at(-1),base:draftKey}));
        if(legacy)a.cloud.draftKey='ieltsReadingInProgress:7:writing:task:238:attempt:'+a.payload.clientAttemptKey;
        await first.page.evaluate(()=>failSave());await first.page.waitForFunction(()=>!qaVm.isSubmittingTest);await first.page.close();
        let active=await fixture(browser,{context,resume:true,fresh:true});
        const nextEssay='Another active essay '+essay;
        await active.page.locator('.idp-writing-task-screen:visible textarea').fill(nextEssay);
        await active.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
        const b=await active.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)));
        assert.notEqual(b.clientAttemptKey,a.payload.clientAttemptKey);
        await active.page.evaluate(aKey=>localStorage.removeItem(draftKey+':attempt:'+aKey),a.payload.clientAttemptKey);
        const selected=await fixture(browser,{context,resume:true,resumeMarker:{draftKey:a.cloud.draftKey,
            clientAttemptKey:a.payload.clientAttemptKey,testId:8123,assignmentTaskId:238,assignmentParts:[1],sessionMode:'SERIOUS'},
            cloudAttempts:[{...a.cloud,id:1,draftType:'IELTS'}]});
        await finishAndWait(selected);
        assert.deepEqual(await selected.page.evaluate(()=>submissions[0]),a.payload);
        assert.equal(await selected.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)).clientAttemptKey),b.clientAttemptKey);
        assert.equal(await selected.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)).results[0].clientAnswer),nextEssay);
        await selected.page.evaluate(()=>completeSave('SUCCESS'));await selected.page.waitForFunction(()=>qaVm.passageNumber===4);
        assert.equal(await active.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)).clientAttemptKey),b.clientAttemptKey);
        assert.deepEqual(selected.errors,[]);assert.deepEqual(active.errors,[]);await context.close();
        }
    } finally {await browser.close();}
});

test('expired, unsupported or changed assignment eligibility preserves the failed receipt and never resets its clock',async()=>{
    const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
    try {
        for(const problem of ['expired','unsupported','changed']) {
            const f=await fixture(browser,{expired:true,shortEssay:true,expiredAssignment:problem==='expired'});
            await finishAndWait(f);const key=await f.page.evaluate(()=>submissions[0].clientAttemptKey);
            await f.page.evaluate(()=>completeSave('FAILED'));await f.page.waitForFunction(()=>qaVm.passageNumber===4);
            if(problem!=='expired')await f.page.evaluate(problem=>{
                const q=angular.element(document.getElementById('qa')).injector().get('$q');
                qaService.getAssignedTask=()=>q.when({taskId:238,activityType:'IELTS_WRITING',ieltsTestId:problem==='changed'?999:8123,
                    ieltsParts:[1],...(problem==='changed'?{canStartNewAttempt:true}:{})});
            },problem);
            await f.page.getByRole('button',{name:'Làm lượt mới',exact:true}).click();
            await f.page.waitForFunction(()=>!!qaVm.writingNewAttemptError);
            assert.equal(await f.page.evaluate(()=>qaVm.passageNumber),4);
            assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem(draftKey)).clientAttemptKey),key);
            assert.equal(await f.page.evaluate(()=>angular.element(document.getElementById('qa')).scope().counter),0);
            assert.equal(await f.page.evaluate(()=>submissions.length),1);
            assert.equal(await f.page.getByRole('button',{name:'Làm lượt mới',exact:true}).isDisabled(),true);
            assert.deepEqual(f.errors,[]);await f.context.close();
        }
    } finally {await browser.close();}
});
