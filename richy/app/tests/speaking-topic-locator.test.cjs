const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const app = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'question/controllers/SpeakingController.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
const plain = value => JSON.parse(JSON.stringify(value));

function fixture() {
    let controller;
    const module = {directive(){return this;}, controller(name, definition){controller = definition.at(-1); return this;}};
    nodeVm.runInNewContext(source, {angular:{module:()=>module, noop(){}, identity:value=>value}, Date, Number, Math, JSON, Uint32Array, FormData});
    const questions = [
        {id:1, entryId:11, part:1, topic:'Home & Accommodation', prompt:'Secret prompt phrase'},
        {id:2, entryId:12, part:1, topic:'Home & Accommodation', prompt:'A second question'},
        ...Array.from({length:7}, (_, index)=>({id:index+3, entryId:index+13, part:1, topic:'Topic '+(index+2), prompt:'Question '+index})),
        {id:21, entryId:31, part:2, topic:'A special cake', prompt:'Cue card'},
        {id:22, entryId:32, part:3, topic:'Food traditions', prompt:'First food question', linkedPart2Id:21},
        {id:23, entryId:33, part:3, topic:'Food traditions', prompt:'Second food question', linkedPart2Id:21}
    ];
    const set = {id:1, canManage:false, year:2026, name:'Bộ 1'};
    const events = {}, scopeEvents = {}, elements = new Map(), scheduled = [], calls = {scroll:[], focus:[]}, location = {};
    const makeElement = id => ({id, contains:target=>target && target.insideLocator===true, focus:options=>calls.focus.push({id, options}), scrollIntoView:options=>calls.scroll.push({id, options})});
    ['sp-topic-locator', 'sp-topic-locator-toggle', 'sp-topic-locator-search'].forEach(id=>elements.set(id, makeElement(id)));
    const document = {hidden:false, getElementById:id=>elements.get(id), addEventListener:(name, handler)=>events[name]=handler, removeEventListener:(name, handler)=>{if(events[name]===handler) delete events[name];}};
    const win = {document, localStorage:{getItem:()=>null, setItem(){}, removeItem(){}}, setTimeout:handler=>scheduled.push(handler), addEventListener(){}, removeEventListener(){}, URL:{revokeObjectURL(){}}, matchMedia:()=>({matches:false})};
    const q = {when:Promise.resolve.bind(Promise), reject:Promise.reject.bind(Promise), all:Promise.all.bind(Promise)};
    const interval = ()=>1; interval.cancel = ()=>{};
    const scope = {$on:(name, handler)=>scopeEvents[name]=handler, $watch:()=>()=>{}, $evalAsync:handler=>handler()};
    const api = {bootstrap:()=>Promise.resolve({userId:7, isAdmin:false, canManage:false, sets:[set], classes:[]}), bank:()=>Promise.resolve({set, questions}), history:()=>Promise.resolve([])};
    const recorder = {state:{pending:[]}, loadPending(){}, stop:()=>Promise.resolve()};
    const vm = {};
    controller.call(vm, scope, {settings:{layout:{}}}, win, {search(key, value){if(key===undefined) return location; location[key]=value;}}, interval, q, {}, api, recorder, {}, {current:{data:{}}});
    return {vm, win, api, events, scopeEvents, calls, location, elements, questions, flush(){while(scheduled.length) scheduled.shift()();}, render(){vm.groups.slice(vm.groupPage*6, vm.groupPage*6+6).forEach(group=>elements.set(group.anchorId, makeElement(group.anchorId)));}};
}

test('the locator lists each topic once across Parts and searches topic names without matching question text', async () => {
    const f = fixture(); await settle();
    assert.equal(f.vm.topicLinks.length, 10);
    assert.deepEqual(plain(f.vm.topicLinks.map(topic=>topic.part)), [1,1,1,1,1,1,1,1,2,3]);
    f.vm.topicQuery = '   HOME &   accommodation '; f.vm.filterTopics();
    assert.equal(f.vm.topicResults.length, 1); assert.equal(f.vm.topicResults[0].title, 'Home & Accommodation');
    f.vm.topicQuery = 'Secret prompt phrase'; f.vm.filterTopics(); assert.equal(f.vm.topicResults.length, 0);
    f.vm.topicQuery = 'food'; f.vm.filterTopics(); assert.equal(f.vm.topicResults.length, 1); assert.equal(f.vm.topicResults[0].part, 3);
});

test('selecting an off-page topic clears the main filter and opens the correct page before scrolling', async () => {
    const f = fixture(); await settle(); const last = f.vm.topicLinks.find(topic=>topic.title==='Topic 8');
    f.vm.query = 'Secret prompt phrase'; f.vm.rebuildGroups(); assert.equal(f.vm.groups.length, 1);
    f.vm.toggleTopicLocator(); f.vm.jumpToTopic(last);
    assert.equal(f.vm.query, ''); assert.equal(f.vm.groupPage, 1); assert.equal(f.vm.topicLocatorOpen, false);
    f.render(); f.flush();
    assert.equal(f.calls.scroll.length, 1); assert.equal(f.calls.scroll[0].id, 'sp-topic-'+encodeURIComponent(last.key));
    assert.deepEqual(plain(f.calls.scroll[0].options), {behavior:'smooth', block:'start'});
    assert.equal(f.calls.focus.at(-1).id, f.calls.scroll[0].id);
});

test('a topic in another Part updates the selected Part and URL and respects reduced motion', async () => {
    const f = fixture(); await settle(); f.win.matchMedia=()=>({matches:true});
    const topic = f.vm.topicLinks.find(item=>item.part===3); f.vm.jumpToTopic(topic); f.render(); f.flush();
    assert.equal(f.vm.part, 3); assert.equal(f.location.part, 3); assert.equal(f.vm.groups.length, 1);
    assert.equal(f.calls.scroll[0].options.behavior, 'auto'); assert.equal(f.vm.activeTopicKey, topic.key);
    f.vm.jumpToTopic({key:'forged topic', part:1}); f.flush(); assert.equal(f.calls.scroll.length, 1);
});

test('a later jump, Part change, bank reload or destroyed page cancels a pending topic scroll', async () => {
    const f = fixture(); await settle();
    f.vm.jumpToTopic(f.vm.topicLinks[0]); f.vm.jumpToTopic(f.vm.topicLinks[1]); f.render(); f.flush();
    assert.equal(f.calls.scroll.length, 1); assert.equal(f.calls.scroll[0].id, 'sp-topic-'+encodeURIComponent(f.vm.topicLinks[1].key));
    f.vm.jumpToTopic(f.vm.topicLinks[0]); f.vm.changePart(2); f.render(); f.flush(); assert.equal(f.calls.scroll.length, 1);
    f.vm.jumpToTopic(f.vm.topicLinks[0]); await f.vm.loadBank(); f.render(); f.flush(); assert.equal(f.calls.scroll.length, 1);
    f.vm.jumpToTopic(f.vm.topicLinks[0]); f.render(); f.scopeEvents.$destroy(); f.flush(); assert.equal(f.calls.scroll.length, 1);
    assert.equal(f.events.click, undefined); assert.equal(f.events.keydown, undefined);
});

test('the topic picker closes outside or with Escape and returns keyboard focus to its trigger', async () => {
    const f = fixture(); await settle(); f.vm.toggleTopicLocator(); f.flush();
    assert.equal(f.calls.focus.at(-1).id, 'sp-topic-locator-search');
    f.events.click({target:{insideLocator:true}}); assert.equal(f.vm.topicLocatorOpen, true);
    f.events.click({target:{}}); assert.equal(f.vm.topicLocatorOpen, false);
    f.vm.toggleTopicLocator(); let prevented=false; f.events.keydown({key:'Escape', preventDefault(){prevented=true;}});
    assert.equal(prevented, true); assert.equal(f.vm.topicLocatorOpen, false); assert.equal(f.calls.focus.at(-1).id, 'sp-topic-locator-toggle');
    f.vm.practice={id:2}; f.vm.toggleTopicLocator(); assert.equal(f.vm.topicLocatorOpen, false);
});

test('opening an A4 notebook closes the locator, blocks jumps and cancels a pending jump even after the notebook closes', async () => {
    const f = fixture(); await settle(); const topic = f.vm.topicLinks[0];
    f.vm.toggleTopicLocator(); assert.equal(f.vm.topicLocatorOpen, true);
    f.vm.toggleNotebook(f.questions[0]); assert.equal(f.vm.topicLocatorOpen, false); assert.equal(f.vm.notebookQuestionId, 1);
    f.vm.toggleTopicLocator(); assert.equal(f.vm.topicLocatorOpen, false);
    f.vm.jumpToTopic(topic); f.render(); f.flush(); assert.equal(f.calls.scroll.length, 0); assert.equal(f.vm.notebookQuestionId, 1);
    f.vm.closeNotebook(); f.vm.jumpToTopic(topic); f.vm.toggleNotebook(f.questions[0]); f.vm.closeNotebook(); f.render(); f.flush();
    assert.equal(f.calls.scroll.length, 0);
});

test('the view exposes topic labels and vertical scrolling above the existing back-to-top space', () => {
    const html = fs.readFileSync(path.join(app, 'question/views/speaking.html'), 'utf8');
    const css = fs.readFileSync(path.join(app, 'question/speaking.css'), 'utf8');
    assert.match(html, /id="\{\{group\.anchorId\}\}" tabindex="-1"/);
    assert.match(html, /Part \{\{topic\.part\}\}/); assert.match(html, /\{\{topic\.title\}\}/);
    assert.match(html, /aria-expanded="\{\{vm\.topicLocatorOpen\}\}"/);
    assert.match(html, /!vm\.notebookQuestionId && vm\.topicLinks\.length/);
    assert.match(css, /\.sp-topic-locator \{[^}]*position:fixed[^}]*z-index:1030[^}]*bottom:calc\(84px \+ var\(--builder-actionbar-height,0px\)\)/);
    assert.match(css, /@media\(max-width:767px\)[^\n]*bottom:calc\(78px \+ var\(--builder-actionbar-height,0px\)\)/);
    assert.match(css, /body\.study-notebook-open \.speaking-page \.sp-topic-locator,body\.modal-open \.speaking-page \.sp-topic-locator,body\.ui-dialog-open \.speaking-page \.sp-topic-locator \{ display:none; \}/);
    assert.match(css, /\.sp-topic-locator-list \{[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/);
});
