const {test}=require('node:test');
const assert=require('node:assert/strict');
const exporter=require('../campaign/rosary2026/GardenImageExport.js');
test('ZIP contains independent Unicode-named image files with valid CRCs and bytes',async()=>{
    const zip=exporter.archive();const first=Uint8Array.from([137,80,78,71,1,2,3]);const second=Uint8Array.from([137,80,78,71,4,5,6]);
    await zip.add('Thiếu 1-12/Đa Minh Nguyễn Văn An-1.png',new Blob([first]));await zip.add('Ấu 1-13/Têrêsa Lưu Huyền Trang-2.png',new Blob([second]));
    const blob=zip.finish();assert.equal(blob.type,'application/zip');
    const buffer=Buffer.from(await blob.arrayBuffer()),end=buffer.length-22;
    assert.equal(buffer.readUInt32LE(end),0x06054b50);assert.equal(buffer.readUInt16LE(end+10),2);
    let central=buffer.readUInt32LE(end+16);const images=new Map();
    for(let i=0;i<2;i++){
        assert.equal(buffer.readUInt32LE(central),0x02014b50);assert.equal(buffer.readUInt16LE(central+8),0x800);assert.equal(buffer.readUInt16LE(central+10),0);
        const nameLength=buffer.readUInt16LE(central+28),name=buffer.subarray(central+46,central+46+nameLength).toString('utf8');
        const local=buffer.readUInt32LE(central+42);assert.equal(buffer.readUInt32LE(local),0x04034b50);
        const start=local+30+buffer.readUInt16LE(local+26),bytes=buffer.subarray(start,start+buffer.readUInt32LE(central+24));
        // Known IEEE CRC-32 values for the two fixed fixtures, independently verified.
        assert.equal(buffer.readUInt32LE(central+16),[0xc791a70b,0xfe7107a8][i]);images.set(name,new Uint8Array(bytes));central+=46+nameLength;
    }
    assert.equal(central,end);
    assert.deepEqual(images.get('Thiếu 1-12/Đa Minh Nguyễn Văn An-1.png'),first);
    assert.deepEqual(images.get('Ấu 1-13/Têrêsa Lưu Huyền Trang-2.png'),second);
});
test('image filenames contain human names and unique IDs without unsafe paths',()=>{
    assert.equal(exporter.fileName({id:7,saintName:'Đa Minh',fullName:'Nguyễn Văn An',studentCode:'secret-qr'}),'Đa Minh Nguyễn Văn An-7.png');
    assert.equal(exporter.fileName({saintName:'Têrêsa',fullName:'Lưu Huyền Trang'}),'Têrêsa Lưu Huyền Trang.png');
    const name=exporter.safeName('../<Thiếu>\\1/\u202e:*?');assert.ok(!/[<>:"/\\|?*\u202e]/.test(name));assert.ok(!name.startsWith('.'));
    assert.equal(exporter.fileName({fullName:'CON'}),'_CON.png');
});
