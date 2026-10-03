(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
    else { root.GardenImageExport = factory(root); }
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';
    var assets = {}, crcTable;
    function safeName(value) {
        var name = String(value || '').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, ' ')
            .replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '') || 'Vuon hoa';
        return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name;
    }
    function fileName(garden) {
        var name = safeName([garden.saintName, garden.fullName].filter(Boolean).join(' '));
        return name + (garden.id != null ? '-' + safeName(garden.id) : '') + '.png';
    }
    function loadImage(url) {
        return new Promise(function (resolve, reject) {
            var img = new root.Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('Chưa tải được hình vườn hoa hoặc logo. Vui lòng thử lại.')); };
            img.src = url;
        });
    }
    function asset(url) {
        if (!assets[url]) { assets[url] = loadImage(url).catch(function (error) { delete assets[url]; throw error; }); }
        return assets[url];
    }
    function rounded(ctx, x, y, w, h, radius) {
        ctx.beginPath(); ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius); ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius); ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
    }
    function lines(ctx, value, width) {
        var result = [], current = '';
        Array.from(String(value || '')).forEach(function (letter) {
            if (letter === '\n' || (current && ctx.measureText(current + letter).width > width)) {
                result.push(current.trim()); current = letter === '\n' ? '' : letter;
            } else { current += letter; }
        });
        if (current) { result.push(current.trim()); }
        return result.length ? result : [''];
    }
    function create(campaign, garden) {
        var markup = root.FlowerGarden2026.svgMarkup(campaign, garden.colors || []);
        var svgUrl = root.URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="940" height="1672" viewBox="0 0 940 1672">', markup, '</svg>'], {type: 'image/svg+xml'}));
        var flowers = loadImage(svgUrl).then(function (img) { root.URL.revokeObjectURL(svgUrl); return img; }, function (error) { root.URL.revokeObjectURL(svgUrl); throw error; });
        return Promise.all([asset('assets/images/rosary-2026/vuon-hoa-phung-khoang-background.png'), asset('assets/images/logo-xu-doan.png'), flowers]).then(function (images) {
            var canvas = root.document.createElement('canvas'), ctx = canvas.getContext('2d');
            var width = 350, pad = 18, artWidth = width - pad * 2, artHeight = artWidth * 1672 / 940;
            ctx.font = '700 19px Arial';
            var names = lines(ctx, [garden.saintName, garden.fullName].filter(Boolean).join(' '), artWidth);
            ctx.font = '13px Arial'; var classes = lines(ctx, (garden.classes || []).join(', ') || 'Chưa xếp lớp', artWidth);
            var artTop = 18 + 27 + 12 + names.length * 26.6 + 5 + classes.length * 18.2 + 14;
            var height = Math.ceil(artTop + artHeight + pad);
            canvas.width = width * 3; canvas.height = height * 3; ctx.scale(3, 3);
            rounded(ctx, .5, .5, width - 1, height - 1, 19); ctx.fillStyle = '#fffdfa'; ctx.fill(); ctx.strokeStyle = '#dedac7'; ctx.stroke();
            var badge = '✿  ' + (Number(garden.completedCount) || 0) + ' lượt tích';
            ctx.font = '12px Arial'; rounded(ctx, pad, pad, ctx.measureText(badge).width + 20, 27, 13.5); ctx.fillStyle = '#f6edd9'; ctx.fill();
            ctx.fillStyle = '#745629'; ctx.textBaseline = 'top'; ctx.fillText(badge, pad + 10, pad + 7);
            ctx.font = '700 19px Arial'; ctx.fillStyle = '#304d3e'; var y = 57;
            names.forEach(function (line) { ctx.fillText(line, pad, y); y += 26.6; });
            y += 5; ctx.font = '13px Arial'; ctx.fillStyle = '#718074';
            classes.forEach(function (line) { ctx.fillText(line, pad, y); y += 18.2; });
            ctx.save(); rounded(ctx, pad, artTop, artWidth, artHeight, 12); ctx.clip();
            ctx.drawImage(images[0], pad, artTop, artWidth, artHeight); ctx.drawImage(images[2], pad, artTop, artWidth, artHeight);
            var logoSize = artWidth * .11, logoX = pad + artWidth * .87, logoY = artTop + artWidth * .02;
            ctx.save(); ctx.beginPath(); ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = .88;
            ctx.drawImage(images[1], logoX, logoY, logoSize, logoSize); ctx.restore(); ctx.restore();
            return new Promise(function (resolve, reject) {
                canvas.toBlob(function (blob) { canvas.width = canvas.height = 1; if (blob) { resolve(blob); } else { reject(new Error('Chưa tạo được ảnh vườn hoa. Vui lòng thử lại.')); } }, 'image/png');
            });
        });
    }
    function download(blob, name) {
        var url = root.URL.createObjectURL(blob), link = root.document.createElement('a');
        link.href = url; link.download = name; root.document.body.appendChild(link); link.click(); link.remove();
        root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 60000);
    }
    function bytes(blob) {
        if (blob.arrayBuffer) { return blob.arrayBuffer(); }
        return new Promise(function (resolve, reject) { var reader = new root.FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsArrayBuffer(blob); });
    }
    function crc32(data) {
        if (!crcTable) {
            crcTable = new Uint32Array(256);
            for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } crcTable[n] = c; }
        }
        var crc = 0xffffffff; for (var i = 0; i < data.length; i++) { crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8); }
        return (crc ^ 0xffffffff) >>> 0;
    }
    // PNG is already compressed. STORE avoids recompression and keeps only one image's CRC buffer in memory.
    function archive() {
        var parts = [], central = [], offset = 0, count = 0;
        var now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        var date = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        return {
            add: function (path, blob) {
                var name = new root.TextEncoder().encode(path);
                if (count >= 65535 || name.length > 65535 || offset + blob.size + name.length + 30 >= 0xffffffff) { return Promise.reject(new Error('ZIP quá lớn. Vui lòng chọn ít lớp hơn cho mỗi lần xuất.')); }
                return bytes(blob).then(function (buffer) {
                    var crc = crc32(new Uint8Array(buffer)), local = new Uint8Array(30), lh = new DataView(local.buffer);
                    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x800, true);
                    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
                    lh.setUint32(18, blob.size, true); lh.setUint32(22, blob.size, true); lh.setUint16(26, name.length, true);
                    var record = new Uint8Array(46), ch = new DataView(record.buffer);
                    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x800, true);
                    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
                    ch.setUint32(20, blob.size, true); ch.setUint32(24, blob.size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
                    parts.push(local, name, blob); central.push(record, name); offset += 30 + name.length + blob.size; count++;
                });
            },
            finish: function () {
                var size = central.reduce(function (sum, part) { return sum + part.length; }, 0);
                if (offset + size + 22 >= 0xffffffff) { throw new Error('ZIP quá lớn. Vui lòng chọn ít lớp hơn cho mỗi lần xuất.'); }
                var end = new Uint8Array(22), eh = new DataView(end.buffer);
                eh.setUint32(0, 0x06054b50, true); eh.setUint16(8, count, true); eh.setUint16(10, count, true); eh.setUint32(12, size, true); eh.setUint32(16, offset, true);
                return new Blob(parts.concat(central, [end]), {type: 'application/zip'});
            }
        };
    }
    return {create: create, download: download, archive: archive, safeName: safeName, fileName: fileName};
}));
