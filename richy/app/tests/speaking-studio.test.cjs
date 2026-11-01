const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..');
const q={when:Promise.resolve.bind(Promise),reject:Promise.reject.bind(Promise),all:Promise.all.bind(Promise),defer(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}};
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(setImmediate);};
const plain=v=>JSON.parse(JSON.stringify(v));
function register(file){let factory,controller;const module={factory(name,definition){factory=definition.at(-1);return this;},controller(name,definition){controller=definition.at(-1);return this;},directive(){return this;}};nodeVm.runInNewContext(fs.readFileSync(path.join(app,file),'utf8'),{angular:{module:()=>module,noop(){},identity:v=>v},Uint32Array,Date,Number,Math,JSON,FormData});return{factory,controller};}
function recorderFixture(options={}){
  const records=new Map(),calls={init:[],chunks:[],finish:[],tracksStopped:0},listeners={},permissions=[];let user=7,offline=false,badAck=false;
  function indexedDB(){
    return{open(){
      const request={};
      queueMicrotask(()=>{
        request.result={objectStoreNames:{contains:()=>true},transaction(){
          const transaction={objectStore(){return{
            put(value){return requestFor(()=>records.set(value.key,structuredClone(value)));},
            delete(key){return requestFor(()=>records.delete(key));},
            getAll(){return requestFor(()=>[...records.values()].map(value=>structuredClone(value)));}
          };}};
          function requestFor(operation){const r={};queueMicrotask(()=>{r.result=operation();r.onsuccess?.();transaction.oncomplete?.();});return r;}
          return transaction;
        }};
        request.onsuccess?.();
      });
      return request;
    }};
  }
  class MediaRecorder{static isTypeSupported(){return true;}constructor(stream,settings){this.stream=stream;this.mimeType=settings.mimeType;this.state='inactive';MediaRecorder.last=this;}start(){this.state='recording';}emit(text='audio'){this.ondataavailable({data:new Blob([text],{type:'audio/webm'})});}stop(){this.state='inactive';this.emit('last');this.onstop();}}
  const api={initRecording(id,data){calls.init.push({id,data:plain(data)});return Promise.resolve({id:42,...data});},chunk(id,index,buffer){calls.chunks.push({id,index,bytes:Buffer.from(buffer)});return offline?Promise.reject(new Error('Offline')):Promise.resolve({saved:!badAck,index});},finishRecording(id,count){calls.finish.push({id,count});return Promise.resolve({id,complete:!badAck});}};
  const win={indexedDB:options.noStorage?null:indexedDB(),MediaRecorder,Blob,addEventListener:(n,fn)=>listeners[n]=fn,crypto:{getRandomValues(a){a.set([1,2,3,Date.now()%100000]);}},navigator:{mediaDevices:{getUserMedia(){const d=q.defer();permissions.push(d);return d.promise;}}}};
  const recorder=register('question/business/SpeakingRecorder.js').factory(win,q,{$evalAsync(){}},{get:()=>JSON.stringify({id:user})},api);
  const stream=()=>({getTracks:()=>[{stop(){calls.tracksStopped++;}}]});
  return{recorder,records,calls,listeners,MediaRecorder,permissions,stream,setUser(v){user=v;},setOffline(v){offline=v;},setBadAck(v){badAck=v;},async start(){const p=recorder.start(7,21,0);permissions.at(-1).resolve(stream());await p;return p;}};
}
test('recordings retain local blobs while offline and retry the same chunk once without duplicating the recording',async()=>{
  const f=recorderFixture();f.setOffline(true);await f.start();f.MediaRecorder.last.emit('first');await settle();await f.recorder.stop();await settle();
  assert.equal(f.recorder.state.pending.length,1);assert.equal(f.recorder.state.pending[0].uploaded,0);assert.equal(f.records.size,1);assert.ok([...f.records.values()][0].parts[0] instanceof Blob);assert.equal(f.calls.finish.length,0);assert.doesNotMatch(f.recorder.state.message,/Đã lưu/);
  f.setOffline(false);await f.recorder.retry();await settle();assert.equal(f.calls.init.length,1);assert.equal(f.calls.finish.length,1);assert.deepEqual(f.calls.finish[0],{id:42,count:2});assert.equal(f.recorder.state.pending.length,0);assert.equal(f.records.size,0);assert.match(f.recorder.state.message,/Đã lưu bản ghi âm lên server/);
});
test('an invalid server ACK never clears the only local copy or reports a successful recording',async()=>{
  const f=recorderFixture();f.setBadAck(true);await f.start();f.MediaRecorder.last.emit();await settle();await f.recorder.stop();await settle();assert.equal(f.records.size,1);assert.equal(f.recorder.state.pending.length,1);assert.equal(f.recorder.state.pending[0].uploaded,0);assert.doesNotMatch(f.recorder.state.message,/Đã lưu/);
});
test('cancelling a microphone request releases late permission without interrupting a later recording',async()=>{
  const f=recorderFixture(),first=f.recorder.start(7,21,0).catch(e=>e);await f.recorder.stop();const second=f.recorder.start(7,21,1);f.permissions[1].resolve(f.stream());await second;assert.equal(f.recorder.state.active,true);
  f.permissions[0].resolve(f.stream());await first;assert.equal(f.recorder.state.active,true);assert.equal(f.calls.tracksStopped,1);await f.recorder.stop();await settle();
});
test('changing accounts prevents an old recording from being uploaded by the new user',async()=>{
  const f=recorderFixture();f.setOffline(true);await f.start();f.MediaRecorder.last.emit();await settle();await f.recorder.stop();await settle();const before=f.calls.chunks.length;f.setUser(8);f.setOffline(false);await f.recorder.retry();await settle();assert.equal(f.calls.chunks.length,before);assert.equal(f.recorder.state.pending.length,0);assert.equal(f.records.size,1);
});
test('slow uploads do not block subsequent local backups, and unavailable IndexedDB is reported',async()=>{
  const f=recorderFixture({noStorage:true});f.setOffline(true);await f.start();f.MediaRecorder.last.emit('one');f.MediaRecorder.last.emit('two');await settle();assert.equal(f.recorder.state.storageError,true);assert.equal(f.recorder.state.pending[0].parts.length,2);await f.recorder.stop();await settle();assert.match(f.recorder.state.message,/trang này/);assert.doesNotMatch(f.recorder.state.message,/Đã lưu/);
});
function controllerFixture(options={}){
 const storage=options.storage||new Map(),calls={start:[],progress:[],pass:[]},handlers={},location={};let progressAck=true,startFailure=false;
 const practice={id:21,studentId:7,status:'ACTIVE',currentIndex:0,elapsedSeconds:0,snapshot:{questions:[{id:1,part:1,topic:'Home',prompt:'Question one'},{id:2,part:2,topic:'Book',prompt:'Cue card'}]},recordings:[]};
 const set={id:1,ownerId:4,canManage:true,name:'Bộ 1',year:2026,number:1,classIds:[],studentIds:[7]};
 const api={bootstrap:()=>Promise.resolve({userId:7,canManage:true,sets:[set],classes:[]}),bank:()=>Promise.resolve({set,questions:[{id:1,entryId:11,part:1,topic:'Home',prompt:'Question one',passed:false}]}),students:()=>Promise.resolve([{id:7,name:'Student',username:'s7',canAccess:true}]),history:()=>Promise.resolve([]),
  start(payload){calls.start.push(plain(payload));return startFailure?Promise.reject({status:0,message:'Offline'}):Promise.resolve(structuredClone(practice));},practice:()=>Promise.resolve(structuredClone(practice)),
  progress(id,payload){calls.progress.push(plain(payload));return Promise.resolve(progressAck?{...structuredClone(practice),status:payload.finished?'DONE':'ACTIVE'}:{});},markPass(id,payload){calls.pass.push(payload);return Promise.resolve(progressAck?{updated:payload.questionIds.length,studentId:payload.studentId,passed:payload.passed}:{});}};
 const win={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL:{revokeObjectURL(){},createObjectURL:()=>''},document:{hidden:false,addEventListener:(n,fn)=>handlers[n]=fn,removeEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout};
 const scope={$on(n,fn){handlers[n]=fn;},$watch(){return()=>{};}};let interval;const intervals=fn=>{interval=fn;};intervals.cancel=()=>{};
 const recorder={state:{pending:[]},stop:()=>Promise.resolve(),loadPending:()=>Promise.resolve(),retry:()=>Promise.resolve()};
 const vm={};register('question/controllers/SpeakingController.js').controller.call(vm,scope,{settings:{layout:{}}},win,{search(key,value){if(key===undefined)return location;if(value===null)delete location[key];else location[key]=value;}},intervals,q,{},api,recorder,{trustAsResourceUrl:url=>url},{current:{data:{speakingManagement:options.managementMode===true}}});
 return{vm,storage,calls,handlers,api,practice,setProgressAck(v){progressAck=v;},setStartFailure(v){startFailure=v;},tick:()=>interval()};
}
test('bank import preselects every valid change and confirms selections across all lazy batches', async()=>{
 const f=controllerFixture({managementMode:true});await settle();f.vm.isAdmin=true;
 const rows=Array.from({length:125},(_,i)=>({status:['NEW','CHANGED','UPDATE_SAMPLE','UNCHANGED','INVALID'][i%5],row:{rowId:'row-'+i,topic:'Topic',prompt:'Prompt '+i}}));
 const confirmations=[];f.api.preview=()=>Promise.resolve({token:'compare-1',rows:structuredClone(rows)});
 f.api.confirm=(id,payload)=>{confirmations.push(plain(payload));return Promise.resolve({imported:payload.choices.length,preview:{token:'compare-2',rows:rows.map(row=>({...row,status:row.status==='INVALID'?'INVALID':'UNCHANGED'}))}});};
 f.vm.openModal('import');f.vm.chooseFile({name:'bank.xlsx',size:100});f.vm.previewFile();await settle();
 assert.equal(f.vm.importLimit,50);assert.equal(f.vm.importSelected,75);
 assert.deepEqual(plain(f.vm.importRows.slice(0,5).map(row=>row.selected)),[true,true,true,false,false]);
 assert.equal(f.vm.importRows[1].action,'NEW_VARIANT');assert.equal(f.vm.importRows[2].action,'UPDATE_SAMPLE');
 f.vm.selectNewRows();assert.equal(f.vm.importSelected,25);f.vm.selectChangedRows();assert.equal(f.vm.importSelected,75);
 const first=f.vm.importRows[0];f.vm.importRows[1].action='MINOR_CORRECTION';f.vm.importRows[121].selected=false;f.vm.countSelected();
 f.vm.loadMoreImportRows();assert.equal(f.vm.importLimit,100);f.vm.loadMoreImportRows();assert.equal(f.vm.importLimit,125);f.vm.loadMoreImportRows();assert.equal(f.vm.importLimit,125);
 assert.strictEqual(f.vm.importRows[0],first);assert.equal(f.vm.importRows[121].selected,false);assert.equal(f.vm.importSelected,74);
 f.vm.confirmImport();await settle();assert.equal(confirmations.length,1);assert.equal(confirmations[0].token,'compare-1');assert.equal(confirmations[0].choices.length,74);
 assert.ok(confirmations[0].choices.some(row=>row.rowId==='row-1'&&row.action==='MINOR_CORRECTION'));
 assert.ok(confirmations[0].choices.some(row=>row.rowId==='row-122'&&row.action==='UPDATE_SAMPLE'));
 assert.equal(confirmations[0].choices.some(row=>['row-3','row-4','row-121'].includes(row.rowId)),false);
 assert.equal(f.vm.importSelected,0);assert.equal(f.vm.importLimit,50);
 f.vm.previewFile();await settle();assert.equal(f.vm.importSelected,75);assert.equal(f.vm.importRows[121].selected,true);assert.equal(confirmations.length,1,'reading the comparison again never saves automatically');
});

test('topic scrolling appends batches without closing an answer and resets for a new Part or search',async()=>{
 const f=controllerFixture({managementMode:true});await settle();
 f.vm.questions=Array.from({length:14},(_,i)=>({id:i+1,entryId:i+11,part:1,topic:'Topic '+i,prompt:'Question '+i}));f.vm.rebuildGroups();
 const first=f.vm.groups[0];first.lazyLoaded=true;f.vm.answerQuestionId=1;
 assert.equal(f.vm.groupLimit,6);f.vm.loadMoreGroups();assert.equal(f.vm.groupLimit,12);f.vm.loadMoreGroups();assert.equal(f.vm.groupLimit,14);f.vm.loadMoreGroups();assert.equal(f.vm.groupLimit,14);
 assert.strictEqual(f.vm.groups[0],first);assert.equal(first.lazyLoaded,true);assert.equal(f.vm.answerQuestionId,1);
 f.vm.query='Topic 13';f.vm.rebuildGroups();assert.equal(f.vm.groupLimit,6);assert.equal(f.vm.groups.length,1);
 f.vm.query='';f.vm.changePart(2);assert.equal(f.vm.groupLimit,6);assert.equal(f.vm.groups.length,0);
 f.vm.changePart(1);f.vm.modal='import';f.vm.loadMoreGroups();assert.equal(f.vm.groupLimit,6);f.vm.modal=null;f.vm.loadingBank=true;f.vm.loadMoreGroups();assert.equal(f.vm.groupLimit,6);
});

test('practice start retries keep the same request and client key even after a reload or changed form',async()=>{
 const f=controllerFixture();await settle();f.vm.openPracticeSetup();f.setStartFailure(true);f.vm.startPractice();await settle();assert.equal(f.calls.start.length,1);assert.ok(f.storage.has('speaking-start:v1:7'));
 const g=controllerFixture({storage:f.storage});await settle();g.vm.openPracticeSetup();g.vm.practiceConfig.part1Count=20;g.vm.startPractice();await settle();assert.deepEqual(g.calls.start[0],f.calls.start[0]);assert.equal(g.vm.practice.id,21);assert.equal(g.storage.has('speaking-start:v1:7'),false);
});
test('malformed progress ACK keeps the draft and active practice, then a confirmed retry completes it',async()=>{
 const f=controllerFixture();await settle();f.vm.openPractice(21);await settle();f.setProgressAck(false);f.vm.finishPractice();await settle();assert.equal(f.vm.practice.status,'ACTIVE');assert.match(f.vm.progressError,/Chưa đồng bộ/);assert.ok(f.storage.has('speaking-practice:v1:7:21'));
 f.setProgressAck(true);f.vm.finishPractice();await settle();assert.equal(f.vm.practice.status,'DONE');assert.equal(f.storage.has('speaking-practice:v1:7:21'),false);
});
test('Pass remains teacher-controlled and only changes locally after the exact server confirmation',async()=>{
 const f=controllerFixture({managementMode:true});await settle();f.vm.studentId=7;f.setProgressAck(false);await f.vm.markPass(f.vm.questions,true);assert.equal(f.vm.questions[0].passed,false);assert.match(f.vm.error,/Chưa xác nhận/);f.setProgressAck(true);await f.vm.markPass(f.vm.questions,true);assert.equal(f.vm.questions[0].passed,true);f.vm.studentId=null;f.vm.markPass(f.vm.questions,false);assert.equal(f.calls.pass.length,2);
});

test('personal Studio refuses a different student practice returned for a direct URL or history click',async()=>{
 const f=controllerFixture();await settle();f.api.practice=()=>Promise.resolve({...structuredClone(f.practice),studentId:8});f.vm.openPractice(21);await settle();assert.equal(f.vm.practice,undefined);assert.match(f.vm.error,/không khớp/);assert.equal(f.storage.has('speaking-practice:v1:7:21'),false);
 f.api.practice=()=>Promise.resolve({...structuredClone(f.practice),id:22});f.vm.openPractice(21);await settle();assert.equal(f.vm.practice,undefined);assert.match(f.vm.error,/không khớp/);
});

test('management can review a selected students practice without recording or updating its progress',async()=>{
 const f=controllerFixture({managementMode:true});await settle();f.vm.openPracticeSetup();assert.equal(f.vm.modal,undefined);await f.vm.startPractice();assert.equal(f.calls.start.length,0);
 f.vm.studentId=7;f.vm.openPractice(21);await settle();assert.equal(f.vm.practice.id,21);assert.equal(f.vm.ownPractice(),false);f.vm.finishPractice();f.tick();await settle();assert.equal(f.calls.progress.length,0);
});
