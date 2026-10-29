const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../enrolment_class/controllers/EnrolmentClassController.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const settings=section('        /* Comprehensive assignment sections and timing:', '        /* End comprehensive assignment settings. */');
const payload=section('\t\tfunction scheduleTaskPayload(', '\t\tvm.commitScheduleTask =');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(task={activityType:'COMPREHENSIVE',ieltsTestId:42,ieltsParts:[1],title:'Homework'}){
 const pending=[],vm={taskEditor:structuredClone(task),scheduleDay:{comprehensiveAssignmentsEnabled:true},taskHasComprehensiveVideo:()=>false,taskTopicIds:()=>[]};
 const context=nodeVm.createContext({vm,Number,String,Math,JSON,isFinite,Object,Error,
  angular:{isArray:Array.isArray,copy:structuredClone,forEach(items,fn){(items||[]).forEach(fn);}},
  service:{previewComprehensiveSections(data){const result=deferred();pending.push({data:plain(data),...result});return result.promise;}}});
 nodeVm.runInContext(settings,context);nodeVm.runInContext(payload,context);vm.initializeComprehensiveTaskSettings(vm.taskEditor);
 return{vm,pending,context,payload:task=>context.scheduleTaskPayload(task)};
}
function plan(){return[{key:'preview-one',number:1,questionIds:[101,102],questionCount:2,firstOrdinal:1,lastOrdinal:2,durationMinutes:60},{key:'preview-two',number:2,questionIds:[103,104,105],questionCount:3,firstOrdinal:3,lastOrdinal:5,durationMinutes:60}];}
test('legacy unsplit tasks keep the existing time while new untimed selection survives serialization',()=>{
 const f=fixture();assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');assert.equal(f.vm.taskEditor._comprehensiveSplit,false);assert.equal(f.vm.taskEditor._comprehensiveTimedMinutes,60);assert.equal(f.payload(f.vm.taskEditor).comprehensiveTimeLimitMinutes,null);
 f.vm.taskEditor._comprehensiveTimeMode='UNTIMED';f.vm.comprehensiveTimeChanged();assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');assert.equal(f.payload(f.vm.taskEditor).comprehensiveTimeLimitMinutes,0);assert.equal(f.payload(f.vm.taskEditor).comprehensiveQuestionLimit,null);
 f.vm.taskEditor._comprehensiveTimeMode='TIMED';f.vm.taskEditor._comprehensiveTimedMinutes=null;f.vm.comprehensiveTimeChanged();assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/Thời gian/);
});
test('splits cannot be saved without a current server plan and retain individual minutes plus question IDs',async()=>{
 const f=fixture();f.vm.taskEditor._comprehensiveSplit=true;f.vm.comprehensiveSplitChanged();assert.equal(f.vm.taskEditor.comprehensiveQuestionLimit,50);assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/Xem cách chia/);
 const preview=f.vm.previewTaskComprehensiveSections();assert.equal(f.vm.taskComprehensivePlanLoading,true);f.pending[0].resolve(plan());await preview;assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');
 const second=f.vm.taskEditor.comprehensiveSections[1];second._comprehensiveTimeMode='UNTIMED';f.vm.comprehensiveSectionTimeChanged(second);const first=f.vm.taskEditor.comprehensiveSections[0];first._comprehensiveTimedMinutes=25;f.vm.comprehensiveSectionTimeChanged(first);
 const saved=f.payload(f.vm.taskEditor);assert.deepEqual(saved.comprehensiveSections.map(part=>part.durationMinutes),[25,0]);assert.deepEqual(plain(saved.comprehensiveSections[0].questionIds),[101,102]);assert.equal(saved.comprehensiveSections[0]._comprehensiveTimeMode,undefined);
 f.vm.taskEditor.comprehensiveQuestionLimit=40;f.vm.comprehensivePlanChanged();assert.equal(f.vm.taskEditor.comprehensiveSections.length,0);assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/Xem cách chia/);
});
test('stale or malformed previews never mark a different selection as ready',async()=>{
 const f=fixture();f.vm.taskEditor._comprehensiveSplit=true;f.vm.comprehensiveSplitChanged();const old=f.vm.previewTaskComprehensiveSections();f.vm.taskEditor.ieltsTestId=43;f.vm.comprehensiveExerciseChanged();f.pending[0].resolve(plan());await old;assert.equal(f.vm.taskEditor.comprehensiveSections.length,0);assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/Xem cách chia/);
 const next=f.vm.previewTaskComprehensiveSections();const invalid=plan();invalid[1].questionIds[0]=101;f.pending[1].resolve(invalid);await next;assert.match(f.vm.taskComprehensivePlanError,/hợp lệ/);assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/Xem cách chia/);
});
test('global timing changed during preview and per-section untimed settings remain explicit',async()=>{
 const f=fixture();f.vm.taskEditor._comprehensiveSplit=true;f.vm.comprehensiveSplitChanged();const preview=f.vm.previewTaskComprehensiveSections();f.vm.taskEditor._comprehensiveTimeMode='UNTIMED';f.vm.comprehensiveTimeChanged();f.pending[0].resolve(plan());await preview;assert.deepEqual(f.vm.taskEditor.comprehensiveSections.map(part=>part.durationMinutes),[0,0]);assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');
});
test('opening an existing split task preserves stable identities and configured durations without requesting a new plan',()=>{
 const parts=plan();parts[0].key='saved-key';parts[0].durationMinutes=15;parts[1].durationMinutes=0;
 const f=fixture({id:4,activityType:'COMPREHENSIVE',ieltsTestId:42,comprehensiveQuestionLimit:2,comprehensiveTimeLimitMinutes:15,comprehensiveSections:parts});assert.equal(f.pending.length,0);assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');const saved=f.payload(f.vm.taskEditor);assert.equal(saved.comprehensiveSections[0].key,'saved-key');assert.deepEqual(saved.comprehensiveSections.map(part=>part.durationMinutes),[15,0]);assert.deepEqual(plain(saved.comprehensiveSections[1].questionIds),[103,104,105]);
});
test('missing backend capability blocks new timing and splitting before any task is saved',()=>{
 const f=fixture();f.vm.scheduleDay.comprehensiveAssignmentsEnabled=false;assert.equal(f.vm.validateComprehensiveTask(f.vm.taskEditor),'');f.vm.taskEditor._comprehensiveTimeMode='UNTIMED';f.vm.comprehensiveTimeChanged();assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/cập nhật backend/);
 f.vm.taskEditor.comprehensiveTimeLimitMinutes=60;f.vm.taskEditor._comprehensiveTimeMode='TIMED';f.vm.taskEditor._comprehensiveSplit=true;f.vm.comprehensiveSplitChanged();assert.match(f.vm.validateComprehensiveTask(f.vm.taskEditor),/cập nhật backend/);
});
function committingFixture(task){
 const f=fixture({activityType:'COMPREHENSIVE',ieltsTestId:42,ieltsParts:[1],title:'Homework',section:'HOMEWORK',requiredAttempts:1,...task});
 Object.assign(f.vm,{scheduleDay:{comprehensiveAssignmentsEnabled:true,scheduleDate:'2026-10-29',tasks:[]},scheduleTopics:[],scheduleListeningItems:[],assignableIeltsTests:[{id:42,title:'Exercise',testFormat:'COMPREHENSIVE'}],taskEditorIndex:-1,isIeltsTask:()=>true,ieltsPartsForTask:()=>[1],ieltsTestsForTask(){return this.assignableIeltsTests;},cancelScheduleTask(){}});
 f.context.toastr={warning(message){f.vm.warning=message;}};f.context.moment=()=>{throw Error('Unexpected date conversion');};
 nodeVm.runInContext(section('\t\tvm.commitScheduleTask =','\t\tvm.removeScheduleTask ='),f.context);f.vm.saveScheduleDay=options=>f.savedOptions=options;return f;
}
test('the save acknowledgement must confirm the exact unsplit untimed configuration',()=>{
 const f=committingFixture({comprehensiveTimeLimitMinutes:0});f.vm.commitScheduleTask();assert.ok(f.savedOptions);const saved={...f.vm.scheduleDay.tasks[0],id:10};assert.equal(f.savedOptions.validateSaved({tasks:[saved]}),'');delete saved.comprehensiveTimeLimitMinutes;assert.match(f.savedOptions.validateSaved({tasks:[saved]}),/xác nhận/);
});
test('the save acknowledgement accepts generated server keys but rejects a wrong section or duration',()=>{
 const parts=plan();parts[0].durationMinutes=20;parts[1].durationMinutes=0;const f=committingFixture({comprehensiveQuestionLimit:2,comprehensiveTimeLimitMinutes:20,comprehensiveSections:parts});f.vm.commitScheduleTask();assert.ok(f.savedOptions);const saved=structuredClone(f.vm.scheduleDay.tasks[0]);saved.id=10;saved.comprehensiveSections[0].key='server-key';assert.equal(f.savedOptions.validateSaved({tasks:[saved]}),'');saved.comprehensiveSections[1].durationMinutes=30;assert.match(f.savedOptions.validateSaved({tasks:[saved]}),/xác nhận/);saved.comprehensiveSections[1].durationMinutes=0;saved.comprehensiveSections[1].questionIds=[106,107,108];assert.match(f.savedOptions.validateSaved({tasks:[saved]}),/xác nhận/);
});
