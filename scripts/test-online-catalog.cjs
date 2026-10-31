'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const personal = require('../service-src/personal.js');
const source = require('../service-src/personal-source.js');
const trust = require('../service-src/catalog.js');
const pinned = require('../catalog/personal-apps.json');
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = key.publicKey.export({ type: 'spki', format: 'pem' });
const now = Date.now();
const clone = x => JSON.parse(JSON.stringify(x));
function catalog(v = '0.8.3', at = now) {
    const provider = clone(pinned), app = provider.catalog.apps[0];
    app.version = v; app.file = 'Kosovo-' + v + '.wgt';
    provider.latestTag = 'kosovo-v' + v;
    provider.releases = [{ tag_name: 'personal-latest', assets: [{ name: app.file, size: 1234,
        browser_download_url: 'https://github.com/tqh180581/qhsamsung/releases/download/kosovo-v' + v + '/' + app.file,
        digest: 'sha256:' + 'a'.repeat(64), app_id: app.app_id, package_id: app.package_id, package_version: v }] }];
    return { schemaVersion: 1, generatedAt: new Date(at).toISOString(), providers: [provider] };
}
function signed(cat, signingKey = key.privateKey) {
    const payload = Buffer.from(JSON.stringify(cat));
    return Buffer.concat([Buffer.from(crypto.sign('RSA-SHA256', payload, signingKey).toString('base64') + '\n'), payload]);
}
function load(fetch, saved, at = now) {
    const writes = [], logs = [];
    const fn = source.create({ key: publicKey, fetch, read: () => saved, write: bytes => writes.push(bytes), now: () => at, log: s => logs.push(s) });
    return new Promise(resolve => fn((err, verified, status) => resolve({ err, verified, status, writes, logs })));
}
test('a signed newer release reaches UI and install allowlist without rebuilding Store', () => {
    const verified = personal.verify(signed(catalog()), publicKey, now);
    const merged = personal.merge(null, verified, { source: 'online' });
    const p = merged.catalog.providers[0], a = p.releases[0].assets[0];
    assert.equal(merged.index[a.browser_download_url], 'a'.repeat(64));
    assert.equal(merged.personalEntries[a.browser_download_url].appId, 'KsvTv2019A.KosovoTV');
    const ui = fs.readFileSync(path.join(__dirname, '../tizen-app/js/app.js'), 'utf8');
    const functions = ui.slice(ui.indexOf('    function variant('), ui.indexOf('    function visible('));
    const context = vm.createContext({ window: { QH_PERSONAL_CATALOG: pinned }, CATEGORY_NAMES: { iptv: 'IPTV' }, CATEGORY_ORDER: ['iptv'], HEAD_ONLY: /nevermatch/, NO_HASH: 'no hash', PROVIDERS: {} });
    vm.runInContext(functions, context);
    const rendered = context.build(merged.catalog);
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0].variants[0].version, '0.8.3');
    assert.equal(rendered[0].variants[0].url, a.browser_download_url);
    assert.equal(pinned.catalog.apps[0].version, '0.8.2', 'baseline stays unchanged');
});
test('signature, trust key, freshness, future dates and rollback are enforced', () => {
    const bytes = signed(catalog());
    assert.throws(() => personal.verify(Buffer.from(bytes.toString().replace('0.8.3', '9.9.9')), publicKey, now), /signature/);
    const wrong = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    assert.throws(() => personal.verify(signed(catalog(), wrong.privateKey), publicKey, now), /signature/);
    assert.throws(() => personal.verify(signed(catalog('0.8.3', now - 8 * 86400000)), publicKey, now), /7 days/);
    assert.throws(() => personal.verify(signed(catalog('0.8.3', now + 3600000)), publicKey, now), /clock/);
    const previous = personal.verify(bytes, publicKey, now);
    assert.throws(() => personal.verify(signed(catalog('0.8.3', now - 1000)), publicKey, now, { previous }), /rollback/);
    assert.throws(() => personal.verify(signed(catalog('0.8.2', now + 1000)), publicKey, now, { previous }), /rollback/);
    assert.throws(() => personal.verify(signed(catalog('0.8.1')), publicKey, now), /rollback/);
});
test('signed metadata cannot add foreign URLs, Store updates or a mismatched app identity', () => {
    const mutations = [
        c => { c.providers[0].releases[0].assets[0].browser_download_url = 'https://evil.invalid/app.wgt'; },
        c => { c.providers[0].releases[0].assets[0].digest = 'sha256:bad'; },
        c => { c.providers[0].catalog.apps[0].package_id = 'A2STVStore'; c.providers[0].catalog.apps[0].app_id = 'A2STVStore.Store'; },
        c => { c.providers[0].releases[0].assets[0].app_id = 'Other.App'; },
        c => { c.providers[0].catalog.apps[0].app_id += ';reboot'; },
        c => { c.providers.push(clone(c.providers[0])); }
    ];
    for (const mutate of mutations) { const c = catalog(); mutate(c); assert.throws(() => personal.verify(signed(c), publicKey, now)); }
});
test('online fetch verifies before persisting and reports online source', async () => {
    const bytes = signed(catalog());
    const r = await load((url, cb) => { assert.equal(url, source.URL); cb(null, bytes); });
    assert.equal(r.err, null); assert.equal(r.status.source, 'online');
    assert.equal(r.verified.provider.catalog.apps[0].version, '0.8.3'); assert.deepEqual(r.writes, [bytes]);
});
test('offline or tampered feed keeps a fresh saved signed catalog; invalid bytes are never saved', async () => {
    const saved = signed(catalog());
    for (const fetch of [(u, cb) => cb(Error('offline')), (u, cb) => cb(null, Buffer.from('untrusted'))]) {
        const r = await load(fetch, saved);
        assert.equal(r.status.source, 'cache'); assert.equal(r.verified.provider.catalog.apps[0].version, '0.8.3'); assert.equal(r.writes.length, 0);
    }
});
test('absent or expired saved catalog falls back only to bundled packages', async () => {
    for (const saved of [null, Buffer.from('corrupt'), signed(catalog('0.8.3', now - 8 * 86400000))]) {
        const r = await load((u, cb) => cb(Error('offline')), saved);
        assert.equal(r.status.source, 'bundled'); assert.equal(r.verified, null);
        const merged = personal.merge(null, r.verified, r.status);
        assert.equal(merged.catalog.providers[0].catalog.apps[0].version, '0.8.2');
    }
});
test('persisted high watermark blocks older remote catalog even after cached copy expires', async () => {
    const saved = signed(catalog('0.8.4', now - 8 * 86400000));
    const r = await load((u, cb) => cb(null, signed(catalog('0.8.3', now))), saved);
    assert.equal(r.status.source, 'bundled'); assert.match(r.status.error, /rollback/); assert.equal(r.writes.length, 0);
});
