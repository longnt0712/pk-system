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
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async()=>{browser=await playwright.chromium.launch({headless:true,executablePath});});
after(async()=>{if(browser)await browser.close();});

async function open(width=1280,lobbyMode=false){
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
 await page.evaluate(({partial,pickerUrl,lobbyMode})=>{
  window.APP_VERSION='qa';window.qaRequests=[];window.qaNotices=[];
  window.qaCategories=[{id:6,name:'Grade 6'},{id:7,name:'Grade 7'},{id:8,name:'Empty category'}];
  window.qaTopics={6:[{id:11,name:'Tom Family'},{id:12,name:'House words'},{id:13,name:'A long vocabulary lesson about family members and their daily routines'}],7:[{id:21,name:'Travel plans'},{id:22,name:'Grammar review'}],8:[]};
  window.qaServerRoom={code:'TOPICQA',hostUsername:'host',status:'LOBBY',serverTime:Date.now(),settings:{mode:'CLASSIC',questionSource:'VOCABULARY',questionOwnerUserId:1,topicIds:['11'],topicNames:['QA OWNER — Grade 6 — Tom Family'],teamCount:2,guessLevels:[]},players:[{username:'host',displayName:'Teacher QA',spectator:true,connected:true,ready:true}],recentEvents:[]};
  angular.module('Hrm.Question',['ngSanitize','ui.select']).value('BattleSessionLogin',{bind(){}})
   .value('$state',{go(name,params){window.qaNavigation={name,params};}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username:'host'});}}).value('blockUI',{start(){},stop(){}})
   .value('toastr',{success(){},warning(...args){window.qaNotices.push(args);},error(...args){window.qaNotices.push(args);}})
   .filter('propsFilter',()=>function(items,props){const query=String(props.name||'').toLowerCase();return (items||[]).filter(item=>String(item.name||'').toLowerCase().includes(query));})
   .factory('QuestionService',function($q){return {getTopicsForGames(dto){
    const result=angular.copy({content:window.qaTopics[dto.topicCategory.id]||[]});window.qaRequests.push({action:'topics',dto:angular.copy(dto)});
    if(window.qaHoldTopics){window.qaTopicDeferred=$q.defer();window.qaTopicResult=result;return window.qaTopicDeferred.promise;}
    return $q.when(result);
   }};})
   .factory('BattleQuizOnlineService',function($q){return {
    createRoom(dto){window.qaRequests.push({action:'create',dto:angular.copy(dto)});window.qaCreateDeferred=$q.defer();return window.qaCreateDeferred.promise;},
    updateSettings(code,settings){window.qaRequests.push({action:'save',code,dto:angular.copy(settings)});window.qaSaveDeferred=$q.defer();return window.qaSaveDeferred.promise;},
    getRoom(){return $q.when(angular.copy(window.qaServerRoom));},connectRealtime(){return $q.when(true);},disconnectRealtime(){}
   };})
   .run(function($templateCache){$templateCache.put(pickerUrl,partial);});
  window.qaLobbyMode=lobbyMode;
 },{partial:read('question/views/battle_online_vocab_picker.html'),pickerUrl,lobbyMode});
 await page.addScriptTag({content:controllerSource.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.topicQaHooks={applyRoom};')});
 await page.evaluate(()=>{
  angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.topicQaScope=angular.element(document.getElementById('qa')).scope();
  window.topicQaScope.$apply(()=>{
   const vm=window.topicQaScope.vm;vm.topicOwners=[{id:1,name:'QA OWNER'}];vm.selectedTopicOwner=vm.topicOwners[0];vm.searchTopicDto.userId=1;
   vm.topicCategories=angular.copy(window.qaCategories);vm.searchTopicDto.topicCategory=vm.topicCategories[0];
   if(window.qaLobbyMode){window.topicQaHooks.applyRoom(angular.copy(window.qaServerRoom),false);vm.openLobbyTopicEditor();}else vm.getTopics();
  });
 });
 await page.locator('.battle-online-vocab-select').waitFor({state:'visible'});
 await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
 return {page,errors};
}
const picker=page=>page.locator('.battle-online-vocab-select');
const input=page=>picker(page).locator('input.ui-select-search');
const choices=page=>page.locator('.ui-select-choices-row-inner:visible');
const selected=page=>page.evaluate(()=>window.topicQaScope.vm.selectedTopicsToCreate.map(topic=>({id:topic.id,name:topic.name,categoryName:topic.categoryName,displayName:topic.displayName})));
async function openChoices(page){await input(page).click();await page.waitForFunction(()=>!!document.querySelector('.battle-online-vocab-select.open'));}
async function choose(page,name){await choices(page).filter({hasText:name}).click();}
async function closeChoices(page){await input(page).focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.battle-online-vocab-select.open'));}
async function changeCategory(page,id,hold=false){
 await page.evaluate(({id,hold})=>window.topicQaScope.$apply(()=>{window.qaHoldTopics=hold;const vm=window.topicQaScope.vm;vm.searchTopicDto.topicCategory=vm.topicCategories.find(category=>category.id===id);vm.getTopics();}),{id,hold});
 if(!hold)await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
}
async function capture(page,name){if(process.env.BATTLE_TOPIC_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_TOPIC_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.BATTLE_TOPIC_SCREENSHOTS,name+'.png')});}}

test('create form selects immediately, hides picked topics and supports name search, keyboard and chip removal on desktop/mobile',async()=>{
 for(const width of [1280,390]){
  const {page,errors}=await open(width);
  try{
   assert.equal(await page.getByRole('button',{name:/THÊM BÀI/}).count(),0,'no second add action is needed');
   await openChoices(page);assert.equal(await choices(page).count(),3);
   await choose(page,'Tom Family');assert.deepEqual((await selected(page)).map(topic=>topic.id),[11]);
   assert.equal(await picker(page).locator('.ui-select-match-item').count(),1);
   assert.equal(await choices(page).filter({hasText:'Tom Family'}).count(),0,'picked topic is removed from the dropdown');
   assert.equal(await choices(page).count(),2,'dropdown stays open for the next selection');
   await input(page).fill('Grade 6');assert.equal(await choices(page).count(),0,'search matches lesson names rather than category metadata');
   await input(page).fill('House');assert.equal(await choices(page).count(),1);await page.keyboard.press('Enter');
   await page.waitForFunction(()=>window.topicQaScope.vm.selectedTopicsToCreate.length===2);
   assert.deepEqual((await selected(page)).map(topic=>topic.id),[11,12]);
   await input(page).fill('');await picker(page).locator('.ui-select-match-item').filter({hasText:'Tom Family'}).locator('.ui-select-match-close').click();
   assert.deepEqual((await selected(page)).map(topic=>topic.id),[12]);
   await openChoices(page);assert.equal(await choices(page).filter({hasText:'Tom Family'}).count(),1,'removed topic returns');
   await choose(page,'Tom Family');await choose(page,'A long vocabulary lesson');
   const bounds=await picker(page).boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,'multiple control fits the viewport');
   assert.equal(await picker(page).evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'long chips do not overflow');
   await capture(page,'battle-topic-create-'+width);
   await closeChoices(page);await changeCategory(page,7);await openChoices(page);
   assert.equal(await picker(page).locator('.ui-select-match-item').count(),3,'category changes keep previous selections');
   await choose(page,'Travel plans');
   const topics=await selected(page);assert.deepEqual(topics.map(topic=>topic.id),[12,11,13,21]);
   assert.equal(topics[0].categoryName,'Grade 6');assert.equal(topics[3].categoryName,'Grade 7');
   await closeChoices(page);await capture(page,'battle-topic-create-selected-'+width);await page.getByRole('button',{name:/TẠO PHÒNG VỚI 4 BÀI/}).click();
   assert.equal(await input(page).isDisabled(),true,'creating a room locks the picker');
   const payload=await page.evaluate(()=>window.qaRequests.find(request=>request.action==='create').dto);
   assert.deepEqual(payload.topicIds,[12,11,13,21]);assert.equal(payload.questionOwnerUserId,1);
   assert.deepEqual(payload.topicNames,topics.map(topic=>topic.displayName));
   await page.evaluate(()=>window.topicQaScope.$apply(()=>window.qaCreateDeferred.resolve({code:'CREATED'})));
   await page.waitForFunction(()=>window.qaNavigation&&window.qaNavigation.params.roomCode==='CREATED');
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.qaNotices),[]);
  }finally{await page.close();}
 }
});

test('lobby picker hides existing string-ID topics and remains clickable above the modal before saving on desktop/mobile',async()=>{
 for(const width of [1280,390]){
  const {page,errors}=await open(width,true);
  try{
   const modal=page.locator('.battle-online-lobby-topic-backdrop');await modal.waitFor({state:'visible'});
   assert.equal(await picker(page).locator('.ui-select-match-item').count(),1);
   await openChoices(page);
   assert.equal(await choices(page).filter({hasText:'Tom Family'}).count(),0,'numeric loaded ID and string selected ID represent the same topic');
   const house=choices(page).filter({hasText:'House words'});
   assert.equal(await house.evaluate(element=>{const rect=element.getBoundingClientRect();return element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));}),true,'the real dropdown receives pointers above the lobby modal');
   await house.click();assert.deepEqual((await selected(page)).map(topic=>topic.id),['11',12]);
   await capture(page,'battle-topic-lobby-'+width);
   await page.locator('.battle-online-vocab-heading label').click();await page.waitForFunction(()=>!document.querySelector('.battle-online-vocab-select.open'));
   assert.equal(await modal.isVisible(),true,'outside click dismisses choices and keeps the editor open');
   await openChoices(page);await closeChoices(page);
   await modal.getByRole('button',{name:/LƯU VÀ NẠP LẠI BÀI/}).click();
   assert.equal(await input(page).isDisabled(),true,'saving locks further additions and removals');
   const request=await page.evaluate(()=>window.qaRequests.find(request=>request.action==='save'));
   assert.equal(request.code,'TOPICQA');assert.deepEqual(request.dto.topicIds,['11',12]);
   assert.deepEqual(request.dto.topicNames,['QA OWNER — Grade 6 — Tom Family','QA OWNER — Grade 6 — House words']);
   await page.evaluate(()=>window.topicQaScope.$apply(()=>{window.qaServerRoom.settings=window.qaRequests.find(request=>request.action==='save').dto;window.qaSaveDeferred.resolve(angular.copy(window.qaServerRoom));}));
   await modal.waitFor({state:'detached'});
   await page.evaluate(()=>window.topicQaScope.$apply(()=>window.topicQaScope.vm.openLobbyTopicEditor()));
   await modal.waitFor({state:'visible'});await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);
   await capture(page,'battle-topic-lobby-selected-'+width);
   await modal.click({position:{x:2,y:2}});await modal.waitFor({state:'detached'});
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.qaNotices),[]);
  }finally{await page.close();}
 }
});

test('loading locks the picker without losing chips and an empty category still allows removing an old selection',async()=>{
 const {page,errors}=await open(390);
 try{
  await openChoices(page);await choose(page,'Tom Family');await closeChoices(page);
  await changeCategory(page,7,true);assert.equal(await input(page).isDisabled(),true);assert.equal(await picker(page).locator('.ui-select-match-item').count(),1);
  await page.evaluate(()=>window.topicQaScope.$apply(()=>{window.qaHoldTopics=false;window.qaTopicDeferred.resolve(window.qaTopicResult);}));
  await page.waitForFunction(()=>!window.topicQaScope.vm.loadingTopics);assert.equal(await input(page).isDisabled(),false);
  await openChoices(page);await choose(page,'Travel plans');await closeChoices(page);await changeCategory(page,8);
  assert.equal(await input(page).isDisabled(),false,'an empty category must not trap existing chips');
  await picker(page).locator('.ui-select-match-item').filter({hasText:'Tom Family'}).locator('.ui-select-match-close').click();
  assert.deepEqual((await selected(page)).map(topic=>topic.id),[21]);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
