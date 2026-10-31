const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(app,file),'utf8');
const listing = read('enrolment_class/views/listing.html');
const controller = read('enrolment_class/controllers/EnrolmentClassController.js');
const exporter = controller.slice(controller.indexOf('        function homeworkExportValue('),controller.indexOf('        function openClassImagePreview('));
const styles = ['external/bootstrap.min.css','components-md.min.css','layout-hoz.min.css','default.min.css','custom.css','ieltsroom-halloween.css']
    .map(file=>read('assets/css/'+file)).join('\n') + [...listing.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const markup = listing.match(/<div class="class-homework-review-table"[\s\S]*?<\/table>\s*<\/div>/)[0];
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async()=>{
    const engine = process.env.EXPORT_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true,...(engine === 'chromium' ? {executablePath} : {})});
});
after(async()=>{if(browser)await browser.close();});

test('homework PNG layout bounds column widths and wraps full titles/comments independently of screen width',async()=>{
    for(const width of [390,1920]) {
        const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
        try {
            await page.route('**/*',route=>route.abort());
            await page.setContent('<!doctype html><html class="ieltsroom-halloween"><head><style>'+styles+'</style></head><body><section class="class-schedule-day-modal-window">'+markup+'</section></body></html>');
            await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
            await page.evaluate(exporter=>{
                const long = 'Học thuộc hết bảng giới từ và làm, dịch bài THI ONLINE: LÀM CHỦ KIẾN THỨC NGỮ PHÁP GIỚI TỪ & CỤM GIỚI TỪ (BUỔI 2).';
                const tasks = Array.from({length:4},(_,index)=>({id:index+1,title:long,topicName:'Topic '+long,sourceQuestionTitle:'Bài kiểm tra '+long}));
                const rows = Array.from({length:16},(_,index)=>({id:index+1,name:'Nguyễn Minh Anh '+(index+1),username:'student'+index,
                    label:'Đã hoàn thành',status:'DONE',total:4,done:4,attendance:{present:index!==1,editNotes:index===0?'Ghi chú điểm danh '.repeat(10):''},
                    cells:tasks.map((_,task)=>({editStatus:['DONE','PROGRESS_50','NEEDS_REVIEW','TODO'][task],editNotes:index===0&&task===0?'Nhận xét dài cần xuống dòng. '.repeat(20):''}))}));
                const vm = {scheduleStudents:rows,previousHomeworkTasks:tasks,scheduleClass:{name:'GRADE 9'},
                    filteredHomeworkRows:()=>rows,isHomeworkColumnVisible:()=>true,isHomeworkTaskColumnVisible:()=>true,homeworkProgressLevels:[50],
                    previousHomeworkLabel:()=> '31/10/2026',scheduleDayLabel:()=> '01/11/2026',homeworkHasExactProgress:()=>false};
                angular.module('HomeworkExportFixture',[]).run(['$rootScope',root=>{root.vm=vm;}]);
                angular.bootstrap(document.body,['HomeworkExportFixture']);
                const build = new Function('vm','angular','document',exporter+';return prepareHomeworkImageElement;')(vm,angular,document);
                window.exportRoot = build(document.querySelector('.class-homework-review-table table'));
                document.body.appendChild(exportRoot);
                window.exportFixture = {vm,build};
            },exporter);
            const layout = await page.evaluate(()=>{
                const table = exportRoot.querySelector('table');
                return {width:exportRoot.scrollWidth,height:exportRoot.scrollHeight,columns:[...table.querySelectorAll('col')].map(n=>n.getBoundingClientRect().width),
                    rows:table.tBodies[0].rows.length,titles:[...table.querySelectorAll('.class-homework-task-title')].map(n=>({text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth,height:n.clientHeight,overflow:getComputedStyle(n).textOverflow})),
                    note:table.tBodies[0].rows[0].querySelector('td.class-homework-review-cell').textContent,controls:table.querySelectorAll('input,select,.class-homework-note-measure,.class-export-ignore').length,
                    sourceControls:document.querySelectorAll('.class-homework-review-table select.class-homework-progress-select').length};
            });
            assert.ok(layout.width>=1600&&layout.width<1800,JSON.stringify(layout));
            assert.ok(layout.columns.every(column=>column<=261),JSON.stringify(layout));
            assert.equal(layout.rows,16);
            assert.equal(layout.controls,0,'export contains static values, without hidden comment measurements');
            assert.equal(layout.sourceControls,64,'export leaves interactive controls intact');
            for(const title of layout.titles) {
                assert.ok(title.height>40,'full title wraps onto multiple lines');
                assert.ok(title.scroll<=title.width+1,'title does not expand the image');
                assert.equal(title.overflow,'clip','the image includes the full title rather than an ellipsis');
            }
            assert.ok(layout.note.includes('Nhận xét dài cần xuống dòng. '.repeat(20)),'full comment is retained');
            const raster = process.env.HTML2CANVAS_PATH;
            if(raster) {
                await page.addScriptTag({path:raster});
                const png = await page.evaluate(async()=>{
                    await document.fonts.ready;
                    const canvas = await html2canvas(exportRoot,{backgroundColor:'#fff',scale:1,logging:false,width:exportRoot.scrollWidth,height:exportRoot.scrollHeight,windowWidth:exportRoot.scrollWidth,windowHeight:exportRoot.scrollHeight});
                    return {width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/png')};
                });
                assert.equal(png.width,layout.width);
                assert.ok(png.height>700&&png.height<4000,JSON.stringify({width:png.width,height:png.height}));
                if(process.env.EXPORT_SCREENSHOT_DIR&&width===1920) fs.writeFileSync(path.join(process.env.EXPORT_SCREENSHOT_DIR,'homework-export-readable.png'),Buffer.from(png.data.split(',')[1],'base64'));
            }
        } finally {await page.close();}
    }
});
