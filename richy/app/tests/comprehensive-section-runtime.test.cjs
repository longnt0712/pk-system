const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSReadingActualTestController.js'),'utf8');
const route=fs.readFileSync(path.join(__dirname,'../question/question.module.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function chunk(from,to,after=0){const a=source.indexOf(from,after),b=source.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,from);return source.slice(a,b);}
const key='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const angular={isArray:Array.isArray,copy:structuredClone,isDefined:v=>v!==undefined,isFunction:v=>typeof v==='function',forEach:(items,fn)=>Object.entries(items||{}).forEach(([i,v])=>fn(v,Array.isArray(items)?Number(i):i))};
function settings(sectionKey=key){
 const c=nodeVm.createContext({vm:{currentUser:{id:7},isComprehensiveRoute:true,isWritingRoute:false,isListeningRoute:false,isFlexibleRoute:true,isPreviewMode:false},
  angular,$stateParams:{ieltsReadingTestId:42,assignmentTaskId:10,assignmentPart:1,assignmentParts:'1',assignmentSectionKey:sectionKey}});
 nodeVm.runInContext(chunk('        vm.assignmentTaskId =','        function getResultQuestionType('),c);c.vm.testSessionMode='SERIOUS';return c;
}
function task(minutes=20){return{taskId:10,activityType:'COMPREHENSIVE',ieltsTestId:42,comprehensiveTimeLimitMinutes:60,comprehensiveSections:[
 {key,number:1,questionIds:[51,52],questionCount:2,firstOrdinal:51,lastOrdinal:52,durationMinutes:minutes},
 {key:other,number:2,questionIds:[53,54],questionCount:2,firstOrdinal:53,lastOrdinal:54,durationMinutes:30}]};}
function question(id){return{id,ordinalNumber:id,question:'Question '+id,parent:{type:1},questionAnswers:[{id:id+100,ordinalNumberQuestionAnswer:1,answer:{answer:'Choice '+id},correct:true,question:{id,parent:{type:1}}}]};}
function data(){return{id:42,title:'A large exercise',subQuestions:[{id:1,ordinalNumber:1,question:'Shared introduction',questionType:{code:'IELTSRTP1'},subQuestions:[{id:11,type:1,ordinalNumber:1,subQuestions:[question(51),question(52),question(53)]}]},
 {id:2,ordinalNumber:2,question:'Second context',questionType:{code:'IELTSRTP2'},subQuestions:[{id:12,type:6,ordinalNumber:1,subQuestions:[question(54)]}]},{id:3,ordinalNumber:3,subQuestions:[]}]};}
test('authoritative section selection rejects a missing key, changed test, duplicate membership and old backend',()=>{
 const c=settings();c.vm.configureComprehensiveAssignment(task(0));assert.equal(c.vm.isUntimedComprehensiveAssignment(),true);assert.equal(c.vm.testSessionMode,'SERIOUS');assert.match(c.vm.assignedPartsLabel(),/Phần 1\/2.*51–52/);
 assert.throws(()=>settings(null).vm.configureComprehensiveAssignment(task()),/chia phần/);
 assert.throws(()=>c.vm.configureComprehensiveAssignment({...task(),ieltsTestId:99}),/không khớp/);
 assert.throws(()=>c.vm.configureComprehensiveAssignment({...task(),comprehensiveSections:[]}),/backend mới/);
 const duplicate=task();duplicate.comprehensiveSections[1].questionIds=[52,54];assert.throws(()=>c.vm.configureComprehensiveAssignment(duplicate),/trùng/);
 assert.match(route,/comprehensive_test\/:ieltsReadingTestId\?[^'\n]*assignmentSectionKey/);
});
test('section filtering happens on a copy before shuffle and keeps original IDs, global ordinals, option IDs and shared context',()=>{
 const c=settings();c.vm.configureComprehensiveAssignment(task());nodeVm.runInContext(chunk('        function restrictComprehensiveAssignmentSection(','        function normalizeLocalReadingPreview('),c);
 const original=data(),filtered=c.restrictComprehensiveAssignmentSection(original),pack=filtered.subQuestions[0].subQuestions[0];
 assert.deepEqual(plain(pack.subQuestions.map(q=>[q.id,q.ordinalNumber,q.questionAnswers[0].id])),[[51,51,151],[52,52,152]]);
 assert.equal(pack.parent.questionType.code,'IELTSRTP1');assert.equal(filtered.subQuestions[1].subQuestions.length,0);assert.equal(original.subQuestions[0].subQuestions[0].subQuestions.length,3);
 assert.match(filtered.subQuestions[0].question,/Shared introduction/);assert.doesNotMatch(filtered.subQuestions[0].question,/Second context/);
 const flow=chunk('                var testRequest;','        vm.getOneTestResult =',source.indexOf('if ($stateParams.ieltsReadingTestId != null)'));
 assert.match(flow,/configureComprehensiveAssignment\(task\)[\s\S]*getOne\([^)]*\)\.then\(restrictComprehensiveAssignmentSection\)/);
});
test('a changed source or a shared answer group cut in half cannot silently render another section',()=>{
 const c=settings();c.vm.configureComprehensiveAssignment(task());nodeVm.runInContext(chunk('        function restrictComprehensiveAssignmentSection(','        function normalizeLocalReadingPreview('),c);
 const extra=data();extra.subQuestions[1].subQuestions[0].subQuestions.push(question(55));assert.throws(()=>c.restrictComprehensiveAssignmentSection(extra),/Đề đã thay đổi/);
 const missing=data();missing.subQuestions[0].subQuestions[0].subQuestions.pop();assert.throws(()=>c.restrictComprehensiveAssignmentSection(missing),/Đề đã thay đổi/);
 const grouped=data();grouped.subQuestions[0].subQuestions[0].type=13;assert.throws(()=>c.restrictComprehensiveAssignmentSection(grouped),/Nhóm câu hỏi đã thay đổi/);
 const headings=data(),passage=headings.subQuestions[0];passage.subQuestions=[{id:11,type:4,subQuestions:[question(51),question(52)]},{id:13,type:1,subQuestions:[question(53)]}];
 assert.throws(()=>c.restrictComprehensiveAssignmentSection(headings),/matching heading đã thay đổi/);
});
test('a section cannot merge two passage heading banks, and a selected heading passage never fills another passage markers',()=>{
 const c=settings(),all=task();all.comprehensiveSections=[{...all.comprehensiveSections[0],questionIds:[51,52,53,54],questionCount:4}];c.vm.configureComprehensiveAssignment(all);
 nodeVm.runInContext(chunk('        function restrictComprehensiveAssignmentSection(','        function normalizeLocalReadingPreview('),c);
 const headings=data();headings.subQuestions[0].subQuestions[0].type=4;headings.subQuestions[0].question='First headings }{HEADING}{';
 headings.subQuestions[1].subQuestions[0].type=4;headings.subQuestions[1].question='Second headings }{HEADING}{';
 assert.throws(()=>c.restrictComprehensiveAssignmentSection(headings),/nhiều ngân hàng matching heading/);
 const separated=task();separated.comprehensiveSections[0].questionIds=[54];separated.comprehensiveSections[1].questionIds=[51,52,53];c.vm.configureComprehensiveAssignment(separated);
 const filtered=c.restrictComprehensiveAssignmentSection(headings);assert.equal(filtered.subQuestions[0].question,'Second headings }{HEADING}{');
 assert.deepEqual(plain(filtered.subQuestions[0].subQuestions.flatMap(pack=>pack.subQuestions.map(q=>q.id))),[54]);
});
test('section draft keys and strict receipt context isolate sibling sections and the former whole test',()=>{
 const c=settings();c.vm.configureComprehensiveAssignment(task());const stored=new Map();
 Object.assign(c,{$window:{sessionStorage:{getItem:()=>null}},$location:{search:()=>({})},readingDraftMemory:{},readStoredDraft:k=>stored.get(k)||null});
 nodeVm.runInContext(chunk("        var readingDraftBaseKey =",'        function mergeStudyLearningDrafts('),c);
 nodeVm.runInContext(chunk('        function readReadingDraft(','        function clearReadingDraft('),c);
 const base=c.readingDraftStorageKey(42,'SERIOUS');assert.equal(base,'ieltsReadingInProgress:7:comprehensive:test:42:serious:task:10:parts:1:section:'+key);
 const valid={userId:7,testId:42,testMode:'COMPREHENSIVE',sessionMode:'SERIOUS',assignmentTaskId:10,assignmentParts:[1],assignmentSectionKey:key,savedAt:'2026-10-29T12:00:00Z'};
 stored.set(base,{...valid,assignmentSectionKey:other});assert.equal(c.readReadingDraft(42,'SERIOUS'),null);
 stored.set(base,{...valid,assignmentSectionKey:null});assert.equal(c.readReadingDraft(42,'SERIOUS'),null);
 stored.set(base,valid);assert.equal(c.readReadingDraft(42,'SERIOUS').assignmentSectionKey,key);
 c.vm.ieltsReadingActualTest={id:42};nodeVm.runInContext(chunk('        function readingSubmissionType()','        function persistReadingSubmissionState()'),c);
 const payload={clientAttemptKey:'a'.repeat(32),user:{id:7},sourceQuestionId:42,testType:6,assignmentTaskId:10,assignmentSectionKey:key,completedParts:[1]};
 assert.equal(c.readingSubmissionContextMatches(payload),true);assert.equal(c.readingSubmissionContextMatches({...payload,assignmentSectionKey:other}),false);
 assert.equal(c.readingSubmissionAcknowledged({...payload,id:91},payload),true);
 for(const wrong of [{...payload,id:91,assignmentSectionKey:other},{...payload,id:91,assignmentSectionKey:null}])assert.equal(c.readingSubmissionAcknowledged(wrong,payload),false);
 const old={...payload,id:91};delete old.assignmentSectionKey;assert.equal(c.readingSubmissionAcknowledged(old,payload),false);
});
test('Finish submits only this section with its shared task ID, stable key, original answer IDs and Serious timing',()=>{
 const c=settings();c.vm.configureComprehensiveAssignment(task(0));
 Object.assign(c,{readingDraftSubmitted:false,readingAttemptKey:null,readingSubmissionState:null,restoredExpiredReadingDraft:false,
  $scope:{counter:4500},document:{getElementById:()=>({innerHTML:'<p>Kept notes</p>'})},toastr:{error:message=>{throw Error(message);}},
  saveReadingDraft(){},syncTimerForPersistence(){},getActiveDurationSeconds:()=>4500,formatTimerClock:s=>String(s),getWritingTaskPackages:()=>[],buildIeltsLearningState:()=>({}),
  newReadingAttemptKey:()=> 'a'.repeat(32),submitReadingAttemptSnapshot(){c.sent=plain(c.readingSubmissionState.payload);}});
 c.vm.isVideoHomeworkPractice=()=>false;c.vm.testResult={user:{id:7},testTakerName:'Learner',questionAnswerTestResult:[]};
 nodeVm.runInContext(chunk('        function restrictComprehensiveAssignmentSection(','        function normalizeLocalReadingPreview('),c);
 c.vm.ieltsReadingActualTest=c.restrictComprehensiveAssignmentSection(data());
 for(const q of c.vm.ieltsReadingActualTest.subQuestions[0].subQuestions[0].subQuestions)q.questionAnswers[0].selected=true;
 nodeVm.runInContext(chunk('        function listeningPartNumberForOrdinal(','        vm.ieltsNavigationAnsweredCount ='),c);
 nodeVm.runInContext(chunk('        function synchronizeReadingResultsBeforeSubmit()','        function decodeStudyTextEntities('),c);
 nodeVm.runInContext(chunk('        vm.saveTestResult = function','        vm.isShowDetail ='),c);c.vm.saveTestResult();
 assert.equal(c.sent.assignmentTaskId,10);assert.equal(c.sent.assignmentSectionKey,key);assert.deepEqual(c.sent.completedParts,[1]);assert.equal(c.sent.ieltsSessionMode,'SERIOUS');
 assert.equal(c.sent.activeDurationSeconds,4500);assert.equal(c.sent.testTime,'4500');assert.equal(c.vm.resultQuestionTotal,2);assert.match(c.sent.testName,/Phần 1\/2.*51–52/);
 assert.deepEqual(c.sent.questionAnswerTestResult.map(row=>[row.ordinalNumber,row.questionAnswer.id]),[[51,151],[52,152]]);
});
function timer({minutes=20,video=false,section=true}={}){
 let now=1000000,next=1;const scheduled=new Map(),c=settings(section?key:null);let settingsTask=task(minutes);if(!section)settingsTask={...settingsTask,comprehensiveSections:[],comprehensiveTimeLimitMinutes:minutes};c.vm.configureComprehensiveAssignment(settingsTask);
 Object.assign(c,{Date:class extends Date{static now(){return now;}},readingDraftSubmitted:false,$scope:{counter:3600,$broadcast(){},$evalAsync(fn){if(fn)fn();}},$window:{document:{hidden:false}},document:{getElementById:()=>null},getMainAudio:()=>null,getWritingTaskPackages:()=>[],saveReadingDraft(){},submissions:0,notices:0,
  toastr:{info(){c.notices++;}},$timeout(fn){const id=next++;scheduled.set(id,fn);return id;}});c.$timeout.cancel=id=>scheduled.delete(id);
 c.vm.isVideoHomeworkPractice=()=>video;c.vm.saveTestResult=()=>c.submissions++;
 nodeVm.runInContext(chunk('        $scope.counter = 3600;','        function syncTimerWhenVisible()'),c);
 nodeVm.runInContext(chunk('        vm.getRemainingMinutes = function','        vm.ieltsReadingActualTest = {};'),c);
 nodeVm.runInContext(chunk('                    if (vm.isWritingRoute) {','                    vm.getOrdinalNumber(data);',source.indexOf('                    vm.ieltsReadingActualTest = data;')),c);
 return{c,start(){c.vm.isStartTest=true;c.$scope.startCount();},tick(seconds){now+=seconds*1000;const callbacks=[...scheduled.values()];scheduled.clear();callbacks.forEach(fn=>fn());},restore(draft){c.draft=draft;nodeVm.runInContext(chunk("            if (vm.testSessionMode === 'STUDY' && draft.sessionMode === 'STUDY') {",'            vm.annotationNotes ='),c);}};
}
test('untimed assigned sections keep Serious submission rules and count only active time, including resume',()=>{
 const f=timer({minutes:0});f.restore({sessionMode:'SERIOUS',elapsedSeconds:4500,remainingSeconds:0});f.start();f.tick(10);
 assert.equal(f.c.vm.testSessionMode,'SERIOUS');assert.equal(f.c.getActiveDurationSeconds(),4510);assert.equal(f.c.submissions,0);assert.equal(f.c.vm.getTimerStatusLabel(),'elapsed');
 f.c.pauseStudyTimer();f.c.$window.document.hidden=true;f.tick(60);assert.equal(f.c.getActiveDurationSeconds(),4510);
});
test('explicit nonvideo time applies to split and unsplit assignments and resumes against the teacher budget',()=>{
 for(const section of [true,false]){const f=timer({minutes:20,section});f.restore({sessionMode:'SERIOUS',elapsedSeconds:300,remainingSeconds:3300});f.start();assert.equal(f.c.$scope.counter,900);f.tick(901);assert.equal(f.c.submissions,1);}
 const legacy=timer({minutes:null,section:false});legacy.start();assert.equal(legacy.c.$scope.counter,3600);
});
test('timed video keeps its soft limit and elapsed time after resume while untimed video never announces overtime',()=>{
 const f=timer({minutes:20,video:true});f.restore({sessionMode:'SERIOUS',elapsedSeconds:1250,remainingSeconds:0,videoHomeworkBudgetSeconds:3600});f.start();f.tick(10);
 assert.equal(f.c.getActiveDurationSeconds(),1260);assert.equal(f.c.vm.isVideoHomeworkOvertime(),true);assert.equal(f.c.submissions,0);
 const fresh=timer({minutes:20,video:true});fresh.start();fresh.tick(1201);fresh.tick(10);assert.equal(fresh.c.notices,1);assert.equal(fresh.c.submissions,0);
 const unlimited=timer({minutes:0,video:true});unlimited.start();unlimited.tick(7200);assert.equal(unlimited.c.getActiveDurationSeconds(),7200);assert.equal(unlimited.c.vm.isVideoHomeworkOvertime(),false);assert.equal(unlimited.c.notices,0);assert.equal(unlimited.c.submissions,0);
});
