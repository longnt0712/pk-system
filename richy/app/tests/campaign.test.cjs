const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../campaign/controllers/CampaignController.js'), 'utf8');
function setup({campaignsEnabled = true, manager = false, admin = false, id = null, campaign = null, studentMode = false, token = 'a'.repeat(43), entries = [], clock = null, serverTime = Date.UTC(2026,9,1,5), windowExtras = {}, campaignId = null, campaignCode = null, activeCampaigns = null, getError = null, classes = ['Thiếu Nhi 1'], prayerRandom = Math.random} = {}) {
    let Controller;
    const settings = {campaignsEnabled, permissionsLoaded: true, isEducationManagerment: manager, isAdmin: admin};
    const calls = [], watches = [], events = {};
    let dayCallback, dayDelay, destroyed, digests = 0;
    const service = {
        list: async (q, page) => ({data: {content: [], totalPages: 0, totalElements: 0}}),
        get: async () => {if(getError)throw getError;return {data:campaign};},
        getByShareCode: async code => {calls.push(['code',code]);if(getError)throw getError;return {data:campaign};},
        save: async value => { calls.push(['save', value]); return {data: {...value, id: value.id || 5, shareCode:'c'.repeat(32)}}; },
        remove: async value => { calls.push(['delete', value]); }
    };
    service.scanStudentQr = async code => {calls.push(['scan', code]); return {data: {token: 'b'.repeat(43)}};};
    service.studentLanding = async () => ({data: {serverTime, student: {studentCode: 'hs001', saintName: 'Đa Minh', fullName: 'Nguyễn Văn An', classes}, campaigns: activeCampaigns || (campaign ? [campaign] : [])}});
    service.studentSheet = async (token, id, week) => {calls.push(['sheet', token, id, week]); return {data: {student: {studentCode: 'hs001', saintName: 'Đa Minh', fullName: 'Nguyễn Văn An', classes}, campaign, entries, serverTime}};};
    service.checkFlower = async (...args) => {calls.push(['check', ...args]); return {data: {completed: args[4]}};};
    let gardenEntries = structuredClone(entries);
    service.studentGarden = async () => ({data: {campaign, entries: structuredClone(gardenEntries), serverTime}});
    service.paintFlower = async (token, id, date, itemKey, color) => {
        calls.push(['paint', token, id, date, itemKey, color]);
        let entry = gardenEntries.find(x=>x.date===date && x.itemKey===itemKey);
        if (!entry) { entry = {date,itemKey,completed:false};gardenEntries.push(entry); }
        entry.paintColor=color;return {data:{campaign,entries:structuredClone(gardenEntries),serverTime}};
    };
    service.resetFlowerPaint = async () => {calls.push(['resetPaint']); gardenEntries.forEach(x=>x.paintColor=null);return {data:{campaign,entries:structuredClone(gardenEntries),serverTime}};};
    service.eraseFlowerPetal = async (token, id, date, key) => {calls.push(['erasePetal',token,id,date,key]);gardenEntries.filter(x=>x.date===date && x.itemKey===key).forEach(x=>x.paintColor=null);return {data:{campaign,entries:structuredClone(gardenEntries),serverTime}};};
    const apiCalls = [];
    Object.keys(service).forEach(name => { const original = service[name]; service[name] = (...args) => { apiCalls.push(name); return original(...args); }; });
    const state = {current: {name: studentMode ? 'campaign_student' : 'campaigns'}, go: async (...args) => calls.push(['go', ...args])};
    const ClockDate = clock ? class extends Date { static now() { return clock.now; } } : Date;
    const sandbox = nodeVm.createContext({Date: ClockDate, Math: Object.assign(Object.create(Math), {random: prayerRandom}), angular: {module: () => ({controller: (name, fn) => { Controller = fn; }, directive() {}}), copy: structuredClone}});
    nodeVm.runInContext(source, sandbox);
    const vm = new Controller({$root: {}, $watch: (...args) => watches.push(args), $evalAsync: fn => {digests++;if(fn)fn();}, $on: (event, fn) => {events[event]=fn;if(event==='$destroy')destroyed = fn;}}, state, {id, studentMode, campaignId, campaignCode}, {URL, location: {hash: '#' + token}, print() {calls.push(['print']);}, confirm:()=>true, ...windowExtras, ...(clock ? {setTimeout(fn, delay) {dayCallback=fn; dayDelay=delay; return 1;}, clearTimeout() {dayCallback=null;}} : {})}, settings, service, {success() {}, error() {}}, {hash(value) {if(windowExtras.history){windowExtras.history.replaceState(null,'','/hoa-thieng'+(campaignCode?'/c/'+campaignCode:campaignId?'/'+campaignId:'')+(value?'#'+value:''));}return this;}, replace() {return this;}});
    return {vm, settings, calls, apiCalls, service, watches, events, getDayDelay: () => dayDelay, midnight: () => dayCallback(), getDigests: () => digests, destroy: () => destroyed(), hasDayTimer: () => !!dayCallback};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function setupViewport({supported = true} = {}) {
    let factory, destroy;
    const initialMeta = 'width=device-width, initial-scale=1, maximum-scale=1';
    let content = initialMeta;
    const meta = {getAttribute: () => content, setAttribute: (name, value) => {content = value;}, removeAttribute: () => {content = null;}};
    const events = new Map(), calls = [];
    const document = {fullscreenEnabled: supported, fullscreenElement: null, querySelector: () => meta,
        addEventListener: (event, fn) => events.set(event, fn), removeEventListener: event => events.delete(event),
        exitFullscreen: async () => {calls.push('exit'); document.fullscreenElement = null; events.get('fullscreenchange')();}};
    const layout = {clientWidth: 844};
    const target = {querySelector: () => layout, requestFullscreen: async options => {calls.push(['enter', options]); document.fullscreenElement = target; events.get('fullscreenchange')();}};
    const scope = {vm: {}, $watch() {}, $evalAsync() {}, $on: (event, fn) => {destroy = fn;}};
    nodeVm.runInNewContext(source, {angular: {module: () => ({controller() {}, directive: (name, registration) => {factory = registration[registration.length - 1];}})}});
    factory({document, addEventListener: (event, fn) => events.set(event, fn), removeEventListener: event => events.delete(event)}).link(scope, [target]);
    return {vm: scope.vm, calls, target, layout, events, getMeta: () => content, initialMeta, destroy: () => destroy()};
}

test('campaign viewing enables native pinch zoom, toggles fullscreen and restores viewport on exit', async () => {
    const h = setupViewport();
    assert.equal(h.vm.fullscreenSupported, true); assert.equal(h.vm.fullscreen, false);
    assert.match(h.getMeta(), /user-scalable=yes/); assert.doesNotMatch(h.getMeta(), /maximum-scale=1/);
    h.vm.toggleFullscreen(); await tick();
    assert.equal(h.vm.fullscreen, true); assert.equal(h.calls[0][1].navigationUI, 'hide');
    h.vm.toggleFullscreen(); await tick();
    assert.equal(h.vm.fullscreen, false); assert.equal(h.calls[1], 'exit');
    h.destroy(); assert.equal(h.getMeta(), h.initialMeta); assert.equal(h.events.size, 0);
});

test('unsupported or rejected fullscreen keeps normal viewing and zoom available', async () => {
    const unsupported = setupViewport({supported: false});
    assert.equal(unsupported.vm.fullscreenSupported, false);
    assert.match(unsupported.getMeta(), /user-scalable=yes/);
    const rejected = setupViewport();
    rejected.target.requestFullscreen = async () => {throw new Error('Unsupported');};
    rejected.vm.toggleFullscreen(); await tick();
    assert.match(rejected.vm.viewError, /hai ngón tay/); assert.equal(rejected.vm.fullscreen, false);
});

test('zoom controls support both directions, follow viewport changes and preserve bounded scaling', () => {
    const h = setupViewport();
    assert.equal(h.vm.viewZoom, 1);
    h.vm.changeZoom(0.25); assert.equal(h.vm.viewZoom, 1.25); assert.equal(h.vm.viewStyle.width, '844px');
    h.layout.clientWidth = 650; h.events.get('resize')(); assert.equal(h.vm.viewStyle.width, '650px');
    h.vm.changeZoom(-0.25); assert.equal(h.vm.viewZoom, 1); assert.equal(Object.keys(h.vm.viewStyle).length, 0);
    h.vm.changeZoom(-100); assert.equal(h.vm.viewZoom, 0.5);
    h.vm.changeZoom(100); assert.equal(h.vm.viewZoom, 3);
});
test('other roles cannot edit and permissions must finish loading', async () => {
    const h = setup(); h.settings.isStudentManagerment = true;
    assert.equal(h.vm.canManage(), false);
    h.vm.create(); assert.equal(h.vm.editor, undefined);
    await h.vm.edit({id: 5}); h.vm.askDelete({id: 5}); await h.vm.deleteCampaign();
    assert.equal(h.calls.length, 0);
    h.settings.isEducationManagerment = true; h.settings.permissionsLoaded = false;
    assert.equal(h.vm.canManage(), false);
});
test('Admin alone can create, edit and delete campaigns', async () => {
    const h = setup({admin: true, campaign: {id: 5, version: 0, name: 'Chiến dịch', startDate: '2026-02-22', endDate: '2026-04-12', flowerItems: [{name: 'Cầu nguyện'}]}});
    assert.equal(h.vm.canManage(), true);
    h.vm.create(); assert.ok(h.vm.editor);
    h.vm.cancelEdit();
    await h.vm.edit({id: 5}); assert.equal(h.vm.editor.id, 5);
    h.vm.editor.name = 'Admin đã sửa';
    await h.vm.save({$invalid: false});
    assert.equal(h.calls[0][0], 'save'); assert.equal(h.calls[0][1].name, 'Admin đã sửa');
    h.vm.askDelete({id: 5}); await h.vm.deleteCampaign();
    assert.ok(h.calls.some(call => call[0] === 'delete' && call[1] === 5));
});
test('creating a campaign saves configured daily practices and calendar dates', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.name = 'Mùa Chay';
    h.vm.editor.startDate = new Date(2026, 1, 22, 12); h.vm.editor.endDate = new Date(2026, 3, 12, 12);
    await h.vm.save({$invalid: false});
    assert.equal(h.calls[0][1].startDate, '2026-02-22'); assert.equal(h.calls[0][1].endDate, '2026-04-12');
    assert.ok(h.calls[0][1].flowerItems.length > 0); assert.equal(h.vm.editor, null);
    assert.deepEqual(structuredClone(h.calls[1]), ['go', 'campaign_detail_shared', {campaignCode:'c'.repeat(32)}]);
});
test('reversed dates do not send a mutation', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.startDate = new Date(2026, 3, 12); h.vm.editor.endDate = new Date(2026, 1, 22);
    await h.vm.save({$invalid: false}); assert.equal(h.calls.length, 0); assert.match(h.vm.editError, /Ngày kết thúc/);
});

test('campaign edits retain, replace and clear optional image links', async () => {
    const h = setup({admin: true, campaign: {id: 5, version: 0, name: 'Chiến dịch', startDate: '2026-10-01', endDate: '2026-10-31', flowerItems: [{name: 'Cầu nguyện'}],
        desktopLeftImageUrl: 'https://example.org/left.jpg', desktopRightImageUrl: 'https://example.org/right.jpg', mobileImageUrl: 'https://example.org/banner.jpg'}});
    await h.vm.edit({id: 5});
    assert.equal(h.vm.editor.desktopLeftImageUrl, 'https://example.org/left.jpg');
    h.vm.editor.desktopRightImageUrl = '  https://example.org/new-right.jpg?size=large  ';
    h.vm.editor.mobileImageUrl = '  ';
    await h.vm.save({$invalid: false});
    const payload = h.calls[0][1];
    assert.equal(payload.desktopLeftImageUrl, 'https://example.org/left.jpg');
    assert.equal(payload.desktopRightImageUrl, 'https://example.org/new-right.jpg?size=large');
    assert.equal(payload.mobileImageUrl, null);
});

test('invalid image links are hidden and never sent to the API', async () => {
    const h = setup({manager: true}); h.vm.create();
    h.vm.editor.startDate = new Date(2026, 9, 1); h.vm.editor.endDate = new Date(2026, 9, 31);
    for (const field of ['desktopLeftImageUrl', 'desktopRightImageUrl', 'mobileImageUrl']) {
        for (const link of ['javascript:alert(1)', 'data:image/svg+xml,test', '//example.org/image.jpg', 'ftp://example.org/image.jpg', 'https://user:password@example.org/image.jpg', 'bad link', 'https://example.org/' + 'a'.repeat(2048)]) {
            h.vm.editor[field] = link;
            await h.vm.save({$invalid: false});
            assert.equal(h.calls.length, 0); assert.match(h.vm.editError, /Link ảnh/);
        }
        h.vm.editor[field] = '';
    }
    assert.equal(h.vm.imageUrl(null), ''); assert.equal(h.vm.imageUrl('javascript:alert(1)'), '');
    assert.equal(h.vm.imageUrl(' https://example.org/banner.jpg '), 'https://example.org/banner.jpg');
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
    const fn = app.slice(app.indexOf('function isPublicCampaignPage()'), app.indexOf("$rootScope.$on('$stateChangeStart'", app.indexOf('function isPublicCampaignPage()')));
    for (const [pathname, allowed] of [['/campaigns', true], ['/campaigns/5', true], ['/campaigns/5/', true], ['/hoa-thieng', true], ['/hoa-thieng/', true], ['/hoa-thieng/c/'+ 'c'.repeat(32), true], ['/campaigns/c/'+ 'c'.repeat(32), true], ['/hoa-thieng/c/short', false], ['/campaigns/c/123', false], ['/hoa-thieng/5', true], ['/hoa-thieng/5/', true], ['/hoa-thieng/0', false], ['/hoa-thieng/5/edit', false], ['/hoa-thieng/admin', false], ['/campaigns/admin', false], ['/dashboard', false], ['/campaigns/0', false], ['/campaigns/5/edit', false]]) {
        const context = nodeVm.createContext({settings: {campaignsEnabled: true}, window: {location: {pathname}}}); nodeVm.runInContext(fn, context);
        assert.equal(context.isPublicCampaignPage(), allowed, pathname);
        context.settings.campaignsEnabled = false;
        assert.equal(context.isPublicCampaignPage(), false, "Domain blocked: " + pathname);
    }
});

const studentCampaign = {id:5,shareCode:'c'.repeat(32), name:'Mân Côi', startDate:'2026-09-29', endDate:'2026-10-31', flowerItems:[{itemKey:'practice-1', name:'Cầu nguyện'}]};
test('scanning the student QR opens their named sheet and persists only today', async () => {
    const h = setup({studentMode:true, admin:true, campaign:studentCampaign, entries:[{itemKey:'practice-1',date:'2026-09-30',completed:true}]});
    await tick(); assert.equal(h.vm.student.fullName, 'Nguyễn Văn An'); assert.equal(h.vm.canManage(), false);
    assert.equal(h.vm.checks['practice-1:2026-09-30'], true);
    assert.equal(h.vm.isDayLocked({date:'2026-09-30'}), true); assert.equal(h.vm.isDayLocked({date:'2026-10-02'}), true);
    assert.equal(h.vm.isDayLocked({date:'2026-10-01'}), false);
    h.vm.checks['practice-1:2026-10-01'] = true;
    await h.vm.toggleFlower(studentCampaign.flowerItems[0], {date:'2026-10-01'});
    assert.deepEqual(h.calls[1], ['check', 'a'.repeat(43), 5, '2026-10-01', 'practice-1', true]);
    assert.match(h.vm.saveNotice, /Đã lưu/);
    h.vm.checks['practice-1:2026-09-30'] = false;
    await h.vm.toggleFlower(studentCampaign.flowerItems[0], {date:'2026-09-30'});
    assert.equal(h.vm.checks['practice-1:2026-09-30'], true); assert.equal(h.calls.length, 2);
});
test('failed student saves revert the checkbox and retain a visible error', async () => {
    const h = setup({studentMode:true,campaign:studentCampaign}); await tick();
    h.service.checkFlower = async () => {throw {status:500};};
    h.vm.checks['practice-1:2026-10-01'] = true;
    await h.vm.toggleFlower(studentCampaign.flowerItems[0], {date:'2026-10-01'});
    assert.equal(h.vm.checks['practice-1:2026-10-01'], false); assert.ok(h.vm.checkError); assert.equal(Object.keys(h.vm.pendingChecks).length, 0);
});
test('prayer appears only after a new check is confirmed; failure, unchecked response and repeated true never show it',async()=>{
    const key='practice-1:2026-10-01',day={date:'2026-10-01'},item=studentCampaign.flowerItems[0];
    for(const outcome of ['success','failure','unchecked','already-checked']){
        const h=setup({studentMode:true,campaign:studentCampaign,entries:outcome==='already-checked'?[{date:day.date,itemKey:item.itemKey,completed:true}]:[]});await tick();
        let resolve,reject;h.service.checkFlower=()=>new Promise((yes,no)=>{resolve=yes;reject=no;});h.vm.checks[key]=true;
        const saving=h.vm.toggleFlower(item,day);assert.equal(h.vm.flowerPrayer,null);assert.equal(h.vm.pendingChecks['5:'+key],true);
        if(outcome==='failure')reject({status:500});else resolve({data:{completed:outcome!=='unchecked'}});await saving;
        assert.equal(!!h.vm.flowerPrayer,outcome==='success');assert.equal(h.vm.savedChecks[key]===true,outcome==='success'||outcome==='already-checked');
        assert.equal(Object.keys(h.vm.pendingChecks).length,0);
    }
});
test('prayer choices never repeat consecutively and Amen or unchecking never issues an extra write',async()=>{
    const h=setup({studentMode:true,campaign:studentCampaign});await tick();const key='practice-1:2026-10-01',day={date:'2026-10-01'},item=studentCampaign.flowerItems[0];let previous;
    for(let i=0;i<25;i++){
        h.vm.checks[key]=true;await h.vm.toggleFlower(item,day);assert.ok(h.vm.flowerPrayer);assert.notEqual(h.vm.flowerPrayer.intention,previous);previous=h.vm.flowerPrayer.intention;
        const count=h.calls.length;h.vm.closeFlowerPrayer();assert.equal(h.calls.length,count);assert.equal(h.vm.checks[key],true);assert.equal(h.vm.savedChecks[key],true);
        h.vm.checks[key]=false;await h.vm.toggleFlower(item,day);assert.equal(h.vm.flowerPrayer,null);assert.equal(h.vm.savedChecks[key],false);
    }
    assert.equal(h.calls.filter(c=>c[0]==='check').length,50);
});
test('each of the seven confirmed prayer intentions uses its matching deployed illustration',async()=>{
    const images=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/images/flower-prayers-2026/prompts.json'),'utf8')).images;
    assert.equal(images.length,7);const seen=new Set();
    for(let index=0;index<images.length;index++){
        const expected=images[index],h=setup({studentMode:true,campaign:studentCampaign,prayerRandom:()=>index/images.length});await tick();
        h.vm.checks['practice-1:2026-10-01']=true;await h.vm.toggleFlower(studentCampaign.flowerItems[0],{date:'2026-10-01'});
        assert.equal(h.vm.flowerPrayer.intention,expected.intention);assert.equal(h.vm.flowerPrayer.prayer,expected.prayer);
        const image='assets/images/flower-prayers-2026/'+expected.file.replace(/\.png$/,'.jpg');assert.equal(h.vm.flowerPrayer.image,image);
        assert.ok(fs.statSync(path.join(__dirname,'..',image)).size>0);seen.add(image);
    }
    assert.equal(seen.size,7);
});
test('overlapping saves keep a single prayer and preserve all confirmed checkboxes',async()=>{
    const campaign={...studentCampaign,flowerItems:[{itemKey:'a',name:'Cầu nguyện'},{itemKey:'b',name:'Thánh lễ'}]},h=setup({studentMode:true,campaign});await tick();const replies=[];
    h.service.checkFlower=()=>new Promise(resolve=>replies.push(resolve));const writes=campaign.flowerItems.map(item=>{h.vm.checks[item.itemKey+':2026-10-01']=true;return h.vm.toggleFlower(item,{date:'2026-10-01'});});
    replies[1]({data:{completed:true}});await writes[1];const prayer=h.vm.flowerPrayer;assert.ok(prayer);
    replies[0]({data:{completed:true}});await writes[0];assert.equal(h.vm.flowerPrayer,prayer);assert.equal(h.vm.savedChecks['a:2026-10-01'],true);assert.equal(h.vm.savedChecks['b:2026-10-01'],true);assert.equal(Object.keys(h.vm.pendingChecks).length,0);
});
test('old saves cannot open a prayer after changing QR, week or destroying the controller',async()=>{
    for(const action of ['qr','week','destroy']){
        const h=setup({studentMode:true,campaign:studentCampaign});await tick();let finish;h.service.checkFlower=()=>new Promise(resolve=>finish=resolve);
        h.vm.checks['practice-1:2026-10-01']=true;const writing=h.vm.toggleFlower(studentCampaign.flowerItems[0],{date:'2026-10-01'});
        if(action==='qr')h.vm.scanAnotherStudent();else if(action==='week')await h.vm.setWeek(1);else h.destroy();
        finish({data:{completed:true}});await writing;assert.equal(h.vm.flowerPrayer,null);
    }
});
test('an old QR response never clears the pending lock for the next student saving the same cell',async()=>{
    const h=setup({studentMode:true,campaign:studentCampaign});await tick();const replies=[];
    h.service.checkFlower=(...args)=>new Promise(resolve=>replies.push({args,resolve}));const key='practice-1:2026-10-01',pendingKey='5:'+key,day={date:'2026-10-01'},item=studentCampaign.flowerItems[0];
    h.vm.checks[key]=true;const oldSave=h.vm.toggleFlower(item,day);h.vm.scanAnotherStudent();await h.vm.useScannedQr('hs002');await tick();
    h.vm.checks[key]=true;const newSave=h.vm.toggleFlower(item,day);assert.equal(replies[0].args[0],'a'.repeat(43));assert.equal(replies[1].args[0],'b'.repeat(43));
    replies[0].resolve({data:{completed:true}});await oldSave;assert.equal(h.vm.pendingChecks[pendingKey],true);assert.equal(h.vm.flowerPrayer,null);assert.notEqual(h.vm.savedChecks[key],true);
    replies[1].resolve({data:{completed:true}});await newSave;assert.ok(h.vm.flowerPrayer);assert.equal(h.vm.savedChecks[key],true);assert.equal(h.vm.pendingChecks[pendingKey],undefined);
});
test('prayer never interrupts the garden or Rosary guide opened while a save is pending',async()=>{
    for(const view of ['gardenOpen','rosaryGuideOpen']){
        const h=setup({studentMode:true,campaign:studentCampaign});await tick();let finish;h.service.checkFlower=()=>new Promise(resolve=>finish=resolve);h.vm.checks['practice-1:2026-10-01']=true;
        const saving=h.vm.toggleFlower(studentCampaign.flowerItems[0],{date:'2026-10-01'});h.vm[view]=true;finish({data:{completed:true}});await saving;
        assert.equal(h.vm.flowerPrayer,null);assert.equal(h.vm.savedChecks['practice-1:2026-10-01'],true);
    }
});
test('malformed student QR never calls the API', async () => {
    const h = setup({studentMode:true,token:'hs0001',campaign:studentCampaign}); await tick();
    assert.match(h.vm.error, /Mã QR/); assert.equal(h.calls.length, 0); assert.equal(h.vm.campaign, undefined);
});

test('Vietnam midnight locks yesterday immediately, preserves saved checks and cleans up its timer', async () => {
    const beforeMidnight = Date.UTC(2026,9,1,16,59,59);
    const clock = {now: Date.UTC(2020,0,1)}; // The phone clock is intentionally wrong.
    const h = setup({studentMode:true, campaign:studentCampaign, clock, serverTime:beforeMidnight,
        entries:[{itemKey:'practice-1',date:'2026-10-01',completed:true}]});
    await tick();
    assert.equal(h.vm.isDayLocked({date:'2026-10-01'}), false);
    assert.equal(h.vm.isDayLocked({date:'2026-10-02'}), true);
    assert.equal(h.getDayDelay(), 1050);
    clock.now += 1100; h.midnight();
    assert.equal(h.getDigests(), 1);
    assert.equal(h.vm.isDayLocked({date:'2026-10-01'}), true);
    assert.equal(h.vm.isDayLocked({date:'2026-10-02'}), false);
    h.vm.checks['practice-1:2026-10-01'] = false;
    await h.vm.toggleFlower(studentCampaign.flowerItems[0], {date:'2026-10-01'});
    assert.equal(h.vm.checks['practice-1:2026-10-01'], true);
    assert.equal(h.calls.some(call => call[0] === 'check'), false);
    h.destroy(); assert.equal(h.hasDayTimer(), false);
});

test('the shared flower link shows scanning without requiring a login or personal URL', async () => {
    const h = setup({studentMode:true,token:''}); await tick();
    assert.equal(h.vm.needsScan, true); assert.equal(h.vm.error, undefined); assert.equal(h.calls.length, 0);
});
test('scanning an already printed card resolves the student and remembers the personal sheet', async () => {
    const urls=[];
    const h = setup({studentMode:true,token:'',campaign:studentCampaign,windowExtras:{history:{replaceState(a,b,url){urls.push(url);}}}});
    await h.vm.useScannedQr(' hs001 ');
    assert.deepEqual(h.calls[0], ['scan','hs001']); assert.equal(h.vm.needsScan, false);
    assert.equal(h.vm.student.fullName, 'Nguyễn Văn An'); assert.equal(h.vm.campaign.id, 5);
    assert.equal(urls[0], '/hoa-thieng#'+'b'.repeat(43));
    h.vm.scanAnotherStudent(); assert.equal(h.vm.needsScan, true); assert.equal(h.vm.student, null);
    assert.equal(h.vm.campaign, null); assert.equal(urls[1], '/hoa-thieng');
});
test('unrecognized cards retain the scan page and valid new QR links continue to work', async () => {
    const h = setup({studentMode:true,token:'',campaign:studentCampaign,windowExtras:{location:{hostname:'localhost',hash:''}}});
    h.service.scanStudentQr = async () => {throw {status:404};};
    await h.vm.useScannedQr('unknown'); assert.equal(h.vm.needsScan, true); assert.match(h.vm.scanError, /thẻ học sinh/);
    await h.vm.useScannedQr('https://evil.example/hoa-thieng#'+'a'.repeat(43));
    assert.match(h.vm.scanError, /không phải/); assert.equal(h.vm.campaign, undefined);
    await h.vm.useScannedQr('https://tnttphungkhoang.com/hoa-thieng#'+'a'.repeat(43));
    assert.equal(h.vm.needsScan, false); assert.equal(h.vm.campaign.id, 5);
});


test('a campaign share link scans an old card into exactly that campaign, even with other active campaigns', async () => {
    const urls=[];
    const target={...studentCampaign,id:9,startDate:'2026-09-01'};
    const h=setup({studentMode:true,token:'',campaignId:9,campaign:target,activeCampaigns:[studentCampaign,{...studentCampaign,id:12}],windowExtras:{history:{replaceState(a,b,url){urls.push(url);}}}});
    await tick(); assert.equal(h.vm.targetCampaign.id,9); assert.equal(h.vm.needsScan,true);
    await h.vm.useScannedQr('hs001');
    assert.equal(h.vm.campaign.id,9); assert.equal(h.vm.student.fullName,'Nguyễn Văn An');
    assert.deepEqual(h.calls.find(c=>c[0]==='sheet'),['sheet','b'.repeat(43),9,4]);
    assert.equal(urls[0],'/hoa-thieng/9#'+'b'.repeat(43));
    h.vm.scanAnotherStudent(); assert.equal(urls[1],'/hoa-thieng/9');
    await h.vm.useScannedQr('https://tnttphungkhoang.com/hoa-thieng/12#'+'a'.repeat(43));
    assert.equal(h.vm.campaign.id,9); // A personal QR must not replace the campaign the manager shared.

});

test('refreshing a targeted link retains the selection and missing campaigns never fall back to another', async () => {
    const h=setup({studentMode:true,campaignId:5,campaign:studentCampaign,activeCampaigns:[]});
    await tick(); assert.equal(h.vm.campaign.id,5);
    const missing=setup({studentMode:true,token:'',campaignId:999,getError:{status:404},activeCampaigns:[studentCampaign]});
    await tick(); assert.match(missing.vm.error,/không còn tồn tại/);
    await missing.vm.useScannedQr('hs001'); assert.equal(missing.calls.length,0);
});

test('expired campaign links still show saved history and expire on Vietnam dates', async () => {
    const campaign={...studentCampaign,endDate:'2026-09-30'};
    const h=setup({studentMode:true,campaignId:5,campaign,clock:{now:Date.UTC(2020,0,1)}});
    await tick(); assert.equal(h.vm.campaign.id,5); assert.equal(h.vm.isExpired(campaign),true);
    assert.equal(h.vm.isDayLocked({date:'2026-09-30'}),true);
    assert.equal(h.vm.status(campaign),'Đã kết thúc');
    assert.equal(h.vm.isExpired({...campaign,endDate:'2026-10-01'}),false);
});

test('sharing generates distinct campaign links and QR images without any student token', async () => {
    const links=[],copied=[];
    const h=setup({admin:true,windowExtras:{QRCode:{toDataURL:async link=>{links.push(link);return 'data:image/png;base64,aGVsbG8=';}},navigator:{clipboard:{writeText:async link=>copied.push(link)}}}});
    const campaign={...studentCampaign,endDate:'2099-12-31'};
    await h.vm.copyLink(campaign); await h.vm.showQr(campaign);
    assert.equal(copied[0],'https://tnttphungkhoang.com/hoa-thieng/c/'+'c'.repeat(32));
    assert.equal(links[0],copied[0]); assert.ok(h.vm.share.image);
    await h.vm.showQr({...campaign,id:8,shareCode:'d'.repeat(32)}); assert.notEqual(links[0],links[1]);
    assert.equal(links.some(link=>link.includes('#')),false);
    await h.vm.copyLink({...campaign,endDate:'2000-01-01'}); assert.equal(copied.length,1);
    h.settings.isAdmin=false; await h.vm.showQr(campaign); assert.equal(links.length,2);
});

test('only Admin and both manager roles can print; students and anonymous viewers cannot', async () => {
    const campaign={...studentCampaign,endDate:'2099-12-31'};
    for(const role of ['isAdmin','isEducationManagerment','isStudentManagerment','isStaff','isViewer',null]) {
        const h=setup({id:5,campaign}); await tick(); if(role)h.settings[role]=true;
        const allowed=['isAdmin','isEducationManagerment','isStudentManagerment'].includes(role);
        assert.equal(h.vm.canPrint(),allowed); h.vm.print(); assert.equal(h.calls.length,allowed?1:0);
        h.settings.permissionsLoaded=false; h.vm.print(); assert.equal(h.calls.length,allowed?1:0);
    }
});

test('image edits preview immediately, warn when unsaved, block leaving and save the opacity', async () => {
    const listeners={}; const h=setup({manager:true,campaign:studentCampaign,windowExtras:{confirm:()=>false,addEventListener:(e,fn)=>listeners[e]=fn,removeEventListener:e=>delete listeners[e]}});
    await h.vm.edit({id:5}); assert.equal(h.vm.hasUnsavedImages(),false);
    h.vm.editor.mobileImageUrl='https://example.org/background.jpg'; h.vm.editor.flowerBackgroundOpacity=45;
    assert.equal(h.vm.imageOptions().mobileImageUrl,'https://example.org/background.jpg'); assert.equal(h.vm.backgroundOpacity(h.vm.imageOptions()),.45);
    assert.equal(h.vm.hasUnsavedImages(),true); assert.equal(h.vm.campaign,undefined);
    let prevented=false; h.events.$stateChangeStart({preventDefault(){prevented=true;}}); assert.equal(prevented,true);
    const event={preventDefault(){this.prevented=true;}}; listeners.beforeunload(event); assert.equal(event.prevented,true);
    h.vm.cancelEdit(); assert.ok(h.vm.editor);
    await h.vm.save({$invalid:false}); assert.equal(h.calls[0][1].flowerBackgroundOpacity,45); assert.equal(h.vm.hasUnsavedImages(),false);
    h.destroy(); assert.equal(listeners.beforeunload,undefined);
});

test('background opacity supports transparent and fully visible images, and invalid values never save', async () => {
    const h=setup({manager:true});h.vm.create();h.vm.editor.startDate=new Date(2026,9,1);h.vm.editor.endDate=new Date(2026,9,31);
    assert.equal(h.vm.backgroundOpacity({}),.2);assert.equal(h.vm.backgroundOpacity({flowerBackgroundOpacity:0}),0);assert.equal(h.vm.backgroundOpacity({flowerBackgroundOpacity:100}),1);
    for(const value of [-1,101,NaN,5.5]) {h.vm.editor.flowerBackgroundOpacity=value;await h.vm.save({$invalid:false});assert.equal(h.calls.length,0);assert.match(h.vm.editError,/0 đến 100/);}
    const original='Mỗi ngày thực hành. Nộp phiếu theo hướng dẫn của xứ đoàn. Cầu nguyện cùng gia đình.';
    assert.equal(h.vm.flowerInstructions({flowerInstructions:original}),'Mỗi ngày thực hành.  Cầu nguyện cùng gia đình.');
});

test('the range input can emit numeric strings and they are saved as JSON integers', async()=>{
 const h=setup({manager:true});h.vm.create();h.vm.editor.startDate=new Date(2026,9,1);h.vm.editor.endDate=new Date(2026,9,31);h.vm.editor.flowerBackgroundOpacity='45';await h.vm.save({$invalid:false});assert.equal(h.calls[0][1].flowerBackgroundOpacity,45);
});

test('opaque campaign codes resolve to the selected campaign before scanning and retain the code in the URL', async()=>{
 const urls=[],code='d'.repeat(32);const h=setup({studentMode:true,token:'',campaignCode:code,campaign:studentCampaign,activeCampaigns:[{...studentCampaign,id:9}],windowExtras:{history:{replaceState(a,b,url){urls.push(url);}}}});
 await tick();assert.deepEqual(h.calls[0],['code',code]);assert.equal(h.vm.targetCampaign.id,5);await h.vm.useScannedQr('hs001');assert.equal(h.vm.campaign.id,5);assert.equal(urls[0],'/hoa-thieng/c/'+code+'#'+'b'.repeat(43));assert.equal(h.vm.chooseCampaign,undefined);
});

test('public campaign pages use the opaque code while missing codes never select a different campaign',async()=>{
 const h=setup({campaignCode:'c'.repeat(32),campaign:studentCampaign});await tick();assert.equal(h.vm.campaign.id,5);assert.deepEqual(h.calls[0],['code','c'.repeat(32)]);
 const missing=setup({studentMode:true,token:'',campaignCode:'f'.repeat(32),getError:{status:404}});await tick();assert.match(missing.vm.error,/không còn tồn tại/);await missing.vm.useScannedQr('hs001');assert.equal(missing.calls.some(c=>c[0]==='scan'),false);
});

test('crop and zoom settings are independent for each image, preview immediately and persist as numbers',async()=>{
 const saved={...studentCampaign,imageCrops:{mobileImageUrl:{zoom:125,x:10,y:-5}}};const h=setup({manager:true,campaign:saved});await h.vm.edit({id:5});assert.equal(h.vm.hasUnsavedImages(),false);
 h.vm.editor.imageCrops.desktopLeftImageUrl={zoom:'175',x:'-15',y:'25'};h.vm.editor.imageCrops.desktopRightImageUrl={zoom:50,x:100,y:-100};
 assert.equal(h.vm.hasUnsavedImages(),true);assert.equal(h.vm.imageStyle('desktopLeftImageUrl',h.vm.editor).transform,'translate(-15%, 25%) scale(1.75)');assert.equal(saved.imageCrops.mobileImageUrl.zoom,125);
 await h.vm.save({$invalid:false});const crops=h.calls.find(c=>c[0]==='save')[1].imageCrops;
 assert.deepEqual(structuredClone(crops.desktopLeftImageUrl),{zoom:175,x:-15,y:25});assert.equal(crops.mobileImageUrl.zoom,125);assert.equal(crops.desktopRightImageUrl.zoom,50);
 await h.vm.edit({id:5});h.vm.editor.imageCrops.mobileImageUrl.zoom=250;h.vm.resetImageCrop('mobileImageUrl');assert.equal(h.vm.editor.imageCrops.mobileImageUrl.zoom,100);
 h.vm.changeImageZoom(-200);assert.equal(h.vm.editor.imageCrops.mobileImageUrl.zoom,50);h.vm.changeImageZoom(999);assert.equal(h.vm.editor.imageCrops.mobileImageUrl.zoom,300);
});

function cropDrag(rotated=false){
 let factory,destroy;const events={},pending=[],crop={zoom:150,x:0,y:0};
 nodeVm.runInNewContext(source,{angular:{module:()=>({controller(){},directive(name,registration){if(name==='campaignImageCrop')factory=registration.at(-1);}})}});
 const frame={closest:()=>({}),getBoundingClientRect:()=>({width:rotated?300:400,height:rotated?400:300}),setPointerCapture(){},addEventListener:(e,fn)=>events[e]=fn,removeEventListener:e=>delete events[e]};
 const vm={canManage:()=>true,imageUrl:v=>v,editor:{mobileImageUrl:'https://example.org/image.jpg',imageCrops:{mobileImageUrl:crop}},cropField:'mobileImageUrl'};
 factory({getComputedStyle:()=>({transform:rotated?'matrix(0,-1,1,0,0,0)':'none'})}).link({vm,$evalAsync:fn=>pending.push(fn),$on:(e,fn)=>destroy=fn},[frame]);
 return{vm,crop,events,flush(){pending.splice(0).forEach(fn=>fn());},destroy(){destroy();}};
}
test('image dragging follows normal and rotated mobile coordinates, survives release before the digest, and cleans up listeners',()=>{
 const h=cropDrag();h.events.pointerdown({button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){}});h.events.pointermove({pointerId:2,clientX:999,clientY:999});assert.equal(h.crop.x,0);
 h.events.pointermove({pointerId:1,clientX:140,clientY:130});h.events.pointerup();h.flush();assert.deepEqual(h.crop,{zoom:150,x:10,y:10});h.destroy();assert.equal(Object.keys(h.events).length,0);
 const mobile=cropDrag(true);mobile.events.pointerdown({button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){}});mobile.events.pointermove({pointerId:1,clientX:130,clientY:20});mobile.flush();assert.equal(mobile.crop.x,20);assert.equal(mobile.crop.y,10);
 mobile.events.pointermove({pointerId:1,clientX:9999,clientY:-9999});mobile.flush();assert.equal(mobile.crop.x,100);assert.equal(mobile.crop.y,100);
 mobile.events.pointercancel();mobile.events.pointermove({pointerId:1,clientX:0,clientY:0});mobile.flush();assert.equal(mobile.crop.x,100);
});

test('disabled campaign domains redirect before requesting data, registering listeners or starting timers', async () => {
    for (const campaignsEnabled of [false, null]) {
        for (const params of [{}, {campaignCode: 'c'.repeat(32)}, {studentMode: true, token: '', campaignCode: 'c'.repeat(32)}, {studentMode: true}]) {
            const listeners = [];
            const h = setup({...params, campaignsEnabled, admin: true, clock: {now: Date.UTC(2026,9,1)}, windowExtras: {addEventListener: name => listeners.push(name)}});
            await tick();
            assert.deepEqual(h.apiCalls, []);
            assert.deepEqual(structuredClone(h.calls), [['go', 'login', {showHome: true}, {location: 'replace'}]]);
            assert.equal(h.hasDayTimer(), false);
            assert.deepEqual(h.watches, []);
            assert.deepEqual(Object.keys(h.events), []);
            assert.deepEqual(listeners, []);
            assert.equal(h.vm.campaign, undefined);
        }
    }
});

test('crop frames and side previews retain 9:16 regardless of available side space', () => {
    const h = setup({manager: true}); h.vm.create(); h.vm.imageFrameRatios = {desktopLeftImageUrl: 348/868, desktopRightImageUrl: 90/374};
    h.vm.cropField = 'desktopLeftImageUrl'; assert.equal(h.vm.cropFrameStyle().aspectRatio, 9/16); assert.equal(h.vm.previewSideStyle(h.vm.cropField).aspectRatio, 9/16);
    h.vm.cropField = 'desktopRightImageUrl'; assert.equal(h.vm.cropFrameStyle().aspectRatio, 9/16); assert.equal(h.vm.previewSideStyle(h.vm.cropField).aspectRatio, 9/16);
    h.vm.cropField = 'mobileImageUrl'; assert.deepEqual(structuredClone(h.vm.cropFrameStyle()), {});
});

function editorLayout(mobile) {
    let factory, destroy, watch, stopped = false;
    const events = {}, queue = new Map(), scrolls = [], vm = {}; let next = 0;
    const side = {clientWidth: 348, clientHeight: 868};
    const viewport = {querySelector: () => side};
    const page = {scrollTo: options => scrolls.push(['page', options])};
    const editor = {offsetTop: 235, closest: selector => selector === '.campaign-viewport' ? viewport : page, scrollIntoView: options => scrolls.push(['document', options])};
    const timeout = fn => {const id = ++next; queue.set(id, fn); return id;}; timeout.cancel = id => queue.delete(id);
    nodeVm.runInNewContext(source, {angular: {module: () => ({controller() {}, directive(name, registration) {if(name === 'campaignEditor') factory = registration.at(-1);}})}});
    factory({getComputedStyle: () => ({overflowY: mobile ? 'auto' : 'visible'}), addEventListener: (e, fn) => events[e] = fn, removeEventListener: e => delete events[e]}, timeout).link({vm, $watchGroup: (names, fn) => {watch = fn; return () => {stopped = true;};}, $on: (e, fn) => destroy = fn}, [editor]);
    return {vm, side, events, scrolls, watch: () => watch(), pending: () => queue.size, stopped: () => stopped, flush() {const current=[...queue.values()]; queue.clear();current.forEach(fn=>fn());}, destroy: () => destroy()};
}

test('opening an editor scrolls to its start on desktop and in the rotated mobile scroller', () => {
    for (const mobile of [false, true]) {
        const h = editorLayout(mobile); h.flush();
        assert.equal(h.scrolls[0][0], mobile ? 'page' : 'document');
        if (mobile) assert.equal(h.scrolls[0][1].top, 220); else assert.equal(h.scrolls[0][1].block, 'start');
        assert.equal(h.scrolls.length, 1); h.destroy(); assert.equal(h.pending(), 0);
        const pending = editorLayout(mobile); assert.equal(pending.pending(), 1);
        pending.destroy(); pending.flush(); assert.equal(pending.scrolls.length, 0);
    }
});


test('invalid numeric crop edits cannot save after switching to another image tab', async () => {
    const h=setup({manager:true});h.vm.create();h.vm.editor.startDate=new Date(2026,9,1);h.vm.editor.endDate=new Date(2026,9,31);
    for (const [key,value] of [['zoom',301],['zoom',49],['zoom',undefined],['x',101],['y',-101],['x',1.5],['y',undefined]]) {
        h.vm.editor.imageCrops.mobileImageUrl={zoom:100,x:0,y:0};
        h.vm.editor.imageCrops.mobileImageUrl[key]=value;h.vm.cropField='desktopLeftImageUrl';
        await h.vm.save({$invalid:false});
        assert.equal(h.calls.length,0);assert.match(h.vm.editError,/Zoom ảnh phải/);assert.ok(h.vm.editor);
    }
});


test('reordering daily practices saves their order while retaining keys and instructions', async () => {
    const items=[{itemKey:'pray',name:'Cầu nguyện',instructions:'Kinh sáng'},{itemKey:'mass',name:'Thánh lễ',instructions:'Chủ nhật'},{itemKey:'good',name:'Việc tốt',instructions:'Giúp gia đình'}];
    const h=setup({manager:true,campaign:{id:5,name:'Chiến dịch',startDate:'2026-10-01',endDate:'2026-10-31',flowerItems:items}});
    await h.vm.edit({id:5});h.vm.moveItem(1,-1);
    assert.deepEqual(structuredClone(h.vm.editor.flowerItems.map(i=>i.itemKey)),['mass','pray','good']);
    h.vm.moveItem(0,-1);h.vm.moveItem(2,1);h.vm.moveItem(1,0);
    assert.deepEqual(structuredClone(h.vm.editor.flowerItems.map(i=>i.itemKey)),['mass','pray','good']);
    h.vm.moveItem(1,1);h.vm.saving=true;h.vm.moveItem(0,1);h.vm.saving=false;
    await h.vm.save({$invalid:false});
    assert.deepEqual(structuredClone(h.calls.find(c=>c[0]==='save')[1].flowerItems),[items[1],items[2],items[0]]);
    assert.deepEqual(items.map(i=>i.itemKey),['pray','mass','good']);
});

test('daily practice order cannot be changed without management permission', () => {
    const h=setup({manager:true});h.vm.create();h.vm.addItem();
    const original=h.vm.editor.flowerItems[0];h.settings.isEducationManagerment=false;
    h.vm.moveItem(0,1);assert.equal(h.vm.editor.flowerItems[0],original);
});

const rosary2026 = require('../campaign/rosary2026/RosaryCampaign2026.js');
const rosaryCampaign = {id: 7, name: 'Cùng Mẹ, em yêu mến Chúa', startDate: '2026-10-01', endDate: '2026-10-31', flowerItems: [{itemKey:'rosary',name:'Lần hạt một chục'}]};
function rosarySetup(options = {}) {
    const clock = options.clock || {now: Date.UTC(2026, 9, 2, 5)};
    return setup({studentMode: true, campaign: rosaryCampaign, clock, serverTime: clock.now, windowExtras:{RosaryCampaign2026: rosary2026}, ...options});
}
test('QR success opens participation first, then today guide, without recording a practice', async () => {
    const h = rosarySetup({token:'', campaignId:7}); await tick();
    assert.equal(h.vm.needsScan,true); assert.equal(h.vm.rosaryGuide,null);
    await h.vm.useScannedQr('hs001'); await tick();
    assert.equal(h.vm.needsScan,false); assert.equal(h.vm.rosaryGuideOpen,true);
    assert.equal(h.vm.rosaryGuide.group,'sang'); assert.equal(h.vm.rosaryGuide.number,1);
    assert.equal(h.apiCalls.filter(name => name === 'checkFlower').length,0);
    const guide=h.vm.rosaryGuide, apiCount=h.apiCalls.length;
    assert.equal(h.vm.rosaryParticipationOpen,true);
    h.vm.openRosaryInstructions(); assert.equal(h.vm.rosaryInstructionsOpen,false);
    h.vm.openRosaryGuide(); assert.equal(h.vm.rosaryParticipationOpen,false);
    assert.equal(h.vm.rosaryGuideOpen,true); assert.equal(h.vm.rosaryGuide,guide);
    assert.equal(h.apiCalls.length,apiCount);
    h.vm.openRosaryInstructions(); assert.equal(h.vm.rosaryInstructionsOpen,true);
    assert.equal(h.vm.rosaryGuide,guide); assert.equal(h.apiCalls.length,apiCount);
    h.vm.closeRosaryInstructions(); assert.equal(h.vm.rosaryInstructionsOpen,false);
    assert.equal(h.vm.rosaryGuide,guide);
    h.vm.openRosaryInstructions(); h.vm.closeRosaryGuide();
    assert.equal(h.vm.rosaryInstructionsOpen,false);
    h.vm.openRosaryInstructions(); assert.equal(h.vm.rosaryInstructionsOpen,false);
    await h.vm.setWeek(1);
    assert.equal(h.vm.rosaryGuideOpen,false); assert.equal(h.vm.rosaryGuide.number,1);
    h.vm.openRosaryGuide(); assert.equal(h.vm.rosaryGuideOpen,true);
    h.vm.refreshRosaryGuide(); assert.equal(h.vm.rosaryGuide.number,1);
    h.vm.openRosaryInstructions(); h.vm.scanAnotherStudent(); assert.equal(h.vm.rosaryParticipationOpen,false); assert.equal(h.vm.rosaryGuide,null); assert.equal(h.vm.rosaryGuideOpen,false); assert.equal(h.vm.rosaryInstructionsOpen,false);
});
test('participation can open the sheet directly and reopening shows today without resetting checks', async () => {
    const h = rosarySetup({entries:[{itemKey:'rosary',date:'2026-10-02',completed:true}]}); await tick();
    assert.equal(h.vm.rosaryParticipationOpen,true);
    const guide=h.vm.rosaryGuide, apiCount=h.apiCalls.length;
    await h.vm.closeRosaryGuide();
    assert.equal(h.vm.rosaryParticipationOpen,false); assert.equal(h.vm.rosaryGuideOpen,false);
    assert.equal(h.vm.checks['rosary:2026-10-02'],true);
    h.vm.openRosaryGuide();
    assert.equal(h.vm.rosaryParticipationOpen,false); assert.equal(h.vm.rosaryGuideOpen,true);
    assert.equal(h.vm.rosaryGuide,guide); assert.equal(h.apiCalls.length,apiCount);
    assert.equal(h.vm.checks['rosary:2026-10-02'],true);
    h.vm.openRosaryInstructions(); assert.equal(h.vm.rosaryInstructionsOpen,true);
    h.vm.openRosaryParticipation();
    assert.equal(h.vm.rosaryParticipationOpen,true); assert.equal(h.vm.rosaryInstructionsOpen,false);
    assert.equal(h.vm.rosaryGuide,guide); assert.equal(h.apiCalls.length,apiCount);
    assert.equal(h.vm.checks['rosary:2026-10-02'],true);
    h.vm.openRosaryGuide();
    assert.equal(h.vm.rosaryParticipationOpen,false); assert.equal(h.vm.rosaryGuide,guide);
    assert.equal(h.vm.checks['rosary:2026-10-02'],true);
    h.vm.scanAnotherStudent(); await h.vm.useScannedQr('hs002'); await tick();
    assert.equal(h.vm.rosaryParticipationOpen,true); assert.equal(h.vm.rosaryGuideOpen,true);
});
test('unassigned class refresh changes mystery and week reload retains it', async () => {
    const h = rosarySetup({classes:['HT']}); await tick();
    const initial = h.vm.rosaryGuide.imageUrl; assert.equal(h.vm.rosaryGuide.randomizable,true);
    h.vm.refreshRosaryGuide(); const changed = h.vm.rosaryGuide.imageUrl; assert.notEqual(changed,initial);
    h.vm.closeRosaryGuide(); await h.vm.setWeek(2);
    assert.equal(h.vm.rosaryGuide.imageUrl,changed); assert.equal(h.vm.rosaryGuideOpen,false);
});
test('Vietnam midnight advances guide, reopening it, and campaign expiry clears it', async () => {
    const clock = {now: Date.UTC(2026,9,2,16,59,50)}, h=rosarySetup({clock}); await tick();
    h.vm.closeRosaryGuide(); clock.now += 11000; h.midnight();
    assert.equal(h.vm.rosaryGuide.number,2); assert.equal(h.vm.rosaryGuide.date,'2026-10-03'); assert.equal(h.vm.rosaryGuideOpen,true);
    clock.now = Date.UTC(2026,9,31,17); h.midnight();
    assert.equal(h.vm.rosaryGuide,null); assert.equal(h.vm.rosaryGuideOpen,false);
});
test('other campaign names, managers and disabled domains never receive a Rosary guide', async () => {
    for (const options of [{campaign:{...rosaryCampaign,name:'Chiến dịch khác'}},{studentMode:false,id:7},{campaignsEnabled:false}]) {
        const h=rosarySetup(options); await tick(); assert.ok(!h.vm.rosaryGuide); assert.ok(!h.vm.rosaryGuideOpen);
    }
});

test('opening the guide exits sheet fullscreen and returning opens the current week', async () => {
    const h = rosarySetup({clock:{now:Date.UTC(2026,9,8,5)}}); await tick();
    assert.equal(h.vm.weekIndex,1); h.vm.closeRosaryGuide(); await h.vm.setWeek(0);
    let exits=0; h.vm.fullscreen=true; h.vm.toggleFullscreen=()=>{exits++;h.vm.fullscreen=false;};
    h.vm.openRosaryGuide(); assert.equal(exits,1); assert.equal(h.vm.rosaryGuideOpen,true);
    await h.vm.closeRosaryGuide(); assert.equal(h.vm.weekIndex,1); assert.equal(h.vm.rosaryGuideOpen,false);
    assert.ok(h.vm.weekDays.some(day=>day.date==='2026-10-08'));
});

test('garden paint, confirmation reset and failed save preserve confirmed checks', async () => {
    const campaign={...rosaryCampaign,flowerItems:[{itemKey:'a',name:'Lần hạt'},{itemKey:'b',name:'Thánh lễ'},{itemKey:'c',name:'Cầu nguyện'},{itemKey:'d',name:'Hy sinh'}]};
    const h=setup({studentMode:true,campaign,serverTime:Date.UTC(2026,9,2,5),entries:[{date:'2026-10-02',itemKey:'a',completed:true}],windowExtras:{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js')}});
    await tick();await tick();assert.equal(h.vm.gardenEnabled(),true);
    await h.vm.openGarden();h.vm.selectGardenDay(h.vm.garden.flowers[1]);assert.equal(h.vm.gardenDay.available,1);
    await h.vm.paintGardenPetal(h.vm.gardenDay.petals[1]);
    assert.equal(h.vm.gardenDay.used,1);assert.equal(h.vm.gardenDay.available,0);assert.equal(h.vm.checks['a:2026-10-02'],true);assert.equal(h.vm.checks['b:2026-10-02'],false);
    await h.vm.paintGardenPetal(h.vm.gardenDay.petals[2]);assert.equal(h.calls.filter(x=>x[0]==='paint').length,1);
    await h.vm.resetGardenPaint();assert.equal(h.calls.filter(x=>x[0]==='resetPaint').length,0);
    h.vm.gardenResetConfirm=true;await h.vm.resetGardenPaint();assert.equal(h.vm.gardenDay.used,0);assert.equal(h.vm.gardenDay.available,1);assert.equal(h.vm.checks['a:2026-10-02'],true);
    h.service.paintFlower=async()=>{throw {status:500};};
    await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);assert.equal(h.vm.gardenDay.available,1);assert.equal(h.vm.gardenBusy,false);assert.ok(h.vm.gardenError);
});
test('garden ignores an outstanding response after switching student QR', async () => {
    const h=setup({studentMode:true,campaign:rosaryCampaign,serverTime:Date.UTC(2026,9,2,5),windowExtras:{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js')}});
    await tick();await tick();let resolve;
    h.service.studentGarden=()=>new Promise(r=>resolve=r);
    const loading=h.vm.openGarden();h.vm.scanAnotherStudent();
    resolve({data:{campaign:rosaryCampaign,entries:[{date:'2026-10-02',itemKey:'rosary',completed:true}],serverTime:Date.UTC(2026,9,2,5)}});await loading;
    assert.equal(h.vm.gardenOpen,false);assert.equal(h.vm.garden,null);assert.equal(h.vm.student,null);assert.equal(h.vm.campaign,null);assert.equal(h.vm.gardenLoading,false);
});

test('petal eraser works without confirmation, restores one credit and preserves other colors on failure', async () => {
    const campaign={...rosaryCampaign,flowerItems:[{itemKey:'a',name:'Lần hạt'},{itemKey:'b',name:'Thánh lễ'}]};
    const entries=[{date:'2026-10-01',itemKey:'a',completed:true,paintColor:'#F48FB1'},
        {date:'2026-10-02',itemKey:'a',completed:true,paintColor:'#EF5350'},
        {date:'2026-10-02',itemKey:'b',completed:true,paintColor:'#81D4FA'}];
    const h=setup({studentMode:true,campaign,serverTime:Date.UTC(2026,9,2,5),entries,windowExtras:{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js')}});
    await tick();await h.vm.openGarden();h.vm.selectGardenDay(h.vm.garden.flowers[1]);
    h.vm.selectGardenEraser();assert.equal(h.vm.gardenEraseMode,true);assert.equal(h.vm.gardenResetConfirm,false);
    const erase=h.service.eraseFlowerPetal;h.service.eraseFlowerPetal=async()=>{throw {status:500};};
    await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);assert.equal(h.vm.gardenDay.used,2);assert.equal(h.vm.gardenResetConfirm,false);assert.equal(h.vm.gardenBusy,false);assert.ok(h.vm.gardenError);
    h.service.eraseFlowerPetal=erase;await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);
    assert.equal(h.vm.gardenDay.used,1);assert.equal(h.vm.gardenDay.available,1);assert.equal(h.vm.gardenDay.petals[1].color,'#81D4FA');assert.equal(h.vm.garden.flowers[0].used,1);
    assert.equal(h.vm.checks['a:2026-10-02'],true);assert.equal(h.vm.checks['b:2026-10-02'],true);
    assert.equal(h.calls.filter(x=>x[0]==='resetPaint').length,0);assert.equal(h.calls.filter(x=>x[0]==='erasePetal').length,1);
    await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);assert.equal(h.calls.filter(x=>x[0]==='erasePetal').length,1);
    h.vm.selectGardenColor('#FFE082');assert.equal(h.vm.gardenEraseMode,false);await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);assert.equal(h.vm.gardenDay.used,2);
});

test('petal erase cannot duplicate an in-flight write or populate a different student', async () => {
    const campaign={...rosaryCampaign};
    const h=setup({studentMode:true,campaign,serverTime:Date.UTC(2026,9,2,5),entries:[{date:'2026-10-02',itemKey:'rosary',completed:true,paintColor:'#EF5350'}],windowExtras:{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js')}});
    await tick();await h.vm.openGarden();h.vm.selectGardenDay(h.vm.garden.flowers[1]);h.vm.selectGardenEraser();
    let resolve,calls=0;h.service.eraseFlowerPetal=()=>{calls++;return new Promise(r=>resolve=r);};
    const pending=h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);await h.vm.paintGardenPetal(h.vm.gardenDay.petals[0]);assert.equal(calls,1);
    h.vm.scanAnotherStudent();resolve({data:{campaign,entries:[],serverTime:Date.UTC(2026,9,2,5)}});await pending;
    assert.equal(h.vm.garden,null);assert.equal(h.vm.student,null);assert.equal(h.vm.gardenDay,null);assert.equal(h.vm.gardenEraseMode,false);
});
test('personal PNG uses fresh checks and human identity, and never downloads after changing QR',async()=>{
    for(const changed of [false,true]){
        const downloads=[],cards=[];let finish;
        const exporter={create:(c,g)=>{cards.push(g);return new Promise(r=>finish=r);},fileName:g=>g.fullName+'.png',download:(...args)=>downloads.push(args)};
        const h=setup({studentMode:true,campaign:rosaryCampaign,serverTime:Date.UTC(2026,9,2,5),entries:[{date:'2026-10-02',itemKey:'rosary',completed:true,paintColor:'#EF5350'}],windowExtras:{FlowerGarden2026:require('../campaign/rosary2026/FlowerGarden2026.js'),GardenImageExport:exporter}});
        await tick();await h.vm.openGarden();const exporting=h.vm.exportGardenImage();await tick();assert.equal(cards.length,1);assert.equal(cards[0].completedCount,1);assert.equal(cards[0].saintName,'Đa Minh');assert.equal(cards[0].fullName,'Nguyễn Văn An');assert.equal(cards[0].colors[0].paintColor,'#EF5350');assert.equal(JSON.stringify(cards).includes('hs001'),false);
        if(changed)h.vm.scanAnotherStudent();finish(new Blob(['PNG']));await exporting;assert.equal(downloads.length,changed?0:1);assert.equal(h.vm.gardenExportBusy,false);
    }
});
