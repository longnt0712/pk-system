const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const app = path.resolve(process.env.IELTS_VIDEO_NOTICE_APP || path.join(__dirname, '..'));
const baseApp = path.resolve(process.env.IELTS_VIDEO_NOTICE_BASE_APP || app);
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const source = read(app, 'question/controllers/IELTSReadingActualTestController.js');
const view = read(app, 'question/views/ielts_reading_actual_test_idp.html');
const helperSource = read(baseApp, 'question/business/ComprehensiveVideo.js');
const definitions = {}, moduleStub = {factory(name, definition) {definitions[name] = definition; return this;}, directive() {return this;}};
nodeVm.runInNewContext(helperSource, {angular: {module: () => moduleStub, noop() {}}});
const video = definitions.ComprehensiveVideo.at(-1)({URL}, {});
const first = source.indexOf('        vm.videoApi = {};');
const last = source.indexOf('        vm.assignmentTaskId =', first);
assert.ok(first >= 0 && last > first, 'candidate video helpers are present');
const videoCode = source.slice(first, last);

function fixture(options = {}) {
  let now = 1000000, onNewVideo;
  const log = {pauses: 0, plays: 0, seeks: [], notices: [], timeouts: []};
  const earlier = {id:201, ordinalNumber:1, videoTimeSeconds:10, answered:true,
    questionAnswers:[{id:101, selected:true, clientAnswer:'B'}]};
  const question = {id:202, ordinalNumber:2, videoTimeSeconds:30, answered:false,
    questionAnswers:[{id:102, selected:false, clientAnswer:''}]};
  const model = {isComprehensiveRoute:true, isPreviewMode:!!options.preview, assignmentTaskId:options.unassigned ? null : 238,
    testSessionMode:options.study ? 'STUDY' : 'SERIOUS', isStartTest:true, passageNumber:1, formatVideoTime:video.formatTime,
    videoApi:{ready:options.ready !== false, pause() {log.pauses++;}, play() {log.plays++;}, seek(seconds) {log.seeks.push(seconds);}},
    ieltsReadingActualTest:{id:42, subQuestions:[{videoUrl:'https://youtu.be/M7lc1UVf-VE', subQuestions:[{id:51, type:1, subQuestions:[earlier, question]}]}]}};
  let notice = '';
  Object.defineProperty(model, 'videoPlaybackNotice', {enumerable:true, configurable:true, get:() => notice,
    set(value) {if (value !== notice) log.notices.push(value); notice = value;}});
  class ClockDate extends Date {constructor(...args) {super(...(args.length ? args : [now]));} static now() {return now;}}
  const context = nodeVm.createContext({vm:model, video, Date:ClockDate, Math, Number, String, JSON,
    $scope:{$watchGroup(watches, callback) {onNewVideo = callback; callback();}},
    $timeout(callback, delay) {log.timeouts.push({callback, delay});},
    $window:{document:{getElementById() {return null;}}},
    toastr:new Proxy({}, {get() {return () => {throw new Error('Video seek notices must be inline, never toast notifications.');};}})});
  const playerApi = model.videoApi;
  nodeVm.runInContext(videoCode, context);
  model.videoApi = playerApi;
  return {vm:model, log, context, earlier, question, advance(seconds) {now += seconds * 1000;}, resetVideo() {onNewVideo();},
    arriveAtCue() {model.onVideoProgress(30,120); assert.equal(model.videoTimeline.active[0].seconds,30);}};
}
function assertCueReason(notice, cue = '00:30') {
  assert.equal(typeof notice, 'string'); assert.ok(notice.trim(), 'blocking action has a readable inline reason');
  assert.ok(notice.includes(cue), 'reason identifies the actual blocking cue timestamp');
  assert.match(notice, /câu|trả lời|answer/i, 'reason explains the question/answer gate');
}

test('seeking past the first missed cue explains the rollback and retains question and attempt context', () => {
  const f = fixture(); const answers = JSON.stringify(f.earlier.questionAnswers);
  f.vm.onVideoProgress(80,120);
  assert.equal(f.log.pauses,1); assert.deepEqual(f.log.seeks,[30]); assertCueReason(f.vm.videoPlaybackNotice);
  assert.equal(f.vm.videoTimeline.active[0].seconds,30); assert.equal(f.vm.assignmentTaskId,238);
  assert.equal(JSON.stringify(f.earlier.questionAnswers),answers); assert.equal(f.vm.videoQuestionVisible(f.earlier),true);
});

test('assigned play at an unanswered cue explains the block while ordinary paused progress stays silent', () => {
  const f = fixture(); f.arriveAtCue(); const beforePolling = f.vm.videoPlaybackNotice;
  const transitions = f.log.notices.length;
  for (let index=0; index<8; index++) f.vm.onVideoProgress(30,120);
  assert.equal(f.vm.videoPlaybackNotice,beforePolling); assert.equal(f.log.notices.length,transitions);
  f.vm.onVideoState(true); f.vm.onVideoProgress(30,120); assertCueReason(f.vm.videoPlaybackNotice);
  f.vm.onVideoState(false); const blocked = f.vm.videoPlaybackNotice, count = f.log.notices.length;
  for (let index=0; index<8; index++) f.vm.onVideoProgress(30,120);
  assert.equal(f.vm.videoPlaybackNotice,blocked); assert.equal(f.log.notices.length,count);
});

test('strict self-practice Study and Preview play attempts retain their existing pause rule and show its reason', () => {
  for (const options of [{unassigned:true},{unassigned:true,study:true},{preview:true}]) {
    const f = fixture(options); f.arriveAtCue(); const paused = f.log.pauses;
    f.vm.onVideoProgress(5,120); f.vm.onVideoState(true);
    assert.equal(f.log.pauses,paused+1); assertCueReason(f.vm.videoPlaybackNotice);
  }
});

test('allowed assigned rewind clears the warning without hiding questions or requiring a correct answer', () => {
  for (const playFirst of [true,false]) {
    const f = fixture(); f.arriveAtCue(); f.vm.onVideoState(true); f.vm.onVideoProgress(31.5,120);
    assertCueReason(f.vm.videoPlaybackNotice); const paused = f.log.pauses;
    if (playFirst) f.vm.onVideoState(true);
    f.vm.onVideoProgress(5,120);
    if (!playFirst) f.vm.onVideoState(true);
    assert.equal(f.vm.videoPlaybackNotice,''); assert.equal(f.log.pauses,paused);
    assert.equal(f.vm.videoQuestionVisible(f.earlier),true); assert.equal(f.vm.videoQuestionVisible(f.question),true);
    assert.equal(f.question.questionAnswers[0].clientAnswer,'');
  }
});

test('identical forward-block reasons stay stable during subsequent player polling', () => {
  const f = fixture(); f.vm.onVideoProgress(80,120); const message = f.vm.videoPlaybackNotice;
  assertCueReason(message); const transitions = f.log.notices.length;
  for (let index=0; index<8; index++) f.vm.onVideoProgress(30,120);
  assert.equal(f.vm.videoPlaybackNotice,message); assert.equal(f.log.notices.length,transitions);
});

test('asynchronous replay ignores stale old positions without a false new blocked-seek warning', () => {
  const f = fixture(); f.arriveAtCue(); f.vm.replayVideoSegment(); assert.equal(f.log.seeks.at(-1),20);
  assert.equal(f.vm.videoPlaybackNotice,''); const transitions = f.log.notices.length;
  f.vm.onVideoState(true); f.vm.onVideoProgress(30,120); f.vm.onVideoProgress(30.2,120);
  assert.equal(f.vm.videoPlaybackNotice,''); assert.equal(f.log.notices.length,transitions);
  assert.equal(f.log.pauses,1); assert.equal(f.vm.videoTimeline.currentSeconds,20);
  f.vm.onVideoProgress(20,120); assert.equal(f.vm.videoPlaybackNotice,'');
  f.vm.onVideoState(true); f.vm.onVideoProgress(31.5,120);
  assertCueReason(f.vm.videoPlaybackNotice); assert.equal(f.log.seeks.at(-1),30);
});

test('a replay that never completes eventually explains the same cue protection', () => {
  const f = fixture(); f.arriveAtCue(); f.vm.replayVideoSegment(); f.vm.onVideoState(true);
  f.vm.onVideoProgress(50,120); assert.equal(f.vm.videoPlaybackNotice,'');
  f.advance(2); f.vm.onVideoProgress(50,120); assertCueReason(f.vm.videoPlaybackNotice);
  assert.equal(f.log.seeks.at(-1),30);
});

test('answering, successful Continue, reveal-all and loading another video clear a prior block notice', () => {
  for (const action of ['answer','continue','reveal','new-video']) {
    const f = fixture(); f.vm.onVideoProgress(80,120); assertCueReason(f.vm.videoPlaybackNotice);
    if (action === 'answer') {f.question.questionAnswers[0].selected=true; f.vm.onVideoState(true);}
    if (action === 'continue') {f.question.questionAnswers[0].clientAnswer='any answer'; f.vm.continueVideo(); assert.equal(f.log.plays,1);}
    if (action === 'reveal') {f.vm.revealVideoQuestions(); assert.equal(f.vm.videoFallbackMode,true);}
    if (action === 'new-video') f.resetVideo();
    assert.equal(f.vm.videoPlaybackNotice,'',action);
  }
});

test('the fixed-anchor replay button explains repeated or forward-moving clicks without changing seek behavior', () => {
  const f = fixture(); f.arriveAtCue(); f.vm.replayVideoSegment(); assert.equal(f.log.seeks.at(-1),20);
  f.vm.onVideoProgress(20,120); f.vm.replayVideoSegment();
  assert.equal(f.log.seeks.at(-1),20); assert.ok(f.vm.videoPlaybackNotice.trim());
  assert.match(f.vm.videoPlaybackNotice,/10|00:20|00:30/);
  f.vm.onVideoProgress(5,120); f.vm.replayVideoSegment();
  assert.equal(f.log.seeks.at(-1),20); assert.ok(f.vm.videoPlaybackNotice.trim());
  assert.equal(f.vm.videoTimeline.active[0].seconds,30); assert.equal(f.earlier.questionAnswers[0].clientAnswer,'B');
});

test('not-ready replay stays blocked while its accessible loading hint sits under the video clock', () => {
  const f = fixture({ready:false}); f.vm.replayVideoSegment();
  assert.equal(f.log.seeks.length,0); assert.equal(f.log.plays,0);
  const roleNodes = [...view.matchAll(/<(p|div|small)\b([^>]*\brole="status"[^>]*)>([\s\S]*?)<\/\1>/g)];
  const status = roleNodes.find(match => /videoPlaybackNotice/.test(match[0]));
  assert.ok(status,'seek notice uses an inline status node'); assert.match(status[2],/aria-live="polite"/);
  assert.match(status[2],/!vm\.videoApi\.ready/);
  assert.match(status[0],/videoPlaybackNotice\s*\|\|\s*'[^']*(?:tải|sẵn sàng|chờ)[^']*'/i,
    'not-ready disabled controls have a rendered fallback hint even without a click handler');
  const condition=status[2].match(/ng-if="([^"]+)"/)[1];
  const interpolation=status[0].match(/\{\{([^}]*videoPlaybackNotice[^}]*)\}\}/)[1];
  assert.equal(!!nodeVm.runInContext(condition,f.context),true);
  assert.match(nodeVm.runInContext(interpolation,f.context),/tải|sẵn sàng|chờ/i);
  f.vm.videoApi.ready=true; assert.equal(!!nodeVm.runInContext(condition,f.context),false);
  f.vm.videoPlaybackNotice='Bạn cần trả lời câu hỏi ở mốc 00:30.';
  assert.equal(!!nodeVm.runInContext(condition,f.context),true);
  assert.equal(nodeVm.runInContext(interpolation,f.context),f.vm.videoPlaybackNotice);
  assert.ok(status.index > view.indexOf('class="comprehensive-video-clock"'));
  assert.ok(status.index < view.indexOf('class="comprehensive-video-pause-card"'));
  assert.match(view,/ng-if="[^"\n]*!vm\.videoApi\.ready[^"\n]*"[^>]*>[\s\S]*?(?:Đang tải|sẵn sàng|đợi|chờ)/i,
    'a disabled replay button has a visible player-readiness hint');
});

test('a shared unanswered cue group remains blocked until each question has an answer, without requiring correctness', () => {
  const f = fixture();
  const sibling = {id:203,ordinalNumber:3,videoTimeSeconds:30,answered:false,questionAnswers:[{id:103,selected:false,clientAnswer:''}]};
  f.vm.ieltsReadingActualTest.subQuestions[0].subQuestions[0].subQuestions.push(sibling); f.resetVideo();
  f.vm.onVideoProgress(80,120); assert.equal(f.vm.videoTimeline.active.length,2); assertCueReason(f.vm.videoPlaybackNotice);
  f.question.questionAnswers[0].clientAnswer='any response'; f.vm.onVideoState(true); f.vm.onVideoProgress(30,120);
  assert.equal(f.vm.videoCanContinue(),false); assertCueReason(f.vm.videoPlaybackNotice);
  sibling.questionAnswers[0].selected=true; f.vm.continueVideo();
  assert.equal(f.vm.videoPlaybackNotice,''); assert.equal(f.vm.videoTimeline.active.length,0); assert.equal(f.log.plays,1);
});

test('a cue at zero explains why replay cannot move earlier while retaining its existing seek target', () => {
  const f = fixture(); f.question.videoTimeSeconds=0; f.resetVideo(); f.vm.onVideoProgress(0,120);
  assert.equal(f.vm.videoTimeline.active[0].seconds,0); f.vm.replayVideoSegment();
  assertCueReason(f.vm.videoPlaybackNotice,'00:00'); assert.equal(f.log.seeks.at(-1),0);
  assert.equal(f.vm.videoTimeline.active[0].seconds,0); assert.equal(f.question.questionAnswers[0].clientAnswer,'');
});

test('a play request sampled just below the pending cue still explains the block when its next sample crosses the cue', () => {
  const f = fixture(); f.arriveAtCue(); const pauses = f.log.pauses;
  f.vm.onVideoState(true); f.vm.onVideoProgress(29.9,120);
  assert.equal(f.log.pauses,pauses); assert.equal(f.vm.videoPlaybackNotice,'');
  f.vm.onVideoProgress(30.1,120);
  assert.equal(f.log.pauses,pauses+1); assertCueReason(f.vm.videoPlaybackNotice);
  assert.equal(f.log.seeks.length,0,'a sample within one second retains the existing pause without a new rollback');
  f.vm.onVideoState(false); const message=f.vm.videoPlaybackNotice, changes=f.log.notices.length;
  for (let index=0; index<8; index++) f.vm.onVideoProgress(30.1,120);
  assert.equal(f.vm.videoPlaybackNotice,message); assert.equal(f.log.notices.length,changes);
  f.vm.onVideoProgress(20,120); assert.equal(f.vm.videoPlaybackNotice,'','an actual ten-second rewind still clears the cue warning');
});

test('skipping to an already selected but not yet marked answered cue only asks the student to Continue', () => {
  const f = fixture(); f.question.questionAnswers[0].selected=true;
  assert.equal(f.question.answered,false); f.vm.onVideoProgress(80,120);
  assert.equal(f.vm.videoCanContinue(),true); assert.equal(f.log.seeks.at(-1),30); assert.equal(f.log.pauses,1);
  assert.ok(f.vm.videoPlaybackNotice.includes('00:30')); assert.match(f.vm.videoPlaybackNotice,/Tiếp tục video/);
  assert.doesNotMatch(f.vm.videoPlaybackNotice,/(?:cần|hãy|vui lòng)\s+trả lời/i);
  const selected=JSON.stringify(f.question.questionAnswers); f.vm.continueVideo();
  assert.equal(f.vm.videoPlaybackNotice,''); assert.equal(f.log.plays,1); assert.equal(JSON.stringify(f.question.questionAnswers),selected);
});
