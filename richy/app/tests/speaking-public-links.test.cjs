const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..'),token='a'.repeat(43),bank={shareId:91,setId:11,studentId:7,canEdit:false,questions:[{id:42,entryId:4,part:2,topic:'Cake',prompt:'Describe a cake'}]};
function fixture(options={}){
 let factory,controller;const calls=[];const module={factory(n,d){factory=d.at(-1);return this;},controller(n,d){controller=d.at(-1);return this;}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,'speaking/shared.js'),'utf8'),{angular:{module:()=>module}});
 const data={...structuredClone(bank),...options.bank};
 const api=factory(config=>{calls.push(config);return Promise.resolve({data:config.url==='/service/public/speaking'?data:{saved:true}});},{reject:Promise.reject.bind(Promise)},{location:{hash:'#'+(options.token??token)}});
 return{api,calls,controller};
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

test('the shared page returns to the heading without changing the share URL or selected Part', async () => {
 const html = fs.readFileSync(path.join(app, 'speaking/shared.html'), 'utf8');
 assert.match(html, /ng-if="pub.ready && !pub.notebookId" ng-click="pub.goToTop\(\)" aria-label="Lên đầu trang"/);
 const {api, controller} = fixture();
 const vm = {}, scrolls = [], focused = [];
 let reducedMotion = false;
 const document = {addEventListener() {}, getElementById(id) {
  return id === 'sp-shared-title' ? {focus: options => focused.push(options.preventScroll)} : null;
 }};
 const window = {document, location: {hash: '#' + token}, matchMedia: () => ({matches: reducedMotion}),
  scrollTo: ({top, behavior}) => scrolls.push([top, behavior])};
 controller.call(vm, {$on() {}}, window, api);
 await new Promise(setImmediate);
 assert.equal(vm.ready, true);
 vm.locatorOpen = true;
 vm.goToTop();
 assert.equal(vm.locatorOpen, false);
 assert.equal(vm.part, 2);
 assert.equal(window.location.hash, '#' + token);
 reducedMotion = true;
 vm.goToTop();
 assert.deepEqual(focused, [true, true]);
 assert.deepEqual(scrolls, [[0, 'smooth'], [0, 'auto']]);
});

test('the shared locator keeps scrolling when tapped again without opening the tablet keyboard', async () => {
 const question = {id: 43, entryId: 5, part: 2, topic: 'A place', prompt: 'Describe a place'};
 const {api, controller} = fixture({bank: {questions: [bank.questions[0], question]}});
 const vm = {}, calls = [], pending = [];
 const document = {addEventListener() {}, getElementById(id) {
  return {focus: () => calls.push(['focus', id]), scrollIntoView: ({behavior}) => calls.push([id, behavior])};
 }};
 controller.call(vm, {$on() {}}, {document, setTimeout: fn => pending.push(fn)}, api);
 await new Promise(setImmediate);
 const touch = {pointerType: 'touch', detail: 1};
 const groups = vm.groups;
 for (const topic of [vm.topicLinks[0], vm.topicLinks[1], vm.topicLinks[0]]) {
  vm.toggleLocator(touch);
  vm.jumpToTopic(topic, touch);
  pending.shift()();
 }
 assert.equal(vm.groups, groups);
 assert.deepEqual(calls, ['Cake', 'A place', 'Cake'].map(topic => ['sp-topic-' + encodeURIComponent('2:' + topic + ':'), 'instant']));
});
