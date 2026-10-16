const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/controllers/ViewController.js'),'utf8');
function section(start,end){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,start);return source.slice(from,to);}
const seekSource=section('        var dailyListeningSeekWait = null;','        vm.backwardAudio =');
const youtubeSource=section('        function runYoutubeAction(action)','        function seekYoutubeBy(');
const restoreSource=section('        function restoreDailyListeningAudioPosition(seconds)','        vm.resumeDailyListeningDraft =');

function setup({readyState=1,duration=120,playResult}={}){
 const listeners=new Map(),onceListeners=new WeakSet(),writes=[],destroyCallbacks=[],loads=[],timeouts=[];
 const audio={readyState,duration,playCalls:0,
  set currentTime(value){writes.push(value);},get currentTime(){return writes.at(-1)||0;},
  addEventListener(name,callback,options){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);if(options?.once)onceListeners.add(callback);},
  removeEventListener(name,callback){listeners.get(name)?.delete(callback);},
  play(){this.playCalls++;return playResult?.();}
 };
 const context={vm:{isYoutubeAudio:false,youtubeVideoId:'abcdefghijk',youtubeStartSeconds:25},angular:{noop(){}},
  $scope:{$$destroyed:false,$on(name,callback){assert.equal(name,'$destroy');destroyCallbacks.push(callback);}},
  $timeout(callback){timeouts.push(callback);},
  getMainAudio:()=>audio,saves:0,scheduleDailyListeningDraftSave(){context.saves++;},
  youtubeGapPlayerReady:false,youtubeGapPlayer:null,youtubeGapPendingAction:null,
  loadYoutubeVideo(id,start){loads.push({id,start});}
 };
 nodeVm.runInNewContext(youtubeSource+seekSource+restoreSource,context);
 return{context,audio,writes,loads,
  metadata(value=duration){audio.readyState=1;audio.duration=value;for(const callback of [...(listeners.get('loadedmetadata')||[])]){callback();if(onceListeners.has(callback))listeners.get('loadedmetadata').delete(callback);}},
  flushTimeouts(){while(timeouts.length)timeouts.shift()();},
  listenerCount(){return listeners.get('loadedmetadata')?.size||0;},
  destroy(){context.$scope.$$destroyed=true;destroyCallbacks.forEach(callback=>callback());}
 };
}

test('timestamp seeks can return to zero and clamp to known duration without accepting invalid times',()=>{
 const {context,audio,writes}=setup({duration:10});
 for(const seconds of [NaN,Infinity,-Infinity,-1,'not a timestamp'])context.vm.seekDailyListeningTo(seconds);
 assert.deepEqual(writes,[]);assert.equal(audio.playCalls,0);assert.equal(context.saves,0);
 context.vm.seekDailyListeningTo(8);context.vm.seekDailyListeningTo(100);context.vm.seekDailyListeningTo(0);
 assert.deepEqual(writes,[8,10,0]);assert.equal(audio.playCalls,3);assert.equal(context.saves,3);
});

test('only the latest timestamp click is applied when audio metadata arrives',()=>{
 const state=setup({readyState:0,duration:NaN});
 state.context.vm.seekDailyListeningTo(2);state.context.vm.seekDailyListeningTo(18);state.context.vm.seekDailyListeningTo(7);
 assert.equal(state.listenerCount(),1);assert.deepEqual(state.writes,[]);assert.equal(state.context.saves,0);
 state.metadata(10);
 assert.deepEqual(state.writes,[7]);assert.equal(state.listenerCount(),0);assert.equal(state.context.saves,1);
 state.metadata(10);assert.deepEqual(state.writes,[7]);
});

test('pending native timestamp seek is removed when leaving the lesson',()=>{
 const state=setup({readyState:0});state.context.vm.seekDailyListeningTo(12);
 assert.equal(state.listenerCount(),1);state.destroy();assert.equal(state.listenerCount(),0);
 state.metadata();assert.deepEqual(state.writes,[]);assert.equal(state.context.saves,0);
});

test('a pending timestamp cannot seek the next audio source',()=>{
 const state=setup({readyState:0});state.context.vm.seekDailyListeningTo(12);
 // setUpAudio calls this cleanup before changing the media source.
 state.context.clearDailyListeningSeekWait();state.metadata();
 assert.deepEqual(state.writes,[]);assert.equal(state.context.saves,0);
 state.context.vm.seekDailyListeningTo(3);assert.deepEqual(state.writes,[3]);
});

test('blocked native autoplay does not lose the requested timestamp or raise an unhandled rejection',async()=>{
 const state=setup({playResult:()=>Promise.reject(new Error('Autoplay blocked'))});
 state.context.vm.seekDailyListeningTo(9);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(state.writes,[9]);assert.equal(state.context.saves,1);
});

test('YouTube applies the latest queued absolute timestamp after readiness and starts playback',()=>{
 const state=setup();state.context.vm.isYoutubeAudio=true;
 state.context.vm.seekDailyListeningTo(3);state.context.vm.seekDailyListeningTo(42);
 assert.equal(state.context.saves,0);assert.equal(typeof state.context.youtubeGapPendingAction,'function');
 const calls=[];
 state.context.youtubeGapPlayer={getCurrentTime:()=>25,getDuration:()=>60,
  seekTo(seconds,allowSeekAhead){calls.push(['seek',seconds,allowSeekAhead]);},playVideo(){calls.push(['play']);}};
 state.context.youtubeGapPlayerReady=true;
 const pending=state.context.youtubeGapPendingAction;state.context.youtubeGapPendingAction=null;pending();
 assert.deepEqual(calls,[['seek',42,true],['play']]);assert.equal(state.context.saves,1);
 state.context.vm.seekDailyListeningTo(100);state.context.vm.seekDailyListeningTo(0);
 assert.deepEqual(calls,[['seek',42,true],['play'],['seek',60,true],['play'],['seek',0,true],['play']]);
 assert.deepEqual(state.writes,[]);assert.equal(state.context.saves,3);
});

test('a timestamp click wins over a delayed draft audio restoration on native audio and YouTube',()=>{
 for(const youtube of [false,true]){
  const state=setup({duration:120}),youtubeWrites=[];
  state.context.vm.isYoutubeAudio=youtube;
  if(youtube){state.context.youtubeGapPlayerReady=true;state.context.youtubeGapPlayer={getCurrentTime:()=>0,getDuration:()=>120,
   seekTo:seconds=>youtubeWrites.push(seconds),playVideo(){}};}
  state.context.restoreDailyListeningAudioPosition(70);
  state.context.vm.seekDailyListeningTo(12);
  state.flushTimeouts();
  assert.deepEqual(youtube?youtubeWrites:state.writes,[12]);assert.equal(state.context.saves,1);
 }
});

test('a timestamp click wins when draft restoration is already waiting for native metadata',()=>{
 const state=setup({readyState:0,duration:NaN});
 state.context.restoreDailyListeningAudioPosition(70);state.flushTimeouts();
 assert.equal(state.listenerCount(),1);
 state.context.vm.seekDailyListeningTo(12);
 state.metadata(120);
 assert.deepEqual(state.writes,[12]);assert.equal(state.context.saves,1);assert.equal(state.listenerCount(),0);
});
