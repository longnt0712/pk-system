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

test('hatched Pikachu waves and emits electricity while panel controls and other pet forms keep working', async () => {
    const {page, context, errors} = await open();
    try {
        const effects = await page.locator('.learning-pet-pikachu').evaluate(pet => {
            const arm = pet.querySelector('.learning-pet-pikachu__arm');
            window.originalPikachuArm = arm;
            const wave = arm.getAnimations().find(animation => animation.animationName === 'learning-pet-pikachu-wave');
            const ring = pet.querySelector('.learning-pet-pikachu__electricity').getAnimations({subtree: true})
                .find(animation => animation.animationName === 'learning-pet-pikachu-electric-ring');
            function samples(animation, property) {
                if (!animation) return [];
                animation.pause();
                const duration = animation.effect.getTiming().duration;
                return [0, .12, .24, .4, .65].map(fraction => {
                    animation.currentTime = duration * fraction;
                    return getComputedStyle(animation.effect.target)[property];
                });
            }
            return {
                waves: samples(wave, 'transform'), rings: samples(ring, 'opacity'),
                decorative: pet.getAttribute('aria-hidden'),
                passthrough: getComputedStyle(arm).pointerEvents
            };
        });
        assert.ok(new Set(effects.waves).size > 1, 'the arm actually rotates over the wave cycle');
        assert.ok(new Set(effects.rings).size > 1, 'electricity visibly pulses over its cycle');
        assert.equal(effects.decorative, 'true');
        assert.equal(effects.passthrough, 'none');
        await update(page, {notificationCount: 8});
        await page.locator('.learning-pet-character').click();
        assert.equal(await page.evaluate(() => window.petScope.pet.clicks), 1);
        assert.equal(await page.evaluate(() => window.petScope.pet.panelOpen), true);
        assert.equal(await page.evaluate(() => window.originalPikachuArm === document.querySelector('.learning-pet-pikachu__arm')), true,
            'badge and panel updates preserve the waving element');
        await page.locator('.learning-pet-character').click();
        await page.locator('.learning-pet-minimize').click();
        assert.equal(await page.locator('.learning-pet-character').isVisible(), false);
        await page.locator('.learning-pet-minimize').click();
        assert.equal(await page.locator('.learning-pet-character').isVisible(), true);
        for (const [petForm, selectedPetKey, petImage] of [
            ['pikachu-egg', 'CUTE_PIKACHU', 'assets/images/learning-pets/pikachu/egg-level-18.png'],
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
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'electric ring stays inside the mobile viewport');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await update(page, {dragging: true});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), false, 'dragging pauses the decorative motion');
        await update(page, {dragging: false});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), true, 'motion resumes after a drag');
        await page.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await page.locator('.learning-pet-pikachu').evaluate(pet => pet.getAnimations({subtree: true})
            .some(animation => animation.playState === 'running')), false, 'reduced motion stops the arm, ring and sparks');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});
