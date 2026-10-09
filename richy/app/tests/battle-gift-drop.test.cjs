const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const plain=v=>JSON.parse(JSON.stringify(v));
function setup(username='alice') {
 let Controller,hooks,resolveClaim,rejectClaim,resolveAnswer,cleanup; const calls=[],answerCalls=[],finishCalls=[],extendCalls=[],events={},bodyClasses=new Set();
 const angular={module(){return {controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},copy:plain,fromJson:JSON.parse,noop(){},element(){return {on(name,fn){events[name]=fn;},off(){}};}};
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');
 nodeVm.runInNewContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'expose({applyRoom,buildSettingsDto});'),{angular,expose(v){hooks=v;}});
 const timer=()=>1; timer.cancel=()=>{};
 const window={Promise,APP_VERSION:'qa',location:{origin:'http://localhost'},navigator:{},document:{body:{classList:{add(name){bodyClasses.add(name);},remove(name){bodyClasses.delete(name);}}},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
 const service={claimGift(...args){calls.push(args);return new Promise((resolve,reject)=>{resolveClaim=resolve;rejectClaim=reject;});},
  finishGiftOpening(...args){finishCalls.push(args);const done=plain(vm.room);done.status='FINISHED';done.giftOpening=false;return Promise.resolve(done);},
  extendGiftOpening(...args){extendCalls.push(args);const next=plain(vm.room);next.giftOpeningEndsAt+=60000;next.matchEndsAt=next.giftOpeningEndsAt;return Promise.resolve(next);},
  answer(...args){answerCalls.push(args);return new Promise(resolve=>{resolveAnswer=resolve;});},getRoom(){return Promise.resolve(plain(vm.room));},disconnectRealtime(){}};
 const vm=new Controller({},{$on(name,fn){if(name==='$destroy')cleanup=fn;},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username});}},window,{warning(){},error(){}},{},{},service);
 function room(credits=1,version=1,gameId='match1') {
  const now=Date.now(); return {code:'GIFTS1',hostUsername:'host',status:'PLAYING',serverTime:now,matchEndsAt:now+180000,giftOpening:true,giftOpeningEndsAt:now+180000,questionEndsAt:0,
   settings:{mode:'LUM_NGAY',teamCount:0,skillsEnabled:false,giftSpawnSeconds:3,giftBasePoints:10},players:[{username:'host',spectator:true},{username:'alice',connected:true,spectator:false}],recentEvents:[],
   currentQuestion:null,giftDrop:{gameId,version,poolVersion:version,capacity:credits+3,gifts:[{id:'gift1'},{id:'gift2'},{id:'gift3'}]},giftCredits:credits,giftCreditVersion:version};
 }
 hooks.applyRoom(room(),false);
 return {vm,hooks,calls,answerCalls,finishCalls,extendCalls,events,bodyClasses,room,resolve(result){resolveClaim(result);},reject(error){rejectClaim(error);},resolveAnswer(result){resolveAnswer(result);},destroy(){cleanup();}};
}
test('Lụm ngay can be selected and its score settings are clamped',()=>{
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
test('only an active player with credit can pick during the final egg phase',()=>{
 for(const state of ['no-credit','spectator','claiming','finished','pending-skill','before-phase']) {
  const h=setup(),room=h.room();
  if(state==='no-credit')room.giftCredits=0;
  if(state==='spectator')room.players[1].spectator=true;
  if(state==='finished')room.status='FINISHED';
  if(state==='pending-skill')room.pendingSkillType='FREEZE';
  if(state==='before-phase')room.giftOpening=false;
  h.hooks.applyRoom(room,false);
  if(state==='claiming')h.vm.claimingGift=true;
  h.vm.openGiftModal();
  h.vm.claimGift({id:'gift1'});assert.equal(h.calls.length,0,state);
 }
});
test('egg mode offers only three skills and a claimed skill appears without adding prize points',async()=>{
 const h=setup('host');h.vm.hostSettings.mode='LUM_NGAY';
 assert.deepEqual(plain(h.vm.getHostSkillOptions().map(skill=>skill.type)),['FREEZE','STEAL_SCORE','INVERT']);
 const player=setup();const enabled=player.room();enabled.settings.skillsEnabled=true;player.hooks.applyRoom(enabled,false);
 assert.equal(player.vm.isGameSkillEnabled('FIRE_UP'),false);assert.equal(player.vm.isGameSkillEnabled('INVERT'),true);
 player.vm.openGiftModal();const pending=player.vm.claimGift({id:'gift1'});
 const next=player.room(1,2);next.settings.skillsEnabled=true;next.pendingSkillType='INVERT';next.pendingSkillTargetUsernames=[];
 player.resolve({rewardLevel:-2,skillType:'INVERT',points:0,room:next});await pending;
 assert.equal(player.vm.lastGiftReward.skillType,'INVERT');assert.equal(player.vm.lastGiftReward.points,0);
 assert.match(player.vm.getGiftRewardLabel(-2,'INVERT'),/^Trứng ĐẢO LỘN/);
 assert.equal(player.vm.getGiftRewardImage(-2,'INVERT'),player.vm.getGiftRewardImage(0));
 assert.equal(player.vm.skillTargetModalOpen,true);player.vm.dismissGiftReward();
 assert.equal(player.vm.giftClaimDisabled(),true);assert.equal(player.vm.giftModalOpen,true);
});
test('host egg dashboard has four columns, keeps live claim history and is host-only',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../question/views/battle_quiz_online.html'),'utf8');
 const view=fs.readFileSync(path.join(__dirname,'../question/views/battle_online_egg_host.html'),'utf8');
 assert.match(main,/ng-if="[^"]*vm\.isLumNgayMode\(\) && vm\.isHost\(\)"\s+src="'question\/views\/battle_online_egg_host/);
 assert.equal((view.match(/<section class="egg-host-column/g)||[]).length,4);
 const h=setup('host'),latest=h.room(1,5);latest.giftDrop.claims=[{id:'gift1',username:'alice',rewardLevel:0,points:10}];h.hooks.applyRoom(latest,true);
 const stale=h.room(1,4);stale.giftDrop.claims=[];h.hooks.applyRoom(stale,true);
 assert.equal(h.vm.room.giftDrop.claims.length,1);assert.equal(h.vm.room.giftDrop.claims[0].username,'alice');
});
test('host can add one minute or finish the final egg phase',async()=>{
 const h=setup('host'),first=h.vm.room.giftOpeningEndsAt;
 await h.vm.extendGiftOpening();assert.deepEqual(h.extendCalls,[['GIFTS1']]);assert.equal(h.vm.room.giftOpeningEndsAt,first+60000);
 await h.vm.finishGiftOpening();assert.deepEqual(h.finishCalls,[['GIFTS1']]);assert.equal(h.vm.room.status,'FINISHED');assert.equal(h.vm.room.giftOpening,false);
});
test('one successful claim reveals an image, updates the pool and consumes a credit once',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});h.vm.claimGift({id:'gift1'});assert.equal(h.calls.length,1);
 assert.equal(h.vm.exerciseInputDisabled(),true);
 const result=h.room(0,2);result.giftDrop.gifts=[{id:'gift2'},{id:'gift3'},{id:'gift4'}];h.resolve({room:result,rewardLevel:14,points:150});await pending;
 assert.deepEqual(plain(h.vm.lastGiftReward),{level:14,points:150});assert.equal(h.vm.room.giftCredits,0);assert.equal(h.vm.room.giftDrop.gifts.length,3);
 assert.equal(h.vm.giftClaimDisabled(),true);assert.equal(h.vm.claimingGift,false);
 assert.equal(h.vm.giftModalOpen,true);h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.lastGiftReward,null);
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
test('answers only earn credits; the modal opens when the server starts the egg phase',async()=>{
 for(const exercise of [false,true]) for(const correct of [false,true]) {
  const h=setup(),room=h.room(0);room.giftOpening=false;room.giftOpeningEndsAt=0;room.matchEndsAt=Date.now()+60000;
  room.currentQuestion={id:7,sequence:1,question:'hello',answers:[{key:'A',text:'xin chào'}]};if(exercise)room.currentQuestion.exercise={answerMode:'TEXT',type:11,items:[{id:'103',number:1}]};
  h.hooks.applyRoom(room,false);h.vm.exerciseAnswers={'103':['answer']};
  if(exercise)h.vm.submitExercise(false);else h.vm.answer(room.currentQuestion.answers[0]);
  assert.equal(h.answerCalls.length,1);const next=h.room(correct?1:0,2);next.giftOpening=false;next.giftOpeningEndsAt=0;
  next.currentQuestion={id:8,sequence:2,question:'next',answers:[{key:'A',text:'next'}]};
  h.resolveAnswer({correct,correctAnswer:'xin chào',room:next});await Promise.resolve();
  assert.equal(h.vm.giftModalOpen,false);assert.equal(h.vm.answerLocked,false);
  if(correct){const opening=h.room(1,3);h.hooks.applyRoom(opening,false);assert.equal(h.vm.giftModalOpen,true);}
 }
});
test('modal blocks question submission and keyboard shortcuts until it is dismissed',()=>{
 const h=setup(),active=h.room();active.currentQuestion={id:7,sequence:1,question:'hello',answers:[{key:'A',text:'xin chào'}]};h.hooks.applyRoom(active,false);h.vm.openGiftModal();assert.equal(h.bodyClasses.has('battle-gift-modal-open'),true);
 h.vm.answer(h.vm.room.currentQuestion.answers[0]);h.events.keydown({key:'A',preventDefault(){}});
 assert.equal(h.answerCalls.length,0);assert.equal(h.vm.exerciseInputDisabled(),true);
 h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,true,'clicking the selection backdrop does not dismiss it');
 h.events.keydown({key:'Escape',preventDefault(){}});assert.equal(h.vm.giftModalOpen,true);
 assert.equal(h.vm.room.giftCredits,1);assert.equal(h.bodyClasses.has('battle-gift-modal-open'),true);
});
test('the same final modal lets a player use every earned credit',async()=>{
 const h=setup();h.hooks.applyRoom(h.room(3),false);h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});
 h.vm.closeGiftModal();assert.equal(h.vm.giftModalOpen,true,'cannot close a request in progress');
 h.resolve({room:h.room(2,2),rewardLevel:3,points:40});await pending;
 h.vm.claimGift({id:'gift2'});assert.equal(h.calls.length,1);h.vm.dismissGiftReward();
 h.vm.claimGift({id:'gift2'});assert.equal(h.calls.length,2);assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftCredits,2);
});
test('a modal awaiting a private snapshot stays open until its three eggs are loaded',()=>{
 const h=setup(),empty=h.room();empty.giftDrop.gifts=[];h.hooks.applyRoom(empty,false);h.vm.openGiftModal();
 assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftDrop.gifts.length,0);
 h.hooks.applyRoom(h.room(1,2),false);assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftDrop.gifts.length,3);
});
test('public updates carry history without erasing or replacing a players private eggs',()=>{
 const h=setup();h.vm.openGiftModal();const generic=h.room(1,2);generic.giftDrop.gifts=null;
 generic.giftDrop.claims=[{id:'bobEgg',username:'bob',rewardLevel:0,points:10}];delete generic.giftCredits;delete generic.giftCreditVersion;
 h.hooks.applyRoom(generic,true);assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.room.giftDrop.gifts.length,3);
 assert.equal(h.vm.room.giftDrop.gifts[0].id,'gift1');assert.equal(h.vm.room.giftDrop.claims[0].username,'bob');
});
test('an earlier private claim result still updates its pool after a newer public event from another player',async()=>{
 const h=setup();h.vm.openGiftModal();const pending=h.vm.claimGift({id:'gift1'});
 const generic=h.room(1,7);generic.giftDrop.gifts=null;generic.giftDrop.poolVersion=null;generic.giftDrop.claims=[{id:'bobEgg',username:'bob'}];
 delete generic.giftCredits;delete generic.giftCreditVersion;h.hooks.applyRoom(generic,true);
 const claimed=h.room(0,5);claimed.giftDrop.poolVersion=2;claimed.giftDrop.gifts=[{id:'gift2'},{id:'gift3'},{id:'gift4'}];
 h.resolve({rewardLevel:0,points:10,room:claimed});await pending;
 assert.equal(h.vm.room.giftDrop.version,7);assert.equal(h.vm.room.giftDrop.poolVersion,2);
 assert.equal(h.vm.room.giftDrop.claims[0].username,'bob');assert.equal(h.vm.room.giftDrop.gifts.some(egg=>egg.id==='gift1'),false);
 assert.equal(h.vm.room.giftCredits,0);
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
 const h=setup(),active=h.room(0);active.giftOpening=false;active.currentQuestion={id:7,sequence:1,question:'hello',answers:[{key:'A',text:'xin chào'}]};h.hooks.applyRoom(active,false);h.vm.answer(h.vm.room.currentQuestion.answers[0]);
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
 h.vm.dismissGiftReward();assert.equal(h.vm.giftModalOpen,true);assert.equal(h.vm.lastGiftReward,null);
});
