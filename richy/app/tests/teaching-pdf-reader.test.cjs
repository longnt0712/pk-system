const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(saved = {}, completed = false, catalog = {}) {
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
    const module = {factory(name, args) { factory = args.at(-1); return this; }, directive() { return this; }};
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
    const FormData = class {
        constructor() { this.fields = new Map(); }
        append(key, value) { this.fields.set(key, value); }
    };
    vm.runInNewContext(source, {window, document, URL, FormData, pdfEngineMock: engine,
        angular: {module: () => module, extend: Object.assign, isArray: Array.isArray, copy: structuredClone, noop() {}}});
    const http = {
        async get(url) {
            reads.push(url);
            if (url.endsWith('/content')) return {data: new ArrayBuffer(0)};
            if (url.includes('/run/')) return {data: {revision: 0, completed, progress: saved === null ? null : JSON.stringify(saved)}};
            return {data: catalog};
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
    assert.equal(h.ctrl.highlightColors.length, 10);
    assert.equal(h.ctrl.highlightColors[0].value, '#e6b8af');
    assert.equal(h.ctrl.highlightColors[9].value, '#ead1dc');
    assert.equal(h.ctrl.highlightOpacity('#c9daf8'), 1);
    assert.equal(h.ctrl.highlightOpacity('#2b62ba'), .38);
    h.ctrl.colorSelection('#c9daf8');
    h.ctrl.noteSelection();
    h.ctrl.context.mark.note = 'Under this selection';
    h.ctrl.markChanged();
    await h.tick();
    assert.equal(h.ctrl.state.marks.length, 2);
    assert.equal(h.ctrl.state.marks[1].highlightColor, '#c9daf8');
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

test('only two taps open free text for editing, while dragging saves its position on the PDF page', async () => {
    const saved = {page: 2, marks: [{page: 2, x: .2, y: .3, text: 'Move me'}, {page: 2, note: 'Keep me'}]};
    const h = fixture(saved);
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    const mark = h.ctrl.state.marks[0];
    const sheet = h.sheet(2);
    const page = sheet.getBoundingClientRect();
    const box = {left: page.width * mark.x, top: page.height * mark.y, width: 60, height: 28};
    let captured;
    const handle = {
        closest: selector => selector === '[data-pdf-page]' ? sheet : {getBoundingClientRect: () => box},
        setPointerCapture: id => { captured = id; },
        hasPointerCapture: id => captured === id,
        releasePointerCapture: () => { captured = null; }
    };
    const start = {currentTarget: handle, isPrimary: true, button: 0, pointerId: 5, pointerType: 'touch',
        clientX: box.left + 12, clientY: box.top + 3, preventDefault() {}};
    const pointer = (type, x, y, timeStamp) => h.events[type]({type, pointerId: 5, clientX: x, clientY: y, timeStamp, stopPropagation() {}});
    const tap = time => {
        h.ctrl.beginTextDrag(mark, start);
        pointer('pointerup', start.clientX + 4, start.clientY, time);
    };
    tap(100);
    assert.ok(!h.ctrl.editingText);
    tap(240);
    assert.equal(h.ctrl.editingText, mark);
    h.ctrl.beginTextDrag(mark, start);
    assert.equal(captured, null);
    h.ctrl.finishText(mark);

    h.ctrl.beginTextDrag(mark, start);
    assert.equal(captured, 5);
    pointer('pointermove', page.width + 40, page.height + 40);
    assert.ok(h.ctrl.textPosition(mark).x > .76);
    assert.equal(mark.x, .2);
    assert.equal(h.writes.length, 0);
    pointer('pointercancel');
    assert.equal(captured, null);
    assert.equal(h.ctrl.textPosition(mark), mark);
    assert.equal(mark.y, .3);

    h.ctrl.beginTextDrag(mark, start);
    pointer('pointerup', page.width + 40, page.height + 40, 1000);
    await h.tick();
    const moved = h.writes.at(-1).state.marks[0];
    assert.deepEqual(moved, {page: 2, x: 1, y: 1, text: 'Move me'});
    tap(1100);
    assert.ok(!h.ctrl.editingText);
    tap(1250);
    assert.equal(h.ctrl.editingText, mark);
    h.ctrl.removeMark(mark);
    assert.equal(h.ctrl.editingText, null);
    await h.tick();
    assert.deepEqual(h.writes.at(-1).state.marks, [{page: 2, note: 'Keep me'}]);

    const readonly = fixture(saved, true);
    await readonly.tick();
    await readonly.ctrl.open('run');
    const locked = readonly.ctrl.state.marks[0];
    readonly.ctrl.beginTextDrag(locked, start);
    readonly.ctrl.removeMark(locked);
    assert.ok(!readonly.ctrl.textDrag);
    assert.equal(readonly.ctrl.state.marks.length, 2);
});

test('PDF pen widths are saved and the eraser removes only the strokes swept on its page', async () => {
    const older = {page: 1, points: [['0.2000', '0.2000'], ['0.8000', '0.2000']]};
    const otherPage = {page: 2, points: older.points};
    const highlight = {page: 1, highlight: true, rects: [{x: .4, y: .19, w: .2, h: .02}]};
    const text = {page: 1, x: .4, y: .19, text: 'Keep'};
    const h = fixture({page: 1, marks: [older, otherPage, highlight, text]});
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    assert.equal(h.ctrl.inkWidth(older), 2);
    const page = h.sheet(1), box = page.getBoundingClientRect();
    let captured = null;
    const overlay = {
        closest: selector => selector === '[data-pdf-page]' ? page : selector === '.teaching-pdf-ink' ? overlay : null,
        getBoundingClientRect: () => box,
        setPointerCapture: id => { captured = id; },
        hasPointerCapture: id => captured === id,
        releasePointerCapture: () => { captured = null; }
    };
    function pointer(type, x, y) {
        h.events[type]({type, target: overlay, pointerId: 7, isPrimary: true, button: 0,
            clientX: box.left + x * box.width, clientY: box.top + y * box.height});
    }
    h.ctrl.toggleInk('pen');
    h.ctrl.inkSizes.pen = '7';
    pointer('pointerdown', .2, .6);
    pointer('pointerup', .8, .6);
    await h.tick();
    const newStroke = h.writes.at(-1).state.marks.at(-1);
    assert.equal(newStroke.width, 7);
    assert.equal(h.ctrl.inkWidth(newStroke), 7);
    assert.equal(captured, null);

    h.ctrl.toggleInk('eraser');
    pointer('pointerdown', .5, .1);
    pointer('pointermove', .5, .3);
    assert.equal(h.ctrl.inkErased(h.ctrl.state.marks[0]), true);
    pointer('pointercancel');
    assert.equal(h.ctrl.state.marks.length, 5);
    assert.equal(h.ctrl.inkErased(h.ctrl.state.marks[0]), false);
    pointer('pointerdown', .5, .1);
    pointer('pointerup', .5, .3);
    await h.tick();
    assert.deepEqual(h.writes.at(-1).state.marks, [otherPage, highlight, text, newStroke]);
    h.ctrl.inkSizes.eraser = '2';
    pointer('pointerdown', .5, .6 + 19 / box.height);
    pointer('pointerup', .5, .6 + 19 / box.height);
    assert.equal(h.ctrl.state.marks.length, 4);
    h.ctrl.inkSizes.eraser = '7';
    pointer('pointerdown', .5, .6 + 19 / box.height);
    pointer('pointerup', .5, .6 + 19 / box.height);
    await h.tick();
    assert.deepEqual(h.writes.at(-1).state.marks, [otherPage, highlight, text]);
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

test('touch keeps PDF selection actions away from the selected text', async () => {
    const h = fixture();
    await h.tick();
    await h.ctrl.open('run');
    await h.tick();
    const text = {closest: selector => selector === '.textLayer' ? text : null};
    h.events.pointerdown({type: 'pointerdown', pointerType: 'touch', target: text});
    h.select(1, 150);
    await h.tick();
    assert.equal(h.ctrl.context.menu.y, 422);
    h.select(1, 330);
    await h.tick();
    assert.equal(h.ctrl.context.menu.y, 8);
    let blocked = false;
    const contextEvent = {target: text, cancelable: true, preventDefault: () => { blocked = true; }};
    h.events.contextmenu({...contextEvent, pointerType: 'touch'});
    assert.equal(blocked, true);
    blocked = false;
    h.events.pointerdown({type: 'pointerdown', pointerType: 'mouse', target: text});
    h.events.contextmenu({...contextEvent, pointerType: 'mouse'});
    assert.equal(blocked, false);
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

test('explorer navigates nested folders and moves a PDF back to the root', async () => {
    const h = fixture({}, false, {
        folders: [{id: 'class', name: 'Class'}, {id: 'week', name: 'Week', parentId: 'class'}],
        library: [{id: 'original', name: 'Original.pdf'}, {id: 'moved', name: 'Nested.pdf', folderId: 'week'}]
    });
    await h.tick();
    assert.equal(h.ctrl.foldersEnabled, true);
    assert.equal(h.ctrl.visibleFiles[0].id, 'original');
    h.ctrl.browseFolder('week');
    assert.deepEqual(Array.from(h.ctrl.folderTrail, folder => folder.id), ['class', 'week']);
    assert.equal(h.ctrl.visibleFiles[0].id, 'moved');
    h.ctrl.editLibrary('folder', h.ctrl.folders[0]);
    assert.equal(h.ctrl.folderChoices.length, 0);
    h.ctrl.editLibrary('file', h.ctrl.visibleFiles[0]);
    h.ctrl.libraryForm.parentId = null;
    h.http.put = async (url, request) => {
        assert.match(url, /\/files\/moved$/);
        assert.equal(request.folderId, null);
        return {data: {id: 'moved', name: request.name}};
    };
    await h.ctrl.saveLibrary();
    assert.equal(h.ctrl.visibleFiles.length, 0);
    h.ctrl.browseFolder(null);
    assert.deepEqual(Array.from(h.ctrl.visibleFiles, file => file.id), ['original', 'moved']);
});

test('the PDF explorer routes drags to the destination and keeps successful uploads from a mixed drop', async () => {
    const h = fixture({}, false, {
        folders: [{id: 'class', name: 'Class'}],
        library: [{id: 'original', name: 'Original.pdf'}]
    });
    await h.tick();
    assert.equal(h.ctrl.libraryView, 'list');
    h.ctrl.toggleLibraryView();
    assert.equal(h.ctrl.libraryView, 'grid');
    const classes = new Set();
    const targetFolder = {classList: {add: name => classes.add(name), remove: name => classes.delete(name)},
        getAttribute: () => 'class'};
    const library = {querySelector: () => targetFolder};
    const target = {closest: selector => selector === '.teaching-pdf-library' ? library : targetFolder};
    const source = (kind, id) => ({
        closest() { return this; },
        getAttribute: name => name === 'data-pdf-drag' ? kind : id
    });
    let moves = 0;
    h.http.put = async (url, body) => {
        moves++;
        assert.match(url, /\/files\/original$/);
        assert.equal(body.folderId, 'class');
        return {data: {id: 'original', name: body.name, folderId: body.folderId}};
    };
    const internal = {types: ['application/x-teaching-pdf-item'], setData() {}};
    const drag = (type, eventTarget, dataTransfer) => h.events[type]({type, target: eventTarget, dataTransfer, preventDefault() {}});
    drag('dragstart', source('folder', 'class'), internal);
    drag('drop', target, internal);
    assert.equal(moves, 0);
    drag('dragstart', source('file', 'original'), internal);
    drag('dragover', target, internal);
    assert.equal(internal.dropEffect, 'move');
    assert.ok(classes.has('is-pdf-drop-target'));
    drag('drop', target, internal);
    await h.tick();
    assert.equal(moves, 1);
    assert.equal(classes.size, 0);
    assert.equal(h.ctrl.visibleFiles.length, 0);

    const uploads = [];
    h.http.post = async (url, body) => {
        assert.match(url, /\/upload$/);
        assert.equal(body.fields.get('folderId'), 'class');
        const name = body.fields.get('file').name;
        uploads.push(name);
        return {data: {id: name, name, folderId: 'class'}};
    };
    drag('drop', target, {types: ['Files'], files: [{name: 'One.pdf', size: 100}, {name: 'Bad.txt', size: 10}, {name: 'Two.pdf', size: 200}]});
    await h.tick();
    assert.deepEqual(uploads, ['One.pdf', 'Two.pdf']);
    assert.match(h.ctrl.error, /Bad\.txt/);
    assert.equal(h.ctrl.libraryNotice, 'Đã tải lên 2 PDF.');
    h.ctrl.browseFolder('class');
    assert.deepEqual(Array.from(h.ctrl.visibleFiles, file => file.name), ['Original.pdf', 'One.pdf', 'Two.pdf']);
});
