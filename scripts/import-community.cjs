// Import only catalog metadata; package downloads stay on the original GitHub release.
const fs = require('fs');
const path = require('path');
const https = require('https');
const trust = require('../service-src/catalog.js');
const publicKey = require('../service-src/catalog-key.js');
const root = path.resolve(__dirname, '..');
const source = 'https://apps2samsung.com/catalog/resolved.json.signed';
const releaseApi = 'https://api.github.com/repos/Apps2Samsung/tizen-community-packages/releases/latest';
function get(url, hops = 0) {
  if (hops > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, {headers:{'User-Agent':'QHSamsung-personal-catalog'}}, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve(get(new URL(res.headers.location, url).href, hops + 1)); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ': ' + url)); return; }
      const parts = []; let size = 0;
      res.on('data', b => { size += b.length; if (size > 20 * 1024 * 1024) req.destroy(new Error('Metadata too large')); else parts.push(b); });
      res.on('end', () => resolve(Buffer.concat(parts))); res.on('error', reject);
    });
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('Download timeout')));
  });
}
async function run() {
  // Verification uses the original upstream key even after a personal key is configured.
  const keyFile = path.join(root, 'catalog/upstream-public-key.js');
  const key = fs.existsSync(keyFile) ? require(keyFile) : publicKey;
  const [signed, releaseBytes] = await Promise.all([get(source), get(releaseApi)]);
  const verified = trust.verify(signed, key);
  const provider = verified.catalog.providers.find(p => p.id === 'tizen-community' && p.ok !== false);
  if (!provider || !provider.catalog || !Array.isArray(provider.catalog.apps)) throw new Error('Community metadata missing');
  const release = JSON.parse(releaseBytes);
  if (provider.latestTag !== release.tag_name) throw new Error('Signed catalog is not yet synced with the newest release. Retry later.');
  const latest = provider.releases[0];
  const assets = new Map(release.assets.map(a => [a.name, a]));
  const missing = [];
  for (const app of provider.catalog.apps) {
    const file = latest.assets.find(a => a.name === app.file);
    const actual = assets.get(app.file);
    if (!file || !actual) { missing.push(app.file); continue; }
    if (!/^sha256:[a-f0-9]{64}$/i.test(file.digest || '') || file.digest !== actual.digest || file.browser_download_url !== actual.browser_download_url || file.size !== actual.size) throw new Error('Release metadata mismatch: ' + app.file);
  }
  if (missing.length) throw new Error('Catalog files missing from release: ' + missing.join(', '));
  const catalog = {schemaVersion:verified.catalog.schemaVersion, generatedAt:verified.catalog.generatedAt, providers:[provider]};
  const personalFile = path.join(root,'catalog/personal-apps.json');
  if (fs.existsSync(personalFile)) catalog.providers.push(JSON.parse(fs.readFileSync(personalFile,'utf8')));
  const groups = new Set(provider.catalog.apps.map(a => a.group || a.name));
  const summary = {sourceRepository:'https://github.com/Apps2Samsung/tizen-community-packages', release:release.tag_name, releaseUrl:release.html_url, importedAt:new Date().toISOString(), signedCatalogGeneratedAt:catalog.generatedAt, apps:groups.size, variants:provider.catalog.apps.length, packagesCopied:false};
  const dir = path.join(root, 'catalog'); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'catalog.json'), JSON.stringify(catalog,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'community-import.json'),JSON.stringify(summary,null,2)+'\n');
  function cell(s) { return String(s || '').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' '); }
  const rows = provider.catalog.apps.map(a => {
    const file = assets.get(a.file);
    return '| '+[a.name,a.version,a.category,a.file].map(cell).join(' | ')+' | [Tải từ nguồn]('+file.browser_download_url+') |';
  });
  const doc = '# Ứng dụng QHSamsung\n\nNguồn: '+summary.sourceRepository+' · Bản '+summary.release+'\n\n'+summary.apps+' nhóm ứng dụng, '+summary.variants+' gói/biến thể. Tệp cài vẫn tải từ kho gốc. Không phải tất cả ứng dụng tương thích Tizen 5.0.\n\n| Ứng dụng | Phiên bản | Nhóm | Gói | Tải |\n|---|---|---|---|---|\n'+rows.join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'APPS.md'),doc);
  if (fs.existsSync(personalFile)) fs.appendFileSync(path.join(dir,'APPS.md'),'\n## Ứng dụng cá nhân\n\nXem [danh sách cá nhân](PERSONAL-APPS.md) và [bộ app phổ biến cho Tizen 4+](POPULAR-APPS.md). App cá nhân hiện tại được phân phối qua danh mục trực tuyến riêng của QHSamsung.\n');
  console.log(JSON.stringify(summary,null,2));
}
run().catch(err => {console.error(err.message);process.exitCode=1;});
