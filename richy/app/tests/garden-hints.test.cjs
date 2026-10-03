const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../campaign/controllers/CampaignController.js'),'utf8');
function setup(){
    let factory,watch,destroy,unwatched=false;
    vm.runInNewContext(source,{angular:{module:()=>({controller(){},directive(name,registration){if(name==='campaignGardenHints')factory=registration.at(-1);}})}});
    const tasks=new Map(),listeners=new Map();let id=0;
    const timeout=(fn,delay)=>{const task={fn,delay,id:++id};tasks.set(task.id,task);return task;};
    timeout.cancel=task=>task&&tasks.delete(task.id);
    const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
    let nodes=['2026-10-01','2026-10-02'].map(date=>({getAttribute:()=>date,getBoundingClientRect:()=>({width:50,top:300,bottom:370})}));
    const target={getBoundingClientRect:()=>({top:0,bottom:844}),querySelectorAll:()=>nodes};
    const scope={vm:{garden:{flowers:[{date:'2026-10-01',available:1,future:false},{date:'2026-10-02',available:2,future:false},{date:'2026-10-04',available:1,future:true}]}},
        $watch(fn,listener){watch=listener;listener();return()=>{unwatched=true;};},$evalAsync:fn=>fn(),$on(name,fn){if(name==='$destroy')destroy=fn;}};
    factory(timeout,{document,innerHeight:844}).link(scope,[target]);
    function advance(delay){const task=[...tasks.values()].find(task=>task.delay===delay);assert.ok(task,`Timer ${delay}ms must be scheduled`);tasks.delete(task.id);task.fn();}
    return{state:scope.vm,tasks,listeners,document,advance,refresh:()=>watch(),destroy:()=>destroy(),unwatched:()=>unwatched,setNodes:value=>{nodes=value;}};
}
test('garden hint lasts seven seconds and rotates one visible flower after a quiet interval',()=>{
    const h=setup();h.advance(1800);assert.equal(h.state.gardenHintDate,'2026-10-01');assert.equal(h.tasks.size,1);
    h.advance(7000);assert.equal(h.state.gardenHintDate,null);assert.equal(h.tasks.size,1);
    h.advance(12000);assert.equal(h.state.gardenHintDate,'2026-10-02');
    h.advance(7000);h.state.garden.flowers.forEach(flower=>flower.available=0);h.refresh();
    assert.equal(h.tasks.size,0);assert.equal(h.state.gardenHintDate,null);
});
test('opening a picker, hidden tab and destroyed garden stop reminders and clean up timers',()=>{
    const h=setup();h.advance(1800);h.state.gardenDay={date:'2026-10-01'};h.refresh();
    assert.equal(h.state.gardenHintDate,null);assert.equal(h.tasks.size,0);
    h.state.gardenDay=null;h.refresh();h.document.hidden=true;h.listeners.get('visibilitychange')();
    assert.equal(h.tasks.size,0);assert.equal(h.state.gardenHintsPaused,true);
    h.document.hidden=false;h.listeners.get('visibilitychange')();h.advance(1800);
    assert.ok(h.state.gardenHintDate);h.destroy();
    assert.equal(h.tasks.size,0);assert.equal(h.listeners.size,0);assert.equal(h.state.gardenHintDate,null);assert.equal(h.unwatched(),true);
    h.refresh();assert.equal(h.tasks.size,0);
});
test('offscreen flowers receive no speech bubble and future dates alone schedule no reminders',()=>{
    const h=setup();h.setNodes([{getAttribute:()=> '2026-10-01',getBoundingClientRect:()=>({width:50,top:900,bottom:970})}]);
    h.advance(1800);assert.equal(h.state.gardenHintDate,null);h.advance(12000);assert.equal(h.state.gardenHintDate,null);
    h.state.garden.flowers=h.state.garden.flowers.filter(flower=>flower.future);h.refresh();assert.equal(h.tasks.size,0);
});
