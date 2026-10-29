// Run with: node --test richy/app/tests/learning-pet-evolution.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const assets = path.join(__dirname, '../assets/images/learning-pets');
const timer = () => 1;
timer.cancel = () => {};

function petClock(iso = '2026-02-01T00:00:00Z') {
    let timestamp = Date.parse(iso);
    class PetDate extends Date {
        constructor(...args) { super(...(args.length ? args : [timestamp])); }
        static now() { return timestamp; }
    }
    return {Date: PetDate, set(iso) { timestamp = Date.parse(iso); }};
}

function setupLearningPet(level, selected = 'CUTE_JERRY_MOUSE', storage = new Map(), roles = [], clock = petClock()) {
    let factory, hooks;
    let user = {id: 7, vocabularyExperienceLevel: level, selectedLearningPet: selected, roles};
    const requests = [], broadcasts = [];
    const state = {current: {name: 'application.dashboard'}};
    const angular = {
        module() { return {directive(name, fn) { factory = fn; }}; },
        noop() {}, fromJson: JSON.parse, isArray: Array.isArray, copy: value => JSON.parse(JSON.stringify(value)),
        forEach(items, fn) { items.forEach(fn); }
    };
    const source = fs.readFileSync(path.join(__dirname, '../common/utils/learning-pet.directive.js'), 'utf8');
    const context = nodeVm.createContext({angular, Date: clock.Date, window: {APP_VERSION: 'pet-test'}, expose(value) { hooks = value; }});
    nodeVm.runInContext(source.replace('var permissionsListener =',
        'expose({form: updatePetForm, message: updateMessage, parseDraft: parseDraft, shouldDisplay: shouldDisplay, activeTasks: activeAssignedTasks, scheduleSeason: schedulePetSeasonUpdate}); var permissionsListener ='), context);
    const $http = {post(url, body) {
        requests.push({url, body});
        return Promise.resolve({data: {selectedPetKey: body.petKey}});
    }};
    const $window = {
        localStorage: {getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); }},
        sessionStorage: {getItem() { return null; }, setItem() {}},
        addEventListener() {}, removeEventListener() {}
    };
    const cookies = {get() { return JSON.stringify(user); }, putObject(key, value) { user = value; }};
    const rootScope = {$on() { return () => {}; }, $broadcast(name, value) { broadcasts.push([name, value]); }};
    const scope = {$on() { return () => {}; }};
    const scheduled = [];
    const timeout = (fn, delay) => { scheduled.push({fn, delay}); return scheduled.length; };
    timeout.cancel = () => {};
    const definition = factory($http, {}, state, timeout, timer, $window, cookies, rootScope,
        {ieltsRoom: true, api: {baseUrl: '/api/', apiV1Url: 'v1/'}});
    const pet = {};
    definition.controller.call(pet, scope);
    hooks.form(user);
    hooks.message();
    return {pet, hooks, storage, requests, broadcasts, state, clock, scheduled, user: () => user};
}

function setupBattle(level, roles = [], clock = petClock()) {
    let Controller;
    const angular = {
        module() { return {controller(name, fn) { Controller = fn; }}; },
        forEach(items, fn) { (items || []).forEach(fn); },
        fromJson: JSON.parse, copy: value => JSON.parse(JSON.stringify(value)), noop() {},
        element() { return {on() {}, off() {}}; }
    };
    const source = fs.readFileSync(path.join(__dirname, '../question/controllers/BattleQuizOnlineController.js'), 'utf8');
    const context = nodeVm.createContext({angular, Date: clock.Date});
    nodeVm.runInContext(source.replace(/loadBattleViewMusicConfig\(\);\s*getPageTopicCategory\(\);/, ''), context);
    const $window = {
        APP_VERSION: 'pet-test', location: {origin: 'https://battle.example'}, navigator: {},
        localStorage: {getItem() { return null; }, setItem() {}},
        document: {body: {classList: {add() {}, remove() {}}}, getElementById() { return {}; }}
    };
    return new Controller({}, {$on() {}, $evalAsync(fn) { fn(); }}, {}, {}, timer, timer,
        {get() { return JSON.stringify({id: 7, username: 'student', vocabularyExperienceLevel: level, roles}); }},
        $window, {}, {}, {}, {});
}

test('Jerry is unavailable before level 12 even with a stale saved selection', () => {
    const {pet} = setupLearningPet(11);
    assert.equal(pet.selectedPetKey, 'MAM_HOC');
    assert.equal(pet.availablePets.some(item => item.key === 'CUTE_JERRY_MOUSE'), false);
    assert.equal(pet.hasNewJerryMouseEgg, false);
    assert.equal(setupBattle(11).getBattlePetOptions().some(item => item.key === 'CUTE_JERRY_MOUSE'), false);
});

test('both pet displays use the same Jerry stage at levels 12, 13, 14 and later', () => {
    for (const [level, filename, form, label] of [
        [12, 'egg-level-12.png', 'jerry-mouse-egg', 'Trứng Chuột Jerry'],
        [13, 'egg-level-13.png', 'jerry-mouse-egg', 'Trứng Chuột Jerry đang nứt'],
        [14, 'pet-level-14.png', 'jerry-mouse-hatched', 'Chuột Jerry'],
        [20, 'pet-level-14.png', 'jerry-mouse-hatched', 'Chuột Jerry']
    ]) {
        const {pet} = setupLearningPet(level);
        const battle = setupBattle(level);
        assert.equal(pet.petForm, form);
        const expected = 'assets/images/learning-pets/jerry-mouse/' + filename + '?v=pet-test';
        assert.equal(pet.petImage, expected);
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'CUTE_JERRY_MOUSE', vocabularyExperienceLevel: level}), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'CUTE_JERRY_MOUSE').label, label);
        assert.strictEqual(battle.getBattlePetOptions(), options, 'option reference stays stable between digests');
        assert.equal(options.length, level >= 21 ? 17 : (level >= 20 ? 16 : (level >= 18 ? 15 : (level >= 15 ? 14 : 13))), 'earlier pets stay available');
    }
});

test('selecting Jerry persists the choice and acknowledges its new egg for this user', async () => {
    const h = setupLearningPet(12, 'CUTE_TOM_CAT');
    assert.equal(h.pet.hasNewJerryMouseEgg, true);
    assert.match(h.pet.message, /Level 12.*Level 13.*level 14/);
    h.pet.selectPet('CUTE_JERRY_MOUSE');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.petKey, 'CUTE_JERRY_MOUSE');
    assert.equal(h.user().selectedLearningPet, 'CUTE_JERRY_MOUSE');
    assert.equal(h.pet.selectedPetKey, 'CUTE_JERRY_MOUSE');
    assert.equal(h.pet.hasNewJerryMouseEgg, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'CUTE_JERRY_MOUSE').isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'CUTE_JERRY_MOUSE']]);
    assert.equal(setupLearningPet(12, 'CUTE_JERRY_MOUSE', h.storage).pet.hasNewJerryMouseEgg, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 12, selectedLearningPet: 'CUTE_JERRY_MOUSE'});
    assert.equal(h.pet.hasNewJerryMouseEgg, true, 'another user has their own unread state');
});

test('Tom retains its three existing levels and can be selected after Jerry unlocks', () => {
    for (const [level, file] of [[9, 'egg-level-9.png'], [10, 'egg-level-10.png'], [11, 'pet-level-11.png'], [14, 'pet-level-11.png']]) {
        const {pet} = setupLearningPet(level, 'CUTE_TOM_CAT');
        const expected = 'assets/images/learning-pets/cute-tom-cat/' + file + '?v=pet-test';
        assert.equal(pet.petImage, expected);
        assert.equal(setupBattle(level).getPlayerPetImage({selectedPetKey: 'CUTE_TOM_CAT', vocabularyExperienceLevel: level}), expected);
    }
});

test('the evolution manifests reference packaged transparent PNGs', () => {
    for (const folder of ['cute-tom-cat', 'jerry-mouse', 'tuffy-mouse', 'pikachu', 'perry']) {
        const manifest = JSON.parse(fs.readFileSync(path.join(assets, folder, 'pet.json'), 'utf8'));
        for (const stage of manifest.evolution) {
            const png = fs.readFileSync(path.join(assets, folder, stage.file));
            assert.equal(png.subarray(1, 4).toString(), 'PNG');
            assert.ok(png.readUInt32BE(16) >= 512);
            assert.equal(png.readUInt32BE(20), png.readUInt32BE(16), 'square pet artwork');
            assert.equal(png[25], 6, 'RGBA image retains transparency');
        }
    }
});


test('admins can choose every fully evolved pet at level zero without gaining experience', async () => {
    const roles = [{name: 'ROLE_ADMIN'}];
    for (const [key, file] of [
        ['MAM_HOC', 'pet-hatched-fallback.png'],
        ['CAPYBARA_EGG', 'pet-level-5.png'],
        ['CUTE_DOG', 'pet-level-8.png'],
        ['CUTE_TOM_CAT', 'pet-level-11.png'],
        ['CUTE_JERRY_MOUSE', 'pet-level-14.png'],
        ['CUTE_TUFFY_MOUSE', 'pet-level-17.png'],
        ['CUTE_PIKACHU', 'pet-level-20.png'],
        ['CUTE_PERRY', 'pet-level-4.png'],
        ['SPARKLING_LIGHTNING', 'sparkling-lightning/pet-level-20.png'],
        ['HALLOWEEN_PUMPKIN', 'halloween-pumpkin/pet.png'],
        ['GOKU_KID', 'goku-kid/pet-level-22.png'],
        ['GOKU_SSJ1', 'goku-kid/pet-level-23.png'],
        ['GOKU_SSJ2', 'goku-kid/pet-level-24.svg'],
        ['GOKU_SSJ4', 'goku-kid/pet-level-25.png']
    ]) {
        const h = setupLearningPet(0, key, new Map(), roles);
        assert.equal(h.pet.selectedPetKey, key);
        assert.equal(h.pet.availablePets.length, 21);
        assert.match(h.pet.availablePets.find(item => item.key === key).image, new RegExp(file));
        assert.equal(h.pet.notificationCount, 0, 'bypassing levels does not announce level-up eggs');
        assert.equal(h.user().vocabularyExperienceLevel, 0);
    }
    const h = setupLearningPet(0, 'MAM_HOC', new Map(), roles);
    h.pet.selectPet('CUTE_JERRY_MOUSE');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.user().selectedLearningPet, 'CUTE_JERRY_MOUSE');
    assert.equal(h.user().vocabularyExperienceLevel, 0);
    assert.match(h.pet.petImage, /pet-level-14.png/);
});

test('the battle picker unlocks grown pets only for admins and keeps other players stages intact', () => {
    const admin = setupBattle(0, [{name: 'ROLE_ADMIN'}]);
    const options = admin.getBattlePetOptions();
    assert.equal(options.length, 21);
    assert.strictEqual(admin.getBattlePetOptions(), options);
    assert.equal(options.find(item => item.key === 'CUTE_JERRY_MOUSE').label, 'Chuột Jerry');
    assert.match(admin.getBattlePetOptionImage('CUTE_JERRY_MOUSE'), /pet-level-14.png/);
    assert.equal(options.find(item => item.key === 'CUTE_TUFFY_MOUSE').label, 'Chuột Tuffy');
    assert.match(admin.getBattlePetOptionImage('CUTE_TUFFY_MOUSE'), /pet-level-17.png/);
    assert.equal(options.find(item => item.key === 'CUTE_PIKACHU').label, 'Pikachu');
    assert.match(admin.getBattlePetOptionImage('CUTE_PIKACHU'), /pet-level-20.png/);
    assert.equal(options.find(item => item.key === 'CUTE_PERRY').label, 'Perry');
    assert.match(admin.getBattlePetOptionImage('CUTE_PERRY'), /perry\/pet-level-4.png/);
    assert.equal(options.find(item => item.key === 'SPARKLING_LIGHTNING').label, 'Tia sét lấp lánh');
    assert.match(admin.getBattlePetOptionImage('SPARKLING_LIGHTNING'), /sparkling-lightning\/pet-level-20.png/);
    assert.match(admin.getPlayerPetImage({username: 'student', selectedPetKey: 'CUTE_TOM_CAT', vocabularyExperienceLevel: 0}), /pet-level-11.png/);
    assert.match(admin.getPlayerPetImage({username: 'another-student', selectedPetKey: 'MAM_HOC', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
    assert.equal(admin.currentUser.vocabularyExperienceLevel, 0);
    // Losing admin access at the same real level must invalidate the options cache.
    admin.currentUser.roles = [{name: 'ROLE_STUDENT'}];
    assert.equal(admin.getBattlePetOptions().length, 1);
    const student = setupBattle(0, [{name: 'ROLE_STUDENT'}]);
    assert.match(student.getPlayerPetImage({username: 'admin', allPetsUnlocked: true, selectedPetKey: 'CUTE_JERRY_MOUSE', vocabularyExperienceLevel: 0}), /pet-level-14.png/);
    assert.match(student.getPlayerPetImage({username: 'admin', allPetsUnlocked: true, selectedPetKey: 'CUTE_TUFFY_MOUSE', vocabularyExperienceLevel: 0}), /pet-level-17.png/);
    assert.match(student.getPlayerPetImage({username: 'admin', allPetsUnlocked: true, selectedPetKey: 'CUTE_PIKACHU', vocabularyExperienceLevel: 0}), /pet-level-20.png/);
    assert.match(student.getPlayerPetImage({username: 'student', host: true, selectedPetKey: 'CUTE_PIKACHU', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
    assert.match(student.getPlayerPetImage({username: 'student', host: true, selectedPetKey: 'CUTE_JERRY_MOUSE', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
    assert.equal(student.getBattlePetOptions().length, 1);
});

test('Tuffy is locked before level 15 and stale selection falls back to the first pet', () => {
    const {pet} = setupLearningPet(14, 'CUTE_TUFFY_MOUSE');
    assert.equal(pet.selectedPetKey, 'MAM_HOC');
    assert.equal(pet.hasNewTuffyMouseEgg, false);
    assert.equal(pet.availablePets.some(item => item.key === 'CUTE_TUFFY_MOUSE'), false);
    const battle = setupBattle(14);
    assert.equal(battle.getBattlePetOptions().some(item => item.key === 'CUTE_TUFFY_MOUSE'), false);
    assert.match(battle.getPlayerPetImage({selectedPetKey: 'CUTE_TUFFY_MOUSE', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
});

test('Tuffy evolves at levels 15, 16 and 17 consistently in the assistant and battle', () => {
    for (const [level, filename, form, label] of [
        [15, 'egg-level-15.png', 'tuffy-mouse-egg', 'Trứng Chuột Tuffy'],
        [16, 'egg-level-16.png', 'tuffy-mouse-egg', 'Trứng Chuột Tuffy đang nứt'],
        [17, 'pet-level-17.png', 'tuffy-mouse-hatched', 'Chuột Tuffy'],
        [20, 'pet-level-17.png', 'tuffy-mouse-hatched', 'Chuột Tuffy']
    ]) {
        const {pet} = setupLearningPet(level, 'CUTE_TUFFY_MOUSE');
        const battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/tuffy-mouse/' + filename + '?v=pet-test';
        assert.equal(pet.petForm, form);
        assert.equal(pet.petImage, expected);
        assert.equal(pet.selectedPet().image, expected);
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'CUTE_TUFFY_MOUSE', vocabularyExperienceLevel: level}), expected);
        assert.equal(battle.getBattlePetOptionImage('CUTE_TUFFY_MOUSE'), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'CUTE_TUFFY_MOUSE').label, label);
        assert.strictEqual(battle.getBattlePetOptions(), options);
        assert.equal(options.length, level >= 21 ? 17 : (level >= 20 ? 16 : (level >= 18 ? 15 : 14)));
        if (level <= 17) {
            assert.equal(battle.getGiftRewardImage(level), expected);
            assert.match(battle.getGiftRewardLabel(level), /Chuột Tuffy/);
        }
    }
});

test('selecting Tuffy persists the choice and acknowledges the new egg per user', async () => {
    const h = setupLearningPet(15, 'CUTE_JERRY_MOUSE');
    assert.equal(h.pet.hasNewTuffyMouseEgg, true);
    assert.match(h.pet.message, /Level 15.*Level 16.*level 17/);
    h.pet.selectPet('CUTE_TUFFY_MOUSE');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].body.petKey, 'CUTE_TUFFY_MOUSE');
    assert.equal(h.user().selectedLearningPet, 'CUTE_TUFFY_MOUSE');
    assert.equal(h.pet.selectedPetKey, 'CUTE_TUFFY_MOUSE');
    assert.equal(h.pet.hasNewTuffyMouseEgg, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'CUTE_TUFFY_MOUSE').isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'CUTE_TUFFY_MOUSE']]);
    assert.equal(setupLearningPet(15, 'CUTE_TUFFY_MOUSE', h.storage).pet.hasNewTuffyMouseEgg, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 15, selectedLearningPet: 'CUTE_TUFFY_MOUSE'});
    assert.equal(h.pet.hasNewTuffyMouseEgg, true);
});

test('Pikachu is locked below level 18 even with a stale saved selection', () => {
    const {pet} = setupLearningPet(17, 'CUTE_PIKACHU');
    assert.equal(pet.selectedPetKey, 'MAM_HOC');
    assert.equal(pet.hasNewPikachuEgg, false);
    assert.equal(pet.availablePets.some(item => item.key === 'CUTE_PIKACHU'), false);
    const battle = setupBattle(17);
    assert.equal(battle.getBattlePetOptions().some(item => item.key === 'CUTE_PIKACHU'), false);
    assert.match(battle.getPlayerPetImage({selectedPetKey: 'CUTE_PIKACHU', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
});

test('Pikachu evolves consistently in the assistant, battle and reward preview', () => {
    for (const [level, filename, form, label] of [
        [18, 'egg-level-18.png', 'pikachu-egg', 'Trứng Pikachu'],
        [19, 'egg-level-19.png', 'pikachu-egg', 'Trứng Pikachu đang nứt'],
        [20, 'pet-level-20.png', 'pikachu-hatched', 'Pikachu'],
        [25, 'pet-level-20.png', 'pikachu-hatched', 'Pikachu']
    ]) {
        const {pet} = setupLearningPet(level, 'CUTE_PIKACHU');
        const battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/pikachu/' + filename + '?v=pet-test';
        assert.equal(pet.petForm, form);
        assert.equal(pet.petImage, expected);
        assert.equal(pet.selectedPet().image, expected);
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'CUTE_PIKACHU', vocabularyExperienceLevel: level}), expected);
        assert.equal(battle.getBattlePetOptionImage('CUTE_PIKACHU'), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'CUTE_PIKACHU').label, label);
        assert.strictEqual(battle.getBattlePetOptions(), options);
        assert.equal(options.length, level >= 25 ? 20 : (level >= 24 ? 19 : (level >= 23 ? 18 : (level >= 21 ? 17 : (level >= 20 ? 16 : 15)))));
        assert.ok(options.some(item => item.key === 'CUTE_TUFFY_MOUSE'));
        if (level <= 20) {
            assert.equal(battle.getGiftRewardImage(level), expected);
            assert.match(battle.getGiftRewardLabel(level), /Pikachu/);
        }
    }
});

test('selecting Pikachu saves the choice and acknowledges its new egg per user', async () => {
    const h = setupLearningPet(18, 'CUTE_TUFFY_MOUSE');
    assert.equal(h.pet.hasNewPikachuEgg, true);
    assert.match(h.pet.message, /Level 18.*Level 19.*level 20/);
    h.pet.selectPet('CUTE_PIKACHU');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].url, '/api/v1/battle-online/pet-selection');
    assert.equal(h.requests[0].body.petKey, 'CUTE_PIKACHU');
    assert.equal(h.user().selectedLearningPet, 'CUTE_PIKACHU');
    assert.equal(h.pet.selectedPetKey, 'CUTE_PIKACHU');
    assert.equal(h.pet.hasNewPikachuEgg, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'CUTE_PIKACHU').isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'CUTE_PIKACHU']]);
    assert.equal(setupLearningPet(18, 'CUTE_PIKACHU', h.storage).pet.hasNewPikachuEgg, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 18, selectedLearningPet: 'CUTE_PIKACHU'});
    assert.equal(h.pet.hasNewPikachuEgg, true);
});

test('opening the assistant acknowledges the Pikachu notification', () => {
    const h = setupLearningPet(18, 'CUTE_TUFFY_MOUSE');
    assert.equal(h.pet.hasNewPikachuEgg, true);
    h.pet.openPanel();
    assert.equal(h.pet.hasNewPikachuEgg, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'CUTE_PIKACHU').isNew, false);
    assert.equal(h.pet.notificationCount, 0);
});

test('Perry is locked below level four and is fully formed at every unlocked level', () => {
    const locked = setupLearningPet(3, 'CUTE_PERRY').pet;
    assert.equal(locked.selectedPetKey, 'MAM_HOC');
    assert.equal(locked.hasNewPerry, false);
    assert.equal(locked.availablePets.some(item => item.key === 'CUTE_PERRY'), false);
    assert.equal(setupBattle(3).getBattlePetOptions().some(item => item.key === 'CUTE_PERRY'), false);
    for (const level of [4, 5, 6, 20]) {
        const {pet} = setupLearningPet(level, 'CUTE_PERRY');
        const battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/perry/pet-level-4.png?v=pet-test';
        assert.equal(pet.petForm, 'perry-hatched');
        assert.equal(pet.petImage, expected);
        assert.equal(pet.selectedPet().image, expected);
        assert.equal(pet.selectedPet().name, 'Perry');
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'CUTE_PERRY', vocabularyExperienceLevel: level}), expected);
        assert.equal(battle.getBattlePetOptionImage('CUTE_PERRY'), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'CUTE_PERRY').label, 'Perry');
        assert.strictEqual(battle.getBattlePetOptions(), options);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'perry/pet.json'), 'utf8'));
    assert.equal(manifest.unlockVocabularyExperienceLevel, 4);
    assert.equal(manifest.evolution.length, 1);
    assert.equal(manifest.evolution[0].form, 'hatched');
    assert.equal(manifest.evolution[0].battleRewardLevel, 21);
    assert.equal(manifest.evolution[0].battleRewardReferenceLevel, 2);
});

test('choosing Perry saves the choice and acknowledges its unlock per account', async () => {
    const h = setupLearningPet(4, 'MAM_HOC');
    assert.equal(h.pet.hasNewPerry, true);
    assert.match(h.pet.message, /Level 4.*Perry/);
    assert.doesNotMatch(h.pet.message, /trứng|nứt|nở/);
    h.pet.selectPet('CUTE_PERRY');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].body.petKey, 'CUTE_PERRY');
    assert.equal(h.user().selectedLearningPet, 'CUTE_PERRY');
    assert.equal(h.pet.petForm, 'perry-hatched');
    assert.equal(h.pet.hasNewPerry, false);
    assert.equal(h.pet.selectedPet().isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'CUTE_PERRY']]);
    assert.equal(setupLearningPet(4, 'CUTE_PERRY', h.storage).pet.hasNewPerry, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 4, selectedLearningPet: 'CUTE_PERRY'});
    assert.equal(h.pet.hasNewPerry, true);
});

test('Perry reward art is independent of the claimant vocabulary level', () => {
    const battle = setupBattle(0);
    const expected = 'assets/images/learning-pets/perry/pet-level-4.png?v=pet-test';
    assert.equal(battle.getGiftRewardImage(21), expected);
    assert.equal(battle.getGiftRewardLabel(21), 'Perry');
    const reward = {rewardImage: 'assets/images/learning-pets/perry/pet-level-4.png', rewardLabel: 'Perry'};
    assert.equal(battle.getGiftRewardImage(21, null, reward), expected);
    assert.equal(battle.getGiftRewardLabel(21, null, reward), 'Perry');
    assert.equal(battle.getBattlePetOptions().some(item => item.key === 'CUTE_PERRY'), false);
    assert.match(battle.getPlayerPetImage({selectedPetKey: 'CUTE_PERRY', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
    assert.equal(battle.getPlayerPetImage({selectedPetKey: 'CUTE_PERRY', vocabularyExperienceLevel: 0, allPetsUnlocked: true}), expected);
});

test('opening the pet panel acknowledges the new Perry notification', () => {
    const h = setupLearningPet(4, 'MAM_HOC');
    assert.equal(h.pet.hasNewPerry, true);
    h.pet.openPanel();
    assert.equal(h.pet.hasNewPerry, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'CUTE_PERRY').isNew, false);
    assert.equal(h.pet.notificationCount, 0);
});

test('pet caches cloud drafts, hides dismissed drafts and labels their source', () => {
    const h = setupLearningPet(3, 'MAM_HOC', new Map(), [{name: 'ROLE_STUDENT'}]);
    const cloud = {userId: 7, testId: 70233, testMode: 'COMPREHENSIVE', answeredCount: 15,
        totalQuestions: 50, savedAt: '2026-10-07T10:00:00Z'};
    const item = {draftKey: 'ieltsReadingInProgress:7:comprehensive:test:70233:serious',
        draftType: 'IELTS', title: 'Verb Patterns - 50 câu', savedAt: Date.parse(cloud.savedAt), payload: JSON.stringify(cloud)};
    const draft = h.hooks.parseDraft(item);
    assert.equal(JSON.parse(h.storage.get(item.draftKey)).testId, 70233);
    assert.equal(draft.progressValue, '15/50 câu');
    assert.equal(draft.sourceLabel, 'Tự luyện');

    item.payload = JSON.stringify({...cloud, assignmentTaskId: 99});
    item.savedAt += 1;
    const assignedDraft = h.hooks.parseDraft(item);
    assert.equal(assignedDraft.sourceLabel, 'Bài lớp giao');
    assert.equal(assignedDraft.sessionMode, 'SERIOUS');
    item.payload = JSON.stringify({...cloud, hiddenFromDashboard: true});
    item.savedAt += 1;
    assert.equal(h.hooks.parseDraft(item), null);
});

test('pet stays hidden while a student is taking an IELTS or comprehensive test', () => {
    const h = setupLearningPet(3, 'MAM_HOC', new Map(), [{name: 'ROLE_STUDENT'}]);
    assert.equal(h.hooks.shouldDisplay(), true);
    h.state.current.name = 'application.comprehensive_actual_test';
    assert.equal(h.hooks.shouldDisplay(), false);
    h.state.current.name = 'application.ielts_reading_actual_test';
    assert.equal(h.hooks.shouldDisplay(), false);
});

test('pet omits overdue assignments so active work is not hidden behind them', () => {
    const h = setupLearningPet(3, 'MAM_HOC', new Map(), [{name: 'ROLE_STUDENT'}]);
    const active = h.hooks.activeTasks([
        {taskId: 1, title: 'Old work', overdue: true},
        {taskId: 2, title: 'Current work', dueDate: '2026-10-10', overdue: false},
        {taskId: 3, title: 'No deadline'}
    ]);
    assert.deepEqual(Array.from(active, item => item.taskId), [2]);
});

test('Dragon Balls unlock cumulatively at levels 6 through 12 in both pet pickers', () => {
    for (let level = 0; level <= 20; level++) {
        const {pet} = setupLearningPet(level, 'MAM_HOC');
        const battle = setupBattle(level);
        const balls = pet.availablePets.filter(item => item.key.startsWith('DRAGON_BALL_'));
        assert.equal(balls.length, Math.max(0, Math.min(7, level - 5)));
        const options = battle.getBattlePetOptions();
        assert.strictEqual(battle.getBattlePetOptions(), options, 'stable options avoid digest loops');
        assert.deepEqual(Array.from(options.filter(item => item.key.startsWith('DRAGON_BALL_')), item => item.key),
            Array.from(balls, item => item.key));
        assert.equal(pet.selectedPetKey, 'MAM_HOC', 'unlocking does not replace the chosen pet');
    }
});

test('each ball has matching artwork and level guards in the assistant and battle', async () => {
    for (let stars = 1; stars <= 7; stars++) {
        const key = 'DRAGON_BALL_' + stars, level = stars + 5;
        const locked = setupLearningPet(level - 1, key).pet;
        assert.equal(locked.selectedPetKey, 'MAM_HOC');
        const h = setupLearningPet(level, key), battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/dragon-ball-' + stars + '/pet.png?v=pet-test';
        assert.equal(h.pet.petForm, 'dragon-ball');
        assert.equal(h.pet.petImage, expected);
        assert.equal(h.pet.selectedPet().image, expected);
        assert.equal(battle.getBattlePetOptionImage(key), expected);
        assert.equal(battle.getPlayerPetImage({selectedPetKey:key,vocabularyExperienceLevel:level}), expected);
        assert.equal(setupLearningPet(30,key).pet.petImage, expected, 'earlier balls remain selectable');
        assert.equal(setupLearningPet(0,key,new Map(),[{name:'ROLE_ADMIN'}]).pet.petImage,expected);
        const png=fs.readFileSync(path.join(assets,'dragon-ball-'+stars,'pet.png'));
        assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png[25],6);
        assert.ok(png.readUInt32BE(16)>=512);
        const fresh=setupLearningPet(level,'MAM_HOC');fresh.pet.selectPet(key);
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(fresh.user().selectedLearningPet,key);assert.equal(fresh.pet.petImage,expected);
        assert.equal(fresh.requests[0].body.petKey,key);
    }
});

test('sparkling lightning unlocks with grown Pikachu at level 20 in both pet pickers', () => {
    for (const level of [0, 18, 19]) {
        const {pet} = setupLearningPet(level, 'SPARKLING_LIGHTNING');
        const battle = setupBattle(level);
        assert.equal(pet.selectedPetKey, 'MAM_HOC', 'a stale selection cannot bypass the unlock');
        assert.equal(pet.availablePets.some(item => item.key === 'SPARKLING_LIGHTNING'), false);
        assert.equal(pet.hasNewSparklingLightning, false);
        assert.equal(battle.getBattlePetOptions().some(item => item.key === 'SPARKLING_LIGHTNING'), false);
        assert.doesNotMatch(battle.getPlayerPetImage({selectedPetKey: 'SPARKLING_LIGHTNING', vocabularyExperienceLevel: level}), /sparkling-lightning/);
    }
    for (const level of [20, 21, 50]) {
        const {pet} = setupLearningPet(level, 'SPARKLING_LIGHTNING');
        const battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/sparkling-lightning/pet-level-20.png?v=pet-test';
        assert.equal(pet.petForm, 'sparkling-lightning');
        assert.equal(pet.petImage, expected);
        assert.equal(pet.selectedPet().name, 'Tia sét lấp lánh');
        assert.equal(pet.selectedPet().image, expected);
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'SPARKLING_LIGHTNING', vocabularyExperienceLevel: level}), expected);
        assert.equal(battle.getBattlePetOptionImage('SPARKLING_LIGHTNING'), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'SPARKLING_LIGHTNING').label, 'Tia sét lấp lánh');
        assert.strictEqual(battle.getBattlePetOptions(), options, 'options stay stable across digests');
        assert.match(pet.availablePets.find(item => item.key === 'CUTE_PIKACHU').image, /pikachu\/pet-level-20.png/);
        assert.equal(options.find(item => item.key === 'CUTE_PIKACHU').label, 'Pikachu');
        assert.equal(setupLearningPet(level, 'CUTE_PIKACHU').pet.selectedPetKey, 'CUTE_PIKACHU', 'unlock preserves the chosen pet');
    }
});

test('choosing sparkling lightning saves and acknowledges its unlock for the current account', async () => {
    const h = setupLearningPet(20, 'CUTE_PIKACHU');
    assert.equal(h.pet.hasNewSparklingLightning, true);
    assert.match(h.pet.message, /Level 20.*Tia sét lấp lánh.*Pikachu/);
    assert.doesNotMatch(h.pet.message, /trứng|nứt|nở/);
    h.pet.selectPet('SPARKLING_LIGHTNING');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].body.petKey, 'SPARKLING_LIGHTNING');
    assert.equal(h.user().selectedLearningPet, 'SPARKLING_LIGHTNING');
    assert.equal(h.pet.petForm, 'sparkling-lightning');
    assert.equal(h.pet.hasNewSparklingLightning, false);
    assert.equal(h.pet.selectedPet().isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'SPARKLING_LIGHTNING']]);
    assert.equal(setupLearningPet(20, 'SPARKLING_LIGHTNING', h.storage).pet.hasNewSparklingLightning, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 20, selectedLearningPet: 'SPARKLING_LIGHTNING'});
    assert.equal(h.pet.hasNewSparklingLightning, true, 'seen state is separate per account');
});

test('opening the pet panel acknowledges sparkling lightning without switching away from Pikachu', () => {
    const h = setupLearningPet(20, 'CUTE_PIKACHU');
    h.pet.openPanel();
    assert.equal(h.pet.hasNewSparklingLightning, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'SPARKLING_LIGHTNING').isNew, false);
    assert.equal(h.pet.notificationCount, 0);
    assert.equal(h.pet.selectedPetKey, 'CUTE_PIKACHU');
});

test('admin access to lightning never unlocks an unrelated student or changes experience', () => {
    const admin = setupBattle(0, [{name: 'ROLE_ADMIN'}]);
    const expected = 'assets/images/learning-pets/sparkling-lightning/pet-level-20.png?v=pet-test';
    assert.equal(admin.getPlayerPetImage({username: 'student', selectedPetKey: 'SPARKLING_LIGHTNING', vocabularyExperienceLevel: 0}), expected);
    assert.doesNotMatch(admin.getPlayerPetImage({username: 'someone-else', selectedPetKey: 'SPARKLING_LIGHTNING', vocabularyExperienceLevel: 19}), /sparkling-lightning/);
    assert.equal(setupBattle(0).getPlayerPetImage({selectedPetKey: 'SPARKLING_LIGHTNING', vocabularyExperienceLevel: 0, allPetsUnlocked: true}), expected);
    assert.equal(admin.currentUser.vocabularyExperienceLevel, 0);
    assert.equal(setupLearningPet(0, 'SPARKLING_LIGHTNING', new Map(), [{name: 'ROLE_ADMIN'}]).pet.hasNewSparklingLightning, false);
});

test('the lightning collectible packages transparent artwork without changing the game reward', () => {
    const png = fs.readFileSync(path.join(assets, 'sparkling-lightning/pet-level-20.png'));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1024);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6);
    const battle = setupBattle(20);
    assert.equal(battle.getGiftRewardImage(-4, null, {rewardImage: 'assets/images/battle-lightning.svg'}),
        'assets/images/battle-lightning.svg?v=pet-test', 'the game keeps its own server-supplied reward artwork');
    assert.equal(battle.getGiftRewardImage(21), 'assets/images/learning-pets/perry/pet-level-4.png?v=pet-test');
});

test('Halloween pumpkin opens for everyone from October 1 through November 5 in UTC+7 every year', () => {
    for (const [iso, available] of [
        ['2026-09-30T16:59:59.999Z', false],
        ['2026-09-30T17:00:00.000Z', true],
        ['2026-10-28T12:00:00.000Z', true],
        ['2026-11-04T17:00:00.000Z', true],
        ['2026-11-05T16:59:59.999Z', true],
        ['2026-11-05T17:00:00.000Z', false],
        ['2026-12-31T17:00:00.000Z', false],
        ['2027-09-30T17:00:00.000Z', true],
        ['2027-11-05T17:00:00.000Z', false]
    ]) {
        const clock = petClock(iso);
        const {pet} = setupLearningPet(0, 'HALLOWEEN_PUMPKIN', new Map(), [], clock);
        const battle = setupBattle(0, [], clock);
        const card = pet.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN');
        assert.ok(card, 'everyone owns the pumpkin even while it is seasonally locked');
        assert.equal(card.locked, !available, iso);
        assert.equal(pet.selectedPetKey, available ? 'HALLOWEEN_PUMPKIN' : 'MAM_HOC', iso);
        assert.equal(pet.petForm, available ? 'halloween-pumpkin' : 'egg-intact', iso);
        assert.equal(battle.getBattlePetOptions().some(item => item.key === 'HALLOWEEN_PUMPKIN'), available, iso);
        const image = battle.getPlayerPetImage({selectedPetKey: 'HALLOWEEN_PUMPKIN', vocabularyExperienceLevel: 0});
        assert.equal(image, available ? card.image : 'assets/images/learning-pets/mam-hoc/egg-level-0.png?v=pet-test', iso);
    }
});

test('Halloween pumpkin saves at level zero without eggs, experience changes or replacing other pets', async () => {
    const h = setupLearningPet(0, 'MAM_HOC', new Map(), [], petClock('2026-10-01T00:00:00Z'));
    assert.equal(h.pet.selectedPetKey, 'MAM_HOC', 'season opening does not change the chosen pet');
    const pumpkin = h.pet.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN');
    assert.equal(pumpkin.locked, false);
    assert.match(pumpkin.description, /1\/10.*5\/11/);
    h.pet.selectPet('HALLOWEEN_PUMPKIN');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].body.petKey, 'HALLOWEEN_PUMPKIN');
    assert.equal(h.user().selectedLearningPet, 'HALLOWEEN_PUMPKIN');
    assert.equal(h.user().vocabularyExperienceLevel, 0);
    assert.equal(h.pet.petForm, 'halloween-pumpkin');
    assert.equal(h.pet.petImage, pumpkin.image);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'HALLOWEEN_PUMPKIN']]);
    const grown = setupLearningPet(50, 'HALLOWEEN_PUMPKIN', new Map(), [], h.clock).pet;
    assert.equal(grown.petImage, pumpkin.image);
    assert.ok(grown.availablePets.some(item => item.key === 'CUTE_PIKACHU'));
});

test('a pumpkin card left open at expiry cannot send another selection request', () => {
    const clock = petClock('2026-11-05T16:59:59.999Z');
    const h = setupLearningPet(0, 'HALLOWEEN_PUMPKIN', new Map(), [], clock);
    assert.equal(h.pet.petForm, 'halloween-pumpkin');
    clock.set('2026-11-05T17:00:00.000Z');
    h.pet.selectPet('HALLOWEEN_PUMPKIN');
    assert.equal(h.requests.length, 0);
    assert.equal(h.pet.selectedPetKey, 'MAM_HOC');
    assert.equal(h.pet.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN').locked, true);
    assert.match(h.pet.petSelectionError, /1\/10.*5\/11.*UTC\+7/);
    assert.equal(h.user().selectedLearningPet, 'HALLOWEEN_PUMPKIN', 'expiry does not rewrite the saved choice');
});

test('the assistant switches the effective pet at midnight even with the page left open', () => {
    const clock = petClock('2026-11-05T16:59:59.999Z');
    const h = setupLearningPet(20, 'HALLOWEEN_PUMPKIN', new Map(), [], clock);
    h.hooks.scheduleSeason();
    const expiry = h.scheduled.at(-1);
    assert.equal(expiry.delay, 1);
    clock.set('2026-11-05T17:00:00.000Z');
    expiry.fn();
    assert.equal(h.pet.selectedPetKey, 'MAM_HOC');
    assert.equal(h.pet.petForm, 'hatched');
    assert.equal(h.pet.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN').locked, true);
    assert.equal(h.scheduled.at(-1).delay, 24 * 60 * 60 * 1000);
});

test('battle options expire at the same level and keep a stable reference within each season', () => {
    const clock = petClock('2026-11-05T16:59:59.999Z');
    const battle = setupBattle(0, [], clock);
    const inSeason = battle.getBattlePetOptions();
    assert.ok(inSeason.some(item => item.key === 'HALLOWEEN_PUMPKIN'));
    assert.strictEqual(battle.getBattlePetOptions(), inSeason);
    battle.selectedBattlePetKey = 'HALLOWEEN_PUMPKIN';
    clock.set('2026-11-05T17:00:00Z');
    const outsideSeason = battle.getBattlePetOptions();
    assert.notStrictEqual(outsideSeason, inSeason);
    assert.equal(outsideSeason.some(item => item.key === 'HALLOWEEN_PUMPKIN'), false);
    assert.strictEqual(battle.getBattlePetOptions(), outsideSeason);
    assert.equal(battle.selectedBattlePetKey, 'MAM_HOC');
    assert.doesNotThrow(() => battle.selectBattlePet('HALLOWEEN_PUMPKIN'), 'locked request stops before the service call');
    clock.set('2027-09-30T17:00:00Z');
    assert.ok(battle.getBattlePetOptions().some(item => item.key === 'HALLOWEEN_PUMPKIN'));
});

test('only a real admin or an explicitly unlocked player keeps pumpkin access outside the season', async () => {
    const clock = petClock('2026-06-15T10:00:00Z');
    const roles = [{name: 'ROLE_ADMIN'}];
    const h = setupLearningPet(0, 'MAM_HOC', new Map(), roles, clock);
    assert.equal(h.pet.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN').locked, false);
    h.pet.selectPet('HALLOWEEN_PUMPKIN');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.pet.petForm, 'halloween-pumpkin');
    const expected = h.pet.petImage;
    const battle = setupBattle(0, roles, clock);
    assert.ok(battle.getBattlePetOptions().some(item => item.key === 'HALLOWEEN_PUMPKIN'));
    assert.equal(battle.getPlayerPetImage({username: 'student', selectedPetKey: 'HALLOWEEN_PUMPKIN', vocabularyExperienceLevel: 0}), expected);
    assert.doesNotMatch(battle.getPlayerPetImage({username: 'another-student', selectedPetKey: 'HALLOWEEN_PUMPKIN', vocabularyExperienceLevel: 50}), /halloween-pumpkin/);
    assert.equal(setupBattle(0, [], clock).getPlayerPetImage({selectedPetKey: 'HALLOWEEN_PUMPKIN', vocabularyExperienceLevel: 0, allPetsUnlocked: true}), expected);
    const otherRole = setupLearningPet(50, 'HALLOWEEN_PUMPKIN', new Map(), [{name: 'ROLE_ADMINISTRATOR'}], clock).pet;
    assert.equal(otherRole.availablePets.find(item => item.key === 'HALLOWEEN_PUMPKIN').locked, true);
    assert.equal(otherRole.selectedPetKey, 'MAM_HOC');
    assert.equal(h.user().vocabularyExperienceLevel, 0);
});

test('pumpkin art is transparent and its seasonal pet never becomes a random game reward', () => {
    const png = fs.readFileSync(path.join(assets, 'halloween-pumpkin/pet.png'));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1024);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6);
    assert.equal(fs.existsSync(path.join(assets, 'halloween-pumpkin/pet.json')), false);
});

test('ordinary Goku hatches at level 22 and remains available after all Saiyan pets unlock', () => {
    const locked = setupLearningPet(20, 'GOKU_KID').pet;
    assert.equal(locked.selectedPetKey, 'MAM_HOC');
    assert.equal(locked.hasNewGokuKidEgg, false);
    assert.equal(locked.availablePets.some(item => item.key === 'GOKU_KID'), false);
    assert.equal(setupBattle(20).getBattlePetOptions().some(item => item.key === 'GOKU_KID'), false);
    assert.doesNotMatch(setupBattle(20).getPlayerPetImage({selectedPetKey: 'GOKU_KID', vocabularyExperienceLevel: 20}), /goku-kid/);
    for (const [level, file, form, label] of [
        [21, 'egg-level-21.png', 'goku-kid-egg', 'Trứng Goku nhí'],
        [22, 'pet-level-22.png', 'goku-kid-hatched', 'Goku nhí'],
        [23, 'pet-level-22.png', 'goku-kid-hatched', 'Goku nhí'],
        [24, 'pet-level-22.png', 'goku-kid-hatched', 'Goku nhí'],
        [25, 'pet-level-22.png', 'goku-kid-hatched', 'Goku nhí'],
        [50, 'pet-level-22.png', 'goku-kid-hatched', 'Goku nhí']
    ]) {
        const {pet} = setupLearningPet(level, 'GOKU_KID'), battle = setupBattle(level);
        const expected = 'assets/images/learning-pets/goku-kid/' + file + '?v=pet-test';
        assert.equal(pet.petForm, form);
        assert.equal(pet.petImage, expected);
        assert.equal(pet.selectedPet().image, expected);
        assert.equal(!!pet.selectedPet().superSaiyan, false);
        assert.equal(!!pet.selectedPet().superSaiyan2, false);
        assert.equal(!!pet.selectedPet().superSaiyan4, false);
        assert.equal(battle.getPlayerPetImage({selectedPetKey: 'GOKU_KID', vocabularyExperienceLevel: level}), expected);
        assert.equal(battle.getBattlePetOptionImage('GOKU_KID'), expected);
        const options = battle.getBattlePetOptions();
        assert.equal(options.find(item => item.key === 'GOKU_KID').label, label);
        assert.strictEqual(battle.getBattlePetOptions(), options);
        assert.ok(options.some(item => item.key === 'CUTE_PIKACHU'));
        assert.ok(options.some(item => item.key === 'SPARKLING_LIGHTNING'));
        assert.equal(setupLearningPet(level, 'CUTE_PIKACHU').pet.selectedPetKey, 'CUTE_PIKACHU');
    }
});

const gokuForms = [
    {key: 'GOKU_SSJ1', unlock: 23, file: 'pet-level-23.png', form: 'goku-super-saiyan', label: 'Son Goku Siêu Saiyan'},
    {key: 'GOKU_SSJ2', unlock: 24, file: 'pet-level-24.svg', form: 'goku-super-saiyan-2', label: 'Son Goku Siêu Saiyan cấp 2'},
    {key: 'GOKU_SSJ4', unlock: 25, file: 'pet-level-25.png', form: 'goku-super-saiyan-4', label: 'Son Goku Siêu Saiyan 4'}
];

test('each Saiyan is a separate pet with its own level boundary in both displays', () => {
    for (const item of gokuForms) {
        const locked = setupLearningPet(item.unlock - 1, item.key).pet;
        assert.equal(locked.selectedPetKey, 'MAM_HOC');
        assert.equal(locked.availablePets.some(pet => pet.key === item.key), false);
        const lockedBattle = setupBattle(item.unlock - 1);
        assert.equal(lockedBattle.getBattlePetOptions().some(pet => pet.key === item.key), false);
        assert.doesNotMatch(lockedBattle.getPlayerPetImage({selectedPetKey: item.key, vocabularyExperienceLevel: item.unlock - 1}), /goku-kid/);
        for (const level of [item.unlock, 25, 50]) {
            const pet = setupLearningPet(level, item.key).pet, battle = setupBattle(level);
            const expected = 'assets/images/learning-pets/goku-kid/' + item.file + '?v=pet-test';
            assert.equal(pet.selectedPetKey, item.key);
            assert.equal(pet.petImage, expected);
            assert.equal(pet.petForm, item.form);
            assert.equal(pet.selectedPet().name, item.label);
            assert.equal(!!pet.selectedPet().superSaiyan, item.key === 'GOKU_SSJ1');
            assert.equal(!!pet.selectedPet().superSaiyan2, item.key === 'GOKU_SSJ2');
            assert.equal(!!pet.selectedPet().superSaiyan4, item.key === 'GOKU_SSJ4');
            assert.equal(battle.getBattlePetOptionImage(item.key), expected);
            assert.equal(battle.getPlayerPetImage({selectedPetKey: item.key, vocabularyExperienceLevel: level}), expected);
            assert.equal(battle.getBattlePetOptions().find(pet => pet.key === item.key).label, item.label);
        }
    }
    for (const level of [21, 22, 23, 24, 25, 50]) {
        const expected = ['GOKU_KID', ...gokuForms.filter(item => level >= item.unlock).map(item => item.key)];
        assert.deepEqual(Array.from(setupLearningPet(level, 'GOKU_KID').pet.availablePets.filter(item => item.key.startsWith('GOKU_')).map(item => item.key)), expected);
        assert.deepEqual(Array.from(setupBattle(level).getBattlePetOptions().filter(item => item.key.startsWith('GOKU_')).map(item => item.key)), expected);
    }
});

test('selecting Goku saves the choice and acknowledges its egg separately for each account', async () => {
    const h = setupLearningPet(21, 'CUTE_PIKACHU');
    assert.equal(h.pet.hasNewGokuKidEgg, true);
    assert.match(h.pet.message, /Level 21.*Level 22.*nở/);
    assert.match(h.pet.message, /Siêu Saiyan/);
    assert.match(h.pet.message, /23.*24.*25/);
    assert.doesNotMatch(h.pet.message, /nứt/);
    h.pet.selectPet('GOKU_KID');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests[0].body.petKey, 'GOKU_KID');
    assert.equal(h.user().selectedLearningPet, 'GOKU_KID');
    assert.equal(h.pet.petForm, 'goku-kid-egg');
    assert.equal(h.pet.hasNewGokuKidEgg, false);
    assert.equal(h.pet.selectedPet().isNew, false);
    assert.deepEqual(h.broadcasts, [['learningPetSelectionChanged', 'GOKU_KID']]);
    assert.equal(setupLearningPet(21, 'GOKU_KID', h.storage).pet.hasNewGokuKidEgg, false);
    h.hooks.form({id: 8, vocabularyExperienceLevel: 21, selectedLearningPet: 'GOKU_KID'});
    assert.equal(h.pet.hasNewGokuKidEgg, true);
});

test('opening the pet panel acknowledges Goku without replacing Pikachu', () => {
    const h = setupLearningPet(21, 'CUTE_PIKACHU');
    h.pet.openPanel();
    assert.equal(h.pet.hasNewGokuKidEgg, false);
    assert.equal(h.pet.availablePets.find(item => item.key === 'GOKU_KID').isNew, false);
    assert.equal(h.pet.notificationCount, 0);
    assert.equal(h.pet.selectedPetKey, 'CUTE_PIKACHU');
});

test('admins can choose all four Goku pets independently at level zero without changing student access', () => {
    const roles = [{name: 'ROLE_ADMIN'}], admin = setupBattle(0, roles);
    for (const item of [{key: 'GOKU_KID', file: 'pet-level-22.png', form: 'goku-kid-hatched'}, ...gokuForms]) {
        const expected = 'assets/images/learning-pets/goku-kid/' + item.file + '?v=pet-test';
        const h = setupLearningPet(0, item.key, new Map(), roles);
        assert.equal(h.pet.petForm, item.form);
        assert.equal(h.pet.petImage, expected);
        assert.equal(h.pet.selectedPetKey, item.key);
        assert.equal(h.pet.hasNewGokuKidEgg, false);
        assert.equal(h.user().vocabularyExperienceLevel, 0);
        assert.equal(admin.getBattlePetOptionImage(item.key), expected);
        assert.equal(admin.getPlayerPetImage({username: 'student', selectedPetKey: item.key, vocabularyExperienceLevel: 0}), expected);
        assert.doesNotMatch(admin.getPlayerPetImage({username: 'another', selectedPetKey: item.key, vocabularyExperienceLevel: 20}), /goku-kid/);
        assert.equal(setupBattle(0).getPlayerPetImage({selectedPetKey: item.key, vocabularyExperienceLevel: 0, allPetsUnlocked: true}), expected);
    }
    assert.match(admin.getPlayerPetImage({username: 'another', selectedPetKey: 'GOKU_KID', vocabularyExperienceLevel: 21}), /goku-kid\/egg-level-21.png/);
    assert.match(admin.getPlayerPetImage({username: 'another', selectedPetKey: 'GOKU_KID', vocabularyExperienceLevel: 50}), /goku-kid\/pet-level-22.png/);
});

test('level gains keep the selected Goku pet instead of replacing it with the newest unlocked form', () => {
    for (const item of [{key: 'GOKU_KID', unlock: 22, file: 'pet-level-22.png', form: 'goku-kid-hatched'}, ...gokuForms]) {
        const h = setupLearningPet(item.unlock, item.key);
        h.hooks.form({id: 7, vocabularyExperienceLevel: 50, selectedLearningPet: item.key});
        assert.equal(h.pet.selectedPetKey, item.key);
        assert.equal(h.pet.petForm, item.form);
        assert.match(h.pet.petImage, new RegExp(item.file));
        assert.equal(h.requests.length, 0);
    }
});

test('students can switch among all unlocked Goku pets and reload the specific saved choice', async () => {
    const h = setupLearningPet(25, 'GOKU_SSJ4');
    const choices = ['GOKU_KID', 'GOKU_SSJ1', 'GOKU_SSJ2', 'GOKU_SSJ4', 'GOKU_SSJ1'];
    for (const key of choices) {
        h.pet.selectPet(key);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(h.requests.at(-1).body.petKey, key);
        assert.equal(h.user().selectedLearningPet, key);
        assert.equal(h.pet.selectedPetKey, key);
        const reloaded = setupLearningPet(25, h.user().selectedLearningPet).pet;
        assert.equal(reloaded.selectedPetKey, key);
        assert.equal(reloaded.petImage, h.pet.petImage);
    }
    assert.equal(h.requests.length, choices.length);
});

test('Goku stages and the separate aura package transparent artwork without changing game rewards', () => {
    for (const file of ['egg-level-21.png', 'pet-level-22.png', 'pet-level-23.png', 'pet-level-24.png', 'pet-level-25.png', 'super-saiyan-aura.png', 'super-saiyan-2-aura.png']) {
        const png = fs.readFileSync(path.join(assets, 'goku-kid', file));
        assert.equal(png.subarray(1, 4).toString(), 'PNG');
        assert.equal(png.readUInt32BE(16), 1024);
        assert.equal(png.readUInt32BE(20), 1024);
        assert.equal(png[25], 6);
    }
    assert.equal(fs.existsSync(path.join(assets, 'goku-kid/egg-level-22.png')), false, 'cracked stage is removed');
    const battle = setupBattle(22);
    assert.equal(battle.getGiftRewardImage(21), 'assets/images/learning-pets/perry/pet-level-4.png?v=pet-test');
    assert.equal(battle.getGiftRewardLabel(21), 'Perry');
});

test('Super Saiyan 2 carries self-contained alternating lightning and reduced-motion support everywhere it is shown', () => {
    const svg = fs.readFileSync(path.join(assets, 'goku-kid/pet-level-24.svg'), 'utf8');
    assert.match(svg, /@keyframes ssj2-arc-a/);
    assert.match(svg, /@keyframes ssj2-arc-b/);
    assert.match(svg, /prefers-reduced-motion:reduce/);
    assert.match(svg, /animation:none!important/);
    assert.match(svg, /data:image\/png;base64,/);
    assert.doesNotMatch(svg, /href="https?:/);
    for (const file of ['reference-super-saiyan-punch-original.png', 'reference-super-saiyan-2-original.png']) {
        assert.ok(fs.readFileSync(path.join(assets, 'goku-kid', file)).length > 1000);
    }
});

test('all new Goku forms retain the uploaded illustrations and preserve the approved aura asset', () => {
    for (const [level, original] of [[23, 'reference-super-saiyan-punch-original.png'], [24, 'reference-super-saiyan-2-original.png'], [25, 'reference-super-saiyan-4-original.png']]) {
        const svg = fs.readFileSync(path.join(assets, 'goku-kid', 'pet-level-' + level + '.svg'), 'utf8');
        assert.ok(svg.includes(fs.readFileSync(path.join(assets, 'goku-kid', original)).toString('base64')),
            'the source illustration is embedded unchanged at level ' + level);
    }
    assert.ok(fs.readFileSync(path.join(assets, 'goku-kid/energy-closed-level-24.png')).length > 1000);
});
