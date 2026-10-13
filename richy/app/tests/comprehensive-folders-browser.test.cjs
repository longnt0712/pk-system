const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.join(__dirname,'..'), repo=path.resolve(app,'../..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const libraryHtml=fs.readFileSync(path.join(app,'question/views/ielts_test_library.html'),'utf8');
const builderHtml=fs.readFileSync(path.join(app,'question/views/create_ielts_reading_test.html'),'utf8');
const builderSource=fs.readFileSync(path.join(app,'question/controllers/IELTSCreateReadingTestController.js'),'utf8');
function section(source,start,end) {const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0 && to>from,start);return source.slice(from,to);}
const teacherHtml=section(builderHtml,'<test-folder-explorer files="vm.ieltsReadingTests"','</test-folder-explorer>')+'</test-folder-explorer>'+
 section(builderHtml,'<ul ng-if="vm.catalogPaginationTotal()', '</ul>')+'</ul>'+
 '<h3>Lưu bài vào folder</h3><test-folder-picker folder-id="vm.selectedTestFolderId" test-mode="vm.folderTestMode" manage="true"></test-folder-picker>';
const teacherCode=section(builderSource,'        vm.applyCatalogFolderFilter =','        vm.ieltsReadingTest =')+
 section(builderSource,'        var testCatalogRequestId =','        vm.showHiddenTests = false;');
const css=['assets/css/external/bootstrap.min.css','assets/css/ielts-test-library.css','assets/css/external/font-awesome.min.css','assets/css/test-builder.css','assets/css/comprehensive-folders.css'].map(file=>fs.readFileSync(path.join(app,file),'utf8')).join('\n');

async function fixture(browser,width,teacher,testMode='COMPREHENSIVE') {
 const page=await browser.newPage({viewport:{width,height:900}}), errors=[];
 page.setDefaultTimeout(10000); page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/test_folder_explorer.html')) return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(app,'question/views/test_folder_explorer.html'),'utf8')});
  if(url.pathname.endsWith('/comprehensive_move_test_folder_modal.html')) return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(app,'question/views/comprehensive_move_test_folder_modal.html'),'utf8')});
  if(/fontawesome-webfont\.(woff2?|ttf|eot)/.test(url.pathname)) return route.fulfill({body:fs.readFileSync(path.join(app,'assets/fonts/'+url.pathname.split('/').pop()))});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
 });
 await page.goto('http://folders.test');
 async function mount() {
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+css+
   'body{padding:20px;}main{max-width:1120px;margin:auto;}*{box-sizing:border-box;}@media(min-width:1600px){main{max-width:none;}}@media(max-width:600px){body{padding:10px;}}</style></head><body><main id="qa" ng-controller="'+(teacher?'Qa':'IELTSTestLibraryController')+' as vm">'+(teacher?teacherHtml:libraryHtml)+'</main></body></html>');
  await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
  await page.addScriptTag({path:path.join(app,'assets/scripts/external/ui-bootstrap-tpls.min.js')});
  await page.evaluate(({testMode})=>{
   window.App={initAjax(){}};
   angular.module('Hrm.Question',['ui.bootstrap']).value('settings',{}).value('$cookies',{get(){return '{"id":7}';}})
    .value('$location',{path(){return testMode==='COMPREHENSIVE'?'/comprehensive_tests':'/ielts_'+testMode.toLowerCase()+'_tests';}}).value('blockUI',{start(){},stop(){}})
    .run(['$rootScope',function(root){root.settings={layout:{}};}])
    .factory('QuestionService',['$q',function(q){
     window.folderData=[{id:1,name:'Listening',parentId:null,ownerId:7,ownerName:'Teacher A',canManage:true},
      {id:2,name:'Week 1',parentId:1,ownerId:7,ownerName:'Teacher A',canManage:true},
      {id:3,name:'Reading',parentId:null,ownerId:8,ownerName:'Teacher B',canManage:false}];
     window.folderData.forEach(folder=>folder.testMode=testMode);
     window.folderData.push({id:99,name:'Folder loại khác',parentId:null,ownerId:7,ownerName:'Teacher A',canManage:true,testMode:testMode==='READING'?'WRITING':'READING'});
     window.testData=[{id:11,title:'Bài cũ chưa vào folder',testFolder:null,userId:7,status:7},
      {id:12,title:'Daily Listening cơ bản',testFolder:window.folderData[0],userId:7,status:7},
      {id:13,title:'Bài luyện nghe tuần 1',testFolder:window.folderData[1],userId:7,status:6},
      {id:14,title:'Reading của giáo viên B',testFolder:window.folderData[2],userId:8,status:7}];
     // The student fixture needs a published child test too.
     window.testData[2].status=7;
     window.testData.forEach(test=>{test.testFormat=testMode==='WRITING'||testMode==='COMPREHENSIVE'?testMode:null;test.pronounce=testMode==='LISTENING'?'audio.mp3':null;test.hasWritingTask1=test.hasWritingTask2=testMode==='WRITING';});
     window.testRequests=[];
     window.moveCalls=[];
     window.renameCalls=[];window.statusCalls=[];window.folderSaveCalls=[];
     return {
      updateTestStatus(id,status){window.statusCalls.push({id,status});const d=q.defer();function finish(){if(window.failStatus){d.reject({data:{message:'Xuất bản lỗi thử nghiệm'}});return;}const row=window.testData.find(item=>item.id===id);row.status=status;d.resolve({id,status});}if(window.holdStatus)window.releaseStatus=finish;else finish();return d.promise;},
      getLearningDrafts(){return q.when([]);},
      updateTestTitle(id,title){
       window.renameCalls.push({id,title});const deferred=q.defer();
       function finish(){
        if(window.failRename){deferred.reject({data:{message:'Không lưu được tên bài.'}});return;}
        const test=window.testData.find(item=>item.id===id);test.title=title;deferred.resolve({id,title});
       }
       if(window.holdRename)window.releaseRename=finish;else finish();return deferred.promise;
      },
      getTestFolders(all,mode){return window.failFolders?q.reject({status:500}):q.when(window.folderData.filter(folder=>folder.testMode===(mode||'COMPREHENSIVE')&&(all || folder.ownerId===7)));},
      saveTestFolder(dto){window.folderSaveCalls.push(structuredClone(dto));
       if(window.failSave)return q.reject({data:{message:'Đã có folder cùng tên.'}});
       let folder=window.folderData.find(item=>item.id===dto.id);
       if(folder)Object.assign(folder,dto);else{folder={...dto,id:10+window.folderData.length,ownerId:7,ownerName:'Teacher A',canManage:true};window.folderData.push(folder);}
       return q.when({...folder});
      },
      moveTest(testId,folderId){
       window.moveCalls.push({testId,folderId});const deferred=q.defer();
       function finish(){
        if(window.failMove || window.failMoveId===testId){deferred.reject({data:{message:'Không lưu được vị trí. Bài vẫn ở folder cũ.'}});return;}
        const test=window.testData.find(item=>item.id===testId);test.testFolder=window.folderData.find(folder=>folder.id===folderId)||null;
        deferred.resolve({...test});
       }
       if(window.holdMove)window.releaseMove=finish;else finish();return deferred.promise;
      },
      getPageForTests(dto,index,size){
       if(window.failTests)return q.reject({status:500});
       window.testRequests.push({...dto,requestedPageIndex:index,requestedPageSize:size});
       const folders=new Map(window.folderData.map(folder=>[folder.id,folder]));
       function inside(id){if(!dto.testFolderId)return true;while(id){if(id===dto.testFolderId)return true;if(!dto.includeSubfolders)return false;id=folders.get(id)?.parentId;}return false;}
       const items=window.testData.filter(item=>(!dto.userId || dto.userId===item.userId) && (!dto.withoutTestFolder || !item.testFolder) && inside(item.testFolder?.id) &&
        (!dto.textSearch || item.title.toLowerCase().includes(dto.textSearch.toLowerCase())));
       return q.when(angular.copy({content:items.slice((index-1)*size,index*size),totalElements:items.length}));
      }
     };
    }]);
  },{testMode});
  await page.addScriptTag({path:path.join(app,'question/business/ComprehensiveFolders.js')});
  if(!teacher)await page.addScriptTag({path:path.join(app,'question/controllers/IELTSTestLibraryController.js')});
  await page.evaluate(({teacher,teacherCode,testMode})=>{
   angular.module('Hrm.Question').factory('TestFolderService',['QuestionService',function(service){return service;}]);
   if(teacher)angular.module('Hrm.Question').controller('Qa',['ComprehensiveFolders','QuestionService','$scope','$uibModal','$window',function(folders,service,scope,modal,browserWindow){
    const vm=this;Object.assign(vm,{isComprehensiveMode:testMode==='COMPREHENSIVE',isWritingMode:testMode==='WRITING',isListeningMode:testMode==='LISTENING',folderTestMode:testMode,isFlexibleMode:testMode==='COMPREHENSIVE'||testMode==='WRITING',currentUser:{id:7},searchDto:{pageIndex:1,status:9},
     catalogTestFolderId:null,selectedTestFolderId:null,ieltsReadingTests:[],bsTableControlCreateIELTSReadingTest:{options:{}},refreshLearningProgress(){}});
    vm.testCatalogUrl=item=>(testMode==='COMPREHENSIVE'?'comprehensive_test/':'ielts_'+testMode.toLowerCase()+'_actual_test/')+item.id+'?sessionMode=STUDY';
    scope.editCreateIELTSReadingTest=id=>window.lastEdit=id;
    scope.pageChanged=()=>vm.getPageCreateIELTSReadingTest();
    scope.hideReadingTest=id=>window.lastHide=id;scope.restoreReadingTest=id=>window.lastRestore=id;
    new Function('vm','folders','service','blockUI','toastr','modal','$window',teacherCode)(vm,folders,service,{start(){},stop(){}},{error(){},success(){}},modal,browserWindow);
    vm.getPageCreateIELTSReadingTest();window.qaVm=vm;
   }]);
   angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);
   if(!teacher)window.qaVm=angular.element(document.getElementById('qa')).scope().vm;
  },{teacher,teacherCode,testMode});
  await page.locator('.test-explorer-folder').first().waitFor();
 }
 await mount();return {page,errors,mount};
}

test('all four test modes show ten tests per page in admin and library, with ten columns on large screens',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE'])for(const teacher of [true,false]){
  const {page,errors}=await fixture(browser,1920,teacher,mode);
  await page.evaluate(()=>{
   window.testData=Array.from({length:11},(_,index)=>({id:100+index,userId:7,status:7,testFolder:null,
    title:index%2?'IELTS Academic Reading — The invention of television / Bluefin tuna / Children and playing':'Cambridge IELTS '+(index+1)}));
   angular.element(document.getElementById('qa')).scope().$apply(()=>qaVm.getPageCreateIELTSReadingTest?qaVm.getPageCreateIELTSReadingTest():qaVm.loadTests());
  });
  await page.waitForFunction(()=>document.querySelectorAll('.test-explorer-file').length===10);
  assert.equal(await page.evaluate(()=>window.testRequests.at(-1).requestedPageSize),10);
  for(const [width,columns] of [[1920,10],[1366,5],[768,2],[390,1]]){
   await page.setViewportSize({width,height:1000});
   const layout=await page.locator('.test-explorer-file').evaluateAll(cards=>cards.map(card=>{
    const rect=card.getBoundingClientRect();return {x:Math.round(rect.x),y:Math.round(rect.y),height:Math.round(rect.height)};
   }));
   assert.equal(new Set(layout.map(card=>card.x)).size,columns);
   assert.equal(new Set(layout.map(card=>card.y)).size,10/columns);
   assert.equal(new Set(layout.map(card=>card.height)).size,1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  await page.setViewportSize({width:1920,height:1000});
  await page.locator('.test-folder-explorer').screenshot({path:path.join(repo,'.tmp/test-grid-ten-columns-'+mode.toLowerCase()+'-'+(teacher?'admin':'library')+'.png')});
  await page.locator('ul.pagination').getByRole('link',{name:teacher?'Sau':'›',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.test-explorer-file').length===1);
  assert.equal(await page.evaluate(()=>qaVm.ieltsReadingTests[0].id),110);
  assert.equal(await page.evaluate(()=>window.testRequests.at(-1).requestedPageIndex),2);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('double click renames test titles in place in every mode and both views; Enter saves and Escape cancels',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  const card=page.locator('.test-explorer-file').first();
  for(const view of ['grid','list']){
   if(view==='list')await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
   await page.evaluate(()=>delete window.lastEdit);
   await card.locator('.test-title-display').dblclick();
   const input=card.getByRole('textbox',{name:'Tên bài test'});await input.waitFor();
   await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Tên bài test');
   assert.equal(await page.evaluate(()=>window.lastEdit),undefined);
   await input.fill('   '+mode+' tên mới '+view+'   ');await input.press('Enter');
   await card.locator('.test-title-display').filter({hasText:mode+' tên mới '+view}).waitFor();
   assert.equal(await page.evaluate(()=>window.renameCalls.at(-1).title),mode+' tên mới '+view);
   assert.equal(await page.evaluate(()=>window.testData[0].status),7);
   await card.locator('.test-title-display').dblclick();await input.fill('Không lưu');await input.press('Escape');
   assert.equal(await card.locator('.test-title-display').innerText(),mode+' tên mới '+view);
   await card.getByRole('button',{name:'Sửa bài',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.lastEdit),11);
  }
  await card.locator('.test-title-display').dblclick();const input=card.getByRole('textbox',{name:'Tên bài test'});
  await input.fill(' ');await input.press('Enter');await card.getByRole('alert').filter({hasText:'không được để trống'}).waitFor();
  assert.equal(await page.evaluate(()=>window.renameCalls.length),2);
  await page.evaluate(()=>window.failRename=true);await input.fill('Thử lại tên');await input.press('Enter');
  await card.getByRole('alert').filter({hasText:'Không lưu được tên bài'}).waitFor();
  assert.equal(await input.inputValue(),'Thử lại tên');
  assert.equal(await page.evaluate(()=>qaVm.ieltsReadingTests[0].title),mode+' tên mới list');
  await page.evaluate(()=>{window.failRename=false;window.holdRename=true;});
  await input.press('Enter');await page.waitForFunction(()=>!!window.releaseRename);
  assert.equal(await input.isDisabled(),true);assert.equal(await card.getByRole('button',{name:'Hủy',exact:true}).isDisabled(),true);
  await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().$apply(()=>window.releaseRename()));
  await card.locator('.test-title-display').filter({hasText:'Thử lại tên'}).waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('double click renames owned folders without opening them and preserves nested paths and retryable errors',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  await page.locator('.test-explorer-folder .test-explorer-name').first().dblclick();
  const input=page.getByRole('textbox',{name:'Tên folder mới'});await input.waitFor();
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(()=>qaVm.catalogTestFolderId),null);
  await input.fill('Folder '+mode);await input.press('Enter');
  await page.getByRole('button',{name:'Folder '+mode,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.folderData[0].testMode),mode);
  assert.equal(await page.getByRole('combobox',{name:'Chọn folder'}).locator('option').filter({hasText:'Folder '+mode+' / Week 1'}).count(),1);
  await page.getByRole('button',{name:'Folder '+mode,exact:true}).focus();await page.keyboard.press('F2');
  await input.fill('Không lưu');await input.press('Escape');
  await page.getByRole('button',{name:'Folder '+mode,exact:true}).waitFor();
  await page.evaluate(()=>window.failSave=true);
  await page.locator('.test-explorer-folder .test-explorer-name').first().dblclick();await input.fill('Trùng tên');await input.press('Enter');
  await page.locator('.test-explorer-folder-rename').getByRole('alert').filter({hasText:'Đã có folder cùng tên'}).waitFor();
  assert.equal(await page.evaluate(()=>window.folderData[0].name),'Folder '+mode);
  await page.evaluate(()=>window.failSave=false);await input.press('Enter');
  await page.getByRole('button',{name:'Trùng tên',exact:true}).click();
  await page.getByRole('button',{name:'Week 1',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>qaVm.catalogTestFolderId),1);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('Reading, Listening and Writing browse and manage their own folders on desktop and mobile',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING'])for(const width of [1366,390])for(const teacher of [true,false]){
  const {page,errors}=await fixture(browser,width,teacher,mode);
  assert.equal(await page.locator('.test-explorer-folder').count(),teacher?1:2);
  assert.equal(await page.getByRole('button',{name:/Folder loại khác/}).count(),0);
  await page.getByRole('button',{name:/^Listening/}).click();
  await page.locator('.test-explorer-file').filter({hasText:'Daily Listening cơ bản'}).waitFor();
  assert.equal(await page.locator('.test-explorer-file').count(),1);
  assert.match(await page.locator('.test-explorer-file-main').getAttribute(teacher?'title':'href'),teacher?/Daily Listening/:new RegExp('ielts_'+mode.toLowerCase()+'_actual_test/12'));
  if(teacher){
   await page.getByRole('button',{name:'Tạo folder con',exact:true}).click();
   await page.locator('.test-folder-explorer').getByRole('textbox',{name:'Tên folder'}).fill('IELTS Week 2');
   await page.locator('.test-folder-explorer').getByRole('button',{name:'Lưu folder',exact:true}).click();
   await page.getByRole('button',{name:'IELTS Week 2',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.folderData.find(folder=>folder.name==='IELTS Week 2').testMode),mode);
   const select=page.getByRole('combobox',{name:'Chọn folder'});
   await select.selectOption({label:'Listening / IELTS Week 2'});
   assert.equal(await select.locator('option').filter({hasText:'Folder loại khác'}).count(),0);
   await page.locator('.test-explorer-file').dragTo(page.getByRole('button',{name:'IELTS Week 2',exact:true}));
   await page.waitForFunction(()=>window.testData.find(test=>test.id===12).testFolder.name==='IELTS Week 2');
   await page.getByRole('button',{name:'IELTS Week 2',exact:true}).click();
  }else{
   if(mode==='WRITING'){
    assert.match(await page.getByRole('link',{name:'Bắt đầu Task 1',exact:true}).getAttribute('href'),/assignmentPart=1/);
    assert.match(await page.getByRole('link',{name:'Bắt đầu Task 2',exact:true}).getAttribute('href'),/assignmentPart=2/);
   }
   await page.getByRole('button',{name:/^Week 1/}).click();
   await page.locator('.test-explorer-file').filter({hasText:'tuần 1'}).waitFor();
   assert.match(await page.locator('.test-explorer-file-main').getAttribute('href'),new RegExp('ielts_'+mode.toLowerCase()+'_actual_test/13'));
   await page.evaluate(()=>window.failTests=true);
   await page.getByRole('button',{name:'Lên folder cha',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Không tải được danh sách'}).waitFor();
   assert.equal(await page.locator('.test-explorer-empty').filter({hasText:'Folder này chưa có'}).count(),0);
   await page.evaluate(()=>window.failTests=false);
   await page.getByRole('button',{name:'Thử lại',exact:true}).click();
   await page.locator('.test-explorer-file').waitFor();
  }
  await page.screenshot({path:path.join(repo,'.tmp/ielts-folders-'+mode.toLowerCase()+'-'+(teacher?'teacher':'library')+'-grid-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
  await page.locator('.test-folder-explorer.is-list').waitFor();
  await page.screenshot({path:path.join(repo,'.tmp/ielts-folders-'+mode.toLowerCase()+'-'+(teacher?'teacher':'library')+'-list-'+width+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('real folder views support grid/list, breadcrumbs, direct contents, nested search, ownership and mobile layout',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try {for(const width of [1366,390])for(const teacher of [true,false]){
  const {page,errors,mount}=await fixture(browser,width,teacher);
  assert.equal(await page.locator('.test-explorer-folder').count(),teacher?1:2);
  assert.equal(await page.locator('.test-explorer-file').count(),1);
  const screen=teacher?'teacher':'library';
  await page.screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-grid-'+width+'.png'),fullPage:true});
  await page.locator('.test-explorer-file').hover();
  await page.locator('.test-folder-explorer').screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-grid-hover-'+width+'.png'),animations:'disabled'});
  await page.mouse.move(0,0);
  await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
  await page.locator('.test-folder-explorer.is-list').waitFor();
  await page.screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-list-'+width+'.png'),fullPage:true});
  await page.locator('.test-explorer-file').hover();
  await page.locator('.test-folder-explorer').screenshot({path:path.join(repo,'.tmp/comprehensive-folders-'+screen+'-list-hover-'+width+'.png'),animations:'disabled'});
  await page.mouse.move(0,0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('comprehensiveTestFolderView')),'list');
  await page.reload();await mount();await page.locator('.test-folder-explorer.is-list').waitFor();
  await page.getByRole('button',{name:/^Listening/}).click();
  await page.locator('.test-explorer-file').filter({hasText:'Daily Listening cơ bản'}).waitFor();
  assert.equal(await page.locator('.test-explorer-folder').count(),1);
  assert.equal(await page.locator('.test-explorer-file').count(),1);
  assert.match(await page.locator('.test-explorer-file').innerText(),/Daily Listening/);
  await page.getByRole('button',{name:/^Week 1/}).click();
  await page.locator('.test-explorer-file').filter({hasText:'tuần 1'}).waitFor();
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

test('IELTS admin displays older manual tests regardless of their owner, including older pages and title search',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  await page.evaluate(()=>{
   const scope=angular.element(document.getElementById('qa')).scope();
   window.testData=[{id:101,title:'Recent import',testFolder:null,userId:7,status:7},
    {id:102,title:'Older manual test',testFolder:null,userId:8,status:7},
    {id:103,title:'Legacy test without owner',testFolder:null,userId:null,status:6}];
   scope.$apply(()=>{qaVm.searchDto.pageSize=2;qaVm.getPageCreateIELTSReadingTest();});
  });
  await page.locator('.test-explorer-file').filter({hasText:'Older manual test'}).waitFor();
  assert.equal(await page.evaluate(()=>qaVm.bsTableControlCreateIELTSReadingTest.options.totalRows),3);
  await page.locator('ul.pagination').getByRole('link',{name:'Sau',exact:true}).click();
  await page.locator('.test-explorer-file').filter({hasText:'Legacy test without owner'}).waitFor();
  await page.evaluate(()=>{
   const scope=angular.element(document.getElementById('qa')).scope();
   scope.$apply(()=>{qaVm.searchDto.textSearch='Older manual';qaVm.searchDto.pageIndex=1;qaVm.getPageCreateIELTSReadingTest();});
  });
  await page.locator('.test-explorer-file').filter({hasText:'Older manual test'}).waitFor();
  assert.equal(await page.locator('.test-explorer-file').count(),1);
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
  assert.deepEqual(calls.find(call=>call.method==='POST').body,{name:'New folder',parentId:null,testMode:'COMPREHENSIVE'});
  assert.equal(calls[0].allTeachers,'false');
 }finally{await browser.close();}
});

test('native drag and drop autosaves in both views, supports child/root moves and preserves failed moves and unsaved editor content',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try {for(const view of ['grid','list']){
  const {page,errors}=await fixture(browser,1366,true);
  if(view==='list')await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
  await page.evaluate(()=>{
   const scope=angular.element(document.getElementById('qa')).scope();
   scope.$apply(()=>{window.qaVm.ieltsReadingTest={id:11,title:'Unsaved title',subQuestions:[{question:'Unsaved transcript'}]};window.holdMove=true;});
  });
  const file=title=>page.locator('.test-explorer-file').filter({hasText:title});
  const folder=name=>page.locator('.test-explorer-folder').filter({hasText:name});
  let requestsBeforeMove;
  const assertNoReload=async()=>assert.equal(await page.evaluate(()=>window.testRequests.length),requestsBeforeMove);
  const drag=async(title,target)=>{
   await page.waitForFunction(title=>Array.from(document.querySelectorAll('.test-explorer-file')).some(element=>element.textContent.includes(title) && element.draggable),title);
   requestsBeforeMove=await page.evaluate(()=>window.testRequests.length);
   await file(title).locator('.test-explorer-file-main').dragTo(target);
  };
  await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().$apply(()=>window.qaVm.savingReadingTest=true));
  assert.equal(await file('Bài cũ chưa vào folder').getAttribute('draggable'),'false');
  await page.evaluate(()=>angular.element(document.getElementById('qa')).scope().$apply(()=>window.qaVm.savingReadingTest=false));
  await drag('Bài cũ chưa vào folder',folder('Listening'));
  await page.getByRole('status').filter({hasText:'Đang chuyển bài...'}).waitFor();
  assert.equal(await file('Bài cũ chưa vào folder').count(),1);
  assert.equal(await file('Bài cũ chưa vào folder').getAttribute('draggable'),'false');
  assert.deepEqual(await page.evaluate(()=>window.moveCalls),[{testId:11,folderId:1}]);
  assert.equal(await page.evaluate(()=>window.qaVm.catalogMovePending),true);
  await page.evaluate(()=>{window.holdMove=false;window.releaseMove();});
  await page.waitForFunction(()=>document.querySelectorAll('.test-explorer-file').length===0);
  await page.getByRole('status').filter({hasText:'Đã chuyển'}).waitFor();
  await assertNoReload();
  assert.deepEqual(await page.evaluate(()=>({id:qaVm.selectedTestFolderId,title:qaVm.ieltsReadingTest.title,question:qaVm.ieltsReadingTest.subQuestions[0].question})),
   {id:1,title:'Unsaved title',question:'Unsaved transcript'});
  await folder('Listening').click();
  await file('Bài cũ chưa vào folder').waitFor();
  await drag('Bài cũ chưa vào folder',folder('Week 1'));
  await page.waitForFunction(()=>window.testData.find(test=>test.id===11).testFolder.id===2);
  assert.equal(await file('Bài cũ chưa vào folder').count(),0);
  await assertNoReload();
  await folder('Week 1').click();await file('Bài cũ chưa vào folder').waitFor();
  await drag('Bài cũ chưa vào folder',page.locator('.test-explorer-path').getByRole('button',{name:'Listening',exact:true}));
  await page.waitForFunction(()=>window.testData.find(test=>test.id===11).testFolder.id===1);
  await assertNoReload();
  await drag('Bài luyện nghe tuần 1',page.locator('.test-explorer-path').getByRole('button',{name:/Folder của tôi/}));
  await page.waitForFunction(()=>window.testData.find(test=>test.id===13).testFolder===null);
  await assertNoReload();
  await page.locator('.test-explorer-path').getByRole('button',{name:/Folder của tôi/}).click();
  await file('Bài luyện nghe tuần 1').waitFor();await page.evaluate(()=>window.failMove=true);
  await drag('Bài luyện nghe tuần 1',folder('Listening'));
  await page.getByRole('alert').filter({hasText:'Không lưu được vị trí'}).waitFor();
  assert.equal(await file('Bài luyện nghe tuần 1').count(),1);
  assert.equal(await page.evaluate(()=>window.testData.find(test=>test.id===13).testFolder),null);
  await assertNoReload();
  await page.evaluate(()=>window.failMove=false);
  await drag('Bài luyện nghe tuần 1',folder('Listening'));
  await page.waitForFunction(()=>window.testData.find(test=>test.id===13).testFolder?.id===1);
  assert.equal(await file('Bài luyện nghe tuần 1').count(),0);
  await assertNoReload();
  assert.equal(await page.evaluate(()=>window.lastEdit),undefined);assert.deepEqual(errors,[]);await page.close();
 }
 const {page}=await fixture(browser,1366,false);
 assert.notEqual(await page.locator('.test-explorer-file').getAttribute('draggable'),'true');
 await page.locator('.test-explorer-folder').first().evaluate(element=>{
  const transfer=new DataTransfer();transfer.setData('application/x-comprehensive-test','11');
  element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
 });
 assert.deepEqual(await page.evaluate(()=>window.moveCalls),[]);
 }finally{await browser.close();}
});

test('moves preserve other cards and pagination, refill only one row, and leave an empty last page selectable',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{
  const {page,errors}=await fixture(browser,1366,true);
  await page.evaluate(()=>{
   const scope=angular.element(document.getElementById('qa')).scope();
   window.testData=Array.from({length:5},(_,index)=>({id:101+index,title:'Pagination '+(index+1),testFolder:null,userId:7,status:7}));
   scope.$apply(()=>{window.qaVm.searchDto.pageSize=2;window.qaVm.searchDto.pageIndex=2;window.qaVm.getPageCreateIELTSReadingTest();});
  });
  const file=title=>page.locator('.test-explorer-file').filter({hasText:title});
  await file('Pagination 4').waitFor();
  const requestCount=await page.evaluate(()=>{
   window.preservedCard=Array.from(document.querySelectorAll('.test-explorer-file')).find(element=>element.textContent.includes('Pagination 4'));
   window.preservedRow=window.qaVm.ieltsReadingTests.find(row=>row.id===104);
   window.catalogLoadCount=0;
   angular.element(document.getElementById('qa')).scope().$watch('vm.catalogLoading',loading=>{if(loading)window.catalogLoadCount++;});
   return window.testRequests.length;
  });
  await file('Pagination 3').locator('.test-explorer-file-main').dragTo(page.locator('.test-explorer-folder').filter({hasText:'Listening'}));
  await page.waitForFunction(()=>window.qaVm.ieltsReadingTests.map(row=>row.id).join(',')==='104,105');
  assert.deepEqual(await page.evaluate(count=>window.testRequests.slice(count).map(request=>({index:request.requestedPageIndex,size:request.requestedPageSize})),requestCount),[{index:4,size:1}]);
  assert.equal(await page.evaluate(()=>window.preservedCard.isConnected && window.qaVm.ieltsReadingTests[0]===window.preservedRow),true);
  for(const title of ['Pagination 4','Pagination 5']){
   await file(title).locator('.test-explorer-file-main').dragTo(page.locator('.test-explorer-folder').filter({hasText:'Listening'}));
   await file(title).waitFor({state:'detached'});
  }
  assert.equal(await page.evaluate(()=>window.qaVm.searchDto.pageIndex),2);
  assert.equal(await page.evaluate(()=>window.qaVm.bsTableControlCreateIELTSReadingTest.options.totalRows),2);
  assert.equal(await page.evaluate(()=>window.catalogLoadCount),0);
  assert.equal(await page.evaluate(()=>window.testRequests.length),requestCount+1);
  assert.equal(await page.locator('ul.pagination li.active').innerText(),'2');
  await page.locator('ul.pagination').getByRole('link',{name:'Trước',exact:true}).click();
  await file('Pagination 1').waitFor();assert.equal(await page.evaluate(()=>window.qaVm.searchDto.pageIndex),1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('every teacher test has a move dialog with an owned folder tree, root selection, cancel, failure and retry',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const view of ['grid','list']){
  const {page,errors}=await fixture(browser,view==='grid'?1366:390,true);
  if(view==='list')await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
  const file=title=>page.locator('.test-explorer-file').filter({hasText:title});
  const folder=name=>page.locator('.test-explorer-folder').filter({hasText:name});
  const open=async title=>{await file(title).getByRole('button',{name:'Di chuyển',exact:true}).click();await page.getByRole('dialog').getByRole('tree',{name:'Chọn folder đích'}).waitFor();};
  const dialog=page.getByRole('dialog'),confirm=dialog.getByRole('button',{name:'Di chuyển đến đây',exact:true});
  await open('Bài cũ chưa vào folder');
  assert.equal(await confirm.isDisabled(),true);
  assert.equal(await dialog.getByRole('button',{name:/Reading/}).count(),0);
  await dialog.getByRole('button',{name:'Thu gọn Listening',exact:true}).click();
  assert.equal(await dialog.getByRole('button',{name:'Week 1',exact:true}).count(),0);
  await dialog.getByRole('button',{name:'Mở rộng Listening',exact:true}).click();
  await dialog.getByRole('button',{name:'Week 1',exact:true}).click();
  await dialog.locator('.test-move-destination').filter({hasText:'Listening / Week 1'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  fs.mkdirSync(path.join(repo,'.tmp'),{recursive:true});
  await page.screenshot({path:path.join(repo,'.tmp/test-folder-move-modal-'+view+'.png')});
  const requestsBefore=await page.evaluate(()=>window.testRequests.length);
  await page.evaluate(()=>window.holdMove=true);await confirm.click();
  await dialog.getByRole('button',{name:'Đang di chuyển...',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Hủy',exact:true}).isDisabled(),true);
  assert.equal(await file('Bài cũ chưa vào folder').count(),1);
  await page.evaluate(()=>{window.holdMove=false;window.releaseMove();});await dialog.waitFor({state:'hidden'});
  assert.equal(await file('Bài cũ chưa vào folder').count(),0);
  assert.equal(await page.evaluate(()=>window.testRequests.length),requestsBefore);
  assert.deepEqual(await page.evaluate(()=>window.moveCalls),[{testId:11,folderId:2}]);
  await folder('Listening').click();await file('Daily Listening cơ bản').waitFor();
  await open('Daily Listening cơ bản');assert.equal(await confirm.isDisabled(),true);
  await dialog.getByRole('button',{name:/^Folder của tôi/}).click();await confirm.click();await dialog.waitFor({state:'hidden'});
  assert.equal(await file('Daily Listening cơ bản').count(),0);
  await page.locator('.test-explorer-path').getByRole('button',{name:/Folder của tôi/}).click();await file('Daily Listening cơ bản').waitFor();
  await open('Daily Listening cơ bản');await dialog.getByRole('button',{name:'Week 1',exact:true}).click();
  await page.evaluate(()=>window.failMove=true);await confirm.click();
  await dialog.getByRole('alert').filter({hasText:'Không lưu được vị trí'}).waitFor();
  assert.equal(await file('Daily Listening cơ bản').count(),1);
  assert.equal(await page.evaluate(()=>window.qaVm.catalogMovePending),false);
  await page.evaluate(()=>window.failMove=false);await confirm.click();await dialog.waitFor({state:'hidden'});
  assert.equal(await file('Daily Listening cơ bản').count(),0);
  await folder('Listening').click();await folder('Week 1').click();await file('Daily Listening cơ bản').waitFor();
  const movesBeforeCancel=await page.evaluate(()=>window.moveCalls.length);
  await open('Daily Listening cơ bản');await dialog.getByRole('button',{name:/^Folder của tôi/}).click();
  await dialog.getByRole('button',{name:'Hủy',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.moveCalls.length),movesBeforeCancel);
  assert.equal(await file('Daily Listening cơ bản').count(),1);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('publication badges toggle only the selected record in all modes and views, preserve editor text, and retry failures',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  await page.evaluate(()=>{testData.push({id:15,title:'Keep this card',status:7,userId:7,testFolder:null});angular.element(document.getElementById('qa')).scope().$apply(()=>qaVm.getPageCreateIELTSReadingTest());});
  await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  const card=page.locator('article').filter({hasText:'Bài cũ chưa vào folder'});
  for(const view of ['grid','list']){
   if(view==='list')await page.getByRole('button',{name:'Chuyển sang dạng danh sách',exact:true}).click();
   await card.getByRole('checkbox').check();
   const before=await page.evaluate(()=>{window.keptNode=document.querySelectorAll('article')[1];qaVm.ieltsReadingTest={id:11,title:'Unsaved title',status:7,subQuestions:[{question:'Unsaved question'}]};window.holdStatus=true;return testRequests.length;});
   await card.getByRole('button',{name:'Đã xuất bản',exact:true}).click();
   assert.equal(await card.getByRole('button',{name:'Đang lưu...',exact:true}).isDisabled(),true);
   assert.equal(await card.getByRole('button',{name:'Di chuyển',exact:true}).isDisabled(),true);
   await page.evaluate(()=>{holdStatus=false;releaseStatus();});await card.getByRole('button',{name:'Bản nháp',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>keptNode===document.querySelectorAll('article')[1]),true);
   assert.equal(await page.evaluate(()=>testRequests.length),before);
   assert.equal(await page.evaluate(()=>qaVm.ieltsReadingTest.status),6);
   assert.equal(await page.evaluate(()=>qaVm.ieltsReadingTest.subQuestions[0].question),'Unsaved question');
   assert.equal(await card.getByRole('checkbox').isChecked(),true);
   await page.evaluate(()=>failStatus=true);await card.getByRole('button',{name:'Bản nháp',exact:true}).click();await card.getByRole('alert').waitFor();
   assert.equal(await page.evaluate(()=>qaVm.ieltsReadingTests.find(row=>row.id===11).status),6);
   await page.evaluate(()=>failStatus=false);await card.getByRole('button',{name:'Bản nháp',exact:true}).click();await card.getByRole('button',{name:'Đã xuất bản',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>testRequests.length),before);
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('folder create and rename autofocus and Cancel closes the actual form in every mode, explorer and picker',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  for(const [component,createName] of [[page.locator('test-folder-explorer'),'Tạo folder'],[page.locator('test-folder-picker'),'+ Folder']]){
   await component.getByRole('button',{name:createName,exact:true}).click();const input=component.getByRole('textbox',{name:'Tên folder',exact:true});await input.waitFor();
   await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Tên folder');assert.equal(await input.evaluate(el=>el===document.activeElement),true);await input.fill('Not saved');
   await component.getByRole('button',{name:'Hủy',exact:true}).click();await input.waitFor({state:'hidden'});
   await component.getByRole('button',{name:createName,exact:true}).click();await input.waitFor();assert.equal(await input.inputValue(),'');await component.getByRole('button',{name:'Hủy',exact:true}).click();
  }
  await page.getByRole('button',{name:'Listening',exact:true}).click();
  const explorer=page.locator('test-folder-explorer');await explorer.getByRole('button',{name:'Đổi tên folder',exact:true}).click();
  const input=explorer.getByRole('textbox',{name:'Tên folder',exact:true});await input.waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Tên folder');assert.equal(await input.evaluate(el=>el===document.activeElement&&el.selectionEnd-el.selectionStart===el.value.length),true);
  await explorer.getByRole('button',{name:'Hủy',exact:true}).click();await input.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>folderSaveCalls.length),0);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

test('bulk move retries only failed selected files, retains other cards, and folder dragging preserves its subtree without list reloads',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:chrome});
 try{for(const mode of ['READING','LISTENING','WRITING','COMPREHENSIVE']){
  const {page,errors}=await fixture(browser,1366,true,mode);
  await page.evaluate(mode=>{
   testData.push({id:15,title:'Bulk second',status:7,userId:7,testFolder:null},{id:16,title:'Untouched',status:7,userId:7,testFolder:null});
   folderData.push({id:4,name:'Destination',parentId:null,ownerId:7,ownerName:'Teacher A',canManage:true,testMode:mode});
   angular.element(document.getElementById('qa')).scope().$apply(()=>{qaVm.getPageCreateIELTSReadingTest();angular.element(document.getElementById('qa')).injector().get('$rootScope').$broadcast('comprehensiveFoldersChanged');});
  },mode);
  await page.waitForFunction(()=>document.querySelectorAll('article').length===3);
  const card=title=>page.locator('article').filter({hasText:title});await card('Bài cũ').getByRole('checkbox').check();await card('Bulk second').getByRole('checkbox').check();
  const before=await page.evaluate(()=>{window.keepBulk=document.querySelectorAll('article')[2];window.failMoveId=15;return testRequests.length;});
  await page.getByRole('button',{name:'Di chuyển đã chọn',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.locator('.test-move-folder').filter({hasText:'Listening'}).click();await dialog.getByRole('button',{name:'Di chuyển đến đây',exact:true}).click();
  await dialog.getByRole('alert').filter({hasText:'Còn 1 bài'}).waitFor();assert.equal(await card('Bài cũ').count(),0);assert.equal(await card('Bulk second').getByRole('checkbox').isChecked(),true);
  await page.evaluate(()=>delete window.failMoveId);await dialog.getByRole('button',{name:'Di chuyển đến đây',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>moveCalls.map(c=>c.testId)),[11,15,15]);assert.equal(await page.evaluate(()=>testRequests.length),before);
  assert.equal(await page.evaluate(()=>keepBulk===document.querySelector('article')),true);
  const source=page.locator('.test-explorer-folder-entry').filter({hasText:'Listening'}), destination=page.getByRole('button',{name:'Destination',exact:true});
  await source.dragTo(destination);await page.waitForFunction(()=>folderData.find(f=>f.id===1).parentId===4);
  assert.equal(await page.evaluate(()=>folderData.find(f=>f.id===2).parentId),1);assert.equal(await page.evaluate(()=>testData.find(r=>r.id===13).testFolder.id),2);
  assert.equal(await page.evaluate(()=>testRequests.length),before);assert.equal(await page.evaluate(()=>keepBulk===document.querySelector('article')),true);
  await page.getByRole('button',{name:'Destination',exact:true}).click();await page.getByRole('button',{name:'Listening',exact:true}).waitFor();
  await page.getByRole('button',{name:'Listening',exact:true}).click();await page.getByRole('button',{name:'Week 1',exact:true}).waitFor();
  const saves=await page.evaluate(()=>folderSaveCalls.length);
  await page.locator('.test-explorer-folder-entry').filter({hasText:'Week 1'}).dragTo(page.locator('.test-explorer-path').getByRole('button',{name:'Listening',exact:true}));
  assert.equal(await page.evaluate(()=>folderSaveCalls.length),saves);
  await page.locator('.test-explorer-path > button').click();
  await page.locator('.test-folder-explorer').screenshot({path:path.join(repo,'.tmp/test-catalog-actions-'+mode.toLowerCase()+'.png')});
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
