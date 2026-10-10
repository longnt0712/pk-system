const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), nodeVm=require('node:vm');
function setup() {
 const definitions={}, broadcasts=[];
 const angular={extend:Object.assign,module(){return {factory(name,definition){definitions[name]=definition;return this;},directive(){return this;}};}};
 nodeVm.runInNewContext(fs.readFileSync(path.join(__dirname,'../question/business/ComprehensiveFolders.js'),'utf8'),{angular});
 const items=[{id:2,name:'Week 1',parentId:1,ownerId:7,ownerName:'Teacher A'},
  {id:1,name:'Listening',parentId:null,ownerId:7,ownerName:'Teacher A'},
  {id:3,name:'Listening',parentId:null,ownerId:8,ownerName:'Teacher B'},
  {id:4,name:'Orphan',parentId:99,ownerId:7,ownerName:'Teacher A'},
  {id:5,name:'Cycle',parentId:5,ownerId:7,ownerName:'Teacher A'}];
 const folders=definitions.ComprehensiveFolders.at(-1)({getTestFolders(){return Promise.resolve(items);},saveTestFolder(dto){return Promise.resolve({...dto,id:20});}},
  {$broadcast(name){broadcasts.push(name);}},{when:Promise.resolve.bind(Promise)});
 return {folders,items,broadcasts,definitions};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('picker shows owned paths, teacher names in shared library, and safely handles orphan/cycle data',()=>{
 const {folders,items}=setup();
 const original=items.map(item=>item.id);
 const own=folders.options(items,false), all=folders.options(items,true);
 assert.equal(own.find(item=>item.id===2).label,'Listening / Week 1');
 assert.equal(all.find(item=>item.id===2).label,'Teacher A / Listening / Week 1');
 assert.equal(all.length,5); assert.deepEqual(items.map(item=>item.id),original);
});
test('Explorer loads direct folder contents and unfiled root; search includes descendants',()=>{
 const {folders}=setup(), dto={textSearch:'',status:7,questionTopics:[{topic:{id:8}}],topicId:8,pageIndex:4};
 folders.applyFilter(dto,null,true);
 assert.equal(dto.withoutTestFolder,true); assert.equal(dto.includeSubfolders,false);
 folders.applyFilter(dto,1,true);
 assert.equal(dto.testFolderId,1); assert.equal(dto.withoutTestFolder,false); assert.equal(dto.includeSubfolders,false);
 dto.textSearch='lesson'; folders.applyFilter(dto,1,true); assert.equal(dto.includeSubfolders,true);
 folders.applyFilter(dto,null,true); assert.equal(dto.withoutTestFolder,false);
 assert.equal(dto.status,7); assert.equal(dto.pageIndex,1); assert.equal(dto.topicId,null); assert.deepEqual(plain(dto.questionTopics),[]);
});
test('assignment filtering includes nested folders and recognizes unfiled tests',async()=>{
 const {folders}=setup(); await folders.load(true);
 assert.equal(folders.contains(2,1),true); assert.equal(folders.contains(3,1),false);
 assert.equal(folders.contains(null,-1),true); assert.equal(folders.contains(2,-1),false);
 assert.equal(folders.contains(5,1),false); assert.equal(folders.contains(2,null),true);
});
for (const builder of [true,false]) test((builder?'builder':'library')+' folder navigation keeps title/status filters without changing unsaved test assignment',()=>{
 const {folders}=setup();
 const filename=builder?'IELTSCreateReadingTestController.js':'IELTSTestLibraryController.js';
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/'+filename),'utf8');
 const method=builder?'applyCatalogFolderFilter':'applyFolderFilter';
 const start=source.indexOf('vm.'+method+' = function'), end=source.indexOf('\n        };',start)+11;
 assert.ok(start>=0 && end>start);
 const requests=[], vm={searchDto:{textSearch:'Lesson',status:builder?9:7},catalogTestFolderId:2,selectedTestFolderId:2,
  ieltsReadingTest:{testFolderId:8},getPageCreateIELTSReadingTest(){requests.push(plain(vm.searchDto));},loadTests(){requests.push(plain(vm.searchDto));}};
 nodeVm.runInNewContext(source.slice(start,end),{vm,folders}); vm[method]();
 assert.equal(requests[0].testFolderId,2); assert.equal(requests[0].textSearch,'Lesson'); assert.equal(requests[0].includeSubfolders,true);
 assert.equal(vm.ieltsReadingTest.testFolderId,8);
});
test('folder edits invalidate cached pickers and notify all visible folder views',async()=>{
 const {folders,broadcasts}=setup(); await folders.load(false); await folders.save({name:'Week 2',parentId:1});
 assert.deepEqual(broadcasts,['comprehensiveFoldersChanged']);
});
test('moving a test sends only its id and destination folder, including root',async()=>{
 const {definitions}=setup(), requests=[];
 const api=definitions.TestFolderService.at(-1)({post(url,dto){requests.push({url,dto:plain(dto)});return Promise.resolve({data:{id:dto.testId}});}},
  {api:{baseUrl:'/service/',apiV1Url:'api/'}});
 assert.equal((await api.moveTest(20,2)).id,20); await api.moveTest(20,null);
 assert.deepEqual(requests,[{url:'/service/api/test_folder/move_test',dto:{testId:20,folderId:2}},
  {url:'/service/api/test_folder/move_test',dto:{testId:20,folderId:null}}]);
});
test('successful move updates the open editor folder without replacing unsaved content',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSCreateReadingTestController.js'),'utf8');
 const start=source.indexOf('vm.catalogTestMoved = function'), end=source.indexOf('\n        };',start)+11;
 assert.ok(start>=0 && end>start);
 const questions=[{question:'Unsaved question'}], vm={ieltsReadingTest:{id:20,title:'Unsaved title',subQuestions:questions},
  searchDto:{pageIndex:3},getPageCreateIELTSReadingTest(){this.reloaded=true;}};
 nodeVm.runInNewContext(source.slice(start,end),{vm,angular:{copy:structuredClone}});
 vm.catalogTestMoved({id:20,testFolder:{id:2,name:'Week 1'}});
 assert.equal(vm.selectedTestFolderId,2); assert.equal(vm.ieltsReadingTest.testFolderId,2);
 assert.equal(vm.ieltsReadingTest.title,'Unsaved title'); assert.strictEqual(vm.ieltsReadingTest.subQuestions,questions);
 assert.equal(vm.searchDto.pageIndex,3); assert.equal(vm.reloaded,undefined);
 vm.catalogTestMoved({id:20,testFolder:null}); assert.equal(vm.selectedTestFolderId,null);
});
test('moves update only the affected catalog row, respect folder/search filters, and never reload the list',async()=>{
 const {folders}=setup();await folders.load(false);
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSCreateReadingTestController.js'),'utf8');
 const start=source.indexOf('vm.catalogTestMoved = function'),end=source.indexOf('\n        };',start)+11;
 for(const scenario of [
  {filter:{withoutTestFolder:true},target:1,visible:false},
  {filter:{testFolderId:1,includeSubfolders:false},target:2,visible:false},
  {filter:{testFolderId:1,includeSubfolders:true,textSearch:'Lesson'},target:2,visible:true},
  {filter:{testFolderId:1,includeSubfolders:true,textSearch:'Lesson'},target:3,visible:false},
  {filter:{testFolderId:1,includeSubfolders:true,textSearch:'Lesson'},target:null,visible:false},
  {filter:{testFolderId:null,withoutTestFolder:false,textSearch:'Lesson'},target:2,visible:true},
  {filter:{testFolderId:null,withoutTestFolder:false,textSearch:'Lesson'},target:null,visible:true}
 ]){
  const moved={id:20,title:'Lesson',learningDraft:{answer:'Keep'},testFolder:{id:1}},other={id:21,title:'Other'};
  const rows=[moved,other],vm={searchDto:{pageIndex:3,pageSize:2,...scenario.filter},ieltsReadingTests:rows,
   bsTableControlCreateIELTSReadingTest:{options:{data:rows,totalRows:6}},getPageCreateIELTSReadingTest(){throw new Error('Unexpected list fetch');}};
  nodeVm.runInNewContext(source.slice(start,end),{vm,folders,angular:{copy:structuredClone}});
  const saved={id:20,title:'Server response must not replace the row',testFolder:scenario.target==null?null:{id:scenario.target}};
  vm.catalogTestMoved(saved);
  assert.strictEqual(vm.ieltsReadingTests,rows);assert.strictEqual(rows.at(-1),other);assert.equal(vm.searchDto.pageIndex,3);
  assert.equal(rows.includes(moved),scenario.visible);assert.equal(vm.bsTableControlCreateIELTSReadingTest.options.totalRows,scenario.visible?6:5);
  if(scenario.visible){assert.equal(moved.testFolderId,scenario.target);assert.equal(moved.title,'Lesson');assert.equal(moved.learningDraft.answer,'Keep');}
  vm.catalogTestMoved(saved);assert.equal(vm.bsTableControlCreateIELTSReadingTest.options.totalRows,scenario.visible?6:5);
 }
});
test('moving from a full page fetches just one replacement row and discards responses after navigation',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSCreateReadingTestController.js'),'utf8');
 const start=source.indexOf('vm.catalogTestMoved = function'),end=source.indexOf('\n        };',start)+11;
 for(const navigate of [false,true]){
  const rows=[{id:20,testFolder:null},{id:21,title:'Keep this row'}],requests=[];
  const vm={ieltsReadingTests:rows,searchDto:{pageIndex:2,pageSize:2,withoutTestFolder:true},
   bsTableControlCreateIELTSReadingTest:{options:{data:rows,totalRows:5}},getPageCreateIELTSReadingTest(){throw new Error('Unexpected reload');}};
  const service={getPageForTests(dto,index,size){return new Promise(resolve=>requests.push({dto:plain(dto),index,size,resolve}));}};
  nodeVm.runInNewContext(source.slice(start,end),{vm,service,angular:{copy:structuredClone,noop(){}}});
  vm.catalogTestMoved({id:20,testFolder:{id:1}});
  assert.equal(requests.length,1);assert.equal(requests[0].index,4);assert.equal(requests[0].size,1);
  assert.equal(requests[0].dto.withoutTestFolder,true);assert.equal(vm.searchDto.pageIndex,2);
  assert.strictEqual(rows[0].id,21);assert.equal(vm.catalogLoading,undefined);
  if(navigate)vm.ieltsReadingTests=[{id:50,title:'New folder'}];
  requests[0].resolve({content:[{id:22,title:'Next row'}]});await Promise.resolve();
  assert.deepEqual(vm.ieltsReadingTests.map(row=>row.id),navigate?[50]:[21,22]);assert.equal(requests.length,1);
 }
});
test('full test saves wait until a folder move completes to avoid reverting its destination',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/IELTSCreateReadingTestController.js'),'utf8');
 const start=source.indexOf('vm.saveReadingTest = function'),end=source.indexOf('\n        };',start)+11;
 assert.ok(start>=0 && end>start);
 const vm={catalogMovePending:true},messages=[];
 nodeVm.runInNewContext(source.slice(start,end),{vm,angular:{noop(){}},$timeout(callback){callback();return Promise.resolve();},
  toastr:{warning(message){messages.push(message);}}});
 await vm.saveReadingTest('DRAFT');assert.equal(messages.length,1);assert.match(messages[0],/Đang chuyển bài/);
 assert.equal(vm.savingReadingTest,undefined);
});
