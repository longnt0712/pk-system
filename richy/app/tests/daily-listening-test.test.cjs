const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(app,'question/controllers/DailyListeningTestController.js'),'utf8');
const legacy=fs.readFileSync(path.join(app,'question/controllers/ViewController.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function section(text,start,end){const from=text.indexOf(start),to=text.indexOf(end,from);assert.ok(from>=0&&to>from,start);return text.slice(from,to);}
function setup(overrides={}){
 let definition;const angular={copy:structuredClone,module(){return{controller(name,controller){definition=controller.at(-1);}};}};
 nodeVm.runInNewContext(source,{angular});
 const old={id:21,question:'Old listening',pronounce:'https://school.test/old.mp3',motherTongue:'<p>We listen every day.</p>',
  questionType:{id:6},status:5,user:{id:7},questionTopics:[{id:10,topic:{id:2}}],questionAnswers:[{id:8,answer:{id:9,answer:'Keep'}}],correctAnswer:3};
 const requests=[],saves=[],vm={},redirects=[];
 const service={getPage(dto,index,size){requests.push({dto:plain(dto),index,size});return Promise.resolve({content:[structuredClone(old)],totalElements:1});},
  getOne(){return Promise.resolve(structuredClone(old));},saveObject(dto){saves.push(structuredClone(dto));return Promise.resolve({...dto,id:dto.id||22});},...overrides.service};
 const document={createElement(){return{innerHTML:'',get textContent(){return this.innerHTML.replace(/<[^>]*>/g,'');}};}};
 definition.call(vm,{get(){return JSON.stringify({id:7,roles:[{name:overrides.role||'ROLE_ADMIN'}]});}},
  {path(value){redirects.push(value);}},{document},{},service,{parseUrl(url){return /^https:\/\//.test(url)?{}:null;}},{success(){}});
 return {vm,old,requests,saves,redirects};
}
test('the separate creator lists owned legacy Listening flashcards and blocks student authoring',async()=>{
 const {vm,requests}=setup();await tick();
 assert.equal(vm.items[0].id,21);assert.equal(vm.totalItems,1);
 assert.deepEqual(requests[0].dto,{questionType:{id:6},status:5,type:100,userId:7,textSearch:'',findExactWord:false,pageIndex:1,pageSize:12});
 const restricted=setup({role:'ROLE_STUDENT'});assert.deepEqual(restricted.redirects,['/comprehensive_tests']);assert.equal(restricted.requests.length,0);
});
test('editing an old listening preserves its id, formatted transcript, topics, answers and counters',async()=>{
 const {vm,old,saves,requests}=setup();await tick();await vm.edit(old);
 assert.equal(vm.transcript,'We listen every day.');vm.draft.question='New title';await vm.save();
 assert.equal(saves[0].id,21);assert.equal(saves[0].motherTongue,old.motherTongue);
 assert.deepEqual(saves[0].questionTopics,old.questionTopics);assert.deepEqual(saves[0].questionAnswers,old.questionAnswers);
 assert.equal(saves[0].correctAnswer,3);assert.equal(saves[0].status,5);assert.equal(saves[0].userId,7);
 assert.equal(vm.items[0].question,'New title');assert.equal(requests.length,1);
});
test('a pasted transcript creates a legacy Listening record with no gaps or manually entered answers',async()=>{
 const {vm,saves}=setup();await tick();vm.transcript='We hear a new story every morning.';vm.draft.pronounce='https://school.test/new.mp3';await vm.save();
 assert.equal(saves[0].question,'We hear a new story every morning.');assert.equal(saves[0].motherTongue,vm.transcript);
 assert.equal(saves[0].questionType.id,6);assert.equal(saves[0].status,5);assert.deepEqual(saves[0].questionAnswers,[]);
 assert.deepEqual(saves[0].questionTopics,[]);assert.equal(vm.practiceUrl(vm.draft),'daily_listening/22');
});
test('failed and duplicate saves preserve the draft and show success only after a saved id',async()=>{
 let resolveSave;const {vm}=setup({service:{saveObject(){return new Promise(resolve=>{resolveSave=resolve;});}}});await tick();
 vm.transcript='We keep the transcript.';vm.draft.pronounce='https://school.test/new.mp3';const pending=vm.save();assert.equal(vm.saving,true);assert.equal(vm.save(),undefined);
 resolveSave({message:'Save failed'});await pending;assert.equal(vm.saving,false);assert.equal(vm.transcript,'We keep the transcript.');assert.equal(vm.savedMessage,'');assert.match(vm.error,/Save failed/);
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
