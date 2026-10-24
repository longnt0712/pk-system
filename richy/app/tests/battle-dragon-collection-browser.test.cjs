const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const html=read('question/views/battle_quiz_online.html');
const modal=html.slice(html.indexOf('    <div class="battle-dragon-celebration-backdrop"'),html.indexOf('    <div class="battle-online-skill-modal-backdrop battle-online-password-backdrop"'));
const css=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n').replace(/<\/?style[^>]*>/g,'');
const partial=read('question/views/battle_online_dragon_collection.html');
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async()=>{browser=await playwright.chromium.launch({headless:true,executablePath});});
after(async()=>{if(browser)await browser.close();});

async function open(width){
 const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://dragon-collection.test/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname.startsWith('/assets/')){const file=path.join(app,pathname.slice(1));return fs.existsSync(file)?route.fulfill({path:file}):route.abort();}
  return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+
   'body{margin:0;background:#eef1ff;font-family:Segoe UI,Arial,sans-serif}#question{box-sizing:border-box;width:calc(100% - 24px);max-width:650px;margin:16px auto;padding:16px;background:white;border-radius:18px}.qa-answers{display:grid;grid-template-columns:1fr 1fr;gap:8px}.qa-answers button{padding:14px;border:0;border-radius:12px;background:#edf0ff;color:#182440;font-weight:bold}</style>'+
   '<main id="qa"><section id="question"><h2>Choose the correct answer.</h2><p>My sister usually ___ to school by bus.</p><div class="qa-answers"><button ng-click="answerClicks=answerClicks+1">A. goes</button><button>B. go</button><button>C. went</button><button>D. going</button></div><div ng-include="vm.dragonBallCollectionTemplate"></div></section>'+modal+'</main>'});
 });
 await page.goto('http://dragon-collection.test/');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({content:"angular.module('Hrm.Question',[]);angular.module('Hrm',['Hrm.Question']);"});
 await page.addScriptTag({content:read('question/controllers/BattleQuizOnlineController.js').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.collectionQaHooks={applyRoom,updateCountdown};')});
 await page.evaluate(partial=>{
  const Controller=angular.module('Hrm.Question')._invokeQueue.find(item=>item[2]&&item[2][0]==='BattleQuizOnlineController')[2][1];
  window.EnglishSpeech={speak(){},cancel(){}};window.APP_VERSION='qa';
  angular.module('DragonCollectionQa',['Hrm']).run(['$rootScope','$timeout','$interval','$templateCache','$q',function(scope,$timeout,$interval,cache,$q){
   cache.put('question/views/battle_online_dragon_collection.html?v=qa',partial);scope.answerClicks=0;
   const api={getRoom(){return $q.when(angular.copy(scope.vm.room));},disconnectRealtime(){}};
   scope.vm=new Controller({},scope,{go(){}},{},$interval,$timeout,{get(){return JSON.stringify({id:1,username:'alice'});}},window,{warning(){},error(){}},{},{},api);
   window.collectionQaScope=scope;
   window.collectionQaRoom=function(completed){const now=Date.now();return{code:'DRAGON',hostUsername:'host',status:'PLAYING',serverTime:now,matchEndsAt:now+180000,
    settings:{mode:'LUM_NGAY',skillsEnabled:true},giftOpening:false,giftCredits:0,giftCreditVersion:1,recentEvents:[],
    players:[{username:'alice',connected:true,spectator:false}],currentQuestion:{id:1,sequence:1,question:'My sister usually ___ to school by bus.',answers:[{key:'A',text:'goes'}]},
    giftDrop:{gameId:'qa-game',version:completed?2:1,poolVersion:1,gifts:[],claims:[],collectedDragonBalls:completed?[1,2,3,4,5,6,7]:[1,3,6],
      dragonBallCollectionCompletedAt:completed?now:0,dragonBallImmunityEndsAt:completed?now+180000:0,dragonBallCelebrationEndsAt:completed?now+5000:0,
      dragonBallScoreBefore:380,dragonBallScoreAfter:1140}};};
   window.collectionQaHooks.applyRoom(window.collectionQaRoom(false),false);
  }]);angular.bootstrap(document.getElementById('qa'),['DragonCollectionQa']);
 },partial);
 await page.locator('#question .battle-dragon-collection-grid img').first().waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('#question .battle-dragon-collection-grid img')].every(img=>img.complete&&img.naturalWidth>0));
 return{page,errors};
}

test('the collection keeps seven balls in two-three-two rows below answers without horizontal overflow',async()=>{
 for(const width of [320,390,1280]){
  const{page,errors}=await open(width);
  try{
   assert.equal(await page.locator('#question .battle-dragon-collection-grid li').count(),7);
   assert.equal(await page.locator('#question .battle-dragon-collection-grid .is-collected').count(),3);
   const layout=await page.locator('#question .battle-dragon-collection-grid').evaluate(grid=>{
    const rows={};for(const orb of grid.children){const top=Math.round(orb.getBoundingClientRect().top);rows[top]=(rows[top]||0)+1;}
    return{rows:Object.values(rows),bottom:document.querySelector('.qa-answers').getBoundingClientRect().bottom,top:grid.getBoundingClientRect().top,
      width:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.deepEqual(layout.rows,[2,3,2]);assert.ok(layout.top>=layout.bottom);assert.ok(layout.width<=layout.viewport);
   if(process.env.BATTLE_COLLECTION_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_COLLECTION_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.BATTLE_COLLECTION_SCREENSHOTS,'collection-'+width+'.png')});}
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('the real celebration ignores backdrop clicks and Escape, blocks answers, and closes automatically at five seconds',async()=>{
 const{page,errors}=await open(390);
 try{
  await page.evaluate(()=>window.collectionQaScope.$apply(()=>window.collectionQaHooks.applyRoom(window.collectionQaRoom(true),false)));
  const dialog=page.locator('#battle-dragon-celebration');await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('button').count(),0);assert.equal(await dialog.locator('.is-collected').count(),7);
  assert.match(await dialog.textContent(),/TỔNG ĐIỂM ×3/);assert.match(await dialog.textContent(),/1140/);
  await page.mouse.click(2,2);await page.keyboard.press('Escape');await page.keyboard.press('Tab');
  assert.equal(await dialog.isVisible(),true);assert.equal(await page.evaluate(()=>window.collectionQaScope.answerClicks),0);
  const bounds=await dialog.boundingBox();assert.ok(bounds.width<=390&&bounds.x>=0);
  if(process.env.BATTLE_COLLECTION_SCREENSHOTS)await page.screenshot({path:path.join(process.env.BATTLE_COLLECTION_SCREENSHOTS,'celebration-390.png')});
  await dialog.waitFor({state:'hidden',timeout:6500});
  assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('battle-dragon-celebrating')),false);
  await page.locator('.qa-answers button').first().click();assert.equal(await page.evaluate(()=>window.collectionQaScope.answerClicks),1);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('all ranking views show each players unique ball count and update live on mobile and desktop',async()=>{
 const badges=html.match(/<small class="battle-dragon-ranking-progress"[\s\S]*?<\/small>/g)||[];
 assert.equal(badges.length,3);
 const hostBadge=read('question/views/battle_online_egg_host.html').match(/<small class="battle-dragon-ranking-progress"[\s\S]*?<\/small>/)[0];
 for(const width of [320,1280]){
  const{page,errors}=await open(width);
  try{
   await page.evaluate(badges=>{
    const scope=window.collectionQaScope,injector=angular.element(document.getElementById('qa')).injector();
    let fragment='<section id="ranking-qa" style="width:calc(100% - 24px);max-width:650px;margin:12px auto">';
    badges.forEach((badge,index)=>{
     const body=index===3?'<div class="egg-host-player"><strong>{{player.username}}</strong>'+badge+'</div>':
      '<div class="battle-online-ranking-player"><div class="battle-online-ranking-copy"><strong>{{player.username}}</strong>'+badge+'</div></div>';
     fragment+='<div class="ranking-context"><div ng-repeat="player in vm.room.players track by player.username" class="'+
      (index===3?'egg-host-rank-row':'battle-online-ranking-row')+'">'+body+'<b>{{player.score}}</b></div></div>';
    });
    fragment+='</section>';document.getElementById('qa').appendChild(injector.get('$compile')(fragment)(scope)[0]);
    scope.$apply(()=>{
     const room=window.collectionQaRoom(false);room.players=[{username:'alice',score:100,spectator:false,connected:true,collectedDragonBallCount:0},
      {username:'bob',score:50,spectator:false,connected:true,collectedDragonBallCount:0}];window.collectionQaHooks.applyRoom(room,false);
    });
   },badges.concat(hostBadge));
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress').count(),8);
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress').filter({hasText:'0/7 ngọc'}).count(),8);
   await page.evaluate(()=>window.collectionQaScope.$apply(()=>{
    const room=angular.copy(window.collectionQaScope.vm.room);room.giftDrop.version++;room.serverTime=Date.now();
    room.players[0].collectedDragonBallCount=3;room.players[1].collectedDragonBallCount=6;window.collectionQaHooks.applyRoom(room,true);
   }));
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress').filter({hasText:'3/7 ngọc'}).count(),4);
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress').filter({hasText:'6/7 ngọc'}).count(),4);
   await page.evaluate(()=>window.collectionQaScope.$apply(()=>{
    const room=angular.copy(window.collectionQaScope.vm.room);room.giftDrop.version++;room.serverTime=Date.now();
    room.players[0].collectedDragonBallCount=7;window.collectionQaHooks.applyRoom(room,true);
   }));
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress.is-complete').count(),4);
   const bounds=await page.locator('#ranking-qa .battle-dragon-ranking-progress').evaluateAll(items=>items.map(item=>{
    const rect=item.getBoundingClientRect();return{left:rect.left,right:rect.right,height:rect.height,viewport:innerWidth};
   }));
   for(const rect of bounds){assert.ok(rect.height>0);assert.ok(rect.left>=0&&rect.right<=rect.viewport);}
   await page.evaluate(()=>window.collectionQaScope.$apply(()=>{
    const room=angular.copy(window.collectionQaScope.vm.room);room.settings.mode='COUNTDOWN';window.collectionQaHooks.applyRoom(room,false);
   }));
   assert.equal(await page.locator('#ranking-qa .battle-dragon-ranking-progress').count(),0);assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});
