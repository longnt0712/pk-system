const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(app, 'enrolment_class/views/listing.html'), 'utf8');
const globalCss = fs.readFileSync(path.join(app, 'assets/css/custom.css'), 'utf8');
const localCss = view.match(/<style>([\s\S]*?)<\/style>/)[1];
const template = view.match(/<script type="text\/ng-template" id="class_schedule_task_editor_modal\.html">([\s\S]*?)<\/script>/)[1];
const classes = node => (node.attrs.class || '').split(/\s+/);
function fragment(html) {
    const root = {tag: 'root', attrs: {}, children: []}, stack = [root];
    const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const tokens = html.match(/<!--[\s\S]*?-->|<\/?[a-z][\w:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || [];
    for (const token of tokens) {
        if (token.startsWith('<!--')) { continue; }
        const match = token.match(/^<(\/?)([\w:-]+)/), tag = match[2].toLowerCase();
        if (match[1]) {
            assert.equal(stack.at(-1).tag, tag, 'mismatched closing tag: ' + token);
            stack.pop(); continue;
        }
        const attrs = {};
        const attrSource = token.slice(match[0].length, token.length - 1);
        for (const attr of attrSource.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
        }
        const node = {tag, attrs, children: [], parent: stack.at(-1)};
        stack.at(-1).children.push(node);
        if (!voids.has(tag) && !/\/\s*>$/.test(token)) { stack.push(node); }
    }
    assert.equal(stack.length, 1, 'unclosed template tags');
    return root;
}
function all(root, predicate) { return root.children.flatMap(child => [child, ...all(child, predicate)]).filter(predicate); }
function hasClass(node, name) { return classes(node).includes(name); }
function rules(css, viewport, supportsDvh = true) {
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const result = [];
    function collect(block) {
        let index = 0;
        while (index < block.length) {
            const start = block.indexOf('{', index); if (start < 0) { break; }
            const head = block.slice(index, start).trim();
            let depth = 1, end = start + 1, quote = null;
            for (; end < block.length && depth; end++) {
                const ch = block[end];
                if (quote) { if (ch === quote && block[end - 1] !== '\\') { quote = null; } }
                else if (ch === '"' || ch === "'") { quote = ch; }
                else if (ch === '{') { depth++; } else if (ch === '}') { depth--; }
            }
            const body = block.slice(start + 1, end - 1); index = end;
            if (head.startsWith('@media')) {
                const active = [...head.matchAll(/(min|max)-(width|height)\s*:\s*([\d.]+)px/g)].every(match =>
                    match[1] === 'min' ? viewport[match[2]] >= Number(match[3]) : viewport[match[2]] <= Number(match[3]));
                if (active) { collect(body); } continue;
            }
            if (head.startsWith('@')) { continue; }
            const declarations = [];
            for (const declaration of body.split(';')) {
                const colon = declaration.indexOf(':'); if (colon < 0) { continue; }
                const property = declaration.slice(0, colon).trim(), important = /!important\s*$/.test(declaration);
                const value = declaration.slice(colon + 1).replace(/!important\s*$/, '').trim();
                if (!supportsDvh && /\bdvh\b|\d+dvh/.test(value)) { continue; }
                declarations.push({property, value, important});
                if (property === 'overflow') {
                    const [x, y = x] = value.split(/\s+/);
                    declarations.push({property: 'overflow-x', value: x, important}, {property: 'overflow-y', value: y, important});
                }
            }
            for (const selector of head.split(',')) { result.push({selector: selector.trim(), declarations}); }
        }
    }
    collect(css); return result;
}
function matches(node, selector) {
    if (!node || !/^[\w.#\s>-]+$/.test(selector)) { return false; }
    const parts = selector.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
    function simple(candidate, token) {
        if (!candidate) { return false; }
        const tag = token.match(/^[\w-]+/);
        if (tag && candidate.tag !== tag[0]) { return false; }
        return [...token.matchAll(/([.#])([\w-]+)/g)].every(match => match[1] === '.'
            ? hasClass(candidate, match[2]) : candidate.attrs.id === match[2]);
    }
    function visit(candidate, index) {
        if (!simple(candidate, parts[index])) { return false; }
        if (index === 0) { return true; }
        if (parts[index - 1] === '>') { return visit(candidate.parent, index - 2); }
        for (let parent = candidate.parent; parent; parent = parent.parent) { if (visit(parent, index - 1)) { return true; } }
        return false;
    }
    return visit(node, parts.length - 1);
}
function computed(node, cssRules) {
    const style = {}, priorities = {};
    cssRules.forEach((rule, order) => {
        if (!matches(node, rule.selector)) { return; }
        const specificity = (rule.selector.match(/#/g) || []).length * 100 + (rule.selector.match(/\./g) || []).length * 10
            + rule.selector.split(/\s+|>/).filter(token => /^[a-z]/i.test(token)).length;
        for (const [declarationIndex, declaration] of rule.declarations.entries()) {
            const priority = [Number(declaration.important), specificity, order * 1000 + declarationIndex];
            const previous = priorities[declaration.property];
            if (!previous || priority.some((value, index) => value !== previous[index] && value > previous[index]
                    && priority.slice(0, index).every((before, earlier) => before === previous[earlier]))) {
                priorities[declaration.property] = priority; style[declaration.property] = declaration.value;
            }
        }
    });
    return style;
}
function modal() {
    const tree = fragment('<div class="class-management-modal-window class-task-editor-modal-window"><div class="modal-dialog"><div class="modal-content">'
        + template + '</div></div></div>');
    const find = className => all(tree, node => hasClass(node, className))[0];
    return {tree, dialog: find('modal-dialog'), content: find('modal-content'), form: find('class-task-editor-modal'),
        header: find('modal-header'), body: find('modal-body'), footer: find('modal-footer')};
}

test('the task form is balanced with one scroll body containing every question, note and deadline control', () => {
    const m = modal();
    assert.equal(m.form.tag, 'form');
    assert.deepEqual(m.form.children.map(node => classes(node)[0]), ['modal-header','modal-body','modal-footer']);
    assert.equal(all(m.form, node => node.tag === 'form').length, 0, 'no nested form can end the outer form early');
    assert.ok(all(m.body, node => node.tag === 'textarea' && node.attrs['data-ng-model'] === 'vm.taskEditor.notes').length === 1);
    assert.ok(all(m.body, node => node.attrs.name === 'dueDate').length === 1);
    assert.ok(all(m.body, node => node.attrs['data-ng-model'] === 'vm.taskEditor.ieltsParts').length === 1);
    assert.ok(all(m.body, node => node.attrs['data-ng-model'] === 'vm.taskEditor.topicIds').length === 1);
    assert.equal(all(m.footer, node => node.attrs.type === 'submit').length, 1);
    assert.equal(all(m.body, node => node.attrs.type === 'submit').length, 0);
});

test('scoped overflow wins over the actual global ui-select rule in either stylesheet order', () => {
    const m = modal(), viewport = {width: 1440, height: 900};
    const broken = rules(globalCss, viewport);
    assert.equal(computed(m.content, broken)['overflow-y'], 'visible', 'test must exercise the production clipping rule');
    assert.equal(computed(m.body, broken)['overflow-y'], 'visible');
    for (const css of [globalCss + localCss, localCss + globalCss]) {
        const active = rules(css, viewport);
        assert.equal(computed(m.content, active)['overflow-y'], 'hidden');
        assert.equal(computed(m.form, active)['overflow-y'], 'hidden');
        assert.equal(computed(m.body, active)['overflow-y'], 'auto');
        assert.equal(computed(m.body, active)['overflow-x'], 'hidden');
        assert.equal(computed(m.body, active)['min-height'], '0');
        assert.equal(computed(m.body, active).flex, '1 1 0');
        for (const region of [m.header, m.footer]) { assert.equal(computed(region, active).flex, '0 0 auto'); }
    }
});

test('desktop, short desktop, tablet and mobile retain a bounded viewport and shrinkable scroll body', () => {
    const m = modal();
    for (const viewport of [{width:1440,height:900},{width:1440,height:500},{width:900,height:700},{width:390,height:844},{width:390,height:500}]) {
        for (const dvh of [true, false]) {
            const active = rules(globalCss + localCss, viewport, dvh);
            const content = computed(m.content, active), form = computed(m.form, active), body = computed(m.body, active);
            const unit = dvh ? 'dvh' : 'vh';
            assert.equal(content.height, viewport.width > 767 ? '92' + unit : 'calc(100' + unit + ' - 16px)');
            assert.equal(content['max-height'], content.height);
            assert.equal(content.display, 'flex'); assert.equal(form.display, 'flex');
            assert.equal(form['flex-direction'], 'column'); assert.equal(form['min-height'], '0');
            assert.equal(body.height, 'auto'); assert.equal(body['max-height'], 'none');
            assert.equal(computed(m.dialog, active).width, viewport.width > 991 ? '70vw' : viewport.width > 767 ? '86vw' : 'calc(100vw - 16px)');
        }
    }
});

test('the fix stays inside the task window and leaves nested exercise pickers and topic choices available', () => {
    const unrelated = fragment('<div class="class-assignment-picker-window"><div class="modal-content"><div class="class-assignment-picker"><div class="modal-body"></div></div></div></div>');
    const otherBody = all(unrelated, node => hasClass(node, 'modal-body'))[0];
    assert.equal(computed(otherBody, rules(localCss, {width:1440,height:900}))['overflow-y'], undefined);
    assert.ok(all(modal().body, node => node.attrs['data-ng-click'] === 'vm.openTaskExercisePicker()').length === 3);
    assert.ok(all(modal().body, node => node.tag === 'ui-select-choices').length >= 4);
    assert.equal(computed(modal().body, rules(localCss, {width:390,height:844})).padding, '16px');
});


test('direct Daily Listening assignments still show their activity type and required repeat count without a topic', () => {
    const taskTemplate = view.match(/<script type="text\/ng-template" id="class_schedule_tasks\.html">([\s\S]*?)<\/script>/)[1];
    const conditions = [...taskTemplate.matchAll(/<span data-ng-if="([^"]+)">(?:{{task\.activityType|Yêu cầu:)/g)].map(match => match[1]);
    assert.equal(conditions.length, 2);
    for (const condition of conditions) {
        const visible = new Function('task', 'return !!(' + condition + ')');
        assert.equal(visible({activityType:'DAILY_LISTENING',sourceQuestionId:7,topicId:null}),true);
        assert.equal(visible({activityType:'OTHER',sourceQuestionId:7,topicId:null}),false);
        assert.equal(visible({activityType:'DAILY_VOCAB',topicId:4}),true);
        assert.equal(visible({activityType:'IELTS_READING',ieltsTestId:42}),true);
    }
});
