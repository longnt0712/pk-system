/* Preserve the uploaded illustration unchanged; native SVG supplies background alpha. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let sharp;
try { sharp = require('sharp'); }
catch (_) { sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
const directory = __dirname;

function largestComponent(data, width, height, threshold) {
    const count = width * height, seen = new Uint8Array(count), queue = new Int32Array(count);
    let best = [];
    const bright = pixel => Math.max(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]) > threshold;
    for (let seed = 0; seed < count; seed++) {
        if (seen[seed] || !bright(seed)) continue;
        let first = 0, last = 0;
        queue[last++] = seed; seen[seed] = 1;
        function add(pixel) {
            if (!seen[pixel] && bright(pixel)) { seen[pixel] = 1; queue[last++] = pixel; }
        }
        while (first < last) {
            const pixel = queue[first++], x = pixel % width, y = Math.floor(pixel / width);
            if (x) add(pixel - 1); if (x + 1 < width) add(pixel + 1);
            if (y) add(pixel - width); if (y + 1 < height) add(pixel + width);
        }
        if (last > best.length) best = queue.slice(0, last);
    }
    const component = new Uint8Array(count);
    for (const pixel of best) component[pixel] = 1;
    return component;
}

// Retain enclosed colored interiors and small ink/shadow gaps while leaving the
// real dark gap beside the tail transparent. The logo never enters the core.
function fillSubjectInterior(core, data, width, height) {
    const seen = new Uint8Array(core.length), queue = new Int32Array(core.length);
    for (let seed = 0; seed < core.length; seed++) {
        if (core[seed] || seen[seed]) continue;
        let first = 0, last = 0, border = false, brightness = 0;
        queue[last++] = seed; seen[seed] = 1;
        function add(pixel) {
            if (!core[pixel] && !seen[pixel]) { seen[pixel] = 1; queue[last++] = pixel; }
        }
        while (first < last) {
            const pixel = queue[first++], x = pixel % width, y = Math.floor(pixel / width);
            brightness += Math.max(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]);
            if (!x || !y || x === width - 1 || y === height - 1) border = true;
            if (x) add(pixel - 1); if (x + 1 < width) add(pixel + 1);
            if (y) add(pixel - width); if (y + 1 < height) add(pixel + width);
        }
        if (!border && (last < 1000 || brightness / last > 45)) {
            for (let i = 0; i < last; i++) core[queue[i]] = 1;
        }
    }
}

async function main() {
    const original = fs.readFileSync(path.join(directory, 'reference-super-saiyan-4-original.png'));
    const {data, info: {width, height}} = await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const glow = largestComponent(data, width, height, 60);
    const core = largestComponent(data, width, height, 120);
    fillSubjectInterior(core, data, width, height);
    const mask = Buffer.alloc(width * height * 3);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let pixel = 0; pixel < glow.length; pixel++) {
        let alpha = 0;
        if (core[pixel]) alpha = 255;
        else if (glow[pixel]) {
            const value = Math.max(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]);
            const strength = Math.max(0, Math.min(1, (value - 60) / 60));
            alpha = Math.round(255 * strength * strength * (3 - 2 * strength));
        }
        mask[pixel * 3] = mask[pixel * 3 + 1] = mask[pixel * 3 + 2] = alpha;
        if (alpha) {
            const x = pixel % width, y = Math.floor(pixel / width);
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
    }
    const maskImage = await sharp(mask, {raw: {width, height, channels: 3}}).png().toBuffer();
    const scale = Math.min(904 / (maxX - minX + 1), 904 / (maxY - minY + 1));
    const offsetX = (1024 - (maxX - minX + 1) * scale) / 2 - minX * scale;
    const offsetY = (1024 - (maxY - minY + 1) * scale) / 2 - minY * scale;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">'
        + '<title id="title">Son Goku Siêu Saiyan 4 — Level 25</title>'
        + '<desc id="desc">Giữ nguyên ảnh Goku người dùng cung cấp, cùng toàn bộ tóc, đuôi và viền sáng tím. Nền đen được tách bằng mặt nạ SVG.</desc>'
        + `<defs><mask id="background-alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:luminance"><image href="data:image/png;base64,${maskImage.toString('base64')}" width="${width}" height="${height}"/></mask></defs>`
        + `<g id="character-art" transform="translate(${offsetX.toFixed(4)} ${offsetY.toFixed(4)}) scale(${scale.toFixed(8)})"><image href="data:image/png;base64,${original.toString('base64')}" width="${width}" height="${height}" mask="url(#background-alpha)"/></g></svg>`;
    fs.writeFileSync(path.join(directory, 'pet-level-25.svg'), svg);
    const png = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
    fs.writeFileSync(path.join(directory, 'pet-level-25.png'), png);
    console.log(JSON.stringify({level: 25, source: [width, height], output: [1024, 1024], sourceBounds: [minX, minY, maxX, maxY], scale, padding: 60}));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
