const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const view = fs.readFileSync(path.join(app, 'enrolment_class/views/listing.html'), 'utf8');
function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start); return source.slice(from, to);
}
const helpers = section('        vm.taskTopicIds =', '\t\tvm.tasksForSection =');
const openCode = section('\t\tvm.openScheduleTask =', '\t\tvm.loadTaskListeningItems =');
const commitCode = section('\t\tfunction scheduleTaskPayload(', '\t\tvm.removeScheduleTask =');
const saveCode = section('\t\tvm.saveScheduleDay =', '\t\tvm.loadScheduleStudents =');
const dayPayloadCode = section('        function scheduleDayPayload()', '        vm.loadScheduleSession =');
const topics = [
    {id: 11, name: 'Travel essentials', categoryId: 1, categoryName: 'Travel'},
    {id: 12, name: 'At the airport', categoryId: 1, categoryName: 'Travel'},
    {id: 21, name: 'Animal world', categoryId: 2, categoryName: 'Animals'}
];
const angular = {isArray: Array.isArray, isFunction: value => typeof value === 'function', copy: structuredClone,
    forEach: (items, callback) => Object.entries(items || {}).forEach(([key, value]) => callback(value, key))};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(enabled = true) {
    const vm = {scheduleClass: {id: 5, multiTopicVocabEnabled: enabled}, scheduleDay: {scheduleDate: '2026-10-19', tasks: [],
        defaultHomeworkDeadline: '2026-10-31T18:00'}, scheduleTopics: structuredClone(topics), scheduleEntries: [], scheduleListeningItems: [],
        assignableIeltsTests: [], homeworkProgressLevels: [10,20,30,40,50,60,70,80,90],
        isIeltsTask: () => false, ieltsPartsForTask: () => [1], loadTaskListeningItems() {}, refreshTaskExerciseVideo() {},
        taskHasComprehensiveVideo: () => false, buildScheduleCalendar() { this.calendarRefreshes = (this.calendarRefreshes || 0) + 1; }};
    const requests = [], modals = [];
    const context = nodeVm.createContext({vm, angular, $scope: {},
        moment: require(path.join(app, 'assets/scripts/external/moment.min.js')), scheduleDaySnapshot: '',
        isExtraScheduleDate: () => false,
        toastr: {warning(text) { vm.warning = text; }, error(text) { vm.error = text; }, success() {}},
        modal: {open(options) { let resolve; const instance = {options, result: new Promise(done => { resolve = done; }),
            close() { instance.closed = true; resolve(); }}; modals.push(instance); return instance; }},
        service: {saveScheduleDay(id, payload) { return new Promise((resolve, reject) => requests.push({id, payload, resolve, reject})); }}});
    nodeVm.runInContext(helpers + openCode + dayPayloadCode + saveCode + commitCode, context);
    vm.openScheduleTask('HOMEWORK'); vm.taskEditor.title = 'Learn three topics';
    return {vm, requests, modals, context};
}
test('one task retains selected topics across categories, deduplicates IDs and restores all chips when edited', async () => {
    const f = fixture(), vm = f.vm;
    vm.taskEditor.topicIds = [11, '12', 21, 11]; vm.taskVocabTopicsChanged();
    assert.deepEqual(Array.from(vm.taskEditor.topicIds), [11,12,21]); assert.equal(vm.taskEditor.topicId, 11);
    vm.taskEditor.categoryKey = '2'; vm.taskCategoryChanged();
    assert.deepEqual(Array.from(vm.taskEditor.topicIds), [11,12,21]);
    assert.deepEqual(Array.from(vm.taskTopicChoices(), topic => topic.id), [11,12,21]);
    assert.deepEqual(Array.from(vm.taskSelectedTopics(vm.taskEditor), topic => topic.name), topics.map(topic => topic.name));
    vm.commitScheduleTask(); assert.equal(f.requests.length, 1);
    assert.deepEqual(Array.from(f.requests[0].payload.tasks[0].topicIds), [11,12,21]);
    assert.equal(f.requests[0].payload.tasks.length, 1); assert.equal(f.modals[0].closed, undefined);
    const saved = {...f.requests[0].payload, version: 1, multiTopicVocabEnabled: true}; saved.tasks[0].id = 91;
    f.requests[0].resolve(saved); await tick();
    assert.equal(vm.taskEditor, null); assert.equal(f.modals[0].closed, true); assert.equal(vm.scheduleDay.tasks.length, 1);
    vm.openScheduleTask('HOMEWORK', vm.scheduleDay.tasks[0]);
    assert.deepEqual(Array.from(vm.taskEditor.topicIds), [11,12,21]);
});
test('old backends block a multi-topic save before sending any partial assignment', () => {
    const f = fixture(false); f.vm.taskEditor.topicIds = [11,12,21]; f.vm.taskVocabTopicsChanged(); f.vm.commitScheduleTask();
    assert.equal(f.requests.length, 0); assert.equal(f.vm.scheduleDay.tasks.length, 0);
    assert.match(f.vm.taskEditorError, /cập nhật backend/); assert.equal(f.modals[0].closed, undefined);
});
test('save failure keeps the complete editor and rolls back the parent list; retry closes only after confirmation', async () => {
    const f = fixture(); f.vm.taskEditor.topicIds = [11,12,21]; f.vm.taskVocabTopicsChanged();
    f.vm.commitScheduleTask(); f.vm.cancelScheduleTask(); assert.ok(f.vm.taskEditor); assert.equal(f.requests.length, 1);
    f.requests[0].reject({data: {message: 'Network unavailable'}}); await tick();
    assert.equal(f.vm.scheduleDay.tasks.length, 0); assert.deepEqual(Array.from(f.vm.taskEditor.topicIds), [11,12,21]);
    assert.match(f.vm.taskEditorError, /Chưa lưu/); assert.equal(f.modals[0].closed, undefined);
    f.vm.commitScheduleTask(); const saved = {...f.requests[1].payload, version: 1}; saved.tasks[0].id = 91;
    f.requests[1].resolve(saved); await tick(); assert.equal(f.vm.taskEditor, null); assert.equal(f.vm.scheduleDay.tasks.length, 1);
});
test('legacy single-topic tasks still save, while an incomplete multi-topic acknowledgment keeps the editor', async () => {
    const old = fixture(false); old.vm.cancelScheduleTask(); old.vm.openScheduleTask('HOMEWORK', {id: 8, title: 'Legacy',
        activityType: 'DAILY_VOCAB', topicId: 11, requiredAttempts: 1, studentProgress: []});
    assert.deepEqual(Array.from(old.vm.taskEditor.topicIds), [11]); old.vm.commitScheduleTask(); assert.equal(old.requests.length, 1);
    const f = fixture(); f.vm.taskEditor.topicIds = [11,12,21]; f.vm.taskVocabTopicsChanged(); f.vm.commitScheduleTask();
    const response = {...f.requests[0].payload, version: 1}; response.tasks[0] = {...response.tasks[0], topicIds: [11]};
    f.requests[0].resolve(response); await tick(); assert.ok(f.vm.taskEditor); assert.equal(f.vm.scheduleDay.tasks.length, 0);
    assert.match(f.vm.error, /đủ các topic/);
});
test('automatic progress keeps exact 33/67 percentages and manual ten-step choices remain unchanged', () => {
    const f = fixture();
    for (const percent of [1,17,33,67,99]) {
        assert.equal(f.vm.homeworkProgressPercent({status: 'PROGRESS_' + percent}), percent);
        assert.equal(f.vm.homeworkHasExactProgress({status: 'PROGRESS_' + percent, automatic: true}), true);
    }
    assert.equal(f.vm.homeworkProgressPercent({status: 'DONE'}), 100);
    assert.equal(f.vm.homeworkProgressPercent({status: 'NEEDS_REVIEW'}), 0);
    assert.equal(f.vm.homeworkHasExactProgress({status: 'PROGRESS_30', automatic: true}), false);
    assert.deepEqual(f.vm.homeworkProgressLevels, [10,20,30,40,50,60,70,80,90]);
});

test('the teacher report aggregates exact topic percentages and labels rather than dropping them to zero', () => {
    const f = fixture();
    Object.assign(f.context, {homeworkCellDrafts: {}, scheduleAttendanceCell: () => ({}), saveDefaultScheduleAttendanceRows() {}});
    f.vm.scheduleStudents = [{id: 7, displayName: 'Student A'}];
    f.vm.previousHomeworkTasks = [{id:91,studentProgress:[{studentUserId:7,status:'PROGRESS_33',progressPercent:33,automatic:true}]}];
    nodeVm.runInContext(section('        vm.buildHomeworkReviewRows =', '        vm.filteredHomeworkRows ='),f.context);
    f.vm.buildHomeworkReviewRows();
    assert.equal(f.vm.homeworkReviewRows[0].cells[0].editStatus,'PROGRESS_33');
    assert.equal(f.vm.homeworkReviewRows[0].cells[0].label,'Đã làm 33%');
    assert.equal(f.vm.homeworkReviewRows[0].progressPercent,33);
    f.vm.previousHomeworkTasks[0].studentProgress[0].status = 'PROGRESS_67'; f.vm.buildHomeworkReviewRows();
    assert.equal(f.vm.homeworkReviewRows[0].progressPercent,67);
});

test('real modal and multi-select work on desktop and mobile, including save failure, retry and nested parent', async () => {
    const os = require('node:os');
    const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright.chromium.launch({executablePath: chrome, headless: true});
    const css = view.slice(view.indexOf('<style>') + 7, view.indexOf('</style>'));
    const template = view.match(/<script type="text\/ng-template" id="class_schedule_task_editor_modal\.html">([\s\S]*?)<\/script>/)[1];
    const runtime = helpers + openCode + dayPayloadCode + saveCode + commitCode;
    try {
        for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
            const page = await browser.newPage({viewport}); const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.setContent('<style>' + fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8') + '\n' + fs.readFileSync(path.join(app,'assets/css/external/select.min.css'),'utf8') + '\n' + css + '</style><div id="qa"></div>');
            for (const script of ['angular.min.js','angular-sanitize.min.js','ui-bootstrap-tpls.min.js','select.min.js','moment.min.js']) {
                await page.addScriptTag({path: path.join(app,'assets/scripts/external',script)});
            }
            await page.evaluate(({template,runtime,topics}) => {
                angular.module('Qa',['ui.bootstrap','ui.select','ngSanitize']).filter('propsFilter', function () {
                    return function (items, props) { const search = String(props.name || '').toLowerCase(); return items.filter(item => String(item.name).toLowerCase().indexOf(search) >= 0); };
                }).controller('Qa', function ($scope,$uibModal,$q) {
                    var vm = this, modal = $uibModal, scheduleDaySnapshot = '', isExtraScheduleDate = function () { return false; };
                    var toastr = {warning: angular.noop,error: angular.noop,success: angular.noop};
                    vm.scheduleClass = {id:5,multiTopicVocabEnabled:true};
                    vm.scheduleDay = {scheduleDate:'2026-10-19',tasks:[],defaultHomeworkDeadline:'2026-10-31T18:00'};
                    vm.scheduleTopics = topics; vm.scheduleTaskCategories = [{id:'1',name:'Travel'},{id:'2',name:'Animals'}];
                    vm.scheduleEntries = []; vm.scheduleListeningItems = []; vm.assignableIeltsTests = [];
                    vm.isIeltsTask = function () { return false; }; vm.ieltsPartsForTask = function () { return [1]; };
                    vm.taskHasComprehensiveVideo = function () { return false; };
                    vm.loadTaskListeningItems = vm.refreshTaskExerciseVideo = vm.buildScheduleCalendar = angular.noop;
                    vm.taskStartLabel = function () { return '19/10/2026 18:00'; };
                    var service = {saveScheduleDay: function (id,payload) { window.qaPayload = payload; window.qaPending = $q.defer(); return window.qaPending.promise; }};
                    eval(runtime);
                    window.qaVm = vm; window.qaScope = $scope;
                    window.qaParent = modal.open({scope:$scope,template:'<div class="qa-parent modal-body"><button id="new-task" ng-click="vm.openScheduleTask(\'HOMEWORK\')">Tạo task</button><span>Parent schedule stays open</span></div>',backdrop:'static'});
                });
                angular.element(document.getElementById('qa')).attr('ng-controller','Qa as vm');
                angular.bootstrap(document.getElementById('qa'),['Qa']);
                angular.element(document.getElementById('qa')).injector().get('$templateCache').put('class_schedule_task_editor_modal.html',template);
            },{template,runtime,topics});
            await page.locator('#new-task').click();
            const dialog = page.locator('.class-task-editor-modal-window .modal-dialog'); await dialog.waitFor();
            const box = await dialog.boundingBox();
            assert.ok(Math.abs(box.width - (viewport.width > 767 ? viewport.width*.7 : viewport.width-16)) < 3);
            await page.locator('.class-task-editor input[name="title"]').fill('Learn three topics');
            const search = page.locator('.class-task-vocab-select input.ui-select-search');
            for (const topic of topics) {
                await search.fill(topic.name);
                await page.locator('.class-task-vocab-select .ui-select-choices-row').filter({hasText: topic.name}).click();
            }
            assert.equal(await page.locator('.class-task-vocab-select .ui-select-match-item').count(),3);
            await page.evaluate(() => qaScope.$apply(function () { qaVm.taskEditor.categoryKey = '2'; qaVm.taskCategoryChanged(); }));
            assert.equal(await page.locator('.class-task-vocab-select .ui-select-match-item').count(),3);
            const scroll = await page.locator('.class-task-editor-modal > .modal-body').evaluate(element => ({height:element.clientHeight,total:element.scrollHeight,overflow:getComputedStyle(element).overflowY}));
            assert.equal(scroll.overflow,'auto'); assert.ok(scroll.total > scroll.height);
            await page.getByRole('button',{name:'Thêm task',exact:true}).click();
            assert.deepEqual(await page.evaluate(() => qaPayload.tasks[0].topicIds),[11,12,21]);
            assert.equal(await page.getByRole('button',{name:'Hủy sửa',exact:true}).isDisabled(),true);
            await page.evaluate(() => qaScope.$apply(function () { qaPending.reject({data:{message:'Offline'}}); }));
            await page.getByRole('alert').waitFor();
            assert.equal(await page.locator('.class-task-vocab-select .ui-select-match-item').count(),3);
            await page.getByRole('button',{name:'Thêm task',exact:true}).click();
            await page.evaluate(() => qaScope.$apply(function () { const saved = angular.copy(qaPayload); saved.version = 1; saved.tasks[0].id = 91; qaPending.resolve(saved); }));
            await page.locator('.class-task-editor-modal-window').waitFor({state:'detached'});
            assert.equal(await page.locator('.qa-parent').isVisible(),true);
            await page.evaluate(() => qaScope.$apply(function () { qaVm.openScheduleTask('HOMEWORK',qaVm.scheduleDay.tasks[0]); }));
            await page.locator('.class-task-editor-modal-window').waitFor();
            assert.equal(await page.locator('.class-task-vocab-select .ui-select-match-item').count(),3);
            await page.waitForFunction(() => {
                const window = document.querySelector('.class-task-editor-modal-window');
                const header = window && window.querySelector('.modal-header');
                return header && window.classList.contains('in') && header.getBoundingClientRect().top >= 0;
            });
            const headerBox = await page.locator('.class-task-editor-header').boundingBox();
            const closeBox = await page.getByRole('button',{name:'Đóng form task',exact:true}).boundingBox();
            assert.ok(closeBox.x > headerBox.x + headerBox.width*.8);
            const stacking = await page.locator('.class-task-editor-modal-window').evaluate(window => ({
                own: Number(getComputedStyle(window).zIndex),
                parent: Number(getComputedStyle(document.querySelector('.qa-parent').closest('.modal')).zIndex)
            }));
            assert.ok(stacking.own > stacking.parent);
            if (process.env.QA_SCREENSHOT_DIR) {
                await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'teacher-task-modal-' + viewport.width + '.png')});
            }
            await page.getByRole('button',{name:'Hủy sửa',exact:true}).click();
            await page.locator('.class-task-editor-modal-window').waitFor({state:'detached'});
            const progressControl = view.match(/<select class="form-control input-sm class-homework-progress-select"[\s\S]*?<\/select>/)[0];
            await page.evaluate(control => {
                qaScope.$apply(function () {
                    qaScope.cell = {editStatus:'PROGRESS_33',status:'PROGRESS_33',automatic:true};
                    qaVm.homeworkProgressLevels = [10,20,30,40,50,60,70,80,90];
                    const injector = angular.element(document.getElementById('qa')).injector();
                    const table = angular.element('<div class="class-schedule-day-modal-window"><div class="class-homework-review-table">' + control + '</div></div>');
                    document.body.appendChild(injector.get('$compile')(table)(qaScope)[0]);
                });
            },progressControl);
            assert.equal(await page.locator('.class-homework-progress-select').inputValue(),'PROGRESS_33');
            assert.match(await page.locator('.class-homework-progress-select option:checked').textContent(),/33%/);
            assert.deepEqual(errors,[]); await page.close();
        }
    } finally { await browser.close(); }
});
