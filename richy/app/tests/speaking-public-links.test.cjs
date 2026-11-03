const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..'),token='a'.repeat(43),bank={shareId:91,setId:11,studentId:7,canEdit:false,questions:[{id:42,entryId:4,part:2,topic:'Cake',prompt:'Describe a cake'}]};
function fixture(options={}){
 let factory;const calls=[];const module={factory(n,d){factory=d.at(-1);return this;},controller(){return this;}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,'speaking/shared.js'),'utf8'),{angular:{module:()=>module}});
 const data={...structuredClone(bank),...options.bank};
 const api=factory(config=>{calls.push(config);return Promise.resolve({data:config.url==='/service/public/speaking'?data:{saved:true}});},{reject:Promise.reject.bind(Promise)},{location:{hash:'#'+(options.token??token)}});
 return{api,calls};
}
test('public page uses a header capability without login credentials or URL token',async()=>{
 const f=fixture();await f.api.bootstrap();await f.api.studentAnswers(11,7,42);
 assert.equal(f.calls[0].headers['X-Speaking-Share'],token);assert.equal(f.calls[0].url,'/service/public/speaking');assert.equal(f.calls[1].params.questionId,42);
 assert.equal(f.api.publicAccess.matches({setId:11,studentId:7,questionId:42,userId:91}),true);assert.equal(f.api.publicAccess.matches({setId:11,studentId:8,questionId:42,userId:91}),false);
 assert.equal(f.api.pass,undefined);assert.equal(f.api.studentAnswerHistory,undefined);
});
test('view links block writes and edit links reject mismatched person, bank or question',async()=>{
 const view=fixture();await view.api.bootstrap();await assert.rejects(view.api.saveStudentAnswer({setId:11,studentId:7,questionId:42}),e=>e.status===403);assert.equal(view.calls.length,1);
 const edit=fixture({bank:{canEdit:true}});await edit.api.bootstrap();
 for(const patch of [{studentId:8},{setId:12},{questionId:43}])await assert.rejects(edit.api.saveStudentAnswer({setId:11,studentId:7,questionId:42,...patch}),e=>e.status===403);
 await edit.api.saveStudentAnswer({setId:11,studentId:7,questionId:42,revision:1,html:'<b>Answer</b>',notes:[]});assert.equal(edit.calls.length,2);assert.equal(edit.calls[1].method,'PUT');
});
test('invalid tokens and unconfirmed bootstrap metadata do not expose an editor',async()=>{
 const f=fixture({token:'invalid'});await assert.rejects(f.api.bootstrap());assert.equal(f.calls.length,0);
 for(const patch of [{shareId:null},{canEdit:'true'},{questions:null}]){const bad=fixture({bank:patch});await assert.rejects(bad.api.bootstrap());assert.equal(bad.api.publicAccess.canEdit,false);}
});
test('standalone page mounts read-only answer and notebook tools without private application routes',()=>{
 const html=fs.readFileSync(path.join(app,'speaking/shared.html'),'utf8');assert.match(html,/read-only="!pub.data.canEdit"/);assert.match(html,/hide-history="true"/);assert.doesNotMatch(html,/SpeakingController|SpeakingService\.js|ui-router|passTopic/);
});
