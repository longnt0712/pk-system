const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const controller=fs.readFileSync(path.join(__dirname,'../question/controllers/BattleQuizOnlineController.js'),'utf8');

function setup(username='host') {
 let Controller,hooks;const requests=[],timers=[],gestures={},focus=[];
 const parent={appendChild(node){node.parentNode=this;},insertBefore(node){node.parentNode=this;}},fullscreen={appendChild(node){node.parentNode=this;}};
 const layer={parentNode:parent,nextSibling:null},controls=[{focus(){focus.push('first');}},{focus(){focus.push('last');}}];
 const modal={focus(){focus.push('modal');},contains(node){return controls.includes(node);},querySelectorAll(){return controls;}};
 const document={body:{classList:{add(){},remove(){}}},fullscreenElement:null,activeElement:null,
  getElementById(id){return id==='battle-team-manager-layer'?layer:id==='battle-team-manager'?modal:null;}};
 const angular={module(){return{controller(name,fn){Controller=fn;}};},copy:value=>JSON.parse(JSON.stringify(value)),fromJson:JSON.parse,noop(){},
  forEach(items,fn){if(Array.isArray(items))items.forEach(fn);else Object.keys(items||{}).forEach(key=>fn(items[key],key));},
  element(){return{on(name,fn){gestures[name]=fn;},off(){}};}};
 nodeVm.runInNewContext(controller.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,
  'expose({applyRoom,keydownHandler,buildSettingsDto});'),{angular,expose(value){hooks=value;}});
 const timer=(fn,delay)=>{if(delay===0)timers.push(fn);return 1;};timer.cancel=()=>{};
 const service={getRoom(){return new Promise(()=>{});},setPlayerCarry(...args){return new Promise(resolve=>requests.push({kind:'carry',args,resolve}));},
  assignPlayerTeam(...args){return new Promise(resolve=>requests.push({kind:'team',args,resolve}));}};
 const vm=new Controller({},{$on(){},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username});}},
  {document,location:{origin:'https://example.test'},navigator:{},localStorage:{getItem(){return null;},setItem(){}}},
  {warning(){},error(){},success(){}},{},{},service);
 function room(status='PLAYING',mode='DEMON_DEFENSE') {const now=Date.now();return{code:'TEAMS',hostUsername:'host',status,serverTime:now,matchEndsAt:now+60000,
  settings:{mode,teamCount:2,topicIds:[],topicNames:[],guessLevels:[],doubleActionUsernames:[]},recentEvents:[],
  players:[{username:'host',spectator:true,connected:true},{username:'alice',displayName:'Alice',teamNumber:1,connected:true}],
  demonDefense:mode==='DEMON_DEFENSE'?{startedAt:now-1000,snapshotAt:now,level:2,levelTargetPoints:40,teams:[{number:1,memberCount:1,points:10,kills:4,levelPoints:5},{number:2,memberCount:1,points:0,kills:0,levelPoints:0}]}:null};}
 return{vm,hooks,requests,room,document,layer,parent,fullscreen,focus,controls,gestures,flush(){while(timers.length)timers.shift()();}};
}
const copy=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('new live players open host team management once; initial snapshots and reconnects do not',()=>{
 for(const mode of ['DEMON_DEFENSE','LUM_NGAY','CLASSIC','GUESS_WORD','MONEY_BEG','COUNTDOWN','ESCAPE_DUMB_DEMON']) {
  const h=setup(),room=h.room('PLAYING',mode);h.hooks.applyRoom(room,false);assert.equal(h.vm.teamManagerOpen,false);
  const joined=copy(room);joined.players.push({username:'bob',teamNumber:2,connected:true});h.hooks.applyRoom(joined,true);
  assert.equal(h.vm.teamManagerOpen,true,mode);assert.deepEqual(Array.from(h.vm.teamManagerNewUsernames),['bob']);
  h.vm.closeTeamManager();h.hooks.applyRoom(copy(joined),true);assert.equal(h.vm.teamManagerOpen,false);
  const disconnected=copy(joined);disconnected.players[2].connected=false;h.hooks.applyRoom(disconnected,true);
  h.hooks.applyRoom(copy(joined),true);assert.equal(h.vm.teamManagerOpen,false,'reconnecting is not a new username');
 }
 const guest=setup('alice');guest.hooks.applyRoom(guest.room(),false);const joined=guest.room();joined.players.push({username:'bob',teamNumber:2});guest.hooks.applyRoom(joined,true);assert.equal(guest.vm.teamManagerOpen,false);
});

test('host can assign teams while playing; players can self-select only in the lobby',async()=>{
 const host=setup();host.hooks.applyRoom(host.room(),false);const alice=host.vm.room.players[1];host.vm.assignPlayerTeam(alice,2);
 assert.equal(host.requests.length,1);assert.deepEqual(Array.from(host.requests[0].args),['TEAMS','alice',2]);
 const response=host.room();response.players[1].teamNumber=2;host.requests[0].resolve(response);await settle();assert.equal(host.vm.room.players[1].teamNumber,2);assert.equal(host.vm.assigningTeamUsername,'');
 const student=setup('alice');student.hooks.applyRoom(student.room(),false);student.vm.assignPlayerTeam(student.vm.room.players[1],2);assert.equal(student.requests.length,0);
 student.hooks.applyRoom(student.room('LOBBY'),false);student.vm.assignPlayerTeam(student.vm.room.players[1],2);assert.equal(student.requests.length,1);
});

test('multiple carry toggles preserve other selections and an empty server array overrides legacy values',async()=>{
 const h=setup(),room=h.room('PLAYING','LUM_NGAY');room.players.push({username:'bob',displayName:'Bob',teamNumber:2,connected:true});h.hooks.applyRoom(room,false);
 for(const username of ['alice','bob']) {const player=h.vm.room.players.find(item=>item.username===username);h.vm.toggleCarryPlayer(player);
  const req=h.requests.at(-1);assert.equal(req.kind,'carry');assert.equal(req.args[1],username);assert.equal(req.args[2],true);
  const result=copy(h.vm.room);result.settings.doubleActionUsernames.push(username);req.resolve(result);await settle();}
 assert.equal(h.vm.isDoubleActionPlayer(h.vm.room.players[1]),true);assert.equal(h.vm.isDoubleActionPlayer(h.vm.room.players[2]),true);
 h.vm.toggleCarryPlayer(h.vm.room.players[1]);const req=h.requests.at(-1);assert.equal(req.args[2],false);
 const result=copy(h.vm.room);result.settings.doubleActionUsernames=['bob'];req.resolve(result);await settle();
 assert.equal(h.vm.isDoubleActionPlayer(h.vm.room.players[1]),false);assert.equal(h.vm.isDoubleActionPlayer(h.vm.room.players[2]),true);
 result.settings.doubleActionUsernames=[];result.settings.doubleActionUsername='alice';h.hooks.applyRoom(result,false);assert.equal(h.vm.hasDoubleActionPlayers(),false);
 delete result.settings.doubleActionUsernames;h.hooks.applyRoom(result,false);assert.equal(h.vm.isDoubleActionPlayer(h.vm.room.players[1]),true);
});

test('Demon bullets use authoritative floor and carry values, and the settings payload supports many carriers',()=>{
 const h=setup(),room=h.room();room.settings.doubleActionUsernames=['alice','bob'];room.players.push({username:'bob',teamNumber:2,connected:true});h.hooks.applyRoom(room,false);
 assert.equal(h.vm.getDemonBullets({username:'alice',streak:0,demonBullets:6,demonMinimumBullets:4}),6);
 assert.equal(h.vm.getDemonBullets({username:'other',streak:0,demonMinimumBullets:3}),3);
 assert.equal(h.vm.getDemonBullets({username:'alice',streak:20}),4);
 const settings=h.hooks.buildSettingsDto();assert.deepEqual(Array.from(settings.doubleActionUsernames),['alice','bob']);assert.equal(settings.doubleActionUsername,'alice');
 assert.equal(h.vm.getTeamSummaries()[0].score,10,'team ranks use kill points rather than count');
});

test('late management responses cannot rewind live scores or replace a different room',async()=>{
 const h=setup(),room=h.room();h.hooks.applyRoom(room,false);h.vm.assignPlayerTeam(h.vm.room.players[1],2);
 const response=copy(room);response.players[1].teamNumber=2;
 const live=copy(response);live.serverTime=room.serverTime+100;live.players[1].score=27;h.hooks.applyRoom(live,true);
 h.requests[0].resolve(response);await settle();assert.equal(h.vm.room.players[1].score,27);assert.equal(h.vm.room.players[1].teamNumber,2);
 h.vm.toggleCarryPlayer(h.vm.room.players[1]);const carry=h.requests.at(-1),different=h.room();different.code='OTHER';h.hooks.applyRoom(different,false);
 carry.resolve(live);await settle();assert.equal(h.vm.room.code,'OTHER');
});

test('management follows fullscreen, restores trigger focus, and traps keyboard shortcuts',()=>{
 const h=setup();h.hooks.applyRoom(h.room(),false);h.document.fullscreenElement=h.fullscreen;
 h.vm.openTeamManager({currentTarget:{focus(){h.focus.push('trigger');}}});h.flush();assert.equal(h.layer.parentNode,h.fullscreen);assert.ok(h.focus.includes('modal'));
 let prevented=0;h.hooks.keydownHandler({key:'Tab',preventDefault(){prevented++;}});assert.equal(prevented,1);assert.equal(h.focus.at(-1),'first');
 h.hooks.keydownHandler({key:'a',preventDefault(){throw Error('ordinary answer shortcut must be ignored');}});
 h.hooks.keydownHandler({key:'Escape',preventDefault(){prevented++;}});assert.equal(h.vm.teamManagerOpen,false);assert.equal(h.layer.parentNode,h.parent);assert.equal(h.focus.at(-1),'trigger');
});

test('carry service uses a scoped atomic endpoint and encodes usernames',async()=>{
 let Service;nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/business/BattleQuizOnlineService.js'),'utf8'),
  {angular:{module(){return{service(name,fn){Service=fn;}};}}});
 let sent;const api=new Service({post(url,payload){sent={url,payload};return Promise.resolve({data:{ok:true}});}},null,null,null,{api:{baseUrl:'/api/',apiV1Url:'v1/'}});
 assert.equal((await api.setPlayerCarry('room1','a/b',true)).ok,true);assert.equal(sent.url,'/api/v1/battle-online/rooms/ROOM1/players/a%2Fb/carry');assert.equal(sent.payload.enabled,true);
});
