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
function haloArtwork(level) {
    const placement = level === 23 ? ' transform="rotate(12 512 512)"' : '';
    return `<g id="aura-envelope"${placement}><image href="data:image/png;base64,${goldenAura}" width="1024" height="1024"/></g>`;
}
const arcs = [
    // Filled ribbons vary in thickness and finish in sharp, tapered tips. A few
    // broad angular junctions join thin curved filaments like the anime reference.
    'M337 154Q345 171 356 175L372 173 358 186 366 199 353 204 343 233 346 253 337 263 343 289 362 302 343 298 329 288 328 256 336 235 338 213 350 195 343 183 329 178Z '
        + 'M356 183Q371 173 385 181L401 194 383 187 368 190 359 200 362 188Z '
        + 'M730 136 720 165Q713 179 727 193L745 206 731 227 734 239 719 250 726 276 716 301 719 277 709 251 723 234 719 224 734 207 717 196Q703 184 712 166Z '
        + 'M671 498Q703 478 739 493L755 508 737 499Q704 486 682 507L663 528 667 548 649 554 626 585 609 583 593 598 584 619 568 625 551 658 553 634 567 613 584 607 588 590 608 573 622 575 642 545 654 539 653 525Z '
        + 'M585 610 580 582 566 568 571 590 568 613 553 628 575 622Z',
    'M291 461 279 487 293 504 286 518 288 538 275 555 267 585 268 559 277 538 276 516 282 505 268 490 279 478Z '
        + 'M760 359 750 389 762 409 752 422 756 439 740 454 743 477 731 492 734 473 731 453 745 435 743 420 752 408 743 390Z '
        + 'M306 711 300 741 315 754 305 774 310 793 295 807 294 835 279 851 282 831 281 805 299 787 296 773 304 758 291 745Z '
        + 'M674 773 694 790 690 811 703 826 695 841 703 854 697 873 717 890 708 914 700 930 703 909 708 893 685 875 693 856 683 843 693 827 680 813 683 794Z '
        + 'M362 850 355 875 366 893 359 914 344 928 353 908 355 894 346 875Z'
];
function arcLayer(index, staticArt = false) {
    const opacity = staticArt ? ' opacity=".9"' : '';
    return `<g class="arc arc-${index}"${opacity}><path d="${arcs[index]}" fill="#c4edff" stroke="#bce7ff" stroke-width="5" filter="url(#arc-glow)"/>`
        + `<path d="${arcs[index]}" fill="white" stroke="#e1f6ff" stroke-width=".8" stroke-linejoin="miter"/></g>`;
}
const animation = '<style>.aura{transform-box:view-box;transform-origin:512px 930px;animation:ssj2-energy 1.5s ease-in-out infinite}.arc-0{animation:ssj2-arc-a .92s steps(1,end) infinite}.arc-1{animation:ssj2-arc-b 1.12s steps(1,end) infinite}'
    + '@keyframes ssj2-energy{0%,100%{opacity:.72;transform:scale(1)}50%{opacity:1;transform:scale(1.02,1.025)}}'
    + '@keyframes ssj2-arc-a{0%,18%,39%,61%,84%{opacity:1}9%,31%,48%,72%,94%,100%{opacity:0}}'
    + '@keyframes ssj2-arc-b{0%,23%,48%,71%,94%{opacity:0}11%,34%,58%,83%,100%{opacity:1}}'
    + '@media(prefers-reduced-motion:reduce){.aura,.arc{animation:none!important}.arc{opacity:.65}}</style>';

async function buildStage(level, filename, clip, transform, title) {
    const original = fs.readFileSync(path.join(directory, filename));
    const metadata = await sharp(original).metadata();
    const art = 'data:image/png;base64,' + original.toString('base64');
    const auraFile = 'energy-closed-level-24.png';
    goldenAura = (await sharp(path.join(directory, auraFile))
        .resize(920, 920, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
        .extend({top: 52, bottom: 52, left: 52, right: 52, background: {r: 0, g: 0, b: 0, alpha: 0}})
        .ensureAlpha().png().toBuffer()).toString('base64');
    const clipDefs = `<defs><clipPath id="character"><path d="${clip}"/></clipPath><path id="body-silhouette" d="${clip}" transform="${transform}" vector-effect="non-scaling-stroke"/><mask id="aura-only" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><use href="#body-silhouette" fill="black" stroke="black" stroke-width="4"/></mask></defs>`;
    const character = `<g id="character-art" transform="${transform}"><image href="${art}" width="${metadata.width}" height="${metadata.height}" clip-path="url(#character)"/></g>`;
    // The filled core and exclusion mask stay fixed to Goku while only the outer
    // energy moves. This prevents dark gaps or energy painted over his outline.
    const core = '<g id="aura-core" filter="url(#core-soft)" opacity=".25"><use href="#body-silhouette" fill="#eed45e" stroke="#eed45e" stroke-width="36" stroke-linejoin="round"/></g>';
    const aura = `<g mask="url(#aura-only)"><g class="aura">${haloArtwork(level)}</g></g>`;
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
    const option = process.argv.find(argument => argument.startsWith('--level='));
    const requestedLevel = option ? Number(option.split('=')[1]) : null;
    if (option && ![23, 24].includes(requestedLevel)) throw new Error('Use --level=23 or --level=24.');
    const punch = 'reference-super-saiyan-punch-original.png';
    if (!requestedLevel || requestedLevel === 23) {
        await buildStage(23, punch, await whiteBackgroundClip(path.join(directory, punch)),
            'translate(210 120) scale(.8)', 'Son Goku Siêu Saiyan — level 23');
    }
    const stage2 = "M438 60C466 78 491 116 505 157L514 197 531 135C557 181 567 232 558 268L547 288 596 248C582 286 566 321 542 343L518 357 546 359 522 381 500 398 480 411C469 429 452 441 433 449L459 451 510 446 495 468C510 475 520 484 525 495L519 508C535 530 548 560 564 581L581 597 600 578C604 562 613 562 617 577L622 588 630 581C641 588 644 606 641 617C650 632 642 644 630 652L609 662C587 664 576 653 562 645L538 639 508 621 488 610 480 640 474 665C488 703 498 742 507 780L511 813 507 843 506 869 515 900 516 927 504 952 496 959 504 989 515 1021 515 1041 534 1086C548 1110 541 1131 517 1139C493 1134 463 1113 454 1090L444 1064 439 1040 425 1019 419 991 404 964 389 950 373 928 361 918 343 927 327 950 306 967 285 972 274 1009 255 1042 247 1074C246 1091 222 1105 205 1117L181 1130C160 1142 146 1128 147 1112L151 1096 164 1071 181 1043 185 1027 187 1006 191 979 194 964 181 953 169 940 171 921 185 902 190 888 190 876 200 856 204 830 204 799 214 770 194 754 188 730 187 694 218 682 226 666 247 661 248 635 225 641 198 653 178 661 158 672 144 683 125 688C114 686 105 683 102 675L98 660 96 645 89 635 89 625 97 620 103 622 105 611 115 607 127 610 136 621 145 619 153 620 167 617 190 611 207 600 221 574 228 558 227 545 225 535C225 524 235 515 246 508L249 485 254 468 267 459 285 477 303 464 303 450C282 425 269 399 262 374L255 356 247 348 233 311 253 325 261 322 252 300C242 276 241 242 246 196L263 233 270 246C270 201 286 166 308 137L349 104 343 134C358 119 380 104 402 90L397 128 393 152 418 126 433 99Z";
    if (!requestedLevel || requestedLevel === 24) {
        await buildStage(24, 'reference-super-saiyan-2-original.png', stage2,
            'translate(250 98) scale(.7)', 'Son Goku Siêu Saiyan cấp 2 — level 24');
    }
    console.log('Rendered Goku level ' + (requestedLevel || '23 and 24') + ' with the original artwork and energy layers.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
