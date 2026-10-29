const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.resolve(process.env.IELTS_STUDY_RESUME_APP||path.join(__dirname,'..'));
const source=fs.readFileSync(path.join(app,'question/controllers/IELTSReadingActualTestController.js'),'utf8').replace(/\r\n/g,'\n');
const view=fs.readFileSync(path.join(app,'question/views/ielts_reading_actual_test_idp.html'),'utf8').replace(/\r\n/g,'\n');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function functionCode(name,property=false){
  const needle=property?'vm.'+name+' = function':'function '+name+'(';
  const start=source.indexOf(needle);assert.ok(start>=0,'actual source contains '+name);
  const first=source.indexOf('{',start);let depth=0,quote=null,lineComment=false,blockComment=false;
  for(let i=first;i<source.length;i++){
    const character=source[i],next=source[i+1];
    if(lineComment){if(character==='\n')lineComment=false;continue;}
    if(blockComment){if(character==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(character==='\\'){i++;continue;}if(character===quote)quote=null;continue;}
    if(character==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(character==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(character==='"'||character==="'"||character==='`'){quote=character;continue;}
    if(character==='{')depth++;
    if(character==='}'&&--depth===0)return source.slice(start,i+1)+(property?';':'');
  }
  throw Error('Unclosed source function '+name);
}
function storage(blocked=false){
  const values=new Map();return{values,get length(){return values.size;},key:index=>[...values.keys()][index],
    getItem(key){if(blocked)throw Error('storage unavailable');return values.get(key)||null;},
    setItem(key,value){if(blocked)throw Error('storage unavailable');values.set(key,value);},
    removeItem(key){if(blocked)throw Error('storage unavailable');values.delete(key);}};
}
const commonFunctions=['normalizeAssignedParts','readingDraftStorageKey','mergeStudyLearningDrafts','readingCloudDraftKey',
  'readingLocalDraftKey','protectReadingSubmissionSnapshot','storeReadingDraft','readActiveReadingDraft','readStoredDraft',
  'saveReadingLearningDraft','readReadingDraft','readingSubmissionType','readingSubmissionParts','readingSubmissionContextMatches',
  'newReadingAttemptKey','readingSubmissionAcknowledged','restoreReadingSubmissionIdentity','reopenSubmittedStudyDraft',
  'findDraftQuestionState','findDraftResult','findDraftResults','findQuestionAnswer','findCompleteListDraftState','findCompleteListWord',
  'restoreMatchingHeadingDraft','restoreReadingDraft','serializeReadingDraftResults','serializeReadingQuestionStates',
  'serializeCompleteListStates','serializeListeningAudioPositions','mainListeningPosition','rememberMainListeningAudioPosition',
  'serializeMainListeningAudioPositions','restoreMainListeningAudioPositions','getReadingDraftPartNumbers','saveReadingDraft',
  'persistReadingSubmissionState','submitReadingAttemptSnapshot'];
function fixture(options={}){
  const type=options.type||4,mode=options.mode||'STUDY',task=options.assignment?238:null;
  const log={cloudWrites:[],resultWrites:[],reads:[],deletes:[],views:[],grades:[],notices:[],timers:[],keys:0,autosaves:0};
  const local=storage(!!options.blockedStorage),contextMemory={};
  const answer={id:101,ordinalNumberQuestionAnswer:1,selected:false,clientAnswer:'',answer:{answer:'B'}};
  const question={id:201,ordinalNumber:1,answered:false,questionAnswers:[answer]};answer.question=question;
  const pack={id:51,type:type===7?16:1,subQuestions:[question]},testObject={id:42,title:'Saved learning',pronounce:type===2?'audio.mp3':null,subQuestions:[{subQuestions:[pack]}]};
  const vm={currentUser:{id:7},ieltsReadingActualTest:testObject,isComprehensiveRoute:type===6,isWritingRoute:type===7,
    isListeningRoute:type===2,isFlexibleRoute:type===6||type===7,assignmentTaskId:task,isPartAssignment:!!task,assignedParts:task?[1]:[],assignedPart:task?1:null,
    testSessionMode:mode,selectedTestSessionMode:mode,isPreviewMode:!!options.preview,isStartTest:true,isStartingTest:false,
    isLearningReview:true,passageNumber:4,availableIeltsParts:[1],testResult:{questionAnswerTestResult:[]},
    autoScrollToView(){},isStudyMode:()=>mode==='STUDY',isVideoHomeworkPractice:()=>false};
  const timeout=Object.assign((callback,delay)=>{const item={callback,delay};log.timers.push(item);return item;},{cancel(item){if(item)item.cancelled=true;}});
  const c=nodeVm.createContext({vm,angular:{copy:structuredClone,isArray:Array.isArray,isDefined:value=>value!==undefined,
      isFunction:value=>typeof value==='function',noop(){},forEach:(items,callback)=>Object.entries(items||{}).forEach(([key,value])=>callback(value,key))},
    $stateParams:{ieltsReadingTestId:42},$scope:{},$timeout:timeout,Date,JSON,Math,Number,String,Uint8Array,
    mainListeningPositions:[],resumeAudio:null,resumeAudioReady:false,resumeAudioPending:null,
    $window:{localStorage:local,crypto:{getRandomValues(bytes){log.keys++;for(let i=0;i<bytes.length;i++)bytes[i]=(i+log.keys)%256;}}},
    readingDraftBaseKey:'ieltsReadingInProgress:7',readingDraftTaskSuffix:'',legacyModeDraftStorageKey:'legacy-mode',legacyReadingDraftStorageKey:'legacy',maximumAssignedPart:type===2?4:type===7?2:type===6?1:3,
    readingAttemptKey:null,readingSubmissionState:null,readingDraftSubmitted:false,readingDraftDestroyed:false,restoredExpiredReadingDraft:false,
    requestedReadingDraftKey:null,readingAttemptMayReplaceLocalDraft:false,readingDraftMemory:contextMemory,readingDraftSaveQueues:{},readingDraftPendingSaves:{},
    readingAnnotationsRestoring:false,pendingReadingAnnotations:null,lastReadingAnnotations:[],unrestoredReadingAnnotations:[],readingAnnotationRestoreTimer:null,
    timerRestoredFromDraft:false,seriousTotalSeconds:3600,configuredWritingSeconds:3600,studyElapsedSeconds:0,readingDraftAutosaveTimer:null,
    getReadingQuestionEntries:()=>[{question,questionPackage:pack,packageType:pack.type,passageNumber:1}],
    getAllReadingQuestionEntries:()=>[{question,questionPackage:pack,packageType:pack.type,passageNumber:1}],
    listeningPartNumberForOrdinal:()=>1,displayPassageForAssignedPart:()=>1,restoreWritingInputAudit(){},writingInputAuditSummary:()=>({pasteEvents:0}),
    setStudyElapsedSeconds(seconds){c.studyElapsedSeconds=seconds;},getActiveDurationSeconds:()=>c.studyElapsedSeconds,
    setCountdownSeconds(seconds){c.remainingSeconds=seconds;},syncTimerForPersistence(){},restoreVideoHomeworkClock(){},
    restoreReadingAnnotations(annotations){log.annotations=structuredClone(annotations);},serializeReadingAnnotations:()=>structuredClone(log.annotations||[]),
    startReadingDraftAutosave(){log.autosaves++;},blockUI:{start(){},stop(){}},
    displaySubmittedTestResult(result){log.views.push(result.id);vm.passageNumber=4;},
    showSubmittedTestResult(id){log.views.push(id);vm.passageNumber=4;},gradeSubmittedWritingResult(){log.grades.push(1);},
    markStudyDraftCompleted(){},clearReadingDraft(){log.deletes.push('current-draft');},
    toastr:{success(...args){log.notices.push(args);},info(...args){log.notices.push(args);},warning(...args){log.notices.push(args);},error(...args){log.notices.push(args);}},
    service:{saveLearningDraft(dto){log.cloudWrites.push(structuredClone(dto));return Promise.resolve({id:8,...dto});},
      deleteLearningDraft(key){log.deletes.push(key);return Promise.resolve();},
      getOneTestResult(id){log.reads.push(id);return Promise.resolve(null);},
      saveTestResult(payload){return new Promise((resolve,reject)=>log.resultWrites.push({payload:structuredClone(payload),resolve,reject}));}}});
  nodeVm.runInContext(commonFunctions.map(name=>functionCode(name)).join('\n'),c);
  for(const name of ['hasPendingReadingSubmission','retryPendingStudySubmission'])nodeVm.runInContext(functionCode(name,true),c);
  const base=c.readingDraftStorageKey(42,mode),key='a'.repeat(32);
  const savedPayload={clientAttemptKey:key,user:{id:7},sourceQuestionId:42,assignmentTaskId:task,testType:type,completedParts:task?[1]:[],
    questionAnswerTestResult:[{questionAnswer:{id:101},ordinalNumber:1,clientAnswer:'Retained original answer'}],activeDurationSeconds:627,ieltsSessionMode:mode};
  const result={...savedPayload,id:91,resultStatus:options.failed?'FAILED':'SUCCESS'};
  const draft={version:5,userId:7,testId:42,title:'Saved learning',testMode:type===6?'COMPREHENSIVE':type===7?'WRITING':type===2?'LISTENING':'READING',
    isListening:type===2,sessionMode:mode,clientAttemptKey:key,assignmentTaskId:task,isPartAssignment:!!task,assignmentParts:task?[1]:[],
    partNumbers:[1],studiedParts:[1],completed:!task,resultId:91,savedAt:'2026-10-23T12:00:00Z',passageNumber:1,elapsedSeconds:627,remainingSeconds:2973,
    results:[{questionId:201,answerId:101,answerOrdinal:1,ordinalNumber:1,clientAnswer:'Retained original answer'}],
    questionStates:[{questionId:201,ordinalNumber:1,needReview:true,answers:[{answerId:101,selected:true,clientAnswer:'Retained original answer'}]}],
    annotationNotes:[{id:'n1',text:'My saved note'}],annotations:[{containerId:'passage-text-1',start:1,end:3,color:'yellow'}],
    listeningAudioPositions:{51:18.5,...(type===2&&!options.legacy?{mainAudio:[{source:'audio.mp3',seconds:300}]}:{})},
    completeListStates:[],submissionState:{key,status:options.pending?'PENDING':'SAVED',payload:savedPayload,result}};
  if(options.pending){draft.completed=false;draft.resultId=null;delete draft.submissionState.result;}
  if(options.legacy){delete draft.submissionState;delete draft.clientAttemptKey;}
  function seed(storageKey,value){local.values.set(storageKey,JSON.stringify(value));contextMemory[storageKey]=structuredClone(value);}
  seed(base,draft);if(draft.clientAttemptKey)seed(c.readingCloudDraftKey(base,draft),draft);
  function flush(){const pending=log.timers.splice(0);for(const timer of pending)if(!timer.cancelled)timer.callback();}
  return {vm,c,log,local,question,answer,pack,draft,result,savedPayload,base,key,seed,flush,
    open(){c.restoreReadingDraft();flush();}, snapshot(storageKey){return c.readStoredDraft(storageKey);}};
}

test('Study SAVED receipts reopen Reading, Listening, Comprehensive and Writing as learning with their data intact', async()=>{
  for(const type of [2,4,6,7])for(const failed of [false,true]){
    const f=fixture({type,failed}),old=plain(f.draft);f.open();await tick();
    assert.equal(f.c.readingSubmissionState,null);assert.equal(f.c.readingDraftSubmitted,false);assert.equal(f.vm.isLearningReview,false);
    assert.notEqual(f.c.readingAttemptKey,f.key);assert.match(f.c.readingAttemptKey,/^[a-f0-9]{32}$/);
    assert.equal(f.vm.passageNumber,1);assert.equal(f.vm.isStartTest,true);assert.equal(f.answer.clientAnswer,'Retained original answer');assert.equal(f.answer.selected,true);
    assert.equal(f.question.needReview,true);assert.equal(f.c.studyElapsedSeconds,627);assert.deepEqual(plain(f.vm.annotationNotes),old.annotationNotes);
    if(type===2)assert.deepEqual(plain(f.c.serializeMainListeningAudioPositions()),old.listeningAudioPositions.mainAudio);
    assert.deepEqual(f.log.annotations,old.annotations);assert.equal(f.log.resultWrites.length,0);assert.deepEqual(f.log.views,[]);assert.deepEqual(f.log.grades,[]);assert.deepEqual(f.log.deletes,[]);
    const receipt=f.snapshot(f.base+':attempt:'+f.key);assert.deepEqual(plain(receipt),old);
    const learning=f.snapshot(f.base);assert.equal(learning.clientAttemptKey,f.c.readingAttemptKey);assert.equal(learning.submissionState,null);assert.equal(learning.completed,false);assert.equal(learning.resultId,null);
    assert.deepEqual(plain(learning.studiedParts),[1]);assert.equal(learning.elapsedSeconds,627);assert.deepEqual(plain(learning.results),old.results);
    for(const field of ['questionStates','annotations','annotationNotes','listeningAudioPositions','completeListStates'])assert.deepEqual(plain(learning[field]),old[field],field);
  }
});

test('autosave and reload continue the detached Study identity instead of importing the old immutable receipt again', async()=>{
  const f=fixture();f.open();const learningKey=f.c.readingAttemptKey;const generated=f.log.keys;
  f.answer.clientAnswer='Edited after reopening';f.vm.testResult.questionAnswerTestResult[0].clientAnswer='Edited after reopening';
  f.c.studyElapsedSeconds=750;f.c.saveReadingDraft();await tick();
  const learning=plain(f.snapshot(f.base));assert.equal(learning.clientAttemptKey,learningKey);assert.equal(learning.submissionState,null);
  assert.equal(learning.results[0].clientAnswer,'Edited after reopening');assert.equal(learning.elapsedSeconds,750);
  f.c.readingAttemptKey=null;f.c.readingSubmissionState=null;f.vm.isLearningReview=true;f.open();
  assert.equal(f.c.readingAttemptKey,learningKey);assert.equal(f.log.keys,generated);assert.equal(f.vm.isLearningReview,false);assert.equal(f.c.readingSubmissionState,null);
  assert.equal(f.snapshot(f.base+':attempt:'+f.key).submissionState.result.id,91);assert.equal(f.log.resultWrites.length,0);assert.deepEqual(f.log.deletes,[]);
});

test('legacy completed Study drafts without modern receipt metadata reopen with their learning data retained', ()=>{
  const f=fixture({legacy:true});f.open();assert.equal(f.vm.isLearningReview,false);assert.equal(f.c.readingSubmissionState,null);
  assert.match(f.c.readingAttemptKey,/^[a-f0-9]{32}$/);assert.equal(f.answer.clientAnswer,'Retained original answer');assert.equal(f.c.studyElapsedSeconds,627);
  assert.equal(f.snapshot(f.base).completed,false);assert.equal(f.snapshot(f.base).resultId,null);assert.equal(f.log.resultWrites.length,0);
});

test('selecting old saved Study A does not overwrite a newer active base B or mutate A historical receipt', async()=>{
  const f=fixture(),old=plain(f.draft),keyB='b'.repeat(32);
  const newer={...plain(f.draft),clientAttemptKey:keyB,submissionState:null,completed:false,resultId:null,savedAt:'2026-10-24T10:00:00Z',
    results:[{questionId:201,answerId:101,answerOrdinal:1,ordinalNumber:1,clientAnswer:'Newer active work B'}]};
  f.seed(f.base,newer);f.seed(f.base+':attempt:'+keyB,newer);f.c.requestedReadingDraftKey=f.base+':attempt:'+f.key;
  f.open();await tick();assert.equal(JSON.parse(f.local.values.get(f.base)).clientAttemptKey,keyB);
  assert.equal(JSON.parse(f.local.values.get(f.base)).results[0].clientAnswer,'Newer active work B');
  assert.deepEqual(plain(f.snapshot(f.base+':attempt:'+f.key)),old);assert.notEqual(f.c.readingAttemptKey,f.key);assert.notEqual(f.c.readingAttemptKey,keyB);
  assert.equal(f.snapshot(f.base+':attempt:'+f.c.readingAttemptKey).submissionState,null);assert.deepEqual(f.log.deletes,[]);
});

test('blocked browser storage still retains Study learning in memory and keeps the old cloud-attempt receipt separate', async()=>{
  const f=fixture({blockedStorage:true});f.open();await tick();
  assert.equal(f.c.readingSubmissionState,null);assert.equal(f.vm.isLearningReview,false);assert.equal(f.answer.clientAnswer,'Retained original answer');
  assert.equal(f.snapshot(f.base).clientAttemptKey,f.c.readingAttemptKey);assert.equal(f.snapshot(f.base+':attempt:'+f.key).submissionState.result.id,91);
  assert.ok(f.log.cloudWrites.some(dto=>dto.draftKey===f.base+':attempt:'+f.c.readingAttemptKey));assert.deepEqual(f.log.deletes,[]);assert.equal(f.log.resultWrites.length,0);
});

test('Serious and assignment saved identities remain receipts and cannot detach through the Study helper', ()=>{
  for(const options of [{mode:'SERIOUS'},{mode:'SERIOUS',assignment:true,failed:true},{assignment:true,failed:true},{preview:true}]){
    const f=fixture(options);f.c.restoreReadingSubmissionIdentity(f.draft);const previous=f.c.readingSubmissionState;
    assert.equal(f.c.reopenSubmittedStudyDraft(f.draft),false);assert.equal(f.c.readingSubmissionState,previous);
    assert.equal(f.c.readingSubmissionState.status,'SAVED');assert.equal(f.c.readingAttemptKey,f.key);assert.equal(f.log.keys,0);assert.equal(f.log.cloudWrites.length,0);
  }
});

test('legacy Study PENDING stays frozen and its separate retry sends the exact original snapshot', async()=>{
  const f=fixture({pending:true});f.open();const original=plain(f.draft.submissionState.payload);
  assert.equal(f.c.readingSubmissionState.status,'PENDING');assert.equal(f.c.readingAttemptKey,f.key);assert.equal(f.log.keys,0);assert.equal(f.log.resultWrites.length,0);
  assert.equal(f.vm.hasPendingReadingSubmission(),true);f.vm.retryPendingStudySubmission();await tick();
  assert.equal(f.log.resultWrites.length,1);assert.deepEqual(plain(f.log.resultWrites[0].payload),original);
  assert.equal(f.c.readingAttemptKey,f.key);assert.equal(f.c.readingSubmissionState.status,'PENDING');
});

test('acknowledging an old Study pending result returns to live learning without navigating to result or starting GPT', async()=>{
  const f=fixture({pending:true,type:7});f.open();const live=f.vm.testResult;
  f.vm.retryPendingStudySubmission();await tick();const request=f.log.resultWrites[0];request.resolve({...plain(request.payload),id:91,resultStatus:'SUCCESS'});await tick();
  assert.equal(f.vm.testResult,live);assert.equal(f.vm.passageNumber,1);assert.equal(f.vm.isLearningReview,false);assert.equal(f.c.readingDraftSubmitted,false);
  assert.equal(f.c.readingSubmissionState,null);assert.notEqual(f.c.readingAttemptKey,f.key);assert.deepEqual(f.log.views,[]);assert.deepEqual(f.log.grades,[]);assert.deepEqual(f.log.deletes,[]);
  assert.equal(f.snapshot(f.base+':attempt:'+f.key).submissionState.status,'SAVED');assert.equal(f.snapshot(f.base+':attempt:'+f.key).submissionState.result.id,91);
});

for(const outcome of ['HTTP failure','mismatched acknowledgment','successful acknowledgment']){
  test('retrying selected pending A before annotations finish preserves newer base C: '+outcome,async()=>{
    const f=fixture({pending:true,type:7}),pendingA=plain(f.draft),keyC='c'.repeat(32);
    const newerC={...plain(f.draft),clientAttemptKey:keyC,submissionState:null,completed:false,resultId:null,
      savedAt:new Date(Date.now()-60000).toISOString(),elapsedSeconds:888,
      annotationNotes:[{id:'c-note',text:'Only newer C owns this note'}],
      annotations:[{containerId:'passage-text-1',start:10,end:20,color:'green'}],
      results:[{questionId:201,answerId:101,answerOrdinal:1,ordinalNumber:1,clientAnswer:'Only newer C owns this answer'}],
      questionStates:[{questionId:201,ordinalNumber:1,answers:[{answerId:101,selected:true,clientAnswer:'Only newer C owns this answer'}]}]};
    f.seed(f.base,newerC);f.seed(f.base+':attempt:'+keyC,newerC);const rawC=f.local.values.get(f.base);
    f.c.requestedReadingDraftKey=f.base+':attempt:'+f.key;
    // This is the actual restore path: reopenSubmittedStudyDraft(A) runs at its
    // end while the 350ms annotation callback is still pending. Do not flush it.
    f.c.restoreReadingDraft();assert.equal(f.c.readingAnnotationsRestoring,true);
    assert.equal(f.c.readingSubmissionState.status,'PENDING');assert.equal(f.c.readingAttemptKey,f.key);
    assert.equal(f.c.readActiveReadingDraft(f.base).clientAttemptKey,f.key);
    assert.equal(f.local.values.get(f.base),rawC);const live=f.vm.testResult;
    f.vm.retryPendingStudySubmission();await tick();assert.equal(f.log.resultWrites.length,1);
    const request=f.log.resultWrites[0];assert.deepEqual(plain(request.payload),pendingA.submissionState.payload);
    const persistedA=f.snapshot(f.base+':attempt:'+f.key);
    assert.equal(f.c.readingDraftMemory[f.base].clientAttemptKey,f.key);
    assert.ok(new Date(f.c.readingDraftMemory[f.base].savedAt)>new Date(newerC.savedAt),
      'memory A is now newer than raw C, so successful detach must compare the actual persisted base owner');
    for(const field of ['results','questionStates','annotationNotes','annotations'])assert.deepEqual(plain(persistedA[field]),pendingA[field],field+' must come from A, never C');
    assert.equal(persistedA.elapsedSeconds,627);assert.equal(persistedA.submissionState.key,f.key);
    assert.equal(f.local.values.get(f.base),rawC);assert.deepEqual(plain(f.snapshot(f.base+':attempt:'+keyC)),newerC);
    if(outcome==='HTTP failure')request.reject(Error('offline'));
    else request.resolve({...plain(request.payload),id:91,resultStatus:'SUCCESS',
      ...(outcome==='mismatched acknowledgment'?{sourceQuestionId:99}:{})});
    await tick();assert.equal(f.local.values.get(f.base),rawC);assert.equal(f.vm.testResult,live);
    assert.deepEqual(f.log.views,[]);assert.deepEqual(f.log.grades,[]);assert.deepEqual(f.log.deletes,[]);
    if(outcome==='successful acknowledgment'){
      assert.equal(f.c.readingSubmissionState,null);assert.notEqual(f.c.readingAttemptKey,f.key);assert.notEqual(f.c.readingAttemptKey,keyC);
      assert.equal(f.c.readingDraftSubmitted,false);assert.equal(f.vm.isLearningReview,false);
      assert.equal(f.snapshot(f.base+':attempt:'+f.key).submissionState.status,'SAVED');
      const learning=f.snapshot(f.base+':attempt:'+f.c.readingAttemptKey);
      assert.equal(learning.submissionState,null);assert.equal(learning.elapsedSeconds,627);
      for(const field of ['results','questionStates','annotationNotes','annotations'])assert.deepEqual(plain(learning[field]),pendingA[field],field+' must remain A in detached learning');
    }else{
      assert.equal(f.c.readingSubmissionState.status,'PENDING');assert.equal(f.c.readingAttemptKey,f.key);assert.equal(f.log.keys,0);
      assert.deepEqual(plain(f.c.readingSubmissionState.payload),pendingA.submissionState.payload);
    }
    for(const dto of f.log.cloudWrites){
      const cloudDraft=JSON.parse(dto.payload);assert.notEqual(cloudDraft.clientAttemptKey,keyC);
      assert.deepEqual(cloudDraft.annotationNotes,pendingA.annotationNotes);
      assert.deepEqual(cloudDraft.results,pendingA.results);
    }
  });
}

test('all Finish controls hide in Study while Check and the legacy pending retry remain usable', ()=>{
  const finish=[...view.matchAll(/<button\b([^>]*(?:idp-top-finish|idp-finish-btn)[^>]*)>[\s\S]*?<\/button>/g)];
  assert.equal(finish.length,3);
  for(const match of finish){const show=match[1].match(/ng-show="([^"]+)"/);assert.ok(show,'Finish has an explicit mode condition');
    for(const writing of [false,true]){const vm={isWritingRoute:writing,isStudyMode:()=>true};assert.equal(!!nodeVm.runInNewContext(show[1],{vm}),false);}}
  assert.match(view,/ng-click="vm\.openStudyAnswerCheck\(\)"/);
  const retry=view.match(/<button\b([^>]*ng-click="vm\.retryPendingStudySubmission\(\)"[^>]*)>[\s\S]*?<\/button>/);
  assert.ok(retry);const retryCondition=retry[1].match(/ng-if="([^"]+)"/)[1];
  for(const options of [{pending:true},{pending:true,mode:'SERIOUS'},{pending:true,preview:true},{}]){
    const f=fixture(options);if(options.pending)f.c.restoreReadingSubmissionIdentity(f.draft);
    assert.equal(!!nodeVm.runInContext(retryCondition,f.c),!!options.pending&&options.mode!=='SERIOUS'&&!options.preview);
  }
  const disabled=retry[1].match(/ng-disabled="([^"]+)"/)[1];
  const pending=fixture({pending:true});pending.vm.isSubmittingTest=true;assert.equal(!!nodeVm.runInContext(disabled,pending.c),true);
  assert.doesNotMatch(view,/Bấm Finish để kiểm tra lại/);
});
