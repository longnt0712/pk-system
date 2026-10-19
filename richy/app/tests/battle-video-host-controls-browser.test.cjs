const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'), view=fs.readFileSync(path.join(app,'question/views/battle_quiz_online.html'),'utf8');
function fragment(start,end){const i=view.indexOf(start),j=view.indexOf(end,i);assert.ok(i>=0&&j>i);return view.slice(i,j);}
const hostPane=fragment('    <div id="battle-host-video-stage"','    <ng-include ng-if="vm.room && vm.room.status');
const exercise=fragment('            <section class="battle-online-exercise"','            <div class="battle-online-private-loading"');
const waiting=fragment('            <div class="battle-online-video-wait"','            <div class="demon-student-tools"');
const feedback=fragment('            <div class="battle-online-feedback is-wrong"','            <section class="battle-online-guess-review"');
const css=fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8')+'\n'+
 Array.from(view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(app,'assets/css/comprehensive-video.css'),'utf8');
async function open(browser,username,width,extra=null,options={}){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.setContent('<html><head><meta charset="UTF-8"><style>'+css+'</style></head><body><div id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm">'+(extra===null?hostPane+waiting+exercise+feedback:extra)+'</div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular-sanitize.min.js')});
 await page.evaluate(({username,template,controlsTemplate,answersTemplate,videoAnswersTemplate,privateSync})=>{
  window.APP_VERSION='qa';window.videoCalls=[];window.timerRequests=[];window.answerCalls=[];window.answerRequests=[];window.videoActions=[];window.listCalls=[];window.reopenRequests=[];window.matchControlRequests=[];window.toastErrors=[];window.privateRoomRequests=[];
  angular.module('Hrm.Question',['ngSanitize']).value('$state',{go(){}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(...args){window.toastErrors.push(args);},success(){}}).value('blockUI',{}).value('QuestionService',{})
   .factory('BattleQuizOnlineService',function($q){const api={answer(...args){window.answerCalls.push(args);const request=$q.defer();window.answerRequests.push(request);return request.promise;},
    setClassicAutoAdvance(...args){const request=$q.defer();window.matchControlRequests.push({action:'auto',args,request});return request.promise;},
    nextClassicQuestion(...args){const request=$q.defer();window.matchControlRequests.push({action:'next',args,request});return request.promise;},
    getVideoQuestions(...args){window.listCalls.push(args);return $q.when(window.videoQuestionPreviews||[{sequence:1,seconds:5,preview:'What is the name…'},{sequence:2,seconds:10,preview:'Who is…'}]);},
    reopenVideoQuestion(...args){const request=$q.defer();window.reopenRequests.push({args,request});return request.promise;},
    setQuestionTimerPaused(...args){const request=$q.defer();window.timerRequests.push({args,request});return request.promise;},
    extendMatchTime(...args){const request=$q.defer();window.matchControlRequests.push({action:'extend',args,request});return request.promise;},
    finishMatch(...args){const request=$q.defer();window.matchControlRequests.push({action:'finish',args,request});return request.promise;},
    videoEvent(...args){const request=$q.defer();window.videoCalls.push({args,request});return request.promise;}};
    if(privateSync) {api.getRoom=(...args)=>{const request=$q.defer();window.privateRoomRequests.push({args,request});return request.promise;};}
    return api;})
   .directive('comprehensiveVideoPlayer',function(){return {scope:{onVideoReady:'&',onVideoProgress:'&',onVideoState:'&',onVideoEnded:'&'},
    template:'<div class="comprehensive-video-player"><div class="comprehensive-video-mount"><video></video></div></div>',link(scope){
     const api={ready:true,play(){window.videoActions.push('play');},pause(){window.videoActions.push('pause');},seek(t){window.videoActions.push(['seek',t]);}};
     window.videoAdapter=scope;scope.onVideoReady({api});}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_exercise_form.html?v=qa&individualQuestions=20261007_1',template);
    $templateCache.put('question/views/battle_online_match_controls.html?matchControls=20261017_2',controlsTemplate);
    $templateCache.put('question/views/battle_online_classic_answers.html?classicAnswers=20261017_1',answersTemplate);
    $templateCache.put('question/views/battle_online_video_answers.html?videoAnswers=20261019_1',videoAnswersTemplate);});
 },{username,privateSync:options.privateSync===true,template:fs.readFileSync(path.join(app,'question/views/battle_online_exercise_form.html'),'utf8'),
  controlsTemplate:fs.readFileSync(path.join(app,'question/views/battle_online_match_controls.html'),'utf8'),
  answersTemplate:fs.readFileSync(path.join(app,'question/views/battle_online_classic_answers.html'),'utf8'),
  videoAnswersTemplate:fs.readFileSync(path.join(app,'question/views/battle_online_video_answers.html'),'utf8')});
 const source=fs.readFileSync(path.join(app,'question/controllers/BattleQuizOnlineController.js'),'utf8')
  .replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'window.battleHooks = {applyRoom: applyRoom, updateCountdown: updateCountdown};');
 await page.addScriptTag({content:source});
 await page.addScriptTag({path:path.join(app,'question/business/QuestionDragDrop.js')});
 await page.addScriptTag({path:path.join(app,'question/controllers/BattleExerciseForm.js')});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();});
 return page;
}
function room(mode,phase,revision=1,sequence=1){return {code:'VIDEO1',hostUsername:'host',status:'PLAYING',serverTime:Date.now(),
 settings:{mode,questionSource:'COMPREHENSIVE',exerciseTestIds:[100],topicNames:['Video lesson'],teamCount:2,skillsEnabled:false},
 players:[{username:'host',spectator:true,connected:true},{username:'alice',spectator:false,connected:true,teamNumber:1}],recentEvents:[],
 videoSynchronized:true,videoPhase:phase,videoRevision:revision,videoPositionSeconds:3,guessPhase:'QUESTION',questionTimerPaused:false,questionTimerRemainingMillis:0,
 currentQuestionIndex:sequence,totalQuestions:2,questionEndsAt:phase==='ANSWERING'?Date.now()+20000:0,matchEndsAt:0,
 currentQuestion:{id:200+sequence,sequence,exercise:{type:1,answerMode:'SINGLE',videoUrl:'https://school.test/video.mp4',videoSourceId:'100:101',
 videoTimeSeconds:10,videoAnswerSeconds:20,instructionsHtml:'<p>Xem video và chọn đáp án.</p>',items:[{id:'201',number:1,
 promptHtml:'<b>What did you see?</b>',options:[{key:'A',text:'A cat'},{key:'B',text:'A dog'}]}]}}};}
async function apply(page,snapshot){await page.evaluate(r=>{window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,false));},snapshot);}

const modes=['CLASSIC','GUESS_WORD','COUNTDOWN','MONEY_BEG','ESCAPE_DUMB_DEMON','DEMON_DEFENSE','LUM_NGAY'];
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
function videoRoom(mode='CLASSIC',phase='WATCHING',revision=1,sequence=1) {
 const snapshot=room(mode,phase,revision,sequence);
 snapshot.classicAutoAdvance=true;snapshot.classicAnswerRevealed=false;snapshot.videoQuestionRound=0;
 return snapshot;
}
function review(sequence=1,round=0) {
 return {questionSequence:sequence,videoQuestionRound:round,videoSourceId:'100:101',
  questionPreview:'What did the class see in the video? Câu '+sequence,correctAnswer:'B. A dog',
  studentAnswers:[{username:'alice',displayName:'Nguyễn Minh Anh',answer:'B. A dog',answered:true,correct:true},
   {username:'bob',displayName:'Trần Học Sinh có tên hiển thị dài để kiểm tra màn hình điện thoại',
    answer:'A. A cat — câu trả lời được giữ nguyên cho giáo viên xem lại. <img src=x onerror="window.answerXss=1">',answered:true,correct:false},
   {username:'carol',displayName:'Lê Thanh',answer:'',answered:false,correct:false}]};
}
async function closeQuestion(page) {
 await page.evaluate(()=>window.qaScope.$apply(()=>window.qaScope.vm.closeHostVideoQuestionModal()));
}
async function resolveControl(page,index,snapshot) {
 await page.evaluate(({index,snapshot})=>window.qaScope.$apply(()=>window.matchControlRequests[index].request.resolve(snapshot)),{index,snapshot});
}

test('all video Battle modes expose serialized Auto and manual Next beside the question list for the host only',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const host=await open(browser,'host',1280),student=await open(browser,'alice',390);
  const errors=[];host.on('pageerror',error=>errors.push(String(error)));
  for(let index=0;index<modes.length;index++) {
   const snapshot=videoRoom(modes[index],'WATCHING',index*10+1);
   await apply(host,snapshot);await apply(student,snapshot);
   const toggle=host.locator('#battle-host-video-auto');await toggle.waitFor({state:'visible'});
   assert.equal(await toggle.getAttribute('role'),'switch');assert.equal(await toggle.getAttribute('aria-checked'),'true');
   const list=host.getByRole('button',{name:'List câu hỏi',exact:true});
   assert.equal(await toggle.evaluate((el,list)=>el.parentElement===list.parentElement,await list.elementHandle()),true,'Auto shares the video toolbar with the list');
   const start=await host.evaluate(()=>window.matchControlRequests.length);
   await toggle.click();assert.equal(await toggle.isDisabled(),true,'Auto serializes pending controls');
   assert.equal(await toggle.getAttribute('aria-checked'),'true','no optimistic state change before server confirmation');
   const request=await host.evaluate(i=>({action:window.matchControlRequests[i].action,args:window.matchControlRequests[i].args}),start);
   assert.equal(request.action,'auto');assert.equal(request.args[0],'VIDEO1');assert.equal(request.args[1],false);
   assert.deepEqual(request.args.slice(2),[1,0],'Auto identifies the cue and replay round');
   await host.evaluate(()=>window.qaScope.$apply(()=>window.qaScope.vm.toggleClassicAuto()));
   assert.equal(await host.evaluate(()=>window.matchControlRequests.length),start+1,'double click cannot create another request');
   snapshot.classicAutoAdvance=false;snapshot.videoRevision++;
   await resolveControl(host,start,snapshot);assert.equal(await toggle.getAttribute('aria-checked'),'false');
   const next=host.locator('#battle-host-video-next');await next.waitFor({state:'visible'});
   assert.equal(await next.isDisabled(),true,'manual Next waits until the cue is reviewed');
   snapshot.videoPhase='ANSWERING';snapshot.classicAnswerRevealed=true;snapshot.videoReview=review();
   snapshot.classicCorrectAnswer='B. A dog';snapshot.questionEndsAt=Date.now()-1;snapshot.serverTime=Date.now();snapshot.videoRevision++;
   await apply(host,snapshot);await closeQuestion(host);assert.equal(await next.isEnabled(),true);
   await host.locator('#battle-host-video-answers-open').click();
   const answers=host.locator('#battle-host-video-answers-modal');await answers.waitFor({state:'visible'});
   assert.match(await answers.innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng/,'completed manual cue is reviewable in '+modes[index]);
   await host.keyboard.press('Escape');await answers.waitFor({state:'hidden'});
   await next.click();assert.equal(await next.isDisabled(),true);
   const nextRequest=await host.evaluate(()=>({action:window.matchControlRequests.at(-1).action,args:window.matchControlRequests.at(-1).args}));
   assert.equal(nextRequest.action,'next');assert.equal(nextRequest.args[0],'VIDEO1');assert.equal(nextRequest.args[1],1);
   assert.equal(nextRequest.args[2],snapshot.questionEndsAt);assert.equal(nextRequest.args[3],0,'Next identifies the replay round');
   const continuing=videoRoom(modes[index],'WATCHING',index*10+5,2);continuing.classicAutoAdvance=false;continuing.videoReview=review();
   await resolveControl(host,start+1,continuing);
   assert.equal(await student.locator('#battle-host-video-auto, #battle-host-video-next, #battle-host-video-answers-open').count(),0);
  }
  assert.deepEqual(errors,[]);await host.close();await student.close();
 } finally {await browser.close();}
});

test('Auto failures preserve confirmed state and stale responses cannot rewind a new video cue or replay round',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const page=await open(browser,'host',390);let snapshot=videoRoom('DEMON_DEFENSE');await apply(page,snapshot);
  const toggle=page.locator('#battle-host-video-auto');await toggle.click();
  await page.evaluate(()=>window.qaScope.$apply(()=>window.matchControlRequests[0].request.reject({status:500,data:{message:'Không đổi được Auto'}})));
  assert.equal(await toggle.isEnabled(),true);assert.equal(await toggle.getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>window.toastErrors.length),1,'failed server requests produce feedback');
  await toggle.click();const previous=videoRoom('DEMON_DEFENSE','WATCHING',2);previous.classicAutoAdvance=false;
  snapshot=videoRoom('DEMON_DEFENSE','WATCHING',3,2);await apply(page,snapshot);await resolveControl(page,1,previous);
  assert.equal(await page.evaluate(()=>window.qaScope.vm.room.currentQuestion.sequence),2,'late response does not reopen a previous cue');
  assert.equal(await toggle.getAttribute('aria-checked'),'true');
  await toggle.click();const staleRound=videoRoom('DEMON_DEFENSE','WATCHING',4,2);staleRound.classicAutoAdvance=false;
  snapshot=videoRoom('DEMON_DEFENSE','WATCHING',5,2);snapshot.videoQuestionRound=1;await apply(page,snapshot);await resolveControl(page,2,staleRound);
  assert.equal(await page.evaluate(()=>window.qaScope.vm.room.videoQuestionRound),1,'late response does not overwrite a replay round');
  assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal(await toggle.isEnabled(),true);await page.close();
 } finally {await browser.close();}
});

test('host sees saved student answers and correctness for the completed cue with responsive, keyboard accessible fullscreen review',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [1280,390]) {
   const page=await open(browser,'host',width),errors=[];page.on('pageerror',error=>errors.push(String(error)));
   const snapshot=videoRoom('COUNTDOWN','WATCHING',1,2);snapshot.videoReview=review();await apply(page,snapshot);
   const toolbar=page.locator('.battle-online-video-actions'),toolbarBounds=await toolbar.boundingBox();
   assert.ok(toolbarBounds.x>=0&&toolbarBounds.x+toolbarBounds.width<=width,'video action toolbar fits the viewport');
   assert.equal(await toolbar.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.screenshot({path:path.join(captures,'battle-video-host-toolbar-'+width+'.png'),fullPage:true});
   const trigger=page.locator('#battle-host-video-answers-open');await trigger.waitFor({state:'visible'});assert.equal(await trigger.isEnabled(),true);
   await trigger.click();const modal=page.locator('#battle-host-video-answers-modal');await modal.waitFor({state:'visible'});
   assert.match(await modal.innerText(),/Câu 1/);assert.match(await modal.innerText(),/What did the class see in the video/);
   assert.match(await modal.innerText(),/B\. A dog/);assert.match(await modal.innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng[\s\S]*B\. A dog/);
   assert.match(await modal.innerText(),/Trần Học Sinh[\s\S]*✕ Sai[\s\S]*A\. A cat/);assert.match(await modal.innerText(),/Lê Thanh[\s\S]*Chưa trả lời/);
   assert.equal(await modal.locator('img').count(),0,'stored response is rendered as text');assert.equal(await page.evaluate(()=>window.answerXss),undefined);
   assert.equal(await page.locator('#battle-host-video-stage #battle-host-video-answers-modal').count(),1,'review is inside the managed fullscreen stage');
   assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'long answer fits the dialog width');
   const bounds=await modal.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=900);
   await modal.getByRole('button').last().focus();await page.keyboard.press('Tab');assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true);
   await page.keyboard.press('Shift+Tab');assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true);
   await modal.screenshot({path:path.join(captures,'battle-video-host-answers-'+width+'.png')});
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
   assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'Escape restores focus to the trigger');
   await page.getByRole('button',{name:'⛶ Toàn màn hình'}).click();await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='battle-host-video-stage');
   await trigger.click();await modal.waitFor({state:'visible'});assert.equal(await modal.evaluate(el=>document.fullscreenElement.contains(el)),true);
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
   if(await page.evaluate(()=>!!document.fullscreenElement)) {await page.evaluate(()=>document.exitFullscreen());}
   await trigger.click();await modal.waitFor({state:'visible'});
   const advanced=videoRoom('COUNTDOWN','ANSWERING',2,3);advanced.videoReview=review(2);advanced.totalQuestions=3;await apply(page,advanced);
   assert.match(await modal.innerText(),/Câu 1/,'polling keeps the report the teacher opened');
   assert.equal(await page.locator('#battle-host-video-question-modal').count(),0,'new cue cannot cover an open answer review');
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});await trigger.click();await modal.waitFor({state:'visible'});
   assert.match(await modal.innerText(),/Câu 2/,'reopening the report uses the latest completed cue');
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
   const generic=structuredClone(advanced);generic.videoReview=null;
   await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),generic);
   await trigger.click();await modal.waitFor({state:'visible'});
   assert.match(await modal.innerText(),/Câu 2/,'generic broadcasts keep the host-private report for the same match');
   assert.deepEqual(errors,[]);await page.close();
  }
 } finally {await browser.close();}
});

test('review stays private, resets when a cue is reopened, and remains available after the final video question',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const host=await open(browser,'host',390),student=await open(browser,'alice',390);
  const watching=videoRoom('MONEY_BEG');await apply(host,watching);
  assert.equal(await host.locator('#battle-host-video-answers-open').isEnabled(),true);
  await host.locator('#battle-host-video-answers-open').click();
  const pending=host.locator('#battle-host-video-answers-modal');await pending.waitFor({state:'visible'});
  assert.match(await pending.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);
  assert.doesNotMatch(await pending.innerText(),/Nguyễn Minh Anh|B\. A dog/,'the pending report contains no answers');
  watching.videoReview=review();await apply(host,watching);await apply(student,watching);
  assert.match(await pending.innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng/,'first completed review fills the waiting modal');
  await student.evaluate(()=>window.qaScope.$apply(()=>window.qaScope.vm.openHostVideoAnswers()));
  assert.equal(await student.locator('#battle-host-video-answers-modal').count(),0,'students cannot invoke the host modal even with a hostile snapshot');
  const reopened=videoRoom('MONEY_BEG','ANSWERING',2);reopened.videoQuestionRound=1;reopened.videoReview=null;await apply(host,reopened);
  assert.equal(await host.locator('#battle-host-video-answers-modal').count(),0,'reopening clears the previous report');
  await closeQuestion(host);await host.locator('#battle-host-video-answers-open').click();await pending.waitFor({state:'visible'});
  assert.match(await pending.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);assert.doesNotMatch(await pending.innerText(),/B\. A dog/);
  await host.keyboard.press('Escape');await pending.waitFor({state:'hidden'});
  const legacy=videoRoom('CLASSIC','ANSWERING',3);legacy.videoQuestionRound=1;legacy.classicAutoAdvance=false;
  legacy.classicAnswerRevealed=true;legacy.classicCorrectAnswer='B. A dog';legacy.classicStudentAnswers=review().studentAnswers;await apply(host,legacy);await closeQuestion(host);
  await host.locator('#battle-host-video-answers-open').click();await pending.waitFor({state:'visible'});
  assert.match(await pending.innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng/,'current manual Classic review works before the new backend is deployed');
  await host.keyboard.press('Escape');await pending.waitFor({state:'hidden'});
  const finished=videoRoom('MONEY_BEG','ANSWERING',4,2);finished.status='FINISHED';finished.videoReview=review(2,0);await apply(host,finished);
  const finalTrigger=host.locator('#battle-host-video-answers-finished-open');await finalTrigger.waitFor({state:'visible'});await finalTrigger.click();
  const finalModal=host.locator('#battle-host-video-answers-modal');await finalModal.waitFor({state:'visible'});assert.match(await finalModal.innerText(),/Câu 2/);
  assert.equal(await host.evaluate(()=>document.body.classList.contains('battle-host-video-answers-open')),true);
  const restarted=videoRoom('MONEY_BEG','WATCHING',5,1);restarted.videoReview=null;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),restarted);
  assert.equal(await finalModal.count(),0,'starting another match closes the completed-match review');
  assert.equal(await host.evaluate(()=>window.qaScope.vm.room.videoReview),null,'same room and round cannot carry the old private report into a new match');
  await host.locator('#battle-host-video-answers-open').click();await finalModal.waitFor({state:'visible'});
  assert.match(await finalModal.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);assert.doesNotMatch(await finalModal.innerText(),/B\. A dog|Nguyễn Minh Anh/);
  await host.evaluate(()=>window.qaScope.$destroy());assert.equal(await host.evaluate(()=>document.body.classList.contains('battle-host-video-answers-open')),false,'destroy cleans modal page locks');
  await host.close();await student.close();
 } finally {await browser.close();}
});

test('landscape video toolbar fits beside the player with manual controls visible',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const page=await open(browser,'host',844);await page.setViewportSize({width:844,height:390});
  const snapshot=videoRoom('CLASSIC','ANSWERING');snapshot.classicAutoAdvance=false;await apply(page,snapshot);await closeQuestion(page);
  const card=page.locator('.battle-online-host-video'),box=await card.boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=844&&box.y>=0&&box.y+box.height<=390,'player and controls stay inside the short viewport');
  assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await page.locator('#battle-host-video-next').isVisible(),true);
  const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
  await page.screenshot({path:path.join(captures,'battle-video-host-toolbar-844x390.png'),fullPage:true});await page.close();
 } finally {await browser.close();}
});

test('generic video broadcasts fetch host-private review in every mode, coalesce transitions, and ignore an old room response',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const page=await open(browser,'host',390,null,{privateSync:true}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  let latest;
  for(let index=0;index<modes.length;index++) {
   const code='VIDEO'+(index+1),initial=videoRoom(modes[index],'ANSWERING',1,1);initial.code=code;
   await apply(page,initial);await closeQuestion(page);
   const before=await page.evaluate(()=>window.privateRoomRequests.length);
   const completed=videoRoom(modes[index],'WATCHING',2,2);completed.code=code;completed.videoReview=null;
   await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),completed);
   assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),before+1,'completed cue requests private room for '+modes[index]);
   assert.deepEqual(await page.evaluate(i=>window.privateRoomRequests[i].args,before),[code]);
   await page.locator('#battle-host-video-answers-open').click();
   const modal=page.locator('#battle-host-video-answers-modal');await modal.waitFor({state:'visible'});
   assert.match(await modal.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);
   assert.doesNotMatch(await modal.innerText(),/B\. A dog|Nguyễn Minh Anh/,'generic metadata exposes no student responses');
   for(let poll=0;poll<4;poll++) {await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),completed);}
   assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),before+1,'pending requests coalesce repeated generic updates');
   const nextPhase=videoRoom(modes[index],'ANSWERING',3,2);nextPhase.code=code;nextPhase.videoReview=null;
   await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),nextPhase);
   assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),before+1,'new transition queues behind the in-flight request');
   latest=structuredClone(nextPhase);latest.videoReview=review();
   await page.evaluate(({index,snapshot})=>window.qaScope.$apply(()=>window.privateRoomRequests[index].request.resolve(snapshot)),{index:before,snapshot:latest});
   await page.waitForFunction(n=>window.privateRoomRequests.length===n,before+2);
   assert.match(await modal.innerText(),/Câu 1[\s\S]*Nguyễn Minh Anh[\s\S]*✓ Đúng/,'private response fills the waiting modal');
   assert.deepEqual(await page.evaluate(i=>window.privateRoomRequests[i].args,before+1),[code]);
   await page.evaluate(({index,snapshot})=>window.qaScope.$apply(()=>window.privateRoomRequests[index].request.resolve(snapshot)),{index:before+1,snapshot:latest});
   assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),before+2,'one queued refresh is enough for the latest transition');
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  }
  const pendingIndex=await page.evaluate(()=>window.privateRoomRequests.length);
  const completedAgain=videoRoom('LUM_NGAY','WATCHING',4,3);completedAgain.code=latest.code;completedAgain.totalQuestions=3;completedAgain.videoReview=null;
  await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),completedAgain);
  assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),pendingIndex+1);
  const otherRoom=videoRoom('CLASSIC','WATCHING',1,1);otherRoom.code='VIDEO8';otherRoom.videoReview=null;await apply(page,otherRoom);
  const oldPrivate=structuredClone(completedAgain);oldPrivate.videoReview=review(2);
  await page.evaluate(({index,snapshot})=>window.qaScope.$apply(()=>window.privateRoomRequests[index].request.resolve(snapshot)),{index:pendingIndex,snapshot:oldPrivate});
  assert.equal(await page.evaluate(()=>window.qaScope.vm.room.code),'VIDEO8','late old-room response cannot replace the current room');
  assert.equal(await page.locator('#battle-host-video-answers-modal').count(),0,'old response cannot reopen the old report');
  await page.locator('#battle-host-video-answers-open').click();
  const pending=page.locator('#battle-host-video-answers-modal');await pending.waitFor({state:'visible'});
  assert.match(await pending.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);assert.doesNotMatch(await pending.innerText(),/B\. A dog|Nguyễn Minh Anh/);
  assert.deepEqual(await page.evaluate(()=>window.privateRoomRequests.at(-1).args),['VIDEO8']);
  await page.evaluate(snapshot=>window.qaScope.$apply(()=>window.privateRoomRequests.at(-1).request.resolve(snapshot)),otherRoom);
  assert.deepEqual(errors,[]);await page.close();
 } finally {await browser.close();}
});

test('manual reveal waits for private student rows and a denied old-room request cannot remove the new room',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const page=await open(browser,'host',390,null,{privateSync:true});
  const initial=videoRoom('CLASSIC','ANSWERING');initial.classicAutoAdvance=false;await apply(page,initial);await closeQuestion(page);
  await page.locator('#battle-host-video-answers-open').click();const modal=page.locator('#battle-host-video-answers-modal');await modal.waitFor({state:'visible'});
  await page.evaluate(snapshot=>window.qaScope.$apply(()=>window.privateRoomRequests[0].request.resolve(snapshot)),initial);
  const revealed=structuredClone(initial);revealed.videoRevision=2;revealed.serverTime=Date.now();revealed.questionEndsAt=Date.now()-1;
  revealed.classicAnswerRevealed=true;revealed.classicCorrectAnswer='B. A dog';revealed.classicStudentAnswers=[];revealed.videoReview=null;
  await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),revealed);
  assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),2,'manual reveal with an unchanged cue requests private rows');
  assert.match(await modal.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);
  assert.doesNotMatch(await modal.innerText(),/B\. A dog|Nguyễn Minh Anh/,'generic reveal flags do not freeze an empty answer report');
  const privateReview=structuredClone(revealed);privateReview.videoReview=review();privateReview.classicStudentAnswers=review().studentAnswers;
  await page.evaluate(snapshot=>window.qaScope.$apply(()=>window.privateRoomRequests[1].request.resolve(snapshot)),privateReview);
  assert.match(await modal.innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng/);assert.equal(await modal.locator('li').count(),3);
  await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  const next=videoRoom('CLASSIC','WATCHING',3,2);next.classicAutoAdvance=false;next.videoReview=null;
  await page.evaluate(r=>window.qaScope.$apply(()=>window.battleHooks.applyRoom(r,true)),next);
  assert.equal(await page.evaluate(()=>window.privateRoomRequests.length),3);
  const other=videoRoom('CLASSIC','WATCHING');other.code='VIDEO_NEW';other.videoReview=null;await apply(page,other);
  await page.evaluate(()=>window.qaScope.$apply(()=>window.privateRoomRequests[2].request.reject({status:403,data:{message:'Bạn không còn trong phòng cũ.'}})));
  assert.equal(await page.evaluate(()=>window.qaScope.vm.room.code),'VIDEO_NEW','old-room 403 does not kick the host from the new room');
  await page.locator('#battle-host-video-answers-open').click();await modal.waitFor({state:'visible'});
  assert.match(await modal.innerText(),/Kết quả sẽ hiện khi câu hỏi kết thúc/);assert.doesNotMatch(await modal.innerText(),/B\. A dog|Nguyễn Minh Anh/);
  await page.evaluate(snapshot=>window.qaScope.$apply(()=>window.privateRoomRequests.at(-1).request.resolve(snapshot)),other);
  await page.close();
 } finally {await browser.close();}
});
