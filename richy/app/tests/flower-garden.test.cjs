const {test} = require('node:test');
const assert = require('node:assert/strict');
const garden = require('../campaign/rosary2026/FlowerGarden2026.js');
const campaign = {name:'Cùng Mẹ, em yêu mến Chúa',startDate:'2026-10-01',endDate:'2026-10-31',flowerItems:['a','b','c','d'].map(itemKey=>({itemKey,name:itemKey}))};
test('only the designated October campaign enables the garden',()=>{
    assert.equal(garden.enabled(campaign),true);
    assert.equal(garden.enabled({...campaign,name:'Other campaign'}),false);
    assert.equal(garden.enabled({...campaign,endDate:'2026-11-01'}),false);
});
test('31 days retain item colors when four petals become five or practices are reordered',()=>{
    const entries=[{date:'2026-10-02',itemKey:'b',completed:true,paintColor:'#F48FB1'},{date:'2026-10-02',itemKey:'c',completed:true}];
    let state=garden.build(campaign,entries,'2026-10-02');
    assert.equal(state.flowers.length,31); assert.equal(state.flowers[1].petals.length,4);
    assert.equal(state.flowers[1].available,1); assert.equal(state.flowers[1].petals[1].color,'#F48FB1');
    const changed={...campaign,flowerItems:[campaign.flowerItems[2],...campaign.flowerItems.filter(x=>x.itemKey!=='c'),{itemKey:'e',name:'New'}]};
    state=garden.build(changed,entries,'2026-10-02');
    assert.equal(state.flowers[1].petals.length,5);
    assert.equal(state.flowers[1].petals.find(x=>x.key==='b').color,'#F48FB1');
    assert.equal(state.flowers[1].petals.find(x=>x.key==='e').color,'#FFFFFF');
    assert.equal(state.flowers[0].future,false);assert.equal(state.flowers[2].future,true);
});
test('resetting colors restores credits without changing completion and retires removed practices',()=>{
    const entries=[{date:'2026-10-02',itemKey:'b',completed:true,paintColor:'#EF5350'},{date:'2026-10-02',itemKey:'a',completed:false,paintColor:null}];
    const before=garden.build(campaign,entries,'2026-10-02');
    const after=garden.build(campaign,entries.map(x=>({...x,paintColor:null})),'2026-10-02');
    assert.equal(before.available,0);assert.equal(after.available,1);assert.equal(after.earned,1);assert.equal(after.used,0);
    const removed=garden.build({...campaign,flowerItems:campaign.flowerItems.filter(x=>x.itemKey!=='b')},entries,'2026-10-02');
    assert.equal(removed.earned,0);assert.equal(removed.used,0);
});
