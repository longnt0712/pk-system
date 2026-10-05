// Run with: node --test richy/app/tests/daily-vocab-assignment-save.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

const service = fs.readFileSync(path.join(__dirname,
    '../../richy-api/src/main/java/com/globits/richy/service/impl/TestResultServiceImpl.java'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname,
    '../../richy-api/src/main/java/com/globits/richy/rest/RestTestResultController.java'), 'utf8');
const dailyVocab = fs.readFileSync(path.join(__dirname,
    '../question/controllers/DailyVocabController.js'), 'utf8');

test('assigned Daily Vocab accepts played child topics and records the server assignment topic', () => {
    const validationStart = service.indexOf('if (dto.getAssignmentTaskId() != null && Integer.valueOf(1).equals(dto.getTestType()))');
    const listeningStart = service.indexOf('} else if (dto.getAssignmentTaskId() != null && Integer.valueOf(3).equals(dto.getTestType()))', validationStart);
    const validation = service.slice(validationStart, listeningStart);
    assert.ok(validationStart >= 0 && listeningStart > validationStart);
    assert.match(validation, /scheduleTaskRepository\.findOne\(dto\.getAssignmentTaskId\(\)\)/);
    assert.match(validation, /"DAILY_VOCAB"\.equals\(dailyVocabAssignedTask\.getActivityType\(\)\)/);
    assert.doesNotMatch(validation, /dto\.getTopicIds\(\)\.contains/);

    const attachTopic = service.indexOf('resultTopics.add(dailyVocabAssignedTask.getTopic())');
    const calculateCompletion = service.indexOf('completedTopics(dto, resultTopics)');
    assert.ok(attachTopic >= 0 && attachTopic < calculateCompletion,
        'the authoritative assignment topic must be attached before completion is calculated');
});

test('student accounts can save and pending results keep the assignment id for retry', () => {
    const saveEndpoint = controller.slice(controller.indexOf('@Secured', controller.indexOf('getOne(')),
        controller.indexOf('gradeWriting('));
    assert.match(saveEndpoint, /ROLE_STUDENT/);
    assert.match(saveEndpoint, /value = "\/save"/);
    assert.match(dailyVocab, /assignmentTaskId:\s*vm\.assignmentLaunch\.taskId \|\| null/);
    assert.match(dailyVocab, /vm\.dailyVocabPendingResult = \{version:1,[\s\S]*?payload:payload\}/);
});

test('browser sends the assigned parent topic while completion remains on played child topics', () => {
    const start = dailyVocab.indexOf('function appendAssignmentTopicEvidence');
    const end = dailyVocab.indexOf('vm.saveTestResult = function ()', start);
    const context = nodeVm.createContext({
        vm: {
            assignmentLaunch: {taskId: '55', topicId: '100'},
            testResult: {assignmentTaskId: '55'},
            resultTopicIds: [101],
            rawQuestions: [{id: 1, topicIds: [101]}],
            attemptedDailyQuestionIds: {'1': true},
            completedDailyQuestionIds: {'1': true},
            allQuestionsLoaded: true
        },
        angular: {forEach(items, callback) { (items || []).forEach(callback); }}
    });
    nodeVm.runInContext(dailyVocab.slice(start, end), context);
    context.vm.prepareResultTopicEvidence();
    assert.deepEqual(Array.from(context.vm.testResult.topicIds), [101, 100]);
    assert.deepEqual(Array.from(context.vm.testResult.completedVocabularyTopicIds), [101]);
});
