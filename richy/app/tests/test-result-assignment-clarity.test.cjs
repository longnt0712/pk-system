const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const app = path.resolve(__dirname,'..');
const view = fs.readFileSync(path.join(app,'test_result/views/listing.html'),'utf8');
function loadService() {
    let Service;
    nodeVm.runInNewContext(fs.readFileSync(path.join(app,'test_result/business/TestResultService.js'),'utf8'), {
        angular: {noop() {},isArray:Array.isArray,module() { return {service(name,constructor) { Service=constructor; }}; }}, console:{log() {}}
    });
    return new Service(null,null,null,{api:{baseUrl:'/',apiV1Url:'api/'}},null);
}
const service = loadService();
const column = field => service.getTableDefinition('ALL',false).find(item => item.field===field);
const topics = [{id:11,name:'Travel essentials'},{id:12,name:'At the airport'},{id:21,name:'Animal world'}];
const assigned = (extra={}) => ({id:91,testType:1,assignmentTaskId:238,assignmentTopicId:11,topics:structuredClone(topics),...extra});

test('one result highlights only its assigned topic while retaining every related content topic without modifying data', () => {
    const row = assigned(), original = structuredClone(row);
    const html = column('testName').formatter('Practice',row);
    assert.match(html,/Topic được giao:<\/strong> Travel essentials/);
    assert.equal((html.match(/test-result-assigned-topic/g)||[]).length,1);
    for (const topic of topics) { assert.ok(html.includes(topic.name)); }
    assert.match(html,/Topic liên quan đến nội dung/); assert.match(html,/không tự cộng thêm bài hoàn thành/);
    assert.equal((html.match(/Travel essentials/g)||[]).length,1,'the selected topic is displayed once');
    assert.deepEqual(row,original,'formatting must never replace result topics with the assignment topic');
});
test('missing assignment topic metadata uses its ID and old results remain readable', () => {
    const html = column('testName').formatter('Practice',assigned({assignmentTopicId:99}));
    assert.match(html,/Topic được giao:<\/strong> Topic #99/);
    assert.match(column('testName').formatter('Historical title',{testType:1}),/^Historical title$/);
    const legacy = column('testName').formatter('Practice',assigned({assignmentTopicId:null}));
    assert.doesNotMatch(legacy,/Topic được giao/); assert.ok(legacy.includes(topics[0].name));
    assert.doesNotMatch(column('testName').formatter('Practice',assigned({assignmentTaskId:null})),/Topic được giao/);
});
test('every result without a task states the missing link without inventing its historical source', () => {
    for (const testType of [1,2,3,4,5,6,7]) {
        const html = column('assignmentTaskId').formatter(null,{testType});
        assert.match(html,/> Không gắn task</); assert.match(html,/Không gắn với task/);
        assert.match(html,/không tự động tính hoàn thành/); assert.doesNotMatch(html,/Theo topic|vẫn đối chiếu|Tự luyện/);
    }
});
test('source and successful attempt labels explain that an assignment still needs matching topic and time evidence', () => {
    const source = column('assignmentTaskId').formatter(238,assigned());
    assert.match(source,/Nguồn: Task #238/); assert.match(source,/không xác nhận hoàn thành/);
    const feedback = service.getResultStatusFeedback({...assigned(),resultStatus:'SUCCESS'});
    assert.equal(feedback.label,'Đạt yêu cầu'); assert.match(feedback.message,/đúng bài được giao, đúng topic\/phần và trong thời hạn/);
    assert.match(feedback.message,/chưa xác nhận đủ mọi bài trong task/);
    const unlinked = service.getResultStatusFeedback({...assigned(),assignmentTaskId:null,resultStatus:'SUCCESS'});
    assert.match(unlinked.message,/không gắn với task, nên không tự cộng tiến độ bài được giao/);
    assert.doesNotMatch(unlinked.message,/tự luyện/i);
    const failed = service.getResultStatusFeedback({...assigned(),resultStatus:'FAILED'});
    assert.match(failed.message,/đã được lưu nhưng chưa đạt/); assert.match(failed.message,/chưa được tính hoàn thành/);
    assert.equal(service.getResultStatusFeedback({...assigned(),resultStatus:null}).label,'Đã lưu');
});
test('assigned IDs and topic names are escaped rather than interpreted as markup', () => {
    const html = column('testName').formatter('<img src=x>',assigned({assignmentTopicId:'<img src=x>',topics:[{id:'<img src=x>',name:'<script>alert(1)</script>'}]}));
    assert.doesNotMatch(html,/<script>|<img src=x>/); assert.match(html,/&lt;script&gt;/);
    assert.match(column('testName').formatter('<img src=x>',{topics:[]}),/&lt;img src=x&gt;/);
    assert.doesNotMatch(column('assignmentTaskId').formatter('" onclick="x',{}),/title="[^>]*" onclick="x/);
});
test('the listing separates saved attempts from completed homework and explains same-key retries for the supported scored types', () => {
    const note = view.match(/<div class="test-result-count-explanation"[\s\S]*?<\/div>/)[0];
    assert.match(note,/Mỗi dòng là một lượt nộp đã lưu, gồm cả lượt chưa đạt/);
    assert.match(note,/số dòng kết quả không phải số task đã hoàn thành/);
    assert.match(note,/Reading, Listening, Writing, Tổng hợp, Daily Vocab và Daily Listening/);
    assert.match(note,/cùng mã lượt không tạo thêm kết quả/);
});
test('the real result formatters render assigned and related topics distinctly on desktop and mobile', async () => {
    const os = require('node:os');
    const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser = await playwright.chromium.launch({executablePath,headless:true});
    const css = [...view.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
    const note = view.match(/<div class="test-result-count-explanation"[\s\S]*?<\/div>/)[0];
    const columns = ['testName','assignmentTaskId','resultStatus'].map(column);
    const rows = [assigned({resultStatus:'SUCCESS'}),assigned({id:92,assignmentTopicId:12,resultStatus:'FAILED'}),
        assigned({id:93,assignmentTaskId:null,assignmentTopicId:null,resultStatus:'SUCCESS'})];
    const table = '<table class="table"><thead><tr>' + columns.map(item=>'<th>'+item.title+'</th>').join('') + '</tr></thead><tbody>' +
        rows.map(row=>'<tr>' + columns.map(item=>'<td>'+item.formatter(row[item.field],row)+'</td>').join('') + '</tr>').join('') + '</tbody></table>';
    try {
        for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
            const page = await browser.newPage({viewport});
            await page.setContent('<style>' + fs.readFileSync(path.join(app,'assets/css/external/bootstrap.min.css'),'utf8') + '\n' + css +
                '\nbody{padding:16px;background:#f2f4fb}.test-result-listing-wrap table{min-width:860px}.test-result-listing-wrap td{padding:14px;vertical-align:top}</style>' +
                '<div class="test-result-listing-card"><div class="test-result-listing-heading"><div class="test-result-listing-title">KẾT QUẢ LÀM BÀI</div></div>' + note + '<div class="test-result-listing-wrap">' + table + '</div></div>');
            assert.equal(await page.locator('.test-result-assigned-topic').count(),2);
            assert.match(await page.locator('tbody tr').first().locator('.test-result-assigned-topic').innerText(),/Travel essentials/);
            assert.match(await page.locator('tbody tr').nth(1).locator('.test-result-assigned-topic').innerText(),/At the airport/);
            assert.equal(await page.locator('tbody tr').nth(2).locator('.test-result-assigned-topic').count(),0);
            assert.equal(await page.getByRole('note').isVisible(),true);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
            if (process.env.QA_SCREENSHOT_DIR) { await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'test-result-clarity-'+viewport.width+'.png')}); }
            await page.close();
        }
    } finally { await browser.close(); }
});
