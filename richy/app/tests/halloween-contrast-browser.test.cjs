const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const inline = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const header = read('common/views/navs/header-hoz-for-login.html');
const listing = read('enrolment_class/views/listing.html');
const preview = listing.match(/<script type="text\/ng-template" id="class_image_preview_modal.html">([\s\S]*?)<\/script>/)[1];
const styles = ['external/bootstrap.min.css', 'external/font-awesome.min.css', 'components-md.min.css', 'plugins-md.min.css',
    'layout-hoz.min.css', 'default.min.css', 'custom.css', 'ui-layer-safety.css', 'ieltsroom-halloween.css']
    .map(file => read('assets/css/' + file)).join('\n') + inline(read('index.html')) + inline(header) + inline(listing);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async () => {
    const engine = process.env.CONTRAST_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true, ...(engine === 'chromium' ? {executablePath} : {})});
});
after(async () => { if (browser) await browser.close(); });

async function fixture(width, dark) {
    const page = await browser.newPage({viewport:{width, height:900}, hasTouch:true, reducedMotion:'reduce'});
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith('/troop.jpg')) return route.fulfill({contentType:'image/jpeg', body:fs.readFileSync(path.join(app, 'assets/images/troop.jpg'))});
        if (pathname.endsWith('/fontawesome-webfont.woff2')) return route.fulfill({contentType:'font/woff2', body:fs.readFileSync(path.join(app, 'assets/fonts/fontawesome-webfont.woff2'))});
        return route.fulfill({contentType:'text/html', body:'<!doctype html><html></html>'});
    });
    await page.goto('https://ieltsroom.test/login');
    await page.setContent('<!doctype html><html class="ieltsroom-halloween' + (dark ? ' global-dark-mode' : '') + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + styles +
        '</style><style>html * { transition:none !important; }</style></head><body><div class="page-wrapper public-shell"><div class="page-wrapper-top"><div class="page-header">' + header.match(/<nav\b[\s\S]*?<\/nav>/)[0] + '</div></div></div></body></html>');
    for (const file of ['jquery.min.js', 'bootstrap.min.js', 'angular.min.js', 'ui-bootstrap-tpls.min.js']) await page.addScriptTag({path:path.join(app, 'assets/scripts/external/' + file)});
    await page.evaluate(preview => {
        const app = angular.module('ContrastFixture', ['ui.bootstrap']);
        const image = document.createElement('canvas');
        image.width = 1200; image.height = 800;
        const drawing = image.getContext('2d');
        drawing.fillStyle = '#fff'; drawing.fillRect(0,0,1200,800);
        drawing.fillStyle = '#25324b'; drawing.font = 'bold 36px Arial'; drawing.fillText('TIẾN ĐỘ BÀI TẬP VỀ NHÀ',40,75);
        drawing.font = '24px Arial'; drawing.fillText('Lớp 9 · Bảng tiến độ Homework',40,125);
        app.run(['$rootScope', '$uibModal', (root, modal) => {
            root.settings = {ieltsRoom:true};
            root.vm = {user:{username:'',password:''}, login() { window.loginCalls = (window.loginCalls || 0) + 1; }};
            window.openPreview = () => modal.open({template:preview, windowClass:'class-image-preview-modal-window',
                controller:['$scope', scope => {
                    scope.vm = {imagePreview:{title:'Xem trước tiến độ Homework',description:'Kiểm tra nội dung và bảng tiến độ trước khi tải ảnh.',dataUrl:image.toDataURL(),width:1200,height:800,zoomPercent:35},
                        changeImagePreviewZoom(value) { this.imagePreview.zoomPercent += value; },
                        setImagePreviewZoom(value) { this.imagePreview.zoomPercent = value; }, downloadImagePreview() { window.downloadCalls = 1; }};
                }]});
        }]);
        angular.bootstrap(document.body, ['ContrastFixture']);
    }, preview);
    return page;
}

async function colors(locator, pseudo = null) {
    return locator.evaluate((node, pseudo) => {
        const css = getComputedStyle(node, pseudo);
        let surface = node;
        while (surface.parentElement && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
        const bg = getComputedStyle(surface);
        const opaqueStop = (bg.backgroundImage.match(/rgba?\([^)]*\)/g) || []).find(value => !value.startsWith('rgba'));
        return {color:css.color, fill:css.webkitTextFillColor, background:opaqueStop || bg.backgroundColor, fontSize:parseFloat(css.fontSize)};
    }, pseudo);
}
function contrast(a, b) {
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index], 0);
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

test('Halloween mobile login keeps typed text, password and placeholders readable at phone sizes', async () => {
    for (const width of [320,390]) for (const dark of [false,true]) {
        const page = await fixture(width,dark);
        try {
            const fields = page.locator('.learning-mobile-login input');
            await fields.nth(0).fill('student.phone');
            await fields.nth(1).fill('example-password');
            for (const field of await fields.all()) {
                const text = await colors(field), placeholder = await colors(field, '::placeholder');
                assert.ok(contrast(text.fill || text.color, text.background) >= 4.5, 'typed text on mobile: ' + JSON.stringify({width,dark,text}));
                assert.ok(contrast(placeholder.color, text.background) >= 4.5, 'placeholder on mobile: ' + JSON.stringify({width,dark,placeholder,text}));
                assert.ok(text.fontSize >= 16, 'phone fields have legible text and avoid input focus zoom');
                assert.ok((await field.boundingBox()).height >= 44);
            }
            const submit = page.locator('.for-media .learning-login-submit');
            const submitStyle = await colors(submit);
            assert.ok(submitStyle.fontSize >= 16, JSON.stringify({width,dark,submitStyle}));
            await submit.click();
            assert.equal(await page.evaluate(() => loginCalls), 1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            if (process.env.CONTRAST_SCREENSHOT_DIR && width === 390 && !dark) await page.screenshot({path:path.join(process.env.CONTRAST_SCREENSHOT_DIR,'mobile-login-readable.png'), clip:{x:0,y:0,width,height:330}});
        } finally { await page.close(); }
    }
});

test('Homework image preview header and controls remain readable in Halloween with or without dark preference', async () => {
    for (const width of [390,820,1440]) for (const dark of [false,true]) {
        const page = await fixture(width,dark);
        try {
            await page.evaluate(() => openPreview());
            const dialog = page.getByRole('dialog');
            await dialog.waitFor({state:'visible'});
            for (const selector of ['.class-image-preview-header small','.class-image-preview-header h4','.class-image-preview-header p',
                '.class-image-preview-header .close','.class-image-preview-size','.class-image-preview-toolbar output']) {
                const value = await colors(dialog.locator(selector));
                assert.ok(contrast(value.color, value.background) >= 4.5, selector + ': ' + JSON.stringify({width,dark,value}));
            }
            await dialog.getByRole('button', {name:'Phóng to', exact:true}).click();
            assert.equal(await dialog.locator('output').innerText(), '45%');
            const download = dialog.getByRole('button', {name:'Tải ảnh PNG'});
            await download.scrollIntoViewIfNeeded();
            assert.equal(await download.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), true);
            if (process.env.CONTRAST_SCREENSHOT_DIR && width === 1440 && !dark) await page.screenshot({path:path.join(process.env.CONTRAST_SCREENSHOT_DIR,'image-preview-readable.png')});
            await download.click();
            assert.equal(await page.evaluate(() => downloadCalls), 1);
        } finally { await page.close(); }
    }
});
