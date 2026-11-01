// Exercise the actual dashboard constructor, with synthetic users and no production requests.
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dashboards/controllers/DashboardController.js'),'utf8');
const tick=()=>new Promise(setImmediate);
function fixture(hostname,role='ROLE_EDUCATION_MANAGERMENT'){
 let Controller,storageReads=0;
 const requests=[],entries=new Map([['ieltsReadingInProgress:7:reading:test:42','{"userId":7,"testId":42}']]);
 const angular={module:()=>({controller(name,constructor){Controller=constructor;}}),isArray:Array.isArray,forEach(items,fn){(items||[]).forEach(fn);},noop(){}};
 vm.runInNewContext(source,{angular,console:{log(){},error(){}},window:{}});
 const root={settings:{layout:{}}},scope={$on(){return()=>{};}},timer=()=>1;
 const storage={get length(){storageReads++;return entries.size;},key(i){storageReads++;return [...entries.keys()][i];},getItem(key){storageReads++;return entries.get(key)||null;},setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
 const user={id:7,displayName:'Người dùng thử',roles:[{name:role}]};
 const settings={ieltsRoom:/ieltsroom/.test(hostname),api:{baseUrl:'/service/',apiV1Url:'api/'}};
 const http={get(url){requests.push(url);return Promise.resolve({data:[]});}};
 const instance=new Controller(root,scope,http,timer,settings,{}, {get:()=>JSON.stringify(user)}, {protocol:()=> 'https'}, {location:{hostname},localStorage:storage},{});
 return{instance,requests,entries,storageReads:()=>storageReads};
}

test('TNTT dashboard never fetches IELTS drafts or reads their local cache for any account role',async()=>{
 for(const host of ['tnttphungkhoang.com','www.tnttphungkhoang.com','TNTTPHUNGKHOANG.COM']){
  for(const role of ['ROLE_ADMIN','ROLE_EDUCATION_MANAGERMENT','ROLE_STUDENT_MANAGERMENT','ROLE_USER','ROLE_STUDENT','ROLE_VIEWER','ROLE_STAFF']){
   const f=fixture(host,role);await tick();
   assert.equal(f.requests.filter(url=>url.endsWith('/test_result/drafts')).length,0,host+':'+role);
   assert.equal(f.storageReads(),0);assert.equal(f.instance.resumeDrafts.length,0);assert.equal(f.entries.size,1);
   f.instance.loadResumeDrafts();assert.equal(f.requests.filter(url=>url.endsWith('/test_result/drafts')).length,0);
  }
 }
});

test('IELTS dashboards retain cloud and local draft loading',async()=>{
 for(const host of ['ieltsroom.com','www.ieltsroom.com','localhost']){
  for(const role of ['ROLE_ADMIN','ROLE_VIEWER','ROLE_STUDENT','ROLE_USER']){
   const f=fixture(host,role);await tick();assert.ok(f.storageReads()>0,host+':'+role);
   assert.equal(f.requests.filter(url=>url==='/service/api/test_result/drafts').length,1);
  }
 }
});
