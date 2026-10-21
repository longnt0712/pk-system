const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8').replace(/\r\n/g, '\n');
const source = read('dashboards/controllers/DashboardController.js');
const html = read('dashboards/views/general-alt.html');
const plain = value => JSON.parse(JSON.stringify(value));
const angular = {isArray: Array.isArray, forEach: (items, callback) => (items || []).forEach(callback)};
const tick = async () => {for (let index = 0; index < 16; index++) {await Promise.resolve();}};

function method(name) {
    const declaration = 'vm.' + name + ' = function';
    const from = source.indexOf(declaration);
    assert.ok(from >= 0, 'Missing actual controller method: ' + declaration);
    const body = source.indexOf('{', from);
    let depth = 1;
    for (let end = body + 1; end < source.length; end++) {
        if (source[end] === '{') {depth++;}
        if (source[end] === '}' && --depth === 0) {return source.slice(from, end + 1) + ';';}
    }
    throw Error('Unclosed controller method: ' + declaration);
}

function fixture(extra = {}, names = ['groupAssignmentsByClass']) {
    const routes = [];
    const context = nodeVm.createContext({vm: {}, angular,
        $state: {go(name, params) {routes.push({name, params: plain(params)});}}, ...extra});
    for (const name of names) {nodeVm.runInContext(method(name), context);}
    return {context, vm: context.vm, routes};
}

function task(taskId, classId, className, extra = {}) {
    return {taskId, classId, className, activityType: 'OTHER', dueDate: '2026-10-24', ...extra};
}

test('class IDs take priority over names, equal numeric/string IDs group together, and group order follows the first task', () => {
    const h = fixture();
    const a1 = task(1, 17, ' Same class name '), b1 = task(2, 18, 'Same class name');
    const a2 = task(3, '17', 'Renamed class'), c1 = task(4, 19, 'Another class');
    const groups = h.vm.groupAssignmentsByClass([a1, b1, a2, c1]);
    assert.deepEqual(plain(groups.map(group => group.key)), ['class:17', 'class:18', 'class:19']);
    assert.equal(groups[0].classId, 17);
    assert.equal(groups[0].className, 'Same class name');
    assert.equal(groups[1].className, 'Same class name');
    assert.equal(groups[0].tasks[0], a1);
    assert.equal(groups[0].tasks[1], a2);
    assert.equal(groups[1].tasks[0], b1);
    assert.equal(groups[2].tasks[0], c1);
    assert.deepEqual(plain(groups.map(group => group.tasks.map(item => item.taskId))), [[1, 3], [2], [4]]);
});

test('legacy class names trim into stable fallback keys and unidentified classes stay visible in one separate group', () => {
    const h = fixture();
    const tasks = [task(1, null, ' Evening class '), task(2, undefined, 'Evening class'),
        task(3, null, ''), task(4, undefined, '  '), task(5, 31, ''), task(6, null, '31')];
    const groups = h.vm.groupAssignmentsByClass(tasks);
    assert.deepEqual(plain(groups.map(group => group.key)), ['name:Evening class', 'unknown', 'class:31', 'name:31']);
    assert.equal(groups[0].classId, null);
    assert.equal(groups[0].className, 'Evening class');
    assert.equal(groups[0].tasks.length, 2);
    assert.equal(groups[1].className, 'Chưa xác định lớp');
    assert.equal(groups[1].classId, null);
    assert.equal(groups[1].tasks.length, 2);
    assert.equal(groups[2].classId, 31);
    assert.equal(groups[2].className, 'Chưa xác định lớp');
    assert.equal(groups[3].className, '31');
    for (const input of [[], null, undefined]) {assert.equal(h.vm.groupAssignmentsByClass(input).length, 0);}
});

test('grouping is pure, keeps original references and does not reorder or collapse sibling vocabulary cards', () => {
    const h = fixture({}, ['groupAssignmentsByClass', 'assignmentKey', 'assignmentTopicComplete', 'openAssignedTask']);
    const siblings = [100, 200, 300].map((topicId, index) => Object.freeze(task(55, 17, 'Class A', {
        activityType: 'DAILY_VOCAB', topicId, categoryId: index + 1, taskTotalTopics: 3,
        taskCompletedTopics: 1, taskProgressPercent: 33, requiredAttempts: 1, completedAttempts: index === 0 ? 1 : 0
    })));
    const other = Object.freeze(task(66, 18, 'Class B'));
    const tasks = Object.freeze([siblings[0], other, siblings[1], siblings[2]]);
    const before = plain(tasks), groups = h.vm.groupAssignmentsByClass(tasks);
    assert.deepEqual(plain(tasks), before);
    assert.equal(groups.length, 2);
    assert.equal(groups.reduce((count, group) => count + group.tasks.length, 0), tasks.length);
    assert.equal(groups[0].tasks.length, 3);
    assert.equal(groups[1].tasks.length, 1);
    for (let index = 0; index < siblings.length; index++) {assert.equal(groups[0].tasks[index], siblings[index]);}
    assert.equal(new Set(groups[0].tasks.map(h.vm.assignmentKey)).size, 3);
    groups[0].tasks.forEach(item => h.vm.openAssignedTask(item));
    assert.equal(h.routes.length, 2, 'the completed child stays visible without being launched again');
    assert.deepEqual(h.routes.map(route => route.params.assignmentTopicId), [200, 300]);
    assert.deepEqual(h.routes.map(route => route.params.assignmentTaskId), [55, 55]);
    assert.deepEqual(h.routes.map(route => route.params.assignmentCategoryId), [2, 3]);
    assert.ok(h.routes.every(route => route.name === 'application.daily_vocab'));
});

function loadFixture() {
    const requests = [];
    const settings = {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}};
    const h = fixture({settings, $http: {get(url) {
        return new Promise((resolve, reject) => requests.push({url, resolve, reject}));
    }}}, ['groupAssignmentsByClass', 'loadAssignedTasks']);
    Object.assign(h.vm, {myUser: {id: 7}, isRoleView: true, isRoleUser: false, hasRole: () => false,
        assignedTasks: [], assignmentClassGroups: [], assignedTasksError: false});
    return {...h, requests, settings};
}

test('loading assignments builds class groups only from the same valid non-overdue rows and replaces prior groups on refresh', async () => {
    const h = loadFixture();
    assert.match(source, /vm\.assignmentClassGroups\s*=\s*\[\]\s*;/, 'the controller initializes empty class groups');
    h.vm.loadAssignedTasks();
    assert.equal(h.vm.assignedTasksLoading, true);
    assert.match(h.requests[0].url, /enrolment_class\/schedule\/my-assignments$/);
    const included = [task(1, 17, 'Class A'), task(2, 18, 'Class B'), task(3, '17', 'Class A')];
    h.requests[0].resolve({data: [included[0], null, task(9, 99, 'No deadline', {dueDate: null}),
        included[1], task(10, 99, 'Expired', {overdue: true}), included[2]]});
    await tick();
    assert.equal(h.vm.assignedTasksLoading, false);
    assert.equal(h.vm.assignedTasksError, false);
    assert.deepEqual(plain(h.vm.assignedTasks), included);
    assert.deepEqual(plain(h.vm.assignmentClassGroups.map(group => group.key)), ['class:17', 'class:18']);
    assert.deepEqual(plain(h.vm.assignmentClassGroups.map(group => group.tasks.map(item => item.taskId))), [[1, 3], [2]]);
    assert.equal(h.vm.assignmentClassGroups[0].tasks[0], h.vm.assignedTasks[0]);
    h.vm.loadAssignedTasks(); h.requests[1].resolve({data: [task(8, 20, 'New class')]}); await tick();
    assert.equal(h.vm.assignedTasks.length, 1);
    assert.deepEqual(plain(h.vm.assignmentClassGroups.map(group => group.key)), ['class:20']);
});

test('empty responses, invalid response data, HTTP failures and denied roles clear stale class sections', async () => {
    const h = loadFixture();
    function seed() {h.vm.assignedTasks = [task(1, 17, 'Old class')]; h.vm.assignmentClassGroups = h.vm.groupAssignmentsByClass(h.vm.assignedTasks);}
    for (const data of [[], null, {}]) {
        seed(); h.vm.loadAssignedTasks(); h.requests.at(-1).resolve({data}); await tick();
        assert.equal(h.vm.assignedTasks.length, 0);
        assert.equal(h.vm.assignmentClassGroups.length, 0);
        assert.equal(h.vm.assignedTasksLoading, false);
        assert.equal(h.vm.assignedTasksError, false);
    }
    seed(); h.vm.loadAssignedTasks(); h.requests.at(-1).reject(Error('offline')); await tick();
    assert.equal(h.vm.assignedTasks.length, 0);
    assert.equal(h.vm.assignmentClassGroups.length, 0);
    assert.equal(h.vm.assignedTasksError, true);
    assert.equal(h.vm.assignedTasksLoading, false);
    for (const deny of ['domain', 'user', 'roles']) {
        seed(); h.settings.ieltsRoom = deny !== 'domain'; h.vm.myUser.id = deny === 'user' ? null : 7;
        h.vm.isRoleView = deny !== 'roles';
        const before = h.requests.length; h.vm.loadAssignedTasks();
        assert.equal(h.requests.length, before, deny);
        assert.equal(h.vm.assignedTasks.length, 0, deny);
        assert.equal(h.vm.assignmentClassGroups.length, 0, deny);
    }
});

function boardNodes() {
    const from = html.indexOf('<section class="student-assignment-board"');
    const end = html.indexOf('</section>', from);
    assert.ok(from >= 0 && end > from, 'assignment board exists');
    const board = html.slice(from, end + '</section>'.length), nodes = [], stack = [];
    const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'area', 'base', 'embed', 'param', 'source', 'track']);
    for (const match of board.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b([^>]*?)>/gi)) {
        if (!match[1]) {continue;}
        const name = match[1].toLowerCase();
        if (match[0].startsWith('</')) {
            const opened = stack.pop(); assert.ok(opened, 'unexpected closing tag ' + name);
            assert.equal(opened.name, name, 'assignment template has balanced nested tags'); opened.end = match.index + match[0].length;
        } else {
            const attrs = Object.fromEntries([...match[2].matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)].map(item => [item[1], item[2]]));
            const node = {name, attrs, start: match.index, end: match.index + match[0].length, parent: stack.at(-1)};
            nodes.push(node); if (!voidTags.has(name) && !match[0].endsWith('/>')) {stack.push(node);}
        }
    }
    assert.equal(stack.length, 0, 'the complete assignment board remains inside its original section');
    return {board, nodes};
}

test('the real template nests class headings and original task cards with per-class and global card counts', () => {
    const {board, nodes} = boardNodes();
    const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
    const group = nodes.find(node => hasClass(node, 'student-assignment-class-section'));
    assert.ok(group, 'class section wrapper'); assert.equal(group.name, 'div', 'keep one outer section for existing consumers');
    assert.match(group.attrs['ng-repeat'], /^assignmentClass\s+in\s+vm\.assignmentClassGroups\s+track\s+by\s+assignmentClass\.key$/);
    const grid = nodes.find(node => hasClass(node, 'student-assignment-grid'));
    const card = nodes.find(node => hasClass(node, 'student-assignment-card'));
    function inside(node, ancestor) {for (let current = node.parent; current; current = current.parent) {if (current === ancestor) {return true;}} return false;}
    assert.ok(inside(grid, group)); assert.ok(inside(card, grid));
    assert.match(card.attrs['ng-repeat'], /^task\s+in\s+assignmentClass\.tasks\s+track\s+by\s+vm\.assignmentKey\(task\)$/);
    const section = board.slice(group.start, group.end);
    assert.match(section, /\{\{\s*assignmentClass\.className\s*\}\}/);
    assert.match(section, /\{\{\s*assignmentClass\.tasks\.length\s*\}\}\s*bài/);
    assert.match(board, /\{\{\s*vm\.assignedTasks\.length\s*\}\}\s*bài/);
    assert.match(section, /ng-click="vm\.openAssignedTask\(task\)"/);
    assert.match(section, /task\.taskProgressPercent/);
});
