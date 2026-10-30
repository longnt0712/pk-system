const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(app, name), 'utf8');
const helper = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('window.APP_VERSION =') && script.includes('writeVersionedStylesheet'));

function fixture(options = {}) {
    const inline = new Map(), calls = [], configs = [], written = [];
    const window = {URL, location:new URL('https://ieltsroom.com/dashboard'),
        document:{baseURI:'https://ieltsroom.com/', getElementById:id => inline.get(id), write(value) { written.push(value); }}};
    vm.runInNewContext(helper, {window, document:window.document, encodeURIComponent});
    window.APP_VERSION = 'release A';
    if (options.noHelper) delete window.versionedAppUrl;
    vm.runInNewContext(read('application.configs.js'), {Hrm:{config:config => configs.push(config)}, angular:{extend:Object.assign}});
    let definition;
    const config = configs.find(config => String(config.at(-1)).includes("decorator('$templateRequest'"));
    config.at(-1)({decorator(name, value) { assert.equal(name, '$templateRequest'); definition = value; }});
    function delegate(...args) { calls.push({args, receiver:this}); return args[0]; }
    delegate.totalPendingRequests = 0;
    delegate.extension = 'preserved';
    const request = definition.at(-1)(delegate, window);
    return {window, inline, request, delegate, calls, written};
}

test('index asset writers stamp CSS and JS once while keeping feature queries and fragments', () => {
    const f = fixture();
    const source = 'assets/css/ieltsroom-halloween.css?theme=20261030-speaking&v=old&v=older#preview';
    const expected = 'assets/css/ieltsroom-halloween.css?theme=20261030-speaking&v=release%20A#preview';
    assert.equal(f.window.versionedAppUrl(source), expected);
    assert.equal(f.window.versionedAppUrl(expected), expected);
    f.window.writeVersionedStylesheet(source);
    f.window.writeVersionedScript('question/controllers/SpeakingController.js');
    assert.equal(f.written[0], '<link href="' + expected + '" rel="stylesheet" type="text/css" />');
    assert.equal(f.written[1], '<script src="question/controllers/SpeakingController.js?v=release%20A" type="text/javascript"></script>');
});

test('local application templates receive the current version before cache lookup and preserve other query/hash data', () => {
    const f = fixture();
    for (const url of ['common/views/navs/footer-hoz.html', '/question/views/speaking.html',
        'https://ieltsroom.com/dashboards/views/general-alt.html?theme=hallows&v=old#content']) {
        const result = f.request(url, true);
        const parsed = new URL(result, f.window.document.baseURI);
        assert.equal(parsed.searchParams.get('v'), 'release A');
        assert.equal(parsed.searchParams.getAll('v').length, 1);
        assert.equal(f.calls.at(-1).args[1], true);
        if (url.includes('theme=')) { assert.equal(parsed.searchParams.get('theme'), 'hallows'); assert.equal(parsed.hash, '#content'); }
        assert.equal(f.request(result), result, 'a previously versioned view stays idempotent');
    }
});

test('inline cached template IDs, trusted resource values, remote templates and API/download routes stay unchanged', () => {
    const f = fixture(), trusted = {trustedResource:'common/views/trusted.html'};
    f.inline.set('common/views/inline.html', {tagName:'SCRIPT',type:'text/ng-template'});
    for (const url of ['change_password_modal.html', 'uib/template/modal/window.html', 'common/views/inline.html',
        'https://other.test/common/views/page.html', '//other.test/common/views/page.html',
        '/service/api/views/report.html', '/api/views/report.html', '/oauth/views/login.html', '/public/views/report.html',
        'assets/templates/mau_import_speaking.xlsx', 'question/speaking.css', 'blob:https://ieltsroom.com/common/views/page.html', trusted]) {
        assert.equal(f.request(url), url);
    }
});

test('decorator preserves delegate counters, extensions, this binding and missing-helper compatibility', () => {
    const f = fixture(), receiver = {caller:true};
    f.request.call(receiver, 'question/views/speaking.html', false);
    assert.equal(f.calls[0].receiver, receiver);
    assert.equal(f.calls[0].args[1], false);
    f.delegate.totalPendingRequests = 4;
    assert.equal(f.request.totalPendingRequests, 4);
    f.request.totalPendingRequests = 2;
    assert.equal(f.delegate.totalPendingRequests, 2);
    assert.equal(f.request.extension, 'preserved');
    assert.equal(fixture({noHelper:true}).request('question/views/speaking.html'), 'question/views/speaking.html');
});
