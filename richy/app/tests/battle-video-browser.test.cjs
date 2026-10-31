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
async function open(browser,username,width,extra=null){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.setContent('<html><head><meta charset="UTF-8"><style>'+css+'</style></head><body><div id="qa" class="battle-online-page" ng-controller="BattleQuizOnlineController as vm">'+(extra===null?hostPane+waiting+exercise+feedback:extra)+'</div></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular-sanitize.min.js')});
 await page.evaluate(({username,template,controlsTemplate,answersTemplate})=>{
  window.APP_VERSION='qa';window.videoCalls=[];window.timerRequests=[];window.answerCalls=[];window.answerRequests=[];window.videoActions=[];window.listCalls=[];window.reopenRequests=[];window.matchControlRequests=[];window.toastErrors=[];
  angular.module('Hrm.Question',['ngSanitize']).value('BattleSessionLogin',{bind(){}}).value('$state',{go(){}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(...args){window.toastErrors.push(args);},success(){}}).value('blockUI',{}).value('QuestionService',{})
   .factory('BattleQuizOnlineService',function($q){return {answer(...args){window.answerCalls.push(args);const request=$q.defer();window.answerRequests.push(request);return request.promise;},
    setClassicAutoAdvance(...args){const request=$q.defer();window.matchControlRequests.push({action:'auto',args,request});return request.promise;},
    nextClassicQuestion(...args){const request=$q.defer();window.matchControlRequests.push({action:'next',args,request});return request.promise;},
    getVideoQuestions(...args){window.listCalls.push(args);return $q.when(window.videoQuestionPreviews||[{sequence:1,seconds:5,preview:'What is the name…'},{sequence:2,seconds:10,preview:'Who is…'}]);},
    reopenVideoQuestion(...args){const request=$q.defer();window.reopenRequests.push({args,request});return request.promise;},
    setQuestionTimerPaused(...args){const request=$q.defer();window.timerRequests.push({args,request});return request.promise;},
    extendMatchTime(...args){const request=$q.defer();window.matchControlRequests.push({action:'extend',args,request});return request.promise;},
    finishMatch(...args){const request=$q.defer();window.matchControlRequests.push({action:'finish',args,request});return request.promise;},
    videoEvent(...args){const request=$q.defer();window.videoCalls.push({args,request});return request.promise;}};})
   .directive('comprehensiveVideoPlayer',function(){return {scope:{onVideoReady:'&',onVideoProgress:'&',onVideoState:'&',onVideoEnded:'&'},
    template:'<div class="comprehensive-video-player"><div class="comprehensive-video-mount"><video></video></div></div>',link(scope){
     const api={ready:true,play(){window.videoActions.push('play');},pause(){window.videoActions.push('pause');},seek(t){window.videoActions.push(['seek',t]);}};
     window.videoAdapter=scope;scope.onVideoReady({api});}};})
   .run(function($templateCache){$templateCache.put('question/views/battle_online_exercise_form.html?v=qa&individualQuestions=20261007_1',template);
    $templateCache.put('question/views/battle_online_match_controls.html?matchControls=20261017_2',controlsTemplate);
    $templateCache.put('question/views/battle_online_classic_answers.html?classicAnswers=20261017_1',answersTemplate);});
 },{username,template:fs.readFileSync(path.join(app,'question/views/battle_online_exercise_form.html'),'utf8'),
  controlsTemplate:fs.readFileSync(path.join(app,'question/views/battle_online_match_controls.html'),'utf8'),
  answersTemplate:fs.readFileSync(path.join(app,'question/views/battle_online_classic_answers.html'),'utf8')});
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

test('egg video fullscreen keeps the question list, replay confirmation and reopened question above the video and clickable',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [1280,390]) {
   const host=await open(browser,'host',width),errors=[];host.on('pageerror',e=>errors.push(String(e)));
   await apply(host,room('LUM_NGAY','WATCHING',1,2));
   await host.getByRole('button',{name:'⛶ Toàn màn hình',exact:true}).click();
   await host.waitForFunction(()=>document.fullscreenElement?.id==='battle-host-video-stage');
   await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();
   const list=host.locator('#battle-host-video-question-list');await list.waitFor({state:'visible'});
   async function aboveVideo(modal) {
    assert.equal(await modal.evaluate(el=>document.fullscreenElement.contains(el)),true,'dialog belongs to the fullscreen stage');
    const bounds=await modal.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=900);
    assert.equal(await modal.evaluate(el=>{
     const box=el.getBoundingClientRect(),top=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
     return el.contains(top);
    }),true,'dialog is painted above the video');
   }
   await aboveVideo(list);
   await host.screenshot({path:path.join(captures,'battle-video-fullscreen-list-'+width+'.png'),animations:'disabled'});
   await list.getByRole('button',{name:/0:05 1\. What is/}).click();
   const confirm=host.locator('#battle-host-video-replay-confirm');await confirm.waitFor({state:'visible'});await aboveVideo(confirm);
   assert.deepEqual(await host.evaluate(()=>window.videoActions.at(-1)),['seek',5]);
   await confirm.getByRole('button',{name:'Chỉ xem lại',exact:true}).click();await confirm.waitFor({state:'hidden'});
   assert.equal(await host.evaluate(()=>document.fullscreenElement.id),'battle-host-video-stage','review keeps fullscreen active');
   await host.getByRole('button',{name:'Về câu hiện tại',exact:true}).click();
   await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();await list.waitFor({state:'visible'});
   await list.getByRole('button',{name:/0:05 1\. What is/}).click();await confirm.waitFor({state:'visible'});
   await confirm.getByRole('button',{name:'Cho lớp trả lời lại',exact:true}).click();
   assert.deepEqual(await host.evaluate(()=>window.reopenRequests[0].args),['VIDEO1',2,1,'100:101']);
   const reopened=room('LUM_NGAY','ANSWERING',2,1);reopened.videoQuestionRound=1;
   await host.evaluate(snapshot=>window.qaScope.$apply(()=>window.reopenRequests[0].request.resolve(snapshot)),reopened);
   const question=host.locator('#battle-host-video-question-modal');await question.waitFor({state:'visible'});await aboveVideo(question);
   await question.getByRole('button',{name:'Đóng câu hỏi',exact:true}).click();
   await host.getByRole('button',{name:'⛶ Thu nhỏ',exact:true}).click();await host.waitForFunction(()=>!document.fullscreenElement);
   await host.getByRole('button',{name:'List câu hỏi',exact:true}).click();await list.waitFor({state:'visible'});
   await list.getByRole('button',{name:'Đóng danh sách câu hỏi',exact:true}).click();await list.waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);await host.close();
  }
 } finally {await browser.close();}
});

const gameLayout=fragment('    <div class="battle-online-game-layout"','    <ng-include ng-if="vm.isHost() && vm.isDemonDefenseMode()');
function classicRoom(sequence=1) {
 const snapshot=room('CLASSIC','ANSWERING',1,sequence);snapshot.videoSynchronized=false;snapshot.classicAutoAdvance=false;
 Object.assign(snapshot.currentQuestion.exercise,{title:'Questions 1–50',instructionsHtml:'<p>Choose the correct answer (A, B, C or D) for each question.</p>',
  items:[{id:'201',number:37,promptHtml:'The road is going to _____ repaired.',options:[{key:'37: A',text:'being'},{key:'37: B',text:'be'},{key:'37: C',text:'been'},{key:'37: D',text:'was'}]}]});
 return snapshot;
}

test('Classic hosts see equal desktop columns and can illustrate all choices without entering the player score',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [1280,390]) {
   const page=await open(browser,'host',width,gameLayout),errors=[];page.on('pageerror',error=>errors.push(String(error)));
   const snapshot=classicRoom();await apply(page,snapshot);
   const question=page.locator('.battle-online-question-card'),ranking=page.locator('#battle-online-ranking-card');
   await question.waitFor({state:'visible'});await ranking.waitFor({state:'visible'});
   assert.equal(await page.locator('.battle-online-spectator-panel').count(),0);
   const left=await question.boundingBox(),right=await ranking.boundingBox();
   if(width>820) {assert.ok(Math.abs(left.width-right.width)<1,'desktop divides question and ranking equally');assert.ok(right.x>left.x);}
   else {assert.ok(right.y>=left.y+left.height,'mobile stacks the columns');}
   assert.equal(await page.locator('#qa').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'page fits its viewport');
   const choices=question.locator('.battle-online-answer-btn');assert.equal(await choices.count(),4);
   await choices.nth(1).click();assert.equal(await question.locator('.battle-online-answer-btn.is-selected').count(),1);
   assert.equal(await page.evaluate(()=>window.answerCalls.length),0);
   await apply(page,snapshot);assert.match(await question.locator('.battle-online-answer-btn.is-selected').innerText(),/be/,'poll keeps host selection');
   snapshot.classicAnswerRevealed=true;snapshot.classicCorrectAnswer='37: be';snapshot.questionEndsAt=Date.now()-5000;snapshot.serverTime=Date.now();
   snapshot.classicStudentAnswers=[{username:'alice',displayName:'Nguyễn Minh Anh',answered:true,correct:true,answer:'37: be'}];await apply(page,snapshot);
   await question.locator('.battle-online-classic-review').waitFor({state:'visible'});
   await choices.nth(0).click();assert.match(await question.locator('.battle-online-answer-btn.is-selected').innerText(),/being/);
   assert.equal(await page.evaluate(()=>window.answerCalls.length),0,'host can illustrate while reviewing with no scored request');
   await ranking.locator('.battle-online-classic-answers').waitFor({state:'visible'});
   await page.screenshot({path:path.join(captures,'battle-classic-host-half-'+width+'.png'),fullPage:true});
   await apply(page,classicRoom(2));assert.equal(await question.locator('.battle-online-answer-btn.is-selected').count(),0,'new question clears illustration');
   const vocab=classicRoom(3);delete vocab.currentQuestion.exercise;vocab.settings.questionSource='VOCABULARY';
   vocab.currentQuestion.question='A friendly animal';vocab.currentQuestion.answers=[{key:'A',text:'Cat'},{key:'B',text:'Dog'},{key:'C',text:'Bird'},{key:'D',text:'Fish'}];
   await apply(page,vocab);await choices.nth(2).click();assert.equal(await choices.nth(2).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>window.answerCalls.length),0);
   await apply(page,classicRoom(4));assert.equal(await question.locator('.battle-online-answer-btn.is-selected').count(),0);
   const text=classicRoom(5);Object.assign(text.currentQuestion.exercise,{type:2,answerMode:'TEXT'});await apply(page,text);
   await question.locator('input[type=text]').fill('be');assert.equal(await question.getByRole('button',{name:'NỘP ĐÁP ÁN',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>window.answerCalls.length),0);
   const player=classicRoom(6);player.players[0].spectator=false;await apply(page,player);
   await choices.nth(1).click();assert.equal(await page.evaluate(()=>window.answerCalls.length),1,'participating host still submits a scored answer');
   assert.deepEqual(errors,[]);await page.close();
  }
 } finally {await browser.close();}
});

test('reloading an expired manual Classic question waits for host Next without repeated requests or timeout errors',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  for(const revealed of [false,true]) {
   const page=await open(browser,'alice',390,gameLayout),snapshot=classicRoom();
   snapshot.questionEndsAt=Date.now()-10000;snapshot.classicAnswerRevealed=revealed;snapshot.classicCorrectAnswer=revealed?'37: be':'';
   await apply(page,snapshot);
   for(let poll=0;poll<12;poll++) {
    snapshot.serverTime=Date.now();await apply(page,snapshot);
    await page.evaluate(()=>window.qaScope.$apply(()=>{window.qaScope.vm.submitExercise(true);window.battleHooks.updateCountdown();}));
   }
   assert.equal(await page.evaluate(()=>window.answerCalls.length),0,'expired/review questions never auto submit');
   assert.deepEqual(await page.evaluate(()=>window.toastErrors),[]);
   const choices=page.locator('.battle-online-question-card .battle-online-answer-btn');assert.equal(await choices.nth(0).isDisabled(),true);
   assert.equal(await page.locator('.battle-online-classic-review').count(),revealed?1:0);
   const next=classicRoom(2);next.players[1].answeredCurrentQuestion=true;await apply(page,next);
   assert.equal(await choices.nth(0).isDisabled(),true,'reload preserves an already submitted answer');
   const fresh=classicRoom(3);await apply(page,fresh);assert.equal(await choices.nth(0).isEnabled(),true,'host Next opens the new question');
   await choices.nth(1).click();assert.equal(await page.evaluate(()=>window.answerCalls.length),1);
   fresh.questionEndsAt=Date.now()-1;
   await page.evaluate(()=>window.qaScope.$apply(()=>window.answerRequests[0].reject({status:409,data:{message:'Câu hỏi đã hết giờ.'}})));
   for(let poll=0;poll<12;poll++) {fresh.serverTime=Date.now();await apply(page,fresh);}
   assert.equal(await page.evaluate(()=>window.answerCalls.length),1,'a request rejected at the deadline never starts an automatic retry loop');
   assert.equal(await page.evaluate(()=>window.toastErrors.length),1);
   await page.close();
  }
  const guess=await open(browser,'alice',390,gameLayout),snapshot=room('GUESS_WORD','ANSWERING');snapshot.videoSynchronized=false;
  Object.assign(snapshot.currentQuestion.exercise,{type:2,answerMode:'TEXT'});await apply(guess,snapshot);
  await guess.locator('.battle-online-question-card input[type=text]').fill('a cat');
  snapshot.questionEndsAt=Date.now()-1;snapshot.serverTime=Date.now();await apply(guess,snapshot);
  assert.equal(await guess.evaluate(()=>window.answerCalls.length),1,'Guess still submits typed answers at its deadline');
  assert.equal(await guess.evaluate(()=>window.answerCalls[0][5]),true);
  await guess.evaluate(()=>window.qaScope.$apply(()=>window.answerRequests[0].reject({status:409,data:{message:'Câu hỏi đã hết giờ.'}})));
  for(let poll=0;poll<12;poll++) {snapshot.serverTime=Date.now();await apply(guess,snapshot);}
  assert.equal(await guess.evaluate(()=>window.answerCalls.length),1,'Guess auto submission remains limited to one attempt');
  await guess.close();
 } finally {await browser.close();}
});

test('manual Classic shows submitted choices and correctness below ranking only after reveal on desktop and mobile BXH',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const rankStart=view.indexOf('        <aside id="battle-online-ranking-card"'),rank=view.slice(rankStart,view.indexOf('</aside>',rankStart)+8);
 const modalStart=view.lastIndexOf('    <div class="battle-online-ranking-modal-backdrop"',view.indexOf('ng-if="vm.rankingModalOpen'));
 const rankingModal=view.slice(modalStart,view.indexOf('    <div class="battle-online-ranking-modal-backdrop battle-online-kick-backdrop"',modalStart));
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [1280,390]) {
   const page=await open(browser,'host',width,'<div class="battle-online-game-layout"><main class="battle-online-card">Câu hỏi hiện tại</main>'+rank+'</div>'+rankingModal);
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const snapshot=room('CLASSIC','ANSWERING');snapshot.videoSynchronized=false;
   snapshot.players=[{username:'host',spectator:true},{username:'alice',displayName:'Nguyễn Minh Anh',spectator:false,connected:true,teamNumber:1,rank:1,score:30},
    {username:'bob',displayName:'Trần Học Sinh với tên hiển thị dài',spectator:false,connected:true,teamNumber:2,rank:2,score:10},
    {username:'carol',displayName:'Lê Thanh',spectator:false,connected:true,teamNumber:1,rank:3,score:0}];
   snapshot.classicAutoAdvance=true;snapshot.classicAnswerRevealed=true;
   snapshot.classicStudentAnswers=[{username:'alice',displayName:'Nguyễn Minh Anh',answered:true,correct:true,answer:'D. goes'},
    {username:'bob',displayName:'Trần Học Sinh với tên hiển thị dài',answered:true,correct:false,answer:'B. is going — câu trả lời được giữ nguyên để giáo viên xem lại'},
    {username:'carol',displayName:'Lê Thanh',answered:false,correct:false,answer:''}];
   await apply(page,snapshot);assert.equal(await page.locator('.battle-online-classic-answers').count(),0,'Auto never shows this table');
   snapshot.classicAutoAdvance=false;snapshot.classicAnswerRevealed=false;snapshot.serverTime=Date.now();await apply(page,snapshot);
   assert.equal(await page.locator('.battle-online-classic-answers').count(),0,'answers stay hidden during the question');
   snapshot.classicAnswerRevealed=true;snapshot.classicCorrectAnswer='goes';snapshot.questionEndsAt=Date.now()-100;snapshot.serverTime=Date.now();await apply(page,snapshot);
   let container=page.locator('#battle-online-ranking-card');
   if(width<768) { await page.evaluate(()=>window.qaScope.$apply(()=>window.qaScope.vm.openRankingModal()));container=page.getByRole('dialog',{name:'Bảng xếp hạng',exact:true}); }
   const report=container.locator('.battle-online-classic-answers');await report.waitFor({state:'visible'});await report.scrollIntoViewIfNeeded();
   assert.equal(await report.locator('li').count(),3);assert.equal(await report.locator('li.is-correct').count(),1);assert.equal(await report.locator('li.is-wrong').count(),1);assert.equal(await report.locator('li.is-unanswered').count(),1);
   assert.match(await report.locator('li.is-correct').innerText(),/Nguyễn Minh Anh[\s\S]*✓ Đúng[\s\S]*D\. goes/);
   assert.match(await report.locator('li.is-wrong').innerText(),/✕ Sai[\s\S]*B\. is going/);
   assert.match(await report.locator('li.is-unanswered').innerText(),/Chưa trả lời/);
   const endOfRank=await container.locator('.battle-online-ranking-row').last().boundingBox(),reportBox=await report.boundingBox();
   assert.ok(reportBox.y>=endOfRank.y+endOfRank.height,'the answer table follows the ranking rows');
   assert.equal(await report.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'long answers fit the ranking column');
   await report.screenshot({path:path.join(captures,'battle-classic-student-answers-'+width+'.png')});
   snapshot.currentQuestion.sequence=2;snapshot.currentQuestionIndex=2;snapshot.classicAnswerRevealed=false;snapshot.classicStudentAnswers=[];snapshot.serverTime=Date.now();await apply(page,snapshot);
   assert.equal(await report.count(),0,'Next clears the previous question report');
   snapshot.classicAnswerRevealed=true;snapshot.classicStudentAnswers=[{username:'alice',displayName:'Nguyễn Minh Anh',answered:true,correct:false,answer:'Câu trả lời ở câu 2'}];snapshot.serverTime=Date.now();await apply(page,snapshot);
   await report.waitFor({state:'visible'});assert.equal(await report.locator('li').count(),1);assert.match(await report.innerText(),/Câu 2 \/ 2[\s\S]*Câu trả lời ở câu 2/);assert.doesNotMatch(await report.innerText(),/D\. goes/);
   snapshot.settings.mode='COUNTDOWN';snapshot.serverTime=Date.now();await apply(page,snapshot);assert.equal(await page.locator('.battle-online-classic-answers').count(),0);
   assert.deepEqual(errors,[]);await page.close();
  }
 } finally {await browser.close();}
});

test('host match buttons use ten seconds for questions, one minute for match and egg clocks, and finish during video playback',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try {
  const host=await open(browser,'host',390),student=await open(browser,'alice',390);
  for(const page of [host,student]) {
   await page.evaluate(()=>{
    const el=document.createElement('div');el.id='match-controls-qa';el.setAttribute('ng-include',"'question/views/battle_online_match_controls.html?matchControls=20261017_2'");
    document.getElementById('qa').appendChild(el);
    angular.element(document.getElementById('qa')).injector().get('$compile')(el)(window.qaScope);
    window.qaScope.$digest();
   });
  }
  let revision=1;
  for(const mode of ['CLASSIC','GUESS_WORD','COUNTDOWN','MONEY_BEG','ESCAPE_DUMB_DEMON','DEMON_DEFENSE','LUM_NGAY']) {
   const snapshot=room(mode,'ANSWERING',revision++);await apply(host,snapshot);await apply(student,snapshot);
   assert.equal(await student.locator('#match-controls-qa button').count(),0,'students cannot control '+mode);
   const controls=host.locator('.battle-online-host-question-controls');await controls.getByRole('button',{name:'+10 giây',exact:true}).click();
   const reading=controls.getByRole('switch',{name:'Tự đọc',exact:true});
   if(mode==='CLASSIC') { assert.equal(await reading.getAttribute('aria-checked'),'true');await reading.click(); }
   assert.equal(await reading.getAttribute('aria-checked'),'false','auto reading remains off across live mode changes');
   const box=await controls.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'timer buttons fit the mobile modal');
   const count=await host.evaluate(()=>window.matchControlRequests.length);
   assert.deepEqual(await host.evaluate(()=>window.matchControlRequests.at(-1).args),['VIDEO1']);
   assert.equal(await controls.getByRole('button',{name:'Kết thúc',exact:true}).isEnabled(),false,'requests serialize');
   snapshot.videoRevision=revision++;snapshot.questionEndsAt+=10000;
   await host.evaluate(r=>window.qaScope.$apply(()=>window.matchControlRequests.at(-1).request.resolve(r)),snapshot);
   assert.equal(await host.evaluate(()=>window.matchControlRequests.length),count);
   assert.ok(await host.evaluate(()=>window.qaScope.vm.countdown)>=29);
   const regular=room(mode,'ANSWERING',revision++);regular.videoSynchronized=false;regular.currentQuestion=null;regular.matchEndsAt=Date.now()+120000;
   await apply(host,regular);
   const label=['CLASSIC','GUESS_WORD'].includes(mode)?'+10 giây':'+1 phút';
   assert.equal(await host.locator('#match-controls-qa').getByRole('button',{name:label,exact:true}).isEnabled(),true,mode+' regular clock');
  }
  const egg=room('LUM_NGAY','ANSWERING',revision++);egg.giftOpening=true;egg.currentQuestion=null;egg.giftOpeningEndsAt=Date.now()+180000;
  await apply(host,egg);
  const controls=host.locator('#match-controls-qa');assert.equal(await controls.getByRole('button',{name:'+1 phút',exact:true}).isEnabled(),true);
  assert.equal(await controls.getByRole('button',{name:'Kết thúc bóc trứng',exact:true}).isEnabled(),true);
  const watching=room('CLASSIC','WATCHING',revision++);await apply(host,watching);
  assert.equal(await controls.getByRole('button',{name:'+10 giây',exact:true}).isEnabled(),false);
  await controls.getByRole('button',{name:'Kết thúc',exact:true}).click();
  assert.equal(await host.evaluate(()=>window.matchControlRequests.at(-1).action),'finish');
  watching.status='FINISHED';watching.currentQuestion=null;watching.videoRevision=revision++;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.matchControlRequests.at(-1).request.resolve(r)),watching);
  assert.equal(await controls.getByRole('button').count(),0);
 } finally { await browser.close(); }
});

test('mobile places a compact two-row match bar below answers while desktop keeps its existing header',async()=>{
 const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 const main=fragment('        <main class="battle-online-card battle-online-question-card"','        <main class="battle-online-card battle-online-spectator-panel"');
 const captures=path.join(app,'../target');fs.mkdirSync(captures,{recursive:true});
 try {
  for(const width of [320,390,1280]) {
   const page=await open(browser,'host',width);
   await page.evaluate(html=>{
    const mount=document.createElement('div');mount.id='mobile-question-qa';mount.innerHTML=html;document.getElementById('qa').appendChild(mount);
    angular.element(document.getElementById('qa')).injector().get('$compile')(mount)(window.qaScope);window.qaScope.$digest();
   },main);
   for(const mode of ['LUM_NGAY','CLASSIC','COUNTDOWN']) {
    const snapshot=room(mode,'ANSWERING',1,1);snapshot.videoSynchronized=false;snapshot.settings.questionSource='VOCABULARY';
    snapshot.currentQuestion={id:1,sequence:1,question:'A friendly animal',pronounce:'',answers:[{key:'A',text:'A cat'},{key:'B',text:'A dog'},{key:'C',text:'A bird'},{key:'D',text:'A fish'}]};
    snapshot.players[0].spectator=false;snapshot.matchEndsAt=Date.now()+266000;snapshot.questionEndsAt=Date.now()+30000;snapshot.totalLessonWords=50;
    await apply(page,snapshot);
    const card=page.locator('#mobile-question-qa .battle-online-question-card'),bar=card.locator(':scope > .battle-online-game-topline');
    const answers=await card.locator('.battle-online-answer-grid').boundingBox(),barBox=await bar.boundingBox();
    if(width<768) {
     assert.ok(barBox.y>=answers.y+answers.height,'controls follow the answers on mobile');
     assert.equal(await bar.evaluate(el=>getComputedStyle(el).display),'grid');
     assert.equal(await bar.locator('.battle-online-match-time-actions').evaluate(el=>getComputedStyle(el).gridRowStart),'2');
     assert.equal(await bar.locator('.battle-online-match-time-actions').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'all three controls fit');
     assert.ok(barBox.height<=96,'two compact rows');
     const buttons=await bar.locator('.battle-online-match-time-actions > button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
     assert.ok(buttons.every(y=>Math.abs(y-buttons[0])<1),'controls stay on the same second row');
    } else {
     assert.ok(barBox.y<answers.y,'desktop header stays above questions');assert.equal(await bar.evaluate(el=>getComputedStyle(el).display),'flex');
    }
    const reading=bar.getByRole('switch',{name:'Tự đọc',exact:true});assert.equal(await reading.getAttribute('aria-checked'),'true');
    if(mode==='CLASSIC') {
     const auto=bar.getByRole('switch',{name:'Auto chuyển câu',exact:true});assert.equal(await auto.getAttribute('aria-checked'),'true');
     await auto.click();assert.deepEqual(await page.evaluate(()=>window.matchControlRequests.at(-1).args),['VIDEO1',false]);
     snapshot.classicAutoAdvance=false;
     await page.evaluate(r=>window.qaScope.$apply(()=>window.matchControlRequests.at(-1).request.resolve(r)),snapshot);
     const next=bar.getByRole('button',{name:'Next câu',exact:true});assert.equal(await next.isEnabled(),false);
     snapshot.classicAnswerRevealed=true;snapshot.classicCorrectAnswer='A cat';snapshot.questionEndsAt=Date.now()-100;snapshot.serverTime=Date.now();
     await apply(page,snapshot);
     const review=card.locator('.battle-online-classic-review');assert.equal(await review.isVisible(),true);assert.match(await review.innerText(),/A cat/);
     const reviewBox=await review.boundingBox();assert.ok(reviewBox.y>=answers.y+answers.height,'correct answer is below the choices');
     if(width<768) { assert.ok((await bar.boundingBox()).height<=96,'manual Classic still uses two compact rows'); }
     await card.screenshot({path:path.join(captures,'battle-classic-manual-'+width+'.png')});
     await next.click();assert.deepEqual(await page.evaluate(()=>window.matchControlRequests.at(-1).args),['VIDEO1',1,snapshot.questionEndsAt]);
     snapshot.currentQuestion.sequence=2;snapshot.classicAnswerRevealed=false;snapshot.classicCorrectAnswer=null;snapshot.questionEndsAt=Date.now()+30000;
     await page.evaluate(r=>window.qaScope.$apply(()=>window.matchControlRequests.at(-1).request.resolve(r)),snapshot);
     assert.equal(await review.count(),0);
    }
    if(mode==='LUM_NGAY') { await reading.click();assert.equal(await reading.getAttribute('aria-checked'),'false');await reading.click();
     await card.screenshot({path:path.join(captures,'battle-mobile-footer-'+width+'.png')});
     snapshot.settings.questionSource='COMPREHENSIVE';snapshot.currentQuestion.sequence=2;
     snapshot.currentQuestion.exercise={type:1,answerMode:'SINGLE',title:'Questions 1–50',instructionsHtml:'<p>Choose the correct answer (A, B, C or D) for each question.</p>',items:[{id:'10',number:1,promptHtml:'A friendly animal',options:[{key:'A',text:'A cat'},{key:'B',text:'A dog'}]}]};
     await apply(page,snapshot);
     const exercise=await card.locator('.battle-online-exercise').boundingBox(),comprehensiveBar=await bar.boundingBox();
     assert.ok(width<768?comprehensiveBar.y>=exercise.y+exercise.height:comprehensiveBar.y<exercise.y,'exercise packages follow the same responsive order');
     if(width<768) { assert.equal(await bar.locator('.battle-online-progress-caption').isVisible(),false);assert.ok(comprehensiveBar.height<=96); }
     await card.screenshot({path:path.join(captures,'battle-comprehensive-spacing-'+width+'.png')});
    }
   }
   await page.close();
  }
 } finally {await browser.close();}
});
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
  assert.ok((await list.boundingBox()).height<350,'short lists fit their content');
  assert.ok(await list.locator('li').first().evaluate(row=>row.getBoundingClientRect().top-row.closest('.battle-online-host-question-list-body').getBoundingClientRect().top<24),'no blank spacer before the first cue');
  assert.deepEqual(await host.evaluate(()=>window.listCalls[0]),['VIDEO1']);
  const captureDir=path.join(app,'../target');fs.mkdirSync(captureDir,{recursive:true});
  await host.screenshot({path:path.join(captureDir,'battle-video-host-question-list.png'),fullPage:true});
  await host.setViewportSize({width:390,height:844});
  const listBox=await list.boundingBox();assert.ok(listBox.x>=0&&listBox.x+listBox.width<=390&&listBox.height<844);
  await host.setViewportSize({width:1280,height:900});
  await host.keyboard.press('Escape');await list.waitFor({state:'hidden'});
  await host.getByRole('button',{name:'⛶ Toàn màn hình'}).click();
  await host.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='battle-host-video-stage');
  await host.evaluate(()=>window.qaScope.$apply(()=>window.videoAdapter.onVideoProgress({seconds:10,duration:60})));
  assert.equal(await host.evaluate(()=>window.videoCalls[0].args[2]),'CUE');
  await host.evaluate(r=>window.qaScope.$apply(()=>window.videoCalls[0].request.resolve(r)),room('DEMON_DEFENSE','ANSWERING',2));
  assert.equal(await host.getByRole('button',{name:'Phát / tiếp tục video'}).isEnabled(),false);
  assert.ok(await host.evaluate(()=>window.videoActions.includes('pause')));
  const modal=host.locator('#battle-host-video-question-modal');
  await modal.waitFor({state:'visible'});
  assert.match(await modal.innerText(),/What did you see\?/);
  assert.match(await modal.locator('[role="timer"]').innerText(),/20/);
  assert.equal(await host.locator('#battle-host-video-stage #battle-host-video-question-modal').count(),1,'question modal belongs to the managed fullscreen stage');
  assert.equal(await host.locator('comprehensive-video-player').getAttribute('managed-fullscreen'),'true');
  assert.equal(await host.evaluate(()=>document.fullscreenElement&&document.fullscreenElement.id),'battle-host-video-stage');
  assert.equal(await modal.isVisible(),true,'question modal stays visible over the managed fullscreen video');
  await host.evaluate(()=>document.exitFullscreen());
  await host.waitForFunction(()=>!document.fullscreenElement);
  await modal.getByRole('button',{name:'⏸ Tạm dừng bấm giờ'}).click();
  assert.deepEqual(await host.evaluate(()=>window.timerRequests[0].args),['VIDEO1',true]);
  const paused=room('DEMON_DEFENSE','ANSWERING',3);paused.questionTimerPaused=true;paused.questionTimerRemainingMillis=17000;paused.questionEndsAt=0;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.timerRequests[0].request.resolve(r)),paused);
  assert.match(await modal.locator('[role="timer"]').innerText(),/ĐANG TẠM DỪNG/);
  await modal.getByRole('button',{name:'▶ Tiếp tục bấm giờ'}).click();
  assert.deepEqual(await host.evaluate(()=>window.timerRequests[1].args),['VIDEO1',false]);
  const resumedTimer=room('DEMON_DEFENSE','ANSWERING',4);resumedTimer.questionEndsAt=Date.now()+17000;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.timerRequests[1].request.resolve(r)),resumedTimer);
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
  await host.keyboard.press('Tab');assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true,'Tab focus stays inside the question modal');
  await host.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  await apply(host,room('DEMON_DEFENSE','ANSWERING',5));assert.equal(await modal.count(),0,'broadcast does not reopen a dismissed popup');
  await host.getByRole('button',{name:'Xem câu hỏi',exact:true}).click();await modal.waitFor({state:'visible'});
  const before=await host.evaluate(()=>window.videoActions.filter(a=>a==='play').length);
  await apply(host,room('DEMON_DEFENSE','WATCHING',6,2));
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
  const finished=room('DEMON_DEFENSE','ANSWERING',7,2);finished.status='FINISHED';finished.currentQuestion=null;
  await apply(host,finished);assert.equal(await host.locator('.battle-online-host-video').count(),0,'finish removes the video player');
 }finally{await browser.close();}
});

test('host cue list keeps the current cue visible without blank spacers and offers review or a fresh class answer round',async()=>{
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
    if(!row||!body||!row.innerText.includes(sequence+'.'))return false;
    const bounds=row.getBoundingClientRect(),viewport=body.getBoundingClientRect();
    return bounds.top>=viewport.top&&bounds.bottom<=viewport.bottom;
   },sequence);
   assert.equal(await list.locator('li.is-current button').getAttribute('aria-current'),'step');
   assert.deepEqual(await list.locator('ol').evaluate(el=>{const css=getComputedStyle(el);return [css.paddingTop,css.paddingBottom];}),['0px','0px']);
  }
  await positioned(18);
  await host.setViewportSize({width:390,height:844});await positioned(18);
  await host.setViewportSize({width:1280,height:900});await positioned(18);
  const manual=await list.locator('.battle-online-host-question-list-body').evaluate(el=>{el.scrollTop+=35;return el.scrollTop;});
  await apply(host,room('COUNTDOWN','WATCHING',2,18));
  assert.equal(await list.locator('.battle-online-host-question-list-body').evaluate(el=>el.scrollTop),manual,'same-cue broadcasts preserve manual scrolling');
  await apply(host,room('COUNTDOWN','WATCHING',3,19));await positioned(19);
  await apply(host,room('COUNTDOWN','WATCHING',4,1));await positioned(1);
  assert.ok(await list.locator('.battle-online-host-question-list-body').evaluate(el=>el.scrollTop<=16));
  await apply(host,room('COUNTDOWN','WATCHING',5,60));await positioned(60);
  await apply(host,room('COUNTDOWN','WATCHING',6,19));await positioned(19);
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
  const reopened=room('COUNTDOWN','ANSWERING',7,18);reopened.videoQuestionRound=1;reopened.totalQuestions=60;reopened.currentQuestion.exercise.videoTimeSeconds=90;
  await host.evaluate(r=>window.qaScope.$apply(()=>window.reopenRequests[0].request.resolve(r)),reopened);
  await host.locator('#battle-host-video-question-modal').waitFor({state:'visible'});
  assert.equal(await confirm.count(),0);
  assert.equal(await host.evaluate(()=>window.qaScope.vm.hostVideoReplay),null);
  assert.deepEqual(await host.evaluate(()=>window.videoActions.at(-1)),['seek',90]);
 } finally {await browser.close();}
});
