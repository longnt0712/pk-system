const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(saved = {}) {
    const input = {value: '1', matches: () => true};
    const events = {}, documentEvents = {}, renders = [], writes = [];
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
        querySelector: selector => selector === '.teaching-pdf-scroll' ? container : selector === '[data-pdf-zoom]' ? input : null,
        addEventListener: (name, fn) => { events[name] = fn; },
        contains: () => true
    };
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
    const source = fs.readFileSync(path.join(__dirname, '../enrolment_class/business/TeachingPdf.js'), 'utf8')
        .replace("import(new URL('pdf.min.js?v=' + version, pdfAssets).href)", 'Promise.resolve(pdfEngineMock)');
    vm.runInNewContext(source, {window, document, URL, pdfEngineMock: engine,
        angular: {module: () => module, extend: Object.assign, copy: structuredClone, noop() {}}});
    const http = {
        async get(url) {
            if (url.endsWith('/content')) return {data: new ArrayBuffer(0)};
            if (url.includes('/run/')) return {data: {revision: 0, completed: false, progress: JSON.stringify(saved)}};
            return {data: {}};
        },
        async put(url, data) { writes.push(data); return {data: {revision: data.revision + 1, completed: data.completed}}; }
    };
    factory({open(options) { config = options; return {result: Promise.resolve()}; }}, http,
        {when: Promise.resolve.bind(Promise), all: Promise.all.bind(Promise), reject: Promise.reject.bind(Promise)},
        {api: {baseUrl: '', apiV1Url: '/api/'}}).open(1, '2026-11-04');
    config.controller.at(-1).call(ctrl, {$on() {}, $evalAsync(fn) { fn(); }}, timer, {});
    ctrl.bindSurface(root);
    const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
    return {ctrl, input, container, events, documentEvents, renders, writes, sheet, tick,
        select(number) {
            const page = sheet(number);
            const rect = {top: 150, bottom: 170, left: 90, right: 170, width: 80, height: 20};
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
    assert.ok(h.ctrl.context.noteTop > h.ctrl.context.top);
    h.ctrl.colorSelection('#2b62ba');
    h.ctrl.highlightSelection();
    h.ctrl.noteSelection();
    h.ctrl.context.mark.note = 'Under this selection';
    h.ctrl.markChanged();
    await h.tick();
    assert.equal(h.ctrl.state.marks.length, 2);
    assert.equal(h.ctrl.state.marks[1].textColor, '#2b62ba');
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
