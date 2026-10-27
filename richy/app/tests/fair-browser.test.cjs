const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..'), repo = path.resolve(app, '../..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
async function open(browser, {width = 390, mode = 'lookup', station = {name: 'Ném bóng', operation: 'PLAY', tier: 'HARD'}, admin = false} = {}) {
    const page = await browser.newPage({viewport: {width, height: 844}, isMobile: true, hasTouch: true});
    const errors = [], writes = [], requests = [];
    const state = {event: {id: 7, name: 'Hội chợ tổng kết 2026', active: true, easyAmount: 8, mediumAmount: 12, hardAmount: 20}, balance: 20, guests: [], transactions: []};
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
        requests.push(pathname);
        const json = data => route.fulfill({contentType: 'application/json', body: JSON.stringify(data)});
        if (/^\/service\/(public|api)\/fairs$/.test(pathname)) return json([state.event]);
        if (pathname === '/service/public/fairs/7') return json(state.event);
        if (pathname === '/service/public/fairs/7/balance') return json({eventId: 7, cardCode: url.searchParams.get('cardCode'), displayName: 'Nguyễn Văn An', guest: false, balance: state.balance});
        if (pathname === '/service/api/fairs/7/operator') return json({username: admin ? 'admin' : 'play', admin, canPlay: true, canGift: admin || station?.operation === 'GIFT', station});
        if (pathname === '/service/api/fairs/7' && request.method() === 'PUT') {state.event = {...state.event, ...request.postDataJSON()}; return json(state.event);}
        if (pathname === '/service/api/fairs/7/guests') {
            if (request.method() === 'POST') {
                const count = request.postDataJSON().count, start = state.guests.length;
                for (let i = 0; i < count; i++) state.guests.push({cardCode: 'HC-7-KH' + (start + i + 1) + '-12345678', displayName: 'Khách KH' + (start + i + 1), balance: 0});
                return json(state.guests.slice(start));
            }
            return json(state.guests);
        }
        if (pathname === '/service/api/fairs/7/stations') return json([]);
        if (pathname === '/service/api/fairs/7/transactions') {
            if (request.method() === 'POST') {
                const body = request.postDataJSON(); writes.push(body);
                state.balance += body.operation === 'PLAY' ? body.amount : -body.amount;
                const transaction = {id: writes.length, delta: body.operation === 'PLAY' ? body.amount : -body.amount};
                return json({participant: {cardCode: body.cardCode, displayName: 'Nguyễn Văn An', balance: state.balance}, transaction});
            }
            return json(state.transactions);
        }
        const local = path.join(app, pathname.replace(/^\//, ''));
        if (local.startsWith(app + path.sep) && fs.existsSync(local) && fs.statSync(local).isFile()) return route.fulfill({path: local});
        if (pathname.startsWith('/service/')) return route.fulfill({status: 404, body: '{}'});
        return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><base href="/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><ui-view></ui-view></body></html>'});
    });
    await page.goto('https://fair.test/hoi-cho/7/' + (mode === 'lookup' ? 'tra-cuu' : mode === 'admin' ? 'quan-tri' : 'lam-viec'));
    for (const file of ['angular.min.js', 'angular-ui-router.min.js', 'ocLazyLoad.min.js']) await page.addScriptTag({path: path.join(app, 'assets/scripts/external', file)});
    await page.evaluate(() => {window.APP_VERSION = 'qa'; window.Hrm = angular.module('Hrm', []); angular.module('Hrm.Common', []);});
    await page.addScriptTag({path: path.join(app, 'fair/fair.module.js')});
    await page.evaluate(() => {
        Hrm.requires.push('Hrm.Fair');
        Hrm.value('settings', {fairsEnabled: true, api: {baseUrl: 'https://fair.test/service/'}});
        Hrm.config(['$locationProvider', function ($locationProvider) {$locationProvider.html5Mode({enabled: true, requireBase: false});}]);
        angular.bootstrap(document, ['Hrm']);
    });
    await page.locator('.fair-intro h1').filter({hasText: state.event.name}).waitFor();
    if (mode === 'work') await page.locator('.fair-station').waitFor();
    return {page, errors, writes, requests, state};
}
test('phone lookup, fixed booth award, insufficient balance and editable configuration render through real lazy routes', async () => {
    const browser = await chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [360, 390]) {
            const h = await open(browser, {width});
            await h.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001');
            await h.page.getByRole('button', {name: 'Xem phiếu', exact: true}).click();
            await h.page.locator('.fair-balance-number').filter({hasText: '20'}).waitFor();
            assert.equal(h.writes.length, 0); assert.equal(h.requests.some(p => p.startsWith('/service/api/')), false);
            assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await h.page.screenshot({path: path.join(repo, '.tmp/fair-lookup-' + width + '.png'), fullPage: true});
            assert.deepEqual(h.errors, []); await h.page.close();
        }
        const play = await open(browser, {mode: 'work'});
        assert.equal(await play.page.locator('.fair-tier').count(), 0);
        await play.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001');
        await play.page.getByRole('button', {name: 'Xem phiếu', exact: true}).click();
        await play.page.getByRole('button', {name: 'Thưởng 20 phiếu', exact: true}).click();
        await play.page.locator('.fair-receipt').waitFor(); assert.equal(play.writes.length, 1); assert.equal(play.writes[0].amount, 20);
        const nextButton = await play.page.getByRole('button', {name: 'Quét lượt tiếp theo', exact: true}).boundingBox();
        assert.ok(nextButton.y + nextButton.height <= 844, 'Next-turn button should fit the phone viewport');
        await play.page.screenshot({path: path.join(repo, '.tmp/fair-award-390.png'), fullPage: true});
        await play.page.getByRole('button', {name: 'Quét lượt tiếp theo', exact: true}).click();
        assert.equal(await play.page.locator('.fair-balance').count(), 0); assert.deepEqual(play.errors, []); await play.page.close();
        const gift = await open(browser, {mode: 'work', station: {name: 'Đổi quà', operation: 'GIFT', tier: 'HARD'}});
        gift.state.balance = 0;
        await gift.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001'); await gift.page.getByRole('button', {name: 'Xem phiếu', exact: true}).click();
        await gift.page.getByText('Còn thiếu 20 phiếu để đổi quà này.').waitFor();
        assert.equal(await gift.page.getByRole('button', {name: 'Đổi quà · Trừ 20 phiếu', exact: true}).isDisabled(), true);
        assert.equal(gift.writes.length, 0); assert.deepEqual(gift.errors, []); await gift.page.close();
        const admin = await open(browser, {mode: 'admin', admin: true});
        await admin.page.getByLabel('Dễ · số phiếu', {exact: true}).fill('5'); await admin.page.getByLabel('Khó · số phiếu', {exact: true}).fill('30');
        await admin.page.getByRole('button', {name: 'Lưu cấu hình', exact: true}).click();
        await admin.page.getByText('Đã lưu cấu hình hội chợ. Giao dịch cũ và số dư được giữ nguyên.').waitFor();
        assert.equal(admin.state.event.easyAmount, 5); assert.equal(admin.state.event.hardAmount, 30);
        await admin.page.getByLabel('Số thẻ tạo thêm', {exact: true}).fill('100'); await admin.page.getByRole('button', {name: 'Tạo thẻ khách', exact: true}).click();
        await admin.page.getByRole('button', {name: 'In 100 thẻ QR', exact: true}).waitFor();
        assert.equal(await admin.page.locator('.fair-print-cards article').count(), 100);
        await admin.page.screenshot({path: path.join(repo, '.tmp/fair-admin-390.png'), fullPage: true});
        await admin.page.emulateMedia({media: 'print'});
        assert.equal(await admin.page.locator('.fair-print-cards').isVisible(), true);
        assert.equal(await admin.page.locator('.fair-content').isVisible(), false);
        await admin.page.pdf({path: path.join(repo, '.tmp/fair-guest-cards-qa.pdf'), format: 'A4', printBackground: true});
        await admin.page.emulateMedia({media: 'screen'});
        const decoded = await admin.page.evaluate(async () => {
            const image = document.querySelector('.fair-print-cards [fair-qr] canvas');
            const blob = await fetch(image.toDataURL('image/png')).then(response => response.blob());
            const container = document.createElement('div'); container.id = 'qa-printed-qr'; container.style.width = '300px'; document.body.appendChild(container);
            const reader = new Html5Qrcode(container.id);
            try { return await reader.scanFile(new File([blob], 'guest.png', {type: 'image/png'}), false); }
            finally { reader.clear(); container.remove(); }
        });
        assert.equal(decoded, admin.state.guests[0].cardCode, 'Printed guest QR should decode to that guest wallet');
        assert.deepEqual(admin.errors, []); await admin.page.close();
    } finally {await browser.close();}
});
