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
 return{store,storage,calls,api,session:()=>store.open(context,clean),setSave(fn){save=fn;},setGet(fn){get=fn;},setRemote(row){remote=row;},remote:()=>remote};
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
 const calls={history:[],confirm:[],preview:[],pass:[],roster:[],bank:[],template:[],ownTemplate:[],ownPreview:[],ownConfirm:[],classRoster:[],classTemplate:[],classPreview:[],classConfirm:[],import:[],create:[],share:[],students:[]},storage=new Map(),location={};let ack=payload=>({...payload,saved:payload.rows.length,answers:payload.rows.map(row=>({...row,setId:payload.setId,studentId:payload.studentId,revision:row.revision+1}))});
 const set={id:11,ownerId:1,canManage:false,canReviewStudents:true,sharedForEveryone:true,name:'Bộ chung',year:2026,number:1},rows=[{rowId:'r1',questionId:42,html:'New answer',revision:0,status:'NEW'},{rowId:'r2',questionId:43,html:'Changed answer',revision:2,status:'CHANGED'},{rowId:'r3',questionId:44,html:'Same',revision:1,status:'UNCHANGED'},{rowId:'r4',questionId:45,revision:0,status:'INVALID'}];
 const student={id:7,name:'Student',username:'s7',canAccess:true,answerCount:1,firstAnswerQuestionId:42,firstAnswerPart:1};
 const api={bootstrap:()=>Promise.resolve({userId:9,canManage:options.canManage!==false,isAdmin:options.isAdmin!==false,sets:[set],classes:options.classes||[{id:21,name:'Class 21',schoolId:1,parentId:null},{id:22,name:'Class 22',schoolId:1,parentId:21}]}),bank(id,studentId){calls.bank.push([id,studentId]);return Promise.resolve({set,studentId:studentId||9,questions:[{id:42,entryId:101,part:1,topic:'Home',prompt:'Question',passed:false}]});},students(...args){calls.students.push(args);return Promise.resolve([student]);},createSet(payload){calls.create.push(payload);return Promise.resolve(set);},share(...args){calls.share.push(args);return Promise.resolve({id:set.id});},adminStudents(...args){calls.roster.push(args);return Promise.resolve({setId:args[0],classId:args[1],page:args[3],pageSize:args[4],total:1,students:[student]});},studentAnswerTemplate(...args){calls.template.push(args);return Promise.resolve(new ArrayBuffer(1));},preview(id,file){calls.import.push([id,file]);return Promise.resolve({rows:[]});},confirm(id,payload){calls.import.push([id,payload]);return Promise.resolve({imported:0});},history(...args){calls.history.push(args);return Promise.resolve([]);},previewStudentAnswers(...args){calls.preview.push(args);return Promise.resolve({setId:11,studentId:7,rows:structuredClone(rows)});},confirmStudentAnswers(payload){calls.confirm.push(plain(payload));return Promise.resolve(ack(payload));},markPass(id,payload){calls.pass.push(payload);return Promise.resolve({updated:payload.questionIds.length,studentId:payload.studentId,passed:payload.passed});}};
 const bootstrap=api.bootstrap;api.bootstrap=()=>bootstrap().then(data=>({...data,canImportStudentAnswers:options.canImportStudentAnswers===true,importClasses:options.importClasses||[]}));
 api.ownAnswerTemplate=(...args)=>{calls.ownTemplate.push(args);return Promise.resolve(new ArrayBuffer(1));};api.previewOwnAnswers=(...args)=>{calls.ownPreview.push(args);return Promise.resolve({setId:11,studentId:9,rows:structuredClone(rows)});};api.confirmOwnAnswers=payload=>{calls.ownConfirm.push(plain(payload));return Promise.resolve(ack({...payload,studentId:9}));};
 api.classStudents=(...args)=>{calls.classRoster.push(args);return Promise.resolve({setId:args[0],classId:args[1],page:args[3],pageSize:args[4],total:1,students:[{...student,canImport:true}]});};api.classAnswerTemplate=(...args)=>{calls.classTemplate.push(args);return Promise.resolve(new ArrayBuffer(1));};api.previewClassAnswers=(setId,studentId,file)=>{calls.classPreview.push([setId,studentId,file.name]);return Promise.resolve({setId,studentId,rows:structuredClone(rows)});};api.confirmClassAnswers=payload=>{calls.classConfirm.push(plain(payload));return Promise.resolve(ack(payload));};
 const win={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},Blob,URL:{revokeObjectURL(){},createObjectURL(){return 'blob:test';}},document:{hidden:false,addEventListener(){},removeEventListener(){},createElement(){return {click(){},parentNode:{removeChild(){}}};},body:{appendChild(){}}},addEventListener(){},removeEventListener(){},setTimeout};
 const scope={$on(){},$watch(){return()=>{};}};const interval=()=>{};interval.cancel=()=>{};
 const vm={};registered('question/controllers/SpeakingController.js').SpeakingController.call(vm,scope,{settings:{layout:{}}},win,{search(key,value){if(key===undefined)return location;if(value===null)delete location[key];else location[key]=value;}},interval,q,{},api,{state:{pending:[]},loadPending:()=>Promise.resolve(),stop:()=>Promise.resolve()},{trustAsResourceUrl:v=>v},{current:{data:{speakingManagement:options.managementMode!==false}}});
 return{vm,calls,api,student,set,location,setAck(fn){ack=fn;}};
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

test('ordinary teachers retain manual review but cannot import another students answers or the shared question bank',async()=>{
 const f=controllerFixture({isAdmin:false});await settle();f.vm.studentId=7;f.vm.adminClassId=21;
 f.vm.openModal('import');assert.equal(f.vm.modal,undefined);f.vm.chooseFile({name:'set.xlsx',size:100});f.vm.importFile={name:'forged.xlsx'};await f.vm.previewFile();await f.vm.confirmImport();
 f.vm.openAnswerImport(f.student);assert.equal(f.vm.answerImportContext,undefined);f.vm.answerImportContext={setId:11,studentId:7};f.vm.answerImportFile={name:'forged.xlsx'};await f.vm.previewAnswers();await f.vm.confirmAnswers();await f.vm.downloadAnswerTemplate(f.student);await f.vm.loadAdminStudents(0);
 assert.equal(f.calls.import.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);assert.equal(f.calls.template.length,0);assert.equal(f.calls.roster.length,0);
 const html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8');assert.match(html,/ng-if="vm.managementMode && vm.isAdmin && vm.selectedSet.canManage"/);assert.match(html,/vm.openAnswerImport\(student\)/);assert.match(html,/vm.viewAdminStudent\(student\)/);assert.match(html,/Học sinh theo lớp/);
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

test('admin self import needs no class and binds template, preview and receipt to the signed-in account',async()=>{
 const f=controllerFixture({classes:[]});await settle();f.vm.openOwnAnswerImport();assert.equal(f.vm.modal,'answers');assert.deepEqual(plain(f.vm.answerImportContext),{kind:'SELF',actorId:9,setId:11,classId:null,studentId:9,label:'Câu trả lời của tôi'});assert.equal(f.vm.adminClassId,undefined);
 await f.vm.downloadAnswerTemplate();assert.deepEqual(f.calls.ownTemplate[0],[11]);
 f.api.previewOwnAnswers=(setId,file)=>{f.calls.ownPreview.push([setId,file.name]);return Promise.resolve({setId,studentId:9,rows:[{questionId:42,html:'My answer',revision:0,status:'NEW'}]});};
 f.vm.chooseAnswerFile({name:'mine.xlsx',size:12});await f.vm.previewAnswers();assert.equal(f.vm.answerImportSelected,1);await f.vm.confirmAnswers();assert.deepEqual(f.calls.ownPreview[0],[11,'mine.xlsx']);assert.deepEqual(f.calls.ownConfirm[0],{setId:11,rows:[{questionId:42,html:'My answer',notes:[],revision:0}]});assert.equal(f.vm.modal,null);assert.equal(f.calls.roster.length,0);assert.equal(f.calls.template.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);assert.equal(f.vm.notice,'Đã lưu 1 câu trả lời của bạn.');
 const html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8');assert.match(html,/Import bài của tôi/);assert.match(html,/vm.openOwnAnswerImport\(\)/);
});

test('self import while viewing a student never writes into or closes that students answer',async()=>{
 const f=controllerFixture();await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();await f.vm.viewAdminStudent(f.student);const rosterCount=f.calls.roster.length;assert.equal(f.vm.answerQuestionId,42);f.vm.openOwnAnswerImport();assert.equal(f.vm.answerImportContext.studentId,9);assert.equal(f.vm.studentId,7);
 f.api.previewOwnAnswers=setId=>Promise.resolve({setId,studentId:9,rows:[{questionId:42,html:'My own answer',revision:0,status:'NEW'}]});f.vm.chooseAnswerFile({name:'mine.xlsx',size:10});await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.ownConfirm[0].studentId,undefined);assert.equal(f.calls.confirm.length,0);assert.equal(f.vm.studentId,7);assert.equal(f.vm.answerQuestionId,42);assert.equal(f.calls.roster.length,rosterCount);
});

test('self import rejects another account file, forged self targets and a changed signed-in actor',async()=>{
 const f=controllerFixture();await settle();f.vm.openOwnAnswerImport();f.vm.chooseAnswerFile({name:'wrong-person.xlsx',size:10});f.api.previewOwnAnswers=()=>Promise.resolve({setId:11,studentId:7,rows:[{questionId:42,html:'Wrong answer',revision:0,status:'NEW'}]});await f.vm.previewAnswers();assert.equal(f.vm.answerImportRows.length,0);assert.match(f.vm.error,/không khớp/);
 f.vm.answerImportContext.studentId=7;await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.ownTemplate.length,0);assert.equal(f.calls.ownConfirm.length,0);
 f.vm.openOwnAnswerImport();f.vm.userId=10;await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.ownTemplate.length,0);assert.equal(f.calls.ownConfirm.length,0);
});

test('class or set changes invalidate an open self import and late previews cannot repopulate it',async()=>{
 const f=controllerFixture();await settle();f.vm.openOwnAnswerImport();f.vm.chooseAnswerFile({name:'mine.xlsx',size:10});const waiting=deferred();f.api.previewOwnAnswers=()=>waiting.promise;const pending=f.vm.previewAnswers();f.vm.adminClassId=21;await f.vm.changeAdminClass();waiting.resolve({setId:11,studentId:9,rows:[{questionId:42,html:'Late answer',revision:0,status:'NEW'}]});await pending;assert.equal(f.vm.answerImportContext,null);assert.equal(f.vm.modal,null);assert.equal(f.vm.answerImportRows.length,0);
 f.vm.openOwnAnswerImport();f.vm.chooseAnswerFile({name:'mine.xlsx',size:10});f.vm.selectedSetId=99;await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.ownTemplate.length,0);assert.equal(f.calls.ownConfirm.length,0);
 const student=controllerFixture({isAdmin:false,canManage:false});await settle();student.vm.openOwnAnswerImport();assert.equal(student.vm.modal,undefined);assert.equal(student.vm.answerImportContext,undefined);
 const studio=controllerFixture({managementMode:false});await settle();studio.vm.openOwnAnswerImport();assert.equal(studio.vm.modal,undefined);
});

test('teachers without primary-class import permission use only self endpoints while student review stays selected',async()=>{
 const f=controllerFixture({isAdmin:false});await settle();f.vm.studentId=7;await f.vm.loadBank();f.vm.answerQuestionId=42;f.vm.adminClassId=21;f.vm.openAnswerImport(f.student);assert.equal(f.vm.modal,undefined);assert.equal(f.vm.answerImportContext,undefined);
 f.vm.openOwnAnswerImport();assert.equal(f.vm.modal,'answers');assert.equal(f.vm.answerImportContext.studentId,9);await f.vm.downloadAnswerTemplate();assert.deepEqual(f.calls.ownTemplate[0],[11]);f.vm.chooseAnswerFile({name:'teacher.xlsx',size:10});await f.vm.previewAnswers();await f.vm.confirmAnswers();
 assert.equal(f.calls.ownConfirm.length,1);assert.equal(f.calls.ownConfirm[0].studentId,undefined);assert.equal(f.vm.studentId,7);assert.equal(f.vm.answerQuestionId,42);assert.equal(f.calls.template.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);assert.equal(f.calls.roster.length,0);
 f.vm.answerImportContext={kind:'SELF',actorId:9,setId:11,classId:null,studentId:7};f.vm.modal='answers';f.vm.answerImportFile={name:'forged.xlsx'};await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.ownTemplate.length,1);assert.equal(f.calls.ownConfirm.length,1);
 f.vm.answerImportContext={kind:'CLASS',actorId:9,setId:11,classId:21,studentId:7};await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.template.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);
});

test('self import service endpoints send no selectable student identity',async()=>{
 const calls=[],$http={get(url,options){calls.push({method:'GET',url,options});return Promise.resolve({data:new ArrayBuffer(1)});},post(url,data,options){calls.push({method:'POST',url,data,options});return Promise.resolve({data:{}});}};
 const api=registered('question/business/SpeakingService.js').SpeakingService($http,{api:{baseUrl:'/backend/',apiV1Url:'api/'}});
 await api.ownAnswerTemplate(11);await api.previewOwnAnswers(11,new Blob(['xlsx']));await api.confirmOwnAnswers({setId:11,rows:[{questionId:42,html:'Mine',revision:0}]});
 assert.match(calls[0].url,/\/student-answers\/self\/template$/);assert.deepEqual(plain(calls[0].options.params),{setId:11});assert.match(calls[1].url,/\/student-answers\/self\/preview$/);assert.equal(calls[1].data.get('setId'),'11');assert.equal(calls[1].data.get('studentId'),null);assert.deepEqual([...calls[1].data.keys()],['setId','file']);
 assert.match(calls[2].url,/\/student-answers\/self\/confirm$/);assert.deepEqual(plain(calls[2].data),{setId:11,rows:[{questionId:42,html:'Mine',revision:0}]});
});

test('primary teachers use only their authorized class tree and class-scoped student import APIs',async()=>{
 const f=controllerFixture({isAdmin:false,canImportStudentAnswers:true,importClasses:[{id:21,name:'My primary class',schoolId:1,parentId:null},{id:90,name:'Other school',schoolId:2,parentId:null}]});await settle();assert.equal(f.vm.canUseClassRoster(),true);assert.deepEqual(plain(f.vm.classOptions).map(row=>row.id),[21]);
 f.vm.adminClassId=21;await f.vm.changeAdminClass();assert.deepEqual(f.calls.classRoster[0],[11,21,'',0,25]);assert.equal(f.calls.roster.length,0);const student=f.vm.adminStudentRows[0];assert.equal(f.vm.canImportStudent(student),true);await f.vm.viewAdminStudent(student);assert.equal(f.vm.studentId,7);assert.equal(f.vm.canImportViewedStudent(),true);
 f.vm.openAnswerImport(student);assert.equal(f.vm.modal,'answers');await f.vm.downloadAnswerTemplate();assert.deepEqual(f.calls.classTemplate[0],[11,7]);f.vm.chooseAnswerFile({name:'student.xlsx',size:10});await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.classPreview[0][1],7);assert.equal(f.calls.classConfirm[0].studentId,7);assert.equal(f.calls.template.length,0);assert.equal(f.calls.preview.length,0);assert.equal(f.calls.confirm.length,0);assert.equal(f.calls.classRoster.length,2);
});

test('primary teachers cannot import students outside the verified roster or classes they only teach',async()=>{
 const f=controllerFixture({isAdmin:false,canImportStudentAnswers:true,importClasses:[{id:21,name:'Primary',schoolId:1,parentId:null}]});await settle();f.vm.adminClassId=22;await f.vm.changeAdminClass();assert.equal(f.vm.adminClassId,null);assert.equal(f.calls.classRoster.length,0);
 f.vm.adminClassId=21;await f.vm.changeAdminClass();const student=f.vm.adminStudentRows[0];f.vm.openAnswerImport({...student,id:8});assert.notEqual(f.vm.modal,'answers');assert.equal(f.vm.canImportStudent({...student,id:8}),false);
 f.vm.openAnswerImport(student);f.vm.chooseAnswerFile({name:'student.xlsx',size:10});student.canImport=false;await f.vm.downloadAnswerTemplate();await f.vm.previewAnswers();await f.vm.confirmAnswers();assert.equal(f.calls.classTemplate.length,0);assert.equal(f.calls.classPreview.length,0);assert.equal(f.calls.classConfirm.length,0);
 student.canImport=true;await f.vm.viewAdminStudent(student);assert.equal(f.vm.canImportViewedStudent(),true);f.vm.studentId=8;await f.vm.loadBank();assert.equal(f.vm.adminViewedStudent,null);assert.equal(f.vm.canImportViewedStudent(),null);assert.equal(f.vm.canOpenAnswer(),true);
 const ordinary=controllerFixture({isAdmin:false});await settle();ordinary.vm.adminClassId=21;await ordinary.vm.changeAdminClass();await ordinary.vm.loadAdminStudents(0);ordinary.vm.openAnswerImport({...student,canImport:true});assert.equal(ordinary.calls.classRoster.length,0);assert.notEqual(ordinary.vm.modal,'answers');ordinary.vm.openOwnAnswerImport();assert.equal(ordinary.vm.modal,'answers');assert.equal(ordinary.vm.answerImportContext.kind,'SELF');
});

test('primary-class revocation, malformed capabilities and late roster responses cannot preserve import access',async()=>{
 const options={isAdmin:false,canImportStudentAnswers:true,importClasses:[{id:21,name:'Primary',schoolId:1,parentId:null}]},f=controllerFixture(options);await settle();f.vm.adminClassId=21;await f.vm.changeAdminClass();const student=f.vm.adminStudentRows[0];f.vm.openAnswerImport(student);f.vm.chooseAnswerFile({name:'student.xlsx',size:10});const waiting=deferred();f.api.previewClassAnswers=()=>waiting.promise;const preview=f.vm.previewAnswers();options.canImportStudentAnswers=false;await f.vm.createSet();await settle();waiting.resolve({setId:11,studentId:7,rows:[{questionId:42,html:'Late',revision:0,status:'NEW'}]});await preview;assert.equal(f.vm.adminClassId,null);assert.equal(f.vm.answerImportContext,null);assert.equal(f.vm.adminStudentRows.length,0);assert.equal(f.vm.answerImportRows.length,0);
 options.canImportStudentAnswers=true;await f.vm.createSet();await settle();f.vm.adminClassId=21;f.api.classStudents=(setId,classId,query,page,pageSize)=>Promise.resolve({setId,classId,page,pageSize,total:1,students:[f.student]});await f.vm.changeAdminClass();assert.equal(f.vm.adminStudentRows.length,0);assert.match(f.vm.adminRosterError,/không khớp/);
 const late=deferred();f.api.classStudents=()=>late.promise;const roster=f.vm.loadAdminStudents(0);f.vm.userId=10;late.resolve({setId:11,classId:21,page:0,pageSize:25,total:1,students:[{...f.student,canImport:true}]});await roster;assert.equal(f.vm.adminStudentRows.length,0);
});

test('class import service methods use distinct scoped endpoints and explicit target metadata',async()=>{
 const calls=[],$http={get(url,options){calls.push({url,options});return Promise.resolve({data:{}});},post(url,data,options){calls.push({url,data,options});return Promise.resolve({data:{}});}};
 const api=registered('question/business/SpeakingService.js').SpeakingService($http,{api:{baseUrl:'/backend/',apiV1Url:'api/'}});await api.classStudents(11,21,'Student',2,25);await api.classAnswerTemplate(11,7);await api.previewClassAnswers(11,7,new Blob(['xlsx']));await api.confirmClassAnswers({setId:11,studentId:7,rows:[]});
 assert.match(calls[0].url,/\/student-answers\/class\/students$/);assert.deepEqual(plain(calls[0].options.params),{setId:11,classId:21,query:'Student',page:2,pageSize:25});assert.match(calls[1].url,/\/class\/template$/);assert.deepEqual(plain(calls[1].options.params),{setId:11,studentId:7});assert.match(calls[2].url,/\/class\/preview$/);assert.equal(calls[2].data.get('setId'),'11');assert.equal(calls[2].data.get('studentId'),'7');assert.match(calls[3].url,/\/class\/confirm$/);assert.deepEqual(plain(calls[3].data),{setId:11,studentId:7,rows:[]});
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

test('Speaking Studio opens personal answers for students, teachers and admins and discards a selected student context',async()=>{
 for(const role of [{isAdmin:true},{isAdmin:false},{isAdmin:false,canManage:false}]){
  const f=controllerFixture({managementMode:false,...role});await settle();
  assert.equal(f.vm.managementMode,false);assert.equal(f.vm.canReviewStudents(),false);assert.equal(f.calls.roster.length,0);assert.equal(f.calls.students.length,0);
  assert.deepEqual(f.calls.bank[0],[11,null]);assert.deepEqual(f.calls.history[0],[null,null]);
  f.vm.toggleAnswer(f.vm.questions[0]);assert.equal(f.vm.answerQuestionId,42);assert.equal(f.vm.answerStudentId(),9);assert.equal(f.vm.answerStudentLabel(),'Câu trả lời của tôi');
  f.vm.studentId=7;f.vm.adminViewedStudent=f.student;await f.vm.loadBank();assert.equal(f.vm.studentId,null);assert.equal(f.vm.adminViewedStudent,null);assert.deepEqual(f.calls.bank.at(-1),[11,null]);assert.deepEqual(f.calls.history.at(-1),[null,null]);
  f.vm.studentId=7;await f.vm.markPass(f.vm.questions,true);assert.equal(f.calls.pass.length,0);
 }
});

test('Speaking Studio never invokes management APIs even for an admin bank owner',async()=>{
 const f=controllerFixture({managementMode:false});await settle();f.set.canManage=true;f.vm.adminClassId=21;f.vm.studentId=7;
 for(const name of ['create','share','import','answers']){f.vm.openModal(name);assert.equal(f.vm.modal,undefined);}
 await f.vm.createSet();await f.vm.saveShare();f.vm.chooseFile({name:'bank.xlsx',size:10});f.vm.importFile={name:'bank.xlsx'};await f.vm.previewFile();await f.vm.confirmImport();await f.vm.exportSet();
 await f.vm.loadAdminStudents(0);await f.vm.loadStudents('');await f.vm.viewAdminStudent(f.student);f.vm.openAnswerImport(f.student);await f.vm.downloadAnswerTemplate(f.student);
 f.vm.answerImportContext={setId:11,classId:21,studentId:7};f.vm.answerImportFile={name:'answers.xlsx'};f.vm.answerImportRows=[{selected:true,status:'NEW',questionId:42,html:'Text',revision:0}];await f.vm.previewAnswers();await f.vm.confirmAnswers();
 for(const action of ['create','share','import','roster','students','template','preview','confirm'])assert.equal(f.calls[action].length,0,action);
});

test('staff can mark their own Pass only with the explicit capability and never use a forged student context in Studio',async()=>{
 for(const isAdmin of [true,false]){
  const f=controllerFixture({managementMode:false,isAdmin});await settle();assert.equal(f.vm.canMarkPass(),false);
  f.set.canMarkOwnPass=true;assert.equal(f.vm.canMarkPass(),true);assert.equal(f.vm.canReviewStudents(),false);
  const group=f.vm.groups[0];group.lazyLoaded=true;f.vm.answerQuestionId=42;f.vm.notebookQuestionId=42;f.vm.studentId=77;
  await f.vm.markPass(f.vm.questions,true);assert.equal(f.calls.pass[0].studentId,9);assert.equal(f.vm.questions[0].passed,true);assert.equal(group.passed,1);
  assert.equal(f.vm.groups[0],group);assert.equal(group.lazyLoaded,true);assert.equal(f.vm.answerQuestionId,42);assert.equal(f.vm.notebookQuestionId,42);
  await f.vm.markPass(f.vm.questions,false);assert.equal(f.vm.questions[0].passed,false);assert.equal(group.passed,0);
  await f.vm.markPass([{id:42},{id:999}],true);assert.equal(f.calls.pass.length,2);
 }
 const student=controllerFixture({managementMode:false,isAdmin:false,canManage:false});await settle();student.set.canMarkOwnPass=true;
 assert.equal(student.vm.canMarkPass(),false);await student.vm.markPass(student.vm.questions,true);assert.equal(student.calls.pass.length,0);
});

test('self Pass waits for an exact acknowledgement and an old bank receipt cannot update newly loaded questions',async()=>{
 const f=controllerFixture({managementMode:false});await settle();f.set.canMarkOwnPass=true;
 f.api.markPass=()=>Promise.resolve({updated:1,studentId:7,passed:true});await f.vm.markPass(f.vm.questions,true);assert.equal(f.vm.questions[0].passed,false);assert.match(f.vm.error,/Chưa xác nhận/);
 const wait=deferred();f.api.markPass=()=>wait.promise;const pending=f.vm.markPass(f.vm.questions,true);
 await f.vm.loadBank();wait.resolve({updated:1,studentId:9,passed:true});await pending;assert.equal(f.vm.questions[0].passed,false);assert.equal(f.vm.groups[0].passed,0);
});

test('management routes reject students while a shared teacher bank still permits manual review',async()=>{
 const f=controllerFixture({canManage:false,isAdmin:false});await settle();assert.equal(f.vm.sets.length,0);assert.equal(f.calls.bank.length,0);assert.match(f.vm.error,/Chỉ giáo viên và admin/);await f.vm.createSet();assert.equal(f.calls.create.length,0);
 const g=controllerFixture({isAdmin:false});await settle();g.vm.studentId=7;await g.vm.loadBank();assert.equal(g.vm.canOpenAnswer(),true);assert.equal(g.vm.answerStudentId(),7);g.vm.toggleAnswer(g.vm.questions[0]);assert.equal(g.vm.answerQuestionId,42);
});

test('admin class trees retain only school one and reject forged, removed or foreign selections',async()=>{
 const classes=[{id:21,name:'IELTSRoom',schoolId:1,parentId:null},{id:22,name:'Child',schoolId:1,parentId:21},{id:23,name:'Other',schoolId:2,parentId:null},{id:24,name:'Unknown',schoolId:null}],f=controllerFixture({classes});await settle();
 assert.deepEqual(plain(f.vm.classes).map(c=>c.id),[21,22]);assert.equal(f.vm.classes[1].parentId,21);assert.equal(f.vm.directorySchoolId,1);
 for(const id of [23,24,99,'bad']){f.vm.adminClassId=id;await f.vm.changeAdminClass();assert.equal(f.vm.adminClassId,null);assert.equal(f.calls.roster.length,0);}
 f.vm.adminClassId=21;await f.vm.changeAdminClass();await f.vm.viewAdminStudent(f.student);f.vm.openAnswerImport(f.student);assert.equal(f.vm.studentId,7);assert.equal(f.vm.modal,'answers');
 f.vm.adminClassId=23;await f.vm.loadAdminStudents(0);assert.equal(f.vm.adminClassId,null);assert.equal(f.vm.studentId,null);assert.equal(f.vm.answerImportContext,null);assert.equal(f.vm.modal,null);assert.equal(f.vm.adminStudentRows.length,0);
 f.vm.adminClassId=22;await f.vm.changeAdminClass();await f.vm.viewAdminStudent(f.student);classes[1].schoolId=2;await f.vm.createSet();await settle();assert.equal(f.vm.adminClassId,null);assert.equal(f.vm.studentId,null);assert.equal(f.vm.adminStudentRows.length,0);assert.deepEqual(plain(f.vm.classes).map(c=>c.id),[21]);
});

test('separate Speaking routes keep imports in management and reuse the school-scoped tree picker',()=>{
 const html=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8'),route=fs.readFileSync(path.join(app,'question/question.module.js'),'utf8');
 assert.match(route,/state\('application\.speaking',[\s\S]*?speakingManagement: false/);assert.match(route,/state\('application\.create_speaking_test',[\s\S]*?url: '\/create_speaking_test\?set&part'[\s\S]*?speakingManagement: true/);
 assert.match(route,/common\/directives\/ClassTreePicker\.js/);assert.match(route,/common\/class-tree-picker\.css/);assert.match(html,/<class-tree-picker[^>]+ng-model="vm.adminClassId"[^>]+school-id="vm.directorySchoolId"/);assert.doesNotMatch(html,/<select[^>]+ng-model="vm.adminClassId"/);
 assert.match(html,/ui-sref="application\.speaking\(\{set:vm.selectedSetId,part:vm.part,practice:null\}\)"/);assert.match(html,/ui-sref="application\.create_speaking_test\(\{set:vm.selectedSetId,part:vm.part\}\)"/);
 assert.match(html,/ng-if="vm.canUseClassRoster\(\) && vm.selectedSet"/);assert.match(html,/ng-if="!vm.managementMode"[^>]+ng-click="vm.openPracticeSetup\(\)"/);
});

test('live synchronization applies rich text, notes and highlights to a clean viewing session',async()=>{
 const f=fixture(),s=f.session();await s.load();const remote={...context,revision:2,html:'<span class="ielts-annotation has-note is-highlighted" data-note-id="n1"><b>Corrected</b></span>',notes:[{id:'n1',text:'Teacher note'}]};
 f.api.studentAnswerSync=(...args)=>{assert.deepEqual(args,[11,7,42,1]);return Promise.resolve({...context,revision:2,changed:true,answer:remote});};
 assert.equal(await s.refresh(),true);assert.equal(s.state.html,remote.html);assert.deepEqual(plain(s.state.notes),remote.notes);assert.equal(s.state.revision,2);assert.equal(s.state.dirty,false);assert.equal(f.calls.length,0);
});

test('a live remote correction preserves an unsaved local draft and asks to compare instead of overwriting it',async()=>{
 const f=fixture(),s=f.session();await s.load();s.change('<u>Student draft</u>',[]);f.api.studentAnswerSync=()=>Promise.resolve({...context,revision:2,changed:true,answer:{...context,html:'Teacher version',notes:[],revision:2}});await s.refresh();
 assert.equal(s.state.html,'<u>Student draft</u>');assert.equal(s.state.conflict,true);assert.equal(s.state.remote.html,'Teacher version');assert.equal(s.state.revision,1);assert.equal(f.storage.size,1);await s.save();assert.equal(f.calls.length,0);
});

test('a notebook-only revision change rebases a pending text edit without a false conflict',async()=>{
 const f=fixture(),s=f.session();await s.load();s.change('Still typing',[]);f.api.studentAnswerSync=()=>Promise.resolve({...context,revision:2,changed:true,answer:{...f.remote(),revision:2}});await s.refresh();
 assert.equal(s.state.html,'Still typing');assert.equal(s.state.revision,2);assert.equal(s.state.conflict,false);assert.equal(s.state.dirty,true);await s.save();assert.equal(f.calls[0].revision,2);assert.equal(f.calls[0].html,'Still typing');
});

test('live refresh rejects another answer, does not interrupt composition and ignores an older receipt after a save',async()=>{
 const f=fixture(),s=f.session();await s.load();f.api.studentAnswerSync=()=>Promise.resolve({...context,studentId:99,revision:2,changed:true,answer:{...f.remote(),revision:2}});await s.refresh();assert.match(s.state.syncError,/không khớp/);assert.equal(s.state.revision,1);
 f.api.studentAnswerSync=()=>Promise.resolve({...context,revision:2,changed:true,answer:{...f.remote(),html:'New text',revision:2}});await s.refresh(()=>false);assert.equal(s.state.html,'<p>Original</p>');assert.equal(s.state.revision,1);await s.refresh(()=>true);assert.equal(s.state.html,'New text');
 const wait=deferred();f.api.studentAnswerSync=()=>wait.promise;const first=s.refresh(),second=s.refresh();assert.equal(first,second);s.change('Local edit',[]);await s.save();wait.resolve({...context,revision:2,changed:false});await first;assert.equal(s.state.html,'Local edit');assert.equal(s.state.revision,3);
});

test('late synchronization and history responses cannot update a closed session',async()=>{
 const f=fixture(),s=f.session();await s.load();const wait=deferred(),history=deferred();f.api.studentAnswerSync=()=>wait.promise;f.api.studentAnswerHistory=()=>history.promise;const refresh=s.refresh(),load=s.loadHistory();s.destroy();
 wait.resolve({...context,revision:9,changed:true,answer:{...f.remote(),html:'Late response',revision:9}});history.resolve({...context,currentRevision:9,versions:[{id:1,revision:9}]});await Promise.all([refresh,load]);assert.equal(s.state.html,'<p>Original</p>');assert.equal(s.state.history.versions.length,0);
});

test('history preview is scoped and restoration pins the viewed checkpoint and current answer revisions',async()=>{
 const f=fixture(),s=f.session();await s.load();let restored;
 f.api.studentAnswerHistory=()=>Promise.resolve({...context,currentRevision:1,checkpointMinutes:10,retainedLimit:5,retentionDays:14,versions:[{id:17,revision:4,editorId:9,source:'EDIT'}]});
 f.api.studentAnswerVersion=()=>Promise.resolve({...context,version:{id:17,revision:4,html:'<b>Old answer</b>',notes:[{id:'n1',text:'Old note'}],notebook:{text:'Old sketch',orientation:'portrait',pattern:'lined',strokes:[]}}});
 f.api.restoreStudentAnswer=payload=>{restored=plain(payload);return Promise.resolve({...context,html:'<b>Old answer</b>',notes:[{id:'n1',text:'Old note'}],revision:2,restoredVersionId:17});};
 await s.loadHistory();await s.previewVersion(17);assert.equal(s.state.history.preview.notebook.text,'Old sketch');await s.restoreVersion();assert.deepEqual(restored,{setId:11,studentId:7,questionId:42,versionId:17,versionRevision:4,revision:1});assert.equal(s.state.html,'<b>Old answer</b>');assert.equal(s.state.revision,2);assert.equal(s.state.dirty,false);
 f.api.studentAnswerVersion=()=>Promise.resolve({...context,studentId:99,version:{id:17,revision:4,html:'Private',notes:[]}});await s.previewVersion(17);assert.equal(s.state.history.preview,null);assert.match(s.state.history.error,/không khớp/);
});

test('restoring a history checkpoint never discards a dirty draft, a later edit or an unacknowledged server restore',async()=>{
 const f=fixture(),s=f.session();await s.load();s.state.history.preview={id:17,revision:1,html:'Old',notes:[]};let calls=0;const wait=deferred();f.api.restoreStudentAnswer=()=>{calls++;return wait.promise;};
 s.change('Not saved',[]);await s.restoreVersion();assert.equal(calls,0);assert.equal(s.state.html,'Not saved');await s.save();const restore=s.restoreVersion();s.change('A newer draft',[]);wait.resolve({...context,html:'Old',notes:[],revision:3,restoredVersionId:17});await restore;assert.equal(s.state.html,'A newer draft');assert.equal(s.state.conflict,true);assert.equal(f.storage.size,1);
 const g=fixture(),t=g.session();await t.load();t.state.history.preview={id:17,revision:1};g.api.restoreStudentAnswer=()=>Promise.resolve({...context,html:'Wrong acknowledgement',notes:[],revision:2,restoredVersionId:99});await t.restoreVersion();assert.equal(t.state.html,'<p>Original</p>');assert.match(t.state.history.error,/Chưa nhận đúng/);
});

test('inline note deletion preserves highlighted text and autosave has no manual save button',async()=>{
 const listeners={},timers=new Map();let nextTimer=0,identity,destroy,changed;
 const classes=new Set(['ielts-annotation','has-note','is-highlighted']);const attrs={'data-note-id':'n1','data-annotation-group':'g1'};
 const marker={classList:{remove:name=>classes.delete(name),contains:name=>classes.has(name)},getAttribute:name=>attrs[name]||null,removeAttribute:name=>delete attrs[name],get className(){return[...classes].join(' ');}};
 const editable={innerHTML:'<span class="ielts-annotation has-note is-highlighted" data-note-id="n1"><b>Keep me</b></span>',setAttribute(){},querySelectorAll:()=>[marker],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){},contains:()=>false};
 const root={querySelector:()=>editable,contains:()=>false},doc={hidden:false,addEventListener(){},removeEventListener(){},activeElement:null};
 const state={ready:true,loading:false,dirty:false,html:editable.innerHTML,notes:[{id:'n1',text:'Delete this'}],revision:1,history:{versions:[]}};
 const session={state,load:()=>Promise.resolve(),change(html,notes){changed={html,notes:plain(notes)};state.dirty=true;},save:()=>Promise.resolve(),refresh:()=>Promise.resolve(),destroy(){},backup(){}};
 const timeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};timeout.cancel=id=>timers.delete(id);
 const win={document:doc,addEventListener(){},removeEventListener(){},getSelection:()=>({rangeCount:0})},scope={$evalAsync:fn=>fn(),$watchGroup(names,fn){identity=fn;},$on(name,fn){destroy=fn;}};
 const directive=editor.speakingStudentAnswerEditor(win,timeout,{open:()=>session});directive.link(scope,[root]);identity([11,7,42,9]);await settle();scope.ed.activeNote=state.notes[0];scope.ed.deleteNote();
 assert.equal(attrs['data-note-id'],undefined);assert.equal(classes.has('has-note'),false);assert.equal(classes.has('is-highlighted'),true);assert.equal(classes.has('ielts-annotation'),true);assert.deepEqual(changed.notes,[]);assert.match(changed.html,/<b>Keep me<\/b>/);assert.ok([...timers.values()].some(timer=>timer.delay===1300));
 assert.match(directive.template,/Xóa ghi chú/);assert.doesNotMatch(directive.template,/Lưu câu trả lời/);assert.match(directive.template,/Thử đồng bộ lại/);destroy();assert.equal(timers.size,0);
});

test('history enforces five recent checkpoints and an expired restore preserves the current answer',async()=>{
 const f=fixture(),s=f.session();await s.load();const valid={...context,currentRevision:1,checkpointMinutes:10,retainedLimit:5,retentionDays:14,versions:[{id:17,revision:1}]};
 f.api.studentAnswerHistory=()=>Promise.resolve(valid);await s.loadHistory();assert.equal(s.state.history.versions.length,1);
 for(const wrong of [{...valid,retainedLimit:20},{...valid,retentionDays:30},{...valid,versions:Array.from({length:6},(_,i)=>({id:i+1,revision:i+1}))}]){f.api.studentAnswerHistory=()=>Promise.resolve(wrong);await s.loadHistory();assert.match(s.state.history.error,/không khớp/);}
 s.state.history.preview={id:17,revision:1,html:'An expired answer',notes:[]};f.api.restoreStudentAnswer=()=>Promise.reject({status:404,data:{message:'Phiên bản đã hết hạn hoặc không còn được lưu.'}});await s.restoreVersion();assert.equal(s.state.html,'<p>Original</p>');assert.equal(s.state.revision,1);assert.match(s.state.history.error,/hết hạn/);assert.equal(s.state.dirty,false);
 const directive=editor.speakingStudentAnswerEditor({document:{}},{},{});assert.match(directive.template,/tối đa 5 mốc trong 14 ngày gần nhất/);assert.doesNotMatch(directive.template,/Giữ 20 mốc/);
});

test('history notebook previews include ink below the first A4 page and all wrapped text at canonical scale',()=>{
 const paper={orientation:'portrait',pattern:'lined',text:'Long notes',strokes:[{points:[[15,1600,.5],[25,2400,.7]]}]},before=plain(paper),geometry=fixture().store.previewGeometry(paper,397,0,2);
 assert.equal(geometry.logicalWidth,794);assert.equal(geometry.logicalHeight,2424);assert.equal(geometry.scale,.5);assert.equal(geometry.cssHeight,1212);assert.ok(2400*geometry.scale<geometry.cssHeight);assert.ok(2400*geometry.rasterScale<geometry.pixelsHigh);assert.deepEqual(paper,before);
 const fullText=fixture().store.previewGeometry(paper,397,4000,2);assert.ok(fullText.cssHeight>=4000);assert.ok(fullText.logicalHeight>=8000);
 const directive=editor.speakingStudentAnswerEditor({document:{}},{},{});assert.match(directive.template,/sp-version-paper-scroll/);const css=fs.readFileSync(path.join(app,'question/speaking.css'),'utf8');assert.match(css,/\.sp-version-paper-scroll\s*\{[^}]*overflow:auto/);
});

test('extreme notebook history coordinates stay visible while raster memory and dimensions remain bounded',()=>{
 const geometry=fixture().store.previewGeometry({orientation:'portrait',strokes:[{points:[[10,100000,.5]]}]},794,0,4);
 assert.ok(geometry.logicalHeight>100000);assert.ok(100000*geometry.rasterScale<geometry.pixelsHigh);assert.ok(geometry.pixelsWide*geometry.pixelsHigh<=4000000);assert.ok(Math.max(geometry.pixelsWide,geometry.pixelsHigh)<=8192);
 const longText=fixture().store.previewGeometry({orientation:'landscape',strokes:[]},1123,500000,3);assert.ok(longText.cssHeight>=500000);assert.ok(longText.pixelsWide*longText.pixelsHigh<=4000000);assert.ok(Math.max(longText.pixelsWide,longText.pixelsHigh)<=8192);
 const invalid=fixture().store.previewGeometry({orientation:'portrait',strokes:[{points:[[0,Infinity],[1,100001],[-1,3]]}]},397,0,2);assert.equal(invalid.logicalHeight,1123);
});
