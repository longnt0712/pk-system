const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSReadingActualTestController.js'),'utf8');
const view=fs.readFileSync(path.join(__dirname,'../question/views/ielts_reading_actual_test_idp.html'),'utf8');
const start=source.indexOf('        vm.hasPendingReadingSubmission = function'),end=source.indexOf('        function restoreSubmittedReadingReceipt()',start);
assert.ok(start>=0&&end>start);const runtime=source.slice(start,end),tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(writing=false){
 const key='a'.repeat(32),answer={questionAnswer:{id:101,question:{id:201}},ordinalNumber:1,clientAnswer:'being'};
 const payload={clientAttemptKey:key,sourceQuestionId:42,user:{id:7},assignmentTaskId:238,completedParts:[1],testType:writing?7:6,testTakerName:'Learner',questionAnswerTestResult:[answer]};
 const receipt={key,status:'SAVED',payload,result:{id:91,resultStatus:'FAILED'}};
 const draft={version:5,userId:7,testId:42,testMode:writing?'WRITING':'COMPREHENSIVE',assignmentTaskId:238,assignmentParts:[1],clientAttemptKey:key,submissionState:receipt,remainingSeconds:1099,elapsedSeconds:2501,results:[{answerId:101,clientAnswer:'being'}],comprehensiveShuffle:{enabled:true,seed:1729,questionsEnabled:false,answersEnabled:true},annotationNotes:[{id:'note1',text:'Keep note'}]};
 const local=new Map([['base',structuredClone(draft)],['base:attempt:'+key,structuredClone(draft)]]),cloud=[],requests=[],info=[],timers=[];
 const vm={isVideoHomeworkPractice:()=>false,isWritingRoute:writing,isComprehensiveRoute:!writing,isSubmittingTest:false,currentUser:{id:7},assignmentTaskId:238,assignedParts:[1],assignedPart:1,isPartAssignment:true,testSessionMode:'SERIOUS',ieltsReadingActualTest:{id:42,title:'Test',subQuestions:[]},annotationNotes:draft.annotationNotes,testResult:structuredClone(payload),testResultAfterSubmitting:structuredClone(receipt.result),passageNumber:4,isShowDetail:true};
 const c=nodeVm.createContext({vm,angular:{copy:structuredClone,isArray:Array.isArray,isFunction:v=>typeof v==='function'},service:{getAssignedTask(id){return new Promise((resolve,reject)=>requests.push({id,resolve,reject}));}},readingSubmissionState:receipt,readingDraftSubmitted:true,readingDraftDestroyed:false,readingAnnotationsRestoring:false,readingAttemptKey:key,restoredExpiredReadingDraft:false,requestedReadingDraftKey:'base:attempt:'+key,writingRetakeGeneration:0,writingGradingGeneration:2,mytimeout:17,countdownEndsAt:123,configuredWritingSeconds:writing?1200:3600,seriousTotalSeconds:3600,timerRestoredFromDraft:true,timerStarted:true,
 $timeout:{cancel:id=>timers.push(['cancel',id])},$scope:{startCount:()=>timers.push(['start'])},newReadingAttemptKey:()=> 'b'.repeat(32),displayPassageForAssignedPart:()=>1,readingDraftStorageKey:()=> 'base',readStoredDraft:k=>structuredClone(local.get(k)),
 readingCloudDraftKey:(k,d)=>k+':attempt:'+d.clientAttemptKey,readActiveReadingDraft:k=>structuredClone(local.get(k)),
 storeReadingDraft(k,d,replace){assert.equal(replace,true);local.set(k,structuredClone(d));local.set(k+':attempt:'+d.clientAttemptKey,structuredClone(d));return true;},saveReadingLearningDraft(k,d){cloud.push(structuredClone(d));return Promise.resolve(true);},serializeReadingDraftResults:()=>[{answerId:101,clientAnswer:'being'}],serializeReadingQuestionStates:()=>[{questionId:201,answered:true,answers:[{answerId:101,selected:true,clientAnswer:'being'}]}],serializeReadingAnnotations:()=>[{noteId:'A'}],serializeCompleteListStates:()=>[{questionId:201,clientAnswer:'A'}],serializeListeningAudioPositions:()=>({201:17}),setStudyElapsedSeconds:s=>timers.push(['study',s]),setCountdownSeconds:s=>timers.push(['clock',s]),startReadingDraftAutosave(){},saveReadingDraft(){},toastr:{info:t=>info.push(t)}});
 nodeVm.runInContext(runtime,c);return{vm,c,local,cloud,requests,info,timers,receipt,eligible:{taskId:238,activityType:writing?'IELTS_WRITING':'COMPREHENSIVE',ieltsTestId:42,ieltsParts:[1],canStartNewAttempt:true}};
}
test('failed Comprehensive exposes an explicit retake without submitting or changing saved history on load',()=>{
 const f=fixture();assert.equal(f.vm.hasFailedWritingReceipt(),true);assert.equal(f.vm.canStartNewWritingAttempt(),true);assert.equal(f.requests.length,0);assert.equal(f.c.readingSubmissionState.result.id,91);assert.equal(f.cloud.length,0);
 assert.match(view,/ng-if="vm.hasFailedWritingReceipt\(\)"[^>]*ng-click="vm.startNewWritingAttempt\(\)"/s);assert.match(view,/Giữ \{\{vm.isWritingRoute \? 'bài viết' : 'câu trả lời'\}\}/);
});
test('retake verifies the task then preserves editable answers, notes, layout and old receipt while starting one new clock and key',async()=>{
 const f=fixture();f.vm.startNewWritingAttempt();f.vm.startNewWritingAttempt();assert.equal(f.requests.length,1);assert.equal(f.c.readingSubmissionState.result.id,91);assert.equal(f.timers.length,0);f.requests[0].resolve(f.eligible);await tick();
 assert.equal(f.c.readingAttemptKey,'b'.repeat(32));assert.equal(f.c.readingSubmissionState,null);assert.equal(f.c.readingDraftSubmitted,false);assert.equal(f.vm.passageNumber,1);assert.equal(f.vm.isShowDetail,false);assert.equal(f.vm.testResult.questionAnswerTestResult[0].clientAnswer,'being');
 const fresh=f.local.get('base');assert.equal(fresh.testMode,'COMPREHENSIVE');assert.equal(fresh.assignmentTaskId,238);assert.deepEqual(Array.from(fresh.assignmentParts),[1]);assert.equal(fresh.remainingSeconds,3600);assert.equal(fresh.elapsedSeconds,0);assert.equal(fresh.results[0].clientAnswer,'being');assert.equal(fresh.annotationNotes[0].text,'Keep note');assert.equal(fresh.comprehensiveShuffle.seed,1729);assert.equal(fresh.comprehensiveShuffle.questionsEnabled,false);
 assert.equal(f.local.get('base:attempt:'+'a'.repeat(32)).submissionState.result.id,91);assert.equal(f.cloud.length,1);assert.match(f.info[0],/giữ câu trả lời/);assert.deepEqual(f.timers,[['cancel',17],['clock',3600],['start']]);f.vm.startNewWritingAttempt();assert.equal(f.requests.length,1);
 const identityStart=source.indexOf('        function readingSubmissionType()'),identityEnd=source.indexOf('        function persistReadingSubmissionState()',identityStart);
 nodeVm.runInContext(source.slice(identityStart,identityEnd),f.c);f.c.readingAttemptKey=null;f.c.restoreReadingSubmissionIdentity(fresh);
 assert.equal(f.c.readingAttemptKey,'b'.repeat(32),'reload continues the newly started attempt');assert.equal(f.c.readingSubmissionState,null);assert.equal(f.c.restoredExpiredReadingDraft,false);
});
test('expired, unsupported, mismatched or changed assignment preserves the failed receipt and cannot reset time',async()=>{
 for(const change of [t=>{t.canStartNewAttempt=false;t.newAttemptUnavailableReason='Đã hết hạn';},t=>{delete t.canStartNewAttempt;},t=>{t.taskId=999;},t=>{t.ieltsTestId=99;},t=>{t.activityType='IELTS_WRITING';},t=>{t.ieltsParts=[2];}]){
  const f=fixture();change(f.eligible);f.vm.startNewWritingAttempt();f.requests[0].resolve(f.eligible);await tick();assert.equal(f.c.readingAttemptKey,'a'.repeat(32));assert.equal(f.c.readingSubmissionState.result.id,91);assert.equal(f.vm.passageNumber,4);assert.equal(f.timers.length,0);assert.equal(f.cloud.length,0);assert.equal(f.vm.canStartNewWritingAttempt(),false);assert.ok(f.vm.writingNewAttemptError);
 }
});
test('failed eligibility requests can retry; late responses for a destroyed or changed attempt cannot start a timer',async()=>{
 const f=fixture();f.vm.startNewWritingAttempt();f.requests[0].reject(Error('Offline'));await tick();assert.equal(f.vm.canStartNewWritingAttempt(),true);assert.equal(f.c.readingSubmissionState.result.id,91);f.vm.startNewWritingAttempt();f.c.readingDraftDestroyed=true;f.requests[1].resolve(f.eligible);await tick();assert.equal(f.timers.length,0);
 const changed=fixture();changed.vm.startNewWritingAttempt();changed.c.readingSubmissionState={status:'PENDING'};changed.requests[0].resolve(changed.eligible);await tick();assert.equal(changed.timers.length,0);
});
test('Writing keeps its essay and configured time; successful, pending and other test routes do not offer this retake',async()=>{
 const f=fixture(true);f.vm.startNewWritingAttempt();f.requests[0].resolve(f.eligible);await tick();assert.equal(f.local.get('base').testMode,'WRITING');assert.equal(f.local.get('base').remainingSeconds,1200);assert.equal(f.vm.testResult.questionAnswerTestResult[0].clientAnswer,'being');assert.match(f.info[0],/giữ bài viết/);
 for(const status of ['SUCCESS',null]){const done=fixture();done.receipt.result.resultStatus=status;assert.equal(done.vm.hasFailedWritingReceipt(),false);}const pending=fixture();pending.receipt.status='PENDING';assert.equal(pending.vm.canStartNewWritingAttempt(),false);const other=fixture();other.vm.isComprehensiveRoute=false;assert.equal(other.vm.canStartNewWritingAttempt(),false);
});
test('retaking selected receipt A never clones another active base draft B layout, highlights or drag state',async()=>{
 const f=fixture(),original=f.local.get('base:attempt:'+'a'.repeat(32));original.annotations=[{noteId:'A'}];
 f.local.set('base',{clientAttemptKey:'c'.repeat(32),comprehensiveShuffle:{seed:9999},annotations:[{noteId:'B'}],completeListStates:[{questionId:999,clientAnswer:'B'}],listeningAudioPositions:{999:88}});
 f.vm.comprehensiveShuffleState={enabled:true,seed:1729,questionsEnabled:false};f.c.readingAnnotationsRestoring=true;
 f.vm.startNewWritingAttempt();f.requests[0].resolve(f.eligible);await tick();const fresh=f.local.get('base');
 assert.equal(fresh.comprehensiveShuffle.seed,1729);assert.deepEqual(fresh.annotations,[{noteId:'A'}]);assert.deepEqual(fresh.completeListStates,[{questionId:201,clientAnswer:'A'}]);assert.deepEqual(fresh.listeningAudioPositions,{201:17});
});
test('a free Study retake resets its count-up clock rather than resuming elapsed time from the failed attempt',()=>{
 const f=fixture();f.vm.assignmentTaskId=null;f.vm.isPartAssignment=false;f.vm.testSessionMode='STUDY';f.vm.startNewWritingAttempt();
 assert.deepEqual(f.timers,[['cancel',17],['study',0],['start']]);assert.equal(f.local.get('base').elapsedSeconds,0);assert.equal(f.local.get('base').remainingSeconds,0);assert.equal(f.requests.length,0);
});
