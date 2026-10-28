const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');

test('admin room service calls the restricted routes without joining rooms or sending client permissions',async()=>{
 let Service;
 const angular={module(){return{service(name,fn){Service=fn;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/business/BattleQuizOnlineService.js'),'utf8'),{angular});
 const calls=[],rooms=[{code:'ABC123',status:'PLAYING'}];
 const http={get(url,options){calls.push({method:'GET',url,options});return Promise.resolve({data:rooms});},
  post(url,body,options){calls.push({method:'POST',url,body,options});return Promise.resolve({data:{code:'ABC123',status:'FINISHED'}});}};
 const service=new Service(http,{},[{}],{},{api:{baseUrl:'/api/',apiV1Url:'v1/'}});
 assert.equal(await service.getAdminRooms(),rooms);
 assert.equal(calls[0].url,'/api/v1/battle-online/admin/rooms');
 assert.equal(calls[0].options.cache,false);
 assert.equal((await service.terminateAdminRoom(' ab123 ')).status,'FINISHED');
 assert.equal(calls[1].url,'/api/v1/battle-online/admin/rooms/AB123/terminate');
 assert.deepEqual(Object.keys(calls[1].body),[]);
 assert.equal(calls.length,2);
});
