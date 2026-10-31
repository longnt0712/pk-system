// Real AngularJS session service, interceptors, app run block and login form.
// All HTTP responses and credentials below are synthetic; production is never contacted.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const inlineStyles = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const login = read('common/views/login/login.html'), shell = read('common/views/application.html');
const loginForm = login.slice(login.indexOf('<div class="alert alert-warning session-login-notice"'), login.indexOf('<!-- BEGIN ACTUAL CONTENT -->'));
const recovery = shell.slice(shell.indexOf('<div class="alert alert-warning session-recovery-notice"'), shell.indexOf('<!-- BEGIN ACTUAL CONTENT -->'));
const styles = ['external/bootstrap.min.css', 'components-md.min.css', 'layout-hoz.min.css', 'default.min.css', 'custom.css', 'ieltsroom-halloween.css', 'session-login-modal.css']
    .map(file => read('assets/css/' + file)).join('\n') + inlineStyles(read('index.html')) + inlineStyles(login);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
function contrast(a, b) {
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
let browser;
before(async () => { browser = await playwright.chromium.launch({headless: true, executablePath}); });
after(async () => { if (browser) await browser.close(); });

async function fixture(width, mode, dark = false) {
    const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const requests = [], errors = [];
    const server = {valid: false, mode};
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());});
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const json = (status, body) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
        if (url.pathname === '/dashboard') {
            return route.fulfill({contentType: 'text/html', body: '<!doctype html><html class="ieltsroom-halloween' + (dark ? ' global-dark-mode' : '') + '"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + styles +
                '</style><meta charset="utf-8"></head><body><div class="page-content"><div class="container"><section ng-if="$state.current.name !== \'login\'">' + recovery +
                '<p>Trang học tập</p></section><section ng-if="$state.current.name === \'login\'"><div ng-controller="LoginController as vm">' + loginForm + '</div></section></div></div></body></html>'});
        }
        if (url.pathname.startsWith('/service/')) requests.push({path: url.pathname, body: request.postData()});
        if (url.pathname === '/service/api/users/getCurrentUser') {
            return server.valid ? json(200, {id: 7, username: 'student.fixture', roles: [{name: 'ROLE_VIEWER'}]}) : json(401, {error: 'invalid_token'});
        }
        if (url.pathname === '/service/oauth/token') {
            const form = new URLSearchParams(request.postData());
            if (form.get('grant_type') === 'refresh_token' && server.mode === 'revoked') return json(400, {error: 'invalid_grant'});
            if (form.get('grant_type') === 'password' && form.get('password') === 'wrong-password') return json(400, {error: 'invalid_grant'});
            if (form.get('grant_type') === 'refresh_token' && server.mode === 'recoverable') server.valid = true;
            if (form.get('grant_type') === 'password') server.valid = true;
            return json(200, {access_token: 'fixture-fresh-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600});
        }
        if (url.pathname === '/service/oauth/revoke') return json(200, {});
        return route.fulfill({status: 200, body: ''});
    });
    await page.goto('https://ieltsroom.test/dashboard');
    for (const file of ['angular.min.js', 'angular-cookies.min.js', 'query-string.min.js', 'angular-oauth2.min.js', 'ui-bootstrap-tpls.min.js']) await page.addScriptTag({path: path.join(app, 'assets/scripts/external/' + file)});
    await page.evaluate(sources => {
        const names = [...sources.app.match(/angular\.module\('Hrm',\s*\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
        for (const name of names) {try {angular.module(name);} catch (ignore) {angular.module(name, []);}}
        (0, eval)(sources.app);
        (0, eval)(sources.services);
        const state = {current: {name: 'application.dashboard'}, params: {}, go(name) {this.current.name = name;}, reload() {window.recoveredReloads = (window.recoveredReloads || 0) + 1;}};
        Hrm.value('$state', state)
            .value('blockUI', {start() {}, stop() {}}).value('toastr', {warning() {}, info() {}, error() {}})
            .value('Idle', {}).value('Keepalive', {}).value('focus', function () {})
            .value('NetworkStatus', {start: () => () => {}, begin() {}, success() {}, failure() {}});
        // Run the exact production HTTP/OAuth configuration against Angular's
        // real provider. Replacing its interceptor array silently breaks $http.
        const originalConfig = Hrm.config;
        Hrm.config = function (definition) {
            if (['$httpProvider', '$provide', 'OAuthProvider'].includes(definition[0])) originalConfig.call(Hrm, definition);
            return Hrm;
        };
        (0, eval)(sources.configs);
        Hrm.config = originalConfig;
        (0, eval)(sources.modal);
        (0, eval)(sources.loginService);
        (0, eval)(sources.loginController);
        Hrm.run(['$rootScope', 'AuthSession', 'OAuthToken', (root, session, token) => {
            window.fixtureRoot = root;
            token.setToken({access_token: 'fixture-old-access', refresh_token: 'fixture-refresh', token_type: 'bearer'});
            session.saveUser({id: 7, username: 'student.fixture', roles: [{name: 'ROLE_VIEWER'}]});
            root.$evalAsync(() => root.$emit('$locationChangeSuccess'));
        }]);
        angular.bootstrap(document.body, ['Hrm']);
    }, {app: read('application.js'), services: read('application.services.js'), configs: read('application.configs.js'), modal: read('common/business/SessionLoginModal.js'), loginService: read('common/business/LoginService.js'), loginController: read('common/controllers/LoginController.js')});
    return {context, page, server, requests, errors};
}

test('a revoked old session automatically opens one modal and supports Enter on desktop and phone', async () => {
    for (const width of [390, 1366]) {
        const h = await fixture(width, 'revoked', width === 390);
        try {
            const notice = h.page.getByRole('dialog');
            await notice.waitFor({state: 'visible'}).catch(error => {throw Error(error.message + '\nBrowser errors: ' + h.errors.join('\n') + '\nRequests: ' + JSON.stringify(h.requests));});
            assert.equal(await h.page.getByLabel('Tên đăng nhập', {exact: true}).inputValue(), 'student.fixture');
            await h.page.getByLabel('Mật khẩu', {exact: true}).fill('fixture-password');
            const username = h.page.getByLabel('Tên đăng nhập', {exact: true});
            const css = await username.evaluate(node => {const style = getComputedStyle(node); return {color: style.color, background: style.backgroundColor, size: parseFloat(style.fontSize), width: node.getBoundingClientRect().width};});
            assert.notEqual(css.color, css.background);
            assert.ok(css.size >= 16 && css.width >= 200);
            for (const label of await notice.locator('label').all()) {
                const colors = await label.evaluate(node => {
                    let surface = node;
                    while (surface.parentElement && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
                    return {text: getComputedStyle(node).color, background: getComputedStyle(surface).backgroundColor};
                });
                assert.ok(contrast(colors.text, colors.background) >= 4.5, 'readable modal labels: ' + JSON.stringify(colors));
            }
            assert.ok(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            assert.equal(await h.page.locator('.session-login-modal-window').count(), 1);
            if (process.env.AUTH_RECOVERY_SCREENSHOT_DIR) await h.page.screenshot({path: path.join(process.env.AUTH_RECOVERY_SCREENSHOT_DIR, 'session-modal-' + width + '.png')});
            await h.page.getByLabel('Mật khẩu', {exact: true}).press('Enter');
            await notice.waitFor({state: 'detached'});
            assert.equal(h.requests.filter(item => item.body && item.body.includes('grant_type=password')).length, 1);
            assert.equal(await h.page.evaluate(() => fixtureRoot.currentUser.username), 'student.fixture');
            assert.deepEqual(h.errors, []);
        } finally { await h.context.close(); }
    }
});

test('bounded resource 401s open one modal without revoking the refresh grant', async () => {
    const h = await fixture(1366, 'bounded');
    try {
        const notice = h.page.getByRole('dialog');
        await notice.waitFor({state: 'visible'});
        assert.equal(h.requests.filter(item => item.path.endsWith('/oauth/revoke')).length, 0);
        assert.equal(h.requests.filter(item => item.path.endsWith('/oauth/token')).length, 2);
        await h.page.getByLabel('Mật khẩu', {exact: true}).fill('fixture-password');
        await h.page.getByRole('button', {name: 'Đăng nhập và tiếp tục', exact: true}).click();
        await notice.waitFor({state: 'detached'});
        assert.equal(await h.page.evaluate(() => recoveredReloads), 1);
        assert.deepEqual(h.errors, []);
    } finally { await h.context.close(); }
});

test('wrong password stays in one modal; explicitly leaving revokes only this browser grant', async () => {
    const h = await fixture(390, 'bounded');
    try {
        await h.page.getByRole('dialog').waitFor({state: 'visible'});
        await h.page.getByLabel('Mật khẩu', {exact: true}).fill('wrong-password');
        await h.page.getByRole('button', {name: 'Đăng nhập và tiếp tục', exact: true}).click();
        await h.page.getByRole('alert').filter({hasText: 'Tên đăng nhập hoặc mật khẩu không đúng'}).waitFor();
        assert.equal(await h.page.getByRole('dialog').count(), 1);
        await h.page.getByLabel('Mật khẩu', {exact: true}).fill('fixture-password');
        await h.page.getByRole('button', {name: 'Đăng nhập và tiếp tục', exact: true}).click();
        await h.page.getByRole('dialog').waitFor({state: 'detached'});
        await h.page.evaluate(() => fixtureRoot.$apply(() => angular.element(document.body).injector().get('AuthSession').reportUnverified()));
        await h.page.getByRole('dialog').waitFor({state: 'visible'});
        await h.page.getByRole('button', {name: 'Về trang đăng nhập', exact: true}).click();
        await h.page.getByRole('dialog').waitFor({state: 'detached'});
        assert.equal(h.requests.filter(item => item.path.endsWith('/oauth/revoke')).length, 1);
        assert.deepEqual(h.errors, []);
    } finally { await h.context.close(); }
});

test('the production interceptor refreshes an expired access token without displaying a modal', async () => {
    const h = await fixture(390, 'recoverable');
    try {
        await h.page.waitForFunction(() => fixtureRoot.currentUser && fixtureRoot.currentUser.username === 'student.fixture' && !fixtureRoot.sessionRecoveryChecking);
        assert.equal(h.requests.filter(item => item.path.endsWith('/oauth/token')).length, 1);
        assert.equal(await h.page.getByRole('dialog').count(), 0);
        assert.deepEqual(h.errors, []);
    } finally { await h.context.close(); }
});
