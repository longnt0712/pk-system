const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(username='alice') {
 let Controller,hooks,resolveAnswer; const calls=[],warnings=[];
 const angular={module(){return {controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},copy:plain,fromJson:JSON.parse,noop(){},element(){return {on(){},off(){}};}};
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');
 nodeVm.runInNewContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'expose({applyRoom,buildSettingsDto,autoSubmitGuessWordAtTimeout});'),{angular,expose(value){hooks=value;}});
 const timer=()=>1;timer.cancel=()=>{};
 const window={location:{origin:'http://localhost'},navigator:{},document:{body:{classList:{add(){},remove(){}}},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
 const service={answer(...args){calls.push(args);return new Promise(resolve=>{resolveAnswer=resolve;});}};
 const questions={getPageForTests(...args){calls.push(args);return Promise.resolve({content:[{id:100,title:'Đề tổng hợp'}],totalElements:25});},
  getTopicsForGames(){return Promise.resolve({content:[{id:8,name:'Animals',topicCategory:{id:6,name:'Grade 6'}},{id:9,name:'Food',topicCategory:{id:7,name:'Grade 7'}}]});}};
 const vm=new Controller({},{$on(){},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username});}},window,{warning(text){warnings.push(text);},error(){}},{},questions,service);
 function room(mode='CLASSIC',seq=1) {
  const now=Date.now();return {code:'GAME1',hostUsername:'host',status:'PLAYING',serverTime:now,questionEndsAt:now+60000,matchEndsAt:now+60000,
   settings:{mode,questionSource:'COMPREHENSIVE',exerciseTestIds:[100],topicNames:['Đề tổng hợp'],teamCount:2},guessPhase:'QUESTION',
   players:[{username:'host',spectator:true},{username:'alice',connected:true,spectator:false,teamNumber:1},{username:'bob',connected:true,spectator:false,teamNumber:2}],recentEvents:[],
   currentQuestion:{id:102,sequence:seq,answers:[],exercise:{answerMode:'TEXT',type:11,items:[{id:'103',number:1},{id:'104',number:2}]}}};
 }
 return {vm,hooks,calls,warnings,room,resolve(result){resolveAnswer(result);}};
}
test('selects only comprehensive tests and sends their IDs independently of vocabulary',async()=>{
 const h=setup();h.vm.questionSource='COMPREHENSIVE';await h.vm.loadExerciseTests(2);
 assert.equal(h.calls[0][0].testFormat,'COMPREHENSIVE');assert.equal(h.calls[0][1],2);assert.equal(h.vm.exerciseTotalPages,3);
 assert.equal(h.calls[0][0].lower,0);assert.equal(h.calls[0][0].upper,100);
 assert.equal(h.calls[0][0].topicOwnerUserId,null);assert.equal(h.calls[0][0].withoutTopics,false);
 h.vm.addExerciseTest(h.vm.exerciseTests[0]);h.vm.addExerciseTest(h.vm.exerciseTests[0]);
 assert.deepEqual(plain(h.hooks.buildSettingsDto().exerciseTestIds),[100]);
 assert.equal(h.hooks.buildSettingsDto().questionSource,'COMPREHENSIVE');
 h.vm.removeExerciseTest(h.vm.selectedExerciseTests[0]);assert.equal(h.vm.selectedExerciseTests.length,0);
});
test('Battle filters by source, category and topic, while all/unassigned remove stale topic constraints',async()=>{
 const h=setup();h.vm.exerciseTopicOwnerId=26;h.vm.exerciseFilterMode='TOPIC';await h.vm.changeExerciseFilter();
 assert.equal(h.vm.exerciseTopicCategories.length,2);assert.equal(h.vm.exerciseTopics.length,2);
 h.vm.exerciseTopicCategoryId=6;await h.vm.changeExerciseTopicCategory();assert.equal(h.vm.exerciseTopics.length,1);
 h.vm.exerciseTopicId=8;h.vm.exerciseSearch='test title';await h.vm.loadExerciseTests(1);
 let dto=h.calls.at(-1)[0];assert.equal(dto.topicOwnerUserId,26);assert.equal(dto.topicCategoryId,6);assert.equal(dto.topicId,8);
 h.vm.exerciseFilterMode='UNASSIGNED';await h.vm.changeExerciseFilter();dto=h.calls.at(-1)[0];
 assert.equal(dto.withoutTopics,true);assert.equal(dto.topicOwnerUserId,null);assert.equal(dto.topicCategoryId,null);assert.equal(dto.topicId,null);assert.equal(dto.textSearch,'test title');
 h.vm.exerciseFilterMode='ALL';await h.vm.changeExerciseFilter();assert.equal(h.calls.at(-1)[0].withoutTopics,false);
});
test('all seven modes submit every original answer once and require complete manual answers',()=>{
 for(const mode of ['CLASSIC','COUNTDOWN','MONEY_BEG','ESCAPE_DUMB_DEMON','DEMON_DEFENSE','GUESS_WORD','LUM_NGAY']) {
  const h=setup();h.hooks.applyRoom(h.room(mode),false);h.vm.exerciseAnswers={'103':['first']};h.vm.submitExercise(false);
  assert.equal(h.calls.length,0,mode);assert.equal(h.warnings.length,1);
  h.vm.exerciseAnswers['104']=['second'];h.vm.submitExercise(false);h.vm.submitExercise(false);
  assert.equal(h.calls.length,1,mode);assert.deepEqual(plain(h.calls[0][4]),{'103':['first'],'104':['second']});
 }
});
test('realtime updates keep entered answers; a new sequence clears them',()=>{
 const h=setup();h.hooks.applyRoom(h.room('COUNTDOWN'),false);h.vm.exerciseAnswers={'103':['typed']};
 h.hooks.applyRoom(h.room('COUNTDOWN'),true);assert.deepEqual(plain(h.vm.exerciseAnswers),{'103':['typed']});
 h.hooks.applyRoom(h.room('COUNTDOWN',2),false);assert.deepEqual(plain(h.vm.exerciseAnswers),{});
});
test('freeze, elimination, spectator, skill and password states block exercise submission',()=>{
 for(const state of ['freeze','eliminated','spectator','skill','password']) {
  const h=setup();const room=h.room('DEMON_DEFENSE');
  if(state==='freeze')room.players[1].frozenUntil=Date.now()+10000;
  if(state==='spectator')room.players[1].spectator=true;
  if(state==='eliminated')room.players[1].demonEliminated=true;
  if(state==='skill')room.pendingSkillType='FREEZE';
  if(state==='password')room.passwordSelectionRequired=true;
  h.hooks.applyRoom(room,false);h.vm.exerciseAnswers={'103':['first'],'104':['second']};h.vm.submitExercise(false);
  assert.equal(h.calls.length,0,state);
 }
});
test('Guess timeout submits partial answers once and a late response cannot rewind the next question',async()=>{
 const h=setup();h.hooks.applyRoom(h.room('GUESS_WORD'),false);h.vm.exerciseAnswers={'103':['typed']};h.vm.countdown=0;
 h.hooks.autoSubmitGuessWordAtTimeout();h.hooks.autoSubmitGuessWordAtTimeout();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][5],true);
 const old=h.room('GUESS_WORD');h.hooks.applyRoom(h.room('GUESS_WORD',2),false);h.vm.exerciseAnswers={'103':['new answer']};
 h.resolve({correct:false,room:old});await Promise.resolve();
 assert.equal(h.vm.room.currentQuestion.sequence,2);assert.deepEqual(plain(h.vm.exerciseAnswers),{'103':['new answer']});assert.equal(h.vm.answerLocked,false);
});
test('canceling the lobby editor restores saved source and exercises',()=>{
 const h=setup('host'),room=h.room();room.status='LOBBY';h.hooks.applyRoom(room,false);
 h.vm.lobbyTopicEditorOpen=true;h.vm.questionSource='VOCABULARY';h.vm.selectedExerciseTests=[];h.vm.closeLobbyTopicEditor();
 assert.equal(h.vm.questionSource,'COMPREHENSIVE');assert.deepEqual(plain(h.vm.selectedExerciseTests),[{id:100,title:'Đề tổng hợp'}]);
});
test('team summaries keep stable references until the scores actually change',()=>{
 const h=setup();h.hooks.applyRoom(h.room(),false);
 const first=h.vm.getTeamSummaries();assert.strictEqual(first,h.vm.getTeamSummaries());
 h.vm.room.players[1].score=5;const changed=h.vm.getTeamSummaries();assert.notStrictEqual(changed,first);assert.equal(changed[0].score,5);
});
