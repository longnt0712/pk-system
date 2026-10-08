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

function harness({mode = 'comprehensive', videoMode = false, link = ''} = {}) {
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
        isVideoBuilder() { return this.isComprehensiveMode && videoMode; },
        ieltsReadingTest: {subQuestions: [{videoUrl: link}]},
        comprehensiveContentMode: 'TEXT', savedBuilderVideoLink: 'old link', builderVideoSeconds: 99, videoDuration: 999,
        getOrdinalNumber() {}, refreshBuilderValidation() {},
        saveReadingTest(status) { saves.push({status, test: this.ieltsReadingTest}); return Promise.resolve(); },
        matchingOptionLabel(index) { return String.fromCharCode(65 + index); }
    };
    const context = {
        angular, XLSX, video, vm: state, $window: {XLSX},
        toastr: Object.fromEntries(['error', 'warning', 'success'].map(type => [type, (message, title) => messages.push({type, message, title})])),
        $scope: {$applyAsync(callback) { callback(); }},
        isHavingQuestions() {},
        FileReader: class {readAsArrayBuffer(file) { this.onload({target: {result: file.workbook}}); }}
    };
    vmModule.createContext(context);
    vmModule.runInContext(['ensureComprehensiveBuilder', 'ensureWritingTaskPackage', 'ensureMultipleAnswerPackage',
        'plainText', 'isSharedChoicePackage', 'ensureSharedChoicePackage'].map(productionFunction).join('\n') + '\n' +
        section('        function readingQuestionType(', '        vm.status = {id: 3, name: "Tất cả (no listening)"};'), context);
    return {
        state, messages, saves,
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
    await Promise.resolve();
    assert.equal(qa.saves.length, 1);
    assert.equal(qa.saves[0].status, 'draft');
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
