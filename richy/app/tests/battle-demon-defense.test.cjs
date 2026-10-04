// Run with: node --test richy/app/tests/battle-demon-defense.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

function setup(username = 'alice') {
    let Controller, hooks;
    const timers = [];
    const realtimeCalls = [];
    const battleService = {connectRealtime(...args) { realtimeCalls.push(args); return {then(fn) { fn(true); }}; }};
    const angular = {
        module() { return {controller(name, fn) { Controller = fn; }}; },
        forEach(items, fn) { (items || []).forEach(fn); },
        copy(value) { return JSON.parse(JSON.stringify(value)); }, fromJson: JSON.parse,
        noop() {}, element() { return {on() {}, off() {}}; }
    };
    const source = fs.readFileSync(path.join(__dirname, '../question/controllers/BattleQuizOnlineController.js'), 'utf8');
    const context = nodeVm.createContext({angular, expose(value) { hooks = value; }});
    nodeVm.runInContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/, `
        expose({applyRoom, applyDemonArena, updateDemonDefenseView, buildSettingsDto, processSkillEvents});
    `), context);
    const timer = fn => { timers.push(fn); return timers.length; };
    timer.cancel = () => {};
    const window = {
        location: {origin: 'http://localhost'}, navigator: {},
        document: {body: {classList: {add() {}, remove() {}}}, getElementById() { return null; }},
        localStorage: {getItem() { return null; }, setItem() {}}
    };
    const vm = new Controller({}, {$on() {}, $evalAsync(fn) { fn(); }}, {go() {}}, {}, timer, timer,
        {get() { return JSON.stringify({id: 1, username}); }}, window, {warning() {}, error() {}}, {}, {}, battleService);
    function room() {
        const now = Date.now();
        return {code: 'DEMON1', status: 'PLAYING', hostUsername: 'host', serverTime: now, matchEndsAt: now + 60000,
            settings: {mode: 'DEMON_DEFENSE', teamCount: 2, topicIds: [], topicNames: [], guessLevels: []},
            players: [
                {username: 'host', spectator: true, connected: true},
                {username: 'alice', teamNumber: 1, streak: 23, connected: true},
                {username: 'bob', teamNumber: 1, streak: 35, frozenUntil: now + 3000, connected: true},
                {username: 'carol', teamNumber: 2, streak: 20, frozenUntil: now + 3000, connected: true}
            ], recentEvents: [],
            demonDefense: {startedAt: now - 10000, snapshotAt: now, phase: 'NORMAL', wave: 1,
                teams: [{number: 1, rank: 1, kills: 10, memberCount: 2, danger: false, demons: [], shots: []},
                    {number: 2, rank: 2, kills: 5, memberCount: 1, danger: false, demons: [], shots: []}]}};
    }
    return {vm, hooks, room, realtimeCalls};
}

test('DEMON_DEFENSE is preserved in room settings and requires teams without bonus bullets', () => {
    const h = setup('host');
    h.vm.room = h.room();
    h.vm.hostSettings.mode = 'DEMON_DEFENSE';
    h.vm.hostSettings.teamCount = 0;
    h.vm.hostSettings.doubleActionUsername = 'alice';
    const settings = h.hooks.buildSettingsDto();
    assert.equal(settings.mode, 'DEMON_DEFENSE');
    assert.equal(settings.teamCount, 2);
    assert.equal(settings.doubleActionUsername, '');
    for (const [streak, expected] of [[19, 1], [20, 2], [29, 2], [30, 3], [40, 4]]) {
        assert.equal(h.vm.getDemonBullets({streak}), expected);
    }
    const before = h.vm.getDemonGunX({number: 1}, 'alice');
    h.vm.room.players.reverse();
    assert.equal(h.vm.getDemonGunX({number: 1}, 'alice'), before, 'scoreboard order cannot move a fixed gun');
});

test('a newly promoted host reconnects with the arena subscription', () => {
    const h = setup();
    h.vm.room = h.room();
    const incoming = h.room();
    incoming.hostUsername = 'alice'; incoming.status = 'LOBBY';
    incoming.players[1].spectator = true; incoming.players[1].teamNumber = 0;
    h.hooks.applyRoom(incoming, true);
    assert.equal(h.realtimeCalls.length, 1);
    assert.equal(typeof h.realtimeCalls[0][3], 'function');
});

test('students are warned only for their own living team and cannot see the animation feed', () => {
    const h = setup();
    const room = h.room();
    h.vm.room = room;
    room.demonDefense.teams[1].danger = true;
    h.hooks.updateDemonDefenseView();
    assert.equal(h.vm.demonWarning, '');
    room.demonDefense.teams[0].danger = true;
    h.hooks.updateDemonDefenseView();
    assert.match(h.vm.demonWarning, /ĐỘI MÌNH ĐANG NGUY HIỂM/);
    h.hooks.applyDemonArena(room.demonDefense);
    assert.equal(h.vm.demonArena, null);
    room.demonDefense.teams[0].eliminatedAt = Date.now();
    h.hooks.updateDemonDefenseView();
    assert.equal(h.vm.demonWarning, '');
});

test('unfreeze clears the freeze overlay immediately and break-streak shows the actual deduction', () => {
    const h = setup();
    h.vm.room = h.room();
    h.vm.room.players[1].frozenUntil = Date.now() + 3000;
    h.hooks.processSkillEvents([{id: 1, type: 'FREEZE', actorUsername: 'carol', targetUsername: 'alice'}]);
    assert.equal(h.vm.skillHitEffect.type, 'FREEZE');
    h.vm.room.players[1].frozenUntil = 0;
    h.hooks.processSkillEvents([{id: 2, type: 'UNFREEZE', actorUsername: 'bob', actorDisplayName: 'Bình', targetUsername: 'alice'}]);
    assert.equal(h.vm.skillHitEffect, null, 'a rescued student can see the question immediately');
    assert.match(h.vm.personalSkillNotice.message, /giải băng cho bạn/);
    h.hooks.processSkillEvents([{id: 3, type: 'BREAK_STREAK', amount: 5, actorUsername: 'carol', targetUsername: 'alice'}]);
    assert.equal(h.vm.getActiveSkillEffectTitle(), 'BỊ TRỪ 5 STREAK');
});

test('unfreeze selects only online frozen teammates, excluding self, rivals and eliminated teammates', () => {
    const h = setup();
    h.vm.room = h.room();
    assert.equal(h.vm.getUnfreezeTargets().length, 1);
    assert.equal(h.vm.getUnfreezeTargets()[0].username, 'bob');
    h.vm.room.players[2].demonEliminated = true;
    assert.equal(h.vm.getUnfreezeTargets().length, 0);
    h.vm.room.players[2].demonEliminated = false;
    h.vm.room.players[2].connected = false;
    assert.equal(h.vm.getUnfreezeTargets().length, 0);
});

test('host ignores stale arena frames and accepts a new match', () => {
    const h = setup('host');
    h.vm.room = h.room();
    const arena = h.vm.room.demonDefense;
    h.hooks.applyDemonArena(arena);
    h.hooks.applyDemonArena({...arena, snapshotAt: arena.snapshotAt - 1000, wave: 99});
    assert.equal(h.vm.demonArena.wave, 1);
    h.hooks.applyDemonArena({...arena, startedAt: arena.startedAt + 60000, snapshotAt: arena.snapshotAt + 60000, wave: 2});
    assert.equal(h.vm.demonArena.wave, 2);
});

test('generic updates keep live questions and skills, but elimination clears both', () => {
    const h = setup();
    const previous = h.room();
    previous.currentQuestion = {id: 1, sequence: 1, question: 'Word', answers: [{key: 'A', text: 'Meaning'}]};
    previous.pendingSkillType = 'FREEZE';
    previous.pendingSkillTargetUsernames = ['carol'];
    h.vm.room = previous;
    h.hooks.applyRoom(h.room(), true);
    assert.equal(h.vm.room.currentQuestion.id, 1);
    assert.equal(h.vm.room.pendingSkillType, 'FREEZE');
    const eliminated = h.room();
    eliminated.players[1].demonEliminated = true;
    h.hooks.applyRoom(eliminated, true);
    assert.equal(h.vm.room.currentQuestion, null);
    assert.equal(h.vm.room.pendingSkillType, null);
    assert.equal(h.vm.skillTargetModalOpen, false);
});
