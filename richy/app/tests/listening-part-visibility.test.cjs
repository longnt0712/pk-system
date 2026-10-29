const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),nodeVm=require('node:vm');
const app=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(app,'question/controllers/IELTSReadingActualTestController.js'),'utf8').replace(/\r\n/g,'\n');
const view=fs.readFileSync(path.join(app,'question/views/ielts_reading_actual_test_idp.html'),'utf8');
function code(name,method=false){
  const start=source.indexOf(method?'vm.'+name+' = function':'function '+name+'(');assert.ok(start>=0,name);
  const first=source.indexOf('{',start);let depth=0,quote=null,line=false,block=false;
  for(let i=first;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
    if(c==='/'&&next==='/'){line=true;i++;continue;}if(c==='/'&&next==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(start,i+1)+(method?';':'');
  }
  throw Error('Unclosed function '+name);
}
function fixture(options={}){
  const questions=Array.from({length:40},(_,i)=>({id:i+101,ordinalNumber:i+1,parent:{type:1},
    questionAnswers:[{clientAnswer:'answer '+(i+1),selected:i%2===0}],annotationNotes:[{text:'note '+i}]}));
  const parts=Array.from({length:4},(_,i)=>({id:i+1,question:'Part '+(i+1),questionType:{code:'IELTSRTP'+(i+1)},subQuestions:[]}));
  parts.forEach((part,i)=>part.subQuestions.push({type:1,parent:part,ordinalNumber:1,subQuestions:questions.slice(i*10,i*10+10)}));
  const vm={isListeningRoute:options.listening!==false,isWritingRoute:false,isComprehensiveRoute:false,
    isPartAssignment:!!options.assigned,assignedParts:options.assigned||[],assignedPart:(options.assigned||[])[0],
    isPreviewMode:!!options.preview,testSessionMode:options.mode||'STUDY',passageNumber:1,
    tempQuestion:questions[0],tempOrdinalNumber:1,ieltsReadingActualTest:{id:42,subQuestions:parts}};
  let mediaReads=0;const audio={currentTime:18.5,playbackRate:1.7,paused:false};
  const c=nodeVm.createContext({vm,Number,Math,angular:{isArray:Array.isArray,forEach(items,fn){(items||[]).forEach(fn);}},
    $timeout:callback=>callback(),document:{getElementById(id){if(id==='main-audio'){mediaReads++;return audio;}return null;}}});
  for(const name of['listeningPartNumberForOrdinal','getAllReadingQuestionEntries','getReadingQuestionEntries',
    'getReadingDraftPartNumbers','getCurrentReadingQuestionIndex','normalizeListeningCandidateParts'])nodeVm.runInContext(code(name),c);
  nodeVm.runInContext('var cachedIeltsNavigationParts=null;',c);
  for(const name of['getIeltsNavigationParts','activeIeltsNavigationPart','listeningQuestionVisible','listeningPackageVisible',
    'openIeltsNavigationPart','openReadingQuestion','clickShowChildren','changePassage','autoScrollToView','autoFocusOnText',
    'canNavigateReadingQuestion','navigateReadingQuestion'])nodeVm.runInContext(code(name,true),c);
  if(options.modern){c.normalizeListeningCandidateParts(vm.ieltsReadingActualTest);}
  else{parts[3].subQuestions.forEach(pack=>{pack.parent=parts[2];});parts[2].subQuestions.push(...parts[3].subQuestions);vm.ieltsReadingActualTest.subQuestions=parts.slice(0,3);}
  const all=()=>Array.from(c.getAllReadingQuestionEntries());
  return{vm,c,questions,audio,all,mediaReads:()=>mediaReads,
    select(ordinal){const entry=all().find(e=>e.question.ordinalNumber===ordinal);vm.openReadingQuestion(entry.question,entry.packageQuestions,entry.passageQuestions);},
    visible(){return questions.filter(vm.listeningQuestionVisible).map(q=>q.ordinalNumber);}};
}
const ordinals=part=>Array.from({length:10},(_,i)=>(part-1)*10+i+1);

test('all four logical Listening parts remain isolated in legacy and normalized modern workspaces in both modes',()=>{
  for(const modern of[false,true])for(const mode of['STUDY','SERIOUS']){
    const f=fixture({modern,mode}),answerRefs=f.questions.map(q=>q.questionAnswers),noteRefs=f.questions.map(q=>q.annotationNotes);
    assert.equal(f.vm.ieltsReadingActualTest.subQuestions.length,3);
    for(let part=1;part<=4;part++){
      f.select((part-1)*10+1);assert.equal(f.vm.activeIeltsNavigationPart(),part);assert.deepEqual(f.visible(),ordinals(part));
      assert.equal(f.vm.passageNumber,Math.min(part,3));
      const visiblePacks=f.vm.ieltsReadingActualTest.subQuestions.flatMap(p=>p.subQuestions).filter(f.vm.listeningPackageVisible);
      assert.deepEqual(visiblePacks.flatMap(p=>p.subQuestions.filter(f.vm.listeningQuestionVisible).map(q=>q.ordinalNumber)),ordinals(part));
      assert.equal(f.all().length,40);f.questions.forEach((q,i)=>{assert.equal(q.questionAnswers,answerRefs[i]);assert.equal(q.annotationNotes,noteRefs[i]);});
    }
    assert.equal(f.mediaReads(),0);assert.deepEqual(f.audio,{currentTime:18.5,playbackRate:1.7,paused:false});
  }
});

test('question and part navigation cross 30/31 only on an explicit action and can return to Part 3',()=>{
  const f=fixture();f.select(30);assert.deepEqual(f.visible(),ordinals(3));
  for(let i=0;i<3;i++)assert.equal(f.vm.listeningQuestionVisible(f.questions[30]),false);
  assert.equal(f.vm.canNavigateReadingQuestion(1),true);f.vm.navigateReadingQuestion(1);
  assert.equal(f.vm.tempQuestion,f.questions[30]);assert.equal(f.vm.activeIeltsNavigationPart(),4);assert.deepEqual(f.visible(),ordinals(4));
  f.vm.navigateReadingQuestion(-1);assert.equal(f.vm.tempQuestion,f.questions[29]);assert.deepEqual(f.visible(),ordinals(3));
  f.vm.openIeltsNavigationPart(f.vm.getIeltsNavigationParts().find(p=>p.number===4));
  assert.equal(f.vm.tempQuestion,f.questions[30]);assert.deepEqual(f.visible(),ordinals(4));assert.equal(f.mediaReads(),0);
});

test('restored ordinal 31 and assigned Part 4 retain Part 4 even though the display workspace is 3',()=>{
  for(const options of[{},{mode:'SERIOUS',preview:true},{assigned:[4]},{assigned:[2,4],mode:'SERIOUS'}]){
    const f=fixture({...options,modern:true});f.vm.tempQuestion=null;f.vm.tempOrdinalNumber=31;f.vm.passageNumber=3;
    assert.equal(f.vm.activeIeltsNavigationPart(),4);assert.deepEqual(f.visible(),ordinals(4));
    const entries=Array.from(f.c.getReadingQuestionEntries());
    assert.equal(entries.length,options.assigned?options.assigned.length*10:40);
    assert.equal(f.all().length,40);
    if(options.assigned){assert.deepEqual(Array.from(f.vm.getIeltsNavigationParts(),p=>p.number),options.assigned);}
    if(options.assigned?.length===2){
      f.vm.openIeltsNavigationPart(f.vm.getIeltsNavigationParts()[0]);assert.deepEqual(f.visible(),ordinals(2));assert.equal(f.vm.passageNumber,2);
      f.vm.openIeltsNavigationPart(f.vm.getIeltsNavigationParts()[1]);assert.deepEqual(f.visible(),ordinals(4));assert.equal(f.vm.passageNumber,3);
    }
  }
});

test('mixed-boundary packages hide their other-part questions without mutating the canonical package',()=>{
  const f=fixture(),pack={subQuestions:f.questions.slice(28,32)},original=pack.subQuestions;
  f.select(30);assert.equal(f.vm.listeningPackageVisible(pack),true);assert.deepEqual(pack.subQuestions.filter(f.vm.listeningQuestionVisible).map(q=>q.ordinalNumber),[29,30]);
  f.select(31);assert.equal(f.vm.listeningPackageVisible(pack),true);assert.deepEqual(pack.subQuestions.filter(f.vm.listeningQuestionVisible).map(q=>q.ordinalNumber),[31,32]);
  assert.equal(pack.subQuestions,original);assert.equal(pack.subQuestions.length,4);
  const reading=fixture({listening:false});reading.select(30);assert.equal(reading.visible().length,40);
  assert.equal(reading.vm.listeningPackageVisible(pack),true);assert.equal(reading.vm.listeningQuestionVisible({ordinalNumber:31}),true);
});

test('Part 3 and Part 4 transcripts follow navigation while retaining both annotation targets',()=>{
  for(const mode of['STUDY','SERIOUS'])for(const assigned of[undefined,[3,4],[4]]){
    const f=fixture({modern:true,mode,assigned}),workspace=f.vm.ieltsReadingActualTest.subQuestions[2];
    const html=workspace.question;
    const transcripts=[...html.matchAll(/<div data-listening-transcript-part="([34])" ng-show="([^"]+)">([\s\S]*?)<\/div>/g)];
    assert.equal(transcripts.length,2);
    for(const part of[3,4]){
      f.select((part-1)*10+1);
      const visible=transcripts.filter(match=>nodeVm.runInContext(match[2],f.c));
      assert.deepEqual(visible.map(match=>Number(match[1])),[part]);
      assert.equal(visible[0][3].replace(/<hr>/g,''),'Part '+part);
      assert.equal(workspace.question,html,'navigation must not rebuild the transcript or erase highlights');
    }
    assert.equal(html.replace(/<[^>]+>/g,''),'Part 3Part 4','annotation text offsets remain stable');
    assert.equal(f.all().length,40);assert.equal(f.mediaReads(),0);
    f.c.normalizeListeningCandidateParts(f.vm.ieltsReadingActualTest);
    assert.equal(workspace.question,html,'normalization is idempotent');
  }
});

test('empty Part 3 transcript does not display Part 4 text and Reading content stays unchanged',()=>{
  const f=fixture(),third=f.vm.ieltsReadingActualTest.subQuestions[2];
  third.question='';
  f.vm.ieltsReadingActualTest.subQuestions.push({id:4,question:'<p>Fourth transcript</p>',subQuestions:[]});
  f.c.normalizeListeningCandidateParts(f.vm.ieltsReadingActualTest);
  assert.match(third.question,/<div data-listening-transcript-part="3" ng-show="vm.activeIeltsNavigationPart\(\) === 3"><\/div>/);
  assert.match(third.question,/<div data-listening-transcript-part="4" ng-show="vm.activeIeltsNavigationPart\(\) === 4"><p>Fourth transcript<\/p><\/div>/);
  const reading=fixture({listening:false}),before=reading.vm.ieltsReadingActualTest.subQuestions.map(p=>p.question);
  reading.c.normalizeListeningCandidateParts(reading.vm.ieltsReadingActualTest);
  assert.deepEqual(reading.vm.ieltsReadingActualTest.subQuestions.map(p=>p.question),before);
});

test('all three rendered workspaces hide packages and rows in place rather than filtering indices or rebuilding answers',()=>{
  const liveView=view.replace(/<!--[\s\S]*?-->/g,'');
  const tags=[...liveView.matchAll(/<(?:div|span|tr)\b[^>]*\bng-repeat="[^"]+"[^>]*>/g)].map(m=>m[0]);
  const packages=tags.filter(tag=>/ng-repeat="item in vm\.ieltsReadingActualTest\.subQuestions\[[0-2]\]\.subQuestions"/.test(tag));
  assert.equal(packages.length,3);packages.forEach(tag=>{assert.match(tag,/ng-show="[^"]*vm\.listeningPackageVisible\(item\)/);assert.doesNotMatch(tag,/ng-if=|\|\s*filter/);});
  const rows=tags.filter(tag=>/ng-repeat="(?:q in item\.subQuestions|endingQuestion in endingPackage\.subQuestions track by \$index)"/.test(tag)&&!tag.includes('$index == 0'));
  assert.equal(rows.length,27);rows.forEach(tag=>{assert.match(tag,/ng-show="vm\.listeningQuestionVisible\((?:q|endingQuestion)\)"/);assert.doesNotMatch(tag,/ng-if="[^"]*listeningQuestionVisible|\|\s*filter/);});
  assert.equal(rows.filter(tag=>tag.includes('track by $index')).length,3);
});
