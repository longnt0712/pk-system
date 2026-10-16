const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../question/business/DailyListeningMobile.js'),'utf8');

function eventTarget(){
 const listeners=new Map();
 return{addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);},
  removeEventListener(name,callback){listeners.get(name)?.delete(callback);},
  emit(name){for(const callback of [...(listeners.get(name)||[])])callback({type:name});},
  listenerCount(name){return name?(listeners.get(name)?.size||0):[...listeners.values()].reduce((sum,set)=>sum+set.size,0);}};
}
function classes(){const values=new Set();return{add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},contains:name=>values.has(name),toggle(name,state){if(state)values.add(name);else values.delete(name);}};}
function setup({mobile=true,visual=true,media=true,frame=true,existingClass=false}={}){
 const properties=new Map(),frames=new Map(),timers=new Map(),members=new Set();let sequence=0,watcher,destroy;
 const root={classList:classes(),contains:element=>members.has(element),style:{setProperty:(name,value)=>properties.set(name,value),getPropertyValue:name=>properties.get(name)||'',removeProperty:name=>properties.delete(name)}};
 const document=Object.assign(eventTarget(),{documentElement:{classList:classes(),clientWidth:390,clientHeight:844},body:{classList:classes()},activeElement:null});
 if(existingClass){document.documentElement.classList.add('daily-listening-mobile-open');document.body.classList.add('daily-listening-mobile-open');}
 const viewport=Object.assign(eventTarget(),{width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});
 const query=Object.assign(eventTarget(),{matches:mobile});
 const window=Object.assign(eventTarget(),{document,innerWidth:mobile?390:1366,innerHeight:844,
  setTimeout(callback,delay){const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id)});
 if(frame){window.requestAnimationFrame=callback=>{const id=++sequence;frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>frames.delete(id);}
 if(visual)window.visualViewport=viewport;
 if(media)window.matchMedia=value=>{assert.equal(value,'(max-width: 767px), (max-width: 1024px) and (pointer: coarse)');return query;};
 const scope={$watch(expression,callback){assert.equal(expression,'vm.isStandaloneDailyListening');watcher=callback;return()=>{watcher=null;};},$on(name,callback){assert.equal(name,'$destroy');destroy=callback;}};
 const angular={module(name){assert.equal(name,'Hrm.Question');return{directive(name,definition){assert.equal(name,'dailyListeningMobile');definition.at(-1)(window).link(scope,[root],{dailyListeningMobile:'vm.isStandaloneDailyListening'});}};}};
 nodeVm.runInNewContext(source,{angular});
 return{root,document,window,viewport,query,properties,members,frames,timers,
  enable:value=>watcher(value),destroy:()=>destroy(),
  flushFrames(){const ready=[...frames.values()];frames.clear();ready.forEach(callback=>callback());},
  flushTimers(){const ready=[...timers.values()];timers.clear();ready.forEach(timer=>timer.callback());}};
}

test('the standalone mobile workspace tracks the visual viewport and coalesces keyboard events',()=>{
 const state=setup();state.enable(true);
 assert.equal(state.root.classList.contains('dl-mobile-workspace'),true);
 assert.equal(state.document.body.classList.contains('daily-listening-mobile-open'),true);
 assert.equal(state.properties.get('--dl-viewport-height'),'844px');
 Object.assign(state.viewport,{height:410,offsetTop:72,offsetLeft:3,width:384});
 state.viewport.emit('resize');state.viewport.emit('scroll');state.window.emit('resize');
 assert.equal(state.frames.size,1);state.flushFrames();
 assert.equal(state.properties.get('--dl-viewport-top'),'72px');assert.equal(state.properties.get('--dl-viewport-left'),'3px');
 assert.equal(state.properties.get('--dl-viewport-width'),'384px');assert.equal(state.properties.get('--dl-viewport-height'),'410px');
 assert.equal(state.root.classList.contains('dl-mobile-compact'),true);
 state.viewport.height=844;state.viewport.offsetTop=0;state.viewport.emit('resize');state.flushFrames();
 assert.equal(state.root.classList.contains('dl-mobile-compact'),false);assert.equal(state.properties.get('--dl-viewport-top'),'0px');
});

test('focused gaps scroll only their transcript when the keyboard obscures them',()=>{
 const state=setup();let bottom=600;
 const transcript={scrollTop:0,getBoundingClientRect:()=>({top:200,bottom,height:bottom-200})};
 const input={matches:selector=>selector==='.gap-inline-input',closest:()=>transcript,getBoundingClientRect:()=>({top:650-transcript.scrollTop,bottom:680-transcript.scrollTop})};
 state.members.add(input);state.members.add(transcript);state.document.activeElement=input;
 state.enable(true);assert.equal(transcript.scrollTop,90);
 bottom=350;state.viewport.height=410;state.document.emit('focusin');state.flushFrames();
 assert.equal(transcript.scrollTop,340);assert.equal(state.timers.size,3);
 state.flushTimers();state.flushFrames();assert.equal(transcript.scrollTop,340);
 // A focus transition to the next gap above the current scroll position is also revealed.
 input.getBoundingClientRect=()=>({top:175,bottom:205});state.document.emit('focusin');state.flushFrames();
 assert.equal(transcript.scrollTop,305);
 const outside={matches:()=>true,closest(){throw new Error('Outside inputs must not be inspected');}};
 state.document.activeElement=outside;state.document.emit('focusin');state.flushFrames();assert.equal(transcript.scrollTop,305);
});

test('pinch zoom keeps native magnification instead of continually reflowing the workspace',()=>{
 const state=setup();state.enable(true);
 Object.assign(state.viewport,{scale:2,width:195,height:422,offsetTop:90});state.viewport.emit('resize');state.viewport.emit('scroll');state.flushFrames();
 assert.equal(state.properties.get('--dl-viewport-width'),'390px');assert.equal(state.properties.get('--dl-viewport-height'),'844px');assert.equal(state.properties.get('--dl-viewport-top'),'0px');
 Object.assign(state.viewport,{scale:1,width:390,height:410,offsetTop:40});state.viewport.emit('resize');state.flushFrames();
 assert.equal(state.properties.get('--dl-viewport-height'),'410px');assert.equal(state.properties.get('--dl-viewport-top'),'40px');
});

test('desktop, disabling the directive, and destruction remove mobile state and pending work',()=>{
 const state=setup({mobile:false});state.enable(true);
 assert.equal(state.root.classList.contains('dl-mobile-workspace'),false);assert.equal(state.viewport.listenerCount(),0);assert.equal(state.query.listenerCount('change'),1);
 state.query.matches=true;state.query.emit('change');state.document.emit('focusin');
 assert.equal(state.timers.size,3);assert.equal(state.frames.size,1);
 state.query.matches=false;state.query.emit('change');
 assert.equal(state.frames.size,0);assert.equal(state.timers.size,0);assert.equal(state.properties.size,0);
 assert.equal(state.window.listenerCount(),0);assert.equal(state.viewport.listenerCount(),0);assert.equal(state.document.listenerCount(),0);
 assert.equal(state.document.documentElement.classList.contains('daily-listening-mobile-open'),false);
 state.enable(false);assert.equal(state.query.listenerCount(),0);
 state.query.matches=true;state.enable(true);state.document.emit('focusout');
 state.destroy();assert.equal(state.query.listenerCount(),0);assert.equal(state.document.listenerCount(),0);assert.equal(state.properties.size,0);
 assert.equal(state.frames.size,0);assert.equal(state.timers.size,0);assert.equal(state.root.classList.contains('dl-mobile-workspace'),false);
});

test('fallback browsers follow window dimensions and preserve preexisting document classes',()=>{
 const state=setup({visual:false,media:false,frame:false,existingClass:true});state.enable(true);
 assert.equal(state.properties.get('--dl-viewport-height'),'844px');
 state.window.innerHeight=390;state.window.emit('resize');state.flushTimers();
 assert.equal(state.properties.get('--dl-viewport-height'),'390px');assert.equal(state.root.classList.contains('dl-mobile-compact'),true);
 state.window.innerWidth=1366;state.window.emit('resize');assert.equal(state.properties.size,0);
 assert.equal(state.document.body.classList.contains('daily-listening-mobile-open'),true);
 state.window.innerWidth=390;state.window.emit('resize');assert.equal(state.root.classList.contains('dl-mobile-workspace'),true);
 state.enable(false);assert.equal(state.window.listenerCount(),0);assert.equal(state.document.documentElement.classList.contains('daily-listening-mobile-open'),true);
});
