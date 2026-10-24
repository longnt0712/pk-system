const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeVm = require('node:vm');

function controller(file) {
    let Controller;
    const module = {controller: (name, fn) => {Controller = fn; return module;},
        directive: () => module, filter: () => module};
    const context = nodeVm.createContext({angular: {module: () => module}});
    nodeVm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    const scope = {$on: () => {}, $apply: fn => fn()};
    const service = {getPage: () => Promise.resolve({content: [], totalElements: 0}), getTableDefinition: () => []};
    const utilities = {indexOf: (row, rows) => rows.findIndex(item => item.id === row.id)};
    return new Controller({settings: {layout: {}}}, scope, {}, () => {},
        {api: {baseUrl: '/', apiPrefix: 'api/'}, locale: 'vi-VN'}, utilities, {}, service, {});
}

for (const [file, selected] of [
    ['education_program/controllers/EducationProgramController.js', 'selectedEducationPrograms'],
    ['topic_category/controllers/TopicCategoryController.js', 'selectedTopicCategorys']
]) {
    test(file + ': unchecking a row updates the actual selection and leaves other rows selected', async () => {
        const vm = controller(file);
        await Promise.resolve();
        const options = vm.bsTableControl.options;
        const first = {id: 1}, second = {id: 2};
        options.onCheck(first);
        options.onCheck(second);
        assert.deepEqual(Array.from(vm[selected], row => row.id), [1, 2]);
        options.onUncheck({id: 1});
        assert.deepEqual(Array.from(vm[selected], row => row.id), [2]);
        options.onUncheck({id: 99});
        assert.deepEqual(Array.from(vm[selected], row => row.id), [2]);
        options.onCheckAll([first, second]);
        options.onUncheck(second);
        assert.deepEqual(Array.from(vm[selected], row => row.id), [1]);
        options.onUncheckAll();
        assert.equal(vm[selected].length, 0);
    });
}
