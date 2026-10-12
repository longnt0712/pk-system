const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(app,'question/controllers/DailyListeningTestController.js'),'utf8');
const legacy=fs.readFileSync(path.join(app,'question/controllers/ViewController.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function section(text,start,end){const from=text.indexOf(start),to=text.indexOf(end,from);assert.ok(from>=0&&to>from,start);return text.slice(from,to);}
function setup(overrides={}){
 let definition;const angular={copy:structuredClone,noop(){},module(){return{controller(name,controller){definition=controller.at(-1);}};}};
 nodeVm.runInNewContext(source,{angular});
 const old={id:21,question:'Old listening',title:'Old listening',pronounce:'https://school.test/old.mp3',motherTongue:'<p>We listen every day.</p>',
  questionType:{id:11},testFormat:'DAILY_LISTENING',status:7,user:{id:26},questionTopics:[{id:10,topic:{id:2}}],questionAnswers:[{id:8,answer:{id:9,answer:'Keep'}}],correctAnswer:3,timeReviewd:142};
 const requests=[],saves=[],vm={},redirects=[];
 const service={getDailyListeningTests(dto,index,size){requests.push({dto:plain(dto),index,size});return Promise.resolve({content:[structuredClone(old)],totalElements:1});},
  getOne(){return Promise.resolve(structuredClone(old));},saveDailyListening(dto){saves.push(structuredClone(dto));return Promise.resolve({...dto,title:dto.question,id:dto.id||22});},...overrides.service};
 const document={createElement(){return{innerHTML:'',get textContent(){return this.innerHTML.replace(/<[^>]*>/g,'');}};}};
 const folders={applyFilter(dto,id){dto.testFolderId=id>0?id:null;dto.withoutTestFolder=id==null&&!dto.textSearch;dto.includeSubfolders=!!dto.textSearch;dto.pageIndex=1;},contains:(id,selected)=>id===selected,...overrides.folders};
 definition.call(vm,{get(){return JSON.stringify({id:7,roles:[{name:overrides.role||'ROLE_ADMIN'}]});}},
  {path(value){redirects.push(value);}},{document},{},service,{parseUrl(url){return /^https?:\/\//.test(url)?{}:null;}},{success(){}},overrides.modal,{when:Promise.resolve.bind(Promise)},folders);
 return {vm,old,requests,saves,redirects};
}
test('shared catalog has no source or teacher filter and edits imported content without changing its original owner',async()=>{
 const {vm,old,requests,saves}=setup();await tick();assert.equal(vm.items.length,1);assert.equal(requests[0].dto.userId,undefined);assert.equal(vm.sources,undefined);
 await vm.edit(old);assert.equal(vm.transcript,'We listen every day.');vm.draft.question='New title';await vm.save();
 assert.equal(saves[0].id,21);assert.equal(saves[0].motherTongue,old.motherTongue);assert.deepEqual(saves[0].questionTopics,old.questionTopics);
 assert.deepEqual(saves[0].questionAnswers,old.questionAnswers);assert.equal(saves[0].userId,26);assert.equal(vm.items[0].title,'New title');assert.equal(requests.length,1);
});
test('pasting text saves a shared test in the selected folder, with no manually configured gaps',async()=>{
 const {vm,saves}=setup();await tick();vm.catalogTestFolderId=5;vm.newTest();vm.transcript='We hear a new story every morning.';vm.draft.pronounce='https://school.test/new.mp3';await vm.save();
 assert.equal(saves[0].questionType.id,11);assert.equal(saves[0].testFormat,'DAILY_LISTENING');assert.equal(saves[0].status,7);assert.equal(saves[0].testFolderId,5);
 assert.equal(saves[0].motherTongue,vm.transcript);assert.deepEqual(saves[0].questionAnswers,[]);assert.equal(vm.practiceUrl(vm.draft),'daily_listening/22');
});
test('save failure and duplicate submission retain pasted text',async()=>{
 let resolveSave;const {vm}=setup({service:{saveDailyListening(){return new Promise(resolve=>{resolveSave=resolve;});}}});await tick();
 vm.transcript='We keep the transcript.';vm.draft.pronounce='https://school.test/new.mp3';const pending=vm.save();assert.equal(vm.saving,true);assert.equal(vm.save(),undefined);
 resolveSave({message:'Save failed'});await pending;assert.equal(vm.saving,false);assert.equal(vm.transcript,'We keep the transcript.');assert.equal(vm.savedMessage,'');assert.match(vm.error,/Save failed/);
});
test('selected legacy records migrate by id, keep partial successes and retry only failures',async()=>{
 const records=[{id:1,question:'First',pronounce:'https://school.test/1.mp3',motherTongue:'First transcript'},{id:2,question:'Second',pronounce:'https://school.test/2.mp3',motherTongue:'Second transcript'}];
 let transfer,close,fail=true;const writes=[];
 const modal={open(config){transfer={};const result=new Promise(resolve=>{close=resolve;});config.controller.at(-1).call(transfer,{$on(){}},{close});return{result};}};
 const {vm}=setup({modal,service:{getLegacyDailyListening(dto){assert.equal(dto.userId,undefined);return Promise.resolve({content:records,totalElements:2});},
  migrateDailyListening(id){writes.push(id);return fail&&id===2?Promise.reject({data:{message:'Try again'}}):Promise.resolve({id,questionType:{id:11},testFormat:'DAILY_LISTENING',status:7});}}});await tick();
 vm.importOldListening();await tick();transfer.selectAll();await transfer.save();assert.equal(transfer.moved,1);assert.equal(transfer.selected[2],true);assert.equal(vm.importDialogOpen,true);
 fail=false;await transfer.save();await tick();assert.deepEqual(writes,[1,2,2]);assert.equal(vm.importDialogOpen,false);
});
test('moving one row preserves unsaved editor text and fills only the vacant pagination slot',async()=>{
 let reads=0;const requests=[];const {vm}=setup({service:{getDailyListeningTests(dto,index,size){requests.push({dto:plain(dto),index,size});reads++;return Promise.resolve(reads===1?{content:[{id:21},{id:22}],totalElements:3}:{content:[{id:23}],totalElements:2});}}});await tick();
 vm.draft={id:21,question:'Unsaved title'};vm.transcript='Unsaved transcript';vm.items[1].custom='Keep row';const rows=vm.items;
 vm.catalogTestMoved({id:21,testFolder:{id:5,name:'Week 1'}});await tick();assert.equal(vm.items,rows);assert.deepEqual(vm.items.map(item=>item.id),[22,23]);
 assert.equal(vm.items[0].custom,'Keep row');assert.equal(vm.draft.testFolderId,5);assert.equal(vm.draft.question,'Unsaved title');assert.equal(vm.transcript,'Unsaved transcript');
 assert.equal(requests[1].size,1);assert.equal(requests[1].index,2);assert.equal(vm.loading,false);
});
test('move dialog uses the Daily Listening folder tree, retains failure and retries without reloading the catalog',async()=>{
 let move,fail=true;const calls=[];const modal={open(config){move={};let resolve,reject;const result=new Promise((ok,no)=>{resolve=ok;reject=no;});config.controller.at(-1).call(move,{$on(){}},{close:resolve,dismiss:reject});return{result};}};
 const {vm,requests}=setup({modal,folders:{load(all,refresh,mode){assert.equal(mode,'DAILY_LISTENING');return Promise.resolve([{id:5,name:'Daily',canManage:true},{id:6,name:'Week 1',parentId:5,canManage:true}]);},options:items=>items,
  moveTest(id,folder){calls.push([id,folder]);return fail?Promise.reject({data:{message:'Move failed'}}):Promise.resolve({id,testFolder:{id:folder}});}}});await tick();
 vm.openCatalogMoveDialog(vm.items[0]);await tick();move.select(6);await move.save();assert.match(move.error,/Move failed/);assert.equal(vm.items.length,1);assert.equal(vm.catalogMoveDialogOpen,true);
 fail=false;await move.save();await tick();assert.deepEqual(calls,[[21,6],[21,6]]);assert.equal(vm.items.length,0);assert.equal(requests.length,1);assert.equal(vm.catalogMoveDialogOpen,false);
});
test('student roles cannot open the shared authoring page',()=>{const {redirects,requests}=setup({role:'ROLE_VIEWER'});assert.deepEqual(redirects,['/comprehensive_tests']);assert.equal(requests.length,0);});
test('Daily Listening service calls the shared APIs and retains backend validation messages',async()=>{
 let Service;nodeVm.runInNewContext(fs.readFileSync(path.join(app,'question/business/QuestionService.js'),'utf8'),{angular:{module(){return{service(name,value){Service=value;}};}}});
 const calls=[],failure={status:400,data:{message:'Transcript is required'}};
 const api=new Service({post(url,dto){calls.push([url,plain(dto)]);return url.endsWith('/save')?Promise.reject(failure):Promise.resolve({data:{id:21}});}},
  {reject:Promise.reject.bind(Promise)},()=>{}, {api:{baseUrl:'https://school.test/',apiV1Url:'api/'}},{});
 await api.getDailyListeningTests({},2,12);await api.getLegacyDailyListening({status:5},1,20);await api.migrateDailyListening(21);
 await assert.rejects(api.saveDailyListening({question:'Title'}),error=>error===failure);
 assert.deepEqual(calls.map(item=>item[0]),['https://school.test/api/daily_listening/get_page/2/12','https://school.test/api/daily_listening/legacy/1/20','https://school.test/api/daily_listening/migrate/21','https://school.test/api/daily_listening/save']);
});
test('dashboard and learning pet resume shared listening directly while preserving assigned legacy launches',()=>{
 for(const [name,start,end] of [['dashboards/controllers/DashboardController.js','        vm.resumeDraft =','        vm.cancelDraft ='],
  ['common/utils/learning-pet.directive.js','            vm.resumeDraft =','            vm.selectSection =']]){
  const calls=[],vm={myUser:{id:7}},context={vm,readCurrentUser:()=>({id:7}),$window:{sessionStorage:{setItem(){}}},$state:{go(state,params){calls.push({state,params:plain(params)});}}};
  nodeVm.runInNewContext(section(fs.readFileSync(path.join(app,name),'utf8'),start,end),context);
  vm.resumeDraft({kind:'DAILY_LISTENING',dailyListeningId:21});assert.equal(calls[0].state,'application.daily_listening_actual_test');assert.equal(calls[0].params.dailyListeningId,21);
  vm.resumeDraft({kind:'DAILY_LISTENING',dailyListeningId:21,assignmentTaskId:10,assignmentSourceQuestionId:21});assert.equal(calls[1].state,'application.view');assert.equal(calls[1].params.assignmentTaskId,10);
 }
});
test('standalone playback loads the exact legacy record without a topic or the shared source filter',async()=>{
 for(const valid of [true,false]){
  const calls=[],vm={isStandaloneDailyListening:true,standaloneDailyListeningId:21,searchDto:{questionTopics:[]},selectedUser:{id:999},mode:{id:8},assignmentLaunch:{},
   resetFlipCard(){},setUpTable(){this.bsTableControl={options:{}};},setUpAudio(){calls.push('audio');}};
  const context={vm,angular:{copy:structuredClone,isArray:Array.isArray,isUndefined:value=>value===undefined,forEach(items,fn){items.forEach(fn);}},
   service:{getOne(id){calls.push(id);return Promise.resolve({id,question:'Old',motherTongue:'Transcript',questionType:{id:6},status:valid?5:1});},getPageForGames(){throw Error('Wrong source');}},
   blockUI:{start(){calls.push('start');},stop(){calls.push('stop');}},toastr:{error(){}},alert(){throw Error('Topic requested');},
   createQuestionsWithOptions:items=>structuredClone(items),processFillingGapsByMode:text=>'Gaps: '+text,$scope:{chooseFillingGaps(){calls.push('gaps');}}};
  nodeVm.runInNewContext(section(legacy,'        vm.getPageFlashCard = function','        vm.createQuiz ='),context);vm.getPageFlashCard();await tick();
  assert.equal(calls.includes(21),true);assert.equal(vm.standaloneListeningLoading,false);
  if(valid){assert.equal(vm.currentCard.id,21);assert.equal(vm.fillingGapQuestion,'Gaps: Transcript');assert.equal(vm.showGapTitleTable,false);assert.equal(calls.includes('gaps'),true);}
  else{assert.match(vm.standaloneListeningError,/Không tải/);assert.equal(calls.includes('gaps'),false);}
 }
});
test('shared library uses published Daily Listening tests and opens the existing gap runtime for students',async()=>{
 let definition;const angular={copy:structuredClone,module(){return{controller(name,controller){definition=controller;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,'question/controllers/IELTSTestLibraryController.js'),'utf8'),{angular});
 const vm={},queries=[];
 definition.call(vm,{settings:{layout:{}}},{$on(){}},{path:()=>'/daily_listening_tests'},
  {addEventListener(){},removeEventListener(){},localStorage:{length:0}}, {get:()=>JSON.stringify({id:9,roles:[{name:'ROLE_VIEWER'}]})},{},
  {getPageForTests(dto){queries.push(plain(dto));return Promise.resolve({content:[{id:21,title:'Shared lesson'}],totalElements:1});},getLearningDrafts(){throw Error('IELTS drafts requested');}},
  {start(){},stop(){}},{applyFilter(dto,id){dto.testFolderId=id||null;dto.withoutTestFolder=id==null;dto.pageIndex=1;}});
 await tick();assert.equal(vm.isDailyListeningMode,true);assert.equal(vm.folderTestMode,'DAILY_LISTENING');assert.equal(queries[0].testFormat,'DAILY_LISTENING');
 assert.equal(queries[0].upper,2147483647);assert.equal(queries[0].userId,undefined);assert.equal(vm.testCatalogUrl({id:21}),'daily_listening/21');
 assert.equal(vm.ieltsReadingTests.length,1);
});
test('the old gap checker still checks instantly and the standalone lesson completes at 90%, without changing other modes',()=>{
 for(const [standalone,correct,expected] of [[true,8,0],[true,9,1],[false,9,0],[false,10,1]]){
  let submitted=0;const vm={isStandaloneDailyListening:standalone,mode:{id:8},testResult:{},gapAnswers:{},gapValues:{},gapCorrectMap:{},saveTestResult(){submitted++;}};
  for(let i=0;i<10;i++){vm.gapAnswers[i]='word'+i;vm.gapValues[i]=i<correct?'word'+i:'';}
  const context={vm,angular:{forEach(items,fn){items.forEach(fn);}},normalizeGapAutoNext:value=>String(value).trim().toLowerCase(),updateCurrentGapAnswerState(){}};
  nodeVm.runInNewContext(section(legacy,'        vm.tryAutoSaveFillingGaps =','        // vm.togglePauseAudio ='),context);
  vm.tryAutoSaveFillingGaps();assert.equal(vm.percentage,correct*10);assert.equal(submitted,expected);assert.equal(vm.gapCorrectMap[0],true);
  vm.tryAutoSaveFillingGaps();assert.equal(submitted,expected);
 }
});
test('a standalone lesson finds its own saved draft and leaves other listening drafts intact',()=>{
 const values=new Map([['daily-listening-progress:v1:7:21',JSON.stringify({card:{id:21},updatedAt:1})],
  ['daily-listening-progress:v1:7:22',JSON.stringify({card:{id:22},updatedAt:2})]]);
 const context={vm:{isStandaloneDailyListening:true,standaloneDailyListeningId:21},window:{localStorage:{get length(){return values.size;},key:index=>Array.from(values.keys())[index],getItem:key=>values.get(key),removeItem:key=>values.delete(key)}},
  dailyListeningDraftPrefix:()=> 'daily-listening-progress:v1:7:',dailyListeningDraftKey:id=>'daily-listening-progress:v1:7:'+id,isValidDailyListeningDraft:()=>true,
  angular:{forEach(items,fn){items.forEach(fn);}},deleteDailyListeningLearningDraft(){throw Error('Deleted another draft');}};
 nodeVm.runInNewContext(section(legacy,'        function findLatestDailyListeningDraft()','        vm.refreshDailyListeningDraft ='),context);
 assert.equal(context.findLatestDailyListeningDraft().card.id,21);assert.equal(values.size,2);
});
test('Daily Listening has its own creation and playback routes and is hidden from new comprehensive package choices',async()=>{
 const states={};const angular={module(){return {
  filter(){return this;},
  config(def){def.at(-1)({state(name,value){states[name]=value;return this;}});}
 };}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,'question/question.module.js'),'utf8'),{angular,Hrm:{},window:{APP_VERSION:'test'}});
 const create=states['application.create_daily_listening_test'],play=states['application.daily_listening_actual_test'];
 assert.equal(create.controller,'DailyListeningTestController as vm');assert.equal(play.controller,'ViewController as vm');assert.equal(play.url,'/daily_listening/:dailyListeningId');
 const deps=await create.resolve.deps.at(-1)({load:config=>Promise.resolve(config)});assert.ok(deps.files.includes('question/controllers/DailyListeningTestController.js?v=test'));
 const builder=fs.readFileSync(path.join(app,'question/controllers/IELTSCreateReadingTestController.js'),'utf8');
 for(const comprehensive of [true,false]){
  const vm={isComprehensiveMode:comprehensive};nodeVm.runInNewContext(section(builder,'        vm.types = [','        vm.matchingOptionLabel ='),{vm});
  assert.equal(vm.questionPackageTypes.some(type=>type.id===18),false);assert.ok(vm.questionPackageTypes.some(type=>type.id===1));
 }
 assert.doesNotMatch(fs.readFileSync(path.join(app,'question/views/create_ielts_reading_test.html'),'utf8'),/ng-click="vm.addDailyListeningPackage\(\)"/);
});
