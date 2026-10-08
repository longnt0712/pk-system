const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual service and form controller across a controllable HTTP boundary.
function harness(transport) {
    const definitions = {}, requests = [], messages = [], closes = [];
    let listingReads = 0;
    const module = {
        service(name, definition) { definitions[name] = definition; return this; },
        controller(name, definition) { definitions[name] = definition; return this; },
        directive() { return this; }, filter() { return this; }
    };
    const context = vm.createContext({angular: {
        module() { return module; }, copy: structuredClone,
        isFunction: value => typeof value === 'function'
    }, console});
    for (const file of ['business/TopicService.js', 'controllers/TopicController.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../topic', file), 'utf8'), context);
    }
    const dependencies = {
        $http(config) { requests.push(config); return Promise.resolve().then(() => transport(config)); },
        $q: {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)},
        settings: {layout: {}, api: {baseUrl: '/service/', apiV1Url: 'api/'}},
        Utilities: {resolveAlt(url) {
            if (url.includes('/topic/get_page/')) { listingReads++; }
            return Promise.resolve({content: [], totalElements: 0});
        }},
        $rootScope: {settings: {layout: {}}}, $scope: {$on() {}},
        toastr: Object.fromEntries(['info', 'error', 'warning'].map(kind =>
            [kind, (message, title) => messages.push({kind, message, title})])),
        $cookies: {getAll: () => ({'education.user': JSON.stringify({id: 1, username: 'admin'})})},
        $stateParams: {}, blockUI: {start() {}, stop() {}}
    };
    function instantiate(name) {
        const definition = definitions[name];
        return new definition(...definition.$inject.map(key => dependencies[key]));
    }
    dependencies.TopicService = instantiate('TopicService');
    const controller = instantiate('TopicController');
    controller.topic = {name: 'Test topic', topicCategory: {id: 1}, content: 'Keep this input'};
    controller.modalInstance = {close(result) { closes.push(result); }};
    return {controller, service: dependencies.TopicService, requests, messages, closes,
        listingReads: () => listingReads};
}

test('a pending save shows progress and repeated clicks send only one request', async () => {
    let finish;
    const h = harness(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.controller.saveObjectValidate();
    h.controller.saveObjectValidate();
    await Promise.resolve();
    assert.equal(h.controller.savingTopic, true);
    assert.equal(h.requests.length, 1);
    finish({data: {id: 10, message: 'Successfully'}});
    await pending;
    assert.equal(h.controller.savingTopic, false);
    assert.equal(h.closes.length, 1);
    assert.equal(h.listingReads(), 2);
});

for (const failure of [
    {status: -1, data: null, expected: /không phản hồi/},
    {status: 500, data: {message: 'Database write failed'}, expected: /Database write failed/},
    {status: 403, data: {}, expected: /HTTP 403/}
]) {
    test(`HTTP ${failure.status} reports the failure and preserves the form`, async () => {
        const h = harness(() => Promise.reject(failure));
        const input = h.controller.topic;
        await h.controller.saveObjectValidate();
        assert.equal(h.controller.topic, input);
        assert.equal(h.controller.savingTopic, false);
        assert.equal(h.closes.length, 0);
        assert.equal(h.listingReads(), 1);
        assert.match(h.messages.at(-1).message, failure.expected);
    });
}

test('a validation response without a saved id leaves the form open with its input', async () => {
    const h = harness(() => ({data: {message: 'Topic limit reached'}}));
    const input = h.controller.topic;
    await h.controller.saveObjectValidate();
    assert.equal(h.controller.topic, input);
    assert.equal(h.closes.length, 0);
    assert.equal(h.listingReads(), 1);
    assert.equal(h.messages.at(-1).kind, 'error');
    assert.equal(h.messages.at(-1).message, 'Topic limit reached');
});

test('the service keeps the HTTP failure for callers and snapshots the submitted data', async () => {
    const failure = {status: 500, data: {message: 'Write failed'}};
    const h = harness(() => Promise.reject(failure));
    const input = h.controller.topic;
    let callbackFailure;
    const pending = h.service.saveObject(input, undefined, error => { callbackFailure = error; });
    input.content = 'Edited while saving';
    await assert.rejects(pending, error => error === failure);
    assert.equal(callbackFailure, failure);
    assert.equal(h.requests[0].data.content, 'Keep this input');
});
