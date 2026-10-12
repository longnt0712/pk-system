const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'),repo=path.resolve(app,'../..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const old={id:21,question:'Listening cũ',pronounce:'http://daily-listening-creator.test/audio.wav',motherTongue:'<p>one two three four five six seven eight nine ten.</p>',
 questionType:{id:6},status:5,user:{id:7},questionTopics:[{id:10,topic:{id:2}}],questionAnswers:[{id:8,answer:{id:9,answer:'Keep'}}],correctAnswer:3,timeReviewd:142};
const css=['assets/css/external/bootstrap.min.css','assets/css/external/font-awesome.min.css','assets/css/components-md.min.css','assets/css/test-builder.css','assets/css/daily-listening-builder.css','assets/css/comprehensive-listening.css','assets/css/comprehensive-folders.css'].map(name=>fs.readFileSync(path.join(app,name),'utf8')).join('\n');
const shared={...old,title:old.question,questionType:{id:11},testFormat:'DAILY_LISTENING',status:7};
async function fixture(browser,width,learner=false,record=shared){
 const page=await browser.newPage({viewport:{width,height:950},timezoneId:'Asia/Bangkok'}),errors=[];page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(/(?:daily_listening_import_modal|test_folder_explorer|comprehensive_move_test_folder_modal)\.html$/.test(url.pathname))return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(app,'question/views/'+url.pathname.split('/').pop()),'utf8')});
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
   'body{padding:16px!important;}main{max-width:1200px;margin:auto;padding:0 15px;}*{box-sizing:border-box;}@media(max-width:600px){body{padding:8px!important;}}</style></head><body><main id="qa" ng-controller="'+(learner?'ViewController':'DailyListeningTestController')+' as vm">'+template+'</main></body></html>');
  for(const script of ['jquery.min.js','angular.min.js','angular-sanitize.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external/'+script)});
  await page.evaluate(({learner,record})=>{
   window.App={initAjax(){}};localStorage.setItem('fillingGapRatePercent','100');
   window.records=[structuredClone(record),{...structuredClone(record),id:22,question:'Other teacher',title:'Other teacher',user:{id:8}},
    {...structuredClone(record),id:23,question:'Vocabulary',status:1,questionType:{id:6},testFormat:null,pronounce:''}];window.saveCalls=[];window.pageCalls=[];window.results=[];
   const cookie=JSON.stringify({id:7,username:'Teacher',roles:[{name:'ROLE_ADMIN'}],person:{firstName:'Teacher'}});
   angular.module('Hrm.Question',['ui.bootstrap','ngSanitize']).value('settings',{})
    .value('$cookies',{get(){return cookie;},getAll(){return{'education.user':cookie};}})
    .value('$location',{path(){return learner?'/daily_listening/21':'/create_daily_listening_test';}})
    .value('$stateParams',learner?{dailyListeningId:String(record.id)}:{})
    .value('Utilities',{}).value('blockUI',{start(){},stop(){}}).value('TopicService',{})
    .value('toastr',{success(){},error(){},warning(){},info(){}})
    .run(['$rootScope',root=>{root.settings={layout:{}};}])
    .factory('QuestionService',['$q',function(q){return{
     getDailyListeningTests(dto,index,size){window.pageCalls.push(structuredClone(dto));
      const data=window.records.filter(item=>item.questionType.id===11&&item.testFormat==='DAILY_LISTENING'&&item.status===7&&
       (!dto.withoutTestFolder||!item.testFolderId)&&(!dto.testFolderId||item.testFolderId===dto.testFolderId)&&(!dto.textSearch||item.question.includes(dto.textSearch)));
      return q.when({content:structuredClone(data.slice((index-1)*size,index*size)),totalElements:data.length});},
     getLegacyDailyListening(dto,index,size){const data=window.records.filter(item=>item.questionType.id===6&&(dto.status===3||item.status===5)&&item.pronounce&&item.motherTongue&&(!dto.textSearch||item.question.includes(dto.textSearch)));
      return q.when({content:structuredClone(data.slice((index-1)*size,index*size)),totalElements:data.length});},
     migrateDailyListening(id){const dto=structuredClone(window.records.find(item=>item.id===id));return this.saveDailyListening({...dto,userId:dto.user.id,questionType:{id:11},testFormat:'DAILY_LISTENING',status:7});},
     getOne(id){return q.when(structuredClone(window.records.find(item=>String(item.id)===String(id))));},
     saveDailyListening(dto){window.saveCalls.push(structuredClone(dto));const deferred=q.defer();function finish(){
      if(window.failSave||(window.failSaveId!=null&&window.failSaveId===dto.id)){deferred.reject({data:{message:'Lưu lỗi thử nghiệm'}});return;}
      const saved={...structuredClone(dto),id:dto.id||30+window.saveCalls.length,title:dto.question,user:{id:dto.userId||7}};
      const index=window.records.findIndex(item=>item.id===saved.id);if(index>=0)window.records[index]=saved;else window.records.push(saved);
      deferred.resolve(structuredClone(saved));}
      if(window.holdSave)window.releaseSave=finish;else finish();return deferred.promise;
     },
     getTableDefinitionQuestions(){return[];},getLearningDrafts(){return q.when([]);},saveLearningDraft(){return q.when({id:1});},deleteLearningDraft(){return q.when(true);},
     saveTestResult(dto){window.results.push(structuredClone(dto));return q.when({id:101});}
    };}]);
  },{learner,record});
  for(const helper of ['ComprehensiveVideo','ComprehensiveListening','ComprehensiveFolders'])await page.addScriptTag({path:path.join(app,'question/business/'+helper+'.js')});
  await page.evaluate(()=>{
   window.folders=[];window.folderCalls=[];window.moveCalls=[];
   angular.module('Hrm.Question').factory('TestFolderService',['$q',q=>({
    getTestFolders(all,mode){window.folderCalls.push(mode);return q.when(structuredClone(window.folders));},
    saveTestFolder(dto){const saved={...structuredClone(dto),id:dto.id||window.folders.length+1,ownerId:7,ownerName:'Teacher',canManage:true};const index=window.folders.findIndex(item=>item.id===saved.id);if(index>=0)window.folders[index]=saved;else window.folders.push(saved);return q.when(saved);},
    moveTest(id,folderId){window.moveCalls.push({id,folderId});const deferred=q.defer();function finish(){if(window.failMove){deferred.reject({data:{message:'Di chuyển lỗi thử nghiệm'}});return;}
     const item=window.records.find(item=>item.id===id);item.testFolderId=folderId;item.testFolder=structuredClone(window.folders.find(folder=>folder.id===folderId)||null);deferred.resolve(structuredClone(item));}
     if(window.holdMove)window.releaseMove=finish;else finish();return deferred.promise;}
   })]);
  });
  await page.addScriptTag({path:path.join(app,'question/controllers/'+(learner?'ViewController':'DailyListeningTestController')+'.js')});
  await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaVm=angular.element(document.getElementById('qa')).scope().vm;});
 }
 await mount();return{page,errors,mount};
}
test('shared creator loads lessons across teachers, preserves imported data, saves pasted text and retries on desktop/mobile',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1366,390]){
  const {page,errors}=await fixture(browser,width);
  await page.getByRole('heading',{name:'Listening cũ',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Other teacher'}).count(),1);assert.equal(await page.getByRole('heading',{name:'Vocabulary',exact:true}).count(),0);
  await page.locator('article').filter({has:page.getByRole('heading',{name:'Listening cũ',exact:true})}).getByRole('button',{name:'Sửa bài',exact:true}).click();
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
  const created=await page.evaluate(()=>window.qaVm.draft);assert.equal(created.status,7);assert.equal(created.questionType.id,11);assert.equal(created.testFormat,'DAILY_LISTENING');assert.deepEqual(created.questionAnswers,[]);
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
  const {page,errors,mount}=await fixture(browser,width,true,{...shared,motherTongue:'one two three four five six seven eight nine ten.'});
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
test('marked and unmarked legacy listening migrate into the shared library with original ids and retryable failures',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1366,390]){
  const {page,errors}=await fixture(browser,width);
  await page.evaluate(record=>{
   window.records.push({...structuredClone(record),id:51,question:'Bài nghe chung',title:'Bài nghe chung',user:{id:26},questionType:{id:11},testFormat:'DAILY_LISTENING',status:7},
    {...structuredClone(record),id:52,question:'Track cũ 1',status:5,user:{id:26}},
    {...structuredClone(record),id:53,question:'Track cũ 2',status:4,user:{id:26}},
    {...structuredClone(record),id:54,question:'Flashcard chưa có audio',pronounce:'javascript:bad',status:1,user:{id:26}});
  },old);
  await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().$apply(()=>window.qaVm.load()));
  await page.getByRole('heading',{name:'Bài nghe chung',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Track cũ 1',exact:true}).count(),0);
  await page.getByRole('button',{name:'Chuyển bài cũ vào kho chung',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'Chọn Track cũ 1',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('checkbox',{name:'Chọn Track cũ 2',exact:true}).count(),0);
  await dialog.getByRole('checkbox',{name:'Bao gồm flashcard chưa đánh dấu Listening',exact:true}).check();
  await dialog.getByRole('checkbox',{name:'Chọn Track cũ 2',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('checkbox',{name:'Chọn Flashcard chưa có audio',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Chọn bài hợp lệ trên trang này',exact:true}).click();
  await page.evaluate(()=>{window.holdSave=true;window.failSaveId=53;});
  await dialog.getByRole('button',{name:/^Đưa sang Daily Listening \(2\)/}).click();
  await dialog.getByRole('button',{name:'Đang chuyển...',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Đang chuyển...',exact:true}).isDisabled(),true);
  assert.equal(await dialog.locator('.modal-footer').getByRole('button',{name:'Đóng',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('combobox',{name:'Nguồn bài nghe',exact:true}).count(),0);
  await page.waitForFunction(()=>window.saveCalls.length===1);
  await page.evaluate(()=>{window.holdSave=false;window.releaseSave();});
  await dialog.getByRole('alert').filter({hasText:'Lưu lỗi thử nghiệm'}).waitFor();
  assert.equal(await dialog.getByRole('checkbox',{name:'Chọn Track cũ 1',exact:true}).count(),0);
  assert.equal(await dialog.getByRole('checkbox',{name:'Chọn Track cũ 2',exact:true}).isChecked(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(repo,'.tmp/daily-listening-import-'+width+'.png'),fullPage:true});
  await page.evaluate(()=>window.failSaveId=null);
  await dialog.getByRole('button',{name:/^Đưa sang Daily Listening \(1\)/}).click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('heading',{name:'Track cũ 1',exact:true}).waitFor();await page.getByRole('heading',{name:'Track cũ 2',exact:true}).waitFor();
  const moved=await page.evaluate(()=>window.records.find(item=>item.id===52));
  assert.equal(moved.status,7);assert.equal(moved.testFormat,'DAILY_LISTENING');assert.equal(moved.questionType.id,11);assert.equal(moved.user.id,26);assert.equal(moved.motherTongue,old.motherTongue);
  assert.equal(moved.correctAnswer,old.correctAnswer);assert.equal(moved.timeReviewd,142);assert.deepEqual(moved.questionAnswers,old.questionAnswers);assert.deepEqual(moved.questionTopics,old.questionTopics);
  assert.equal(await page.evaluate(()=>window.saveCalls.filter(item=>item.id===52).length),1);
  assert.equal(await page.evaluate(()=>window.saveCalls.filter(item=>item.id===53).length),2);
  assert.equal(await page.evaluate(()=>window.records.filter(item=>item.id===52).length),1);
  await page.getByRole('button',{name:'Chuyển bài cũ vào kho chung',exact:true}).click();
  await dialog.getByRole('checkbox',{name:'Bao gồm flashcard chưa đánh dấu Listening',exact:true}).check();await dialog.getByRole('checkbox',{name:'Chọn Flashcard chưa có audio',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('checkbox',{name:'Chọn Track cũ 1',exact:true}).count(),0);
  assert.equal(await dialog.getByRole('button',{name:/^Đưa sang Daily Listening/}).isDisabled(),true);
  const before=await page.evaluate(()=>window.saveCalls.length);await dialog.locator('.modal-footer').getByRole('button',{name:'Đóng',exact:true}).click();
  await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.saveCalls.length),before);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('Daily Listening creates nested folders, switches views and moves without refreshing the whole list or losing editor text',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const width of [1366,390]){
  const {page,errors}=await fixture(browser,width);
  const explorer=page.locator('.daily-listening-catalog .test-folder-explorer');
  const file=title=>explorer.locator('article').filter({has:page.getByRole('heading',{name:title,exact:true})});
  await file('Listening cũ').getByRole('button',{name:'Sửa bài',exact:true}).click();
  await page.getByRole('textbox',{name:/Tên bài/}).fill('Chưa lưu tên này');await page.getByRole('textbox',{name:'Transcript',exact:true}).fill('This transcript has not been saved yet.');
  await explorer.getByRole('button',{name:'Tạo folder',exact:true}).click();await explorer.getByRole('textbox',{name:'Tên folder',exact:true}).fill('Daily');
  await explorer.getByRole('button',{name:'Lưu folder',exact:true}).click();await explorer.locator('.test-explorer-folder').filter({hasText:'Daily'}).waitFor();
  assert.equal(await page.evaluate(()=>window.folders[0].testMode),'DAILY_LISTENING');
  await explorer.locator('.test-explorer-folder').filter({hasText:'Daily'}).click();await explorer.getByRole('button',{name:'Tạo folder con',exact:true}).waitFor();
  await explorer.getByRole('button',{name:'Tạo folder con',exact:true}).click();await explorer.getByRole('textbox',{name:'Tên folder',exact:true}).fill('Week 1');
  await explorer.getByRole('button',{name:'Lưu folder',exact:true}).click();await explorer.locator('.test-explorer-folder').filter({hasText:'Week 1'}).waitFor();
  assert.equal(await page.evaluate(()=>window.folders[1].parentId),1);
  await explorer.locator('.test-explorer-path > button').click();await file('Listening cũ').waitFor();
  await explorer.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-listening-catalog .test-folder-explorer').classList.contains('is-list'));
  await explorer.getByRole('button',{name:'Chuyển sang dạng biểu tượng',exact:true}).click();
  await page.evaluate(()=>{window.holdMove=true;window.keptRow=document.querySelectorAll('.daily-listening-catalog article')[1];});
  const before=await page.evaluate(()=>window.pageCalls.length);
  await file('Listening cũ').locator('.test-explorer-file-main').dragTo(explorer.locator('.test-explorer-folder').filter({hasText:'Daily'}));
  await page.waitForFunction(()=>window.moveCalls.length===1);assert.equal(await page.evaluate(()=>window.qaVm.catalogMovePending),true);
  await page.evaluate(()=>{window.holdMove=false;window.releaseMove();});await file('Listening cũ').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.pageCalls.length),before);assert.equal(await page.evaluate(()=>window.keptRow===document.querySelector('.daily-listening-catalog article')),true);
  assert.equal(await page.getByRole('textbox',{name:/Tên bài/}).inputValue(),'Chưa lưu tên này');assert.equal(await page.getByRole('textbox',{name:'Transcript',exact:true}).inputValue(),'This transcript has not been saved yet.');
  assert.equal(await page.evaluate(()=>window.qaVm.draft.testFolderId),1);
  await file('Other teacher').getByRole('button',{name:'Di chuyển',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.locator('.test-move-folder').filter({hasText:'Week 1'}).click();await page.evaluate(()=>window.failMove=true);
  await dialog.getByRole('button',{name:'Di chuyển đến đây',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Di chuyển lỗi thử nghiệm'}).waitFor();
  assert.equal(await file('Other teacher').count(),1);await page.evaluate(()=>window.failMove=false);
  await dialog.getByRole('button',{name:'Di chuyển đến đây',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.records.find(item=>item.id===22).testFolderId),2);
  assert.equal(await page.evaluate(()=>window.records.find(item=>item.id===22).user.id),8);
  await explorer.locator('.test-explorer-folder').filter({hasText:'Daily'}).click();await file('Listening cũ').waitFor();
  await page.screenshot({path:path.join(repo,'.tmp/daily-listening-folders-'+width+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
