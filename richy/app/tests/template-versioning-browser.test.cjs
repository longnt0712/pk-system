const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(app,name),'utf8');
const helper = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match=>match[1]).find(script=>script.includes('window.APP_VERSION =') && script.includes('writeVersionedStylesheet'));
const configs = [];
vm.runInNewContext(read('application.configs.js'),{Hrm:{config:config=>configs.push(config)}});
const decorator = configs.find(config=>String(config.at(-1)).includes("decorator('$templateRequest'")).at(-1).toString();
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async()=>{
    const engine=process.env.CACHE_BROWSER==='webkit'?'webkit':'chromium';
    browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath}:{})});
});
after(async()=>{if(browser)await browser.close();});

test('real Angular fetches each release view once instead of reusing old bare HTML or changing inline modal IDs',async()=>{
    const page=await browser.newPage(), calls=[];
    try {
        await page.route('**/*',route=>{
            const url=new URL(route.request().url());
            if(url.pathname.endsWith('.html')) {
                calls.push({path:url.pathname,version:url.searchParams.get('v'),theme:url.searchParams.get('theme')});
                return route.fulfill({contentType:'text/html',headers:{'Cache-Control':'public, max-age=3600'},
                    body:'<section>Speaking '+(url.searchParams.get('v')||'STALE')+'</section>'});
            }
            return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><base href="/"></head><body><script type="text/ng-template" id="change_password_modal.html">INLINE PASSWORD</script><script type="text/ng-template" id="common/views/inline.html">INLINE VIEW ID</script></body></html>'});
        });
        await page.goto('https://ieltsroom.com/dashboard');
        await page.addScriptTag({content:helper});
        await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
        await page.addScriptTag({content:"window.Hrm=angular.module('TemplateVersionFixture',[]);Hrm.config(['$provide',"+decorator+"]);"});
        await page.evaluate(()=>{
            angular.bootstrap(document.body,['TemplateVersionFixture']);
            const injector=angular.element(document.body).injector();
            window.requestTemplate=injector.get('$templateRequest');
            window.templateCache=injector.get('$templateCache');
            templateCache.put('question/views/speaking.html','STALE BARE HTML');
            templateCache.put('uib/template/modal/window.html','INLINE UI BOOTSTRAP');
            window.APP_VERSION='release-A';
        });
        const first=await page.evaluate(()=>requestTemplate('question/views/speaking.html'));
        assert.equal(first,'<section>Speaking release-A</section>');
        assert.equal(await page.evaluate(()=>requestTemplate('question/views/speaking.html')),first);
        assert.equal(calls.length,1,'Angular caches the current release URL without repeated downloads');
        await page.evaluate(()=>{window.APP_VERSION='release-B';});
        assert.equal(await page.evaluate(()=>requestTemplate('question/views/speaking.html')),'<section>Speaking release-B</section>');
        assert.deepEqual(calls.slice(0,2).map(call=>call.version),['release-A','release-B']);
        assert.equal(await page.evaluate(()=>requestTemplate('question/views/speaking.html?theme=hallows&v=old')),'<section>Speaking release-B</section>');
        assert.equal(calls[2].version,'release-B');
        assert.equal(calls[2].theme,'hallows');
        for(const [key,expected] of [['change_password_modal.html','INLINE PASSWORD'],['common/views/inline.html','INLINE VIEW ID'],['uib/template/modal/window.html','INLINE UI BOOTSTRAP']]) {
            assert.equal(await page.evaluate(key=>requestTemplate(key),key),expected);
        }
        assert.equal(calls.length,3,'cached modal templates never trigger file requests');
        assert.equal(await page.evaluate(()=>requestTemplate.totalPendingRequests),0,'decorated service exposes the actual pending request count');
        assert.equal(await page.evaluate(()=>templateCache.get('question/views/speaking.html')),'STALE BARE HTML','the old cache entry is bypassed without deleting unrelated templates');
    } finally {await page.close();}
});
