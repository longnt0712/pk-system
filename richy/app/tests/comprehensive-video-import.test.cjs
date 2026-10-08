const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vmModule = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSCreateReadingTestController.js'), 'utf8');
const videoSource = fs.readFileSync(path.join(__dirname, '../question/business/ComprehensiveVideo.js'), 'utf8');

function section(startMarker, endMarker) {
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, startMarker);
    return source.slice(start, end);
}

function productionFunction(name) {
    const start = source.indexOf('        function ' + name + '(');
    const end = source.indexOf('\n        }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + '\n        }'.length);
}

// An in-memory SheetJS boundary keeps these tests focused on the production
// template and import logic, without downloading the CDN library or saving files.
function sheetJsBoundary() {
    return {
        utils: {
            book_new() { return {SheetNames: [], Sheets: {}}; },
            book_append_sheet(book, sheet, name) { book.SheetNames.push(name); book.Sheets[name] = sheet; },
            aoa_to_sheet(rows) {
                const sheet = {rows: structuredClone(rows)};
                rows.forEach((row, r) => row.forEach((value, c) => {
                    let index = c + 1, column = '';
                    while (index) { index--; column = String.fromCharCode(65 + index % 26) + column; index = Math.floor(index / 26); }
                    sheet[column + (r + 1)] = {v: value, t: typeof value === 'number' ? 'n' : 's'};
                }));
                return sheet;
            },
            sheet_to_json(sheet, options) {
                const rows = sheet.rows.map(row => row.map(value => value == null ? '' : String(value)));
                if (options.header === 1) { return rows; }
                return rows.slice(1).filter(row => row.some(Boolean)).map(row =>
                    Object.fromEntries(rows[0].map((header, index) => [header, row[index] || ''])));
            }
        },
        read(book) { return book; },
        writeFile(book, name) { this.download = {book, name}; }
    };
}

function harness({mode = 'comprehensive', videoMode = false, link = '', saveResponse, saveFailure, savePending} = {}) {
    const definitions = {}, messages = [], saves = [];
    const angular = {
        isObject: value => value !== null && typeof value === 'object',
        isArray: Array.isArray,
        isDefined: value => value !== undefined,
        copy: structuredClone,
        forEach(collection, callback) {
            if (Array.isArray(collection)) { collection.forEach(callback); }
            else if (collection) { Object.keys(collection).forEach(key => callback(collection[key], key)); }
        },
        module() { return {
            factory(name, definition) { definitions[name] = definition; return this; },
            directive() { return this; }
        }; },
        noop() {}
    };
    vmModule.runInNewContext(videoSource, {angular});
    const video = definitions.ComprehensiveVideo.at(-1)({URL}, {});
    const XLSX = sheetJsBoundary();
    const state = {
        isComprehensiveMode: mode === 'comprehensive', isFlexibleMode: mode === 'comprehensive',
        isWritingMode: false, isListeningMode: mode === 'listening',
        testModeName: mode === 'comprehensive' ? 'Tổng hợp' : mode === 'listening' ? 'Listening' : 'Reading',
        currentUser: {id: 7}, types: [], questionPackageTypes: [{id: 1, name: 'Multiple Choices'}, {id: 11, name: 'Filling Gaps New'}],
        isVideoBuilder() { return this.isComprehensiveMode && (videoMode || this.comprehensiveContentMode === 'VIDEO'); },
        ieltsReadingTest: {subQuestions: [{videoUrl: link}]},
        comprehensiveContentMode: 'TEXT', savedBuilderVideoLink: 'old link', builderVideoSeconds: 99, videoDuration: 999,
        getOrdinalNumber() {}, refreshBuilderValidation() {},
        syncTestTopics() {}, restoreBuilderTopicContext() {}, getPageCreateIELTSReadingTest() {},
        matchingOptionLabel(index) { return String.fromCharCode(65 + index); }
    };
    const loading = {count: 0, start() { this.count++; }, stop() { this.count--; }};
    const context = {
        angular, XLSX, video, vm: state, $window: {XLSX},
        toastr: Object.fromEntries(['error', 'warning', 'success'].map(type => [type, (message, title) => messages.push({type, message, title})])),
        $scope: {$applyAsync(callback) { callback(); }},
        $timeout(callback) { return Promise.resolve().then(callback); }, blockUI: loading,
        service: {saveObject(value) {
            saves.push({status: value.status, test: structuredClone(value)});
            if (savePending) { return savePending; }
            if (saveFailure) { return Promise.reject(saveFailure); }
            return saveResponse !== undefined ? Promise.resolve(saveResponse) : Promise.resolve(Object.assign(structuredClone(value), {id: 42}));
        }},
        isHavingQuestions() {},
        FileReader: class {readAsArrayBuffer(file) { this.onload({target: {result: file.workbook}}); }}
    };
    vmModule.createContext(context);
    vmModule.runInContext(['ensureComprehensiveBuilder', 'ensureWritingTaskPackage', 'ensureMultipleAnswerPackage', 'ensureListeningBuilderParts',
        'plainText', 'isSharedChoicePackage', 'ensureSharedChoicePackage'].map(productionFunction).join('\n') + '\n' +
        productionFunction('prepareSharedChoicePackagesForSave') + '\n' +
        section('        function readingTestSaveError(', '        var readingPartRules =') + '\n' +
        section('        function readingQuestionType(', '        vm.status = {id: 3, name: "Tất cả (no listening)"};'), context);
    return {
        state, messages, saves, loading,
        download() { state.downloadReadingImportTemplate(); assert.ok(XLSX.download); return XLSX.download; },
        parse(book) { return context.readingTestFromExcel(book); },
        import(book) { state.importReadingTestFile({name: 'mau_import_bai_tap_tong_hop.xlsx', size: 1000, workbook: book}); }
    };
}

function info(book, field, value) {
    const row = book.Sheets.THONG_TIN.rows.find(row => row[0] === field);
    assert.ok(row, field);
    if (arguments.length === 3) { row[1] = value; }
    return row[1];
}

function cue(book, question, value) {
    const rows = book.Sheets.NOI_DUNG.rows;
    const column = rows[0].indexOf('Mốc video');
    assert.ok(column >= 0);
    rows.find((row, index) => index > 0 && row[5] === question)[column] = value;
}

test('the existing Tổng hợp download always includes video fields, full instructions and existing examples', () => {
    const qa = harness(), {book, name} = qa.download();
    assert.equal(name, 'mau_import_bai_tap_tong_hop.xlsx');
    assert.equal(info(book, 'Loại nội dung'), 'TEXT');
    assert.equal(info(book, 'Video URL'), '');
    assert.equal(book.Sheets.NOI_DUNG.rows[0].at(-1), 'Mốc video');
    assert.equal(book.Sheets.NOI_DUNG['!autofilter'].ref, 'A1:W5');
    for (const sheet of ['HUONG_DAN', 'PROMPT_CHATGPT', 'LOAI_CAU_HOI', 'VI_DU_ONE_WORD_ONLY', 'VI_DU_MULTIPLE_ANSWERS']) {
        assert.ok(book.Sheets[sheet], sheet);
    }
    assert.match(JSON.stringify(book.Sheets.HUONG_DAN.rows), /01:30/);
    assert.match(JSON.stringify(book.Sheets.PROMPT_CHATGPT.rows), /Video URL/);
    assert.equal(qa.parse(book).importedQuestionCount, 4);
});

test('a teacher fills video fields in the default template and uses the existing Import Excel action', async () => {
    const qa = harness(), {book} = qa.download();
    // Adding the URL automatically enables video, even if TEXT was left unchanged.
    info(book, 'Video URL', 'https://youtu.be/M7lc1UVf-VE');
    cue(book, 1, '01:30'); cue(book, 2, '02:30'); cue(book, 3, '03:30');
    qa.import(book);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(qa.saves.length, 1);
    assert.equal(qa.saves[0].status, 6);
    assert.equal(qa.state.comprehensiveContentMode, 'VIDEO');
    assert.equal(qa.state.videoDuration, 0);
    assert.equal(qa.state.savedBuilderVideoLink, null);
    assert.equal(qa.state.importingReadingTest, false);
    const part = qa.state.ieltsReadingTest.subQuestions[0];
    assert.equal(part.videoUrl, 'https://youtu.be/M7lc1UVf-VE');
    assert.equal(part.type, 1);
    const [single, gaps] = part.subQuestions;
    assert.deepEqual(Array.from(single.subQuestions, question => question.videoTimeSeconds), [90, 150]);
    assert.equal(gaps.videoTimeSeconds, 210);
    assert.equal(gaps.subQuestions[1].questionAnswers[0].answer.answer, 'Tuesday');
    assert.equal(gaps.subQuestions[1].questionAnswers[0].correct, true);
    assert.ok(!qa.messages.some(message => message.type === 'error'));
    assert.equal(qa.loading.count, 0);
    assert.equal(qa.state.ieltsReadingTest.id, 42);
});

test('video mode downloads the same full template with the current link and text timestamps', () => {
    const qa = harness({videoMode: true, link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173'});
    const {book, name} = qa.download();
    assert.equal(name, 'mau_import_bai_tap_tong_hop.xlsx');
    assert.equal(info(book, 'Loại nội dung'), 'VIDEO');
    assert.equal(info(book, 'Video URL'), qa.state.ieltsReadingTest.subQuestions[0].videoUrl);
    assert.equal(book.Sheets.NOI_DUNG.W2.t, 's');
    assert.equal(book.Sheets.NOI_DUNG.W2.z, '@');
    assert.equal(book.Sheets.NOI_DUNG.W2.v, '01:30');
    assert.equal(qa.parse(book).subQuestions[0].subQuestions[1].videoTimeSeconds, 210);
});

test('old text templates without video fields or the new column still import', () => {
    const qa = harness(), {book} = qa.download();
    book.Sheets.THONG_TIN.rows = book.Sheets.THONG_TIN.rows.filter(row => !['Video URL', 'Loại nội dung'].includes(row[0]));
    book.Sheets.NOI_DUNG.rows.forEach(row => row.pop());
    const imported = qa.parse(book);
    assert.equal(imported.importedQuestionCount, 4);
    assert.equal(imported.subQuestions[0].videoUrl, null);
    assert.equal(imported.subQuestions[0].subQuestions[0].subQuestions[0].videoTimeSeconds, null);
});

test('invalid or missing video cues stop the existing import before overwriting or saving a draft', () => {
    for (const value of ['', '01:75']) {
        const qa = harness({videoMode: true}), {book} = qa.download();
        const original = qa.state.ieltsReadingTest;
        cue(book, 1, value);
        qa.import(book);
        assert.equal(qa.state.ieltsReadingTest, original);
        assert.equal(qa.saves.length, 0);
        assert.match(qa.messages.at(-1).message, /Mốc video/);
        assert.equal(qa.state.importingReadingTest, false);
    }
    const qa = harness({videoMode: true}), {book} = qa.download();
    cue(book, 4, '03:40');
    assert.throws(() => qa.parse(book), /cùng Mốc video/);
    cue(book, 4, ''); cue(book, 1, '00:00');
    assert.equal(qa.parse(book).subQuestions[0].subQuestions[0].subQuestions[0].videoTimeSeconds, 0);
});

test('Reading and Listening keep their existing templates and import their examples', () => {
    for (const mode of ['reading', 'listening']) {
        const qa = harness({mode}), {book, name} = qa.download();
        assert.equal(name, 'mau_import_ielts_' + mode + '.xlsx');
        assert.equal(book.Sheets.NOI_DUNG.rows[0].length, 22);
        for (const row of book.Sheets.NOI_DUNG.rows) { assert.equal(row.length, 22, mode + ': example columns align with headers'); }
        assert.ok(!book.Sheets.THONG_TIN.rows.some(row => row[0] === 'Video URL'));
        const imported = qa.parse(book);
        assert.equal(imported.subQuestions.length, mode === 'reading' ? 3 : 4);
        assert.equal(imported.importedQuestionCount, mode === 'reading' ? 6 : 8);
    }
});

function fiftyVideoQuestions(qa) {
    const {book} = qa.download();
    qa.messages.length = 0;
    info(book, 'Loại nội dung', 'VIDEO');
    info(book, 'Video URL', 'https://youtu.be/M7lc1UVf-VE');
    const header = book.Sheets.NOI_DUNG.rows[0];
    book.Sheets.NOI_DUNG.rows = [header, ...Array.from({length: 50}, (_, index) => {
        const row = Array(header.length).fill('');
        const set = (name, value) => { row[header.indexOf(name)] = value; };
        set('Part', 1); set('Nhóm', 1); set('Loại câu hỏi', 1); set('Số câu', index + 1);
        set('Nội dung câu hỏi', 'Video question ' + (index + 1));
        for (let answer = 1; answer <= 4; answer++) { set('Đáp án ' + answer, 'Choice ' + answer); }
        set('Đáp án đúng', 'B');
        const seconds = index * 5;
        set('Mốc video', String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
        return row;
    })];
    return book;
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const importedQuestions = qa => qa.state.ieltsReadingTest.subQuestions[0].subQuestions[0].subQuestions;

test('import waits for the save response, prevents duplicate saves and confirms all 50 video questions only after receiving an id', async () => {
    let confirm;
    const qa = harness({savePending: new Promise(resolve => { confirm = resolve; })});
    const book = fiftyVideoQuestions(qa);
    qa.import(book);
    await flush();
    assert.equal(qa.saves.length, 1);
    assert.equal(importedQuestions(qa).length, 50);
    assert.equal(qa.state.importingReadingTest, true);
    assert.equal(qa.state.savingReadingTest, true);
    assert.equal(qa.loading.count, 1);
    assert.ok(!qa.messages.some(message => message.type === 'success'));
    qa.import(book); qa.state.saveReadingTest('draft');
    assert.equal(qa.saves.length, 1);
    confirm(Object.assign(structuredClone(qa.saves[0].test), {id: 123}));
    await flush();
    assert.equal(qa.state.ieltsReadingTest.id, 123);
    assert.equal(importedQuestions(qa).length, 50);
    assert.match(qa.messages.at(-1).message, /Đã import và lưu bản nháp 50 câu/);
    assert.equal(qa.state.importingReadingTest, false);
    assert.equal(qa.state.savingReadingTest, false);
    assert.equal(qa.loading.count, 0);
});

test('failed saves and responses without a saved id preserve 50 questions and clear both spinners without claiming success', async () => {
    for (const scenario of [
        {saveFailure: {status: 409, data: {message: 'Lỗi cơ sở dữ liệu thử nghiệm'}}, expected: /HTTP 409.*Lỗi cơ sở dữ liệu thử nghiệm/},
        {saveFailure: {status: 403}, expected: /không có quyền/},
        {saveFailure: {status: -1, xhrStatus: 'timeout'}, expected: /chưa xác nhận/},
        {saveResponse: {}, expected: /không trả về mã bài/}
    ]) {
        const qa = harness(scenario);
        qa.import(fiftyVideoQuestions(qa));
        await flush();
        assert.equal(importedQuestions(qa).length, 50);
        assert.equal(importedQuestions(qa)[49].videoTimeSeconds, 245);
        assert.equal(qa.state.ieltsReadingTest.id, undefined);
        assert.equal(qa.saves.length, 1);
        assert.equal(qa.state.importingReadingTest, false);
        assert.equal(qa.state.savingReadingTest, false);
        assert.equal(qa.loading.count, 0);
        assert.match(qa.state.importError, scenario.expected);
        assert.ok(!qa.messages.some(message => message.type === 'success'));
    }
});

test('malformed ChatGPT spreadsheets are rejected with an actionable column or row before replacing the builder', () => {
    const cases = [
        {change: rows => { rows[0][5] = 'Question No.'; }, error: /thiếu cột "Số câu"/},
        {change: rows => { rows[0][8] = rows[0][7]; }, error: /tiêu đề cột bị lặp/},
        {change: rows => { rows[1][5] = '1.5'; }, error: /Dòng 2: Số câu phải là số nguyên/},
        {change: rows => { rows[1][5] = ''; }, error: /Dòng 2:.*thiếu Số câu/},
        {change: rows => { rows[2][3] = 11; }, error: /Dòng 3: các câu trong cùng Nhóm/},
        {change: rows => { rows[1][8] = ''; }, error: /Dòng 2: Đáp án 1–12 phải nhập liền/},
        {change: rows => { rows[1][6] = ''; }, error: /Dòng 2, câu 1: thiếu Nội dung/},
        {change: rows => { rows[1][20] = 'A,B'; }, error: /cần đúng một Đáp án đúng/},
        {change: rows => { rows[1][20] = '1abc'; }, error: /không khớp/},
        {change: rows => { rows[2][5] = 1; }, error: /bị thiếu hoặc lặp/}
    ];
    for (const {change, error} of cases) {
        const qa = harness(), book = fiftyVideoQuestions(qa), original = qa.state.ieltsReadingTest;
        change(book.Sheets.NOI_DUNG.rows);
        qa.import(book);
        assert.equal(qa.state.ieltsReadingTest, original);
        assert.equal(qa.saves.length, 0);
        assert.equal(qa.state.importingReadingTest, false);
        assert.match(qa.state.importError, error);
    }
});

test('gap counts, shared answer banks and Excel formula cells are checked before saving', () => {
    const gapQa = harness(), gapBook = gapQa.download().book;
    gapBook.Sheets.NOI_DUNG.rows[3][6] = 'One gap }{SPACE}{';
    assert.throws(() => gapQa.parse(gapBook), /có 1 ký hiệu.*cần đúng 2/);
    const sharedQa = harness({mode: 'listening'}), sharedBook = sharedQa.download().book;
    const sharedRows = sharedBook.Sheets.NOI_DUNG.rows.filter(row => row[5] === 11 || row[5] === 12);
    assert.ok(sharedRows.length > 1);
    sharedRows[1][7] = 'Different choice';
    assert.throws(() => sharedQa.parse(sharedBook), /danh sách lựa chọn phải giống/);
    const formulaQa = harness(), formulaBook = formulaQa.download().book;
    formulaBook.Sheets.NOI_DUNG.A2.f = '1+0';
    assert.throws(() => formulaQa.parse(formulaBook), /NOI_DUNG, ô A2.*không dùng công thức/);
});

test('QuestionService preserves the API error body and status and sets a bounded save timeout', async () => {
    const serviceSource = fs.readFileSync(path.join(__dirname, '../question/business/QuestionService.js'), 'utf8');
    const start = serviceSource.indexOf('        function saveObject(');
    const end = serviceSource.indexOf('        function updateTestStatus(', start);
    const requests = [], serverError = {status: 409, data: {message: 'Database save failed'}};
    const context = {angular: {isFunction: value => typeof value === 'function'}, baseUrl: '/api/', restUrl: 'question',
        $q: {reject: Promise.reject.bind(Promise)}, $http(request) { requests.push(request); return Promise.reject(serverError); }};
    vmModule.runInNewContext(serviceSource.slice(start, end), context);
    let callbackError;
    await assert.rejects(context.saveObject({title: 'Test'}, undefined, error => { callbackError = error; }), error => error === serverError);
    assert.equal(callbackError, serverError);
    assert.equal(requests[0].url, '/api/question/save');
    assert.equal(requests[0].timeout, 120000);
});
