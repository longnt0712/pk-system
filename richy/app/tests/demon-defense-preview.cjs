// Local visual QA using the production controller/templates and disposable fixture data.
// node richy/app/tests/demon-defense-preview.cjs
// http://127.0.0.1:8099/?role=host or ?role=student
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const appRoot = path.resolve(__dirname, '..');

const page = `<!doctype html><html lang="vi" ng-app="demonPreview"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Diệt quỷ ngu — Kiểm tra giao diện</title>
<link rel="stylesheet" href="/assets/css/external/bootstrap.min.css">
<link rel="stylesheet" href="/assets/css/external/font-awesome.min.css">
<style>body{background:#eef2f7;padding:16px;font-family:Arial,sans-serif}.preview-tools{max-width:1440px;margin:0 auto 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.preview-tools a,.preview-tools button{padding:8px;border:1px solid #bbc;background:white;border-radius:6px}.preview-tools small{color:#657}</style>
</head><body><div class="preview-tools"><small>DỮ LIỆU THỬ GIAO DIỆN</small><a href="/?role=host">Màn hình host</a><a href="/?role=student">Màn hình học sinh</a><a href="/?role=student&skill=FREEZE">Chọn mục tiêu skill</a><a href="/?role=student&phase=WARNING">Cảnh báo bầy quỷ</a></div>
<div ng-controller="BattleQuizOnlineController as vm"><ng-include src="'question/views/battle_quiz_online.html'"></ng-include></div>
<script src="/assets/scripts/external/angular.min.js"></script>
<script>
var params=new URLSearchParams(location.search), role=params.get('role')||'host';
var username=role==='host'?'host':'alice', fixtureVm, applyFixture;
angular.module('Hrm.Question',[]);
angular.module('demonPreview',['Hrm.Question'])
.value('$state',{go:function(){}}).value('$stateParams',{})
.value('$cookies',{get:function(){return JSON.stringify({id:1,username:username});}})
.value('toastr',{warning:function(){},error:function(){},success:function(){}}).value('blockUI',{})
.value('QuestionService',{})
.factory('BattleQuizOnlineService',function($q){return {
  getRoom:function(){return $q.when(fixtureVm.room);},
  useSkill:function(code,target,type){
    var room=angular.copy(fixtureVm.room), me=room.players.filter(function(p){return p.username===username;})[0];
    var opponent=room.players.filter(function(p){return p.username===target;})[0];
    if(type==='UNFREEZE'){opponent.frozenUntil=0;me.unfreezeCharges=0;}
    else if(room.pendingSkillType==='BREAK_STREAK'){opponent.streak=Math.max(0,opponent.streak-5);}
    else{opponent.frozenUntil=Date.now()+3000;}
    room.pendingSkillType=null;room.pendingSkillTargetUsernames=[];
    room.currentQuestion=question();return $q.when(room);
  },
  answer:function(code,id,key){var room=angular.copy(fixtureVm.room), correct=key==='A';
    var me=room.players.filter(function(p){return p.username===username;})[0];
    me.streak=correct?me.streak+1:0;room.currentQuestion=question();room.currentQuestion.sequence++;
    return $q.when({correct:correct,correctAnswer:'lòng can đảm',message:correct?'CHÍNH XÁC!':'SAI RỒI! Streak về 0.',room:room});
  }
};});
function question(){return {id:7,sequence:1,question:'courage',pronounce:'/ˈkʌrɪdʒ/',answers:[
{key:'A',text:'lòng can đảm'},{key:'B',text:'sự tò mò'},{key:'C',text:'sự yên lặng'},{key:'D',text:'lòng biết ơn'}]};}
window.setupDemonFixture=function(vm,applyRoom,applyArena){
 fixtureVm=vm;applyFixture=applyRoom;var now=Date.now();
 var room={code:'DEMON1',hostUsername:'host',status:'PLAYING',serverTime:now,matchEndsAt:now+180000,totalQuestions:100,totalLessonWords:100,
 settings:{mode:'DEMON_DEFENSE',teamCount:2,countdownMinutes:3,wrongAnswerFreezeSeconds:3,topicIds:[],topicNames:['Từ vựng thử nghiệm'],guessLevels:[]},
 players:[{username:'host',displayName:'Giáo viên',host:true,spectator:true,connected:true},
 {username:'alice',displayName:'An',teamNumber:1,streak:23,score:18,connected:true,unfreezeCharges:1},
 {username:'bob',displayName:'Bình',teamNumber:1,streak:35,score:27,connected:true,frozenUntil:now+3000},
 {username:'carol',displayName:'Chi',teamNumber:2,streak:29,score:22,connected:true},
 {username:'david',displayName:'Dũng',teamNumber:2,streak:12,score:10,connected:true}],recentEvents:[
 {id:1,type:'FREEZE',actorUsername:'carol',actorDisplayName:'Chi',targetUsername:'bob',targetDisplayName:'Bình',createdAt:now-4000}],
 currentQuestion:role==='student'?question():null,
 demonDefense:{startedAt:now-45000,snapshotAt:now,dangerProgress:.75,wave:2,phase:params.get('phase')||'NORMAL',warningSeconds:3,finished:false,teams:[
 {number:1,rank:1,memberCount:2,kills:45,rescues:2,survivedMs:45000,danger:true,nearestDemonProgress:.79,nearestDemonSpeed:0,eliminatedAt:0,
 demons:[{id:1,progress:.79,speed:0,fast:false},{id:2,progress:.52,speed:0,fast:true},{id:11,progress:.22,speed:0,fast:false,tough:true,health:2}],shots:[]},
 {number:2,rank:2,memberCount:2,kills:32,rescues:1,survivedMs:45000,danger:false,nearestDemonProgress:.56,nearestDemonSpeed:0,eliminatedAt:0,
 demons:[{id:1,progress:.56,speed:0,fast:false,tough:true,health:1},{id:2,progress:.28,speed:0,fast:true}],shots:[]}]}};
 if(params.get('phase')){room.demonDefense.teams[0].danger=false;room.demonDefense.teams[0].nearestDemonProgress=.52;}
 if(params.get('skill')){room.pendingSkillType=params.get('skill');room.pendingSkillTargetUsernames=['carol','david'];room.currentQuestion=null;}
 applyRoom(room,false);if(role==='host'){applyArena(room.demonDefense);}vm.demonWarningSound=false;
};
</script><script src="/preview-controller.js"></script></body></html>`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page); return; }
    if (url.pathname === '/preview-controller.js') {
        const source = fs.readFileSync(path.join(appRoot, 'question/controllers/BattleQuizOnlineController.js'), 'utf8');
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.end(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/,
            'window.setupDemonFixture(vm, applyRoom, applyDemonArena);')); return;
    }
    const file = path.resolve(appRoot, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(appRoot + path.sep)) { res.writeHead(403).end(); return; }
    const type = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'}[path.extname(file)];
    if (type) { res.setHeader('Content-Type', type + '; charset=utf-8'); }
    fs.readFile(file, (error, content) => { if (error) { res.writeHead(404).end(); } else { res.end(content); } });
});
server.listen(8099, '127.0.0.1', () => process.stdout.write('Demon defense visual QA: http://127.0.0.1:8099/\n'));
