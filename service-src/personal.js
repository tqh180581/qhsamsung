/* Personal packages pinned inside the signed QHSamsung application.
 * Only these exact URLs and SHA-256 values may extend the verified upstream catalog.
 * Runtime requests cannot add or change entries in this list. */
'use strict';
var pinned = require('./personal-catalog.js');
var catalogTrust = require('./catalog.js');

exports.merge = function (verified) {
    var provider = JSON.parse(JSON.stringify(pinned));
    (provider.releases || []).forEach(function (release) {
        (release.assets || []).forEach(function (asset) {
            if (!/^https:\/\/github\.com\/tqh180581\/qhsamsung\/releases\/download\//.test(asset.browser_download_url || '') ||
                !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) {
                throw new Error('Invalid bundled personal package');
            }
        });
    });
    var source = verified ? verified.catalog : { schemaVersion: 1, providers: [] };
    var catalog = {};
    Object.keys(source).forEach(function (key) { catalog[key] = source[key]; });
    catalog.providers = (source.providers || []).filter(function (p) { return p.id !== provider.id; }).concat([provider]);
    var index = catalogTrust.index(catalog);
    if (verified) Object.keys(verified.index).forEach(function (u) {
        if (index[u] !== undefined && index[u] !== verified.index[u]) throw new Error('Personal package conflicts with verified catalog');
    });
    return {catalog: catalog, payload: JSON.stringify(catalog), index: index};
};
