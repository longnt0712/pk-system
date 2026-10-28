// Run from any directory: node <repo>/outputs/auth-review-2026-10-28/frontend-auth-probe.cjs
// Offline, read-only probes. Loads the application's actual factories/controller/library.
// All credentials/tokens below are synthetic. No HTTP requests are sent.
// Exit 0 confirms the observations below still reproduce; this is evidence, not a fix test.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '../..');
const appRoot = path.join(repoRoot, 'richy/app');

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

function setup() {
    const factories = {}, configs = [], cookies = {};
    const deps = {
        $q: {when: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise)},
        $rootScope: {$emit() {}},
        $cookies: {
            getObject(name) { return copy(cookies[name]); },
            putObject(name, value) { cookies[name] = copy(value); },
            remove(name) { delete cookies[name]; }
        },
        // Mock transport: logout resolves locally; no network connection is made.
        $http: {delete: async () => ({status: 200})}
    };
    const Hrm = {
        API_SERVER_URL: 'https://example.test/service/',
        API_CLIENT_ID: 'synthetic-client', API_CLIENT_KEY: 'synthetic-secret',
        constant(name, value) { deps[name] = value; },
        factory(name, definition) { factories[name] = definition; },
        filter() {}, config(definition) { configs.push(definition); }
    };
    const token = {
        getToken() { return deps.$cookies.getObject('token'); },
        getAccessToken() { return (this.getToken() || {}).access_token; },
        getRefreshToken() { return (this.getToken() || {}).refresh_token; },
        getAuthorizationHeader() {
            const value = this.getToken() || {}, type = value.token_type;
            return type && value.access_token
                ? type.charAt(0).toUpperCase() + type.slice(1) + ' ' + value.access_token
                : undefined;
        }
    };
    const angular = {
        copy, extend: Object.assign,
        isFunction: value => typeof value === 'function',
        isObject: value => value !== null && typeof value === 'object',
        forEach: (items, fn) => items.forEach(fn)
    };
    const context = vm.createContext({
        Hrm, angular, Date,
        window: {URL, location: {protocol: 'https:', href: 'https://example.test/'}}
    });
    for (const filename of ['application.services.js', 'application.configs.js']) {
        vm.runInContext(fs.readFileSync(path.join(appRoot, filename), 'utf8'), context, {filename});
    }
    invoke(configs.find(definition => definition[0] === '$provide'), {
        $provide: {
            decorator(name, definition) {
                deps[name] = invoke(definition, {...deps, $delegate: token});
            }
        }
    });
    deps.$injector = {get(name) { return deps[name]; }};
    deps.AuthSession = invoke(factories.AuthSession, deps);
    token.setToken({
        access_token: 'synthetic-A', refresh_token: 'synthetic-refresh-A',
        token_type: 'bearer', expires_in: 86400
    });
    return {deps, token, cookies, context};
}

async function lateCurrentUserResponse() {
    const h = setup(), lookup = deferred();
    let Controller;
    h.context.angular.module = () => ({controller(name, fn) { Controller = fn; }});
    vm.runInContext(
        fs.readFileSync(path.join(appRoot, 'common/controllers/LoginController.js'), 'utf8'),
        h.context, {filename: 'LoginController.js'}
    );
    const navigations = [];
    const controllerDeps = {
        ...h.deps,
        $scope: {$on() {}},
        $state: {go(name) { navigations.push(name); }},
        settings: {api: {baseUrl: 'https://example.test/service/'}},
        LoginService: {performLogin: async () => ({data: {access_token: 'synthetic-A'}})},
        toastr: {error() {}}, focus() {}, blockUI: {start() {}, stop() {}},
        $location: {protocol: () => 'https'},
        $window: {navigator: {onLine: true}},
        $document: {on() {}, off() {}},
        $http: {get: () => lookup.promise}
    };
    const controller = {};
    Controller.apply(controller, Controller.$inject.map(name => controllerDeps[name]));
    controller.user = {username: 'synthetic-user-A', password: 'synthetic-password'};
    const pending = controller.login();
    await new Promise(resolve => setImmediate(resolve));

    // Simulate a different tab changing the shared session while A's lookup is pending.
    h.token.setToken({
        access_token: 'synthetic-B', refresh_token: 'synthetic-refresh-B', token_type: 'bearer'
    });
    h.deps.AuthSession.saveUser({id: 'B', roles: []});
    lookup.resolve({data: {id: 'A', roles: [{name: 'ROLE_ADMIN'}]}});
    await pending;

    assert.equal(h.token.getAccessToken(), 'synthetic-B');
    assert.equal(h.cookies['education.user'].id, 'A');
    assert.equal(h.deps.$rootScope.currentUser.id, 'A');
    assert.equal(controllerDeps.settings.isAdmin, true);
    console.log(JSON.stringify({
        case: 'late-manual-login-user-response',
        accessToken: h.token.getAccessToken(),
        savedUser: h.cookies['education.user'],
        currentUser: h.deps.$rootScope.currentUser.id,
        isAdmin: controllerDeps.settings.isAdmin,
        navigations
    }));
}

async function logoutDuringPasswordLogin() {
    const h = setup(), loginResponse = deferred(), providers = {};
    const chain = {
        config() { return chain; }, factory() { return chain; },
        provider(name, constructor) { providers[name] = constructor; return chain; }
    };
    const angular = {
        module() { return chain; }, extend: Object.assign,
        forEach(values, fn) { values.forEach(fn); }
    };
    const librarySource = fs.readFileSync(
        path.join(appRoot, 'assets/scripts/external/angular-oauth2.min.js'), 'utf8'
    );
    // Evaluate the actual bundled UMD library in its browser branch.
    new Function('module', 'exports', 'define', librarySource).call({
        angular, queryString: {stringify: () => 'synthetic-request-body'}
    }, undefined, undefined, undefined);
    const provider = new providers.OAuth();
    provider.configure({
        baseUrl: 'https://example.test/service/', clientId: 'synthetic-client',
        grantPath: '/oauth/token', revokePath: '/oauth/logout'
    });
    const oauth = provider.$get({post: () => loginResponse.promise}, h.token);
    const pending = oauth.getAccessToken({username: 'synthetic-user-B', password: 'synthetic-password'});

    await h.deps.AuthSession.logout();
    assert.equal(h.token.getToken(), undefined, 'Local logout initially clears the token.');
    loginResponse.resolve({data: {
        access_token: 'synthetic-B', refresh_token: 'synthetic-refresh-B',
        token_type: 'bearer', expires_in: 86400
    }});
    await pending;

    assert.equal(h.token.getAccessToken(), 'synthetic-B');
    console.log(JSON.stringify({
        case: 'logout-during-password-login', tokenAfterLogout: h.token.getAccessToken()
    }));
}

(async () => {
    await lateCurrentUserResponse();
    await logoutDuringPasswordLogin();
    console.log('Both frontend lifecycle observations reproduced. No network calls or app changes.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
