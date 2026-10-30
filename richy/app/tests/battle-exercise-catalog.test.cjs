const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};}

function service(){
 let Service;const angular={module(){return {service(name,fn){Service=fn;}};}};
 nodeVm.runInNewContext(read('question/business/BattleQuizOnlineService.js'),{angular});
 const requests=[],timers=[],$q={defer:deferred,reject:Promise.reject.bind(Promise)};
 const timer=(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return timer;};timer.cancel=value=>{value.cancelled=true;};
 function http(method,url,body,options){const response=deferred(),request={method,url,body,options,...response,aborted:false};requests.push(request);
  options.timeout.then(()=>{request.aborted=true;response.reject({status:-1});});return response.promise;}
 const api=new Service({post(url,body,options){return http('POST',url,body,options);},get(url,options){return http('GET',url,null,options);}},
  $q,[{}],{},{api:{baseUrl:'/api/',apiV1Url:'v1/'}},timer);
 return {api,requests,timers};
}

function controller({ignoreAbort=false}={}){
 let Controller,destroy;const lists=[],folders=[],topics=[],timers=[],events={};
 const angular={module(){return {controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},copy:plain,fromJson:JSON.parse,noop(){},element(){return {on(){},off(){}};}};
 nodeVm.runInNewContext(read('question/controllers/BattleQuizOnlineController.js').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,''),{angular});
 const timer=(fn,delay)=>{const value={fn,delay};timers.push(value);return value;};timer.cancel=()=>{};
 function request(collection,args){const pending=deferred(),call={...pending,args,cancelled:false};pending.promise.cancel=()=>{call.cancelled=true;if(!ignoreAbort)pending.reject({status:-1,battleCatalogCancelled:true});};collection.push(call);return pending.promise;}
 const scope={$on(name,fn){events[name]=fn;if(name==='$destroy')destroy=fn;},$evalAsync(fn){fn();}};
 const api={getExerciseTests(...args){return request(lists,args);},getExerciseFolders(...args){return request(folders,args);},disconnectRealtime(){}};
 const window={Promise,location:{origin:'http://battle.test'},navigator:{},document:{body:{classList:{add(){},remove(){}}},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
 const vm=new Controller({},scope,{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username:'host'});}},window,{warning(){},error(){}},{},
  {getPageForTests(){throw Error('The expensive general Question endpoint must not be used');},getTopicsForGames(...args){return request(topics,args);}},api);
 return {vm,lists,folders,topics,destroy(){destroy();}};
}

test('Battle catalog service uses the lightweight paginated endpoint and successful requests cancel their timeout',async()=>{
 const h=service(),filter={testFolderId:3,testFormat:'COMPREHENSIVE',textSearch:'Grammar'};
 const request=h.api.getExerciseTests(filter,2,12);
 assert.equal(h.requests[0].url,'/api/v1/battle-online/exercise-tests/2/12');assert.deepEqual(h.requests[0].body,filter);
 assert.equal(h.timers[0].delay,15000);assert.equal(h.requests[0].options.cache,false);
 const page={content:[{id:8,title:'Grammar'}],totalElements:25};h.requests[0].resolve({data:page});assert.equal(await request,page);
 assert.equal(h.timers[0].cancelled,true);request.cancel();assert.equal(h.requests[0].aborted,false,'settled requests cannot be aborted later');
});

test('catalog timeout and explicit cancellation abort real HTTP requests with distinct errors',async()=>{
 const h=service();const slow=h.api.getExerciseTests({},1,12),timedOut=assert.rejects(slow,error=>error.battleCatalogTimeout===true&&error.battleCatalogCancelled===false);
 h.timers[0].fn();await timedOut;assert.equal(h.requests[0].aborted,true);
 const superseded=h.api.getExerciseTests({},1,12),cancelled=assert.rejects(superseded,error=>error.battleCatalogCancelled===true&&error.battleCatalogTimeout===false);
 superseded.cancel();await cancelled;assert.equal(h.requests[1].aborted,true);assert.equal(h.timers[1].cancelled,true);
 const folders=h.api.getExerciseFolders(),folderFailure=assert.rejects(folders,error=>error.battleCatalogTimeout===true);
 assert.equal(h.requests[2].url,'/api/v1/test_folder');assert.deepEqual(plain(h.requests[2].options.params),{allTeachers:true,testMode:'COMPREHENSIVE'});
 h.timers[2].fn();await folderFailure;assert.equal(h.requests[2].aborted,true);
});

test('folder and search navigation cancel superseded requests and only the latest catalog response wins',async()=>{
 const h=controller({ignoreAbort:true});h.vm.openExercisePicker();assert.equal(h.lists.length,1);assert.equal(h.folders.length,1);
 h.vm.openExerciseFolder(4);assert.equal(h.lists[0].cancelled,true);assert.equal(h.lists[1].args[0].testFolderId,4);
 h.vm.exerciseSearch='video';h.vm.searchExerciseCatalog();assert.equal(h.lists[1].cancelled,true);
 assert.equal(h.lists[2].args[0].testFolderId,null);assert.equal(h.lists[2].args[0].includeSubfolders,true);
 h.lists[2].resolve({content:[{id:3,title:'Current match'}],totalElements:13});await tick();
 h.lists[0].resolve({content:[{id:1,title:'Old folder'}],totalElements:100});h.lists[1].reject({status:500});await tick();
 assert.deepEqual(plain(h.vm.exerciseTests),[{id:3,title:'Current match'}]);assert.equal(h.vm.exerciseTotalPages,2);assert.equal(h.vm.exerciseLoadError,'');assert.equal(h.vm.loadingExercises,false);
});

test('closing or destroying the picker cancels outstanding work and releases all loading states',async()=>{
 const h=controller();h.vm.openExercisePicker();h.vm.closeExercisePicker();await tick();
 assert.equal(h.lists[0].cancelled,true);assert.equal(h.folders[0].cancelled,true);assert.equal(h.vm.loadingExercises,false);assert.equal(h.vm.loadingExerciseFolders,false);assert.equal(h.vm.exerciseLoadError,'');
 h.vm.openExercisePicker();h.destroy();await tick();assert.equal(h.lists[1].cancelled,true);assert.equal(h.folders[1].cancelled,true);assert.equal(h.vm.loadingExercises,false);
 const hidden=controller();hidden.vm.loadExerciseTests(1);hidden.destroy();await tick();assert.equal(hidden.lists[0].cancelled,true,'a request started before modal creation is cleaned up too');
});

test('timeout shows a retry message and folder retry does not send a duplicate exercise request',async()=>{
 const h=controller();h.vm.openExercisePicker();h.lists[0].reject({battleCatalogTimeout:true});h.folders[0].reject({battleCatalogTimeout:true});await tick();
 assert.match(h.vm.exerciseLoadError,/15 giây.*Thử lại/);assert.equal(h.vm.loadingExercises,false);assert.match(h.vm.exerciseFolderError,/15 giây/);assert.equal(h.vm.loadingExerciseFolders,false);
 h.vm.loadExerciseFolders();assert.equal(h.folders.length,2);assert.equal(h.lists.length,1,'retrying folders never repeats the exercise query');
 h.folders[1].resolve([{id:4,name:'Folder'}]);await tick();assert.equal(h.vm.exerciseFolderError,'');
 h.vm.loadExerciseTests(h.vm.exercisePage);h.lists[1].resolve({content:[{id:8,title:'Recovered'}],totalElements:1});await tick();assert.equal(h.vm.exerciseLoadError,'');assert.equal(h.vm.exerciseTests[0].id,8);
});

test('reopening during a topic load retries the source and ignores late responses, including same-owner reloads',async()=>{
 const h=controller();h.vm.exerciseFilterMode='TOPIC';h.vm.exerciseTopicOwnerId=1;h.vm.openExercisePicker();
 assert.equal(h.topics.length,1);h.vm.closeExercisePicker();h.vm.openExercisePicker();assert.equal(h.topics.length,2);
 h.topics[0].resolve({content:[{id:1,name:'Stale topic'}]});await tick();assert.equal(h.vm.exerciseTopics.length,0);
 h.topics[1].resolve({content:[{id:2,name:'Current topic',topicCategory:{id:4,name:'Grade 6'}}]});await tick();
 assert.equal(h.vm.exerciseTopics[0].id,2);assert.equal(h.vm.loadingExerciseTopics,false);
 h.vm.changeExerciseTopicSource();h.vm.closeExercisePicker();h.vm.openExercisePicker();assert.equal(h.topics.length,4,'an interrupted reload of the same owner must be retried too');
 h.topics[2].resolve({content:[{id:3,name:'Old reload'}]});h.topics[3].resolve({content:[{id:4,name:'New reload'}]});await tick();
 assert.deepEqual(plain(h.vm.exerciseTopics),[{id:4,name:'New reload'}]);assert.equal(h.vm.loadingExerciseTopics,false);h.destroy();await tick();
});
