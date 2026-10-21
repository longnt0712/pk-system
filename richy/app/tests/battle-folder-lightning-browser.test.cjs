const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const view=fs.readFileSync(path.join(app,'question/views/battle_quiz_online.html'),'utf8');
const picker=fs.readFileSync(path.join(app,'question/views/battle_online_exercise_picker.html'),'utf8');
const modal=fs.readFileSync(path.join(app,'question/views/battle_online_exercise_folder_modal.html'),'utf8');
const css=fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8')+'\n'+Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n');
const layers=view.slice(view.indexOf('    <div class="battle-lightning-effect"'),view.indexOf('    <!--',view.indexOf('    <div class="battle-lightning-effect"')));
const lobbyStart=view.indexOf('    <div class="battle-online-lobby-topic-backdrop"');
const lobbyEditor=view.slice(lobbyStart,view.indexOf('    <!--',lobbyStart));
const pickerUrl=view.match(/'([^']*battle_online_exercise_picker\.html[^']*)'/)[1];
async function open(browser,width,username='host') {
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('http://battle.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(app,'assets/images/battle-lightning.svg'))}));
 await page.setContent('<html><head><base href="http://battle.test/"><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f4f5ff}'+css+'</style></head><body><div id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm"><select aria-label="Nguồn nội dung" ng-model="vm.questionSource" ng-change="vm.changeQuestionSource()"><option value="VOCABULARY">Từ vựng</option><option value="COMPREHENSIVE">Đề tổng hợp</option></select>'+picker+layers+lobbyEditor+'</div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.evaluate(({username,modal,picker,pickerUrl})=>{
  window.APP_VERSION='qa';window.requests=[];
  angular.module('Hrm.Question',[]).value('$state',{go(){}}).value('$stateParams',{}).value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(){},success(){}}).value('blockUI',{})
   .factory('QuestionService',function($q){return {getPageForTests(dto){window.requests.push(dto);const files=[{id:100,title:'Grammar revision',folder:2},{id:101,title:'Video practice',folder:null}];return $q.when({content:files.filter(t=>dto.textSearch?t.title.toLowerCase().includes(dto.textSearch.toLowerCase()):dto.withoutTestFolder?t.folder==null:t.folder===dto.testFolderId),totalElements:1});}};})
   .factory('BattleQuizOnlineService',function($q){return {updateSettings(code,settings){window.savedSettings=settings;return $q.when(Object.assign({},window.qaScope.vm.room,{settings}));},getExerciseFolders(){return $q.when([{id:1,name:'Grade 8',parentId:null},{id:2,name:'Grammar',parentId:1},{id:3,name:'Video lessons',parentId:null}]);}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_exercise_folder_modal.html?v=qa',modal);$templateCache.put(pickerUrl,picker);});
 },{username,modal,picker,pickerUrl});
 const source=fs.readFileSync(path.join(app,'question/controllers/BattleQuizOnlineController.js'),'utf8').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.battleHooks={applyRoom};');
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();});
 return {page,errors};
}
test('folder picker fits desktop/mobile and lightning overlays show host text, a fainter player bolt and allow clicks through',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [1280,390]) {
   const {page,errors}=await open(browser,width);
   await page.getByRole('combobox',{name:'Nguồn nội dung'}).selectOption('COMPREHENSIVE');
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   await page.waitForFunction(()=>document.activeElement.id==='battle-exercise-folder-search');
   await dialog.getByRole('button',{name:'Grade 8',exact:true}).click();
   await dialog.getByRole('button',{name:'Grammar',exact:true}).last().click();
   await dialog.getByRole('button',{name:/Grammar revision/}).click();
   assert.equal(await page.evaluate(()=>window.qaScope.vm.selectedExerciseTests.length),1);
   await dialog.getByRole('searchbox').fill('Video');await dialog.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
   assert.equal(await dialog.getByRole('button',{name:'Video lessons',exact:true}).count(),1);
   assert.equal(await dialog.getByRole('button',{name:/Video practice/}).count(),1);
   const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=900);
   assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.screenshot({path:path.join(captures,'battle-folder-'+width+'.png')});
   await dialog.getByRole('button',{name:/Xong/}).focus();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Đóng bộ chọn đề');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>document.body.classList.contains('battle-exercise-picker-open')),false);
   await page.getByRole('button',{name:/Chọn đề theo thư mục/}).click();await dialog.waitFor();
   assert.equal(await page.evaluate(()=>window.qaScope.vm.selectedExerciseTests.length),1);
   await dialog.getByRole('button',{name:/Xong/}).click();
   const snapshot={code:'LIGHT1',hostUsername:'host',status:'PLAYING',serverTime:Date.now(),matchEndsAt:Date.now()+180000,
    settings:{mode:'LUM_NGAY',questionSource:'VOCABULARY',teamCount:2},players:[{username:'host',spectator:true},{username:'alice',spectator:false}],recentEvents:[],giftLightning:{startsAt:Date.now()-100,endsAt:Date.now()+30000,displayName:'Alice'}};
   await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   const effect=page.locator('.battle-lightning-effect');assert.equal(await effect.count(),1);
   const style=await effect.locator('img').evaluate(el=>({opacity:+getComputedStyle(el).opacity,animation:getComputedStyle(el).animationName}));
   assert.ok(style.opacity>=.25&&style.opacity<=.31);assert.equal(style.animation,'battle-lightning-glow');
   assert.equal(await effect.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
   assert.match(await effect.locator('.battle-lightning-caption').innerText(),/Alice nhặt được Sét may mắn![\s\S]*\+10%[\s\S]*30s/);
   assert.equal(await effect.locator('.battle-lightning-caption').evaluate(el=>+getComputedStyle(el).opacity),.45);
   assert.equal(await effect.evaluate(el=>getComputedStyle(el).position),'fixed','effect never pushes the game layout down');
   assert.equal(await page.locator('.battle-lightning-notice').count(),0,'there is no opaque top banner');
   await page.evaluate(()=>{
    const button=document.createElement('button');button.id='lightning-click-through';button.textContent='Nút bên dưới hiệu ứng';
    button.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1250;padding:20px';
    button.onclick=()=>{window.lightningClicks=(window.lightningClicks||0)+1;};document.getElementById('qa').appendChild(button);
   });
   await page.locator('#lightning-click-through').click();assert.equal(await page.evaluate(()=>window.lightningClicks),1,'host controls remain clickable through the bolt');
   await page.screenshot({path:path.join(captures,'battle-lightning-'+width+'.png')});
   snapshot.hostUsername='someone-else';await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   assert.equal(await effect.count(),1);assert.equal(await effect.locator('.battle-lightning-caption').count(),0,'players see only the bolt');
   await page.locator('#lightning-click-through').click();assert.equal(await page.evaluate(()=>window.lightningClicks),2,'player egg controls remain clickable');
   const playerOpacity=await effect.locator('img').evaluate(el=>+getComputedStyle(el).opacity);assert.ok(playerOpacity>=.05&&playerOpacity<=.11);
   await page.emulateMedia({reducedMotion:'reduce'});
   const playerStill=await effect.locator('img').evaluate(el=>+getComputedStyle(el).opacity);
   snapshot.hostUsername='host';await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   const hostStill=await effect.locator('img').evaluate(el=>+getComputedStyle(el).opacity);
   assert.ok(Math.abs(hostStill-playerStill-.2)<.0001,'player opacity is exactly 0.2 lower than host opacity');
   snapshot.hostUsername='someone-else';await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   await page.screenshot({path:path.join(captures,'battle-lightning-player-'+width+'.png')});
   snapshot.giftLightning.endsAt=Date.now()-1;snapshot.serverTime=Date.now();await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   assert.equal(await effect.count(),0,'both overlays disappear after the lightning expires');
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.equal((view.match(/battle_online_exercise_picker\.html\?[^']*folderPicker=/g)||[]).length,2,'both create and lobby use the new picker');
 } finally {await browser.close();}
});

test('folder picker stays clickable above the actual lobby editor and returns selections to save',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  for(const width of [1280,390]) {
   const {page,errors}=await open(browser,width);
   await page.evaluate(()=>window.qaScope.$apply(()=>{
    window.battleHooks.applyRoom({code:'LOBBY1',hostUsername:'host',status:'LOBBY',settings:{mode:'CLASSIC',questionSource:'COMPREHENSIVE',exerciseTestIds:[],topicNames:[]},players:[{username:'host',spectator:true}],recentEvents:[]},false);
    window.qaScope.vm.openLobbyTopicEditor();
   }));
   const dialog=page.locator('#battle-exercise-folder-modal'),lobby=page.locator('.battle-online-lobby-topic-backdrop');
   await dialog.waitFor();await lobby.waitFor();
   const folder=dialog.getByRole('button',{name:'Grade 8',exact:true});await folder.waitFor();
   assert.equal(await folder.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'folder must receive the pointer above the lobby backdrop');
   await folder.click();await dialog.getByRole('button',{name:'Grammar',exact:true}).last().click();
   await dialog.getByRole('button',{name:/Grammar revision/}).click();
   await dialog.getByRole('button',{name:/Xong/}).click();await dialog.waitFor({state:'detached'});
   assert.equal(await lobby.isVisible(),true);assert.equal(await lobby.getByText('Grammar revision',{exact:true}).count(),1);
   await lobby.getByRole('button',{name:/Chọn đề theo thư mục/}).click();await dialog.waitFor();
   await dialog.getByRole('searchbox').fill('Video');await dialog.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
   assert.equal(await dialog.getByRole('button',{name:'Video lessons',exact:true}).count(),1);
   await dialog.getByRole('button',{name:/Video practice/}).click();
   await page.screenshot({path:path.join(app,'../target/battle-folder-lobby-'+width+'.png')});
   await page.mouse.click(2,2);await dialog.waitFor({state:'detached'});assert.equal(await lobby.isVisible(),true);
   await lobby.getByRole('button',{name:'LƯU VÀ NẠP ĐỀ',exact:true}).click();await lobby.waitFor({state:'detached'});
   assert.deepEqual(await page.evaluate(()=>window.savedSettings.exerciseTestIds),[100,101]);
   assert.deepEqual(errors,[]);await page.close();
  }
 } finally {await browser.close();}
});
