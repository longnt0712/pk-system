const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const header=read('common/views/navs/header-hoz.html'),navStart=header.indexOf('                <!-- BATTLE MODES -->'),navEnd=header.indexOf('                <li class="dropdown test-room-nav"',navStart);
assert.ok(navStart>=0&&navEnd>navStart,'compile the actual Battle navigation fragment');
const nav=header.slice(navStart,navEnd);
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;before(async()=>{browser=await playwright.chromium.launch({headless:true,executablePath});});after(async()=>{if(browser)await browser.close();});
async function open(width=1280,options={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.setDefaultTimeout(5000);
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+read('assets/css/external/bootstrap.min.css')+'body{font-family:Arial,sans-serif;background:#f4f5ff;margin:0;padding:12px}.qa-nav{list-style:none;padding:0}.qa-nav .dropdown-menu{display:block;position:static;float:none;box-shadow:none;border:0;background:none}.qa-nav .dropdown-menu>li{display:inline-block}</style></head><body><main id="qa"><ul class="qa-nav">'+nav+'</ul><div ng-controller="BattleOnlineAdminController as vm">'+read('question/views/battle_online_admin.html')+'</div></main></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.evaluate(options=>{
  window.qaRequests=[];window.qaErrors=[];window.qaSettings=Object.assign({isAdmin:true,isViewer:false,ieltsRoom:true,permissionsLoaded:true},options);
  const now=Date.now();window.qaRooms=[{code:'PLAY01',status:'PLAYING',mode:'CLASSIC',hostUsername:'teacher',hostDisplayName:'Cô Lan',topicName:'Family words – A long lesson about family members and the different activities they do every morning',createdAt:now-300000,startedAt:now-180000,matchEndsAt:now+180000,playerCount:5,connectedPlayerCount:4,spectatorCount:1},
   {code:'WAIT01',status:'LOBBY',mode:'LUM_NGAY',hostUsername:'host2',hostDisplayName:'Thầy Minh',topicName:'Travel plans',createdAt:now-120000,playerCount:2,connectedPlayerCount:2,spectatorCount:1},
   {code:'EGGS01',status:'PLAYING',mode:'LUM_NGAY',giftOpening:true,hostUsername:'host3',hostDisplayName:'Cô Mai',topicName:'Grammar review',createdAt:now-900000,startedAt:now-600000,matchEndsAt:now+60000,playerCount:6,connectedPlayerCount:5,spectatorCount:1}];
  const poll=function(fn,delay){window.qaPoll=fn;window.qaPollDelay=delay;return 1;};poll.cancel=()=>{window.qaPollCancelled=true;};
  angular.module('Hrm.Question',[]).value('settings',window.qaSettings).value('$interval',poll)
   .value('$cookies',{get(){return JSON.stringify({roles:[{name:options.cookieAdmin?'ROLE_ADMIN':'ROLE_USER'}]});}})
   .value('toastr',{success(...args){window.qaSuccess=args;}})
   .factory('BattleQuizOnlineService',function($q){return {
    getAdminRooms(){window.qaRequests.push({type:'list'});if(window.qaHoldList){window.qaList=$q.defer();return window.qaList.promise;}return $q.when(angular.copy(window.qaRooms));},
    terminateAdminRoom(code){window.qaRequests.push({type:'terminate',code});window.qaTermination=$q.defer();return window.qaTermination.promise;}
   };}).run(function($rootScope,settings){$rootScope.settings=settings;$rootScope.$state={includes(name){return name==='application.battle_online_admin';}};window.qaRoot=$rootScope;});
 },options);
 await page.addScriptTag({path:path.join(app,'question/controllers/BattleOnlineAdminController.js')});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.querySelector('[ng-controller]')).scope();});
 return {page,errors};
}
async function capture(page,name){if(process.env.BATTLE_ADMIN_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_ADMIN_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.BATTLE_ADMIN_SCREENSHOTS,name+'.png')});}}

test('admin confirms termination explicitly, can retry a failure and keeps the monitor usable on desktop/mobile',async()=>{
 for(const width of [1280,390]){
  const {page,errors}=await open(width);
  try{
   const navLink=page.locator('a[ui-sref="application.battle_online_admin"]');assert.equal(await navLink.count(),1);assert.equal(await navLink.evaluate(element=>element.parentElement.classList.contains('active')),true);
   assert.equal(await page.locator('.battle-modes-nav').evaluate(element=>element.classList.contains('is-route-active')),true);
   assert.equal(await page.locator('.battle-admin-table tbody tr').count(),2,'default filter shows playing matches');assert.equal(await page.getByText('Bóc trứng cuối',{exact:true}).count(),1);
   const pageBounds=await page.locator('.battle-admin-panel').boundingBox();assert.ok(pageBounds.x>=0&&pageBounds.x+pageBounds.width<=width+1);assert.equal(await page.locator('.battle-admin-panel').evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
   await capture(page,'battle-admin-rooms-'+width);
   const terminate=page.getByRole('button',{name:'Chấm dứt phòng PLAY01',exact:true});await terminate.click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.innerText(),/PLAY01[\s\S]*Classic[\s\S]*Cô Lan/);
   assert.equal(await page.evaluate(()=>window.qaRequests.filter(request=>request.type==='terminate').length),0,'opening confirmation never calls the destructive API');
   await page.waitForFunction(()=>document.activeElement.id==='battle-admin-cancel-terminate');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Xác nhận chấm dứt');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'battle-admin-cancel-terminate');
   const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=900);await capture(page,'battle-admin-confirm-'+width);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Chấm dứt phòng PLAY01');
   await terminate.click();await dialog.getByRole('button',{name:'Xác nhận chấm dứt',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.qaRequests.filter(request=>request.type==='terminate').length),1);assert.equal(await dialog.getByRole('button',{name:'Hủy',exact:true}).isDisabled(),true);
   await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true,'pending termination cannot be dismissed');
   await page.evaluate(()=>window.qaRoot.$apply(()=>window.qaTermination.reject({status:409,data:{message:'Phòng vừa thay đổi, thử lại nhé.'}})));
   await dialog.getByText('Phòng vừa thay đổi, thử lại nhé.',{exact:true}).waitFor();assert.equal(await page.locator('.battle-admin-table tbody tr').count(),2);
   await dialog.getByRole('button',{name:'Xác nhận chấm dứt',exact:true}).click();await page.evaluate(()=>window.qaRoot.$apply(()=>window.qaTermination.resolve({code:'PLAY01',status:'FINISHED'})));
   await dialog.waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'Chấm dứt phòng PLAY01',exact:true}).count(),0);assert.equal(await page.locator('.battle-admin-table tbody tr').count(),1);assert.match(await page.evaluate(()=>window.qaSuccess[0]),/PLAY01/);
   await page.locator('.battle-admin-status-filter select').selectOption('LOBBY');assert.equal(await page.locator('.battle-admin-table tbody tr').count(),1);assert.match(await page.locator('.battle-admin-table tbody').innerText(),/WAIT01/);
   await page.getByRole('searchbox').fill('missing room');await page.getByText('Không có phòng phù hợp với bộ lọc.',{exact:true}).waitFor();
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('viewer and user cannot see the admin Battle menu or issue monitor requests',async()=>{
 for(const isViewer of [true,false]){
  const {page,errors}=await open(390,{isAdmin:false,isViewer});
  try{
   await page.getByRole('heading',{name:'Không có quyền truy cập'}).waitFor();assert.equal(await page.locator('a[ui-sref="application.battle_online_admin"]').count(),0);assert.equal(await page.locator('.battle-admin-panel').count(),0);assert.equal(await page.evaluate(()=>window.qaRequests.length),0);assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('a direct URL waits for restored permissions, refreshes without overlap and clears cached rooms after HTTP403',async()=>{
 const {page,errors}=await open(1280,{isAdmin:false,isViewer:false,permissionsLoaded:false,cookieAdmin:true});
 try{
  await page.getByText('Đang xác nhận quyền quản trị...', {exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.qaRequests.length),0);
  await page.evaluate(()=>window.qaRoot.$apply(()=>{window.qaSettings.isAdmin=true;window.qaSettings.permissionsLoaded=true;window.qaRoot.$broadcast('permissionsLoaded');}));
  await page.locator('.battle-admin-table').waitFor();assert.equal(await page.evaluate(()=>window.qaPollDelay),5000);
  await page.evaluate(()=>window.qaRoot.$apply(()=>{window.qaHoldList=true;window.qaPoll();window.qaPoll();}));assert.equal(await page.evaluate(()=>window.qaRequests.filter(request=>request.type==='list').length),2);
  await page.evaluate(()=>window.qaRoot.$apply(()=>window.qaList.reject({status:403})));
  await page.getByRole('heading',{name:'Không có quyền truy cập'}).waitFor();assert.equal(await page.locator('.battle-admin-table').count(),0);assert.equal(await page.evaluate(()=>window.qaPollCancelled),true);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
