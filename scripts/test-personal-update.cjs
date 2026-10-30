/* Offline release checks. Real pinned metadata and service guards run with
 * explicit HTTP/filesystem/signing boundaries: no TV, cert reads or signing. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const catalogTrust = require('../service-src/catalog.js');
const zip = require('../service-src/zip.js');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'catalog/personal-apps.json'), 'utf8'));
const tag = 'kosovo-tizen5plus-v0.8.2';
const file = 'Kosovo-SamsungTV-Tizen5plus-v0.8.2.wgt';
const download = 'https://github.com/tqh180581/qhsamsung/releases/download/' + tag + '/' + file;
const digest = '45d521d7181f09d81cd23d1eed01f8db12f0edc76092c6b3bb3825f683922d88';
const previousUrl = 'https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.0/Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt';
const previousDigest = '536866a4b4b0d72d362be991c6339f88cb67526c43786cd05e73408e4aeaa592';
const oldUrl = 'https://github.com/tqh180581/qhsamsung/releases/download/movies-v0.7.6/Kosovo-SamsungTV-v0.7.6.wgt';
const oldDigest = '13adae22402f6e9dc70f887300046d275ccd784c39c22e1b23188d300b9a94ca';
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function personal(pinned = metadata) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'service-src/personal.js'), 'utf8'), {
        module, exports: module.exports, require: name => {
            if (name === './personal-catalog.js') return pinned;
            if (name === './catalog.js') return catalogTrust;
            throw Error('Unexpected offline personal dependency: ' + name);
        }
    });
    return module.exports;
}
function service() {
    const dependencies = {
        http: { createServer: () => ({ listen: () => {} }) },
        https: {}, os: { networkInterfaces: () => ({}), tmpdir: () => '/fixture' },
        url: require('node:url'), path: require('node:path'), crypto,
        fs: { writeFileSync: () => { throw Error('Offline harness denies filesystem writes'); }, unlinkSync: () => {} },
        './sdb.js': {}, './signer.js': { ready: true }, './zip.js': {},
        './catalog.js': catalogTrust, './catalog-key.js': 'unused public-key boundary', './personal.js': personal()
    };
    const context = vm.createContext({ module: { exports: {} }, Buffer, process: { env: {}, version: 'offline', arch: 'fixture' }, console: { log: () => {} },
        __dirname: '/fixture/A2STVStore/res/wgt/service', require: name => {
            if (!Object.hasOwn(dependencies, name)) throw Error('Unexpected offline service dependency: ' + name);
            return dependencies[name];
        } });
    vm.runInContext(fs.readFileSync(path.join(root, 'service-src/index.js'), 'utf8'), context);
    context.DATA_DIR = '/fixture';
    return context;
}
function installProbe(url, hash, catalog) {
    const context = service(), calls = { downloads: 0, signingBoundary: 0 };
    context.withCatalog = cb => cb(null, catalog || personal().merge(null));
    context.getToFile = (url, target, cb) => { calls.downloads++; const asset = metadata.releases.flatMap(release => release.assets).find(item => item.browser_download_url === url); cb(null, { size: asset ? asset.size : 0, sha256: hash }); };
    context.signAndInstall = (entry, name, input, output, cb) => { calls.signingBoundary++; cb(null, { fixtureOnly: true }); };
    return new Promise(resolve => context.install({ url, file, appId: 'KsvTv2019A.KosovoTV', packageId: 'KsvTv2019A' }, (error, result) => resolve({ error, result, calls })));
}
test('release metadata selects exact 0.8.2 unsigned bytes while preserving the complete 0.8.0 and 0.7.6 pins', () => {
    assert.equal(metadata.latestTag, tag);
    const app = metadata.catalog.apps[0], asset = metadata.releases[0].assets[0];
    assert.equal(app.version, '0.8.2'); assert.equal(app.file, file);
    assert.equal(app.app_id, 'KsvTv2019A.KosovoTV'); assert.equal(app.package_id, 'KsvTv2019A');
    assert.equal(app.min_tizen_version, '5.0'); assert.equal(app.private_download, false);
    assert.equal(metadata.releases[0].tag_name, tag);
    assert.deepEqual(asset, { name: file, browser_download_url: download, size: 12330119, digest: 'sha256:' + digest });
    assert.deepEqual(metadata.releases.map(release => release.tag_name), [tag, 'kosovo-tizen5plus-v0.8.0', 'movies-v0.7.6']);
    const previous = metadata.releases.find(release => release.tag_name === 'kosovo-tizen5plus-v0.8.0');
    assert.deepEqual(previous.assets[0], { name: 'Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt', browser_download_url: previousUrl, size: 12326565, digest: 'sha256:' + previousDigest });
    const older = metadata.releases.find(release => release.tag_name === 'movies-v0.7.6');
    assert.deepEqual(older.assets[0], { name: 'Kosovo-SamsungTV-v0.7.6.wgt', browser_download_url: oldUrl, size: 12331412, digest: 'sha256:' + oldDigest });
    const widget = process.env.KOSOVO_V082_WGT || path.resolve(root, '../kosovo-tizen/dist/kosovo-tizen5plus-unsigned.wgt');
    const bytes = fs.readFileSync(widget); assert.equal(bytes.length, asset.size);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest);
    const manifest = zip.readEntries(bytes).find(entry => entry.name === 'config.xml').data.toString('utf8');
    assert.match(manifest, /<widget\b[^>]*\bversion="0\.8\.2"/);
    assert.match(manifest, /<tizen:application id="KsvTv2019A\.KosovoTV" package="KsvTv2019A" required_version="5\.0"/);
});
test('generated UI metadata, service metadata and bundled service contain the same pinned catalogue', () => {
    const window = {};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'tizen-app/js/personal-catalog.js'), 'utf8'), { window });
    assert.deepEqual(copy(window.QH_PERSONAL_CATALOG), metadata);
    const module = { exports: {} }, serviceSource = fs.readFileSync(path.join(root, 'service-src/personal-catalog.js'), 'utf8');
    vm.runInNewContext(serviceSource, { module, exports: module.exports });
    assert.deepEqual(copy(module.exports), metadata);
    const bundle = fs.readFileSync(path.join(root, 'tizen-app/service/index.js'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(bundle.includes('defs["./personal-catalog.js"] = function (module,exports,require) {\n' + serviceSource.replace(/\r\n/g, '\n') + '\n};'));
    assert.equal(metadata.latestTag, tag);
});
test('Store version increases while application/service identity and Tizen minimum stay unchanged', () => {
    const xml = fs.readFileSync(path.join(root, 'tizen-app/config.xml'), 'utf8');
    assert.match(xml, /<widget\b[^>]*\bversion="0\.4\.3"/);
    assert.match(xml, /<tizen:application id="A2STVStore\.Store" package="A2STVStore" required_version="3\.0"/);
    assert.match(xml, /<tizen:service id="A2STVStore\.sdbservice"/);
    assert.match(fs.readFileSync(path.join(root, 'tizen-app/js/app.js'), 'utf8'), /var VERSION = '0\.4\.3-qh9'/);
});
test('bundled extension retains all three pins and verified upstream entries without mutating either input', () => {
    const upstream = { schemaVersion: 1, generatedAt: '2026-10-30T00:00:00Z', providers: [{ id: 'fixture-upstream', releases: [{ assets: [{ browser_download_url: 'https://fixture.invalid/upstream.wgt', digest: 'sha256:' + 'a'.repeat(64) }] }] }] };
    const verified = { catalog: upstream, index: catalogTrust.index(upstream) }, before = JSON.stringify(verified), pinnedBefore = JSON.stringify(metadata);
    const merged = personal().merge(verified);
    assert.equal(merged.index[download], digest); assert.equal(merged.index[previousUrl], previousDigest); assert.equal(merged.index[oldUrl], oldDigest);
    assert.equal(merged.index['https://fixture.invalid/upstream.wgt'], 'a'.repeat(64));
    assert.equal(JSON.stringify(verified), before); assert.equal(JSON.stringify(metadata), pinnedBefore);
});
test('personal pins reject wrong origins, malformed hashes and conflicts with verified upstream', () => {
    for (const url of ['http://github.com/tqh180581/qhsamsung/releases/download/x/a.wgt', 'https://github.com/other/repo/releases/download/x/a.wgt', 'https://fixture.invalid/a.wgt']) {
        const bad = copy(metadata); bad.releases[0].assets[0].browser_download_url = url;
        assert.throws(() => personal(bad).merge(null), /Invalid bundled personal package/);
    }
    for (const value of ['', 'sha256:1234', 'md5:' + digest]) {
        const bad = copy(metadata); bad.releases[0].assets[0].digest = value;
        assert.throws(() => personal(bad).merge(null), /Invalid bundled personal package/);
    }
    assert.throws(() => personal().merge({ catalog: { providers: [] }, index: { [download]: 'b'.repeat(64) } }), /conflicts with verified catalog/);
    assert.throws(() => catalogTrust.verify(Buffer.from('{"providers":[]}'), 'unused'), /not signed/);
});
test('real install guard refuses URLs outside the trusted catalogue before download or signing', async () => {
    const probe = await installProbe('http://127.0.0.1/custom.wgt', digest);
    assert.equal(probe.error.code, 'NOT_IN_CATALOG'); assert.deepEqual(probe.calls, { downloads: 0, signingBoundary: 0 });
});
test('real install guard refuses mismatched or missing hashes before the signing boundary', async () => {
    const mismatch = await installProbe(download, '0'.repeat(64));
    assert.equal(mismatch.error.code, 'HASH_MISMATCH'); assert.deepEqual(mismatch.calls, { downloads: 1, signingBoundary: 0 });
    const missing = await installProbe(download, digest, { index: { [download]: null } });
    assert.equal(missing.error.code, 'NO_HASH'); assert.deepEqual(missing.calls, { downloads: 0, signingBoundary: 0 });
});
test('matching latest and both retained hashes reach the explicit no-signing boundary', async () => {
    for (const [url, hash] of [[download, digest], [previousUrl, previousDigest], [oldUrl, oldDigest]]) {
        const probe = await installProbe(url, hash);
        assert.equal(probe.error, null); assert.equal(probe.result.fixtureOnly, true);
        assert.deepEqual(probe.calls, { downloads: 1, signingBoundary: 1 });
    }
});
