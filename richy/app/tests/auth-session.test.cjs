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
function setup(transport, protocol = 'https:', frontend = 'richy') {
    const clock = {now: Date.now()};
    class SessionDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
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
    const appRoot = frontend === 'core' ? path.resolve(__dirname, '../../../core/core-app/web-app/src/app') : path.resolve(__dirname, '..');
    const context = vm.createContext({Hrm, Core: Hrm, window: {URL, location: {protocol, href: 'https://example.test/'}}, angular: {copy, extend: Object.assign}, Date: SessionDate});
    for (const name of ['application.services.js', 'application.configs.js']) {
        vm.runInContext(fs.readFileSync(path.join(appRoot, name), 'utf8'), context);
    }
    invoke(configs.find(def => def[0] === '$provide'), {
        $provide: {decorator(name, def) { deps[name] = invoke(def, {...deps, $delegate: token}); }}
    });
    deps.$injector = {get(name) { return deps[name]; }};
    const interceptor = invoke(factories.SessionAuthInterceptor, deps);
    function http(config) {
        let prepared = interceptor.request({...config, headers: {...config.headers}});
        return Promise.resolve(prepared).then(value => { prepared = value; return transport(value); }).catch(error =>
            interceptor.responseError({...error, config: prepared && typeof prepared.then !== 'function' ? prepared : undefined}));
    }
    http.post = (url, data, options) => http({...options, url, data, method: 'POST'});
    http.delete = (url, options) => http({...options, url, method: 'DELETE'});
    deps.$http = http;
    const session = deps.AuthSession = invoke(factories.AuthSession, deps);
    token.setToken({access_token: 'old', refresh_token: 'refresh-1', expires_in: 86400, token_type: 'bearer'});
    return {http, session, token, cookies, cookieOptions, events, configs, interceptor, deps, context, Hrm, factories, appRoot, clock, transport};
}

function anotherTab(h) {
    const events = [], deps = {...h.deps, $rootScope: {$emit(name) { events.push(name); }}};
    deps.$injector = {get(name) { return deps[name]; }};
    const interceptor = invoke(h.factories.SessionAuthInterceptor, deps);
    function http(config) {
        let prepared = interceptor.request({...config, headers: {...config.headers}});
        return Promise.resolve(prepared).then(value => { prepared = value; return h.transport(value); }).catch(error =>
            interceptor.responseError({...error, config: prepared && typeof prepared.then !== 'function' ? prepared : undefined}));
    }
    http.post = (url, data, options) => http({...options, url, data, method: 'POST'});
    http.delete = (url, options) => http({...options, url, method: 'DELETE'});
    deps.$http = http;
    const session = deps.AuthSession = invoke(h.factories.AuthSession, deps);
    return {http, session, events, deps};
}
const api = 'https://example.test/service/api/users/getCurrentUser';
const invalid = {status: 401, data: {error: 'invalid_token'}};
const fresh = {data: {access_token: 'fresh', refresh_token: 'refresh-1', expires_in: 86400, token_type: 'bearer'}};

async function modalHarness(transport, frontend = 'richy') {
    const h = setup(transport, 'https:', frontend), popups = [], routes = [], focused = [];
    h.context.angular.noop = () => {};
    h.context.window.navigator = {onLine: true};
    h.context.window.document = {getElementById(id) {return {focus() {focused.push(id);}};}};
    h.deps.$http.get = (url, options) => h.http({...options, url, method: 'GET'});
    const deps = {...h.deps, settings: {api: {baseUrl: h.Hrm.API_SERVER_URL}}, $window: h.context.window,
        $state: {go(name) {routes.push(name);}}, $timeout: fn => fn(),
        $uibModal: {open(config) {
            const result = deferred();
            const popup = {config, result: result.promise, opened: Promise.resolve(), closed: false,
                close() {this.closed = true; result.resolve();}, dismiss() {result.reject();}};
            popup.view = new config.controller(); popups.push(popup); return popup;
        }}
    };
    vm.runInContext(fs.readFileSync(path.join(h.appRoot, 'common/business/SessionLoginModal.js'), 'utf8'), h.context);
    const modal = invoke(h.factories.SessionLoginModal, deps);
    modal.open({id: 7, username: 'alice'});
    await new Promise(setImmediate);
    return {...h, modal, popups, routes, focused, get view() {return popups[0].view;}};
}

test('login modal deduplicates simultaneous prompts, survives Escape/backdrop and releases secrets on leave', async () => {
    for (const frontend of ['richy', 'core']) {
        const h = await modalHarness(() => ({}), frontend);
        h.modal.open({id: 7, username: 'alice'}); h.modal.open({id: 7, username: 'alice'});
        await new Promise(setImmediate);
        assert.equal(h.popups.length, 1);
        assert.equal(h.popups[0].config.backdrop, 'static');
        assert.equal(h.popups[0].config.keyboard, false);
        assert.equal(h.modal.isOpen(), true);
        h.view.password = 'must-not-remain'; h.view.leave();
        await new Promise(setImmediate);
        assert.equal(h.modal.isOpen(), false);
        assert.equal(h.view.password, '');
        assert.deepEqual(h.routes, ['login']);
    }
});

test('modal wrong-password retry can succeed, verifies the same account, and emits restoration once', async () => {
    for (const frontend of ['richy', 'core']) {
        let attempts = 0, lookups = 0;
        const h = await modalHarness(config => {
            if (config.url.endsWith('/oauth/token')) {
                attempts++;
                if (attempts === 1) throw {status: 400, data: {error: 'invalid_grant'}};
                return fresh;
            }
            lookups++; return {data: {id: 7, username: 'alice', roles: []}};
        }, frontend);
        h.view.password = 'wrong'; await h.view.submit();
        assert.match(h.view.error, /không đúng/);
        assert.equal(h.view.password, '');
        assert.equal(h.popups[0].closed, false);
        h.view.password = 'correct'; await h.view.submit();
        assert.equal(attempts, 2);
        assert.equal(lookups, 1);
        assert.equal(h.cookies['education.user'].username, 'alice');
        assert.equal(h.popups[0].closed, true);
        assert.equal(h.events.filter(event => event === 'session:restored').length, 1);
    }
});

test('modal offline/timeout failures keep it open and duplicate submissions issue only one password grant', async () => {
    const gate = deferred(); let requests = 0;
    const h = await modalHarness(() => {requests++; return gate.promise;});
    h.context.window.navigator.onLine = false;
    h.view.password = 'correct'; await h.view.submit();
    assert.equal(requests, 0); assert.match(h.view.error, /Internet/);
    h.context.window.navigator.onLine = true;
    const task = h.view.submit(); h.view.submit();
    await new Promise(setImmediate);
    assert.equal(requests, 1); assert.equal(h.view.busy, true);
    gate.reject({status: 0}); await task;
    assert.equal(h.view.busy, false); assert.equal(h.popups[0].closed, false);
    assert.equal(h.token.getRefreshToken(), 'refresh-1');
});

test('modal rejects an account ID mismatch without accepting it as the previous account', async () => {
    const h = await modalHarness(config => config.url.endsWith('/oauth/token') ? fresh :
        {data: {id: 99, username: 'alice', roles: []}});
    h.view.password = 'correct'; await h.view.submit();
    assert.equal(h.popups[0].closed, false); assert.match(h.view.error, /không trùng/);
    assert.equal(h.cookies['education.user'], undefined);
    assert.equal(h.session.hasCredentials(), false);
    assert.equal(h.events.includes('session:restored'), false);
});

test('a tab account switch during modal verification cannot overwrite or revoke the newer account', async () => {
    for (const frontend of ['richy', 'core']) {
        const lookup = deferred(), revocations = [];
        const h = await modalHarness(config => {
            if (config.url.endsWith('/oauth/token')) return fresh;
            if (config.url.endsWith('/oauth/revoke')) {revocations.push(config.data); return {};}
            return lookup.promise;
        }, frontend);
        h.view.password = 'correct'; const task = h.view.submit();
        await new Promise(setImmediate);
        h.token.setToken({...fresh.data, access_token: 'other-account', refresh_token: 'other-refresh'});
        h.session.saveUser({id: 8, username: 'bob', roles: []});
        lookup.resolve({data: {id: 7, username: 'alice', roles: []}}); await task;
        assert.equal(h.cookies['education.user'].username, 'bob');
        assert.equal(h.token.getRefreshToken(), 'other-refresh');
        assert.equal(h.popups[0].closed, false);
        assert.deepEqual(revocations, []);
        assert.equal(h.events.includes('session:restored'), false);
    }
});

test('global login exits fullscreen before opening its modal and deduplicates while waiting', async () => {
    const h = await modalHarness(() => ({}));
    h.view.leave(); await new Promise(setImmediate);
    const gate = deferred(); let exits = 0;
    h.context.window.document.fullscreenElement = {};
    h.context.window.document.exitFullscreen = () => {exits++; return gate.promise;};
    h.modal.open({id: 7, username: 'alice'}); h.modal.open({id: 7, username: 'alice'});
    await new Promise(setImmediate);
    assert.equal(exits, 1); assert.equal(h.popups.length, 1);
    gate.resolve(); await new Promise(setImmediate);
    assert.equal(h.popups.length, 2); assert.equal(h.modal.isOpen(), true);
});

test('an active Battle login handler owns reauthentication without a second global modal', () => {
    const h = setup(() => ({})), app = startApp(h);
    h.deps.$rootScope.$broadcast = name => ({defaultPrevented: name === 'session:reauthenticate'});
    h.session.reportUnverified();
    assert.equal(app.modals.length, 0); assert.deepEqual(app.navigations, []);
});

test('modal restoration reloads dashboard reads and keeps other views and unsaved inputs mounted', () => {
    for (const stateName of ['application.dashboard', 'application.ielts_reading_actual_test', 'application.question']) {
        const h = setup(() => ({})), app = startApp(h); let reloads = 0;
        app.state.current.name = stateName; app.state.reload = () => {reloads++;};
        app.listeners['session:restored']({}, {id: 7, username: 'alice', roles: []}, {modal: true});
        assert.equal(reloads, stateName === 'application.dashboard' ? 1 : 0);
        assert.deepEqual(app.navigations, []);
    }
});

test('an old resource 401 cannot expire or cancel a pending password login', async () => {
    for (const frontend of ['richy', 'core']) {
        const gate = deferred(); let refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) {
                if (config.loginRequest) return gate.promise;
                refreshes++; throw {status: 400, data: {error: 'invalid_grant'}};
            }
            throw invalid;
        }, 'https:', frontend);
        const task = h.session.login({username: 'alice', password: 'correct'});
        await assert.rejects(h.http({url: api}), error => error.sessionChanged === true);
        assert.equal(refreshes, 0);
        assert.equal(h.events.includes('session:expired'), false);
        gate.resolve(fresh); await task;
        assert.equal(h.token.getAccessToken(), 'fresh');
    }
});

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
        assert.notEqual(h.deps.$rootScope.sessionRecoveryRequired, true);
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

test('repeated resource 401s stop after two recoveries and preserve the refresh session', async () => {
    let refreshes = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) { refreshes++; return fresh; }
        throw invalid;
    });
    await assert.rejects(h.http({url: api}));
    assert.equal(refreshes, 2);
    assert.equal(h.token.getRefreshToken(), 'refresh-1');
    assert.deepEqual(h.events, ['session:unverified']);
    assert.equal(h.deps.$rootScope.sessionRecoveryRequired, true);
});

test('an old revoked session clears stale user data and requests a modal without reviving its grant', async () => {
    for (const frontend of ['richy', 'core']) {
        let refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) {
                refreshes++;
                throw {status: 400, data: {error: 'invalid_grant'}};
            }
            throw invalid;
        }, 'https:', frontend);
        h.session.saveUser({id: 7, roles: [{name: 'ROLE_ADMIN'}]});
        const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
        h.deps.$rootScope.$state.current.name = 'application.dashboard';
        app.listeners.$locationChangeSuccess();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(refreshes, 1);
        assert.equal(h.session.hasCredentials(), false);
        assert.equal(h.cookies['education.user'], undefined);
        assert.equal(h.deps.$rootScope.currentUser, null);
        assert.deepEqual(app.navigations, []);
        assert.equal(app.modals.length, 1);
        assert.equal(app.modals[0].id, 7);
        assert.match(h.deps.$rootScope.sessionNotice, /đăng nhập lại một lần/);
    }
});

test('bounded 401 recovery offers an explicit way out and retry reloads data only after verification', async () => {
    for (const frontend of ['richy', 'core']) {
        let fail = true, reloads = 0, revocations = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) return fresh;
            if (config.url.endsWith('/oauth/revoke')) { revocations++; return {}; }
            if (fail) throw invalid;
            return {data: {id: 7, roles: []}};
        }, 'https:', frontend);
        h.session.saveUser({id: 7, roles: []});
        const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
        const state = frontend === 'richy' ? app.state : h.deps.$rootScope.$state;
        state.current.name = 'application.dashboard';
        state.reload = () => {reloads++;};
        app.listeners.$locationChangeSuccess();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(h.deps.$rootScope.sessionRecoveryRequired, true);
        assert.equal(h.session.hasCredentials(), true);
        assert.equal(revocations, 0);
        assert.equal(reloads, 0);
        assert.deepEqual(app.navigations, []);
        h.deps.$rootScope.retrySessionRecovery();
        assert.equal(h.deps.$rootScope.sessionRecoveryChecking, false);
        // The fallback recovery button works once no modal is mounted.
        h.deps.SessionLoginModal.isOpen = () => false;
        fail = false;
        h.deps.$rootScope.retrySessionRecovery();
        assert.equal(h.deps.$rootScope.sessionRecoveryChecking, true);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(h.deps.$rootScope.sessionRecoveryRequired, false);
        assert.equal(h.deps.$rootScope.sessionRecoveryChecking, false);
        assert.equal(h.session.hasCredentials(), true);
        assert.equal(reloads, 1);
        assert.equal(revocations, 0);
    }
});

test('choosing to sign in again revokes only the old browser grant and preserves learning drafts', async () => {
    for (const frontend of ['richy', 'core']) {
        const revocations = [], drafts = {inProgress: 'saved-answer'};
        const h = setup(config => {
            if (config.url.endsWith('/oauth/revoke')) { revocations.push(config.data); return {}; }
            throw invalid;
        }, 'https:', frontend);
        h.context.window.localStorage = {getItem: key => drafts[key], setItem(key, value) {drafts[key] = value;},
            removeItem() {throw Error('Learning drafts must not be removed');}, clear() {throw Error('Storage must not be cleared');}};
        h.session.saveUser({id: 7, roles: []});
        const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
        h.deps.$rootScope.$state.current.name = 'application.dashboard';
        h.deps.$rootScope.sessionRecoveryRequired = true;
        h.deps.$rootScope.signInAgain();
        assert.deepEqual(app.navigations, []);
        assert.equal(app.modals.length, 1);
        assert.equal(h.session.hasCredentials(), false);
        assert.equal(h.deps.$rootScope.sessionRecoveryRequired, false);
        assert.equal(h.cookies['education.user'], undefined);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(revocations.length, 1);
        assert.match(revocations[0], /token=refresh-1&token_type_hint=refresh_token/);
        assert.equal(drafts.inProgress, 'saved-answer');
    }
});

test('stale authorization failures cannot raise a recovery notice over a newer login', () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({}), 'https:', frontend);
        const oldHeader = h.token.getAuthorizationHeader();
        h.token.setToken({...fresh.data, refresh_token: 'another-device-session'});
        h.session.reportUnverified(oldHeader);
        assert.notEqual(h.deps.$rootScope.sessionRecoveryRequired, true);
    }
});

test('valid existing finite and persistent sessions remain signed in without a recovery prompt', async () => {
    for (const frontend of ['richy', 'core']) {
        for (const persistent of [false, true]) {
            const h = setup(() => ({data: {id: 7, username: 'existing-user', roles: []}}), 'https:', frontend);
            h.token.setToken({...fresh.data, persistent_session: persistent});
            h.session.saveUser({id: 7, roles: []});
            const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
            if (frontend === 'core') h.deps.$rootScope.$state.current.name = 'application.dashboard';
            app.listeners.$locationChangeSuccess();
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(h.token.getRefreshToken(), 'refresh-1');
            assert.equal(h.cookies['education.user'].username, 'existing-user');
            assert.equal(h.deps.$rootScope.sessionRecoveryRequired, false);
            assert.equal(h.events.includes('session:expired'), false);
            assert.deepEqual(app.navigations, []);
        }
    }
});

test('two tabs sharing a refresh token recover safely in both response orderings without Web Locks', async () => {
    for (const frontend of ['richy', 'core']) {
        for (const order of [[1, 2], [2, 1]]) {
            const gates = [null, deferred(), deferred()];
            let refreshes = 0, activeAccess = 'expired';
            const revoked = [], attempts = [];
            const data = number => ({access_token: 'access-' + number, refresh_token: 'shared-refresh',
                token_type: 'bearer', persistent_session: true, expires_in: 3600});
            const h = setup(config => {
                if (config.url.endsWith('/oauth/revoke')) { revoked.push(config.data); return {}; }
                if (config.url.endsWith('/oauth/token')) {
                    const number = ++refreshes;
                    activeAccess = 'access-' + number;
                    return number <= 2 ? gates[number].promise : {data: data(number)};
                }
                attempts.push(config.sessionAuthRecoveries || 0);
                if (config.headers.Authorization !== 'Bearer ' + activeAccess) throw invalid;
                return {data: {id: 7}};
            }, 'https:', frontend);
            h.token.setToken({...data(0), access_token: 'old'});
            const other = anotherTab(h);
            const first = h.http({url: api});
            await new Promise(resolve => setImmediate(resolve));
            const second = other.http({url: api});
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(refreshes, 2);
            gates[order[0]].resolve({data: data(order[0])});
            await new Promise(resolve => setImmediate(resolve));
            gates[order[1]].resolve({data: data(order[1])});
            const responses = await Promise.all([first, second]);
            assert.equal(responses.length, 2);
            assert.equal(h.token.getAccessToken(), activeAccess);
            assert.equal(h.token.getRefreshToken(), 'shared-refresh');
            assert.ok(Math.max(...attempts) <= 2);
            assert.ok(refreshes <= 3);
            assert.deepEqual(h.events, []);
            assert.deepEqual(other.events, []);
            assert.deepEqual(revoked, []);
        }
    }
});

test('Web Locks serialize cross-tab refresh and the waiting tab reuses the installed access token', async () => {
    for (const frontend of ['richy', 'core']) {
        const gate = deferred(), names = [];
        let tail = Promise.resolve(), refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) { refreshes++; return gate.promise; }
            if (config.headers.Authorization === 'Bearer old') throw invalid;
            return {data: {id: 7}};
        }, 'https:', frontend);
        h.context.window.navigator = {locks: {request(name, callback) {
            names.push(name);
            const result = tail.then(callback);
            tail = result.catch(() => {});
            return result;
        }}};
        const other = anotherTab(h);
        const pending = Promise.all([h.http({url: api}), other.http({url: api})]);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(refreshes, 1);
        gate.resolve(fresh);
        await pending;
        assert.equal(refreshes, 1);
        assert.equal(names.length, 2);
        assert.equal(names[0], names[1]);
        assert.ok(!names[0].includes('refresh-1'));
        assert.deepEqual(h.events, []);
        assert.deepEqual(other.events, []);
    }
});

test('denied Web Locks fall back to normal refresh and a truly revoked refresh grant still expires', async () => {
    for (const frontend of ['richy', 'core']) {
        for (const revoked of [false, true]) {
            let refreshes = 0;
            const h = setup(config => {
                if (config.url.endsWith('/oauth/token')) {
                    refreshes++;
                    if (revoked) throw {status: 400, data: {error: 'invalid_grant'}};
                    return fresh;
                }
                if (config.headers.Authorization === 'Bearer old') throw invalid;
                return {data: {id: 7}};
            }, 'https:', frontend);
            h.context.window.navigator = {locks: {request() { return Promise.reject(Error('Locks unavailable')); }}};
            if (revoked) {
                await assert.rejects(h.http({url: api}));
                assert.equal(h.token.getToken(), undefined);
                assert.deepEqual(h.events, ['session:expired']);
            } else {
                await h.http({url: api});
                assert.equal(h.token.getAccessToken(), 'fresh');
                assert.deepEqual(h.events, []);
            }
            assert.equal(refreshes, 1);
        }
    }
});

test('logout cancels a refresh queued behind another tab Web Lock without restoring credentials', async () => {
    for (const frontend of ['richy', 'core']) {
        const gate = deferred();
        let tail = Promise.resolve(), refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/revoke')) return {};
            if (config.url.endsWith('/oauth/token')) { refreshes++; return gate.promise; }
            throw invalid;
        }, 'https:', frontend);
        h.context.window.navigator = {locks: {request(name, callback) {
            const result = tail.then(callback);
            tail = result.catch(() => {});
            return result;
        }}};
        const other = anotherTab(h);
        const pending = Promise.allSettled([h.http({url: api}), other.http({url: api})]);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(refreshes, 1);
        await h.session.logout();
        gate.resolve(fresh);
        const responses = await pending;
        assert.equal(responses.every(response => response.status === 'rejected'), true);
        assert.equal(refreshes, 1);
        assert.equal(h.token.getToken(), undefined);
        assert.deepEqual(h.events, []);
        assert.deepEqual(other.events, []);
    }
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

test('logout revokes refresh credentials while a refresh is pending and never resurrects the session', async () => {
    const gate = deferred();
    const revocations = [];
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) return gate.promise;
        if (config.url.endsWith('/oauth/revoke')) { revocations.push(config); return {}; }
        throw invalid;
    });
    const pending = h.http({url: api});
    const rejected = assert.rejects(pending, error => error.sessionChanged === true);
    await new Promise(resolve => setImmediate(resolve));
    await h.session.logout();
    assert.equal(revocations[0].method, 'POST');
    assert.equal(revocations[0].headers.Authorization, undefined);
    assert.equal(new URLSearchParams(revocations[0].data).get('token'), 'refresh-1');
    assert.equal(new URLSearchParams(revocations[0].data).get('token_type_hint'), 'refresh_token');
    gate.resolve(fresh);
    await rejected;
    assert.equal(h.cookies.token, undefined);
});

test('logout revokes by refresh token even without a usable access token and remains local offline', async () => {
    let request;
    const h = setup(config => { request = config; throw {status: 0}; });
    h.token.setToken({refresh_token: 'refresh-only'});
    await h.session.logout();
    assert.equal(new URLSearchParams(request.data).get('token'), 'refresh-only');
    assert.equal(new URLSearchParams(request.data).get('client_id'), h.Hrm.API_CLIENT_ID);
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(h.token.getToken(), undefined);
    h.token.setToken({access_token: 'access-only', token_type: 'bearer'});
    await h.session.logout();
    assert.equal(new URLSearchParams(request.data).get('token'), 'access-only');
    assert.equal(new URLSearchParams(request.data).get('token_type_hint'), 'access_token');
});

test('server refresh expiry overrides guessed cookie expiry, with compatibility for older responses', () => {
    const h = setup(() => ({}));
    const exact = Date.now() + 45000;
    h.token.setToken({...fresh.data, refresh_token_expires_at: exact});
    assert.equal(h.cookies.token.session_expires_at, exact);
    assert.equal(h.cookieOptions.token.expires.getTime(), exact);
    h.token.setToken(fresh.data);
    assert.equal(h.cookies.token.session_expires_at, exact);
    h.token.setToken({...fresh.data, refresh_token: 'different', refresh_expires_in: 60});
    assert.ok(Math.abs(h.cookies.token.session_expires_at - Date.now() - 60000) < 1000);
    h.token.setToken({...fresh.data, refresh_token: 'expired', refresh_expires_in: 0});
    assert.ok(Math.abs(h.cookies.token.session_expires_at - Date.now()) < 1000);
});

test('explicit persistent sessions renew token and matching user cookies on restore without extending access validity', () => {
    const day = 24 * 60 * 60 * 1000;
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({}), 'https:', frontend);
        h.token.setToken({...fresh.data, persistent_session: true, expires_in: 60});
        h.deps.$cookies.putObject('education.auth-session', 'same-session', {expires: new Date(h.clock.now + 30 * day)});
        const accessExpiry = h.cookies.token.access_expires_at;
        const browserSession = h.cookies.token._browser_session_id;
        assert.equal(h.cookies.token.session_expires_at, h.clock.now + 365 * day);
        h.session.saveUser({id: 7, roles: []}, h.session.capture());
        h.clock.now += 100 * day;
        const restarted = invoke(h.factories.AuthSession, {...h.deps, $rootScope: {$emit() {}}});
        restarted.restore();
        assert.equal(h.cookies.token.session_expires_at, h.clock.now + 365 * day);
        assert.equal(h.cookieOptions.token.expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.cookieOptions['education.user'].expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.cookieOptions['education.auth-session'].expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.cookies['education.auth-session'], 'same-session');
        assert.equal(h.cookies.token.access_expires_at, accessExpiry);
        assert.ok(accessExpiry < h.clock.now);
        assert.equal(h.cookies.token._browser_session_id, browserSession);
        assert.equal(h.cookies['education.user']._auth_session_id, browserSession);
    }
});

test('persistent cookie renewal on API use never prolongs a cached user from another session', async () => {
    const day = 24 * 60 * 60 * 1000;
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({data: {ok: true}}), 'https:', frontend);
        h.token.setToken({...fresh.data, persistent_session: true});
        h.session.saveUser({id: 'A', roles: []}, h.session.capture());
        const oldUserExpiry = h.cookieOptions['education.user'].expires.getTime();
        h.token.setToken({...fresh.data, access_token: 'B', refresh_token: 'refresh-B', persistent_session: true});
        h.clock.now += day;
        await h.http({url: api});
        assert.equal(h.cookies.token.session_expires_at, h.clock.now + 365 * day);
        assert.equal(h.cookieOptions['education.user'].expires.getTime(), oldUserExpiry);
        assert.equal(h.cookies['education.user'].id, 'A');
        h.session.saveUser({id: 'B', roles: []}, h.session.capture());
        h.clock.now += day;
        await h.http({url: api});
        assert.equal(h.cookieOptions['education.user'].expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.cookies['education.user'].id, 'B');
    }
});

test('renewing a persistent session never creates a new marker after the marker cookie disappeared', () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({}), 'https:', frontend);
        h.token.setToken({...fresh.data, persistent_session: true});
        h.session.restore();
        assert.equal(h.cookies['education.auth-session'], undefined);
        assert.equal(h.session.hasCredentials(), true);
    }
});

test('persistent cookie renewal cannot restore credentials removed by a concurrent logout', () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({}), 'https:', frontend);
        h.token.setToken({...fresh.data, persistent_session: true});
        const otherTab = invoke(h.factories.AuthSession, {...h.deps, $rootScope: {$emit() {}}});
        const write = h.deps.$cookies.putObject;
        h.deps.$cookies.putObject = (name, value, options) => {
            write(name, value, options);
            if (name === 'token') otherTab.logout();
        };
        assert.equal(h.session.restore(), false);
        assert.equal(h.token.getToken(), undefined);
    }
});

test('finite and legacy sessions are never converted to persistent sessions or extended on restore/use', async () => {
    for (const frontend of ['richy', 'core']) {
        for (const metadata of [{}, {persistent_session: 'true'}, {persistent_session: true, refresh_expires_in: 7200},
            {persistent_session: true, refresh_token_expires_at: Date.now() + 7200000}]) {
            const h = setup(() => ({data: {ok: true}}), 'https:', frontend);
            h.token.setToken({...fresh.data, ...metadata});
            h.session.saveUser({id: 7, roles: []}, h.session.capture());
            const expiry = h.cookies.token.session_expires_at;
            h.clock.now += 1000;
            h.session.restore();
            await h.http({url: api});
            assert.equal(h.session.isPersistent(), false);
            assert.equal(h.cookies.token.session_expires_at, expiry);
            assert.equal(h.cookieOptions['education.user'].expires.getTime(), expiry);
        }
    }
});

test('password login cannot revive a logged out session and stale issued credentials are revoked', async () => {
    const gate = deferred(), revoked = [];
    const h = setup(config => {
        if (config.url.endsWith('/oauth/revoke')) { revoked.push(new URLSearchParams(config.data).get('token')); return {}; }
        assert.equal(new URLSearchParams(config.data).get('grant_type'), 'password');
        assert.equal(config.headers.Authorization, undefined);
        return gate.promise;
    });
    const pending = h.session.login({username: 'A', password: 'fake'});
    const rejected = assert.rejects(pending, error => error.sessionChanged === true);
    await h.session.logout();
    gate.resolve({data: {...fresh.data, refresh_token: 'issued-after-logout'}});
    await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.token.getToken(), undefined);
    assert.deepEqual(revoked, ['refresh-1', 'issued-after-logout']);
});

test('a logout in another tab cancels a password login that began anonymously', async () => {
    const gate = deferred();
    const h = setup(config => config.url.endsWith('/oauth/revoke') ? {} : gate.promise);
    h.token.removeToken();
    const pending = h.session.login({username: 'A', password: 'fake'});
    const rejected = assert.rejects(pending, error => error.sessionChanged === true);
    const otherTab = invoke(h.factories.AuthSession, {...h.deps, $rootScope: {$emit() {}}});
    await otherTab.logout();
    gate.resolve(fresh);
    await rejected;
    assert.equal(h.token.getToken(), undefined);
});

test('password login never adopts a marker written by another tab during session advancement', async () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(config => config.url.endsWith('/oauth/revoke') ? {} : fresh, 'https:', frontend);
        const write = h.deps.$cookies.putObject;
        h.deps.$cookies.putObject = (name, value, options) => {
            write(name, value, options);
            if (name === 'education.auth-session') h.cookies[name] = 'other-tab-won';
        };
        await assert.rejects(h.session.login({username: 'A', password: 'fake'}), error => error.sessionChanged === true);
        assert.equal(h.token.getAccessToken(), 'old');
    }
});

test('a session change interleaved with writing a token or user fails closed in both frontends', async () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(config => config.url.endsWith('/oauth/revoke') ? {} : fresh, 'https:', frontend);
        const write = h.deps.$cookies.putObject;
        h.deps.$cookies.putObject = (name, value, options) => {
            if (name === 'token') h.cookies['education.auth-session'] = 'other-tab';
            write(name, value, options);
        };
        await assert.rejects(h.session.login({username: 'A', password: 'fake'}), error => error.sessionChanged === true);
        assert.equal(h.token.getToken(), undefined);
        h.deps.$cookies.putObject = write;
        h.token.setToken(fresh.data);
        const identity = h.session.capture();
        h.deps.$cookies.putObject = (name, value, options) => {
            if (name === 'education.user') h.cookies['education.auth-session'] = 'another-tab';
            write(name, value, options);
        };
        assert.equal(h.session.saveUser({id: 'A', roles: [{name: 'ROLE_ADMIN'}]}, identity), false);
        assert.equal(h.cookies['education.user'], undefined);
        assert.equal(h.deps.$rootScope.currentUser, null);
    }
});

test('a newer password login wins across tabs and an older response cannot overwrite it', async () => {
    const first = deferred(), second = deferred(), revoked = [];
    const h = setup(config => {
        const form = new URLSearchParams(config.data);
        if (config.url.endsWith('/oauth/revoke')) { revoked.push(form.get('token')); return {}; }
        return form.get('username') === 'A' ? first.promise : second.promise;
    });
    const pendingA = h.session.login({username: 'A', password: 'fake'});
    const rejected = assert.rejects(pendingA, error => error.sessionChanged === true);
    const otherTab = invoke(h.factories.AuthSession, {...h.deps, $rootScope: {$emit() {}}});
    const pendingB = otherTab.login({username: 'B', password: 'fake'});
    second.resolve({data: {...fresh.data, access_token: 'B', refresh_token: 'refresh-B'}});
    const accepted = await pendingB;
    assert.equal(otherTab.isCurrent(accepted.sessionIdentity), true);
    first.resolve({data: {...fresh.data, access_token: 'A', refresh_token: 'refresh-A'}});
    await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.token.getAccessToken(), 'B');
    assert.deepEqual(revoked, ['refresh-A']);
});

test('a stale password response never revokes a winning login that reuses the same refresh token', async () => {
    const first = deferred(), second = deferred(), revoked = [];
    let logins = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/revoke')) { revoked.push(config.data); return {}; }
        return ++logins === 1 ? first.promise : second.promise;
    });
    const old = h.session.login({username: 'same', password: 'fake'});
    const rejected = assert.rejects(old, error => error.sessionChanged === true);
    const latest = h.session.login({username: 'same', password: 'fake'});
    second.resolve(fresh); await latest;
    first.resolve(fresh); await rejected;
    assert.deepEqual(revoked, []);
    assert.equal(h.token.getAccessToken(), 'fresh');
});

test('a previous refresh never blocks or clears a new session refresh', async () => {
    const first = deferred(), second = deferred();
    let refreshes = 0;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/revoke')) return {};
        return ++refreshes === 1 ? first.promise : second.promise;
    });
    const old = h.session.refresh();
    const rejected = assert.rejects(old, error => error.sessionChanged === true);
    await h.session.logout();
    h.token.setToken({...fresh.data, access_token: 'new-old', refresh_token: 'new-refresh'});
    const current = h.session.refresh();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(refreshes, 2);
    first.reject({status: 401}); await rejected;
    second.resolve({data: {...fresh.data, access_token: 'new-fresh', refresh_token: 'new-refresh'}});
    await current;
    assert.equal(h.token.getAccessToken(), 'new-fresh');
    assert.deepEqual(h.events, []);
});

test('core frontend also constrains bearer origin, retries one refresh, and revokes with expired access credentials', async () => {
    let refreshes = 0, revocation;
    const expiry = Date.now() + 120000;
    const h = setup(config => {
        if (config.url.endsWith('/oauth/token')) {
            refreshes++; return {data: {...fresh.data, refresh_token_expires_at: expiry}};
        }
        if (config.url.endsWith('/oauth/revoke')) { revocation = config; return {}; }
        if (config.headers.Authorization === 'Bearer old') throw invalid;
        return {data: {id: 7}};
    }, 'https:', 'core');
    const provider = {interceptors: ['oauthInterceptor']};
    invoke(h.configs.find(def => def[0] === '$httpProvider'), {$httpProvider: provider});
    assert.deepEqual(Array.from(provider.interceptors), ['SessionAuthInterceptor', 'ServerExceptionHandlerInterceptor']);
    assert.equal(h.interceptor.request({url: 'https://other.test/api/'}).headers.Authorization, undefined);
    await Promise.all([h.http({url: api}), h.http({url: api + '?second=1'})]);
    assert.equal(refreshes, 1);
    assert.equal(h.token.getAccessToken(), 'fresh');
    assert.equal(h.cookies.token.session_expires_at, expiry);
    h.token.setToken({refresh_token: 'core-refresh-only', refresh_token_expires_at: expiry});
    await h.session.logout();
    assert.equal(new URLSearchParams(revocation.data).get('token'), 'core-refresh-only');
    assert.equal(revocation.headers.Authorization, undefined);
    assert.equal(h.token.getToken(), undefined);
});

test('core password login is cancelled by logout in another tab', async () => {
    const gate = deferred();
    const h = setup(config => config.url.endsWith('/oauth/revoke') ? {} : gate.promise, 'https:', 'core');
    h.token.removeToken();
    const pending = h.session.login({username: 'core-user', password: 'fake'});
    const rejected = assert.rejects(pending, error => error.sessionChanged === true);
    const otherTab = invoke(h.factories.AuthSession, {...h.deps, $rootScope: {$emit() {}}});
    await otherTab.logout();
    gate.resolve(fresh);
    await rejected;
    assert.equal(h.token.getToken(), undefined);
});

function startCoreApp(h) {
    const listeners = {}, windowListeners = {}, documentListeners = {}, navigations = [], modals = [], root = h.deps.$rootScope;
    h.deps.SessionLoginModal = {open(user) {modals.push(copy(user));}, isOpen() {return modals.length > 0;}};
    root.$evalAsync = fn => fn();
    h.context.window.navigator = {onLine: true};
    h.context.window.document = {
        hidden: false,
        addEventListener(name, fn) { documentListeners[name] = fn; },
        removeEventListener(name) { delete documentListeners[name]; }
    };
    h.context.window.addEventListener = (name, fn) => { windowListeners[name] = fn; };
    h.context.window.removeEventListener = name => { delete windowListeners[name]; };
    root.$on = (name, fn) => { listeners[name] = fn; };
    root.$emit = (name, ...args) => { h.events.push(name); if (listeners[name]) listeners[name]({}, ...args); };
    let definition;
    h.Hrm.run = value => { definition = value; };
    h.context.angular.module = () => h.Hrm;
    vm.runInContext(fs.readFileSync(path.join(h.appRoot, 'application.js'), 'utf8'), h.context);
    invoke(definition, {...h.deps,
        settings: {api: {baseUrl: 'https://example.test/service/'}},
        $state: {current: {name: 'login'}, go(name) { navigations.push(name); }},
        $http: {get: (url, options) => h.http({...options, url, method: 'GET'})},
        blockUI: {start() {}, stop() {}}, toastr: {warning() {}}, Idle: {watch() {}}, Keepalive: {start() {}}
    });
    return {listeners, navigations, windowListeners, documentListeners, modals};
}

test('core route checks preserve the session during server/network failures and ignore stale successful users', async () => {
    for (const status of [0, 503]) {
        const h = setup(() => {throw {status};}, 'https:', 'core'), app = startCoreApp(h);
        app.listeners.$locationChangeSuccess();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(h.token.getAccessToken(), 'old');
        assert.deepEqual(app.navigations, []);
    }
    const gate = deferred(), h = setup(() => gate.promise, 'https:', 'core'), app = startCoreApp(h);
    app.listeners.$locationChangeSuccess();
    h.token.setToken({...fresh.data, access_token: 'B', refresh_token: 'refresh-B'});
    h.session.saveUser({id: 'B', roles: []});
    gate.resolve({data: {id: 'A', roles: [{name: 'ROLE_ADMIN'}]}});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.cookies['education.user'].id, 'B');
    assert.deepEqual(app.navigations, []);
});

test('responses from the previous user cannot retry as a new user', async () => {
    const h = setup(() => { throw new Error('Must not make another request'); });
    const config = h.interceptor.request({url: api});
    h.token.setToken({access_token: 'other', refresh_token: 'refresh-2'});
    await assert.rejects(h.interceptor.responseError({...invalid, config}));
    assert.equal(h.token.getAccessToken(), 'other');
    assert.equal(h.events.length, 0);
});

test('an account switch between refresh completion and replay cannot send an old POST as the new user', async () => {
    for (const frontend of ['richy', 'core']) {
        let requests = 0;
        const h = setup(() => { requests++; throw invalid; }, 'https:', frontend);
        h.deps.AuthSession = {touch() {}, refresh() {
            return Promise.resolve().then(() => {
                h.token.setToken({...fresh.data, access_token: 'other-user', refresh_token: 'other-refresh'});
            });
        }};
        await assert.rejects(h.http({url: api, method: 'POST', data: {owner: 'previous-user'}}),
            error => error.sessionChanged === true);
        assert.equal(requests, 1);
        assert.equal(h.token.getAccessToken(), 'other-user');
        assert.deepEqual(h.events, []);
    }
});

test('a delayed replay request interceptor rejects an account switch before attaching the new user bearer', async () => {
    for (const frontend of ['richy', 'core']) {
        let posts = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) return fresh;
            posts++; throw invalid;
        }, 'https:', frontend);
        const request = h.interceptor.request;
        h.interceptor.request = config => {
            if (config.sessionAuthRetried) {
                h.token.setToken({...fresh.data, access_token: 'other-user', refresh_token: 'other-refresh'});
            }
            return request(config);
        };
        await assert.rejects(h.http({url: api, method: 'POST', data: {owner: 'previous-user'}}),
            error => error.sessionChanged === true);
        assert.equal(posts, 1);
        assert.equal(h.token.getAccessToken(), 'other-user');
        assert.deepEqual(h.events, []);
    }
});

test('tokens only attach to this API and explicit Authorization is respected', () => {
    const h = setup(() => ({}));
    assert.equal(h.interceptor.request({url: 'https://other.test/api/'}).headers.Authorization, undefined);
    assert.equal(h.interceptor.request({url: 'assets/template.html'}).headers.Authorization, undefined);
    assert.equal(h.interceptor.request({url: api, headers: {Authorization: 'Basic custom'}}).headers.Authorization,
        'Basic custom');
});

test('HTTP configuration preserves the array captured by AngularJS while replacing the bundled OAuth interceptor', () => {
    for (const frontend of ['richy', 'core']) {
        const h = setup(() => ({}), 'https:', frontend);
        const captured = ['blockUIHttpInterceptor', 'oauthInterceptor'];
        const provider = {interceptors: captured};
        invoke(h.configs.find(def => def[0] === '$httpProvider'), {$httpProvider: provider});
        assert.equal(provider.interceptors, captured);
        assert.deepEqual(Array.from(captured), ['blockUIHttpInterceptor', 'SessionAuthInterceptor', 'ServerExceptionHandlerInterceptor']);
    }
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
    const notices = [], modals = [];
    h.deps.SessionLoginModal = {open(user) {modals.push(copy(user));}, isOpen() {return modals.length > 0;}};
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
    return {listeners, windowListeners, documentListeners, timers, navigations, settings, blockCalls, notices, state, modals};
}

test('background current-user checks never turn bounded resource 401s into a false logout', async () => {
    for (const frontend of ['richy', 'core']) {
        let refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) { refreshes++; return fresh; }
            throw invalid;
        }, 'https:', frontend);
        h.token.setToken({...fresh.data, persistent_session: true});
        h.session.saveUser({id: 7, roles: []});
        const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
        app.listeners.$locationChangeSuccess();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(refreshes, 2);
        assert.equal(h.token.getAccessToken(), 'fresh');
        assert.equal(h.cookies['education.user'].id, 7);
        assert.equal(h.events.includes('session:expired'), false);
        assert.deepEqual(app.navigations, []);
    }
});

test('persistent login resumes after access expiry and restores a missing user cookie through one refresh', async () => {
    const day = 24 * 60 * 60 * 1000;
    for (const frontend of ['richy', 'core']) {
        let refreshes = 0;
        const h = setup(config => {
            if (config.url.endsWith('/oauth/token')) {
                refreshes++; return {data: {...fresh.data, persistent_session: true}};
            }
            if (config.headers.Authorization === 'Bearer old') throw invalid;
            return {data: {id: 7, roles: []}};
        }, 'https:', frontend);
        h.token.setToken({...fresh.data, access_token: 'old', expires_in: 60, persistent_session: true});
        h.session.saveUser({id: 7, roles: []}, h.session.capture());
        delete h.cookies['education.user'];
        h.deps.$rootScope.currentUser = null;
        h.clock.now += 40 * day;
        h.session = h.deps.AuthSession = invoke(h.factories.AuthSession, h.deps);
        const app = frontend === 'richy' ? startApp(h) : startCoreApp(h);
        app.windowListeners.pageshow();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(refreshes, 1);
        assert.equal(h.token.getAccessToken(), 'fresh');
        assert.equal(h.cookies['education.user'].id, 7);
        assert.equal(h.cookieOptions.token.expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.cookieOptions['education.user'].expires.getTime(), h.clock.now + 365 * day);
        assert.equal(h.events.includes('session:expired'), false);
    }
});

test('core idle timeout preserves persistent device login and still expires finite sessions', async () => {
    for (const persistent of [true, false]) {
        const h = setup(() => ({}), 'https:', 'core');
        h.token.setToken({...fresh.data, persistent_session: persistent});
        const app = startCoreApp(h);
        app.listeners.IdleTimeout();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(h.session.hasCredentials(), persistent);
        assert.deepEqual(app.navigations, persistent ? [] : ['login']);
    }
});

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

test('headerless 401 clears stale dashboard data and requests one login modal', async () => {
    const h = setup(() => { throw invalid; });
    h.session.saveUser({id: 7, roles: []});
    h.token.removeToken();
    const app = startApp(h);
    await Promise.allSettled([h.http({url: api}), h.http({url: api + '?second=1'})]);
    assert.equal(h.cookies['education.user'], undefined);
    assert.equal(h.deps.$rootScope.currentUser, null);
    assert.deepEqual(app.navigations, []);
    assert.equal(app.modals.length, 1);
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

test('a refresh-only token can recover; rejected refresh 401 requests a login modal', async () => {
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
            assert.deepEqual(app.navigations, []);
            assert.equal(app.modals.length, 1);
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
        assert.deepEqual(app.navigations, []);
        assert.equal(app.modals.length, 1);
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
    const h = setup(config => config.url.endsWith('/oauth/revoke') ? {} : gate.promise);
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
    assert.equal(app.modals.length, 1);
    assert.deepEqual(app.navigations, []);
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
    assert.equal(app.modals.length, 2);
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

function loginHarness(performLogin, frontend = 'richy') {
    const h = setup(() => ({data: {id: 7, roles: []}}), 'https:', frontend);
    let Controller;
    h.context.angular.module = () => ({controller(name, fn) { Controller = fn; }});
    h.context.angular.isFunction = value => typeof value === 'function';
    h.context.angular.isObject = value => value !== null && typeof value === 'object';
    h.context.angular.forEach = (items, fn) => items.forEach(fn);
    vm.runInContext(fs.readFileSync(path.join(h.appRoot, 'common/controllers/LoginController.js'), 'utf8'), h.context);
    const notices = [], blocks = [], navigations = [];
    const deps = {...h.deps,
        $rootScope: h.deps.$rootScope, $scope: {$on() {}},
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
    return {controller, notices, blocks, navigations, deps, h};
}

test('manual login user lookup cannot overwrite another account or navigate after logout', async () => {
    for (const frontend of ['richy', 'core']) {
    for (const change of ['new-account', 'logout']) {
        const lookup = deferred();
        const login = loginHarness(() => Promise.resolve({data: {access_token: 'valid'}}), frontend);
        login.deps.$http.get = () => lookup.promise;
        login.deps.settings.isAdmin = false;
        const pending = login.controller.login();
        await new Promise(resolve => setImmediate(resolve));
        if (change === 'new-account') {
            login.h.token.setToken({...fresh.data, access_token: 'B', refresh_token: 'refresh-B'});
            login.h.session.saveUser({id: 'B', roles: []});
        } else {
            await login.h.session.logout();
        }
        lookup.resolve({data: {id: 'A', roles: [{name: 'ROLE_ADMIN'}]}});
        await pending;
        assert.equal(login.h.cookies['education.user'] && login.h.cookies['education.user'].id,
            change === 'new-account' ? 'B' : undefined);
        assert.equal(login.deps.settings.isAdmin, false);
        assert.deepEqual(login.navigations, []);
        assert.equal(login.controller.isLoggingIn, false);
    }
    }
});

test('LoginService routes password login through AuthSession rather than the bundled token writer', () => {
    const h = setup(() => ({}));
    let Service;
    h.context.angular.module = () => ({service(name, fn) { Service = fn; }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'common/business/LoginService.js'), 'utf8'), h.context);
    const user = {username: 'A', password: 'fake'}, response = {};
    const service = {};
    Service.apply(service, Service.$inject.map(name => name === 'AuthSession'
        ? {login(value) { assert.equal(value, user); return response; }} : undefined));
    assert.equal(service.performLogin(user), response);
});

test('both self-password screens send the current password atomically and wait for server success', async () => {
    const appRoots = [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../../core/core-app/web-app/src/app')];
    for (const appRoot of appRoots) {
        for (const logoutAllDevices of [true, false]) {
        for (const accepted of [true, false]) {
            const h = setup(() => ({})), gate = deferred(), controllers = {}, opened = [], notices = [], mutations = [];
            h.Hrm.controller = (name, definition) => { controllers[name] = definition; };
            h.context.Core = h.Hrm;
            h.context.angular.forEach = (items, fn) => items.forEach(fn);
            vm.runInContext(fs.readFileSync(path.join(appRoot, 'application.controllers.js'), 'utf8'), h.context);
            const scope = {$on() {}}, root = {$on() {}}, modal = {
                open(options) {
                    const item = {options, closed: false, close() { this.closed = true; }};
                    opened.push(item); return item;
                }
            };
            invoke(controllers.AppController, {...h.deps,
                $scope: scope, $rootScope: root, $state: {go() {}}, $timeout() {}, settings: {}, $uibModal: modal,
                toastr: {info(message) { notices.push(['success', message]); }, error(message) { notices.push(['error', message]); }},
                Upload: {}, focus() {}, OAuth: {},
                UserService: {
                    passwordValid() { throw Error('Do not validate in a separate request'); },
                    changePasswordSelf(value) { mutations.push(value); return gate.promise; }
                }
            });
            scope.currentUser = {id: 7, username: 'synthetic', roles: [{name: 'ROLE_ADMIN'}]};
            scope.changePassword();
            assert.equal(scope.changePasswordObj.logoutAllDevices, true);
            Object.assign(scope.changePasswordObj, {currentPassword: 'old-secret', newPassword: 'new-secret', newPasswordRep: 'new-secret', logoutAllDevices});
            const pending = scope.changePasswordObj.saveNewPassword();
            scope.changePasswordObj.saveNewPassword();
            assert.equal(mutations.length, 1);
            assert.deepEqual({...mutations[0]}, {currentPassword: 'old-secret', password: 'new-secret', logoutAllDevices});
            assert.equal(scope.changePasswordObj.isSaving, true);
            assert.equal(opened.length, 1);
            assert.equal(opened[0].closed, false);
            assert.deepEqual(notices, []);
            if (accepted) gate.resolve({}); else gate.reject({status: 400});
            await pending;
            assert.equal(scope.changePasswordObj.isSaving, false);
            assert.equal(opened[0].closed, accepted);
            assert.equal(opened.length, 1);
            assert.equal(notices[0][0], accepted ? 'success' : 'error');
            if (accepted) {
                assert.equal(scope.changePasswordObj.currentPassword, null);
                assert.equal(h.token.getAccessToken(), logoutAllDevices ? undefined : 'old');
            } else {
                assert.equal(h.token.getAccessToken(), 'old');
            }
        }
        }
    }
});

test('every self-password modal exposes the optional logout-all-devices checkbox', () => {
    const paths = [
        '../common/views/navs/header-hoz.html', '../common/views/navs/header-hoz-for-login.html', '../common/views/navs/header-hoz-old.html',
        '../../../core/core-app/web-app/src/app/common/views/navs/header-hoz.html', '../../../core/core-app/web-app/src/app/common/views/navs/header.html'
    ];
    for (const filename of paths) {
        const html = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
        assert.match(html, /type="checkbox"[^>]+ng-model="changePasswordObj\.logoutAllDevices"[^>]+ng-disabled="changePasswordObj\.isSaving"[^>]*\/> Đăng xuất khỏi tất cả thiết bị/);
    }
});

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
        if (header === 'header-hoz.html') { assert.match(menu, /<li ng-if="settings\.campaignsEnabled === true"/); }
    }
});

test('Sales navigation is disabled only on IELTS Room and its www alias, preserving other domains', () => {
    for (const hostname of ['ieltsroom.com', 'www.ieltsroom.com', 'IELTSROOM.COM', 'www.IELTSROOM.COM',
        'tnttphungkhoang.com', 'www.tnttphungkhoang.com', 'richywine.com', 'localhost', 'other.example',
        'stage.ieltsroom.com', 'ieltsroom.com.other.example']) {
        const h = setup(() => ({data: {id: 7, roles: []}}));
        const app = startApp(h, hostname);
        assert.equal(app.settings.salesEnabled, !/^(www\.)?ieltsroom\.com$/i.test(hostname), hostname);
    }
});

test('all fair routes are limited to the exact TNTT domain and its www alias, including for admins', () => {
    const routes = ['fair_lookup', 'fair_lookup_event', 'fair_work', 'fair_work_event', 'fair_admin', 'fair_admin_event'];
    for (const hostname of ['tnttphungkhoang.com', 'www.tnttphungkhoang.com', 'TNTTPHUNGKHOANG.COM', 'WWW.TNTTPHUNGKHOANG.COM',
        'ieltsroom.com', 'www.ieltsroom.com', 'localhost', 'other.example', 'stage.tnttphungkhoang.com', 'tnttphungkhoang.com.evil.example']) {
        for (const admin of [false, true]) {
            const h = setup(() => ({data: {id: 7, roles: []}}));
            h.session.saveUser({id: 7, roles: admin ? [{name: 'ROLE_ADMIN'}] : []});
            const app = startApp(h, hostname), allowed = /^(www\.)?tnttphungkhoang\.com$/i.test(hostname), redirects = [];
            assert.equal(app.settings.fairsEnabled, allowed, hostname);
            assert.equal(app.settings.isAdmin, admin);
            app.state.go = (...args) => redirects.push(args);
            for (const name of routes) {
                let prevented = false;
                const lookup = name.startsWith('fair_lookup');
                app.listeners.$stateChangeStart({preventDefault() {prevented = true;}}, {name, data: {publicFair: lookup, fairPrivate: !lookup}}, {id: 7});
                assert.equal(prevented, !allowed, hostname + ': ' + name + ', admin=' + admin);
            }
            assert.equal(redirects.length, allowed ? 0 : routes.length);
            if (!allowed) assert.deepEqual(structuredClone(redirects[0]), ['login', {showHome: true}, {location: 'replace'}]);
        }
    }
});

test('anonymous fair lookup bypasses login only on TNTT; work and management still require login', () => {
    for (const hostname of ['tnttphungkhoang.com', 'www.tnttphungkhoang.com', 'ieltsroom.com', 'www.ieltsroom.com', 'localhost']) {
        for (const pathname of ['/hoi-cho', '/hoi-cho/7/tra-cuu', '/hoi-cho/lam-viec', '/hoi-cho/7/quan-tri', '/hoi-cho/7/transactions']) {
            const h = setup(() => {throw Error('Anonymous lookup must not check the current user');});
            const app = startApp(h, hostname);
            h.token.removeToken(); delete h.cookies['education.user']; h.deps.$rootScope.currentUser = null; h.context.window.location.pathname = pathname;
            app.listeners.$locationChangeSuccess();
            const publicLookup = app.settings.fairsEnabled && /^\/hoi-cho(?:\/7\/tra-cuu)?$/.test(pathname);
            assert.deepEqual(app.navigations, publicLookup ? [] : ['login'], hostname + pathname);
        }
    }
});

test('fair operator roles survive permission loading while ordinary login opens the dashboard', async () => {
    for (const role of ['ROLE_PLAY', 'ROLE_GIFT']) {
        const h = setup(() => ({data: {id: 7, roles: [{name: role}]}}));
        const app = startApp(h, 'tnttphungkhoang.com'); app.state.current.name = 'login'; app.state.params.showHome = false;
        app.listeners.$locationChangeSuccess(); await new Promise(resolve => setImmediate(resolve));
        assert.equal(app.settings.isFairPlay, role === 'ROLE_PLAY'); assert.equal(app.settings.isFairGift, role === 'ROLE_GIFT');
        assert.deepEqual(app.navigations, ['application.dashboard']);
    }
});

test('opening fair management from the public page remembers the intended page before login', () => {
    const h = setup(() => ({data: {}})), app = startApp(h, 'tnttphungkhoang.com'), saved = {};
    h.token.removeToken(); h.context.window.location.pathname = '/hoi-cho';
    h.context.window.sessionStorage.setItem = (key, value) => {saved[key] = value;};
    let prevented = false;
    app.listeners.$stateChangeStart({preventDefault() {prevented = true;}}, {name: 'fair_admin_event', data: {fairPrivate: true}}, {id: 7});
    assert.equal(prevented, true); assert.equal(saved['fair.returnPath'], '/hoi-cho/7/quan-tri'); assert.deepEqual(app.navigations, ['login']);
});
test('fresh manual login defaults to the dashboard for ordinary users, fair staff and admins', () => {
    for (const roles of [[], ['ROLE_PLAY'], ['ROLE_GIFT'], ['ROLE_PLAY', 'ROLE_GIFT'], ['ROLE_ADMIN'], ['ROLE_ADMIN', 'ROLE_PLAY']]) {
        const h = setup(() => ({data: {}})), app = startApp(h, 'tnttphungkhoang.com');
        h.session.saveUser({id: 7, roles: roles.map(name => ({name}))});
        app.settings.isFairPlay = false; app.settings.isFairGift = false;
        h.deps.$rootScope.navigateAfterLogin();
        assert.deepEqual(app.navigations, ['application.dashboard'], roles.join(','));
        assert.equal(app.settings.isFairPlay, roles.includes('ROLE_PLAY'));
        assert.equal(app.settings.isFairGift, roles.includes('ROLE_GIFT'));
        assert.equal(app.settings.isAdmin, roles.includes('ROLE_ADMIN'));
    }
});

test('explicit fair links still resume their validated destination once after login', () => {
    for (const [destination, state, id] of [
        ['/hoi-cho/lam-viec', 'fair_work', null], ['/hoi-cho/7/lam-viec', 'fair_work_event', 7],
        ['/hoi-cho/quan-tri', 'fair_admin', null], ['/hoi-cho/7/quan-tri', 'fair_admin_event', 7]
    ]) {
        const h = setup(() => ({data: {}})), app = startApp(h, 'tnttphungkhoang.com');
        const saved = {'fair.returnPath': destination}, redirects = [];
        h.context.window.sessionStorage.getItem = key => saved[key] || null;
        h.context.window.sessionStorage.removeItem = key => {delete saved[key];};
        app.state.go = (...args) => redirects.push(structuredClone(args));
        h.deps.$rootScope.navigateAfterLogin();
        assert.deepEqual(redirects, [[state, {id}]]);
        assert.equal(saved['fair.returnPath'], undefined);
        h.deps.$rootScope.resetPostLoginNavigation();
        h.deps.$rootScope.navigateAfterLogin();
        assert.deepEqual(redirects[1], ['application.dashboard']);
    }
});

test('fair staff roles and saved fair destinations do not open fair pages after login outside TNTT', async () => {
    for (const hostname of ['ieltsroom.com', 'www.ieltsroom.com', 'localhost', 'stage.tnttphungkhoang.com']) {
        for (const role of ['ROLE_PLAY', 'ROLE_GIFT']) {
            for (const destination of [null, '/hoi-cho/7/lam-viec', '/hoi-cho/7/quan-tri']) {
                const h = setup(() => ({data: {id: 7, roles: [{name: role}]}})), app = startApp(h, hostname);
                h.context.window.sessionStorage.getItem = key => key === 'fair.returnPath' ? destination : null;
                app.state.current.name = 'login'; app.state.params.showHome = false;
                app.listeners.$locationChangeSuccess(); await new Promise(resolve => setImmediate(resolve));
                assert.deepEqual(app.navigations, ['application.dashboard'], hostname + ': ' + role + ', destination=' + destination);
            }
        }
    }
});

test('a disabled-domain fair route is rejected before creating a post-login destination', () => {
    const h = setup(() => ({data: {}})), app = startApp(h, 'ieltsroom.com'), saved = {};
    h.token.removeToken(); h.context.window.location.pathname = '/hoi-cho';
    h.context.window.sessionStorage.setItem = (key, value) => {saved[key] = value;};
    let prevented = false;
    app.listeners.$stateChangeStart({preventDefault() {prevented = true;}}, {name: 'fair_admin_event', data: {fairPrivate: true}}, {id: 7});
    assert.equal(prevented, true); assert.equal(saved['fair.returnPath'], undefined); assert.deepEqual(app.navigations, ['login']);
});
