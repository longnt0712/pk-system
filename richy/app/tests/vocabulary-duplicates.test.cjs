const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(app,'topic/controllers/VocabularyDuplicateController.js'),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() { let resolve,reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function fixture(options={}) {
    let Controller,dialog,modalCalls=0;
    const events={},notices=[],payloads=[],detailCalls=[],reviewCalls=[],scrolls=[];
    const groups=options.groups || [{word:'minimal',ids:[10,20,30],count:3,reviewed:false}];
    const cards=options.cards || [
        {id:10,question:'minimal',motherTongue:'tối thiểu',fingerprint:'a',questionTopics:[{topic:{id:1,name:'Bài 2'}}]},
        {id:20,question:'minimal',motherTongue:'rất ít',fingerprint:'b',questionTopics:[{topic:{id:1,name:'Bài 2'}},{topic:{id:2,name:'Bài 10'}}]},
        {id:30,question:'minimal',motherTongue:'tối thiểu',fingerprint:'c',questionTopics:[]}
    ];
    const module={controller(name,fn){Controller=fn;return this;}};
    vm.runInNewContext(source,{angular:{module:()=>module,noop(){}}});
    const api=Object.assign({
        getVocabularyDuplicateGroups:()=>Promise.resolve(plain(groups)),
        getVocabularyDuplicateDetails(ids) {
            detailCalls.push(plain(ids));
            return Promise.resolve(ids.map(id=>cards.find(card=>card.id===id) || {
                id,question:groups.find(g=>g.ids.includes(id)).word,motherTongue:'meaning '+id,fingerprint:'fp-'+id,questionTopics:[]
            }));
        },
        mergeVocabularyDuplicateBatch(batch) {
            payloads.push(plain(batch));
            return Promise.resolve(batch.map(p=>{
                const group=groups.find(g=>g.ids.includes(p.primaryId));
                const removed=p.sources.filter(c=>c.id!==p.primaryId).map(c=>c.id);
                return {card:{id:p.primaryId},mergedCount:removed.length,group:{word:group.word,
                    ids:group.ids.filter(id=>!removed.includes(id)),reviewed:true,reviewedAt:1000}};
            }));
        },
        setVocabularyDuplicateReviewed(payload) {
            reviewCalls.push(plain(payload));
            return Promise.resolve({word:groups.find(g=>g.ids.includes(payload.sources[0].id)).word,
                ids:payload.sources.map(c=>c.id),reviewed:payload.reviewed,reviewedAt:payload.reviewed?1000:null});
        }
    },options.api);
    const scope={$on(name,callback){events[name]=callback;}};
    const modal={open(){modalCalls++;dialog={result:new Promise(()=>{}),close(){this.closed=true;},dismiss(){this.dismissed=true;}};return dialog;}};
    const window={document:{getElementById(id){return {scrollIntoView(options){scrolls.push([id,options]);}};}}};
    const page=new Controller(scope,modal,api,{success(text){notices.push(text);},info(text){notices.push(text);}},
        {when:()=>Promise.resolve(),all:promises=>Promise.all(promises)},window);
    return {page,groups,cards,api,events,payloads,detailCalls,reviewCalls,notices,scrolls,get dialog(){return dialog;},get modalCalls(){return modalCalls;}};
}
function manyGroups(count) { return Array.from({length:count},(_,i)=>({word:'word '+String(i).padStart(2,'0'),ids:[100+i*2,101+i*2],count:2,reviewed:false})); }

test('only ten details load per page; edited definitions and selections survive paging and search',async()=>{
    const f=fixture({groups:manyGroups(25)}),page=f.page; await tick();
    assert.equal(page.groups.length,25); assert.equal(page.pageGroups.length,10); assert.equal(f.detailCalls.length,10);
    const first=page.pageGroups[0]; first.meaning='Nghĩa biên tập';page.meaningChanged(first);first.selected[101]=false;page.changeSelection(first);
    await page.showPage(2);assert.equal(f.detailCalls.length,20);assert.equal(page.page,2);
    await page.showPage(1);assert.equal(f.detailCalls.length,20);assert.equal(page.pageGroups[0].meaning,'Nghĩa biên tập');
    assert.equal(page.pageGroups[0].chosen.length,1);
    page.query='word 24';await page.filterGroups();assert.equal(page.pageGroups.length,1);assert.equal(f.detailCalls.length,21);
    page.query='';await page.filterGroups();assert.equal(page.pageGroups[0].meaning,'Nghĩa biên tập');
});

test('default keeps one primary definition, optional distinct meanings join with slash, topics form a union',async()=>{
    const f=fixture(),page=f.page;await tick();const group=page.pageGroups[0];
    assert.equal(group.primaryId,10);assert.equal(group.meaning,'tối thiểu');
    assert.deepEqual(plain(group.topics).map(t=>t.id),[1,2]);
    page.joinMeanings(group);assert.equal(group.meaning,'tối thiểu / rất ít');
    group.selected[20]=false;page.changeSelection(group);assert.equal(group.meaning,'tối thiểu / rất ít');
    page.usePrimaryMeaning(group);assert.equal(group.meaning,'tối thiểu');assert.equal(group.topics.length,1);
    page.selectPrimary(group,f.cards[1]);assert.equal(group.primaryId,20);assert.equal(group.meaning,'rất ít');
    group.meaning='Giữ phần đang sửa';page.meaningChanged(group);
    page.selectPrimary(group,f.cards[0]);assert.equal(group.meaning,'Giữ phần đang sửa');
});

test('one confirmation saves ten groups, checks acknowledged groups and fills the next pending page',async()=>{
    const f=fixture({groups:manyGroups(12)}),page=f.page;await tick();
    page.confirmMerge();assert.equal(f.modalCalls,1);assert.equal(f.payloads.length,0);assert.equal(page.confirmation.length,10);
    await page.merge();assert.equal(f.payloads.length,1);assert.equal(f.payloads[0].length,10);assert.equal(f.dialog.closed,true);
    assert.equal(page.lastBatch.groups,10);assert.equal(page.lastBatch.removed,10);
    assert.equal(page.pendingCount,2);assert.equal(page.reviewedCount,10);assert.equal(page.pageGroups.length,2);
    assert.equal(f.notices.length,1);
    page.showAll=true;await page.filterGroups();assert.equal(page.pageGroups.length,10);
    assert.equal(page.pageGroups.filter(g=>g.summary.reviewed).length,10);assert.equal(page.selectedGroups().length,0);
    assert.ok(f.detailCalls.slice(12).every(ids=>ids.length===1));
});

test('subset merges preserve unselected senses and mark the remaining group reviewed',async()=>{
    const f=fixture(),page=f.page;await tick();const group=page.pageGroups[0];
    group.selected[30]=false;page.changeSelection(group);page.selectPrimary(group,f.cards[1]);
    group.meaning='Một nghĩa đã chọn';page.meaningChanged(group);
    page.confirmMerge();await page.merge();
    assert.deepEqual(f.payloads[0],[{primaryId:20,meaning:'Một nghĩa đã chọn',groupIds:[10,20,30],sources:[{id:10,fingerprint:'a'},{id:20,fingerprint:'b'}]}]);
    assert.equal(page.pageGroups.length,0);page.showAll=true;await page.filterGroups();
    assert.deepEqual(plain(page.pageGroups[0].summary.ids),[20,30]);assert.equal(page.pageGroups[0].summary.reviewed,true);
});

test('a skipped group and all its edits stay pending while other groups are saved',async()=>{
    const f=fixture({groups:manyGroups(3)}),page=f.page;await tick();
    const skip=page.pageGroups[1];skip.included=false;skip.meaning='Chưa gộp vội';page.meaningChanged(skip);
    page.confirmMerge();await page.merge();assert.equal(f.payloads[0].length,2);
    assert.equal(page.pendingCount,1);assert.equal(page.pageGroups[0].meaning,'Chưa gộp vội');assert.equal(page.pageGroups[0].included,false);
});

test('single flight and navigation guard remain active until the server acknowledges',async()=>{
    const save=deferred(),calls=[];
    const f=fixture({api:{mergeVocabularyDuplicateBatch(payload){calls.push(plain(payload));return save.promise;}}}),page=f.page;await tick();
    page.confirmMerge();const confirmation=plain(page.confirmation.map(i=>i.payload));
    const pending=page.merge();page.merge();page.refresh();page.showPage(2);assert.equal(calls.length,1);
    let prevented=false;f.events.$locationChangeStart({preventDefault(){prevented=true;}});assert.equal(prevented,true);
    save.resolve([{card:{id:10},mergedCount:2,group:{word:'minimal',ids:[10],reviewed:true}}]);await pending;
    assert.deepEqual(calls[0],confirmation);assert.equal(page.merging,false);
});

test('stale or incomplete acknowledgement keeps drafts and cannot be resubmitted without a fresh review',async()=>{
    for (const result of [{status:409,data:{message:'Nhóm đã đổi'}},null]) {
        const f=fixture({api:{mergeVocabularyDuplicateBatch:()=>result?Promise.reject(result):Promise.resolve([])}}),page=f.page;await tick();
        const group=page.pageGroups[0];group.meaning='Bản đang sửa';page.meaningChanged(group);
        page.confirmMerge();await page.merge();assert.equal(group.meaning,'Bản đang sửa');assert.equal(group.stale,true);
        assert.equal(page.canMerge(),false);assert.equal(f.dialog.closed,undefined);assert.equal(f.notices.length,0);
        assert.equal(page.lastBatch,undefined);assert.ok(page.mergeError);
        page.cancelMerge();await page.refresh();assert.equal(page.canMerge(),true);assert.equal(page.pageGroups[0].meaning,'Bản đang sửa');
    }
});

test('empty and oversized meanings or incomplete details prevent a batch confirmation',async()=>{
    const f=fixture(),page=f.page;await tick();const group=page.pageGroups[0];
    group.meaning=' ';page.confirmMerge();assert.equal(f.modalCalls,0);
    group.meaning='x'.repeat(501);page.confirmMerge();assert.equal(f.modalCalls,0);
    f.api.getVocabularyDuplicateDetails=()=>Promise.resolve([f.cards[0],f.cards[0],f.cards[2]]);
    await page.reload(group);assert.equal(group.loaded,false);assert.ok(group.error);assert.equal(page.canMerge(),false);
});

test('manual list check persists via its own API, hides only after acknowledgement and does not call merge',async()=>{
    const save=deferred(),calls=[];
    const f=fixture({api:{setVocabularyDuplicateReviewed(payload){calls.push(plain(payload));return save.promise;}}}),page=f.page;await tick();
    const group=page.pageGroups[0];let prevented=false;
    const pending=page.toggleReview(group,{preventDefault(){prevented=true;},stopPropagation(){}});
    assert.equal(prevented,true);assert.equal(page.reviewing,true);assert.equal(page.pageGroups.length,1);assert.equal(group.summary.reviewed,false);
    assert.equal(calls[0].sources.length,3);assert.equal(calls[0].reviewed,true);assert.equal(f.payloads.length,0);
    save.resolve({word:'minimal',ids:[10,20,30],reviewed:true,reviewedAt:1234});await pending;
    assert.equal(page.pageGroups.length,0);assert.equal(page.reviewedCount,1);
    f.api.setVocabularyDuplicateReviewed=payload=>Promise.resolve({word:'minimal',ids:[10,20,30],reviewed:payload.reviewed});
    page.showAll=true;await page.filterGroups();assert.equal(page.pageGroups[0].summary.reviewed,true);
    await page.toggleReview(page.pageGroups[0]);assert.equal(page.pageGroups[0].summary.reviewed,false);
    assert.equal(page.pendingCount,1);assert.equal(page.reviewedCount,0);assert.equal(f.payloads.length,0);
});

test('failed manual check stays unchecked and read-only reviewed results survive refresh',async()=>{
    const f=fixture({api:{setVocabularyDuplicateReviewed:()=>Promise.reject({status:409,data:{message:'Có thẻ mới'}})}}),page=f.page;await tick();
    const group=page.pageGroups[0];await page.toggleReview(group);
    assert.equal(group.summary.reviewed,false);assert.equal(group.stale,true);assert.equal(page.pendingCount,1);assert.equal(page.reviewedCount,0);
    assert.equal(f.notices.length,0);assert.match(group.error,/Có thẻ mới/);
    const reviewed=fixture({groups:[{word:'kept',ids:[77],reviewed:true,reviewedAt:1234}]});await tick();
    assert.equal(reviewed.page.pageGroups.length,0);assert.equal(reviewed.detailCalls.length,0);
    reviewed.page.showAll=true;await reviewed.page.filterGroups();assert.equal(reviewed.page.pageGroups[0].summary.reviewed,true);
    await reviewed.page.refresh();assert.equal(reviewed.page.pageGroups[0].summary.reviewed,true);assert.equal(reviewed.page.canMerge(),false);
});

test('old detail replies cannot overwrite fresh refreshed data and destroyed views do not report success',async()=>{
    const old=deferred();let first=true;
    const f=fixture({api:{getVocabularyDuplicateDetails(){if(first){first=false;return old.promise;}return Promise.resolve([
        {id:10,question:'minimal',motherTongue:'new',fingerprint:'1'}, {id:20,question:'minimal',motherTongue:'new',fingerprint:'2'},
        {id:30,question:'minimal',motherTongue:'new',fingerprint:'3'}]);}}});await tick();
    await f.page.refresh();old.resolve(f.cards);await tick();assert.equal(f.page.pageGroups[0].meaning,'new');
    const save=deferred(),g=fixture({api:{mergeVocabularyDuplicateBatch:()=>save.promise}});await tick();g.page.confirmMerge();
    const pending=g.page.merge();g.events.$destroy();save.resolve([{card:{id:10},mergedCount:2,group:{word:'minimal',ids:[10],reviewed:true}}]);await pending;
    assert.equal(g.notices.length,0);assert.equal(g.page.lastBatch,undefined);
});

test('list navigation can repeatedly scroll to the same group',async()=>{
    const f=fixture();await tick();f.page.scrollToGroup(f.page.pageGroups[0]);f.page.scrollToGroup(f.page.pageGroups[0]);
    assert.equal(f.scrolls.length,2);assert.equal(f.scrolls[0][0],f.scrolls[1][0]);
});

test('service requests include reviewed groups and use batch/review endpoints',async()=>{
    let Service;
    vm.runInNewContext(fs.readFileSync(path.join(app,'question/business/QuestionService.js'),'utf8'),{
        angular:{module:()=>({service(name,fn){Service=fn;}})}
    });
    const calls=[],response={data:'server result'};
    const http={get(...args){calls.push(['GET',...args]);return Promise.resolve(response);},
        post(...args){calls.push(['POST',...args]);return Promise.resolve(response);}};
    const api=new Service(http,{},{},{api:{baseUrl:'/api/',apiV1Url:''}},{});
    assert.equal(await api.getVocabularyDuplicateGroups(true),'server result');
    await api.getVocabularyDuplicateDetails([1]);await api.mergeVocabularyDuplicateBatch([{primaryId:1}]);
    await api.setVocabularyDuplicateReviewed({reviewed:true,sources:[]});
    assert.deepEqual(plain(calls),[
        ['GET','/api/question/vocabulary/duplicates',{timeout:30000,params:{includeReviewed:true}}],
        ['POST','/api/question/vocabulary/duplicates/details',{ids:[1]},{timeout:30000}],
        ['POST','/api/question/vocabulary/duplicates/merge_batch',[{primaryId:1}],{timeout:90000}],
        ['POST','/api/question/vocabulary/duplicates/review',{reviewed:true,sources:[]},{timeout:30000}]
    ]);
    const template=fs.readFileSync(path.join(app,'topic/views/vocabulary_duplicates.html'),'utf8');
    assert.match(template,/ng-repeat="group in vm.pageGroups track by group.uid"/);
    assert.match(template,/vm.toggleReview\(group,\$event\)/);assert.match(template,/Hiện tất cả/);
    assert.match(template,/name="vocabulary-primary-\{\{group.uid\}\}"/);
});
