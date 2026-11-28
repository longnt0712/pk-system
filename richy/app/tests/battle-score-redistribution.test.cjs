const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controller = fs.readFileSync(path.join(__dirname, '../question/controllers/QuizBattle2Controller.js'), 'utf8');
function duel(first, second) {
    const excerpt = controller.slice(controller.indexOf('        function redistributableBattlePoints()'),
        controller.indexOf('        function clearBattleEffects()'));
    const messages = [];
    const context = vm.createContext({
        vm: {score1: first, score2: second, currentCard: {hasRedistributionSkill: true}, currentCard1: {hasRedistributionSkill: true}},
        roundBattleScore: score => Math.round(score * 10) / 10,
        toastr: {info(message) { messages.push(message); }}
    });
    vm.runInContext(excerpt, context);
    return {...context, messages};
}

test('duel redistribution goes to the lower score regardless of who earns the skill', () => {
    const match = duel(10, 120);
    match.triggerRedistributionSkill(2);
    assert.equal(match.vm.score1, 16);
    assert.equal(match.vm.score2, 114);
    assert.equal(match.messages.length, 1);
    match.triggerRedistributionSkill(2);
    assert.equal(match.vm.score2, 114);
});

test('the duel hides an ineligible skill and a wrong answer consumes it', () => {
    const tied = duel(100, 100);
    assert.equal(tied.vm.canRedistributeBattleScore(), false);
    const match = duel(120, 20);
    assert.equal(match.vm.canRedistributeBattleScore(), true);
    match.consumeCurrentCardSkillsOnWrong(1);
    match.triggerRedistributionSkill(1);
    assert.equal(match.vm.score1, 120);
    assert.equal(match.vm.score2, 20);
});
