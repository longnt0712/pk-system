const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});after(async()=>{if(browser)await browser.close();});
async function fixture(width=1200,modal=false){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><textarea ui-tinymce="options" ng-model="content"></textarea><div id="feedback" writing-feedback-editor ng-model="feedback"></div></body></html>'});
  const file=path.join(app,url.pathname);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Missing fixture asset'});const extension=path.extname(file);return route.fulfill({contentType:extension==='.js'?'text/javascript':extension==='.css'?'text/css':undefined,body:fs.readFileSync(file)});
 });
 await page.goto('http://palette.test/');
 for(const file of ['assets/css/study-notebook.css','assets/css/external/quill.snow-2.0.3.css'])await page.addStyleTag({path:path.join(app,file)});
 for(const file of ['assets/scripts/external/angular.min.js','assets/scripts/external/tinymce.min.js','assets/scripts/external/quill-2.0.3.js','common/utils/color-palette.js','common/utils/tinymce-viewport.js'])await page.addScriptTag({url:'http://palette.test/'+file});
 await page.evaluate(()=>angular.module('Hrm.TestResult',[]));await page.addScriptTag({url:'http://palette.test/test_result/controllers/TestResultController.js'});
 await page.evaluate(modal=>{if(modal){const host=document.createElement('div');host.className='modal';host.style.cssText='position:fixed;inset:0;overflow:auto';while(document.body.firstChild)host.appendChild(document.body.firstChild);document.body.appendChild(host);document.addEventListener('focusin',event=>{if(!host.contains(event.target)){host.querySelector('button')?.focus();}});}
  angular.module('Fixture',['ui.tinymce','Hrm.TestResult']).run(['$rootScope',function(root){root.content='<p>Alpha Beta</p>';root.feedback='<p>One Two</p>';root.options={theme:'modern',menubar:false,statusbar:false,height:180,plugins:'textcolor colorpicker',toolbar:'undo redo | forecolor backcolor'};}]);angular.bootstrap(document,['Fixture']);window.root=angular.element(document).injector().get('$rootScope');},modal);
 await page.waitForFunction(()=>tinymce.editors[0]?.initialized&&Quill.find(document.querySelector('#feedback')));return{page,context,errors};
}
async function tinySelection(page){await page.evaluate(()=>{const editor=tinymce.editors[0],node=editor.getBody().querySelector('p').firstChild,range=editor.getDoc().createRange();range.setStart(node,0);range.setEnd(node,5);editor.focus();editor.selection.setRng(range);});}
test('TinyMCE color controls use the shared palette and save selected text formatting with undo and cancel intact',async()=>{
 const f=await fixture(1200,true);try{
  const toolbar=f.page.locator('.mce-tinymce');
  await tinySelection(f.page);
  await toolbar.getByRole('button',{name:'Màu chữ',exact:true}).click();
  const palette=f.page.getByRole('dialog',{name:'Bảng màu',exact:true});await palette.waitFor();
  await palette.getByRole('button',{name:'Màu #FF0000',exact:true}).click();
  await f.page.waitForFunction(()=>/color:/.test(window.root.content));
  assert.match(await f.page.evaluate(()=>window.root.content),/color:\s*(#ff0000|rgb\(255, 0, 0\))/i);
  assert.equal(await f.page.evaluate(()=>tinymce.editors[0].getBody().textContent),'Alpha Beta');
  await toolbar.getByRole('button',{name:'Màu nền',exact:true}).click();await palette.getByRole('button',{name:'Màu #FFFF00',exact:true}).click();
  await f.page.waitForFunction(()=>/background-color:/.test(window.root.content));
  assert.match(await f.page.evaluate(()=>window.root.content),/background-color:\s*(#ffff00|rgb\(255, 255, 0\))/i);
  await f.page.evaluate(()=>tinymce.editors[0].undoManager.undo());
  await f.page.waitForFunction(()=>!/background-color/.test(window.root.content));
  assert.doesNotMatch(await f.page.evaluate(()=>window.root.content),/background-color/);
  await toolbar.getByRole('button',{name:'Màu chữ',exact:true}).click();await f.page.keyboard.press('Escape');assert.equal(await palette.count(),0);
  await toolbar.getByRole('button',{name:'Màu chữ',exact:true}).click();await palette.getByRole('button',{name:'Không tô màu',exact:true}).click();
  await f.page.waitForFunction(()=>!/color:/.test(window.root.content));
  assert.doesNotMatch(await f.page.evaluate(()=>window.root.content),/color:/);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('Quill feedback uses preset and custom text/background colors without losing the selected range on a phone',async()=>{
 const f=await fixture(390);try{
  await f.page.evaluate(()=>Quill.find(document.querySelector('#feedback')).setSelection(0,3,'silent'));
  const trigger=f.page.locator('.ql-color .ql-picker-label'),background=f.page.locator('.ql-background .ql-picker-label');
  await trigger.click();const palette=f.page.getByRole('dialog',{name:'Bảng màu',exact:true});await palette.waitFor();
  const bounds=await palette.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  await palette.getByRole('button',{name:'Màu #FF0000',exact:true}).click();
  assert.equal(await f.page.evaluate(()=>Quill.find(document.querySelector('#feedback')).getFormat(0,3).color),'#ff0000');
  await background.click();await palette.getByRole('button',{name:'Thêm màu tùy chỉnh'}).click();await palette.getByRole('textbox',{name:'Mã màu HEX'}).fill('#123ABC');await palette.getByRole('button',{name:'Áp dụng',exact:true}).click();
  assert.equal(await f.page.evaluate(()=>Quill.find(document.querySelector('#feedback')).getFormat(0,3).background),'#123abc');
  await f.page.waitForFunction(()=>/background-color/.test(window.root.feedback));assert.match(await f.page.evaluate(()=>window.root.feedback),/background-color/);assert.equal(await f.page.evaluate(()=>Quill.find(document.querySelector('#feedback')).getText()),'One Two\n');
  await background.click();await palette.getByRole('button',{name:'Không tô màu',exact:true}).click();assert.equal(await f.page.evaluate(()=>Quill.find(document.querySelector('#feedback')).getFormat(0,3).background),undefined);
  await trigger.click();await f.page.evaluate(()=>window.root.$destroy());assert.equal(await palette.count(),0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
