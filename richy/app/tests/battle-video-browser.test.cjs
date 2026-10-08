const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'), view=fs.readFileSync(path.join(app,'question/views/battle_quiz_online.html'),'utf8');
function fragment(start,end){const i=view.indexOf(start),j=view.indexOf(end,i);assert.ok(i>=0&&j>i);return view.slice(i,j);}
const hostPane=fragment('    <section class="battle-online-card battle-online-host-video"','    <ng-include ng-if="vm.room && vm.room.status');
const exercise=fragment('            <section class="battle-online-exercise"','            <div class="battle-online-private-loading"');
const waiting=fragment('            <div class="battle-online-video-wait"','            <div class="demon-student-tools"');
const feedback=fragment('            <div class="battle-online-feedback is-wrong"','            <section class="battle-online-guess-review"');
const css=fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8')+'\n'+
 Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(app,'assets/css/comprehensive-video.css'),'utf8');
async function open(browser,username,width){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.setContent('<html><head><meta charset="UTF-8"><style>'+css+'</style></head><body><div id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm">'+hostPane+waiting+exercise+feedback+'</div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular-sanitize.min.js')});
 await page.evaluate(({username,template})=>{
  window.APP_VERSION='qa';window.videoCalls=[];window.answerCalls=[];window.answerRequests=[];window.videoActions=[];window.listCalls=[];window.reopenRequests=[];
  angular.module('Hrm.Question',['ngSanitize']).value('$state',{go(){}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(){},success(){}}).value('blockUI',{}).value('QuestionService',{})
   .factory('BattleQuizOnlineService',function($q){return {answer(...args){window.answerCalls.push(args);const request=$q.defer();window.answerRequests.push(request);return request.promise;},
    getVideoQuestions(...args){window.listCalls.push(args);return $q.when(window.videoQuestionPreviews||[{sequence:1,seconds:5,preview:'What is the name…'},{sequence:2,seconds:10,preview:'Who is…'}]);},
    reopenVideoQuestion(...args){const request=$q.defer();window.reopenRequests.push({args,request});return request.promise;},
    videoEvent(...args){const request=$q.defer();window.videoCalls.push({args,request});return request.promise;}};})
   .directive('comprehensiveVideoPlayer',function(){return {scope:{onVideoReady:'&',onVideoProgress:'&',onVideoState:'&',onVideoEnded:'&'},
    template:'<div class="comprehensive-video-player"><div class="comprehensive-video-mount"><video></video></div></div>',link(scope){
     const api={ready:true,play(){window.videoActions.push('play');},pause(){window.videoActions.push('pause');},seek(t){window.videoActions.push(['seek',t]);}};
     window.videoAdapter=scope;scope.onVideoReady({api});}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_exercise_form.html?v=qa&individualQuestions=20261007_1',template);});
 },{username,template:fs.readFileSync(path.join(app,'question/views/battle_online_exercise_form.html'),'utf8')});
 const source=fs.readFileSync(path.join(app,'question/controllers/BattleQuizOnlineController.js'),'utf8')
  .replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.battleHooks = {applyRoom: applyRoom};');
 await page.addScriptTag({content:source});
 await page.addScriptTag({path:path.join(app,'question/controllers/BattleExerciseForm.js')});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();});
 return page;
}
function room(mode,phase,revision=1,sequence=1){return {code:'VIDEO1',hostUsername:'host',status:'PLAYING',serverTime:Date.now(),
 settings:{mode,questionSource:'COMPREHENSIVE',exerciseTestIds:[100],topicNames:['Video lesson'],teamCount:2,skillsEnabled:false},
 players:[{username:'host',spectator:true,connected:true},{username:'alice',spectator:false,connected:true,teamNumber:1}],recentEvents:[],
 videoSynchronized:true,videoPhase:phase,videoRevision:revision,videoPositionSeconds:3,guessPhase:'QUESTION',
 currentQuestionIndex:sequence,totalQuestions:2,questionEndsAt:phase==='ANSWERING'?Date.now()+20000:0,matchEndsAt:0,
 currentQuestion:{id:200+sequence,sequence,exercise:{type:1,answerMode:'SINGLE',videoUrl:'https://school.test/video.mp4',videoSourceId:'100:101',
 videoTimeSeconds:10,videoAnswerSeconds:20,instructionsHtml:'<p>Xem video và chọn đáp án.</p>',items:[{id:'201',number:1,
 promptHtml:'<b>What did you see?</b>',options:[{key:'A',text:'A cat'},{key:'B',text:'A dog'}]}]}}};}
async function apply(page,snapshot){await page.evaluate(r=>{window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false));},snapshot);}
test('actual Battle templates preload hidden answers in all modes and host video controls pause/resume across cues',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  const student=await open(browser,'alice',390),host=await open(browser,'host',1280);
  let revision=1;
  for(const mode of ['CLASSIC','GUESS_WORD','COUNTDOWN','MONEY_BEG','ESCAPE_DUMB_DEMON','DEMON_DEFENSE','LUM_NGAY']){
   await apply(student,room(mode,'WATCHING',revision++));
   assert.equal(await student.locator('.battle-online-answer-btn').count(),2,mode+' preloaded');
   assert.equal(await student.locator('.battle-online-answer-btn').first().isVisible(),false,mode+' hidden');
   assert.equal(await student.locator('.battle-online-video-wait').isVisible(),true,mode+' waiting');
   await apply(student,room(mode,'ANSWERING',revision++));
   assert.equal(await student.locator('.battle-online-answer-btn').first().isVisible(),true,mode+' open');
   assert.equal(await student.locator('.battle-online-answer-btn').first().isEnabled(),true,mode+' enabled');
   assert.equal(await student.locator('.battle-online-host-video').count(),0,'student has no video player');
  }
  await student.locator('.battle-online-answer-btn').first().click();
  assert.equal(await student.evaluate(()=>window.answerCalls.length),1);
  await apply(host,room('DEMON_DEFENSE','WATCHING',1));
  assert.equal(await host.locator('.battle-online-host-video').isVisible(),true,'spectator host sees video');
  await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();
  const list=host.locator('#battle-host-video-question-list');await list.waitFor({state:'visible'});
  assert.equal(await list.locator('li').count(),2);assert.match(await list.innerText(),/0:05\s+1\. What is the name…/);
  assert.deepEqual(await host.evaluate(()=>window.listCalls[0]),['VIDEO1']);
  const captureDir=path.join(app,'../target');fs.mkdirSync(captureDir,{recursive:true});
  await host.screenshot({path:path.join(captureDir,'battle-video-host-question-list.png'),fullPage:true});
  await host.setViewportSize({width:390,height:844});
  const listBox=await list.boundingBox();assert.ok(listBox.x>=0&&listBox.x+listBox.width<=390&&listBox.height<844);
  await host.setViewportSize({width:1280,height:900});
  await host.keyboard.press('Escape');await list.waitFor({state:'hidden'});
  await host.evaluate(()=>window.qaScope.$apply(()=>window.videoAdapter.onVideoProgress({seconds:10,duration:60})));
  assert.equal(await host.evaluate(()=>window.videoCalls[0].args[2]),'CUE');
  await host.evaluate(r=>window.qaScope.$apply(()=>window.videoCalls[0].request.resolve(r)),room('DEMON_DEFENSE','ANSWERING',2));
  assert.equal(await host.getByRole('button',{name:'Phát / tiếp tục video'}).isEnabled(),false);
  assert.ok(await host.evaluate(()=>window.videoActions.includes('pause')));
  const modal=host.locator('#battle-host-video-question-modal');
  await modal.waitFor({state:'visible'});
  assert.match(await modal.innerText(),/What did you see\?/);
  assert.match(await modal.locator('[role="timer"]').innerText(),/20/);
  assert.equal(await modal.locator('.battle-online-answer-btn').first().isEnabled(),false,'spectator host only displays the question');
  assert.equal(await student.locator('#battle-host-video-question-modal').count(),0,'students have no host popup');
  for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
   await host.setViewportSize(viewport);const box=await modal.boundingBox();
   assert.ok(box.width>viewport.width*.9&&box.width<viewport.width,'question modal is almost screen width');
   assert.ok(box.height>viewport.height*.9&&box.height<viewport.height,'question modal is almost screen height');
   assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
  }
  await host.setViewportSize({width:1366,height:768});
  await host.screenshot({path:path.join(captureDir,'battle-video-host-question-modal.png'),fullPage:true});
  await host.keyboard.press('Tab');assert.equal(await modal.locator('button').first().evaluate(el=>el===document.activeElement),true);
  await host.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  await apply(host,room('DEMON_DEFENSE','ANSWERING',3));assert.equal(await modal.count(),0,'broadcast does not reopen a dismissed popup');
  await host.getByRole('button',{name:'Xem câu hỏi',exact:true}).click();await modal.waitFor({state:'visible'});
  const before=await host.evaluate(()=>window.videoActions.filter(a=>a==='play').length);
  await apply(host,room('DEMON_DEFENSE','WATCHING',4,2));
  assert.equal(await modal.count(),0,'resumed video closes the question');
  assert.equal(await host.evaluate(()=>document.body.classList.contains('battle-host-question-modal-open')),false);
  assert.ok(await host.evaluate(()=>window.videoActions.filter(a=>a==='play').length)>before);
  for(const viewport of [{width:1920,height:900},{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
   await host.setViewportSize(viewport);
   const card=await host.locator('.battle-online-host-video').boundingBox(),video=await host.locator('video').boundingBox();
   assert.ok(card.height<viewport.height-30,JSON.stringify({viewport,card}));
   assert.ok(card.x>=0&&card.x+card.width<=viewport.width,'video card fits horizontally');
   assert.ok(Math.abs(video.width/video.height-16/9)<0.02,'video keeps its aspect ratio');
  }
  await host.setViewportSize({width:1366,height:768});
  await host.screenshot({path:path.join(captureDir,'battle-video-host.png'),fullPage:true});
  await student.screenshot({path:path.join(captureDir,'battle-video-student.png'),fullPage:true});
  const response=room('LUM_NGAY','WATCHING',revision++,2);
  await student.evaluate(result=>window.qaScope.$apply(()=>window.answerRequests[0].resolve(result)),{correct:true,room:response});
  const toast=student.locator('.battle-online-video-answer-toast');await toast.waitFor({state:'visible'});
  assert.match(await toast.innerText(),/Correct/);assert.equal(await student.locator('.battle-online-feedback').count(),0);
  const toastBox=await toast.boundingBox();assert.ok(toastBox.width<220&&toastBox.height<80,'feedback stays small in the corner');
  await student.screenshot({path:path.join(captureDir,'battle-video-student-correct-toast.png'),fullPage:true});
  await toast.waitFor({state:'hidden',timeout:4000});
  const next=room('LUM_NGAY','ANSWERING',revision++,2);await apply(student,next);
  await student.locator('.battle-online-answer-btn').first().click();
  await student.evaluate(result=>window.qaScope.$apply(()=>window.answerRequests[1].resolve(result)),{correct:false,room:next});
  await toast.waitFor({state:'visible'});assert.match(await toast.innerText(),/Incorrect/);
  assert.equal(await student.evaluate(()=>window.qaScope.vm.isWrongAnswerPenaltyActive()),false);
  const finished=room('DEMON_DEFENSE','ANSWERING',5,2);finished.status='FINISHED';finished.currentQuestion=null;
  await apply(host,finished);assert.equal(await host.locator('.battle-online-host-video').count(),0,'finish removes the video player');
 }finally{await browser.close();}
});

test('host cue list follows the current cue one third down and offers review or a fresh class answer round',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const host=await open(browser,'host',1280);
  await host.evaluate(()=>{window.videoQuestionPreviews=Array.from({length:60},(_,i)=>({sequence:i+1,seconds:(i+1)*5,preview:'What is the question '+(i+1)+'…'}));});
  await apply(host,room('COUNTDOWN','WATCHING',1,18));
  await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();
  const list=host.locator('#battle-host-video-question-list');await list.waitFor({state:'visible'});
  async function positioned(sequence) {
   await host.waitForFunction(sequence=>{
    const row=document.querySelector('#battle-host-video-question-list li.is-current'),body=document.querySelector('.battle-online-host-question-list-body');
    return row&&row.innerText.includes(sequence+'.')&&Math.abs(row.getBoundingClientRect().top-body.getBoundingClientRect().top-body.clientHeight/3)<3;
   },sequence);
   assert.equal(await list.locator('li.is-current button').getAttribute('aria-current'),'step');
  }
  await positioned(18);
  await host.setViewportSize({width:390,height:844});await positioned(18);
  await host.setViewportSize({width:1280,height:900});await positioned(18);
  const manual=await list.locator('.battle-online-host-question-list-body').evaluate(el=>{el.scrollTop+=35;return el.scrollTop;});
  await apply(host,room('COUNTDOWN','WATCHING',2,18));
  assert.equal(await list.locator('.battle-online-host-question-list-body').evaluate(el=>el.scrollTop),manual,'same-cue broadcasts preserve manual scrolling');
  await apply(host,room('COUNTDOWN','WATCHING',3,19));await positioned(19);
  const captureDir=path.join(app,'../target');fs.mkdirSync(captureDir,{recursive:true});
  await host.screenshot({path:path.join(captureDir,'battle-video-host-question-list.png'),fullPage:true});
  await list.getByRole('button',{name:/1:30 18\. What is/}).click();
  const confirm=host.locator('#battle-host-video-replay-confirm');await confirm.waitFor({state:'visible'});
  assert.deepEqual(await host.evaluate(()=>window.videoActions.at(-1)),['seek',90]);
  assert.equal(await host.evaluate(()=>window.reopenRequests.length),0);
  await host.screenshot({path:path.join(captureDir,'battle-video-host-replay-confirm.png'),fullPage:true});
  await confirm.getByRole('button',{name:'Chỉ xem lại',exact:true}).click();await confirm.waitFor({state:'hidden'});
  await host.evaluate(()=>window.qaScope.$apply(()=>window.videoAdapter.onVideoProgress({seconds:100,duration:500})));
  assert.equal(await host.evaluate(()=>window.videoCalls.length),0,'review does not advance the class timeline');
  assert.equal(await host.evaluate(()=>window.qaScope.vm.room.currentQuestion.sequence),19);
  await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();await positioned(20);
  await list.getByRole('button',{name:/1:30 18\. What is/}).click();await confirm.waitFor({state:'visible'});
  await confirm.getByRole('button',{name:'Cho lớp trả lời lại',exact:true}).click();
  assert.deepEqual(await host.evaluate(()=>window.reopenRequests[0].args),['VIDEO1',19,18,'100:101']);
  const reopened=room('COUNTDOWN','ANSWERING',4,18);reopened.videoQuestionRound=1;reopened.totalQuestions=60;reopened.currentQuestion.exercise.videoTimeSeconds=90;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.reopenRequests[0].request.resolve(r)),reopened);
  await host.locator('#battle-host-video-question-modal').waitFor({state:'visible'});
  assert.equal(await confirm.count(),0);
  assert.equal(await host.evaluate(()=>window.qaScope.vm.hostVideoReplay),null);
  assert.deepEqual(await host.evaluate(()=>window.videoActions.at(-1)),['seek',90]);
 } finally {await browser.close();}
});
