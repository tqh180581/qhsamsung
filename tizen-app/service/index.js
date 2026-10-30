/* QHSamsung personal build; derived from Apps2Samsung TV-Store 0.3.8. */
(function (nodeRequire, hostModule) {
"use strict";
var defs = {}, cache = {};
function load(id) { if (cache[id]) return cache[id].exports; if (!defs[id]) return nodeRequire(id); var m = cache[id] = {exports:{}}; defs[id](m,m.exports,load); return m.exports; }
defs["./compat.js"] = function (module,exports,require) {
/* Buffers for the Node of a Tizen web service: v4.4.3 on a 2019 Tizen 5.0 set (#881).
 * Buffer.from and Buffer.alloc arrived in Node 4.5.0. On 4.4.3, Buffer.from is the inherited
 * Uint8Array.from, which reads the encoding argument as a map function: Buffer.from(s, 'utf8')
 * throws "utf8 is not a function". Every service module and test builds buffers through here.
 * Run the tests with that exact Node (CI does) before using anything newer than ES5 / Node 4.
 */
'use strict';
var NATIVE = typeof Buffer.alloc === 'function' && Buffer.from !== Uint8Array.from;

exports.from = function (value, encoding) { return NATIVE ? Buffer.from(value, encoding) : new Buffer(value, encoding); };
exports.alloc = function (size) {
    if (NATIVE) return Buffer.alloc(size);
    var b = new Buffer(size); b.fill(0); return b;
};


};
defs["./sdb.js"] = function (module,exports,require) {
/* Minimal SDB client for the TV-Store service (#844).
 *
 * Speaks the Samsung sdbd wire protocol (the ADB-derived transport) to sdbd on the TV, over a plain
 * TCP socket the Node service is allowed to open. Ported from TizenSdb.Core (SdbTcpDevice): the CNXN
 * handshake, the OPEN/OKAY/WRTE/CLSE stream multiplexing, the shell: service, and the sync: push.
 *
 * On the sets this targets the probe (#844 phase 0) showed sdbd replies CNXN with NO auth once
 * Developer Mode's Host PC IP is the TV's own address, so this client does not implement the RSA
 * AUTH exchange: if a set ever answers AUTH, connect() rejects with a clear message rather than
 * pretending. Everything here is byte-for-byte what tizen-sdb sends, so a package it pushes and
 * installs is handled exactly as the desktop/phone/CLI would.
 */
'use strict';
var Buf = require('./compat.js');
var net = require('net');

var CMD = { CNXN: 0x4E584E43, AUTH: 0x48545541, OPEN: 0x4E45504F, OKAY: 0x59414B4F, WRTE: 0x45545257, CLSE: 0x45534C43 };
var NAME = {}; Object.keys(CMD).forEach(function (k) { NAME[CMD[k]] = k; });
var CLIENT_VERSION = 0x01000000;
var MAXDATA = 256 * 1024;

function sum32(buf) { var s = 0; for (var i = 0; i < buf.length; i++) s = (s + buf[i]) >>> 0; return s; }

function frame(command, arg0, arg1, payload) {
    payload = payload || Buf.alloc(0);
    var h = Buf.alloc(24);
    h.writeUInt32LE(command >>> 0, 0);
    h.writeUInt32LE(arg0 >>> 0, 4);
    h.writeUInt32LE(arg1 >>> 0, 8);
    h.writeUInt32LE(payload.length >>> 0, 12);
    h.writeUInt32LE(sum32(payload) >>> 0, 16);
    h.writeUInt32LE((command ^ 0xffffffff) >>> 0, 20);
    return Buffer.concat([h, payload]);
}

// A framed reader: accumulates bytes and emits {command,arg0,arg1,payload} frames.
function Demux(onFrame) {
    var buf = Buf.alloc(0);
    this.push = function (chunk) {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 24) {
            var len = buf.readUInt32LE(12);
            if (buf.length < 24 + len) break;
            var command = buf.readUInt32LE(0), arg0 = buf.readUInt32LE(4), arg1 = buf.readUInt32LE(8);
            var payload = buf.slice(24, 24 + len);
            buf = buf.slice(24 + len);
            onFrame({ command: command, arg0: arg0, arg1: arg1, payload: payload });
        }
    };
}

function SdbClient(host, port) {
    this.host = host;
    this.port = port || 26101;
    this._sock = null;
    this._nextLocalId = 1;
    this._channels = {};        // localId -> channel state
    this._connected = false;
}

SdbClient.prototype.connect = function (cb) {
    var self = this;
    var done = false;
    function finish(err) {
        if (done) return;
        done = true;
        if (!err && self._sock) self._sock.setTimeout(0);
        cb(err);
    }
    var sock = net.connect(this.port, this.host, function () {
        sock.write(frame(CMD.CNXN, CLIENT_VERSION, MAXDATA, Buf.from('host::sdb-net-client')));
    });
    this._sock = sock;
    sock.setTimeout(15000);
    this._demux = new Demux(function (f) { self._onFrame(f, finish); });
    sock.on('data', function (d) { self._demux.push(d); });
    sock.on('timeout', function () {
        var err = new Error('TV connection timed out. Set Developer Mode Host PC IP to this TV\'s own IP, then restart the TV.');
        finish(err); self._failAll(err); sock.destroy();
    });
    sock.on('error', function (e) { finish(new Error('sdb socket error: ' + ((e && e.code) || e.message))); self._failAll(e); });
    sock.on('close', function () {
        var err = new Error('TV closed the install connection. Set Developer Mode Host PC IP to this TV\'s own IP, then restart the TV.');
        self._connected = false;
        // A TV with a different Host PC IP can close before sending CNXN. There are no
        // channels yet, so _failAll alone would leave connect's callback waiting forever.
        finish(err); self._failAll(err);
    });
};

SdbClient.prototype._onFrame = function (f, connectCb) {
    var self = this;
    if (!this._connected) {
        if (f.command === CMD.CNXN) { this._connected = true; if (connectCb) connectCb(null); return; }
        if (f.command === CMD.AUTH) { if (connectCb) connectCb(new Error('sdbd requires key auth on this set; set Developer Mode Host PC IP to the TV’s own IP')); try { this._sock.destroy(); } catch (e) {} return; }
        return;
    }
    var ch = this._channels[f.arg1];   // arg1 = our local id on inbound frames
    if (f.command === CMD.OKAY) { if (ch) { ch.remoteId = f.arg0; if (ch.onReady) { var r = ch.onReady; ch.onReady = null; r(); } else if (ch.pendingWrite) { var w = ch.pendingWrite; ch.pendingWrite = null; w(); } } return; }
    if (f.command === CMD.WRTE) { if (ch) { self._send(CMD.OKAY, ch.localId, ch.remoteId); if (ch.onData) ch.onData(f.payload); } return; }
    if (f.command === CMD.CLSE) { if (ch) { if (ch.onClose) ch.onClose(); delete self._channels[ch.localId]; } return; }
};

SdbClient.prototype._send = function (command, arg0, arg1, payload) { this._sock.write(frame(command, arg0, arg1, payload)); };
SdbClient.prototype._failAll = function (err) { var self = this; Object.keys(this._channels).forEach(function (id) { var ch = self._channels[id]; if (ch.onClose) ch.onClose(err); }); this._channels = {}; };

// Open a stream for a service string ("shell:...\0", "sync:\0"). cb(err, channel).
SdbClient.prototype.open = function (service, handlers, cb) {
    var localId = this._nextLocalId++;
    var ch = { localId: localId, remoteId: 0, onData: handlers.onData, onClose: handlers.onClose, onReady: null };
    this._channels[localId] = ch;
    ch.onReady = function () { cb(null, ch); };
    this._send(CMD.OPEN, localId, 0, Buf.from(service, 'binary'));
};

// Write a chunk to a channel and wait for the device OKAY before the next write.
SdbClient.prototype.write = function (ch, payload, cb) {
    ch.pendingWrite = cb;
    this._send(CMD.WRTE, ch.localId, ch.remoteId, payload);
};

SdbClient.prototype.close = function (ch) { try { this._send(CMD.CLSE, ch.localId, ch.remoteId); } catch (e) {} delete this._channels[ch.localId]; };
SdbClient.prototype.end = function () { try { this._sock.destroy(); } catch (e) {} };

// shell:<command> — collect all output, then callback.
SdbClient.prototype.shell = function (command, cb) {
    var out = [], finished = false;
    function fin(err) { if (finished) return; finished = true; cb(err, Buffer.concat(out).toString('utf8')); }
    this.open('shell:' + command + '\u0000', {
        onData: function (d) { out.push(d); },
        onClose: function (err) { fin(err || null); },
    }, function (err) { if (err) fin(err); });
};

// sync: push to a remote path (mode 0644). Mirrors tizen-sdb PushAsync. data is a Buffer or
// { size, read(offset, length) -> Buffer }, so a package can go straight from a file.
SdbClient.prototype.push = function (remotePath, data, cb) {
    var self = this;
    var reply = Buf.alloc(0), finished = false, chRef = null;
    function finish(err) { if (finished) return; finished = true; if (chRef) { try { self.close(chRef); } catch (e) {} } cb(err || null); }
    function onSync(d) {
        reply = Buffer.concat([reply, d]);
        if (reply.length >= 8) {
            var id = reply.slice(0, 4).toString('ascii');
            if (id === 'OKAY') return finish(null);
            if (id === 'FAIL') { var n = reply.readUInt32LE(4); return finish(new Error('sync FAIL: ' + reply.slice(8, 8 + n).toString('utf8'))); }
        }
    }
    this.open('sync:\u0000', { onData: function (d) { onSync(d); }, onClose: function (err) { if (err) finish(err); } }, function (err, ch) {
        if (err) return cb(err);
        chRef = ch;
        // SEND "<path>,<mode>"
        var target = remotePath + ',' + 0x81a4;   // 0100644
        syncPacket('SEND', Buf.from(target), function () { sendData(0); });
        var size = Buffer.isBuffer(data) ? data.length : data.size;
        function sendData(off) {
            if (off >= size) return doneCmd();
            var end = Math.min(off + 64 * 1024, size), chunk;        // 64 KiB sync chunks
            try { chunk = Buffer.isBuffer(data) ? data.slice(off, end) : data.read(off, end - off); } catch (e) { return finish(e); }
            syncPacket('DATA', chunk, function () { sendData(end); });
        }
        function doneCmd() {
            var mtime = Buf.alloc(4); mtime.writeUInt32LE(Math.floor(Date.now() / 1000) >>> 0, 0);
            syncPacket('DONE', mtime, function () { /* wait for OKAY via onSync */ });
        }
        function syncPacket(cmd4, payload, after) {
            var h = Buf.alloc(8); h.write(cmd4, 0, 'ascii'); h.writeUInt32LE(payload.length >>> 0, 4);
            self.write(ch, Buffer.concat([h, payload]), after);
        }
    });
};

module.exports = { SdbClient: SdbClient, frame: frame, CMD: CMD, NAME: NAME, Demux: Demux, sum32: sum32 };


};
defs["./zip.js"] = function (module,exports,require) {
/* Minimal zip for the signer. Node's zlib does the inflate, so no npm dependency.
 * On the TV the signer works on files, never on a whole package in memory: a 41 MB package took the
 * service down on a Tizen 6 set while it held the download, every inflated file and the repacked
 * copy at once. readCentral lists a package on disk, entryStream inflates one entry as a stream (for
 * its digest), and writeFile copies entries over still compressed, 64 KiB at a time.
 * readEntries/write work on Buffers and are kept for the tests' fixtures. */
'use strict';
var Buf = require('./compat.js');
var zlib = require('zlib');

function readEntries(buf) {
    // Find the End Of Central Directory record, then walk the central directory.
    var eocd = -1;
    for (var i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('not a zip (no EOCD)');
    var count = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
    var p = cdOff, out = [];
    for (var n = 0; n < count; n++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central dir header');
        var method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20), uncompSize = buf.readUInt32LE(p + 24);
        var nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commLen = buf.readUInt16LE(p + 32);
        var lho = buf.readUInt32LE(p + 42);
        var name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
        // Local header: recompute data start (its name/extra lengths can differ from the central dir's).
        var lhNameLen = buf.readUInt16LE(lho + 26), lhExtraLen = buf.readUInt16LE(lho + 28);
        var dataStart = lho + 30 + lhNameLen + lhExtraLen;
        var comp = buf.slice(dataStart, dataStart + compSize);
        var data = method === 0 ? comp : zlib.inflateRawSync(comp);
        if (data.length !== uncompSize) throw new Error('size mismatch for ' + name);
        out.push({ name: name, data: data, dir: name.charAt(name.length - 1) === '/' });
        p += 46 + nameLen + extraLen + commLen;
    }
    return out;
}

function crc32(buf) {
    var c, T = crc32.T || (crc32.T = (function () { var t = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })());
    c = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// entries: [{name, data(Buffer)}], all STORED. Returns a Buffer (a valid .wgt).
function write(entries) {
    var locals = [], central = [], offset = 0;
    entries.forEach(function (e) {
        var nameBuf = Buf.from(e.name, 'utf8'), crc = crc32(e.data), size = e.data.length;
        var lh = Buf.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
        lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
        var localRec = Buffer.concat([lh, nameBuf, e.data]);
        var cd = Buf.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
        cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(size, 20); cd.writeUInt32LE(size, 24);
        cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34);
        cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
        central.push(Buffer.concat([cd, nameBuf]));
        locals.push(localRec); offset += localRec.length;
    });
    var cdBuf = Buffer.concat(central), localBuf = Buffer.concat(locals);
    var eocd = Buf.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16); eocd.writeUInt16LE(0, 20);
    return Buffer.concat([localBuf, cdBuf, eocd]);
}

// ---- on disk ---------------------------------------------------------------------------------------
var fs = require('fs');
var CHUNK = 64 * 1024;

function readAt(fd, pos, len) { var b = Buf.alloc(len), n = 0; while (n < len) { var r = fs.readSync(fd, b, n, len - n, pos + n); if (!r) break; n += r; } return n === len ? b : b.slice(0, n); }

// The entries of the package at `file`: [{name, dir, method, flags, crc, compSize, uncompSize, dataStart}].
function readCentral(file) {
    var fd = fs.openSync(file, 'r');
    try {
        var size = fs.fstatSync(fd).size, tailLen = Math.min(size, 22 + 65535), tail = readAt(fd, size - tailLen, tailLen);
        var eocd = -1;
        for (var i = tail.length - 22; i >= 0; i--) { if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
        if (eocd < 0) throw new Error('not a zip (no EOCD)');
        var count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
        var cd = readAt(fd, cdOff, cdSize), p = 0, out = [];
        for (var n = 0; n < count; n++) {
            if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central dir header');
            var nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commLen = cd.readUInt16LE(p + 32);
            var e = { flags: cd.readUInt16LE(p + 8), method: cd.readUInt16LE(p + 10), crc: cd.readUInt32LE(p + 16),
                      compSize: cd.readUInt32LE(p + 20), uncompSize: cd.readUInt32LE(p + 24), name: cd.slice(p + 46, p + 46 + nameLen).toString('utf8') };
            if (e.method !== 0 && e.method !== 8) throw new Error('unsupported compression ' + e.method + ' for ' + e.name);
            // Local header: its name/extra lengths can differ from the central dir's.
            var lho = cd.readUInt32LE(p + 42), lh = readAt(fd, lho, 30);
            if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('bad local header for ' + e.name);
            e.dataStart = lho + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
            e.dir = e.name.charAt(e.name.length - 1) === '/';
            out.push(e);
            p += 46 + nameLen + extraLen + commLen;
        }
        return out;
    } finally { fs.closeSync(fd); }
}

// The uncompressed bytes of one entry, as a stream.
function entryStream(file, e) {
    if (!e.compSize) { var empty = new (require('stream').PassThrough)(); empty.end(); return empty; }
    var raw = fs.createReadStream(file, { start: e.dataStart, end: e.dataStart + e.compSize - 1, highWaterMark: CHUNK });
    if (e.method === 0) return raw;
    var inf = zlib.createInflateRaw();
    raw.on('error', function (err) { inf.emit('error', err); });
    return raw.pipe(inf);
}

// Writes a package to `outFile`. items: {name, data: Buffer} (stored as is) or {name, from: file, entry}
// (copied over still compressed, with the crc and sizes the source's central directory gives).
function writeFile(outFile, items) {
    var out = fs.openSync(outFile, 'w'), central = [], offset = 0;
    function put(b) { var n = 0; while (n < b.length) n += fs.writeSync(out, b, n, b.length - n, null); offset += b.length; }
    try {
        items.forEach(function (it) {
            var nameBuf = Buf.from(it.name, 'utf8'), e = it.entry, method, crc, comp, uncomp;
            if (e) { method = e.method; crc = e.crc; comp = e.compSize; uncomp = e.uncompSize; }
            else { method = 0; crc = crc32(it.data); comp = uncomp = it.data.length; }
            var flags = 0x0800;     // names are UTF-8; no data descriptor, the sizes are known up front
            var at = offset, lh = Buf.alloc(30);
            lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
            lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
            lh.writeUInt32LE(comp, 18); lh.writeUInt32LE(uncomp, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
            put(lh); put(nameBuf);
            if (e) {
                var src = fs.openSync(it.from, 'r');
                try { for (var p = 0; p < comp; p += CHUNK) { var b = readAt(src, e.dataStart + p, Math.min(CHUNK, comp - p)); if (!b.length) throw new Error('package ends inside ' + it.name); put(b); } }
                finally { fs.closeSync(src); }
            } else put(it.data);
            var cd = Buf.alloc(46);
            cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(flags, 8); cd.writeUInt16LE(method, 10);
            cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp, 20); cd.writeUInt32LE(uncomp, 24);
            cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34);
            cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(at, 42);
            central.push(Buffer.concat([cd, nameBuf]));
        });
        var cdBuf = Buffer.concat(central), cdAt = offset, eocd = Buf.alloc(22);
        put(cdBuf);
        eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(items.length, 8); eocd.writeUInt16LE(items.length, 10);
        eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(cdAt, 16); eocd.writeUInt16LE(0, 20);
        put(eocd);
    } finally { fs.closeSync(out); }
}

module.exports = { readEntries: readEntries, write: write, crc32: crc32, readCentral: readCentral, entryStream: entryStream, writeFile: writeFile, readAt: readAt };


};
defs["./signer.js"] = function (module,exports,require) {
/* Tizen .wgt signer, ported from TizenSdb.Core TizenWgtSigner and verified byte-for-byte against its
 * output (test/sign.test.js). Produces author-signature.xml + signature1.xml: W3C XML Signature with a
 * SHA-512 digest per package file, a SignedProperties object digested under c14n11, SignedInfo signed
 * under exclusive-c14n with RSA-SHA512, and the signing cert embedded in KeyInfo.
 *
 * Certs arrive as PEM (key + cert chain) from a head, not as a .p12: Node has no PKCS#12 parser and the
 * TV's Node is old, so the head (which already holds the decrypted material) hands over PEM. A cert PEM
 * may hold several blocks (leaf, then intermediates); every one of them goes into KeyInfo, as from a PC. The canonical
 * byte sequences here are the exact ones C#'s canonicalizers produce — proven equal, not reimplemented
 * as a general c14n — so the output installs identically.
 */
'use strict';
var Buf = require('./compat.js');
var crypto = require('crypto');
var zip = require('./zip.js');

var DSIG = 'http://www.w3.org/2000/09/xmldsig#';
var SHA512 = 'http://www.w3.org/2001/04/xmlenc#sha512';
var EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
var C14N11 = 'http://www.w3.org/2006/12/xml-c14n11';
var RSA_SHA512 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512';

function sha512b64(buf) { return crypto.createHash('sha512').update(buf).digest('base64'); }
function wrap76(s) { var out = []; for (var i = 0; i < s.length; i += 76) out.push(s.slice(i, i + 76)); return out.join('\n'); }
// The certificates in a PEM string, base64 DER each, in the order they appear. A head sends the
// chain the C# signer embeds (TizenSdb.Core GetKeyInfoChain): leaf first, then intermediates, never
// the root, so KeyInfo below comes out the same as a package signed from a PC.
function pemCerts(certPem) {
    var out = [], re = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g, m;
    while ((m = re.exec(certPem)) !== null) out.push(m[1].replace(/\s+/g, ''));
    if (!out.length) throw new Error('certificate PEM holds no CERTIFICATE block');
    return out;
}

// The #prop SignatureProperties object, in c14n11 canonical form (for the #prop digest) — proven to
// match C#. targetId = "AuthorSignature" | "DistributorSignature"; role = "author" | "distributor".
function propCanonical(targetId, role) {
    return '<Object xmlns="' + DSIG + '" Id="prop"><SignatureProperties xmlns:dsp="http://www.w3.org/2009/xmldsig-properties">'
        + '<SignatureProperty Id="profile" Target="#' + targetId + '"><dsp:Profile URI="http://www.w3.org/ns/widgets-digsig#profile"></dsp:Profile></SignatureProperty>'
        + '<SignatureProperty Id="role" Target="#' + targetId + '"><dsp:Role URI="http://www.w3.org/ns/widgets-digsig#role-' + role + '"></dsp:Role></SignatureProperty>'
        + '<SignatureProperty Id="identifier" Target="#' + targetId + '"><dsp:Identifier></dsp:Identifier></SignatureProperty>'
        + '</SignatureProperties></Object>';
}
// The object as STORED in the signature file: it inherits the default xmldsig namespace from
// <Signature>, so (unlike the canonical form used for the digest) it carries no xmlns on <Object>.
function propStored(targetId, role) { return propCanonical(targetId, role).replace(' xmlns="' + DSIG + '"', ''); }

// A <Reference> as it appears in SignedInfo (both canonical and stored forms are identical here).
function reference(uri, digestB64, withTransform) {
    var t = withTransform ? '<Transforms><Transform Algorithm="' + C14N11 + '"></Transform></Transforms>' : '';
    var tStored = withTransform ? '<Transforms><Transform Algorithm="' + C14N11 + '" /></Transforms>' : '';
    return { canon: '<Reference URI="' + uri + '">' + t + '<DigestMethod Algorithm="' + SHA512 + '"></DigestMethod><DigestValue>' + digestB64 + '</DigestValue></Reference>',
             stored: '<Reference URI="' + uri + '">' + tStored + '<DigestMethod Algorithm="' + SHA512 + '" /><DigestValue>' + digestB64 + '</DigestValue></Reference>' };
}

// Build one signature file (author or distributor). refs: [{uri,digest,withTransform}]. Returns Buffer.
function buildSignature(which, refs, propDigestB64, keyPem, certPem) {
    var id = which === 'author' ? 'AuthorSignature' : 'DistributorSignature';
    var role = which === 'author' ? 'author' : 'distributor';
    var refObjs = refs.map(function (r) { return reference(r.uri, r.digest, r.withTransform); });
    var propRef = reference('#prop', propDigestB64, true);

    // Canonical SignedInfo (exclusive-c14n: namespace first, explicit close tags) — this is what we sign.
    var siCanon = '<SignedInfo xmlns="' + DSIG + '">'
        + '<CanonicalizationMethod Algorithm="' + EXC_C14N + '"></CanonicalizationMethod>'
        + '<SignatureMethod Algorithm="' + RSA_SHA512 + '"></SignatureMethod>'
        + refObjs.map(function (r) { return r.canon; }).join('') + propRef.canon + '</SignedInfo>';
    // createSign, not crypto.sign / createPrivateKey: those are Node 12 / 11.6, the TV runs 4.4.3.
    var sigVal = crypto.createSign('RSA-SHA512').update(Buf.from(siCanon, 'utf8')).sign(keyPem, 'base64');

    // Stored SignedInfo (self-closed empties, no xmlns on SignedInfo — it inherits from Signature).
    var siStored = '<SignedInfo>'
        + '<CanonicalizationMethod Algorithm="' + EXC_C14N + '" />'
        + '<SignatureMethod Algorithm="' + RSA_SHA512 + '" />'
        + refObjs.map(function (r) { return r.stored; }).join('') + propRef.stored + '</SignedInfo>';
    // One <X509Certificate> per cert in the chain, each wrapped at 76 with a newline either side.
    var x509 = pemCerts(certPem).map(function (b64) { return '<X509Certificate>\n' + wrap76(b64) + '\n</X509Certificate>'; }).join('');
    var xml = '<Signature Id="' + id + '" xmlns="' + DSIG + '">'
        + siStored
        + '<SignatureValue>' + sigVal + '</SignatureValue>'
        + '<KeyInfo><X509Data>' + x509 + '</X509Data></KeyInfo>'
        + propStored(id, role) + '</Signature>';
    return Buf.from(xml, 'utf8');
}

function needCerts(certs) {
    if (!certs || !certs.authorKeyPem || !certs.distributorKeyPem) { var e = new Error('No signing certificate available on this TV yet (#844 cert hand-over).'); e.code = 'NO_CERT'; throw e; }
}

// Both signature files for package files given as [{name, digest}] (SHA-512, base64), in order.
function signatures(files, certs) {
    // author-signature.xml: references every package file + #prop
    var authorRefs = files.map(function (f) { return { uri: f.name, digest: f.digest, withTransform: false }; });
    var authorProp = sha512b64(Buf.from(propCanonical('AuthorSignature', 'author'), 'utf8'));
    var authorXml = buildSignature('author', authorRefs, authorProp, certs.authorKeyPem, certs.authorCertPem);

    // signature1.xml: references author-signature.xml (its stored bytes) + every package file + #prop
    var distRefs = [{ uri: 'author-signature.xml', digest: sha512b64(authorXml), withTransform: false }].concat(authorRefs);
    var distProp = sha512b64(Buf.from(propCanonical('DistributorSignature', 'distributor'), 'utf8'));
    var distXml = buildSignature('distributor', distRefs, distProp, certs.distributorKeyPem, certs.distributorCertPem);
    return { author: authorXml, distributor: distXml };
}

function packageFile(name) { return name !== 'author-signature.xml' && name !== 'signature1.xml'; }

// Signs the package at inFile into outFile; cb(err). Never holds the package in memory: each entry
// is inflated as a stream for its digest, and copied over still compressed, so a 41 MB package
// costs about as much memory as a small one (a Tizen 6 set lost the service on one, held whole).
function signFile(inFile, outFile, certs, cb) {
    try { needCerts(certs); } catch (e) { return cb(e); }
    var entries;
    try { entries = zip.readCentral(inFile).filter(function (e) { return !e.dir && packageFile(e.name); }); } catch (e) { return cb(e); }
    var files = [], i = 0;
    (function next() {
        if (i === entries.length) {
            var sig;
            try {
                sig = signatures(files, certs);
                // Both signatures first, then the files.
                zip.writeFile(outFile, [{ name: 'author-signature.xml', data: sig.author }, { name: 'signature1.xml', data: sig.distributor }]
                    .concat(entries.map(function (e) { return { name: e.name, from: inFile, entry: e }; })));
            } catch (e) { return cb(e); }
            return cb(null);
        }
        var e = entries[i++], h = crypto.createHash('sha512'), size = 0, done = false;
        function fin(err) {
            if (done) return; done = true;
            if (err) return cb(new Error('cannot read ' + e.name + ' from the package: ' + err.message));
            if (size !== e.uncompSize) return cb(new Error('size mismatch for ' + e.name));
            files.push({ name: e.name, digest: h.digest('base64') });
            setImmediate(next);
        }
        var st = zip.entryStream(inFile, e);
        st.on('data', function (d) { size += d.length; h.update(d); });
        st.on('end', function () { fin(null); });
        st.on('error', fin);
    })();
}

// The same on a Buffer, for small packages and the tests. Writes a STORED package.
function sign(wgtBuffer, certs) {
    needCerts(certs);
    var entries = zip.readEntries(wgtBuffer).filter(function (e) { return !e.dir && packageFile(e.name); });
    var sig = signatures(entries.map(function (e) { return { name: e.name, digest: sha512b64(e.data) }; }), certs);
    return zip.write([{ name: 'author-signature.xml', data: sig.author }, { name: 'signature1.xml', data: sig.distributor }]
        .concat(entries.map(function (e) { return { name: e.name, data: e.data }; })));
}

module.exports = { sign: sign, signFile: signFile, ready: true };


};
defs["./catalog.js"] = function (module,exports,require) {
/* The signed catalog (#881): how TV-Store trusts what it downloads without trusting the connection.
 *
 * The Node runtime of a Tizen web service cannot validate today's HTTPS chains (a 2019 Tizen 5.0
 * set answers "unable to get local issuer certificate" for apps2samsung.com), and older sets are
 * worse. So the service fetches over HTTPS without certificate validation and checks the content
 * instead, the way apt does:
 *   - resolved.json.signed is line 1 a base64 RSA-SHA256 signature, then resolved.json byte for
 *     byte, signed by the Apps2Samsung catalog workflow; only the key in catalog-key.js verifies it;
 *   - every package file in it carries its SHA-256 (`digest`, "sha256:<hex>"), and a download is
 *     installed only when its bytes hash to that.
 * Pure functions, so test/catalog.test.js can run them with a throwaway key.
 */
'use strict';
var crypto = require('crypto');

var MAX_AGE_MS = 7 * 24 * 3600 * 1000;   // the workflow re-signs at least twice a day

var Buf = require('./compat.js');
function b64(s) { return Buf.from(s, 'base64'); }

// buf: the bytes of resolved.json.signed. Returns { catalog, payload, index } or throws.
function verify(buf, publicKeyPem, now) {
    var nl = -1;
    for (var i = 0; i < buf.length && i < 4096; i++) if (buf[i] === 0x0a) { nl = i; break; }
    if (nl < 0) throw new Error('the catalog is not signed (no signature line)');
    var sig = b64(buf.slice(0, nl).toString('ascii').trim());
    var payload = buf.slice(nl + 1);

    var v = crypto.createVerify('RSA-SHA256');
    v.update(payload);
    if (!v.verify(publicKeyPem, sig)) throw new Error('the catalog signature does not match: not installing from it');

    var catalog = JSON.parse(payload.toString('utf8'));
    var at = Date.parse(catalog.generatedAt || '');
    if (!at) throw new Error('the signed catalog has no date');
    if ((now || Date.now()) - at > MAX_AGE_MS) throw new Error('the signed catalog is from ' + catalog.generatedAt + ', more than 7 days old: check the TV’s clock, or the Apps2Samsung catalog workflow');

    return { catalog: catalog, payload: payload, index: index(catalog) };
}

// Download URL -> lower-case hex SHA-256, for every package file the catalog lists.
function index(catalog) {
    var out = {};
    (catalog.providers || []).forEach(function (p) {
        (p.releases || []).forEach(function (r) {
            (r.assets || []).forEach(function (a) {
                var m = /^sha256:([0-9a-fA-F]{64})$/.exec(a.digest || '');
                if (a.browser_download_url) out[a.browser_download_url] = m ? m[1].toLowerCase() : null;
            });
        });
    });
    return out;
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

module.exports = { verify: verify, index: index, sha256: sha256, MAX_AGE_MS: MAX_AGE_MS };


};
defs["./catalog-key.js"] = function (module,exports,require) {
/* The public half of the key the Apps2Samsung catalog workflow signs resolved.json with (#881).
 * The private half is the CATALOG_SIGNING_KEY secret of Apps2Samsung/Apps2Samsung. Replacing the
 * key means a TV-Store release: every TV keeps trusting this one until it updates.
 */
'use strict';
module.exports = [
    '-----BEGIN PUBLIC KEY-----',
    'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAuSxPAaQONXHVJJ2gsndQ',
    'IHyTpG1CZP9lScSqCXFQad0h+m5xFtQ03mKGk67am7X5P7+SzOSPEBp+XIFjVOEe',
    'EfeLtm/+kX4M96CpgjtZLiuKa2EYd/1OFt9+ZYFaVUaJlprpQieLLFXpeENiG6MX',
    'AVbB8UCMkIGJz+eigeIkYU7HYO+9+HUS9oTvqeKoXZVUnDSNHYTCVWmzprIbXgLO',
    'va/bsHLXhGBl3IeNbfkC1nsHZjbcNxSFw6E+DLWv+2uZGM2Avx9vgYrMjgmbIyXc',
    'spu4wGJBs4p33lKCFltwXSuDrN8KBiLluK9pjXYLaOgzUhrKN0yzdAZewhXDD5tK',
    'zBUROgMjMDa+gc4CE0zmEfcbZ/mQU1FNt+y/TVig4tt86x7UoOyW+mLub58tOC/b',
    'eLANPPgLtNE+IOKOaaY3Y/4u9epiwPbYZR6lXo2T5NvDQjwSrOQ9l+I8imhrhupy',
    'bY4CTb76QMVny2rt5cQXnHasIhZkf6oi5m8KrePWCGVHAgMBAAE=',
    '-----END PUBLIC KEY-----',
].join('\n') + '\n';


};
defs["./personal-catalog.js"] = function (module,exports,require) {
'use strict';
module.exports = {"id":"qhsamsung-personal","ok":true,"url":"https://api.github.com/repos/tqh180581/qhsamsung/releases","latestTag":"kosovo-tizen5plus-v0.8.1","catalog":{"apps":[{"name":"Kosovo SamsungTV","group":"Kosovo SamsungTV","file":"Kosovo-SamsungTV-Tizen5plus-v0.8.1.wgt","version":"0.8.1","category":"iptv","description":"KOSOVO PANEL 0.8.1 dành cho Samsung Tizen 5.0 trở lên, giữ thông tin TV tự nhận và khôi phục điều hướng 0.7.6 sau phản hồi remote/cuộn bị giật. Chưa xác nhận lại trên TV. Chọn Install hoặc Update; cần tài khoản dịch vụ riêng.","repo":"tqh180581/qhsamsung","app_id":"KsvTv2019A.KosovoTV","package_id":"KsvTv2019A","min_tizen_version":"5.0","private_download":false}]},"releases":[{"tag_name":"kosovo-tizen5plus-v0.8.1","assets":[{"name":"Kosovo-SamsungTV-Tizen5plus-v0.8.1.wgt","browser_download_url":"https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.1/Kosovo-SamsungTV-Tizen5plus-v0.8.1.wgt","size":12326470,"digest":"sha256:4ae6de1576ed080989010f4a4aa894e30ef760ad60fdfe7da4b06301e4867855"}]},{"tag_name":"kosovo-tizen5plus-v0.8.0","assets":[{"name":"Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt","browser_download_url":"https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.0/Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt","size":12326565,"digest":"sha256:536866a4b4b0d72d362be991c6339f88cb67526c43786cd05e73408e4aeaa592"}]},{"tag_name":"movies-v0.7.6","assets":[{"name":"Kosovo-SamsungTV-v0.7.6.wgt","browser_download_url":"https://github.com/tqh180581/qhsamsung/releases/download/movies-v0.7.6/Kosovo-SamsungTV-v0.7.6.wgt","size":12331412,"digest":"sha256:13adae22402f6e9dc70f887300046d275ccd784c39c22e1b23188d300b9a94ca"}]}]};

};
defs["./personal.js"] = function (module,exports,require) {
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

};
defs["./index.js"] = function (module,exports,require) {
/* TV-Store background service (#844): the control plane the on-screen UI drives over loopback HTTP,
 * and the install pipeline (download -> sign -> push -> vd_appinstall) over the sdb client.
 *
 * Opening a raw socket to sdbd and running a real HTTP server on loopback are both proven on retail
 * (the tessel SMB proxy, and the #844 phase-0 probe). The sdb transport here is proven end to end
 * against a fake sdbd (test/run.js). The one not-yet-ready step is signer.sign (see signer.js).
 */
'use strict';
var http = require('http');
var https = require('https');
var os = require('os');
var url = require('url');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var sdb = require('./sdb.js');
var signer = require('./signer.js');
var zip = require('./zip.js');
var catalogTrust = require('./catalog.js');
var CATALOG_KEY = require('./catalog-key.js');
var personalCatalog = require('./personal.js');

var PORT = 8077;
// Signed by the Apps2Samsung catalog workflow; see catalog.js for why the content is checked
// instead of the connection.
var CATALOG_URL = 'https://apps2samsung.com/catalog/resolved.json.signed';
var STAGING = '/home/owner/share/tmp/sdk_tools';   // where sdbd accepts a pushed .wgt
var LOGS = [];
var CERT_NAME = '.a2s-tvstore-certs.json';
// Where the handed-over certificate is kept, best first: the package's private data folder
// (what the page's tizen.filesystem calls wgt-private), which survives a reboot and an upgrade.
// The service runs from /opt/usr/apps/<pkg>/res/wgt/service, read-only, and $HOME (/home/owner)
// is not writable for it (both seen on a 2019 Tizen 5.0 set, #881); the data folder lives under
// apps_rw instead. /tmp is the last resort: it survives an app restart, not a reboot, and is
// where 0.3.3 ended up, so a certificate found there is moved up.
// The package id, from where the service runs (/opt/usr/apps/<pkg>/res/wgt/service). A runtime
// that gives the script no __dirname gets the id TV-Store ships with.
var PKG = typeof __dirname === 'string' ? path.basename(path.resolve(__dirname, '../../..')) : 'A2STVStore';
var CERT_DIRS = ['/opt/usr/home/owner/apps_rw/' + PKG + '/data', '/home/owner/apps_rw/' + PKG + '/data', process.env.HOME, '/tmp']
    .filter(function (d) { return !!d; });
var CERT_FILE = null, CERT_ERROR = null;
var CERTS = null;
var CATALOG = null;        // { catalog, payload, index, at } once a signed catalog verified
// Where the service keeps files: the first of the folders it may write. The log and the packages
// being installed live here, not in /tmp, which is RAM on many sets.
var DATA_DIRS = ['/opt/usr/home/owner/apps_rw/' + PKG + '/data', '/home/owner/apps_rw/' + PKG + '/data', os.tmpdir ? os.tmpdir() : '/tmp', '/tmp'];
var DATA_DIR = null;
for (var di = 0; di < DATA_DIRS.length && !DATA_DIR; di++) {
    try { var probe = path.join(DATA_DIRS[di], '.a2s-write-test'); fs.writeFileSync(probe, ''); fs.unlinkSync(probe); DATA_DIR = DATA_DIRS[di]; } catch (e) {}
}
// The log, on disk so it survives the service going down (the Tizen 6 report: the service vanished
// mid-install and the in-memory log with it). The previous run's log is kept next to it. Anyone on
// the LAN can read both at http://<TV IP>:8077/log.txt; they hold no keys.
var LOG_FILE = DATA_DIR ? path.join(DATA_DIR, 'tvstore.log') : null, LOG_PREV = LOG_FILE ? LOG_FILE.replace(/\.log$/, '.prev.log') : null;
if (LOG_FILE) { try { fs.renameSync(LOG_FILE, LOG_PREV); } catch (e) {} }
function log(m) {
    var l = new Date().toISOString() + ' ' + m; LOGS.push(l); if (LOGS.length > 300) LOGS.shift(); try { console.log(l); } catch (e) {}
    if (!LOG_FILE) return;
    try { if (fs.statSync(LOG_FILE).size > 512 * 1024) fs.renameSync(LOG_FILE, LOG_PREV); } catch (e) {}
    try { fs.appendFileSync(LOG_FILE, l + '\n'); } catch (e) {}
}
function logText() {
    var t = '';
    try { t += '--- previous run ---\n' + fs.readFileSync(LOG_PREV, 'utf8') + '\n'; } catch (e) {}
    try { t += '--- this run ---\n' + fs.readFileSync(LOG_FILE, 'utf8'); } catch (e) { t += '--- this run (memory) ---\n' + LOGS.join('\n') + '\n'; }
    return t;
}

// Every address of this TV, loopback included: the only peers the service answers (besides /log.txt).
function ownAddresses() {
    var out = ['127.0.0.1'];
    try { var ifs = os.networkInterfaces();
        for (var n in ifs) for (var i = 0; i < ifs[n].length; i++) if (ifs[n][i].family === 'IPv4') out.push(ifs[n][i].address);
    } catch (e) {}
    return out;
}
function fromThisTv(req) {
    var a = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    return /^127\./.test(a) || ownAddresses().indexOf(a) >= 0;
}

// This TV's own LAN IPv4 — the address sdbd accepts a connection on (phase 0: not loopback).
function ownIp() {
    try { var ifs = os.networkInterfaces();
        for (var n in ifs) for (var i = 0; i < ifs[n].length; i++) { var a = ifs[n][i]; if (a.family === 'IPv4' && !a.internal) return a.address; }
    } catch (e) {}
    return null;
}

// HTTPS without certificate validation: the TV's CA store is too old for today's chains, so
// nothing fetched here is trusted for where it came from. The catalog is trusted through its
// signature and a package through the hash the catalog gives it (catalog.js).
function get(u, cb, hops) {
    hops = hops || 0;
    if (hops > 5) return cb(new Error('too many redirects for ' + u));
    var o = url.parse(u), secure = o.protocol === 'https:';
    var opts = { protocol: o.protocol, hostname: o.hostname, port: o.port || (secure ? 443 : 80), path: o.path,
                 headers: { 'User-Agent': 'Apps2Samsung-TV-Store' } };
    if (secure) opts.rejectUnauthorized = false;
    var req = (secure ? https : http).get(opts, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return get(url.resolve(u, res.headers.location), cb, hops + 1); }
        if (res.statusCode !== 200) { res.resume(); return cb(new Error('HTTP ' + res.statusCode + ' for ' + u)); }
        var chunks = []; res.on('data', function (d) { chunks.push(d); }); res.on('end', function () { cb(null, Buffer.concat(chunks)); });
    });
    req.on('error', cb); req.setTimeout(30000, function () { req.abort(); });
}

// get() to a file, hashing on the way: cb(err, { size, sha256 }). A package never sits in memory.
function getToFile(u, file, cb, hops) {
    hops = hops || 0;
    if (hops > 5) return cb(new Error('too many redirects for ' + u));
    var o = url.parse(u), secure = o.protocol === 'https:', done = false;
    function fin(err, r) { if (done) return; done = true; cb(err, r); }
    var opts = { protocol: o.protocol, hostname: o.hostname, port: o.port || (secure ? 443 : 80), path: o.path,
                 headers: { 'User-Agent': 'Apps2Samsung-TV-Store' } };
    if (secure) opts.rejectUnauthorized = false;
    var req = (secure ? https : http).get(opts, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); done = true; return getToFile(url.resolve(u, res.headers.location), file, cb, hops + 1); }
        if (res.statusCode !== 200) { res.resume(); return fin(new Error('HTTP ' + res.statusCode + ' for ' + u)); }
        var h = crypto.createHash('sha256'), size = 0, out = fs.createWriteStream(file);
        res.on('data', function (d) { size += d.length; h.update(d); });
        res.on('error', fin); out.on('error', fin);
        out.on('finish', function () { fin(null, { size: size, sha256: h.digest('hex') }); });
        res.pipe(out);
    });
    req.on('error', fin); req.setTimeout(30000, function () { req.abort(); });
}

// POST body JSON helper
function body(req, cb) { var c = []; req.on('data', function (d) { c.push(d); }); req.on('end', function () { try { cb(null, c.length ? JSON.parse(Buffer.concat(c).toString('utf8')) : {}); } catch (e) { cb(e); } }); }

function cors(res, code, type) { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }); }
function json(res, code, obj) { cors(res, code, 'application/json'); res.end(JSON.stringify(obj)); }

// The full install pipeline for one package. progress via log; final state via cb.
function install(entry, cb) {
    var downloadUrl = entry.url, remoteName = (entry.file || 'package.wgt').replace(/[^A-Za-z0-9._-]/g, '_');
    // Only what the signed catalog lists, with the hash it gives: the loopback port is open to
    // every app on the TV, and none of them gets to choose what is signed with the user's
    // certificate.
    withCatalog(function (err, cat) {
        if (err) return cb(err);
        if (!cat.index.hasOwnProperty(downloadUrl)) return cb(coded('NOT_IN_CATALOG', 'this download is not in the signed catalog'));
        var want = cat.index[downloadUrl];
        if (!want) return cb(coded('NO_HASH', 'the catalog has no hash for this file, so the TV cannot check it; install it from Apps2Samsung on a phone or PC'));
        if (!DATA_DIR) return cb(new Error('the service has no folder it can write to'));
        var base = path.join(DATA_DIR, 'job-' + Date.now()), inFile = base + '.in.wgt', outFile = base + '.signed.wgt';
        function clean(err, r) { [inFile, outFile].forEach(function (f) { try { fs.unlinkSync(f); } catch (e) {} }); cb(err, r); }
        log('install: downloading ' + downloadUrl);
        getToFile(downloadUrl, inFile, function (err, got) {
            if (err) return clean(err);
            if (got.sha256 !== want) { log('install: hash mismatch, got ' + got.sha256 + ' want ' + want); return clean(coded('HASH_MISMATCH', 'the download does not match the catalog (SHA-256 differs); not installing it')); }
            log('install: downloaded ' + got.size + ' bytes, SHA-256 matches the catalog; signing');
            signAndInstall(entry, remoteName, inFile, outFile, clean);
        });
    });
}

function coded(code, message) { var e = new Error(message); e.code = code; return e; }

function signAndInstall(entry, remoteName, inFile, outFile, cb) {
    var started = Date.now();
    signer.signFile(inFile, outFile, loadCerts(), function (err) {
        if (err) { log('install: ' + err.message); return cb(err); }        // NO_CERT surfaces here
        try { fs.unlinkSync(inFile); } catch (e) {}
        var size = fs.statSync(outFile).size;
        log('install: signed in ' + Math.round((Date.now() - started) / 1000) + ' s, ' + size + ' bytes');
        var ip = ownIp();
        if (!ip) return cb(new Error('could not determine this TV’s own IP'));
        var c = new sdb.SdbClient(ip);
        log('install: connecting to this TV at ' + ip + ':26101; Developer Mode Host PC IP must be ' + ip);
        c.connect(function (err) {
            if (err) { log('install: ' + err.message); c.end(); return cb(err); }
            var remote = STAGING + '/' + remoteName, fd;
            try { fd = fs.openSync(outFile, 'r'); } catch (e) { c.end(); return cb(e); }
            log('install: pushing to ' + remote);
            c.push(remote, { size: size, read: function (off, len) { return zip.readAt(fd, off, len); } }, function (err) {
                try { fs.closeSync(fd); } catch (e) {}
                if (err) { c.end(); return cb(err); }
                c.shell('0 vd_appinstall ' + (entry.appId || entry.packageId || '') + ' ' + remote, function (err, out) {
                    c.end();
                    if (err) return cb(err);
                    log('install: vd_appinstall reply: ' + out.replace(/\s+/g, ' ').slice(0, 200));
                    // sdbd answers the shell call either way; the installer's own words say whether it
                    // worked ("install failed[118, -12], reason: ..." on a refused package).
                    var failed = /install failed\[([^\]]*)\](?:,\s*reason:\s*([^\n]*))?/i.exec(out);
                    if (failed) return cb(coded('INSTALL_FAILED', 'The TV refused the package [' + failed[1] + ']' + (failed[2] ? ': ' + failed[2].trim() : '')));
                    cb(null, { reply: out });
                });
            });
        });
    });
}

// The signed catalog, fetched and verified, cached for 10 minutes (the workflow publishes every
// 30). A download URL is installable only when this lists it.
// Requests that arrive while a fetch is running wait for that one.
var CATALOG_WAITING = null;
function withCatalog(cb, fresh) {
    if (CATALOG && !fresh && Date.now() - CATALOG.at < 10 * 60 * 1000) return cb(null, CATALOG);
    if (CATALOG_WAITING) return CATALOG_WAITING.push(cb);
    CATALOG_WAITING = [cb];
    function done(err, cat) { var w = CATALOG_WAITING; CATALOG_WAITING = null; w.forEach(function (f) { f(err, cat); }); }
    get(CATALOG_URL, function (err, buf) {
        if (err) {
            // An unavailable upstream never authorizes arbitrary downloads. Only the exact
            // personal packages pinned in this signed application remain available.
            var local;
            try { local = personalCatalog.merge(null); } catch (e) { return done(e); }
            local.at = Date.now(); CATALOG = local;
            log('catalog: upstream unavailable; using bundled personal packages only');
            return done(null, local);
        }
        var cat;
        try { cat = catalogTrust.verify(buf, CATALOG_KEY); }
        catch (e) { log('catalog: ' + e.message); return done(e); }
        try { cat = personalCatalog.merge(cat); }
        catch (e) { return done(e); }
        cat.at = Date.now(); CATALOG = cat;
        log('catalog: signature ok, generated ' + cat.catalog.generatedAt + ', ' + Object.keys(cat.index).length + ' files');
        done(null, cat);
    });
}

// The signing certificate a head hands over once (see #844): author/distributor key+cert as PEM
// (not a .p12 — Node has no PKCS#12 parser). Kept in memory and persisted best-effort.
function loadCerts() {
    if (CERTS) return CERTS;
    for (var i = 0; i < CERT_DIRS.length; i++) {
        var f = path.join(CERT_DIRS[i], CERT_NAME);
        try { CERTS = JSON.parse(fs.readFileSync(f, 'utf8')); CERT_FILE = f; } catch (e) { continue; }
        // Found in a worse place (0.3.3 kept it in $HOME or /tmp): move it up where it persists.
        if (i > 0) saveCerts(CERTS);
        return CERTS;
    }
    return null;
}
function saveCerts(b) {
    CERTS = b; CERT_ERROR = null;
    for (var i = 0; i < CERT_DIRS.length; i++) {
        var f = path.join(CERT_DIRS[i], CERT_NAME);
        try { fs.writeFileSync(f, JSON.stringify(b)); CERT_FILE = f; log('cert: stored in ' + f); return; }
        catch (e) { CERT_ERROR = f + ': ' + e.message; log('cert: cannot write ' + CERT_ERROR); }
    }
}
function haveCerts() { var c = loadCerts(); return !!(c && c.authorKeyPem && c.distributorKeyPem); }

http.createServer(function (req, res) {
    if (req.method === 'OPTIONS') { cors(res, 204, 'text/plain'); return res.end(); }
    var route = url.parse(req.url).pathname;
    if (route === '/log.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); return res.end(logText()); }
    // The rest only for this TV: the port is open to the LAN because Tizen 10 may not route a page's
    // request to the service over loopback, but nothing else on the network gets to hand over a
    // certificate or start an install.
    if (!fromThisTv(req)) { cors(res, 403, 'text/plain'); return res.end('only this TV may use TV-Store'); }
    if (route === '/ping') return json(res, 200, { ok: true, service: 'tv-store', ownIp: ownIp(), logUrl: 'http://' + ownIp() + ':' + PORT + '/log.txt', signerReady: signer.ready, certReady: haveCerts(),
        certFile: CERT_FILE, certError: CERT_ERROR, node: process.version });
    if (route === '/logs') return json(res, 200, { logs: LOGS });
    if (route === '/catalog') return withCatalog(function (err, cat) { if (err) return json(res, 502, { ok: false, error: err.message }); cors(res, 200, 'application/json'); res.end(cat.payload); });
    if (route === '/cert' && req.method === 'POST') return body(req, function (err, b) {
        if (err || !b || !b.authorKeyPem || !b.authorCertPem || !b.distributorKeyPem || !b.distributorCertPem)
            return json(res, 400, { ok: false, error: 'need { authorKeyPem, authorCertPem, distributorKeyPem, distributorCertPem }' });
        log('cert: received signing certificate from a head'); saveCerts(b);
        json(res, 200, { ok: true, certFile: CERT_FILE, certError: CERT_FILE ? null : CERT_ERROR });
    });
    if (route === '/install' && req.method === 'POST') return body(req, function (err, b) {
        if (err || !b || !b.url) return json(res, 400, { ok: false, error: 'need { url, file, appId }' });
        install(b, function (err, r) { if (err) return json(res, 200, { ok: false, error: err.message, code: err.code || null }); json(res, 200, { ok: true, result: r }); });
    });
    cors(res, 404, 'text/plain'); res.end('not found');
}).listen(PORT, '0.0.0.0', function () { log('TV-Store service on port ' + PORT + ', node ' + process.version + ' ' + process.arch + ', this TV ' + ownIp() + ', data ' + DATA_DIR); });

module.exports.onStart = function () { log('service onStart'); };
module.exports.onRequest = function () { log('service onRequest'); };


};
var api = load("./index.js");
if (hostModule && hostModule.exports) for (var k in api) hostModule.exports[k] = api[k];
})(typeof require === "function" ? require : null, typeof module === "object" ? module : null);
