const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(app,file),'utf8');
const listing = read('enrolment_class/views/listing.html');
const styles = ['external/bootstrap.min.css','components-md.min.css','layout-hoz.min.css','default.min.css','custom.css']
    .map(name => read('assets/css/'+name)).join('\n') + [...listing.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const table = listing.match(/<div class="class-homework-review-table"[\s\S]*?<\/table>\s*<\/div>/)[0];
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async()=>{
    const engine = process.env.TITLE_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true,...(engine === 'chromium' ? {executablePath} : {})});
});
after(async()=>{if(browser)await browser.close();});

test('long homework headers use ellipsis without stretching controls or losing the full task name',async()=>{
    for(const width of [820,1920]) {
        const page = await browser.newPage({viewport:{width,height:1080},reducedMotion:'reduce'});
        try {
            await page.route('**/*',route=>route.abort());
            await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><section class="class-schedule-day-modal-window" style="padding:20px">'+table+'</section></body></html>');
            await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
            await page.evaluate(()=>{
                const long = 'Học thuộc hết bảng giới từ và làm, dịch bài phần THI ONLINE: LÀM CHỦ KIẾN THỨC NGỮ PHÁP GIỚI TỪ & CỤM GIỚI TỪ (BUỔI 2) – ĐỀ TỔNG HỢP '.repeat(3);
                const tasks = [{id:1,title:long,topicName:'Topic '+long,sourceQuestionTitle:'Bài kiểm tra '+long},{id:2,title:long},{id:3,title:'Bài ngắn'}];
                const row = {id:1,name:'Nguyễn Minh Anh',username:'minhanh',label:'Chưa làm',status:'INCOMPLETE',total:3,done:0,attendance:{present:true,editNotes:''},cells:tasks.map(()=>({editStatus:'TODO',editNotes:''}))};
                window.qaRow=row;window.qaTasks=tasks;
                angular.module('HomeworkTitleFixture',[]).run(['$rootScope',root=>{
                    root.vm={scheduleStudents:[row],previousHomeworkTasks:tasks,homeworkProgressLevels:[10,50,90],
                        filteredHomeworkRows:()=>[row],isHomeworkColumnVisible:()=>true,isHomeworkTaskColumnVisible:()=>true,
                        scheduleDayLabel:()=> '31/10/2026',taskDueLabel:()=> '31/10/2026 20:00',homeworkHasExactProgress:()=>false,
                        markHomeworkCellDirty(){},saveHomeworkCell(){},markScheduleAttendanceDirty(){},saveScheduleAttendance(){}};
                }]);
                angular.bootstrap(document.body,['HomeworkTitleFixture']);
            });
            const titles=page.locator('.class-homework-task-title');
            assert.equal(await titles.count(),3);
            const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
                headers:[...document.querySelectorAll('th.class-homework-review-cell')].map(node=>({width:node.getBoundingClientRect().width})),
                titles:[...document.querySelectorAll('.class-homework-task-title')].map(node=>({text:node.textContent,title:node.title,width:node.clientWidth,scroll:node.scrollWidth,overflow:getComputedStyle(node).textOverflow,whiteSpace:getComputedStyle(node).whiteSpace}))}));
            assert.ok(geometry.scroll<=width+1,'horizontal overflow stays inside the table: '+JSON.stringify(geometry));
            for(const [index,title] of geometry.titles.entries()) {
                assert.equal(title.title,title.text,'tooltip retains the complete task title');
                assert.equal(title.overflow,'ellipsis');assert.equal(title.whiteSpace,'nowrap');
                assert.ok(title.width<=260,'title has a bounded display width');
                assert.equal(title.scroll>title.width,index<2,'only long titles are clipped');
                assert.ok(geometry.headers[index].width<=500,'long text cannot create a huge column: '+JSON.stringify(geometry.headers));
            }
            const secondary=page.locator('th.class-homework-review-cell > small[title]');
            assert.equal(await secondary.count(),2);
            for(const note of await secondary.all()) {
                assert.equal(await note.evaluate(node=>getComputedStyle(node).textOverflow),'ellipsis');
                assert.equal(await note.getAttribute('title'),await note.textContent());
                assert.equal(await note.evaluate(node=>node.scrollWidth>node.clientWidth),true);
            }
            for(let index=0;index<3;index++) {
                const cell=page.locator('tbody td.class-homework-review-cell').nth(index);
                const status=cell.locator('select');await status.selectOption('DONE');
                await cell.locator('input.class-homework-cell-note').fill('Nhận xét '+index);
                assert.equal(await page.evaluate(index=>qaRow.cells[index].editStatus,index),'DONE');
                assert.equal(await page.evaluate(index=>qaRow.cells[index].editNotes,index),'Nhận xét '+index);
            }
            if(process.env.TITLE_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.TITLE_SCREENSHOT_DIR,{recursive:true});
                await page.locator('.class-homework-review-table').evaluate(node=>node.scrollLeft=0);
                await page.screenshot({path:path.join(process.env.TITLE_SCREENSHOT_DIR,'homework-title-'+width+'.png')});
            }
        } finally {await page.close();}
    }
});
