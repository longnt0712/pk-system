const {test} = require('node:test');
const assert = require('node:assert/strict');
const garden = require('../campaign/rosary2026/FlowerGarden2026.js');
const campaign = {name:'Cùng Mẹ, em yêu mến Chúa',startDate:'2026-10-01',endDate:'2026-10-31',flowerItems:['a','b','c','d'].map(itemKey=>({itemKey,name:itemKey}))};
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
for (const source of ['advent2026/AdventCampaign2026.js', 'rosary2026/FlowerGarden2026.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../campaign', source), 'utf8'), {window});
}
test('Advent flowers span the year boundary and spend Mass and written-prayer credits on separate petals', () => {
    const advent = window.AdventCampaign2026;
    const campaign = advent.draft();
    campaign.flowerItems.forEach((item, index) => {item.itemKey = 'practice-' + index;});
    const config = window.FlowerGarden2026;
    assert.equal(config.enabled(campaign), true);
    assert.equal(config.fieldEnabled(campaign), false);
    const entries = [
        {date: '2026-12-02', itemKey: 'practice-1', completed: true},
        {date: '2026-12-02', itemKey: 'advent-weekly-prayer', completed: true, prayerText: 'Lạy Chúa, xin giúp con.'},
        {date: '2026-12-02', itemKey: 'advent-mass-bonus', completed: false, paintColor: '#EF5350'}
    ];
    const state = config.build(campaign, entries, '2026-12-02');
    assert.equal(state.flowers.length, 35);
    assert.equal(state.flowers[0].date, '2026-11-29');
    assert.equal(state.flowers.at(-1).date, '2027-01-02');
    const flower = state.flowers.find(value => value.date === '2026-12-02');
    assert.equal(flower.earned, 3);
    assert.equal(flower.used, 1);
    assert.equal(flower.available, 2);
    assert.equal(flower.petals.length, 6);
    assert.equal(state.flowers.find(value => value.date === '2026-12-03').future, true);
    assert.equal(config.build(campaign, entries.map(entry => ({...entry, prayerText: ''})), '2026-12-02').earned, 2);
});
test('typing limits preserve word boundaries and bound pasted prayers to three lines', () => {
    const config = window.AdventCampaign2026;
    const measure = text => text.length * 30;
    assert.equal(config.fitPrayer('Lạy ', measure), 'Lạy ');
    for (const text of ['Lạy Chúa '.repeat(35), 'W'.repeat(300), 'Xin Chúa ban cho gia đình con bình an.']) {
        const fitted = config.fitPrayer(text, measure);
        assert.ok(fitted.length <= 120);
        assert.ok(config.prayerText(fitted).split(' ').length <= 25);
        assert.ok(config.prayerLines(fitted, measure).length <= 3);
    }
});
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
