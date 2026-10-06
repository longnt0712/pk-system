const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
function setup(builder) {
 const source=fs.readFileSync(path.join(__dirname,'../question/controllers/'+(builder?'IELTSCreateReadingTestController.js':'IELTSTestLibraryController.js')),'utf8');
 const requests=[],draftTopics=[{topic:{id:8}}];
 const vm={isComprehensiveMode:true,searchDto:{pageIndex:4,status:builder?9:7,textSearch:'Standalone'},ieltsReadingTest:{questionTopics:draftTopics},
  selectedTestTopics:[{id:8}],builderTopicSource:{id:26},builderTopicCategory:{id:6},
  selectedTopicSource:{id:26},selectedTopicCategory:{id:6},selectedTopic:{id:8},
  getPageCreateIELTSReadingTest(){requests.push(JSON.parse(JSON.stringify(vm.searchDto)));},loadTests(){requests.push(JSON.parse(JSON.stringify(vm.searchDto)));}};
 const mode=builder?'catalogTopicFilterMode':'topicFilterMode',method=builder?'applyCatalogTopicFilter':'applyTopicFilter';
 const initial=source.match(new RegExp('vm\\.'+mode+" = '[^']+';"))[0];
 const start=source.indexOf('vm.'+method+' = function'),end=source.indexOf('\n        };',start)+11;
 nodeVm.runInNewContext(initial+'\n'+source.slice(start,end),{vm});
 return {vm,requests,mode,method,draftTopics};
}
for(const builder of [true,false]) {
 const screen=builder?'builder':'library';
 test(screen+' initially finds unassigned tests without applying the default source/category',()=>{
  const h=setup(builder);h.vm[h.method]();const dto=h.requests[0];
  assert.equal(h.vm[h.mode],'ALL');assert.equal(dto.topicOwnerUserId,null);assert.equal(dto.topicCategoryId,null);assert.equal(dto.topicId,null);
  assert.deepEqual(dto.questionTopics,[]);assert.equal(dto.withoutTopics,false);assert.equal(dto.pageIndex,1);assert.equal(dto.textSearch,'Standalone');
  assert.strictEqual(h.vm.ieltsReadingTest.questionTopics,h.draftTopics);
 });
 test(screen+' supports explicit topic and unassigned searches while preserving title/status filters',()=>{
  const h=setup(builder);h.vm[h.mode]='TOPIC';h.vm[h.method]();let dto=h.requests.at(-1);
  assert.equal(dto.topicOwnerUserId,26);assert.equal(dto.topicCategoryId,6);
  if(builder)assert.deepEqual(dto.questionTopics,[{topic:{id:8}}]);else assert.equal(dto.topicId,8);
  h.vm[h.mode]='UNASSIGNED';h.vm[h.method]();dto=h.requests.at(-1);
  assert.equal(dto.withoutTopics,true);assert.equal(dto.topicOwnerUserId,null);assert.equal(dto.topicCategoryId,null);assert.equal(dto.topicId,null);
  assert.deepEqual(dto.questionTopics,[]);assert.equal(dto.textSearch,'Standalone');assert.equal(dto.status,builder?9:7);
 });
}
