const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSReadingActualTestController.js'),'utf8');
const from=source.indexOf('        function readingSubmissionType()'),to=source.indexOf('        function persistReadingSubmissionState()',from);
assert.ok(from>=0&&to>from);
function fixture(type) {
    const vm={currentUser:{id:7},ieltsReadingActualTest:{id:42,pronounce:type===2?'audio.mp3':null},
        isWritingRoute:type===7,isComprehensiveRoute:type===6,isFlexibleRoute:type===6||type===7,
        assignmentTaskId:238,isPartAssignment:true,assignedParts:[1],testSessionMode:'SERIOUS'};
    const c=nodeVm.createContext({vm,$stateParams:{ieltsReadingTestId:42},angular:{isArray:Array.isArray,copy:structuredClone},
        readingAttemptKey:null,readingSubmissionState:null,restoredExpiredReadingDraft:false,
        $window:{crypto:{getRandomValues(bytes){for(let index=0;index<bytes.length;index++)bytes[index]=index+1;}}}});
    nodeVm.runInContext(source.slice(from,to),c);
    const payload={clientAttemptKey:'b'.repeat(32),user:{id:7},sourceQuestionId:42,assignmentTaskId:238,
        testType:type,completedParts:[1],questionAnswerTestResult:[{ordinalNumber:1,clientAnswer:'Retained answer'}]};
    return {vm,c,payload};
}
test('Reading, Listening, Comprehensive and Writing all recover the same keyed pending identity and saved receipt',()=>{
    for(const type of [2,4,6,7]) {
        const {c,payload}=fixture(type);assert.equal(c.readingSubmissionType(),type);
        c.restoreReadingSubmissionIdentity({remainingSeconds:0,submissionState:{key:payload.clientAttemptKey,status:'PENDING',payload}});
        assert.equal(c.readingAttemptKey,payload.clientAttemptKey);assert.equal(c.readingSubmissionState.status,'PENDING');
        const result={...payload,id:91,resultStatus:'FAILED'};
        assert.equal(c.readingSubmissionAcknowledged(result,payload),true);
        c.restoreReadingSubmissionIdentity({remainingSeconds:0,submissionState:{key:payload.clientAttemptKey,status:'SAVED',payload,result}});
        assert.equal(c.readingSubmissionState.result.id,91);assert.equal(c.readingAttemptKey,payload.clientAttemptKey);
    }
});
test('Listening test metadata identifies old generic Reading URLs consistently with the outgoing type',()=>{
    const {vm,c,payload}=fixture(2);vm.isListeningRoute=false;
    assert.equal(c.readingSubmissionType(),2);assert.equal(c.readingSubmissionContextMatches(payload),true);
});
test('a changed user, task, source, type or assigned part cannot reuse another pending attempt snapshot',()=>{
    for(const change of [p=>{p.user.id=8;},p=>{p.assignmentTaskId=999;},p=>{p.sourceQuestionId=99;},
        p=>{p.testType=4;},p=>{p.completedParts=[2];}]) {
        const {c,payload}=fixture(7);change(payload);
        c.restoreReadingSubmissionIdentity({remainingSeconds:0,clientAttemptKey:payload.clientAttemptKey,
            submissionState:{key:payload.clientAttemptKey,status:'PENDING',payload}});
        assert.equal(c.readingSubmissionState,null);assert.equal(c.readingAttemptKey,null);
        assert.equal(c.restoredExpiredReadingDraft,true);
    }
});
test('modern ACKs must include their full context, legacy receipts stay compatible, and invalid IDs never clear a draft',()=>{
    const {c,payload}=fixture(7);
    assert.equal(c.readingSubmissionAcknowledged({id:91},payload),false,'an ID alone cannot confirm which essay was saved');
    const legacy={...payload,id:91};delete legacy.clientAttemptKey;
    assert.equal(c.readingSubmissionAcknowledged(legacy,payload),true,'older contracts may omit the new key but must echo context');
    assert.equal(c.readingSubmissionAcknowledged({id:91,clientAttemptKey:payload.clientAttemptKey},payload),false);
    for(const id of [null,0,-1,'invalid'])assert.equal(c.readingSubmissionAcknowledged({id},payload),false);
    assert.equal(c.readingSubmissionAcknowledged({...payload,id:91,assignmentTaskId:null},payload),false);
    assert.equal(c.readingSubmissionAcknowledged({...payload,id:91,completedParts:[2]},payload),false);
});


test('an old same-attempt autosave cannot replace frozen pending payloads or downgrade a saved receipt',async()=>{
    const items=new Map(),calls=[];
    const c=nodeVm.createContext({angular:{copy:structuredClone,noop(){}},Date,JSON,readingAttemptKey:'a'.repeat(32),
        readingDraftMemory:{},readingDraftSaveQueues:{},readingDraftPendingSaves:{},vm:{},
        $window:{localStorage:{getItem:key=>items.get(key),setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)}},
        service:{saveLearningDraft(dto){calls.push(dto);return Promise.resolve({id:1,...dto});},deleteLearningDraft(){return Promise.resolve();}}});
    const start=source.indexOf('        function readingCloudDraftKey('),end=source.indexOf('        function loadReadingLearningDrafts()',start);
    nodeVm.runInContext(source.slice(start,end),c);
    const base='ieltsReadingInProgress:7:writing:test:42:serious:task:238:parts:1',key='a'.repeat(32);
    const pending={clientAttemptKey:key,savedAt:'2026-10-19T12:00:00Z',submissionState:{key,status:'PENDING',payload:{clientAnswer:'Frozen essay'}}};
    c.storeReadingDraft(base,pending);
    const stale={clientAttemptKey:key,savedAt:'2026-10-19T12:00:01Z',results:[{clientAnswer:'Stale draft'}],submissionState:null};
    c.storeReadingDraft(base,stale);await c.saveReadingLearningDraft(base,stale);
    assert.equal(JSON.parse(items.get(base+':attempt:'+key)).submissionState.payload.clientAnswer,'Frozen essay');
    assert.equal(JSON.parse(calls[0].payload).submissionState.status,'PENDING');
    const saved={...pending,savedAt:'2026-10-19T12:00:02Z',submissionState:{...pending.submissionState,status:'SAVED',result:{id:91}}};
    c.storeReadingDraft(base,saved);c.storeReadingDraft(base,pending);await c.saveReadingLearningDraft(base,pending);
    assert.equal(JSON.parse(items.get(base+':attempt:'+key)).submissionState.status,'SAVED');
    assert.equal(JSON.parse(calls.at(-1).payload).submissionState.result.id,91);
});
