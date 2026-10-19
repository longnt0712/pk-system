const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);

for(const endingType of [14,15])for(const hasVideo of [true,false])test('assigned '+(hasVideo?'video':'text')+' resumes sentence endings type '+endingType+' with empty passages and thirteen saved answers',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.stack));
  page.on('console',async message=>{if(message.type()==='error')errors.push((await Promise.all(message.args().map(arg=>arg.evaluate(value=>value instanceof Error?value.stack:String(value))))).join(' '));});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
  await page.goto('http://assignment-resume.test/comprehensive_test/72513?assignmentTaskId=238&assignmentPart=1&assignmentParts=1&sessionMode=SERIOUS');
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="qa" ng-controller="IELTSReadingActualTestController as vm"><audio id="audio1"></audio><span id="started" ng-if="vm.isStartTest">Started</span><span id="error">{{vm.startTestError}}</span></main></body></html>');
  for(const script of ['jquery.min.js','angular.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external/'+script)});
  await page.evaluate(({endingType,hasVideo})=>{
   window.App={initAjax(){}};window.toasts=[];window.saved=[];
   const questions=Array.from({length:60},(_,index)=>({id:1000+index,ordinalNumber:index+1,question:'Video question '+(index+1),videoTimeSeconds:10*(index+1),
    parent:{id:100,type:1},questionAnswers:[0,1,2,3].map(option=>({id:10000+index*4+option,ordinalNumberQuestionAnswer:option+1,
     correct:option===1,answer:{id:20000+index*4+option,answer:'Option '+(option+1)},question:{id:1000+index,ordinalNumber:index+1,parent:{id:100,type:1}}}))}));
   questions[0].parent={id:99,type:endingType};questions[0].questionAnswers.forEach(answer=>answer.question.parent={id:99,type:endingType});
   const data={id:72513,title:'Assigned video',subQuestions:[{id:10,type:1,question:'Video passage',videoUrl:hasVideo?'https://youtu.be/M7lc1UVf-VE':'',
    questionType:{code:'IELTSRTP1'},subQuestions:[{id:99,type:endingType,question:'Match the sentence ending',subQuestions:[questions[0]]},
     {id:100,type:1,question:'Choose one answer',subQuestions:questions.slice(1)}]},
    {id:11,type:1,question:'',subQuestions:[{id:101,type:1,question:'',subQuestions:null}]},{id:12,type:1,question:'',subQuestions:null}]};
   const draft={version:5,userId:7,testId:72513,testMode:'COMPREHENSIVE',sessionMode:'SERIOUS',assignmentTaskId:238,assignmentPart:1,assignmentParts:[1],isPartAssignment:true,
    savedAt:new Date().toISOString(),passageNumber:1,currentOrdinalNumber:13,remainingSeconds:3450,elapsedSeconds:150,answeredCount:13,totalQuestions:60,
    results:questions.slice(0,13).map(q=>({questionId:q.id,ordinalNumber:q.ordinalNumber,answerId:q.questionAnswers[1].id,answerOrdinal:2,clientAnswer:'Option 2'})),
    questionStates:questions.map((q,index)=>({questionId:q.id,ordinalNumber:q.ordinalNumber,answered:index<13,answers:q.questionAnswers.map(a=>({answerId:a.id,answerOrdinal:a.ordinalNumberQuestionAnswer,selected:index<13&&a.correct,clientAnswer:index<13&&a.correct?'Option 2':''}))})),
    annotationNotes:[{id:'keep-note',specificNote:'Keep this note'}],annotations:[{containerId:'passage-text-1',start:0,end:5,type:'highlight',text:'Saved'}]};
   window.originalDraft=structuredClone(draft);
   const key='ieltsReadingInProgress:7:comprehensive:test:72513:serious:task:238:parts:1';
   // Include a fresh/private browser restoring only the server copy.
   if(!hasVideo||endingType===14)localStorage.setItem(key,JSON.stringify(draft));
   const cookie=JSON.stringify({id:7,roles:[{name:'ROLE_VIEWER'}]});
   angular.module('Hrm.Question',[]).value('settings',{}).value('Utilities',{}).value('$uibModal',{})
    .value('$location',{path:()=>location.pathname,search:()=>Object.fromEntries(new URLSearchParams(location.search))})
    .value('$stateParams',{ieltsReadingTestId:'72513',assignmentTaskId:'238',assignmentPart:'1',assignmentParts:'1',sessionMode:'SERIOUS'})
    .value('$cookies',{getAll:()=>({'education.user':cookie})})
    .value('blockUI',{start(){},stop(){}}).value('toastr',Object.fromEntries(['success','warning','error','info'].map(level=>[level,(...args)=>toasts.push({level,args})])))
    .run(['$rootScope',root=>{root.settings={layout:{}};}])
    .factory('QuestionService',['$q',q=>({getAssignedTask:()=>q.when({activityType:'COMPREHENSIVE',ieltsTestId:72513,shuffleQuestions:false}),
     getOne:()=>q.when(angular.copy(data)),getLearningDrafts:()=>q.when([{draftKey:key,draftType:'IELTS',savedAt:Date.now(),payload:JSON.stringify(draft)}]),
     saveLearningDraft(dto){saved.push(structuredClone(dto));return q.when(true);},deleteLearningDraft(){throw Error('Resume must not delete the draft');}})]);
  },{endingType,hasVideo});
  for(const script of ['question/business/ComprehensiveVideo.js','question/business/ComprehensiveListening.js','question/controllers/IELTSReadingActualTestController.js'])await page.addScriptTag({path:path.join(app,script)});
  await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaVm=angular.element(document.getElementById('qa')).scope().vm;});
  await page.waitForFunction(()=>qaVm.isStartTest||qaVm.startTestError,{},{timeout:5000}).catch(error=>{throw Error(error.message+'\n'+errors.join('\n'));});
  assert.equal(await page.evaluate(()=>qaVm.startTestError),'',errors.join('\n'));
  assert.equal(await page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.length),13);
  assert.equal(await page.evaluate(()=>qaVm.ieltsReadingActualTest.subQuestions[0].subQuestions[0].sentenceEndingSlots[0].items[0].answerIndex),1);
  assert.equal(await page.evaluate(()=>qaVm.annotationNotes[0].specificNote),'Keep this note');
  const remaining=await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().counter);
  assert.ok(remaining>3440&&remaining<=3450,'resume keeps the saved 3450 seconds, not a fresh hour');
  await page.waitForFunction(()=>saved.length>0);
  const restored=await page.evaluate(()=>JSON.parse(saved.at(-1).payload));
  assert.ok(restored.remainingSeconds>3440&&restored.remainingSeconds<=3450);
  assert.ok(restored.elapsedSeconds>=150&&restored.elapsedSeconds<160,'resume keeps the elapsed 150 seconds');
  assert.equal(restored.results.length,13);assert.equal(restored.annotationNotes[0].specificNote,'Keep this note');
  assert.deepEqual(restored.annotations,await page.evaluate(()=>originalDraft.annotations));
  await page.evaluate(()=>{const pack=qaVm.ieltsReadingActualTest.subQuestions[0].subQuestions[0];qaVm.dropSentenceEnding(pack,0,pack.sentenceEndingBank.find(ending=>ending.answerIndex===2));});
  assert.equal(await page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.length),13);
  assert.equal(await page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.find(result=>result.ordinalNumber===1).clientAnswer),'Option 3');
  await page.evaluate(()=>{const pack=qaVm.ieltsReadingActualTest.subQuestions[0].subQuestions[0];qaVm.clearSentenceEndingSlot(pack,0);});
  assert.equal(await page.evaluate(()=>qaVm.testResult.questionAnswerTestResult.length),12);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
