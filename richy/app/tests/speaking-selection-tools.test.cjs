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

test('a Speaking tap starts synthesis during the gesture and replaces a pending request',()=>{
 const f = speechFixture(), previous = {}, current = {};
 f.api.speak('Queued from elsewhere', {owner:previous});
 assert.equal(f.timers.size, 1);
 let gestureActive = true;
 const speak = f.synthesis.speak;
 f.synthesis.speak = utterance => {
  assert.equal(gestureActive, true);
  speak(utterance);
 };
 assert.equal(f.api.speak('Read the selected text', {owner:current, immediate:true}), true);
 gestureActive = false;
 f.flush();
 assert.deepEqual(f.spoken.map(utterance => utterance.text), ['Read the selected text']);
 assert.equal(f.api.cancel(previous), false);
 assert.equal(f.api.cancel(current), true);
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

function editorFixture(touch=false, mobile={}){
 let definition,identity,destroy,selected='memorising',inside=true,rangeClears=0,changes=0,saves=0,owner=null;const requests=[],cancelled=[],opened=[],timers=new Map(),listeners={};let timerId=0;
 const module={factory(){return this;},directive(name,dep){if(name==='speakingStudentAnswerEditor'){definition=dep.at(-1);}return this;}};
 vm.runInNewContext(fs.readFileSync(path.join(app,'question/business/speaking-student-answer-editor.js'),'utf8'),{angular:{module:()=>module,noop(){}},JSON,Date,Number,Array,Math});
 const bounds={left:20,top:12,bottom:30};
 const textNode=node('#text','memorising'),range={commonAncestorContainer:textNode,startContainer:textNode,endContainer:textNode,startOffset:0,get endOffset(){return textNode.nodeValue.length;},collapsed:false,toString:()=>selected,cloneRange(){return this;},intersectsNode:target=>target===textNode||target.contains(textNode),getBoundingClientRect:()=>bounds};
 const selection={rangeCount:1,toString:()=>selected,getRangeAt:()=>range,removeAllRanges(){rangeClears++;this.rangeCount=0;},addRange(){this.rangeCount=1;}};
 const editable=node('DIV'),nativeContains=editable.contains;editable.appendChild(textNode);Object.defineProperty(editable,'innerHTML',{get:()=>editable.childNodes.map(child=>child.nodeType===3?child.nodeValue:'<'+child.nodeName.toLowerCase()+(child.className?' class="'+child.className+'"':'')+Object.entries(child.attrs).map(([key,text])=>' '+key+'="'+text+'"').join('')+'>'+child.innerHTML+'</'+child.nodeName.toLowerCase()+'>').join(''),set(text){editable.childNodes.splice(0);textNode.nodeValue=text;editable.appendChild(textNode);}});
 editable.contains=target=>inside&&nativeContains.call(editable,target);editable.focus=()=>{};editable.addEventListener=(name,fn)=>listeners[name]=fn;editable.removeEventListener=()=>{};
 const root = node('SPEAKING-STUDENT-ANSWER-EDITOR');
 root.appendChild(editable);
 root.querySelector = selector => selector === '.sp-answer-editable' ? editable : null;
 const doc={hidden:false,documentElement:{clientWidth:1024,clientHeight:768},createElement:name=>node(name.toUpperCase()),createTreeWalker(parent){const texts=[];function walk(current){if(current.nodeType===3){texts.push(current);}else{current.childNodes.forEach(walk);}}walk(parent);let index=0;return{nextNode:()=>texts[index++]||null};},addEventListener(name,fn){listeners[name]=fn;},removeEventListener(){}};
 const speech={isSupported:()=>true,speak(text,options){owner=options.owner;requests.push({text,options});return true;},cancel(target){if(owner===target){cancelled.push(target);owner=null;return true;}return false;}};
 const win={document:doc,innerWidth:1024,innerHeight:768,EnglishSpeech:speech,open(...args){opened.push(args);},getSelection:()=>selection,addEventListener(){},removeEventListener(){}};
 if(touch){win.matchMedia=()=>({matches:true});win.CSS={highlights:new Map()};win.Highlight=function(value){this.range=value;};win.visualViewport={offsetTop:0,offsetLeft:0,width:1024,height:768,addEventListener(){},removeEventListener(){}};}
 const state={ready:true,loading:false,dirty:false,html:mobile.text || 'memorising',notes:[],history:{versions:[]}};
 const session={state,load:()=>Promise.resolve(),save(){saves++;return Promise.resolve();},change(html,notes){changes++;state.html=html;state.notes=notes;state.dirty=true;},destroy(){},backup(){}};
 const timeout=(fn,delay)=>{const key=++timerId;timers.set(key,{fn,delay});return key;};timeout.cancel=key=>timers.delete(key);
 const scope={readOnly:!!mobile.readOnly,canSaveVocabulary:!!mobile.saveVocabulary,saveVocabulary:mobile.saveVocabulary,$evalAsync:fn=>fn(),$watchGroup(names,fn){identity=fn;},$on(name,fn){destroy=fn;}};
 const classes = new Set();
 editable.classList = {add: name => classes.add(name), remove: name => classes.delete(name),
  toggle(name, on) { if (on) { classes.add(name); } else { classes.delete(name); } }};
 editable.focus = () => { doc.activeElement = editable; };
 editable.blur = () => { doc.activeElement = null; };
 if (mobile.text) {
  selection.rangeCount = 0;
  editable.getBoundingClientRect = () => ({top:70,bottom:660,left:0,right:350});
  win.navigator = {platform:mobile.platform || 'MacIntel',maxTouchPoints:5};
  if (mobile.legacy) { delete win.CSS; delete win.Highlight; }
  function caretAt(x) { return Math.min(textNode.nodeValue.length, Math.max(0, Math.round((x - 20) / 8))); }
  function rectFor(start, end) { return {left:20 + start * 8, right:20 + end * 8, top:bounds.top, bottom:bounds.bottom}; }
  if (mobile.legacy) {
   doc.caretRangeFromPoint = x => ({startContainer:textNode,startOffset:classes.has('is-finding-caret') ? caretAt(x) : 0});
  } else { doc.caretPositionFromPoint = x => ({offsetNode:textNode,offset:caretAt(x)}); }
  doc.createRange = function () {
   return {
    commonAncestorContainer:textNode,startContainer:textNode,endContainer:textNode,startOffset:0,endOffset:0,
    setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
    setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
    selectNodeContents() { this.endOffset = textNode.nodeValue.length; },
    collapse() { this.startOffset = this.endOffset; },
    comparePoint(node, offset) { return offset < this.startOffset ? -1 : offset > this.endOffset ? 1 : 0; },
    cloneRange() { return {...this}; },
    intersectsNode(node) { return node === textNode; },
    getBoundingClientRect() { return rectFor(this.startOffset,this.endOffset); },
    getClientRects() { return [this.getBoundingClientRect()]; },
    toString() { return textNode.nodeValue.slice(this.startOffset,this.endOffset); }
   };
  };
  selection.getRangeAt = () => selection.activeRange || range;
  selection.addRange = newRange => { selection.activeRange = newRange; selection.rangeCount = 1; };
  selection.toString = () => selection.activeRange ? selection.activeRange.toString() : '';
 }
 const directive=definition(win,timeout,{open:()=>session});directive.link(scope,[root]);
 return{scope,state,requests,cancelled,opened,speech,win,doc,directive,timers,identity,destroy,root,editable,range,bounds,listeners,classes,selection,select(text,valid=true){selected=text;inside=valid;selection.rangeCount=1;listeners[touch?'touchend':'mouseup']();},existingNote(){const span=node('SPAN'),bold=node('B');span.className='ielts-annotation has-note is-highlighted';span.setAttribute('data-note-id','existing-note');span.setAttribute('data-annotation-group','existing-group');editable.insertBefore(span,textNode);span.appendChild(bold);bold.appendChild(textNode);state.notes=[{id:'existing-note',text:'Keep this teacher note'}];state.html=editable.innerHTML;return span;},steal(){owner={external:true};},get rangeClears(){return rangeClears;},get changes(){return changes;},get saves(){return saves;}};
}

function touchEvent(type, x, y) {
 const finger = {identifier:1,clientX:x,clientY:y};
 return {type,touches:type === 'touchend' ? [] : [finger],changedTouches:[finger],cancelable:true,
  prevented:false,preventDefault() { this.prevented = true; }};
}
function runEditorTimer(fixture, delay) {
 const pending = [...fixture.timers].find(([,timer]) => timer.delay === delay);
 if (!pending) { return false; }
 fixture.timers.delete(pending[0]); pending[1].fn(); return true;
}

test('Saving selected Speaking text confirms the word in place and leaves the answer untouched', async () => {
 const calls = [];
 const f = editorFixture(false, {saveVocabulary: payload => {
  calls.push(payload.word);
  return Promise.resolve({alreadyExists:false});
 }});
 f.identity([11,7,42,9]); await settle();
 f.select('take    part');
 const word = f.scope.ed.selectionVocabulary;
 assert.equal(word.word, 'take part');
 const save = f.scope.ed.saveSelectionVocabulary();
 assert.equal(word.status, 'saving');
 assert.equal(f.scope.ed.saveSelectionVocabulary(), undefined);
 await save;
 assert.equal(word.status, 'saved');
 assert.equal(f.scope.ed.hasSelection, true);
 assert.deepEqual(calls, ['take part']);
 assert.equal(f.changes, 0);
 assert.equal(f.saves, 0);
 f.destroy();

 const shared = editorFixture();
 shared.identity([11,7,42,9]); await settle();
 shared.select('take part');
 assert.equal(shared.scope.ed.selectionVocabulary, null);
 shared.destroy();
});

test('iPhone touch selection paints and reads the English range even if the browser selects the nearby hint',async()=>{
 const f = editorFixture(true, {text:'Playing or experimenting today',platform:'iPhone'});
 const ed = f.scope.ed;
 f.identity([11,7,42,9]); await settle();
 Object.assign(f.win.visualViewport,{offsetTop:80,offsetLeft:0,width:380,height:470});
 Object.assign(f.bounds,{top:340,bottom:360});
 assert.equal(f.editable.getAttribute('contenteditable'),'false');
 assert.equal(f.classes.has('is-touch-select'),true);
 const contextMenu = touchEvent('contextmenu',130,350); f.listeners.contextmenu(contextMenu);
 assert.equal(contextMenu.prevented,true);
 f.listeners.touchstart(touchEvent('touchstart',130,350)); assert.equal(runEditorTimer(f,400),true);
 assert.equal(ed.selectionStyle.top,'368px'); assert.equal(ed.selectionStyle.transform,'none');
 assert.equal(ed.selectionRects[0].left,'108px'); assert.equal(ed.selectionRects[0].width,'104px');
 const expand = touchEvent('touchmove',268,350); f.listeners.touchmove(expand);
 const finish = touchEvent('touchend',268,350); f.listeners.touchend(finish); f.listeners.selectionchange();
 assert.equal(expand.prevented,true); assert.equal(finish.prevented,true);
 assert.equal(f.selection.rangeCount,0); assert.equal(f.doc.activeElement,undefined);
 assert.equal(f.win.CSS.highlights.size,0);
 assert.equal(ed.selectionRects[0].width,'152px');
 const hint = f.root.appendChild(node('SMALL')).appendChild(node('#text','Nhấn giữ một từ rồi kéo để chọn cả đoạn.'));
 f.selection.addRange({commonAncestorContainer:hint,collapsed:false});
 f.listeners.selectionchange();
 assert.equal(f.selection.rangeCount,0); assert.equal(f.rangeClears,1);
 assert.equal(ed.hasSelection,true); assert.equal(ed.selectionRects[0].width,'152px');
 assert.equal(f.changes,0); assert.equal(f.state.html,'Playing or experimenting today');
 ed.readSelection(); assert.equal(f.requests[0].text,'experimenting today');
 assert.equal(f.requests[0].options.immediate,true);
 ed.toggleEditing();
 assert.equal(f.doc.activeElement,f.editable); assert.equal(f.editable.getAttribute('contenteditable'),'true');
 assert.equal(f.selection.activeRange.startOffset,f.state.html.length);
 assert.equal(ed.selectionRects.length,0);
 const editMenu = touchEvent('contextmenu',130,350); f.listeners.contextmenu(editMenu); assert.equal(editMenu.prevented,false);
 ed.toggleEditing();
 assert.equal(f.doc.activeElement,null); assert.equal(f.editable.getAttribute('contenteditable'),'false');
 assert.equal(f.selection.rangeCount,0); f.destroy();
});

test('touch scroll cancels a pending hold and older WebKit can paint an unsaved range',async()=>{
 const f = editorFixture(true, {text:'Stay on task',legacy:true});
 f.identity([11,7,42,9]); await settle();
 Object.assign(f.bounds,{top:110,bottom:130});
 f.listeners.touchstart(touchEvent('touchstart',35,120));
 const scroll = touchEvent('touchmove',35,151); f.listeners.touchmove(scroll);
 assert.equal(scroll.prevented,false); assert.equal(runEditorTimer(f,400),false);
 f.listeners.touchstart(touchEvent('touchstart',56,120)); assert.equal(runEditorTimer(f,400),true);
 assert.equal(f.scope.ed.hasSelection,true); assert.equal(f.classes.has('is-finding-caret'),false);
 assert.equal(JSON.stringify(f.scope.ed.selectionRects),JSON.stringify([{left:'60px',top:'110px',width:'16px',height:'20px'}]));
 assert.equal(f.selection.rangeCount,0); assert.equal(f.changes,0);
 f.listeners.touchcancel(touchEvent('touchcancel',56,120));
 assert.equal(f.scope.ed.hasSelection,false); assert.equal(f.scope.ed.selectionRects.length,0); f.destroy();
});

test('touch selection keeps its toolbar by the text after the native range is cleared',async()=>{
 const f=editorFixture(true);f.identity([11,7,42,9]);await settle();
 Object.assign(f.win.visualViewport,{offsetTop:240,offsetLeft:100,width:500,height:370});
 Object.assign(f.bounds,{left:330,top:550,bottom:570});
 f.select('memorising');
 assert.equal(f.scope.ed.selectionStyle.top,'542px');
 assert.equal(f.scope.ed.selectionStyle.transform,'translateY(-100%)');
 const [key,timer]=[...f.timers].find(([,value])=>value.delay===180);f.timers.delete(key);timer.fn();f.listeners.selectionchange();
 assert.equal(f.rangeClears,1);assert.equal(f.scope.ed.hasSelection,true);
 assert.equal(f.win.CSS.highlights.get('speaking-touch-selection').range,f.range);
 assert.equal(f.changes,0);
 let blocked=false;f.listeners.contextmenu({cancelable:true,preventDefault(){blocked=true;}});assert.equal(blocked,true);
 Object.assign(f.bounds,{top:320,bottom:340});f.listeners.scroll();
 assert.equal(f.scope.ed.selectionStyle.top,'348px');assert.equal(f.scope.ed.selectionStyle.transform,'none');
 f.scope.ed.annotate(true);
 assert.equal(f.state.notes.length,1);assert.equal(f.scope.ed.hasSelection,false);assert.equal(f.win.CSS.highlights.size,0);
 f.destroy();
});

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
 assert.deepEqual(f.opened,[['https://dictionary.cambridge.org/dictionary/english/memorising','_blank','noopener,noreferrer']]);
 assert.equal(f.state.notes.length,1);assert.equal(f.scope.ed.activeNote.id,f.state.notes[0].id);assert.equal(f.scope.ed.lookupText,'memorising');assert.match(f.state.html,/data-note-id=/);assert.match(f.state.html,/>memorising<\/span>/);
 assert.equal(f.scope.ed.cambridgeUrl(),'https://dictionary.cambridge.org/dictionary/english/memorising');
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
 f.scope.ed.lookupText='we\'re <ready> & done';assert.equal(decodeURIComponent(new URL(f.scope.ed.cambridgeUrl()).pathname),"/dictionary/english/we're-<ready>-&-done");f.identity([11,7,43,9]);assert.equal(f.scope.ed.lookupText,'');assert.equal(f.scope.ed.activeNote,null);f.destroy();
});

test('Cambridge links place words and phrases in the entry path without query or fragment injection',async()=>{
 const f=editorFixture();f.identity([11,7,42,9]);await settle();
 for(const [text,entry] of [['  MEMORISING  ','memorising'],[' Look \n up ','look-up'],['what? #/ & why','what?-#/-&-why']]){
  f.scope.ed.lookupText=text;const url=new URL(f.scope.ed.cambridgeUrl());
  assert.equal(url.origin,'https://dictionary.cambridge.org');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(decodeURIComponent(url.pathname),'/dictionary/english/'+entry);
 }
 assert.equal(f.changes,0);assert.equal(f.saves,0);f.destroy();
});

test('question speaker uses the current English prompt and cancels only its own speech', () => {
 const requests=[], cancelled=[];let definition, onChange, onDestroy;
 const module={factory(){return this;},directive(name,dep){if(name==='speakingQuestionSpeaker'){definition=dep.at(-1);}return this;}};
 vm.runInNewContext(fs.readFileSync(path.join(app,'question/business/speaking-student-answer-editor.js'),'utf8'),{angular:{module:()=>module}});
 const speech={isSupported:()=>true,speak(text,options){requests.push({text,options});return true;},cancel(owner){cancelled.push(owner);}};
 const scope={text:'Do you think car colours are important?',$evalAsync:fn=>fn(),$watch(name,fn){onChange=fn;},$on(name,fn){onDestroy=fn;}};
 const speaker=definition({EnglishSpeech:speech});
 speaker.link(scope);scope.readQuestion();
 assert.equal(requests[0].text,scope.text);assert.equal(requests[0].options.lang,'en-GB');assert.equal(requests[0].options.plainText,true);
 assert.equal(requests[0].options.immediate,true);
 onChange();requests[0].options.onerror({error:'old-error'});assert.equal(scope.speechError,'');
 scope.text='What car would you choose?';scope.readQuestion();assert.equal(requests[1].text,scope.text);
 onDestroy();assert.equal(cancelled.length,2);assert.equal(cancelled[1],requests[1].options.owner);
});
