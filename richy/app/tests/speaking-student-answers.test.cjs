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
 assert.match(html,/vm.selectedSet.canManage && !vm.selectedSet.sharedForEveryone/);assert.match(html,/ng-if="vm.canReviewStudents\(\) && !vm.isAdmin"/);assert.match(html,/<speaking-student-answer-editor ng-if="vm.answerQuestionId===question.id"/);assert.match(html,/student-id="vm.answerStudentId\(\)"/);assert.match(route,/speaking-student-answer-editor\.js/);
 const directive=editor.speakingStudentAnswerEditor({document:{}},{},{});assert.match(directive.template,/Take note/);assert.match(directive.template,/Highlight/);assert.match(directive.template,/ng-model="ed.activeNote.text"/);assert.match(directive.template,/ng-click="ed.closeNote\(\)"/);
});
function controllerFixture(options={}){
 const calls={history:[],confirm:[],preview:[],pass:[],roster:[],bank:[],template:[],import:[]},storage=new Map(),location={};let ack=payload=>({...payload,saved:payload.rows.length,answers:payload.rows.map(row=>({...row,setId:payload.setId,studentId:payload.studentId,revision:row.revision+1}))});
 const set={id:11,ownerId:1,canManage:false,canReviewStudents:true,sharedForEveryone:true,name:'Bộ chung',year:2026,number:1},rows=[{rowId:'r1',questionId:42,html:'New answer',revision:0,status:'NEW'},{rowId:'r2',questionId:43,html:'Changed answer',revision:2,status:'CHANGED'},{rowId:'r3',questionId:44,html:'Same',revision:1,status:'UNCHANGED'},{rowId:'r4',questionId:45,revision:0,status:'INVALID'}];
 const student={id:7,name:'Student',username:'s7',canAccess:true,answerCount:1,firstAnswerQuestionId:42,firstAnswerPart:1};
 const api={bootstrap:()=>Promise.resolve({userId:9,canManage:true,isAdmin:options.isAdmin!==false,sets:[set],classes:[{id:21,name:'Class 21'},{id:22,name:'Class 22'}]}),bank(id,studentId){calls.bank.push([id,studentId]);return Promise.resolve({set,studentId:studentId||9,questions:[{id:42,entryId:101,part:1,topic:'Home',prompt:'Question',passed:false}]});},students:()=>Promise.resolve([student]),adminStudents(...args){calls.roster.push(args);return Promise.resolve({setId:args[0],classId:args[1],page:args[3],pageSize:args[4],total:1,students:[student]});},studentAnswerTemplate(...args){calls.template.push(args);return Promise.resolve(new ArrayBuffer(1));},preview(id,file){calls.import.push([id,file]);return Promise.resolve({rows:[]});},confirm(id,payload){calls.import.push([id,payload]);return Promise.resolve({imported:0});},history(...args){calls.history.push(args);return Promise.resolve([]);},previewStudentAnswers(...args){calls.preview.push(args);return Promise.resolve({setId:11,studentId:7,rows:structuredClone(rows)});},confirmStudentAnswers(payload){calls.confirm.push(plain(payload));return Promise.resolve(ack(payload));},markPass(id,payload){calls.pass.push(payload);return Promise.resolve({updated:payload.questionIds.length,studentId:payload.studentId,passed:payload.passed});}};
 const win={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},Blob,URL:{revokeObjectURL(){},createObjectURL(){return 'blob:test';}},document:{hidden:false,addEventListener(){},removeEventListener(){},createElement(){return {click(){},parentNode:{removeChild(){}}};},body:{appendChild(){}}},addEventListener(){},removeEventListener(){},setTimeout};
 const scope={$on(){},$watch(){return()=>{};}};const interval=()=>{};interval.cancel=()=>{};
 const vm={};registered('question/controllers/SpeakingController.js').SpeakingController.call(vm,scope,{settings:{layout:{}}},win,{search(key,value){if(key===undefined)return location;if(value===null)delete location[key];else location[key]=value;}},interval,q,{},api,{state:{pending:[]},loadPending:()=>Promise.resolve(),stop:()=>Promise.resolve()},{trustAsResourceUrl:v=>v});
 return{vm,calls,api,student,setAck(fn){ack=fn;}};
}
test('a teacher on a shared bank can review their selected student without requesting another student history',async()=>{
 const f=controllerFixture({isAdmin:false});await settle();assert.equal(f.vm.canReviewStudents(),true);f.vm.studentId=7;const before=f.calls.history.length;await f.vm.loadBank();assert.equal(f.calls.history.length,before);await f.vm.markPass(f.vm.questions,true);assert.equal(f.calls.pass.length,1);assert.equal(f.calls.pass[0].studentId,7);assert.equal(f.vm.questions[0].passed,true);
});
test('Excel preview selects only new answers; overwrites are explicit and blank annotation lists are scoped to selected rows',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();f.vm.openAnswerImport(f.student);f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});await f.vm.previewAnswers();assert.equal(f.vm.answerImportSelected,1);assert.equal(f.vm.answerImportRows[1].selected,false);f.vm.answerImportRows[1].selected=true;f.vm.answerImportRows[2].selected=true;f.vm.answerImportRows[3].selected=true;f.vm.countAnswerImports();assert.equal(f.vm.answerImportSelected,2);await f.vm.confirmAnswers();assert.deepEqual(f.calls.confirm[0],{setId:11,studentId:7,rows:[{questionId:42,html:'New answer',notes:[],revision:0},{questionId:43,html:'Changed answer',notes:[],revision:2}]});assert.equal(f.vm.modal,null);assert.match(f.vm.notice,/Đã lưu 2/);
});
test('Excel save never closes the preview or reports success for the wrong student, missing answer receipt or missing revision',async()=>{
 for(const mutate of [ack=>({...ack,studentId:8}),ack=>({...ack,answers:[]}),ack=>{delete ack.answers[0].revision;return ack;}]){
  const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();f.vm.openAnswerImport(f.student);f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});await f.vm.previewAnswers();f.setAck(payload=>mutate({...payload,saved:payload.rows.length,answers:payload.rows.map(row=>({...row,setId:payload.setId,studentId:payload.studentId,revision:1}))}));await f.vm.confirmAnswers();assert.equal(f.vm.modal,'answers');assert.equal(f.vm.notice,undefined);assert.ok(f.vm.error);assert.equal(f.vm.answerImportRows.length,4);
 }
});
test('mismatched Excel metadata and changing student while a request is pending cannot populate another preview',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();f.vm.openAnswerImport(f.student);f.vm.chooseAnswerFile({name:'answers.xlsx',size:100});f.api.previewStudentAnswers=()=>Promise.resolve({setId:11,studentId:8,rows:[{questionId:42,status:'NEW'}]});await f.vm.previewAnswers();assert.equal(f.vm.answerImportRows.length,0);assert.match(f.vm.error,/không khớp/);
 const waiting=deferred();f.api.previewStudentAnswers=()=>waiting.promise;const load=f.vm.previewAnswers();f.vm.answerImportContext={setId:11,studentId:8};waiting.resolve({setId:11,studentId:7,rows:[{questionId:42,status:'NEW'}]});await load;assert.equal(f.vm.answerImportRows.length,0);
});

test('non-admins retain manual review but cannot call any Speaking import or import template action',async()=>{
 const f=controllerFixture({isAdmin:false});await settle();f.vm.studentId=7;f.vm.adminClassId=21;
 f.vm.openModal('import');assert.equal(f.vm.modal,undefined);f.vm.chooseFile({name:'set.xlsx',size:100});f.vm.importFile={name:'forged.xlsx'};await f.vm.previewFile();await f.vm.confirmImport();
 f.vm.openAnswerImport(f.student);assert.equal(f.vm.answerImportContext,undefined);f.vm.answerImportContext={setId:11,studentId:7};f.vm.answerImportFile={name:'forged.xlsx'};await f.vm.previewAnswers();await f.vm.confirmAnswers();await f.vm.downloadAnswerTemplate(f.student);await f.vm.loadAdminStudents(0);
 assert.equal(f.calls.import.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);assert.equal(f.calls.template.length,0);assert.equal(f.calls.roster.length,0);
 const html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8');assert.match(html,/ng-if="vm.isAdmin && vm.selectedSet.canManage"/);assert.match(html,/vm.openAnswerImport\(student\)/);assert.match(html,/vm.viewAdminStudent\(student\)/);assert.match(html,/Học sinh theo lớp/);
});

test('admin roster requires a class and sends pagination and search to the server without truncating its students',async()=>{
 const f=controllerFixture();await settle();assert.equal(f.calls.roster.length,0);assert.equal(f.vm.adminStudentRows.length,0);f.vm.adminClassId=21;await f.vm.changeAdminClass();assert.deepEqual(f.calls.roster[0],[11,21,'',0,25]);assert.equal(f.vm.adminStudentRows[0].id,7);
 f.api.adminStudents=(setId,classId,query,page,pageSize)=>{f.calls.roster.push([setId,classId,query,page,pageSize]);return Promise.resolve({setId,classId,page,pageSize,total:250,students:[{...f.student,id:99,name:'Beyond first 200'}]});};
 f.vm.adminStudentQuery='last';await f.vm.loadAdminStudents(8);assert.deepEqual(f.calls.roster.at(-1),[11,21,'last',8,25]);assert.equal(f.vm.adminTotal,250);assert.equal(f.vm.adminStudentRows[0].id,99);assert.equal(f.vm.adminPage,8);
});

test('late class or search responses cannot replace the currently selected class roster',async()=>{
 const f=controllerFixture();await settle();const first=deferred(),second=deferred();f.api.adminStudents=(setId,classId)=>classId===21?first.promise:second.promise;
 f.vm.adminClassId=21;const old=f.vm.changeAdminClass();f.vm.adminClassId=22;const current=f.vm.changeAdminClass();second.resolve({setId:11,classId:22,page:0,pageSize:25,total:1,students:[{...f.student,id:8}]});await current;first.resolve({setId:11,classId:21,page:0,pageSize:25,total:1,students:[f.student]});await old;assert.equal(f.vm.adminStudentRows[0].id,8);assert.equal(f.vm.adminRosterLoading,false);
 const oldSearch=deferred(),newSearch=deferred();f.api.adminStudents=(s,c,query)=>query==='old'?oldSearch.promise:newSearch.promise;f.vm.adminStudentQuery='old';const stale=f.vm.searchAdminStudents();f.vm.adminStudentQuery='new';const latest=f.vm.searchAdminStudents();newSearch.resolve({setId:11,classId:22,page:0,pageSize:25,total:1,students:[{...f.student,id:10}]});await latest;oldSearch.resolve({setId:11,classId:22,page:0,pageSize:25,total:1,students:[{...f.student,id:9}]});await stale;assert.equal(f.vm.adminStudentRows[0].id,10);
});

test('View opens the selected students first saved answer in its actual Part and topic page',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();const questions=Array.from({length:14},(_,i)=>({id:100+i,entryId:200+i,part:3,topic:'Topic '+i,prompt:'Question '+i,passed:false}));
 f.api.bank=(id,studentId)=>Promise.resolve({set:{...f.vm.selectedSet},studentId,questions});const viewed={...f.student,firstAnswerQuestionId:113,firstAnswerPart:3};await f.vm.viewAdminStudent(viewed);assert.equal(f.vm.studentId,7);assert.equal(f.vm.part,3);assert.equal(f.vm.groupPage,2);assert.equal(f.vm.answerQuestionId,113);assert.equal(f.vm.answerStudentLabel(),'Student (s7)');assert.equal(f.vm.adminViewEmpty,false);
});

test('rapid View changes clear old Pass flags and only the latest student may reopen an editor',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();const one=deferred(),two=deferred(),set={...f.vm.selectedSet};f.api.bank=(id,studentId)=>studentId===7?one.promise:two.promise;
 const old=f.vm.viewAdminStudent(f.student);const latest=f.vm.viewAdminStudent({...f.student,id:8,name:'Other',username:'s8'});assert.equal(f.vm.questions.length,0);assert.equal(f.vm.groups.length,0);await f.vm.markPass([{id:42}],true);f.vm.toggleAnswer({id:42});assert.equal(f.calls.pass.length,0);assert.equal(f.vm.answerQuestionId,null);
 two.resolve({set,studentId:8,questions:[{id:42,entryId:101,part:1,topic:'Home',prompt:'Student eight',passed:false}]});await latest;one.resolve({set,studentId:7,questions:[{id:99,entryId:199,part:2,topic:'Old',prompt:'Student seven',passed:true}]});await old;assert.equal(f.vm.studentId,8);assert.equal(f.vm.questions[0].prompt,'Student eight');assert.equal(f.vm.answerQuestionId,42);
});

test('failed View has no previous student questions and a student without responses has an explicit empty state',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();await f.vm.viewAdminStudent({...f.student,answerCount:0,firstAnswerQuestionId:null});assert.equal(f.vm.adminViewEmpty,true);assert.equal(f.vm.answerQuestionId,null);assert.equal(f.vm.questions.length,1);
 f.api.bank=()=>Promise.reject({status:0,message:'Offline'});await f.vm.viewAdminStudent({...f.student,id:8});assert.equal(f.vm.questions.length,0);assert.equal(f.vm.groups.length,0);assert.equal(f.vm.answerQuestionId,null);assert.match(f.vm.error,/Offline/);
});

test('row Import and template remain bound to that row even while another student is being viewed',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();await f.vm.viewAdminStudent(f.student);f.vm.openAnswerImport({...f.student,id:8,name:'Second',username:'s8'});assert.equal(f.vm.answerImportContext.studentId,8);assert.equal(f.vm.studentId,7);await f.vm.downloadAnswerTemplate();assert.deepEqual(f.calls.template[0],[11,8]);
 f.api.previewStudentAnswers=(setId,studentId)=>Promise.resolve({setId,studentId,rows:[{questionId:42,html:'Second answer',revision:0,status:'NEW'}]});f.vm.chooseAnswerFile({name:'second.xlsx',size:10});await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.confirm[0].studentId,8);assert.equal(f.vm.studentId,7);assert.equal(f.vm.answerQuestionId,42);assert.match(f.vm.notice,/Second \(s8\)/);
});

test('private-bank students without access cannot trigger View, Import or template requests',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();const before=f.calls.bank.length,restricted={...f.student,canAccess:false};await f.vm.viewAdminStudent(restricted);f.vm.openAnswerImport(restricted);await f.vm.downloadAnswerTemplate(restricted);assert.equal(f.calls.bank.length,before);assert.equal(f.vm.modal,undefined);assert.equal(f.calls.template.length,0);
});

test('a mismatched roster receipt cannot populate a student list from another class',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;f.api.adminStudents=()=>Promise.resolve({setId:11,classId:22,page:0,pageSize:25,total:1,students:[f.student]});await f.vm.changeAdminClass();assert.equal(f.vm.adminStudentRows.length,0);assert.match(f.vm.adminRosterError,/không khớp/);
});

test('View rejects a bank without an exact student identity instead of opening an unverified editor',async()=>{
 for(const studentId of [undefined,null,8]){const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();f.api.bank=()=>Promise.resolve({set:{...f.vm.selectedSet},studentId,questions:[{id:42,entryId:101,part:1,topic:'Home',passed:true}]});await f.vm.viewAdminStudent(f.student);assert.equal(f.vm.questions.length,0);assert.equal(f.vm.answerQuestionId,null);assert.match(f.vm.error,/không khớp/);}
});
