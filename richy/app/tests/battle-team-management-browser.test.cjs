const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const view=read('question/views/battle_quiz_online.html');
const start=view.indexOf('<!-- Battle team manager -->'),end=view.indexOf('<!-- End battle team manager -->',start);
assert.ok(start>=0&&end>start,'the actual team manager markup must be present');
const layer=view.slice(start,end);
const styles=read('assets/css/external/bootstrap.min.css')+'\n'+Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),item=>item[1]).join('\n');
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async()=>{browser=await playwright.chromium.launch({headless:true,executablePath});});
after(async()=>{if(browser)await browser.close();});

async function open(width=1280,username='host',status='PLAYING',mode='CLASSIC'){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(5000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://battle-team.test/**',route=>{
  const file=path.join(app,new URL(route.request().url()).pathname);
  return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
 });
 await page.setContent('<!doctype html><html><head><base href="http://battle-team.test/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+
  'body{font-family:Arial,sans-serif;background:#f1f3ff;margin:0}.qa-open{margin:24px;padding:12px}</style></head><body><main id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm">'+
  '<button class="qa-open" ng-if="vm.canManageTeams()" ng-click="vm.openTeamManager($event)">Xếp đội</button>'+layer+
  '<div ng-if="vm.isDemonDefenseMode()" ng-include="vm.demonArenaTemplate"></div></main><div id="qa-fullscreen"></div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular-drag-and-drop-lists.js')});
 await page.evaluate(({username,status,mode,arena,controls,hostSettings})=>{
  window.APP_VERSION='qa';window.qaRequests=[];window.qaErrors=[];
  const now=Date.now();
  window.qaServerRoom={code:'TEAMQA',hostUsername:'host',status,serverTime:now,matchEndsAt:now+600000,questionEndsAt:now+600000,
   settings:{mode,teamCount:2,doubleActionUsernames:[],doubleActionUsername:'',topicIds:[],topicNames:[],guessLevels:[]},recentEvents:[],
   players:[{username:'host',displayName:'Giáo viên',spectator:true,connected:true,host:true},
    {username:'alice',displayName:'Alice QA',realName:'Alice QA',teamNumber:1,spectator:false,connected:true,ready:true,score:0},
    {username:'bob',displayName:'Bob QA',realName:'Bob QA',teamNumber:1,spectator:false,connected:true,ready:true,score:0},
    {username:'carol',displayName:'Carol QA',realName:'Carol QA',teamNumber:2,spectator:false,connected:true,ready:true,score:0}]};
  if(mode==='DEMON_DEFENSE'){
   window.qaServerRoom.players[1].streak=0;window.qaServerRoom.players[1].demonBullets=2;window.qaServerRoom.players[1].demonMinimumBullets=2;
   window.qaServerRoom.demonDefense={startedAt:now-10000,snapshotAt:now,wave:1,level:3,levelTargetPoints:60,phase:'NORMAL',finished:false,
    teams:[{number:1,memberCount:2,kills:8,points:12,levelPoints:7,rank:1,eliminatedAt:0,nearestDemonProgress:0.3,nearestDemonSpeed:0,
     shots:[],demons:[{id:1,progress:0.3,speed:0,health:3,maxHealth:3,points:3,tough:true},{id:2,progress:0.15,speed:0,health:1,maxHealth:2,points:2,tough:true}]},
     {number:2,memberCount:1,kills:4,points:5,levelPoints:3,rank:2,eliminatedAt:0,nearestDemonProgress:0.1,nearestDemonSpeed:0,shots:[],demons:[]}]};
  }
  angular.module('Hrm.Question',['dndLists']).value('BattleSessionLogin',{bind(){}}).value('$state',{go(){}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username});}}).value('QuestionService',{}).value('blockUI',{})
   .value('toastr',{success(){},warning(){},error(...args){window.qaErrors.push(args);}})
   .factory('BattleQuizOnlineService',function($q){return {
    setPlayerCarry(code,target,enabled){window.qaRequests.push({action:'carry',target,enabled});
     const selected=window.qaServerRoom.settings.doubleActionUsernames;
     if(enabled&&!selected.includes(target))selected.push(target);if(!enabled&&selected.includes(target))selected.splice(selected.indexOf(target),1);
     window.qaServerRoom.settings.doubleActionUsername=selected[0]||'';return $q.when(angular.copy(window.qaServerRoom));},
    assignPlayerTeam(code,target,team){window.qaRequests.push({action:'team',target,team});window.qaServerRoom.players.find(player=>player.username===target).teamNumber=team;return $q.when(angular.copy(window.qaServerRoom));},
    randomizeTeams(code){window.qaRequests.push({action:'randomize',code});
     const players=window.qaServerRoom.players.filter(player=>!player.spectator),turn=window.qaRequests.filter(request=>request.action==='randomize').length;
     players.forEach((player,index)=>player.teamNumber=1+(index+turn)%window.qaServerRoom.settings.teamCount);
     window.qaServerRoom.serverTime=Date.now();return $q.when(angular.copy(window.qaServerRoom));},
    getRoom(){return $q.when(angular.copy(window.qaServerRoom));},connectRealtime(){return $q.when(true);},disconnectRealtime(){}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_demon_arena.html?v=qa',arena);$templateCache.put('question/views/battle_online_match_controls.html?matchControls=20261017_2',controls);$templateCache.put('question/views/battle_online_host_settings.html?v=qa&vocabPicker=20261028_1',hostSettings);});
 },{username,status,mode,arena:read('question/views/battle_online_demon_arena.html'),controls:read('question/views/battle_online_match_controls.html'),hostSettings:read('question/views/battle_online_host_settings.html')});
 await page.addScriptTag({content:read('question/controllers/BattleQuizOnlineController.js').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.teamQaHooks={applyRoom,applyDemonArena};')});
 await page.evaluate(()=>{
  angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.teamQaScope=angular.element(document.getElementById('qa')).scope();
  window.qaApply=function(room,generic=true){window.qaServerRoom=angular.copy(room);window.teamQaScope.$apply(()=>window.teamQaHooks.applyRoom(angular.copy(room),generic));};
  window.qaApply(window.qaServerRoom,false);
 });
 return {page,errors};
}

test('host can select several carries and assign teams in the same responsive dialog before and during play',async()=>{
 for(const status of ['LOBBY','PLAYING'])for(const width of [390,1280]){
  const {page,errors}=await open(width,'host',status);
  try{
   await page.getByRole('button',{name:'Xếp đội',exact:true}).click();
   const dialog=page.locator('#battle-team-manager');await dialog.waitFor({state:'visible'});
   const alice=dialog.locator('[dnd-draggable]').filter({hasText:'Alice'}),bob=dialog.locator('[dnd-draggable]').filter({hasText:'Bob'});
   assert.equal(await alice.count(),1,await dialog.innerText());
   await alice.locator('.battle-online-carry-toggle').click();
   await bob.locator('.battle-online-carry-toggle').click();
   assert.equal(await dialog.locator('.battle-online-carry-toggle[aria-pressed="true"]').count(),2);
   assert.equal(await alice.locator('.battle-online-carry-toggle').evaluate(button=>button.classList.contains('is-active')),true);
   await alice.locator('.battle-online-carry-toggle').click();
   assert.deepEqual(await page.evaluate(()=>window.qaServerRoom.settings.doubleActionUsernames),['bob']);
   await alice.locator('select').selectOption({label:'Đội 2'});
   await page.waitForFunction(()=>window.teamQaScope.vm.room.players.find(player=>player.username==='alice').teamNumber===2);
   assert.equal(await dialog.locator('[dnd-draggable]').filter({hasText:'Alice'}).count(),1,'a move never duplicates a player');
   const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
   assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
   if(process.env.BATTLE_TEAM_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_TEAM_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.BATTLE_TEAM_SCREENSHOTS,'team-'+status+'-'+width+'.png')});}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.qaErrors),[]);
  }finally{await page.close();}
 }
});

test('a late newcomer opens host management once, whereas initial loading and reconnection do not',async()=>{
 const {page,errors}=await open();
 try{
  const dialog=page.locator('#battle-team-manager');assert.equal(await dialog.isVisible(),false);
  await page.evaluate(()=>{const room=angular.copy(window.qaServerRoom);room.players.find(player=>player.username==='alice').connected=false;window.qaApply(room);});
  await page.evaluate(()=>{const room=angular.copy(window.qaServerRoom);room.players.find(player=>player.username==='alice').connected=true;window.qaApply(room);});
  assert.equal(await dialog.isVisible(),false);
  await page.evaluate(()=>{const room=angular.copy(window.qaServerRoom);room.players.push({username:'newbie',displayName:'Người mới',teamNumber:2,spectator:false,connected:true,ready:true});window.qaApply(room);});
  await dialog.waitFor({state:'visible'});assert.match(await dialog.textContent(),/Người mới/);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.evaluate(()=>window.qaApply(angular.copy(window.qaServerRoom)));assert.equal(await dialog.isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('the real drag directives move a player and management stays usable above a fullscreen video',async()=>{
 const {page,errors}=await open();
 try{
  await page.getByRole('button',{name:'Xếp đội',exact:true}).click();const dialog=page.locator('#battle-team-manager');await dialog.waitFor({state:'visible'});
  const alice=dialog.locator('[dnd-draggable]').filter({hasText:'Alice'});
  const teamTwo=dialog.locator('.battle-team-manager-team').filter({has:page.locator('h3').filter({hasText:/^ĐỘI 2/})}).locator('[dnd-drop]');
  await alice.dragTo(teamTwo,{sourcePosition:{x:20,y:20},targetPosition:{x:30,y:12}});
  await page.waitForFunction(()=>window.teamQaScope.vm.room.players.find(player=>player.username==='alice').teamNumber===2);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.evaluate(()=>{Object.defineProperty(document,'fullscreenElement',{configurable:true,get(){return document.getElementById('qa-fullscreen');}});});
  await page.getByRole('button',{name:'Xếp đội',exact:true}).click();await dialog.waitFor({state:'visible'});
  await page.locator('#qa-fullscreen #battle-team-manager').waitFor({state:'visible'});
  await dialog.locator('[dnd-draggable]').filter({hasText:'Bob'}).locator('.battle-online-carry-toggle').click();
  assert.deepEqual(await page.evaluate(()=>window.qaServerRoom.settings.doubleActionUsernames),['bob']);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.locator('#qa #battle-team-manager').count(),1,'closing restores the layer to the Angular page');
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('a student has no host management button or active carry controls',async()=>{
 const {page,errors}=await open(390,'alice');
 try{
  assert.equal(await page.getByRole('button',{name:'Xếp đội',exact:true}).count(),0);
  await page.evaluate(()=>window.teamQaScope.$apply(()=>window.teamQaScope.vm.openTeamManager()));
  assert.equal(await page.locator('#battle-team-manager').isVisible(),false);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('the real Demon host arena displays levels, point progress, three-hit enemies and checkpoint bullets',async()=>{
 for(const width of [390,1280]){
  const {page,errors}=await open(width,'host','PLAYING','DEMON_DEFENSE');
  try{
   const arena=page.locator('.demon-host-board');await arena.waitFor({state:'visible'});
   assert.match(await arena.locator('.demon-board-meta').textContent(),/LEVEL\s*3/);
   assert.match(await arena.locator('.demon-level-progress').first().textContent(),/7\s*\/\s*60/);
   assert.match(await arena.locator('.demon-enemy-health').first().textContent(),/♥♥♥.*3đ/);
   const alice=arena.locator('.demon-player-gun').filter({hasText:'Alice QA'});
   assert.match(await alice.textContent(),/2 viên/);assert.match(await alice.textContent(),/Giữ 2 đạn/);
   await page.evaluate(()=>{const room=angular.copy(window.qaServerRoom);room.serverTime=Date.now();room.demonDefense.snapshotAt=room.serverTime;room.demonDefense.level=4;room.demonDefense.levelTargetPoints=90;room.demonDefense.teams.forEach(team=>team.levelPoints=0);window.qaApply(room);window.teamQaScope.$apply(()=>window.teamQaHooks.applyDemonArena(room.demonDefense));});
   assert.match(await arena.locator('.demon-board-meta').textContent(),/LEVEL\s*4/);
   assert.match(await arena.locator('.demon-level-progress').first().textContent(),/0\s*\/\s*90/);
   if(process.env.BATTLE_TEAM_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_TEAM_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.BATTLE_TEAM_SCREENSHOTS,'demon-level-'+width+'.png'),fullPage:true});}
   await arena.getByRole('button',{name:'👥 Xếp đội / Gánh',exact:true}).click();await page.locator('#battle-team-manager').waitFor({state:'visible'});
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('each press of Random again updates balanced teams in the live dialog while keeping the selected carry',async()=>{
 for(const status of ['LOBBY','PLAYING'])for(const width of [390,1280]){
  const {page,errors}=await open(width,'host',status);
  try{
   await page.evaluate(()=>{const room=angular.copy(window.qaServerRoom);room.players.filter(player=>!player.spectator).forEach(player=>player.teamNumber=1);room.settings.doubleActionUsernames=['bob'];window.qaApply(room,false);});
   await page.getByRole('button',{name:'Xếp đội',exact:true}).click();const dialog=page.locator('#battle-team-manager');await dialog.waitFor({state:'visible'});
   const assignments=[];
   for(let press=0;press<3;press++){
    await dialog.locator('#battle-team-randomize').click();
    await page.waitForFunction(expected=>window.qaRequests.filter(request=>request.action==='randomize').length===expected,press+1);
    const teams=await page.evaluate(()=>window.teamQaScope.vm.room.players.filter(player=>!player.spectator).map(player=>player.teamNumber));
    const sizes=[teams.filter(team=>team===1).length,teams.filter(team=>team===2).length];assert.ok(Math.abs(sizes[0]-sizes[1])<=1);
    assignments.push(teams);if(press>0)assert.notDeepEqual(assignments[press],assignments[press-1]);
    assert.equal(await dialog.locator('.battle-online-carry-toggle[aria-pressed="true"]').count(),1);
   }
   assert.equal(await dialog.locator('[dnd-draggable]').count(),3);assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('the actual desktop host settings scroll independently, keep Start reachable and remain natural on mobile',async()=>{
 const marker=view.indexOf('HOST MODE SETTINGS'),asideStart=view.indexOf('<aside',marker),asideEnd=view.indexOf('</aside>',asideStart)+8;
 assert.ok(marker>=0&&asideStart>marker&&asideEnd>asideStart);const aside=view.slice(asideStart,asideEnd);
 for(const width of [1280,390]){
  const {page,errors}=await open(width,'host','LOBBY');
  try{
   await page.evaluate(aside=>{
    const scope=window.teamQaScope,injector=angular.element(document.getElementById('qa')).injector();
    const fragment='<div class="battle-online-layout" style="margin-top:160px"><section class="battle-online-card battle-online-main-card" style="height:1700px"><strong id="qa-left-marker">Danh sách người chơi</strong></section>'+aside+'</div>';
    scope.$apply(()=>document.getElementById('qa').appendChild(injector.get('$compile')(fragment)(scope)[0]));window.dispatchEvent(new Event('resize'));
   },aside);
   const panel=page.locator('#battle-online-lobby-settings');await panel.locator('.battle-online-start-btn').waitFor({state:'attached'});
   if(width>820){
    await page.waitForFunction(()=>{const panel=document.getElementById('battle-online-lobby-settings');return panel&&panel.clientHeight>0&&panel.scrollHeight>panel.clientHeight;});
    const bounds=await panel.boundingBox();assert.ok(bounds.y+bounds.height<=900+1,'the panel fits the currently available viewport');
    const before=await page.evaluate(()=>({page:scrollY,left:document.getElementById('qa-left-marker').getBoundingClientRect().top}));
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+100);await page.mouse.wheel(0,650);
    await page.waitForFunction(()=>document.getElementById('battle-online-lobby-settings').scrollTop>100);
    const after=await page.evaluate(()=>({page:scrollY,left:document.getElementById('qa-left-marker').getBoundingClientRect().top}));
    assert.deepEqual(after,before,'scrolling the right panel must not move the page or left column');
    await panel.evaluate(element=>element.scrollTop=element.scrollHeight);
    await panel.locator('#battle-settings-team-randomize').click();
    await page.waitForFunction(()=>window.qaRequests.filter(request=>request.action==='randomize').length===1);
    const start=await panel.locator('.battle-online-start-btn').boundingBox();assert.ok(start.y>=0&&start.y+start.height<=900+1,'Start remains reachable inside the panel');
    await page.mouse.wheel(0,650);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(()=>scrollY),before.page,'reaching the panel bottom does not scroll the page');
    if(process.env.BATTLE_TEAM_SCREENSHOTS)await page.screenshot({path:path.join(process.env.BATTLE_TEAM_SCREENSHOTS,'lobby-scroll-1280.png')});
   }else{
    const style=await panel.evaluate(element=>({position:getComputedStyle(element).position,maxHeight:getComputedStyle(element).maxHeight,overflow:getComputedStyle(element).overflowY}));
    assert.equal(style.position,'static');assert.equal(style.maxHeight,'none');assert.equal(style.overflow,'visible');
   }
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});
