const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8').replace(/\r\n/g, '\n');
const view = read('question/controllers/ViewController.js');
const teacher = read('enrolment_class/controllers/EnrolmentClassController.js');
const plain = value => JSON.parse(JSON.stringify(value));
const angular = {copy: structuredClone, isArray: Array.isArray, isUndefined: value => value === undefined,
  isFunction: value => typeof value === 'function', noop() {},
  forEach: (items, callback) => Object.entries(items || {}).forEach(([key, value]) => callback(value, key))};
function section(text, start, end) {
  const from = text.indexOf(start), to = text.indexOf(end, from);
  assert.ok(from >= 0 && to > from, start); return text.slice(from, to);
}
const tick = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function storage(initial = []) {
  const entries = new Map(initial);
  return {entries, get length() {return entries.size;}, key: index => [...entries.keys()][index],
    getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key)};
}

test('homework percentage counts every DONE once and preserves exact partial and NEEDS_REVIEW rules', () => {
  const vm = {scheduleStudents: [{id:7}], homeworkProgressLevels: []};
  const context = {vm, angular, homeworkCellDrafts: {}, scheduleAttendanceCell: () => ({}), saveDefaultScheduleAttendanceRows() {}};
  nodeVm.runInNewContext(section(teacher, '        vm.homeworkProgressPercent =', '\t\tvm.tasksForSection =')
    + section(teacher, '        vm.buildHomeworkReviewRows =', '        vm.filteredHomeworkRows ='), context);
  for (const [statuses, expected, done, status] of [
    [['DONE','DONE','TODO'],67,2,'INCOMPLETE'], [['DONE','TODO','TODO'],33,1,'INCOMPLETE'],
    [['DONE','DONE','DONE'],100,3,'DONE'], [['PROGRESS_33','PROGRESS_67','TODO'],33,0,'INCOMPLETE'],
    [['DONE','PROGRESS_33','PROGRESS_67'],67,1,'INCOMPLETE'], [['DONE','NEEDS_REVIEW','TODO'],33,1,'NEEDS_REVIEW'],
    [['NEEDS_REVIEW'],0,0,'NEEDS_REVIEW'], [['UNRECORDED'],0,0,'INCOMPLETE'], [[],0,0,'NO_TASKS']]) {
    vm.previousHomeworkTasks = statuses.map((value,index) => ({id:index+1,studentProgress:[{studentUserId:7,status:value}]}));
    vm.buildHomeworkReviewRows(); const row = vm.homeworkReviewRows[0];
    assert.equal(row.progressPercent,expected, statuses.join(',')); assert.equal(row.done,done); assert.equal(row.status,status);
    assert.ok(row.progressPercent >= 0 && row.progressPercent <= 100);
  }
});

function teacherFixture(enabled = true) {
  const vm = {scheduleClass: {id:5,directListeningAssignmentsEnabled:enabled},scheduleDay:{scheduleDate:'2026-10-20',tasks:[]},
    scheduleTopics:[],scheduleListeningItems:[{id:21,question:'Direct lesson',direct:true}],assignableIeltsTests:[],
    taskEditor:{title:'Direct task',activityType:'DAILY_LISTENING',sourceQuestionId:21,topicId:null,requiredAttempts:3,
      topicIds:[],studentProgress:[]},taskEditorIndex:-1,
    isIeltsTask:()=>false,ieltsPartsForTask:()=>[1],taskHasComprehensiveVideo:()=>false,taskTopicIds:()=>[],cancelScheduleTask(){}};
  const saves=[];
  const context = {vm,angular,moment:()=>{throw Error('Unexpected date');},toastr:{warning(text){vm.warning=text;}},
    service:{},scheduleListeningItemsRequest:0};
  nodeVm.runInNewContext(section(teacher,'        vm.directListeningAssignmentsEnabled =','        vm.multiTopicVocabEnabled =')
    + section(teacher,'\t\tfunction scheduleTaskPayload(','\t\tvm.removeScheduleTask ='),context);
  vm.saveScheduleDay = options => saves.push({task:plain(vm.scheduleDay.tasks[0]),options});
  return {vm,context,saves};
}
test('direct lesson assignment keeps requested attempts and verifies the saved source acknowledgment', () => {
  const {vm,saves} = teacherFixture(); vm.commitScheduleTask();
  assert.equal(saves.length,1); assert.equal(saves[0].task.requiredAttempts,3); assert.equal(saves[0].task.topicId,null);
  assert.equal(saves[0].task.sourceQuestionId,21);
  assert.equal(saves[0].options.validateSaved({tasks:[{...saves[0].task,id:42}]}),'');
  assert.match(saves[0].options.validateSaved({tasks:[{...saves[0].task,sourceQuestionId:22}]}),/xác nhận/);
  assert.match(saves[0].options.validateSaved({tasks:[{...saves[0].task,requiredAttempts:1}]}),/xác nhận/);
});
test('old backend blocks direct topicless assignment without losing editor and direct attempt limits are enforced', () => {
  const old = teacherFixture(false); old.vm.commitScheduleTask(); assert.equal(old.saves.length,0);
  assert.equal(old.vm.taskEditor.sourceQuestionId,21); assert.match(old.vm.taskEditorError,/cập nhật backend/);
  for (const attempts of [0,101,1.5,'x']) { const current=teacherFixture();current.vm.taskEditor.requiredAttempts=attempts;
    current.vm.commitScheduleTask(); assert.equal(current.saves.length,0); assert.match(current.vm.warning,/1 đến 100/); }
});
test('existing direct assignment opens and can save with its source even when no topics exist', () => {
  const {vm,context,saves}=teacherFixture(); vm.taskEditor.sourceQuestionTitle='Direct lesson';
  nodeVm.runInNewContext(section(teacher,'\t\tvm.loadTaskListeningItems =','\t\tvm.taskActivityTypeChanged ='),context);
  vm.loadTaskListeningItems(true); assert.equal(vm.scheduleListeningItems[0].id,21); assert.equal(vm.scheduleListeningItems[0].direct,true);
  vm.commitScheduleTask(); assert.equal(saves.length,1);
});
test('picker selection accepts topicless published lessons and clears a previous topic safely', async () => {
  let resolve;
  const vm={taskEditor:{activityType:'DAILY_LISTENING',title:'',topicId:50,categoryId:4},scheduleTopics:[],scheduleListeningItems:[],assignableIeltsTests:[]};
  nodeVm.runInNewContext(section(teacher,'        vm.taskSelectedExerciseTitle =','\t\tvm.isIeltsTask ='),
    {vm,angular,scheduleListeningItemsRequest:0,assignmentPicker:{open:()=>new Promise(done=>{resolve=done;})}});
  vm.openTaskExercisePicker();resolve({test:{id:21,title:'Direct lesson',testFormat:'DAILY_LISTENING'},topic:null});await tick();
  assert.equal(vm.taskEditor.sourceQuestionId,21);assert.equal(vm.taskEditor.topicId,null);assert.equal(vm.taskEditor.categoryId,null);
  assert.equal(vm.taskEditor.categoryKey,null);assert.equal(vm.scheduleListeningItems[0].direct,true);assert.equal(vm.scheduleTopics.length,0);
});

test('assigned direct launch verifies exact server source before loading without a topic request', async () => {
  for (const valid of [true,false]) {
    let loaded=0,categories=0;
    const vm={isDirectAssignedDailyListening:true,isStandaloneDailyListening:true,standaloneDailyListeningId:21,
      assignmentLaunch:{taskId:42,sourceQuestionId:21},getPageFlashCard(){loaded++;},getPageTopicCategory(){categories++;}};
    nodeVm.runInNewContext(section(view,'        function initializeAssignedDailyListening()','        vm.changePageSize ='),
      {vm,$timeout:fn=>fn(),service:{getAssignedTask:id=>Promise.resolve({taskId:id,activityType:'DAILY_LISTENING',sourceQuestionId:valid?21:22,topicId:null})}});
    await tick();assert.equal(categories,0);assert.equal(loaded,valid?1:0);assert.equal(vm.assignmentLaunch.verified,valid?true:undefined);
    if(!valid) assert.match(vm.standaloneListeningError,/không khớp/);
  }
});
test('direct assigned lesson loads its exact published question without topics or owner filters', async () => {
  const calls=[];
  const vm={isDirectAssignedDailyListening:true,isStandaloneDailyListening:true,standaloneDailyListeningId:21,
    assignmentLaunch:{verified:true,taskId:42,sourceQuestionId:21},searchDto:{questionTopics:[]},selectedUser:{id:999},mode:{id:8},
    resetFlipCard(){},setUpTable(){this.bsTableControl={options:{}};},setUpAudio(){}};
  nodeVm.runInNewContext(section(view,'        vm.getPageFlashCard = function','        vm.createQuiz ='),
    {vm,angular,service:{getOne(id){calls.push(id);return Promise.resolve({id,question:'Direct lesson',motherTongue:'Transcript',questionType:{id:11},testFormat:'DAILY_LISTENING',status:7});},
      getPageForGames(){throw Error('Topic query');}},blockUI:{start(){},stop(){}},toastr:{error(){}},alert(){throw Error('Topic requested');},
      createQuestionsWithOptions:structuredClone,processFillingGapsByMode:text=>text,resumeDailyListeningFromDashboard(){},$scope:{chooseFillingGaps(){}}});
  vm.getPageFlashCard();await tick();assert.deepEqual(calls,[21]);assert.equal(vm.currentCard.id,21);assert.equal(vm.showGapTitleTable,false);
});

const key = (question, task) => 'daily-listening-progress:v1:7:'+question+(task?':task:'+task:'');
const attempt = 'a'.repeat(32);
function draft(task, updated=10, question=21) {
  return {version:1,modeId:8,ownerId:7,updatedAt:updated,clientAttemptKey:attempt,assignmentTaskId:task||null,
    assignmentSourceQuestionId:question,card:{id:question,motherTongue:'Transcript'},fillingGapQuestion:'[gap]',gapAnswers:{0:'word'}};
}
function draftContext(task, entries) {
  const localStorage=storage(entries),deleted=[];
  const vm={currentUser:{id:7},assignmentLaunch:{taskId:task||null,sourceQuestionId:21},isStandaloneDailyListening:!!task,standaloneDailyListeningId:task?21:null};
  const context={vm,angular,window:{localStorage},deleteDailyListeningLearningDraft:key=>deleted.push(key)};
  nodeVm.runInNewContext(section(view,'        function dailyListeningDraftPrefix()','        function saveDailyListeningLearningDraft(')
    + section(view,'        function isValidDailyListeningDraft(','        vm.refreshDailyListeningDraft ='),context);
  return {vm,context,localStorage,deleted};
}
test('task A, task B and free practice keep independent drafts of the exact same lesson', () => {
  const entries=[[key(21,42),JSON.stringify(draft(42))],[key(21,43),JSON.stringify(draft(43,20))],[key(21),JSON.stringify(draft(null,30))]];
  for(const task of [42,43,null]) {const current=draftContext(task,entries);const restored=current.context.findLatestDailyListeningDraft(21);
    assert.equal(restored.assignmentTaskId,task);assert.equal(current.localStorage.length,3);assert.deepEqual(current.deleted,[]);
    assert.equal(current.context.dailyListeningDraftKey(21),key(21,task));}
});
test('legacy assigned draft restores only its matching task and cannot change another task context', () => {
  const entries=[[key(21),JSON.stringify(draft(42))]];
  assert.equal(draftContext(42,entries).context.findLatestDailyListeningDraft(21).assignmentTaskId,42);
  const other=draftContext(43,entries);assert.equal(other.context.findLatestDailyListeningDraft(21),null);
  assert.equal(other.localStorage.length,1);assert.deepEqual(other.deleted,[]);
  assert.equal(draftContext(null,entries).context.findLatestDailyListeningDraft(21),null);
});
test('confirmed assigned result does not regenerate a draft on heartbeat or page unload', () => {
  const vm={assignmentLaunch:{taskId:42},isSaveTestResult:true,testResult:{id:9001}};
  const context={vm,isDailyListeningMode(){throw Error('Confirmed assignment must not snapshot again');}};
  nodeVm.runInNewContext(section(view,'        function persistDailyListeningDraft(','        vm.saveDailyListeningDraft ='),context);
  assert.equal(context.persistDailyListeningDraft(false,false),false);
  assert.equal(context.persistDailyListeningDraft(false,true),false);
});
test('discard removes a matching legacy assignment draft but preserves practice and another task or attempt', () => {
  for(const replacement of [null,draft(null),draft(43),{...draft(42),clientAttemptKey:'b'.repeat(32)}]) {
    const current=draftContext(42,[[key(21,42),JSON.stringify(draft(42))],
      [key(21),JSON.stringify(replacement||draft(42))]]);
    nodeVm.runInNewContext(section(view,'        function removeDailyListeningDraft(','        vm.discardDailyListeningDraft ='),current.context);
    current.context.removeDailyListeningDraft(draft(42));
    assert.equal(current.localStorage.getItem(key(21,42)),null);
    assert.equal(!!current.localStorage.getItem(key(21)),!!replacement);
    assert.deepEqual(current.deleted,replacement?[key(21,42)]:[key(21,42),key(21)]);
  }
});
test('confirmed legacy assignment cleanup removes only the acknowledged attempt and leaves newer scoped draft intact', () => {
  const newer={...draft(42,30),clientAttemptKey:'b'.repeat(32)};
  const current=draftContext(42,[[key(21),JSON.stringify(draft(42))],[key(21,42),JSON.stringify(newer)]]);
  Object.assign(current.vm,{currentCard:{id:21},dailyListeningAttemptKey:attempt});
  nodeVm.runInNewContext(section(view,'        function removeDailyListeningDraft(','        vm.discardDailyListeningDraft ='),current.context);
  current.context.clearCurrentDailyListeningDraft();assert.equal(current.localStorage.getItem(key(21)),null);
  assert.equal(JSON.parse(current.localStorage.getItem(key(21,42))).clientAttemptKey,newer.clientAttemptKey);
  assert.deepEqual(current.deleted,[key(21)]);
});

function saveFixture() {
  const requests=[],messages=[],cleared=[];
  const vm={mode:{id:8},currentUser:{id:7},assignmentLaunch:{taskId:42,sourceQuestionId:21},currentCard:{id:21,question:'Direct lesson',testFormat:'DAILY_LISTENING'},
    percentage:95,testResult:{user:{id:7},testTakerPerformance:'typed words'},dailyListeningAttemptKey:attempt};
  const context={vm,angular,$scope:{},createDailyListeningAttemptKey:()=>attempt,
    persistDailyListeningDraft(){},clearCurrentDailyListeningDraft(){cleared.push(1);vm.dailyListeningPendingResult=null;vm.dailyListeningAttemptKey=null;},
    service:{saveTestResult(payload){return new Promise((resolve,reject)=>requests.push({payload:plain(payload),resolve,reject}));}},
    blockUI:{start(){},stop(){}},toastr:{error:text=>messages.push(text),info:text=>messages.push(text)}};
  nodeVm.runInNewContext(section(view,'        function isCurrentAssignedListeningAttempt(','        function isDailyListeningMode()')
    + section(view,'        vm.saveTestResult =','        vm.resetDailyVocabSaveState ='),context);
  return {vm,context,requests,messages,cleared};
}
function acknowledgment(payload, overrides={}) {return {...payload,id:9001,...overrides};}
test('wrong-context save acknowledgment retains assigned draft; retry freezes original source, key and answers', async () => {
  const current=saveFixture();current.vm.saveTestResult();const frozen=current.requests[0].payload;
  assert.equal(frozen.assignmentTaskId,42);assert.equal(frozen.sourceQuestionId,21);assert.equal(frozen.resultStatus,'SUCCESS');
  current.requests[0].resolve(acknowledgment(frozen,{assignmentTaskId:43}));await tick();
  assert.equal(current.cleared.length,0);assert.equal(current.vm.isSaveTestResult,false);assert.match(current.vm.dailyListeningDraftMessage,/đúng bài/);
  current.vm.percentage=10;current.vm.testResult.testTakerPerformance='edited after failed acknowledgment';current.vm.saveTestResult();
  assert.deepEqual(current.requests[1].payload,frozen);current.requests[1].resolve(acknowledgment(frozen));await tick();
  assert.equal(current.cleared.length,1);assert.equal(current.vm.isSaveTestResult,true);
});
test('assigned acknowledgment requires persisted owner, task, question, type and attempt key', async () => {
  for(const override of [{id:undefined},{user:{id:8}},{sourceQuestionId:22},{testType:1},{clientAttemptKey:'b'.repeat(32)}]) {
    const current=saveFixture();current.vm.saveTestResult();current.requests[0].resolve(acknowledgment(current.requests[0].payload,override));await tick();
    assert.equal(current.cleared.length,0,JSON.stringify(override));assert.ok(current.vm.dailyListeningPendingResult);assert.equal(current.vm.isSaveTestResult,false);
  }
});
test('HTTP retry and delayed acknowledgment cannot clear or mark a different current task attempt', async () => {
  const current=saveFixture();current.vm.saveTestResult();current.requests[0].reject(Error('offline'));await tick();
  assert.equal(current.cleared.length,0);assert.equal(current.vm.isSaveTestResult,false);current.vm.saveTestResult();
  assert.deepEqual(current.requests[1].payload,current.requests[0].payload);
  current.vm.assignmentLaunch.taskId=43;current.vm.dailyListeningAttemptKey='b'.repeat(32);
  current.requests[1].resolve(acknowledgment(current.requests[1].payload));await tick();assert.equal(current.cleared.length,0);assert.notEqual(current.vm.isSaveTestResult,true);
});
test('foreign frozen payload is retained without posting it under the current assignment', () => {
  const current=saveFixture();current.vm.dailyListeningPendingResult={assignmentTaskId:43,sourceQuestionId:21,clientAttemptKey:attempt,user:{id:7},testType:3};
  current.vm.saveTestResult();assert.equal(current.requests.length,0);assert.equal(current.cleared.length,0);
  assert.equal(current.vm.dailyListeningPendingResult.assignmentTaskId,43);assert.match(current.vm.dailyListeningDraftMessage,/không khớp/);
});
test('dashboard and pet deduplicate legacy/new listening backups by task while preserving other tasks', () => {
  const dashboard=read('dashboards/controllers/DashboardController.js');
  const dashboardContext={vm:{resumeDrafts:[]},userId:'7',dailyListeningPrefix:'daily-listening-progress:v1:7:',
    sameIeltsReminderRun:()=>false,sameVocabRun:()=>false};
  nodeVm.runInNewContext(section(dashboard,'            function pushResumeDraft(','            function sortResumeDrafts()')
    + section(dashboard,'            function addDailyListeningDraft(','            try {\n                addDailyVocabDraft('),dashboardContext);
  const pet=read('common/utils/learning-pet.directive.js'),petContext={vm:{drafts:[]},readCurrentUser:()=>({id:7}),
    angular:{...angular,fromJson:JSON.parse},$window:{localStorage:storage()},sameIeltsReminderRun:()=>false};
  nodeVm.runInNewContext(section(pet,'            function parseDraft(item)','            function appendLocalPendingDrafts()'),petContext);
  for(const [storageKey,payload] of [[key(21),draft(42,10)],[key(21,42),draft(42,20)],
    [key(21,43),draft(43,15)],[key(21),draft(null,40)]]) {
    dashboardContext.addDailyListeningDraft(storageKey,payload);
    petContext.appendPetDraft(petContext.parseDraft({draftType:'DAILY_LISTENING',draftKey:storageKey,payload:JSON.stringify(payload)}));
  }
  for(const cards of [dashboardContext.vm.resumeDrafts,petContext.vm.drafts]) {
    assert.equal(cards.length,3);assert.equal(cards.find(card=>card.assignmentTaskId===42).savedAt,20);
    assert.equal(cards.find(card=>card.assignmentTaskId===43).savedAt,15);
    assert.equal(cards.find(card=>!card.assignmentTaskId).savedAt,40);
  }
});
