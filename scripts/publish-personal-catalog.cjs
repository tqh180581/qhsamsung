/* Build on the publisher computer, never on the TV. Release packages are data:
 * only config.xml is inflated; no downloaded JavaScript or executable is run.
 * The private catalog key is supplied through an environment secret, not a file
 * in this repository and not a Samsung application-signing certificate. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const zip = require('../service-src/zip.js');
const catalogTrust = require('../service-src/catalog.js');
const personalTrust = require('../service-src/personal.js');

const REPOSITORY = 'tqh180581/qhsamsung';
const CATALOG_URL = 'https://raw.githubusercontent.com/tqh180581/qhsamsung/personal-catalog/catalog/personal.json.signed';
const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const REFRESH_AFTER_MS = 12 * 3600 * 1000;
const STORE_PACKAGE = 'A2STVStore';
const STORE_APP = 'A2STVStore.Store';

function versionParts(value) {
    if (typeof value !== 'string' || !/^\d+(?:\.\d+){1,3}$/.test(value)) throw new Error('Expected a numeric manifest version');
    const parts = value.split('.').map(Number);
    if (parts.some(part => !Number.isSafeInteger(part))) throw new Error('Manifest version is out of range');
    while (parts.length < 4) parts.push(0);
    return parts;
}

function compareVersions(a, b) {
    const left = versionParts(a), right = versionParts(b);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    return 0;
}

function validateRegistry(registry) {
    if (!registry || registry.schemaVersion !== 1 || registry.repository !== REPOSITORY || !Array.isArray(registry.apps) || !registry.apps.length) {
        throw new Error('Expected a nonempty schemaVersion 1 registry for ' + REPOSITORY);
    }
    const ids = new Set(), packages = new Set();
    registry.apps.forEach(app => {
        if (!app || !app.name || !/^[A-Za-z0-9_.-]+$/.test(app.app_id || '') || !/^[A-Za-z0-9_.-]+$/.test(app.package_id || '')) {
            throw new Error('Every registered app needs a name and exact app_id/package_id');
        }
        if (app.app_id === STORE_APP || app.package_id === STORE_PACKAGE) throw new Error('The Store cannot be a personal app');
        if (ids.has(app.app_id) || packages.has(app.package_id)) throw new Error('Duplicate registered app identity');
        if (app.repo && app.repo !== REPOSITORY) throw new Error('Registered packages must be released in ' + REPOSITORY);
        versionParts(app.min_tizen_version);
        ids.add(app.app_id); packages.add(app.package_id);
    });
    return registry;
}

function attributes(tag) {
    const out = {};
    const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;
    let match;
    while ((match = pattern.exec(tag))) {
        if (Object.prototype.hasOwnProperty.call(out, match[1])) throw new Error('Duplicate manifest attribute');
        out[match[1]] = match[3];
    }
    return out;
}

function parseManifest(xml) {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Manifest document types/entities are not supported');
    xml = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    if (/<!--|<!\[CDATA\[/.test(xml)) throw new Error('Unterminated manifest comment or CDATA');
    const widgetTags = xml.match(/<widget\b[^>]*>/g) || [];
    const applicationTags = xml.match(/<tizen:application\b[^>]*>/g) || [];
    if (widgetTags.length !== 1 || applicationTags.length !== 1) throw new Error('Expected exactly one widget and tizen:application');
    const widget = attributes(widgetTags[0]), app = attributes(applicationTags[0]);
    if (widget.xmlns !== 'http://www.w3.org/ns/widgets' || widget['xmlns:tizen'] !== 'http://tizen.org/ns/widgets') throw new Error('Unsupported manifest namespaces');
    if (!/^[A-Za-z0-9_.-]+$/.test(app.id || '') || !/^[A-Za-z0-9_.-]+$/.test(app.package || '')) throw new Error('Invalid manifest application identity');
    if (!/^\d+\.\d+\.\d+$/.test(widget.version || '') || !/^\d+\.\d+$/.test(app.required_version || '')) throw new Error('Expected application x.y.z and minimum Tizen x.y versions');
    versionParts(widget.version); versionParts(app.required_version);
    return { app_id: app.id, package_id: app.package, version: widget.version, min_tizen_version: app.required_version };
}

// Bound central-directory allocations before calling the shared ZIP reader.
function validateZipBounds(file) {
    const size = fs.statSync(file).size;
    if (size < 22 || size > MAX_PACKAGE_BYTES) throw new Error('Package size is outside the publisher limit');
    const fd = fs.openSync(file, 'r');
    try {
        const length = Math.min(size, 22 + 65535), tail = zip.readAt(fd, size - length, length);
        let at = -1;
        for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { at = i; break; }
        if (at < 0 || at + 22 + tail.readUInt16LE(at + 20) !== tail.length) throw new Error('Invalid ZIP end record');
        const count = tail.readUInt16LE(at + 10), cdSize = tail.readUInt32LE(at + 12), cdAt = tail.readUInt32LE(at + 16);
        if (tail.readUInt16LE(at + 4) || tail.readUInt16LE(at + 6) || tail.readUInt16LE(at + 8) !== count || !count || count > 10000 || cdSize > 16 * 1024 * 1024 || cdAt + cdSize > size - length + at) {
            throw new Error('Unsupported or out-of-bounds ZIP directory');
        }
    } finally { fs.closeSync(fd); }
    return size;
}

async function readManifest(file) {
    const size = validateZipBounds(file), entries = zip.readCentral(file);
    for (const entry of entries) {
        if ((entry.flags & 1) || entry.dataStart < 0 || entry.dataStart + entry.compSize > size) throw new Error('Unsupported or out-of-bounds ZIP entry');
    }
    const manifests = entries.filter(entry => entry.name === 'config.xml' && !entry.dir);
    if (manifests.length !== 1 || manifests[0].uncompSize > MAX_MANIFEST_BYTES) throw new Error('Missing, duplicated or oversized config.xml');
    const manifest = manifests[0], chunks = [];
    let bytes = 0;
    const stream = zip.entryStream(file, manifest);
    for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > MAX_MANIFEST_BYTES) { stream.destroy(); throw new Error('Inflated config.xml is too large'); }
        chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    if (bytes !== manifest.uncompSize || zip.crc32(data) !== manifest.crc) throw new Error('config.xml size or CRC mismatch');
    return parseManifest(data.toString('utf8'));
}

function validateAsset(asset, release) {
    if (!asset || typeof asset.name !== 'string' || /[\\/\x00-\x1f]/.test(asset.name) || !/\.wgt$/i.test(asset.name)) throw new Error('Invalid WGT asset name');
    if (!Number.isSafeInteger(asset.size) || asset.size < 22 || asset.size > MAX_PACKAGE_BYTES) throw new Error('Invalid GitHub package size');
    if (asset.digest && !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) throw new Error('Invalid GitHub asset digest');
    const expected = 'https://github.com/' + REPOSITORY + '/releases/download/' + encodeURIComponent(release.tag_name) + '/' + encodeURIComponent(asset.name);
    if (asset.browser_download_url !== expected) throw new Error('Package URL does not match its registered repository/release');
    return asset;
}

async function buildCatalog(registry, releases, downloadAsset, options = {}) {
    validateRegistry(registry);
    const latest = new Map();
    for (const release of releases) {
        if (release.draft || release.prerelease) continue;
        if (typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) throw new Error('Invalid release metadata');
        for (const asset of release.assets) {
            if (!/\.wgt$/i.test(asset.name || '') || /^QHSamsung(?:[-_.]|$)/i.test(asset.name) || /^TV-Store(?:[-_.]|$)/i.test(asset.name)) continue;
            if (asset.state && asset.state !== 'uploaded') continue;
            validateAsset(asset, release);
            const file = await downloadAsset(asset, release);
            if (fs.statSync(file).size !== asset.size) throw new Error('Downloaded package size does not match GitHub');
            const hash = await hashFile(file);
            if (asset.digest && asset.digest.toLowerCase() !== 'sha256:' + hash) throw new Error('Downloaded package hash does not match GitHub');
            const manifest = await readManifest(file);
            if (manifest.app_id === STORE_APP || manifest.package_id === STORE_PACKAGE) continue;
            const known = registry.apps.find(app => app.app_id === manifest.app_id || app.package_id === manifest.package_id);
            if (!known) continue;
            if (known.app_id !== manifest.app_id || known.package_id !== manifest.package_id) throw new Error('Registered app/package identity mismatch');
            const candidate = { registered: known, manifest, tag: release.tag_name, asset: { name: asset.name, browser_download_url: asset.browser_download_url, size: asset.size, digest: 'sha256:' + hash, app_id: manifest.app_id, package_id: manifest.package_id, package_version: manifest.version } };
            const old = latest.get(known.app_id), order = old ? compareVersions(manifest.version, old.manifest.version) : 1;
            if (order === 0 && old.asset.digest !== candidate.asset.digest) throw new Error('Ambiguous packages have the same application version but different bytes');
            if (order > 0 || (order === 0 && candidate.asset.browser_download_url < old.asset.browser_download_url)) latest.set(known.app_id, candidate);
        }
    }
    const apps = [], assets = [], names = new Set();
    for (const known of registry.apps) {
        const selected = latest.get(known.app_id);
        if (!selected) throw new Error('No verified public WGT found for registered app ' + known.app_id);
        if (names.has(selected.asset.name)) throw new Error('Latest personal packages must have distinct asset names');
        names.add(selected.asset.name);
        const app = { ...known, repo: REPOSITORY, file: selected.asset.name, version: selected.manifest.version, private_download: false };
        // Never label a package compatible with an older Tizen than its manifest requires.
        app.min_tizen_version = compareVersions(selected.manifest.min_tizen_version, known.min_tizen_version) > 0 ? selected.manifest.min_tizen_version : known.min_tizen_version;
        apps.push(app); assets.push(selected.asset);
    }
    const catalog = {
        schemaVersion: 1,
        generatedAt: new Date(options.now || Date.now()).toISOString(),
        providers: [{ id: 'qhsamsung-personal', ok: true, url: 'https://api.github.com/repos/' + REPOSITORY + '/releases', latestTag: 'personal-latest', catalog: { apps }, releases: [{ tag_name: 'personal-latest', assets }] }]
    };
    personalTrust.validate(catalog.providers[0], false);
    return catalog;
}

async function hashFile(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

function validateSigningKey(privateKeyPem, publicKeyPem) {
    if (!privateKeyPem) throw new Error('PERSONAL_CATALOG_PRIVATE_KEY is not configured');
    const key = crypto.createPrivateKey(privateKeyPem), publicKey = crypto.createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw new Error('An RSA catalog key of at least 2048 bits is required');
    const derived = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
    if (!derived.equals(publicKey.export({ type: 'spki', format: 'der' }))) throw new Error('Catalog private key does not match service-src/personal-key.js');
    return key;
}

function readPrevious(bytes, publicKeyPem) {
    personalTrust.verify(bytes, publicKeyPem, Date.now(), { allowExpired: true });
    return JSON.parse(bytes.subarray(bytes.indexOf(10) + 1).toString('utf8'));
}

function signCatalog(catalog, privateKeyPem, publicKeyPem, previousBytes) {
    const key = validateSigningKey(privateKeyPem, publicKeyPem);
    if (previousBytes) {
        const previous = readPrevious(previousBytes, publicKeyPem);
        const beforeApps = previous.providers.find(p => p.id === 'qhsamsung-personal')?.catalog?.apps || [];
        const nextApps = catalog.providers[0].catalog.apps;
        for (const old of beforeApps) {
            const next = nextApps.find(app => app.app_id === old.app_id);
            if (!next || next.package_id !== old.package_id || compareVersions(next.version, old.version) < 0) throw new Error('Refusing an automatic application-version rollback or removal');
        }
        const withoutDate = value => JSON.stringify({ ...value, generatedAt: null });
        const age = Date.parse(catalog.generatedAt) - Date.parse(previous.generatedAt);
        if (age >= 0 && age < REFRESH_AFTER_MS && withoutDate(previous) === withoutDate(catalog)) return { catalog: previous, signed: previousBytes, reused: true };
    }
    const payload = Buffer.from(JSON.stringify(catalog));
    const signature = crypto.sign('RSA-SHA256', payload, key).toString('base64');
    const signed = Buffer.concat([Buffer.from(signature + '\n'), payload]);
    catalogTrust.verify(signed, publicKeyPem, Date.parse(catalog.generatedAt));
    personalTrust.verify(signed, publicKeyPem, Date.parse(catalog.generatedAt));
    return { catalog, signed, reused: false };
}

function apiHeaders(token) {
    return { Accept: 'application/vnd.github+json', 'User-Agent': 'QHSamsung-personal-catalog', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
}

async function fetchReleases(fetchImpl = fetch, token) {
    const releases = [];
    for (let page = 1; page <= 20; page++) {
        const response = await fetchImpl('https://api.github.com/repos/' + REPOSITORY + '/releases?per_page=100&page=' + page, { headers: apiHeaders(token), signal: AbortSignal.timeout(60000), redirect: 'error' });
        if (!response.ok) throw new Error('GitHub release request failed (HTTP ' + response.status + ')');
        const batch = await response.json();
        if (!Array.isArray(batch)) throw new Error('GitHub releases response is not an array');
        releases.push(...batch);
        if (batch.length < 100) return releases;
    }
    throw new Error('Too many release pages; refusing an incomplete catalog');
}

async function downloadToFile(asset, directory, fetchImpl = fetch) {
    const response = await fetchImpl(asset.browser_download_url, { headers: { 'User-Agent': 'QHSamsung-personal-catalog' }, signal: AbortSignal.timeout(120000), redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error('WGT download failed (HTTP ' + response.status + ')');
    const final = new URL(response.url || asset.browser_download_url);
    if (final.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(final.hostname)) throw new Error('Unexpected GitHub asset download destination');
    const filename = path.join(directory, crypto.createHash('sha256').update(asset.browser_download_url).digest('hex') + '.wgt');
    let bytes = 0;
    const bound = new Transform({ transform(chunk, encoding, callback) {
        bytes += chunk.length;
        callback(bytes > asset.size || bytes > MAX_PACKAGE_BYTES ? new Error('WGT download exceeds its declared size') : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), bound, fs.createWriteStream(filename, { flags: 'wx' }));
    if (bytes !== asset.size) throw new Error('WGT download is incomplete');
    return filename;
}

async function main(argv = process.argv.slice(2)) {
    const root = path.resolve(__dirname, '..');
    let output = path.join(root, 'work', 'personal-catalog'), previousFile;
    for (let i = 0; i < argv.length; i++) {
        if ((argv[i] === '--output' || argv[i] === '--previous') && argv[i + 1]) {
            if (argv[i] === '--output') output = path.resolve(argv[++i]); else previousFile = path.resolve(argv[++i]);
        } else throw new Error('Usage: node scripts/publish-personal-catalog.cjs [--output DIR] [--previous FILE]');
    }
    const registry = validateRegistry(JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'personal-apps-registry.json'), 'utf8')));
    const publicKeyPem = require('../service-src/personal-key.js');
    validateSigningKey(process.env.PERSONAL_CATALOG_PRIVATE_KEY, publicKeyPem);
    const temporaryRoot = path.resolve(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'qhsamsung-catalog-'));
    try {
        const releases = await fetchReleases(fetch, process.env.GITHUB_TOKEN);
        const catalog = await buildCatalog(registry, releases, asset => downloadToFile(asset, temporary));
        const result = signCatalog(catalog, process.env.PERSONAL_CATALOG_PRIVATE_KEY, publicKeyPem, previousFile && fs.readFileSync(previousFile));
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'personal.json'), JSON.stringify(result.catalog, null, 2) + '\n');
        fs.writeFileSync(path.join(output, 'personal.json.signed'), result.signed);
        console.log((result.reused ? 'Kept current signature for ' : 'Signed catalog for ') + result.catalog.providers[0].catalog.apps.length + ' personal app(s).');
    } finally {
        if (path.dirname(path.resolve(temporary)) !== temporaryRoot || !path.basename(temporary).startsWith('qhsamsung-catalog-')) throw new Error('Refusing cleanup outside the publisher temporary directory');
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

module.exports = { REPOSITORY, CATALOG_URL, MAX_PACKAGE_BYTES, REFRESH_AFTER_MS, compareVersions, validateRegistry, parseManifest, readManifest, validateAsset, buildCatalog, validateSigningKey, readPrevious, signCatalog, fetchReleases, downloadToFile };
if (require.main === module) main().catch(error => { console.error('Personal catalog publication failed: ' + error.message); process.exitCode = 1; });
