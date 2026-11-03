const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../test_result/controllers/TestResultController.js'),'utf8');
const code=source.slice(source.indexOf('        vm.deletingResultIds ='),source.indexOf('        vm.enterSearchCode ='));
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const rows=[{id:1,canDelete:true},{id:2,canDelete:true}],events=[],deletion=deferred(),check=deferred();
 const vm={testResults:structuredClone(rows),resultTotalRows:2,selectedTestResults:[rows[1]],searchDto:{pageIndex:1,pageSize:15,resultGroup:'WRITING'},canUseResultDeletion:()=>true,getPage(){events.push('reload');},bsTableControl:{options:{data:rows,totalRows:2},state:{pageNumber:1}}};
 const scope={},service={deleteObject(){return deletion.promise;},deleteObjects(){return deletion.promise;},getPage(search){events.push({check:structuredClone(search)});return check.promise;}};
 const table={bootstrapTable(method,payload){events.push({method,payload});if(method==='getScrollPosition')return 123;}};
 const context=nodeVm.createContext({vm,$scope:scope,service,$timeout:fn=>fn(),modal:{open:()=>({result:Promise.resolve('yes')})},toastr:{info(){},success(){},error(){events.push('error');},warning(){events.push('warning');}},document:{getElementById:()=>({})},angular:{copy:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),element:()=>table},resultPageRequest:0,utils:{}});
 nodeVm.runInContext(code,context);return{vm,scope,events,deletion,check,context};
}
test('delete waits for true acknowledgement and shows only that row as busy',async()=>{
 const f=fixture(),original=f.vm.bsTableControl.options.data;f.scope.deleteObject('1');await settle();
 assert.equal(f.vm.deletingResultIds[1],true);assert.equal(f.vm.deletingResultIds[2],undefined);assert.equal(f.vm.testResults.length,2);
 f.deletion.resolve(true);await settle();assert.deepEqual(Array.from(f.vm.testResults,r=>r.id),[2]);assert.equal(f.vm.bsTableControl.options.data,original);
 f.check.resolve({content:[{id:2,canDelete:true}],totalElements:1});await settle();
 assert.equal(f.vm.bsTableControl.options.data,original,'unchanged remainder never destroys the table');assert.equal(f.events.filter(e=>e==='reload').length,0);
 assert.equal(f.events.filter(e=>e.check).length,1);assert.equal(f.vm.selectedTestResults.length,1);assert.equal(f.vm.bsTableControl.state.pageNumber,1);
});
test('failed or unconfirmed deletion preserves rows and performs no page query',async()=>{
 for(const failed of [false,true]){const f=fixture();f.scope.deleteObject(1);await settle();if(failed)f.deletion.reject(new Error('offline'));else f.deletion.resolve(false);await settle();assert.equal(f.vm.testResults.length,2);assert.equal(f.events.filter(e=>e.check).length,0);assert.equal(f.vm.isDeletingResults,false);}
});
test('a changed row or next-page refill updates the table once and keeps scroll/filter',async()=>{
 const f=fixture();f.scope.deleteObject(1);await settle();f.deletion.resolve(true);await settle();
 f.check.resolve({content:[{id:2,canDelete:true,band:'7'},{id:3,canDelete:true}],totalElements:2});await settle();
 assert.deepEqual(Array.from(f.vm.bsTableControl.options.data,r=>r.id),[2,3]);assert.equal(f.vm.bsTableControl.state.scroll,123);assert.equal(f.vm.searchDto.resultGroup,'WRITING');
});
test('late reconciliation cannot replace a newer filter result',async()=>{
 const f=fixture();f.scope.deleteObject(1);await settle();f.deletion.resolve(true);await settle();f.vm.searchDto.resultGroup='IELTS';f.vm.testResults=[{id:10}];
 f.check.resolve({content:[{id:2}],totalElements:1});await settle();assert.equal(f.vm.testResults[0].id,10);
});
test('deleting the last page moves back only when that page no longer exists',async()=>{
 const f=fixture();f.vm.searchDto.pageIndex=2;f.scope.deleteObject(1);await settle();f.deletion.resolve(true);await settle();f.check.resolve({content:[],totalElements:1});await settle();assert.equal(f.vm.searchDto.pageIndex,1);assert.equal(f.events.filter(e=>e==='reload').length,1);
});
