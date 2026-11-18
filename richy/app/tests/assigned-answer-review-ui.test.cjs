const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');

const read = (file) => readFileSync(join(__dirname, '..', file), 'utf8');
const helper = read('common/utils/assigned-answer-review.js');
const expiry = Date.parse('2026-11-18T20:00:00+07:00');

function policyAt(now) {
    const window = {};
    runInNewContext(helper, {window, Date: {now: () => now, parse: Date.parse}});
    return window.AssignedAnswerReview;
}

test('uses the Viet Nam deadline even when the browser timezone differs', () => {
    const task = {taskId: 41, dueDate: '2026-11-18', dueTime: '20:00'};
    const {deadlinePassed} = policyAt(expiry);
    assert.equal(deadlinePassed(task, 41, expiry - 1), false);
    assert.equal(deadlinePassed(task, 41, expiry), false);
    assert.equal(deadlinePassed(task, 41, expiry + 1), true);
    assert.equal(deadlinePassed({...task, canStartNewAttempt: true}, 41, expiry + 1), false);
    assert.equal(deadlinePassed(task, 99, expiry + 1), false);
    assert.equal(deadlinePassed({...task, dueTime: ''}, 41, expiry + 1), false);
    assert.equal(deadlinePassed({...task, dueTime: '25:00'}, 41, expiry + 1), false);
    assert.equal(deadlinePassed({...task, dueDate: null}, 41, expiry + 1), false);
});

test('legacy results unlock after a verified deadline and current server policy takes precedence', async () => {
    const {loadDeadline} = policyAt(expiry + 1);
    const expired = {};
    assert.equal(expired.answerReviewDeadlinePassed, undefined);
    await loadDeadline(expired, 41, () => Promise.resolve({taskId: 41, dueDate: '2026-11-18', dueTime: '20:00'}));
    assert.equal(expired.answerReviewDeadlinePassed, true);
    const broken = {};
    await loadDeadline(broken, 41, () => Promise.reject(new Error('offline')));
    assert.equal(broken.answerReviewDeadlinePassed, false);
    for (const answerReviewLocked of [true, false]) {
        const result = {answerReviewLocked};
        loadDeadline(result, 41, () => assert.fail('must use the result API decision'));
        assert.equal(result.answerReviewLocked, answerReviewLocked);
    }
});

test('Viewer sees the status table and neither answer column while the deadline is unverified', () => {
    const source = read('question/controllers/IELTSReadingActualTestController.js');
    const start = source.indexOf('vm.isSubmittedAnswerReviewLocked =');
    const end = source.indexOf('vm.showDetailTestAfterSubmit =', start);
    const vm = {assignmentTaskId: 41, currentUser: {roles: [{name: 'ROLE_VIEWER'}]}, testResultAfterSubmitting: {}};
    runInNewContext(source.slice(start, end), {vm});
    assert.equal(vm.isSubmittedAnswerReviewLocked(), true);
    vm.testResultAfterSubmitting.answerReviewDeadlinePassed = true;
    assert.equal(vm.isSubmittedAnswerReviewLocked(), false);
    vm.testResultAfterSubmitting.answerReviewLocked = true;
    assert.equal(vm.isSubmittedAnswerReviewLocked(), true);
    for (const file of ['ielts_reading_actual_test.html', 'ielts_reading_actual_test_idp.html']) {
        const view = read('question/views/' + file);
        const statusStart = view.indexOf('<table class="table" ng-if="vm.isShowDetail && vm.isSubmittedAnswerReviewLocked()">');
        assert.ok(statusStart > 0);
        assert.doesNotMatch(view.slice(statusStart, view.indexOf('</table>', statusStart)), /Your answer|Correct answer/);
        const detailStart = view.indexOf('<table class="table" ng-if="vm.isShowDetail && !vm.isSubmittedAnswerReviewLocked()">');
        assert.ok(detailStart > statusStart);
        assert.match(view.slice(detailStart, view.indexOf('</table>', detailStart)), /Correct answer/);
    }
});
