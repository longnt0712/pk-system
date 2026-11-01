const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(app,f),'utf8');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});after(async()=>{if(browser)await browser.close();});
async function fixture(admin){
 const context=await browser.newContext({viewport:{width:1400,height:900}}),page=await context.newPage(),errors=[];
 const rows=[{id:3,name:'Newest program',code:'NEW',main:false,createDate:'2026-11-03T10:00:00'},{id:2,name:'Middle program',code:'MID',main:false,createDate:'2026-11-02T10:00:00'},{id:1,name:'Original Main',code:'OLD',main:true,createDate:'2026-11-01T10:00:00'}],writes=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),reply=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><main ng-controller="EducationProgramController as vm">'+read('education_program/views/listing.html')+'</main></body></html>'});
  if(u.pathname.includes('/get_page/'))return reply({content:rows,totalElements:rows.length});
  if(u.pathname.includes('/set_main/')){const id=Number(u.pathname.split('/').pop());writes.push(id);rows.forEach(p=>p.main=p.id===id);return reply(rows.find(p=>p.id===id));}
  return route.fulfill({status:404,body:'Missing fixture resource'});
 });
 await page.goto('http://education-main.test/');for(const file of ['assets/css/external/bootstrap.min.css','assets/css/external/bootstrap-table.min.css'])await page.addStyleTag({path:path.join(app,file)});
 for(const file of ['jquery.min.js','bootstrap.min.js','angular.min.js','bootstrap-table.min.js','bootstrap-table-angular.min.js','ui-bootstrap-tpls.min.js'])await page.addScriptTag({path:path.join(app,'assets/scripts/external',file)});
 await page.evaluate(()=>{window.App={initAjax(){}};angular.module('Hrm.EducationProgram',['bsTable','ui.bootstrap']);});
 for(const file of ['education_program/business/EducationProgramService.js','education_program/controllers/EducationProgramController.js'])await page.addScriptTag({path:path.join(app,file)});
 await page.evaluate(admin=>{
  angular.module('Fixture',['Hrm.EducationProgram']).value('settings',{layout:{},locale:'vi-VN',api:{baseUrl:'/service/',apiV1Url:'api/',apiPrefix:'api/'},isAdmin:admin,isStudentManagerment:!admin}).value('Upload',{}).value('toastr',{success(){},info(){},error(){}})
   .factory('Utilities',['$http',function(http){return{resolveAlt(url,method,params,data,headers,success,error){return http({url,method,data,params,headers}).then(r=>{if(success)success(r.data);return r.data;},e=>{if(error)error(e);throw e;});},resolve(url,method){return http({url,method}).then(r=>r.data);}};}])
   .run(['$rootScope','settings',function(root,settings){root.settings=settings;}]);angular.bootstrap(document,['Fixture']);window.vm=angular.element(document.querySelector('main')).scope().vm;
 },admin);
 await page.locator('tbody input[type="radio"]').first().waitFor();return{page,context,rows,writes,errors};
}
test('the real Bootstrap table keeps creation order and switching Main selects exactly one radio',async()=>{
 const f=await fixture(true);try{
  assert.equal(await f.page.locator('tbody input[type="radio"]:checked').count(),1);
  assert.match(await f.page.locator('tbody tr').first().innerText(),/Newest program/);
  assert.match(await f.page.locator('tbody tr').first().innerText(),/03\/11\/2026 10:00/);
  await f.page.locator('tbody tr').filter({hasText:'Newest program'}).getByRole('radio').click();
  await f.page.waitForFunction(()=>window.vm.educationPrograms.find(p=>p.id===3).main&&!window.vm.mainSaving);
  assert.deepEqual(f.writes,[3]);assert.equal(f.rows.filter(p=>p.main).length,1);assert.equal(await f.page.locator('tbody input[type="radio"]:checked').count(),1);
  await f.page.screenshot({path:path.join(app,'../../.tmp/education-program-main.png')});assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('a Student Management viewer can see Main and creation dates but cannot change Main',async()=>{
 const f=await fixture(false);try{
  for(const radio of await f.page.getByRole('radio').all())assert.equal(await radio.isDisabled(),true);
  assert.equal(await f.page.locator('tbody input[type="radio"]:checked').count(),1);assert.deepEqual(f.writes,[]);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
