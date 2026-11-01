const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../common/utils/site-seo.js'),'utf8');
test('route titles remain useful and only public login/home can retain an indexable canonical',()=>{
    for(const hostname of ['ieltsroom.com','www.ieltsroom.com','tnttphungkhoang.com','www.tnttphungkhoang.com','tnttphungkhoang.com.evil.test']) {
        let run,changed;
        const nodes={robots:{content:''}};
        const head={appendChild(node){nodes.canonical=node;node.parentNode=head;},removeChild(){delete nodes.canonical;}};
        const document={head,title:'',querySelector:()=>nodes.robots,getElementById:()=>nodes.canonical,createElement:()=>({})};
        vm.runInNewContext(source,{Hrm:{run(definition){run=definition.at(-1);}}});
        run({$on(name,handler){assert.equal(name,'$stateChangeSuccess');changed=handler;}},{document,location:{hostname}});
        const tntt=/^(www\.)?tnttphungkhoang\.com$/.test(hostname);
        changed({}, {name:'login'});
        assert.equal(nodes.canonical.href,tntt?'https://tnttphungkhoang.com/':'https://ieltsroom.com/');
        assert.match(nodes.robots.content,/^index/);
        assert.ok(document.title.startsWith(tntt?'TNTT Phùng Khoang':'IELTS Room'));
        changed({}, {name:'application.englishClass',data:{pageTitle:'Lớp tiếng Anh'}});
        assert.ok(document.title.endsWith(' | Lớp tiếng Anh'));
        assert.equal(nodes.robots.content,'noindex, nofollow');assert.equal(nodes.canonical,undefined);
        changed({}, {name:'login'});assert.ok(nodes.canonical.href.endsWith('/'));assert.match(nodes.robots.content,/^index/);
    }
});
