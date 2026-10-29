const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function section(start, end) {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, start); return source.slice(first, last);
}
function fixture(options = {}) {
    const listeners = new Map(), destroy = [], drafts = new Map(), cloud = [];
    let current = 0, failSeek = false, plays = 0;
    const audio = {src: '', currentSrc: '', readyState: 0, duration: NaN,
        addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
        load() { current = 0; this.currentSrc = ''; this.readyState = 0; this.duration = NaN; this.emit('timeupdate'); },
        play() { plays++; return Promise.resolve(); },
        emit(type) { for (const callback of listeners.get(type) || []) callback({type}); },
        metadata(duration = 1800) { this.duration = duration; this.readyState = 1; this.currentSrc = this.src; this.emit('loadedmetadata'); }};
    Object.defineProperty(audio, 'currentTime', {get: () => current, set(value) { if (failSeek) throw Error('media not seekable yet'); current = value; }});
    const vm = {isListeningRoute: options.listening !== false, isPreviewMode: !!options.preview, isWritingRoute: false,
        isComprehensiveRoute: false, isStartTest: true, isStartingTest: false, passageNumber: 1, currentUser: {id: 7},
        testSessionMode: options.mode || 'STUDY', isPartAssignment: false, playbackValue: 1.4,
        ieltsReadingActualTest: {id: 42, title: 'Listening', pronounce: 'full.mp3', subQuestions: [
            {subQuestions: [{id: 51, type: 18, _listeningAudioTime: 12.5}]}]},
        annotationNotes: [{text: 'Keep this note'}], isVideoHomeworkPractice: () => false,
        activeIeltsNavigationPart() { return this.assignedPart; }};
    const timeout = Object.assign(callback => callback(), {cancel() {}});
    const context = nodeVm.createContext({vm, angular: {copy: structuredClone, isArray: Array.isArray,
        isFunction: value => typeof value === 'function', noop() {},
        forEach(items, callback) { Object.entries(items || {}).forEach(([key, item]) => callback(item, key)); }},
        document: {getElementById: id => id === 'main-audio' ? audio : null},
        $scope: {counter: 3600, $on(name, callback) { if (name === '$destroy') destroy.push(callback); }}, $timeout: timeout,
        $window: {localStorage: {removeItem() {}}},
        readingAnnotationsRestoring: false, readingDraftSubmitted: false, readingAttemptKey: 'a'.repeat(32),
        readingSubmissionState: null, readingAttemptMayReplaceLocalDraft: false,
        legacyModeDraftStorageKey: '', legacyReadingDraftStorageKey: '',
        syncTimerForPersistence() {}, getActiveDurationSeconds: () => 90,
        serializeReadingDraftResults: () => [{ordinalNumber: 1, clientAnswer: 'My answer'}],
        serializeReadingQuestionStates: () => [{ordinalNumber: 1, needReview: true}], serializeCompleteListStates: () => [],
        serializeReadingAnnotations: () => [{start: 1, end: 8, color: 'yellow'}],
        getReadingQuestionEntries: () => [{question: {ordinalNumber: 1}}], getAllReadingQuestionEntries: () => [{}],
        getReadingDraftPartNumbers: () => [1], readStoredDraft: () => null,
        readingDraftStorageKey: (testId, mode) => vm.currentUser.id + ':' + testId + ':' + mode,
        readActiveReadingDraft: key => drafts.get(key),
        storeReadingDraft(key, draft) { drafts.set(key, plain(draft)); return true; },
        saveReadingLearningDraft(key, draft) { cloud.push({key, payload: JSON.stringify(draft)}); },
        trackAudioDuration() {}, applyPlaybackSpeed(value) { audio.playbackRate = value; }});
    nodeVm.runInContext(section('        var mainAudio = null;', '        function stripEmbeddedReadingIntro('), context);
    nodeVm.runInContext(section('        function selectedListeningAudioUrl()', '        vm.playbackValue = 1.0;'), context);
    nodeVm.runInContext(section('        function serializeListeningAudioPositions()', '        function getReadingDraftPartNumbers()'), context);
    nodeVm.runInContext(section('        function saveReadingDraft()', '        function markStudyDraftCompleted('), context);
    return {vm, context, audio, cloud, drafts,
        records: () => plain(context.serializeMainListeningAudioPositions()),
        restore: records => context.restoreMainListeningAudioPositions(records),
        play: () => vm.setUpAudio(), save: () => context.saveReadingDraft(),
        failSeek: value => { failSeek = value; }, plays: () => plays,
        destroy() { destroy.forEach(callback => callback()); },
        listenerCount: () => [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0)};
}

test('Study and Serious resume at five minutes only after metadata, retaining the saved point during initial zero events', () => {
    for (const mode of ['STUDY', 'SERIOUS']) {
        const f = fixture({mode}); f.restore([{source: 'full.mp3', seconds: 300}]); f.play();
        assert.equal(f.audio.currentTime, 0); f.save();
        assert.deepEqual(JSON.parse(f.cloud.at(-1).payload).listeningAudioPositions.mainAudio, [{source: 'full.mp3', seconds: 300}]);
        f.audio.metadata(); assert.equal(f.audio.currentTime, 300); assert.equal(f.audio.playbackRate, 1.4);
        assert.equal(f.plays(), 1); assert.equal(f.listenerCount(), 7);
    }
});

test('a failed metadata seek or stale source cannot overwrite the saved point and canplay retries it', () => {
    const f = fixture(); f.restore([{source: 'full.mp3', seconds: 305.25}]); f.play(); f.failSeek(true);
    f.audio.metadata(); f.audio.emit('timeupdate'); f.save();
    assert.equal(JSON.parse(f.cloud.at(-1).payload).listeningAudioPositions.mainAudio[0].seconds, 305.25);
    f.failSeek(false); f.audio.currentSrc = 'old-recording.mp3'; f.audio.emit('canplay'); assert.equal(f.audio.currentTime, 0);
    f.audio.currentSrc = f.audio.src; f.audio.emit('canplay'); assert.equal(f.audio.currentTime, 305.25);
});

test('full recordings and assigned Part sources keep separate positions, including the full-audio fallback', () => {
    const f = fixture(); f.play(); f.audio.metadata(); f.audio.currentTime = 300; f.audio.emit('timeupdate');
    f.vm.isPartAssignment = true; f.vm.assignedPart = 2; f.vm.listeningPartAudioUrls = ['part1.mp3', 'part2.mp3'];
    f.play(); f.audio.metadata(); assert.equal(f.audio.currentTime, 0);
    f.audio.currentTime = 75; f.audio.emit('timeupdate');
    f.vm.assignedPart = 4; f.play(); f.audio.metadata(); assert.equal(f.audio.currentTime, 300);
    f.vm.assignedPart = 2; f.play(); f.audio.metadata(); assert.equal(f.audio.currentTime, 75);
    assert.deepEqual(f.records(), [{source: 'full.mp3', seconds: 300}, {source: 'part2.mp3', seconds: 75}]);
    assert.equal(f.listenerCount(), 7, 'Repeated setup must not duplicate listeners');
});

test('pause saves positions through the existing local/cloud draft alongside answers, annotations and embedded audio', () => {
    const f = fixture(); f.play(); f.audio.metadata(); f.audio.currentTime = 317.1234; f.audio.emit('pause');
    const local = f.drafts.get('7:42:STUDY'), remote = JSON.parse(f.cloud.at(-1).payload);
    assert.deepEqual(local, remote); assert.equal(remote.listeningAudioPositions.mainAudio[0].seconds, 317.123);
    assert.equal(remote.listeningAudioPositions['51'], 12.5); assert.equal(remote.results[0].clientAnswer, 'My answer');
    assert.equal(remote.annotationNotes[0].text, 'Keep this note'); assert.equal(remote.annotations[0].color, 'yellow');
    const otherDevice = fixture(); otherDevice.restore(remote.listeningAudioPositions.mainAudio);
    otherDevice.play(); otherDevice.audio.metadata(); assert.equal(otherDevice.audio.currentTime, 317.123);
});

test('leaving captures the most recent position without waiting for timeupdate, while zero remains a valid deliberate rewind', () => {
    const f = fixture(); f.play(); f.audio.metadata(); f.audio.currentTime = 333.5; f.save();
    assert.equal(JSON.parse(f.cloud.at(-1).payload).listeningAudioPositions.mainAudio[0].seconds, 333.5);
    f.audio.currentTime = 0; f.audio.emit('seeked'); f.save(); assert.equal(f.records()[0].seconds, 0);
});

test('a changed recording starts at zero, stale/corrupt records are ignored and shorter audio clamps restored positions', () => {
    const f = fixture(); f.restore([{source: 'full.mp3', seconds: 300}, {source: 'bad', seconds: -1},
        {source: 'bad', seconds: NaN}, {source: 'bad', seconds: '100'}, {source: '', seconds: 20}]);
    assert.deepEqual(f.records(), [{source: 'full.mp3', seconds: 300}]); f.play(); f.audio.metadata(60);
    assert.equal(f.audio.currentTime, 60);
    f.vm.ieltsReadingActualTest.pronounce = 'replacement.mp3'; f.play(); f.audio.metadata(100);
    assert.equal(f.audio.currentTime, 0);
});

test('Preview and other test types never write native Listening positions, and destruction releases all listeners', () => {
    for (const options of [{preview: true}, {listening: false}]) {
        const f = fixture(options); f.play(); f.audio.metadata(); f.save();
        assert.equal(f.listenerCount(), 0);
        assert.equal(f.cloud.length ? JSON.parse(f.cloud.at(-1).payload).listeningAudioPositions.mainAudio : undefined, undefined);
    }
    const f = fixture(); f.play(); f.audio.metadata(); f.destroy(); assert.equal(f.listenerCount(), 0);
    f.audio.emit('pause'); assert.equal(f.cloud.length, 0); f.play(); assert.equal(f.plays(), 1);
});
