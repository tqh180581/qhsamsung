/* Offline release envelope: retain the exact stable041 runtime and verify the
 * unsigned archive produced by the existing portable build flow. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const zip=require('../service-src/zip.js');
const root=path.resolve(__dirname,'..');
const base='f3b3511d10c971d1d6f25071ee8b2d67b63ec240';
function git(args){return cp.execFileSync('git',args,{cwd:root});}
function original(name){return git(['show',base+':'+name]);}
function current(name){return fs.readFileSync(path.join(root,name));}
function normalized(bytes){return bytes.toString('utf8').replace(/\r\n/g,'\n');}
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

test('stable041 UI, installer, trust guards and runtime are unchanged except version and generated catalogue',()=>{
    const allowed=new Set(['tizen-app/config.xml','tizen-app/js/app.js','tizen-app/js/personal-catalog.js','tizen-app/service/index.js','service-src/personal-catalog.js']);
    const files=git(['ls-tree','-r','--name-only',base,'tizen-app','service-src']).toString('utf8').trim().split('\n');
    assert.equal(files.length,16,'exact stable041 source/runtime file inventory');
    for(const file of files)if(!allowed.has(file))assert.equal(hash(current(file)),hash(original(file)),file);
    assert.equal(normalized(current('tizen-app/config.xml')).replace('version="0.4.3"','version="0.4.1"'),normalized(original('tizen-app/config.xml')));
    assert.equal(normalized(current('tizen-app/js/app.js')).replace("var VERSION = '0.4.3-qh9';","var VERSION = '0.4.1-qh7';"),normalized(original('tizen-app/js/app.js')));
    for(const file of ['scripts/build.ps1','scripts/bundle.cjs','scripts/test-sdb-connect.cjs'])assert.equal(hash(current(file)),hash(original(file)),file);
    const newCatalog=JSON.parse(current('catalog/personal-apps.json')),oldCatalog=JSON.parse(original('catalog/personal-apps.json'));
    assert.deepEqual(newCatalog.releases.slice(1),oldCatalog.releases,'complete historical release objects must remain immutable');
    const newService=normalized(current('service-src/personal-catalog.js')),oldService=normalized(original('service-src/personal-catalog.js'));
    assert.equal(normalized(current('tizen-app/service/index.js')).replace(newService,oldService),normalized(original('tizen-app/service/index.js')),'bundle changes only its catalogue module');
});

test('unsigned Store archive is portable, complete and contains exact verified source payloads',()=>{
    const widget=path.resolve(root,'dist/QHSamsung.wgt'),bytes=fs.readFileSync(widget),entries=zip.readEntries(bytes);
    assert.equal(entries.length,7,'exact stable041 WGT payload inventory');assert.equal(new Set(entries.map(e=>e.name)).size,entries.length);
    for(const entry of entries){
        assert.equal(entry.dir,false);assert.ok(!entry.name.includes('\\')&&!entry.name.startsWith('/')&&!entry.name.split('/').includes('..'),entry.name);
        assert.ok(!/(?:\.p12|\.pfx|\.pem|\.key|\.pwd)$|(?:^|\/)(?:author-signature|signature\d+)\.xml$/i.test(entry.name),'unsigned release must not include secrets or signatures');
        assert.equal(hash(entry.data),hash(current('tizen-app/'+entry.name)),entry.name);
    }
    function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.relative(path.join(root,'tizen-app'),path.join(dir,e.name)).split(path.sep).join('/')]);}
    assert.deepEqual(entries.map(e=>e.name).sort(),files(path.join(root,'tizen-app')).sort());
    const manifest=entries.find(e=>e.name==='config.xml').data.toString('utf8');
    assert.match(manifest,/<widget\b[^>]*\bversion="0\.4\.3"/);assert.match(manifest,/<tizen:application id="A2STVStore\.Store" package="A2STVStore" required_version="3\.0"/);
    assert.match(entries.find(e=>e.name==='js/app.js').data.toString('utf8'),/var VERSION = '0\.4\.3-qh9'/);
});
