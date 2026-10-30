const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const app = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(app, name), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
    let definition, nextTimer = 0, nextFrame = 0;
    const timers = new Map(), frames = new Map(), resizeObservers = [], opened = [];
    let document;
    class Node {
        constructor(name) {
            this.name = name; this.style = {setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] || ''; }};
            this.children = []; this.parentNode = null; this.listeners = new Map();
            this.classes = new Set(); this.classList = {add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name)};
            this.width = 300; this.height = 150; this.scrollHeight = options.textHeight || 300;
            this.bounds = {left: 40, top: 30, width: options.width || 794, height: 1123};
            this.clientWidth = options.width || 794; this.clientHeight = 600; this.scrollLeft = 0; this.scrollTop = 0;
        }
        appendChild(node) { if (node.parentNode) node.parentNode.removeChild(node); this.children.push(node); node.parentNode = this; return node; }
        removeChild(node) { const index = this.children.indexOf(node); if (index >= 0) this.children.splice(index, 1); node.parentNode = null; return node; }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
        removeEventListener(name, callback) { (this.listeners.get(name) || new Set()).delete(callback); }
        getBoundingClientRect() {
            const width = this.style.width ? parseFloat(this.style.width) : this.bounds.width;
            const height = this.style.height && this.style.height !== '0px' ? parseFloat(this.style.height) : this.bounds.height;
            let left = this.bounds.left, top = this.bounds.top;
            if (this.name === 'frame') { left = scroller.bounds.left - scroller.scrollLeft; top = scroller.bounds.top - scroller.scrollTop; }
            if (this.name === 'paper') { const bounds = frame.getBoundingClientRect(); left = bounds.left + Math.max(0, (bounds.width - width) / 2); top = bounds.top; }
            if (this.name === 'canvas' || this.name === 'textarea') { const bounds = paper.getBoundingClientRect(); left = bounds.left; top = bounds.top; }
            return {...this.bounds, left, top, width, height, right: left + width, bottom: top + height};
        }
        getClientRects() { return [this.getBoundingClientRect()]; }
        focus() { document.activeElement = this; }
        querySelector(selector) { return this.selectors && this.selectors[selector] || null; }
        querySelectorAll() { return this.controls || []; }
        fire(name, values = {}) {
            const event = {target: this, pointerId: 1, pointerType: 'pen', clientX: 140, clientY: 130, pressure: .5, button: 0,
                prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...values};
            for (const callback of [...(this.listeners.get(name) || [])]) callback(event);
            return event;
        }
    }
    const host = new Node('host'), button = new Node('button'), overlay = new Node('overlay'), dialog = new Node('dialog');
    const paper = new Node('paper'), textarea = new Node('textarea'), canvas = new Node('canvas'), close = new Node('close');
    const scroller = new Node('scroller'), frame = new Node('frame');
    host.selectors = {'.study-notebook-toggle': button, '.study-notebook-overlay': overlay, '.study-notebook-dialog': dialog,
        '.study-notebook-paper': paper, '.study-notebook-text': textarea, '.study-notebook-canvas': canvas,
        '.study-notebook-scroll': scroller, '.study-notebook-page-frame': frame};
    dialog.selectors = {'.study-notebook-close': close}; dialog.controls = [close, textarea];
    host.appendChild(button); host.appendChild(overlay); overlay.appendChild(dialog); dialog.appendChild(close); dialog.appendChild(scroller);
    scroller.appendChild(frame); frame.appendChild(paper);
    paper.appendChild(textarea); paper.appendChild(canvas);
    document = new Node('document'); document.body = new Node('body'); document.documentElement = new Node('html');
    document.documentElement.appendChild(document.body); document.body.appendChild(host); document.activeElement = button;
    const drawCalls = [];
    function createContext(label) {
        const value = {};
        for (const name of ['setTransform', 'clearRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'drawImage']) value[name] = (...args) => drawCalls.push({name, args, context: label});
        value.measureText = text => ({width: String(text).length * 8, actualBoundingBoxAscent: 15, actualBoundingBoxDescent: 4});
        return value;
    }
    const context = createContext('main');
    canvas.getContext = () => context;
    document.createElement = name => { const node = new Node(name), offscreen = createContext('offscreen'); node.getContext = () => offscreen; return node; };
    const captures = new Set(); canvas.setPointerCapture = id => captures.add(id); canvas.hasPointerCapture = id => captures.has(id); canvas.releasePointerCapture = id => captures.delete(id);
    function timeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; }
    timeout.cancel = id => timers.delete(id);
    const window = new Node('window'); window.document = document; window.devicePixelRatio = options.dpr || 1; window.innerHeight = 900;
    window.getComputedStyle = node => ({paddingLeft: '0px', paddingRight: '0px', fontFamily: 'Arial',
        fontSize: node.style.fontSize || '17px', lineHeight: node.style.lineHeight || '28px'});
    Object.defineProperty(scroller, 'scrollWidth', {get() { return Math.max(scroller.clientWidth, parseFloat(frame.style.width) || 0); }});
    Object.defineProperty(scroller, 'scrollHeight', {get() { return Math.max(scroller.clientHeight, parseFloat(frame.style.height) || 0); }});
    window.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
    window.cancelAnimationFrame = id => frames.delete(id);
    window.setTimeout = timeout; window.clearTimeout = timeout.cancel;
    window.ResizeObserver = class {
        constructor(callback) { this.callback = callback; this.targets = new Set(); resizeObservers.push(this); }
        observe(target) { this.targets.add(target); }
        disconnect() { this.targets.clear(); }
    };
    const handlers = new Map(), watchers = [];
    const scope = {
        $evalAsync(callback) { if (callback) callback(); },
        $on(name, callback) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); return () => handlers.get(name).delete(callback); },
        $watchGroup(names, callback) { const watcher = {kind: 'identity', callback, last: null}; watchers.push(watcher); return () => watcher.disabled = true; },
        $watchCollection(expression, callback) { const watcher = {kind: 'collection', expression, callback, last: null}; watchers.push(watcher); return () => watcher.disabled = true; },
        $watch(expression, callback) { const watcher = {kind: 'value', expression, callback, last: null}; watchers.push(watcher); return () => watcher.disabled = true; },
        digest() {
            for (const watcher of watchers) {
                if (watcher.disabled) continue;
                const value = watcher.kind === 'identity' ? [ui.userId, ui.testMode, ui.testId, !!ui.enabled, ui.sessionKey || ''].join(':') : watcher.expression();
                if (value !== watcher.last) { watcher.last = value; watcher.callback(value); }
            }
            if (ui.session && textModel.$modelValue !== ui.session.document.text) {
                textModel.$modelValue = ui.session.document.text; textarea.value = ui.session.document.text;
            }
        },
        destroy() { for (const callback of handlers.get('$destroy') || []) callback(); }
    };
    const sessions = [];
    const store = {open(identity) {
        opened.push(clone(identity));
        const session = {document: {text: '', orientation: 'portrait', pattern: 'lined', strokes: [], ...clone(options.document || {})},
            status: options.status || 'local', error: '', changedCalls: 0, saved: [], destroyed: 0, refreshed: 0,
            changed() { this.changedCalls++; }, save() { this.saved.push(clone(this.document)); return Promise.resolve(this); },
            refresh() { this.refreshed++; return Promise.resolve(this); },
            keepLocal() { this.status = 'saved'; return Promise.resolve(this); }, useRemote() { this.status = 'saved'; return Promise.resolve(this); },
            destroy() { this.destroyed++; }};
        session.ready = Promise.resolve(session); sessions.push(session); return session;
    }};
    const textModel = {$modelValue: '',
        $setViewValue(value) { this.$modelValue = value; ui.session.document.text = value; textarea.value = value; }, $commitViewValue() {}};
    const angular = {module() { return {directive(name, value) { assert.equal(name, 'studyNotebook'); definition = value; }}; },
        element(node) { assert.equal(node, textarea); return {controller: () => textModel}; }, noop() {}};
    nodeVm.runInNewContext(read('common/utils/study-notebook.directive.js'), {angular, Date, Math, console});
    const dependencies = {$window: window, $timeout: timeout, $injector: {get(name) { assert.equal(name, 'StudyNotebookStore'); return store; }}};
    const directive = definition.at(-1)(...definition.slice(0, -1).map(name => dependencies[name]));
    const ui = {enabled: true, userId: 7, testId: 42, testMode: 'READING', ...(options.identity || {})};
    textarea.value = '';
    directive.link(scope, [host], {}, ui); scope.digest();
    async function flush() {
        await tick();
        for (let count = 0; count < 20; count++) {
            scope.digest();
            const batch = [...timers.values()]; timers.clear(); batch.forEach(callback => callback());
            const frameBatch = [...frames.values()]; frames.clear(); frameBatch.forEach(callback => callback());
            await tick(); if (!timers.size && !frames.size) return;
        }
        throw new Error('Notebook layout did not settle');
    }
    return {ui, scope, document, window, host, button, overlay, dialog, paper, textarea, canvas, scroller, frame, captures, context, drawCalls,
        opened, sessions, directive, flush, timers, frames, resizeObservers, textModel,
        async open() { ui.toggle(); await flush(); return ui.session; },
        pointer(name, values) { return canvas.fire(name, values); }};
}

test('the icon opens the notebook lazily, lights only while open, and saves when toggled closed', async () => {
    const h = harness(); assert.equal(h.opened.length, 0); assert.equal(h.ui.isOpen, false);
    assert.match(h.directive.template, /ng-class="\{\\?'is-active\\?':notebook\.isOpen\}"/);
    const session = await h.open(); assert.equal(h.opened.length, 1); assert.equal(h.ui.isOpen, true);
    assert.ok(h.document.body.classList.contains('study-notebook-open')); assert.equal(h.overlay.parentNode, h.document.body);
    session.document.text = 'My note'; h.ui.changed(); h.ui.toggle();
    assert.equal(h.ui.isOpen, false); assert.ok(!h.document.body.classList.contains('study-notebook-open'));
    assert.equal(session.saved.at(-1).text, 'My note'); await h.open(); assert.equal(h.opened.length, 1);
});

test('a Speaking adapter auto-opens the same A4 modal and pauses incoming sync during pen and IME input', async () => {
    const visible = [], interactions = [], closed = [];
    const session = {document: {text: '', orientation: 'portrait', pattern: 'grid', strokes: []}, status: 'ready',
        ready: Promise.resolve(), changed() {}, save() { return Promise.resolve(this); }, destroy() {},
        setVisible(value) { visible.push(value); }, setInteraction(value, kind) { interactions.push([value,kind]); }};
    const h = harness({identity: {testMode: 'SPEAKING', sessionKey: 'set:student:question', autoOpen: true, hideSave: true,
        sessionOpener: () => session, onClose: () => closed.push(true)}});
    await h.flush(); assert.equal(h.ui.isOpen,true); assert.equal(h.opened.length,0); assert.equal(h.ui.session,session);
    assert.match(h.directive.template,/ng-if="!notebook.hideSave"/); assert.equal(visible[0],true);
    h.ui.setTool('pen'); h.pointer('pointerdown'); h.pointer('pointerup');
    h.textarea.fire('compositionstart'); h.textarea.value = 'Nội dung dùng bộ gõ'; h.textarea.fire('compositionend');
    assert.deepEqual(interactions,[[true,'pen'],[false,'pen'],[true,'text'],[false,'text']]);
    assert.equal(session.document.text,'Nội dung dùng bộ gõ'); assert.equal(session.document.strokes.length,1);
    h.ui.close(); assert.equal(visible.at(-1),false); assert.equal(closed.length,1);
});

test('disabled or missing test identities cannot open a notebook and loading/conflict states lock edits', async () => {
    for (const identity of [{enabled: false}, {testId: 0}, {testId: null}, {userId: 0}]) {
        const h = harness({identity}); h.ui.toggle(); await h.flush(); assert.equal(h.ui.isOpen, false); assert.equal(h.opened.length, 0);
    }
    for (const status of ['loading', 'conflict']) {
        const h = harness({status}), session = await h.open(); h.ui.setTool('pen');
        h.pointer('pointerdown'); h.pointer('pointerup'); h.ui.save(); h.ui.changed();
        assert.equal(session.document.strokes.length, 0); assert.equal(session.changedCalls, 0); assert.equal(session.saved.length, 0);
        assert.ok(h.ui.statusText());
    }
});

test('pen pressure and coalesced points are persisted in page coordinates rather than screen pixels', async () => {
    const h = harness({width: 397}); const session = await h.open(); h.ui.setTool('pen');
    h.pointer('pointerdown', {clientX: 90, clientY: 80, pressure: .2});
    h.pointer('pointermove', {getCoalescedEvents: () => [{pointerType: 'pen', clientX: 140, clientY: 130, pressure: .7}]});
    h.pointer('pointerup', {clientX: 190, clientY: 180, pressure: .9}); await h.flush();
    assert.equal(session.document.strokes.length, 1); const stroke = session.document.strokes[0];
    assert.equal(stroke.tool, 'pen'); assert.equal(stroke.width, 4); assert.equal(stroke.color, '#315bbe');
    assert.deepEqual(clone(stroke.points), [[100, 100, .2], [200, 200, .7], [300, 300, .9]]);
    assert.equal(session.changedCalls, 1); assert.equal(h.captures.size, 0);
});

test('touch drawing is opt-in and a second pointer cannot alter the active pen stroke', async () => {
    const h = harness(), session = await h.open(); h.ui.setTool('pen');
    h.pointer('pointerdown', {pointerType: 'touch'}); h.pointer('pointerup', {pointerType: 'touch'});
    assert.equal(session.document.strokes.length, 0);
    h.pointer('pointerdown', {pointerId: 1, clientX: 140, clientY: 130});
    h.pointer('pointerdown', {pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 700});
    h.pointer('pointermove', {pointerId: 2, pointerType: 'touch', clientX: 750, clientY: 750});
    h.pointer('pointerup', {pointerId: 1, clientX: 240, clientY: 230});
    assert.equal(session.document.strokes.length, 1); assert.equal(session.document.strokes[0].points.length, 2);
    h.ui.touchDrawing = true;
    h.pointer('pointerdown', {pointerType: 'touch'}); h.pointer('pointerup', {pointerType: 'touch', clientX: 250});
    assert.equal(session.document.strokes.length, 2);
});

test('eraser removes a hit stroke as a whole and undo/redo persist the previous geometry', async () => {
    const strokes = [{id: 'near', tool: 'pen', color: '#123456', width: 4, points: [[100, 100, .5], [200, 100, .5]]},
        {id: 'far', tool: 'pen', color: '#123456', width: 4, points: [[500, 400, .5], [600, 400, .5]]}];
    const h = harness({document: {strokes}}), session = await h.open(); h.ui.setTool('eraser');
    h.pointer('pointerdown', {clientX: 190, clientY: 130}); h.pointer('pointerup', {clientX: 190, clientY: 130});
    assert.deepEqual(session.document.strokes.map(item => item.id), ['far']); assert.equal(h.ui.canUndo(), true);
    h.ui.undo(); assert.deepEqual(clone(session.document.strokes), strokes); assert.equal(h.ui.canRedo(), true);
    h.ui.redo(); assert.deepEqual(session.document.strokes.map(item => item.id), ['far']); assert.equal(session.changedCalls, 3);
});

test('changing A4 orientation or paper lines keeps stored strokes at their original page coordinates', async () => {
    const h = harness(), session = await h.open(); h.ui.setTool('pen');
    h.pointer('pointerdown'); h.pointer('pointerup', {clientX: 240}); const before = clone(session.document.strokes);
    session.document.orientation = 'landscape'; session.document.pattern = 'squares'; h.ui.changed(); await h.flush();
    assert.deepEqual(clone(session.document.strokes), before); assert.ok(h.paper.getBoundingClientRect().width <= h.scroller.clientWidth);
    h.ui.save(); assert.equal(session.saved.at(-1).orientation, 'landscape'); assert.equal(session.saved.at(-1).pattern, 'squares');
});

test('closing or destroying the notebook commits an unfinished stroke before saving and releases pointer capture', async () => {
    for (const action of ['close', 'destroy']) {
        const h = harness(), session = await h.open(); h.ui.setTool('highlighter');
        h.pointer('pointerdown'); h.pointer('pointermove', {clientX: 240, clientY: 230});
        if (action === 'close') h.ui.close(); else h.scope.destroy();
        assert.equal(session.document.strokes.length, 1); assert.equal(session.document.strokes[0].tool, 'highlighter');
        assert.equal(session.document.strokes[0].width, 16); assert.equal(session.saved.at(-1).strokes.length, 1); assert.equal(h.captures.size, 0);
        if (action === 'destroy') {
            assert.equal(session.destroyed, 1); assert.equal(h.overlay.parentNode, null); assert.equal(h.timers.size + h.frames.size, 0);
            assert.ok(h.resizeObservers.every(observer => observer.targets.size === 0));
            for (const set of h.canvas.listeners.values()) assert.equal(set.size, 0);
        }
    }
});

test('very long notes use a bounded canvas backing surface without truncating the page or its text', async () => {
    const h = harness({textHeight: 80000, dpr: 3}), session = await h.open();
    session.document.text = 'A long note'; h.ui.changed(); await h.flush();
    assert.ok(h.canvas.width * h.canvas.height <= 4000000, 'Canvas pixels must stay below the memory budget');
    assert.ok(h.canvas.width <= 8192 && h.canvas.height <= 8192, 'Canvas edges must remain supported on mobile devices');
    assert.ok(parseFloat(h.canvas.style.height) >= 80000); assert.equal(session.document.text, 'A long note');
});

test('switching student, mode, test or enabled state closes and releases the previous notebook before reuse', async () => {
    const h = harness(), first = await h.open(); first.document.text = 'Old student note'; h.ui.changed();
    h.ui.testId = 99; h.scope.digest();
    assert.equal(h.ui.isOpen, false); assert.equal(h.ui.session, null); assert.equal(first.destroyed, 1);
    assert.equal(first.saved.at(-1).text, 'Old student note');
    const next = await h.open(); assert.equal(h.opened.at(-1).testId, 99); assert.equal(next.document.text, '');
    h.ui.enabled = false; h.scope.digest(); assert.equal(h.ui.isOpen, false); assert.equal(next.destroyed, 1); assert.equal(h.ui.canOpen(), false);
});

test('Escape and Ctrl+S work inside the notebook while modal key events cannot reach exam shortcuts', async () => {
    const h = harness(), session = await h.open(); session.document.text = 'Keyboard save'; h.ui.changed();
    const save = h.overlay.fire('keydown', {key: 's', ctrlKey: true});
    assert.equal(save.prevented, true); assert.equal(save.stopped, true); assert.equal(session.saved.at(-1).text, 'Keyboard save');
    const escape = h.overlay.fire('keydown', {key: 'Escape'}); assert.equal(escape.prevented, true); assert.equal(h.ui.isOpen, false);
});

test('saving and closing capture pending composed text while an external model replacement cannot receive stale textarea text', async () => {
    for (const action of ['save', 'close']) {
        const h = harness({document: {text: 'Before composition'}}), session = await h.open();
        h.textarea.value = 'Ghi chú tiếng Việt vừa gõ';
        assert.equal(session.document.text, 'Before composition'); h.ui[action]();
        assert.equal(session.document.text, 'Ghi chú tiếng Việt vừa gõ'); assert.equal(session.saved.at(-1).text, 'Ghi chú tiếng Việt vừa gõ');
    }
    const h = harness({document: {text: 'Before remote update'}}), session = await h.open();
    session.document.text = 'Newly loaded cloud content'; h.textarea.value = 'Stale text from the previous model';
    h.ui.save();
    assert.equal(session.document.text, 'Newly loaded cloud content'); assert.equal(session.saved.at(-1).text, 'Newly loaded cloud content');
});

test('a long continuous pen stroke remains bounded while preserving its beginning and final location', async () => {
    const h = harness(), session = await h.open(); h.ui.setTool('pen');
    h.pointer('pointerdown', {clientX: 40, clientY: 30});
    for (let index = 1; index <= 6000; index++) {
        h.pointer('pointermove', {clientX: 40 + index % 700, clientY: 30 + Math.floor(index / 700) * 20});
    }
    h.pointer('pointerup', {clientX: 440, clientY: 190});
    const points = session.document.strokes[0].points;
    assert.ok(points.length <= 2500); assert.deepEqual(clone(points[0]), [0, 0, .5]);
    assert.deepEqual(clone(points.at(-1)), [400, 160, .5]);
});

test('responsive A4 layout scales text, padding and paper lines by the same factor as handwriting', async () => {
    const strokes = [{id: 'anchor', tool: 'pen', color: '#315bbe', width: 4, points: [[100, 100, .5], [200, 100, .5]]}];
    const h = harness({width: 794, document: {text: 'The same anchored note', strokes}}), session = await h.open();
    assert.equal(parseFloat(h.textarea.style.fontSize), 17); assert.equal(parseFloat(h.textarea.style.lineHeight), 28);
    assert.equal(parseFloat(h.textarea.style.padding), 40); assert.equal(parseFloat(h.paper.style['--notebook-line-step']), 28);
    assert.equal(parseFloat(h.paper.style['--notebook-grid-step']), 20); assert.equal(parseFloat(h.paper.style['--notebook-square-step']), 64);
    h.paper.bounds.width = 397; h.scroller.clientWidth = 397; h.window.fire('resize'); await h.flush();
    assert.equal(parseFloat(h.textarea.style.fontSize), 8.5); assert.equal(parseFloat(h.textarea.style.lineHeight), 14);
    assert.equal(parseFloat(h.textarea.style.padding), 20); assert.equal(parseFloat(h.paper.style['--notebook-line-step']), 14);
    assert.equal(parseFloat(h.paper.style['--notebook-grid-step']), 10); assert.equal(parseFloat(h.paper.style['--notebook-square-step']), 32);
    assert.deepEqual(clone(session.document.strokes), strokes); assert.equal(session.document.text, 'The same anchored note');
});

test('an open notebook prevents background pointer activation and keeps keyboard focus inside its dialog', async () => {
    const h = harness(); await h.open(); const background = h.document.createElement('button'); h.document.body.appendChild(background);
    const blocked = h.document.fire('pointerdown', {target: background});
    assert.equal(blocked.prevented, true); assert.equal(blocked.stopped, true);
    background.focus(); h.document.fire('focusin', {target: background});
    assert.ok(h.dialog.contains(h.document.activeElement));
    const icon = h.document.fire('pointerdown', {target: h.button}); assert.equal(icon.prevented, false);
    h.ui.close(); const allowed = h.document.fire('pointerdown', {target: background}); assert.equal(allowed.prevented, false);
});

test('a pen stroke already in progress is committed when loading or conflict arrives before pointer-up', async () => {
    for (const status of ['loading', 'conflict']) {
        const h = harness(), session = await h.open(); h.ui.setTool('pen');
        h.pointer('pointerdown', {clientX: 140, clientY: 130}); session.status = status;
        h.pointer('pointerup', {clientX: 240, clientY: 230});
        assert.equal(session.document.strokes.length, 1, status); assert.equal(session.changedCalls, 1, status);
        assert.deepEqual(clone(session.document.strokes[0].points), [[100, 100, .5], [200, 200, .5]]);
        h.pointer('pointerdown', {clientX: 340, clientY: 330}); h.pointer('pointerup', {clientX: 440, clientY: 430});
        assert.equal(session.document.strokes.length, 1, 'A new stroke remains blocked while the notebook is locked');
    }
});

test('explicit conflict resolution commits the current gesture before choosing which notebook version to keep', async () => {
    for (const method of ['keepLocal', 'useRemote']) {
        const h = harness(), session = await h.open(); h.ui.setTool('pen');
        let snapshot;
        session[method] = function () { snapshot = clone(this.document); return Promise.resolve(this); };
        h.pointer('pointerdown'); h.pointer('pointermove', {clientX: 240}); session.status = 'conflict';
        h.ui.resolve(method);
        assert.equal(snapshot.strokes.length, 1, method); assert.equal(session.changedCalls, 1, method);
        assert.equal(h.captures.size, 0);
    }
});

test('closing during a loading or conflict transition preserves pending DOM composition in the local document', async () => {
    for (const status of ['loading', 'conflict']) {
        const h = harness({document: {text: 'Before pending input'}}), session = await h.open();
        h.textarea.value = 'Nội dung vừa gõ khi đồng bộ nền'; session.status = status; h.ui.close();
        assert.equal(session.document.text, 'Nội dung vừa gõ khi đồng bộ nền', status); assert.equal(session.changedCalls, 1, status);
        assert.equal(h.ui.isOpen, false);
    }
});

test('ordinary text changes reuse the committed ink cache until stroke geometry or canvas dimensions change', async () => {
    const strokes = [{id: 'cached', tool: 'pen', color: '#315bbe', width: 4, points: [[100, 100, .5], [200, 100, .5]]}];
    const h = harness({document: {strokes}}), session = await h.open();
    const cachePaints = () => h.drawCalls.filter(call => call.context === 'offscreen' && call.name === 'stroke').length;
    const painted = cachePaints(); assert.ok(painted > 0);
    session.document.text = 'Typing while the same handwriting remains'; h.ui.changed(); await h.flush();
    assert.equal(cachePaints(), painted, 'Typing must not redraw every stored pen segment');
    h.ui.setTool('pen'); h.pointer('pointerdown'); h.pointer('pointerup', {clientX: 240}); await h.flush();
    assert.ok(cachePaints() > painted, 'A newly committed stroke invalidates the cached ink');
});

test('zoom buttons respect their bounds, fit resets the view, and the page frame exposes horizontal overflow only when required', async () => {
    const h = harness({width: 397}), session = await h.open(); session.document.text = 'The same note while zooming';
    assert.equal(h.ui.zoomPercent, 100);
    assert.equal(h.ui.zoomSliderValue, 100);
    for (let index = 0; index < 10; index++) h.ui.zoomIn(); await h.flush();
    assert.equal(h.ui.zoomPercent, 200); assert.equal(parseFloat(h.paper.style.width), 794);
    assert.equal(h.ui.zoomSliderValue, 200);
    assert.equal(parseFloat(h.frame.style.width), 794); assert.ok(h.scroller.scrollWidth > h.scroller.clientWidth);
    assert.ok(parseFloat(h.frame.style.height) >= parseFloat(h.canvas.style.height));
    for (let index = 0; index < 10; index++) h.ui.zoomOut(); await h.flush();
    assert.equal(h.ui.zoomPercent, 50); assert.equal(parseFloat(h.paper.style.width), 198.5);
    assert.equal(h.ui.zoomSliderValue, 50);
    assert.equal(parseFloat(h.frame.style.width), 397);
    // Angular 1.5 treats native range inputs as text: ngModel changes before ng-change runs.
    h.ui.zoomSliderValue = '135'; h.ui.setZoom(h.ui.zoomSliderValue); await h.flush();
    assert.equal(h.ui.zoomPercent, 135); assert.equal(h.ui.zoomSliderValue, 135);
    assert.ok(Math.abs(parseFloat(h.paper.style.width) - 535.95) < 0.001);
    h.ui.fitZoom(); await h.flush();
    assert.equal(h.ui.zoomPercent, 100); assert.equal(parseFloat(h.paper.style.width), 397);
    assert.equal(h.ui.zoomSliderValue, 100);
    assert.equal(h.scroller.scrollWidth, h.scroller.clientWidth); assert.equal(session.document.text, 'The same note while zooming');
});

test('zoom scales text, paper grids and pointer projection together while every saved stroke stays in canonical page coordinates', async () => {
    const existing = [{id: 'existing', tool: 'pen', color: '#315bbe', width: 4, points: [[100, 120, .4], [200, 140, .8]]}];
    const h = harness({document: {text: 'Anchored annotations', strokes: existing}}), session = await h.open();
    h.ui.setZoom(150); await h.flush();
    assert.equal(parseFloat(h.textarea.style.fontSize), 25.5); assert.equal(parseFloat(h.textarea.style.lineHeight), 42);
    assert.equal(parseFloat(h.textarea.style.padding), 60); assert.equal(parseFloat(h.paper.style['--notebook-line-step']), 42);
    assert.equal(parseFloat(h.paper.style['--notebook-grid-step']), 30); assert.equal(parseFloat(h.paper.style['--notebook-square-step']), 96);
    h.ui.setTool('pen'); let box = h.canvas.getBoundingClientRect();
    h.pointer('pointerdown', {clientX: box.left + 400 * 1.5, clientY: box.top + 300 * 1.5});
    h.pointer('pointerup', {clientX: box.left + 450 * 1.5, clientY: box.top + 350 * 1.5});
    assert.deepEqual(clone(session.document.strokes[1].points), [[400, 300, .5], [450, 350, .5]]);
    h.ui.setZoom(50); await h.flush(); box = h.canvas.getBoundingClientRect();
    assert.equal(parseFloat(h.textarea.style.fontSize), 8.5); assert.equal(parseFloat(h.paper.style['--notebook-grid-step']), 10);
    h.pointer('pointerdown', {clientX: box.left + 400 * .5, clientY: box.top + 500 * .5});
    h.pointer('pointerup', {clientX: box.left + 450 * .5, clientY: box.top + 550 * .5});
    assert.deepEqual(clone(session.document.strokes[2].points), [[400, 500, .5], [450, 550, .5]]);
    assert.deepEqual(clone(session.document.strokes[0]), existing[0]); assert.equal(session.document.text, 'Anchored annotations');
    h.ui.fitZoom(); await h.flush(); h.ui.save();
    assert.deepEqual(clone(session.saved.at(-1).strokes), clone(session.document.strokes));
});

test('changing zoom commits an active gesture before its drawing scale changes', async () => {
    const h = harness(), session = await h.open(); h.ui.setTool('pen');
    h.pointer('pointerdown', {clientX: 440, clientY: 330}); h.pointer('pointermove', {clientX: 490, clientY: 380});
    h.ui.zoomIn(); await h.flush();
    assert.equal(h.ui.zoomPercent, 125); assert.equal(h.captures.size, 0); assert.equal(session.changedCalls, 1);
    assert.deepEqual(clone(session.document.strokes[0].points), [[400, 300, .5], [450, 350, .5]]);
    assert.equal(session.document.orientation, 'portrait');
});

test('text baselines align with unchanged paper rules at mobile widths and every supported zoom', async () => {
    const existing = [{id: 'anchored-ink', tool: 'pen', color: '#315bbe', width: 4, points: [[100, 100, .5], [200, 100, .5]]}];
    const h = harness({width: 397, document: {text: 'Words written on the ruled paper', strokes: existing}}), session = await h.open();
    for (const [pattern, canonicalStep, variable] of [['lined', 28, '--notebook-line-step'], ['grid', 20, '--notebook-grid-step'], ['squares', 64, '--notebook-square-step']]) {
        session.document.pattern = pattern; h.ui.changed(); await h.flush();
        for (const zoom of [50, 100, 150, 200]) {
            h.ui.setZoom(zoom); await h.flush();
            const scale = h.paper.getBoundingClientRect().width / 794, step = parseFloat(h.paper.style[variable]);
            const baselineWithinLine = ((canonicalStep - 15 - 4) / 2 + 15) * scale;
            const firstBaseline = parseFloat(h.textarea.style.paddingTop) + baselineWithinLine;
            const nextBaseline = firstBaseline + parseFloat(h.textarea.style.lineHeight);
            assert.ok(Math.abs(firstBaseline / step - Math.round(firstBaseline / step)) < 1e-8, pattern + ' first baseline at ' + zoom);
            assert.ok(Math.abs(nextBaseline / step - Math.round(nextBaseline / step)) < 1e-8, pattern + ' next baseline at ' + zoom);
            assert.equal(h.paper.style['--notebook-rule-offset-y'], '0px', 'The stored handwriting must not see a shifted paper grid');
            assert.deepEqual(clone(session.document.strokes), existing);
        }
    }
});

test('the shared Study header mounts the notebook between the logo and title and loads versioned notebook assets', () => {
    const header = read('question/views/ielts_reading_actual_test_idp.html');
    const logo = header.indexOf('idp-ieltsroom-logo'), notebook = header.indexOf('<study-notebook'), title = header.indexOf('idp-exam-test-context');
    assert.ok(logo >= 0 && notebook > logo && title > notebook);
    const markup = header.slice(notebook, header.indexOf('</study-notebook>', notebook));
    assert.match(markup, /ng-if="vm\.isStudyMode\(\) && !vm\.isPreviewMode"/);
    for (const mode of ['READING', 'LISTENING', 'WRITING', 'COMPREHENSIVE']) assert.ok(markup.includes(mode));
    const index = read('index.html');
    for (const script of ['common/utils/study-notebook-store.js', 'common/utils/study-notebook.directive.js']) {
        assert.match(index, new RegExp("writeVersionedScript\\('" + script.replace(/\./g, '\\.') + "(?:\\?[^']*)?'\\)"));
    }
    assert.match(index, /writeVersionedStylesheet\('assets\/css\/study-notebook\.css(?:\?[^']*)?'\)/);
    const css = read('assets/css/study-notebook.css'); assert.match(css, /\.study-notebook-toggle\.is-active\s*\{/);
    assert.ok(read('common/utils/study-notebook.directive.js').includes('value="sketch"'), 'Sketch paper can be selected in the notebook toolbar');
    const routes = read('question/question.module.js');
    for (const mode of ['ielts_reading_actual_test', 'ielts_listening_actual_test', 'ielts_writing_actual_test', 'comprehensive_actual_test']) {
        const start = routes.indexOf(".state('application." + mode + "'");
        assert.ok(start >= 0); assert.match(routes.slice(start, routes.indexOf(".state('", start + 10)), /ielts_reading_actual_test_idp\.html/);
    }
});
