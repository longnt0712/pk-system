const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const css = ['assets/css/external/bootstrap.min.css', 'assets/css/components-md.min.css',
    'assets/css/layout-hoz.min.css', 'assets/css/default.min.css', 'assets/css/custom.css', 'assets/css/test-builder.css',
    'assets/css/learning-pet.css', 'assets/css/learning-pet-evolution.css', 'assets/css/ui-layer-safety.css'].map(read).join('\n');
const lateFooter = Array.from(read('common/views/navs/footer-hoz.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), m => m[1]).join('\n');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async () => { browser = await playwright.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})}); });
after(async () => { if (browser) await browser.close(); });

async function open(width, height, withBar = true) {
    const page = await browser.newPage({viewport: {width, height}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://floating-ui.test/**', route => route.fulfill(route.request().resourceType() === 'document'
        ? {contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}
        : {contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="104"><rect width="96" height="104" rx="35" fill="#ffbd36"/></svg>'}));
    await page.goto('http://floating-ui.test/');
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
        body{margin:0;overflow:auto}.page-header{height:70px;margin:0;background:#fafaff}.ielts-reading-builder-page{margin:0;padding-left:20px;padding-right:20px}
        .fixture-space{height:1400px}#last-field{display:block;width:100%;height:44px}#library-cta{position:fixed;right:20px;bottom:18px;width:160px;height:44px}
        .fixture-modal{position:fixed;inset:0;z-index:1050;display:flex;align-items:flex-end;justify-content:flex-end;padding:20px}
        .fixture-modal .modal-content{width:400px;padding:20px}.fixture-backdrop{position:fixed;inset:0;background:#0008;z-index:1040}
        </style></head><body floating-ui-layout><header class="page-header">Header</header>
        <main class="ielts-reading-builder-page"><div class="fixture-space"></div><button id="last-field">Last field</button></main>
        ${withBar ? `<div class="reading-builder-actionbar"><div>0 câu · còn 3 mục cần sửa</div><div>${['Xuất Word','Preview đề','Kiểm tra','Lưu nháp','Xuất bản'].map(text => `<button class="btn btn-default">${text}</button>`).join('')}</div></div>` : '<button id="library-cta">Học bài</button>'}
        ${read('common/views/learning-pet.html')}
        <div class="scroll-to-top student-scroll-top" role="button" tabindex="0">↑</div><style>${lateFooter}</style></body></html>`);
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(() => {
        angular.module('Hrm', []).run(['$rootScope', function (scope) {
            window.fixtureScope = scope;
            scope.pet = {visible: true, petForm: 'egg-intact', petImage: '/egg.png', panelOpen: false,
                minimized: false, notificationCount: 0, message: 'No pending work', tasks: [], drafts: [], availablePets: [],
                toggleMinimized() { this.minimized = !this.minimized; }, togglePanel() { this.panelOpen = !this.panelOpen; }};
        }]);
    });
    await page.addScriptTag({path: path.join(app, 'common/utils/floating-ui-layout.js')});
    await page.evaluate(() => angular.bootstrap(document.body, ['Hrm']));
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--builder-actionbar-height') !== '');
    await page.waitForFunction(() => [...document.querySelectorAll('.learning-pet-shell img')].every(img => img.complete));
    return {page, errors};
}

for (const [width, height] of [[390,844],[768,1024],[1180,820],[1920,1080]]) {
    test(`wrapped actionbar reserves the last field and clears scroll-to-top at ${width}x${height}`, async () => {
        const {page, errors} = await open(width, height);
        try {
            await page.locator('#last-field').scrollIntoViewIfNeeded();
            const metrics = await page.evaluate(() => {
                const bar = document.querySelector('.reading-builder-actionbar').getBoundingClientRect();
                const last = document.querySelector('#last-field').getBoundingClientRect();
                const top = document.querySelector('.student-scroll-top').getBoundingClientRect();
                return {documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
                    fieldBottom: last.bottom, barTop: bar.top, topBottom: top.bottom,
                    barHeight: bar.height, measuredHeight: parseFloat(document.documentElement.style.getPropertyValue('--builder-actionbar-height')),
                    buttons: [...document.querySelectorAll('.reading-builder-actionbar button')].map(button => {
                        const r = button.getBoundingClientRect();
                        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
                    })};
            });
            assert.ok(metrics.documentWidth <= width + 1, JSON.stringify(metrics));
            assert.ok(metrics.fieldBottom < metrics.barTop, JSON.stringify(metrics));
            assert.ok(metrics.topBottom < metrics.barTop, 'late footer style cannot put scroll-to-top over toolbar');
            assert.ok(Math.abs(metrics.measuredHeight - metrics.barHeight) <= 1);
            for (const button of metrics.buttons) {
                assert.ok(button.left >= 0 && button.right <= width && button.top >= 0 && button.bottom <= height);
            }
            await page.evaluate(() => document.querySelector('.reading-builder-actionbar').remove());
            await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--builder-actionbar-height') === '0px');
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('pet keeps its default and manually placed anchor through scrolling and changing page controls', async () => {
    const {page, errors} = await open(768, 1024, false);
    try {
        const anchor = await page.locator('.learning-pet-shell').evaluate(el => {
            const rect = el.getBoundingClientRect(); return {left: rect.left, top: rect.top};
        });
        assert.equal(await page.locator('.learning-pet-message').count(), 0, 'an empty reminder does not obscure content');
        assert.equal(await page.locator('.learning-pet-shell').isVisible(), true);
        await page.locator('#last-field').scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            const bar = document.createElement('div');
            bar.className = 'reading-builder-actionbar';
            bar.innerHTML = '<button>Changing page action</button>';
            document.body.appendChild(bar);
            window.dispatchEvent(new Event('resize'));
        });
        await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--builder-actionbar-height')) > 0);
        const afterLayout = await page.locator('.learning-pet-shell').evaluate(el => {
            const rect = el.getBoundingClientRect(); return {left: rect.left, top: rect.top, transform: getComputedStyle(el).transform};
        });
        assert.ok(Math.abs(afterLayout.left - anchor.left) < 1 && Math.abs(afterLayout.top - anchor.top) < 1,
            'scrolling and a new actionbar must not move the pet');
        assert.equal(afterLayout.transform, 'none');
        await page.evaluate(() => fixtureScope.$apply(() => { fixtureScope.pet.notificationCount = 2; }));
        await page.locator('.learning-pet-message').waitFor();
        await page.evaluate(() => {
            const shell = document.querySelector('.learning-pet-shell');
            shell.style.left = '400px'; shell.style.top = '850px'; shell.style.right = 'auto'; shell.style.bottom = 'auto';
            shell.style.setProperty('--pet-clearance-x', '-180px');
            shell.style.setProperty('--pet-clearance-y', '-480px');
            shell.classList.add('is-ui-obstructed');
            window.dispatchEvent(new Event('resize'));
        });
        await page.waitForFunction(() => {
            const shell = document.querySelector('.learning-pet-shell');
            return !shell.style.getPropertyValue('--pet-clearance-x') && !shell.style.getPropertyValue('--pet-clearance-y') &&
                !shell.classList.contains('is-ui-obstructed');
        });
        assert.equal(await page.locator('.learning-pet-shell').evaluate(el => el.style.left), '400px');
        assert.equal(await page.locator('.learning-pet-shell').evaluate(el => el.style.top), '850px');
        const manual = await page.locator('.learning-pet-shell').evaluate(el => {
            const rect = el.getBoundingClientRect(); return {left: rect.left, top: rect.top};
        });
        assert.equal(manual.left, 400); assert.equal(manual.top, 850);
        assert.equal(await page.locator('.learning-pet-message').isVisible(), true);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('native and custom dialogs cover background actionbar and widgets, leaving their close button clickable', async () => {
    const {page, errors} = await open(768, 1024);
    try {
        for (const modalClass of ['modal-open', 'ui-dialog-open']) {
            await page.evaluate(modalClass => {
                document.body.classList.add(modalClass);
                document.body.insertAdjacentHTML('beforeend', '<div class="fixture-backdrop"></div><div class="fixture-modal" role="dialog" aria-modal="true" aria-label="Fixture"><div class="modal-content"><p>Long modal content</p><button id="modal-close" type="button">Đóng</button></div></div>');
                document.querySelector('#modal-close').onclick = () => { window.closedByClick = true; };
            }, modalClass);
            assert.equal(await page.locator('.learning-pet-shell').isVisible(), false);
            assert.equal(await page.locator('.student-scroll-top').isVisible(), false);
            assert.equal(await page.locator('#modal-close').evaluate(button => {
                const rect = button.getBoundingClientRect();
                return document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2) === button;
            }), true, modalClass);
            await page.locator('#modal-close').click();
            assert.equal(await page.evaluate(() => window.closedByClick), true);
            if (process.env.UI_FIX_SCREENSHOTS && modalClass === 'modal-open') {
                fs.mkdirSync(process.env.UI_FIX_SCREENSHOTS, {recursive: true});
                await page.screenshot({path: path.join(process.env.UI_FIX_SCREENSHOTS, 'modal-layer-after.png')});
            }
            await page.evaluate(modalClass => {
                document.querySelector('.fixture-modal').remove(); document.querySelector('.fixture-backdrop').remove();
                document.body.classList.remove(modalClass); window.closedByClick = false;
            }, modalClass);
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('mobile pet panel remains viewport-fixed with a stationary mascot', async () => {
    const {page, errors} = await open(390, 844, false);
    try {
        await page.locator('.learning-pet-character').click();
        await page.locator('.learning-pet-panel').waitFor();
        const metrics = await page.locator('.learning-pet-panel').evaluate(panel => {
            const rect = panel.getBoundingClientRect();
            return {position: getComputedStyle(panel).position, left: rect.left, right: rect.right,
                width: rect.width, top: rect.top, bottom: rect.bottom, viewport: innerWidth, height: innerHeight};
        });
        assert.equal(metrics.position, 'fixed');
        assert.ok(metrics.width >= 300 && metrics.left >= 0 && metrics.right <= metrics.viewport + 1, JSON.stringify(metrics));
        assert.ok(metrics.top >= 0 && metrics.bottom <= metrics.height + 1, JSON.stringify(metrics));
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('rotating a builder updates reserved footer space when its action buttons wrap', async () => {
    const {page, errors} = await open(1180, 820);
    try {
        const initial = await page.locator('.reading-builder-actionbar').evaluate(bar => bar.getBoundingClientRect().height);
        await page.setViewportSize({width: 390, height: 844});
        await page.waitForFunction(initial => {
            const height = document.querySelector('.reading-builder-actionbar').getBoundingClientRect().height;
            return height > initial && Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--builder-actionbar-height')) - height) <= 1;
        }, initial);
        const metrics = await page.evaluate(() => ({bar: document.querySelector('.reading-builder-actionbar').getBoundingClientRect().height,
            padding: parseFloat(getComputedStyle(document.querySelector('.ielts-reading-builder-page')).paddingBottom),
            width: document.documentElement.scrollWidth}));
        assert.ok(metrics.padding >= metrics.bar + 20, JSON.stringify(metrics));
        assert.ok(metrics.width <= 391);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
