const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(app, relative), 'utf8');
const header = read('common/views/navs/header-hoz.html');
const publicHeader = read('common/views/navs/header-hoz-for-login.html');
const dashboard = read('dashboards/views/general-alt.html');
const exam = read('question/views/ielts_reading_actual_test_idp.html');
const inlineStyles = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const styles = ['external/bootstrap.min.css', 'external/font-awesome.min.css', 'components-md.min.css',
    'plugins-md.min.css', 'layout-hoz.min.css', 'default.min.css', 'custom.css', 'ui-layer-safety.css']
    .map(name => read('assets/css/' + name)).join('\n') + inlineStyles(read('index.html')) + inlineStyles(header) + inlineStyles(publicHeader) + inlineStyles(dashboard);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async () => {
    const engine = process.env.SITE_THEME_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true, ...(engine === 'chromium' ? {executablePath} : {})});
});
after(async () => { if (browser) await browser.close(); });

async function open(shared, options = {}) {
    const context = await browser.newContext({viewport:options.viewport || {width:1180, height:820}, hasTouch:true, reducedMotion:options.motion || 'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.stack));
    const hostname = options.hostname || 'ieltsroom.com';
    const schoolRows = () => (shared.schools || [
        {schoolId:1,name:'IELTS Room',domain:'ieltsroom.com'},
        {schoolId:2,name:'TNTT Phùng Khoang',domain:'tnttphungkhoang.com'},
        {schoolId:3,name:'New school',domain:'academy.example'}
    ]).map(row=>({...row,configured:true,theme:row.schoolId===1?shared.theme:(shared.schoolThemes||{})[row.schoolId]||'NORMAL'}));
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/service/public/site-theme' || url.pathname === '/service/public/site-theme/ieltsroom') {
            calls.push({method:request.method(), path:url.pathname});
            if (shared.legacy && url.pathname === '/service/public/site-theme') return route.fulfill({status:404,json:{}});
            const domain=(url.searchParams.get('domain')||'ieltsroom.com').replace(/^www\./,'');
            const payload=url.pathname.endsWith('/ieltsroom')?{theme:shared.theme}:schoolRows().find(row=>row.domain===domain)||{theme:'NORMAL',domain,configured:false};
            if (shared.holdRead) {
                return new Promise(resolve => {
                    shared.pendingReads = shared.pendingReads || [];
                    shared.pendingReads.push(async () => { await route.fulfill({json:payload}); resolve(); });
                });
            }
            return route.fulfill({status:shared.readFailure ? 503 : 200, json:shared.readFailure ? {message:'Offline'} : payload});
        }
        if (url.pathname === '/service/api/site-theme/schools' && request.method()==='GET') {
            return route.fulfill({json:schoolRows()});
        }
        if (url.pathname === '/service/api/site-theme/ieltsroom' || url.pathname === '/service/api/site-theme/schools') {
            calls.push({method:request.method(), path:url.pathname, body:request.postDataJSON()});
            const reply = () => {
                if (!options.admin) return route.fulfill({status:403, json:{message:'Forbidden'}});
                if (shared.saveFailure) return route.fulfill({status:503, json:{message:'Không lưu được giao diện.'}});
                const payload=request.postDataJSON();
                const ids=payload.schoolIds||[1];
                shared.schoolThemes=shared.schoolThemes||{};
                for(const id of ids) { if(id===1)shared.theme=payload.theme;else shared.schoolThemes[id]=payload.theme; }
                return route.fulfill({json:url.pathname.endsWith('/schools')?schoolRows().filter(row=>ids.includes(row.schoolId)):{theme:shared.theme}});
            };
            if (shared.holdSave) return new Promise(resolve => {
                shared.pendingSaves = shared.pendingSaves || [];
                shared.pendingSaves.push(async () => { await reply(); resolve(); });
            });
            return reply();
        }
        if (/\/troop(?:-1)?\.jpg$/.test(url.pathname)) return route.fulfill({contentType:'image/jpeg', body:fs.readFileSync(path.join(app, 'assets/images', url.pathname.endsWith('troop-1.jpg') ? 'troop-1.jpg' : 'troop.jpg'))});
        if (/fontawesome-webfont\.woff2/.test(url.pathname)) return route.fulfill({contentType:'font/woff2', body:fs.readFileSync(path.join(app, 'assets/fonts/fontawesome-webfont.woff2'))});
        if (/^\/assets\/images\/(halloween|christmas)\//.test(url.pathname)) {
            const asset = path.join(app, url.pathname.slice(1));
            if (fs.existsSync(asset)) return route.fulfill({contentType:'image/svg+xml', body:fs.readFileSync(asset)});
        }
        return route.fulfill({contentType:'text/html', body:'<!doctype html><html><body></body></html>'});
    });
    await page.goto('https://' + hostname + '/dashboard');
    const content = await page.evaluate(({header, publicHeader, dashboard, guest}) => {
        const parse = html => new DOMParser().parseFromString(html, 'text/html');
        const nav = parse(guest ? publicHeader : header).querySelector('nav');
        const source = parse(dashboard);
        const hero = source.querySelector('.learning-hub-hero');
        const menu = source.querySelector('.learning-hub-menu').cloneNode(false);
        source.querySelectorAll('.learning-tile-wrap').forEach((tile, index) => { if (index < 4) menu.append(tile); });
        const hub = source.querySelector('.learning-hub-page').cloneNode(false);
        hub.append(hero, menu);
        const reader = document.createElement('section');
        reader.className = 'idp-reading-page idp-contrast-black-white';
        reader.innerHTML = '<div class="idp-exam-topbar"><strong>IELTS Listening</strong></div><div class="idp-workspace"><div class="question-content" style="height:160px;min-height:0"><p>Questions 1–10. Complete the answers.</p><input class="form-control" aria-label="Answer 1"><span class="text-success">Correct answer</span><span class="text-danger">Incorrect answer</span></div></div><div class="idp-question-nav"><div class="idp-question-nav-inner"><button class="idp-part-question-button is-current">1</button></div></div>';
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper ' + (guest ? 'public-shell' : 'application-shell');
        wrapper.innerHTML = '<div class="page-wrapper-row"><div class="page-wrapper-top"><div class="page-header" ng-controller="HeaderController"></div></div></div><div class="page-wrapper-row full-height"><div class="page-wrapper-middle"><div class="page-container"><div class="page-content"><div class="container"><main id="qa-main"></main></div></div></div></div></div>';
        wrapper.querySelector('.page-header').append(nav);
        wrapper.querySelector('#qa-main').append(hub, reader);
        return wrapper.outerHTML;
    }, {header, publicHeader, dashboard, guest:!!options.guest});
    // Inline test CSS resolves relative URLs against the document instead of
    // assets/css, so keep the production image URLs pointing at their real files.
    const halloweenCss = (read('assets/css/ieltsroom-halloween.css') + read('assets/css/ieltsroom-christmas.css')).replace(/\.\.\/images\//g, '/assets/images/');
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + styles + read('assets/css/site-theme-control.css') + '</style><style id="site-theme-style">' + halloweenCss + '</style></head><body class="page-container-bg-solid">' + content + '</body></html>');
    await page.evaluate(() => {
        window.qaHidden = false;
        Object.defineProperty(document, 'hidden', {configurable:true, get:() => window.qaHidden});
        window.qaIntervals = new Map();
        const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
        window.setInterval = (callback, delay, ...args) => {
            const id = interval(callback, delay, ...args);
            if (delay === 15000) qaIntervals.set(id, () => callback(...args));
            return id;
        };
        window.clearInterval = id => { qaIntervals.delete(id); return clear(id); };
        window.qaPoll = () => [...qaIntervals.values()].forEach(callback => callback());
    });
    for (const name of ['jquery.min.js', 'bootstrap.min.js', 'angular.min.js', 'ui-bootstrap-tpls.min.js']) await page.addScriptTag({path:path.join(app, 'assets/scripts/external/' + name)});
    await page.evaluate(({admin, guest, dark}) => {
        window.Hrm = angular.module('Hrm', ['ui.bootstrap']).value('$state', {});
        window.Layout = {initContent() {}};
        window.qaSettings = {api:{baseUrl:'/service/'}, permissionsLoaded:true, isAdmin:admin, isViewer:!guest, ieltsRoom:true, chapter:false};
        Hrm.value('settings', qaSettings).run(['$rootScope', root => {
            root.settings = qaSettings;
            root.$settings = qaSettings;
            root.currentUser = guest ? null : {id:admin ? 1 : 2, username:admin ? 'admin' : 'learner', displayName:'Tablet learner', person:{firstName:'Learner'}};
            root.canManageOwnProfile = () => true;
            root.$state = {current:{name:'application.dashboard'}, includes:() => false};
            root.vm = {permissionsLoaded:true, resumeDrafts:[], assignedTasks:[], user:{}, isRoleView:true,
                getUserVocabularyLevel:() => 1, getUserVocabularyProgressPercent:() => 20, hasRole:() => false};
        }]);
        document.documentElement.classList.toggle('global-dark-mode', dark);
    }, {admin:!!options.admin, guest:!!options.guest, dark:!!options.dark});
    await page.addScriptTag({path:path.join(app, 'application.controllers.js')});
    await page.addScriptTag({path:path.join(app, 'common/utils/site-theme.js')});
    await page.evaluate(() => {
        angular.bootstrap(document.body, ['Hrm']);
        window.siteTheme = angular.element(document.body).injector().get('SiteTheme');
        window.qaScope = angular.element(document.body).scope();
    });
    return {page, context, calls, errors};
}

async function isHalloween(page) { return page.evaluate(() => document.documentElement.classList.contains('ieltsroom-halloween')); }

async function loaded(page) { await page.waitForFunction(() => window.siteTheme && siteTheme.state.loaded); }
async function poll(page) { await page.evaluate(() => qaPoll()); }
async function choose(page, theme) {
    await page.locator('.site-theme-open').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="siteThemeChoice"][value="' + theme + '"]').check();
    await dialog.locator('.site-theme-option.is-selected input[value="' + theme + '"]').waitFor({state:'attached'});
    return dialog;
}

test('Christmas is an opt-in shared admin choice and switching off restores Normal exactly', async () => {
    const shared = {theme:'NORMAL'};
    const admin = await open(shared, {admin:true});
    const guest = await open(shared, {guest:true});
    const learner = await open(shared);
    try {
        for (const fixture of [admin,guest,learner]) await loaded(fixture.page);
        const paint = () => admin.page.evaluate(async () => {
            await new Promise(requestAnimationFrame);
            await Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(()=>{})));
            return ['.learning-login-nav','.learning-hub-hero','.learning-tile-daily'].map(selector => {
            const css = getComputedStyle(document.querySelector(selector));
            return [css.backgroundImage,css.backgroundColor,css.color];
            });
        });
        const normal = await paint();
        const dialog = await choose(admin.page, 'CHRISTMAS');
        assert.equal(await admin.page.locator('.christmas-snow').count(),0,'unsaved choice has no effects');
        assert.equal(shared.theme,'NORMAL');
        await dialog.getByRole('button',{name:'Lưu áp dụng',exact:true}).click();
        await admin.page.waitForFunction(() => siteTheme.state.theme === 'CHRISTMAS' && !siteTheme.state.saving);
        for (const fixture of [guest,learner]) {
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'CHRISTMAS');
            assert.equal(await fixture.page.locator('.christmas-snow').count(),1);
            assert.equal(await fixture.page.locator('.site-theme-open').count(),0);
        }
        const fresh = await open(shared,{guest:true});
        try { await loaded(fresh.page); assert.equal(await fresh.page.locator('.christmas-snow i').count(),10); }
        finally { await fresh.context.close(); }
        await admin.page.locator('.site-theme-open').click();
        assert.match(await admin.page.locator('.site-theme-current').innerText(),/Christmas/);
        await admin.page.getByRole('button',{name:'Hủy',exact:true}).click();
        await admin.page.evaluate(() => siteTheme.save('HALLOWEEN'));
        assert.equal(await admin.page.locator('html.ieltsroom-christmas').count(),0);
        assert.equal(await admin.page.locator('.christmas-snow').count(),0);
        await admin.page.evaluate(() => siteTheme.save('NORMAL'));
        await admin.page.waitForFunction(normal => JSON.stringify(['.learning-login-nav','.learning-hub-hero','.learning-tile-daily'].map(selector=>{
            const css=getComputedStyle(document.querySelector(selector));
            return [css.backgroundImage,css.backgroundColor,css.color];
        })) === JSON.stringify(normal),normal);
        assert.deepEqual(await paint(),normal,'Normal retains all original colors and artwork');
        for (const fixture of [guest,learner]) {
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL');
            assert.equal(await fixture.page.locator('.christmas-snow').count(),0);
        }
        for (const fixture of [admin,guest,learner]) assert.deepEqual(fixture.errors,[]);
    } finally { for (const fixture of [admin,guest,learner]) await fixture.context.close(); }
});

test('admin selects multiple School IDs and other domains update independently without changing the current school',async()=>{
    const shared={theme:'NORMAL'};
    const admin=await open(shared,{admin:true,dark:true,viewport:{width:820,height:1180}});
    const chapter=await open(shared,{hostname:'tnttphungkhoang.com',guest:true});
    const third=await open(shared,{hostname:'academy.example'});
    try {
        for(const fixture of [admin,chapter,third])await loaded(fixture.page);
        const dialog=await choose(admin.page,'CHRISTMAS');
        await dialog.locator('.site-theme-school-list label').first().waitFor();
        const schools=dialog.locator('.site-theme-school-list label');
        for(const item of await dialog.locator('.modal-header h2,.modal-header p').all()) {
            const colors=await item.evaluate(node=>({text:getComputedStyle(node).color,background:getComputedStyle(node.closest('.modal-header')).backgroundColor}));
            assert.ok(contrast(colors.text,colors.background)>=4.5,'dialog headings stay readable with dark preference');
        }
        for(const item of await dialog.locator('.site-theme-school-list strong,.site-theme-school-list small,.site-theme-option strong').all()) {
            const color=await item.evaluate(node=>getComputedStyle(node).color);
            assert.ok(contrast(color,'rgb(255,255,255)')>=4.5,'school and theme labels stay readable with dark preference');
        }
        await schools.filter({hasText:'IELTS Room'}).getByRole('checkbox').uncheck();
        await schools.filter({hasText:'TNTT Phùng Khoang'}).getByRole('checkbox').check();
        await schools.filter({hasText:'New school'}).getByRole('checkbox').check();
        assert.equal(await admin.page.locator('.christmas-snow').count(),0,'checkboxes are a draft');
        await dialog.getByRole('button',{name:'Lưu áp dụng',exact:true}).click();
        await admin.page.waitForFunction(()=>!siteTheme.state.saving);
        const saved=admin.calls.filter(call=>call.method==='PUT').at(-1).body;
        assert.deepEqual(saved,{theme:'CHRISTMAS',schoolIds:[2,3]});
        assert.equal(shared.theme,'NORMAL');
        assert.equal(await admin.page.locator('.christmas-snow').count(),0,'unselected current school remains Normal');
        for(const fixture of [chapter,third]) {
            await poll(fixture.page);await fixture.page.waitForFunction(()=>siteTheme.state.theme==='CHRISTMAS');
            assert.equal(await fixture.page.locator('.christmas-snow').count(),1);
        }
        await admin.page.locator('.site-theme-open').click();
        await admin.page.getByRole('button',{name:'Bỏ chọn',exact:true}).click();
        assert.equal(await admin.page.getByRole('button',{name:'Lưu áp dụng',exact:true}).isEnabled(),false,'empty scope cannot save');
        if(process.env.SITE_THEME_SCREENSHOT_DIR)await admin.page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,'christmas-school-config.png')});
        await admin.page.getByRole('button',{name:'Hủy',exact:true}).click();
        const off=await choose(admin.page,'NORMAL');
        await off.getByRole('button',{name:'Chọn tất cả',exact:true}).click();
        await off.getByRole('button',{name:'Lưu áp dụng',exact:true}).click();
        await admin.page.waitForFunction(()=>!siteTheme.state.saving);
        for(const fixture of [chapter,third]){await poll(fixture.page);await fixture.page.waitForFunction(()=>siteTheme.state.theme==='NORMAL');assert.equal(await fixture.page.locator('.christmas-snow').count(),0);}
        for(const fixture of [admin,chapter,third])assert.deepEqual(fixture.errors,[]);
    } finally{for(const fixture of [admin,chapter,third])await fixture.context.close();}
});

test('a rolling backend deployment keeps the older IELTS endpoint usable',async()=>{
    const shared={theme:'NORMAL',legacy:true};
    const fixture=await open(shared,{admin:true});
    try {
        await loaded(fixture.page);
        assert.equal(await fixture.page.evaluate(()=>siteTheme.state.legacy),true);
        const dialog=await choose(fixture.page,'CHRISTMAS');
        await dialog.getByRole('button',{name:'Lưu áp dụng',exact:true}).click();
        await fixture.page.waitForFunction(()=>siteTheme.state.theme==='CHRISTMAS'&&!siteTheme.state.saving);
        assert.equal(shared.theme,'CHRISTMAS');
        assert.equal(fixture.calls.filter(call=>call.method==='PUT').at(-1).path,'/service/api/site-theme/ieltsroom');
        assert.deepEqual(fixture.errors,[]);
    }finally{await fixture.context.close();}
});

test('Christmas decorations stay light, non-interactive and bounded on phones, iPad and desktop', async () => {
    for (const guest of [false,true]) {
        const shared = {theme:'CHRISTMAS'};
        const fixture = await open(shared,{admin:!guest,guest,motion:'no-preference'});
        const page = fixture.page;
        try {
            await loaded(page);
            for (const width of [320,390,820,1180]) {
                await page.setViewportSize({width,height:820});
                const info = await page.evaluate(() => {
                    const snow = document.querySelector('.christmas-snow');
                    const nav = document.querySelector('nav');
                    const hero = document.querySelector('.learning-hub-hero');
                    return {scroll:document.documentElement.scrollWidth,width:innerWidth,
                        visible:[...snow.children].filter(node => getComputedStyle(node).display !== 'none').length,
                        filters:[...snow.children].map(node => [getComputedStyle(node).filter,getComputedStyle(node).backdropFilter || 'none']),
                        pointer:getComputedStyle(snow).pointerEvents,
                        lights:getComputedStyle(nav,'::after').backgroundImage,
                        lightsWidth:parseFloat(getComputedStyle(nav,'::after').width),
                        hero:getComputedStyle(hero).backgroundImage};
                });
                assert.ok(info.scroll<=width+1,'no horizontal overflow at '+width);
                assert.equal(info.visible,width<768?6:10);
                assert.equal(info.pointer,'none');
                assert.ok(info.filters.every(pair=>pair.every(value=>value==='none')),'flakes have no blur or backdrop sampling');
                assert.match(info.lights,/christmas\/lights.svg/);
                assert.ok(info.lightsWidth>width*.8,'garland spans the header instead of collapsing with the Bootstrap clearfix');
                assert.match(info.hero,/christmas\/winter-village.svg/);
                const control = page.locator(width<768?'.navbar-toggle':guest?'.learning-desktop-login .learning-public-theme-toggle':'.user-dropdown-mobile > a');
                assert.equal(await control.evaluate(node=>{
                    const r=node.getBoundingClientRect();
                    return node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
                }),true,'snow and garland never cover header controls: '+JSON.stringify({guest,width}));
                if (process.env.SITE_THEME_SCREENSHOT_DIR && [390,1180].includes(width) && !guest) {
                    fs.mkdirSync(process.env.SITE_THEME_SCREENSHOT_DIR,{recursive:true});
                    await page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,'christmas-'+width+'.png')});
                }
            }
            await poll(page); await poll(page);
            assert.equal(await page.locator('.christmas-snow').count(),1,'polling does not duplicate decorations');
            await page.evaluate(()=>{qaHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
            assert.equal(await page.locator('.christmas-snow i').first().evaluate(node=>getComputedStyle(node).animationPlayState),'paused');
            await page.evaluate(()=>{qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
            assert.equal(await page.locator('.christmas-snow i').first().evaluate(node=>getComputedStyle(node).animationPlayState),'running');
            await page.evaluate(()=>qaScope.$broadcast('$stateChangeSuccess',{name:'application.ielts_listening_actual_test'}));
            assert.equal(await page.locator('.christmas-snow').isVisible(),false,'exam hides falling flakes');
            await page.evaluate(()=>qaScope.$broadcast('$stateChangeSuccess',{name:'application.dashboard'}));
            await page.emulateMedia({reducedMotion:'reduce'});
            assert.equal(await page.locator('.christmas-snow').isVisible(),false);
            assert.equal(await page.locator('nav').evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
            await page.emulateMedia({reducedMotion:'no-preference'});
            if (!guest) {
                await page.locator('.site-theme-open').click();
                assert.equal(await page.locator('.christmas-snow').isVisible(),false,'snow stays below and pauses for modals');
                const dialog=page.getByRole('dialog');
                assert.equal(await dialog.locator('input[name="siteThemeChoice"]').count(),3);
                const box=await dialog.boundingBox();
                assert.ok(box.x>=0 && box.x+box.width<=1181);
                await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
            }
            await page.evaluate(()=>siteTheme.stop());
            assert.equal(await page.locator('.christmas-snow').count(),0,'stop cleans all effects');
            assert.deepEqual(fixture.errors,[]);
        } finally { await fixture.context.close(); }
    }
    const excluded=await open({theme:'CHRISTMAS'},{hostname:'unregistered-school.example',admin:true});
    try {
        assert.equal(await excluded.page.locator('.christmas-snow').count(),0);
        assert.equal(await excluded.page.locator('html.ieltsroom-christmas').count(),0);
        assert.equal(excluded.calls.filter(call=>call.method==='PUT').length,0);
    } finally { await excluded.context.close(); }
});

test('Halloween header surroundings reveal the page background and Normal restores the original shell', async () => {
    for (const guest of [false,true]) for (const dark of [false,true]) {
        const shared = {theme:'NORMAL'};
        const fixture = await open(shared, {admin:!guest,guest,dark,viewport:{width:1920,height:1080}});
        try {
            await loaded(fixture.page);
            const background = () => fixture.page.evaluate(async () => {
                await new Promise(requestAnimationFrame);
                const header = document.querySelector('.page-wrapper-top > .page-header');
                await Promise.all(header.getAnimations().map(animation => animation.finished.catch(() => {})));
                return [null,'::before','::after'].map(pseudo => {
                    const css = getComputedStyle(header,pseudo);
                    return {color:css.backgroundColor,image:css.backgroundImage};
                });
            });
            const original = await background();
            shared.theme = 'HALLOWEEN';
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'HALLOWEEN');
            for (const width of [1920,820,390]) {
                await fixture.page.setViewportSize({width,height:1080});
                const detail = JSON.stringify({guest,dark,width});
                assert.deepEqual(await background(), Array(3).fill({color:'rgba(0, 0, 0, 0)',image:'none'}),
                    'header margins expose the Halloween page instead of a white or personal dark strip: ' + detail);
                if (process.env.SITE_THEME_SCREENSHOT_DIR && width === 1920 && !guest && !dark) {
                    fs.mkdirSync(process.env.SITE_THEME_SCREENSHOT_DIR, {recursive:true});
                    await fixture.page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,'halloween-header-background.png')});
                }
            }
            await fixture.page.setViewportSize({width:1920,height:1080});
            shared.theme = 'NORMAL';
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL');
            assert.deepEqual(await background(), original, 'Normal restores the original header shell: ' + JSON.stringify({guest,dark}));
            assert.deepEqual(fixture.errors, []);
        } finally { await fixture.context.close(); }
    }
});

test('admin header controls stay vertically aligned on desktop and tablets in both shared themes', async () => {
    const fixture = await open({theme:'HALLOWEEN'}, {admin:true, viewport:{width:1920,height:1080}});
    try {
        await loaded(fixture.page);
        await fixture.page.evaluate(() => qaScope.$apply(() => {
            qaScope.currentUser.username = 'long.tablet.account';
            qaScope.currentUser.person = {lastName:'EM YÊU INH LÍCH', firstName:'NGƯỜI DÙNG THỬ NGHIỆM'};
        }));
        for (const variant of [{theme:'HALLOWEEN',dark:false}, {theme:'NORMAL',dark:false}, {theme:'NORMAL',dark:true}]) {
            await fixture.page.evaluate(async variant => {
                document.documentElement.classList.toggle('global-dark-mode', variant.dark);
                if (siteTheme.state.theme !== variant.theme) await siteTheme.save(variant.theme);
            }, variant);
            for (const width of [1920,1440,1366,1180,820,768]) {
                await fixture.page.setViewportSize({width,height:1080});
                await fixture.page.evaluate(() => new Promise(requestAnimationFrame));
                const geometry = await fixture.page.evaluate(() => {
                    const rect = node => {
                        const r = node.getBoundingClientRect();
                        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,center:r.top + r.height / 2};
                    };
                    const nav = document.querySelector('.learning-login-nav');
                    const main = [...nav.querySelectorAll('.navbar-nav:not(.navbar-right) > li > a')]
                        .filter(node => node.getClientRects().length).map(rect);
                    return {brand:rect(nav.querySelector('.learning-nav-brand')), nav:rect(nav),
                        themeControl:rect(nav.querySelector('.site-theme-open')), account:rect(nav.querySelector('.user-dropdown-mobile > a')),
                        main, width:innerWidth, scrollWidth:document.documentElement.scrollWidth};
                });
                const detail = JSON.stringify({width,...variant,...geometry});
                assert.ok(Math.abs(geometry.themeControl.center - geometry.account.center) <= 1,
                    'theme and account controls share a vertical center: ' + detail);
                assert.ok(Math.abs(geometry.themeControl.height - geometry.account.height) <= 1,
                    'theme and account controls share the same height: ' + detail);
                if (width >= 1440) {
                    for (const item of [...geometry.main,geometry.brand]) {
                        assert.ok(Math.abs(item.center - geometry.account.center) <= 1,
                            'single-row desktop logo and menu align with account actions: ' + detail);
                    }
                }
                assert.ok(geometry.scrollWidth <= width + 1, 'header never widens the page: ' + detail);
                for (const item of [geometry.themeControl,geometry.account,...geometry.main]) {
                    assert.ok(item.left >= geometry.nav.left && item.right <= geometry.nav.right + 1 &&
                        item.top >= geometry.nav.top && item.bottom <= geometry.nav.bottom + 1,
                    'all controls remain inside the navbar: ' + detail);
                }
                for (let i = 0; i < geometry.main.length; i++) {
                    const items = [geometry.themeControl,geometry.account,...geometry.main.slice(i + 1)];
                    for (const other of items) {
                        const item = geometry.main[i];
                        assert.ok(Math.min(item.right,other.right) - Math.max(item.left,other.left) <= 1 ||
                            Math.min(item.bottom,other.bottom) - Math.max(item.top,other.top) <= 1,
                        'navigation controls never overlap: ' + detail);
                    }
                }
                assert.ok(geometry.themeControl.right <= geometry.account.left + 1 || geometry.themeControl.bottom <= geometry.account.top + 1,
                    'theme and account controls never overlap: ' + detail);
                if (process.env.SITE_THEME_SCREENSHOT_DIR && [1920,1180].includes(width) && variant.theme === 'HALLOWEEN') {
                    fs.mkdirSync(process.env.SITE_THEME_SCREENSHOT_DIR, {recursive:true});
                    await fixture.page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,
                        width === 1920 ? 'header-aligned-desktop.png' : 'header-aligned-ipad.png')});
                }
                const account = fixture.page.locator('.user-dropdown-mobile > a');
                await account.click();
                const menu = fixture.page.locator('.user-dropdown-mobile > .dropdown-menu');
                await menu.waitFor({state:'visible'});
                assert.equal(await menu.locator('a[data-ng-click="logout()"]').evaluate(node => {
                    const r = node.getBoundingClientRect();
                    return node.contains(document.elementFromPoint(r.left + r.width / 2,r.top + r.height / 2));
                }), true, 'account menu stays reachable after the alignment change: ' + detail);
                await account.click();
                await menu.waitFor({state:'hidden'});
            }
        }
        assert.deepEqual(fixture.errors, []);
    } finally { await fixture.context.close(); }
});

test('only registered school domains and their www aliases enable editing; unknown hosts stay Normal', async () => {
    const shared = {theme:'HALLOWEEN'};
    for (const hostname of ['ieltsroom.com', 'www.ieltsroom.com', 'localhost', 'tnttphungkhoang.com', 'sub.ieltsroom.com', 'ieltsroom.com.evil.test', 'richywine.com']) {
        const fixture = await open(shared, {hostname, admin:true});
        try {
            const allowed = /^(www\.)?(ieltsroom|tnttphungkhoang)\.com$/.test(hostname);
            await loaded(fixture.page);
            assert.equal(await fixture.page.evaluate(() => siteTheme.enabled()), allowed, hostname);
            assert.equal(await isHalloween(fixture.page), /^(www\.)?ieltsroom\.com$/.test(hostname), hostname);
            assert.equal(await fixture.page.locator('.site-theme-open').count(), allowed ? 1 : 0, hostname);
            if (!allowed) {
                const result = await fixture.page.evaluate(() => siteTheme.save('NORMAL').then(() => 'saved', () => 'blocked'));
                assert.equal(result, 'blocked', hostname);
                assert.equal(fixture.calls.filter(call=>call.method==='PUT').length, 0, 'unknown domain never writes a school theme: ' + hostname);
            }
            assert.deepEqual(fixture.errors, []);
        } finally { await fixture.context.close(); }
    }
});

test('admin saves one shared choice and independent learner, guest and fresh sessions receive it', async () => {
    const shared = {theme:'HALLOWEEN'};
    const admin = await open(shared, {admin:true});
    const learner = await open(shared);
    const guest = await open(shared, {guest:true});
    try {
        for (const fixture of [admin, learner, guest]) { await loaded(fixture.page); assert.equal(await isHalloween(fixture.page), true); }
        assert.equal(await learner.page.locator('.site-theme-open').count(), 0);
        assert.equal(await guest.page.locator('.site-theme-open').count(), 0);
        assert.equal(await learner.page.evaluate(() => siteTheme.save('NORMAL').then(() => 'saved', () => 'blocked')), 'blocked');
        assert.equal(learner.calls.filter(call => call.method === 'PUT').length, 0, 'learner cannot issue an administrative update');
        const dialog = await choose(admin.page, 'NORMAL');
        assert.equal(await isHalloween(admin.page), true, 'an unsaved radio choice does not change the active theme');
        await dialog.getByRole('button', {name:'Lưu áp dụng', exact:true}).click();
        await admin.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL' && !siteTheme.state.saving);
        assert.equal(shared.theme, 'NORMAL');
        assert.equal(await isHalloween(admin.page), false);
        for (const fixture of [learner, guest]) {
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL');
            assert.equal(await isHalloween(fixture.page), false, 'other users receive server state without sharing browser storage');
        }
        const fresh = await open(shared, {guest:true});
        try { await loaded(fresh.page); assert.equal(await isHalloween(fresh.page), false, 'new sessions use the saved shared choice'); }
        finally { await fresh.context.close(); }
        const next = await choose(admin.page, 'HALLOWEEN');
        await next.getByRole('button', {name:'Lưu áp dụng', exact:true}).click();
        await admin.page.waitForFunction(() => siteTheme.state.theme === 'HALLOWEEN' && !siteTheme.state.saving);
        for (const fixture of [learner, guest]) {
            await poll(fixture.page);
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'HALLOWEEN');
            assert.equal(await isHalloween(fixture.page), true);
        }
        for (const fixture of [admin, learner, guest]) assert.deepEqual(fixture.errors, []);
    } finally { for (const fixture of [admin, learner, guest]) await fixture.context.close(); }
});

test('failed saves remain visible and retain the active theme; stale reads cannot overwrite a successful save', async () => {
    const shared = {theme:'HALLOWEEN'};
    const fixture = await open(shared, {admin:true});
    try {
        await loaded(fixture.page);
        shared.saveFailure = true;
        shared.holdSave = true;
        const dialog = await choose(fixture.page, 'NORMAL');
        await dialog.getByRole('button', {name:'Lưu áp dụng', exact:true}).click();
        await fixture.page.waitForFunction(() => siteTheme.state.saving);
        await fixture.page.keyboard.press('Escape');
        assert.equal(await dialog.isVisible(), true, 'Escape cannot dismiss an in-flight shared update');
        shared.holdSave = false;
        await shared.pendingSaves.shift()();
        await fixture.page.waitForFunction(() => !siteTheme.state.saving && !!siteTheme.state.error);
        assert.equal(await dialog.isVisible(), true);
        assert.equal(await isHalloween(fixture.page), true);
        assert.equal(shared.theme, 'HALLOWEEN');
        assert.ok(await dialog.getByRole('alert').innerText());
        shared.saveFailure = false;
        shared.holdRead = true;
        await fixture.page.evaluate(() => { siteTheme.refresh(); });
        for (let index = 0; index < 30 && !shared.pendingReads?.length; index++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(shared.pendingReads.length, 1);
        await dialog.getByRole('button', {name:'Lưu áp dụng', exact:true}).click();
        await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL' && !siteTheme.state.saving);
        shared.holdRead = false;
        await shared.pendingReads.shift()();
        await fixture.page.waitForTimeout(50);
        assert.equal(await isHalloween(fixture.page), false, 'the old Halloween response cannot undo the later saved Normal choice');
        assert.equal(await fixture.page.evaluate(() => siteTheme.state.theme), 'NORMAL');
        assert.deepEqual(fixture.errors, []);
    } finally { await fixture.context.close(); }
});

test('a slow open-time refresh does not overwrite an unsaved admin radio choice', async () => {
    const shared = {theme:'HALLOWEEN'};
    const fixture = await open(shared, {admin:true});
    try {
        await loaded(fixture.page);
        shared.holdRead = true;
        const dialog = await choose(fixture.page, 'NORMAL');
        for (let index = 0; index < 30 && !shared.pendingReads?.length; index++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(shared.pendingReads.length, 1);
        shared.holdRead = false;
        await shared.pendingReads.shift()();
        await fixture.page.waitForTimeout(50);
        assert.equal(await dialog.locator('input[value="NORMAL"]').isChecked(), true, 'a delayed server refresh cannot replace the option the admin just chose');
        assert.equal(await isHalloween(fixture.page), true, 'the original shared theme remains active until saving');
        assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 0);
        assert.deepEqual(fixture.errors, []);
    } finally { await fixture.context.close(); }
});

test('hidden tabs skip polling, visibility resume refreshes shared state and stop releases polling/listeners', async () => {
    const shared = {theme:'HALLOWEEN'};
    const fixture = await open(shared);
    try {
        await loaded(fixture.page);
        const before = fixture.calls.length;
        await fixture.page.evaluate(() => { qaHidden = true; document.dispatchEvent(new Event('visibilitychange')); qaPoll(); });
        await fixture.page.waitForTimeout(50);
        assert.equal(fixture.calls.length, before, 'hidden tabs do not keep fetching');
        shared.theme = 'NORMAL';
        await fixture.page.evaluate(() => { qaHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
        await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL');
        assert.equal(await isHalloween(fixture.page), false);
        assert.ok(fixture.calls.length > before);
        shared.holdRead = true;
        await fixture.page.evaluate(() => { siteTheme.refresh(); });
        for (let index = 0; index < 30 && !shared.pendingReads?.length; index++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(shared.pendingReads.length, 1);
        shared.theme = 'HALLOWEEN';
        await fixture.page.evaluate(() => { siteTheme.stop(); siteTheme.start(); });
        for (let index = 0; index < 30 && shared.pendingReads.length < 2; index++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(shared.pendingReads.length, 2, 'restarting starts a fresh read even while the old request is still pending');
        await shared.pendingReads.pop()();
        await fixture.page.waitForFunction(() => siteTheme.state.theme === 'HALLOWEEN');
        shared.holdRead = false;
        await shared.pendingReads.shift()();
        await fixture.page.waitForTimeout(50);
        assert.equal(await isHalloween(fixture.page), true, 'a request from before stopping cannot overwrite the restarted service');
        await fixture.page.evaluate(() => { siteTheme.stop(); });
        const stopped = fixture.calls.length;
        await fixture.page.evaluate(() => {
            qaPoll(); dispatchEvent(new Event('focus')); dispatchEvent(new Event('online'));
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await fixture.page.waitForTimeout(50);
        assert.equal(fixture.calls.length, stopped, 'stopped service cannot receive refresh work from old listeners');
        assert.equal(await fixture.page.evaluate(() => qaIntervals.size), 0, 'the polling interval is released');
        assert.deepEqual(fixture.errors, []);
    } finally { await fixture.context.close(); }
});

function contrast(first, second) {
    const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            value /= 255;
            return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

async function appearance(page) {
    return page.evaluate(async () => {
        // A service response can update the root class before WebKit has painted
        // the new cascade; sample after the frame and any real color transitions.
        await new Promise(requestAnimationFrame);
        await Promise.all([...document.querySelectorAll('.learning-login-nav,.learning-hub-hero,.question-content,.question-content input')]
            .flatMap(node => node.getAnimations()).map(animation => animation.finished.catch(() => {})));
        const result = {};
        for (const [name, selector] of Object.entries({nav:'.learning-login-nav', hero:'.learning-hub-hero',
            passage:'.question-content', input:'.question-content input', correct:'.question-content .text-success', incorrect:'.question-content .text-danger'})) {
            const node = document.querySelector(selector), css = getComputedStyle(node);
            const text = name === 'passage' ? getComputedStyle(node.querySelector('p')) : css;
            result[name] = {color:text.color, background:css.backgroundColor, image:css.backgroundImage, border:css.borderColor};
        }
        return result;
    });
}

test('Halloween styles keep tablet/mobile headers and admin dialogs usable, with readable passages and a clean Normal restore', async () => {
    for (const viewport of [{width:390,height:844}, {width:820,height:1180}, {width:1180,height:820}]) {
        const fixture = await open({theme:'HALLOWEEN'}, {admin:true, viewport, dark:viewport.width === 820});
        try {
            await loaded(fixture.page);
            if (viewport.width < 768) {
                await fixture.page.locator('.navbar-toggle').click();
                await fixture.page.waitForFunction(() => document.querySelector('.navbar-collapse').classList.contains('in') && !document.querySelector('.navbar-collapse').classList.contains('collapsing'));
            }
            const layout = await fixture.page.evaluate(() => {
                const header = document.querySelector('.page-header').getBoundingClientRect();
                const nav = document.querySelector('.learning-login-nav').getBoundingClientRect();
                const main = document.querySelector('#qa-main').getBoundingClientRect();
                return {header:header.bottom, nav:nav.bottom, main:main.top, width:innerWidth, scroll:document.documentElement.scrollWidth};
            });
            assert.ok(layout.header >= layout.nav - 1 && layout.main >= layout.nav - 1, JSON.stringify(layout));
            assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout));
            const halloween = await appearance(fixture.page);
            assert.ok(contrast(halloween.passage.color, halloween.passage.background) >= 4.5, JSON.stringify({viewport, passage:halloween.passage, state:await fixture.page.evaluate(() => ({classes:document.documentElement.className, theme:siteTheme.state.theme}))}));
            const dialog = await choose(fixture.page, 'NORMAL');
            const modal = await dialog.boundingBox();
            assert.ok(modal.x >= 0 && modal.y >= 0 && modal.x + modal.width <= viewport.width + 1 && modal.y + modal.height <= viewport.height + 1, JSON.stringify({viewport, modal}));
            const save = dialog.getByRole('button', {name:'Lưu áp dụng', exact:true});
            assert.equal(await save.evaluate(node => {
                const bounds = node.getBoundingClientRect();
                return node.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
            }), true, 'Halloween decoration and navbar never cover the save action');
            if (process.env.SITE_THEME_SCREENSHOT_DIR && viewport.width === 1180) {
                fs.mkdirSync(process.env.SITE_THEME_SCREENSHOT_DIR, {recursive:true});
                await fixture.page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR, 'halloween-admin-tablet.png')});
            }
            await save.click();
            await fixture.page.waitForFunction(() => siteTheme.state.theme === 'NORMAL' && !siteTheme.state.saving);
            const normal = await appearance(fixture.page);
            assert.notDeepEqual(halloween.nav, normal.nav, 'Halloween recolors navigation');
            assert.notDeepEqual(halloween.hero, normal.hero, 'Halloween recolors the dashboard hero');
            await fixture.page.evaluate(() => { document.getElementById('site-theme-style').disabled = true; });
            assert.deepEqual(await appearance(fixture.page), normal, 'Normal has exactly the original site styles without Halloween overrides');
            if (viewport.width === 1180) {
                // Candidate CSS is loaded only for the candidate checks: this route
                // intentionally hides the normal site header while an exam is open.
                await fixture.page.addStyleTag({content:inlineStyles(exam)});
                await fixture.page.evaluate(() => { document.getElementById('site-theme-style').disabled = false; });
                for (const mode of ['white-black', 'yellow-black']) {
                    await fixture.page.evaluate(mode => {
                        document.querySelector('.idp-reading-page').className = 'idp-reading-page idp-contrast-' + mode;
                    }, mode);
                    const original = await appearance(fixture.page);
                    await fixture.page.evaluate(() => siteTheme.save('HALLOWEEN'));
                    const themed = await appearance(fixture.page);
                    assert.equal(themed.passage.background, original.passage.background, mode + ' retains its chosen exam background');
                    assert.equal(themed.passage.color, original.passage.color, mode + ' retains its chosen text color');
                    assert.equal(themed.input.background, themed.passage.background, mode + ' answer fields use the chosen dark exam surface');
                    assert.equal(themed.input.color, themed.passage.color, mode + ' answer fields use the chosen high contrast text');
                    assert.ok(contrast(themed.input.color, themed.input.background) >= 7, mode + ' answer fields remain readable');
                    await fixture.page.evaluate(() => siteTheme.save('NORMAL'));
                }
            }
            assert.deepEqual(fixture.errors, []);
        } finally { await fixture.context.close(); }
    }
});
