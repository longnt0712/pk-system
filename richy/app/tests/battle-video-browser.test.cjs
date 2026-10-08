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
  window.APP_VERSION='qa';window.videoCalls=[];window.answerCalls=[];window.answerRequests=[];window.videoActions=[];
  angular.module('Hrm.Question',['ngSanitize']).value('$state',{go(){}}).value('$stateParams',{})
   .value('$cookies',{get(){return JSON.stringify({id:1,username});}})
   .value('toastr',{warning(){},error(){},success(){}}).value('blockUI',{}).value('QuestionService',{})
   .factory('BattleQuizOnlineService',function($q){return {answer(...args){window.answerCalls.push(args);const request=$q.defer();window.answerRequests.push(request);return request.promise;},
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
  await host.evaluate(()=>window.qaScope.$apply(()=>window.videoAdapter.onVideoProgress({seconds:10,duration:60})));
  assert.equal(await host.evaluate(()=>window.videoCalls[0].args[2]),'CUE');
  await host.evaluate(r=>window.qaScope.$apply(()=>window.videoCalls[0].request.resolve(r)),room('DEMON_DEFENSE','ANSWERING',2));
  assert.equal(await host.getByRole('button',{name:'Phát / tiếp tục video'}).isEnabled(),false);
  assert.ok(await host.evaluate(()=>window.videoActions.includes('pause')));
  const before=await host.evaluate(()=>window.videoActions.filter(a=>a==='play').length);
  await apply(host,room('DEMON_DEFENSE','WATCHING',3,2));
  assert.ok(await host.evaluate(()=>window.videoActions.filter(a=>a==='play').length)>before);
  for(const viewport of [{width:1920,height:900},{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
   await host.setViewportSize(viewport);
   const card=await host.locator('.battle-online-host-video').boundingBox(),video=await host.locator('video').boundingBox();
   assert.ok(card.height<viewport.height-30,JSON.stringify({viewport,card}));
   assert.ok(card.x>=0&&card.x+card.width<=viewport.width,'video card fits horizontally');
   assert.ok(Math.abs(video.width/video.height-16/9)<0.02,'video keeps its aspect ratio');
  }
  await host.setViewportSize({width:1366,height:768});
  const captureDir=path.join(app,'../target');fs.mkdirSync(captureDir,{recursive:true});
  await host.screenshot({path:path.join(captureDir,'battle-video-host.png'),fullPage:true});
  await student.screenshot({path:path.join(captureDir,'battle-video-student.png'),fullPage:true});
  const finished=room('DEMON_DEFENSE','ANSWERING',4,2);finished.status='FINISHED';finished.currentQuestion=null;
  await apply(host,finished);assert.equal(await host.locator('.battle-online-host-video').count(),0,'finish removes the video player');
 }finally{await browser.close();}
});
