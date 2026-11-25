const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const view=read('question/views/battle_quiz_online.html');
const controllerSource=read('question/controllers/BattleQuizOnlineController.js');
const pickerUrl=controllerSource.match(/vm\.vocabPickerTemplate\s*=\s*'([^']+)'/)[1];
const createStart=view.indexOf('        <div class="battle-online-card battle-online-home-card battle-online-create-card">');
const createEnd=view.indexOf('        <div class="battle-online-vs">',createStart);
const lobbyStart=view.indexOf('    <div class="battle-online-lobby-topic-backdrop"');
const lobbyEnd=view.indexOf('    <!--',lobbyStart);
assert.ok(createStart>=0&&createEnd>createStart&&lobbyStart>=0&&lobbyEnd>lobbyStart,'use the actual create form and lobby modal');
const create=view.slice(createStart,createEnd),lobby=view.slice(lobbyStart,lobbyEnd);
const styles=read('assets/css/external/bootstrap.min.css')+'\n'+read('assets/css/external/select.min.css')+'\n'+Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),match=>match[1]).join('\n');
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async()=>{browser=await playwright.chromium.launch({headless:true,executablePath});});
after(async()=>{if(browser)await browser.close();});

async function open(width=1280,lobbyMode=false,holdCategories=false){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('http://battle-topic.test/**',route=>{
  const file=path.join(app,new URL(route.request().url()).pathname);
  return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
 });
 await page.setContent('<!doctype html><html><head><base href="http://battle-topic.test/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+
  'body{font-family:Arial,sans-serif;background:#f1f3ff;margin:0}.qa-home{max-width:720px;margin:20px auto;padding:12px}</style></head><body><main id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm"><div class="qa-home" ng-if="!vm.room">'+create+'</div>'+lobby+'</main></body></html>');
 for(const script of ['angular.min.js','angular-sanitize.min.js','select.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',script)});
 await page.evaluate(({partial,pickerUrl,lobbyMode,holdCategories})=>{
  window.qaHoldCategories=holdCategories;
  window.APP_VERSION='qa';window.qaRequests=[];window.qaNotices=[];
  window.qaCategories=[{id:6,name:'Grade 6'},{id:7,name:'Grade 7'},{id:8,name:'Empty category'},{id:16,name:'Từ vựng gia đình',parentId:6}];
  window.qaTopics={1:[{id:11,name:'Tom Family',categoryId:16},{id:12,name:'House words',categoryId:16},{id:21,name:'Du lịch châu Âu',categoryId:7},{id:22,name:'Grammar review',categoryId:7}],2:[{id:91,name:'Church vocabulary',categoryId:7}]};
  window.qaServerRoom={code:'TOPICQA',hostUsername:'host',status:'LOBBY',serverTime:Date.now(),settings:{mode:'CLASSIC',questionSource:'VOCABULARY',questionOwnerUserId:1,topicIds:['11'],topicNames:['QA OWNER — Grade 6 — Tom Family'],teamCount:2,guessLevels:[]},players:[{username:'host',displayName:'Teacher QA',spectator:true,connected:true,ready:true}],recentEvents:[]};
  angular.module('Hrm.Question',['ngSanitize','ui.select']).value('BattleSessionLogin',{bind(){}})
   .value('$state',{go(name,params){window.qaNavigation={name,params};}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username:'host'});}}).value('blockUI',{start(){},stop(){}})
   .value('toastr',{success(){},warning(...args){window.qaNotices.push(args);},error(...args){window.qaNotices.push(args);}})
   .filter('propsFilter',()=>function(items,props){const query=String(props.name||'').toLowerCase();return (items||[]).filter(item=>String(item.name||'').toLowerCase().includes(query));})
   .factory('QuestionService',function($q){return {
    getPageTopicCategory(dto,page){
     window.qaRequests.push({action:'categories',page});
     if(window.qaHoldCategories&&page===1){window.qaCategoryDeferred=$q.defer();return window.qaCategoryDeferred.promise;}
     return $q.when({content:window.qaCategories.slice(page===1?0:3,page===1?3:4),totalPages:2});
    },
    getAllTopics(dto){
     window.qaRequests.push({action:'topics',userId:dto.userId});
     if(window.qaHoldOwnerId===dto.userId){window.qaTopicDeferred=$q.defer();return window.qaTopicDeferred.promise;}
     if(window.qaErrorOwnerId===dto.userId){return $q.reject(new Error('catalog failed'));}
     return $q.when(angular.copy(window.qaTopics[dto.userId]||[]));
    }
   };})
   .factory('BattleQuizOnlineService',function($q){return {
    createRoom(dto){window.qaRequests.push({action:'create',dto:angular.copy(dto)});window.qaCreateDeferred=$q.defer();return window.qaCreateDeferred.promise;},
    updateSettings(code,settings){window.qaRequests.push({action:'save',code,dto:angular.copy(settings)});window.qaSaveDeferred=$q.defer();return window.qaSaveDeferred.promise;},
    getRoom(){return $q.when(angular.copy(window.qaServerRoom));},connectRealtime(){return $q.when(true);},disconnectRealtime(){}
   };})
   .run(function($templateCache){$templateCache.put(pickerUrl,partial);});
  window.qaLobbyMode=lobbyMode;
 },{partial:read('question/views/battle_online_vocab_picker.html'),pickerUrl,lobbyMode,holdCategories});
 await page.addScriptTag({content:controllerSource.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.topicQaHooks={applyRoom};')});
 await page.evaluate(()=>{
  angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.topicQaScope=angular.element(document.getElementById('qa')).scope();
  window.topicQaScope.$apply(()=>{
   const vm=window.topicQaScope.vm;vm.topicOwners=[{id:1,name:'QA OWNER'},{id:2,name:'CHURCH'}];vm.selectedTopicOwner=vm.topicOwners[0];
   if(window.qaLobbyMode){window.topicQaHooks.applyRoom(angular.copy(window.qaServerRoom),false);vm.openLobbyTopicEditor();}
  });
 });
 await page.locator('.battle-online-vocab-picker').waitFor({state:'visible'});
 await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
 return {page,errors};
}
const picker=page=>page.locator('.battle-online-vocab-picker');
const panel=page=>picker(page).locator('.battle-online-vocab-panel');
const input=page=>picker(page).locator('input[type="search"]');
const rows=page=>picker(page).locator('.battle-online-vocab-tree > li');
const folder=(page,name)=>picker(page).getByRole('button',{name,exact:true});
const selected=page=>page.evaluate(()=>window.topicQaScope.vm.selectedTopicsToCreate.map(topic=>topic.id));

async function openTree(page) {
 await picker(page).locator('.battle-online-vocab-trigger').click();
 await panel(page).waitFor();
 await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
}

test('topics load while folders are still pending, and reopening reuses the loaded tree',async()=>{
 const {page,errors}=await open(390,false,true);
 try{
  await picker(page).locator('.battle-online-vocab-trigger').click();
  await page.waitForFunction(()=>window.qaRequests.some(request=>request.action==='topics'));
  assert.equal(await page.evaluate(()=>window.topicQaScope.vm.loadingTopics),true);
  await page.evaluate(()=>window.topicQaScope.$apply(()=>{
   window.qaHoldCategories=false;
   window.qaCategoryDeferred.resolve({content:window.qaCategories.slice(0,3),totalPages:2});
  }));
  await folder(page,'Grade 6').waitFor();
  const calls=await page.evaluate(()=>window.qaRequests.length);
  await picker(page).locator('.battle-online-vocab-trigger').click();
  await openTree(page);
  assert.equal(await page.evaluate(()=>window.qaRequests.length),calls);
  await input(page).fill('du lich');
  await picker(page).getByRole('checkbox',{name:'Du lịch châu Âu',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('creation opens a navigable folder tree, finds accentless lesson and folder names, and submits all selected topics',async()=>{
 for(const width of [1280,390]){
  const {page,errors}=await open(width);
  try{
   assert.equal(await panel(page).count(),0);
   assert.deepEqual(await page.evaluate(()=>window.qaRequests.map(request=>request.action)),[]);
   await openTree(page);
   assert.equal(await folder(page,'Grade 6').getAttribute('aria-expanded'),'false');
   assert.equal(await folder(page,'Từ vựng gia đình').count(),0);
   await folder(page,'Grade 6').click();
   await folder(page,'Từ vựng gia đình').click();
   await picker(page).getByRole('checkbox',{name:'Tom Family',exact:true}).check();
   await input(page).fill('du lich');
   await picker(page).getByRole('checkbox',{name:'Du lịch châu Âu',exact:true}).waitFor();
   assert.equal(await folder(page,'Grade 7').getAttribute('aria-expanded'),'true');
   await picker(page).getByRole('checkbox',{name:'Du lịch châu Âu',exact:true}).focus();
   await page.keyboard.press('Space');
   assert.deepEqual(await selected(page),[11,21]);
   await input(page).fill('tu vung gia dinh');
   await picker(page).getByRole('checkbox',{name:'House words',exact:true}).waitFor();
   assert.equal(await picker(page).getByRole('checkbox',{name:'Du lịch châu Âu',exact:true}).count(),0);
   assert.ok(await rows(page).count()>1);
   await page.keyboard.press('Escape');
   assert.equal(await panel(page).count(),0);
   assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('battle-online-vocab-trigger')),true);
   const bounds=await picker(page).boundingBox();
   assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1);
   await page.getByRole('button',{name:/TẠO PHÒNG VỚI 2 BÀI/}).click();
   const payload=await page.evaluate(()=>window.qaRequests.find(request=>request.action==='create').dto);
   assert.deepEqual(payload.topicIds,[11,21]);
   assert.deepEqual(payload.topicNames,['QA OWNER — Từ vựng gia đình — Tom Family','QA OWNER — Grade 7 — Du lịch châu Âu']);
   await page.evaluate(()=>window.topicQaScope.$apply(()=>window.qaCreateDeferred.resolve({code:'CREATED'})));
   await page.waitForFunction(()=>window.qaNavigation&&window.qaNavigation.params.roomCode==='CREATED');
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('the lobby picker keeps an existing string ID checked and saves additional lessons',async()=>{
 for(const width of [1280,390]){
  const {page,errors}=await open(width,true);
  try{
   const modal=page.locator('.battle-online-lobby-topic-backdrop');
   await modal.waitFor();
   await openTree(page);
   await input(page).fill('tom family');
   const existing=picker(page).getByRole('checkbox',{name:'Tom Family',exact:true});
   await existing.waitFor();
   assert.equal(await existing.isChecked(),true);
   await input(page).fill('house');
   await picker(page).getByRole('checkbox',{name:'House words',exact:true}).check();
   assert.deepEqual(await selected(page),['11',12]);
   await modal.getByRole('button',{name:/LƯU VÀ NẠP LẠI BÀI/}).click();
   assert.equal(await input(page).isDisabled(),true);
   const request=await page.evaluate(()=>window.qaRequests.find(request=>request.action==='save'));
   assert.equal(request.code,'TOPICQA');
   assert.deepEqual(request.dto.topicIds,['11',12]);
   await page.evaluate(()=>window.topicQaScope.$apply(()=>{window.qaServerRoom.settings=window.qaRequests.find(request=>request.action==='save').dto;window.qaSaveDeferred.resolve(angular.copy(window.qaServerRoom));}));
   await modal.waitFor({state:'detached'});
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('rapid source changes discard the old catalog response and allow retry after an error',async()=>{
 const {page,errors}=await open(390);
 try{
  await openTree(page);
  await input(page).fill('tom');
  await picker(page).getByRole('checkbox',{name:'Tom Family',exact:true}).check();
  await page.evaluate(()=>window.topicQaScope.$apply(()=>{
   const vm=window.topicQaScope.vm;window.qaHoldOwnerId=2;
   vm.selectedTopicOwner=vm.topicOwners[1];vm.chooseTopicOwner();
  }));
  await page.waitForFunction(()=>!!window.qaTopicDeferred);
  await page.evaluate(()=>window.topicQaScope.$apply(()=>{
   const vm=window.topicQaScope.vm;window.qaErrorOwnerId=1;
   vm.selectedTopicOwner=vm.topicOwners[0];vm.chooseTopicOwner();
  }));
  await picker(page).locator('.battle-online-topic-load-error').waitFor();
  await page.evaluate(()=>window.topicQaScope.$apply(()=>{
   window.qaErrorOwnerId=null;window.qaTopicDeferred.resolve(angular.copy(window.qaTopics[2]));
  }));
  await picker(page).locator('.battle-online-topic-load-error').click();
  await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
  await input(page).fill('tom');
  await picker(page).getByRole('checkbox',{name:'Tom Family',exact:true}).waitFor();
  assert.deepEqual(await selected(page),[]);
  assert.equal(await picker(page).getByRole('checkbox',{name:'Church vocabulary',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
