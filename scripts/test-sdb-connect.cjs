const net = require('net');
const assert = require('assert');
const {SdbClient, frame, CMD} = require('../service-src/sdb.js');
async function check(mode) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    if (mode === 'close') socket.end();
    if (mode === 'accept') socket.once('data', () => socket.write(frame(CMD.CNXN,0x01000000,4096,Buffer.from('device::'))));
    if (mode === 'auth') socket.once('data', () => socket.write(frame(CMD.AUTH,1,0,Buffer.alloc(20))));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const client = new SdbClient('127.0.0.1',server.address().port);
  let calls = 0;
  try {
    await new Promise((resolve,reject) => {
      const deadline = setTimeout(() => reject(new Error(mode+' callback hung')),2000);
      client.connect(err => {
        calls++;
        try {
          if (mode === 'accept') assert.ifError(err);
          else { assert(err); assert(/Host PC IP/.test(err.message)); }
          client.end();
          setTimeout(() => {clearTimeout(deadline); try {assert.strictEqual(calls,1);resolve();} catch(e){reject(e);}},30);
        } catch(e) { clearTimeout(deadline);reject(e); }
      });
    });
  } finally {client.end();for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));}
}
(async()=>{for(const mode of ['close','accept','auth']) await check(mode);console.log('SDB early-close, successful handshake and auth-rejection callbacks: OK');})().catch(e=>{console.error(e);process.exitCode=1;});
