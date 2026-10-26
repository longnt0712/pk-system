const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'student_mark/controllers/StudentMarkController.js'), 'utf8');

function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

const boardCode = section('        function initializeMarks(student)', '        vm.allowEdit = function') +
    section('        vm.getListDisplayStudentMark = function', '        vm.markTimeouts =') +
    section('        vm.parseMarkNumber = function', '        vm.onMarkKeyup = function');

function setup() {
    const calls = [], warnings = [];
    const vm = {
        searchDisplayDto: {enrollmentClass: 10, educationProgramId: 5, groupId: 8},
        loadedScope: {enrollmentClass: 10, educationProgramId: 5, groupId: 8},
        studentMarks: [], groups: [{id: 8, name: 'Ca đoàn'}], selectedGroup: {id: 8, name: 'Ca đoàn'},
        sortStudentMarksLikeUserTable: values => values
    };
    nodeVm.runInNewContext(boardCode, {vm, boardGeneration: 0, destroyed: false,
        angular: {copy: structuredClone, forEach(values, callback) {(values || []).forEach(callback);}},
        service: {getListDisplayStudentMark(payload) {calls.push(structuredClone(payload)); return Promise.resolve([]);}},
        blockUI: {start() {}, stop() {}}, toastr: {warning(message) {warnings.push(message);}}});
    return {vm, calls, warnings};
}

test('selecting a class keeps the current program and group in the actual grade-board request', async () => {
    const h = setup();
    h.vm.searchDisplayDto.enrollmentClass = 20;
    h.vm.getListDisplayStudentMark();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, [{enrollmentClass: 20, educationProgramId: 5, groupId: 8}]);
    assert.equal(h.vm.loadedScope.enrollmentClass, 20);
    assert.equal(h.vm.loadedScope.groupId, 8);
    assert.equal(h.vm.selectedGroup.id, 8);
});

test('unsaved, saving or failed marks reject a class change and restore the loaded board scope', () => {
    for (const mark of [
        {markNumber: '8', _lastSaved: 7},
        {markNumber: '7', _lastSaved: 7, _saving: true},
        {markNumber: '7', _lastSaved: 7, _saveError: true}
    ]) {
        const h = setup();
        h.vm.studentMarks = [{studentMarks: [mark]}];
        h.vm.searchDisplayDto = {enrollmentClass: 20, educationProgramId: 6, groupId: null};
        h.vm.selectedGroup = null;
        assert.equal(h.vm.hasUnsavedMarks(), true);
        h.vm.getListDisplayStudentMark();
        assert.equal(h.calls.length, 0);
        assert.equal(h.vm.searchDisplayDto.enrollmentClass, 10);
        assert.equal(h.vm.searchDisplayDto.educationProgramId, 5);
        assert.equal(h.vm.searchDisplayDto.groupId, 8);
        assert.equal(h.vm.selectedGroup.id, 8);
        assert.equal(h.warnings.length, 1);
    }
});

test('the grade-page tree picker updates the real board scope and blocks both opening and selection with unsaved marks', async () => {
    const os = require('node:os');
    const {chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await chromium.launch({headless: true, executablePath: chrome});
    const template = fs.readFileSync(path.join(app, 'student_mark/views/listing.html'), 'utf8');
    const css = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css', 'common/class-tree-picker.css']
        .map(file => fs.readFileSync(path.join(app, file), 'utf8')).join('\n');
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({viewport: {width, height: 850}}), errors = [];
            page.setDefaultTimeout(10000);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const pathname = new URL(route.request().url()).pathname;
                const local = pathname.startsWith('/fonts/') ? path.join(app, 'assets', pathname.slice(1)) : null;
                return local && fs.existsSync(local) ? route.fulfill({path: local}) : route.fulfill({contentType: 'text/html', body: '<html></html>'});
            });
            await page.goto('http://student-marks-tree.test');
            const picker = await page.evaluate(template => new DOMParser().parseFromString(template, 'text/html').querySelector('class-tree-picker').outerHTML, template);
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
                'main{padding:24px;max-width:900px;margin:auto}</style></head><body><main id="qa" ng-controller="Qa as vm"><h3>Danh sách điểm</h3>' + picker + '</main></body></html>');
            for (const file of ['angular.min.js', 'ui-bootstrap-tpls.min.js']) {
                await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
            }
            await page.evaluate(() => angular.module('Hrm.Common', ['ui.bootstrap']));
            await page.addScriptTag({path: path.join(app, 'common/directives/ClassTreePicker.js')});
            await page.evaluate(boardCode => {
                window.qaRequests = [];
                angular.module('Qa', ['Hrm.Common']).controller('Qa', ['$q', '$scope', function ($q, $scope) {
                    const vm = this;
                    Object.assign(vm, {
                        enrollmentClasses: [
                            {id: 10, name: 'Lớp giáo lý', schoolId: 2, parentId: null},
                            {id: 11, name: 'Đội Lucia', schoolId: 2, parentId: 10},
                            {id: 20, name: 'Ca đoàn', schoolId: 2, parentId: null},
                            {id: 99, name: 'English hidden', schoolId: 1, parentId: null}
                        ],
                        searchDisplayDto: {enrollmentClass: 10, educationProgramId: 5, groupId: 8},
                        loadedScope: {enrollmentClass: 10, educationProgramId: 5, groupId: 8},
                        groups: [{id: 8, name: 'Ban mẫu'}], studentMarks: [],
                        sortStudentMarksLikeUserTable: values => values
                    });
                    new Function('vm', 'angular', 'service', 'blockUI', 'toastr', 'boardGeneration', 'destroyed', boardCode)(vm, angular,
                        {getListDisplayStudentMark(payload) {window.qaRequests.push(angular.copy(payload)); return $q.when([]);}},
                        {start() {}, stop() {}}, {warning() {}}, 0, false);
                    window.qaVm = vm; window.qaScope = $scope;
                }]);
                angular.bootstrap(document.body, ['Qa']);
            }, boardCode);
            const trigger = page.getByRole('button', {name: 'Chọn lớp để lọc', exact: true});
            await page.evaluate(() => window.qaScope.$apply(() => {
                window.qaVm.studentMarks = [{studentMarks: [{markNumber: 8, _lastSaved: 7}]}];
            }));
            assert.equal(await trigger.isDisabled(), true);
            await page.evaluate(() => window.qaScope.$apply(() => {window.qaVm.studentMarks = [];}));
            await trigger.click();
            const modal = page.locator('.class-tree-dialog');
            await modal.waitFor();
            assert.equal(await modal.locator('.class-tree-row').count(), 2);
            assert.ok(!(await modal.innerText()).includes('English hidden'));
            assert.ok(!(await modal.innerText()).includes('Đội Lucia'));
            await modal.getByRole('button', {name: 'Mở rộng Lớp giáo lý', exact: true}).click();
            await page.evaluate(() => window.qaScope.$apply(() => {
                window.qaVm.studentMarks = [{studentMarks: [{markNumber: 7, _lastSaved: 7, _saving: true}]}];
            }));
            const team = modal.locator('.class-tree-option').filter({hasText: 'Đội Lucia'});
            assert.equal(await team.isDisabled(), true);
            assert.equal(await page.evaluate(() => window.qaRequests.length), 0);
            await page.evaluate(() => window.qaScope.$apply(() => {window.qaVm.studentMarks = [];}));
            await team.click();
            await modal.waitFor({state: 'hidden'});
            const requests = await page.evaluate(() => window.qaRequests);
            assert.deepEqual(requests, [{enrollmentClass: 11, educationProgramId: 5, groupId: 8}]);
            assert.match(await trigger.innerText(), /Lớp giáo lý \/ Đội Lucia/);
            await trigger.click();
            assert.equal(await modal.locator('.class-tree-row').count(), 2, 'Reopening starts with parent classes');
            await modal.locator('.modal-footer').getByRole('button', {name: 'Đóng', exact: true}).click();
            await modal.waitFor({state: 'hidden'});
            assert.equal(await page.evaluate(() => window.qaRequests.length), 1, 'Cancel does not reload');
            await page.locator('.class-tree-clear').click();
            await page.waitForFunction(() => window.qaRequests.length === 2);
            assert.deepEqual(await page.evaluate(() => window.qaRequests[1]), {enrollmentClass: null, educationProgramId: 5, groupId: 8});
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {await browser.close();}
});
