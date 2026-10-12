const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);

test('TinyMCE edits, saves and reopens iframe editors when unload is disabled, including cached pagehide',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{
  const page=await browser.newPage(),errors=[],violations=[];
  page.on('pageerror',error=>errors.push(error.message));
  const session=await page.context().newCDPSession(page);
  await session.send('Log.enable');session.on('Log.entryAdded',({entry})=>{if(/unload is not allowed/i.test(entry.text))violations.push(entry.text);});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({headers:{'Permissions-Policy':'unload=()'},contentType:'text/html',
    body:'<!doctype html><html><body><textarea id="one" class="editor">First passage</textarea><textarea id="two" class="editor">Second passage</textarea></body></html>'});
   const file=path.join(app,url.pathname);
   if(!fs.existsSync(file))return route.fulfill({status:404,body:'Missing test asset'});
   const extension=path.extname(file),contentType=extension==='.js'?'text/javascript':extension==='.css'?'text/css':undefined;
   return route.fulfill({body:fs.readFileSync(file),...(contentType?{contentType}:{})});
  });
  await page.goto('http://tinymce.test/');
  await page.addScriptTag({url:'http://tinymce.test/assets/scripts/external/tinymce.min.js'});
  async function initialize(){
   await page.evaluate(()=>{window.readyEditors=0;tinymce.init({selector:'.editor',menubar:false,toolbar:'bold italic',plugins:'autosave',
    setup(editor){editor.on('init',()=>window.readyEditors++);}});});
   await page.waitForFunction(()=>window.readyEditors===2);
  }
  await initialize();
  await page.evaluate(()=>{
   const editor=tinymce.get('one');editor.setContent('<p>Updated reading passage</p>');editor.save();
   editor.getWin().dispatchEvent(new (editor.getWin().PageTransitionEvent)('pagehide',{persisted:true}));
   editor.setContent('<p>Content after cached pagehide</p>');editor.save();
  });
  assert.match(await page.locator('#one').inputValue(),/Content after cached pagehide/);
  assert.equal(await page.evaluate(()=>typeof tinymce.get('one')._beforeUnload),'function');
  await page.evaluate(()=>tinymce.remove());await initialize();
  assert.match(await page.frameLocator('#one_ifr').locator('body').innerText(),/Content after cached pagehide/);
  await page.evaluate(()=>tinymce.remove());assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
 }finally{await browser.close();}
});
