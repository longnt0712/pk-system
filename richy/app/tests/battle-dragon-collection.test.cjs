const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(username='alice'){
 let Controller,hooks,now=Date.now(),cleanup,privateRoom=null,privateRequests=0;const events={},bodyClasses=new Set(),calls=[];
 const angular={module(){return{controller(name,fn){Controller=fn;}};},copy:clone,fromJson:JSON.parse,noop(){},
  forEach(items,fn){(items||[]).forEach(fn);},element(){return{on(name,fn){events[name]=fn;},off(){}};}};
 class Clock extends Date{constructor(...args){if(args.length)super(...args);else super(now);}static now(){return now;}}
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');
 nodeVm.runInNewContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,
  'expose({applyRoom,updateCountdown});'),{angular,Date:Clock,expose(value){hooks=value;}});
 const timer=()=>1;timer.cancel=()=>{};
 const window={Promise,APP_VERSION:'qa',location:{origin:'https://battle.test'},navigator:{},localStorage:{getItem(){return null;},setItem(){}},
  document:{body:{classList:{add(name){bodyClasses.add(name);},remove(name){bodyClasses.delete(name);}}},getElementById(){return null;}}};
 const service={getRoom(){privateRequests++;return Promise.resolve(clone(privateRoom||vm.room));},disconnectRealtime(){},claimGift(...args){calls.push(args);return new Promise(()=>{});}};
 const vm=new Controller({},{$on(name,fn){if(name==='$destroy')cleanup=fn;},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,
  {get(){return JSON.stringify({id:1,username});}},window,{error(){},warning(){}},{},{},service);
 function room({version=1,gameId='game1',collected=[],completed=0,status='PLAYING',publicView=false}={}){
  const drop={gameId,version,poolVersion:version,capacity:3,gifts:[{id:'egg1'},{id:'egg2'},{id:'egg3'}],claims:[],
   collectedDragonBalls:collected,dragonBallCollectionCompletedAt:completed,dragonBallImmunityEndsAt:completed?completed+180000:0,
   dragonBallCelebrationEndsAt:completed?completed+5000:0,dragonBallScoreBefore:completed?380:0,dragonBallScoreAfter:completed?1140:0};
  if(publicView){drop.collectedDragonBalls=null;drop.dragonBallCollectionCompletedAt=0;drop.dragonBallImmunityEndsAt=0;
   drop.dragonBallCelebrationEndsAt=0;drop.dragonBallScoreBefore=0;drop.dragonBallScoreAfter=0;delete drop.gifts;delete drop.poolVersion;}
  return{code:'DRAGON',hostUsername:'host',status,serverTime:now,matchEndsAt:now+180000,questionEndsAt:0,
   settings:{mode:'LUM_NGAY',skillsEnabled:true},giftOpening:true,giftOpeningEndsAt:now+180000,giftCredits:5,giftCreditVersion:version,
   players:[{username:'host',spectator:true},{username:'alice',spectator:false,connected:true},{username:'bob',spectator:false,connected:true}],recentEvents:[],
   currentQuestion:null,giftDrop:drop};
 }
 return{vm,hooks,calls,bodyClasses,events,room,get now(){return now;},get privateRequests(){return privateRequests;},setPrivateRoom(value){privateRoom=value;},advance(ms){now+=ms;},destroy(){cleanup();}};
}

test('all seven balls are present from the start and only collected variants light up',()=>{
 const h=setup();h.hooks.applyRoom(h.room(),false);assert.equal(h.vm.dragonBallCollection.length,7);
 assert.equal(h.vm.dragonBallCollectionCount(),0);
 for(let stars=1;stars<=7;stars++)assert.equal(h.vm.hasCollectedDragonBall(stars),false);
 h.hooks.applyRoom(h.room({version:2,collected:[1,3,6]}),false);
 assert.equal(h.vm.dragonBallCollectionCount(),3);assert.equal(h.vm.hasCollectedDragonBall(3),true);assert.equal(h.vm.hasCollectedDragonBall(2),false);
 assert.deepEqual(Array.from(h.vm.dragonBallCollection,item=>item.column),['2 / span 2','4 / span 2','1 / span 2','3 / span 2','5 / span 2','2 / span 2','4 / span 2']);
});

test('old private and public updates cannot dim collected balls or erase the once-per-match completion',()=>{
 const h=setup(),completed=h.now;h.hooks.applyRoom(h.room({version:4,collected:[1,2,3,4,5,6,7],completed}),false);
 h.hooks.applyRoom(h.room({version:2,collected:[1]}),false);assert.equal(h.vm.dragonBallCollectionCount(),7);
 h.hooks.applyRoom(h.room({version:5,publicView:true}),true);assert.equal(h.vm.dragonBallCollectionCount(),7);
 assert.equal(h.vm.room.giftDrop.dragonBallScoreAfter,1140);assert.equal(h.vm.giftSkillImmunitySeconds(),180);
 assert.equal(h.vm.dragonBallCelebrationSeconds(),5);
});

test('the celebration blocks Escape, keyboard answers and egg picks until exactly five seconds, then never reopens from stale data',()=>{
 const h=setup(),initial=h.room({version:2,collected:[1,2,3,4,5,6,7],completed:h.now}),old=clone(initial);
 h.hooks.applyRoom(initial,false);assert.equal(h.vm.isDragonBallCelebrationActive(),true);assert.equal(h.bodyClasses.has('battle-dragon-celebrating'),true);
 h.vm.openGiftModal();h.vm.giftModalOpen=true;
 let prevented=0;for(const key of ['Escape','Tab','A','1'])h.events.keydown({key,preventDefault(){prevented++;},stopPropagation(){}});
 assert.equal(prevented,4);assert.equal(h.vm.giftModalOpen,true);
 h.vm.claimGift({id:'egg1'});assert.equal(h.calls.length,0);
 h.advance(4999);h.hooks.updateCountdown();assert.equal(h.vm.isDragonBallCelebrationActive(),true);
 h.advance(1);h.hooks.updateCountdown();assert.equal(h.vm.isDragonBallCelebrationActive(),false);
 assert.equal(h.bodyClasses.has('battle-dragon-celebrating'),false);assert.equal(h.vm.giftSkillImmunitySeconds(),175);
 h.hooks.applyRoom(old,false);assert.equal(h.vm.isDragonBallCelebrationActive(),false,'old server timestamps cannot replay fireworks');
});

test('reload uses the remaining celebration time, the last-credit finish keeps it, and a new match resets the collection',()=>{
 const h=setup();h.hooks.applyRoom(h.room({collected:[1,2,3,4,5,6,7],completed:h.now-3000,status:'FINISHED'}),false);
 assert.equal(h.vm.dragonBallCelebrationSeconds(),2);
 h.hooks.applyRoom(h.room({version:2,status:'FINISHED',publicView:true}),true);assert.equal(h.vm.dragonBallCollectionCount(),7);
 h.advance(2000);h.hooks.updateCountdown();assert.equal(h.vm.dragonBallCelebrationSeconds(),0);
 h.hooks.applyRoom(h.room({gameId:'new-match'}),false);assert.equal(h.vm.dragonBallCollectionCount(),0);assert.equal(h.vm.giftSkillImmunitySeconds(),0);
 const host=setup('host');host.hooks.applyRoom(host.room({collected:[1,2,3,4,5,6,7],completed:host.now}),false);
 assert.equal(host.vm.isDragonBallCelebrationActive(),false);
});

test('shielded players are excluded from stale skill target choices, and leaving releases the body lock',()=>{
 const h=setup(),room=h.room();room.pendingSkillType='FREEZE';room.pendingSkillTargetUsernames=['bob'];room.giftOpening=false;
 room.players.find(player=>player.username==='bob').skillImmunityEndsAt=h.now+180000;
 h.hooks.applyRoom(room,false);assert.equal(h.vm.availableSkillTargets.length,0);
 const completed=h.room({version:3,collected:[1,2,3,4,5,6,7],completed:h.now});h.hooks.applyRoom(completed,false);
 assert.equal(h.bodyClasses.has('battle-dragon-celebrating'),true);h.destroy();assert.equal(h.bodyClasses.has('battle-dragon-celebrating'),false);
});

test('a public shield update fetches private completion once when it arrives before the claim response',async()=>{
 const h=setup();h.hooks.applyRoom(h.room({collected:[1,2,3,4,5,6]}),false);
 const completed=h.room({version:3,collected:[1,2,3,4,5,6,7],completed:h.now});h.setPrivateRoom(completed);
 const publicRoom=h.room({version:3,publicView:true});publicRoom.players.find(player=>player.username==='alice').skillImmunityEndsAt=h.now+180000;
 h.hooks.applyRoom(publicRoom,true);await tick();
 assert.equal(h.privateRequests,1);assert.equal(h.vm.dragonBallCollectionCount(),7);assert.equal(h.vm.isDragonBallCelebrationActive(),true);
 for(let i=0;i<8;i++)h.hooks.updateCountdown();assert.equal(h.privateRequests,1);
});
