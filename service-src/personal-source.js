/* Network/cache orchestration kept separate so failures can be tested offline. */
'use strict';
var personal = require('./personal.js');
var URL = 'https://raw.githubusercontent.com/tqh180581/qhsamsung/personal-catalog/catalog/personal.json.signed';
var MAX_BYTES = 2 * 1024 * 1024;
exports.URL = URL;
exports.create = function (options) {
    var previous = null, initialized = false;
    var now = options.now || Date.now;
    function init() {
        if (initialized) return; initialized = true;
        try {
            var saved = options.read();
            if (saved && saved.length <= MAX_BYTES) previous = personal.verify(saved, options.key, now(), { allowExpired: true });
        } catch (e) { options.log('personal catalog: saved copy unavailable: ' + e.message); }
    }
    return function load(cb) {
        init();
        options.fetch(URL, function (err, bytes) {
            var verified = null, status;
            if (!err) {
                try {
                    if (!bytes || bytes.length > MAX_BYTES) throw new Error('Personal catalog is too large');
                    verified = personal.verify(bytes, options.key, now(), { previous: previous });
                    previous = verified;
                    try { options.write(bytes); } catch (e) { options.log('personal catalog: could not save verified copy: ' + e.message); }
                } catch (e) { err = e; }
            }
            if (verified) status = { source: 'online', generatedAt: new Date(verified.at).toISOString() };
            else if (previous) {
                try { verified = personal.verify(previous.bytes, options.key, now()); }
                catch (e) { options.log('personal catalog: saved copy expired: ' + e.message); }
                status = verified ? { source: 'cache', generatedAt: new Date(verified.at).toISOString(), error: err && err.message }
                    : { source: 'bundled', generatedAt: null, error: err && err.message };
            } else status = { source: 'bundled', generatedAt: null, error: err && err.message };
            if (err) options.log('personal catalog: ' + err.message + '; using ' + status.source);
            cb(null, verified, status);
        });
    };
};
