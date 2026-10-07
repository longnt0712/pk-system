// Browser layout checks: node --test richy/app/tests/reading-content-overflow.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'question/views/ielts_reading_actual_test_idp.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/external/bootstrap.min.css'), 'utf8') +
    Array.from(template.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400"><rect width="1600" height="400" fill="#cbe6f6"/><text x="40" y="200" font-size="70">Wide image — full width visible</text></svg>');
function fixture() {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
    body{margin:0}.idp-reading-page{width:100%;padding:0 8px}.fixture-pane{height:360px!important;width:100%!important;float:none!important}
    </style></head><body class="ielts-reading-test-running"><div class="idp-reading-page"><div class="question-content fixture-pane">
    <p>Research into sleep and dreaming — kéo ngang để đọc cột Comment</p>
    <table style="width:660px;min-width:660px;border-collapse:collapse" border="1"><thead><tr><th style="width:210px">Group</th><th style="width:210px">Research findings</th><th style="width:240px">Comment</th></tr></thead><tbody><tr><td>Humans</td><td>REM and non-REM sleep</td><td id="last-column">Last column visible</td></tr></tbody></table>
    <p><input aria-label="Answer 1" placeholder="1"></p></div>
    <div class="passage-text fixture-pane"><p>Image with imported dimensions</p><p><img src="${image}" width="1600" height="400" style="width:1600px;height:400px" alt="Wide chart"></p></div></div></body></html>`;
}

test('wide tables scroll to the last column and oversized images fit each pane at mobile and desktop widths', async () => {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const browser = await playwright.chromium.launch({headless: true, ...(fs.existsSync(edge) ? {executablePath: edge} : {})});
    try {
        for (const width of [320, 375, 768, 1366]) {
            const page = await browser.newPage({viewport: {width, height: 900}});
            await page.setContent(fixture());
            await page.locator('img').evaluate(img => img.decode());
            const metrics = await page.evaluate(() => {
                const pane = document.querySelector('.question-content');
                const imagePane = document.querySelector('.passage-text');
                const img = imagePane.querySelector('img');
                const style = getComputedStyle(imagePane);
                const available = imagePane.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
                pane.scrollLeft = pane.scrollWidth;
                const cell = document.querySelector('#last-column').getBoundingClientRect();
                const rect = pane.getBoundingClientRect();
                return {width: pane.clientWidth, scrollWidth: pane.scrollWidth, scrollLeft: pane.scrollLeft,
                    overflowX: getComputedStyle(pane).overflowX, lastColumnVisible: cell.right <= rect.right + 1 && cell.left >= rect.left,
                    imageWidth: img.getBoundingClientRect().width, available, ratio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
                    documentWidth: document.documentElement.scrollWidth, viewport: innerWidth};
            });
            assert.equal(metrics.overflowX, 'auto');
            if (width < 768) { assert.ok(metrics.scrollWidth > metrics.width); assert.ok(metrics.scrollLeft > 0); }
            assert.ok(metrics.lastColumnVisible, JSON.stringify({width, metrics}));
            assert.ok(metrics.imageWidth <= metrics.available + 1, JSON.stringify({width, metrics}));
            assert.ok(Math.abs(metrics.ratio - 4) < .02, 'image proportions are preserved');
            assert.ok(metrics.documentWidth <= metrics.viewport + 1, 'content does not widen the whole page');
            if (width === 375) {
                const output = path.resolve(root, '../richy-api/target/codex-note-check');
                fs.mkdirSync(output, {recursive: true});
                await page.screenshot({path: path.join(output, 'mobile-table-image.png'), fullPage: true});
            }
            await page.close();
        }
    } finally { await browser.close(); }
});
