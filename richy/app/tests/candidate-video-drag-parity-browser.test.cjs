const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
function slice(view,start,end){const a=view.indexOf(start),b=view.indexOf(end,a);assert.ok(a>=0&&b>a);return view.slice(a,b);}
async function open(browser,type,width){
 const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<500,isMobile:width<500});page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 const view=fs.readFileSync(path.join(app,'question/views/ielts_reading_actual_test_idp.html'),'utf8');
 const drag=slice(view,'                                    <div class="complete-list-runtime','                                    <!--<div class="col-md-12" style="margin-bottom: 20px"');
 const css=fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8')+'\n'+Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(app,'assets/css/question-drag-drop.css'),'utf8');
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));
 await page.goto('http://candidate-drag.test/comprehensive_test/72513?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS');
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'\n#qa{padding:12px}.matching-heading-drop-box{display:inline-block!important;min-width:130px;min-height:40px}.sentence-ending-choice,.complete-list-word,.drag-matching-heading{display:inline-block;min-height:40px;margin:7px;padding:9px}.sentence-ending-slot,.complete-list-drop-box{display:inline-block;min-width:130px;min-height:42px}.sentence-ending-bank,.complete-list-word-bank{padding:14px;border:1px solid #aaa}.drag-matching-heading-root{min-height:48px}</style></head><body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"><audio id="audio1"></audio><div id="passage-text-1" compile="vm.ieltsReadingActualTest.subQuestions[0].question"></div><div id="passage-text-2"></div><div id="passage-text-3"></div><div ng-repeat="item in vm.ieltsReadingActualTest.subQuestions[0].subQuestions" ng-show="vm.videoPackageVisible(item)">'+drag+'</div></main></body></html>');
 for(const script of ['jquery.min.js','angular.min.js','angular-drag-and-drop-lists.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',script)});
 await page.evaluate(type=>{
  window.App={initAjax(){}};window.saved=[];window.toasts=[];
  const questions=[1,2].map((number,index)=>({id:1001+index,ordinalNumber:number,question:type===13?'A paragraph }{SPACE}{ then }{SPACE}{.':'Sentence '+number,
   parent:{id:99,type},questionAnswers:[0,1,2].map(option=>({id:2000+index*10+option,ordinalNumberQuestionAnswer:option+1,correct:option===index,
    answer:{id:3000+option,answer:['First answer','Second answer','Third answer'][option]},question:{id:1001+index,ordinalNumber:number,parent:{id:99,type}}}))}));
  const data={id:72513,title:'Assigned video drag',subQuestions:[{id:10,type:1,question:type===4?'<p>First }{HEADING}{</p><p>Second }{HEADING}{</p>':'Video text',videoUrl:'https://school.test/clip.mp4',questionType:{code:'IELTSRTP1'},subQuestions:[{id:99,type,question:'Match the answers',videoTimeSeconds:10,subQuestions:questions}]},{id:11,type:1,question:'',subQuestions:[]},{id:12,type:1,question:'',subQuestions:[]}]};
  const cookie=JSON.stringify({id:7,roles:[{name:'ROLE_VIEWER'}]});
  angular.module('Hrm.Question',['dndLists']).value('settings',{}).value('Utilities',{}).value('$uibModal',{})
   .value('$location',{path:()=>location.pathname,search:()=>Object.fromEntries(new URLSearchParams(location.search))})
   .value('$stateParams',{ieltsReadingTestId:'72513',assignmentTaskId:'238',assignmentPart:'1',assignmentParts:'1',sessionMode:'SERIOUS'})
   .value('$cookies',{getAll:()=>({'education.user':cookie})}).value('blockUI',{start(){},stop(){}})
   .value('toastr',Object.fromEntries(['success','warning','error','info'].map(level=>[level,(...args)=>toasts.push({level,args})])))
   .run(['$rootScope',root=>{root.settings={layout:{}};}])
   .factory('QuestionService',['$q',q=>({getAssignedTask:()=>q.when({activityType:'COMPREHENSIVE',ieltsTestId:72513,shuffleQuestions:false}),getOne:()=>q.when(angular.copy(data)),getLearningDrafts:()=>q.when([]),
    saveLearningDraft(dto){saved.push(structuredClone(dto));return q.when(true);},deleteLearningDraft:()=>q.when(true)})]);
 },type);
 for(const script of ['question/business/QuestionDragDrop.js','question/business/ComprehensiveVideo.js','question/business/ComprehensiveListening.js','question/controllers/IELTSReadingActualTestController.js'])await page.addScriptTag({path:path.join(app,script)});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();window.qaVm=qaScope.vm;});
 await page.waitForFunction(()=>qaVm.isStartTest||qaVm.startTestError);assert.equal(await page.evaluate(()=>qaVm.startTestError),'',errors.join('\n'));
 await page.evaluate(()=>qaScope.$apply(()=>{qaVm.videoApi={ready:true,pause(){},play(){}};qaVm.onVideoProgress(10,120);}));
 return {page,errors};
}
function selectors(page,type){return type===4?{bank:page.locator('.drag-matching-heading-root').first(),tokens:page.locator('.drag-matching-heading:visible'),slots:page.locator('.matching-heading-drop-box'),filled:index=>page.locator('.matching-heading-drop-box').nth(index)}:
 type===13?{bank:page.locator('.complete-list-word-bank'),tokens:page.locator('.complete-list-word'),slots:page.locator('.complete-list-drop-box'),filled:index=>page.locator('.complete-list-slot-answer').nth(index)}:
 {bank:page.locator('.sentence-ending-bank'),tokens:page.locator('.sentence-ending-choice'),slots:page.locator('.sentence-ending-slot'),filled:index=>page.locator('.sentence-ending-slot').nth(index).locator('[touch-dnd-source]')};}
async function results(page){return page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.map(r=>({number:r.ordinalNumber,value:r.clientAnswer})).sort((a,b)=>a.number-b.number));}
async function touchDrag(page,from,to,cancel=false){
 await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();assert.ok(a&&b);
 const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
 await from.dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:start.x,clientY:start.y});
 await page.evaluate(end=>document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:31,pointerType:'touch',isPrimary:true,buttons:1,clientX:end.x,clientY:end.y})),end);
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 await page.evaluate(({end,cancel})=>document.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{bubbles:true,cancelable:true,pointerId:31,pointerType:'touch',isPrimary:true,clientX:end.x,clientY:end.y})),{end,cancel});
}
test('assigned video uses actual candidate drag markup for heading, words, sentence endings and two-column matching',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [4,13,14,15])for(const width of [1280,390]){
  const {page,errors}=await open(browser,type,width),s=selectors(page,type);
  assert.equal(await s.slots.count(),2);assert.equal(await page.locator('ui-select:visible,select:visible').count(),0,'drag tasks remain drag tasks on mobile');
  const first=s.tokens.filter({hasText:'First answer'}),second=s.tokens.filter({hasText:'Second answer'});
  await first.click();await s.slots.nth(0).click();assert.deepEqual(await results(page),[{number:1,value:'First answer'}],'click places answer in '+type);
  await second.focus();await page.keyboard.press('Enter');await s.slots.nth(1).focus();await page.keyboard.press('Space');
  assert.deepEqual(await results(page),[{number:1,value:'First answer'},{number:2,value:'Second answer'}],'keyboard retains independent question results');
  if(type===15&&width===390)await page.screenshot({path:path.join(captures,'candidate-video-drag-mobile.png'),fullPage:true});
  if(type===4){
   await page.evaluate(()=>qaScope.$apply(()=>qaScope.listB.items.splice(qaScope.listB.items.findIndex(option=>option.clientAnswer==='Third answer'),1)));
   assert.equal(await s.tokens.count(),0,'all heading options can leave the bank');
   const returnBounds=await s.bank.boundingBox();assert.ok(returnBounds&&returnBounds.height>=40,'the empty heading bank keeps a visible return surface');
   await touchDrag(page,s.filled(1),s.bank);assert.deepEqual(await results(page),[{number:1,value:'First answer'}],'last used heading can return to an empty bank');
   await second.click();await s.slots.nth(1).click();
  }
  if(type!==4){
   await s.filled(0).dblclick();await s.slots.nth(0).click();
   assert.deepEqual(await results(page),[{number:2,value:'Second answer'}],'double-tap clear does not leave an armed answer that repopulates the next empty slot');
   await first.click();await s.slots.nth(0).click();
  }
  await s.slots.nth(1).focus();await page.keyboard.press('Delete');assert.deepEqual(await results(page),[{number:1,value:'First answer'}]);
  await s.slots.nth(0).click();await s.slots.nth(1).click();assert.deepEqual(await results(page),[{number:2,value:'First answer'}],'filled slot can move to an empty destination');
  await s.slots.nth(1).focus();await page.keyboard.press('Delete');
  await touchDrag(page,first,s.slots.nth(0),true);assert.deepEqual(await results(page),[],'cancelled gestures never place answers');
  await touchDrag(page,first,s.slots.nth(0));assert.deepEqual(await results(page),[{number:1,value:'First answer'}],'touch places answer in '+type);
  await touchDrag(page,s.filled(0),s.slots.nth(1));assert.deepEqual(await results(page),[{number:2,value:'First answer'}],'touch moves answer');
  // A visible bank remains a real touch return target, not a dropdown fallback.
  await touchDrag(page,s.filled(type===13?0:1),s.bank);assert.deepEqual(await results(page),[],'return gesture clears the submitted answer');
  assert.deepEqual(errors,[],'type '+type+' width '+width);await page.close();
 }}finally{await browser.close();}
});

test('assigned video drag can be answered after a partially answered multiple-answer group leaves an empty result placeholder',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{for(const type of [14,15])for(const multipleType of [5,7]){
  const {page,errors}=await open(browser,type,390),s=selectors(page,type);
  await page.evaluate(multipleType=>qaScope.$apply(()=>{
   const parent={id:500,type:multipleType,subQuestions:[3,4].map(number=>({id:500+number,ordinalNumber:number,questionAnswers:[]}))};
   const question=parent.subQuestions[0];question.parent={id:500,type:multipleType};
   question.questionAnswers=[{id:9001,selected:true,answer:{id:9101,answer:'Selected choice'},question:{id:503,ordinalNumber:3,parent:{id:500,type:multipleType}}},
    {id:9002,selected:false,answer:{id:9102,answer:'Other choice'},question:{id:503,ordinalNumber:3,parent:{id:500,type:multipleType}}}];
   qaVm.checkBoxMultipleChoiceMultipleAnswerQuestions(question.questionAnswers[0],question,true,0,parent);
  }),multipleType);
  assert.equal(await page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.some(result=>result.ordinalNumber===4&&Object.keys(result.questionAnswer).length===0)),true,'real multiple-answer handler leaves its unanswered sibling placeholder');
  await s.tokens.filter({hasText:'First answer'}).click();await s.slots.nth(0).click();
  assert.deepEqual((await results(page)).filter(result=>result.number===1),[{number:1,value:'First answer'}]);
  await s.slots.nth(0).focus();await page.keyboard.press('Delete');assert.equal((await results(page)).filter(result=>result.number===1).length,0,'clearing also tolerates the sibling placeholder');
  assert.deepEqual(errors,[],'matching '+type+' with multiple '+multipleType);await page.close();
 }}finally{await browser.close();}
});
