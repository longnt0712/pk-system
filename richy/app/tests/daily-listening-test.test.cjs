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
  questionType:{id:6},status:5,user:{id:7},questionTopics:[{id:10,topic:{id:2}}],questionAnswers:[{id:8,answer:{id:9,answer:'Keep'}}],correctAnswer:3,timeReviewd:142};
 const requests=[],saves=[],vm={},redirects=[];
 const service={getPage(dto,index,size){requests.push({dto:plain(dto),index,size});
  // Match the legacy backend's defaults: omitted bounds are lower=3, upper=0.
  const lower=dto.lower==null?3:dto.lower,upper=dto.upper==null?0:dto.upper;
  const content=old.timeReviewd>=lower&&old.timeReviewd<=upper?[structuredClone(old)]:[];
  return Promise.resolve({content,totalElements:content.length});},
  getOne(){return Promise.resolve(structuredClone(old));},saveObject(dto){saves.push(structuredClone(dto));return Promise.resolve({...dto,id:dto.id||22});},...overrides.service};
 const document={createElement(){return{innerHTML:'',get textContent(){return this.innerHTML.replace(/<[^>]*>/g,'');}};}};
 definition.call(vm,{get(){return JSON.stringify({id:7,roles:[{name:overrides.role||'ROLE_ADMIN'}]});}},
  {path(value){redirects.push(value);}},{document},{},service,{parseUrl(url){return /^https?:\/\//.test(url)?{}:null;}},{success(){}},overrides.modal,{when:Promise.resolve.bind(Promise)});
 return {vm,old,requests,saves,redirects};
}
test('the separate creator lists owned legacy Listening flashcards and blocks student authoring',async()=>{
 const {vm,requests}=setup();await tick();
 assert.equal(vm.items[0].id,21);assert.equal(vm.totalItems,1);
 assert.deepEqual(requests[0].dto,{questionType:{id:6},status:5,type:100,userId:7,lower:0,upper:2147483647,textSearch:'',findExactWord:false,pageIndex:1,pageSize:12});
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
test('shared legacy sources are selectable and editing preserves the original teacher instead of reassigning the record',async()=>{
 const record={id:51,status:5,questionType:{id:6},user:{id:26},question:'Shared lesson',pronounce:'https://school.test/shared.mp3',motherTongue:'Old transcript'};
 const saves=[],queries=[];
 const {vm}=setup({service:{getPage(dto){queries.push(plain(dto));return Promise.resolve({content:[],totalElements:0});},
  getOne(){return Promise.resolve(structuredClone(record));},saveObject(dto){saves.push(plain(dto));return Promise.resolve({...dto,user:{id:26}});}}});await tick();
 vm.sourceId=26;await vm.sourceChanged();assert.equal(queries.at(-1).userId,26);
 await vm.edit(record);vm.draft.question='Edited shared title';await vm.save();assert.equal(saves[0].id,51);assert.equal(saves[0].userId,26);
 assert.equal(vm.draft.userId,26);vm.newTest();await tick();assert.equal(vm.sourceId,7);assert.equal(vm.draft.userId,7);
});
test('a new lesson created while browsing a shared source still belongs to its author and returns to the owned catalog',async()=>{
 const queries=[],saves=[];const {vm}=setup({service:{getPage(dto){queries.push(plain(dto));return Promise.resolve({content:[],totalElements:0});},
  saveObject(dto){saves.push(plain(dto));return Promise.resolve({...dto,id:70,user:{id:7}});}}});await tick();
 vm.sourceId=26;await vm.sourceChanged();vm.transcript='A new personal lesson.';vm.draft.pronounce='https://school.test/new.mp3';await vm.save();await tick();
 assert.equal(saves[0].userId,7);assert.equal(vm.sourceId,7);assert.equal(vm.searchDto.userId,7);assert.equal(queries.at(-1).userId,7);
});
test('selected old flashcards migrate in place with full content and owner preserved, and failed rows remain retryable',async()=>{
 const records=[1,2].map(id=>({id,question:'Old '+id,questionType:{id:6},status:1,user:{id:26},pronounce:'https://school.test/old.mp3',
  motherTongue:'<p>Original transcript</p>',questionTopics:[{id:41,topic:{id:7}}],questionAnswers:[{id:42,answer:{id:43,answer:'Keep'}}],timeReviewd:142,correctAnswer:50}));
 let transfer,resolveResult,failSecond=true;const writes=[];
 const modal={open(config){const result=new Promise(resolve=>{resolveResult=resolve;});transfer={};
  config.controller.at(-1).call(transfer,{$on(){}},{close(value){resolveResult(value);}});return{result};}};
 const {vm}=setup({modal,service:{
  getPage(dto){const content=records.filter(item=>item.user.id===dto.userId&&(dto.status===5?item.status===5:item.status!==5)).map(item=>structuredClone(item));return Promise.resolve({content,totalElements:content.length});},
  getOne(id){return Promise.resolve(structuredClone(records.find(record=>record.id===Number(id))));},
  saveObject(dto){writes.push(plain(dto));if(dto.id===2&&failSecond)return Promise.reject({data:{message:'Retry this row'}});
   Object.assign(records.find(record=>record.id===dto.id),structuredClone(dto));return Promise.resolve(structuredClone(dto));}
 }});await tick();vm.sourceId=26;await vm.sourceChanged();vm.importOldListening();await tick();
 transfer.selectAll();assert.equal(transfer.count(),2);const pending=transfer.save();assert.equal(transfer.save(),undefined);await pending;
 assert.equal(transfer.moved,1);assert.equal(transfer.items.length,1);assert.equal(transfer.selected[2],true);assert.equal(transfer.errors[2],'Retry this row');
 assert.equal(writes[0].id,1);assert.equal(writes[0].status,5);assert.equal(writes[0].userId,26);
 assert.equal(writes[0].motherTongue,'<p>Original transcript</p>');assert.equal(writes[0].timeReviewd,142);assert.equal(writes[0].correctAnswer,50);
 assert.deepEqual(writes[0].questionAnswers,records[1].questionAnswers);assert.deepEqual(writes[0].questionTopics,records[1].questionTopics);
 failSecond=false;await transfer.save();await tick();assert.equal(records.length,2);assert.equal(transfer.moved,2);assert.equal(vm.importDialogOpen,false);
 assert.equal(vm.items.length,2);assert.equal(writes.filter(item=>item.id===1).length,1);assert.equal(writes.filter(item=>item.id===2).length,2);
});
test('invalid or changed legacy records are not migrated',async()=>{
 let transfer;const invalid={id:1,question:'Word without audio',questionType:{id:6},status:1,user:{id:7},motherTongue:'Text',pronounce:''};
 const ready={...invalid,id:2,pronounce:'https://school.test/old.mp3'};let written=false;
 const modal={open(config){transfer={};config.controller.at(-1).call(transfer,{$on(){}},{close(){}});return{result:new Promise(()=>{})};}};
 const {vm}=setup({modal,service:{getPage(){return Promise.resolve({content:[invalid,ready],totalElements:2});},getOne(){return Promise.resolve({...ready,user:{id:8}});},saveObject(){written=true;}}});await tick();
 vm.importOldListening();await tick();transfer.selectAll();assert.equal(transfer.selected[1],undefined);assert.equal(transfer.count(),1);
 await transfer.save();assert.equal(written,false);assert.equal(transfer.selected[2],true);assert.match(transfer.errors[2],/Bài đã thay đổi/);
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
