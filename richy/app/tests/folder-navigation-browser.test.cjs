const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),nodeVm=require('node:vm');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read=file=>fs.readFileSync(path.join(app,file),'utf8');
const states={};
nodeVm.runInNewContext(read('question/question.module.js'),{Hrm:{},window:{APP_VERSION:'test'},angular:{module(){return {
 filter(){return this;},config(definition){definition.at(-1)({state(name,state){states[name]=state;return this;}});}
};}}});
const modes=['READING','LISTENING','WRITING','COMPREHENSIVE','DAILY_LISTENING'];
function routeName(mode,creator){return 'application.'+(creator?'create_':'')+(mode==='COMPREHENSIVE'?'comprehensive':mode==='DAILY_LISTENING'?'daily_listening':'ielts_'+mode.toLowerCase())+(creator?'_test':'_tests');}
function section(source,start,end){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,start);return source.slice(from,to);}
const builder=read('question/controllers/IELTSCreateReadingTestController.js');
const builderCode=section(builder,'        vm.applyCatalogFolderFilter =','        vm.ieltsReadingTest =')+
 section(builder,'        var testCatalogRequestId =','        vm.showHiddenTests = false;');
const builderTemplate=section(read('question/views/create_ielts_reading_test.html'),'<test-folder-explorer files="vm.ieltsReadingTests"','</test-folder-explorer>')+'</test-folder-explorer>';

async function fixture(browser,mode,creator,folder){
 const name=routeName(mode,creator),state=states[name],routePath=state.url.split('?')[0];
 const page=await browser.newPage({viewport:{width:creator?1366:390,height:950}}),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/test_folder_explorer.html'))return route.fulfill({contentType:'text/html',body:read('question/views/test_folder_explorer.html')});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
 });
 await page.goto('http://folder-navigation.test'+routePath+(folder!==undefined?'?folder='+folder:''));
 async function mount(){
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+read('assets/css/external/bootstrap.min.css')+
   read('assets/css/comprehensive-folders.css')+read('assets/css/ielts-test-library.css')+'</style></head><body><main id="qa"><div ui-view></div></main></body></html>');
  for(const script of ['angular.min.js','angular-ui-router.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external/'+script)});
  await page.evaluate(({mode,creator})=>{
   window.App={initAjax(){}};window.requests=[];
   const folders=[{id:1,name:'Parent folder',parentId:null},{id:2,name:'Child folder',parentId:1},{id:3,name:'Other folder',parentId:null}]
    .map(folder=>({...folder,testMode:mode,ownerId:7,ownerName:'Teacher',canManage:true}));
   window.folderData=folders;
   const rows=[{id:11,title:'Root lesson',testFolder:null},{id:12,title:'Parent lesson',testFolder:folders[0]},
    {id:13,title:'Child lesson',testFolder:folders[1]}].map(row=>({...row,status:7,userId:7}));
   const module=angular.module('Hrm.Question',['ui.router','ui.bootstrap']);
   module.value('settings',{}).value('$cookies',{get(){return '{"id":7,"roles":[{"name":"ROLE_ADMIN"}]}';}})
    .value('blockUI',{start(){},stop(){}}).value('toastr',{success(){},error(){},warning(){}})
    .value('TestWordExport',{open(){throw new Error('Unexpected export in folder test');}})
    .value('ComprehensiveListening',{transcriptText:value=>value||''})
    .run(['$rootScope',root=>{root.settings={layout:{}};}])
    .factory('TestFolderService',['$q',q=>({getTestFolders(){return q.when(folders);}})])
    .factory('QuestionService',['$q',q=>{
     function getPage(dto){
      window.requests.push(angular.copy(dto));
      const content=rows.filter(row=>(!dto.withoutTestFolder||!row.testFolder)&&(!dto.testFolderId||row.testFolder?.id===dto.testFolderId));
      return q.when({content:angular.copy(content),totalElements:content.length});
     }
     return {getPageForTests:getPage,getDailyListeningTests:getPage,getLearningDrafts(){return q.when([]);}};
    }]);
  },{mode,creator});
  await page.addScriptTag({path:path.join(app,'question/business/ComprehensiveFolders.js')});
  if(!creator)await page.addScriptTag({path:path.join(app,'question/controllers/IELTSTestLibraryController.js')});
  else if(mode==='DAILY_LISTENING')await page.addScriptTag({path:path.join(app,'question/controllers/DailyListeningTestController.js')});
  await page.evaluate(({mode,creator,name,url,reloadOnSearch,template,builderCode})=>{
   const module=angular.module('Hrm.Question');
   module.factory('TestFolderService',['$q',q=>({getTestFolders(){return q.when(window.folderData);}})]);
   if(creator&&mode!=='DAILY_LISTENING')module.controller('CatalogController',[
    'ComprehensiveFolders','QuestionService','$scope','$location','$uibModal','$window','blockUI','toastr',
    function(folders,service,$scope,$location,modal,$window,blockUI,toastr){
     const vm=this;Object.assign(vm,{isComprehensiveMode:mode==='COMPREHENSIVE',isWritingMode:mode==='WRITING',isListeningMode:mode==='LISTENING',
      folderTestMode:mode,isFlexibleMode:mode==='COMPREHENSIVE'||mode==='WRITING',currentUser:{id:7},searchDto:{pageIndex:1,pageSize:10,status:9},
      catalogTestFolderId:null,selectedTestFolderId:3,ieltsReadingTests:[],bsTableControlCreateIELTSReadingTest:{options:{}},refreshLearningProgress(){},
      ieltsReadingTest:{title:'Unsaved title',subQuestions:[{question:'Unsaved question'}],testFolderId:3}});
     new Function('vm','folders','service','blockUI','toastr','modal','$window','$scope','$location',builderCode)(vm,folders,service,blockUI,toastr,modal,$window,$scope,$location);
     vm.getPageCreateIELTSReadingTest();
    }]);
   module.config(['$stateProvider','$locationProvider',function(provider,location){
    location.html5Mode({enabled:true,requireBase:false});
    provider.state('application',{abstract:true,template:'<div ui-view></div>'});
    provider.state(name,{url,reloadOnSearch,template,controller:(creator?(mode==='DAILY_LISTENING'?'DailyListeningTestController':'CatalogController'):'IELTSTestLibraryController')+' as vm'});
    provider.state('outside',{url:'/outside',template:'<p id="outside">Outside library</p>'});
   }]);
   angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);
  },{mode,creator,name,url:state.url,reloadOnSearch:state.reloadOnSearch,
   template:creator?(mode==='DAILY_LISTENING'?read('question/views/create_daily_listening_test.html'):builderTemplate):read('question/views/ielts_test_library.html'),builderCode});
  await page.locator('.test-folder-explorer').waitFor().catch(error=>{throw new Error(error.message+'\nBrowser errors: '+errors.join('\n'));});
  await page.waitForFunction(()=>window.requests.length>0);
  await page.evaluate(()=>{window.qaVm=angular.element(document.querySelector('test-folder-explorer')).isolateScope().$parent.vm;window.originalVm=qaVm;});
 }
 await mount();return {page,errors,mount,routePath};
}

for(const mode of modes)for(const creator of [false,true])test(mode+' '+(creator?'creator':'library')+' follows folder URLs, browser history and reloads without recreating the editor',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{
  const {page,errors,mount,routePath}=await fixture(browser,mode,creator);
  async function at(folder){
   await page.waitForFunction(({folder,creator})=>window.requests.at(-1).testFolderId===folder&&
    (creator?qaVm.catalogTestFolderId:qaVm.selectedTestFolderId)===folder,{folder,creator});
   assert.equal(new URL(page.url()).pathname,routePath);
   assert.equal(new URL(page.url()).searchParams.get('folder'),folder===null?null:String(folder));
  }
  await at(null);
  if(creator&&mode==='DAILY_LISTENING')await page.evaluate(()=>{qaVm.draft.question='Unsaved title';qaVm.transcript='Unsaved transcript';qaVm.draft.testFolderId=3;});
  await page.getByRole('button',{name:'Parent folder',exact:false}).first().click();await at(1);
  await page.getByRole('button',{name:'Child folder',exact:false}).first().click();await at(2);
  await page.goBack();await at(1);await page.goBack();await at(null);
  await page.goForward();await at(1);await page.goForward();await at(2);
  assert.equal(await page.evaluate(()=>qaVm===originalVm),true);
  if(creator)assert.deepEqual(await page.evaluate(()=>qaVm.draft?{title:qaVm.draft.question,content:qaVm.transcript,folder:qaVm.draft.testFolderId}:
   {title:qaVm.ieltsReadingTest.title,content:qaVm.ieltsReadingTest.subQuestions[0].question,folder:qaVm.selectedTestFolderId}),
   {title:'Unsaved title',content:mode==='DAILY_LISTENING'?'Unsaved transcript':'Unsaved question',folder:3});
  const length=await page.evaluate(()=>history.length);
  await page.locator('.test-explorer-path').getByRole('button',{name:'Child folder',exact:true}).click();await at(2);
  assert.equal(await page.evaluate(()=>history.length),length,'clicking the current folder adds no history entry');
  await page.locator('.test-explorer-path button').first().click();await at(null);
  await page.goBack();await at(2);
  await page.getByRole('button',{name:'Lên folder cha'}).click();await at(1);
  await page.goBack();await at(2);
  await page.reload();await mount();await at(2);
  assert.equal(await page.evaluate(()=>requests[0].testFolderId),2,'reload starts directly in the URL folder');
  assert.match(await page.locator('.test-explorer-path').innerText(),/Parent folder.*Child folder/s);
  assert.ok(await page.getByText('Child lesson',{exact:true}).count());
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('an invalid folder URL opens root and folder changes retain unrelated query parameters',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{
  const {page,errors}=await fixture(browser,'READING',false,'invalid');
  assert.equal(await page.evaluate(()=>requests[0].testFolderId),null);
  await page.evaluate(()=>angular.element(document.getElementById('qa')).injector().get('$rootScope').$apply(()=>
   angular.element(document.getElementById('qa')).injector().get('$location').search('keep','yes')));
  await page.getByRole('button',{name:'Parent folder',exact:false}).first().click();
  await page.waitForURL('**folder=1**');assert.equal(new URL(page.url()).searchParams.get('keep'),'yes');
  await page.evaluate(()=>angular.element(document.getElementById('qa')).injector().get('$rootScope').$apply(()=>
   angular.element(document.getElementById('qa')).injector().get('$location').path('/outside').search({})));
  await page.locator('#outside').waitFor();await page.goBack();
  await page.locator('.test-explorer-path').getByRole('button',{name:'Parent folder',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>requests.at(-1).testFolderId),1,'returning to the catalog restores its folder');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
