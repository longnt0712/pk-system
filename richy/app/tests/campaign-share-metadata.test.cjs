const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const root = process.env.CAMPAIGN_IIS_TEST_URL;
function fetch(host, path, gzip = false) {
    const url = new URL(path, root);
    return new Promise((resolve, reject) => {
        const request = http.get(url, {headers: {Host: host, 'User-Agent': 'facebookexternalhit/1.1', ...(gzip ? {'Accept-Encoding': 'gzip'} : {})}}, response => {
            const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({status: response.statusCode, body: (response.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(buffer) : buffer).toString('utf8')});
            });
        }); request.on('error', reject); request.setTimeout(10000, () => request.destroy(new Error('IIS test request timed out')));
    });
}
function meta(html, property) {const matches = [...html.matchAll(new RegExp('<meta property="'+property+'"\\s+content="([^"]*)"', 'g'))]; assert.equal(matches.length,1,property+' must occur exactly once');return matches[0][1];}
test('IIS returns TNTT share metadata to non-JavaScript crawlers only on the allowed domains', {skip: !root}, async () => {
    const path = '/hoa-thieng/c/' + 'c'.repeat(32);
    for (const host of ['tnttphungkhoang.com', 'ieltsroom.com', 'www.tnttphungkhoang.com', 'other.example', 'tnttphungkhoang.com', 'tnttphungkhoang.com.evil.example']) {
        const response = await fetch(host, path); assert.equal(response.status, 200);
        const tntt = /^(www\.)?tnttphungkhoang\.com$/.test(host);
        assert.equal(meta(response.body, 'og:title'), tntt ? 'TNTT PHÙNG KHOANG' : 'IELTS ROOM');
        assert.equal(meta(response.body, 'og:url'), tntt ? 'https://tnttphungkhoang.com'+path : 'https://www.ieltsroom.com/');
        assert.equal(meta(response.body, 'og:image'), tntt ? 'https://tnttphungkhoang.com/assets/images/troop-1.jpg' : 'https://ieltsroom.com/assets/images/troop.jpg');
    }
});
test('IIS keeps the shared path, safely escapes query values and supports compressed crawler requests', {skip: !root}, async () => {
    const response = await fetch('tnttphungkhoang.com', '/campaigns/c/'+ 'd'.repeat(32)+'?a=1&b=2', true);
    assert.equal(response.status,200); assert.equal(meta(response.body,'og:url'),'https://tnttphungkhoang.com/campaigns/c/'+ 'd'.repeat(32)+'?a=1&amp;b=2');
    assert.equal(meta(response.body,'og:title'),'TNTT PHÙNG KHOANG');
    const asset = await fetch('tnttphungkhoang.com','/campaign/campaign.css');assert.equal(asset.status,200);assert.ok(asset.body.startsWith('.campaign-layout'));assert.ok(!asset.body.includes('<meta'));
});
