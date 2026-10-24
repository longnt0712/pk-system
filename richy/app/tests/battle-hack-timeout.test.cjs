const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 let Controller,hooks,now=Date.now(),resolveRoom,resolveGuess;
 const calls={rooms:0,guesses:[],toasts:[]},timers=[];
 const angular={module(){return{controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},
  fromJson:JSON.parse,copy:value=>JSON.parse(JSON.stringify(value)),noop(){},element(){return{on(){},off(){}};}};
 class Clock extends Date {constructor(...args){if(args.length)super(...args);else super(now);}static now(){return now;}}
 const context=nodeVm.createContext({angular,Date:Clock,expose(value){hooks=value;}});
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');
 nodeVm.runInContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,
  'expose({applyRoom,updateCountdown,refreshPrivateRoomState});'),context);
 const timer=(fn,delay)=>{const record={fn,delay,cancelled:false};timers.push(record);return record;};
 timer.cancel=record=>{if(record)record.cancelled=true;};
 const service={getRoom(){calls.rooms++;return new Promise(resolve=>resolveRoom=resolve);},
  guessPassword(...args){calls.guesses.push(args);return new Promise(resolve=>resolveGuess=resolve);}};
 const vm=new Controller({},{$on(){},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,
  {get(){return JSON.stringify({id:1,username:'alice'});}},
  {EnglishSpeech:{speak(){},cancel(){}},APP_VERSION:'qa',location:{origin:'https://battle.test'},navigator:{},
   localStorage:{getItem(){return null;},setItem(){}},document:{body:{classList:{add(){},remove(){}}},getElementById(){return{};}}},
  {warning(...args){calls.toasts.push(args);},error(){}},{},{},service);
 function room({active=true,deadline=now+10000}={}){
  return{code:'HACK01',hostUsername:'host',status:'PLAYING',serverTime:now,matchEndsAt:now+60000,
   settings:{mode:'MONEY_BEG',skillsEnabled:true},players:[{username:'alice',connected:true,spectator:false},{username:'bob',connected:true,spectator:false}],recentEvents:[],
   pendingSkillType:active?'MONEY_BEG':null,pendingSkillTargetUsernames:[],pendingPasswordGuessTargetUsername:active?'bob':null,
   pendingPasswordGuessTargetDisplayName:active?'Bob':null,passwordGuessEndsAt:active?deadline:0,
   passwordGuessOptions:active?[{key:'A',value:'one'},{key:'B',value:'two'},{key:'C',value:'three'}]:[],
   currentQuestion:active?null:{id:7,sequence:1,question:'Next question',options:[{key:'A',text:'Next answer'}]}};
 }
 return{vm,hooks,calls,timers,room,advance(ms){now+=ms;},get now(){return now;},
  resolveRoom(value){resolveRoom(value);},resolveGuess(value){resolveGuess(value);}};
}

test('password selection shows ten seconds and public updates cannot reset its private deadline',()=>{
 const h=setup(),guess=h.room();h.hooks.applyRoom(guess,false);assert.equal(h.vm.passwordGuessSeconds(),10);
 h.advance(9000);assert.equal(h.vm.passwordGuessSeconds(),1);
 const publicRoom=h.room({active:false});h.hooks.applyRoom(publicRoom,true);
 assert.equal(h.vm.room.passwordGuessEndsAt,guess.passwordGuessEndsAt);assert.equal(h.vm.passwordGuessSeconds(),1);
 assert.equal(h.vm.room.pendingPasswordGuessTargetUsername,'bob');assert.equal(h.calls.rooms,0);
});

test('at ten seconds a hack closes once and restores the next question without repeated notifications',async()=>{
 const h=setup(),old=h.room(),stale=JSON.parse(JSON.stringify(old));h.hooks.applyRoom(old,false);h.advance(10000);
 for(let i=0;i<8;i++)h.hooks.updateCountdown();
 assert.equal(h.vm.room.pendingSkillType,null);assert.equal(h.vm.room.pendingPasswordGuessTargetUsername,null);
 assert.equal(h.vm.room.passwordGuessOptions.length,0);assert.equal(h.calls.rooms,1);assert.equal(h.calls.toasts.length,0);
 h.vm.guessPassword({key:'A'});assert.equal(h.calls.guesses.length,0);
 h.resolveRoom(h.room({active:false}));await tick();assert.equal(h.vm.room.currentQuestion.question,'Next question');
 h.hooks.applyRoom(stale,false);assert.equal(h.vm.room.currentQuestion.question,'Next question','late private state cannot revive an expired hack');
 for(let i=0;i<8;i++)h.hooks.updateCountdown();assert.equal(h.calls.rooms,1);
});

test('reload keeps the remaining server deadline and choosing before it sends the exact attempt',()=>{
 const h=setup();h.hooks.applyRoom(h.room({deadline:h.now+4000}),false);assert.equal(h.vm.passwordGuessSeconds(),4);
 const deadline=h.vm.room.passwordGuessEndsAt;h.advance(3000);h.vm.guessPassword({key:'B'});
 assert.deepEqual(Array.from(h.calls.guesses[0]),['HACK01','B',deadline]);
 assert.equal(h.vm.passwordGuessStage,'loading');h.advance(5000);h.hooks.updateCountdown();
 assert.equal(h.vm.passwordGuessStage,'loading','an accepted selection keeps its loading/result flow');assert.equal(h.calls.rooms,0);
});

test('a refresh already in flight is followed by one fresh request when the hack expires',async()=>{
 const h=setup(),old=h.room(),stale=JSON.parse(JSON.stringify(old));h.hooks.applyRoom(old,false);h.hooks.refreshPrivateRoomState();
 assert.equal(h.calls.rooms,1);h.advance(10000);h.hooks.updateCountdown();
 assert.equal(h.calls.rooms,1);h.resolveRoom(stale);await tick();assert.equal(h.calls.rooms,2);
 h.resolveRoom(h.room({active:false}));await tick();assert.equal(h.vm.room.pendingSkillType,null);
 assert.equal(h.vm.room.currentQuestion.question,'Next question');
});

test('target selection is untimed and password choice requests carry the server attempt deadline',async()=>{
 const h=setup(),target=h.room({active:false});target.currentQuestion=null;target.pendingSkillType='MONEY_BEG';target.pendingSkillTargetUsernames=['bob'];
 h.hooks.applyRoom(target,false);h.advance(20000);h.hooks.updateCountdown();
 assert.equal(h.vm.skillTargetModalOpen,true);assert.equal(h.calls.rooms,0);
 let Service;const calls=[],angular={module(){return{service(name,fn){Service=fn;return this;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/business/BattleQuizOnlineService.js'),'utf8'),{angular});
 const api=new Service({post(url,body){calls.push({url,body:JSON.parse(JSON.stringify(body))});return Promise.resolve({data:{ok:true}});}}, {},[{}],{},
  {api:{baseUrl:'https://battle.test/',apiV1Url:'api/'}});
 await api.guessPassword(' hack01 ','A',123456789);
 assert.deepEqual(calls,[{url:'https://battle.test/api/battle-online/rooms/HACK01/password-guess',body:{optionKey:'A',passwordGuessEndsAt:123456789}}]);
});
