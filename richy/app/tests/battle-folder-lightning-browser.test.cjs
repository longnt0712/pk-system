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
async function open(browser,width,username='host') {
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('http://battle.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(app,'assets/images/battle-lightning.svg'))}));
 await page.setContent('<html><head><base href="http://battle.test/"><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f4f5ff}'+css+'</style></head><body><div id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm"><select aria-label="Nguồn nội dung" ng-model="vm.questionSource" ng-change="vm.changeQuestionSource()"><option value="VOCABULARY">Từ vựng</option><option value="COMPREHENSIVE">Đề tổng hợp</option></select>'+picker+layers+'</div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.evaluate(({username,modal})=>{
  window.APP_VERSION='qa';window.requests=[];
  angular.module('Hrm.Question',[]).value('$state',{go(){}}).value('$stateParams',{}).value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(){},success(){}}).value('blockUI',{})
   .factory('QuestionService',function($q){return {getPageForTests(dto){window.requests.push(dto);const files=[{id:100,title:'Grammar revision',folder:2},{id:101,title:'Video practice',folder:null}];return $q.when({content:files.filter(t=>dto.textSearch?t.title.toLowerCase().includes(dto.textSearch.toLowerCase()):dto.withoutTestFolder?t.folder==null:t.folder===dto.testFolderId),totalElements:1});}};})
   .factory('BattleQuizOnlineService',function($q){return {getExerciseFolders(){return $q.when([{id:1,name:'Grade 8',parentId:null},{id:2,name:'Grammar',parentId:1},{id:3,name:'Video lessons',parentId:null}]);}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_exercise_folder_modal.html?v=qa',modal);});
 },{username,modal});
 const source=fs.readFileSync(path.join(app,'question/controllers/BattleQuizOnlineController.js'),'utf8').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.battleHooks={applyRoom};');
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();});
 return {page,errors};
}
test('folder modal browses, searches folder/file names, preserves selected tests and fits desktop/mobile; lightning stays faint and host-only',async()=>{
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
   assert.ok(style.opacity>=.06&&style.opacity<=.16);assert.equal(style.animation,'battle-lightning-glow');
   assert.equal(await effect.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
   await page.screenshot({path:path.join(captures,'battle-lightning-'+width+'.png')});
   snapshot.hostUsername='someone-else';await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false)),snapshot);
   assert.equal(await effect.count(),0);assert.equal(await page.locator('.battle-lightning-notice').count(),1);
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.equal((view.match(/battle_online_exercise_picker\.html\?[^']*folderPicker=/g)||[]).length,2,'both create and lobby use the new picker');
 } finally {await browser.close();}
});
