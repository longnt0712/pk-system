const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=path.join(__dirname,'..'),directives={};
vm.runInNewContext(fs.readFileSync(path.join(app,'question/business/speaking-lazy-topic.js'),'utf8'),{angular:{module:()=>({directive(name,definition){directives[name]=definition.at(-1);return this;}})}});

function topicFixture(supported=true){
 const observed=[],listeners={},queue=[];let bind,loaded,destroy,unwatched=0;
 const node={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const window=supported?{IntersectionObserver:function(callback,options){this.callback=callback;this.options=options;this.observe=target=>{this.target=target;};this.disconnect=()=>{this.disconnected=true;};observed.push(this);}}:{};
 const scope={$watchGroup(expressions,fn){bind=fn;return()=>unwatched++;},$watch(expression,fn){loaded=fn;return()=>unwatched++;},$evalAsync:fn=>queue.push(fn),$on(name,fn){destroy=fn;}};
 directives.speakingLazyTopic(window).link(scope,[node],{speakingLazyTopic:'group',speakingLazyEager:'$first'});
 return{observed,listeners,window,node,bind,loaded,destroy,flush(){while(queue.length)queue.shift()();},get unwatched(){return unwatched;}};
}

test('the first topic is eager and unsupported browsers immediately show every topic body',()=>{
 const f=topicFixture(),first={};f.bind([first,true]);assert.equal(first.lazyLoaded,true);assert.equal(f.observed.length,0);
 const legacy=topicFixture(false),group={};legacy.bind([group,false]);assert.equal(group.lazyLoaded,true);
 f.destroy();legacy.destroy();
});

test('later topics mount near the viewport once and remain mounted when scrolled away',()=>{
 const f=topicFixture(),group={};f.bind([group,false]);const observer=f.observed[0];
 assert.equal(observer.options.rootMargin,'400px');assert.equal(observer.target,f.node);
 observer.callback([{target:f.node,isIntersecting:false}]);f.flush();assert.equal(group.lazyLoaded,undefined);
 observer.callback([{target:f.node,isIntersecting:true}]);assert.equal(group.lazyLoaded,undefined);f.flush();assert.equal(group.lazyLoaded,true);assert.equal(observer.disconnected,true);
 observer.callback([{target:f.node,isIntersecting:false}]);f.flush();assert.equal(group.lazyLoaded,true);f.destroy();
});

test('a reused topic element ignores the previous bank or Part observer and pending callbacks',()=>{
 const f=topicFixture(),old={},next={};f.bind([old,false]);const observer=f.observed[0];
 observer.callback([{target:f.node,isIntersecting:true}]);f.bind([next,false]);f.flush();assert.equal(old.lazyLoaded,undefined);assert.equal(next.lazyLoaded,undefined);assert.equal(observer.disconnected,true);
 observer.callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(next.lazyLoaded,undefined);
 f.observed[1].callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(next.lazyLoaded,true);f.destroy();
});

test('locator hydration and keyboard focus reveal a body without waiting for intersection',()=>{
 const f=topicFixture(),group={};f.bind([group,false]);group.lazyLoaded=true;f.loaded(true);assert.equal(f.observed[0].disconnected,true);
 f.bind([group,false]);assert.equal(group.lazyLoaded,true);assert.equal(f.observed.length,1);
 const keyboard={};f.bind([keyboard,false]);f.listeners.focusin();f.flush();assert.equal(keyboard.lazyLoaded,true);assert.equal(f.observed[1].disconnected,true);f.destroy();
});

test('destroyed topic scopes detach observers and focus handlers without mounting queued work',()=>{
 const f=topicFixture(),group={};f.bind([group,false]);f.listeners.focusin();f.destroy();f.flush();
 assert.equal(group.lazyLoaded,undefined);assert.equal(f.observed[0].disconnected,true);assert.equal(f.listeners.focusin,undefined);assert.equal(f.unwatched,2);
 f.observed[0].callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(group.lazyLoaded,undefined);
});

test('an unavailable observer never leaves a topic stuck behind its placeholder',()=>{
 const f=topicFixture();f.window.IntersectionObserver=function(){throw Error('Unavailable');};const group={};f.bind([group,false]);assert.equal(group.lazyLoaded,true);f.destroy();
});

test('sample details mount their body only when opened, and late toggles cannot update a destroyed scope',()=>{
 const listeners={},queue=[];let destroy;
 const scope={$evalAsync:fn=>queue.push(fn),$on(name,fn){destroy=fn;}},node={open:false,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 directives.speakingLazySample().link(scope,[node]);assert.equal(scope.spSampleOpen,false);
 node.open=true;listeners.toggle();queue.shift()();assert.equal(scope.spSampleOpen,true);
 node.open=false;listeners.toggle();queue.shift()();assert.equal(scope.spSampleOpen,false);
 node.open=true;listeners.toggle();destroy();queue.shift()();assert.equal(scope.spSampleOpen,false);assert.equal(listeners.toggle,undefined);
});

function loadMoreFixture(supported=true, root=null){
 const observed=[],queue=[];let bind,destroy,unwatched=0,calls=0;
 const node={closest(selector){assert.equal(selector,'.sp-modal-body');return root;}};
 const win=supported?{IntersectionObserver:function(callback,options){this.callback=callback;this.options=options;this.observe=target=>this.target=target;this.disconnect=()=>this.disconnected=true;observed.push(this);}}:{};
 const scope={$watchGroup(expressions,fn){bind=fn;return()=>unwatched++;},$evalAsync:fn=>queue.push(fn),$eval(expression){assert.equal(expression,'load()');calls++;},$on(name,fn){destroy=fn;}};
 directives.speakingLoadMore(win).link(scope,[node],{speakingLoadMore:'load()',speakingLoadMoreItems:'items',speakingLoadMoreCount:'limit',speakingLoadMoreEnabled:'enabled'});
 return{node,win,observed,bind,destroy,flush(){while(queue.length)queue.shift()();},get calls(){return calls;},get unwatched(){return unwatched;}};
}

test('a page or modal sentinel queues one batch only when it becomes visible',()=>{
 for(const root of [null,{id:'modal-scroll'}]){
  const f=loadMoreFixture(true,root);f.bind([Array(120),50,true]);const observer=f.observed[0];
  assert.equal(observer.options.root,root);assert.equal(observer.target,f.node);
  observer.callback([{target:f.node,isIntersecting:false}]);observer.callback([{target:{},isIntersecting:true}]);f.flush();assert.equal(f.calls,0);
  observer.callback([{target:f.node,isIntersecting:true}]);observer.callback([{target:f.node,isIntersecting:true}]);assert.equal(f.calls,0);f.flush();assert.equal(f.calls,1);f.destroy();
 }
});

test('appending rows rearms the sentinel and completion disconnects it',()=>{
 const f=loadMoreFixture(),items=Array(120);f.bind([items,50,true]);const first=f.observed[0];
 first.callback([{target:f.node,isIntersecting:true}]);f.flush();f.bind([items,100,true]);assert.equal(first.disconnected,true);
 f.observed[1].callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(f.calls,2);
 f.bind([items,120,true]);assert.equal(f.observed[1].disconnected,true);assert.equal(f.observed.length,2);f.destroy();
});

test('a new file, disabled import or destroyed view discards stale queued scroll callbacks',()=>{
 const f=loadMoreFixture();f.bind([Array(120),50,true]);const stale=f.observed[0];stale.callback([{target:f.node,isIntersecting:true}]);
 f.bind([Array(70),50,true]);f.flush();assert.equal(f.calls,0);stale.callback([{target:f.node,isIntersecting:true}]);f.flush();assert.equal(f.calls,0);
 const current=f.observed[1];current.callback([{target:f.node,isIntersecting:true}]);f.bind([Array(70),50,false]);f.flush();assert.equal(f.calls,0);assert.equal(current.disconnected,true);
 f.bind([Array(70),50,true]);f.observed[2].callback([{target:f.node,isIntersecting:true}]);f.destroy();f.flush();assert.equal(f.calls,0);assert.equal(f.observed[2].disconnected,true);assert.equal(f.unwatched,1);
});

test('unsupported or failing observers leave manual loading available without a background loop',()=>{
 const unsupported=loadMoreFixture(false);unsupported.bind([Array(100),50,true]);unsupported.flush();assert.equal(unsupported.calls,0);unsupported.destroy();
 const broken=loadMoreFixture();broken.win.IntersectionObserver=function(){throw Error('Unavailable');};broken.bind([Array(100),50,true]);broken.flush();assert.equal(broken.calls,0);broken.destroy();
});

test('both Speaking routes load the directive while the view keeps full topic headers and lazy sample bodies',()=>{
 const routes=fs.readFileSync(path.join(app,'question/question.module.js'),'utf8'),view=fs.readFileSync(path.join(app,'question/views/speaking.html'),'utf8');
 assert.equal((routes.match(/business\/speaking-lazy-topic\.js/g)||[]).length,2);
 assert.match(view,/speaking-lazy-topic="group" speaking-lazy-eager="\$first"/);
 assert.match(view,/<div ng-if="group\.lazyLoaded">/);assert.match(view,/ng-if="!group\.lazyLoaded"/);
 assert.match(view,/<details ng-if="question\.sample" speaking-lazy-sample><summary>Sample trả lời<\/summary><p ng-if="spSampleOpen"/);
 assert.match(view,/ng-if="vm\.answerQuestionId===question\.id"/);assert.match(view,/ng-if="vm\.notebookQuestionId===question\.id"/);
 assert.match(view,/group in vm\.groups \| limitTo:vm\.groupLimit track by group\.key/);
 assert.match(view,/item in vm\.importRows \| limitTo:vm\.importLimit track by item\.row\.rowId/);
 assert.match(view,/item in vm\.answerImportRows \| limitTo:vm\.answerImportLimit track by item\.rowId/);
 assert.equal((view.match(/speaking-load-more="/g)||[]).length,3);
 assert.doesNotMatch(view,/vm\.(groupPage|importPage|answerImportPage)/);
});
