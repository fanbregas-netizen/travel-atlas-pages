#!/usr/bin/env node
'use strict';
// Read-only local release preflight. Never opens a browser profile, credentials,
// or a user's IndexedDB; never deploys the public site.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const manifest='.github/V5_PRODUCTION_FILES_20261122.txt';
const list=read(manifest).split(/\r?\n/).filter(Boolean);
assert.equal(list.length,174,'canonical V5 package must contain 174 source assets');
assert.equal(new Set(list).size,174,'duplicate file paths in release manifest');
for(const file of list){
 assert(!path.isAbsolute(file)&&!file.includes('..')&&!file.startsWith('.'),'unsafe path '+file);
 const full=path.resolve(root,file);
 assert(full.startsWith(root+path.sep),'out-of-root path '+file);
 assert(fs.statSync(full).isFile()&&fs.statSync(full).size>0,'missing root asset '+file);
}
const html=read('index.html'), sw=read('sw.js'), route=read('src/route/route-live-network-v1.js'),
config=read('routing-config.js'), media=read('src/media/media-core.js');
const v=JSON.parse(read('version.json')), app=JSON.parse(read('manifest.webmanifest'));
assert.equal(v.version,'V5.1.0.20261122');
assert(html.includes('<meta name="atlas-release" content="'+v.version+'">'));
assert(!/window\.__fpStorageNamespace\s*=|window\.__atlasPreviewNamespace\s*=/.test(html),'QA namespace leaked into production index');
assert(media.includes('private-travel-footprints-v1'),'private media DB must match V4');
assert(read('v4-map-runtime.js').includes('private-travel-footprints-v1'),'original bookmarks must use same DB');
assert(!/indexedDB\.deleteDatabase|localStorage\.clear\(\)/.test(html),'unsafe data reset on root load');
assert(app.id==='./'&&app.start_url==='./index.html'&&app.scope==='./');
const configPosition=html.indexOf('./routing-config.js'),roadPosition=html.indexOf('./src/route/route-live-network-v1.js');
assert(configPosition>=0&&roadPosition>configPosition,'road config must precede deferred road adapter');
assert(config.includes("ROAD_PROXY_ORIGIN = ''"),'road proxy must fail closed until authorized');
assert(route.includes('safeEndpoint(configured.car)'),'road adapter must reject missing proxy');
assert(!route.includes("car:'https://routing.openstreetmap.de/"),'public OSRM demonstration service is not licensed');
assert(!/car:\s*['"]https:\/\//.test(route),'no browser-shipped provider defaults');
assert(sw.includes("footprint-v5-production-20261122-v2"),'production SW cache version');
assert(!/indexedDB\.deleteDatabase|localStorage\.clear\(\)/.test(sw),'SW may never clear local user data');
assert(html.includes("navigator.serviceWorker.register('./sw.js'"),'root SW registration');
const assetBlock=(sw.match(/const ASSETS=\[([\s\S]*?)\];/)||[])[1];
assert(assetBlock,'missing SW asset manifest');
const assets=[...assetBlock.matchAll(/'((?:\.\/)[^']*)'/g)].map(x=>x[1]);
const missing=assets.filter(a=>!fs.existsSync(path.join(root,a)));
assert.equal(missing.length,0,'SW asset missing: '+missing.join(', '));
assert(assets.length>=120,'SW should precache core map/media assets');
assert(assets.includes('./routing-config.js'),'SW must precache safe road config');
const checkFiles=['v4-map-runtime.js','footprint-home.js','src/media/photo-zoom-v5.js','src/interaction/collection-local-search-v5.js','src/route/route-single-map-v1.js'];
for(const f of checkFiles)assert(list.includes(f),'critical package asset absent: '+f);
const summary={release:v.version,fileCount:list.length,swAssets:assets.length,
 v4DatabasePreserved:true,previewNamespaceAbsent:true,roadService:'FAIL_CLOSED_UNTIL_LICENSED',
 fullUserSafariBackup:'NOT_VERIFIED_BY_AUTOMATION',formalSiteChanged:false};
console.log('PASS production bundle manifest, data-name and fail-closed routing static checks');
console.log(JSON.stringify(summary,null,2));
