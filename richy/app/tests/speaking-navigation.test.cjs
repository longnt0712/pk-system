const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const dashboard = read('dashboards/views/general-alt.html');
const header = read('common/views/navs/header-hoz.html');
const attr = (tag, name) => {
    const match = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
    assert.ok(match, 'Missing attribute: ' + name);
    return match[1];
};

test('the Speaking Studio dashboard card opens personal Studio for every IELTSRoom account', () => {
    const card = dashboard.match(/<div class="learning-tile-wrap"[^>]*>\s*<a[^>]*ui-sref="application\.speaking"[^>]*>[\s\S]*?<\/a>\s*<\/div>/);
    assert.ok(card, 'Dashboard must have a direct Studio card');
    const condition = attr(card[0].slice(0, card[0].indexOf('>') + 1), 'ng-if');
    for (const vm of [{isRoleView:true}, {isRoleUser:true}, {isRoleAdmin:true}, {}]) {
        assert.equal(nodeVm.runInNewContext(condition, {settings:{ieltsRoom:true}, vm}), true);
    }
    assert.equal(nodeVm.runInNewContext(condition, {settings:{ieltsRoom:false}, vm:{isRoleAdmin:true}}), false);
    assert.match(card[0], /href="speaking"/);
    assert.match(card[0], /fa-microphone/);
    assert.match(card[0], /SPEAKING STUDIO/);
});

test('Studio and creation have separate menu routes and creation follows the admin gate', () => {
    const create = header.match(/<li[^>]*ng-class="\{'active':[^\"]*application\.create_speaking_test[^\"]*"[^>]*>[\s\S]*?<\/li>/);
    assert.ok(create, 'Creation menu entry must be distinct from Studio');
    const condition = attr(create[0].slice(0, create[0].indexOf('>') + 1), 'ng-if');
    assert.equal(nodeVm.runInNewContext(condition, {settings:{isAdmin:true}}), true);
    assert.equal(nodeVm.runInNewContext(condition, {settings:{isAdmin:false, isViewer:true}}), false);
    assert.match(create[0], /ui-sref="application\.create_speaking_test"/);
    assert.match(create[0], /href="create_speaking_test"/);
    assert.match(create[0], /Tạo test Speaking/);
    assert.match(header, /ui-sref="application\.speaking" href="speaking"/);
    const testMenu = header.match(/<li class="dropdown test-room-nav"[^>]*>/);
    assert.ok(testMenu);
    assert.match(attr(testMenu[0], 'ng-class'), /application\.create_speaking_test/);
});
