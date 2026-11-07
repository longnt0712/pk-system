// Real AngularJS and the shared pen editor. All requests use synthetic in-memory fixtures.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(app,f),'utf8');
let browser;before(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});after(async()=>{if(browser)await browser.close();});
const blank=()=>({text:'',orientation:'portrait',pattern:'lined',strokes:[]});
async function fixture({width=1440,gender='M',student=false,editor=!student,unread=true,expires=60000,dark=false,dashboard=false,enabled=true,notebookReadDelay=0,params={}}={}){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const server={entry:{id:12,title:'Biên bản tháng 11',kind:'DOCUMENT',revision:0,parentId:null,updatedAt:Date.now(),shared:true,noticeId:21,canEdit:editor,document:blank()},extraEntries:[],archivedEntries:[],notice:{id:21,entryId:12,title:'Lịch họp huynh trưởng',summary:'Mời các anh chị xem nội dung họp.',startsAt:Date.now()-1000,endsAt:Date.now()+expires,active:true,readAt:unread?null:Date.now()},calls:[],errors:[]};
 page.on('pageerror',e=>server.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))server.errors.push(m.text());});
 const css=['assets/css/external/bootstrap.min.css','assets/css/study-notebook.css','tntt_documents/notices.css','tntt_documents/documents.css'].map(read).join('\n');
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());const reply=(obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  if(u.pathname==='/tai-lieu'||u.pathname==='/dashboard')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"'+(dark?' class="global-dark-mode"':'')+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><div ng-controller="TnttDocumentsController as vm">'+read('tntt_documents/documents.html')+'</div><tntt-notification-pet></tntt-notification-pet></body></html>'});
  if(u.pathname.startsWith('/assets/images/tntt-notices/'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(app,u.pathname.slice(1)))});
  server.calls.push({path:u.pathname,method:req.method(),body:req.postDataJSON()});
  if(u.pathname.endsWith('/capabilities'))return reply({enabled:enabled,canEdit:editor,canReceive:!student,emailConfigured:false,userId:7,serverNow:Date.now()});
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
   if(req.method()==='PUT'){const p=req.postDataJSON();server.entry={...server.entry,revision:server.entry.revision+1,document:p.document};}
   else if(notebookReadDelay && server.calls.filter(c=>c.path===u.pathname&&c.method==='GET').length>1)await new Promise(resolve=>setTimeout(resolve,notebookReadDelay));
   return reply(u.searchParams.get('revision')===String(server.entry.revision)?{id:12,revision:server.entry.revision,changed:false}:{...server.entry,changed:true});
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
 await page.evaluate(({student,editor,gender,dashboard})=>{
  window.Hrm={};window.user={id:7,roles:[{name:student?'ROLE_STUDENT':editor?'ROLE_ADMIN':'ROLE_STUDENT_MANAGEMENT'}],person:{gender}};
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
 },{student,editor,gender,dashboard});
 for(const f of ['common/utils/color-palette.js','tntt_documents/tntt-documents.module.js','tntt_documents/TnttNoticeCenter.js','tntt_documents/TnttDocumentNotebookStore.js','tntt_documents/TnttDocumentPrint.js','tntt_documents/TnttDocumentsController.js'])await page.addScriptTag({path:path.join(app,f)});
 await page.addScriptTag({path:path.join(app,'common/utils/study-notebook.directive.js')});
 await page.evaluate(params=>{
  angular.module('Fixture',['Hrm.TnttDocuments','ngCookies']).value('settings',{campaignsEnabled:true,permissionsLoaded:true,api:{baseUrl:'/service/'}}).value('AuthSession',{hasCredentials:()=>!!window.user}).value('$stateParams',params);
  angular.bootstrap(document,['Fixture']);window.injector=angular.element(document).injector();window.vm=angular.element(document.querySelector('[ng-controller]')).scope().vm;
 },params);
 await page.locator(enabled?'.td-entry':'.td-empty').first().waitFor().catch(async e=>{console.error(JSON.stringify({errors:server.errors,calls:server.calls,state:await page.evaluate(()=>({error:window.vm?.error,caps:window.vm?.caps,entries:window.vm?.entries})),body:(await page.locator('body').innerText()).slice(0,700)}));await context.close();throw e;});
 return{page,context,server};
}

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
    return route.fulfill({status:revoked?404:200,json:{title:'Biên bản công khai',document:{...blank(),text:'Nội dung chỉ xem'}}});
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
   await f.page.getByRole('button',{name:'Đánh dấu',exact:true}).click();
   await palette.waitFor({state:'visible'});
   assert.equal(await palette.locator('.study-notebook-palette-heading').innerText(),'Đánh dấu');
   assert.equal(await palette.getByRole('button',{name:'Mảnh',exact:true}).getAttribute('aria-pressed'),'true');
   await palette.getByRole('button',{name:'Màu #FFFF00',exact:true}).click();await draw(70);
   await f.page.waitForFunction(()=>window.vm.session.status==='saved');
   assert.deepEqual(f.server.entry.document.strokes.map(s=>s.color),['#315bbe','#ff0000','#ffff00']);
   assert.deepEqual(f.server.entry.document.strokes.map(s=>s.width),[2,4,8]);
   assert.equal(f.server.entry.document.textColor,'#123abc');assert.equal(await f.page.locator('.study-notebook-text').evaluate(e=>getComputedStyle(e).color),'rgb(18, 58, 188)');
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
   assert.equal(await f.page.locator('.study-notebook-text').evaluate(e=>getComputedStyle(e).color),'rgb(18, 58, 188)');
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
   await button('+ Thêm trang').click();
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
   assert.equal(await button('+ Thêm trang').count(),0);
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
   assert.equal(await button('Hoàn tác nét vẽ').isDisabled(),true);
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
   await button('Hoàn tác nét vẽ').click();
   assert.deepEqual(await page.evaluate(()=>window.vm.session.document),original);
   await button('Khôi phục nét vẽ').click();
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
  const popup=await popupPromise;await popup.locator('.paper').waitFor();assert.equal(await popup.locator('script').count(),0);
  assert.match(await popup.locator('pre').innerText(),/Dòng 109/);assert.equal(await popup.locator('svg polyline').count(),1);assert.equal(await popup.locator('.text').evaluate(e=>getComputedStyle(e).color),'rgb(18, 58, 188)');
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
