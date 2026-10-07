// Run with: node --test richy/app/tests/learning-pet-evolution.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const assets = path.join(__dirname, '../assets/images/learning-pets');
const timer = () => 1;
timer.cancel = () => {};

function setupLearningPet(level, selected = 'CUTE_JERRY_MOUSE', storage = new Map(), roles = []) {
    let factory, hooks;
    let user = {id: 7, vocabularyExperienceLevel: level, selectedLearningPet: selected, roles};
    const requests = [], broadcasts = [];
    const angular = {
        module() { return {directive(name, fn) { factory = fn; }}; },
        noop() {}, fromJson: JSON.parse,
        forEach(items, fn) { items.forEach(fn); }
    };
    const source = fs.readFileSync(path.join(__dirname, '../common/utils/learning-pet.directive.js'), 'utf8');
    const context = nodeVm.createContext({angular, window: {APP_VERSION: 'pet-test'}, expose(value) { hooks = value; }});
    nodeVm.runInContext(source.replace('var permissionsListener =',
        'expose({form: updatePetForm, message: updateMessage}); var permissionsListener ='), context);
    const $http = {post(url, body) {
        requests.push({url, body});
        return Promise.resolve({data: {selectedPetKey: body.petKey}});
    }};
    const $window = {
        localStorage: {getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); }},
        addEventListener() {}, removeEventListener() {}
    };
    const cookies = {get() { return JSON.stringify(user); }, putObject(key, value) { user = value; }};
    const rootScope = {$on() { return () => {}; }, $broadcast(name, value) { broadcasts.push([name, value]); }};
    const scope = {$on() { return () => {}; }};
    const definition = factory($http, {}, {}, timer, timer, $window, cookies, rootScope,
        {api: {baseUrl: '/api/', apiV1Url: 'v1/'}});
    const pet = {};
    definition.controller.call(pet, scope);
    hooks.form(user);
    hooks.message();
    return {pet, hooks, storage, requests, broadcasts, user: () => user};
}

function setupBattle(level, roles = []) {
    let Controller;
    const angular = {
        module() { return {controller(name, fn) { Controller = fn; }}; },
        forEach(items, fn) { (items || []).forEach(fn); },
        fromJson: JSON.parse, copy: value => JSON.parse(JSON.stringify(value)), noop() {},
        element() { return {on() {}, off() {}}; }
    };
    const source = fs.readFileSync(path.join(__dirname, '../question/controllers/BattleQuizOnlineController.js'), 'utf8');
    const context = nodeVm.createContext({angular});
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
        assert.equal(options.length, level >= 15 ? 6 : 5, 'earlier pets stay available');
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
    for (const folder of ['cute-tom-cat', 'jerry-mouse', 'tuffy-mouse']) {
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
        ['CUTE_TUFFY_MOUSE', 'pet-level-17.png']
    ]) {
        const h = setupLearningPet(0, key, new Map(), roles);
        assert.equal(h.pet.selectedPetKey, key);
        assert.equal(h.pet.availablePets.length, 6);
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
    assert.equal(options.length, 6);
    assert.strictEqual(admin.getBattlePetOptions(), options);
    assert.equal(options.find(item => item.key === 'CUTE_JERRY_MOUSE').label, 'Chuột Jerry');
    assert.match(admin.getBattlePetOptionImage('CUTE_JERRY_MOUSE'), /pet-level-14.png/);
    assert.equal(options.find(item => item.key === 'CUTE_TUFFY_MOUSE').label, 'Chuột Tuffy');
    assert.match(admin.getBattlePetOptionImage('CUTE_TUFFY_MOUSE'), /pet-level-17.png/);
    assert.match(admin.getPlayerPetImage({username: 'student', selectedPetKey: 'CUTE_TOM_CAT', vocabularyExperienceLevel: 0}), /pet-level-11.png/);
    assert.match(admin.getPlayerPetImage({username: 'another-student', selectedPetKey: 'MAM_HOC', vocabularyExperienceLevel: 0}), /egg-level-0.png/);
    assert.equal(admin.currentUser.vocabularyExperienceLevel, 0);
    // Losing admin access at the same real level must invalidate the options cache.
    admin.currentUser.roles = [{name: 'ROLE_STUDENT'}];
    assert.equal(admin.getBattlePetOptions().length, 1);
    const student = setupBattle(0, [{name: 'ROLE_STUDENT'}]);
    assert.match(student.getPlayerPetImage({username: 'admin', allPetsUnlocked: true, selectedPetKey: 'CUTE_JERRY_MOUSE', vocabularyExperienceLevel: 0}), /pet-level-14.png/);
    assert.match(student.getPlayerPetImage({username: 'admin', allPetsUnlocked: true, selectedPetKey: 'CUTE_TUFFY_MOUSE', vocabularyExperienceLevel: 0}), /pet-level-17.png/);
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
        assert.equal(options.length, 6);
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
