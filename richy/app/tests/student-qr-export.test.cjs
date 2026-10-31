// Browser integration: set STUDENT_QR_XLSX_PATH to the SheetJS 0.18.5 bundle used by index.html.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const nodeVm = require('node:vm');
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const source = read('users/controllers/UserController.js');
function section(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a); return source.slice(a, b);
}
const exportCode = section('        vm.exportColumns = [', '        function exportImageEscapeHtml');
const qrCode = section('        // URL logo', '        vm.photoPreviewUser =');

function setup({ielts = false, users, fail = false} = {}) {
    const data = users || [{username: '000017', person: {firstName: 'An'}}, {username: 'gl20240034', person: {firstName: 'Bình'}}];
    const calls = {qr: [], workbook: [], download: [], warnings: [], errors: [], closed: 0, text: []};
    const vm = {isIeltsRoomDomain: ielts, logoUrl: '/assets/images/logo-xu-doan.png', getDisplayedUsers: () => data,
        getEnrollmentClassNames: () => 'Ấu Nhi', getTnttMemberTypeName: () => '', getTnttBranchName: () => '', getTnttLevelName: () => '',
        modalInstance: {close() {calls.closed++;}}};
    const context = {vm, angular: {forEach: (items, callback) => items.forEach(callback)},
        moment: () => ({format: () => '20261031_120000'}), $q: {when: value => Promise.resolve(value)},
        $timeout: callback => Promise.resolve().then(callback),
        generateQrPro(code, logo, options) {calls.qr.push({code, logo, options}); return fail ? Promise.reject(Error('QR unavailable')) : Promise.resolve('data:image/png;base64,TEST');},
        toastr: {success() {}, warning: message => calls.warnings.push(message), error: message => calls.errors.push(message)},
        XLSX: {utils: {json_to_sheet: rows => ({rows}), book_new: () => ({}), book_append_sheet: (book, sheet) => {book.sheet = sheet;}},
            writeFile: (...args) => calls.text.push(args)},
        window: {StudentQrWorkbook: {withImages(bookApi, book, images) {calls.workbook.push({book, images}); return 'bytes';}, download: (...args) => calls.download.push(args)}}};
    nodeVm.runInNewContext(exportCode, context);
    return {vm, data, calls, context};
}

test('student QR encodes the exact username locally without requesting a flower token', async () => {
    const h = setup(); h.context.settings = {campaignsEnabled: true};
    h.context.service = {getStudentQr() {throw Error('Flower tokens must not be requested');}};
    h.context.$ = () => ({modal() {}});
    nodeVm.runInNewContext(section('        vm.zoomPerson = {};', '        vm.photoPreviewUser ='), h.context);
    await h.vm.showStudentQr(h.data[0]);
    assert.equal(h.calls.qr[0].code, '000017'); assert.equal(h.calls.qr[0].options.paddingBottom, 0);
    assert.equal(h.calls.qr[0].options.qrSize, 1024); assert.equal(h.calls.qr[0].options.margin, 4);
    assert.equal(h.vm.currentQrCode, '000017'); assert.equal(h.vm.studentQrLoading, false);
});

test('Excel has an independent QR column in displayed order, keeps codes as text and prevents duplicate exports', async () => {
    const h = setup({users: [{username: 'gl20240034', person: {}}, {person: {}}, {username: '000017', person: {}}]});
    const before = JSON.stringify(h.data), qr = h.vm.exportColumns.find(col => col.key === 'qrImage');
    assert.equal(qr.checked, true);
    h.vm.exportColumns = [h.vm.exportColumns[0], qr, h.vm.exportColumns.find(col => col.key === 'username')];
    const pending = h.vm.exportStudentsToExcel();
    assert.equal(h.vm.exportExcelBusy, true); assert.equal(h.vm.exportStudentsToExcel(), undefined);
    await pending;
    const {book, images} = h.calls.workbook[0];
    assert.deepEqual(book.sheet.rows.map(row => row['MÃ HỌC SINH']), ['gl20240034', '', '000017']);
    assert.deepEqual(book.sheet.rows.map(row => row['ẢNH QR']), ['', '', '']);
    assert.deepEqual(Array.from(images, item => [item.row, item.col]), [[1, 1], [3, 1]]);
    assert.equal(book.sheet['!rows'][1].hpt, 70.5);
    assert.equal(h.calls.download.length, 1); assert.equal(h.calls.closed, 1);
    assert.match(h.calls.warnings[0], /1 học sinh chưa có mã/);
    assert.equal(h.vm.exportExcelBusy, false); assert.equal(JSON.stringify(h.data), before);
});

test('QR failure leaves the dialog open with no partial download; removing QR keeps the ordinary export', async () => {
    const h = setup({fail: true}); await h.vm.exportStudentsToExcel();
    assert.equal(h.calls.download.length, 0); assert.equal(h.calls.closed, 0);
    assert.equal(h.calls.errors.length, 1); assert.equal(h.vm.exportExcelBusy, false);
    h.vm.exportColumns.find(col => col.key === 'qrImage').checked = false;
    await h.vm.exportStudentsToExcel(); assert.equal(h.calls.text.length, 1);
    h.vm.exportMode = 'image'; h.vm.exportColumns.find(col => col.key === 'qrImage').checked = true;
    assert.equal(h.vm.getSelectedExportColumns().some(col => col.isImage), false);
    assert.equal(setup({ielts: true}).vm.exportColumns.some(col => col.isImage), false);
});

test('empty exports do not download a file', async () => {
    const h = setup({users: []}); await h.vm.exportStudentsToExcel();
    assert.equal(h.calls.download.length, 0); assert.equal(h.calls.text.length, 0); assert.equal(h.calls.warnings.length, 1);
});

const xlsxPath = process.env.STUDENT_QR_XLSX_PATH;
test('real Excel downloads embed decodable student-code PNGs in separate cells like the reference',
    {skip: !xlsxPath && 'Set STUDENT_QR_XLSX_PATH for real SheetJS/browser integration', timeout: 90000}, async () => {
    const runtime = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
    const {chromium} = require(path.join(runtime, 'playwright')), JSZip = require(path.join(runtime, 'jszip'));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const downloadsPath = path.resolve(app, '../../.tmp/student-qr-downloads');
    fs.mkdirSync(downloadsPath, {recursive: true});
    const browser = await chromium.launch({headless: true, executablePath: chrome, downloadsPath});
    const view = read('users/views/users.html'), modal = view.match(/<script type="text\/ng-template" id="export_excel_modal.html">[\s\S]*?<\/script>/)[0];
    const qrModal = view.slice(view.indexOf('<div id="qrModal"'), view.indexOf('<div id="photoPreviewModal"'));
    try {
        for (const width of [1366, 390]) {
            const page = await browser.newPage({acceptDownloads: true, viewport: {width, height: 900}}), errors = [], requests = [];
            page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const request = route.request(), url = new URL(request.url()); requests.push(url.pathname);
                if (url.pathname.includes('/service/') || request.method() !== 'GET') { throw Error('Unexpected student API request'); }
                const local = path.join(app, url.pathname.replace(/^\//, ''));
                return fs.existsSync(local) && fs.statSync(local).isFile() ? route.fulfill({path: local}) : route.fulfill({body: '<html></html>', contentType: 'text/html'});
            });
            await page.goto('https://student-qr.test');
            await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>' +
                read('assets/css/external/bootstrap.min.css') + '</style></head><body><main ng-controller="Qa as vm"><button ng-click="vm.openExportExcelModal()">Xuất Excel</button>' +
                qrModal + modal + '</main><div id="qr-reader" style="position:fixed;left:-10000px;width:500px"></div></body></html>');
            for (const file of ['assets/scripts/external/angular.min.js', 'assets/scripts/external/ui-bootstrap-tpls.min.js',
                'assets/scripts/external/qrcode.min.js', 'assets/scripts/external/html5-qrcode.min.js', 'users/StudentQrWorkbook.js']) {
                await page.addScriptTag({path: path.join(app, file)});
            }
            await page.addScriptTag({path: path.resolve(xlsxPath)});
            await page.evaluate(({qrCode, exportCode}) => {
                angular.module('Qa', ['ui.bootstrap']).controller('Qa', ['$scope', '$q', '$timeout', '$uibModal', function ($scope, $q, $timeout, modal) {
                    const vm = this; window.qaVm = vm; window.qaScope = $scope; window.qaErrors = [];
                    const users = [{username: '000017', person: {patron: 'Gioan', lastName: 'Nguyễn', firstName: 'An'}},
                        {username: 'gl20240034', person: {patron: 'Maria', lastName: 'Trần', firstName: 'Bình'}}];
                    Object.assign(vm, {isIeltsRoomDomain: false, getDisplayedUsers: () => users, getEnrollmentClassNames: () => 'Ấu Nhi',
                        getTnttMemberTypeName: () => '', getTnttBranchName: () => '', getTnttLevelName: () => ''});
                    const moment = () => ({format: () => '20261031_120000'}), toastr = {success() {}, warning() {}, error: message => window.qaErrors.push(message)};
                    const $ = selector => ({modal() {document.querySelector(selector).classList.add('in'); document.querySelector(selector).style.display = 'block';}});
                    new Function('vm', '$scope', '$q', '$timeout', 'modal', 'settings', 'toastr', '$', 'moment', qrCode + '\n' + exportCode)
                        (vm, $scope, $q, $timeout, modal, {campaignsEnabled: true}, toastr, $, moment);
                    const order = ['stt', 'patron', 'fullName', 'username', 'enrollmentClass', 'qrImage'];
                    vm.exportColumns = order.map(key => vm.exportColumns.find(col => col.key === key));
                }]);
                angular.bootstrap(document.body, ['Qa']);
                window.decodeQr = async dataUrl => {
                    const blob = await (await fetch(dataUrl)).blob();
                    const scanner = new Html5Qrcode('qr-reader');
                    try { return await scanner.scanFile(new File([blob], 'qr.png', {type: 'image/png'}), false); }
                    finally { scanner.clear(); }
                };
            }, {qrCode, exportCode});
            assert.equal(await page.evaluate(async () => window.decodeQr(await QRCode.toDataURL('000017', {width: 360, margin: 3, errorCorrectionLevel: 'H'}))), '000017');
            const modalImage = await page.evaluate(async () => {
                await window.qaVm.showStudentQr(window.qaVm.getDisplayedUsers()[0]);
                document.querySelector('#qrModal').style.display = 'none';
                return window.qaVm.qrPreview;
            });
            if (process.env.STUDENT_QR_QA_DIR) {
                fs.mkdirSync(process.env.STUDENT_QR_QA_DIR, {recursive: true});
                fs.writeFileSync(path.join(process.env.STUDENT_QR_QA_DIR, 'modal-qr.png'), Buffer.from(modalImage.split(',')[1], 'base64'));
            }
            const modalPayload = await page.evaluate(image => window.decodeQr(image), modalImage);
            assert.equal(modalPayload, '000017');
            await page.getByRole('button', {name: 'Xuất Excel', exact: true}).click();
            await page.waitForFunction(() => document.querySelectorAll('.export-preview-table img').length === 2);
            await page.waitForFunction(() => {
                const win = document.querySelector('.export-preview-table').closest('.modal');
                return getComputedStyle(win).opacity === '1' && new DOMMatrix(getComputedStyle(win.querySelector('.modal-dialog')).transform).m42 === 0;
            });
            if (process.env.STUDENT_QR_QA_DIR) {
                fs.mkdirSync(process.env.STUDENT_QR_QA_DIR, {recursive: true});
                await page.screenshot({path: path.join(process.env.STUDENT_QR_QA_DIR, 'preview-' + width + '.png')});
            }
            const downloadEvent = page.waitForEvent('download').catch(() => undefined);
            await page.getByRole('button', {name: 'Xuất file Excel', exact: true}).click();
            await page.waitForFunction(() => !window.qaVm.exportExcelBusy);
            assert.deepEqual(await page.evaluate(() => window.qaErrors), []);
            const download = await downloadEvent;
            assert.ok(download, 'The completed export must trigger a browser download');
            const bytes = fs.readFileSync(await download.path());
            if (process.env.STUDENT_QR_QA_DIR && width === 1366) fs.writeFileSync(path.join(process.env.STUDENT_QR_QA_DIR, 'student-qr-check.xlsx'), bytes);
            const zip = await JSZip.loadAsync(bytes), drawing = await zip.file('xl/drawings/studentQr.xml').async('string');
            assert.equal((drawing.match(/oneCellAnchor>/g) || []).length, 4);
            assert.equal((drawing.match(/<xdr:col>5<\/xdr:col>/g) || []).length, 2);
            assert.match(drawing, /<xdr:row>1<\/xdr:row>/); assert.match(drawing, /<xdr:row>2<\/xdr:row>/);
            assert.equal(zip.file(/xl\/media\/student-qr-\d+\.png/).length, 2);
            for (const [index, code] of ['000017', 'gl20240034'].entries()) {
                const png = await zip.file('xl/media/student-qr-' + (index + 1) + '.png').async('nodebuffer');
                assert.equal(png.readUInt32BE(16), 1024); assert.equal(png.readUInt32BE(20), 1024);
                assert.equal(await page.evaluate(data => window.decodeQr('data:image/png;base64,' + data), png.toString('base64')), code);
            }
            const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
            assert.match(sheet, /ẢNH QR/); assert.match(sheet, /000017/); assert.match(sheet, /gl20240034/);
            assert.ok(!sheet.includes('hoa-thieng')); assert.deepEqual(await page.evaluate(() => window.qaErrors), []);
            assert.deepEqual(errors, []); assert.ok(requests.every(url => !url.includes('/service/')));
            await page.close();
        }
    } finally { await browser.close(); }
});
