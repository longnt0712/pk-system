// Run with: node --test richy/app/tests/student-level-column.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../users/controllers/UserController.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../users/views/users.html'), 'utf8');

function setup(hostname = 'ieltsroom.com') {
    const context = nodeVm.createContext({vm: {user: {}}, window: {location: {hostname}}});
    nodeVm.runInContext(source.slice(source.indexOf('function isIeltsRoomDomain()'),
        source.indexOf('vm.directorySchoolId =')), context);
    nodeVm.runInContext(source.slice(source.indexOf('function getVocabularyTotalWords(user)'),
        source.indexOf('vm.enrollmentClasses =')), context);
    nodeVm.runInContext(source.slice(source.indexOf('vm.getSortValue = function (user)'),
        source.indexOf('vm.getDisplayedUsers = function')), context);
    return context.vm;
}

test('level column is enabled only for IELTS Room and its www alias', () => {
    for (const hostname of ['ieltsroom.com', 'www.ieltsroom.com', 'IELTSROOM.COM']) {
        assert.equal(setup(hostname).isIeltsRoomDomain, true);
    }
    for (const hostname of ['localhost', 'other.example', 'ieltsroom.com.other.example', 'anotherieltsroom.com']) {
        assert.equal(setup(hostname).isIeltsRoomDomain, false);
    }
});

test('each table row uses its own experience, not the open profile', () => {
    const vm = setup();
    vm.user = {totalVocabularyWordsLearned: 9250};
    const first = {totalVocabularyWordsLearned: 2400};
    const second = {totalVocabularyWordsLearned: 7600};
    assert.equal(vm.getVocabularyExperienceLevel(first), 2);
    assert.equal(vm.getVocabularyExperienceWords(first), 400);
    assert.equal(vm.getVocabularyExperiencePercent(first), 40);
    assert.equal(vm.getVocabularyExperienceLevel(second), 7);
    assert.equal(vm.getVocabularyExperienceWords(second), 600);
    assert.equal(vm.getVocabularyExperiencePercent(second), 60);
    assert.equal(vm.getVocabularyExperienceLevel(), 9);
    assert.equal(vm.getVocabularyExperiencePercent(), 25);
});

test('legacy level/words fields work if total learned words are absent', () => {
    const vm = setup();
    const student = {vocabularyExperienceLevel: 6, vocabularyExperienceWords: 350};
    assert.equal(vm.getVocabularyExperienceLevel(student), 6);
    assert.equal(vm.getVocabularyExperienceWords(student), 350);
    assert.equal(vm.getVocabularyExperiencePercent(student), 35);
});

test('new students and exact level boundaries have an empty progress bar', () => {
    const vm = setup();
    assert.equal(vm.getVocabularyExperienceLevel({}), 0);
    assert.equal(vm.getVocabularyExperiencePercent({}), 0);
    assert.equal(vm.getVocabularyExperienceLevel({totalVocabularyWordsLearned: 1000}), 1);
    assert.equal(vm.getVocabularyExperienceWords({totalVocabularyWordsLearned: 1000}), 0);
    assert.equal(vm.getVocabularyExperiencePercent({totalVocabularyWordsLearned: 1000}), 0);
});

test('server total is authoritative; negative totals cannot render negative bars', () => {
    const vm = setup();
    const student = {totalVocabularyWordsLearned: 100, vocabularyExperienceLevel: 8, vocabularyExperienceWords: 900};
    assert.equal(vm.getVocabularyExperienceLevel(student), 0);
    assert.equal(vm.getVocabularyExperiencePercent(student), 10);
    assert.equal(vm.getVocabularyExperiencePercent({totalVocabularyWordsLearned: -1}), 0);
});

test('level sorting compares numeric total experience, including progress within a level', () => {
    const vm = setup();
    vm.sortKey = 'vocabularyExperience';
    const students = [
        {totalVocabularyWordsLearned: 10350},
        {totalVocabularyWordsLearned: 2350},
        {totalVocabularyWordsLearned: 2100}
    ];
    students.sort((a, b) => vm.getSortValue(a) - vm.getSortValue(b));
    assert.deepEqual(students.map(student => student.totalVocabularyWordsLearned), [2100, 2350, 10350]);
});

test('table header and cell share the domain guard; progress is bound to the row user', () => {
    assert.match(template, /<th[^>]+ng-if="vm.isIeltsRoomDomain"[^>]+ng-click="vm.sortBy\('vocabularyExperience'\)"/);
    assert.match(template, /<td ng-if="vm.isIeltsRoomDomain" class="student-level-cell">/);
    assert.match(template, /ng-style="\{'width': vm.getVocabularyExperiencePercent\(user\) \+ '%'\}"/);
    assert.match(template, /class="student-level-progress" role="progressbar"/);
});
