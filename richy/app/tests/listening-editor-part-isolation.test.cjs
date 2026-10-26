const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), nodeVm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../question/controllers/IELTSReadingActualTestController.js'), 'utf8');
const start = source.indexOf('        function isolateListeningEditorParts(');
const end = source.indexOf('        function buildOneEditorQuestion(', start);
assert.ok(start >= 0 && end > start);

class Text {
    constructor(text) { this.nodeType = 3; this.text = text; this.parentNode = null; }
    get html() { return this.text; }
}
class Element {
    constructor(tag, attrs = {}, children = []) {
        this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {...attrs}; this.childNodes = []; this.style = {};
        children.forEach(child => this.appendChild(child));
    }
    get children() { return this.childNodes.filter(child => child.nodeType === 1); }
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    appendChild(child) {
        if (child.parentNode) child.parentNode.childNodes.splice(child.parentNode.childNodes.indexOf(child), 1);
        child.parentNode = this; this.childNodes.push(child); return child;
    }
    insertBefore(child, before) {
        const index = this.childNodes.indexOf(before); assert.ok(index >= 0);
        child.parentNode = this; this.childNodes.splice(index, 0, child); return child;
    }
    querySelectorAll() {
        const matches = [];
        for (const child of this.children) {
            const id = child.getAttribute('id') || '', classes = child.getAttribute('class') || '';
            if (id.startsWith('text-question-number-') || (id.startsWith('question-number-') && /\bcomplete-list-drop-box\b/.test(classes))) matches.push(child);
            matches.push(...child.querySelectorAll());
        }
        return matches;
    }
    get innerHTML() { return this.childNodes.map(child => child.html).join(''); }
    get html() {
        const attrs = {...this.attrs}; if (this.style.display) attrs.style = 'display:' + this.style.display;
        const encoded = Object.entries(attrs).map(([key, value]) => ` ${key}="${String(value).replace(/"/g, '&quot;')}"`).join('');
        return '<' + this.tagName.toLowerCase() + encoded + '>' + this.innerHTML + '</' + this.tagName.toLowerCase() + '>';
    }
}
const text = value => new Text(value);
const input = (ordinal, model) => new Element('input', {id: 'text-question-number-' + ordinal, 'ng-model': model || 'item.subQuestions[' + (ordinal - 21) + '].questionAnswers[0].clientAnswer'});
function execute(children, options = {}) {
    const initial = new Element('div', {}, children), html = initial.innerHTML;
    let root, creates = 0;
    const context = nodeVm.createContext({vm: {isListeningRoute: options.listening !== false}, document: {
        createElement(tag) {
            creates++;
            if (!root) {
                root = initial;
                Object.defineProperty(root, 'innerHTML', {get() { return this.childNodes.map(child => child.html).join(''); }, set(value) { assert.equal(value, html); }});
                return root;
            }
            return new Element(tag);
        }
    }, listeningPartNumberForOrdinal: ordinal => Number(ordinal) >= 1 && Number(ordinal) <= 40 ? Math.ceil(Number(ordinal) / 10) : null});
    nodeVm.runInContext(source.slice(start, end), context);
    const output = context.isolateListeningEditorParts(html);
    return {output, root: root || initial, creates};
}

test('mixed one-editor table rows follow their logical Part without changing input IDs or model indices', () => {
    const q30 = input(30), q31 = input(31);
    const row3 = new Element('tr', {}, [new Element('td', {}, [text('Part three context '), q30])]);
    const row4 = new Element('tr', {}, [new Element('td', {}, [text('Part four context '), q31])]);
    const heading = new Element('thead', {}, [new Element('tr', {}, [new Element('th', {}, [text('Shared headings')])])]);
    const result = execute([new Element('table', {}, [heading, new Element('tbody', {}, [row3, row4])])]);
    assert.equal(row3.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 3');
    assert.equal(row4.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 4');
    assert.equal(heading.getAttribute('ng-show'), null);
    assert.equal(q30.getAttribute('ng-model'), 'item.subQuestions[9].questionAnswers[0].clientAnswer');
    assert.equal(q31.getAttribute('ng-model'), 'item.subQuestions[10].questionAnswers[0].clientAnswer');
    assert.equal((result.output.match(/id="text-question-number-30"/g) || []).length, 1);
    assert.equal((result.output.match(/id="text-question-number-31"/g) || []).length, 1);
});

test('plain BR-separated question lines hide their own context and retain the original nodes', () => {
    const q30 = input(30), q31 = input(31);
    const result = execute([text('Question thirty '), q30, new Element('br'), new Element('br'), text('Question thirty-one '), q31]);
    assert.equal(result.root.children.length, 2);
    assert.equal(q30.parentNode.style.display, 'contents');
    assert.equal(q30.parentNode.children.filter(node => node.tagName === 'BR').length, 2, 'both separator breaks hide with their question line');
    assert.equal(q30.parentNode.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 3');
    assert.equal(q31.parentNode.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 4');
    assert.ok(q30.parentNode.childNodes.includes(q30));
    assert.match(result.output, /Question thirty /); assert.match(result.output, /Question thirty-one /);
});

test('a paragraph shared by both Parts keeps context and hides only the relevant answer controls', () => {
    const q30 = input(30), q31 = input(31), paragraph = new Element('p', {}, [text('Shared text '), q30, text(' then '), q31]);
    execute([paragraph]);
    assert.equal(paragraph.getAttribute('ng-show'), null);
    assert.equal(q30.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 3');
    assert.equal(q31.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 4');
});

test('Complete List slots keep drag/drop expressions, original indices and existing visibility guards', () => {
    const slot = ordinal => new Element('span', {class: 'complete-list-drop-box', id: 'question-number-' + ordinal,
        'dnd-list': 'completeListPackage.completeListSlots[' + (ordinal - 21) + '].items'});
    const q30 = slot(30), q31 = slot(31);
    const third = new Element('p', {'ng-show': 'item.ready'}, [text('Third '), q30]);
    const fourth = new Element('p', {}, [text('Fourth '), q31]);
    const result = execute([third, fourth]);
    assert.equal(third.getAttribute('ng-show'), '(item.ready) && vm.activeIeltsNavigationPart() === 3');
    assert.equal(fourth.getAttribute('ng-show'), 'vm.activeIeltsNavigationPart() === 4');
    assert.equal(q31.getAttribute('dnd-list'), 'completeListPackage.completeListSlots[10].items');
    assert.equal((result.output.match(/id="question-number-31"/g) || []).length, 1);
});

test('single-Part content and other test formats remain byte-for-byte unchanged without parsing DOM', () => {
    for (const options of [{}, {listening: false}]) {
        const result = execute([new Element('p', {}, [input(30)])], options);
        assert.equal(result.creates, 0); assert.doesNotMatch(result.output, /ng-show/);
    }
    const q30 = input(30), q31 = input(31);
    const result = execute([q30, q31], {listening: false});
    assert.equal(result.creates, 0); assert.doesNotMatch(result.output, /ng-show/);
});
