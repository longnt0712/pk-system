const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm'), os = require('node:os');
const app = path.resolve(__dirname, '..');
const controller = fs.readFileSync(path.join(app, 'enrolment_class/controllers/EnrolmentClassController.js'), 'utf8');
const listing = fs.readFileSync(path.join(app, 'enrolment_class/views/listing.html'), 'utf8');
const section = (start, end) => controller.slice(controller.indexOf(start), controller.indexOf(end, controller.indexOf(start)));
const helpers = section('        vm.homeworkProgressPercent =', '\t\tvm.tasksForSection =');
const review = section('        vm.buildHomeworkReviewRows =', '        vm.filteredHomeworkRows =');
const exporter = section('        function homeworkExportValue(', '        function openClassImagePreview(');
const cases = [
    [0, 'TODO', 'Chưa làm (0%)', 'is-todo'], [40, 'TODO', 'Chưa làm (40%)', 'is-todo'],
    [40.5, 'PROGRESS_40', 'Chưa hoàn thành (40.5%)', 'is-progress'],
    [84.5, 'PROGRESS_84', 'Chưa hoàn thành (84.5%)', 'is-progress'],
    [85, 'DONE', 'Đã làm (85%)', 'is-done'], [100, 'DONE', 'Đã làm (100%)', 'is-done']
];
function fixture() {
    const vm = {homeworkProgressLevels:[10,20,30,40,50,60,70,80,90], scheduleStudents:[{id:7}],
        scheduleClass:{id:5}, scheduleDay:{scheduleDate:'2026-11-10'}, previousHomeworkDay:{id:3,version:1,scheduleDate:'2026-11-09'}, scheduleEntries:[]};
    const angular = {isArray:Array.isArray, forEach:(items,fn)=>Object.entries(items || {}).forEach(([key,value])=>fn(value,key))};
    const context = {vm,angular,homeworkCellDrafts:{},scheduleAttendanceCell:()=>({}),saveDefaultScheduleAttendanceRows(){}};
    nodeVm.runInNewContext(helpers + review,context);
    return {vm,context};
}
test('teacher cells classify exact scores and totals across both boundaries',()=>{
    const {vm} = fixture();
    for(const [percent,status,label,color] of cases) {
        vm.previousHomeworkTasks = [{id:10,studentProgress:[{studentUserId:7,status,automatic:true,resultPercent:percent}]}];
        vm.buildHomeworkReviewRows(); const row = vm.homeworkReviewRows[0], cell = row.cells[0];
        assert.equal(cell.label,label); assert.equal(vm.homeworkProgressClass(cell),color);
        assert.equal(row.progressPercent,Math.round(percent)); assert.equal(row.done,percent>=85?1:0);
        assert.equal(vm.homeworkProgressLabel(cell,status),label);
    }
    const auto = {status:'DONE',editStatus:'PROGRESS_50',resultPercent:90,automatic:true};
    assert.equal(vm.homeworkProgressLabel(auto),'Chưa hoàn thành (50%)');
    assert.equal(vm.homeworkProgressLabel({status:'PROGRESS_90'}),'Đã làm (90%)');
    assert.equal(vm.homeworkProgressClass({status:'PROGRESS_30'}),'is-todo');
    assert.equal(vm.homeworkProgressLabel({status:'NEEDS_REVIEW'}),'Cần bổ sung');
});
test('saving only a note preserves the automatic score instead of persisting it as a teacher override',async()=>{
    for(const [percent,status] of cases) {
        const {vm,context} = fixture(), calls=[];
        vm.previousHomeworkTasks=[{id:10,section:'HOMEWORK',studentProgress:[{studentUserId:7,status,manualStatus:'TODO',automatic:true,resultPercent:percent}]}];
        vm.buildHomeworkReviewRows(); const row=vm.homeworkReviewRows[0], cell=row.cells[0]; cell.editNotes='Teacher note';
        Object.assign(context,{homeworkCellSaveRequest:0,homeworkReviewRequest:0,toastr:{success(){}},service:{updateTaskProgress(...args){
            calls.push(args);return Promise.resolve({...vm.previousHomeworkDay,version:2,tasks:[{...vm.previousHomeworkTasks[0],studentProgress:[
                {...vm.previousHomeworkTasks[0].studentProgress[0],notes:'Teacher note'}]}]});
        }}});
        nodeVm.runInNewContext(section('        vm.markHomeworkCellDirty =','        function scheduleAttendanceCell('),context);
        vm.markHomeworkCellDirty(cell); await vm.saveHomeworkCell(row,cell);
        assert.equal(calls[0][3].status,'TODO'); assert.equal(calls[0][3].notes,'Teacher note');
        assert.equal(vm.homeworkReviewRows[0].cells[0].resultPercent,percent); assert.equal(vm.homeworkReviewRows[0].cells[0].dirty,undefined);
    }
});
test('actual Angular dropdowns and image exports show scored labels on phone and desktop',async()=>{
    const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
    const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    const browser=await playwright.chromium.launch({headless:true,executablePath});
    const markup=listing.match(/<div class="class-homework-review-table"[\s\S]*?<\/table>\s*<\/div>/)[0];
    const styles=[...listing.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
    try { for(const width of [390,1920]) {
        const page=await browser.newPage({viewport:{width,height:900}});
        try {
            await page.setContent('<!doctype html><style>'+styles+'</style><section class="class-schedule-day-modal-window">'+markup+'</section>');
            await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
            await page.evaluate(({helpers,exporter,cases})=>{
                const vm={homeworkProgressLevels:[10,20,30,40,50,60,70,80,90],isHomeworkColumnVisible:()=>false,isHomeworkTaskColumnVisible:()=>true,
                    previousHomeworkTasks:[{id:10,title:'Làm test'}],previousHomeworkLabel:()=>'',scheduleDayLabel:()=>'',
                    scheduleClass:{name:'Test class'}};
                new Function('vm',helpers)(vm);
                vm.scheduleStudents=cases.map(([percent,status],index)=>({id:index+1,name:'Student '+(index+1),username:'student'+index,
                    cells:[{status,editStatus:status,resultPercent:percent,automatic:true}]}));
                vm.filteredHomeworkRows=()=>vm.scheduleStudents;
                angular.module('ScoreFixture',[]).run(['$rootScope',root=>{root.vm=vm;}]); angular.bootstrap(document.body,['ScoreFixture']);
                window.scoreVm=vm;
                const build=new Function('vm','angular','document',exporter+';return prepareHomeworkImageElement;')(vm,angular,document);
                window.scoreExport=build(document.querySelector('table'));document.body.appendChild(scoreExport);
            },{helpers,exporter,cases});
            const selects=page.locator('.class-homework-progress-select');
            assert.equal(await selects.count(),cases.length);
            for(let i=0;i<cases.length;i++) {
                assert.equal(await selects.nth(i).evaluate(node=>node.selectedOptions[0].textContent),cases[i][2]);
                assert.ok((await selects.nth(i).getAttribute('class')).includes(cases[i][3]));
                assert.ok((await page.locator('.class-homework-image-export tbody tr').nth(i).textContent()).includes(cases[i][2]));
            }
            if(process.env.HOMEWORK_SCORE_SCREENSHOT && width===1920) {
                await page.evaluate(()=>scoreExport.remove());
                await page.screenshot({path:process.env.HOMEWORK_SCORE_SCREENSHOT,fullPage:true});
            }
        } finally { await page.close(); }
    }} finally { await browser.close(); }
});
