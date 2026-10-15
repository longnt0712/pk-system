// Run with: node --test richy/app/tests/pikachu-animation-browser.test.cjs
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const app = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
const template = read('common/views/learning-pet.html');
const css = read('assets/css/learning-pet.css') + read('assets/css/learning-pet-evolution.css');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
let browser;
before(async () => { browser = await playwright.chromium.launch({headless: true, executablePath}); });
after(async () => { if (browser) await browser.close(); });

async function open(options = {}) {
    const context = await browser.newContext({viewport: {width: 1366, height: 900}, ...options});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://pikachu-pet.test/**', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith('/assets/images/learning-pets/')) {
            const file = path.join(app, pathname.slice(1));
            if (fs.existsSync(file)) return route.fulfill({path: file});
            return route.abort();
        }
        return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><main id="qa">' + template + '</main></body></html>'});
    });
    await page.goto('http://pikachu-pet.test/');
    await page.addScriptTag({path: path.join(app, 'assets/scripts/external/angular.min.js')});
    await page.evaluate(() => {
        angular.module('PetQa', []).run(['$rootScope', scope => {
            scope.pet = {
                visible: true, panelOpen: false, minimized: false, dragging: false,
                petForm: 'pikachu-hatched', selectedPetKey: 'CUTE_PIKACHU',
                petImage: 'assets/images/learning-pets/pikachu/pet-level-20.png',
                pikachuLightningImage: 'assets/images/learning-pets/pikachu/pet-lightning.png',
                availablePets: [], tasks: [], drafts: [], activeSection: 'tasks',
                notificationCount: 2, pendingTaskCount: 0, summaryTitle: 'Bài cần làm',
                togglePanel() { this.panelOpen = !this.panelOpen; this.clicks = (this.clicks || 0) + 1; },
                toggleMinimized() { this.minimized = !this.minimized; this.panelOpen = false; }
            };
            window.petScope = scope;
        }]);
        angular.bootstrap(document.getElementById('qa'), ['PetQa']);
    });
    await page.locator('.learning-pet-pikachu__body').waitFor();
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    return {page, context, errors};
}

async function update(page, values) {
    await page.evaluate(values => window.petScope.$apply(() => Object.assign(window.petScope.pet, values)), values);
}

test('hatched Pikachu stays still and flashes lightning occasionally while panel controls and other pet forms keep working', async () => {
    const {page, context, errors} = await open();
    try {
        assert.doesNotMatch(template, /learning-pet-pikachu__(?:arm|shoulder)/, 'the old waving layers are removed');
        const effects = await page.locator('.learning-pet-pikachu').evaluate(pet => {
            const body = pet.querySelector('.learning-pet-pikachu__body');
            const electricity = pet.querySelector('.learning-pet-pikachu__electricity');
            window.originalPikachuBody = body;
            const animations = pet.getAnimations({subtree: true});
            const lightning = animations.find(animation => animation.animationName === 'learning-pet-pikachu-lightning');
            const opacities = [], bodyTransforms = [], wrapperTransforms = [];
            if (lightning) {
                const duration = lightning.effect.getTiming().duration;
                // Inspect a complete cycle deterministically instead of waiting for a flash.
                const offsets = Array.from({length: 101}, (_, index) => index / 100);
                offsets.push(...lightning.effect.getKeyframes().map(frame => frame.computedOffset));
                for (const animation of animations) animation.pause();
                for (const fraction of offsets) {
                    for (const animation of animations) animation.currentTime = duration * fraction;
                    opacities.push(Number(getComputedStyle(lightning.effect.target).opacity));
                    bodyTransforms.push(getComputedStyle(body).transform);
                    wrapperTransforms.push(getComputedStyle(pet).transform);
                }
            }
            return {
                opacities, bodyTransforms, wrapperTransforms,
                duration: lightning && lightning.effect.getTiming().duration,
                animationNames: animations.map(animation => animation.animationName),
                bodyCount: pet.querySelectorAll('.learning-pet-pikachu__body').length,
                boltCount: electricity.querySelectorAll('.learning-pet-pikachu__bolt').length,
                ringCount: electricity.querySelectorAll('.learning-pet-pikachu__ring').length,
                usesOriginalBoltArtwork: [...electricity.querySelectorAll('.learning-pet-pikachu__bolt')].every(bolt => {
                    const image = bolt.matches('img') ? bolt : bolt.querySelector('img');
                    return image && new URL(image.src).pathname.endsWith('/pikachu/pet-lightning.png') &&
                        image.naturalWidth === body.naturalWidth && image.naturalHeight === body.naturalHeight;
                }),
                customBoltPaths: electricity.querySelectorAll('path').length,
                bodyClip: getComputedStyle(body).clipPath,
                decorative: pet.getAttribute('aria-hidden'),
                bodyPassthrough: getComputedStyle(body).pointerEvents,
                effectPassthrough: getComputedStyle(electricity).pointerEvents
            };
        });
        assert.equal(effects.bodyCount, 1, 'one complete body replaces the old arm cutout');
        assert.equal(effects.ringCount, 0, 'the old electric ring is removed');
        assert.ok(effects.boltCount > 0, 'lightning bolts are present');
        assert.equal(effects.usesOriginalBoltArtwork, true, 'flashes reuse the exact lightning artwork from the reference');
        assert.equal(effects.customBoltPaths, 0, 'flashes do not introduce custom lightning shapes');
        assert.ok(effects.duration >= 5000, 'flashes are spaced over a slow cycle');
        assert.ok(effects.opacities.some(opacity => opacity >= .7), 'lightning visibly flashes');
        assert.ok(effects.opacities.filter(opacity => opacity <= .05).length > effects.opacities.length * .6,
            'lightning rests for most of its cycle');
        assert.ok(effects.bodyTransforms.every(transform => transform === 'none'), 'the body never waves or bounces');
        assert.ok(effects.wrapperTransforms.every(transform => transform === 'none'), 'the wrapper stays still too');
        assert.equal(effects.animationNames.some(name => /wave|breathe/.test(name)), false, 'Pikachu has no waving or breathing animation');
        assert.equal(effects.bodyClip, 'none', 'the complete illustration is not clipped into old arm layers');
        assert.equal(effects.decorative, 'true');
        assert.equal(effects.bodyPassthrough, 'none');
        assert.equal(effects.effectPassthrough, 'none');
        await update(page, {notificationCount: 8});
        await page.locator('.learning-pet-character').click();
        assert.equal(await page.evaluate(() => window.petScope.pet.clicks), 1);
        assert.equal(await page.evaluate(() => window.petScope.pet.panelOpen), true);
        assert.equal(await page.evaluate(() => window.originalPikachuBody === document.querySelector('.learning-pet-pikachu__body')), true,
            'badge and panel updates preserve the illustration');
        await page.locator('.learning-pet-character').click();
        await page.locator('.learning-pet-minimize').click();
        assert.equal(await page.locator('.learning-pet-character').isVisible(), false);
        await page.locator('.learning-pet-minimize').click();
        assert.equal(await page.locator('.learning-pet-character').isVisible(), true);
        for (const [petForm, selectedPetKey, petImage] of [
            ['pikachu-egg', 'CUTE_PIKACHU', 'assets/images/learning-pets/pikachu/egg-level-18.png'],
            ['pikachu-egg', 'CUTE_PIKACHU', 'assets/images/learning-pets/pikachu/egg-level-19.png'],
            ['cute-tom-cat-hatched', 'CUTE_TOM_CAT', 'assets/images/learning-pets/cute-tom-cat/pet-level-11.png']
        ]) {
            await update(page, {petForm, selectedPetKey, petImage});
            assert.equal(await page.locator('.learning-pet-pikachu').count(), 0);
            assert.equal(await page.locator('.learning-pet-egg').count(), 1);
        }
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('Pikachu fits mobile screens, pauses during a drag, and respects reduced motion', async () => {
    const {page, context, errors} = await open({viewport: {width: 390, height: 844}, hasTouch: true});
    try {
        const bounds = await page.locator('.learning-pet-pikachu__electricity').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'lightning stays inside the mobile viewport');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await update(page, {dragging: true});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), false, 'dragging pauses the decorative motion');
        await update(page, {dragging: false});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), true, 'motion resumes after a drag');
        await page.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), false, 'reduced motion stops lightning flashes');
        assert.equal(await page.locator('.learning-pet-pikachu__bolt').evaluateAll(bolts => bolts.some(bolt => {
            for (let node = bolt; node && node !== document.body; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .05) return false;
            }
            return true;
        })), false, 'reduced motion hides the flashing bolts');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});
