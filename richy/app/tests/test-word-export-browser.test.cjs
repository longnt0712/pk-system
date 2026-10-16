const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const runtime = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const playwright = require(path.join(runtime, 'playwright'));
const JSZip = require(path.join(runtime, 'jszip'));
const app = path.join(__dirname, '..');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(file => fs.existsSync(file));
const origin = 'https://word-export.test';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKqQAAAAASUVORK5CYII=';

function answer(value, correct = false) {
    return {correct, clientAnswer: 'PRIVATE_STUDENT_RESPONSE', description: 'PRIVATE_ANSWER_EXPLANATION', answer: {answer: value, description: 'PRIVATE_ANSWER_DETAIL'}};
}

function question(stem, choices = ['RED_OPTION', 'BLUE_OPTION', 'GREEN_OPTION']) {
    return {question: stem, description: 'PRIVATE_QUESTION_EXPLANATION', correctAnswer: 'PRIVATE_CORRECT_KEY',
        questionAnswers: choices.map((value, index) => answer(value, index === 0))};
}

function part(packages, prompt = '<p>PASSAGE_CONTEXT Nội dung đọc hiểu.</p>') {
    return {question: prompt, motherTongue: prompt, subQuestions: packages};
}

function exam(packages) {
    return {id: 72513, question: 'Đề kiểm tra Tiếng Việt & English', title: 'Đề kiểm tra Tiếng Việt & English',
        description: 'PRIVATE_TEST_EXPLANATION', subQuestions: [part(packages)]};
}

function saveQa(name, result) {
    if (!process.env.WORD_EXPORT_QA_DIR) { return; }
    fs.mkdirSync(process.env.WORD_EXPORT_QA_DIR, {recursive: true});
    fs.writeFileSync(path.join(process.env.WORD_EXPORT_QA_DIR, name), Buffer.from(result.base64, 'base64'));
}

async function fixture(browser, {preload = true, modal = false, width = 1366} = {}) {
    const page = await browser.newPage({acceptDownloads: true, viewport: {width, height: 900}});
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { return route.abort(); }
        if (url.pathname === '/') { return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="qa"></main></body></html>'}); }
        const file = path.resolve(app, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(path.resolve(app) + path.sep) || !fs.existsSync(file)) { return route.fulfill({status: 404, body: 'Missing fixture asset'}); }
        return route.fulfill({contentType: /\.js$/.test(file) ? 'text/javascript' : /\.css$/.test(file) ? 'text/css' : 'text/html', body: fs.readFileSync(file)});
    });
    await page.goto(origin);
    if (modal) {
        await page.addStyleTag({path: path.join(app, 'assets/css/external/bootstrap.min.css')});
        await page.addStyleTag({content: 'body{font-family:Arial,sans-serif;background:#f5f6fc}.modal-backdrop{opacity:.5}.modal-dialog{margin-top:60px}.modal-title{font-size:22px}'});
    }
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    if (modal) { await page.addScriptTag({path: path.join(app, 'assets/scripts/external/ui-bootstrap-tpls.min.js')}); }
    await page.evaluate(({modal}) => {
        const module = angular.module('Hrm.Question', modal ? ['ui.bootstrap'] : []);
        if (!modal) { module.value('$uibModal', {}); }
        window.APP_VERSION = 'word-export-test';
    }, {modal});
    for (const name of ['ComprehensiveVideo', 'ComprehensiveListening', 'TestWordExport']) {
        await page.addScriptTag({path: path.join(app, 'question/business/' + name + '.js')});
    }
    if (preload) { await page.addScriptTag({path: path.join(app, 'assets/scripts/external/docx-9.6.1.js')}); }
    await page.evaluate(() => {
        angular.bootstrap(document.getElementById('qa'), ['Hrm.Question']);
        window.qaExport = angular.element(document.getElementById('qa')).injector().get('TestWordExport');
    });
    return {page, errors};
}

async function build(page, data, options = {}) {
    const result = await page.evaluate(async ({data, options}) => {
        const before = JSON.stringify(data);
        // Fisher–Yates still runs in production; a stable random stream makes
        // the assertions about the resulting permutation deterministic.
        const originalRandom = Math.random;
        Math.random = () => 0;
        try {
            const result = await window.qaExport.build(data, options);
            const bytes = new Uint8Array(await result.blob.arrayBuffer());
            let binary = '';
            bytes.forEach(byte => { binary += String.fromCharCode(byte); });
            return {base64: btoa(binary), filename: result.filename, questionCount: result.questionCount,
                warnings: result.warnings, unchanged: before === JSON.stringify(data), type: result.blob.type};
        } finally { Math.random = originalRandom; }
    }, {data, options});
    const zip = await JSZip.loadAsync(Buffer.from(result.base64, 'base64'));
    const xml = await zip.file('word/document.xml').async('string');
    const paragraphs = await page.evaluate(xml => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) { throw Error('Exported document.xml is invalid XML'); }
        return Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'), paragraph =>
            Array.from(paragraph.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't'), run => run.textContent).join(''));
    }, xml);
    return {...result, zip, xml, paragraphs, text: paragraphs.join('\n')};
}

test('Word export packages genuine OOXML and includes prompts/options for supported question schemas without solutions or learner responses', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        const packages = [1, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15].map(type => ({type,
            question: 'INSTRUCTIONS_TYPE_' + type, motherTongue: type === 9 ? '<p>MAP_PROMPT</p>' : '',
            subQuestions: [question('STEM_TYPE_' + type, ['CHOICE_' + type + '_FIRST', 'CHOICE_' + type + '_SECOND', 'CHOICE_' + type + '_THIRD'])]}));
        for (const type of [2, 3, 11, 13]) {
            packages.push({type, question: 'INSTRUCTIONS_TYPE_' + type, motherTongue: '<p>GAP_TYPE_' + type + ' }{SPACE}{ and }{SPACE}{.</p>',
                subQuestions: [question('<p>GAP_TYPE_' + type + ' }{SPACE}{' + (type >= 11 ? ' and }{SPACE}{.' : '.') + '</p>', ['PRIVATE_GAP_SOLUTION_' + type + '_FIRST / PRIVATE_ACCEPTED_ALTERNATIVE']),
                    question(type >= 11 ? '' : 'GAP_STEM_' + type + '_SECOND }{SPACE}{', ['PRIVATE_GAP_SOLUTION_' + type + '_SECOND'])]});
        }
        // Type 13 is a word bank exercise: the options themselves remain part
        // of the question, but no mapping from gap to correct option may leak.
        packages.find(pack => pack.type === 13).subQuestions.forEach(item => {
            item.questionAnswers = [answer('WORD_BANK_OPTION_0'), answer('WORD_BANK_OPTION_1'), answer('WORD_BANK_DISTRACTOR')];
        });
        packages.push({type: 16, question: '<p>WRITING_PROMPT_ONE Describe the chart.</p>', motherTongue: '',
            description: 'PRIVATE_WRITING_SAMPLE_ONE', subQuestions: [question('', ['PRIVATE_WRITING_RESPONSE_ONE'])]});
        packages.push({type: 17, question: '<p>WRITING_PROMPT_TWO Discuss both views.</p>', motherTongue: '',
            description: 'PRIVATE_WRITING_SAMPLE_TWO', subQuestions: [question('', ['PRIVATE_WRITING_RESPONSE_TWO'])]});
        const result = await build(page, exam(packages), {testMode: 'COMPREHENSIVE', shuffle: false});
        for (const file of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']) { assert.ok(result.zip.file(file), file); }
        const styleIds = await page.evaluate(xml => {
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            return Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'style'), style =>
                style.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'styleId'));
        }, await result.zip.file('word/styles.xml').async('string'));
        assert.equal(new Set(styleIds).size, styleIds.length, 'Word paragraph/character style IDs must be unique');
        assert.match(result.filename, /\.docx$/i);
        assert.equal(result.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        assert.equal(result.unchanged, true);
        assert.match(result.text, /Đề kiểm tra Tiếng Việt & English/);
        assert.match(result.text, /PASSAGE_CONTEXT/);
        for (const type of [1, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15]) {
            assert.match(result.text, new RegExp('STEM_TYPE_' + type + '\\b'));
            for (const option of ['FIRST', 'SECOND', 'THIRD']) { assert.ok(result.text.includes('CHOICE_' + type + '_' + option), 'Choice for type ' + type); }
        }
        for (const type of [2, 3, 11, 13]) { assert.match(result.text, new RegExp('GAP_TYPE_' + type + '\\b')); }
        for (const marker of ['WRITING_PROMPT_ONE', 'WRITING_PROMPT_TWO', 'WORD_BANK_OPTION_0', 'WORD_BANK_OPTION_1']) { assert.ok(result.text.includes(marker), marker); }
        assert.doesNotMatch(result.text, /PRIVATE_|\}\{SPACE\}\{|\}\{HEADING\}\{/);
        saveQa('supported-question-types.docx', result);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('keeping order preserves question/option order; shuffling changes both and preserves shared groups without mutating source', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        const data = exam([
            {type: 1, question: 'CHOICE_GROUP', subQuestions: ['ALFA', 'BRAVO', 'CHARLIE'].map(stem => question('STEM_' + stem,
                ['OPTION_' + stem + '_RED', 'OPTION_' + stem + '_BLUE', 'OPTION_' + stem + '_GREEN']))},
            {type: 14, question: 'SHARED_ENDINGS', motherTongue: '<p>SHARED_CONTEXT</p>', subQuestions: ['FIRST', 'SECOND', 'THIRD'].map(stem =>
                question('ENDING_STEM_' + stem + ' }{HEADING}{', ['BANK_END_RED', 'BANK_END_BLUE', 'BANK_END_GREEN']))},
            {type: 11, question: 'LINKED_GAP_TASK', motherTongue: '<p>LINKED_START }{SPACE}{ LINKED_MIDDLE }{SPACE}{ LINKED_FINISH.</p>',
                subQuestions: [question('<p>LINKED_START }{SPACE}{ LINKED_MIDDLE }{SPACE}{ LINKED_FINISH.</p>', ['PRIVATE_GAP_ONE']), question('', ['PRIVATE_GAP_TWO'])]}
        ]);
        data.subQuestions[0].videoUrl = 'https://youtu.be/M7lc1UVf-VE';
        data.subQuestions[0].subQuestions[0].subQuestions[0].videoTimeSeconds = 90;
        const original = await build(page, data, {testMode: 'READING', shuffle: false});
        const shuffled = await build(page, data, {testMode: 'READING', shuffle: true});
        for (const result of [original, shuffled]) {
            assert.equal(result.unchanged, true);
            assert.equal(result.questionCount, 8);
            assert.doesNotMatch(result.text, /PRIVATE_|\}\{SPACE\}\{|\}\{HEADING\}\{/);
            assert.match(result.text, /https:\/\/youtu\.be\/M7lc1UVf-VE/);
            assert.match(result.text, /\[1:30\] STEM_ALFA/);
            for (const marker of ['STEM_ALFA', 'STEM_BRAVO', 'STEM_CHARLIE', 'ENDING_STEM_FIRST', 'ENDING_STEM_SECOND', 'ENDING_STEM_THIRD']) {
                assert.equal(result.text.split(marker).length - 1, 1, marker + ' exported once');
            }
            for (const marker of ['BANK_END_RED', 'BANK_END_BLUE', 'BANK_END_GREEN']) {
                assert.equal(result.text.split(marker).length - 1, 1, marker + ' exported in a single shared bank');
            }
            assert.ok(result.text.indexOf('LINKED_START') < result.text.indexOf('LINKED_MIDDLE'));
            assert.ok(result.text.indexOf('LINKED_MIDDLE') < result.text.indexOf('LINKED_FINISH'));
        }
        assert.ok(original.text.indexOf('STEM_ALFA') < original.text.indexOf('STEM_BRAVO'));
        assert.ok(original.text.indexOf('STEM_BRAVO') < original.text.indexOf('STEM_CHARLIE'));
        assert.ok(original.text.indexOf('OPTION_ALFA_RED') < original.text.indexOf('OPTION_ALFA_BLUE'));
        const order = result => result.paragraphs.filter(line => /STEM_(ALFA|BRAVO|CHARLIE)\b/.test(line)).map(line => line.match(/STEM_\w+/)[0]);
        assert.notDeepEqual(order(shuffled), order(original));
        assert.ok(shuffled.text.indexOf('OPTION_ALFA_BLUE') < shuffled.text.indexOf('OPTION_ALFA_RED'));
        const alphaChoices = shuffled.paragraphs.filter(line => /OPTION_ALFA_/.test(line));
        assert.match(alphaChoices[0], /A[.)]?\s*OPTION_ALFA_BLUE/);
        assert.match(alphaChoices[1], /B[.)]?\s*OPTION_ALFA_GREEN/);
        assert.match(alphaChoices[2], /C[.)]?\s*OPTION_ALFA_RED/);
        assert.deepEqual(errors, []);
        saveQa('shuffled-grouped-test.docx', shuffled);
    } finally { await browser.close(); }
});

test('rich text and Unicode survive as editable Word text, genuine tables and embedded images', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        const data = exam([{type: 1, question: '<p>Chọn <strong>phương án</strong> &amp; giữ <em>định dạng</em>.</p>' +
                '<table><tr><th>Tiêu đề</th><th>Giá trị</th></tr><tr><td>Hà Nội</td><td>42</td></tr></table>' +
                '<p><img src="data:image/png;base64,' + png + '" alt="Sơ đồ minh họa" width="160" height="120"></p>' +
                '<script>PRIVATE_SCRIPT_PAYLOAD</script><style>PRIVATE_STYLE_PAYLOAD</style>',
            subQuestions: [question('<p>UNICODE_STEM Nguyễn Ánh — café</p>', ['Đỏ', 'Xanh', 'Vàng'])]}]);
        const result = await build(page, data, {testMode: 'LISTENING', shuffle: false});
        assert.match(result.text, /Chọn phương án & giữ định dạng/);
        assert.match(result.text, /Nguyễn Ánh — café/);
        assert.match(result.text, /Hà Nội/);
        assert.match(result.xml, /<w:b(?:\s|\/|>)/);
        assert.match(result.xml, /<w:i(?:\s|\/|>)/);
        assert.match(result.xml, /<w:tbl>/);
        assert.match(result.xml, /<w:drawing>/);
        const media = Object.keys(result.zip.files).filter(file => /^word\/media\/.*\.png$/i.test(file));
        assert.equal(media.length, 1);
        assert.ok((await result.zip.file(media[0]).async('uint8array')).length > 0);
        assert.doesNotMatch(result.text, /PRIVATE_|<script|<style/);
        assert.equal(result.unchanged, true);
        assert.deepEqual(errors, []);
        saveQa('rich-content.docx', result);
    } finally { await browser.close(); }
});

test('standalone and integrated Daily Listening export numbered gaps and media link without exposing the complete transcript', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        const transcript = 'We hear 101 202 303 404 505.';
        const mediaUrl = origin + '/lesson.mp3';
        const cases = [
            {data: {id: 42, question: 'Daily Listening kiểm tra', testFormat: 'DAILY_LISTENING', questionType: {id: 11},
                motherTongue: transcript, pronounce: mediaUrl, questionAnswers: []}, mode: 'DAILY_LISTENING'},
            {data: exam([{type: 18, question: 'DAILY_PACKAGE_PROMPT', motherTongue: transcript, pronounce: mediaUrl,
                subQuestions: [question('', ['DAILY_LISTENING_RESPONSE'])]}]), mode: 'COMPREHENSIVE'}
        ];
        for (const {data, mode} of cases) {
            const result = await build(page, data, {testMode: mode, shuffle: false});
            assert.ok(result.questionCount >= 5);
            assert.match(result.text, /_{3,}/);
            assert.doesNotMatch(result.text, /101|202|303|404|505|DAILY_LISTENING_RESPONSE|PRIVATE_/);
            assert.ok(result.text.includes(mediaUrl) || (await result.zip.file('word/_rels/document.xml.rels').async('string')).includes(mediaUrl));
            assert.equal(result.unchanged, true);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('Word generator loads its pinned local library on demand', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser, {preload: false});
        assert.equal(await page.evaluate(() => typeof window.docx), 'undefined');
        const result = await build(page, exam([{type: 1, question: 'LOCAL_LIBRARY', subQuestions: [question('ON_DEMAND_STEM')]}]), {testMode: 'READING'});
        assert.match(result.text, /ON_DEMAND_STEM/);
        assert.equal(await page.evaluate(() => typeof window.docx.Document), 'function');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real export dialog defaults to original order and downloads a shuffled Word file on desktop and mobile', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const width of [1366, 390]) {
            const {page, errors} = await fixture(browser, {preload: false, modal: true, width});
            const data = exam([{type: 1, question: 'DIALOG_INSTRUCTIONS', subQuestions: [question('DIALOG_STEM_FIRST'), question('DIALOG_STEM_SECOND')]}]);
            await page.evaluate(data => {
                window.qaSource = data;
                window.qaOriginal = JSON.stringify(data);
                Math.random = () => 0;
                window.qaExport.open(data, {testMode: 'READING'}).catch(() => {});
            }, data);
            await page.getByRole('heading', {name: 'Xuất bài test ra Word'}).waitFor();
            assert.equal(await page.getByRole('radio', {name: 'Giữ thứ tự gốc'}).isChecked(), true);
            await page.getByRole('radio', {name: 'Xáo câu hỏi và các phương án trả lời'}).check();
            const bounds = await page.locator('.modal-dialog').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'dialog fits viewport');
            if (process.env.WORD_EXPORT_QA_DIR) {
                fs.mkdirSync(process.env.WORD_EXPORT_QA_DIR, {recursive: true});
                await page.screenshot({path: path.join(process.env.WORD_EXPORT_QA_DIR, 'export-dialog-' + width + '.png'), fullPage: true});
            }
            const pendingDownload = page.waitForEvent('download');
            await page.getByRole('button', {name: 'Tải file Word', exact: true}).click();
            const download = await pendingDownload;
            assert.match(download.suggestedFilename(), /-xao-tron\.docx$/);
            assert.equal(await download.failure(), null);
            const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
            const xml = await zip.file('word/document.xml').async('string');
            assert.ok(xml.indexOf('DIALOG_STEM_SECOND') < xml.indexOf('DIALOG_STEM_FIRST'));
            assert.ok(xml.indexOf('BLUE_OPTION') < xml.indexOf('RED_OPTION'));
            assert.doesNotMatch(xml, /PRIVATE_/);
            assert.equal(await page.evaluate(() => JSON.stringify(window.qaSource) === window.qaOriginal), true);
            await page.getByRole('heading', {name: 'Xuất bài test ra Word'}).waitFor({state: 'hidden'});
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('unsupported packages stop the export with an actionable error instead of producing a partial test', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page} = await fixture(browser);
        const data = exam([{type: 1, question: 'SUPPORTED_TASK', subQuestions: [question('SUPPORTED_STEM')]},
            {type: 99, question: 'UNKNOWN_TASK', subQuestions: [question('UNKNOWN_STEM')]}]);
        const result = await page.evaluate(async data => {
            const before = JSON.stringify(data);
            try { await window.qaExport.build(data, {testMode: 'COMPREHENSIVE'}); return {exported: true}; }
            catch (error) { return {exported: false, message: error.message, unchanged: before === JSON.stringify(data)}; }
        }, data);
        assert.equal(result.exported, false);
        assert.match(result.message, /99/);
        assert.equal(result.unchanged, true);
    } finally { await browser.close(); }
});

test('missing illustrations require a visible warning and explicit confirmation before downloading an incomplete Word file', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser, {modal: true});
        const data = exam([{type: 1, question: '<p>ILLUSTRATION_CONTEXT</p><img src="/missing-illustration.png" alt="Bản đồ cần bổ sung">',
            subQuestions: [question('ILLUSTRATION_STEM')]}]);
        let downloads = 0;
        page.on('download', () => { downloads++; });
        await page.evaluate(data => { window.qaExport.open(data, {testMode: 'READING'}).catch(() => {}); }, data);
        await page.getByRole('button', {name: 'Tải file Word', exact: true}).click();
        await page.getByText('Không tải được một số hình ảnh. File có ghi vị trí hình cần bổ sung.', {exact: true}).waitFor();
        assert.equal(downloads, 0);
        const pendingDownload = page.waitForEvent('download');
        await page.getByRole('button', {name: 'Tải file và bổ sung hình sau'}).click();
        const download = await pendingDownload;
        assert.equal(await download.failure(), null);
        const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
        const xml = await zip.file('word/document.xml').async('string');
        assert.match(xml, /Bản đồ cần bổ sung/);
        assert.match(xml, /ILLUSTRATION_STEM/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('legacy listening retains its audio link and case/whitespace gap markers become numbered blanks', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        const data = exam([
            {type: 4, question: 'MATCH_THE_HEADINGS', subQuestions: [question('HEADING_STEM', ['HEADING_OPTION_RED', 'HEADING_OPTION_BLUE'])]},
            {type: 11, question: 'COMPLETE_THE_TEXT', subQuestions: [question('<p>VARIANT_GAP }{ space }{ end.</p>', ['PRIVATE_GAP_SOLUTION'])]},
            {type: 18, question: 'LEGACY_LISTENING', pronounce: origin + '/legacy-listening.mp3',
                subQuestions: [question('<p>LEGACY_TRANSCRIPT }{ SpAcE }{ ending.</p>', ['PRIVATE_LEGACY_SOLUTION'])]}
        ]);
        data.subQuestions[0].question = '<p>PASSAGE_BODY }{ HEADING }{ passage end.</p>';
        const result = await build(page, data, {testMode: 'READING', shuffle: false});
        assert.equal(result.questionCount, 3);
        assert.match(result.text, /PASSAGE_BODY \(1\) ____________ passage end/);
        assert.match(result.text, /VARIANT_GAP \(2\) ____________ end/);
        assert.match(result.text, /LEGACY_TRANSCRIPT \(3\) ____________ ending/);
        assert.ok(result.text.includes(origin + '/legacy-listening.mp3'));
        assert.doesNotMatch(result.text, /\}\{\s*(?:SPACE|HEADING)\s*\}\{|PRIVATE_/i);
        assert.equal(result.unchanged, true);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('a failed browser save keeps the export dialog open and allows retry for complete and missing-image files', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        for (const missingImage of [false, true]) {
            const {page, errors} = await fixture(browser, {modal: true});
            const data = exam([{type: 1, question: '<p>SAVE_RETRY_CONTEXT</p>' + (missingImage ? '<img src="/missing-retry.png" alt="Retry map">' : ''),
                subQuestions: [question('SAVE_RETRY_STEM')]}]);
            await page.evaluate(data => {
                window.qaSaveCalls = 0;
                window.saveAs = (blob, filename) => {
                    window.qaSaveCalls++;
                    if (window.qaSaveCalls === 1) { throw Error('Fixture blocked download'); }
                    window.qaSaved = {filename, size: blob.size, type: blob.type};
                };
                window.qaExport.open(data, {testMode: 'READING'}).catch(() => {});
            }, data);
            await page.getByRole('button', {name: 'Tải file Word', exact: true}).click();
            if (missingImage) { await page.getByRole('button', {name: 'Tải file và bổ sung hình sau'}).click(); }
            await page.getByText('Chưa tải được file Word. Vui lòng cho phép tải file rồi thử lại.', {exact: true}).waitFor();
            assert.equal(await page.getByRole('heading', {name: 'Xuất bài test ra Word'}).isVisible(), true);
            assert.equal(await page.getByRole('radio', {name: 'Giữ thứ tự gốc'}).isEnabled(), true);
            assert.equal(await page.evaluate(() => window.qaSaveCalls), 1);
            await page.getByRole('button', {name: missingImage ? 'Tải file và bổ sung hình sau' : 'Tải file Word', exact: true}).click();
            await page.getByRole('heading', {name: 'Xuất bài test ra Word'}).waitFor({state: 'hidden'});
            const saved = await page.evaluate(() => ({...window.qaSaved, calls: window.qaSaveCalls}));
            assert.equal(saved.calls, 2);
            assert.match(saved.filename, /\.docx$/);
            assert.ok(saved.size > 0);
            assert.equal(saved.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('candidate-hidden listening transcripts, writing references, hidden parts and video references are excluded from Word', async () => {
    const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
    try {
        const {page, errors} = await fixture(browser);
        for (const scenario of [
            {mode: 'LISTENING'},
            {mode: 'WRITING'},
            {mode: 'READING', hiddenPart: true},
            {mode: 'COMPREHENSIVE', video: true}
        ]) {
            const writing = scenario.mode === 'WRITING';
            const data = exam([writing ? {type: 16, question: '<p>VISIBLE_WRITING_PROMPT Describe the chart.</p>',
                description: 'PRIVATE_WRITING_MODEL', subQuestions: [question('', ['PRIVATE_WRITING_RESPONSE'])]}
                : {type: 1, question: 'VISIBLE_PACKAGE_INSTRUCTIONS', subQuestions: [question('VISIBLE_QUESTION_STEM')]}]);
            const passage = data.subQuestions[0];
            passage.question = '<p>PRIVATE_HIDDEN_TRANSCRIPT_OR_REFERENCE</p>';
            passage.motherTongue = 'PRIVATE_HIDDEN_TRANSCRIPT_OR_REFERENCE';
            if (scenario.hiddenPart) { passage.type = 6; }
            if (scenario.video) { passage.videoUrl = 'https://youtu.be/M7lc1UVf-VE'; }
            const result = await build(page, data, {testMode: scenario.mode, shuffle: false});
            assert.ok(result.text.includes(writing ? 'VISIBLE_WRITING_PROMPT' : 'VISIBLE_QUESTION_STEM'), scenario.mode);
            assert.doesNotMatch(result.text, /PRIVATE_/);
            assert.equal(result.unchanged, true);
        }
        const visible = exam([{type: 1, question: 'READING_INSTRUCTIONS', subQuestions: [question('READING_QUESTION')]}]);
        visible.subQuestions[0].question = '<p>VISIBLE_READING_PASSAGE for a normal Reading part.</p>';
        const result = await build(page, visible, {testMode: 'READING', shuffle: false});
        assert.match(result.text, /VISIBLE_READING_PASSAGE/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
