/* Offline release envelope: a Store update keeps its installed identity and
 * trusted installer primitives, and ships exactly the reviewed source files. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const zip = require('../service-src/zip.js');
const root = path.resolve(__dirname, '..');
const base = 'f74741a6e8bb2428d77164e741d7aa04780d387b';
function original(name) { return cp.execFileSync('git', ['show', base + ':' + name], { cwd: root }); }
function current(name) { return fs.readFileSync(path.join(root, name)); }
function normalized(bytes) { return bytes.toString('utf8').replace(/\r\n/g, '\n'); }
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function attribute(xml, tag, name) {
    const element = new RegExp('<' + tag + '\\b[^>]*>').exec(xml);
    assert.ok(element, tag + ' must exist');
    const value = new RegExp('\\b' + name + '="([^"]+)"').exec(element[0]);
    assert.ok(value, tag + ' must have ' + name);
    return value[1];
}
function payloadFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(dir, entry.name);
        assert.ok(!entry.isSymbolicLink(), 'release payload must not contain symlinks: ' + absolute);
        return entry.isDirectory() ? payloadFiles(absolute) :
            [path.relative(path.join(root, 'tizen-app'), absolute).split(path.sep).join('/')];
    });
}

test('Store update retains installed app, package and service identities', () => {
    const manifest = normalized(current('tizen-app/config.xml'));
    const oldManifest = normalized(original('tizen-app/config.xml'));
    for (const [tag, name] of [['widget', 'id'], ['tizen:application', 'id'],
        ['tizen:application', 'package'], ['tizen:application', 'required_version'], ['tizen:service', 'id']]) {
        assert.equal(attribute(manifest, tag, name), attribute(oldManifest, tag, name), tag + ' ' + name);
    }
    assert.equal(attribute(manifest, 'widget', 'version'), '0.5.0');
    assert.equal(attribute(manifest, 'tizen:application', 'id'), 'A2STVStore.Store');
    assert.equal(attribute(manifest, 'tizen:application', 'package'), 'A2STVStore');
    assert.equal(attribute(manifest, 'tizen:service', 'id'), 'A2STVStore.sdbservice');
    assert.match(normalized(current('tizen-app/js/app.js')), /var VERSION = '0\.5\.0-qh10';/);
});

test('existing Samsung signer, SDB, ZIP and upstream catalog trust remain unchanged', () => {
    for (const file of ['service-src/signer.js', 'service-src/sdb.js', 'service-src/zip.js',
        'service-src/catalog-key.js', 'catalog/upstream-public-key.js', 'scripts/test-sdb-connect.cjs']) {
        assert.equal(normalized(current(file)), normalized(original(file)), file);
    }
});

test('generated service includes each current module exactly once and without stale source', () => {
    const bundle = normalized(current('tizen-app/service/index.js'));
    const bundledNames = [...bundle.matchAll(/^defs\["\.\/([^"]+)"\] = function \(module,exports,require\) \{$/gm)]
        .map(match => match[1]);
    const sourceNames = fs.readdirSync(path.join(root, 'service-src')).filter(name => name.endsWith('.js'));
    assert.deepEqual(bundledNames.slice().sort(), sourceNames.slice().sort());
    assert.equal(new Set(bundledNames).size, bundledNames.length, 'duplicate service module');
    for (const name of sourceNames) {
        const marker = 'defs[' + JSON.stringify('./' + name) + '] = function (module,exports,require) {\n';
        assert.ok(bundle.includes(marker + normalized(current('service-src/' + name)) + '\n};\n'),
            'bundle must contain exact current source: ' + name);
    }
});

test('unsigned Store WGT is portable, complete, secret-free and identical to packaged source', () => {
    const widget = path.resolve(root, 'dist/QHSamsung.wgt');
    const entries = zip.readEntries(fs.readFileSync(widget));
    assert.ok(entries.length > 0, 'WGT must not be empty');
    assert.equal(new Set(entries.map(entry => entry.name)).size, entries.length, 'duplicate ZIP entry');
    for (const entry of entries) {
        assert.equal(entry.dir, false, 'payload inventory contains only files');
        assert.ok(!entry.name.includes('\\') && !entry.name.startsWith('/') &&
            !/^[A-Za-z]:/.test(entry.name) && !entry.name.split('/').some(part => !part || part === '..' || part === '.'),
        'WGT paths must be relative portable paths: ' + entry.name);
        assert.ok(!/(?:\.p12|\.pfx|\.pem|\.key|\.pwd|\.env)$|(?:^|\/)(?:author-signature|signature\d+)\.xml$|(?:^|\/)\.a2s-tvstore-certs\.json$/i.test(entry.name),
            'unsigned release must not contain certificates, keys or signatures: ' + entry.name);
        assert.doesNotMatch(entry.data.toString('utf8'), /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/,
            'release must never include private-key material: ' + entry.name);
        assert.equal(hash(entry.data), hash(current('tizen-app/' + entry.name)), entry.name);
    }
    assert.deepEqual(entries.map(entry => entry.name).sort(), payloadFiles(path.join(root, 'tizen-app')).sort());
    const packagedManifest = entries.find(entry => entry.name === 'config.xml');
    const packagedBundle = entries.find(entry => entry.name === 'service/index.js');
    assert.ok(packagedManifest && packagedBundle, 'manifest and service bundle are required');
    assert.equal(attribute(packagedManifest.data.toString('utf8'), 'widget', 'version'), '0.5.0');
});
