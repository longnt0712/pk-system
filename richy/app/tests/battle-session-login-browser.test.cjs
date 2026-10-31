const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
function room(username='alice',sequence=1){const now=Date.now();return {code:'GAME1',hostUsername:username==='host'?'host':'teacher',status:'PLAYING',serverTime:now,
 questionEndsAt:now+120000,matchEndsAt:now+180000,settings:{mode:'CLASSIC',questionSource:'COMPREHENSIVE',exerciseTestIds:[100],teamCount:2},recentEvents:[],
 players:[{username,spectator:username==='host',connected:true,teamNumber:1,score:17}],currentQuestion:{id:102,sequence,answers:[],exercise:{answerMode:'TEXT',type:11,items:[{id:'q1',number:1}]}}};}
async function open(browser,width,username='alice'){
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[],requests=[];
 page.setDefaultTimeout(10000);
 const fixture={invalid:false,roomStatus:200,latest:room(username)};page.on('pageerror',error=>errors.push(String(error)));
 const user={id:1,username,roles:[{name:username==='host'?'ROLE_ADMIN':'ROLE_VIEWER'}]};
 await page.route('http://battle.test/**',async route=>{
  const request=route.request(),url=new URL(request.url()),pathname=url.pathname;
  if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<html></html>'});
  if(pathname.startsWith('/service/')){
   const authorization=request.headers().authorization;requests.push({pathname,authorization});
   const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(pathname.endsWith('/oauth/token')){
    const body=new URLSearchParams(request.postData());
    if(body.get('grant_type')==='refresh_token'||body.get('password')!=='correct-password')return json(400,{error:'invalid_grant'});
    return json(200,{access_token:'fresh',refresh_token:'fresh-refresh',token_type:'bearer',expires_in:86400});
   }
   if(pathname.endsWith('/users/getCurrentUser'))return json(200,user);
   if(pathname.endsWith('/battle-online/rooms/GAME1')){
    if(fixture.invalid&&authorization!=='Bearer fresh')return json(401,{error:'invalid_token'});
    return json(fixture.roomStatus,fixture.roomStatus===200?fixture.latest:{message:'Phòng không còn tồn tại.'});
   }
   return json(200,{});
  }
  const file=path.join(app,pathname.slice(1));
  return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
 });
 await page.goto('http://battle.test/battle-quiz-online/GAME1');
 await page.setContent('<html><head><base href="http://battle.test/"><meta charset="utf-8"><style>'+read('assets/css/external/bootstrap.min.css')+'\n'+read('question/battle-session-login.css')+'</style></head><body><div id="qa" ng-controller="BattleQuizOnlineController as vm"><h1>Battle {{vm.room.code}}</h1><input aria-label="Câu trả lời đang nhập" ng-model="vm.exerciseAnswers.q1[0]"><button ng-click="vm.submitExercise(false)" ng-disabled="vm.exerciseInputDisabled()">Gửi đáp án</button><div style="position:fixed;inset:0;background:rgba(20,20,40,.1);z-index:31000;pointer-events:none">Lớp modal của Battle</div></div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/ui-bootstrap-tpls.min.js')});
 await page.evaluate(({user})=>{
  angular.module('Hrm.Question',[]);const module=angular.module('Hrm',['ui.bootstrap','Hrm.Question']);
  window.originalAngularModule=angular.module;angular.module=function(name,deps){return name==='Hrm'&&deps?window.originalAngularModule('Hrm'):window.originalAngularModule.apply(this,arguments);};
  window.APP_VERSION='test';window.navigations=[];window.connections=0;window.disconnects=0;window.joinCalls=0;
  const cookies={token:{access_token:'old',refresh_token:'old-refresh',token_type:'bearer',session_expires_at:Date.now()+86400000},'education.user':user};
  const token={getToken:()=>cookies.token,getAccessToken:()=>cookies.token&&cookies.token.access_token,getRefreshToken:()=>cookies.token&&cookies.token.refresh_token,
   getAuthorizationHeader(){return cookies.token?'Bearer '+cookies.token.access_token:undefined;},setToken(value){cookies.token={...value,session_expires_at:Date.now()+86400000};},removeToken(){delete cookies.token;},isPersistentSession:()=>false};
  module.value('OAuthToken',token).value('OAuth',{isAuthenticated:()=>!!cookies.token})
   .value('$cookies',{getObject:name=>cookies[name],get:name=>cookies[name]&&JSON.stringify(cookies[name]),putObject(name,value){cookies[name]=value;},remove(name){delete cookies[name];}})
   .value('$state',{current:{name:'application.battle_quiz_online_room'},params:{roomCode:'GAME1'},go(name){window.navigations.push(name);}})
   .value('$stateParams',{}).value('settings',{api:{baseUrl:'http://battle.test/service/'},layout:{}})
   .value('toastr',{info(){},warning(){},error(){},success(){}}).value('blockUI',{start(){},stop(){}})
   .value('Idle',{}).value('Keepalive',{}).value('QuestionService',{})
   .factory('BattleQuizOnlineService',function($http,$q){return {getRoom(code){return $http.get('http://battle.test/service/api/battle-online/rooms/'+code).then(response=>response.data);},
    connectRealtime(code,onRoom,onConnected){window.connections++;onConnected(true);return $q.when(true);},disconnectRealtime(){window.disconnects++;},joinRoom(){window.joinCalls++;return $q.reject({status:500});}};});
 },{user});
 await page.addScriptTag({content:read('application.js')});
 await page.evaluate(()=>{angular.module=window.originalAngularModule;});
 await page.addScriptTag({content:read('application.services.js')});
 await page.evaluate(()=>{
  angular.module('Hrm').value('NetworkStatus',{start:()=>()=>{}}).config(function($httpProvider){$httpProvider.interceptors.push('SessionAuthInterceptor');});
 });
 await page.addScriptTag({content:read('question/business/BattleSessionLogin.js')});
 await page.addScriptTag({content:read('question/controllers/BattleQuizOnlineController.js').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.battleHooks={applyRoom};')});
 await page.evaluate(snapshot=>{
  angular.bootstrap(document.getElementById('qa'),['Hrm']);window.battleScope=angular.element(document.getElementById('qa')).scope();
  window.battleScope.$apply(()=>{window.battleHooks.applyRoom(snapshot,false);window.battleScope.vm.exerciseAnswers={q1:['unfinished answer']};});
 },fixture.latest);
 return {page,errors,requests,fixture,user,async expire(){fixture.invalid=true;await page.evaluate(()=>{
  const injector=angular.element(document.getElementById('qa')).injector();injector.get('BattleQuizOnlineService').getRoom('GAME1').catch(angular.noop);
 });}};
}

test('real auth expiry opens an inline modal on desktop/mobile for host and player, then resumes the same room',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1280,390])for(const username of ['alice','host']){
  const h=await open(browser,width,username),{page}=h;
  try{
   await h.expire();const dialog=page.getByRole('dialog');await dialog.waitFor();
   assert.equal(await page.evaluate(()=>window.battleScope.vm.sessionLoginRequired),true);assert.deepEqual(await page.evaluate(()=>window.navigations),[]);
   assert.equal(await page.getByLabel('Tài khoản đang chơi').inputValue(),username);assert.notEqual(await page.getByLabel('Tài khoản đang chơi').getAttribute('readonly'),null);
   const input=page.getByLabel('Mật khẩu');await input.fill('wrong-password');await page.getByRole('button',{name:'Đăng nhập và tiếp tục',exact:true}).click();
   await page.getByRole('alert').getByText('Mật khẩu không đúng. Vui lòng thử lại.',{exact:true}).waitFor();
   assert.equal(await input.inputValue(),'');await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
   await page.mouse.click(1,1);assert.equal(await dialog.count(),1);
   const box=await dialog.locator('.modal-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
   assert.equal(await input.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true,'login must sit above the existing Battle overlays');
   await input.fill('correct-password');await page.getByRole('button',{name:'Đăng nhập và tiếp tục',exact:true}).click();await dialog.waitFor({state:'detached'});
   assert.equal(await page.getByLabel('Câu trả lời đang nhập').inputValue(),'unfinished answer');
   assert.equal(await page.evaluate(()=>window.battleScope.vm.sessionLoginRequired),false);assert.equal(await page.evaluate(()=>window.battleScope.vm.room.code),'GAME1');
   assert.deepEqual(await page.evaluate(()=>window.navigations),[]);assert.equal(await page.evaluate(()=>window.joinCalls),0);assert.ok(await page.evaluate(()=>window.connections)>0);
   const state=await page.evaluate(()=>{const injector=angular.element(document.getElementById('qa')).injector();return {current:injector.get('$rootScope').currentUser.username,admin:injector.get('settings').isAdmin};});
   assert.equal(state.current,username);assert.equal(state.admin,username==='host');assert.deepEqual(h.errors,[]);
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('missing cookies in a socket match open login automatically and a room that ended during login exits cleanly',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{const h=await open(browser,390);try{
  await h.page.evaluate(()=>angular.element(document.getElementById('qa')).injector().get('OAuthToken').removeToken());
  const dialog=h.page.getByRole('dialog');await dialog.waitFor();h.fixture.roomStatus=404;
  await h.page.getByLabel('Mật khẩu').fill('correct-password');await h.page.getByRole('button',{name:'Đăng nhập và tiếp tục',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal(await h.page.evaluate(()=>window.battleScope.vm.room),null);assert.deepEqual(await h.page.evaluate(()=>window.navigations),['application.battle_quiz_online']);assert.deepEqual(h.errors,[]);
 }finally{await h.page.close();}}finally{await browser.close();}
});
