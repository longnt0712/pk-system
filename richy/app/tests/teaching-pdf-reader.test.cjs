const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(saved = {}, completed = false) {
    const input = {value: '1', matches: () => true};
    const events = {}, documentEvents = {}, renders = [], reads = [], writes = [];
    const ctrl = {};
    const sheets = new Map();
    const container = {
        clientWidth: 730, clientHeight: 500, scrollTop: 0, scrollLeft: 0,
        get children() { return ctrl.pages.map(item => sheet(item.number)); },
        querySelector: selector => sheet(Number(selector.match(/"(\d+)"/)[1])),
        getBoundingClientRect: () => ({top: 0, left: 0, width: 730, height: 500})
    };
    function sheet(number) {
        const item = ctrl.pages[number - 1];
        if (!item) return null;
        if (sheets.has(number)) return sheets.get(number);
        const canvas = {}, text = {style: {}, replaceChildren() {}};
        const node = {
            nodeType: 1, dataset: {pdfPage: String(number)}, style: {setProperty() {}},
            get offsetTop() { return ctrl.pages.slice(0, number - 1).reduce((y, page) => y + parseFloat(page.style.height) + 14, 12); },
            get clientHeight() { return parseFloat(item.style.height); },
            get clientWidth() { return parseFloat(item.style.width); },
            get offsetHeight() { return this.clientHeight; },
            querySelector: selector => selector === 'canvas' ? canvas : text,
            contains: () => true,
            getBoundingClientRect() { return {left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, bottom: this.clientHeight}; }
        };
        sheets.set(number, node);
        return node;
    }
    const root = {
        querySelector: selector => selector === '.teaching-pdf-scroll' ? container : selector === '[data-pdf-zoom]' ? input : getPanel(selector),
        addEventListener: (name, fn) => { events[name] = fn; },
        contains: () => true
    };
    function getPanel(selector) {
        if (selector === '.teaching-pdf-context' && ctrl.context) return {offsetWidth: 260, offsetHeight: 70};
        if (selector === '.teaching-pdf-inline-note' && ctrl.context?.showNote) return {offsetWidth: 285, offsetHeight: 130};
        return null;
    }
    const window = {getSelection: () => selection, addEventListener() {}, requestAnimationFrame: setImmediate, cancelAnimationFrame: clearImmediate};
    let selection = {isCollapsed: true};
    function timer(fn) {
        let handle;
        const promise = new Promise(resolve => { handle = setImmediate(() => resolve(fn())); });
        promise.handle = handle;
        return promise;
    }
    timer.cancel = task => clearImmediate(task.handle);
    const engine = {
        GlobalWorkerOptions: {},
        getDocument() {
            const pdf = {
                numPages: 20,
                async getPage(number) {
                    return {
                        getViewport({scale}) { return {width: 500 * scale, height: 700 * scale, userUnit: 1, rawDims: {pageWidth: 500, pageHeight: 700}}; },
                        streamTextContent() {},
                        render() { renders.push(number); return {promise: Promise.resolve(), cancel() {}}; }
                    };
                }
            };
            return {promise: Promise.resolve(pdf), destroy: async () => {}};
        },
        TextLayer: function () { this.render = async () => {}; this.cancel = () => {}; }
    };
    let factory, config;
    const module = {factory(name, args) { factory = args.at(-1); return this; }, directive() {}};
    const document = {baseURI: 'https://example.test/', addEventListener: (name, fn) => { documentEvents[name] = fn; }};
    root.closest = () => null;
    root.requestFullscreen = async () => {
        document.fullscreenElement = root;
        container.clientWidth = 930;
        documentEvents.fullscreenchange();
    };
    document.exitFullscreen = async () => {
        document.fullscreenElement = null;
        container.clientWidth = 730;
        documentEvents.fullscreenchange();
    };
    const source = fs.readFileSync(path.join(__dirname, '../enrolment_class/business/TeachingPdf.js'), 'utf8')
        .replace("import(new URL('pdf.min.js?v=' + version, pdfAssets).href)", 'Promise.resolve(pdfEngineMock)');
    vm.runInNewContext(source, {window, document, URL, pdfEngineMock: engine,
        angular: {module: () => module, extend: Object.assign, copy: structuredClone, noop() {}}});
    const http = {
        async get(url) {
            reads.push(url);
            if (url.endsWith('/content')) return {data: new ArrayBuffer(0)};
            if (url.includes('/run/')) return {data: {revision: 0, completed, progress: saved === null ? null : JSON.stringify(saved)}};
            return {data: {}};
        },
        async put(url, data) { writes.push(data); return {data: {revision: data.revision + 1, completed: data.completed}}; }
    };
    const service = factory({open(options) { config = options; return {result: Promise.resolve()}; }}, http,
        {when: Promise.resolve.bind(Promise), all: Promise.all.bind(Promise), reject: Promise.reject.bind(Promise)},
        {api: {baseUrl: '', apiV1Url: '/api/'}});
    service.open(1, '2026-11-04');
    config.controller.at(-1).call(ctrl, {$on() {}, $evalAsync(fn) { fn(); }}, timer, {});
    ctrl.bindSurface(root);
    const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
    return {ctrl, input, container, events, document, documentEvents, renders, reads, writes, sheet, tick, service, http,
        select(number, top = 150) {
            const page = sheet(number);
            const rect = {top, bottom: top + 20, left: 90, right: 170, width: 80, height: 20};
            const node = {nodeType: 1, closest: selector => selector === '[data-pdf-page]' ? page : node};
            selection = {rangeCount: 1, isCollapsed: false, toString: () => 'Some text',
                removeAllRanges() { this.isCollapsed = true; },
                getRangeAt: () => ({startContainer: node, endContainer: node, getClientRects: () => [rect], getBoundingClientRect: () => rect})};
            documentEvents.selectionchange();
        }};
}

test('scrolling renders a group of five and dragging zoom retains the current page and offset', async () => {
    const h = fixture();
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    assert.deepEqual([...new Set(h.renders)].sort((a,b) => a - b), [1, 2, 3, 4, 5]);
    h.container.scrollTop = h.sheet(11).offsetTop + 250;
    h.events.scroll({target: h.container});
    await h.tick();
    assert.equal(h.ctrl.state.page, 11);
    assert.equal(h.ctrl.pages[0].active, false);
    assert.equal(h.ctrl.pages[10].ready, true);
    const y = h.ctrl.state.y;
    h.input.value = '1.6';
    h.events.input({type:'input', target:h.input});
    await h.tick();
    assert.equal(h.ctrl.state.zoom, 1.6);
    assert.equal(h.ctrl.state.page, 11);
    assert.ok(Math.abs(h.container.scrollTop - h.sheet(11).offsetTop - y * h.sheet(11).clientHeight) < 1);
});

test('selection tools share one saved mark and free text is anchored to the clicked PDF page', async () => {
    const h = fixture({page: 6, marks: [{page: 3, note: 'Older note'}]});
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    h.select(6);
    await h.tick();
    assert.equal(h.ctrl.context.mark.page, 6);
    assert.ok(h.ctrl.context.menu.y + 70 <= 140);
    h.ctrl.colorSelection('#2b62ba');
    h.ctrl.noteSelection();
    h.ctrl.context.mark.note = 'Under this selection';
    h.ctrl.markChanged();
    await h.tick();
    assert.equal(h.ctrl.state.marks.length, 2);
    assert.equal(h.ctrl.state.marks[1].highlightColor, '#2b62ba');
    assert.equal(h.ctrl.state.marks[1].highlight, true);
    assert.equal(h.ctrl.context.showNote, true);
    h.ctrl.startText();
    h.events.click({target: {closest: selector => selector === '[data-pdf-page]' ? h.sheet(7) : null},
        clientX: 50, clientY: 125, stopPropagation() {}});
    h.ctrl.editingText.text = 'Added on page 7';
    h.ctrl.markChanged();
    await h.tick();
    assert.equal(h.ctrl.state.marks[2].page, 7);
    assert.equal(h.ctrl.state.marks[0].note, 'Older note');
    assert.equal(h.writes.at(-1).state.marks[2].text, 'Added on page 7');
});

test('fullscreen preserves reading position and the zoom slider remains active', async () => {
    const h = fixture({page: 6, y: .2});
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    h.ctrl.toggleFullscreen();
    await h.tick();
    assert.equal(h.ctrl.fullscreen, true);
    assert.equal(h.ctrl.state.page, 6);
    assert.ok(Math.abs(h.container.scrollTop - h.sheet(6).offsetTop - .2 * h.sheet(6).clientHeight) < 1);
    h.input.value = '1.8';
    h.events.input({type: 'input', target: h.input});
    await h.tick();
    assert.equal(h.ctrl.state.zoom, 1.8);
    await h.document.exitFullscreen();
    await h.tick();
    assert.equal(h.ctrl.fullscreen, false);
    assert.equal(h.ctrl.state.zoom, 1.8);
    assert.equal(h.ctrl.state.page, 6);
});

test('a selection near the top places the menu and note clear of its text', async () => {
    const h = fixture();
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    h.select(1, 12);
    await h.tick();
    assert.ok(h.ctrl.context.menu.y >= 42);
    h.ctrl.noteSelection();
    await h.tick();
    assert.ok(h.ctrl.context.note.y >= h.ctrl.context.menu.y + 70);
});

test('completing from the class plan keeps the saved page and annotations without loading the PDF', async () => {
    const state = {page: 6, zoom: 1.5, x: 0, y: .4, marks: [{page: 6, note: 'Keep', highlightColor: '#2b62ba'}]};
    const h = fixture(state);
    await h.tick();
    h.reads.length = 0;
    await h.service.complete(1, '2026-11-04', 'run');
    assert.deepEqual(h.reads, ['/api/class_teaching_pdf/1/2026-11-04/run/run']);
    assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [{state, revision: 0, completed: true}]);
});

test('completing handles an untouched PDF and treats an already completed PDF as a success', async () => {
    const untouched = fixture(null);
    await untouched.service.complete(1, '2026-11-04', 'run');
    assert.equal(untouched.writes[0].state.page, 1);
    assert.equal(untouched.writes[0].state.marks.length, 0);
    const completed = fixture(null, true);
    await completed.service.complete(1, '2026-11-04', 'run');
    assert.equal(completed.writes.length, 0);
});

test('a failed or unconfirmed completion is returned to the class plan', async () => {
    const h = fixture(null);
    h.http.put = async () => ({data: {revision: 1, completed: false}});
    await assert.rejects(h.service.complete(1, '2026-11-04', 'run'), /Invalid save confirmation/);
    h.http.put = async () => { throw {status: 409}; };
    await assert.rejects(h.service.complete(1, '2026-11-04', 'run'), {status: 409});
});
