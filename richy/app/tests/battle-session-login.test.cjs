const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function setup(){
 let definition,generation=0,credentials=false,active=true;
 const listeners={},timers=[],modals=[],emitted=[],logins=[],lookups=[],saves=[],resumes=[];
 const angular={noop(){},copy:plain,module(){return {factory(name,fn){definition=fn;}};}};
 vm.runInNewContext(read('question/business/BattleSessionLogin.js'),{angular});
 const scope={$on(name,fn){(listeners[name]||=[]).push(fn);return ()=>{listeners[name]=listeners[name].filter(item=>item!==fn);};}};
 const root={$emit(name,data){emitted.push({name,data});},$broadcast(name){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of [...listeners[name]||[]])fn(event);return event;}};
 const auth={hasCredentials:()=>credentials,isCurrent:identity=>identity&&identity.generation===generation,capture:()=>({generation}),
  login(user){logins.push(plain(user));return h.login(user).then(response=>{credentials=true;response.sessionIdentity={generation:++generation};return response;});},
  saveUser(user,identity){if(!this.isCurrent(identity))return false;saves.push(user);return true;},
  expire(){credentials=false;generation++;root.$broadcast('session:reauthenticate');},logout(){h.logouts++;credentials=false;generation++;return Promise.resolve();}};
 const options={active:()=>active,user:()=>({id:1,username:'alice'}),roomCode:()=> 'GAME1',pause(){h.pauses++;},resume(user,current){resumes.push(user);return h.resume(user,current);}};
 const timeout=fn=>{fn();};
 const interval=fn=>{const timer={fn};timers.push(timer);return timer;};interval.cancel=timer=>{timer.cancelled=true;};
 const document={getElementById(){return {focus(){h.focuses++;}};}};
 const window={document,navigator:{onLine:true}};
 const deps={$rootScope:root,$http:{get(url,config){lookups.push({url,config});return h.lookup();}},$q:{when:Promise.resolve.bind(Promise),reject:Promise.reject.bind(Promise)},
  $uibModal:{open(config){const result=deferred(),popup={config,result:result.promise,opened:Promise.resolve(),closed:false,dismissed:false,
   close(){this.closed=true;result.resolve();},dismiss(){this.dismissed=true;result.reject();}};popup.view=new config.controller();modals.push(popup);return popup;}},
  AuthSession:auth,settings:{api:{baseUrl:'/service/'}},$window:window,$interval:interval,$timeout:timeout};
 const h={root,scope,auth,options,window,timers,modals,emitted,logins,lookups,saves,resumes,pauses:0,focuses:0,logouts:0,
  login:()=>Promise.resolve({data:{access_token:'new'}}),lookup:()=>Promise.resolve({data:{id:1,username:'alice',roles:[]}}),resume:()=>Promise.resolve(),
  expire(){auth.expire();return tick();},destroy(){for(const fn of [...listeners.$destroy])fn();},active(value){active=value;},changeSession(){generation++;},setCredentials(value){credentials=value;}};
 definition.at(-1)(...definition.slice(0,-1).map(name=>deps[name])).bind(scope,options);
 return h;
}

test('expiration opens one non-dismissible modal for the current player, while inactive views do not intercept',async()=>{
 const h=setup();h.active(false);assert.equal(h.root.$broadcast('session:reauthenticate').defaultPrevented,false);assert.equal(h.modals.length,0);
 h.active(true);await h.expire();await h.expire();assert.equal(h.modals.length,1);
 const popup=h.modals[0];assert.equal(popup.config.backdrop,'static');assert.equal(popup.config.keyboard,false);assert.equal(popup.view.username,'alice');
 assert.equal(popup.view.roomCode,'GAME1');assert.match(popup.config.template,/autocomplete="current-password"/);h.destroy();assert.equal(popup.dismissed,true);assert.equal(h.timers[0].cancelled,true);
});
test('wrong password and offline attempts stay in the same modal and never resume the game',async()=>{
 const h=setup();await h.expire();const login=h.modals[0].view;
 h.window.navigator.onLine=false;login.password='secret';await login.submit();assert.equal(h.logins.length,0);assert.match(login.error,/Internet/);
 h.window.navigator.onLine=true;h.login=()=>Promise.reject({status:400,data:{error:'invalid_grant'}});await login.submit();
 assert.match(login.error,/Mật khẩu không đúng/);assert.equal(login.password,'');assert.equal(login.busy,false);assert.equal(h.resumes.length,0);assert.equal(h.modals[0].closed,false);h.destroy();
});
test('login restores the same identity before refreshing the room and clears the password immediately',async()=>{
 const h=setup(),gate=deferred();h.login=()=>gate.promise;await h.expire();const login=h.modals[0].view;
 login.username='a-different-name';login.password='secret';const pending=login.submit();assert.equal(login.password,'');assert.equal(login.busy,true);
 login.submit();assert.equal(h.logins.length,1);assert.equal(h.logins[0].username,'alice');gate.resolve({data:{access_token:'new'}});await pending;
 assert.equal(h.lookups[0].url,'/service/api/users/getCurrentUser');assert.equal(h.lookups[0].config.loginRequest,true);
 assert.equal(h.saves.length,1);assert.equal(h.emitted[0].name,'session:restored');assert.equal(h.resumes.length,1);assert.equal(h.modals[0].closed,true);h.destroy();
});
test('room reconnect failure can retry with the verified login without asking for the password again',async()=>{
 const h=setup();let attempts=0;h.resume=()=>++attempts===1?Promise.reject({status:503}):Promise.resolve();await h.expire();const login=h.modals[0].view;
 login.password='secret';await login.submit();assert.match(login.error,/Đã đăng nhập/);assert.equal(h.modals[0].closed,false);
 await login.submit();assert.equal(h.logins.length,1);assert.equal(h.resumes.length,2);assert.equal(h.modals[0].closed,true);h.destroy();
});
test('a different account ID cannot enter the previous player room or save its identity',async()=>{
 const h=setup();h.lookup=()=>Promise.resolve({data:{id:2,username:'alice'}});await h.expire();const login=h.modals[0].view;login.password='secret';await login.submit();
 assert.match(login.error,/không trùng/);assert.equal(h.logouts,1);assert.equal(h.saves.length,0);assert.equal(h.resumes.length,0);h.destroy();
});
test('leaving the Battle while login is pending ignores the late success and cancels the watchdog',async()=>{
 const h=setup(),gate=deferred();h.login=()=>gate.promise;await h.expire();const login=h.modals[0].view;login.password='secret';const request=login.submit();h.destroy();
 gate.resolve({data:{access_token:'new'}});await request;assert.equal(h.lookups.length,0);assert.equal(h.saves.length,0);assert.equal(h.resumes.length,0);assert.equal(h.modals[0].dismissed,true);
});
test('a superseding session during user lookup cannot resume or overwrite another login',async()=>{
 const h=setup(),gate=deferred();h.lookup=()=>gate.promise;await h.expire();const login=h.modals[0].view;login.password='secret';const request=login.submit();await tick();h.changeSession();
 gate.resolve({data:{id:1,username:'alice'}});await request;assert.match(login.error,/đã thay đổi/);assert.equal(h.saves.length,0);assert.equal(h.resumes.length,0);h.destroy();
});
test('missing cookies during a socket-only match trigger login; fullscreen exits before the modal opens',async()=>{
 const h=setup(),exit=deferred();h.window.document.fullscreenElement={};h.window.document.exitFullscreen=()=>exit.promise;
 h.setCredentials(true);h.timers[0].fn();assert.equal(h.modals.length,0);h.setCredentials(false);h.timers[0].fn();await tick();assert.equal(h.pauses,1);assert.equal(h.modals.length,0);
 exit.resolve();await tick();assert.equal(h.modals.length,1);h.destroy();
});
