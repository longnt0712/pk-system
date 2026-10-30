const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=path.join(__dirname,'..');
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};

function speechFixture(){
 const timers=new Map(),spoken=[];let id=0,cancels=0,htmlParses=0;
 const synthesis={speaking:false,pending:false,getVoices:()=>[],addEventListener(){},resume(){},cancel(){cancels++;},speak(utterance){spoken.push(utterance);}};
 const doc={createElement(){htmlParses++;return{set innerHTML(text){this.textContent=String(text).replace(/<[^>]*>/g,'');}};},addEventListener(){},removeEventListener(){}};
 const win={speechSynthesis:synthesis,SpeechSynthesisUtterance:function(text){this.text=text;},setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout(key){timers.delete(key);}};
 vm.runInNewContext(fs.readFileSync(path.join(app,'common/utils/english-speech.js'),'utf8'),{window:win,document:doc});
 return{api:win.EnglishSpeech,spoken,synthesis,timers,get cancels(){return cancels;},get htmlParses(){return htmlParses;},flush(){const queued=[...timers.values()];timers.clear();queued.forEach(fn=>fn());}};
}

test('scoped speech cancellation preserves another pending or active request and legacy global stop still works',()=>{
 const f=speechFixture(),first={},second={};
 assert.equal(f.api.speak('memorising',{owner:first,lang:'en-GB'}),true);
 assert.equal(f.api.cancel(second),false);assert.equal(f.timers.size,1);f.flush();assert.equal(f.spoken.length,1);assert.equal(f.spoken[0].lang,'en-GB');
 f.api.speak('another word',{owner:second});const before=f.cancels;
 assert.equal(f.api.cancel(first),false);assert.equal(f.cancels,before);assert.equal(f.timers.size,1);
 f.flush();assert.equal(f.spoken.length,2);assert.equal(f.api.cancel(second),true);assert.equal(f.cancels,before+1);
 f.api.speak('legacy caller');assert.equal(f.api.cancel(first),false);assert.equal(f.api.cancel(),true);assert.equal(f.timers.size,0);
});

test('a late speech completion cannot release ownership of its replacement and synthesis failures are reported',()=>{
 const f=speechFixture(),first={},second={};let error;
 f.api.speak('first',{owner:first});f.flush();const old=f.spoken[0];
 f.api.speak('second',{owner:second,interrupt:false});old.onend();
 assert.equal(f.api.cancel(first),false);assert.equal(f.api.cancel(second),true);assert.equal(f.timers.size,0);
 f.synthesis.speak=()=>{throw Error('Device unavailable');};
 f.api.speak('failed',{owner:first,onerror:value=>error=value});f.flush();assert.equal(error.error,'synthesis-failed');assert.equal(f.api.cancel(first),false);
});

test('selected plain text bypasses HTML parsing even when it contains literal markup',()=>{
 const f=speechFixture(),literal='<img src=x onerror=alert(1)> memorising';
 f.api.speak(literal,{plainText:true});f.flush();assert.equal(f.spoken[0].text,literal);assert.equal(f.htmlParses,0);
});

function node(name,value=''){
 const attrs={},children=[];
 const result={nodeName:name,nodeType:name==='#text'?3:1,nodeValue:value,childNodes:children,parentNode:null,className:'',
  setAttribute(key,text){attrs[key]=text;},getAttribute:key=>attrs[key]||null,removeAttribute:key=>delete attrs[key],
  contains(target){return this===target||children.some(child=>child.contains(target));},
  appendChild(child){if(child.parentNode){child.parentNode.removeChild(child);}children.push(child);child.parentNode=this;return child;},
  insertBefore(child,before){if(child.parentNode){child.parentNode.removeChild(child);}children.splice(children.indexOf(before),0,child);child.parentNode=this;return child;},
  removeChild(child){children.splice(children.indexOf(child),1);child.parentNode=null;return child;},
  get firstChild(){return children[0]||null;},get textContent(){return name==='#text'?this.nodeValue:children.map(child=>child.textContent).join('');},
  getBoundingClientRect:()=>({top:20,bottom:40,left:20}),
  querySelectorAll(selector){const found=[];function walk(current){for(const child of current.childNodes){if(child.nodeName==='SPAN'&&(selector==='span.ielts-annotation'?child.className.includes('ielts-annotation'):!!child.getAttribute('data-note-id'))){found.push(child);}walk(child);}}walk(this);return found;},
  get innerHTML(){return children.map(child=>child.nodeType===3?child.nodeValue:'<'+child.nodeName.toLowerCase()+(child.className?' class="'+child.className+'"':'')+Object.entries(child.attrs).map(([key,text])=>' '+key+'="'+text+'"').join('')+'>'+child.innerHTML+'</'+child.nodeName.toLowerCase()+'>').join('');},
  attrs};
 return result;
}

function editorFixture(){
 let definition,identity,destroy,selected='memorising',inside=true,rangeClears=0,changes=0,saves=0,owner=null;const requests=[],cancelled=[],timers=new Map(),listeners={};let timerId=0;
 const module={factory(){return this;},directive(name,dep){definition=dep.at(-1);return this;}};
 vm.runInNewContext(fs.readFileSync(path.join(app,'question/business/speaking-student-answer-editor.js'),'utf8'),{angular:{module:()=>module},JSON,Date,Number,Array,Math});
 const textNode=node('#text','memorising'),range={commonAncestorContainer:textNode,startContainer:textNode,endContainer:textNode,startOffset:0,get endOffset(){return textNode.nodeValue.length;},collapsed:false,toString:()=>selected,cloneRange(){return this;},intersectsNode:target=>target===textNode||target.contains(textNode),getBoundingClientRect:()=>({left:20,bottom:30})};
 const selection={rangeCount:1,toString:()=>selected,getRangeAt:()=>range,removeAllRanges(){rangeClears++;},addRange(){}};
 const editable=node('DIV'),nativeContains=editable.contains;editable.appendChild(textNode);Object.defineProperty(editable,'innerHTML',{get:()=>editable.childNodes.map(child=>child.nodeType===3?child.nodeValue:'<'+child.nodeName.toLowerCase()+(child.className?' class="'+child.className+'"':'')+Object.entries(child.attrs).map(([key,text])=>' '+key+'="'+text+'"').join('')+'>'+child.innerHTML+'</'+child.nodeName.toLowerCase()+'>').join(''),set(text){editable.childNodes.splice(0);textNode.nodeValue=text;editable.appendChild(textNode);}});
 editable.contains=target=>inside&&nativeContains.call(editable,target);editable.focus=()=>{};editable.addEventListener=(name,fn)=>listeners[name]=fn;editable.removeEventListener=()=>{};
 const root={querySelector:()=>editable,contains:()=>true},doc={hidden:false,documentElement:{clientWidth:1024,clientHeight:768},createElement:name=>node(name.toUpperCase()),createTreeWalker(parent){const texts=[];function walk(current){if(current.nodeType===3){texts.push(current);}else{current.childNodes.forEach(walk);}}walk(parent);let index=0;return{nextNode:()=>texts[index++]||null};},addEventListener(){},removeEventListener(){}};
 const speech={isSupported:()=>true,speak(text,options){owner=options.owner;requests.push({text,options});return true;},cancel(target){if(owner===target){cancelled.push(target);owner=null;return true;}return false;}};
 const win={document:doc,innerWidth:1024,innerHeight:768,EnglishSpeech:speech,getSelection:()=>selection,addEventListener(){},removeEventListener(){}};
 const state={ready:true,loading:false,dirty:false,html:'memorising',notes:[],history:{versions:[]}};
 const session={state,load:()=>Promise.resolve(),save(){saves++;return Promise.resolve();},change(html,notes){changes++;state.html=html;state.notes=notes;state.dirty=true;},destroy(){},backup(){}};
 const timeout=(fn,delay)=>{const key=++timerId;timers.set(key,{fn,delay});return key;};timeout.cancel=key=>timers.delete(key);
 const scope={$evalAsync:fn=>fn(),$watchGroup(names,fn){identity=fn;},$on(name,fn){destroy=fn;}};
 const directive=definition(win,timeout,{open:()=>session});directive.link(scope,[root]);
 return{scope,state,requests,cancelled,speech,win,directive,timers,identity,destroy,editable,range,select(text,valid=true){selected=text;inside=valid;listeners.mouseup();},existingNote(){const span=node('SPAN'),bold=node('B');span.className='ielts-annotation has-note is-highlighted';span.setAttribute('data-note-id','existing-note');span.setAttribute('data-annotation-group','existing-group');editable.insertBefore(span,textNode);span.appendChild(bold);bold.appendChild(textNode);state.notes=[{id:'existing-note',text:'Keep this teacher note'}];state.html=editable.innerHTML;return span;},steal(){owner={external:true};},get rangeClears(){return rangeClears;},get changes(){return changes;},get saves(){return saves;}};
}

test('selection speaker reads the exact selected phrase without moving the caret or changing notes and toggles stop',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.select('  memorising\n theory  ');f.scope.ed.readSelection();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].text,'memorising theory');assert.equal(f.requests[0].options.lang,'en-GB');assert.equal(f.requests[0].options.plainText,true);assert.equal(f.scope.ed.speaking,true);
 assert.equal(f.rangeClears,0);assert.equal(f.changes,0);assert.equal(f.saves,0);assert.deepEqual(f.state.notes,[]);
 f.scope.ed.readSelection();assert.equal(f.cancelled.length,1);assert.equal(f.scope.ed.speaking,false);f.destroy();assert.equal(f.timers.size,0);
});

test('context changes and teardown cancel only owned speech and ignore late callbacks',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.select('memorising');f.scope.ed.readSelection();const old=f.requests[0];
 f.identity([11,7,43,9]);await settle();assert.equal(f.cancelled.length,1);assert.equal(f.scope.ed.speaking,false);
 f.select('learning');f.scope.ed.readSelection();old.options.onerror({error:'network'});assert.equal(f.scope.ed.speaking,true);assert.equal(f.scope.ed.speechError,'');
 f.steal();f.destroy();assert.equal(f.cancelled.length,1);f.requests[1].options.onerror({error:'network'});assert.equal(f.scope.ed.speechError,'');
});

test('unsupported or failed speech leaves the answer writable and rejects detached or empty selections',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.select('word',false);f.scope.ed.readSelection();assert.equal(f.requests.length,0);
 f.select('  ');f.scope.ed.readSelection();assert.equal(f.requests.length,0);
 f.select('memorising');f.speech.isSupported=()=>false;f.scope.ed.readSelection();assert.match(f.scope.ed.speechError,/chưa hỗ trợ/);assert.equal(f.scope.ed.speaking,false);
 f.speech.isSupported=()=>true;f.scope.ed.readSelection();f.requests[0].options.onerror({error:'voice-unavailable'});assert.match(f.scope.ed.speechError,/Chưa đọc được/);assert.equal(f.scope.ed.speaking,false);assert.equal(f.state.ready,true);assert.equal(f.changes,0);f.destroy();
});

test('manual IPA creates an anchored note and pasted phonetic uses the same autosave without altering the answer',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.select('memorising');f.scope.ed.addPhonetic();
 assert.equal(f.state.notes.length,1);assert.equal(f.scope.ed.activeNote.id,f.state.notes[0].id);assert.equal(f.scope.ed.lookupText,'memorising');assert.match(f.state.html,/data-note-id=/);assert.match(f.state.html,/>memorising<\/span>/);
 assert.equal(f.scope.ed.cambridgeUrl(),'https://dictionary.cambridge.org/dictionary/english/?q=memorising');
 const html=f.state.html;f.scope.ed.activeNote.text='UK /ˈmem.ə.raɪz/';f.scope.ed.noteChanged();assert.equal(f.state.notes[0].text,'UK /ˈmem.ə.raɪz/');assert.equal(f.state.html,html);assert.ok([...f.timers.values()].some(timer=>timer.delay===1300));assert.equal(f.saves,0);
 assert.match(f.directive.template,/target="_blank" rel="noopener noreferrer"/);assert.match(f.directive.template,/Ghi chú tự lưu/);assert.doesNotMatch(f.directive.template,/Lưu phiên âm|Lưu ghi chú/);f.destroy();
});

test('adding IPA inside an existing note reuses its anchor without overwriting note text, bold or highlighting',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.existingNote();const html=f.state.html;
 f.select('memorising');f.scope.ed.addPhonetic();assert.equal(f.state.notes.length,1);assert.equal(f.scope.ed.activeNote.id,'existing-note');assert.equal(f.scope.ed.activeNote.text,'Keep this teacher note');assert.equal(f.state.html,html);assert.equal(f.changes,0);
 f.scope.ed.activeNote.text+='\nUS /ˈmem.ə.raɪz/';f.scope.ed.noteChanged();assert.equal(f.state.notes[0].text,'Keep this teacher note\nUS /ˈmem.ə.raɪz/');assert.match(f.state.html,/<b>memorising<\/b>/);assert.match(f.state.html,/is-highlighted/);assert.equal(f.state.notes.length,1);f.destroy();
});

test('mixed note selections are rejected safely and small screens keep the phonetic note within the viewport',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();f.existingNote();const html=f.state.html;
 f.range.commonAncestorContainer=f.editable;f.select('memorising and more');f.scope.ed.addPhonetic();assert.match(f.scope.ed.phoneticError,/đang chứa ghi chú/);assert.equal(f.state.html,html);assert.equal(f.changes,0);
 f.range.commonAncestorContainer=f.range.startContainer;f.win.innerWidth=320;f.win.innerHeight=240;f.select('memorising');assert.ok(parseFloat(f.scope.ed.selectionStyle.top)+parseFloat(f.scope.ed.selectionStyle.maxHeight)<=232);f.scope.ed.addPhonetic();const top=parseFloat(f.scope.ed.noteStyle.top),height=parseFloat(f.scope.ed.noteStyle.maxHeight);assert.ok(top>=8);assert.ok(top+height<=232);assert.equal(parseFloat(f.scope.ed.noteStyle.left),8);
 f.scope.ed.lookupText='we\'re <ready> & done';assert.equal(new URL(f.scope.ed.cambridgeUrl()).searchParams.get('q'),"we're <ready> & done");f.identity([11,7,43,9]);assert.equal(f.scope.ed.lookupText,'');assert.equal(f.scope.ed.activeNote,null);f.destroy();
});
