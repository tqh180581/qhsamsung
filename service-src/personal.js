/* Personal catalogs have a separate signing key. Only the service verifies and
 * merges them; the UI cannot extend the install allowlist. ES5 for older TVs. */
'use strict';
var pinned = require('./personal-catalog.js');
var trust = require('./catalog.js');
var ID = 'qhsamsung-personal';
var ORIGIN = /^https:\/\/github\.com\/tqh180581\/qhsamsung\/releases\/download\/[^/?#]+\/[^/?#]+\.wgt$/i;

function version(v) {
    if (!/^\d+\.\d+\.\d+$/.test(v || '')) throw new Error('Invalid personal app version');
    return v.split('.').map(Number);
}
function compare(a, b) {
    a = version(a); b = version(b);
    for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
}
function validate(provider, bundled) {
    if (!provider || provider.id !== ID || !provider.catalog || !Array.isArray(provider.catalog.apps) ||
        !provider.catalog.apps.length || provider.catalog.apps.length > 100 || !Array.isArray(provider.releases))
        throw new Error('Invalid personal catalog');
    var entries = {}, apps = {}, names = {}, first = provider.releases[0];
    if (!first || !Array.isArray(first.assets)) throw new Error('Missing personal assets');
    provider.catalog.apps.forEach(function (app) {
        if (!/^[A-Za-z0-9_]+\.[A-Za-z0-9_.-]+$/.test(app.app_id || '') ||
            !/^[A-Za-z0-9_]+$/.test(app.package_id || '') || /^A2STVStore$/i.test(app.package_id) ||
            app.app_id.indexOf(app.package_id + '.') !== 0 || apps[app.app_id] || names[app.file] ||
            !/^[^/\\]+\.wgt$/i.test(app.file || '') || !/^\d+\.\d+$/.test(app.min_tizen_version || '') ||
            typeof app.name !== 'string' || !app.name || app.private_download === true || app.root === true || (app.flags || []).indexOf('root') >= 0)
            throw new Error('Invalid personal app identity');
        version(app.version);
        if (!first.assets.some(function (asset) { return asset.name === app.file; })) throw new Error('Personal app has no current asset');
        apps[app.app_id] = app; names[app.file] = app;
    });
    var count = 0;
    provider.releases.forEach(function (release) {
        if (!release || !Array.isArray(release.assets)) throw new Error('Invalid personal release');
        release.assets.forEach(function (asset) {
            if (++count > 1000 || !ORIGIN.test(asset.browser_download_url || '') ||
                !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '') ||
                !/^[^/\\]+\.wgt$/i.test(asset.name || '') || !isFinite(asset.size) || asset.size <= 0 || asset.size > 128 * 1024 * 1024)
                throw new Error('Invalid personal package');
            var app = names[asset.name];
            // The immutable bundled baseline contains historical assets for one app.
            if (!app && bundled && provider.catalog.apps.length === 1) app = provider.catalog.apps[0];
            if (!app || (asset.app_id && asset.app_id !== app.app_id) ||
                (asset.package_id && asset.package_id !== app.package_id)) throw new Error('Personal asset identity mismatch');
            if (!bundled && asset.package_version && asset.package_version !== app.version) throw new Error('Personal asset version mismatch');
            var entry = { url: asset.browser_download_url, file: asset.name, appId: app.app_id, packageId: app.package_id,
                version: asset.package_version || app.version, digest: asset.digest.slice(7).toLowerCase() };
            version(entry.version);
            if (entries[entry.url] && JSON.stringify(entries[entry.url]) !== JSON.stringify(entry)) throw new Error('Conflicting personal asset');
            entries[entry.url] = entry;
        });
    });
    return entries;
}
function verify(buf, key, now, options) {
    options = options || {}; now = now || Date.now();
    var verified = trust.verify(buf, key, options.allowExpired ? 1 : now), cat = verified.catalog;
    var at = Date.parse(cat.generatedAt);
    if (cat.schemaVersion !== 1 || !Array.isArray(cat.providers) || cat.providers.length !== 1 || at > now + 5 * 60 * 1000)
        throw new Error('Invalid personal catalog envelope or clock');
    if (options.previous && at < options.previous.at) throw new Error('Personal catalog rollback rejected');
    var provider = cat.providers[0];
    validate(provider, false);
    var baseline = (options.previous ? options.previous.provider.catalog.apps : []).concat(pinned.catalog.apps);
    baseline.forEach(function (old) {
        var current = provider.catalog.apps.filter(function (app) { return app.app_id === old.app_id; })[0];
        if (!current || current.package_id !== old.package_id || compare(current.version, old.version) < 0)
            throw new Error('Personal app rollback or removal rejected: ' + old.app_id);
    });
    return { provider: provider, at: at, bytes: buf };
}
function merge(verified, personal, status) {
    var provider = JSON.parse(JSON.stringify(personal ? personal.provider : pinned));
    var entries = validate(provider, !personal);
    var source = verified ? verified.catalog : { schemaVersion: 1, providers: [] }, catalog = {};
    Object.keys(source).forEach(function (key) { catalog[key] = source[key]; });
    catalog.providers = (source.providers || []).filter(function (p) { return p.id !== ID; }).concat([provider]);
    catalog.personalCatalog = status || { source: 'bundled', generatedAt: null };
    var index = trust.index(catalog);
    if (verified) Object.keys(verified.index).forEach(function (u) {
        if (index[u] !== undefined && index[u] !== verified.index[u]) throw new Error('Personal package conflicts with verified catalog');
    });
    return { catalog: catalog, payload: JSON.stringify(catalog), index: index, personalEntries: entries };
}
module.exports = { verify: verify, merge: merge, validate: validate, compare: compare, ID: ID };
