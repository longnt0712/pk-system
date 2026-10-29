/* Package the selected transparent Imagegen cutout and mask its aura for CSS animation. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let sharp;
try { sharp = require('sharp'); }
catch (_) { sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }

async function main() {
    const directory = __dirname;
    const source = fs.readFileSync(path.join(directory, 'reference-super-saiyan-generated.png'));
    const original = await sharp(source).metadata();
    if (original.width !== 1254 || original.height !== 1254 || !original.hasAlpha) {
        throw new Error('The aura mask is aligned to the selected 1254-square transparent source.');
    }
    const png = await sharp(source).resize(944, 944).extend({top: 40, bottom: 40, left: 40, right: 40,
        background: {r: 0, g: 0, b: 0, alpha: 0}}).ensureAlpha().png().toBuffer();
    fs.writeFileSync(path.join(directory, 'pet-level-23.png'), png);
    const art = 'data:image/png;base64,' + png.toString('base64');
    const header = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">';
    const pet = header + '<title id="title">Son Goku Siêu Saiyan — level 23</title>'
        + '<desc id="desc">Goku tóc vàng cùng hào quang lửa vàng, tách nền từ ảnh tham chiếu bằng Imagegen.</desc>'
        + `<image href="${art}" width="1024" height="1024"/></svg>`;
    fs.writeFileSync(path.join(directory, 'pet-level-23.svg'), pet);

    // This conservative silhouette protects the entire character. Only the existing
    // outer flame pixels can shimmer; the face, hair, fists, outfit and boots stay still.
    const character = 'M576 48 652 105 681 70 740 164 765 112 812 217 849 376 851 462 '
        + '790 500 799 580 783 648 828 664 860 645 894 654 916 694 920 748 879 776 '
        + '807 776 776 752 789 838 800 876 828 978 822 1042 856 1125 860 1175 '
        + '819 1183 762 1164 717 1120 675 1060 636 1100 603 1165 557 1214 495 1224 '
        + '446 1212 446 1163 478 1071 471 1031 468 974 501 907 510 900 479 906 '
        + '449 880 445 832 458 792 456 728 436 699 442 645 477 582 478 563 '
        + '440 539 404 523 382 488 401 459 442 464 430 445 405 413 369 383 '
        + '337 345 319 293 323 245 374 280 377 236 382 176 398 100 437 157 '
        + '479 187 468 134 480 91 544 129Z';
    const aura = header + '<title id="title">Hào quang Siêu Saiyan</title>'
        + '<desc id="desc">Lớp hào quang riêng; nhân vật được che khỏi lớp chuyển động.</desc>'
        + '<defs><mask id="aura-only" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">'
        + '<rect width="1024" height="1024" fill="white"/>'
        + `<path d="${character}" transform="translate(40 40) scale(${944 / 1254})" fill="black" stroke="black" stroke-width="12" stroke-linejoin="round"/>`
        + `<path d="M310 80 580 25 780 80 858 200 880 470 720 535 480 555 285 370 280 195Z" transform="translate(40 40) scale(${944 / 1254})" fill="black"/>`
        + '</mask></defs>'
        + `<image href="${art}" width="1024" height="1024" mask="url(#aura-only)"/></svg>`;
    fs.writeFileSync(path.join(directory, 'super-saiyan-aura.svg'), aura);
    await sharp(Buffer.from(aura)).ensureAlpha().png().toFile(path.join(directory, 'super-saiyan-aura.png'));
    console.log('Built level-23 Goku and a separate transparent aura layer (1024 × 1024 RGBA).');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
