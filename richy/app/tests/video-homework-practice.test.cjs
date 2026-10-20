const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSReadingActualTestController.js'),'utf8');
const view=fs.readFileSync(path.join(__dirname,'../question/views/ielts_reading_actual_test_idp.html'),'utf8');
const helperSource=fs.readFileSync(path.join(__dirname,'../question/business/ComprehensiveVideo.js'),'utf8');
const defs={},moduleStub={factory(name,def){defs[name]=def;return this;},directive(){return this;}};
nodeVm.runInNewContext(helperSource,{angular:{module:()=>moduleStub,noop(){}}});
const video=defs.ComprehensiveVideo.at(-1)({URL},{});
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const videoCode=part('        vm.hasComprehensiveVideo = function','        vm.assignmentTaskId =');
const timerCode=part('        $scope.counter = 3600;','        function trackAudioDuration(');
const displayCode=part('        vm.getRemainingMinutes = function','        vm.ieltsReadingActualTest = {};');
const restoreCode=part("            if (vm.testSessionMode === 'STUDY' && draft.sessionMode === 'STUDY')",'            vm.annotationNotes = angular.copy(draft.annotationNotes');
const saveCode=part('        function saveReadingDraft()','        function markStudyDraftCompleted(');
const identityCode=part('        function readingSubmissionType()','        function persistReadingSubmissionState()');
function fixture(options={}){
 let now=1000000;const log={pauses:0,plays:0,seeks:[],submits:[],notices:[],saved:[],broadcasts:[]},timers=[];
 const first={id:201,ordinalNumber:1,videoTimeSeconds:10,answered:true,questionAnswers:[{id:101,selected:true,clientAnswer:'B'}]};
 const next={id:202,ordinalNumber:2,videoTimeSeconds:30,answered:false,questionAnswers:[{id:102,selected:false,clientAnswer:''}]};
 const test={id:42,title:'Video homework',subQuestions:[{videoUrl:options.noVideo?'':'https://youtu.be/M7lc1UVf-VE',subQuestions:[{id:51,type:1,subQuestions:[first,next]}]}]};
 const vm={assignmentTaskId:options.unassigned?null:238,isPreviewMode:!!options.preview,isComprehensiveRoute:!options.reading&&!options.writing,isWritingRoute:!!options.writing,isListeningRoute:false,isFlexibleRoute:!options.reading,
 testSessionMode:'SERIOUS',currentUser:{id:7},isStartTest:true,isStartingTest:false,passageNumber:1,isPartAssignment:true,assignedParts:[1],assignedPart:1,ieltsReadingActualTest:test,
 testResult:{questionAnswerTestResult:[{ordinalNumber:1,questionAnswer:{id:101,question:first},clientAnswer:'B'}]},annotationNotes:[{id:'n1',text:'Keep'}],
 videoApi:{ready:true,pause(){log.pauses++;},play(){log.plays++;},seek(seconds){log.seeks.push(seconds);}},saveTestResult(opts){log.submits.push(opts);}};
 function timeout(callback,delay){const t={callback,delay};timers.push(t);return t;}timeout.cancel=t=>{if(t)t.cancelled=true;};
 const scope={$watchGroup(f,cb){cb();},$broadcast(...args){log.broadcasts.push(args);}};
 class ClockDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
 const c=nodeVm.createContext({vm,$scope:scope,$timeout:timeout,video,Date:ClockDate,Math,Number,String,JSON,
 angular:{copy:structuredClone,isArray:Array.isArray,forEach:(items,callback)=>(items||[]).forEach(callback)},
 $window:{document:{getElementById(){return null;}},localStorage:{getItem(){return null;},removeItem(){}}},document:{getElementById(){return null;}},
 getMainAudio:()=>null,toastr:{info(...args){log.notices.push(args);}},trackAudioDuration(){},
 readingAnnotationsRestoring:false,readingDraftSubmitted:false,readingAttemptKey:'a'.repeat(32),readingSubmissionState:null,requestedReadingDraftKey:null,readingAttemptMayReplaceLocalDraft:false,
 legacyModeDraftStorageKey:'legacy-mode',legacyReadingDraftStorageKey:'legacy',
 serializeReadingDraftResults:()=>[{questionId:201,answerId:101,ordinalNumber:1,clientAnswer:'B'}],serializeReadingQuestionStates:()=>[{questionId:201,answered:true}],serializeCompleteListStates:()=>[],serializeListeningAudioPositions:()=>({}),serializeReadingAnnotations:()=>[{noteId:'n1'}],
 getReadingQuestionEntries:()=>[{question:first},{question:next}],getReadingDraftPartNumbers:()=>[1],readingDraftStorageKey:()=> 'base',readActiveReadingDraft:()=>null,readStoredDraft:()=>null,
 storeReadingDraft(k,d){log.saved.push(structuredClone(d));return true;},saveReadingLearningDraft(){return Promise.resolve(true);}});
 nodeVm.runInContext(videoCode+timerCode+displayCode+saveCode+identityCode,c);
 return{vm,c,scope,log,timers,first,next,advance(seconds){now+=seconds*1000;},restore(draft){c.draft=draft;nodeVm.runInContext(restoreCode,c);}};
}
test('assigned video soft limit records 65 and 75 minutes without automatic submission, audio reset or timer-stopped',()=>{
 const f=fixture();f.scope.startCount();f.advance(3600);f.scope.onTimeout();
 assert.equal(f.scope.counter,0);assert.equal(f.log.submits.length,0);assert.equal(f.log.notices.length,1);assert.equal(f.log.broadcasts.length,0);
 f.advance(300);f.scope.onTimeout();assert.equal(f.c.getActiveDurationSeconds(),3900);assert.equal(f.vm.getRemainingMinutes(),65);assert.equal(f.vm.getRemainingClock(),'65:00');assert.equal(f.vm.getTimerStatusLabel(),'studied');
 f.advance(600);f.scope.onTimeout();assert.equal(f.c.getActiveDurationSeconds(),4500);assert.equal(f.log.notices.length,1);assert.equal(f.log.submits.length,0);assert.equal(f.vm.isVideoHomeworkOvertime(),true);
 assert.match(view,/Đã làm \{\{vm.getRemainingMinutes\(\)\}\} phút/);assert.match(view,/ng-click="vm.replayVideoSegment\(\)"/);
});
test('normal Reading, Writing, non-video Comprehensive, preview and unassigned tests retain their hard timeout',()=>{
 for(const options of [{reading:true},{writing:true},{noVideo:true},{unassigned:true},{preview:true}]){
  const f=fixture(options);f.scope.startCount();f.advance(3600);f.scope.onTimeout();assert.equal(f.log.submits.length,1,JSON.stringify(options));assert.equal(f.log.submits[0].automatic,true);assert.equal(f.log.broadcasts[0][0],'timer-stopped');assert.equal(f.log.notices.length,0);
 }
});
test('a 75-minute draft reload preserves the 60-minute budget, answer, note, assignment and same logical attempt',()=>{
 const first=fixture();first.scope.startCount();first.advance(4500);first.c.saveReadingDraft();
 const draft=first.log.saved.at(-1);assert.equal(draft.elapsedSeconds,4500);assert.equal(draft.remainingSeconds,0);assert.equal(draft.videoHomeworkBudgetSeconds,3600);assert.equal(draft.assignmentTaskId,238);assert.equal(draft.clientAttemptKey,'a'.repeat(32));assert.equal(draft.results[0].clientAnswer,'B');assert.equal(draft.annotationNotes[0].text,'Keep');
 const reloaded=fixture();reloaded.restore(draft);reloaded.c.restoreReadingSubmissionIdentity(draft);reloaded.scope.startCount();
 assert.equal(reloaded.c.seriousTotalSeconds,3600);assert.equal(reloaded.c.getActiveDurationSeconds(),4500);assert.equal(reloaded.c.readingAttemptKey,draft.clientAttemptKey);assert.equal(reloaded.c.readingSubmissionState,null);
 reloaded.advance(120);reloaded.scope.onTimeout();reloaded.c.saveReadingDraft();assert.equal(reloaded.c.getActiveDurationSeconds(),4620);assert.equal(reloaded.log.saved.at(-1).elapsedSeconds,4620);assert.equal(reloaded.log.submits.length,0);assert.equal(reloaded.log.notices.length,0,'reload does not repeat the transient notice');
});
test('an old zero-remaining draft keeps its elapsed time; the saved receipt and pending snapshot stay terminal/frozen identities',()=>{
 const f=fixture();f.restore({sessionMode:'SERIOUS',remainingSeconds:0,elapsedSeconds:3600});f.scope.startCount();f.scope.onTimeout();assert.equal(f.c.getActiveDurationSeconds(),3600);assert.equal(f.log.submits.length,0);
 const payload={clientAttemptKey:'a'.repeat(32),user:{id:7},testType:6,sourceQuestionId:42,assignmentTaskId:238,completedParts:[1]};
 for(const status of ['SAVED','PENDING']){const draft={remainingSeconds:0,elapsedSeconds:4500,submissionState:{key:payload.clientAttemptKey,status,payload,result:{...payload,id:91,resultStatus:'FAILED'}}};f.c.restoreReadingSubmissionIdentity(draft);assert.equal(f.c.readingSubmissionState.status,status);assert.equal(f.c.readingAttemptKey,payload.clientAttemptKey);assert.equal(f.c.readingSubmissionState.payload.assignmentTaskId,238);}
});
test('actual elapsed duration goes to testTime for assigned video; other tests retain existing countdown label',()=>{
 const assignment=part("            vm.testResult.testTime = formatTimerClock(", '            vm.testResult.ieltsSessionMode =');
 for(const options of [{},{noVideo:true}]){const f=fixture(options);f.scope.startCount();f.advance(4500);f.c.activeDurationSeconds=f.c.getActiveDurationSeconds();nodeVm.runInContext(assignment,f.c);assert.equal(f.vm.testResult.testTime,options.noVideo?'0:00':'75:00');}
});
test('rewinding below an unanswered cue can play regardless of play/progress event ordering, and pauses again at the cue',()=>{
 for(const playFirst of [false,true]){
  const f=fixture();f.vm.videoTimeline.cues[0].revealed=true;f.vm.onVideoProgress(30,100);assert.equal(f.log.pauses,1);assert.equal(f.vm.videoTimeline.active[0].seconds,30);
  if(playFirst)f.vm.onVideoState(true);f.vm.onVideoProgress(5,100);if(!playFirst)f.vm.onVideoState(true);
  assert.equal(f.log.pauses,1);assert.equal(f.vm.videoTimeline.visible(f.first),true);assert.equal(f.first.questionAnswers[0].clientAnswer,'B');assert.equal(f.vm.videoTimeline.visible(f.next),true);
  f.vm.onVideoProgress(29.5,100);assert.equal(f.log.pauses,1);f.vm.onVideoProgress(31.5,100);assert.equal(f.log.pauses,2);assert.equal(f.log.seeks.at(-1),30);
 }
});
test('explicit 10-second replay keeps answers, revealed cues and attempt key; ordinary test playback guard remains',()=>{
 const f=fixture();f.vm.videoTimeline.cues[0].revealed=true;f.vm.onVideoProgress(30,100);f.vm.replayVideoSegment();assert.equal(f.log.seeks.at(-1),20);assert.equal(f.log.plays,1);assert.equal(f.vm.videoTimeline.active[0].seconds,30);assert.equal(f.c.readingAttemptKey,'a'.repeat(32));assert.equal(f.first.questionAnswers[0].selected,true);
 const strict=fixture({unassigned:true});strict.vm.onVideoProgress(30,100);strict.vm.onVideoState(true);assert.equal(strict.log.pauses,2);strict.vm.replayVideoSegment();assert.equal(strict.log.plays,0);
});
test('replay ignores stale player positions until the asynchronous rewind completes, then protects the pending cue again',()=>{
 const f=fixture();f.vm.videoTimeline.cues[0].revealed=true;f.vm.onVideoProgress(30,100);f.vm.replayVideoSegment();
 f.vm.onVideoState(true);f.vm.onVideoProgress(30,100);f.vm.onVideoProgress(30.2,100);assert.equal(f.log.pauses,1);assert.equal(f.log.plays,1);assert.equal(f.vm.videoTimeline.currentSeconds,20);
 f.vm.onVideoProgress(20,100);assert.equal(f.c.pendingVideoReplay,null);assert.equal(f.log.pauses,1);f.vm.onVideoProgress(31.5,100);assert.equal(f.log.pauses,2);assert.equal(f.log.seeks.at(-1),30);
 assert.equal(f.first.questionAnswers[0].clientAnswer,'B');assert.equal(f.c.readingAttemptKey,'a'.repeat(32));
});
test('a failed asynchronous rewind cannot bypass the pending cue indefinitely',()=>{
 const f=fixture();f.vm.videoTimeline.cues[0].revealed=true;f.vm.onVideoProgress(30,100);f.vm.replayVideoSegment();f.vm.onVideoProgress(50,100);assert.equal(f.log.pauses,1);
 f.advance(2);f.vm.onVideoProgress(50,100);assert.equal(f.c.pendingVideoReplay,null);assert.equal(f.log.pauses,2);assert.equal(f.log.seeks.at(-1),30);
});
test('replay in the question-list fallback uses the current video position',()=>{
 const f=fixture();f.vm.videoFallbackMode=true;f.vm.onVideoProgress(60,100);f.vm.replayVideoSegment();assert.equal(f.log.seeks.at(-1),50);
});
test('a newly acknowledged receipt stops the soft timer without a later overtime notice',()=>{
 for(const receipt of ['submitted','result-page']){const f=fixture();f.scope.startCount();const count=f.timers.length;
  if(receipt==='submitted')f.c.readingDraftSubmitted=true;else f.vm.passageNumber=4;
  f.advance(3600);f.scope.onTimeout();assert.equal(f.timers.length,count);assert.equal(f.c.mytimeout,null);assert.equal(f.log.notices.length,0);assert.equal(f.log.submits.length,0);
 }
});
