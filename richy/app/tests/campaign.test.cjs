const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../campaign/controllers/CampaignController.js'), 'utf8');
function setup({manager = false, id = null, campaign = null} = {}) {
    let Controller;
    const settings = {permissionsLoaded: true, isEducationManagerment: manager};
    const calls = [], watches = [];
    const service = {
        list: async (q, page) => ({data: {content: [], totalPages: 0, totalElements: 0}}),
        get: async () => ({data: campaign}),
        save: async value => { calls.push(['save', value]); return {data: {...value, id: value.id || 5}}; },
        remove: async value => { calls.push(['delete', value]); }
    };
    const state = {go: async (...args) => calls.push(['go', ...args])};
    const sandbox = nodeVm.createContext({angular: {module: () => ({controller: (name, fn) => { Controller = fn; }}), copy: structuredClone}});
    nodeVm.runInContext(source, sandbox);
    const vm = new Controller({$root: {}, $watch: (...args) => watches.push(args)}, state, {id}, {print() {}}, settings, service, {success() {}, error() {}});
    return {vm, settings, calls, service, watches};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('only Education Management can edit even if another permission is set', async () => {
    const h = setup(); h.settings.isAdmin = true; h.settings.isStudentManagerment = true;
    assert.equal(h.vm.canManage(), false);
    h.vm.create(); assert.equal(h.vm.editor, undefined);
    await h.vm.edit({id: 5}); h.vm.askDelete({id: 5}); await h.vm.deleteCampaign();
    assert.equal(h.calls.length, 0);
    h.settings.isEducationManagerment = true; h.settings.permissionsLoaded = false;
    assert.equal(h.vm.canManage(), false);
});
test('creating a campaign saves configured daily practices and calendar dates', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.name = 'Mùa Chay';
    h.vm.editor.startDate = new Date(2026, 1, 22, 12); h.vm.editor.endDate = new Date(2026, 3, 12, 12);
    await h.vm.save({$invalid: false});
    assert.equal(h.calls[0][1].startDate, '2026-02-22'); assert.equal(h.calls[0][1].endDate, '2026-04-12');
    assert.ok(h.calls[0][1].flowerItems.length > 0); assert.equal(h.vm.editor, null);
    assert.deepEqual(structuredClone(h.calls[1]), ['go', 'campaign_detail', {id: 5}]);
});
test('reversed dates do not send a mutation', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.startDate = new Date(2026, 3, 12); h.vm.editor.endDate = new Date(2026, 1, 22);
    await h.vm.save({$invalid: false}); assert.equal(h.calls.length, 0); assert.match(h.vm.editError, /Ngày kết thúc/);
});
test('weekly sheets include only actual campaign dates across years and leap days', async () => {
    const h = setup({id: 5, campaign: {id: 5, startDate: '2027-12-28', endDate: '2028-01-05', flowerItems: []}});
    await tick(); assert.equal(h.vm.weekCount, 2);
    assert.equal(h.vm.weekDays[0].date, '2027-12-28'); assert.equal(h.vm.weekDays[6].date, '2028-01-03');
    h.vm.setWeek(1); assert.deepEqual(Array.from(h.vm.weekDays, d => d.date), ['2028-01-04', '2028-01-05']);
    h.vm.setWeek(2); assert.equal(h.vm.weekIndex, 1);
    const leap = setup({id: 6, campaign: {startDate: '2028-02-28', endDate: '2028-03-01', flowerItems: []}});
    await tick(); assert.deepEqual(Array.from(leap.vm.weekDays, d => d.date), ['2028-02-28', '2028-02-29', '2028-03-01']);
});
test('API rejection keeps unsaved content available and shows the permission error', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.name = 'Giữ lại'; h.vm.editor.startDate = new Date(2026, 1, 22); h.vm.editor.endDate = new Date(2026, 3, 12);
    h.service.save = async () => { throw {status: 403}; };
    await h.vm.save({$invalid: false}); assert.equal(h.vm.editor.name, 'Giữ lại'); assert.match(h.vm.editError, /Education Management/);
});
test('delete requires a selected confirmation and manager role', async () => {
    const h = setup({manager: true}); await h.vm.deleteCampaign(); assert.equal(h.calls.length, 0);
    h.vm.askDelete({id: 5}); await h.vm.deleteCampaign(); assert.deepEqual(h.calls[0], ['delete', 5]);
});
test('public route exemption is limited to campaign listing and numeric detail URLs', () => {
    const app = fs.readFileSync(path.join(__dirname, '../application.js'), 'utf8');
    const fn = app.slice(app.indexOf('function isPublicCampaignPage()'), app.indexOf('authSession.restore();', app.indexOf('function isPublicCampaignPage()')));
    for (const [pathname, allowed] of [['/campaigns', true], ['/campaigns/5', true], ['/campaigns/5/', true], ['/campaigns/admin', false], ['/dashboard', false], ['/campaigns/0', false], ['/campaigns/5/edit', false]]) {
        const context = nodeVm.createContext({window: {location: {pathname}}}); nodeVm.runInContext(fn, context);
        assert.equal(context.isPublicCampaignPage(), allowed, pathname);
    }
});
