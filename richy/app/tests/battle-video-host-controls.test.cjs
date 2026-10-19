const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
function service(){
 let Service;const calls=[];
 const angular={module(){return {service(name,constructor){Service=constructor;return this;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/business/BattleQuizOnlineService.js'),'utf8'),{angular});
 const http={post(url,body){calls.push({url,body:JSON.parse(JSON.stringify(body))});return Promise.resolve({data:{ok:true}});}};
 return {api:new Service(http,{},[{}],{},{api:{baseUrl:'https://school.test/',apiV1Url:'api/'}}),calls};
}
test('video Auto and Next send the exact cue and reopened round to the real REST service',async()=>{
 const {api,calls}=service();
 assert.deepEqual(await api.setClassicAutoAdvance(' video1 ',false,7,3),{ok:true});
 await api.nextClassicQuestion(' video1 ',7,123456,3);
 assert.deepEqual(calls,[
  {url:'https://school.test/api/battle-online/rooms/VIDEO1/classic-auto',body:{autoAdvance:false,questionSequence:7,videoQuestionRound:3}},
  {url:'https://school.test/api/battle-online/rooms/VIDEO1/classic-next',body:{questionSequence:7,questionEndsAt:123456,videoQuestionRound:3}}
 ]);
});
test('nonvideo Classic controls retain their existing request contract',async()=>{
 const {api,calls}=service();await api.setClassicAutoAdvance('classic1',true);await api.nextClassicQuestion('classic1',2,9876);
 assert.deepEqual(calls.map(call=>call.body),[{autoAdvance:true},{questionSequence:2,questionEndsAt:9876}]);
});
