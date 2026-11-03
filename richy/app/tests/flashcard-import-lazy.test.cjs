const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..'),source=fs.readFileSync(path.join(app,'question/controllers/QuestionExcelImportController.js'),'utf8');
let factory;const moduleStub={directive(name,fn){if(name==='questionImportLoadMore')factory=fn;return this;},controller(){return this;}};
nodeVm.runInNewContext(source,{angular:{module:()=>moduleStub}});
function fixture(supported=true){
 const observers=[],queue=[],root={id:'import-scroll'};let bind,destroy,calls=0,unwatched=0;
 const node={closest(selector){assert.equal(selector,'.question-import-scroll');return root;}};
 const win=supported?{IntersectionObserver:function(callback,options){this.callback=callback;this.options=options;this.observe=target=>this.target=target;this.disconnect=()=>this.disconnected=true;observers.push(this);}}:{};
 const scope={$watchGroup(names,fn){bind=fn;return()=>unwatched++;},$evalAsync:fn=>queue.push(fn),$eval(expression){assert.equal(expression,'more()');calls++;},$on(name,fn){destroy=fn;}};
 factory(win).link(scope,[node],{questionImportLoadMore:'more()',questionImportLoadMoreItems:'rows',questionImportLoadMoreCount:'limit',questionImportLoadMoreEnabled:'enabled'});
 return{win,node,root,observers,bind,destroy,flush(){while(queue.length)queue.shift()();},get calls(){return calls;},get unwatched(){return unwatched;}};
}
test('the import scroll area reveals one batch only when its sentinel intersects',()=>{
 const f=fixture();f.bind([Array(427),40,true]);const observer=f.observers[0];assert.equal(observer.options.root,f.root);
 observer.callback([{target:f.node,isIntersecting:false}]);f.flush();assert.equal(f.calls,0);
 observer.callback([{target:f.node,isIntersecting:true}]);observer.callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(f.calls,1);assert.equal(observer.disconnected,true);
 f.bind([Array(427),80,true]);assert.equal(f.observers.length,2);f.destroy();assert.equal(f.unwatched,1);
});
test('replacing a file, starting confirmation or closing the modal cancels queued scroll work',()=>{
 const f=fixture();f.bind([Array(427),40,true]);const old=f.observers[0];old.callback([{target:f.node,isIntersecting:true}]);
 f.bind([Array(81),40,true]);f.flush();assert.equal(f.calls,0);old.callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(f.calls,0);
 f.observers[1].callback([{target:f.node,isIntersecting:true}]);f.bind([Array(81),40,false]);f.flush();assert.equal(f.calls,0);
 f.bind([Array(81),40,true]);f.observers[2].callback([{target:f.node,isIntersecting:true}]);f.destroy();f.flush();assert.equal(f.calls,0);
});
test('completion and unavailable observers leave the manual load-more button usable',()=>{
 const f=fixture();f.bind([Array(40),40,true]);assert.equal(f.observers.length,0);f.destroy();
 const unsupported=fixture(false);unsupported.bind([Array(427),40,true]);unsupported.flush();assert.equal(unsupported.calls,0);unsupported.destroy();
 const broken=fixture();broken.win.IntersectionObserver=function(){throw Error('Unavailable');};broken.bind([Array(427),40,true]);broken.flush();assert.equal(broken.calls,0);broken.destroy();
 const html=fs.readFileSync(path.join(app,'question/views/listing.html'),'utf8');assert.match(html,/preview\.displayRows \| limitTo:importVm\.previewLimit track by \$index/);assert.match(html,/ng-click="importVm\.loadMorePreviewRows\(\)"/);
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
test('background flashcard refresh ignores older responses and uses no global UI blocker',async()=>{
 const controller=fs.readFileSync(path.join(app,'question/controllers/QuestionController.js'),'utf8'),pending=[],searches=[];
 const vm={currentUser:{id:7,username:'teacher'},searchDto:{pageIndex:1,pageSize:10},questions:[{id:9}],createQuiz(){}};
 const c=nodeVm.createContext({vm,service:{getPage(search){searches.push(search);const d=deferred();pending.push(d);return d.promise;}},angular:{copy:structuredClone,forEach:(rows,fn)=>rows.forEach(fn)},shuffleArray1(){},shuffleArray2(){},blockUI:{start(){throw Error('Must not block UI');},stop(){throw Error('Must not stop another request blocker');}},toastr:{error(){}}});
 nodeVm.runInContext(controller.slice(controller.indexOf('var flashCardPageRequest = 0;'),controller.indexOf('vm.clickShowListFlashCard = function')),c);
 const first=vm.getPageFlashCard();vm.searchDto.pageIndex=2;const second=vm.getPageFlashCard();assert.equal(searches[0].pageIndex,1);
 pending[0].resolve({content:[{id:1}],totalElements:2});await first;assert.equal(vm.questions[0].id,9);assert.equal(vm.flashCardsLoading,true);
 pending[1].resolve({content:[{id:2}],totalElements:2});await second;assert.equal(vm.questions[0].id,2);assert.equal(vm.flashCardsLoading,false);
});
test('topic refresh after creating an import topic stays nonblocking and reports failure locally',async()=>{
 const controller=fs.readFileSync(path.join(app,'question/controllers/QuestionController.js'),'utf8'),vm={searchTopicDto:{userId:7},topics:[{id:1}]};let errors=0;
 const c=nodeVm.createContext({vm,angular:{copy:structuredClone},service:{getTopics:()=>Promise.reject(Error('offline'))},toastr:{error(){errors++;}},blockUI:{start(){throw Error('Must not block UI');},stop(){throw Error('Must not stop another request blocker');}}});
 nodeVm.runInContext(controller.slice(controller.indexOf('var topicListRequest = 0;'),controller.indexOf('vm.saveTopic = function')),c);
 await vm.getTopics();assert.equal(vm.topics[0].id,1);assert.equal(errors,1);
});
