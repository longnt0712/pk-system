const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const config=require('../campaign/rosary2026/RosaryCampaign2026.js');
const campaign={name:'Cùng Mẹ, em yêu mến Chúa',startDate:'2026-10-01',endDate:'2026-10-31'};
test('each class cycles all five mysteries daily from 2 October throughout the month',()=>{
    for(const [name,group] of [['CHIÊN CON 3A (DCN1 CŨ)','vui'],['ẤU NHI 1A (DCN2 CŨ)','mung'],['THIẾU NHI 1A (HATT3A CŨ)','sang'],['NGHĨA SĨ 1B (TS3B CŨ)','thuong']]){
        for(let day=2;day<=31;day++){
            const date='2026-10-'+String(day).padStart(2,'0');
            const guide=config.select({classes:[name]},date);
            assert.equal(guide.group,group); assert.equal(guide.number,(day-2)%5+1); assert.equal(guide.randomizable,false);
        }
    }
});
test('guide is restricted to the named campaign and configured month',()=>{
    assert.equal(config.appliesTo(campaign,'2026-10-02'),true);
    for(const date of ['2026-10-01','2026-11-01','2027-10-02'])assert.equal(config.appliesTo(campaign,date),false);
    assert.equal(config.appliesTo({...campaign,name:'Mùa Chay'},'2026-10-02'),false);
    assert.equal(config.appliesTo({...campaign,startDate:'2025-10-01'},'2026-10-02'),false);
    assert.equal(config.appliesTo({...campaign,endDate:'2026-10-05'},'2026-10-06'),false);
    assert.equal(config.select({classes:['Chiên']},'2026-11-01'),null);
});
test('all twenty random options have matching local portraits and refresh never repeats its previous selection',()=>{
    const images=new Set();
    for(let i=0;i<20;i++){
        const guide=config.select({classes:['Khác']},'2026-10-02',()=>i/20);
        assert.equal(guide.randomizable,true); images.add(guide.imageUrl);
        assert.ok(fs.existsSync(path.join(__dirname,'..',guide.imageUrl)));
        assert.match(guide.contemplation,/^Thứ (nhất|hai|ba|bốn|năm) thì ngắm: /);
        assert.match(guide.prayer,/^Ta hãy xin/);
        for(let j=0;j<19;j++)assert.notEqual(config.select({classes:['HT']},'2026-10-02',()=>j/19,guide).imageUrl,guide.imageUrl);
    }
    assert.equal(images.size,20);
});
test('unknown, absent and conflicting class membership use random selection',()=>{
    for(const classes of [[],['Quý Cha, Quý Sơ'],['LỚP THỨ 3'],['HT'],['Chiên Con 1','Thiếu Nhi 1']])assert.equal(config.classGroup({classes}),null);
    assert.equal(config.classGroup({classes:['ÂU NHI 1','Ấu Nhi 2']}),'mung');
});
