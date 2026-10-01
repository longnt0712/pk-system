const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
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

// API routing must be preserved when updating social preview metadata.
test('IIS routes login and protected/public service calls to Spring before the SPA fallback', () => {
    const config = fs.readFileSync(path.join(__dirname, '../web.config'), 'utf8');
    const inbound = config.match(/<rules>([\s\S]*?)<\/rules>/)[1];
    const rules = [...inbound.matchAll(/<rule\b([^>]*)>([\s\S]*?)<\/rule>/g)].map(match => ({attributes: match[1], body: match[2], pattern: match[2].match(/<match\b[^>]*url="([^"]*)"/)[1]}));
    for (const request of ['service/oauth/token', 'service/oauth/logout', 'service/api/users/getCurrentUser', 'service/public/campaigns', 'service/public/campaign-flower/access', 'SERVICE/api/users/getCurrentUser']) {
        const rule = rules.find(rule => new RegExp(rule.pattern, 'i').test(request));
        assert.ok(rule, request); assert.match(rule.attributes, /stopProcessing="true"/);
        const captures = request.match(new RegExp(rule.pattern, 'i'));
        const action = rule.body.match(/<action\b([^>]*)>/)[1];
        const url = action.match(/url="([^"]*)"/)[1].replace('{R:1}', captures[1] || '');
        assert.equal(url, 'http://127.0.0.1:8085/service/' + request.substring(request.indexOf('/') + 1), request);
        assert.match(action, /appendQueryString="true"/);
    }
    const fallback = rules.find(rule => rule.body.includes('url="/index.html"'));
    const excluded = fallback.body.match(/input="\{REQUEST_URI\}" pattern="([^"]*)" negate="true"/)[1];
    for (const uri of ['/service/oauth/token', '/api/users', '/oauth/token', '/public/campaigns']) assert.ok(new RegExp(excluded).test(uri), uri);
    for (const uri of ['/login', '/hoa-thieng', '/campaigns']) assert.ok(!new RegExp(excluded).test(uri), uri);
});
