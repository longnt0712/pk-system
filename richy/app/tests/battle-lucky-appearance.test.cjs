const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(setImmediate);
const tracks=[{name:'Battle song',url:'https://www.youtube.com/watch?v=MU0Yp0qmYEs',videoId:'MU0Yp0qmYEs',enabled:true,purpose:'BATTLE'},
 {name:'Lucky song',url:'https://www.youtube.com/watch?v=gOMUTUvVwEk',videoId:'gOMUTUvVwEk',enabled:true,purpose:'LUM_LIGHTNING'}];

async function admin(config={tracks}){
 let Controller,resolveSave,rejectSave;const calls=[],notices=[];
 const angular={module(){return {controller(name,fn){Controller=fn;}};},copy};
 nodeVm.runInNewContext(read('question/controllers/BattleMusicConfigController.js'),{angular});
 const service={getBattleMusicConfig(){return Promise.resolve(copy(config));},saveBattleMusicConfig(dto){calls.push(copy(dto));return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});}};
 const vm=new Controller({success(...args){notices.push(['success',...args]);},warning(...args){notices.push(['warning',...args]);},error(...args){notices.push(['error',...args]);}},service);
 await tick();return {vm,calls,notices,resolve(result){resolveSave(copy(result));},reject(error){rejectSave(error);}};
}

function game(config={tracks:[]}){
 let Controller,hooks;const angular={module(){return {controller(name,fn){Controller=fn;}};},forEach(items,fn){(items||[]).forEach(fn);},copy,fromJson:JSON.parse,noop(){},element(){return {on(){},off(){}};}};
 const source=read('question/controllers/BattleQuizOnlineController.js').replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,'expose({applyRoom,loadConfig:loadBattleViewMusicConfig});');
 nodeVm.runInNewContext(source,{angular,expose(value){hooks=value;}});
 const timer=()=>1;timer.cancel=()=>{};
 const window={APP_VERSION:'qa',location:{origin:'http://localhost'},navigator:{},document:{body:{classList:{add(){},remove(){}}},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
 const vm=new Controller({},{$on(){},$evalAsync(fn){fn();}},{go(){}},{},timer,timer,{get(){return JSON.stringify({id:1,username:'alice'});}},window,{warning(){},error(){}},{},{},{getActiveMusicTracks(){return Promise.resolve(copy(config));}});
 function room(appearance){const now=Date.now();return {code:'LOOKQA',status:'PLAYING',hostUsername:'host',serverTime:now,matchEndsAt:now+180000,giftOpening:true,giftOpeningEndsAt:now+180000,
  lumLuckyAppearance:appearance,settings:{mode:'LUM_NGAY',teamCount:0},players:[{username:'host',spectator:true},{username:'alice',spectator:false}],recentEvents:[],giftDrop:{gameId:'lookqa',version:1,poolVersion:1,gifts:[]},giftCredits:0,giftCreditVersion:1,giftLightning:{startsAt:now-10,endsAt:now+30000}};}
 return {vm,hooks,room};
}

test('Battle Config defaults to pumpkin for old payloads and saves the chosen appearance with all music groups',async()=>{
 const h=await admin();assert.equal(h.vm.lumLuckyAppearance,'PUMPKIN');assert.equal(h.vm.loading,false);
 h.vm.lumLuckyAppearance='LIGHTNING';h.vm.save();h.vm.save();assert.equal(h.calls.length,1,'double clicks are serialized');
 assert.equal(h.calls[0].lumLuckyAppearance,'LIGHTNING');assert.deepEqual(h.calls[0].tracks.map(track=>track.purpose),['BATTLE','LUM_LIGHTNING']);
 h.resolve({tracks,lumLuckyAppearance:'LIGHTNING'});await tick();assert.equal(h.vm.saving,false);assert.equal(h.vm.lumLuckyAppearance,'LIGHTNING');
 const reopened=await admin(h.calls[0]);assert.equal(reopened.vm.lumLuckyAppearance,'LIGHTNING','the saved config restores the switch');
 reopened.vm.lumLuckyAppearance='PUMPKIN';reopened.vm.save();assert.equal(reopened.calls[0].lumLuckyAppearance,'PUMPKIN');
 reopened.resolve({tracks,lumLuckyAppearance:'PUMPKIN'});await tick();assert.equal(reopened.vm.lumLuckyAppearance,'PUMPKIN');
});

test('a failed Battle Config save keeps the chosen appearance and music so the admin can retry',async()=>{
 const h=await admin({tracks,lumLuckyAppearance:'LIGHTNING'});h.vm.lumLuckyAppearance='PUMPKIN';h.vm.save();
 h.reject({data:{message:'Không lưu được cấu hình thử nghiệm'}});await tick();assert.equal(h.vm.saving,false);assert.equal(h.vm.lumLuckyAppearance,'PUMPKIN');
 assert.equal(h.vm.tracks.length,2);assert.ok(h.notices.some(notice=>notice[0]==='error'&&notice[1]==='Không lưu được cấu hình thử nghiệm'));
 h.vm.save();assert.equal(h.calls.length,2);assert.equal(h.calls[1].lumLuckyAppearance,'PUMPKIN');
});

test('players default to pumpkin and use the room appearance ahead of their active config, including reconnect snapshots',async()=>{
 const h=game({tracks:[],lumLuckyAppearance:'LIGHTNING'});assert.equal(h.vm.giftLuckyAppearance(),'PUMPKIN');
 await h.hooks.loadConfig();assert.equal(h.vm.giftLuckyAppearance(),'LIGHTNING');
 h.hooks.applyRoom(h.room('PUMPKIN'),false);assert.equal(h.vm.giftLuckyAppearance(),'PUMPKIN');assert.equal(h.vm.giftLuckyName(),'Bí ngô may mắn');assert.equal(h.vm.giftLuckyIcon(),'🎃');
 assert.match(h.vm.giftLuckyImage(),/^assets\/images\/battle-pumpkin\.svg\?v=qa$/);assert.equal(h.vm.giftLightningSeconds(),30);
 h.hooks.applyRoom(h.room('PUMPKIN'),true);assert.equal(h.vm.giftLuckyAppearance(),'PUMPKIN');
 h.hooks.applyRoom(h.room('LIGHTNING'),false);assert.equal(h.vm.giftLuckyAppearance(),'LIGHTNING');assert.equal(h.vm.giftLuckyName(),'Sét may mắn');assert.equal(h.vm.giftLuckyIcon(),'⚡');
 assert.match(h.vm.giftLuckyImage(),/^assets\/images\/battle-lightning\.svg\?v=qa$/);
});

test('lucky reward reveal and collection history keep server artwork and labels after configuration changes',async()=>{
 const h=game({tracks:[],lumLuckyAppearance:'PUMPKIN'});await h.hooks.loadConfig();h.hooks.applyRoom(h.room('PUMPKIN'),false);
 assert.equal(h.vm.getGiftRewardImage(-4),h.vm.giftLuckyImage());assert.match(h.vm.getGiftRewardLabel(-4),/Bí ngô may mắn[\s\S]*\+10%[\s\S]*30 giây/);
 const previous={rewardImage:'assets/images/battle-lightning.svg',rewardLabel:'Sét may mắn — cả phòng +10% tỉ lệ Tom đến Pikachu trong 30 giây'};
 assert.equal(h.vm.getGiftRewardImage(-4,null,previous),'assets/images/battle-lightning.svg?v=qa');assert.equal(h.vm.getGiftRewardLabel(-4,null,previous),previous.rewardLabel);
 const pumpkin={rewardImage:'assets/images/battle-pumpkin.svg',rewardLabel:'Bí ngô may mắn — cả phòng +10% tỉ lệ Tom đến Pikachu trong 30 giây'};
 h.hooks.applyRoom(h.room('LIGHTNING'),false);assert.equal(h.vm.getGiftRewardImage(-4,null,pumpkin),'assets/images/battle-pumpkin.svg?v=qa');assert.equal(h.vm.getGiftRewardLabel(-4,null,pumpkin),pumpkin.rewardLabel);
});

test('lucky descriptions include pets beyond Pikachu without changing the ten-percent thirty-second bonus',()=>{
 const h=game();
 assert.match(h.vm.getGiftRewardLabel(-4),/\+10% tỉ lệ pet từ Mèo Tom trở lên trong 30 giây/);
 for(const file of ['question/views/battle_quiz_online.html','question/views/battle_music_config.html']) {
  const source=read(file);assert.ok(source.includes('+10% tỉ lệ pet từ Mèo Tom trở lên'),file);
  assert.ok(!source.includes('tỉ lệ Tom đến Pikachu'),file+' should not imply that the boost stops at Pikachu');
 }
});
