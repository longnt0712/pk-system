// Real AngularJS and the shared pen editor. All requests use synthetic in-memory fixtures.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(app,f),'utf8');
let browser;before(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});after(async()=>{if(browser)await browser.close();});
const blank=()=>({text:'',orientation:'portrait',pattern:'lined',strokes:[]});
async function fixture({width=1440,gender='M',student=false,unread=true,expires=60000,dark=false,dashboard=false,enabled=true,notebookReadDelay=0}={}){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const server={entry:{id:12,title:'Biên bản tháng 11',kind:'DOCUMENT',revision:0,parentId:3,updatedAt:Date.now(),shared:true,noticeId:21,canEdit:!student,document:blank()},notice:{id:21,entryId:12,title:'Lịch họp huynh trưởng',summary:'Mời các anh chị xem nội dung họp.',startsAt:Date.now()-1000,endsAt:Date.now()+expires,active:true,readAt:unread?null:Date.now()},calls:[],errors:[]};
 page.on('pageerror',e=>server.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))server.errors.push(m.text());});
 const css=['assets/css/external/bootstrap.min.css','assets/css/study-notebook.css','tntt_documents/notices.css','tntt_documents/documents.css'].map(read).join('\n');
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());const reply=(obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  if(u.pathname==='/tai-lieu'||u.pathname==='/dashboard')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"'+(dark?' class="global-dark-mode"':'')+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><div ng-controller="TnttDocumentsController as vm">'+read('tntt_documents/documents.html')+'</div><tntt-notification-pet></tntt-notification-pet></body></html>'});
  if(u.pathname.startsWith('/assets/images/tntt-notices/'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(app,u.pathname.slice(1)))});
  server.calls.push({path:u.pathname,method:req.method(),body:req.postDataJSON()});
  if(u.pathname.endsWith('/capabilities'))return reply({enabled:enabled,canEdit:!student,canReceive:!student,emailConfigured:false,userId:7,serverNow:Date.now()});
  if(u.pathname.endsWith('/notifications/21/read')){server.notice.readAt=Date.now();return reply({});}
  if(u.pathname.endsWith('/notifications/21'))return reply({...server.notice,canEdit:false,revision:21,document:{...blank(),text:'Nội dung đã công bố'}});
  if(u.pathname.endsWith('/notifications'))return reply(student?[]:(u.searchParams.get('unread')==='true'&&server.notice.readAt?[]:[server.notice]));
  if(u.pathname.endsWith('/recipients'))return reply([{id:7,name:'Huynh trưởng kiểm thử',groups:['ADMIN'],hasEmail:false}]);
  if(u.pathname.endsWith('/publish'))return reply({id:21});
  if(u.pathname.endsWith('/entries/12')){
   if(req.method()==='PUT'){const p=req.postDataJSON();server.entry={...server.entry,revision:server.entry.revision+1,document:p.document};}
   else if(notebookReadDelay && server.calls.filter(c=>c.path===u.pathname&&c.method==='GET').length>1)await new Promise(resolve=>setTimeout(resolve,notebookReadDelay));
   return reply(u.searchParams.get('revision')===String(server.entry.revision)?{id:12,revision:server.entry.revision,changed:false}:{...server.entry,changed:true});
  }
  if(u.pathname.endsWith('/entries'))return reply([{id:3,title:'Biên bản họp',kind:'FOLDER',parentId:null,revision:0,updatedAt:Date.now()},server.entry]);
  return reply({});
 });
 await page.goto('https://tnttphungkhoang.test/'+(dashboard?'dashboard':'tai-lieu'));
 for(const f of ['angular.min.js','angular-cookies.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',f)});
 await page.evaluate(({student,gender,dashboard})=>{
  window.Hrm={};window.user={id:7,roles:[{name:student?'ROLE_STUDENT':'ROLE_ADMIN'}],person:{gender}};
  document.cookie='education.user='+encodeURIComponent(JSON.stringify(window.user))+';path=/';
  angular.module('ui.router',[]).provider('$state',function(){this.state=function(){return this;};this.$get=['$rootScope',function(root){return{current:{name:dashboard?'application.dashboard':'application.tntt_documents'},is(name){return this.current.name===name;},go(name,params){window.lastNavigation={name,params};this.current.name=name;root.$broadcast('$stateChangeSuccess');}};}];});
  angular.module('oc.lazyLoad',[]);angular.module('Hrm.Common',[]);
 },{student,gender,dashboard});
 for(const f of ['tntt_documents/tntt-documents.module.js','tntt_documents/TnttNoticeCenter.js','tntt_documents/TnttDocumentNotebookStore.js','tntt_documents/TnttDocumentPrint.js','tntt_documents/TnttDocumentsController.js'])await page.addScriptTag({path:path.join(app,f)});
 await page.addScriptTag({path:path.join(app,'common/utils/study-notebook.directive.js')});
 await page.evaluate(()=>{
  angular.module('Fixture',['Hrm.TnttDocuments','ngCookies']).value('settings',{campaignsEnabled:true,permissionsLoaded:true,api:{baseUrl:'/service/'}}).value('AuthSession',{hasCredentials:()=>!!window.user}).value('$stateParams',{});
  angular.bootstrap(document,['Fixture']);window.injector=angular.element(document).injector();window.vm=angular.element(document.querySelector('[ng-controller]')).scope().vm;
 });
 await page.locator(enabled?'.td-entry':'.td-empty').first().waitFor().catch(async e=>{console.error(JSON.stringify({errors:server.errors,calls:server.calls,state:await page.evaluate(()=>({error:window.vm?.error,caps:window.vm?.caps,entries:window.vm?.entries})),body:(await page.locator('body').innerText()).slice(0,700)}));await context.close();throw e;});
 return{page,context,server};
}

test('shared minutes type and draw with the existing A4 editor, autosave together and preserve read-only snapshots',async()=>{
 const f=await fixture();try{
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-documents-desktop.png')});
  await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
  await f.page.locator('.study-notebook-text').fill('BIÊN BẢN HỌP\nThiếu nhi cùng sống yêu thương.');
  await f.page.getByRole('button',{name:'Bút',exact:true}).click();
  const box=await f.page.locator('.study-notebook-canvas').boundingBox();
  await f.page.mouse.move(box.x+70,box.y+110);await f.page.mouse.down();await f.page.mouse.move(box.x+160,box.y+140,{steps:8});await f.page.mouse.up();
  await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status==='saved');
  assert.match(f.server.entry.document.text,/BIÊN BẢN HỌP/);assert.equal(f.server.entry.document.strokes.length,1);
  await f.page.locator('.study-notebook-close').click();await f.page.waitForFunction(()=>!window.vm.active);
  await f.page.evaluate(()=>{window.vm.openNotice({id:21});window.injector.get('$rootScope').$digest();});
  await f.page.waitForFunction(()=>document.querySelector('.study-notebook-text')?.readOnly);
  assert.equal(await f.page.locator('.study-notebook-text').inputValue(),'Nội dung đã công bố');
  assert.equal(await f.page.locator('.study-notebook-tools').count(),0);
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});

test('saved pen and highlighter ink is visible on reopening before any zoom or tool change, including slow loads',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width,notebookReadDelay:350});try{
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status!=='loading');
   await f.page.locator('.study-notebook-text').fill('Biên bản có chữ gõ và nét bút đã lưu.');
   for(const tool of ['Bút','Đánh dấu']){
    await f.page.getByRole('button',{name:tool,exact:true}).click();
    const box=await f.page.locator('.study-notebook-canvas').boundingBox();
    await f.page.mouse.move(box.x+40,box.y+70);await f.page.mouse.down();await f.page.mouse.move(box.x+130,box.y+100,{steps:8});await f.page.mouse.up();
   }
   await f.page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.equal(f.server.entry.document.strokes.length,2);const saved=JSON.stringify(f.server.entry.document);
   for(let attempt=0;attempt<2;attempt++){
    await f.page.locator('.study-notebook-close').click();await f.page.waitForFunction(()=>!window.vm.active);
    await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
    await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status==='loading');
    await f.page.waitForFunction(()=>window.vm.session.status==='saved');
    await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const painted=await f.page.locator('.study-notebook-canvas').evaluate(canvas=>{
     const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=0;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i])ink++;return ink;
    });
    assert.ok(painted>100,`Handwriting is visible immediately after reopen at ${width}px (attempt ${attempt+1})`);
    assert.equal(await f.page.locator('.study-notebook-zoom output').textContent(),'100%');
    assert.equal(await f.page.locator('.study-notebook-tools .is-active').innerText(),'Gõ chữ');
    assert.equal(JSON.stringify(f.server.entry.document),saved,'Reopening does not mutate the saved text or ink');
   }
   await f.page.screenshot({path:path.join(app,`../../.tmp/tntt-notebook-reopen-${width}.png`)});
   assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('publish form chooses adults and UTC+7 dates while unconfigured mail and Zalo remain unavailable',async()=>{
 const f=await fixture({width:390,dark:true});try{
  await f.page.evaluate(()=>{window.vm.openPublish(window.vm.entries.find(e=>e.id===12));window.injector.get('$rootScope').$digest();});
  await f.page.locator('.td-dialog').waitFor();
  assert.equal(await f.page.getByRole('checkbox',{name:'Gửi email một lần khi đến giờ bắt đầu'}).isDisabled(),true);
  assert.equal(await f.page.getByText('Zalo',{exact:false}).count(),0);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-documents-mobile.png')});
  await f.page.getByRole('button',{name:'Chia sẻ và tạo đợt thông báo',exact:true}).click();
  await f.page.waitForFunction(()=>!document.querySelector('.td-dialog')).catch(async e=>{console.error(JSON.stringify({calls:f.server.calls,errors:f.server.errors,invalid:await f.page.locator('input:invalid').evaluateAll(xs=>xs.map(x=>({type:x.type,value:x.value,message:x.validationMessage}))),body:await f.page.locator('.td-dialog').innerText()}));throw e;});
  const payload=f.server.calls.find(c=>c.path.endsWith('/publish')).body;
  assert.deepEqual(payload.groups,['ADMIN','EDUCATION','STUDENT_MANAGEMENT']);assert.equal(payload.email,false);assert.ok(payload.endsAt>payload.startsAt);
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});

test('pet uses the inverse gender, drag does not open a notice, closing does not acknowledge, explicit read removes it',async()=>{
 for(const [gender,image]of[['M','leader-female.png'],['F','leader-male.png'],['','leader-male.png']]){
  const f=await fixture({gender});try{
   const pet=f.page.locator('.tn-mascot-button');await pet.waitFor({state:'visible'});
   assert.match(await pet.locator('img').getAttribute('src'),new RegExp(image+'$'));
   const box=await pet.boundingBox();await f.page.mouse.move(box.x+30,box.y+30);await f.page.mouse.down();await f.page.mouse.move(box.x-180,box.y-130,{steps:8});await f.page.mouse.up();
   assert.equal(await f.page.locator('.tn-popup').count(),0);
   await f.page.waitForTimeout(450);await pet.click();await f.page.locator('.tn-popup').waitFor();
   await f.page.getByRole('button',{name:'Để sau',exact:true}).last().click();await f.page.waitForTimeout(300);
   assert.equal(f.server.notice.readAt,null);await pet.click();await f.page.getByRole('button',{name:'Đã đọc'}).click();
   await pet.waitFor({state:'hidden'});assert.ok(f.server.notice.readAt);assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('students have no pet; expiry removes it without requiring a page reload',async()=>{
 for(const options of [{student:true},{expires:1200}]){
  const f=await fixture(options);try{if(options.expires)await f.page.locator('.tn-mascot-button').waitFor({state:'visible'});await f.page.locator('.tn-mascot-button').waitFor({state:'hidden'});assert.deepEqual(f.server.errors,[]);}finally{await f.context.close();}
 }
});

test('automatic modal appears on the dashboard once per session; saved read state suppresses it',async()=>{
 const f=await fixture({dashboard:true});try{await f.page.locator('.tn-popup').waitFor();await f.page.getByRole('button',{name:'Để sau',exact:true}).last().click();await f.page.evaluate(()=>window.injector.get('TnttNoticeCenter').refresh());await f.page.waitForTimeout(500);assert.equal(await f.page.locator('.tn-popup').count(),0);assert.equal(f.server.notice.readAt,null);assert.deepEqual(f.server.errors,[]);}finally{await f.context.close();}
 const read=await fixture({dashboard:true,unread:false});try{await read.page.waitForTimeout(500);assert.equal(await read.page.locator('.tn-popup').count(),0);assert.equal(await read.page.locator('.tntt-notice-mascot').isVisible(),false);}finally{await read.context.close();}
});
test('twelve teams scroll vertically beside the fixed unassigned list and leader controls are inline chips',async()=>{
 const f=await fixture();try{
  await f.page.addScriptTag({path:path.join(app,'assets/scripts/external/angular-drag-and-drop-lists.min.js')});
  await f.page.evaluate(()=>angular.module('Hrm.EnrolmentClass',[]));
  await f.page.addScriptTag({path:path.join(app,'enrolment_class/controllers/EnrolmentClassController.js')});
  const listing=read('enrolment_class/views/listing.html'),css=listing.match(/<style>([\s\S]*?)<\/style>/)[1];
  await f.page.addStyleTag({content:css});
  const template=listing.match(/<script type="text\/ng-template" id="team_board_modal.html">([\s\S]*?)<\/script>/)[1];
  const column=listing.match(/<script type="text\/ng-template" id="team_board_column.html">([\s\S]*?)<\/script>/)[1];
  await f.page.evaluate(({template,column})=>{
   const original=angular.element(document).injector();
   const extra=angular.injector(['ng','Hrm.EnrolmentClass']);const root=original.get('$rootScope'),scope=root.$new(),q=original.get('$q');
   root.settings={layout:{},permissionsLoaded:true,isAdmin:true};
   const students=Array.from({length:30},(_,i)=>({id:i+1,lastName:'Nguyễn',firstName:'Học sinh '+i,username:'gl2026'+i,person:{gender:i%2?'F':'M'}}));
   let board={classId:10,className:'THIẾU NHI 3',totalStudents:42,unassignedStudents:students,teams:Array.from({length:12},(_,i)=>({id:100+i,name:'Đội '+(i+1),gender:'MIXED',leadershipKey:'key'+i,deputyIds:[],students:[{id:1000+i,lastName:'Trần',firstName:'Thành viên '+i,username:'member'+i,person:{gender:'M'}}]}))};
   window.teamCalls=[];
   const service={getTree:()=>q.when([]),updateTeamSettings:(classId,teamId,payload)=>{window.teamCalls.push({classId,teamId,payload});const col=board.teams.find(t=>t.id===teamId);if(payload.gender)col.gender=payload.gender;if(payload.role==='CAPTAIN')col.captainId=payload.userId;col.leadershipKey+='x';return q.when(angular.copy(board));}};
   const state={current:{name:'application.class',data:{enrolmentSchoolId:2}}};
   scope.vm=extra.get('$controller')('EnrolmentClassController',{$rootScope:root,$scope:scope,toastr:{error:msg=>{throw new Error(msg);},warning(){},success(){}},$uibModal:original.get('$uibModal'),EnrolmentClassService:service,$state:state,$stateParams:{},ComprehensiveFolders:{},ClassAssignmentPicker:{}});
   scope.vm.decorateTeamBoard(angular.copy(board));window.teamVm=scope.vm;
   original.get('$templateCache').put('team_board_column.html',column);
   const host=angular.element('<div class="modal class-management-modal-window team-board-modal-window in" style="display:block"><div class="modal-dialog"><div class="modal-content">'+template+'</div></div></div>');
   document.body.appendChild(host[0]);document.body.classList.add('modal-open');original.get('$compile')(host)(scope);root.$digest();
  },{template,column});
  await f.page.locator('.team-board-teams-pane .team-board-column').last().waitFor({state:'attached'});
  const layout=await f.page.evaluate(()=>{const pane=document.querySelector('.team-board-columns'),side=document.querySelector('.team-board-sidebar');const before=side.getBoundingClientRect().top;pane.scrollTop=1000;return{scroll:pane.scrollHeight>pane.clientHeight,horizontal:pane.scrollWidth>pane.clientWidth,fixed:before===side.getBoundingClientRect().top};});
  assert.deepEqual(layout,{scroll:true,horizontal:false,fixed:true});
  await f.page.locator('.team-board-columns').evaluate(p=>p.scrollTop=0);
  const first=f.page.locator('.team-board-teams-pane .team-board-column').first();
  await first.getByRole('button',{name:'Nữ',exact:true}).click();
  await first.getByRole('button',{name:'Chọn trưởng',exact:true}).click();
  await first.getByRole('button',{name:'Đội trưởng',exact:true}).waitFor();
  assert.equal((await f.page.evaluate(()=>window.teamCalls))[0].payload.gender,'F');
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-teams-desktop.png')});
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});


test('printing preserves plain text and ink across a multipage A4 PDF and escapes markup',async()=>{
 const f=await fixture();try{
  const popupPromise=f.page.waitForEvent('popup');
  await f.page.evaluate(()=>window.injector.get('TnttDocumentPrint').open('Biên bản <script>bad()</script>',{text:Array.from({length:110},(_,i)=>'Dòng '+i+': Nội dung họp tiếng Việt').join('\n'),orientation:'portrait',pattern:'lined',strokes:[{id:'ink',tool:'pen',color:'#315bbe',width:4,points:[[60,1500],[200,1560]]}]}));
  const popup=await popupPromise;await popup.locator('.paper').waitFor();assert.equal(await popup.locator('script').count(),0);
  assert.match(await popup.locator('pre').innerText(),/Dòng 109/);assert.equal(await popup.locator('svg polyline').count(),1);
  const pdf=await popup.pdf({preferCSSPageSize:true,printBackground:true,path:path.join(app,'../../.tmp/tntt-document-print.pdf')});
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>=3);await popup.close();
 }finally{await f.context.close();}
});


test('a disabled document feature explains the server setting to editors and avoids reading document tables',async()=>{
 for(const student of [false,true]){
  const f=await fixture({width:440,enabled:false,student});try{
   await f.page.getByRole('heading',{name:'Mục Tài liệu chưa được bật trên máy chủ'}).waitFor();
   assert.equal(f.server.calls.some(c=>/\/(entries|notifications)(?:\/|$)/.test(c.path)),false);
   assert.equal(await f.page.locator('.td-empty code').count(),student?0:1);
   await f.page.addStyleTag({content:'.td-page h1{color:#2c3c55!important}'});
   assert.equal(await f.page.locator('.td-heading h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
   assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});
