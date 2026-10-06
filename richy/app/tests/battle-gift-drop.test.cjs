const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const plain=v=>JSON.parse(JSON.stringify(v));
function setup(username='alice') {
 let Controller,hooks,resolveClaim,rejectClaim,resolveAnswer,cleanup; const calls=[],answerCalls=[],events={},bodyClasses=new Set();
 const angular={module(){return {controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},copy:plain,fromJson:JSON.parse,noop(){},element(){return {on(name,fn){events[name]=fn;},off(){}};}};
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');
 nodeVm.runInNewContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'expose({applyRoom,buildSettingsDto});'),{angular,expose(v){hooks=v;}});
 const timer=()=>1; timer.cancel=()=>{};
 const window={Promise,APP_VERSION:'qa',location:{origin:'http://localhost'},navigator:{},document:{body:{classList:{add(name){bodyClasses.add(name);},remove(name){bodyClasses.delete(name);}}},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
 const service={claimGift(...args){calls.push(args);return new Promise((resolve,reject)=>{resolveClaim=resolve;rejectClaim=reject;});},
  answer(...args){answerCalls.push(args);return new Promise(resolve=>{resolveAnswer=resolve;});},getRoom(){return Promise.resolve(plain(vm.room));},disconnectRealtime(){}};
 const vm=new Controller({},{$on(name,fn){if(name==='$destroy')cleanup=fn;},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username});}},window,{warning(){},error(){}},{},{},service);
 function room(credits=1,version=1,gameId='match1') {
  const now=Date.now(); return {code:'GIFTS1',hostUsername:'host',status:'PLAYING',serverTime:now,matchEndsAt:now+60000,questionEndsAt:now+60000,
   settings:{mode:'LUM_NGAY',teamCount:0,skillsEnabled:false,giftSpawnSeconds:3,giftBasePoints:10},players:[{username:'host',spectator:true},{username:'alice',connected:true,spectator:false}],recentEvents:[],
   currentQuestion:{id:7,sequence:1,question:'hello',answers:[{key:'A',text:'xin chào'}]},giftDrop:{gameId,version,capacity:6,gifts:[{id:'gift1'},{id:'gift2'}]},giftCredits:credits,giftCreditVersion:version};
 }
 hooks.applyRoom(room(),false);
 return {vm,hooks,calls,answerCalls,events,bodyClasses,room,resolve(result){resolveClaim(result);},reject(error){rejectClaim(error);},resolveAnswer(result){resolveAnswer(result);},destroy(){cleanup();}};
}
test('Lụm ngay can be selected and its spawn/score settings are clamped',()=>{
 const h=setup('host'); h.vm.hostSettings.mode='LUM_NGAY';h.vm.hostSettings.giftSpawnSeconds=0;h.vm.hostSettings.giftBasePoints=25000;
 const dto=h.hooks.buildSettingsDto(); assert.equal(dto.mode,'LUM_NGAY');assert.equal(dto.giftSpawnSeconds,1);assert.equal(dto.giftBasePoints,10000);
 assert.equal(h.vm.isCountdownMode(),true);
});
test('each level uses an existing distinct egg/cracked egg/pet artwork',()=>{
 const h=setup(),seen=new Set();
 for(let level=0;level<=14;level++) {
  const src=h.vm.getGiftRewardImage(level).split('?')[0];assert.ok(fs.existsSync(path.join(__dirname,'..',src)),src);seen.add(src);
  if(level%3<2) assert.ok(h.vm.getGiftRewardLabel(level).startsWith(level%3===0?'Trứng ':'Trứng vỡ '));
 }
 assert.equal(seen.size,15);
});
test('zero credit, spectator, freeze and requests in progress cannot pick gifts',()=>{
 for(const state of ['no-credit','spectator','freeze','wrong','answering','claiming','finished']) {
  const h=setup(),room=h.room();
  if(state==='no-credit')room.giftCredits=0;
  if(state==='spectator')room.players[1].spectator=true;
  if(state==='freeze')room.players[1].frozenUntil=Date.now()+5000;
  if(state==='wrong')room.wrongAnswerPenaltyUntil=Date.now()+5000;
  if(state==='finished')room.status='FINISHED';
  h.hooks.applyRoom(room,false);
  if(state==='answering')h.vm.answerLocked=true;
  if(state==='claiming')h.vm.claimingGift=true;
  h.vm.openGiftModal();
  h.vm.claimGift({id:'gift1'});assert.equal(h.calls.length,0,state);
 }
});
test('one successful claim reveals an image, updates the pool and consumes a credit once',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});h.vm.claimGift({id:'gift1'});assert.equal(h.calls.length,1);
 assert.equal(h.vm.exerciseInputDisabled(),true);
 const result=h.room(0,2);result.giftDrop.gifts=[{id:'gift2'}];h.resolve({room:result,rewardLevel:14,points:150});await pending;
 assert.deepEqual(plain(h.vm.lastGiftReward),{level:14,points:150});assert.equal(h.vm.room.giftCredits,0);assert.equal(h.vm.room.giftDrop.gifts.length,1);
 assert.equal(h.vm.giftClaimDisabled(),true);assert.equal(h.vm.claimingGift,false);
 assert.equal(h.vm.giftModalOpen,true);h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,false);
});
test('old public/private snapshots cannot restore consumed gifts or credits',()=>{
 const h=setup();const claimed=h.room(0,4);claimed.giftDrop.gifts=[];claimed.players[1].score=150;h.hooks.applyRoom(claimed,false);
 const generic=h.room(9,3);delete generic.giftCredits;delete generic.giftCreditVersion;h.hooks.applyRoom(generic,true);
 assert.equal(h.vm.room.giftCredits,0);assert.equal(h.vm.room.giftDrop.gifts.length,0);assert.equal(h.vm.room.players[1].score,150);
 h.hooks.applyRoom(h.room(2,2),false);assert.equal(h.vm.room.giftCredits,0);assert.equal(h.vm.room.giftCreditVersion,4);
 h.hooks.applyRoom(h.room(0,1,'match2'),false);assert.equal(h.vm.room.giftCreditVersion,1);
});
test('a late claim response from the previous match does not reveal its old prize',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});h.hooks.applyRoom(h.room(0,1,'match2'),false);
 h.resolve({room:h.room(0,2,'match1'),rewardLevel:14,points:150});await pending;
 assert.equal(h.vm.room.giftDrop.gameId,'match2');assert.equal(h.vm.lastGiftReward,null);
});
test('correct vocabulary and comprehensive answers open the egg modal; wrong answers do not',async()=>{
 for(const exercise of [false,true]) for(const correct of [false,true]) {
  const h=setup(),room=h.room(0);if(exercise)room.currentQuestion.exercise={answerMode:'TEXT',type:11,items:[{id:'103',number:1}]};
  h.hooks.applyRoom(room,false);h.vm.exerciseAnswers={'103':['answer']};
  if(exercise)h.vm.submitExercise(false);else h.vm.answer(room.currentQuestion.answers[0]);
  assert.equal(h.answerCalls.length,1);const next=h.room(correct?1:0,2);next.currentQuestion.sequence=2;
  h.resolveAnswer({correct,correctAnswer:'xin chào',room:next});await Promise.resolve();
  assert.equal(h.vm.giftModalOpen,correct);assert.equal(h.vm.answerLocked,false);
 }
});
test('modal blocks question submission and keyboard shortcuts until it is dismissed',()=>{
 const h=setup();h.vm.openGiftModal();assert.equal(h.bodyClasses.has('battle-gift-modal-open'),true);
 h.vm.answer(h.vm.room.currentQuestion.answers[0]);h.events.keydown({key:'A',preventDefault(){}});
 assert.equal(h.answerCalls.length,0);assert.equal(h.vm.exerciseInputDisabled(),true);
 h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,true,'clicking the selection backdrop does not dismiss it');
 h.events.keydown({key:'Escape',preventDefault(){}});assert.equal(h.vm.giftModalOpen,false);
 assert.equal(h.vm.room.giftCredits,1);assert.equal(h.bodyClasses.has('battle-gift-modal-open'),false);
});
test('one modal permits only one egg even when the player has several saved credits',async()=>{
 const h=setup();h.hooks.applyRoom(h.room(3),false);h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});
 h.vm.closeGiftModal();assert.equal(h.vm.giftModalOpen,true,'cannot close a request in progress');
 h.resolve({room:h.room(2,2),rewardLevel:3,points:40});await pending;
 h.vm.claimGift({id:'gift2'});assert.equal(h.calls.length,1);h.vm.dismissGiftReward();
 h.vm.openGiftModal();assert.equal(h.vm.lastGiftReward,null);assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftCredits,2);
});
test('an empty egg pool waits in the modal and live spawns populate it without closing it',()=>{
 const h=setup(),empty=h.room();empty.giftDrop.gifts=[];h.hooks.applyRoom(empty,false);h.vm.openGiftModal();
 assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftDrop.gifts.length,0);
 h.hooks.applyRoom(h.room(1,2),true);assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftDrop.gifts.length,2);
});
test('a lost claim preserves the selection modal and credit so another egg can be picked',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});
 h.reject({status:409,data:{message:'Gift already claimed'}});await pending;
 assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.lastGiftReward,null);assert.equal(h.vm.room.giftCredits,1);assert.equal(h.vm.claimingGift,false);
});
test('finishing the match or destroying the view releases the modal and body scroll lock',()=>{
 const h=setup();h.vm.openGiftModal();const done=h.room();done.status='FINISHED';h.hooks.applyRoom(done,false);
 assert.equal(h.vm.giftModalOpen,false);assert.equal(h.bodyClasses.has('battle-gift-modal-open'),false);
 h.hooks.applyRoom(h.room(1,1,'match2'),false);h.vm.openGiftModal();h.destroy();
 assert.equal(h.vm.giftModalOpen,false);assert.equal(h.bodyClasses.has('battle-gift-modal-open'),false);
});
test('a late answer response cannot reopen the modal after the match finishes',async()=>{
 const h=setup();h.hooks.applyRoom(h.room(0),false);h.vm.answer(h.vm.room.currentQuestion.answers[0]);
 const done=h.room(0,2);done.status='FINISHED';h.hooks.applyRoom(done,false);
 h.resolveAnswer({correct:true,room:h.room(1,2)});await Promise.resolve();
 assert.equal(h.vm.room.status,'FINISHED');assert.equal(h.vm.giftModalOpen,false);
});
test('a rotten egg uses the generated asset and preserves a fractional reward',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});
 const next=h.room(0,2);next.players[1].score=0.5;h.resolve({rewardLevel:-1,points:0.5,room:next});await pending;
 assert.deepEqual(plain(h.vm.lastGiftReward),{level:-1,points:0.5});assert.equal(h.vm.room.players[1].score,0.5);
 assert.equal(h.vm.getGiftRewardLabel(-1),'Trứng thối');
 assert.ok(fs.existsSync(path.join(__dirname,'..',h.vm.getGiftRewardImage(-1).split('?')[0])));
 h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,false);
});
