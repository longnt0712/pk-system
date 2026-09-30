// Run with: node --test richy/app/tests/auth-session.test.cjs
// Exercise the real application factories with a controllable HTTP transport.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function copy(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(copy);
    if (Object.prototype.toString.call(value) === '[object Date]') return new Date(value.getTime());
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
}
function invoke(definition, deps) {
    return definition.at(-1)(...definition.slice(0, -1).map(name => deps[name]));
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function setup(transport, protocol = 'https:') {
    const factories = {}, configs = [], cookies = {}, cookieOptions = {}, events = [];
    const Hrm = {
        API_SERVER_URL: 'https://example.test/service/', API_CLIENT_ID: 'education_client', API_CLIENT_KEY: 'password',
        constant(name, value) { deps[name] = value; },
        factory(name, def) { factories[name] = def; },
        filter() {}, config(def) { configs.push(def); }
    };
    const deps = {
        $q: {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)},
        $rootScope: {$emit(name) { events.push(name); }},
        $cookies: {
            getObject(name) { return copy(cookies[name]); },
            putObject(name, value, options) { cookies[name] = copy(value); cookieOptions[name] = copy(options); },
            remove(name) { delete cookies[name]; }
        }
    };
    const token = {
        getToken() { return deps.$cookies.getObject('token'); },
        getAccessToken() { return (this.getToken() || {}).access_token; },
        getRefreshToken() { return (this.getToken() || {}).refresh_token; },
        getAuthorizationHeader() { const v = this.getAccessToken(); return v ? 'Bearer ' + v : undefined; }
    };
    const context = vm.createContext({Hrm, window: {location: {protocol}}, angular: {copy, extend: Object.assign}, Date});
    for (const name of ['application.services.js', 'application.configs.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context);
    }
    invoke(configs.find(def => def[0] === '$provide'), {
        $provide: {decorator(name, def) { deps[name] = invoke(def, {...deps, $delegate: token}); }}
    });
    deps.$injector = {get(name) { return deps[name]; }};
    const interceptor = invoke(factories.SessionAuthInterceptor, deps);
    function http(config) {
        const prepared = interceptor.request({...config, headers: {...config.headers}});
        return Promise.resolve().then(() => transport(prepared)).catch(error =>
            interceptor.responseError({...error, config: prepared}));
    }
    http.post = (url, data, options) => http({...options, url, data, method: 'POST'});
    http.delete = (url, options) => http({...options, url, method: 'DELETE'});
    deps.$http = http;
    const session = deps.AuthSession = invoke(factories.AuthSession, deps);
    token.setToken({access_token: 'old', refresh_token: 'refresh-1', expires_in: 86400, token_type: 'bearer'});
    return {http, session, token, cookies, cookieOptions, events, configs, interceptor, deps, context, Hrm};
}
const api = 'https://example.test/service/api/users/getCurrentUser';
const invalid = {status: 401, data: {error: 'invalid_token'}};
const fresh = {data: {access_token: 'fresh', refresh_token: 'refresh-1', expires_in: 86400, token_type: 'bearer'}};

test('concurrent expired requests share one refresh and retry with the new token', async () => {
    let refreshes = 0, retries = 0;
    const gate = deferred();
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) {
            refreshes++;
            assert.ok(config.data.includes('grant_type=refresh_token'));
            assert.equal(config.headers.Authorization, undefined);
            return gate.promise;
        }
        if (config.headers.Authorization === 'Bearer old') throw invalid;
        retries++;
        assert.equal(config.headers.Authorization, 'Bearer fresh');
        return {data: {id: 7}};
    });
    const pending = Promise.all([h.http({url: api}), h.http({url: api + '?second=1'})]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(refreshes, 1);
    gate.resolve(fresh);
    const responses = await pending;
    assert.equal(responses.length, 2);
    assert.equal(retries, 2);
    assert.equal(h.events.length, 0);
});

test('network errors, 403 and 5xx leave the session intact', async () => {
    for (const status of [0, -1, 403, 408, 429, 500, 502, 503]) {
        const h = setup(() => { throw {status}; });
        await assert.rejects(h.http({url: api}), error => error.status === status);
        assert.equal(h.token.getAccessToken(), 'old');
        assert.equal(h.events.length, 0);
    }
});

test('refresh network/server failures preserve credentials and allow a later refresh', async () => {
    for (const status of [0, 500, 503]) {
        let fail = true, refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) {
                refreshes++;
                if (fail) throw {status};
                return fresh;
            }
            if (config.headers.Authorization === 'Bearer old') throw invalid;
            return {data: {id: 7}};
        });
        await assert.rejects(h.http({url: api}), error => error.status === status);
        assert.equal(h.token.getAccessToken(), 'old');
        fail = false;
        await h.http({url: api});
        assert.equal(refreshes, 2);
        assert.equal(h.token.getAccessToken(), 'fresh');
    }
});

test('invalid refresh grant clears token and user, emitting one expiration event', async () => {
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) throw {status: 400, data: {error: 'invalid_grant'}};
        throw invalid;
    });
    h.session.saveUser({id: 7});
    await assert.rejects(h.http({url: api}));
    assert.equal(h.cookies.token, undefined);
    assert.equal(h.cookies['education.user'], undefined);
    assert.deepEqual(h.events, ['session:expired']);
});

test('a refreshed token rejected again ends the session without looping', async () => {
    let refreshes = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) { refreshes++; return fresh; }
        throw invalid;
    });
    await assert.rejects(h.http({url: api}));
    assert.equal(refreshes, 1);
    assert.deepEqual(h.events, ['session:expired']);
});

test('cookies survive restarts, use HTTPS Secure, and retain the original refresh expiry', () => {
    const h = setup(() => ({}));
    const expiry = h.cookies.token.session_expires_at;
    assert.ok(expiry > Date.now());
    assert.equal(h.cookieOptions.token.secure, true);
    assert.equal(h.cookieOptions.token.path, '/');
    h.token.setToken(fresh.data);
    assert.equal(h.cookies.token.session_expires_at, expiry);
    h.session.saveUser({id: 7});
    assert.equal(h.cookieOptions['education.user'].expires.getTime(), expiry);
    const local = setup(() => ({}), 'http:');
    assert.equal(local.cookieOptions.token.secure, false);
    delete local.cookies.token.session_expires_at;
    local.session.restore();
    assert.ok(local.cookies.token.session_expires_at);
});

test('logout while refresh is pending never resurrects the session', async () => {
    const gate = deferred();
    let revokedHeader;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) return gate.promise;
        if (config.url.endsWith('/oauth/logout')) { revokedHeader = config.headers.Authorization; return {}; }
        throw invalid;
    });
    const pending = h.http({url: api});
    const rejected = assert.rejects(pending, error => error.sessionChanged === true);
    await new Promise(resolve => setImmediate(resolve));
    await h.session.logout();
    assert.equal(revokedHeader, 'Bearer old');
    gate.resolve(fresh);
    await rejected;
    assert.equal(h.cookies.token, undefined);
});

test('responses from the previous user cannot retry as a new user', async () => {
    const h = setup(() => { throw new Error('Must not make another request'); });
    const config = h.interceptor.request({url: api});
    h.token.setToken({access_token: 'other', refresh_token: 'refresh-2'});
    await assert.rejects(h.interceptor.responseError({...invalid, config}));
    assert.equal(h.token.getAccessToken(), 'other');
    assert.equal(h.events.length, 0);
});

test('tokens only attach to this API and explicit Authorization is respected', () => {
    const h = setup(() => ({}));
    assert.equal(h.interceptor.request({url: 'https://other.test/api/'}).headers.Authorization, undefined);
    assert.equal(h.interceptor.request({url: 'assets/template.html'}).headers.Authorization, undefined);
    assert.equal(h.interceptor.request({url: api, headers: {Authorization: 'Basic custom'}}).headers.Authorization,
        'Basic custom');
});

test('configuration replaces the bundled OAuth interceptor', () => {
    const h = setup(() => ({}));
    const provider = {interceptors: ['oauthInterceptor']};
    invoke(h.configs.find(def => def[0] === '$httpProvider'), {$httpProvider: provider});
    assert.deepEqual(Array.from(provider.interceptors), ['SessionAuthInterceptor', 'ServerExceptionHandlerInterceptor']);
});

test('retry preserves the body of POST/upload requests', async () => {
    const upload = new FormData();
    upload.append('file', new Blob(['test upload']), 'test.txt');
    let attempts = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) return fresh;
        attempts++;
        assert.equal(config.method, 'POST');
        assert.equal(config.data, upload);
        assert.equal(config.data.get('file').name, 'test.txt');
        if (config.headers.Authorization === 'Bearer old') throw invalid;
        return {data: {saved: true}};
    });
    const result = await h.http({url: api, method: 'POST', data: upload});
    assert.equal(result.data.saved, true);
    assert.equal(attempts, 2);
});

function startApp(h) {
    const listeners = {}, windowListeners = {}, documentListeners = {}, timers = [], navigations = [];
    const root = h.deps.$rootScope;
    root.$on = (name, fn) => { listeners[name] = fn; };
    root.$broadcast = () => {};
    root.$evalAsync = fn => fn();
    const timeout = (fn, delay) => { const timer = {fn, delay}; timers.push(timer); return timer; };
    timeout.cancel = timer => { if (timer) timer.cancelled = true; };
    h.deps.$cookies.get = name => h.cookies[name] ? JSON.stringify(h.cookies[name]) : undefined;
    h.context.window.location = {protocol: 'https:', hostname: 'example.test', origin: 'https://example.test', pathname: '/dashboard'};
    h.context.window.navigator = {onLine: true};
    h.context.window.sessionStorage = {getItem: () => null, setItem() {}, removeItem() {}};
    h.context.window.addEventListener = (name, fn) => { windowListeners[name] = fn; };
    h.context.window.removeEventListener = name => { delete windowListeners[name]; };
    h.context.window.document = {
        hidden: false,
        documentElement: {setAttribute() {}, classList: {add() {}}},
        querySelectorAll: () => [],
        addEventListener(name, fn) { documentListeners[name] = fn; },
        removeEventListener(name) { delete documentListeners[name]; }
    };
    h.context.document = h.context.window.document;
    let runDefinition;
    h.Hrm.run = def => { runDefinition = def; };
    h.context.angular.module = () => h.Hrm;
    h.context.angular.forEach = (items, fn) => items.forEach(fn);
    const http = {
        get(url) {
            const promise = h.http({url, method: 'GET'});
            // AngularJS legacy .success/.error return the original promise.
            promise.success = fn => { promise.then(response => fn(response.data), () => {}); return promise; };
            promise.error = fn => { promise.then(() => {}, error => fn(error.data, error.status)); return promise; };
            promise.finally = fn => { promise.then(fn, fn); return promise; };
            return promise;
        }
    };
    const settings = {api: {baseUrl: h.Hrm.API_SERVER_URL}, layout: {}};
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'application.js'), 'utf8'), h.context);
    invoke(runDefinition, {...h.deps, settings, $http: http, $state: {
        current: {name: 'application.dashboard'}, go(name) { navigations.push(name); }
    }, OAuth: {isAuthenticated: () => !!h.token.getToken()},
    blockUI: {start() {}, stop() {}}, toastr: {info() {}}, $timeout: timeout});
    return {listeners, windowListeners, documentListeners, timers, navigations, settings};
}

test('the real app preserves login on resume failure and retries when connectivity returns', async () => {
    let requests = 0, offline = true;
    const h = setup(() => {
        requests++;
        if (offline) throw {status: 0};
        return {data: {id: 7, roles: []}};
    });
    const app = startApp(h);
    app.listeners.$locationChangeSuccess();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.token.getAccessToken(), 'old');
    assert.equal(app.navigations.length, 0);
    assert.ok(app.timers.some(timer => timer.delay === 1500));
    offline = false;
    app.windowListeners.online();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 2);
    assert.equal(h.cookies['education.user'].id, 7);
    assert.equal(app.navigations.length, 0);
    assert.equal(app.timers.find(timer => timer.delay === 1500).cancelled, true);
});

test('hidden Safari tabs do not check the user until visible; resume events share the check', async () => {
    let requests = 0;
    const gate = deferred();
    const h = setup(() => { requests++; return gate.promise; });
    const app = startApp(h);
    h.context.window.document.hidden = true;
    app.documentListeners.visibilitychange();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 0);
    h.context.window.document.hidden = false;
    app.documentListeners.visibilitychange();
    app.windowListeners.pageshow();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1);
    gate.resolve({data: {id: 7, roles: []}});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.cookies['education.user'].id, 7);
    app.listeners.$destroy();
    assert.equal(Object.keys(app.windowListeners).length, 0);
    assert.equal(Object.keys(app.documentListeners).length, 0);
});
