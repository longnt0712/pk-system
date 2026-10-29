const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dashboards/controllers/DashboardController.js'),'utf8').replace(/\r\n/g,'\n');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function chunk(from,to){const a=source.indexOf(from),b=source.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,from);return source.slice(a,b);}
function storage(initial={}){
 const values=new Map(Object.entries(initial).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
 return{values,get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
}
const keys=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const attempt='a'.repeat(32);
const base=key=>'ieltsReadingInProgress:7:comprehensive:test:42:serious:task:10:parts:1'+(key?':section:'+key:'');
function draft(key,sectionNumber=1,extra={}){
 return{userId:7,testId:42,testMode:'COMPREHENSIVE',sessionMode:'SERIOUS',assignmentTaskId:10,assignmentPart:1,assignmentParts:[1],isPartAssignment:true,
  assignmentSectionKey:key,sectionNumber,sectionCount:4,sectionQuestionCount:50,clientAttemptKey:attempt,title:'Big exercise',answeredCount:20,totalQuestions:50,
  savedAt:'2026-10-29T10:00:00Z',elapsedSeconds:300,remainingSeconds:900,...extra};
}
function receipt(key,status='PENDING'){
 const payload={clientAttemptKey:attempt,user:{id:7},testType:6,sourceQuestionId:42,assignmentTaskId:10,completedParts:[1]};
 if(key)payload.assignmentSectionKey=key;
 return{key:attempt,status,payload,result:{...payload,id:91}};
}
function fixture(initial={}){
 const local=storage(initial),session=storage(),routes=[],posts=[],events=[];
 const c=nodeVm.createContext({vm:{myUser:{id:7},resumeDrafts:[]},settings:{api:{baseUrl:'/api/',apiV1Url:''}},Date,Math,Number,String,JSON,
  angular:{isArray:Array.isArray,copy:structuredClone,noop(){},forEach:(items,fn)=>Object.entries(items||{}).forEach(([key,value])=>fn(value,key))},
  $window:{localStorage:local,sessionStorage:session,confirm:()=>true},$state:{go(name,params){routes.push({name,params:plain(params)});}},
  $http:{get:()=>Promise.resolve({data:[]}),post(url,payload){posts.push({url,payload:plain(payload)});return Promise.resolve({data:true});}},
  $rootScope:{$broadcast(name,data){events.push({name,data});}}});
 nodeVm.runInContext(chunk('        vm.assignmentKey =','        function ieltsReminderParts('),c);
 nodeVm.runInContext(chunk('        function ieltsReminderParts(','        vm.loadCurrentUserFromCookie ='),c);
 return{vm:c.vm,c,local,session,routes,posts,events};
}
function card(key,number,done=0){return{activityType:'COMPREHENSIVE',taskId:10,ieltsTestId:42,ieltsPart:1,ieltsParts:[1],assignmentSectionKey:key,sectionNumber:number,sectionCount:4,
 sectionQuestionCount:50,sectionFirstOrdinal:(number-1)*50+1,sectionLastOrdinal:number*50,requiredAttempts:1,completedAttempts:done,remainingAttempts:1-done,taskProgressPercent:25,comprehensiveTimeLimitMinutes:20};}

test('four cards retain one parent task and unique section identities; passing one does not block its siblings',()=>{
 const f=fixture(),cards=keys.map((key,index)=>card(key,index+1,index===0?1:0));
 assert.equal(new Set(cards.map(f.vm.assignmentKey)).size,4);
 cards.forEach(item=>f.vm.openAssignedTask(item));assert.equal(f.routes.length,3);
 assert.deepEqual(f.routes.map(route=>route.params.assignmentSectionKey),keys.slice(1));
 assert.ok(f.routes.every(route=>route.name==='application.comprehensive_actual_test'&&route.params.assignmentTaskId===10&&route.params.ieltsReadingTestId===42&&route.params.assignmentParts==='1'&&route.params.sessionMode==='SERIOUS'));
 assert.equal(f.vm.assignmentTopicComplete(cards[0]),true);assert.equal(f.vm.assignmentTopicComplete(cards[1]),false);
 assert.equal(f.vm.assignmentProgressPercent(cards[0]),100);assert.equal(f.vm.assignmentProgressPercent(cards[1]),0);
 assert.ok(cards.every(item=>f.vm.assignmentTaskProgressPercent(item)===25));
 assert.equal(f.vm.assignmentActionLabel(cards[1]),'Làm phần 2');assert.equal(f.vm.assignmentPartsLabel(cards[1]),'Phần 2/4');
});
test('timed and untimed Comprehensive labels use the assignment settings and leave legacy routes intact',()=>{
 const f=fixture();assert.equal(f.vm.assignmentTimeLabel({comprehensiveTimeLimitMinutes:0}),'Không tính giờ');assert.equal(f.vm.assignmentTimeLabel({comprehensiveTimeLimitMinutes:35}),'35 phút');
 assert.equal(f.vm.assignmentTimeLabel({}),'Theo thời gian của đề');assert.equal(f.vm.assignmentTaskProgressPercent({taskProgressPercent:133}),100);
 const old={activityType:'COMPREHENSIVE',taskId:10,ieltsTestId:42,ieltsPart:1,ieltsParts:[1]};f.vm.openAssignedTask(old);
 assert.equal(Object.hasOwn(f.routes[0].params,'assignmentSectionKey'),false);assert.equal(f.vm.assignmentKey(old),'10:topic:none');assert.equal(f.vm.assignmentActionLabel(old),'Làm bài được giao');
});
test('local drafts and pending receipts deduplicate within their own section while preserving sibling work',async()=>{
 const first=draft(keys[0]),pending=draft(keys[0],1,{submissionState:receipt(keys[0])}),second=draft(keys[1],2);
 const f=fixture({[base(keys[0])]:first,[base(keys[0])+':attempt:'+attempt]:pending,[base(keys[1])]:second});f.vm.loadResumeDrafts();await tick();
 assert.equal(f.vm.resumeDrafts.length,2);const one=f.vm.resumeDrafts.find(item=>item.assignmentSectionKey===keys[0]),two=f.vm.resumeDrafts.find(item=>item.assignmentSectionKey===keys[1]);
 assert.equal(one.pendingSave,true);assert.equal(two.pendingSave,false);assert.notEqual(one.ieltsContext,two.ieltsContext);assert.equal(one.assignmentTaskId,10);
 await f.vm.cancelDraft(one);await tick();assert.equal(f.local.values.has(base(keys[1])),true);assert.equal(f.vm.resumeDrafts.length,1);assert.equal(f.vm.resumeDrafts[0].assignmentSectionKey,keys[1]);
 assert.ok(f.posts.every(post=>post.payload.draftKey.includes(':section:'+keys[0])));
});
test('a saved receipt must match the section as well as task, source, user and attempt before it can hide a draft',async()=>{
 const wrong=draft(keys[0],1,{submissionState:receipt(keys[1],'SAVED')});const info=fixture().c;
 info.value=wrong;assert.equal(nodeVm.runInContext('ieltsReminderInfo("'+base(keys[0])+'",value).confirmed',info),false);
 const first=draft(keys[0],1,{submissionState:receipt(keys[0],'SAVED')}),second=draft(keys[1],2);
 const f=fixture({[base(keys[0])]:first,[base(keys[0])+':attempt:'+attempt]:first,[base(keys[1])]:second});f.vm.loadResumeDrafts();await tick();
 assert.equal(f.vm.resumeDrafts.length,1);assert.equal(f.vm.resumeDrafts[0].assignmentSectionKey,keys[1]);
});
test('resuming an untimed section keeps its exact route and marker, and restores elapsed time rather than a countdown',async()=>{
 const value=draft(keys[2],3,{assignmentUntimed:true,comprehensiveTimeLimitMinutes:0,remainingSeconds:0,elapsedSeconds:720});const f=fixture({[base(keys[2])]:value});
 f.vm.loadResumeDrafts();await tick();const entry=f.vm.resumeDrafts[0];assert.equal(entry.assignmentUntimed,true);assert.equal(entry.elapsedSeconds,720);assert.equal(entry.sectionNumber,3);assert.equal(entry.sectionCount,4);
 f.vm.resumeDraft(entry);assert.equal(f.routes[0].params.assignmentSectionKey,keys[2]);assert.equal(f.routes[0].params.sessionMode,'SERIOUS');
 const marker=JSON.parse(f.session.values.get('ielts-draft-resume:v1:7'));assert.equal(marker.assignmentSectionKey,keys[2]);assert.equal(marker.draftKey,base(keys[2]));assert.equal(marker.assignmentTaskId,10);
});
test('section identity can be recovered from a persisted key while contradictory metadata cannot acknowledge another section',()=>{
 const f=fixture();f.c.value=draft(undefined);let info=nodeVm.runInContext('ieltsReminderInfo("'+base(keys[0])+'",value)',f.c);assert.equal(info.sectionKey,keys[0]);assert.equal(info.taskId,10);
 f.c.value=draft(keys[1],2,{submissionState:receipt(keys[1],'SAVED')});info=nodeVm.runInContext('ieltsReminderInfo("'+base(keys[0])+'",value)',f.c);assert.equal(info.confirmed,false);assert.equal(info.pending,false);assert.equal(info.sectionKey,keys[0]);
});
