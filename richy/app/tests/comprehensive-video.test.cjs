const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const definitions = {};
const angular = {module() { return {
    factory(name, definition) { definitions[name] = definition; return this; },
    directive(name, definition) { definitions[name] = definition; return this; }
}; }, noop() {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../question/business/ComprehensiveVideo.js'), 'utf8'), {angular});
const video = definitions.ComprehensiveVideo.at(-1)({URL}, {});
const builderTemplate = fs.readFileSync(path.join(__dirname, '../question/views/create_ielts_reading_test.html'), 'utf8');
const videoCss = fs.readFileSync(path.join(__dirname, '../assets/css/comprehensive-video.css'), 'utf8');

test('builder keeps the video preview sticky only inside its question section on desktop', () => {
    assert.match(builderTemplate, /reading-builder-video-scope/);
    assert.match(builderTemplate, /<section class="comprehensive-video-sticky-panel" ng-if="vm\.isVideoBuilder\(\)">/);
    assert.match(videoCss, /\.reading-builder-video-scope\s*\{[^}]*display:\s*flex[^}]*align-items:\s*stretch/);
    assert.match(videoCss, /\.reading-builder-video-scope \.comprehensive-video-sticky-panel\s*\{[^}]*position:\s*sticky[^}]*top:\s*16px/);
    assert.match(videoCss, /@media \(max-width:\s*996px\)[\s\S]*?\.comprehensive-video-sticky-panel\s*\{[^}]*position:\s*static/);
});

test('normalizes supported YouTube, TikTok and video file URLs and rejects unsafe or unsupported links', () => {
    for (const link of ['https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90s', 'https://youtu.be/M7lc1UVf-VE?si=123',
        'https://m.youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
        'https://youtube.com/live/M7lc1UVf-VE']) {
        assert.equal(video.parseUrl(link).id, 'M7lc1UVf-VE');
        assert.equal(video.parseUrl(link).provider, 'youtube');
    }
    assert.equal(video.parseUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173?is_from_webapp=1').provider, 'tiktok');
    assert.equal(video.parseUrl('https://www.tiktok.com/player/v1/6718335390845095173').id, '6718335390845095173');
    assert.equal(video.parseUrl('https://cdn.example.test/lesson.MP4?token=abc').provider, 'file');
    for (const link of ['javascript:alert(1)', 'file:///C:/video.mp4', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
        'https://user:password@youtube.com/watch?v=M7lc1UVf-VE', 'https://youtu.be/invalid', 'https://example.test/',
        'https://vt.tiktok.com/short/', 'https://www.tiktok.com/@person/photo/6718335390845095173']) {
        assert.equal(video.parseUrl(link), null, link);
    }
});

test('converts 01:30 to 90 seconds, preserves zero and rejects invalid time formats', () => {
    assert.equal(video.parseTime('01:30'), 90);
    assert.equal(video.parseTime('00:00'), 0);
    assert.equal(video.parseTime('1:02:03'), 3723);
    assert.equal(video.parseTime('99:59:59'), 359999);
    assert.equal(video.formatTime(90), '01:30');
    assert.equal(video.formatTime(3723), '1:02:03');
    for (const value of ['', '90', '-1:00', '01:60', '1:3', '1:2:03', '100:00:00', 'x:30']) {
        assert.equal(video.parseTime(value), null, value);
    }
});

test('reveals individual questions at their own cues and a shared package as one cue', () => {
    const first = {ordinalNumber: 1, videoTimeSeconds: 90};
    const second = {ordinalNumber: 2, videoTimeSeconds: 180};
    const pack = {type: 1, subQuestions: [first, second]};
    const shared = {type: 11, videoTimeSeconds: 90, subQuestions: [{ordinalNumber: 3}, {ordinalNumber: 4}]};
    const timeline = video.timeline([pack, shared]);
    assert.equal(timeline.visible(first), false);
    assert.equal(timeline.visible(shared), false);
    assert.equal(timeline.advance(89.9).length, 0);
    assert.equal(timeline.advance(90).length, 2);
    assert.equal(timeline.visible(first), true);
    assert.equal(timeline.visible(second), false);
    assert.equal(timeline.visible(shared), true);
    assert.equal(timeline.next().seconds, 180);
    assert.equal(timeline.advance(220).length, 0, 'waits for the active answers before triggering another cue');
    timeline.active = [];
    assert.equal(timeline.advance(180).length, 1);
    assert.equal(timeline.visible(second), true);
});

test('seeking forward processes the earliest missed cue; rewinding does not repeatedly pause answered cues', () => {
    const a = {videoTimeSeconds: 0}, b = {videoTimeSeconds: 90}, c = {videoTimeSeconds: 200};
    const timeline = video.timeline([{type: 1, subQuestions: [c, b, a]}]);
    assert.equal(timeline.advance(280)[0].item, a);
    timeline.active = [];
    assert.equal(timeline.advance(280)[0].item, b);
    timeline.active = [];
    assert.equal(timeline.advance(10).length, 0);
    assert.equal(timeline.visible(b), true);
    assert.equal(timeline.advance(90).length, 0);
    assert.equal(timeline.advance(200)[0].item, c);
    timeline.active = [];
    assert.equal(timeline.next(), null);
    assert.equal(timeline.advance(300).length, 0);
});

test('video failure fallback opens every question without changing saved answers', () => {
    const question = {videoTimeSeconds: 90, questionAnswers: [{selected: true, clientAnswer: 'B'}]};
    const timeline = video.timeline([{type: 1, subQuestions: [question]}]);
    timeline.revealAll();
    assert.equal(timeline.visible(question), true);
    assert.equal(timeline.next(), null);
    assert.equal(question.questionAnswers[0].clientAnswer, 'B');
});

test('TikTok player validates message origin and source, forwards time and removes its listener on teardown', () => {
    let onMessage, unmounted = false, scopeWatch, onDestroy;
    const commands = [], progress = [];
    const mount = {firstChild: null, appendChild(child) { this.firstChild = child; }, removeChild() { this.firstChild = null; }};
    const win = {URL, location: {origin: 'https://school.test'}, document: {createElement() {
        return {contentWindow: {postMessage(data, origin) { commands.push({data, origin}); }}};
    }}, addEventListener(name, fn) { onMessage = fn; }, removeEventListener(name, fn) { assert.equal(fn, onMessage); unmounted = true; }};
    const interval = Object.assign(() => {}, {cancel() {}}), timeout = Object.assign(() => 1, {cancel() {}});
    const directive = definitions.comprehensiveVideoPlayer.at(-1)(win, interval, timeout, video);
    const scope = {$watch(name, fn) { scopeWatch = fn; }, $evalAsync(fn) { fn(); }, $on(name, fn) { onDestroy = fn; },
        onVideoProgress(value) { progress.push(value); }, onVideoReady() {}, onVideoState() {}};
    directive.link(scope, [{querySelector() { return mount; }}]);
    scopeWatch('https://www.tiktok.com/@scout2015/video/6718335390845095173');
    const frame = mount.firstChild;
    const data = {'x-tiktok-player': true, type: 'onCurrentTime', value: {currentTime: 90, duration: 300}};
    onMessage({source: frame.contentWindow, origin: 'https://evil.test', data});
    onMessage({source: {}, origin: 'https://www.tiktok.com', data});
    assert.equal(progress.length, 0);
    onMessage({source: frame.contentWindow, origin: 'https://www.tiktok.com', data});
    assert.equal(progress[0].seconds, 90);
    scope.videoApi.pause(); scope.videoApi.seek(90);
    assert.equal(commands[0].data.type, 'pause');
    assert.equal(commands[1].data.value, 90);
    assert.equal(commands[0].origin, 'https://www.tiktok.com');
    onDestroy(); assert.equal(unmounted, true); assert.equal(mount.firstChild, null);
});
