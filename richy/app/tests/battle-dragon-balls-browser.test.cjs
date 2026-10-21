const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const battle = read('question/views/battle_quiz_online.html');
const effects = battle.match(/    <div class="battle-personal-gift-effects"[\s\S]*?    <\/div>/)[0];
const css = battle.match(/<style[^>]*>([\s\S]*?)<\/style>/g).join('\n').replace(/<\/?style[^>]*>/g, '');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async () => { browser = await playwright.chromium.launch({headless: true, executablePath}); });
after(async () => { if (browser) await browser.close(); });

test('Perry hat and Dragon Ball overlays stay faint and never intercept clicks on mobile or desktop', async () => {
    for (const width of [390, 1366]) {
        const page = await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
        try {
            await page.route('http://dragon-ball.test/**', route => {
                const pathname = new URL(route.request().url()).pathname;
                if (pathname.startsWith('/assets/')) return route.fulfill({path:path.join(app,pathname.slice(1))});
                return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>'+css+'</style><main id="qa">'
                    +'<button id="answer" style="position:fixed;left:25%;top:45%;width:50%;height:100px">Chọn đáp án</button>'+effects+'</main>'});
            });
            await page.goto('http://dragon-ball.test/');
            await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
            await page.evaluate(() => {
                angular.module('DragonQa',[]).run(['$rootScope', scope => {
                    window.qaScope=scope;
                    scope.vm={hat:15,ball:20,stars:7,giftPerryProtectionSeconds(){return this.hat;},
                        giftDragonBallBoostSeconds(){return this.ball;},
                        giftDragonBallBoostImage(){return '/assets/images/learning-pets/dragon-ball-'+this.stars+'/pet.png';}};
                }]);
                angular.bootstrap(document.getElementById('qa'),['DragonQa']);
                document.getElementById('answer').addEventListener('click',()=>window.answerClicks=(window.answerClicks||0)+1);
            });
            await page.waitForFunction(()=>[...document.querySelectorAll('.battle-personal-gift-effects img')].every(img=>img.complete&&img.naturalWidth>0));
            assert.equal(await page.locator('.battle-personal-gift-effects img').count(),2);
            const styles=await page.locator('.battle-personal-gift-effects img').evaluateAll(images=>images.map(img=>({
                opacity:Number(getComputedStyle(img).opacity),pointer:getComputedStyle(img).pointerEvents})));
            for(const style of styles){assert.equal(style.opacity,.08);assert.equal(style.pointer,'none');}
            await page.locator('#answer').click();assert.equal(await page.evaluate(()=>window.answerClicks),1);
            await page.evaluate(()=>window.qaScope.$apply(()=>{window.qaScope.vm.stars=1;window.qaScope.vm.hat=0;}));
            assert.equal(await page.locator('.battle-personal-gift-effects img').count(),1);
            assert.match(await page.locator('.battle-personal-gift-effects img').getAttribute('src'),/dragon-ball-1/);
            await page.evaluate(()=>window.qaScope.$apply(()=>window.qaScope.vm.ball=0));
            assert.equal(await page.locator('.battle-personal-gift-effects').count(),0);
        } finally { await page.close(); }
    }
});
