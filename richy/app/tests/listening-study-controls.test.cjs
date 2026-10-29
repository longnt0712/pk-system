const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.resolve(process.env.IELTS_LISTENING_CONTROLS_APP||path.join(__dirname,'..'));
const source=fs.readFileSync(path.join(app,'question/controllers/IELTSReadingActualTestController.js'),'utf8').replace(/\r\n/g,'\n');
const view=fs.readFileSync(path.join(app,'question/views/ielts_reading_actual_test_idp.html'),'utf8').replace(/\r\n/g,'\n');
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const first=source.indexOf(start),last=source.indexOf(end,first);assert.ok(first>=0&&last>first,start);return source.slice(first,last);}
function functionCode(name,property=false){
  const needle=property?'vm.'+name+' = function':'function '+name+'(';
  const start=source.indexOf(needle);assert.ok(start>=0,'actual source contains '+name);
  const first=source.indexOf('{',start);let depth=0,quote=null,lineComment=false,blockComment=false;
  for(let i=first;i<source.length;i++){
    const character=source[i],next=source[i+1];
    if(lineComment){if(character==='\n')lineComment=false;continue;}
    if(blockComment){if(character==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(character==='\\'){i++;continue;}if(character===quote)quote=null;continue;}
    if(character==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(character==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(character==='"'||character==="'"||character==='`'){quote=character;continue;}
    if(character==='{')depth++;
    if(character==='}'&&--depth===0)return source.slice(start,i+1)+(property?';':'');
  }
  throw Error('Unclosed source function '+name);
}
function fixture(options={}){
  const values=new Map(Object.entries(options.preferences||{})),listeners=new Map(),frames=new Map();let frameId=0;
  const log={storageReads:[],storageWrites:[],loads:0,plays:0,pauses:0,requests:0,domRemoved:0};
  const audio={playbackRate:1,defaultPlaybackRate:1,currentTime:18.5,duration:60,readyState:1,paused:false,src:'existing.mp3',
    addEventListener(){},removeEventListener(){},
    load(){log.loads++;this.playbackRate=1;this.defaultPlaybackRate=1;},play(){log.plays++;return Promise.resolve();},pause(){log.pauses++;}};
  const document={getElementById(id){return id==='main-audio'&&options.noMedia!==true?audio:null;},
    addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name){listeners.delete(name);},
    body:{classList:{add(){},remove(){}}}};
  const vm={isListeningRoute:options.listening!==false,isWritingRoute:false,isComprehensiveRoute:false,isFlexibleRoute:false,
    isPreviewMode:!!options.preview,testSessionMode:options.mode||'STUDY',showAudio:true,showListeningContent:false,
    isPartAssignment:false,ieltsReadingActualTest:{id:42,pronounce:'lesson.mp3',subQuestions:[{type:1},{type:1},{type:1}]},
    testResult:{questionAnswerTestResult:[{ordinalNumber:1,clientAnswer:'Keep answer'}]},annotationNotes:[{id:'n1',text:'Keep note'}],
    hasComprehensiveVideo:()=>false};
  vm.isStudyMode=()=>vm.testSessionMode==='STUDY';
  const c=nodeVm.createContext({vm,Math,Number,String,parseFloat,isNaN,
    angular:{isFunction:value=>typeof value==='function',noop(){}},document,mainAudio:null,
    $scope:{$evalAsync(){},$on(){}},$timeout:callback=>callback(),
    $window:{innerWidth:options.width||1440,document,
      requestAnimationFrame(callback){const id=++frameId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
      localStorage:{getItem(key){log.storageReads.push(key);if(options.blockedStorage)throw Error('blocked');return values.get(key)||null;},
        setItem(key,value){if(options.blockedStorage)throw Error('blocked');log.storageWrites.push([key,value]);values.set(key,value);}}},
    service:new Proxy({},{get(){return()=>{log.requests++;throw Error('Listening toolbar must not call an API');};}}),
    trackAudioDuration(){}});
  nodeVm.runInContext(section('        /* Adjustable exam panels','        /* Reading display preferences'),c);
  nodeVm.runInContext(section('        vm.playbackValue = 1.0;','        $scope.counter = 3600;'),c);
  nodeVm.runInContext(section('        var mainAudio = null;','        function stripEmbeddedReadingIntro('),c);
  nodeVm.runInContext(functionCode('selectedListeningAudioUrl'),c);
  for(const name of ['isListeningContentVisible','toggleListeningContent','setUpAudio'])nodeVm.runInContext(functionCode(name,true),c);
  return{vm,c,audio,values,listeners,log,flushFrames(){const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());},
    changeContent(value){vm.showListeningContent=value;vm.toggleListeningContent();},
    drag(percent){const target={parentNode:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})}};
      vm.startReadingResize({type:'mousedown',currentTarget:target,preventDefault(){}});
      listeners.get('mousemove')({clientX:percent*10,clientY:percent*8,cancelable:true,preventDefault(){}});
      this.flushFrames();listeners.get('mouseup')();}};
}
function openingTags(className,tag='div'){
  const match=new RegExp('<'+tag+'\\b[^>]*\\bclass="[^"\\n]*\\b'+className+'\\b[^"\\n]*"[^>]*>','g');
  return[...view.matchAll(match)].map(item=>item[0]);
}
function attribute(tag,name){const found=tag.match(new RegExp('(?:^|\\s)(?:data-)?'+name+'="([^"]*)"'));assert.ok(found,name+' is present');return found[1];}
function evaluate(expression,f){return nodeVm.runInContext(expression,f.c);}

test('Study audio speed reaches exactly 0.6x and 4x in tenth steps without floating point drift',()=>{
  const f=fixture();assert.equal(f.vm.minimumPlaybackSpeed(),0.6);
  for(let index=0;index<10;index++)f.vm.decreaseSpeed();
  assert.equal(f.vm.playbackValue,0.6);assert.equal(f.audio.playbackRate,0.6);assert.equal(f.audio.defaultPlaybackRate,0.6);
  for(let index=0;index<50;index++){f.vm.increaseSpeed();assert.equal(f.vm.playbackValue,Math.round(f.vm.playbackValue*10)/10);}
  assert.equal(f.vm.playbackValue,4);assert.equal(f.audio.playbackRate,4);assert.equal(f.audio.defaultPlaybackRate,4);
  f.vm.increaseSpeed();assert.equal(f.vm.playbackValue,4);assert.equal(f.log.requests,0);
});

test('Serious and author Preview retain a 1x floor even when an old Study value is below one',()=>{
  for(const preview of [false,true]){
    const f=fixture({mode:'SERIOUS',preview});assert.equal(f.vm.minimumPlaybackSpeed(),1);
    f.vm.playbackValue=0.6;f.vm.decreaseSpeed();assert.equal(f.vm.playbackValue,1);assert.equal(f.audio.playbackRate,1);assert.equal(f.audio.defaultPlaybackRate,1);
    f.vm.playbackValue=1.3;f.vm.decreaseSpeed();assert.equal(f.vm.playbackValue,1.2);
    for(let index=0;index<10;index++)f.vm.decreaseSpeed();assert.equal(f.vm.playbackValue,1);
    f.vm.increaseSpeed();assert.equal(f.vm.playbackValue,1.1);assert.equal(f.audio.playbackRate,1.1);
  }
});

test('switching from Study to Serious clamps stale slow speed and missing media does not break controls',()=>{
  const f=fixture();f.vm.playbackValue=0.6;f.vm.testSessionMode='SERIOUS';f.vm.increaseSpeed();
  assert.ok(f.vm.playbackValue>=1);assert.ok(f.audio.playbackRate>=1);assert.ok(f.audio.defaultPlaybackRate>=1);
  const missing=fixture({noMedia:true});missing.vm.decreaseSpeed();assert.equal(missing.vm.playbackValue,0.9);assert.equal(missing.log.requests,0);
});

test('audio setup reapplies the selected clamped speed after media load resets native rate state',()=>{
  for(const [mode,value,expected]of[['STUDY',0.6,0.6],['STUDY',3.9,3.9],['SERIOUS',0.6,1],['SERIOUS',4.8,4]]){
    const f=fixture({mode});f.vm.playbackValue=value;f.vm.setUpAudio();assert.equal(f.log.loads,1);assert.equal(f.log.plays,1);
    assert.equal(f.audio.playbackRate,expected);assert.equal(f.audio.defaultPlaybackRate,expected);assert.equal(f.vm.playbackValue,expected);
    assert.equal(f.audio.src,'lesson.mp3');assert.equal(f.log.requests,0);
  }
});

test('five-second controls seek in both directions and clamp to the recording bounds without restarting media or changing work',()=>{
  for(const paused of[false,true]){
    const f=fixture(),answers=plain(f.vm.testResult),notes=plain(f.vm.annotationNotes);
    f.audio.paused=paused;f.audio.playbackRate=1.7;f.audio.defaultPlaybackRate=1.7;f.vm.playbackValue=1.7;
    assert.equal(f.vm.seekListeningAudio(-5),true);assert.equal(f.audio.currentTime,13.5);
    assert.equal(f.vm.seekListeningAudio(5),true);assert.equal(f.audio.currentTime,18.5);
    f.audio.currentTime=2;assert.equal(f.vm.seekListeningAudio(-5),true);assert.equal(f.audio.currentTime,0);
    f.audio.currentTime=58;assert.equal(f.vm.seekListeningAudio(5),true);assert.equal(f.audio.currentTime,60);
    assert.equal(f.audio.paused,paused);assert.equal(f.audio.playbackRate,1.7);assert.equal(f.audio.defaultPlaybackRate,1.7);
    assert.equal(f.vm.playbackValue,1.7);assert.equal(f.audio.src,'existing.mp3');
    assert.deepEqual(plain(f.vm.testResult),answers);assert.deepEqual(plain(f.vm.annotationNotes),notes);
    assert.equal(f.log.loads+f.log.plays+f.log.pauses+f.log.requests,0);
  }
});

test('five-second seeking safely rejects missing or invalid media metadata and native setter failures',()=>{
  const missing=fixture({noMedia:true});assert.equal(missing.vm.seekListeningAudio(5),false);
  for(const duration of[undefined,NaN,Infinity,0,-1]){
    const f=fixture();f.audio.duration=duration;
    assert.equal(f.vm.seekListeningAudio(5),false);assert.equal(f.audio.currentTime,18.5);
    assert.equal(f.log.loads+f.log.plays+f.log.pauses+f.log.requests,0);
  }
  for(const current of[undefined,NaN,Infinity,-Infinity]){
    const f=fixture();f.audio.currentTime=current;
    assert.equal(f.vm.seekListeningAudio(5),false);assert.equal(f.audio.currentTime,current);
  }
  for(const offset of[undefined,NaN,Infinity,-Infinity]){
    const f=fixture();assert.equal(f.vm.seekListeningAudio(offset),false);assert.equal(f.audio.currentTime,18.5);
  }
  const unavailable=fixture();let writes=0;
  Object.defineProperty(unavailable.audio,'currentTime',{get:()=>18.5,set(){writes++;throw Error('not seekable yet');}});
  assert.equal(unavailable.vm.seekListeningAudio(5),false);assert.equal(writes,1);assert.equal(unavailable.audio.currentTime,18.5);
  assert.equal(unavailable.log.loads+unavailable.log.plays+unavailable.log.pauses+unavailable.log.requests,0);
});

test('five-second controls remain Study-only and sit between the player and speed controls',()=>{
  for(const options of[{mode:'SERIOUS'},{mode:'SERIOUS',preview:true},{listening:false}]){
    const f=fixture(options);assert.equal(f.vm.seekListeningAudio(-5),false);assert.equal(f.vm.seekListeningAudio(5),false);
    assert.equal(f.audio.currentTime,18.5);assert.equal(f.log.loads+f.log.plays+f.log.pauses+f.log.requests,0);
  }
  const group=openingTags('idp-listening-skip')[0];assert.ok(group);assert.equal(attribute(group,'ng-if'),'vm.isStudyMode()');
  const playerAt=view.indexOf('class="idp-listening-player"'),skipAt=view.indexOf(group),speedAt=view.indexOf('class="idp-listening-speed"');
  assert.ok(playerAt>=0&&playerAt<skipAt&&skipAt<speedAt);
  for(const [offset,label]of[[-5,'Lùi 5 giây'],[5,'Tiến 5 giây']]){
    const button=[...view.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes('ng-click="vm.seekListeningAudio('+offset+')"'));
    assert.ok(button);assert.equal(attribute(button,'type'),'button');assert.equal(attribute(button,'aria-label'),label);
  }
});

test('Listening split preferences are independent from Reading and absent Listening preference starts at 50%',()=>{
  const f=fixture({preferences:{ieltsReadingPanePercent:'5'}});assert.equal(f.vm.readingPanePercent,50);
  assert.ok(f.log.storageReads.includes('ieltsListeningPanePercent'));assert.equal(f.vm.isListeningContentVisible(),false);
  const saved=fixture({preferences:{ieltsReadingPanePercent:'5',ieltsListeningPanePercent:'70'}});assert.equal(saved.vm.readingPanePercent,70);
  saved.changeContent(true);assert.equal(saved.vm.readingPanePercent,70);assert.equal(saved.vm.showListeningContent,true);assert.equal(saved.vm.isListeningContentVisible(),true);
  const reading=fixture({listening:false,preferences:{ieltsReadingPanePercent:'5',ieltsListeningPanePercent:'70'}});assert.equal(reading.vm.readingPanePercent,5);
});

test('real checkbox model changes retain resized Listening ratio across off/on and save only its own preference',()=>{
  for(const width of[1440,390]){
    const f=fixture({width,preferences:{ieltsReadingPanePercent:'5'}}),answers=plain(f.vm.testResult),notes=plain(f.vm.annotationNotes);
    f.changeContent(true);assert.equal(f.vm.showListeningContent,true);assert.equal(f.vm.readingPanePercent,50);
    f.drag(70);assert.equal(f.vm.readingPanePercent,70);assert.equal(f.values.get('ieltsListeningPanePercent'),'70');assert.equal(f.values.get('ieltsReadingPanePercent'),'5');
    f.changeContent(false);assert.equal(f.vm.isListeningContentVisible(),false);assert.equal(f.vm.readingPanePercent,70);
    f.changeContent(true);assert.equal(f.vm.isListeningContentVisible(),true);assert.equal(f.vm.readingPanePercent,70);
    assert.deepEqual(plain(f.vm.testResult),answers);assert.deepEqual(plain(f.vm.annotationNotes),notes);
    assert.equal(f.log.loads,0);assert.equal(f.log.plays,0);assert.equal(f.log.pauses,0);assert.equal(f.audio.currentTime,18.5);assert.equal(f.log.requests,0);
  }
});

test('only Study Listening toggles content while author Preview remains visible and student Serious stays hidden',()=>{
  const normal=fixture();normal.changeContent(true);assert.equal(normal.vm.isListeningContentVisible(),true);
  for(const options of[{mode:'SERIOUS'},{listening:false}]){
    const f=fixture(options);f.changeContent(true);assert.equal(f.vm.showListeningContent,false);assert.equal(f.vm.isListeningContentVisible(),false);
  }
  const preview=fixture({mode:'SERIOUS',preview:true});assert.equal(preview.vm.showListeningContent,false);assert.equal(preview.vm.isListeningContentVisible(),true);
});

test('all three Listening panes and dividers follow the content switch and question area uses the remaining width',()=>{
  const panes=openingTags('idp-reading-pane'),dividers=openingTags('idp-split-divider').filter(tag=>!tag.includes('idp-writing-split-divider')),questions=openingTags('idp-question-pane');
  assert.equal(panes.length,3);assert.equal(dividers.length,3);assert.equal(questions.length,3);
  for(const width of[1440,390])for(const visible of[false,true]){
    const f=fixture({width});f.changeContent(visible);f.vm.readingPanePercent=70;
    for(const tag of panes)assert.equal(!!evaluate(attribute(tag,'ng-hide'),f),!visible);
    for(const tag of dividers)assert.equal(!!evaluate(attribute(tag,'ng-hide'),f),!visible);
    for(const tag of questions){const style=plain(evaluate(attribute(tag,'ng-style'),f));assert.equal(style[width<=996?'flex-basis':'width'],visible?'30%':'100%');}
  }
  for(const options of[{mode:'SERIOUS'},{mode:'SERIOUS',preview:true},{listening:false}]){
    const f=fixture(options),hidden=options.mode==='SERIOUS'&&!options.preview;
    for(const tag of panes)assert.equal(!!evaluate(attribute(tag,'ng-hide'),f),hidden);
    for(const tag of dividers)assert.equal(!!evaluate(attribute(tag,'ng-hide'),f),hidden);
  }
});

test('the media stays mounted while custom playback is available only in Study regardless of the retired Show audio model',()=>{
  const audio=view.match(/<audio\b[^>]*\bid="main-audio"[^>]*>/);assert.ok(audio);assert.doesNotMatch(audio[0],/\bng-if=/);
  assert.doesNotMatch(audio[0],/\bcontrols(?:\s|=|>)/,'native player does not add a second timeline on Safari');
  const player=view.match(/<div\b[^>]*class="idp-listening-player"[^>]*>/);assert.ok(player);
  const show=attribute(player[0],'ng-show');
  for(const [mode,shown,expected]of[['STUDY',true,true],['STUDY',false,true],['SERIOUS',true,false],['SERIOUS',false,false]]){
    const f=fixture({mode});f.vm.showAudio=shown;assert.equal(!!evaluate(show,f),expected);
  }
});

test('content and header switches remain labelled after Show audio is removed, and minus disables at the mode floor',()=>{
  const inputs=[...view.matchAll(/<input\b[^>]*>/g)].map(match=>match[0]);
  assert.doesNotMatch(view,/ng-model="vm\.showAudio"|listening-audio-switch|Show audio/);
  for(const model of['vm.showListeningToolbar','vm.showListeningContent']){
    const input=inputs.find(tag=>new RegExp('(?:data-)?ng-model="'+model.replace(/\./g,'\\.')+'"').test(tag));assert.ok(input,model);
    assert.equal(attribute(input,'type'),'checkbox');assert.equal(attribute(input,'role'),'switch');
    const labelled=input.match(/\baria-label="([^"]+)"/)||input.match(/\bid="([^"]+)"/);assert.ok(labelled,'native switch has an accessible label association');
  }
  const content=inputs.find(tag=>/ng-model="vm\.showListeningContent"/.test(tag));const change=attribute(content,'ng-change');
  const f=fixture();f.vm.showListeningContent=true;evaluate(change,f);assert.equal(f.vm.showListeningContent,true);
  f.vm.showListeningContent=false;evaluate(change,f);assert.equal(f.vm.showListeningContent,false);
  const minus=view.match(/<button\b[^>]*ng-click="vm\.decreaseSpeed\(\)"[^>]*>/);assert.ok(minus);
  const disabled=attribute(minus[0],'ng-disabled');
  for(const [mode,value,expected]of[['STUDY',0.6,true],['STUDY',0.7,false],['SERIOUS',1,true],['SERIOUS',1.1,false]]){
    f.vm.testSessionMode=mode;f.vm.playbackValue=value;assert.equal(!!evaluate(disabled,f),expected);
  }
});

test('blocked local preferences do not prevent content toggling, resizing or question preservation',()=>{
  const f=fixture({blockedStorage:true});assert.equal(f.vm.readingPanePercent,50);f.changeContent(true);f.drag(65);f.changeContent(false);f.changeContent(true);
  assert.equal(f.vm.readingPanePercent,65);assert.equal(f.vm.isListeningContentVisible(),true);assert.equal(f.vm.testResult.questionAnswerTestResult[0].clientAnswer,'Keep answer');assert.equal(f.log.requests,0);
});


test('header toolbar switch hides Listening controls independently while preserving the mounted media and current work',()=>{
  const initializer=source.match(/vm\.showListeningToolbar\s*=\s*true\s*;/);assert.ok(initializer,'toolbar starts visible');
  const bar=openingTags('idp-instruction-bar')[0];assert.ok(bar);
  const hide=attribute(bar,'ng-hide');
  const header=view.slice(view.indexOf('class="idp-exam-topbar"'),view.indexOf('class="portlet bg-white bordered idp-instruction-bar"'));
  const toggle=[...header.matchAll(/<input\b[^>]*>/g)].map(match=>match[0]).find(tag=>/ng-model="vm\.showListeningToolbar"/.test(tag));
  assert.ok(toggle,'the toolbar switch is in the exam header beside the title');
  assert.equal(attribute(toggle,'type'),'checkbox');assert.equal(attribute(toggle,'role'),'switch');
  assert.doesNotMatch(toggle,/\bng-(?:change|click)=/,'a display toggle does not invoke media or save handlers');
  const toggleLabel=header.slice(header.lastIndexOf('<label',header.indexOf(toggle)),header.indexOf(toggle));
  assert.match(toggleLabel,/ng-if="vm\.isListeningRoute"/,'the header switch is available in both Listening modes');
  assert.doesNotMatch(toggleLabel,/isStudyMode|testSessionMode/);
  assert.match(header,/vm\.ieltsReadingActualTest\.title/,'header shows the actual test title');
  for(const tag of [bar,...openingTags('idp-listening-toolbar'),...openingTags('idp-listening-player')]){
    assert.doesNotMatch(tag,/\bng-if=/,'the toolbar and player stay mounted');
  }
  const audioTag=view.match(/<audio\b[^>]*\bid="main-audio"[^>]*>/);assert.ok(audioTag);assert.doesNotMatch(audioTag[0],/\bng-if=/);
  assert.doesNotMatch(view.slice(view.indexOf(bar),view.indexOf(audioTag[0])),/\bng-if=/,'no conditional ancestor removes audio when the toolbar is hidden');
  for(const mode of['STUDY','SERIOUS'])for(const showAudio of[false,true])for(const content of[false,true]){
    const f=fixture({mode}),audio=f.audio,answers=plain(f.vm.testResult),notes=plain(f.vm.annotationNotes);
    nodeVm.runInContext(initializer[0],f.c);f.vm.passageNumber=1;f.vm.showAudio=showAudio;f.vm.showListeningContent=content;
    f.vm.playbackValue=1.7;audio.playbackRate=1.7;audio.defaultPlaybackRate=1.7;
    assert.equal(!!evaluate(hide,f),false);
    for(const visible of[false,true,false,true]){
      f.vm.showListeningToolbar=visible;assert.equal(!!evaluate(hide,f),!visible);
      assert.equal(f.vm.showAudio,showAudio);assert.equal(f.vm.showListeningContent,content);
      assert.equal(f.c.document.getElementById('main-audio'),audio);assert.equal(audio.currentTime,18.5);
      assert.equal(audio.playbackRate,1.7);assert.equal(audio.defaultPlaybackRate,1.7);assert.equal(f.vm.playbackValue,1.7);
      assert.deepEqual(plain(f.vm.testResult),answers);assert.deepEqual(plain(f.vm.annotationNotes),notes);
    }
    assert.equal(f.log.loads+f.log.plays+f.log.pauses+f.log.requests,0);
    f.vm.isListeningRoute=false;f.vm.showListeningToolbar=false;assert.equal(!!evaluate(hide,f),false,'other test instructions remain visible');
    f.vm.passageNumber=4;assert.equal(!!evaluate(hide,f),true,'the result screen still hides instructions');
  }
});
