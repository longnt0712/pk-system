const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');
function section(start, end, after = 0) {
    const index = source.indexOf(start, after);
    assert.ok(index >= 0, start);
    const finish = source.indexOf(end, index);
    assert.ok(finish > index, end);
    return source.slice(index, finish);
}
const timerCode = section('        $scope.counter = 3600;', '        function syncTimerWhenVisible()');
const restoreCode = section("            if (vm.testSessionMode === 'STUDY' && draft.sessionMode === 'STUDY') {", '            vm.annotationNotes =');
const writingBudgetCode = section('                    if (vm.isWritingRoute) {', '                    vm.getOrdinalNumber(data);',
    source.indexOf('                    vm.ieltsReadingActualTest = data;'));

function timer({mode = 'SERIOUS', writingTypes = [], audio = null} = {}) {
    let now = 1000000;
    let nextId = 1;
    const scheduled = new Map();
    const context = nodeVm.createContext({
        Date: class extends Date { static now() { return now; } },
        vm: {isVideoHomeworkPractice: () => false, testSessionMode: mode, isStartTest: false, isWritingRoute: writingTypes.length > 0,
            isListeningRoute: !!audio, saveTestResult() { context.submissions += 1; }},
        $scope: {$broadcast() {}, $evalAsync(callback) { if (callback) { callback(); } }},
        $window: {document: {hidden: false}}, document: {getElementById() { return audio; }},
        getMainAudio() { return audio; }, submissions: 0,
        getWritingTaskPackages: () => writingTypes.map(type => ({type})),
        angular: {forEach: (values, callback) => values.forEach(callback)},
        $timeout(callback) { const id = nextId++; scheduled.set(id, callback); return id; }
    });
    context.$timeout.cancel = id => scheduled.delete(id);
    nodeVm.runInContext(timerCode, context);
    if (writingTypes.length) { nodeVm.runInContext(writingBudgetCode, context); }
    return {
        context,
        restore(draft) { context.draft = draft; nodeVm.runInContext(restoreCode, context); },
        start() { context.vm.isStartTest = true; context.$scope.startCount(); },
        advance(seconds) { now += seconds * 1000; },
        tick(seconds = 1) {
            now += seconds * 1000;
            const callbacks = [...scheduled.values()]; scheduled.clear(); callbacks.forEach(callback => callback());
        },
        remaining: () => context.$scope.counter,
        elapsed: () => nodeVm.runInContext('getActiveDurationSeconds()', context),
        pendingTimers: () => scheduled.size
    };
}

for (const [name, types, budget] of [['Task 1', [16], 1200], ['Task 2', [17], 2400], ['both tasks', [16, 17], 3600]]) {
    test('Writing ' + name + ' keeps its configured duration when the timer starts', () => {
        const c = timer({writingTypes: types});
        c.advance(5); c.start();
        assert.equal(c.remaining(), budget); assert.equal(c.elapsed(), 0);
        c.tick(12);
        assert.equal(c.remaining(), budget - 12); assert.equal(c.elapsed(), 12);
    });
}

test('resuming Writing keeps both remaining and elapsed time across a changed task budget', () => {
    const c = timer({writingTypes: [16]});
    c.restore({sessionMode: 'SERIOUS', remainingSeconds: 900, elapsedSeconds: 450});
    c.start();
    assert.equal(c.remaining(), 900); assert.equal(c.elapsed(), 450);
    c.tick(2);
    assert.equal(c.remaining(), 898); assert.equal(c.elapsed(), 452);
});

test('an expired Writing draft stays at zero and submits on the next timer tick', () => {
    const c = timer({writingTypes: [16]});
    c.restore({sessionMode: 'SERIOUS', remainingSeconds: 0, elapsedSeconds: 1200});
    c.start();
    assert.equal(c.remaining(), 0); assert.equal(c.elapsed(), 1200);
    c.tick();
    assert.equal(c.context.submissions, 1); assert.equal(c.pendingTimers(), 0);
});

test('a legacy draft without elapsed time retains the configured Writing budget', () => {
    const c = timer({writingTypes: [16]});
    c.restore({sessionMode: 'SERIOUS', remainingSeconds: 900}); c.start();
    assert.equal(c.remaining(), 900); assert.equal(c.elapsed(), 300);
});

test('resuming Study keeps elapsed time and repeated start does not duplicate its timer', () => {
    const c = timer({mode: 'STUDY', writingTypes: [16]});
    c.restore({sessionMode: 'STUDY', elapsedSeconds: 600}); c.start();
    assert.equal(c.elapsed(), 600); assert.equal(c.remaining(), 600);
    c.advance(5); c.start(); c.start();
    assert.equal(c.elapsed(), 605); assert.equal(c.pendingTimers(), 1);
    c.tick();
    assert.equal(c.elapsed(), 606); assert.equal(c.pendingTimers(), 1);
});

test('repeated Serious start preserves the deadline and schedules one timer', () => {
    const c = timer({writingTypes: [16]}); c.start();
    c.advance(5); c.start(); c.start();
    assert.equal(c.remaining(), 1195); assert.equal(c.elapsed(), 5); assert.equal(c.pendingTimers(), 1);
    c.tick();
    assert.equal(c.remaining(), 1194); assert.equal(c.pendingTimers(), 1);
});

test('generic Reading retains its one hour default', () => {
    const c = timer(); c.start();
    assert.equal(c.remaining(), 3600); assert.equal(c.elapsed(), 0);
});

test('Listening metadata extends the duration without erasing time already spent', () => {
    const audio = {duration: NaN};
    const c = timer({audio}); c.start(); c.tick(10);
    audio.duration = 4000; audio.onloadedmetadata();
    assert.equal(c.remaining(), 4050); assert.equal(c.elapsed(), 10);
    c.tick(10); audio.onloadedmetadata();
    assert.equal(c.remaining(), 4040); assert.equal(c.elapsed(), 20);
});

test('Listening metadata preserves a resumed countdown and elapsed time', () => {
    const audio = {duration: 4000};
    const c = timer({audio});
    c.restore({sessionMode: 'SERIOUS', remainingSeconds: 900, elapsedSeconds: 450}); c.start();
    assert.equal(c.remaining(), 900); assert.equal(c.elapsed(), 450);
    c.tick(10); audio.onloadedmetadata();
    assert.equal(c.remaining(), 890); assert.equal(c.elapsed(), 460);
});
