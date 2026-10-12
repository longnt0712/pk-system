const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'),repo=path.resolve(app,'../..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const old={id:21,question:'Listening cũ',pronounce:'http://daily-listening-creator.test/audio.wav',motherTongue:'<p>one two three four five six seven eight nine ten.</p>',
 questionType:{id:6},status:5,user:{id:7},questionTopics:[{id:10,topic:{id:2}}],questionAnswers:[{id:8,answer:{id:9,answer:'Keep'}}],correctAnswer:3};
const css=['assets/css/external/bootstrap.min.css','assets/css/external/font-awesome.min.css','assets/css/daily-listening-builder.css','assets/css/comprehensive-listening.css'].map(name=>fs.readFileSync(path.join(app,name),'utf8')).join('\n');
async function fixture(browser,width,learner=false,record=old){
 const page=await browser.newPage({viewport:{width,height:950},timezoneId:'Asia/Bangkok'}),errors=[];page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/audio.wav'){
   const audio=Buffer.alloc(44+8000*2*10);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVE',8);audio.write('fmt ',12);
   audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
   return route.fulfill({contentType:'audio/wav',body:audio});
  }
  if(/fontawesome-webfont\.(woff2?|ttf|eot)/.test(url.pathname))return route.fulfill({body:fs.readFileSync(path.join(app,'assets/fonts/'+url.pathname.split('/').pop()))});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
 });
 await page.goto('http://daily-listening-creator.test');
 async function mount(){
  const template=fs.readFileSync(path.join(app,'question/views/'+(learner?'view.html':'create_daily_listening_test.html')),'utf8');
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+css+
   'body{padding:16px;}main{max-width:1200px;margin:auto;}*{box-sizing:border-box;}@media(max-width:600px){body{padding:8px;}}</style></head><body><main id="qa" ng-controller="'+(learner?'ViewController':'DailyListeningTestController')+' as vm">'+template+'</main></body></html>');
  for(const script of ['jquery.min.js','angular.min.js','angular-sanitize.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external/'+script)});
  await page.evaluate(({learner,record})=>{
   window.App={initAjax(){}};localStorage.setItem('fillingGapRatePercent','100');
   window.records=[structuredClone(record),{...structuredClone(record),id:22,question:'Other teacher',user:{id:8}},
    {...structuredClone(record),id:23,question:'Vocabulary',status:1}];window.saveCalls=[];window.pageCalls=[];window.results=[];
   const cookie=JSON.stringify({id:7,username:'Teacher',roles:[{name:'ROLE_ADMIN'}],person:{firstName:'Teacher'}});
   angular.module('Hrm.Question',['ui.bootstrap','ngSanitize']).value('settings',{})
    .value('$cookies',{get(){return cookie;},getAll(){return{'education.user':cookie};}})
    .value('$location',{path(){return learner?'/daily_listening/21':'/create_daily_listening_test';}})
    .value('$stateParams',learner?{dailyListeningId:String(record.id)}:{})
    .value('Utilities',{}).value('blockUI',{start(){},stop(){}}).value('TopicService',{})
    .value('toastr',{success(){},error(){},warning(){},info(){}})
    .run(['$rootScope',root=>{root.settings={layout:{}};}])
    .factory('QuestionService',['$q',function(q){return{
     getPage(dto,index,size){window.pageCalls.push(structuredClone(dto));const data=window.records.filter(item=>item.status===dto.status&&item.user.id===dto.userId&&(!dto.textSearch||item.question.includes(dto.textSearch)));return q.when({content:structuredClone(data.slice((index-1)*size,index*size)),totalElements:data.length});},
     getOne(id){return q.when(structuredClone(window.records.find(item=>String(item.id)===String(id))));},
     saveObject(dto){window.saveCalls.push(structuredClone(dto));const deferred=q.defer();function finish(){
      if(window.failSave){deferred.reject({data:{message:'Lưu lỗi thử nghiệm'}});return;}
      const saved={...structuredClone(dto),id:dto.id||30+window.saveCalls.length,user:{id:7}};
      const index=window.records.findIndex(item=>item.id===saved.id);if(index>=0)window.records[index]=saved;else window.records.push(saved);
      deferred.resolve(structuredClone(saved));}
      if(window.holdSave)window.releaseSave=finish;else finish();return deferred.promise;
     },
     getTableDefinitionQuestions(){return[];},getLearningDrafts(){return q.when([]);},saveLearningDraft(){return q.when({id:1});},deleteLearningDraft(){return q.when(true);},
     saveTestResult(dto){window.results.push(structuredClone(dto));return q.when({id:101});}
    };}]);
  },{learner,record});
  for(const helper of ['ComprehensiveVideo','ComprehensiveListening'])await page.addScriptTag({path:path.join(app,'question/business/'+helper+'.js')});
  await page.addScriptTag({path:path.join(app,'question/controllers/'+(learner?'ViewController':'DailyListeningTestController')+'.js')});
  await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaVm=angular.element(document.getElementById('qa')).scope().vm;});
 }
 await mount();return{page,errors,mount};
}
test('separate creator loads old listening, preserves existing data, saves pasted text and retries failed saves on desktop/mobile',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1366,390]){
  const {page,errors}=await fixture(browser,width);
  await page.getByRole('heading',{name:'Listening cũ',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Other teacher'}).count(),0);assert.equal(await page.getByRole('heading',{name:'Vocabulary',exact:true}).count(),0);
  await page.getByRole('button',{name:'Sửa bài',exact:true}).click();
  await page.waitForFunction(()=>window.qaVm.draft.id===21);
  await page.getByRole('textbox',{name:/Tên bài/}).fill('Listening cũ đã sửa');await page.getByRole('button',{name:'Lưu bài nghe',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Đã lưu bài'}).waitFor();
  const saved=await page.evaluate(()=>window.saveCalls[0]);assert.equal(saved.id,21);assert.equal(saved.motherTongue,old.motherTongue);assert.deepEqual(saved.questionTopics,old.questionTopics);assert.deepEqual(saved.questionAnswers,old.questionAnswers);
  assert.equal(await page.evaluate(()=>window.pageCalls.length),1);
  await page.getByRole('button',{name:'Tạo bài mới',exact:true}).click();
  await page.getByRole('textbox',{name:'Link audio hoặc YouTube',exact:true}).fill('http://daily-listening-creator.test/audio.wav');
  await page.getByRole('textbox',{name:'Transcript',exact:true}).fill('one two three four five six seven eight nine ten.');
  await page.evaluate(()=>window.holdSave=true);await page.getByRole('button',{name:'Lưu bài nghe',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Đang lưu...',exact:true}).isDisabled(),true);
  await page.evaluate(()=>{window.holdSave=false;window.releaseSave();});await page.getByRole('status').filter({hasText:'Đã lưu bài'}).waitFor();
  assert.equal(await page.getByRole('spinbutton').count(),0);
  const created=await page.evaluate(()=>window.qaVm.draft);assert.equal(created.status,5);assert.equal(created.questionType.id,6);assert.deepEqual(created.questionAnswers,[]);
  assert.match(await page.getByRole('link',{name:'Mở bài đã lưu'}).getAttribute('href'),/daily_listening\/\d+/);
  await page.evaluate(()=>window.failSave=true);await page.getByRole('textbox',{name:'Transcript',exact:true}).fill('one two three four five six seven eight nine ten eleven.');
  await page.getByRole('button',{name:'Lưu bài nghe',exact:true}).click();await page.getByRole('alert').filter({hasText:'Lưu lỗi thử nghiệm'}).waitFor();
  assert.match(await page.getByRole('textbox',{name:'Transcript',exact:true}).inputValue(),/eleven/);
  await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'Lưu bài nghe',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu bài'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  fs.mkdirSync(path.join(repo,'.tmp'),{recursive:true});await page.screenshot({path:path.join(repo,'.tmp/daily-listening-creator-'+width+'.png'),fullPage:true});
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
test('standalone page uses the complete old gap engine and saves success at 90% without a topic',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1366,390]){
  const {page,errors,mount}=await fixture(browser,width,true,{...old,motherTongue:'one two three four five six seven eight nine ten.'});
  await page.locator('input[id^="gap-number-"]').first().waitFor();
  assert.equal(await page.getByRole('button',{name:/Hiện Title|Ẩn Title/}).count(),0);
  assert.equal(await page.evaluate(()=>window.qaVm.currentCard.id),21);
  const answers=await page.evaluate(()=>Object.entries(window.qaVm.gapAnswers));assert.equal(answers.length,10);
  for(const [index,answer] of answers.slice(0,8)){
   await page.locator('#gap-number-'+index).fill(answer);
   await page.waitForFunction(next=>document.activeElement.id==='gap-number-'+next,Number(index)+1);
   if(width===1366&&Number(index)===2){
    await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().$apply(()=>window.qaVm.saveDailyListeningDraft()));
    await page.reload();await mount();
    await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
    await page.waitForFunction(()=>window.qaVm.dailyListeningDraftRestored===true);
    assert.equal(await page.locator('#gap-number-0').inputValue(),answers[0][1]);
    assert.equal(await page.evaluate(()=>Object.values(window.qaVm.gapCorrectMap).filter(Boolean).length),3);
   }
  }
  assert.equal(await page.evaluate(()=>window.results.length),0);assert.equal(await page.evaluate(()=>window.qaVm.percentage),80);
  fs.mkdirSync(path.join(repo,'.tmp'),{recursive:true});await page.screenshot({path:path.join(repo,'.tmp/daily-listening-standalone-'+width+'.png'),fullPage:true});
  await page.locator('#gap-number-'+answers[8][0]).fill(answers[8][1]);await page.waitForFunction(()=>window.results.length===1);
  const result=await page.evaluate(()=>window.results[0]);assert.equal(result.testType,3);assert.equal(result.sourceQuestionId,21);assert.equal(result.resultStatus,'SUCCESS');assert.equal(result.testTime,'GAPS 90%');
  assert.equal(await page.evaluate(()=>window.pageCalls.length),0);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
