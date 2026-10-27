const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../fair/fair-core.js');
const crypto = require('node:crypto').webcrypto;
const controllerSource = fs.readFileSync(__dirname + '/../fair/FairController.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const event = {id: 7, name: 'Hội chợ', active: true, easyAmount: 5, mediumAmount: 15, hardAmount: 30};
function setup({mode = 'work', enabled = true, storage = new Map(), transact, station = {name: 'Ném bóng', operation: 'PLAY', tier: 'CHOOSE'}} = {}) {
    let Controller;
    vm.runInNewContext(controllerSource, {Promise, Date, angular: {copy: value => JSON.parse(JSON.stringify(value)), module: () => ({controller(name, fn) { Controller = fn; }})}});
    const calls = [], timers = [], handlers = {}, navigations = [];
    const win = {FairCore: core, crypto, location: {pathname: '/hoi-cho/7/lam-viec'},
        localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
        sessionStorage: {setItem() {}}, print() {}};
    const api = {
        events: async admin => { calls.push(['events', admin]); return {data: [event]}; },
        event: async () => ({data: event}),
        operator: async () => {calls.push(['operator']); return {data: {username: 'play', admin: false, canPlay: true, canGift: false, station}};},
        balance: async (id, code) => {calls.push(['balance', id, code]); return {data: {eventId: id, cardCode: code, displayName: 'Nguyễn An', balance: 0}};},
        transact: async (id, request) => {calls.push(['transact', id, {...request}]); return transact ? transact(id, request) : {data: {participant: {cardCode: request.cardCode, balance: request.amount}, transaction: {id: 1, delta: request.amount}}};}
    };
    function timeout(fn, delay) { const timer = {fn, delay}; timers.push(timer); return timer; }
    timeout.cancel = () => {};
    const instance = new Controller({$on(name, fn) {handlers[name] = fn;}}, {go(...args) {navigations.push(args);}}, {fairMode: mode}, win, timeout, {fairsEnabled: enabled}, api);
    return {instance, calls, timers, storage, handlers, navigations};
}
test('disabled fair domains redirect before API calls, camera setup, storage or timers', async () => {
    for (const mode of ['lookup', 'work', 'admin']) {
        const h = setup({mode, enabled: false}); await tick();
        assert.deepEqual(h.calls, []); assert.deepEqual(h.timers, []); assert.deepEqual(h.handlers, {});
        assert.deepEqual(structuredClone(h.navigations), [['login', {showHome: true}, {location: 'replace'}]]);
    }
});
test('prices come from event configuration and QR parsing accepts existing cards and direct links', () => {
    assert.deepEqual(core.tiers(event).map(t => t.amount), [5, 15, 30]);
    assert.equal(core.cardCode(' HS001 '), 'HS001');
    assert.equal(core.cardCode('https://example.test/hoi-cho/7/tra-cuu?ma=HS001'), 'HS001');
    for (const input of ['', '<script>', 'https://example.test/no-code', 'HS001\nHS002']) assert.throws(() => core.cardCode(input));
    assert.match(core.key(crypto), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('public phone lookup does not request operator privileges or create any transaction', async () => {
    const h = setup({mode: 'lookup'}); await tick();
    assert.equal(h.instance.canScan(), true);
    await h.instance.scan('HS001'); assert.equal(h.instance.participant.balance, 0);
    assert.equal(h.instance.canScan(), false); assert.equal(h.timers[0].delay, 8000);
    assert.equal(h.calls.filter(c => c[0] === 'operator' || c[0] === 'transact').length, 0);
    h.timers[0].fn(); assert.equal(h.instance.participant, null); assert.equal(h.instance.canScan(), true);
});
test('scanning only reads balance; an explicit award uses configured price and double taps send once', async () => {
    const h = setup(); await tick(); await h.instance.scan('HS001');
    assert.equal(h.calls.filter(c => c[0] === 'transact').length, 0);
    h.instance.chooseTier(h.instance.tiers[2]);
    const first = h.instance.submit(); h.instance.submit(); await first;
    const writes = h.calls.filter(c => c[0] === 'transact'); assert.equal(writes.length, 1); assert.equal(writes[0][2].amount, 30); assert.equal(writes[0][2].tier, 'HARD');
    assert.equal(h.instance.receipt.participant.balance, 30); assert.equal(h.storage.size, 0);
    h.instance.next(); assert.equal(h.instance.selectedTier, '');
});
test('uncertain network result retains exact request across reload and retries with the same key', async () => {
    const storage = new Map(), first = setup({storage, transact: async () => {throw {status: -1};}});
    await tick(); await first.instance.scan('HS001'); first.instance.chooseTier(first.instance.tiers[0]); await first.instance.submit();
    const pending = first.instance.pending; assert.ok(pending); assert.equal(storage.size, 1);
    first.instance.next(); assert.ok(first.instance.pending); assert.equal(first.instance.canScan(), false);
    const second = setup({storage}); await tick(); assert.equal(second.instance.pending.request.requestKey, pending.request.requestKey);
    await second.instance.retry(); const write = second.calls.find(c => c[0] === 'transact');
    assert.equal(write[2].requestKey, pending.request.requestKey); assert.equal(write[2].amount, 5); assert.equal(second.instance.pending, null);
});
test('a definitive server rejection clears pending so operator can correct the selection', async () => {
    const h = setup({transact: async () => {throw {status: 400, data: {message: 'Mức đã thay đổi'}};}}); await tick();
    await h.instance.scan('HS001'); h.instance.chooseTier(h.instance.tiers[0]); await h.instance.submit();
    assert.equal(h.instance.pending, null); assert.equal(h.storage.size, 0); assert.match(h.instance.error, /thay đổi/);
});
test('expired credentials keep the pending receipt available for checking after login', async () => {
    const h = setup({transact: async () => {throw {status: 401};}}); await tick();
    await h.instance.scan('HS001'); h.instance.chooseTier(h.instance.tiers[0]); await h.instance.submit();
    assert.ok(h.instance.pending); assert.equal(h.storage.size, 1); assert.equal(h.instance.needLogin, true);
});
test('a late response from a previous tab cannot erase a newer pending turn', async () => {
    let finishOld, finishNew;
    const storage = new Map(), old = setup({storage, transact: () => new Promise(resolve => {finishOld = resolve;})});
    await tick(); await old.instance.scan('HS001'); old.instance.chooseTier(old.instance.tiers[0]); const sendingOld = old.instance.submit();
    const current = setup({storage}); await tick(); await current.instance.retry();
    current.instance.next(); await current.instance.scan('HS001'); current.instance.chooseTier(current.instance.tiers[1]);
    // Hold the next request while the old page finally receives its successful response.
    const next = setup({storage, transact: () => new Promise(resolve => {finishNew = resolve;})}); await tick();
    await next.instance.scan('HS001'); next.instance.chooseTier(next.instance.tiers[1]); const sendingNew = next.instance.submit();
    const newKey = next.instance.pending.request.requestKey;
    finishOld({data: {participant: {balance: 5}, transaction: {id: 1, delta: 5}}}); await sendingOld;
    assert.equal(JSON.parse([...storage.values()][0]).request.requestKey, newKey);
    finishNew({data: {participant: {balance: 20}, transaction: {id: 2, delta: 15}}}); await sendingNew;
});
test('fixed stations use their assigned semantic tier and preserve it between turns', async () => {
    const h = setup({station: {name: 'Khó', operation: 'PLAY', tier: 'HARD'}}); await tick();
    assert.equal(h.instance.selectedTier, 'HARD'); assert.equal(h.instance.tier().amount, 30);
    await h.instance.scan('HS001'); await h.instance.submit(); h.instance.next(); assert.equal(h.instance.selectedTier, 'HARD');
});
test('storage failure stops the request before it reaches the server', async () => {
    const h = setup({storage: {get() {}, set() {throw Error('Storage full');}, delete() {}}}); await tick();
    await h.instance.scan('HS001'); h.instance.chooseTier(h.instance.tiers[0]); await h.instance.submit();
    assert.equal(h.calls.filter(c => c[0] === 'transact').length, 0); assert.match(h.instance.error, /lưu trữ/);
});
test('rear camera ignores repeated detections and stops if page closes during permission request', async () => {
    let factory, finish, decode, destroy, stopped = 0, scans = 0;
    const scope = {vm: {canScan: () => true, scan: async () => {scans++;}}, $evalAsync(fn) {if (fn) fn();}, $on(name, fn) {destroy = fn;}};
    class Reader {
        start(camera, config, callback) {assert.equal(camera.facingMode, 'environment'); decode = callback; return new Promise(resolve => {finish = resolve;});}
        stop() {stopped++; return Promise.resolve();} clear() {}
    }
    vm.runInNewContext(fs.readFileSync(__dirname + '/../fair/FairScanner.js', 'utf8'), {Promise, angular: {module: () => ({directive(name, args) {if (name === 'fairScanner') factory = args.at(-1);}})}});
    factory({isSecureContext: true, Html5Qrcode: Reader}).link(scope);
    const opening = scope.camera.start(); decode('HS001'); decode('HS001'); assert.equal(scans, 1);
    destroy(); finish(); await opening; assert.equal(stopped, 1);
});
