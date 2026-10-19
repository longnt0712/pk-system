const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
function fixture(type,mode=([4,8,10,13,14,15].includes(type)?'MATCH':[1,6,9,12].includes(type)?'SINGLE':type===18?'LISTENING':type===5||type===7?'MULTIPLE':'TEXT')){
 const options=[{key:'A',text:'First answer',html:'<b>First answer</b>'},{key:'B',text:'Second answer'},{key:'C',text:'Third answer'}];
 return {type,answerMode:mode,title:'Questions 1–2',instructionsHtml:'<p>Read the instructions carefully.</p>',
  passageHtml:type===4?'<p>First paragraph }{HEADING}{</p><p>Second paragraph }{HEADING}{</p>':'',
  contentHtml:type===13||type===11?'<p>A paragraph with }{SPACE}{ and }{SPACE}{.</p>':'',
  items:[{id:'q:101',number:1,gapIndex:0,promptHtml:'<b>First question</b>',options:structuredClone(options)},
   {id:'q:102',number:2,gapIndex:1,promptHtml:'Second question',options:structuredClone(options)}]};
}
async function open(browser,exercise,{width=1100,touch=false}={}){
 const page=await browser.newPage({viewport:{width,height:1000},hasTouch:touch,isMobile:touch});page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 const battleView=fs.readFileSync(path.join(app,'question/views/battle_quiz_online.html'),'utf8');
 const css=fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8')+'\n'+Array.from(battleView.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(app,'assets/css/question-drag-drop.css'),'utf8')+'\n'+fs.readFileSync(path.join(app,'assets/css/battle-exercise-form.css'),'utf8');
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><main id="qa" class="battle-online-page" style="padding:12px"><battle-exercise-form exercise="exercise" answers="answers" disabled="locked" on-answer="answered()"></battle-exercise-form></main></body></html>');
 for(const script of ['angular.min.js','angular-sanitize.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',script)});
 await page.evaluate(({exercise,template})=>{
  window.APP_VERSION='qa';window.callbacks=0;window.exploit=0;
  angular.module('Hrm.Question',['ngSanitize']).run(function($templateCache,$rootScope){
   $templateCache.put('question/views/battle_online_exercise_form.html?v=qa&individualQuestions=20261007_1',template);
   $rootScope.exercise=exercise;$rootScope.answers={};$rootScope.locked=false;$rootScope.answered=()=>window.callbacks++;
   window.qaRoot=$rootScope;
  });
 },{exercise,template:fs.readFileSync(path.join(app,'question/views/battle_online_exercise_form.html'),'utf8')});
 for(const script of ['question/business/QuestionDragDrop.js','question/business/ComprehensiveVideo.js','question/business/ComprehensiveListening.js','question/controllers/BattleExerciseForm.js'])await page.addScriptTag({path:path.join(app,script)});
 await page.evaluate(()=>angular.bootstrap(document.getElementById('qa'),['Hrm.Question']));
 await page.locator('.battle-exercise-form').waitFor();
 return {page,errors};
}
async function answers(page){return page.evaluate(()=>JSON.parse(JSON.stringify(qaRoot.answers)));}
async function setLocked(page,value){await page.evaluate(value=>qaRoot.$apply(()=>qaRoot.locked=value),value);}
function token(page,key){return page.locator('.battle-exercise-bank .battle-exercise-choice-token[data-option-key="'+key+'"]');}
function slot(page,id){return page.locator('.battle-exercise-slot[data-item-id="'+id+'"]');}
function placed(page,id){return slot(page,id).locator('.battle-exercise-choice-token');}
async function touchDrag(page,from,to,beforeEnd=null,cancel=false){
 await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();
 const a=await from.boundingBox(),b=await to.boundingBox();assert.ok(a&&b,'both drag targets are visible');
 const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
 // Dispatch actual native pointer events through the browser; the directive must
 // discover its destination with elementFromPoint rather than a mocked callback.
 await from.dispatchEvent('pointerdown',{pointerId:19,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:start.x,clientY:start.y});
 await page.evaluate(({start,end})=>{
  for(let i=1;i<=5;i++)document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:19,pointerType:'touch',isPrimary:true,buttons:1,clientX:start.x+(end.x-start.x)*i/5,clientY:start.y+(end.y-start.y)*i/5}));
 },{start,end});
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 if(beforeEnd)await beforeEnd();
 await page.evaluate(({end,cancel})=>document.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{bubbles:true,cancelable:true,pointerId:19,pointerType:'touch',isPrimary:true,clientX:end.x,clientY:end.y})),{end,cancel});
}

test('Battle drag question types mount directly with safe inline slots and support click, keyboard, move, replace and return',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [4,13,14,15]){
  const {page,errors}=await open(browser,fixture(type));
  assert.equal(await page.locator('select').count(),0,'type '+type+' uses answer slots rather than dropdowns');
  assert.equal(await page.locator('.battle-exercise-slot').count(),2,'exactly one slot per question');
  await token(page,'A').click();await slot(page,'q:101').click();assert.deepEqual((await answers(page))['q:101'],['A']);
  await token(page,'A').waitFor({state:'detached'});assert.equal(await token(page,'A').count(),0,'placed answers leave the bank');
  await token(page,'B').focus();await page.keyboard.press('Enter');await slot(page,'q:102').focus();await page.keyboard.press('Space');
  assert.deepEqual((await answers(page))['q:102'],['B']);
  await placed(page,'q:101').dragTo(slot(page,'q:102'));const moved=await answers(page);
  assert.deepEqual(moved['q:101'],[],'moving an answer clears its old slot');assert.deepEqual(moved['q:102'],['A']);
  assert.equal(await token(page,'B').count(),1,'replaced answer returns to bank');
  await slot(page,'q:102').focus();await page.keyboard.press('Delete');assert.deepEqual((await answers(page))['q:102'],[]);
  await token(page,'C').dragTo(slot(page,'q:101'));assert.deepEqual((await answers(page))['q:101'],['C']);
  await placed(page,'q:101').dragTo(page.locator('.battle-exercise-bank'));assert.deepEqual((await answers(page))['q:101'],[],'drop back to bank clears slot');
  await token(page,'A').click();await page.keyboard.press('Escape');await slot(page,'q:101').click();assert.deepEqual((await answers(page))['q:101'],[],'Escape cancels armed selection');
  const dataTransfer=await page.evaluateHandle(()=>{const dt=new DataTransfer();dt.setData('text/plain','A');return dt;});
  await slot(page,'q:101').dispatchEvent('drop',{dataTransfer});assert.deepEqual((await answers(page))['q:101'],[],'foreign text drops are ignored');
  assert.deepEqual(errors,[],'type '+type);await page.close();
 }}finally{await browser.close();}
});

test('Battle drag slots work with touch and lock without losing answers while video is waiting or submitted',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [4,13,14,15]){
  const {page,errors}=await open(browser,fixture(type),{width:390,touch:true});
  await touchDrag(page,token(page,'A'),slot(page,'q:101'));assert.deepEqual((await answers(page))['q:101'],['A'],'touch type '+type);
  await touchDrag(page,placed(page,'q:101'),slot(page,'q:102'));assert.deepEqual((await answers(page))['q:101'],[]);assert.deepEqual((await answers(page))['q:102'],['A']);
  await setLocked(page,true);const before=await answers(page);
  await slot(page,'q:102').focus();await page.keyboard.press('Delete');
  await touchDrag(page,token(page,'B'),slot(page,'q:101'));assert.deepEqual(await answers(page),before,'disabled gestures cannot change answers');
  await setLocked(page,false);await token(page,'B').click();await slot(page,'q:101').click();assert.deepEqual((await answers(page))['q:101'],['B']);
  if(type===15)await page.screenshot({path:path.join(captures,'battle-drag-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile fits viewport');
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('realtime room snapshots preserve active choices and gestures while a new round or disabled interval cancels stale drops',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  const {page,errors}=await open(browser,fixture(15),{width:390,touch:true});
  const broadcast=()=>page.evaluate(()=>qaRoot.$apply(()=>qaRoot.exercise=structuredClone(qaRoot.exercise)));
  await token(page,'A').click();await broadcast();await slot(page,'q:101').click();assert.deepEqual((await answers(page))['q:101'],['A'],'identical polling DTO keeps a selected answer');
  await slot(page,'q:101').focus();await page.keyboard.press('Delete');
  await touchDrag(page,token(page,'A'),slot(page,'q:101'),broadcast);assert.deepEqual((await answers(page))['q:101'],['A'],'identical polling DTO keeps a touch gesture');
  await slot(page,'q:101').focus();await page.keyboard.press('Delete');
  await touchDrag(page,token(page,'B'),slot(page,'q:101'),null,true);assert.deepEqual((await answers(page))['q:101'],[],'pointercancel never commits');
  await touchDrag(page,token(page,'B'),slot(page,'q:101'),async()=>{await setLocked(page,true);await setLocked(page,false);});
  assert.deepEqual((await answers(page))['q:101'],[],'a gesture crossing a video lock never commits after reopening');
  await touchDrag(page,token(page,'B'),slot(page,'q:101'),()=>page.evaluate(()=>qaRoot.$apply(()=>qaRoot.answers={})));
  assert.deepEqual((await answers(page))['q:101']||[],[],'a reopened round rejects the old in-flight answer');
  await touchDrag(page,token(page,'C'),slot(page,'q:101'));assert.deepEqual((await answers(page))['q:101'],['C'],'fresh gestures still work after cancellation');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('touch dragging holds autoscroll at a scrollable question edge and cancellation stops it',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  const {page,errors}=await open(browser,fixture(15),{width:390,touch:true});
  await page.evaluate(()=>{const host=document.getElementById('qa');host.style.height='300px';host.style.overflowY='auto';document.querySelector('.battle-exercise-form').style.paddingBottom='1000px';});
  const source=token(page,'A');await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),host=await page.locator('#qa').boundingBox();
  const end={x:host.x+host.width/2,y:host.y+host.height-8};
  await source.dispatchEvent('pointerdown',{pointerId:45,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:a.x+a.width/2,clientY:a.y+a.height/2});
  const before=await page.locator('#qa').evaluate(node=>node.scrollTop);
  await page.evaluate(end=>document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:45,pointerType:'touch',isPrimary:true,buttons:1,clientX:end.x,clientY:end.y})),end);
  await page.waitForTimeout(220);const scrolling=await page.locator('#qa').evaluate(node=>node.scrollTop);
  assert.ok(scrolling>before+28,'holding one pointermove scrolls continuously rather than requiring repeated moves');
  await page.evaluate(end=>document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,cancelable:true,pointerId:45,pointerType:'touch',isPrimary:true,clientX:end.x,clientY:end.y})),end);
  const stopped=await page.locator('#qa').evaluate(node=>node.scrollTop);await page.waitForTimeout(120);
  assert.equal(await page.locator('#qa').evaluate(node=>node.scrollTop),stopped);assert.deepEqual((await answers(page))['q:101'],[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('Battle matrices preserve row answers and type 8 remains an accessible selection',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [9,10,12])for(const width of [1100,390]){
  const {page,errors}=await open(browser,fixture(type),{width});
  assert.equal(await page.locator('.battle-exercise-matrix').count(),1);assert.equal(await page.locator('select').count(),0);
  const first=page.locator('.battle-exercise-matrix tbody tr').nth(0).locator('input[type=radio]');
  const second=page.locator('.battle-exercise-matrix tbody tr').nth(1).locator('input[type=radio]');
  await first.nth(1).check();await second.nth(1).check();assert.deepEqual(await answers(page),{'q:101':['B'],'q:102':['B']},'matrix allows reuse in separate rows');
  if(type===10&&width===390)await page.screenshot({path:path.join(captures,'battle-matrix-mobile.png'),fullPage:true});
  await setLocked(page,true);assert.equal(await first.nth(0).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.close();
 }
 const {page}=await open(browser,fixture(8));assert.equal(await page.locator('select').count(),2);
 await page.locator('select').first().selectOption({label:'Second answer'});assert.deepEqual((await answers(page))['q:101'],['B']);await page.close();
 }finally{await browser.close();}
});

test('multiple answer and two column choices retain independent groups and never auto-submit',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [5,7]){
  const {page,errors}=await open(browser,fixture(type,'MULTIPLE'),{width:390});
  if(type===5)assert.equal(await page.locator('.battle-exercise-two-column').count(),2);
  const inputs=page.locator('input[type=checkbox]');assert.equal(await inputs.count(),6);
  await inputs.nth(0).check();await inputs.nth(2).check();await inputs.nth(4).check();
  assert.deepEqual(await answers(page),{'q:101':['A','C'],'q:102':['B']});assert.equal(await page.evaluate(()=>callbacks),0);
  await setLocked(page,true);assert.equal(await inputs.nth(1).isDisabled(),true);assert.deepEqual(errors,[]);await page.close();
 }
 const {page,errors}=await open(browser,fixture(6,'SINGLE'),{width:390});assert.equal(await page.locator('.battle-exercise-two-column').count(),2);
 const radios=page.locator('input[type=radio]');await radios.nth(1).check();await radios.nth(5).check();
 assert.deepEqual(await answers(page),{'q:101':['B'],'q:102':['C']});assert.equal(await page.evaluate(()=>callbacks),2,'single-choice groups notify the parent normally');assert.deepEqual(errors,[]);await page.close();
 }finally{await browser.close();}
});

test('stored gap HTML remains sanitized text rather than executable Angular markup',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [4,11,13]){
  const exercise=fixture(type),content='<p ng-init="exploit=99">{{7*7}}<img src=x onerror="window.exploit=100"><script>window.exploit=101</script> }{SPACE}{ }{SPACE}{</p>';
  if(type===4)exercise.passageHtml=content;else exercise.contentHtml=content;
  exercise.instructionsHtml='<p ng-init="exploit=2">Instructions {{7*7}}</p>';
  const {page,errors}=await open(browser,exercise);
  assert.equal(await page.evaluate(()=>window.exploit),0);assert.match(await page.locator('.battle-exercise-form').innerText(),/\{\{7\*7\}\}/);
  assert.equal(await page.locator('.battle-exercise-form [ng-init],.battle-exercise-form [onerror],.battle-exercise-form script').count(),0);
  if(type===11){assert.equal(await page.locator('input[type=text]').count(),2);await page.locator('input[type=text]').first().fill('typed answer');assert.deepEqual((await answers(page))['q:101'],['typed answer']);}
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('queued native gap input cannot overwrite a reopened answer map or a rerendered question',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const reset of ['answers','content']){
  const {page,errors}=await open(browser,fixture(11));
  await page.evaluate(reset=>{
   const gap=document.querySelector('battle-exercise-gaps'),scope=angular.element(gap).isolateScope(),pending=[],original=scope.$evalAsync;
   scope.$evalAsync=function(fn){pending.push(fn);};
   const input=gap.querySelector('input');input.value='stale old answer';input.dispatchEvent(new Event('input',{bubbles:true}));
   scope.$evalAsync=original;
   qaRoot.$apply(()=>{if(reset==='answers')qaRoot.answers={};else qaRoot.exercise.contentHtml='<p>A replaced passage }{SPACE}{ and }{SPACE}{.</p>';});
   qaRoot.$apply(()=>pending.forEach(fn=>fn()));
  },reset);
  assert.deepEqual((await answers(page))['q:101']||[],[],'queued input does not enter the '+reset+' replacement');
  await page.locator('input[type=text]').first().fill('fresh answer');assert.deepEqual((await answers(page))['q:101'],['fresh answer']);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('Daily Listening uses public opaque gap ids with audio controls and never contains a client answer key',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  const exercise=fixture(18);exercise.audioUrl='https://school.test/listening.mp3';
  exercise.listeningTokens=[{text:'On '},{before:'(',gapId:'103:5',after:')'},{text:' we visit '},{before:'',gapId:'103:9',after:'.'}];
  exercise.items=[{id:'103:5',number:1,options:[]},{id:'103:9',number:2,options:[]}];
  const {page,errors}=await open(browser,exercise,{width:390});
  assert.equal(await page.locator('comprehensive-listening-player').count(),1);
  await page.locator('audio').waitFor({state:'attached'});assert.equal(await page.locator('audio').getAttribute('src'),exercise.audioUrl);
  assert.equal(await page.locator('.battle-listening-transcript input[data-gap-id]').count(),2);
  await page.locator('input[data-gap-id="103:5"]').fill('Monday');await page.locator('input[data-gap-id="103:9"]').fill('a museum');
  assert.deepEqual(await answers(page),{'103:5':['Monday'],'103:9':['a museum']});
  assert.equal(await page.locator('.listening-progress,.listening-gap-correct').count(),0,'Battle does not grade or reveal answers in the browser');
  assert.equal(await page.evaluate(()=>Object.values(qaRoot.exercise.listeningTokens).some(t=>'answer' in t||'correct' in t)),false);
  await page.evaluate(()=>qaRoot.$apply(()=>qaRoot.answers={}));await page.locator('input[data-gap-id="103:5"]').fill('Tuesday');
  assert.deepEqual((await answers(page))['103:5'],['Tuesday'],'same-question reopen binds public gaps to answer arrays');
  await setLocked(page,true);assert.equal(await page.locator('input[data-gap-id="103:5"]').isDisabled(),true);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
