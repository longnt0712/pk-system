const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.resolve(__dirname,'..'),clone=v=>JSON.parse(JSON.stringify(v));
const programs=[{id:3,name:'New',main:false},{id:2,name:'Middle',main:false},{id:1,name:'Main',main:true}];
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function registration(file,name){let constructor;const module={controller(n,fn){if(n===name)constructor=fn;return this;},directive(){return this;},filter(){return this;},service(n,fn){if(n===name)constructor=fn;return this;}};
 const angular={module:()=>module,noop(){},copy:clone,isArray:Array.isArray,forEach:(items,fn)=>(items||[]).forEach(fn),extend:Object.assign};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,file),'utf8'),{angular,console:{log(){},debug(){}},Date,JSON,Math,Number,window:{location:{hostname:'tnttphungkhoang.com'},addEventListener(){},removeEventListener(){}},document:{}});return constructor;}
function controller(file,name,service,permissions={isAdmin:true}){const create=registration(file,name),scope={$on(){return()=>{};},$watch(){return()=>{};},$watchGroup(){return()=>{};}},root={settings:{layout:{},api:{baseUrl:'',apiPrefix:''},...permissions}},timer=()=>{};timer.cancel=()=>{};const vm={};
 create.call(vm,root,scope,{success(){},info(){},warning(){},error(){}},timer,root.settings,{}, {},service,{}, {start(){},stop(){}},()=>v=>v);return{vm,scope,root};}
test('student_marks selects Main instead of the first returned program and keeps a fallback for legacy lists',async()=>{
 for(const withMain of [true,false]){const calls=[],rows=programs.map(p=>({...p,main:withMain&&p.main}));
  const {vm}=controller('student_mark/controllers/StudentMarkController.js','StudentMarkController',{getAllGroups:()=>Promise.resolve([]),getEnrolmentClass:()=>Promise.resolve({content:[{id:10,name:'Class',schoolId:2}]}),getEducationPrograms:()=>Promise.resolve({content:rows}),getListDisplayStudentMark:d=>{calls.push(clone(d));return Promise.resolve([]);}});
  await tick();assert.equal(vm.searchDisplayDto.educationProgramId,withMain?1:3);assert.equal(calls.length,1);assert.equal(calls[0].educationProgramId,withMain?1:3);
 }
});
test('student_marks does not load a phantom class or all students when the class catalog is empty or belongs to another school',async()=>{
 for(const classes of [[],[{id:1,name:'IELTS only',schoolId:1}]]){
  const calls=[];const {vm}=controller('student_mark/controllers/StudentMarkController.js','StudentMarkController',{getAllGroups:()=>Promise.resolve([]),getEnrolmentClass:()=>Promise.resolve({content:classes}),getEducationPrograms:()=>Promise.resolve({content:programs}),getListDisplayStudentMark:d=>{calls.push(clone(d));return Promise.resolve([]);}});
  await tick();assert.equal(calls.length,0);assert.equal(vm.searchDisplayDto.enrollmentClass,null);assert.equal(vm.studentMarks.length,0);assert.match(vm.boardHint,/Chọn lớp/);
 }
});
test('marks selects Main and an older unfiltered page cannot replace the filtered result',async()=>{
 const initial=deferred(),calls=[],orders=[];const {vm}=controller('mark/controllers/MarkController.js','MarkController',{getTableDefinition:()=>[],getPage:d=>{calls.push(clone(d));return calls.length===1?initial.promise:Promise.resolve({content:[{id:77,name:'Main mark'}],totalElements:1});},getPageEducationProgram:()=>Promise.resolve({content:programs}),getOrderedMarks:id=>{orders.push(id);return Promise.resolve([]);}});
 await tick();assert.equal(vm.searchDto.educationProgram.id,1);assert.deepEqual(orders,[1]);assert.equal(calls[1].educationProgram.id,1);
 initial.resolve({content:[{id:999,name:'Stale all-program mark'}],totalElements:1});await tick();assert.equal(vm.marks[0].id,77);
});
test('a manually selected marks program survives a delayed program-list response',async()=>{
 const list=deferred();const {vm}=controller('mark/controllers/MarkController.js','MarkController',{getTableDefinition:()=>[],getPage:()=>Promise.resolve({content:[],totalElements:0}),getPageEducationProgram:()=>list.promise,getOrderedMarks:()=>Promise.resolve([])});
 vm.searchDto.educationProgram=programs[0];list.resolve({content:programs});await tick();assert.equal(vm.searchDto.educationProgram.id,3);
});
test('changing Main uses its dedicated action and read-only managers cannot send the action',async()=>{
 for(const allowed of [true,false]){let rows=clone(programs);const writes=[];const {vm,scope}=controller('education_program/controllers/EducationProgramController.js','EducationProgramController',{getTableDefinition:()=>[],getPage:()=>Promise.resolve({content:clone(rows),totalElements:rows.length}),setMain:id=>{writes.push(id);rows.forEach(p=>p.main=p.id===id);return Promise.resolve(rows.find(p=>p.id===id));}},allowed?{isAdmin:true}:{isStudentManagerment:true});
  await tick();await scope.setMainProgram(3);await tick();assert.equal(writes.length,allowed?1:0);assert.equal(vm.educationPrograms.filter(p=>p.main).length,1);assert.equal(vm.educationPrograms.find(p=>p.main).id,allowed?3:1);assert.equal(vm.mainSaving,false);
 }
});
test('saving metadata from an older edit form does not send its stale Main flag',async()=>{
 const create=registration('education_program/business/EducationProgramService.js','EducationProgramService'),sent=[];const service={};
 create.call(service,{}, {when:Promise.resolve.bind(Promise)},()=>v=>v,{api:{baseUrl:'/service/',apiV1Url:'api/'}},{resolveAlt(...args){sent.push(args);return Promise.resolve(true);}});
 await service.saveObject({id:1,name:'Rename only',main:true});assert.equal(Object.hasOwn(sent[0][3],'main'),false);assert.equal(sent[0][3].name,'Rename only');
});
