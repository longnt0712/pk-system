const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=path.join(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync(path.join(app,'question/business/speaking-question-notebook.js'),'utf8');
const context={setId:11,studentId:7,questionId:42,userId:9};
const blank=()=>({text:'',orientation:'portrait',pattern:'lined',strokes:[]});
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(setImmediate);};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 let definition,wrapper,next=0,actor=9,remote={...context,revision:0,document:blank()},getOverride,saveOverride;
 const timers=new Map(),storage=new Map(),calls={get:[],save:[]},listeners=new Map(),docListeners=new Map();
 const add=(map,name,fn)=>{if(!map.has(name))map.set(name,new Set());map.get(name).add(fn);},remove=(map,name,fn)=>(map.get(name)||new Set()).delete(fn);
 const window={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{hidden:false,addEventListener:(n,f)=>add(docListeners,n,f),removeEventListener:(n,f)=>remove(docListeners,n,f)},addEventListener:(n,f)=>add(listeners,n,f),removeEventListener:(n,f)=>remove(listeners,n,f)};
 const timeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};timeout.cancel=id=>timers.delete(id);
 const api={speakingNotebook(...args){calls.get.push(args);if(getOverride)return getOverride(...args);return Promise.resolve(args[3]===remote.revision?{...context,revision:remote.revision,changed:false}:{...plain(remote),changed:true});},saveSpeakingNotebook(payload){calls.save.push(plain(payload));if(saveOverride)return saveOverride(payload);remote={...context,revision:remote.revision+1,document:plain(payload.document)};return Promise.resolve(plain(remote));}};
 const angular={module:()=>({factory(name,d){definition=d.at(-1);return this;},directive(name,d){wrapper=d.at(-1);return this;}})};
 vm.runInNewContext(source,{angular,JSON,Date,Math,Number,Array,isFinite});
 const store=definition(window,timeout,{when:Promise.resolve.bind(Promise)},{get:()=>JSON.stringify({id:actor})},api);
 return{store,wrapper,window,timers,storage,calls,listeners,docListeners,session(identity=context){return store.open(identity);},setActor(id){actor=id;},remote:()=>remote,setRemote(value){remote=plain(value);},setGet(fn){getOverride=fn;},setSave(fn){saveOverride=fn;},async run(ms){const batch=[...timers].filter(([,t])=>t.ms===ms);for(const[id,t]of batch){timers.delete(id);t.fn();}await tick();},async fire(name,doc=false){for(const fn of(doc?docListeners:listeners).get(name)||[])fn();await tick();}};
}
test('shared A4 notes autosave text and pen strokes together with exact identity and no sample fields',async()=>{
 const f=fixture(),s=f.session();await s.ready;s.document.text='Student ideas';s.document.strokes=[{id:'ink1',tool:'pen',color:'#315bbe',width:4,points:[[10,20,.5],[30,40,.8]]}];s.document.orientation='landscape';s.document.pattern='grid';s.changed();assert.equal(f.calls.save.length,0);assert.equal(f.storage.size,1);await f.run(900);
 assert.equal(f.calls.save.length,1);assert.deepEqual(f.calls.save[0],{setId:11,studentId:7,questionId:42,revision:0,document:plain(s.document)});assert.equal(s.status,'saved');assert.equal(f.storage.size,0);
});
test('visible notebooks receive teacher changes automatically while closed and hidden notebooks do not poll',async()=>{
 const f=fixture(),s=f.session();await s.ready;s.setVisible(true);await tick();f.setRemote({...context,revision:1,document:{...blank(),text:'Teacher correction'}});await f.run(3000);assert.equal(s.document.text,'Teacher correction');
 const calls=f.calls.get.length;f.window.document.hidden=true;await f.run(3000);assert.equal(f.calls.get.length,calls);f.window.document.hidden=false;await f.fire('visibilitychange',true);assert.equal(f.calls.get.length,calls+1);
 s.setVisible(false);await f.run(3000);assert.equal(f.calls.get.length,calls+1);s.destroy();assert.equal([...f.listeners.values()].reduce((n,set)=>n+set.size,0),0);assert.equal([...f.docListeners.values()].reduce((n,set)=>n+set.size,0),0);
});
test('an incoming note never erases a local edit and conflicts can keep either reviewed version',async()=>{
 const f=fixture(),s=f.session();await s.ready;s.document.text='My draft';s.changed();f.setRemote({...context,revision:1,document:{...blank(),text:'Teacher saved'}});await s.refresh();assert.equal(s.document.text,'My draft');assert.equal(s.status,'conflict');assert.equal(f.calls.save.length,0);
 await s.keepLocal();assert.equal(f.calls.save[0].revision,1);assert.equal(s.document.text,'My draft');assert.equal(s.status,'saved');s.document.text='Second draft';s.changed();f.setRemote({...context,revision:3,document:{...blank(),text:'Teacher latest'}});await s.refresh();await s.useRemote();assert.equal(s.document.text,'Teacher latest');assert.equal(s.status,'saved');assert.ok([...f.storage.keys()].some(k=>k.includes(':previous:')));
});
test('mid-gesture and IME updates are deferred until every interaction has finished, retaining committed ink',async()=>{
 const f=fixture(),s=f.session();await s.ready;const waiting=deferred();f.setGet(()=>waiting.promise);const load=s.refresh();s.setInteraction(true,'pen');s.setInteraction(true,'text');waiting.resolve({...context,revision:1,document:{...blank(),text:'Remote during gesture'}});await load;assert.equal(s.document.text,'');
 s.document.text='Unfinished IME';s.document.strokes=[{id:'stroke',tool:'pen',color:'#111111',width:2,points:[[10,20,.5]]}];s.changed();s.setInteraction(false,'pen');assert.notEqual(s.status,'conflict');s.setInteraction(false,'text');assert.equal(s.status,'conflict');assert.equal(s.document.text,'Unfinished IME');assert.equal(s.document.strokes.length,1);await f.run(900);assert.equal(f.calls.save.length,0);
});
test('wrong identity and malformed acknowledgements never clear the only local draft',async()=>{
 for(const bad of [r=>({...r,studentId:8}),r=>({...r,questionId:43}),r=>({...r,revision:null}),r=>({...r,document:{...r.document,text:'Wrong body'}})]){
  const f=fixture(),s=f.session();await s.ready;s.document.text='Important';s.changed();f.setSave(p=>Promise.resolve(bad({...p,revision:1})));await s.save();assert.equal(s.document.text,'Important');assert.equal(f.storage.size,1);assert.match(s.error,/xác nhận/);assert.notEqual(s.status,'saved');
 }
});
test('later edits survive an in-flight acknowledgement and closing drains the last edit',async()=>{
 const f=fixture(),s=f.session();await s.ready;const waiting=deferred();f.setSave(()=>waiting.promise);s.document.text='First';s.changed();const saving=s.save();s.document.text='Later';s.changed();s.destroy();f.setSave(p=>Promise.resolve({...p,revision:2}));waiting.resolve({...context,revision:1,document:{...blank(),text:'First'}});await saving;await tick();assert.equal(f.calls.save.length,2);assert.equal(f.calls.save[1].document.text,'Later');assert.equal(f.calls.save[1].revision,1);assert.equal(f.storage.size,0);
});
test('drafts recover per actor/student/question and a changed account cannot send another actors notes',async()=>{
 const f=fixture(),s=f.session();await s.ready;s.document.text='Offline words';s.changed();f.setSave(()=>Promise.reject({status:0}));await s.save();s.destroy();await tick();const reopened=f.session();await reopened.ready;assert.equal(reopened.document.text,'Offline words');assert.notEqual(reopened.status,'conflict');
 f.setActor(8);const before=f.calls.save.length;await reopened.save();await reopened.refresh();assert.equal(f.calls.save.length,before);assert.throws(()=>f.session({...context,userId:9}),/không khớp/);const other=f.session({...context,userId:8});await other.ready;assert.equal(other.document.text,'');
});
test('closing during initial loading keeps a recovered draft and its old GET cannot overwrite a newer session backup',async()=>{
 const f=fixture(),key='speaking-notebook:v1:9:11:7:42',waiting=deferred();f.storage.set(key,JSON.stringify({context,revision:0,document:{...blank(),text:'Recovered draft'}}));f.setGet(()=>waiting.promise);
 const old=f.session();assert.equal(old.document.text,'Recovered draft');old.destroy();await tick();assert.equal(JSON.parse(f.storage.get(key)).document.text,'Recovered draft');
 f.setGet(undefined);const next=f.session();await next.ready;next.document.text='Newer session edit';next.changed();waiting.resolve({...context,revision:0,document:blank()});await old.ready;assert.equal(JSON.parse(f.storage.get(key)).document.text,'Newer session edit');assert.equal(next.document.text,'Newer session edit');
});
test('an unchanged conditional refresh retries a failed autosave without requiring a normal Save button',async()=>{
 const f=fixture(),s=f.session();await s.ready;s.document.text='Pending retry';s.changed();f.setSave(()=>Promise.reject({status:0}));await s.save();assert.ok(s.error);f.setSave(p=>Promise.resolve({...p,revision:1}));await s.refresh();await f.run(900);assert.equal(s.status,'saved');assert.equal(f.storage.size,0);
});
test('an older GET completing after a save started cannot conflict with that very same in-flight save',async()=>{
 const f=fixture(),s=f.session();await s.ready;const get=deferred(),put=deferred();f.setGet(()=>get.promise);const reading=s.refresh();s.document.text='Sent';s.changed();f.setSave(()=>put.promise);const saving=s.save();s.document.text='Later';s.changed();get.resolve({...context,revision:1,document:{...blank(),text:'Sent'}});await reading;assert.notEqual(s.status,'conflict');put.resolve({...context,revision:1,document:{...blank(),text:'Sent'}});await saving;assert.equal(s.document.text,'Later');assert.notEqual(s.status,'conflict');
});
test('Speaking notebook wrapper reuses the A4 tools with no normal Save button and is mounted for one selected question only',()=>{
 const f=fixture(),directive=f.wrapper(f.store),html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8'),routes=fs.readFileSync(path.join(app,'question/question.module.js'),'utf8');
 assert.match(directive.template,/session-opener="openSession\(\)"/);assert.match(directive.template,/hide-save="true"/);assert.match(directive.template,/auto-open="true"/);assert.match(directive.template,/Học sinh và giáo viên/);
 assert.match(html,/ng-click="vm.toggleNotebook\(question\)"/);assert.match(html,/> Xem ghi chú</);assert.match(html,/<speaking-question-notebook ng-if="vm.notebookQuestionId===question.id"/);assert.doesNotMatch(html,/ng-if="[^\"]*question.part===2/);assert.match(html,/student-id="vm.answerStudentId\(\)"/);assert.equal((routes.match(/speaking-question-notebook\.js/g)||[]).length,2);
});

test('all three Speaking Parts can mount a notebook for the current student, unknown IDs are blocked and class or Part switches close its context',async()=>{
 function controller(management){
  let constructor;const module={directive(){return this;},controller(name,args){constructor=args.at(-1);return this;}};
  vm.runInNewContext(fs.readFileSync(path.join(app,'question/controllers/SpeakingController.js'),'utf8'),{angular:{module:()=>module,noop(){}},JSON,Date,Math,Number,Array,Uint32Array,FormData});
  const set={id:11,year:2026,ownerId:1,canManage:false,canReviewStudents:true},student={id:7,name:'Student',username:'student',canAccess:true,answerCount:1,firstAnswerQuestionId:42};
  const api={bootstrap:()=>Promise.resolve({userId:9,isAdmin:management,canManage:management,sets:[set],classes:[{id:21,name:'Class',schoolId:1,parentId:null}]}),bank:(id,studentId)=>Promise.resolve({set,studentId:studentId||9,questions:[{id:42,entryId:1,part:2,topic:'Cake',prompt:'Cue card'},{id:43,entryId:2,part:1,topic:'Home',prompt:'Part 1'},{id:44,entryId:3,part:3,topic:'Food',prompt:'Part 3'}]}),history:()=>Promise.resolve([]),adminStudents:(setId,classId,query,page,pageSize)=>Promise.resolve({setId,classId,page,pageSize,total:1,students:[student]})};
  const win={document:{hidden:false,addEventListener(){},removeEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},addEventListener(){},removeEventListener(){},URL:{revokeObjectURL(){}},setTimeout};
  const interval=()=>{};interval.cancel=()=>{};const instance={};constructor.call(instance,{$on(){},$watch(){return()=>{};}},{settings:{layout:{}}},win,{search(){return{};}},interval,{when:Promise.resolve.bind(Promise)},{},api,{state:{pending:[]},stop:()=>Promise.resolve(),loadPending(){}},{trustAsResourceUrl:v=>v},{current:{data:{speakingManagement:management}}});
  return{instance,student};
 }
 const own=controller(false);await tick();
 for(const question of [{id:43,part:1},{id:42,part:2},{id:44,part:3}]){own.instance.changePart(question.part);assert.equal(own.instance.notebookQuestionId,null);own.instance.toggleNotebook(question);assert.equal(own.instance.notebookQuestionId,question.id);assert.equal(own.instance.answerStudentId(),9);own.instance.closeNotebook();own.instance.toggleNotebook({id:999,part:question.part});assert.equal(own.instance.notebookQuestionId,null);}
 const admin=controller(true);await tick();admin.instance.toggleNotebook({id:42,part:2});assert.equal(admin.instance.notebookQuestionId,null);admin.instance.adminClassId=21;await admin.instance.changeAdminClass();await admin.instance.viewAdminStudent(admin.student);
 for(const question of [{id:43,part:1},{id:42,part:2},{id:44,part:3}]){admin.instance.changePart(question.part);admin.instance.toggleNotebook(question);assert.equal(admin.instance.notebookQuestionId,question.id);assert.equal(admin.instance.answerStudentId(),7);}
 admin.instance.adminClassId=999;await admin.instance.changeAdminClass();assert.equal(admin.instance.notebookQuestionId,null);assert.equal(admin.instance.studentId,null);
});
