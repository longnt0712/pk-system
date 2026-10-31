const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture({move,load}={}){
 let factory,dialog,closing;const done=deferred(),calls={load:[],move:[],updated:[]};
 const angular={extend:Object.assign,module(){return{factory(name,dep){if(name==='ComprehensiveFolders')factory=dep.at(-1);return this;},directive(){return this;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(app,'question/business/ComprehensiveFolders.js'),'utf8'),{angular});
 const rows=[{id:5,name:'Parent',canManage:true},{id:6,name:'Child',parentId:5,canManage:true},{id:7,name:'Read only',canManage:false}];
 const service={getTestFolders(all,mode){calls.load.push({all,mode});return load?load():Promise.resolve(rows);},moveTest(id,folder){calls.move.push({id,folder});return move?move(id,folder):Promise.resolve({id,testFolderId:folder,testFolder:folder==null?null:{id:folder}});}};
 const modal={open(config){dialog={};config.controller.at(-1).call(dialog,{$on(name,callback){closing=callback;}},{close:done.resolve,dismiss:done.reject});return{result:done.promise};}};
 const q={when:Promise.resolve.bind(Promise)},folders=factory(service,{$broadcast(){}},q,modal,{APP_VERSION:'test'});
 return{folders,calls,done,get dialog(){return dialog;},closeEvent(){let prevented=false;closing({preventDefault(){prevented=true;}});return prevented;}};
}
for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE','DAILY_LISTENING'])test(mode+' import defaults to the selected folder and uses only a metadata move',async()=>{
 const f=fixture(),test={id:42,title:'Imported',testFolderId:null,subQuestions:[{text:'Keep questions and answer data'}]},before=plain(test);
 const pending=f.folders.chooseImportedFolder([test],mode,6,saved=>f.calls.updated.push(saved));await settle();
 assert.equal(f.dialog.isImport,true);assert.equal(f.dialog.selectedFolderId,6);assert.deepEqual(f.calls.load,[{all:false,mode}]);assert.deepEqual(plain(f.dialog.choices.map(row=>row.id)),[5,6]);
 await f.dialog.save();const result=await pending;assert.equal(result.folderId,6);assert.equal(result.tests[0].id,42);assert.deepEqual(f.calls.move,[{id:42,folder:6}]);assert.deepEqual(test,before);assert.equal(f.calls.updated.length,1);
});
test('confirming the current folder or choosing later creates no duplicate save and never deletes the import',async()=>{
 const f=fixture(),pending=f.folders.chooseImportedFolder([{id:42,testFolderId:6}], 'READING',6);await settle();assert.equal(f.dialog.canMove(),true);await f.dialog.save();const same=await pending;assert.equal(same.folderId,6);assert.equal(same.tests[0].testFolder.id,6);assert.equal(f.calls.move.length,0);
 const g=fixture(),later=g.folders.chooseImportedFolder([{id:42,testFolderId:6}],'COMPREHENSIVE',6).catch(reason=>reason);await settle();g.dialog.cancel();assert.equal(await later,'cancel');assert.equal(g.calls.move.length,0);
});
test('load failures can retry; unknown or read-only destinations cannot submit',async()=>{
 let failed=true;const f=fixture({load:()=>failed?Promise.reject({}):Promise.resolve([{id:6,name:'Child',canManage:true}])});
 const pending=f.folders.chooseImportedFolder([{id:42,testFolderId:null}],'COMPREHENSIVE',6).catch(()=>{});await settle();assert.equal(f.dialog.canMove(),false);assert.match(f.dialog.error,/Bài đã import vẫn được giữ/);
 failed=false;await f.dialog.load();f.dialog.select(7);assert.equal(f.dialog.canMove(),false);f.dialog.save();assert.equal(f.calls.move.length,0);f.dialog.select(null);await f.dialog.save();await pending;assert.equal(f.calls.move.length,0);
});
test('batch retries move only failed imports and accept only matching test and folder acknowledgements',async()=>{
 let wrong=true;const f=fixture({move:(id,folder)=>Promise.resolve({id:wrong&&id===2?99:id,testFolderId:folder})});
 const pending=f.folders.chooseImportedFolder([{id:1},{id:2},{id:1}],'DAILY_LISTENING',6,saved=>f.calls.updated.push(saved));await settle();await f.dialog.save();
 assert.equal(f.dialog.failures.length,1);assert.equal(f.dialog.failures[0].id,2);assert.deepEqual(f.calls.updated.map(row=>row.id),[1]);assert.equal(f.dialog.canMove(),true);
 wrong=false;await f.dialog.save();const result=await pending;assert.deepEqual(f.calls.move.map(row=>row.id),[1,2,2]);assert.deepEqual(plain(result.tests.map(row=>row.id)),[1,2]);
});
test('an in-flight move prevents duplicate submissions, dismissal and destination changes',async()=>{
 const wait=deferred(),f=fixture({move:()=>wait.promise}),pending=f.folders.chooseImportedFolder([{id:42}],'READING',6);await settle();const save=f.dialog.save();await settle();
 assert.equal(f.dialog.saving,true);assert.equal(f.dialog.canMove(),false);assert.equal(f.closeEvent(),true);f.dialog.select(5);f.dialog.save();f.dialog.cancel();assert.equal(f.dialog.selectedFolderId,6);assert.equal(f.calls.move.length,1);
 wait.resolve({id:42,testFolderId:6});await save;assert.equal((await pending).folderId,6);
});
test('a response with the wrong or contradictory folder stays open and cannot update the editor',async()=>{
 for(const response of [{id:42,testFolderId:5},{id:42,testFolder:{id:6},testFolderId:5}]){
  const f=fixture({move:()=>Promise.resolve(response)}),pending=f.folders.chooseImportedFolder([{id:42}],'READING',6,saved=>f.calls.updated.push(saved)).catch(()=>{});
  await settle();await f.dialog.save();assert.equal(f.dialog.failures.length,1);assert.equal(f.calls.updated.length,0);assert.equal(f.dialog.canMove(),true);f.dialog.cancel();await pending;
 }
});
