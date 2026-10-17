const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

function loadService() {
    let Service;
    const angular = {
        noop() {},
        isArray: Array.isArray,
        module() { return {service(name, constructor) { Service = constructor; }}; }
    };
    nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,
        '../test_result/business/TestResultService.js'), 'utf8'), {angular, console: {log() {}}});
    return new Service(null, null, null, {api: {baseUrl: '/', apiV1Url: 'api/'}}, null);
}

function statusColumn(service, group) {
    return service.getTableDefinition(group, false).find(column => column.field === 'resultStatus');
}

test('every results tab exposes the saved result status, including comprehensive assignments', () => {
    const service = loadService();
    for (const group of [null, 'VOCAB', 'DAILY_LISTENING', 'IELTS', 'WRITING', 'COMPREHENSIVE', 'BATTLE']) {
        const column = statusColumn(service, group);
        assert.ok(column, group + ' must include a status column');
        assert.equal(column.title, 'Kết quả');
    }
});

test('explicit successful and failed outcomes are shown for every scored test type', () => {
    const service = loadService();
    const column = statusColumn(service, 'COMPREHENSIVE');
    for (const testType of [1, 2, 3, 4, 6, 7]) {
        const row = {testType, assignmentTaskId: 238};
        const successful = column.formatter('SUCCESS', row);
        assert.match(successful, /label-success/);
        assert.match(successful, />Đạt yêu cầu</);
        const failed = column.formatter('FAILED', row);
        assert.match(failed, /label-warning/);
        assert.match(failed, />Chưa đạt</);
        assert.match(failed, /đã được lưu nhưng chưa đạt yêu cầu/);
        assert.match(failed, /chưa được tính hoàn thành/);
    }
});

test('missing or unknown legacy statuses never imply either success or failure', () => {
    const service = loadService();
    const column = statusColumn(service, null);
    for (const testType of [1, 2, 3, 4, 6, 7]) {
        for (const status of [undefined, null, '', 'UNKNOWN', 'PENDING', 'PROCESSING']) {
            const row = {testType, resultStatus: status};
            const feedback = service.getResultStatusFeedback(row);
            assert.equal(feedback.label, 'Đã lưu');
            assert.equal(feedback.tone, 'info');
            const html = column.formatter(status, row);
            assert.match(html, />Đã lưu</);
            assert.doesNotMatch(html, /label-success|label-warning|>Đạt yêu cầu<|>Chưa đạt</);
        }
    }
});

test('failed saved assignment feedback distinguishes an unmet requirement from a save failure', () => {
    const service = loadService();
    const assigned = service.getResultStatusFeedback({testType: 6, resultStatus: 'FAILED', assignmentTaskId: 238});
    assert.equal(assigned.label, 'Chưa đạt');
    assert.match(assigned.message, /^Bài làm đã được lưu nhưng chưa đạt yêu cầu\./);
    assert.match(assigned.message, /Lượt làm này chưa được tính hoàn thành phần bài được giao/);
    const selfPractice = service.getResultStatusFeedback({testType: 6, resultStatus: 'FAILED'});
    assert.match(selfPractice.message, /đã được lưu/);
    assert.doesNotMatch(selfPractice.message, /bài được giao|hoàn thành/);
    const successful = service.getResultStatusFeedback({testType: 6, resultStatus: 'SUCCESS', assignmentTaskId: 238});
    assert.doesNotMatch(successful.message, /bài được giao.*hoàn thành/,
        'passing one part must not claim that an entire multi-part assignment is complete');
});

test('battle results retain their separate meaning even when a score status is absent or failed', () => {
    const service = loadService();
    const column = statusColumn(service, 'BATTLE');
    for (const status of [null, 'BATTLE', 'SUCCESS', 'FAILED']) {
        assert.equal(service.getResultStatusFeedback({testType: 5, resultStatus: status}).label, 'Battle');
        const html = column.formatter(status, {testType: 5});
        assert.match(html, />Battle</);
        assert.doesNotMatch(html, />Chưa đạt<|>Đạt yêu cầu</);
    }
    assert.match(column.formatter('BATTLE', {testType: 6}), />Battle</);
});

test('details use the same status feedback even when no IELTS notes or session metadata exist', () => {
    const service = loadService();
    const vm = {};
    const controller = fs.readFileSync(path.join(__dirname,
        '../test_result/controllers/TestResultController.js'), 'utf8');
    const start = controller.indexOf('        vm.getResultStatusFeedback = function');
    const end = controller.indexOf('        vm.testResult = {};', start);
    assert.ok(start >= 0 && end > start);
    nodeVm.runInNewContext(controller.slice(start, end), {vm, service});
    const result = {id: 87, testType: 6, resultStatus: 'FAILED', assignmentTaskId: 238};
    assert.equal(vm.getResultStatusFeedback(result).label, 'Chưa đạt');
    assert.equal(vm.getResultStatusFeedback({...result, resultStatus: null}).label, 'Đã lưu');
    const template = fs.readFileSync(path.join(__dirname, '../test_result/views/listing.html'), 'utf8');
    const banner = template.indexOf('role="status" data-ng-if="vm.testResult.id"');
    const notes = template.indexOf('<section class="ielts-learning-state"');
    assert.ok(banner >= 0 && banner < notes, 'status banner must be independent of the IELTS notes section');
    assert.doesNotMatch(template, /resultStatus === 'SUCCESS' \? 'Đạt' : 'Chưa đạt'/);
});
