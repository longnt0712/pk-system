const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../campaign/controllers/CampaignQrScanner.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({secure=true,startError=null,delayed=false}={}) {
    let factory,destroy,decode,finishStart,fileChange;
    const calls=[], file={files:[],value:'',addEventListener(e,fn){fileChange=fn;},removeEventListener(){calls.push('remove-file-listener');}};
    const scope={vm:{scanBusy:false,useScannedQr:async text=>calls.push(['decoded',text])},$evalAsync(fn){if(fn)fn();},$on(e,fn){destroy=fn;}};
    class Reader {
        constructor(id){calls.push(['reader',id]);}
        start(camera,config,onScan){decode=onScan;calls.push(['start',camera,config]);return startError?Promise.reject(startError):delayed?new Promise(resolve=>finishStart=resolve):Promise.resolve();}
        stop(){calls.push('stop');return Promise.resolve();}
        clear(){calls.push('clear');}
        scanFile(image,show){calls.push(['file',image,show]);return Promise.resolve('hs0007');}
    }
    vm.runInNewContext(source,{Promise,Date,angular:{module:()=>({directive(n,args){factory=args.at(-1);}})}});
    factory({isSecureContext:secure,Html5Qrcode:Reader}).link(scope,[{querySelector:()=>file}]);
    return {scope,scanner:scope.scanner,calls,decode:text=>decode(text),destroy:()=>destroy(),finishStart:()=>finishStart(),upload:image=>{file.files=[image];return fileChange();}};
}
test('camera requests the rear lens only after a click and duplicate detections resolve once',async()=>{
    const h=setup();assert.equal(h.calls.length,0);
    await h.scanner.start();assert.equal(h.scanner.visible,true);
    const start=h.calls.find(c=>Array.isArray(c)&&c[0]==='start');assert.equal(start[1].facingMode,'environment');
    assert.equal(start[2].qrbox(320,240).width,168);
    h.decode('hs0007');h.decode('hs0007');await tick();
    assert.equal(h.calls.filter(c=>Array.isArray(c)&&c[0]==='decoded').length,1);
    h.destroy();await tick();assert.ok(h.calls.includes('stop'));assert.ok(h.calls.includes('remove-file-listener'));
});
test('leaving while permission is pending stops the camera as soon as it starts',async()=>{
    const h=setup({delayed:true});const opening=h.scanner.start();h.destroy();h.finishStart();await opening;await tick();
    assert.equal(h.calls.filter(c=>c==='stop').length,1);assert.equal(h.scanner.visible,false);
});
test('permission failure and HTTP leave a clear message and permit QR image fallback',async()=>{
    const h=setup({startError:{name:'NotAllowedError'}});await h.scanner.start();assert.match(h.scanner.error,/cho phép/);assert.equal(h.scanner.visible,false);assert.equal(h.scanner.starting,false);
    const http=setup({secure:false});http.scanner.start();assert.match(http.scanner.error,/HTTPS/);assert.equal(http.calls.length,0);
});
test('photo scanning stops a running camera before decoding the existing student code',async()=>{
    const h=setup();await h.scanner.start();h.upload({name:'card.png'});await tick();
    assert.ok(h.calls.indexOf('stop')<h.calls.findIndex(c=>Array.isArray(c)&&c[0]==='file'));
    assert.equal(h.calls.find(c=>Array.isArray(c)&&c[0]==='decoded')[1],'hs0007');assert.equal(h.scanner.starting,false);
});
