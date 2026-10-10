const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'), repo=path.resolve(app,'../..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const libraryHtml=fs.readFileSync(path.join(app,'question/views/ielts_test_library.html'),'utf8');
const builderHtml=fs.readFileSync(path.join(app,'question/views/create_ielts_reading_test.html'),'utf8');
const builderSource=fs.readFileSync(path.join(app,'question/controllers/IELTSCreateReadingTestController.js'),'utf8');
function section(source,start,end) {const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0 && to>from,start);return source.slice(from,to);}
const teacherHtml=section(builderHtml,'<test-folder-explorer ng-if="vm.isComprehensiveMode"','</test-folder-explorer>')+'</test-folder-explorer>'+
 '<h3>Lưu bài vào folder</h3><test-folder-picker folder-id="vm.selectedTestFolderId" manage="true"></test-folder-picker>';
const teacherCode=section(builderSource,'        vm.applyCatalogFolderFilter =','        vm.ieltsReadingTest =')+
 section(builderSource,'        var testCatalogRequestId =','        vm.searchDto.pageSize = 12;');
const css=['assets/css/external/bootstrap.min.css','assets/css/ielts-test-library.css','assets/css/external/font-awesome.min.css','assets/css/comprehensive-folders.css'].map(file=>fs.readFileSync(path.join(app,file),'utf8')).join('\n');

async function fixture(browser,width,teacher) {
 const page=await browser.newPage({viewport:{width,height:900}}), errors=[];
 page.setDefaultTimeout(10000); page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/test_folder_explorer.html')) return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(app,'question/views/test_folder_explorer.html'),'utf8')});
  if(/fontawesome-webfont\.(woff2?|ttf|eot)/.test(url.pathname)) return route.fulfill({body:fs.readFileSync(path.join(app,'assets/fonts/'+url.pathname.split('/').pop()))});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
 });
 await page.goto('http://folders.test');
 async function mount() {
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+css+
   'body{padding:20px;}main{max-width:1120px;margin:auto;}*{box-sizing:border-box;}@media(max-width:600px){body{padding:10px;}}</style></head><body><main id="qa" ng-controller="'+(teacher?'Qa':'IELTSTestLibraryController')+' as vm">'+(teacher?teacherHtml:libraryHtml)+'</main></body></html>');
  await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
  await page.evaluate(()=>{
   window.App={initAjax(){}};
   angular.module('Hrm.Question',[]).value('settings',{}).value('$cookies',{get(){return '{"id":7}';}})
    .value('$location',{path(){return '/comprehensive_tests';}}).value('blockUI',{start(){},stop(){}})
    .run(['$rootScope',function(root){root.settings={layout:{}};}])
    .factory('QuestionService',['$q',function(q){
     window.folderData=[{id:1,name:'Listening',parentId:null,ownerId:7,ownerName:'Teacher A',canManage:true},
      {id:2,name:'Week 1',parentId:1,ownerId:7,ownerName:'Teacher A',canManage:true},
      {id:3,name:'Reading',parentId:null,ownerId:8,ownerName:'Teacher B',canManage:false}];
     window.testData=[{id:11,title:'Bài cũ chưa vào folder',testFolder:null,userId:7,status:7},
      {id:12,title:'Daily Listening cơ bản',testFolder:window.folderData[0],userId:7,status:7},
      {id:13,title:'Bài luyện nghe tuần 1',testFolder:window.folderData[1],userId:7,status:6},
      {id:14,title:'Reading của giáo viên B',testFolder:window.folderData[2],userId:8,status:7}];
     // The student fixture needs a published child test too.
     window.testData[2].status=7;
     window.testRequests=[];
     return {
      getLearningDrafts(){return q.when([]);},
      getTestFolders(all){return window.failFolders?q.reject({status:500}):q.when(window.folderData.filter(folder=>all || folder.ownerId===7));},
      saveTestFolder(dto){
       if(window.failSave)return q.reject({data:{message:'Đã có folder cùng tên.'}});
       let folder=window.folderData.find(item=>item.id===dto.id);
       if(folder)Object.assign(folder,dto);else{folder={...dto,id:10+window.folderData.length,ownerId:7,ownerName:'Teacher A',canManage:true};window.folderData.push(folder);}
       return q.when({...folder});
      },
      getPageForTests(dto,index,size){
       window.testRequests.push({...dto});
       const folders=new Map(window.folderData.map(folder=>[folder.id,folder]));
       function inside(id){if(!dto.testFolderId)return true;while(id){if(id===dto.testFolderId)return true;if(!dto.includeSubfolders)return false;id=folders.get(id)?.parentId;}return false;}
       const items=window.testData.filter(item=>(!dto.userId || dto.userId===item.userId) && (!dto.withoutTestFolder || !item.testFolder) && inside(item.testFolder?.id) &&
        (!dto.textSearch || item.title.toLowerCase().includes(dto.textSearch.toLowerCase())));
       return q.when({content:items.slice((index-1)*size,index*size),totalElements:items.length});
      }
     };
    }]);
  });
  await page.addScriptTag({path:path.join(app,'question/business/ComprehensiveFolders.js')});
  if(!teacher)await page.addScriptTag({path:path.join(app,'question/controllers/IELTSTestLibraryController.js')});
  await page.evaluate(({teacher,teacherCode})=>{
   angular.module('Hrm.Question').factory('TestFolderService',['QuestionService',function(service){return service;}]);
   if(teacher)angular.module('Hrm.Question').controller('Qa',['ComprehensiveFolders','QuestionService','$scope',function(folders,service,scope){
    const vm=this;Object.assign(vm,{isComprehensiveMode:true,isFlexibleMode:true,currentUser:{id:7},searchDto:{pageIndex:1,pageSize:12,status:9},
     catalogTestFolderId:null,selectedTestFolderId:null,ieltsReadingTests:[],bsTableControlCreateIELTSReadingTest:{options:{}},refreshLearningProgress(){}});
    scope.editCreateIELTSReadingTest=id=>window.lastEdit=id;
    scope.hideReadingTest=id=>window.lastHide=id;scope.restoreReadingTest=id=>window.lastRestore=id;
    new Function('vm','folders','service','blockUI','toastr',teacherCode)(vm,folders,service,{start(){},stop(){}},{error(){}});
    vm.getPageCreateIELTSReadingTest();window.qaVm=vm;
   }]);
   angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);
   if(!teacher)window.qaVm=angular.element(document.getElementById('qa')).scope().vm;
  },{teacher,teacherCode});
  await page.locator('.test-explorer-folder').first().waitFor();
 }
 await mount();return {page,errors,mount};
}

test('real folder views support grid/list, breadcrumbs, direct contents, nested search, ownership and mobile layout',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try {for(const width of [1366,390])for(const teacher of [true,false]){
  const {page,errors,mount}=await fixture(browser,width,teacher);
  assert.equal(await page.locator('.test-explorer-folder').count(),teacher?1:2);
  assert.equal(await page.locator('.test-explorer-file').count(),1);
  const screen=teacher?'teacher':'library';
  await page.screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-grid-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
  await page.locator('.test-folder-explorer.is-list').waitFor();
  await page.screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-list-'+width+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>localStorage.getItem('comprehensiveTestFolderView')),'list');
  await page.reload();await mount();await page.locator('.test-folder-explorer.is-list').waitFor();
  await page.getByRole('button',{name:/^Listening/}).click();
  assert.equal(await page.locator('.test-explorer-folder').count(),1);
  assert.equal(await page.locator('.test-explorer-file').count(),1);
  assert.match(await page.locator('.test-explorer-file').innerText(),/Daily Listening/);
  await page.getByRole('button',{name:/^Week 1/}).click();
  assert.equal(await page.locator('.test-explorer-folder').count(),0);
  assert.match(await page.locator('.test-explorer-file').innerText(),/tuần 1/);
  await page.getByRole('button',{name:'Lên folder cha',exact:true}).click();
  assert.equal(await page.locator('.test-explorer-folder').count(),1);
  if(!teacher){
   await page.getByRole('searchbox',{name:'Tìm bài test theo tên'}).fill('tuần');await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
   assert.match(await page.locator('.test-explorer-file').innerText(),/tuần 1/);
   const link=await page.locator('.test-explorer-file-main').getAttribute('href');assert.match(link,/comprehensive_test\/13\?sessionMode=STUDY/);
  }else{
   await page.getByRole('button',{name:'Tạo folder con',exact:true}).click();
   await page.locator('.test-folder-explorer').getByRole('textbox',{name:'Tên folder',exact:true}).fill('Week 2');
   await page.locator('.test-folder-explorer').getByRole('button',{name:'Lưu folder',exact:true}).click();
   await page.getByRole('button',{name:'Week 2',exact:true}).waitFor();
   const select=page.getByRole('combobox',{name:'Chọn folder'});
   assert.equal(await select.locator('option').filter({hasText:'Teacher B'}).count(),0);
   await select.selectOption({label:'Listening / Week 2'});
   assert.ok(await page.evaluate(()=>window.qaVm.selectedTestFolderId>0));
   await page.getByRole('button',{name:'Week 2',exact:true}).click();
   await page.locator('.test-folder-explorer').getByRole('button',{name:'Đổi tên folder',exact:true}).click();
   await page.locator('.test-folder-explorer').getByRole('textbox',{name:'Tên folder',exact:true}).fill('Week 2 renamed');
   await page.evaluate(()=>window.failSave=true);
   await page.locator('.test-folder-explorer').getByRole('button',{name:'Lưu folder',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Đã có folder cùng tên.'}).waitFor();
   assert.equal(await page.locator('.test-folder-explorer').getByRole('textbox',{name:'Tên folder'}).inputValue(),'Week 2 renamed');
   await page.evaluate(()=>window.failSave=false);
   await page.locator('.test-folder-explorer').getByRole('button',{name:'Lưu folder',exact:true}).click();
   await page.locator('.test-explorer-path').getByRole('button',{name:'Week 2 renamed',exact:true}).waitFor();
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('folder picker works on a fresh class page without loading QuestionService first',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome}), calls=[];
 const apiFolders=[{id:1,name:'Practice',ownerId:7,ownerName:'Teacher',parentId:null,canManage:true}];
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/test_folder'){
    calls.push({method:'GET',allTeachers:url.searchParams.get('allTeachers')});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(apiFolders)});
   }
   if(url.pathname==='/api/test_folder/save'){
    const body=route.request().postDataJSON();calls.push({method:'POST',body});
    const saved={...body,id:2,ownerId:7,ownerName:'Teacher',canManage:true};apiFolders.push(saved);
    return route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});
   }
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  });
  await page.goto('http://fresh-class.test');
  await page.setContent('<main id="qa" ng-controller="Qa as vm"><test-folder-picker folder-id="vm.folderId" manage="true"></test-folder-picker></main>');
  await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
  await page.evaluate(()=>{
   angular.module('Hrm.Question',[]);angular.module('Hrm.EnrolmentClass',[]);
   angular.module('QaApp',['Hrm.Question','Hrm.EnrolmentClass']).value('settings',{api:{baseUrl:'http://fresh-class.test/',apiV1Url:'api/'}})
    .controller('Qa',['ComprehensiveFolders',function(folders){this.folderId=null;}]);
  });
  await page.addScriptTag({path:path.join(app,'question/business/ComprehensiveFolders.js')});
  await page.evaluate(()=>angular.bootstrap(document.getElementById('qa'),['QaApp']));
  await page.getByRole('combobox',{name:'Chọn folder'}).locator('option').filter({hasText:'Practice'}).waitFor({state:'attached'});
  assert.equal(await page.evaluate(()=>angular.element(document.getElementById('qa')).injector().has('QuestionService')),false);
  await page.getByRole('button',{name:'+ Folder',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên folder',exact:true}).fill('New folder');
  await page.getByRole('button',{name:'Lưu folder',exact:true}).click();
  await page.waitForFunction(()=>angular.element(document.getElementById('qa')).scope().vm.folderId===2);
  assert.deepEqual(calls.find(call=>call.method==='POST').body,{name:'New folder',parentId:null});
  assert.equal(calls[0].allTeachers,'false');
 }finally{await browser.close();}
});
