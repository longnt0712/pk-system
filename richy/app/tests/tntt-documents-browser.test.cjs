// Real AngularJS and the shared pen editor. All requests use synthetic in-memory fixtures.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(app,f),'utf8');
let browser;before(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});after(async()=>{if(browser)await browser.close();});
const blank=()=>({text:'',orientation:'portrait',pattern:'lined',strokes:[]});
async function fixture({width=1440,gender='M',student=false,editor=!student,unread=true,expires=60000,dark=false,dashboard=false,enabled=true,notebookReadDelay=0,params={},collaboration=null,userId=7,name='Người soạn'}={}){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const server=collaboration?.server||{entry:{id:12,title:'Biên bản tháng 11',kind:'DOCUMENT',revision:0,parentId:null,updatedAt:Date.now(),shared:true,noticeId:21,canEdit:editor,document:blank()},extraEntries:[],archivedEntries:[],notice:{id:21,entryId:12,title:'Lịch họp huynh trưởng',summary:'Mời các anh chị xem nội dung họp.',startsAt:Date.now()-1000,endsAt:Date.now()+expires,active:true,readAt:unread?null:Date.now()},calls:[],errors:[]};
 if(collaboration){collaboration.server=server;server.entry.syncProtocol=1;server.entry.sync||={floor:0,recent:[]};await page.addInitScript(()=>Object.defineProperty(document,'hidden',{get:()=>false}));await page.routeWebSocket('**/public/tntt-document-live?*',socket=>collaboration.connect(socket));}
 page.on('pageerror',e=>server.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))server.errors.push(m.text());});
 const css=['assets/css/external/bootstrap.min.css','assets/css/external/quill.snow-2.0.3.css','assets/css/study-notebook.css','tntt_documents/notices.css','tntt_documents/documents.css'].map(read).join('\n');
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());const reply=(obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  if(u.pathname==='/tai-lieu'||u.pathname==='/dashboard')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"'+(dark?' class="global-dark-mode"':'')+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><div ng-controller="TnttDocumentsController as vm">'+read('tntt_documents/documents.html')+'</div><tntt-notification-pet></tntt-notification-pet></body></html>'});
  if(u.pathname.startsWith('/assets/images/tntt-notices/'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(app,u.pathname.slice(1)))});
  server.calls.push({path:u.pathname,method:req.method(),body:req.postDataJSON()});
  if(collaboration?.blocked.has(userId))return route.abort('failed');
  if(u.pathname.endsWith('/capabilities'))return reply({enabled:enabled,canEdit:editor,canReceive:!student,emailConfigured:false,userId,serverNow:Date.now()});
  if(collaboration&&u.pathname.endsWith('/live-ticket'))return reply(collaboration.issue(req.postDataJSON().clientId,userId,name));
  if(u.pathname.endsWith('/notifications/21/read')){server.notice.readAt=Date.now();return reply({});}
  if(u.pathname.endsWith('/notifications/21'))return reply({...server.notice,canEdit:false,revision:21,document:{...blank(),text:'Nội dung đã công bố'}});
  if(u.pathname.endsWith('/notifications'))return reply(student?[]:(u.searchParams.get('unread')==='true'&&server.notice.readAt?[]:[server.notice]));
  if(u.pathname.endsWith('/recipients'))return reply([{id:7,name:'Huynh trưởng kiểm thử',groups:['ADMIN'],hasEmail:false}]);
  if(u.pathname.endsWith('/publish'))return reply({id:21});
  if(u.pathname.endsWith('/entries/12/public-link')){
   if(req.method()==='POST')server.token='0123456789abcdef0123456789abcdef';
   if(req.method()==='DELETE')server.token=null;
   return reply({token:server.token||null});
  }
  if(u.pathname.endsWith('/entries/12')){
   if(req.method()==='PUT'){
    const p=req.postDataJSON();
    if(collaboration){
     const old=server.entry.sync.recent.find(item=>item.id===p.mutationId);
     if(old)return reply({...server.entry,changed:true});
     if(p.revision!==server.entry.revision)return reply({message:'Tài liệu vừa được cập nhật.'},409);
     server.entry={...server.entry,revision:server.entry.revision+1,document:structuredClone(p.document),sync:{floor:0,recent:[...server.entry.sync.recent,{id:p.mutationId,revision:server.entry.revision+1}]}};
     const acknowledged=structuredClone({...server.entry,changed:true});collaboration.revision();
     if(collaboration.hold?.userId===userId){const hold=collaboration.hold;collaboration.hold=null;hold.reached();await hold.wait;}
     if(collaboration.abort?.delete(userId))return route.abort('failed');
     return reply(acknowledged);
    }
    server.entry={...server.entry,revision:server.entry.revision+1,document:p.document};
   }
   else if(notebookReadDelay && server.calls.filter(c=>c.path===u.pathname&&c.method==='GET').length>1)await new Promise(resolve=>setTimeout(resolve,notebookReadDelay));
   return reply(u.searchParams.get('revision')===String(server.entry.revision)?{id:12,revision:server.entry.revision,changed:false,syncProtocol:collaboration?1:undefined}:{...server.entry,changed:true,canEdit:editor});
  }
  if(u.pathname.endsWith('/entries')){
   let rows=u.searchParams.get('trash')==='true'?server.archivedEntries:[{id:3,title:'Biên bản họp',kind:'FOLDER',parentId:null,revision:0,updatedAt:Date.now()},...server.extraEntries,server.entry];
   const term=(u.searchParams.get('q')||'').trim().toLowerCase();
   if(term)rows=rows.filter(e=>e.kind==='FOLDER'||e.title.toLowerCase().includes(term));
   return reply(rows);
  }
  return reply({});
 });
 await page.goto('https://tnttphungkhoang.test/'+(dashboard?'dashboard':'tai-lieu'));
 for(const f of ['angular.min.js','angular-cookies.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',f)});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/quill-2.0.3.js')});
 await page.evaluate(({student,editor,gender,dashboard,userId})=>{
  window.Hrm={};window.user={id:userId,roles:[{name:student?'ROLE_STUDENT':editor?'ROLE_ADMIN':'ROLE_STUDENT_MANAGEMENT'}],person:{gender}};
  document.cookie='education.user='+encodeURIComponent(JSON.stringify(window.user))+';path=/';
  angular.module('ui.router',[]).provider('$state',function(){
   const routes={};this.state=function(name,config){routes[name]=config;return this;};
   this.$get=['$rootScope',function(root){return{
    current:{name:dashboard?'application.dashboard':'application.tntt_documents'},
    is(name){return this.current.name===name;},
    go(name,params){window.lastNavigation={name,params};this.current.name=name;root.$broadcast('$stateChangeSuccess');},
    href(name,params){const [path,keys]=routes[name].url.split('?');const url=new URL(path,location.origin);
     keys.split('&').filter(key=>params[key]!=null).forEach(key=>url.searchParams.set(key,params[key]));return url.href;}
   };}];
  });
  angular.module('oc.lazyLoad',[]);angular.module('Hrm.Common',[]);
 },{student,editor,gender,dashboard,userId});
 for(const f of ['common/utils/color-palette.js','tntt_documents/tntt-documents.module.js','tntt_documents/TnttNoticeCenter.js','tntt_documents/TnttDocumentMerge.js','tntt_documents/TnttDocumentLive.js','tntt_documents/TnttDocumentNotebookStore.js','tntt_documents/TnttDocumentPrint.js','tntt_documents/TnttDocumentsController.js'])await page.addScriptTag({path:path.join(app,f)});
 await page.addScriptTag({path:path.join(app,'common/utils/study-notebook.directive.js')});
 await page.evaluate(params=>{
  angular.module('Fixture',['Hrm.TnttDocuments','ngCookies']).value('settings',{campaignsEnabled:true,permissionsLoaded:true,api:{baseUrl:'/service/'}}).value('AuthSession',{hasCredentials:()=>!!window.user}).value('$stateParams',params);
  angular.bootstrap(document,['Fixture']);window.injector=angular.element(document).injector();window.vm=angular.element(document.querySelector('[ng-controller]')).scope().vm;
 },params);
 await page.locator(enabled?'.td-entry':'.td-empty').first().waitFor().catch(async e=>{console.error(JSON.stringify({errors:server.errors,calls:server.calls,state:await page.evaluate(()=>({error:window.vm?.error,caps:window.vm?.caps,entries:window.vm?.entries})),body:(await page.locator('body').innerText()).slice(0,700)}));await context.close();throw e;});
 return{page,context,server};
}

function collaborationServer(){
 const tickets=new Map(),peers=new Map();let ticketSerial=0;
 const publicPeer=peer=>({id:peer.id,name:peer.name,color:peer.color,cursor:peer.cursor});
 const send=(peer,packet)=>{try{peer.socket.send(JSON.stringify(packet))}catch{}};
 const broadcast=(packet,except)=>{for(const peer of peers.values())if(peer.id!==except)send(peer,packet)};
 const room={abort:new Set(),blocked:new Set(),peers,server:null,hold:null,
  issue(id,userId,name){const ticket='ticket-'+(++ticketSerial);tickets.set(ticket,{id,userId,name});return{ticket}},
  connect(socket){
   const token=new URL(socket.url()).searchParams.get('ticket'),identity=tickets.get(token);tickets.delete(token);
   if(!identity){socket.close({code:1008});return}
   const peer={...identity,socket,color:['#2563eb','#be185d','#047857'][identity.userId%3],cursor:{visible:false}};
   const others=[...peers.values()].map(publicPeer);peers.set(peer.id,peer);
   send(peer,{type:'welcome',documentId:12,revision:room.server.entry.revision,self:publicPeer(peer),peers:others});broadcast({type:'join',peer:publicPeer(peer)},peer.id);
   const leave=()=>{if(peers.get(peer.id)!==peer)return;peers.delete(peer.id);broadcast({type:'leave',id:peer.id},peer.id)};
   socket.onClose(()=>leave());
   socket.onMessage(message=>{const packet=JSON.parse(message);if(packet.type==='ping'){send(peer,{type:'pong'});return}if(packet.type==='cursor'){peer.cursor=packet.cursor;broadcast({type:'cursor',peer:publicPeer(peer)},peer.id)}});
  },
  revision(){broadcast({type:'revision',revision:room.server.entry.revision})}
 };return room;
}
async function openLive(f){await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();await f.page.waitForFunction(()=>window.vm.session?.live?.state==='online');}

test('three live editors see distinct named cursors across zoom levels without saving cursor movements',async()=>{
 const room=collaborationServer(),clients=[];
 try{
  for(const [userId,name,width]of [[7,'Chị An',1440],[8,'Anh Bình',1100],[9,'Chị Chi',390]]){const f=await fixture({collaboration:room,userId,name,width});clients.push(f);await openLive(f)}
  for(let i=0;i<clients.length;i++){
   const f=clients[i],box=await f.page.locator('.study-notebook-paper').boundingBox(),scale=box.width/794;
   await f.page.mouse.move(box.x+(120+i*100)*scale,box.y+(160+i*20)*scale);
  }
  for(const f of clients){await f.page.waitForFunction(()=>document.querySelectorAll('.study-notebook-peer-cursor').length===2);assert.equal(await f.page.locator('.study-notebook-peer-cursor span').first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)')}
  assert.deepEqual((await clients[0].page.locator('.study-notebook-peer-cursor span').allTextContents()).sort(),['Anh Bình','Chị Chi']);
  assert.equal(room.server.calls.filter(call=>call.method==='PUT').length,0,'Presence never creates document revisions');
  await clients[0].page.screenshot({path:path.join(app,'../../.tmp/tntt-collaboration-three-cursors.png')});
  await clients[1].page.locator('.study-notebook-close').click();await clients[0].page.waitForFunction(()=>document.querySelectorAll('.study-notebook-peer-cursor').length===1);await clients[1].context.close();
  assert.deepEqual(room.server.errors,[]);
 }finally{await Promise.all(clients.map(f=>f.context.close()))}
});

test('two live editors merge concurrent text and handwriting and undo only their own edit',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7,name:'Máy A'}),b=await fixture({collaboration:room,userId:8,name:'Máy B'});
 try{
  await openLive(a);await openLive(b);
  await Promise.all([a.page.locator('.study-notebook-text').fill('Nội dung A\n'),b.page.locator('.study-notebook-text').fill('Nội dung B\n')]);
  for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('Nội dung A')&&window.vm.session.document.text.includes('Nội dung B'));
  assert.equal((room.server.entry.document.text.match(/Nội dung A/g)||[]).length,1);assert.equal((room.server.entry.document.text.match(/Nội dung B/g)||[]).length,1);
  await a.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();
  await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&!window.vm.session.document.text.includes('Nội dung A')&&window.vm.session.document.text.includes('Nội dung B'));
  const draw=async(f,offset)=>{await f.page.getByRole('button',{name:'Bút',exact:true}).click();await f.page.locator('.study-notebook-heading__copy').click();const box=await f.page.locator('.study-notebook-canvas').boundingBox();await f.page.mouse.move(box.x+100,box.y+offset);await f.page.mouse.down();await f.page.mouse.move(box.x+200,box.y+offset+20,{steps:5});await f.page.mouse.up()};
  await Promise.all([draw(a,140),draw(b,210)]);
  for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.strokes.length===2);
  assert.equal(new Set(room.server.entry.document.strokes.map(stroke=>stroke.id)).size,2);
  await a.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();
  await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.strokes.length===1);
  assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
});

test('live updates arriving before a delayed or lost save acknowledgement do not duplicate local text',async()=>{
 for(const lost of [false,true]){
  const room=collaborationServer(),a=await fixture({collaboration:room,userId:7,name:'Máy A'}),b=await fixture({collaboration:room,userId:8,name:'Máy B'});
  try{
   await openLive(a);await openLive(b);
   let release,reached;const committed=new Promise(resolve=>reached=resolve);room.hold={userId:7,reached,wait:new Promise(resolve=>release=resolve)};
   if(lost)room.abort.add(7);
   await a.page.locator('.study-notebook-text').fill('Alpha');await committed;
   await a.page.locator('.study-notebook-text').press('End');await a.page.keyboard.insertText(' thêm');
   await b.page.waitForFunction(()=>window.vm.session.document.text==='Alpha');
   await b.page.locator('.study-notebook-text').press('End');await b.page.keyboard.insertText(' Beta');
   await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('Beta'));
   release();
   for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('thêm')&&window.vm.session.document.text.includes('Beta'));
   const text=room.server.entry.document.text;assert.equal((text.match(/Alpha/g)||[]).length,1);assert.equal((text.match(/thêm/g)||[]).length,1);assert.equal((text.match(/Beta/g)||[]).length,1);
   assert.deepEqual(room.server.errors,[]);
  }finally{await a.context.close();await b.context.close()}
 }
});

test('identical concurrent insertions are distinct edits and a remote insert preserves selected text formatting',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7}),b=await fixture({collaboration:room,userId:8});
 try{
  await openLive(a);await openLive(b);
  await Promise.all([a.page.locator('.study-notebook-text').fill('A'),b.page.locator('.study-notebook-text').fill('A')]);
  for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text==='AA');
  await a.page.locator('.study-notebook-text').fill('abcd');
  await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text==='abcd');
  await a.page.locator('.study-notebook-text').evaluate(el=>{el.focus();el.setSelectionRange(1,3)});
  await b.page.locator('.study-notebook-text').fill('B abcd');
  await a.page.waitForFunction(()=>window.vm.session.document.text==='B abcd');
  await a.page.getByRole('button',{name:'Màu chữ và bút',exact:true}).click();
  await a.page.getByRole('dialog',{name:'Bảng màu chữ và bút',exact:true}).getByRole('button',{name:'Màu #FF0000',exact:true}).click();
  for(const f of [a,b])await f.page.locator('.ql-editor [style*="color: rgb(255, 0, 0)"]').getByText('bc',{exact:true}).waitFor();
  assert.equal(room.server.entry.document.text,'B abcd');assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
});

test('IME input is kept while remote updates wait and an uncertain offline save recovers after closing and reopening',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7}),b=await fixture({collaboration:room,userId:8});
 try{
  await openLive(a);await openLive(b);
  await b.page.locator('.study-notebook-text').evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
  await b.page.locator('.study-notebook-text').fill('Tiếng Việt');await a.page.locator('.study-notebook-text').fill('Máy A ');
  await a.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.revision>0);
  assert.equal(await b.page.locator('.study-notebook-text').inputValue(),'Tiếng Việt');
  await b.page.locator('.study-notebook-text').evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('Máy A')&&window.vm.session.document.text.includes('Tiếng Việt'));
  assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
 const offline=collaborationServer(),f=await fixture({collaboration:offline,userId:7});
 try{
  await openLive(f);offline.blocked.add(7);
  await f.page.locator('.study-notebook-text').fill('Không được xuất hiện sau khi đã hoàn tác');
  await f.page.evaluate(()=>window.vm.session.save());
  await f.page.locator('.study-notebook-text').fill('');
  await f.page.locator('.study-notebook-close').click();await f.page.waitForFunction(()=>!window.vm.active);
  offline.blocked.delete(7);await openLive(f);
  await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.revision>=2&&window.vm.session.document.text==='');
  assert.equal(offline.server.entry.document.text,'');
  const attempts=offline.server.calls.filter(call=>call.method==='PUT'&&call.body.document.text!=='');
  assert.equal(new Set(attempts.map(call=>call.body.mutationId)).size,1,'Retrying an uncertain request reuses its id instead of inserting text twice');
 }finally{await f.context.close()}
});

test('live rich tables, cell line breaks, images and local undo converge on both machines',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7}),b=await fixture({collaboration:room,userId:8});
 try{
  await openLive(a);
  await a.page.locator('.study-notebook-text').evaluate(el=>{
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#315bbe';c.fillRect(0,0,64,64);
   const data=new DataTransfer();data.setData('text/html','<table><tr><th>Tên</th><th>Ghi chú</th></tr><tr><td>An</td><td>Chuẩn bị<br>Hội trường</td></tr></table><p><img src="'+canvas.toDataURL()+'"></p>');
   el.focus();el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await a.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.textDelta?.ops.some(op=>op.insert.image));
  await openLive(b);
  const cell=(f,index)=>f.page.locator('.ql-editor table tr').nth(1).locator('td').nth(index);
  await Promise.all([(async()=>{await cell(a,0).click();await a.page.keyboard.press('End');await a.page.keyboard.insertText(' A')})(),(async()=>{await cell(b,1).click();await b.page.keyboard.press('End');await b.page.keyboard.insertText(' B')})()]);
  for(const f of [a,b]){
   await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('An A')&&window.vm.session.document.text.includes('Hội trường B'));
   assert.equal(await f.page.locator('.ql-editor table td').count(),4);assert.equal(await f.page.locator('.ql-editor table br.study-notebook-softbreak').count(),1);assert.equal(await f.page.locator('.ql-editor img').count(),1);
  }
  await a.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();
  await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&!window.vm.session.document.text.includes('An A')&&window.vm.session.document.text.includes('Hội trường B'));
  await a.page.getByRole('button',{name:'Khôi phục ghi chú',exact:true}).click();
  for(const f of [a,b])await f.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text.includes('An A')&&window.vm.session.document.text.includes('Hội trường B'));
  assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
});

test('clipboard tables and raster images remain editable, undo atomically, save, reopen and print on desktop and phone',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width});
  try{
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   const plain=f.page.locator('.study-notebook-text'),root=f.page.locator('.study-notebook-rich-text .ql-editor');
   await plain.fill('Biên bản\nKết thúc');
   await plain.evaluate(el=>{
    el.focus();el.setSelectionRange(9,9);
    const data=new DataTransfer();data.setData('text/html','<table><thead><tr><th colspan="2">Phân công</th></tr></thead><tbody><tr><td rowspan="2">An</td><td><b>Chuẩn bị</b><br>Hội trường</td></tr><tr><td>Bình</td></tr></tbody></table>');
    data.setData('text/plain','Phân công\nAn\tChuẩn bị\nBình');
    el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
   });
   await root.locator('table td').last().waitFor();
   assert.equal(await root.locator('table tr').count(),3);
   assert.equal(await root.locator('td[colspan="2"]').innerText(),'Phân công');
   assert.equal(await root.locator('td[rowspan="2"]').innerText(),'An');
   assert.match(await root.locator('table').innerText(),/Chuẩn bị.*Hội trường/s);
   assert.equal(await root.locator('table br.study-notebook-softbreak').count(),1);
   assert.ok(await root.locator('table tr').nth(1).evaluate(row=>row.getBoundingClientRect().height>Number.parseFloat(getComputedStyle(row).lineHeight)*1.7),'Cell line breaks remain within the same cell');
   assert.equal(await root.locator('table td').count(),4);
   await f.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();
   await root.locator('table').waitFor({state:'detached'});
   assert.equal(await root.locator('table').count(),0);
   assert.equal(await root.evaluate(el=>Quill.find(el.parentElement).getText()),'Biên bản\nKết thúc\n');
   await f.page.getByRole('button',{name:'Khôi phục ghi chú',exact:true}).click();
   await root.locator('table td').last().click();
   await f.page.keyboard.press('End');await f.page.keyboard.insertText(' phụ trách');
   assert.match(await root.locator('table td').last().innerText(),/Bình phụ trách/);
   await root.evaluate(el=>{
    const q=Quill.find(el.parentElement);q.setSelection(q.getLength()-1,0,'silent');
    const data=new DataTransfer(),canvas=document.createElement('canvas');canvas.width=400;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,400,160);c.fillStyle='#315bbe';c.font='32px Arial';c.fillText('Ảnh biên bản',30,80);
    data.setData('text/html','<p><img onload="window.pasteExecuted=true" src="'+canvas.toDataURL()+'"></p>');
    el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
   });
   await root.locator('img').waitFor();
   await f.page.waitForFunction(()=>{const e=document.querySelector('.ql-editor img');return e&&e.complete&&e.naturalWidth===400});
   assert.equal(await f.page.evaluate(()=>window.pasteExecuted),undefined);
   await f.page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.equal(f.server.entry.document.textDelta.ops.filter(op=>op.insert?.image).length,1);
   const saved=JSON.parse(JSON.stringify(f.server.entry.document));
   assert.ok(saved.textDelta.ops.some(op=>op.attributes?.['table-colspan']==='2'));
   assert.ok(saved.textDelta.ops.some(op=>op.attributes?.['table-rowspan']==='2'));
   await f.page.locator('.study-notebook-close').click();
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await root.locator('img').waitFor();
   assert.match(await root.locator('table td').last().innerText(),/Bình phụ trách/);
   assert.deepEqual(JSON.parse(await f.page.evaluate(()=>JSON.stringify(window.vm.session.document))),saved);
   const print=f.page.context().newPage();const printPage=await print;
   await printPage.setContent(await f.page.evaluate(()=>window.injector.get('TnttDocumentPrint').markup('Dán bảng và ảnh',window.vm.session.document)));
   assert.equal(await printPage.locator('.text table td').count(),4);
   assert.equal(await printPage.locator('.text img').evaluate(e=>e.complete&&e.naturalWidth),400);
   assert.match(await printPage.locator('.text').innerText(),/Bình phụ trách/);
   await printPage.pdf({path:path.join(app,'../../.tmp/tntt-pasted-table-'+width+'.pdf'),preferCSSPageSize:true});
   await printPage.close();
   await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-pasted-table-'+width+'.png')});
   assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('pasting an image file is atomic and invalid clipboard images cannot replace existing selected text',async()=>{
 const f=await fixture();
 try{
  await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
  await f.page.locator('.study-notebook-text').fill('Nội dung cần giữ');
  await f.page.locator('.study-notebook-text').evaluate(async el=>{
   el.focus();el.setSelectionRange(0,el.value.length);
   const data=new DataTransfer();data.setData('text/html','<img src="javascript:alert(1)">');
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await f.page.getByRole('status').filter({hasText:'Không lấy được ảnh'}).waitFor();
  const root=f.page.locator('.ql-editor');assert.equal(await root.innerText(),'Nội dung cần giữ');
  await f.page.getByRole('button',{name:'Bút',exact:true}).click();
  await f.page.locator('.study-notebook-canvas').evaluate(async el=>{
   const q=Quill.find(document.querySelector('.study-notebook-rich-text'));q.setSelection(q.getLength()-1,0,'silent');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(20,20,120,120);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve));const data=new DataTransfer();data.items.add(new File([blob],'clipboard.png',{type:'image/png'}));
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await root.locator('img').waitFor();
  assert.match(await root.innerText(),/Nội dung cần giữ/);
  await f.page.waitForFunction(()=>!angular.element(document.querySelector('study-notebook')).controller('studyNotebook').pasting);
  await f.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();await root.locator('img').waitFor({state:'detached'});
  await f.page.getByRole('button',{name:'Khôi phục ghi chú',exact:true}).click();await root.locator('img').waitFor();
  await f.page.waitForFunction(()=>window.vm.session.status==='saved');
  const saved=structuredClone(f.server.entry.document);
  await root.evaluate(async el=>{
   const canvas=document.createElement('canvas');canvas.width=123;canvas.height=80;const blob=await new Promise(resolve=>canvas.toBlob(resolve));
   const data=new DataTransfer();data.items.add(new File([blob],'cancelled.png',{type:'image/png'}));
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
   angular.element(document.querySelector('study-notebook')).controller('studyNotebook').close();
  });
  await f.page.waitForFunction(()=>!window.vm.active);
  await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();await root.locator('img').waitFor();
  assert.deepEqual(await f.page.evaluate(()=>window.vm.session.document),saved,'Closing during image decoding cannot change the saved note');
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});

test('selected text gets a safe blue underlined link from its context menu and survives reopening and print',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width});try{
   const {page,server}=f;await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   const text=page.locator('.study-notebook-text');await text.fill('Biên bản cuộc họp');
   await text.evaluate(node=>{node.focus();node.setSelectionRange(0,8)});
   const box=await text.boundingBox();
   await text.dispatchEvent('contextmenu',{clientX:box.x+60,clientY:box.y+55});
   await page.getByRole('menuitem',{name:/Chèn liên kết/}).click();
   const form=page.getByRole('dialog',{name:'Chèn liên kết',exact:true});
   assert.equal(await form.locator('.study-notebook-link-selection').innerText(),'Biên bản');
   await form.getByRole('textbox',{name:'Địa chỉ liên kết'}).fill('javascript:alert(1)');
   await form.getByRole('button',{name:'Áp dụng',exact:true}).click();assert.match(await form.getByRole('alert').innerText(),/hợp lệ/);
   const url='https://tnttphungkhoang.com/tai-lieu?a=1&b=2';
   await form.getByRole('textbox',{name:'Địa chỉ liên kết'}).fill(url);
   await form.getByRole('button',{name:'Áp dụng',exact:true}).click();
   const link=page.locator('.study-notebook-rich-text .ql-editor a');
   assert.equal(await link.innerText(),'Biên bản');assert.equal(await link.getAttribute('href'),url);
   assert.deepEqual(await link.evaluate(node=>({color:getComputedStyle(node).color,decoration:getComputedStyle(node).textDecorationLine})),{color:'rgb(26, 115, 232)',decoration:'underline'});
   await f.context.route(url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Linked website</title>'}));
   const opened=page.waitForEvent('popup');await link.click();const target=await opened;
   await target.waitForLoadState('domcontentloaded');assert.equal(target.url(),url);
   assert.equal(await target.evaluate(()=>window.opener),null,'The linked website cannot control the document tab');
   assert.match(page.url(),/\/tai-lieu$/);assert.equal(await page.locator('.study-notebook-dialog').isVisible(),true);await target.close();
   assert.equal(await page.locator('.study-notebook-rich-text .ql-editor').innerText(),'Biên bản cuộc họp');
   await page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.equal(server.entry.document.textDelta.ops[0].attributes.link,url);
   const print=await page.evaluate(()=>injector.get('TnttDocumentPrint').markup('Biên bản',window.vm.session.document));
   assert.match(print,/href="https:\/\/tnttphungkhoang.com\/tai-lieu\?a=1&amp;b=2"/);assert.match(print,/color:#1a73e8;text-decoration:underline/);
   await page.locator('.study-notebook-close').click();await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   assert.equal(await page.locator('.study-notebook-rich-text .ql-editor a').innerText(),'Biên bản');
   const selected=await page.evaluate(()=>{Quill.find(document.querySelector('.study-notebook-rich-text')).setSelection(0,8);const r=getSelection().getRangeAt(0).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
   await page.mouse.click(selected.x,selected.y,{button:'right'});await page.getByRole('menuitem',{name:/Chèn liên kết/}).click();
   assert.equal(await form.getByRole('textbox',{name:'Địa chỉ liên kết'}).inputValue(),url);
   await form.getByRole('textbox',{name:'Địa chỉ liên kết'}).press('Escape');await form.waitFor({state:'detached'});
   assert.equal(await page.locator('.study-notebook-dialog').isVisible(),true,'Escape closes the link editor before closing the note');
   assert.deepEqual(server.errors,[]);
  }finally{await f.context.close()}
 }
});

test('typed, pasted and legacy website addresses become links without linking trailing punctuation or following words',async()=>{
 const f=await fixture();try{
  const {page,server}=f;await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
  await page.locator('.study-notebook-text').fill('Xem https://example.com/path?q=1, và www.ieltsroom.com nhé.');
  const rich=page.locator('.study-notebook-rich-text .ql-editor');await rich.waitFor();
  assert.deepEqual(await rich.locator('a').allTextContents(),['https://example.com/path?q=1','www.ieltsroom.com']);
  await rich.press('Control+End');await page.keyboard.type(' https://example.org/path ');await page.keyboard.type('tiếp tục');
  await page.getByRole('button',{name:'Lưu ngay',exact:true}).click();await page.waitForFunction(()=>window.vm.session.status==='saved');
  assert.equal(await rich.locator('a').last().innerText(),'https://example.org/path');
  assert.equal(await rich.locator('a').last().getAttribute('href'),'https://example.org/path');
  assert.ok(server.entry.document.text.endsWith('tiếp tục'));
  await rich.press('Control+End');await page.keyboard.type(' ');
  await rich.evaluate(node=>{const data=new DataTransfer();data.setData('text/plain','https://example.net/pasted');node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))});
  await rich.locator('a[href="https://example.net/pasted"]').waitFor();
  await page.getByRole('button',{name:'Lưu ngay',exact:true}).click();await page.waitForFunction(()=>window.vm.session.status==='saved');
  assert.ok(server.entry.document.textDelta.ops.some(op=>op.attributes?.link==='https://example.net/pasted'));
  assert.deepEqual(server.errors,[]);
 }finally{await f.context.close()}
});

test('a link dialog follows its selected text across a remote edit and the resulting destination syncs to both editors',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7}),b=await fixture({collaboration:room,userId:8});
 try{
  await openLive(a);await openLive(b);
  await a.page.locator('.study-notebook-text').fill('Biên bản họp');
  await b.page.waitForFunction(()=>window.vm.session.document.text==='Biên bản họp');
  const text=a.page.locator('.study-notebook-text');await text.evaluate(node=>{node.focus();node.setSelectionRange(0,8)});await text.press('Control+k');
  const form=a.page.getByRole('dialog',{name:'Chèn liên kết',exact:true});await form.waitFor();
  await b.page.locator('.study-notebook-text').press('Control+Home');await b.page.keyboard.insertText('Mới: ');
  await a.page.waitForFunction(()=>window.vm.session.document.text==='Mới: Biên bản họp');
  await form.getByRole('textbox',{name:'Địa chỉ liên kết'}).fill('https://example.com/minutes');
  await form.getByRole('button',{name:'Áp dụng',exact:true}).click();
  for(const f of[a,b])await f.page.locator('.study-notebook-rich-text .ql-editor a').getByText('Biên bản',{exact:true}).waitFor();
  assert.equal(room.server.entry.document.text,'Mới: Biên bản họp');
  assert.equal(room.server.entry.document.textDelta.ops.find(op=>op.attributes?.link).attributes.link,'https://example.com/minutes');
  assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
});

test('text colors apply to the selection or future typing and underline persists in documents and print',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width});try{
   const {page}=f,button=name=>page.getByRole('button',{name,exact:true});
   await button('Soạn nội dung').click();
   const text=page.locator('.study-notebook-text'),root=page.locator('.ql-editor'),palette=page.getByRole('dialog',{name:'Bảng màu chữ và bút',exact:true});
   await text.fill('Giữ nguyên. Đổi màu.');
   await text.evaluate(el=>{el.focus();el.setSelectionRange(el.value.indexOf('Đổi'),el.value.length)});
   await button('Màu chữ và bút').click();await palette.getByRole('button',{name:'Màu #FF0000',exact:true}).click();
   const red=root.locator('[style*="color: rgb(255, 0, 0)"]');await red.waitFor();assert.equal(await red.innerText(),'Đổi màu.');
   assert.equal(await root.locator('p').evaluate(el=>getComputedStyle(el).color),'rgb(39, 54, 77)');
   await button('Gạch chân').click();await root.locator('u').waitFor();assert.equal(await root.locator('u').innerText(),'Đổi màu.');
   await root.press('Control+u');await root.locator('u').waitFor({state:'detached'});
   await root.press('Control+u');await root.locator('u').waitFor();
   await root.press('Control+End');
   await button('Gõ chữ').click();await palette.getByRole('button',{name:'Màu #0000FF',exact:true}).click();
   await page.keyboard.insertText(' Viết tiếp');
   const blue=root.locator('[style*="color: rgb(0, 0, 255)"]');await blue.waitFor();assert.equal(await blue.innerText(),' Viết tiếp');
   assert.equal(await red.innerText(),'Đổi màu.');
   await page.waitForFunction(()=>window.vm.session.status==='saved');
   const saved=structuredClone(f.server.entry.document);
   assert.ok(saved.textDelta.ops.some(op=>op.insert==='Đổi màu.'&&op.attributes.color==='#ff0000'&&op.attributes.underline));
   assert.ok(saved.textDelta.ops.some(op=>op.insert===' Viết tiếp'&&op.attributes.color==='#0000ff'));
   const popupPromise=page.waitForEvent('popup');await page.evaluate(()=>window.injector.get('TnttDocumentPrint').open('Màu chữ',window.vm.session.document));
   const popup=await popupPromise;await popup.locator('u').first().waitFor();assert.equal(await popup.locator('span[style*="#ff0000"] u, u span[style*="#ff0000"]').innerText(),'Đổi màu.');await popup.close();
   await page.locator('.study-notebook-close').click();await button('Soạn nội dung').click();
   await red.waitFor();assert.equal(await root.locator('u').first().innerText(),'Đổi màu.');assert.deepEqual(await page.evaluate(()=>window.vm.session.document),saved);
   assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('share links select the right document and cannot turn a read-only account into an editor',async()=>{
 const author=await fixture({params:{document:'12',mode:'view'}});
 try {
  await author.page.waitForFunction(()=>document.querySelector('.study-notebook-text')?.readOnly);
  assert.equal(await author.page.locator('.study-notebook-tools').count(),0);
  await author.page.locator('.study-notebook-close').click();
  await author.page.getByRole('button',{name:'Chia sẻ link'}).click();
  await author.page.getByRole('button',{name:'Tạo link chỉ xem'}).click();
  const link=author.page.getByRole('textbox',{name:'Đường dẫn'});
  assert.equal(await link.inputValue(),'https://tnttphungkhoang.test/tntt_documents/shared.html#0123456789abcdef0123456789abcdef');
  await author.page.getByLabel('Chế độ mở').selectOption('edit');
  assert.equal(await link.inputValue(),'https://tnttphungkhoang.test/tai-lieu?document=12&mode=edit');
  await author.page.getByLabel('Chế độ mở').selectOption('view');
  await author.page.getByRole('button',{name:'Thu hồi link chỉ xem'}).click();
  await author.page.getByText('Đã thu hồi liên kết chỉ xem.').waitFor();
  assert.equal(await link.count(),0);
 } finally {await author.context.close();}
 const reader=await fixture({editor:false,params:{document:'12',mode:'edit'}});
 try {
  await reader.page.getByRole('alert').filter({hasText:'Chỉ Admin và Quản lý đào tạo'}).waitFor();
  assert.equal(reader.server.calls.filter(call=>call.path.endsWith('/entries/12')).length,0);
 } finally {await reader.context.close();}
 const editor=await fixture({params:{document:'12',mode:'edit'}});
 try {
  await editor.page.locator('.study-notebook-tools').waitFor();
  assert.equal(await editor.page.evaluate(()=>window.vm.active.id),12);
 } finally {await editor.context.close();}
});

test('a guest can open the public notebook without a session and a revoked link shows an error', async () => {
 const context=await browser.newContext(), page=await context.newPage();
 const token='0123456789abcdef0123456789abcdef', url='https://tnttphungkhoang.test/tntt_documents/shared.html#'+token;
 let revoked=false;
 try {
  await page.route('**/*', route => {
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/service/public/tntt-documents/'+token){
    assert.equal(route.request().method(),'GET');
    assert.equal(route.request().headers().authorization,undefined);
    return route.fulfill({status:revoked?404:200,json:{title:'20261108. Câu hỏi hội chợ và phân công chuẩn bị cho các gian hàng',document:{...blank(),text:'Nội dung chỉ xem'}}});
   }
   const file=path.join(app,pathname.slice(1));
   if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   return route.fulfill({status:404});
  });
  await page.goto(url);
  const notebook=page.locator('.study-notebook-text');
  await notebook.waitFor();
  assert.equal(await notebook.inputValue(),'Nội dung chỉ xem');
  assert.equal(await notebook.evaluate(element=>element.readOnly),true);
  assert.equal(await page.locator('.study-notebook-tools').count(),0);
  assert.deepEqual(await context.cookies(),[]);
  for(const width of[1440,768,390,320]){
   await page.setViewportSize({width,height:950});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const geometry=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,center:r.top+r.height/2}};
    const heading=document.querySelector('.td-public-heading'),notebook=document.querySelector('.study-notebook-heading');
    return{header:rect(heading),items:[...heading.children].filter(node=>node.getClientRects().length).map(rect),notebook:rect(notebook),controls:[...notebook.querySelectorAll('.study-notebook-heading__copy,.study-notebook-heading__settings,.study-notebook-heading__actions')].map(rect),dialogTop:document.querySelector('.study-notebook-dialog').getBoundingClientRect().top,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
   });
   assert.ok(geometry.header.height<=52,'public header uses one compact row: '+JSON.stringify(geometry));
   assert.ok(geometry.items.every(item=>Math.abs(item.center-geometry.header.center)<2),'public header items share the same row');
   assert.ok(geometry.notebook.height<=40&&geometry.controls.every(item=>Math.abs(item.center-geometry.notebook.center)<2),'viewer title and zoom remain on one row: '+JSON.stringify(geometry));
   assert.ok(geometry.dialogTop<120,'the document starts near the top instead of below a large banner');
   assert.ok(geometry.scrollWidth<=geometry.width+1,'compact public header does not overflow the phone');
   assert.equal(await page.getByRole('link',{name:'Về trang chủ',exact:true}).getAttribute('href'),'/login');
   if(width===1440||width===390)await page.screenshot({path:path.join(app,'../../.tmp/tntt-public-compact-'+width+'.png')});
  }
  revoked=true;
  await page.reload();
  await page.getByRole('alert').filter({hasText:'đã bị thu hồi'}).waitFor();
  assert.equal(await notebook.count(),0);
 } finally {await context.close();}
});

test('shared minutes type and draw with the existing A4 editor, autosave together and preserve read-only snapshots',async()=>{
 const f=await fixture();try{
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-documents-desktop.png')});
  await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
  await f.page.locator('.study-notebook-text').fill('BIÊN BẢN HỌP\nThiếu nhi cùng sống yêu thương.');
  await f.page.getByRole('button',{name:'Bút',exact:true}).click();
  await f.page.locator('.study-notebook-heading__copy').click();
  const box=await f.page.locator('.study-notebook-canvas').boundingBox();
  await f.page.mouse.move(box.x+70,box.y+110);await f.page.mouse.down();await f.page.mouse.move(box.x+160,box.y+140,{steps:8});await f.page.mouse.up();
  await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status==='saved');
  assert.match(f.server.entry.document.text,/BIÊN BẢN HỌP/);assert.equal(f.server.entry.document.strokes.length,1);
  await f.page.locator('.study-notebook-close').click();await f.page.waitForFunction(()=>!window.vm.active);
  await f.page.evaluate(()=>{window.vm.openNotice({id:21});window.injector.get('$rootScope').$digest();});
  await f.page.waitForFunction(()=>document.querySelector('.study-notebook-text')?.readOnly);
  assert.equal(await f.page.locator('.study-notebook-text').inputValue(),'Nội dung đã công bố');
  assert.equal(await f.page.locator('.study-notebook-tools').count(),0);
  assert.equal(await f.page.getByRole('button',{name:'Màu chữ và bút',exact:true}).count(),0);
  assert.equal(await f.page.getByRole('button',{name:'Khoanh vùng',exact:true}).count(),0);
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});

test('tools open independent palettes with thin strokes, zoom resets on double click and page controls stay fixed',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width});try{
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status!=='loading');
   await f.page.locator('.study-notebook-text').fill('abc · Chữ và bút cùng màu');
   await f.page.getByRole('button',{name:'Bút',exact:true}).click();
   async function draw(offset){await f.page.locator('.study-notebook-heading__copy').click();const box=await f.page.locator('.study-notebook-canvas').boundingBox();await f.page.mouse.move(box.x+40,box.y+70+offset);await f.page.mouse.down();await f.page.mouse.move(box.x+120,box.y+90+offset,{steps:5});await f.page.mouse.up();}
   await draw(0);
   const trigger=f.page.getByRole('button',{name:'Màu chữ và bút',exact:true}),palette=f.page.getByRole('dialog',{name:'Bảng màu chữ và bút',exact:true});
   await f.page.getByRole('button',{name:'Bút',exact:true}).click();await palette.waitFor({state:'visible'});
   assert.equal(await palette.locator('.study-notebook-palette-heading').innerText(),'Bút');
   assert.equal(await palette.getByRole('button',{name:'Mảnh',exact:true}).getAttribute('aria-pressed'),'true');
   const bounds=await palette.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=950);
   assert.equal(await palette.locator('.study-notebook-palette-grid button').count(),80);
   const unobscured=await palette.evaluate(e=>{const swatch=e.querySelector('button'),r=swatch.getBoundingClientRect();return swatch.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
   assert.equal(unobscured,true,'The palette opens outside the scrolling toolbar without clipping');
   await f.page.screenshot({path:path.join(app,`../../.tmp/notebook-palette-${width}.png`)});
   await palette.getByRole('button',{name:'Vừa',exact:true}).click();
   await palette.getByRole('button',{name:'Màu #FF0000',exact:true}).click();
   await palette.waitFor({state:'hidden'});
   assert.equal(await f.page.locator('.study-notebook-text').evaluate(e=>getComputedStyle(e).color),'rgb(39, 54, 77)');
   await draw(35);
   await f.page.getByRole('button',{name:'Gõ chữ',exact:true}).click();
   await palette.waitFor({state:'visible'});
   assert.equal(await palette.locator('.study-notebook-palette-heading').innerText(),'Gõ chữ');
   assert.equal(await palette.locator('.study-notebook-palette-widths').count(),0);
   await palette.getByRole('button',{name:'Thêm màu tùy chỉnh'}).click();
   const hex=palette.getByRole('textbox',{name:'Mã màu HEX'});
   await hex.fill('#ZZZZZZ');assert.equal(await palette.getByRole('button',{name:'Áp dụng',exact:true}).isDisabled(),true);
   await hex.fill('#123ABC');await palette.getByRole('button',{name:'Áp dụng',exact:true}).click();
   await palette.waitFor({state:'hidden'});
   await f.page.keyboard.insertText('Chữ màu xanh');
   await f.page.getByRole('button',{name:'Đánh dấu',exact:true}).click();
   await palette.waitFor({state:'visible'});
   assert.equal(await palette.locator('.study-notebook-palette-heading').innerText(),'Đánh dấu');
   assert.equal(await palette.getByRole('button',{name:'Mảnh',exact:true}).getAttribute('aria-pressed'),'true');
   await palette.getByRole('button',{name:'Màu #FFFF00',exact:true}).click();await draw(70);
   await f.page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.deepEqual(f.server.entry.document.strokes.map(s=>s.color),['#315bbe','#ff0000','#ffff00']);
   assert.deepEqual(f.server.entry.document.strokes.map(s=>s.width),[2,4,8]);
   assert.ok(f.server.entry.document.textDelta.ops.some(op=>op.insert==='Chữ màu xanh'&&op.attributes.color==='#123abc'));
   await f.page.getByRole('button',{name:'Bút',exact:true}).click();
   await palette.waitFor({state:'visible'});
   assert.equal(await palette.getByRole('button',{name:'Vừa',exact:true}).getAttribute('aria-pressed'),'true');
   const red=palette.getByRole('button',{name:'Màu #FF0000',exact:true});
   assert.equal(await red.getAttribute('aria-pressed'),'true');
   await red.press('ArrowRight');await f.page.keyboard.press('Enter');
   await palette.waitFor({state:'hidden'});
   await f.page.getByRole('button',{name:'Gõ chữ',exact:true}).click();
   await palette.waitFor({state:'visible'});
   assert.equal(await palette.getByRole('button',{name:'Màu tùy chỉnh #123ABC',exact:true}).getAttribute('aria-pressed'),'true');
   await f.page.keyboard.press('Escape');await palette.waitFor({state:'hidden'});
   assert.equal(await f.page.locator('.study-notebook-overlay').isVisible(),true,'Escape first closes the palette and keeps the document open');
   await trigger.click();await f.page.locator('.study-notebook-heading__copy').click();await palette.waitFor({state:'hidden'});
   assert.equal(await f.page.locator('.study-notebook-heading__settings .study-notebook-zoom').count(),1);
   assert.equal(await f.page.getByRole('button',{name:'Vừa trang',exact:true}).count(),0);
   await f.page.getByRole('button',{name:'Phóng to trang giấy',exact:true}).click();
   await f.page.locator('.study-notebook-zoom output').getByText('125%').waitFor();
   await f.page.getByRole('slider',{name:'Kéo để thu phóng trang giấy'}).dblclick();
   await f.page.locator('.study-notebook-zoom output').getByText('100%').waitFor();
   const pageControls=f.page.locator('.study-notebook-pages'),before=await pageControls.boundingBox();
   await f.page.locator('.study-notebook-scroll').evaluate(node=>{node.scrollTop=600;});
   const after=await pageControls.boundingBox();
   assert.ok(Math.abs(after.y-before.y)<1,'Page controls stay fixed when the document scrolls');
   assert.ok(after.x>=0&&after.x+after.width<=width&&after.y>650,'Page controls fit the lower right of the editor');
   await f.page.locator('.study-notebook-close').click();await f.page.waitForFunction(()=>!window.vm.active);
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status==='saved');
   assert.deepEqual(await f.page.evaluate(()=>window.vm.session.document.strokes.map(s=>s.color)),['#315bbe','#ff0000','#ffff00']);
   assert.equal(await f.page.locator('.ql-editor span').getByText('Chữ màu xanh',{exact:true}).evaluate(e=>getComputedStyle(e).color),'rgb(18, 58, 188)');
   assert.deepEqual(f.server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('saved pen and highlighter ink is visible on reopening before any zoom or tool change, including slow loads',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width,notebookReadDelay:350});try{
   await f.page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await f.page.waitForFunction(()=>window.vm.session&&window.vm.session.status!=='loading');
   await f.page.locator('.study-notebook-text').fill('Biên bản có chữ gõ và nét bút đã lưu.');
   for(const tool of ['Bút','Đánh dấu']){
    await f.page.getByRole('button',{name:tool,exact:true}).click();
    await f.page.locator('.study-notebook-heading__copy').click();
    await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
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

test('TNTT documents open with three A4 pages and save added pages with handwriting and read-only navigation',async()=>{
 for(const width of [1440,390]){
  const f=await fixture({width});try{
   const {page,server}=f;
   const button=name=>page.getByRole('button',{name,exact:true});
   await button('Soạn nội dung').click();
   await page.waitForFunction(()=>window.vm.session?.status==='ready');
   const chooser=page.getByRole('combobox',{name:'Chọn trang tài liệu',exact:true});
   await page.waitForFunction(()=>document.querySelector('[aria-label="Chọn trang tài liệu"]')?.options.length===3);
   assert.equal(await chooser.locator('option').count(),3,'Legacy documents also start with three pages');
   assert.equal(await page.locator('.study-notebook-page-boundary').count(),3);
   await page.locator('.study-notebook-text').fill('Biên bản gõ chữ và viết tay trên các trang.');
   await button('Bút').click();
   await page.locator('.study-notebook-heading__copy').click();
   await chooser.selectOption({label:'2'});
   async function draw(){
    const canvas=page.locator('.study-notebook-canvas');
    const view=await page.locator('.study-notebook-scroll').boundingBox();
    const ink=await canvas.boundingBox();
    await page.mouse.move(ink.x+65,view.y+70);await page.mouse.down();
    await page.mouse.move(ink.x+135,view.y+100,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>window.vm.session?.status==='saved');
    assert.equal(await canvas.evaluate(node=>node.width*node.height<=4000000),true);
   }
   await draw();
   assert.ok(server.entry.document.strokes[0].points[0][1]>1123);
   assert.equal(await page.locator('.study-notebook-add-page').innerText(),'+');
   assert.doesNotMatch(await page.locator('.study-notebook-pages label').innerText(),/Trang/);
   assert.equal(await page.locator('.study-notebook-pages label > span').innerText(),'/ 3');
   await button('Thêm trang').click();
   await page.waitForFunction(()=>window.vm.session?.status==='saved');
   assert.equal(await chooser.locator('option').count(),4);
   assert.equal(await chooser.locator('option:checked').innerText(),'4');
   assert.equal(server.entry.document.pageCount,4);
   await draw();
   assert.ok(server.entry.document.strokes[1].points[0][1]>3*1123);
   const saved=structuredClone(server.entry.document);
   await page.screenshot({path:path.join(app,'../../.tmp/tntt-document-pages-'+width+'.png')});
   await page.locator('.study-notebook-close').click();await page.waitForFunction(()=>!window.vm.active);
   await button('Soạn nội dung').click();
   await page.waitForFunction(()=>window.vm.session?.status==='saved');
   await page.waitForFunction(()=>document.querySelector('[aria-label="Chọn trang tài liệu"]')?.options.length===4);
   assert.equal(await chooser.locator('option').count(),4);
   assert.deepEqual(await page.evaluate(()=>window.vm.session.document),saved);
   await button('Trang sau').click();
   assert.equal(await chooser.locator('option:checked').innerText(),'2');
   await button('Trang trước').click();
   assert.equal(await chooser.locator('option:checked').innerText(),'1');
   await page.locator('.study-notebook-close').click();await page.waitForFunction(()=>!window.vm.active);
   await page.evaluate(row=>{window.vm.active={id:12,title:row.title,readOnly:true,snapshot:row};window.injector.get('$rootScope').$digest();},server.entry);
   await page.waitForFunction(()=>document.querySelector('.study-notebook-text')?.readOnly);
   await page.waitForFunction(()=>document.querySelector('[aria-label="Chọn trang tài liệu"]')?.options.length===4);
   assert.equal(await chooser.locator('option').count(),4);
   assert.equal(await button('Thêm trang').count(),0);
   await chooser.selectOption({label:'4'});
   assert.equal(await page.locator('.study-notebook-text').inputValue(),saved.text);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('TNTT lasso moves outlined handwriting as one edit and keeps its position after reopening',async()=>{
 const original={...blank(),text:'Nội dung đã gõ',strokes:[
  {id:'pen',tool:'pen',color:'#315bbe',width:4,points:[[105,188,.31],[147,215,.82],[170,217,.55]]},
  {id:'marker',tool:'highlighter',color:'#ffd032',width:16,points:[[70,237],[260,237]]},
  {id:'outside-outline',tool:'pen',color:'#bc2844',width:4,points:[[213,265],[220,270]]}
 ]};
 for(const width of [1440,390]){
  const f=await fixture({width});try{
   const {page,server}=f;
   server.entry.document=structuredClone(original);
   const button=name=>page.getByRole('button',{name,exact:true});
   await button('Soạn nội dung').click();
   await page.waitForFunction(()=>window.vm.session?.status==='ready');
   await button('Phóng to trang giấy').click();
   await page.locator('.study-notebook-zoom output').getByText('125%').waitFor();
   const canvas=page.locator('.study-notebook-canvas');
   const lasso=button('Khoanh vùng');
   assert.equal(await page.locator('.study-notebook-color + .study-notebook-lasso-toggle').count(),1);
   await lasso.click();
   assert.equal(await lasso.getAttribute('aria-pressed'),'true');
   const box=await canvas.boundingBox(),scale=box.width/794;
   async function pointer(type,[x,y]){
    const clientX=box.x+x*scale,clientY=box.y+y*scale;
    if(width===390){
     await canvas.dispatchEvent(type,{clientX,clientY,pointerId:21,pointerType:'pen',pressure:.6,bubbles:true,cancelable:true});
    }else{
     await page.mouse.move(clientX,clientY);
     if(type==='pointerdown')await page.mouse.down();
     if(type==='pointerup')await page.mouse.up();
    }
   }
   async function inkAt(x,y){
    return canvas.evaluate((node,[logicalX,logicalY])=>{
     const factor=node.width/794;
     const pixels=node.getContext('2d').getImageData(Math.round(logicalX*factor)-2,Math.round(logicalY*factor)-2,5,5).data;
     return pixels.some((value,index)=>index%4===3&&value>0);
    },[x,y]);
   }
   await pointer('pointerdown',[90,165]);
   await pointer('pointermove',[225,170]);
   await pointer('pointermove',[155,290]);
   await pointer('pointerup',[90,165]);
   await page.getByText('Kéo vùng nét đã chọn đến vị trí mới.',{exact:true}).waitFor();
   assert.equal(await button('Hoàn tác ghi chú').isDisabled(),true);
   if(width===390){
    await pointer('pointerdown',[148,213]);
    await pointer('pointermove',[328,308]);
    await pointer('pointercancel',[328,308]);
    assert.deepEqual(await page.evaluate(()=>window.vm.session.document),original);
   }
   await pointer('pointerdown',[148,213]);
   await pointer('pointermove',[328,308]);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await inkAt(130,237),false,'The original ink is hidden during the drag preview');
   assert.equal(await inkAt(310,332),true,'The selected marker is visible at its preview position');
   assert.deepEqual(await page.evaluate(()=>window.vm.session.document),original,'Dragging only previews until pointer-up');
   await pointer('pointerup',[328,308]);
   await page.waitForFunction(()=>window.vm.session?.status==='saved');
   const moved=structuredClone(server.entry.document);
   assert.equal(moved.text,original.text);
   assert.deepEqual(moved.strokes[2],original.strokes[2],'A stroke inside the bounding box but outside the lasso stays put');
   for(const [index,stroke] of moved.strokes.slice(0,2).entries()){
    const {points,...style}=original.strokes[index],{points:after,...savedStyle}=stroke;
    assert.deepEqual(savedStyle,style);
    assert.equal(after.length,points.length);
    for(const [i,point] of after.entries()){
     assert.ok(Math.abs(point[0]-points[i][0]-180)<2.5);
     assert.ok(Math.abs(point[1]-points[i][1]-95)<2.5);
     assert.deepEqual(point.slice(2),points[i].slice(2));
    }
   }
   await button('Hoàn tác ghi chú').click();
   assert.deepEqual(await page.evaluate(()=>window.vm.session.document),original);
   await button('Khôi phục ghi chú').click();
   await page.waitForFunction(()=>window.vm.session?.status==='saved');
   await page.locator('.study-notebook-close').click();
   await page.waitForFunction(()=>!window.vm.active);
   await button('Soạn nội dung').click();
   await page.waitForFunction(()=>window.vm.session?.status==='saved');
   assert.deepEqual(await page.evaluate(()=>window.vm.session.document),moved);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await inkAt(130,237),false);
   assert.equal(await inkAt(310,332),true,'Reopening paints the moved ink before any tool or zoom change');
   assert.deepEqual(server.errors,[]);
  }finally{await f.context.close();}
 }
});

test('notebook fullscreen fills the viewport, exits with its button or Escape and cleans up on close in editing and read-only views',async()=>{
 for(const[width,readOnly,native]of[[1440,false,true],[390,true,true],[1440,true,false],[390,false,false]]){
  const f=await fixture({width,editor:!readOnly,params:readOnly?{document:'12',mode:'view'}:{}});try{
   const{page,server}=f;if(!readOnly)await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await page.locator('.study-notebook-dialog').waitFor();
   if(!readOnly)await page.locator('.study-notebook-text').fill('Toàn màn hình giữ nguyên nội dung.');
   await page.waitForFunction(()=>angular.element(document.querySelector('study-notebook')).controller('studyNotebook').session?.document);
   const original=await page.evaluate(()=>angular.element(document.querySelector('study-notebook')).controller('studyNotebook').session.document.text);
   if(!native)await page.locator('.study-notebook-overlay').evaluate(node=>{node.requestFullscreen=()=>Promise.reject(new Error('Fullscreen is unavailable'))});
   await page.getByRole('button',{name:'Bật toàn màn hình',exact:true}).click();
   if(native)await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('study-notebook-overlay'));
   await page.waitForFunction(()=>document.querySelector('.study-notebook-overlay')?.classList.contains('is-fullscreen'));
   const bounds=await page.locator('.study-notebook-dialog').evaluate(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,vw:innerWidth,vh:innerHeight}});
   assert.ok(Math.abs(bounds.x)<1&&Math.abs(bounds.y)<1,JSON.stringify(bounds));
   assert.ok(Math.abs(bounds.width-bounds.vw)<1&&Math.abs(bounds.height-bounds.vh)<1,JSON.stringify(bounds));
   assert.equal(await page.evaluate(()=>angular.element(document.querySelector('study-notebook')).controller('studyNotebook').session.document.text),original);
   await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();
   await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('.study-notebook-overlay')?.classList.contains('is-fullscreen'));
   assert.equal(await page.locator('.study-notebook-dialog').isVisible(),true);
   await page.getByRole('button',{name:'Bật toàn màn hình',exact:true}).click();
   if(native)await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('study-notebook-overlay'));
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Bật toàn màn hình',exact:true}).waitFor();
   assert.equal(await page.locator('.study-notebook-dialog').isVisible(),true,'Escape exits fullscreen without closing the document');
   await page.getByRole('button',{name:'Bật toàn màn hình',exact:true}).click();
   if(native)await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('study-notebook-overlay'));
   await page.locator('.study-notebook-close').click();
   await page.waitForFunction(()=>!document.fullscreenElement&&!window.vm.active);
   assert.deepEqual(server.errors,[]);
  }finally{await f.context.close()}
 }
});

test('paragraph alignment buttons and Ctrl Shift L E R J persist with links, print and reopening',async()=>{
 for(const width of[1440,390]){
  const f=await fixture({width});try{
   const {page,server}=f;await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   const text=page.locator('.study-notebook-text'),contents='BIÊN BẢN HỌP\nNội dung cuộc họp và công việc được phân công.\nKết thúc';
   await text.fill(contents);await text.evaluate(node=>{node.focus();node.setSelectionRange(0,0)});await text.press('Control+Shift+E');
   const rich=page.locator('.study-notebook-rich-text .ql-editor');await rich.locator('p.ql-align-center').first().waitFor();
   for(const[key,alignment,label]of[['R','right','Căn phải'],['J','justify','Căn đều hai bên'],['L','left','Căn trái'],['E','center','Căn giữa']]){
    await rich.press('Control+Home');await rich.press('Control+Shift+'+key);
    assert.equal(await rich.locator('p').first().evaluate(node=>getComputedStyle(node).textAlign),alignment);
    assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
   }
   await page.evaluate(()=>{const q=Quill.find(document.querySelector('.study-notebook-rich-text'));q.setSelection(0,q.getLength()-1)});
   await rich.press('Control+Shift+E');
   assert.equal(await rich.locator('p.ql-align-center').count(),3);
   await page.evaluate(()=>Quill.find(document.querySelector('.study-notebook-rich-text')).setSelection(0,12));
   await page.getByRole('button',{name:'Căn phải',exact:true}).click();
   assert.equal(await rich.locator('p').first().evaluate(node=>getComputedStyle(node).textAlign),'right');
   await rich.press('Control+End');await page.keyboard.type(' https://example.com ');
   await page.getByRole('button',{name:'Lưu ngay',exact:true}).click();await page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.equal(server.entry.document.textDelta.ops.filter(op=>op.attributes?.align==='right').length,1);
   assert.equal(server.entry.document.textDelta.ops.filter(op=>op.attributes?.align==='center').length,2);
   assert.equal(server.entry.document.textDelta.ops.find(op=>op.attributes?.link)?.attributes.link,'https://example.com/');
   const markup=await page.evaluate(()=>injector.get('TnttDocumentPrint').markup('Họp',window.vm.session.document));
   assert.match(markup,/<p style="text-align:right">BIÊN BẢN HỌP<\/p>/);
   assert.match(markup,/<p style="text-align:center">/);
   await page.locator('.study-notebook-close').click();await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   await rich.locator('p.ql-align-right').waitFor();
   assert.equal(await rich.locator('p.ql-align-right').count(),1);assert.equal(await rich.locator('p.ql-align-center').count(),2);
   await page.screenshot({path:path.join(app,'../../.tmp/tntt-note-alignment-'+width+'.png')});
   assert.deepEqual(server.errors,[]);
  }finally{await f.context.close()}
 }
});

test('Shift Tab outdents selected lines without leaving the plain or rich editor or deleting their contents',async()=>{
 for(const width of[1440,390]){
  const f=await fixture({width});try{
   const{page,server}=f;await page.getByRole('button',{name:'Soạn nội dung',exact:true}).click();
   const text=page.locator('.study-notebook-text'),original='Một\nHai\nBa',indented='     Một\n     Hai\n     Ba';
   await text.fill(original);await text.press('Control+a');await text.press('Tab');assert.equal(await text.inputValue(),indented);
   await text.press('Shift+Tab');assert.equal(await text.inputValue(),original);await text.press('Shift+Tab');assert.equal(await text.inputValue(),original);
   assert.equal(await text.evaluate(node=>document.activeElement===node),true);
   await text.evaluate(node=>node.setSelectionRange(0,0));await text.press('Tab');await text.evaluate(node=>node.setSelectionRange(0,0));await text.press('Shift+Tab');
   assert.equal(await text.inputValue(),original,'Outdent also works with the caret before the leading spaces');
   await page.getByRole('button',{name:'Căn giữa',exact:true}).click();
   const rich=page.locator('.study-notebook-rich-text .ql-editor');
   await page.evaluate(()=>{const q=Quill.find(document.querySelector('.study-notebook-rich-text'));q.setSelection(0,q.getLength()-1)});
   await rich.press('Tab');assert.equal(await page.evaluate(()=>window.vm.session.document.text),indented);
   await rich.press('Shift+Tab');assert.equal(await page.evaluate(()=>window.vm.session.document.text),original);
   await rich.press('Shift+Tab');assert.equal(await rich.evaluate(node=>document.activeElement===node),true);
   assert.equal(await rich.locator('p.ql-align-center').count(),1);
   await rich.press('Control+z');assert.equal(await page.evaluate(()=>window.vm.session.document.text),indented);
   await rich.press('Control+y');assert.equal(await page.evaluate(()=>window.vm.session.document.text),original);
   await page.getByRole('button',{name:'Lưu ngay',exact:true}).click();await page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.equal(server.entry.document.text,original);assert.deepEqual(server.errors,[]);
  }finally{await f.context.close()}
 }
});

test('paragraph alignment converges live and undo preserves the other editors text',async()=>{
 const room=collaborationServer(),a=await fixture({collaboration:room,userId:7}),b=await fixture({collaboration:room,userId:8});
 try{
  await openLive(a);await openLive(b);await a.page.locator('.study-notebook-text').fill('Biên bản');
  await b.page.waitForFunction(()=>window.vm.session.document.text==='Biên bản');
  await a.page.locator('.study-notebook-text').press('Control+Home');await a.page.locator('.study-notebook-text').press('Control+Shift+E');
  const ar=a.page.locator('.study-notebook-rich-text .ql-editor'),br=b.page.locator('.study-notebook-rich-text .ql-editor');
  await br.locator('.ql-align-center').waitFor();await br.press('Control+Home');await b.page.keyboard.insertText('Mới: ');
  await a.page.waitForFunction(()=>window.vm.session.status==='saved'&&window.vm.session.document.text==='Mới: Biên bản');
  await a.page.getByRole('button',{name:'Hoàn tác ghi chú',exact:true}).click();
  await b.page.waitForFunction(()=>window.vm.session.status==='saved'&&!window.vm.session.document.textDelta.ops.some(op=>op.attributes?.align));
  assert.equal(room.server.entry.document.text,'Mới: Biên bản');assert.equal(await ar.locator('.ql-align-center').count(),0);assert.deepEqual(room.server.errors,[]);
 }finally{await a.context.close();await b.context.close()}
});

test('text shortcuts, selected bold and italic formatting and ink share undo history and persist together',async()=>{
 for(const width of [1440,390]){const f=await fixture({width});try{
  const {page,server}=f,button=name=>page.getByRole('button',{name,exact:true});
  await button('Soạn nội dung').click();
  const text=page.locator('.study-notebook-text');
  await text.fill('Abba Cha ơi');
  await text.evaluate(node=>{node.focus();node.setSelectionRange(0,0);});
  await text.press('Tab');
  assert.equal(await text.inputValue(),'     Abba Cha ơi');
  await text.press('Shift+Space');
  assert.equal(await text.inputValue(),'Abba Cha ơi');
  await text.press('Control+z');
  assert.equal(await text.inputValue(),'     Abba Cha ơi');
  await text.press('Control+y');
  assert.equal(await text.inputValue(),'Abba Cha ơi');
  await text.press('Shift+Space');
  assert.equal(await text.inputValue(),'Abba Cha ơi','Outdent must not delete a letter');
  await text.evaluate(node=>{node.focus();node.setSelectionRange(0,4);});
  await button('In đậm').click();
  const rich=page.locator('.study-notebook-rich-text .ql-editor');
  await rich.locator('strong').getByText('Abba',{exact:true}).waitFor();
  await button('In nghiêng').click();
  await rich.locator('strong em, em strong').getByText('Abba',{exact:true}).waitFor();
  await rich.press('Control+Home');await rich.press('Tab');
  await page.waitForFunction(()=>window.vm.session.document.text==='     Abba Cha ơi');
  await rich.press('Shift+Space');
  await page.waitForFunction(()=>window.vm.session.document.text==='Abba Cha ơi');
  await button('Bút').click();await page.locator('.study-notebook-heading__copy').click();
  const box=await page.locator('.study-notebook-canvas').boundingBox();
  await page.mouse.move(box.x+200,box.y+130);await page.mouse.down();
  await page.mouse.move(box.x+250,box.y+150,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>window.vm.session.document.strokes.length===1);
  await button('Hoàn tác ghi chú').click();
  assert.equal(await page.evaluate(()=>window.vm.session.document.strokes.length),0);
  assert.equal(await rich.locator('strong em, em strong').count(),1);
  await button('Khôi phục ghi chú').click();
  await page.waitForFunction(()=>window.vm.session.status==='saved');
  const saved=structuredClone(server.entry.document);
  assert.equal(saved.text,'Abba Cha ơi');assert.equal(saved.strokes.length,1);
  assert.ok(saved.textDelta.ops.some(op=>op.insert==='Abba'&&op.attributes.bold&&op.attributes.italic));
  const popupPromise=page.waitForEvent('popup');
  await page.evaluate(()=>window.injector.get('TnttDocumentPrint').open('Biên bản',window.vm.session.document));
  const popup=await popupPromise;await popup.locator('strong, em').first().waitFor();
  assert.equal(await popup.locator('strong em, em strong').innerText(),'Abba');await popup.close();
  await page.locator('.study-notebook-close').click();await page.waitForFunction(()=>!window.vm.active);
  await button('Soạn nội dung').click();
  await rich.locator('strong em, em strong').getByText('Abba',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.vm.session.document),saved);
  await page.evaluate(()=>{
   const editor=document.querySelector('.study-notebook-rich-text .ql-editor');
   editor.querySelector('p').appendChild(document.createTextNode(' Tiếng Việt'));
   angular.element(document.querySelector('study-notebook')).controller('studyNotebook').close();
  });
  await page.waitForFunction(()=>!window.vm.active);
  await page.waitForFunction(()=>!window.vm.session||window.vm.session.status==='saved');
  assert.match(server.entry.document.text,/Tiếng Việt$/);
  assert.deepEqual(server.errors,[]);
 }finally{await f.context.close();}}
});

test('the document explorer navigates nested folders, toggles views and finds nested files without mixing root contents',async()=>{
 const f=await fixture();try{
  f.server.entry.parentId=4;
  f.server.extraEntries=[{id:4,title:'Năm 2026',kind:'FOLDER',parentId:3,revision:0},
   ...Array.from({length:9},(_,i)=>({id:30+i,title:'Sinh hoạt tháng '+(i+1),kind:'FOLDER',parentId:null,revision:0})),
   {id:13,title:'Nội dung sinh hoạt chung',kind:'DOCUMENT',parentId:null,revision:0,updatedAt:Date.now()}];
  await f.page.evaluate(()=>window.vm.reload());
  assert.equal(await f.page.locator('.td-folder-open').count(),10);
  assert.deepEqual(await f.page.locator('.td-entry h2').allTextContents(),['Nội dung sinh hoạt chung']);
  assert.equal(await f.page.getByRole('button',{name:'Lên thư mục cha'}).isDisabled(),true);
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-document-explorer-grid.png')});
  await f.page.getByRole('button',{name:'Chuyển sang dạng danh sách'}).click();
  assert.equal(await f.page.locator('.td-folder-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
  await f.page.screenshot({path:path.join(app,'../../.tmp/tntt-document-explorer-list.png')});
  await f.page.getByRole('button',{name:'Chuyển sang dạng biểu tượng'}).click();
  await f.page.getByRole('button',{name:'Mở thư mục Biên bản họp',exact:true}).click();
  assert.equal(await f.page.locator('.td-entry').count(),0);
  await f.page.getByRole('button',{name:'Mở thư mục Năm 2026',exact:true}).click();
  assert.deepEqual(await f.page.locator('.td-entry h2').allTextContents(),['Biên bản tháng 11']);
  assert.deepEqual(await f.page.locator('.td-explorer-path button').allTextContents(),[' Tài liệu chung','Biên bản họp','Năm 2026']);
  await f.page.getByRole('button',{name:'Lên thư mục cha'}).click();
  assert.equal(await f.page.locator('.td-folder-open').count(),1);
  await f.page.getByRole('navigation',{name:'Đường dẫn thư mục'}).getByRole('button',{name:'Tài liệu chung',exact:true}).click();
  await f.page.getByRole('searchbox',{name:'Tìm tài liệu'}).fill('tháng 11');
  await f.page.getByRole('searchbox',{name:'Tìm tài liệu'}).press('Enter');
  await f.page.locator('.td-explorer-results').waitFor();
  assert.deepEqual(await f.page.locator('.td-entry h2').allTextContents(),['Biên bản tháng 11']);
  assert.equal(await f.page.locator('.td-entry-location').textContent(),'Biên bản họp / Năm 2026');
  await f.page.getByRole('button',{name:'Mở thư mục Năm 2026',exact:true}).click();
  await f.page.waitForFunction(()=>!window.vm.loading&&!window.vm.searchTerm);
  assert.equal(await f.page.getByRole('searchbox',{name:'Tìm tài liệu'}).inputValue(),'');
  await f.page.locator('.td-manage').getByRole('button',{name:'Tên / di chuyển'}).click();
  await f.page.locator('.td-dialog').waitFor();
  assert.equal(await f.page.locator('.td-dialog select option').count(),12,'All folders remain available as move destinations');
  await f.page.getByRole('button',{name:'Hủy',exact:true}).click();
  f.server.archivedEntries=[{id:70,title:'Tài liệu đã xóa',kind:'DOCUMENT',parentId:4,archived:true,revision:1}];
  await f.page.getByRole('button',{name:'Thùng rác',exact:true}).click();
  await f.page.getByRole('button',{name:'Khôi phục',exact:true}).waitFor();
  assert.equal(await f.page.getByRole('switch').count(),0);
  await f.page.getByRole('button',{name:'Quay lại tài liệu',exact:true}).click();
  await f.page.waitForFunction(()=>!window.vm.loading&&!window.vm.trash);
  assert.deepEqual(await f.page.locator('.td-entry h2').allTextContents(),['Nội dung sinh hoạt chung']);
  assert.equal(f.server.calls.some(c=>c.method!=='GET'),false,'Browsing never changes documents or sharing');
  assert.deepEqual(f.server.errors,[]);
 }finally{await f.context.close();}
});

test('document folder and list views fit a phone and keep read-only viewers out of editing controls',async()=>{
 for(const editor of [true,false]){
  const f=await fixture({width:390,dark:!editor,editor});try{
   f.server.extraEntries=Array.from({length:5},(_,i)=>({id:40+i,title:'Thư mục sinh hoạt và biên bản tháng '+(i+1),kind:'FOLDER',parentId:null,revision:0}));
   await f.page.evaluate(()=>window.vm.reload());
   for(const mode of ['grid','list']){
    if(mode==='list')await f.page.getByRole('button',{name:'Chuyển sang dạng danh sách'}).click();
    assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await f.page.locator('.td-explorer').evaluate(e=>e.scrollWidth>e.clientWidth),false);
    assert.equal(await f.page.getByRole('button',{name:'Tạo thư mục',exact:true}).count(),editor?1:0);
    assert.equal(await f.page.getByRole('button',{name:'Tên / di chuyển',exact:true}).count(),editor?1:0);
    assert.equal(await f.page.getByRole('switch').count(),editor?1:0);
    assert.equal(await f.page.getByRole('button',{name:editor?'Soạn nội dung':'Xem tài liệu',exact:true}).count(),1);
    await f.page.screenshot({path:path.join(app,`../../.tmp/tntt-document-explorer-${editor?'editor':'viewer'}-${mode}-390.png`)});
   }
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
   scope.vm=extra.get('$controller')('EnrolmentClassController',{$rootScope:root,$scope:scope,toastr:{error:msg=>{throw new Error(msg);},warning(){},success(){}},$uibModal:original.get('$uibModal'),EnrolmentClassService:service,$state:state,$stateParams:{},ComprehensiveFolders:{},ClassAssignmentPicker:{},TeachingPdf:null});
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
  await f.page.evaluate(()=>window.injector.get('TnttDocumentPrint').open('Biên bản <script>bad()</script>',{text:Array.from({length:110},(_,i)=>'Dòng '+i+': Nội dung họp tiếng Việt').join('\n'),textColor:'#123abc',orientation:'portrait',pattern:'lined',strokes:[{id:'ink',tool:'pen',color:'#315bbe',width:4,points:[[60,1500],[200,1560]]}]}));
  const popup=await popupPromise;await popup.locator('.paper').waitFor();assert.equal(await popup.locator('script').count(),1,'Only the built-in pagination helper may execute');assert.equal(await popup.title(),'Biên bản <script>bad()</script>');assert.equal(await popup.locator('.text script, header script').count(),0);
  assert.match(await popup.locator('.text').innerText(),/Dòng 109/);assert.equal(await popup.locator('svg polyline').count(),1);assert.equal(await popup.locator('.text').evaluate(e=>getComputedStyle(e).color),'rgb(18, 58, 188)');
  const pdf=await popup.pdf({preferCSSPageSize:true,printBackground:true,path:path.join(app,'../../.tmp/tntt-document-print.pdf')});
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>=3);await popup.close();
 }finally{await f.context.close();}
});


test('TNTT printing includes the three default pages and the requested number of blank A4 pages',async()=>{
 const f=await fixture();try{
  for(const [orientation,pageCount]of [['portrait',undefined],['portrait',5],['landscape',4]]){
   const popupPromise=f.page.waitForEvent('popup');
   await f.page.evaluate(({orientation,pageCount})=>window.injector.get('TnttDocumentPrint').open('Biên bản nhiều trang',
    {text:'Nội dung',strokes:[],pattern:'lined',orientation,pageCount}),{orientation,pageCount});
   const popup=await popupPromise;await popup.locator('.paper').waitFor();
   const pdf=await popup.pdf({preferCSSPageSize:true});
   assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,pageCount||3);
   await popup.close();
  }
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
