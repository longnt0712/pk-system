const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../campaign/controllers/CampaignFieldController.js'),'utf8');
const campaign={id:5,shareCode:'c'.repeat(32),name:'Cùng Mẹ, em yêu mến Chúa',startDate:'2026-10-01',endDate:'2026-10-31',flowerItems:[{itemKey:'p',name:'Lần hạt'}]};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({enabled=true,role='student',credentials=false,field}={}){
    let registration,watch;
    const events={},calls=[],timers=new Map();let nextTimer=0;
    const settings={campaignsEnabled:enabled,permissionsLoaded:true,isAdmin:role==='admin',isEducationManagerment:role==='education',isStudentManagerment:role==='manager'};
    const auth={hasCredentials:()=>credentials};
    const service={getByShareCode:async()=>({data:campaign}),fieldClasses:async()=>({data:[{id:12,name:'Thiếu 1'}]}),
        field:async(...args)=>{calls.push(args);return field?field(...args):{data:{gardens:[{id:1,fullName:'An',saintName:'Đa Minh',classes:[],completedCount:0,colors:[]}],hasMore:false}};}};
    const timeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};timeout.cancel=id=>timers.delete(id);
    const scope={$watch:(fn,listener)=>{watch={fn,listener,value:fn()};return()=>{};},$on:(name,fn)=>{events[name]=fn;return()=>{};}};
    const redirects=[];
    nodeVm.runInNewContext(source,{angular:{module:()=>({controller:(name,r)=>registration=r,directive(){}})}});
    const Controller=registration[registration.length-1];
    const vm=new Controller(scope,{go:(...args)=>redirects.push(args)},{campaignCode:campaign.shareCode},{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js')},timeout,settings,service,auth);
    return{vm,calls,events,settings,redirects,service,setCredentials:v=>{credentials=v;},digest:()=>{const v=watch.fn();if(v!==watch.value){const old=watch.value;watch.value=v;watch.listener(v,old);}},flush:()=>{const pending=[...timers.values()];timers.clear();pending.forEach(t=>t.fn());},timers};
}
test('anonymous viewers and logged-in students use the public endpoint, including empty gardens',async()=>{
    for(const credentials of [false,true]){const h=setup({credentials});await tick();assert.equal(h.calls[0][2],false);assert.equal(h.vm.gardens[0].completedCount,0);assert.equal(h.vm.gardens[0].fullName,'An');assert.equal(h.calls[0][1].size,6);}
});
test('only an authenticated Admin or either Management role requests private gardens',async()=>{
    for(const role of ['admin','education','manager']){const h=setup({role,credentials:true});await tick();assert.equal(h.calls[0][2],true);const guest=setup({role});await tick();assert.equal(guest.calls[0][2],false);}
});
test('logout clears private cards and dialogs immediately and rejects an outstanding private response',async()=>{
    const replies=[];const h=setup({role:'admin',credentials:true,field:()=>new Promise(r=>replies.push(r))});await tick();
    h.vm.gardens=[{id:9}];h.vm.selected=h.vm.gardens[0];h.setCredentials(false);h.digest();assert.equal(h.vm.gardens.length,0);assert.equal(h.vm.selected,null);assert.equal(h.calls[1][2],false);
    replies[0]({data:{gardens:[{id:9}],hasMore:false}});await tick();assert.equal(h.vm.gardens.length,0);
    replies[1]({data:{gardens:[{id:1}],hasMore:false}});await tick();assert.equal(h.vm.gardens[0].id,1);
});
test('expired or forbidden management access falls back to a fresh student-only list',async()=>{
    const h=setup({role:'admin',credentials:true,field:async(id,filters,managed)=>{if(managed)throw{status:403};return{data:{gardens:[{id:1}],hasMore:false}};}});await tick();assert.equal(h.calls.length,2);assert.equal(h.calls[1][2],false);assert.equal(h.vm.gardens[0].id,1);
});
test('cursor loads are bounded, deduplicated and preserve the filters',async()=>{
    let page=0;const h=setup({field:async()=>({data:page++===0?{gardens:[{id:1}],hasMore:true,nextCursor:'10:1'}:{gardens:[{id:1},{id:2}],hasMore:false}})});await tick();await h.vm.loadMore();assert.equal(h.calls[1][1].cursor,'10:1');assert.deepEqual(Array.from(h.vm.gardens,x=>x.id),[1,2]);assert.equal(h.vm.hasMore,false);
});
test('debounced name changes discard stale responses and class changes start a new cursor',async()=>{
    let finish;const h=setup({field:()=>new Promise(r=>finish=r)});await tick();h.vm.query='  Nguyễn An  ';h.vm.searchChanged();finish({data:{gardens:[{id:99}],hasMore:false}});await tick();assert.equal(h.vm.gardens.length,0);assert.equal(h.timers.size,1);h.vm.classId=12;h.flush();assert.equal(h.calls[1][1].q,'Nguyễn An');assert.equal(h.calls[1][1].classId,12);assert.equal(h.calls[1][1].cursor,'');
});
test('network failure preserves earlier cards and retries the same cursor without advancing',async()=>{
    let page=0;const h=setup({field:async()=>{if(page++===0)return{data:{gardens:[{id:1}],hasMore:true,nextCursor:'3:1'}};if(page===2)throw{status:500};return{data:{gardens:[{id:2}],hasMore:false}};}});await tick();await h.vm.loadMore();assert.equal(h.vm.gardens.length,1);assert.ok(h.vm.error);await h.vm.loadMore();assert.equal(h.vm.gardens.length,2);assert.equal(h.calls[2][1].cursor,'3:1');
});
test('disabled domains never register listeners or request garden data',async()=>{const h=setup({enabled:false});await tick();assert.equal(h.calls.length,0);assert.equal(h.redirects[0][0],'login');assert.equal(Object.keys(h.events).length,0);});
test('destroy prevents delayed data from populating the abandoned screen',async()=>{let finish;const h=setup({field:()=>new Promise(r=>finish=r)});await tick();h.events.$destroy();finish({data:{gardens:[{id:99}],hasMore:false}});await tick();assert.equal(h.vm.gardens.length,0);});
test('only the precise shared field path is exempt from login',()=>{
    const app=fs.readFileSync(path.join(__dirname,'../application.js'),'utf8');const start=app.indexOf('function isPublicCampaignPage()');const fn=app.slice(start,app.indexOf("$rootScope.$on('$stateChangeStart'",start));
    for(const [pathname,allowed]of [['/campaigns/c/'+campaign.shareCode+'/canh-dong-hoa',true],['/campaigns/c/'+campaign.shareCode+'/canh-dong-hoa/',true],['/campaigns/c/'+campaign.shareCode+'/canh-dong-hoa/edit',false],['/campaigns/5/canh-dong-hoa',false],['/campaigns/c/short/canh-dong-hoa',false]]){const c=nodeVm.createContext({settings:{campaignsEnabled:true},window:{location:{pathname}}});nodeVm.runInContext(fn,c);assert.equal(c.isPublicCampaignPage(),allowed);c.settings.campaignsEnabled=false;assert.equal(c.isPublicCampaignPage(),false);}
});
test('field service keeps public reads separate from authenticated Management requests',()=>{
    let Service;const calls=[];
    nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../campaign/business/CampaignService.js'),'utf8'),{angular:{module:()=>({service:(name,r)=>Service=r[r.length-1]})}});
    const service=new Service({get:(url,config)=>calls.push({url,config})},{api:{baseUrl:'https://tnttphungkhoang.com/service/'}});
    service.field(5,{size:6},false);service.field(5,{size:6},true);service.fieldClasses(5);
    assert.equal(calls[0].url,'https://tnttphungkhoang.com/service/public/campaigns/5/field');assert.equal(calls[0].config.skipSessionAuth,true);
    assert.equal(calls[1].url,'https://tnttphungkhoang.com/service/api/campaigns/5/field');assert.equal(calls[1].config.skipSessionAuth,false);
    assert.equal(calls[2].config.skipSessionAuth,true);
});
