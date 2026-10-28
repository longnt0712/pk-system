const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(setImmediate);
function setup({settings={isAdmin:true,permissionsLoaded:true},account={roles:[]}}={}){
 let Controller;const events={},documentEvents={},intervals=[],calls=[],terminations=[],notices=[],classes=new Set();
 const angular={module(){return {controller(name,fn){Controller=fn;}};},fromJson:JSON.parse,copy:plain,isArray:Array.isArray};
 nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/controllers/BattleOnlineAdminController.js'),'utf8'),{angular});
 const document={body:{classList:{add(name){classes.add(name);},remove(name){classes.delete(name);}}},getElementById(){return null;}};
 const $document=[document];$document.on=(name,fn)=>documentEvents[name]=fn;$document.off=(name,fn)=>{if(documentEvents[name]===fn)delete documentEvents[name];};
 const scope={$on(name,fn){events[name]=fn;},$evalAsync(fn){fn();}};
 const interval=(fn,delay)=>{const entry={fn,delay,cancelled:false};intervals.push(entry);return entry;};interval.cancel=entry=>entry.cancelled=true;
 const service={getAdminRooms(){return new Promise((resolve,reject)=>calls.push({resolve,reject}));},terminateAdminRoom(code){return new Promise((resolve,reject)=>terminations.push({code,resolve,reject}));}};
 const vm=new Controller(scope,interval,{get(key){assert.equal(key,'education.user');return typeof account==='string'?account:JSON.stringify(account);}},
  {success(...args){notices.push(args);}},service,settings,$document,fn=>fn());
 return {vm,calls,terminations,intervals,events,documentEvents,classes,settings,notices,document,
  async list(rooms=sample()){calls[calls.length-1].resolve(plain(rooms));await tick();},
  destroy(){events.$destroy();}};
}
function sample(){return [{code:'PLAY01',status:'PLAYING',mode:'CLASSIC',hostUsername:'teacher',hostDisplayName:'Cô Lan',topicName:'Family words',playerCount:5,connectedPlayerCount:4,spectatorCount:1},
 {code:'WAIT01',status:'LOBBY',mode:'LUM_NGAY',hostUsername:'host2',hostDisplayName:'Thầy Minh',topicName:'Travel plans',playerCount:2,connectedPlayerCount:2,spectatorCount:1},
 {code:'EGGS01',status:'PLAYING',mode:'LUM_NGAY',giftOpening:true,hostUsername:'host3',hostDisplayName:'Cô Mai',topicName:'Grammar',playerCount:6},
 {code:'DONE01',status:'FINISHED',mode:'CLASSIC',hostUsername:'host4'}];}

test('only exact admin permission or legacy exact account role can load the monitor',()=>{
 for(const account of [{roles:[{name:'ROLE_USER'}]},{roles:[{name:'ROLE_SUPER_ADMIN'}]},{roles:['ADMIN']},'{bad JSON']){
  const h=setup({settings:{isAdmin:'true'},account});assert.equal(h.vm.allowed,false);assert.equal(h.calls.length,0);assert.equal(h.intervals.length,0);
 }
 const legacy=setup({settings:{},account:{roles:[{name:'ROLE_ADMIN'}]}});assert.equal(legacy.calls.length,1);
 const loadedDenial=setup({settings:{permissionsLoaded:true,isAdmin:false},account:{roles:[{name:'ROLE_ADMIN'}]}});assert.equal(loadedDenial.calls.length,0,'loaded permissions override a stale account cookie');
});

test('direct URL waits for permissionsLoaded before fetching or showing denied state',async()=>{
 const settings={permissionsLoaded:false,isAdmin:false},h=setup({settings,account:{roles:[{name:'ROLE_ADMIN'}]}});
 assert.equal(h.vm.checkingAccess,true);assert.equal(h.vm.forbidden,false);assert.equal(h.calls.length,0);assert.equal(h.intervals.length,0);
 settings.permissionsLoaded=true;settings.isAdmin=true;h.events.permissionsLoaded();assert.equal(h.vm.allowed,true);assert.equal(h.calls.length,1);assert.equal(h.intervals[0].delay,5000);
 await h.list();settings.isAdmin=false;h.events.permissionsLoaded();assert.equal(h.vm.forbidden,true);assert.deepEqual(plain(h.vm.rooms),[]);assert.equal(h.intervals[0].cancelled,true);
});

test('default shows active matches; status and search filters cover code, host, topic and mode without finished rooms',async()=>{
 const h=setup();await h.list();assert.equal(h.vm.statusFilter,'PLAYING');assert.deepEqual(plain(h.vm.visibleRooms().map(room=>room.code)),['PLAY01','EGGS01']);
 assert.equal(h.vm.countStatus('PLAYING'),2);assert.equal(h.vm.countStatus('LOBBY'),1);assert.equal(h.vm.statusName(h.vm.rooms[2]),'Bóc trứng cuối');
 h.vm.statusFilter='ALL';for(const [query,expected] of [['wait01','WAIT01'],['thầy minh','WAIT01'],['Family','PLAY01'],['Diệt quỷ',null],['Lụm ngay','WAIT01']]){
  h.vm.search=query;const matches=h.vm.visibleRooms();assert.equal(matches[0]&&matches[0].code,expected||undefined);
 }
 h.vm.search='';h.vm.statusFilter='LOBBY';assert.deepEqual(plain(h.vm.visibleRooms().map(room=>room.code)),['WAIT01']);assert.ok(h.vm.lastUpdatedAt);
});

test('refresh serializes manual and polling requests, preserves rows on failure and clears them on forbidden',async()=>{
 const h=setup();h.vm.refresh();h.intervals[0].fn();assert.equal(h.calls.length,1,'pending GET is not duplicated');
 await h.list();h.vm.refresh();assert.equal(h.calls.length,2);h.calls[1].reject({status:500});await tick();assert.equal(h.vm.rooms.length,3);assert.match(h.vm.loadError,/Không tải được/);assert.equal(h.vm.refreshing,false);
 h.intervals[0].fn();h.calls[2].reject({status:403});await tick();assert.equal(h.vm.allowed,false);assert.equal(h.vm.forbidden,true);assert.deepEqual(plain(h.vm.rooms),[]);assert.equal(h.vm.lastUpdatedAt,null);assert.equal(h.intervals[0].cancelled,true);
 h.vm.refresh();assert.equal(h.calls.length,3);
});

test('the destructive API is called only after confirmation and repeated clicks cannot terminate twice',async()=>{
 const h=setup();await h.list();h.vm.openTerminate(h.vm.rooms[0]);assert.equal(h.terminations.length,0);assert.equal(h.vm.confirmRoom.code,'PLAY01');assert.equal(h.classes.has('battle-admin-confirm-open'),true);
 h.intervals[0].fn();h.vm.refresh();assert.equal(h.calls.length,1,'confirmation pauses refresh');
 h.vm.cancelTerminate();assert.equal(h.vm.confirmRoom,null);assert.equal(h.terminations.length,0);
 h.vm.openTerminate(h.vm.rooms[0]);h.vm.confirmTerminate();h.vm.confirmTerminate();h.vm.cancelTerminate();assert.equal(h.terminations.length,1);assert.equal(h.terminations[0].code,'PLAY01');assert.equal(h.vm.confirmRoom.code,'PLAY01','busy confirmation stays visible');
 h.terminations[0].resolve({code:'PLAY01',status:'FINISHED'});await tick();assert.equal(h.vm.confirmRoom,null);assert.equal(h.vm.terminating,false);assert.deepEqual(plain(h.vm.rooms.map(room=>room.code)),['WAIT01','EGGS01']);assert.equal(h.classes.size,0);assert.match(h.notices[0][0],/PLAY01/);
});

test('failed termination keeps the room and confirmation available for retry; forbidden removes all cached rooms',async()=>{
 const h=setup();await h.list();h.vm.openTerminate(h.vm.rooms[0]);h.vm.confirmTerminate();h.terminations[0].reject({status:409,data:{message:'Phòng vừa thay đổi'}});await tick();
 assert.equal(h.vm.rooms.length,3);assert.equal(h.vm.confirmRoom.code,'PLAY01');assert.equal(h.vm.terminateError,'Phòng vừa thay đổi');assert.equal(h.vm.terminating,false);
 h.vm.confirmTerminate();assert.equal(h.terminations.length,2);h.terminations[1].reject({status:403});await tick();assert.equal(h.vm.forbidden,true);assert.equal(h.vm.confirmRoom,null);assert.deepEqual(plain(h.vm.rooms),[]);assert.equal(h.intervals[0].cancelled,true);
});

test('late GET and termination responses after leaving the page never repopulate state or notify',async()=>{
 const loading=setup();loading.destroy();loading.calls[0].resolve(sample());await tick();assert.deepEqual(plain(loading.vm.rooms),[]);assert.equal(loading.intervals[0].cancelled,true);assert.equal(loading.documentEvents.keydown,undefined);
 const terminating=setup();await terminating.list();terminating.vm.openTerminate(terminating.vm.rooms[0]);terminating.vm.confirmTerminate();terminating.destroy();terminating.terminations[0].resolve({});await tick();assert.equal(terminating.notices.length,0);assert.equal(terminating.vm.confirmRoom,null);assert.equal(terminating.classes.size,0);
});

test('permission revocation invalidates a pending GET instead of exposing its late response',async()=>{
 const h=setup();h.settings.isAdmin=false;h.events.permissionsLoaded();h.calls[0].resolve(sample());await tick();assert.equal(h.vm.forbidden,true);assert.deepEqual(plain(h.vm.rooms),[]);assert.equal(h.vm.refreshing,false);
});
