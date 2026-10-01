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
        getAuthorizationHeader() {
            const value = this.getToken() || {}, type = value.token_type;
            return type && value.access_token ? type.charAt(0).toUpperCase() + type.slice(1) + ' ' + value.access_token : undefined;
        }
    };
    const context = vm.createContext({Hrm, window: {URL, location: {protocol, href: 'https://example.test/'}}, angular: {copy, extend: Object.assign}, Date});
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
    return {http, session, token, cookies, cookieOptions, events, configs, interceptor, deps, context, Hrm, factories};
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

function startApp(h, hostname = 'example.test') {
    const listeners = {}, windowListeners = {}, documentListeners = {}, timers = [], navigations = [];
    const notices = [];
    const blockCalls = {start: 0, stop: 0};
    const root = h.deps.$rootScope;
    root.$on = (name, fn) => { listeners[name] = fn; };
    root.$emit = (name, ...args) => { h.events.push(name); if (listeners[name]) listeners[name]({}, ...args); };
    root.$broadcast = () => {};
    root.$evalAsync = fn => fn();
    const timeout = (fn, delay) => { const timer = {fn, delay}; timers.push(timer); return timer; };
    timeout.cancel = timer => { if (timer) timer.cancelled = true; };
    h.deps.$cookies.get = name => h.cookies[name] ? JSON.stringify(h.cookies[name]) : undefined;
    h.context.window.location = {protocol: 'https:', hostname, origin: 'https://' + hostname, pathname: '/dashboard'};
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
        get(url, options) {
            const promise = h.http({...options, url, method: 'GET'});
            // AngularJS legacy .success/.error return the original promise.
            promise.success = fn => { promise.then(response => fn(response.data), () => {}); return promise; };
            promise.error = fn => { promise.then(() => {}, error => fn(error.data, error.status)); return promise; };
            promise.finally = fn => { promise.then(fn, fn); return promise; };
            return promise;
        }
    };
    const settings = {api: {baseUrl: h.Hrm.API_SERVER_URL}, layout: {}};
    const state = {current: {name: 'application.dashboard'}, params: {}, go(name) { navigations.push(name); }};
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'application.js'), 'utf8'), h.context);
    invoke(runDefinition, {...h.deps, settings, $http: http, $state: state, OAuth: {isAuthenticated: () => !!h.token.getToken()},
    blockUI: {start() { blockCalls.start++; }, stop() { blockCalls.stop++; }},
    toastr: {info() {}, warning(message) { notices.push(message); }}, $timeout: timeout, NetworkStatus: {start: () => () => {}}});
    return {listeners, windowListeners, documentListeners, timers, navigations, settings, blockCalls, notices, state};
}

test('returning to the login homepage keeps signed-in users there; normal login still redirects', async () => {
    for (const showHome of [true, false]) {
        const h = setup(() => ({data: {id: 7, roles: []}}));
        const app = startApp(h);
        app.state.current.name = 'login'; app.state.params.showHome = showHome;
        app.listeners.$locationChangeSuccess();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(app.navigations, showHome ? [] : ['application.dashboard']);
        assert.equal(h.cookies['education.user'].id, 7);
    }
});

test('headerless 401 clears stale dashboard data and gives one visible login notice', async () => {
    const h = setup(() => { throw invalid; });
    h.session.saveUser({id: 7, roles: []});
    h.token.removeToken();
    const app = startApp(h);
    await Promise.allSettled([h.http({url: api}), h.http({url: api + '?second=1'})]);
    assert.equal(h.cookies['education.user'], undefined);
    assert.equal(h.deps.$rootScope.currentUser, null);
    assert.deepEqual(app.navigations, ['login']);
    assert.equal(app.notices.length, 1);
    assert.match(h.deps.$rootScope.sessionNotice, /đăng nhập lại/);
    assert.match(fs.readFileSync(path.join(__dirname, '../common/views/login/login.html'), 'utf8'), /ng-if="sessionNotice"/);
});

test('a token missing its type can recover through its refresh token after a headerless 401', async () => {
    let refreshes = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) { refreshes++; return fresh; }
        if (!config.headers.Authorization) throw invalid;
        return {data: {id: 7}};
    });
    h.token.setToken({access_token: 'old', refresh_token: 'refresh-1'});
    const response = await h.http({url: api});
    assert.equal(response.data.id, 7);
    assert.equal(refreshes, 1);
    assert.equal(h.events.length, 0);
});

test('a refresh-only token can recover; rejected refresh 401 shows a notice and returns to login', async () => {
    for (const rejected of [false, true]) {
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) {
                if (rejected) throw {status: 401, data: {error: 'invalid_client'}};
                return fresh;
            }
            if (!config.headers.Authorization) throw invalid;
            return {data: {id: 7}};
        });
        h.token.setToken({refresh_token: 'refresh-1'});
        const app = startApp(h);
        if (rejected) {
            await assert.rejects(h.http({url: api}));
            assert.deepEqual(app.navigations, ['login']);
            assert.equal(app.notices.length, 1);
        } else {
            await h.http({url: api});
            assert.equal(h.token.getAccessToken(), 'fresh');
            assert.equal(app.navigations.length, 0);
        }
    }
});

test('root-relative API URLs and explicit current bearer headers still refresh', async () => {
    for (const config of [
        {url: '/service/api/users/getCurrentUser'},
        {url: api, headers: {Authorization: 'Bearer old'}},
        {url: api, headers: {authorization: 'Bearer old'}}
    ]) {
        const h = setup(request => {
            if (request.url.endsWith('/oauth/token')) return fresh;
            if ((request.headers.Authorization || request.headers.authorization) !== 'Bearer fresh') throw invalid;
            return {data: {id: 7}};
        });
        await h.http(config);
        assert.equal(h.token.getAccessToken(), 'fresh');
    }
});

test('tab resume detects a vanished token or empty token cookie without waiting for a REST call', () => {
    for (const malformed of [false, true]) {
        const h = setup(() => { throw new Error('No request should be needed'); });
        h.session.saveUser({id: 7});
        const app = startApp(h);
        h.token.removeToken();
        if (malformed) h.cookies.token = {};
        app.documentListeners.visibilitychange();
        app.windowListeners.pageshow();
        assert.deepEqual(app.navigations, ['login']);
        assert.equal(app.notices.length, 1);
        assert.equal(h.cookies['education.user'], undefined);
    }
});

test('a late headerless 401 cannot clear a newer login', async () => {
    const gate = deferred();
    const h = setup(() => gate.promise);
    h.token.removeToken();
    const pending = h.http({url: api});
    await new Promise(resolve => setImmediate(resolve));
    h.token.setToken(fresh.data);
    gate.reject(invalid);
    await assert.rejects(pending);
    assert.equal(h.token.getAccessToken(), 'fresh');
    assert.equal(h.events.length, 0);
});

test('a late current-user 401 after intentional logout does not claim the session expired', async () => {
    const gate = deferred();
    const h = setup(config => config.url.endsWith('/oauth/logout') ? {} : gate.promise);
    h.session.saveUser({id: 7});
    const app = startApp(h);
    app.listeners.$locationChangeSuccess();
    await new Promise(resolve => setImmediate(resolve));
    await h.session.logout();
    gate.reject(invalid);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.notices.length, 0);
    assert.equal(h.cookies.token, undefined);
});

test('an unusable successful refresh response cannot leave a silent broken session', async () => {
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) return {data: {}};
        throw invalid;
    });
    const app = startApp(h);
    await assert.rejects(h.http({url: api}));
    assert.equal(h.cookies.token, undefined);
    assert.equal(app.notices.length, 1);
    assert.deepEqual(app.navigations, ['login']);
});

test('the expiration latch resets for a new login and the persistent notice clears after success', async () => {
    const h = setup(() => { throw invalid; });
    h.token.removeToken();
    const app = startApp(h);
    await assert.rejects(h.http({url: api}));
    h.token.setToken(fresh.data);
    h.session.saveUser({id: 8});
    assert.equal(h.deps.$rootScope.sessionNotice, '');
    h.token.removeToken();
    await assert.rejects(h.http({url: api}));
    assert.equal(app.notices.length, 2);
});

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
    app.windowListeners.online({type: 'online'});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 2);
    assert.equal(h.cookies['education.user'].id, 7);
    assert.equal(app.navigations.length, 0);
    assert.equal(app.timers.find(timer => timer.delay === 1500).cancelled, true);
    assert.deepEqual(app.blockCalls, {start: 0, stop: 0});
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
    assert.deepEqual(app.blockCalls, {start: 0, stop: 0});
    app.listeners.$destroy();
    assert.equal(Object.keys(app.windowListeners).length, 0);
    assert.equal(Object.keys(app.documentListeners).length, 0);
});

test('quick repeated tab switches use the recent session check without any overlay', async () => {
    let requests = 0;
    const h = setup(() => { requests++; return {data: {id: 7, roles: []}}; });
    const app = startApp(h);
    app.documentListeners.visibilitychange({type: 'visibilitychange'});
    await new Promise(resolve => setImmediate(resolve));
    for (let i = 0; i < 5; i++) {
        app.documentListeners.visibilitychange({type: 'visibilitychange'});
        app.windowListeners.pageshow({type: 'pageshow'});
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1);
    assert.deepEqual(app.blockCalls, {start: 0, stop: 0});
    app.windowListeners.online({type: 'online'});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 2);
});

function networkHarness() {
    const h = setup(() => ({})), timers = [], notices = [], listeners = {};
    const win = {
        navigator: {onLine: true}, document: {hidden: false},
        addEventListener(name, fn) { listeners[name] = fn; },
        removeEventListener(name) { delete listeners[name]; }
    };
    const timeout = (fn, delay) => { const timer = {fn, delay}; timers.push(timer); return timer; };
    timeout.cancel = timer => { if (timer) timer.cancelled = true; };
    const toastr = {clear(notice) { notice.cleared = true; }};
    for (const kind of ['warning', 'info', 'success']) {
        toastr[kind] = (message, title, options) => {
            const notice = {kind, message, title, options}; notices.push(notice); return notice;
        };
    }
    const network = invoke(h.factories.NetworkStatus, {$window: win, $timeout: timeout, toastr});
    return {network, win, timers, notices, listeners, stop: network.start(), h, toastr};
}

test('fast background checks stay silent; a slow request shows one non-blocking notice', () => {
    const h = networkHarness();
    const fast = {url: api};
    h.network.begin(fast);
    h.network.success({config: fast});
    assert.equal(h.notices.length, 0);
    assert.equal(h.timers[0].cancelled, true);
    const slow = {url: api}, second = {url: api};
    h.network.begin(slow); h.network.begin(second);
    h.timers[1].fn(); h.timers[2].fn();
    assert.equal(h.notices.length, 1);
    assert.equal(h.notices[0].kind, 'info');
    assert.equal(h.notices[0].options.timeOut, 0);
    h.network.success({config: slow});
    assert.equal(h.notices.length, 1);
    h.network.success({config: second});
    assert.equal(h.notices.length, 2);
    assert.equal(h.notices[0].cleared, true);
    assert.equal(h.notices[1].kind, 'success');
});

test('network failure notices are deduplicated; online is verified before reporting recovery', () => {
    const h = networkHarness();
    for (let i = 0; i < 5; i++) {
        const config = {url: api};
        h.network.begin(config);
        h.network.failure({status: 0, config});
    }
    assert.equal(h.notices.length, 1);
    h.listeners.online();
    assert.equal(h.notices.at(-1).kind, 'info');
    const config = {url: api};
    h.network.begin(config);
    h.network.success({config});
    assert.equal(h.notices.at(-1).kind, 'success');
    h.stop();
    assert.equal(Object.keys(h.listeners).length, 0);
});

test('offline and server failures have different messages; unrelated assets are ignored', () => {
    const h = networkHarness();
    h.win.navigator.onLine = false;
    h.listeners.offline();
    assert.match(h.notices.at(-1).message, /Internet/);
    h.win.navigator.onLine = true;
    const config = {url: api};
    h.network.begin(config);
    h.network.failure({config, status: 503});
    assert.match(h.notices.at(-1).message, /Máy chủ/);
    const count = h.timers.length;
    h.network.begin({url: 'assets/template.html'});
    assert.equal(h.timers.length, count);
});

test('an intentional abort clears a slow notice without announcing a connection failure', () => {
    const h = networkHarness();
    const config = {url: api};
    h.network.begin(config);
    h.timers[0].fn();
    h.network.failure({config, status: -1, xhrStatus: 'abort'});
    assert.equal(h.notices.length, 1);
    assert.equal(h.notices[0].cleared, true);
});

test('a background error never stops an unrelated foreground Block UI', async () => {
    const h = networkHarness();
    let stopped = 0;
    const interceptor = invoke(h.h.factories.ServerExceptionHandlerInterceptor, {
        $q: h.h.deps.$q, toastr: h.toastr, NetworkStatus: h.network, blockUI: {stop() { stopped++; }}
    });
    const config = interceptor.request({url: api, backgroundSessionCheck: true});
    await assert.rejects(interceptor.responseError({config, status: 0}));
    assert.equal(stopped, 0);
    assert.equal(h.notices.length, 1);
});

function loginHarness(performLogin) {
    const h = setup(() => ({data: {id: 7, roles: []}}));
    let Controller;
    h.context.angular.module = () => ({controller(name, fn) { Controller = fn; }});
    h.context.angular.isFunction = value => typeof value === 'function';
    h.context.angular.isObject = value => value !== null && typeof value === 'object';
    h.context.angular.forEach = (items, fn) => items.forEach(fn);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'common/controllers/LoginController.js'), 'utf8'), h.context);
    const notices = [], blocks = [], navigations = [];
    const deps = {...h.deps,
        $rootScope: {}, $scope: {$on() {}},
        $state: {go(name) { navigations.push(name); }},
        settings: {api: {baseUrl: h.Hrm.API_SERVER_URL}},
        LoginService: {performLogin}, toastr: {error(message) { notices.push(message); }}, focus() {},
        blockUI: {start() { blocks.push('start'); }, stop() { blocks.push('stop'); }},
        $location: {protocol: () => 'https'}, $window: {navigator: {onLine: true}},
        $document: {on() {}, off() {}}, $http: {get: () => Promise.resolve({data: {id: 7, roles: []}})}
    };
    const controller = {};
    Controller.apply(controller, Controller.$inject.map(name => deps[name]));
    controller.user = {username: 'test', password: 'wrong'};
    return {controller, notices, blocks, navigations, deps};
}

test('wrong password has a visible Vietnamese error, including OAuth 400 and HTTP 401', async () => {
    for (const error of [{status: 400, data: {error: 'invalid_grant'}}, {status: 401}]) {
        const h = loginHarness(() => Promise.reject(error));
        await h.controller.login();
        assert.match(h.controller.loginError, /mật khẩu không đúng/);
        assert.equal(h.controller.isLoggingIn, false);
        assert.deepEqual(h.blocks, []);
        assert.deepEqual(h.navigations, []);
    }
});

test('login timeout and failed user lookup are handled and release the login button', async () => {
    const timed = loginHarness(() => Promise.reject({status: -1, xhrStatus: 'timeout'}));
    await timed.controller.login();
    assert.match(timed.controller.loginError, /thời gian chờ/);
    const lookup = loginHarness(() => Promise.resolve({data: {access_token: 'valid'}}));
    lookup.deps.$http.get = () => Promise.reject({status: 0});
    await lookup.controller.login();
    assert.match(lookup.controller.loginError, /Đã xác thực/);
    assert.equal(lookup.controller.isLoggingIn, false);
    assert.deepEqual(lookup.blocks, []);
});

test('login has local busy feedback and ignores duplicate submissions', async () => {
    const gate = deferred();
    let requests = 0;
    const h = loginHarness(() => { requests++; return gate.promise; });
    const pending = h.controller.login();
    h.controller.login();
    assert.equal(h.controller.isLoggingIn, true);
    assert.equal(requests, 1);
    gate.resolve({data: {access_token: 'valid'}});
    await pending;
    assert.equal(h.controller.isLoggingIn, false);
    assert.equal(h.controller.loginError, '');
    assert.deepEqual(h.navigations, ['application.dashboard']);
    assert.deepEqual(h.blocks, []);
});

test('campaigns and flower routes only open on the TNTT domain and its www alias', () => {
    for (const hostname of ['tnttphungkhoang.com', 'www.tnttphungkhoang.com', 'TNTTPHUNGKHOANG.COM', 'ieltsroom.com', 'www.ieltsroom.com', 'localhost', 'other.example', 'tnttphungkhoang.com.evil.example', 'stage.tnttphungkhoang.com']) {
        const h = setup(() => ({data:{id:7,roles:[]}})); const app = startApp(h, hostname);
        const allowed = /^(www\.)?tnttphungkhoang\.com$/i.test(hostname);
        assert.equal(app.settings.campaignsEnabled, allowed, hostname);
        const redirects=[]; app.state.go=(...args)=>redirects.push(args);
        for (const name of ['campaigns','campaign_detail','campaign_student','campaign_student_campaign','campaign_detail_shared','campaign_student_shared']) {
            let prevented=false;
            app.listeners.$stateChangeStart({preventDefault(){prevented=true;}}, {name,data:{publicCampaign:true}});
            assert.equal(prevented, !allowed, hostname+': '+name);
        }
        if (!allowed) {
            assert.equal(redirects.length,6);
            assert.deepEqual(structuredClone(redirects[0]), ['login',{showHome:true},{location:'replace'}]);
        } else {assert.equal(redirects.length,0);}
        let prevented=false;
        app.listeners.$stateChangeStart({preventDefault(){prevented=true;}}, {name:'application.dashboard'});
        assert.equal(prevented,false);
    }
});

test('public and signed-in navigation use the current release version when loading header templates', () => {
    const h = setup(() => ({})); h.context.window.APP_VERSION = 'domain-menu-release'; startApp(h, 'ieltsroom.com');
    assert.equal(h.deps.$rootScope.appVersion, 'domain-menu-release');
    for (const [page, header] of [['common/views/login/login.html', 'header-hoz-for-login.html'], ['common/views/application.html', 'header-hoz.html']]) {
        const template = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
        assert.ok(template.includes(header + "?v=' + appVersion"));
        const menu = fs.readFileSync(path.join(__dirname, '..', 'common/views/navs', header), 'utf8');
        assert.match(menu, /<li ng-if="settings\.campaignsEnabled === true"/);
    }
});
