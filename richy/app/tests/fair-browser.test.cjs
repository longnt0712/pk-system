const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..'), repo = path.resolve(app, '../..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
async function open(browser, {width = 390, mode = 'lookup', station = {name: 'Ném bóng', operation: 'PLAY', tier: 'HARD'}, role = 'play', admin = false} = {}) {
    const page = await browser.newPage({viewport: {width, height: 844}, isMobile: true, hasTouch: true});
    const errors = [], writes = [], undos = [], requests = [];
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
        if (pathname === '/service/api/fairs/7/operator') return json({username: admin ? 'admin' : role, admin, canPlay: admin || role === 'play', canGift: admin || role === 'gift', station});
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
        const undoMatch = pathname.match(/^\/service\/api\/fairs\/7\/transactions\/(\d+)\/undo$/);
        if (undoMatch && request.method() === 'POST') {
            const original = state.transactions.find(tx => tx.id === Number(undoMatch[1]));
            undos.push({transactionId: Number(undoMatch[1]), ...request.postDataJSON()});
            if (!original || original.operation !== 'PLAY' || original.corrected) return route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({message: 'Không thể hoàn tác lượt này.'})});
            state.balance -= original.amount; original.corrected = true;
            const transaction = {id: 100 + undos.length, operation: 'PLAY', correctionOf: original.id, delta: -original.amount, amount: 0};
            return json({participant: {cardCode: original.cardCode, displayName: 'Nguyễn Văn An', balance: state.balance}, transaction});
        }
        if (pathname === '/service/api/fairs/7/transactions') {
            if (request.method() === 'POST') {
                const body = request.postDataJSON(); writes.push(body);
                state.balance += body.operation === 'PLAY' ? body.amount : -body.amount;
                const transaction = {id: writes.length, operation: body.operation, cardCode: body.cardCode, amount: body.amount, delta: body.operation === 'PLAY' ? body.amount : -body.amount, correctionOf: null, corrected: false};
                state.transactions.unshift(transaction);
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
    return {page, errors, writes, undos, requests, state};
}
test('phone scan-choose-result flow respects roles, balances, public lookup and editable configuration', async () => {
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
        assert.equal(await play.page.locator('.fair-mode-picker').getByRole('button', {name: 'Thưởng trò chơi', exact: true}).count(), 1);
        assert.equal(await play.page.locator('.fair-mode-picker').getByRole('button', {name: 'Đổi quà', exact: true}).count(), 0);
        await play.page.evaluate(() => {
            window.Html5Qrcode = class {
                start(camera, configuration, onDecode) {window.qaDecodeFairCard = onDecode; return Promise.resolve();}
                stop() {return Promise.resolve();} clear() {}
            };
        });
        await play.page.getByRole('button', {name: 'Bật camera quét thẻ', exact: true}).click();
        await play.page.waitForFunction(() => typeof window.qaDecodeFairCard === 'function');
        await play.page.evaluate(() => {window.qaDecodeFairCard('HS001'); window.qaDecodeFairCard('HS001');});
        await play.page.locator('.fair-tier[data-tier="HARD"]').waitFor();
        assert.equal(await play.page.locator('.fair-tier').count(), 3);
        assert.equal(play.requests.filter(p => p === '/service/public/fairs/7/balance').length, 1, 'repeated camera detections must only identify the card once');
        assert.equal(play.writes.length, 0, 'scanning must not award before choosing a tier');
        assert.equal(await play.page.locator('.fair-balance-number').count(), 0, 'the result balance belongs after the tier action');
        await play.page.screenshot({path: path.join(repo, '.tmp/fair-choose-390.png'), fullPage: true});
        await play.page.locator('.fair-tier[data-tier="HARD"]').click();
        await play.page.locator('.fair-receipt').waitFor(); assert.equal(play.writes.length, 1); assert.equal(play.writes[0].amount, 20);
        assert.equal(play.writes[0].operation, 'PLAY');
        assert.match(await play.page.locator('.fair-balance-number').innerText(), /40/);
        assert.equal(await play.page.locator('.fair-tier').count(), 0);
        const nextButton = await play.page.getByRole('button', {name: 'Quét lượt tiếp theo', exact: true}).boundingBox();
        assert.ok(nextButton.y + nextButton.height <= 844, 'Next-turn button should fit the phone viewport');
        await play.page.screenshot({path: path.join(repo, '.tmp/fair-award-390.png'), fullPage: true});
        assert.equal(await play.page.locator('.fair-undo').count(), 1);
        play.page.once('dialog', dialog => {assert.equal(dialog.type(), 'confirm'); dialog.dismiss();});
        await play.page.locator('.fair-undo').click(); assert.equal(play.undos.length, 0); assert.equal(play.state.balance, 40);
        play.page.once('dialog', dialog => dialog.accept());
        await play.page.locator('.fair-undo').click();
        await play.page.waitForFunction(() => /20/.test(document.querySelector('.fair-balance-number')?.textContent || ''));
        assert.equal(play.undos.length, 1); assert.equal(play.state.balance, 20); assert.equal(await play.page.locator('.fair-undo').count(), 0);
        await play.page.getByRole('button', {name: 'Quét lượt tiếp theo', exact: true}).click();
        assert.equal(await play.page.locator('.fair-balance').count(), 0); assert.equal(await play.page.locator('.fair-tier').count(), 0);
        assert.deepEqual(play.errors, []); await play.page.close();
        const gift = await open(browser, {mode: 'work', role: 'gift', station: {name: 'Gian cũ', operation: 'PLAY', tier: 'HARD'}});
        gift.state.balance = 12;
        assert.equal(await gift.page.locator('.fair-mode-picker').getByRole('button', {name: 'Thưởng trò chơi', exact: true}).count(), 0);
        assert.equal(await gift.page.locator('.fair-mode-picker').getByRole('button', {name: 'Đổi quà', exact: true}).count(), 1);
        await gift.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001'); await gift.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).press('Enter');
        await gift.page.locator('.fair-tier[data-tier="HARD"]').waitFor();
        assert.equal(await gift.page.locator('.fair-tier[data-tier="HARD"]').isDisabled(), true);
        assert.equal(await gift.page.locator('.fair-tier[data-tier="EASY"]').isDisabled(), false);
        assert.equal(await gift.page.locator('.fair-tier[data-tier="MEDIUM"]').isDisabled(), false);
        assert.equal(gift.writes.length, 0);
        await gift.page.locator('.fair-tier[data-tier="EASY"]').click(); await gift.page.locator('.fair-receipt').waitFor();
        assert.equal(gift.writes.length, 1); assert.equal(gift.writes[0].operation, 'GIFT'); assert.equal(gift.state.balance, 4);
        assert.equal(await gift.page.locator('.fair-undo').count(), 0);
        assert.deepEqual(gift.errors, []); await gift.page.close();
        const emptyGift = await open(browser, {mode: 'work', role: 'gift', station: null}); emptyGift.state.balance = 0;
        await emptyGift.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001'); await emptyGift.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).press('Enter');
        await emptyGift.page.locator('.fair-tier[data-tier="EASY"]').waitFor();
        for (const tier of ['EASY', 'MEDIUM', 'HARD']) assert.equal(await emptyGift.page.locator('.fair-tier[data-tier="' + tier + '"]').isDisabled(), true);
        assert.equal(emptyGift.writes.length, 0); assert.deepEqual(emptyGift.errors, []); await emptyGift.page.close();
        const adminWork = await open(browser, {mode: 'work', admin: true, station: null});
        assert.equal(await adminWork.page.locator('.fair-mode-picker > button').count(), 2);
        await adminWork.page.locator('.fair-mode-picker').getByRole('button', {name: 'Đổi quà', exact: true}).click();
        await adminWork.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).fill('HS001'); await adminWork.page.getByLabel('Hoặc nhập mã thẻ', {exact: true}).press('Enter');
        await adminWork.page.locator('.fair-tier[data-tier="MEDIUM"]').click(); await adminWork.page.locator('.fair-receipt').waitFor();
        assert.equal(adminWork.writes[0].operation, 'GIFT'); assert.equal(adminWork.state.balance, 8); assert.deepEqual(adminWork.errors, []); await adminWork.page.close();
        const admin = await open(browser, {mode: 'admin', admin: true});
        assert.equal(await admin.page.getByRole('heading', {name: 'Gán người trực gian hàng', exact: true}).count(), 0);
        assert.equal(await admin.page.getByLabel('Mức cố định', {exact: true}).count(), 0);
        assert.equal(admin.requests.some(p => p.endsWith('/stations')), false, 'role-only workflow must not require station assignment');
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
