const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(app,file),'utf8');
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const initial={tracks:[{name:'Battle music',url:'https://www.youtube.com/watch?v=MU0Yp0qmYEs',videoId:'MU0Yp0qmYEs',enabled:true,purpose:'BATTLE'},
 {name:'Lucky music',url:'https://www.youtube.com/watch?v=gOMUTUvVwEk',videoId:'gOMUTUvVwEk',enabled:true,purpose:'LUM_LIGHTNING'}]};

async function open(browser,width,config=initial){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.setDefaultTimeout(5000);
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('http://battle-config.test/**',route=>{const file=path.join(app,new URL(route.request().url()).pathname.slice(1));return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.setContent('<!doctype html><html><head><base href="http://battle-config.test/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+read('assets/css/external/bootstrap.min.css')+'body{background:#f4f5ff;font-family:Arial,sans-serif;margin:0;padding:12px}</style></head><body><main id="qa" ng-controller="BattleMusicConfigController as vm">'+read('question/views/battle_music_config.html')+'</main></body></html>');
 await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
 await page.evaluate(config=>{
  window.qaSaved=angular.copy(config);window.qaRequests=[];window.qaNotices=[];
  angular.module('Hrm.Question',[]).value('toastr',{success(){},warning(...args){window.qaNotices.push(args);},error(...args){window.qaNotices.push(args);}})
   .factory('BattleQuizOnlineService',function($q){return {getBattleMusicConfig(){return $q.when(angular.copy(window.qaSaved));},saveBattleMusicConfig(dto){window.qaRequests.push(angular.copy(dto));window.qaSaveDeferred=$q.defer();return window.qaSaveDeferred.promise;}};});
 },config);
 await page.addScriptTag({path:path.join(app,'question/controllers/BattleMusicConfigController.js')});
 await page.evaluate(()=>{angular.bootstrap(document.getElementById('qa'),['Hrm.Question']);window.qaScope=angular.element(document.getElementById('qa')).scope();});
 await page.locator('#battle-lucky-appearance-switch').waitFor();return {page,errors};
}

test('admin can switch pumpkin/lightning with matching previews and save/reload the shared Battle Config on desktop/mobile',async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
  for(const width of [1280,390]){
   const {page,errors}=await open(browser,width);
   let saved;
   try{
    const toggle=page.locator('#battle-lucky-appearance-switch'),preview=page.locator('.battle-lucky-preview');
    assert.equal(await toggle.isChecked(),true,'old configs start with the Halloween pumpkin');assert.equal(await toggle.getAttribute('aria-checked'),'true');
    await page.waitForFunction(()=>{const image=document.querySelector('.battle-lucky-preview');return image&&image.complete&&image.naturalWidth>0;});
    assert.match(await preview.getAttribute('src'),/battle-pumpkin\.svg/);
    const section=page.locator('.battle-lucky-appearance'),bounds=await section.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.equal(await section.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
    await toggle.uncheck();assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.match(await preview.getAttribute('src'),/battle-lightning\.svg/);
    await page.getByRole('button',{name:'Lưu Battle Config',exact:true}).click();assert.equal(await toggle.isDisabled(),true);
    saved=await page.evaluate(()=>window.qaRequests[0]);assert.equal(saved.lumLuckyAppearance,'LIGHTNING');assert.deepEqual(saved.tracks.map(track=>track.purpose),['BATTLE','LUM_LIGHTNING']);
    await page.evaluate(()=>window.qaScope.$apply(()=>{window.qaSaved=angular.copy(window.qaRequests[0]);window.qaSaveDeferred.resolve(angular.copy(window.qaSaved));}));
    await page.waitForFunction(()=>!window.qaScope.vm.saving);assert.equal(await toggle.isChecked(),false);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.qaNotices),[]);
   }finally{await page.close();}
   const reopened=await open(browser,width,saved);
   try{
    const toggle=reopened.page.locator('#battle-lucky-appearance-switch');assert.equal(await toggle.isChecked(),false,'saved switch restores on a newly loaded config page');
    await toggle.check();assert.match(await reopened.page.locator('.battle-lucky-preview').getAttribute('src'),/battle-pumpkin\.svg/);
    await reopened.page.getByRole('button',{name:'Lưu Battle Config',exact:true}).click();assert.equal(await reopened.page.evaluate(()=>window.qaRequests[0].lumLuckyAppearance),'PUMPKIN');
    await reopened.page.evaluate(()=>window.qaScope.$apply(()=>window.qaSaveDeferred.resolve(angular.copy(window.qaRequests[0]))));
    await reopened.page.waitForFunction(()=>!window.qaScope.vm.saving);
    if(process.env.BATTLE_LUCKY_SCREENSHOTS){fs.mkdirSync(process.env.BATTLE_LUCKY_SCREENSHOTS,{recursive:true});await reopened.page.locator('.battle-lucky-appearance').scrollIntoViewIfNeeded();await reopened.page.screenshot({path:path.join(process.env.BATTLE_LUCKY_SCREENSHOTS,'battle-config-pumpkin-'+width+'.png')});}
    assert.deepEqual(reopened.errors,[]);
   }finally{await reopened.page.close();}
  }
 }finally{await browser.close();}
});
