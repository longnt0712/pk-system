/* Rebuild the provided-image cutout and native SVG egg stages. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let sharp;
try { sharp = require('sharp'); }
catch (_) { sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }

async function main() {
    const directory = __dirname;
    const original = path.join(directory, 'reference-original.png');
    const {data, info} = await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const {width, height} = info;
    const total = width * height;
    const background = new Uint8Array(total), queue = new Int32Array(total);
    let first = 0, last = 0;
    function nearWhite(index) {
        const pixel = index * 4;
        return data[pixel] >= 232 && data[pixel + 1] >= 232 && data[pixel + 2] >= 232;
    }
    function addBackground(index) {
        if (!background[index] && nearWhite(index)) { background[index] = 1; queue[last++] = index; }
    }
    for (let x = 0; x < width; x++) { addBackground(x); addBackground((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { addBackground(y * width); addBackground(y * width + width - 1); }
    while (first < last) {
        const index = queue[first++], x = index % width, y = Math.floor(index / width);
        if (x) addBackground(index - 1);
        if (x + 1 < width) addBackground(index + 1);
        if (y) addBackground(index - width);
        if (y + 1 < height) addBackground(index + width);
    }
    // The bottom-right publisher logo is a disconnected foreground component.
    // Keep the character component; enclosed eye/smile whites remain untouched.
    const seen = new Uint8Array(total);
    let largest = [];
    for (let start = 0; start < total; start++) {
        if (background[start] || seen[start]) continue;
        first = 0; last = 0; queue[last++] = start; seen[start] = 1;
        const component = [];
        while (first < last) {
            const index = queue[first++], x = index % width, y = Math.floor(index / width);
            component.push(index);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const next = ny * width + nx;
                if (!background[next] && !seen[next]) { seen[next] = 1; queue[last++] = next; }
            }
        }
        if (component.length > largest.length) largest = component;
    }
    const keep = new Uint8Array(total);
    largest.forEach(index => { keep[index] = 1; });
    for (let index = 0; index < total; index++) if (!keep[index]) data[index * 4 + 3] = 0;
    // Unmatte light grayscale edge pixels along the black outline. Their original
    // white compositing becomes translucent black rather than a white halo.
    for (const index of largest) {
        const pixel = index * 4, r = data[pixel], g = data[pixel + 1], b = data[pixel + 2];
        if (Math.min(r, g, b) < 175 || Math.max(r, g, b) - Math.min(r, g, b) > 9) continue;
        const x = index % width, y = Math.floor(index / width);
        const edge = (x > 0 && !keep[index - 1]) || (x + 1 < width && !keep[index + 1])
            || (y > 0 && !keep[index - width]) || (y + 1 < height && !keep[index + width]);
        if (edge) {
            data[pixel] = data[pixel + 1] = data[pixel + 2] = 0;
            data[pixel + 3] = 255 - Math.round((r + g + b) / 3);
        }
    }
    const transparent = await sharp(data, {raw: {width, height, channels: 4}}).png().toBuffer();
    fs.writeFileSync(path.join(directory, 'reference-transparent.png'), transparent);
    const art = 'data:image/png;base64,' + transparent.toString('base64');
    const badge = await sharp(original).extract({left: 207, top: 266, width: 38, height: 40}).png().toBuffer();
    const badgeArt = 'data:image/png;base64,' + badge.toString('base64');
    const definitions = `<defs>
        <linearGradient id="shell" x1=".15" y1=".1" x2=".86" y2=".94"><stop stop-color="#ff9c56"/><stop offset=".32" stop-color="#ff6040"/><stop offset=".68" stop-color="#ef2d24"/><stop offset="1" stop-color="#b71823"/></linearGradient>
        <linearGradient id="tail" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a35d31"/><stop offset=".55" stop-color="#754022"/><stop offset="1" stop-color="#43231a"/></linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#303238"/><stop offset=".4" stop-color="#111216"/><stop offset="1" stop-color="#07080a"/></linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff6d7" stop-opacity=".9"/><stop offset="1" stop-color="#ffc6a6" stop-opacity=".1"/></linearGradient>
        <clipPath id="shellClip"><path d="M506 321C622 321 730 492 759 659C791 851 704 948 511 948C318 948 228 849 259 659C286 490 393 321 506 321Z"/></clipPath>
        <clipPath id="headClip"><path d="M119 3 166 33 191 91 230 128 282 98 254 154 266 184 251 217 231 249 203 271 161 278 119 261 91 245 53 231 81 209 38 194 3 174 43 142 80 129 48 93 16 56 70 42 99 51 136 78Z"/></clipPath>
        <clipPath id="badgeClip"><circle cx="509" cy="708" r="71"/></clipPath>
        <clipPath id="crackedBadgeClip"><circle cx="510" cy="775" r="53"/></clipPath>
    </defs>`;
    const start = (title, description) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc>${definitions}`;
    const tail = `<path d="M701 833C804 858 866 826 863 763C861 711 823 691 803 713C784 733 802 758 825 748" fill="none" stroke="#281b17" stroke-width="52" stroke-linecap="round"/><path d="M701 833C804 858 866 826 863 763C861 711 823 691 803 713C784 733 802 758 825 748" fill="none" stroke="url(#tail)" stroke-width="35" stroke-linecap="round"/>`;
    const staff = `<g transform="rotate(-31 299 560)"><rect x="279" y="303" width="36" height="507" rx="15" fill="#bd171c" stroke="#2a1a20" stroke-width="10"/><path d="M288 320v280" stroke="#ff8562" stroke-width="8" stroke-linecap="round"/></g>`;
    const shellPath = 'M506 321C622 321 730 492 759 659C791 851 704 948 511 948C318 948 228 849 259 659C286 490 393 321 506 321Z';
    const medallion = `<circle cx="509" cy="708" r="85" fill="#ffce32" stroke="#331d20" stroke-width="11"/><circle cx="509" cy="708" r="73" fill="#ffe852" stroke="#9e611f" stroke-width="3"/><image href="${badgeArt}" x="438" y="633" width="142" height="149" clip-path="url(#badgeClip)"/>`;
    const intact = start('Trứng Goku nhí — level 21', 'Vỏ trứng đỏ theo bộ võ phục Goku nhí, tóc đen nhọn, huy hiệu rùa và đuôi khỉ nâu.') + tail + staff +
        `<path d="${shellPath}" fill="url(#shell)" stroke="#2a1a20" stroke-width="12"/>
        <g clip-path="url(#shellClip)"><path d="M694 421C741 582 723 797 611 882C519 951 358 909 291 827C326 923 420 960 536 949C708 936 781 830 765 680C751 563 727 481 694 421Z" fill="#a80f23" opacity=".4"/>
        <path d="M335 499C362 421 423 367 467 359C437 380 410 429 395 484C375 500 352 505 335 499Z" fill="url(#shine)"/><ellipse cx="314" cy="573" rx="19" ry="32" fill="#ffc994" opacity=".75" transform="rotate(15 314 573)"/>
        <path d="M252 805C364 837 641 838 770 790L766 846C646 877 367 878 258 857Z" fill="#13151c"/><path d="M510 841C458 878 419 897 359 926L401 955 536 853Z" fill="#17191f"/>
        ${medallion}</g>
        <path d="M330 404 346 350 287 341 363 301 325 262 407 280 410 215 482 274 520 185 553 280 621 241 618 312 699 291 652 355 684 398 599 375 541 418 472 382 404 421Z" fill="url(#hair)" stroke="#1b1c21" stroke-width="10" stroke-linejoin="round"/>
        <path d="m342 334 57-31-29-22 57 19 8-40 46 49 38-73-5 75 49 10 37-30-7 37 48-7" fill="none" stroke="#55575c" stroke-width="10" stroke-linecap="round" opacity=".7"/>
        </svg>`;
    const crackedShell = 'M261 646 306 682 352 652 397 689 445 650 492 693 539 652 586 688 633 651 681 684 750 641C794 817 712 948 511 948C308 948 224 817 261 646Z';
    const cracked = start('Trứng Goku nhí đang nứt — level 22', 'Goku nhí trong chính ảnh tham chiếu ló tóc và khuôn mặt qua vỏ trứng đỏ đang nứt.') + tail + staff +
        `<g transform="translate(113 47) scale(2.22)"><image href="${art}" width="378" height="529" clip-path="url(#headClip)"/></g>
        <path d="${crackedShell}" fill="url(#shell)" stroke="#2a1a20" stroke-width="12" stroke-linejoin="round"/>
        <path d="M709 680C738 802 674 901 548 927C657 931 742 870 762 782Z" fill="#a80f23" opacity=".4"/>
        <path d="M289 730C302 702 316 696 332 697L322 741Z" fill="#ffb284" opacity=".8"/>
        <path d="M262 821C384 853 634 855 761 811L747 857C618 893 394 888 273 869Z" fill="#17191f"/>
        <circle cx="510" cy="775" r="67" fill="#ffce32" stroke="#331d20" stroke-width="9"/><image href="${badgeArt}" x="457" y="719" width="106" height="111" clip-path="url(#crackedBadgeClip)"/>
        <path d="m397 689 27 57-26 38 29 39" fill="none" stroke="#81202b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="m681 684-18 34 17 29" fill="none" stroke="#81202b" stroke-width="7" stroke-linecap="round"/>
        <path d="m287 575 31-24 31 39-39 10Z" fill="#ff7950" stroke="#2a1a20" stroke-width="8" stroke-linejoin="round"/>
        <path d="m721 563 34 24-28 30-32-16Z" fill="#ff7950" stroke="#2a1a20" stroke-width="8" stroke-linejoin="round"/>
        </svg>`;
    const pet = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc"><title id="title">Goku nhí — level 23</title><desc id="desc">Dùng chính ảnh Goku nhí người dùng chọn: tóc đen, võ phục đỏ, đuôi khỉ và tư thế nhảy giơ tay. Giữ nguyên khuôn mặt, màu sắc và dấu watermark nằm trên nhân vật.</desc><image href="${art}" x="169" y="29" width="686" height="960"/></svg>`;
    for (const [name, source] of [['egg-level-21', intact], ['egg-level-22', cracked], ['pet-level-23', pet]]) {
        fs.writeFileSync(path.join(directory, name + '.svg'), source);
        await sharp(Buffer.from(source)).png().toFile(path.join(directory, name + '.png'));
    }
    console.log(JSON.stringify({source: {width, height}, keptCharacterPixels: largest.length, transparentPixels: total - largest.length}));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
