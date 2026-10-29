const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
const q={when:Promise.resolve.bind(Promise)};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{resolve,reject,promise};}
function registered(file){const values={};const module={factory(name,definition){values[name]=definition.at(-1);return this;},directive(name,definition){values[name]=definition.at(-1);return this;},controller(name,definition){values[name]=definition.at(-1);return this;}};nodeVm.runInNewContext(fs.readFileSync(path.join(app,file),'utf8'),{angular:{module:()=>module,noop(){},identity:v=>v},JSON,Date,Number,Array,Math,Uint32Array,FormData});return values;}
const editor=registered('question/business/speaking-student-answer-editor.js');
const context={setId:11,studentId:7,questionId:42,userId:9};
function fixture(){
 const storage=new Map(),calls=[];let remote={...context,html:'<p>Original</p>',notes:[],revision:1},save=(payload)=>Promise.resolve({...payload,revision:payload.revision+1}),get=()=>Promise.resolve({setId:context.setId,studentId:context.studentId,canEdit:true,answers:[remote]});
 const api={studentAnswers(...args){return get(...args);},saveStudentAnswer(payload){calls.push(plain(payload));return save(payload);}};
 const win={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 const store=editor.SpeakingStudentAnswerStore(q,win,api),clean=(html,notes)=>({html:String(html||''),notes:plain(notes||[])});
 return{store,storage,calls,session:()=>store.open(context,clean),setSave(fn){save=fn;},setGet(fn){get=fn;},setRemote(row){remote=row;},remote:()=>remote};
}
test('answer saves preserve formatting, anchored notes and exact student/question context before clearing the backup',async()=>{
 const f=fixture(),s=f.session();await s.load();const html='<p><b>Answer</b> <span class="ielts-annotation has-note" data-note-id="note-1">word</span></p>',notes=[{id:'note-1',text:'Remember this'}];s.change(html,notes);assert.equal(f.storage.size,1);await s.save();assert.equal(s.state.dirty,false);assert.equal(s.state.revision,2);assert.equal(f.storage.size,0);assert.deepEqual(f.calls[0],{setId:11,studentId:7,questionId:42,revision:1,html,notes});
});
test('a missing or mismatched acknowledgement never clears the local answer or reports success',async()=>{
 for(const mutate of [row=>({...row,studentId:8}),row=>({...row,questionId:99}),row=>({...row,setId:12}),row=>{delete row.revision;return row;}]){
  const f=fixture(),s=f.session();await s.load();s.change('<u>Draft</u>',[]);f.setSave(payload=>Promise.resolve(mutate({...payload,revision:2})));await s.save();assert.equal(s.state.dirty,true);assert.equal(f.storage.size,1);assert.match(s.state.error,/Chưa nhận đúng/);assert.notEqual(s.state.status,'Đã đồng bộ');
 }
});
test('edits made during an in-flight save survive its acknowledgement and resume at the acknowledged revision',async()=>{
 const f=fixture(),s=f.session();await s.load();const waiting=deferred();f.setSave(()=>waiting.promise);s.change('First edit',[]);const save=s.save();s.change('Later edit',[]);waiting.resolve({...f.calls[0],revision:2});await save;assert.equal(s.state.html,'Later edit');assert.equal(s.state.revision,2);assert.equal(s.state.dirty,true);assert.equal(f.storage.size,1);f.setSave(payload=>Promise.resolve({...payload,revision:3}));await s.save();assert.equal(f.calls[1].html,'Later edit');assert.equal(f.calls[1].revision,2);assert.equal(f.storage.size,0);
});
test('server conflicts retain the old draft revision across closing and reopening instead of silently overwriting new content',async()=>{
 const f=fixture(),s=f.session();await s.load();s.change('Student edit',[]);f.setRemote({...f.remote(),html:'Teacher correction',revision:2});f.setSave(()=>Promise.reject({status:409,data:{message:'Conflict'}}));await s.save();await settle();assert.equal(s.state.conflict,true);assert.equal(s.state.html,'Student edit');s.destroy();const reopened=f.session();await reopened.load();assert.equal(reopened.state.conflict,true);assert.equal(reopened.state.revision,1);assert.equal(reopened.state.remote.revision,2);await reopened.save();assert.equal(f.calls.length,1);f.setSave(payload=>Promise.resolve({...payload,revision:3}));await reopened.overwriteReviewed();assert.equal(f.calls[1].revision,2);assert.equal(reopened.state.conflict,false);assert.equal(reopened.state.dirty,false);
});
test('a lost ACK can retry the same payload; returning to the loaded value removes only this session backup',async()=>{
 const f=fixture(),s=f.session();await s.load();s.change('Answer',[]);f.setSave(()=>Promise.reject({status:0}));await s.save();assert.equal(f.storage.size,1);f.setSave(payload=>Promise.resolve({...payload,revision:2}));await s.save();assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.storage.size,0);
 s.change('Discarded local edit',[]);assert.equal(f.storage.size,1);s.change('Answer',[]);assert.equal(s.state.dirty,false);assert.equal(f.storage.size,0);
});
test('failed initial loading is not writable and cannot cause an empty revision-zero save',async()=>{
 const f=fixture();f.setGet(()=>Promise.resolve({setId:11,studentId:8,canEdit:true,answers:[f.remote()]}));const s=f.session();await s.load();assert.equal(s.state.ready,false);s.change('Overwrite?',[]);await s.save();assert.equal(f.calls.length,0);assert.match(s.state.error,/không khớp/);
});
test('an acknowledged old session never removes a newer local draft after the editor is closed',async()=>{
 const f=fixture(),s=f.session();await s.load();const waiting=deferred();f.setSave(()=>waiting.promise);s.change('Sent answer',[]);const save=s.save();s.change('Unsent answer',[]);s.destroy();waiting.resolve({...f.calls[0],revision:2});await save;assert.equal(f.storage.size,1);assert.equal(JSON.parse([...f.storage.values()][0]).html,'Unsent answer');
});
test('an old ACK cannot delete a newer session draft with identical text but a later base revision',async()=>{
 const f=fixture(),old=f.session();await old.load();const waiting=deferred();f.setSave(()=>waiting.promise);old.change('Answer A',[]);const save=old.save();old.destroy();f.setRemote({...f.remote(),html:'Teacher B',revision:3});const newer=f.session();await newer.load();assert.equal(newer.state.conflict,true);newer.useServer();newer.change('Answer A',[]);newer.destroy();const key='speaking-answer:v1:9:11:7:42';assert.equal(JSON.parse(f.storage.get(key)).revision,3);waiting.resolve({...f.calls[0],revision:2});await save;assert.equal(JSON.parse(f.storage.get(key)).revision,3);assert.equal(JSON.parse(f.storage.get(key)).html,'Answer A');
});
test('null or zero save revisions cannot acknowledge an absent answer while numeric zero remains valid for its initial load',async()=>{
 for(const revision of [null,0,'1']){const f=fixture();f.setRemote({...f.remote(),html:'',revision:0});const s=f.session();await s.load();assert.equal(s.state.ready,true);s.change('New answer',[]);f.setSave(payload=>Promise.resolve({...payload,revision}));await s.save();assert.equal(s.state.dirty,true);assert.equal(f.storage.size,1);assert.match(s.state.error,/Chưa nhận đúng/);}
});
test('reverting to the original while a different value is in flight remains a draft even if the editor is closed',async()=>{
 const f=fixture(),s=f.session();await s.load();const waiting=deferred();f.setSave(()=>waiting.promise);s.change('Temporary change',[]);const save=s.save();s.change('<p>Original</p>',[]);assert.equal(s.state.dirty,true);s.destroy();waiting.resolve({...f.calls[0],revision:2});await save;assert.equal(f.storage.size,1);assert.equal(JSON.parse([...f.storage.values()][0]).html,'<p>Original</p>');
});
test('a no-op ACK at the same revision is accepted only when its content matches exactly',async()=>{
 const f=fixture(),s=f.session();await s.load();s.change('Already persisted',[]);f.setSave(payload=>Promise.resolve({...payload}));await s.save();assert.equal(s.state.dirty,false);assert.equal(f.storage.size,0);
 s.change('New text',[]);f.setSave(payload=>Promise.resolve({...payload,html:'Different text'}));await s.save();assert.equal(s.state.dirty,true);assert.equal(f.storage.size,1);assert.match(s.state.error,/Chưa nhận đúng/);
});
test('state uses separate local namespaces for each logged-in actor, student, set and question',async()=>{
 const f=fixture(),a=f.session();await a.load();a.change('Student seven',[]);const foreign=f.store.open({...context,userId:8},(html,notes)=>({html,notes}));await foreign.load();assert.equal(foreign.state.html,'<p>Original</p>');assert.equal(foreign.state.dirty,false);assert.match([...f.storage.keys()][0],/:9:11:7:42$/);
});
test('shared banks expose review separately from content management and answer editor loads only when expanded',()=>{
 const html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8'),route=fs.readFileSync(path.join(app,'question/question.module.js'),'utf8');
 assert.match(html,/vm.selectedSet.canManage && !vm.selectedSet.sharedForEveryone/);assert.match(html,/ng-if="vm.canReviewStudents\(\)"/);assert.match(html,/<speaking-student-answer-editor ng-if="vm.answerQuestionId===question.id"/);assert.match(html,/student-id="vm.answerStudentId\(\)"/);assert.match(route,/speaking-student-answer-editor\.js/);
 const directive=editor.speakingStudentAnswerEditor({document:{}},{},{});assert.match(directive.template,/Take note/);assert.match(directive.template,/Highlight/);assert.match(directive.template,/ng-model="ed.activeNote.text"/);assert.match(directive.template,/ng-click="ed.closeNote\(\)"/);
});
function controllerFixture(){
 const calls={history:[],confirm:[],preview:[],pass:[]},storage=new Map(),location={};let ack=payload=>({...payload,saved:payload.rows.length,answers:payload.rows.map(row=>({...row,setId:payload.setId,studentId:payload.studentId,revision:row.revision+1}))});
 const set={id:11,ownerId:1,canManage:false,canReviewStudents:true,sharedForEveryone:true,name:'Bộ chung',year:2026,number:1},rows=[{rowId:'r1',questionId:42,html:'New answer',revision:0,status:'NEW'},{rowId:'r2',questionId:43,html:'Changed answer',revision:2,status:'CHANGED'},{rowId:'r3',questionId:44,html:'Same',revision:1,status:'UNCHANGED'},{rowId:'r4',questionId:45,revision:0,status:'INVALID'}];
 const api={bootstrap:()=>Promise.resolve({userId:9,canManage:true,isAdmin:false,sets:[set],classes:[]}),bank:()=>Promise.resolve({set,questions:[{id:42,entryId:101,part:1,topic:'Home',prompt:'Question',passed:false}]}),students:()=>Promise.resolve([{id:7,name:'Student',username:'s7',canAccess:true}]),history(...args){calls.history.push(args);return Promise.resolve([]);},previewStudentAnswers(...args){calls.preview.push(args);return Promise.resolve({setId:11,studentId:7,rows:structuredClone(rows)});},confirmStudentAnswers(payload){calls.confirm.push(plain(payload));return Promise.resolve(ack(payload));},markPass(id,payload){calls.pass.push(payload);return Promise.resolve({updated:payload.questionIds.length,studentId:payload.studentId,passed:payload.passed});}};
 const win={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL:{revokeObjectURL(){}},document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout};
 const scope={$on(){},$watch(){return()=>{};}};const interval=()=>{};interval.cancel=()=>{};
 const vm={};registered('question/controllers/SpeakingController.js').SpeakingController.call(vm,scope,{settings:{layout:{}}},win,{search(key,value){if(key===undefined)return location;if(value===null)delete location[key];else location[key]=value;}},interval,q,{},api,{state:{pending:[]},loadPending:()=>Promise.resolve(),stop:()=>Promise.resolve()},{trustAsResourceUrl:v=>v});
 return{vm,calls,api,setAck(fn){ack=fn;}};
}
test('a teacher on a shared bank can review their selected student without requesting another student history',async()=>{
 const f=controllerFixture();await settle();assert.equal(f.vm.canReviewStudents(),true);f.vm.studentId=7;const before=f.calls.history.length;await f.vm.loadBank();assert.equal(f.calls.history.length,before);await f.vm.markPass(f.vm.questions,true);assert.equal(f.calls.pass.length,1);assert.equal(f.calls.pass[0].studentId,7);assert.equal(f.vm.questions[0].passed,true);
});
test('Excel preview selects only new answers; overwrites are explicit and blank annotation lists are scoped to selected rows',async()=>{
 const f=controllerFixture();await settle();f.vm.studentId=7;f.vm.openAnswerImport();f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});await f.vm.previewAnswers();assert.equal(f.vm.answerImportSelected,1);assert.equal(f.vm.answerImportRows[1].selected,false);f.vm.answerImportRows[1].selected=true;f.vm.answerImportRows[2].selected=true;f.vm.answerImportRows[3].selected=true;f.vm.countAnswerImports();assert.equal(f.vm.answerImportSelected,2);await f.vm.confirmAnswers();assert.deepEqual(f.calls.confirm[0],{setId:11,studentId:7,rows:[{questionId:42,html:'New answer',notes:[],revision:0},{questionId:43,html:'Changed answer',notes:[],revision:2}]});assert.equal(f.vm.modal,null);assert.match(f.vm.notice,/Đã lưu 2/);
});
test('Excel save never closes the preview or reports success for the wrong student, missing answer receipt or missing revision',async()=>{
 for(const mutate of [ack=>({...ack,studentId:8}),ack=>({...ack,answers:[]}),ack=>{delete ack.answers[0].revision;return ack;}]){
  const f=controllerFixture();await settle();f.vm.studentId=7;f.vm.openAnswerImport();f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});await f.vm.previewAnswers();f.setAck(payload=>mutate({...payload,saved:payload.rows.length,answers:payload.rows.map(row=>({...row,setId:payload.setId,studentId:payload.studentId,revision:1}))}));await f.vm.confirmAnswers();assert.equal(f.vm.modal,'answers');assert.equal(f.vm.notice,undefined);assert.ok(f.vm.error);assert.equal(f.vm.answerImportRows.length,4);
 }
});
test('mismatched Excel metadata and changing student while a request is pending cannot populate another preview',async()=>{
 const f=controllerFixture();await settle();f.vm.studentId=7;f.vm.openAnswerImport();f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});f.api.previewStudentAnswers=()=>Promise.resolve({setId:11,studentId:8,rows:[{questionId:42,status:'NEW'}]});await f.vm.previewAnswers();assert.equal(f.vm.answerImportRows.length,0);assert.match(f.vm.error,/không khớp/);
 const waiting=deferred();f.api.previewStudentAnswers=()=>waiting.promise;const load=f.vm.previewAnswers();f.vm.answerImportContext={setId:11,studentId:8};waiting.resolve({setId:11,studentId:7,rows:[{questionId:42,status:'NEW'}]});await load;assert.equal(f.vm.answerImportRows.length,0);
});
