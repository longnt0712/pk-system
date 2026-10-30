const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const playwright = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const app = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(app,file),'utf8');
const inline = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const base = ['external/bootstrap.min.css','external/font-awesome.min.css','components-md.min.css','plugins-md.min.css','layout-hoz.min.css','default.min.css','custom.css','ui-layer-safety.css']
    .map(file => read('assets/css/'+file)).join('\n') + inline(read('index.html'));
let editor;
const moduleStub = {factory(){return this;},directive(name,args){if(name === 'speakingStudentAnswerEditor') editor = args.at(-1)({}, {}, {}).template;return this;}};
vm.runInNewContext(read('question/business/speaking-student-answer-editor.js'),{angular:{module:()=>moduleStub}});
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
let browser;
before(async () => {
    const engine = process.env.SITE_THEME_BROWSER === 'webkit' ? 'webkit' : 'chromium';
    browser = await playwright[engine].launch({headless:true,...(engine === 'chromium' ? {executablePath} : {})});
});
after(async () => {if(browser) await browser.close();});

async function fixture(width,dark=false) {
    const page = await browser.newPage({viewport:{width,height:1080},hasTouch:true,reducedMotion:'reduce'});
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
        const pathname=new URL(route.request().url()).pathname;
        if(pathname.startsWith('/assets/images/halloween/')) return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(app,pathname.slice(1)))});
        if(pathname.endsWith('/fontawesome-webfont.woff2')) return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(app,'assets/fonts/fontawesome-webfont.woff2'))});
        return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
    });
    await page.goto('https://ieltsroom.com/speaking');
    // Angular compiles production page/editor templates; only data and actions
    // are local fixtures. The route CSS intentionally loads after Halloween.
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+base+'</style><style>'+read('assets/css/ieltsroom-halloween.css').replace(/\.\.\/images\//g,'/assets/images/')+'</style><style>'+read('question/speaking.css')+'</style><style>html *{transition:none!important}</style></head><body class="page-container-bg-solid">'+read('question/views/speaking.html')+'</body></html>');
    await page.addScriptTag({path:path.join(app,'assets/scripts/external/angular.min.js')});
    await page.evaluate(({editor,dark}) => {
        document.documentElement.classList.toggle('global-dark-mode',dark);
        const question = {id:42,entryId:42,part:1,topic:'Hometown',prompt:'What do you like about your hometown?',sample:'I enjoy the peaceful streets and the friendly neighbours.',passed:false};
        const set = {id:1,name:'Bộ 3 năm 2026',year:2026,fromMonth:9,toMonth:12,sharedForEveryone:true,canManage:true};
        const state = {loading:false,status:'Đã đồng bộ',ready:true,conflict:true,remote:{},history:{loading:false,versions:[],preview:null}};
        const model = {managementMode:true,isAdmin:true,canManage:true,sets:[set],selectedSet:set,selectedSetId:1,years:[2026],yearFilter:'',
            part:1,questions:[question],groups:[{key:'hometown',part:1,title:'Hometown',passed:0,questions:[question],visible:[question]}],groupPage:0,
            adminClassId:1,adminStudentRows:[{id:7,name:'Nguyễn Minh Anh',username:'minhanh',answerCount:3,canAccess:true}],adminPage:0,adminPageSize:20,adminTotal:1,
            studentId:7,answerQuestionId:42,userId:1,history:[],recorder:{state:{pending:[]}},modal:null,preview:true,importRows:[
                {row:{rowId:'P1-01',topic:'Home',prompt:'Where do you live?'},status:'NEW',selected:true},
                {row:{rowId:'P1-02',topic:'Home',prompt:'What is your hometown like?'},status:'CHANGED',selected:false},
                {row:{rowId:'P1-03',topic:'Home',prompt:'A question needing review'},status:'INVALID',error:'Thiếu nội dung cần sửa',selected:false}],
            importLabels:{NEW:'Câu mới',CHANGED:'Có thay đổi',INVALID:'Cần sửa'},importPage:1,importSelected:1,
            availableSets:()=>[set],canImportOwnAnswers:()=>true,canUseClassRoster:()=>true,canReviewStudents:()=>true,canOpenAnswer:()=>true,
            answerStudentLabel:()=> 'Nguyễn Minh Anh',answerStudentId:()=>7,canImportViewedStudent:()=>false,canImportStudent:()=>true,
            modalTitle:()=> 'Import câu hỏi Speaking',openModal(name){this.modal=name;},closeModal(){this.modal=null;},changePart(part){this.part=part;},
            changeYear(){},selectSet(){},rebuildGroups(){},canUsePractice:()=>true};
        const app = angular.module('SpeakingThemeFixture',[]);
        app.directive('classTreePicker',()=>({template:'<button type="button" class="class-tree-trigger form-control">IELTS 6.5 · Lớp của tôi <span class="caret"></span></button>'}));
        app.directive('speakingStudentAnswerEditor',()=>({template:editor}));
        app.run(['$rootScope','$sce',(root,sce)=>{
            window.qaScope=root;window.qaVm=model;root.vm=model;root.studentLabel='Nguyễn Minh Anh';
            root.ed={state,hasSelection:true,activeNote:null,historyOpen:false,remoteText:()=> 'Teacher correction'};
            root.authored = sce.trustAsHtml('My <span style="color:#b62938">own red wording</span> and <span class="ielts-annotation has-note" data-note-id="note1">teacher note</span> with <span class="ielts-annotation is-highlighted">highlighted words</span>.');
        }]);
        angular.bootstrap(document.body,['SpeakingThemeFixture']);
        document.querySelector('.sp-answer-editable').innerHTML='My <span style="color:#b62938">own red wording</span> and <span class="ielts-annotation has-note" data-note-id="note1">teacher note</span> with <span class="ielts-annotation is-highlighted">highlighted words</span>.';
        document.querySelectorAll('details').forEach(details=>{details.open=true;});
        const paper=document.createElement('div');paper.className='sp-version-paper';paper.innerHTML='<pre>Original handwritten answer paper</pre><canvas aria-label="Authored ink"></canvas>';
        document.querySelector('.sp-answer-editor').append(paper);
    },{editor,dark});
    return {page,errors};
}

async function paint(page,selectors) {
    return page.evaluate(async selectors=>{
        await new Promise(requestAnimationFrame);
        // This fixture checks completed static styles; transitions are disabled.
        await new Promise(requestAnimationFrame);
        const rgba = value => {const parts=value.match(/[\d.]+/g).map(Number);return [parts[0],parts[1],parts[2],parts.length>3?parts[3]:1];};
        const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])).concat(1);
        const background=node=>{
            const chain=[];for(let item=node;item;item=item.parentElement){
                const css=getComputedStyle(item),solid=(css.backgroundImage.match(/rgba?\([^)]*\)/g)||[]).map(rgba).find(color=>color[3]===1);
                chain.unshift(solid||rgba(css.backgroundColor));
            }
            return chain.reduce((back,front)=>blend(front,back),[255,255,255,1]);
        };
        const lum = rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const result={};
        for(const [name,selector] of Object.entries(selectors)) {
            const node=document.querySelector(selector);if(!node)throw new Error('Missing fixture selector: '+selector);
            const css=getComputedStyle(node),bg=background(node),a=lum(rgba(css.color)),b=lum(bg);
            result[name]={color:css.color,background:css.backgroundColor,image:css.backgroundImage,border:css.borderColor,
                contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),luminance:lum(bg)};
        }
        return result;
    },selectors);
}
const selectors={hero:'.sp-hero',heading:'.sp-hero h1',filter:'.sp-filters',label:'.sp-filters label',select:'.sp-filters select',
    button:'.sp-filters .sp-button',primary:'.sp-hero .sp-primary',badge:'.sp-filters .sp-badge',table:'.sp-admin-table td',tableHead:'.sp-admin-table th',
    topic:'.sp-topic',sample:'.sp-sample',muted:'.sp-admin-students .sp-muted',format:'.sp-answer-format button',editable:'.sp-answer-editable',warningSummary:'.sp-answer-conflict summary'};
const preserved={authored:'.sp-answer-editable span[style]',note:'.sp-answer-editable .has-note',highlight:'.sp-answer-editable .is-highlighted',paper:'.sp-version-paper'};

test('Speaking follows Halloween with readable controls and panels, responsive dialogs and an exact Normal restore',async()=>{
    for(const width of [1920,1440,820,390]) {
        const {page,errors}=await fixture(width,width===820);
        try {
            const normal=await paint(page,selectors),authored=await paint(page,preserved);
            await page.evaluate(()=>document.documentElement.classList.add('ieltsroom-halloween'));
            const themed=await paint(page,selectors),detail=JSON.stringify({width,themed});
            assert.ok(themed.filter.luminance<.15,'filter panel is dark plum instead of a legacy white island: '+detail);
            for(const [name,style] of Object.entries(themed)) assert.ok(style.contrast>=4.5,'readable '+name+': '+JSON.stringify({width,style}));
            const marks=await paint(page,preserved);
            for(const name of ['note','highlight','paper']) assert.equal(marks[name].background,authored[name].background,name+' retains its authored canvas/highlight');
            assert.equal(marks.authored.color,authored.authored.color,'the theme keeps explicitly authored text color');
            const tabs=page.getByRole('tab');
            assert.notEqual(await tabs.nth(0).evaluate(n=>getComputedStyle(n).backgroundColor),await tabs.nth(1).evaluate(n=>getComputedStyle(n).backgroundColor),'selected Part remains visually distinct');
            await tabs.nth(1).click();assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page-wide horizontal overflow at '+width);
            if(process.env.SITE_THEME_SCREENSHOT_DIR&&[1920,820,390].includes(width)) {
                fs.mkdirSync(process.env.SITE_THEME_SCREENSHOT_DIR,{recursive:true});
                await page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,'speaking-halloween-'+(width===1920?'desktop':width===820?'tablet':'mobile')+'.png')});
            }
            await page.locator('.sp-filters .sp-button').filter({hasText:'Import Excel'}).click();
            const dialog=page.getByRole('dialog',{name:'Đối chiếu file import'});await dialog.waitFor({state:'visible'});
            const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=1081,'dialog fits viewport at '+width);
            const modal=await paint(page,{body:'.sp-modal-body',heading:'.sp-modal h2',footer:'.sp-modal>footer',new:'.sp-status-NEW',changed:'.sp-status-CHANGED',invalid:'.sp-status-INVALID',error:'.sp-error-text'});
            for(const [name,style] of Object.entries(modal)) assert.ok(style.contrast>=4.5,'readable modal '+name+': '+JSON.stringify({width,style}));
            assert.equal(new Set([modal.new.background,modal.changed.background,modal.invalid.background]).size,3,'import states remain distinct');
            const close=dialog.locator('footer').getByRole('button',{name:'Đóng',exact:true});
            assert.equal(await close.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'modal footer remains reachable');
            if(process.env.SITE_THEME_SCREENSHOT_DIR&&width===820) await page.screenshot({path:path.join(process.env.SITE_THEME_SCREENSHOT_DIR,'speaking-halloween-modal.png')});
            await close.click();await dialog.waitFor({state:'hidden'});
            if(width===1920) {
                await page.evaluate(()=>qaScope.$apply(()=>{
                    qaScope.ed.versionSource=()=> 'Câu trả lời';
                    qaScope.ed.state.history.versions=[{id:1,updatedAt:'2026-10-30T10:00:00',editorName:'Giáo viên',source:'ANSWER'}];
                    qaScope.ed.state.history.preview={id:1,html:angular.element(document.body).injector().get('$sce').trustAsHtml('<p>Earlier answer</p>'),notes:[]};
                    qaScope.ed.historyOpen=true;
                }));
                const metadata=await paint(page,{selectedVersion:'.sp-version-list .is-active small'});
                assert.ok(metadata.selectedVersion.contrast>=4.5,'selected version metadata remains readable: '+JSON.stringify(metadata));
                await page.evaluate(()=>qaScope.$apply(()=>{qaScope.ed.historyOpen=false;}));
            }
            await page.mouse.move(width-1,0);
            await page.evaluate(()=>document.documentElement.classList.remove('ieltsroom-halloween'));
            assert.deepEqual(await paint(page,selectors),normal,'Normal restores the original speaking styles at '+width);
            assert.deepEqual(errors,[]);
        } finally {await page.close();}
    }
});
