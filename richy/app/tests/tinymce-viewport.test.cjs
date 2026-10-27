const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const adapterPath = path.join(__dirname, '../common/utils/tinymce-viewport.js');

function scheduler() {
    let now = 0, nextId = 0;
    const tasks = new Map();
    function timeout(callback, delay = 0) {
        const id = ++nextId;
        tasks.set(id, {id, at: now + delay, callback});
        return id;
    }
    timeout.cancel = id => tasks.delete(id);
    timeout.advance = (duration = 100) => {
        const end = now + duration;
        for (let count = 0; count < 10000; count++) {
            const next = [...tasks.values()].filter(task => task.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
            if (!next) { now = end; return; }
            now = next.at; tasks.delete(next.id); next.callback();
        }
        throw new Error('Timer queue did not settle');
    };
    timeout.pending = () => tasks.size;
    return timeout;
}

class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, callback) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name).add(callback);
    }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    dispatchEvent(event) {
        if (typeof event === 'string') event = {type: event};
        if (!event.target) event.target = this;
        for (const callback of [...(this.listeners.get(event.type) || [])]) callback.call(this, event);
        return true;
    }
}

function harness({intersection = true} = {}) {
    const timeout = scheduler(), services = new Map(), directives = new Map(), values = new Map();
    const document = new Events(); document.nodeType = 9; document.activeElement = null;
    class Node extends Events {
        constructor(tag = 'div') {
            super(); this.tagName = tag.toUpperCase(); this.nodeType = 1;
            this.ownerDocument = document; this.children = []; this.parentNode = null;
            this.style = {}; this.attributes = {}; this.className = ''; this.value = '';
            this.textContent = ''; this.rect = null; this.hidden = false;
            this.classList = {
                add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
                remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
                contains: name => this.className.split(/\s+/).includes(name)
            };
        }
        get id() { return this.attributes.id || ''; }
        set id(value) { this.attributes.id = String(value); }
        get parentElement() { return this.parentNode; }
        get firstChild() { return this.children[0] || null; }
        get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
        get offsetHeight() { return this.getBoundingClientRect().height; }
        get offsetWidth() { return this.getBoundingClientRect().width; }
        get offsetParent() { return this.style.display === 'none' || this.hidden ? null : this.parentNode; }
        get isConnected() { return document.documentElement.contains(this); }
        appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); this.children.push(child); child.parentNode = this; return child; }
        insertBefore(child, before) {
            if (!before) return this.appendChild(child);
            if (child.parentNode) child.parentNode.removeChild(child);
            const index = this.children.indexOf(before); assert.ok(index >= 0, 'insertBefore child belongs to parent');
            this.children.splice(index, 0, child); child.parentNode = this; return child;
        }
        removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
        remove() { this.parentNode?.removeChild(this); }
        contains(other) { return this === other || this.children.some(child => child.contains(other)); }
        setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = String(value); }
        getAttribute(name) { return name === 'class' ? this.className : this.attributes[name] ?? null; }
        hasAttribute(name) { return name === 'class' ? !!this.className : name in this.attributes; }
        removeAttribute(name) { delete this.attributes[name]; if (name === 'class') this.className = ''; }
        getBoundingClientRect() {
            const rect = this.rect || this.parentNode?.getBoundingClientRect() || {top: 0, left: 0, width: 700, height: 240};
            return {...rect, right: rect.left + rect.width, bottom: rect.top + rect.height};
        }
        getClientRects() { return this.isConnected && !this.hidden && this.style.display !== 'none' ? [this.getBoundingClientRect()] : []; }
        focus() { document.activeElement = this; this.dispatchEvent('focus'); }
        blur() { if (document.activeElement === this) document.activeElement = document.body; this.dispatchEvent('blur'); }
        querySelectorAll(selector) {
            const matches = node => selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : selector.startsWith('#') ? node.id === selector.slice(1) : node.tagName.toLowerCase() === selector.toLowerCase();
            return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    }
    document.documentElement = new Node('html'); document.documentElement.rect = {top: 0, left: 0, width: 1200, height: 800};
    document.body = new Node('body'); document.documentElement.appendChild(document.body); document.activeElement = document.body;
    document.createElement = tag => new Node(tag);
    document.getElementById = id => document.documentElement.querySelector('#' + id);
    document.querySelector = selector => document.documentElement.querySelector(selector);
    document.hasFocus = () => true;
    document.documentElement.clientHeight = 800; document.documentElement.clientWidth = 1200;
    const window = new Events(); window.document = document; window.innerHeight = 800; window.innerWidth = 1200;
    window.setTimeout = timeout; window.clearTimeout = timeout.cancel;
    window.requestAnimationFrame = callback => timeout(callback, 16); window.cancelAnimationFrame = timeout.cancel;
    window.getComputedStyle = node => ({display: node.style.display || 'block', visibility: node.style.visibility || 'visible', height: node.style.height || '240px'});
    const observers = [];
    if (intersection) window.IntersectionObserver = class {
        constructor(callback, options = {}) { this.callback = callback; this.options = options; this.targets = new Set(); observers.push(this); }
        observe(node) { this.targets.add(node); }
        unobserve(node) { this.targets.delete(node); }
        disconnect() { this.targets.clear(); }
    };
    function wrap(node) {
        const result = {
            0: node, length: 1,
            attr(name, value) { if (value === undefined) return node.getAttribute(name); node.setAttribute(name, value); return this; },
            removeAttr(name) { node.removeAttribute(name); return this; },
            addClass(name) { node.classList.add(name); return this; }, removeClass(name) { node.classList.remove(name); return this; },
            css(name, value) { if (typeof name === 'object') Object.assign(node.style, name); else if (value === undefined) return node.style[name]; else node.style[name] = value; return this; },
            on(names, callback) { names.split(/\s+/).forEach(name => node.addEventListener(name, callback)); return this; },
            off(names, callback) { names.split(/\s+/).forEach(name => node.removeEventListener(name, callback)); return this; },
            parent() { return wrap(node.parentNode); }, after(other) { node.parentNode.insertBefore(other[0] || other, node.nextSibling); return this; },
            append(other) { node.appendChild(other[0] || other); return this; }, remove() { node.remove(); return this; },
            val(value) { if (value === undefined) return node.value; node.value = value; return this; },
            controller(name) { return name === 'ngModel' ? node.ngModel : null; }
        };
        return result;
    }
    function module() {
        return {
            value(name, value) { values.set(name, value); return this; },
            service(name, definition) { services.set(name, definition); return this; },
            factory(name, definition) { services.set(name, definition); return this; },
            directive(name, definition) { directives.set(name, definition); return this; }
        };
    }
    const angular = {module, element: wrap, extend: Object.assign, noop() {}, isDefined: value => value !== undefined,
        isUndefined: value => value === undefined, isFunction: value => typeof value === 'function',
        forEach: (items, callback) => Array.isArray(items) ? items.forEach(callback) : Object.keys(items || {}).forEach(key => callback(items[key], key))};
    const trusted = html => ({html, toString: () => html});
    const sce = {trustAsHtml: trusted, getTrustedHtml: value => value && typeof value === 'object' && 'html' in value ? value.html : value || '', valueOf: value => value?.html ?? value};
    const rootScope = {$$phase: false};
    const editors = new Map(), initCalls = [], removed = [], pendingInit = [];
    function newEditor(options) {
        const textarea = options.target || document.getElementById(options.selector.replace(/^#/, ''));
        assert.ok(textarea, 'TinyMCE init target remains attached');
        const events = new Map(), container = new Node('div'), iframe = new Node('iframe'), body = new Node('body');
        container.className = 'mce-tinymce'; container.appendChild(iframe); textarea.parentNode.insertBefore(container, textarea.nextSibling);
        const editor = {
            id: textarea.id, settings: options, initialized: false, content: textarea.value, dirty: false, focused: false, removed: false,
            windowManager: {getWindows: () => editor.dialogs, windows: []}, dialogs: [], plugins: {fullscreen: {isFullscreen: () => editor.fullscreen}}, fullscreen: false,
            on(names, callback) { names.split(/\s+/).forEach(name => { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(callback); }); return this; },
            off(names, callback) { names.split(/\s+/).forEach(name => events.get(name)?.delete(callback)); return this; },
            fire(name, event = {}) { for (const callback of [...(events.get(name) || [])]) callback({...event, type: name, target: this}); return this; },
            getContent() { return this.content; }, setContent(content) { this.content = content; this.dirty = true; },
            save() { textarea.value = this.content; return this.content; }, isDirty() { return this.dirty; }, setDirty(value) { this.dirty = value; },
            getElement() { return textarea; }, getContainer() { return container; }, getBody() { return body; },
            getDoc() { return this.initialized ? {body, activeElement: body} : null; }, hasFocus() { return this.focused; },
            focus() { this.focused = true; document.activeElement = iframe; tiny.activeEditor = this; this.fire('focus'); },
            blur() { this.focused = false; document.activeElement = document.body; this.fire('blur'); },
            remove() { if (this.removed) return; this.removed = true; this.initialized = false; editors.delete(this.id); removed.push(this); container.remove(); this.fire('remove'); },
            destroy() { this.remove(); }
        };
        editors.set(editor.id, editor); tiny.editors = [...editors.values()];
        options.setup?.(editor); return editor;
    }
    const tiny = {
        editors: [], activeEditor: null,
        get: id => editors.get(id) || null,
        init(options) {
            initCalls.push(options); const editor = newEditor(options), thenHandlers = [];
            pendingInit.push(() => { editor.initialized = true; editor.fire('init'); for (const callback of thenHandlers) callback([editor]); });
            return {then(callback) { thenHandlers.push(callback); return this; }, catch() { return this; }};
        },
        remove(value) { if (typeof value === 'string') editors.get(value.replace(/^#/, ''))?.remove(); else value?.remove(); },
        triggerSave() { for (const editor of editors.values()) editor.save(); },
        execCommand(command, unused, id) { if (command === 'mceRemoveEditor') editors.get(id)?.remove(); }
    };
    window.tinymce = tiny;
    const context = {angular, window, document, tinymce: tiny, console, setTimeout: timeout, clearTimeout: timeout.cancel};
    vm.createContext(context); vm.runInContext(fs.readFileSync(adapterPath, 'utf8'), context, {filename: adapterPath});
    const dependencies = new Map([['$window', window], ['$document', [document]], ['$timeout', timeout], ['$rootScope', rootScope], ['$sce', sce], ['$compile', () => () => { throw new Error('Unexpected recompilation'); }]]);
    function inject(definition, construct = false) {
        const names = Array.isArray(definition) ? definition.slice(0, -1) : [], fn = Array.isArray(definition) ? definition.at(-1) : definition;
        const args = names.map(name => get(name));
        if (construct) { const instance = {}; return fn.apply(instance, args) || instance; }
        return fn(...args);
    }
    function get(name) {
        if (dependencies.has(name)) return dependencies.get(name);
        if (values.has(name)) return values.get(name);
        assert.ok(services.has(name), 'Known injectable ' + name);
        const result = inject(services.get(name), true); dependencies.set(name, result); return result;
    }
    const directive = inject(directives.get('uiTinymce'));
    function link({top = 0, html = '<p>Original</p>', lazy = true, options = {height: 200}} = {}) {
        const host = new Node('section'), textarea = new Node('textarea');
        host.rect = {top, left: 0, width: 700, height: 300}; host.appendChild(textarea); textarea.value = html; document.body.appendChild(host);
        const state = {host, textarea, html, options, destroyed: false, changes: 0, pristine: 0};
        const listeners = new Map(), watches = [];
        const scope = {
            $$destroyed: false, $eval(expression) { if (expression === 'false') return false; if (expression === 'true' || expression === '') return true; return state[expression]; },
            $on(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); return () => listeners.get(name).delete(callback); },
            $watch(expression, callback) { const watch = {expression, callback}; watches.push(watch); return () => watches.splice(watches.indexOf(watch), 1); },
            $digest() {}, $apply(callback) { callback?.(); }, $evalAsync(callback) { callback(); }, $applyAsync(callback) { callback(); }
        };
        const model = {
            $viewValue: html, $modelValue: html, $formatters: [], $parsers: [], $viewChangeListeners: [],
            $setViewValue(value) { this.$viewValue = value; this.$modelValue = this.$parsers.reduce((current, parser) => parser(current), value); state.html = sce.getTrustedHtml(this.$modelValue); state.changes++; this.$viewChangeListeners.forEach(callback => callback()); },
            $setPristine() { state.pristine++; }, $setUntouched() {}, $setTouched() {}, $setDirty() {}, $commitViewValue() {}, $rollbackViewValue() {}
        };
        textarea.ngModel = model;
        const attrs = {uiTinymce: 'options', ngModel: 'html', $set(name, value) { this[name] = value; textarea.setAttribute(name, value); }, $observe(name, callback) { if (this[name] !== undefined) callback(this[name]); return () => {}; }};
        if (lazy) attrs.uiTinymceLazy = '';
        directive.link(scope, wrap(textarea), attrs, [model, {$setPristine() {}}]);
        Object.assign(state, {scope, model, attrs,
            editor: () => tiny.get(textarea.id),
            emit(name, ...args) { for (const callback of [...(listeners.get(name) || [])]) callback({name}, ...args); },
            replace(html) { state.html = html; model.$modelValue = html; model.$viewValue = model.$formatters.reduceRight((value, formatter) => formatter(value), html); model.$render(); },
            destroy() { state.destroyed = true; scope.$$destroyed = true; state.emit('$destroy'); host.remove(); }
        });
        return state;
    }
    function move(state, top) {
        state.host.rect.top = top;
        for (const observer of observers) for (const target of observer.targets) {
            if (!state.host.contains(target)) continue;
            const rect = target.getBoundingClientRect(), margins = (observer.options.rootMargin || '0').match(/-?\d+/g) || ['0'];
            const margin = Math.max(...margins.map(Number));
            const isIntersecting = rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
            observer.callback([{target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0, boundingClientRect: rect}], observer);
        }
        window.dispatchEvent('scroll'); document.dispatchEvent('scroll');
    }
    function complete() { const callback = pendingInit.shift(); assert.ok(callback, 'A TinyMCE initialization is pending'); callback(); }
    function settle() { for (let count = 0; count < 20; count++) { timeout.advance(100); if (!pendingInit.length) return; complete(); } throw new Error('Initialization did not settle'); }
    return {timeout, window, document, tiny, observers, initCalls, removed, pendingInit, link, move, complete, settle, service: get('uiTinymceService')};
}

test('offscreen lazy fields remain lightweight; nearby fields initialize one editor at a time', () => {
    const h = harness(), distant = h.link({top: 6000}), first = h.link({top: 100}), second = h.link({top: 400});
    h.timeout.advance(100);
    assert.equal(h.initCalls.length, 1); assert.equal(distant.editor(), null);
    h.complete(); h.timeout.advance(100);
    assert.equal(h.initCalls.length, 2); h.complete(); h.timeout.advance(100);
    assert.ok(first.editor()); assert.ok(second.editor()); assert.equal(distant.editor(), null);
    h.move(distant, 300); h.settle(); assert.ok(distant.editor());
});

test('eviction flushes pending HTML and remounts the same model without losing images, tables or gap tokens', () => {
    const h = harness(), field = h.link(); h.settle();
    const html = '<p>Question }{SPACE}{</p><table><tbody><tr><td>A</td></tr></tbody></table><p><img src="chart.png" alt="chart"></p>';
    const old = field.editor(); old.setContent(html); old.fire('input');
    h.move(field, -6000); h.timeout.advance(1500);
    assert.equal(field.html, html); assert.equal(old.removed, true); assert.equal(field.editor(), null);
    assert.ok(field.textarea.isConnected, 'Eviction retains the original Angular textarea');
    h.move(field, 100); h.settle(); assert.notEqual(field.editor(), old); assert.equal(field.editor().getContent(), html);
});

test('flush event commits typed content synchronously before the debounce interval', () => {
    const h = harness(), field = h.link(); h.settle();
    field.editor().setContent('<p>Final typed sentence</p>'); field.editor().fire('input');
    field.emit('$tinymce:flush');
    assert.equal(field.html, '<p>Final typed sentence</p>');
});

test('active focus, editor dialog, fullscreen and IME composition pin offscreen editors', () => {
    for (const pin of ['focus', 'dialog', 'fullscreen', 'composition']) {
        const h = harness(), field = h.link(); h.settle(); const editor = field.editor();
        if (pin === 'focus') editor.focus();
        if (pin === 'dialog') editor.dialogs.push({});
        if (pin === 'fullscreen') editor.fullscreen = true;
        if (pin === 'composition') editor.fire('compositionstart');
        h.move(field, -6000); h.timeout.advance(1500); assert.equal(editor.removed, false, pin);
        if (pin === 'focus') editor.blur();
        if (pin === 'dialog') { editor.dialogs.length = 0; editor.fire('CloseWindow'); }
        if (pin === 'fullscreen') { editor.fullscreen = false; editor.fire('FullscreenStateChanged', {state: false}); }
        if (pin === 'composition') editor.fire('compositionend');
        h.move(field, -6100); h.timeout.advance(1500); assert.equal(editor.removed, true, pin + ' can unpin');
    }
});

test('model replacement before or after initialization cannot be overwritten by stale editor callbacks', () => {
    const h = harness(), field = h.link({html: '<p>Old test</p>'});
    h.timeout.advance(100); field.replace('<p>Selected second test</p>'); h.complete(); h.timeout.advance(100);
    assert.equal(field.editor().getContent(), '<p>Selected second test</p>');
    field.editor().setContent('<p>Pending old keystroke</p>'); field.editor().fire('input');
    field.replace('<p>Selected third test</p>'); h.timeout.advance(1000);
    assert.equal(field.html, '<p>Selected third test</p>'); assert.equal(field.editor().getContent(), '<p>Selected third test</p>');
});

test('an external model assignment before Angular renders survives flush, blur, debounce and field destruction', () => {
    for (const action of ['flush', 'blur', 'debounce', 'destroy']) {
        const h = harness(), field = h.link({html: '<p>Previous test</p>'}); h.settle();
        field.editor().setContent('<p>Pending previous keystroke</p>'); field.editor().fire('input');
        // Angular's model watcher has not updated the ngModel controller or rendered yet.
        field.html = '<p>New external test</p>';
        assert.equal(field.model.$modelValue, '<p>Previous test</p>');
        if (action === 'flush') h.service.flush();
        if (action === 'blur') field.editor().fire('blur');
        if (action === 'destroy') field.destroy();
        h.timeout.advance(1000);
        assert.equal(field.html, '<p>New external test</p>', action);
        if (action !== 'destroy') {
            field.replace(field.html); h.service.flush();
            assert.equal(field.editor().getContent(), '<p>New external test</p>', action);
            assert.equal(field.model.$modelValue, '<p>New external test</p>', action);
        }
    }
});

test('loading reserves one editor height and restores a measured placeholder after eviction', () => {
    const h = harness(), field = h.link({options: {height: 1000}});
    const wrapper = field.textarea.parentNode, placeholder = wrapper.querySelector('.ui-tinymce-placeholder');
    assert.equal(placeholder.style.height, '1000px');
    h.timeout.advance(100);
    assert.equal(wrapper.style.minHeight, '1000px'); assert.equal(placeholder.style.position, 'absolute');
    assert.equal(placeholder.style.top, '0'); assert.equal(placeholder.style.left, '0');
    h.complete(); h.timeout.advance(100);
    assert.equal(wrapper.style.minHeight, ''); assert.equal(placeholder.style.display, 'none');
    field.editor().getContainer().rect = {top: 0, left: 0, width: 700, height: 1040};
    h.move(field, -6000); h.timeout.advance(1000);
    assert.equal(field.editor(), null); assert.equal(placeholder.style.height, '1040px');
    assert.equal(wrapper.style.minHeight, ''); assert.equal(placeholder.style.position, ''); assert.equal(placeholder.style.display, 'block');
});

test('rapidly leaving the viewport or destroying the scope cancels queued initialization and cleanup is safe', () => {
    const h = harness(), first = h.link({top: 100}), queued = h.link({top: 200}); h.timeout.advance(100);
    assert.equal(h.initCalls.length, 1);
    h.move(queued, 9000); queued.destroy(); h.complete(); h.timeout.advance(1500);
    assert.equal(h.initCalls.length, 1); assert.equal(queued.editor(), null);
    first.editor().setContent('<p>Latest edit</p>'); first.editor().fire('input'); first.destroy(); h.timeout.advance(1500);
    assert.equal(first.html, '<p>Latest edit</p>'); assert.equal(first.editor(), null); assert.equal(h.pendingInit.length, 0);
    assert.ok(h.observers.every(observer => observer.targets.size === 0)); assert.equal(h.timeout.pending(), 0);
});

test('failed content reads keep the live editor available and reject a flush instead of losing data', () => {
    const h = harness(), field = h.link(); h.settle(); const editor = field.editor();
    editor.setContent('<p>Unsaved content</p>'); editor.fire('input');
    const getContent = editor.getContent; editor.getContent = () => { throw new Error('Iframe temporarily unavailable'); };
    h.move(field, -6000); h.timeout.advance(1000);
    assert.equal(editor.removed, false); assert.equal(field.html, '<p>Original</p>');
    assert.throws(() => h.service.flush(), /Iframe temporarily unavailable/);
    editor.getContent = getContent; h.service.flush(); assert.equal(field.html, '<p>Unsaved content</p>');
    h.move(field, -6100); h.timeout.advance(1000); assert.equal(editor.removed, true);
});

test('an initialized editor whose iframe document is unavailable cannot silently save an older model value', () => {
    const h = harness(), field = h.link(); h.settle(); const editor = field.editor();
    editor.setContent('<p>Iframe edit</p>'); editor.fire('input');
    const getDoc = editor.getDoc; editor.getDoc = () => null;
    h.move(field, -6000); h.timeout.advance(1000);
    assert.equal(editor.removed, false); assert.equal(field.html, '<p>Original</p>');
    assert.throws(() => h.service.flush());
    editor.getDoc = getDoc; h.service.flush(); assert.equal(field.html, '<p>Iframe edit</p>');
});

test('late initialization callbacks from a destroyed field cannot replace the next field or block its queue', () => {
    const h = harness(), old = h.link({html: '<p>Closed test</p>'}); h.timeout.advance(100);
    assert.equal(h.pendingInit.length, 1); old.destroy();
    const current = h.link({html: '<p>Current test</p>'}); h.timeout.advance(100);
    assert.equal(h.initCalls.length, 2);
    h.complete(); h.complete(); h.timeout.advance(100);
    assert.equal(old.editor(), null); assert.equal(current.editor().getContent(), '<p>Current test</p>');
    current.destroy(); h.timeout.advance(1000); assert.equal(h.timeout.pending(), 0);
});

test('refresh flushes edits and rebuilds the editor with updated options without removing its Angular textarea', () => {
    const h = harness(), field = h.link(); h.settle(); const previous = field.editor();
    previous.setContent('<p>Before refresh</p>'); previous.fire('input'); field.options.height = 480;
    field.emit('$tinymce:refresh'); h.settle();
    assert.equal(previous.removed, true); assert.notEqual(field.editor(), previous);
    assert.equal(field.editor().settings.height, 480); assert.equal(field.editor().getContent(), '<p>Before refresh</p>');
    assert.equal(field.html, '<p>Before refresh</p>'); assert.ok(field.textarea.isConnected);
});

test('scroll fallback mounts and evicts without IntersectionObserver', () => {
    const h = harness({intersection: false}), field = h.link({top: 6000}); h.timeout.advance(100);
    assert.equal(h.initCalls.length, 0);
    h.move(field, 200); h.settle(); assert.ok(field.editor());
    field.editor().setContent('<p>Fallback edit</p>'); field.editor().fire('input');
    h.move(field, -6000); h.timeout.advance(1500); assert.equal(field.editor(), null); assert.equal(field.html, '<p>Fallback edit</p>');
});

test('non-lazy editors retain immediate mount and normal model updates', () => {
    const h = harness(), field = h.link({top: 9000, lazy: false}); h.settle(); assert.ok(field.editor());
    field.editor().setContent('<p>Normal editor</p>'); field.editor().fire('change'); h.timeout.advance(1000);
    assert.equal(field.html, '<p>Normal editor</p>'); h.move(field, 16000); h.timeout.advance(1500); assert.ok(field.editor());
    field.replace('<p>External replacement</p>'); assert.equal(field.editor().getContent(), '<p>External replacement</p>');
});

function builderHarness({failFlush = false} = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSCreateReadingTestController.js'), 'utf8').replace(/\r\n/g, '\n');
    function production(marker, ending) {
        const start = source.indexOf(marker), end = source.indexOf(ending, start);
        assert.ok(start >= 0 && end > start, 'Production builder entry point ' + marker);
        return source.slice(start, end + ending.length);
    }
    const latest = '<p>Latest unfinished edit }{SPACE}{</p><table><tr><td>chart</td></tr></table>';
    const snapshots = {saved: [], exported: [], previews: [], validations: [], errors: []};
    const state = {
        ieltsReadingTest: {id: 17, status: 6, question: '<p>Older model value</p>', subQuestions: []},
        isVideoBuilder: () => false, getOrdinalNumber() {}, getPageCreateIELTSReadingTest() {},
        refreshBuilderValidation() { snapshots.validations.push(state.ieltsReadingTest.question); return {valid: true, issues: []}; },
        goToBuilderTarget() {}, folderTestMode: 'LISTENING', testModeName: 'Listening'
    };
    const stored = new Map();
    const storage = {get length() { return stored.size; }, key: index => [...stored.keys()][index], removeItem: key => stored.delete(key), setItem(key, value) { stored.set(key, value); snapshots.previews.push(JSON.parse(value)); }};
    const context = {
        vm: state, editorService: {flush() { if (failFlush) throw new Error('Cannot read editor'); state.ieltsReadingTest.question = latest; }},
        toastr: {error: (...args) => snapshots.errors.push(args), warning() {}, success() {}},
        $timeout: callback => Promise.resolve().then(callback), $q: {when: value => Promise.resolve(value)},
        angular: {noop() {}, copy: value => JSON.parse(JSON.stringify(value)), toJson: JSON.stringify, forEach: (items, callback) => items.forEach(callback)},
        blockUI: {start() {}, stop() {}}, prepareSharedChoicePackagesForSave() {}, prepareTestFolderForSave() {},
        ensureComprehensiveBuilder: value => value, ensureListeningBuilderParts: value => value, isHavingQuestions() {}, readingTestSaveError: () => 'failed',
        service: {saveObject(value) { snapshots.saved.push(JSON.parse(JSON.stringify(value))); return Promise.resolve(JSON.parse(JSON.stringify(value))); }},
        wordExport: {open(value) { snapshots.exported.push(value); return Promise.resolve(); }},
        $window: {localStorage: storage, sessionStorage: storage, location: {protocol: 'https:', host: 'example.test'}, open: () => ({})},
        document: {getElementsByTagName: () => []}, console
    };
    vm.createContext(context);
    const snippets = ['flushBuilderEditors', 'clearOldReadingPreviews'].map(name => production('        function ' + name + '(', '\n        }'));
    for (const name of ['saveReadingTest', 'continueBuilder', 'openBuilderReviewModal', 'saveDraftReadingTest', 'exportTestWord', 'previewReadingTest', 'publishReadingTest']) {
        snippets.push(production('        vm.' + name + ' =', '\n        };'));
    }
    vm.runInContext(snippets.join('\n'), context);
    return {state, snapshots, latest};
}

test('builder save, preview, Word export and validation consume the latest synchronous editor snapshot', async () => {
    for (const action of ['saveReadingTest', 'saveDraftReadingTest', 'publishReadingTest', 'exportTestWord', 'previewReadingTest', 'continueBuilder', 'openBuilderReviewModal']) {
        const h = builderHarness(); await h.state[action]();
        assert.equal(h.state.ieltsReadingTest.question, h.latest, action);
        for (const value of [...h.snapshots.saved, ...h.snapshots.exported, ...h.snapshots.previews]) assert.equal(value.question, h.latest, action);
        for (const value of h.snapshots.validations) assert.equal(value, h.latest, action);
        if (/save|publish/.test(action)) assert.equal(h.snapshots.saved.length, 1, action);
        if (action === 'exportTestWord') assert.equal(h.snapshots.exported.length, 1);
        if (action === 'previewReadingTest') assert.equal(h.snapshots.previews.length, 1);
        assert.equal(h.snapshots.errors.length, 0, action);
    }
});

test('builder actions abort instead of saving or serializing stale content when an editor cannot flush', async () => {
    for (const action of ['saveReadingTest', 'saveDraftReadingTest', 'publishReadingTest', 'exportTestWord', 'previewReadingTest', 'continueBuilder', 'openBuilderReviewModal']) {
        const h = builderHarness({failFlush: true}); await h.state[action]();
        assert.equal(h.snapshots.errors.length, 1, action);
        assert.equal(h.state.ieltsReadingTest.question, '<p>Older model value</p>', action);
        assert.equal(h.state.ieltsReadingTest.status, 6, action);
        assert.equal(h.snapshots.saved.length + h.snapshots.exported.length + h.snapshots.previews.length + h.snapshots.validations.length, 0, action);
        assert.ok(!h.state.showBuilderReview, action);
    }
});
