/* Render the user's unchanged artwork through native SVG masks and energy layers. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let sharp;
try { sharp = require('sharp'); }
catch (_) { sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
const directory = __dirname;
const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">';

// Build vector scanline runs around the connected white background. The embedded
// original is untouched; enclosed eye and hair highlights stay inside the mask.
async function whiteBackgroundClip(file) {
    const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const {width: w, height: h} = info;
    const background = new Uint8Array(w * h), queue = new Int32Array(w * h);
    let first = 0, last = 0;
    function add(i) {
        if (background[i]) return;
        const p = i * 4;
        if (data[p] >= 238 && data[p + 1] >= 238 && data[p + 2] >= 238) {
            background[i] = 1; queue[last++] = i;
        }
    }
    for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
    while (first < last) {
        const i = queue[first++], x = i % w, y = Math.floor(i / w);
        if (x) add(i - 1); if (x + 1 < w) add(i + 1);
        if (y) add(i - w); if (y + 1 < h) add(i + w);
    }
    const runs = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w;) {
            if (background[y * w + x]) { x++; continue; }
            const start = x;
            while (x < w && !background[y * w + x]) x++;
            runs.push(`M${start} ${y}h${x - start}v1h-${x - start}Z`);
        }
    }
    return runs.join('');
}

const defs = '<defs><filter id="arc-glow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="3"/></filter><filter id="core-soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feGaussianBlur stdDeviation="6"/></filter></defs>';
let goldenAura;
function haloArtwork() {
    return `<g id="aura-envelope"><image href="data:image/png;base64,${goldenAura}" width="1024" height="1024"/></g>`;
}
const arcs = [
    'M338 168C308 151 303 180 299 198L321 220 304 245Q275 267 282 291L300 306 288 335Q275 360 291 382 M316 218 350 215 335 233 M283 290 259 282 271 309 M289 334 313 348 306 369 M703 132Q733 157 721 186L701 205 728 226C750 247 725 265 711 284L735 305 719 332 M727 225 766 233 746 247 M714 554C686 536 674 559 662 571L654 599C636 618 606 602 593 626L583 659Q554 674 535 658C516 642 489 669 471 690 M593 626 603 590 576 617 M535 658 520 695 505 677',
    'M271 486Q244 504 261 526L276 542 251 561C237 580 252 591 249 610 M262 525 236 520 247 541 M785 389C756 413 774 429 761 449L741 467 760 492Q780 513 756 535 M760 450 791 440 775 463 M273 755 249 770C230 796 258 802 253 822L235 853Q213 872 239 885L259 876 M253 821 278 828 263 846 M709 806C734 820 711 843 719 863L747 877Q772 902 746 919L722 943 M719 863 691 862 707 881 M358 899Q374 918 355 937L340 950 353 973'
];
const arcFlares = [
    'M313 209 325 220 314 235 318 223 303 218Z M277 281 286 288 281 303 278 292 266 289Z M720 216 733 227 720 239 725 228 709 225Z M588 615 599 625 586 641 591 626 577 621Z M529 651 540 660 526 673 531 661 515 657Z',
    'M255 518 266 525 256 539 258 528 245 523Z M754 442 766 449 755 463 759 450 746 446Z M247 814 258 822 248 836 251 824 236 820Z M713 855 725 863 714 876 718 864 704 860Z'
];
function arcLayer(index, staticArt = false) {
    const opacity = staticArt ? ' opacity=".76"' : '';
    return `<g class="arc arc-${index}"${opacity}><path d="${arcs[index]}" fill="none" stroke="#aeeaff" stroke-width="13" stroke-linejoin="round" stroke-linecap="round" filter="url(#arc-glow)"/>`
        + `<path d="${arcs[index]}" fill="none" stroke="#dff8ff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="${arcs[index]}" fill="none" stroke="white" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/><path d="${arcFlares[index]}" fill="white"/></g>`;
}
const animation = '<style>.aura{transform-box:view-box;transform-origin:512px 930px;animation:ssj2-energy 1.5s ease-in-out infinite}.arc-0{animation:ssj2-arc-a .92s steps(1,end) infinite}.arc-1{animation:ssj2-arc-b 1.12s steps(1,end) infinite}'
    + '@keyframes ssj2-energy{0%,100%{opacity:.72;transform:scale(1)}50%{opacity:1;transform:scale(1.02,1.025)}}'
    + '@keyframes ssj2-arc-a{0%,18%,39%,61%,84%{opacity:1}9%,31%,48%,72%,94%,100%{opacity:.12}}'
    + '@keyframes ssj2-arc-b{0%,23%,48%,71%,94%{opacity:.08}11%,34%,58%,83%,100%{opacity:1}}'
    + '@media(prefers-reduced-motion:reduce){.aura,.arc{animation:none!important}.arc{opacity:.65}}</style>';

async function buildStage(level, filename, clip, transform, title) {
    const original = fs.readFileSync(path.join(directory, filename));
    const metadata = await sharp(original).metadata();
    const art = 'data:image/png;base64,' + original.toString('base64');
    goldenAura = (await sharp(path.join(directory, 'energy-outline-level-' + level + '.png'))
        .resize(920, 920, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
        .extend({top: 52, bottom: 52, left: 52, right: 52, background: {r: 0, g: 0, b: 0, alpha: 0}})
        .ensureAlpha().png().toBuffer()).toString('base64');
    const clipDefs = `<defs><clipPath id="character"><path d="${clip}"/></clipPath><path id="body-silhouette" d="${clip}" transform="${transform}" vector-effect="non-scaling-stroke"/><mask id="aura-only" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><use href="#body-silhouette" fill="black" stroke="black" stroke-width="4"/></mask></defs>`;
    const character = `<g id="character-art" transform="${transform}"><image href="${art}" width="${metadata.width}" height="${metadata.height}" clip-path="url(#character)"/></g>`;
    // The filled core and exclusion mask stay fixed to Goku while only the outer
    // energy moves. This prevents dark gaps or energy painted over his outline.
    const core = '<g id="aura-core" filter="url(#core-soft)"><use href="#body-silhouette" fill="#fff181" stroke="#fff181" stroke-width="44" stroke-linejoin="round"/></g>';
    const aura = `<g mask="url(#aura-only)"><g class="aura">${haloArtwork()}</g></g>`;
    const description = '<desc id="desc">Ảnh Goku gốc với hào quang vàng ôm theo toàn bộ mép tóc, tay và chân.</desc>';
    const content = svgStart + `<title id="title">${title}</title>` + description + defs + clipDefs;
    const still = content + core + aura + character + (level === 24 ? arcLayer(0, true) + arcLayer(1, true) : '') + '</svg>';
    const svg = level === 24 ? content + animation + core + aura + character + arcLayer(0) + arcLayer(1) + '</svg>' : still;
    fs.writeFileSync(path.join(directory, `pet-level-${level}.svg`), svg);
    fs.writeFileSync(path.join(directory, `pet-level-${level}.png`), await sharp(Buffer.from(still)).ensureAlpha().png().toBuffer());
    const auraOnly = content + aura + '</svg>';
    const auraName = level === 23 ? 'super-saiyan-aura' : 'super-saiyan-2-aura';
    fs.writeFileSync(path.join(directory, auraName + '.svg'), auraOnly);
    fs.writeFileSync(path.join(directory, auraName + '.png'), await sharp(Buffer.from(auraOnly)).ensureAlpha().png().toBuffer());
}

async function main() {
    const punch = 'reference-super-saiyan-punch-original.png';
    await buildStage(23, punch, await whiteBackgroundClip(path.join(directory, punch)),
        'translate(210 120) scale(.8)', 'Son Goku Siêu Saiyan — level 23');
    const stage2 = "M438 60C466 78 491 116 505 157L514 197 531 135C557 181 567 232 558 268L547 288 596 248C582 286 566 321 542 343L518 357 546 359 522 381 500 398 480 411C469 429 452 441 433 449L459 451 510 446 495 468C510 475 520 484 525 495L519 508C535 530 548 560 564 581L581 597 600 578C604 562 613 562 617 577L622 588 630 581C641 588 644 606 641 617C650 632 642 644 630 652L609 662C587 664 576 653 562 645L538 639 508 621 488 610 480 640 474 665C488 703 498 742 507 780L511 813 507 843 506 869 515 900 516 927 504 952 496 959 504 989 515 1021 515 1041 534 1086C548 1110 541 1131 517 1139C493 1134 463 1113 454 1090L444 1064 439 1040 425 1019 419 991 404 964 389 950 373 928 361 918 343 927 327 950 306 967 285 972 274 1009 255 1042 247 1074C246 1091 222 1105 205 1117L181 1130C160 1142 146 1128 147 1112L151 1096 164 1071 181 1043 185 1027 187 1006 191 979 194 964 181 953 169 940 171 921 185 902 190 888 190 876 200 856 204 830 204 799 214 770 194 754 188 730 187 694 218 682 226 666 247 661 248 635 225 641 198 653 178 661 158 672 144 683 125 688C114 686 105 683 102 675L98 660 96 645 89 635 89 625 97 620 103 622 105 611 115 607 127 610 136 621 145 619 153 620 167 617 190 611 207 600 221 574 228 558 227 545 225 535C225 524 235 515 246 508L249 485 254 468 267 459 285 477 303 464 303 450C282 425 269 399 262 374L255 356 247 348 233 311 253 325 261 322 252 300C242 276 241 242 246 196L263 233 270 246C270 201 286 166 308 137L349 104 343 134C358 119 380 104 402 90L397 128 393 152 418 126 433 99Z";
    await buildStage(24, 'reference-super-saiyan-2-original.png', stage2,
        'translate(250 98) scale(.7)', 'Son Goku Siêu Saiyan cấp 2 — level 24');
    console.log('Rendered both original Goku illustrations with transparent vector masks, aura and level-24 animated electricity.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
