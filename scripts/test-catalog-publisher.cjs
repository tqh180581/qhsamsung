'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zip = require('../service-src/zip.js');
const publisher = require('./publish-personal-catalog.cjs');
const trust = require('../service-src/personal.js');

const APP = { name: 'Kosovo SamsungTV', group: 'Kosovo SamsungTV', category: 'iptv', description: 'Offline fixture', app_id: 'KsvTv2019A.KosovoTV', package_id: 'KsvTv2019A', min_tizen_version: '5.0' };
const OTHER = { name: 'Another app', group: 'Another app', category: 'tools', app_id: 'OtherTv2019.App', package_id: 'OtherTv2019', min_tizen_version: '5.0' };
const NOW = Date.now();
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

function registry(apps = [APP]) { return { schemaVersion: 1, repository: publisher.REPOSITORY, apps }; }
function widget(app, version, minimum = '5.0', extra = '') {
    const config = '<?xml version="1.0"?><widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" version="' + version + '"><tizen:application required_version="' + minimum + '" package="' + app.package_id + '" id="' + app.app_id + '"/></widget>';
    return zip.write([{ name: 'config.xml', data: Buffer.from(config) }, { name: 'app.js', data: Buffer.from('throw new Error("THIS DOWNLOADED CODE MUST NEVER RUN");' + extra) }]);
}
function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qhsamsung-publisher-test-'));
    t.after(() => {
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('qhsamsung-publisher-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const files = new Map();
    let serial = 0;
    function release(version, app = APP, options = {}) {
        const tag = options.tag || 'app-v' + version + '-' + (++serial);
        const name = options.name || 'app-' + app.package_id + '-' + version + '.wgt';
        const bytes = widget(app, version, options.minimum || '5.0', options.extra || '');
        const file = path.join(directory, serial + '-' + files.size + '.wgt');
        fs.writeFileSync(file, bytes);
        const asset = { name, size: bytes.length, digest: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'), browser_download_url: 'https://github.com/' + publisher.REPOSITORY + '/releases/download/' + encodeURIComponent(tag) + '/' + encodeURIComponent(name), state: 'uploaded' };
        files.set(asset.browser_download_url, file);
        return { tag_name: tag, draft: false, prerelease: false, published_at: options.date || '2026-01-01T00:00:00Z', assets: [asset], ...options.release };
    }
    return { directory, release, files, download: async asset => files.get(asset.browser_download_url) };
}

test('newest manifest version wins over release dates; drafts and prereleases are excluded', async t => {
    const f = fixture(t);
    const older = f.release('0.9.0', APP, { date: '2026-10-31T00:00:00Z' });
    const newer = f.release('0.10.0', APP, { date: '2026-01-01T00:00:00Z' });
    const draft = f.release('9.0.0', APP, { release: { draft: true } });
    const prerelease = f.release('8.0.0', APP, { release: { prerelease: true } });
    const catalog = await publisher.buildCatalog(registry(), [older, draft, prerelease, newer], f.download, { now: NOW });
    assert.equal(catalog.providers[0].catalog.apps[0].version, '0.10.0');
    assert.equal(catalog.providers[0].releases[0].assets[0].browser_download_url, newer.assets[0].browser_download_url);
    assert.equal(catalog.generatedAt, new Date(NOW).toISOString());
});

test('all latest registered apps occupy the first synthetic release and preserve actual minimum Tizen', async t => {
    const f = fixture(t);
    const catalog = await publisher.buildCatalog(registry([APP, OTHER]), [f.release('0.8.3'), f.release('1.2.3', OTHER, { minimum: '6.0' })], f.download);
    assert.equal(catalog.providers[0].catalog.apps.length, 2);
    assert.equal(catalog.providers[0].releases.length, 1);
    assert.equal(catalog.providers[0].releases[0].assets.length, 2);
    assert.equal(catalog.providers[0].catalog.apps[1].min_tizen_version, '6.0');
    assert.equal(Object.keys(trust.validate(catalog.providers[0], false)).length, 2);
});

test('unregistered and Store manifests are excluded without executing downloaded app code', async t => {
    const f = fixture(t);
    const store = { app_id: 'A2STVStore.Store', package_id: 'A2STVStore' };
    const catalog = await publisher.buildCatalog(registry(), [f.release('0.8.3'), f.release('1.0.0', OTHER), f.release('0.4.3', store)], f.download);
    assert.deepEqual(catalog.providers[0].catalog.apps.map(app => app.app_id), [APP.app_id]);
    await assert.rejects(publisher.buildCatalog(registry(), [f.release('1.0.0', OTHER)], f.download), /No verified public WGT/);
    assert.throws(() => publisher.validateRegistry(registry([store])), /name and exact|Store/);
});

test('mismatched app/package identities, bad sizes and bad digests fail closed', async t => {
    const f = fixture(t);
    const mismatch = f.release('0.8.3', { ...APP, app_id: APP.package_id + '.Unexpected' });
    await assert.rejects(publisher.buildCatalog(registry(), [mismatch], f.download), /identity mismatch/);
    const badSize = f.release('0.8.3'); badSize.assets[0].size++;
    await assert.rejects(publisher.buildCatalog(registry(), [badSize], f.download), /size does not match/);
    const badHash = f.release('0.8.3'); badHash.assets[0].digest = 'sha256:' + '0'.repeat(64);
    await assert.rejects(publisher.buildCatalog(registry(), [badHash], f.download), /hash does not match/);
});

test('different bytes for the same app/version are ambiguous rather than silently selected', async t => {
    const f = fixture(t);
    await assert.rejects(publisher.buildCatalog(registry(), [f.release('0.8.3'), f.release('0.8.3', APP, { extra: 'different build' })], f.download), /Ambiguous/);
});

test('manifest parser rejects malformed versions, entities, duplicate identities and corrupted ZIPs', async t => {
    const f = fixture(t), good = f.release('0.8.3');
    const goodFile = f.files.get(good.assets[0].browser_download_url);
    assert.equal((await publisher.readManifest(goodFile)).app_id, APP.app_id);
    const wrongVersion = f.release('0.8');
    await assert.rejects(publisher.readManifest(f.files.get(wrongVersion.assets[0].browser_download_url)), /x.y.z/);
    assert.throws(() => publisher.parseManifest('<!DOCTYPE widget><widget version="0.8.3"><tizen:application id="X.App" package="X" required_version="5.0"/></widget>'), /entities/);
    assert.throws(() => publisher.parseManifest('<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" version="0.8.3"><tizen:application id="X.App" id="Y.App" package="X" required_version="5.0"/></widget>'), /Duplicate/);
    assert.throws(() => publisher.parseManifest('<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" version="0.8.3"><!-- <tizen:application id="X.App" package="X" required_version="5.0"/> --></widget>'), /exactly one/);
    const corrupt = Buffer.from(fs.readFileSync(goodFile));
    const central = corrupt.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    corrupt.writeUInt32LE(0, central + 16);
    const file = path.join(f.directory, 'corrupt.wgt'); fs.writeFileSync(file, corrupt);
    await assert.rejects(publisher.readManifest(file), /CRC mismatch/);
    corrupt.writeUInt32LE(0xffffffff, corrupt.length - 10);
    fs.writeFileSync(file, corrupt);
    await assert.rejects(publisher.readManifest(file), /ZIP directory/);
});

test('package URLs must match the exact repository, release and filename', () => {
    const asset = { name: 'app.wgt', size: 22, browser_download_url: 'https://github.com/another/repo/releases/download/v1/app.wgt' };
    assert.throws(() => publisher.validateAsset(asset, { tag_name: 'v1' }), /URL/);
    assert.throws(() => publisher.validateAsset({ ...asset, name: '../app.wgt' }, { tag_name: 'v1' }), /name/);
});

test('signing keys must match the TV trust key, and signed catalogs satisfy the TV verifier', async t => {
    const f = fixture(t);
    const catalog = await publisher.buildCatalog(registry(), [f.release('0.8.3')], f.download, { now: NOW });
    const signed = publisher.signCatalog(catalog, keys.privateKey, keys.publicKey).signed;
    assert.equal(trust.verify(signed, keys.publicKey, NOW).provider.catalog.apps[0].version, '0.8.3');
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    assert.throws(() => publisher.validateSigningKey(keys.privateKey, other.publicKey.export({ type: 'spki', format: 'pem' })), /does not match/);
    assert.throws(() => publisher.validateSigningKey('', keys.publicKey), /not configured/);
    const changed = Buffer.from(signed); changed[changed.length - 3] ^= 1;
    assert.throws(() => publisher.readPrevious(changed, keys.publicKey), /signature/);
});

test('unchanged catalogs reuse the signature for twelve hours then renew freshness', async t => {
    const f = fixture(t);
    const original = await publisher.buildCatalog(registry(), [f.release('0.8.3')], f.download, { now: NOW });
    const first = publisher.signCatalog(original, keys.privateKey, keys.publicKey);
    const recent = { ...original, generatedAt: new Date(NOW + 1800000).toISOString() };
    const reused = publisher.signCatalog(recent, keys.privateKey, keys.publicKey, first.signed);
    assert.equal(reused.reused, true); assert.deepEqual(reused.signed, first.signed);
    const old = { ...original, generatedAt: new Date(NOW + publisher.REFRESH_AFTER_MS).toISOString() };
    const renewed = publisher.signCatalog(old, keys.privateKey, keys.publicKey, first.signed);
    assert.equal(renewed.reused, false); assert.notDeepEqual(renewed.signed, first.signed);
});

test('publisher refuses rollback below the bundled baseline, previous versions, and previous app removal', async t => {
    const f = fixture(t);
    const old = await publisher.buildCatalog(registry(), [f.release('0.8.1')], f.download, { now: NOW });
    assert.throws(() => publisher.signCatalog(old, keys.privateKey, keys.publicKey), /rollback/);
    const current = await publisher.buildCatalog(registry([APP, OTHER]), [f.release('0.8.4'), f.release('1.0.0', OTHER)], f.download, { now: NOW });
    const signed = publisher.signCatalog(current, keys.privateKey, keys.publicKey).signed;
    const downgrade = await publisher.buildCatalog(registry([APP, OTHER]), [f.release('0.8.3'), f.release('1.0.0', OTHER)], f.download, { now: NOW + 1000 });
    assert.throws(() => publisher.signCatalog(downgrade, keys.privateKey, keys.publicKey, signed), /rollback/);
    const removed = await publisher.buildCatalog(registry(), [f.release('0.8.4')], f.download, { now: NOW + 1000 });
    assert.throws(() => publisher.signCatalog(removed, keys.privateKey, keys.publicKey, signed), /removal/);
});

test('release discovery paginates and confines API tokens to GitHub API requests', async () => {
    const calls = [];
    const releases = await publisher.fetchReleases(async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => calls.length === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i })) : [{ id: 100 }] };
    }, 'fixture-token');
    assert.equal(releases.length, 101);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.url.startsWith('https://api.github.com/repos/' + publisher.REPOSITORY + '/releases?')));
    assert.ok(calls.every(call => call.options.headers.Authorization === 'Bearer fixture-token' && call.options.redirect === 'error'));
});

test('public asset downloader sends no API token and enforces exact byte counts', async t => {
    const f = fixture(t), release = f.release('0.8.3'), asset = release.assets[0];
    const bytes = fs.readFileSync(f.files.get(asset.browser_download_url));
    let request;
    const file = await publisher.downloadToFile(asset, f.directory, async (url, options) => {
        request = { url, options };
        return new Response(bytes);
    });
    assert.equal(request.options.headers.Authorization, undefined);
    assert.deepEqual(fs.readFileSync(file), bytes);
    const another = { ...asset, browser_download_url: asset.browser_download_url + '?test=too-big', size: bytes.length - 1 };
    await assert.rejects(publisher.downloadToFile(another, f.directory, async () => new Response(bytes)), /exceeds/);
});
