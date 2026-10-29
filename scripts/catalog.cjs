// Node.js on the PC, not on the TV. Never writes a private key into the project.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const command = process.argv[2];
function fail(message) { throw new Error(message); }
if (command === 'sign') {
  const keyPath = process.argv[3];
  if (!keyPath) fail('Usage: node scripts/catalog.cjs sign <private-key-path-outside-project>');
  const resolved = path.resolve(keyPath);
  const relative = path.relative(root, resolved);
  if (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) fail('Keep the private key outside this project.');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog/catalog.json'), 'utf8'));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.providers)) fail('Expected schemaVersion 1 and providers array.');
  const seen = new Set();
  for (const provider of catalog.providers) {
    if (!provider.id || !Array.isArray(provider.releases)) fail('Each provider needs id and releases.');
    for (const release of provider.releases) {
      for (const asset of release.assets || []) {
        const url = new URL(asset.browser_download_url);
        if (url.protocol !== 'https:' || url.username || url.password) fail('Only HTTPS URLs without embedded credentials are allowed.');
        if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) fail('Every asset needs its actual SHA-256 digest.');
        if (seen.has(url.href)) fail('Duplicate asset URL: ' + url.href);
        seen.add(url.href);
      }
    }
  }
  catalog.generatedAt = new Date().toISOString();
  const payload = Buffer.from(JSON.stringify(catalog));
  const key = crypto.createPrivateKey(fs.readFileSync(resolved));
  if (key.asymmetricKeyType !== 'rsa') fail('Use an RSA signing key.');
  const sig = crypto.sign('RSA-SHA256', payload, key).toString('base64');
  const signed = Buffer.concat([Buffer.from(sig + '\n'), payload]);
  require('../service-src/catalog.js').verify(signed, crypto.createPublicKey(key));
  const target = path.join(root, 'docs/catalog');
  fs.mkdirSync(target, {recursive:true});
  fs.writeFileSync(path.join(target, 'resolved.json'), payload);
  fs.writeFileSync(path.join(target, 'resolved.json.signed'), signed);
  console.log('Signed catalog: ' + seen.size + ' package files. Publish docs/ with GitHub Pages.');
} else if (command === 'configure') {
  const publicKeyPath = process.argv[3];
  if (!publicKeyPath) fail('Usage: node scripts/catalog.cjs configure <public-key-path>');
  const key = crypto.createPublicKey(fs.readFileSync(publicKeyPath));
  if (key.asymmetricKeyType !== 'rsa') fail('Use an RSA public key.');
  const pem = key.export({type:'spki',format:'pem'});
  const config = JSON.parse(fs.readFileSync(path.join(root,'qhsamsung.json'),'utf8'));
  const url = new URL(config.catalogUrl);
  if (url.protocol !== 'https:' || url.username || url.password) fail('Catalog URL must use HTTPS without credentials.');
  const service = path.join(root,'service-src/index.js');
  const source = fs.readFileSync(service,'utf8');
  if (!/var CATALOG_URL = '[^']*';/.test(source)) fail('Catalog URL marker missing.');
  fs.writeFileSync(service,source.replace(/var CATALOG_URL = '[^']*';/,function(){return 'var CATALOG_URL = '+JSON.stringify(url.href)+';';}));
  fs.writeFileSync(path.join(root,'service-src/catalog-key.js'),"'use strict';\nmodule.exports = "+JSON.stringify(pem)+';\n');
  console.log('Personal catalog URL and public key configured. Rebuild the package.');
} else {
  console.log('Commands: sign <private-key-path-outside-project> | configure <public-key-path>');
}
