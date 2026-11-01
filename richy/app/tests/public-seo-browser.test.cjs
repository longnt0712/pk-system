const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname,'..');
const read = file=>fs.readFileSync(path.join(app,file),'utf8');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async()=>{const engine=process.env.SEO_BROWSER==='webkit'?'webkit':'chromium';browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath}:{})});});
after(async()=>{if(browser)await browser.close();});
test('standalone public introductions remain readable without JavaScript on mobile and desktop',async()=>{
    for(const site of ['ieltsroom','tntt']) for(const width of [390,1440]) {
        const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
        try {
            await page.route('**/*',route=>{
                const pathname=new URL(route.request().url()).pathname;
                if(pathname==='/gioi-thieu')return route.fulfill({contentType:'text/html; charset=utf-8',body:read('seo/'+site+'-about.html')});
                const asset=path.join(app,pathname.slice(1));
                if(fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({contentType:pathname.endsWith('.css')?'text/css':'image/jpeg',body:fs.readFileSync(asset)});
                return route.abort();
            });
            await page.goto('https://public-seo.test/gioi-thieu');
            assert.equal(await page.locator('h1').count(),1);
            assert.ok((await page.locator('main').innerText()).length>800);
            const host=site==='tntt'?'tnttphungkhoang.com':'ieltsroom.com';
            assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://'+host+'/gioi-thieu');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
            if(process.env.SEO_SCREENSHOT_DIR&&width===390)await page.screenshot({path:path.join(process.env.SEO_SCREENSHOT_DIR,site+'-public-seo.png'),fullPage:true});
        }finally{await page.close();}
    }
});
