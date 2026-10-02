// Run with: node --test richy/app/tests/battle-host-controls.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

function setup({spectator = true, ready = true, storedVolume = null} = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../question/controllers/BattleQuizOnlineController.js'), 'utf8');
    let Controller, options, player, hooks;
    const calls = [], gestures = {}, storage = new Map();
    if (storedVolume !== null) storage.set('battleHostMusicVolume', String(storedVolume));
    const angular = {
        module() { return {controller(name, fn) { Controller = fn; }}; },
        forEach(items, fn) { (items || []).forEach(fn); },
        fromJson: JSON.parse, copy: value => JSON.parse(JSON.stringify(value)), noop() {},
        element() { return {on(name, fn) { gestures[name] = fn; }, off() {}}; }
    };
    const $window = {
        location: {origin: 'https://battle.example'}, navigator: {},
        localStorage: {getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); }},
        document: {body: {classList: {add() {}, remove() {}}}, getElementById() { return {}; }},
        YT: {
            PlayerState: {PLAYING: 1, PAUSED: 2, ENDED: 0},
            Player: function (id, config) {
                options = config;
                let state = 2, videoId = config.videoId;
                function change(nextState) { state = nextState; config.events.onStateChange({data: state}); }
                player = {
                    setVolume(value) { calls.push(['volume', value]); }, unMute() {},
                    getVideoData() { return {video_id: videoId}; },
                    getPlayerState() { return state; },
                    playVideo() { calls.push(['play']); change(1); },
                    pauseVideo() { calls.push(['pause']); change(2); },
                    stopVideo() { calls.push(['stop']); change(0); },
                    loadVideoById(value) { videoId = value; calls.push(['load', value]); change(1); },
                    cueVideoById(value) { videoId = value; calls.push(['cue', value]); change(2); }
                };
                return player;
            }
        }
    };
    const context = nodeVm.createContext({angular, expose(value) { hooks = value; }});
    // Expose private functions only in this isolated test runtime. No production hooks.
    nodeVm.runInContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/, `
        expose({applyRoom: applyRoom, syncMusic: syncBattleViewMusic, loadConfig: loadBattleViewMusicConfig});
    `), context);
    const timer = () => 1;
    timer.cancel = () => {};
    const scope = {$on() {}, $evalAsync(fn) { fn(); }};
    const instance = new Controller({}, scope, {go() {}}, {}, timer, timer,
        {get() { return JSON.stringify({id: 1, username: 'teacher'}); }}, $window,
        {warning() {}, error() {}}, {}, {},
        {getActiveMusicTracks() { return Promise.resolve({tracks: [
            {videoId: 'firstTrack1', name: 'First song'},
            {videoId: 'secondTrack', name: 'Second song'},
            {videoId: 'thirdTrack3', name: 'Third song'},
            {videoId: 'fourthTrack', name: 'Fourth song'}
        ]}); }});
    function room(status = 'PLAYING') {
        return {code: 'ABC123', hostUsername: 'teacher', status, settings: {mode: 'COUNTDOWN'},
            players: [{username: 'teacher', spectator}], recentEvents: []};
    }
    instance.room = room();
    return {
        instance, hooks, calls, storage, room, gestures, document: $window.document,
        async prepare() { await hooks.loadConfig(); if (ready) this.markReady(); },
        markReady() { options.events.onReady({target: player}); },
        end() { options.events.onStateChange({data: 0}); },
        error() { options.events.onError(); }
    };
}

test('QR stays open through START and repeated live room updates, closes on FINISHED', async () => {
    const h = setup();
    h.instance.room = h.room('LOBBY');
    h.instance.openQrModal();
    assert.equal(h.instance.qrModalOpen, true);
    assert.equal(h.instance.roomLink, 'https://battle.example/battle-quiz-online/ABC123');
    h.hooks.applyRoom(h.room(), true);
    for (let index = 0; index < 5; index++) h.hooks.applyRoom(h.room(), true);
    assert.equal(h.instance.qrModalOpen, true);
    h.instance.closeQrModal();
    h.instance.openQrModal();
    h.hooks.applyRoom(h.room(), false);
    assert.equal(h.instance.qrModalOpen, true);
    h.instance.room = h.room('FINISHED');
    h.hooks.applyRoom(h.room('FINISHED'), false);
    assert.equal(h.instance.qrModalOpen, false);
});

test('manual pause survives live syncs, page gestures, ended/error events; play resumes', async () => {
    const h = setup();
    await h.prepare();
    assert.equal(h.instance.musicPlaying, true);
    h.instance.toggleMusicPlayback();
    assert.equal(h.instance.musicPausedByUser, true);
    const length = h.calls.length;
    h.hooks.syncMusic();
    h.gestures.click();
    h.end();
    h.error();
    assert.equal(h.calls.length, length);
    h.instance.toggleMusicPlayback();
    assert.equal(h.instance.musicPausedByUser, false);
    assert.equal(h.instance.musicPlaying, true);
});

test('configured tracks beyond three can be selected and previous/next wrap around', async () => {
    const h = setup();
    await h.prepare();
    assert.equal(h.instance.musicTracks.length, 4);
    h.instance.selectMusicTrack(h.instance.musicTracks[3]);
    assert.equal(h.instance.getMusicTrackName(), 'Fourth song');
    h.instance.skipMusicTrack(1);
    assert.equal(h.instance.getMusicTrackName(), 'First song');
    h.instance.skipMusicTrack(-1);
    assert.equal(h.instance.getMusicTrackName(), 'Fourth song');
    h.instance.toggleMusicPlayback();
    h.instance.selectMusicTrack(h.instance.musicTracks[1]);
    assert.equal(h.instance.getMusicTrackName(), 'Second song');
    assert.equal(h.instance.musicPlaying, false);
    assert.deepEqual(h.calls.at(-1), ['cue', 'secondTrack']);
});

test('saved volume is restored and not overwritten by automatic sync', async () => {
    const h = setup({storedVolume: 23});
    await h.prepare();
    assert.ok(h.calls.some(call => call[0] === 'volume' && call[1] === 23));
    h.instance.musicVolume = 0;
    h.instance.updateMusicVolume();
    h.hooks.syncMusic();
    assert.equal(h.storage.get('battleHostMusicVolume'), '0');
    assert.deepEqual(h.calls.at(-1), ['volume', 0]);
});

test('selection and pause before YouTube is ready are preserved on ready', async () => {
    const h = setup({ready: false});
    await h.prepare();
    h.instance.selectMusicTrack(h.instance.musicTracks[3]);
    h.instance.musicPausedByUser = true;
    h.markReady();
    assert.equal(h.instance.getMusicTrackName(), 'Fourth song');
    assert.equal(h.instance.musicPlaying, false);
    assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
});

test('host who participates can still play music', async () => {
    const h = setup({spectator: false});
    await h.prepare();
    assert.equal(h.instance.musicPlaying, true);
});

test('music modal works for spectator and participating hosts in every mode and survives live updates', () => {
    for (const spectator of [true, false]) {
        for (const mode of ['CLASSIC', 'COUNTDOWN', 'MONEY_BEG', 'ESCAPE_DUMB_DEMON', 'GUESS_WORD']) {
            const h = setup({spectator});
            const room = h.room();
            room.settings.mode = mode;
            room.currentQuestion = {id: 1, answers: []};
            h.instance.room = room;
            h.instance.openMusicModal();
            assert.equal(h.instance.musicMenuOpen, true, `${mode}, spectator=${spectator}`);
            h.hooks.applyRoom(room, true);
            assert.equal(h.instance.musicMenuOpen, true);
            h.hooks.applyRoom({...room, status: 'FINISHED'}, true);
            assert.equal(h.instance.musicMenuOpen, false);
        }
    }
    const h = setup();
    h.instance.room.status = 'LOBBY';
    h.instance.openMusicModal();
    assert.equal(h.instance.musicMenuOpen, false);
    h.instance.room.status = 'PLAYING';
    h.instance.room.hostUsername = 'someone-else';
    h.instance.openMusicModal();
    assert.equal(h.instance.musicMenuOpen, false);
});

test('closing music modal with Escape restores trigger focus and keeps the music playing', async () => {
    const h = setup();
    await h.prepare();
    let restoredFocus = false;
    h.instance.openMusicModal({currentTarget: {focus() { restoredFocus = true; }}});
    const length = h.calls.length;
    let prevented = false;
    h.gestures.keydown({key: 'Escape', preventDefault() { prevented = true; }});
    assert.equal(h.instance.musicMenuOpen, false);
    assert.equal(prevented, true);
    assert.equal(restoredFocus, true);
    assert.equal(h.instance.musicPlaying, true);
    assert.equal(h.calls.length, length);
});

test('music modal traps Tab focus and blocks quiz answer shortcuts for a participating host', () => {
    const h = setup({spectator: false});
    let focused;
    const first = {focus() { focused = first; }};
    const last = {focus() { focused = last; }};
    h.document.getElementById = () => ({querySelectorAll: () => [first, last], contains: () => true});
    h.instance.openMusicModal();
    h.instance.room.currentQuestion = {answers: [{id: 1}]};
    h.gestures.keydown({key: '1', preventDefault() { assert.fail('Quiz shortcut must be ignored'); }});
    h.document.activeElement = last;
    let prevented = 0;
    h.gestures.keydown({key: 'Tab', preventDefault() { prevented++; }});
    assert.equal(focused, first);
    h.document.activeElement = first;
    h.gestures.keydown({key: 'Tab', shiftKey: true, preventDefault() { prevented++; }});
    assert.equal(focused, last);
    assert.equal(prevented, 2);
});

test('repeat all is the default and cycles through all configured tracks', async () => {
    const h = setup();
    await h.prepare();
    assert.equal(h.instance.musicRepeatMode, 'ALL');
    h.instance.selectMusicTrack(h.instance.musicTracks[0]);
    h.calls.length = 0;
    for (let index = 0; index < 4; index++) h.end();
    const loaded = h.calls.filter(call => call[0] === 'load').map(call => call[1]);
    assert.equal(new Set(loaded).size, 4);
});

test('repeat one replays the current song; switching back resumes repeat all', async () => {
    const h = setup();
    await h.prepare();
    h.instance.selectMusicTrack(h.instance.musicTracks[3]);
    h.instance.toggleMusicRepeat();
    assert.equal(h.instance.musicRepeatMode, 'ONE');
    for (let index = 0; index < 3; index++) {
        h.end();
        assert.deepEqual(h.calls.filter(call => call[0] === 'load').at(-1), ['load', 'fourthTrack']);
        assert.equal(h.instance.getMusicTrackName(), 'Fourth song');
    }
    h.instance.toggleMusicPlayback();
    const length = h.calls.length;
    h.end();
    assert.equal(h.calls.length, length);
    h.instance.toggleMusicPlayback();
    h.instance.toggleMusicRepeat();
    assert.equal(h.instance.musicRepeatMode, 'ALL');
    h.calls.length = 0;
    for (let index = 0; index < 4; index++) h.end();
    assert.equal(new Set(h.calls.filter(call => call[0] === 'load').map(call => call[1])).size, 4);
});

test('password guessing uses a full-width modal and single-column mobile choices with larger text', () => {
    const template = fs.readFileSync(path.join(__dirname, '../question/views/battle_quiz_online.html'), 'utf8');
    assert.match(template, /class="battle-online-skill-modal battle-online-password-modal battle-online-password-guess-modal"\s+role="dialog"\s+aria-modal="true"\s+aria-label="Đoán mật khẩu đối thủ"/);
    assert.match(template, /\.battle-online-password-modal\.battle-online-password-guess-modal\s*\{\s*width: 100%;/);
    assert.match(template, /\.battle-online-password-guess-group \.battle-online-password-option\s*\{\s*width: 100%;/);
    const groupRules = [...template.matchAll(/\.battle-online-password-guess-group > div\s*\{([^}]+)\}/g)];
    assert.match(groupRules.at(-1)[1], /grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(template, /\.battle-online-password-option\.is-guess strong\s*\{\s*font-size: 22px;/);
    assert.match(template, /\.battle-online-password-guess-group\s+\.battle-online-password-option strong\s*\{\s*font-size: 16px;/);
});
